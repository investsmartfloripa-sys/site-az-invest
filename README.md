# Site Investimentos de A a Z

Site institucional + blog dinamico, construido em Next.js 16 (App Router), Prisma e Postgres.

## Stack

- **Framework**: Next.js 16 (App Router, Turbopack)
- **UI**: React 19, Tailwind CSS v4, lucide-react, recharts
- **Banco**: Postgres (Neon em producao, Vercel Postgres tambem suportado)
- **ORM**: Prisma
- **Auth**: cookies HMAC + bcrypt, RBAC com 3 papeis (`ADMIN`, `STAFF`, `AUTHOR`)
- **Workspace**: `/area-restrita/*` — editor TipTap, fila de revisao, metricas, leads, saude dos dados

## Rodando local

1. Copie `.env.example` para `.env` e preencha as variaveis.
2. Instale dependencias e rode as migrations:

```bash
npm install
npx prisma migrate dev
npm run db:seed-master
npm run db:seed-authors
npm run db:seed-posts
npm run dev
```

3. Abra `http://localhost:3000`. Login admin padrao: `Borbarox` / `041291` em `/area-restrita/login` (titulo **AZ Workspace**).

## Deploy na Vercel

1. Crie um banco Postgres no [Neon](https://neon.tech) (free tier).
2. Conecte o repo na Vercel e configure as variaveis de ambiente:
   - `DATABASE_URL`: connection string do Neon **com pooler** (host com `-pooler`)
   - `DIRECT_URL`: mesma connection string **sem pooler** (use isso pra rodar migrations)
   - `AUTH_SECRET`: 32+ caracteres aleatorios
   - `YOUTUBE_API_KEY` e `YOUTUBE_CHANNEL_ID` (opcionais, para a aba `/videos`)
   - `RESEND_API_KEY` e `EMAIL_FROM` (usado no formulario de contato dos assessores)
3. A Vercel roda automaticamente `prisma generate && next build` (script `vercel-build`).
4. Apos o primeiro deploy, rode os seeds **uma vez** apontando o `.env` local para o banco de producao:

```bash
npm run db:seed-master
npm run db:seed-authors
npm run db:seed-posts
```

## Dominio (producao) e fallback se nao abrir

A URL publica de referencia e `https://investimentosdeaz.com.br`. Se o navegador nao
abrir ou disser que nao encontrou o servidor, o problema costuma ser **DNS no
registrador**, nao o Next.js ou a Vercel em si.

**Ate o DNS propagar**, use o host padrao do projeto na Vercel:

`https://site-az-invest.vercel.app`

(Logins e rotas sao as mesmas, por exemplo `/area-restrita/login`.)

Diagnostico e **validacao pos-deploy** (obrigatorio para agentes — ver tambem `AGENTS.md`):

```bash
npm run site:check-access
```

O script confirma HTTP 200 **e** se `/area-restrita/login` exibe **AZ Workspace** (nao o login legado nem a pagina de erro global). Se falhar, publique com `vercel --prod --yes` e repita.

Deploy manual (producao pode estar a frente do `main` no GitHub):

```bash
vercel --prod --yes
```

Aguarde **Aliased** no log antes de rodar `site:check-access` de novo.

**Corrigir DNS** (Registro.br ou provedor onde o dominio esta):

1. No projeto na Vercel: **Settings → Domains** → `investimentosdeaz.com.br` e
   copie **exatamente** os registros que o painel indicar (eles prevalecem sobre
   qualquer exemplo generico abaixo).
2. Se o assistente pedir registro **A** no apex (`@`), o valor costuma ser
   `76.76.21.21`.
3. Para **www**, em geral **CNAME** com nome `www` e valor `cname.vercel-dns.com`
   (confira sempre no passo 1).
4. Confirme que os **servidores DNS (NS)** do dominio apontam para o servico onde
   voce editou a zona; remova registros antigos da hospedagem WordPress/Elementor
   que conflitem com o apex/`www`.
5. Aguarde a propagacao (minutos a varias horas). Valide com
   `nslookup investimentosdeaz.com.br 8.8.8.8`.

Se o dominio usar **DNSSEC** e a resolucao continuar falhando, revise a
configuracao conforme a documentacao do registrador.

## Migrations futuras

Migrations **NAO** rodam no build do Vercel (o pooler do Neon nao suporta o
advisory lock que o `prisma migrate deploy` usa, e o auto-suspend do Neon
free tier deixa o lock instavel). Quando criar novas migrations:

```bash
# 1. Cria a migration localmente, apontando .env para o Neon
npx prisma migrate dev --name minha_migration

# 2. Commit e push (a migration vai junto pro git)
git add prisma/migrations && git commit -m "Adicionar migration X" && git push
```

Como `migrate dev` ja aplica direto no banco, nao precisa rodar `migrate deploy` em lugar nenhum.

## E-mail dos assessores (Resend)

O formulario "Fale com X" na pagina de cada assessor envia a mensagem para o
e-mail profissional cadastrado no painel restrito **e** salva o lead no banco.

Configurar uma vez:

1. Criar conta em [resend.com](https://resend.com).
2. Verificar dominio proprio (recomendado) ou usar `onboarding@resend.dev` para
   testes rapidos com sandbox.
3. Gerar API key e setar `RESEND_API_KEY` e `EMAIL_FROM` no `.env`.
4. No painel restrito (`/area-restrita/autores`), preencher para cada assessor:
   - **E-mail profissional** (destinatario dos leads).
   - **WhatsApp** no formato internacional (ex: `+5548999386708`).

Sem `RESEND_API_KEY`/`EMAIL_FROM`, os leads continuam sendo salvos no banco e
listados no painel com status `SKIPPED`.

## AZ Workspace (area logada)

| Rota | Descricao |
|------|-----------|
| `/area-restrita/login` | Login (publico) |
| `/area-restrita/dashboard` | Home do workspace |
| `/area-restrita/conteudo` | Posts (rascunho → revisao → publicado) |
| `/area-restrita/revisao` | Fila editorial (ADMIN/STAFF) |
| `/area-restrita/autores` | Cadastro de assessores |
| `/area-restrita/leads`, `/metricas` | CRM e analytics first-party |
| `/area-restrita/dados` | Saude dos pipelines (cron + GitHub Actions) |
| `/area-restrita/usuarios` | Convites e reset de senha (ADMIN/STAFF) |
| `/area-restrita/perfil` | Perfil do autor vinculado |

Rotas legadas `/area-restrita/painel` e `/admin` redirecionam para `/area-restrita/dashboard`.

## Estrutura

- `src/app/` - App Router (paginas e layouts)
- `src/app/area-restrita/` - login + AZ Workspace (`(workspace)/`)
- `src/app/simuladores/` - simuladores financeiros (consorcio, juros compostos, etc)
- `src/app/blog/[slug]` - posts individuais
- `src/app/nosso-time/[slug]` - paginas individuais dos autores
- `prisma/schema.prisma` - modelos User, Author, Post, AuthorLead
- `src/lib/email.ts` - integracao com Resend para leads dos assessores
- `scripts/` - seeds (master, autores, posts)
