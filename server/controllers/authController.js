import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import User from "../models/User.js";
import Clinic from "../models/Clinic.js";

function normalizeUsername(value) {
  return value?.trim().toLowerCase();
}

function buildUserResponse(user) {
  return {
    id: user._id,
    username: user.username,
    email: user.email,
    role: user.role,
    clinicId: user.clinicId,
    clinicName: user.clinicName,
    facilityType: user.facilityType,
    fullName: user.fullName,
    phone: user.phone,
  };
}

function signToken(user) {
  return jwt.sign(
    {
      sub: String(user._id),
      role: user.role,
      username: user.username,
    },
    process.env.JWT_SECRET,
    { expiresIn: "7d" }
  );
}

async function geocodeClinicAddress(address) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 7000);

  try {
    const url = new URL("https://nominatim.openstreetmap.org/search");
    url.searchParams.set("q", address);
    url.searchParams.set("format", "jsonv2");
    url.searchParams.set("limit", "1");
    url.searchParams.set("addressdetails", "1");

    const response = await fetch(url, {
      method: "GET",
      headers: {
        "Accept-Language": "en",
        "User-Agent": "ClinicQ/1.0 (contact: support@clinicq.local)",
      },
      signal: controller.signal,
    });

    if (!response.ok) {
      return null;
    }

    const results = await response.json();
    const first = Array.isArray(results) ? results[0] : null;

    if (!first) {
      return null;
    }

    const lat = Number(first.lat);
    const lng = Number(first.lon);

    if (Number.isNaN(lat) || Number.isNaN(lng)) {
      return null;
    }

    return {
      lat,
      lng,
      formattedAddress: first.display_name || address,
    };
  } catch {
    return null;
  } finally {
    clearTimeout(timeout);
  }
}

export async function signUp(req, res, next) {
  try {
    const {
      username,
      email,
      password,
      role,
      clinicName,
      facilityType,
      address,
      contactNumber,
      operatingHours,
      fullName,
      phone,
      dateOfBirth,
    } = req.body;

    if (!username || !email || !password || !role) {
      return res.status(400).json({ message: "username, email, password and role are required" });
    }

    const normalizedUsername = normalizeUsername(username);
    const normalizedEmail = email.toLowerCase().trim();

    if (!["clinic", "patient"].includes(role)) {
      return res.status(400).json({ message: "role must be clinic or patient" });
    }

    if (password.length < 6) {
      return res.status(400).json({ message: "password must be at least 6 characters" });
    }

    if (role === "clinic" && (!clinicName || !address || !contactNumber || !operatingHours)) {
      return res.status(400).json({ message: "clinicName, address, contactNumber and operatingHours are required for clinic role" });
    }

    if (role === "clinic" && facilityType && !["clinic", "hospital"].includes(facilityType)) {
      return res.status(400).json({ message: "facilityType must be clinic or hospital" });
    }

    if (role === "patient" && (!fullName || !phone || !dateOfBirth)) {
      return res.status(400).json({ message: "fullName, phone and dateOfBirth are required for patient role" });
    }

    const existing = await User.findOne({
      $or: [{ username: normalizedUsername }, { email: normalizedEmail }],
    });

    if (existing) {
      return res.status(409).json({ message: "Username or email already exists" });
    }

    const passwordHash = await bcrypt.hash(password, 10);

    let clinicId = null;

    if (role === "clinic") {
      const geocoded = await geocodeClinicAddress(address);

      if (!geocoded) {
        return res.status(400).json({
          message: "Unable to verify clinic location from address. Please enter a more specific address.",
        });
      }

      const normalizedClinicName = clinicName.trim();
      const normalizedAddress = address.trim();
      const normalizedFacilityType = facilityType || "clinic";
      let clinic = await Clinic.findOne({ name: normalizedClinicName, address: normalizedAddress });

      if (!clinic) {
        clinic = await Clinic.create({
          name: normalizedClinicName,
          address: normalizedAddress,
          operatingHours,
          facilityType: normalizedFacilityType,
          location: {
            type: "Point",
            coordinates: [geocoded.lng, geocoded.lat],
          },
        });
      } else {
        clinic.address = normalizedAddress;
        clinic.operatingHours = operatingHours;
        clinic.facilityType = normalizedFacilityType;
        clinic.location = {
          type: "Point",
          coordinates: [geocoded.lng, geocoded.lat],
        };
        await clinic.save();
      }

      clinicId = clinic._id;
    }

    const user = await User.create({
      username: normalizedUsername,
      email: normalizedEmail,
      passwordHash,
      role,
      clinicId,
      clinicName,
      facilityType: role === "clinic" ? facilityType || "clinic" : undefined,
      address,
      contactNumber,
      operatingHours,
      fullName,
      phone,
      dateOfBirth,
    });

    // Backfill clinicId for legacy clinic users created before clinicId support.
    if (user.role === "clinic" && !user.clinicId && user.clinicName) {
      const clinic = await Clinic.findOne({ name: user.clinicName });
      if (clinic) {
        user.clinicId = clinic._id;
        await user.save();
      }
    }

    const token = signToken(user);

    return res.status(201).json({
      token,
      user: buildUserResponse(user),
    });
  } catch (error) {
    return next(error);
  }
}

export async function login(req, res, next) {
  try {
    const { username, password } = req.body;

    if (!username || !password) {
      return res.status(400).json({ message: "username and password are required" });
    }

    const normalizedIdentifier = normalizeUsername(username);

    const user = await User.findOne({
      $or: [{ username: normalizedIdentifier }, { email: normalizedIdentifier }],
    });

    if (!user) {
      return res.status(401).json({ message: "Invalid credentials" });
    }

    const passwordMatch = await bcrypt.compare(password, user.passwordHash);

    if (!passwordMatch) {
      return res.status(401).json({ message: "Invalid credentials" });
    }

    const token = signToken(user);

    return res.json({
      token,
      user: buildUserResponse(user),
    });
  } catch (error) {
    return next(error);
  }
}

export async function me(req, res, next) {
  try {
    const user = await User.findById(req.auth.sub);

    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    return res.json({ user: buildUserResponse(user) });
  } catch (error) {
    return next(error);
  }
}
