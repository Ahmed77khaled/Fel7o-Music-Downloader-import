# Fel7o Desktop

**Fel7o Desktop** (v5.0.1) is a production-ready, high-performance media downloader, library organizer, and media player built for Windows. It provides a multi-process, context-isolated environment where users can query metadata, download tracks and playlists concurrently, organize libraries securely, and stream local audio/video media.

---

## Key Features

- **Concurrent Download Manager:** Execute multiple extractions in parallel with CPU-throttled queue synchronization.
- **Adaptive Media Player (AMP):** Stream high-bitrate media in a single unified interface with automatic audio/video layout transitions.
- **Taskbar Thumbnail Toolbars:** Control background playback using hardware media keys (SMTC) and taskbar controls.
- **Custom `media://` Streaming Protocol:** Register range query streamer schemas to enable instant audio/video seeking.
- **Zero Production Dependencies:** Free from external npm library security and versioning concerns.

---

## Technical Architecture

Fel7o follows Electron's multi-process security guidelines:

* `contextIsolation: true` and `nodeIntegration: false` are enforced for the renderer process.
* The renderer communicates strictly via sandboxed IPC wrappers inside `preload.js`.
* Background jobs are executed via native whitelisted `yt-dlp` and `FFmpeg` binaries.

---

## Getting Started

### Development
1. Clone this repository.
2. Install developer dependencies:
   ```bash
   npm install
   ```
3. Boot the application:
   ```bash
   npm start
   ```

### Distribution Packaging
Build the production NSIS Windows installer:
```bash
npm run dist
```

---

## Documentation

Full architectural and engineering documentations are available in the `/docs` directory:
- [Engineering Report](file:///docs/Engineering_Report_v5.0.1.md)
- [Changelog](file:///docs/CHANGELOG.md)
- [Release Notes](file:///docs/RELEASE_NOTES_v5.0.1.md)
- [Known Issues](file:///docs/KNOWN_ISSUES.md)
- [Roadmap](file:///docs/ROADMAP.md)
