# FUTURE — Extensão VS Code

> Fora da V0.1. Não criar pacote de extensão, protocolo ou tabelas agora.

## Objetivo

Permitir que atividades avançadas sejam realizadas no ambiente normal do aluno, com autenticação, enunciado, testes, submissão e sincronização — inclusive offline.

## Escopo potencial

- Autenticar e vincular explicitamente um workspace a uma atividade.
- Exibir status/gravação, enunciado, prazo e progresso.
- Executar testes autorizados e submeter.
- Registrar eventos granulares necessários ao replay: arquivo/diff/snapshot, run, test, erro e paste significativo.
- Buffer local criptografado e sincronização idempotente.

## Limite de privacidade

Somente paths dentro do workspace explicitamente vinculado e enquanto sessão acadêmica estiver claramente ativa. Ignorar `.git`, secrets, dependências/build output e padrões configurados. Nunca observar outros projetos, clipboard global, janelas, browser ou digitação fora do workspace.

UI permanente deve indicar `Sessão sendo registrada`, finalidade, evento coletado, responsável e ação de encerrar. Instituição/professor não pode habilitar coleta oculta.

## Modelo de eventos (conceitual)

Evento tem `sessionId`, sequência local, timestamp monotônico/UTC, path relativo pseudonimizado quando possível, tipo e payload mínimo. Diffs/snapshots precisam criptografia, checksum, política de compactação/retenção e redaction de secrets. Servidor não confia no timestamp local para avaliação competitiva.

## Offline e conflitos

- ID de dispositivo/instalação rotacionável, fila append-only local e ack por sequência.
- Retry idempotente; relógio local pode ser inexato.
- Atividade submetida offline segue regra institucional definida; extensão não altera prazo.
- Conflito de snapshot preserva evidência, não faz merge destrutivo automático.

## Code Replay

Reconstrução determinística a partir de snapshot base + diffs validados. Visualização deve mostrar lacunas/sincronização e nunca fingir continuidade. Acesso auditado e finalidade pedagógica.

## Segurança

Secret storage do VS Code, OAuth device/PKCE, TLS, assinatura/publicação oficial, update seguro, workspace trust, proteção contra symlink/path traversal, tamanho/frequência limitados e threat model específico para extensão comprometida.

## Decisões futuras

Política de paste, granularidade, retenção, bases legais, autoria offline, ambientes remotos/WSL/devcontainers, Git, multi-root, monorepos e consentimento institucional. Exigem pesquisa com alunos/professores e revisão jurídica antes do protótipo.

