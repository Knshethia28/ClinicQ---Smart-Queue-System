import mongoose from "mongoose";

const clinicSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      trim: true,
    },
    address: {
      type: String,
      required: true,
      trim: true,
    },
    location: {
      type: {
        type: String,
        enum: ["Point"],
        required: true,
        default: "Point",
      },
      coordinates: {
        type: [Number],
        required: true,
        validate: {
          validator: (value) => Array.isArray(value) && value.length === 2,
          message: "Location coordinates must be [lng, lat]",
        },
      },
    },
    operatingHours: {
      type: String,
      required: true,
      trim: true,
    },
    facilityType: {
      type: String,
      enum: ["clinic", "hospital"],
      default: "clinic",
      index: true,
    },
  },
  {
    timestamps: true,
  }
);

clinicSchema.index({ location: "2dsphere" });

const Clinic = mongoose.model("Clinic", clinicSchema);

export default Clinic;
