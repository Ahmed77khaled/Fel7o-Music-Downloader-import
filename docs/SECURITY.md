# Security Policy — Fel7o Desktop

This document outlines the security configuration, threat modeling, and vulnerability mitigation strategy of Fel7o Desktop.

---

## Security Model

Fel7o Desktop implements a layered security design to protect the host operating system from untrusted remote payloads:

1. **Context Isolation:** Enabled by default. The renderer process has no access to the Node.js runtime or direct local execution wrappers.
2. **Strict IPC Whitelisting:** All inputs received from the renderer (specifically YouTube links) are parsed and matched against a hostname whitelist (`youtube.com`, `m.youtube.com`, `music.youtube.com`, `youtu.be`) using the native `URL` constructor before processing.
3. **No Shell Process Spawning:** Background CLI processes (`yt-dlp` and `FFmpeg`) are spawned using direct arguments arrays rather than shell interpreter parsing. This blocks command injection tricks.
4. **File Launch Whitelisting:** `shell:openFile` matches titles but checks the resolved file extension against a safe media format whitelist, blocking attempts to execute arbitrary binary scripts.
5. **Protocol Directory Boundary:** The custom `media://` protocol prevents path traversal by verifying that the requested resource path lies strictly inside the settings download folder or AppData index directory.
6. **Content Security Policy (CSP):** `index.html` implements strict CSP rules to block remote script tags and exfiltration vectors.
