export function getSupabasePublicConfig() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key =
    process.env.SUPABASE_PUBLISHABLE_KEY ??
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) {
    throw new Error(
      "Supabase public environment variables are not configured. Set NEXT_PUBLIC_SUPABASE_URL and SUPABASE_PUBLISHABLE_KEY.",
    );
  }
  return { url, key };
}
