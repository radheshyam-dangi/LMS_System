import React, { useState, useEffect } from "react";
import { createPortal } from "react-dom";
import { useParams, useLocation } from "react-router-dom";
import { learningPathService } from "../../services/learningPathService";
import { curriculumService } from "../../services/curriculumService";
import { progressService } from "../../services/lmsApi";
import { assignmentService } from "../../services/assignmentService";
import { useNotifications } from "../../context/NotificationContext";
import { useToast } from "../../context/ToastContext";
import { DeadlineDisplay } from "../DeadlineDisplay";
import { ExpandableDescription } from "../ExpandableDescription/ExpandableDescription";
import { LessonCard } from "../SharedCards/LessonCard";
import { AssignmentCard } from "../SharedCards/AssignmentCard";
import { SharedAssignmentModal } from "../SharedCards/SharedAssignmentModal";
import { RichText } from "../common/RichText";
import { renderMultilineText, ModuleDescription } from "../../utils/textUtils";
import { resolveAssignmentInstructions } from "../../utils/assignmentInstructions";
import { AssignmentInstructionsGate } from "../common/AssignmentInstructionsGate";
import "./ModulesManagement.css";

interface ModulesProps {
  currentPathId: string;
  currentPathTitle: string;
  userRole: 'Admin' | 'Trainer' | 'Trainee';
  accessToken: string;
  onBack: () => void;
}

import { ModuleDescriptionPreview, ModuleShowMoreModal } from '../common/ModuleShowMoreModal';

export function ModulesManagementSection({
  currentPathId,
  currentPathTitle,
  userRole,
  accessToken,
  onBack,
}: ModulesProps) {
  const { moduleId: urlModuleId } = useParams<{ moduleId?: string }>();
  const location = useLocation();
  const isTrainerOrAdmin = userRole === 'Admin' || userRole === 'Trainer';
  const isTrainee = userRole === 'Trainee';
  const { refresh: refreshNotifications } = useNotifications();
  const toast = useToast();

  // ── List-level state ──────────────────────────────────────────────────────
  const [allPaths, setAllPaths] = useState<any[]>([]);
  const [selectedPathId, setSelectedPathId] = useState<string>(currentPathId);
  const [selectedPathTitle, setSelectedPathTitle] = useState<string>(currentPathTitle);
  const [modules, setModules] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  // ── Drill-in: which module is open in detail view ─────────────────────────
  const [openModuleId, setOpenModuleId] = useState<string | null>(null);
  const [openModuleData, setOpenModuleData] = useState<any | null>(null);
  const [moduleStats, setModuleStats] = useState<any | null>(null);
  const [moduleLoading, setModuleLoading] = useState(false);
  const [isModuleDropdownOpen, setIsModuleDropdownOpen] = useState(false);

  // ── Progress state (for Trainee) ──────────────────────────────────────────
  const [progressStats, setProgressStats] = useState<any>(null);
  const [mySubs, setMySubs] = useState<any[]>([]);

  // ── Detail-view tab ───────────────────────────────────────────────────────
  const [activeTab, setActiveTab] = useState<'Lessons' | 'Tasks' | 'Resources' | 'Assessments'>((location.state as any)?.activeTab || 'Lessons');

  // ── New Module modal ──────────────────────────────────────────────────────
  const [showNewModuleModal, setShowNewModuleModal] = useState(false);
  const [moduleTitle, setModuleTitle] = useState('');
  const [moduleDescription, setModuleDescription] = useState('');
  const [showMoreModalOpen, setShowMoreModalOpen] = useState(false);
  const [moduleResourceUrl, setModuleResourceUrl] = useState('');
  const [moduleLevel, setModuleLevel] = useState('Beginner');
  const [moduleObjectives, setModuleObjectives] = useState('');
  const [moduleOutcomes, setModuleOutcomes] = useState('');
  const [moduleKeyPoints, setModuleKeyPoints] = useState('');
  const [moduleDurationWeeks, setModuleDurationWeeks] = useState<number>(2);
  const [moduleLessonLocking, setModuleLessonLocking] = useState<boolean>(false);
  const [moduleTaskLocking, setModuleTaskLocking] = useState<boolean>(false);
  const [isCreating, setIsCreating] = useState(false);
  const [subjectiveAnswers, setSubjectiveAnswers] = useState<{ [key: number]: string }>({});
  const [mcqAnswers, setMcqAnswers] = useState<{ [key: number]: number | number[] }>({});
  const [currentTime, setCurrentTime] = useState<Date>(new Date());

  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  // ── Task submission modal (Trainee only) ──────────────────────────────────
  const [submitTask, setSubmitTask] = useState<any | null>(null);
  const [submissionText, setSubmissionText] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [attachmentUrl, setAttachmentUrl] = useState('');
  const [instructionsOpen, setInstructionsOpen] = useState(false);
  const [isInstructionsGateOpen, setIsInstructionsGateOpen] = useState(false);

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
      .catch(() => { });
  }, [accessToken, isTrainee]);

  // ── Sync currentPathId to selectedPathId ──────────────────────────────────
  useEffect(() => {
    if (currentPathId && currentPathId !== selectedPathId) {
      setSelectedPathId(currentPathId);
    }
  }, [currentPathId, selectedPathId]);

  // ── Load modules when path changes ────────────────────────────────────────
  useEffect(() => {
    if (!selectedPathId) return;
    setIsLoading(true);
    // Don't clear modules here if we're just switching URL module IDs for the same path
    curriculumService.fetchModulesByPath(selectedPathId, accessToken)
      .then((data: any) => {
        const mods = Array.isArray(data) ? data : [];
        setModules(mods);

        // Open or refresh module for Trainee
        if (isTrainee && mods.length > 0) {
          if (urlModuleId) {
            void openModule(urlModuleId, true);
          } else if (openModuleId && mods.some((m: any) => m.id === openModuleId)) {
            void openModule(openModuleId, true);
          } else {
            void openModule(mods[0].id, false);
          }
        }
      })
      .catch(() => setModules([]))
      .finally(() => setIsLoading(false));
  }, [selectedPathId, accessToken, isTrainee, urlModuleId]);

  // ── Load progress stats once (for Trainee) ────────────────────────────────
  useEffect(() => {
    if (!isTrainee) return;
    progressService.fetchMyStats(accessToken).then(setProgressStats).catch(() => { });
  }, [accessToken, isTrainee]);

  // ── Drill into a module ───────────────────────────────────────────────────
  const openModule = async (moduleId: string, preserveTab: boolean = false) => {
    setOpenModuleId(moduleId);
    setModuleLoading(true);
    if (!preserveTab) {
      setActiveTab((location.state as any)?.activeTab || 'Lessons');
    }
    try {
      const [mod, subs, modStats] = await Promise.all([
        curriculumService.fetchModuleById(moduleId, accessToken),
        isTrainee
          ? assignmentService.fetchMySubmissions(accessToken).catch(() => [])
          : Promise.resolve([]),
        isTrainee
          ? progressService.fetchModuleStats(moduleId, accessToken).catch(() => null)
          : Promise.resolve(null),
      ]);
      setOpenModuleData(mod);
      const modPathId = mod?.learningPathId || mod?.learningPath?.id;
      if (modPathId && modPathId !== selectedPathId) {
        setSelectedPathId(modPathId);
      }
      setMySubs(Array.isArray(subs) ? subs : []);
      setModuleStats(modStats);
    } catch {
      setOpenModuleData(null);
    } finally {
      setModuleLoading(false);
    }
  };

  const refreshModuleData = async (moduleId: string) => {
    try {
      const [mod, subs, modStats] = await Promise.all([
        curriculumService.fetchModuleById(moduleId, accessToken),
        isTrainee
          ? assignmentService.fetchMySubmissions(accessToken).catch(() => [])
          : Promise.resolve([]),
        isTrainee
          ? progressService.fetchModuleStats(moduleId, accessToken).catch(() => null)
          : Promise.resolve(null),
      ]);
      setOpenModuleData(mod);
      setMySubs(Array.isArray(subs) ? subs : []);
      setModuleStats(modStats);
    } catch {
      // Keep current state on background network blip
    }
  };

  const closeModule = () => {
    if (isTrainee) {
      onBack();
    } else {
      setOpenModuleId(null);
      setOpenModuleData(null);
      setModuleStats(null);
    }
  };

  // Refetch on window focus & periodic polling to ensure updated DB data is always visible (§6.2)
  useEffect(() => {
    const refreshAll = () => {
      if (selectedPathId) {
        curriculumService.fetchModulesByPath(selectedPathId, accessToken)
          .then((data: any) => {
            const mods = Array.isArray(data) ? data : [];
            setModules(mods);
            if (openModuleId) {
              if (mods.some((m: any) => m.id === openModuleId)) {
                void refreshModuleData(openModuleId);
              } else if (mods.length > 0 && isTrainee) {
                void openModule(mods[0].id, false);
              }
            }
          })
          .catch(() => { });
      }
    };

    window.addEventListener('focus', refreshAll);
    const interval = setInterval(refreshAll, 6000);
    return () => {
      window.removeEventListener('focus', refreshAll);
      clearInterval(interval);
    };
  }, [openModuleId, selectedPathId, accessToken, isTrainee]);

  // ── Mark lesson watched (Trainee) ─────────────────────────────────────────
  const markLessonWatched = async (lessonId: string) => {
    try {
      await progressService.completeLesson(lessonId, accessToken);
      if (openModuleId) await openModule(openModuleId);
      await progressService.fetchMyStats(accessToken).then(setProgressStats).catch(() => { });
      await refreshNotifications();
    } catch (err: any) {
      toast.error(err?.message || 'Could not mark lesson as watched.');
    }
  };

  // ── Create module ─────────────────────────────────────────────────────────
  const handleCreateModule = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!moduleTitle.trim()) { toast.warning('Module title is required.'); return; }
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
          lessonLocking: moduleLessonLocking,
          taskLocking: moduleTaskLocking,
          resources,
        },
        accessToken
      );
      setShowNewModuleModal(false);
      setModuleTitle(''); setModuleDescription(''); setModuleResourceUrl(''); setModuleLevel('Beginner');
      setModuleObjectives(''); setModuleOutcomes(''); setModuleKeyPoints(''); setModuleDurationWeeks(2);
      setModuleLessonLocking(false); setModuleTaskLocking(false);
      const data = await curriculumService.fetchModulesByPath(selectedPathId, accessToken);
      setModules(Array.isArray(data) ? data : []);
    } catch (err: any) {
      toast.error(err.message || 'Failed to create module.');
    } finally {
      setIsCreating(false);
    }
  };

  const loadAssignments = async () => {
    if (openModuleId) await openModule(openModuleId);
  }

  const handleStartTask = async (taskId: string) => {
    if (!accessToken) return;
    try {
      await fetch(`${import.meta.env.VITE_API_URL || 'http://localhost:3000'}/assignments/${taskId}/start`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${accessToken}` },
      });
      await loadAssignments();
    } catch (err: any) {
      toast.error(err.message || 'Failed to start task');
    }
  };

  const handleRestartTask = async (taskId: string) => {
    if (!accessToken) return;
    if (!window.confirm('Are you sure you want to restart? This will clear all your answers and reset the timer.')) return;
    try {
      await fetch(`${import.meta.env.VITE_API_URL || 'http://localhost:3000'}/assignments/${taskId}/restart`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${accessToken}` },
      });
      setSubmitTask(null);
      await loadAssignments();
    } catch (err: any) {
      toast.error(err.message || 'Failed to restart task');
    }
  };

  // ── Task submit ───────────────────────────────────────────────────────────
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!submitTask || isSubmitting) return;
    const questions = submitTask.questions?.length > 0 ? submitTask.questions : (submitTask.mcqConfig?.questions || []);
    let text = submissionText;
    if (submitTask.assignmentType === 'MCQ' && questions.length) {
      text = JSON.stringify({ answers: mcqAnswers });
    } else if (questions.length) {
      // For subjective with questions array, we check if answers exist and aren't completely empty
      text = JSON.stringify({ answers: subjectiveAnswers });
      const hasMeaningfulAnswers = Object.values(subjectiveAnswers).some(val => val.trim().length > 0);
      if (!hasMeaningfulAnswers) {
        toast.warning('Please answer at least one question before submitting.');
        return;
      }
    }
    if (!text.trim() || text === '{"answers":{}}') {
      toast.warning('Please provide a submission before submitting.');
      return;
    }
    setIsSubmitting(true);
    try {
      await curriculumService.submitAssignment({ assignmentId: submitTask.id, submissionText: text, attachmentUrl }, accessToken);
      setSubmitTask(null);
      setSubmissionText(''); setSubjectiveAnswers({}); setMcqAnswers({}); setAttachmentUrl('');
      if (openModuleId) await openModule(openModuleId);
      await refreshNotifications();
      toast.success('Assignment submitted successfully!');
    } catch (err: any) {
      toast.error(err?.response?.data?.message || err.message || 'Submit failed.');
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

  // Use module-level stats if drilled in (more accurate), fallback to LP-level stats for list view
  const completedLessonIds = new Set<string>(
    (moduleStats?.completedLessonIds || progressStats?.completedLessonIds || []).map(String)
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

    const lessonTasks = lessons.flatMap((l: any) =>
      (l.assignments || []).map((a: any) => ({ ...a, lessonTitle: l.title }))
    );
    const seenTaskIds = new Set(lessonTasks.map((t: any) => String(t.id)));

    const moduleLevelAssignments = (openModuleData?.assignments || [])
      .filter((a: any) => !seenTaskIds.has(String(a.id)))
      .map((a: any) => {
        if (!a.lessonTitle) {
          const matchedLesson = lessons.find((l: any) => String(l.id) === String(a.lessonId || a.lesson?.id));
          if (matchedLesson) {
            return { ...a, lessonTitle: matchedLesson.title };
          }
        }
        return a;
      });

    const tasks = [...lessonTasks, ...moduleLevelAssignments];

    // Use backend computed-on-read values (§2 — no stale counters)
    const completedLessons = moduleStats?.completedLessons ?? lessons.filter((l: any) => completedLessonIds.has(String(l.id))).length;
    const visitedResourceIds = new Set<string>((moduleStats?.visitedResourceIds || progressStats?.visitedResourceIds || []).map(String));
    const isTaskSubmitted = (sub: any) => sub && sub.status !== 'AVAILABLE' && sub.status !== 'LOCKED';
    const tasksSubmitted = tasks.filter((t: any) => isTaskSubmitted(subByAssignment.get(t.id))).length;
    const tasksScored = tasks.filter((t: any) => {
      const s = subByAssignment.get(t.id);
      return s && typeof s.score === 'number';
    });
    const totalGained = tasksScored.reduce((sum: number, t: any) => sum + Number(subByAssignment.get(t.id)?.score || 0), 0);
    const totalMax = tasks.reduce((sum: number, t: any) => sum + Number(t.maxScore || 100), 0);

    const visitedResourcesCount = moduleStats?.visitedResources ?? resources.filter((r: any) => visitedResourceIds.has(String(r.id))).length;

    // Module progress from backend (computed-on-read, §2 — single source of truth)
    const totalVisibleItems = lessons.length + tasks.length;
    const completedVisibleItems = Math.min(completedLessons, lessons.length) + Math.min(tasksSubmitted, tasks.length);
    const progressPercent = totalVisibleItems > 0 ? Math.round((completedVisibleItems / totalVisibleItems) * 100) : 0;

    const rawObj = openModuleData?.objectives;
    const rawKeyPoints = Array.isArray(openModuleData?.keyPoints)
      ? openModuleData.keyPoints.map((kp: any) => kp.title || kp.description || kp).filter(Boolean)
      : [];

    const objectives: string[] = Array.isArray(rawObj) && rawObj.length
      ? rawObj
      : typeof rawObj === 'string' && rawObj.trim()
        ? rawObj.split('\n').map((s: string) => s.trim()).filter(Boolean)
        : rawKeyPoints.length > 0
          ? rawKeyPoints
          : [
            `Master the core concepts and principles of ${openModuleData.title || 'this module'}`,
            `Complete all guided lessons and practical coursework`,
~            `Submit assessments to validate practical knowledge and understanding`,
            `Demonstrate proficiency across key competency metrics`,
          ];

    const rawOut = openModuleData?.outcomes;
    const outcomes: string[] = Array.isArray(rawOut) && rawOut.length
      ? rawOut
      : typeof rawOut === 'string' && rawOut.trim()
        ? rawOut.split('\n').map((s: string) => s.trim()).filter(Boolean)
        : [
          `Ability to independently apply concepts learned in ${openModuleData.title || 'this module'}`,
          `Practical implementation and hands-on problem solving skills`,
          `Successful evaluation and verified completion of all assigned module tasks`,
          `Solid foundation to advance to subsequent curriculum milestones`,
        ];

    const tabLabels: Array<['Lessons' | 'Tasks', string]> = [
      ['Lessons', `Lessons (${completedLessons}/${lessons.length})`],
      ['Tasks', `Tasks (${tasksSubmitted}/${tasks.length})`],
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
            {modules.length > 1 ? (
              <div
                style={{ position: 'relative' }}
                tabIndex={-1}
                onBlur={(e) => {
                  if (!e.currentTarget.contains(e.relatedTarget as Node)) {
                    setIsModuleDropdownOpen(false);
                  }
                }}
              >
                <button
                  type="button"
                  onClick={() => setIsModuleDropdownOpen(!isModuleDropdownOpen)}
                  style={{
                    border: '1px solid #e2e8f0',
                    borderRadius: 6,
                    background: '#f8fafc',
                    color: '#0f172a',
                    fontWeight: 600,
                    fontSize: 12,
                    padding: '6px 32px 6px 12px',
                    cursor: 'pointer',
                    outline: 'none',
                    display: 'flex',
                    alignItems: 'center',
                    gap: 8,
                    position: 'relative'
                  }}
                >
                  {modules.find((m: any) => m.id === openModuleId)?.title || 'Select Module'}
                  <svg style={{ position: 'absolute', right: 8, transition: 'transform 0.2s', transform: isModuleDropdownOpen ? 'rotate(180deg)' : 'rotate(0)' }} xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#64748b" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="6 9 12 15 18 9"></polyline></svg>
                </button>
                {isModuleDropdownOpen && (
                  <div style={{
                    position: 'absolute',
                    top: '100%',
                    left: 0,
                    marginTop: 4,
                    background: '#fff',
                    border: '1px solid #e2e8f0',
                    borderRadius: 6,
                    boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.1), 0 4px 6px -2px rgba(0, 0, 0, 0.05)',
                    zIndex: 50,
                    minWidth: 200,
                    maxHeight: 300,
                    overflowY: 'auto'
                  }}>
                    {modules.map((m: any) => (
                      <button
                        key={m.id}
                        type="button"
                        onClick={() => {
                          void openModule(m.id);
                          setIsModuleDropdownOpen(false);
                        }}
                        style={{
                          display: 'block',
                          width: '100%',
                          textAlign: 'left',
                          padding: '10px 16px',
                          border: 'none',
                          background: m.id === openModuleId ? '#e0e7ff' : '#fff',
                          color: m.id === openModuleId ? '#4f46e5' : '#334155',
                          fontSize: 13,
                          fontWeight: m.id === openModuleId ? 600 : 400,
                          cursor: 'pointer',
                          borderBottom: '1px solid #f1f5f9',
                          transition: 'all 0.1s ease-in-out'
                        }}
                        onMouseEnter={(e) => { if (m.id !== openModuleId) e.currentTarget.style.background = '#f8fafc'; }}
                        onMouseLeave={(e) => { if (m.id !== openModuleId) e.currentTarget.style.background = '#fff'; }}
                      >
                        {m.title}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            ) : (
              <span style={{ color: '#0f172a', fontWeight: 600 }}>{openModuleData.title}</span>
            )}
          </div>
        </div>

        {/* ── Premium Hero Banner ── */}
        <div style={{ margin: '0 auto 24px auto', maxWidth: 1440, width: '100%', padding: '0 24px', boxSizing: 'border-box', position: 'relative' }}>
          <div style={{
            background: 'linear-gradient(135deg, #312e81 0%, #4f46e5 50%, #8b5cf6 100%)',
            color: '#fff',
            borderRadius: 24,
            padding: '48px 48px 64px 48px',
            position: 'relative',
            overflow: 'hidden',
            boxShadow: '0 20px 40px -10px rgba(79,70,229,0.3)'
          }}>
            {/* Decorative background circles */}
            <div style={{ position: 'absolute', top: -50, right: -50, width: 300, height: 300, background: 'radial-gradient(circle, rgba(255,255,255,0.15) 0%, rgba(255,255,255,0) 70%)', borderRadius: '50%' }} />
            <div style={{ position: 'absolute', bottom: -100, left: 100, width: 250, height: 250, background: 'radial-gradient(circle, rgba(255,255,255,0.1) 0%, rgba(255,255,255,0) 70%)', borderRadius: '50%' }} />

            <p style={{ position: 'relative', fontSize: 12, opacity: 0.9, margin: '0 0 12px', textTransform: 'uppercase', letterSpacing: '0.12em', fontWeight: 800, color: '#e0e7ff' }}>
              MODULE · {(openModuleData.level || 'Beginner').toUpperCase()} · {selectedPathTitle.toUpperCase()}
            </p>
            <div style={{ position: 'relative', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 24 }}>
              <div style={{ flex: 1 }}>
                <h1 style={{ fontSize: 36, margin: '0 0 16px', fontWeight: 900, lineHeight: 1.1, letterSpacing: '-0.02em' }}>{openModuleData.title}</h1>
                <ModuleDescriptionPreview
                  description={openModuleData.description}
                  resources={resources.filter((r: any) => !r.lesson && !r.lessonId)}
                  onShowMore={() => setShowMoreModalOpen(true)}
                />

                {resources.filter((r: any) => !r.lesson && !r.lessonId).length > 0 && (
                  <div style={{ marginTop: 16, background: 'rgba(255,255,255,0.1)', padding: '16px', borderRadius: 12, border: '1px solid rgba(255,255,255,0.2)' }}>
                    <div style={{ fontSize: 13, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 12, color: '#e0e7ff' }}>
                      Module Resources
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                      {resources.filter((r: any) => !r.lesson && !r.lessonId).map((res: any) => (
                        <a
                          key={res.id}
                          href={res.url}
                          target="_blank"
                          rel="noreferrer"
                          onClick={() => { if (res.id && isTrainee) progressService.visitResource(res.id, accessToken).catch(() => { }); }}
                          style={{ color: '#fff', fontSize: 14, textDecoration: 'none', display: 'flex', alignItems: 'center', gap: 8, fontWeight: 500 }}
                          onMouseEnter={(e) => e.currentTarget.style.textDecoration = 'underline'}
                          onMouseLeave={(e) => e.currentTarget.style.textDecoration = 'none'}
                        >
                          <span style={{ fontSize: 16 }}>🔗</span>
                          {res.title}
                        </a>
                      ))}
                    </div>
                  </div>
                )}
              </div>
              <div style={{ textAlign: 'right', flexShrink: 0, background: 'rgba(255,255,255,0.1)', padding: '16px 24px', borderRadius: 16, backdropFilter: 'blur(10px)', border: '1px solid rgba(255,255,255,0.2)' }}>
                <div style={{ fontSize: 12, opacity: 0.9, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 4 }}>Module Progress</div>
                <div style={{ fontSize: 48, fontWeight: 900, lineHeight: 1 }}>{progressPercent}%</div>
              </div>
            </div>

            {/* Progress bar */}
            <div style={{ position: 'relative', width: '100%', height: 8, background: 'rgba(255,255,255,0.2)', borderRadius: 999, marginTop: 32, overflow: 'hidden' }}>
              <div style={{ width: `${progressPercent}%`, height: '100%', background: '#10b981', borderRadius: 999, transition: 'width 1s cubic-bezier(0.4, 0, 0.2, 1)', boxShadow: '0 0 10px rgba(16,185,129,0.5)' }} />
            </div>
          </div>

          {/* Overlapping Stats Row */}
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(4,1fr)',
            gap: 20,
            padding: '0 32px',
            marginTop: -32,
            position: 'relative',
            zIndex: 10
          }}>
            {[
              { icon: '⏱️', label: 'Duration', value: openModuleData.durationLabel || `${openModuleData.durationWeeks || 2} weeks` },
              { icon: '📖', label: 'Lessons', value: isTrainee ? `${completedLessons}/${lessons.length} done` : `${lessons.length} total` },
              { icon: '🎯', label: 'Tasks', value: isTrainee ? `${tasksSubmitted}/${tasks.length} submitted` : `${tasks.length} assigned` },
              { icon: '🏆', label: 'Avg. Score', value: tasks.length > 0 ? `${totalGained}/${totalMax}` : `0/0` },
            ].map((m) => (
              <div key={m.label} style={{
                background: 'rgba(255, 255, 255, 0.95)',
                backdropFilter: 'blur(10px)',
                padding: '20px',
                borderRadius: 16,
                border: '1px solid rgba(255,255,255,0.8)',
                boxShadow: '0 10px 25px -5px rgba(0,0,0,0.05), 0 8px 10px -6px rgba(0,0,0,0.01)',
                display: 'flex',
                alignItems: 'center',
                gap: 16,
                transition: 'transform 0.2s',
                cursor: 'default'
              }}
                onMouseEnter={(e) => e.currentTarget.style.transform = 'translateY(-4px)'}
                onMouseLeave={(e) => e.currentTarget.style.transform = 'translateY(0)'}
              >
                <div style={{
                  width: 48, height: 48, borderRadius: 12,
                  background: '#f1f5f9', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 24
                }}>
                  {m.icon}
                </div>
                <div>
                  <span style={{ display: 'block', fontSize: 12, color: '#64748b', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 2 }}>{m.label}</span>
                  <strong style={{ fontSize: 18, color: '#0f172a', fontWeight: 800 }}>{m.value}</strong>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* ── Body ── */}
        <div style={{ padding: '28px 32px', maxWidth: 1440, margin: '0 auto' }}>

          {/* Objectives + Outcomes */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 24, marginBottom: 40, marginTop: 12 }}>
            <div style={{
              background: 'linear-gradient(to right, #ffffff, #f8fafc)',
              padding: 32,
              borderRadius: 20,
              border: '1px solid #e2e8f0',
              borderLeft: '6px solid #4f46e5',
              boxShadow: '0 4px 6px -1px rgba(0,0,0,0.02)'
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 20 }}>
                <div style={{ width: 36, height: 36, borderRadius: 10, background: '#e0e7ff', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#4f46e5' }}>
                  <svg width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M13 10V3L4 14h7v7l9-11h-7z"></path></svg>
                </div>
                <h4 style={{ margin: 0, color: '#1e293b', fontSize: 18, fontWeight: 800 }}>Learning Objectives</h4>
              </div>
              <ul style={{ margin: 0, paddingLeft: 0, listStyle: 'none', display: 'flex', flexDirection: 'column', gap: 12 }}>
                {objectives.map((o, i) => (
                  <li key={i} style={{ display: 'flex', alignItems: 'flex-start', gap: 12, color: '#475569', fontSize: 14, lineHeight: 1.6 }}>
                    <div style={{ width: 6, height: 6, borderRadius: '50%', background: '#818cf8', marginTop: 8, flexShrink: 0 }} />
                    {o}
                  </li>
                ))}
              </ul>
            </div>
            <div style={{
              background: 'linear-gradient(to right, #ffffff, #f8fafc)',
              padding: 32,
              borderRadius: 20,
              border: '1px solid #e2e8f0',
              borderLeft: '6px solid #10b981',
              boxShadow: '0 4px 6px -1px rgba(0,0,0,0.02)'
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 20 }}>
                <div style={{ width: 36, height: 36, borderRadius: 10, background: '#d1fae5', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#10b981' }}>
                  <svg width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"></path></svg>
                </div>
                <h4 style={{ margin: 0, color: '#1e293b', fontSize: 18, fontWeight: 800 }}>Learning Outcomes</h4>
              </div>
              <ul style={{ margin: 0, paddingLeft: 0, listStyle: 'none', display: 'flex', flexDirection: 'column', gap: 12 }}>
                {outcomes.map((o, i) => (
                  <li key={i} style={{ display: 'flex', alignItems: 'flex-start', gap: 12, color: '#475569', fontSize: 14, lineHeight: 1.6 }}>
                    <div style={{ color: '#10b981', marginTop: 2, flexShrink: 0 }}>
                      <svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth="3" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7"></path></svg>
                    </div>
                    {o}
                  </li>
                ))}
              </ul>
            </div>
          </div>

          {/* Modern Tabs */}
          <div className="modules-management-tabs-container" style={{ display: 'flex', gap: 8, marginBottom: 24, background: '#f1f5f9', padding: 6, borderRadius: 14, overflowX: 'auto', maxWidth: '100%' }}>
            {tabLabels.map(([key, label]) => (
              <button
                key={key}
                type="button"
                onClick={() => setActiveTab(key)}
                style={{
                  padding: '10px 24px',
                  border: 'none',
                  background: activeTab === key ? '#fff' : 'transparent',
                  borderRadius: 10,
                  cursor: 'pointer',
                  fontWeight: activeTab === key ? 700 : 600,
                  fontSize: 14,
                  color: activeTab === key ? '#4f46e5' : '#64748b',
                  boxShadow: activeTab === key ? '0 4px 6px -1px rgba(0,0,0,0.05), 0 2px 4px -1px rgba(0,0,0,0.03)' : 'none',
                  transition: 'all 0.2s',
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
                  <div key={lesson.id} style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                    <LessonCard
                      lesson={{ ...lesson, title: `${lIdx + 1}. ${lesson.title}` }}
                      isDone={isDone}
                      isLocked={lesson.isLocked}
                      isTrainee={isTrainee}
                      resources={lesson.resources || resources.filter((r: any) => String(r.lesson?.id || r.lessonId) === String(lesson.id))}
                      onVisitResource={(res) => {
                        if (res.id && isTrainee) progressService.visitResource(res.id, accessToken).catch(() => { });
                      }}
                      onMarkWatched={markLessonWatched}
                      onClickLocked={() => lesson.isLocked && toast.warning(lesson.lockReason)}
                    />
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
                    'Approved': { bg: '#dcfce7', color: '#166534' },
                    'Rejected': { bg: '#fee2e2', color: '#b91c1c' },
                    'Submitted': { bg: '#fef3c7', color: '#b45309' },
                    'Not Started': { bg: '#f1f5f9', color: '#475569' },
                  };
                  const sc = statusColors[status] || statusColors['Not Started'];
                  return (
                    <AssignmentCard
                      key={task.id}
                      task={task}
                      submission={sub}
                      isLocked={task.isLocked}
                      lockReason={task.lockReason}
                      isTrainee={isTrainee}
                      onClickLocked={(r) => toast.warning(r || 'Locked')}
                      onAttempt={(t) => { setSubmitTask(t); setSubmissionText(''); setSubjectiveAnswers({}); setMcqAnswers({}); }}
                    />
                  );
                })
              )}
            </div>
          )}

          {/* Resources tab removed */}

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
                    Submitted: {tasksSubmitted}
                  </p>
                  {tasks.map((task: any) => {
                    const sub = subByAssignment.get(task.id);
                    const isLocked = task.isLocked;

                    let timeLeftStr = '';
                    let isOverdue = false;
                    const status = task.status || (sub ? sub.status : 'not_started');

                    if (status === 'started' && task.computedDeadline) {
                      const deadline = new Date(task.computedDeadline);
                      const diff = deadline.getTime() - currentTime.getTime();
                      if (diff <= 0) {
                        isOverdue = true;
                        timeLeftStr = 'Time is up!';
                      } else {
                        const d = Math.floor(diff / (1000 * 60 * 60 * 24));
                        const h = Math.floor((diff / (1000 * 60 * 60)) % 24);
                        const m = Math.floor((diff / 1000 / 60) % 60);
                        const s = Math.floor((diff / 1000) % 60);
                        timeLeftStr = `${d}d ${h}h ${m}m ${s}s left`;
                      }
                    }

                    const hasDuration = (task.durationDays || 0) > 0 || (task.durationHours || 0) > 0 || (task.durationMinutes || 0) > 0;
                    const canSubmit = !hasDuration || status === 'started' || status === 'Submitted' || status === 'Approved' || status === 'Rejected' || status === 'Overdue';

                    return (
                      <div key={task.id} style={{ padding: '14px 18px', background: isLocked ? '#f1f5f9' : '#f8fafc', borderRadius: 10, marginBottom: 10, display: 'flex', justifyContent: 'space-between', alignItems: 'center', opacity: isLocked ? 0.6 : 1 }}>
                        <div>
                          <strong style={{ fontSize: 14 }}>
                            {isLocked && <span style={{ marginRight: 6 }}>🔒</span>}
                            {task.title}
                          </strong>
                          <div style={{ fontSize: 12, color: '#64748b', marginTop: 2 }}>{task.assignmentType}</div>
                          {isLocked && task.lockReason && (
                            <div style={{ fontSize: 11, color: '#ef4444', marginTop: 4 }}>{task.lockReason}</div>
                          )}
                          {!isLocked && status === 'started' && (
                            <div style={{ fontSize: 13, color: isOverdue ? '#ef4444' : '#f59e0b', fontWeight: 600, marginTop: 6 }}>
                              ⏳ {timeLeftStr}
                            </div>
                          )}
                          {!isLocked && status === 'Overdue' && (
                            <div style={{ fontSize: 13, color: '#ef4444', fontWeight: 600, marginTop: 6 }}>
                              ⚠️ Overdue
                            </div>
                          )}
                        </div>
                        <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
                          {typeof sub?.score === 'number' && (
                            <span style={{ fontWeight: 700, fontSize: 15, color: sub.score >= 75 ? '#16a34a' : sub.score >= 35 ? '#b45309' : '#dc2626' }}>
                              {sub.score}/{task.maxScore || 100}
                            </span>
                          )}

                          {isTrainee && !isLocked && (
                            <>
                              {!canSubmit && status !== 'started' && (
                                <button
                                  type="button"
                                  onClick={() => handleStartTask(task.id)}
                                  style={{ padding: '6px 14px', background: '#0f172a', color: '#fff', border: 'none', borderRadius: 8, fontSize: 13, fontWeight: 700, cursor: 'pointer' }}
                                >
                                  Now I will do task
                                </button>
                              )}

                              {canSubmit && (!sub || (sub.status !== 'Approved' && sub.status !== 'Evaluated')) && (
                                <button
                                  type="button"
                                  onClick={() => {
                                    setSubmitTask(task);

                                    let prefilledMcq = {};
                                    let prefilledSubj = {};
                                    let prefilledText = '';
                                    if (sub?.submissionText) {
                                      try {
                                        prefilledText = sub.submissionText;
                                        if (sub.submissionText.startsWith('{')) {
                                          const parsed = JSON.parse(sub.submissionText);
                                          prefilledMcq = parsed.answers || {};
                                          prefilledSubj = parsed.textAnswers || {};
                                        }
                                      } catch (e) { }
                                    }

                                    setSubmissionText(prefilledText);
                                    setSubjectiveAnswers(prefilledSubj);
                                    setMcqAnswers(prefilledMcq);
                                  }}
                                  disabled={isOverdue || status === 'Overdue'}
                                  style={{ padding: '6px 14px', background: isOverdue || status === 'Overdue' ? '#cbd5e1' : 'linear-gradient(135deg,#6366f1,#4f46e5)', color: '#fff', border: 'none', borderRadius: 8, fontSize: 13, fontWeight: 700, cursor: isOverdue || status === 'Overdue' ? 'not-allowed' : 'pointer' }}
                                >
                                  {sub ? 'Resubmit' : 'Submit'}
                                </button>
                              )}
                            </>
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

              {submitTask && (
        <SharedAssignmentModal
          task={submitTask}
          submission={subByAssignment.get(submitTask.id)}
          accessToken={accessToken}
          onClose={() => setSubmitTask(null)}
          onSuccess={() => {
              if (openModuleId) openModule(openModuleId);
              refreshNotifications();
          }}
        />
      )}
      </div>
    );
  }

  // ─────────────────────────────────────────────────────────────────────────
  // MODULE LIST VIEW
  // ─────────────────────────────────────────────────────────────────────────
  return (
    <div style={{ padding: '24px 32px', maxWidth: '1440px', margin: '0 auto', fontFamily: 'Inter, system-ui, sans-serif' }}>

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
              {(() => {
                const currentLP = allPaths.find(p => p.id === selectedPathId);
                const lpLessonLock = currentLP?.lockLessons === true;
                const lpTaskLock = currentLP?.lockTasks === true;

                if (lpLessonLock && lpTaskLock) return null;

                return (
                  <div style={{ display: 'flex', gap: 24, padding: '12px 16px', background: '#f8fafc', borderRadius: 10, border: '1px solid #e2e8f0', marginTop: 8 }}>
                    {!lpLessonLock && (
                      <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', fontSize: 13, fontWeight: 600, color: '#334155' }}>
                        <input type="checkbox" checked={moduleLessonLocking} onChange={e => setModuleLessonLocking(e.target.checked)} style={{ width: 16, height: 16, cursor: 'pointer', accentColor: '#4f46e5' }} />
                        Lock Lessons (Sequential unlock)
                      </label>
                    )}
                    {!lpTaskLock && (
                      <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', fontSize: 13, fontWeight: 600, color: '#334155' }}>
                        <input type="checkbox" checked={moduleTaskLocking} onChange={e => setModuleTaskLocking(e.target.checked)} style={{ width: 16, height: 16, cursor: 'pointer', accentColor: '#4f46e5' }} />
                        Lock Tasks (Require all lessons)
                      </label>
                    )}
                  </div>
                );
              })()}
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
      {showMoreModalOpen && (
        <ModuleShowMoreModal
          description={openModuleData?.description}
          resources={(openModuleData?.resources || []).filter((r: any) => !r.lesson && !r.lessonId)}
          onClose={() => setShowMoreModalOpen(false)}
          onVisitResource={(id) => { if (isTrainee) progressService.visitResource(id, accessToken).catch(() => { }); }}
          isTrainee={isTrainee}
        />
      )}
    </div>
  );
}