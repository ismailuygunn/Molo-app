'use client';

import { useCallback } from 'react';
import { Check, RefreshCw, Image as ImageIcon } from 'lucide-react';
import { Button, Toggle } from '@/components/ui';
import { useStudioStore } from '@/store/studio';
import type { Scene, FrameRole } from '@/store/studio';

interface ImageApprovalPanelProps {
  projectId: string;
  scene: Scene;
  onRegenerate?: (sceneNumber: number, variantIndex: number) => void;
}

const FRAME_ROLES: { value: FrameRole; label: string }[] = [
  { value: 'first', label: 'Ilk Kare' },
  { value: 'last', label: 'Son Kare' },
  { value: 'auto', label: 'Otomatik' },
];

export function ImageApprovalPanel({ projectId, scene, onRegenerate }: ImageApprovalPanelProps) {
  const selectVariant = useStudioStore((s) => s.selectVariant);
  const setFrameRole = useStudioStore((s) => s.setFrameRole);
  const toggleMolo = useStudioStore((s) => s.toggleMolo);

  const handleSelect = useCallback(
    (variantId: string) => selectVariant(projectId, scene.scene, variantId),
    [projectId, scene.scene, selectVariant],
  );

  const handleFrameRole = useCallback(
    (role: FrameRole) => setFrameRole(projectId, scene.scene, role),
    [projectId, scene.scene, setFrameRole],
  );

  const handleToggleMolo = useCallback(
    () => toggleMolo(projectId, scene.scene),
    [projectId, scene.scene, toggleMolo],
  );

  const hasVariants = scene.imageVariants.length > 0;

  return (
    <section style={{ marginBottom: 24 }}>
      {/* Header */}
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        marginBottom: 16,
      }}>
        <h3 style={{
          fontSize: 16, fontWeight: 600, color: 'var(--text-primary)',
          display: 'flex', alignItems: 'center', gap: 8,
        }}>
          <ImageIcon size={18} color="var(--accent-teal)" />
          Sahne {scene.scene} — Gorsel Secimi
        </h3>
        {scene.selectedImageId && (
          <span style={{
            fontSize: 11, fontWeight: 600, color: 'var(--accent-green)',
            display: 'flex', alignItems: 'center', gap: 4,
          }}>
            <Check size={14} /> Secildi
          </span>
        )}
      </div>

      {/* Variant cards */}
      {hasVariants ? (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 16 }}>
          {scene.imageVariants.map((variant, idx) => {
            const isSelected = variant.id === scene.selectedImageId;
            return (
              <div
                key={variant.id}
                onClick={() => handleSelect(variant.id)}
                role="button"
                tabIndex={0}
                aria-label={`Varyant ${idx + 1}${isSelected ? ', secili' : ''}`}
                onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); handleSelect(variant.id); } }}
                style={{
                  position: 'relative', borderRadius: 'var(--radius-md)', overflow: 'hidden',
                  border: `2px solid ${isSelected ? 'var(--accent-teal)' : 'var(--border-subtle)'}`,
                  background: 'var(--bg-card)', cursor: 'pointer',
                  transition: 'all 0.2s ease',
                  boxShadow: isSelected ? 'var(--shadow-glow-teal)' : 'var(--shadow-card)',
                }}
              >
                {/* Image */}
                <div style={{
                  width: '100%', aspectRatio: '16/9', background: 'var(--bg-secondary)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden',
                }}>
                  {variant.url ? (
                    <img
                      src={variant.url}
                      alt={`Sahne ${scene.scene} varyant ${idx + 1}`}
                      style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                      loading="lazy"
                    />
                  ) : (
                    <ImageIcon size={32} color="var(--text-muted)" style={{ opacity: 0.3 }} />
                  )}
                </div>

                {/* Selected checkmark overlay */}
                {isSelected && (
                  <div style={{
                    position: 'absolute', top: 8, right: 8,
                    width: 28, height: 28, borderRadius: '50%',
                    background: 'var(--accent-teal)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    boxShadow: '0 2px 8px rgba(20, 184, 166, 0.4)',
                  }}>
                    <Check size={16} color="#fff" strokeWidth={3} />
                  </div>
                )}

                {/* Info bar */}
                <div style={{
                  padding: '10px 12px',
                  display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                }}>
                  <div>
                    <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)' }}>
                      Varyant {idx + 1}
                    </div>
                    {variant.score != null && (
                      <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2 }}>
                        QC: {variant.score}/10
                      </div>
                    )}
                  </div>
                  <div style={{ display: 'flex', gap: 6 }}>
                    <Button
                      variant="secondary"
                      size="sm"
                      onClick={(e) => { e.stopPropagation(); handleSelect(variant.id); }}
                      style={isSelected ? {
                        background: 'rgba(20, 184, 166, 0.1)',
                        borderColor: 'var(--accent-teal)',
                        color: 'var(--accent-teal)',
                      } : undefined}
                    >
                      Sec
                    </Button>
                    {onRegenerate && (
                      <Button
                        variant="ghost"
                        size="sm"
                        icon={<RefreshCw size={14} />}
                        onClick={(e) => { e.stopPropagation(); onRegenerate(scene.scene, idx); }}
                        aria-label={`Varyant ${idx + 1} yeniden olustur`}
                      />
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        <div style={{
          padding: 40, textAlign: 'center', color: 'var(--text-muted)',
          background: 'var(--bg-secondary)', borderRadius: 'var(--radius-md)',
          marginBottom: 16,
        }}>
          <ImageIcon size={32} style={{ opacity: 0.3, marginBottom: 8 }} />
          <div style={{ fontSize: 13 }}>Henuz gorsel uretilmedi</div>
        </div>
      )}

      {/* Frame role selector */}
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        flexWrap: 'wrap', gap: 12,
        padding: '12px 16px',
        background: 'var(--bg-secondary)', borderRadius: 'var(--radius-md)',
      }}>
        <fieldset style={{ border: 'none', display: 'flex', alignItems: 'center', gap: 12 }}>
          <legend style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-secondary)', marginBottom: 0, float: 'left', marginRight: 12 }}>
            Kare Rolu
          </legend>
          {FRAME_ROLES.map((role) => (
            <label
              key={role.value}
              style={{ display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer', fontSize: 13 }}
            >
              <input
                type="radio"
                name={`frame-role-${scene.scene}`}
                value={role.value}
                checked={scene.frameRole === role.value}
                onChange={() => handleFrameRole(role.value)}
                style={{ accentColor: 'var(--accent-teal)' }}
              />
              <span style={{ color: 'var(--text-primary)', fontWeight: scene.frameRole === role.value ? 600 : 400 }}>
                {role.label}
              </span>
            </label>
          ))}
        </fieldset>

        <Toggle
          checked={scene.withMolo}
          onChange={handleToggleMolo}
          label={scene.withMolo ? 'Molo ile' : 'Sadece ortam'}
        />
      </div>
    </section>
  );
}
