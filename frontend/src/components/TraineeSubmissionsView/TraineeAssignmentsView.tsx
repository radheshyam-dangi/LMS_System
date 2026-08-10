import React, { useEffect, useState } from 'react';
import { assignmentService } from '../../services/assignmentService';
import { useNotifications } from '../../context/NotificationContext';

type Props = {
  accessToken: string;
};

/**
 * Trainee Assignments: shows path-linked + external assignments assigned to the trainee.
 * Submitting increases the trainer's notification bell without a page reload.
 */
export function TraineeAssignmentsView({ accessToken }: Props) {
  const { refresh: refreshNotifications } = useNotifications();
  const [assignments, setAssignments] = useState<any[]>([]);
  const [submissions, setSubmissions] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'all' | 'external' | 'path'>('all');
  const [submitTarget, setSubmitTarget] = useState<any | null>(null);
  const [submissionText, setSubmissionText] = useState('');
  const [selectedMcqAnswers, setSelectedMcqAnswers] = useState<Record<number, number>>({});
  const [subjectiveAnswers, setSubjectiveAnswers] = useState<Record<number, string>>({});
  const [attachmentUrl, setAttachmentUrl] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const load = async () => {
    setLoading(true);
    try {
      const [mine, mySubs] = await Promise.all([
        assignmentService.fetchMyAssignments(accessToken).catch(() => []),
        assignmentService.fetchMySubmissions(accessToken).catch(() => []),
      ]);
      setAssignments(Array.isArray(mine) ? mine : []);
      setSubmissions(Array.isArray(mySubs) ? mySubs : []);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load();
  }, [accessToken]);

  const submissionByAssignment = new Map(
    submissions.map((s) => [s.assignment?.id || s.assignmentId, s]),
  );

  const filtered = assignments.filter((a) => {
    const isExternal =
      String(a.assignmentType || '').toLowerCase() === 'external' ||
      (!a.lesson && !a.module && !a.learningPath);
    if (activeTab === 'external') return isExternal;
    if (activeTab === 'path') return !isExternal;
    return true;
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!submitTarget || !submissionText.trim()) {
      alert('Please enter your submission.');
      return;
    }
    setIsSubmitting(true);
    try {
      await assignmentService.submitAssignment(
        submitTarget.id,
        { submissionText, attachmentUrl: attachmentUrl || undefined },
        accessToken,
      );
      setSubmitTarget(null);
      setSubmissionText('');
      setAttachmentUrl('');
      await load();
      await refreshNotifications();
      alert('Submitted for evaluation. Your trainer has been notified.');
    } catch (err: any) {
      alert(err?.response?.data?.message || err.message || 'Submission failed.');
    } finally {
      setIsSubmitting(false);
    }
  };

  if (loading) {
    return <div style={{ padding: 24, color: '#64748b' }}>Loading your assignments...</div>;
  }

  return (
    <div style={{ padding: '24px 32px', maxWidth: 1100, margin: '0 auto' }}>
      <div style={{ marginBottom: 20 }}>
        <h1 style={{ margin: 0, fontSize: 22, fontWeight: 800, color: '#0f172a' }}>Assignments</h1>
        <p style={{ margin: '6px 0 0', color: '#64748b', fontSize: 13 }}>
          {filtered.length} tasks — Learning Path tasks and External assignments are listed separately.
        </p>
      </div>

      <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
        {(
          [
            ['all', 'All'],
            ['path', 'Learning Path'],
            ['external', 'External'],
          ] as const
        ).map(([key, label]) => (
          <button
            key={key}
            type="button"
            onClick={() => setActiveTab(key)}
            style={{
              padding: '8px 14px',
              borderRadius: 999,
              border: activeTab === key ? 'none' : '1px solid #e2e8f0',
              background: activeTab === key ? '#4f46e5' : '#fff',
              color: activeTab === key ? '#fff' : '#475569',
              fontWeight: 600,
              fontSize: 12,
              cursor: 'pointer',
            }}
          >
            {label}
          </button>
        ))}
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        {filtered.map((a) => {
          const isExternal =
            String(a.assignmentType || '').toLowerCase() === 'external' ||
            (!a.lesson && !a.module && !a.learningPath);
          const sub = submissionByAssignment.get(a.id);
          const status = sub?.status || 'Pending';
          return (
            <div
              key={a.id}
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                gap: 12,
                padding: '14px 16px',
                border: '1px solid #e2e8f0',
                borderRadius: 12,
                background: '#fff',
              }}
            >
              <div style={{ minWidth: 0 }}>
                <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 4 }}>
                  <span
                    style={{
                      fontSize: 10,
                      fontWeight: 700,
                      padding: '2px 8px',
                      borderRadius: 999,
                      background: isExternal ? '#ede9fe' : '#e0f2fe',
                      color: isExternal ? '#6d28d9' : '#0369a1',
                    }}
                  >
                    {isExternal ? 'External' : 'Learning Path'}
                  </span>
                  <span style={{ fontSize: 11, color: '#94a3b8' }}>{a.assignmentType || 'Task'}</span>
                </div>
                <strong style={{ display: 'block', fontSize: 14, color: '#0f172a' }}>{a.title}</strong>
                <div style={{ fontSize: 12, color: '#64748b', marginTop: 2 }}>
                  {a.dueDate ? `Due ${new Date(a.dueDate).toLocaleDateString()}` : 'No due date'}
                  {a.externalUrl ? (
                    <>
                      {' · '}
                      <a href={a.externalUrl} target="_blank" rel="noreferrer" style={{ color: '#4f46e5' }}>
                        Open resource
                      </a>
                    </>
                  ) : null}
                </div>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexShrink: 0 }}>
                <span
                  style={{
                    fontSize: 11,
                    fontWeight: 700,
                    padding: '4px 10px',
                    borderRadius: 999,
                    background:
                      status === 'Accepted'
                        ? '#dcfce7'
                        : status === 'Rejected'
                          ? '#fee2e2'
                          : status === 'Submitted'
                            ? '#fef3c7'
                            : '#f1f5f9',
                    color:
                      status === 'Accepted'
                        ? '#166534'
                        : status === 'Rejected'
                          ? '#b91c1c'
                          : status === 'Submitted'
                            ? '#b45309'
                            : '#475569',
                  }}
                >
                  {status}
                  {typeof sub?.score === 'number' ? ` · ${sub.score}` : ''}
                </span>
                {status !== 'Accepted' && (
                  <button
                    type="button"
                    onClick={() => {
                      setSubmitTarget(a);
                      setSubmissionText('');
                      setAttachmentUrl(a.externalUrl || '');
                    }}
                    style={{
                      padding: '8px 14px',
                      borderRadius: 8,
                      border: 'none',
                      background: '#4f46e5',
                      color: '#fff',
                      fontWeight: 700,
                      fontSize: 12,
                      cursor: 'pointer',
                    }}
                  >
                    {sub ? 'Resubmit' : 'Submit'}
                  </button>
                )}
              </div>
            </div>
          );
        })}

        {filtered.length === 0 && (
          <div style={{ padding: 24, color: '#94a3b8', textAlign: 'center', border: '1px dashed #e2e8f0', borderRadius: 12 }}>
            No assignments in this category yet.
          </div>
        )}
      </div>

      {submitTarget && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(15,23,42,0.6)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 1000,
            backdropFilter: 'blur(4px)',
          }}
        >
          <div
            style={{
              background: '#fff',
              width: '600px',
              borderRadius: '20px',
              maxHeight: '92vh',
              overflowY: 'auto',
              boxShadow: '0 25px 80px rgba(0,0,0,0.22)',
            }}
          >
            {/* Modal header */}
            <div
              style={{
                padding: '22px 26px',
                borderBottom: '1px solid #f1f5f9',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                position: 'sticky',
                top: 0,
                background: '#fff',
                zIndex: 10,
                borderRadius: '20px 20px 0 0',
              }}
            >
              <div>
                <h3 style={{ margin: 0, fontSize: '17px', fontWeight: 800, color: '#0f172a' }}>
                  📝 {submitTarget.title}
                </h3>
                <p style={{ margin: '4px 0 0 0', fontSize: '12px', color: '#64748b' }}>
                  Max Score: {submitTarget.maxScore ?? 100} pts · Type:{' '}
                  {submitTarget.assignmentType || 'Subjective'}
                </p>
              </div>
              <button
                onClick={() => setSubmitTarget(null)}
                style={{
                  background: '#f1f5f9',
                  border: 'none',
                  borderRadius: '8px',
                  width: '32px',
                  height: '32px',
                  cursor: 'pointer',
                  fontSize: '18px',
                  color: '#64748b',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                ×
              </button>
            </div>

            <form
              onSubmit={async (e) => {
                e.preventDefault();
                let finalText = submissionText;
                if (submitTarget.assignmentType === 'MCQ' || submitTarget.mcqConfig?.questions?.length > 0) {
                  finalText = JSON.stringify({ answers: selectedMcqAnswers, textAnswers: subjectiveAnswers, raw: submissionText });
                }
                if (!finalText.trim()) finalText = 'Task completed & submitted';

                setIsSubmitting(true);
                try {
                  await assignmentService.submitAssignment(
                    submitTarget.id,
                    { submissionText: finalText, attachmentUrl: attachmentUrl || undefined },
                    accessToken,
                  );
                  setSubmitTarget(null);
                  setSubmissionText('');
                  setAttachmentUrl('');
                  setSelectedMcqAnswers({});
                  setSubjectiveAnswers({});
                  await load();
                  await refreshNotifications();
                  alert('Submitted for evaluation. Your trainer has been notified.');
                } catch (err: any) {
                  alert(err?.response?.data?.message || err.message || 'Submission failed.');
                } finally {
                  setIsSubmitting(false);
                }
              }}
              style={{ padding: '22px 26px', display: 'flex', flexDirection: 'column', gap: '16px' }}
            >
              {/* Instructions Banner */}
              {submitTarget.instructions && (
                <div
                  style={{
                    background: '#f0f9ff',
                    border: '1px solid #bae6fd',
                    borderRadius: '10px',
                    padding: '12px 16px',
                  }}
                >
                  <div
                    style={{
                      fontSize: '11px',
                      fontWeight: 700,
                      color: '#0369a1',
                      textTransform: 'uppercase',
                      letterSpacing: '0.04em',
                      marginBottom: '4px',
                    }}
                  >
                    Instructions
                  </div>
                  <p style={{ fontSize: '13px', color: '#0c4a6e', margin: 0 }}>
                    {submitTarget.instructions}
                  </p>
                </div>
              )}

              {/* Resource URL */}
              {submitTarget.externalUrl && (
                <a
                  href={submitTarget.externalUrl}
                  target="_blank"
                  rel="noreferrer"
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px',
                    padding: '10px 14px',
                    background: '#eff6ff',
                    border: '1px solid #bfdbfe',
                    borderRadius: '10px',
                    textDecoration: 'none',
                    fontSize: '13px',
                    color: '#2563eb',
                    fontWeight: 600,
                  }}
                >
                  🔗 Reference Resource: {submitTarget.externalUrl}
                </a>
              )}

              {/* MCQ Questions */}
              {submitTarget.assignmentType === 'MCQ' ? (
                <div>
                  {(submitTarget.mcqConfig?.questions || [
                    { questionText: submitTarget.title || 'What is your answer to this question?', points: 10, options: ['LLM', 'Model', 'AI', 'hardware'] }
                  ]).map((q: any, qIdx: number) => (
                    <div
                      key={qIdx}
                      style={{
                        background: '#f8fafc',
                        padding: '14px',
                        borderRadius: '10px',
                        marginBottom: '12px',
                        border: '1px solid #e2e8f0',
                      }}
                    >
                      <p style={{ fontSize: '13px', fontWeight: 700, margin: '0 0 10px 0', color: '#0f172a' }}>
                        Q{qIdx + 1}: {q.questionText || q.question} <span style={{ color: '#4f46e5', fontWeight: 600 }}>({q.points || 10} pts)</span>
                      </p>
                      {(q.options || ['Option 1', 'Option 2', 'Option 3', 'Option 4']).map((opt: string, optIdx: number) => (
                        <label
                          key={optIdx}
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: '10px',
                            fontSize: '13px',
                            marginTop: '8px',
                            cursor: 'pointer',
                            padding: '8px 12px',
                            borderRadius: '8px',
                            background: selectedMcqAnswers[qIdx] === optIdx ? '#ede9fe' : '#fff',
                            border: '1px solid',
                            borderColor: selectedMcqAnswers[qIdx] === optIdx ? '#6366f1' : '#e2e8f0',
                            transition: 'all 0.15s',
                          }}
                        >
                          <input
                            type="radio"
                            name={`q_${qIdx}`}
                            checked={selectedMcqAnswers[qIdx] === optIdx}
                            onChange={() => setSelectedMcqAnswers((prev) => ({ ...prev, [qIdx]: optIdx }))}
                            style={{ accentColor: '#4f46e5' }}
                          />
                          {opt}
                        </label>
                      ))}
                    </div>
                  ))}
                </div>
              ) : submitTarget.mcqConfig?.questions?.length > 0 ? (
                /* Subjective multi-question */
                <div>
                  {submitTarget.mcqConfig.questions.map((q: any, qIdx: number) => (
                    <div
                      key={qIdx}
                      style={{
                        background: '#f8fafc',
                        padding: '14px',
                        borderRadius: '10px',
                        marginBottom: '12px',
                        border: '1px solid #e2e8f0',
                      }}
                    >
                      <label style={{ display: 'block', fontSize: '13px', fontWeight: 700, color: '#0f172a', marginBottom: '8px' }}>
                        Q{qIdx + 1}: {q.questionText || q.question} <span style={{ color: '#4f46e5' }}>({q.maxPoints || q.points || 10} pts)</span>
                      </label>
                      <textarea
                        rows={3}
                        required
                        placeholder="Write your answer here..."
                        value={subjectiveAnswers[qIdx] || ''}
                        onChange={(e) => setSubjectiveAnswers((prev) => ({ ...prev, [qIdx]: e.target.value }))}
                        style={{
                          width: '100%',
                          padding: '10px 12px',
                          borderRadius: '8px',
                          border: '1.5px solid #e2e8f0',
                          fontSize: '13px',
                          resize: 'vertical',
                          outline: 'none',
                        }}
                      />
                    </div>
                  ))}
                </div>
              ) : (
                /* Single textarea fallback */
                <div>
                  <label style={{ display: 'block', fontSize: '13px', fontWeight: 700, marginBottom: '8px', color: '#374151' }}>
                    Your Solution / Answer *
                  </label>
                  <textarea
                    rows={5}
                    required
                    placeholder="Type your response here..."
                    value={submissionText}
                    onChange={(e) => setSubmissionText(e.target.value)}
                    style={{
                      width: '100%',
                      padding: '12px',
                      borderRadius: '10px',
                      border: '1.5px solid #e2e8f0',
                      fontSize: '13px',
                      resize: 'vertical',
                      outline: 'none',
                    }}
                  />
                </div>
              )}

              {/* Attachment URL */}
              <div>
                <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, color: '#374151', marginBottom: '6px' }}>
                  Attachment URL <span style={{ fontSize: '11px', color: '#94a3b8', fontWeight: 400 }}>(Optional — GitHub / Google Drive / Workspace)</span>
                </label>
                <input
                  type="url"
                  placeholder="https://github.com/..."
                  value={attachmentUrl}
                  onChange={(e) => setAttachmentUrl(e.target.value)}
                  style={{
                    width: '100%',
                    padding: '10px 12px',
                    borderRadius: '10px',
                    border: '1.5px solid #e2e8f0',
                    fontSize: '13px',
                    outline: 'none',
                  }}
                />
              </div>

              {/* Submit actions */}
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px', paddingTop: '8px', borderTop: '1px solid #f1f5f9' }}>
                <button
                  type="button"
                  onClick={() => setSubmitTarget(null)}
                  style={{
                    padding: '10px 20px',
                    background: '#f1f5f9',
                    border: 'none',
                    borderRadius: '10px',
                    cursor: 'pointer',
                    fontWeight: 600,
                    fontSize: '13px',
                    color: '#475569',
                  }}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  style={{
                    padding: '10px 24px',
                    background: isSubmitting ? '#a5b4fc' : 'linear-gradient(135deg,#6366f1,#4f46e5)',
                    color: '#fff',
                    border: 'none',
                    borderRadius: '10px',
                    cursor: isSubmitting ? 'not-allowed' : 'pointer',
                    fontWeight: 700,
                    fontSize: '13px',
                    boxShadow: '0 2px 8px rgba(99,102,241,0.35)',
                  }}
                >
                  {isSubmitting ? 'Submitting...' : 'Submit Task'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
