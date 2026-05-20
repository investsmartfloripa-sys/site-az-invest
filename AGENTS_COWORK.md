# Guia para agentes neste projeto (Claude Cowork, Cursor, etc.)

Leia este documento antes de começar qualquer trabalho. Contém a **doutrina de execução** que funciona neste repositório, a lista de **armadilhas do ambiente Windows/OneDrive** que custam tempo se você descobrir na hora errada, e os **paths absolutos das ferramentas** que já estão instaladas.

Complementa o `AGENTS.md` (que cuida só de Next.js 16 estar fora do treinamento). Este aqui cuida de **como trabalhar**, não do que codar.

---

## Doutrina: execute, verifique, ajuste

A regra de ouro é simples: **não peça pro usuário rodar comando que você pode rodar**. Se você tem Desktop Commander, Bash, Chrome MCP ou qualquer tool de execução, USE. Pedir pro humano rodar `npm run build` e voltar com o output é antipattern — é o usuário fazendo seu trabalho.

Toda mudança não-trivial passa por três fases obrigatórias:

1. **Execute**: aplique a mudança no código ou rode o script.
2. **Verifique**: rode `tsc --noEmit`, ou bata na URL com curl/Chrome MCP e cheque o DOM, ou releia o arquivo gerado, ou abra o JSON no Blob. **Não confie que funcionou só porque o exit code foi 0.**
3. **Ajuste**: se a verificação falhou, corrija no mesmo turno. Não deixe pro usuário descobrir.

Exemplos do que isso quer dizer na prática:

- Depois de `git push`, dispare o build da Vercel via CLI e **leia o log até "Aliased" aparecer**. Se aparecer "Error: Command exited with 1", localize o erro no log e corrija.
- Depois de subir JSON pro Blob, faça um `fetch` no JS do Chrome MCP confirmando que o conteúdo é o esperado (`last_data_date`, número de observações, primeiro registro).
- Depois de rodar pipeline Python, releia o JSON gerado localmente antes de fazer upload — não confie só no log.
- Depois de criar nova rota Next, navegue até ela pelo Chrome MCP e extraia stats do DOM via `javascript_tool` pra confirmar que o conteúdo renderizou.

**Verifique também o que NÃO mudou.** Quando alterar pipeline incremental (merge com Blob, append-only), confirme via `fetch` do JSON existente que o histórico permaneceu intacto — não apenas que o novo dado entrou.

---

## Apresentar plano antes de tarefas grandes

Pra qualquer mudança que vá afetar mais de 3-4 arquivos ou criar nova infraestrutura (pipeline, rota, workflow), **proponha em texto livre** o que vai fazer e por quê, com as decisões críticas explicitadas. Espere o "pode seguir" do usuário.

Bom plano cabe em uma resposta de chat. Tem:
- Objetivo em uma frase
- Fontes/dados que vai usar (e por que essa fonte, não outra)
- Estrutura de output (paths, formato JSON, nomes de componentes)
- Sequência de etapas
- Riscos/limitações conhecidos

Depois que o usuário aprova, **executa o plano inteiro** sem ficar pedindo aprovação de cada passo. Reporte só nos marcos importantes: pipeline rodou, deploy completou, validação OK.

---

## Ambiente concreto deste projeto

**Sistema operacional**: Windows 10/11 com PowerShell como shell padrão. O usuário roda o Claude Cowork em paralelo com o Cursor (também conectado ao Claude), e os dois mexem no mesmo repo simultaneamente. Cuidado com conflito de `.git/index.lock`.

**Repositório local**: `C:\Users\Borux\OneDrive\Documentos\SiteAZInvest\site-az-invest`

**OneDrive sync ativo**: o repo está dentro de uma pasta sincronizada com OneDrive. Isso introduz latência transitória entre o que o Windows local vê e o que o Vercel CLI publica. Não é catastrófico, mas é a explicação quando "deveria estar lá mas não tá".

**Deploy**: o usuário publica via `vercel --prod --yes` direto da pasta, **não via `git push` → auto-deploy**. Resultado: produção pode estar diferente do `main` do GitHub, porque o CLI publica o estado atual da pasta (incluindo modificações não comitadas). Antes de afirmar "X já está em produção", verifique o HTML/Blob direto, não o `git log`.

**Padrão de pipeline**: scripts Python em `data-pipeline/python/` geram JSON em `data-pipeline/out/` e fazem upload pro Vercel Blob via `shared/blob_upload.py`. O frontend (Next.js) lê do Blob usando ISR (Incremental Static Regeneration) com TTL de 1h. Workflows GitHub Actions em `.github/workflows/` rodam os scripts em cron diário ou de 15 min.

---

## Paths absolutos das ferramentas (importantes)

O PATH dentro do PowerShell que o Desktop Commander usa **não inclui automaticamente todos os binários**. Use sempre paths absolutos pra evitar "não é reconhecido como comando":

```
Python 3.13:    C:\Python313\python.exe
Node.js 24:     C:\Program Files\nodejs\node.exe
TypeScript:     C:\Program Files\nodejs\node.exe + node_modules\typescript\bin\tsc
Git:            C:\Program Files\Git\cmd\git.exe
GitHub CLI:     C:\Program Files\GitHub CLI\gh.exe
Vercel CLI:     C:\Users\Borux\AppData\Roaming\npm\vercel.cmd
```

---

## Armadilhas do PowerShell que custaram horas

Estas são reais. Vão custar tempo se descobrir na hora errada.

### 1. `&` pra rodar `.exe` com path que tem espaço falha em pipeline

```powershell
# Falha com "Não é possível executar um documento no meio de um pipeline"
& 'C:\Program Files\Git\cmd\git.exe' status | Select-Object -First 5

# Falha com "node não é reconhecido"
& 'C:\Program Files\nodejs\node.exe' tsc.js ... | Tee-Object foo
```

**Use `Start-Process` com `-RedirectStandardOutput`** ao invés de pipe:

```powershell
$p = Start-Process -FilePath 'C:\Program Files\Git\cmd\git.exe' `
  -ArgumentList @('-C', $repo, 'status', '--short') `
  -NoNewWindow -PassThru `
  -RedirectStandardOutput 'out.txt' -RedirectStandardError 'err.txt'
$p.WaitForExit()
Get-Content 'out.txt'
```

### 2. Vírgulas em mensagem de commit quebram o argument splitting

```powershell
# Falha: ", " vira separador de argumentos do PS
git commit -m "feat: adicionar pipeline, atualizar UI"
# fatal: 'atualizar' não é repositório
```

**Sem vírgulas, sem aspas duplas internas**:

```powershell
git commit -m '"feat adicionar pipeline e atualizar UI"'
```

### 3. `.env` com aspas precisa de strip no `.cmd`

Arquivos como `.env.vercel.local` têm `TOKEN="vercel_blob_rw_..."`. Quando você lê pelo `for /f` de um `.cmd`, as aspas vêm junto e quebram o auth no servidor (HTTP 403).

**Padrão correto pra ler env num `.cmd`**:

```cmd
@echo off
setlocal enableextensions enabledelayedexpansion
for /f "usebackq tokens=1,* delims==" %%a in (".env.vercel.local") do (
  if "%%a"=="BLOB_READ_WRITE_TOKEN" (
    set "T=%%b"
    set "T=!T:"=!"
    set "BLOB_READ_WRITE_TOKEN=!T!"
  )
)
```

### 4. Stdout do processo background pode demorar a chegar no log

Quando você usa `Start-Process -RedirectStandardOutput`, o arquivo pode ficar vazio por 30-60s mesmo com o processo já progredindo. Confirme via `Get-Item .log | Select LastWriteTime` ou simplesmente espere 1-2 min antes de tentar ler.

### 5. PowerShell strict mode quebra com `$LASTEXITCODE`

O wrapper `npx.ps1` referencia `$LASTEXITCODE` antes de definir, e isso vira erro com strict mode. Solução: chame o JS diretamente via `node`:

```powershell
& 'C:\Program Files\nodejs\node.exe' node_modules\typescript\bin\tsc --noEmit
```

### 6. Comandos com `cmd /c` falham em alguns hosts do Desktop Commander

`cmd` às vezes não está no PATH do PS isolado. Caminho absoluto: `C:\Windows\System32\cmd.exe`.

### 7. Pipes em Chrome MCP — use `browser_batch`

`Multiple navigations` ou `navigate → screenshot → click` em chamadas separadas são **5x mais lentas** que `browser_batch`. Sempre que souber mais de uma ação adiante, batch.

---

## Workflow de validação no Chrome MCP

Quando precisar verificar conteúdo de uma página deployada:

```
1. mcp__Claude_in_Chrome__list_connected_browsers
   → se >1, perguntar qual usar via AskUserQuestion
2. mcp__Claude_in_Chrome__select_browser deviceId=...
3. mcp__Claude_in_Chrome__tabs_context_mcp createIfEmpty=true
4. mcp__Claude_in_Chrome__browser_batch [navigate, javascript_tool]
```

`get_page_text` é bom pra ler texto. `javascript_tool` com `action: javascript_exec` é insuperável pra:
- Extrair contagens (`document.querySelectorAll('.recharts-line').length`)
- Validar fetch de JSON do Blob com cache-bust (`fetch(url, { cache: 'no-store' })`)
- Verificar valores formatados (`document.querySelector('h2')?.textContent`)

**Sempre cheque o `tabId` retornado pelo `tabs_context_mcp` antes de chamar tools**. Se o ID estiver errado, todas as ações falham silenciosamente.

---

## Padrões de pipeline e Blob

### Estrutura padrão de script Python de pipeline

Cada script de pipeline neste repo segue o mesmo padrão:

```python
def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--out-dir", default="data-pipeline/out")
    ap.add_argument("--upload", action="store_true")
    ap.add_argument("--no-merge", action="store_true")  # opcional, se for incremental
    args = ap.parse_args()

    payload = build_data(...)

    # Se for incremental: merge com Blob existente
    if not args.no_merge:
        existing = blob_download_json("data/foo.json")
        if existing:
            payload = merge_with_existing(payload, existing)

    out_path = Path(args.out_dir) / "foo.json"
    out_path.write_text(json.dumps(payload, ensure_ascii=False))

    if args.upload:
        maybe_upload_json(out_path, "data/foo.json")
```

### Merge incremental — quando precisa

Se o cron de um pipeline regenera JSON do zero a cada execução, **você está prestes a perder histórico**. Toda fonte externa tem janela de retenção (ANBIMA = 3 meses, etc.). Sem merge, você silenciosamente perde tudo que sai da janela.

**Padrão**:
1. `blob_download_json(path)` lê o JSON atual do Blob (helper em `shared/blob_download.py`).
2. Combine por chave-data (`dict[date] = value`, novo sobrescreve velho).
3. `maybe_upload_json` substitui o Blob pelo conjunto mesclado (sempre cresce).

### Padrão de upload via `shared/blob_upload.py`

Lê `BLOB_READ_WRITE_TOKEN` do ambiente. Se ausente, faz SKIP silencioso (não quebra). PUT para `https://blob.vercel-storage.com/<path>?addRandomSuffix=false&allowOverwrite=true`.

### Cuidado com sobreposição entre cron de 15min e cron diário

O repo tem dois workflows GH Actions:
- `data-pipeline.yml` — cron de 15 min, gera os JSONs do painel Panorama (yfinance, R)
- `market-data.yml` — cron diário 22:30 UTC, gera JSONs da aba Mercado (yfinance + ANBIMA)

**Não junte os dois.** O cron de 15 min é veneno pra coisas pesadas como yfinance fundamentos (rate limit) ou backfill (CSV de 50MB).

---

## Padrão de commits e push

Sempre que possível, depois de mudanças não-triviais:

1. `git add` só os arquivos seus (não os modificados pelo user em paralelo)
2. Commit com mensagem sem vírgula, em aspas
3. `git push origin main`
4. Se o usuário deploya direto pela pasta: `vercel --prod --yes`
5. Aguarde log do build até "Aliased: https://investimentosdeaz.com.br"
6. Valide via Chrome MCP

Limpe arquivos temporários (`.cm`, `.cme`, `.gh-out`, `.tsc.txt`, `.run-*.cmd`) **antes** do commit, ou eles ficam rastreados.

---

## O que evitar a todo custo

- **Não responda "pode rodar isso aqui no terminal?"** se você tem Desktop Commander. Você tem.
- **Não diga "deve funcionar"** sem ter testado. Teste.
- **Não confie em exit code 0** como prova de sucesso. Inspecione o output ou o estado.
- **Não escreva um trabalho assumindo que o user vai validar cada passo.** Ele não vai. Valide você.
- **Não faça mudanças ad-hoc em arquivos que o user pode estar editando no Cursor** (em particular, qualquer coisa em `src/components/painel/inflacao/` se mexer em IPCA). Confirme antes.
- **Não esqueça do merge incremental** em qualquer pipeline diário que substitua JSON no Blob.

---

## Como começar uma conversa nova produtivamente

Se você é uma instância nova do Claude/Cursor que acabou de abrir o repo:

1. Leia `AGENTS.md` (regra do Next 16).
2. Leia este arquivo.
3. Cheque `data-pipeline/python/` e `src/lib/painel-*.ts` pra entender quais pipelines existem e o que cada loader puxa.
4. Cheque `.github/workflows/` pra ver crons ativos.
5. Pergunte ao usuário **apenas o que não consegue descobrir lendo o repo**. Use a tool de pergunta com opções, não texto livre.
6. Apresente um plano em texto, espere "pode seguir".
7. Execute o plano inteiro com verificação em cada marco.
