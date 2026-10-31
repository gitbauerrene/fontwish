import { describe, expect, it } from 'vitest'
import { Font, Glyph, Path, parse } from 'opentype.js'
import { makeGposTable } from './gpos.ts'
import { readTables, setTable } from './sfnt.ts'

function box(): Path {
  const p = new Path()
  p.moveTo(0, 0)
  p.lineTo(400, 0)
  p.lineTo(400, 700)
  p.lineTo(0, 700)
  p.close()
  return p
}

function testFont(): { otf: Uint8Array; id: (name: string) => number } {
  const glyphs = [
    new Glyph({ name: '.notdef', advanceWidth: 500, path: box() }),
    ...['A', 'T', 'V', 'o'].map((c) => new Glyph({ name: c, unicode: c.charCodeAt(0), advanceWidth: 500, path: box() })),
  ]
  const font = new Font({ familyName: 'Test', styleName: 'Regular', unitsPerEm: 1000, ascender: 800, descender: -200, glyphs })
  return { otf: new Uint8Array(font.toArrayBuffer()), id: (n) => glyphs.findIndex((g) => g.name === n) }
}

describe('GPOS-Kerning', () => {
  it('wird von opentype.js mit den richtigen Werten zurückgelesen', () => {
    const { otf, id } = testFont()
    const gpos = makeGposTable({
      left: [[id('A'), id('V')], [id('T')]],
      right: [[id('V')], [id('o')]],
      values: [
        { left: 0, right: 0, value: -80 },
        { left: 1, right: 1, value: -60 },
      ],
    })
    const font = parse(setTable(otf, 'GPOS', gpos).buffer)
    const kern = (a: string, b: string) => font.getKerningValue(font.charToGlyph(a), font.charToGlyph(b))
    expect(kern('A', 'V')).toBe(-80)
    expect(kern('V', 'V')).toBe(-80)
    expect(kern('T', 'o')).toBe(-60)
    expect(kern('A', 'o')).toBe(0)
    expect(kern('o', 'A')).toBe(0)
  })

  it('lehnt Glyphen ab, die in zwei Klassen stehen', () => {
    expect(() => makeGposTable({ left: [[1], [1]], right: [[2]], values: [] })).toThrow(/zwei Kerning-Klassen/)
  })
})

describe('sfnt', () => {
  it('behält alle Tabellen und setzt eine gültige Prüfsumme', () => {
    const { otf } = testFont()
    const before = readTables(otf).tables.map((t) => t.tag)
    const after = setTable(otf, 'GPOS', makeGposTable({ left: [[1]], right: [[2]], values: [{ left: 0, right: 0, value: -10 }] }))
    expect(readTables(after).tables.map((t) => t.tag).sort()).toEqual([...before, 'GPOS'].sort())

    // Summe über die ganze Datei inklusive checkSumAdjustment muss 0xB1B0AFBA ergeben.
    const view = new DataView(after.buffer)
    let sum = 0
    for (let i = 0; i < after.length; i += 4) sum = (sum + view.getUint32(i)) >>> 0
    expect(sum).toBe(0xb1b0afba)
  })
})
