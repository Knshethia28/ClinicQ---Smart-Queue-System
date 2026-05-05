import Doctor from '../models/Doctor.js';

export function normalizePhone(value) {
  return String(value || "").trim();
}

export function normalizeTravelMinutes(value) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) {
    return 15;
  }

  return Math.max(0, Math.min(240, Math.round(parsed)));
}

export async function getDoctorSnapshot(doctorId) {
  const doctor = await Doctor.findById(doctorId)
    .select("name clinicId")
    .populate({
      path: "clinicId",
      select: "name",
    });

  if (!doctor) {
    return null;
  }

  return {
    doctorNameSnapshot: doctor.name || "Doctor",
    clinicNameSnapshot: doctor.clinicId?.name || "Clinic",
  };
}

export function formatAppointmentForPatient(appointment) {
  const doctor = appointment.doctorId || {};
  const clinic = doctor.clinicId || {};
  const slot = appointment.slotId || {};
  const doctorName = doctor.name || appointment.doctorNameSnapshot || "Doctor";
  const clinicName = clinic.name || appointment.clinicNameSnapshot || "Clinic";

  return {
    id: String(appointment._id),
    status: appointment.status,
    doctorId: doctor._id ? String(doctor._id) : "",
    doctorName,
    clinicId: clinic._id ? String(clinic._id) : "",
    clinicName,
    slotId: slot._id ? String(slot._id) : null,
    date: slot.date || null,
    time: slot.startTime && slot.endTime ? `${slot.startTime}-${slot.endTime}` : null,
    estimatedTravelMinutes: normalizeTravelMinutes(appointment.estimatedTravelMinutes),
    createdAt: appointment.createdAt,
  };
}

