#!/bin/bash
# ═══════════════════════════════════════
# Molo Studio — Boot Script
# Seeds persistent volume from Docker image
# ═══════════════════════════════════════

PROJECTS_DIR="/app/projects"
SEED_DIR="/app/projects-seed"

if [ -d "$SEED_DIR" ]; then
  echo "📦 Syncing seed data into persistent volume..."
  
  # For each project in seed, copy files that don't exist on volume
  for proj_dir in "$SEED_DIR"/*/; do
    proj_name=$(basename "$proj_dir")
    target="$PROJECTS_DIR/$proj_name"
    mkdir -p "$target"
    
    # Use find + cp to copy each file individually (no-clobber)
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
  echo "✅ Volume: $project_count projects, $file_count files total"
else
  echo "⚠️ No seed directory found — skipping"
fi

# Start Next.js
echo "🚀 Starting MOLO Studio..."
cd /app/studio
exec npm start
