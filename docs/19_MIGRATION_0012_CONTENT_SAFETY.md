# Migration 0012 — segurança do catálogo inicial

## Motivo

O catálogo inicial continha soluções completas nos campos de starter code e poucos casos privados, embora as versões estivessem marcadas como competitivas. Isso tornava o treino trivial e o X1 inadequado para rating.

## Impacto

- os quatro problemas continuam visíveis em Practice;
- starter codes passam a ser esqueletos sem a resposta;
- as versões atuais deixam de ser selecionáveis pelo matchmaking;
- nenhum histórico, envio ou resultado existente é apagado.

## Rollback

Não editar nem reverter a migration aplicada. Após criar casos privados fora do repositório público, soluções de referência, benchmarks e revisão nas cinco linguagens, publicar uma nova versão imutável de cada problema e uma nova migration que marque apenas essas versões como `competitive_eligible=true`.
