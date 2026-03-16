#!/bin/bash
# ═══════════════════════════════════════
# Molo Studio — Boot Script
# Seeds persistent volume from Docker image
# ═══════════════════════════════════════

PROJECTS_DIR="/app/projects"
SEED_DIR="/app/projects-seed"

if [ -d "$SEED_DIR" ]; then
  echo "📦 Syncing seed data into persistent volume..."
  # Use cp -rn (no-clobber) to merge seed into volume without overwriting existing files
  # This safely fills in any missing files without destroying runtime-generated content
  cp -r --no-clobber "$SEED_DIR"/. "$PROJECTS_DIR"/ 2>/dev/null || \
    cp -rn "$SEED_DIR"/. "$PROJECTS_DIR"/ 2>/dev/null || \
    echo "⚠️ cp fallback: trying rsync-style merge" && \
    for dir in "$SEED_DIR"/*/; do
      proj=$(basename "$dir")
      mkdir -p "$PROJECTS_DIR/$proj"
      cp -rn "$dir"* "$PROJECTS_DIR/$proj/" 2>/dev/null || true
    done
  
  project_count=$(find "$PROJECTS_DIR" -maxdepth 1 -mindepth 1 -type d -not -name "lost+found" -not -name ".*" | wc -l)
  file_count=$(find "$PROJECTS_DIR" -type f | wc -l)
  echo "✅ Volume has $project_count projects, $file_count files"
else
  echo "⚠️ No seed directory found — skipping"
fi

# Start Next.js
echo "🚀 Starting MOLO Studio..."
cd /app/studio
exec npm start
