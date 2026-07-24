/**
 * renderer.js
 *
 * Main renderer entry point for Fel7o.
 * Coordinates UI rendering, playback, downloads,
 * history, and application initialization.
 */

/* ============================================================
   Imports
============================================================ */

// No external module imports in the browser process.
// Global SharedUtils is loaded via shared/shared-utils.js in index.html.

/* ============================================================
   Constants & Configuration
============================================================ */

const WELCOME_CONFIG = {
  fallbackName: 'friend',
  message: 'Glad you are using Fel7o - download YouTube videos and songs easily in high quality.',
  links: [
    { text: 'LinkedIn', url: 'https://www.linkedin.com/in/ahmed-el-falah-b771bb345?utm_source=share_via&utm_content=profile&utm_medium=member_android' },
    { text: 'Facebook', url: 'https://www.facebook.com/share/1GJ7rWrm1V/' },
    { text: 'YouTube', url: 'https://www.youtube.com/@Ahmed_59k' },
    { text: 'WhatsApp', url: 'https://wa.me/201205262412?text=Hello%20Ahmed,%20I%20am%20contacting%20you%20about%20Fel7o.' },
    { text: 'Email', url: 'mailto:ahmed.khaled.elfalah@gmail.com' }
  ],
};

const QUALITY_OPTIONS = {
  mp3: [
    { value: '128', label: '128 kbps' },
    { value: '192', label: '192 kbps' },
    { value: '320', label: '320 kbps' },
  ],
  video: [
    { value: 'best', label: 'Best available' },
    { value: '2160', label: '4K' },
    { value: '1440', label: '1440p' },
    { value: '1080', label: '1080p' },
    { value: '720', label: '720p' },
    { value: '480', label: '480p' },
  ],
};

const STATUS_LABEL = {
  queued: 'Queued',
  downloading: 'Downloading',
  paused: 'Paused',
  completed: 'Completed',
  error: 'Error',
  cancelled: 'Cancelled',
};

const META_ICONS = {
  eye: '<svg viewBox="0 0 24 24"><path d="M12 5c-7 0-10 7-10 7s3 7 10 7 10-7 10-7-3-7-10-7zm0 11.5A4.5 4.5 0 1 1 12 7.5a4.5 4.5 0 0 1 0 9zm0-7a2.5 2.5 0 1 0 0 5 2.5 2.5 0 0 0 0-5z"/></svg>',
  calendar: '<svg viewBox="0 0 24 24"><path d="M7 2v2H5a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6a2 2 0 0 0-2-2h-2V2h-2v2H9V2H7zm12 8v10H5V10h14z"/></svg>',
  resolution: '<svg viewBox="0 0 24 24"><path d="M4 5h16a1 1 0 0 1 1 1v12a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V6a1 1 0 0 1 1-1zm1 2v10h14V7H5zm2 2h4v2H7V9z"/></svg>',
  size: '<svg viewBox="0 0 24 24"><path d="M19.35 10.04A7.49 7.49 0 0 0 12 4C9.11 4 6.6 5.64 5.35 8.04A6 6 0 0 0 6 20h13a5 5 0 0 0 .35-9.96zM10 17l-3-3.5h2v-3h2v3h2L10 17z"/></svg>',
};

/* ============================================================
   State
============================================================ */

let currentScreen = 'home';
let globalAudio = null;
let currentPlayingId = null;
let lastPrevClickTime = 0;
let isDraggingProgress = false;
let lastSeekTime = 0;

const state = {
  playQueue: [],
  currentTrackIndex: -1,
  settings: null,
  jobs: new Map(),
  jobOrder: [],
  activeJobId: null,
  history: [],
  historyFilter: 'all',
  selectedMode: 'mp3',
  previewUrl: null,
  previewData: null,
  previewToken: 0,
  previewDebounce: null,
  playlist: {
    url: null,
    data: null,
    selected: new Set(),
    searchQuery: '',
    token: 0,
  },
  openMoreMenuId: null,
  openHistoryMenuId: null,
};

const playbackController = {
  queue: state.playQueue,
  currentIndex: -1,
  currentId: null,
  media: null,
  loading: false,
  pendingItem: null,
  playbackRate: 1,
};

/* ============================================================
   Utility Functions
============================================================ */

const el = (id) => document.getElementById(id);

function uid() {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function showToast(msg) {
  const t = el('toast');
  t.textContent = msg;
  t.hidden = false;
  clearTimeout(showToast._t);
  showToast._t = setTimeout(() => { t.hidden = true; }, 3000);
}

function escapeHtml(text) {
  if (text == null) return '';
  const div = document.createElement('div');
  div.textContent = String(text);
  return div.innerHTML.replace(/'/g, '&#39;');
}

function setSwitch(id, on) {
  const node = el(id);
  node.classList.toggle('on', !!on);
  node.dataset.on = on ? '1' : '0';
}

function isValidYoutubeUrl(url) {
  return window.SharedUtils ? window.SharedUtils.isValidYoutubeUrl(url) : false;
}

function parseSize(sizeStr) {
  if (!sizeStr) return 0;
  const match = sizeStr.match(/^([\d.]+)\s*([KMGT]?)i?B$/);
  if (!match) return 0;
  let bytes = parseFloat(match[1]);
  const unit = match[2];
  if (unit === 'K') bytes *= 1024;
  else if (unit === 'M') bytes *= 1024 * 1024;
  else if (unit === 'G') bytes *= 1024 * 1024 * 1024;
  else if (unit === 'T') bytes *= 1024 * 1024 * 1024 * 1024;
  return bytes;
}

function formatBytes(bytes) {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return (bytes / Math.pow(k, i)).toFixed(1) + ' ' + sizes[i];
}

function formatTime(seconds) {
  if (Number.isNaN(seconds) || seconds === Infinity) return '00:00';
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
}

function parseDurationToSeconds(str) {
  if (!str) return 0;
  const parts = str.split(':').map(Number);
  if (parts.some(Number.isNaN)) return 0;
  if (parts.length === 2) {
    return parts[0] * 60 + parts[1];
  } else if (parts.length === 3) {
    return parts[0] * 3600 + parts[1] * 60 + parts[2];
  }
  return 0;
}

function getDownloadedSize(job) {
  if (!job.totalSize || job.percent === undefined) return '0 B';
  const totalBytes = parseSize(job.totalSize);
  const downloadedBytes = (job.percent / 100) * totalBytes;
  return formatBytes(downloadedBytes);
}

function getRemainingSize(job) {
  if (!job.totalSize || job.percent === undefined) return '—';
  const totalBytes = parseSize(job.totalSize);
  const downloadedBytes = (job.percent / 100) * totalBytes;
  const remainingBytes = totalBytes - downloadedBytes;
  return formatBytes(remainingBytes);
}

function bitrateKbpsForQuality(mode, qualityValue) {
  if (mode === 'mp3') return parseInt(qualityValue, 10) || 192;
  return { '2160': 40000, '1440': 16000, '1080': 8000, '720': 5000, '480': 2500, best: 8000 }[qualityValue] || 8000;
}

function estimateSizeForSelectedQuality(info) {
  const durationSecs = info && info.durationSecs;
  if (!durationSecs) return null;
  const qualityValue = el('qualitySelect').value;
  const bitrateKbps = bitrateKbpsForQuality(state.selectedMode, qualityValue);
  const bytes = (bitrateKbps * 1000 / 8) * durationSecs;
  return SharedUtils.formatApproxSize(bytes);
}

function estimateVideoBytes(durationSecs) {
  if (!durationSecs) return 0;
  const bitrateKbps = bitrateKbpsForQuality(state.selectedMode, el('qualitySelect').value);
  return (bitrateKbps * 1000 / 8) * durationSecs;
}

function historyKind(entry) {
  return entry.mode === 'video' || entry.videoQuality ? 'video' : 'audio';
}

function historyQuality(entry) {
  if (historyKind(entry) === 'video') return entry.videoQuality ? `${entry.videoQuality}p` : 'Video';
  return entry.audioQuality ? `${entry.audioQuality} kbps` : 'Hi-Res';
}

function parseHistoryBytes(entry) {
  const raw = entry.totalSize || entry.size || entry.estimatedSize || '';
  return parseSize(raw);
}

function formatHistoryDate(value) {
  if (!value) return 'Recently';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return 'Recently';
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

/* ============================================================
   Rendering
============================================================ */

function navigateTo(screen) {
  const homeEl = el('homeScreen');
  const historyEl = el('historyOverlay');
  const homeToolbar = el('homeToolbar');
  const historyToolbar = el('historyToolbar');

  if (homeEl) { homeEl.hidden = true; homeEl.style.display = 'none'; }
  if (historyEl) { historyEl.hidden = true; historyEl.style.display = 'none'; }
  if (homeToolbar) { homeToolbar.hidden = true; homeToolbar.style.display = 'none'; }
  if (historyToolbar) { historyToolbar.hidden = true; historyToolbar.style.display = 'none'; }

  const homeHeader = el('homeHeader');
  if (homeHeader) { homeHeader.hidden = false; homeHeader.style.display = 'flex'; }

  currentScreen = screen;
  switch (screen) {
    case 'history':
      if (historyEl) { historyEl.hidden = false; historyEl.style.display = 'flex'; }
      if (historyToolbar) { historyToolbar.hidden = false; historyToolbar.style.display = 'flex'; }
      el('historyBtn')?.classList.add('bg-accent-cyan', 'text-on-primary');
      el('historyBtn')?.classList.remove('hover:bg-surface-container', 'text-on-surface');
      el('homeNavBtn')?.classList.remove('bg-accent-cyan', 'text-on-primary');
      el('homeNavBtn')?.classList.add('hover:bg-surface-container', 'text-on-surface');
      break;
    case 'home':
    default:
      if (homeEl) { homeEl.hidden = false; homeEl.style.display = 'block'; }
      if (homeToolbar) { homeToolbar.hidden = false; homeToolbar.style.display = 'flex'; }
      el('homeNavBtn')?.classList.add('bg-accent-cyan', 'text-on-primary');
      el('homeNavBtn')?.classList.remove('hover:bg-surface-container', 'text-on-surface');
      el('historyBtn')?.classList.remove('bg-accent-cyan', 'text-on-primary');
      el('historyBtn')?.classList.add('hover:bg-surface-container', 'text-on-surface');
      break;
  }
}

function refreshPreviewBadgesIfShown() {
  if (state.previewUrl && state.previewData) {
    renderPreviewCard(state.previewUrl, state.previewData);
  }
}

function getLinkIconSvg(name) {
  const lower = name.toLowerCase();
  if (lower.includes('linkedin')) {
    return `<svg viewBox="0 0 24 24" width="14" height="14" fill="currentColor" style="flex-shrink:0;"><path d="M19 0h-14c-2.761 0-5 2.239-5 5v14c0 2.761 2.239 5 5 5h14c2.762 0 5-2.239 5-5v-14c0-2.761-2.238-5-5-5zm-11 19h-3v-11h3v11zm-1.5-12.268c-.966 0-1.75-.79-1.75-1.764s.784-1.764 1.75-1.764 1.75.79 1.75 1.764-.783 1.764-1.75 1.764zm13.5 12.268h-3v-5.604c0-3.368-4-3.113-4 0v5.604h-3v-11h3v1.765c1.396-2.586 7-2.777 7 2.476v6.759z"/></svg>`;
  }
  if (lower.includes('facebook')) {
    return `<svg viewBox="0 0 24 24" width="14" height="14" fill="currentColor" style="flex-shrink:0;"><path d="M22 12c0-5.52-4.48-10-10-10S2 6.48 2 12c0 4.84 3.44 8.87 8 9.8V15H8v-3h2V9.5C10 7.57 11.57 6 13.5 6H16v3h-2c-.55 0-1 .45-1 1v2h3v3h-3v6.95c4.56-.93 8-4.96 8-9.75z"/></svg>`;
  }
  if (lower.includes('youtube')) {
    return `<svg viewBox="0 0 24 24" width="14" height="14" fill="currentColor" style="flex-shrink:0;"><path d="M23.498 6.163a3.003 3.003 0 0 0-2.11-2.108C19.518 3.54 12 3.54 12 3.54s-7.518 0-9.388.515a3.003 3.003 0 0 0-2.11 2.108C0 8.033 0 12 0 12s0 3.967.502 5.837a3.003 3.003 0 0 0 2.11 2.108C4.482 20.46 12 20.46 12 20.46s7.518 0 9.388-.515a3.003 3.003 0 0 0 2.11-2.108C24 15.967 24 12 24 12s0-3.967-.502-5.837zM9.545 15.568V8.432L15.818 12l-6.273 3.568z"/></svg>`;
  }
  if (lower.includes('whatsapp')) {
    return `<svg viewBox="0 0 24 24" width="14" height="14" fill="currentColor" style="flex-shrink:0;"><path d="M.057 24l1.687-6.163c-1.041-1.804-1.588-3.849-1.587-5.946C.003 5.324 5.328 0 11.859 0c3.166.001 6.141 1.233 8.377 3.469 2.235 2.237 3.465 5.212 3.464 8.377-.003 6.536-5.328 11.86-11.859 11.86h-.002c-2.003 0-3.975-.538-5.717-1.56L0 24zm6.275-3.818l.385.229c1.602.951 3.473 1.452 5.397 1.453h.001c5.541 0 10.049-4.508 10.052-10.05.001-2.686-1.042-5.211-2.937-7.106C17.332 2.812 14.808 1.77 12.122 1.77 6.58 1.77 2.072 6.278 2.069 11.82c-.001 1.838.479 3.633 1.391 5.234l.25.438-.992 3.623 3.714-.973zm10.741-5.184c-.292-.146-1.727-.852-1.993-.948-.266-.096-.459-.144-.652.146-.193.29-.747.948-.916 1.139-.169.193-.338.217-.63.072-.292-.146-1.233-.454-2.35-1.451-.869-.775-1.456-1.733-1.626-2.024-.169-.292-.018-.45.129-.595.132-.13.292-.34.438-.51.146-.17.195-.29.292-.485.097-.194.048-.364-.024-.51-.072-.146-.652-1.573-.893-2.155-.235-.568-.474-.49-.652-.499-.169-.008-.362-.01-.555-.01-.193 0-.507.073-.772.361-.266.29-1.013.989-1.013 2.41 0 1.42 1.037 2.793 1.182 2.987.145.195 2.041 3.116 4.945 4.368.691.298 1.23.476 1.65.61.694.221 1.326.19 1.825.115.556-.083 1.727-.706 1.969-1.388.242-.682.242-1.266.17-1.388-.073-.122-.266-.195-.558-.341z"/></svg>`;
  }
  if (lower.includes('email') || lower.includes('mail')) {
    return `<svg viewBox="0 0 24 24" width="14" height="14" fill="currentColor" style="flex-shrink:0;"><path d="M20 4H4c-1.1 0-1.99.9-1.99 2L2 18c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V6c0-1.1-.9-2-2-2zm0 4l-8 5-8-5V6l8 5 8-5v2z"/></svg>`;
  }
  return `<svg viewBox="0 0 24 24" width="14" height="14" fill="currentColor" style="flex-shrink:0;"><path d="M14 3h7v7h-2V6.41l-9.29 9.3-1.42-1.42 9.3-9.29H14V3zM5 5h6v2H5v12h12v-6h2v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V7a2 2 0 0 1 2-2z"/></svg>`;
}

function renderPreviewSkeleton() {
  const section = el('urlPreviewSection');
  section.hidden = false;
  section.classList.add('preview-animate-in');
  section.innerHTML = `
    <div class="url-preview-card skeleton-card content-swap-in">
      <div class="skeleton sk-thumb"></div>
      <div class="sk-col">
        <div class="skeleton sk-title"></div>
        <div class="skeleton sk-title short"></div>
        <div class="skeleton sk-channel"></div>
        <div class="sk-row">
          <div class="skeleton sk-chip"></div>
          <div class="skeleton sk-chip"></div>
          <div class="skeleton sk-chip"></div>
        </div>
      </div>
    </div>`;
}

function renderPreviewError(message) {
  const section = el('urlPreviewSection');
  section.hidden = false;
  section.classList.add('preview-animate-in');
  section.innerHTML = `
    <div class="url-preview-card preview-error content-swap-in">
      <div class="preview-error-icon"><span class="material-symbols-outlined">error</span></div>
      <div class="preview-error-body">
        <div class="preview-error-text">${escapeHtml(message)}</div>
        <div class="preview-error-sub">Make sure the link is correct and try again</div>
      </div>
      <button type="button" class="preview-error-retry" id="previewRetryBtn">Retry</button>
    </div>`;
  const retryBtn = document.getElementById('previewRetryBtn');
  if (retryBtn) {
    retryBtn.addEventListener('click', () => scheduleUrlPreview(el('urlInput').value, true));
  }
}

function renderPreviewCard(url, info) {
  const section = el('urlPreviewSection');
  section.hidden = false;
  section.classList.add('preview-animate-in');

  const badges = [];
  if (info.isLive) badges.push(`<span class="badge badge-live"><span class="preview-live-dot"></span> Live</span>`);
  if (info.isShort) badges.push(`<span class="badge badge-shorts">Shorts</span>`);
  if (info.isPlaylistLink) badges.push(`<span class="badge badge-playlist">Playlist</span>`);
  badges.push(`<span class="badge badge-format">${state.selectedMode === 'mp3' ? 'MP3' : 'MP4'}</span>`);
  badges.push(`<span class="badge badge-quality">${escapeHtml(el('qualitySelect').value)}${state.selectedMode === 'mp3' ? 'k' : 'p'}</span>`);

  const metaItems = [];
  if (info.viewCount) metaItems.push(`<span class="preview-meta-item">${META_ICONS.eye}${escapeHtml(info.viewCount)} views</span>`);
  if (info.uploadDate) metaItems.push(`<span class="preview-meta-item">${META_ICONS.calendar}${escapeHtml(info.uploadDate)}</span>`);
  if (info.resolution) metaItems.push(`<span class="preview-meta-item">${META_ICONS.resolution}${escapeHtml(info.resolution)}</span>`);
  const dynamicSize = estimateSizeForSelectedQuality(info);
  const displaySize = dynamicSize || info.estimatedSize;
  if (displaySize) {
    metaItems.push(`<span class="preview-meta-item">${META_ICONS.size}${escapeHtml(displaySize)}~</span>`);
  } else {
    metaItems.push(`<span class="preview-meta-item is-placeholder">${META_ICONS.size}Size unknown</span>`);
  }

  section.innerHTML = `
    <div class="url-preview-card content-swap-in">
      <div class="preview-thumb-wrap">
        <div class="preview-thumb" id="previewThumb" title="Open in browser" ${info.thumbnail ? `style="background-image:url('${escapeHtml(info.thumbnail)}')"` : ''}>
          <div class="preview-thumb-overlay">
            <span class="material-symbols-outlined fill-icon">${state.selectedMode === 'mp3' ? 'graphic_eq' : 'play_arrow'}</span>
          </div>
          <div class="preview-thumb-badges">${badges.join('')}</div>
        </div>
      </div>
      <div class="preview-content">
        <div class="preview-kicker">Ready to queue</div>
        <div class="preview-title">${escapeHtml(info.title || url)}</div>
        <div class="preview-channel">${escapeHtml(info.channel || '—')}</div>
        <div class="preview-meta">${metaItems.join('')}</div>
      </div>
    </div>`;

  const thumb = document.getElementById('previewThumb');
  if (thumb && info.url) {
    thumb.addEventListener('click', () => window.fel7o.openExternal(info.url));
    thumb.style.cursor = 'pointer';
  }
}

function updateQueueStats() {
  const stats = {
    downloading: 0,
    waiting: 0,
    completed: 0,
    failed: 0,
    totalPercent: 0,
    totalSpeed: 0,
  };

  let totalPercent = 0;
  let countedJobs = 0;

  state.jobOrder.forEach((id) => {
    const job = state.jobs.get(id);
    if (!job) return;
    if (job.status === 'downloading') {
      stats.downloading++;
      totalPercent += job.percent || 0;
      countedJobs++;
    } else if (job.status === 'queued') {
      stats.waiting++;
      countedJobs++;
    } else if (job.status === 'completed') {
      stats.completed++;
      totalPercent += 100;
      countedJobs++;
    } else if (job.status === 'error' || job.status === 'cancelled') {
      stats.failed++;
    }
  });

  el('queueStats').hidden = false;
  el('queueStatDownloading').textContent = stats.downloading;
  el('queueStatWaiting').textContent = stats.waiting;
  el('queueStatCompleted').textContent = stats.completed;
  el('queueStatActiveTotal').textContent = stats.downloading + stats.waiting;

  const avgPercent = countedJobs > 0 ? Math.round(totalPercent / countedJobs) : 0;
  el('queueStatProgress').textContent = `${avgPercent}%`;

  let totalSpeed = 0;
  state.jobOrder.forEach((id) => {
    const job = state.jobs.get(id);
    if (job && job.status === 'downloading' && job.speed) {
      const match = job.speed.match(/(\d+(?:\.\d+)?)\s*(MB|KB|GB)\/s/);
      if (match) {
        let speedMbs = parseFloat(match[1]);
        if (match[2] === 'KB') speedMbs /= 1024;
        else if (match[2] === 'GB') speedMbs *= 1024;
        totalSpeed += speedMbs;
      }
    }
  });
  el('queueStatSpeed').textContent = totalSpeed > 0 ? `${totalSpeed.toFixed(1)} MB/s` : '—';
  el('queueStatTrend').textContent = totalSpeed > 0 ? '+ live' : '+0%';

  const failedLine = el('queueStatFailedLine');
  failedLine.hidden = stats.failed === 0;
  failedLine.textContent = stats.failed === 1 ? '1 failed item' : `${stats.failed} failed items`;

  const completedThumbs = state.jobOrder
    .map((id) => state.jobs.get(id))
    .filter((job) => job && job.status === 'completed' && job.thumbnail)
    .slice(0, 3);
  const stack = el('queueStatThumbStack');
  if (completedThumbs.length === 0) {
    stack.innerHTML = '';
  } else {
    const extraCount = stats.completed - completedThumbs.length;
    stack.innerHTML = `
      ${completedThumbs.map((job) => {
        return `<span class="stat-thumb-circle" style="background-image:url('${escapeHtml(job.thumbnail)}')"></span>`;
      }).join('')}
      ${extraCount > 0 ? `<b class="stat-thumb-badge">+${extraCount}</b>` : ''}
    `;
  }
}

function renderQueue() {
  const list = el('queueList');
  const queueItems = state.jobOrder.map((id) => state.jobs.get(id)).filter(Boolean);
  el('queueCount').textContent = `${state.jobOrder.length} items`;
  updateQueueStats();

  if (state.jobOrder.length === 0) {
    list.innerHTML = `
      <div class="empty-state-card" style="max-width: 430px;">
        <span class="material-symbols-outlined text-[42px] text-accent-cyan opacity-80 mb-1">download</span>
        <h4 class="text-base font-bold text-white leading-snug">No downloads in the queue yet</h4>
        <p class="text-xs text-on-surface-variant max-w-[300px] leading-relaxed">Paste a YouTube URL above to start your first download.</p>
      </div>
    `;
    return;
  }

  list.innerHTML = queueItems.map((job) => {
    const progressPercent = job.percent || 0;
    const format = job.mode === 'mp3' ? 'MP3' : 'MP4';
    const quality = job.mode === 'mp3' ? `${job.audioQuality}kbps` : job.videoQuality;
    const statusLabel = STATUS_LABEL[job.status] || job.status;
    const detailParts = [format, quality];
    if (job.totalSize) detailParts.push(job.totalSize);
    else if (job.channel) detailParts.push(job.channel);
    const detailLine = detailParts.map(escapeHtml).join(' • ');
    const isDownloading = job.status === 'downloading';
    const isCompleted = job.status === 'completed';
    const isMuted = !isDownloading && !isCompleted;
    const progressWidth = isCompleted ? 100 : progressPercent;
    const stateMeta = (() => {
      if (isDownloading) return `<span>${progressPercent.toFixed(0)}%</span><p>${escapeHtml(job.speed || 'Starting...')}</p>`;
      if (isCompleted) return `<span class="queue-status-completed"><span class="material-symbols-outlined fill-icon">check_circle</span>Completed</span>`;
      if (job.status === 'paused') return `<span>Paused</span><p>Ready to resume</p>`;
      if (job.status === 'error') return `<span class="queue-status-error">Error</span><p>Needs retry</p>`;
      if (job.status === 'cancelled') return `<span>Cancelled</span><p>Removed from engine</p>`;
      return `<span>Queued</span><p>Waiting for slot...</p>`;
    })();
    const actionButtons = (() => {
      if (job.status === 'downloading') return `
        <button class="queue-action-btn pause-job" data-id="${job.id}" title="Pause"><span class="material-symbols-outlined">pause</span></button>
        <button class="queue-action-btn cancel-job danger-action" data-id="${job.id}" title="Cancel"><span class="material-symbols-outlined">close</span></button>
      `;
      if (job.status === 'paused') return `
        <button class="queue-action-btn resume-job" data-id="${job.id}" title="Resume"><span class="material-symbols-outlined">play_arrow</span></button>
        <button class="queue-action-btn cancel-job danger-action" data-id="${job.id}" title="Cancel"><span class="material-symbols-outlined">close</span></button>
      `;
      if (job.status === 'queued') return `
        <button class="queue-action-btn cancel-job danger-action" data-id="${job.id}" title="Cancel"><span class="material-symbols-outlined">close</span></button>
      `;
      if (job.status === 'error') return `
        <button class="queue-action-btn retry-job" data-id="${job.id}" title="Retry"><span class="material-symbols-outlined">refresh</span></button>
        <button class="queue-action-btn remove-job danger-action" data-id="${job.id}" title="Remove"><span class="material-symbols-outlined">delete</span></button>
      `;
      return `
        <button class="queue-action-btn open-folder" data-id="${job.id}" title="Open Folder"><span class="material-symbols-outlined">folder_open</span></button>
      `;
    })();

    return `
      <div class="queue-card liquid-card ${isDownloading ? 'is-downloading' : ''} ${isCompleted ? 'is-completed' : ''} ${isMuted ? 'is-muted' : ''}" data-id="${job.id}">
        <div class="queue-thumb ${isMuted ? 'is-grayscale' : ''}" ${job.thumbnail ? `style="background-image:url('${escapeHtml(job.thumbnail)}')"` : ''}>
          ${isDownloading ? `<div class="queue-thumb-overlay"><span class="material-symbols-outlined fill-icon animate-breathe">downloading</span></div>` : ''}
          ${isCompleted ? `<div class="queue-thumb-hover"><span class="material-symbols-outlined">play_arrow</span></div>` : ''}
        </div>
        <div class="queue-info">
          <div class="queue-main-row">
            <div class="queue-header">
              <div class="queue-title">${escapeHtml(job.title)}</div>
              <div class="queue-channel">${detailLine}</div>
            </div>
            <div class="queue-state">${stateMeta}</div>
          </div>
          <div class="queue-progress-track">
            <div class="queue-progress-fill ${job.status === 'error' ? 'err' : ''}" style="width:${progressWidth}%">
              ${isDownloading ? '<div class="shimmer-progress"></div>' : ''}
            </div>
          </div>
          ${isDownloading ? `<div class="queue-download-meta">
            <span>ETA ${escapeHtml(job.eta || '—')}</span>
            <span>${getDownloadedSize(job)} downloaded</span>
            <span>${getRemainingSize(job)} remaining</span>
          </div>` : ''}
          ${job.status === 'error' && job.errorMessage ? `<div class="queue-error-reason">${escapeHtml(job.errorMessage)}</div>` : ''}
        </div>
        <div class="queue-actions">
          ${actionButtons}
          <div class="queue-more-menu">
            <button class="queue-action-btn more-menu-btn" data-id="${job.id}" title="More">
              <span class="material-symbols-outlined">more_vert</span>
            </button>
            <div class="queue-more-menu-content" ${state.openMoreMenuId === job.id ? '' : 'hidden'}>
              <button class="queue-menu-item open-folder-menu" data-id="${job.id}">
                <span class="material-symbols-outlined">folder_open</span>
                <span>Open Folder</span>
              </button>
              <button class="queue-menu-item copy-url-menu" data-id="${job.id}" data-url="${escapeHtml(job.url)}">
                <span class="material-symbols-outlined">content_copy</span>
                <span>Copy URL</span>
              </button>
              <button class="queue-menu-item open-url-menu" data-id="${job.id}" data-url="${escapeHtml(job.url)}">
                <span class="material-symbols-outlined">open_in_new</span>
                <span>Open in browser</span>
              </button>
            </div>
          </div>
        </div>
      </div>
    `;
  }).join('');

  list.querySelectorAll('.pause-job').forEach((btn) => btn.addEventListener('click', () => pauseJob(btn.dataset.id)));
  list.querySelectorAll('.resume-job').forEach((btn) => btn.addEventListener('click', () => resumeJob(btn.dataset.id)));
  list.querySelectorAll('.cancel-job').forEach((btn) => btn.addEventListener('click', () => cancelJob(btn.dataset.id)));
  list.querySelectorAll('.retry-job').forEach((btn) => btn.addEventListener('click', () => retryJob(btn.dataset.id)));
  list.querySelectorAll('.remove-job').forEach((btn) => btn.addEventListener('click', () => removeFromQueueUI(btn.dataset.id)));
  list.querySelectorAll('.open-folder').forEach((btn) => btn.addEventListener('click', () => openFolder(btn.dataset.id)));

  list.querySelectorAll('.more-menu-btn').forEach((btn) => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      const jobId = btn.dataset.id;
      state.openMoreMenuId = state.openMoreMenuId === jobId ? null : jobId;
      renderQueue();
    });
  });

  list.querySelectorAll('.open-folder-menu').forEach((btn) => {
    btn.addEventListener('click', () => openFolder(btn.dataset.id));
  });

  list.querySelectorAll('.copy-url-menu').forEach((btn) => {
    btn.addEventListener('click', () => {
      const url = btn.dataset.url;
      navigator.clipboard.writeText(url).then(() => {
        showToast('URL copied to clipboard.');
      });
    });
  });

  list.querySelectorAll('.open-url-menu').forEach((btn) => {
    btn.addEventListener('click', () => {
      const url = btn.dataset.url;
      window.fel7o.openExternal(url);
    });
  });
}

function updatePlayingCard() {
  const isPlaying = currentPlayingId && globalAudio && !globalAudio.paused;
  const list = el('historyList');
  if (!list) {
    updateMiniPlayer();
    return;
  }

  list.querySelectorAll('.history-media-card').forEach((card) => {
    const cardId = card.dataset.id;
    const isActive = currentPlayingId && cardId && String(currentPlayingId) === String(cardId);
    card.classList.toggle('is-active-track', !!isActive);
    
    const thumb = card.querySelector('.history-media-thumb');
    if (!thumb) return;

    let eqBadge = thumb.querySelector('.card-eq-badge');
    if (isActive) {
      if (!eqBadge) {
        eqBadge = document.createElement('div');
        eqBadge.className = 'card-eq-badge';
        eqBadge.innerHTML = '<div class="ceq-bar"></div><div class="ceq-bar"></div><div class="ceq-bar"></div>';
        thumb.appendChild(eqBadge);
      }
      eqBadge.classList.toggle('is-paused', !isPlaying);
    } else if (eqBadge) {
      eqBadge.remove();
    }

    const playBtn = thumb.querySelector('.history-play-btn');
    if (playBtn) {
      playBtn.classList.toggle('playing', !!(isActive && isPlaying));
      const iconSpan = playBtn.querySelector('.material-symbols-outlined');
      if (iconSpan) {
        iconSpan.textContent = (isActive && isPlaying) ? 'pause' : 'play_arrow';
      }
      playBtn.title = (isActive && isPlaying) ? 'Pause' : 'Play';
    }
  });

  updateMiniPlayer();
}

function updateMiniPlayer() {
  const miniPlayer = el('miniPlayer');
  if (!miniPlayer) return;

  const allItems = state.history || [];
  const currentItem = currentPlayingId ? allItems.find(h => h.id && String(h.id) === String(currentPlayingId)) : null;
  const isPlaying = currentPlayingId && globalAudio && !globalAudio.paused;

  const titleEl = el('miniPlayerTitle');
  const artistEl = el('miniPlayerArtist');
  const artworkEl = el('miniPlayerArtwork');
  const playIcon = el('miniPlayIcon');
  const prevBtn = el('miniPrevBtn');
  const nextBtn = el('miniNextBtn');
  const playBtn = el('miniPlayBtn');
  const eqEl = el('miniEqualizer');

  if (!currentItem) {
    miniPlayer.style.opacity = '0.5';
    miniPlayer.style.pointerEvents = 'auto';
    titleEl.textContent = 'No track playing';
    titleEl.title = '';
    artistEl.textContent = 'Select a track below';
    if (artworkEl) {
      artworkEl.src = 'assets/logo.png';
      artworkEl.classList.remove('opacity-0', 'pointer-events-none');
    }
    playIcon.textContent = 'play_arrow';

    if (eqEl) {
      eqEl.classList.add('hidden');
    }

    const currentTimeLabel = el('miniCurrentTime');
    const totalTimeLabel = el('miniTotalTime');
    const progressBar = el('miniProgressBar');
    const progressThumb = el('miniProgressThumb');

    if (currentTimeLabel) currentTimeLabel.textContent = '00:00';
    if (totalTimeLabel) totalTimeLabel.textContent = '00:00';
    if (progressBar) progressBar.style.width = '0%';
    if (progressThumb) progressThumb.style.left = '0%';

    playBtn.disabled = playbackController.queue.length === 0;
    prevBtn.disabled = true;
    nextBtn.disabled = true;
    return;
  }

  miniPlayer.style.opacity = '1';
  miniPlayer.style.pointerEvents = 'auto';
  const fullTitle = currentItem.title || 'Untitled';
  titleEl.textContent = fullTitle;
  titleEl.title = fullTitle;
  artistEl.textContent = currentItem.channel || 'Local File';
  if (artworkEl) {
    artworkEl.src = currentItem.thumbnail || 'assets/logo.png';
    artworkEl.classList.remove('opacity-0', 'pointer-events-none');
  }
  const miniPoster = el('ampPoster');
  if (miniPoster) {
    miniPoster.src = currentItem.thumbnail || 'assets/logo.png';
  }
  playIcon.textContent = isPlaying ? 'pause' : 'play_arrow';
  playBtn.disabled = false;

  const totalTimeLabel = el('miniTotalTime');
  if (totalTimeLabel && currentItem.duration) {
    totalTimeLabel.textContent = currentItem.duration;
  }

  if (eqEl) {
    eqEl.classList.remove('hidden');
    eqEl.classList.toggle('is-paused', !isPlaying);
  }

  const titleContainer = document.querySelector('.mini-title-container');
  if (titleContainer && titleEl) {
    titleEl.title = fullTitle;
    const prevDisplay = titleEl.style.display;
    titleEl.style.display = 'inline-block';
    titleEl.style.overflow = 'visible';
    titleEl.style.textOverflow = 'clip';
    const scrollDist = titleEl.scrollWidth - titleContainer.offsetWidth;
    titleEl.style.display = prevDisplay;
    titleEl.style.overflow = '';
    titleEl.style.textOverflow = '';
    if (scrollDist > 4) {
      titleEl.classList.add('is-overflowing');
      titleEl.style.setProperty('--marquee-offset', `-${scrollDist + 16}px`);
    } else {
      titleEl.classList.remove('is-overflowing');
      titleEl.style.removeProperty('--marquee-offset');
    }
  }

  const queue = playbackController.queue || [];
  const singleItem = queue.length <= 1;

  prevBtn.disabled = singleItem;
  nextBtn.disabled = singleItem;
}

function renderHistory() {
  const q = (el('historySearch').value || '').trim().toLowerCase();
  const list = el('historyList');
  const allItems = state.history || [];

  const searchInput = el('historySearch');
  const placeholders = { all: 'Search media...', video: 'Search videos...', audio: 'Search songs...' };
  if (searchInput) {
    searchInput.placeholder = placeholders[state.historyFilter] || 'Search media...';
  }

  const filterKind = state.historyFilter;
  const statsItems = filterKind === 'all'
    ? allItems
    : allItems.filter(h => historyKind(h) === filterKind);
  const statsBytes = statsItems.reduce((sum, item) => sum + parseHistoryBytes(item), 0);

  el('historyTotalData').textContent = statsBytes > 0 ? formatBytes(statsBytes) : '—';

  if (filterKind === 'video') {
    el('historyArchiveSize').textContent = `${statsItems.length} ${statsItems.length === 1 ? 'Video' : 'Videos'}`;
  } else if (filterKind === 'audio') {
    el('historyArchiveSize').textContent = `${statsItems.length} ${statsItems.length === 1 ? 'Track' : 'Tracks'}`;
  } else {
    el('historyArchiveSize').textContent = `${allItems.length} ${allItems.length === 1 ? 'Item' : 'Items'}`;
  }

  el('historyEngineStatus').textContent = `Download Engine: ${allItems.length} archived`;

  el('historyFilters').querySelectorAll('.history-filter-btn').forEach((btn) => {
    btn.classList.toggle('is-active', state.historyFilter === btn.dataset.filter);
  });

  const items = allItems.filter((h) => {
    const searchable = `${h.title || ''} ${h.channel || ''} ${h.url || ''} ${h.playlistFolder || ''}`.toLowerCase();
    const matchesSearch = !q || searchable.includes(q);
    const matchesFilter = filterKind === 'all' || !filterKind || historyKind(h) === filterKind;
    return matchesSearch && matchesFilter;
  });

  state.filteredHistory = items;
  if (!playbackController.currentId && !playbackController.loading) {
    setPlaybackQueue(items);
  } else {
    syncPlaybackState();
  }
  updateMiniPlayer();

  if (items.length === 0) {
    list.innerHTML = `
      <div class="empty-state-card" style="grid-column: 1 / -1; max-width: 430px;">
        <span class="material-symbols-outlined text-[42px] text-accent-cyan opacity-80 mb-1">graphic_eq</span>
        <h4 class="text-base font-bold text-white leading-snug">No history items found</h4>
        <p class="text-xs text-on-surface-variant max-w-[300px] leading-relaxed">Downloaded media will appear here once you start using Fel7o.</p>
        <button class="btn btn-secondary mt-2 px-4 py-2 text-xs font-semibold rounded-xl bg-white/5 hover:bg-white/10 border border-white/5 text-white transition-all duration-200" onclick="navigateTo('home')">
          Go to Home
        </button>
      </div>
    `;
    return;
  }

  list.innerHTML = items.map((h) => {
    const kind = historyKind(h);
    const isVideo = kind === 'video';
    const kindLabel = isVideo ? 'Video' : 'Audio';
    const sizeText = h.totalSize || h.size || h.estimatedSize || (isVideo ? 'Video' : 'Audio');
    const metaParts = [];
    if (h.channel) metaParts.push(h.channel);
    if (h.duration) metaParts.push(h.duration);
    else if (h.playlistFolder) metaParts.push(h.playlistFolder);
    else metaParts.push(isVideo ? 'Media file' : 'Music track');

    const isActive = currentPlayingId && h.id && String(currentPlayingId) === String(h.id);
    const isPlaying = isActive && globalAudio && !globalAudio.paused;
    const playIcon = isPlaying ? 'pause' : 'play_arrow';
    const playingClass = isPlaying ? 'playing' : '';

    return `
      <article class="history-media-card media-card group ${isActive ? 'is-active-track' : ''}" data-id="${escapeHtml(h.id || '')}">
        <div class="history-media-thumb custom-shadow" data-folder="${escapeHtml(h.folder || '')}" data-title="${escapeHtml(h.title || '')}" data-mode="${escapeHtml(h.mode || '')}">
          <div class="history-media-image" ${h.thumbnail ? `style="background-image:url('${escapeHtml(h.thumbnail)}')"` : ''}></div>
          <div class="history-hover-overlay">
            <button class="history-play-btn ${isVideo ? '' : 'is-violet'} ${playingClass}" type="button" title="${isPlaying ? 'Pause' : 'Play'}">
              <span class="material-symbols-outlined fill-icon">${playIcon}</span>
            </button>
          </div>
          <div class="history-card-badges">
            <span class="history-quality-badge glass-panel">${escapeHtml(historyQuality(h))}</span>
            <span class="history-kind-badge ${isVideo ? '' : 'is-violet'}">${kindLabel}</span>
          </div>
          ${isActive ? `<div class="card-eq-badge ${isPlaying ? '' : 'is-paused'}">
            <div class="ceq-bar"></div><div class="ceq-bar"></div><div class="ceq-bar"></div>
          </div>` : ''}
        </div>
        
        <div class="history-more-menu">
          <button class="history-more-btn" data-id="${escapeHtml(h.id || '')}" type="button" title="Actions">
            <span class="material-symbols-outlined">more_vert</span>
          </button>
          <div class="history-more-menu-content" ${state.openHistoryMenuId === h.id ? '' : 'hidden'}>
            <button class="history-menu-item open-folder-menu" data-folder="${escapeHtml(h.folder || '')}">
              <span class="material-symbols-outlined">folder_open</span>
              <span>Open Folder</span>
            </button>
            <button class="history-menu-item open-url-menu" data-url="${escapeHtml(h.url || '')}">
              <span class="material-symbols-outlined">open_in_new</span>
              <span>Open YouTube</span>
            </button>
            <div class="history-menu-divider"></div>
            <button class="history-menu-item delete-history-menu danger-menu-item" data-id="${escapeHtml(h.id || '')}">
              <span class="material-symbols-outlined">delete</span>
              <span>Delete</span>
            </button>
          </div>
        </div>

        <div class="history-card-copy">
          <h3>${escapeHtml(h.title || h.url || 'Untitled download')}</h3>
          <p>${escapeHtml(metaParts.join(' • '))}</p>
          <div class="history-card-meta">
            <span>${escapeHtml(sizeText)} • ${formatHistoryDate(h.date)}</span>
            <div class="history-card-actions">
              <button class="history-card-icon open-folder" data-folder="${escapeHtml(h.folder || '')}" type="button" title="Open Folder">
                <span class="material-symbols-outlined">folder_open</span>
              </button>
              <button class="history-card-icon open-history-url" data-url="${escapeHtml(h.url || '')}" type="button" title="Open Source">
                <span class="material-symbols-outlined">share</span>
              </button>
            </div>
          </div>
        </div>
      </article>
    `;
  }).join('');
}

function renderPlaylistError(message) {
  el('playlistLoading').hidden = true;
  el('playlistError').hidden = false;
  el('playlistContent').hidden = true;
  el('playlistFooter').hidden = true;
  el('playlistErrorText').textContent = message;
}

function renderPlaylistContent() {
  const data = state.playlist.data;
  if (!data) return;

  el('playlistSummaryTitle').textContent = data.title || 'Playlist';
  el('playlistSummarySub').textContent = data.channel || '—';
  el('playlistStatCount').textContent = data.videos.length;
  el('playlistStatSelected').textContent = state.playlist.selected.size;

  const selectedVideos = data.videos.filter((v) => state.playlist.selected.has(v.id));

  let totalDuration = 0;
  selectedVideos.forEach((v) => { totalDuration += v.durationSecs || 0; });
  const hours = Math.floor(totalDuration / 3600);
  const mins = Math.floor((totalDuration % 3600) / 60);
  el('playlistStatDuration').textContent = SharedUtils.formatDurationHM(hours, mins);

  const totalBytes = selectedVideos.reduce((sum, v) => sum + estimateVideoBytes(v.durationSecs), 0);
  const sizeLabelEl = el('playlistStatSizeLabel');
  if (sizeLabelEl) {
    sizeLabelEl.textContent = 'Approx. Size';
  }
  el('playlistStatSize').textContent = SharedUtils.formatApproxSize(totalBytes) || '—';

  const q = (el('playlistSearch').value || '').toLowerCase();
  const filtered = data.videos.filter((v) => !q || (v.title || '').toLowerCase().includes(q));

  const itemsHtml = filtered.map((v, idx) => `
    <div class="playlist-item ${state.playlist.selected.has(v.id) ? 'is-selected' : ''}">
      <label class="playlist-item-check">
        <input type="checkbox" class="playlist-item-checkbox" data-id="${v.id}" ${state.playlist.selected.has(v.id) ? 'checked' : ''} />
        <div class="playlist-item-checkmark"></div>
      </label>
      <div class="playlist-item-position">${idx + 1}</div>
      <div class="playlist-item-thumb" ${v.thumbnail ? `style="background-image:url('${escapeHtml(v.thumbnail)}')"` : ''}>
        <div class="playlist-item-duration">${Math.floor((v.durationSecs || 0) / 60)}:${String((v.durationSecs || 0) % 60).padStart(2, '0')}</div>
      </div>
      <div class="playlist-item-info">
        <div class="playlist-item-title">${escapeHtml(v.title || '—')}</div>
        <div class="playlist-item-channel">${escapeHtml(v.channel || '—')}</div>
      </div>
    </div>
  `).join('');
  el('playlistItems').innerHTML = itemsHtml;

  el('playlistItems').querySelectorAll('.playlist-item-checkbox').forEach((cb) => {
    cb.addEventListener('change', () => {
      if (cb.checked) {
        state.playlist.selected.add(cb.dataset.id);
      } else {
        state.playlist.selected.delete(cb.dataset.id);
      }
      renderPlaylistContent();
    });
  });

  el('playlistFooterInfo').textContent = `${state.playlist.selected.size} videos selected`;
  el('playlistConfirmBtn').disabled = state.playlist.selected.size === 0;
}

/* ============================================================
   Playback
============================================================ */

function syncPlaybackState() {
  state.playQueue = playbackController.queue;
  state.currentTrackIndex = playbackController.currentIndex;
  currentPlayingId = playbackController.currentId;
  globalAudio = playbackController.media;
}

function setPlaybackQueue(items, preferredId = playbackController.currentId) {
  playbackController.queue = Array.isArray(items) ? [...items] : [];
  playbackController.currentIndex = preferredId
    ? playbackController.queue.findIndex((x) => x.id && String(x.id) === String(preferredId))
    : -1;
  syncPlaybackState();
}

function selectPlaybackItem(item) {
  const source = (state.filteredHistory && state.filteredHistory.some((h) => h.id && item.id && String(h.id) === String(item.id)))
    ? state.filteredHistory
    : state.history;
  setPlaybackQueue(source || [], item.id);
}

function getQueuedItemById(id) {
  return playbackController.queue.find((h) => h.id && String(h.id) === String(id));
}

function getCurrentQueueItem() {
  return playbackController.currentIndex >= 0 ? playbackController.queue[playbackController.currentIndex] : null;
}

function getPlaybackDuration(mediaEl, item = getCurrentQueueItem()) {
  const d = mediaEl && mediaEl.duration;
  if (d && isFinite(d) && d > 0) return d;
  return (item && item.duration) ? parseDurationToSeconds(item.duration) : 0;
}

async function playTrackById(item) {
  if (!item) return;
  if (playbackController.loading) {
    playbackController.pendingItem = item;
    return;
  }
  playbackController.loading = true;
  playbackController.pendingItem = null;

  try {
    const audioElement = document.getElementById('globalAudioEl');
    if (!audioElement) {
      console.error('globalAudioEl not found in DOM');
      return;
    }

    audioElement.removeEventListener('ended',          audioElement._onEnded);
    audioElement.removeEventListener('error',          audioElement._onError);
    audioElement.removeEventListener('loadedmetadata', audioElement._onLoaded);
    audioElement.removeEventListener('durationchange', audioElement._onDuration);
    audioElement.removeEventListener('timeupdate',     audioElement._onTime);
    audioElement._session = null;

    audioElement.pause();
    audioElement.removeAttribute('src');
    try { audioElement.load(); } catch(_) {}

    const progressBar = document.getElementById('miniProgressBar');
    const progressThumb = document.getElementById('miniProgressThumb');
    const currentTimeLabel = document.getElementById('miniCurrentTime');
    const totalTimeLabel = document.getElementById('miniTotalTime');
    if (progressBar)   progressBar.style.width   = '0%';
    if (progressThumb) progressThumb.style.left  = '0%';
    if (currentTimeLabel)   currentTimeLabel.textContent   = '00:00';
    if (totalTimeLabel)   totalTimeLabel.textContent   = item.duration || '00:00';

    const filePath = await window.fel7o.resolveFilePath({
      folder: item.folder,
      title: item.title,
      mode: item.mode,
      videoQuality: item.videoQuality || null,
      audioQuality: item.audioQuality || null
    });
    if (!filePath) {
      showToast('File not found on disk. It may have been moved or deleted.');
      return;
    }

    playbackController.currentId = item.id;
    playbackController.currentIndex = playbackController.queue.findIndex(x => x.id && String(x.id) === String(item.id));
    playbackController.media = audioElement;
    syncPlaybackState();

    const isVideoItem = historyKind(item) === 'video';
    if (isVideoItem) {
      if (typeof window.ampActivateVideo === 'function') {
        window.ampActivateVideo(item);
      }
    } else {
      if (typeof window.ampActivateAudio === 'function') {
        window.ampActivateAudio();
      }
    }

    const session = {};

    async function onEnded() {
      if (globalAudio._session !== session) return;
      if (playbackController.queue.length === 0) {
        playbackController.currentId = null;
        playbackController.currentIndex = -1;
        syncPlaybackState();
        updatePlayingCard();
        return;
      }
      playbackController.currentIndex++;
      if (playbackController.currentIndex >= playbackController.queue.length || playbackController.currentIndex < 0) {
        playbackController.currentIndex = 0;
      }
      syncPlaybackState();
      const nextItem = playbackController.queue[playbackController.currentIndex];
      if (nextItem) {
        await playTrackById(nextItem);
      } else {
        playbackController.currentId = null;
        playbackController.currentIndex = -1;
        syncPlaybackState();
        updatePlayingCard();
      }
    }

    function onError() {
      if (globalAudio._session !== session) return;
      const err = audioElement.error;
      if (err && err.code === 1) return;
      console.error('Audio playback error:', err);
      showToast('Unable to play audio file.');
      playbackController.currentId = null;
      playbackController.currentIndex = -1;
      syncPlaybackState();
      updatePlayingCard();
    }

    function onLoadedMetadata() {
      if (globalAudio._session !== session) return;
      audioElement.playbackRate = playbackController.playbackRate;
      const t = document.getElementById('miniTotalTime');
      if (t) t.textContent = item.duration || formatTime(audioElement.duration);
    }

    function onDurationChange() {
      if (globalAudio._session !== session) return;
      const t = document.getElementById('miniTotalTime');
      if (t) t.textContent = item.duration || formatTime(audioElement.duration);
    }

    function onTimeUpdate() {
      if (globalAudio._session !== session) return;
      if (isDraggingProgress) return;
      const cur = audioElement.currentTime;
      const dur = getPlaybackDuration(audioElement, item);
      const currentTimeLabel = document.getElementById('miniCurrentTime');
      const totalTimeLabel = document.getElementById('miniTotalTime');
      const progressBar = document.getElementById('miniProgressBar');
      const progressThumb = document.getElementById('miniProgressThumb');

      if (currentTimeLabel) currentTimeLabel.textContent = formatTime(cur);
      if (dur > 0) {
        if (totalTimeLabel) totalTimeLabel.textContent = item.duration || formatTime(dur);
        const pct = Math.min(100, (cur / dur) * 100);
        if (progressBar) progressBar.style.width  = `${pct}%`;
        if (progressThumb) progressThumb.style.left   = `${pct}%`;
      }
    }

    audioElement._session    = session;
    audioElement._onEnded    = onEnded;
    audioElement._onError    = onError;
    audioElement._onLoaded   = onLoadedMetadata;
    audioElement._onDuration = onDurationChange;
    audioElement._onTime     = onTimeUpdate;

    audioElement.addEventListener('ended',          onEnded);
    audioElement.addEventListener('error',          onError);
    audioElement.addEventListener('loadedmetadata', onLoadedMetadata);
    audioElement.addEventListener('durationchange', onDurationChange);
    audioElement.addEventListener('timeupdate',     onTimeUpdate);

    const normalizedPath = filePath.replace(/\\/g, '/');
    audioElement.src = `media://local-file/${encodeURIComponent(normalizedPath)}`;
    audioElement.load();
    audioElement.playbackRate = playbackController.playbackRate;

    const scrollActiveCardIntoView = () => {
      if (item && item.id) {
        const activeCard = document.querySelector(`.history-media-card[data-id="${item.id}"]`);
        if (activeCard) {
          activeCard.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
        }
      }
    };

    if ('mediaSession' in navigator) {
      navigator.mediaSession.metadata = new MediaMetadata({
        title: item.title || 'Untitled',
        artist: item.channel || 'Local File',
        artwork: [
          { src: item.thumbnail || new URL('assets/logo.png', window.location.href).href, sizes: '256x256', type: 'image/png' }
        ]
      });

      navigator.mediaSession.setActionHandler('previoustrack', () => {
        const prevBtn = el('miniPrevBtn');
        if (prevBtn && !prevBtn.disabled) prevBtn.click();
      });
      navigator.mediaSession.setActionHandler('nexttrack', () => {
        const nextBtn = el('miniNextBtn');
        if (nextBtn && !nextBtn.disabled) nextBtn.click();
      });
      navigator.mediaSession.setActionHandler('play', () => {
        const playBtn = el('miniPlayBtn');
        if (playBtn && !playBtn.disabled) playBtn.click();
      });
      navigator.mediaSession.setActionHandler('pause', () => {
        const playBtn = el('miniPlayBtn');
        if (playBtn && !playBtn.disabled) playBtn.click();
      });
    }

    try {
      await audioElement.play();
      if (typeof window.ampRevealVideo === 'function') {
        window.ampRevealVideo();
      }
      updatePlayingCard();
      scrollActiveCardIntoView();
      window.fel7o.sendPlayerState({ isPlaying: true });
    } catch (err) {
      console.error('Playback failed:', err);
      if (err.name === 'AbortError' || err.message.includes('interrupted')) {
        setTimeout(async () => {
          try {
            await audioElement.play();
            if (typeof window.ampRevealVideo === 'function') {
              window.ampRevealVideo();
            }
            updatePlayingCard();
            scrollActiveCardIntoView();
            window.fel7o.sendPlayerState({ isPlaying: true });
          } catch (e) {
            console.error('Retry play failed:', e);
          }
        }, 75);
        return;
      }
      showToast('Playback failed. Please check the audio file.');
      playbackController.currentId = null;
      playbackController.currentIndex = -1;
      syncPlaybackState();
      updatePlayingCard();
    }
  } finally {
    playbackController.loading = false;
    const pendingItem = playbackController.pendingItem;
    playbackController.pendingItem = null;
    if (pendingItem && (!playbackController.currentId || String(pendingItem.id) !== String(playbackController.currentId))) {
      await playTrackById(pendingItem);
    }
  }
}

/* ============================================================
   History Screen
============================================================ */

async function openHistoryScreen() {
  el('settingsOverlay').hidden = true;
  el('aboutOverlay').hidden = true;
  state.history = await window.fel7o.getHistory();
  renderHistory();
  navigateTo('history');
}

/* ============================================================
   Settings
============================================================ */

async function saveSettingsFromUI() {
  const patch = {
    downloadFolder: el('folderPathLabel').textContent,
    concurrentDownloads: parseInt(el('concurrentInput').value, 10) || 2,
    audioQuality: el('audioQualitySelect').value,
    videoQuality: el('videoQualitySelect').value,
    autoPasteClipboard: el('autoPasteSwitch').dataset.on === '1',
    embedThumbnail: el('thumbSwitch').dataset.on === '1',
  };
  state.settings = await window.fel7o.saveSettings(patch);
}

function setDownloadMode(mode) {
  state.selectedMode = mode;
  el('modeMp3Btn').classList.toggle('active', mode === 'mp3');
  el('modeVideoBtn').classList.toggle('active', mode === 'video');

  const select = el('qualitySelect');
  const opts = QUALITY_OPTIONS[mode];
  const defaultValue = mode === 'mp3' ? state.settings.audioQuality : state.settings.videoQuality;
  select.innerHTML = opts.map((o) => `<option value="${o.value}">${o.label}</option>`).join('');
  select.value = defaultValue || opts[opts.length - 1].value;
  refreshPreviewBadgesIfShown();
}

/* ============================================================
   Events
============================================================ */

function bindEvents() {
  el('addBtn').addEventListener('click', addToQueue);
  el('urlInput').addEventListener('keydown', (e) => { if (e.key === 'Enter') addToQueue(); });
  el('urlInput').addEventListener('input', () => scheduleUrlPreview(el('urlInput').value));
  el('pasteBtn').addEventListener('click', async () => {
    const text = await window.fel7o.readClipboard();
    if (text) { el('urlInput').value = text; scheduleUrlPreview(text, true); }
  });
  el('clearBtn').addEventListener('click', () => { el('urlInput').value = ''; clearUrlPreview(); });

  el('modeMp3Btn').addEventListener('click', () => setDownloadMode('mp3'));
  el('modeVideoBtn').addEventListener('click', () => setDownloadMode('video'));
  el('qualitySelect').addEventListener('change', refreshPreviewBadgesIfShown);

  el('settingsBtn').addEventListener('click', () => { el('aboutOverlay').hidden = true; el('settingsOverlay').hidden = false; });
  el('closeSettings').addEventListener('click', () => { el('settingsOverlay').hidden = true; saveSettingsFromUI(); });
  el('settingsOverlay').addEventListener('click', (e) => { if (e.target.id === 'settingsOverlay') { el('settingsOverlay').hidden = true; saveSettingsFromUI(); } });

  el('homeNavBtn')?.addEventListener('click', () => { navigateTo('home'); });
  el('historyBtn').addEventListener('click', async () => {
    await openHistoryScreen();
  });
  el('historySearch').addEventListener('input', renderHistory);
  el('historyFilters').querySelectorAll('.history-filter-btn').forEach((btn) => {
    btn.addEventListener('click', () => {
      if (state.historyFilter === btn.dataset.filter) return;
      state.historyFilter = btn.dataset.filter;
      const list = el('historyList');
      list.style.transition = 'opacity 160ms ease';
      list.style.opacity = '0';
      setTimeout(() => {
        renderHistory();
        list.style.opacity = '1';
      }, 160);
    });
  });

  el('miniPlayBtn').addEventListener('click', async () => {
    if (currentPlayingId) {
      if (globalAudio) {
        if (globalAudio.paused) {
          try {
            await globalAudio.play();
            updatePlayingCard();
            window.fel7o.sendPlayerState({ isPlaying: true });
          } catch (_) {}
        } else {
          globalAudio.pause();
          updatePlayingCard();
          window.fel7o.sendPlayerState({ isPlaying: false });
        }
      }
    } else {
      if (playbackController.queue.length > 0) {
        playbackController.currentIndex = 0;
        syncPlaybackState();
        await playTrackById(playbackController.queue[0]);
      }
    }
  });

  el('miniPrevBtn').addEventListener('click', async () => {
    if (playbackController.queue.length === 0) return;

    const now = Date.now();
    const isDoubleClick = (now - lastPrevClickTime) < 1000;
    lastPrevClickTime = now;

    if (globalAudio && playbackController.currentIndex >= 0) {
      if (globalAudio.currentTime > 3 && !isDoubleClick) {
        globalAudio.currentTime = 0;
        return;
      }
    }

    playbackController.currentIndex--;
    if (playbackController.currentIndex < 0) {
      playbackController.currentIndex = playbackController.queue.length - 1;
    }
    syncPlaybackState();
    const item = playbackController.queue[playbackController.currentIndex];
    if (item) {
      await playTrackById(item);
    }
  });

  el('miniNextBtn').addEventListener('click', async () => {
    if (playbackController.queue.length === 0) return;

    playbackController.currentIndex++;
    if (playbackController.currentIndex >= playbackController.queue.length || playbackController.currentIndex < 0) {
      playbackController.currentIndex = 0;
    }
    syncPlaybackState();
    const item = playbackController.queue[playbackController.currentIndex];
    if (item) {
      await playTrackById(item);
    }
  });

  const historyList = el('historyList');
  if (historyList) {
    historyList.addEventListener('click', async (e) => {
      const thumb = e.target.closest('.history-media-thumb');
      if (thumb && !e.target.closest('.history-more-menu')) {
        const card = thumb.closest('.history-media-card');
        const id = card.dataset.id;
        
        if (currentPlayingId && id && String(currentPlayingId) === String(id)) {
          if (globalAudio) {
            if (globalAudio.paused) {
              try {
                await globalAudio.play();
                updatePlayingCard();
              } catch (err) {
                console.error('Play resume failed:', err);
              }
            } else {
              globalAudio.pause();
              updatePlayingCard();
            }
          }
          return;
        }

        const item = (state.history || []).find(h => h.id && String(h.id) === String(id));
        if (item) {
          selectPlaybackItem(item);
          await playTrackById(item);
        }
        return;
      }

      const moreBtn = e.target.closest('.history-more-btn');
      if (moreBtn) {
        e.stopPropagation();
        const id = moreBtn.dataset.id;
        state.openHistoryMenuId = (state.openHistoryMenuId === id) ? null : id;
        renderHistory();
        return;
      }

      const openFolderBtn = e.target.closest('.open-folder');
      if (openFolderBtn) {
        window.fel7o.openFolder(openFolderBtn.dataset.folder);
        return;
      }

      const openUrlBtn = e.target.closest('.open-history-url');
      if (openUrlBtn) {
        if (openUrlBtn.dataset.url) window.fel7o.openExternal(openUrlBtn.dataset.url);
        return;
      }

      const openFolderMenu = e.target.closest('.open-folder-menu');
      if (openFolderMenu) {
        window.fel7o.openFolder(openFolderMenu.dataset.folder);
        state.openHistoryMenuId = null;
        renderHistory();
        return;
      }

      const openUrlMenu = e.target.closest('.open-url-menu');
      if (openUrlMenu) {
        if (openUrlMenu.dataset.url) window.fel7o.openExternal(openUrlMenu.dataset.url);
        state.openHistoryMenuId = null;
        renderHistory();
        return;
      }

      const deleteHistoryMenu = e.target.closest('.delete-history-menu');
      if (deleteHistoryMenu) {
        const id = deleteHistoryMenu.dataset.id;
        if (currentPlayingId && id && String(currentPlayingId) === String(id)) {
          if (globalAudio) {
            globalAudio.pause();
            playbackController.media = null;
            globalAudio = null;
          }
          playbackController.currentId = null;
          playbackController.currentIndex = -1;
          syncPlaybackState();
          updatePlayingCard();
        }
        state.history = await window.fel7o.deleteHistory(id);
        state.openHistoryMenuId = null;
        renderHistory();
        return;
      }
    });
  }



  const progressContainer = el('miniProgressContainer');
  const progressBar       = el('miniProgressBar');
  const progressThumb     = el('miniProgressThumb');
  const currentTimeLabel  = el('miniCurrentTime');

  function resolveAudioDuration(audio) {
    return getPlaybackDuration(audio);
  }

  function pointerToPercent(e) {
    const rect = progressContainer.getBoundingClientRect();
    return Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
  }

  function updateBarUI(percent, dur) {
    const pct = percent * 100;
    if (progressBar)  progressBar.style.width  = `${pct}%`;
    if (progressThumb) progressThumb.style.left = `${pct}%`;
    if (currentTimeLabel)  currentTimeLabel.textContent  = formatTime(percent * dur);
  }

  progressContainer.addEventListener('pointerdown', (e) => {
    const audio = globalAudio;
    if (!audio) return;
    const dur = resolveAudioDuration(audio);
    if (dur <= 0) return;

    try { progressContainer.setPointerCapture(e.pointerId); } catch (_) {}
    isDraggingProgress = true;
    if (progressThumb) progressThumb.classList.add('opacity-100');

    const startPct = pointerToPercent(e);
    updateBarUI(startPct, dur);
    lastSeekTime = Date.now();
    if (audio.readyState > 0) {
      audio.currentTime = startPct * dur;
    }

    let rafId = null;
    let latestPct = startPct;

    function onMove(ev) {
      if (!isDraggingProgress) return;
      latestPct = pointerToPercent(ev);
      if (rafId === null) {
        rafId = requestAnimationFrame(() => {
          rafId = null;
          updateBarUI(latestPct, dur);
        });
      }
    }

    function onUp(ev) {
      if (!isDraggingProgress) return;
      isDraggingProgress = false;
      if (rafId !== null) { cancelAnimationFrame(rafId); rafId = null; }

      const finalPct = pointerToPercent(ev);
      const finalDur = resolveAudioDuration(audio);
      if (finalDur > 0) {
        updateBarUI(finalPct, finalDur);
        lastSeekTime = Date.now();
        if (audio.readyState > 0) {
          audio.currentTime = finalPct * finalDur;
        }
      }

      if (progressThumb) progressThumb.classList.remove('opacity-100');
      try { progressContainer.releasePointerCapture(ev.pointerId); } catch (_) {}
      progressContainer.removeEventListener('pointermove', onMove);
      progressContainer.removeEventListener('pointerup',   onUp);
      progressContainer.removeEventListener('pointercancel', onUp);
    }

    progressContainer.addEventListener('pointermove',   onMove);
    progressContainer.addEventListener('pointerup',     onUp);
    progressContainer.addEventListener('pointercancel', onUp);
  });

  (function initAMP() {
    let ampMode       = 'audio';
    let ampHideTimer  = null;
    let ampIsPlaying  = false;
    let ampPlaybackRate = 1;
    let ampVolume     = 1;

    const audioEl = () => document.getElementById('globalAudioEl');

    const artworkEl  = el('miniPlayerArtwork');
    const miniVideoControls = el('miniVideoControls');
    const cinema     = el('ampCinema');
    const videoSlot  = el('ampVideoSlot');
    const poster     = el('ampPoster');
    const overlay    = el('ampPlayOverlay');
    const controls   = el('ampControls');

    const ampCurrentTimeLabel = el('ampCurrentTime');
    const ampTotalTimeLabel   = el('ampTotalTime');
    const ampProgressBar      = el('ampProgressBar');
    const ampProgressThumb    = el('ampProgressThumb');
    const ampProgressContainer = el('ampProgressContainer');
    const ampPlayIcon = el('ampPlayIcon');
    const ampSpeedBtn      = el('ampSpeedBtn');
    const ampSpeedMenu     = el('ampSpeedMenu');
    const ampSpeedArrow    = el('ampSpeedArrow');
    const ampSpeedBtnLabel = el('ampSpeedBtnLabel');
    const ampFsIcon   = el('ampFullscreenIcon');

    function seekFromPointer(e, container) {
      const audioElement = audioEl();
      if (!audioElement) return 0;
      const rect = container.getBoundingClientRect();
      const pct  = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
      const dur  = (audioElement.duration && isFinite(audioElement.duration)) ? audioElement.duration : 0;
      if (dur > 0) {
        audioElement.currentTime = pct * dur;
        lastSeekTime = Date.now();
      }
      return pct;
    }

    if (ampProgressContainer) {
      let vDragging = false;
      ampProgressContainer.addEventListener('pointerdown', (e) => {
        const audioElement = audioEl();
        if (!audioElement) return;
        try { ampProgressContainer.setPointerCapture(e.pointerId); } catch(_) {}
        vDragging = true;
        isDraggingProgress = true;
        if (ampProgressThumb) ampProgressThumb.classList.add('opacity-100');
        const pct = seekFromPointer(e, ampProgressContainer);
        updateAmpBar(pct);

        function onMove(ev) { if (!vDragging) return; const p = seekFromPointer(ev, ampProgressContainer); updateAmpBar(p); }
        function onUp(ev)   {
          vDragging = false;
          isDraggingProgress = false;
          const p = seekFromPointer(ev, ampProgressContainer);
          updateAmpBar(p);
          if (ampProgressThumb) ampProgressThumb.classList.remove('opacity-100');
          ampProgressContainer.removeEventListener('pointermove', onMove);
          ampProgressContainer.removeEventListener('pointerup', onUp);
          ampProgressContainer.removeEventListener('pointercancel', onUp);
        }
        ampProgressContainer.addEventListener('pointermove', onMove);
        ampProgressContainer.addEventListener('pointerup', onUp);
        ampProgressContainer.addEventListener('pointercancel', onUp);
      });
    }

    function updateAmpBar(pct) {
      if (ampProgressBar)   ampProgressBar.style.width = `${pct * 100}%`;
      if (ampProgressThumb) ampProgressThumb.style.left = `${pct * 100}%`;
    }

    window.ampActivateVideo = function(item) {
      const audioElement = audioEl();
      if (!audioElement) return;

      if (ampMode !== 'video') {
        ampMode = 'video';
        if (artworkEl) {
          artworkEl.src = item.thumbnail || 'assets/logo.png';
          artworkEl.classList.remove('opacity-0', 'pointer-events-none');
        }
        if (cinema) { cinema.classList.remove('hidden'); }
        if (miniVideoControls) { miniVideoControls.classList.remove('hidden'); }

        audioElement.removeAttribute('style');
        audioElement.classList.add('amp-video-active');
        audioElement.classList.remove('amp-cover');
        if (videoSlot && !videoSlot.contains(audioElement)) videoSlot.appendChild(audioElement);
      }

      audioElement.classList.remove('amp-cover');
      audioElement.style.opacity = '0';
      if (poster) {
        poster.src = item.thumbnail || 'assets/logo.png';
        poster.classList.remove('amp-poster-hidden');
      }
      if (artworkEl) {
        artworkEl.src = item.thumbnail || 'assets/logo.png';
        artworkEl.classList.remove('opacity-0', 'pointer-events-none');
      }
      if (overlay) { overlay.classList.remove('hidden'); overlay.style.opacity = '1'; }

      const titleNode = el('miniPlayerTitle');
      if (titleNode) {
        titleNode.textContent = item.title || 'Untitled';
        titleNode.title = item.title || '';
      }
      if (el('miniPlayerArtist')) el('miniPlayerArtist').textContent = item.channel || '';

      let revealed = false;
      function revealVideo() {
        if (revealed) return;

        const vw = audioElement.videoWidth  || 0;
        const vh = audioElement.videoHeight || 0;
        if (vw > 0 && vh > 0) {
          revealed = true;
          const videoRatio     = vw / vh;
          const containerRatio = 16 / 9;
          const diff = Math.abs(videoRatio - containerRatio) / containerRatio;
          if (diff < 0.15) {
            audioElement.classList.add('amp-cover');
          } else {
            audioElement.classList.remove('amp-cover');
          }
          audioElement.style.opacity = '1';
          if (poster) poster.classList.add('amp-poster-hidden');
          if (overlay) {
            overlay.classList.add('amp-overlay-fade');
            setTimeout(() => {
              overlay.classList.add('hidden');
              overlay.classList.remove('amp-overlay-fade');
            }, 220);
          }
        } else {
          if (poster) {
            poster.src = item.thumbnail || 'assets/logo.png';
            poster.classList.remove('amp-poster-hidden');
          }
          audioElement.style.opacity = '1';
        }
      }
      window.ampRevealVideo = revealVideo;

      if (audioElement._onCanPlay) { audioElement.removeEventListener('canplay', audioElement._onCanPlay); audioElement._onCanPlay = null; }
      if (audioElement._onMeta) { audioElement.removeEventListener('loadedmetadata', audioElement._onMeta); audioElement._onMeta = null; }

      function onCanPlay() {
        audioElement.removeEventListener('canplay', onCanPlay);
        revealVideo();
      }
      audioElement._onCanPlay = onCanPlay;
      audioElement.addEventListener('canplay', onCanPlay);

      function onMeta() {
        audioElement.removeEventListener('loadedmetadata', onMeta);
        const vw = audioElement.videoWidth  || 0;
        const vh = audioElement.videoHeight || 0;
        if (vw > 0 && vh > 0) {
          const diff = Math.abs((vw/vh) - (16/9)) / (16/9);
          if (diff < 0.15) audioElement.classList.add('amp-cover');
          else             audioElement.classList.remove('amp-cover');
        }
      }
      audioElement._onMeta = onMeta;
      audioElement.addEventListener('loadedmetadata', onMeta);

      setTimeout(() => { if (!revealed) revealVideo(); }, 800);
      ampShowControls();
    };

    window.ampActivateAudio = function() {
      if (document.fullscreenElement) {
        document.exitFullscreen().catch(() => {});
      }

      if (ampMode === 'audio') return;
      ampMode = 'audio';

      const audioElement = audioEl();
      if (!audioElement) return;

      audioElement.classList.remove('amp-video-active');
      audioElement.style.display = 'none';
      document.body.appendChild(audioElement);

      if (artworkEl) { artworkEl.classList.remove('opacity-0', 'pointer-events-none'); }
      if (cinema) { cinema.classList.add('hidden'); }
      if (miniVideoControls) { miniVideoControls.classList.add('hidden'); }

      clearAmpHideTimer();
    };

    function ampShowControls() {
      const ampCtrls = el('ampControls');
      if (ampCtrls) {
        ampCtrls.style.opacity = '1';
        ampCtrls.style.pointerEvents = 'auto';
      }
      const shell = el('miniPlayer');
      if (shell) shell.classList.remove('amp-cursor-hidden');
      clearAmpHideTimer();

      if (ampMode === 'video') {
        ampHideTimer = setTimeout(() => {
          if (document.fullscreenElement && ampCtrls) {
            ampCtrls.style.opacity = '0';
            ampCtrls.style.pointerEvents = 'none';
            if (shell) shell.classList.add('amp-cursor-hidden');
          }
        }, 2200);
      }
    }
    function clearAmpHideTimer() { if (ampHideTimer) { clearTimeout(ampHideTimer); ampHideTimer = null; } }

    const shell = el('miniPlayer');
    if (shell) {
      shell.addEventListener('mousemove',  ampShowControls);
      shell.addEventListener('mouseenter', ampShowControls);
      shell.addEventListener('click',      ampShowControls);
    }

    function toggleFullscreen() {
      const shell = el('miniPlayer');
      if (!shell) return;
      if (!document.fullscreenElement) {
        shell.requestFullscreen().catch(() => {});
      } else {
        document.exitFullscreen().catch(() => {});
      }
    }
    document.addEventListener('fullscreenchange', () => {
      const inFS = !!document.fullscreenElement;
      if (ampFsIcon) ampFsIcon.textContent = inFS ? 'fullscreen_exit' : 'fullscreen';
      if (inFS) ampShowControls();
    });

    let lastClickTime = 0;
    if (cinema) {
      cinema.addEventListener('click', (e) => {
        if (e.target.closest('.amp-controls') || e.target.closest('.amp-play-circle') || e.target.closest('#ampSpeedDropdown')) return;
        
        const now = Date.now();
        if (now - lastClickTime < 300) {
          toggleFullscreen();
          el('miniPlayBtn').click();
          lastClickTime = 0;
        } else {
          el('miniPlayBtn').click();
          lastClickTime = now;
        }
      });
    }
    if (el('ampFullscreenBtn')) {
      el('ampFullscreenBtn').addEventListener('click', toggleFullscreen);
    }

    const SPEEDS = [0.5, 0.75, 1, 1.25, 1.5, 1.75, 2, 2.5, 3];
    function setSpeed(rate) {
      ampPlaybackRate = rate;
      playbackController.playbackRate = rate;
      const audioElement = audioEl();
      if (audioElement) audioElement.playbackRate = rate;
      if (ampSpeedBtnLabel) ampSpeedBtnLabel.textContent = `${rate}\u00d7`;

      document.querySelectorAll('.amp-speed-opt').forEach(btn => {
        const val = parseFloat(btn.dataset.val);
        btn.classList.toggle('is-active', val === rate);
      });
    }
    function stepSpeed(dir) {
      const idx = SPEEDS.indexOf(ampPlaybackRate);
      const next = SPEEDS[Math.max(0, Math.min(SPEEDS.length - 1, idx + dir))];
      setSpeed(next);
    }

    if (ampSpeedBtn && ampSpeedMenu) {
      ampSpeedBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        const isHidden = ampSpeedMenu.classList.contains('hidden');
        if (isHidden) {
          ampSpeedMenu.classList.remove('hidden');
          if (ampSpeedArrow) ampSpeedArrow.style.transform = 'rotate(180deg)';

          ampSpeedMenu.style.top = '';
          ampSpeedMenu.style.bottom = '';
          ampSpeedMenu.style.left = '';

          const btnRect = ampSpeedBtn.getBoundingClientRect();
          const menuH   = 210;
          const spaceBelow = window.innerHeight - btnRect.bottom;
          if (spaceBelow < menuH + 10) {
            ampSpeedMenu.classList.add('open-up');
          } else {
            ampSpeedMenu.classList.remove('open-up');
          }
        } else {
          ampSpeedMenu.classList.add('hidden');
          if (ampSpeedArrow) ampSpeedArrow.style.transform = 'rotate(0deg)';
        }
      });
    }

    document.addEventListener('click', (e) => {
      if (ampSpeedMenu && !ampSpeedMenu.classList.contains('hidden')) {
        if (!e.target.closest('#ampSpeedDropdown')) {
          ampSpeedMenu.classList.add('hidden');
          if (ampSpeedArrow) ampSpeedArrow.style.transform = 'rotate(0deg)';
        }
      }
    });

    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') {
        if (ampSpeedMenu && !ampSpeedMenu.classList.contains('hidden')) {
          ampSpeedMenu.classList.add('hidden');
          if (ampSpeedArrow) ampSpeedArrow.style.transform = 'rotate(0deg)';
        }
      }
    });

    document.querySelectorAll('.amp-speed-opt').forEach(btn => {
      btn.addEventListener('click', () => {
        const val = parseFloat(btn.dataset.val);
        setSpeed(val);
        if (ampSpeedMenu) {
          ampSpeedMenu.classList.add('hidden');
          if (ampSpeedArrow) ampSpeedArrow.style.transform = 'rotate(0deg)';
        }
      });
    });

    function setVolume(v) {
      ampVolume = Math.max(0, Math.min(1, v));
      const audioElement = audioEl();
      if (audioElement) audioElement.volume = ampVolume;
    }

    if (el('ampPlayBtn')) {
      el('ampPlayBtn').addEventListener('click', () => { el('miniPlayBtn').click(); });
    }
    if (el('ampPrevBtn')) {
      el('ampPrevBtn').addEventListener('click', () => { el('miniPrevBtn').click(); });
    }
    if (el('ampNextBtn')) {
      el('ampNextBtn').addEventListener('click', () => { el('miniNextBtn').click(); });
    }

    document.addEventListener('keydown', (e) => {
      const tag = document.activeElement?.tagName?.toLowerCase();
      if (tag === 'input' || tag === 'textarea' || tag === 'select') return;
      if (!currentPlayingId) return;

      const audioElement = audioEl();
      if (!audioElement) return;

      switch (e.code) {
        case 'Space':
          e.preventDefault();
          el('miniPlayBtn').click();
          break;
        case 'KeyF':
          if (ampMode === 'video') { e.preventDefault(); toggleFullscreen(); }
          break;
        case 'ArrowLeft':
          e.preventDefault();
          audioElement.currentTime = Math.max(0, audioElement.currentTime - (e.shiftKey ? 10 : 5));
          lastSeekTime = Date.now();
          break;
        case 'ArrowRight':
          e.preventDefault();
          audioElement.currentTime = Math.min(audioElement.duration || 0, audioElement.currentTime + (e.shiftKey ? 10 : 5));
          lastSeekTime = Date.now();
          break;
        case 'ArrowUp':
          e.preventDefault();
          setVolume(ampVolume + 0.1);
          break;
        case 'ArrowDown':
          e.preventDefault();
          setVolume(ampVolume - 0.1);
          break;
        case 'KeyM':
          e.preventDefault();
          audioElement.muted = !audioElement.muted;
          break;
        case 'KeyN':
          e.preventDefault();
          el('miniNextBtn').click();
          break;
        case 'KeyP':
          e.preventDefault();
          el('miniPrevBtn').click();
          break;
        case 'Period':
          if (e.shiftKey) { e.preventDefault(); stepSpeed(1); }
          break;
        case 'Comma':
          if (e.shiftKey) { e.preventDefault(); stepSpeed(-1); }
          break;
        case 'KeyR':
          e.preventDefault();
          setSpeed(1);
          break;
      }
    });

    window._ampShowControls = ampShowControls;
    window._ampSetSpeed     = setSpeed;
  })();

  el('chooseFolderBtn').addEventListener('click', async () => {
    const folder = await window.fel7o.chooseFolder();
    if (folder) { el('folderPathLabel').textContent = folder; }
  });

  el('pauseAllBtn').addEventListener('click', async () => {
    await window.fel7o.pauseAll();
    state.jobs.forEach((job) => {
      if (job.status === 'downloading') job.status = 'paused';
    });
    renderQueue();
  });

  el('resumeAllBtn').addEventListener('click', async () => {
    await window.fel7o.resumeAll();
    state.jobs.forEach((job) => {
      if (job.status === 'paused') job.status = 'downloading';
    });
    renderQueue();
    maybeStartNext();
  });

  el('autoPasteSwitch').addEventListener('click', () => setSwitch('autoPasteSwitch', el('autoPasteSwitch').dataset.on !== '1'));
  el('thumbSwitch').addEventListener('click', () => setSwitch('thumbSwitch', el('thumbSwitch').dataset.on !== '1'));

  el('aboutBtn').addEventListener('click', () => {
    el('settingsOverlay').hidden = true;
    el('aboutOverlay').hidden = false;
  });
  el('closeAbout').addEventListener('click', () => { el('aboutOverlay').hidden = true; });
  el('aboutOverlay').addEventListener('click', (e) => { if (e.target.id === 'aboutOverlay') el('aboutOverlay').hidden = true; });

  document.addEventListener('click', (e) => {
    let changedQueue = false;
    let changedHistory = false;
    if (!e.target.closest('.queue-more-menu')) {
      if (state.openMoreMenuId !== null) {
        state.openMoreMenuId = null;
        changedQueue = true;
      }
    }
    if (!e.target.closest('.history-more-menu')) {
      if (state.openHistoryMenuId !== null) {
        state.openHistoryMenuId = null;
        changedHistory = true;
      }
    }
    if (changedQueue) renderQueue();
    if (changedHistory) renderHistory();
  });
}

function openPlaylistManager(url) {
  state.playlist.url = url;
  state.playlist.data = null;
  state.playlist.selected = new Set();
  state.playlist.searchQuery = '';
  if (el('playlistSearch')) {
    el('playlistSearch').value = '';
  }

  el('settingsOverlay').hidden = true;
  el('aboutOverlay').hidden = true;
  el('playlistOverlay').hidden = false;

  el('playlistLoading').hidden = false;
  el('playlistError').hidden = true;
  el('playlistContent').hidden = true;
  el('playlistFooter').hidden = true;
  el('playlistLoadingCount').textContent = '';

  fetchPlaylistInfo(url);
}

function closePlaylistManager() {
  el('playlistOverlay').hidden = true;
  state.playlist.url = null;
  state.playlist.data = null;
  state.playlist.selected = new Set();
}

function fetchPlaylistInfo(url) {
  const token = ++state.playlist.token;
  window.fel7o.getPlaylistInfo(url).then((data) => {
    if (token !== state.playlist.token || state.playlist.url !== url) return;
    if (!data || data.error) {
      renderPlaylistError(data && data.error ? data.error : 'Unable to load playlist details.');
      return;
    }
    if (!data.videos || data.videos.length === 0) {
      renderPlaylistError('Playlist is empty or private. Please ensure it is public.');
      return;
    }
    state.playlist.data = data;
    state.playlist.selected = new Set(data.videos.map((v) => v.id));
    el('playlistLoading').hidden = true;
    el('playlistError').hidden = true;
    el('playlistContent').hidden = false;
    el('playlistFooter').hidden = false;
    renderPlaylistContent();
  }).catch((err) => {
    if (token !== state.playlist.token) return;
    renderPlaylistError('Connection failed. ' + (err.message || 'Please try again.'));
  });
}

function bindPlaylistEvents() {
  el('playlistSelectAllBtn').addEventListener('click', () => {
    const data = state.playlist.data;
    if (!data) return;
    state.playlist.selected = new Set(data.videos.map((v) => v.id));
    renderPlaylistContent();
  });
  el('playlistDeselectAllBtn').addEventListener('click', () => {
    state.playlist.selected = new Set();
    renderPlaylistContent();
  });
  el('playlistInvertBtn').addEventListener('click', () => {
    const data = state.playlist.data;
    if (!data) return;
    const newSelected = new Set();
    data.videos.forEach((v) => {
      if (!state.playlist.selected.has(v.id)) newSelected.add(v.id);
    });
    state.playlist.selected = newSelected;
    renderPlaylistContent();
  });
  el('playlistSearch').addEventListener('input', renderPlaylistContent);
  el('playlistApplyRangeBtn').addEventListener('click', () => {
    const data = state.playlist.data;
    if (!data) return;
    const from = parseInt(el('playlistRangeFrom').value, 10);
    const to = parseInt(el('playlistRangeTo').value, 10);
    if (from && to && from <= to) {
      state.playlist.selected = new Set();
      data.videos.forEach((v, i) => {
        if (i + 1 >= from && i + 1 <= to) state.playlist.selected.add(v.id);
      });
      renderPlaylistContent();
    }
  });
  el('playlistConfirmBtn').addEventListener('click', () => {
    const data = state.playlist.data;
    if (!data) return;
    const selected = data.videos.filter((v) => state.playlist.selected.has(v.id));
    for (const video of selected) {
      const job = {
        id: uid(),
        url: video.url,
        title: video.title,
        channel: video.channel,
        thumbnail: video.thumbnail || null,
        mode: state.selectedMode,
        audioFormat: state.settings.audioFormat,
        audioQuality: state.selectedMode === 'mp3' ? el('qualitySelect').value : state.settings.audioQuality,
        videoQuality: state.selectedMode === 'video' ? el('qualitySelect').value : state.settings.videoQuality,
        videoContainer: state.settings.videoContainer,
        playlistFolder: data.playlistTitle || null,
        status: 'queued',
        percent: 0,
        speed: '',
        eta: '',
        totalSize: '',
      };
      state.jobs.set(job.id, job);
      state.jobOrder.push(job.id);
    }
    renderQueue();
    maybeStartNext();
    closePlaylistManager();
  });
  el('closePlaylist').addEventListener('click', closePlaylistManager);
  el('playlistCancelBtn').addEventListener('click', closePlaylistManager);
  el('playlistRetryBtn').addEventListener('click', () => {
    el('playlistError').hidden = true;
    el('playlistLoading').hidden = false;
    el('playlistLoadingCount').textContent = 'Retrying...';
    fetchPlaylistInfo(state.playlist.url);
  });
}

let ipcUnsubscribers = [];

function cleanupIpcSubscriptions() {
  ipcUnsubscribers.forEach((unsub) => {
    if (typeof unsub === 'function') {
      try { unsub(); } catch (_e) {}
    }
  });
  ipcUnsubscribers = [];
}

function wireIpc() {
  cleanupIpcSubscriptions();

  if (window.fel7o.onProgress) {
    ipcUnsubscribers.push(window.fel7o.onProgress((data) => {
      const job = state.jobs.get(data.id);
      if (!job) return;
      if (typeof data.percent === 'number') job.percent = data.percent;
      if (data.speed) job.speed = data.speed;
      if (data.eta) job.eta = data.eta;
      if (data.totalSize) job.totalSize = data.totalSize;
      scheduleRenderQueue();
    }));
  }

  if (window.fel7o.onDone) {
    ipcUnsubscribers.push(window.fel7o.onDone(async (data) => {
      const job = state.jobs.get(data.id);
      if (!job) return;
      job.status = 'completed';
      job.percent = 100;
      advanceActiveJobIfNeeded(data.id);

      window.fel7o.notify({
        title: 'Download complete',
        body: `Downloaded "${job.title}" successfully.`
      });

      await window.fel7o.addHistory({
        id: uid(),
        url: job.url,
        title: job.title,
        channel: job.channel,
        thumbnail: job.thumbnail || null,
        mode: job.mode,
        date: new Date().toISOString(),
        folder: state.settings.downloadFolder,
        videoQuality: job.videoQuality || null,
        audioQuality: job.audioQuality || null,
        audioFormat: job.audioFormat || null,
        videoContainer: job.videoContainer || null,
        duration: job.duration || null,
      });
      renderQueue();
      maybeStartNext();
    }));
  }

  if (window.fel7o.onError) {
    ipcUnsubscribers.push(window.fel7o.onError((data) => {
      const job = state.jobs.get(data.id);
      if (!job) return;
      job.status = 'error';
      job.errorMessage = data.message;
      advanceActiveJobIfNeeded(data.id);

      window.fel7o.notify({
        title: 'Download failed',
        body: `"${job.title}": ${data.message || 'Unknown error'}`
      });

      showToast(`Download failed. ${data.message || 'Unknown error'}`);
      console.error('Download error details:', data);
      renderQueue();
      maybeStartNext();
    }));
  }

  if (window.fel7o.onCancelled) {
    ipcUnsubscribers.push(window.fel7o.onCancelled((data) => {
      const job = state.jobs.get(data.id);
      if (!job) return;
      job.status = 'cancelled';
      advanceActiveJobIfNeeded(data.id);
      renderQueue();
      maybeStartNext();
    }));
  }

  if (window.fel7o.onThumbarPrev) {
    ipcUnsubscribers.push(window.fel7o.onThumbarPrev(() => {
      const btn = el('miniPrevBtn');
      if (btn && !btn.disabled) btn.click();
    }));
  }
  if (window.fel7o.onThumbarPlayPause) {
    ipcUnsubscribers.push(window.fel7o.onThumbarPlayPause(() => {
      const btn = el('miniPlayBtn');
      if (btn && !btn.disabled) btn.click();
    }));
  }
  if (window.fel7o.onThumbarNext) {
    ipcUnsubscribers.push(window.fel7o.onThumbarNext(() => {
      const btn = el('miniNextBtn');
      if (btn && !btn.disabled) btn.click();
    }));
  }
}

/* ============================================================
   Queue Management
============================================================ */

async function addToQueue() {
  const url = el('urlInput').value.trim();
  if (!url) return;
  if (!isValidYoutubeUrl(url)) {
    showToast('Invalid YouTube URL.');
    return;
  }

  if (/[?&]list=/.test(url)) {
    el('urlInput').value = '';
    clearUrlPreview();
    openPlaylistManager(url);
    return;
  }

  await saveSettingsFromUI();

  const chosenMode = state.selectedMode;
  const chosenQuality = el('qualitySelect').value;
  const cachedInfo = (state.previewUrl === url && state.previewData) ? state.previewData : null;

  const job = {
    id: uid(),
    url,
    title: (cachedInfo && cachedInfo.title) || url,
    channel: (cachedInfo && cachedInfo.channel) || '—',
    thumbnail: (cachedInfo && cachedInfo.thumbnail) || null,
    mode: chosenMode,
    audioFormat: state.settings.audioFormat,
    audioQuality: chosenMode === 'mp3' ? chosenQuality : state.settings.audioQuality,
    videoQuality: chosenMode === 'video' ? chosenQuality : state.settings.videoQuality,
    videoContainer: state.settings.videoContainer,
    status: 'queued',
    percent: 0,
    speed: '',
    eta: '',
    totalSize: '',
  };
  state.jobs.set(job.id, job);
  state.jobOrder.push(job.id);
  el('urlInput').value = '';
  clearUrlPreview();
  const urlCard = el('urlCard');
  if (urlCard) urlCard.hidden = true;

  renderQueue();
  maybeStartNext();
  fetchJobInfo(job.id);
}

async function fetchJobInfo(jobId) {
  const job = state.jobs.get(jobId);
  if (!job) return;
  try {
    const info = await window.fel7o.getVideoInfo(job.url);
    const stillExists = state.jobs.get(jobId);
    if (!stillExists || !info) return;
    if (info.title) stillExists.title = info.title;
    if (info.channel) stillExists.channel = info.channel;
    if (info.thumbnail) stillExists.thumbnail = info.thumbnail;
    renderQueue();
  } catch (e) {
    // Silently ignore — fall back to showing the raw URL as the title
  }
}

function activeCount() {
  return [...state.jobs.values()].filter((j) => j.status === 'downloading').length;
}

function maybeStartNext() {
  const limit = state.settings.concurrentDownloads || 2;
  if (activeCount() >= limit) return;
  const next = state.jobOrder.map((id) => state.jobs.get(id)).find((j) => j && j.status === 'queued');
  if (!next) return;
  startJob(next);
}

async function startJob(job) {
  job.status = 'downloading';
  if (!state.activeJobId) state.activeJobId = job.id;
  renderQueue();
  await window.fel7o.startDownload(job);
}

async function pauseJob(id) {
  const job = state.jobs.get(id);
  if (!job) return;
  const ok = await window.fel7o.pauseDownload(id);
  if (ok) {
    job.status = 'paused';
    renderQueue();
  }
}

async function resumeJob(id) {
  const job = state.jobs.get(id);
  if (!job) return;
  const ok = await window.fel7o.resumeDownload(id);
  if (ok) {
    job.status = 'downloading';
    renderQueue();
    maybeStartNext();
  }
}

function retryJob(id) {
  const job = state.jobs.get(id);
  if (!job) return;
  job.status = 'queued';
  job.percent = 0;
  job.speed = '';
  job.eta = '';
  renderQueue();
  maybeStartNext();
}

function openFolder(id) {
  const job = state.jobs.get(id);
  if (!job || !state.settings) return;
  window.fel7o.openJobFolder({
    downloadFolder: state.settings.downloadFolder,
    playlistFolder: job.playlistFolder || null,
  });
}

async function cancelJob(id) {
  const job = state.jobs.get(id);
  if (!job) return;
  if (job.status === 'downloading') {
    window.fel7o.cancelDownload(id);
  } else if (job.status === 'paused') {
    await window.fel7o.cancelDownload(id);
    job.status = 'cancelled';
    advanceActiveJobIfNeeded(id);
    renderQueue();
    maybeStartNext();
  } else {
    job.status = 'cancelled';
    renderQueue();
  }
}

function removeFromQueueUI(id) {
  state.jobs.delete(id);
  state.jobOrder = state.jobOrder.filter((x) => x !== id);
  if (state.activeJobId === id) {
    state.activeJobId = state.jobOrder.find((oid) => {
      const j = state.jobs.get(oid);
      return j && j.status === 'downloading';
    }) || null;
  }
  renderQueue();
}

function advanceActiveJobIfNeeded(finishedId) {
  if (state.activeJobId !== finishedId) return;
  state.activeJobId = state.jobOrder.find((oid) => {
    const j = state.jobs.get(oid);
    return j && (j.status === 'downloading' || j.status === 'queued');
  }) || null;
}

let queueRenderScheduled = false;
let queueRenderRafId = null;
function scheduleRenderQueue() {
  if (queueRenderScheduled) return;
  queueRenderScheduled = true;
  queueRenderRafId = requestAnimationFrame(() => {
    queueRenderScheduled = false;
    queueRenderRafId = null;
    renderQueue();
  });
}

let lastAutoPastedUrl = null;

async function handleAutoPasteOnFocus() {
  if (!state.settings || !state.settings.autoPasteClipboard) return;
  const input = el('urlInput');
  if (!input || input.value.trim()) return;
  const text = await window.fel7o.readClipboard();
  if (text && text !== lastAutoPastedUrl) {
    lastAutoPastedUrl = text;
    input.value = text;
    scheduleUrlPreview(text, true);
  }
}

/* ============================================================
   Hero Preview
============================================================ */

function clearUrlPreview() {
  state.previewUrl = null;
  state.previewData = null;
  state.previewToken++;
  clearTimeout(state.previewDebounce);
  const section = el('urlPreviewSection');
  section.hidden = true;
  section.innerHTML = '';
  section.classList.remove('preview-animate-in');
}

function scheduleUrlPreview(rawUrl, immediate = false) {
  clearTimeout(state.previewDebounce);
  const url = (rawUrl || '').trim();

  if (!url) { clearUrlPreview(); return; }
  if (!isValidYoutubeUrl(url)) {
    if (url.length > 12 && /^https?:\/\//.test(url)) {
      renderPreviewError('Invalid YouTube URL.');
    } else {
      clearUrlPreview();
    }
    return;
  }

  const delay = immediate ? 0 : 500;
  state.previewDebounce = setTimeout(() => fetchUrlPreview(url), delay);
}

function fetchUrlPreview(url) {
  state.previewUrl = url;
  const token = ++state.previewToken;
  renderPreviewSkeleton();

  window.fel7o.getVideoInfo(url).then((info) => {
    if (token !== state.previewToken || state.previewUrl !== url) return;
    if (!info || info.error) {
      renderPreviewError(info && info.error ? info.error : 'Unable to fetch video details.');
      state.previewData = null;
      return;
    }
    state.previewData = info;
    renderPreviewCard(url, info);
  }).catch(() => {
    if (token !== state.previewToken || state.previewUrl !== url) return;
    renderPreviewError('Connection failed. Please check your internet connection.');
    state.previewData = null;
  });
}

/* ============================================================
   Bootstrap
============================================================ */

async function init() {
  navigateTo('home');

  state.settings = await window.fel7o.getSettings();
  el('folderPathLabel').textContent = state.settings.downloadFolder;
  el('concurrentInput').value = state.settings.concurrentDownloads;
  el('audioQualitySelect').value = state.settings.audioQuality;
  el('videoQualitySelect').value = state.settings.videoQuality;
  setSwitch('autoPasteSwitch', state.settings.autoPasteClipboard);
  setSwitch('thumbSwitch', state.settings.embedThumbnail);

  const [ffmpegOk, ytdlpOk] = await Promise.all([
    window.fel7o.checkFfmpeg(),
    window.fel7o.checkYtdlp(),
  ]);
  el('ffmpegStatus').textContent = ffmpegOk ? 'ffmpeg available' : 'ffmpeg not found - place it in the bin folder';
  el('ffmpegStatus').classList.add(ffmpegOk ? 'ok' : 'bad');
  el('ytdlpStatus').textContent = ytdlpOk ? 'yt-dlp available' : 'yt-dlp not found - install it or place it in bin';
  el('ytdlpStatus').classList.add(ytdlpOk ? 'ok' : 'bad');

  state.history = await window.fel7o.getHistory();

  setDownloadMode('mp3');
  bindEvents();
  bindPlaylistEvents();
  wireIpc();
  initWelcomePopup();
}

function initWelcomePopup() {
  const linksHtml = WELCOME_CONFIG.links.map((link) => `
    <button class="welcome-link link-${link.text.toLowerCase()} w-full text-left" data-url="${escapeHtml(link.url)}" type="button" style="text-align: left; width: 100%; outline: none;">
      ${getLinkIconSvg(link.text)}
      <span>${escapeHtml(link.text)}</span>
    </button>
  `).join('');
  el('aboutLinks').innerHTML = linksHtml;

  el('aboutLinks').querySelectorAll('.welcome-link').forEach((btn) => {
    btn.addEventListener('click', () => {
      let url = btn.dataset.url;
      if (btn.querySelector('span').textContent === 'WhatsApp') {
        const formalText = `Hello Ahmed, I am contacting you regarding the Fel7o application.`;
        url = `https://wa.me/201205262412?text=${encodeURIComponent(formalText)}`;
      }
      if (url) window.fel7o.openExternal(url);
    });
  });

  if (!state.settings.welcomeShown) {
    const userName = state.settings?.userName || '';
    if (userName) {
      const titleEl = el('welcomeOverlay').querySelector('.welcome-title');
      if (titleEl) titleEl.textContent = `Welcome to Fel7o, ${userName}`;
      const msgEl = el('welcomeOverlay').querySelector('.welcome-message');
      if (msgEl) {
        msgEl.innerHTML = `Thank you for using Fel7o, <strong>${escapeHtml(userName)}</strong>.<br>Stay up to date with the latest releases, features and announcements.`;
      }
    }
    el('welcomeOverlay').hidden = false;
  }

  el('welcomeContinueBtn').addEventListener('click', async () => {
    const dontShow = el('welcomeDontShowCheckbox').checked;
    if (dontShow) {
      state.settings = await window.fel7o.saveSettings({ welcomeShown: true });
    }
    el('welcomeOverlay').hidden = true;
  });

  el('welcomeVisitBtn').addEventListener('click', () => {
    window.fel7o.openExternal('https://fel7o.com');
  });
}

window.addEventListener('DOMContentLoaded', init);
window.addEventListener('focus', handleAutoPasteOnFocus);
window.addEventListener('beforeunload', () => {
  cleanupIpcSubscriptions();
  if (state.previewDebounce) clearTimeout(state.previewDebounce);
  if (showToast._t) clearTimeout(showToast._t);
  if (queueRenderRafId) cancelAnimationFrame(queueRenderRafId);
});
