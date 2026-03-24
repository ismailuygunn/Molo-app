'use client';

type Mood = 'happy' | 'thinking' | 'surprised' | 'proud' | 'worried';

interface MoloReactionProps {
  mood: Mood;
  size?: number;
  className?: string;
}

const MOOD_IMAGES: Record<Mood, string> = {
  happy: '/molo/molo-wave.png',
  thinking: '/molo/molo-thinking.png',
  surprised: '/molo/molo-surprised.png',
  proud: '/molo/molo-proud.png',
  worried: '/molo/molo-worried.png',
};

export function MoloReaction({ mood, size = 32, className = '' }: MoloReactionProps) {
  return (
    <div className={className} style={{ width: size, height: size, display: 'inline-flex' }}>
      <img
        src={MOOD_IMAGES[mood]}
        alt={`Molo ${mood}`}
        width={size}
        height={size}
        style={{ width: '100%', height: '100%', objectFit: 'contain' }}
      />
    </div>
  );
}
