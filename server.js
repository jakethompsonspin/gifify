import express from 'express';
import bodyParser from 'body-parser';
import morgan from 'morgan';
import cors from 'cors';
import path from 'path';
import { fileURLToPath } from 'url';
import { nanoid } from 'nanoid';
import dotenv from 'dotenv';
import fs from 'fs';

import { downloadVideo } from './utils/download.js';
import { convertToGif, convertToVideo } from './utils/convert.js';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 8080;

app.use(morgan('dev'));
app.use(bodyParser.json({ limit: '2mb' }));

// Configure CORS
const allowedOrigins = (process.env.ALLOWED_ORIGINS || '*').split(',').map(s => s.trim());
app.use(cors({
  origin: (origin, cb) => {
    if (!origin || allowedOrigins.includes('*') || allowedOrigins.includes(origin)) return cb(null, true);
    return cb(new Error('Not allowed by CORS'));
  }
}));

// Serve static files
app.use('/', express.static(path.join(__dirname, 'public')));
app.use('/output', express.static(path.join(__dirname, 'output'), {
  setHeaders(res) {
    res.set('Cache-Control', 'public, max-age=31536000, immutable');
  }
}));

function isSupportedLink(urlStr) {
  try {
    const u = new URL(urlStr);
    const host = u.hostname.toLowerCase();
    return (
      host.includes('tiktok.com') ||
      host.includes('instagram.com') ||
      host.includes('cdninstagram') ||
      host.includes('cdn-')
    );
  } catch {
    return false;
  }
}

app.post('/api/convert', async (req, res) => {
  const { url, targetSizeMB, maxWidth, fps, mute, startTime, duration, removeWatermark, exportMp4, exportWebm } = req.body || {};
  if (!url || !isSupportedLink(url)) {
    return res.status(400).json({ ok: false, error: 'Please provide a valid Instagram or TikTok URL.' });
  }
  const id = nanoid(8);
  const outDir = path.join(__dirname, 'output');
  const tmpDir = path.join(__dirname, 'tmp');
  if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true });
  if (!fs.existsSync(tmpDir)) fs.mkdirSync(tmpDir, { recursive: true });

  const maxMB = Number(targetSizeMB) > 0 ? Number(targetSizeMB) : Number(process.env.MAX_GIF_MB || 50);
  const width = Number(maxWidth) > 0 ? Number(maxWidth) : Number(process.env.DEFAULT_WIDTH || 480);
  const frameRate = Number(fps) > 0 ? Number(fps) : Number(process.env.DEFAULT_FPS || 12);
  const shouldMute = mute !== false;

  // Start/duration: allow null or empty string; treat empty string as null
  const start = startTime && String(startTime).trim() !== '' ? String(startTime).trim() : null;
  const dur = duration && Number(duration) > 0 ? Number(duration) : null;
  const rmWatermark = !!removeWatermark;
  const exportMp4Flag = exportMp4 === undefined ? true : !!exportMp4;
  const exportWebmFlag = exportWebm === undefined ? true : !!exportWebm;

  let inputPath = '';
  const gifPath = path.join(outDir, `${id}.gif`);
  const mp4Path = path.join(outDir, `${id}.mp4`);
  const webmPath = path.join(outDir, `${id}.webm`);
  let info = {};
  try {
    // Download video
    const dl = await downloadVideo(url, tmpDir, id, shouldMute);
    inputPath = dl.file;
    info = dl.info;
    // Convert to GIF
    const convGif = await convertToGif({
      input: inputPath,
      output: gifPath,
      maxMB: maxMB,
      startWidth: width,
      startFps: frameRate,
      startTime: start,
      duration: dur,
      removeWatermark: rmWatermark
    });
    const gifStats = fs.statSync(gifPath);
    const gifSizeMB = (gifStats.size / (1024 * 1024)).toFixed(2);
    const response = {
      ok: true,
      id,
      source: {
        url,
        title: info.title || null,
        uploader: info.uploader || null,
        duration: info.duration || null
      },
      gif: {
        url: `/output/${path.basename(gifPath)}`,
        sizeMB: Number(gifSizeMB),
        width: convGif.usedWidth,
        fps: convGif.usedFps
      },
      notes: convGif.notes
    };
    // Convert to MP4 if requested
    if (exportMp4Flag) {
      await convertToVideo({
        input: inputPath,
        output: mp4Path,
        format: 'mp4',
        width: width,
        fps: frameRate,
        startTime: start,
        duration: dur,
        removeWatermark: rmWatermark
      });
      const mp4Stats = fs.statSync(mp4Path);
      response.mp4 = {
        url: `/output/${path.basename(mp4Path)}`,
        sizeMB: Number((mp4Stats.size / (1024 * 1024)).toFixed(2)),
        width: width,
        fps: frameRate
      };
    }
    // Convert to WebM if requested
    if (exportWebmFlag) {
      await convertToVideo({
        input: inputPath,
        output: webmPath,
        format: 'webm',
        width: width,
        fps: frameRate,
        startTime: start,
        duration: dur,
        removeWatermark: rmWatermark
      });
      const webmStats = fs.statSync(webmPath);
      response.webm = {
        url: `/output/${path.basename(webmPath)}`,
        sizeMB: Number((webmStats.size / (1024 * 1024)).toFixed(2)),
        width: width,
        fps: frameRate
      };
    }
    res.json(response);
  } catch (err) {
    console.error(err);
    res.status(500).json({ ok: false, error: err.message || 'Conversion failed.' });
  } finally {
    if (inputPath && fs.existsSync(inputPath)) {
      try { fs.unlinkSync(inputPath); } catch {}
    }
  }
});

app.get('/api/health', (req, res) => res.json({ ok: true }));

app.listen(PORT, () => {
  console.log(`GIFify server running on http://localhost:${PORT}`);
});