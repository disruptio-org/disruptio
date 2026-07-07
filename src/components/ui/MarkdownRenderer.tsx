'use client';

import { useEffect, useRef, useCallback, useState } from 'react';

/**
 * Renders markdown-like text as styled HTML with Mermaid diagram support.
 * Supports: headers, bold, inline code, bullet/numbered lists, code blocks, mermaid diagrams, tables, blockquotes
 */
export default function MarkdownRenderer({ content, className }: { content: string; className?: string }) {
  const containerRef = useRef<HTMLDivElement>(null);

  const [fullscreenDiagram, setFullscreenDiagram] = useState<{ svg: string; id: string } | null>(null);
  const [zoom, setZoom] = useState(1);
  const [position, setPosition] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });

  // Render mermaid diagrams after mount
  const renderMermaid = useCallback(async () => {
    if (!containerRef.current) return;
    const mermaidDivs = containerRef.current.querySelectorAll('.mermaid-source');
    if (mermaidDivs.length === 0) return;

    try {
      const mermaid = (await import('mermaid')).default;
      mermaid.initialize({
        startOnLoad: false,
        theme: document.documentElement.getAttribute('data-theme') === 'light' ? 'default' : 'dark',
        themeVariables: {
          primaryColor: 'var(--accent)',
          primaryTextColor: 'var(--text-secondary)',
          primaryBorderColor: 'var(--accent)',
          lineColor: 'var(--text-faint)',
          secondaryColor: 'var(--bg-hover)',
          tertiaryColor: 'var(--bg-elevated)',
          background: 'var(--bg-primary)',
          mainBkg: 'var(--bg-hover)',
          nodeBorder: 'var(--accent)',
          clusterBkg: 'var(--bg-elevated)',
          clusterBorder: 'var(--border-input)',
          titleColor: 'var(--accent)',
          edgeLabelBackground: 'var(--bg-primary)',
          nodeTextColor: 'var(--text-secondary)',
          actorTextColor: 'var(--text-secondary)',
          actorBorder: 'var(--accent)',
          actorBkg: 'var(--bg-hover)',
          activationBorderColor: 'var(--accent)',
          signalColor: 'var(--text-secondary)',
          signalTextColor: 'var(--text-secondary)',
          labelBoxBkgColor: 'var(--bg-hover)',
          labelBoxBorderColor: 'var(--border-input)',
          labelTextColor: 'var(--text-secondary)',
          noteBkgColor: 'var(--bg-hover)',
          noteTextColor: 'var(--text-secondary)',
          noteBorderColor: 'var(--border-input)',
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
          
          // Make it clickable for fullscreen
          div.style.cursor = 'zoom-in';
          div.onclick = () => {
            setFullscreenDiagram({ svg, id });
            setZoom(1);
            setPosition({ x: 0, y: 0 });
          };
        } catch (e) {
          // Show the raw code if mermaid can't parse it
          div.innerHTML = `<pre style="color:var(--error);font-size:10px;padding:12px;background:var(--accent-glow);border:1px solid var(--border-default)">${code}</pre>`;
        }
      }
    } catch {
      // mermaid not available, show raw
    }
  }, []);

  const handleMouseDown = (e: React.MouseEvent) => {
    if (!fullscreenDiagram) return;
    setIsDragging(true);
    setDragStart({ x: e.clientX - position.x, y: e.clientY - position.y });
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!isDragging) return;
    setPosition({
      x: e.clientX - dragStart.x,
      y: e.clientY - dragStart.y
    });
  };

  const handleMouseUp = () => {
    setIsDragging(false);
  };

  const handleWheel = (e: React.WheelEvent) => {
    if (!fullscreenDiagram) return;
    const delta = e.deltaY > 0 ? 0.9 : 1.1;
    setZoom(prev => Math.max(0.1, Math.min(10, prev * delta)));
  };

  useEffect(() => {
    renderMermaid();
  }, [content, renderMermaid]);

  const lines = content.split('\n');
  const elements: React.JSX.Element[] = [];
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
            <span style={{ position: 'absolute', left: item.indent * 16, color: 'var(--accent)' }}>›</span>
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
      <div key={key++} style={{ overflowX: 'auto', margin: '12px 0', border: '1px solid var(--border-default)' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '10.5px' }}>
          <thead>
            <tr style={{ background: 'var(--bg-hover)' }}>
              {headerRow.map((cell, i) => (
                <th key={i} style={{ padding: '8px 12px', textAlign: 'left', color: 'var(--accent)', fontWeight: 600, letterSpacing: '.06em', borderBottom: '2px solid var(--border-strong)', whiteSpace: 'nowrap' }}>
                  {renderInline(cell.trim())}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {bodyRows.map((row, ri) => (
              <tr key={ri} style={{ borderBottom: '1px solid var(--border-default)', background: ri % 2 === 0 ? 'transparent' : 'var(--bg-hover)' }}>
                {row.map((cell, ci) => (
                  <td key={ci} style={{ padding: '6px 12px', color: 'var(--text-secondary)' }}>
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
    const parts: (string | React.JSX.Element)[] = [];
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
            background: 'var(--bg-hover)', padding: '1px 5px', fontSize: '10.5px',
            color: 'var(--text-secondary)', border: '1px solid var(--border-input)',
          }}>
            {firstMatch.content}
          </code>
        );
      } else if (firstMatch.type === 'bold') {
        parts.push(
          <strong key={partKey++} style={{ color: 'var(--text-primary)', fontWeight: 600 }}>
            {firstMatch.content}
          </strong>
        );
      } else if (firstMatch.type === 'link') {
        parts.push(
          <a key={partKey++} href={firstMatch.href} target="_blank" rel="noopener noreferrer" style={{ color: 'var(--accent)', textDecoration: 'underline', textUnderlineOffset: '2px' }}>
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
              margin: '16px 0', padding: '24px', background: 'var(--bg-primary)',
              border: '1px solid var(--border-default)', overflow: 'auto',
              display: 'flex', justifyContent: 'center',
            }}>
              <div className="mermaid-source" data-mermaid={codeContent} style={{ minWidth: '200px' }}>
                <div style={{ textAlign: 'center', fontSize: '10px', color: 'var(--text-faint)', letterSpacing: '.1em' }}>LOADING DIAGRAM...</div>
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
                  padding: '2px 8px', fontSize: '9px', color: 'var(--text-faint)',
                  letterSpacing: '.1em', background: 'var(--bg-hover)', borderLeft: '1px solid var(--border-default)',
                  borderBottom: '1px solid var(--border-default)',
                }}>
                  {lang.toUpperCase()}
                </div>
              )}
              <pre style={{
                background: 'var(--bg-elevated)', border: '1px solid var(--border-default)',
                padding: '14px 16px', overflow: 'auto', fontSize: '10.5px',
                lineHeight: 1.6, color: 'var(--text-secondary)',
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
          borderLeft: '3px solid var(--accent)', paddingLeft: '14px', margin: '8px 0',
          color: 'var(--text-muted)', fontStyle: 'italic',
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
          fontSize: '16px', fontWeight: 700, color: 'var(--text-primary)',
          letterSpacing: '.08em', marginTop: '24px', marginBottom: '10px',
          borderBottom: '2px solid var(--border-default)', paddingBottom: '10px',
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
          fontSize: '13px', fontWeight: 700, color: 'var(--accent)',
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
          fontSize: '12px', fontWeight: 700, color: 'var(--text-primary)',
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
          fontSize: '11px', fontWeight: 600, color: 'var(--text-secondary)',
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
        <hr key={key++} style={{ border: 'none', borderTop: '1px solid var(--border-input)', margin: '16px 0' }} />
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
          <span style={{ color: 'var(--accent)', fontWeight: 700, minWidth: '18px', flexShrink: 0 }}>{num}.</span>
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
      fontSize: '11.5px', color: 'var(--text-secondary)', lineHeight: 1.7,
      fontFamily: '"JetBrains Mono", monospace',
    }}>
      {elements}

      {/* Fullscreen Interactive Diagram Modal */}
      {fullscreenDiagram && (
        <div 
          style={{
            position: 'fixed', inset: 0, zIndex: 10000,
            background: 'rgba(0,0,0,0.95)', backdropFilter: 'blur(10px)',
            display: 'flex', flexDirection: 'column',
            overflow: 'hidden', cursor: isDragging ? 'grabbing' : 'default',
          }}
          onMouseMove={handleMouseMove}
          onMouseUp={handleMouseUp}
          onMouseLeave={handleMouseUp}
        >
          {/* Header Controls */}
          <div style={{
            padding: '16px 24px', display: 'flex', justifyContent: 'space-between',
            alignItems: 'center', borderBottom: '1px solid var(--border-default)',
            background: 'var(--bg-elevated)', zIndex: 10001,
          }}>
            <div style={{ display: 'flex', gap: '16px', alignItems: 'center' }}>
              <span style={{ color: 'var(--accent)', fontWeight: 700, letterSpacing: '.1em', fontSize: '12px' }}>INTERACTIVE DIAGRAM VIEW</span>
              <div style={{ height: '12px', width: '1px', background: 'var(--border-input)' }} />
              <div style={{ display: 'flex', gap: '12px' }}>
                <button 
                  onClick={() => setZoom(prev => prev * 1.2)}
                  style={{ background: 'var(--bg-hover)', border: '1px solid var(--border-input)', color: 'var(--text-secondary)', padding: '4px 10px', fontSize: '10px', cursor: 'pointer' }}
                >
                  ZOOM +
                </button>
                <button 
                  onClick={() => setZoom(prev => prev * 0.8)}
                  style={{ background: 'var(--bg-hover)', border: '1px solid var(--border-input)', color: 'var(--text-secondary)', padding: '4px 10px', fontSize: '10px', cursor: 'pointer' }}
                >
                  ZOOM -
                </button>
                <button 
                  onClick={() => { setZoom(1); setPosition({ x: 0, y: 0 }); }}
                  style={{ background: 'var(--bg-hover)', border: '1px solid var(--border-input)', color: 'var(--text-secondary)', padding: '4px 10px', fontSize: '10px', cursor: 'pointer' }}
                >
                  RESET VIEW
                </button>
              </div>
              <div style={{ fontSize: '10px', color: 'var(--text-faint)', marginLeft: '8px' }}>
                SCROLL TO ZOOM • DRAG TO PAN
              </div>
            </div>
            <button 
              onClick={() => setFullscreenDiagram(null)}
              style={{ background: 'var(--accent)', border: 'none', color: '#FFFFFF', padding: '6px 16px', fontSize: '10px', fontWeight: 700, cursor: 'pointer', letterSpacing: '.05em' }}
            >
              [ CLOSE ]
            </button>
          </div>

          {/* Canvas Area */}
          <div 
            style={{ flex: 1, position: 'relative', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
            onMouseDown={handleMouseDown}
            onWheel={handleWheel}
          >
            <div 
              style={{
                transform: `translate(${position.x}px, ${position.y}px) scale(${zoom})`,
                transition: isDragging ? 'none' : 'transform 0.1s ease-out',
                width: '100%', height: '100%',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}
              dangerouslySetInnerHTML={{ __html: fullscreenDiagram.svg }}
            />
          </div>
        </div>
      )}
    </div>
  );
}
