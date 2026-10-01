# Snapshot do dia anterior — Café com Mercado

**Rodada:** 2026-10-01 (quinta), disparada 10:19 BRT (agendada 10:02). Publicada ~10:32 BRT. ✅ Deploy `success` na run do push `36869099094` (commit 3ab33d4). ✅ WhatsApp `EXITCODE=0`, capa anexada, confirmado no histórico (messageId `..._3EB005E179E0211351D592_...`). 4 calls de hoje transcritos (BTG, Genial, XP, Spyer); Money Times era giro de fechamento de setembro.

## 🔧 INFRAESTRUTURA
- GitHub API segue bloqueada no sandbox da nuvem (403) → tráfego GitHub via `device_bash` com PAT. Arquivos levados ao PC por `device_commit_files` em `Enviador de Noticias\_edicao_hoje.md` / `_capa_hoje.jpg`.
- yt-dlp na nuvem: bot check (cookies) em 3 de 5. No device_bash: 429 em Spyer e Money Times (2 tentativas); resolvido com `youtube-transcript-api` no device.
- `compose-capa.py` local difere do main só por CRLF.
- Blob: Nikkei 68.957 (+3,30%), Kospi +1,95%, EWZ 30/09 +2,14%.
- Capa: Higgsfield `cinematic_studio_2_5`, jobs `02abeb71` (escolhida) e `04dadacf` (descartada). As duas vieram com moldura no topo → recortei 200 px e centralizei 16:9 (2375×1336); texto "GOVERNMENT BOND" no prop apagado com inpaint (OpenCV). Manchete "TREASURY NA MÁXIMA DESDE 2002", sub "Brent volta a US$ 100 e DXY bate 102". Elementos: telas com curva vermelha subindo, operador de costas, títulos em chamas, refinaria, porto com guindastes.

## 📌 NARRATIVA (1/10) — JUROS LONGOS GLOBAIS + PETRÓLEO + ELEIÇÃO
- Qua 30/09 EUA: S&P 7.651,54 (−0,25%), Dow 50.906,05 (−0,9%), Nasdaq 26.861,06 (+0,2%). Setembro: S&P −0,4%, Nasdaq +1,9%, Dow −4,3%; 3T S&P +2,0%. UST 10a fech. 5,29% (máx. desde 2002, NÃO 2007), hoje tocou 5,33-5,36; 30a 5,64-5,67; gilt 30a 6% (máx. 1998). FedWatch alta 28/10: ~35-37% (de ~70% na semana passada). Goldman empurrou alta para dezembro. Fed funds 3,75-4,00% (alta em setembro). Presidente do Fed: Kevin Warsh.
- Qui 1/10: jobless claims 197 mil (esp. 201). PMI ind. zona do euro 52,9 (máx. 52 meses), Alemanha 53,9, França 50,6. Tankan grandes ind. +24. DXY 102 (máx. 17 meses); USD/JPY 158-159. PetroChina cancelou embarques de gasolina/QAV de outubro → Brent dez ~US$ 100,5 (+2,5%); Brent nov venceu 30/09 a 103,53, dez fechou 98,03. Ouro ~4.210 (setembro −6,2%). Micron forte (receita 1T guia 61,5 bi). Trump: "certo nível de inflação ajuda a pagar a dívida". Kashkari hawkish. China fechada (feriado). Payroll amanhã: consenso +90 mil, 4,1%.
- Irã: Rubio expulsou delegação iraniana na ONU; Trump admite intensificar ataques pós-midterms; 3 petroleiros atingidos em Ormuz 30/09; EUA avaliam proibir exportação de diesel por 90 dias.
- Brasil: PMI ind. S&P set 44,8 (de 46,3). IPP ago +0,36% (12m 2,53%) — publicado hoje. Confiança empresarial FGV 89,3 (−1,2). China tarifa adicional 55% carne bovina BR a partir de 1/10. Fux admitiu Flamengo na ação contra MP das bets. Avalanche (PRTB) desistiu.
- Pesquisas: Quaest 39×34, 2º 42×42; AtlasIntel 45,3×42,2, 2º Flávio 47,7×47,6; Datafolha 24/09 40×36, 2º 47×45 — NOVO Datafolha hoje 19h. Debate Globo 21h30: Flávio confirmado (Spyer/Genial), Lula vai a podcast (Flow). Polymarket 62×37 pró-Flávio (Genial, NÃO publicado).

## Níveis
| Ativo | Nível |
|---|---|
| Ibovespa | Fech. 30/09: 186.340 (+1,37%). Setembro +5,0-5,3% (fontes divergem); 3T +8,3%; ano ~+15%. Abertura 1/10 ~186.871. **COBRAR fech. 1/10.** |
| Dólar | Fech. 30/09: R$ 5,172-5,174 (−0,81%). ~R$ 5,18-5,19 na manhã de 1/10. |
| DI 30/09 | F27 13,555 · F29 13,79 · F31 13,96. Set: F29 −40 pb, F31 −50 pb. |

## 🎯 Teses das casas
- **Genial (Motta):** sem trade eleitoral, real estaria acima de 5,30; fim do regime de dólar fraco deixa Brasil vulnerável (déficit nominal ~9% PIB, despesa +6% real). Juro longo para quem aposta em alternância. Villegas: lista de 18 não financeiras sensíveis à queda da Selic; carteiras de outubro favorecem receita dolarizada, saíram do ouro, reintroduziram cripto. PUBLICADO.
- **BTG (Luiz Molo, intl):** PCE → Fed em outubro fora; vê alta só em dezembro; fechamento da curva americana com fim do conflito; S&P a 19x lucro; assimetria positiva em Treasuries/TIPS. Neoenergia incorporou 7 ativos de transmissão (R$ 2,4 bi, com GIC). PUBLICADO.
- **XP (Raquel Sá):** tema do dia FIIs ("preço de ficar de fora"); micro × macro; suporte técnico 180.800, resistência 189.500 (InfoMoney, matéria anterior).

## Empresas (publicadas)
Bradesco JCP R$ 3,8 bi; Vale panda bonds 3,5 bi yuans (não aprovado); Petrobras subvenção R$ 1,03 bi; Iguatemi venda de 5 shoppings ao TRXF11; Neoenergia transmissão R$ 2,4 bi; Sigma Lithium interdição ANM; Tecnisa grupamento 10:1; CPFL alvos BBA 52,50 / BBI 53; Embraer AGE 30/10 (GPX). Não publicadas (incertas): "Açaí" Cade 12% ON; "Evin" rating S&P AA+→AA; Simpar/JSL troca de CFO/DRI; PSEC11×RBRX11; Sabesp debêntures R$ 400 mi.

## Transcrições
✅ BTG `wAw4oCP1A3s` (27 KB) · ✅ Genial `xfnvQbbk2Ns` (45,8 KB; legenda pronta às 10:25) · ✅ XP `e5hhIMQTDes` (31 KB) · ✅ Spyer `cHiXTIYZwK8` (2 KB; 429 no yt-dlp, ok via youtube-transcript-api) · ⚠️ Money Times `kCBOMX0Xqgk` (33,5 KB; via transcript-api) é giro de fechamento de setembro, não call de hoje — só contexto.

## Próxima rodada (sexta 2/10)
- COBRAR: fech. 1/10 (Ibov, dólar, DI, UST, Brent); ISM industrial; falas Fed (Waller, Williams/Cook, Logan); Datafolha e demais pesquisas da noite; repercussão do debate; Nike; payroll 9h30 BRT (consenso +90 mil, 4,1%, salário 3,1% a/a); produção industrial BR (ago).
- AGENDA: 02/10 payroll, produção industrial · 04/10 1º turno e Opep+ · 16/10 OPA Braskem · 27-28/10 FOMC · 03-04/11 Copom.
- Capa: NÃO repetir telas com curva vermelha + títulos em chamas + operador de costas.
