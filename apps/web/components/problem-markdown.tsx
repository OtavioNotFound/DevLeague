import { Fragment, type ReactNode } from 'react';

export function ProblemMarkdown({ value }: { value: string }) {
  const blocks: ReactNode[] = [];
  const lines = value.replace(/\r\n/g, '\n').split('\n');
  let paragraph: string[] = [];
  let bullets: string[] = [];

  const flushParagraph = () => {
    if (paragraph.length === 0) return;
    blocks.push(<p key={`p-${blocks.length}`}>{inlineCode(paragraph.join(' '))}</p>);
    paragraph = [];
  };
  const flushBullets = () => {
    if (bullets.length === 0) return;
    blocks.push(<ul key={`ul-${blocks.length}`}>{bullets.map((item, index) =>
      <li key={`${index}-${item}`}>{inlineCode(item)}</li>)}</ul>);
    bullets = [];
  };

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed) {
      flushParagraph();
      flushBullets();
    } else if (trimmed.startsWith('## ')) {
      flushParagraph();
      flushBullets();
      blocks.push(<h3 key={`h-${blocks.length}`}>{inlineCode(trimmed.slice(3))}</h3>);
    } else if (trimmed.startsWith('- ')) {
      flushParagraph();
      bullets.push(trimmed.slice(2));
    } else {
      flushBullets();
      paragraph.push(trimmed);
    }
  }
  flushParagraph();
  flushBullets();
  return <div className="problem-markdown">{blocks}</div>;
}

function inlineCode(value: string): ReactNode {
  return value.split(/(`[^`]+`)/g).map((part, index) => part.startsWith('`') && part.endsWith('`')
    ? <code key={`${index}-${part}`}>{part.slice(1, -1)}</code>
    : <Fragment key={`${index}-${part}`}>{part}</Fragment>);
}
