# Snapshot do dia anterior — Café com Mercado

**Rodada:** 2026-10-08 (quinta), disparada 10:23 BRT (agendada 10:02). `.md` (b861cca) e capa (HEAD 2981ef5) em main. ✅ Deploy run `37784957353` (push) success; edição e capa 200. ✅ WhatsApp postado (EXITCODE=0, capa anexada, confirmado no histórico).

## 🔧 INFRAESTRUTURA
- GitHub API segue bloqueada no sandbox da nuvem (403 "GitHub access to this repository is not enabled for this session") → todo o tráfego via `device_bash` com PAT do `.env.vercel.local`; `GITHUB_PAT_COWORK` ausente no env da nuvem.
- Transcrição: 5/5 via `youtube-transcript-api` no device_bash (instalado com `pip --user` nesta rodada). OK: Spyer 7m_JGOnc_nY, Money Times 6lImlVFIRCM (Giro gravado na quarta à tarde, não é call de hoje), BTG 5DMeBksefgA, XP ZxcLp1U2fU8, Genial OWy6n93rlJk (fechada ~09:37, legenda pronta às 10:25).
- compose-capa.py do repo baixado no device para `Enviador de Noticias\_capa\` e staged para a nuvem (pasta `_capa` fica como scratch; .md e .jpg do dia também lá). md5 da capa conferido idêntico nuvem↔PC desta vez.
- Capa: Higgsfield `cinematic_studio_2_5`, jobs `8cefc051` (escolhida; letterbox de 184 px no topo recortado → 2752×1352) e `690f26c1` (descartada: moldura no topo). Manchete "PETRÓLEO DISPARA, ELEIÇÃO SEGURA" (2 linhas), sub "Flávio com 53% na PoderData; Brent a US$ 105". Elementos: míssil sobre aeroporto no deserto, tanques de petróleo em chamas, urna de madeira com fita verde-amarela, barris, silhuetas de costas.
- Blob do painel não consultado (sem caminhos válidos conhecidos).

## 📌 NARRATIVA (8/10) — PETRÓLEO + JURO LONGO LÁ FORA; TRADE ELEITORAL SEGURA
- 07/10 fechamento: Ibov 204.302,33 (−0,74%; máx 206.877; vol R$ 56,8 bi); dólar R$ 5,011 (+0,70%; Forbes R$ 5,0156); DI F27 13,441, F29 12,435, F31 12,600. Altas MGLU3 +5,1, TEND3 +4,9, CURY3 +4,8, MBRF3 +4,1, SAPR +9 (BTG); baixas NATU3 −9,0 (relatório riscos climáticos), EMBJ3 −5,1, HAPV3 −4,6, ASAI3 −4,4, BBDC4 −3,7. Fluxo estrangeiro 05/10 R$ 10,1 bi (maior desde 2008, BTG); outubro até 06/10 +R$ 12,61 bi.
- 08/10 ~10h10: Ibov ~204,8 mil (+0,25%); dólar ~R$ 5,015.
- Global: S&P 07/10 7.801,77 (−0,22%), Nasdaq 27.538,69, Dow 51.179,87; futuros −0,5 a −0,9; UST10 5,33-5,35 (5,36 intradia 07/10, máx desde 2002), UST30 5,66 (5,73 máx desde 2002); leilão 10a forte (5,300% vs 5,317%, 2,77x); DXY 102,4; EUR 1,118 (mín 17 meses); JPY 158,2; Brent ~105 (+5%), WTI ~92,6; ouro ~4.130; prata −2%; BTC ~82,5 mil; Nikkei −1,4, Kospi −2,6, HSI −1,4, CSI 300 −1, DAX −1,1, CAC −1. OAT-Bund 134 pb. Jobless claims 197 mil. Fed: ~19% alta out, ~80% dez; Waller: altas não precisam ser consecutivas.
- Petróleo: Casa Branca pediu opções de ataque ao Irã antes das midterms (Axios/Atlantic); Houthis míssil contra aeroporto de Riad; tempestade Isaías −500 mil b/d no Golfo do México.
- BR dados: produção industrial regional ago média −0,6% m/m, −1,2% a/a; Anfavea set emplacamentos 281,4 mil (maior desde dez/14). IPCA-15 set 0,70%. Focus: Selic 13,50% fim 26, 12% fim 27.
- Política: PoderData/Aya 53×47 Flávio (válidos; quem vence 54×37); Datafolha após o fechamento de 08/10. Republicanos oficializou 07/10; União, PP, Novo também. Trevisan (assessor de Flávio, ex-Itaú BBA) propõe corte de gastos antes da posse; ajuste fiscal citado em R$ 250 bi (Folha/Valor). PEC 6x1 está no SENADO (PEC 221/2019, já aprovada na Câmara em maio): Alcolumbre prevê 1º turno na semana de 12/10 (fonte cita 15/10).
- Empresas: GPA homologação RE (risco R$ 17 bi fora); BlackRock 10,08% de B3; leilão ANP pré-sal 7/13 blocos, R$ 503 mi (Petrobras, PRIO, Equinor 2 cada); Eneva 6 blocos Parnaíba; Cade aprova US$ 100 mi da American na Azul; Brava ~83 mil boe/d set; RECV ~23,5 mil boe/d.

## 🎯 Teses das casas
- **Genial (Motta, Villegas):** Brasil é "jogo de juros": NTN-B longa (~6,6-6,7%, vê 5% com 200-250 pb de corte) e small caps (SMAL +12% em 3 dias vs Ibov ~6%); sem trade eleitoral Ibov estaria em 165 mil e dólar R$ 5,30-5,50; bancos estrangeiros tratam Brasil como África do Sul/Colômbia; JPM overweight real. Villegas: reduzir alavancagem em tech EUA antes da temporada.
- **XP (Raquel Sá, Rodolfo Margato) — Macro Mensal out:** câmbio R$ 5,00 fim 26 com viés de baixa; PIB 1,7% (26) e 1% (27), sem recessão; Selic 13,25% fim 26, 11,5% jun/27 (pode ser menor com fiscal crível); IPCA 27 4,4%, risco petróleo (premissa Brent 85 → 75); "lua de mel do IPCA acabou".
- **BTG (Luiz Mollo + host):** correção de 2-3 pregões saudável; suportes 199.500 e 190.283 (MM21); S&P resistência 8.060, suporte 7.620; Brent resistência 109-115; financeiras: −100 pb custo de capital = +16% preço-alvo (B3 destaque); Gerdau alta convicção; macro BTG vê +3 altas do Fed até meados de 27.
- **Spyer:** PoderData 53×47; Trevisan corte de gastos; preocupação com 6x1 acelerada no Senado; minério −3% na volta da China.
- **GT Capital (Josias Bento, no Money Times de 07/10):** Ibov ~210 mil até fim de 26; gringo realiza nas blue chips.

## Próxima rodada (sexta 9/10)
- Datafolha 2º turno (saiu na noite de 08/10?); IPCA setembro (09/10, 09h; IPCA-15 0,70%, BC projetava 0,65%); leilão 30a EUA resultado; Kashkari/Musalem; fluxo estrangeiro 06-07/10; Brent/Irã; Michigan; AtlasIntel.
- AGENDA: 09/10 IPCA, Michigan · 12/10 feriado BR · 13/10 JPM, GS, WFC, Citi · 14/10 vencimento de índice, BofA, MS · 15/10 TSMC; PEC 6x1 Senado semana de 12/10 · 16/10 OPA Braskem · 25/10 2º turno · 27-28/10 FOMC · 03-04/11 Copom.
- Capa: NÃO repetir míssil/aeroporto no deserto/tanques em chamas/urna com fita/barris; nem petroleiro, navio de guerra, Torre Eiffel, bandeira em mastro, Congresso, telas verdes, relógio, plataforma, touro, multidão, cédulas.
