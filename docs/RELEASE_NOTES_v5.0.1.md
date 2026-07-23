# Release Notes — Fel7o Desktop v5.0.1 (Release Candidate)

We are proud to announce the Release Candidate for **Fel7o Desktop v5.0.1**. This release contains critical security hardening patches, stability fixes for background downloads, code quality improvements, and zero-dependency package updates.

---

## Key Highlights

### 🛡️ Production Security Hardening
- **Safe File Execution Whitelist:** Clicking "Play" or "Open File" inside the library now verifies the file's extension against a safe whitelist of media formats (`.mp3`, `.mp4`, `.m4a`, etc.). This protects the host system against Remote Code Execution (RCE) via matched titles.
- **Custom Protocol Path Boundary Enforcement:** The custom `media://` streaming protocol has been secured against directory traversal. Files requested through the scheme must strictly reside within the user-configured download folder or the application's local AppData directory.

### 🧹 Background Resource & Memory Leak Fixes
- **Paused Job Memory Reclamation:** When cancelling or removing a paused download from the queue, the application now automatically triggers the main process cleanup handler, deleting orphaned child process configurations and settings from the native `activeJobs` Map.
- **Visualizer & Animation Debouncing:** Rapidly switching filters on the history screen no longer creates visual flicker or redundant DOM operations thanks to standard timer clearing.

### 📐 Structural Reorganization & Formatting
- The entire codebase has been systematically reorganized into consistent sections (Imports, Constants, State, Utilities, Rendering, Playback, History, Settings, Events, Bootstrap).
- Variable naming abbreviations have been unified across files to ensure professional formatting.

---

## Target Audience & Deployment
- Recommended for all users running Fel7o v5.0.0.
- Executable builds are prepared for 64-bit Windows environments.
