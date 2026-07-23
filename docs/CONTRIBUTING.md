# Contributing to Fel7o Desktop

Thank you for your interest in contributing to Fel7o Desktop! We welcome code fixes, documentation improvements, and bug reports to make this downloader a robust tool for everyone.

---

## Code of Conduct

By participating in this project, you agree to maintain a respectful, welcoming, and professional environment.

---

## Getting Started

1. Fork the repository on GitHub.
2. Clone your fork locally:
   ```bash
   git clone https://github.com/your-username/fel7o.git
   cd fel7o
   ```
3. Install development dependencies:
   ```bash
   npm install
   ```
4. Start the application in development mode:
   ```bash
   npm start
   ```

---

## Coding Standards

To ensure consistency across the codebase, please adhere to the following standards established in v5.0.1:

* **Naming Conventions:** Use camelCase for variables and functions (e.g. `activeJobId`, `playTrackById`), and UPPER_SNAKE_CASE for global constants (e.g. `DEFAULT_SETTINGS`, `ICON_SIZE`).
* **Process Separation:** Keep the renderer process completely separated from Node.js APIs. Expose new APIs through secure IPC wrappers inside `preload.js` and registry handles inside `main.js`.
* **Zero Production Dependencies:** We maintain zero runtime dependencies. Do not add libraries to the `dependencies` key in `package.json` without opening an architectural discussion issue first.
* **No Unused Code:** Remove all temporary debug logging (`console.log`) or unused local variables before submitting code.

---

## Submitting Pull Requests

1. Create a descriptive feature branch:
   ```bash
   git checkout -b feature/your-feature-name
   ```
2. Implement your changes. Verify that code formatting is consistent with existing structures.
3. Validate that your changes do not introduce syntax errors:
   ```bash
   node -c main.js renderer.js shared/shared-utils.js preload.js
   ```
4. Commit your changes with clear, semantic commit messages:
   ```bash
   git commit -m "Fix memory leak in paused jobs cancellation"
   ```
5. Push to your branch and open a Pull Request against the `main` branch of the official repository.
