import "dotenv/config";
import mongoose from "mongoose";
import bcrypt from "bcryptjs";

import { connectDB } from "../config/db.js";
import Clinic from "../models/Clinic.js";
import Doctor from "../models/Doctor.js";
import Slot from "../models/Slot.js";
import Appointment from "../models/Appointment.js";
import User from "../models/User.js";

function getDateString(offsetDays = 0) {
  const date = new Date();
  date.setDate(date.getDate() + offsetDays);
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

const DEMO_CLINIC_QUERY = {
  name: "ClinicQ Downtown Care",
  address: "221B Health Street, Central City",
};

const DEMO_DOCTORS = [
  {
    name: "Dr. Ava Thompson",
    specialization: "General Medicine",
    slotDuration: 10,
  },
  {
    name: "Dr. Liam Carter",
    specialization: "Pediatrics",
    slotDuration: 10,
  },
];

const DEMO_APPOINTMENT_PHONES = [
  "+10000000001",
  "+10000000002",
  "+10000000003",
  "+10000000004",
];

async function seed() {
  await connectDB();

  const shouldResetAll = String(process.env.SEED_RESET_ALL || "false").toLowerCase() === "true";

  if (shouldResetAll) {
    await Promise.all([
      Appointment.deleteMany({}),
      Slot.deleteMany({}),
      Doctor.deleteMany({}),
      Clinic.deleteMany({}),
      User.deleteMany({}),
    ]);
  } else {
    console.log("SEED_RESET_ALL is false, preserving non-demo users/clinics/doctors/appointments");
  }

  const [clinicPasswordHash, patientPasswordHash] = await Promise.all([
    bcrypt.hash("clinic123", 10),
    bcrypt.hash("patient123", 10),
  ]);

  const clinic = await Clinic.findOneAndUpdate(
    DEMO_CLINIC_QUERY,
    {
      ...DEMO_CLINIC_QUERY,
      operatingHours: "09:00-18:00",
      facilityType: "clinic",
      location: {
        type: "Point",
        coordinates: [77.5946, 12.9716],
      },
    },
    { upsert: true, new: true, setDefaultsOnInsert: true }
  );

  const [doctorA, doctorB] = await Promise.all(
    DEMO_DOCTORS.map((doctor) =>
      Doctor.findOneAndUpdate(
        { clinicId: clinic._id, name: doctor.name },
        {
          clinicId: clinic._id,
          name: doctor.name,
          specialization: doctor.specialization,
          slotDuration: doctor.slotDuration,
        },
        { upsert: true, new: true, setDefaultsOnInsert: true }
      )
    )
  );

  // Keep seed non-destructive by default: do not remove any doctors unless full reset is explicitly enabled.

  await Promise.all([
    User.findOneAndUpdate(
      { username: "clinic" },
      {
        username: "clinic",
        email: "admin@clinicq.com",
        passwordHash: clinicPasswordHash,
        role: "clinic",
        clinicId: clinic._id,
        clinicName: "ClinicQ Downtown Care",
        address: "221B Health Street, Central City",
        contactNumber: "+10000000111",
        operatingHours: "09:00-18:00",
      },
      { upsert: true, new: true, setDefaultsOnInsert: true }
    ),
    User.findOneAndUpdate(
      { username: "patient1" },
      {
        username: "patient1",
        email: "patient1@clinicq.com",
        passwordHash: patientPasswordHash,
        role: "patient",
        fullName: "John Smith",
        phone: "+10000000999",
        dateOfBirth: "1991-05-12",
      },
      { upsert: true, new: true, setDefaultsOnInsert: true }
    ),
  ]);

  const date = getDateString(0);

  const slotSeeds = [
    {
      key: "doctorA-10:00",
      doctorId: doctorA._id,
      date,
      startTime: "10:00",
      endTime: "10:10",
      capacity: 2,
      bookedCount: 1,
    },
    {
      key: "doctorA-10:10",
      doctorId: doctorA._id,
      date,
      startTime: "10:10",
      endTime: "10:20",
      capacity: 2,
      bookedCount: 1,
    },
    {
      key: "doctorB-11:00",
      doctorId: doctorB._id,
      date,
      startTime: "11:00",
      endTime: "11:10",
      capacity: 1,
      bookedCount: 1,
    },
  ];

  const slotPairs = await Promise.all(
    slotSeeds.map(async (slotSeed) => {
      const slot = await Slot.findOneAndUpdate(
        {
          doctorId: slotSeed.doctorId,
          date: slotSeed.date,
          startTime: slotSeed.startTime,
        },
        {
          doctorId: slotSeed.doctorId,
          date: slotSeed.date,
          startTime: slotSeed.startTime,
          endTime: slotSeed.endTime,
          capacity: slotSeed.capacity,
          bookedCount: slotSeed.bookedCount,
        },
        { upsert: true, new: true, setDefaultsOnInsert: true }
      );

      return [slotSeed.key, slot];
    })
  );

  const slotByKey = new Map(slotPairs);

  await Appointment.deleteMany({ phone: { $in: DEMO_APPOINTMENT_PHONES } });

  await Appointment.insertMany([
    {
      patientName: "Olivia Green",
      phone: "+10000000001",
      doctorId: doctorA._id,
      slotId: slotByKey.get("doctorA-10:00")?._id || null,
      isEmergency: false,
      status: "booked",
    },
    {
      patientName: "Noah Reed",
      phone: "+10000000002",
      doctorId: doctorA._id,
      slotId: slotByKey.get("doctorA-10:10")?._id || null,
      isEmergency: false,
      status: "booked",
    },
    {
      patientName: "Emma Lane",
      phone: "+10000000003",
      doctorId: doctorA._id,
      slotId: null,
      isEmergency: true,
      status: "booked",
    },
    {
      patientName: "Mason Hall",
      phone: "+10000000004",
      doctorId: doctorB._id,
      slotId: slotByKey.get("doctorB-11:00")?._id || null,
      isEmergency: false,
      status: "booked",
    },
  ]);

  console.log("Seed completed successfully");
  await mongoose.connection.close();
}

seed().catch(async (error) => {
  console.error("Seed failed:", error);
  await mongoose.connection.close();
  process.exit(1);
});
