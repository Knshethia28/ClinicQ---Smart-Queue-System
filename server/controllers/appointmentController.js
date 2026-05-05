import mongoose from "mongoose";
import Appointment from "../models/Appointment.js";
import Doctor from "../models/Doctor.js";
import Slot from "../models/Slot.js";
import { addWalkInPatient, getDoctorQueue } from "../services/queueService.js";

import { normalizePhone, normalizeTravelMinutes, getDoctorSnapshot, formatAppointmentForPatient } from '../utils/appointmentUtils.js';

export async function createAppointment(req, res, next) {
  try {
    const { patientName, phone, doctorId, slotId, estimatedTravelMinutes } = req.body;

    if (!patientName || !phone || !doctorId || !slotId) {
      return res.status(400).json({ message: "patientName, phone, doctorId, slotId are required" });
    }

    if (!mongoose.Types.ObjectId.isValid(doctorId) || !mongoose.Types.ObjectId.isValid(slotId)) {
      return res.status(400).json({ message: "doctorId and slotId must be valid ObjectId values" });
    }

    const slot = await Slot.findOne({ _id: slotId, doctorId });
    if (!slot) {
      return res.status(404).json({ message: "Slot not found for doctor" });
    }

    const doctorSnapshot = await getDoctorSnapshot(doctorId);
    if (!doctorSnapshot) {
      return res.status(404).json({ message: "Doctor not found" });
    }

    const updatedSlot = await Slot.findOneAndUpdate(
      { _id: slotId, bookedCount: { $lt: slot.capacity } },
      { $inc: { bookedCount: 1 } },
      { new: true }
    );

    if (!updatedSlot) {
      return res.status(409).json({ message: "Slot is full" });
    }

    const appointment = await Appointment.create({
      patientName,
      phone,
      doctorId,
      slotId,
      doctorNameSnapshot: doctorSnapshot.doctorNameSnapshot,
      clinicNameSnapshot: doctorSnapshot.clinicNameSnapshot,
      isEmergency: false,
      status: "booked",
      estimatedTravelMinutes: normalizeTravelMinutes(estimatedTravelMinutes),
    });

    const io = req.app.get("io");
    const queue = await getDoctorQueue(doctorId);
    const queueEntry = queue.find((item) => String(item._id) === String(appointment._id));

    io.to(`doctor:${doctorId}`).emit("appointmentBooked", appointment);
    io.to(`doctor:${doctorId}`).emit("queueUpdated", queue);

    return res.status(201).json({
      appointment,
      tokenNumber: queueEntry?.tokenNumber,
      queuePosition: queueEntry?.queuePosition,
    });
  } catch (error) {
    if (error instanceof mongoose.Error.ValidationError) {
      return res.status(400).json({ message: error.message });
    }
    return next(error);
  }
}

export async function getAppointmentQueueStatus(req, res, next) {
  try {
    const { appointmentId } = req.params;
    const phone = normalizePhone(req.query.phone || req.body?.phone);

    if (!mongoose.Types.ObjectId.isValid(appointmentId)) {
      return res.status(400).json({ message: "appointmentId must be a valid ObjectId" });
    }

    if (!phone) {
      return res.status(400).json({ message: "phone is required" });
    }

    const appointment = await Appointment.findOne({ _id: appointmentId, phone });
    if (!appointment) {
      return res.status(404).json({ message: "Appointment not found" });
    }

    if (appointment.status === "completed" || appointment.status === "cancelled") {
      return res.json({
        inQueue: false,
        status: appointment.status,
      });
    }

    const queue = await getDoctorQueue(appointment.doctorId);
    const queueEntry = queue.find((item) => String(item._id) === String(appointment._id));

    if (!queueEntry) {
      return res.json({
        inQueue: false,
        status: appointment.status,
      });
    }

    return res.json({
      inQueue: true,
      status: queueEntry.status,
      tokenNumber: queueEntry.tokenNumber,
      queuePosition: queueEntry.queuePosition,
      estimatedWaitMin: Number(queueEntry.estimatedWaitMin) || 0,
      estimatedWaitMax: Number(queueEntry.estimatedWaitMax) || 0,
      checkedInTime: queueEntry.createdAt,
    });
  } catch (error) {
    return next(error);
  }
}

export async function addWalkInAppointment(req, res, next) {
  try {
    const { patientName, phone, doctorId, isEmergency = false } = req.body;

    if (!patientName || !phone || !doctorId) {
      return res.status(400).json({ message: "patientName, phone and doctorId are required" });
    }

    if (!mongoose.Types.ObjectId.isValid(doctorId)) {
      return res.status(400).json({ message: "doctorId must be a valid ObjectId" });
    }

    const doctorSnapshot = await getDoctorSnapshot(doctorId);
    if (!doctorSnapshot) {
      return res.status(404).json({ message: "Doctor not found" });
    }

    const appointment = await addWalkInPatient({
      patientName,
      phone,
      doctorId,
      isEmergency: Boolean(isEmergency),
      doctorNameSnapshot: doctorSnapshot.doctorNameSnapshot,
      clinicNameSnapshot: doctorSnapshot.clinicNameSnapshot,
    });

    const io = req.app.get("io");
    const queue = await getDoctorQueue(doctorId);
    const queueEntry = queue.find((item) => String(item._id) === String(appointment._id));

    io.to(`doctor:${doctorId}`).emit("walkinAdded", appointment);
    io.to(`doctor:${doctorId}`).emit("queueUpdated", queue);

    return res.status(201).json({
      appointment,
      tokenNumber: queueEntry?.tokenNumber,
      queuePosition: queueEntry?.queuePosition,
    });
  } catch (error) {
    if (error instanceof mongoose.Error.ValidationError) {
      return res.status(400).json({ message: error.message });
    }
    return next(error);
  }
}

export async function getPatientAppointments(req, res, next) {
  try {
    const phone = normalizePhone(req.query.phone);

    if (!phone) {
      return res.status(400).json({ message: "phone query parameter is required" });
    }

    const appointments = await Appointment.find({ phone })
      .populate({
        path: "doctorId",
        select: "name clinicId",
        populate: {
          path: "clinicId",
          select: "name",
        },
      })
      .populate({
        path: "slotId",
        select: "date startTime endTime",
      })
      .sort({ createdAt: -1 });

    return res.json({
      appointments: appointments.map(formatAppointmentForPatient),
    });
  } catch (error) {
    return next(error);
  }
}

export async function cancelAppointment(req, res, next) {
  try {
    const { appointmentId } = req.params;
    const phone = normalizePhone(req.body.phone || req.query.phone);

    if (!mongoose.Types.ObjectId.isValid(appointmentId)) {
      return res.status(400).json({ message: "appointmentId must be a valid ObjectId" });
    }

    if (!phone) {
      return res.status(400).json({ message: "phone is required" });
    }

    const appointment = await Appointment.findOne({ _id: appointmentId, phone });
    if (!appointment) {
      return res.status(404).json({ message: "Appointment not found" });
    }

    if (appointment.status === "completed" || appointment.status === "cancelled") {
      return res.status(409).json({ message: `Appointment is already ${appointment.status}` });
    }

    appointment.status = "cancelled";
    await appointment.save();

    if (appointment.slotId) {
      await Slot.findByIdAndUpdate(appointment.slotId, {
        $inc: { bookedCount: -1 },
      });
      await Slot.updateOne(
        { _id: appointment.slotId, bookedCount: { $lt: 0 } },
        { $set: { bookedCount: 0 } }
      );
    }

    const queue = await getDoctorQueue(appointment.doctorId);
    const io = req.app.get("io");
    io.to(`doctor:${appointment.doctorId}`).emit("queueUpdated", queue);

    return res.json({
      message: "Appointment cancelled",
      appointment: formatAppointmentForPatient(appointment),
    });
  } catch (error) {
    return next(error);
  }
}

export async function checkInAppointment(req, res, next) {
  try {
    const { appointmentId } = req.params;
    const phone = normalizePhone(req.body.phone || req.query.phone);

    if (!mongoose.Types.ObjectId.isValid(appointmentId)) {
      return res.status(400).json({ message: "appointmentId must be a valid ObjectId" });
    }

    if (!phone) {
      return res.status(400).json({ message: "phone is required" });
    }

    const appointment = await Appointment.findOne({ _id: appointmentId, phone });
    if (!appointment) {
      return res.status(404).json({ message: "Appointment not found" });
    }

    if (appointment.status === "cancelled" || appointment.status === "completed") {
      return res.status(409).json({ message: `Cannot check in a ${appointment.status} appointment` });
    }

    const queue = await getDoctorQueue(appointment.doctorId);
    const queueEntry = queue.find((item) => String(item._id) === String(appointment._id));

    if (!queueEntry) {
      return res.status(409).json({ message: "Appointment is not in active queue" });
    }

    return res.json({
      message: "Check-in successful",
      queue: {
        tokenNumber: queueEntry.tokenNumber,
        queuePosition: queueEntry.queuePosition,
        status: queueEntry.status,
        estimatedWaitMin: Number(queueEntry.estimatedWaitMin) || 0,
        estimatedWaitMax: Number(queueEntry.estimatedWaitMax) || 0,
      },
    });
  } catch (error) {
    return next(error);
  }
}
