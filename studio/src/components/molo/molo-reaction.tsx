'use client';

type Mood = 'happy' | 'thinking' | 'surprised' | 'proud' | 'worried';

interface MoloReactionProps {
  mood: Mood;
  size?: number;
  className?: string;
}

function Eyes({ mood }: { mood: Mood }) {
  switch (mood) {
    case 'happy':
      return (
        <>
          <path d="M11 15 Q13 11 15 15" fill="none" stroke="#00D4FF" strokeWidth="2" strokeLinecap="round" />
          <path d="M21 15 Q23 11 25 15" fill="none" stroke="#00D4FF" strokeWidth="2" strokeLinecap="round" />
        </>
      );
    case 'thinking':
      return (
        <>
          <circle cx="13" cy="14" r="2.2" fill="#00D4FF" />
          <line x1="20" y1="13" x2="26" y2="15" stroke="#00D4FF" strokeWidth="2" strokeLinecap="round" />
        </>
      );
    case 'surprised':
      return (
        <>
          <circle cx="13" cy="14" r="3" fill="none" stroke="#00D4FF" strokeWidth="1.5" />
          <circle cx="13" cy="14" r="1.5" fill="#00D4FF" />
          <circle cx="23" cy="14" r="3" fill="none" stroke="#00D4FF" strokeWidth="1.5" />
          <circle cx="23" cy="14" r="1.5" fill="#00D4FF" />
        </>
      );
    case 'proud':
      return (
        <>
          <path d="M10 15 Q13 13 16 15" fill="none" stroke="#00D4FF" strokeWidth="2" strokeLinecap="round" />
          <path d="M20 15 Q23 13 26 15" fill="none" stroke="#00D4FF" strokeWidth="2" strokeLinecap="round" />
        </>
      );
    case 'worried':
      return (
        <>
          <circle cx="13" cy="14" r="2" fill="#00D4FF" />
          <circle cx="23" cy="14" r="2" fill="#00D4FF" />
          <line x1="10" y1="10" x2="15" y2="11.5" stroke="#00D4FF" strokeWidth="1" opacity="0.5" />
          <line x1="26" y1="10" x2="21" y2="11.5" stroke="#00D4FF" strokeWidth="1" opacity="0.5" />
        </>
      );
  }
}

function Mouth({ mood }: { mood: Mood }) {
  switch (mood) {
    case 'happy':
    case 'proud':
      return <path d="M12 19 Q18 24 24 19" fill="none" stroke="#00D4FF" strokeWidth="1.5" strokeLinecap="round" />;
    case 'thinking':
      return <line x1="13" y1="20" x2="23" y2="20" stroke="#00D4FF" strokeWidth="1.5" strokeLinecap="round" />;
    case 'surprised':
      return <ellipse cx="18" cy="20" rx="3" ry="3.5" fill="none" stroke="#00D4FF" strokeWidth="1.5" />;
    case 'worried':
      return <path d="M12 21 Q18 17 24 21" fill="none" stroke="#00D4FF" strokeWidth="1.5" strokeLinecap="round" />;
  }
}

function Decoration({ mood }: { mood: Mood }) {
  switch (mood) {
    case 'thinking':
      return (
        <text x="28" y="6" fontSize="6" fill="var(--text-muted, #94a3b8)">...</text>
      );
    case 'surprised':
      return (
        <text x="30" y="6" fontSize="8" fontWeight="bold" fill="#f97066">!</text>
      );
    case 'proud':
      return (
        <text x="28" y="5" fontSize="7" fill="#f59e0b">★</text>
      );
    default:
      return null;
  }
}

export function MoloReaction({ mood, size = 32, className = '' }: MoloReactionProps) {
  return (
    <div className={className} style={{ width: size, height: size, display: 'inline-flex' }}>
      <svg viewBox="0 0 36 30" width={size} height={size * 0.83}>
        {/* Mini hologram */}
        <path d="M14 6 L18 1 L22 6" fill="none" stroke="#00B4FF" strokeWidth="0.8" opacity="0.4" />
        {/* Head/visor */}
        <rect x="6" y="7" width="24" height="18" rx="8" fill="#2B5EA7" />
        <rect x="8" y="9" width="20" height="14" rx="6" fill="#0A1628" />
        {/* Mood-specific features */}
        <Eyes mood={mood} />
        <Mouth mood={mood} />
        <Decoration mood={mood} />
      </svg>
    </div>
  );
}
