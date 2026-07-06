'use client';

/**
 * Renders markdown-like text as styled HTML.
 * Supports: headers (##), bold (**), inline code (`), bullet lists (-/*)
 */
export default function MarkdownRenderer({ content, className }: { content: string; className?: string }) {
  const lines = content.split('\n');
  const elements: JSX.Element[] = [];
  let listItems: string[] = [];
  let key = 0;

  const flushList = () => {
    if (listItems.length === 0) return;
    elements.push(
      <ul key={key++} style={{ margin: '6px 0 10px 0', paddingLeft: '18px', listStyleType: 'none' }}>
        {listItems.map((item, i) => (
          <li key={i} style={{ position: 'relative', paddingLeft: '14px', marginBottom: '3px' }}>
            <span style={{ position: 'absolute', left: 0, color: '#FF2A2A' }}>›</span>
            {renderInline(item)}
          </li>
        ))}
      </ul>
    );
    listItems = [];
  };

  const renderInline = (text: string) => {
    // Process bold, inline code, and regular text
    const parts: (string | JSX.Element)[] = [];
    let remaining = text;
    let partKey = 0;

    while (remaining.length > 0) {
      // Inline code: `text`
      const codeMatch = remaining.match(/`([^`]+)`/);
      // Bold: **text** or __text__
      const boldMatch = remaining.match(/\*\*([^*]+)\*\*/);

      let firstMatch: { index: number; length: number; type: 'code' | 'bold'; content: string } | null = null;

      if (codeMatch && codeMatch.index !== undefined) {
        firstMatch = { index: codeMatch.index, length: codeMatch[0].length, type: 'code', content: codeMatch[1] };
      }
      if (boldMatch && boldMatch.index !== undefined) {
        if (!firstMatch || boldMatch.index < firstMatch.index) {
          firstMatch = { index: boldMatch.index, length: boldMatch[0].length, type: 'bold', content: boldMatch[1] };
        }
      }

      if (!firstMatch) {
        parts.push(remaining);
        break;
      }

      if (firstMatch.index > 0) {
        parts.push(remaining.substring(0, firstMatch.index));
      }

      if (firstMatch.type === 'code') {
        parts.push(
          <code key={partKey++} style={{
            background: '#1A1A1A', padding: '1px 5px', fontSize: '10.5px',
            color: '#E8E8E8', border: '1px solid #2A2A2A',
          }}>
            {firstMatch.content}
          </code>
        );
      } else {
        parts.push(
          <strong key={partKey++} style={{ color: '#FFFFFF', fontWeight: 600 }}>
            {firstMatch.content}
          </strong>
        );
      }

      remaining = remaining.substring(firstMatch.index + firstMatch.length);
    }

    return <>{parts}</>;
  };

  for (const line of lines) {
    const trimmed = line.trim();

    // Empty line
    if (!trimmed) {
      flushList();
      elements.push(<div key={key++} style={{ height: '8px' }} />);
      continue;
    }

    // H1: # Header
    if (trimmed.startsWith('# ') && !trimmed.startsWith('## ')) {
      flushList();
      elements.push(
        <div key={key++} style={{
          fontSize: '14px', fontWeight: 700, color: '#FFFFFF',
          letterSpacing: '.08em', marginTop: '20px', marginBottom: '8px',
          borderBottom: '1px solid #FF2A2A33', paddingBottom: '8px',
        }}>
          {renderInline(trimmed.replace(/^#\s+/, ''))}
        </div>
      );
      continue;
    }

    // H2: ## Header
    if (trimmed.startsWith('## ')) {
      flushList();
      elements.push(
        <div key={key++} style={{
          fontSize: '12px', fontWeight: 700, color: '#FF2A2A',
          letterSpacing: '.1em', marginTop: '18px', marginBottom: '6px',
          textTransform: 'uppercase',
        }}>
          {renderInline(trimmed.replace(/^##\s+/, ''))}
        </div>
      );
      continue;
    }

    // H3: ### Header
    if (trimmed.startsWith('### ')) {
      flushList();
      elements.push(
        <div key={key++} style={{
          fontSize: '11.5px', fontWeight: 700, color: '#E0E0E0',
          letterSpacing: '.06em', marginTop: '14px', marginBottom: '4px',
        }}>
          {renderInline(trimmed.replace(/^###\s+/, ''))}
        </div>
      );
      continue;
    }

    // H4+: ####+ Header
    if (trimmed.startsWith('####')) {
      flushList();
      elements.push(
        <div key={key++} style={{
          fontSize: '11px', fontWeight: 600, color: '#B3B3B3',
          marginTop: '10px', marginBottom: '3px',
        }}>
          {renderInline(trimmed.replace(/^#+\s+/, ''))}
        </div>
      );
      continue;
    }

    // Horizontal rule
    if (/^[-*_]{3,}$/.test(trimmed)) {
      flushList();
      elements.push(
        <hr key={key++} style={{ border: 'none', borderTop: '1px solid #2A2A2A', margin: '12px 0' }} />
      );
      continue;
    }

    // Bullet list item
    if (/^[-*+]\s/.test(trimmed)) {
      listItems.push(trimmed.replace(/^[-*+]\s+/, ''));
      continue;
    }

    // Numbered list item
    if (/^\d+\.\s/.test(trimmed)) {
      const content = trimmed.replace(/^\d+\.\s+/, '');
      const num = trimmed.match(/^(\d+)\./)?.[1] || '·';
      flushList();
      elements.push(
        <div key={key++} style={{ display: 'flex', gap: '8px', marginBottom: '3px' }}>
          <span style={{ color: '#FF2A2A', fontWeight: 700, minWidth: '16px', flexShrink: 0 }}>{num}.</span>
          <span>{renderInline(content)}</span>
        </div>
      );
      continue;
    }

    // Regular paragraph
    flushList();
    elements.push(
      <div key={key++} style={{ marginBottom: '4px' }}>
        {renderInline(trimmed)}
      </div>
    );
  }

  flushList();

  return (
    <div className={className} style={{
      fontSize: '11px', color: '#B3B3B3', lineHeight: 1.7,
      fontFamily: '"JetBrains Mono", monospace',
    }}>
      {elements}
    </div>
  );
}
