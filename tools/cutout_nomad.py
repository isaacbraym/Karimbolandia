"""Recorte do Nômad (imagem canônica) -> PNG RGBA.

Uso: python tools/cutout_nomad.py <saida_dir> [--debug]
Fundo azul do render + texto "BASE / DEFAULT SKIN" são removidos; o robô não é redesenhado.
"""
import sys
import os
import cv2
import numpy as np
from PIL import Image

SRC = os.path.join(os.path.dirname(__file__), "..", "Nomad_RoboMontaria.webp")
out_dir = sys.argv[1] if len(sys.argv) > 1 else "."
os.makedirs(out_dir, exist_ok=True)

pil = Image.open(SRC).convert("RGB")
img = cv2.cvtColor(np.array(pil), cv2.COLOR_RGB2BGR)
H, W = img.shape[:2]
print("src", W, H)

b, g, r = [img[..., i].astype(np.float32) for i in range(3)]
# fundo: azulado (B domina R), o robô é oliva/amarelo/cinza-arroxeado
bluish = (b - r) > 18
# texto branco do canto inferior esquerdo + brilho do piso
allow = np.ones((H, W), np.uint8)
allow[640:, :330] = 0
allow[812:, :] = 0

seed = ((~bluish) & (allow > 0)).astype(np.uint8) * 255
seed = cv2.morphologyEx(seed, cv2.MORPH_OPEN, cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (5, 5)))
n, lbl, stats, _ = cv2.connectedComponentsWithStats(seed)
keep = [i for i in range(1, n) if stats[i, cv2.CC_STAT_AREA] > 700]
seed = (np.isin(lbl, keep) * 255).astype(np.uint8)

# casco convexo ao redor do robô: só dentro dele buscamos peças escuras azuladas
cnts, _ = cv2.findContours(seed, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
hull = cv2.convexHull(np.vstack(cnts))
hull_mask = np.zeros((H, W), np.uint8)
cv2.fillConvexPoly(hull_mask, hull, 255)
hull_mask = cv2.dilate(hull_mask, np.ones((3, 3), np.uint8), iterations=14)

mask = np.full((H, W), cv2.GC_BGD, np.uint8)
mask[(hull_mask > 0) & (allow > 0)] = cv2.GC_PR_BGD
mask[(hull_mask > 0) & (allow > 0) & ((b - r) < 60)] = cv2.GC_PR_FGD
mask[cv2.erode(seed, np.ones((3, 3), np.uint8), iterations=3) > 0] = cv2.GC_FGD
bgd = np.zeros((1, 65), np.float64)
fgd = np.zeros((1, 65), np.float64)
cv2.grabCut(img, mask, None, bgd, fgd, 8, cv2.GC_INIT_WITH_MASK)
fg = ((mask == cv2.GC_FGD) | (mask == cv2.GC_PR_FGD)).astype(np.uint8) * 255
fg[allow == 0] = 0
fg = cv2.morphologyEx(fg, cv2.MORPH_OPEN, cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (5, 5)))
fg = cv2.morphologyEx(fg, cv2.MORPH_CLOSE, cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (9, 9)))
n, lbl, stats, _ = cv2.connectedComponentsWithStats(fg)
keep = [i for i in range(1, n) if stats[i, cv2.CC_STAT_AREA] > 900]
fg = (np.isin(lbl, keep) * 255).astype(np.uint8)
inv = cv2.bitwise_not(fg)
n, lbl, stats, _ = cv2.connectedComponentsWithStats(inv)
for i in range(1, n):
    x, y, w, h, a = stats[i]
    if x > 0 and y > 0 and x + w < W and y + h < H and a < 6000:
        fg[lbl == i] = 255

fg = cv2.erode(fg, np.ones((3, 3), np.uint8), iterations=1)
alpha = cv2.GaussianBlur(fg, (0, 0), 1.2).astype(np.float32) / 255.0
alpha = np.clip((alpha - 0.2) / 0.6, 0, 1)

rgb = img.astype(np.float32)
core = cv2.erode(fg, np.ones((3, 3), np.uint8), iterations=4)
core3 = (core > 0)[..., None]
blur_rgb = cv2.GaussianBlur(np.where(core3, rgb, 0), (0, 0), 5)
blur_w = cv2.GaussianBlur(core.astype(np.float32) / 255.0, (0, 0), 5)[..., None]
inner = blur_rgb / np.maximum(blur_w, 1e-3)
edge = ((alpha > 0) & (alpha < 0.98))[..., None]
rgb = np.where(edge, inner * 0.8 + rgb * 0.2, rgb)
rgba = np.dstack([np.clip(rgb, 0, 255).astype(np.uint8), (alpha * 255).astype(np.uint8)])

ys_, xs_ = np.where(alpha > 0.02)
x0, x1, y0, y1 = xs_.min(), xs_.max() + 1, ys_.min(), ys_.max() + 1
print("bbox", x0, y0, x1, y1)
cv2.imwrite(os.path.join(out_dir, "nomad_full.png"), rgba[y0:y1, x0:x1])
open(os.path.join(out_dir, "nomad_bbox.txt"), "w").write(f"{x0} {y0} {x1} {y1}")

if "--debug" in sys.argv:
    bg = np.zeros((H, W, 3), np.uint8)
    bg[:] = (130, 50, 140)
    a3 = alpha[..., None]
    comp = (img * a3 + bg * (1 - a3)).astype(np.uint8)
    cv2.imwrite(os.path.join(out_dir, "debug_nomad.png"), comp)
print("ok")
