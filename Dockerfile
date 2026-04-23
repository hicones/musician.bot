# Stage 1: Build
FROM node:22-bullseye AS build

WORKDIR /app

# Install build dependencies for native addons (better-sqlite3, @discordjs/opus)
RUN apt-get update && apt-get install -y \
    python3 \
    make \
    g++ \
    && rm -rf /var/lib/apt/lists/*

COPY package*.json ./
RUN npm install

COPY . .
RUN npm run build

# Stage 2: Runtime
FROM node:22-slim AS runtime

WORKDIR /app

# Install runtime dependencies and build tools for native addons
RUN apt-get update && apt-get install -y \
    ffmpeg \
    python3 \
    python3-pip \
    make \
    g++ \
    && rm -rf /var/lib/apt/lists/*

# Install yt-dlp
RUN python3 -m pip install -U yt-dlp --break-system-packages

COPY package*.json ./
# Install only production dependencies (needs build tools for some native addons)
RUN npm install --omit=dev

# Copy compiled files from build stage
COPY --from=build /app/dist ./dist
COPY --from=build /app/assets ./assets

# Ensure the data directory exists
RUN mkdir -p data

# Run the bot
CMD ["npm", "start"]
