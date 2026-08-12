# 15 — Roadmap e validação

Versões são horizontes, não compromissos de calendário. Cada passagem depende de evidência.

## V0.1 — Competição

**Hipótese:** X1 é divertido e gera repetição.  
**Entrega:** escopo de [02_ESCOPO_MVP_V0_1.md](02_ESCOPO_MVP_V0_1.md).  
**Sequência recomendada:**

1. Protótipo testável do fluxo Home→X1→Resultado.
2. Spike de provider e golden problem set.
3. Auth/perfil/problemas/Practice.
4. X1 privado end-to-end, sem rating.
5. Matchmaking e rating.
6. Hardening, observabilidade, alpha fechada 18+.

### Métricas de produto

- `match_completion_rate`: partidas active que chegam a resultado não-void.
- `repeat_intent_rate`: concluidores que clicam revanche/nova partida.
- `same_session_replay_rate`: concluidores que iniciam outra partida na sessão.
- `D1/D7 competitive return`: participantes que voltam para outra partida.
- `rematch_accept_rate`: revanche criada que inicia.
- `time_to_match`: fila→match found, segmentado por rating/horário.
- `private_invite_conversion`: convite criado→partida iniciada.
- `abandon/forfeit/disconnect_rate` separados.
- pesquisa curta de justiça/diversão após amostra, não a cada partida.

### Métricas técnicas/guardrails

- erro sistêmico e void por 100 partidas;
- latência Submit→veredito p50/p95/p99 por linguagem/provider;
- fila do judge e rate limit;
- reconnect/recovery e gaps;
- mismatch/invariante de resultado/rating (meta operacional: zero);
- custo por Run, Submit e partida concluída;
- exposure repetida e diferenças de runtime.

### Métricas de vaidade

Cadastros totais, page views, linhas de código, Runs e seguidores não demonstram hipótese isoladamente. Podem contextualizar alcance, nunca justificar avanço sozinhos.

### Hipóteses numéricas iniciais

Somente para decidir se a alpha merece iteração; recalibrar após primeira coorte:

- ≥60% das partidas `ACTIVE` concluídas sem forfeit/void;
- ≥35% dos concluidores iniciam ação de repetir na mesma sessão;
- ≥20% jogam outra partida em até 7 dias;
- <2% partidas void por falha técnica;
- p95 de Submit→veredito <5 s para problemas calibrados sem fila saturada;
- mediana de matchmaking <60 s nos períodos em que houver densidade suficiente.

Amostra pequena exige intervalos/segmentação e pesquisa qualitativa. Falhar uma hipótese orienta investigação, não encerramento automático.

## Checkpoint V0.1→V0.5

Avançar somente se repetição/retorno forem promissores, justiça for aceitável e falhas/custo tiverem caminho viável. Se usuários preferirem Practice ou convite mas não matchmaking, iterar proposta antes de gamificação.

## V0.5 — Retenção/gamificação

Possíveis XP, level, streak ética, daily challenge, achievements, leaderboard, temporadas e ligas simples. Cada mecanismo precisa guardrail contra pay-to-win/manipulação. Não implementar antes do checkpoint.

## V1.0 — B2C sustentável

Pro vende melhora, não vantagem: analytics, análise, treinamento e tutor. Free continua bom; anúncios tecnológicos curados nunca durante partida. Validar preço/disposição a pagar antes de construir pacote amplo.

## V2.0 — Education

Teacher/Classroom, autograding, analytics, integridade baseada em evidência, workspace web/VS Code e IA assistiva. Marketplace é posterior. Requer arquitetura/privacidade própria, especialmente menores.

## V3.0 — Talent

Discover opt-in, Assess e Verified Skills sob condições claras. Rating competitivo não vira nota profissional.

## V4.0 — Platform API

Execution/Judge/Assessment/Autograding APIs, SDKs, quotas e billing. Extração parte de capacidade interna comprovada; não publicar contrato interno como API externa por acidente.

## V5+

Ligas universitárias, campeonatos, patrocínio, white-label e expansão internacional, sujeitos a evidência.

## Gate para abrir a menores de 18 anos

**DECISÃO FUTURA OBRIGATÓRIA.** Antes de remover a restrição 18+:

1. revisão jurídica brasileira específica de LGPD, ECA e Lei nº 15.211/2025 (ECA Digital), regulamentação vigente e relações de consumo;
2. definir faixas etárias, melhor interesse, bases legais e consentimento/responsável quando aplicável;
3. avaliar mecanismo proporcional e privacy-preserving de aferição etária — autodeclaração isolada não deve ser presumida suficiente;
4. revisar perfil público, matchmaking/comunicação, denúncia, moderação, publicidade futura e coleta de telemetria;
5. RIPD/DPIA e mapa de riscos quando recomendado;
6. textos apropriados por idade, direitos do titular/responsável e processo de incidentes;
7. testes de segurança/UX com especialistas e, quando apropriado, participação responsável do público afetado;
8. contratos com suboperadores adequados a dados de crianças/adolescentes.

Fontes devem ser revalidadas, pois a ANPD publicou orientações preliminares de aferição etária em 2026 e mantém o tema como prioridade. Isto não é parecer jurídico.

## Decisões pendentes antes de implementação

- Provider/plano de judge (ADR-004).
- Prazos de retenção e bases legais finais.
- Cloud/região e orçamento operacional.
- Limiar/labels de rank visual, se entrarem na alpha; rating numérico não depende deles.

