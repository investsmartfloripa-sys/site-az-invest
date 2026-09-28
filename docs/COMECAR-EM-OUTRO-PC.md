# Trabalhar no site a partir de outro computador

Passo a passo para alterar o site num PC que não é o do escritório — seja o próprio dono em outra máquina, seja um colega. Na primeira vez leva uns 30 minutos; depois, é abrir o Claude e trabalhar.

Testado em 28/09/2026 com um clone limpo, fora do OneDrive, em Windows 11.

---

## Antes de tudo: três regras

1. **Não trabalhe na pasta do OneDrive.** Se esse PC usa o mesmo OneDrive do escritório, a pasta `SiteAZInvest` vai aparecer nele — **não abra o projeto por ela**. Git dentro do OneDrive em dois computadores ao mesmo tempo corrompe o repositório: o OneDrive sincroniza os arquivos internos do `.git` no meio da gravação. Clone numa pasta local, fora do OneDrive.
2. **Use um caminho curto: `C:\dev\`.** O Windows limita caminhos a uns 260 caracteres e o Next.js quebra (`path length ... too long`) quando o projeto fica numa pasta funda.
3. **Não instale neste PC as tarefas `AZ Sync Apoio` nem `AZ Backup Local`** se ele compartilha o OneDrive do escritório: elas já rodam no PC do escritório, e duas cópias commitariam as mesmas pastas.

## 1. Instalar os programas (uma vez)

| Programa | Para quê | Onde baixar | Conferir |
|---|---|---|---|
| Git for Windows | versionar e enviar ao GitHub | git-scm.com | `git --version` |
| Node.js LTS (20 ou mais novo) | rodar o site | nodejs.org | `node -v` |
| GitHub CLI | login e PR | cli.github.com | `gh --version` |
| Claude (app de desktop, aba Code) | trabalhar com o Claude | claude.ai/download | — |
| Python 3.11+ | **só** para mexer nos pipelines de dados (`data-pipeline/`) | python.org | `python --version` |

Atalho pelo PowerShell: `winget install Git.Git OpenJS.NodeJS.LTS GitHub.cli`. Feche e abra o terminal depois de instalar.

## 2. Entrar no GitHub com o login do escritório

```powershell
gh auth login      # escolha: GitHub.com → HTTPS → Login with a web browser
gh auth setup-git
gh auth status     # deve mostrar investsmartfloripa-sys
```

## 3. Baixar os repositórios

```powershell
mkdir C:\dev
cd C:\dev
git clone https://github.com/investsmartfloripa-sys/site-az-invest.git
git clone https://github.com/investsmartfloripa-sys/agentes-az.git
```

O `agentes-az` é privado e traz os documentos de apoio (agentes, base de dados, identidade visual). Só o site é obrigatório.

## 4. Dizer quem você é e qual o seu papel

Todo mundo entra no GitHub com o mesmo login, então quem diferencia as pessoas é a configuração do clone:

```powershell
cd C:\dev\site-az-invest
git config user.name "Seu Nome"
git config az.papel colaborador      # o dono, em outro PC dele, usa: dono
```

| Papel | Como publica |
|---|---|
| `dono` | commit e `git push origin main` — vai para o ar em ~3 minutos |
| `colaborador` | branch própria + Pull Request; só vai para o ar quando o dono aprovar o PR |

Sem `az.papel` configurado, o Claude trata a máquina como colaborador.

## 5. Criar o arquivo `.env`

O `.env` nunca vai para o GitHub. Escolha **uma** das duas opções.

### Opção A — sem banco de dados (recomendada para painel, gráficos, simuladores e layout)

Crie `C:\dev\site-az-invest\.env` com:

```
NEXT_PUBLIC_BLOB_BASE_URL=https://8ytqvgmik75vk1it.public.blob.vercel-storage.com
AUTH_SECRET=troque-por-qualquer-texto-longo-e-aleatorio
```

Funciona: painel econômico, gráficos, simuladores, layout das páginas. Não funciona: artigos, time e vídeos aparecem vazios, `/boletins` dá erro e não dá para entrar na área logada. É o esperado.

### Opção B — completa (para mexer em blog, conteúdo ou área logada)

O dono entrega o `.env` dele. **Atenção: esse arquivo aponta para o banco de PRODUÇÃO — não existe banco de teste.** Tudo o que for criado, editado ou apagado localmente acontece no site real. Nunca rode `prisma migrate dev`, `prisma migrate reset` nem os comandos `npm run db:seed-*` com ele.

Entregue em mãos (pen drive) ou por gerenciador de senhas — não por WhatsApp ou e-mail. O `.env.vercel.local` (tokens de deploy e de gravação no Blob) fica só com o dono.

## 6. Instalar as dependências e rodar

```powershell
cd C:\dev\site-az-invest
npm install
npm run dev
```

Abra http://localhost:3000. A instalação leva uns 2 minutos.

- Avisos `allow-scripts` / `approve-scripts` do npm: **pode ignorar**. O que importa (cliente do Prisma e o `sharp`) é instalado mesmo assim.
- O painel econômico dá **404** no `npm run dev` (limitação conhecida). Para ver o painel:

  ```powershell
  npm run build
  npm run start -- -p 3001
  ```

  e abra http://localhost:3001/painel-economico. O build leva alguns minutos.

## 7. Abrir no Claude

1. No app do Claude, aba **Code**, escolha a pasta `C:\dev\site-az-invest`.
2. Na primeira vez ele pergunta se confia na pasta e nos hooks do projeto: **confirme**. São os hooks do próprio repo, que mostram ao Claude o estado do repositório e o seu papel.
3. O Claude lê o `AGENTS.md` sozinho. Uma boa primeira mensagem:

   > Leia o AGENTS.md e o docs/ARMADILHAS.md. Quero alterar [o que você quer mudar].

## 8. Fazer uma alteração

Peça ao Claude em português. Ele cuida dos comandos, mas é bom saber o que acontece:

**Colaborador:**

```powershell
git switch main
git pull --rebase                       # sempre antes de começar
git switch -c seu-nome/assunto          # branch própria
# ... o Claude altera e você confere em http://localhost:3000 ...
git add <arquivos alterados>
git commit -m "o que mudou"
git push -u origin seu-nome/assunto
gh pr create --base main                # abre o Pull Request
```

Depois avise o dono. Nada vai para o ar até ele aprovar. Se a mudança precisar de alteração no banco (migration), deixe o SQL no PR e avise — quem aplica é o dono.

**Dono em outro PC:** `git pull --rebase`, altere, commit e `git push origin main`. Em ~3 minutos está no ar; confira no site.

## 9. Dono: revisar e publicar um Pull Request

```powershell
gh pr list                                   # PRs abertos
gh pr view 12 --web                          # ver as mudanças no navegador
gh pr checkout 12                            # (opcional) testar localmente
gh pr merge 12 --squash --delete-branch      # publica: o deploy sai daqui
```

PR com migration: aplique antes do merge com `npx prisma migrate deploy`.

## 10. Toda vez que voltar a trabalhar

```powershell
cd C:\dev\site-az-invest
git switch main
git pull --rebase
```

O Claude avisa ao abrir a sessão se o seu clone estiver desatualizado ou com trabalho não enviado.

## Problemas comuns

| Sintoma | Causa e solução |
|---|---|
| `path length for file ... is too long` | projeto numa pasta funda: mova para `C:\dev\` |
| 404 em `/painel-economico/...` no `npm run dev` | limitação conhecida: use `npm run build` + `npm run start -- -p 3001` |
| `Environment variable not found: DATABASE_URL` | você está na opção A (sem banco); é esperado nas páginas de conteúdo |
| `git push` rejeitado (`non-fast-forward`) | alguém publicou antes: `git pull --rebase` e push de novo |
| Conflito no `git pull --rebase` | peça ao Claude para resolver; **nunca** use `--force` |
| `gh: command not found` depois de instalar | feche e abra o terminal (e o app do Claude) |
