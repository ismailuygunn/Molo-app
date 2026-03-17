# ═══════════════════════════════════════
# Molo Studio — Railway Deploy
# Node.js + Python + FFmpeg
# ═══════════════════════════════════════

# ── Stage 1: Build Next.js ──
FROM node:20-slim AS builder

ENV NODE_OPTIONS="--max_old_space_size=512"

WORKDIR /app/studio
COPY studio/package*.json ./
RUN npm install --prefer-offline --no-audit --no-fund

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
    fonts-montserrat \
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


# Create data directories
RUN mkdir -p projects _voices _images-generated _videos-raw _bgm

# Set env
ENV NODE_ENV=production
ENV PYTHONUNBUFFERED=1
ENV PORT=3000

EXPOSE 3000

# Set working directory to studio and start directly (proven working pattern)
WORKDIR /app/studio
CMD ["npm", "start"]
