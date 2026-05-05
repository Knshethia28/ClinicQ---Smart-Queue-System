import mongoose from "mongoose";

const appointmentSchema = new mongoose.Schema(
  {
    patientName: {
      type: String,
      required: true,
      trim: true,
    },
    phone: {
      type: String,
      required: true,
      trim: true,
    },
    doctorId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Doctor",
      required: true,
      index: true,
    },
    doctorNameSnapshot: {
      type: String,
      trim: true,
      default: "",
    },
    clinicNameSnapshot: {
      type: String,
      trim: true,
      default: "",
    },
    slotId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Slot",
      default: null,
      index: true,
    },
    isEmergency: {
      type: Boolean,
      default: false,
      index: true,
    },
    manualQueuePosition: {
      type: Number,
      default: null,
      min: 1,
      index: true,
    },
    status: {
      type: String,
      enum: ["booked", "active", "completed", "cancelled"],
      default: "booked",
      index: true,
    },
    estimatedTravelMinutes: {
      type: Number,
      min: 0,
      max: 240,
      default: 15,
    },
    activatedAt: {
      type: Date,
      default: null,
      index: true,
    },
    completedAt: {
      type: Date,
      default: null,
      index: true,
    },
    noShowCount: {
      type: Number,
      min: 0,
      default: 0,
    },
  },
  {
    timestamps: true,
  }
);

appointmentSchema.index({ phone: 1, createdAt: -1 });
appointmentSchema.index({ doctorId: 1, status: 1, createdAt: 1 });
appointmentSchema.index({ doctorId: 1, slotId: 1, status: 1 });

const Appointment = mongoose.model("Appointment", appointmentSchema);

export default Appointment;
