# agent/_historico — infraestrutura fora de uso

Nada aqui é executado pela rotina do Café com Mercado. São soluções para problemas que
deixaram de existir, guardadas porque descrevem contornos que podem voltar a ser úteis se a
condição original retornar.

**Não siga estes arquivos como procedimento.** O procedimento vivo está no `SKILL.md` da tarefa
`briefing-macro-diario` (fonte da verdade em `Projects\Agentes AZ\morning-call\SKILL.md`).

| Arquivo | O que resolvia | Por que saiu |
|---|---|---|
| `PIPELINE-NOTES.md` | Registro dos incidentes de julho/2026, quando o proxy de egresso da nuvem bloqueava escrita (`PUT`/`POST`) em `api.github.com` com HTTP 403. Documenta o fluxo branch → PR → merge que era a saída. | A Contents API voltou a aceitar escrita direta. Hoje a rotina publica com `PUT` na `main` e `workflow_dispatch`, sem PR. Seguir este arquivo levaria a abrir PR à toa. |
| `publish-edition.sh` | Implementava aquele fluxo de branch e push para a sessão, com o merge feito à parte pelo agente. | Mesmo motivo. O Passo 6 do SKILL faz tudo por API. |
| `fetch-transcript.sh` | Buscava legendas passando por um relay próprio, para tirar o YouTube da frente do IP de datacenter do sandbox. | O sandbox voltou a baixar legendas direto. O Passo 3 usa `yt-dlp` no próprio sandbox, com o shell local do PC como alternativa. |
| `transcript-relay/` | O relay em si: Dockerfile, `app.py`, Caddyfile e bootstrap, para rodar num servidor 24/7 com IP limpo. | Idem. **É o candidato mais provável a voltar** se o YouTube reativar o bloqueio a IP de datacenter — o bloqueio é intermitente, não estrutural. |
| `whatsapp/` | Montagem anterior do WhatsApp (Caddyfile, docker-compose, env de exemplo). | O post passou a sair pela API do OpenWA, que roda em `C:\Users\Borux\OpenWA` na máquina do usuário, fora deste repo. |

## Se precisar ressuscitar o relay

O gatilho é o `yt-dlp` no sandbox voltar a responder 429 ou "Sign in to confirm you're not a bot"
de forma persistente, por vários dias. Antes de subir o relay, tente o caminho do Passo 3.4 do
SKILL — o shell local do PC via Desktop Commander, que sai pelo IP residencial e resolve o mesmo
problema sem infraestrutura nova.
