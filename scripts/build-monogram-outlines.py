#!/usr/bin/env python3
"""Build the maker's Latin glyph outlines from OFL TTFs and site font subsets.

Usage: python3 scripts/build-monogram-outlines.py DIRECTORY_WITH_TTFS
Requires fonttools at build-authoring time only. Original OFL notices are
shipped in public/fonts/wedding/monogram/.
"""
import json
import string
import sys
from pathlib import Path

from fontTools.pens.boundsPen import BoundsPen
from fontTools.pens.svgPathPen import SVGPathPen
from fontTools.pens.transformPen import TransformPen
from fontTools.ttLib import TTFont
from fontTools.varLib.instancer import instantiateVariableFont

FILES = {
    'pinyon': 'PinyonScript',
    'greatVibes': 'GreatVibes',
    'meaCulpa': 'MeaCulpa',
    'fleurDeLeah': 'FleurDeLeah',
    'allura': 'Allura',
    'alexBrush': 'AlexBrush',
}


def numeric(v):
    return f'{v:.1f}'.removesuffix('.0')


def outlines(file, weight=None):
    with TTFont(file) as font:
        if weight is not None and "fvar" in font:
            instantiateVariableFont(font, {"wght": weight}, inplace=True)
        glyphs = font.getGlyphSet()
        cmap = font.getBestCmap()
        transform = (1, 0, 0, -1, 0, 0)
        result = {}
        for char in string.ascii_uppercase + '&':
            glyph = glyphs[cmap[ord(char)]]
            bounds = BoundsPen(glyphs)
            svg = SVGPathPen(glyphs, ntos=numeric)
            glyph.draw(TransformPen(bounds, transform))
            glyph.draw(TransformPen(svg, transform))
            x1, y1, x2, y2 = bounds.bounds
            result[char] = [round(v, 1) for v in (x1, y1, x2 - x1, y2 - y1)] + [
                svg.getCommands()
            ]
        return result


if __name__ == '__main__':
    source = Path(sys.argv[1])
    output = Path(__file__).resolve().parents[1] / 'src/shared/wedding/monogram-outlines.json'
    result = {key: outlines(source / f'{name}-Regular.ttf') for key, name in FILES.items()}
    fonts_dir = output.parents[3] / 'public/fonts/wedding'
    result.update({
        'cormorant': outlines(fonts_dir / 'cormorant-garamond-common.woff2', 400),
        'frauncesItalic': outlines(fonts_dir / 'fraunces-italic-common.woff2', 400),
        'cinzel': outlines(fonts_dir / 'cinzel-common.woff2', 400),
    })
    # One font per line keeps JSON compact while giving useful diffs by family.
    def write_atlas(target, atlas):
        entries = (json.dumps(key) + ':' + json.dumps(font, separators=(',', ':')) for key, font in atlas.items())
        target.write_text('{\n' + ',\n'.join(entries) + '\n}\n', encoding='utf-8')

    write_atlas(output, result)
    # Only the initial preview is in the entry bundle. Load A–Z near the tool.
    write_atlas(output.with_name('monogram-specimen-outlines.json'), {
        key: {char: font[char] for char in 'AL&'} for key, font in result.items()
    })
