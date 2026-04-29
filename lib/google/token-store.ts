import { createServiceClient } from '@/lib/supabase';
import { decryptSecret, encryptSecret } from '@/lib/crypto/google-token-crypto';

export async function saveGoogleRefreshToken(params: {
  scopeKey: string;
  refreshToken: string;
  googleEmail: string | null;
  scopes: string[];
}): Promise<void> {
  const db = createServiceClient();
  const encrypted_refresh_token = encryptSecret(params.refreshToken);
  const { error } = await db.from('google_oauth_tokens').upsert(
    {
      scope_key: params.scopeKey,
      encrypted_refresh_token,
      google_email: params.googleEmail,
      scopes: params.scopes,
      updated_at: new Date().toISOString(),
    },
    { onConflict: 'scope_key' },
  );
  if (error) throw new Error(error.message);
}

export async function deleteGoogleTokens(scopeKey: string): Promise<void> {
  const db = createServiceClient();
  await db.from('google_oauth_tokens').delete().eq('scope_key', scopeKey);
}

export async function getGoogleRefreshToken(scopeKey: string): Promise<string | null> {
  const db = createServiceClient();
  const { data, error } = await db
    .from('google_oauth_tokens')
    .select('encrypted_refresh_token')
    .eq('scope_key', scopeKey)
    .maybeSingle();
  if (error || !data?.encrypted_refresh_token) return null;
  try {
    return decryptSecret(data.encrypted_refresh_token as string);
  } catch {
    return null;
  }
}

export async function getGoogleConnection(scopeKey: string): Promise<{
  google_email: string | null;
  scopes: string[];
  updated_at: string;
} | null> {
  const db = createServiceClient();
  const { data, error } = await db
    .from('google_oauth_tokens')
    .select('google_email, scopes, updated_at')
    .eq('scope_key', scopeKey)
    .maybeSingle();
  if (error || !data) return null;
  return {
    google_email: data.google_email as string | null,
    scopes: (data.scopes as string[]) ?? [],
    updated_at: data.updated_at as string,
  };
}
