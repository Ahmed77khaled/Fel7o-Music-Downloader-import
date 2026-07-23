# Testing & Validation Strategy — Fel7o Desktop

This document outlines the testing, verification, and compilation commands used to ensure quality control on Fel7o Desktop.

---

## 1. Syntax Compilation Verification

Before compiling release binaries, run the Node compile-only check to detect syntax errors or missing closures:
```bash
node -c main.js renderer.js shared/shared-utils.js preload.js
```
All files must return with exit code `0` (zero outputs on success).

---

## 2. Manual QA Validation Checklist

Verify the following user flows:

### Queue & Download
1. Paste a valid single YouTube video URL. Verify that clicking "Add" fetches thumbnail info and starts the download.
2. Paste a valid YouTube playlist URL. Verify that the playlist manager opens, parses the track listing, allows selection, and enqueues selected items.
3. Pause a downloading job. Verify that the progress bar stops and the process is killed.
4. Cancel a paused download. Verify that the job is marked as "Cancelled", UI updates, and main process memory frees the job handle from `activeJobs`.

### Audio & Video Playback
1. Play a downloaded audio file from the History list. Verify that the equalizer animation runs and taskbar thumbnail buttons appear.
2. Play a downloaded video file. Verify that the Adaptive Media Player enters Video Mode (cinema layout) and overlay controls hide after a delay.
3. Verify that pressing `Space` toggles play/pause, and `ArrowLeft` / `ArrowRight` seeks back and forth.
4. Verify that pressing hardware media keys triggers play/pause/prev/next correctly.
