// Vorab-Test 1 und 2: OTF mit CFF-Konturen und GPOS-Kerning schreiben, dann WOFF2 erzeugen.
// Aufruf: node spikes/export-spike.ts  → Dateien in spikes/out/
import { mkdirSync, writeFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import * as opentype from 'opentype.js/dist/opentype.mjs'
import { makeGposTable } from '../src/export/gpos.ts'
import { setTable } from '../src/export/sfnt.ts'

const require = createRequire(import.meta.url)
const wawoff2 = require('wawoff2') as { compress(b: Uint8Array): Promise<Uint8Array> }

const out = new URL('./out/', import.meta.url)
mkdirSync(out, { recursive: true })

function poly(points: [number, number][]): opentype.Path {
  const p = new opentype.Path()
  points.forEach(([x, y], i) => (i === 0 ? p.moveTo(x, y) : p.lineTo(x, y)))
  p.close()
  return p
}

// Gegen den Uhrzeigersinn außen (CFF-Konvention), Innenkontur im Uhrzeigersinn.
const ring = (() => {
  const p = new opentype.Path()
  const k = 0.5523 // Kreis-Näherung mit Kubikkurven
  const circle = (cx: number, cy: number, r: number, ccw: boolean) => {
    const d = ccw ? 1 : -1
    p.moveTo(cx + r, cy)
    p.curveTo(cx + r, cy + d * r * k, cx + r * k, cy + d * r, cx, cy + d * r)
    p.curveTo(cx - r * k, cy + d * r, cx - r, cy + d * r * k, cx - r, cy)
    p.curveTo(cx - r, cy - d * r * k, cx - r * k, cy - d * r, cx, cy - d * r)
    p.curveTo(cx + r * k, cy - d * r, cx + r, cy - d * r * k, cx + r, cy)
    p.close()
  }
  circle(280, 250, 250, true)
  circle(280, 250, 170, false)
  return p
})()

const glyphs = [
  new opentype.Glyph({ name: '.notdef', advanceWidth: 500, path: poly([[50, 0], [450, 0], [450, 700], [50, 700]]) }),
  new opentype.Glyph({ name: 'space', unicode: 32, advanceWidth: 250, path: new opentype.Path() }),
  new opentype.Glyph({ name: 'A', unicode: 65, advanceWidth: 640, path: poly([[20, 0], [120, 0], [320, 560], [520, 0], [620, 0], [370, 700], [270, 700]]) }),
  new opentype.Glyph({ name: 'T', unicode: 84, advanceWidth: 580, path: poly([[245, 0], [335, 0], [335, 620], [560, 620], [560, 700], [20, 700], [20, 620], [245, 620]]) }),
  new opentype.Glyph({ name: 'V', unicode: 86, advanceWidth: 640, path: poly([[270, 0], [370, 0], [620, 700], [520, 700], [320, 140], [120, 700], [20, 700]]) }),
  new opentype.Glyph({ name: 'o', unicode: 111, advanceWidth: 560, path: ring }),
]
const id = (name: string) => glyphs.findIndex((g) => g.name === name)

const font = new opentype.Font({
  familyName: 'FontWish Spike',
  styleName: 'Regular',
  unitsPerEm: 1000,
  ascender: 800,
  descender: -200,
  designer: 'FontWish',
  license: 'This Font Software is licensed under the SIL Open Font License, Version 1.1.',
  licenseURL: 'https://openfontlicense.org',
  glyphs,
})

const otfPlain = new Uint8Array(font.toArrayBuffer())
const gpos = makeGposTable({
  left: [[id('A')], [id('T')], [id('V')]],
  right: [[id('V')], [id('o')], [id('A')]],
  values: [
    { left: 0, right: 0, value: -90 }, // A V
    { left: 1, right: 1, value: -70 }, // T o
    { left: 2, right: 2, value: -90 }, // V A
    { left: 2, right: 1, value: -50 }, // V o
  ],
})
const otf = setTable(otfPlain, 'GPOS', gpos)
const woff2 = await wawoff2.compress(otf)

writeFileSync(new URL('FontWishSpike.otf', out), otf)
writeFileSync(new URL('FontWishSpike.woff2', out), woff2)

const reparsed = opentype.parse(otf.buffer)
const kern = (a: string, b: string) => reparsed.getKerningValue(reparsed.charToGlyph(a), reparsed.charToGlyph(b))
console.log(`OTF ${otf.length} Bytes, WOFF2 ${woff2.length} Bytes`)
console.log(`Kerning laut opentype.js: AV=${kern('A', 'V')} To=${kern('T', 'o')} VA=${kern('V', 'A')} Vo=${kern('V', 'o')} AA=${kern('A', 'A')}`)
