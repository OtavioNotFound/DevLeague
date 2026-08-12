# 18 — Handoff para frontend

## Estado

A fundação backend necessária para iniciar o frontend está disponível. Isso não significa que a alpha esteja pronta para produção: PostgreSQL, Redis, Supabase e um judge gerenciado ainda precisam ser configurados e validados em integração/carga.

## Contratos consumíveis

- Tipos públicos: `@devleague/contracts`.
- REST base: `/api/v1`.
- OpenAPI em desenvolvimento: `/api/docs` e `/api/docs-json`.
- Socket.IO namespace: `/match`.
- Auth REST: `Authorization: Bearer <Supabase JWT>`.
- Auth Socket.IO: `auth.token` na conexão; header Bearer é fallback.
- Toda mutação retryable usa `Idempotency-Key`.
- Todo erro REST usa `ApiErrorEnvelope` e `X-Request-Id`.

## Fluxo inicial recomendado

1. SDK Supabase autentica e entrega access token.
2. `POST /users/bootstrap` cria/reconcilia username.
3. `GET /me` direciona onboarding ou home.
4. `POST /me/consents` aceita as versões vigentes e a declaração 18+.
5. `GET /problems` e `GET /problems/{id}` alimentam Practice.
6. Run/Submit retornam `202`; consultar `GET /submissions/{id}`.
7. Matchmaking usa `PUT/GET/DELETE /matchmaking/entry` e heartbeat.
8. Quando `activeMatchId` existir, abrir `GET /matches/{id}` e conectar Socket.IO.
9. Em perda de evento/conexão, emitir `match.resync`; snapshot persistido vence evento local.

## Variáveis públicas futuras

O frontend poderá receber apenas URL pública do Supabase, publishable key, URL pública da API e versão pública dos documentos. `DATABASE_URL`, `REDIS_URL`, chave do judge e secrets nunca usam prefixo público.

## Bloqueios antes de disponibilizar a alpha

- executar migrações e testes com PostgreSQL real;
- executar testes atômicos com Redis real;
- configurar Supabase e validar sessão/rotação de chaves;
- selecionar e integrar judge após ADR/spike;
- implementar rate limit distribuído;
- conectar publicação de eventos de worker/matchmaker ao realtime entre múltiplas instâncias;
- implementar convites/lobby privado;
- revisar segurança, privacidade, termos e operação.

## Implementação do frontend — 11/08/2026

O app `@devleague/web` foi criado em Next.js 16 e React 19, consumindo os tipos de `@devleague/contracts`. A interface segue o design system documentado e possui modo demo explicitamente isolado para validação sem credenciais externas.

Rotas implementadas:

- landing, login, recuperação de senha e onboarding 18+;
- home do competidor e perfil público;
- catálogo Practice, enunciado, editor multi-linguagem, execução e submissão;
- fila de matchmaking público, estado de rival encontrado e cancelamento;
- arena X1 com relógio, participantes, tentativas, submissão e desistência;
- resultado com variação de rating e nova partida;
- configurações, termos e aviso de privacidade.

Integrações preparadas no cliente:

- sessão Supabase no navegador;
- `GET /me`, catálogo e detalhe de problemas;
- run/submit de Practice;
- entrada, heartbeat e saída do matchmaking;
- snapshot, submissão e desistência de Match.

Integrações operacionais concluídas no cliente:

- guarda de sessão Supabase nas áreas autenticadas, com redirecionamento por `401`, usuário não inicializado, consentimentos pendentes e partida ativa;
- bootstrap de username e registro das versões vigentes de Termos/Privacidade no onboarding;
- catálogo e detalhe de Practice carregados da API quando o modo demo está desligado;
- polling de submissões Practice até estado terminal, exibindo verdict, stdout, stderr e saída de compilação;
- matchmaking com heartbeat e detecção de `activeMatchId` como fallback ao evento realtime;
- conexão Socket.IO autenticada na arena, ressincronização por snapshot e fallback HTTP periódico;
- resultado derivado do `MatchResult` persistido, inclusive empate, desistência, anulação e ausência de rating em partida unranked.

O modo real é ativado por `NEXT_PUBLIC_DEMO_MODE=false` após preencher `apps/web/.env.local` com base em `apps/web/.env.example`. O comando local é `pnpm dev:web`.

Validação desta entrega:

- build de produção do Next concluído com 14 rotas;
- TypeScript e ESLint sem erros;
- `pnpm check` aprovado no monorepo;
- 65 testes unitários aprovados;
- 10 testes de integração continuam condicionados a PostgreSQL e Redis reais.
