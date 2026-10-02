import { createPortal } from "react-dom";
import React, { useState, useEffect } from 'react';
import { curriculumService } from '../../services/curriculumService';
import { RichText } from '../common/RichText';
import DOMPurify from 'dompurify';
import { resolveAssignmentInstructions } from '../../utils/assignmentInstructions';
import { DeadlineDisplay } from '../DeadlineDisplay';
import { renderMultilineText } from '../../utils/textUtils';
import { AssignmentInstructionsGate } from '../common/AssignmentInstructionsGate';

interface TraineeCurriculumViewProps {
  learningPathId: string;
  learningPathTitle: string;
  accessToken: string;
  onBack: () => void;
}

// Determine button state from submission data
function getTaskState(task: any): {
  status: 'not_started' | 'pending_review' | 'accepted_high' | 'needs_resubmit_orange' | 'needs_resubmit_red';
  percentage: number | null;
  score: number | null;
  maxScore: number;
  label: string;
  color: string;
  bg: string;
  border: string;
} {
  const submission = task.userSubmission;
  const maxScore = task.maxScore ?? task.max_score ?? 100;

  if (!submission) {
    return { status: 'not_started', percentage: null, score: null, maxScore, label: 'Start & Submit', color: '#fff', bg: '#4f46e5', border: '#4338ca' };
  }

  // No score yet (pending)
  if (submission.score === null || submission.score === undefined || submission.status === 'Submitted') {
    return { status: 'pending_review', percentage: null, score: null, maxScore, label: '⏳ Pending Review', color: '#b45309', bg: '#fef3c7', border: '#fde68a' };
  }

  const pct = Math.round((submission.score / maxScore) * 100);
  const isRejected = submission.status === 'Rejected';

  if (!isRejected && pct >= 75) {
    return { status: 'accepted_high', percentage: pct, score: submission.score, maxScore, label: `✅ Submitted — ${submission.score}/${maxScore} (${pct}%)`, color: '#166534', bg: '#dcfce7', border: '#86efac' };
  }
  if (!isRejected && pct >= 35) {
    return { status: 'needs_resubmit_orange', percentage: pct, score: submission.score, maxScore, label: `🔄 Resubmit — ${pct}% (improve score)`, color: '#92400e', bg: '#fef3c7', border: '#fcd34d' };
  }
  return { status: 'needs_resubmit_red', percentage: pct, score: submission.score, maxScore, label: `⚠️ Resubmit — ${pct}% (below 35%${isRejected ? ', Needs Improvement' : ''})`, color: '#b91c1c', bg: '#fee2e2', border: '#fca5a5' };
}

export function TraineeCurriculumView({
  learningPathId,
  learningPathTitle,
  accessToken,
  onBack,
}: TraineeCurriculumViewProps) {
  const [modules, setModules] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [expandedModules, setExpandedModules] = useState<Set<string>>(new Set());

  // Task modal state
  const [activeTask, setActiveTask] = useState<any | null>(null);
  const [subjectiveAnswers, setSubjectiveAnswers] = useState<Record<number, string>>({});
  const [singleTextAnswer, setSingleTextAnswer] = useState('');
  const [selectedMcqAnswers, setSelectedMcqAnswers] = useState<Record<number, number | number[]>>({});
  const [attachmentUrl, setAttachmentUrl] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [instructionsOpen, setInstructionsOpen] = useState(true);
  const [isInstructionsGateOpen, setIsInstructionsGateOpen] = useState(false);

  // Tooltip state for chart/progress hover
  const [tooltip, setTooltip] = useState<{ visible: boolean; x: number; y: number; text: string }>({ visible: false, x: 0, y: 0, text: '' });

  const loadCurriculumTree = async () => {
    setIsLoading(true);
    try {
      const data = await curriculumService.fetchModulesByPath(learningPathId, accessToken);
      const mods = Array.isArray(data) ? data : [];
      setModules(mods);
      setExpandedModules(new Set(mods.map((m: any) => m.id)));
    } catch (err: any) {
      alert(err.message || 'Failed to load learning track details.');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => { loadCurriculumTree(); }, [learningPathId]);

  // ─── Compute overall progress ─────────────────────────────────────────────
  const { totalTasks, completedTasks, progressPct } = React.useMemo(() => {
    let total = 0;
    let completed = 0;
    modules.forEach(m => {
      m.lessons?.forEach((l: any) => {
        l.assignments?.forEach((t: any) => {
          total++;
          const state = getTaskState(t);
          if (state.status === 'accepted_high') completed++;
        });
      });
    });
    return { totalTasks: total, completedTasks: completed, progressPct: total > 0 ? Math.round((completed / total) * 100) : 0 };
  }, [modules]);

  // ─── Modal handlers ───────────────────────────────────────────────────────
  const handleOpenTaskModal = (task: any) => {
    setActiveTask(task);
    setInstructionsOpen(true);
    setAttachmentUrl(task.userSubmission?.attachmentUrl || '');
    setSelectedMcqAnswers({});
    setSubjectiveAnswers({});
    setSingleTextAnswer('');
    if (task.userSubmission?.submissionText) {
      try {
        const parsed = JSON.parse(task.userSubmission.submissionText);
        if (parsed.answers) {
          if (task.assignmentType === 'MCQ') setSelectedMcqAnswers(parsed.answers);
          else setSubjectiveAnswers(parsed.answers);
        }
      } catch {
        setSingleTextAnswer(task.userSubmission.submissionText);
      }
    }
  };

  const handleSubmitTask = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeTask || isSubmitting) return;

    let payloadText = '';
    const questionsList = activeTask.mcqConfig?.questions || [];

    if (activeTask.assignmentType === 'MCQ') {
      payloadText = JSON.stringify({ answers: selectedMcqAnswers, raw: singleTextAnswer });
    } else if (questionsList.length > 0) {
      payloadText = JSON.stringify({ answers: subjectiveAnswers, textAnswers: subjectiveAnswers, raw: singleTextAnswer });
    } else {
      payloadText = JSON.stringify({ answers: { 0: singleTextAnswer }, raw: singleTextAnswer });
    }

    if (!payloadText.trim()) {
      alert('Please answer the question(s) before submitting.');
      return;
    }

    setIsSubmitting(true);
    try {
      await curriculumService.submitAssignment(
        { assignmentId: activeTask.id, submissionText: payloadText, attachmentUrl: attachmentUrl || undefined },
        accessToken
      );
      setActiveTask(null);
      await loadCurriculumTree();
    } catch (err: any) {
      alert(err.message || 'Submission failed.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const toggleModule = (id: string) => {
    setExpandedModules(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  // ─── Render ───────────────────────────────────────────────────────────────
  return (
    <div style={{ padding: '24px 32px', maxWidth: '1280px', margin: '0 auto', fontFamily: 'Inter, system-ui, sans-serif' }}>

      {/* BACK BUTTON */}
      <button type="button" onClick={onBack} style={{ fontSize: '13px', color: '#4f46e5', background: 'none', border: 'none', cursor: 'pointer', fontWeight: 600, marginBottom: '20px', padding: '0', display: 'flex', alignItems: 'center', gap: '4px' }}>
        ← Back to All Learning Paths
      </button>

      {/* ── HERO PROGRESS HEADER ── */}
      <div style={{ background: 'linear-gradient(135deg,#4f46e5 0%,#7c3aed 100%)', borderRadius: '16px', padding: '28px 32px', marginBottom: '28px', color: '#fff', position: 'relative', overflow: 'hidden' }}>
        <div style={{ position: 'absolute', top: -40, right: -40, width: '180px', height: '180px', borderRadius: '50%', background: 'rgba(255,255,255,0.06)' }} />
        <div style={{ position: 'absolute', bottom: -30, right: 80, width: '120px', height: '120px', borderRadius: '50%', background: 'rgba(255,255,255,0.04)' }} />

        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '20px', position: 'relative' }}>
          <div>
            <div style={{ fontSize: '11px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', opacity: 0.75, marginBottom: '6px' }}>Learning Path</div>
            <h1 style={{ margin: 0, fontSize: '24px', fontWeight: 800, lineHeight: 1.2 }}>{learningPathTitle}</h1>
            <p style={{ margin: '8px 0 0 0', fontSize: '13px', opacity: 0.8 }}>
              Complete lessons, review resources, and submit your tasks below.
            </p>
          </div>
          {/* Circular progress */}
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '4px' }}>
            <div style={{ position: 'relative', width: '80px', height: '80px' }}>
              <svg width="80" height="80" viewBox="0 0 80 80">
                <circle cx="40" cy="40" r="32" fill="none" stroke="rgba(255,255,255,0.2)" strokeWidth="8" />
                <circle
                  cx="40" cy="40" r="32" fill="none" stroke="#fff" strokeWidth="8"
                  strokeDasharray="201" strokeDashoffset={201 - (201 * progressPct) / 100}
                  strokeLinecap="round" transform="rotate(-90 40 40)"
                  style={{ transition: 'stroke-dashoffset 0.8s ease' }}
                />
              </svg>
              <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
                <span style={{ fontSize: '16px', fontWeight: 800 }}>{progressPct}%</span>
              </div>
            </div>
            <span style={{ fontSize: '11px', opacity: 0.8, fontWeight: 600 }}>Module Progress</span>
          </div>
        </div>

        {/* Stats row */}
        <div style={{ display: 'flex', gap: '24px', marginTop: '20px', flexWrap: 'wrap' }}>
          {[
            { icon: '📦', label: 'Modules', value: modules.length },
            { icon: '✅', label: 'Completed', value: completedTasks },
            { icon: '📝', label: 'Total Tasks', value: totalTasks },
          ].map(stat => (
            <div
              key={stat.label}
              style={{ background: 'rgba(255,255,255,0.12)', borderRadius: '10px', padding: '10px 18px', display: 'flex', gap: '8px', alignItems: 'center', cursor: 'default' }}
              onMouseEnter={e => {
                const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
                setTooltip({ visible: true, x: rect.left + rect.width / 2, y: rect.top, text: `${stat.label}: ${stat.value}` });
              }}
              onMouseLeave={() => setTooltip(t => ({ ...t, visible: false }))}
            >
              <span style={{ fontSize: '16px' }}>{stat.icon}</span>
              <div>
                <div style={{ fontSize: '16px', fontWeight: 800, lineHeight: 1 }}>{stat.value}</div>
                <div style={{ fontSize: '10px', opacity: 0.75, textTransform: 'uppercase', letterSpacing: '0.05em' }}>{stat.label}</div>
              </div>
            </div>
          ))}

          {/* Progress bar */}
          <div style={{ flex: 1, minWidth: '160px', display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11px', opacity: 0.8, marginBottom: '4px' }}>
              <span>Progress</span><span>{completedTasks}/{totalTasks} tasks</span>
            </div>
            <div style={{ height: '8px', background: 'rgba(255,255,255,0.2)', borderRadius: '9999px', overflow: 'hidden' }}>
              <div style={{ height: '100%', width: `${progressPct}%`, background: '#fff', borderRadius: '9999px', transition: 'width 0.8s ease' }} />
            </div>
          </div>
        </div>
      </div>

      {/* ── MODULES ── */}
      {isLoading ? (
        <div style={{ textAlign: 'center', padding: '60px', color: '#94a3b8' }}>
          <div style={{ fontSize: '32px', marginBottom: '12px', animation: 'spin 1s linear infinite' }}>⏳</div>
          Loading curriculum...
        </div>
      ) : modules.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '60px', background: '#f8fafc', borderRadius: '16px', border: '2px dashed #e2e8f0' }}>
          <div style={{ fontSize: '40px', marginBottom: '12px' }}>📭</div>
          <div style={{ fontWeight: 700, color: '#475569' }}>No modules yet</div>
          <div style={{ fontSize: '13px', color: '#94a3b8', marginTop: '4px' }}>Your trainer hasn't added content yet.</div>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          {modules.map((module: any, mIdx: number) => {
            const isOpen = expandedModules.has(module.id);
            const lessons = module.lessons || [];
            const allTasks = lessons.flatMap((l: any) => l.assignments || []).concat(module.assignments || []);
            const moduleDone = allTasks.filter((t: any) => getTaskState(t).status === 'accepted_high').length;
            const moduleTotal = allTasks.length;
            const modulePct = moduleTotal > 0 ? Math.round((moduleDone / moduleTotal) * 100) : 0;

            return (
              <div key={module.id} style={{ background: '#fff', borderRadius: '14px', border: '1px solid #f1f5f9', boxShadow: '0 2px 8px rgba(0,0,0,0.05)', overflow: 'hidden' }}>
                {/* Module header */}
                <div
                  style={{ padding: '16px 22px', cursor: 'pointer', display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: isOpen ? '1px solid #f1f5f9' : 'none' }}
                  onClick={() => toggleModule(module.id)}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
                    <div style={{
                      width: '42px', height: '42px', borderRadius: '10px', flexShrink: 0,
                      background: modulePct >= 100 ? 'linear-gradient(135deg,#22c55e,#16a34a)' : 'linear-gradient(135deg,#6366f1,#4f46e5)',
                      display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontWeight: 800, fontSize: '16px',
                    }}>
                      {modulePct >= 100 ? '✓' : mIdx + 1}
                    </div>
                    <div style={{ flex: 1, minWidth: 0, paddingRight: '16px' }}>
                      <div style={{ fontWeight: 700, fontSize: '15px', color: '#0f172a' }}>Module {mIdx + 1}: {module.title}</div>
                      {module.description && !isOpen && (
                        <div style={{ fontSize: '12px', color: '#475569', marginTop: '6px', maxHeight: '36px', overflow: 'hidden', textOverflow: 'ellipsis', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', lineHeight: 1.5 }}>
                          <div style={{ margin: 0 }} dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(module.description.replace(/<[^>]*>?/gm, ' ').substring(0, 150) + (module.description.length > 150 ? '...' : '')) }} />
                        </div>
                      )}
                      <div style={{ fontSize: '12px', color: '#64748b', marginTop: '6px' }}>
                        {lessons.length} lessons · {moduleDone}/{moduleTotal} tasks completed
                      </div>
                    </div>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                    <div style={{ textAlign: 'right' }}>
                      <div style={{ fontSize: '14px', fontWeight: 800, color: modulePct >= 100 ? '#16a34a' : '#4f46e5' }}>{modulePct}%</div>
                      <div style={{ width: '80px', height: '4px', background: '#f1f5f9', borderRadius: '9999px', overflow: 'hidden', marginTop: '4px' }}>
                        <div style={{ height: '100%', width: `${modulePct}%`, background: modulePct >= 100 ? '#22c55e' : '#6366f1', borderRadius: '9999px', transition: 'width 0.6s ease' }} />
                      </div>
                    </div>
                    <span style={{ color: '#94a3b8', fontSize: '18px', transform: isOpen ? 'rotate(180deg)' : 'none', transition: 'transform 0.2s', display: 'inline-block' }}>▾</span>
                  </div>
                </div>

                {/* Module body */}
                {isOpen && (
                  <div style={{ padding: '18px 22px', background: '#fafcff' }}>
                    {/* Module Description and Resources */}
                    {(module.description || (module.resources && module.resources.length > 0)) && (
                      <div style={{ marginBottom: '20px', padding: '16px', background: '#fff', borderRadius: '10px', border: '1px solid #e2e8f0' }}>
                        {module.description && (
                          <div style={{ marginBottom: module.resources?.length > 0 ? '16px' : '0' }}>
                            <div style={{ fontSize: '12px', fontWeight: 700, color: '#64748b', textTransform: 'uppercase', marginBottom: '8px', letterSpacing: '0.05em' }}>
                              Module Description
                            </div>
                            <div style={{ fontSize: '13px', color: '#334155', lineHeight: 1.6 }}>
                              <RichText content={module.description} />
                            </div>
                          </div>
                        )}
                        {module.resources && module.resources.length > 0 && (
                          <div>
                            <div style={{ fontSize: '12px', fontWeight: 700, color: '#64748b', textTransform: 'uppercase', marginBottom: '8px', letterSpacing: '0.05em' }}>
                              Module Resources
                            </div>
                            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '10px' }}>
                              {module.resources.filter((r: any) => !r.lessonId && !r.lesson).map((res: any, idx: number) => (
                                <a
                                  key={res.id || idx}
                                  href={res.url}
                                  target="_blank"
                                  rel="noreferrer"
                                  style={{ padding: '8px 14px', background: '#f8fafc', border: '1px solid #cbd5e1', color: '#0f172a', borderRadius: '8px', textDecoration: 'none', fontSize: '12px', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '6px', transition: 'all 0.2s' }}
                                  onMouseEnter={e => { e.currentTarget.style.borderColor = '#94a3b8'; e.currentTarget.style.background = '#f1f5f9'; }}
                                  onMouseLeave={e => { e.currentTarget.style.borderColor = '#cbd5e1'; e.currentTarget.style.background = '#f8fafc'; }}
                                >
                                  🔗 {res.title}
                                </a>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>
                    )}

                    {lessons.map((lesson: any, lIdx: number) => (
                      <div key={lesson.id} style={{ marginBottom: '16px', border: '1px solid #f1f5f9', borderRadius: '10px', overflow: 'hidden', background: '#fff' }}>
                        {/* Lesson header */}
                        <div style={{ padding: '12px 16px', background: 'linear-gradient(90deg,#ede9fe,#f5f3ff)', borderBottom: '1px solid #e8e4f9', display: 'flex', alignItems: 'center', gap: '10px' }}>
                          <span style={{ width: '28px', height: '28px', borderRadius: '50%', background: '#6366f1', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '12px', fontWeight: 700, flexShrink: 0 }}>
                            {lIdx + 1}
                          </span>
                          <strong style={{ fontSize: '14px', color: '#3730a3' }}>📖 {lesson.title}</strong>
                          {lesson.durationMinutes && (
                            <span style={{ fontSize: '11px', color: '#6d28d9', background: 'rgba(255,255,255,0.7)', padding: '2px 8px', borderRadius: '6px', marginLeft: 'auto' }}>
                              ⏱️ {lesson.durationMinutes} min
                            </span>
                          )}
                        </div>

                        {/* Lesson content */}
                        <div style={{ padding: '14px 16px' }}>
                          {/* Resource links */}
                          {(lesson.videoUrl || lesson.articleUrl || (lesson.videos && lesson.videos.length > 0)) && (
                            <div style={{ display: 'flex', gap: '10px', marginBottom: '14px', flexWrap: 'wrap' }}>
                              {lesson.videoUrl && (
                                <a href={lesson.videoUrl} target="_blank" rel="noreferrer" style={{ padding: '7px 14px', background: '#fee2e2', color: '#dc2626', borderRadius: '8px', textDecoration: 'none', fontSize: '12px', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '6px', transition: 'all 0.15s' }}>
                                  ▶ Watch Video Tutorial
                                </a>
                              )}
                              {lesson.videos?.map((v: any, i: number) => (
                                <a key={`vid-${i}`} href={v.url} target="_blank" rel="noreferrer" style={{ padding: '7px 14px', background: '#fee2e2', color: '#dc2626', borderRadius: '8px', textDecoration: 'none', fontSize: '12px', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '6px', transition: 'all 0.15s' }}>
                                  ▶ {v.title || 'Watch Video Tutorial'}
                                </a>
                              ))}
                              {lesson.articleUrl && (
                                <a href={lesson.articleUrl} target="_blank" rel="noreferrer" style={{ padding: '7px 14px', background: '#dbeafe', color: '#2563eb', borderRadius: '8px', textDecoration: 'none', fontSize: '12px', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '6px', transition: 'all 0.15s' }}>
                                  📄 Read Reference Article
                                </a>
                              )}
                            </div>
                          )}

                          {/* Render Lesson Resources */}
                          {lesson.resources && lesson.resources.length > 0 && (
                            <div style={{ display: 'flex', gap: '10px', marginBottom: '14px', flexWrap: 'wrap' }}>
                              {lesson.resources.map((res: any, idx: number) => (
                                <a
                                  key={`res-${idx}`}
                                  href={res.url}
                                  target="_blank"
                                  rel="noreferrer"
                                  style={{ padding: '7px 14px', background: '#f8fafc', border: '1px solid #cbd5e1', color: '#0f172a', borderRadius: '8px', textDecoration: 'none', fontSize: '12px', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '6px', transition: 'all 0.2s' }}
                                  onMouseEnter={e => { e.currentTarget.style.borderColor = '#94a3b8'; e.currentTarget.style.background = '#f1f5f9'; }}
                                  onMouseLeave={e => { e.currentTarget.style.borderColor = '#cbd5e1'; e.currentTarget.style.background = '#f8fafc'; }}
                                >
                                  🔗 {res.title}
                                </a>
                              ))}
                            </div>
                          )}

                          {/* Fallback to Module resources with matching lessonId (if not nested) */}
                          {module.resources && module.resources.filter((r: any) => String(r.lessonId) === String(lesson.id)).length > 0 && (
                            <div style={{ display: 'flex', gap: '10px', marginBottom: '14px', flexWrap: 'wrap' }}>
                              {module.resources.filter((r: any) => String(r.lessonId) === String(lesson.id)).map((res: any, idx: number) => (
                                <a
                                  key={`modres-${idx}`}
                                  href={res.url}
                                  target="_blank"
                                  rel="noreferrer"
                                  style={{ padding: '7px 14px', background: '#f8fafc', border: '1px solid #cbd5e1', color: '#0f172a', borderRadius: '8px', textDecoration: 'none', fontSize: '12px', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '6px', transition: 'all 0.2s' }}
                                  onMouseEnter={e => { e.currentTarget.style.borderColor = '#94a3b8'; e.currentTarget.style.background = '#f1f5f9'; }}
                                  onMouseLeave={e => { e.currentTarget.style.borderColor = '#cbd5e1'; e.currentTarget.style.background = '#f8fafc'; }}
                                >
                                  🔗 {res.title}
                                </a>
                              ))}
                            </div>
                          )}

                          {/* Tasks */}
                          {lesson.assignments?.length > 0 ? (
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                              {lesson.assignments.map((task: any) => {
                                const state = getTaskState(task);
                                const isPending = state.status === 'pending_review';
                                const isAccepted = state.status === 'accepted_high';
                                const canSubmit = !isAccepted && !isPending;

                                return (
                                  <div key={task.id} style={{ padding: '14px 16px', background: '#fff', border: '1px solid #f1f5f9', borderRadius: '10px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '12px', boxShadow: '0 1px 3px rgba(0,0,0,0.04)' }}>
                                    <div style={{ flex: 1, minWidth: 0 }}>
                                      <div style={{ fontWeight: 700, fontSize: '14px', color: '#0f172a', marginBottom: '4px' }}>
                                        📝 {task.title}
                                      </div>
                                      <div style={{ display: 'flex', gap: '8px', alignItems: 'center', flexWrap: 'wrap' }}>
                                        <span style={{ fontSize: '11px', color: '#94a3b8' }}>Max: {task.maxScore ?? 100} pts</span>
                                        {(task.computedDeadline || task.durationValue) && (
                                          <span style={{ fontSize: '11px', color: '#94a3b8' }}>· {task.computedDeadline ? `Due: ${new Date(task.computedDeadline).toLocaleDateString()}` : `Duration: ${task.durationValue} ${task.durationUnit}`}</span>
                                        )}
                                        {task.assignmentType && (
                                          <span style={{ fontSize: '10px', fontWeight: 700, background: task.assignmentType === 'MCQ' ? '#fef3c7' : '#ede9fe', color: task.assignmentType === 'MCQ' ? '#b45309' : '#6d28d9', padding: '2px 7px', borderRadius: '4px' }}>
                                            {task.assignmentType}
                                          </span>
                                        )}
                                      </div>
                                    </div>

                                    {/* Status / Action button */}
                                    <div style={{ flexShrink: 0 }}>
                                      {isAccepted ? (
                                        /* GREEN — accepted ≥75% */
                                        <div style={{ padding: '8px 16px', borderRadius: '8px', background: '#dcfce7', border: '1px solid #86efac', color: '#166534', fontWeight: 700, fontSize: '12px', textAlign: 'center' }}>
                                          {state.label}
                                        </div>
                                      ) : isPending ? (
                                        /* YELLOW — pending review */
                                        <div style={{ padding: '8px 16px', borderRadius: '8px', background: '#fef3c7', border: '1px solid #fde68a', color: '#b45309', fontWeight: 700, fontSize: '12px', textAlign: 'center' }}>
                                          {state.label}
                                        </div>
                                      ) : state.status === 'needs_resubmit_orange' ? (
                                        /* ORANGE — below 50%, above 35% */
                                        <button
                                          type="button"
                                          onClick={() => handleOpenTaskModal(task)}
                                          style={{ padding: '8px 16px', borderRadius: '8px', background: state.bg, border: `1px solid ${state.border}`, color: state.color, fontWeight: 700, fontSize: '12px', cursor: 'pointer', transition: 'all 0.15s' }}
                                        >
                                          {state.label}
                                        </button>
                                      ) : state.status === 'needs_resubmit_red' ? (
                                        /* RED — below 35% or rejected */
                                        <button
                                          type="button"
                                          onClick={() => handleOpenTaskModal(task)}
                                          style={{ padding: '8px 16px', borderRadius: '8px', background: '#fee2e2', border: '1px solid #fca5a5', color: '#b91c1c', fontWeight: 700, fontSize: '12px', cursor: 'pointer', transition: 'all 0.15s' }}
                                        >
                                          {state.label}
                                        </button>
                                      ) : (
                                        /* BLUE — not started yet */
                                        <button
                                          type="button"
                                          onClick={() => handleOpenTaskModal(task)}
                                          style={{ padding: '8px 16px', borderRadius: '8px', background: 'linear-gradient(135deg,#6366f1,#4f46e5)', border: 'none', color: '#fff', fontWeight: 700, fontSize: '12px', cursor: 'pointer', boxShadow: '0 2px 6px rgba(99,102,241,0.3)' }}
                                        >
                                          Solve & Submit
                                        </button>
                                      )}
                                    </div>
                                  </div>
                                );
                              })}
                            </div>
                          ) : (
                            <div style={{ padding: '12px', textAlign: 'center', fontSize: '12px', color: '#94a3b8' }}>No tasks assigned to this lesson.</div>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* ─── TASK SUBMISSION MODAL ─────────────────────────────────────────── */}
      {activeTask && createPortal(
        <div className="assignment-modal-overlay" onClick={() => setActiveTask(null)}>
          <div className="assignment-modal-container" onClick={(e) => e.stopPropagation()}>
            <button type="button" className="assignment-modal-close-btn" onClick={() => setActiveTask(null)}>Ã—</button>
            {/* Context Panel */}
            <div className="assignment-modal-context">
              <h3 style={{ margin: '0 0 4px', fontSize: 18, color: '#0f172a' }}>{activeTask.title}</h3>
              <div style={{ fontSize: 12, color: '#64748b', marginBottom: 12 }}>
                {activeTask.assignmentType} Â· {activeTask.lessonTitle || 'Module Task'}
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: 16, background: '#f8fafc', padding: '20px', borderRadius: '12px', border: '1px solid #e2e8f0' }}>
                {activeTask.dependsOnLessonIds?.length > 0 && (
                  <div style={{ display: 'flex', alignItems: 'flex-start', gap: '10px' }}>
                    <span style={{ fontSize: '18px' }}>ðŸ”—</span>
                    <div>
                      <strong style={{ display: 'block', fontSize: 11, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.05em' }}>DEPENDS ON</strong>
                      <div style={{ fontSize: 13, color: '#0f172a', fontWeight: 600 }}>
                        {activeTask.dependsOnLessonIds.length} Prerequisite lessonss(s)
                      </div>
                    </div>
                  </div>
                )}
                {activeTask.createdBy?.firstName && (
                  <div style={{ display: 'flex', alignItems: 'flex-start', gap: '10px' }}>
                    <span style={{ fontSize: '18px' }}>ðŸ‘¤</span>
                    <div>
                      <strong style={{ display: 'block', fontSize: 11, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Assigned By</strong>
                      <div style={{ fontSize: 13, color: '#0f172a', fontWeight: 600 }}>{activeTask.createdBy.firstName} {activeTask.createdBy.lastName}</div>
                    </div>
                  </div>
                )}

                {activeTask.countdownStart === 'onAssignment' ? (
                  <div style={{ display: 'flex', alignItems: 'flex-start', gap: '10px' }}>
                    <span style={{ fontSize: '18px' }}>ðŸ•’</span>
                    <div>
                      <strong style={{ display: 'block', fontSize: 11, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.05em' }}>LP Assigned Time</strong>
                      <div style={{ fontSize: 13, color: '#0f172a', fontWeight: 600 }}>
                        {activeTask.userSubmission?.lpAssignedAt ? new Date(activeTask.userSubmission!.lpAssignedAt!).toLocaleString(undefined, { timeZoneName: 'short' }) : new Date(activeTask.createdAt).toLocaleString(undefined, { timeZoneName: 'short' })}
                      </div>
                    </div>
                  </div>
                ) : (
                  <div style={{ display: 'flex', alignItems: 'flex-start', gap: '10px' }}>
                    <span style={{ fontSize: '18px' }}>ðŸ”“</span>
                    <div>
                      <strong style={{ display: 'block', fontSize: 11, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Unlocked Time</strong>
                      <div style={{ fontSize: 13, color: '#0f172a', fontWeight: 600 }}>
                        {activeTask.userSubmission?.taskUnlockedAt ? new Date(activeTask.userSubmission!.taskUnlockedAt!).toLocaleString(undefined, { timeZoneName: 'short' }) : 'Unlocks after prerequisite lessons'}
                      </div>
                    </div>
                  </div>
                )}

                {activeTask.userSubmission?.deadline && (
                  <div style={{ display: 'flex', alignItems: 'flex-start', gap: '10px' }}>
                    <span style={{ fontSize: '18px' }}>â³</span>
                    <div>
                      <strong style={{ display: 'block', fontSize: 11, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Due Date</strong>
                      <div style={{ fontWeight: 600, color: '#b91c1c' }}>
                        <DeadlineDisplay task={activeTask} submission={activeTask.userSubmission!} />
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Main Form Content */}
            <form onSubmit={handleSubmitTask} className="assignment-modal-content">
              <div className="assignment-modal-scroll">

                {/* Instructions â€” always visible in submit modal, uses trainer's text or falls back to defaults */}
                {(() => {
                  const { hasCustom, content: instructionContent } = resolveAssignmentInstructions(activeTask);
                  return (
                    <>
                      <button type="button" onClick={() => setInstructionsOpen(true)} style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#f0f9ff', border: '1px solid #bae6fd', width: '100%', padding: '14px', cursor: 'pointer', borderRadius: '10px', marginBottom: '24px', color: '#0369a1', fontWeight: 700, fontSize: '14px', transition: 'all 0.2s', gap: '8px' }}>
                        <span style={{ fontSize: '18px' }}>ðŸ“–</span> View Assignment Instructions
                        {!hasCustom && <span style={{ fontSize: 11, color: '#94a3b8', fontWeight: 400, marginLeft: 4 }}>(Default)</span>}
                      </button>
                      {instructionsOpen && (
                        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1100, padding: '20px' }}>
                          <div style={{ background: '#fff', width: '700px', maxWidth: '100%', borderRadius: '12px', overflow: 'hidden', boxShadow: '0 25px 50px -12px rgba(0,0,0,0.25)', display: 'flex', flexDirection: 'column', maxHeight: '85vh' }}>
                            <div style={{ padding: '20px 24px', borderBottom: '1px solid #e2e8f0', display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: '#f8fafc' }}>
                              <h4 style={{ margin: 0, fontSize: '18px', color: '#0f172a', display: 'flex', alignItems: 'center', gap: '8px' }}>
                                <span>ðŸ“‹</span> Assignment Instructions
                                {!hasCustom && <span style={{ fontSize: 12, color: '#94a3b8', fontWeight: 400, marginLeft: 4 }}>(Default)</span>}
                              </h4>
                              <button type="button" onClick={() => setInstructionsOpen(false)} style={{ background: 'none', border: 'none', fontSize: '24px', color: '#64748b', cursor: 'pointer', padding: '0 4px' }}>&times;</button>
                            </div>
                            <div style={{ padding: '24px', overflowY: 'auto', fontSize: '14px', color: '#334155', lineHeight: 1.6 }}>
                              <RichText content={instructionContent} emptyStateText="No instructions provided." />
                            </div>
                            <div style={{ padding: '16px 24px', borderTop: '1px solid #e2e8f0', background: '#f8fafc', display: 'flex', justifyContent: 'flex-end' }}>
                              <button type="button" onClick={() => setInstructionsOpen(false)} style={{ padding: '10px 20px', background: '#0f172a', color: '#fff', border: 'none', borderRadius: '6px', fontWeight: 600, cursor: 'pointer' }}>Close &amp; Continue</button>
                            </div>
                          </div>
                        </div>
                      )}
                    </>
                  );
                })()}


                {/* Resource URL */}
                {activeTask.externalUrl && (
                  <a
                    href={activeTask.externalUrl}
                    target="_blank"
                    rel="noreferrer"
                    style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '12px 16px', background: '#eff6ff', border: '1px solid #bfdbfe', borderRadius: '12px', textDecoration: 'none', fontSize: '14px', color: '#2563eb', fontWeight: 600, marginBottom: '24px' }}
                  >
                    ðŸ”— Reference Resource: {activeTask.externalUrl}
                  </a>
                )}

                {(() => {
                  const questionsArray = activeTask.questions?.length > 0 ? activeTask.questions : (activeTask.mcqConfig?.questions || []);
                  const sub = activeTask.userSubmission;
                  const qScores = sub?.questionScores || sub?.aiQuestionScores || {};

                  let prevAnswersParsed: Record<string, any> = {};
                  if (sub?.singleTextAnswer) {
                    try {
                      const parsed = JSON.parse(sub.singleTextAnswer);
                      if (parsed.answers) prevAnswersParsed = parsed.answers;
                    } catch (e) {
                      // ignore
                    }
                  }

                  return questionsArray.length > 0 ? (
                    questionsArray.map((q: any, idx: number) => {
                      const hasOptions = q.options && q.options.length > 0;
                      const qId = q.id || String(idx);
                      const previousEvaluation = qScores[qId] || qScores[idx];
                      const prevAnsVal = prevAnswersParsed[idx] ?? prevAnswersParsed[String(idx)];

                      const isResubmit = sub && sub.status !== 'AVAILABLE' && sub.status !== 'LOCKED' && sub.status !== 'Pending';
                      const hasPrevAnswer = isResubmit && prevAnsVal !== undefined && prevAnsVal !== '';

                      const isMcq = (q.type || q.questionType || '').toUpperCase() === 'MCQ' || (activeTask.assignmentType === 'MCQ' && hasOptions);

                      return (
                        <div key={idx} style={{ marginBottom: 24, padding: 24, background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: 12 }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 16 }}>
                            <div style={{ display: 'flex', gap: '8px', flex: 1 }}>
                              <strong style={{ fontSize: 16, color: '#0f172a' }}>Q{idx + 1}.</strong>
                              <div style={{ fontSize: 16, color: '#0f172a', fontWeight: 'bold' }}>
                                {renderMultilineText(q.text || q.questionText || q.question || '') || 'No question text'}
                              </div>
                            </div>
                            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '6px' }}>
                              <span style={{ fontSize: 13, color: '#64748b', fontWeight: 700, background: '#e2e8f0', padding: '4px 10px', borderRadius: 6, whiteSpace: 'nowrap', marginLeft: 12 }}>
                                Max: {q.maxPoints || 10} pts
                              </span>
                              {isResubmit && previousEvaluation !== undefined && (
                                <span style={{ fontSize: 12, color: '#991b1b', fontWeight: 700, background: '#fee2e2', padding: '4px 10px', borderRadius: 6, whiteSpace: 'nowrap', border: '1px solid #fca5a5' }}>
                                  Scored: {typeof previousEvaluation === 'object' ? previousEvaluation.score : previousEvaluation} pts
                                </span>
                              )}
                            </div>
                          </div>

                          {hasPrevAnswer && (
                            <div style={{ background: '#fff', padding: '12px 16px', borderRadius: '8px', border: '1px dashed #94a3b8', marginBottom: '16px' }}>
                              <span style={{ fontSize: '11px', fontWeight: 700, color: '#64748b', textTransform: 'uppercase', display: 'block', marginBottom: '6px', letterSpacing: '0.05em' }}>Your Previous Answer</span>
                              <div style={{ fontSize: '14px', color: '#334155', whiteSpace: 'pre-wrap' }}>
                                {isMcq ? (q.options?.[Number(prevAnsVal)] || 'None') : prevAnsVal}
                              </div>
                            </div>
                          )}

                          {isResubmit && previousEvaluation && previousEvaluation.feedback && (
                            <div style={{ marginBottom: 16, padding: '12px 16px', background: '#fffbeb', border: '1px solid #fde68a', borderRadius: 8, fontSize: 13, color: '#92400e', display: 'flex', gap: '8px' }}>
                              <span style={{ fontSize: '16px' }}>ðŸ’¬</span>
                              <div>
                                <strong style={{ display: 'block', fontSize: '11px', textTransform: 'uppercase', marginBottom: '4px' }}>Trainer Feedback</strong>
                                {previousEvaluation.feedback}
                              </div>
                            </div>
                          )}

                          {(q.type || q.questionType || '').toUpperCase() === 'MCQ' || (activeTask.assignmentType === 'MCQ' && hasOptions) ? (
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
                                          ? (Array.isArray(selectedMcqAnswers[idx]) ? (selectedMcqAnswers[idx] as any as number[]).includes(oi) : false)
                                          : selectedMcqAnswers[idx] === oi
                                      }
                                      onChange={() => {
                                        if (q.allowMultipleCorrect) {
                                          setSelectedMcqAnswers(prev => {
                                            const current = Array.isArray(prev[idx]) ? (prev[idx] as any as number[]) : [];
                                            if (current.includes(oi)) {
                                              return { ...prev, [idx]: current.filter(o => o !== oi) };
                                            } else {
                                              return { ...prev, [idx]: [...current, oi] };
                                            }
                                          });
                                        } else {
                                          setSelectedMcqAnswers(prev => ({ ...prev, [idx]: oi }));
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
                              value={subjectiveAnswers[idx] || ''}
                              onChange={(e) => setSubjectiveAnswers((prev) => ({ ...prev, [idx]: e.target.value }))}
                              placeholder="Type your answer here..."
                              style={{ width: '100%', marginTop: 16, padding: 12, borderRadius: 8, border: '1px solid #cbd5e1', fontSize: 14, fontFamily: 'inherit', resize: 'vertical' }}
                            />
                          )}
                        </div>
                      )
                    })
                  ) : (
                    <textarea
                      required
                      rows={8}
                      value={singleTextAnswer}
                      onChange={(e) => setSingleTextAnswer(e.target.value)}
                      placeholder="Write your submission..."
                      style={{ width: '100%', padding: 16, borderRadius: 12, border: '1px solid #cbd5e1', marginBottom: 12, fontSize: 14, fontFamily: 'inherit', resize: 'vertical' }}
                    />
                  );
                })()}

                {/* Attachment URL */}
                <div>
                  <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, color: '#374151', marginBottom: '6px' }}>
                    Attachment URL <span style={{ fontSize: '11px', color: '#94a3b8', fontWeight: 400 }}>(Optional â€” GitHub / Google Drive / Workspace)</span>
                  </label>
                  <input
                    type="url"
                    className="attachment-field"
                    placeholder="https://github.com/..."
                    value={attachmentUrl}
                    onChange={(e) => setAttachmentUrl(e.target.value)}
                    style={{ width: '100%', padding: '10px 12px', borderRadius: '10px', border: '1.5px solid #e2e8f0', fontSize: '13px', outline: 'none' }}
                  />
                </div>
              </div>

              <div className="assignment-modal-footer">
                {(() => {
                  const deadlineDate = activeTask.userSubmission?.deadline ? new Date(activeTask.userSubmission!.deadline!).getTime() : null;
                  const isExpired = deadlineDate && new Date().getTime() > deadlineDate;

                  return (
                    <>
                      <button
                        type="button"
                        onClick={() => {
                          setActiveTask(null);
                        }}
                        style={{ padding: '10px 20px', borderRadius: 8, border: 'none', background: '#f1f5f9', color: '#475569', fontWeight: 600, cursor: 'pointer' }}
                      >
                        Cancel
                      </button>
                      <button
                        type="submit"
                        disabled={isSubmitting || !!isExpired}
                        style={{ padding: '10px 24px', borderRadius: 8, border: 'none', background: isExpired ? '#94a3b8' : '#4f46e5', color: '#fff', fontWeight: 700, cursor: isExpired ? 'not-allowed' : 'pointer' }}
                      >
                        {isExpired ? 'Expired' : isSubmitting ? 'Submitting...' : 'Submit for Evaluation'}
                      </button>
                    </>
                  );
                })()}
              </div>
            </form>
            {isInstructionsGateOpen && (
              <AssignmentInstructionsGate
                assignment={activeTask}
                onContinue={() => setIsInstructionsGateOpen(false)}
                onCancel={() => { setIsInstructionsGateOpen(false); setActiveTask(null); }}
              />
            )}
          </div>
        </div>
        , document.body)}

      {/* ─── FLOATING TOOLTIP ─── */}
      {tooltip.visible && (
        <div style={{ position: 'fixed', top: tooltip.y - 38, left: tooltip.x - 50, background: '#1e293b', color: '#fff', padding: '5px 12px', borderRadius: '8px', fontSize: '12px', fontWeight: 600, pointerEvents: 'none', zIndex: 2000, boxShadow: '0 4px 12px rgba(0,0,0,0.2)', whiteSpace: 'nowrap', transform: 'translateX(-50%)' }}>
          {tooltip.text}
          <div style={{ position: 'absolute', bottom: '-5px', left: '50%', transform: 'translateX(-50%)', width: '0', height: '0', borderLeft: '5px solid transparent', borderRight: '5px solid transparent', borderTop: '5px solid #1e293b' }} />
        </div>
      )}
    </div>
  );
}
