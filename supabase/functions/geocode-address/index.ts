import { serve } from "https://deno.land/std@0.224.0/http/server.ts";

serve(async (req) => {
  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), { status: 405, headers: { "Content-Type": "application/json" } });
  }

  try {
    const { address } = await req.json();
    if (!address || typeof address !== "string") {
      return new Response(JSON.stringify({ error: "address is required" }), { status: 400, headers: { "Content-Type": "application/json" } });
    }

    const apiKey = Deno.env.get("GOOGLE_GEOCODING_API_KEY");
    if (!apiKey) {
      return new Response(JSON.stringify({ error: "GOOGLE_GEOCODING_API_KEY is not set" }), { status: 500, headers: { "Content-Type": "application/json" } });
    }

    const url = new URL("https://maps.googleapis.com/maps/api/geocode/json");
    url.searchParams.set("address", address);
    url.searchParams.set("key", apiKey);

    const response = await fetch(url.toString());
    const payload = await response.json();

    if (!response.ok || payload.status !== "OK" || !payload.results?.length) {
      return new Response(JSON.stringify({
        status: "failed",
        error: payload.error_message || payload.status || "No geocode results",
      }), { status: 200, headers: { "Content-Type": "application/json" } });
    }

    const result = payload.results[0];
    const location = result.geometry?.location || {};

    return new Response(JSON.stringify({
      status: "success",
      lat: location.lat,
      lng: location.lng,
      formatted_address: result.formatted_address || null,
      place_id: result.place_id || null,
      location_type: result.geometry?.location_type || null,
      partial_match: Boolean(result.partial_match),
    }), { status: 200, headers: { "Content-Type": "application/json" } });
  } catch (error) {
    return new Response(JSON.stringify({ status: "failed", error: error.message }), { status: 500, headers: { "Content-Type": "application/json" } });
  }
});
