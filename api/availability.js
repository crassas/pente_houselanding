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

export default async function handler(req, res) {
  if (req.method !== "GET") {
    res.setHeader("Allow", "GET");
    return json(res, 405, { error: "Método não permitido" });
  }

  const serviceId = String(req.query?.serviceId || "").trim();
  const days = Number.parseInt(String(req.query?.days || "7"), 10);
  const limit = Number.parseInt(String(req.query?.limit || "8"), 10);

  if (!serviceId) return json(res, 400, { error: "Serviço em falta" });

  try {
    const data = await rpc("online_booking_availability", {
      p_service_key: serviceId,
      p_days: Number.isFinite(days) ? days : 7,
      p_limit: Number.isFinite(limit) ? limit : 8
    });
    return json(res, 200, data);
  } catch (error) {
    return json(res, error.status === 404 ? 404 : 400, {
      error: error.message || "Não foi possível consultar a agenda"
    });
  }
}
