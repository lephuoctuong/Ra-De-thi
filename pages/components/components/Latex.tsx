
import React, { useEffect, useRef } from 'react';

interface LatexProps {
  content: string;
  className?: string;
}

declare global {
  interface Window {
    renderMathInElement: any;
  }
}

const Latex: React.FC<LatexProps> = ({ content, className = "" }) => {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (containerRef.current && window.renderMathInElement) {
      try {
        window.renderMathInElement(containerRef.current, {
          delimiters: [
            { left: '$$', right: '$$', display: true },
            { left: '$', right: '$', display: false },
            { left: '\\(', right: '\\)', display: false },
            { left: '\\[', right: '\\]', display: true }
          ],
          throwOnError: false,
          // Thêm macros nếu cần thiết
          macros: {
            "\\RR": "\\mathbb{R}",
            "\\ZZ": "\\mathbb{Z}"
          }
        });
      } catch (err) {
        console.error("KaTeX render error:", err);
      }
    }
  }, [content]);

  return (
    <div 
      ref={containerRef} 
      className={`latex-container ${className}`}
      // Render text ban đầu, useEffect sẽ quét và biến đổi các phần Latex
    >
      {content}
    </div>
  );
};

export default Latex;
