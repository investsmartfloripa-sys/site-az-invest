"""Documentacao do schema JSON do painel (referencia para o front).

Payloads gerados em `data/*.json` no Blob:

- asset_returns_panorama.json: { status, generated_at, by_period: { "1d"|...: { data, fx, period } } }
- world_indices_returns_panorama.json: mesmo padrao by_period com lista em data
- fx_top_movers.json: legado (top.day/week/month/quarter/year)
- commodities_returns_panorama.json: by_period
- sector_baskets_panorama.json: by_period com view_brl / view_usd
- br_sector_baskets_panorama.json: by_period com data.top10/bottom10
"""
