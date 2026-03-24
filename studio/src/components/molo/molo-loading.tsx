'use client';

interface MoloLoadingProps {
  size?: number;
  text?: string;
  className?: string;
}

export function MoloLoading({ size = 48, text, className = '' }: MoloLoadingProps) {
  return (
    <div className={className} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12 }}>
      <div style={{ width: size, height: size, animation: 'moloLoadBounce 1.5s ease-in-out infinite' }}>
        <img
          src="/molo/molo-loading.png"
          alt="Loading"
          width={size}
          height={size}
          style={{ width: '100%', height: '100%', objectFit: 'contain' }}
        />
      </div>
      {text && (
        <span style={{ fontSize: 13, color: 'var(--text-secondary)', fontWeight: 500 }}>{text}</span>
      )}
      <style>{`
        @keyframes moloLoadBounce {
          0%, 100% { transform: translateY(0); }
          50% { transform: translateY(-6px); }
        }
      `}</style>
    </div>
  );
}
