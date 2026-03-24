'use client';

import { Check, Image as ImageIcon, Circle } from 'lucide-react';
import { Badge } from '@/components/ui';
import type { Scene } from '@/store/studio';

interface SceneCardProps {
  scene: Scene;
  isActive: boolean;
  hasImage: boolean;
  isApproved: boolean;
  onClick: () => void;
}

export function SceneCard({ scene, isActive, hasImage, isApproved, onClick }: SceneCardProps) {
  const selectedVariant = scene.imageVariants.find((v) => v.id === scene.selectedImageId);
  const thumbnailUrl = selectedVariant?.url ?? scene.imageVariants[0]?.url;

  return (
    <div
      role="button"
      tabIndex={0}
      aria-label={`Sahne ${scene.scene}${isApproved ? ', onaylandi' : ''}`}
      aria-current={isActive ? 'true' : undefined}
      onClick={onClick}
      onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onClick(); } }}
      style={{
        padding: 10,
        borderRadius: 'var(--radius-md)',
        border: `2px solid ${isActive ? 'var(--accent-teal)' : 'var(--border-subtle)'}`,
        background: isActive ? 'rgba(20, 184, 166, 0.04)' : 'var(--bg-card)',
        cursor: 'pointer',
        transition: 'all 0.2s ease',
        display: 'flex',
        gap: 10,
        alignItems: 'center',
      }}
    >
      {/* Thumbnail */}
      <div style={{
        width: 56, height: 56, borderRadius: 'var(--radius-sm)',
        background: 'var(--bg-secondary)', flexShrink: 0, overflow: 'hidden',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
      }}>
        {thumbnailUrl ? (
          <img
            src={thumbnailUrl}
            alt={`Sahne ${scene.scene}`}
            style={{ width: '100%', height: '100%', objectFit: 'cover' }}
            loading="lazy"
          />
        ) : (
          <ImageIcon size={20} color="var(--text-muted)" style={{ opacity: 0.3 }} />
        )}
      </div>

      {/* Info */}
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{
          display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4,
        }}>
          <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)' }}>
            Sahne {scene.scene}
          </span>
          {/* Approval indicator */}
          {isApproved ? (
            <Check size={14} color="var(--accent-green)" aria-label="Onaylandi" />
          ) : (
            <Circle size={12} color="var(--text-muted)" style={{ opacity: 0.4 }} aria-label="Onaylanmadi" />
          )}
        </div>

        {/* Tags */}
        <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
          {scene.environment && (
            <Badge variant="info">{scene.environment}</Badge>
          )}
          {scene.shot_type && (
            <Badge variant="draft">{scene.shot_type}</Badge>
          )}
        </div>
      </div>
    </div>
  );
}
