# 14 — Estratégia de testes

## 1. Princípios

- Testar invariantes no nível mais barato que oferece confiança.
- Concorrência, judge e realtime exigem integração realista; mocks isolados não bastam.
- Provider real é testado em staging com quotas; CI comum usa fake adapter determinístico.
- Nenhum fixture/log de teste deve conter source/credencial real de usuário.

## 2. Pirâmide

| Camada | Foco | Execução |
|---|---|---|
| Unit | rating, state machine, seleção, normalização, limites | todo PR |
| Integration | PostgreSQL/Redis/outbox/auth verifier/fake judge | todo PR |
| Contract | HTTP/OpenAPI, eventos, CodeExecutionPort e adapter vendor | PR/nightly |
| E2E | cadastro→practice e dois browsers→partida→revanche | merge/release |
| Load/chaos | sockets, fila, concorrência, restarts/degradação | pré-release |
| Security | SAST/SCA/DAST, authz, sandbox probes | contínuo + gate |
| Accessibility | axe + teclado/leitor manual | PR/release |

## 3. Casos unitários críticos

- Todas as transições válidas/inválidas de Match.
- Deadline: antes, exatamente no instante persistido e depois.
- Elo: vitória/derrota/empate, clamp, pico, K/versionamento.
- Private/void nunca chama Rating.
- Seleção evita exposure/cooldown e fallback marca repetição.
- Mapeamento de todos os status de cada provider; status desconhecido→SYSTEM_ERROR.
- Truncamento de output e validação de source/payload.

## 4. Integração/concorrência

Testes contra PostgreSQL real em container/ambiente isolado:

1. duas Accepted simultâneas ou callbacks fora de ordem → vence o menor `admission_seq`, com um winner/um outbox;
2. callback duplicado → uma transição;
3. forfeit vs Accepted → ordem serializada consistente;
4. timeout vs Submit admitido → elegibilidade por timestamp do backend;
5. duas criações de queue/lobby → um engagement ativo;
6. rating aplicado duas vezes → unique impede;
7. falha após commit antes de publish → outbox republica;
8. deadlock/race de duas rating accounts → lock ordenado e retry controlado.

## 5. Contract tests do judge

Suite comum executada contra fake e cada candidato:

- hello/golden nas quatro linguagens;
- CE, WA, RE, TLE, MLE e output limit;
- Unicode/PT-BR, newline/whitespace e floating tolerance;
- callback/polling duplicado, atrasado, 429, 5xx e payload desconhecido;
- network/DNS, filesystem, environment, fork, threads, sleep e output bomb;
- IDs não vazam ao domínio/cliente.

Spike completo em [10_CODE_JUDGE_SPEC.md](10_CODE_JUDGE_SPEC.md#11-spike-de-aceitação).

## 6. E2E essenciais

- Cadastro 18+, conflito username e recuperação.
- Convite preservado por login; expirado/cheio.
- X1 privado completo e revanche com delta zero.
- Matchmaking público completo com dois deltas opostos conforme fórmula.
- Desconexão/reload de um browser; snapshot e relógio correto.
- Timeout sem Accepted; pending admitida antes do prazo.
- Provider devolve Accepted posterior antes da submissão anterior; partida aguarda e escolhe pela admissão.
- Provider falha; UI informa sistema e rating não muda.
- Profile separa ranked/unranked.
- Export/delete request autenticado.

## 7. Realtime

- Ordem, duplicação e gap de eventos.
- Recovery nativa bem-sucedida e fallback snapshot.
- Token inválido/expirado, join em room alheia, payload grande/flood.
- Backend restart, Redis restart e reconnection storm.
- Contagem do rival não revela veredito/código.

## 8. Carga e SLOs

Cenário mínimo: 200 sockets/100 matches simultâneas, heartbeats, Runs e burst de 20 Submits/s. Medir API/realtime/queue/provider separadamente, saturar progressivamente e provar backpressure. Dataset inclui runtime lento/rápido. Não realizar teste destrutivo contra vendor sem autorização.

Critérios iniciais são os RNF-PERF/SCALE. Resultado registra hardware/região/versão/custo e data; números sem contexto não aprovam release.

## 9. Segurança

- Threat model review e abuse cases.
- SAST, secret scan, dependency/container scan e lockfile.
- DAST para auth, IDOR, injection, XSS, CSRF, CORS, rate limit e WebSocket authz.
- Sandbox probes aprovados pelo provider; sem tentar explorar infraestrutura de terceiros além do escopo contratado.
- Backup restore, secret rotation e callback replay.
- Revisão manual de endpoints que retornam teste/código/perfil.

Achado crítico/alto sem mitigação aceita bloqueia alpha.

## 10. Acessibilidade/compatibilidade

Chrome, Firefox, Edge e Safari atuais suportados na medida da alpha; matriz final baseada em analytics consentido. Teste 200% zoom, teclado, contraste, reduced motion e leitor de tela em cadastro, fila, X1 e resultado. Monaco recebe roteiro manual específico.

## 11. Dados e migrations

- Migration em banco vazio e upgrade do snapshot anterior.
- Constraints/invariantes testadas diretamente.
- Seed contém problemas sintéticos, nunca testes privados reais no bundle público.
- Restore de backup em staging e validação de RPO/RTO.

## 12. Gates de release

- Unit/integration/contract/E2E verdes e sem flaky conhecido crítico.
- Concorrência Accepted/forfeit/timeout aprovada repetidamente.
- SLO de carga compatível com tamanho anunciado da alpha.
- Provider scorecard/DPA/spike aprovados.
- Threat model e revisão jurídica/privacidade concluídos.
- Observabilidade/alertas e runbooks ensaiados.
- A11y principal sem violações críticas.

## 13. Rastreabilidade mínima

Nomear testes com IDs (`RF-MATCH-006`, `RNF-REL-001`). Um relatório de release lista requisitos MUST cobertos, teste/monitor correspondente e exceções aprovadas. Requisito sem teste ou verificação operacional não é considerado concluído.
