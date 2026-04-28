# Data pipeline (Painel Economico)

Gera artefatos consumidos pelo Next.js na raiz deste repositorio (`src/app/painel-economico`, etc.):

- **SVG** (R + ggplot2 + svglite): curvas de juros BR, Selic implicita, Treasury EUA → upload para `charts/static/` no Vercel Blob.
- **JSON de tabela** (R): dados tabulares que acompanham os graficos de juros → upload para `charts/tables/` no Vercel Blob.
- **JSON** (Python + pandas + yfinance): retornos, moedas, setores, commodities → upload para `data/` no Vercel Blob.

## Estrutura

- `r/` — scripts R (instalar pacotes com `Rscript r/install_packages.R`).
- `r/chart_theme.R` — **tema visual padrao** para todos os SVGs gerados via ggplot2.
- `python/` — scripts Python (`pip install -r python/requirements.txt`).
- `out/` — saida local (gitignored); CI tambem usa esta pasta antes do upload.

## Padrao visual dos graficos (fonte unica)

Para manter consistencia entre todos os graficos atuais e futuros:

- Reutilize `az_chart_theme()` para tema/base do plot.
- Reutilize `az_chart_stamp()` para carimbo de atualizacao no `caption`.
- Evite declarar temas locais duplicados nos scripts; prefira sobrescrever apenas cores/paleta e escalas especificas do grafico.

## Variaveis de ambiente

Veja [.env.example](.env.example). No GitHub Actions, configure secrets:

- `BLOB_READ_WRITE_TOKEN` — token read-write do store Vercel Blob.
- `FRED_API_KEY` — obrigatorio para curva Treasury EUA.

No projeto Next.js, configure `NEXT_PUBLIC_BLOB_BASE_URL` com a URL publica do store (ex.: `https://xxxx.public.blob.vercel-storage.com`), sem barra final.

## Rodar localmente

```bash
cd data-pipeline/python
pip install -r requirements.txt
python run_panorama_builds.py
```

```bash
cd data-pipeline
Rscript r/install_packages.R
Rscript r/build_yield_curves_svg.R
Rscript r/build_treasury_us_svg.R
Rscript r/build_selic_implicita.R
```

Sem `BLOB_READ_WRITE_TOKEN`, os arquivos ficam apenas em `out/`.

## Selic implicita (rb3)

`r/build_selic_implicita.R` depende do pacote **rb3** e da curva PRE na B3. Em ambientes sem acesso ou sem rb3, o workflow continua (`|| true`) e o site pode exibir placeholder para o SVG ausente.

## Checklist go-live (100%)

1. **Vercel Blob** — No dashboard: Storage → criar Blob store → token **Read and Write** → copiar URL publica (`https://<id>.public.blob.vercel-storage.com`, sem barra final).
2. **Next.js** — Em Environment Variables do projeto: `NEXT_PUBLIC_BLOB_BASE_URL` = essa URL. Localmente: mesmo valor no `.env` (veja `.env.example` na raiz do repo).
3. **GitHub** — Repo → *Settings* → *Secrets and variables* → *Actions*: `BLOB_READ_WRITE_TOKEN` (token do Blob) e `FRED_API_KEY` (St. Louis Fed).
4. **Primeira carga** — *Actions* → workflow **Data pipeline (Painel Panorama)** → *Run workflow*. Conferir no Blob os arquivos em `data/*` e `charts/static/*`.
5. **Site** — Deploy com a env definida; abrir `/painel-economico`. Ate 15 min de cache ISR apos novo upload.
6. **Verificacao local** — Na raiz do repo: `npm run go-live:check` (exige `NEXT_PUBLIC_BLOB_BASE_URL` no `.env`).
