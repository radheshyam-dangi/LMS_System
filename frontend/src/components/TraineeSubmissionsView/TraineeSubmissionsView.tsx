import React, { useState, useEffect } from 'react';
import { curriculumService } from '../../services/curriculumService';

interface TraineeSubmissionsViewProps {
  accessToken: string;
}

export function TraineeSubmissionsView({ accessToken }: TraineeSubmissionsViewProps) {
  const [submissions, setSubmissions] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // Resubmission modal state
  const [resubmitTask, setResubmitTask] = useState<any | null>(null);
  const [submissionText, setSubmissionText] = useState('');
  const [attachmentUrl, setAttachmentUrl] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const fetchMySubmissions = async () => {
    setIsLoading(true);
    try {
      // Fetches all submissions belonging to the logged-in trainee
      const data = await curriculumService.fetchMySubmissions(accessToken);
      setSubmissions(data);
    } catch (err: any) {
      console.error('Failed to fetch trainee submissions:', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchMySubmissions();
  }, []);

  // 🌟 Dynamic Color & Grade Helper Logic
  const getScoreBadgeDetails = (score: number | null, maxScore: number = 100) => {
    if (score === null || score === undefined) {
      return {
        percentage: null,
        color: '#d97706',
        bgColor: '#fef3c7',
        borderColor: '#fde68a',
        label: 'Awaiting Review 🕒',
      };
    }

    const percentage = Math.round((score / maxScore) * 100);

    // 🟢 Above 75%: Green
    if (percentage >= 75) {
      return {
        percentage,
        color: '#15803d',
        bgColor: '#dcfce7',
        borderColor: '#86efac',
        label: `${score} / ${maxScore} (${percentage}%) - Excellent`,
      };
    }

    // 🟠 45% to 74%: Orange
    if (percentage >= 45) {
      return {
        percentage,
        color: '#c2410c',
        bgColor: '#ffedd5',
        borderColor: '#fed7aa',
        label: `${score} / ${maxScore} (${percentage}%) - Good`,
      };
    }

    // 🔴 Below 45%: Red
    return {
      percentage,
      color: '#b91c1c',
      bgColor: '#fee2e2',
      borderColor: '#fca5a5',
      label: `${score} / ${maxScore} (${percentage}%) - Needs Improvement`,
    };
  };

  const handleOpenResubmit = (sub: any) => {
    setResubmitTask(sub);
    setSubmissionText(sub.submissionText || '');
    setAttachmentUrl(sub.attachmentUrl || '');
  };

  const handleResubmitSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!resubmitTask || isSubmitting) return;

    setIsSubmitting(true);
    try {
      await curriculumService.submitAssignment(
        {
          assignmentId: resubmitTask.assignment.id,
          submissionText,
          attachmentUrl: attachmentUrl || undefined,
        },
        accessToken
      );
      alert('Task resubmitted successfully! Your trainer will review your new response.');
      setResubmitTask(null);
      await fetchMySubmissions();
    } catch (err: any) {
      alert(err.message || 'Resubmission failed.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div style={{ padding: '24px', maxWidth: '1000px', margin: '0 auto' }}>
      <header style={{ marginBottom: '24px' }}>
        <h2>My Submitted Tasks & Grades</h2>
        <p style={{ color: '#64748b' }}>
          Track evaluation feedback, review gained points, and resubmit solutions below 50% to improve your grade.
        </p>
      </header>

      {isLoading ? (
        <div>Loading your submission history...</div>
      ) : submissions.length === 0 ? (
        <div style={{ padding: '32px', textAlign: 'center', background: '#f8fafc', border: '2px dashed #cbd5e1', borderRadius: '8px' }}>
          No submitted tasks found. Complete lesson assignments to see evaluation scores here!
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          {submissions.map((sub) => {
            const maxScore = sub.assignment?.maxScore ?? sub.assignment?.max_score ?? 100;
            const badge = getScoreBadgeDetails(sub.score, maxScore);
            const isEligibleToResubmit = badge.percentage !== null && badge.percentage < 50;

            return (
              <div
                key={sub.id}
                style={{
                  border: '1px solid #e2e8f0',
                  borderRadius: '8px',
                  padding: '20px',
                  background: '#fff',
                  boxShadow: '0 1px 3px rgba(0,0,0,0.05)',
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                  <div>
                    <h3 style={{ margin: 0, fontSize: '16px', color: '#0f172a' }}>
                      📝 {sub.assignment?.title || 'Assignment Solution'}
                    </h3>
                    <span style={{ fontSize: '12px', color: '#64748b' }}>
                      Submitted on: {new Date(sub.submittedAt || sub.createdAt).toLocaleDateString()}
                    </span>
                  </div>

                  {/* 🌟 DYNAMIC SCORE BADGE (Green >=75% | Orange >=45% | Red <45%) */}
                  <div
                    style={{
                      padding: '6px 14px',
                      borderRadius: '20px',
                      background: badge.bgColor,
                      color: badge.color,
                      border: `1px solid ${badge.borderColor}`,
                      fontWeight: 700,
                      fontSize: '13px',
                    }}
                  >
                    {badge.label}
                  </div>
                </div>

                {/* Trainee Answer Preview */}
                <div style={{ marginTop: '14px', background: '#f8fafc', padding: '12px', borderRadius: '6px', border: '1px solid #f1f5f9' }}>
                  <strong style={{ fontSize: '12px', color: '#475569' }}>My Submitted Solution:</strong>
                  <div style={{ fontSize: '13px', color: '#1e293b', marginTop: '4px', whiteSpace: 'pre-wrap' }}>
                    {sub.submissionText}
                  </div>
                </div>

                {/* 🌟 TRAINER FEEDBACK BOX */}
                {sub.feedback ? (
                  <div style={{ marginTop: '12px', background: '#f0f9ff', padding: '12px', borderRadius: '6px', border: '1px solid #bae6fd' }}>
                    <strong style={{ fontSize: '12px', color: '#0369a1' }}>💬 Trainer Review & Feedback:</strong>
                    <p style={{ fontSize: '13px', color: '#0284c7', margin: '4px 0 0 0' }}>{sub.feedback}</p>
                  </div>
                ) : (
                  <div style={{ marginTop: '10px', fontSize: '12px', color: '#94a3b8',fontStyle:'italic' }}>
                    Trainer review pending...
                  </div>
                )}

                {/* 🌟 RESUBMIT BUTTON (VISIBLE IF SCORE IS BELOW 50%) */}
                {isEligibleToResubmit && (
                  <div style={{ marginTop: '16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: '#fef2f2', padding: '12px', borderRadius: '6px', border: '1px solid #fecaca' }}>
                    <span style={{ fontSize: '12px', color: '#991b1b', fontWeight: 500 }}>
                      ⚠️ Score is below 50%. You can resubmit this task to improve your progress!
                    </span>
                    <button
                      type="button"
                      onClick={() => handleOpenResubmit(sub)}
                      style={{
                        padding: '6px 14px',
                        background: '#dc2626',
                        color: '#fff',
                        border: 'none',
                        borderRadius: '4px',
                        cursor: 'pointer',
                        fontSize: '12px',
                        fontWeight: 600,
                      }}
                    >
                      🔄 Resubmit Task
                    </button>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* 🌟 RESUBMISSION MODAL */}
      {resubmitTask && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}>
          <div style={{ background: '#fff', width: '520px', padding: '24px', borderRadius: '8px' }}>
            <h3>Resubmit: {resubmitTask.assignment?.title}</h3>
            <p style={{ fontSize: '13px', color: '#64748b' }}>Improve your code/answer based on the trainer's review feedback.</p>

            <form onSubmit={handleResubmitSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '12px', marginTop: '12px' }}>
              <div>
                <label style={{ display: 'block', fontSize: '13px', fontWeight: 600 }}>Updated Solution *</label>
                <textarea
                  rows={5}
                  required
                  value={submissionText}
                  onChange={(e) => setSubmissionText(e.target.value)}
                  style={{ width: '100%', padding: '8px', marginTop: '4px' }}
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '13px', fontWeight: 600 }}>Attachment Link (Optional)</label>
                <input
                  type="url"
                  placeholder="https://github.com/..."
                  value={attachmentUrl}
                  onChange={(e) => setAttachmentUrl(e.target.value)}
                  style={{ width: '100%', padding: '8px', marginTop: '4px' }}
                />
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px', marginTop: '16px' }}>
                <button type="button" onClick={() => setResubmitTask(null)} style={{ padding: '8px 16px', background: '#cbd5e1', border: 'none', borderRadius: '4px' }}>
                  Cancel
                </button>
                <button type="submit" disabled={isSubmitting} style={{ padding: '8px 16px', background: '#dc2626', color: '#fff', border: 'none', borderRadius: '4px' }}>
                  {isSubmitting ? 'Resubmitting...' : 'Send Revised Solution'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}