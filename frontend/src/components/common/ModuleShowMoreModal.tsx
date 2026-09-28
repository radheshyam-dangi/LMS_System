import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { ModuleDescription } from '../../utils/textUtils';

export const ModuleDescriptionPreview = ({ description, resources, onShowMore }: { description: string, resources: any[], onShowMore: () => void }) => {
  const [isOverflowing, setIsOverflowing] = useState(false);
  const textRef = React.useRef<HTMLDivElement>(null);

  useEffect(() => {
    const checkOverflow = () => {
      if (textRef.current) {
        setIsOverflowing(textRef.current.scrollHeight > textRef.current.clientHeight);
      }
    };
    const timeoutId = setTimeout(checkOverflow, 10);
    window.addEventListener('resize', checkOverflow);
    return () => {
      clearTimeout(timeoutId);
      window.removeEventListener('resize', checkOverflow);
    };
  }, [description]);

  const hasResources = resources && resources.length > 0;
  const showButton = isOverflowing || hasResources;

  return (
    <div>
      <div 
        ref={textRef} 
        style={{ margin: 0, opacity: 0.9, fontSize: 15, maxWidth: 900, lineHeight: 1.6, color: '#e0e7ff', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}
      >
        <ModuleDescription description={description} />
      </div>
      {showButton && (
        <button 
          onClick={(e) => { e.preventDefault(); onShowMore(); }} 
          style={{ background: 'none', border: 'none', color: '#a5b4fc', cursor: 'pointer', padding: 0, marginTop: 8, fontSize: 14, fontWeight: 700, textDecoration: 'underline' }}
        >
          Show more
        </button>
      )}
    </div>
  );
};

export const ModuleShowMoreModal = ({ description, resources, onClose, onVisitResource, isTrainee }: { description: string, resources: any[], onClose: () => void, onVisitResource: (id: string) => void, isTrainee: boolean }) => {
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

  const modalContent = (
    <div className="modal-overlay" onClick={onClose} style={{ zIndex: 1000, position: 'fixed', inset: 0, background: 'rgba(15, 15, 20, 0.55)', backdropFilter: 'blur(6px)', WebkitBackdropFilter: 'blur(6px)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 'env(safe-area-inset-top) env(safe-area-inset-right) env(safe-area-inset-bottom) env(safe-area-inset-left)' }}>
      <div 
        className="modal-content" 
        onClick={(e) => e.stopPropagation()} 
        role="dialog" 
        aria-modal="true"
        aria-labelledby="desc-modal-title"
        style={{ zIndex: 1001, width: '90vw', maxWidth: '480px', maxHeight: '85vh', overflowY: 'auto', display: 'flex', flexDirection: 'column', background: '#fff', borderRadius: '16px', boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)' }}
      >
        <div style={{ padding: '24px', borderBottom: '1px solid #e2e8f0', display: 'flex', justifyContent: 'space-between', alignItems: 'center', position: 'sticky', top: 0, background: '#fff', zIndex: 10 }}>
          <h2 id="desc-modal-title" style={{ fontSize: '20px', fontWeight: 700, margin: 0, color: '#1e293b' }}>Module Information</h2>
          <button onClick={onClose} style={{ background: 'none', border: 'none', fontSize: '24px', cursor: 'pointer', color: '#64748b' }}>&times;</button>
        </div>
        <div style={{ padding: '24px', flex: 1 }}>
          <h3 style={{ fontSize: '14px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', color: '#475569', marginBottom: '12px' }}>Description</h3>
          <div style={{ margin: 0, color: '#334155', fontSize: '15px', lineHeight: 1.6, wordBreak: 'break-word', overflowWrap: 'break-word', marginBottom: '24px' }}>
            <ModuleDescription description={description} />
          </div>
          
          {resources && resources.length > 0 && (
            <div>
              <h3 style={{ fontSize: '14px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', color: '#475569', marginBottom: '12px' }}>Resources</h3>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                {resources.map((res: any) => (
                  <a 
                    key={res.id} 
                    href={res.url} 
                    target="_blank" 
                    rel="noreferrer"
                    onClick={() => { if (res.id && isTrainee) onVisitResource(res.id); }}
                    style={{ color: '#4f46e5', fontSize: '14px', textDecoration: 'none', display: 'flex', alignItems: 'center', gap: '8px', fontWeight: 500, padding: '12px', background: '#f8fafc', borderRadius: '8px', border: '1px solid #e2e8f0' }}
                  >
                    <span style={{ fontSize: '16px' }}>🔗</span>
                    {res.title || 'Resource'}
                  </a>
                ))}
              </div>
            </div>
          )}
        </div>
        <div style={{ padding: '16px 24px', borderTop: '1px solid #e2e8f0', display: 'flex', justifyContent: 'flex-end', position: 'sticky', bottom: 0, background: '#fff', zIndex: 10 }}>
          <button onClick={onClose} style={{ padding: '10px 20px', background: '#f1f5f9', color: '#475569', borderRadius: '8px', border: 'none', fontWeight: 600, cursor: 'pointer' }}>Close</button>
        </div>
      </div>
    </div>
  );

  return createPortal(modalContent, document.body);
};
