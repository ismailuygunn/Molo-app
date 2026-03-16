#!/bin/bash
# ═══════════════════════════════════════
# Molo Studio — Boot Script
# Seeds persistent volume from Docker image on first boot
# ═══════════════════════════════════════

PROJECTS_DIR="/app/projects"
SEED_DIR="/app/projects-seed"

# Check if volume is empty (only lost+found or empty)
file_count=$(find "$PROJECTS_DIR" -maxdepth 1 -mindepth 1 -not -name "lost+found" -not -name ".*" | wc -l)

if [ "$file_count" -eq 0 ] && [ -d "$SEED_DIR" ]; then
  echo "📦 First boot — seeding persistent volume from Docker image..."
  cp -r "$SEED_DIR"/* "$PROJECTS_DIR"/ 2>/dev/null || true
  seed_count=$(find "$PROJECTS_DIR" -maxdepth 1 -mindepth 1 -type d -not -name "lost+found" | wc -l)
  echo "✅ Seeded $seed_count projects into persistent volume"
else
  project_count=$(find "$PROJECTS_DIR" -maxdepth 1 -mindepth 1 -type d -not -name "lost+found" -not -name ".*" | wc -l)
  echo "📂 Volume has $project_count existing projects — skipping seed"
fi

# Start Next.js
echo "🚀 Starting MOLO Studio..."
cd /app/studio
exec npm start
