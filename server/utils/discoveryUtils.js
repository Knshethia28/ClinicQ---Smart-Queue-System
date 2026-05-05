export function normalizeAddress(value) {
  return value?.trim().toLowerCase().replace(/\s+/g, " ") || "";
}

export function toRadians(value) {
  return (value * Math.PI) / 180;
}

export function distanceKm(lat1, lng1, lat2, lng2) {
  if ([lat1, lng1, lat2, lng2].some((value) => typeof value !== "number" || Number.isNaN(value))) {
    return null;
  }

  const earthRadiusKm = 6371;
  const dLat = toRadians(lat2 - lat1);
  const dLng = toRadians(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRadians(lat1)) * Math.cos(toRadians(lat2)) * Math.sin(dLng / 2) * Math.sin(dLng / 2);

  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return earthRadiusKm * c;
}

export function normalizeCoordinatePair(latValue, lngValue) {
  const lat = Number(latValue);
  const lng = Number(lngValue);

  if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
    return null;
  }

  if (lat < -90 || lat > 90 || lng < -180 || lng > 180) {
    return null;
  }

  return { lat, lng };
}

export function normalizeLocation(location) {
  return normalizeCoordinatePair(location?.lat, location?.lng);
}

export function isFiniteDistanceKm(value) {
  return typeof value === "number" && Number.isFinite(value) && value >= 0;
}

export function isWithinRadiusKm(distance, radiusKm) {
  return isFiniteDistanceKm(distance) && distance <= radiusKm + 1e-6;
}

export function getBoundingBox(lat, lng, radiusMeters) {
  const latDelta = radiusMeters / 111320;
  const cosLat = Math.cos(toRadians(lat));
  const safeCosLat = Math.max(Math.abs(cosLat), 0.01);
  const lngDelta = radiusMeters / (111320 * safeCosLat);

  return {
    minLat: lat - latDelta,
    maxLat: lat + latDelta,
    minLng: lng - lngDelta,
    maxLng: lng + lngDelta,
  };
}

export function normalizeText(value) {
  return String(value || "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function hasHealthcareKeyword(text) {
  return /(clinic|hospital|doctor|medical|health|nursing|dental|diagnostic|care|dispensary|physio|therapy|maternity|pediatric|children|eye|ent|ortho|cardio)/i.test(
    text || ""
  );
}

export function inferFacilityType(name, typeHint, registeredOnClinicQ = false) {
  const probe = `${name || ""} ${typeHint || ""}`.toLowerCase();
  const hospitalLike = /(hospital|medical college|medical\s*center|medical\s*centre|health\s*center|health\s*centre|multi\s*special|super\s*special|specialty\s*center|speciality\s*centre|trauma|institute)/i.test(
    probe
  );
  const clinicLike = /(clinic|doctor|dispensary|nursing|polyclinic|health\s*center|diagnostic|care)/i.test(probe);

  if (hospitalLike && !clinicLike) {
    return "hospital";
  }

  if (clinicLike && !hospitalLike) {
    return "clinic";
  }

  if (hospitalLike && clinicLike) {
    return String(name || "").toLowerCase().includes("hospital") ? "hospital" : "clinic";
  }

  return registeredOnClinicQ ? "clinic" : "clinic";
}

export function getHospitalConfidence(item) {
  const probe = `${item?.name || ""} ${item?.typeHint || ""}`.toLowerCase();
  let score = 0;

  if (item?.facilityType === "hospital") {
    score += 6;
  } else if (item?.facilityType === "clinic") {
    score -= 3;
  }

  if (/\bhospital\b/i.test(probe)) {
    score += 8;
  }

  if (/(medical college|multi\s*special|super\s*special|trauma|nursing\s*home|speciality\s*hospital|specialty\s*hospital|institute)/i.test(probe)) {
    score += 4;
  }

  if (/(medical\s*center|medical\s*centre|health\s*center|health\s*centre)/i.test(probe)) {
    score += 2;
  }

  if (/\bclinic\b/i.test(probe) && !/\bhospital\b/i.test(probe)) {
    score -= 2;
  }

  return score;
}

export function toTitleCase(value) {
  return String(value || "")
    .split(/[_\s]+/)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1).toLowerCase())
    .join(" ");
}

export function isGenericExternalName(name) {
  const normalized = normalizeText(name);
  if (!normalized || normalized.length < 4) {
    return true;
  }

  const genericExact = new Set([
    "clinic", "hospital", "doctor", "doctors", "medical", "healthcare",
    "pharmacy", "chemist", "medical store", "dispensary",
    "diagnostic center", "diagnostic centre",
  ]);

  return genericExact.has(normalized);
}

export function formatExternalClinicName(name, typeHint) {
  const rawName = String(name || "").trim();
  const normalized = normalizeText(rawName);

  const typeLabel = typeHint ? toTitleCase(typeHint) : "Clinic";
  if (!rawName) return typeLabel;
  if (isGenericExternalName(rawName)) return typeLabel;

  if (!hasHealthcareKeyword(rawName) && typeHint && !normalized.includes(normalizeText(typeHint))) {
    return `${rawName} ${typeLabel}`;
  }

  return rawName;
}

export function getAddressParts(address) {
  return String(address || "")
    .split(",")
    .map((part) => part.trim())
    .filter(Boolean);
}

export function getAddressLocalityParts(address) {
  const parts = getAddressParts(address);
  if (parts.length === 0) return [];
  return parts.slice(1).map((part) => normalizeText(part));
}

export function removeConflictingLocationFromName(name, address) {
  const rawName = String(name || "").trim();
  if (!rawName) return rawName;

  const localityParts = getAddressLocalityParts(address);
  if (localityParts.length === 0) return rawName;

  const splitMatch = rawName.match(/^(.*?)(?:\s*[-,]\s*)([^-,]+)$/);
  if (!splitMatch) return rawName;

  const baseName = splitMatch[1].trim();
  const suffix = normalizeText(splitMatch[2]);
  if (!suffix || suffix.length < 3) return rawName;

  const suffixMatchesAddress = localityParts.some(
    (part) => part.includes(suffix) || suffix.includes(part)
  );

  if (suffixMatchesAddress) return rawName;
  return baseName || rawName;
}

export function toNameDedupeKey(name) {
  const tokens = normalizeText(name)
    .split(" ")
    .filter(Boolean)
    .filter((token) => !new Set(["dr", "doctor", "clinic", "hospital", "the", "and", "center", "centre"]).has(token));
  return tokens.join(" ");
}

export function isLikelySamePlace(a, b) {
  const aLat = a?.location?.lat;
  const aLng = a?.location?.lng;
  const bLat = b?.location?.lat;
  const bLng = b?.location?.lng;

  const geoDistance = distanceKm(aLat, aLng, bLat, bLng);
  if (typeof geoDistance !== "number" || geoDistance > 0.12) return false;

  const aNameKey = toNameDedupeKey(a.name);
  const bNameKey = toNameDedupeKey(b.name);
  if (!aNameKey || !bNameKey) return false;

  if (aNameKey === bNameKey) return true;
  if (aNameKey.includes(bNameKey) || bNameKey.includes(aNameKey)) return true;

  const aPhone = normalizeText(a.phone);
  const bPhone = normalizeText(b.phone);
  if (aPhone && bPhone && aPhone === bPhone) return true;

  return false;
}

export function choosePreferredClinicEntry(existing, candidate) {
  if (existing.registeredOnClinicQ && !candidate.registeredOnClinicQ) return existing;
  if (!existing.registeredOnClinicQ && candidate.registeredOnClinicQ) return candidate;

  const existingScore = getAddressParts(existing.address).length * 2 + (existing.phone ? 1 : 0) + (existing.operatingHours ? 1 : 0) + (existing.rating > 0 ? 1 : 0);
  const candidateScore = getAddressParts(candidate.address).length * 2 + (candidate.phone ? 1 : 0) + (candidate.operatingHours ? 1 : 0) + (candidate.rating > 0 ? 1 : 0);

  return candidateScore > existingScore ? candidate : existing;
}

export function dedupeNearbyClinics(clinics) {
  const deduped = [];
  for (const clinic of clinics) {
    const duplicateIndex = deduped.findIndex((existing) => isLikelySamePlace(existing, clinic));
    if (duplicateIndex === -1) {
      deduped.push(clinic);
      continue;
    }
    deduped[duplicateIndex] = choosePreferredClinicEntry(deduped[duplicateIndex], clinic);
  }
  return deduped;
}

export function ensureReadableAddress(address, fallbackLocality) {
  const raw = String(address || "").trim();
  const lowered = raw.toLowerCase();
  if (!raw || lowered === "unknown address" || lowered === "not available") return "Address unavailable";

  const parts = raw.split(",").map((part) => part.trim()).filter(Boolean);
  if (parts.length >= 2) return raw;
  return `${raw}, locality details unavailable`;
}

export function inferStatusFromSimpleHours(hoursText) {
  if (!hoursText || typeof hoursText !== "string") return "busy";

  const normalized = hoursText.trim().toLowerCase();
  if (normalized.includes("24/7") || normalized.includes("open 24")) return "open";

  const match = normalized.match(/(\d{1,2}):(\d{2})\s*-\s*(\d{1,2}):(\d{2})/);
  if (!match) return "busy";

  const [, sh, sm, eh, em] = match;
  const startMinutes = Number(sh) * 60 + Number(sm);
  const endMinutes = Number(eh) * 60 + Number(em);
  const now = new Date();
  const nowMinutes = now.getHours() * 60 + now.getMinutes();

  if (startMinutes <= endMinutes) {
    return nowMinutes >= startMinutes && nowMinutes <= endMinutes ? "open" : "closed";
  }
  return nowMinutes >= startMinutes || nowMinutes <= endMinutes ? "open" : "closed";
}
