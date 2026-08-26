const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, GET, OPTIONS",
};

const SXLF_URL = "https://stretchxlfreight.com/stretch-crm/api/?endpoint=api/lane_rates";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    let key = "";
    let body = {};
    if (req.method === "POST") {
      body = await req.json();
      key = body.key || Deno.env.get("SXLF_API_KEY") || "";
    } else {
      const u = new URL(req.url);
      key = u.searchParams.get("api_key") || Deno.env.get("SXLF_API_KEY") || "";
      body = {
        origin_city: u.searchParams.get("origin_city"),
        origin_state: u.searchParams.get("origin_state"),
        dest_city: u.searchParams.get("dest_city"),
        dest_state: u.searchParams.get("dest_state"),
        equipment: u.searchParams.get("equipment") || undefined,
      };
    }

    if (!key) {
      return new Response(JSON.stringify({ success: false, message: "Missing SXLF API key" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const payload = {
      origin_city: body.origin_city,
      origin_state: body.origin_state,
      dest_city: body.dest_city,
      dest_state: body.dest_state,
    };
    if (body.equipment) payload.equipment = body.equipment;

    const upstream = await fetch(SXLF_URL, {
      method: "POST",
      headers: {
        "X-API-Key": key,
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      body: JSON.stringify(payload),
    });

    const text = await upstream.text();
    return new Response(text, {
      status: upstream.status,
      headers: {
        ...corsHeaders,
        "Content-Type": "application/json",
      },
    });
  } catch (e) {
    return new Response(JSON.stringify({ success: false, message: String(e?.message || e) }), {
      status: 502,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
