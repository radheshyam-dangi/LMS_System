import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  BookOpen,
  Edit3,
  CheckCircle2,
  Trash2,
  ArrowRight,
  Layers,
  FileText,
  Loader2,
} from 'lucide-react';
import type { ActionCardData } from './useTrainerAiAssistant';

interface TrainerActionCardProps {
  card: ActionCardData;
  onConfirm: (actionId: string) => Promise<any>;
  onCancel: (actionId: string) => Promise<any>;
  onCloseDrawer?: () => void;
}

export const TrainerActionCard: React.FC<TrainerActionCardProps> = ({
  card,
  onConfirm,
  onCancel,
  onCloseDrawer,
}) => {
  const navigate = useNavigate();
  const [isConfirming, setIsConfirming] = useState(false);
  const [isCancelling, setIsCancelling] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handlePreview = () => {
    navigate(`/learning-paths/${card.lpId}/edit`);
    window.dispatchEvent(new CustomEvent('lp_preview_requested', { detail: { lpId: card.lpId } }));
  };

  const handleConfirm = async () => {
    setIsConfirming(true);
    setError(null);
    try {
      await onConfirm(card.actionId);
    } catch (err: any) {
      setError(err.message || 'Failed to confirm');
    } finally {
      setIsConfirming(false);
    }
  };

  const handleCancel = async () => {
    setIsCancelling(true);
    setError(null);
    try {
      await onCancel(card.actionId);
    } catch (err: any) {
      setError(err.message || 'Failed to discard draft');
    } finally {
      setIsCancelling(false);
    }
  };

  const isConfirmed = card.status === 'confirmed';
  const isCancelled = card.status === 'cancelled';
  const isPending = card.status === 'pending';

  return (
    <div
      style={{
        marginTop: '10px',
        padding: '14px 16px',
        background: '#ffffff',
        borderRadius: '12px',
        border: isConfirmed ? '1.5px solid #10b981' : isCancelled ? '1px solid #e2e8f0' : '1.5px solid #e2e8f0',
        boxShadow: isPending ? '0 4px 16px -2px rgba(99, 102, 241, 0.08)' : 'none',
        display: 'flex',
        flexDirection: 'column',
        gap: '12px',
      }}
    >
      {/* Course Title */}
      <div
        style={{
          fontSize: '15px',
          fontWeight: 700,
          color: '#0f172a',
          lineHeight: 1.35,
        }}
      >
        {card.lpTitle}
      </div>

      {card.summary && (
        <div
          style={{
            padding: '8px 12px',
            borderRadius: '8px',
            background: card.actionType === 'confirm_crud' ? '#f0fdf4' : '#f5f3ff',
            border: card.actionType === 'confirm_crud' ? '1px solid #bbf7d0' : '1px solid #ede9fe',
            color: card.actionType === 'confirm_crud' ? '#166534' : '#4338ca',
            fontSize: '12.5px',
            fontWeight: 600,
            lineHeight: 1.4,
          }}
        >
          {card.actionType === 'confirm_crud' ? 'Pending Change: ' : 'Summary: '}
          {card.summary}
        </div>
      )}

      {/* Curriculum breakdown pill metrics */}
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
        <div
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '5px',
            padding: '4px 10px',
            borderRadius: '6px',
            background: '#f5f3ff',
            border: '1px solid #ede9fe',
            fontSize: '12px',
            color: '#4f46e5',
            fontWeight: 600,
          }}
        >
          <Layers size={13} color="#6366f1" />
          <span>{card.moduleCount} Modules</span>
        </div>

        <div
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '5px',
            padding: '4px 10px',
            borderRadius: '6px',
            background: '#f0f9ff',
            border: '1px solid #e0f2fe',
            fontSize: '12px',
            color: '#0284c7',
            fontWeight: 600,
          }}
        >
          <BookOpen size={13} color="#0284c7" />
          <span>{card.lessonCount} Lessons</span>
        </div>

        <div
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '5px',
            padding: '4px 10px',
            borderRadius: '6px',
            background: '#fffbeb',
            border: '1px solid #fef3c7',
            fontSize: '12px',
            color: '#d97706',
            fontWeight: 600,
          }}
        >
          <FileText size={13} color="#d97706" />
          <span>{card.assignmentCount} Assignments</span>
        </div>
      </div>

      {error && (
        <div style={{ fontSize: '12px', color: '#ef4444', background: '#fee2e2', padding: '6px 10px', borderRadius: '6px' }}>
          {error}
        </div>
      )}

      {/* Interactive Action Buttons */}
      {isPending && (
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', paddingTop: '8px', borderTop: '1px solid #f1f5f9' }}>
          <button
            type="button"
            onClick={handlePreview}
            style={{
              flex: 1,
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '6px',
              padding: '9px 12px',
              borderRadius: '8px',
              border: '1px solid #cbd5e1',
              background: '#ffffff',
              color: '#1e293b',
              fontSize: '13px',
              fontWeight: 600,
              cursor: 'pointer',
              transition: 'all 0.15s ease',
            }}
            title="Open in visual Curriculum Studio"
          >
            <Edit3 size={14} color="#6366f1" />
            <span>Preview in Studio</span>
          </button>

          <button
            type="button"
            onClick={handleConfirm}
            disabled={isConfirming || isCancelling}
            style={{
              flex: 1.2,
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '6px',
              padding: '9px 14px',
              borderRadius: '8px',
              border: 'none',
              background: 'linear-gradient(135deg, #4f46e5 0%, #6366f1 100%)',
              color: '#ffffff',
              fontSize: '13px',
              fontWeight: 600,
              cursor: isConfirming ? 'not-allowed' : 'pointer',
              boxShadow: '0 2px 6px rgba(79, 70, 229, 0.25)',
              transition: 'all 0.15s ease',
            }}
          >
            {isConfirming ? (
              <>
                <Loader2 size={14} className="spin" />
                <span>{card.actionType === 'confirm_crud' ? 'Applying...' : 'Publishing...'}</span>
              </>
            ) : (
              <>
                <CheckCircle2 size={14} />
                <span>{card.actionType === 'confirm_crud' ? 'Confirm & Apply' : 'Confirm & Publish'}</span>
              </>
            )}
          </button>

          <button
            type="button"
            onClick={handleCancel}
            disabled={isConfirming || isCancelling}
            style={{
              padding: '9px',
              borderRadius: '8px',
              border: '1px solid #f1f5f9',
              background: '#f8fafc',
              color: '#94a3b8',
              fontSize: '12px',
              cursor: isCancelling ? 'not-allowed' : 'pointer',
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              transition: 'all 0.15s ease',
            }}
            title={card.actionType === 'confirm_crud' ? 'Cancel this change' : 'Discard this draft'}
          >
            {isCancelling ? <Loader2 size={13} className="spin" /> : <Trash2 size={14} />}
          </button>
        </div>
      )}

      {isConfirmed && (
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', paddingTop: '8px', borderTop: '1px solid #ecfdf5' }}>
          <span style={{ fontSize: '12.5px', color: '#059669', fontWeight: 600, display: 'inline-flex', alignItems: 'center', gap: '5px' }}>
            <CheckCircle2 size={14} /> {card.actionType === 'confirm_crud' ? 'Applied to Curriculum' : 'Published to Catalog'}
          </span>
          <button
            type="button"
            onClick={() => {
              if (onCloseDrawer) onCloseDrawer();
              navigate(`/learning-paths/${card.lpId}`);
            }}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '4px',
              border: 'none',
              background: 'none',
              color: '#4f46e5',
              fontSize: '12.5px',
              fontWeight: 600,
              cursor: 'pointer',
            }}
          >
            <span>View Learning Path</span>
            <ArrowRight size={13} />
          </button>
        </div>
      )}

      {isCancelled && (
        <div style={{ paddingTop: '6px', borderTop: '1px solid #f1f5f9', fontSize: '12px', color: '#94a3b8', fontStyle: 'italic' }}>
          {card.actionType === 'confirm_crud' ? 'Change cancelled' : 'Draft discarded'}
        </div>
      )}
    </div>
  );
};
