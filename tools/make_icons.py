"""Gera os ícones PWA a partir do recorte da cabeça do Karimbo (public/assets/img/karimbo_head.webp).
Uso: python tools/make_icons.py
"""
import os
from PIL import Image, ImageDraw, ImageFilter

root = os.path.join(os.path.dirname(__file__), "..")
head = Image.open(os.path.join(root, "public", "assets", "img", "karimbo_head.webp")).convert("RGBA")
out = os.path.join(root, "public", "icons")
os.makedirs(out, exist_ok=True)


def gradient(size):
    im = Image.new("RGB", (size, size))
    px = im.load()
    for y in range(size):
        t = y / (size - 1)
        # roxo profundo -> magenta -> laranja (pôr do sol da cidade)
        if t < 0.55:
            k = t / 0.55
            c = (int(30 + (200 - 30) * k), int(15 + (50 - 15) * k), int(80 + (140 - 80) * k))
        else:
            k = (t - 0.55) / 0.45
            c = (int(200 + (255 - 200) * k), int(50 + (150 - 50) * k), int(140 + (80 - 140) * k))
        for x in range(size):
            px[x, y] = c
    return im


def icon(size, maskable=False):
    bg = gradient(size).convert("RGBA")
    # halo
    glow = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    d = ImageDraw.Draw(glow)
    d.ellipse([size * 0.12, size * 0.12, size * 0.88, size * 0.88], fill=(255, 220, 120, 90))
    glow = glow.filter(ImageFilter.GaussianBlur(size * 0.06))
    bg = Image.alpha_composite(bg, glow)
    scale = 0.62 if maskable else 0.8
    hh = int(size * scale)
    ww = int(head.width * hh / head.height)
    h = head.resize((ww, hh), Image.LANCZOS)
    bg.alpha_composite(h, ((size - ww) // 2, int(size * (0.14 if maskable else 0.1))))
    if not maskable:
        mask = Image.new("L", (size, size), 0)
        ImageDraw.Draw(mask).rounded_rectangle([0, 0, size - 1, size - 1], radius=int(size * 0.22), fill=255)
        bg.putalpha(mask)
    return bg


icon(192).save(os.path.join(out, "icon-192.png"))
icon(512).save(os.path.join(out, "icon-512.png"))
icon(512, True).save(os.path.join(out, "icon-maskable-512.png"))
icon(180).save(os.path.join(out, "apple-touch-icon.png"))
print("ok")
