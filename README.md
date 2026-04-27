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
   - `DATABASE_URL`: connection string do Neon (com `?sslmode=require`)
   - `AUTH_SECRET`: 32+ caracteres aleatorios
3. A Vercel roda automaticamente `prisma generate && prisma migrate deploy && next build` (script `vercel-build`).
4. Apos o primeiro deploy, rode os seeds **uma vez** apontando o `.env` local para o `DATABASE_URL` de producao:

```bash
npm run db:seed-master
npm run db:seed-authors
npm run db:seed-posts
```

## Estrutura

- `src/app/` - App Router (paginas e layouts)
- `src/app/area-restrita/` - login, painel e gerenciamento (autores, usuarios)
- `src/app/simuladores/` - simuladores financeiros (consorcio, juros compostos, etc)
- `src/app/blog/[slug]` - posts individuais
- `src/app/nosso-time/[slug]` - paginas individuais dos autores
- `prisma/schema.prisma` - modelos User, Author, Post
- `scripts/` - seeds (master, autores, posts)
