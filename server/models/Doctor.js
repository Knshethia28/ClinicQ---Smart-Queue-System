import mongoose from "mongoose";

const doctorSchema = new mongoose.Schema(
  {
    clinicId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Clinic",
      required: true,
      index: true,
    },
    name: {
      type: String,
      required: true,
      trim: true,
    },
    specialization: {
      type: String,
      required: true,
      trim: true,
    },
    slotDuration: {
      type: Number,
      required: true,
      default: 10,
      min: 5,
    },
    availabilityStart: {
      type: String,
      required: true,
      default: "09:00",
      match: /^\d{2}:\d{2}$/,
    },
    availabilityEnd: {
      type: String,
      required: true,
      default: "17:00",
      match: /^\d{2}:\d{2}$/,
    },
    lunchStart: {
      type: String,
      default: "13:00",
      match: /^\d{2}:\d{2}$/,
    },
    lunchEnd: {
      type: String,
      default: "14:00",
      match: /^\d{2}:\d{2}$/,
    },
    workingDays: {
      type: [String],
      default: ["Mon", "Tue", "Wed", "Thu", "Fri"],
      validate: {
        validator: (value) =>
          Array.isArray(value) &&
          value.every((day) => ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].includes(day)),
        message: "workingDays must contain only Mon-Sun values",
      },
    },
    slotCapacity: {
      type: Number,
      required: true,
      default: 1,
      min: 1,
    },
  },
  {
    timestamps: true,
  }
);

const Doctor = mongoose.model("Doctor", doctorSchema);

export default Doctor;
