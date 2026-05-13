# Meta Pixel Event Strategy for LaunchLense

## Philosophy

LaunchLense is a **validation platform**, not an e-commerce platform. We track **demand signals**, not vanity metrics.

**Validation IS:**
- clicks
- signups
- waitlists
- leads
- user intent
- measurable acquisition efficiency

**Validation IS NOT:**
- AddToCart (e-commerce)
- Purchase (e-commerce)
- Search (e-commerce)
- Schedule (service booking)
- opinions, upvotes, surveys, comments, likes

## Event Mapping

| LaunchLense Internal Event | Meta Pixel Standard Event | Purpose |
|---------------------------|--------------------------|---------|
| `page_view` | `PageView` | Landing page load (automatic) |
| `view_content` | `ViewContent` | Content engagement (scroll depth) |
| `cta_click` | `Lead` | CTA button click (validation signal) |
| `form_submit` | `Lead` | Form submission (validation signal) |
| `email_capture` | `CompleteRegistration` | Email signup/waitlist (critical validation signal) |
| `scroll_depth` | `ViewContent` | Deep engagement signal |

## Events NOT Used in LaunchLense

These are **irrelevant** for validation:
- `AddToCart` - e-commerce only
- `AddToWishlist` - e-commerce only
- `InitiateCheckout` - e-commerce only
- `Purchase` - e-commerce only
- `Search` - e-commerce only
- `Schedule` - service booking only
- `StartTrial` - SaaS subscription only
- `Subscribe` - SaaS subscription only
- `Contact` - generic business only
- `Donate` - non-profit only
- `FindLocation` - physical retail only
- `CustomizeProduct` - e-commerce only

## Implementation

### Centralized Utility

All Meta Pixel tracking uses `lib/meta-pixel.ts`:

```typescript
import { generateLpTrackingScript } from '@/lib/meta-pixel';

// Generates complete tracking script with:
// - Pixel base code (PageView on load)
// - Internal tracking to /api/lp/track
// - Meta Pixel events for validation signals
const trackingScript = generateLpTrackingScript(
  recordId,    // sprint_id or test_id
  angleId,     // angle identifier
  channel,     // 'meta' | 'google' | etc.
  pixelId      // SYSTEM_META_PIXEL_ID from env
);
```

### Landing Page Generation

Both landing page systems use the centralized utility:

1. **LandingPageAgent** (`lib/agents/landing.ts`) - AI-generated LPs
2. **Fallback Generator** (`app/lp/[test_id]/route.ts`) - Simple fallback LPs

### Event Flow

```
User lands on LP
    ↓
PageView fires (automatic)
    ↓
User scrolls to 25/50/75/100%
    ↓
ViewContent fires (engagement signal)
    ↓
User clicks CTA
    ↓
Lead fires (validation signal)
    ↓
User submits form with email
    ↓
CompleteRegistration fires (critical validation signal)
```

## Testing

### Test URL

```
https://launch-lense.vercel.app/pixel-test.html
```

### Test Events

- **Lead Event** - Simulates CTA click
- **CompleteRegistration** - Simulates form submit
- **ViewContent** - Simulates scroll engagement
- **Custom Event** - LaunchLense-specific validation event

### Meta Events Manager

1. Go to Meta Events Manager
2. Select pixel `1510106240565645`
3. Click "Test Events"
4. Enter test URL
5. Interact with page
6. Verify events appear in real-time

## Environment Variables

```env
SYSTEM_META_PIXEL_ID=1510106240565645
```

## Validation Signal Hierarchy

**Most Critical:**
1. `CompleteRegistration` - Email capture (highest intent)
2. `Lead` - CTA click/form submit (medium intent)
3. `ViewContent` - Scroll engagement (low intent)
4. `PageView` - Landing page load (baseline)

## Integration with LaunchLense Orchestration

Every Meta Pixel event **also** emits:
- PostHog event (analytics)
- `sprint_events` row (database)
- Timestamp
- Sprint ID
- Angle ID
- Channel
- UTM parameters

This dual tracking ensures:
- Meta optimization (campaign performance)
- LaunchLense analytics (validation scoring)
- Attribution tracking (angle performance)

## Future Considerations

### Multi-Platform Support

When adding Google Ads, TikTok, LinkedIn:
- Create platform-specific pixel utilities
- Map LaunchLense events to platform equivalents
- Maintain consistent internal event names

### Custom Events

For specialized validation scenarios:
```typescript
fbq('trackCustom', 'LaunchLenseValidation', {
  validation_type: 'demand_signal',
  sprint_id: 'xxx',
  angle_id: 'yyy'
});
```

## Compliance

- Pixel code is sanitized before storage
- No arbitrary JS injection
- CSP headers supported
- User consent respected (if required by jurisdiction)
