# 09 — API spec

Especificação conceitual V0.1. Na implementação, gerar OpenAPI e validar exemplos com contract tests.

## 1. Convenções

- Base: `/api/v1`; JSON UTF-8; timestamps ISO 8601 UTC; IDs UUID.
- Auth: `Authorization: Bearer <JWT>`; backend valida e resolve User interno.
- Mutação retryable: `Idempotency-Key` UUID/ULID, escopo por usuário+rota.
- Paginação: cursor opaco `?cursor=&limit=`; limite padrão 20, máximo 100.
- `X-Request-Id` recebido ou gerado; nunca contém PII.
- Retorno assíncrono: `202 Accepted` + recurso/status consultável.
- Código e stdout são strings; limites de bytes validados antes do enqueue.

## 2. Envelope de erro

```json
{
  "error": {
    "code": "MATCH_ALREADY_ACTIVE",
    "message": "Você já está em uma partida ativa.",
    "requestId": "req_01...",
    "details": { "matchId": "..." },
    "retryable": false
  }
}
```

Não retornar stack, SQL, provider handle, teste privado ou secret. Códigos estáveis; mensagem pode evoluir/traduzir.

## 3. Auth e usuário

O fluxo de credenciais usa SDK/endpoint do provider. DevLeague expõe:

| Método | Rota | Descrição |
|---|---|---|
| POST | `/users/bootstrap` | cria/reconcilia User/Profile após identidade válida |
| GET | `/me` | perfil privado, elegibilidade e engagement ativo |
| PATCH | `/me/profile` | username/avatar/preferências |
| POST | `/me/consents` | registra aceite/versionamento/18+ |
| POST | `/me/data-export` | solicita exportação |
| DELETE | `/me` | solicita exclusão com reautenticação quando suportada |

`POST /users/bootstrap` é idempotente por `auth_subject`; não aceita subject no body.

## 4. Problemas e Practice

| Método | Rota | Observação |
|---|---|---|
| GET | `/problems` | catálogo público autenticado, sem privados |
| GET | `/problems/{id}` | versão publicada + starter por linguagem |
| POST | `/practice/runs` | Run assíncrono |
| POST | `/practice/submissions` | Submit assíncrono |
| GET | `/submissions/{id}` | somente dono/operador |

Exemplo de criação:

```json
{
  "problemVersionId": "uuid",
  "language": "python",
  "source": "print(input())",
  "stdin": "abc\n"
}
```

Resposta `202`:

```json
{
  "submissionId": "uuid",
  "status": "QUEUED",
  "pollAfterMs": 500
}
```

## 5. Convites/lobbies

| Método | Rota | Descrição |
|---|---|---|
| POST | `/private-challenges` | cria convite unranked |
| GET | `/private-challenges/{token}` | prévia mínima; rate limited |
| POST | `/private-challenges/{token}/join` | entra idempotentemente |
| POST | `/matches/{id}/ready` | marca/desmarca readiness antes do countdown |
| POST | `/matches/{id}/leave` | sai antes de active |
| POST | `/matches/{id}/rematch` | cria desafio privado derivado |

Criação retorna `expiresAt`, `joinUrl` e `matchId`. Token aparece no URL apenas; logs/proxy devem redigi-lo.

## 6. Matchmaking

| Método | Rota | Descrição |
|---|---|---|
| PUT | `/matchmaking/entry` | upsert na fila ranked |
| GET | `/matchmaking/entry` | estado/snapshot |
| DELETE | `/matchmaking/entry` | cancela se ainda não pareado |
| POST | `/matchmaking/heartbeat` | renova TTL se fallback HTTP necessário |

`PUT` responde `202` com `queueEntryId`, `enteredAt`, `initialRange`. O evento `match.found` é realtime; polling GET é fallback.

## 7. Partida

| Método | Rota | Descrição |
|---|---|---|
| GET | `/matches/{id}` | snapshot autorizado |
| POST | `/matches/{id}/runs` | Run; não vence |
| POST | `/matches/{id}/submissions` | Submit competitivo |
| POST | `/matches/{id}/forfeit` | abandono explícito |
| GET | `/matches/{id}/result` | resultado terminal |

Submit MUST validar participação, estado, `server_received_at <= ends_at`, source e linguagem. Ack não é veredito.

Snapshot resumido:

```json
{
  "id": "uuid",
  "type": "RANKED_PUBLIC",
  "status": "ACTIVE",
  "serverNow": "2026-08-11T20:00:02.120Z",
  "startsAt": "2026-08-11T20:00:00Z",
  "endsAt": "2026-08-11T20:10:00Z",
  "eventSeq": 18,
  "problem": { "versionId": "uuid", "title": "...", "statement": "..." },
  "participants": [
    { "userId": "uuid", "username": "ana", "connected": true, "submissions": 2 }
  ],
  "mySubmissions": []
}
```

## 8. Perfil/histórico

| Método | Rota | Descrição |
|---|---|---|
| GET | `/profiles/{username}` | perfil público mínimo |
| GET | `/profiles/{username}/matches` | histórico paginado com filtro `type` |

Campos privados e código nunca aparecem. Conta excluída é pseudonimizada conforme política.

## 9. Operação protegida

Endpoints administrativos, se implementados, ficam sob `/api/v1/admin`, MFA/role explícita, auditoria e rede/acesso restrito. Importação/publicação exige validação e não é requisito de UI. Nunca usar apenas segredo de URL.

## 10. Status e códigos

| HTTP | Uso |
|---|---|
| 200/201/202/204 | sucesso |
| 400 | schema/regra de formato |
| 401 | identidade ausente/inválida |
| 403 | sem autorização/elegibilidade |
| 404 | ausente ou ocultado por autorização |
| 409 | conflito de estado/idempotência |
| 410 | convite expirado |
| 422 | regra de domínio (ex.: deadline) |
| 429 | rate/backpressure, com `Retry-After` |
| 503 | dependência degradada; retryability explícita |

## 11. Idempotência

Persistir hash do payload, status e resposta por janela. Mesma chave+mesmo payload retorna resposta anterior; mesma chave+payload diferente retorna `409 IDEMPOTENCY_KEY_REUSED`. Submit competitivo não é reenfileirado após ack perdido.

## 12. Segurança de conteúdo

- Máximo inicial sugerido de source: 64 KiB; stdin/stdout: limites menores/configurados.
- `Content-Type` estrito; sem upload de binários/projetos na V0.1.
- Enunciado Markdown é sanitizado no servidor/build de conteúdo.
- CORS allowlist; cookies, se usados pelo web SSR, `Secure`, `HttpOnly`, `SameSite` e CSRF apropriado.
- Provider callbacks não compartilham namespace/auth de usuários.

## 13. Compatibilidade

Mudança aditiva é permitida. Remover/renomear campos, alterar semântica de evento ou código exige nova versão ou período de compatibilidade. O cliente deve ignorar campos desconhecidos e não interpretar mensagem humana como código.

