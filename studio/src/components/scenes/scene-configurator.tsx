'use client';

import { useCallback } from 'react';
import { Camera, Copy, Check } from 'lucide-react';
import { useState } from 'react';
import { SelectGrid, Button } from '@/components/ui';
import { useStudioStore } from '@/store/studio';
import type { Scene, ShotType } from '@/store/studio';

interface SceneConfiguratorProps {
  scene: Scene;
  projectId: string;
  onSave?: () => void;
}

const SHOT_OPTIONS: { id: ShotType; label: string; description: string }[] = [
  { id: 'wide', label: 'Genis', description: 'Tam ortam gorunumu' },
  { id: 'medium', label: 'Orta', description: 'Bel ustu cekim' },
  { id: 'medium-close', label: 'Yakin Orta', description: 'Gogus ustu cekim' },
  { id: 'close', label: 'Yakin', description: 'Yuz detayi' },
];

export function SceneConfigurator({ scene, projectId, onSave }: SceneConfiguratorProps) {
  const updateScene = useStudioStore((s) => s.updateScene);
  const [copied, setCopied] = useState(false);
  const [emotionNote, setEmotionNote] = useState(scene.emotion_note);

  const handleShotType = useCallback(
    (value: ShotType) => {
      updateScene(projectId, scene.scene, { shot_type: value });
    },
    [projectId, scene.scene, updateScene],
  );

  const handleEmotionBlur = useCallback(() => {
    if (emotionNote !== scene.emotion_note) {
      updateScene(projectId, scene.scene, { emotion_note: emotionNote });
      onSave?.();
    }
  }, [emotionNote, scene.emotion_note, projectId, scene.scene, updateScene, onSave]);

  const handleCopyText = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(scene.text_de);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Clipboard API may not be available
    }
  }, [scene.text_de]);

  const currentShotType = SHOT_OPTIONS.find((o) => o.id === scene.shot_type)
    ? (scene.shot_type as ShotType)
    : null;

  return (
    <section style={{ marginBottom: 24 }}>
      <h4 style={{
        fontSize: 14, fontWeight: 600, color: 'var(--text-secondary)',
        marginBottom: 14, display: 'flex', alignItems: 'center', gap: 6,
      }}>
        <Camera size={16} color="var(--accent-teal)" />
        Sahne Ayarlari
      </h4>

      {/* Shot type */}
      <div style={{ marginBottom: 16 }}>
        <label className="label">Cekim Tipi</label>
        <SelectGrid
          options={SHOT_OPTIONS}
          value={currentShotType}
          onChange={handleShotType}
          columns={4}
        />
      </div>

      {/* Environment (read-only) */}
      {scene.environment && (
        <div style={{ marginBottom: 16 }}>
          <label className="label">Ortam</label>
          <div style={{
            padding: '10px 14px', background: 'var(--bg-secondary)',
            borderRadius: 'var(--radius-md)', fontSize: 13,
            color: 'var(--text-secondary)', border: '1px solid var(--border-subtle)',
          }}>
            {scene.environment}
          </div>
        </div>
      )}

      {/* Emotion note (editable) */}
      <div style={{ marginBottom: 16 }}>
        <label className="label">Duygu Notu</label>
        <input
          className="input"
          type="text"
          value={emotionNote}
          onChange={(e) => setEmotionNote(e.target.value)}
          onBlur={handleEmotionBlur}
          placeholder="Sahnenin duygusal tonu..."
        />
      </div>

      {/* Voice direction (read-only) */}
      {scene.voice_direction && (
        <div style={{ marginBottom: 16 }}>
          <label className="label">Ses Yonlendirmesi</label>
          <div style={{
            padding: '10px 14px', background: 'var(--bg-secondary)',
            borderRadius: 'var(--radius-md)', fontSize: 13,
            color: 'var(--text-secondary)', border: '1px solid var(--border-subtle)',
          }}>
            {scene.voice_direction}
          </div>
        </div>
      )}

      {/* Scene text (read-only + copy) */}
      <div>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
          <label className="label" style={{ marginBottom: 0 }}>Sahne Metni</label>
          <Button
            variant="ghost"
            size="sm"
            icon={copied ? <Check size={12} color="var(--accent-green)" /> : <Copy size={12} />}
            onClick={handleCopyText}
            aria-label="Metni kopyala"
          >
            {copied ? 'Kopyalandi' : 'Kopyala'}
          </Button>
        </div>
        <div style={{
          padding: '12px 14px', background: 'var(--bg-secondary)',
          borderRadius: 'var(--radius-md)', fontSize: 13,
          color: 'var(--text-primary)', lineHeight: 1.6,
          border: '1px solid var(--border-subtle)',
          whiteSpace: 'pre-wrap',
        }}>
          {scene.text_de || 'Metin yok'}
        </div>
      </div>
    </section>
  );
}
