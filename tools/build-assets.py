#!/usr/bin/env python3
"""
TenuGUI · 手拭い — brand asset builder.

Generates every PNG identity asset from vector source, using the actual
Dela Gothic One outlines (no system font guessing) plus the site palette.

Requires: fonttools, pillow, ImageMagick (`magick`).
Run: python3 tools/build-assets.py
"""
from pathlib import Path
import subprocess
import tempfile
import math

from fontTools.ttLib import TTFont
from fontTools.pens.svgPathPen import SVGPathPen

ROOT = Path(__file__).resolve().parent.parent
OUT = ROOT / "assets" / "img"
SRC = ROOT / "tools" / "DelaGothicOne-Regular.ttf"

# --- palette ---------------------------------------------------------------
INK = "#211E19"
PAPER = "#F3EEE4"
RAISED_LIGHT = "#FBF8F1"
MUTED_LIGHT = "#6F6659"
LINE_LIGHT = "#D8D0C2"
PLUM = "#B0442A"

DARK = "#11100E"
DARK_SURFACE = "#191816"
DARK_ELEVATED = "#23211D"
OFFWHITE = "#F4F0E6"
MUTED_DARK = "#B9B2A5"
LINE_DARK = "#35322C"
LAVENDER = "#E0673F"

FONT = TTFont(SRC)
CMAP = FONT.getBestCmap()
GLYPHS = FONT.getGlyphSet()
HMTX = FONT["hmtx"]
UPEM = FONT["head"].unitsPerEm


def _text_path(text: str, size: float, x: float, y: float):
    """Return (svg path d, advance width) placing text baseline at x,y."""
    scale = size / UPEM
    pen_x = x
    parts = []
    prev = None
    for ch in text:
        if ch == " ":
            pen_x += 0.28 * size
            prev = None
            continue
        gname = CMAP.get(ord(ch))
        if not gname:
            pen_x += 0.3 * size
            prev = None
            continue
        pen = SVGPathPen(GLYPHS)
        GLYPHS[gname].draw(pen)
        d = pen.getCommands()
        if d:
            parts.append(
                f'<g transform="translate({pen_x:.2f} {y:.2f}) scale({scale:.5f} {-scale:.5f})">'
                f'<path d="{d}"/></g>'
            )
        pen_x += HMTX[gname][0] * scale
        prev = gname
    return "".join(parts), pen_x - x


def text(text, size, x, y, fill, anchor="start", tracking=0.0):
    path_d, width = _text_path(text, size, 0, 0)
    # tracking is applied by scaling the whole run slightly; keep exact for now
    tx = x
    if anchor == "middle":
        tx = x - width / 2
    elif anchor == "end":
        tx = x - width
    return (
        f'<g transform="translate({tx:.2f} {y:.2f})" fill="{fill}">{path_d}</g>'
    ), width


def svg(w, h, body, bg=None, radius=0):
    r = f' rx="{radius}"' if radius else ""
    bgrect = f'<rect width="{w}" height="{h}" fill="{bg}"{r}/>' if bg else ""
    return (
        f'<svg xmlns="http://www.w3.org/2000/svg" width="{w}" height="{h}" '
        f'viewBox="0 0 {w} {h}">{bgrect}{body}</svg>'
    )


def save_svg(name, content):
    path = OUT / "brand" / name
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(content, encoding="utf-8")
    return path


def render(svg_text, out_path, density=192, resize=None):
    out_path = Path(out_path)
    out_path.parent.mkdir(parents=True, exist_ok=True)
    with tempfile.NamedTemporaryFile("w", suffix=".svg", delete=False) as fh:
        fh.write(svg_text)
        tmp = fh.name
    cmd = ["magick", "-background", "none", "-density", str(density), tmp]
    if resize:
        cmd += ["-resize", resize]
    cmd += ["-strip", "-depth", "8", str(out_path)]
    subprocess.run(cmd, check=True)
    Path(tmp).unlink(missing_ok=True)
    print(f"  ✓ {out_path.relative_to(ROOT)}")


# --- motifs ---------------------------------------------------------------
def ichimatsu(x, y, cell, fill, opacity=1.0, squares=((0, 0), (1, 1), (2, 0), (0, 2), (2, 2))):
    out = []
    for cx, cy in squares:
        out.append(
            f'<rect x="{x + cx * cell:.2f}" y="{y + cy * cell:.2f}" width="{cell * 0.62:.2f}" '
            f'height="{cell * 0.62:.2f}" fill="{fill}" opacity="{opacity}"/>'
        )
    return "".join(out)


def orbit(cx, cy, r, ring, accent, node_fill, node_stroke, center_size, center_fill, center_text, scale=1.0):
    """Orbital signature, static vector geometry."""
    n = []
    n.append(f'<circle cx="{cx}" cy="{cy}" r="{r}" fill="none" stroke="{ring}" stroke-width="1.2"/>')
    n.append(f'<ellipse cx="{cx}" cy="{cy}" rx="{r * 0.92}" ry="{r * 0.38}" fill="none" stroke="{ring}" stroke-width="1" transform="rotate(-24 {cx} {cy})"/>')
    n.append(f'<ellipse cx="{cx}" cy="{cy}" rx="{r * 0.62}" ry="{r * 0.98}" fill="none" stroke="{ring}" stroke-width="0.8" stroke-dasharray="2 7" transform="rotate(18 {cx} {cy})"/>')
    n.append(f'<circle cx="{cx}" cy="{cy}" r="{r * 0.74}" fill="none" stroke="{ring}" stroke-width="0.6" opacity="0.5"/>')
    # nodes
    nodes = [(-24, r * 0.92), (52, r * 0.66), (146, r * 0.84), (208, r * 0.55), (292, r * 0.7)]
    for ang, dist in nodes:
        a = math.radians(ang)
        px, py = cx + math.cos(a) * dist, cy + math.sin(a) * dist
        n.append(
            f'<circle cx="{px:.2f}" cy="{py:.2f}" r="{max(2.6, r * 0.022):.2f}" fill="{node_fill}" stroke="{node_stroke}" stroke-width="1"/>'
        )
    # accent diamond + cross marks
    n.append(
        f'<rect x="{cx - r * 0.96}" y="{cy - r * 0.96}" width="{max(8, r * 0.045)}" height="{max(8, r * 0.045)}" fill="{accent}" transform="rotate(45 {cx - r * 0.96} {cy - r * 0.96})"/>'
    )
    n.append(f'<path d="M {cx + r * 0.66:.1f} {cy - r * 0.1:.1f} h {r*0.16:.1f} M {cx + r * 0.74:.1f} {cy - r * 0.18:.1f} v {r*0.16:.1f}" stroke="{accent}" stroke-width="1.4"/>')
    # center tile
    half = center_size / 2
    n.append(
        f'<rect x="{cx - half:.2f}" y="{cy - half:.2f}" width="{center_size:.2f}" height="{center_size:.2f}" rx="{center_size * 0.18:.2f}" fill="{center_fill}"/>'
    )
    label, w = text(center_text, center_size * 0.62, cx, cy + center_size * 0.225, accent if center_fill == OFFWHITE else PAPER, anchor="middle")
    n.append(label)
    return "".join(n)


# --- build mark / wordmark ------------------------------------------------
def build_marks():
    print("mark / wordmark")
    # square outline mark with 手
    for name, fg in (("mark-ink.svg", INK), ("mark-dark.svg", OFFWHITE), ("mark-mono.svg", "#000000")):
        body = (
            f'<rect x="62" y="62" width="388" height="388" rx="18" fill="none" stroke="{fg}" stroke-width="14"/>'
        )
        label, w = text("手", 268, 256, 352, fg, anchor="middle")
        save_svg(name, svg(512, 512, body + label))

    # solid tile mark used for favicons
    tile = (
        f'<rect width="512" height="512" rx="112" fill="{INK}"/>'
        + text("手", 300, 256, 365, PAPER, anchor="middle")[0]
    )
    save_svg("mark-tile.svg", svg(512, 512, tile))
    tile_dark = (
        f'<rect width="512" height="512" rx="112" fill="{OFFWHITE}"/>'
        + text("手", 300, 256, 365, DARK, anchor="middle")[0]
    )
    save_svg("mark-tile-dark.svg", svg(512, 512, tile_dark))
    # Solid vermilion tile for browser chrome: the outline mark turns to mush at 16px.
    favicon_mark = (
        f'<rect width="512" height="512" rx="112" fill="{LAVENDER}"/>'
        + text("手", 300, 256, 365, PAPER, anchor="middle")[0]
    )
    save_svg("mark-favicon.svg", svg(512, 512, favicon_mark))

    # wordmark
    for name, fg in (("wordmark-ink.svg", INK), ("wordmark-paper.svg", PAPER), ("wordmark-lavender.svg", LAVENDER)):
        label, w = text("TenuGUI", 300, 40, 360, fg)
        save_svg(name, svg(int(w + 90), 512, label))

    # lockup
    for name, ink in (("lockup-light.svg", INK), ("lockup-dark.svg", OFFWHITE)):
        body = (
            f'<rect x="40" y="40" width="176" height="176" rx="28" fill="none" stroke="{ink}" stroke-width="8"/>'
            + text("手", 108, 128, 168, ink, anchor="middle")[0]
        )
        label, w = text("TenuGUI", 118, 260, 152, ink)
        save_svg(name, svg(260 + int(w) + 60, 256, body + label))

    # PNG renders
    brand = OUT / "brand"
    render((brand / "mark-tile.svg").read_text(), brand / "mark-tile-512.png", resize="512x512")
    render((brand / "mark-ink.svg").read_text(), brand / "mark-ink-512.png", resize="512x512")
    render((brand / "mark-dark.svg").read_text(), brand / "mark-dark-512.png", resize="512x512")
    render((brand / "wordmark-ink.svg").read_text(), brand / "wordmark-ink.png", resize="1200x")
    render((brand / "wordmark-paper.svg").read_text(), brand / "wordmark-paper.png", resize="1200x")
    render((brand / "lockup-light.svg").read_text(), brand / "lockup-light.png", resize="1200x")
    render((brand / "lockup-dark.svg").read_text(), brand / "lockup-dark.png", resize="1200x")

    render((brand / "mark-favicon.svg").read_text(), brand / "mark-favicon-512.png", resize="512x512")
    # favicons from the line-art mark
    for size in (16, 24, 32, 48, 64, 180, 192, 512):
        render((brand / "mark-favicon.svg").read_text(), brand / f"favicon-{size}.png", resize=f"{size}x{size}")
    subprocess.run(
        ["magick", str(brand / "favicon-16.png"), str(brand / "favicon-24.png"),
         str(brand / "favicon-32.png"), str(brand / "favicon-48.png"), str(brand / "favicon.ico")],
        check=True,
    )
    print("  ✓ assets/img/brand/favicon.ico")


def build_signature():
    print("signature artwork")
    W = H = 1600
    variants = {
        "signature-dark": dict(bg=DARK, ring=LINE_DARK, accent=LAVENDER, node=LAVENDER, node_stroke=DARK, center=OFFWHITE, glyph=DARK),
        "signature-light": dict(bg=PAPER, ring=LINE_LIGHT, accent=PLUM, node=INK, node_stroke=PAPER, center=INK, glyph=PAPER),
        "signature-transparent": dict(bg=None, ring=MUTED_LIGHT, accent=PLUM, node=INK, node_stroke=PAPER, center=INK, glyph=PAPER),
        "signature-mono": dict(bg=None, ring="#000000", accent="#000000", node="#000000", node_stroke="#FFFFFF", center="#000000", glyph="#FFFFFF"),
    }
    for name, v in variants.items():
        art = orbit(800, 800, 560, v["ring"], v["accent"], v["node"], v["node_stroke"], 330, v["center"], "手", 1.0)
        art += ichimatsu(130, 1180, 64, v["accent"], 0.55, squares=((0, 0), (1, 1), (2, 0)))
        art += ichimatsu(1290, 170, 54, v["accent"], 0.42, squares=((2, 0), (1, 1), (2, 2)))
        label, _ = text("TENUGUI / SIGNATURE", 20, 800, 1510, v["ring"], anchor="middle")
        art += label
        content = svg(W, H, art, bg=v["bg"])
        save_svg(f"{name}.svg", content)
        render(content, OUT / "brand" / f"{name}.png", resize="1600x1600")


def build_identity_board():
    print("identity boards")
    for name, bg, fg, muted, accent, surface, line in (
        ("identity-primary-dark", DARK, OFFWHITE, MUTED_DARK, LAVENDER, DARK_SURFACE, LINE_DARK),
        ("identity-primary-light", PAPER, INK, MUTED_LIGHT, PLUM, RAISED_LIGHT, LINE_LIGHT),
    ):
        W, H = 1600, 1200
        b = f'<rect width="{W}" height="{H}" fill="{bg}"/>'
        b += f'<rect x="80" y="80" width="{W-160}" height="{H-160}" fill="none" stroke="{line}" stroke-width="1"/>'
        # corner ticks
        for x, y in ((80, 80), (W - 80, 80), (80, H - 80), (W - 80, H - 80)):
            b += f'<circle cx="{x}" cy="{y}" r="3" fill="{accent}"/>'
        # orbit art right
        b += f'<g opacity="0.9">{orbit(1190, 470, 250, line, accent, accent, bg, 170, "手" if name.endswith("light") else OFFWHITE, "手")}</g>'
        # big kanji
        label, _ = text("手拭い", 220, 150, 320, fg)
        b += label
        # wordmark
        label, _ = text("TenuGUI", 120, 150, 472, fg)
        b += label
        # descriptor
        label, _ = text("VISUAL IDENTITY", 22, 154, 535, accent)
        b += label
        label, _ = text("& DIRECT EDITING", 22, 154, 568, accent)
        b += label
        # palette
        palette = [surface, fg, muted, accent, line]
        for i, color in enumerate(palette):
            x = 150 + i * 150
            b += f'<rect x="{x}" y="720" width="120" height="120" fill="{color}" stroke="{line}" stroke-width="1"/>'
            b += text(["SURFACE", "TEXT", "MUTED", "ACCENT", "LINE"][i], 15, x + 60, 872, muted, anchor="middle")[0]
        # ichimatsu
        b += ichimatsu(150, 930, 24, accent, 0.8)
        # meta
        b += text("DELA GOTHIC ONE · INTER · IBM PLEX MONO", 16, 150, 1040, muted)[0]
        b += text("TENUGUI — 2026", 16, W - 150, 1040, muted, anchor="end")[0]
        content = svg(W, H, b, bg=bg)
        save_svg(f"{name}.svg", content)
        render(content, OUT / "brand" / f"{name}.png", resize="1600x1200")


def build_social():
    print("social preview")
    for mode, bg, fg, muted, accent, line in (
        ("dark", DARK, OFFWHITE, MUTED_DARK, LAVENDER, LINE_DARK),
        ("light", PAPER, INK, MUTED_LIGHT, PLUM, LINE_LIGHT),
    ):
        W, H = 1200, 630
        b = f'<rect width="{W}" height="{H}" fill="{bg}"/>'
        b += f'<rect x="48" y="48" width="{W-96}" height="{H-96}" fill="none" stroke="{line}" stroke-width="1"/>'
        # compact outline mark and name
        b += f'<rect x="80" y="84" width="44" height="44" rx="3" fill="none" stroke="{fg}" stroke-width="2.5"/>'
        b += text("手", 26, 102, 118, fg, anchor="middle")[0]
        b += text("TENUGUI / 手拭い", 17, 140, 113, muted)[0]
        # headline
        b += text("Edit what", 86, 80, 300, fg)[0]
        b += text("you see.", 86, 80, 390, fg)[0]
        b += f'<rect x="84" y="470" width="88" height="4" fill="{accent}"/>'
        b += text("DIRECT EDITING FOR STATIC PAGES  —  STANDALONE + LOCAL MCP", 17, 84, 516, muted)[0]
        content = svg(W, H, b, bg=bg)
        save_svg(f"og-{mode}.svg", content)
        render(content, OUT / "social" / f"og-{mode}.png", resize="1200x630")


def build_thumbs():
    print("thumbnail templates")
    W, H = 1200, 900
    for mode, bg, fg, muted, accent, surface, line in (
        ("dark", DARK, OFFWHITE, MUTED_DARK, LAVENDER, DARK_SURFACE, LINE_DARK),
        ("light", PAPER, INK, MUTED_LIGHT, PLUM, RAISED_LIGHT, LINE_LIGHT),
    ):
        # orbit
        b = f'<rect width="{W}" height="{H}" fill="{bg}"/>'
        b += f'<rect x="48" y="48" width="{W-96}" height="{H-96}" fill="{surface}" stroke="{line}" stroke-width="1"/>'
        b += orbit(600, 450, 300, line, accent, accent, surface, 210, fg, "手")
        b += text("ORBIT / 01", 18, 84, H - 84, muted)[0]
        content = svg(W, H, b, bg=bg)
        save_svg(f"thumb-orbit-{mode}.svg", content)
        render(content, OUT / "thumbs" / f"thumb-orbit-{mode}.png", resize="1200x900")

        # ichimatsu
        b = f'<rect width="{W}" height="{H}" fill="{bg}"/>'
        b += f'<rect x="48" y="48" width="{W-96}" height="{H-96}" fill="{surface}" stroke="{line}" stroke-width="1"/>'
        grid = ""
        for gy in range(4):
            for gx in range(5):
                if (gx + gy) % 2 == 0:
                    grid += f'<rect x="{150 + gx * 190}" y="{130 + gy * 160}" width="120" height="100" fill="{accent}" opacity="{0.35 + ((gx+gy) % 3) * 0.18}"/>'
        b += grid
        b += text("ICHIMATSU / 02", 18, 84, H - 84, muted)[0]
        content = svg(W, H, b, bg=bg)
        save_svg(f"thumb-ichimatsu-{mode}.svg", content)
        render(content, OUT / "thumbs" / f"thumb-ichimatsu-{mode}.png", resize="1200x900")

        # grid / interface
        b = f'<rect width="{W}" height="{H}" fill="{bg}"/>'
        b += f'<rect x="48" y="48" width="{W-96}" height="{H-96}" fill="{surface}" stroke="{line}" stroke-width="1"/>'
        for i in range(7):
            b += f'<line x1="{120}" y1="{170 + i * 85}" x2="{1080}" y2="{170 + i * 85}" stroke="{line}" stroke-width="1"/>'
        for i in range(4):
            b += f'<rect x="{120 + i * 250}" y="220" width="60" height="300" fill="{accent}" opacity="{0.18 + i * 0.12}"/>'
        b += f'<rect x="120" y="140" width="960" height="1" fill="{accent}"/>'
        b += text("SYSTEM / 03", 18, 84, H - 84, muted)[0]
        content = svg(W, H, b, bg=bg)
        save_svg(f"thumb-grid-{mode}.svg", content)
        render(content, OUT / "thumbs" / f"thumb-grid-{mode}.png", resize="1200x900")

        # type
        b = f'<rect width="{W}" height="{H}" fill="{bg}"/>'
        b += f'<rect x="48" y="48" width="{W-96}" height="{H-96}" fill="{surface}" stroke="{line}" stroke-width="1"/>'
        b += text("Aa", 420, 120, 560, fg)[0]
        b += text("手拭い", 92, 860, 300, accent)[0]
        b += text("TYPE / 04", 18, 84, H - 84, muted)[0]
        content = svg(W, H, b, bg=bg)
        save_svg(f"thumb-type-{mode}.svg", content)
        render(content, OUT / "thumbs" / f"thumb-type-{mode}.png", resize="1200x900")


def build_states():
    print("empty / placeholder states")
    for mode, bg, fg, muted, accent, line in (
        ("dark", DARK, OFFWHITE, MUTED_DARK, LAVENDER, LINE_DARK),
        ("light", PAPER, INK, MUTED_LIGHT, PLUM, LINE_LIGHT),
    ):
        # placeholder
        W, H = 1200, 900
        b = f'<rect width="{W}" height="{H}" fill="{bg}"/>'
        b += f'<rect x="48" y="48" width="{W-96}" height="{H-96}" fill="none" stroke="{line}" stroke-width="1" stroke-dasharray="6 8"/>'
        b += orbit(600, 430, 240, line, accent, accent, bg, 150, fg, "手")
        b += text("NO MEDIA YET", 17, 600, 790, muted, anchor="middle")[0]
        content = svg(W, H, b, bg=bg)
        save_svg(f"placeholder-{mode}.svg", content)
        render(content, OUT / "states" / f"placeholder-{mode}.png", resize="1200x900")

        # empty state
        W, H = 800, 600
        b = f'<rect width="{W}" height="{H}" fill="{bg}"/>'
        b += orbit(400, 270, 170, line, accent, accent, bg, 110, fg, "手")
        b += text("NOTHING HERE — YET", 15, 400, 510, muted, anchor="middle")[0]
        content = svg(W, H, b, bg=bg)
        save_svg(f"empty-{mode}.svg", content)
        render(content, OUT / "states" / f"empty-{mode}.png", resize="800x600")

        # error state
        b = f'<rect width="{W}" height="{H}" fill="{bg}"/>'
        b += orbit(400, 270, 170, line, accent, bg, accent, 110, "!", "手")
        b += text("SIGNAL LOST", 15, 400, 510, accent, anchor="middle")[0]
        content = svg(W, H, b, bg=bg)
        save_svg(f"error-{mode}.svg", content)
        render(content, OUT / "states" / f"error-{mode}.png", resize="800x600")


def build_pattern():
    print("patterns")
    cell = 80
    squares = ((0, 0), (1, 1), (2, 0), (0, 2), (2, 2))
    body = ""
    for cx, cy in squares:
        body += f'<rect x="{cx * cell + cell * 0.19}" y="{cy * cell + cell * 0.19}" width="{cell * 0.62}" height="{cell * 0.62}" fill="currentColor"/>'
    svg_text = (
        f'<svg xmlns="http://www.w3.org/2000/svg" width="{cell*3}" height="{cell*3}" '
        f'viewBox="0 0 {cell*3} {cell*3}" fill="none">{body}</svg>'
    )
    save_svg("pattern-ichimatsu.svg", svg_text)


if __name__ == "__main__":
    build_marks()
    build_signature()
    build_identity_board()
    build_social()
    build_thumbs()
    build_states()
    build_pattern()
    print("done")
