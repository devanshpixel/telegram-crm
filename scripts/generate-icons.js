const sharp = require('sharp');
const path = require('path');
const fs = require('fs');

const ICONS_DIR = path.join(__dirname, '..', 'extension', 'icons');

async function generateIcons() {
  if (!fs.existsSync(ICONS_DIR)) {
    fs.mkdirSync(ICONS_DIR, { recursive: true });
  }

  const sizes = [16, 48, 128];
  
  // A simple rounded rect SVG
  const generateSvg = (size) => `
    <svg width="${size}" height="${size}" xmlns="http://www.w3.org/2000/svg">
      <rect width="${size}" height="${size}" rx="${size * 0.2}" fill="#8b5cf6" />
      <text x="${size/2}" y="${size/2 + size*0.1}" font-family="sans-serif" font-size="${size * 0.5}" font-weight="bold" fill="white" text-anchor="middle" dominant-baseline="middle">L</text>
    </svg>
  `;

  for (const size of sizes) {
    const svgBuffer = Buffer.from(generateSvg(size));
    await sharp(svgBuffer)
      .png()
      .toFile(path.join(ICONS_DIR, `icon${size}.png`));
    console.log(`Generated icon${size}.png`);
  }
}

generateIcons().catch(console.error);
