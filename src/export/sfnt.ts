// Fügt einer fertigen OpenType-Datei Tabellen hinzu oder ersetzt sie
// und berechnet Verzeichnis, Prüfsummen und head.checkSumAdjustment neu.
import { ByteWriter } from './binary.ts'

type Table = { tag: string; data: Uint8Array }

function checksum(data: Uint8Array): number {
  let sum = 0
  const padded = new Uint8Array(Math.ceil(data.length / 4) * 4)
  padded.set(data)
  const view = new DataView(padded.buffer, padded.byteOffset, padded.byteLength)
  for (let i = 0; i < padded.length; i += 4) sum = (sum + view.getUint32(i)) >>> 0
  return sum
}

export function readTables(font: Uint8Array): { sfntVersion: number; tables: Table[] } {
  const view = new DataView(font.buffer, font.byteOffset, font.byteLength)
  const sfntVersion = view.getUint32(0)
  const numTables = view.getUint16(4)
  const tables: Table[] = []
  for (let i = 0; i < numTables; i++) {
    const rec = 12 + i * 16
    const tag = String.fromCharCode(...font.subarray(rec, rec + 4))
    const offset = view.getUint32(rec + 8)
    const length = view.getUint32(rec + 12)
    tables.push({ tag, data: font.slice(offset, offset + length) })
  }
  return { sfntVersion, tables }
}

export function writeFont(sfntVersion: number, input: Table[]): Uint8Array {
  const tables = [...input].sort((a, b) => (a.tag < b.tag ? -1 : a.tag > b.tag ? 1 : 0))
  const head = tables.find((t) => t.tag === 'head')
  if (head) {
    head.data = head.data.slice()
    new DataView(head.data.buffer).setUint32(8, 0) // checkSumAdjustment vorerst 0
  }

  const numTables = tables.length
  const entrySelector = Math.floor(Math.log2(numTables))
  const searchRange = 2 ** entrySelector * 16
  const w = new ByteWriter()
    .u32(sfntVersion)
    .u16(numTables)
    .u16(searchRange)
    .u16(entrySelector)
    .u16(numTables * 16 - searchRange)

  let offset = 12 + numTables * 16
  for (const t of tables) {
    w.tag(t.tag).u32(checksum(t.data)).u32(offset).u32(t.data.length)
    offset += Math.ceil(t.data.length / 4) * 4
  }
  for (const t of tables) w.bytesFrom(t.data).pad4()

  const font = w.toUint8Array()
  if (head) {
    const headOffset = new DataView(font.buffer).getUint32(12 + tables.indexOf(head) * 16 + 8)
    new DataView(font.buffer).setUint32(headOffset + 8, (0xb1b0afba - checksum(font)) >>> 0)
  }
  return font
}

export function setTable(font: Uint8Array, tag: string, data: Uint8Array): Uint8Array {
  const { sfntVersion, tables } = readTables(font)
  const rest = tables.filter((t) => t.tag !== tag)
  return writeFont(sfntVersion, [...rest, { tag, data }])
}
