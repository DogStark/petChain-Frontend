/**
 * PWA Icon Generator
 * Run: node scripts/generate-pwa-icons.js
 * Requires: npm install sharp (dev dependency)
 *
 * This script generates all required PWA icon sizes from /public/PETCHAIN.jpeg
 */

const path = require('path');
const fs = require('fs');

const SIZES = [72, 96, 128, 144, 152, 192, 384, 512];
const INPUT = path.join(__dirname, '../public/PETCHAIN.jpeg');
const OUTPUT_DIR = path.join(__dirname, '../public/icons');

async function generateIcons() {
  let sharp;
  try {
    sharp = require('sharp');
  } catch {
    console.error('sharp not installed. Run: npm install --save-dev sharp');
    process.exit(1);
  }

  if (!fs.existsSync(OUTPUT_DIR)) {
    fs.mkdirSync(OUTPUT_DIR, { recursive: true });
  }

  for (const size of SIZES) {
    const outputPath = path.join(OUTPUT_DIR, `icon-${size}x${size}.png`);
    await sharp(INPUT)
      .resize(size, size, { fit: 'cover', position: 'center' })
      .png()
      .toFile(outputPath);
    console.log(`✓ Generated ${size}x${size}`);
  }

  console.log('\nAll icons generated in public/icons/');
}

generateIcons().catch(console.error);
