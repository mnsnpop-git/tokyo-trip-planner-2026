import { createClient, type SupabaseClient } from "@supabase/supabase-js";

/*
 * Supabase client for the server only (Route Handlers). It uses the secret / service-role key,
 * which bypasses Row Level Security — never import this file from a "use client" component,
 * and never prefix the key with NEXT_PUBLIC_.
 *
 * Environment variables (Vercel → Settings → Environment Variables, or .env.local):
 *   SUPABASE_URL          https://<project-ref>.supabase.co
 *   SUPABASE_SECRET_KEY   sb_secret_…   (or the legacy SUPABASE_SERVICE_ROLE_KEY)
 */

let client: SupabaseClient | null = null;

export function supabaseConfigured(): boolean {
  return !!(supabaseUrl() && supabaseKey());
}

function supabaseUrl() {
  return process.env.SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL;
}

function supabaseKey() {
  return process.env.SUPABASE_SECRET_KEY ?? process.env.SUPABASE_SERVICE_ROLE_KEY;
}

/** Shared server-side client, or null when the environment variables aren't set. */
export function getSupabaseAdmin(): SupabaseClient | null {
  if (client) return client;
  const url = supabaseUrl();
  const key = supabaseKey();
  if (!url || !key) return null;
  client = createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
    // Always read the latest row; never let Next.js cache these requests.
    global: { fetch: (input, init) => fetch(input, { ...init, cache: "no-store" }) },
  });
  return client;
}
