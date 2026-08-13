# 05 — Requisitos funcionais

Prioridades: **MUST**, **SHOULD**, **COULD**. Critérios referenciam regras de [03_REGRAS_DE_NEGOCIO.md](03_REGRAS_DE_NEGOCIO.md).

## Autenticação e conta

| ID | Pri. | Requisito e aceitação |
|---|---|---|
| RF-AUTH-001 | MUST | Cadastrar por e-mail e criar username único case-insensitive; conflito retorna erro de campo sem criar perfil parcial. |
| RF-AUTH-002 | MUST | Login, logout e recuperação de acesso pelo provider; logout invalida/encerra a sessão conforme capacidade contratada. |
| RF-AUTH-003 | MUST | Registrar `terms_version`, `privacy_version`, timestamps e autodeclaração 18+ antes de liberar uso. |
| RF-AUTH-004 | MUST | Impedir usuário suspenso de entrar em fila/lobby/partida. |
| RF-AUTH-005 | SHOULD | Confirmar e-mail antes de matchmaking; regra configurável para alpha assistida. |
| RF-AUTH-006 | MUST | Preservar destino de convite após autenticação sem expor token em logs. |

## Perfil e configurações

| ID | Pri. | Requisito e aceitação |
|---|---|---|
| RF-PROFILE-001 | MUST | Exibir username, avatar opcional, rating, pico e estatísticas com universo ranked/unranked explícito. |
| RF-PROFILE-002 | MUST | Exibir últimas partidas com tipo, resultado, adversário, problema e delta quando aplicável. |
| RF-PROFILE-003 | MUST | Permitir alterar username respeitando unicidade e cooldown configurado. |
| RF-PROFILE-004 | SHOULD | Permitir selecionar linguagens preferidas; isso não restringe matchmaking. |
| RF-PRIV-001 | MUST | Permitir solicitação autenticada de exportação e exclusão, ainda que assistida na alpha. |

## Problemas e Practice

| ID | Pri. | Requisito e aceitação |
|---|---|---|
| RF-PROBLEM-001 | MUST | Listar somente problemas publicados para Practice com dificuldade/categoria e paginação. |
| RF-PROBLEM-002 | MUST | Entregar enunciado versionado, exemplos, restrições e starter code sem testes privados. |
| RF-PROBLEM-003 | MUST | Registrar exposição ao abrir problema e ao iniciar partida. |
| RF-PROBLEM-004 | MUST | Operador autorizado consegue criar versão, validar, publicar e desativar por procedimento seguro. |
| RF-PRACTICE-001 | MUST | Executar código em testes públicos/input e retornar saída/veredito sem alterar rating. |
| RF-PRACTICE-002 | MUST | Submeter solução aos testes privados e persistir veredito próprio. |
| RF-PRACTICE-003 | SHOULD | Filtrar catálogo por linguagem compatível, dificuldade e categoria. |

## Editor

| ID | Pri. | Requisito e aceitação |
|---|---|---|
| RF-EDITOR-001 | MUST | Monaco oferece syntax highlighting para cinco linguagens e navegação por teclado documentada. |
| RF-EDITOR-002 | MUST | Trocar linguagem com confirmação quando puder descartar código; carregar starter correspondente. |
| RF-EDITOR-003 | MUST | Exibir estados de Run/Submit, console, erros de compilação e vereditos acessíveis. |
| RF-EDITOR-004 | SHOULD | Salvar rascunho local por usuário/contexto sem misturar partidas. |

## Convite e lobby

| ID | Pri. | Requisito e aceitação |
|---|---|---|
| RF-LOBBY-001 | MUST | Criar convite unranked com link/código aleatório e expiração; não retornar segredo após criação além do necessário. |
| RF-LOBBY-002 | MUST | Entrar idempotentemente, rejeitando expirado, cheio, inválido ou auto-desafio. |
| RF-LOBBY-003 | MUST | Exibir dois participantes, conexão, `Sem rating` e ready check. |
| RF-LOBBY-004 | MUST | Iniciar countdown somente com dois ready e congelar seleção. |
| RF-LOBBY-005 | MUST | Revanche cria nova partida privada unranked e exige ready novamente. |

## Matchmaking

| ID | Pri. | Requisito e aceitação |
|---|---|---|
| RF-MM-001 | MUST | Entrar/sair da fila de modo idempotente e impedir presença concorrente em outro contexto ativo. |
| RF-MM-002 | MUST | Parear por faixa de rating progressiva configurável e criar exatamente uma partida por par. |
| RF-MM-003 | MUST | Remover entradas sem heartbeat e recuperar fila após falha sem duplicar partidas. |
| RF-MM-004 | SHOULD | Exibir tempo de espera e estado, sem prometer estimativa inexata como certeza. |

## Partida e realtime

| ID | Pri. | Requisito e aceitação |
|---|---|---|
| RF-MATCH-001 | MUST | Entregar o mesmo snapshot de problema/versionamento a ambos e timestamps do servidor. |
| RF-MATCH-002 | MUST | Aplicar lifecycle permitido; transição inválida é rejeitada e observável. |
| RF-MATCH-003 | MUST | Não pausar relógio por desconexão ou execução. |
| RF-MATCH-004 | MUST | Ressincronizar por snapshot após reconexão e preservar sequência monotônica de eventos. |
| RF-MATCH-005 | MUST | Permitir abandono explícito com confirmação e finalizar por forfeit. |
| RF-MATCH-006 | MUST | Encerrar novas submissões no prazo e resolver as já admitidas. |
| RF-MATCH-007 | MUST | Mostrar somente presença e contagem de submissões do adversário; nunca código/veredito detalhado durante a partida. |

## Judge e submissão

| ID | Pri. | Requisito e aceitação |
|---|---|---|
| RF-JUDGE-001 | MUST | Backend valida linguagem, tamanho, contexto, limites e autorização antes de enfileirar. |
| RF-JUDGE-002 | MUST | Porta interna normaliza request/result e esconde IDs/status específicos do provider. |
| RF-JUDGE-003 | MUST | Run e Submit possuem filas/prioridades/limites e chaves de idempotência. |
| RF-JUDGE-004 | MUST | Executar todos os testes privados necessários sem revelá-los ao cliente. |
| RF-JUDGE-005 | MUST | Normalizar vereditos canônicos, tempo, memória, stdout/stderr truncados e erro sistêmico. |
| RF-JUDGE-006 | MUST | Callback/polling é autenticado/correlacionado e processamento repetido é idempotente. |
| RF-JUDGE-007 | MUST | Falha sistêmica nunca vira Wrong Answer, derrota ou delta de rating. |
| RF-JUDGE-008 | SHOULD | Circuit breaker e backoff limitam cascata durante degradação do provider. |

## Resultado e rating

| ID | Pri. | Requisito e aceitação |
|---|---|---|
| RF-RESULT-001 | MUST | Finalizar com um único resultado por transação e escolher o menor `admission_seq` Accepted, mesmo com avaliações simultâneas ou fora de ordem. |
| RF-RESULT-002 | MUST | Exibir razão, tempo, submissões e ações de repetição. |
| RF-RATE-001 | MUST | Calcular Elo versionado somente para `RANKED_PUBLIC` com resultado válido. |
| RF-RATE-002 | MUST | Persistir rating dos dois, deltas, pico e histórico na mesma transação da partida. |
| RF-RATE-003 | MUST | Partida privada, cancelada ou void produz delta zero e indicação explícita. |
| RF-RATE-004 | MUST | Reprocessar resultado idempotentemente sem aplicar rating duas vezes. |

## Telemetria e operação

| ID | Pri. | Requisito e aceitação |
|---|---|---|
| RF-OPS-001 | MUST | Health/readiness distinguem aplicação, banco, Redis/fila e provider. |
| RF-OPS-002 | MUST | Operador correlaciona match → submission → execution sem consultar código em log comum. |
| RF-OPS-003 | SHOULD | Desativar problema impede novas partidas e preserva partidas existentes. |
| RF-AN-001 | MUST | Emitir eventos de funil definidos no roadmap com IDs pseudônimos e versão de schema. |
| RF-AN-002 | MUST | Separar falha técnica, abandono, empate e derrota em métricas. |

## Matriz resumida

| Área | Regras | Specs/testes |
|---|---|---|
| Competição | RN-MATCH/RN-RESULT/RN-RATE | 11, 14 |
| Judge | RN-SUB | 10, 14 |
| Problemas | RN-PROB/RN-LANG | 08, 10 |
| Privacidade | RN-PRIV/RN-AUTH | 06, 08, 15 |
