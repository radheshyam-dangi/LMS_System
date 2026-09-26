import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { curriculumService } from '../../services/curriculumService';
import { assignmentService } from '../../services/assignmentService';
import { DeadlineDisplay } from '../DeadlineDisplay';
import { progressService } from '../../services/lmsApi';
import { useNotifications } from '../../context/NotificationContext';
import { LessonCard } from '../SharedCards/LessonCard';
import { AssignmentCard } from '../SharedCards/AssignmentCard';
import { isLessonUnlocked, isAssignmentUnlocked } from '../../shared/lockLogic';
import { RichText } from '../common/RichText';
import './TraineeAssignments.css';


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
  const [mcqAnswers, setMcqAnswers] = useState<Record<number, number | number[]>>({});
  const [isSubmitting, setIsSubmitting] = useState(false);

  const openSubmitModal = useCallback((task: any, sub: any) => {
    setSubmitTask(task);
    
    // Check local storage draft first
    const draftStr = localStorage.getItem(`draft_${task.id}`);
    if (draftStr) {
       try {
         const draft = JSON.parse(draftStr);
         setSubmissionText(draft.submissionText || '');
         setAnswers(draft.answers || {});
         setMcqAnswers(draft.mcqAnswers || {});
         return;
       } catch {}
    }

    if (sub && sub.submissionText) {
      try {
        const parsed = JSON.parse(sub.submissionText);
        if (task.assignmentType === 'MCQ') {
          setMcqAnswers(parsed.answers || {});
        } else if (task.questions?.length > 0 || task.mcqConfig?.questions?.length > 0) {
          setAnswers(parsed.answers || {});
        } else {
          setSubmissionText(sub.submissionText);
        }
      } catch {
        setSubmissionText(sub.submissionText);
      }
    } else {
      setSubmissionText('');
      setAnswers({});
      setMcqAnswers({});
    }
  }, []);

  const closeSubmitModal = useCallback(() => {
    if (!submitTask) return;
    const hasAnswers = submissionText.trim() || Object.keys(answers).length > 0 || Object.keys(mcqAnswers).length > 0;
    if (hasAnswers) {
      if (!window.confirm('Are you sure you want to discard your draft?')) {
        return;
      }
    }
    localStorage.removeItem(`draft_${submitTask.id}`);
    setSubmitTask(null);
  }, [submitTask, submissionText, answers, mcqAnswers]);

  // Save draft periodically
  useEffect(() => {
    if (submitTask) {
      const draft = { submissionText, answers, mcqAnswers };
      localStorage.setItem(`draft_${submitTask.id}`, JSON.stringify(draft));
    }
  }, [submitTask, submissionText, answers, mcqAnswers]);

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
  const isTaskSubmitted = (sub: any) => sub && sub.status !== 'AVAILABLE' && sub.status !== 'LOCKED';
  const tasksSubmitted = tasks.filter((t: any) => isTaskSubmitted(subByAssignment.get(t.id))).length;

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
    const questions = submitTask.questions?.length > 0 ? submitTask.questions : (submitTask.mcqConfig?.questions || []);
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
              <div style={{ margin: 0, opacity: 0.95, fontSize: 14, maxWidth: 720, lineHeight: 1.6 }}>
                {moduleData.description ? (
                  <RichText content={moduleData.description} />
                ) : (
                  'Module content and assessments for this learning path.'
                )}
              </div>
              
              {resources.filter((r: any) => !r.lesson && !r.lessonId).length > 0 && (
                <div style={{ marginTop: 20 }}>
                  <strong style={{ display: 'block', fontSize: 12, textTransform: 'uppercase', opacity: 0.8, marginBottom: 8 }}>Module Resources</strong>
                  <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
                    {resources.filter((r: any) => !r.lesson && !r.lessonId).map((res: any) => (
                      <a 
                        key={res.id} 
                        href={res.url} 
                        target="_blank" 
                        rel="noreferrer"
                        onClick={() => { if (res.id) progressService.visitResource(res.id, accessToken).catch(()=>{}); }}
                        style={{
                          display: 'inline-flex', alignItems: 'center', padding: '6px 14px', 
                          background: 'rgba(255, 255, 255, 0.2)', borderRadius: 20, 
                          color: '#fff', textDecoration: 'none', fontSize: 13, fontWeight: 500,
                          transition: 'background 0.2s'
                        }}
                        onMouseEnter={(e) => e.currentTarget.style.background = 'rgba(255, 255, 255, 0.3)'}
                        onMouseLeave={(e) => e.currentTarget.style.background = 'rgba(255, 255, 255, 0.2)'}
                      >
                        🔗 {res.title}
                      </a>
                    ))}
                  </div>
                </div>
              )}
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
              ['Tasks', `Tasks (${tasksSubmitted}/${tasks.length})`],
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
            {lessons.map((lesson: any, index: number) => {
              const isDone = completedLessonIds.has(String(lesson.id));
              const isLocked = isTrainee && !isLessonUnlocked(
                { id: lesson.id }, 
                index, 
                { sequentialLessonLock: moduleData.sequentialLessonLock, lessons }, 
                { completedLessonIds: Array.from(completedLessonIds) }
              );
              return (
                <LessonCard
                  key={lesson.id}
                  lesson={lesson}
                  isDone={isDone}
                  isLocked={isLocked}
                  isTrainee={isTrainee}
                  onMarkWatched={() => markLessonWatched(lesson.id)}
                  onClickLocked={() => alert('Complete the previous lesson to unlock this lesson.')}
                />
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
                const isLocked = isTrainee && !isAssignmentUnlocked(
                  { lockUntilLessonsComplete: task.lockUntilLessonsComplete, dependsOnLessonIds: task.dependsOnLessonIds },
                  { completedLessonIds: Array.from(completedLessonIds) }
                );
              
                let lockReasonStr = 'Complete prerequisite lessons to unlock this assignment.';
                if (isLocked && task.dependsOnLessonIds) {
                  const missingIds = task.dependsOnLessonIds.filter((id: string) => !completedLessonIds.has(String(id)));
                  const missingLessons = missingIds.map((id: string) => lessons.find((l: any) => String(l.id) === String(id))?.title).filter(Boolean);
                  if (missingLessons.length > 0) {
                    lockReasonStr = `Complete ${missingLessons.join(' and ')} to unlock this assignment.`;
                  }
                }

                return (
                  <AssignmentCard
                    key={task.id}
                    task={task}
                    submission={sub}
                    isLocked={isLocked}
                    lockReason={lockReasonStr}
                    isTrainee={isTrainee}
                    onClickLocked={(reason) => alert(reason || 'Complete prerequisite lessons to unlock this assignment.')}
                    onAttempt={(t) => openSubmitModal(t, sub)}
                  />
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
                let isResLocked = false;
                if (res.lesson || res.lessonId) {
                  const lId = res.lesson?.id || res.lessonId;
                  const lIdx = lessons.findIndex((l: any) => String(l.id) === String(lId));
                  if (lIdx !== -1) {
                    isResLocked = isTrainee && !isLessonUnlocked(
                      { id: lId },
                      lIdx,
                      { sequentialLessonLock: moduleData.sequentialLessonLock, lessons },
                      { completedLessonIds: Array.from(completedLessonIds) }
                    );
                  }
                }

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
                      opacity: isResLocked ? 0.6 : 1,
                    }}
                  >
                    <div>
                      <strong style={{ fontSize: 14 }}>{res.title}</strong>
                      <div style={{ fontSize: 12, color: '#64748b' }}>
                        {res.type || 'Link'} · {isResLocked ? 'Locked' : (visited ? 'Visited' : 'Not visited')}
                      </div>
                    </div>
                    {isResLocked ? (
                      <button
                        type="button"
                        style={{ padding: '6px 14px', background: '#f1f5f9', color: '#94a3b8', border: '1px solid #cbd5e1', borderRadius: 6, fontWeight: 600, fontSize: 12, cursor: 'not-allowed', display: 'flex', alignItems: 'center', gap: 6 }}
                        onClick={() => alert('Complete previous lessons to unlock this resource.')}
                      >
                        🔒 Locked
                      </button>
                    ) : (
                      <button
                        type="button"
                        onClick={() => void visitResource(res)}
                        style={{ padding: '6px 14px', background: visited ? '#ecfdf5' : '#4f46e5', color: visited ? '#047857' : '#fff', border: 'none', borderRadius: 6, fontWeight: 600, fontSize: 12, cursor: 'pointer' }}
                      >
                        {visited ? 'Open again' : 'Open & Mark Visited'}
                      </button>
                    )}
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
                      opacity: task.isLocked || status === 'LOCKED' ? 0.6 : 1,
                    }}
                  >
                    <div>
                      <h4 style={{ margin: '0 0 4px', fontSize: 15, color: '#0f172a' }}>
                        {task.isLocked || status === 'LOCKED' ? '🔒 ' : ''}{task.title}
                      </h4>
                      <span style={{ fontSize: 12, color: '#64748b' }}>
                        {task.assignmentType} · {task.lessonTitle || 'Module task'}
                      </span>
                    </div>
                    <DeadlineDisplay task={task} submission={sub} />
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                      <span
                        style={{
                          fontSize: 11,
                          fontWeight: 700,
                          padding: '4px 10px',
                          borderRadius: 999,
                          background:
                            status.toLowerCase() === 'approved'
                              ? '#dcfce7'
                              : status.toLowerCase() === 'rejected'
                                ? '#fee2e2'
                                : status.toLowerCase() === 'submitted'
                                  ? '#fef3c7'
                                  : '#f1f5f9',
                          color:
                            status.toLowerCase() === 'approved'
                              ? '#166534'
                              : status.toLowerCase() === 'rejected'
                                ? '#b91c1c'
                                : status.toLowerCase() === 'submitted'
                                  ? '#b45309'
                                  : '#475569',
                        }}
                      >
                        {status.toLowerCase() === 'approved' ? 'Passed' : status}
                        {typeof sub?.score === 'number' ? ` · ${sub.score}` : ''}
                      </span>
                      {isTrainee && status.toLowerCase() !== 'approved' && (!sub?.deadline || new Date(sub.deadline).getTime() > Date.now()) && (
                        <button
                          type="button"
                          disabled={task.isLocked || status === 'LOCKED'}
                          onClick={() => openSubmitModal(task, sub)}
                          style={{ padding: '6px 14px', background: task.isLocked || status === 'LOCKED' ? '#94a3b8' : '#4f46e5', color: '#fff', border: 'none', borderRadius: 6, fontSize: 13, fontWeight: 600, cursor: task.isLocked || status === 'LOCKED' ? 'not-allowed' : 'pointer' }}
                        >
                          {isTaskSubmitted(sub) ? 'Resubmit' : 'Attempt'}
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
        <div className="assignment-modal-overlay">
          <div className="assignment-modal-container">
            {/* Context Panel */}
            <div className="assignment-modal-context">
              <h3 style={{ margin: '0 0 4px', fontSize: 18, color: '#0f172a' }}>{submitTask.title}</h3>
              <div style={{ fontSize: 12, color: '#64748b', marginBottom: 12 }}>
                {submitTask.assignmentType} · {submitTask.lessonTitle || 'Module Task'}
              </div>
              
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                {submitTask.dependsOnLessonIds?.length > 0 && (
                  <div>
                    <strong style={{ display: 'block', fontSize: 11, color: '#94a3b8', textTransform: 'uppercase' }}>Depends On</strong>
                    <div style={{ fontSize: 13, color: '#334155' }}>
                      {submitTask.dependsOnLessonIds.map((id: string) => lessons.find((l: any) => String(l.id) === String(id))?.title).filter(Boolean).join(', ') || 'Prerequisite lessons'}
                    </div>
                  </div>
                )}
                {submitTask.assignedBy?.name && (
                  <div>
                    <strong style={{ display: 'block', fontSize: 11, color: '#94a3b8', textTransform: 'uppercase' }}>Assigned By</strong>
                    <div style={{ fontSize: 13, color: '#334155' }}>{submitTask.assignedBy.name}</div>
                  </div>
                )}
                
                {submitTask.countdownStart === 'onAssignment' ? (
                  <div>
                    <strong style={{ display: 'block', fontSize: 11, color: '#0f172a', textTransform: 'uppercase' }}>LP Assigned Time</strong>
                    <div style={{ fontSize: 13, color: '#334155' }}>
                      {subByAssignment.get(submitTask.id)?.lpAssignedAt ? new Date(subByAssignment.get(submitTask.id).lpAssignedAt).toLocaleString(undefined, { timeZoneName: 'short' }) : new Date(submitTask.createdAt).toLocaleString(undefined, { timeZoneName: 'short' })}
                    </div>
                  </div>
                ) : (
                  <div>
                    <strong style={{ display: 'block', fontSize: 11, color: '#0f172a', textTransform: 'uppercase' }}>Unlocked Time</strong>
                    <div style={{ fontSize: 13, color: '#334155' }}>
                      {subByAssignment.get(submitTask.id)?.taskUnlockedAt ? new Date(subByAssignment.get(submitTask.id).taskUnlockedAt).toLocaleString(undefined, { timeZoneName: 'short' }) : 'Unlocks after prerequisite lessons'}
                    </div>
                  </div>
                )}
                
                {subByAssignment.get(submitTask.id)?.deadline && (
                  <div>
                    <strong style={{ display: 'block', fontSize: 11, color: '#94a3b8', textTransform: 'uppercase' }}>Due Date</strong>
                    <DeadlineDisplay task={submitTask} submission={subByAssignment.get(submitTask.id)} />
                  </div>
                )}
              </div>
            </div>

            {/* Main Form Content */}
            <form onSubmit={handleSubmit} className="assignment-modal-content">
              <div className="assignment-modal-scroll">
                
                {/* Instructions Banner */}
                {submitTask.instructions && (
                  <div style={{ background: '#f0f9ff', border: '1px solid #bae6fd', borderRadius: '10px', padding: '16px', marginBottom: '24px' }}>
                    <div style={{ fontSize: '11px', fontWeight: 700, color: '#0369a1', textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: '8px' }}>
                      Instructions
                    </div>
                    <div style={{ fontSize: '14px', color: '#0c4a6e', margin: 0, fontFamily: 'inherit', lineHeight: 1.6 }}>
                      <RichText content={submitTask.instructions} emptyStateText="No instructions provided." />
                    </div>
                  </div>
                )}

                {(() => {
                  const questionsArray = submitTask.questions?.length > 0 ? submitTask.questions : (submitTask.mcqConfig?.questions || []);
                  return questionsArray.length > 0 ? (
                    questionsArray.map((q: any, idx: number) => {
                      const hasOptions = q.options && q.options.length > 0;
                      return (
                      <div key={idx} style={{ marginBottom: 20, padding: 20, background: '#fff', border: '1px solid #e2e8f0', borderRadius: 12 }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                          <div style={{ display: 'flex', gap: '8px', flex: 1 }}>
                            <strong style={{ fontSize: 15, color: '#0f172a' }}>Q{idx + 1}.</strong>
                            <div style={{ fontSize: 15, color: '#0f172a', fontWeight: 'bold' }}>
                              <RichText content={q.text || q.questionText || q.question} emptyStateText="No question text" />
                            </div>
                          </div>
                          <span style={{ fontSize: 12, color: '#64748b', fontWeight: 600, background: '#e2e8f0', padding: '2px 8px', borderRadius: 12, whiteSpace: 'nowrap', marginLeft: 12 }}>
                            {q.maxPoints || 10} pts
                          </span>
                        </div>
                        
                        {submitTask.assignmentType === 'MCQ' ? (
                          !hasOptions ? (
                            <div style={{ marginTop: 12, padding: 12, background: '#fef2f2', color: '#dc2626', borderRadius: 8, fontSize: 13, fontWeight: 600 }}>
                              Invalid question configuration: no options provided.
                            </div>
                          ) : (
                            <div style={{ marginTop: 16, display: 'flex', flexDirection: 'column', gap: 10 }}>
                              {(q.options || []).map((opt: string, oi: number) => (
                                <label key={oi} style={{ fontSize: 14, display: 'flex', gap: 12, alignItems: 'center', cursor: 'pointer', padding: '8px 12px', borderRadius: '8px', background: '#f8fafc', border: '1px solid #e2e8f0' }}>
                                  <input
                                    type={q.allowMultipleCorrect ? "checkbox" : "radio"}
                                    name={`q-${idx}`}
                                    checked={
                                      q.allowMultipleCorrect 
                                        ? (Array.isArray(mcqAnswers[idx]) ? (mcqAnswers[idx] as number[]).includes(oi) : false)
                                        : mcqAnswers[idx] === oi
                                    }
                                    onChange={() => {
                                      if (q.allowMultipleCorrect) {
                                        setMcqAnswers(prev => {
                                          const current = Array.isArray(prev[idx]) ? (prev[idx] as number[]) : [];
                                          if (current.includes(oi)) {
                                            return { ...prev, [idx]: current.filter(o => o !== oi) };
                                          } else {
                                            return { ...prev, [idx]: [...current, oi] };
                                          }
                                        });
                                      } else {
                                        setMcqAnswers(prev => ({ ...prev, [idx]: oi }));
                                      }
                                    }}
                                    style={{ width: 16, height: 16, cursor: 'pointer' }}
                                  />
                                  <div style={{ display: 'inline-block' }}>
                                    <RichText content={opt || `Option ${oi + 1}`} emptyStateText={`Option ${oi + 1}`} />
                                  </div>
                                </label>
                              ))}
                            </div>
                          )
                        ) : (
                          <textarea
                            rows={4}
                            value={answers[idx] || ''}
                            onChange={(e) => setAnswers((prev) => ({ ...prev, [idx]: e.target.value }))}
                            placeholder="Type your answer here..."
                            style={{ width: '100%', marginTop: 16, padding: 12, borderRadius: 8, border: '1px solid #cbd5e1', fontSize: 14, fontFamily: 'inherit', resize: 'vertical' }}
                          />
                        )}
                      </div>
                    )})
                  ) : (
                    <textarea
                      required
                      rows={8}
                      value={submissionText}
                      onChange={(e) => setSubmissionText(e.target.value)}
                      placeholder="Write your submission..."
                      style={{ width: '100%', padding: 16, borderRadius: 12, border: '1px solid #cbd5e1', marginBottom: 12, fontSize: 14, fontFamily: 'inherit', resize: 'vertical' }}
                    />
                  );
                })()}
              </div>
              
              <div className="assignment-modal-footer">
                {(() => {
                  const deadlineDate = subByAssignment.get(submitTask.id)?.deadline ? new Date(subByAssignment.get(submitTask.id).deadline).getTime() : null;
                  const isExpired = deadlineDate && new Date().getTime() > deadlineDate;
                  
                  return (
                    <>
                      {isExpired && <span style={{ color: '#dc2626', fontWeight: 600, fontSize: 14, display: 'flex', alignItems: 'center', marginRight: 'auto' }}>Deadline expired. Submission disabled.</span>}
                      <button type="button" onClick={closeSubmitModal} className="btn-trainee-action-secondary">
                        Cancel
                      </button>
                      {!isExpired && (
                        <button type="submit" disabled={isSubmitting} className="btn-trainee-action-primary">
                          {isSubmitting ? 'Submitting...' : 'Submit for Evaluation'}
                        </button>
                      )}
                    </>
                  );
                })()}
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
