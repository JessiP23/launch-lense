import { supabaseAdmin } from '@/lib/supabase-admin';

export async function getToken(account_id: string): Promise<string | null> {
  const { data: acc, error: accErr } = await supabaseAdmin
    .from('ad_accounts')
    .select('access_token')
    .eq('account_id', account_id)
    .single();

  if (accErr) {
    throw accErr;
  }

  const tokenRef = acc?.access_token;
  if (!tokenRef) {
    return null;
  }

  if (String(tokenRef).startsWith('EAA')) {
    return tokenRef;
  }

  const { data: token, error: tokenErr } = await supabaseAdmin.rpc('get_secret', {
    id: tokenRef,
  });

  if (tokenErr) {
    const errCode = (tokenErr as { code?: string }).code;
    const isDev = process.env.NODE_ENV !== 'production';
    // Dev/local fallback when vault RPC helper isn't available.
    if (errCode === 'PGRST202' && isDev) {
      console.warn('[meta/getToken] get_secret RPC missing in development. Falling back to AD_ACCESS_TOKEN.');
      return process.env.AD_ACCESS_TOKEN || null;
    }
    throw tokenErr;
  }

  return typeof token === 'string' ? token : null;
}
