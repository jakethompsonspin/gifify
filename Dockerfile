FROM node:20-slim

# Install ffmpeg and yt‑dlp
RUN apt-get update && apt-get install -y --no-install-recommends \
    ffmpeg \
    python3 \
    python3-pip \
  && pip3 install -U yt-dlp \
  && rm -rf /var/lib/apt/lists/*

WORKDIR /app
COPY package.json package-lock.json* ./
RUN npm install --omit=dev || npm install
COPY . .

ENV PORT=8080
EXPOSE 8080
CMD ["npm", "start"]