import { createClient } from "@supabase/supabase-js";
import { getServerEnv } from "@/lib/env";

export function createAdminClient() {
  const env = getServerEnv();
  return createClient(env.supabaseUrl, env.supabaseServiceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}

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

export async function createSupabaseStorageSignedUrl(
  path: string,
  expiresIn = 3600,
): Promise<string> {
  const env = getServerEnv();
  const encodedPath = path.split("/").map(encodeURIComponent).join("/");
  const response = await fetch(
    `${env.supabaseUrl}/storage/v1/object/sign/${encodeURIComponent(env.storageBucket)}/${encodedPath}`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${env.supabaseServiceRoleKey}`,
        apikey: env.supabaseServiceRoleKey,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ expiresIn }),
      cache: "no-store",
    },
  );
  if (!response.ok) {
    throw new Error(`Supabase Storage signed URL failed (${response.status})`);
  }
  const result = (await response.json()) as { signedURL?: string };
  if (!result.signedURL) {
    throw new Error("Supabase Storage returned no signed URL");
  }
  return result.signedURL.startsWith("http")
    ? result.signedURL
    : `${env.supabaseUrl}/storage/v1${result.signedURL}`;
}
