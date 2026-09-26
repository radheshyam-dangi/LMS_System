import React, { useState, useEffect, useRef } from 'react';
import DOMPurify from 'dompurify';
import { RichText } from '../common/RichText';
import './ExpandableDescription.css';

interface ExpandableDescriptionProps {
  html: string;
}

export function ExpandableDescription({ html }: ExpandableDescriptionProps) {
  const [expanded, setExpanded] = useState(false);
  const [isOverflowing, setIsOverflowing] = useState(false);
  const textRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    // Check if the content is overflowing its container on mount and resize
    const checkOverflow = () => {
      if (textRef.current) {
        // Only offer "Show more" if the content exceeds the 2-line clamp
        const isClamped = textRef.current.scrollHeight > textRef.current.clientHeight;
        setIsOverflowing(isClamped);
      }
    };

    // Need a tiny delay for the DOM to render the HTML properly before measuring
    const timeoutId = setTimeout(checkOverflow, 0);
    window.addEventListener('resize', checkOverflow);
    return () => {
      clearTimeout(timeoutId);
      window.removeEventListener('resize', checkOverflow);
    };
  }, [html]);

  const sanitizedHtml = DOMPurify.sanitize(html || '');

  if (!sanitizedHtml) {
    return null; // Don't render anything if there's no valid description
  }

  return (
    <div className="description-block">
      <div
        ref={textRef}
        className={`description-text ${expanded ? 'expanded' : 'clamped'}`}
      >
        <RichText content={html} emptyStateText="" />
      </div>
      {isOverflowing && (
        <button
          className="show-more-toggle"
          aria-expanded={expanded}
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
            setExpanded(prev => !prev);
          }}
        >
          {expanded ? 'Show less' : 'Show more'}
        </button>
      )}
    </div>
  );
}
