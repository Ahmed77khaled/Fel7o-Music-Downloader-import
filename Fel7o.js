// Launcher for Fel7o.
// Starts the desktop app runtime without printing its underlying engine name
// to the terminal — `npm start` shows only this file's name.
const { spawn } = require('child_process');
const path = require('path');

// When required from plain Node (not from inside the runtime itself),
// this package's main export is the path to its executable binary.
const enginePath = require('electron');

// Pass the project root directory (where main.js + package.json live),
// NOT __dirname (which would be scripts/ if this file were located there).
// The --app-user-model-id flag sets the Windows AppUserModelId early so the
// taskbar right-click menu shows "Fel7o" instead of "Electron" in dev mode.
const proc = spawn(enginePath, [
  path.join(__dirname, '.'),
  '--app-user-model-id=com.fel7o'
], { stdio: 'inherit' });
proc.on('close', (code) => process.exit(code));
