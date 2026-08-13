# Plano de retomada e release da DevLeague

Atualizado em 12 de agosto de 2026. Este arquivo é o ponto de retomada da próxima sessão.

## 1. Estado seguro desta entrega

A entrega atual deixa a área de prática utilizável no navegador e impede que funcionalidades competitivas incompletas sejam apresentadas como confiáveis.

- Cadastro, login, recuperação, sessão Supabase, perfil interno e consentimentos 18+ continuam integrados.
- Rating inicial e mínimo são 0.
- Prática possui editor Monaco, atalhos, snippets, palavras-chave, rascunho local e exemplos públicos.
- Python usa Pyodide 0.29.2 em Web Worker de módulo, conforme a integração suportada pelo runtime.
- JavaScript e TypeScript executam localmente em Web Worker; Lua usa Fengari local.
- C++/Clang Wasm permanece experimental e oculto por padrão com `NEXT_PUBLIC_EXPERIMENTAL_CPP=false`.
- `Executar` no X1 testa exemplo público localmente; somente `Enviar solução` cria submissão competitiva.
- O matchmaking casual `UNRANKED_PUBLIC` pode usar o gate isolado `ALPHA_BROWSER_MATCHES_UNRANKED`; ranked continua desligado sem judge competitivo real.
- O worker falso é proibido em produção e só aceita banco PostgreSQL local com opt-in explícito.
- Banco remoto é bloqueado em desenvolvimento salvo opt-in, reduzindo risco de apagar ou alterar o Supabase por acidente.
- Starters que continham soluções completas foram substituídos por esqueletos e os problemas atuais foram retirados do pool competitivo.

## 2. Mudanças estruturais concluídas

### Segurança e operação

- Gates `COMPETITIVE_EXECUTION_ENABLED` e `RANKED_MATCHMAKING_ENABLED`.
- `ALLOW_FAKE_JUDGE=true` exigido para o fake local; fake não inicia em produção nem contra banco remoto.
- `ALLOW_REMOTE_DATABASE=true` exigido para desenvolvimento contra PostgreSQL remoto.
- Limites transacionais iniciais: Practice Run 10/min, Practice Submit 5/min e Match Submit 5/min por usuário.
- Headers básicos de segurança na API e no frontend.
- Modo demo passou a ser opt-in: somente `NEXT_PUBLIC_DEMO_MODE=true` ativa dados falsos.
- Idempotência do envio competitivo deriva de match, linguagem e source; retry do mesmo conteúdo não duplica submissão.

### Partida e justiça competitiva

- Match nasce em `COUNTDOWN`, não em `ACTIVE`.
- Lobby exige confirmação individual de ambos os participantes.
- Problema fica oculto até os dois estarem prontos.
- Countdown e deadline são recalculados pelo relógio do PostgreSQL após o segundo ready.
- Lobby expira e cancela sem resultado e sem rating.
- Scheduler persistente ativa partidas, encerra deadlines e anula judge travado após grace period.
- Submissões são admitidas pelo relógio do banco, com sequência serializada e idempotência.
- Estado `RESOLVING` agora termina em empate assim que a última submissão pendente falha.
- UI identifica o jogador atual por `currentUserId`, sem assumir posição no array.

### Conteúdo e editor

- Arena usa o problema real da versão congelada no match, não dados demo.
- Markdown de problemas é renderizado sem HTML arbitrário.
- Starter code não entrega mais a solução.
- Run local valida o primeiro exemplo; “Validar exemplos” verifica todos os exemplos públicos e informa que isso não é veredito do judge.
- Python migrou do worker clássico com `importScripts` para worker de módulo suportado pelo Pyodide 0.29.2.
- C++ fica desabilitado até o spike comprovar tempo de download, compilação, compatibilidade e estabilidade em produção.

## 3. Migrations desta entrega

- `0012_content_safety.sql`: desabilita problemas não calibrados para competição e remove soluções dos starters.
- `0013_match_ready_check.sql`: adiciona `match.lobby_expires_at`, `match_participant.ready_at` e índice de expiração.

As migrations devem ser aplicadas pela API no Railway por `preDeployCommand`. Nunca executar testes de integração contra o banco de produção: eles truncam tabelas.

## 4. Validações executadas

- Build de contracts e persistence: aprovado.
- Typecheck da API: aprovado.
- Build otimizado Next.js 16: aprovado.
- Lint completo: aprovado.
- Testes unitários: persistence, worker, API e web aprovados.
- Testes PostgreSQL de integração: preparados, mas pulados enquanto não existir `TEST_DATABASE_URL` descartável.

## 5. O que está jogável agora

O produto publicável nesta etapa é o treino local no navegador com autenticação e catálogo. Python, JavaScript, TypeScript e Lua devem funcionar sem Railway worker. Isso reduz custo e é adequado para treino, porque o resultado local não altera rating.

O Wasm do cliente não é um judge confiável: o cliente pode alterar código, memória, respostas e chamadas HTTP. Por isso a exceção da alpha fica restrita a `UNRANKED_PUBLIC`, aparece como resultado não verificado e sempre produz delta zero. O servidor ainda confere participante, partida ativa, deadline, conjunto atual de exemplos públicos, idempotência e ordem transacional de admissão. Ranked continua exigindo reexecução autoritativa em ambiente controlado pelo backend.

## 6. Próxima sessão — ordem obrigatória

### P0 — validar a publicação atual

1. Abrir a URL de produção em janela anônima.
2. Criar e confirmar uma conta de teste.
3. Testar refresh, logo, fechar/reabrir navegador e logout/login.
4. Abrir “Soma de Dois Números” e executar em Python, JavaScript, TypeScript e Lua.
5. Conferir console, Network, CORS e carregamento dos workers.
6. Confirmar que C++ aparece indisponível e que X1 mostra gate claro.

### P0 — banco descartável e testes de integração

1. Criar PostgreSQL local via Docker ou projeto Supabase exclusivo para testes.
2. Definir `TEST_DATABASE_URL` somente nesse banco.
3. Rodar `pnpm test:integration`.
4. Corrigir qualquer corrida de ready/countdown/deadline.
5. Adicionar esse banco efêmero ao CI; nunca reutilizar produção.

### P0 — judge real

1. Concluir avaliação comercial/técnica de Judge0 Cloud, Judge0 self-hosted, Sphere Engine e JDoodle conforme `docs/10_CODE_JUDGE_SPEC.md`.
2. Escolher provider apenas após spike com Python, JavaScript/Node, TypeScript, Lua e C++.
3. Implementar um adapter simples de `CodeExecutionPort`; regras de Match, Submission e Practice não podem importar SDK/tipos do fornecedor.
4. Validar network deny, limites, concorrência, timeout, output cap, retenção, DPA/LGPD, logs e retry.
5. Implantar worker separado e monitorar fila, latência, 429, erros e jobs presos.
6. Só então definir `COMPETITIVE_EXECUTION_ENABLED=true`.
7. Calibrar e aprovar problemas privados antes de definir `competitive_eligible=true`.
8. Liberar primeiro unranked; liberar ranked por último com `RANKED_MATCHMAKING_ENABLED=true`.

### P1 — conteúdo

1. Criar pipeline operacional para importar problemas e testes privados sem colocá-los no repositório público.
2. Tratar os testes privados já versionados anteriormente como comprometidos; não reutilizá-los em ranked.
3. Cada problema precisa de casos de borda, limites, comparador, starter por linguagem e calibração de CPU/memória.
4. Expandir catálogo de treino sem starters resolvidos.

### P1 — experiência

1. Adicionar confirmação ao trocar de linguagem quando houver código alterado.
2. Implementar layout compacto com tabs Problema/Código/Console.
3. Persistir preferências de editor e acessibilidade.
4. Implementar histórico ranked/unranked e perfis públicos reais.
5. Criar estados de erro específicos para rate limit, runtime indisponível e perda de conexão.
6. Adicionar testes E2E de auth, prática, lobby, submit, deadline e resultado.

### P1 — observabilidade e proteção

1. Adicionar logs estruturados com request/match/submission/job IDs, sem source, e-mail, token ou testes privados.
2. Instrumentar Sentry ou equivalente no web/API/worker.
3. Monitorar health/readiness, Redis, DB pool, fila, judge e tempo de resolução.
4. Acrescentar rate limiting por IP/burst na borda sem usar IP como evidência única de fraude.
5. Definir retenção/exclusão de source e fluxo LGPD de acesso, exportação e exclusão.

## 7. Gates de release do ranked

Ranked não pode ser habilitado enquanto qualquer item abaixo estiver ausente:

- judge real implantado e testado;
- worker separado com retry, timeout e observabilidade;
- suite de integração PostgreSQL/Redis aprovada;
- problemas competitivos com testes privados novos e calibrados;
- lobby/ready/countdown validado em dois navegadores simultâneos;
- proteção de abuso e capacidade medidas em carga;
- política operacional para indisponibilidade, anulação e suporte;
- revisão de privacidade/LGPD do fornecedor de execução.

## 8. Comandos de retomada

```powershell
pnpm install --frozen-lockfile
pnpm lint
pnpm test
pnpm --filter @devleague/web build
pnpm dev:web
```

Para desenvolvimento real contra serviços remotos, usar opt-in consciente. Não colocar secrets em arquivos rastreados e não copiar valores reais para este documento.

## 9. Decisão futura obrigatória para menores

A alpha continua temporariamente 18+ por autodeclaração, sem documento ou biometria. Antes de abrir para menores de 18 anos é obrigatório revisar privacidade/LGPD, proteção de crianças e adolescentes, idade/consentimento quando aplicável, moderação, retenção e privacy-by-design. Isso é gate de produto futuro; DevLeague não é definido como produto permanentemente 18+.
