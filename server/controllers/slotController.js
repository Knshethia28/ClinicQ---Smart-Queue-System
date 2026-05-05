import mongoose from "mongoose";
import Doctor from "../models/Doctor.js";
import Slot from "../models/Slot.js";
import { createSingleSlot, createSlotsRange } from "../services/slotService.js";

export async function getSlots(req, res, next) {
  try {
    const { doctorId, date } = req.query;

    if (!doctorId || !mongoose.Types.ObjectId.isValid(doctorId)) {
      return res.status(400).json({ message: "Valid doctorId query param is required" });
    }

    if (!date) {
      return res.status(400).json({ message: "date query param is required in YYYY-MM-DD format" });
    }

    const doctorExists = await Doctor.exists({ _id: doctorId });
    if (!doctorExists) {
      return res.status(404).json({ message: "Doctor not found" });
    }

    const slots = await Slot.find({ doctorId, date }).sort({ startTime: 1 });
    
    // Filter out past slots if the requested date is today
    const today = new Date().toISOString().split('T')[0];
    if (date === today) {
      const now = new Date();
      const currentHhMm = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
      
      const filteredSlots = slots.filter(slot => slot.startTime > currentHhMm);
      return res.json({ total: filteredSlots.length, slots: filteredSlots });
    }

    return res.json({ total: slots.length, slots });
  } catch (error) {
    return next(error);
  }
}

export async function createSlot(req, res, next) {
  try {
    const { doctorId, date, startTime, endTime, capacity, duration, generateRange } = req.body;

    if (!doctorId || !mongoose.Types.ObjectId.isValid(doctorId) || !date) {
      return res.status(400).json({ message: "doctorId and date are required" });
    }

    const doctorExists = await Doctor.exists({ _id: doctorId });
    if (!doctorExists) {
      return res.status(404).json({ message: "Doctor not found" });
    }

    if (generateRange) {
      if (!startTime || !endTime || !duration) {
        return res.status(400).json({ message: "startTime, endTime and duration are required for range generation" });
      }

      const createdSlots = await createSlotsRange({
        doctorId,
        date,
        startTime,
        endTime,
        duration: Number(duration),
        capacity: Number(capacity) || 1,
      });

      return res.status(201).json({ total: createdSlots.length, slots: createdSlots });
    }

    if (!startTime || !endTime) {
      return res.status(400).json({ message: "startTime and endTime are required" });
    }

    const slot = await createSingleSlot({
      doctorId,
      date,
      startTime,
      endTime,
      capacity: Number(capacity) || 1,
    });

    return res.status(201).json(slot);
  } catch (error) {
    if (error.code === 11000) {
      return res.status(409).json({ message: "Slot already exists for this doctor/date/startTime" });
    }

    if (error instanceof mongoose.Error.ValidationError || error.message) {
      return res.status(400).json({ message: error.message });
    }

    return next(error);
  }
}
