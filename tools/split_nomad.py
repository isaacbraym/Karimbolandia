"""Divide o recorte do Nômad em camadas: torre (upper), chassi (frame) e esfera (sphere).

Uso: python tools/split_nomad.py <work_dir>   (le <work_dir>/nomad_full.png e nomad_bbox.txt)

- upper : tudo acima do pescoço (y < CUT) - inclina/recua com os tiros
- frame : chassi inferior SEM a esfera
- sphere: textura circular completa da esfera (região escondida pelo chassi é preenchida
          com cópias rotacionadas da parte visível) -> gira para dar sensação de rolamento
Todas as camadas (exceto sphere) ficam no mesmo referencial do recorte (bbox 646x766).
"""
import sys
import os
import json
import cv2
import numpy as np
from PIL import Image

work = sys.argv[1]
full = cv2.imread(os.path.join(work, "nomad_full.png"), cv2.IMREAD_UNCHANGED)
x0, y0, x1, y1 = [int(v) for v in open(os.path.join(work, "nomad_bbox.txt")).read().split()]
h, w = full.shape[:2]
print("full", w, h, "origin", x0, y0)

CUT = 335 - y0            # corte torre/chassi
CX, CY, R = 540 - x0, 636 - y0, 174   # esfera no referencial do recorte

bgr = full[..., :3]
alpha = full[..., 3]
hsv = cv2.cvtColor(bgr, cv2.COLOR_BGR2HSV)
Hh, Ss, Vv = [hsv[..., i].astype(int) for i in range(3)]

yy, xx = np.mgrid[0:h, 0:w]
circ = ((xx - CX) ** 2 + (yy - CY) ** 2) < R * R
olive = (Hh >= 22) & (Hh <= 48) & (Ss > 95) & (Vv > 70) & circ
olive = cv2.morphologyEx(olive.astype(np.uint8), cv2.MORPH_OPEN, np.ones((5, 5), np.uint8))
n, lbl, stats, _ = cv2.connectedComponentsWithStats(olive)
frame_in_circle = np.zeros((h, w), np.uint8)
for i in range(1, n):
    if stats[i, cv2.CC_STAT_AREA] > 1500:
        frame_in_circle[lbl == i] = 255
frame_in_circle = cv2.dilate(frame_in_circle, np.ones((3, 3), np.uint8), iterations=2)

# bloco escuro (nariz) do chassi, sobre a esfera
nose = np.array([(405, 547), (462, 535), (490, 560), (492, 610), (460, 622), (417, 622), (405, 610)], np.int32)
nose[:, 0] -= x0
nose[:, 1] -= y0
nose_m = np.zeros((h, w), np.uint8)
cv2.fillPoly(nose_m, [nose], 255)
nose_m = cv2.dilate(nose_m, np.ones((3, 3), np.uint8), iterations=2)

frame_cover = ((frame_in_circle > 0) | (nose_m > 0)) & circ           # chassi sobre a esfera
sphere_visible = circ & ~frame_cover & (alpha > 128)

# ---- camadas
low = np.zeros((h, w), bool)
low[CUT:, :] = True
upper = full.copy()
upper[CUT:, :, 3] = 0
# suaviza corte inferior da torre
frame = full.copy()
frame[:CUT, :, 3] = 0
frame[sphere_visible & low, 3] = 0   # remove a esfera do chassi

cv2.imwrite(os.path.join(work, "nomad_upper.png"), upper)
cv2.imwrite(os.path.join(work, "nomad_frame.png"), frame)

# ---- textura completa da esfera
S = 2 * R + 2
tex = np.zeros((S, S, 4), np.uint8)
ox, oy = CX - R - 1, CY - R - 1
crop = full[max(oy, 0): oy + S, max(ox, 0): ox + S]
vis_crop = sphere_visible[max(oy, 0): oy + S, max(ox, 0): ox + S]
tex[: crop.shape[0], : crop.shape[1], :3] = crop[..., :3]
tex[: crop.shape[0], : crop.shape[1], 3] = np.where(vis_crop, 255, 0)
known = tex[..., 3] > 0

# preenche o oculto com cópias giradas da parte visível (padrão de bola) + inpaint p/ costuras
center = (S / 2, S / 2)
filled = tex.copy()
for ang in (137, 251, 83, 197, 310):
    rot = cv2.getRotationMatrix2D(center, ang, 1.0)
    rt = cv2.warpAffine(tex, rot, (S, S), flags=cv2.INTER_LINEAR, borderValue=(0, 0, 0, 0))
    m = (filled[..., 3] == 0) & (rt[..., 3] > 200)
    filled[m] = rt[m]
circ_s = ((np.mgrid[0:S, 0:S][1] - S / 2) ** 2 + (np.mgrid[0:S, 0:S][0] - S / 2) ** 2) < (R * R)
hole = ((filled[..., 3] == 0) & circ_s).astype(np.uint8) * 255
bgr_f = cv2.inpaint(filled[..., :3].copy(), hole, 5, cv2.INPAINT_TELEA)
filled[..., :3] = bgr_f
filled[..., 3] = np.where(circ_s, 255, 0).astype(np.uint8)
# borda suave
soft = cv2.GaussianBlur(filled[..., 3], (0, 0), 1.0)
filled[..., 3] = soft
cv2.imwrite(os.path.join(work, "nomad_sphere.png"), filled)

meta = {
    "size": [int(w), int(h)],
    "cut": int(CUT),
    "sphere": {"cx": int(CX), "cy": int(CY), "r": int(R), "tex": int(S)},
    # pontos de interesse no referencial do recorte (robô olhando p/ a direita)
    "muzzleA": [int(838 - x0), int(190 - y0)],
    "muzzleB": [int(392 - x0 + 120), int(186 - y0)],
    "cockpit": [int(492 - x0), int(120 - y0)],
    "turretPivot": [int(540 - x0), int(320 - y0)],
}
json.dump(meta, open(os.path.join(work, "nomad_meta.json"), "w"), indent=1)
print(meta)
print("ok")
