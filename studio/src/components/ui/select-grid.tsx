'use client';

import { type ReactNode } from 'react';
import { Check } from 'lucide-react';

interface SelectGridOption<T> {
  id: T;
  label: string;
  description?: string;
  icon?: ReactNode;
}

interface SelectGridProps<T extends string> {
  options: SelectGridOption<T>[];
  value: T | null;
  onChange: (value: T) => void;
  columns?: 2 | 3 | 4;
  className?: string;
}

export function SelectGrid<T extends string>({
  options, value, onChange, columns = 3, className = '',
}: SelectGridProps<T>) {
  return (
    <div
      className={className}
      style={{
        display: 'grid',
        gridTemplateColumns: `repeat(${columns}, 1fr)`,
        gap: 10,
      }}
    >
      {options.map((opt) => {
        const selected = opt.id === value;
        return (
          <div
            key={opt.id}
            onClick={() => onChange(opt.id)}
            style={{
              padding: 14, borderRadius: 'var(--radius-md)',
              border: `2px solid ${selected ? 'var(--accent-teal, #14b8a6)' : 'var(--border-subtle, #e2e8f0)'}`,
              background: selected ? 'rgba(20, 184, 166, 0.06)' : 'var(--bg-card)',
              cursor: 'pointer', position: 'relative',
              transition: 'all 0.2s ease',
            }}
          >
            {selected && (
              <div style={{
                position: 'absolute', top: 6, right: 6,
                width: 20, height: 20, borderRadius: '50%',
                background: 'var(--accent-teal, #14b8a6)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}>
                <Check size={12} color="#fff" strokeWidth={3} />
              </div>
            )}
            {opt.icon && <div style={{ marginBottom: 8 }}>{opt.icon}</div>}
            <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)' }}>{opt.label}</div>
            {opt.description && (
              <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 4 }}>{opt.description}</div>
            )}
          </div>
        );
      })}
    </div>
  );
}
