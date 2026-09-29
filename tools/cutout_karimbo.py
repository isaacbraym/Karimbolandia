"""Recorte da cabeça do Karimbo (foto canônica) -> PNG RGBA + orelhas separadas.

Uso: python tools/cutout_karimbo.py <saida_dir> [--debug]

A foto NÃO é redesenhada: apenas isolamos a cabeça (cabelo, rosto, orelhas, pescoço)
do fundo (parede branca) com GrabCut + refinamento de borda.
"""
import sys
import os
import cv2
import numpy as np

SRC = os.path.join(os.path.dirname(__file__), "..", "Karimboprotagonista.png")
out_dir = sys.argv[1] if len(sys.argv) > 1 else "."
os.makedirs(out_dir, exist_ok=True)

img = cv2.imread(SRC, cv2.IMREAD_COLOR)
H, W = img.shape[:2]
print("src", W, H)

lab = cv2.cvtColor(img, cv2.COLOR_BGR2LAB).astype(np.float32)
L, A, B = lab[..., 0], lab[..., 1] - 128, lab[..., 2] - 128
chroma = np.sqrt(A * A + B * B)

# --- prior de parede: clara e pouco saturada
wall = ((L > 203) & (chroma < 8)) | ((L > 150) & (chroma < 5.5))
edge_cols = np.zeros((H, W), bool)
edge_cols[:, :14] = True
edge_cols[:, W - 14:] = True
wall |= edge_cols & (chroma < 11) & (L > 110)

# região onde a cabeça pode existir (exclui ombros/camisa)
allow = np.zeros((H, W), np.uint8)
poly = np.array(
    [
        [0, 0], [W, 0], [W, 1040],
        [830, 1070], [790, 1110], [770, 1180], [730, 1290],
        [230, 1290], [200, 1180], [180, 1110], [140, 1070], [0, 1040],
    ],
    np.int32,
)
cv2.fillPoly(allow, [poly], 255)

fg = ((~wall) & (allow > 0)).astype(np.uint8) * 255
fg[:6, :] = 0
# abaixo da mandibula so pele (a > 11); tira colarinho bege da camisa
yy = np.arange(H)[:, None]
fg[(yy > 1030) & (A < 11)] = 0

# limpeza morfológica + maior componente
orig_fg = fg.copy()
k = cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (13, 13))
fg = cv2.morphologyEx(fg, cv2.MORPH_OPEN, k)
fg = cv2.bitwise_and(cv2.dilate(fg, np.ones((3, 3), np.uint8), iterations=2), orig_fg)
fg = cv2.morphologyEx(fg, cv2.MORPH_CLOSE, np.ones((15, 15), np.uint8))
fg[wall] = 0  # o closing pode ter religado tiras de parede
n, lbl, stats, _ = cv2.connectedComponentsWithStats(fg)
if n > 1:
    big = 1 + np.argmax(stats[1:, cv2.CC_STAT_AREA])
    fg = ((lbl == big) * 255).astype(np.uint8)
# preenche buracos
inv = cv2.bitwise_not(fg)
n, lbl, stats, _ = cv2.connectedComponentsWithStats(inv)
for i in range(1, n):
    x, y, w, h, a = stats[i]
    if x > 0 and y > 0 and x + w < W and y + h < H:
        fg[lbl == i] = 255

# borda suave: erode 2px (tira halo da parede) + blur
fg = cv2.erode(fg, np.ones((3, 3), np.uint8), iterations=2)
alpha = cv2.GaussianBlur(fg, (0, 0), 1.6).astype(np.float32) / 255.0
alpha = np.clip((alpha - 0.15) / 0.7, 0, 1)

# pescoço: esmaece no fundo (y>1180 -> 0 em 1290)
ys = np.arange(H, dtype=np.float32)[:, None]
fade = np.clip((1290 - ys) / 110.0, 0, 1)
alpha *= fade

# descontaminação de borda: mistura cor do pixel interior vizinho
rgb = img.astype(np.float32)
core = cv2.erode(fg, np.ones((3, 3), np.uint8), iterations=4)
core3 = (core > 0)[..., None]
blur_rgb = cv2.GaussianBlur(np.where(core3, rgb, 0), (0, 0), 6)
blur_w = cv2.GaussianBlur(core.astype(np.float32) / 255.0, (0, 0), 6)[..., None]
inner = blur_rgb / np.maximum(blur_w, 1e-3)
edge = ((alpha > 0) & (alpha < 0.98))[..., None]
rgb = np.where(edge, inner * 0.65 + rgb * 0.35, rgb)

rgba = np.dstack([np.clip(rgb, 0, 255).astype(np.uint8), (alpha * 255).astype(np.uint8)])

# corta ao bbox
ys_, xs_ = np.where(alpha > 0.02)
x0, x1, y0, y1 = xs_.min(), xs_.max() + 1, ys_.min(), ys_.max() + 1
print("bbox", x0, y0, x1, y1)
head = rgba[y0:y1, x0:x1]
cv2.imwrite(os.path.join(out_dir, "karimbo_head_full.png"), head)

# --- orelhas: caixa em torno de cada orelha, com fade no lado do rosto
ear_pos = {}

# contorno rosto/orelha (y, x) medido na foto: orelha = lado de fora da linha
EAR_L_EDGE = [(560, 100), (575, 110), (600, 125), (640, 138), (720, 136), (760, 135), (820, 140), (870, 155), (920, 168), (965, 178), (990, 180)]
EAR_R_EDGE = [(560, 850), (590, 840), (680, 838), (760, 845), (840, 842), (900, 830), (965, 828), (990, 828)]


def ear(x_a, x_b, y_a, y_b, side):
    box = rgba[y_a:y_b, x_a:x_b].copy()
    h, w = box.shape[:2]
    ys = np.arange(y_a, y_b, dtype=np.float32)
    edge_tbl = EAR_L_EDGE if side == "l" else EAR_R_EDGE
    ey = np.array([p[0] for p in edge_tbl], np.float32)
    ex = np.array([p[1] for p in edge_tbl], np.float32)
    edge = np.interp(ys, ey, ex)[:, None]
    xs = np.arange(x_a, x_b, dtype=np.float32)[None, :]
    feather = 3.5
    if side == "l":
        f = np.clip((edge - xs) / feather, 0, 1)
    else:
        f = np.clip((xs - edge) / feather, 0, 1)
    box[..., 3] = (box[..., 3].astype(np.float32) * f).astype(np.uint8)
    ys2, xs2 = np.where(box[..., 3] > 4)
    box = box[ys2.min():ys2.max() + 1, xs2.min():xs2.max() + 1]
    ear_pos[side] = (int(x_a + xs2.min() - x0), int(y_a + ys2.min() - y0))
    return box


cv2.imwrite(os.path.join(out_dir, "karimbo_ear_l.png"), ear(0, 180, 560, 990, "l"))
cv2.imwrite(os.path.join(out_dir, "karimbo_ear_r.png"), ear(815, 960, 560, 990, "r"))
import json
json.dump(ear_pos, open(os.path.join(out_dir, "ears.json"), "w"))

if "--debug" in sys.argv:
    bg = np.zeros((H, W, 3), np.uint8)
    bg[:] = (80, 40, 120)
    a3 = alpha[..., None]
    comp = (img * a3 + bg * (1 - a3)).astype(np.uint8)
    cv2.imwrite(os.path.join(out_dir, "debug_comp.png"), cv2.resize(comp, None, fx=0.5, fy=0.5))
print("ok")
