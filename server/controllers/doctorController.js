import mongoose from "mongoose";
import Doctor from "../models/Doctor.js";
import Appointment from "../models/Appointment.js";
import Slot from "../models/Slot.js";

const DAY_NAMES = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const DAY_NORMALIZATION_MAP = {
  sun: "Sun",
  sunday: "Sun",
  mon: "Mon",
  monday: "Mon",
  tue: "Tue",
  tues: "Tue",
  tuesday: "Tue",
  wed: "Wed",
  wednesday: "Wed",
  thu: "Thu",
  thur: "Thu",
  thurs: "Thu",
  thursday: "Thu",
  fri: "Fri",
  friday: "Fri",
  sat: "Sat",
  saturday: "Sat",
};

function normalizeWorkingDays(inputDays) {
  if (!Array.isArray(inputDays)) {
    return [];
  }

  const normalized = inputDays
    .map((day) => DAY_NORMALIZATION_MAP[String(day || "").trim().toLowerCase()])
    .filter(Boolean);

  return Array.from(new Set(normalized));
}

function timeToMinutes(value) {
  const [hours, minutes] = String(value || "").split(":").map(Number);
  if (Number.isNaN(hours) || Number.isNaN(minutes)) {
    return null;
  }
  return hours * 60 + minutes;
}

function minutesToTime(value) {
  const hours = Math.floor(value / 60)
    .toString()
    .padStart(2, "0");
  const minutes = (value % 60).toString().padStart(2, "0");
  return `${hours}:${minutes}`;
}

function dateToYmd(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function validateAvailability({ availabilityStart, availabilityEnd, lunchStart, lunchEnd, slotDuration, workingDays }) {
  const openMinutes = timeToMinutes(availabilityStart);
  const closeMinutes = timeToMinutes(availabilityEnd);
  const lunchStartMinutes = lunchStart ? timeToMinutes(lunchStart) : null;
  const lunchEndMinutes = lunchEnd ? timeToMinutes(lunchEnd) : null;

  if (openMinutes === null || closeMinutes === null || closeMinutes <= openMinutes) {
    return "availabilityEnd must be after availabilityStart";
  }

  if (lunchStart && lunchEnd) {
    if (lunchStartMinutes === null || lunchEndMinutes === null || lunchEndMinutes <= lunchStartMinutes) {
      return "lunchEnd must be after lunchStart";
    }

    if (lunchStartMinutes < openMinutes || lunchEndMinutes > closeMinutes) {
      return "lunch break must be within availability window";
    }
  }

  if (!Number.isInteger(Number(slotDuration)) || Number(slotDuration) < 5) {
    return "slotDuration must be an integer of at least 5";
  }

  if (!Array.isArray(workingDays) || workingDays.length === 0) {
    return "workingDays must include at least one day";
  }

  if (workingDays.some((day) => !DAY_NAMES.includes(day))) {
    return "workingDays values must be one of Sun, Mon, Tue, Wed, Thu, Fri, Sat";
  }

  return null;
}

async function regenerateDoctorSlots(doctor, daysToGenerate = 14) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const fromDate = dateToYmd(today);

  await Slot.deleteMany({
    doctorId: doctor._id,
    date: { $gte: fromDate },
    bookedCount: 0,
  });

  const startMinutes = timeToMinutes(doctor.availabilityStart);
  const endMinutes = timeToMinutes(doctor.availabilityEnd);
  const lunchStartMinutes = doctor.lunchStart ? timeToMinutes(doctor.lunchStart) : null;
  const lunchEndMinutes = doctor.lunchEnd ? timeToMinutes(doctor.lunchEnd) : null;
  const duration = Number(doctor.slotDuration) || 10;
  const capacity = Number(doctor.slotCapacity) || 1;
  const slotsToCreate = [];

  for (let offset = 0; offset < daysToGenerate; offset += 1) {
    const date = new Date(today);
    date.setDate(today.getDate() + offset);
    const dayName = DAY_NAMES[date.getDay()];

    if (!doctor.workingDays.includes(dayName)) {
      continue;
    }

    const ymd = dateToYmd(date);
    let cursor = startMinutes;

    while (cursor + duration <= endMinutes) {
      const slotStart = cursor;
      const slotEnd = cursor + duration;

      const overlapsLunch =
        lunchStartMinutes !== null &&
        lunchEndMinutes !== null &&
        slotStart < lunchEndMinutes &&
        slotEnd > lunchStartMinutes;

      if (!overlapsLunch) {
        slotsToCreate.push({
          doctorId: doctor._id,
          date: ymd,
          startTime: minutesToTime(slotStart),
          endTime: minutesToTime(slotEnd),
          capacity,
          bookedCount: 0,
        });
      }

      cursor += duration;
    }
  }

  if (slotsToCreate.length === 0) {
    return 0;
  }

  const operations = slotsToCreate.map((slot) => ({
    updateOne: {
      filter: {
        doctorId: slot.doctorId,
        date: slot.date,
        startTime: slot.startTime,
      },
      // Never overwrite existing slots (especially booked slots); only create missing ones.
      update: { $setOnInsert: slot },
      upsert: true,
    },
  }));

  const result = await Slot.bulkWrite(operations, { ordered: false });
  return Number(result.upsertedCount) || 0;
}

export async function getDoctors(req, res, next) {
  try {
    const { clinicId } = req.query;

    if (!clinicId || !mongoose.Types.ObjectId.isValid(clinicId)) {
      return res.status(400).json({ message: "Valid clinicId query param is required" });
    }

    const doctors = await Doctor.find({ clinicId }).sort({ name: 1 });
    return res.json({ total: doctors.length, doctors });
  } catch (error) {
    return next(error);
  }
}

export async function createDoctor(req, res, next) {
  try {
    const {
      clinicId,
      name,
      specialization,
      slotDuration,
      availabilityStart = "09:00",
      availabilityEnd = "17:00",
      lunchStart = "13:00",
      lunchEnd = "14:00",
      workingDays = ["Mon", "Tue", "Wed", "Thu", "Fri"],
      slotCapacity = 1,
    } = req.body;

    if (!clinicId || !mongoose.Types.ObjectId.isValid(clinicId)) {
      return res.status(400).json({ message: "Valid clinicId is required" });
    }

    if (!name || !specialization) {
      return res.status(400).json({ message: "name and specialization are required" });
    }

    const normalizedWorkingDays = normalizeWorkingDays(workingDays);

    const availabilityError = validateAvailability({
      availabilityStart,
      availabilityEnd,
      lunchStart,
      lunchEnd,
      slotDuration,
      workingDays: normalizedWorkingDays,
    });

    if (availabilityError) {
      return res.status(400).json({ message: availabilityError });
    }

    const doctor = await Doctor.create({
      clinicId,
      name,
      specialization,
      slotDuration: slotDuration || 10,
      availabilityStart,
      availabilityEnd,
      lunchStart,
      lunchEnd,
      workingDays: normalizedWorkingDays,
      slotCapacity: Number(slotCapacity) || 1,
    });

    await regenerateDoctorSlots(doctor, 14);

    return res.status(201).json(doctor);
  } catch (error) {
    if (error instanceof mongoose.Error.ValidationError) {
      return res.status(400).json({ message: error.message });
    }
    return next(error);
  }
}

export async function updateDoctorAvailability(req, res, next) {
  try {
    const { doctorId } = req.params;
    const {
      availabilityStart,
      availabilityEnd,
      lunchStart,
      lunchEnd,
      workingDays,
      slotDuration,
      slotCapacity,
      daysToGenerate,
    } = req.body;

    if (!mongoose.Types.ObjectId.isValid(doctorId)) {
      return res.status(400).json({ message: "Valid doctorId is required" });
    }

    const doctor = await Doctor.findById(doctorId);
    if (!doctor) {
      return res.status(404).json({ message: "Doctor not found" });
    }

    const nextAvailability = {
      availabilityStart: availabilityStart || doctor.availabilityStart,
      availabilityEnd: availabilityEnd || doctor.availabilityEnd,
      lunchStart: typeof lunchStart === "string" ? lunchStart : doctor.lunchStart,
      lunchEnd: typeof lunchEnd === "string" ? lunchEnd : doctor.lunchEnd,
      slotDuration: Number(slotDuration) || doctor.slotDuration,
      workingDays: Array.isArray(workingDays) && workingDays.length > 0
        ? normalizeWorkingDays(workingDays)
        : normalizeWorkingDays(doctor.workingDays),
    };

    const availabilityError = validateAvailability(nextAvailability);
    if (availabilityError) {
      return res.status(400).json({ message: availabilityError });
    }

    doctor.availabilityStart = nextAvailability.availabilityStart;
    doctor.availabilityEnd = nextAvailability.availabilityEnd;
    doctor.lunchStart = nextAvailability.lunchStart;
    doctor.lunchEnd = nextAvailability.lunchEnd;
    doctor.slotDuration = nextAvailability.slotDuration;
    doctor.workingDays = nextAvailability.workingDays;
    doctor.slotCapacity = Number(slotCapacity) || doctor.slotCapacity;
    await doctor.save();

    const generatedCount = await regenerateDoctorSlots(
      doctor,
      Math.min(Math.max(Number(daysToGenerate) || 14, 1), 30)
    );

    return res.json({
      doctor,
      generatedSlots: generatedCount,
    });
  } catch (error) {
    if (error instanceof mongoose.Error.ValidationError) {
      return res.status(400).json({ message: error.message });
    }
    return next(error);
  }
}

export async function deleteDoctor(req, res, next) {
  try {
    const { doctorId } = req.params;

    if (!mongoose.Types.ObjectId.isValid(doctorId)) {
      return res.status(400).json({ message: "Valid doctorId is required" });
    }

    const doctor = await Doctor.findById(doctorId)
      .select("name clinicId")
      .populate({
        path: "clinicId",
        select: "name",
      });

    if (!doctor) {
      return res.status(404).json({ message: "Doctor not found" });
    }

    const activeAppointments = await Appointment.countDocuments({
      doctorId,
      status: { $in: ["booked", "active"] },
    });

    if (activeAppointments > 0) {
      return res.status(409).json({ message: "Cannot remove doctor with active queue appointments" });
    }

    await Appointment.updateMany(
      { doctorId },
      {
        $set: {
          doctorNameSnapshot: doctor.name || "Doctor",
          clinicNameSnapshot: doctor.clinicId?.name || "Clinic",
        },
      }
    );

    await Doctor.findByIdAndDelete(doctorId);

    return res.json({ message: "Doctor deleted" });
  } catch (error) {
    return next(error);
  }
}
