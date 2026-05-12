// proxy.ts — Next.js 16 proxy (replaces middleware.ts)
//
// clerkMiddleware() must run here so that auth() works in all route handlers.
// Also handles:
//   - Redirect unauthenticated users from app routes to /sign-in
//   - CRON_SECRET verification for /api/cron/* routes

import { clerkMiddleware, createRouteMatcher } from '@clerk/nextjs/server';
import { NextRequest, NextResponse } from 'next/server';

// Routes that don't require authentication
const isPublicRoute = createRouteMatcher([
  '/',
  '/sign-in(.*)',
  '/sign-up(.*)',
  '/privacy',
  '/terms',
  '/lp(.*)',
  '/share(.*)',
  '/api/webhooks(.*)',
  '/api/lp/track',
]);

// Cron routes — authenticated by CRON_SECRET, not Clerk
const isCronRoute = createRouteMatcher(['/api/cron/(.*)']);

export const proxy = clerkMiddleware(async (auth, req: NextRequest) => {
  // ── Cron routes: CRON_SECRET only ────────────────────────────────────────
  if (isCronRoute(req)) {
    const cronSecret = process.env.CRON_SECRET;
    const authHeader = req.headers.get('authorization');
    if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    return NextResponse.next();
  }

  // ── Public routes: always allow ──────────────────────────────────────────
  if (isPublicRoute(req)) {
    return NextResponse.next();
  }

  // ── Everything else: require Clerk session ───────────────────────────────
  // API routes get a 401; page routes get redirected to /sign-in.
  const { userId } = await auth();

  if (!userId) {
    const isApiRoute = req.nextUrl.pathname.startsWith('/api/');
    if (isApiRoute) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
    }
    // Page route — redirect to sign-in and come back after
    const signInUrl = new URL('/sign-in', req.url);
    signInUrl.searchParams.set('redirect_url', req.nextUrl.pathname);
    return NextResponse.redirect(signInUrl);
  }

  return NextResponse.next();
});

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
};
