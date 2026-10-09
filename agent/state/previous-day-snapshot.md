# Snapshot do dia anterior — Café com Mercado

**Rodada:** 2026-10-09 (sexta), disparada 10:25 BRT (agendada 10:02). `.md` e capa em main (HEAD 2376dc4). ✅ Deploy run `37937665158` (push) success; edição e capa 200. ✅ WhatsApp postado (EXITCODE=0, capa anexada, confirmado no histórico).

## 🔧 INFRAESTRUTURA
- GitHub API segue bloqueada no sandbox da nuvem (403 "GitHub access to this repository is not enabled for this session") → todo tráfego GitHub via `device_bash` com PAT do `.env.vercel.local`.
- Transcrição: 5/5 via `youtube-transcript-api` no device_bash (`pip --user`). Spyer vTPP0B8BPdA (Minuto), Money Times G7FwaezyUK8 (Giro gravado na quinta à tarde, não é call de hoje), BTG JvdKMlDA2A0 (Spis + Thiago Salomão), XP 010xHML8sPs (análise técnica, Marcos Gonçalves + Alex), Genial btmmlO9zQZ8 (fechada ~09:56 BRT, legenda pronta às 10:30).
- Device tem PIL 12.3 — dá para compor a capa no próprio PC; nesta rodada compus na nuvem (script staged de `Enviador de Noticias\_capa\`) e commitei o .jpg de volta.
- Capa: Higgsfield `cinematic_studio_2_5`, jobs `6200f08b` (escolhida; faixa/letterbox de 212 px no topo recortada → 2752×1324) e `dac06668` (descartada: toldo/faixa física no topo). Manchete "INFLAÇÃO SOBE, BOLSA IGNORA" (2 linhas), sub "IPCA de 0,82% e Flávio à frente no Datafolha". Elementos: caixote de tomates e cebolas, torres de alta tensão em pôr do sol alaranjado, bico de bomba de combustível pingando, figura de costas entrando em cabine de votação com cortina verde-amarela.
- Blob do painel não consultado.

## 📌 NARRATIVA (9/10) — IPCA ACIMA, MERCADO SEGUE A ELEIÇÃO; PETRÓLEO ALIVIA
- 08/10 fechamento: Ibov 206.220 (+0,94%; máx 207.954; vol R$ 60,6 bi); dólar R$ 5,024 (+0,27%); DI F27 13,451, F29 12,320 (−11,5), F31 12,420 (−18). PETR4 +2,1, VALE3 −1,6 (minério mín 18 meses). Altas AZZA3 +7,7, ASAI3 +7,4, VAMO3 +7,3; baixas BEEF3 −3,9, TEND3 −2,5, CURY3 −2,5. Fluxo estrangeiro quarta 07/10: saída R$ 627 mi (Genial).
- 09/10 ~10h15: Ibov 208.725 (+1,21%); dólar ~R$ 5,00.
- IPCA set: 0,82% (cons. 0,73%; BTG 0,78%); 12m 4,58% (de 4,22%); ano 3,95%. Habitação +2,31% (energia +7,98%, 0,32 p.p., fim bônus Itaipu + bandeira amarela); alimentação +0,83% (domicílio +0,96%; tomate +37,8%); transportes +0,89% (combustíveis +1,41%, aéreas +9,66%). Núcleos 0,36% só na BPMoney — NÃO publicado (não verificado). Selic 13,75%; corte de 25 pb a 13,50% em 03-04/11 segue cenário central.
- Global: S&P 08/10 7.765 (−0,5%), Nasdaq 27.193 (−1,3%, OpenAI receita anualizada ~US$ 50 bi < 68 esperado), Dow 51.232; futuros +0,35/+0,74 (OpenAI projeta US$ 70 bi fim do ano). UST10 5,23-5,25 (5,35 intradia), UST30 5,60; leilão 30a 5,618% (máx desde 2000), 2,54x. DXY 102,06; EUR 1,121; JPY 158,3; Brent 103 (−1,2%) após +4,1% a 104,28; WTI ~91; ouro ~4.190 (+1,3%); prata +2%; cobre +1,8%; BTC ~82,4 mil. HSI +1,8; Xangai flat (volta Golden Week); Kospi fechado; Europa ~+1%.
- Fed: Musalem — altas nos próximos 6-9 meses; Waller — mais altas prováveis, pausa em out possível; CME ~19% alta out. BCE ata com viés de alta; França orçamento 2027 travado.
- Petróleo: Trump — não ataca o Irã antes das midterms, bloqueio mantido; Bessent sanciona 17 navios; Irã avalia resposta sobre Hormuz.
- Política: Datafolha 49×45 totais / 52×48 válidos; AtlasIntel 51,1×45,7 / 52,8×47,2; PoderData 53×47. Cury (3º lugar) apoia Flávio (+Caiado, Zema). Veja: Vorcaro teria dado dinheiro por fora ao filme de Lula (PT nega) — NÃO usado na edição. Quaest 12/10. Debate Globo 23/10. PEC 6x1: 3ª de 5 sessões de discussão no Senado em 08/10.
- Empresas: Minerva avalia fechar capital; BlackRock >5% Copasa e Metalúrgica Gerdau; Sabesp incorpora EMAE fim do mês; Azzas 2 conselheiros renunciam (cisão); Priner aumento capital R$ 220 mi; Camil lucro R$ 41,3 mi (acima); prévias MRV/Cury/Tenda fortes, Moura Dubeux vendas −21,5%.

## 🎯 Teses das casas
- **Genial (Motta, Villegas):** "jogo de juros"; comprou debênture Petrobras 2034 IPCA+6,2 isenta (spread privado vs público nas máximas); NTN-B 30a a 5,5 com teto de gastos; curva 1 ano 11,8; small caps melhor semana desde 2008; tese condicionada a nomes da equipe econômica (Mansueto etc.) com "carta branca". Villegas: Ibov/small caps com assimetria semanal negativa — ser seletivo; Brent suporte 84, WTI 80; euro suporte 1,10; dólar suporte R$ 4,90, resistência 5,05; vencimento de índice quarta, risco de short squeeze.
- **BTG (Spis, Salomão):** cautela — nenhum candidato fala de ajuste profundo; mercado em "follow the money"; muito prêmio a queimar nos longos; Selic "céu de brigadeiro" 9-10%; IPCA não impede corte.
- **XP (análise técnica):** Ibov projetado ~230 mil; preferência small caps (varejo, ASAI3, MDNE3); BBAS3 suporte R$ 18, alvo 27,60/28,30; dólar em range.
- **Spyer:** Datafolha e Atlas, apoio de Cury a Flávio; Selic 13,50 em 04/11.

## Próxima rodada (terça 13/10 — segunda 12/10 é feriado BR, sem pregão)
- Cobrir desde sexta 18h: Quaest 2º turno (12/10); Michigan prelim. out (09/10); fechamento de sexta; Brent/Irã/Hormuz; Focus de 13/10; balanços bancos EUA 13/10; vencimento de índice 14/10.
- AGENDA: 13/10 JPM, GS, WFC, Citi · 14/10 vencimento de índice, BofA, MS · 15/10 TSMC · 16/10 OPA Braskem · 23/10 debate Globo · 25/10 2º turno · 27-28/10 FOMC · 03-04/11 Copom.
- Capa: NÃO repetir tomates/caixote, torres de alta tensão, bico de bomba, cabine de votação com cortina; nem míssil, aeroporto, tanques em chamas, urna, barris, petroleiro, navio de guerra, Torre Eiffel, bandeira em mastro, Congresso, telas verdes, relógio, plataforma, touro, multidão, cédulas.
