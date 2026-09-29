"""Divide o recorte do Felipão em camadas articuláveis: tronco (upper) + perna esquerda + perna direita.

Uso: python tools/split_felipao.py <work_dir>   (le <work_dir>/felipao_full.png)
As pernas incluem uma faixa que fica escondida atrás do short (sobreposição), então giram
em torno do quadril sem abrir buracos. Coordenadas medidas no recorte exportado (560x885).
"""
import sys, os
import cv2
import numpy as np

work = sys.argv[1]
full = cv2.imread(os.path.join(work, "felipao_full.png"), cv2.IMREAD_UNCHANGED)
H, W = full.shape[:2]
sx = W / 560.0
sy = H / 885.0
print("full", W, H)

# linha da barra do short (x, y) no espaço 560x885
HEM = [(0, 630), (60, 640), (95, 662), (150, 676), (285, 692), (300, 694), (340, 708), (430, 714), (500, 692), (550, 674), (560, 660)]
xs = np.arange(W, dtype=np.float32)
hx = np.array([p[0] * sx for p in HEM], np.float32)
hy = np.array([p[1] * sy for p in HEM], np.float32)
hem = np.interp(xs, hx, hy)[None, :]
yy = np.arange(H, dtype=np.float32)[:, None]

below = np.clip((yy - hem) / 3.0, 0, 1)      # 1 abaixo da barra do short
above = 1 - below

MID = 300 * sx
left_sel = (xs[None, :] < MID).astype(np.float32)
right_sel = 1 - left_sel

def layer(mask):
    out = full.copy()
    out[..., 3] = (full[..., 3].astype(np.float32) * mask).astype(np.uint8)
    return out

upper = layer(above)
# pernas: incluem 70px (no espaço 560x885) acima da barra, atrás do short
overlap = np.clip((yy - (hem - 70 * sy)) / 3.0, 0, 1)
legL = layer(overlap * left_sel)
legR = layer(overlap * right_sel)

cv2.imwrite(os.path.join(work, "felipao_upper.png"), upper)
cv2.imwrite(os.path.join(work, "felipao_legL.png"), legL)
cv2.imwrite(os.path.join(work, "felipao_legR.png"), legR)

# pré-visualização: pernas atrás, tronco na frente, com pernas giradas
prev = np.zeros((H, W, 4), np.uint8)
def over(dst, src, dx=0, dy=0):
    a = src[..., 3:4].astype(np.float32) / 255
    dst[..., :3] = (src[..., :3] * a + dst[..., :3] * (1 - a)).astype(np.uint8)
    dst[..., 3] = np.maximum(dst[..., 3], src[..., 3])
def rot(img, cx, cy, ang):
    M = cv2.getRotationMatrix2D((cx, cy), ang, 1.0)
    return cv2.warpAffine(img, M, (W, H), flags=cv2.INTER_LINEAR, borderValue=(0, 0, 0, 0))
over(prev, rot(legL, 190 * sx, 640 * sy, 18))
over(prev, rot(legR, 430 * sx, 650 * sy, -18))
over(prev, upper)
bg = np.zeros((H, W, 3), np.uint8); bg[:] = (120, 60, 30)
a = prev[..., 3:4].astype(np.float32) / 255
comp = (prev[..., :3] * a + bg * (1 - a)).astype(np.uint8)
cv2.imwrite(os.path.join(work, "debug_felipao_split.png"), cv2.resize(comp, None, fx=0.5, fy=0.5))
print("ok")
