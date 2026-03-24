'use client';

interface ToggleProps {
  checked: boolean;
  onChange: (checked: boolean) => void;
  label?: string;
  description?: string;
  className?: string;
}

export function Toggle({ checked, onChange, label, description, className = '' }: ToggleProps) {
  return (
    <label className={className} style={{ display: 'flex', alignItems: 'center', gap: 12, cursor: 'pointer' }}>
      <div
        onClick={() => onChange(!checked)}
        style={{
          width: 44, height: 24, borderRadius: 12, position: 'relative',
          background: checked ? 'var(--accent-teal, #14b8a6)' : 'var(--border-default, #d1d5db)',
          transition: 'background 0.2s ease', flexShrink: 0,
        }}
      >
        <div style={{
          width: 18, height: 18, borderRadius: '50%',
          background: '#fff', position: 'absolute', top: 3,
          left: checked ? 23 : 3,
          boxShadow: '0 1px 3px rgba(0,0,0,0.15)',
          transition: 'left 0.2s var(--ease-bounce, ease)',
        }} />
      </div>
      {(label || description) && (
        <div>
          {label && <div style={{ fontSize: 14, fontWeight: 500, color: 'var(--text-primary)' }}>{label}</div>}
          {description && <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 2 }}>{description}</div>}
        </div>
      )}
    </label>
  );
}
