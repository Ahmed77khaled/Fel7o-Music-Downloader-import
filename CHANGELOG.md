# Changelog — Fel7o Desktop

All notable changes to the Fel7o Desktop project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

---

## [5.0.1] - 2026-07-12
This release candidate focuses strictly on engineering standards, security enhancements, memory leak mitigation, and production-grade validation.

### Added
- **Content Security Policy (CSP):** Added restrictive meta headers to `index.html` to prevent script execution from untrusted sources.
- **Taskbar Thumbnail Toolbar integration:** Main process dynamically constructs play/pause/prev/next taskbar controls on Windows.
- **Preload file header documentation:** Standardized file headers across the codebase.

### Changed
- **Codebase Reorganization:** Refactored `main.js` and `renderer.js` to adhere to standard section layouts (Imports, Constants, State, Utilities, Rendering, Playback, History, Settings, Events, Bootstrap).
- **Variable Naming Standardization:** Standardized cryptic abbreviations:
  - `curTimeLabel`, `ct`, `curTimeEl` unified to `currentTimeLabel`.
  - `totTime`, `totalTimeEl`, `tt` unified to `totalTimeLabel`.
  - `pb`, `progBar` unified to `progressBar`.
  - `pt`, `progThumb` unified to `progressThumb`.
  - `med` (in AMP engine) unified to `mediaElement`.

### Secured
- **Unrestricted Executable Launch Protection:** Restricted `shell:openFile` and `shell:openFolder` handlers in `main.js` to whitelisted safe media file formats (`.mp3`, `.mp4`, `.m4a`, etc.) and verified directories, preventing Remote Code Execution (RCE) via matched titles.
- **Directory Traversal Prevention:** Enforced directory boundary constraints in the `media://` custom protocol handler. Streams are now verified to reside strictly inside either the configuration download folder or the AppData local index folder.
- **Custom Protocol File Whitelist:** Restricted the `media://` custom protocol to stream verified media formats only.

### Fixed
- **Paused Job Memory Leak:** Added asynchronous cancel call triggering `cancelDownload` IPC for paused download cancellations. This deletes paused process handles and metadata from the main process's `activeJobs` Map immediately upon cancellation/removal.
- **Double Filter Animation Timer Overlap:** Added debounce validation on history selection clicks to cancel pending timeouts, removing visual flicker.
- **Track Transition Mismatch:** Resolved race condition in one-shot timers inside the Adaptive Media Player.

---

## [5.0.0] - 2026-05-15
First public release of the redesigned Fel7o Desktop application.

### Added
- Multi-process architecture with strict context isolation.
- Concurrent download queue management with automatic CPU throttling.
- Adaptive Media Player for unified audio and video playback.
- Searchable and categorized history screen with disk resolution helper.
- Custom `media://` streaming protocol with support for HTTP Range seek queries.
- Bundled native `yt-dlp` and `FFmpeg` binaries.
