import { getBoundingBox, toTitleCase, normalizeText, inferFacilityType, hasHealthcareKeyword, inferStatusFromSimpleHours, normalizeLocation, formatExternalClinicName, removeConflictingLocationFromName } from "../utils/discoveryUtils.js";

function placeToNearbyResponse(place) {
  const isOpen = place.opening_hours?.open_now;
  const placeTypes = Array.isArray(place.types) ? place.types : [];
  const typeHint = placeTypes.includes("hospital") ? "hospital" : "clinic";

  return {
    id: `google:${place.place_id || place.name}`,
    name: place.name,
    address: place.vicinity || place.formatted_address || "Unknown address",
    location: {
      lat: place.geometry?.location?.lat,
      lng: place.geometry?.location?.lng,
    },
    registeredOnClinicQ: false,
    phone: place.formatted_phone_number || place.international_phone_number || null,
    rating: typeof place.rating === "number" ? place.rating : null,
    operatingHours: place.opening_hours?.weekday_text?.join(" | ") || null,
    status: typeof isOpen === "boolean" ? (isOpen ? "open" : "closed") : "busy",
    typeHint,
    facilityType: inferFacilityType(place.name, typeHint, false),
    source: "google",
  };
}

function mergeGooglePlaceWithDetails(place, details) {
  const result = details?.result || {};

  return {
    ...place,
    formatted_phone_number: result.formatted_phone_number || place.formatted_phone_number,
    international_phone_number: result.international_phone_number || place.international_phone_number,
    opening_hours: result.opening_hours || place.opening_hours,
    rating: typeof result.rating === "number" ? result.rating : place.rating,
  };
}

export async function fetchGooglePlaces(latitude, longitude, fetchRadiusInMeters, googleApiKey, providerStatuses) {
  const fetchPlaces = async (endpoint, params) => {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 5000);

    try {
      const url = new URL(`https://maps.googleapis.com/maps/api/place/${endpoint}/json`);
      Object.entries(params).forEach(([key, value]) => {
        if (value !== undefined && value !== null && value !== "") {
          url.searchParams.set(key, String(value));
        }
      });
      url.searchParams.set("key", googleApiKey);

      const response = await fetch(url, { signal: controller.signal });
      if (!response.ok) {
        return { status: `http_${response.status}`, results: [] };
      }

      const data = await response.json();
      return {
        status: data.status || "UNKNOWN",
        results: Array.isArray(data.results) ? data.results : [],
      };
    } catch {
      return { status: "REQUEST_FAILED", results: [] };
    } finally {
      clearTimeout(timeout);
    }
  };

  const [clinicKeywordSearch, hospitalTypeSearch, textSearch] = await Promise.all([
    fetchPlaces("nearbysearch", { location: `${latitude},${longitude}`, radius: fetchRadiusInMeters, keyword: "clinic" }),
    fetchPlaces("nearbysearch", { location: `${latitude},${longitude}`, radius: fetchRadiusInMeters, type: "hospital" }),
    fetchPlaces("textsearch", { location: `${latitude},${longitude}`, radius: fetchRadiusInMeters, query: "clinic hospital medical center" }),
  ]);

  const googlePlaceById = new Map();
  for (const result of [clinicKeywordSearch, hospitalTypeSearch, textSearch]) {
    for (const place of result.results) {
      const key = place.place_id || `${place.name}|${place.vicinity || place.formatted_address || ""}`;
      if (!googlePlaceById.has(key)) {
        googlePlaceById.set(key, place);
      }
    }
  }

  const fetchPlaceDetails = async (placeId) => {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 5000);

    try {
      const url = new URL("https://maps.googleapis.com/maps/api/place/details/json");
      url.searchParams.set("place_id", placeId);
      url.searchParams.set("fields", "place_id,formatted_phone_number,international_phone_number,opening_hours,rating");
      url.searchParams.set("key", googleApiKey);

      const response = await fetch(url, { signal: controller.signal });
      if (!response.ok) return null;

      const data = await response.json();
      if (data.status !== "OK") return null;

      return data;
    } catch {
      return null;
    } finally {
      clearTimeout(timeout);
    }
  };

  const placesNeedingDetails = [...googlePlaceById.values()].filter((place) => place.place_id);
  const detailLimit = Math.min(placesNeedingDetails.length, 25);
  const detailsTargets = placesNeedingDetails.slice(0, detailLimit);

  const detailsResponses = await Promise.all(
    detailsTargets.map(async (place) => {
      const details = await fetchPlaceDetails(place.place_id);
      return { placeId: place.place_id, details };
    })
  );

  const detailsByPlaceId = new Map();
  for (const item of detailsResponses) {
    if (item.details) {
      detailsByPlaceId.set(item.placeId, item.details);
    }
  }

  const enrichedGooglePlaceById = new Map();
  for (const [key, place] of googlePlaceById.entries()) {
    const details = place.place_id ? detailsByPlaceId.get(place.place_id) : null;
    enrichedGooglePlaceById.set(key, details ? mergeGooglePlaceWithDetails(place, details) : place);
  }

  const externalPlaces = [...enrichedGooglePlaceById.values()];
  providerStatuses.push(
    `google:${[clinicKeywordSearch.status, hospitalTypeSearch.status, textSearch.status]
      .filter(Boolean)
      .join(",")}:${externalPlaces.length}`
  );
  
  return externalPlaces.map(place => placeToNearbyResponse(place)).filter(Boolean);
}

function osmElementToNearbyResponse(element) {
  const lat = element.lat ?? element.center?.lat;
  const lng = element.lon ?? element.center?.lon;

  if (typeof lat !== "number" || typeof lng !== "number") {
    return null;
  }

  const tags = element.tags || {};
  const amenityType = String(tags.amenity || "").toLowerCase();
  const healthcareType = String(tags.healthcare || "").toLowerCase();
  const officeType = String(tags.office || "").toLowerCase();

  const typeHintRaw = healthcareType || amenityType || officeType || "clinic";
  let typeHint = "clinic";
  if (typeHintRaw.includes("hospital")) {
    typeHint = "hospital";
  } else if (typeHintRaw.includes("dent")) {
    typeHint = "dental clinic";
  } else if (typeHintRaw.includes("doctor") || typeHintRaw.includes("physician")) {
    typeHint = "doctor clinic";
  } else if (typeHintRaw.includes("diagnostic") || typeHintRaw.includes("laboratory")) {
    typeHint = "diagnostic center";
  }

  const derivedName = tags.name || tags["name:en"] || tags.brand || tags.operator;

  if (amenityType === "pharmacy" || healthcareType === "pharmacy") return null;

  const addressParts = [
    tags["addr:housenumber"], tags["addr:street"], tags["addr:neighbourhood"],
    tags["addr:suburb"], tags["addr:city_district"], tags["addr:city"],
    tags["is_in:city"], tags["addr:state"], tags["addr:country"],
  ].filter(Boolean);

  return {
    id: `osm:${element.type}:${element.id}`,
    name: derivedName || toTitleCase(typeHint),
    address: addressParts.join(", ") || tags["addr:full"] || "Unknown address",
    location: { lat, lng },
    registeredOnClinicQ: false,
    phone: tags.phone || tags["contact:phone"] || null,
    rating: null,
    operatingHours: tags.opening_hours || null,
    status: inferStatusFromSimpleHours(tags.opening_hours),
    typeHint,
    facilityType: inferFacilityType(derivedName || toTitleCase(typeHint), typeHint, false),
    source: "osm",
  };
}

export async function fetchOverpassPlaces(latitude, longitude, fetchRadiusInMeters, providerStatuses) {
  const buildOverpassQuery = (queryLat, queryLng, queryRadiusMeters) => `
  [out:json][timeout:25];
  (
    node["amenity"~"clinic|hospital|doctors|dentist|pharmacy"](around:${queryRadiusMeters},${queryLat},${queryLng});
    way["amenity"~"clinic|hospital|doctors|dentist|pharmacy"](around:${queryRadiusMeters},${queryLat},${queryLng});
    relation["amenity"~"clinic|hospital|doctors|dentist|pharmacy"](around:${queryRadiusMeters},${queryLat},${queryLng});
    node["healthcare"~"clinic|hospital|doctor|centre|yes|pharmacy|physiotherapist|laboratory|diagnostic"](around:${queryRadiusMeters},${queryLat},${queryLng});
    way["healthcare"~"clinic|hospital|doctor|centre|yes|pharmacy|physiotherapist|laboratory|diagnostic"](around:${queryRadiusMeters},${queryLat},${queryLng});
    relation["healthcare"~"clinic|hospital|doctor|centre|yes|pharmacy|physiotherapist|laboratory|diagnostic"](around:${queryRadiusMeters},${queryLat},${queryLng});
    node["office"~"physician|dentist"](around:${queryRadiusMeters},${queryLat},${queryLng});
    way["office"~"physician|dentist"](around:${queryRadiusMeters},${queryLat},${queryLng});
    relation["office"~"physician|dentist"](around:${queryRadiusMeters},${queryLat},${queryLng});
  );
  out center;
  `.trim();

  const overpassEndpoints = [
    "https://overpass-api.de/api/interpreter",
    "https://overpass.kumi.systems/api/interpreter",
  ];

  let overpassSuccess = false;
  const bounds = getBoundingBox(latitude, longitude, fetchRadiusInMeters);

  const edgeSamplePoints = [
    { lat: bounds.maxLat, lng: longitude },
    { lat: bounds.minLat, lng: longitude },
    { lat: latitude, lng: bounds.maxLng },
    { lat: latitude, lng: bounds.minLng },
  ];

  let externalPlaces = [];

  for (const endpoint of overpassEndpoints) {
    try {
      const placeById = new Map();

      {
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 20000);

        try {
          const overpassQuery = buildOverpassQuery(latitude, longitude, fetchRadiusInMeters);
          const response = await fetch(endpoint, {
            method: "POST",
            headers: {
              "Content-Type": "application/x-www-form-urlencoded;charset=UTF-8",
              Accept: "application/json",
              "User-Agent": "ClinicQ/1.0",
            },
            body: `data=${encodeURIComponent(overpassQuery)}`,
            signal: controller.signal,
          });

          if (response.ok) {
            const data = await response.json();
            const elements = Array.isArray(data.elements) ? data.elements : [];
            for (const element of elements) {
              const mapped = osmElementToNearbyResponse(element);
              if (mapped) placeById.set(mapped.id, mapped);
            }
          }
        } finally {
          clearTimeout(timeout);
        }
      }

      if (placeById.size < 40) {
        for (const point of edgeSamplePoints) {
          const controller = new AbortController();
          const timeout = setTimeout(() => controller.abort(), 20000);

          try {
            const pointRadius = Math.max(5000, Math.round(fetchRadiusInMeters * 0.55));
            const overpassQuery = buildOverpassQuery(point.lat, point.lng, pointRadius);
            const response = await fetch(endpoint, {
              method: "POST",
              headers: {
                "Content-Type": "application/x-www-form-urlencoded;charset=UTF-8",
                Accept: "application/json",
                "User-Agent": "ClinicQ/1.0",
              },
              body: `data=${encodeURIComponent(overpassQuery)}`,
              signal: controller.signal,
            });

            if (response.ok) {
              const data = await response.json();
              const elements = Array.isArray(data.elements) ? data.elements : [];
              for (const element of elements) {
                const mapped = osmElementToNearbyResponse(element);
                if (mapped) placeById.set(mapped.id, mapped);
              }
            }
          } finally {
            clearTimeout(timeout);
          }
        }
      }

      externalPlaces = [...placeById.values()];
      providerStatuses.push(`overpass:${endpoint}:OK:${externalPlaces.length}`);
      overpassSuccess = externalPlaces.length > 0;
      if (overpassSuccess) break;
    } catch {
      providerStatuses.push(`overpass:${endpoint}:REQUEST_FAILED`);
    }
  }

  if (!overpassSuccess) {
    providerStatuses.push("overpass:ALL_ENDPOINTS_FAILED");
  }
  
  return externalPlaces;
}

function nominatimPlaceToNearbyResponse(place) {
  const placeClass = String(place.class || "").toLowerCase();
  const placeType = String(place.type || "").toLowerCase();
  const category = String(place.category || "").toLowerCase();

  const allowedHealthcareTypes = new Set([
    "clinic", "hospital", "doctors", "doctor", "dentist", "nursing_home",
    "healthcare", "medical_center", "medical_centre", "laboratory",
    "diagnostic", "diagnostic_center", "diagnostic_centre", "physiotherapist",
    "optometrist", "blood_bank",
  ]);

  const textProbe = `${place.name || ""} ${place.display_name || ""}`.toLowerCase();
  const hasHealthcareKeywordInText = /(clinic|hospital|doctor|medical|health|nursing|dental|care|dispensary|diagnostic)/i.test(textProbe);

  const isHealthcareByType = placeClass === "amenity" && allowedHealthcareTypes.has(placeType);
  const isHealthcareByCategory = category === "healthcare";

  if (!isHealthcareByType && !isHealthcareByCategory && !hasHealthcareKeywordInText) return null;
  if (["road", "highway", "residential", "pedestrian", "neighbourhood", "suburb"].includes(placeType)) return null;

  const lat = Number(place.lat);
  const lng = Number(place.lon);
  if (Number.isNaN(lat) || Number.isNaN(lng)) return null;

  const address = place.address || {};
  const addressParts = [
    address.house_number, address.road, address.suburb,
    address.city || address.town || address.village,
    address.state, address.country,
  ].filter(Boolean);

  const derivedName = place.name || place.display_name?.split(",")?.[0] || "";
  const typeHint =
    placeType === "hospital" ? "hospital"
    : placeType === "dentist" ? "dental clinic"
    : placeType.includes("diagnostic") || placeType.includes("laboratory") ? "diagnostic center"
    : placeType.includes("doctor") ? "doctor clinic"
    : "clinic";

  const hasEvidence = Boolean(place?.extratags?.phone || place?.extratags?.opening_hours);
  if (!hasHealthcareKeyword(derivedName) && !isHealthcareByType && !isHealthcareByCategory && !hasEvidence) return null;

  return {
    id: `nominatim:${place.osm_type}:${place.osm_id}`,
    name: derivedName || toTitleCase(typeHint),
    address: addressParts.join(", ") || place.display_name || "Unknown address",
    location: { lat, lng },
    registeredOnClinicQ: false,
    phone: null,
    rating: null,
    operatingHours: null,
    status: "busy",
    typeHint,
    facilityType: inferFacilityType(derivedName || toTitleCase(typeHint), typeHint, false),
    source: "osm",
  };
}

export async function fetchNominatimPlaces(latitude, longitude, fetchRadiusInMeters, providerStatuses) {
  const bounds = getBoundingBox(latitude, longitude, fetchRadiusInMeters);

  const fetchNominatim = async (query) => {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 7000);

    try {
      const url = new URL("https://nominatim.openstreetmap.org/search");
      url.searchParams.set("q", query);
      url.searchParams.set("format", "jsonv2");
      url.searchParams.set("addressdetails", "1");
      url.searchParams.set("limit", "100");
      url.searchParams.set("lat", String(latitude));
      url.searchParams.set("lon", String(longitude));
      url.searchParams.set("bounded", "1");
      url.searchParams.set("viewbox", `${bounds.minLng},${bounds.maxLat},${bounds.maxLng},${bounds.minLat}`);

      const response = await fetch(url, {
        method: "GET",
        headers: { "Accept-Language": "en", "User-Agent": "ClinicQ/1.0" },
        signal: controller.signal,
      });

      if (!response.ok) return [];

      const data = await response.json();
      return Array.isArray(data) ? data : [];
    } catch {
      return [];
    } finally {
      clearTimeout(timeout);
    }
  };

  const [nominatimClinics, nominatimHospitals, nominatimDoctors, nominatimMedicalCenters, nominatimDiagnostics, nominatimHealthCenters] = await Promise.all([
    fetchNominatim("clinic"),
    fetchNominatim("hospital"),
    fetchNominatim("doctor"),
    fetchNominatim("medical center"),
    fetchNominatim("diagnostic center"),
    fetchNominatim("health center"),
  ]);

  const nominatimById = new Map();
  for (const place of [
    ...nominatimClinics, ...nominatimHospitals, ...nominatimDoctors,
    ...nominatimMedicalCenters, ...nominatimDiagnostics, ...nominatimHealthCenters,
  ]) {
    const mapped = nominatimPlaceToNearbyResponse(place);
    if (mapped && !nominatimById.has(mapped.id)) {
      nominatimById.set(mapped.id, mapped);
    }
  }

  providerStatuses.push(`nominatim:OK:${nominatimById.size}`);
  return [...nominatimById.values()];
}

function geoapifyFeatureToNearbyResponse(feature) {
  const props = feature?.properties || {};
  const lat = Number(props.lat);
  const lng = Number(props.lon);

  if (Number.isNaN(lat) || Number.isNaN(lng)) return null;

  const addressParts = [
    props.housenumber, props.street, props.suburb,
    props.city, props.state, props.country,
  ].filter(Boolean);

  return {
    id: `geoapify:${props.place_id || props.datasource?.raw?.osm_id || `${lat},${lng}`}`,
    name: props.name || props.formatted?.split(",")?.[0] || "Nearby Clinic",
    address: addressParts.join(", ") || props.formatted || "Unknown address",
    location: { lat, lng },
    registeredOnClinicQ: false,
    phone: props.phone || null,
    rating: null,
    operatingHours: props.opening_hours || null,
    status: inferStatusFromSimpleHours(props.opening_hours),
    typeHint: props.categories?.find((c) => /hospital/i.test(c)) ? "hospital" : "clinic",
    facilityType: inferFacilityType(props.name, props.categories?.join(" ") || "clinic", false),
    source: "geoapify",
  };
}

export async function fetchGeoapifyPlaces(latitude, longitude, fetchRadiusInMeters, geoapifyApiKey, providerStatuses) {
  const fetchGeoapify = async (offset = 0) => {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 7000);

    try {
      const url = new URL("https://api.geoapify.com/v2/places");
      url.searchParams.set("categories", "healthcare.clinic,healthcare.hospital,healthcare.doctor,healthcare.dentist");
      url.searchParams.set("filter", `circle:${longitude},${latitude},${fetchRadiusInMeters}`);
      url.searchParams.set("bias", `proximity:${longitude},${latitude}`);
      url.searchParams.set("limit", "200");
      url.searchParams.set("offset", String(offset));
      url.searchParams.set("apiKey", geoapifyApiKey);

      const response = await fetch(url, { method: "GET", signal: controller.signal });
      if (!response.ok) return [];

      const data = await response.json();
      return Array.isArray(data.features) ? data.features : [];
    } catch {
      return [];
    } finally {
      clearTimeout(timeout);
    }
  };

  const [geoapifyPage1, geoapifyPage2] = await Promise.all([fetchGeoapify(0), fetchGeoapify(200)]);
  const geoapifyMapped = [...geoapifyPage1, ...geoapifyPage2]
    .map((feature) => geoapifyFeatureToNearbyResponse(feature))
    .filter(Boolean);

  providerStatuses.push(`geoapify:OK:${geoapifyMapped.length}`);
  return geoapifyMapped;
}
