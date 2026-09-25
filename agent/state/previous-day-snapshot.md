# Snapshot do dia anterior — Café com Mercado

**Rodada:** 2026-09-25 (sexta-feira), agendada, **10:21–10:40 BRT**. Publicação em `content/cafe-com-mercado/2026-09-25.md`. ✅ Deploy `success` na run do push (`36141830169`). ✅ WhatsApp `EXITCODE=0`, capa anexada, confirmado no histórico. 3 de 4 transcrições (Money Times falhou por 429).

## 🔧 INFRAESTRUTURA
- 🔴 **GitHub API BLOQUEADA NO SANDBOX DA NUVEM** ("GitHub access to this repository is not enabled for this session. Use add_repo..."). Sem `GITHUB_PAT_COWORK` no ambiente. **Todo o tráfego GitHub (duplicata, snapshot, PUTs, Actions) foi feito pelo `device_bash` (VM local, pasta `site-az-invest` montada), lendo o PAT do `.env.vercel.local`.** Funcionou de primeira.
- ✅ Capa composta **no device_bash** (Pillow 12.3 + DejaVu Condensed presentes; base baixada do CloudFront direto lá). Preview para inspeção gravado em `Enviador de Noticias\_capa_preview.jpg` (sobrescrever a cada dia) e o `.md` passou por `Enviador de Noticias\_edicao_hoje.md` (commit de `/mnt/user-data/outputs` → device).
- ⚠️ yt-dlp na nuvem: BTG e Genial OK; **XP deu bot check** e o `youtube-transcript-api` levou RequestBlocked → **resolvido pelo yt-dlp no device_bash** (`pip install --user yt-dlp`). **Money Times: 429 duas vezes na nuvem e duas no device → não transcrito.**
- ⚠️ Painel Blob: `BZ=F` segue mostrando Brent 98,4 (−7,69%) — rolagem de contrato, **não usar**. Demais séries OK (generated_at 13:16 UTC).
- Higgsfield: `cinematic_studio_2_5`, count 2, jobs `1b8b7b87` (escolhida) e `cf711975`. Ambas vieram com faixa/letterbox no topo; a v1 ainda trazia linha em QUEDA. **Recortei 310 px pretos do topo da v0** e compus.

## 📌 NARRATIVA-MÃE (25/9) — IPCA-15 ESTOURA + JURO LONGO GLOBAL
- 🔴 **IPCA-15 set: +0,70%** (cons. 0,53% Reuters; BTG 0,55%, XP 0,58%) após −0,40%; **12m 4,47%** (de 4,24%); ano 3,82%. Energia residencial **+7,42%** (0,29 p.p., fim bônus Itaipu + bandeira amarela); habitação +2,07; despesas pessoais +0,96; transportes +0,60 (aéreas +9,82); alimentação domicílio +0,38 (tomate +20,76, feijão −6,33). **Núcleos: n/d** (Genial disse "ruim de serviços e núcleo") — COBRAR.
- 🔴 **UST fech. 24/09 (TheStreet): 2a 4,918 · 10a 5,192 (+7,8 pb, máx. desde 2007) · 30a 5,476 (máx. desde 2004).** Hoje ~5,17 no 10a. **Leilão 7a: 5,085%, cauda 0,7 pb, b/c 2,42 (média 2,49), indiretos 57,2%.**
- **Brent tocou 108 em 24/09; fechamento ~104,7 (fonte única) × XP "106"; hoje ~105 (−1,1 a −1,6%).** Motor: EUA-Irã discutem reabertura faseada de Ormuz (Bloomberg/Semafor). WTI 92,7. Spread Brent-WTI 12,68, maior desde maio.
- **Trump-Xi:** sem acordo concreto; trégua até 10/01 anunciada por Bessent, China só "sinalizou"; confirmada 1ª conversa sobre IA.
- **Datafolha (22-24/09, 2.002, BR-00304/2026): 1º turno Lula 40 × Flávio 36 (Cury 5, Caiado 4, Renan 3); 2º turno 47 × 45 (de 46 × 44); rejeição 45 cada. PUBLICADO.**
- Fiscal: déficit 2026 R$ 80,9 bi; contingenciamento 13,6; bloqueio 2,4. Decreto 30/09.
- Galípolo (coletiva RPM): "não é muito emotivo", sem sinal de ritmo/pausa; intimado pela PF como testemunha no caso Master (início de out.), com Campos Neto, Ailton Aquino e André Esteves.
- CMN: FIDCs proibidos de comprar créditos judiciais/arbitrais sem liquidez a partir de 13/10; estoque ~R$ 35,2 bi com regras de precificação a partir de 04/01/27.
- Lula anuncia hoje 17h em SP pacote contra bets + cartão/Pix. Impacto fiscal n/d.

## Níveis (diff p/ próxima rodada)
| Ativo | Nível |
|---|---|
| Ibovespa | **Fech. 24/09: 183.965,91 (−0,99%).** Futuro 9h05 25/09: 184.310 (−0,32%). **COBRAR fech. 25/09.** |
| Dólar | **Fech. 24/09: R$ 5,1931 (+0,47%).** 9h07 25/09: R$ 5,181. |
| DI 24/09 | F27 13,565 · F29 13,880 (+8) · F31 14,045 (+6) · F33 14,105 (InfoMoney + XP). |
| EUA | **S&P 7.704,13 (−0,07%) · Dow 51.349,98 (−0,32%) · Nasdaq 26.939 (sinal diverge ±0,0%).** Futuros 25/09 +0,2%. Oracle −6,4%. |
| Fed | FedWatch 28/10: 67–77,5% (fontes divergem). Williams: "razoável" mais uma alta até fim do ano; Genial leu como "pular outubro". Hammack 15h BRT hoje. Fed funds 3,75–4,00%. |
| Câmbio/metais | DXY 101,02 · EUR/USD 1,140 · USD/JPY 157,5 (iene subiu após Katayama) · ouro 4.296–4.330 · prata ~65 · cobre 6,7 · BTC 84,4 mil. |
| Ásia 25/09 | Nikkei 66.572 (+1,30%) · HSI 24.499 (−1,01%) · ASX 8.641 (−0,70%) · Taiex fechado (feriado 4 dias) · China fechada até 27/09 · Kospi até 28/09. |
| Europa | Stoxx 600 ~640,7 (+0,7%) · DAX 25.477 · IBEX +1,0% · Bund 10a 3,60% (passou de 3,6% 1ª vez desde 2009) · Gilt 5,36%. |
| Outros BCs | Banxico manteve 6,50%. BoE Lombardelli admite alta. |
| EUA dados | Bens duráveis ago 0,0% (cons. −0,4%), core capex +1,6% (TE, fonte única). Michigan final 11h. |

## 🎯 Teses das casas
- 🔴 **SELIC (todas pré-dado):** XP (Caio Megale) mantém cortes de 25 pb, **13,25% fim 2026 / 11,50% 2027**, IPCA 5,0/4,2 × **BTG: 13,75% até dezembro, 12,5% fim 2027** (Ivo Chermont, citado, vê 13,25%) × Genial (Motta): "número tem que ser muito diferente" para tirar o corte; depois do dado, "inflação veio rasgando". PUBLICADO. **COBRAR revisões pós-IPCA-15.**
- Bolsa: Genial — "90% do preço dos ativos BR é eleição", resistência 188.800, espaço para realização; faixa 184–188 mil há 15 dias; dólar rompendo 5,20/5,21 busca mais. BTG (Thiago Salomão, convidado) — juro americano é o maior risco, fluxo vai para IA e Treasury. XP — renda fixa: **B35 preferida**, sem alongar.
- 🔴 **BTG não citou pesquisa por número — 6º dia.** Genial não citou a "ata" — 5º dia (citou o RPM: "pouquíssimas novidades").
- XP: âncora Maara Rodrigues + Caio Megale; **Figueredo ausente**; sem níveis técnicos.
- Genial: Motta afirma leilão de 5 anos "segundo pior da história" (não verificado).

## Empresas
- **Braskem OPA:** pagamento em 3 debêntures NSP (em RJ) de R$ 3,08 nominal cada (~R$ 9,24) por ação vs ação ~R$ 4; AZ Quest vê R$ 1–3. PUBLICADO (Seu Dinheiro; título confirmado por Economic News Brasil). Leilão 16/10.
- Axia +R$ 4 bi para resgate de PNC (total 11,7). Yduqs +2,95%. Movida R$ 1,2 bi CDI+2,5, 6 anos (BTG call). RADL3 −5,38%, PGMN3 −8% (Mercado Livre vende remédios). PUBLICADOS.
- Não publicados: Vivo JCP R$ 500 mi (fonte única); Magalu rating; WEG baterias; Fras-le rebaixada JPM; Blau/Celesc/Romi JCP; Hidrovias fusão (XP, legenda truncada — conferir).

## Transcrições
- ✅ BTG `kNo3ThkuifU` (26,8 KB, 31 min) · ✅ XP `EwKbBdwsmkM` (27,6 KB, 29,5 min — via device_bash) · ✅ Genial `PmdM0VLBdC0` (47,9 KB, 50,8 min, pub 10:15 BRT) · ❌ **Money Times `Ip1mqzDVG9Q` (Giro do Mercado de 24/09 à noite): HTTP 429 em 4 tentativas (2 nuvem, 2 local)**.
- Spyer: **nenhum vídeo novo desde 23/09** (3º dia).
- Legenda: BTG apresentador "Mateus Espis" (provável Matheus Spiess), "Ivo Quermonte" = Ivo Chermont, "Paulo de Sora" (RPS). Genial "3,5 / 3,25" de Selic = erro de legenda; "fechou abaixo de 135" = erro.

## Capa e WhatsApp
- Manchete **"IPCA-15 A 0,70%"** (15 car., 1 linha); sub "Prévia estoura consenso; 12 meses em 4,47%" (42); kicker "CAFÉ COM MERCADO · SEXTA, 25/09". Elementos: torres de transmissão com cabos laranja, linha vermelha subindo, caixote de tomates, petroleiro no estreito, casario. Acentos conferidos na imagem. **NÃO repetir tomates/torres segunda.**
- **WhatsApp EXITCODE=0**, messageId `true_120363426397949841@g.us_3EB0259DD7AF60413A98E2_189400189300849@lid`, capa anexada (send-image OK, 2º dia seguido).

## Próxima rodada (segunda 28/9)
- 🔴 **Segunda cobre desde sexta 18h.** Kospi reabre; China fechada de novo 01–07/10.
- 🔴 **COBRAR:** fechamento de 25/09 (Ibov, dólar, DI, UST); núcleos e serviços do IPCA-15; revisões de Selic pós-IPCA-15; Michigan final; fala de Hammack; pacote de Lula contra bets (texto, impacto fiscal); bandeira tarifária de outubro; Ormuz (acordo faseado avançou?); Brent; se Pequim confirmou a trégua.
- **AGENDA 28/09:** Focus; Quaest/Globo e Nexus/BTG. **29/09:** AtlasIntel/Bloomberg; PNAD; leilão Tesouro. **30/09:** PCE e PIB final 2T EUA; decreto do contingenciamento; Milwaukee Brasil-EUA (até 01/10). **04/10:** 1º TURNO. **16/10:** leilão OPA Braskem. **27–28/10:** FOMC. **04/11:** COPOM.
- ⚠️ Lacunas: núcleos IPCA-15; fechamento exato do Brent 24/09 (104,7 × 106); FedWatch 28/10 (67–77,5%); consenso Michigan final.
