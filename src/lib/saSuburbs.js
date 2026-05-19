// Auto-generated from SA suburb boundary CSV.
// Source: https://data.sa.gov.au/data/dataset/e4d3a355-29d7-4bdc-a81d-13fd5ed09ef9/resource/58b3b8ef-f292-4e27-a7bc-215ad7670cda/download/suburbs.csv
// Do not edit manually. Run: npm run build:suburbs

export const suburbDefaults = {};

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
