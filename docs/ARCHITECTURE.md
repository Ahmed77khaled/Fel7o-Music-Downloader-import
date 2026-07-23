# Architecture Design Document — Fel7o Desktop

This document outlines the multi-process architecture and data flows of the Fel7o Desktop application.

---

## Process Boundaries & Core Segregation

Fel7o strictly divides execution across isolated process layers to guarantee security, crash isolation, and fluid UI rendering.

```
+──────────────────────────────────────────────────────────────────────────+
│                               MAIN PROCESS                               │
│  - App Lifecycle Coordinator                                             │
│  - Custom Protocol Handler (media://)                                    │
│  - Native Child Process Spawner (yt-dlp, FFmpeg)                         │
│  - Settings & History JSON Databases (fs writes/reads)                   │
+───────────────────────────────────┬──────────────────────────────────────+
                                    │
                               IPC Bridge
                     (Context Isolated, Preload Wrappers)
                                    │
+───────────────────────────────────▼──────────────────────────────────────+
│                             RENDERER PROCESS                             │
│  - Chromium Rendering Engine                                             │
│  - DOM Manager & Event Listeners                                         │
│  - Adaptive Media Player Interface                                       │
│  - UI Render Coalescing Throttle (requestAnimationFrame)                │
+──────────────────────────────────────────────────────────────────────────+
```

---

## Process Responsibilities

### 1. Main Process (`main.js`)
* Configures application startup settings (maximizing bounds, caching window states on close).
* Registers the custom privileged `media://` scheme supporting HTTP Range query headers to enable media streaming seeks.
* Manages configuration saving and reading (`settings.json` and `history.json`).
* Spawns, pauses, and kills native CLI background dependencies (`yt-dlp` and `FFmpeg`) using native OS arguments.

### 2. Preload Bridge (`preload.js`)
* Sets up `contextIsolation: true` to prevent the renderer from accessing the privileged Node runtime context.
* Exposes standard, safe IPC wrappers under `window.fel7o` utilizing structured serialization to prevent prototype pollution.

### 3. Renderer Process (`renderer.js`)
* Executes DOM node creation, query updates, and class bindings.
* Manages playback queue array states.
* Implements the Adaptive Media Player single-video element slot switching.
* Handles hotkeys, search operations, and modal transitions.
