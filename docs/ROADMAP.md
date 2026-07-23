# Product Roadmap — Fel7o Desktop

This document outlines the planned releases and feature roadmap for the Fel7o Desktop application.

---

## Release Timeline

```
+───────────────────────────+      +───────────────────────────+      +───────────────────────────+
│       VERSION 5.0.2       │      │        VERSION 5.1        │      │        VERSION 6.0        │
│  - Paused Job Leak Patch  │ ───> │  - History Pagination     │ ───> │  - Multi-Platform Ports   │
│  - Path Exec Whitelist    │      │  - Dark/Light Theme Match │      │  - Native Playlist Sync   │
│  - Filter Timer Debounce  │      │  - Queue Drag-and-Drop    │      │  - Hardware Acceleration  │
+───────────────────────────+      +───────────────────────────+      +───────────────────────────+
```

---

## Detailed Roadmap

### Version 5.0.2 (Immediate Security & Performance Patches)
* **Bug Fixes:**
  - Secure `shell:openFile` file validation (whitelist extension).
  - Clean up paused download process mappings.
  - Implement animation debounce timers on history search filters.
* **Improvements:**
  - Refine notification logs to report clearer file write states.

### Version 5.1 (UI Virtualization & User Customization)
* **Features:**
  - DOM virtualization for the History list grid (only render visible list items).
  - Native drag-and-drop support for reordering queued download jobs.
  - Accent color picker to personalize user theme highlights.
* **Improvements:**
  - Support automatic dark/light mode matches matching system settings.

### Version 6.0 (Major Multi-Platform Upgrades)
* **Features:**
  - Compile build setups for macOS and Linux operating systems.
  - Native playlist synchronization with mobile devices via local network QR code scanning.
  - Enable hardware-accelerated video decoding support in the Adaptive Media Player.
