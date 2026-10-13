# Snapshot do dia anterior — Café com Mercado

**Rodada:** 2026-10-13 (terça), disparada 10:28 BRT (agendada 10:02). `.md` e capa em main (HEAD 03a2f70). ✅ Deploy run `38407194337` (push) success; edição e capa 200. ✅ WhatsApp postado (EXITCODE=0, capa anexada, confirmado no histórico).

## 🔧 INFRAESTRUTURA
- GitHub API segue bloqueada no sandbox da nuvem (403 "GitHub access to this repository is not enabled for this session") → todo tráfego GitHub via `device_bash` com PAT do `.env.vercel.local`.
- Transcrição: nuvem (yt-dlp) levou bot check; `device_bash` (VM) levou `IpBlocked` no youtube-transcript-api. Funcionou via Desktop Commander (C:\Python313, youtube_transcript_api, script em `Enviador de Noticias\_transcripts\tr.py`). 5/5: Spyer fthvgoM5yS0, Money Times ItV-lOD5O1E (corte curto ~1 min sobre curva/Selic), BTG KIuemXGlHZE (Coxinha + Gerson Zourense), XP nhlAd-DDAv0 (Raquel Sá + Maria Irene Jordão, prévia de balanços EUA), Genial QIbP-_fCEbM (TranscriptsDisabled às ~10:35, legenda pronta na repesca às ~10:40).
- Capa: **FALLBACK de marca** (`--fallback-bg`). Higgsfield MCP falhou ao conectar: "MCP server Higgfield connection timed out after 30000ms"; depois apareceu como conectado mas sem tools `generate_image` no ToolSearch. Composição no device (PIL 12.3). Manchete "BOLSA REALIZA APÓS RECORDE" (2 linhas), sub "Nexus põe Flávio à frente; chips derrubam a Ásia".
- Blob do painel: `asset_returns_panorama` é por ETF (sem nível de Ibov) — não usado no placar.

## 📌 NARRATIVA (13/10) — REALIZAÇÃO PÓS-RECORDE; CHIPS NA ÁSIA; BANCOS EUA
- Sexta 09/10 fechamento: Ibov 209.067 (+1,38%, recorde; máx 209.713; semana +8,82%; vol R$ 56,5 bi); dólar R$ 4,9856 (−0,76%; semana −4,44%); DI F27 13,439, F29 12,220 (−9,5), F31 12,245 (−20,2). Altas MRVE3 +21,6, MGLU3 +19,2, LREN3 +11,6; baixas VIVT3 −5,3, TIMS3 −4,2. Small caps semana ~+20%. Estrangeiro 08/10 +R$ 1,65 bi; out +R$ 14,72 bi; ano +R$ 42,44 bi.
- 13/10 ~10h30: Ibov ~206,6 mil (~−1,2%; mín 206.150); dólar R$ 5,01-5,02; DI F29 12,315 (+9,5); bancos −2%; MGLU3 −6%.
- Focus: IPCA 2026 5,22% (de 5,01), 2027 4,30; Selic fim 2026 13,25 (de 13,50), 2027 12,00; PIB 2026 1,85; câmbio 5,15. FMI: PIB BR 2,2% (2026), 1,9% (2027).
- Política: BTG/Nexus (10-12/10) Flávio 48×45 totais, 52×48 válidos; rejeição Lula 51, Flávio 47. Quaest só estaduais no feriado; nacional 14/10; Datafolha 15/10. Spyer citou Gerp 55×45, outra 52,7×47,3, DataTrends 53,1×46,9 — NÃO usadas (não verificadas). Genial citou PoderData com melhora de Lula — números truncados, NÃO usados. Pacote combustíveis R$ 5,2 bi/30 dias. PEC 6x1 1º turno Senado 14/10 (49 votos).
- Global: S&P 12/10 7.807 (−0,06), Nasdaq 27.246 (−0,44), Dow 51.856 (+0,38); SOX −2,7. Kospi −5,5/−6,1 (CXMT DRAM), Nikkei ~−2. UST10 5,19, UST2 4,77. DXY 102,56; EUR 1,1175 (mín 1,1154). Brent 104,4 (−2,1; >107 na segunda, ataque houthi a Riad), WTI 91,8; ouro 4.210; BTC ~83,5 mil. Bancos: JPM LPA 5,57 vs 5,90 (aj. 5,75); GS 17,01 vs 13,02; WFC 1,87 vs ~1,85; Citi 2,85 vs ~2,66. Fed 3,75-4,00; Hammack por mais altas; Waller pausa.

## 🎯 Teses das casas
- **Genial (Motta, Villegas):** "festa apenas começando"; Brasil como anti-IA; NTN-B longas e small caps; espera realização em juros hoje; DXY com setup de venda (suporte 101); UST10 suporte 4,88-4,90; Ibov pivô de alta acima de 209-210 mil → 228 mil fim de ano; small caps assimetria técnica negativa no curto prazo; minério canal de baixa (negativo Vale); ouro rompe acima de 4.340; euro suporte 1,11-1,12.
- **BTG (Gerson):** fluxo/posicionamento muito baixo, "pequeno começo"; prefere SMAL11 + bancos/elétricas ao Ibov (commodities); reticente com Vale; mesa migrando de proteção para calls.
- **XP (Raquel Sá):** alta por expectativa de ajuste fiscal gradual + menor incerteza; serviços teimosos; subsídios a combustíveis terão de voltar; S&P alvo 8.900 fim 2027; lucro 3T S&P +31,4% (consenso 29,2%).
- **Money Times:** curva precifica 25 pb nas duas próximas reuniões e cortes até ago/27; fiscal define o BC.

## Próxima rodada (quarta 14/10)
- Conferir: Ibov/dólar fechamento 13/10; leilão NTN-B 13/10; CPI EUA 09h30 (catalisador); Quaest nacional; PMS agosto; PEC 6x1 no Senado; BofA, MS, ASML, BlackRock; CPI/PPI China (13/10 22h30); vencimento de índice; reação JPM/Citi.
- AGENDA: 15/10 Datafolha, PMC, TSMC · 16/10 IBC-Br, OPA Braskem · 23/10 debate Globo · 25/10 2º turno · 27-28/10 FOMC · 29-30/10 BoJ · 03-04/11 Copom.
- Capa: hoje foi fallback de marca (sem arte). Se o Higgsfield voltar, evitar repetir: tomates/caixote, torres de alta tensão, bico de bomba, cabine de votação, míssil, aeroporto, tanques, urna, barris, petroleiro, navio de guerra, Torre Eiffel, bandeira em mastro, Congresso, telas verdes, relógio, plataforma, touro, multidão, cédulas.
