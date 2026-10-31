import { getServerEnv } from "@/lib/env";

type SupabaseError = { message: string; details?: string; hint?: string };

export async function supabaseRequest<T>(
  path: string,
  init: RequestInit = {},
): Promise<T> {
  const env = getServerEnv();
  const response = await fetch(`${env.supabaseUrl}/rest/v1/${path}`, {
    ...init,
    headers: {
      apikey: env.supabaseServiceRoleKey,
      Authorization: `Bearer ${env.supabaseServiceRoleKey}`,
      "Content-Type": "application/json",
      ...(init.headers ?? {}),
    },
    cache: "no-store",
  });
  if (!response.ok) {
    const error = (await response
      .json()
      .catch(() => null)) as SupabaseError | null;
    throw new Error(
      `Supabase request failed (${response.status}): ${error?.message ?? response.statusText}`,
    );
  }
  if (response.status === 204) return undefined as T;
  const responseBody = await response.text();
  if (!responseBody.trim()) return undefined as T;
  return JSON.parse(responseBody) as T;
}

export async function uploadToSupabaseStorage(
  path: string,
  body: ArrayBuffer,
  contentType: string,
): Promise<void> {
  const env = getServerEnv();
  const response = await fetch(
    `${env.supabaseUrl}/storage/v1/object/${env.storageBucket}/${path}`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${env.supabaseServiceRoleKey}`,
        apikey: env.supabaseServiceRoleKey,
        "Content-Type": contentType,
        "x-upsert": "false",
      },
      body,
    },
  );
  if (!response.ok) {
    throw new Error(`Supabase Storage upload failed (${response.status})`);
  }
}
