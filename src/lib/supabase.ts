import { createClient } from '@supabase/supabase-js';

// Support both Next.js convention (NEXT_PUBLIC_*) and plain names (SUPABASE_*)
const supabaseUrl =
  process.env.NEXT_PUBLIC_SUPABASE_URL?.trim() ||
  process.env.SUPABASE_URL?.trim() ||
  '';
const supabaseAnonKey =
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.trim() ||
  process.env.SUPABASE_ANON_KEY?.trim() ||
  '';

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error(
    'Missing Supabase env. In .env.local set either (NEXT_PUBLIC_SUPABASE_URL + NEXT_PUBLIC_SUPABASE_ANON_KEY) or (SUPABASE_URL + SUPABASE_ANON_KEY), then restart the dev server.'
  );
}

// Next.js App Router caches server-side fetch() by default.
// Supabase JS uses fetch under the hood; forcing `cache: 'no-store'` prevents stale reads
// (e.g., Flow 2 gating on Flow 1 locked status right after locking).
export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  global: {
    fetch: (input, init) => fetch(input, { ...init, cache: 'no-store' }),
  },
});
