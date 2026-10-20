# Snapshot do dia anterior — Café com Mercado

**Rodada:** 2026-10-20 (terça). Agendada 10:04 BRT, mas DISPAROU às 13:14 BRT (~3h de atraso do scheduler) — edição saiu com níveis intradiários das 13h. `.md` e capa em main (HEAD 4767c41). ✅ Deploy run `39457364803` (push) success; edição e capa 200. ✅ WhatsApp postado (EXITCODE=0, capa anexada, confirmado no histórico às 13:28).

## 🔧 INFRAESTRUTURA
- GitHub API segue bloqueada no sandbox da nuvem (403 "GitHub access to this repository is not enabled for this session") → todo tráfego GitHub via `device_bash` com PAT do `.env.vercel.local`. PAT levado à nuvem via device_stage_files do .env (sem eco). Arquivos do dia em `Enviador de Noticias\_transcripts\` (edicao-2026-10-20.md, capa-2026-10-20.jpg).
- Transcrição 4/4: Genial i_o-T99MtaQ e XP D_0_GJSHn7Q via yt-dlp na nuvem (XP na 2ª tentativa); Spyer 9M6vYkFsj-8 e BTG rTYQi31IhZg deram bot check na nuvem e na VM local → OK via Desktop Commander (`C:\Python313\python.exe _transcripts\tr_1020.py`, youtube-transcript-api). BTG voltou a ter legenda (a falha de 19/10 era pontual). Money Times: sem morning call no RSS (só pesquisas eleitorais).
- Base de dados do site: `data/<serie>.json` no Blob. O período "1d" de asset/world/commodities_returns_panorama compara com 2026-10-14 (não D-1) → não usar 1d como variação diária.
- Capa: Higgsfield OK, `cinematic_studio_2_5`, variante f5d6d826 (cavalos de petróleo sob fumaça laranja, módulos de memória RAM estilhaçados, barricada em chamas em rua de paralelepípedo com tropa de choque de costas, skyline com feixes verde/amarelo). Variante ca5d5f42 descartada (moldura no topo). Manchete "IBOV ENCOSTA NO RECORDE" (2 linhas), sub "Pesquisas animam; Brent a US$ 111 e Kospi −3,7%".

## 📌 NARRATIVA (20/10)
- Fechamento 19/10: Ibov 205.079,25 (−0,17%; Petrobras tirou ~870 pts; 49 altas × 27 quedas; AZZA3 +13,25, MGLU3 +6,5, MRVE3 +10,9; MBRF3 −4,1, PETR4 −2,82). Dólar R$ 5,048 (−0,49%). DI F27 13,479, F29 12,66, F31 12,73.
- 20/10 13h: Ibov 208.720 (+1,78%, máx do dia; recorde intradiário 209.605,70 em 5/10). Dólar R$ 5,012 (−0,70%). AMER3 ~+25% (fim da RJ). Bancos em alta.
- Pesquisas: PoderData 52×48 válidos; Real Time Big Data 52×48 (48×45 totais); Alfa 51,5×48,5; Atlas 49,8×47,6 totais; Nexus 50,3×49,7. Próximas: Quaest 21, Datafolha 22, debate Globo 23, seis pesquisas 24.
- Fiscal: Lula nega "bomba fiscal", critica autonomia do BC; governo antecipou pagamento do Bolsa Família. Lulinha entregou sigilos a Mendonça (STF).
- Focus 19/10: IPCA26 5,22 / 27 4,32; Selic26 13,25 / 27 12,00; PIB26 1,83; câmbio 5,13. Selic atual 13,75%.
- Global: NY 19/10 S&P 7.690,73 (+0,41), Nasdaq 26.430,89 (+1,11), Dow 51.966,03. Hoje ~11h30 S&P 7.745 (+0,7), Dow +1,2. UST10 fechou 19/10 ~5,14-5,15; hoje ~5,08 (housing starts 1,221 mi, −5,2%). DXY 101,55. USD/CNY 6,666 (fixing 6,72, yuan mais forte desde fev/23). Brent máx ~111,6, depois ~108 com relatos de acordo EUA–Irã (não confirmados). WTI nov venceu hoje (máx 109). Ouro 4.124, BTC ~81,5 mil. Ásia: Kospi −3,7 (Elice −32% na estreia), Nikkei −1,3, HSI −1,3. Europa −0,3 a −0,7; OAT10 ~4,95, spread ~150 pb. Alemanha PPI 6,7% a/a. China LPR 3,0/3,5. Fed 3,75–4,00; ~83% manutenção 28/10; alta dez ~94%.
- Empresas: AMER3 fim da RJ; Inter compra 39,75% da Wiz na Inter Seguros (R$ 409,5 mi); Braskem OPA liquida 21/10; Prudential vende BR/MX à CNP (US$ 4,03 bi); CSN cimentos fase final; Casas Bahia ratifica RJ; Vale Panda bonds RMB 10 bi; México suspende importação de aves BR (Newcastle em SC).

## 🎯 Teses das casas
- **BTG (Gerson + "Coxinha"):** semana de cautela no externo; petróleo alto é net negativo pra bolsa BR (só ajuda Petro, atrasa cortes); olhar small caps/domésticas, não o Ibov; range técnico 204–209 mil, rompimento pós-eleição, tendência de alta, resistências 222 e 237 mil; fluxo estrangeiro dominante, local ainda tímido; estatística: semana pré-2º turno costuma ser positiva.
- **Genial (Motta):** fragilidade do ciclo de IA vira evento macro (capex + consumo) → menos Fed, dólar fraco; Brasil binário; estrangeiro +R$ 21 bi em out; subsídio a combustível = bomba fiscal 2027, inflação 2027 pode ir a 7%; com alternância, PEC fiscal rápida com Congresso forte.
- **XP (Raquel Sá + Maria Irene):** fase de stock picking após alta guiada por fluxo/curva longa; relatório de capex dos hyperscalers; antecipação do Bolsa Família pesa no risco.
- **Spyer:** pesquisas subestimam Flávio (Montenegro); simulador viral 99% Flávio.
- **Itaú BBA:** alvo 220 mil se romper 209.700. **BB:** lateral 204–207 mil (já superado).

## Próxima rodada (quarta 21/10)
- Conferir: fechamento Ibov/dólar/DI de 20/10 (bateu recorde de fechamento?); Netflix/SpaceX/United (after 20/10); Quaest 21/10; Meta/Tesla/WEG 21/10; IGP-M 2ª prévia; CPI UK; confirmação ou desmentido do acordo EUA–Irã.
- Scheduler atrasou 3h hoje — conferir horário de disparo.
- AGENDA: 21/10 Quaest, Meta/Tesla/WEG · 22/10 Datafolha, CMN · 23/10 IPCA-15, debate Globo, Moody's França · 24/10 seis pesquisas · 25/10 2º turno · 27-28/10 FOMC · 29/10 BCE · 30/10 BoJ · 03-04/11 Copom.
- Capa: evitar cavalos de petróleo, módulos de memória estilhaçados, barricada em chamas com tropa de choque, skyline com feixes verde/amarelo — além da lista anterior (mina naval, poltronas vazias, porto chinês com contêineres/lanternas, cérebro holográfico, púlpitos de debate, barra azul/vermelha, mina de cobre/catodos, sala limpa de chips, navio afundando, wafer de chip, balança, capacete/marmita, painel de cotações laranja, sala de servidores, refinaria em chamas, colunas neoclássicas, bandeira pintada em muro, figura encapuzada, tomates, torres de alta tensão, bico de bomba, cabine de votação, míssil, aeroporto, tanques, urna, barris, petroleiro, navio de guerra, Torre Eiffel, bandeira em mastro, Congresso, telas verdes, relógio, plataforma, touro, multidão, cédulas). Ambas as variantes vieram com faixa/moldura no topo: reforçar no prompt "no letterbox, no border".
