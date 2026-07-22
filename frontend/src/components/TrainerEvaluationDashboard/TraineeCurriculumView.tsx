import React, { useState, useEffect } from 'react';
import { curriculumService } from '../../services/curriculumService';

interface TraineeCurriculumViewProps {
  learningPathId: string;
  learningPathTitle: string;
  accessToken: string;
  onBack: () => void;
}

export function TraineeCurriculumView({
  learningPathId,
  learningPathTitle,
  accessToken,
  onBack,
}: TraineeCurriculumViewProps) {
  const [modules, setModules] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // Active assignment state for submission modal
  const [activeTask, setActiveTask] = useState<any | null>(null);
  const [submissionText, setSubmissionText] = useState('');
  const [attachmentUrl, setAttachmentUrl] = useState('');
  const [selectedMcqAnswers, setSelectedMcqAnswers] = useState<Record<number, number>>({});
  const [isSubmitting, setIsSubmitting] = useState(false);

  const loadTree = async () => {
    setIsLoading(true);
    try {
      const data = await curriculumService.fetchModulesByPath(learningPathId, accessToken);
      setModules(data);
    } catch (err: any) {
      alert(err.message || 'Failed to load curriculum view.');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadTree();
  }, [learningPathId]);

  const handleOpenSubmissionModal = (task: any) => {
    setActiveTask(task);
    setSubmissionText('');
    setAttachmentUrl('');
    setSelectedMcqAnswers({});
  };

  const handleMcqSelect = (qIdx: number, optionIdx: number) => {
    setSelectedMcqAnswers((prev) => ({ ...prev, [qIdx]: optionIdx }));
  };

  const handleSubmitTask = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeTask || isSubmitting) return;

    let payloadText = submissionText;
    if (activeTask.assignmentType === 'MCQ') {
      payloadText = JSON.stringify({ answers: selectedMcqAnswers });
    }

    if (!payloadText.trim()) {
      alert('Please provide your solution before submitting.');
      return;
    }

    setIsSubmitting(true);
    try {
      await curriculumService.submitAssignment(
        {
          assignmentId: activeTask.id,
          submissionText: payloadText,
          attachmentUrl: attachmentUrl || undefined,
        },
        accessToken
      );
      alert('Task submitted successfully! Your trainer will evaluate your work.');
      setActiveTask(null);
      await loadTree();
    } catch (err: any) {
      alert(err.message || 'Submission failed.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div style={{ padding: '24px', maxWidth: '1000px', margin: '0 auto' }}>
      <button
        type="button"
        onClick={onBack}
        style={{ padding: '8px 16px', borderRadius: '6px', cursor: 'pointer', marginBottom: '20px' }}
      >
        ← Back to Learning Paths
      </button>

      <header style={{ marginBottom: '24px' }}>
        <h2>{learningPathTitle}</h2>
        <p style={{ color: '#64748b' }}>Complete lessons, review materials, and submit assignments to increase progress.</p>
      </header>

      {isLoading ? (
        <div>Loading your learning track...</div>
      ) : modules.length === 0 ? (
        <div style={{ padding: '32px', textAlign: 'center', border: '2px dashed #cbd5e1', borderRadius: '8px' }}>
          No content released for this learning path yet.
        </div>
      ) : (
        modules.map((module, mIdx) => (
          <div key={module.id} style={{ border: '1px solid #e2e8f0', borderRadius: '8px', padding: '20px', marginBottom: '20px', background: '#fff' }}>
            <h3>Module {mIdx + 1}: {module.title}</h3>
            {module.description && <p style={{ color: '#475569', fontSize: '14px' }}>{module.description}</p>}

            {/* Module Resources */}
            {module.resources && module.resources.length > 0 && (
              <div style={{ marginTop: '12px', padding: '12px', background: '#fffbeb', borderRadius: '6px', border: '1px solid #fde68a' }}>
                <strong style={{ fontSize: '13px', color: '#92400e' }}>📚 Reference Resources:</strong>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '10px', marginTop: '6px' }}>
                  {module.resources.map((res: any) => (
                    <a key={res.id} href={res.url} target="_blank" rel="noreferrer" style={{ fontSize: '13px', color: '#2563eb', textDecoration: 'underline' }}>
                      🔗 {res.title}
                    </a>
                  ))}
                </div>
              </div>
            )}

            {/* Lessons List */}
            <div style={{ marginLeft: '16px', marginTop: '16px' }}>
              {module.lessons?.map((lesson: any, lIdx: number) => (
                <div key={lesson.id} style={{ background: '#f8fafc', padding: '16px', borderRadius: '6px', marginBottom: '12px', borderLeft: '4px solid #3b82f6' }}>
                  <h4>📖 Lesson {lesson.displayOrder || lIdx + 1}: {lesson.title}</h4>
                  {lesson.description && <p style={{ fontSize: '13px', color: '#475569', marginTop: '4px' }}>{lesson.description}</p>}

                  {/* 🌟 VIDEO & ARTICLE LINKS VISIBLE TO TRAINEE */}
                  <div style={{ display: 'flex', gap: '12px', marginTop: '10px' }}>
                    {lesson.videoUrl && (
                      <a
                        href={lesson.videoUrl}
                        target="_blank"
                        rel="noreferrer"
                        style={{ padding: '6px 12px', background: '#fee2e2', color: '#dc2626', borderRadius: '4px', textDecoration: 'none', fontSize: '12px', fontWeight: 600 }}
                      >
                        ▶️ Watch Video Tutorial
                      </a>
                    )}
                    {lesson.articleUrl && (
                      <a
                        href={lesson.articleUrl}
                        target="_blank"
                        rel="noreferrer"
                        style={{ padding: '6px 12px', background: '#dbeafe', color: '#2563eb', borderRadius: '4px', textDecoration: 'none', fontSize: '12px', fontWeight: 600 }}
                      >
                        📄 Read Reference Article
                      </a>
                    )}
                  </div>

                  {/* Lesson Resources */}
                  {lesson.resources && lesson.resources.length > 0 && (
                    <div style={{ marginTop: '10px', padding: '8px 12px', background: '#f0f9ff', borderRadius: '4px', border: '1px solid #bae6fd' }}>
                      <strong style={{ fontSize: '12px', color: '#0369a1' }}>📎 Attached Materials:</strong>
                      <div style={{ display: 'flex', gap: '10px', marginTop: '4px' }}>
                        {lesson.resources.map((res: any) => (
                          <a key={res.id} href={res.url} target="_blank" rel="noreferrer" style={{ fontSize: '12px', color: '#0284c7' }}>
                            🔗 {res.title}
                          </a>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Assignments & Tasks */}
                  {lesson.assignments && lesson.assignments.length > 0 && (
                    <div style={{ marginTop: '12px' }}>
                      <strong style={{ fontSize: '12px', color: '#334155' }}>Tasks & Assignments:</strong>
                      {lesson.assignments.map((task: any) => {
                        const submission = task.userSubmission;
                        return (
                          <div key={task.id} style={{ marginTop: '8px', padding: '10px', background: '#fff', border: '1px solid #cbd5e1', borderRadius: '6px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <div>
                              <strong>📝 {task.title}</strong>
                              <span style={{ marginLeft: '8px', padding: '2px 8px', borderRadius: '12px', fontSize: '11px', background: '#f1f5f9' }}>
                                {task.assignmentType || 'Subjective'}
                              </span>
                              {submission && (
                                <span style={{ marginLeft: '8px', padding: '2px 8px', borderRadius: '12px', fontSize: '11px', fontWeight: 600, background: submission.status === 'Accepted' ? '#dcfce7' : submission.status === 'Rejected' ? '#fee2e2' : '#fef3c7', color: submission.status === 'Accepted' ? '#166534' : submission.status === 'Rejected' ? '#991b1b' : '#92400e' }}>
                                  Status: {submission.status}
                                </span>
                              )}
                            </div>

                            <button
                              type="button"
                              onClick={() => handleOpenSubmissionModal(task)}
                              style={{ padding: '6px 12px', background: '#2563eb', color: '#fff', border: 'none', borderRadius: '4px', cursor: 'pointer', fontSize: '12px', fontWeight: 600 }}
                            >
                              {submission ? 'View / Resubmit' : 'Solve & Submit'}
                            </button>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        ))
      )}

      {/* 🌟 SUBMISSION MODAL */}
      {activeTask && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}>
          <div style={{ background: '#fff', width: '550px', padding: '24px', borderRadius: '8px', maxHeight: '90vh', overflowY: 'auto' }}>
            <h3>Task: {activeTask.title}</h3>
            {activeTask.instructions && <p style={{ fontSize: '13px', color: '#475569', margin: '8px 0' }}>{activeTask.instructions}</p>}

            <form onSubmit={handleSubmitTask} style={{ display: 'flex', flexDirection: 'column', gap: '12px', marginTop: '12px' }}>
              {activeTask.assignmentType === 'Subjective' ? (
                <div>
                  <label style={{ display: 'block', fontSize: '13px', fontWeight: 600 }}>Your Answer / Code Submission *</label>
                  <textarea
                    rows={5}
                    required
                    placeholder="Type your response or paste code solution here..."
                    value={submissionText}
                    onChange={(e) => setSubmissionText(e.target.value)}
                    style={{ width: '100%', padding: '8px', marginTop: '4px' }}
                  />
                </div>
              ) : (
                <div>
                  <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, marginBottom: '8px' }}>Select Answer Options *</label>
                  {activeTask.mcqConfig?.questions?.map((q: any, qIdx: number) => (
                    <div key={qIdx} style={{ background: '#f8fafc', padding: '10px', borderRadius: '6px', marginBottom: '8px' }}>
                      <p style={{ fontSize: '13px', fontWeight: 600, margin: 0 }}>Q{qIdx + 1}: {q.question}</p>
                      {q.options?.map((opt: string, optIdx: number) => (
                        <label key={optIdx} style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '12px', marginTop: '6px', cursor: 'pointer' }}>
                          <input
                            type="radio"
                            name={`q_${qIdx}`}
                            checked={selectedMcqAnswers[qIdx] === optIdx}
                            onChange={() => handleMcqSelect(qIdx, optIdx)}
                          />
                          {opt}
                        </label>
                      ))}
                    </div>
                  ))}
                </div>
              )}

              <div>
                <label style={{ display: 'block', fontSize: '13px', fontWeight: 600 }}>Attachment Link (Optional GitHub / Workspace URL)</label>
                <input
                  type="url"
                  placeholder="https://..."
                  value={attachmentUrl}
                  onChange={(e) => setAttachmentUrl(e.target.value)}
                  style={{ width: '100%', padding: '8px', marginTop: '4px' }}
                />
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px', marginTop: '16px' }}>
                <button type="button" onClick={() => setActiveTask(null)} style={{ padding: '8px 16px', background: '#cbd5e1', border: 'none', borderRadius: '4px' }}>
                  Cancel
                </button>
                <button type="submit" disabled={isSubmitting} style={{ padding: '8px 16px', background: '#2563eb', color: '#fff', border: 'none', borderRadius: '4px' }}>
                  {isSubmitting ? 'Submitting...' : 'Submit to Trainer'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}