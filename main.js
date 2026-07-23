/**
 * main.js
 *
 * Electron main process entry point for Fel7o.
 * Coordinates the application lifecycle, window management,
 * custom streaming protocol, and the backend download engine.
 */

/* ============================================================
   Imports
============================================================ */

const { app, BrowserWindow, ipcMain, dialog, shell, Notification, protocol, net, nativeImage } = require('electron');
const path = require('path');
const fs = require('fs');
const os = require('os');
const zlib = require('zlib');
const { spawn, execFile } = require('child_process');
const { pathToFileURL } = require('url');
const SharedUtils = require('./shared/shared-utils');

/* ============================================================
   Constants
============================================================ */

const APP_DATA_DIR = path.join(app.getPath('appData'), 'Fel7o');
const SETTINGS_PATH = path.join(APP_DATA_DIR, 'settings.json');
const HISTORY_PATH = path.join(APP_DATA_DIR, 'history.json');

const DEFAULT_SETTINGS = {
  downloadFolder: path.join(app.getPath('downloads'), 'Fel7o'),
  theme: 'dark',
  mode: 'mp3',
  audioFormat: 'mp3',
  audioQuality: '192',
  videoQuality: '1080',
  videoContainer: 'mp4',
  concurrentDownloads: 2,
  embedThumbnail: true,
  embedMetadata: true,
  autoPasteClipboard: true,
  windowWidth: 1180,
  windowHeight: 780,
  welcomeShown: false,
  userName: os.userInfo().username || '',
};

// Taskbar Thumbnail Toolbar icons canvas constants
const ICON_SIZE = 32;

// Center Play ▶ icon
const ICON_PLAY = pngIcon(({ triangle }) =>
  triangle(10, 6, 10, 26, 26, 16)
);

// Rounded Pause ⏸ icon bars
const ICON_PAUSE = pngIcon(({ roundRect }) => {
  roundRect(7,  7, 6, 18, 2);
  roundRect(19, 7, 6, 18, 2);
});

// Previous ⏮ icon bar & triangle
const ICON_PREV = pngIcon(({ roundRect, triangle }) => {
  roundRect(6, 7, 4, 18, 2);
  triangle(22, 7, 22, 25, 11, 16);
});

// Next ⏭ icon triangle & bar
const ICON_NEXT = pngIcon(({ roundRect, triangle }) => {
  triangle(10, 7, 10, 25, 21, 16);
  roundRect(22, 7, 4, 18, 2);
});

/* ============================================================
   State
============================================================ */

let mainWindow;
const activeJobs = new Map(); // jobId -> { proc, cancelled, paused, url, settings, job }

/* ============================================================
   Utilities
============================================================ */

function ensureAppDataDir() {
  if (!fs.existsSync(APP_DATA_DIR)) {
    fs.mkdirSync(APP_DATA_DIR, { recursive: true });
  }
}

function loadJSON(filePath, fallback) {
  try {
    if (fs.existsSync(filePath)) {
      return { ...fallback, ...JSON.parse(fs.readFileSync(filePath, 'utf-8')) };
    }
  } catch (e) {
    console.error('loadJSON failed', filePath, e);
  }
  return { ...fallback };
}

function saveJSON(filePath, data) {
  ensureAppDataDir();
  fs.writeFileSync(filePath, JSON.stringify(data, null, 2), 'utf-8');
}

function scanDirRecursive(dir, maxDepth = 2, currentDepth = 0) {
  let results = [];
  try {
    const list = fs.readdirSync(dir, { withFileTypes: true });
    for (const file of list) {
      const fullPath = path.join(dir, file.name);
      if (file.isDirectory()) {
        if (currentDepth < maxDepth) {
          results = results.concat(scanDirRecursive(fullPath, maxDepth, currentDepth + 1));
        }
      } else {
        results.push(fullPath);
      }
    }
  } catch (err) {
    console.error('Error scanning folder recursively', dir, err);
  }
  return results;
}

function bundledBinPath(filename) {
  const candidates = [];
  if (app.isPackaged && process.resourcesPath) {
    candidates.push(path.join(process.resourcesPath, 'bin', filename));
  }
  candidates.push(path.join(__dirname, 'bin', filename));
  return candidates;
}

function ytdlpBinaryCandidates() {
  return [...bundledBinPath('yt-dlp.exe'), 'yt-dlp.exe', 'yt-dlp'];
}

function findWorkingBinary(candidates, cb, versionArg = '--version') {
  const tryNext = (i) => {
    if (i >= candidates.length) return cb(null);
    const bin = candidates[i];
    execFile(bin, [versionArg], (err) => {
      if (!err) return cb(bin);
      tryNext(i + 1);
    });
  };
  tryNext(0);
}

function isValidYoutubeUrl(url) {
  return SharedUtils.isValidYoutubeUrl(url);
}

function sanitizeFolderName(name) {
  if (!name) return null;
  const cleaned = name.replace(/[\\/:*?"<>|]/g, ' ').replace(/\s+/g, ' ').trim().replace(/[. ]+$/, '');
  return cleaned || null;
}

function formatFileSize(bytes) {
  if (!bytes || isNaN(bytes)) return null;
  const units = ['B', 'KB', 'MB', 'GB'];
  let val = bytes;
  let i = 0;
  while (val >= 1024 && i < units.length - 1) {
    val /= 1024;
    i++;
  }
  return `${val.toFixed(val >= 10 || i === 0 ? 0 : 1)} ${units[i]}`;
}

function formatUploadDate(yyyymmdd) {
  if (!yyyymmdd || String(yyyymmdd).length !== 8) return null;
  const s = String(yyyymmdd);
  return `${s.slice(6, 8)}/${s.slice(4, 6)}/${s.slice(0, 4)}`;
}

function formatViewCount(n) {
  if (n === null || n === undefined || isNaN(n)) return null;
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1).replace(/\.0$/, '')}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1).replace(/\.0$/, '')}K`;
  return String(n);
}

function pngIcon(drawFn) {
  const S = ICON_SIZE;
  const px = new Uint8Array(S * S * 4);

  function setPixel(x, y, alpha) {
    x = Math.round(x);
    y = Math.round(y);
    if (x < 0 || x >= S || y < 0 || y >= S) return;
    const i = (y * S + x) * 4;
    const a = Math.min(255, Math.round(alpha * 255));
    if (a > px[i + 3]) {
      px[i] = 255;
      px[i+1] = 255;
      px[i+2] = 255;
      px[i+3] = a;
    }
  }

  function rect(x, y, w, h) {
    for (let dy = 0; dy < h; dy++) {
      for (let dx = 0; dx < w; dx++) {
        setPixel(x + dx, y + dy, 1);
      }
    }
  }

  function roundRect(x, y, w, h, r) {
    for (let py = y; py < y + h; py++) {
      for (let px2 = x; px2 < x + w; px2++) {
        const cx = Math.max(x + r, Math.min(x + w - r, px2));
        const cy = Math.max(y + r, Math.min(y + h - r, py));
        const dist = Math.sqrt((px2 - cx) ** 2 + (py - cy) ** 2);
        if (dist <= r) {
          setPixel(px2, py, 1);
        }
      }
    }
  }

  function triangle(x1, y1, x2, y2, x3, y3) {
    const minX = Math.floor(Math.min(x1, x2, x3));
    const maxX = Math.ceil(Math.max(x1, x2, x3));
    const minY = Math.floor(Math.min(y1, y2, y3));
    const maxY = Math.ceil(Math.max(y1, y2, y3));

    function sign(ax, ay, bx, by, cx, cy) {
      return (ax - cx) * (by - cy) - (bx - cx) * (ay - cy);
    }

    for (let py = minY; py <= maxY; py++) {
      for (let px2 = minX; px2 <= maxX; px2++) {
        let covered = 0;
        for (let sy = 0; sy < 2; sy++) {
          for (let sx2 = 0; sx2 < 2; sx2++) {
            const sx = px2 + sx2 * 0.5;
            const sy2 = py + sy * 0.5;
            const d1 = sign(sx, sy2, x1, y1, x2, y2);
            const d2 = sign(sx, sy2, x2, y2, x3, y3);
            const d3 = sign(sx, sy2, x3, y3, x1, y1);
            const hasNeg = (d1 < 0) || (d2 < 0) || (d3 < 0);
            const hasPos = (d1 > 0) || (d2 > 0) || (d3 > 0);
            if (!(hasNeg && hasPos)) {
              covered++;
            }
          }
        }
        if (covered > 0) {
          setPixel(px2, py, covered / 4);
        }
      }
    }
  }

  drawFn({ rect, roundRect, triangle });

  const W = S, H = S;
  const crcTable = (() => {
    const t = new Uint32Array(256);
    for (let n = 0; n < 256; n++) {
      let c = n;
      for (let k = 0; k < 8; k++) {
        c = (c & 1) ? (0xEDB88320 ^ (c >>> 1)) : (c >>> 1);
      }
      t[n] = c;
    }
    return t;
  })();

  function crc32(buf) {
    let c = 0xFFFFFFFF;
    for (let i = 0; i < buf.length; i++) {
      c = crcTable[(c ^ buf[i]) & 0xFF] ^ (c >>> 8);
    }
    return (c ^ 0xFFFFFFFF) >>> 0;
  }

  function chunk(type, data) {
    const tb = Buffer.from(type, 'ascii');
    const lb = Buffer.alloc(4);
    lb.writeUInt32BE(data.length, 0);
    const cb = Buffer.alloc(4);
    cb.writeUInt32BE(crc32(Buffer.concat([tb, data])), 0);
    return Buffer.concat([lb, tb, data, cb]);
  }

  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(W, 0);
  ihdr.writeUInt32BE(H, 4);
  ihdr[8] = 8;
  ihdr[9] = 6;

  const raw = Buffer.alloc(H * (1 + W * 4));
  for (let y = 0; y < H; y++) {
    raw[y * (W * 4 + 1)] = 0;
    for (let x = 0; x < W; x++) {
      const si = (y * W + x) * 4;
      const di = y * (W * 4 + 1) + 1 + x * 4;
      raw[di] = px[si];
      raw[di+1] = px[si+1];
      raw[di+2] = px[si+2];
      raw[di+3] = px[si+3];
    }
  }

  const buf = Buffer.concat([
    Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
    chunk('IHDR', ihdr),
    chunk('IDAT', zlib.deflateSync(raw)),
    chunk('IEND', Buffer.alloc(0))
  ]);

  return nativeImage.createFromBuffer(buf, { scaleFactor: 1.0 });
}

/* ============================================================
   Rendering
============================================================ */

function safeSend(channel, data) {
  if (mainWindow && !mainWindow.isDestroyed() && mainWindow.webContents && !mainWindow.webContents.isDestroyed()) {
    mainWindow.webContents.send(channel, data);
  }
}

function setupThumbarButtons(isPlaying) {
  if (!mainWindow || mainWindow.isDestroyed() || process.platform !== 'win32') return;
  mainWindow.setThumbarButtons([
    {
      tooltip: 'Previous',
      icon: ICON_PREV,
      click() {
        safeSend('thumbar:prev');
      }
    },
    {
      tooltip: isPlaying ? 'Pause' : 'Play',
      icon: isPlaying ? ICON_PAUSE : ICON_PLAY,
      click() {
        safeSend('thumbar:playpause');
      }
    },
    {
      tooltip: 'Next',
      icon: ICON_NEXT,
      click() {
        safeSend('thumbar:next');
      }
    }
  ]);
}

ipcMain.on('player:state', (_e, { isPlaying }) => {
  setupThumbarButtons(isPlaying);
});

/* ============================================================
   Playback
============================================================ */

// Local media streaming protocol registration
// Custom 'media' scheme supporting HTTP 206 Partial Content (seeking and duration parsing)
function registerMediaProtocol() {
  protocol.handle('media', (request) => {
    try {
      const rawUrl = request.url;
      const prefix = 'media://local-file/';
      if (!rawUrl.startsWith(prefix)) {
        return new Response('Not Found', { status: 404 });
      }

      const encoded = rawUrl.slice(prefix.length).split('?')[0];
      const forwardPath = decodeURIComponent(encoded);
      const nativePath = process.platform === 'win32'
        ? forwardPath.replace(/\//g, '\\')
        : forwardPath;

      if (!fs.existsSync(nativePath)) {
        return new Response('Not Found', { status: 404 });
      }

      // Security check: restrict paths to settings.downloadFolder or Fel7o AppData
      const resolvedPath = path.resolve(nativePath);
      const settings = loadJSON(SETTINGS_PATH, DEFAULT_SETTINGS);
      const allowedFolder = path.resolve(settings.downloadFolder);
      
      const relativeToDownload = path.relative(allowedFolder, resolvedPath);
      const relativeToAppData = path.relative(APP_DATA_DIR, resolvedPath);
      
      const inDownloadFolder = relativeToDownload && !relativeToDownload.startsWith('..') && !path.isAbsolute(relativeToDownload);
      const inAppData = relativeToAppData && !relativeToAppData.startsWith('..') && !path.isAbsolute(relativeToAppData);
      
      if (!inDownloadFolder && !inAppData) {
        console.warn(`Blocked custom protocol access to unauthorized path: ${resolvedPath}`);
        return new Response('Access Denied', { status: 403 });
      }

      // Security check: whitelist extensions
      const ext = path.extname(resolvedPath).toLowerCase();
      const safeMediaExtensions = ['.mp3', '.mp4', '.m4a', '.webm', '.ogg', '.wav', '.flac', '.aac', '.opus'];
      if (!safeMediaExtensions.includes(ext)) {
        console.warn(`Blocked attempt to stream non-media file via custom protocol: ${resolvedPath}`);
        return new Response('Access Denied', { status: 403 });
      }

      const stat = fs.statSync(resolvedPath);
      const fileSize = stat.size;
      const mime = { mp3: 'audio/mpeg', mp4: 'video/mp4', m4a: 'audio/mp4',
                     webm: 'audio/webm', ogg: 'audio/ogg', wav: 'audio/wav',
                     flac: 'audio/flac', aac: 'audio/aac', opus: 'audio/ogg' }[ext.slice(1)] || 'application/octet-stream';

      const rangeHeader = request.headers.get('range');

      if (rangeHeader) {
        const [, startStr, endStr] = rangeHeader.match(/bytes=(\d*)-(\d*)/) || [];
        const start = startStr ? parseInt(startStr, 10) : 0;
        const end = endStr ? parseInt(endStr, 10) : fileSize - 1;
        const chunkSize = end - start + 1;

        const stream = fs.createReadStream(resolvedPath, { start, end });
        const webStream = new ReadableStream({
          start(controller) {
            stream.on('data', chunk => controller.enqueue(chunk));
            stream.on('end', () => controller.close());
            stream.on('error', err => controller.error(err));
          },
          cancel() {
            stream.destroy();
          }
        });

        return new Response(webStream, {
          status: 206,
          headers: {
            'Content-Type': mime,
            'Content-Length': String(chunkSize),
            'Content-Range': `bytes ${start}-${end}/${fileSize}`,
            'Accept-Ranges': 'bytes',
          }
        });
      }

      const stream = fs.createReadStream(resolvedPath);
      const webStream = new ReadableStream({
        start(controller) {
          stream.on('data', chunk => controller.enqueue(chunk));
          stream.on('end', () => controller.close());
          stream.on('error', err => controller.error(err));
        },
        cancel() {
          stream.destroy();
        }
      });

      return new Response(webStream, {
        status: 200,
        headers: {
          'Content-Type': mime,
          'Content-Length': String(fileSize),
          'Accept-Ranges': 'bytes',
        }
      });

    } catch (err) {
      console.error('Failed to handle media protocol request', err);
      return new Response('Error', { status: 500 });
    }
  });
}

/* ============================================================
   History
============================================================ */

function matchesTitle(filenameWithoutExtLower, title) {
  const cleanTitle = title.trim();
  const cleanTitleLower = cleanTitle.toLowerCase();
  
  const sanitizedTitle = title.replace(/[\\/:*?"<>|]/g, '_').trim();
  const sanitizedTitleLower = sanitizedTitle.toLowerCase();
  
  const sanitizedTitleSpace = title.replace(/[\\/:*?"<>|]/g, ' ').replace(/\s+/g, ' ').trim();
  const sanitizedTitleSpaceLower = sanitizedTitleSpace.toLowerCase();

  const winTitle = title
    .replace(/:/g, '：')
    .replace(/\*/g, '＊')
    .replace(/\?/g, '？')
    .replace(/"/g, '\u2018')
    .replace(/</g, '＜')
    .replace(/>/g, '＞')
    .replace(/\|/g, '｜')
    .replace(/\//g, '／')
    .replace(/\\/g, '＼')
    .trim();
  const winTitleLower = winTitle.toLowerCase();

  return filenameWithoutExtLower === cleanTitleLower ||
         filenameWithoutExtLower === sanitizedTitleLower ||
         filenameWithoutExtLower === sanitizedTitleSpaceLower ||
         filenameWithoutExtLower === winTitleLower ||
         filenameWithoutExtLower.includes(cleanTitleLower) ||
         cleanTitleLower.includes(filenameWithoutExtLower) ||
         filenameWithoutExtLower.includes(sanitizedTitleLower) ||
         filenameWithoutExtLower.includes(sanitizedTitleSpaceLower) ||
         filenameWithoutExtLower.includes(winTitleLower) ||
         winTitleLower.includes(filenameWithoutExtLower) ||
         filenameWithoutExtLower.includes(cleanTitleLower.slice(0, 20));
}

function resolvePathOnDisk(folder, title, mode, videoQuality, audioQuality) {
  if (!folder || !title || !fs.existsSync(folder)) {
    return null;
  }

  try {
    const files = scanDirRecursive(folder);
    const invalidExts = ['.part', '.ytdl', '.temp'];
    
    const matches = files.filter(f => {
      const parsed = path.parse(f);
      const ext = parsed.ext.toLowerCase();
      if (invalidExts.includes(ext)) {
        return false;
      }
      
      const nameWithoutExt = parsed.name.toLowerCase();
      return matchesTitle(nameWithoutExt, title);
    });

    if (matches.length === 0) return null;
    if (matches.length === 1) return matches[0];

    let bestFile = matches[0];
    let bestScore = -1;

    for (const f of matches) {
      const parsed = path.parse(f);
      const ext = parsed.ext.toLowerCase();
      const name = parsed.name.toLowerCase();
      let score = 0;

      if (mode === 'mp3') {
        if (['.mp3', '.m4a', '.opus', '.wav', '.flac'].includes(ext)) score += 10;
        if (audioQuality && name.includes(audioQuality.toString().toLowerCase())) score += 20;
      } else {
        if (['.mp4', '.mkv', '.webm', '.avi'].includes(ext)) score += 10;
        if (videoQuality && videoQuality !== 'best' && name.includes(videoQuality.toString().toLowerCase())) score += 20;
      }

      if (score > bestScore) {
        bestScore = score;
        bestFile = f;
      }
    }
    return bestFile;
  } catch (err) {
    console.error('Error scanning folder in resolvePathOnDisk', err);
  }
  return null;
}

function resolveHistoryItemsSizes(items) {
  for (const item of items) {
    const filePath = resolvePathOnDisk(item.folder, item.title, item.mode, item.videoQuality, item.audioQuality);
    if (!filePath || !fs.existsSync(filePath)) {
      item.totalSize = null;
      continue;
    }
    try {
      const stat = fs.statSync(filePath);
      item.totalSize = SharedUtils.formatBytes(stat.size);
    } catch (e) {
      item.totalSize = null;
    }
  }
  return items;
}

/* ============================================================
   Settings
============================================================ */

ipcMain.handle('settings:get', () => loadJSON(SETTINGS_PATH, DEFAULT_SETTINGS));
ipcMain.handle('settings:save', (_e, patch) => {
  if (!patch || typeof patch !== 'object' || Array.isArray(patch)) {
    return loadJSON(SETTINGS_PATH, DEFAULT_SETTINGS);
  }
  const cleanPatch = {};
  if (typeof patch.downloadFolder === 'string' && patch.downloadFolder.trim()) {
    cleanPatch.downloadFolder = patch.downloadFolder.trim();
  }
  if (typeof patch.concurrentDownloads === 'number' && patch.concurrentDownloads >= 1 && patch.concurrentDownloads <= 10) {
    cleanPatch.concurrentDownloads = Math.floor(patch.concurrentDownloads);
  }
  if (['128', '192', '320'].includes(patch.audioQuality)) {
    cleanPatch.audioQuality = patch.audioQuality;
  }
  if (['best', '2160', '1440', '1080', '720', '480'].includes(patch.videoQuality)) {
    cleanPatch.videoQuality = patch.videoQuality;
  }
  if (typeof patch.autoPasteClipboard === 'boolean') {
    cleanPatch.autoPasteClipboard = patch.autoPasteClipboard;
  }
  if (typeof patch.embedThumbnail === 'boolean') {
    cleanPatch.embedThumbnail = patch.embedThumbnail;
  }
  if (typeof patch.embedMetadata === 'boolean') {
    cleanPatch.embedMetadata = patch.embedMetadata;
  }
  if (typeof patch.welcomeShown === 'boolean') {
    cleanPatch.welcomeShown = patch.welcomeShown;
  }
  if (typeof patch.userName === 'string') {
    cleanPatch.userName = patch.userName.slice(0, 100);
  }
  const merged = { ...loadJSON(SETTINGS_PATH, DEFAULT_SETTINGS), ...cleanPatch };
  saveJSON(SETTINGS_PATH, merged);
  return merged;
});

/* ============================================================
   Events
============================================================ */

// History Persistence IPC
ipcMain.handle('history:get', () => {
  const data = loadJSON(HISTORY_PATH, { items: [] });
  return resolveHistoryItemsSizes(data.items || []);
});
ipcMain.handle('history:add', (_e, entry) => {
  const currentData = loadJSON(HISTORY_PATH, { items: [] });
  if (!entry || typeof entry !== 'object' || Array.isArray(entry) || !isValidYoutubeUrl(entry.url)) {
    return resolveHistoryItemsSizes(currentData.items || []);
  }
  const cleanEntry = {
    id: typeof entry.id === 'string' ? entry.id.slice(0, 100) : String(Date.now()),
    url: String(entry.url).trim(),
    title: typeof entry.title === 'string' ? entry.title.slice(0, 500) : 'Untitled',
    channel: typeof entry.channel === 'string' ? entry.channel.slice(0, 200) : '—',
    thumbnail: (typeof entry.thumbnail === 'string' && /^https?:\/\//.test(entry.thumbnail)) ? entry.thumbnail : null,
    mode: entry.mode === 'video' ? 'video' : 'mp3',
    date: typeof entry.date === 'string' ? entry.date : new Date().toISOString(),
    folder: typeof entry.folder === 'string' ? entry.folder : null,
    videoQuality: typeof entry.videoQuality === 'string' ? entry.videoQuality : null,
    audioQuality: typeof entry.audioQuality === 'string' ? entry.audioQuality : null,
    audioFormat: typeof entry.audioFormat === 'string' ? entry.audioFormat : null,
    videoContainer: typeof entry.videoContainer === 'string' ? entry.videoContainer : null,
    duration: typeof entry.duration === 'string' ? entry.duration : null,
  };
  const items = currentData.items || [];
  items.unshift(cleanEntry);
  currentData.items = items.slice(0, 500);
  saveJSON(HISTORY_PATH, currentData);
  return resolveHistoryItemsSizes(currentData.items);
});
ipcMain.handle('history:clear', () => {
  saveJSON(HISTORY_PATH, { items: [] });
  return [];
});
ipcMain.handle('history:delete', (_e, id) => {
  if (typeof id !== 'string' || !id) {
    const data = loadJSON(HISTORY_PATH, { items: [] });
    return resolveHistoryItemsSizes(data.items || []);
  }
  const data = loadJSON(HISTORY_PATH, { items: [] });
  data.items = (data.items || []).filter((it) => it && String(it.id) !== String(id));
  saveJSON(HISTORY_PATH, data);
  return resolveHistoryItemsSizes(data.items);
});

// Filesystem Operations IPC
ipcMain.handle('dialog:chooseFolder', async () => {
  const res = await dialog.showOpenDialog(mainWindow, { properties: ['openDirectory', 'createDirectory'] });
  if (res.canceled || !res.filePaths.length) return null;
  return res.filePaths[0];
});
ipcMain.handle('shell:openFolder', (_e, folderPath) => {
  if (folderPath && typeof folderPath === 'string' && fs.existsSync(folderPath)) {
    try {
      const stat = fs.statSync(folderPath);
      if (stat.isDirectory()) {
        shell.openPath(folderPath);
      } else {
        console.warn(`Blocked attempt to open non-directory path as folder: ${folderPath}`);
      }
    } catch (err) {
      console.error('Error verifying folder path in shell:openFolder', err);
    }
  }
});
ipcMain.handle('shell:openJobFolder', (_e, payload) => {
  if (!payload || typeof payload !== 'object') return;
  const { downloadFolder, playlistFolder } = payload;
  if (!downloadFolder || typeof downloadFolder !== 'string') return;
  const folderName = sanitizeFolderName(playlistFolder);
  const targetDir = folderName ? path.join(downloadFolder, folderName) : downloadFolder;
  const finalDir = fs.existsSync(targetDir) ? targetDir : downloadFolder;
  if (fs.existsSync(finalDir)) {
    try {
      const stat = fs.statSync(finalDir);
      if (stat.isDirectory()) {
        shell.openPath(finalDir);
      }
    } catch (err) {
      console.error('Error verifying job folder in shell:openJobFolder', err);
    }
  }
});
ipcMain.handle('shell:openFile', (_e, payload) => {
  if (!payload || typeof payload !== 'object') return false;
  const { folder, title } = payload;
  if (!folder || typeof folder !== 'string' || !fs.existsSync(folder)) return false;

  try {
    const files = scanDirRecursive(folder);
    const invalidExts = ['.part', '.ytdl', '.temp'];
    const safeMediaExtensions = ['.mp3', '.mp4', '.m4a', '.webm', '.ogg', '.wav', '.flac', '.aac', '.opus'];
    
    const matchedFile = files.find(f => {
      const parsed = path.parse(f);
      const ext = parsed.ext.toLowerCase();
      if (invalidExts.includes(ext)) return false;
      
      const nameWithoutExt = parsed.name.toLowerCase();
      return matchesTitle(nameWithoutExt, title);
    });

    if (matchedFile) {
      const ext = path.extname(matchedFile).toLowerCase();
      if (safeMediaExtensions.includes(ext)) {
        shell.openPath(matchedFile);
        return true;
      } else {
        console.warn(`Blocked attempt to open file with non-media extension: ${matchedFile}`);
        return false;
      }
    }
  } catch (err) {
    console.error('Error scanning folder in shell:openFile', err);
  }
  
  if (fs.existsSync(folder)) {
    try {
      const stat = fs.statSync(folder);
      if (stat.isDirectory()) {
        shell.openPath(folder);
      }
    } catch (e) {
      console.error('Error verifying folder in shell:openFile fallback', e);
    }
  }
  return false;
});
ipcMain.handle('shell:resolveFilePath', (_e, payload) => {
  if (!payload || typeof payload !== 'object') return null;
  const { folder, title, mode, videoQuality, audioQuality } = payload;
  return resolvePathOnDisk(folder, title, mode, videoQuality, audioQuality);
});
ipcMain.handle('clipboard:read', () => {
  try {
    const text = require('electron').clipboard.readText();
    if (typeof text === 'string' && SharedUtils.isValidYoutubeUrl(text.trim())) {
      return text.trim();
    }
  } catch (_e) {}
  return '';
});
ipcMain.handle('shell:openExternal', (_e, url) => {
  if (typeof url !== 'string') return Promise.resolve();
  try {
    const parsed = new URL(url);
    if (parsed.protocol === 'http:' || parsed.protocol === 'https:') {
      return shell.openExternal(url);
    }
  } catch (_err) {
    // Ignore invalid URLs
  }
  return Promise.resolve();
});

// Tool Detection IPC
ipcMain.handle('tools:checkFfmpeg', () => new Promise((resolve) => {
  findWorkingBinary([...bundledBinPath('ffmpeg.exe'), 'ffmpeg.exe', 'ffmpeg'], (bin) => resolve(!!bin), '-version');
}));
ipcMain.handle('tools:checkYtdlp', () => new Promise((resolve) => {
  findWorkingBinary(ytdlpBinaryCandidates(), (bin) => resolve(!!bin));
}));

// Video & Playlist Metadata Query IPC
ipcMain.handle('ytdlp:getInfo', (_e, url) => new Promise((resolve) => {
  if (typeof url !== 'string' || !isValidYoutubeUrl(url)) return resolve({ error: 'Invalid YouTube URL.' });
  findWorkingBinary(ytdlpBinaryCandidates(), (bin) => {
    if (!bin) return resolve({ error: 'Unable to locate yt-dlp dependency.' });
    execFile(bin, ['--dump-single-json', '--no-warnings', '--skip-download', '--no-playlist', url.trim()],
      { maxBuffer: 1024 * 1024 * 10 },
      (err, stdout) => {
        if (err || !stdout) return resolve({ error: 'Unable to fetch video details.' });
        try {
          const data = JSON.parse(stdout);

          let estimatedSizeBytes = data.filesize || data.filesize_approx || null;
          if (!estimatedSizeBytes && Array.isArray(data.formats)) {
            const withSize = data.formats.filter((f) => f.filesize || f.filesize_approx);
            if (withSize.length) {
              const best = withSize[withSize.length - 1];
              estimatedSizeBytes = best.filesize || best.filesize_approx;
            }
          }

          const isLive = !!(data.is_live || data.live_status === 'is_live' || data.live_status === 'is_upcoming');
          const isShort = !isLive && (
            (typeof data.webpage_url === 'string' && data.webpage_url.includes('/shorts/')) ||
            (!!data.duration && data.duration <= 60 && !!data.height && !!data.width && data.height > data.width)
          );
          const isPlaylistLink = /[?&]list=/.test(url);

          resolve({
            title: data.title || null,
            channel: data.uploader || data.channel || null,
            channelAvatar: data.uploader_thumbnail || data.channel_thumbnail ||
              ((Array.isArray(data.uploader_thumbnails) && data.uploader_thumbnails.length)
                ? data.uploader_thumbnails[data.uploader_thumbnails.length - 1].url : null),
            thumbnail: data.thumbnail || (Array.isArray(data.thumbnails) && data.thumbnails.length
              ? data.thumbnails[data.thumbnails.length - 1].url : null),
            duration: SharedUtils.formatDuration(data.duration),
            durationSecs: data.duration || null,
            uploadDate: formatUploadDate(data.upload_date),
            viewCount: formatViewCount(data.view_count),
            resolution: data.resolution || (data.width && data.height ? `${data.width}x${data.height}` : null),
            estimatedSize: formatFileSize(estimatedSizeBytes),
            isLive,
            isShort,
            isPlaylistLink,
          });
        } catch (e) {
          resolve({ error: 'Unable to parse video details.' });
        }
      });
  });
}));

ipcMain.handle('ytdlp:getPlaylistInfo', (_e, url) => new Promise((resolve) => {
  if (typeof url !== 'string' || !isValidYoutubeUrl(url)) return resolve({ error: 'Invalid YouTube URL.' });
  findWorkingBinary(ytdlpBinaryCandidates(), (bin) => {
    if (!bin) return resolve({ error: 'Unable to locate yt-dlp dependency.' });
    execFile(bin, ['--flat-playlist', '--dump-single-json', '--no-warnings', '--ignore-errors', url.trim()],
      { maxBuffer: 1024 * 1024 * 40, timeout: 60000 },
      (err, stdout, stderr) => {
        if (!stdout) {
          if (err && err.killed) {
            return resolve({ error: 'Playlist loading timed out. Mix/Radio auto-playlists may not be supported.' });
          }
          const errLine = (stderr || '').split('\n').find((l) => l.trim().startsWith('ERROR:'));
          return resolve({ error: errLine ? errLine.replace(/^ERROR:\s*/, '').trim() : 'Unable to fetch playlist details. Please ensure it is public.' });
        }
        try {
          const data = JSON.parse(stdout);
          const rawEntries = Array.isArray(data.entries) ? data.entries : [];

          let totalDurationSecs = 0;
          let knownDurationCount = 0;
          const videos = rawEntries.map((e, i) => {
            if (!e) return null;
            const durationSecs = e.duration || null;
            if (durationSecs) {
              totalDurationSecs += durationSecs;
              knownDurationCount++;
            }
            const thumb = e.thumbnail || (Array.isArray(e.thumbnails) && e.thumbnails.length
              ? e.thumbnails[e.thumbnails.length - 1].url : null);
            const videoUrl = e.url && /^https?:\/\//.test(e.url) ? e.url
              : (e.id ? `https://www.youtube.com/watch?v=${e.id}` : null);
            if (!videoUrl) return null;
            return {
              id: e.id || String(i),
              url: videoUrl,
              title: e.title || 'Untitled',
              channel: e.uploader || e.channel || data.uploader || null,
              duration: SharedUtils.formatDuration(durationSecs),
              durationSecs: durationSecs || 0,
              thumbnail: thumb,
              position: i + 1,
            };
          }).filter(Boolean);

          resolve({
            playlistTitle: data.title || 'Untitled playlist',
            channel: data.uploader || data.channel || null,
            videoCount: videos.length,
            totalDuration: totalDurationSecs ? SharedUtils.formatDuration(totalDurationSecs) : null,
            hasPartialDurations: knownDurationCount > 0 && knownDurationCount < videos.length,
            videos,
          });
        } catch (e) {
          resolve({ error: 'Unable to parse playlist details.' });
        }
      });
  });
}));

// Download Operations IPC Handlers
ipcMain.handle('download:start', async (event, job) => {
  if (!job || typeof job !== 'object' || typeof job.id !== 'string' || !isValidYoutubeUrl(job.url)) {
    safeSend('download:error', { id: (job && job.id) || 'unknown', message: 'Invalid YouTube URL or job parameters.' });
    return { started: false };
  }
  const settings = loadJSON(SETTINGS_PATH, DEFAULT_SETTINGS);
  ensureAppDataDir();
  if (!fs.existsSync(settings.downloadFolder)) {
    fs.mkdirSync(settings.downloadFolder, { recursive: true });
  }

  const binaries = ytdlpBinaryCandidates();
  findWorkingBinary(binaries, async (bin) => {
    if (!bin) {
      safeSend('download:error', { id: job.id, message: 'Unable to locate yt-dlp dependency.' });
      return;
    }
    const args = await buildArgs(job, settings);
    const proc = spawn(bin, args, { windowsHide: true });
    activeJobs.set(job.id, { proc, paused: false, cancelled: false, bin, args, job, settings, lastError: null });
    attachProcessHandlers(proc, job.id);
  });
  return { started: true };
});

ipcMain.handle('download:pause', (_e, jobId) => {
  if (typeof jobId !== 'string' || !jobId) return false;
  const state = activeJobs.get(jobId);
  if (state && state.proc) {
    state.paused = true;
    state.proc.kill();
    return true;
  }
  return false;
});

ipcMain.handle('download:resume', (_e, jobId) => {
  if (typeof jobId !== 'string' || !jobId) return false;
  const state = activeJobs.get(jobId);
  if (state && state.paused) {
    state.paused = false;
    state.lastError = null;
    const newProc = spawn(state.bin, state.args, { windowsHide: true });
    state.proc = newProc;
    attachProcessHandlers(newProc, jobId);
    return true;
  }
  return false;
});

ipcMain.handle('download:cancel', (_e, jobId) => {
  if (typeof jobId !== 'string' || !jobId) return false;
  const state = activeJobs.get(jobId);
  if (state) {
    state.cancelled = true;
    if (state.proc) {
      state.proc.kill();
    }
    activeJobs.delete(jobId);
    return true;
  }
  return false;
});

ipcMain.handle('download:pauseAll', () => {
  let count = 0;
  for (const [id, state] of activeJobs.entries()) {
    if (state.proc && !state.paused && !state.cancelled) {
      state.paused = true;
      state.proc.kill();
      count++;
    }
  }
  return count;
});

ipcMain.handle('download:resumeAll', () => {
  let count = 0;
  for (const [id, state] of activeJobs.entries()) {
    if (state.paused && !state.cancelled) {
      state.paused = false;
      state.lastError = null;
      const newProc = spawn(state.bin, state.args, { windowsHide: true });
      state.proc = newProc;
      attachProcessHandlers(newProc, id);
      count++;
    }
  }
  return count;
});

// Notifications IPC
ipcMain.handle('notify', (_e, opts) => {
  if (!opts || typeof opts !== 'object') return;
  const title = typeof opts.title === 'string' ? opts.title.slice(0, 100) : 'Fel7o';
  const body = typeof opts.body === 'string' ? opts.body.slice(0, 500) : '';
  const silent = !!opts.silent;
  if (Notification.isSupported()) {
    new Notification({ title, body, silent }).show();
  }
});

/* ============================================================
   Download Engine Helpers
============================================================ */

async function buildArgs(job, settings) {
  const playlistFolder = sanitizeFolderName(job.playlistFolder);
  const targetDir = playlistFolder
    ? path.join(settings.downloadFolder, playlistFolder)
    : settings.downloadFolder;
  if (!fs.existsSync(targetDir)) {
    fs.mkdirSync(targetDir, { recursive: true });
  }

  const outTemplate = job.mode === 'mp3'
    ? path.join(targetDir, `%(title)s - ${job.audioQuality || settings.audioQuality}k.%(ext)s`)
    : path.join(targetDir, `%(title)s - ${job.videoQuality || settings.videoQuality}p.%(ext)s`);

  const args = ['--newline', '--no-mtime', '--no-playlist', '--windows-filenames', '-o', outTemplate];

  const ffmpegPath = await new Promise(resolve => {
    findWorkingBinary([...bundledBinPath('ffmpeg.exe'), 'ffmpeg.exe', 'ffmpeg'], (bin) => resolve(bin), '-version');
  });

  if (ffmpegPath) {
    args.push('--ffmpeg-location', ffmpegPath);
  }

  if (job.mode === 'mp3') {
    args.push('-x', '--audio-format', job.audioFormat || settings.audioFormat,
               '--audio-quality', `${job.audioQuality || settings.audioQuality}K`);
  } else {
    const q = job.videoQuality || settings.videoQuality;
    const heightFilter = q === 'best' ? '' : `[height<=${q}]`;
    args.push('-f', `bestvideo${heightFilter}+bestaudio/best${heightFilter}`,
               '--merge-output-format', job.videoContainer || settings.videoContainer,
               '--fixup', 'warn');
  }
  
  if (settings.embedThumbnail) args.push('--embed-thumbnail');
  if (settings.embedMetadata) args.push('--add-metadata');
  
  args.push('--no-abort-on-error');
  args.push(job.url);
  return args;
}

function parseProgressLine(line) {
  const m = line.match(/\[download\]\s+([\d.]+)% of\s+~?([\d.]+\w+)\s+at\s+([\d.]+\w+\/s)\s+ETA\s+([\d:]+)/);
  if (!m) return null;
  return { percent: parseFloat(m[1]), totalSize: m[2], speed: m[3], eta: m[4] };
}

function cleanupActiveJobs() {
  for (const [id, state] of activeJobs.entries()) {
    if (state && state.proc) {
      try {
        state.proc.kill('SIGKILL');
      } catch (_e) {
        // Suppress kill errors on shutdown
      }
    }
  }
  activeJobs.clear();
}

function attachProcessHandlers(proc, jobId) {
  proc.stdout.on('data', (chunk) => {
    const lines = chunk.toString().split('\n');
    for (const line of lines) {
      const progress = parseProgressLine(line);
      if (progress) {
        safeSend('download:progress', { id: jobId, ...progress });
      }
      if (line.includes('has already been downloaded')) {
        safeSend('download:progress', { id: jobId, percent: 100 });
      }
    }
  });

  proc.stderr.on('data', (chunk) => {
    const text = chunk.toString();
    const jobState = activeJobs.get(jobId);
    if (jobState) {
      const errorLine = text.split('\n').find((l) => l.trim().startsWith('ERROR:'));
      if (errorLine) jobState.lastError = errorLine.replace(/^ERROR:\s*/, '').trim();
    }
    safeSend('download:log', { id: jobId, message: text });
  });

  proc.on('close', (code) => {
    const state = activeJobs.get(jobId);
    if (state && state.paused) return;
    activeJobs.delete(jobId);
    if (state && state.cancelled) {
      safeSend('download:cancelled', { id: jobId });
    } else if (code === 0) {
      safeSend('download:done', { id: jobId });
    } else {
      const reason = (state && state.lastError) || `yt-dlp exited with code ${code}`;
      safeSend('download:error', { id: jobId, message: reason });
    }
  });
}

/* ============================================================
   Bootstrap
============================================================ */

function createWindow() {
  const settings = loadJSON(SETTINGS_PATH, DEFAULT_SETTINGS);
  mainWindow = new BrowserWindow({
    title: 'Fel7o',
    icon: path.join(__dirname, 'assets', 'icon.ico'),
    width: settings.windowWidth || 1280,
    height: settings.windowHeight || 800,
    minWidth: 980,
    minHeight: 680,
    backgroundColor: '#0B0F17',
    frame: true,
    autoHideMenuBar: true,
    show: false,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      autoplayPolicy: 'no-user-gesture-required',
    },
  });

  mainWindow.loadFile(path.join(__dirname, 'index.html'));

  mainWindow.once('ready-to-show', () => {
    mainWindow.maximize();
    mainWindow.show();
    setupThumbarButtons(false);
  });

  mainWindow.on('close', () => {
    cleanupActiveJobs();
    if (mainWindow && !mainWindow.isDestroyed()) {
      const [w, h] = [mainWindow.getBounds().width, mainWindow.getBounds().height];
      const s = loadJSON(SETTINGS_PATH, DEFAULT_SETTINGS);
      saveJSON(SETTINGS_PATH, { ...s, windowWidth: w, windowHeight: h });
    }
  });

  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    if (url.startsWith('http://') || url.startsWith('https://')) {
      shell.openExternal(url);
    }
    return { action: 'deny' };
  });

  mainWindow.webContents.on('will-navigate', (event, url) => {
    const appUrl = pathToFileURL(path.join(__dirname, 'index.html')).toString();
    if (!url.startsWith('file://') && url !== appUrl) {
      event.preventDefault();
      if (url.startsWith('http://') || url.startsWith('https://')) {
        shell.openExternal(url);
      }
    }
  });
}

app.whenReady().then(() => {
  ensureAppDataDir();
  registerMediaProtocol();
  createWindow();
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on('before-quit', () => {
  cleanupActiveJobs();
});

app.on('window-all-closed', () => {
  cleanupActiveJobs();
  if (process.platform !== 'darwin') {
    app.quit();
  }
});