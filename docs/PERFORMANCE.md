# Performance Guidelines — Fel7o Desktop

This document outlines the performance optimization strategies and resource consumption profiles of Fel7o Desktop.

---

## Performance Optimizations

### 1. Render Coalescing & Throttling
Spawning concurrent downloads emits progress updates dozens of times per second. To prevent UI lag, progress states are saved to local memory, and DOM rendering updates are scheduled using `requestAnimationFrame`. This limits updates to the screen's refresh rate (typically 60Hz/144Hz), reducing idle CPU usage during heavy downloads.

### 2. Media Decoder Disposing
To prevent memory leaks when switching tracks, the media playback routine pauses the active element, completely removes its `src` attribute, and calls `audioElement.load()`. This forces Chromium to release hardware decoding resource locks and clear buffer caches.

### 3. Event Listener Cleanup
All track event listeners are stored as properties of the player element and explicitly removed via `removeEventListener` before loading a new track. This ensures that garbage collection can reclaim closed scopes.

### 4. Zero Production Dependency Footprint
The project maintains zero runtime dependencies, eliminating background script loading or complex third-party library overhead.
