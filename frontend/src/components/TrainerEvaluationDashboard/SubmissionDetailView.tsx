import React, { useState } from 'react';
import { assignmentService } from '../../services/assignmentService';

interface SubmissionDetailViewProps {
  submission: any;
  accessToken: string;
  onClose: () => void;
  onEvaluated: () => void;
  isAdminView: boolean;
}

export function SubmissionDetailView({
  submission,
  accessToken,
  onClose,
  onEvaluated,
  isAdminView,
}: SubmissionDetailViewProps) {
  const [evalScore, setEvalScore] = useState<number | ''>(
    submission.aiTotalScore != null ? submission.aiTotalScore : ''
  );
  const [evalFeedback, setEvalFeedback] = useState<string>('');
  const [isEvaluating, setIsEvaluating] = useState(false);

  const handleEvaluate = async (actionStatus: 'Approved' | 'Rejected') => {
    if (actionStatus === 'Rejected' && !evalFeedback.trim()) {
      alert('A reason is required to reject a submission.');
      return;
    }
    
    if (actionStatus === 'Approved' && (evalScore === '' || evalScore == null)) {
      alert('Score is required when evaluating a submission.');
      return;
    }

    setIsEvaluating(true);
    try {
      await assignmentService.evaluateSubmission(
        submission.id,
        { 
          score: evalScore === '' ? null : Number(evalScore), 
          feedback: evalFeedback, 
          status: actionStatus 
        },
        accessToken
      );
      onEvaluated();
    } catch (err: any) {
      console.error('Failed to evaluate:', err);
      alert(err.response?.data?.message || err.message || 'Failed to evaluate submission.');
    } finally {
      setIsEvaluating(false);
    }
  };

  const renderParsedSubmission = (sub: any) => {
    try {
      let parsed = sub.answers || sub.submissionText;
      if (typeof parsed === 'string') {
        try {
          parsed = JSON.parse(parsed);
        } catch {
          return <div style={{ whiteSpace: 'pre-wrap', color: '#334155' }}>{sub.submissionText}</div>;
        }
      }

      const questions = sub.assignment?.questions || [];

      if (Array.isArray(parsed)) {
        return parsed.map((item: any, i: number) => {
          const qId = item.questionId;
          const matchedQuestion = questions.find((q: any) => q.id === qId);
          const aiScore = sub.aiQuestionScores?.find((s: any) => s.questionId === qId);

          return (
            <div key={i} style={{ marginBottom: '16px', background: '#fff', padding: '12px', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
              <strong style={{ fontSize: '13px', display: 'block', color: '#0f172a' }}>
                Q: {matchedQuestion ? matchedQuestion.questionText || matchedQuestion.text : qId}
                {matchedQuestion?.points && <span style={{ color: '#4f46e5', marginLeft: '6px' }}>({matchedQuestion.points} pts)</span>}
              </strong>
              <div style={{ fontSize: '13px', color: '#334155', marginTop: '6px' }}>
                <strong>A:</strong> {typeof item.answer === 'string' ? item.answer : JSON.stringify(item.answer)}
              </div>
              
              {aiScore && (
                <div style={{ marginTop: '10px', padding: '10px', background: '#f8fafc', borderRadius: '6px', borderLeft: '4px solid #6366f1' }}>
                  <div style={{ fontSize: '12px', fontWeight: 600, color: '#4f46e5', marginBottom: '4px' }}>
                    🤖 AI Score: {aiScore.score} / {aiScore.maxScore}
                  </div>
                  <div style={{ fontSize: '12px', color: '#475569' }}>
                    <strong>Remark:</strong> {aiScore.remark}
                  </div>
                  {aiScore.matchedKeyPoints?.length > 0 && (
                    <div style={{ fontSize: '11px', color: '#16a34a', marginTop: '4px' }}>
                      <strong>Hits:</strong> {aiScore.matchedKeyPoints.join(', ')}
                    </div>
                  )}
                  {aiScore.missedKeyPoints?.length > 0 && (
                    <div style={{ fontSize: '11px', color: '#dc2626', marginTop: '4px' }}>
                      <strong>Misses:</strong> {aiScore.missedKeyPoints.join(', ')}
                    </div>
                  )}
                </div>
              )}
            </div>
          );
        });
      }

      if (typeof parsed === 'object' && parsed !== null && parsed.answers) {
        return Object.entries(parsed.answers).map(([key, value]) => {
          const matchedQuestion = questions.find((q: any) => String(q.id) === key) || questions[parseInt(key)];
          const aiScore = sub.aiQuestionScores?.find((s: any) => s.questionId === key || s.questionId === matchedQuestion?.id);

          return (
            <div key={key} style={{ marginBottom: '16px', background: '#fff', padding: '12px', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
              <strong style={{ fontSize: '13px', display: 'block', color: '#0f172a' }}>
                Q: {matchedQuestion ? matchedQuestion.questionText || matchedQuestion.text : `Question ${key}`}
                {matchedQuestion?.points && <span style={{ color: '#4f46e5', marginLeft: '6px' }}>({matchedQuestion.points} pts)</span>}
              </strong>
              <div style={{ fontSize: '13px', color: '#334155', marginTop: '6px' }}>
                <strong>A:</strong> {typeof value === 'string' ? value : JSON.stringify(value)}
              </div>
              
              {aiScore && (
                <div style={{ marginTop: '10px', padding: '10px', background: '#f8fafc', borderRadius: '6px', borderLeft: '4px solid #6366f1' }}>
                  <div style={{ fontSize: '12px', fontWeight: 600, color: '#4f46e5', marginBottom: '4px' }}>
                    🤖 AI Score: {aiScore.score} / {aiScore.maxScore}
                  </div>
                  <div style={{ fontSize: '12px', color: '#475569' }}>
                    <strong>Remark:</strong> {aiScore.remark}
                  </div>
                  {aiScore.matchedKeyPoints?.length > 0 && (
                    <div style={{ fontSize: '11px', color: '#16a34a', marginTop: '4px' }}>
                      <strong>Hits:</strong> {aiScore.matchedKeyPoints.join(', ')}
                    </div>
                  )}
                  {aiScore.missedKeyPoints?.length > 0 && (
                    <div style={{ fontSize: '11px', color: '#dc2626', marginTop: '4px' }}>
                      <strong>Misses:</strong> {aiScore.missedKeyPoints.join(', ')}
                    </div>
                  )}
                </div>
              )}
            </div>
          );
        });
      }

      return <div style={{ whiteSpace: 'pre-wrap', color: '#334155' }}>{sub.submissionText}</div>;
    } catch {
      return <div style={{ whiteSpace: 'pre-wrap', color: '#334155' }}>{sub.submissionText}</div>;
    }
  };

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(15,23,42,0.55)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, backdropFilter: 'blur(4px)' }}>
      <div style={{ background: '#fff', width: '800px', padding: '28px', borderRadius: '16px', maxHeight: '90vh', overflowY: 'auto', boxShadow: '0 20px 60px rgba(0,0,0,0.18)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '16px' }}>
          <div>
            <h3 style={{ margin: 0, fontSize: '18px', fontWeight: 800, color: '#0f172a' }}>Evaluate: {submission.assignment?.title}</h3>
            <p style={{ fontSize: '12px', color: '#64748b', margin: '4px 0 0 0' }}>Trainee: {submission.trainee?.firstName} {submission.trainee?.lastName} ({submission.trainee?.email})</p>
            {isAdminView && (
              <div style={{ fontSize: '12px', color: '#64748b', margin: '6px 0 0 0', padding: '6px', background: '#f1f5f9', borderRadius: '6px' }}>
                <p style={{ margin: '2px 0' }}>Author: {submission.assignment?.createdBy ? `${submission.assignment.createdBy.firstName} ${submission.assignment.createdBy.lastName}` : 'N/A'}</p>
                <p style={{ margin: '2px 0' }}>Status: <span style={{ fontWeight: 600 }}>{submission.status || 'Submitted'}</span></p>
              </div>
            )}
          </div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', fontSize: '20px', cursor: 'pointer', color: '#64748b' }}>×</button>
        </div>

        {submission.aiTotalScore != null && (
          <div style={{ marginBottom: '16px', background: '#eef2ff', padding: '14px', borderRadius: '8px', border: '1px solid #c7d2fe' }}>
            <strong style={{ fontSize: '13px', color: '#3730a3', display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '10px' }}>
              <span>🤖</span> AI Suggested Evaluation
            </strong>
            <div style={{ display: 'flex', gap: '16px', marginBottom: '10px' }}>
              <div style={{ flex: 1, background: '#fff', padding: '10px', borderRadius: '6px', border: '1px solid #e0e7ff' }}>
                <div style={{ fontSize: '11px', color: '#6366f1', fontWeight: 700, textTransform: 'uppercase', marginBottom: '4px' }}>Suggested Score</div>
                <div style={{ fontSize: '18px', fontWeight: 800, color: '#312e81' }}>{submission.aiTotalScore} / {submission.aiTotalMaxScore || submission.assignment?.maxScore || 100}</div>
              </div>
            </div>
            <div style={{ background: '#fff', padding: '10px', borderRadius: '6px', border: '1px solid #e0e7ff', fontSize: '13px', color: '#312e81', whiteSpace: 'pre-wrap' }}>
              <span style={{ fontWeight: 600 }}>Reasoning: </span>{submission.aiOverallRemark}
            </div>
          </div>
        )}

        <div style={{ marginBottom: '16px', background: '#f8fafc', padding: '14px', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
          <strong style={{ fontSize: '13px', color: '#0f172a', display: 'block', marginBottom: '10px' }}>Trainee Solution Breakdown:</strong>
          {renderParsedSubmission(submission)}
        </div>

        {submission.attachmentUrl && (
          <div style={{ marginBottom: '14px', fontSize: '13px' }}>
            📎 <strong>Attachment:</strong>{' '}
            <a href={submission.attachmentUrl} target="_blank" rel="noreferrer" style={{ color: '#2563eb', fontWeight: 600 }}>{submission.attachmentUrl}</a>
          </div>
        )}

        <div style={{ marginBottom: '14px' }}>
          <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, color: '#334155', marginBottom: '6px' }}>
            Overall Score (Max: {submission.assignment?.maxScore || 100}) <span style={{ color: '#64748b', fontWeight: 'normal' }}>(Optional if Rejecting)</span>
          </label>
          <input
            type="number" min={0} max={submission.assignment?.maxScore || 100}
            value={evalScore} onChange={e => setEvalScore(e.target.value === '' ? '' : Number(e.target.value))}
            style={{ width: '100%', padding: '8px 12px', borderRadius: '8px', border: '1px solid #cbd5e1', fontSize: '14px', fontWeight: 700, outline: 'none' }}
          />
        </div>

        <div style={{ marginBottom: '18px' }}>
          <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, color: '#334155', marginBottom: '6px' }}>
            Trainer Feedback <span style={{ color: '#dc2626' }}>* (Mandatory if Rejecting)</span>
          </label>
          <textarea
            rows={3} value={evalFeedback} onChange={e => setEvalFeedback(e.target.value)}
            placeholder="Write clear, constructive feedback for the trainee..."
            style={{ width: '100%', padding: '10px 12px', borderRadius: '8px', border: '1px solid #cbd5e1', fontSize: '13px', resize: 'vertical', outline: 'none' }}
          />
        </div>

        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
          <button type="button" onClick={onClose} style={{ padding: '9px 18px', background: '#f1f5f9', border: 'none', borderRadius: '8px', cursor: 'pointer', fontWeight: 600 }}>Cancel</button>
          <button type="button" disabled={isEvaluating} onClick={() => handleEvaluate('Rejected')} style={{ padding: '9px 18px', background: '#fee2e2', color: '#b91c1c', border: 'none', borderRadius: '8px', cursor: 'pointer', fontWeight: 700 }}>
            Reject
          </button>
          <button type="button" disabled={isEvaluating} onClick={() => handleEvaluate('Approved')} style={{ padding: '9px 18px', background: '#4f46e5', color: '#fff', border: 'none', borderRadius: '8px', cursor: 'pointer', fontWeight: 700 }}>
            Submit Evaluation {isEvaluating ? '...' : ''}
          </button>
        </div>
      </div>
    </div>
  );
}
