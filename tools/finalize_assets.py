"""Reduz e exporta as camadas dos personagens para public/assets/img (WebP com alpha).

Uso: python tools/finalize_assets.py <work_dir>
Pipeline completo (requer python + opencv-python-headless + numpy + pillow):
    python tools/cutout_karimbo.py  <work>
    python tools/cutout_felipao.py  <work>
    python tools/cutout_nomad.py    <work>
    python tools/split_nomad.py     <work>
    python tools/finalize_assets.py <work>
Os PNG/WebP resultantes são versionados; o jogo NÃO precisa do Python para rodar.
"""
import sys
import os
import json
import cv2

work = sys.argv[1]
out = os.path.join(os.path.dirname(__file__), "..", "public", "assets", "img")
os.makedirs(out, exist_ok=True)


def save(name, path, width=None, scale=None, q=90):
    im = cv2.imread(os.path.join(work, path), cv2.IMREAD_UNCHANGED)
    h, w = im.shape[:2]
    if width:
        scale = width / w
    if scale and scale != 1:
        im = cv2.resize(im, (round(w * scale), round(h * scale)), interpolation=cv2.INTER_AREA)
    # cv2 escreve WebP com alpha (BGRA)
    ok = cv2.imwrite(os.path.join(out, name), im, [cv2.IMWRITE_WEBP_QUALITY, q])
    size = os.path.getsize(os.path.join(out, name)) // 1024
    print(f"{name:26s} {im.shape[1]}x{im.shape[0]}  {size} KB  ok={ok}")
    return scale


save("karimbo_head.webp", "karimbo_head_full.png", width=512, q=92)
save("karimbo_head_noears.webp", "karimbo_head_noears.png", width=512, q=92)
save("karimbo_ear_l.webp", "karimbo_ear_l.png", scale=0.9, q=92)
save("karimbo_ear_r.webp", "karimbo_ear_r.png", scale=0.9, q=92)
save("felipao.webp", "felipao_full.png", width=560, q=90)
save("felipao_upper.webp", "felipao_upper.png", width=560, q=90)
save("felipao_legL.webp", "felipao_legL.png", width=560, q=90)
save("felipao_legR.webp", "felipao_legR.png", width=560, q=90)
s = save("nomad_upper.webp", "nomad_upper.png", scale=0.6, q=90)
save("nomad_frame.webp", "nomad_frame.png", scale=0.6, q=90)
save("nomad_sphere.webp", "nomad_sphere.png", scale=0.6, q=90)

meta = json.load(open(os.path.join(work, "nomad_meta.json")))
meta["scale"] = 0.6
json.dump(meta, open(os.path.join(out, "nomad_meta.json"), "w"), indent=1)

# metadados do recorte da cabeça/orelhas para o jogo
hd = cv2.imread(os.path.join(work, "karimbo_head_full.png"), cv2.IMREAD_UNCHANGED)
el = cv2.imread(os.path.join(work, "karimbo_ear_l.png"), cv2.IMREAD_UNCHANGED)
er = cv2.imread(os.path.join(work, "karimbo_ear_r.png"), cv2.IMREAD_UNCHANGED)
fe = cv2.imread(os.path.join(work, "felipao_full.png"), cv2.IMREAD_UNCHANGED)
ears = json.load(open(os.path.join(work, "ears.json")))
json.dump(
    {
        "head": {"w": hd.shape[1], "h": hd.shape[0]},
        "earL": {"w": el.shape[1], "h": el.shape[0], "x": ears["l"][0], "y": ears["l"][1]},
        "earR": {"w": er.shape[1], "h": er.shape[0], "x": ears["r"][0], "y": ears["r"][1]},
        "felipao": {"w": fe.shape[1], "h": fe.shape[0]},
    },
    open(os.path.join(out, "characters_meta.json"), "w"),
    indent=1,
)
print("ok")
