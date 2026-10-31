import CoreText
import Foundation
let url = URL(fileURLWithPath: CommandLine.arguments[1])
guard let descs = CTFontManagerCreateFontDescriptorsFromURL(url as CFURL) as? [CTFontDescriptor], let d = descs.first else { print("FEHLER: nicht ladbar"); exit(1) }
let font = CTFontCreateWithFontDescriptor(d, 100, nil)
print("Name:", CTFontCopyFullName(font))
func width(_ s: String, kern: Bool) -> Double {
  var attrs: [NSAttributedString.Key: Any] = [NSAttributedString.Key(kCTFontAttributeName as String): font]
  if !kern { attrs[NSAttributedString.Key(kCTKernAttributeName as String)] = 0.0 as CGFloat
    attrs[NSAttributedString.Key(kCTFontFeatureSettingsAttribute as String)] = nil }
  let line = CTLineCreateWithAttributedString(NSAttributedString(string: s, attributes: attrs))
  return CTLineGetTypographicBounds(line, nil, nil, nil)
}
let together = width("AVToVA", kern: true)
let single = ["A","V","T","o","V","A"].map { width($0, kern: true) }.reduce(0, +)
print(String(format: "Breite gesetzt %.1f, Summe Einzelzeichen %.1f, Differenz %.1f", together, single, single - together))
