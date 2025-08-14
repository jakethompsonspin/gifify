import { spawn } from 'child_process';
import path from 'path';
import fs from 'fs';

const YTDLP = process.env.YTDLP_PATH || 'yt-dlp';

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

/**
 * Download the video using yt-dlp and return the file path and extracted metadata.
 */
export async function downloadVideo(url, dir, id, muteAudio = true) {
  const outFile = path.join(dir, `${id}.mp4`);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });

  const args = [
    '-o', outFile,
    '--no-playlist',
    '--no-warnings',
    '--restrict-filenames',
    '--print-json',
    '-f', 'mp4/best',
    url
  ];
  const { stdout } = await run(YTDLP, args);
  let info = {};
  try { info = JSON.parse(stdout.trim().split('\n').pop()); } catch {}
  if (!fs.existsSync(outFile)) {
    throw new Error('Failed to download video with yt-dlp.');
  }
  return { file: outFile, info };
}
