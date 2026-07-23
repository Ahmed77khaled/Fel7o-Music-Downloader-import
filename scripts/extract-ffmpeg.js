// scripts/extract-ffmpeg.js
// Runs automatically after "npm install" (postinstall).
// Extracts bin/ffmpeg.zip and places ffmpeg.exe into the same bin directory.
// If ffmpeg.exe already exists, extraction is skipped.

// scripts/extract-ffmpeg.js
// بيتشغل تلقائي بعد "npm install" (postinstall).
// بيفك bin/ffmpeg.zip ويحط ffmpeg.exe جنبه في نفس مجلد bin.
// لو ffmpeg.exe موجود بالفعل، بيتخطى العملية (مفيش داعي يفك تاني).


const fs = require('fs');
const path = require('path');

async function main() {
  const binDir = path.join(__dirname, '..', 'bin');
  const zipPath = path.join(binDir, 'ffmpeg.zip');
  const exePath = path.join(binDir, 'ffmpeg.exe');

  if (fs.existsSync(exePath)) {
    console.log('✅ ffmpeg.exe already exists — skipping extraction.');
    return;
  }

  if (!fs.existsSync(zipPath)) {
    console.warn('⚠️  bin/ffmpeg.zip was not found. Please make sure it exists in the project.');
    return;
  }

  let extract;
  try {
    extract = require('extract-zip');
  } catch (e) {
    console.warn('⚠️  The "extract-zip" package is not installed. Run: npm install extract-zip --save-dev');
    return;
  }

  try {
    await extract(zipPath, { dir: binDir });

    if (fs.existsSync(exePath)) {
      console.log('✅ ffmpeg.exe extracted successfully into the bin directory.');
    } else {
      console.warn('⚠️  Extraction completed, but ffmpeg.exe was not found in the expected location. Please check the contents of the bin directory.');
    }
  } catch (err) {
    console.error(`❌ Failed to extract ffmpeg.zip: ${err.message}`);
  }
}

main();
