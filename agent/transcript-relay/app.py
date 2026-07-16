# Relay de transcrição do "Café com Mercado".
#
# Por que existe: o sandbox de nuvem do Claude Code tem IP de datacenter que o
# YouTube bloqueia de forma estrutural (bot-check/429 no yt-dlp em dias ruins,
# RequestBlocked no youtube-transcript-api sempre, 403 no CDN de mídia sempre).
# Este serviço roda num VPS com IP próprio: a rotina pede a legenda por HTTPS
# e o VPS é quem conversa com o YouTube.
#
# Endpoints:
#   GET /health                      → {"ok": true}  (sem auth; p/ monitoração)
#   GET /transcript/<video_id>       → auth via header X-Api-Key
#     respostas (sempre HTTP 200 com JSON, exceto auth/validação):
#       {"status":"ok","video_id":...,"lines":N,"text":"..."}   legenda limpa
#       {"status":"live"}            vídeo ainda em transmissão — tentar depois
#       {"status":"no_subtitles"}    encerrado mas sem legenda pt disponível
#       {"status":"error","detail":"..."}  falha inesperada (yt-dlp etc.)
#
# A limpeza do VTT é a MESMA do agent/fetch-transcript.sh: remove cabeçalhos/
# timestamps/tags e deduplica linhas repetidas (auto-legenda repete muito).
import json
import os
import pathlib
import re
import subprocess
import tempfile

from fastapi import FastAPI, Header, HTTPException

RELAY_TOKEN = os.environ["RELAY_TOKEN"]  # obrigatório — falhar alto se faltar
YTDLP_TIMEOUT = int(os.environ.get("YTDLP_TIMEOUT", "90"))

app = FastAPI(title="cafe-com-mercado transcript relay")

VIDEO_ID_RE = re.compile(r"^[A-Za-z0-9_-]{5,20}$")
TS_RE = re.compile(r"^\d{2}:\d{2}:\d{2}")
TAG_RE = re.compile(r"<[^>]+>")
SKIP_RE = re.compile(r"^(WEBVTT|NOTE|Kind:|Language:)")


def clean_vtt(path: pathlib.Path) -> list[str]:
    seen: set[str] = set()
    out: list[str] = []
    for raw in path.read_text(encoding="utf-8", errors="replace").splitlines():
        line = TAG_RE.sub("", raw).strip()
        if not line or SKIP_RE.match(line) or TS_RE.match(line):
            continue
        if line in seen:
            continue
        seen.add(line)
        out.append(line)
    return out


@app.get("/health")
def health():
    return {"ok": True}


@app.get("/transcript/{video_id}")
def transcript(video_id: str, x_api_key: str | None = Header(default=None)):
    if x_api_key != RELAY_TOKEN:
        raise HTTPException(status_code=401, detail="chave inválida")
    if not VIDEO_ID_RE.fullmatch(video_id):
        raise HTTPException(status_code=400, detail="video_id inválido")

    url = f"https://youtube.com/watch?v={video_id}"

    # 1) metadados (barato) — detecta transmissão ao vivo antes de tentar legenda
    try:
        meta_proc = subprocess.run(
            ["yt-dlp", "--dump-json", "--skip-download", url],
            capture_output=True, text=True, timeout=YTDLP_TIMEOUT,
        )
        if meta_proc.returncode == 0:
            meta = json.loads(meta_proc.stdout)
            if meta.get("is_live"):
                return {"status": "live", "video_id": video_id}
    except (subprocess.TimeoutExpired, json.JSONDecodeError):
        pass  # segue para a tentativa de legenda mesmo sem metadados

    # 2) legenda (manual ou automática), variantes pt
    with tempfile.TemporaryDirectory() as tmp:
        try:
            sub_proc = subprocess.run(
                [
                    "yt-dlp", "--skip-download",
                    "--write-auto-sub", "--write-sub",
                    "--sub-lang", "pt,pt-BR,pt-orig",
                    "--sub-format", "vtt", "--convert-subs", "vtt",
                    "-o", "%(id)s.%(ext)s", url,
                ],
                capture_output=True, text=True, timeout=YTDLP_TIMEOUT, cwd=tmp,
            )
        except subprocess.TimeoutExpired:
            return {"status": "error", "detail": "yt-dlp excedeu o tempo limite"}

        vtts = sorted(pathlib.Path(tmp).glob(f"{video_id}*.vtt"))
        if not vtts:
            detail = (sub_proc.stderr or "").strip().splitlines()
            if sub_proc.returncode != 0 and detail:
                return {"status": "error", "detail": detail[-1][:300]}
            return {"status": "no_subtitles", "video_id": video_id}

        lines = clean_vtt(vtts[0])
        return {
            "status": "ok",
            "video_id": video_id,
            "lines": len(lines),
            "text": "\n".join(lines),
        }
