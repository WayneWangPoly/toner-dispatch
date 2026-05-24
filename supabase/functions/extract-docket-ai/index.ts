import { serve } from "https://deno.land/std@0.224.0/http/server.ts";

serve(async (req) => {
  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), { status: 405, headers: { "Content-Type": "application/json" } });
  }

  try {
    const { imageBase64, mimeType } = await req.json();
    if (!imageBase64 || typeof imageBase64 !== "string") {
      return new Response(JSON.stringify({ error: "imageBase64 is required" }), { status: 400, headers: { "Content-Type": "application/json" } });
    }

    const apiKey = Deno.env.get("OPENAI_API_KEY");
    if (!apiKey) {
      return new Response(JSON.stringify({ error: "OPENAI_API_KEY is not set" }), { status: 500, headers: { "Content-Type": "application/json" } });
    }

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
        product_codes: { type: "array", items: { type: "string" } },
        confidence: { type: "number" },
        warnings: { type: "array", items: { type: "string" } },
      },
      required: ["docket_no", "equip_no", "customer_name", "street_address", "suburb", "state", "postcode", "country", "product_codes", "confidence", "warnings"],
    };

    const prompt = `Extract delivery docket fields. Rules:
- docket_no must be exactly 2 letters + 8 digits.
- equip_no must be exactly 6 digits and come from value after label "Equip No.".
- Use address only from Deliver To section.
- Never use sender/company top-left address.
- Product codes come from Product Code heading and may be multiple.
- If unclear, return empty string and add warning.
Return strict JSON matching schema.`;

    const response = await fetch("https://api.openai.com/v1/responses", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: "gpt-5.4-mini",
        input: [
          {
            role: "user",
            content: [
              { type: "input_text", text: prompt },
              {
                type: "input_image",
                image_url: `data:${mimeType || "image/jpeg"};base64,${imageBase64}`,
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

    const data = await response.json();
    if (!response.ok) {
      return new Response(JSON.stringify({ error: data?.error?.message || "OpenAI request failed" }), { status: 502, headers: { "Content-Type": "application/json" } });
    }

    const jsonText = data?.output_text || data?.output?.[0]?.content?.[0]?.text || "{}";
    const parsed = JSON.parse(jsonText);

    return new Response(JSON.stringify(parsed), { status: 200, headers: { "Content-Type": "application/json" } });
  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), { status: 500, headers: { "Content-Type": "application/json" } });
  }
});
