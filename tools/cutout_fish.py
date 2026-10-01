"""
Recorta os peixes (fotos sobre fundo de água) para PNG/WebP com transparência.

Uso:  python tools/cutout_fish.py <entrada.png> <saida.webp> [--preview prev.png]

Estratégia: GrabCut inicializado por cor — água azul/ciano saturada é fundo certo; um núcleo
elíptico no centro do corpo é frente certa; o resto é "provável". Depois mantém o maior
componente, fecha buracos, suaviza a borda (anti-serrilhado) e corta no retângulo do peixe.
"""
import sys
import cv2
import numpy as np


def cutout(path, out, preview=None, core=(0.42, 0.52, 0.22, 0.22), poly=None, polyW=1.0):
    img = cv2.imread(path, cv2.IMREAD_COLOR)
    H, W = img.shape[:2]
    s = 760 / W
    sm = cv2.resize(img, (int(W * s), int(H * s)), interpolation=cv2.INTER_AREA)
    h, w = sm.shape[:2]
    hsv = cv2.cvtColor(sm, cv2.COLOR_BGR2HSV)
    Hh, S, V = hsv[..., 0].astype(int), hsv[..., 1].astype(int), hsv[..., 2].astype(int)

    mask = np.full((h, w), cv2.GC_PR_BGD, np.uint8)
    # tudo que não é claramente água vira "provável peixe"
    water = (Hh >= 80) & (Hh <= 118) & (S > 45)
    mask[~water] = cv2.GC_PR_FGD
    # água forte = fundo certo
    mask[(Hh >= 84) & (Hh <= 114) & (S > 90) & (V > 50)] = cv2.GC_BGD
    # algas verdes saturadas = fundo
    mask[(Hh >= 35) & (Hh < 80) & (S > 110)] = cv2.GC_BGD
    # contorno aproximado do peixe (inclui nadadeiras): fora dele é fundo certo
    if poly is not None:
        pts = np.array([[x * w / polyW, y * w / polyW] for x, y in poly], np.int32)
        inside = np.zeros((h, w), np.uint8)
        cv2.fillPoly(inside, [pts], 255)
        inside = cv2.dilate(inside, cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (9, 9))) > 0
        mask[~inside] = cv2.GC_BGD
        # nadadeiras (laranja/dourado translúcido): dentro do contorno são peixe
        fin = (Hh >= 6) & (Hh <= 34) & (S > 35) & (V > 70)
        mask[fin & inside & (mask != cv2.GC_BGD)] = cv2.GC_FGD
    # bordas da imagem = fundo
    b = 4
    mask[:b, :] = cv2.GC_BGD
    mask[-b:, :] = cv2.GC_BGD
    mask[:, :b] = cv2.GC_BGD
    mask[:, -b:] = cv2.GC_BGD
    # núcleo do corpo = frente certa
    cx, cy, rx, ry = core
    yy, xx = np.ogrid[:h, :w]
    ell = ((xx - cx * w) / (rx * w)) ** 2 + ((yy - cy * h) / (ry * h)) ** 2 <= 1
    mask[ell] = cv2.GC_FGD

    bgd = np.zeros((1, 65), np.float64)
    fgd = np.zeros((1, 65), np.float64)
    cv2.grabCut(sm, mask, None, bgd, fgd, 8, cv2.GC_INIT_WITH_MASK)
    fg = np.where((mask == cv2.GC_FGD) | (mask == cv2.GC_PR_FGD), 255, 0).astype(np.uint8)

    # maior componente + fecha buracos (olhos/escamas escuras) + abre (tira bolhas soltas)
    n, lab, stats, _ = cv2.connectedComponentsWithStats(fg)
    if n > 1:
        big = 1 + int(np.argmax(stats[1:, cv2.CC_STAT_AREA]))
        fg = np.where(lab == big, 255, 0).astype(np.uint8)
    k = cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (7, 7))
    fg = cv2.morphologyEx(fg, cv2.MORPH_CLOSE, k, iterations=2)
    fg = cv2.morphologyEx(fg, cv2.MORPH_OPEN, cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (5, 5)))
    # preenche buracos internos
    # (moldura de fundo em volta: o peixe pode encostar na borda e dividir o fundo em pedaços)
    pad = cv2.copyMakeBorder(cv2.bitwise_not(fg), 1, 1, 1, 1, cv2.BORDER_CONSTANT, value=255)
    m2 = np.zeros((h + 4, w + 4), np.uint8)
    cv2.floodFill(pad, m2, (0, 0), 0)
    fg = cv2.bitwise_or(fg, pad[1:-1, 1:-1])

    # volta para a resolução cheia com borda suave
    full = cv2.resize(fg, (W, H), interpolation=cv2.INTER_LINEAR)
    full = cv2.GaussianBlur(full, (0, 0), 1.6)
    alpha = np.clip((full.astype(np.float32) - 60) * (255 / 140), 0, 255).astype(np.uint8)
    # tira o halo azul da borda (puxa a cor da borda para o tom do peixe)
    rgba = cv2.cvtColor(img, cv2.COLOR_BGR2BGRA)
    edge = (alpha > 0) & (alpha < 250)
    hsvf = cv2.cvtColor(img, cv2.COLOR_BGR2HSV)
    blue = (hsvf[..., 0] >= 80) & (hsvf[..., 0] <= 118) & (hsvf[..., 1] > 40)
    rgba[..., 3] = alpha
    kill = edge & blue
    rgba[kill, 3] = (rgba[kill, 3] * 0.35).astype(np.uint8)

    ys, xs = np.where(alpha > 8)
    x0, x1, y0, y1 = xs.min(), xs.max(), ys.min(), ys.max()
    crop = rgba[y0:y1 + 1, x0:x1 + 1]
    # tamanho final moderado (o jogo desenha bem menor)
    target = 520
    sc = target / max(crop.shape[:2])
    if sc < 1:
        crop = cv2.resize(crop, (int(crop.shape[1] * sc), int(crop.shape[0] * sc)), interpolation=cv2.INTER_AREA)
    cv2.imwrite(out, crop, [cv2.IMWRITE_WEBP_QUALITY, 90])
    if preview:
        bgc = np.zeros_like(crop)
        bgc[..., :3] = (60, 30, 200)
        bgc[..., 3] = 255
        a = crop[..., 3:4].astype(np.float32) / 255
        comp = (crop[..., :3] * a + bgc[..., :3] * (1 - a)).astype(np.uint8)
        cv2.imwrite(preview, comp)
    print(out, crop.shape)


# contornos generosos (coordenadas das prévias redimensionadas) — o GrabCut refina a borda
SHAPES = {
    'a': dict(polyW=685, core=(0.40, 0.55, 0.20, 0.22), poly=[(0,318),(40,300),(105,290),(118,232),(160,150),(230,92),(290,62),(300,40),(318,2),(345,2),(380,40),(420,100),(470,128),(520,140),(560,110),(640,80),(668,85),(672,200),(675,372),(650,380),(620,350),(648,350),(650,395),(590,430),(520,440),(535,525),(500,530),(440,480),(380,495),(300,508),(200,495),(130,450),(110,410),(60,415),(2,345)]),
    'b': dict(polyW=724, core=(0.36, 0.52, 0.18, 0.2), poly=[(38,330),(45,295),(110,288),(110,220),(150,140),(240,70),(320,40),(340,12),(385,8),(470,60),(530,130),(545,200),(575,215),(640,120),(700,100),(706,200),(698,330),(690,395),(640,385),(585,330),(555,330),(540,365),(545,420),(470,440),(470,500),(420,495),(360,450),(300,455),(275,445),(270,485),(240,480),(210,430),(150,400),(120,375),(80,375)]),
}

if __name__ == '__main__':
    args = sys.argv[1:]
    prev = None
    if '--preview' in args:
        i = args.index('--preview')
        prev = args[i + 1]
        args = args[:i] + args[i + 2:]
    which = args[2] if len(args) > 2 else ''
    cfg = SHAPES.get(which, {})
    cutout(args[0], args[1], prev, **cfg)
