import { serve } from "https://deno.land/std@0.224.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      ...corsHeaders,
      "Content-Type": "application/json",
    },
  });
}

function errorMessage(error: unknown) {
  if (error instanceof Error) return error.message;
  return String(error);
}

function cleanAddressForGoogle(address: string) {
  return address
    .replace(/\s+/g, " ")
    .replace(/,\s*,/g, ",")
    .replace(/^\s*,|,\s*$/g, "")
    .trim();
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", {
      status: 200,
      headers: corsHeaders,
    });
  }

  if (req.method !== "POST") {
    return jsonResponse({ status: "failed", error: "Method not allowed" }, 405);
  }

  try {
    const body = await req.json().catch(() => null);

    if (!body || typeof body !== "object") {
      return jsonResponse({ status: "failed", error: "Invalid JSON body" }, 400);
    }

    const { address } = body as { address?: string };

    if (!address || typeof address !== "string" || !address.trim()) {
      return jsonResponse({ status: "failed", error: "address is required" }, 400);
    }

    const apiKey = Deno.env.get("GOOGLE_GEOCODING_API_KEY");

    if (!apiKey) {
      return jsonResponse(
        {
          status: "failed",
          error: "GOOGLE_GEOCODING_API_KEY is not set",
        },
        500,
      );
    }

    const cleanedAddress = cleanAddressForGoogle(address);

    const url = new URL("https://maps.googleapis.com/maps/api/geocode/json");
    url.searchParams.set("address", cleanedAddress);
    url.searchParams.set("region", "au");
    url.searchParams.set("key", apiKey);

    const response = await fetch(url.toString());
    const payload = await response.json();

    if (!response.ok || payload.status !== "OK" || !payload.results?.length) {
      return jsonResponse({
        status: "failed",
        error: payload.error_message || payload.status || "No geocode results",
        google_status: payload.status || null,
        address: cleanedAddress,
      });
    }

    const result = payload.results[0];
    const location = result.geometry?.location || {};

    if (location.lat == null || location.lng == null) {
      return jsonResponse({
        status: "failed",
        error: "Geocode result has no coordinates",
        google_status: payload.status || null,
        address: cleanedAddress,
      });
    }

    return jsonResponse({
      status: "success",
      lat: location.lat,
      lng: location.lng,
      formatted_address: result.formatted_address || null,
      place_id: result.place_id || null,
      location_type: result.geometry?.location_type || null,
      partial_match: Boolean(result.partial_match),
      types: result.types || [],
      google_status: payload.status || null,
      address: cleanedAddress,
    });
  } catch (error) {
    return jsonResponse(
      {
        status: "failed",
        error: errorMessage(error),
      },
      500,
    );
  }
});
