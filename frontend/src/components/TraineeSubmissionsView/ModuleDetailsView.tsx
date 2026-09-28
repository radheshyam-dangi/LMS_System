import React, { useCallback, useEffect, useMemo, useState, useRef } from 'react';
import { createPortal } from 'react-dom';
import { curriculumService } from '../../services/curriculumService';
import { assignmentService } from '../../services/assignmentService';
import { DeadlineDisplay } from '../DeadlineDisplay';
import { progressService } from '../../services/lmsApi';
import { useNotifications } from '../../context/NotificationContext';
import { useScrollLock } from '../../hooks/useScrollLock';
import { LessonCard } from '../SharedCards/LessonCard';
import { AssignmentCard } from '../SharedCards/AssignmentCard';
import { isLessonUnlocked, isAssignmentUnlocked } from '../../shared/lockLogic';
import { RichText } from '../common/RichText';
import { ModuleDescriptionPreview, ModuleShowMoreModal } from '../common/ModuleShowMoreModal';
import { renderMultilineText } from '../../utils/textUtils';
import './ModuleDetails.css';
import './TraineeAssignments.css';


type Props = {
  moduleId: string;
  accessToken: string;
  userRole: 'Admin' | 'Trainer' | 'Trainee';
  onBack: () => void;
};

/**
 * Module Details: lessons watched, tasks submitted, resources visited → progress.
 * All derived values are computed-on-read from the backend (no stale counters).
 */
export function ModuleDetailsView({ moduleId, accessToken, userRole, onBack }: Props) {
  const isTrainee = userRole === 'Trainee';
  const { refresh: refreshNotifications } = useNotifications();
  const [moduleData, setModuleData] = useState<any | null>(null);
  const [stats, setStats] = useState<any | null>(null);
  const [mySubs, setMySubs] = useState<any[]>([]);
  const [activeTab, setActiveTab] = useState<'Lessons' | 'Tasks' | 'Assessments'>('Lessons');
  const [loading, setLoading] = useState(true);
  const [submitTask, setSubmitTask] = useState<any | null>(null);
  const [submissionText, setSubmissionText] = useState('');
  const [answers, setAnswers] = useState<Record<number, string>>({});
  const [mcqAnswers, setMcqAnswers] = useState<Record<number, number | number[]>>({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [instructionsOpen, setInstructionsOpen] = useState(true);
  const [prevStats, setPrevStats] = useState<any | null>(null);
  const [showMoreModalOpen, setShowMoreModalOpen] = useState(false);

  useScrollLock(!!submitTask);

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
      // Track previous stats for animation pulse
      if (stats) setPrevStats(stats);
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

  // Refetch on window focus (§6.2 — trainee-side reactivity)
  useEffect(() => {
    const handleFocus = () => { void load(); };
    window.addEventListener('focus', handleFocus);
    return () => window.removeEventListener('focus', handleFocus);
  }, [load]);

  // Use completedLessonIds/visitedResourceIds from module-level stats (now returned by backend)
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
    const seen = new Set(fromLessons.map((t: any) => String(t.id)));
    const fromModule = (moduleData?.assignments || [])
      .filter((a: any) => !seen.has(String(a.id)))
      .map((a: any) => ({ ...a, lessonTitle: 'Module Task' }));
    return [...fromLessons, ...fromModule];
  }, [lessons, moduleData]);

  // All derived values computed from stats (backend computed-on-read) with zero-guards
  const completedLessons = stats?.completedLessons ?? 0;
  const totalLessons = stats?.totalLessons ?? lessons.length;
  const visitedResourcesCount = stats?.visitedResources ?? 0;
  const totalResources = stats?.totalResources ?? resources.length;
  const tasksAccepted = stats?.tasksAccepted ?? 0;
  const totalAssignments = stats?.totalAssignments ?? tasks.length;
  const averageScore = stats?.averageScore ?? 0;

  const passedTasks = tasks.filter((t: any) => {
    const s = subByAssignment.get(t.id);
    return s && (s.status === 'Accepted' || s.status === 'Evaluated' || s.status === 'Approved');
  });

  const tasksPassedCount = passedTasks.length;
  const isTaskSubmitted = (sub: any) => sub && sub.status !== 'AVAILABLE' && sub.status !== 'LOCKED';
  const tasksSubmitted = tasks.filter((t: any) => isTaskSubmitted(subByAssignment.get(t.id))).length;

  // Client-side avg score calculation for display (score/maxScore format)
  const tasksScored = tasks.filter((t: any) => {
    const s = subByAssignment.get(t.id);
    return s && typeof s.score === 'number';
  });
  const totalGained = tasksScored.reduce((sum: number, t: any) => sum + Number(subByAssignment.get(t.id)?.score || 0), 0);
  const totalMax = tasksScored.reduce((sum: number, t: any) => sum + Number(t.maxScore || 100), 0);

  // Module Progress from backend (computed-on-read, §2)
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

  // Detect stat changes for pulse animation
  const didChange = useCallback((key: string) => {
    if (!prevStats || !stats) return false;
    return prevStats[key] !== stats[key];
  }, [prevStats, stats]);

  if (loading) {
    return (
      <div className="mdv-loading">
        <div className="mdv-loading-spinner" />
        <span>Loading module details...</span>
      </div>
    );
  }

  if (!moduleData) {
    return (
      <div style={{ padding: 40 }}>
        <button type="button" onClick={onBack} className="mdv-back-btn">
          ← Back
        </button>
        <p style={{ color: '#94a3b8' }}>Module not found.</p>
      </div>
    );
  }

  // Stats cards data with zero-guards
  const statsCards = [
    { icon: '⏱️', label: 'Duration', value: moduleData.durationLabel || `${moduleData.durationWeeks || 2} weeks`, key: 'duration' },
    { icon: '📖', label: 'Lessons', value: `${Math.min(completedLessons, totalLessons)}/${totalLessons} done`, key: 'completedLessons' },
    { icon: '🎯', label: 'Tasks', value: `${Math.min(tasksPassedCount, totalAssignments)}/${totalAssignments} passed`, key: 'tasksAccepted' },
    { icon: '🏆', label: 'Avg. Score', value: tasksScored.length > 0 ? `${totalGained}/${totalMax}` : `0/0`, key: 'averageScore', tooltip: 'Average of all graded task scores in this module' },
  ];

  return (
    <div className="mdv-container">
      {/* Breadcrumb & Back */}
      <div className="mdv-top-bar">
        <button type="button" onClick={onBack} className="mdv-back-btn">
          ← Back to Modules
        </button>
        <div className="mdv-breadcrumb">
          <span className="mdv-breadcrumb-segment">Learning Paths</span>
          <span className="mdv-breadcrumb-sep">›</span>
          <span className="mdv-breadcrumb-segment mdv-breadcrumb-truncate">{moduleData.learningPath?.title || 'Path'}</span>
          <span className="mdv-breadcrumb-sep">›</span>
          <span className="mdv-breadcrumb-segment">{moduleData.title}</span>
        </div>
      </div>

      {/* Banner */}
      <div className="mdv-banner">
        <div className="mdv-banner-inner">
          <div className="mdv-banner-badges">
            MODULE · {(moduleData.level || moduleData.difficultyLevel || 'Beginner').toUpperCase()} · {moduleData.learningPath?.title || 'TRACK'}
          </div>
          <div className="mdv-banner-content">
            <div className="mdv-banner-text">
              <h1 className="mdv-banner-title">{moduleData.title}</h1>
              <div className="mdv-banner-desc">
                {moduleData.description ? (
                  <ModuleDescriptionPreview
                    description={moduleData.description}
                    resources={resources.filter((r: any) => !r.lesson && !r.lessonId)}
                    onShowMore={() => setShowMoreModalOpen(true)}
                  />
                ) : (
                  'Module content and assessments for this learning track.'
                )}
              </div>
              
              {resources.filter((r: any) => !r.lesson && !r.lessonId).length > 0 && (
                <div className="mdv-module-resources">
                  <strong className="mdv-module-resources-label">Module Resources</strong>
                  <div className="mdv-module-resources-list">
                    {resources.filter((r: any) => !r.lesson && !r.lessonId).map((res: any) => (
                      <a 
                        key={res.id} 
                        href={res.url} 
                        target="_blank" 
                        rel="noreferrer"
                        onClick={() => { if (res.id) progressService.visitResource(res.id, accessToken).catch(()=>{}); }}
                        className="mdv-module-resource-link"
                      >
                        🔗 {res.title}
                      </a>
                    ))}
                  </div>
                </div>
              )}
            </div>
            <div className="mdv-progress-box">
              <div className="mdv-progress-label">Module Progress</div>
              <div className="mdv-progress-value">{progressPercent}%</div>
            </div>
          </div>
          <div className="mdv-progress-bar-track">
            <div className="mdv-progress-bar-fill" style={{ width: `${progressPercent}%` }} />
          </div>
        </div>

        {/* Stats Cards */}
        <div className="mdv-stats-row">
          {statsCards.map((m) => (
            <div key={m.label} className={`mdv-stat-card${didChange(m.key) ? ' mdv-stat-pulse' : ''}`} title={m.tooltip || ''}>
              <span className="mdv-stat-icon">{m.icon}</span>
              <div>
                <span className="mdv-stat-label">
                  {m.label}
                  {m.tooltip && (
                    <span className="mdv-stat-info" title={m.tooltip}>ⓘ</span>
                  )}
                </span>
                <strong className="mdv-stat-value">{m.value}</strong>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Objectives / Outcomes */}
      <div className="mdv-content-area">
        <div className="mdv-objectives-outcomes">
          <div className="mdv-card">
            <h4 className="mdv-card-title mdv-card-title--objectives">◎ Learning Objectives</h4>
            <ul className="mdv-card-list">
              {objectives.map((o) => (
                <li key={o}>{o}</li>
              ))}
            </ul>
          </div>
          <div className="mdv-card">
            <h4 className="mdv-card-title mdv-card-title--outcomes">✓ Learning Outcomes</h4>
            <ul className="mdv-card-list mdv-card-list--outcomes">
              {outcomes.map((o) => (
                <li key={o}>
                  <span className="mdv-outcome-check">✓</span>
                  {o}
                </li>
              ))}
            </ul>
          </div>
        </div>

        {/* Tabs */}
        <div className="mdv-tabs-row">
          {(
            [
              ['Lessons', `Lessons (${Math.min(completedLessons, totalLessons)}/${totalLessons})`],
              ['Tasks', `Tasks (${tasksSubmitted}/${totalAssignments})`],
              ['Assessments', `Assessments (${tasks.filter((t: any) => t.assignmentType === 'MCQ').length})`],
            ] as const
          ).map(([key, label]) => (
            <button
              key={key}
              type="button"
              onClick={() => setActiveTab(key)}
              className={`mdv-tab-btn${activeTab === key ? ' mdv-tab-btn--active' : ''}`}
            >
              {label}
            </button>
          ))}
        </div>

        {activeTab === 'Lessons' && (
          <div className="mdv-tab-content">
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
                  resources={lesson.resources || resources.filter((r: any) => String(r.lesson?.id || r.lessonId) === String(lesson.id))}
                  onVisitResource={(res) => res.id && progressService.visitResource(res.id, accessToken).catch(()=>{})}
                  onMarkWatched={() => markLessonWatched(lesson.id)}
                  onClickLocked={() => alert('Complete the previous lesson to unlock this lesson.')}
                />
              );
            })}
            {lessons.length === 0 && (
              <div className="mdv-empty-state">
                No lessons in this module yet.
              </div>
            )}
          </div>
        )}

        {activeTab === 'Tasks' && (
          <div className="mdv-tab-content">
            {tasks.filter((t: any) => t.assignmentType !== 'MCQ').length === 0 ? (
              <div className="mdv-empty-state">
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

        {/* Resources tab content removed. Module resources moved to Module Overview, Lesson resources moved to Lesson Rows. */}

        {activeTab === 'Assessments' && (
          <div className="mdv-tab-content">
            {tasks.filter((t: any) => t.assignmentType === 'MCQ').length === 0 ? (
              <div className="mdv-empty-state">
                No assessments assigned yet.
              </div>
            ) : (
              tasks.filter((t: any) => t.assignmentType === 'MCQ').map((task: any) => {
                const sub = subByAssignment.get(task.id);
                const status = sub?.status || 'Pending';
                return (
                  <div
                    key={task.id}
                    className="mdv-task-list-item"
                    style={{ opacity: task.isLocked || status === 'LOCKED' ? 0.6 : 1 }}
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
                        className={`mdv-status-badge mdv-status-badge--${status.toLowerCase()}`}
                      >
                        {status.toLowerCase() === 'approved' ? 'Passed' : status}
                        {typeof sub?.score === 'number' ? ` · ${sub.score}` : ''}
                      </span>
                      {isTrainee && status.toLowerCase() !== 'approved' && (!sub?.deadline || new Date(sub.deadline).getTime() > Date.now()) && (
                        <button
                          type="button"
                          disabled={task.isLocked || status === 'LOCKED'}
                          onClick={() => openSubmitModal(task, sub)}
                          className="btn-trainee-action-primary"
                          style={{ opacity: task.isLocked || status === 'LOCKED' ? 0.5 : 1, cursor: task.isLocked || status === 'LOCKED' ? 'not-allowed' : 'pointer' }}
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

      {/* Submit Task Modal — rendered via portal */}
      {submitTask && createPortal(
        <div className="assignment-modal-overlay" onClick={closeSubmitModal}>
          <div className="assignment-modal-container" onClick={(e) => e.stopPropagation()}>
            {/* Context Panel */}
            <div className="assignment-modal-context">
              <h3 style={{ margin: '0 0 4px', fontSize: 18, color: '#0f172a' }}>{submitTask.title}</h3>
              <div style={{ fontSize: 12, color: '#64748b', marginBottom: 12 }}>
                {submitTask.assignmentType} · {submitTask.lessonTitle || 'Module Task'}
              </div>
              
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                {submitTask.dependsOnLessonIds?.length > 0 && (
                  <div style={{ marginTop: 8, paddingTop: 16, borderTop: '1px solid #e2e8f0' }}>
                    <strong style={{ display: 'block', fontSize: 11, color: '#94a3b8', textTransform: 'uppercase', marginBottom: 12 }}>Required Content</strong>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                      {submitTask.dependsOnLessonIds.map((id: string) => {
                        const lesson = lessons.find((l: any) => String(l.id) === String(id));
                        if (!lesson) return null;
                        return (
                          <div key={lesson.id} style={{ transform: 'scale(0.95)', transformOrigin: 'top left', width: '105%' }}>
                            <LessonCard 
                              lesson={lesson} 
                              isDone={completedLessonIds.has(String(lesson.id))} 
                              isTrainee={isTrainee} 
                              resources={lesson.resources || resources.filter((r: any) => String(r.lesson?.id || r.lessonId) === String(lesson.id))}
                              onVisitResource={(res) => res.id && progressService.visitResource(res.id, accessToken).catch(()=>{})}
                              onMarkWatched={() => markLessonWatched(lesson.id)}
                            />
                          </div>
                        );
                      })}
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
                
                {/* Instructions Banner — collapsible */}
                {submitTask.instructions && (
                  <div className="instructions-box" style={{ background: '#f0f9ff', border: '1px solid #bae6fd', borderRadius: '10px', padding: '16px', marginBottom: '24px' }}>
                    <button type="button" onClick={() => setInstructionsOpen(!instructionsOpen)} style={{ display: 'flex', alignItems: 'center', background: 'none', border: 'none', width: '100%', padding: 0, cursor: 'pointer', textAlign: 'left', minHeight: '32px' }}>
                      <div style={{ fontSize: '11px', fontWeight: 700, color: '#0369a1', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                        {instructionsOpen ? '▾ Instructions' : '▸ Instructions'}
                      </div>
                    </button>
                    {instructionsOpen && (
                      <div style={{ fontSize: '14px', color: '#0c4a6e', margin: '8px 0 0 0', fontFamily: 'inherit', lineHeight: 1.6 }}>
                        <RichText content={submitTask.instructions} emptyStateText="No instructions provided." />
                      </div>
                    )}
                  </div>
                )}

                {(() => {
                  const questionsArray = submitTask.questions?.length > 0 ? submitTask.questions : (submitTask.mcqConfig?.questions || []);
                  return questionsArray.length > 0 ? (
                    questionsArray.map((q: any, idx: number) => {
                      const hasOptions = q.options && q.options.length > 0;
                      return (
                      <div key={idx} className="question-box" style={{ marginBottom: 20, padding: 20, background: '#fff', border: '1px solid #e2e8f0', borderRadius: 12 }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                          <div style={{ display: 'flex', gap: '8px', flex: 1 }}>
                            <strong style={{ fontSize: 15, color: '#0f172a' }}>Q{idx + 1}.</strong>
                            <div style={{ fontSize: 15, color: '#0f172a', fontWeight: 'bold' }}>
                              {renderMultilineText(q.text || q.questionText || q.question || '') || 'No question text'}
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
                            className="answer-textarea"
                            rows={4}
                            value={answers[idx] || ''}
                            onChange={(e) => setAnswers((prev) => ({ ...prev, [idx]: e.target.value }))}
                            placeholder="Type your answer here..."
                            style={{ width: '100%', marginTop: 16, padding: 12, borderRadius: 8, border: '1px solid #cbd5e1', fontSize: 14, fontFamily: 'inherit', resize: 'vertical', boxSizing: 'border-box' }}
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
                      className="answer-textarea"
                      style={{ width: '100%', padding: 16, borderRadius: 12, border: '1px solid #cbd5e1', marginBottom: 12, fontSize: 14, fontFamily: 'inherit', resize: 'vertical', boxSizing: 'border-box' }}
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
        </div>, document.body)}
      {showMoreModalOpen && (
        <ModuleShowMoreModal 
          description={moduleData?.description} 
          resources={resources.filter((r: any) => !r.lesson && !r.lessonId)} 
          onClose={() => setShowMoreModalOpen(false)} 
          onVisitResource={(id) => { progressService.visitResource(id, accessToken).catch(()=>{}); }} 
          isTrainee={true}
        />
      )}
    </div>
  );
}
