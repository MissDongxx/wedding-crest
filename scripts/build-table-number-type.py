#!/usr/bin/env python3
"""Generate self-contained SVG outlines using the site's existing OFL subsets.

Run with fonttools[woff] installed: python scripts/build-table-number-type.py.
The 300-dpi export and the browser preview then use identical glyph geometry.
"""
import json
from pathlib import Path

from fontTools.pens.boundsPen import BoundsPen
from fontTools.pens.svgPathPen import SVGPathPen
from fontTools.pens.transformPen import TransformPen
from fontTools.ttLib import TTFont
from fontTools.varLib.instancer import instantiateVariableFont

root = Path(__file__).resolve().parents[1]
fonts = root / 'public/fonts/wedding'
spec = {
    'script': ('allura-welcome-latin.woff2', '0123456789Tablet', 400),
    'italic': ('fraunces-italic-common.woff2', '0123456789', 400),
    'cormorant': ('cormorant-garamond-common.woff2', '0123456789', 400),
    'garamond': ('eb-garamond-common.woff2', '0123456789', 500),
}

def rounded(number):
    return f'{number:.2f}'.rstrip('0').rstrip('.') or '0'

atlas = {}
for family, (name, chars, weight) in spec.items():
    with TTFont(fonts / name) as font:
        if 'fvar' in font and any(axis.axisTag == 'wght' for axis in font['fvar'].axes):
            instantiateVariableFont(font, {'wght': weight}, inplace=True)
        glyphs, cmap = font.getGlyphSet(), font.getBestCmap()
        # Cormorant defaults to old-style numerals. Match the reference's
        # consistent cap-height figures for mixed numbers such as 16 and 27.
        lining = {}
        if family == 'cormorant':
            gsub = font['GSUB'].table
            for feature in gsub.FeatureList.FeatureRecord:
                if feature.FeatureTag == 'lnum':
                    for index in feature.Feature.LookupListIndex:
                        for subtable in gsub.LookupList.Lookup[index].SubTable:
                            lining.update(subtable.mapping)
        atlas[family] = {}
        for char in sorted(set(chars)):
            default = cmap[ord(char)]
            glyph = glyphs[lining.get(default, default)]
            box = BoundsPen(glyphs)
            path = SVGPathPen(glyphs, ntos=rounded)
            glyph.draw(TransformPen(box, (1, 0, 0, -1, 0, 0)))
            glyph.draw(TransformPen(path, (1, 0, 0, -1, 0, 0)))
            x0,y0,x1,y1 = box.bounds
            atlas[family][char] = [round(n, 2) for n in (glyph.width,x0,y0,x1,y1)] + [path.getCommands()]
target = root / 'src/shared/wedding/table-number-type.json'
target.write_text('{\n' + ',\n'.join(f'{json.dumps(family)}:{json.dumps(glyphs, separators=(",",":"))}' for family,glyphs in atlas.items()) + '\n}\n')
