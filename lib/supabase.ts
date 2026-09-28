import { createClient } from "@supabase/supabase-js";

const url =
  process.env.NEXT_PUBLIC_SUPABASE_URL ||
  "https://c--97f57802-3150-4dcb-a05a-a7c6af7d161b-prod.lovable.cloud";

const key =
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ||
  "sb_publishable_AzMEhK643dqC8FhavF3emw_ophCoW47";

export const supabase = createClient(url, key, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
  },
});

export const STORE_ID = "00000000-0000-0000-0000-000000000001";

export function normalizePhone(value: string) {
  const digits = (value || "").replace(/\D/g, "");
  if (digits.startsWith("00351") && digits.length >= 14) return digits.slice(5);
  if (digits.startsWith("351") && digits.length >= 12) return digits.slice(3);
  return digits;
}

export function whatsappNumber(value: string) {
  const digits = normalizePhone(value);
  return digits.length === 9 ? "351" + digits : digits;
}
