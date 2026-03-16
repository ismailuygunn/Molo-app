#!/bin/bash
# Molo Studio — Boot Script
PROJECTS_DIR="/app/projects"
SEED_DIR="/app/projects-seed"

# Seed in background (non-blocking)
if [ -d "$SEED_DIR" ]; then
  (
    echo "📦 Seeding volume in background..."
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
    echo "✅ Seed done: $(find $PROJECTS_DIR -type f | wc -l) files"
  ) &
fi

# Start Next.js (foreground, PID 1)
echo "🚀 Starting MOLO Studio..."
cd /app/studio
npm start
