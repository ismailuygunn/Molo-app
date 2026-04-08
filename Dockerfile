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
    fonts-liberation \
    fonts-dejavu-core \
    curl \
    && rm -rf /var/lib/apt/lists/*

# Install Montserrat font from GitHub
RUN mkdir -p /usr/share/fonts/truetype/montserrat \
    && curl -sL "https://raw.githubusercontent.com/JulietaUla/Montserrat/master/fonts/ttf/Montserrat-Bold.ttf" \
       -o /usr/share/fonts/truetype/montserrat/Montserrat-Bold.ttf \
    && curl -sL "https://raw.githubusercontent.com/JulietaUla/Montserrat/master/fonts/ttf/Montserrat-SemiBold.ttf" \
       -o /usr/share/fonts/truetype/montserrat/Montserrat-SemiBold.ttf \
    && curl -sL "https://raw.githubusercontent.com/JulietaUla/Montserrat/master/fonts/ttf/Montserrat-Regular.ttf" \
       -o /usr/share/fonts/truetype/montserrat/Montserrat-Regular.ttf \
    && fc-cache -f

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
RUN mkdir -p projects _voices

# Set env
ENV NODE_ENV=production
ENV NODE_OPTIONS="--max_old_space_size=512"
ENV PYTHONUNBUFFERED=1
ENV PORT=3000
ENV HOSTNAME=0.0.0.0

EXPOSE 3000

# Start Next.js
WORKDIR /app/studio
CMD ["npm", "start"]
