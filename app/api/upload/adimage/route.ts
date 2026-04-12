export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

import { NextRequest } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase-admin';

// Upload ad image to Meta via multipart
// POST /api/upload/adimage { ad_account_id, formData with 'file' }
export async function POST(request: NextRequest) {
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

    // 1. Get access token + Meta account_id from DB
    // adAccountId is the internal UUID from the store
    const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(adAccountId);
    const query = supabaseAdmin
      .from('ad_accounts')
      .select('access_token, account_id');

    const { data: account } = await (isUuid
      ? query.eq('id', adAccountId).single()
      : query.eq('account_id', adAccountId).single());

    let accessToken = account?.access_token;
    if (!accessToken) {
      accessToken = process.env.AD_ACCESS_TOKEN;
    }
    if (!accessToken) {
      return Response.json({ error: 'No access token for this account' }, { status: 400 });
    }
    if (!accessToken.startsWith('EAA')) {
      accessToken = process.env.AD_ACCESS_TOKEN || accessToken;
    }

    // Use the real Meta account_id (act_xxx), not the UUID
    const metaAccountId = account?.account_id || adAccountId;

    // 2. Upload to Meta as multipart/form-data
    const metaForm = new FormData();
    metaForm.append('access_token', accessToken);

    // Convert File to Blob for Meta upload
    const bytes = await file.arrayBuffer();
    const blob = new Blob([bytes], { type: file.type });
    metaForm.append('filename', blob, file.name);

    const metaRes = await fetch(
      `https://graph.facebook.com/v20.0/${metaAccountId}/adimages`,
      {
        method: 'POST',
        body: metaForm,
      }
    );

    const metaData = await metaRes.json();

    if (metaData.error) {
      console.error('[upload/adimage] Meta error:', metaData.error);
      return Response.json(
        { error: metaData.error.message || 'Meta upload failed' },
        { status: 400 }
      );
    }

    // 3. Extract image hash from response
    // Meta returns { images: { "filename": { hash: "...", url: "..." } } }
    const images = metaData.images || {};
    const imageKeys = Object.keys(images);
    const imageData = imageKeys.length > 0 ? images[imageKeys[0]] : null;

    if (!imageData?.hash) {
      return Response.json(
        { error: 'No image hash returned from Meta' },
        { status: 500 }
      );
    }

    return Response.json({
      hash: imageData.hash,
      url: imageData.url || null,
      name: file.name,
    });
  } catch (error) {
    console.error('[upload/adimage] Error:', error);
    return Response.json(
      { error: error instanceof Error ? error.message : 'Upload failed' },
      { status: 500 }
    );
  }
}
