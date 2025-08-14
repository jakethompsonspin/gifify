# GIFify — Instagram/TikTok → GIF/MP4/WebM

A tiny web app + Node server that lets you paste an Instagram or TikTok post URL and returns a GIF under a target size. It can optionally trim the video, remove watermarks, and also generate MP4 and WebM versions.

> ⚠️ **Respect rights & platform Terms.** Only use this for content you own or have permission to download.

## Features

- **Paste TikTok or Instagram links** (posts/reels)
- Uses **yt‑dlp** to fetch the video
- Converts to **GIF** with an adaptive palette workflow, iteratively reducing width/FPS until the output fits under your size target
- **Trimming:** specify a start time and duration to extract a clip
- **Watermark removal:** crops a portion of the top and bottom of the video to hide TikTok/Instagram logos
- **Additional exports:** generate **MP4** and **WebM** alongside the GIF
- Simple, sleek front‑end with advanced options
- Serves the finished files with direct download links

## Requirements

- Node.js 18+
- `ffmpeg` and `ffprobe` in your PATH
- `yt-dlp` in your PATH

On macOS (Homebrew):

```bash
brew install ffmpeg yt-dlp
```

On Ubuntu/Debian:

```bash
sudo apt update
sudo apt install -y ffmpeg python3-pip
pip3 install -U yt-dlp
```

## Quick start

```bash
npm install
cp .env.example .env   # optional
npm run start
# open http://localhost:8080
```

## Docker

A minimal Docker image is provided.

```bash
docker build -t gifify .
docker run --rm -p 8080:8080 -e ALLOWED_ORIGINS=* gifify
# open http://localhost:8080
```

## Environment variables

- `PORT` (default `8080`)
- `MAX_GIF_MB` (default `50`)
- `DEFAULT_FPS` (default `12`)
- `DEFAULT_WIDTH` (default `480`)
- `ALLOWED_ORIGINS` (default `*`) for CORS
- `YTDLP_PATH`, `FFMPEG_PATH`, `FFPROBE_PATH` if not in PATH

## Notes & tips

- Very long or complex videos may not compress below the target while staying legible; the server will stop when it hits minimum thresholds (240px, 6fps).
- Watermark removal simply crops the top and bottom 8% of the frame — it works for many videos but may not remove every logo. Feel free to adjust the crop ratios in `utils/convert.js`.
- MP4/WebM exports use sensible compression defaults (CRF 28 for MP4, CRF 33 for VP9 WebM). You can change these in `utils/convert.js`.
- This project does **not** keep files long‑term. Add a cron or process to clean `output/` if you deploy publicly.
- Some Instagram posts require authentication or are region/age‑restricted. `yt‑dlp` may need cookies. See `yt‑dlp` docs for `--cookies-from-browser` usage; you can adapt `utils/download.js` accordingly.

## Legal

This code is for educational purposes. Ensure you have rights to download and convert any media. Comply with Instagram and TikTok Terms of Service and applicable law.