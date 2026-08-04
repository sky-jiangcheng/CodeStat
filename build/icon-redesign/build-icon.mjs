// Builds the new GitBoard app icon: a luminous Möbius mark on a vibrant
// superellipse (squircle) gradient field. Chromatic Continuum design philosophy.
import fs from 'node:fs'
import path from 'node:path'
import { Resvg } from '@resvg/resvg-js'

const OUT = process.cwd() // build/icon-redesign
const ROOT = path.resolve(OUT, '../..')

// ---- superellipse squircle path (smooth, compact via Catmull-Rom) ----
function squirclePath(cx, cy, r, n = 5, anchors = 36) {
  const raw = []
  for (let i = 0; i < anchors; i++) {
    const t = (i / anchors) * Math.PI * 2
    const ct = Math.cos(t), st = Math.sin(t)
    const x = Math.sign(ct) * Math.pow(Math.abs(ct), 2 / n)
    const y = Math.sign(st) * Math.pow(Math.abs(st), 2 / n)
    raw.push([cx + x * r, cy + y * r])
  }
  // Catmull-Rom -> cubic Bezier (closed)
  const p = raw
  const L = p.length
  let d = `M ${p[0][0].toFixed(2)} ${p[0][1].toFixed(2)}`
  for (let i = 0; i < L; i++) {
    const p0 = p[(i - 1 + L) % L]
    const p1 = p[i]
    const p2 = p[(i + 1) % L]
    const p3 = p[(i + 2) % L]
    const c1x = p1[0] + (p2[0] - p0[0]) / 6
    const c1y = p1[1] + (p2[1] - p0[1]) / 6
    const c2x = p2[0] - (p3[0] - p1[0]) / 6
    const c2y = p2[1] - (p3[1] - p1[1]) / 6
    d += ` C ${c1x.toFixed(2)} ${c1y.toFixed(2)}, ${c2x.toFixed(2)} ${c2y.toFixed(2)}, ${p2[0].toFixed(2)} ${p2[1].toFixed(2)}`
  }
  return d + ' Z'
}

// Refined horizontal Möbius / infinity band — optically balanced, round lobes
const MOBIUS =
  'M 256 250 ' +
  'C 232 168, 138 168, 92 256 ' +
  'C 138 344, 232 344, 256 262 ' +
  'C 280 168, 374 168, 420 256 ' +
  'C 374 344, 280 344, 256 250 Z'

const SQ = squirclePath(256, 256, 252, 4.6, 40)

// Shared defs (gradient field + depth) — reused by master & favicon variants
const DEFS = `
  <linearGradient id="bg" x1="0%" y1="0%" x2="100%" y2="100%">
    <stop offset="0%" stop-color="#4F46E5"/>
    <stop offset="46%" stop-color="#7C3AED"/>
    <stop offset="100%" stop-color="#C026D3"/>
  </linearGradient>
  <radialGradient id="gloss" cx="30%" cy="24%" r="78%">
    <stop offset="0%" stop-color="#FFFFFF" stop-opacity="0.30"/>
    <stop offset="42%" stop-color="#FFFFFF" stop-opacity="0.06"/>
    <stop offset="100%" stop-color="#FFFFFF" stop-opacity="0"/>
  </radialGradient>
  <radialGradient id="vignette" cx="50%" cy="46%" r="68%">
    <stop offset="0%" stop-color="#000000" stop-opacity="0"/>
    <stop offset="72%" stop-color="#000000" stop-opacity="0"/>
    <stop offset="100%" stop-color="#1E0B3A" stop-opacity="0.34"/>
  </radialGradient>
  <linearGradient id="mark" x1="0%" y1="0%" x2="0%" y2="100%">
    <stop offset="0%" stop-color="#FFFFFF"/>
    <stop offset="58%" stop-color="#FDE8F6"/>
    <stop offset="100%" stop-color="#F4C9F2"/>
  </linearGradient>
  <clipPath id="vessel"><path d="${SQ}"/></clipPath>`

// Master icon — detailed, luminous, for 128px+ / app icon
const iconSvg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512" width="512" height="512" role="img" aria-label="GitBoard">
  <title>GitBoard</title>
  <defs>${DEFS}</defs>
  <path d="${SQ}" fill="url(#bg)"/>
  <g clip-path="url(#vessel)">
    <rect x="0" y="0" width="512" height="512" fill="url(#gloss)"/>
    <path d="${MOBIUS}" fill="none" stroke="#FBC9FF" stroke-opacity="0.16" stroke-width="64" stroke-linecap="round" stroke-linejoin="round"/>
    <path d="${MOBIUS}" fill="none" stroke="#FFFFFF" stroke-opacity="0.10" stroke-width="58" stroke-linecap="round" stroke-linejoin="round"/>
    <path d="${MOBIUS}" fill="none" stroke="url(#mark)" stroke-width="52" stroke-linecap="round" stroke-linejoin="round"/>
    <rect x="0" y="0" width="512" height="512" fill="url(#vignette)"/>
  </g>
  <path d="${SQ}" fill="none" stroke="#FFFFFF" stroke-opacity="0.14" stroke-width="2"/>
</svg>`

// Favicon variant — bolder, simpler mark for 16–48px legibility
const faviconSvg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512" width="512" height="512" role="img" aria-label="GitBoard">
  <title>GitBoard</title>
  <defs>${DEFS}</defs>
  <path d="${SQ}" fill="url(#bg)"/>
  <g clip-path="url(#vessel)">
    <rect x="0" y="0" width="512" height="512" fill="url(#gloss)"/>
    <path d="${MOBIUS}" fill="none" stroke="#FFFFFF" stroke-opacity="0.14" stroke-width="96" stroke-linecap="round" stroke-linejoin="round"/>
    <path d="${MOBIUS}" fill="none" stroke="#FFFFFF" stroke-width="80" stroke-linecap="round" stroke-linejoin="round"/>
    <rect x="0" y="0" width="512" height="512" fill="url(#vignette)"/>
  </g>
  <path d="${SQ}" fill="none" stroke="#FFFFFF" stroke-opacity="0.16" stroke-width="2"/>
</svg>`

function renderPng(svg, size) {
  const resvg = new Resvg(svg, {
    fitTo: { mode: 'width', value: size },
    background: 'rgba(0,0,0,0)',
  })
  return resvg.render().asPng()
}

// write master SVG + favicon SVG
fs.writeFileSync(path.join(OUT, 'icon.svg'), iconSvg)
fs.writeFileSync(path.join(OUT, 'favicon.svg'), faviconSvg)
fs.copyFileSync(path.join(OUT, 'icon.svg'), path.join(ROOT, 'build/icon.svg'))
fs.copyFileSync(path.join(OUT, 'favicon.svg'), path.join(ROOT, 'docs/favicon.svg'))
fs.copyFileSync(path.join(OUT, 'favicon.svg'), path.join(ROOT, 'web/public/favicon.svg'))

// master PNGs (128px+ use detailed master)
for (const s of [1024, 512, 256, 192, 128]) {
  fs.writeFileSync(path.join(OUT, `icon-${s}.png`), renderPng(iconSvg, s))
}
// small PNGs (≤64) use the bold favicon variant for legibility
for (const s of [64, 48, 32, 16]) {
  fs.writeFileSync(path.join(OUT, `icon-${s}.png`), renderPng(faviconSvg, s))
}

// web PWA icons
fs.copyFileSync(path.join(OUT, 'icon-512.png'), path.join(ROOT, 'web/public/icon-512.png'))
fs.copyFileSync(path.join(OUT, 'icon-192.png'), path.join(ROOT, 'web/public/icon-192.png'))

// Wails appicon (512) + build/icons set + Windows .ico
fs.copyFileSync(path.join(OUT, 'icon-512.png'), path.join(ROOT, 'build/appicon.png'))
const iconsDir = path.join(ROOT, 'build/icons')
fs.mkdirSync(iconsDir, { recursive: true })
const icoSizes = [256, 128, 64, 48, 32, 16]
const icoEntries = []
let dataOffset = 6 + icoSizes.length * 16
let totalSize = 6 + icoSizes.length * 16
for (const size of icoSizes) {
  const svg = size <= 64 ? faviconSvg : iconSvg
  const buf = renderPng(svg, size)
  icoEntries.push({ size, buf, offset: dataOffset })
  dataOffset += buf.length
  totalSize += buf.length
  fs.writeFileSync(path.join(iconsDir, `icon-${size}.png`), buf)
}
const ico = Buffer.alloc(totalSize)
ico.writeUInt16LE(0, 0); ico.writeUInt16LE(1, 2); ico.writeUInt16LE(icoSizes.length, 4)
let eo = 6
for (const e of icoEntries) {
  ico.writeUInt8(e.size >= 256 ? 0 : e.size, eo)
  ico.writeUInt8(e.size >= 256 ? 0 : e.size, eo + 1)
  ico.writeUInt8(0, eo + 2); ico.writeUInt8(0, eo + 3)
  ico.writeUInt16LE(1, eo + 4); ico.writeUInt16LE(32, eo + 6)
  ico.writeUInt32LE(e.buf.length, eo + 8); ico.writeUInt32LE(e.offset, eo + 12)
  eo += 16
}
for (const e of icoEntries) e.buf.copy(ico, e.offset)
fs.writeFileSync(path.join(iconsDir, 'icon.ico'), ico)

console.log('icon.svg, favicon.svg, PNGs, appicon.png, icon.ico written.')
