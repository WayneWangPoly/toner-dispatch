import fs from "node:fs/promises";
import path from "node:path";

const CSV_URL =
  "https://data.sa.gov.au/data/dataset/e4d3a355-29d7-4bdc-a81d-13fd5ed09ef9/resource/58b3b8ef-f292-4e27-a7bc-215ad7670cda/download/suburbs.csv";

function normalizeSuburb(value = "") {
  return value.trim().toLowerCase().split(/\s+/).filter(Boolean).join("_");
}

function titleCaseSuburb(value = "") {
  return value
    .trim()
    .split(/[\s_]+/)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1).toLowerCase())
    .join(" ");
}

function inferDirection(lat, lng) {
  const cbdLat = -34.9285;
  const cbdLng = 138.6007;

  const dLat = lat - cbdLat;
  const dLng = lng - cbdLng;
  const distanceApprox = Math.sqrt(dLat * dLat + dLng * dLng);

  if (distanceApprox < 0.025) return "CBD";

  if (dLat > 0.16) return "Far North";
  if (dLat < -0.30) return "Far South";

  if (dLat > 0.04 && dLng > 0.04) return "Northeast";
  if (dLat > 0.04 && dLng < -0.04) return "Northwest";
  if (dLat < -0.04 && dLng > 0.04) return "Southeast";
  if (dLat < -0.04 && dLng < -0.04) return "Southwest";

  if (dLat > 0.04) return "North";
  if (dLat < -0.04) return "South";
  if (dLng > 0.04) return "East";
  if (dLng < -0.04) return "West";

  return "CBD";
}

function parseCsv(text) {
  const rows = [];
  let row = [];
  let cell = "";
  let inQuotes = false;

  for (let i = 0; i < text.length; i += 1) {
    const char = text[i];
    const next = text[i + 1];

    if (char === '"' && inQuotes && next === '"') {
      cell += '"';
      i += 1;
      continue;
    }

    if (char === '"') {
      inQuotes = !inQuotes;
      continue;
    }

    if (char === "," && !inQuotes) {
      row.push(cell);
      cell = "";
      continue;
    }

    if ((char === "\n" || char === "\r") && !inQuotes) {
      if (char === "\r" && next === "\n") i += 1;
      row.push(cell);
      if (row.some((v) => v.trim() !== "")) rows.push(row);
      row = [];
      cell = "";
      continue;
    }

    cell += char;
  }

  if (cell || row.length) {
    row.push(cell);
    if (row.some((v) => v.trim() !== "")) rows.push(row);
  }

  return rows;
}

function findColumn(headers, candidates) {
  const lower = headers.map((h) => h.trim().toLowerCase());

  for (const candidate of candidates) {
    const index = lower.findIndex((h) => h === candidate.toLowerCase());
    if (index >= 0) return index;
  }

  for (const candidate of candidates) {
    const index = lower.findIndex((h) => h.includes(candidate.toLowerCase()));
    if (index >= 0) return index;
  }

  return -1;
}

function extractLonLatPairsFromWkt(wkt = "") {
  const pairs = [];
  const regex = /(-?\d+(?:\.\d+)?)\s+(-?\d+(?:\.\d+)?)/g;
  let match;

  while ((match = regex.exec(wkt))) {
    const a = Number(match[1]);
    const b = Number(match[2]);

    if (!Number.isFinite(a) || !Number.isFinite(b)) continue;

    // Most AU WKT uses lon lat. Keep only plausible SA lon/lat.
    const lon = a;
    const lat = b;

    if (lon >= 129 && lon <= 141.5 && lat >= -39 && lat <= -25) {
      pairs.push({ lon, lat });
    }
  }

  return pairs;
}

function centroidFromPairs(pairs) {
  if (!pairs.length) return null;

  const sum = pairs.reduce(
    (acc, p) => {
      acc.lat += p.lat;
      acc.lng += p.lon;
      return acc;
    },
    { lat: 0, lng: 0 }
  );

  return {
    lat: Number((sum.lat / pairs.length).toFixed(6)),
    lng: Number((sum.lng / pairs.length).toFixed(6)),
  };
}

const response = await fetch(CSV_URL);

if (!response.ok) {
  throw new Error(`Failed to download suburbs CSV: ${response.status} ${response.statusText}`);
}

const csvText = await response.text();
const rows = parseCsv(csvText);

if (rows.length < 2) {
  throw new Error("CSV did not contain enough rows.");
}

const headers = rows[0];

const nameIndex = findColumn(headers, [
  "name",
  "suburb",
  "locality",
  "suburb_name",
  "locality_name",
  "feature_name",
]);

const geometryIndex = findColumn(headers, [
  "wkt",
  "geometry",
  "geom",
  "the_geom",
  "shape",
]);

if (nameIndex < 0) {
  throw new Error(`Could not find suburb name column. Headers: ${headers.join(", ")}`);
}

if (geometryIndex < 0) {
  throw new Error(`Could not find geometry/WKT column. Headers: ${headers.join(", ")}`);
}

const suburbDefaults = {};

for (const row of rows.slice(1)) {
  const rawName = row[nameIndex]?.trim();
  const geometry = row[geometryIndex] || "";

  if (!rawName || !geometry) continue;

  const pairs = extractLonLatPairsFromWkt(geometry);
  const centroid = centroidFromPairs(pairs);

  if (!centroid) continue;

  const key = normalizeSuburb(rawName);

  suburbDefaults[key] = {
    direction: inferDirection(centroid.lat, centroid.lng),
    lat: centroid.lat,
    lng: centroid.lng,
  };
}

const entries = Object.entries(suburbDefaults).sort(([a], [b]) => a.localeCompare(b));

const outputObject = Object.fromEntries(entries);

const output = `// Auto-generated from SA suburb boundary CSV.
// Source: ${CSV_URL}
// Do not edit manually. Run: npm run build:suburbs

export const suburbDefaults = ${JSON.stringify(outputObject, null, 2)};

export const suburbOptions = Object.entries(suburbDefaults)
  .map(([key, value]) => ({
    key,
    label: key
      .split("_")
      .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
      .join(" "),
    direction: value.direction,
    lat: value.lat,
    lng: value.lng,
  }))
  .sort((a, b) => a.label.localeCompare(b.label));
`;

await fs.mkdir(path.join(process.cwd(), "src", "lib"), { recursive: true });
await fs.writeFile(path.join(process.cwd(), "src", "lib", "saSuburbs.js"), output, "utf8");

console.log(`Generated src/lib/saSuburbs.js with ${entries.length} suburbs/localities.`);
