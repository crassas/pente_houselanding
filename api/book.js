const SUPABASE_URL = process.env.SUPABASE_URL || "https://c--97f57802-3150-4dcb-a05a-a7c6af7d161b-prod.lovable.cloud";
const SUPABASE_PUBLISHABLE_KEY = process.env.SUPABASE_PUBLISHABLE_KEY || "sb_publishable_AzMEhK643dqC8FhavF3emw_ophCoW47";

function json(res, status, payload) {
  res.statusCode = status;
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  res.setHeader("Cache-Control", "no-store");
  res.end(JSON.stringify(payload));
}

async function rpc(name, body) {
  const response = await fetch(SUPABASE_URL + "/rest/v1/rpc/" + name, {
    method: "POST",
    headers: {
      apikey: SUPABASE_PUBLISHABLE_KEY,
      "Content-Type": "application/json",
      Accept: "application/json"
    },
    body: JSON.stringify(body)
  });
  const text = await response.text();
  let data = null;
  try { data = text ? JSON.parse(text) : null; } catch { data = null; }
  if (!response.ok) {
    const message = data && typeof data.message === "string" ? data.message : "Pedido inválido";
    const error = new Error(message);
    error.status = response.status;
    throw error;
  }
  return data;
}

const allowedOrigins = new Set([
  "https://pentehouse.pt",
  "https://www.pentehouse.pt"
]);

function originAllowed(req) {
  const origin = String(req.headers.origin || "");
  if (!origin) return true;
  if (allowedOrigins.has(origin)) return true;
  if (process.env.VERCEL_URL && origin === "https://" + process.env.VERCEL_URL) return true;
  return false;
}

export default async function handler(req, res) {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return json(res, 405, { error: "Método não permitido" });
  }
  if (!originAllowed(req)) return json(res, 403, { error: "Origem não permitida" });

  const body = req.body && typeof req.body === "object" ? req.body : {};
  const payload = {
    p_name: String(body.name || "").trim(),
    p_phone: String(body.phone || "").trim(),
    p_service_key: String(body.serviceId || "").trim(),
    p_barber: String(body.barber || "").trim(),
    p_date: String(body.date || "").trim(),
    p_time: String(body.time || "").trim()
  };

  if (!payload.p_name || !payload.p_phone || !payload.p_service_key || !payload.p_barber || !payload.p_date || !payload.p_time) {
    return json(res, 400, { error: "Preenche nome, telemóvel, serviço, barbeiro, data e hora." });
  }

  try {
    const data = await rpc("create_online_booking", payload);
    return json(res, 201, data);
  } catch (error) {
    return json(res, 409, {
      error: error.message || "Não foi possível criar a reserva"
    });
  }
}
