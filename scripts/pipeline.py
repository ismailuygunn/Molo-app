"""
Molo İçerik Üretim Sistemi — Ana Pipeline Orkestrasyonu
Tek komutla: brief → ses → video → kurgu → altyazı → final
"""

import os
import sys
import json
import shutil
from pathlib import Path
from datetime import datetime

from dotenv import load_dotenv
load_dotenv(Path(__file__).parent.parent / ".env")

# Yerel modüller
from generate_voice import generate_voice
from generate_video import create_image_to_video, check_video_status
from compose_edit import create_project, concat_videos, add_audio_to_video, add_logo_overlay
from add_subtitles import create_srt, burn_subtitles, create_dual_subtitles

BASE_DIR = Path(__file__).parent.parent
REFERENCE_DIR = BASE_DIR / "_reference"
ERROR_LOG = BASE_DIR / "_config" / "error-log.md"


class MoloPipeline:
    """Molo içerik üretim pipeline'ı."""
    
    def __init__(self, project_name, lang="de"):
        self.project_name = project_name
        self.lang = lang
        self.project_dir = None
        self.scenes = []
        self.audio_files = []
        self.video_files = []
        self.video_task_ids = []
        
    def step_1_create_project(self):
        """Adım 1: Proje klasörünü oluştur."""
        print(f"\n{'='*60}")
        print(f"📁 ADIM 1: Proje Oluşturma — {self.project_name}")
        print(f"{'='*60}")
        
        self.project_dir = create_project(self.project_name)
        return self.project_dir
    
    def step_2_load_brief(self, scenes=None, scenes_file=None):
        """Adım 2: Senaryo/sahne planını yükle."""
        print(f"\n{'='*60}")
        print(f"🎬 ADIM 2: Senaryo Yükleme")
        print(f"{'='*60}")
        
        if scenes:
            self.scenes = scenes
        elif scenes_file:
            with open(scenes_file) as f:
                self.scenes = json.load(f)
        else:
            brief_path = self.project_dir / "brief.md"
            print(f"\n📝 Brief dosyası: {brief_path}")
            print("   Lütfen brief'i doldurun ve scenes JSON'ını hazırlayın.")
            print("   Hazır olunca scenes_file parametresiyle tekrar çağırın.")
            return False
        
        print(f"\n   {len(self.scenes)} sahne yüklendi:")
        for s in self.scenes:
            print(f"   Sahne {s['scene']}: \"{s['text'][:50]}...\"")
        
        # Sahne dosyasını projeye kaydet
        scenes_path = self.project_dir / "scenes" / "scenes.json"
        with open(scenes_path, "w", encoding="utf-8") as f:
            json.dump(self.scenes, f, ensure_ascii=False, indent=2)
        
        return True
    
    def step_3_generate_voices(self, dry_run=False):
        """Adım 3: ElevenLabs ile seslendirme üret."""
        print(f"\n{'='*60}")
        print(f"🎙️ ADIM 3: Seslendirme (ElevenLabs)")
        print(f"{'='*60}")
        
        self.audio_files = generate_voice(
            scenes=self.scenes,
            lang=self.lang,
            project_name=self.project_name,
            dry_run=dry_run
        )
        
        if self.audio_files:
            # Proje audio klasörüne kopyala
            for af in self.audio_files:
                dest = self.project_dir / "audio" / Path(af).name
                shutil.copy2(af, dest)
            print(f"\n   {len(self.audio_files)} ses dosyası üretildi")
        
        return self.audio_files
    
    def step_4_generate_videos(self, reference="front.jpeg", 
                                duration="5", dry_run=False):
        """Adım 4: Kling ile sahne videoları üret."""
        print(f"\n{'='*60}")
        print(f"🎥 ADIM 4: Video Üretimi (Kling)")
        print(f"{'='*60}")
        
        ref_path = REFERENCE_DIR / reference
        if not ref_path.exists():
            print(f"❌ Referans görsel bulunamadı: {ref_path}")
            return []
        
        self.video_task_ids = []
        
        for scene in self.scenes:
            scene_prompt = scene.get("video_prompt", 
                f"Molo stands facing the camera. {scene['text']}")
            
            print(f"\n--- Sahne {scene['scene']} ---")
            task_id = create_image_to_video(
                reference_image=str(ref_path),
                scene_prompt=scene_prompt,
                duration=duration,
                aspect_ratio="9:16",
                dry_run=dry_run
            )
            
            if task_id:
                self.video_task_ids.append({
                    "scene": scene["scene"],
                    "task_id": task_id
                })
        
        # Task ID'leri kaydet
        if self.video_task_ids:
            tasks_path = self.project_dir / "scenes" / "video_tasks.json"
            with open(tasks_path, "w") as f:
                json.dump(self.video_task_ids, f, indent=2)
            print(f"\n📋 Video görevleri kaydedildi: {tasks_path}")
            print(f"⏳ Videolar hazırlanıyor. Kontrol için:")
            print(f"   python generate_video.py --check TASK_ID")
        
        return self.video_task_ids
    
    def step_5_download_videos(self):
        """Adım 5: Hazır videoları indir."""
        print(f"\n{'='*60}")
        print(f"⬇️ ADIM 5: Video İndirme")
        print(f"{'='*60}")
        
        tasks_path = self.project_dir / "scenes" / "video_tasks.json"
        if tasks_path.exists():
            with open(tasks_path) as f:
                self.video_task_ids = json.load(f)
        
        self.video_files = []
        for task in self.video_task_ids:
            path = check_video_status(task["task_id"])
            if path:
                dest = self.project_dir / "scenes" / f"scene_{task['scene']:02d}.mp4"
                shutil.copy2(path, dest)
                self.video_files.append(str(dest))
        
        return self.video_files
    
    def step_6_compose_edit(self, bg_music_path=None):
        """Adım 6: FFmpeg ile kurgu."""
        print(f"\n{'='*60}")
        print(f"✂️ ADIM 6: Kurgu (FFmpeg)")
        print(f"{'='*60}")
        
        if not self.video_files:
            # Scenes klasöründen videoları topla
            scenes_dir = self.project_dir / "scenes"
            self.video_files = sorted([
                str(f) for f in scenes_dir.glob("scene_*.mp4")
            ])
        
        if not self.video_files:
            print("❌ Video dosyası bulunamadı. Önce videoları indirin.")
            return None
        
        draft_path = self.project_dir / "draft" / "draft_v1.mp4"
        
        # Videoları birleştir
        concat_result = concat_videos(
            self.video_files, str(draft_path), transition="fade"
        )
        
        if concat_result and self.audio_files:
            # Birleşik sesi ekle
            with_audio = self.project_dir / "draft" / "draft_v1_audio.mp4"
            # Sesleri birleştir (basit concat)
            # TODO: Sahne zamanlamalarına göre sesleri eşle
            add_audio_to_video(
                draft_path, self.audio_files[0], str(with_audio),
                bg_music_path=bg_music_path
            )
        
        return str(draft_path)
    
    def step_7_add_subtitles(self, dual=True):
        """Adım 7: Altyazı ekle."""
        print(f"\n{'='*60}")
        print(f"🔤 ADIM 7: Altyazı")
        print(f"{'='*60}")
        
        draft_path = self.project_dir / "draft" / "draft_v1_audio.mp4"
        if not draft_path.exists():
            draft_path = self.project_dir / "draft" / "draft_v1.mp4"
        
        if not draft_path.exists():
            print("❌ Draft video bulunamadı.")
            return None
        
        final_path = self.project_dir / "final" / f"molo_{self.project_name}_final.mp4"
        
        if dual:
            result = create_dual_subtitles(
                str(draft_path), self.scenes, self.lang, str(final_path)
            )
        else:
            srt_path = self.project_dir / "subtitles" / "subs_en.srt"
            create_srt(self.scenes, str(srt_path), translate_from=self.lang)
            result = burn_subtitles(str(draft_path), str(srt_path), str(final_path))
        
        if result:
            print(f"\n🎉 FINAL VIDEO HAZIR: {final_path}")
        
        return result
    
    def run_full_pipeline(self, scenes, dry_run=False, bg_music=None):
        """
        Tam pipeline'ı çalıştır.
        
        dry_run=True: Validasyon + preview, API çağrısı yok
        dry_run=False: Tam üretim
        """
        print(f"\n{'#'*60}")
        print(f"# MOLO İÇERİK ÜRETİM PİPELINE'I")
        print(f"# Proje: {self.project_name}")
        print(f"# Dil: {self.lang}")
        print(f"# Mod: {'DRY RUN (ücretsiz)' if dry_run else 'CANLI ÜRETİM (💰)'}")
        print(f"{'#'*60}")
        
        # Adım 1: Proje
        self.step_1_create_project()
        
        # Adım 2: Senaryo
        self.step_2_load_brief(scenes=scenes)
        
        # Adım 3: Ses
        self.step_3_generate_voices(dry_run=dry_run)
        
        # Adım 4: Video
        self.step_4_generate_videos(dry_run=dry_run)
        
        if dry_run:
            print(f"\n{'='*60}")
            print(f"🏁 DRY RUN TAMAMLANDI — Token harcanmadı!")
            print(f"   Tam üretim için dry_run=False ile tekrar çalıştırın")
            print(f"{'='*60}")
            return
        
        print(f"\n{'='*60}")
        print(f"⏳ Videolar üretiliyor. Hazır olunca şu adımları çalıştırın:")
        print(f"   pipeline.step_5_download_videos()")
        print(f"   pipeline.step_6_compose_edit()")
        print(f"   pipeline.step_7_add_subtitles()")
        print(f"{'='*60}")


# ─── CLI ───
if __name__ == "__main__":
    import argparse
    
    parser = argparse.ArgumentParser(description="Molo Ana Pipeline")
    parser.add_argument("--project", type=str, required=True, help="Proje adı")
    parser.add_argument("--lang", type=str, default="de", choices=["de", "tr", "en"])
    parser.add_argument("--scenes-file", type=str, help="Sahne JSON dosyası")
    parser.add_argument("--dry-run", action="store_true", help="Sadece validasyon")
    parser.add_argument("--step", type=int, help="Belirli bir adımı çalıştır (1-7)")
    
    args = parser.parse_args()
    
    pipeline = MoloPipeline(args.project, lang=args.lang)
    
    if args.scenes_file:
        with open(args.scenes_file) as f:
            scenes = json.load(f)
    else:
        # Demo sahneler
        scenes = [
            {
                "scene": 1, 
                "text": "Hallo! Ich bin Molo, euer Zahnfreund bei Istadental!",
                "video_prompt": "Molo stands facing the camera and slowly raises one hand in a gentle wave.",
                "start": 0.0, "end": 4.0
            },
            {
                "scene": 2, 
                "text": "Willkommen in unserer Klinik. Hier kümmern wir uns um euer schönstes Lächeln.",
                "video_prompt": "Molo faces camera, hologram cone projects a bright display showing a sparkling tooth icon.",
                "start": 4.5, "end": 9.5
            },
            {
                "scene": 3, 
                "text": "Bis bald! Euer Molo.",
                "video_prompt": "Molo waves goodbye, hologram gently dims and closes. Soft blue light fades.",
                "start": 10.0, "end": 13.0
            },
        ]
    
    if args.step:
        pipeline.step_1_create_project()
        pipeline.step_2_load_brief(scenes=scenes)
        
        if args.step >= 3:
            pipeline.step_3_generate_voices(dry_run=args.dry_run)
        if args.step >= 4:
            pipeline.step_4_generate_videos(dry_run=args.dry_run)
        if args.step >= 5:
            pipeline.step_5_download_videos()
        if args.step >= 6:
            pipeline.step_6_compose_edit()
        if args.step >= 7:
            pipeline.step_7_add_subtitles()
    else:
        pipeline.run_full_pipeline(scenes, dry_run=args.dry_run)
