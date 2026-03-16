"""
Molo İçerik Üretim Sistemi — FFmpeg Sahne Bazlı Kurgu
Video klipleri birleştir, ses ekle, geçişler uygula.
"""

import os
import sys
import json
import subprocess
import shutil
from pathlib import Path
from datetime import datetime

# ─── Merkezi config'den import ───
from config import (
    BASE_DIR, PROJECTS_DIR, FFMPEG,
    OUTPUT_WIDTH, OUTPUT_HEIGHT, OUTPUT_FPS,
    get_normalize_filter
)


def check_ffmpeg():
    """FFmpeg yüklü mü kontrol et."""
    if not os.path.exists(FFMPEG):
        print(f"❌ FFmpeg bulunamadı: {FFMPEG}")
        sys.exit(1)
    return True


def create_project(name):
    """Yeni proje klasörü oluştur."""
    date_prefix = datetime.now().strftime("%Y-%m-%d")
    project_dir = PROJECTS_DIR / f"{date_prefix}_{name}"
    
    for subdir in ["scenes", "audio", "subtitles", "draft", "final"]:
        (project_dir / subdir).mkdir(parents=True, exist_ok=True)
    
    # Brief şablonu
    brief_path = project_dir / "brief.md"
    if not brief_path.exists():
        brief_path.write_text(f"""# {name} — İçerik Brief'i

## Genel Bilgi
- **Proje:** {name}
- **Tarih:** {date_prefix}
- **Dil:** Almanca (DE) + İngilizce altyazı
- **Format:** Studio'da seçilen içerik türüne göre (9:16 / 16:9)
- **Süre hedefi:** ~15-30 saniye

## Senaryo

### Sahne 1 — Giriş (0:00-0:05)
- **Görsel:** Molo ekrana giriyor / sabit duruyor
- **Ses:** Selamlama
- **Hologram:** Kapalı → açılıyor

### Sahne 2 — Ana İçerik (0:05-0:20)
- **Görsel:** Molo konuşuyor, hologram açık
- **Ses:** Ana mesaj
- **Hologram:** İçerik gösteriyor

### Sahne 3 — Kapanış (0:20-0:25)
- **Görsel:** Molo el sallıyor
- **Ses:** Veda
- **Hologram:** Kapanıyor

## Sahne Metinleri (ElevenLabs için)
```json
[
  {{"scene": 1, "text": "Selamlama metni buraya"}},
  {{"scene": 2, "text": "Ana içerik metni buraya"}},
  {{"scene": 3, "text": "Veda metni buraya"}}
]
```
""")
    
    print(f"📁 Proje oluşturuldu: {project_dir}")
    return project_dir


def concat_videos(video_files, output_path, transition="fade", transition_duration=0.5):
    """
    Video kliplerini geçişlerle birleştir.
    
    Args:
        video_files: list of video file paths (sıralı)
        output_path: çıktı dosya yolu
        transition: "fade", "dissolve", veya "cut"
        transition_duration: geçiş süresi (saniye)
    """
    check_ffmpeg()
    
    if len(video_files) == 0:
        print("❌ Video dosyası yok!")
        return None
    
    if len(video_files) == 1:
        # Tek video, sadece kopyala
        shutil.copy2(video_files[0], output_path)
        print(f"✅ Tek video kopyalandı: {output_path}")
        return output_path
    
    print(f"\n🎬 {len(video_files)} video birleştiriliyor...")
    
    if transition == "cut":
        # Basit birleştirme (geçiş yok)
        list_file = Path(output_path).parent / "concat_list.txt"
        with open(list_file, "w") as f:
            for vf in video_files:
                f.write(f"file '{vf}'\n")
        
        cmd = [
            FFMPEG, "-y", "-f", "concat", "-safe", "0",
            "-i", str(list_file), "-c", "copy", str(output_path)
        ]
    else:
        # Fade/dissolve geçişli birleştirme
        inputs = []
        for vf in video_files:
            inputs.extend(["-i", str(vf)])
        
        # Karmaşık filter graph oluştur
        n = len(video_files)
        filter_parts = []
        
        # Her videoyu normalize et (aynı boyut + fps)
        for i in range(n):
            filter_parts.append(f"[{i}:v]scale={OUTPUT_WIDTH}:{OUTPUT_HEIGHT},fps=30,format=yuv420p[v{i}];")
        
        # Geçişler (xfade)
        if n == 2:
            # İlk videonun süresini al
            dur = get_video_duration(video_files[0])
            offset = max(0, dur - transition_duration)
            filter_parts.append(
                f"[v0][v1]xfade=transition=fade:duration={transition_duration}:offset={offset}[outv];"
            )
            audio_filter = f"[0:a][1:a]acrossfade=d={transition_duration}[outa]"
            filter_parts.append(audio_filter)
        else:
            # Çoklu video: zincirleme xfade
            prev = "v0"
            for i in range(1, n):
                dur = get_video_duration(video_files[i-1])
                offset = max(0, dur - transition_duration)
                out_label = f"xf{i}" if i < n-1 else "outv"
                filter_parts.append(
                    f"[{prev}][v{i}]xfade=transition=fade:duration={transition_duration}:offset={offset}[{out_label}];"
                )
                prev = out_label
            # Audio: basit concat
            audio_inputs = "".join(f"[{i}:a]" for i in range(n))
            filter_parts.append(f"{audio_inputs}concat=n={n}:v=0:a=1[outa]")
        
        filter_graph = "\n".join(filter_parts)
        cmd = [FFMPEG, "-y"] + inputs + [
            "-filter_complex", filter_graph,
            "-map", "[outv]", "-map", "[outa]",
            "-c:v", "libx264", "-preset", "medium", "-crf", "18",
            "-c:a", "aac", "-b:a", "192k",
            str(output_path)
        ]
    
    try:
        result = subprocess.run(cmd, capture_output=True, text=True, timeout=300)
        if result.returncode == 0:
            print(f"✅ Birleşik video: {output_path}")
            return str(output_path)
        else:
            print(f"❌ FFmpeg hatası:\n{result.stderr[-500:]}")
            return None
    except Exception as e:
        print(f"❌ Hata: {e}")
        return None


def add_audio_to_video(video_path, audio_path, output_path, 
                        bg_music_path=None, bg_volume=0.15):
    """
    Videoya ses + opsiyonel arka plan müziği ekle.
    
    Args:
        video_path: video dosyası
        audio_path: ana ses (Molo konuşması)
        output_path: çıktı
        bg_music_path: arka plan müziği (opsiyonel)
        bg_volume: müzik ses seviyesi (0.0-1.0)
    """
    check_ffmpeg()
    
    if bg_music_path and os.path.exists(bg_music_path):
        # Video + ses + arka plan müziği
        cmd = [
            FFMPEG, "-y",
            "-i", str(video_path),
            "-i", str(audio_path),
            "-i", str(bg_music_path),
            "-filter_complex",
            f"[1:a]volume=1.0[voice];[2:a]volume={bg_volume}[music];[voice][music]amix=inputs=2:duration=first[outa]",
            "-map", "0:v", "-map", "[outa]",
            "-c:v", "copy", "-c:a", "aac", "-b:a", "192k",
            "-shortest",
            str(output_path)
        ]
    else:
        # Video + ses
        cmd = [
            FFMPEG, "-y",
            "-i", str(video_path),
            "-i", str(audio_path),
            "-map", "0:v", "-map", "1:a",
            "-c:v", "copy", "-c:a", "aac", "-b:a", "192k",
            "-shortest",
            str(output_path)
        ]
    
    try:
        result = subprocess.run(cmd, capture_output=True, text=True, timeout=120)
        if result.returncode == 0:
            print(f"✅ Ses eklenmiş video: {output_path}")
            return str(output_path)
        else:
            print(f"❌ FFmpeg hatası:\n{result.stderr[-300:]}")
            return None
    except Exception as e:
        print(f"❌ Hata: {e}")
        return None


def add_logo_overlay(video_path, logo_path, output_path, 
                     position="bottom_right", opacity=0.7, size=80):
    """Videoya logo watermark ekle."""
    check_ffmpeg()
    
    pos_map = {
        "bottom_right": f"overlay=W-w-20:H-h-20",
        "bottom_left": f"overlay=20:H-h-20",
        "top_right": f"overlay=W-w-20:20",
        "top_left": f"overlay=20:20",
    }
    overlay_pos = pos_map.get(position, pos_map["bottom_right"])
    
    cmd = [
        FFMPEG, "-y",
        "-i", str(video_path),
        "-i", str(logo_path),
        "-filter_complex",
        f"[1:v]scale={size}:-1,format=rgba,colorchannelmixer=aa={opacity}[logo];[0:v][logo]{overlay_pos}[outv]",
        "-map", "[outv]", "-map", "0:a?",
        "-c:v", "libx264", "-preset", "fast", "-crf", "18",
        "-c:a", "copy",
        str(output_path)
    ]
    
    try:
        result = subprocess.run(cmd, capture_output=True, text=True, timeout=120)
        if result.returncode == 0:
            print(f"✅ Logo eklendi: {output_path}")
            return str(output_path)
        else:
            print(f"❌ FFmpeg hatası:\n{result.stderr[-300:]}")
            return None
    except Exception as e:
        print(f"❌ Hata: {e}")
        return None


def get_video_duration(video_path):
    """Video süresini saniye cinsinden al (ffmpeg kullanarak)."""
    cmd = [FFMPEG, "-i", str(video_path), "-f", "null", "-"]
    try:
        result = subprocess.run(cmd, capture_output=True, text=True, timeout=15)
        for line in result.stderr.split('\n'):
            if 'Duration:' in line:
                time_str = line.split('Duration:')[1].split(',')[0].strip()
                h, m, s = time_str.split(':')
                return float(h)*3600 + float(m)*60 + float(s)
        return 5.0
    except:
        return 5.0


if __name__ == "__main__":
    import argparse
    
    parser = argparse.ArgumentParser(description="Molo FFmpeg Kurgu")
    parser.add_argument("--create-project", type=str, help="Yeni proje oluştur")
    parser.add_argument("--concat", nargs="+", help="Video dosyalarını birleştir")
    parser.add_argument("--output", type=str, help="Çıktı dosya yolu")
    parser.add_argument("--transition", type=str, default="fade", choices=["fade", "cut"])
    
    args = parser.parse_args()
    
    if args.create_project:
        create_project(args.create_project)
    elif args.concat and args.output:
        concat_videos(args.concat, args.output, transition=args.transition)
