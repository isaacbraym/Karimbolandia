"""
Recorta a cabeça do Sivirino (mercador) da foto: cabelo, rosto, orelhas e pescoço até a gola.

Uso:  python tools/cutout_sivirino.py <Sivirino.jpeg> <saida.webp> [--preview prev.png]
O rosto é a foto — nunca redesenhado; o jogo só aplica contorno e o encaixa no corpo cartoon.
"""
import sys
import cv2
import numpy as np

# contorno generoso da cabeça na foto original (1333x1180)
POLY = [(436, 330), (468, 228), (560, 160), (700, 144), (835, 172), (935, 250), (980, 380), (985, 520), (955, 625),
        (915, 760), (880, 845), (835, 905), (600, 912), (528, 862), (478, 760), (444, 625), (428, 480)]
CORE = (700, 560, 205, 265)


def main():
    args = sys.argv[1:]
    prev = None
    if '--preview' in args:
        i = args.index('--preview')
        prev = args[i + 1]
        args = args[:i] + args[i + 2:]
    src, out = args
    img = cv2.imread(src, cv2.IMREAD_COLOR)
    H, W = img.shape[:2]
    s = 760 / W
    sm = cv2.resize(img, (int(W * s), int(H * s)), interpolation=cv2.INTER_AREA)
    h, w = sm.shape[:2]
    hsv = cv2.cvtColor(sm, cv2.COLOR_BGR2HSV)
    Hh, S = hsv[..., 0].astype(int), hsv[..., 1].astype(int)
    mask = np.full((h, w), cv2.GC_BGD, np.uint8)
    inside = np.zeros((h, w), np.uint8)
    cv2.fillPoly(inside, [np.array([[x * s, y * s] for x, y in POLY], np.int32)], 255)
    inside = inside > 0
    mask[inside] = cv2.GC_PR_FGD
    sky = (Hh >= 95) & (Hh <= 125) & (S > 35)
    mask[inside & sky] = cv2.GC_PR_BGD
    cx, cy, rx, ry = CORE
    yy, xx = np.ogrid[:h, :w]
    mask[((xx - cx * s) / (rx * s)) ** 2 + ((yy - cy * s) / (ry * s)) ** 2 <= 1] = cv2.GC_FGD
    bgd = np.zeros((1, 65), np.float64)
    fgd = np.zeros((1, 65), np.float64)
    cv2.grabCut(sm, mask, None, bgd, fgd, 10, cv2.GC_INIT_WITH_MASK)
    fg = np.where((mask == cv2.GC_FGD) | (mask == cv2.GC_PR_FGD), 255, 0).astype(np.uint8)
    n, lab, stats, _ = cv2.connectedComponentsWithStats(fg)
    if n > 1:
        big = 1 + int(np.argmax(stats[1:, cv2.CC_STAT_AREA]))
        fg = np.where(lab == big, 255, 0).astype(np.uint8)
    fg = cv2.morphologyEx(fg, cv2.MORPH_CLOSE, cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (9, 9)), iterations=2)
    pad = cv2.copyMakeBorder(cv2.bitwise_not(fg), 1, 1, 1, 1, cv2.BORDER_CONSTANT, value=255)
    m2 = np.zeros((h + 4, w + 4), np.uint8)
    cv2.floodFill(pad, m2, (0, 0), 0)
    fg = cv2.bitwise_or(fg, pad[1:-1, 1:-1])
    full = cv2.resize(fg, (W, H), interpolation=cv2.INTER_LINEAR)
    full = cv2.GaussianBlur(full, (0, 0), 2.2)
    alpha = np.clip((full.astype(np.float32) - 70) * (255 / 130), 0, 255).astype(np.uint8)
    # pescoço some suavemente embaixo (encaixa na gola do corpo desenhado)
    ys = np.arange(H)[:, None]
    fade = np.clip((905 - ys) / 70, 0, 1)
    alpha = (alpha * fade).astype(np.uint8)
    rgba = cv2.cvtColor(img, cv2.COLOR_BGR2BGRA)
    rgba[..., 3] = alpha
    yv, xv = np.where(alpha > 8)
    crop = rgba[yv.min():yv.max() + 1, xv.min():xv.max() + 1]
    sc = 260 / max(crop.shape[:2])
    crop = cv2.resize(crop, (int(crop.shape[1] * sc), int(crop.shape[0] * sc)), interpolation=cv2.INTER_AREA)
    cv2.imwrite(out, crop, [cv2.IMWRITE_WEBP_QUALITY, 90])
    if prev:
        bg = np.zeros_like(crop)
        bg[..., :3] = (80, 30, 160)
        a = crop[..., 3:4].astype(np.float32) / 255
        cv2.imwrite(prev, (crop[..., :3] * a + bg[..., :3] * (1 - a)).astype(np.uint8))
    print(out, crop.shape)


if __name__ == '__main__':
    main()
