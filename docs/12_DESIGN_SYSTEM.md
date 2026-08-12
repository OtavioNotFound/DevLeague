# 12 — Design system

## 1. Direção

Gamificado e profissional: competição, tecnologia, progresso e clareza. Evitar cassino, infantilização, cyberpunk excessivo e aparência de LMS/ERP. A interface usa energia visual no `Jogar`, countdown e resultado; o editor permanece calmo e legível.

## 2. Princípios

1. Ação primária inequívoca.
2. Estado competitivo compreensível sem depender de cor.
3. Densidade adequada a desktop, sem painéis administrativos desnecessários.
4. Feedback imediato, honesto e reversível quando possível.
5. Movimento funcional e reduzível.
6. PT-BR natural; termos técnicos preservados quando conhecidos (`Accepted`, com explicação).

## 3. Tokens semânticos

Valores são proposta inicial a validar visualmente; componentes consomem nomes semânticos, não hex arbitrário.

### Cor

| Token | Light (proposta) | Dark (proposta) | Uso |
|---|---|---|---|
| `bg.canvas` | `#F7F8FA` | `#101318` | fundo |
| `bg.surface` | `#FFFFFF` | `#181D25` | cards/painéis |
| `text.primary` | `#161A22` | `#F3F5F7` | texto |
| `text.muted` | `#596273` | `#AAB2C0` | secundário |
| `brand.primary` | `#365CF5` | `#6F8BFF` | ação/marca |
| `competitive` | `#6D3DF2` | `#9B7BFF` | ranked |
| `success` | `#177A4D` | `#45C98A` | Accepted/vitória |
| `warning` | `#9A5B00` | `#F0B84B` | atenção |
| `danger` | `#B42332` | `#FF6B7A` | falha/abandono |
| `focus` | `#005FCC` | `#8DBBFF` | anel de foco |

Contraste deve ser medido em ambos os temas. `success/danger` sempre acompanham ícone/texto.

### Tipografia

- UI: `Inter` ou fonte system sans; fallback explícito.
- Código: `JetBrains Mono`/system monospace; usuário pode ajustar 12–20 px.
- Escala: 12, 14, 16, 20, 24, 32, 48 px; line-height ≥1.4 no corpo.
- Números de relógio usam `font-variant-numeric: tabular-nums`.

### Espaçamento e geometria

- Unidade 4 px; escala `1,2,3,4,6,8,12,16` = 4–64 px.
- Radius: 6 (inputs), 10 (cards), 14 (hero); pill apenas para status/tags.
- Borda 1 px semântica; elevation em no máximo três níveis.
- Touch target mínimo 44×44 px quando aplicável.

## 4. Componentes MVP

- Button (`primary`, `secondary`, `ghost`, `danger`; loading/disabled).
- Link, IconButton, Input, PasswordInput, Checkbox, Select.
- FormField com label, ajuda e erro associado.
- Card, Modal/ConfirmDialog, Toast e InlineAlert.
- StatusBadge textual; Avatar; PlayerCard; RatingDelta.
- TopNav, MobileNav limitado, PageHeader.
- ProblemCard/filters; ProblemStatement; ExampleBlock.
- CodeEditorShell; LanguageSelect; ConsoleTabs; VerdictRow.
- MatchCTA; QueuePanel; LobbyPlayers; ReadyControl.
- Countdown; MatchHeader; ConnectionStatus; SubmissionTimeline.
- ResultPanel; Rematch/NewMatch actions.
- Skeleton, EmptyState, ErrorState e OfflineBanner.

Não criar chat, feed, leaderboard table, achievement modal ou storefront.

## 5. Estados

Todo controle interativo define: default, hover, active, focus-visible, disabled e loading. Loading não remove label sem alternativa acessível. Ação assíncrona destrutiva usa confirmação e impede duplo envio por idempotência/estado.

Vereditos:

| Canônico | Texto PT-BR | Tom |
|---|---|---|
| ACCEPTED | Aceito | sucesso |
| WRONG_ANSWER | Resposta incorreta | neutro/erro |
| COMPILE_ERROR | Erro de compilação | erro informativo |
| RUNTIME_ERROR | Erro em execução | erro informativo |
| TIME_LIMIT_EXCEEDED | Tempo excedido | warning |
| MEMORY_LIMIT_EXCEEDED | Memória excedida | warning |
| SYSTEM_ERROR | Falha no avaliador | sistema; não culpar usuário |

## 6. Layout responsivo

- `compact` <640; `medium` 640–1023; `wide` ≥1024.
- Landing/home/profile: uma coluna compacta, navegação simplificada.
- Problem Practice: statement e editor em tabs no compact/medium; split ajustável no wide.
- X1: suporte formal apenas ≥1024 na alpha; abaixo disso mostrar experiência de leitura e aviso para continuar em desktop, sem bloquear resultado/reconexão.
- Não depender de hover.

## 7. Editor e acessibilidade

- Atalho para entrar/sair do editor e link “Pular editor”.
- Não capturar `Tab` globalmente; oferecer configuração de tabulação e instrução acessível.
- `Ctrl/Cmd+Enter` para Run e atalho distinto/confirmado para Submit; botões sempre visíveis.
- Console usa texto selecionável, wrap opcional, limite e `aria-live=polite` somente para resumo.
- Erro aponta linha quando provider fornecer localização confiável, sem parse frágil como verdade.
- Tema de código com contraste verificado; zoom do navegador não quebra layout.

## 8. Motion

- 120–200 ms para microtransições; 200–300 ms para painéis.
- Countdown não usa flashing; último segundo pode mudar peso/cor com texto.
- Vitória usa celebração curta e não bloqueante; com reduced motion, transição instantânea.
- Nunca usar animação para atrasar acesso ao resultado.

## 9. Conteúdo e tom

Direto, competitivo sem hostilidade. Exemplos:

- “Partida encontrada” em vez de “Oponente adquirido”.
- “Falha no avaliador. Sua submissão não contou como erro.”
- “Sem rating — partidas privadas não alteram sua pontuação.”
- “Você se desconectou. O relógio continua; tentando reconectar…”

## 10. Validação

Antes do build: protótipo de Home→Matchmaking→X1→Resultado, teste com teclado/leitor de tela básico, contraste automatizado/manual e cinco usuários-alvo. Identidade visual final/nome/logo são FUTURE e não bloqueiam wireframes.

