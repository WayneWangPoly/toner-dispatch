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

function extractOutputText(data: any) {
  if (typeof data?.output_text === "string" && data.output_text.trim()) {
    return data.output_text;
  }

  const output = Array.isArray(data?.output) ? data.output : [];

  for (const item of output) {
    const content = Array.isArray(item?.content) ? item.content : [];

    for (const part of content) {
      if (typeof part?.text === "string" && part.text.trim()) {
        return part.text;
      }
    }
  }

  return "";
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", {
      status: 200,
      headers: corsHeaders,
    });
  }

  if (req.method !== "POST") {
    return jsonResponse({ error: "Method not allowed" }, 405);
  }

  try {
    const requestBody = await req.json().catch(() => null);

    if (!requestBody || typeof requestBody !== "object") {
      return jsonResponse({ error: "Invalid JSON body" }, 400);
    }

    const { imageBase64, mimeType } = requestBody as {
      imageBase64?: string;
      mimeType?: string;
    };

    if (!imageBase64 || typeof imageBase64 !== "string") {
      return jsonResponse({ error: "imageBase64 is required" }, 400);
    }

    const apiKey = Deno.env.get("OPENAI_API_KEY");

    if (!apiKey) {
      return jsonResponse({ error: "OPENAI_API_KEY is not set" }, 500);
    }

    const model = Deno.env.get("OPENAI_MODEL") || "gpt-5.4-mini";
    const safeMimeType = mimeType || "image/jpeg";

    const schema = {
      type: "object",
      additionalProperties: false,
      properties: {
        docket_no: { type: "string" },
        equip_no: { type: "string" },
        customer_name: { type: "string" },
        street_address: { type: "string" },
        suburb: { type: "string" },
        state: { type: "string" },
        postcode: { type: "string" },
        country: { type: "string" },
        product_codes: {
          type: "array",
          items: { type: "string" },
        },
        confidence: { type: "number" },
        warnings: {
          type: "array",
          items: { type: "string" },
        },
      },
      required: [
        "docket_no",
        "equip_no",
        "customer_name",
        "street_address",
        "suburb",
        "state",
        "postcode",
        "country",
        "product_codes",
        "confidence",
        "warnings",
      ],
    };

    const prompt = `
You are extracting structured fields from a delivery docket image.

Return only valid JSON matching the schema.

Rules:
- docket_no must be exactly 2 letters followed by 8 digits, for example AN06582282.
- equip_no must be exactly 6 digits.
- equip_no should come from the value after the label "Equip No.".
- Delivery address must come from the "Deliver To" section only.
- Never use the sender/company address in the top-left corner.
- customer_name should come from the Deliver To section.
- street_address should include street number and street name, for example "25 King William Street".
- suburb, state and postcode should come from the Deliver To address block.
- Product Code values should come from the Product Code heading and the rows below it.
- There may be multiple Product Code values.
- If a field is unclear or not visible, return an empty string or empty array and add a warning.
- Do not guess.
- country should default to "Australia" if the address is Australian.
`.trim();

    const openAiResponse = await fetch("https://api.openai.com/v1/responses", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model,
        input: [
          {
            role: "user",
            content: [
              {
                type: "input_text",
                text: prompt,
              },
              {
                type: "input_image",
                image_url: `data:${safeMimeType};base64,${imageBase64}`,
                detail: "high",
              },
            ],
          },
        ],
        text: {
          format: {
            type: "json_schema",
            name: "docket_extract",
            schema,
            strict: true,
          },
        },
      }),
    });

    const rawOpenAiText = await openAiResponse.text();

    let openAiData: any = null;

    try {
      openAiData = rawOpenAiText ? JSON.parse(rawOpenAiText) : null;
    } catch {
      openAiData = null;
    }

    if (!openAiResponse.ok) {
      return jsonResponse(
        {
          error:
            openAiData?.error?.message ||
            rawOpenAiText ||
            "OpenAI request failed",
          status: openAiResponse.status,
          model,
        },
        502,
      );
    }

    const jsonText = extractOutputText(openAiData);

    if (!jsonText) {
      return jsonResponse(
        {
          error: "OpenAI returned no output text",
          model,
          raw: openAiData,
        },
        502,
      );
    }

    let parsed: any;

    try {
      parsed = JSON.parse(jsonText);
    } catch {
      return jsonResponse(
        {
          error: "Failed to parse OpenAI JSON output",
          model,
          output_text: jsonText,
        },
        502,
      );
    }

    return jsonResponse({
      docket_no: parsed?.docket_no || "",
      equip_no: parsed?.equip_no || "",
      customer_name: parsed?.customer_name || "",
      street_address: parsed?.street_address || "",
      suburb: parsed?.suburb || "",
      state: parsed?.state || "SA",
      postcode: parsed?.postcode || "",
      country: parsed?.country || "Australia",
      product_codes: Array.isArray(parsed?.product_codes)
        ? parsed.product_codes
        : [],
      confidence:
        typeof parsed?.confidence === "number" ? parsed.confidence : 0,
      warnings: Array.isArray(parsed?.warnings) ? parsed.warnings : [],
    });
  } catch (error) {
    return jsonResponse(
      {
        error: errorMessage(error),
      },
      500,
    );
  }
});
