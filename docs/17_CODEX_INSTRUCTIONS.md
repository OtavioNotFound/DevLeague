# 17 — Instruções para agentes de implementação

Estas regras valem para qualquer agente humano/automatizado que modifique o projeto.

## Antes de alterar

1. Leia `README.md` e os documentos relevantes.
2. Declare quais IDs de requisito/regra/ADR serão atendidos.
3. Verifique estado do repositório e preserve alterações alheias.
4. Se documentação e código divergirem, pare e registre a inconsistência; não escolha silenciosamente.
5. Diferencie `MVP` de `FUTURE`. Não implemente futuro sem solicitação explícita e atualização de escopo.
6. Para decisão significativa pendente, apresente alternativas/risco e aguarde aprovação.

## Arquitetura

7. Preserve o monólito modular; não introduza microservice sem necessidade comprovada e ADR.
8. Frontend não acessa banco, Redis ou judge diretamente.
9. Nunca execute código do usuário no processo/container/rede/conta da aplicação.
10. Domínio não importa SDK, status ou payload do provider de judge. Use `CodeExecutionPort` e um adapter simples.
11. Worker normaliza resultado; Match decide vencedor; Ratings altera rating.
12. PostgreSQL é fonte de verdade. Redis/cache/evento não decide resultado.
13. Servidor é autoridade de tempo, estado, resultado e rating. Ignore timestamps competitivos do cliente.
14. Não criar plugin framework/multi-provider failover no MVP.
15. Education/Talent/API pública não entram no schema MVP.

## Mudanças e dependências

16. Prefira mudanças pequenas, verificáveis e reversíveis.
17. Não adicione dependência sem justificar capacidade, alternativas, licença, manutenção, segurança e custo.
18. Preserve contratos; breaking change exige versionamento/migração/documentação.
19. Toda migration deve ser versionada, revisada, testada em upgrade e acompanhada de impacto/rollback.
20. Não altere regra de negócio, parâmetro de rating ou versão de runtime silenciosamente.
21. Atualize documentação quando comportamento/contrato/decisão mudar; ADR para decisão significativa.

## Segurança e privacidade

22. Nunca armazene secrets no repositório, logs, cliente, fixture ou payload ao judge.
23. Nunca registre source code, teste privado, token, e-mail ou IP indiscriminadamente.
24. Autorize por recurso/participação no servidor; conhecer UUID/room não concede acesso.
25. Valide schema, tamanho, rate e idempotência em HTTP, jobs, callbacks e sockets.
26. Falha do provider é `SYSTEM_ERROR`, nunca WA/derrota automática.
27. Novos campos pessoais exigem finalidade, base/avaliação jurídica, retenção, acesso e exclusão documentados.
28. A alpha é 18+ por autodeclaração. Não construa verificação complexa nem abra a menores sem cumprir o gate do roadmap.

## Testes obrigatórios

29. Escreva testes para regra alterada; nomeie com IDs relevantes.
30. Concorrência crítica usa PostgreSQL real: Accepted simultâneo, forfeit/timeout, outbox e rating exactly-once.
31. Adapter de judge passa contract suite comum e testes de falha/limite.
32. Realtime testa reconexão, evento perdido/duplicado, snapshot e authz de rooms.
33. UI principal testa teclado, foco, contraste, reduced motion e estados loading/empty/error/offline.
34. Nunca reduza cobertura/gate para “fazer passar” sem explicar e obter aprovação.

## Ao entregar

35. Informe arquivos alterados, requisitos atendidos, decisões, migrations, configuração e compatibilidade.
36. Liste comandos/testes executados e resultados; não diga “testado” sem evidência.
37. Liste pendências/riscos reais e passos operacionais, sem esconder falhas.
38. Não marque concluído enquanto requisito MUST ou gate relevante estiver aberto.

## Checklist de PR

- [ ] Escopo e IDs declarados.
- [ ] Sem feature FUTURE vazando.
- [ ] Authz/idempotência/limites considerados.
- [ ] Nenhum source/secret/PII em log.
- [ ] Invariantes transacionais preservadas.
- [ ] Testes adequados passaram.
- [ ] API/eventos/migrations documentados.
- [ ] Observabilidade e erro do usuário vs sistema corretos.
- [ ] Acessibilidade/responsividade avaliadas.
- [ ] README/docs/ADR atualizados.

