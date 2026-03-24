'use client';

import { type ReactNode } from 'react';
import { MoloPeek } from '../molo/molo-peek';

interface EmptyStateProps {
  title: string;
  description?: string;
  action?: { label: string; onClick: () => void };
  icon?: ReactNode;
  className?: string;
}

export function EmptyState({ title, description, action, icon, className = '' }: EmptyStateProps) {
  return (
    <div
      className={className}
      style={{
        display: 'flex', flexDirection: 'column', alignItems: 'center',
        justifyContent: 'center', padding: '60px 24px', textAlign: 'center',
      }}
    >
      <div style={{ marginBottom: 16 }}>
        {icon || <MoloPeek size={80} />}
      </div>
      <h3 style={{ fontSize: 18, fontWeight: 600, color: 'var(--text-primary)', marginBottom: 6 }}>
        {title}
      </h3>
      {description && (
        <p style={{ fontSize: 14, color: 'var(--text-muted)', maxWidth: 360, marginBottom: action ? 20 : 0 }}>
          {description}
        </p>
      )}
      {action && (
        <button
          className="btn btn-primary"
          onClick={action.onClick}
          style={{ padding: '10px 24px', fontSize: 14 }}
        >
          {action.label}
        </button>
      )}
    </div>
  );
}
