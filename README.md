# Site Investimentos de A a Z

Site institucional + blog dinamico, construido em Next.js 16 (App Router), Prisma e Postgres.

## Stack

- **Framework**: Next.js 16 (App Router, Turbopack)
- **UI**: React 19, Tailwind CSS v4, lucide-react, recharts
- **Banco**: Postgres (Neon em producao, Vercel Postgres tambem suportado)
- **ORM**: Prisma
- **Auth**: cookies HMAC + bcrypt, com 2 niveis (MASTER e EDITOR)

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

3. Abra `http://localhost:3000`. Login Master padrao: `Borbarox` / `041291` em `/area-restrita/login`.

## Deploy na Vercel

1. Crie um banco Postgres no [Neon](https://neon.tech) (free tier).
2. Conecte o repo na Vercel e configure as variaveis de ambiente:
   - `DATABASE_URL`: connection string do Neon **com pooler** (host com `-pooler`)
   - `DIRECT_URL`: mesma connection string **sem pooler** (use isso pra rodar migrations)
   - `AUTH_SECRET`: 32+ caracteres aleatorios
   - `YOUTUBE_API_KEY` e `YOUTUBE_CHANNEL_ID` (opcionais, para a aba `/videos`)
3. A Vercel roda automaticamente `prisma generate && next build` (script `vercel-build`).
4. Apos o primeiro deploy, rode os seeds **uma vez** apontando o `.env` local para o banco de producao:

```bash
npm run db:seed-master
npm run db:seed-authors
npm run db:seed-posts
```

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

## Estrutura

- `src/app/` - App Router (paginas e layouts)
- `src/app/area-restrita/` - login, painel e gerenciamento (autores, usuarios)
- `src/app/simuladores/` - simuladores financeiros (consorcio, juros compostos, etc)
- `src/app/blog/[slug]` - posts individuais
- `src/app/nosso-time/[slug]` - paginas individuais dos autores
- `prisma/schema.prisma` - modelos User, Author, Post
- `scripts/` - seeds (master, autores, posts)
