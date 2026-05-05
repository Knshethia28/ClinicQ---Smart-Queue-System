import mongoose from "mongoose";
import Clinic from "../models/Clinic.js";
import { fetchGooglePlaces, fetchOverpassPlaces, fetchNominatimPlaces, fetchGeoapifyPlaces } from "../services/discoveryService.js";
import { 
  normalizeLocation, distanceKm, isFiniteDistanceKm, 
  removeConflictingLocationFromName, formatExternalClinicName, 
  inferFacilityType, ensureReadableAddress, getHospitalConfidence, 
  isWithinRadiusKm, dedupeNearbyClinics, inferStatusFromSimpleHours 
} from "../utils/discoveryUtils.js";

function clinicToNearbyResponse(clinic) {
  const lat = clinic.location.coordinates[1];
  const lng = clinic.location.coordinates[0];

  return {
    id: String(clinic._id),
    name: clinic.name,
    address: clinic.address,
    location: { lat, lng },
    registeredOnClinicQ: true,
    phone: null,
    rating: null,
    operatingHours: clinic.operatingHours || null,
    status: inferStatusFromSimpleHours(clinic.operatingHours),
    facilityType: clinic.facilityType || inferFacilityType(clinic.name, "clinic", true),
    source: "clinicq",
  };
}

export async function getNearbyClinics(req, res, next) {
  try {
    const { lat, lng } = req.query;
    const requestedMode = String(req.query.mode || "clinics").toLowerCase();
    const discoveryMode = requestedMode === "hospitals" ? "hospitals" : "clinics";

    const latitude = Number(lat);
    const longitude = Number(lng);

    if (Number.isNaN(latitude) || Number.isNaN(longitude)) {
      return res.status(400).json({ message: "lat and lng query params are required" });
    }

    if (latitude < -90 || latitude > 90 || longitude < -180 || longitude > 180) {
      return res.status(400).json({ message: "lat/lng out of range" });
    }

    const radiusInMeters = 15000;
    const fetchRadiusInMeters = radiusInMeters;

    const registeredClinics = await Clinic.find({
      location: {
        $near: {
          $geometry: { type: "Point", coordinates: [longitude, latitude] },
          $maxDistance: fetchRadiusInMeters,
        },
      },
    });

    let externalPlaces = [];
    const providerNames = new Set();
    const providerStatuses = [];
    
    const rawGoogleApiKey = process.env.GOOGLE_PLACES_API_KEY?.trim();
    const rawGeoapifyApiKey = process.env.GEOAPIFY_API_KEY?.trim();

    const looksLikeGoogleKey = (value) => /^AIza[0-9A-Za-z_-]{35}$/.test(value || "");
    const looksLikeGeoapifyKey = (value) => /^[a-f0-9]{32}$/i.test(value || "");

    const hasGooglePlaceholder = rawGoogleApiKey && (rawGoogleApiKey.includes("<") || rawGoogleApiKey.toLowerCase().includes("your_google_places_api_key"));
    const hasGeoapifyPlaceholder = rawGeoapifyApiKey && (rawGeoapifyApiKey.includes("<") || rawGeoapifyApiKey.toLowerCase().includes("your_geoapify_api_key"));

    const googleApiKey = !hasGooglePlaceholder && looksLikeGoogleKey(rawGoogleApiKey) ? rawGoogleApiKey : null;
    const geoapifyApiKey = !hasGeoapifyPlaceholder && rawGeoapifyApiKey
        ? rawGeoapifyApiKey
        : !hasGooglePlaceholder && looksLikeGeoapifyKey(rawGoogleApiKey)
        ? rawGoogleApiKey
        : null;

    const hasValidGoogleApiKey = Boolean(googleApiKey);
    const hasGeoapifyKey = Boolean(geoapifyApiKey);

    if (hasValidGoogleApiKey) {
      providerNames.add("google");
      externalPlaces = await fetchGooglePlaces(latitude, longitude, fetchRadiusInMeters, googleApiKey, providerStatuses);
    } else {
      providerNames.add("osm");
      externalPlaces = await fetchOverpassPlaces(latitude, longitude, fetchRadiusInMeters, providerStatuses);
      
      const nominatimPlaces = await fetchNominatimPlaces(latitude, longitude, fetchRadiusInMeters, providerStatuses);
      providerNames.add("nominatim");
      
      const mergedExternalById = new Map();
      externalPlaces.forEach(p => mergedExternalById.set(p.id || `external:${p.name}`, p));
      nominatimPlaces.forEach(p => mergedExternalById.set(p.id, p));

      if (hasGeoapifyKey) {
        const geoPlaces = await fetchGeoapifyPlaces(latitude, longitude, fetchRadiusInMeters, geoapifyApiKey, providerStatuses);
        providerNames.add("geoapify");
        geoPlaces.forEach(p => mergedExternalById.set(p.id, p));
      } else {
        providerStatuses.push("geoapify:DISABLED");
      }

      externalPlaces = [...mergedExternalById.values()];
    }

    const mergedMap = new Map();

    for (const clinic of registeredClinics) {
      const item = clinicToNearbyResponse(clinic);
      mergedMap.set(`clinicq:${item.id}`, item);
    }

    for (const place of externalPlaces) {
      const externalKey = `${place.source || "external"}:${place.id}`;
      if (!mergedMap.has(externalKey)) {
        mergedMap.set(externalKey, place);
      }
    }

    const radiusKm = radiusInMeters / 1000;

    const allCandidates = [...mergedMap.values()]
      .map((item) => {
        const normalizedItemLocation = normalizeLocation(item.location);
        const calculatedDistanceKm = normalizedItemLocation
          ? distanceKm(latitude, longitude, normalizedItemLocation.lat, normalizedItemLocation.lng)
          : null;
        const resolvedAddress = ensureReadableAddress(item.address);
        const displayName = item.registeredOnClinicQ
          ? removeConflictingLocationFromName(item.name, resolvedAddress)
          : removeConflictingLocationFromName(formatExternalClinicName(item.name, item.typeHint), resolvedAddress);

        return {
          ...item,
          name: displayName,
          address: resolvedAddress,
          location: normalizedItemLocation,
          facilityType: item.facilityType || inferFacilityType(displayName, item.typeHint, item.registeredOnClinicQ),
          distanceKm: isFiniteDistanceKm(calculatedDistanceKm) ? Number(calculatedDistanceKm.toFixed(6)) : null,
        };
      })
      .filter((item) => isFiniteDistanceKm(item.distanceKm) && item.location)
      .sort((a, b) => (typeof a.distanceKm === "number" ? a.distanceKm : Infinity) - (typeof b.distanceKm === "number" ? b.distanceKm : Infinity));

    const hospitalCandidates = allCandidates.filter((item) => getHospitalConfidence(item) >= 1);
    const strictClinicCandidates = allCandidates.filter((item) => getHospitalConfidence(item) < 1);

    const modeCandidates = discoveryMode === "hospitals" ? hospitalCandidates : strictClinicCandidates;

    const clinics = dedupeNearbyClinics(modeCandidates.filter((item) => isWithinRadiusKm(item.distanceKm, radiusKm)));

    return res.json({
      total: clinics.length,
      clinics,
      meta: {
        googlePlacesEnabled: hasValidGoogleApiKey,
        googlePlacesCount: hasValidGoogleApiKey ? externalPlaces.length : 0,
        externalProvider: [...providerNames].join("+"),
        externalProviderCount: externalPlaces.length,
        externalApiStatus: providerStatuses.join(";"),
        registeredClinicCount: registeredClinics.length,
        hospitalCandidateCount: hospitalCandidates.length,
        strictClinicCount: strictClinicCandidates.length,
        discoveryMode,
        radiusInMeters,
        fetchRadiusInMeters,
      },
    });
  } catch (error) {
    return next(error);
  }
}

export async function createClinic(req, res, next) {
  try {
    const { name, address, operatingHours, location } = req.body;

    if (!name || !address || !operatingHours || !location) {
      return res.status(400).json({ message: "name, address, operatingHours, location are required" });
    }

    const { lat, lng } = location;
    if (Number.isNaN(Number(lat)) || Number.isNaN(Number(lng))) {
      return res.status(400).json({ message: "location.lat and location.lng must be valid numbers" });
    }

    const clinic = await Clinic.create({
      name,
      address,
      operatingHours,
      location: {
        type: "Point",
        coordinates: [Number(lng), Number(lat)],
      },
    });

    return res.status(201).json(clinic);
  } catch (error) {
    if (error instanceof mongoose.Error.ValidationError) {
      return res.status(400).json({ message: error.message });
    }
    return next(error);
  }
}
