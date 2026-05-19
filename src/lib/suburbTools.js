export function normalizeSuburb(value = "") {
  return value.trim().toLowerCase().split(" ").filter(Boolean).join("_");
}

export function titleCaseSuburb(value = "") {
  return value
    .trim()
    .split(/[\s_]+/)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1).toLowerCase())
    .join(" ");
}

export function inferDirection(lat, lng) {
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
