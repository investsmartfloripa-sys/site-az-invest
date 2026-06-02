# Guia para agentes — site-az-invest

Leia **antes** de implementar qualquer mudança. A doutrina operacional completa (deploy, verificação no site, PowerShell, Vercel CLI, Chrome MCP) está em:

`C:\Users\Borux\OneDrive\Documentos\Claude\Projects\Gráfico Site AZ Invest\AGENTS_COWORK.md`

## Regra de ouro: execute, verifique, ajuste

Não encerre a tarefa só porque o build passou ou o código foi escrito. **Um agente da conversa deve validar o resultado no site.**

### Checklist obrigatório após mudanças na área logada ou deploy

1. `npm run build` (ou `tsc --noEmit` se a mudança for pequena) — corrija erros no mesmo turno.
2. Se houver migration Prisma nova: aplique no Neon com `npx prisma migrate dev` (via `DIRECT_URL`) antes do deploy.
3. Publique: `vercel --prod --yes` na pasta do repo (produção pode estar à frente do `main` — veja AGENTS_COWORK).
4. Aguarde o build até **"Aliased"** no log da Vercel.
5. **Teste em produção** (não confie só no exit code):
   ```bash
   npm run site:check-access
   node scripts/smoke-workspace.mjs
   ```
   O script de login confirma HTTP 200 em `/area-restrita/login`. O smoke test autentica como admin e verifica **todas as abas** do workspace (dashboard, conteúdo, revisão, autores, leads, métricas, dados, usuários).
6. Opcional mas recomendado: abrir `https://investimentosdeaz.com.br/area-restrita/login` no browser (ou Chrome MCP) e confirmar login com as credenciais do seed (`README.md`).

### Rotas principais (AZ Workspace)

| Rota | Quem acessa |
|------|-------------|
| `/area-restrita/login` | Público (formulário) |
| `/area-restrita/dashboard` | Todos autenticados |
| `/area-restrita/conteudo`, `/revisao` | ADMIN, STAFF, AUTHOR (escopo por autor) |
| `/area-restrita/autores`, `/leads`, `/metricas`, `/dados`, `/usuarios` | ADMIN e STAFF |
| `/area-restrita/perfil` | AUTHOR (e demais) |

Papéis: `ADMIN`, `STAFF`, `AUTHOR` (substituem o antigo MASTER/EDITOR).

### O que não fazer

- Pedir ao usuário para rodar comandos que você pode executar.
- Afirmar "está em produção" sem checar o HTML da URL.
- Deixar migration aplicada no banco sem deploy do código compatível (ou vice-versa).

---

<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->
