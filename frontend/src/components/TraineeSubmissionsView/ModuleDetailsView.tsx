import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { curriculumService } from '../../services/curriculumService';
import { assignmentService } from '../../services/assignmentService';
import { DeadlineDisplay } from '../DeadlineDisplay';
import { progressService } from '../../services/lmsApi';
import { useNotifications } from '../../context/NotificationContext';
import { useToast } from '../../context/ToastContext';
import { useScrollLock } from '../../hooks/useScrollLock';
import { LessonCard } from '../SharedCards/LessonCard';
import { isLessonUnlocked, isAssignmentUnlocked } from '../../shared/lockLogic';
import { RichText } from '../common/RichText';
import { ModuleDescriptionPreview, ModuleShowMoreModal } from '../common/ModuleShowMoreModal';
import { renderMultilineText } from '../../utils/textUtils';
import { resolveAssignmentInstructions } from '../../utils/assignmentInstructions';
import { AssignmentInstructionsGate } from '../common/AssignmentInstructionsGate';
import { Bot } from 'lucide-react';
import { AssignmentChatDrawer } from './AssignmentChatDrawer';
import { SharedAssignmentModal } from '../SharedCards/SharedAssignmentModal';
import './ModuleDetails.css';
import './TraineeAssignments.css';


type Props = {
  moduleId: string;
  accessToken: string;
  userRole: 'Admin' | 'Trainer' | 'Trainee';
  onBack: () => void;
};

/**
 * Computes the display status / flags for a task row (same logic as TraineeAssignmentsView).
 */
const getCardData = (a: any, sub: any, isLocked: boolean) => {
  let rawStatus = (sub?.status || 'Pending').toUpperCase();
  if (isLocked || a.isLocked) rawStatus = 'LOCKED';

  const deadlineDate = a.computedDeadline
    ? new Date(a.computedDeadline)
    : sub?.deadline
      ? new Date(sub.deadline)
      : null;
  const now = new Date();

  let displayStatus = 'Pending';
  let isOverdue = false;
  let isBelowCutoff = false;

  const markOverdue = () => {
    if (deadlineDate && now > deadlineDate) {
      displayStatus = 'Missed/Overdue';
      isOverdue = true;
    }
  };

  if (rawStatus === 'LOCKED') {
    displayStatus = 'Locked';
  } else if (['APPROVED', 'EVALUATED', 'ACCEPTED'].includes(rawStatus)) {
    const maxScore = a.maxScore || 100;
    isBelowCutoff = typeof sub?.score === 'number' && (sub.score / maxScore) * 100 < 35;
    if (isBelowCutoff) {
      displayStatus = 'Needs Improvement';
      markOverdue();
    } else {
      displayStatus = 'Approved';
    }
  } else if (rawStatus === 'NEEDS_IMPROVEMENT') {
    displayStatus = 'Needs Improvement';
    markOverdue();
  } else if (rawStatus === 'REJECTED') {
    displayStatus = 'Rejected';
    markOverdue();
  } else if (rawStatus === 'SUBMITTED') {
    displayStatus = 'Submitted';
  } else {
    displayStatus = 'Pending';
    markOverdue();
  }

  const isExpired = sub?.deadline
    ? new Date(sub.deadline).getTime() < now.getTime()
    : deadlineDate
      ? now > deadlineDate
      : false;

  return { displayStatus, isOverdue, isExpired, isBelowCutoff, rawStatus };
};

/**
 * Module Details: lessons watched, tasks submitted, resources visited → progress.
 * All derived values are computed-on-read from the backend (no stale counters).
 */
export function ModuleDetailsView({ moduleId, accessToken, userRole, onBack }: Props) {
  const isTrainee = userRole === 'Trainee';
  const { refresh: refreshNotifications } = useNotifications();
  const toast = useToast();
  const [moduleData, setModuleData] = useState<any | null>(null);
  const [stats, setStats] = useState<any | null>(null);
  const [mySubs, setMySubs] = useState<any[]>([]);
  const [activeTab, setActiveTab] = useState<'Lessons' | 'Tasks' | 'Assessments'>('Lessons');
  const [loading, setLoading] = useState(true);
  const [submitTask, setSubmitTask] = useState<any | null>(null);
  const [viewDetailsTarget, setViewDetailsTarget] = useState<any | null>(null);
  const [submissionText, setSubmissionText] = useState('');
  const [answers, setAnswers] = useState<Record<number, string>>({});
  const [mcqAnswers, setMcqAnswers] = useState<Record<number, number | number[]>>({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [instructionsOpen, setInstructionsOpen] = useState(true);
  const [isInstructionsGateOpen, setIsInstructionsGateOpen] = useState(false);
  const [isChatDrawerOpen, setIsChatDrawerOpen] = useState(false);
  const [attachmentUrl, setAttachmentUrl] = useState('');
  const [prevStats, setPrevStats] = useState<any | null>(null);
  const [showMoreModalOpen, setShowMoreModalOpen] = useState(false);

  useScrollLock(!!submitTask || !!viewDetailsTarget);

  const beginAssignmentSubmission = useCallback((task: any, sub: any) => {
    setSubmitTask(task);
    setIsInstructionsGateOpen(true);
    setInstructionsOpen(false);

    // Check local storage draft first
    const draftStr = localStorage.getItem(`draft_${task.id}`);
    if (draftStr) {
      try {
        const draft = JSON.parse(draftStr);
        setSubmissionText(draft.submissionText || '');
        setAnswers(draft.answers || {});
        setMcqAnswers(draft.mcqAnswers || {});
        setAttachmentUrl(draft.attachmentUrl || '');
        return;
      } catch { }
    }

    if (sub && sub.answers && Array.isArray(sub.answers)) {
      const questions = task.questions?.length > 0 ? task.questions : (task.mcqConfig?.questions || []);
      const prefilledMcq: any = {};
      const prefilledSubj: any = {};
      sub.answers.forEach((ans: any) => {
        const qIndex = questions.findIndex((q: any, idx: number) => (q.id || String(idx)) === ans.questionId);
        if (qIndex !== -1) {
          const q = questions[qIndex];
          if ((q.type || q.questionType || '').toUpperCase() === 'MCQ') {
            if (q.allowMultipleCorrect && Array.isArray(ans.answer)) {
              prefilledMcq[qIndex] = ans.answer.map(Number);
            } else if (ans.answer) {
              prefilledMcq[qIndex] = Number(ans.answer);
            }
          } else {
            prefilledSubj[qIndex] = ans.answer;
          }
        }
      });
      setMcqAnswers(prefilledMcq);
      setAnswers(prefilledSubj);
      setSubmissionText(sub.submissionText || '');
      return;
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
      setAttachmentUrl(sub?.attachmentUrl || '');
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
    setIsInstructionsGateOpen(false);
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
      toast.error(err?.message || 'Failed to load module details.');
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
  const totalMax = tasks.reduce((sum: number, t: any) => sum + Number(t.maxScore || 100), 0);

  // Module Progress from backend (computed-on-read, §2)
  const totalVisibleItems = totalLessons + totalAssignments;
  const completedVisibleItems = Math.min(completedLessons, totalLessons) + Math.min(tasksSubmitted, totalAssignments);
  const progressPercent = totalVisibleItems > 0 ? Math.round((completedVisibleItems / totalVisibleItems) * 100) : 0;

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
      toast.error(err?.message || 'Could not mark lesson as watched.');
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

    const questions: any[] = submitTask?.questions || submitTask?.mcqConfig?.questions || [];
    const structuredAnswers: Array<{ questionId: string; answer: string }> = questions.map((q: any, idx: number) => {
      const qId = q.id || String(idx);
      const isMCQ = (q.type || q.questionType || '').toUpperCase() === 'MCQ';
      if (isMCQ) {
        const selectedIdx = mcqAnswers[idx];
        return {
          questionId: qId,
          answer: typeof selectedIdx === 'number' ? String(selectedIdx) : '',
        };
      } else {
        return {
          questionId: qId,
          answer: answers[idx] || submissionText,
        };
      }
    });

    let finalText = submissionText;
    if (questions.length > 0) {
      finalText = JSON.stringify({
        answers: mcqAnswers,
        textAnswers: answers,
        raw: submissionText,
      });
    }
    if (!finalText.trim()) finalText = 'Task completed & submitted';

    if (!submitTask) {
      toast.warning('Please select an assignment to submit.');
      return;
    }

    setIsSubmitting(true);
    try {
      await assignmentService.submitAssignment(
        submitTask.id,
        {
          submissionText: finalText,
          attachmentUrl: attachmentUrl || undefined,
          answers: structuredAnswers.length > 0 ? structuredAnswers : undefined,
        },
        accessToken,
      );
      closeSubmitModal();
      await load();
      await refreshNotifications();
      toast.success('Assignment submitted for evaluation!');
    } catch (err: any) {
      console.error(err);
      toast.error(err?.response?.data?.message || err?.message || 'Submission failed.');
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
    { icon: '🎯', label: 'Tasks', value: `${Math.min(tasksSubmitted, totalAssignments)}/${totalAssignments} submitted`, key: 'tasksAccepted' },
    { icon: '🏆', label: 'Avg. Score', value: tasks.length > 0 ? `${totalGained}/${totalMax}` : `0/0`, key: 'averageScore', tooltip: 'Total score gained out of total available in this module' },
  ];

  // Shared row renderer for Tasks + Assessments tabs (same UI as TraineeAssignmentsView)
  const renderTaskRow = (task: any) => {
    const sub = subByAssignment.get(task.id);
    const isLocked =
      isTrainee &&
      !isAssignmentUnlocked(
        { lockUntilLessonsComplete: task.lockUntilLessonsComplete, dependsOnLessonIds: task.dependsOnLessonIds },
        { completedLessonIds: Array.from(completedLessonIds) },
      );

    const { displayStatus, isOverdue, isExpired, isBelowCutoff, rawStatus } = getCardData(task, sub, isLocked);

    const isExternal = String(task.assignmentType || '').toLowerCase() === 'external';

    let bg = '#f1f5f9';
    let color = '#475569';
    if (displayStatus === 'Approved') { bg = '#dcfce7'; color = '#166534'; }
    else if (displayStatus === 'Needs Improvement') { bg = '#ffedd5'; color = '#c2410c'; }
    else if (displayStatus === 'Rejected') { bg = '#fee2e2'; color = '#b91c1c'; }
    else if (displayStatus === 'Submitted') { bg = '#fef3c7'; color = '#b45309'; }
    else if (displayStatus === 'Missed/Overdue') { bg = '#fecaca'; color = '#991b1b'; }

    const showDeadline = displayStatus !== 'Locked';
    const isLockedByLessons =
      displayStatus === 'Locked' && (task.dependsOnLessonIds?.length > 0 || task.lockUntilLessonsComplete);

    return (
      <div
        key={task.id}
        className={displayStatus === 'Locked' ? 'locked-item interactive-lock' : ''}
        title={displayStatus === 'Locked' ? task.lockReason || 'Locked task' : ''}
        style={{
          display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 16,
          padding: '14px 18px', border: '1px solid #e2e8f0', borderRadius: 12, background: '#fff',
          opacity: displayStatus === 'Locked' ? 0.75 : 1, transition: 'box-shadow 0.15s',
          flexWrap: 'wrap', // Allow wrapping on small screens
        }}
      >
        {/* LEFT: title + type tags */}
        <div style={{ minWidth: 200, flex: '1 1 240px' }}>
          <div style={{ display: 'flex', gap: 6, alignItems: 'center', marginBottom: 4, flexWrap: 'wrap' }}>
            <span
              style={{
                fontSize: 10, fontWeight: 700, padding: '2px 8px', borderRadius: 999, whiteSpace: 'nowrap',
                background: isExternal ? '#ede9fe' : '#e0f2fe',
                color: isExternal ? '#6d28d9' : '#0369a1',
              }}
            >
              {isExternal ? 'External' : moduleData?.learningPath?.title || 'Learning Path'}
            </span>
            <span style={{ fontSize: 11, color: '#94a3b8' }}>
              {task.assignmentType || 'Subjective'} · {task.lessonTitle || 'Module task'}
            </span>
          </div>
          <strong style={{ display: 'block', fontSize: 14, color: '#0f172a', wordBreak: 'break-word' }}>
            {task.title}
          </strong>
          {displayStatus === 'Rejected' && sub?.feedback && (
            <span style={{ fontSize: 11, color: '#b91c1c', marginTop: 3, display: 'block' }}>Reason: {sub.feedback}</span>
          )}
          {displayStatus === 'Needs Improvement' && sub?.feedback && (
            <span style={{ fontSize: 11, color: '#c2410c', marginTop: 3, display: 'block' }}>Feedback: {sub.feedback}</span>
          )}
        </div>

        {/* CENTER: deadline / lock message */}
        <div style={{ flex: '0 0 240px', display: 'flex', alignItems: 'center', justifyContent: 'flex-start', fontSize: 12, color: '#64748b', gap: 6, flexWrap: 'wrap' }}>
          {isLockedByLessons ? (
            <span style={{ display: 'flex', alignItems: 'center', gap: 5, color: '#94a3b8' }}>
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="11" width="18" height="11" rx="2" ry="2" /><path d="M7 11V7a5 5 0 0 1 10 0v4" /></svg>
              Unlocks after prerequisite lessons
            </span>
          ) : showDeadline && (sub || task.computedDeadline) ? (
            <DeadlineDisplay task={task} submission={sub} />
          ) : displayStatus === 'Submitted' && sub?.submittedAt ? (
            <span style={{ color: '#b45309' }}>Submitted {new Date(sub.submittedAt).toLocaleDateString()}</span>
          ) : null}

          {task.externalUrl && displayStatus !== 'Locked' && (
            <a href={task.externalUrl} target="_blank" rel="noreferrer" style={{ color: '#4f46e5', marginLeft: 8 }}>
              Open resource
            </a>
          )}
        </div>

        {/* RIGHT: status badge + actions */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexShrink: 0, flexWrap: 'wrap' }}>
          <span
            style={{
              fontSize: 11, fontWeight: 700, padding: '4px 10px', borderRadius: 999,
              background: bg, color, whiteSpace: 'nowrap', letterSpacing: '0.02em',
            }}
          >
            {displayStatus === 'Rejected' ? 'REJECTED' : displayStatus}
            {typeof sub?.score === 'number' &&
              ['Approved', 'Needs Improvement', 'Rejected'].includes(displayStatus)
              ? ` · ${sub.score}`
              : ''}
          </span>

          {(['Approved', 'Needs Improvement', 'Rejected'].includes(displayStatus) || rawStatus === 'EVALUATED') && sub && (
            <button
              type="button"
              onClick={() => setViewDetailsTarget({ assignment: task, submission: sub })}
              style={{ padding: '7px 13px', borderRadius: 8, border: '1px solid #e2e8f0', background: '#fff', color: '#0f172a', fontWeight: 600, fontSize: 12, cursor: 'pointer' }}
            >
              View Details
            </button>
          )}

          {isTrainee && !isExpired && !isOverdue && displayStatus !== 'Locked' &&
            (displayStatus !== 'Approved' || isBelowCutoff) && displayStatus !== 'Submitted' && (
              <>
                {rawStatus === 'AVAILABLE' && task.anchorType === 'TASK_START' ? (
                  <button
                    type="button"
                    onClick={async () => {
                      if (!window.confirm('Start this assignment now? The deadline countdown will begin immediately.')) return;
                      try {
                        await assignmentService.startAssignment(task.id, accessToken);
                        await load();
                      } catch (err: any) {
                        toast.error(err?.response?.data?.message || err.message || 'Could not start assignment');
                      }
                    }}
                    style={{ padding: '8px 14px', borderRadius: 8, border: 'none', background: '#16a34a', color: '#fff', fontWeight: 700, fontSize: 12, cursor: 'pointer' }}
                  >
                    Start Assignment
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={() => beginAssignmentSubmission(task, sub)}
                    style={{
                      padding: '8px 16px', borderRadius: 8, border: 'none', color: '#fff', fontWeight: 700, fontSize: 12, cursor: 'pointer',
                      background: ['Needs Improvement', 'Rejected'].includes(displayStatus) || isBelowCutoff ? '#7c3aed' : '#4f46e5',
                      boxShadow: '0 1px 4px rgba(79,70,229,0.3)',
                    }}
                  >
                    {['Needs Improvement', 'Rejected'].includes(displayStatus) || isBelowCutoff ? 'Resubmit' : 'Submit'}
                  </button>
                )}
              </>
            )}
        </div>
      </div>
    );
  };

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
                        onClick={() => { if (res.id) progressService.visitResource(res.id, accessToken).catch(() => { }); }}
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
                  onVisitResource={(res) => res.id && progressService.visitResource(res.id, accessToken).catch(() => { })}
                  onMarkWatched={() => markLessonWatched(lesson.id)}
                  onClickLocked={() => toast.warning('Complete the previous lesson to unlock this lesson.')}
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
          <div className="mdv-tab-content" style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {tasks.filter((t: any) => t.assignmentType !== 'MCQ').length === 0 ? (
              <div className="mdv-empty-state">
                No tasks assigned yet.
              </div>
            ) : (
              tasks.filter((t: any) => t.assignmentType !== 'MCQ').map(renderTaskRow)
            )}
          </div>
        )}

        {/* Resources tab content removed. Module resources moved to Module Overview, Lesson resources moved to Lesson Rows. */}

        {activeTab === 'Assessments' && (
          <div className="mdv-tab-content" style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {tasks.filter((t: any) => t.assignmentType === 'MCQ').length === 0 ? (
              <div className="mdv-empty-state">
                No assessments assigned yet.
              </div>
            ) : (
              tasks.filter((t: any) => t.assignmentType === 'MCQ').map(renderTaskRow)
            )}
          </div>
        )}
      </div>

            {/* Submit Task Modal */}
      {submitTask && (
        <SharedAssignmentModal
          task={submitTask}
          submission={subByAssignment.get(submitTask.id)}
          accessToken={accessToken}
          onClose={() => closeSubmitModal()}
          onSuccess={() => {
              load();
          }}
        />
      )}

      

      {showMoreModalOpen && (
        <ModuleShowMoreModal
          description={moduleData?.description}
          resources={resources.filter((r: any) => !r.lesson && !r.lessonId)}
          onClose={() => setShowMoreModalOpen(false)}
          onVisitResource={(id) => { progressService.visitResource(id, accessToken).catch(() => { }); }}
          isTrainee={true}
        />
      )}

      {/* View Details Modal (evaluated tasks) — rendered via portal */}
      {viewDetailsTarget && (() => {
        const { assignment, submission } = viewDetailsTarget;

        const evaluatorName = submission.evaluatedBy?.firstName
          ? `${submission.evaluatedBy.firstName} ${submission.evaluatedBy.lastName || ''}`.trim()
          : submission.evaluatedBy?.name || 'Trainer';

        const maxPoints = assignment.maxScore || 100;
        const gainedPoints = submission.score || 0;
        let questions = assignment.questions?.length > 0 ? assignment.questions : (assignment.mcqConfig?.questions || []);
        const isMcq = assignment.assignmentType === 'MCQ';

        // Legacy single-question MCQ fallback
        if (questions.length === 0 && isMcq && assignment.mcqConfig?.options) {
          questions = [{
            questionText: assignment.instruction || assignment.title || 'Question',
            options: assignment.mcqConfig.options,
            points: assignment.maxScore || 100,
            correctIndex: assignment.mcqConfig.correctIndex
          }];
        }

        let parsedAnswers: any = {};
        const rawText = submission.submissionText || '';
        try {
          if (rawText.trim().startsWith('{')) {
            parsedAnswers = JSON.parse(rawText);
          }
        } catch(e) {}

        // Fallback for missing raw text in parsed JSON
        const displayRawText = parsedAnswers.raw ? parsedAnswers.raw : 
          (rawText.trim().startsWith('{') ? 'JSON Submission (See parsed answers)' : rawText);

        return createPortal(
          <div style={{ position: 'fixed', inset: 0, background: 'rgba(15,23,42,0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, backdropFilter: 'blur(4px)' }}>
            <div style={{ background: '#fff', width: '700px', maxWidth: '95vw', borderRadius: '20px', maxHeight: '92vh', display: 'flex', flexDirection: 'column', boxShadow: '0 25px 80px rgba(0,0,0,0.22)' }}>

              <div style={{ padding: '22px 26px', borderBottom: '1px solid #f1f5f9', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexShrink: 0 }}>
                <div>
                  <h3 style={{ margin: 0, fontSize: '17px', fontWeight: 800, color: '#0f172a' }}>📄 Evaluation Details: {assignment.title}</h3>
                  <p style={{ margin: '4px 0 0', fontSize: '12px', color: '#64748b' }}>Score: {gainedPoints} / {maxPoints} pts</p>
                </div>
                <button onClick={() => setViewDetailsTarget(null)} style={{ background: '#f1f5f9', border: 'none', borderRadius: '8px', width: '32px', height: '32px', cursor: 'pointer', fontSize: '18px', color: '#64748b', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>×</button>
              </div>

              <div style={{ padding: '22px 26px', overflowY: 'auto', flex: 1 }}>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '16px', marginBottom: '24px', background: '#f8fafc', padding: '16px', borderRadius: '12px', border: '1px solid #e2e8f0' }}>
                  <div>
                    <div style={{ fontSize: '11px', color: '#64748b', fontWeight: 600, textTransform: 'uppercase' }}>Assigned By</div>
                    <div style={{ fontSize: '14px', color: '#0f172a', fontWeight: 500, marginTop: '4px' }}>
                      {assignment.createdBy?.firstName
                        ? `${assignment.createdBy.firstName} ${assignment.createdBy.lastName || ''}`.trim()
                        : 'Trainer'}
                    </div>
                  </div>
                  <div>
                    <div style={{ fontSize: '11px', color: '#64748b', fontWeight: 600, textTransform: 'uppercase' }}>Evaluated By</div>
                    <div style={{ fontSize: '14px', color: '#0f172a', fontWeight: 500, marginTop: '4px' }}>{evaluatorName}</div>
                  </div>
                </div>

                {submission.feedback && (
                  <div style={{ marginBottom: '24px', background: '#f0fdf4', padding: '16px', borderRadius: '12px', border: '1px solid #bbf7d0' }}>
                    <div style={{ fontSize: '12px', color: '#166534', fontWeight: 700, marginBottom: '6px' }}>Trainer Feedback</div>
                    <p style={{ margin: 0, fontSize: '13px', color: '#14532d', lineHeight: 1.5 }}>{submission.feedback}</p>
                  </div>
                )}

                <h4 style={{ margin: '0 0 16px', fontSize: '15px', color: '#0f172a' }}>Answers & Questions ({questions.length || 1})</h4>

                {questions.length > 0 ? (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                    {questions.map((q: any, idx: number) => {
                      const ansObj = parsedAnswers.answers || parsedAnswers || {};
                      const textAnsObj = parsedAnswers.textAnswers || parsedAnswers || {};

                      let userAnswer = '';
                      if (isMcq) {
                        const picked = ansObj[idx];
                        userAnswer = Array.isArray(picked)
                          ? picked.map((i: number) => q.options?.[i]).filter(Boolean).join(', ') || 'No answer provided'
                          : typeof picked === 'number' && q.options
                            ? q.options[picked]
                            : 'No answer provided';
                      } else {
                        const extracted = textAnsObj[idx] || ansObj[idx] || parsedAnswers[idx];
                        userAnswer =
                          (extracted && typeof extracted === 'string' ? extracted : parsedAnswers.raw || rawText) ||
                          'No answer provided';
                      }

                      const qPoints = q.maxPoints || q.points || 10;
                      const qText = (q.text || q.questionText || q.question || '').replace(/\\n/g, '\n').replace(/\n$/, '').trim();
                      const isThisMcq = isMcq || (q.type || q.questionType || '').toUpperCase() === 'MCQ';

                      return (
                        <div key={idx} style={{ border: '1px solid #e2e8f0', borderRadius: '12px', padding: '16px' }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '12px' }}>
                            <strong style={{ fontSize: '13px', color: '#0f172a', lineHeight: 1.5, whiteSpace: 'pre-wrap' }}>
                              Q{idx + 1}: {qText}
                            </strong>
                            <span style={{ fontSize: '12px', color: '#6366f1', fontWeight: 600, background: '#e0e7ff', padding: '2px 8px', borderRadius: '999px', flexShrink: 0 }}>{qPoints} pts</span>
                          </div>

                          {isThisMcq && q.options && q.options.length > 0 ? (
                            <div style={{ marginTop: '12px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                              <span style={{ fontWeight: 600, color: '#64748b', fontSize: '11px', textTransform: 'uppercase', marginBottom: '2px' }}>Options & Evaluation:</span>
                              {q.options.map((opt: string, optIdx: number) => {
                                const ansVal = ansObj[idx];
                                const isSelected = Array.isArray(ansVal) ? ansVal.includes(optIdx) : ansVal === optIdx;
                                const isCorrect = Array.isArray(q.correctIndex) ? q.correctIndex.includes(optIdx) : q.correctIndex === optIdx;
                                
                                let bg = '#f8fafc';
                                let border = '1px solid #e2e8f0';
                                let icon = '○';
                                let textColor = '#334155';
                                
                                if (isSelected && isCorrect) {
                                  bg = '#f0fdf4';
                                  border = '1px solid #22c55e';
                                  icon = '✓';
                                  textColor = '#166534';
                                } else if (isSelected && !isCorrect) {
                                  bg = '#fef2f2';
                                  border = '1px solid #ef4444';
                                  icon = '✗';
                                  textColor = '#991b1b';
                                } else if (!isSelected && isCorrect) {
                                  bg = '#f0fdf4';
                                  border = '1px dashed #22c55e';
                                  icon = '✓';
                                  textColor = '#166534';
                                }
                                
                                return (
                                  <div key={optIdx} style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '10px 14px', background: bg, border, borderRadius: '8px', fontSize: '13px', color: textColor, fontWeight: isSelected || isCorrect ? 600 : 400 }}>
                                    <span style={{ fontSize: '14px', opacity: isSelected || isCorrect ? 1 : 0.4 }}>{icon}</span>
                                    <span>{opt}</span>
                                  </div>
                                );
                              })}
                            </div>
                          ) : (
                            <div style={{ background: '#f8fafc', padding: '12px', borderRadius: '8px', fontSize: '13px', color: '#334155', whiteSpace: 'pre-wrap' }}>
                              <span style={{ fontWeight: 600, color: '#64748b', display: 'block', marginBottom: '4px', fontSize: '11px', textTransform: 'uppercase' }}>Your Answer:</span>
                              {userAnswer}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <div style={{ border: '1px solid #e2e8f0', borderRadius: '12px', padding: '16px' }}>
                    <div style={{ background: '#f8fafc', padding: '12px', borderRadius: '8px', fontSize: '13px', color: '#334155', whiteSpace: 'pre-wrap' }}>
                      <span style={{ fontWeight: 600, color: '#64748b', display: 'block', marginBottom: '4px', fontSize: '11px', textTransform: 'uppercase' }}>Your Submission:</span>
                      {parsedAnswers.raw || rawText}
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>,
          document.body,
        );
      })()}
    </div>
  );
}