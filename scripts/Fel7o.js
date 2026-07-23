// Launcher for Fel7o Downloader.
// Starts the desktop app runtime without printing its underlying engine name
// to the terminal — `npm start` shows only this file's name.
const { spawn } = require('child_process');

// When required from plain Node (not from inside the runtime itself),
// this package's main export is the path to its executable binary.
const enginePath = require('electron');

const proc = spawn(enginePath, [__dirname], { stdio: 'inherit' });
proc.on('close', (code) => process.exit(code));
