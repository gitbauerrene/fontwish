// Kleiner Schreiber für Big-Endian-Binärdaten, wie OpenType sie verlangt.
export class ByteWriter {
  private bytes: number[] = []

  get length(): number {
    return this.bytes.length
  }

  u16(value: number): this {
    if (value < 0 || value > 0xffff) throw new RangeError(`uint16 außerhalb des Bereichs: ${value}`)
    this.bytes.push((value >> 8) & 0xff, value & 0xff)
    return this
  }

  i16(value: number): this {
    if (value < -0x8000 || value > 0x7fff) throw new RangeError(`int16 außerhalb des Bereichs: ${value}`)
    return this.u16(value & 0xffff)
  }

  u32(value: number): this {
    this.bytes.push((value >>> 24) & 0xff, (value >>> 16) & 0xff, (value >>> 8) & 0xff, value & 0xff)
    return this
  }

  tag(tag: string): this {
    if (tag.length !== 4) throw new Error(`Tag muss 4 Zeichen haben: "${tag}"`)
    for (let i = 0; i < 4; i++) this.bytes.push(tag.charCodeAt(i))
    return this
  }

  bytesFrom(data: Uint8Array): this {
    for (const b of data) this.bytes.push(b)
    return this
  }

  pad4(): this {
    while (this.bytes.length % 4 !== 0) this.bytes.push(0)
    return this
  }

  toUint8Array(): Uint8Array {
    return Uint8Array.from(this.bytes)
  }
}
