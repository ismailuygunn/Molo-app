'use client';

interface MoloWaveProps {
  size?: number;
  className?: string;
}

export function MoloWave({ size = 100, className = '' }: MoloWaveProps) {
  return (
    <div className={className} style={{ width: size, height: size * 1.3 }}>
      <svg viewBox="0 0 100 130" width={size} height={size * 1.3}>
        {/* Hologram */}
        <path d="M36 40 L50 14 L64 40" fill="none" stroke="#00B4FF" strokeWidth="1.5" opacity="0.5" />
        <ellipse cx="50" cy="14" rx="16" ry="5" fill="#00B4FF" opacity="0.3" />
        {/* Body */}
        <ellipse cx="50" cy="75" rx="28" ry="35" fill="#2B5EA7" />
        {/* Chest */}
        <ellipse cx="50" cy="72" rx="18" ry="14" fill="#E8EDF3" />
        {/* Visor */}
        <rect x="30" y="44" width="40" height="24" rx="11" fill="#0A1628" />
        {/* Happy eyes (half circles) */}
        <path d="M37 55 Q40 50 43 55" fill="none" stroke="#00D4FF" strokeWidth="2.5" strokeLinecap="round" />
        <path d="M57 55 Q60 50 63 55" fill="none" stroke="#00D4FF" strokeWidth="2.5" strokeLinecap="round" />
        {/* Wide smile */}
        <path d="M40 60 Q50 68 60 60" fill="none" stroke="#00D4FF" strokeWidth="2" strokeLinecap="round" />
        {/* Left arm (still) */}
        <ellipse cx="24" cy="74" rx="8" ry="5" fill="#2B5EA7" transform="rotate(-20 24 74)" />
        {/* Right arm (waving) */}
        <g style={{ transformOrigin: '76px 68px', animation: 'moloWaveArm 1.2s ease-in-out infinite' }}>
          <ellipse cx="80" cy="60" rx="8" ry="5" fill="#2B5EA7" transform="rotate(-45 80 60)" />
          {/* Hand */}
          <circle cx="86" cy="54" r="4" fill="#6B9DD6" />
        </g>
        {/* Legs */}
        <ellipse cx="40" cy="110" rx="9" ry="14" fill="#2B5EA7" />
        <ellipse cx="60" cy="110" rx="9" ry="14" fill="#2B5EA7" />
      </svg>
      <style>{`
        @keyframes moloWaveArm {
          0%, 100% { transform: rotate(-10deg); }
          50% { transform: rotate(15deg); }
        }
      `}</style>
    </div>
  );
}
