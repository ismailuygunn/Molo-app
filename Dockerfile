# ═══════════════════════════════════════
# Molo Studio — Railway Deploy
# Node.js + Python + FFmpeg
# ═══════════════════════════════════════

# ── Stage 1: Build Next.js ──
FROM node:20-slim AS builder

WORKDIR /app/studio
COPY studio/package*.json ./
RUN npm ci --prefer-offline

COPY studio/ ./
RUN npm run build


# ── Stage 2: Runtime ──
FROM node:20-slim

# Install Python + FFmpeg
RUN apt-get update && apt-get install -y --no-install-recommends \
    python3 \
    python3-pip \
    python3-venv \
    ffmpeg \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Python deps
COPY requirements.txt ./
RUN python3 -m pip install --break-system-packages --no-cache-dir -r requirements.txt

# Copy built Next.js app
COPY --from=builder /app/studio/.next ./studio/.next
COPY --from=builder /app/studio/node_modules ./studio/node_modules
COPY --from=builder /app/studio/package.json ./studio/package.json
COPY --from=builder /app/studio/public ./studio/public

# Copy scripts, config & reference data
COPY scripts/ ./scripts/
COPY _config/ ./_config/
COPY _reference/ ./_reference/

# Seed data: projects are copied to projects-seed/ (NOT projects/)
# The boot script will copy them to the persistent volume on first boot
COPY projects/ ./projects-seed/

# Boot script
COPY start.sh ./start.sh
RUN chmod +x start.sh

# Create data directories (will be populated at runtime)
RUN mkdir -p projects _voices _images-generated _videos-raw _bgm

# Set env
ENV NODE_ENV=production
ENV PYTHONUNBUFFERED=1
ENV PORT=3000

EXPOSE 3000

# Start the app — shell form for reliable cd
CMD cd /app/studio && npm start
