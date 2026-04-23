export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

import { supabaseAdmin } from '@/lib/supabase-admin';
import { getToken } from '@/lib/meta';

const META_BASE = 'https://graph.facebook.com/v20.0';

export async function POST(request: Request) {
  try {
    const formData = await request.formData();
    const file = formData.get('file') as File | null;
    const adAccountId = formData.get('ad_account_id') as string | null;

    if (!file || !adAccountId) {
      return Response.json(
        { error: 'Missing file or ad_account_id' },
        { status: 400 }
      );
    }

    // Resolve access token from DB
    const { data: account } = await supabaseAdmin
      .from('ad_accounts')
      .select('account_id')
      .eq('id', adAccountId)
      .single();

    let accessToken = account?.account_id ? await getToken(account.account_id) : null;
    if (!accessToken) {
      accessToken = process.env.AD_ACCESS_TOKEN || null;
    }
    if (!accessToken) {
      return Response.json(
        { error: 'No access token available' },
        { status: 400 }
      );
    }

    // Meta account ID needs act_ prefix
    const metaAccountId = account?.account_id || adAccountId;
    const rawId = metaAccountId.replace('act_', '');

    // Upload via Meta API using multipart form
    const metaForm = new FormData();
    metaForm.append('filename', file, file.name);
    metaForm.append('access_token', accessToken);

    const metaRes = await fetch(
      `${META_BASE}/act_${rawId}/adimages`,
      {
        method: 'POST',
        body: metaForm,
      }
    );

    const metaData = await metaRes.json();

    if (metaData.error) {
      console.error('[upload-image] Meta error:', metaData.error);
      return Response.json(
        { error: metaData.error.message || 'Meta API error' },
        { status: 400 }
      );
    }

    // Meta returns { images: { <filename>: { hash: "...", ... } } }
    const images = metaData.images;
    const firstKey = images ? Object.keys(images)[0] : null;
    const imageHash = firstKey ? images[firstKey].hash : null;

    if (!imageHash) {
      return Response.json(
        { error: 'No image hash returned from Meta' },
        { status: 500 }
      );
    }

    return Response.json({ image_hash: imageHash, meta: metaData });
  } catch (error) {
    console.error('[upload-image] Error:', error);
    return Response.json(
      { error: error instanceof Error ? error.message : 'Upload failed' },
      { status: 500 }
    );
  }
}
