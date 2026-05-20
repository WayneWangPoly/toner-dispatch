import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { execFileSync } from "node:child_process";

const GEOJSON_ZIP_URL =
  "https://www.dptiapps.com.au/dataportal/Suburbs_geojson.zip";

function normalizeSuburb(value = "") {
  return value.trim().toLowerCase().split(/\s+/).filter(Boolean).join("_");
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

function flattenCoordinates(coords, output = []) {
  if (!Array.isArray(coords)) return output;

  if (
    coords.length >= 2 &&
    typeof coords[0] === "number" &&
    typeof coords[1] === "number"
  ) {
    const lng = coords[0];
    const lat = coords[1];

    if (
      Number.isFinite(lat) &&
      Number.isFinite(lng) &&
      lat >= -39 &&
      lat <= -25 &&
      lng >= 129 &&
      lng <= 141.5
    ) {
      output.push({ lat, lng });
    }

    return output;
  }

  for (const item of coords) {
    flattenCoordinates(item, output);
  }

  return output;
}

function centroidFromPoints(points) {
  if (!points.length) return null;

  const sum = points.reduce(
    (acc, point) => {
      acc.lat += point.lat;
      acc.lng += point.lng;
      return acc;
    },
    { lat: 0, lng: 0 }
  );

  return {
    lat: Number((sum.lat / points.length).toFixed(6)),
    lng: Number((sum.lng / points.length).toFixed(6)),
  };
}

function getFeatureName(feature) {
  const props = feature?.properties || {};

  const candidates = [
    "suburb",
    "SUBURB",
    "Suburb",
    "suburb_name",
    "SUBURB_NAME",
    "locality",
    "LOCALITY",
    "locality_name",
    "LOCALITY_NAME",
    "name",
    "NAME",
    "feature_name",
    "FEATURE_NAME",
  ];

  for (const key of candidates) {
    const value = props[key];
    if (typeof value === "string" && value.trim()) {
      return value.trim();
    }
  }

  for (const [key, value] of Object.entries(props)) {
    if (
      typeof value === "string" &&
      value.trim() &&
      /suburb|locality|name/i.test(key)
    ) {
      return value.trim();
    }
  }

  return "";
}

async function downloadToFile(url, filePath) {
  const response = await fetch(url);

  if (!response.ok) {
    throw new Error(
      `Failed to download GeoJSON zip: ${response.status} ${response.statusText}`
    );
  }

  const arrayBuffer = await response.arrayBuffer();
  await fs.writeFile(filePath, Buffer.from(arrayBuffer));
}

const tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), "sa-suburbs-"));
const zipPath = path.join(tmpDir, "suburbs.zip");

await downloadToFile(GEOJSON_ZIP_URL, zipPath);

const fileList = execFileSync("unzip", ["-Z1", zipPath], {
  encoding: "utf8",
})
  .split(/\r?\n/)
  .map((line) => line.trim())
  .filter(Boolean);

console.log("Files inside zip:");
console.log(fileList.join("\n"));

const geojsonFile = fileList.find((file) =>
  /\.(geojson|json)$/i.test(file)
);

if (!geojsonFile) {
  throw new Error("Could not find a .geojson or .json file inside the zip.");
}

console.log(`Using GeoJSON file: ${geojsonFile}`);

const geojsonText = execFileSync("unzip", ["-p", zipPath, geojsonFile], {
  encoding: "utf8",
  maxBuffer: 50 * 1024 * 1024,
});

const geojson = JSON.parse(geojsonText);
const features = Array.isArray(geojson.features) ? geojson.features : [];

console.log(`GeoJSON feature count: ${features.length}`);

if (!features.length) {
  throw new Error("GeoJSON contained no features.");
}

console.log("Sample properties:");
console.log(JSON.stringify(features[0]?.properties || {}, null, 2));

const suburbDefaults = {};

for (const feature of features) {
  const rawName = getFeatureName(feature);
  if (!rawName) continue;

  const points = flattenCoordinates(feature.geometry?.coordinates || []);
  const centroid = centroidFromPoints(points);

  if (!centroid) continue;

  const key = normalizeSuburb(rawName);

  suburbDefaults[key] = {
    direction: inferDirection(centroid.lat, centroid.lng),
    lat: centroid.lat,
    lng: centroid.lng,
  };
}

const entries = Object.entries(suburbDefaults).sort(([a], [b]) =>
  a.localeCompare(b)
);

if (entries.length < 50) {
  throw new Error(
    `Only generated ${entries.length} suburbs/localities. Refusing to write empty/invalid table.`
  );
}

const outputObject = Object.fromEntries(entries);

const output = `// Auto-generated from SA suburb GeoJSON.
// Source: ${GEOJSON_ZIP_URL}
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
await fs.writeFile(
  path.join(process.cwd(), "src", "lib", "saSuburbs.js"),
  output,
  "utf8"
);

console.log(
  `Generated src/lib/saSuburbs.js with ${entries.length} suburbs/localities.`
);
