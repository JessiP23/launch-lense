'use client';

import { motion } from 'framer-motion';
import { statusColor } from '@/lib/tokens';
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
  TooltipProvider,
} from '@/components/ui/tooltip';
import type { HealthCheck } from '@/lib/healthgate';

interface HealthgateRingProps {
  score: number;
  status: 'red' | 'yellow' | 'green';
  checks?: HealthCheck[];
  size?: number;
}

export function HealthgateRing({
  score,
  status,
  checks,
  size = 64,
}: HealthgateRingProps) {
  const color = statusColor(status);
  const radius = (size - 8) / 2;
  const circumference = 2 * Math.PI * radius;
  const progress = (score / 100) * circumference;

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <div
            className="relative inline-flex items-center justify-center cursor-pointer"
            style={{ width: size, height: size }}
          >
            <svg
              width={size}
              height={size}
              viewBox={`0 0 ${size} ${size}`}
              className="-rotate-90"
            >
              {/* Background ring */}
              <circle
                cx={size / 2}
                cy={size / 2}
                r={radius}
                fill="none"
                stroke="#262626"
                strokeWidth={4}
              />
              {/* Progress ring */}
              <motion.circle
                cx={size / 2}
                cy={size / 2}
                r={radius}
                fill="none"
                stroke={color}
                strokeWidth={4}
                strokeLinecap="round"
                strokeDasharray={circumference}
                initial={{ strokeDashoffset: circumference }}
                animate={{ strokeDashoffset: circumference - progress }}
                transition={{ duration: 0.8, ease: 'easeOut' }}
              />
            </svg>
            {/* Score text */}
            <motion.span
              className="absolute font-mono text-sm font-bold tabular-nums"
              style={{ color }}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.4 }}
            >
              {score}
            </motion.span>
          </div>
        </TooltipTrigger>
        <TooltipContent side="bottom" className="max-w-xs">
          <div className="space-y-1">
            <div className="font-semibold text-xs" style={{ color }}>
              Healthgate™ Score: {score}/100
            </div>
            {checks && checks.length > 0 && (
              <div className="space-y-0.5">
                {checks.map((c) => (
                  <div key={c.key} className="flex items-center gap-1.5 text-[10px]">
                    <span
                      className="inline-block w-1.5 h-1.5 rounded-full"
                      style={{
                        backgroundColor: c.passed ? '#22C55E' : '#EF4444',
                      }}
                    />
                    <span className="text-[#A1A1A1]">{c.name}</span>
                    <span className="ml-auto tabular-nums">
                      {c.points}/{c.maxPoints}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}
