# FontWish – Umsetzungsplan

Stand: 31.10.2026 · Grundlage: „Schrift-Generator: Anweisung für Claude Code“

## 0. Entscheidungen von René (31.10.2026)

| Frage | Antwort |
|---|---|
| Öffentliches GitHub-Repo, Code unter MIT | ja |
| Vercel Hobby, privates Projekt, nicht kommerziell | ja |
| Kostenlose `*.vercel.app`-Adresse statt eigener Domain | ja, `fontwish.vercel.app` (am 31.10. noch frei) |
| Impressum und Datenschutz | Renés Name und Anschrift (Anschrift erst vor Veröffentlichung nötig) |
| Modell-Download von Hugging Face nach Zustimmung | ja |
| Spracheingabe | Whisper lokal im Browser als Standard |
| Zeichensatz | Liste aus der Anweisung plus ẞ und € |
| Stil-Vorbilder | Nr. 3 geometrisch-weich (Wirkung wie Avenir), Nr. 10 Slab (wie Rockwell), Nr. 11 formelle Schreibschrift (wie Snell Roundhand). Beispiele unter `~/.ronny/vorschau/TypeCraft/stilrichtungen-iphone.html` |
| GitHub | Privates Konto `gitbauerrene`, nicht das Arbeitskonto `rooombauer` |
| Name | **FontWish**, Slogan „just your type“. TypeCraft war zu oft belegt (Domains, Schriftfamilie, Podcast). |

Projektordner auf dem Mac heißt weiter `~/CLAUDE/TypeCraft`, Repo: `gitbauerrene/fontwish`.

## 1. Ziel in einem Satz

Eine statische Web-App, in der man per Text oder Sprache eine Schrift beschreibt, sie per Feedback oder Regler verfeinert und als OTF/WOFF2 unter SIL OFL herunterlädt. Alles läuft im Browser der Nutzer: kein Server, kein Login, keine laufenden Kosten außer dem kostenlosen Vercel-Konto.

## 2. Leitentscheidungen

| Thema | Entscheidung | Warum |
|---|---|---|
| Kostenmodell | Nur statische Dateien auf Vercel (Hobby). Alles Rechenintensive im Browser. | Keine Serverfunktionen, keine Datenbank, nichts, das mit Nutzerzahlen Geld kostet. |
| Modell-Download | **Nicht** von Vercel ausliefern, sondern vom Hugging-Face-CDN laden (Standard bei WebLLM). | Vercel Hobby hat ca. 100 GB Traffic im Monat. Bei 500 MB pro Modell wäre das nach etwa 200 Downloads verbraucht. Hugging Face liefert Modelle kostenlos aus. |
| KI-Rolle | Das Modell erzeugt nur JSON-Parameter, nie Kurven. | Kleine Modelle zeichnen keine guten Glyphen (Punkt 1 der Anweisung). |
| Modell-Laufzeit | **WebLLM** mit erzwungener JSON-Schema-Ausgabe (Grammatik-Decoding). | Garantiert gültiges JSON auch bei kleinen Modellen. Transformers.js kann das nicht so verlässlich. |
| Modell | Qwen-Familie, ca. 0,5–1,5 Mrd. Parameter, 4-Bit (z. B. Qwen2.5-1.5B-Instruct q4f16, ca. 1 GB; kleiner: 0.5B, ca. 400 MB). Endgültige Wahl nach Test in Phase 3. | Gutes Deutsch und Englisch, Apache-2.0-Lizenz. |
| Fallback ohne WebGPU | Regler + Presets **plus** ein einfacher Stichwort-Übersetzer („fett“, „schmal“, „Serifen“, „rund“ …) ohne Modell. | Besser als nur Regler, kostet nichts, läuft überall. |
| Schrift-Engine | Eigene TypeScript-Engine: Skelett-Linien je Glyphe → Strichkonturen mit Stiftmodell (Kontrast, Winkel) → Serifen und Terminals als Bausteine → Überlappungen entfernen. | Parametrisch und vollständig unter eigener Kontrolle. Keine fremde Schrift als Grundlage. |
| Kurven-Operationen | Skia PathKit (WASM, BSD-Lizenz) oder paper.js für Vereinigung und Vereinfachung von Pfaden. Wahl im Vorab-Test. | Saubere Konturen ohne Überlappungen sind Pflicht für brauchbare Fonts. |
| Export | opentype.js für OTF. WOFF2 über wawoff2 (Googles woff2 als WASM). Kerning als GPOS-Tabelle, notfalls über fontTools in Pyodide (wird nur beim Export nachgeladen). | Alles im Browser. Ob opentype.js GPOS-Kerning sauber schreibt, prüft der Vorab-Test. |
| Sprache | Phase 4: Whisper lokal im Browser (Transformers.js), Download nach Zustimmung wie beim Sprachmodell. | Kein Ton verlässt das Gerät. Die Web Speech API schickt in Chrome den Ton an Google. |
| Speicherung | IndexedDB (Projekte, Versionen), Export/Import als JSON. | Kein Konto nötig. |
| Oberfläche | Vite + React + TypeScript, Deutsch/Englisch, keine externen Schriften oder Skripte, kein Tracking. | Vorgaben der Anweisung, DSGVO-freundlich. |

## 3. Architektur

```
fontwish/
├─ src/
│  ├─ engine/      reine TS-Bibliothek, kein DOM, läuft im Web Worker
│  │  ├─ params.ts        Parameter-Schema, Grenzen, Standardwerte, Presets
│  │  ├─ skeleton/        Skelett-Definitionen je Glyphe (Sans, Serif)
│  │  ├─ pen.ts           Strich → Kontur (Breite, Kontrast, Stiftwinkel)
│  │  ├─ parts/           Serifen, Terminals, Punkte, Bögen
│  │  ├─ outline.ts       Überlappungen entfernen, Laufrichtung, Extrempunkte
│  │  ├─ metrics.ts       Vor- und Nachbreite (Spacing)
│  │  └─ kerning.ts       automatisches Grund-Kerning
│  ├─ export/      OTF, WOFF2, CSS-Snippet, OFL-Text, Namens-Tabellen
│  ├─ model/       WebGPU-Prüfung, Download-Dialog, WebLLM, Prompt, Schema, Stichwort-Fallback
│  ├─ speech/      Spracheingabe (Phase 4)
│  ├─ preview/     Glyphenraster, Schriftbild-Texte, Größen, hell/dunkel
│  ├─ project/     IndexedDB, Versionsverlauf, Vergleich, JSON-Import/-Export
│  ├─ i18n/        de.json, en.json
│  └─ ui/          React-Komponenten, Regler, Layout
├─ tests/          Vitest (Engine, Export) + Playwright (Browser lädt Font)
└─ scripts/        Prüfung exportierter Fonts mit fontTools und OTS
```

**Datenmodell (vereinfacht)**

```ts
type FontParams = {
  style: 'sans' | 'serif'            // später: 'script', 'hand'
  unitsPerEm: 1000
  xHeight; capHeight; ascender; descender
  weight; contrast; contrastAngle   // Strichstärke und Kontrast
  slant; width; tracking
  roundness; apertures; terminals: 'flat' | 'round' | 'angled' | 'ball'
  serif: { type: 'none' | 'bracketed' | 'slab' | 'hairline' | 'wedge'; size; bracket }
  overrides: Record<string, Partial<GlyphParams>>  // z. B. „a runder“
}
type Version = { id; parentId; createdAt; prompt?; params: FontParams; thumbnail }
```

Das Modell bekommt die Beschreibung und die aktuellen Parameter und gibt **nur Änderungen** als JSON zurück („Serifen feiner“ → `{ "serif": { "size": -0.15 } }`). Die App prüft die Werte gegen das Schema und hält sie in den Grenzen.

## 4. Phasen

### Phase 0 – Vorab-Tests und Grundgerüst (kurz)
- Repo, Vite/React/TS, Vitest, Playwright, ESLint, GitHub Actions, Vercel-Anbindung.
- Drei Wegwerf-Tests, bevor gebaut wird:
  1. opentype.js: OTF mit CFF-Konturen **und** GPOS-Kerning schreiben, in Chrome, Safari, Firefox und macOS laden.
  2. wawoff2: WOFF2 im Browser erzeugen.
  3. PathKit vs. paper.js: zwei überlappende Bézier-Striche vereinigen, ohne dass Kurven zu Polygonen zerfallen.
- Ergebnis: Entscheidung Export-Weg und Kurven-Bibliothek.

**Ergebnisse (31.10.2026)**, Skripte unter `spikes/`:

| Test | Ergebnis | Entscheidung |
|---|---|---|
| 1. OTF + Kerning | opentype.js 2.0 schreibt CFF-OTF, aber **kein** GPOS und kein `kern`. Eigenes Modul `src/export/gpos.ts` (klassenbasiertes PairPos Format 2) plus `src/export/sfnt.ts` (Tabelle einfügen, Prüfsummen). OTS: bestanden. fontTools: liest Kerning korrekt. Chrome (headless) und macOS CoreText laden die Datei und wenden das Kerning exakt an (−250 Einheiten = 25 px bei 100 px). | opentype.js + eigenes GPOS. Pyodide/fontTools im Browser nicht nötig. |
| 2. WOFF2 | wawoff2 erzeugt gültiges WOFF2 (2,3 KB → 1,0 KB), OTS bestanden, Chrome und macOS laden es. Größe ca. 380 KB gzip. | wawoff2, nur beim Export nachladen. |
| 3. Kurven vereinigen | Beide erhalten die Bézierkurven (keine Kegelschnitte). PathKit 0,5 ms, paper.js 2,1 ms je Vereinigung. **PathKit liefert Innen- und Außenkonturen gleich orientiert** (nur für Even-Odd richtig), paper.js richtig. | PathKit (135 KB gzip) + eigener Schritt für die Laufrichtung der Konturen in `engine/outline.ts`. paper.js bleibt Ausweichlösung. |

Noch offen aus Phase 0: Firefox- und Safari-Ladetest automatisieren (Playwright in CI), Vercel-Anbindung. opentype.js schreibt eine überflüssige `ltag`-Tabelle; harmlos, wird beim Export später entfernt.

### Phase 1 – Parametrische Engine, Regler, Export (der größte Teil)
- Parameter-Schema mit Grenzen und Presets. Die ersten beiden Presets, an denen das Schriftbild abgestimmt wird: **geometrisch-weiche Sans** (Renés Nr. 3) und **Slab** (Nr. 10). Weitere wie Grotesk, Antiqua, Didone folgen danach.
- Das Stiftmodell (Kontrast, Stiftwinkel, Spitzfeder-Druck) gleich so anlegen, dass die formelle Schreibschrift (Nr. 11) in Phase 5 darauf aufbauen kann.
- Skelette für alle Glyphen der Liste in **Sans** und **Serif**: A–Z, a–z, 0–9, ÄÖÜäöüß, ẞ, gängige Satzzeichen (. , : ; ! ? ' " - – — ( ) / & @ € %). Umlaute als Zusammensetzung aus Grundbuchstabe und Punkten.
- Optische Korrekturen von Anfang an: Überhang runder Formen, dünnere Verbindungen bei n/m/h, Strichstärken waagrecht dünner als senkrecht, Zentrierung von Bögen.
- Spacing nach Seitengruppen (gerade, rund, diagonal), Grund-Kerning über Klassen (AV, To, LT, Ty, r., f usw.).
- Export OTF + WOFF2 + CSS-Snippet, OFL-Text und Lizenz-URL in der Namens-Tabelle, Fontname frei wählbar.
- Tests: Parameter-Grenzen erzeugen gültige Konturen (keine Selbstüberschneidung, richtige Laufrichtung), Snapshot-Tests der Glyphen als SVG, exportierte Datei besteht OTS-Prüfung (das ist der Prüfer, den Chrome und Firefox nutzen) und lädt in Chrome, Firefox, WebKit.
- **Tor:** Du bekommst Vorschau-Bilder (iPhone/Mac) und gibst das Schriftbild frei. Erst dann Phase 2.

### Phase 2 – Vorschau und Versionsverlauf
- Glyphenraster, Pangramme (deutsch, englisch), „Hamburgefonstiv“, Fließtext, Überschrift; 12/16/24/48/96 px; hell und dunkel.
- Versionsbaum: jede Änderung eine Version, Vergleich zweier Versionen nebeneinander oder übereinander, Zurückspringen.
- Projekte in IndexedDB, Export/Import als JSON.

### Phase 3 – Lokales Modell
- WebGPU-Prüfung, Hinweis auf Gerät und Speicher, Download-Dialog mit Größe, Zustimmung, Fortschritt, Abbrechen, „Modell löschen“.
- Prompt mit Beispielen (Deutsch/Englisch), JSON-Schema, Prüfung und Begrenzung der Werte.
- Testset von ca. 50 Beschreibungen mit erwarteten Richtungen (z. B. „fetter“ → weight steigt), um Modelle zu vergleichen.
- Stichwort-Fallback für Geräte ohne WebGPU.

### Phase 4 – Spracheingabe
- Mikrofon-Knopf mit lokalem Whisper (whisper-base, mehrsprachig), Download nach Zustimmung; Texteingabe bleibt immer.
- Auf Geräten ohne WebGPU läuft Whisper langsamer über WASM. Ist das zu langsam, wird der Knopf ausgeblendet.

### Phase 5 – Weitere Stile und besseres Kerning
- Handschrift und Script (verbundene Formen, Kontextalternativen über OpenType-Features).
- Kerning über Formanalyse statt nur Klassen.
- Erweiterung Zeichensatz auf Westeuropa (Latin-1, Akzente).

## 5. Qualitätssicherung

- Vitest für Engine und Export, Playwright für Browser-Laden, OTS und fontTools in GitHub Actions.
- Bei jedem Pull Request automatisch eine Vercel-Vorschau-URL zum Ausprobieren auf dem iPhone.
- Visuelle Vergleichsbilder der Glyphen, damit Änderungen an der Engine nichts unbemerkt verschlechtern.

## 6. Recht und Datenschutz

- Code: MIT (öffentliches Repo). Exportierte Schriften: SIL OFL 1.1 mit Copyright-Zeile des Nutzers („Copyright 2026 <Name>, erstellt mit FontWish“).
- Kein Hochladen fremder Fonts, keine Funktion „wie Helvetica“. Das Modell wird angewiesen, Markennamen von Schriften nur als grobe Stilrichtung zu deuten (z. B. „Grotesk“), nie als Vorlage.
- Impressum und Datenschutzerklärung (Deutschland). In der Datenschutzerklärung erwähnen: Vercel (Hosting, Server-Logs), Hugging Face (Download von Sprachmodell und Whisper, nur nach Zustimmung).
- Keine Google Fonts, kein CDN für Oberfläche, keine Cookies, kein Tracking.

## 7. Risiken

| Risiko | Gegenmaßnahme |
|---|---|
| Schriftbild wirkt steif | Optische Korrekturen von Anfang an, Tor nach Phase 1, Presets von Hand abgestimmt. |
| Kleines Modell versteht Feinheiten schlecht | Nur Änderungen ausgeben, klare Beispiele im Prompt, Testset, im Zweifel größeres Modell als Wahl. |
| Viele Geräte ohne WebGPU (vor allem ältere iPhones) | Stichwort-Fallback und Regler sind vollwertig nutzbar. |
| Vercel Hobby nur für nicht-kommerzielle Nutzung | Keine Werbung, keine Spenden-Bezahlfunktion im Hobby-Konto. |
