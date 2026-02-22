import { createBrowserClient } from "@supabase/ssr";

export function createClient() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  // Return safe Proxy if vars missing (build OR edge without vars)
  if (!supabaseUrl || !supabaseAnonKey) {
    console.warn('[Supabase] Env vars missing, returning Proxy client');
    return new Proxy({} as ReturnType<typeof createBrowserClient>, {
      get: () => () => Promise.resolve({ data: null, error: null })
    });
  }

  return createBrowserClient(supabaseUrl, supabaseAnonKey);
}
