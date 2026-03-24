'use client';

interface MoloPeekProps {
  direction?: 'bottom' | 'right' | 'left';
  size?: number;
  className?: string;
}

export function MoloPeek({ direction = 'bottom', size = 80, className = '' }: MoloPeekProps) {
  const rotation = direction === 'right' ? 'rotate(90deg)' : direction === 'left' ? 'rotate(-90deg)' : 'none';

  return (
    <div
      className={className}
      style={{
        width: size,
        height: size * 0.6,
        overflow: 'hidden',
        transform: rotation,
        animation: 'moloPeekBob 3s ease-in-out infinite',
      }}
    >
      <svg viewBox="0 0 100 80" width={size} height={size}>
        {/* Body */}
        <ellipse cx="50" cy="65" rx="28" ry="32" fill="#2B5EA7" />
        {/* Chest panel */}
        <ellipse cx="50" cy="60" rx="18" ry="14" fill="#E8EDF3" />
        {/* Visor */}
        <rect x="30" y="38" width="40" height="22" rx="10" fill="#0A1628" />
        {/* Eyes */}
        <circle cx="42" cy="48" r="3.5" fill="#00D4FF" />
        <circle cx="58" cy="48" r="3.5" fill="#00D4FF" />
        {/* Smile */}
        <path d="M42 54 Q50 60 58 54" fill="none" stroke="#00D4FF" strokeWidth="1.5" strokeLinecap="round" />
        {/* Hologram cone */}
        <path d="M38 36 L50 12 L62 36" fill="none" stroke="#00B4FF" strokeWidth="1.5" opacity="0.6" />
        <ellipse cx="50" cy="12" rx="14" ry="4" fill="#00B4FF" opacity="0.3" />
      </svg>
      <style>{`
        @keyframes moloPeekBob {
          0%, 100% { transform: ${rotation} translateY(4px); }
          50% { transform: ${rotation} translateY(0px); }
        }
      `}</style>
    </div>
  );
}
