# 06 — Requisitos não funcionais

Valores quantitativos são **hipóteses/SLOs iniciais para a alpha**, a validar em carga e produção. Não são SLA comercial.

## Segurança

| ID | Pri. | Requisito verificável |
|---|---|---|
| RNF-SEC-001 | MUST | Código não confiável não executa no processo/rede/conta cloud da aplicação; provider usa isolamento por execução. |
| RNF-SEC-002 | MUST | Rede de execução é negada; filesystem é efêmero, mínimo e descartado; CPU, wall time, memória, processos, arquivo e saída têm limites. |
| RNF-SEC-003 | MUST | Secrets ficam em secret manager/env protegido, nunca repo, payload ao judge, cliente ou logs. |
| RNF-SEC-004 | MUST | Todo acesso privado aplica autenticação e autorização server-side; IDs não concedem acesso. |
| RNF-SEC-005 | MUST | TLS em trânsito; criptografia gerenciada em repouso para banco, backups e storage de código. |
| RNF-SEC-006 | MUST | Rate limit por usuário/IP/contexto em auth, Run, Submit, fila, convite e realtime. |
| RNF-SEC-007 | MUST | Validar payloads por allowlist, tamanho e schema; saída renderizada como texto, sem HTML executável. |
| RNF-SEC-008 | MUST | Proteções contra XSS, SQL injection, CSRF conforme estratégia de token/cookie, SSRF e WebSocket abuse. |
| RNF-SEC-009 | MUST | Dependências passam análise de vulnerabilidade e lockfile; correção crítica tem procedimento. |
| RNF-SEC-010 | MUST | Callbacks do provider usam segredo/assinatura ou polling autenticado, replay protection e correlação opaca. |
| RNF-SEC-011 | SHOULD | Threat model é revisado antes da alpha e após troca de provider/isolamento. |

## Performance

| ID | Pri. | SLO inicial |
|---|---|---|
| RNF-PERF-001 | SHOULD | API comum p95 < 400 ms e p99 < 1 s, excluindo judge e terceiros, na carga-alvo. |
| RNF-PERF-002 | SHOULD | Propagação realtime backend→cliente p95 < 250 ms na região da alpha. |
| RNF-PERF-003 | SHOULD | Match found→countdown pronto p95 < 2 s após ambos confirmarem. |
| RNF-PERF-004 | SHOULD | Overhead interno Submit→provider p95 < 500 ms sem fila saturada. |
| RNF-PERF-005 | MUST | UI mostra ack de Submit em até 1 s ou estado explícito de conectividade; não simula sucesso. |
| RNF-PERF-006 | SHOULD | Home LCP p75 < 2,5 s em rede móvel razoável; editor carregado sob demanda. |

## Confiabilidade e consistência

| ID | Pri. | Requisito |
|---|---|---|
| RNF-REL-001 | MUST | Exatamente um resultado terminal por partida e no máximo uma aplicação de rating. |
| RNF-REL-002 | MUST | Commands mutáveis relevantes aceitam idempotência e são seguros a retry. |
| RNF-REL-003 | MUST | Estado persistido vence cache/evento; reconexão sempre pode obter snapshot. |
| RNF-REL-004 | SHOULD | Disponibilidade mensal da aplicação na alpha ≥99,5%, medida e não prometida comercialmente. |
| RNF-REL-005 | MUST | Degradação do provider bloqueia novas partidas ranked se a justiça não puder ser garantida. |
| RNF-REL-006 | MUST | Backup diário, PITR quando disponível; hipótese RPO ≤24 h e RTO ≤8 h para alpha. |
| RNF-REL-007 | MUST | Relógios de servidores sincronizados; comparação competitiva não usa relógio cliente. |

## Escalabilidade e capacidade

| ID | Pri. | Requisito |
|---|---|---|
| RNF-SCALE-001 | SHOULD | Teste de carga valida ao menos 100 partidas simultâneas/200 conexões e burst de 20 submits/s antes da abertura correspondente. |
| RNF-SCALE-002 | MUST | Backpressure limita fila; saturação retorna erro recuperável e não aceita trabalho sem capacidade indefinida. |
| RNF-SCALE-003 | SHOULD | Backend permanece stateless onde possível; estado efêmero compartilhado permite mais de uma instância quando necessário. |

## Privacidade e LGPD

| ID | Pri. | Requisito |
|---|---|---|
| RNF-PRIV-001 | MUST | Inventário associa dado, finalidade, base legal proposta, acesso, retenção e descarte; revisão jurídica antes da alpha. |
| RNF-PRIV-002 | MUST | Código, e-mail, IP e identificadores não entram em analytics/logs além do estritamente necessário; preferir IDs pseudônimos. |
| RNF-PRIV-003 | MUST | Aviso claro informa processamento por suboperador de judge e eventual transferência internacional. |
| RNF-PRIV-004 | MUST | Contrato/DPA do provider define retenção, exclusão, incidentes, suboperadores e localização. |
| RNF-PRIV-005 | MUST | Processo atende confirmação, acesso, correção, portabilidade/exportação e exclusão conforme validação jurídica. |
| RNF-PRIV-006 | MUST | Alpha registra autodeclaração 18+ sem coletar documento/biometria. |
| RNF-PRIV-007 | MUST | Abrir a menores é bloqueado até revisão LGPD, ECA/ECA Digital, melhor interesse, aferição etária/consentimento e DPIA/RIPD quando indicado. |
| RNF-PRIV-008 | SHOULD | Ambientes não produtivos usam dados sintéticos; acesso excepcional a código é auditado. |

Isto não é aconselhamento jurídico. Referências oficiais: [LGPD](https://www.planalto.gov.br/ccivil_03/_ato2015-2018/2018/lei/l13709.htm), [materiais ANPD](https://www.gov.br/anpd/pt-br/centrais-de-conteudo/materiais-educativos-e-publicacoes) e [orientações de aferição etária/ECA Digital](https://www.gov.br/anpd/pt-br/assuntos/noticias/anpd-publica-orientacoes-preliminares-e-cronograma-para-afericao-de-idade-no-ambiente-digital), consultadas em 2026-08-11.

## Acessibilidade e UX

| ID | Pri. | Requisito |
|---|---|---|
| RNF-A11Y-001 | MUST | Alvo WCAG 2.2 AA nas telas próprias, com contraste, foco visível e sem informação só por cor. |
| RNF-A11Y-002 | MUST | Fluxos principais operáveis por teclado; atalhos do editor não aprisionam foco e são documentados. |
| RNF-A11Y-003 | MUST | Atualizações de matchmaking/veredito/resultado têm anúncios de leitor de tela sem excesso. |
| RNF-A11Y-004 | MUST | Respeitar `prefers-reduced-motion`; countdown mantém alternativa textual. |
| RNF-UX-001 | MUST | Erros distinguem usuário, conectividade e sistema, com próxima ação segura. |
| RNF-UX-002 | SHOULD | Landing, home, perfil, histórico e settings funcionam a partir de 320 px; editor competitivo assume desktop/tablet largo. |

## Observabilidade

| ID | Pri. | Requisito |
|---|---|---|
| RNF-OBS-001 | MUST | Logs JSON com timestamp, nível, serviço, request/trace ID e IDs técnicos; sem source code/tokens/secrets. |
| RNF-OBS-002 | MUST | Métricas cobrem API, WebSocket, filas, judge, matchmaking, partidas, rating e falhas por classe. |
| RNF-OBS-003 | SHOULD | Tracing distribuído atravessa HTTP→fila→provider/callback sem anexar código. |
| RNF-OBS-004 | MUST | Alertas para fila, erro sistêmico, taxa de conexão, mismatch de rating e saturação. |
| RNF-OBS-005 | MUST | Trilha de auditoria para publicação de problema, suspensão, alteração administrativa e correção de resultado. |

## Manutenibilidade e portabilidade

| ID | Pri. | Requisito |
|---|---|---|
| RNF-MAINT-001 | MUST | Módulos de domínio não importam SDK/tipos do provider de judge. |
| RNF-MAINT-002 | MUST | Migrations versionadas, forward-only em produção e plano de rollback compatível. |
| RNF-MAINT-003 | MUST | APIs/eventos têm schema e compatibilidade; breaking change exige versão/migração. |
| RNF-MAINT-004 | SHOULD | Uma troca de provider requer novo adapter/configuração, não alteração de Match/Submission/Practice. |
| RNF-MAINT-005 | MUST | Versões de runtime, algoritmo de rating e problema são persistidas para reprodutibilidade. |

