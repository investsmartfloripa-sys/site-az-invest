# Snapshot do dia anterior — Café com Mercado

**Rodada:** 2026-10-22 (quinta). Agendada 10:04 BRT, **disparou 11:41 BRT** (atraso de ~1h37 do agendador). Publicada 11:55 BRT. `.md` e capa em main (HEAD a973204). ✅ Deploy run `39799416886` (push): job `deploy` completed/success às 14:54Z (o status da run ficou em `in_progress` vários minutos depois do job concluir — lag do GitHub, não fila); edição e capa 200. ✅ WhatsApp postado (EXITCODE=0, capa anexada, confirmado no histórico).

## 🔧 INFRAESTRUTURA
- GitHub API segue bloqueada no sandbox da nuvem (403) → todo tráfego GitHub via `device_bash` (`$HOME/gh.sh` carrega PAT do `.env.vercel.local`). Arquivos do dia em `Enviador de Noticias\_transcripts\` (edicao-2026-10-22.md, capa-2026-10-22.jpg).
- Transcrição 5/5 de primeira via Desktop Commander (`C:\Python313\python.exe _transcripts\tr_1022.py`, youtube-transcript-api): Spyer q0dxizsRT6A, Money Times lGMAOlQG81w (é o Giro de 21/10 meio-dia, WEG/Quaest), BTG hLj-qVUUArM, XP TnAqTxMKrns (tema FIIs/data centers), Genial 4UCwwvJU6X0. A VM Linux do device não tem youtube_transcript_api.
- Blob do painel: caminho correto tem prefixo `data/` (`.../data/asset_returns_panorama.json`, `.../data/market_history_latest.json`); sem o prefixo dá "Blob not found". `asset_returns_panorama` não traz Ibovespa; `market_history_latest` traz ^BVSP (fechamento D-1).
- Capa: Higgsfield `cinematic_studio_2_5`, variante 96c6da06 (estação de oleoduto no deserto com fumaça e helicóptero, mão robótica cromada estilhaçando, figura de costas com guarda-chuva em avenida chuvosa à noite — tríptico). Ambas com faixa no topo; recortei 155 px. Descartada 22ba091a (faixa preta grossa). Manchete "PETRÓLEO E IA DERRUBAM BOLSAS" (2 linhas), sub "Brent a US$ 112; Brasil busca proteção".

## 📌 NARRATIVA (22/10)
- Fechamento 21/10: Ibov 206.495 (−0,86%; máx 209.244, mín 205.988); dólar R$ 5,027 (+0,17%); DI F28 12,78, F29 12,56, F31 12,59. HAPV3 −8,48, WEGE3 −7,34 (R$ 45,21), COGN3 −7,08; TOTS3 +2,78, TIMS3 +1,73, VIVT3 +1,40.
- Manhã 22/10: Ibov ~−1%, mín 203.548 (−1,43%) às 11h23; VALE3 −2,7; dólar R$ 5,02-5,05.
- Global: NY 21/10 Dow 52.856,09 (+0,69), S&P 7.757,17 (+0,58), Nasdaq 26.702,86 (+1,05). Hoje futuros S&P −1,0, Nasdaq −1,7. Meta capex 2026 US$ 135-145 bi; Tesla capex ~US$ 20 bi, −5% pré; IBM −6% pré; Lam −6% after. Ásia: Kospi −3,5, Nikkei −2,65, HSI −3,0, CSI 300 em bear market. UST10 5,13 → ~5,05 (fecha com petróleo em alta — Genial: mercado pesando crescimento > inflação). Brent 108,82 → ~111,5-112 (houthis em Dammam/aeroporto saudita; EUA retiram pessoal). OAT10 ~5,1% > Treasury. Ouro −1,1 a −1,7; cobre −2,5; BTC ~82 mil. Jobless claims 194 mil. Fed 3,75-4,00, pausa 28/10, alta dez.
- Eleição: Quaest 45×44 totais (rejeição Lula 53→47); Vérita 50,7×49,3 válidos; PoderData 22/10 51×49; Datafolha 22/10 19h (anterior 47×45); debate Globo 23/10.
- Fiscal: PEC tarifa zero ~R$ 11-12 bi em emendas; Flávio ajuste R$ 200 bi; Barclays >2,5% PIB (~R$ 350 bi). Arrecadação set R$ 239,4 bi (+5,6% real). Fluxo out até 16: +US$ 5,15 bi. Fitch: Selic 11,75% fim-2027.
- Empresas: Braskem America Finance Chapter 11 involuntário CONFIRMADO (Bracebridge, ~US$ 272 mi dos bonds 2041); Bradesco 3T após fechamento (consenso ~R$ 7,1 bi); Bradsaúde lucro 1,075 bi, div R$ 1 bi; Raízen aumento de capital R$ 3,5 bi a R$ 0,25 (AGEs 30/10); M. Dias Branco compra 80% Grespan R$ 208,4 mi; Emae último pregão 23/10; CSN rebaixada S&P; Eneva vendeu Itaqui.

## 🎯 Teses das casas
- **Genial (Motta + Villegas):** dia de aversão global; "nem o trade eleitoral segura" hoje; puts fora do dinheiro dispararam vs calls no 1º turno; assimetria (Ibov 170-180 mil, dólar 5,80, juro longo 15 no cenário adverso) justifica proteção cara; correlação petróleo × UST invertida é narrativa nova; CDS de hyperscalers +~700% a/a.
- **BTG (Luiz Molo + host):** correção de IA pontual; construtivo em data centers/semis; relatório de fluxo: locais e estrangeiros subalocados, GEM a 6% = ~US$ 25 bi; WEG 3T misto.
- **Empiricus/Money Times (Rui Hungria):** queda de WEG exagerada, oportunidade; 3T fraco para domésticas, forte para O&G (Petrobras, Prio).
- **Nova Futura:** mesa passou de ganho para proteção; RR 1m do real >10%.
- **Spyer:** exterior volta a fazer preço; PoderData 51×49.

## Próxima rodada (sexta 23/10)
- Conferir: Datafolha 22/10 19h; Bradesco 3T (lucro vs ~R$ 7,1 bi, PDD, ROE); fechamento Ibov/dólar/DI de 22/10; IPCA-15 (BTG 0,35%); PCE; debate Globo; Brent/houthis.
- AGENDA: 23/10 IPCA-15, PCE, PMI EUA, debate Globo, Moody's França · 24/10 pesquisas · 25/10 2º turno · 27-28/10 FOMC · 29/10 BCE · 30/10 BoJ · 03-04/11 Copom.
- Capa: evitar estação de oleoduto no deserto/helicóptero, mão robótica estilhaçada, figura com guarda-chuva na chuva, tríptico — além da lista anterior (foguete com feixes, homem de costas em rocha, Arco do Triunfo, plataforma com chama, cavalos de petróleo, memória RAM, barricada, skyline verde/amarelo, mina naval, poltronas vazias, porto chinês, cérebro holográfico, púlpitos, barra azul/vermelha, mina de cobre, sala limpa, navio afundando, wafer, balança, capacete/marmita, painel laranja, servidores, refinaria em chamas, colunas neoclássicas, bandeira em muro, encapuzado, tomates, torres de alta tensão, bico de bomba, cabine de votação, míssil, aeroporto, tanques, urna, barris, petroleiro, navio de guerra, Torre Eiffel, bandeira em mastro, Congresso, telas verdes, relógio, plataforma, touro, multidão, cédulas). Recortar ~155-175 px do topo segue necessário.
