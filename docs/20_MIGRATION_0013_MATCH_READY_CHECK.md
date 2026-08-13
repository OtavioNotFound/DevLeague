# Migration 0013 — ready check do X1

## Motivo

O pareamento criava uma partida com relógio correndo antes de confirmar que ambos os jogadores haviam aberto a arena.

## Impacto

- participantes passam a ter `ready_at` idempotente;
- partidas novas recebem `lobby_expires_at`;
- countdown só avança para `ACTIVE` depois de dois participantes prontos;
- lobby expirado é cancelado sem resultado ou rating.

## Rollback

O código pode ignorar os campos novos sem apagar dados. Remoção física, se indispensável, deve ocorrer em migration posterior somente depois de desativar o ready check e remover o índice parcial.
