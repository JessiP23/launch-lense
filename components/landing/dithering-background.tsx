'use client';

import { memo } from 'react';

/**
 * DitheringBackground - Isolated, optimized dithering pattern effect
 *
 * Features:
 * - Memoized to prevent unnecessary re-renders
 * - Fixed positioning with pointer-events-none for performance
 * - Pure CSS/SVG pattern - no GPU overhead
 * - Zero dependencies on parent components
 */
export const DitheringBackground = memo(function DitheringBackground() {
  return (
    <div
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        pointerEvents: 'none',
        zIndex: 9999,
        opacity: 0.03,
        backgroundImage: `url("data:image/svg+xml,%3Csvg width='4' height='4' viewBox='0 0 4 4' xmlns='http://www.w3.org/2000/svg'%3E%3Crect x='0' y='0' width='1' height='1' fill='%23000000'/%3E%3Crect x='2' y='2' width='1' height='1' fill='%23000000'/%3E%3C/svg%3E")`,
        backgroundRepeat: 'repeat',
      }}
    />
  );
});
