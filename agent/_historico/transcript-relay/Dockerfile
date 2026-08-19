# Relay de transcrição — imagem mínima (yt-dlp + FastAPI).
# yt-dlp recomenda um runtime JS para extração do YouTube: deno resolve.
FROM python:3.12-slim

RUN pip install --no-cache-dir fastapi uvicorn yt-dlp \
    && apt-get update \
    && apt-get install -y --no-install-recommends curl ca-certificates unzip \
    && curl -fsSL https://deno.land/install.sh | DENO_INSTALL=/usr/local sh -s -- --yes \
    && apt-get purge -y unzip && apt-get autoremove -y \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /srv
COPY app.py .

# yt-dlp desatualizado quebra com mudanças do YouTube — atualiza a cada boot.
CMD ["sh", "-c", "pip install --no-cache-dir -qU yt-dlp; uvicorn app:app --host 0.0.0.0 --port 8000"]
