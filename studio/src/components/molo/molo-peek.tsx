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
        height: size,
        transform: rotation,
        animation: 'moloPeekBob 3s ease-in-out infinite',
      }}
    >
      <img
        src="/molo/molo-peek.png"
        alt="Molo peeking"
        width={size}
        height={size}
        style={{ width: '100%', height: '100%', objectFit: 'contain' }}
      />
      <style>{`
        @keyframes moloPeekBob {
          0%, 100% { transform: ${rotation} translateY(4px); }
          50% { transform: ${rotation} translateY(0px); }
        }
      `}</style>
    </div>
  );
}
