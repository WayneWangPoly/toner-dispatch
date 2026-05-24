import { createClient } from "@supabase/supabase-js";

const getEnv = (key) => {
  try {
    return import.meta && import.meta.env ? import.meta.env[key] || "" : "";
  } catch {
    return "";
  }
};

export const SUPABASE_URL = getEnv("VITE_SUPABASE_URL");
const SUPABASE_ANON_KEY = getEnv("VITE_SUPABASE_ANON_KEY");

export const supabase =
  SUPABASE_URL && SUPABASE_ANON_KEY
    ? createClient(SUPABASE_URL, SUPABASE_ANON_KEY)
    : null;
