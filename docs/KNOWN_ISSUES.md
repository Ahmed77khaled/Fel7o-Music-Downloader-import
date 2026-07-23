# Known Issues — Fel7o Desktop v5.0.1

This document tracks known issues that have been classified and scheduled for resolution in the upcoming minor release (v5.0.2).

---

## Technical Defects Registry

### 1. Large History DOM Bloat
- **Severity:** **Medium**
- **Impact:** Re-rendering the history grid when the user library exceeds 300 items causes frame drops and brief rendering freezes, especially during active filter typing.
- **Planned Fix Version:** v5.0.2
- **Mitigation:** Implement DOM virtualization (only rendering cards inside the viewport bounds) or simple pagination (e.g. loading 50 items initially).

### 2. Sandbox Configuration Overrides
- **Severity:** **Low**
- **Impact:** Explicit renderer sandboxing is not defined in `BrowserWindow` properties (defaults to native Chromium sandbox settings).
- **Planned Fix Version:** v5.0.2
- **Mitigation:** Append `sandbox: true` to the webPreferences initialization.

---

## Troubleshooting FAQ

### YouTube playlist fetching fails or returns timeout error
- **Cause:** Some playlists (especially dynamic Mix / Radio auto-generated playlists) contain private user hashes or take too long to fetch metadata arrays.
- **Solution:** Ensure the playlist is marked as **Public** or **Unlisted**. Avoid fetching automated YouTube-generated radio mixes.
