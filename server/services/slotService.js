import Slot from "../models/Slot.js";

function timeToMinutes(time) {
  const [hours, minutes] = time.split(":").map(Number);
  return hours * 60 + minutes;
}

function minutesToTime(value) {
  const hours = Math.floor(value / 60)
    .toString()
    .padStart(2, "0");
  const minutes = (value % 60).toString().padStart(2, "0");
  return `${hours}:${minutes}`;
}

export async function createSingleSlot({ doctorId, date, startTime, endTime, capacity }) {
  if (timeToMinutes(endTime) <= timeToMinutes(startTime)) {
    throw new Error("endTime must be after startTime");
  }

  const slot = await Slot.create({
    doctorId,
    date,
    startTime,
    endTime,
    capacity,
    bookedCount: 0,
  });

  return slot;
}

export async function createSlotsRange({
  doctorId,
  date,
  startTime,
  endTime,
  duration,
  capacity,
}) {
  const start = timeToMinutes(startTime);
  const end = timeToMinutes(endTime);

  if (end <= start) {
    throw new Error("endTime must be after startTime");
  }

  if (!duration || duration < 5) {
    throw new Error("duration must be at least 5 minutes");
  }

  const slots = [];
  let cursor = start;

  while (cursor + duration <= end) {
    slots.push({
      doctorId,
      date,
      startTime: minutesToTime(cursor),
      endTime: minutesToTime(cursor + duration),
      capacity,
      bookedCount: 0,
    });
    cursor += duration;
  }

  if (slots.length === 0) {
    throw new Error("No slots generated. Check time window and duration.");
  }

  const created = await Slot.insertMany(slots, { ordered: false });
  return created;
}
