/**
 * Generates SVG-based placeholder PWA icons.
 * These are functional placeholders — replace with real icons from PETCHAIN.jpeg
 * using: node scripts/generate-pwa-icons.js (requires sharp)
 */
const fs = require('fs');
const path = require('path');

const SIZES = [72, 96, 128, 144, 152, 192, 384, 512];
const OUTPUT_DIR = path.join(__dirname, '../public/icons');

if (!fs.existsSync(OUTPUT_DIR)) {
  fs.mkdirSync(OUTPUT_DIR, { recursive: true });
}

for (const size of SIZES) {
  const fontSize = Math.round(size * 0.35);
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">
  <rect width="${size}" height="${size}" rx="${Math.round(size * 0.2)}" fill="#1d4ed8"/>
  <text x="50%" y="54%" font-family="Arial,sans-serif" font-size="${fontSize}" font-weight="bold"
    fill="white" text-anchor="middle" dominant-baseline="middle">🐾</text>
</svg>`;
  fs.writeFileSync(path.join(OUTPUT_DIR, `icon-${size}x${size}.svg`), svg);
  console.log(`✓ icon-${size}x${size}.svg`);
}

console.log('\nSVG icons generated. For PNG icons, run: node scripts/generate-pwa-icons.js');
