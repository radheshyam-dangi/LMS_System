import React, { useState, useEffect } from "react";
import { useParams } from "react-router-dom";
import { learningPathService } from "../../services/learningPathService";
import { curriculumService } from "../../services/curriculumService";
import { progressService } from "../../services/lmsApi";
import { assignmentService } from "../../services/assignmentService";
import { useNotifications } from "../../context/NotificationContext";
import "./ModulesManagement.css";

interface ModulesProps {
  currentPathId: string;
  currentPathTitle: string;
  userRole: 'Admin' | 'Trainer' | 'Trainee';
  accessToken: string;
  onBack: () => void;
}

export function ModulesManagementSection({
  currentPathId,
  currentPathTitle,
  userRole,
  accessToken,
  onBack,
}: ModulesProps) {
  const { moduleId: urlModuleId } = useParams<{ moduleId?: string }>();
  const isTrainerOrAdmin = userRole === 'Admin' || userRole === 'Trainer';
  const isTrainee = userRole === 'Trainee';
  const { refresh: refreshNotifications } = useNotifications();

  // ── List-level state ──────────────────────────────────────────────────────
  const [allPaths, setAllPaths] = useState<any[]>([]);
  const [selectedPathId, setSelectedPathId] = useState<string>(currentPathId);
  const [selectedPathTitle, setSelectedPathTitle] = useState<string>(currentPathTitle);
  const [modules, setModules] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  // ── Drill-in: which module is open in detail view ─────────────────────────
  const [openModuleId, setOpenModuleId] = useState<string | null>(null);
  const [openModuleData, setOpenModuleData] = useState<any | null>(null);
  const [moduleLoading, setModuleLoading] = useState(false);

  // ── Progress state (for Trainee) ──────────────────────────────────────────
  const [progressStats, setProgressStats] = useState<any>(null);
  const [mySubs, setMySubs] = useState<any[]>([]);

  // ── Detail-view tab ───────────────────────────────────────────────────────
  const [activeTab, setActiveTab] = useState<'Lessons' | 'Tasks' | 'Resources' | 'Assessments'>('Lessons');

  // ── New Module modal ──────────────────────────────────────────────────────
  const [showNewModuleModal, setShowNewModuleModal] = useState(false);
  const [moduleTitle, setModuleTitle] = useState('');
  const [moduleDescription, setModuleDescription] = useState('');
  const [moduleResourceUrl, setModuleResourceUrl] = useState('');
  const [moduleLevel, setModuleLevel] = useState('Beginner');
  const [moduleObjectives, setModuleObjectives] = useState('');
  const [moduleOutcomes, setModuleOutcomes] = useState('');
  const [moduleKeyPoints, setModuleKeyPoints] = useState('');
  const [moduleDurationWeeks, setModuleDurationWeeks] = useState(2);
  const [isCreating, setIsCreating] = useState(false);

  // ── Task submission modal (Trainee only) ──────────────────────────────────
  const [submitTask, setSubmitTask] = useState<any | null>(null);
  const [submissionText, setSubmissionText] = useState('');
  const [subjectiveAnswers, setSubjectiveAnswers] = useState<Record<number, string>>({});
  const [mcqAnswers, setMcqAnswers] = useState<Record<number, number>>({});
  const [isSubmitting, setIsSubmitting] = useState(false);

  // ── Load all paths ────────────────────────────────────────────────────────
  useEffect(() => {
    learningPathService.fetchAllPaths(accessToken)
      .then((data: any) => {
        const paths = Array.isArray(data) ? data : [];
        const validPaths = isTrainee
          ? paths.filter((p: any) => p.status?.toLowerCase() !== 'draft' && p.status?.toLowerCase() !== 'upcoming')
          : paths;
        setAllPaths(validPaths);
        if (!selectedPathId && validPaths.length > 0) {
          setSelectedPathId(validPaths[0].id);
          setSelectedPathTitle(validPaths[0].title || validPaths[0].name);
        }
      })
      .catch(() => {});
  }, [accessToken, isTrainee]);

  // ── Load modules when path changes ────────────────────────────────────────
  useEffect(() => {
    if (!selectedPathId) return;
    setIsLoading(true);
    setModules([]);
    curriculumService.fetchModulesByPath(selectedPathId, accessToken)
      .then((data: any) => {
        const mods = Array.isArray(data) ? data : [];
        setModules(mods);
        if (isTrainee && !openModuleId && mods.length > 0) {
          void openModule(mods[0].id);
        }
      })
      .catch(() => setModules([]))
      .finally(() => setIsLoading(false));
  }, [selectedPathId, accessToken, isTrainee]);

  // ── Load progress stats once (for Trainee) ────────────────────────────────
  useEffect(() => {
    if (!isTrainee) return;
    progressService.fetchMyStats(accessToken).then(setProgressStats).catch(() => {});
  }, [accessToken, isTrainee]);

  // ── Drill into a module ───────────────────────────────────────────────────
  const openModule = async (moduleId: string) => {
    setOpenModuleId(moduleId);
    setOpenModuleData(null);
    setModuleLoading(true);
    setActiveTab('Lessons');
    try {
      const [mod, subs] = await Promise.all([
        curriculumService.fetchModuleById(moduleId, accessToken),
        isTrainee
          ? assignmentService.fetchMySubmissions(accessToken).catch(() => [])
          : Promise.resolve([]),
      ]);
      setOpenModuleData(mod);
      setMySubs(Array.isArray(subs) ? subs : []);
    } catch {
      setOpenModuleData(null);
    } finally {
      setModuleLoading(false);
    }
  };

  const closeModule = () => {
    setOpenModuleId(null);
    setOpenModuleData(null);
  };

  // ── Mark lesson watched (Trainee) ─────────────────────────────────────────
  const markLessonWatched = async (lessonId: string) => {
    try {
      await progressService.completeLesson(lessonId, accessToken);
      if (openModuleId) await openModule(openModuleId);
      await progressService.fetchMyStats(accessToken).then(setProgressStats).catch(() => {});
      await refreshNotifications();
    } catch (err: any) {
      alert(err?.message || 'Could not mark lesson as watched.');
    }
  };

  // ── Create module ─────────────────────────────────────────────────────────
  const handleCreateModule = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!moduleTitle.trim()) { alert('Module title is required.'); return; }
    setIsCreating(true);
    try {
      const resources = moduleResourceUrl.trim()
        ? [{ title: 'Resource', url: moduleResourceUrl.trim() }]
        : [];
      await curriculumService.createModule(
        {
          title: moduleTitle,
          description: moduleDescription,
          level: moduleLevel,
          learningPathId: selectedPathId,
          objectives: moduleObjectives,
          outcomes: moduleOutcomes,
          keyPoints: moduleKeyPoints,
          durationWeeks: moduleDurationWeeks,
          durationLabel: `${moduleDurationWeeks} weeks`,
          resources,
        },
        accessToken
      );
      setShowNewModuleModal(false);
      setModuleTitle(''); setModuleDescription(''); setModuleResourceUrl(''); setModuleLevel('Beginner');
      setModuleObjectives(''); setModuleOutcomes(''); setModuleKeyPoints(''); setModuleDurationWeeks(2);
      const data = await curriculumService.fetchModulesByPath(selectedPathId, accessToken);
      setModules(Array.isArray(data) ? data : []);
    } catch (err: any) {
      alert(err.message || 'Failed to create module.');
    } finally {
      setIsCreating(false);
    }
  };

  // ── Task submit ───────────────────────────────────────────────────────────
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!submitTask || isSubmitting) return;
    const questions = submitTask.mcqConfig?.questions || [];
    let text = submissionText;
    if (submitTask.assignmentType === 'MCQ' && questions.length) {
      text = JSON.stringify({ answers: mcqAnswers });
    } else if (questions.length) {
      text = JSON.stringify({ answers: subjectiveAnswers });
    }
    if (!text.trim() || text === '{"answers":{}}') { alert('Please answer the questions before submitting.'); return; }
    setIsSubmitting(true);
    try {
      await curriculumService.submitAssignment({ assignmentId: submitTask.id, submissionText: text }, accessToken);
      setSubmitTask(null);
      setSubmissionText(''); setSubjectiveAnswers({}); setMcqAnswers({});
      if (openModuleId) await openModule(openModuleId);
      await refreshNotifications();
    } catch (err: any) {
      alert(err?.response?.data?.message || err.message || 'Submit failed.');
    } finally {
      setIsSubmitting(false);
    }
  };

  // ── Helpers ───────────────────────────────────────────────────────────────
  const getLevelColor = (level: string = '') => {
    const l = level.toLowerCase();
    if (l === 'beginner') return { bg: '#dcfce7', color: '#166534' };
    if (l === 'intermediate') return { bg: '#fef3c7', color: '#b45309' };
    if (l === 'advanced') return { bg: '#fee2e2', color: '#b91c1c' };
    return { bg: '#f1f5f9', color: '#475569' };
  };

  const completedLessonIds = new Set<string>(
    (progressStats?.completedLessonIds || []).map(String)
  );

  const subByAssignment = React.useMemo(() => {
    const map = new Map<string, any>();
    mySubs.forEach((s) => map.set(s.assignment?.id || s.assignmentId, s));
    return map;
  }, [mySubs]);

  // ─────────────────────────────────────────────────────────────────────────
  // MODULE DETAIL VIEW (when a module is drilled into)
  // ─────────────────────────────────────────────────────────────────────────
  if (openModuleId) {
    if (moduleLoading) {
      return (
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '60vh', flexDirection: 'column', gap: 16 }}>
          <div style={{ width: 40, height: 40, border: '3px solid #e2e8f0', borderTop: '3px solid #6366f1', borderRadius: '50%', animation: 'spin 1s linear infinite' }} />
          <span style={{ color: '#64748b', fontSize: 14 }}>Loading module details...</span>
          <style>{`@keyframes spin{from{transform:rotate(0)}to{transform:rotate(360deg)}}`}</style>
        </div>
      );
    }

    if (!openModuleData) {
      return (
        <div style={{ padding: 40 }}>
          <button type="button" onClick={closeModule} style={{ border: 'none', background: 'none', color: '#4f46e5', fontWeight: 600, cursor: 'pointer', marginBottom: 16 }}>← Back to Modules</button>
          <p style={{ color: '#94a3b8' }}>Module not found.</p>
        </div>
      );
    }

    const lessons = openModuleData?.lessons || [];
    const resources = openModuleData?.resources || [];
    const moduleLevelAssignments = (openModuleData?.assignments || []).filter((a: any) => !a.lessonId);
    const tasks = lessons.flatMap((l: any) =>
      (l.assignments || []).map((a: any) => ({ ...a, lessonTitle: l.title }))
    ).concat(moduleLevelAssignments);

    const completedLessons = lessons.filter((l: any) => completedLessonIds.has(String(l.id))).length;
    const visitedResourceIds = new Set<string>((progressStats?.visitedResourceIds || []).map(String));
    const tasksSubmitted = tasks.filter((t: any) => subByAssignment.has(t.id)).length;
    const tasksScored = tasks.filter((t: any) => {
      const s = subByAssignment.get(t.id);
      return s && typeof s.score === 'number';
    });
    const avgScore = tasksScored.length > 0
      ? Math.round(tasksScored.reduce((sum: number, t: any) => sum + (subByAssignment.get(t.id)?.score || 0), 0) / tasksScored.length)
      : 0;

    const calculatedProgress = lessons.length
      ? Math.round((completedLessons / lessons.length) * 100)
      : 0;
    const progressPercent = calculatedProgress;

    const rawObj = openModuleData?.objectives;
    const objectives: string[] = Array.isArray(rawObj) && rawObj.length
      ? rawObj
      : typeof rawObj === 'string' && rawObj.trim()
        ? rawObj.split('\n').filter(Boolean)
        : [
            'Understand RESTful architecture principles',
            'Design clean, versioned API endpoints',
            'Implement JWT-based authentication flows',
            'Write comprehensive API documentation',
          ];

    const rawOut = openModuleData?.outcomes;
    const outcomes: string[] = Array.isArray(rawOut) && rawOut.length
      ? rawOut
      : typeof rawOut === 'string' && rawOut.trim()
        ? rawOut.split('\n').filter(Boolean)
        : [
            'Build a fully functional REST API with CRUD operations',
            'Secure endpoints with JWT authentication',
            'Handle errors gracefully with proper status codes',
            'Document APIs using OpenAPI / Swagger',
          ];

    const tabLabels: Array<['Lessons' | 'Tasks' | 'Resources' | 'Assessments', string]> = [
      ['Lessons', `Lessons (${completedLessons}/${lessons.length})`],
      ['Tasks', `Tasks (${tasksSubmitted}/${tasks.length})`],
      ['Resources', `Resources (${resources.filter((r: any) => visitedResourceIds.has(String(r.id))).length}/${resources.length})`],
      ['Assessments', 'Assessments'],
    ];

    return (
      <div style={{ background: '#f8fafc', minHeight: '100%', fontFamily: 'Inter, system-ui, sans-serif' }}>

        {/* ── Breadcrumb ── */}
        <div style={{ padding: '16px 32px 0' }}>
          <div style={{ fontSize: 12, color: '#64748b', marginBottom: 8, display: 'flex', alignItems: 'center', gap: 6 }}>
            <button type="button" onClick={onBack} style={{ border: 'none', background: 'none', color: '#4f46e5', fontWeight: 600, cursor: 'pointer', padding: 0, fontSize: 12 }}>
              Learning Paths
            </button>
            <span>›</span>
            <button type="button" onClick={closeModule} style={{ border: 'none', background: 'none', color: '#4f46e5', fontWeight: 600, cursor: 'pointer', padding: 0, fontSize: 12 }}>
              {selectedPathTitle}
            </button>
            <span>›</span>
            <span style={{ color: '#0f172a', fontWeight: 600 }}>{openModuleData.title}</span>
          </div>
        </div>

        {/* ── Purple Gradient Banner ── */}
        <div style={{ background: 'linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%)', color: '#fff', margin: '0 24px', borderRadius: 16, overflow: 'hidden' }}>
          <div style={{ padding: '32px 40px 24px' }}>
            <p style={{ fontSize: 11, opacity: 0.85, margin: '0 0 8px', textTransform: 'uppercase', letterSpacing: '0.08em', fontWeight: 700 }}>
              MODULE · {(openModuleData.level || 'Beginner').toUpperCase()} · {selectedPathTitle.toUpperCase()}
            </p>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 24 }}>
              <div style={{ flex: 1 }}>
                <h1 style={{ fontSize: 28, margin: '0 0 10px', fontWeight: 800, lineHeight: 1.2 }}>{openModuleData.title}</h1>
                <p style={{ margin: 0, opacity: 0.9, fontSize: 14, maxWidth: 680, lineHeight: 1.6 }}>
                  {openModuleData.description || 'Module content and assessments for this learning track.'}
                </p>
              </div>
              <div style={{ textAlign: 'right', flexShrink: 0 }}>
                <div style={{ fontSize: 11, opacity: 0.85, fontWeight: 600 }}>Module Progress</div>
                <div style={{ fontSize: 40, fontWeight: 800, lineHeight: 1 }}>{progressPercent}%</div>
              </div>
            </div>
            {/* Progress bar */}
            <div style={{ width: '100%', height: 6, background: 'rgba(255,255,255,0.25)', borderRadius: 4, marginTop: 22 }}>
              <div style={{ width: `${progressPercent}%`, height: '100%', background: '#fff', borderRadius: 4, transition: 'width 0.6s ease' }} />
            </div>
          </div>

          {/* Stats row */}
          <div style={{ background: 'rgba(255,255,255,0.95)', color: '#0f172a', padding: '16px 40px', display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 16 }}>
            {[
              { icon: '⏱️', label: 'Duration', value: openModuleData.durationLabel || `${openModuleData.durationWeeks || 2} weeks` },
              { icon: '📖', label: 'Lessons', value: isTrainee ? `${completedLessons}/${lessons.length} done` : `${lessons.length} total` },
              { icon: '🎯', label: 'Tasks', value: isTrainee ? `${tasksSubmitted}/${tasks.length} submitted` : `${tasks.length} assigned` },
              { icon: '🏆', label: 'Avg. Score', value: `${avgScore || 87}/100` },
            ].map((m) => (
              <div key={m.label} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <span style={{ fontSize: 22 }}>{m.icon}</span>
                <div>
                  <span style={{ display: 'block', fontSize: 11, color: '#64748b', fontWeight: 500 }}>{m.label}</span>
                  <strong style={{ fontSize: 14, color: '#0f172a' }}>{m.value}</strong>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* ── Body ── */}
        <div style={{ padding: '28px 32px', maxWidth: 1200, margin: '0 auto' }}>

          {/* Objectives + Outcomes */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20, marginBottom: 28 }}>
            <div style={{ background: '#fff', padding: 22, borderRadius: 12, border: '1px solid #e2e8f0', boxShadow: '0 1px 4px rgba(0,0,0,0.04)' }}>
              <h4 style={{ margin: '0 0 14px', color: '#4f46e5', fontSize: 14, fontWeight: 700 }}>◎ Learning Objectives</h4>
              <ul style={{ margin: 0, paddingLeft: 18, color: '#475569', fontSize: 13, lineHeight: 1.9 }}>
                {objectives.map((o, i) => <li key={i}>{o}</li>)}
              </ul>
            </div>
            <div style={{ background: '#fff', padding: 22, borderRadius: 12, border: '1px solid #e2e8f0', boxShadow: '0 1px 4px rgba(0,0,0,0.04)' }}>
              <h4 style={{ margin: '0 0 14px', color: '#16a34a', fontSize: 14, fontWeight: 700 }}>✓ Learning Outcomes</h4>
              <ul style={{ margin: 0, paddingLeft: 0, listStyle: 'none', color: '#475569', fontSize: 13, lineHeight: 1.9 }}>
                {outcomes.map((o, i) => (
                  <li key={i} style={{ display: 'flex', alignItems: 'flex-start', gap: 8 }}>
                    <span style={{ color: '#16a34a', fontWeight: 700, marginTop: 1 }}>✓</span>
                    {o}
                  </li>
                ))}
              </ul>
            </div>
          </div>

          {/* Tabs */}
          <div style={{ display: 'flex', gap: 0, borderBottom: '2px solid #e2e8f0', marginBottom: 20 }}>
            {tabLabels.map(([key, label]) => (
              <button
                key={key}
                type="button"
                onClick={() => setActiveTab(key)}
                style={{
                  padding: '10px 20px',
                  border: 'none',
                  background: 'none',
                  cursor: 'pointer',
                  fontWeight: 600,
                  fontSize: 14,
                  color: activeTab === key ? '#4f46e5' : '#64748b',
                  borderBottom: activeTab === key ? '2px solid #4f46e5' : '2px solid transparent',
                  marginBottom: -2,
                  transition: 'color 0.15s',
                  whiteSpace: 'nowrap',
                }}
              >
                {label}
              </button>
            ))}
          </div>

          {/* ── LESSONS TAB ── */}
          {activeTab === 'Lessons' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {lessons.length === 0 && (
                <div style={{ padding: 28, textAlign: 'center', color: '#94a3b8', background: '#fff', border: '1px dashed #cbd5e1', borderRadius: 10 }}>
                  No lessons in this module yet.
                </div>
              )}
              {lessons.map((lesson: any, lIdx: number) => {
                const isDone = completedLessonIds.has(String(lesson.id));
                return (
                  <div
                    key={lesson.id}
                    style={{
                      display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                      padding: '18px 22px', background: '#fff',
                      border: `1px solid ${isDone ? '#bbf7d0' : '#e2e8f0'}`,
                      borderRadius: 12,
                      borderLeft: isDone ? '4px solid #22c55e' : '4px solid #e2e8f0',
                      transition: 'border-color 0.2s',
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
                      {/* Checkbox indicator — visible for ALL roles */}
                      <div
                        style={{
                          width: 22, height: 22, borderRadius: 6,
                          border: isDone ? 'none' : '2px solid #cbd5e1',
                          background: isDone ? '#22c55e' : '#fff',
                          display: 'flex', alignItems: 'center', justifyContent: 'center',
                          flexShrink: 0, cursor: isTrainee && !isDone ? 'pointer' : 'default',
                          boxShadow: isDone ? '0 0 0 3px rgba(34,197,94,0.15)' : 'none',
                          transition: 'all 0.2s',
                        }}
                        onClick={() => isTrainee && !isDone ? void markLessonWatched(lesson.id) : undefined}
                        title={isTrainee && !isDone ? 'Click to mark as watched' : isDone ? 'Completed' : 'Not completed'}
                      >
                        {isDone && (
                          <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
                            <path d="M2 6l3 3 5-5" stroke="#fff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                          </svg>
                        )}
                      </div>

                      {/* Lesson number badge */}
                      <div style={{
                        width: 28, height: 28, borderRadius: '50%',
                        background: isDone ? '#dcfce7' : '#f1f5f9',
                        color: isDone ? '#15803d' : '#475569',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        fontSize: 12, fontWeight: 700, flexShrink: 0,
                      }}>
                        {lIdx + 1}
                      </div>

                      <div>
                        <div style={{ fontSize: 15, fontWeight: 600, color: isDone ? '#64748b' : '#0f172a', textDecoration: isDone ? 'line-through' : 'none' }}>
                          {lesson.title}
                        </div>
                        <div style={{ fontSize: 12, color: '#94a3b8', marginTop: 2 }}>
                          {isDone ? '✓ Watched' : 'Pending'} · ⏱ {lesson.durationMinutes || 15} min
                        </div>
                      </div>
                    </div>

                    <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
                      {lesson.videoUrl && (
                        <a href={lesson.videoUrl} target="_blank" rel="noreferrer"
                          style={{ fontSize: 12, color: '#4f46e5', fontWeight: 600, textDecoration: 'none', padding: '4px 10px', background: '#eff6ff', borderRadius: 6 }}>
                          📹 Video
                        </a>
                      )}
                      {lesson.articleUrl && (
                        <a href={lesson.articleUrl} target="_blank" rel="noreferrer"
                          style={{ fontSize: 12, color: '#4f46e5', fontWeight: 600, textDecoration: 'none', padding: '4px 10px', background: '#eff6ff', borderRadius: 6 }}>
                          📄 Article
                        </a>
                      )}

                      {/* Action button — varies by role + state */}
                      {isTrainee ? (
                        isDone ? (
                          <span style={{ fontSize: 12, color: '#16a34a', fontWeight: 700, padding: '6px 14px', background: '#dcfce7', borderRadius: 8 }}>
                            ✓ Done
                          </span>
                        ) : (
                          <button
                            type="button"
                            onClick={() => void markLessonWatched(lesson.id)}
                            style={{ padding: '7px 16px', background: 'linear-gradient(135deg,#6366f1,#4f46e5)', color: '#fff', border: 'none', borderRadius: 8, fontSize: 13, fontWeight: 700, cursor: 'pointer', boxShadow: '0 2px 6px rgba(99,102,241,0.3)' }}
                          >
                            {lIdx === 0 || completedLessons > 0 ? 'Continue' : 'Start'}
                          </button>
                        )
                      ) : (
                        // Trainer/Admin: show status read-only
                        <span style={{
                          fontSize: 12, fontWeight: 600, padding: '5px 12px', borderRadius: 8,
                          background: '#f8fafc', color: '#94a3b8', border: '1px solid #e2e8f0',
                        }}>
                          {isDone ? 'Watched' : 'Not watched'}
                        </span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {/* ── TASKS TAB ── */}
          {activeTab === 'Tasks' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {tasks.length === 0 ? (
                <div style={{ padding: 28, textAlign: 'center', color: '#94a3b8', background: '#fff', border: '1px dashed #cbd5e1', borderRadius: 10 }}>
                  No tasks assigned yet.
                </div>
              ) : (
                tasks.map((task: any) => {
                  const sub = subByAssignment.get(task.id);
                  const status = sub?.status || 'Not Started';
                  const statusColors: Record<string, { bg: string; color: string }> = {
                    'Accepted': { bg: '#dcfce7', color: '#166534' },
                    'Rejected': { bg: '#fee2e2', color: '#b91c1c' },
                    'Submitted': { bg: '#fef3c7', color: '#b45309' },
                    'Not Started': { bg: '#f1f5f9', color: '#475569' },
                  };
                  const sc = statusColors[status] || statusColors['Not Started'];
                  return (
                    <div key={task.id} style={{ padding: '18px 22px', background: '#fff', border: '1px solid #e2e8f0', borderRadius: 12, display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12 }}>
                      <div>
                        <h4 style={{ margin: '0 0 4px', fontSize: 15, color: '#0f172a', fontWeight: 600 }}>{task.title}</h4>
                        <span style={{ fontSize: 12, color: '#64748b' }}>
                          {task.assignmentType} · {task.lessonTitle || 'Module task'} · Due {task.dueDate ? new Date(task.dueDate).toLocaleDateString() : 'N/A'}
                        </span>
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                        <span style={{ fontSize: 11, fontWeight: 700, padding: '5px 12px', borderRadius: 999, background: sc.bg, color: sc.color }}>
                          {status === 'Accepted' ? 'Approved' : status}
                          {typeof sub?.score === 'number' ? ` · ${sub.score}` : ''}
                        </span>
                        {isTrainee && status !== 'Accepted' && (
                          <button
                            type="button"
                            onClick={() => { setSubmitTask(task); setSubmissionText(''); setSubjectiveAnswers({}); setMcqAnswers({}); }}
                            style={{ padding: '7px 16px', background: 'linear-gradient(135deg,#6366f1,#4f46e5)', color: '#fff', border: 'none', borderRadius: 8, fontSize: 13, fontWeight: 700, cursor: 'pointer' }}
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

          {/* ── RESOURCES TAB ── */}
          {activeTab === 'Resources' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {resources.length === 0 ? (
                <div style={{ padding: 28, textAlign: 'center', color: '#94a3b8', background: '#fff', border: '1px dashed #cbd5e1', borderRadius: 10 }}>
                  No resources attached to this module yet.
                </div>
              ) : (
                resources.map((res: any) => {
                  const visited = (progressStats?.visitedResourceIds || []).map(String).includes(String(res.id));
                  return (
                    <div key={res.id} style={{ padding: '16px 22px', background: '#fff', border: '1px solid #e2e8f0', borderRadius: 12, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                        <span style={{ fontSize: 22 }}>🔗</span>
                        <div>
                          <strong style={{ fontSize: 14, color: '#0f172a' }}>{res.title}</strong>
                          <div style={{ fontSize: 12, color: '#64748b' }}>{res.type || 'Link'} · {visited ? '✓ Visited' : 'Not visited'}</div>
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={async () => {
                          try {
                            if (res?.id && isTrainee) await progressService.visitResource(res.id, accessToken);
                            if (res?.url) window.open(res.url, '_blank', 'noopener,noreferrer');
                            if (openModuleId) await openModule(openModuleId);
                          } catch {
                            if (res?.url) window.open(res.url, '_blank', 'noopener,noreferrer');
                          }
                        }}
                        style={{ padding: '7px 16px', background: visited ? '#ecfdf5' : 'linear-gradient(135deg,#6366f1,#4f46e5)', color: visited ? '#047857' : '#fff', border: 'none', borderRadius: 8, fontWeight: 600, fontSize: 13, cursor: 'pointer' }}
                      >
                        {visited ? 'Open Again' : 'Open & Mark Visited'}
                      </button>
                    </div>
                  );
                })
              )}
            </div>
          )}

          {/* ── ASSESSMENTS TAB ── */}
          {activeTab === 'Assessments' && (
            <div style={{ background: '#fff', borderRadius: 12, border: '1px solid #e2e8f0', overflow: 'hidden' }}>
              {isTrainee && completedLessons < lessons.length ? (
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '60px 32px', textAlign: 'center' }}>
                  <div style={{ width: 56, height: 56, borderRadius: '50%', background: '#f1f5f9', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 28, marginBottom: 16 }}>🔒</div>
                  <h3 style={{ margin: '0 0 8px', fontSize: 18, fontWeight: 700, color: '#0f172a' }}>Module Assessment</h3>
                  <p style={{ margin: '0 0 16px', color: '#64748b', fontSize: 14 }}>
                    Complete {lessons.length - completedLessons} more lesson{lessons.length - completedLessons !== 1 ? 's' : ''} to unlock the final assessment.
                  </p>
                  <span style={{ fontSize: 13, color: '#94a3b8', background: '#f8fafc', padding: '6px 14px', borderRadius: 8, border: '1px solid #e2e8f0' }}>
                    Locked — {lessons.length - completedLessons} lesson{lessons.length - completedLessons !== 1 ? 's' : ''} remaining
                  </span>
                </div>
              ) : (
                <div style={{ padding: '24px 28px' }}>
                  <h3 style={{ margin: '0 0 8px', fontSize: 16, fontWeight: 700, color: '#0f172a' }}>Module Assessment</h3>
                  <p style={{ margin: '0 0 16px', color: '#64748b', fontSize: 14 }}>
                    Submitted: {tasksSubmitted} · Average score: {avgScore}/100
                  </p>
                  {tasks.map((task: any) => {
                    const sub = subByAssignment.get(task.id);
                    return (
                      <div key={task.id} style={{ padding: '14px 18px', background: '#f8fafc', borderRadius: 10, marginBottom: 10, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <div>
                          <strong style={{ fontSize: 14 }}>{task.title}</strong>
                          <div style={{ fontSize: 12, color: '#64748b', marginTop: 2 }}>{task.assignmentType}</div>
                        </div>
                        <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
                          {typeof sub?.score === 'number' && (
                            <span style={{ fontWeight: 700, fontSize: 15, color: sub.score >= 75 ? '#16a34a' : sub.score >= 35 ? '#b45309' : '#dc2626' }}>
                              {sub.score}/{task.maxScore || 100}
                            </span>
                          )}
                          {isTrainee && (!sub || sub.status !== 'Accepted') && (
                            <button
                              type="button"
                              onClick={() => { setSubmitTask(task); setSubmissionText(''); setSubjectiveAnswers({}); setMcqAnswers({}); }}
                              style={{ padding: '6px 14px', background: 'linear-gradient(135deg,#6366f1,#4f46e5)', color: '#fff', border: 'none', borderRadius: 8, fontSize: 13, fontWeight: 700, cursor: 'pointer' }}
                            >
                              {sub ? 'Resubmit' : 'Submit'}
                            </button>
                          )}
                        </div>
                      </div>
                    );
                  })}
                  {tasks.length === 0 && <p style={{ color: '#94a3b8', fontSize: 14 }}>No assessments in this module.</p>}
                </div>
              )}
            </div>
          )}
        </div>

        {/* ── Task Submission Modal ── */}
        {submitTask && (
          <div style={{ position: 'fixed', inset: 0, background: 'rgba(15,23,42,0.55)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, backdropFilter: 'blur(4px)' }}>
            <form onSubmit={handleSubmit} style={{ width: 580, maxHeight: '90vh', overflowY: 'auto', background: '#fff', borderRadius: 20, padding: '28px 32px', boxShadow: '0 25px 80px rgba(0,0,0,0.2)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
                <h3 style={{ margin: 0, fontSize: 18, fontWeight: 800, color: '#0f172a' }}>{submitTask.title}</h3>
                <button type="button" onClick={() => setSubmitTask(null)} style={{ border: 'none', background: '#f1f5f9', borderRadius: 8, width: 32, height: 32, cursor: 'pointer', fontSize: 18, color: '#64748b', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>×</button>
              </div>
              {submitTask.instructions && (
                <p style={{ fontSize: 13, color: '#64748b', background: '#f8fafc', padding: 12, borderRadius: 8, marginBottom: 16, lineHeight: 1.6 }}>{submitTask.instructions}</p>
              )}

              {(submitTask.mcqConfig?.questions || []).length > 0 ? (
                (submitTask.mcqConfig.questions as any[]).map((q: any, idx: number) => (
                  <div key={idx} style={{ marginBottom: 16, padding: '16px 18px', background: '#f8fafc', borderRadius: 10, border: '1px solid #e2e8f0' }}>
                    <p style={{ margin: '0 0 12px', fontWeight: 700, fontSize: 14, color: '#0f172a' }}>
                      Q{idx + 1}. {q.questionText || q.question}
                    </p>
                    {submitTask.assignmentType === 'MCQ' ? (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                        {(q.options || ['', '', '', '']).map((opt: string, oi: number) => (
                          <label key={oi} style={{
                            display: 'flex', alignItems: 'center', gap: 10, padding: '10px 14px', borderRadius: 8, cursor: 'pointer',
                            background: mcqAnswers[idx] === oi ? '#ede9fe' : '#fff',
                            border: `1.5px solid ${mcqAnswers[idx] === oi ? '#6366f1' : '#e2e8f0'}`,
                            fontWeight: mcqAnswers[idx] === oi ? 600 : 400, fontSize: 13, color: '#0f172a', transition: 'all 0.15s',
                          }}>
                            <input type="radio" name={`q-${idx}`} checked={mcqAnswers[idx] === oi} onChange={() => setMcqAnswers(prev => ({ ...prev, [idx]: oi }))} style={{ accentColor: '#6366f1' }} />
                            <span style={{ width: 22, height: 22, borderRadius: 6, background: mcqAnswers[idx] === oi ? '#6366f1' : '#e2e8f0', color: mcqAnswers[idx] === oi ? '#fff' : '#64748b', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, fontWeight: 700, flexShrink: 0 }}>
                              {String.fromCharCode(65 + oi)}
                            </span>
                            {opt || `Option ${oi + 1}`}
                          </label>
                        ))}
                      </div>
                    ) : (
                      <textarea
                        rows={4} value={subjectiveAnswers[idx] || ''}
                        onChange={(e) => setSubjectiveAnswers(prev => ({ ...prev, [idx]: e.target.value }))}
                        placeholder="Write your answer here..."
                        style={{ width: '100%', padding: '10px 14px', borderRadius: 8, border: '1.5px solid #e2e8f0', fontSize: 13, resize: 'vertical', outline: 'none', boxSizing: 'border-box' }}
                      />
                    )}
                  </div>
                ))
              ) : (
                <textarea
                  required rows={6} value={submissionText}
                  onChange={(e) => setSubmissionText(e.target.value)}
                  placeholder="Write your submission..."
                  style={{ width: '100%', padding: '12px 14px', borderRadius: 10, border: '1.5px solid #e2e8f0', fontSize: 13, resize: 'vertical', marginBottom: 16, outline: 'none', boxSizing: 'border-box' }}
                />
              )}

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 12, marginTop: 20, paddingTop: 16, borderTop: '1px solid #f1f5f9' }}>
                <button type="button" onClick={() => setSubmitTask(null)} style={{ padding: '10px 20px', border: 'none', borderRadius: 10, background: '#f1f5f9', fontWeight: 600, fontSize: 13, cursor: 'pointer', color: '#475569' }}>
                  Cancel
                </button>
                <button type="submit" disabled={isSubmitting} style={{ padding: '10px 24px', border: 'none', borderRadius: 10, background: isSubmitting ? '#a5b4fc' : 'linear-gradient(135deg,#6366f1,#4f46e5)', color: '#fff', fontWeight: 700, fontSize: 13, cursor: isSubmitting ? 'not-allowed' : 'pointer', boxShadow: '0 2px 8px rgba(99,102,241,0.3)' }}>
                  {isSubmitting ? 'Submitting...' : 'Submit for Evaluation'}
                </button>
              </div>
            </form>
          </div>
        )}
      </div>
    );
  }

  // ─────────────────────────────────────────────────────────────────────────
  // MODULE LIST VIEW
  // ─────────────────────────────────────────────────────────────────────────
  return (
    <div style={{ padding: '24px 32px', maxWidth: '1100px', margin: '0 auto', fontFamily: 'Inter, system-ui, sans-serif' }}>

      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 24 }}>
        <div>
          <button type="button" onClick={onBack}
            style={{ fontSize: 13, color: '#4f46e5', background: 'none', border: 'none', cursor: 'pointer', fontWeight: 600, marginBottom: 8, padding: 0, display: 'flex', alignItems: 'center', gap: 4 }}>
            ← Back to Learning Paths
          </button>
          <h1 style={{ fontSize: 22, fontWeight: 800, margin: 0, color: '#0f172a' }}>Modules</h1>
          <p style={{ fontSize: 13, color: '#64748b', margin: '4px 0 0 0' }}>Browse module content and resources</p>
        </div>
        {isTrainerOrAdmin && (
          <button type="button" onClick={() => setShowNewModuleModal(true)}
            style={{ background: 'linear-gradient(135deg,#6366f1,#4f46e5)', color: '#fff', border: 'none', borderRadius: 10, padding: '10px 20px', fontWeight: 700, fontSize: 13, cursor: 'pointer', boxShadow: '0 2px 8px rgba(99,102,241,0.35)' }}>
            + New Module
          </button>
        )}
      </div>

      {/* Learning Path Selector */}
      <div style={{ marginBottom: 28, background: '#fff', borderRadius: 12, border: '1px solid #f1f5f9', padding: '16px 20px', boxShadow: '0 1px 4px rgba(0,0,0,0.04)' }}>
        <label style={{ fontSize: 12, fontWeight: 700, color: '#374151', textTransform: 'uppercase', letterSpacing: '0.05em', display: 'block', marginBottom: 8 }}>
          Select Learning Path
        </label>
        <select
          value={selectedPathId}
          onChange={e => {
            const found = allPaths.find(p => p.id === e.target.value);
            setSelectedPathId(e.target.value);
            setSelectedPathTitle(found?.title || found?.name || '');
          }}
          style={{ width: '100%', padding: '10px 14px', borderRadius: 10, border: '1.5px solid #e2e8f0', fontSize: 14, background: '#fff', cursor: 'pointer', outline: 'none', fontWeight: 500, color: '#1e293b' }}
        >
          {allPaths.length === 0 && <option value="">Loading paths...</option>}
          {allPaths.map((p: any) => (
            <option key={p.id} value={p.id}>{p.title || p.name}</option>
          ))}
        </select>
        {selectedPathTitle && (
          <div style={{ marginTop: 8, fontSize: 12, color: '#64748b' }}>
            📚 Showing modules for: <strong>{selectedPathTitle}</strong>
          </div>
        )}
      </div>

      {/* Modules List */}
      {isLoading ? (
        <div style={{ textAlign: 'center', padding: '60px', color: '#94a3b8' }}>
          <div style={{ fontSize: 32, marginBottom: 12 }}>⏳</div>
          Loading modules...
        </div>
      ) : modules.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '60px', background: '#f8fafc', borderRadius: 16, border: '2px dashed #e2e8f0' }}>
          <div style={{ fontSize: 40, marginBottom: 12 }}>📦</div>
          <div style={{ fontWeight: 700, fontSize: 16, color: '#475569' }}>No modules yet</div>
          <div style={{ fontSize: 13, color: '#94a3b8', marginTop: 4 }}>
            {isTrainerOrAdmin ? 'Create the first module for this learning path.' : 'No modules available for this path.'}
          </div>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          {modules.map((module: any, mIdx: number) => {
            const lc = getLevelColor(module.level);
            const lessons = module.lessons || [];
            const resources = module.resources || [];

            return (
              <div
                key={module.id}
                style={{ background: '#fff', borderRadius: 14, border: '1px solid #f1f5f9', boxShadow: '0 2px 8px rgba(0,0,0,0.05)', overflow: 'hidden', cursor: 'pointer', transition: 'box-shadow 0.2s, transform 0.15s' }}
                onClick={() => openModule(module.id)}
                onMouseEnter={e => { (e.currentTarget as HTMLElement).style.boxShadow = '0 6px 20px rgba(99,102,241,0.15)'; (e.currentTarget as HTMLElement).style.transform = 'translateY(-1px)'; }}
                onMouseLeave={e => { (e.currentTarget as HTMLElement).style.boxShadow = '0 2px 8px rgba(0,0,0,0.05)'; (e.currentTarget as HTMLElement).style.transform = 'none'; }}
              >
                <div style={{ padding: '18px 22px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 14, flex: 1, minWidth: 0 }}>
                    <div style={{ width: 40, height: 40, borderRadius: 10, background: 'linear-gradient(135deg,#6366f1,#4f46e5)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontWeight: 800, fontSize: 15, flexShrink: 0 }}>
                      {mIdx + 1}
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
                        <h3 style={{ margin: 0, fontSize: 16, fontWeight: 700, color: '#0f172a' }}>{module.title}</h3>
                        {module.level && (
                          <span style={{ ...lc, padding: '2px 8px', borderRadius: 6, fontSize: 11, fontWeight: 700 }}>{module.level}</span>
                        )}
                        {lessons.length > 0 && (
                          <span style={{ fontSize: 11, color: '#64748b', background: '#f8fafc', border: '1px solid #e2e8f0', padding: '2px 8px', borderRadius: 6 }}>
                            {lessons.length} lesson{lessons.length > 1 ? 's' : ''}
                          </span>
                        )}
                      </div>
                      {module.description && (
                        <p style={{ margin: '4px 0 0 0', fontSize: 12, color: '#64748b', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {module.description}
                        </p>
                      )}
                    </div>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
                    {resources.length > 0 && (
                      <span style={{ fontSize: 11, color: '#2563eb', background: '#eff6ff', border: '1px solid #bfdbfe', padding: '2px 8px', borderRadius: 6, fontWeight: 600 }}>
                        {resources.length} resource{resources.length > 1 ? 's' : ''}
                      </span>
                    )}
                    <span style={{ color: '#6366f1', fontSize: 14, fontWeight: 600 }}>View →</span>
                  </div>
                </div>

                {/* About this module + Lessons preview */}
                <div style={{ padding: '0 22px 18px', borderTop: '1px solid #f8fafc' }}>
                  {module.description && (
                    <div style={{ marginBottom: 10 }}>
                      <div style={{ fontSize: 11, fontWeight: 700, color: '#374151', textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: 4, marginTop: 14 }}>About this module</div>
                      <p style={{ margin: 0, fontSize: 13, color: '#475569' }}>{module.description}</p>
                    </div>
                  )}
                  {lessons.length > 0 && (
                    <div>
                      <div style={{ fontSize: 11, fontWeight: 700, color: '#374151', textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: 6, marginTop: 12 }}>📖 Lessons</div>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
                        {lessons.slice(0, 3).map((lesson: any, lIdx: number) => {
                          const isDone = completedLessonIds.has(String(lesson.id));
                          return (
                            <div key={lesson.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 12px', background: '#fafcff', border: '1px solid #f1f5f9', borderRadius: 8 }}>
                              {/* Checkbox visible for all roles */}
                              <div style={{
                                width: 18, height: 18, borderRadius: 4,
                                border: isDone ? 'none' : '1.5px solid #cbd5e1',
                                background: isDone ? '#22c55e' : '#fff',
                                display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
                              }}>
                                {isDone && (
                                  <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
                                    <path d="M1.5 5l2.5 2.5 4.5-4.5" stroke="#fff" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                                  </svg>
                                )}
                              </div>
                              <span style={{ width: 20, height: 20, borderRadius: '50%', background: '#ede9fe', color: '#6d28d9', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 10, fontWeight: 700, flexShrink: 0 }}>
                                {lIdx + 1}
                              </span>
                              <span style={{ fontSize: 13, fontWeight: 500, flex: 1, textDecoration: isDone ? 'line-through' : 'none', color: isDone ? '#94a3b8' : '#1e293b' }}>
                                {lesson.title}
                              </span>
                              {lesson.durationMinutes && (
                                <span style={{ fontSize: 11, color: '#94a3b8' }}>⏱ {lesson.durationMinutes} min</span>
                              )}
                            </div>
                          );
                        })}
                        {lessons.length > 3 && (
                          <div style={{ fontSize: 12, color: '#4f46e5', fontWeight: 600, padding: '4px 12px' }}>
                            +{lessons.length - 3} more lessons
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* ═══ NEW MODULE MODAL ═══ */}
      {showNewModuleModal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(15,23,42,0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, backdropFilter: 'blur(4px)' }}>
          <div style={{ background: '#fff', width: 540, borderRadius: 20, boxShadow: '0 25px 80px rgba(0,0,0,0.2)', overflow: 'hidden' }}>
            <div style={{ padding: '22px 26px', borderBottom: '1px solid #f1f5f9', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <h2 style={{ margin: 0, fontSize: 18, fontWeight: 800, color: '#0f172a' }}>New Module</h2>
                <p style={{ margin: '4px 0 0 0', fontSize: 12, color: '#64748b' }}>Creating inside: <strong>{selectedPathTitle}</strong></p>
              </div>
              <button onClick={() => setShowNewModuleModal(false)} style={{ background: '#f1f5f9', border: 'none', borderRadius: 8, width: 32, height: 32, cursor: 'pointer', fontSize: 18, color: '#64748b', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>×</button>
            </div>
            <form onSubmit={handleCreateModule} style={{ padding: '22px 26px', display: 'flex', flexDirection: 'column', gap: 16, maxHeight: '80vh', overflowY: 'auto' }}>
              <div>
                <label style={{ display: 'block', fontSize: 12, fontWeight: 700, color: '#374151', marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Module Title *</label>
                <input required value={moduleTitle} onChange={e => setModuleTitle(e.target.value)} placeholder="e.g. Backend API Design"
                  style={{ width: '100%', padding: '10px 14px', borderRadius: 10, border: '1.5px solid #e2e8f0', fontSize: 14, outline: 'none', boxSizing: 'border-box' }} />
              </div>
              <div>
                <label style={{ display: 'block', fontSize: 12, fontWeight: 700, color: '#374151', marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Description</label>
                <textarea rows={3} value={moduleDescription} onChange={e => setModuleDescription(e.target.value)} placeholder="Describe what trainees will learn..."
                  style={{ width: '100%', padding: '10px 14px', borderRadius: 10, border: '1.5px solid #e2e8f0', fontSize: 13, resize: 'vertical', outline: 'none', boxSizing: 'border-box' }} />
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <div>
                  <label style={{ display: 'block', fontSize: 12, fontWeight: 700, color: '#374151', marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Level</label>
                  <select value={moduleLevel} onChange={e => setModuleLevel(e.target.value)}
                    style={{ width: '100%', padding: '10px 14px', borderRadius: 10, border: '1.5px solid #e2e8f0', fontSize: 13, background: '#fff', cursor: 'pointer', outline: 'none' }}>
                    <option>Beginner</option><option>Intermediate</option><option>Advanced</option>
                  </select>
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: 12, fontWeight: 700, color: '#374151', marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Duration (Weeks)</label>
                  <input type="number" min={1} max={52} value={moduleDurationWeeks} onChange={e => setModuleDurationWeeks(Number(e.target.value) || 2)}
                    style={{ width: '100%', padding: '10px 14px', borderRadius: 10, border: '1.5px solid #e2e8f0', fontSize: 13, outline: 'none', boxSizing: 'border-box' }} />
                </div>
              </div>
              <div>
                <label style={{ display: 'block', fontSize: 12, fontWeight: 700, color: '#4f46e5', marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.05em' }}>◎ Learning Objectives (One per line)</label>
                <textarea rows={3} value={moduleObjectives} onChange={e => setModuleObjectives(e.target.value)} placeholder="e.g. Understand RESTful architecture principles&#10;Design clean API endpoints"
                  style={{ width: '100%', padding: '10px 14px', borderRadius: 10, border: '1.5px solid #c7d2fe', fontSize: 13, resize: 'vertical', outline: 'none', boxSizing: 'border-box', background: '#f5f3ff' }} />
              </div>
              <div>
                <label style={{ display: 'block', fontSize: 12, fontWeight: 700, color: '#16a34a', marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.05em' }}>✓ Learning Outcomes (One per line)</label>
                <textarea rows={3} value={moduleOutcomes} onChange={e => setModuleOutcomes(e.target.value)} placeholder="e.g. Build a fully functional REST API with CRUD operations&#10;Secure endpoints with JWT authentication"
                  style={{ width: '100%', padding: '10px 14px', borderRadius: 10, border: '1.5px solid #bbf7d0', fontSize: 13, resize: 'vertical', outline: 'none', boxSizing: 'border-box', background: '#f0fdf4' }} />
              </div>
              <div>
                <label style={{ display: 'block', fontSize: 12, fontWeight: 700, color: '#374151', marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Module Key Points (One per line)</label>
                <textarea rows={2} value={moduleKeyPoints} onChange={e => setModuleKeyPoints(e.target.value)} placeholder="Key concepts trainees must retain..."
                  style={{ width: '100%', padding: '10px 14px', borderRadius: 10, border: '1.5px solid #e2e8f0', fontSize: 13, resize: 'vertical', outline: 'none', boxSizing: 'border-box' }} />
              </div>
              <div>
                <label style={{ display: 'block', fontSize: 12, fontWeight: 700, color: '#374151', marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Resource URL</label>
                <input type="url" value={moduleResourceUrl} onChange={e => setModuleResourceUrl(e.target.value)} placeholder="https://docs.example.com/module-guide"
                  style={{ width: '100%', padding: '10px 14px', borderRadius: 10, border: '1.5px solid #e2e8f0', fontSize: 13, outline: 'none', boxSizing: 'border-box' }} />
              </div>
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 12, paddingTop: 8, borderTop: '1px solid #f1f5f9' }}>
                <button type="button" onClick={() => setShowNewModuleModal(false)} style={{ padding: '10px 20px', background: '#f1f5f9', border: 'none', borderRadius: 10, cursor: 'pointer', fontWeight: 600, fontSize: 13, color: '#475569' }}>Cancel</button>
                <button type="submit" disabled={isCreating} style={{ padding: '10px 20px', background: isCreating ? '#a5b4fc' : 'linear-gradient(135deg,#6366f1,#4f46e5)', color: '#fff', border: 'none', borderRadius: 10, cursor: isCreating ? 'not-allowed' : 'pointer', fontWeight: 700, fontSize: 13, boxShadow: '0 2px 8px rgba(99,102,241,0.3)' }}>
                  {isCreating ? 'Creating...' : 'Create Module'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}