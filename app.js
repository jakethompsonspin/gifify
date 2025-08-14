const form = document.getElementById('convert-form');
const urlInput = document.getElementById('url');
const statusEl = document.getElementById('status');
const resultEl = document.getElementById('result');
const previewEl = document.getElementById('preview');
const metaEl = document.getElementById('meta');
const downloadGifEl = document.getElementById('downloadGif');
const downloadMp4El = document.getElementById('downloadMp4');
const downloadWebmEl = document.getElementById('downloadWebm');
const resetBtn = document.getElementById('reset');
const spinnerTpl = document.getElementById('spinner');

function setStatus(node) {
  statusEl.innerHTML = '';
  statusEl.appendChild(node);
}
function showError(msg) {
  const p = document.createElement('p');
  p.className = 'error';
  p.textContent = msg;
  setStatus(p);
}
function showSpinner() {
  const frag = spinnerTpl.content.cloneNode(true);
  setStatus(frag);
}

form.addEventListener('submit', async (e) => {
  e.preventDefault();
  const url = urlInput.value.trim();
  const size = Number(document.getElementById('size').value || 50);
  const width = Number(document.getElementById('width').value || 480);
  const fps = Number(document.getElementById('fps').value || 12);
  const startTime = document.getElementById('startTime').value.trim();
  const duration = document.getElementById('duration').value;
  const removeWatermark = document.getElementById('removeWatermark').checked;
  const exportMp4 = document.getElementById('exportMp4').checked;
  const exportWebm = document.getElementById('exportWebm').checked;

  if (!url) return showError('Please paste a link.');
  resultEl.classList.add('hidden');
  showSpinner();
  try {
    const r = await fetch('/api/convert', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ url, targetSizeMB: size, maxWidth: width, fps, startTime, duration, removeWatermark, exportMp4, exportWebm })
    });
    const data = await r.json();
    if (!data.ok) throw new Error(data.error || 'Conversion failed.');
    // Update preview and download links
    previewEl.src = data.gif.url + '?t=' + Date.now();
    downloadGifEl.href = data.gif.url;
    downloadGifEl.download = (data.source.title ? data.source.title.replace(/[^a-z0-9-_]+/gi, '_') : 'video') + '.gif';
    if (data.mp4) {
      downloadMp4El.href = data.mp4.url;
      downloadMp4El.download = (data.source.title ? data.source.title.replace(/[^a-z0-9-_]+/gi, '_') : 'video') + '.mp4';
      downloadMp4El.style.display = '';
    } else {
      downloadMp4El.style.display = 'none';
    }
    if (data.webm) {
      downloadWebmEl.href = data.webm.url;
      downloadWebmEl.download = (data.source.title ? data.source.title.replace(/[^a-z0-9-_]+/gi, '_') : 'video') + '.webm';
      downloadWebmEl.style.display = '';
    } else {
      downloadWebmEl.style.display = 'none';
    }
    metaEl.textContent = `GIF: ${data.gif.sizeMB.toFixed(2)}MB · ${data.gif.width}px · ${data.gif.fps}fps` +
      (data.mp4 ? ` | MP4: ${data.mp4.sizeMB.toFixed(2)}MB` : '') +
      (data.webm ? ` | WebM: ${data.webm.sizeMB.toFixed(2)}MB` : '');
    statusEl.innerHTML = '';
    resultEl.classList.remove('hidden');
  } catch (err) {
    console.error(err);
    showError(err.message);
  }
});

resetBtn.addEventListener('click', () => {
  resultEl.classList.add('hidden');
  urlInput.value = '';
  statusEl.innerHTML = '';
  urlInput.focus();
});