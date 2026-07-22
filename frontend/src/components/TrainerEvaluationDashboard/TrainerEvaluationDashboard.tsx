import React, { useState, useEffect } from 'react';
import { curriculumService } from '../../services/curriculumService';

interface TrainerEvaluationDashboardProps {
  accessToken: string;
}

export function TrainerEvaluationDashboard({ accessToken }: TrainerEvaluationDashboardProps) {
  const [submissions, setSubmissions] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedSubmission, setSelectedSubmission] = useState<any | null>(null);
  const [score, setScore] = useState<number>(100);
  const [feedback, setFeedback] = useState<string>('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const loadPendingSubmissions = async () => {
    setIsLoading(true);
    try {
      const data = await curriculumService.fetchPendingSubmissions(accessToken);
      setSubmissions(data);
    } catch (err: any) {
      console.warn('Failed to fetch pending submissions:', err.message);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadPendingSubmissions();
  }, []);

  const handleOpenReview = (sub: any) => {
    setSelectedSubmission(sub);
    setScore(sub.assignment?.maxScore ?? 100);
    setFeedback('');
  };

  const handleEvaluate = async (status: 'Accepted' | 'Rejected') => {
    if (!selectedSubmission || isSubmitting) return;

    setIsSubmitting(true);
    try {
      await curriculumService.evaluateSubmission(
        selectedSubmission.id,
        { score, feedback, status },
        accessToken
      );
      alert(`Submission ${status === 'Accepted' ? 'Accepted' : 'Rejected'}! Trainee progress updated.`);
      setSelectedSubmission(null);
      await loadPendingSubmissions();
    } catch (err: any) {
      alert(err.message || 'Evaluation failed.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div style={{ maxWidth: '1000px', margin: '0 auto', padding: '24px' }}>
      <header style={{ marginBottom: '24px' }}>
        <h2>Pending Trainee Evaluations</h2>
        <p style={{ color: '#64748b' }}>Review submitted work, assign scores, and accept or reject solutions.</p>
      </header>

      {isLoading ? (
        <div>Loading submissions...</div>
      ) : submissions.length === 0 ? (
        <div style={{ padding: '32px', textAlign: 'center', background: '#f8fafc', border: '1px dashed #cbd5e1', borderRadius: '8px' }}>
          🎉 All caught up! No pending submissions to evaluate.
        </div>
      ) : (
        submissions.map((sub) => (
          <div key={sub.id} style={{ border: '1px solid #e2e8f0', borderRadius: '8px', padding: '16px', marginBottom: '12px', background: '#fff', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div>
              <strong style={{ fontSize: '15px' }}>👤 {sub.trainee?.firstName || 'Trainee'} {sub.trainee?.lastName || ''}</strong>
              <div style={{ fontSize: '13px', color: '#475569', marginTop: '4px' }}>
                Task: <strong>{sub.assignment?.title}</strong>
              </div>
              <span style={{ fontSize: '11px', color: '#94a3b8' }}>Submitted: {new Date(sub.submittedAt || sub.createdAt).toLocaleDateString()}</span>
            </div>

            <button
              type="button"
              onClick={() => handleOpenReview(sub)}
              style={{ padding: '8px 16px', background: '#2563eb', color: '#fff', border: 'none', borderRadius: '6px', cursor: 'pointer', fontWeight: 600 }}
            >
              Review & Grade
            </button>
          </div>
        ))
      )}

      {/* EVALUATION MODAL */}
      {selectedSubmission && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}>
          <div style={{ background: '#fff', width: '550px', padding: '24px', borderRadius: '8px' }}>
            <h3>Evaluate: {selectedSubmission.assignment?.title}</h3>
            <p style={{ fontSize: '12px', color: '#64748b' }}>Trainee: {selectedSubmission.trainee?.firstName} ({selectedSubmission.trainee?.email})</p>

            <div style={{ marginTop: '12px', background: '#f8fafc', padding: '12px', borderRadius: '6px', border: '1px solid #e2e8f0' }}>
              <strong style={{ fontSize: '12px', color: '#334155' }}>Trainee Solution / Submission:</strong>
              <div style={{ marginTop: '6px', fontSize: '13px', color: '#1e293b', whiteSpace: 'pre-wrap' }}>
                {selectedSubmission.submissionText}
              </div>
            </div>

            {selectedSubmission.attachmentUrl && (
              <div style={{ marginTop: '8px', fontSize: '12px' }}>
                🔗 Attachment: <a href={selectedSubmission.attachmentUrl} target="_blank" rel="noreferrer">{selectedSubmission.attachmentUrl}</a>
              </div>
            )}

            <div style={{ display: 'flex', gap: '12px', marginTop: '16px' }}>
              <div style={{ flex: 1 }}>
                <label style={{ display: 'block', fontSize: '13px', fontWeight: 600 }}>Score (Max: {selectedSubmission.assignment?.maxScore ?? 100})</label>
                <input
                  type="number"
                  min={0}
                  max={selectedSubmission.assignment?.maxScore ?? 100}
                  value={score}
                  onChange={(e) => setScore(Number(e.target.value))}
                  style={{ width: '100%', padding: '8px', marginTop: '4px' }}
                />
              </div>
            </div>

            <div style={{ marginTop: '12px' }}>
              <label style={{ display: 'block', fontSize: '13px', fontWeight: 600 }}>Trainer Feedback</label>
              <textarea
                rows={3}
                placeholder="Write feedback for the trainee..."
                value={feedback}
                onChange={(e) => setFeedback(e.target.value)}
                style={{ width: '100%', padding: '8px', marginTop: '4px' }}
              />
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px', marginTop: '16px' }}>
              <button type="button" onClick={() => setSelectedSubmission(null)} style={{ padding: '8px 16px', background: '#cbd5e1', border: 'none', borderRadius: '4px' }}>
                Cancel
              </button>
              <button
                type="button"
                disabled={isSubmitting}
                onClick={() => handleEvaluate('Rejected')}
                style={{ padding: '8px 16px', background: '#dc2626', color: '#fff', border: 'none', borderRadius: '4px', cursor: 'pointer' }}
              >
                Reject ❌
              </button>
              <button
                type="button"
                disabled={isSubmitting}
                onClick={() => handleEvaluate('Accepted')}
                style={{ padding: '8px 16px', background: '#16a34a', color: '#fff', border: 'none', borderRadius: '4px', cursor: 'pointer' }}
              >
                Accept & Complete ✅
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}