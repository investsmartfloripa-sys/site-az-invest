#!/usr/bin/env python3
"""compose-capa.py — crava a manchete padrão do "Café com Mercado" sobre a base.

POR QUE ESTE ARQUIVO EXISTE (incidente 2026-07-10):
O visual padronizado das capas depende da fonte **DejaVu Sans Condensed Bold**
(pacote `fonts-dejavu-extra`) + do layout kicker-branco-com-barra-azul. No PC do
autor essa fonte existe; no sandbox de NUVEM só vem o `fonts-dejavu-core`
(DejaVuSans-Bold, LARGA). Quando a rotina caía no fallback para a fonte larga,
a capa "perdia o padrão" (letras largas, sem cara de thumbnail de notícia).

FIX: garantir a fonte condensada antes de compor. Rode uma vez por sessão:
    apt-get install -y --no-install-recommends fonts-dejavu-extra
Desde o incidente 2026-07-15 (capa publicada no fallback largo mesmo com o hook
de SessionStart na main), este script é FAIL-HARD: se a condensada faltar, ele
tenta instalá-la sozinho (apt-get update + install) e, se ainda faltar, SAI COM
ERRO em vez de compor fora do padrão. O fallback largo só sai com a flag
explícita --allow-fallback (decisão do autor, nunca da rotina).

USO:
    python3 agent/compose-capa.py \
        --base /tmp/base.png --out /tmp/capa.jpg \
        --dia "SEXTA" --data "10/07" \
        --head "INFLAÇÃO CEDE, JURO RECUA" \
        --sub  "IPCA a 0,16% reacende a aposta de corte da Selic; dólar cai a R$5,12"
"""
import argparse
import os
import shutil
import subprocess
import sys
from PIL import Image, ImageDraw, ImageFont

W, H = 1600, 840
BLUE = (46, 123, 240)
MARGIN = 92
BRAND = "investimentosdeaz.com.br"

# Caminhos da condensada: nuvem (Linux) primeiro; Windows para testes no PC.
FCOND_CANDIDATES = [
    "/usr/share/fonts/truetype/dejavu/DejaVuSansCondensed-Bold.ttf",
    r"C:\Windows\Fonts\DejaVuSansCondensed-Bold.ttf",
    os.path.expanduser(r"~\AppData\Local\Microsoft\Windows\Fonts\DejaVuSansCondensed-Bold.ttf"),
]
FALLBACK = "/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf"


def find_condensed():
    for p in FCOND_CANDIDATES:
        if os.path.exists(p):
            return p
    return None


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--base", required=True)
    ap.add_argument("--out", required=True)
    ap.add_argument("--dia", required=True, help="dia da semana em CAIXA ALTA, ex.: SEXTA")
    ap.add_argument("--data", required=True, help="DD/MM, ex.: 10/07")
    ap.add_argument("--head", required=True, help="manchete curta em CAIXA ALTA")
    ap.add_argument("--sub", required=True, help="subtítulo de 1 linha")
    ap.add_argument("--allow-fallback", action="store_true",
                    help="permite compor com a DejaVuSans-Bold LARGA (fora do padrão); "
                         "só com aprovação explícita do autor")
    a = ap.parse_args()

    font_path = find_condensed()
    if font_path is None and shutil.which("apt-get"):
        # Sandbox de nuvem novo pode vir sem a fonte E sem listas do apt —
        # o update antes do install é o que faz a instalação funcionar.
        print("fonte condensada ausente — tentando instalar fonts-dejavu-extra...",
              file=sys.stderr)
        for cmd in (["apt-get", "update", "-qq"],
                    ["apt-get", "install", "-y", "--no-install-recommends",
                     "fonts-dejavu-extra"]):
            try:
                subprocess.run(cmd, capture_output=True, timeout=300)
            except Exception:
                break
        font_path = find_condensed()

    if font_path is None:
        if not a.allow_fallback:
            sys.exit(
                "ERRO: DejaVu Sans Condensed Bold ausente e a instalação de "
                "fonts-dejavu-extra falhou. A capa NÃO sai no fallback largo "
                "(padrão visual). Instale a fonte e recomponha; --allow-fallback "
                "existe só para uso manual com aprovação do autor."
            )
        font_path = FALLBACK
        print("AVISO: compondo no fallback LARGO (--allow-fallback) — capa FORA do padrão.",
              file=sys.stderr)

    kicker = f"CAFÉ COM MERCADO      ·      {a.dia}, {a.data}"

    im = Image.open(a.base).convert("RGB")
    sw, sh = im.size
    scale = max(W / sw, H / sh)
    im = im.resize((int(sw * scale), int(sh * scale)), Image.LANCZOS)
    nw, nh = im.size
    left, top = (nw - W) // 2, (nh - H) // 2
    im = im.crop((left, top, left + W, top + H))
    draw = ImageDraw.Draw(im, "RGBA")

    def grad(h, top_edge, base_rgb, amax, power):
        g = Image.new("RGBA", (W, h), (0, 0, 0, 0))
        gd = ImageDraw.Draw(g)
        for y in range(h):
            t = (1 - y / h) if top_edge else (y / h)
            gd.line([(0, y), (W, y)], fill=base_rgb + (int(amax * t ** power),))
        im.paste(g, (0, 0 if top_edge else H - h), g)

    grad(150, False, (6, 10, 18), 150, 1.4)  # rodapé (marca)

    # faixa superior DEFINIDA (largura total, borda inferior suave) — o kicker é
    # centralizado verticalmente nela, como nas capas padrão.
    BAND_H, FADE = 140, 44
    top = Image.new("RGBA", (W, BAND_H), (0, 0, 0, 0))
    td = ImageDraw.Draw(top)
    for y in range(BAND_H):
        av = 216 if y < BAND_H - FADE else int(216 * (1 - (y - (BAND_H - FADE)) / FADE))
        td.line([(0, y), (W, y)], fill=(8, 12, 20, av))
    im.paste(top, (0, 0), top)

    def font(sz):
        return ImageFont.truetype(font_path, sz)

    def tw(s, f):
        return draw.textbbox((0, 0), s, font=f)[2]

    def tracked(x, y, s, f, fill, track):
        cx = x
        for ch in s:
            draw.text((cx, y), ch, font=f, fill=fill)
            cx += tw(ch, f) + track

    def wrap_balanced(s, f, max_w):
        words = s.split()
        if tw(s, f) <= max_w:
            return [s]
        best = None
        for i in range(1, len(words)):
            l1, l2 = " ".join(words[:i]), " ".join(words[i:])
            if tw(l1, f) <= max_w and tw(l2, f) <= max_w:
                d = abs(tw(l1, f) - tw(l2, f))
                if best is None or d < best[0]:
                    best = (d, [l1, l2])
        return best[1] if best else [s]

    maxw = W - 2 * MARGIN

    # kicker + barra azul, centralizados verticalmente na faixa
    fk = font(33)
    kb = draw.textbbox((0, 0), kicker, font=fk)
    kh, gap, bar_h = kb[3] - kb[1], 15, 7
    group_top = (BAND_H - (kh + gap + bar_h)) // 2
    tracked(MARGIN, group_top - kb[1], kicker, fk, (255, 255, 255, 255), 4)
    by = group_top + kh + gap
    draw.rounded_rectangle([MARGIN, by, MARGIN + 96, by + bar_h], radius=3, fill=BLUE)

    hy = BAND_H + 28
    hsz, fh = 118, font(118)
    lines = wrap_balanced(a.head, fh, maxw)
    while (len(lines) > 2 or any(tw(l, fh) > maxw for l in lines)) and hsz > 72:
        hsz -= 3
        fh = font(hsz)
        lines = wrap_balanced(a.head, fh, maxw)
    y = hy
    for ln in lines:
        draw.text((MARGIN + 3, y + 3), ln, font=fh, fill=(0, 0, 0, 150))
        draw.text((MARGIN, y), ln, font=fh, fill=(255, 255, 255, 255))
        y += fh.size + int(fh.size * 0.02)

    ssz, fs = 44, font(44)
    while tw(a.sub, fs) > maxw and ssz > 26:
        ssz -= 2
        fs = font(ssz)
    sy = y + 10
    draw.text((MARGIN + 2, sy + 2), a.sub, font=fs, fill=(0, 0, 0, 130))
    draw.text((MARGIN, sy), a.sub, font=fs, fill=(238, 242, 250, 255))

    fbr = font(33)
    draw.text((W - MARGIN - tw(BRAND, fbr), H - 58), BRAND, font=fbr, fill=(240, 244, 250, 240))

    im.save(a.out, "JPEG", quality=90)
    print(f"OK {a.out} | fonte: {os.path.basename(font_path)} | manchete: {len(lines)} linha(s) @ {hsz}px | sub {ssz}px")


if __name__ == "__main__":
    main()
