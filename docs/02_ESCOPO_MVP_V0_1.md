# 02 — Escopo do MVP V0.1

## 1. Objetivo

Validar se X1 de programação é desejável e repetível. A V0.1 termina quando a hipótese tiver evidência suficiente para decidir entre iterar, expandir ou encerrar — não quando uma lista de features estiver simplesmente pronta.

## 2. Escopo incluído

| Capacidade | Conteúdo mínimo |
|---|---|
| Conta | cadastro por e-mail, confirmação quando suportada, login, logout, recuperação, username único, aceite 18+ |
| Perfil | username, avatar opcional, rating, pico, vitórias/derrotas/empates, win rate e últimas partidas separadas por ranked/unranked |
| Linguagens | Python, Java, JavaScript (Node.js) e C++ com versões fixadas por ambiente |
| Problemas | 30–50 itens curados; descrição, dificuldade, categoria, exemplos, restrições, testes públicos/privados e limites |
| Editor | Monaco, seleção de linguagem, starter code, console, executar e submeter |
| Practice | catálogo simples, detalhe, execução e submissão; sem plano adaptativo |
| X1 privado | criar convite, entrar por link/código, readiness, partida unranked, resultado e revanche |
| Matchmaking | fila pública ranked por compatibilidade crescente de rating |
| Partida | mesmo problema, 10 minutos, servidor autoritativo; vence a solução correta admitida primeiro pelo servidor |
| Judge | provider gerenciado via porta interna, fila, limites, estados, testes e observabilidade |
| Rating | Elo inicial versionado, apenas matchmaking público, histórico atômico |
| Operação | painel técnico mínimo ou ferramentas internas para publicar/desativar problemas e investigar falhas; não é produto público |
| Telemetria | funil da partida, revanche, retorno, abandono, latência e falhas técnicas sem log indiscriminado de código |

## 3. Regras de corte

- `Jogar` deve estar acima de recursos secundários.
- Leaderboard não faz parte da V0.1; rating é visível no perfil e resultado.
- Rank visual pode ser apresentado como rótulo configurável se os limiares forem aprovados antes da implementação; não bloqueia a alpha e não altera regras.
- Avatar pode usar preset ou URL provida pelo serviço de identidade; upload próprio não bloqueia a alpha.
- Social login, chat, amizade e espectador ficam fora.
- A interface pública de administração fica fora; operações podem ocorrer por procedimento controlado.

## 4. Fora do escopo

**FUTURE:** IA, cursos completos, XP, level, streak, daily challenge, achievements, leaderboard, temporadas, ligas, times, clans, chat, torneios amplos, mobile app, mais linguagens, Pro, pagamentos, anúncios, patrocínios, Education, turmas, VS Code, replay, integridade acadêmica, Talent, assessments empresariais, Verified Skills, marketplace, API pública, white-label, LMS, SSO institucional e internacionalização.

Nenhuma tabela, endpoint ou módulo deve ser criado somente para esses itens.

## 5. Regras da alpha

- Participação restrita a 18+ por autodeclaração explícita no cadastro/primeiro acesso.
- Não implementar documento, biometria ou verificação etária complexa.
- Alpha por convite/allowlist é operacionalmente recomendada, mas convite não substitui autenticação.
- Aviso de privacidade e termos específicos devem existir antes de coletar dados reais.

## 6. Definição de pronto do MVP

O release candidate MUST demonstrar, em ambiente equivalente ao da alpha:

1. dois usuários autenticados concluem X1 privado e revanche;
2. dois usuários entram no matchmaking, concluem partida ranked e recebem rating consistente;
3. submissões simultâneas possuem um único resultado determinístico;
4. desconexão curta permite retomar estado sem pausar o relógio;
5. falha de provider não concede vitória/derrota indevida;
6. código não confiável não toca aplicação, banco, secrets ou rede interna;
7. Python, Java, JavaScript e C++ passam o conjunto de calibração;
8. exclusão/exportação de conta tem processo definido, ainda que assistido na alpha;
9. métricas da hipótese central são emitidas e validadas;
10. testes e critérios de [14_TESTING_STRATEGY.md](14_TESTING_STRATEGY.md) passam.

## 7. Critério de saída da alpha

Não há meta comercial definitiva. Após uma coorte mínima capaz de produzir padrões úteis, revisar:

- intenção de repetir e retorno;
- conclusão, abandono e tempo até partida;
- justiça percebida em pesquisa curta;
- falhas do judge/realtime;
- custo por partida concluída;
- distribuição entre convite e matchmaking.

Números iniciais em [15_ROADMAP.md](15_ROADMAP.md) são hipóteses de validação, não compromissos.
