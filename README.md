# DevLeague — documentação de produto e arquitetura

> Status: **implementação inicial da V0.1; núcleo competitivo em desenvolvimento**  
> Última revisão documental: 2026-08-11  
> Nome: `DevLeague` é um codinome provisório.

DevLeague é uma plataforma Brazil-first de prática e competição em programação. A V0.1 existe para validar uma hipótese: duas pessoas querem disputar um problema, concluir a partida e jogar novamente.

## Estado da implementação

Incrementos de domínio e persistência concluídos:

- workspace pnpm/TypeScript com regras estritas de lint e tipos;
- `packages/domain`: aggregate `Match`, admissão autoritativa por `admission_seq`, resolução de callbacks fora de ordem, timeout, forfeit e `VOID_SYSTEM`;
- política Elo `elo-v1`, sem rating para partida privada ou resultado anulado;
- `packages/persistence`: migração PostgreSQL versionada, repositório transacional para Match/Submission/Rating e outbox;
- finalização idempotente com rating e evento de domínio exatamente uma vez;
- identidade interna, Profile e ConsentRecord append-only na migração `0002`;
- verificação local de JWT Supabase por JWKS assimétrico, issuer e audience;
- endpoints autenticados `POST /users/bootstrap`, `GET /me` e `POST /me/consents`;
- gate de elegibilidade da alpha para conta ativa, termos, privacidade, 18+ e e-mail quando configurado;
- catálogo autenticado `GET /problems` e `GET /problems/{id}`, com paginação, dificuldade e registro de exposição;
- separação física e de consulta entre exemplos públicos e testes privados;
- `packages/application`: porta interna `CodeExecutionPort`, validação de source/limites e adapter fake determinístico que não executa código;
- Practice Run/Submit assíncronos, worker persistente com retry e prioridade para Submit competitivo;
- snapshot, resultado, forfeit e Submit competitivo autenticados;
- matchmaking Redis com heartbeat, faixa progressiva e reserva recuperável antes da criação transacional da partida;
- gateway Socket.IO para `match.join`/`match.resync` e presença mínima;
- OpenAPI 3.0 em `/api/docs` e `/api/docs-json`;
- pacote público `@devleague/contracts` e [handoff de frontend](docs/18_FRONTEND_HANDOFF.md);
- envelope de erro correlacionado por `X-Request-Id` e CORS por allowlist;
- `apps/api`: liveness `GET /api/v1/health` e readiness PostgreSQL `GET /api/v1/health/ready`;
- testes automatizados ligados aos IDs de regras/requisitos.

O projeto chegou à etapa de frontend. Ainda não implementados ou não validados: interface web, fluxo visual de autenticação, provider real de judge, rate limit distribuído, fanout realtime multi-instância, convites/lobby privado, conteúdo operacional, infraestrutura real e deploy. O sistema não está pronto para usuários.

### Desenvolvimento local

Requisitos: Node.js 24+ e pnpm 11.16+.

```bash
pnpm install
pnpm check
pnpm dev:api
pnpm dev:worker
pnpm dev:matchmaker
```

Com uma instância PostgreSQL disponível, configure `DATABASE_URL` para aplicar as migrações. Use um banco descartável e separado em `TEST_DATABASE_URL` para os testes de integração:

```bash
pnpm db:migrate
pnpm test:integration
```

Os testes de integração são ignorados automaticamente quando `TEST_DATABASE_URL`/`TEST_REDIS_URL` não estão definidos; eles nunca usam as URLs normais como fallback.

Para autenticação, configure um projeto Supabase com chave de assinatura assimétrica e informe `SUPABASE_URL` (ou `SUPABASE_AUTH_ISSUER` e `SUPABASE_JWKS_URL`). As versões vigentes da alpha são definidas por `ALPHA_TERMS_VERSION` e `ALPHA_PRIVACY_VERSION`.

Estrutura atual:

```text
apps/api/          API NestJS
apps/worker/       consumidor de execuções de código
apps/matchmaker/   criação de partidas a partir da fila Redis
packages/application/ casos de uso e portas de infraestrutura
packages/contracts/ contratos públicos para frontend
packages/domain/   regras competitivas sem dependência de infraestrutura
packages/persistence/ persistência PostgreSQL e migrações
packages/redis-infrastructure/ fila e reservas de matchmaking
docs/              especificação e ADRs
```

## Como usar esta documentação

1. Leia [Visão do produto](docs/01_VISAO_DO_PRODUTO.md) e [Escopo da V0.1](docs/02_ESCOPO_MVP_V0_1.md).
2. Para comportamento, a fonte de verdade é [Regras de negócio](docs/03_REGRAS_DE_NEGOCIO.md).
3. Para contratos verificáveis, consulte [Requisitos funcionais](docs/05_REQUISITOS_FUNCIONAIS.md) e [não funcionais](docs/06_REQUISITOS_NAO_FUNCIONAIS.md).
4. Para implementação, leia [Arquitetura](docs/07_ARQUITETURA_DO_SISTEMA.md), [Dados](docs/08_MODELO_DE_DADOS.md), [API](docs/09_API_SPEC.md), [Judge](docs/10_CODE_JUDGE_SPEC.md) e [Realtime](docs/11_REALTIME_MATCH_SPEC.md).
5. Agentes de implementação devem cumprir [CODEX_INSTRUCTIONS](docs/17_CODEX_INSTRUCTIONS.md).

Quando houver divergência, não escolha silenciosamente. Use esta precedência: decisão aprovada/ADR aceita → regra de negócio → requisito → especificação técnica → especificação de tela. Registre e resolva a inconsistência antes de implementar.

## Índice

| Documento | Fonte principal para |
|---|---|
| [01 — Visão](docs/01_VISAO_DO_PRODUTO.md) | proposta, público e princípios |
| [02 — Escopo MVP](docs/02_ESCOPO_MVP_V0_1.md) | inclusão, exclusão e critérios de saída |
| [03 — Regras](docs/03_REGRAS_DE_NEGOCIO.md) | regras competitivas e de produto |
| [04 — Fluxos](docs/04_FLUXOS_DE_USUARIO.md) | jornadas e exceções |
| [05 — RF](docs/05_REQUISITOS_FUNCIONAIS.md) | comportamento verificável |
| [06 — RNF](docs/06_REQUISITOS_NAO_FUNCIONAIS.md) | qualidade, segurança, privacidade e SLOs |
| [07 — Arquitetura](docs/07_ARQUITETURA_DO_SISTEMA.md) | containers, módulos e implantação |
| [08 — Dados](docs/08_MODELO_DE_DADOS.md) | entidades, invariantes e retenção |
| [09 — API](docs/09_API_SPEC.md) | HTTP, erros e idempotência |
| [10 — Judge](docs/10_CODE_JUDGE_SPEC.md) | execução não confiável e providers |
| [11 — Realtime](docs/11_REALTIME_MATCH_SPEC.md) | eventos e lifecycle de partida |
| [12 — Design system](docs/12_DESIGN_SYSTEM.md) | identidade, tokens e componentes |
| [13 — Telas](docs/13_ESPECIFICACAO_DE_TELAS.md) | estados e comportamento das telas |
| [14 — Testes](docs/14_TESTING_STRATEGY.md) | estratégia e casos críticos |
| [15 — Roadmap](docs/15_ROADMAP.md) | horizontes e checkpoints |
| [16 — ADRs](docs/16_DECISOES_ARQUITETURAIS.md) | decisões e consequências |
| [17 — Agentes](docs/17_CODEX_INSTRUCTIONS.md) | regras para futuras mudanças |

### Horizontes futuros

[Education](docs/future/EDUCATION.md) · [VS Code](docs/future/VSCODE_EXTENSION.md) · [Talent](docs/future/TALENT.md) · [Platform API](docs/future/PLATFORM_API.md) · [Marketplace](docs/future/MARKETPLACE.md) · [Monetização](docs/future/MONETIZACAO.md) · [Integridade e IA](docs/future/INTEGRIDADE_E_IA.md)

## Vocabulário normativo

- **MUST / DEVE**: obrigatório para aceitar a V0.1.
- **SHOULD / DEVERIA**: esperado; desvio exige justificativa registrada.
- **COULD / PODE**: opcional, sem bloquear o MVP.
- **FUTURE**: não implementar sem mudança explícita de escopo.
- **DECISÃO PENDENTE**: depende de aprovação antes da implementação relacionada.

## Decisões aprovadas

- Alpha fechada temporariamente restrita a participantes **18+**, sem infraestrutura complexa de verificação etária.
- Partidas privadas são **unranked**; apenas matchmaking competitivo público altera rating.
- A V0.1 usará execução gerenciada após diligência de fornecedor; provider ainda não selecionado.
- O domínio depende de uma porta interna simples de execução, nunca da API específica do provider.

## Pendências bloqueantes antes de implementar

1. Contratar e validar o provider de judge conforme ADR-004 e `10_CODE_JUDGE_SPEC.md`.
2. Realizar teste técnico (spike descartável) de latência, concorrência, callbacks, limites e retenção com credenciais de avaliação.
3. Validar termos da alpha, aviso de privacidade, base legal, retenção e processo de direitos do titular com assessoria jurídica brasileira.
4. Calibrar problemas e limites nas quatro linguagens com soluções de referência.
