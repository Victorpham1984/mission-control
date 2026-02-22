import { createBrowserClient } from "@supabase/ssr";

export function createClient() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  // During build/prerender, env vars may not be available.
  // Return a placeholder client that will be replaced at runtime.
  if (!supabaseUrl || !supabaseAnonKey) {
    if (typeof window === "undefined") {
      // Server-side prerender: return a dummy proxy that won't crash
      return new Proxy({} as ReturnType<typeof createBrowserClient>, {
        get: () => () => ({ data: null, error: { message: "Supabase not available during prerender" } }),
      });
    }
    throw new Error("Missing NEXT_PUBLIC_SUPABASE_URL or NEXT_PUBLIC_SUPABASE_ANON_KEY");
  }

  return createBrowserClient(supabaseUrl, supabaseAnonKey);
}
