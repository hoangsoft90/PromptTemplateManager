#!/usr/bin/env node
/**
 * .scripts/generate-icons.js
 * Generates all app icon assets using sharp:
 *   - assets/icon.png                        (1024x1024, full-bleed, iOS + Play store)
 *   - assets/splash-icon.png                 (1024x1024, transparent, centered glyph)
 *   - assets/android-icon-background.png     (solid color for adaptive icon)
 *   - assets/android-icon-foreground.png     (glyph in safe zone, 432x432 content)
 *   - assets/android-icon-monochrome.png     (white glyph, transparent bg)
 *   - assets/favicon.png                     (48x48)
 *
 * Run: node .scripts/generate-icons.js
 */
const sharp = require('sharp');

const INDIGO = '#4F46E5';
const INDIGO_DEEP = '#312E81';
const WHITE = '#FFFFFF';

const S = 1024; // master size

// ---------------------------------------------------------------------------
// SVG helpers
// ---------------------------------------------------------------------------

function gradientDefs(id, from, to) {
  return `<defs>
    <linearGradient id="${id}" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="${from}"/>
      <stop offset="100%" stop-color="${to}"/>
    </linearGradient>
  </defs>`;
}

/** The `{{ }}` prompt glyph. Returns an SVG string. */
function glyphSvg(opts = {}) {
  const color = opts.color ?? WHITE;
  const scale = opts.scale ?? 1;
  const glow = opts.glow ?? false;

  // The glyph is drawn in a 600x600 box, centered on the canvas by the caller.
  const glowFilter = glow
    ? `<filter id="glow" x="-50%" y="-50%" width="200%" height="200%">
         <feGaussianBlur stdDeviation="22" result="blur"/>
         <feMerge><feMergeNode in="blur"/><feMergeNode in="SourceGraphic"/></feMerge>
       </filter>`
    : '';

  const g = (x, y) => (x * scale + (600 - 600 * scale) / 2).toFixed(1) + ' ' + (y * scale + (600 - 600 * scale) / 2).toFixed(1);

  // Braces built from rounded strokes for a modern look.
  const braces = `
    <path d="M ${g(190,170)} L ${g(170,170)} Q ${g(120,170)} ${g(120,230)} L ${g(120,285)} Q ${g(120,335)} ${g(80,335)} Q ${g(120,335)} ${g(120,385)} L ${g(120,440)} Q ${g(120,500)} ${g(170,500)} L ${g(190,500)}"
          stroke="${color}" stroke-width="52" fill="none" stroke-linecap="round" stroke-linejoin="round"/>
    <path d="M ${g(410,170)} L ${g(430,170)} Q ${g(480,170)} ${g(480,230)} L ${g(480,285)} Q ${g(480,335)} ${g(520,335)} Q ${g(480,335)} ${g(480,385)} L ${g(480,440)} Q ${g(480,500)} ${g(430,500)} L ${g(410,500)}"
          stroke="${color}" stroke-width="52" fill="none" stroke-linecap="round" stroke-linejoin="round"/>
  `;

  // Cursor bar between the braces (AI prompt feel).
  const cursor = `
    <rect x="${(295 * scale + (600 - 600 * scale) / 2).toFixed(1)}" y="${(190 * scale + (600 - 600 * scale) / 2).toFixed(1)}"
          width="${40 * scale}" height="${(310 * scale).toFixed(1)}" rx="${20 * scale}" fill="${color}" opacity="0.92"/>
  `;

  return `<svg xmlns="http://www.w3.org/2000/svg" width="600" height="600" viewBox="0 0 600 600">
    ${glowFilter}
    <g filter="${glow ? 'url(#glow)' : 'none'}">
      ${braces}
      ${cursor}
    </g>
  </svg>`;
}

/** Full-bleed icon: gradient background + centered glyph. */
function iconSvg() {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${S}" height="${S}" viewBox="0 0 ${S} ${S}">
    ${gradientDefs('bg', INDIGO, INDIGO_DEEP)}
    <rect width="${S}" height="${S}" fill="url(#bg)"/>
    <!-- subtle radial highlight -->
    <circle cx="${S / 2}" cy="${S / 2}" r="${S * 0.46}" fill="${WHITE}" opacity="0.06"/>
    <g transform="translate(${((S - 600) / 2).toFixed(1)} ${((S - 600) / 2).toFixed(1)})">
      ${glyphSvg({ glow: true })}
    </g>
  </svg>`;
}

/** Transparent splash glyph (contain mode). */
function splashSvg() {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${S}" height="${S}" viewBox="0 0 ${S} ${S}">
    <g transform="translate(${((S - 600) / 2).toFixed(1)} ${((S - 600) / 2).toFixed(1)})">
      ${glyphSvg({ color: INDIGO, scale: 0.92 })}
    </g>
  </svg>`;
}

/** Adaptive foreground: glyph inside the 66% safe zone. */
function adaptiveForegroundSvg() {
  // 108dp canvas; safe zone ≈ central 66dp → draw 600-box glyph at ~46% of 1024.
  const box = 470;
  const offset = (S - box) / 2;
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${S}" height="${S}" viewBox="0 0 ${S} ${S}">
    <g transform="translate(${offset.toFixed(1)} ${offset.toFixed(1)})">
      ${glyphSvg({ color: WHITE, scale: box / 600 })}
    </g>
  </svg>`;
}

/** Monochrome adaptive icon: white glyph on transparent. */
function monochromeSvg() {
  return adaptiveForegroundSvg();
}

// ---------------------------------------------------------------------------
// Render
// ---------------------------------------------------------------------------

async function renderSvg(svg, out, width, height) {
  await sharp(Buffer.from(svg))
    .resize(width, height)
    .png()
    .toFile(out);
  console.log('✓', out, `${width}x${height}`);
}

async function renderSolid(color, out, width, height) {
  await sharp({ create: { width, height, channels: 3, background: color } })
    .png()
    .toFile(out);
  console.log('✓', out, `${width}x${height}`, color);
}

async function main() {
  const dir = 'assets';
  const fs = require('fs');
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });

  await renderSvg(iconSvg(), `${dir}/icon.png`, S, S);
  await renderSvg(splashSvg(), `${dir}/splash-icon.png`, S, S);
  await renderSolid(INDIGO, `${dir}/android-icon-background.png`, S, S);
  await renderSvg(adaptiveForegroundSvg(), `${dir}/android-icon-foreground.png`, S, S);
  await renderSvg(monochromeSvg(), `${dir}/android-icon-monochrome.png`, S, S);
  await renderSvg(iconSvg(), `${dir}/favicon.png`, 48, 48);
  console.log('\nAll icons generated.');
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
