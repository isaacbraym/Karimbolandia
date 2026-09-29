"""Recorte do Felipão (foto canônica) -> corpo inteiro RGBA + cabeça separada.

Uso: python tools/cutout_felipao.py <saida_dir> [--debug]
A foto NÃO é redesenhada; apenas isolamos a pessoa do cenário (sala, piso, TV, porta).
"""
import sys
import os
import cv2
import numpy as np

SRC = os.path.join(os.path.dirname(__file__), "..", "Boss_Felipe.png")
out_dir = sys.argv[1] if len(sys.argv) > 1 else "."
os.makedirs(out_dir, exist_ok=True)

img = cv2.imread(SRC, cv2.IMREAD_COLOR)
H, W = img.shape[:2]
print("src", W, H)

mask = np.full((H, W), cv2.GC_PR_BGD, np.uint8)
# --- fundo certo
mask[:, :60] = cv2.GC_BGD          # TV / móvel
mask[170:, :70] = cv2.GC_BGD
mask[:, 1010:] = cv2.GC_BGD        # porta
mask[:12, :420] = cv2.GC_BGD
mask[:12, 760:] = cv2.GC_BGD
mask[:150, :380] = cv2.GC_BGD      # parede acima-esquerda
mask[:150, 800:] = cv2.GC_BGD
mask[1340:, :] = cv2.GC_BGD
# piso: faixa horizontal entre pernas fica PR_BGD (padrão)

# --- corpo provável
body = np.zeros((H, W), np.uint8)
poly = np.array(
    [
        [470, 30], [700, 30], [730, 150], [900, 190], [990, 330], [1000, 620],
        [960, 780], [980, 950], [950, 1130], [930, 1260], [830, 1320],
        [220, 1320], [160, 1240], [200, 1000], [120, 760], [120, 560],
        [180, 380], [330, 250], [440, 170],
    ],
    np.int32,
)
cv2.fillPoly(body, [poly], 255)
mask[(body > 0) & (mask == cv2.GC_PR_BGD)] = cv2.GC_PR_FGD

# --- foreground certo (miolo)
cv2.ellipse(mask, (560, 620), (330, 330), 0, 0, 360, cv2.GC_FGD, -1)   # tronco
cv2.ellipse(mask, (560, 940), (300, 110), 0, 0, 360, cv2.GC_FGD, -1)   # shorts
cv2.ellipse(mask, (560, 130), (60, 80), 0, 0, 360, cv2.GC_FGD, -1)     # rosto/cabelo (ajuste abaixo)
cv2.ellipse(mask, (380, 1110), (110, 90), 0, 0, 360, cv2.GC_FGD, -1)  # coxa esq
cv2.ellipse(mask, (800, 1110), (100, 90), 0, 0, 360, cv2.GC_FGD, -1)  # coxa dir
cv2.ellipse(mask, (560, 240), (150, 60), 0, 0, 360, cv2.GC_FGD, -1)    # queixo/papada

# piso: pouco saturado (pele das pernas tem chroma > 13), fora do preto das roupas
lab = cv2.cvtColor(img, cv2.COLOR_BGR2LAB).astype(np.float32)
chroma = np.sqrt((lab[..., 1] - 128) ** 2 + (lab[..., 2] - 128) ** 2)
yy = np.arange(H)[:, None]
floor = (yy > 900) & (chroma < 8.5) & (lab[..., 0] > 62)
floor = cv2.morphologyEx(floor.astype(np.uint8), cv2.MORPH_OPEN, np.ones((5, 5), np.uint8)) > 0
mask[floor] = cv2.GC_BGD

scale = 0.5
small = cv2.resize(img, None, fx=scale, fy=scale, interpolation=cv2.INTER_AREA)
msmall = cv2.resize(mask, None, fx=scale, fy=scale, interpolation=cv2.INTER_NEAREST)
bgd = np.zeros((1, 65), np.float64)
fgd = np.zeros((1, 65), np.float64)
cv2.grabCut(small, msmall, None, bgd, fgd, 10, cv2.GC_INIT_WITH_MASK)
fg_small = ((msmall == cv2.GC_FGD) | (msmall == cv2.GC_PR_FGD)).astype(np.uint8) * 255
fg = cv2.resize(fg_small, (W, H), interpolation=cv2.INTER_LINEAR)
fg = cv2.threshold(fg, 127, 255, cv2.THRESH_BINARY)[1]

fg = cv2.morphologyEx(fg, cv2.MORPH_OPEN, cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (9, 9)))
fg = cv2.morphologyEx(fg, cv2.MORPH_CLOSE, cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (21, 21)))
n, lbl, stats, _ = cv2.connectedComponentsWithStats(fg)
if n > 1:
    big = 1 + np.argmax(stats[1:, cv2.CC_STAT_AREA])
    fg = ((lbl == big) * 255).astype(np.uint8)
inv = cv2.bitwise_not(fg)
n, lbl, stats, _ = cv2.connectedComponentsWithStats(inv)
for i in range(1, n):
    x, y, w, h, a = stats[i]
    if x > 0 and y > 0 and x + w < W and y + h < H and a < 40000:
        fg[lbl == i] = 255

fg = cv2.erode(fg, np.ones((3, 3), np.uint8), iterations=1)
alpha = cv2.GaussianBlur(fg, (0, 0), 1.8).astype(np.float32) / 255.0
alpha = np.clip((alpha - 0.2) / 0.6, 0, 1)

rgb = img.astype(np.float32)
core = cv2.erode(fg, np.ones((3, 3), np.uint8), iterations=5)
core3 = (core > 0)[..., None]
blur_rgb = cv2.GaussianBlur(np.where(core3, rgb, 0), (0, 0), 7)
blur_w = cv2.GaussianBlur(core.astype(np.float32) / 255.0, (0, 0), 7)[..., None]
inner = blur_rgb / np.maximum(blur_w, 1e-3)
edge = ((alpha > 0) & (alpha < 0.98))[..., None]
rgb = np.where(edge, inner * 0.7 + rgb * 0.3, rgb)
rgba = np.dstack([np.clip(rgb, 0, 255).astype(np.uint8), (alpha * 255).astype(np.uint8)])

ys_, xs_ = np.where(alpha > 0.02)
x0, x1, y0, y1 = xs_.min(), xs_.max() + 1, ys_.min(), ys_.max() + 1
print("bbox", x0, y0, x1, y1)
cv2.imwrite(os.path.join(out_dir, "felipao_full.png"), rgba[y0:y1, x0:x1])

if "--debug" in sys.argv:
    bg = np.zeros((H, W, 3), np.uint8)
    bg[:] = (120, 60, 30)
    a3 = alpha[..., None]
    comp = (img * a3 + bg * (1 - a3)).astype(np.uint8)
    cv2.imwrite(os.path.join(out_dir, "debug_felipao.png"), cv2.resize(comp, None, fx=0.5, fy=0.5))
print("ok")
