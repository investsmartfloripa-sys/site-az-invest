# Snapshot do dia anterior — Café com Mercado

**Rodada:** 2026-11-09 (segunda). Disparou 10:09 BRT; publicado ~10:19 BRT (frontmatter diz 10:45 por erro de estimativa — .md é paths-ignore, não vale rebuild só por isso). `.md` + capa commitados (HEAD capa 50a34a8). Deploy run `42624155665` (push) success; página e capa 200. ✅ WhatsApp postado (EXITCODE=0, capa anexada, confirmado 10:19:57).

## 🔧 INFRAESTRUTURA
- Nuvem segue sem GITHUB_PAT_COWORK e o proxy da nuvem bloqueia o repo (403 "GitHub access to this repository is not enabled for this session"). GitHub todo via device_bash + PAT do .env.vercel.local.
- Pasta `Agentes AZ` não montada no device_bash; painel do Blob não consultado. _post_hoje.txt via Desktop Commander write_file (exige mode rewrite explícito).
- Transcrição: yt-dlp na nuvem = bot check. Windows yta2.py (%TEMP%\aztranscripts, args: prefixo-data + IDs) às ~10:15 pegou tudo: Spyer VKgvWTPIraY, BTG 0uRAWhsYjZE (Mateus Spiess + Lorena Laudares), XP o3xuV2M7sDY (Rafael Figueiredo + Alexandre Maluf), Genial U5D0ouc-TQQ (Villegas + Roberto Motta) — Genial já pronta às 10:15. Money Times NHNtPcMv_nc = placeholder de live futura ("This live event will begin"), sem call hoje.
- Capa: Higgsfield cinematic_studio_2_5 job 9a402b3b (figura de sobretudo de costas com chip verde em viela; câmera de TV diante de mesa vazia com microfone e bandeira BR; petróleo escorrendo de cano no concreto). Faixa/letterbox até y≈316 → recortado em y=320 + centro 16:9. Variante 5de0e650 descartada (tríptico + faixa). Manchete "LULA PROMETE, FOCUS TRAVA SELIC" (2 linhas), sub "Payroll forte e Nvidia em xeque lá fora". Compose na VM device_bash.

## 📌 NARRATIVA
- Sex 06/11 NY: S&P 7.376,86 (+0,31%), Nasdaq +1,09%, Dow 51.285,73 (−0,46%); semana S&P −2,7% (pior desde abr/25). AMD +11%, Intel +7,7%, NVDA +2,8%. VIX 24,2.
- Payroll out: 165 mil (cons. ~60–65 mil), desemprego 4,1%, AHE +0,4% m/m e 3,1% a/a; revisões +84 mil (set 29→60, ago 133→186). Michigan prévia nov 51,0; infl. 1 ano 4,3%. FedWatch alta 09/12 ~77–80%. Faixa 3,75–4,00%.
- Seg 09/11: futuros +0,4 a +0,7%; NVDA −5% pré (investigação do conselho sobre Jensen Huang, relato de espiã chinesa). Nikkei +2,3%, Taiex +4,9%, Kospi −0,8%. UST 2a 4,51%, 10a 4,86%, 30a 5,26% (fech. sexta). DXY ~101,8. Brent ~US$ 96 (−1,8% a −3%; −16% semana passada), WTI ~89. Ouro ~4.120, prata 52,7, cobre +1,6%, BTC ~74 mil. China PPI out +5,7%, CPI 0,7%.
- BR sex: Ibov 168.498,45 (+1,39%; semana +0,34%); dólar 5,508 (+0,36%; Reuters 5,5115); DI F27 13,662, F29 14,665, F31 14,90. CSNA3 ~+9% (venda CSN Cimentos à Huaxin R$ 12,7 bi). Balança out +US$ 9,32 bi. IGP-DI out +1,15%.
- Lula pronunciamento 08/11: "preservando as regras fiscais", "criar condições para reduzir juros", investimento >20% PIB; anúncios de gastos; sem ajuste. Focus 09/11: Selic 2026 13,75% (de 13,50), 2027 12,50; IPCA 26 5,22, 27 4,90; PIB 27 1,15. Selic atual 13,75 (Copom 04/11 manteve).
- Fazenda: nomes Fonteles, Durigan, Alckmin; anúncio após volta de Lula ~15–16/11. Medidas Durigan (Valor): +20% base contingenciável, pisos saúde/educação, tributar isentos.

## 🎯 Teses das casas
- **BTG (Laudares):** sinais "necessários, não suficientes"; Selic 13,75% todo 2027; IPCA 27 5,9%, PIB 27 0,6%; nomes cotados neutros/positivos, risco seria ala desenvolvimentista; medidas Durigan não são corte efetivo; grade de parâmetros do Orçamento importa.
- **XP (Maluf):** IPCA 27 mais alto (câmbio 5,50 fim 27), PIB 27 0,3%, Selic 13,75% todo 27; temporada fraca (37% acima em lucro).
- **Genial (Motta/Villegas):** sem benefício da dúvida; estrangeiro −R$ 1,7 bi qui; dívida encurtando; risco recessão 2027 e reação fiscal; técnico Ibov alvo 180 mil, stop 164,4 mil; rebaixou Alpargatas.
- **Bradesco BBI:** bolsa barata pode ser armadilha de valor (custo de capital).
- **Spyer:** "não adianta só prometer".

## Próxima rodada (terça 10/11)
- Ata do Copom (8h) e CPI EUA out (10h30; consenso 0,3%/0,2%, sem a/a). Falas Waller/Bowman.
- Fechamento de segunda (Ibov, dólar, S&P; Nvidia). Balanços de segunda à noite: Magalu, JBS, Itaúsa, TIM, Brava, Caixa Seg., Copasa, Direcional. Terça: Petrobras, BTG, Embraer (após fechamento).
- Roadshow IPO Tropic. Lula na COP31 (Turquia). IPCA out qui 12/11 9h (proj. 0,29%).
- Capa: evitar também figura de sobretudo/chapéu, câmera de TV, mesa com microfone, petróleo escorrendo/cano — além da lista anterior: placas de vídeo, escadaria, capacetes de obra, caneta-tinteiro/livro-caixa, semáforo, barras de ouro, placas de circuito, avenida enevoada, martelo, onda gigante, Capitólio, xadrez, gráficos sobre mesa, alavanca/manômetro, boia, bandeiras BR/EUA juntas, cadeado partido, moeda cripto rachada, dominós, prédio com seta vermelha, cofre, farol, cabo de fibra, sala de reunião, béquer, mala em ponte, pregão vazio, café com fichário, silhueta em janela, disjuntor, faíscas, mãos na cabeça, cidade litorânea, moeda de pé, hortaliças, deserto, calçamento molhado, oleoduto, helicóptero, mão robótica, guarda-chuva, tríptico, foguete, Arco do Triunfo, plataforma com chama, cavalos de petróleo, barricada, mina naval, poltronas, porto chinês, púlpitos, mina de cobre, navio afundando, wafer, balança, servidores, refinaria, colunas, encapuzado, torres de alta tensão, bico de bomba, urna, míssil, aeroporto, tanques, barris, petroleiro, navio de guerra, Congresso, telas verdes, relógio, touro, multidão, cédulas. Higgsfield segue com letterbox: recortar ~190–320 px.
