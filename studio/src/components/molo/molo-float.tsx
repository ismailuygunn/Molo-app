'use client';

interface MoloFloatProps {
  size?: number;
  className?: string;
  opacity?: number;
}

export function MoloFloat({ size = 120, className = '', opacity = 0.15 }: MoloFloatProps) {
  return (
    <div
      className={className}
      style={{
        width: size,
        height: size * 1.4,
        opacity,
        animation: 'moloFloat 6s ease-in-out infinite',
        pointerEvents: 'none',
      }}
    >
      <svg viewBox="0 0 100 140" width={size} height={size * 1.4}>
        {/* Hologram glow */}
        <ellipse cx="50" cy="18" rx="18" ry="6" fill="#00B4FF" opacity="0.4">
          <animate attributeName="opacity" values="0.2;0.5;0.2" dur="2s" repeatCount="indefinite" />
        </ellipse>
        {/* Hologram cone */}
        <path d="M34 42 L50 14 L66 42" fill="none" stroke="#00B4FF" strokeWidth="2" opacity="0.5" />
        {/* Body */}
        <ellipse cx="50" cy="80" rx="30" ry="38" fill="#2B5EA7" />
        {/* Chest panel */}
        <ellipse cx="50" cy="76" rx="20" ry="16" fill="#E8EDF3" />
        {/* ISTADENTAL text */}
        <text x="50" y="80" textAnchor="middle" fill="#2B5EA7" fontSize="5" fontWeight="700" fontFamily="sans-serif">ISTADENTAL</text>
        {/* Visor */}
        <rect x="28" y="46" width="44" height="26" rx="12" fill="#0A1628" />
        {/* Eyes */}
        <circle cx="40" cy="58" r="4" fill="#00D4FF">
          <animate attributeName="r" values="4;3.5;4" dur="3s" repeatCount="indefinite" />
        </circle>
        <circle cx="60" cy="58" r="4" fill="#00D4FF">
          <animate attributeName="r" values="4;3.5;4" dur="3s" repeatCount="indefinite" />
        </circle>
        {/* Smile */}
        <path d="M40 65 Q50 72 60 65" fill="none" stroke="#00D4FF" strokeWidth="2" strokeLinecap="round" />
        {/* Arms */}
        <ellipse cx="22" cy="78" rx="8" ry="5" fill="#2B5EA7" transform="rotate(-15 22 78)" />
        <ellipse cx="78" cy="78" rx="8" ry="5" fill="#2B5EA7" transform="rotate(15 78 78)" />
        {/* Legs */}
        <ellipse cx="38" cy="118" rx="10" ry="16" fill="#2B5EA7" />
        <ellipse cx="62" cy="118" rx="10" ry="16" fill="#2B5EA7" />
      </svg>
      <style>{`
        @keyframes moloFloat {
          0%, 100% { transform: translateY(0) rotate(0deg); }
          25% { transform: translateY(-8px) rotate(1deg); }
          75% { transform: translateY(-4px) rotate(-1deg); }
        }
      `}</style>
    </div>
  );
}
