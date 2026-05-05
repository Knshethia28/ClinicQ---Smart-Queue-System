import Appointment from "../models/Appointment.js";

import { parseDateTime, getQueueTier, getSortTime, hasManualPosition, estimateEtaRangeForPosition, getDoctorConsultationMetrics } from '../utils/queueUtils.js';

export async function getDoctorQueue(doctorId, now = new Date(), options = {}) {
  const { useManualPosition = true } = options;
  const appointments = await Appointment.find({
    doctorId,
    status: { $in: ["booked", "active"] },
  })
    .populate("slotId")
    .sort({ createdAt: 1 });

  // Queue algorithm:
  // 1) emergency walk-ins
  // 2) active/eligible slot patients
  // 3) future slot patients
  const queue = appointments
    .map((appointment) => {
      const tier = getQueueTier(appointment, now);
      return {
        appointment,
        tier,
        sortTime: getSortTime(appointment),
      };
    })
    .sort((a, b) => {
      if (a.tier !== b.tier) {
        return a.tier - b.tier;
      }

      if (useManualPosition) {
        const aManual = hasManualPosition(a.appointment) ? a.appointment.manualQueuePosition : null;
        const bManual = hasManualPosition(b.appointment) ? b.appointment.manualQueuePosition : null;

        if (aManual !== null || bManual !== null) {
          if (aManual === null) {
            return 1;
          }

          if (bManual === null) {
            return -1;
          }

          if (aManual !== bManual) {
            return aManual - bManual;
          }
        }
      }

      if (a.sortTime !== b.sortTime) {
        return a.sortTime - b.sortTime;
      }

      return new Date(a.appointment.createdAt) - new Date(b.appointment.createdAt);
    })
    .map((item, index) => {
      const obj = item.appointment.toObject();
      // Token is derived from live queue order and never stored in the database.
      const tokenNumber = `T-${String(index + 1).padStart(3, "0")}`;
      return {
        ...obj,
        tokenNumber,
        queuePosition: index + 1,
        queueTier: item.tier,
      };
    });

  const consultationMetrics = await getDoctorConsultationMetrics(doctorId);

  return queue.map((item) => {
    const etaRange = estimateEtaRangeForPosition(item.queuePosition, consultationMetrics.averageConsultationMinutes);
    return {
      ...item,
      estimatedWaitMin: etaRange.etaMin,
      estimatedWaitMax: etaRange.etaMax,
    };
  });
}

export async function normalizeDoctorQueuePositions(doctorId) {
  const queue = await getDoctorQueue(doctorId);

  await Promise.all(
    queue.map((item, index) =>
      Appointment.findByIdAndUpdate(item._id, {
        $set: { manualQueuePosition: index + 1 },
      })
    )
  );

  return getDoctorQueue(doctorId);
}

export async function callNextPatient(doctorId) {
  const queue = await normalizeDoctorQueuePositions(doctorId);

  if (queue.length === 0) {
    return null;
  }

  const currentActive = queue.find((item) => item.status === "active");

  if (currentActive) {
    // A doctor-triggered "call next" action is explicit completion of the current consultation.
    await Appointment.findByIdAndUpdate(currentActive._id, {
      $set: {
        status: "completed",
        completedAt: new Date(),
      },
    });
  }

  const refreshedQueue = await normalizeDoctorQueuePositions(doctorId);
  const nextPatient = refreshedQueue.find(
    (item) => item.status === "booked" && Number(item.queueTier) !== 2
  );

  if (!nextPatient) {
    return null;
  }

  await Appointment.updateMany(
    { doctorId, status: "active", _id: { $ne: nextPatient._id } },
    { $set: { status: "completed" } }
  );

  await Appointment.findByIdAndUpdate(nextPatient._id, {
    $set: {
      status: "active",
      activatedAt: new Date(),
    },
  });

  await normalizeDoctorQueuePositions(doctorId);

  return Appointment.findById(nextPatient._id).populate("slotId");
}

export async function completeCurrentPatient(doctorId) {
  const currentPatient = await Appointment.findOne({
    doctorId,
    status: "active",
  })
    .sort({ createdAt: 1 })
    .populate("slotId");

  if (!currentPatient) {
    return null;
  }

  currentPatient.status = "completed";
  currentPatient.completedAt = new Date();
  await currentPatient.save();

  await normalizeDoctorQueuePositions(doctorId);

  return currentPatient;
}

export async function addWalkInPatient({
  patientName,
  phone,
  doctorId,
  isEmergency = false,
  doctorNameSnapshot = "Doctor",
  clinicNameSnapshot = "Clinic",
}) {
  await normalizeDoctorQueuePositions(doctorId);

  if (isEmergency) {
    await Appointment.updateMany(
      { doctorId, status: { $in: ["booked", "active"] } },
      { $inc: { manualQueuePosition: 1 } }
    );

    await Appointment.updateMany(
      { doctorId, status: "active" },
      { $set: { status: "booked" } }
    );

    const appointment = await Appointment.create({
      patientName,
      phone,
      doctorId,
      doctorNameSnapshot,
      clinicNameSnapshot,
      slotId: null,
      isEmergency: true,
      status: "active",
      manualQueuePosition: 1,
      activatedAt: new Date(),
    });

    return appointment;
  }

  const lastQueued = await Appointment.findOne({
    doctorId,
    status: { $in: ["booked", "active"] },
  }).sort({ manualQueuePosition: -1, createdAt: -1 });

  const nextPosition = (lastQueued?.manualQueuePosition || 0) + 1;

  const appointment = await Appointment.create({
    patientName,
    phone,
    doctorId,
    doctorNameSnapshot,
    clinicNameSnapshot,
    slotId: null,
    isEmergency: false,
    status: "booked",
    manualQueuePosition: nextPosition,
  });

  return appointment;
}

export async function reorderDoctorQueuePatient(doctorId, appointmentId, targetPosition) {
  const queue = await normalizeDoctorQueuePositions(doctorId);
  const fromIndex = queue.findIndex((item) => String(item._id) === String(appointmentId));

  if (fromIndex === -1) {
    return null;
  }

  const movingAppointment = queue[fromIndex];
  if (movingAppointment.status === "active") {
    return false;
  }

  const hasActive = queue.some((item) => item.status === "active");
  const minAllowedPosition = hasActive ? 2 : 1;

  const boundedTarget = Math.min(Math.max(minAllowedPosition, Number(targetPosition || minAllowedPosition)), queue.length);
  const toIndex = boundedTarget - 1;

  if (fromIndex !== toIndex) {
    const reordered = [...queue];
    const [moved] = reordered.splice(fromIndex, 1);
    reordered.splice(toIndex, 0, moved);

    await Promise.all(
      reordered.map((item, index) =>
        Appointment.findByIdAndUpdate(item._id, {
          $set: { manualQueuePosition: index + 1 },
        })
      )
    );
  }

  return getDoctorQueue(doctorId);
}

export async function getDoctorQueueStats(doctorId) {
  const startOfDay = new Date();
  startOfDay.setHours(0, 0, 0, 0);

  const endOfDay = new Date(startOfDay);
  endOfDay.setDate(endOfDay.getDate() + 1);

  const [waiting, active, completedToday, totalToday] = await Promise.all([
    Appointment.countDocuments({ doctorId, status: "booked" }),
    Appointment.countDocuments({ doctorId, status: "active" }),
    Appointment.countDocuments({
      doctorId,
      status: "completed",
      updatedAt: { $gte: startOfDay, $lt: endOfDay },
    }),
    Appointment.countDocuments({
      doctorId,
      createdAt: { $gte: startOfDay, $lt: endOfDay },
      status: { $ne: "cancelled" },
    }),
  ]);

  const consultationMetrics = await getDoctorConsultationMetrics(doctorId);

  return {
    waiting,
    active,
    completedToday,
    totalToday,
    averageConsultationMinutes: consultationMetrics.averageConsultationMinutes,
    minConsultationMinutes: consultationMetrics.minConsultationMinutes,
    maxConsultationMinutes: consultationMetrics.maxConsultationMinutes,
    consultationSampleSize: consultationMetrics.sampleSize,
  };
}
