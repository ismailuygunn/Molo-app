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
        <svg viewBox="0 0 48 48" width={size} height={size}>
          {/* Hologram pulse */}
          <ellipse cx="24" cy="6" rx="10" ry="3" fill="#00B4FF" opacity="0.4">
            <animate attributeName="opacity" values="0.2;0.8;0.2" dur="1.5s" repeatCount="indefinite" />
            <animate attributeName="ry" values="3;4;3" dur="1.5s" repeatCount="indefinite" />
          </ellipse>
          <path d="M17 18 L24 5 L31 18" fill="none" stroke="#00B4FF" strokeWidth="1" opacity="0.5" />
          {/* Body */}
          <ellipse cx="24" cy="30" rx="14" ry="16" fill="#2B5EA7" />
          {/* Chest */}
          <ellipse cx="24" cy="29" rx="9" ry="7" fill="#E8EDF3" />
          {/* Visor */}
          <rect x="14" y="20" width="20" height="12" rx="5" fill="#0A1628" />
          {/* Eyes */}
          <circle cx="20" cy="25.5" r="2" fill="#00D4FF" />
          <circle cx="28" cy="25.5" r="2" fill="#00D4FF" />
          {/* Smile */}
          <path d="M20 29 Q24 32 28 29" fill="none" stroke="#00D4FF" strokeWidth="1" strokeLinecap="round" />
        </svg>
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
