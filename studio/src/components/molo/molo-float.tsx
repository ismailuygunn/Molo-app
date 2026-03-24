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
      <img
        src="/molo/molo-float.png"
        alt=""
        width={size}
        height={size * 1.4}
        style={{ width: '100%', height: '100%', objectFit: 'contain' }}
      />
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
