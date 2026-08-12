# 16 — Decisões arquiteturais (ADRs)

## ADR-001 — Monólito modular com worker isolado

**Status:** Accepted para V0.1  
**Contexto:** domínio ainda muda; microservices elevariam coordenação. Judge exige separação operacional.  
**Decisão:** backend NestJS modular; web separado; worker do mesmo codebase/processo implantável separado; código não confiável somente no provider.  
**Alternativas:** monólito único incluindo execução (inseguro); microservices completos (prematuro); BaaS-only (limita transações/domínio).  
**Consequências:** deploy simples e transações locais; limites de módulo devem ser testados; worker pode escalar separado. Extração futura depende de evidência.

## ADR-002 — PostgreSQL como fonte de verdade e Redis restrito

**Status:** Accepted  
**Contexto:** match/rating exigem consistência e histórico; fila/presença exigem TTL/baixa latência.  
**Decisão:** PostgreSQL para domínio; Redis para jobs, rate limit, matchmaking/presença e realtime efêmero. Outbox elimina dual write crítico.  
**Alternativas:** MongoDB (menos natural às invariantes); Redis como verdade (risco); só PostgreSQL para tudo (possível, mas pior ergonomia de fila/realtime).  
**Consequências:** duas dependências operacionais; queda do Redis degrada capacidades, mas não corrompe resultados.

## ADR-003 — Socket.IO autoritativo com snapshot

**Status:** Accepted  
**Contexto:** partidas precisam de rooms, ack e reconexão; entrega não é garantida após queda.  
**Decisão:** Socket.IO no backend; eventos versionados/seq; snapshot HTTP/realtime; Redis Streams se escala horizontal requer recovery.  
**Alternativas:** WebSocket cru (mais implementação); SSE (cliente→servidor separado e menos adequado); serviço realtime gerenciado (modelo duplicado).  
**Consequências:** dependência Socket.IO e adapter; domínio permanece independente; cliente deve ressincronizar.

## ADR-004 — Provider gerenciado atrás de CodeExecutionPort

**Status:** **Proposed — seleção do fornecedor pendente**  
**Contexto:** operar sandbox seguro não valida a hipótese e aumenta risco. Judge0 Cloud, Judge0 self-hosted, Sphere Engine e JDoodle foram avaliados em `10_CODE_JUDGE_SPEC.md`.  
**Decisão já aprovada:** piloto usa gerenciado; domínio nunca importa API/SDK/status do vendor. Porta simples com um adapter ativo; sem plugin framework.  
**Decisão ainda necessária:** escolher vendor/plano após cotação, DPA, segurança e spike.  
**Alternativas:** Judge0 self-hosted (controle, alto ônus); sandbox próprio (rejeitado); múltiplos providers ativos/failover (YAGNI).  
**Consequências:** custo e transferência de código; lock-in limitado pelo adapter; provider failure exige void/degradação. Atualizar esta ADR com scorecard, data e evidências antes da implementação.

## ADR-005 — Supabase Auth gerenciado

**Status:** Accepted para planejamento; revalidar comercial/jurídico antes de contratar  
**Contexto:** senha/recuperação segura não é diferencial. Backend separado precisa identidade verificável.  
**Decisão:** Supabase Auth por e-mail/senha, JWT/JWKS; User interno usa `auth_subject`; autorização fica no backend.  
**Alternativas:** Clerk (bom UX, mais proprietário); Auth.js (maior responsabilidade); auth próprio (rejeitado).  
**Consequências:** dependência/DPA/MAU e fluxo de token; caminho open-source reduz lock-in. Confirmar região, SMTP, retenção e sessão.

## ADR-006 — Rating Elo versionado e transacional

**Status:** Accepted  
**Contexto:** V0.1 precisa rating simples, mas pode migrar a Glicko.  
**Decisão:** Elo inicial 1200/K32 como hipótese, política isolada/versionada; atualizar ambos e histórico na transação do resultado. Só ranked público.  
**Alternativas:** Glicko-2 (melhor incerteza, mais complexidade); sem rating (reduz hipótese competitiva).  
**Consequências:** fácil explicar/testar; smurfs/provisionais menos bem tratados. Dados preservados permitem recalibração sem reescrever história silenciosamente.

## ADR-007 — Next.js web e NestJS backend em TypeScript

**Status:** Accepted para V0.1  
**Contexto:** landing/SSR e app interativo; backend tem domínio/realtime/worker.  
**Decisão:** Next.js/React/TypeScript para web, NestJS/TypeScript para backend e worker; contratos compartilhados apenas como pacote de schemas, não importação de entidades internas.  
**Alternativas:** Next full-stack (WebSocket/worker/domínio menos claros); Java/Spring (robusto, duas stacks e maior custo inicial); Go (eficiente, menor velocidade de produto/equipe presumida).  
**Consequências:** uma linguagem, ecossistema forte; event loop não executa user code; disciplina contra acoplamento por tipos compartilhados.

## ADR-008 — Partidas privadas unranked; revanche unranked

**Status:** Accepted por decisão de produto  
**Contexto:** convite é essencial ao cold start, mas pares combinados facilitam boosting.  
**Decisão:** apenas matchmaking público cria ranked. Privada e qualquer revanche não alteram rating.  
**Alternativas:** privadas ranked (abuso); todas unranked (rating sem utilidade); revanche ranked (collusion).  
**Consequências:** regra simples/justa; usuários precisam voltar à fila para novo rating; histórico separa tipos.

## ADR-009 — Alpha 18+ sem verificação etária complexa

**Status:** Accepted temporariamente  
**Contexto:** público futuro inclui menores; alpha valida X1 e deve reduzir escopo jurídico.  
**Decisão:** autodeclaração 18+, termos/privacidade versionados e alpha fechada; sem documentos/biometria.  
**Alternativas:** 16+ ou menores já no MVP (revisão e controles maiores); verificação robusta agora (fora da hipótese).  
**Consequências:** limita recrutamento da alpha; não garante idade de forma forte. Abertura a menores depende do gate jurídico/técnico no roadmap, considerando LGPD e ECA Digital vigentes.

## ADR-010 — Problemas versionados e exposição por usuário

**Status:** Accepted  
**Contexto:** problema conhecido quebra justiça; pool inicial é pequeno.  
**Decisão:** versões imutáveis, flag competitiva, exposure/cooldown e melhor candidato; fallback menos visto com telemetria.  
**Alternativas:** pools totalmente separados (duplica conteúdo e agrava cold start); impedir partida sem inédito (disponibilidade); geração automática (fora do MVP).  
**Consequências:** justiça mensurável, não perfeita; requer conteúdo suficiente e rotação.

