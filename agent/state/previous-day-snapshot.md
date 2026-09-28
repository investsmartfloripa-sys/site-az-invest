# Snapshot do dia anterior — Café com Mercado

**Rodada:** 2026-09-28 (segunda), agendada para 10:02 BRT mas **disparada às 12:21 BRT** (atraso do agendador). Publicada ~12:36 BRT (frontmatter diz 12:50 — hora estimada, ficou adiantada). ✅ Deploy `success` na run do push `36444451445` (commit 5f99a25). ✅ WhatsApp `EXITCODE=0`, capa anexada, confirmado no histórico (messageId `..._3EB01C72ED48ABF4E297A7_...`). 3 de 5 transcrições.

## 🔧 INFRAESTRUTURA
- GitHub API segue bloqueada no sandbox da nuvem (403 "GitHub access to this repository is not enabled") e sem `GITHUB_PAT_COWORK` no ambiente → todo tráfego GitHub via `device_bash` com PAT do `.env.vercel.local`. Funcionou.
- Capa composta no device_bash (compose-capa.py do repo). Higgsfield `cinematic_studio_2_5`, jobs `c865adb7` e `069f0bb8` (escolhida); ambas com faixa no topo → recortei 165 px do topo da v1. Manchete "PETRÓLEO VOLTA A US$ 108" quebrou em 2 linhas → trocada por **"PETRÓLEO A US$ 108"**; sub "Trump rejeita proposta do Irã para Ormuz". Acentos conferidos.
- Painel Blob: `BZ=F` segue quebrado (Brent 100,26, −3,89% — rolagem, NÃO usar); `world_indices` 1d do Nikkei (+1,3) é o de sexta, stale. USD/BRL do painel OK (5,2189, +0,55% às 12:16).
- yt-dlp no device_bash: BTG, XP, Genial OK. **Spyer `0-feae3UyPs`: HTTP 429 em 2 tentativas.** **Money Times `2hJqf4df37s` ("Fim das Bets, eleições e Focus"): ainda AO VIVO às 12:25** — não transcrito.

## 📌 NARRATIVA (28/9) — ORMUZ + JURO LONGO + SEMANA DO 1º TURNO
- Sábado: Trump rejeitou proposta iraniana (reabertura gradual de Ormuz em 7 dias contra fundos congelados, sanções, fim do bloqueio naval). Brent 107-108 (+3 a 4%), WTI ~96. Houthis: mísseis interceptados pela coalizão saudita.
- UST 10a ~5,22 (máx. desde 2007), 30a 5,53-5,54 (máx. desde 2004), 2a ~4,91. Bund 3,63-3,65; Gilt 5,40 (BoE nov 85%). Ouro −3% (~4.180), prata −4,8%, cobre −2%. DXY 101,2. BTC ~83 mil. FedWatch 28/10: ~68-71% de alta.
- EUA sexta: S&P 7.743,41 (+0,51%), Dow 51.828,62 (+0,93%), Nasdaq 27.068,72 (+0,48%). Michigan final 48,1; infl. 1 ano 4,6%. Hammack: "mentalidade inflacionária pode se instalar"; Barr: "novos ajustes provavelmente necessários". Hoje S&P ~−0,7%, Nvidia +2,6% (recompra).
- China confirmou trégua até 10/01/2027; tarifa reduzida em ~US$ 30 bi de cada lado, 77 itens; soja fora (BTG).
- Ásia: Kospi −2,7% (reabertura), Xangai −1,67%, CSI 300 ~−2,2%, Nikkei −0,73%, HSI +0,54%. Europa +0,5%.
- Brasil: MP proíbe bets/cassino online (saque até 05/10; bloqueio 06/10; devolução 9-14/10; sem devolução de outorga). Desenrola 3.0: compra de ~R$ 150 bi em dívidas, deságio ~90%, custo ~R$ 15 bi, leilão novembro; impacto fiscal não detalhado.
- Focus: IPCA 26 4,99 (4,92), 27 4,31; Selic 13,50/12,00; PIB 1,86. CC ago −5,06 bi (cons. −4,9); IDP 7,40 bi. Bandeira verde em outubro.
- IPCA-15: núcleos média 0,34 (proj. 0,29); serviços 12m 5,5→6,0; intensivos em trabalho 0,56; difusão 54%.
- Pesquisas: Nexus/BTG (25-27/09) Lula 42 × Flávio 37 (1º), 46 × 44 (2º). Quaest (24-27/09) 39 × 34, 42 × 42 (fonte única Gazeta do Povo). Datafolha sexta 40 × 36.

## Níveis
| Ativo | Nível |
|---|---|
| Ibovespa | Fech. 25/09: 183.477 (−0,27%; semana −0,95%; mín. 182.151). Intraday 28/09: ~182.382 (−0,6%, mín. do mês). **COBRAR fech. 28/09.** |
| Dólar | Fech. 25/09: R$ 5,18 (−0,23%). 28/09 12h16: R$ 5,219 (+0,55%). |
| DI 25/09 | F27 13,55 · F29 13,83 · F31 13,925 (−12) · F33 13,975 (−13) (InfoMoney, fonte única). DI longo ~14% hoje (Genial). |

## 🎯 Teses das casas
- **Selic:** XP — cortes de 25 em nov e dez, 13,25% fim 2026 × BTG/Empiricus (Laí Costa) — só um corte, em DEZEMBRO, terminal 13,50; mercado converge para corte em nov + pausa. PUBLICADO.
- **IPCA 2026:** BTG/Empiricus 5,3% (set 0,83%) × XP 5,0 × Safra 4,8 × Focus 4,99. PUBLICADO.
- **Bets:** XP = risco fiscal de curto prazo (arrecadação), judicialização provável × Genial (Motta) = risco institucional/quebra de contrato, estrangeiro passa a olhar instituições; Villegas acha que Lula "só perdeu nessa". PUBLICADO (sem a opinião eleitoral).
- Genial: real e DI "bem comportados" frente ao global (esperaria 5,30); dólar acima 5,20/5,21 busca mais; Ibov no suporte, espaço para realização; debate de quinta = evento mais importante; ouro perdeu tendência (stop), minério pivô de baixa (alvo 91-92).
- XP: início de cobertura do S&P 500, preço-alvo 8.900 fim 2027 (~15,5%). Não publicado.
- BTG: Fed pode fazer mais duas altas em 2026; PCE esperado 0,3% m/m, 3,3% a/a; payroll ~90 mil; PNAD Empiricus 5,4 × mercado 5,3.
- Genial diz fluxo cambial de agosto com saída de ~US$ 5 bi de bolsa (não verificado, não publicado).

## Empresas (publicadas)
Nubank-Monzo (£ 8-10 bi, preliminar); Azzas +12,97% sexta (Farm Rio, propostas até fim de set.); Braskem OPA leilão 16/10; Axia conversão PNC 28-30/09 ou resgate R$ 55,15; Motiva AAA.br (Moody's Local); JCP Multiplan R$ 139 mi, Guararapes R$ 30 mi. Não publicadas: Unigel RJ votos limitados, Karoon corta guidance, BR Partners capital (fonte única UAI); Banrisul JCP R$ 90 mi; Lupatech? ("Lupar" dividendo 2/10 — nome incerto na legenda).

## Transcrições
✅ BTG `pl_400V2gtI` (25,9 KB) · ✅ XP `6Zywfyvc_cI` (32 KB) · ✅ Genial `1iTQMz6UNUU` (37 KB) · ❌ Spyer `0-feae3UyPs` (429 ×2) · ❌ Money Times `2hJqf4df37s` (ao vivo às 12:25).

## Próxima rodada (terça 29/9)
- COBRAR: fechamento de 28/09 (Ibov, dólar, DI, UST, Brent); AtlasIntel/Bloomberg; PNAD; resultado primário/dados fiscais; JOLTS; conversas EUA-Irã; qualquer revisão de Selic pós-IPCA-15; reação do Congresso/STF às MPs; data do decreto de contingenciamento (30/09 × "30/12" — conferir).
- AGENDA: 29/09 PNAD, AtlasIntel, JOLTS, Goolsbee, Williams · 30/09 PCE e PIB 2T final, Micron · 01/10 ISM, debate presidencial · 02/10 payroll · 04/10 1º turno · 16/10 OPA Braskem · 27-28/10 FOMC · 04/11 Copom.
- Capa: NÃO repetir petroleiro/estreito/fichas de cassino amanhã.
