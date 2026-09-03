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

SEM BASE (--fallback-bg): compoe sobre um fundo de marca gerado aqui mesmo
(gradiente escuro + brilho azul AZ + motivo abstrato de mercado). Serve para o
dia em que o gerador de imagem estiver fora do ar: a edicao SEMPRE sai com capa
e o post do WhatsApp SEMPRE vai com foto. Nao e foto do dia e nao finge ser.

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


def fundo_marca():
    """Fundo de marca 1600x840, gerado sem depender de nenhum servico externo.

    Existe por causa do incidente de 02/09/2026: o conector de imagem caiu com
    401, a edicao saiu sem `image` e o post do WhatsApp foi text-only. Com este
    fundo a capa nunca falta — perde-se a arte do dia, nao a capa.
    """
    img = Image.new("RGB", (W, H))
    px = img.load()
    topo, base_ = (7, 11, 18), (14, 23, 38)
    for y in range(H):
        f = y / (H - 1)
        linha = tuple(int(topo[i] + (base_[i] - topo[i]) * f) for i in range(3))
        for x in range(W):
            px[x, y] = linha

    # brilho azul difuso no canto inferior direito
    glow = Image.new("L", (W, H), 0)
    gd = ImageDraw.Draw(glow)
    cx, cy = int(W * 0.78), int(H * 0.72)
    for r in range(int(W * 0.55), 0, -8):
        i = int(120 * (1 - r / (W * 0.55)) ** 2)
        gd.ellipse([cx - r, cy - int(r * 0.72), cx + r, cy + int(r * 0.72)], fill=i)
    img = Image.composite(Image.new("RGB", (W, H), AZ_BLUE), img, glow)

    d = ImageDraw.Draw(img, "RGBA")

    # grade discreta
    for x in range(0, W, 80):
        d.line([(x, 0), (x, H)], fill=(255, 255, 255, 8), width=1)
    for y in range(0, H, 80):
        d.line([(0, y), (W, y)], fill=(255, 255, 255, 8), width=1)

    # motivo de mercado: barras + linha ascendente na faixa inferior
    alturas = [0.20, 0.34, 0.28, 0.46, 0.40, 0.58, 0.52, 0.70, 0.62, 0.80,
               0.74, 0.90, 0.84, 0.96, 0.88, 1.00]
    larg = int(W / (len(alturas) * 1.9))
    x0 = int(W * 0.06)
    piso = int(H * 0.88)
    teto = int(H * 0.44)
    pts = []
    for i, a in enumerate(alturas):
        x = x0 + int(i * larg * 1.9)
        y = piso - int((piso - teto) * a)
        d.rectangle([x, y, x + larg, piso], fill=(41, 130, 220, 34))
        pts.append((x + larg // 2, y))
    for i in range(len(pts) - 1):
        d.line([pts[i], pts[i + 1]], fill=(90, 170, 250, 90), width=3)
    for p in pts:
        d.ellipse([p[0] - 4, p[1] - 4, p[0] + 4, p[1] + 4], fill=(120, 190, 255, 120))

    # vinheta
    vin = Image.new("L", (W, H), 0)
    vd = ImageDraw.Draw(vin)
    for i in range(60):
        vd.rectangle([i * 3, i * 2, W - i * 3, H - i * 2], outline=3)
    img = Image.composite(Image.new("RGB", (W, H), (0, 0, 0)), img, vin)
    return img


def build(image, out, kicker, manchete, sub, brand="investimentosdeaz.com.br",
          allow_fallback=False):
    font_head = ensure_condensed(allow_fallback)

    if image is None:
        print("AVISO: sem base gerada — compondo sobre o FUNDO DE MARCA (--fallback-bg).",
              file=sys.stderr)
        base = fundo_marca()
    else:
        base = Image.open(image).convert("RGB")
    w0, h0 = base.size
    nw, nh = W, int(h0 * W / w0)
    img = base if image is None else base.resize((nw, nh), Image.LANCZOS)
    if image is None:
        nh = H
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
    ap.add_argument("--image", "--base", dest="image",
                    help="imagem base gerada (PNG). Sem ela, use --fallback-bg")
    ap.add_argument("--fallback-bg", action="store_true",
                    help="compoe sobre o fundo de marca, sem base externa (use "
                         "quando o gerador de imagem estiver fora do ar)")
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
    if not a.image and not a.fallback_bg:
        ap.error("informe --image, ou --fallback-bg para compor sobre o fundo de marca")

    build(a.image if a.image else None, a.out, kicker, a.manchete, a.sub, a.brand,
          a.allow_fallback)
