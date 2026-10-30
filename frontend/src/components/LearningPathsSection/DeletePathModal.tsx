import React, { useEffect } from 'react';
import { createPortal } from 'react-dom';
import { Trash2, AlertCircle, Layers, BookOpen, FileText, Users } from 'lucide-react';
import { useScrollLock } from '../../hooks/useScrollLock';
import type { LearningPath } from '../../types/auth';
import './DeletePathModal.css';

interface DeletePathModalProps {
  path: LearningPath;
  isDeleting: boolean;
  onClose: () => void;
  onConfirm: () => void;
  metrics: {
    modulesCount: number;
    lessonsCount: number;
    tasksCount: number;
    enrolledCount: number;
  };
}

export const DeletePathModal: React.FC<DeletePathModalProps> = ({
  path,
  isDeleting,
  onClose,
  onConfirm,
  metrics,
}) => {
  useScrollLock(true);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !isDeleting) onClose();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onClose, isDeleting]);

  const pathTitle = path.title || path.name || 'Untitled Track';

  const modalContent = (
    <div className="delete-path-modal-overlay" onClick={() => !isDeleting && onClose()}>
      <div
        className="delete-path-modal-card"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-labelledby="delete-path-modal-title"
      >
        {/* Top Header with Danger Orb & Close Button */}
        <div className="delete-path-modal-header">
          <div className="delete-path-icon-orb">
            <Trash2 size={22} />
          </div>
          <button
            type="button"
            className="delete-path-close-btn"
            onClick={onClose}
            disabled={isDeleting}
            aria-label="Close"
          >
            &times;
          </button>
        </div>

        {/* Content Body */}
        <div className="delete-path-modal-body">
          <h2 id="delete-path-modal-title" className="delete-path-modal-title">
            Delete Learning Path?
          </h2>
          <p className="delete-path-modal-desc">
            Are you sure you want to permanently delete <strong>"{pathTitle}"</strong>?
          </p>

          {/* Breakdown Card */}
          <div className="delete-path-impact-box">
            <span className="delete-path-impact-label">This will permanently remove:</span>
            <div className="delete-path-impact-grid">
              <div className="delete-path-impact-item">
                <Layers size={15} className="delete-path-impact-icon" />
                <span><strong>{metrics.modulesCount}</strong> Modules</span>
              </div>
              <div className="delete-path-impact-item">
                <BookOpen size={15} className="delete-path-impact-icon" />
                <span><strong>{metrics.lessonsCount}</strong> Lessons</span>
              </div>
              <div className="delete-path-impact-item">
                <FileText size={15} className="delete-path-impact-icon" />
                <span><strong>{metrics.tasksCount}</strong>   Assignments</span>
              </div>
              <div className="delete-path-impact-item">
                <Users size={15} className="delete-path-impact-icon" />
                <span> progress for <strong>{metrics.enrolledCount}</strong> enrolled trainee{metrics.enrolledCount === 1 ? '' : 's'}</span>
              </div>
            </div>
          </div>

          {/* Caution Alert */}
          <div className="delete-path-warning-pill">
            <AlertCircle size={16} style={{ flexShrink: 0 }} />
            <span>This action cannot be undone.</span>
          </div>
        </div>

        {/* Action Footer */}
        <div className="delete-path-modal-footer">
          <button
            type="button"
            className="delete-path-cancel-btn"
            onClick={onClose}
            disabled={isDeleting}
          >
            Cancel
          </button>
          <button
            type="button"
            className="delete-path-confirm-btn"
            onClick={onConfirm}
            disabled={isDeleting}
          >
            {isDeleting ? (
              <>
                <span className="delete-btn-spinner" /> Deleting...
              </>
            ) : (
              <>
                <Trash2 size={15} /> Delete Learning Path
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );

  return createPortal(modalContent, document.body);
};
