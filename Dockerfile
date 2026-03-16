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

# Copy scripts, config & project data
COPY scripts/ ./scripts/
COPY _config/ ./_config/
COPY projects/ ./projects/
COPY _reference/ ./_reference/
COPY _bgm/ ./_bgm/

# Copy .env if exists (Railway overrides with env vars)
COPY .env* ./

# Create data directories (will be populated at runtime)
RUN mkdir -p projects _voices _images-generated _videos-raw _reference _bgm

# Set env
ENV NODE_ENV=production
ENV PYTHONUNBUFFERED=1
ENV PORT=3000

EXPOSE 3000

WORKDIR /app/studio
CMD ["npm", "start"]
