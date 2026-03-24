'use client';

import { type ReactNode } from 'react';

interface CardProps {
  children: ReactNode;
  className?: string;
  hover?: boolean;
  accent?: 'teal' | 'coral' | 'blue' | 'purple' | 'green' | 'amber';
  onClick?: () => void;
}

const accentColors: Record<string, string> = {
  teal: 'var(--accent-teal)',
  coral: 'var(--accent-coral)',
  blue: 'var(--accent-blue)',
  purple: 'var(--accent-purple)',
  green: 'var(--accent-green)',
  amber: 'var(--accent-amber)',
};

export function Card({ children, className = '', hover = true, accent, onClick }: CardProps) {
  return (
    <div
      className={`glass-card ${className}`}
      onClick={onClick}
      style={{
        cursor: onClick ? 'pointer' : undefined,
        borderTop: accent ? `3px solid ${accentColors[accent]}` : undefined,
        transition: hover ? 'all 0.25s var(--ease-spring, ease)' : undefined,
      }}
    >
      {children}
    </div>
  );
}
