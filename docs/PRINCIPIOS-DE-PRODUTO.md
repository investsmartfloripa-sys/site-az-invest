# Princípios de produto — como o dono avalia o site

Critérios que o dono do site já cobrou mais de uma vez. Quem entrega trabalho no site — pessoa ou agente — é avaliado por eles. O padrão visual dos gráficos (cores, grade, seletor de período, cockpit × narrativa) está em [`PADRAO-VISUAL-GRAFICOS.md`](PADRAO-VISUAL-GRAFICOS.md); aqui fica o que vem antes do visual.

---

## 1. Gráfico começa pela pergunta econômica

O problema do painel nunca foi organização: foi gráfico feito "de qualquer jeito", sem raciocínio. Antes de desenhar:

- **Qual pergunta este gráfico responde?** Se não der para dizer em uma frase, o gráfico não deveria existir.
- **Transformação canônica**, não a mais fácil: nível × variação, 12 meses × momentum dessazonalizado anualizado, contribuições em vez de taxas soltas, decomposição r−g para dívida.
- **Referências teóricas no gráfico**: meta e banda, recessões (CODACE), médias históricas.
- **Convenção de quem publica o dado**: Relatório de Política Monetária do BCB, Tesouro/IFI para fiscal, research macro de mercado. Definições (núcleos de inflação, por exemplo) vêm da fonte oficial — nunca de memória.

Estética importa, mas o critério nº 1 é o pensamento analítico.

## 2. Dois públicos, duas camadas

O painel serve ao cliente leigo **e** ao próprio dono, que o usa profissionalmente no dia da divulgação. Cada tema tem:

1. **Leitura rápida** — poucos gráficos, o essencial.
2. **Esmiuçamento** — tabelas completas e várias transformações da mesma série (nível, mês, 12 meses, sazonalidade, contribuições), cobrindo todos os flancos daquela base. Fica numa camada própria (sub-aba, seção "análise completa") para não poluir a primeira.

Antes de escolher o formato, pergunte: **esta página é para LER ou para ACOMPANHAR?** Acompanhamento é cockpit (ver `PADRAO-VISUAL-GRAFICOS.md` §10). Desde set/2026 isso vale para toda aba de indicador econômico.

## 3. Checklist de revisão de qualquer aba

Os três defeitos que o dono sempre aponta:

1. **Espaço em branco.** Quase sempre é *stretch* do CSS grid: numa linha de duas colunas, o card mais baixo estica até a altura do vizinho e o gráfico de altura fixa deixa o resto vazio. Corrija com `items-start` na linha e pareando cards de altura parecida.
2. **Jargão sem tradução** (SAAR, difusão, núcleos EX0/EX3, "share"). Subtítulo em português direto no card, leitura com o número do mês acima do gráfico e glossário **visível** embaixo — não escondido no "?".
3. **Título sem período.** Card que mostra o mês de referência traz o mês entre parênteses: `Busca por subitem (jul/26)`.

## 4. Filtrar antes de mostrar

Coletar tudo é trabalho de banco de dados; o que vai para a tela é julgamento editorial. Série incomparável (quebra de lei ou metodologia que muda o significado) não vira gráfico. Medida redundante vira nota, não gráfico novo. Proponha o núcleo enxuto e liste o resto como "disponível se quiser". Mostrar tudo transfere a triagem para o dono.

## 5. Simuladores: conta certa antes de tela bonita

Simulador mexe com decisão financeira de cliente; conta errada é o defeito mais grave do site. Qualquer trabalho em `/simuladores` começa pela **auditoria matemática** (Price/SAC, IR regressivo e progressivo, PGBL/VGBL, consórcio, ITCMD), com recomputação independente e comparação com fontes oficiais (calculadoras do BC, legislação). Depois português, depois classificação e layout. Premissas e avisos visíveis na tela.

## 6. Entregue funcionando, conferido por você

- Nunca encerre sem abrir o resultado no navegador e ver funcionando. Build verde e exit code 0 não são prova.
- Não assuma que o dono vai validar cada passo: ele não vai.
- Tarefa grande (mais de três ou quatro arquivos, ou infraestrutura nova) vai primeiro como plano curto e espera o "pode seguir"; depois execute inteira (`AGENTS.md` §0).
- Quando o dono pedir uma escolha, dê a recomendação explícita — ele decide rápido.

## 7. Como o dono revisa

Às vezes a revisão chega como um `.docx` com **print de cada card seguido de um comentário curto**, com marcações em vermelho no print. O texto sozinho é ininterpretável ("junte esses dois gráficos"): leia as imagens. Monte a tabela print → componente → pedido antes de mexer em código, e confirme só os pontos que mudam o desenho da página.
