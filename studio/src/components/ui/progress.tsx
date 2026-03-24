'use client';

interface ProgressProps {
  value: number;
  label?: string;
  showMolo?: boolean;
  color?: 'teal' | 'blue' | 'coral';
}

const colorMap: Record<string, string> = {
  teal: 'var(--accent-teal)',
  blue: 'var(--accent-blue)',
  coral: 'var(--accent-coral)',
};

export function Progress({ value, label, showMolo, color = 'teal' }: ProgressProps) {
  const clamped = Math.min(100, Math.max(0, value));
  return (
    <div style={{ width: '100%' }}>
      {label && (
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6, fontSize: 13 }}>
          <span style={{ color: 'var(--text-secondary)', fontWeight: 500 }}>{label}</span>
          <span style={{ color: 'var(--text-muted)', fontFamily: 'var(--font-geist-mono)' }}>{clamped}%</span>
        </div>
      )}
      <div style={{
        width: '100%',
        height: 8,
        borderRadius: 4,
        background: 'var(--border-subtle)',
        overflow: 'hidden',
        position: 'relative',
      }}>
        <div style={{
          width: `${clamped}%`,
          height: '100%',
          borderRadius: 4,
          background: `linear-gradient(90deg, ${colorMap[color]}, var(--accent-cyan))`,
          transition: 'width 0.6s var(--ease-spring, ease)',
          position: 'relative',
        }}>
          {showMolo && clamped > 5 && (
            <span style={{
              position: 'absolute',
              right: -8,
              top: -10,
              fontSize: 16,
              animation: 'moloLoadBounce 1.5s ease-in-out infinite',
            }}>
              🤖
            </span>
          )}
        </div>
      </div>
    </div>
  );
}
