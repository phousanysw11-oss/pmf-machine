import { createClient, SupabaseClient } from '@supabase/supabase-js';

const supabaseUrl =
  process.env.NEXT_PUBLIC_SUPABASE_URL?.trim() ||
  process.env.SUPABASE_URL?.trim() ||
  '';

const supabaseAnonKey =
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.trim() ||
  process.env.SUPABASE_ANON_KEY?.trim() ||
  '';

// Don't throw during build — create a dummy client or real client
let supabase: SupabaseClient;

if (supabaseUrl && supabaseAnonKey) {
  supabase = createClient(supabaseUrl, supabaseAnonKey, {
    global: {
      fetch: (input, init) => fetch(input, { ...init, cache: 'no-store' }),
    },
  });
} else {
  // During build, env vars may not exist. Create a placeholder that won't crash the build.
  // At runtime on Vercel, env vars WILL be available.
  supabase = createClient(
    'https://placeholder.supabase.co',
    'placeholder-key',
    {
      global: {
        fetch: (input, init) => fetch(input, { ...init, cache: 'no-store' }),
      },
    }
  );
}

export { supabase };
