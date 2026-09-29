#!/usr/bin/env python3
"""
Builds the top-left logo from the supplied emblem JPEG.

The source is a re-encoded JPEG with the transparency checkerboard baked in. Its interior
checker patches have been smeared to mid-grey, so per-pixel keying cannot separate them from
the emblem's silver without eating the emblem too (verified: only ~1% of pixels inside the
silhouette still carry lattice structure).

So the honest, artefact-free treatment is a circular seal: crop the emblem's own pixels to a
circle centred on the medallion. The checkerboard becomes the badge's paper texture and there
is nothing to key, no halo and no holes. The result gets a dark rim so it reads as a patch on
the dark app bar.

If a transparent PNG or SVG of the emblem is supplied later, the cut-out version can replace
this file directly — the app only needs `client/public/logo.png`.
"""
import os

import numpy as np
from PIL import Image, ImageDraw, ImageFilter
from scipy import ndimage

SRC = "/home/user/workspaces/7c8da44d-7832-4fb0-9f02-57ce904e0c01/uploads/nasa_app_logo_6ef5923f.jpg"
OUT_DIR = "/tmp/space-relics-3d/client/public"
os.makedirs(OUT_DIR, exist_ok=True)

im = Image.open(SRC).convert("RGB")
arr = np.asarray(im).astype(np.float32)
lum = arr.mean(axis=2)
h, w = lum.shape

# ---------------------------------------------------------------- emblem silhouette
border = np.zeros_like(lum, dtype=bool)
border[:14, :] = border[-14:, :] = border[:, :14] = border[:, -14:] = True
ring = lum[border]
low = float(np.percentile(ring, 25))
high = float(np.percentile(ring, 75))
residual = np.minimum(np.abs(lum - low), np.abs(lum - high))

mask = residual > 30
mask = ndimage.binary_closing(mask, np.ones((5, 5), dtype=bool))
mask = ndimage.binary_opening(mask, np.ones((3, 3), dtype=bool))
mask = ndimage.binary_fill_holes(mask)
labelled, count = ndimage.label(mask, np.ones((3, 3), dtype=int))
sizes = ndimage.sum(np.ones_like(labelled), labelled, index=range(1, count + 1))
mask = labelled == (int(np.argmax(sizes)) + 1)

ys, xs = np.nonzero(mask)
cx, cy = float(xs.mean()), float(ys.mean())
radius = float(np.sqrt(((xs - cx) ** 2 + (ys - cy) ** 2).max()))
radius *= 1.045  # margin so the outer ring is not clipped
print(f"emblem centre ({cx:.0f},{cy:.0f}) · radius {radius:.0f}px · silhouette covers {mask.mean() * 100:.1f}%")

# ---------------------------------------------------------------- circular seal
side = int(round(radius * 2))
left = int(round(cx - radius))
top = int(round(cy - radius))
left = max(0, min(left, w - side)) if side <= w else 0
top = max(0, min(top, h - side)) if side <= h else 0
side = min(side, w - left, h - top)
crop = im.crop((left, top, left + side, top + side))
print(f"seal crop {side}×{side}px at {left},{top}")

# antialiased circular alpha, 4x supersampled
ss = 4
big = Image.new("L", (side * ss, side * ss), 0)
ImageDraw.Draw(big).ellipse(
    (ss, ss, side * ss - ss - 1, side * ss - ss - 1),
    fill=255,
)
alpha = big.resize((side, side), Image.LANCZOS)

# Tint and vignette: the baked-in checkerboard becomes part of the badge palette instead of
# reading as a transparency artefact, and the medal keeps its silver look.
import numpy as _np  # noqa: E402
from PIL import ImageEnhance as _Enhance  # noqa: E402

tinted = Image.blend(crop, Image.new("RGB", crop.size, (17, 27, 50)), 0.14)
darker = _Enhance.Brightness(tinted).enhance(0.74)
yy, xx = _np.mgrid[0:side, 0:side]
dist = _np.sqrt((xx - side / 2) ** 2 + (yy - side / 2) ** 2) / (side / 2)
vignette = _np.clip((1.12 - dist) / 0.42, 0.0, 1.0)
mask = Image.fromarray((vignette * 255).astype(_np.uint8), mode="L").filter(ImageFilter.GaussianBlur(2))
crop = Image.composite(tinted, darker, mask)

rgba = Image.merge("RGBA", (*crop.split(), alpha))

# dark rim for definition on the dark bar
rim = Image.new("RGBA", (side, side), (0, 0, 0, 0))
rd = ImageDraw.Draw(rim)
rd.ellipse((0, 0, side - 1, side - 1), outline=(6, 10, 20, 210), width=max(2, side // 90))
rd.ellipse((0, 0, side - 1, side - 1), outline=(255, 255, 255, 40), width=1)
rgba = Image.alpha_composite(rgba, rim.filter(ImageFilter.GaussianBlur(0.4)))

# ---------------------------------------------------------------- export
logo = rgba.resize((512, 512), Image.LANCZOS)
logo_path = os.path.join(OUT_DIR, "logo.png")
logo.save(logo_path)

print(f"logo.png 512×512 · {os.path.getsize(logo_path) / 1024:.0f} KB")
band = np.asarray(logo.getchannel("A"))
print(f"alpha: transparent corners {(band[0, 0])}/255 · solid centre {(band[256, 256])}/255")

# app-touch / favicon: a small square with the seal on transparent
fav = rgba.copy()
fav.thumbnail((128, 128), Image.LANCZOS)
fav.save(os.path.join(OUT_DIR, "favicon.png"))
print(f"favicon.png {fav.size} · {os.path.getsize(os.path.join(OUT_DIR, 'favicon.png')) / 1024:.0f} KB")

# ---------------------------------------------------------------- preview on the top bar
preview = Image.new("RGB", (880, 380), (9, 13, 26))
ImageDraw.Draw(preview).rectangle((0, 0, 880, 60), fill=(12, 18, 34))
big_prev = rgba.copy()
big_prev.thumbnail((300, 300), Image.LANCZOS)
preview.paste(big_prev, (30, 80), big_prev)
# mock top bar: seal + wordmark at real size
for i, size in enumerate((40, 34, 28, 22)):
    s = rgba.copy()
    s.thumbnail((size, size), Image.LANCZOS)
    x = 40 + i * 200
    preview.paste(s, (x, 12), s)
    d = ImageDraw.Draw(preview)
    d.text((x + size + 8, 12 + size // 2 - 6), "SPACE RELICS", fill=(242, 246, 255))
preview.save("/tmp/logo_preview.png")
print("preview saved")
