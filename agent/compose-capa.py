#!/usr/bin/env python3
"""compose-capa.py — crava a manchete padrao do "Cafe com Mercado" sobre a base.

Layout: kicker branco espacado, barra azul AZ, manchete condensada em caixa alta,
subtitulo de uma linha e assinatura do site no rodape, sobre gradientes escuros
no topo e na base. Saida 1600x840.

DEPENDE da fonte DejaVu Sans Condensed Bold (pacote fonts-dejavu-extra). Sem ela
a manchete sai numa fonte larga e a capa perde o padrao visual, por isso o script
tenta instalar a fonte e, se ainda faltar, aborta em vez de compor fora do padrao.
O fallback largo so sai com --allow-fallback, que e decisao do autor e nunca da
rotina automatica.

USO (interface atual):
    python3 compose-capa.py --image base.png --out capa.jpg \
        --kicker "CAFE COM MERCADO   .   QUARTA, 19/08" \
        --manchete "A MAIOR FUGA DESDE 2008" \
        --sub "11a queda do Ibovespa e ata do Fed as 15h"

USO (interface antiga, ainda aceita):
    python3 compose-capa.py --base base.png --out capa.jpg \
        --dia SEXTA --data 10/07 --head "MANCHETE" --sub "subtitulo"

LIMITES MEDIDOS: manchete ate ~32 caracteres (acima quebra em 3 linhas e cobre
arte demais); subtitulo ate ~48 caracteres (acima e cortado na margem direita).
O script avisa quando o subtitulo estoura.
"""

import argparse
import os
import subprocess
import sys

from PIL import Image, ImageDraw, ImageFont

FONT_CONDENSED = "/usr/share/fonts/truetype/dejavu/DejaVuSansCondensed-Bold.ttf"
FONT_STANDARD = "/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf"
AZ_BLUE = (2, 125, 252)
W, H = 1600, 840


def ensure_condensed(allow_fallback=False):
    """Devolve a fonte da manchete. Instala a condensada se faltar; aborta se nao vier."""
    if os.path.exists(FONT_CONDENSED):
        return FONT_CONDENSED
    print("AVISO: fonte condensada ausente — tentando instalar fonts-dejavu-extra...",
          file=sys.stderr)
    for cmd in (["apt-get", "update", "-qq"],
                ["apt-get", "install", "-y", "--no-install-recommends", "-qq",
                 "fonts-dejavu-extra"]):
        try:
            subprocess.run(cmd, check=False, capture_output=True, timeout=180)
        except Exception:
            break
    if os.path.exists(FONT_CONDENSED):
        print("OK: fonte condensada instalada.", file=sys.stderr)
        return FONT_CONDENSED
    if allow_fallback:
        print("AVISO: compondo no fallback LARGO (--allow-fallback) — capa FORA do padrao.",
              file=sys.stderr)
        return FONT_STANDARD
    sys.exit("ERRO: DejaVuSansCondensed-Bold.ttf ausente e nao instalavel. A capa sairia "
             "fora do padrao visual. Instale fonts-dejavu-extra e recomponha, ou passe "
             "--allow-fallback para aceitar a fonte larga conscientemente.")


def build(image, out, kicker, manchete, sub, brand="investimentosdeaz.com.br",
          allow_fallback=False):
    font_head = ensure_condensed(allow_fallback)

    base = Image.open(image).convert("RGB")
    w0, h0 = base.size
    nw, nh = W, int(h0 * W / w0)
    img = base.resize((nw, nh), Image.LANCZOS)
    if nh >= H:
        top = int((nh - H) * 0.42)
        img = img.crop((0, top, W, top + H))
    else:
        nh2, nw2 = H, int(w0 * H / h0)
        tmp = base.resize((nw2, nh2), Image.LANCZOS)
        left = (nw2 - W) // 2
        img = tmp.crop((left, 0, left + W, H))

    # gradiente escuro no topo, para a manchete respirar
    g = Image.new("L", (1, H), 0)
    for y in range(H):
        f = max(0.0, 1 - (y / (H * 0.60)))
        g.putpixel((0, y), int(210 * f))
    img = Image.composite(Image.new("RGB", (W, H), (0, 0, 0)), img, g.resize((W, H)))

    # gradiente escuro na base, para a assinatura
    gb = Image.new("L", (1, H), 0)
    for y in range(H):
        f = max(0.0, (y - (H * 0.84)) / (H * 0.16))
        gb.putpixel((0, y), int(140 * f))
    img = Image.composite(Image.new("RGB", (W, H), (0, 0, 0)), img, gb.resize((W, H)))

    d = ImageDraw.Draw(img)
    s = W / 1200.0
    kf = ImageFont.truetype(FONT_STANDARD, int(26 * s))
    mf = ImageFont.truetype(font_head, int(76 * s))
    sf = ImageFont.truetype(FONT_STANDARD, int(30 * s))
    bf = ImageFont.truetype(FONT_STANDARD, int(20 * s))
    MX = int(66 * s)
    y = int(48 * s)

    def ls_text(xy, t, f, fill, ls=0, sh=None):
        """Texto com letter-spacing manual e sombra opcional."""
        x, yy = xy
        for ch in t:
            if sh:
                d.text((x + sh[0], yy + sh[1]), ch, font=f, fill=sh[2])
            d.text((x, yy), ch, font=f, fill=fill)
            x += d.textlength(ch, font=f) + ls
        return x

    ls_text((MX, y), kicker, kf, (255, 255, 255), ls=int(2 * s),
            sh=(int(2 * s), int(2 * s), (0, 0, 0)))
    y += int(40 * s)
    d.rectangle([MX, y, MX + int(74 * s), y + int(6 * s)], fill=AZ_BLUE)
    y += int(24 * s)

    maxw = W - MX - int(70 * s)
    lines, cur = [], ""
    for wd in manchete.split():
        t = (cur + " " + wd).strip()
        if d.textlength(t, font=mf) <= maxw:
            cur = t
        else:
            lines.append(cur)
            cur = wd
    if cur:
        lines.append(cur)
    if len(lines) > 2:
        print("AVISO: manchete quebrou em %d linhas — encurte para ~32 caracteres"
              % len(lines))
    for ln in lines:
        d.text((MX + int(3 * s), y + int(3 * s)), ln, font=mf, fill=(0, 0, 0))
        d.text((MX, y), ln, font=mf, fill=(255, 255, 255))
        y += int(80 * s)
    y += int(8 * s)

    if sub:
        if d.textlength(sub, font=sf) > maxw:
            print("AVISO: subtitulo estoura a margem — encurte para ~48 caracteres")
        d.text((MX + int(2 * s), y + int(2 * s)), sub, font=sf, fill=(0, 0, 0))
        d.text((MX, y), sub, font=sf, fill=(236, 236, 236))

    if brand:
        bw = d.textlength(brand, font=bf)
        d.text((W - MX - bw, H - int(48 * s)), brand, font=bf, fill=(255, 255, 255))

    if out.lower().endswith((".jpg", ".jpeg")):
        img.save(out, quality=88, optimize=True)
    else:
        img.save(out)
    print("OK", out, img.size, "linhas manchete:", lines)


if __name__ == "__main__":
    ap = argparse.ArgumentParser()
    ap.add_argument("--image", "--base", dest="image", required=True,
                    help="imagem base gerada (PNG)")
    ap.add_argument("--out", required=True, help="arquivo de saida (.jpg)")
    ap.add_argument("--kicker", help='linha superior pronta, ex.: "CAFE COM MERCADO . QUARTA, 19/08"')
    ap.add_argument("--dia", help="interface antiga: dia da semana em caixa alta")
    ap.add_argument("--data", help="interface antiga: DD/MM")
    ap.add_argument("--manchete", "--head", dest="manchete",
                    help="manchete curta em caixa alta")
    ap.add_argument("--sub", default="", help="subtitulo de 1 linha")
    ap.add_argument("--brand", default="investimentosdeaz.com.br")
    ap.add_argument("--allow-fallback", action="store_true",
                    help="aceita a fonte larga se a condensada faltar (decisao manual)")
    a = ap.parse_args()

    kicker = a.kicker
    if not kicker:
        if not (a.dia and a.data):
            ap.error("informe --kicker, ou --dia e --data")
        kicker = "CAFE COM MERCADO   .   %s, %s" % (a.dia, a.data)
    if not a.manchete:
        ap.error("informe --manchete (ou --head)")

    build(a.image, a.out, kicker, a.manchete, a.sub, a.brand, a.allow_fallback)
