'use client';

import { useEffect, useRef, useCallback } from 'react';

/**
 * Renders markdown-like text as styled HTML with Mermaid diagram support.
 * Supports: headers, bold, inline code, bullet/numbered lists, code blocks, mermaid diagrams, tables, blockquotes
 */
export default function MarkdownRenderer({ content, className }: { content: string; className?: string }) {
  const containerRef = useRef<HTMLDivElement>(null);

  // Render mermaid diagrams after mount
  const renderMermaid = useCallback(async () => {
    if (!containerRef.current) return;
    const mermaidDivs = containerRef.current.querySelectorAll('.mermaid-source');
    if (mermaidDivs.length === 0) return;

    try {
      const mermaid = (await import('mermaid')).default;
      mermaid.initialize({
        startOnLoad: false,
        theme: 'dark',
        themeVariables: {
          primaryColor: '#FF2A2A',
          primaryTextColor: '#E8E8E8',
          primaryBorderColor: '#FF2A2A',
          lineColor: '#5A5A5A',
          secondaryColor: '#1A1A1A',
          tertiaryColor: '#0D0D0D',
          background: '#0A0A0A',
          mainBkg: '#141414',
          nodeBorder: '#FF2A2A',
          clusterBkg: '#0D0D0D',
          clusterBorder: '#2A2A2A',
          titleColor: '#FF2A2A',
          edgeLabelBackground: '#0A0A0A',
          nodeTextColor: '#E8E8E8',
          actorTextColor: '#E8E8E8',
          actorBorder: '#FF2A2A',
          actorBkg: '#141414',
          activationBorderColor: '#FF2A2A',
          signalColor: '#B3B3B3',
          signalTextColor: '#E8E8E8',
          labelBoxBkgColor: '#141414',
          labelBoxBorderColor: '#2A2A2A',
          labelTextColor: '#E8E8E8',
          noteBkgColor: '#1A1A1A',
          noteTextColor: '#B3B3B3',
          noteBorderColor: '#2A2A2A',
        },
        fontFamily: '"JetBrains Mono", monospace',
        fontSize: 12,
        flowchart: { curve: 'basis', padding: 15 },
        sequence: { actorMargin: 50, messageMargin: 40 },
      });

      for (let i = 0; i < mermaidDivs.length; i++) {
        const div = mermaidDivs[i] as HTMLElement;
        const code = div.getAttribute('data-mermaid') || '';
        if (!code.trim()) continue;
        try {
          const id = `mermaid-${Date.now()}-${i}`;
          const { svg } = await mermaid.render(id, code);
          div.innerHTML = svg;
          div.classList.remove('mermaid-source');
          div.classList.add('mermaid-rendered');
        } catch (e) {
          // Show the raw code if mermaid can't parse it
          div.innerHTML = `<pre style="color:#FF2A2A;font-size:10px;padding:12px;background:#1A0808;border:1px solid #FF2A2A33">${code}</pre>`;
        }
      }
    } catch {
      // mermaid not available, show raw
    }
  }, []);

  useEffect(() => {
    renderMermaid();
  }, [content, renderMermaid]);

  const lines = content.split('\n');
  const elements: JSX.Element[] = [];
  let listItems: { text: string; indent: number }[] = [];
  let codeBlock: { lines: string[]; lang: string } | null = null;
  let tableRows: string[][] = [];
  let key = 0;

  const flushList = () => {
    if (listItems.length === 0) return;
    elements.push(
      <ul key={key++} style={{ margin: '6px 0 10px 0', paddingLeft: '18px', listStyleType: 'none' }}>
        {listItems.map((item, i) => (
          <li key={i} style={{ position: 'relative', paddingLeft: `${14 + item.indent * 16}px`, marginBottom: '3px' }}>
            <span style={{ position: 'absolute', left: item.indent * 16, color: '#FF2A2A' }}>›</span>
            {renderInline(item.text)}
          </li>
        ))}
      </ul>
    );
    listItems = [];
  };

  const flushTable = () => {
    if (tableRows.length === 0) return;
    // Filter out separator rows (---|---|---)
    const dataRows = tableRows.filter(r => !r.every(c => /^[-:]+$/.test(c.trim())));
    if (dataRows.length === 0) { tableRows = []; return; }
    const headerRow = dataRows[0];
    const bodyRows = dataRows.slice(1);
    elements.push(
      <div key={key++} style={{ overflowX: 'auto', margin: '12px 0', border: '1px solid #1F1F1F' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '10.5px' }}>
          <thead>
            <tr style={{ background: '#141414' }}>
              {headerRow.map((cell, i) => (
                <th key={i} style={{ padding: '8px 12px', textAlign: 'left', color: '#FF2A2A', fontWeight: 600, letterSpacing: '.06em', borderBottom: '2px solid #FF2A2A33', whiteSpace: 'nowrap' }}>
                  {renderInline(cell.trim())}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {bodyRows.map((row, ri) => (
              <tr key={ri} style={{ borderBottom: '1px solid #1A1A1A', background: ri % 2 === 0 ? 'transparent' : '#0A0A0A08' }}>
                {row.map((cell, ci) => (
                  <td key={ci} style={{ padding: '6px 12px', color: '#B3B3B3' }}>
                    {renderInline(cell.trim())}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    );
    tableRows = [];
  };

  const renderInline = (text: string) => {
    const parts: (string | JSX.Element)[] = [];
    let remaining = text;
    let partKey = 0;

    while (remaining.length > 0) {
      const codeMatch = remaining.match(/`([^`]+)`/);
      const boldMatch = remaining.match(/\*\*([^*]+)\*\*/);
      const linkMatch = remaining.match(/\[([^\]]+)\]\(([^)]+)\)/);

      let firstMatch: { index: number; length: number; type: string; content: string; href?: string } | null = null;

      if (codeMatch && codeMatch.index !== undefined) {
        firstMatch = { index: codeMatch.index, length: codeMatch[0].length, type: 'code', content: codeMatch[1] };
      }
      if (boldMatch && boldMatch.index !== undefined) {
        if (!firstMatch || boldMatch.index < firstMatch.index) {
          firstMatch = { index: boldMatch.index, length: boldMatch[0].length, type: 'bold', content: boldMatch[1] };
        }
      }
      if (linkMatch && linkMatch.index !== undefined) {
        if (!firstMatch || linkMatch.index < firstMatch.index) {
          firstMatch = { index: linkMatch.index, length: linkMatch[0].length, type: 'link', content: linkMatch[1], href: linkMatch[2] };
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
      } else if (firstMatch.type === 'bold') {
        parts.push(
          <strong key={partKey++} style={{ color: '#FFFFFF', fontWeight: 600 }}>
            {firstMatch.content}
          </strong>
        );
      } else if (firstMatch.type === 'link') {
        parts.push(
          <a key={partKey++} href={firstMatch.href} target="_blank" rel="noopener noreferrer" style={{ color: '#FF2A2A', textDecoration: 'underline', textUnderlineOffset: '2px' }}>
            {firstMatch.content}
          </a>
        );
      }

      remaining = remaining.substring(firstMatch.index + firstMatch.length);
    }

    return <>{parts}</>;
  };

  for (let lineIdx = 0; lineIdx < lines.length; lineIdx++) {
    const line = lines[lineIdx];
    const trimmed = line.trim();

    // Code block start/end
    if (trimmed.startsWith('```')) {
      if (codeBlock) {
        // End of code block
        const lang = codeBlock.lang.toLowerCase();
        const codeContent = codeBlock.lines.join('\n');

        if (lang === 'mermaid') {
          // Mermaid diagram
          flushList();
          elements.push(
            <div key={key++} style={{
              margin: '16px 0', padding: '24px', background: '#0A0A0A',
              border: '1px solid #1F1F1F', overflow: 'auto',
              display: 'flex', justifyContent: 'center',
            }}>
              <div className="mermaid-source" data-mermaid={codeContent} style={{ minWidth: '200px' }}>
                <div style={{ textAlign: 'center', fontSize: '10px', color: '#5A5A5A', letterSpacing: '.1em' }}>LOADING DIAGRAM...</div>
              </div>
            </div>
          );
        } else {
          // Regular code block
          flushList();
          elements.push(
            <div key={key++} style={{ margin: '8px 0', position: 'relative' }}>
              {lang && (
                <div style={{
                  position: 'absolute', top: 0, right: 0,
                  padding: '2px 8px', fontSize: '9px', color: '#5A5A5A',
                  letterSpacing: '.1em', background: '#141414', borderLeft: '1px solid #1F1F1F',
                  borderBottom: '1px solid #1F1F1F',
                }}>
                  {lang.toUpperCase()}
                </div>
              )}
              <pre style={{
                background: '#0D0D0D', border: '1px solid #1F1F1F',
                padding: '14px 16px', overflow: 'auto', fontSize: '10.5px',
                lineHeight: 1.6, color: '#C8C8C8',
              }}>
                {codeContent}
              </pre>
            </div>
          );
        }
        codeBlock = null;
      } else {
        // Start of code block
        flushList();
        flushTable();
        codeBlock = { lines: [], lang: trimmed.replace(/^```/, '').trim() };
      }
      continue;
    }

    // Inside code block
    if (codeBlock) {
      codeBlock.lines.push(line);
      continue;
    }

    // Empty line
    if (!trimmed) {
      flushList();
      flushTable();
      elements.push(<div key={key++} style={{ height: '8px' }} />);
      continue;
    }

    // Table row
    if (trimmed.includes('|') && trimmed.startsWith('|')) {
      flushList();
      const cells = trimmed.split('|').slice(1, -1); // remove leading/trailing empty
      tableRows.push(cells);
      continue;
    } else {
      flushTable();
    }

    // Blockquote
    if (trimmed.startsWith('> ')) {
      flushList();
      elements.push(
        <div key={key++} style={{
          borderLeft: '3px solid #FF2A2A', paddingLeft: '14px', margin: '8px 0',
          color: '#9A9A9A', fontStyle: 'italic',
        }}>
          {renderInline(trimmed.replace(/^>\s+/, ''))}
        </div>
      );
      continue;
    }

    // H1: # Header
    if (trimmed.startsWith('# ') && !trimmed.startsWith('## ')) {
      flushList();
      elements.push(
        <div key={key++} style={{
          fontSize: '16px', fontWeight: 700, color: '#FFFFFF',
          letterSpacing: '.08em', marginTop: '24px', marginBottom: '10px',
          borderBottom: '2px solid #FF2A2A33', paddingBottom: '10px',
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
          fontSize: '13px', fontWeight: 700, color: '#FF2A2A',
          letterSpacing: '.1em', marginTop: '22px', marginBottom: '8px',
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
          fontSize: '12px', fontWeight: 700, color: '#E0E0E0',
          letterSpacing: '.06em', marginTop: '16px', marginBottom: '6px',
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
          marginTop: '12px', marginBottom: '4px',
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
        <hr key={key++} style={{ border: 'none', borderTop: '1px solid #2A2A2A', margin: '16px 0' }} />
      );
      continue;
    }

    // Bullet list item
    if (/^[-*+]\s/.test(trimmed)) {
      const indent = line.search(/\S/) > 0 ? Math.floor(line.search(/\S/) / 2) : 0;
      listItems.push({ text: trimmed.replace(/^[-*+]\s+/, ''), indent });
      continue;
    }

    // Numbered list item
    if (/^\d+\.\s/.test(trimmed)) {
      const content = trimmed.replace(/^\d+\.\s+/, '');
      const num = trimmed.match(/^(\d+)\./)?.[1] || '·';
      flushList();
      elements.push(
        <div key={key++} style={{ display: 'flex', gap: '8px', marginBottom: '4px' }}>
          <span style={{ color: '#FF2A2A', fontWeight: 700, minWidth: '18px', flexShrink: 0 }}>{num}.</span>
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
  flushTable();

  return (
    <div ref={containerRef} className={className} style={{
      fontSize: '11.5px', color: '#B3B3B3', lineHeight: 1.7,
      fontFamily: '"JetBrains Mono", monospace',
    }}>
      {elements}
    </div>
  );
}
