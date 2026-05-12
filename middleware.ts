// LaunchLense — Next.js middleware
// Clerk auth for app + sprint API routes; CRON_SECRET for cron routes.

import { clerkMiddleware, createRouteMatcher } from '@clerk/nextjs/server';
import { NextRequest, NextResponse } from 'next/server';

// ── Route matchers ────────────────────────────────────────────────────────

const isPublicRoute = createRouteMatcher([
  '/',
  '/privacy',
  '/terms',
  '/share/(.*)',
  '/lp/(.*)',
  '/api/webhooks/(.*)',
  '/api/lp/track',
  '/api/qa',                  // dev-only sanity endpoint
]);

const isCronRoute = createRouteMatcher(['/api/cron/(.*)']);

const isSprintApiRoute = createRouteMatcher([
  '/api/sprint(.*)',
  '/api/ai/(.*)',
  '/api/angle/(.*)',
  '/api/accounts(.*)',
  '/api/auth/(.*)',
  '/api/health/(.*)',
  '/api/integrations/(.*)',
  '/api/reports/(.*)',
  '/api/lp/deploy',
  '/api/meta/(.*)',
  '/api/policy/(.*)',
  '/api/force-go',
  '/api/upload/(.*)',
]);

// ── Middleware ────────────────────────────────────────────────────────────

export default clerkMiddleware(async (auth, req: NextRequest) => {
  // 1. Cron routes: verify CRON_SECRET, no Clerk needed
  if (isCronRoute(req)) {
    const cronSecret = process.env.CRON_SECRET;
    if (cronSecret) {
      const authHeader = req.headers.get('authorization');
      if (authHeader !== `Bearer ${cronSecret}`) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
      }
    }
    return NextResponse.next();
  }

  // 2. Public routes: always allow
  if (isPublicRoute(req)) {
    return NextResponse.next();
  }

  // 3. Sprint API + app routes: require Clerk auth
  if (isSprintApiRoute(req)) {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
    }
    return NextResponse.next();
  }

  // 4. All (app)/* routes: Clerk redirects to sign-in automatically
  await auth.protect();
});

export const config = {
  matcher: [
    // Run on all routes except Next.js internals and static files
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
};
