const fs = require('fs');
const path = require('path');
const sharp = require('sharp');

const dir = path.resolve(__dirname, '..', 'frontend', 'public');

async function generate() {
  const sizes = [192, 512];

  for (const size of sizes) {
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">
      <rect width="${size}" height="${size}" rx="${Math.round(size * 0.2)}" fill="#dc2626"/>
      <text x="${size / 2}" y="${size * 0.68}" font-size="${Math.round(size * 0.47)}" text-anchor="middle" fill="white" font-family="sans-serif">🍽</text>
    </svg>`;

    const pngBuffer = await sharp(Buffer.from(svg)).png().toBuffer();
    fs.writeFileSync(path.join(dir, `icon-${size}.png`), pngBuffer);
    console.log(`✅ icon-${size}.png generado (${(pngBuffer.length / 1024).toFixed(1)} KB)`);
  }

  // Also generate apple-touch-icon (180x180)
  const appleSvg = `<svg xmlns="http://www.w3.org/2000/svg" width="180" height="180" viewBox="0 0 180 180">
    <rect width="180" height="180" rx="36" fill="#dc2626"/>
    <text x="90" y="122" font-size="85" text-anchor="middle" fill="white" font-family="sans-serif">🍽</text>
  </svg>`;
  const applePng = await sharp(Buffer.from(appleSvg)).png().toBuffer();
  fs.writeFileSync(path.join(dir, 'apple-touch-icon.png'), applePng);
  console.log(`✅ apple-touch-icon.png generado (${(applePng.length / 1024).toFixed(1)} KB)`);

  console.log('🎉 Todos los iconos generados correctamente');
}

generate().catch(console.error);
