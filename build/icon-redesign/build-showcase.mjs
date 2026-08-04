// Showcase canvas — "Chromatic Continuum" specimen sheet.
// A museum-style technical composition presenting the new GitBoard icon system.
import fs from 'node:fs'
import path from 'node:path'
import { Resvg } from '@resvg/resvg-js'

const OUT = process.cwd()
const FONTS = '/data/user/skills/canvas-design/canvas-fonts'
const W = 1600, H = 2200, M = 96, CW = W - 2 * M, CX = W / 2

// ---- shared geometry (must match build-icon.mjs) ----
const MOBIUS = 'M 256 250 C 232 168, 138 168, 92 256 C 138 344, 232 344, 256 262 C 280 168, 374 168, 420 256 C 374 344, 280 344, 256 250 Z'

const C = {
  bg: '#0A0612', panel: '#120A1E', ink: '#EDEAF2',
  dim: '#9A91AE', faint: '#5A5470',
  hair: '#FFFFFF', a1: '#4F46E5', a2: '#7C3AED', a3: '#C026D3', a4: '#F4C9F2',
}

// text helper
function T(x, y, s, o = {}) {
  const f = o.f || 'Instrument Sans'
  const fs = o.fs || 12
  const c = o.c || C.ink
  const op = o.o ?? 1
  const ls = o.ls ? ` letter-spacing="${o.ls}"` : ''
  const ta = o.ta && o.ta !== 'start' ? ` text-anchor="${o.ta}"` : ''
  const w = o.w && o.w !== 'normal' ? ` font-weight="${o.w}"` : ''
  const it = o.it ? ` font-style="italic"` : ''
  return `<text x="${x}" y="${y}" font-family="'${f}', sans-serif" font-size="${fs}" fill="${c}" fill-opacity="${op}"${ls}${ta}${w}${it}>${s}</text>`
}
function img(file, x, y, w, h) {
  const b = fs.readFileSync(path.join(OUT, file)).toString('base64')
  return `<image x="${x}" y="${y}" width="${w}" height="${h}" href="data:image/png;base64,${b}"/>`
}
function line(x1, y1, x2, y2, o = 0.12, sw = 1, dash = '') {
  return `<line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" stroke="${C.hair}" stroke-opacity="${o}" stroke-width="${sw}"${dash ? ` stroke-dasharray="${dash}"` : ''}/>`
}
function dot(x, y, r, fill, fo = 1, so = 0.9) {
  return `<circle cx="${x}" cy="${y}" r="${r}" fill="${fill}" fill-opacity="${fo}" stroke="${C.hair}" stroke-opacity="${so}" stroke-width="1"/>`
}

// ---------- compose ----------
let body = ''

// background
body += `<rect x="0" y="0" width="${W}" height="${H}" fill="${C.bg}"/>`
// atmospheric glow behind hero
body += `<defs>
  <radialGradient id="atmos" cx="50%" cy="30%" r="55%">
    <stop offset="0%" stop-color="${C.a2}" stop-opacity="0.22"/>
    <stop offset="55%" stop-color="${C.a1}" stop-opacity="0.06"/>
    <stop offset="100%" stop-color="${C.a1}" stop-opacity="0"/>
  </radialGradient>
  <linearGradient id="bar" x1="0%" y1="0%" x2="100%" y2="0%">
    <stop offset="0%" stop-color="${C.a1}"/>
    <stop offset="46%" stop-color="${C.a2}"/>
    <stop offset="100%" stop-color="${C.a3}"/>
  </linearGradient>
  <linearGradient id="markbar" x1="0%" y1="0%" x2="100%" y2="0%">
    <stop offset="0%" stop-color="#FFFFFF"/>
    <stop offset="58%" stop-color="#FDE8F6"/>
    <stop offset="100%" stop-color="${C.a4}"/>
  </linearGradient>
</defs>`
body += `<rect x="0" y="0" width="${W}" height="${H}" fill="url(#atmos)"/>`

// ---- top hairline + header ----
body += line(M, 64, W - M, 64, 0.10)
body += T(M, 96, 'GITBOARD', { f: 'Geist Mono', fs: 13, o: 0.7, ls: 3 })
body += T(M, 118, 'ICON SYSTEM — v2.0', { f: 'Geist Mono', fs: 11, o: 0.35, ls: 2 })
body += T(W - M, 96, 'CHROMATIC CONTINUUM', { f: 'Instrument Sans', fs: 13, o: 0.7, ls: 4, ta: 'end' })
body += T(W - M, 118, 'SPECIMEN SHEET · 2026', { f: 'Geist Mono', fs: 11, o: 0.35, ls: 2, ta: 'end' })
body += line(M, 150, W - M, 150, 0.12)

// vertical spine label
body += `<text x="46" y="${H / 2}" font-family="'Geist Mono', monospace" font-size="10" fill="${C.ink}" fill-opacity="0.28" letter-spacing="4" text-anchor="middle" transform="rotate(-90 46 ${H / 2})">CHROMATIC · CONTINUUM · GITBOARD · 001</text>`

// ---- HERO ----
const HSIZE = 560, HX = CX - HSIZE / 2, HY = 210
// crosshair frame (corner brackets + faint center cross)
body += line(CX, HY - 18, CX, HY + HSIZE + 18, 0.05)
body += line(HX - 18, (HY + HSIZE / 2), HX + HSIZE + 18, (HY + HSIZE / 2), 0.05)
const brk = 26
const corners = [[HX, HY], [HX + HSIZE, HY], [HX, HY + HSIZE], [HX + HSIZE, HY + HSIZE]]
for (const [x, y] of corners) {
  const dx = x < CX ? 1 : -1, dy = y < HY + HSIZE / 2 ? 1 : -1
  body += line(x, y, x + dx * brk, y, 0.30, 1.2)
  body += line(x, y, x, y + dy * brk, 0.30, 1.2)
}
// hero icon
body += img('icon-1024.png', HX, HY, HSIZE, HSIZE)
// hero caption
body += T(CX, HY + HSIZE + 64, 'THE MARK', { f: 'Instrument Sans', fs: 12, o: 0.5, ls: 5, ta: 'middle' })
body += T(CX, HY + HSIZE + 92, 'Möbius band · luminous on spectral field', { f: 'Instrument Serif', it: true, fs: 19, o: 0.85, ta: 'middle' })

// ---- 01 GEOMETRY ----
const gY = 980
body += T(M, gY, '01', { f: 'Geist Mono', fs: 12, o: 0.5 })
body += T(M + 34, gY, 'GEOMETRY', { f: 'Instrument Sans', fs: 12, o: 0.5, ls: 3 })
body += line(M + 168, gY - 4, W - M, gY - 4, 0.08)

// construction wireframe of the mark — center mark (256,256) at (CX, 1130)
const sc = 1.4
const cty = 1130
const mtx = CX - 256 * sc, mty = cty - 256 * sc
body += `<g transform="translate(${mtx} ${mty}) scale(${sc})">`
body += `<path d="${MOBIUS}" fill="none" stroke="${C.hair}" stroke-opacity="0.10" stroke-width="9" stroke-linecap="round" stroke-linejoin="round"/>`
body += `<path d="${MOBIUS}" fill="none" stroke="${C.hair}" stroke-opacity="0.30" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round"/>`
body += `<path d="${MOBIUS}" fill="none" stroke="${C.a4}" stroke-opacity="0.22" stroke-width="1.2" stroke-linecap="round" stroke-linejoin="round" stroke-dasharray="2 7" transform="translate(0 8)"/>`
body += `</g>`
// numbered vertices
const V = [[256, 250], [92, 256], [256, 262], [420, 256]]
const Vt = V.map(([x, y]) => [mtx + x * sc, mty + y * sc])
Vt.forEach(([x, y], i) => {
  body += dot(x, y, 5.5, C.bg, 1, 0.5)
  body += dot(x, y, 2.2, C.ink, 0.95, 0)
  body += T(x + 14, y - 12, String(i + 1), { f: 'Geist Mono', fs: 12, o: 0.8 })
})
// legend
const lx = W - M - 250, ly = 1010
body += T(lx, ly, 'VERTICES', { f: 'Geist Mono', fs: 11, o: 0.45, ls: 2 })
const legend = ['1  origin · crossing', '2  left vertex', '3  return crossing', '4  right vertex']
legend.forEach((s, i) => body += T(lx, ly + 26 + i * 24, s, { f: 'Geist Mono', fs: 12, o: 0.7 }))
body += T(lx, ly + 26 + 4 * 24 + 12, 'stroke  52u', { f: 'Geist Mono', fs: 12, o: 0.5 })
body += T(lx, ly + 26 + 4 * 24 + 34, 'vessel  n 4.6', { f: 'Geist Mono', fs: 12, o: 0.5 })
// left annotation
body += T(M, 1010, 'CONTINUOUS PATH', { f: 'Instrument Sans', fs: 12, o: 0.6, ls: 2 })
body += T(M, 1034, 'A single stroke folded', { f: 'Instrument Serif', it: true, fs: 17, o: 0.8 })
body += T(M, 1058, 'into a half-twist —', { f: 'Instrument Serif', it: true, fs: 17, o: 0.8 })
body += T(M, 1082, 'one surface, no end.', { f: 'Instrument Serif', it: true, fs: 17, o: 0.8 })

// ---- 02 CHROMATIC SYSTEM ----
const c2Y = 1320
body += T(M, c2Y, '02', { f: 'Geist Mono', fs: 12, o: 0.5 })
body += T(M + 34, c2Y, 'CHROMATIC SYSTEM', { f: 'Instrument Sans', fs: 12, o: 0.5, ls: 3 })
body += line(M + 250, c2Y - 4, W - M, c2Y - 4, 0.08)
// gradient bar
const barY = c2Y + 40, barH = 54
body += `<rect x="${M}" y="${barY}" width="${CW}" height="${barH}" rx="27" fill="url(#bar)"/>`
// ticks + hex
const stops = [[0, C.a1, '#4F46E5'], [0.46, C.a2, '#7C3AED'], [1, C.a3, '#C026D3']]
stops.forEach(([p, , hex]) => {
  const x = M + p * CW
  body += line(x, barY + barH + 6, x, barY + barH + 18, 0.4, 1)
  body += T(x, barY + barH + 40, hex, { f: 'Geist Mono', fs: 12, o: 0.7, ta: p === 0 ? 'start' : p === 1 ? 'end' : 'middle' })
  body += T(x, barY + barH + 58, `${Math.round(p * 100)}%`, { f: 'Geist Mono', fs: 10, o: 0.4, ta: p === 0 ? 'start' : p === 1 ? 'end' : 'middle' })
})
body += T(M, barY - 12, 'field', { f: 'Geist Mono', fs: 10, o: 0.4, ls: 1 })
// mark gradient bar
const mbY = barY + barH + 92
body += `<rect x="${M}" y="${mbY}" width="${CW}" height="20" rx="10" fill="url(#markbar)"/>`
body += T(M, mbY - 12, 'mark · luminous', { f: 'Geist Mono', fs: 10, o: 0.4, ls: 1 })
body += T(W - M, mbY + 15, '#FFFFFF → #F4C9F2', { f: 'Geist Mono', fs: 10, o: 0.4, ta: 'end' })

// ---- 03 SCALE ----
const sY = 1600
body += T(M, sY, '03', { f: 'Geist Mono', fs: 12, o: 0.5 })
body += T(M + 34, sY, 'SCALE / LEGIBILITY', { f: 'Instrument Sans', fs: 12, o: 0.5, ls: 3 })
body += line(M + 230, sY - 4, W - M, sY - 4, 0.08)
const specs = [['icon-512.png', 512, 150], ['icon-256.png', 256, 110], ['icon-128.png', 128, 78], ['icon-64.png', 64, 54], ['icon-32.png', 32, 34], ['icon-16.png', 16, 22]]
const gap = 60
let totalW = specs.reduce((a, [, , w]) => a + w, 0) + gap * (specs.length - 1)
let sx = CX - totalW / 2
const baseY = 1760
for (const [file, label, w] of specs) {
  body += img(file, sx, baseY - w, w, w)
  body += T(sx + w / 2, baseY + 24, String(label), { f: 'Geist Mono', fs: 11, o: 0.6, ta: 'middle' })
  body += line(sx, baseY + 4, sx + w, baseY + 4, 0.12, 1)
  sx += w + gap
}

// ---- repeat pattern band ----
const rpY = 1900
const rpCount = 13, rpW = 80, rpGap = (CW - rpCount * rpW) / (rpCount - 1)
for (let i = 0; i < rpCount; i++) {
  const x = M + i * (rpW + rpGap)
  body += `<g transform="translate(${x} ${rpY}) scale(${rpW / 512})">`
  body += `<path d="${MOBIUS}" fill="none" stroke="${C.a3}" stroke-opacity="0.16" stroke-width="56" stroke-linecap="round" stroke-linejoin="round"/>`
  body += `</g>`
}
body += T(M, rpY + 96, 'repeat · specimen', { f: 'Geist Mono', fs: 10, o: 0.35, ls: 2 })

// ---- footer ----
body += line(M, 2080, W - M, 2080, 0.12)
body += T(M, 2130, 'luminous, not loud.', { f: 'Instrument Serif', it: true, fs: 27, o: 0.9 })
body += T(W - M, 2124, 'GB · CC — 001', { f: 'Geist Mono', fs: 12, o: 0.5, ls: 2, ta: 'end' })
body += T(W - M, 2144, 'Chromatic Continuum', { f: 'Instrument Sans', fs: 10, o: 0.35, ls: 2, ta: 'end' })

const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" width="${W}" height="${H}">${body}</svg>`
fs.writeFileSync(path.join(OUT, 'showcase.svg'), svg)

const resvg = new Resvg(svg, {
  fitTo: { mode: 'width', value: W },
  background: C.bg,
  font: { loadSystemFonts: false, fontDirs: [FONTS], defaultFontFamily: 'Instrument Sans', defaultFontSize: 12 },
})
fs.writeFileSync(path.join(OUT, 'showcase.png'), resvg.render().asPng())
console.log('showcase.png written.')
