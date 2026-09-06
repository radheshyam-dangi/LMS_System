import React, { useEffect, useRef, useState } from 'react';
import axios from 'axios';
import { API_BASE_URL } from '../../api';

export type TraineeSummaryData = {
  traineeId: string;
  traineeName: string;
  avgScore: number | null;
  lessonsCompleted: number;
  lessonsTotal: number;
  overallLPProgress: number;
  learningPaths: { lpId: string; lpName: string; progressPercent: number }[];
  assignmentsSummary: { pending: number; submitted: number; needsImprovement: number; approved: number };
  status: 'On Track' | 'At Risk' | 'Not Started' | 'Completed';
};

type TraineeSummaryModalProps = {
  isOpen: boolean;
  onClose: () => void;
  traineeId: string | null;
  accessToken: string;
};

export const TraineeSummaryModal: React.FC<TraineeSummaryModalProps> = ({
  isOpen,
  onClose,
  traineeId,
  accessToken,
}) => {
  const [data, setData] = useState<TraineeSummaryData | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [isAnimating, setIsAnimating] = useState(false);
  const [shouldRender, setShouldRender] = useState(false);

  const modalRef = useRef<HTMLDivElement>(null);

  // Transition Logic
  useEffect(() => {
    if (isOpen) {
      setShouldRender(true);
      // Small delay to allow display:block to apply before animating opacity
      requestAnimationFrame(() => setIsAnimating(true));
    } else {
      setIsAnimating(false);
      const timer = setTimeout(() => setShouldRender(false), 200); // match transition duration
      return () => clearTimeout(timer);
    }
  }, [isOpen]);

  // Fetch Data
  useEffect(() => {
    if (!isOpen || !traineeId) {
      if (!isOpen) setData(null); // Clear on close
      return;
    }

    let isMounted = true;
    setIsLoading(true);
    setError('');

    axios.get(`${API_BASE_URL}/trainer/trainees/${traineeId}/summary`, {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    })
      .then(res => {
        if (isMounted) {
          setData(res.data);
          setIsLoading(false);
        }
      })
      .catch(err => {
        if (isMounted) {
          console.error('Failed to fetch trainee summary', err);
          setError('Failed to load data.');
          setIsLoading(false);
        }
      });

    return () => { isMounted = false; };
  }, [isOpen, traineeId, accessToken]);

  // Focus trap and escape key
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };

    document.addEventListener('keydown', handleKeyDown);
    // Focus the modal when it opens
    modalRef.current?.focus();

    return () => {
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen, onClose]);

  const handleBackdropClick = (e: React.MouseEvent) => {
    if (e.target === e.currentTarget) {
      onClose();
    }
  };

  if (!shouldRender) return null;

  const backdropStyle: React.CSSProperties = {
    position: 'fixed',
    top: 0, left: 0, right: 0, bottom: 0,
    backgroundColor: 'rgba(15, 23, 42, 0.4)',
    backdropFilter: 'blur(4px)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 9999,
    opacity: isAnimating ? 1 : 0,
    transition: 'opacity 0.2s ease-out',
    padding: '16px'
  };

  const modalStyle: React.CSSProperties = {
    background: '#fff',
    borderRadius: '12px',
    boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04)',
    width: '100%',
    maxWidth: '600px',
    maxHeight: '90vh',
    display: 'flex',
    flexDirection: 'column',
    transform: isAnimating ? 'scale(1) translateY(0)' : 'scale(0.95) translateY(10px)',
    opacity: isAnimating ? 1 : 0,
    transition: 'transform 0.2s ease-out, opacity 0.2s ease-out',
    outline: 'none',
  };

  const getStatusColor = (status?: string) => {
    switch (status?.toLowerCase()) {
      case 'completed': return { bg: '#d1fae5', text: '#065f46' };
      case 'on track': return { bg: '#dbeafe', text: '#1e40af' };
      case 'at risk': return { bg: '#fee2e2', text: '#991b1b' };
      default: return { bg: '#f1f5f9', text: '#475569' };
    }
  };

  const renderContent = () => {
    if (isLoading) {
      return (
        <div style={{ padding: '24px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <div style={{ display: 'flex', gap: '16px', alignItems: 'center' }}>
            <div style={{ width: '48px', height: '48px', borderRadius: '50%', background: '#e2e8f0', animation: 'pulse 1.5s infinite ease-in-out' }} />
            <div style={{ height: '24px', width: '150px', background: '#e2e8f0', borderRadius: '4px', animation: 'pulse 1.5s infinite ease-in-out' }} />
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(120px, 1fr))', gap: '16px', marginTop: '16px' }}>
            <div style={{ height: '80px', background: '#f8fafc', borderRadius: '8px', animation: 'pulse 1.5s infinite ease-in-out' }} />
            <div style={{ height: '80px', background: '#f8fafc', borderRadius: '8px', animation: 'pulse 1.5s infinite ease-in-out' }} />
            <div style={{ height: '80px', background: '#f8fafc', borderRadius: '8px', animation: 'pulse 1.5s infinite ease-in-out' }} />
          </div>
          <div style={{ height: '150px', background: '#f8fafc', borderRadius: '8px', marginTop: '16px', animation: 'pulse 1.5s infinite ease-in-out' }} />
        </div>
      );
    }

    if (error || !data) {
      return (
        <div style={{ padding: '48px 24px', textAlign: 'center', color: '#64748b' }}>
          {error || 'No data found.'}
        </div>
      );
    }

    if (data.learningPaths.length === 0 && data.assignmentsSummary.pending === 0 && data.assignmentsSummary.submitted === 0 && data.assignmentsSummary.approved === 0 && data.assignmentsSummary.needsImprovement === 0) {
      return (
        <div style={{ padding: '48px 24px', textAlign: 'center' }}>
           <div style={{ fontSize: '48px', marginBottom: '16px' }}>🌱</div>
           <h3 style={{ fontSize: '18px', fontWeight: 700, margin: '0 0 8px 0', color: '#0f172a' }}>Nothing assigned yet</h3>
           <p style={{ color: '#64748b', fontSize: '14px', margin: 0 }}>You haven't assigned any Learning Paths or tasks to this trainee yet.</p>
        </div>
      );
    }

    const initials = data.traineeName.substring(0, 2).toUpperCase();
    const statusColor = getStatusColor(data.status);

    return (
      <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
        {/* Header */}
        <div style={{ padding: '24px', borderBottom: '1px solid #f1f5f9', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
             <div style={{ width: '48px', height: '48px', borderRadius: '50%', background: '#4f46e5', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '18px', fontWeight: 700 }}>
               {initials}
             </div>
             <div>
               <h2 style={{ fontSize: '20px', fontWeight: 700, margin: '0 0 4px 0', color: '#0f172a' }}>{data.traineeName}</h2>
               <span style={{ display: 'inline-block', padding: '2px 8px', borderRadius: '12px', fontSize: '12px', fontWeight: 600, backgroundColor: statusColor.bg, color: statusColor.text }}>
                 {data.status}
               </span>
             </div>
          </div>
          <button onClick={onClose} style={{ background: 'transparent', border: 'none', fontSize: '24px', color: '#94a3b8', cursor: 'pointer', padding: '4px' }}>×</button>
        </div>

        <div style={{ padding: '24px', overflowY: 'auto', flex: 1, display: 'flex', flexDirection: 'column', gap: '24px' }}>
          
          {/* Stats Row */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(120px, 1fr))', gap: '16px' }}>
             <div style={{ background: '#f8fafc', padding: '16px', borderRadius: '8px', border: '1px solid #f1f5f9' }}>
               <div style={{ fontSize: '12px', color: '#64748b', marginBottom: '8px', fontWeight: 600 }}>Score Gained</div>
               <div style={{ fontSize: '24px', fontWeight: 700, color: '#0f172a' }}>
                 {data.avgScore !== null ? `${data.avgScore}%` : '-'}
               </div>
             </div>
             <div style={{ background: '#f8fafc', padding: '16px', borderRadius: '8px', border: '1px solid #f1f5f9' }}>
               <div style={{ fontSize: '12px', color: '#64748b', marginBottom: '8px', fontWeight: 600 }}>Lessons Completed</div>
               <div style={{ fontSize: '24px', fontWeight: 700, color: '#0f172a' }}>
                 {data.lessonsCompleted} <span style={{ fontSize: '14px', color: '#94a3b8', fontWeight: 500 }}>/ {data.lessonsTotal}</span>
               </div>
             </div>
             <div style={{ background: '#f8fafc', padding: '16px', borderRadius: '8px', border: '1px solid #f1f5f9' }}>
               <div style={{ fontSize: '12px', color: '#64748b', marginBottom: '8px', fontWeight: 600 }}>Total LP Progress</div>
               <div style={{ fontSize: '24px', fontWeight: 700, color: '#0f172a' }}>
                 {data.overallLPProgress}%
               </div>
             </div>
          </div>

          {/* LPs List */}
          {data.learningPaths.length > 0 && (
            <div>
              <h3 style={{ fontSize: '14px', fontWeight: 700, color: '#0f172a', marginBottom: '12px' }}>Assigned Learning Paths</h3>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                {data.learningPaths.map(lp => (
                  <div key={lp.lpId} style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                    <div style={{ flex: 1, fontSize: '14px', color: '#334155', fontWeight: 500 }}>{lp.lpName}</div>
                    <div style={{ width: '120px', height: '6px', background: '#e2e8f0', borderRadius: '3px', overflow: 'hidden' }}>
                      <div style={{ height: '100%', background: '#4f46e5', width: `${lp.progressPercent}%` }} />
                    </div>
                    <div style={{ width: '40px', textAlign: 'right', fontSize: '13px', color: '#64748b', fontWeight: 600 }}>
                      {lp.progressPercent}%
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Assignments Summary */}
          <div>
             <h3 style={{ fontSize: '14px', fontWeight: 700, color: '#0f172a', marginBottom: '12px' }}>Assignments Breakdown</h3>
             <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                <div style={{ padding: '6px 12px', background: '#f1f5f9', borderRadius: '6px', fontSize: '13px', color: '#475569', fontWeight: 600 }}>
                  <span style={{ color: '#94a3b8', marginRight: '6px' }}>Pending</span>
                  {data.assignmentsSummary.pending}
                </div>
                <div style={{ padding: '6px 12px', background: '#eff6ff', borderRadius: '6px', fontSize: '13px', color: '#1d4ed8', fontWeight: 600 }}>
                  <span style={{ color: '#93c5fd', marginRight: '6px' }}>Submitted</span>
                  {data.assignmentsSummary.submitted}
                </div>
                <div style={{ padding: '6px 12px', background: '#fef2f2', borderRadius: '6px', fontSize: '13px', color: '#b91c1c', fontWeight: 600 }}>
                  <span style={{ color: '#fca5a5', marginRight: '6px' }}>Needs Improvement</span>
                  {data.assignmentsSummary.needsImprovement}
                </div>
                <div style={{ padding: '6px 12px', background: '#f0fdf4', borderRadius: '6px', fontSize: '13px', color: '#15803d', fontWeight: 600 }}>
                  <span style={{ color: '#86efac', marginRight: '6px' }}>Approved</span>
                  {data.assignmentsSummary.approved}
                </div>
             </div>
          </div>
          
        </div>
      </div>
    );
  };

  return (
    <div style={backdropStyle} onClick={handleBackdropClick}>
      <div 
        ref={modalRef} 
        style={modalStyle} 
        tabIndex={-1}
        role="dialog"
        aria-modal="true"
        aria-label="Trainee Summary Modal"
      >
        {renderContent()}
      </div>
    </div>
  );
};
