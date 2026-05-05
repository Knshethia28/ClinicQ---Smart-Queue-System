import Appointment from '../models/Appointment.js';

const DEFAULT_CONSULTATION_MINUTES = 10;

export function parseDateTime(date, time) {
  return new Date(`${date}T${time}:00`);
}

export function getQueueTier(appointment, now) {
  // Emergency walk-ins always stay at the very front of the queue.
  if (appointment.isEmergency) {
    return 0;
  }

  if (!appointment.slotId) {
    return 3;
  }

  const slot = appointment.slotId;
  const slotStart = parseDateTime(slot.date, slot.startTime);
  const slotEnd = parseDateTime(slot.date, slot.endTime);
  const activationAt = new Date(slotStart.getTime() - 10 * 60 * 1000);

  // Slot activation rule: patient becomes queue-eligible 10 minutes before slot start.
  if (now >= activationAt && now <= slotEnd) {
    return 1;
  }

  if (now < activationAt) {
    return 2;
  }

  return 1;
}

export function getSortTime(appointment) {
  if (!appointment.slotId) {
    return new Date(appointment.createdAt).getTime();
  }

  const slot = appointment.slotId;
  return parseDateTime(slot.date, slot.startTime).getTime();
}

export function hasManualPosition(appointment) {
  return typeof appointment.manualQueuePosition === "number" && Number.isFinite(appointment.manualQueuePosition);
}

export function estimateEtaRangeForPosition(queuePosition, consultationMinutes) {
  const waitingAhead = Math.max(0, Number(queuePosition || 1) - 1);
  const center = waitingAhead * consultationMinutes;
  const etaMin = Math.max(0, Math.round(center * 0.75));
  const etaMax = Math.max(etaMin, Math.round(center * 1.35) + 2);

  return { etaMin, etaMax };
}

export async function getDoctorConsultationMetrics(doctorId) {
  const recentCompleted = await Appointment.find({
    doctorId,
    status: "completed",
    activatedAt: { $ne: null },
    completedAt: { $ne: null },
  })
    .sort({ completedAt: -1 })
    .limit(25)
    .select("activatedAt completedAt");

  const durations = recentCompleted
    .map((appointment) => {
      const startedAt = new Date(appointment.activatedAt).getTime();
      const endedAt = new Date(appointment.completedAt).getTime();
      const minutes = (endedAt - startedAt) / (60 * 1000);
      return Number.isFinite(minutes) ? minutes : null;
    })
    .filter((minutes) => minutes !== null && minutes > 1 && minutes <= 180);

  if (!durations.length) {
    return {
      averageConsultationMinutes: DEFAULT_CONSULTATION_MINUTES,
      minConsultationMinutes: Math.max(5, Math.round(DEFAULT_CONSULTATION_MINUTES * 0.75)),
      maxConsultationMinutes: Math.round(DEFAULT_CONSULTATION_MINUTES * 1.35) + 2,
      sampleSize: 0,
    };
  }

  const averageConsultationMinutes = durations.reduce((sum, value) => sum + value, 0) / durations.length;
  const roundedAverage = Math.max(5, Math.round(averageConsultationMinutes));

  return {
    averageConsultationMinutes: roundedAverage,
    minConsultationMinutes: Math.max(4, Math.round(roundedAverage * 0.75)),
    maxConsultationMinutes: Math.max(Math.round(roundedAverage * 1.35) + 2, roundedAverage),
    sampleSize: durations.length,
  };
}

