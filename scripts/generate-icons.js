const sharp = require('sharp');
const fs = require('fs');
const path = require('path');

async function generateIcons() {
  const sizes = [16, 32, 48, 64, 128, 256, 512];
  const inputSvg = path.join(__dirname, '../src/assets/logo.svg');
  const outputDir = path.join(__dirname, '../src/assets');

  // PNG için
  for (const size of sizes) {
    await sharp(inputSvg)
      .resize(size, size)
      .png()
      .toFile(path.join(outputDir, `logo-${size}.png`));
  }

  // ICO için (Windows)
  // ... ico dönüşümü için ek kod

  // ICNS için (macOS)
  // ... icns dönüşümü için ek kod
}

generateIcons().catch(console.error); 