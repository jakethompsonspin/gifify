import { spawn } from 'child_process';
import fs from 'fs';

const FFMPEG = process.env.FFMPEG_PATH || 'ffmpeg';
const FFPROBE = process.env.FFPROBE_PATH || 'ffprobe';

function run(cmd, args, opts = {}) {
  return new Promise((resolve, reject) => {
    const child = spawn(cmd, args, { stdio: ['ignore', 'pipe', 'pipe'], ...opts });
    let stdout = '';
    let stderr = '';
    child.stdout.on('data', d => stdout += d.toString());
    child.stderr.on('data', d => stderr += d.toString());
    child.on('error', reject);
    child.on('close', code => {
      if (code === 0) resolve({ stdout, stderr });
      else reject(new Error(stderr || stdout || `Command failed: ${cmd} ${args.join(' ')}`));
    });
  });
}

async function probeDimensions(input) {
  const args = ['-v', 'error', '-select_streams', 'v:0', '-show_entries', 'stream=width,height', '-of', 'csv=s=x:p=0', input];
  const { stdout } = await run(FFPROBE, args);
  const [w, h] = stdout.trim().split('x').map(Number);
  return { width: w || 0, height: h || 0 };
}

/**
 * Build filter string for trimming, cropping, scaling and frame rate.
 * @param {Object} opts
 * @param {string|null} opts.crop  Crop filter string (e.g. "crop=iw:ih*0.9:0:ih*0.05").
 * @param {number|null} opts.width Target width. Height will be kept proportional.
 * @param {number|null} opts.fps Frame rate. Omitted if falsy.
 */
function buildFilters({ crop, width, fps }) {
  const filters = [];
  if (fps) filters.push(`fps=${fps}`);
  if (crop) filters.push(crop);
  if (width) filters.push(`scale=${width}:-1:flags=lanczos`);
  return filters;
}

async function gifPass({ input, output, width, fps, startTime, duration, crop }) {
  // Build filters for palette generation and use
  const filters = buildFilters({ crop, width, fps });
  const palette = output.replace(/\.gif$/, '.palette.png');

  // Palette generation
  const argsPalette = [];
  if (startTime) argsPalette.push('-ss', startTime);
  if (duration) argsPalette.push('-t', duration);
  argsPalette.push('-i', input, '-vf', `${filters.join(',')},palettegen=max_colors=256:stats_mode=diff`, '-y', palette);
  await run(FFMPEG, argsPalette);

  // Palette use
  const argsUse = [];
  if (startTime) argsUse.push('-ss', startTime);
  if (duration) argsUse.push('-t', duration);
  argsUse.push('-i', input, '-i', palette, '-filter_complex', `${filters.join(',')}[x];[x][1:v]paletteuse=dither=bayer:bayer_scale=5:diff_mode=rectangle`, '-loop', '0', '-y', output);
  await run(FFMPEG, argsUse);
  try { fs.unlinkSync(palette); } catch {}
  const size = fs.statSync(output).size;
  return size;
}

/**
 * Convert a video to GIF iteratively reducing width and fps to meet maxMB.
 * Supports optional trimming and cropping for watermark removal.
 * @param {Object} opts
 */
export async function convertToGif({ input, output, maxMB = 50, startWidth = 480, startFps = 12, startTime = null, duration = null, removeWatermark = false }) {
  const limits = {
    minWidth: 240,
    minFps: 6
  };
  const notes = [];
  const origDims = await probeDimensions(input);
  let width = Math.min(startWidth || 480, origDims.width || startWidth || 480);
  let fps = startFps || 12;

  // Build crop filter if watermark removal requested
  let crop = null;
  if (removeWatermark) {
    // Remove top and bottom 8% of the frame to avoid watermarks; adjust cropping based on height proportion.
    crop = 'crop=iw:ih*0.84:0:ih*0.08';
  }

  let size;
  while (true) {
    size = await gifPass({ input, output, width, fps, startTime, duration, crop });
    const sizeMB = size / (1024 * 1024);
    if (sizeMB <= maxMB) break;
    notes.push(`Generated ${sizeMB.toFixed(2)}MB at ${width}px @ ${fps}fps; reducing quality...`);
    if (width > 320) {
      width = Math.max(limits.minWidth, Math.floor(width * 0.85));
    } else if (fps > limits.minFps) {
      fps = Math.max(limits.minFps, fps - 2);
    } else {
      notes.push('Hit minimum quality thresholds; cannot reach target size.');
      break;
    }
  }
  return { usedWidth: width, usedFps: fps, bytes: size, notes };
}

/**
 * Convert a video to MP4 or WebM. Applies trimming, cropping, scaling and frame rate.
 * Does not iterate for size; uses provided width/fps.
 * @param {Object} opts
 */
export async function convertToVideo({ input, output, format = 'mp4', width = null, fps = null, startTime = null, duration = null, removeWatermark = false }) {
  const filters = buildFilters({ crop: removeWatermark ? 'crop=iw:ih*0.84:0:ih*0.08' : null, width, fps });
  const args = [];
  if (startTime) args.push('-ss', startTime);
  if (duration) args.push('-t', duration);
  args.push('-i', input);
  if (filters.length > 0) args.push('-vf', filters.join(','));

  if (format === 'webm') {
    args.push('-c:v', 'libvpx-vp9', '-b:v', '0', '-crf', '33', '-row-mt', '1');
  } else {
    // mp4
    args.push('-c:v', 'libx264', '-preset', 'veryfast', '-crf', '28', '-pix_fmt', 'yuv420p');
  }
  // Always copy audio
  args.push('-c:a', 'copy');
  args.push('-y', output);
  await run(FFMPEG, args);
  const stats = fs.statSync(output);
  return { bytes: stats.size };
}
