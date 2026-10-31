// Schreibt eine GPOS-Tabelle mit klassenbasiertem Kerning (PairPos Format 2).
// opentype.js 2.0 kann GPOS lesen, aber nicht schreiben, deshalb bauen wir sie selbst.
import { ByteWriter } from './binary.ts'

export type KerningClasses = {
  /** Linke Klassen: Glyphen-IDs je Klasse. Klasse 0 ist implizit „alle übrigen“. */
  left: number[][]
  /** Rechte Klassen: Glyphen-IDs je Klasse. */
  right: number[][]
  /** Wert in Font-Einheiten für (linke Klasse, rechte Klasse), beide 0-basiert über die Listen oben. */
  values: { left: number; right: number; value: number }[]
}

function coverage(glyphs: number[]): Uint8Array {
  const sorted = [...new Set(glyphs)].sort((a, b) => a - b)
  const w = new ByteWriter().u16(1).u16(sorted.length)
  for (const g of sorted) w.u16(g)
  return w.toUint8Array()
}

function classDef(classes: number[][]): Uint8Array {
  // Format 2: Bereiche aufeinanderfolgender Glyphen mit gleicher Klasse.
  const entries: [number, number][] = []
  classes.forEach((glyphs, i) => glyphs.forEach((g) => entries.push([g, i + 1])))
  entries.sort((a, b) => a[0] - b[0])
  for (let i = 1; i < entries.length; i++) {
    if (entries[i][0] === entries[i - 1][0]) throw new Error(`Glyphe ${entries[i][0]} steht in zwei Kerning-Klassen`)
  }
  const ranges: [number, number, number][] = []
  for (const [g, c] of entries) {
    const last = ranges[ranges.length - 1]
    if (last && last[1] === g - 1 && last[2] === c) last[1] = g
    else ranges.push([g, g, c])
  }
  const w = new ByteWriter().u16(2).u16(ranges.length)
  for (const [start, end, c] of ranges) w.u16(start).u16(end).u16(c)
  return w.toUint8Array()
}

function pairPosFormat2(k: KerningClasses): Uint8Array {
  const class1Count = k.left.length + 1
  const class2Count = k.right.length + 1
  const matrix = Array.from({ length: class1Count }, () => new Array<number>(class2Count).fill(0))
  for (const { left, right, value } of k.values) matrix[left + 1][right + 1] = Math.round(value)

  const cov = coverage(k.left.flat())
  const cd1 = classDef(k.left)
  const cd2 = classDef(k.right)

  const headerSize = 16
  const recordsSize = class1Count * class2Count * 2 // nur XAdvance je Paar
  const covOffset = headerSize + recordsSize
  const cd1Offset = covOffset + cov.length
  const cd2Offset = cd1Offset + cd1.length

  const w = new ByteWriter()
    .u16(2) // posFormat
    .u16(covOffset)
    .u16(0x0004) // valueFormat1: XAdvance
    .u16(0) // valueFormat2
    .u16(cd1Offset)
    .u16(cd2Offset)
    .u16(class1Count)
    .u16(class2Count)
  for (const row of matrix) for (const v of row) w.i16(v)
  w.bytesFrom(cov).bytesFrom(cd1).bytesFrom(cd2)
  return w.toUint8Array()
}

export function makeGposTable(k: KerningClasses): Uint8Array {
  const subtable = pairPosFormat2(k)

  // ScriptList: DFLT und latn zeigen beide auf Feature 0 („kern“).
  const scripts = ['DFLT', 'latn']
  const scriptTable = new ByteWriter()
    .u16(4) // defaultLangSys direkt hinter diesem Script-Kopf
    .u16(0) // langSysCount
    .u16(0) // lookupOrderOffset
    .u16(0xffff) // requiredFeatureIndex
    .u16(1)
    .u16(0)
    .toUint8Array()
  const scriptList = new ByteWriter().u16(scripts.length)
  const scriptListHeader = 2 + scripts.length * 6
  scripts.forEach((tag, i) => scriptList.tag(tag).u16(scriptListHeader + i * scriptTable.length))
  scripts.forEach(() => scriptList.bytesFrom(scriptTable))

  const featureList = new ByteWriter()
    .u16(1)
    .tag('kern')
    .u16(8) // Feature-Tabelle direkt hinter dem Record
    .u16(0) // featureParamsOffset
    .u16(1)
    .u16(0) // Lookup 0

  const lookupList = new ByteWriter()
    .u16(1)
    .u16(4) // Lookup direkt hinter der Liste
    .u16(2) // lookupType: Pair Adjustment
    .u16(0) // lookupFlag
    .u16(1)
    .u16(8) // Subtabelle direkt hinter dem Lookup-Kopf (vom Lookup aus gerechnet)
    .bytesFrom(subtable)

  const sl = scriptList.toUint8Array()
  const fl = featureList.toUint8Array()
  const ll = lookupList.toUint8Array()
  const headerSize = 10
  return new ByteWriter()
    .u16(1)
    .u16(0)
    .u16(headerSize)
    .u16(headerSize + sl.length)
    .u16(headerSize + sl.length + fl.length)
    .bytesFrom(sl)
    .bytesFrom(fl)
    .bytesFrom(ll)
    .toUint8Array()
}
