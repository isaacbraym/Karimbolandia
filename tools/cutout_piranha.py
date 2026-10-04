"""
Recorta as piranhas (fotos sobre fundo de água) em pares alinhados: boca fechada (a) e aberta (b)
usam o MESMO retângulo de corte, então trocar de quadro no jogo não faz o peixe pular.

Uso:  python tools/cutout_piranha.py <pasta_entrada> <pasta_saida> [--preview pasta]
Entrada: peixeInimigo1a.png, peixeInimigo1b.png, peixeInimigo2a.png, peixeInimigo2b.png
Saída:   piranha1a.webp, piranha1b.webp, piranha2a.webp, piranha2b.webp (lado maior = 300 px)
"""
import os
import sys
import cv2
import numpy as np

# contornos generosos nas coordenadas originais (1448x1086); o GrabCut refina a borda
SHAPES = {
    '1': dict(core=(680, 600, 380, 230), poly=[(80, 620), (90, 590), (200, 570), (250, 330), (400, 210), (600, 140), (700, 50), (780, 12), (870, 50), (970, 130), (1100, 290), (1200, 240), (1395, 210), (1415, 500), (1405, 800), (1300, 790), (1170, 710), (1150, 860), (1000, 900), (965, 1005), (880, 1015), (760, 965), (600, 905), (565, 1000), (465, 995), (445, 885), (300, 805), (200, 765), (85, 705)]),
    '2': dict(core=(640, 560, 380, 260), poly=[(80, 640), (95, 570), (230, 555), (255, 345), (400, 195), (560, 120), (700, 80), (780, 0), (870, 30), (1010, 190), (1100, 235), (1330, 222), (1340, 500), (1310, 760), (1120, 650), (1070, 810), (995, 1025), (855, 1020), (775, 940), (560, 905), (535, 1005), (425, 990), (415, 885), (300, 790), (195, 775), (95, 725)]),
}


def alpha_for(path, core, poly):
    img = cv2.imread(path, cv2.IMREAD_COLOR)
    H, W = img.shape[:2]
    s = 800 / W
    sm = cv2.resize(img, (int(W * s), int(H * s)), interpolation=cv2.INTER_AREA)
    h, w = sm.shape[:2]
    hsv = cv2.cvtColor(sm, cv2.COLOR_BGR2HSV)
    Hh, S, V = hsv[..., 0].astype(int), hsv[..., 1].astype(int), hsv[..., 2].astype(int)
    mask = np.full((h, w), cv2.GC_PR_BGD, np.uint8)
    inside = np.zeros((h, w), np.uint8)
    cv2.fillPoly(inside, [np.array([[x * s, y * s] for x, y in poly], np.int32)], 255)
    inside = inside > 0
    water = (Hh >= 80) & (Hh <= 118) & (S > 40)
    mask[inside & ~water] = cv2.GC_PR_FGD
    mask[(Hh >= 84) & (Hh <= 114) & (S > 80) & (V > 40)] = cv2.GC_BGD
    mask[~inside] = cv2.GC_BGD
    # nadadeiras vermelho-alaranjadas dentro do contorno: peixe
    fin = ((Hh <= 14) | (Hh >= 170)) & (S > 70) & (V > 60)
    mask[fin & inside] = cv2.GC_FGD
    cx, cy, rx, ry = core
    yy, xx = np.ogrid[:h, :w]
    mask[((xx - cx * s) / (rx * s)) ** 2 + ((yy - cy * s) / (ry * s)) ** 2 <= 1] = cv2.GC_FGD
    bgd = np.zeros((1, 65), np.float64)
    fgd = np.zeros((1, 65), np.float64)
    cv2.grabCut(sm, mask, None, bgd, fgd, 8, cv2.GC_INIT_WITH_MASK)
    fg = np.where((mask == cv2.GC_FGD) | (mask == cv2.GC_PR_FGD), 255, 0).astype(np.uint8)
    n, lab, stats, _ = cv2.connectedComponentsWithStats(fg)
    if n > 1:
        big = 1 + int(np.argmax(stats[1:, cv2.CC_STAT_AREA]))
        fg = np.where(lab == big, 255, 0).astype(np.uint8)
    fg = cv2.morphologyEx(fg, cv2.MORPH_CLOSE, cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (7, 7)), iterations=2)
    fg = cv2.morphologyEx(fg, cv2.MORPH_OPEN, cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (5, 5)))
    pad = cv2.copyMakeBorder(cv2.bitwise_not(fg), 1, 1, 1, 1, cv2.BORDER_CONSTANT, value=255)
    m2 = np.zeros((h + 4, w + 4), np.uint8)
    cv2.floodFill(pad, m2, (0, 0), 0)
    fg = cv2.bitwise_or(fg, pad[1:-1, 1:-1])
    full = cv2.resize(fg, (W, H), interpolation=cv2.INTER_LINEAR)
    full = cv2.GaussianBlur(full, (0, 0), 1.8)
    alpha = np.clip((full.astype(np.float32) - 60) * (255 / 140), 0, 255).astype(np.uint8)
    rgba = cv2.cvtColor(img, cv2.COLOR_BGR2BGRA)
    rgba[..., 3] = alpha
    # tira o halo azul da borda
    hsvf = cv2.cvtColor(img, cv2.COLOR_BGR2HSV)
    blue = (hsvf[..., 0] >= 80) & (hsvf[..., 0] <= 118) & (hsvf[..., 1] > 40)
    edge = (alpha > 0) & (alpha < 250) & blue
    rgba[edge, 3] = (rgba[edge, 3] * 0.3).astype(np.uint8)
    return rgba


def main():
    args = sys.argv[1:]
    prev = None
    if '--preview' in args:
        i = args.index('--preview')
        prev = args[i + 1]
        args = args[:i] + args[i + 2:]
    src, out = args
    os.makedirs(out, exist_ok=True)
    for sp, cfg in SHAPES.items():
        pair = [alpha_for(os.path.join(src, f'peixeInimigo{sp}{m}.png'), **cfg) for m in 'ab']
        ys, xs = np.where((pair[0][..., 3] > 8) | (pair[1][..., 3] > 8))
        x0, x1, y0, y1 = xs.min(), xs.max(), ys.min(), ys.max()
        for m, rgba in zip('ab', pair):
            crop = rgba[y0:y1 + 1, x0:x1 + 1]
            sc = 300 / max(crop.shape[:2])
            crop = cv2.resize(crop, (int(crop.shape[1] * sc), int(crop.shape[0] * sc)), interpolation=cv2.INTER_AREA)
            cv2.imwrite(os.path.join(out, f'piranha{sp}{m}.webp'), crop, [cv2.IMWRITE_WEBP_QUALITY, 88])
            if prev:
                os.makedirs(prev, exist_ok=True)
                bg = np.zeros_like(crop)
                bg[..., :3] = (80, 30, 160)
                a = crop[..., 3:4].astype(np.float32) / 255
                comp = (crop[..., :3] * a + bg[..., :3] * (1 - a)).astype(np.uint8)
                cv2.imwrite(os.path.join(prev, f'piranha{sp}{m}.png'), comp)
            print(f'piranha{sp}{m}', crop.shape)


if __name__ == '__main__':
    main()
