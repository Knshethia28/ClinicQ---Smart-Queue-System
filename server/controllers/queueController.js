import mongoose from "mongoose";
import { callNextPatient, completeCurrentPatient, getDoctorQueue, getDoctorQueueStats, reorderDoctorQueuePatient } from "../services/queueService.js";

export async function getQueueByDoctor(req, res, next) {
  try {
    const { doctorId } = req.params;

    if (!mongoose.Types.ObjectId.isValid(doctorId)) {
      return res.status(400).json({ message: "doctorId must be a valid ObjectId" });
    }

    const [queue, stats] = await Promise.all([
      getDoctorQueue(doctorId),
      getDoctorQueueStats(doctorId),
    ]);

    return res.json({ total: queue.length, queue, stats });
  } catch (error) {
    return next(error);
  }
}

export async function callNextInQueue(req, res, next) {
  try {
    const { doctorId } = req.params;

    if (!mongoose.Types.ObjectId.isValid(doctorId)) {
      return res.status(400).json({ message: "doctorId must be a valid ObjectId" });
    }

    const nextPatient = await callNextPatient(doctorId);

    if (!nextPatient) {
      return res.status(409).json({ message: "No queue-eligible patient available right now" });
    }

    const [queue, stats] = await Promise.all([
      getDoctorQueue(doctorId),
      getDoctorQueueStats(doctorId),
    ]);
    const io = req.app.get("io");

    io.to(`doctor:${doctorId}`).emit("patientCalled", nextPatient);
    io.to(`doctor:${doctorId}`).emit("queueUpdated", queue);

    return res.json({ calledPatient: nextPatient, queue, stats });
  } catch (error) {
    return next(error);
  }
}

export async function completeCurrentInQueue(req, res, next) {
  try {
    const { doctorId } = req.params;

    if (!mongoose.Types.ObjectId.isValid(doctorId)) {
      return res.status(400).json({ message: "doctorId must be a valid ObjectId" });
    }

    const completedPatient = await completeCurrentPatient(doctorId);

    if (!completedPatient) {
      return res.status(404).json({ message: "No active patient to complete" });
    }

    const [queue, stats] = await Promise.all([
      getDoctorQueue(doctorId),
      getDoctorQueueStats(doctorId),
    ]);
    const io = req.app.get("io");

    io.to(`doctor:${doctorId}`).emit("queueUpdated", queue);

    return res.json({ completedPatient, queue, stats });
  } catch (error) {
    return next(error);
  }
}

export async function reorderQueuePosition(req, res, next) {
  try {
    const { doctorId } = req.params;
    const { appointmentId, targetPosition } = req.body;

    if (!mongoose.Types.ObjectId.isValid(doctorId)) {
      return res.status(400).json({ message: "doctorId must be a valid ObjectId" });
    }

    if (!mongoose.Types.ObjectId.isValid(appointmentId)) {
      return res.status(400).json({ message: "appointmentId must be a valid ObjectId" });
    }

    const nextPosition = Number(targetPosition);
    if (!Number.isInteger(nextPosition) || nextPosition < 1) {
      return res.status(400).json({ message: "targetPosition must be an integer greater than 0" });
    }

    const queue = await reorderDoctorQueuePatient(doctorId, appointmentId, nextPosition);

    if (!queue) {
      return res.status(404).json({ message: "Appointment not found in doctor queue" });
    }

    if (queue === false) {
      return res.status(400).json({ message: "Cannot reorder the patient currently in consultation" });
    }

    const stats = await getDoctorQueueStats(doctorId);
    const io = req.app.get("io");
    io.to(`doctor:${doctorId}`).emit("queueUpdated", queue);

    return res.json({ queue, stats });
  } catch (error) {
    return next(error);
  }
}
