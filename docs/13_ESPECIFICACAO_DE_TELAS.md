# 13 — Especificação de telas MVP

Convenções: todas têm skeleton proporcional, erro com request ID quando técnico, foco no heading após navegação e anúncio de mudanças importantes. `Leaderboard` foi excluída da V0.1.

## 1. Landing (`/`)

**Objetivo:** explicar X1 e levar a cadastro/login.  
**Conteúdo:** headline, demonstração curta do loop, linguagens, fair play/segurança em linguagem simples, CTA `Começar`.  
**Ações:** criar conta, entrar.  
**Estados:** visitante; autenticado redireciona/oferece Home; indisponibilidade mostra status sem prometer partida.  
**Responsivo:** completo em mobile; sem editor real pesado.  
**A11y:** hierarquia única, ilustrações decorativas ocultas, CTA descritivo.

## 2. Cadastro (`/signup`)

Campos e-mail, senha conforme política do Auth, username, checkbox obrigatório “Tenho 18 anos ou mais”, aceites versionados. Validação local ajuda, servidor confirma. Abaixo de 18 não prossegue e recebe mensagem neutra sobre alpha. Não pedir data de nascimento/documento.

Loading bloqueia reenvio; conflito de username mantém demais campos seguros; e-mail já usado direciona a login. Links de termos/privacidade abrem sem perder formulário.

## 3. Login/recuperação (`/login`, `/forgot-password`)

E-mail/senha, recuperação e retorno ao convite. Erro de credencial não revela existência da conta. Rate limit tem mensagem/tempo. Teclado, autocomplete adequado e show password acessível.

## 4. Onboarding (`/onboarding`)

Explica ranked vs unranked, escolhe linguagens preferidas e permite testar editor com snippet local/Run simples. Não mede rating. Pode pular preferências, mas não aceite 18+/termos. Conclusão leva à Home.

## 5. Home (`/home`)

**Hierarquia:** rating e estado → grande CTA `JOGAR` → `Desafiar amigo` → `Praticar` → histórico curto. Sem streak/XP/ligas.  
**Jogar:** entra no matchmaking ranked após confirmação breve.  
**Estados:** novo usuário (rating 1200/provisório textual opcional), engagement ativo com `Retomar`, provider degradado desabilita ranked e explica, histórico vazio.  
**Mobile:** CTAs completos; partida/editor não promete mobile.

## 6. Practice (`/practice`)

Lista/paginação, filtros categoria/dificuldade/linguagem, status de tentativa. Empty limpa filtros; erro permite retry. Cards mostram título, dificuldade e categoria, não taxa global/solução. Mobile em uma coluna.

## 7. Problem (`/practice/problems/:id`)

Wide: statement à esquerda, editor à direita, console inferior. Medium/compact: tabs `Problema`, `Código`, `Console`. Ações Run/Submit diferenciadas. Mostrar versão de runtime e limites. Veredito do próprio usuário, sem solução editorial. Rascunho local e confirmação ao trocar linguagem.

## 8. Matchmaking (`/play/queue`)

Mostra `Partida ranqueada`, rating atual, tempo de espera, faixa aproximada (opcional) e `Cancelar`. Não mostra lista de pessoas. Match found bloqueia cancelamento e leva ao lobby. Se socket cair, HTTP consulta status. Timeout longo oferece continuar ou convidar amigo, sem retirar automaticamente.

## 9. Lobby / Match Found (`/matches/:id/lobby`)

PlayerCards, badge `Ranqueada` ou `Sem rating`, status conexão, ready button e regras curtas. Problema não é revelado antes do countdown. Saída antes de active não perde rating. Falta de confirmação cancela com razão clara.

## 10. X1 (`/matches/:id`)

**Header:** jogadores, tipo, relógio server-synced, conexão.  
**Main:** statement, editor, language selector, console, Run e Submit.  
**Rival:** conectado e contagem de submissões, sem vereditos/código.  
**States:** countdown bloqueia edição até `startsAt`; active; resolving (“avaliando submissões enviadas no prazo”); reconnecting; provider degraded; terminal redireciona/mostra result.  
**Abandonar:** confirmação informa consequência.  
**Mobile:** tela de contingência permite ver status/resultado; recomenda desktop para jogar.  
**A11y:** relógio não é anunciado a cada segundo; avisos em marcos; foco permanece estável.

## 11. Result (`/matches/:id/result`)

Mostra Vitória/Derrota/Empate/Partida anulada, razão, tempo, número de submissões e rating somente se ranked (`antes`, delta, `depois`). Privada exibe “Esta partida não alterou rating”. Ações primárias: `Revanche` (unranked) e `Encontrar nova partida` (ranked). Histórico detalhado próprio; sem análise Pro.

Erro ao carregar resultado consulta snapshot; nunca calcula delta local. Compartilhamento social é COULD, sem expor código.

## 12. Profile (`/@username`)

Username/avatar, rating/pico, estatísticas separadas e histórico com filtro ranked/unranked. Dono vê Settings. Perfil inexistente/oculto/excluído têm estados. Mobile completo. Não mostrar e-mail, idade, IP, código ou “nota profissional”.

## 13. Settings (`/settings`)

Seções: conta (e-mail via Auth), perfil, editor/acessibilidade, privacidade/dados e sessão/logout. Solicitações de exportação/exclusão explicam prazo/efeito. Não há notificações complexas, billing ou integrações.

## 14. Invitation (`/challenge/:token`)

Prévia informa remetente apenas quando seguro, `Sem rating`, expiração e CTA. Token inválido/expirado/cheio com caminhos Home/Criar desafio. Visitante autentica e retorna. Nunca incluir token em analytics/referrer; configurar `Referrer-Policy` adequada.

## 15. Componentes por estado transversal

| Situação | Comportamento |
|---|---|
| Offline | banner persistente; editor local preservado; mutações não fingem sucesso |
| Auth expirada | tentar refresh; salvar rascunho; reautenticar e ressincronizar |
| Judge indisponível | Run/Submit/novo ranked desabilitados quando necessário; partidas afetadas não punidas |
| Rate limited | mostrar ação e `Retry-After` |
| Maintenance | status e retorno; não iniciar countdown |
| Conta suspensa | acesso a suporte/privacidade; sem fila/partida |

## 16. Analytics de tela

Eventos são sem código/PII: `page_view` com rota normalizada; `play_clicked`; `queue_joined/cancelled`; `match_started/finished`; `rematch_clicked/created`; `new_match_clicked`; `practice_opened`; `system_error_shown`. Versionar schema e respeitar aviso/base legal.

## 17. Matriz explícita de estados, responsividade e acessibilidade

Os detalhes de conteúdo/componentes/ações estão nas seções anteriores; esta matriz garante cobertura dos estados exigidos sem repetir layouts.

| Tela | Loading | Empty | Error | Responsivo e acessibilidade |
|---|---|---|---|---|
| Landing | conteúdo estático; CTA sinaliza auth | não aplicável | auth indisponível mantém explicação/status | mobile-first; headings/CTA sem depender de ilustração |
| Cadastro | submit preserva campos e bloqueia duplo envio | formulário inicial | erro por campo + resumo; credencial genérica | uma coluna; labels, autocomplete e foco no primeiro erro |
| Login/recuperação | botão e retorno seguro | formulário inicial | não revela existência; rate limit anunciado | uma coluna, gerenciador de senha e teclado |
| Onboarding | skeleton de preferências/editor | preferências vazias são válidas | Run falho não impede pular | tabs/stack; instruções de atalhos |
| Home | skeleton de rating/history | CTA Practice/Jogar e guia inicial | dependência degradada não remove navegação | uma coluna compacta; CTA primeiro na ordem de foco |
| Practice | skeleton de cards | sem problemas/sem resultado de filtro distintos | retry preserva filtros | grid→lista; filtros com labels |
| Problem | skeleton de enunciado/editor lazy | console “ainda não executado” | erro técnico vs código separados | split→tabs; saída acessível e escape do editor |
| Matchmaking | estado entrando/cancelando | fila é o próprio estado de espera | reconecta/polling e permite cancelar quando seguro | painel central; tempo não anunciado continuamente |
| Lobby | placeholders de slots | “aguardando adversário” | expirado/cheio/saída com próxima ação | cards empilham; ready e tipo textual |
| X1 | countdown e submit pending explícitos | console/submissions vazios | offline/provider separados; rascunho preservado | desktop para jogar; foco estável e marcos do relógio |
| Result | skeleton vindo do snapshot | não aplicável a match terminal | retry sem recalcular localmente | cards empilham; razão/resultado em texto |
| Profile | skeleton de stats/history | “nenhuma partida” por filtro | perfil ausente/excluído/indisponível distintos | mobile completo; tabela vira lista sem perder rótulos |
| Settings | skeleton por seção e submit local | preferências default | erro inline + resumo; confirmação para exclusão | uma coluna compacta; headings e foco após save |
| Invitation | prévia mínima enquanto valida token | não aplicável | inválido/expirado/cheio com CTA | mobile completo; não expõe token/referrer |
