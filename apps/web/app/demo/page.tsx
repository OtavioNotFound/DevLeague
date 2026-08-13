import { BookOpen, Clock3, Database } from 'lucide-react';
import Link from 'next/link';
import { Brand } from '../../components/brand';
import { CodeEditor } from '../../components/code-editor';
import { ProblemMarkdown } from '../../components/problem-markdown';
import { DifficultyBadge } from '../../components/ui';
import { demoProblem } from '../../lib/demo-data';

export default function DemoPracticePage() {
  return (
    <div className="app-frame">
      <header className="topbar demo-topbar">
        <Brand href="/" />
        <strong>Treino de demonstração</strong>
        <div className="demo-header-actions"><Link className="button primary" href="/demo/x1">Testar X1</Link><Link className="button secondary" href="/login">Entrar</Link></div>
      </header>
      <main className="app-main wide">
        <div className="workspace-topline">
          <span className="inline-alert demo-notice">Funciona sem login e não altera rating. Use Python, JavaScript, TypeScript ou Lua.</span>
          <span className="tag">TREINO · SEM RATING</span>
        </div>
        <div className="practice-workspace">
          <article className="problem-statement">
            <header>
              <div><p className="eyebrow">PROBLEMA DE DEMONSTRAÇÃO</p><h1>{demoProblem.title}</h1></div>
              <DifficultyBadge value={demoProblem.difficulty} />
            </header>
            <div className="problem-meta">
              <span><Clock3 size={15} /> 10 min sugeridos</span>
              <span><Database size={15} /> 256 MB</span>
              <span><BookOpen size={15} /> {demoProblem.categories.join(' · ')}</span>
            </div>
            <section><h2>Enunciado</h2><ProblemMarkdown value={demoProblem.statementMarkdown} /></section>
            <section><h2>Entrada e limites</h2><ProblemMarkdown value={demoProblem.constraintsMarkdown} /></section>
            <section>
              <h2>Exemplos</h2>
              {demoProblem.examples.map((example, index) => (
                <div className="example-grid" key={example.id}>
                  <div><small>ENTRADA {index + 1}</small><pre>{example.stdin}</pre></div>
                  <div><small>SAÍDA ESPERADA</small><pre>{example.expectedOutput}</pre></div>
                </div>
              ))}
            </section>
          </article>
          <CodeEditor problem={demoProblem} />
        </div>
      </main>
    </div>
  );
}
