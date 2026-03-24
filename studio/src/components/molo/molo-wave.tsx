'use client';

interface MoloWaveProps {
  size?: number;
  className?: string;
}

export function MoloWave({ size = 100, className = '' }: MoloWaveProps) {
  return (
    <div className={className} style={{ width: size, height: size }}>
      <img
        src="/molo/molo-wave.png"
        alt="Molo waving"
        width={size}
        height={size}
        style={{ width: '100%', height: '100%', objectFit: 'contain' }}
      />
    </div>
  );
}
