# FontWish

*Just your type.* Beschreibe eine Schrift in Worten oder per Sprache, verfeinere sie und lade sie als OTF/WOFF2 herunter, frei nutzbar unter der SIL Open Font License.

Alles läuft im Browser: kein Konto, kein Server, kein Tracking. Ein kleines Sprachmodell übersetzt Wünsche in Parameter, eine parametrische Engine zeichnet die Glyphen.

> Status: Phase 0 (Grundgerüst und Vorab-Tests). Plan: [PLAN.md](PLAN.md)

## Entwicklung

```bash
npm install
npm run dev     # Entwicklungsserver
npm test        # Unit-Tests (Vitest)
npm run build   # Typprüfung und Produktions-Build
```

Vorab-Tests zum Export liegen in `spikes/` (Aufruf mit `node spikes/<datei>.ts`, Node 24). Zur Prüfung der erzeugten Fonts:

```bash
python3 -m venv .venv && .venv/bin/pip install fonttools brotli opentype-sanitizer
.venv/bin/python -m ots spikes/out/FontWishSpike.otf
```

## Lizenz

Code: MIT. Mit FontWish erzeugte Schriften: SIL Open Font License 1.1.
