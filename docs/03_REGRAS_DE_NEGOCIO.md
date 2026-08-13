# 03 — Regras de negócio

Este documento é a fonte principal das regras competitivas. IDs `RN-*` devem ser citados por requisitos, APIs e testes.

## 1. Conta e elegibilidade

- **RN-AUTH-001:** username é único sem diferenciar maiúsculas/minúsculas; forma canônica é minúscula e forma de exibição preserva casing permitido.
- **RN-AUTH-002:** usuário precisa de conta ativa e sessão válida para Practice com persistência, X1 e matchmaking.
- **RN-AUTH-003:** na alpha, o usuário MUST declarar ter 18 anos ou mais e aceitar termos/privacidade versionados.
- **RN-AUTH-004:** banimento ou suspensão impede criar/entrar em partida; partida ativa pode ser encerrada administrativamente sem recalcular silenciosamente resultados anteriores.
- **RN-AUTH-005:** e-mail nunca é público. Perfil usa pseudônimo; nome real não é necessário.

## 2. Tipos de partida

- **RN-MATCH-001:** `RANKED_PUBLIC` nasce exclusivamente do matchmaking público e altera rating quando concluída com resultado competitivo válido.
- **RN-MATCH-002:** `PRIVATE_UNRANKED` nasce de convite e nunca altera rating, inclusive em revanche.
- **RN-MATCH-003:** histórico e métricas separam ranked de unranked.
- **RN-MATCH-004:** uma revanche privada cria nova partida unranked com novo problema elegível quando possível.
- **RN-MATCH-005:** revanche de uma partida pública é privada/unranked na V0.1; voltar a jogar ranked exige reentrar no matchmaking.

## 3. Criação e lobby

- **RN-LOBBY-001:** convite usa token aleatório, armazenado de forma não reversível quando possível, com expiração padrão de 30 minutos.
- **RN-LOBBY-002:** link não autenticado redireciona ao login e preserva o destino; autenticação não garante vaga.
- **RN-LOBBY-003:** lobby comporta exatamente dois participantes distintos.
- **RN-LOBBY-004:** ambos devem marcar `ready`; o servidor inicia countdown de 5 segundos e congela participantes/problema.
- **RN-LOBBY-005:** sair antes do início cancela o lobby sem resultado, rating ou registro de derrota.
- **RN-LOBBY-006:** um usuário não pode estar em mais de uma fila/lobby/partida ativa.

## 4. Matchmaking

- **RN-MM-001:** fila é particionada por região operacional e compatibilidade de pool, não por linguagem escolhida.
- **RN-MM-002:** faixa inicial recomendada é ±100 rating e expande em passos configuráveis a cada período; valores são configuração, não regra codificada.
- **RN-MM-003:** pares não podem ser o mesmo usuário e SHOULD evitar repetição imediata quando houver alternativa.
- **RN-MM-004:** entrada na fila é idempotente; saída remove a presença. Expiração de heartbeat remove entradas órfãs.
- **RN-MM-005:** rating usado para pareamento é o snapshot vigente ao entrar; atualização final usa rating imediatamente anterior à transação de resultado.

## 5. Seleção do problema

- **RN-PROB-001:** partida usa problema publicado, ativo e `competitive_eligible`.
- **RN-PROB-002:** ambos recebem a mesma versão imutável de enunciado, testes e limites.
- **RN-PROB-003:** seletor exclui, quando possível, problemas já expostos a qualquer participante e problemas em cooldown recente.
- **RN-PROB-004:** se não houver candidato inédito, prioriza o menos recentemente visto por ambos e registra `repeated_exposure=true` para análise; não oculta a limitação operacional.
- **RN-PROB-005:** Practice pode usar o mesmo catálogo, mas conhecer um problema torna-o inelegível para aquele jogador quando houver alternativa competitiva.
- **RN-PROB-006:** alteração publicada cria nova versão; partida iniciada continua referenciando a versão congelada.
- **RN-PROB-007:** testes privados e solução editorial nunca são enviados ao cliente.

## 6. Linguagem

- **RN-LANG-001:** cada jogador escolhe independentemente Python, JavaScript, TypeScript, Lua ou C++ antes ou durante a partida.
- **RN-LANG-002:** mudança de linguagem troca starter code após confirmação se houver código não vazio; não altera relógio.
- **RN-LANG-003:** versão do runtime e limites efetivos são resolvidos no servidor.
- **RN-LANG-004:** o problema MUST ter solução de referência e calibração nas cinco linguagens antes de ser competitivo.

## 7. Relógio e estados

- **RN-TIME-001:** duração padrão é 600 segundos, configurada no servidor e congelada na partida.
- **RN-TIME-002:** horário oficial deriva de `starts_at` e `ends_at` do servidor. O cliente apenas renderiza estimativa.
- **RN-TIME-003:** desconexão, troca de aba, execução ou fila do judge não pausa o relógio.
- **RN-TIME-004:** submissão competitiva é elegível se aceita pelo backend antes de `ends_at`; conclusão do judge pode ocorrer depois.
- **RN-TIME-005:** após `ends_at`, nenhuma nova submissão é aceita; submissões elegíveis pendentes são aguardadas até um deadline técnico configurado.

Estados principais: `WAITING_PLAYERS → READY_CHECK → COUNTDOWN → ACTIVE → RESOLVING → FINISHED` ou `CANCELLED`.

## 8. Execução e submissão

- **RN-SUB-001:** `Run` usa testes públicos/custom input permitido e nunca pode produzir vitória.
- **RN-SUB-002:** `Submit` cria submissão imutável contra todos os testes privados aplicáveis.
- **RN-SUB-003:** cliente fornece chave de idempotência; reenvio não cria submissão competitiva duplicada.
- **RN-SUB-004:** rate limits distintos se aplicam a Run e Submit; resposta informa retry seguro.
- **RN-SUB-005:** código submetido é armazenado fora de logs, com acesso restrito e retenção definida em [08_MODELO_DE_DADOS.md](08_MODELO_DE_DADOS.md).
- **RN-SUB-006:** veredictos canônicos: `QUEUED`, `RUNNING`, `ACCEPTED`, `WRONG_ANSWER`, `COMPILE_ERROR`, `RUNTIME_ERROR`, `TIME_LIMIT_EXCEEDED`, `MEMORY_LIMIT_EXCEEDED`, `OUTPUT_LIMIT_EXCEEDED`, `SYSTEM_ERROR`, `CANCELLED`.
- **RN-SUB-007:** erro do provider/sistema não é erro do jogador e não determina derrota.

## 9. Vitória, empate e simultaneidade

- **RN-RESULT-001:** vence a submissão elegível com menor `admission_seq` entre as que obtiverem `ACCEPTED`. A sequência é atribuída pelo backend no recebimento, sob lock da partida.
- **RN-RESULT-002:** timestamps do cliente/provider e a ordem em que o provider devolve resultados não decidem o vencedor. `eligible_received_at` e `admission_seq` são autoritativos e persistidos pelo backend.
- **RN-RESULT-003:** ao receber um Accepted, o servidor só finaliza se não existir submissão elegível anterior ainda pendente. Se existir, mantém `RESOLVING`; quando as anteriores terminarem, escolhe o menor `admission_seq` Accepted em uma transação que bloqueia a partida.
- **RN-RESULT-004:** se ninguém obtiver Accepted após o deadline das submissões pendentes, resultado é `DRAW_TIMEOUT`.
- **RN-RESULT-005:** empate deliberado por timestamps iguais não existe; `admission_seq` produz ordem total auditável por partida.
- **RN-RESULT-006:** falha sistêmica ampla que impeça competição justa resulta `VOID_SYSTEM`, sem rating.

## 10. Abandono, AFK e desconexão

- **RN-DC-001:** desconexão não encerra imediatamente a partida; usuário pode reconectar até o fim e recebe snapshot autoritativo.
- **RN-DC-002:** botão `Abandonar` durante `ACTIVE` confirma desistência: adversário vence por `FORFEIT`.
- **RN-DC-003:** fechar aba ou perder heartbeat não equivale automaticamente a desistência; o relógio continua.
- **RN-DC-004:** se um jogador nunca se conectar após match found/countdown, partida é cancelada antes de `ACTIVE`; repetição abusiva pode gerar cooldown de fila.
- **RN-DC-005:** se ambos abandonarem antes da confirmação do primeiro abandono, transação serializada determina o primeiro; casos administrativos podem ser anulados com trilha de auditoria.
- **RN-AFK-001:** ausência de execução não é infração. Vence apenas Accepted, forfeit ou regra de timeout.

## 11. Rating

- **RN-RATE-001:** na alpha fechada, rating inicial é 0 e a política tem `algorithm_version`.
- **RN-RATE-002:** V0.1 usa Elo: `E = 1 / (1 + 10^((Rb-Ra)/400))`; `novo = antigo + K*(S-E)`.
- **RN-RATE-003:** hipótese inicial `K=32`; empate usa `S=0.5`. Parâmetros são configuração versionada.
- **RN-RATE-004:** vitória por Accepted ou forfeit em ranked altera rating; draw timeout altera como empate; `VOID_SYSTEM` não altera.
- **RN-RATE-005:** atualização dos dois jogadores, histórico e finalização ocorrem na mesma transação.
- **RN-RATE-006:** delta exibido vem do registro persistido, nunca é recalculado pelo cliente.
- **RN-RATE-007:** rating não pode ficar negativo; clamp é aplicado após cálculo e registrado.

## 12. Histórico e estatísticas

- **RN-HIST-001:** histórico mostra adversário, tipo, resultado, problema após conclusão, duração e delta quando ranked.
- **RN-HIST-002:** vitórias/derrotas/empates competitivos e unranked são separáveis; win rate declara o universo usado.
- **RN-HIST-003:** partida cancelada/void não conta como vitória ou derrota.
- **RN-HIST-004:** pico considera apenas rating persistido após partidas ranked.

## 13. Fair play mínimo

- **RN-FAIR-001:** contas múltiplas, automação, collusion e exploração são proibidas pelos termos; V0.1 coleta sinais mínimos, sem detector acusatório.
- **RN-FAIR-002:** limite por conta/IP/dispositivo pode reduzir abuso, mas não pode ser única evidência de fraude.
- **RN-FAIR-003:** moderação humana pode suspender acesso; reversão de rating é operação auditada, não requisito da alpha salvo incidente grave.
- **RN-FAIR-004:** uso de LLM durante partida deve ser declarado proibido nos termos da alpha, mas não haverá monitoramento invasivo do computador.

## 14. Privacidade

- **RN-PRIV-001:** coletar somente identidade técnica, aceite, perfil, atividade necessária, submissões e telemetria definida.
- **RN-PRIV-002:** código não é reutilizado para treinar modelos ou fim incompatível sem base e transparência específicas.
- **RN-PRIV-003:** exportação/exclusão podem ser assistidas na alpha, com autenticação do titular e prazo documentado.
- **RN-PRIV-004:** abertura a menores exige gate jurídico e técnico futuro; a autodeclaração 18+ não é solução permanente de aferição etária.
