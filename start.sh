#!/bin/bash
# ═══════════════════════════════════════
# Molo Studio — Boot Script
# Start app first, seed volume in background
# ═══════════════════════════════════════

PROJECTS_DIR="/app/projects"
SEED_DIR="/app/projects-seed"

# ── Background seed ──
seed_volume() {
  if [ ! -d "$SEED_DIR" ]; then
    echo "⚠️ No seed directory — skipping"
    return
  fi
  
  echo "📦 Background: seeding persistent volume..."
  for proj_dir in "$SEED_DIR"/*/; do
    proj_name=$(basename "$proj_dir")
    target="$PROJECTS_DIR/$proj_name"
    mkdir -p "$target"
    
    cd "$proj_dir"
    find . -type f | while read -r file; do
      target_file="$target/$file"
      if [ ! -f "$target_file" ]; then
        mkdir -p "$(dirname "$target_file")"
        cp "$file" "$target_file"
      fi
    done
  done
  
  project_count=$(find "$PROJECTS_DIR" -maxdepth 1 -mindepth 1 -type d -not -name "lost+found" -not -name ".*" | wc -l)
  file_count=$(find "$PROJECTS_DIR" -type f | wc -l)
  echo "✅ Seed complete: $project_count projects, $file_count files"
}

# Run seed in background so app starts IMMEDIATELY
seed_volume &

# Start Next.js right away (don't wait for seed)
echo "🚀 Starting MOLO Studio..."
cd /app/studio
exec npm start
