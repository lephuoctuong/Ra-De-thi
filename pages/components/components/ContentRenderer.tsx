
import React, { useEffect, useRef, useMemo } from 'react';

interface ContentRendererProps {
  content: string;
  className?: string;
}

declare global {
  interface Window {
    renderMathInElement: any;
    DOMPurify: any;
  }
}

type BlockType = 'text' | 'math_inline' | 'math_block' | 'svg' | 'chem' | 'cropped_img';

interface ContentBlock {
  type: BlockType;
  content: string;
}

const ContentRenderer: React.FC<ContentRendererProps> = ({ content, className = "" }) => {
  const containerRef = useRef<HTMLDivElement>(null);

  // Parser logic: Tách văn bản thành các khối chuyên biệt
  const blocks = useMemo(() => {
    if (!content) return [];
    
    const result: ContentBlock[] = [];
    
    // Regex hỗ trợ lồng nhau và các trường hợp đặc biệt
    const figureRegex = /\[FIGURE\s+type="svg"\]([\s\S]*?)\[\/FIGURE\]/gi;
    const croppedImgRegex = /\[FIGURE\s+type="cropped_img"\]([\s\S]*?)\[\/FIGURE\]/gi;
    const chemRegex = /\\ce\{((?:[^{}]|\{[^{}]*\})*)\}/g;

    const placeholders: { id: string, block: ContentBlock }[] = [];
    
    let processed = content.replace(figureRegex, (_match, p1) => {
      const id = `##FIG${placeholders.length}##`;
      placeholders.push({ id, block: { type: 'svg', content: p1.trim() } });
      return id;
    });

    processed = processed.replace(croppedImgRegex, (_match, p1) => {
      const id = `##CR_IMG${placeholders.length}##`;
      placeholders.push({ id, block: { type: 'cropped_img', content: p1.trim() } });
      return id;
    });

    // 1. Double dollar $$ (block math) first
    processed = processed.replace(/\$\$([\s\S]*?)\$\$/g, (_match, p1) => {
      const id = `##MBL${placeholders.length}##`;
      placeholders.push({ id, block: { type: 'math_block', content: p1.trim() } });
      return id;
    });

    // 2. Bracket \[ (block math) second
    processed = processed.replace(/\\\[([\s\S]*?)\\\]/g, (_match, p1) => {
      const id = `##MBL${placeholders.length}##`;
      placeholders.push({ id, block: { type: 'math_block', content: p1.trim() } });
      return id;
    });

    // 3. Parenthesis \( (inline math) third
    processed = processed.replace(/\\\(([\s\S]*?)\\\)/g, (_match, p1) => {
      const id = `##MIN${placeholders.length}##`;
      placeholders.push({ id, block: { type: 'math_inline', content: p1.trim() } });
      return id;
    });

    // 4. Single dollar $ (inline math) fourth
    processed = processed.replace(/\$([^\$\n]+?)\$/g, (_match, p1) => {
      const id = `##MIN${placeholders.length}##`;
      placeholders.push({ id, block: { type: 'math_inline', content: p1.trim() } });
      return id;
    });

    // 5. Chem
    processed = processed.replace(chemRegex, (_match, p1) => {
      const id = `##CHM${placeholders.length}##`;
      placeholders.push({ id, block: { type: 'chem', content: p1.trim() } });
      return id;
    });

    const parts = processed.split(/(##(?:FIG|CR_IMG|MBL|MIN|CHM)\d+##)/);
    
    parts.forEach(part => {
      if (!part) return;
      const found = placeholders.find(p => p.id === part);
      if (found) result.push(found.block);
      else result.push({ type: 'text', content: part });
    });

    return result;
  }, [content]);

  // Sử dụng KaTeX để render
  useEffect(() => {
    const renderMath = () => {
      if (containerRef.current && window.renderMathInElement) {
        window.renderMathInElement(containerRef.current, {
          delimiters: [
            { left: '$$', right: '$$', display: true },
            { left: '$', right: '$', display: false },
            { left: '\\(', right: '\\)', display: false },
            { left: '\\[', right: '\\]', display: true }
          ],
          throwOnError: false,
          trust: true
        });
      }
    };

    // Debounce nhẹ để tránh render liên tục khi dữ liệu đang stream
    const timeout = setTimeout(renderMath, 50);
    return () => clearTimeout(timeout);
  }, [blocks]);

  const renderBlock = (block: ContentBlock, index: number) => {
    switch (block.type) {
      case 'svg':
        const sanitizeConfig = {
          USE_PROFILES: { svg: true, svgFilters: true },
          ADD_ATTR: ['viewBox', 'preserveAspectRatio', 'vector-effect'],
        };
        let cleanSvg = window.DOMPurify ? window.DOMPurify.sanitize(block.content, sanitizeConfig) : block.content;
        return (
          <div key={index} className="figure-wrapper my-8 group relative">
            <div className="figure-container flex justify-center bg-white p-6 rounded-3xl border border-slate-100 shadow-sm"
              dangerouslySetInnerHTML={{ __html: cleanSvg }}
            />
          </div>
        );
      case 'cropped_img':
        return (
          <div key={index} className="cropped-img-wrapper my-6 flex justify-center">
            <img 
              src={block.content} 
              alt="Hình vẽ được cắt tự động bởi AI" 
              referrerPolicy="no-referrer"
              className="max-w-[95%] border border-slate-200 rounded-2xl p-4 bg-white shadow-sm hover:shadow-md transition-all duration-300 transform hover:scale-[1.01]" 
            />
          </div>
        );
      case 'math_block':
        return <div key={index} className="math-block-wrapper my-4">{"$$" + block.content + "$$"}</div>;
      case 'math_inline':
        return <span key={index} className="math-inline-wrapper">{"$" + block.content + "$"}</span>;
      case 'chem':
        return <span key={index} className="math-inline-wrapper text-indigo-700">{"$\\ce{" + block.content + "}$"}</span>;
      default:
        return <span key={index} className="whitespace-pre-wrap">{block.content}</span>;
    }
  };

  return (
    <div ref={containerRef} className={`latex-container select-text ${className}`}>
      {blocks.map((block, idx) => renderBlock(block, idx))}
    </div>
  );
};

export default ContentRenderer;
