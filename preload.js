/**
 * preload.js
 *
 * Electron preload script for Fel7o.
 * Exposes a safe, sandboxed IPC bridge (window.fel7o) from the
 * main process to the renderer via contextBridge.
 */

const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('fel7o', {
  // settings
  getSettings: () => ipcRenderer.invoke('settings:get'),
  saveSettings: (patch) => ipcRenderer.invoke('settings:save', patch),

  // history
  getHistory: () => ipcRenderer.invoke('history:get'),
  addHistory: (entry) => ipcRenderer.invoke('history:add', entry),
  clearHistory: () => ipcRenderer.invoke('history:clear'),
  deleteHistory: (id) => ipcRenderer.invoke('history:delete', id),

  // fs / shell
  chooseFolder: () => ipcRenderer.invoke('dialog:chooseFolder'),
  openFolder: (p) => ipcRenderer.invoke('shell:openFolder', p),
  openJobFolder: (payload) => ipcRenderer.invoke('shell:openJobFolder', payload),
  openFile: (payload) => ipcRenderer.invoke('shell:openFile', payload),
  resolveFilePath: (payload) => ipcRenderer.invoke('shell:resolveFilePath', payload),
  readClipboard: () => ipcRenderer.invoke('clipboard:read'),
  openExternal: (url) => ipcRenderer.invoke('shell:openExternal', url),

  // tools
  checkFfmpeg: () => ipcRenderer.invoke('tools:checkFfmpeg'),
  checkYtdlp: () => ipcRenderer.invoke('tools:checkYtdlp'),

  // downloads
  startDownload: (job) => ipcRenderer.invoke('download:start', job),
  pauseDownload: (jobId) => ipcRenderer.invoke('download:pause', jobId),
  resumeDownload: (jobId) => ipcRenderer.invoke('download:resume', jobId),
  pauseAll: () => ipcRenderer.invoke('download:pauseAll'),
  resumeAll: () => ipcRenderer.invoke('download:resumeAll'),
  cancelDownload: (jobId) => ipcRenderer.invoke('download:cancel', jobId),
  notify: (opts) => ipcRenderer.invoke('notify', opts),
  getVideoInfo: (url) => ipcRenderer.invoke('ytdlp:getInfo', url),
  getPlaylistInfo: (url) => ipcRenderer.invoke('ytdlp:getPlaylistInfo', url),
  onProgress: (cb) => {
    const listener = (_e, data) => cb(data);
    ipcRenderer.on('download:progress', listener);
    return () => ipcRenderer.removeListener('download:progress', listener);
  },
  onDone: (cb) => {
    const listener = (_e, data) => cb(data);
    ipcRenderer.on('download:done', listener);
    return () => ipcRenderer.removeListener('download:done', listener);
  },
  onError: (cb) => {
    const listener = (_e, data) => cb(data);
    ipcRenderer.on('download:error', listener);
    return () => ipcRenderer.removeListener('download:error', listener);
  },
  onCancelled: (cb) => {
    const listener = (_e, data) => cb(data);
    ipcRenderer.on('download:cancelled', listener);
    return () => ipcRenderer.removeListener('download:cancelled', listener);
  },
  onLog: (cb) => {
    const listener = (_e, data) => cb(data);
    ipcRenderer.on('download:log', listener);
    return () => ipcRenderer.removeListener('download:log', listener);
  },

  // Thumbnail toolbar media controls
  sendPlayerState: (state) => ipcRenderer.send('player:state', state),
  onThumbarPrev: (cb) => {
    const listener = () => cb();
    ipcRenderer.on('thumbar:prev', listener);
    return () => ipcRenderer.removeListener('thumbar:prev', listener);
  },
  onThumbarPlayPause: (cb) => {
    const listener = () => cb();
    ipcRenderer.on('thumbar:playpause', listener);
    return () => ipcRenderer.removeListener('thumbar:playpause', listener);
  },
  onThumbarNext: (cb) => {
    const listener = () => cb();
    ipcRenderer.on('thumbar:next', listener);
    return () => ipcRenderer.removeListener('thumbar:next', listener);
  },
});
