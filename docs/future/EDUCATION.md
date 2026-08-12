# FUTURE — Education

> Fora da V0.1. Não criar tabelas, endpoints ou UI Education sem aprovação de novo horizonte.

## Visão

Reduzir trabalho de professores e melhorar compreensão do processo de aprendizagem por meio de atividades, testes automáticos e analytics pedagógicos. Não é ferramenta de vigilância.

## Usuários e capacidades

- Professor cria turma, atividade, starter code, casos de teste, prazo e rubrica.
- Aluno resolve em Web Workspace ou, para projetos reais, Desktop Workspace/VS Code.
- Sistema executa autograding e mostra progresso/feedback configurado.
- Professor acompanha início, conclusão, tentativas, testes e sinais de dificuldade.
- Instituição administra pessoas, políticas, integrações e relatórios.

## Princípios

1. Finalidade pedagógica explícita e minimização.
2. Aluno sabe quando/quais eventos são coletados.
3. Analytics orienta ajuda; não rotula incapacidade.
4. Integridade apresenta evidência observável; humano decide.
5. IA gera rascunho/recomendação; professor revisa.
6. Ambientes avançados não são forçados ao editor web.

## Domínio futuro provável

Organization, Classroom, Membership/Role, Assignment, AssignmentVersion, Enrollment, Attempt, Rubric, Grade, Feedback e ActivityEvent. Não reutilizar `Match` como atividade nem `Rating` como nota. `Problem/Submission/Execution` podem fornecer capacidades por interfaces estáveis, mas contexto, autorização e retenção serão próprios.

## Web vs Desktop

- **Web:** exercícios single-file/pequenos, Python/Java/JS/SQL.
- **Desktop:** Maven/Gradle/Spring, Docker, múltiplos arquivos, frontend, bancos e Jupyter. Sincronização precisa suportar offline e conflito.

## Analytics permitidos por design

Dados necessários ao objetivo: início, tempo ativo aproximado, runs/submits, progresso de testes, snapshots/diffs quando habilitados e sinalizados. Não coletar outros workspaces, aplicações, navegação geral, clipboard global ou conteúdo pessoal.

## Privacidade e menores

Education provavelmente envolve crianças/adolescentes e instituições com papéis de controlador/operador complexos. Antes de discovery detalhado: revisão LGPD/ECA/ECA Digital, melhor interesse, base legal/consentimento, contratos, retenção, direitos, aferição etária apropriada, perfil público, transferência internacional e RIPD. A limitação 18+ da alpha B2C não resolve Education.

## Comercial futuro

Teacher Free → Teacher Pro → School → University/Enterprise; adoção bottom-up é hipótese. Limites, preço, SLA, SSO e marketplace são decisões futuras, não compromissos.

## Gate de início

Só iniciar após evidência do core de execução/submission, entrevistas com professores/alunos, mapa jurídico e escolha explícita do primeiro segmento. Não construir “Education genérico”.

