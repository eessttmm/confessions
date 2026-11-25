// Shared device-model helpers, used by both the public page (collection) and
// the admin dashboard (display). Only verified model mappings are included;
// anything not listed is shown as its raw identifier, never guessed.

const PLACEHOLDERS = new Set(["", "k", "not exposed by browser", "unknown", "not available"]);

// Verified Samsung model identifiers -> commercial names.
const SAMSUNG_MODELS = {
  "SM-A225F": "Samsung Galaxy A22",
  "SM-A226B": "Samsung Galaxy A22 5G",
  "SM-M156B": "Samsung Galaxy M15",
  "SM-M146B": "Samsung Galaxy M14 5G",
  "SM-M236B": "Samsung Galaxy M23 5G",
  "SM-M127F": "Samsung Galaxy M12",
  "SM-M215F": "Samsung Galaxy M21",
  "SM-M317F": "Samsung Galaxy M31",
  "SM-M526B": "Samsung Galaxy M52 5G",
  "SM-A135F": "Samsung Galaxy A13",
  "SM-A325F": "Samsung Galaxy A32",
  "SM-A326B": "Samsung Galaxy A32 5G",
  "SM-A346B": "Samsung Galaxy A34 5G",
  "SM-A515F": "Samsung Galaxy A51",
  "SM-A525F": "Samsung Galaxy A52",
  "SM-A526B": "Samsung Galaxy A52 5G",
  "SM-A528B": "Samsung Galaxy A52s 5G",
  "SM-A536B": "Samsung Galaxy A53 5G",
  "SM-A546B": "Samsung Galaxy A54 5G",
  "SM-A556B": "Samsung Galaxy A55 5G",
  "SM-A715F": "Samsung Galaxy A71",
  "SM-G991B": "Samsung Galaxy S21",
  "SM-G996B": "Samsung Galaxy S21+",
  "SM-G998B": "Samsung Galaxy S21 Ultra",
  "SM-S901B": "Samsung Galaxy S22",
  "SM-S906B": "Samsung Galaxy S22+",
  "SM-S908B": "Samsung Galaxy S22 Ultra",
  "SM-S911B": "Samsung Galaxy S23",
  "SM-S916B": "Samsung Galaxy S23+",
  "SM-S918B": "Samsung Galaxy S23 Ultra",
  "SM-S921B": "Samsung Galaxy S24",
  "SM-S926B": "Samsung Galaxy S24+",
  "SM-S928B": "Samsung Galaxy S24 Ultra"
};

export function cleanModelId(value) {
  if (typeof value !== "string") return "";
  const v = value.trim();
  return PLACEHOLDERS.has(v.toLowerCase()) ? "" : v.slice(0, 60);
}

export function friendlyNameFor(modelId) {
  const id = cleanModelId(modelId).toUpperCase();
  return SAMSUNG_MODELS[id] || "";
}

// Pulls a model identifier out of a User-Agent string, if one is present.
export function modelIdFromUserAgent(ua = "") {
  const samsung = ua.match(/\b(SM-[A-Z0-9]{4,})/i);
  if (samsung) return samsung[1].toUpperCase();
  const android = ua.match(/Android[^;)]*;\s*([^;)]+?)\s*(?:Build\/|\))/i);
  return android ? cleanModelId(android[1]) : "";
}

// Builds the single display string, e.g. "Samsung Galaxy A22 (SM-A225F)".
// Works for new records (deviceName/modelId) and old ones (model only).
export function formatDevice(detail) {
  const d = detail && typeof detail === "object" ? detail : {};
  const id = cleanModelId(d.modelId) || cleanModelId(d.model);
  const name = (typeof d.deviceName === "string" && d.deviceName.trim()) || friendlyNameFor(id);

  if (name && id && name.toUpperCase() !== id.toUpperCase()) return `${name} (${id})`;
  if (name) return name;
  if (id) return id;

  switch (d.os) {
    case "Android": return "Android device (model unavailable)";
    case "iOS": return d.deviceType === "Mobile" ? "iPhone (exact model unavailable)" : "iPad (exact model unavailable)";
    case "Windows":
    case "macOS":
    case "Linux": return "Desktop";
    default: return "Device (model unavailable)";
  }
}

// Collects the model identifier: Client Hints first, User-Agent as fallback.
// Never throws and never waits longer than ~1.5s.
export async function detectModelId() {
  try {
    const uad = navigator.userAgentData;
    if (uad?.getHighEntropyValues) {
      const hints = await Promise.race([
        uad.getHighEntropyValues(["model"]),
        new Promise(resolve => setTimeout(() => resolve(null), 1500))
      ]);
      const fromHints = cleanModelId(hints?.model);
      if (fromHints) return fromHints;
    }
  } catch (_) { /* fall through to User-Agent */ }
  try {
    return modelIdFromUserAgent(navigator.userAgent || "");
  } catch (_) {
    return "";
  }
}
