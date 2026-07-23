/**
 * shared-utils.js
 *
 * Shared utility functions used by both the Main process (Node.js)
 * and Renderer process (Browser). Loaded via CommonJS require() in
 * main.js and via <script> tag in index.html.
 */

const SharedUtils = {

  /* ============================================================
     YouTube URL Validation
  ============================================================ */

  isValidYoutubeUrl(url) {
    if (!url || typeof url !== 'string') return false;
    try {
      const u = new URL(url.trim());
      const host = u.hostname.replace(/^www\./, '');
      return ['youtube.com', 'm.youtube.com', 'music.youtube.com', 'youtu.be'].includes(host);
    } catch {
      return false;
    }
  },

  /* ============================================================
     Byte Size Formatting
  ============================================================ */

  formatBytes(bytes) {
    if (bytes === 0) return '0 B';
    if (!bytes || isNaN(bytes)) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  },

  formatApproxSize(bytes) {
    if (!bytes || isNaN(bytes)) return '—';
    const mb = bytes / (1024 * 1024);
    if (mb < 1000) return `${mb.toFixed(0)} MB`;
    return `${(mb / 1024).toFixed(1)} GB`;
  },

  /* ============================================================
     Duration & Time Formatting
  ============================================================ */

  formatTime(seconds) {
    if (!seconds || isNaN(seconds)) return '00:00';
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    const s = Math.floor(seconds % 60);
    if (h > 0) return `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
    return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  },

  // Returns null on empty input (used by main process metadata formatting)
  formatDuration(seconds) {
    if (!seconds || isNaN(seconds)) return null;
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    const s = Math.floor(seconds % 60);
    if (h > 0) return `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
    return `${m}:${String(s).padStart(2, '0')}`;
  },

  formatDurationHM(hours, mins) {
    if (hours > 0) {
      return `${hours}h ${mins}m`;
    }
    return `${mins}m`;
  },

  /* ============================================================
     Seek Bar Utilities
  ============================================================ */

  getPointerPercent(clientX, containerRect) {
    return Math.max(0, Math.min(1, (clientX - containerRect.left) / containerRect.width));
  }
};

// Export for Node.js CommonJS
if (typeof module !== 'undefined' && typeof module.exports !== 'undefined') {
  module.exports = SharedUtils;
} else {
  // Expose as global variable in browser window
  window.SharedUtils = SharedUtils;
}
