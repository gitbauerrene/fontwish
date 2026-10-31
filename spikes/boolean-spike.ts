// Vorab-Test 3: Überlappende Kurven vereinigen, ohne dass Bézierkurven zu Polygonen zerfallen.
// Vergleich Skia PathKit (WASM) gegen paper.js. Aufruf: node spikes/boolean-spike.ts
import { createRequire } from 'node:module'
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'

const require = createRequire(import.meta.url)

// Typischer Fall aus der Engine: Bauch eines „d“ (Ring aus Kubikkurven) plus Stamm, der ihn überlappt.
const k = 0.5523
const ellipse = (cx: number, cy: number, rx: number, ry: number, ccw: boolean) => {
  const d = ccw ? 1 : -1
  return [
    `M ${cx + rx} ${cy}`,
    `C ${cx + rx} ${cy + d * ry * k} ${cx + rx * k} ${cy + d * ry} ${cx} ${cy + d * ry}`,
    `C ${cx - rx * k} ${cy + d * ry} ${cx - rx} ${cy + d * ry * k} ${cx - rx} ${cy}`,
    `C ${cx - rx} ${cy - d * ry * k} ${cx - rx * k} ${cy - d * ry} ${cx} ${cy - d * ry}`,
    `C ${cx + rx * k} ${cy - d * ry} ${cx + rx} ${cy - d * ry * k} ${cx + rx} ${cy} Z`,
  ].join(' ')
}
const bowl = `${ellipse(260, 250, 240, 260, true)} ${ellipse(260, 250, 160, 185, false)}`
const stem = 'M 420 0 L 510 0 L 510 760 L 420 760 Z'
// Zusätzlich ein schräger, gekrümmter Strich, der den Bauch schneidet (wie eine Serife oder ein Terminal).
const swash = 'M 0 520 C 120 640 300 640 420 560 L 440 600 C 300 700 100 700 -20 560 Z'

type Stats = { contours: number; lines: number; curves: number; ms: number; svg: string }

async function withPathKit(): Promise<Stats> {
  const init = require('pathkit-wasm/bin/pathkit.js')
  const PathKit = await init({ wasmBinary: readFileSync(require.resolve('pathkit-wasm/bin/pathkit.wasm')) })
  const t0 = performance.now()
  let result: any
  for (let i = 0; i < 200; i++) {
    const a = PathKit.FromSVGString(bowl)
    a.setFillType(PathKit.FillType.EVENODD)
    const b = PathKit.FromSVGString(stem)
    const c = PathKit.FromSVGString(swash)
    a.op(b, PathKit.PathOp.UNION).op(c, PathKit.PathOp.UNION).simplify()
    result?.delete()
    result = a
    b.delete()
    c.delete()
  }
  const ms = (performance.now() - t0) / 200
  const cmds: number[][] = result.toCmds()
  const v = PathKit as any
  const stats = {
    contours: cmds.filter((c) => c[0] === v.MOVE_VERB).length,
    lines: cmds.filter((c) => c[0] === v.LINE_VERB).length,
    curves: cmds.filter((c) => [v.CUBIC_VERB, v.QUAD_VERB, v.CONIC_VERB].includes(c[0])).length,
    conics: cmds.filter((c) => c[0] === v.CONIC_VERB).length,
    ms,
    svg: result.toSVGString(),
  }
  console.log(`  davon Kegelschnitte (in OTF nicht darstellbar): ${stats.conics}`)
  return stats
}

function withPaper(): Stats {
  const paper = require('paper/dist/paper-core.js')
  paper.setup(new paper.Size(1000, 1000))
  const t0 = performance.now()
  let result: any
  for (let i = 0; i < 200; i++) {
    const a = new paper.CompoundPath(bowl)
    a.fillRule = 'evenodd'
    const b = new paper.CompoundPath(stem)
    const c = new paper.CompoundPath(swash)
    result = a.unite(b).unite(c)
  }
  const ms = (performance.now() - t0) / 200
  const paths: any[] = result.children ?? [result]
  let lines = 0
  let curves = 0
  for (const p of paths) {
    for (const curve of p.curves) {
      if (curve.hasHandles()) curves++
      else lines++
    }
  }
  return { contours: paths.length, lines, curves, ms, svg: result.pathData }
}

mkdirSync(new URL('./out/', import.meta.url), { recursive: true })
for (const [name, run] of [['PathKit', withPathKit], ['paper.js', withPaper]] as const) {
  console.log(`== ${name}`)
  const s = await run()
  console.log(`  Konturen ${s.contours}, Geraden ${s.lines}, Kurven ${s.curves}, ${s.ms.toFixed(2)} ms je Vereinigung`)
  writeFileSync(
    new URL(`./out/boolean-${name.replace('.', '')}.svg`, import.meta.url),
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="-40 -20 600 820"><g transform="translate(0 760) scale(1 -1)"><path d="${s.svg}" fill="#1b1a17" fill-rule="nonzero"/></g></svg>`,
  )
}
