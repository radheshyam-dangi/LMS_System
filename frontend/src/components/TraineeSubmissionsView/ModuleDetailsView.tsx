import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { curriculumService } from '../../services/curriculumService';
import { assignmentService } from '../../services/assignmentService';
import { progressService } from '../../services/lmsApi';
import { useNotifications } from '../../context/NotificationContext';

type Props = {
  moduleId: string;
  accessToken: string;
  userRole: 'Admin' | 'Trainer' | 'Trainee';
  onBack: () => void;
};

/**
 * Figma-aligned Module Details: lessons watched, tasks submitted, resources visited → progress.
 */
export function ModuleDetailsView({ moduleId, accessToken, userRole, onBack }: Props) {
  const isTrainee = userRole === 'Trainee';
  const { refresh: refreshNotifications } = useNotifications();
  const [moduleData, setModuleData] = useState<any | null>(null);
  const [stats, setStats] = useState<any | null>(null);
  const [mySubs, setMySubs] = useState<any[]>([]);
  const [activeTab, setActiveTab] = useState<'Lessons' | 'Tasks' | 'Resources' | 'Assessments'>('Lessons');
  const [loading, setLoading] = useState(true);
  const [submitTask, setSubmitTask] = useState<any | null>(null);
  const [submissionText, setSubmissionText] = useState('');
  const [answers, setAnswers] = useState<Record<number, string>>({});
  const [mcqAnswers, setMcqAnswers] = useState<Record<number, number>>({});
  const [isSubmitting, setIsSubmitting] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [resolved, progress, subs] = await Promise.all([
        curriculumService.fetchModuleById(moduleId, accessToken),
        progressService.fetchModuleStats(moduleId, accessToken).catch(() => null),
        isTrainee
          ? assignmentService.fetchMySubmissions(accessToken).catch(() => [])
          : Promise.resolve([]),
      ]);
      setModuleData(resolved);
      setStats(progress);
      setMySubs(Array.isArray(subs) ? subs : []);
    } catch (err: any) {
      console.error(err);
      alert(err?.message || 'Failed to load module details.');
    } finally {
      setLoading(false);
    }
  }, [moduleId, accessToken, isTrainee]);

  useEffect(() => {
    void load();
  }, [load]);

  const completedLessonIds = useMemo(
    () => new Set<string>((stats?.completedLessonIds || []).map(String)),
    [stats],
  );
  const visitedResourceIds = useMemo(
    () => new Set<string>((stats?.visitedResourceIds || []).map(String)),
    [stats],
  );
  const subByAssignment = useMemo(() => {
    const map = new Map<string, any>();
    mySubs.forEach((s) => map.set(s.assignment?.id || s.assignmentId, s));
    return map;
  }, [mySubs]);

  const lessons = moduleData?.lessons || [];
  const resources = moduleData?.resources || [];
  const tasks = useMemo(() => {
    const fromLessons = (lessons || []).flatMap((l: any) =>
      (l.assignments || []).map((a: any) => ({ ...a, lessonTitle: l.title })),
    );
    const fromModule = (moduleData?.assignments || []).map((a: any) => ({ ...a, lessonTitle: 'Module Task' }));
    return [...fromLessons, ...fromModule];
  }, [lessons, moduleData]);

  const completedLessons = lessons.filter((l: any) => completedLessonIds.has(String(l.id))).length;

  const visitedResourcesCount = resources.filter((r: any) => visitedResourceIds.has(String(r.id))).length;

  const passedTasks = tasks.filter((t: any) => {
    const s = subByAssignment.get(t.id);
    return s && (s.status === 'Accepted' || s.status === 'Evaluated' || s.status === 'Approved');
  });

  const tasksPassedCount = passedTasks.length;
  const tasksSubmitted = tasks.filter((t: any) => subByAssignment.has(t.id)).length;

  const tasksScored = tasks.filter((t: any) => {
    const s = subByAssignment.get(t.id);
    return s && typeof s.score === 'number';
  });
  const totalGained = tasksScored.reduce((sum: number, t: any) => sum + Number(subByAssignment.get(t.id)?.score || 0), 0);
  const totalMax = tasksScored.reduce((sum: number, t: any) => sum + Number(t.maxScore || 100), 0);

  // Weighted progress is now safely calculated by the backend!
  const progressPercent = stats?.completionPercent ?? 0;

  const objectives: string[] =
    Array.isArray(moduleData?.objectives) && moduleData.objectives.length
      ? moduleData.objectives
      : ['Complete all lessons in this module', 'Review attached resources before tasks', 'Submit assigned assessments'];
  const outcomes: string[] =
    Array.isArray(moduleData?.outcomes) && moduleData.outcomes.length
      ? moduleData.outcomes
      : ['Demonstrate lesson mastery', 'Apply concepts in practical tasks', 'Earn evaluation scores from trainer'];

  const markLessonWatched = async (lessonId: string) => {
    try {
      await progressService.completeLesson(lessonId, accessToken);
      await load();
      await refreshNotifications();
    } catch (err: any) {
      alert(err?.message || 'Could not mark lesson as watched.');
    }
  };

  const visitResource = async (resource: any) => {
    try {
      if (resource?.id) await progressService.visitResource(resource.id, accessToken);
      if (resource?.url) window.open(resource.url, '_blank', 'noopener,noreferrer');
      await load();
    } catch {
      if (resource?.url) window.open(resource.url, '_blank', 'noopener,noreferrer');
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!submitTask) return;
    const questions = submitTask.mcqConfig?.questions || [];
    let text = submissionText;
    if (submitTask.assignmentType === 'MCQ' && questions.length) {
      text = JSON.stringify({ answers: mcqAnswers });
    } else if (questions.length) {
      text = JSON.stringify({ answers });
    }
    if (!text.trim() || text === '{"answers":{}}') {
      alert('Please answer the questions before submitting.');
      return;
    }
    setIsSubmitting(true);
    try {
      await assignmentService.submitAssignment(submitTask.id, { submissionText: text }, accessToken);
      setSubmitTask(null);
      setSubmissionText('');
      setAnswers({});
      setMcqAnswers({});
      await load();
      await refreshNotifications();
      alert('Submitted for evaluation.');
    } catch (err: any) {
      alert(err?.response?.data?.message || err.message || 'Submit failed.');
    } finally {
      setIsSubmitting(false);
    }
  };

  if (loading) {
    return <div style={{ padding: 40, color: '#64748b' }}>Loading module details...</div>;
  }

  if (!moduleData) {
    return (
      <div style={{ padding: 40 }}>
        <button type="button" onClick={onBack} style={{ border: 'none', background: 'none', color: '#4f46e5', fontWeight: 600, cursor: 'pointer' }}>
          ← Back
        </button>
        <p style={{ color: '#94a3b8' }}>Module not found.</p>
      </div>
    );
  }

  return (
    <div style={{ background: '#f8fafc', minHeight: '100%', fontFamily: 'system-ui, sans-serif' }}>
      <div style={{ padding: '16px 32px 0' }}>
        <button type="button" onClick={onBack} style={{ border: 'none', background: 'none', color: '#4f46e5', fontWeight: 600, cursor: 'pointer', marginBottom: 8 }}>
          ← Back to Modules
        </button>
        <div style={{ fontSize: 12, color: '#64748b', marginBottom: 12 }}>
          Learning Paths › {moduleData.learningPath?.title || 'Path'} › {moduleData.title}
        </div>
      </div>

      <div style={{ background: 'linear-gradient(135deg, #6366f1, #8b5cf6)', color: '#fff', borderRadius: 16, margin: '0 24px', overflow: 'hidden' }}>
        <div style={{ padding: '32px 40px' }}>
          <p style={{ fontSize: 12, opacity: 0.9, margin: '0 0 8px', textTransform: 'uppercase', letterSpacing: 1, fontWeight: 600 }}>
            MODULE · {(moduleData.level || moduleData.difficultyLevel || 'Beginner').toUpperCase()} · {moduleData.learningPath?.title || 'TRACK'}
          </p>
          <div style={{ display: 'flex', justifyContent: 'space-between', gap: 24, alignItems: 'flex-start' }}>
            <div>
              <h1 style={{ fontSize: 30, margin: '0 0 10px', fontWeight: 800 }}>{moduleData.title}</h1>
              <p style={{ margin: 0, opacity: 0.95, fontSize: 14, maxWidth: 720, lineHeight: 1.6 }}>
                {moduleData.description || 'Module content and assessments for this learning path.'}
              </p>
            </div>
            <div style={{ textAlign: 'right', flexShrink: 0 }}>
              <div style={{ fontSize: 12, opacity: 0.9 }}>Module Progress</div>
              <div style={{ fontSize: 36, fontWeight: 800 }}>{progressPercent}%</div>
            </div>
          </div>
          <div style={{ width: '100%', height: 6, background: 'rgba(255,255,255,0.25)', borderRadius: 4, marginTop: 24 }}>
            <div style={{ width: `${progressPercent}%`, height: '100%', background: '#fff', borderRadius: 4 }} />
          </div>
        </div>

        <div style={{ background: '#fff', color: '#0f172a', padding: '16px 40px', display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 16 }}>
          {[
            { icon: '⏱️', label: 'Duration', value: moduleData.durationLabel || `${moduleData.durationWeeks || 2} weeks` },
            { icon: '📖', label: 'Lessons', value: `${completedLessons}/${lessons.length} done` },
            { icon: '🎯', label: 'Tasks', value: `${tasksPassedCount}/${tasks.length} passed` },
            { icon: '🏆', label: 'Avg. Score', value: tasksScored.length > 0 ? `${totalGained}/${totalMax}` : `0/0` },
          ].map((m) => (
            <div key={m.label} style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <span style={{ fontSize: 20 }}>{m.icon}</span>
              <div>
                <span style={{ display: 'block', fontSize: 11, color: '#64748b' }}>{m.label}</span>
                <strong style={{ fontSize: 14 }}>{m.value}</strong>
              </div>
            </div>
          ))}
        </div>
      </div>

      <div style={{ padding: '28px 32px', maxWidth: 1200, margin: '0 auto' }}>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20, marginBottom: 28 }}>
          <div style={{ background: '#fff', padding: 22, borderRadius: 12, border: '1px solid #e2e8f0' }}>
            <h4 style={{ margin: '0 0 14px', color: '#4f46e5' }}>◎ Learning Objectives</h4>
            <ul style={{ margin: 0, paddingLeft: 18, color: '#475569', fontSize: 14, lineHeight: 1.8 }}>
              {objectives.map((o) => (
                <li key={o}>{o}</li>
              ))}
            </ul>
          </div>
          <div style={{ background: '#fff', padding: 22, borderRadius: 12, border: '1px solid #e2e8f0' }}>
            <h4 style={{ margin: '0 0 14px', color: '#16a34a' }}>✓ Learning Outcomes</h4>
            <ul style={{ margin: 0, paddingLeft: 0, listStyle: 'none', color: '#475569', fontSize: 14, lineHeight: 1.8 }}>
              {outcomes.map((o) => (
                <li key={o}>
                  <span style={{ color: '#16a34a', marginRight: 8 }}>✓</span>
                  {o}
                </li>
              ))}
            </ul>
          </div>
        </div>

        <div style={{ display: 'flex', gap: 28, borderBottom: '2px solid #e2e8f0', marginBottom: 20 }}>
          {(
            [
              ['Lessons', `Lessons (${completedLessons}/${lessons.length})`],
              ['Tasks', `Tasks (${tasksPassedCount}/${tasks.length})`],
              ['Resources', `Resources (${visitedResourcesCount}/${resources.length || 0})`],
              ['Assessments', `Assessments (${tasks.filter((t: any) => t.assignmentType === 'MCQ').length})`],
            ] as const
          ).map(([key, label]) => (
            <button
              key={key}
              type="button"
              onClick={() => setActiveTab(key)}
              style={{
                paddingBottom: 14,
                border: 'none',
                background: 'none',
                cursor: 'pointer',
                fontWeight: 600,
                fontSize: 14,
                color: activeTab === key ? '#4f46e5' : '#64748b',
                borderBottom: activeTab === key ? '2px solid #4f46e5' : '2px solid transparent',
                marginBottom: -2,
              }}
            >
              {label}
            </button>
          ))}
        </div>

        {activeTab === 'Lessons' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {lessons.map((lesson: any) => {
              const isDone = completedLessonIds.has(String(lesson.id));
              return (
                <div
                  key={lesson.id}
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    padding: '18px 22px',
                    background: '#fff',
                    border: '1px solid #e2e8f0',
                    borderRadius: 12,
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
                    <div
                      style={{
                        width: 22,
                        height: 22,
                        borderRadius: '50%',
                        border: isDone ? 'none' : '2px solid #cbd5e1',
                        background: isDone ? '#22c55e' : 'transparent',
                        color: '#fff',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        fontSize: 12,
                      }}
                    >
                      {isDone && '✓'}
                    </div>
                    <div>
                      <div style={{ fontSize: 15, fontWeight: 600, color: isDone ? '#64748b' : '#0f172a', textDecoration: isDone ? 'line-through' : 'none' }}>
                        {lesson.title}
                      </div>
                      <div style={{ fontSize: 12, color: '#94a3b8' }}>
                        {isDone ? 'Watched' : 'Pending'} · {lesson.durationMinutes || 15} min
                      </div>
                    </div>
                  </div>
                  <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
                    {lesson.videoUrl && (
                      <a href={lesson.videoUrl} target="_blank" rel="noreferrer" style={{ fontSize: 12, color: '#4f46e5', fontWeight: 600 }}>
                        Video
                      </a>
                    )}
                    {lesson.articleUrl && (
                      <a href={lesson.articleUrl} target="_blank" rel="noreferrer" style={{ fontSize: 12, color: '#4f46e5', fontWeight: 600 }}>
                        Article
                      </a>
                    )}
                    {isTrainee && !isDone && (
                      <button
                        type="button"
                        onClick={() => void markLessonWatched(lesson.id)}
                        style={{ padding: '6px 14px', background: '#eff6ff', color: '#2563eb', border: 'none', borderRadius: 6, fontSize: 13, fontWeight: 600, cursor: 'pointer' }}
                      >
                        Mark Watched
                      </button>
                    )}
                    {isDone && <span style={{ fontSize: 12, color: '#16a34a', fontWeight: 700 }}>Watched</span>}
                  </div>
                </div>
              );
            })}
            {lessons.length === 0 && (
              <div style={{ padding: 28, textAlign: 'center', color: '#94a3b8', background: '#fff', border: '1px dashed #cbd5e1', borderRadius: 8 }}>
                No lessons in this module yet.
              </div>
            )}
          </div>
        )}

        {activeTab === 'Tasks' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {tasks.filter((t: any) => t.assignmentType !== 'MCQ').length === 0 ? (
              <div style={{ padding: 28, textAlign: 'center', color: '#94a3b8', background: '#fff', border: '1px dashed #cbd5e1', borderRadius: 8 }}>
                No tasks assigned yet.
              </div>
            ) : (
              tasks.filter((t: any) => t.assignmentType !== 'MCQ').map((task: any) => {
                const sub = subByAssignment.get(task.id);
                const status = sub?.status || 'Pending';
                return (
                  <div
                    key={task.id}
                    style={{
                      padding: '16px 20px',
                      background: '#fff',
                      border: '1px solid #e2e8f0',
                      borderRadius: 8,
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      gap: 12,
                    }}
                  >
                    <div>
                      <h4 style={{ margin: '0 0 4px', fontSize: 15, color: '#0f172a' }}>{task.title}</h4>
                      <span style={{ fontSize: 12, color: '#64748b' }}>
                        {task.assignmentType} · {task.lessonTitle || 'Module task'} · Due{' '}
                        {task.dueDate ? new Date(task.dueDate).toLocaleDateString() : 'N/A'}
                      </span>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                      <span
                        style={{
                          fontSize: 11,
                          fontWeight: 700,
                          padding: '4px 10px',
                          borderRadius: 999,
                          background:
                            status === 'Approved'
                              ? '#dcfce7'
                              : status === 'Rejected'
                                ? '#fee2e2'
                                : status === 'Submitted'
                                  ? '#fef3c7'
                                  : '#f1f5f9',
                          color:
                            status === 'Approved'
                              ? '#166534'
                              : status === 'Rejected'
                                ? '#b91c1c'
                                : status === 'Submitted'
                                  ? '#b45309'
                                  : '#475569',
                        }}
                      >
                        {status === 'Approved' ? 'Approved' : status}
                        {typeof sub?.score === 'number' ? ` · ${sub.score}` : ''}
                      </span>
                      {isTrainee && status !== 'Approved' && (
                        <button
                          type="button"
                          onClick={() => {
                            setSubmitTask(task);
                            setSubmissionText('');
                            setAnswers({});
                            setMcqAnswers({});
                          }}
                          style={{ padding: '6px 14px', background: '#4f46e5', color: '#fff', border: 'none', borderRadius: 6, fontSize: 13, fontWeight: 600, cursor: 'pointer' }}
                        >
                          {sub ? 'Resubmit' : 'Submit'}
                        </button>
                      )}
                    </div>
                  </div>
                );
              })
            )}
          </div>
        )}

        {activeTab === 'Resources' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {resources.length === 0 ? (
              <div style={{ padding: 28, textAlign: 'center', color: '#94a3b8', background: '#fff', border: '1px dashed #cbd5e1', borderRadius: 8 }}>
                No resources yet. Review lesson video/article links before submitting tasks.
              </div>
            ) : (
              resources.map((res: any) => {
                const visited = visitedResourceIds.has(String(res.id));
                return (
                  <div
                    key={res.id}
                    style={{
                      padding: '14px 18px',
                      background: '#fff',
                      border: '1px solid #e2e8f0',
                      borderRadius: 8,
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                    }}
                  >
                    <div>
                      <strong style={{ fontSize: 14 }}>{res.title}</strong>
                      <div style={{ fontSize: 12, color: '#64748b' }}>{res.type || 'Link'} · {visited ? 'Visited' : 'Not visited'}</div>
                    </div>
                    <button
                      type="button"
                      onClick={() => void visitResource(res)}
                      style={{ padding: '6px 14px', background: visited ? '#ecfdf5' : '#4f46e5', color: visited ? '#047857' : '#fff', border: 'none', borderRadius: 6, fontWeight: 600, fontSize: 12, cursor: 'pointer' }}
                    >
                      {visited ? 'Open again' : 'Open & Mark Visited'}
                    </button>
                  </div>
                );
              })
            )}
          </div>
        )}

        {activeTab === 'Assessments' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {tasks.filter((t: any) => t.assignmentType === 'MCQ').length === 0 ? (
              <div style={{ padding: 28, textAlign: 'center', color: '#94a3b8', background: '#fff', border: '1px dashed #cbd5e1', borderRadius: 8 }}>
                No assessments assigned yet.
              </div>
            ) : (
              tasks.filter((t: any) => t.assignmentType === 'MCQ').map((task: any) => {
                const sub = subByAssignment.get(task.id);
                const status = sub?.status || 'Pending';
                return (
                  <div
                    key={task.id}
                    style={{
                      padding: '16px 20px',
                      background: '#fff',
                      border: '1px solid #e2e8f0',
                      borderRadius: 8,
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      gap: 12,
                    }}
                  >
                    <div>
                      <h4 style={{ margin: '0 0 4px', fontSize: 15, color: '#0f172a' }}>{task.title}</h4>
                      <span style={{ fontSize: 12, color: '#64748b' }}>
                        {task.assignmentType} · {task.lessonTitle || 'Module task'} · Due{' '}
                        {task.dueDate ? new Date(task.dueDate).toLocaleDateString() : 'N/A'}
                      </span>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                      <span
                        style={{
                          fontSize: 11,
                          fontWeight: 700,
                          padding: '4px 10px',
                          borderRadius: 999,
                          background:
                            status === 'Approved'
                              ? '#dcfce7'
                              : status === 'Rejected'
                                ? '#fee2e2'
                                : status === 'Submitted'
                                  ? '#fef3c7'
                                  : '#f1f5f9',
                          color:
                            status === 'Approved'
                              ? '#166534'
                              : status === 'Rejected'
                                ? '#b91c1c'
                                : status === 'Submitted'
                                  ? '#b45309'
                                  : '#475569',
                        }}
                      >
                        {status === 'Approved' ? 'Passed' : status}
                        {typeof sub?.score === 'number' ? ` · ${sub.score}` : ''}
                      </span>
                      {isTrainee && status !== 'Approved' && (
                        <button
                          type="button"
                          onClick={() => {
                            setSubmitTask(task);
                            setSubmissionText('');
                            setAnswers({});
                            setMcqAnswers({});
                          }}
                          style={{ padding: '6px 14px', background: '#4f46e5', color: '#fff', border: 'none', borderRadius: 6, fontSize: 13, fontWeight: 600, cursor: 'pointer' }}
                        >
                          {sub ? 'Resubmit' : 'Attempt'}
                        </button>
                      )}
                    </div>
                  </div>
                );
              })
            )}
          </div>
        )}
      </div>

      {submitTask && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(15,23,42,0.55)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}>
          <form onSubmit={handleSubmit} style={{ width: 560, maxHeight: '90vh', overflowY: 'auto', background: '#fff', borderRadius: 16, padding: 24 }}>
            <h3 style={{ margin: '0 0 12px' }}>Submit: {submitTask.title}</h3>
            {(submitTask.mcqConfig?.questions || []).length > 0 ? (
              (submitTask.mcqConfig.questions as any[]).map((q, idx) => (
                <div key={idx} style={{ marginBottom: 14, padding: 12, background: '#f8fafc', borderRadius: 8 }}>
                  <strong style={{ fontSize: 13 }}>
                    Q{idx + 1}. {q.questionText || q.question}
                  </strong>
                  {submitTask.assignmentType === 'MCQ' ? (
                    <div style={{ marginTop: 8, display: 'flex', flexDirection: 'column', gap: 6 }}>
                      {(q.options || ['', '', '', '']).map((opt: string, oi: number) => (
                        <label key={oi} style={{ fontSize: 13, display: 'flex', gap: 8, alignItems: 'center' }}>
                          <input
                            type="radio"
                            name={`q-${idx}`}
                            checked={mcqAnswers[idx] === oi}
                            onChange={() => setMcqAnswers((prev) => ({ ...prev, [idx]: oi }))}
                          />
                          {opt || `Option ${oi + 1}`}
                        </label>
                      ))}
                    </div>
                  ) : (
                    <textarea
                      rows={3}
                      value={answers[idx] || ''}
                      onChange={(e) => setAnswers((prev) => ({ ...prev, [idx]: e.target.value }))}
                      placeholder="Your answer..."
                      style={{ width: '100%', marginTop: 8, padding: 8, borderRadius: 6, border: '1px solid #e2e8f0' }}
                    />
                  )}
                </div>
              ))
            ) : (
              <textarea
                required
                rows={5}
                value={submissionText}
                onChange={(e) => setSubmissionText(e.target.value)}
                placeholder="Write your submission..."
                style={{ width: '100%', padding: 12, borderRadius: 8, border: '1px solid #e2e8f0', marginBottom: 12 }}
              />
            )}
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
              <button type="button" onClick={() => setSubmitTask(null)} style={{ padding: '8px 14px', border: 'none', borderRadius: 8, background: '#f1f5f9', fontWeight: 600 }}>
                Cancel
              </button>
              <button type="submit" disabled={isSubmitting} style={{ padding: '8px 14px', border: 'none', borderRadius: 8, background: '#4f46e5', color: '#fff', fontWeight: 700 }}>
                {isSubmitting ? 'Submitting...' : 'Submit for Evaluation'}
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
