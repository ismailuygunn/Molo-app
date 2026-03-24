'use client';

import { type ReactNode } from 'react';

interface BadgeProps {
  variant?: 'draft' | 'review' | 'final' | 'error' | 'info' | 'success';
  pulse?: boolean;
  children: ReactNode;
  className?: string;
}

const variantMap: Record<string, string> = {
  draft: 'badge draft',
  review: 'badge review',
  final: 'badge final',
  error: 'badge error',
  info: 'badge review',
  success: 'badge final',
};

export function Badge({ variant = 'info', pulse, children, className = '' }: BadgeProps) {
  return (
    <span
      className={`${variantMap[variant]} ${className}`}
      style={pulse ? { animation: 'pulse 2s ease-in-out infinite' } : undefined}
    >
      {children}
    </span>
  );
}
