export const STATUS: Record<string, string> = {
  pending: "Pendente",
  confirmed: "Confirmada",
  arrived: "Chegou",
  in_progress: "Em atendimento",
  completed: "Concluída",
  cancelled: "Cancelada",
  no_show: "Falta",
};

export const WEEKDAYS = ["Seg", "Ter", "Qua", "Qui", "Sex", "Sáb", "Dom"];

export function lisbonToday() {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Europe/Lisbon",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
}

export function addDays(date: string, days: number) {
  const d = new Date(date + "T12:00:00Z");
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

export function isoDow(date: string) {
  const day = new Date(date + "T12:00:00Z").getUTCDay();
  return day === 0 ? 7 : day;
}

export function startOfWeek(date: string) {
  return addDays(date, 1 - isoDow(date));
}

export function formatDate(date?: string | null, withYear = false) {
  if (!date) return "—";
  return new Intl.DateTimeFormat("pt-PT", {
    timeZone: "Europe/Lisbon",
    weekday: withYear ? undefined : "short",
    day: "2-digit",
    month: "short",
    year: withYear ? "numeric" : undefined,
  }).format(new Date(date + "T12:00:00Z"));
}

export function money(value: unknown) {
  return new Intl.NumberFormat("pt-PT", {
    style: "currency",
    currency: "EUR",
  }).format(Number(value || 0));
}

export function addMinutes(time: string, mins: number) {
  const parts = time.split(":").map(Number);
  const total = parts[0] * 60 + parts[1] + mins;
  return String(Math.floor(total / 60)).padStart(2, "0") + ":" + String(total % 60).padStart(2, "0");
}

export function timeShort(v?: string | null) {
  return v ? v.slice(0, 5) : "";
}

export function minutesBetween(a: string, b: string) {
  const aa = a.split(":").map(Number);
  const bb = b.split(":").map(Number);
  return bb[0] * 60 + bb[1] - (aa[0] * 60 + aa[1]);
}

export function statusClass(status: string) {
  if (status === "completed") return "completed";
  if (status === "no_show") return "no_show";
  if (status === "cancelled") return "cancelled";
  if (status === "pending") return "pending";
  return "";
}
