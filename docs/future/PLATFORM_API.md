# FUTURE — Platform API

> Fora da V0.1. Contratos internos atuais não são APIs públicas nem promessa de compatibilidade externa.

## Visão

Oferecer Execution, Judge, Submission, Testing, Autograding, Assessment e Analytics como infraestrutura para EdTechs e outras plataformas.

## Por que a arquitetura atual ajuda

`CodeExecutionPort`, vereditos normalizados, problem versioning e Submission isolam capacidade de execução. Isso facilita futura extração sem criar gateway, API keys, tenant/billing ou SDK agora.

## Requisitos futuros

- Tenants, projects, API keys rotacionáveis, scopes e RBAC.
- Quotas, rate/concurrency, idempotência, webhooks assinados e replay.
- Versionamento público, changelog, deprecation e SDKs.
- Medição/billing, invoices, overage e proteção de abuso.
- SLA, status page, suporte, data residency/DPA e suboperadores.
- Isolamento forte entre tenants e BYO problems/test cases.
- Exportabilidade e limites claros de source/retention.

## Possível API

`POST /v1/executions` recebe runtime/source/inputs/limits autorizados e devolve handle; resultado por polling/webhook. `POST /v1/judgements` aplica casos/checker. A forma final não deve copiar automaticamente a porta interna: API pública tem necessidades de segurança, estabilidade e billing distintas.

## Gate

Somente após volume interno provar confiabilidade/custo, haver demanda externa paga e avaliação build-vs-resell do provider. Contrato do judge precisa permitir sublicenciamento/uso API; não presumir.

