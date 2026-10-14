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
import { Clock, BookOpen, CheckSquare, Award } from 'lucide-react';

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

  // ── Learning Path Details & Summary Progress ──────────────────────────────
  const [currentPathDetails, setCurrentPathDetails] = useState<any | null>(null);
  const [pathProgressSummary, setPathProgressSummary] = useState<Record<string, any>>({});

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

  // ── Load selected path details & summary progress ─────────────────────────
  useEffect(() => {
    if (!selectedPathId) return;
    learningPathService.fetchPathById(selectedPathId, accessToken)
      .then((data: any) => setCurrentPathDetails(data))
      .catch(() => { });

    if (isTrainee) {
      progressService.fetchPathProgressSummary(accessToken)
        .then((summary: any) => setPathProgressSummary(summary || {}))
        .catch(() => { });
    }
  }, [selectedPathId, accessToken, isTrainee]);

  // ── Load modules when path changes ────────────────────────────────────────
  useEffect(() => {
    if (!selectedPathId) return;
    setIsLoading(true);
    // Don't clear modules here if we're just switching URL module IDs for the same path
    curriculumService.fetchModulesByPath(selectedPathId, accessToken)
      .then((data: any) => {
        const mods = Array.isArray(data) ? data : [];
        setModules(mods);

        // Open module ONLY if explicitly requested by URL or navigation state
        const targetModuleId = urlModuleId || (location.state as any)?.moduleId;
        if (targetModuleId && mods.some((m: any) => m.id === targetModuleId)) {
          void openModule(targetModuleId, true);
        } else if (openModuleId && mods.some((m: any) => m.id === openModuleId)) {
          void openModule(openModuleId, true);
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
    setOpenModuleId(null);
    setOpenModuleData(null);
    setModuleStats(null);
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
                setOpenModuleId(null);
                setOpenModuleData(null);
                setModuleStats(null);
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

    // ── Module progress calculation ──────────────────────────────────────────
    // Formula: ((total task completed + total lesson completed) / (total lesson + task)) * 100
    const completedLessons = Math.min(
      lessons.length,
      Math.max(
        moduleStats?.completedLessons || 0,
        lessons.filter((l: any) => completedLessonIds.has(String(l.id))).length
      )
    );
    const visitedResourceIds = new Set<string>((moduleStats?.visitedResourceIds || progressStats?.visitedResourceIds || []).map(String));
    
    const isTaskCompleted = (t: any) => {
      const sub = subByAssignment.get(t.id);
      if (!sub) return false;
      const status = String(sub.status || '').toUpperCase();
      return status !== 'AVAILABLE' && status !== 'LOCKED' && status !== '';
    };

    const tasksSubmitted = Math.min(
      tasks.length,
      tasks.filter((t: any) => isTaskCompleted(t)).length
    );

    const tasksScored = tasks.filter((t: any) => {
      const s = subByAssignment.get(t.id);
      return s && typeof s.score === 'number';
    });
    const totalGained = tasksScored.reduce((sum: number, t: any) => sum + Number(subByAssignment.get(t.id)?.score || 0), 0);
    const totalMax = tasks.reduce((sum: number, t: any) => sum + Number(t.maxScore || 100), 0);

    const visitedResourcesCount = moduleStats?.visitedResources ?? resources.filter((r: any) => visitedResourceIds.has(String(r.id))).length;

    // Strict pooled progress: ((completedTasks + completedLessons) / (totalLessons + totalTasks)) * 100
    const totalLessonsCount = lessons.length;
    const totalTasksCount = tasks.length;
    const totalItems = totalLessonsCount + totalTasksCount;
    const completedItems = completedLessons + tasksSubmitted;
    const progressPercent = totalItems > 0 
      ? Math.min(100, Math.max(0, Math.round((completedItems / totalItems) * 100))) 
      : 0;

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

    // Progress circle SVG parameters (matching overview page)
    const moduleCircleRadius = 26;
    const moduleCircleCircumference = 2 * Math.PI * moduleCircleRadius;
    const moduleCircleStrokeDashoffset = moduleCircleCircumference - (moduleCircleCircumference * progressPercent) / 100;

    return (
      <div className="module-detail-container">

        {/* ── Top Header / Breadcrumbs ── */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20, flexWrap: 'wrap', gap: 12 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, color: '#64748b', flexWrap: 'wrap' }}>
            <button
              type="button"
              onClick={onBack}
              style={{ border: 'none', background: 'none', color: '#4f46e5', fontWeight: 600, cursor: 'pointer', padding: 0, fontSize: 13, display: 'flex', alignItems: 'center', gap: 4 }}
            >
              ← Learning Paths
            </button>
            <span>›</span>
            <button
              type="button"
              onClick={closeModule}
              style={{ border: 'none', background: 'none', color: '#4f46e5', fontWeight: 600, cursor: 'pointer', padding: 0, fontSize: 13 }}
              title="View all modules in this Learning Path"
            >
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
                    border: '1.5px solid #e2e8f0',
                    borderRadius: 8,
                    background: '#ffffff',
                    color: '#0f172a',
                    fontWeight: 700,
                    fontSize: 12.5,
                    padding: '6px 28px 6px 12px',
                    cursor: 'pointer',
                    outline: 'none',
                    display: 'flex',
                    alignItems: 'center',
                    gap: 8,
                    position: 'relative',
                    boxShadow: '0 1px 2px rgba(0,0,0,0.04)'
                  }}
                >
                  {modules.find((m: any) => m.id === openModuleId)?.title || 'Select Module'}
                  <svg style={{ position: 'absolute', right: 8, transition: 'transform 0.2s', transform: isModuleDropdownOpen ? 'rotate(180deg)' : 'rotate(0)' }} xmlns="http://www.w3.org/2000/svg" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#64748b" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="6 9 12 15 18 9"></polyline></svg>
                </button>
                {isModuleDropdownOpen && (
                  <div style={{
                    position: 'absolute',
                    top: 'calc(100% + 4px)',
                    left: 0,
                    background: '#fff',
                    border: '1px solid #e2e8f0',
                    borderRadius: 10,
                    boxShadow: '0 12px 24px -4px rgba(15, 23, 42, 0.12), 0 4px 6px -2px rgba(15, 23, 42, 0.04)',
                    zIndex: 50,
                    minWidth: 220,
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
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                          width: '100%',
                          textAlign: 'left',
                          padding: '10px 14px',
                          border: 'none',
                          background: m.id === openModuleId ? '#eef2ff' : '#fff',
                          color: m.id === openModuleId ? '#4338ca' : '#334155',
                          fontSize: 13,
                          fontWeight: m.id === openModuleId ? 700 : 500,
                          cursor: 'pointer',
                          borderBottom: '1px solid #f8fafc',
                          transition: 'all 0.15s ease'
                        }}
                        onMouseEnter={(e) => { if (m.id !== openModuleId) e.currentTarget.style.background = '#f8fafc'; }}
                        onMouseLeave={(e) => { if (m.id !== openModuleId) e.currentTarget.style.background = '#fff'; }}
                      >
                        <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{m.title}</span>
                        {m.id === openModuleId && <span style={{ color: '#4f46e5', fontSize: 13, fontWeight: 800 }}>✓</span>}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            ) : (
              <span style={{ color: '#0f172a', fontWeight: 700 }}>{openModuleData.title}</span>
            )}
          </div>

          {/* Navigation back to all modules button */}
          <button
            type="button"
            onClick={closeModule}
            className="btn-module-outline"
            style={{ padding: '7px 16px', fontSize: 12.5, fontWeight: 600 }}
            title="Return to the curriculum overview with all modules"
          >
            ← Back to all modules
          </button>
        </div>

        {/* ── Module Executive Hero Banner (Matches Overview Design) ── */}
        <div className="lp-hero-card">
          <div className="lp-hero-circle-accent1" />
          <div className="lp-hero-circle-accent2" />

          <div className="lp-hero-content">
            <div className="lp-hero-left">
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12, flexWrap: 'wrap' }}>
                <span style={{
                  background: 'rgba(255, 255, 255, 0.15)',
                  border: '1px solid rgba(255, 255, 255, 0.25)',
                  borderRadius: 6,
                  padding: '2px 8px',
                  fontSize: 10.5,
                  fontWeight: 800,
                  letterSpacing: '0.06em',
                  color: '#ffffff',
                  textTransform: 'uppercase'
                }}>
                  Module
                </span>
                <span style={{ fontSize: 12, color: 'rgba(255, 255, 255, 0.4)' }}>•</span>
                <span style={{ fontSize: 11.5, fontWeight: 700, color: 'rgba(224, 231, 255, 0.9)', letterSpacing: '0.05em', textTransform: 'uppercase' }}>
                  {(openModuleData.level || 'Beginner').toUpperCase()}
                </span>
                <span style={{ fontSize: 12, color: 'rgba(255, 255, 255, 0.4)' }}>•</span>
                <span style={{ fontSize: 11.5, fontWeight: 700, color: 'rgba(224, 231, 255, 0.9)', letterSpacing: '0.05em', textTransform: 'uppercase' }}>
                  {selectedPathTitle.toUpperCase()}
                </span>
              </div>

              <h1 className="lp-hero-title">
                {openModuleData.title}
              </h1>

              <ModuleDescriptionPreview
                description={openModuleData.description}
                resources={resources.filter((r: any) => !r.lesson && !r.lessonId)}
                onShowMore={() => setShowMoreModalOpen(true)}
              />

              {resources.filter((r: any) => !r.lesson && !r.lessonId).length > 0 && (
                <div style={{ marginTop: 16, background: 'rgba(255,255,255,0.08)', padding: '14px 18px', borderRadius: 12, border: '1px solid rgba(255,255,255,0.15)', backdropFilter: 'blur(8px)' }}>
                  <div style={{ fontSize: 11.5, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 10, color: '#e0e7ff' }}>
                    Module Resources
                  </div>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10 }}>
                    {resources.filter((r: any) => !r.lesson && !r.lessonId).map((res: any) => (
                      <a
                        key={res.id}
                        href={res.url}
                        target="_blank"
                        rel="noreferrer"
                        onClick={() => { if (res.id && isTrainee) progressService.visitResource(res.id, accessToken).catch(() => { }); }}
                        style={{ color: '#fff', fontSize: 13, textDecoration: 'none', display: 'inline-flex', alignItems: 'center', gap: 6, fontWeight: 600, background: 'rgba(255,255,255,0.12)', padding: '5px 12px', borderRadius: 8, transition: 'background 0.15s' }}
                        onMouseEnter={(e) => e.currentTarget.style.background = 'rgba(255,255,255,0.22)'}
                        onMouseLeave={(e) => e.currentTarget.style.background = 'rgba(255,255,255,0.12)'}
                      >
                        <span>🔗</span>
                        {res.title}
                      </a>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Circular Progress Widget (Identical to Overview Page) */}
            <div className="lp-hero-progress-widget">
              <div className="lp-progress-circle-wrap">
                <svg className="lp-progress-circle-svg" viewBox="0 0 60 60">
                  <circle cx="30" cy="30" r={moduleCircleRadius} stroke="rgba(255,255,255,0.18)" strokeWidth="5" fill="none" />
                  <circle
                    cx="30"
                    cy="30"
                    r={moduleCircleRadius}
                    stroke={progressPercent === 100 ? '#10b981' : '#38bdf8'}
                    strokeWidth="5"
                    fill="none"
                    strokeDasharray={moduleCircleCircumference}
                    strokeDashoffset={moduleCircleStrokeDashoffset}
                    strokeLinecap="round"
                  />
                </svg>
                <div className="lp-progress-circle-text">
                  <span className="lp-progress-circle-pct">{progressPercent}%</span>
                  <span className="lp-progress-circle-label">PROGRESS</span>
                </div>
              </div>
              <div className="lp-progress-widget-text">
                <h4>{progressPercent === 100 ? 'Module Completed' : progressPercent > 0 ? 'In Progress' : 'Not Started'}</h4>
                <p>{completedLessons} of {lessons.length} lessons done</p>
              </div>
            </div>
          </div>
        </div>

        {/* ── Key Metrics Strip (Clean, non-overlapping) ── */}
        <div className="lp-stats-strip" style={{ marginTop: 18 }}>
          <div className="lp-stat-pill-card">
            <div className="lp-stat-icon-wrap" style={{ background: '#f8fafc', color: '#475569', border: '1px solid #e2e8f0' }}>
              <Clock size={16} strokeWidth={1.75} />
            </div>
            <div className="lp-stat-info">
              <strong>{openModuleData.durationLabel || `${openModuleData.durationWeeks || 2} weeks`}</strong>
              <span>Duration</span>
            </div>
          </div>

          <div className="lp-stat-pill-card">
            <div className="lp-stat-icon-wrap" style={{ background: '#f8fafc', color: '#475569', border: '1px solid #e2e8f0' }}>
              <BookOpen size={16} strokeWidth={1.75} />
            </div>
            <div className="lp-stat-info">
              <strong>{isTrainee ? `${completedLessons}/${lessons.length} done` : `${lessons.length} total`}</strong>
              <span>Lessons</span>
            </div>
          </div>

          <div className="lp-stat-pill-card">
            <div className="lp-stat-icon-wrap" style={{ background: '#f8fafc', color: '#475569', border: '1px solid #e2e8f0' }}>
              <CheckSquare size={16} strokeWidth={1.75} />
            </div>
            <div className="lp-stat-info">
              <strong>{isTrainee ? `${tasksSubmitted}/${tasks.length} submitted` : `${tasks.length} assigned`}</strong>
              <span>Tasks</span>
            </div>
          </div>

          <div className="lp-stat-pill-card">
            <div className="lp-stat-icon-wrap" style={{ background: '#f8fafc', color: '#475569', border: '1px solid #e2e8f0' }}>
              <Award size={16} strokeWidth={1.75} />
            </div>
            <div className="lp-stat-info">
              <strong>{tasks.length > 0 ? `${totalGained}/${totalMax}` : '0/0'}</strong>
              <span>Avg. Score</span>
            </div>
          </div>
        </div>

        {/* ── Learning Objectives & Outcomes ── */}
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(340px, 1fr))',
          gap: 20,
          marginTop: 24,
          marginBottom: 32,
          boxSizing: 'border-box'
        }}>
          {/* Objectives Card */}
          <div style={{
            background: '#ffffff',
            borderRadius: 16,
            border: '1.5px solid #e2e8f0',
            padding: '24px 26px',
            boxShadow: '0 1px 3px rgba(15, 23, 42, 0.03)',
            transition: 'all 0.2s ease',
            display: 'flex',
            flexDirection: 'column',
            gap: 16
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <div style={{
                width: 36,
                height: 36,
                borderRadius: 10,
                background: '#eef2ff',
                color: '#4f46e5',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                flexShrink: 0
              }}>
                <svg width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M13 10V3L4 14h7v7l9-11h-7z"></path></svg>
              </div>
              <div>
                <h4 style={{ margin: 0, color: '#0f172a', fontSize: 16, fontWeight: 700, letterSpacing: '-0.01em' }}>
                  Learning Objectives
                </h4>
                <span style={{ fontSize: 12, color: '#64748b' }}>Core concepts and focus areas</span>
              </div>
            </div>
            <ul style={{ margin: 0, padding: 0, listStyle: 'none', display: 'flex', flexDirection: 'column', gap: 10 }}>
              {objectives.map((o, i) => (
                <li key={i} style={{ display: 'flex', alignItems: 'flex-start', gap: 10, color: '#334155', fontSize: 13.5, lineHeight: 1.55 }}>
                  <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#6366f1', marginTop: 7, flexShrink: 0 }} />
                  <span>{o}</span>
                </li>
              ))}
            </ul>
          </div>

          {/* Outcomes Card */}
          <div style={{
            background: '#ffffff',
            borderRadius: 16,
            border: '1.5px solid #e2e8f0',
            padding: '24px 26px',
            boxShadow: '0 1px 3px rgba(15, 23, 42, 0.03)',
            transition: 'all 0.2s ease',
            display: 'flex',
            flexDirection: 'column',
            gap: 16
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <div style={{
                width: 36,
                height: 36,
                borderRadius: 10,
                background: '#ecfdf5',
                color: '#059669',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                flexShrink: 0
              }}>
                <svg width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"></path></svg>
              </div>
              <div>
                <h4 style={{ margin: 0, color: '#0f172a', fontSize: 16, fontWeight: 700, letterSpacing: '-0.01em' }}>
                  Learning Outcomes
                </h4>
                <span style={{ fontSize: 12, color: '#64748b' }}>Practical capabilities & competencies</span>
              </div>
            </div>
            <ul style={{ margin: 0, padding: 0, listStyle: 'none', display: 'flex', flexDirection: 'column', gap: 10 }}>
              {outcomes.map((o, i) => (
                <li key={i} style={{ display: 'flex', alignItems: 'flex-start', gap: 10, color: '#334155', fontSize: 13.5, lineHeight: 1.55 }}>
                  <svg width="16" height="16" fill="none" stroke="#059669" strokeWidth="2.5" viewBox="0 0 24 24" style={{ marginTop: 3, flexShrink: 0 }}><polyline points="20 6 9 17 4 12"></polyline></svg>
                  <span>{o}</span>
                </li>
              ))}
            </ul>
          </div>
        </div>

        {/* ── Modern Tabs Bar ── */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20, flexWrap: 'wrap', gap: 12 }}>
          <div style={{
            display: 'inline-flex',
            background: '#f1f5f9',
            padding: 4,
            borderRadius: 12,
            border: '1px solid #e2e8f0',
            gap: 4
          }}>
            {tabLabels.map(([key, label]) => {
              const countMatch = label.match(/\((.*?)\)/);
              const countText = countMatch ? countMatch[1] : '';
              const tabName = key;
              const isActive = activeTab === key;
              return (
                <button
                  key={key}
                  type="button"
                  onClick={() => setActiveTab(key)}
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: 8,
                    padding: '8px 18px',
                    border: isActive ? '1px solid rgba(0,0,0,0.06)' : '1px solid transparent',
                    background: isActive ? '#ffffff' : 'transparent',
                    borderRadius: 9,
                    cursor: 'pointer',
                    fontWeight: isActive ? 700 : 600,
                    fontSize: 13.5,
                    color: isActive ? '#1e1b4b' : '#64748b',
                    boxShadow: isActive ? '0 2px 6px rgba(15, 23, 42, 0.06)' : 'none',
                    transition: 'all 0.15s ease',
                    outline: 'none'
                  }}
                >
                  <span>{tabName}</span>
                  {countText && (
                    <span style={{
                      padding: '2px 8px',
                      borderRadius: 999,
                      fontSize: 11,
                      fontWeight: 700,
                      background: isActive ? '#eef2ff' : '#e2e8f0',
                      color: isActive ? '#4f46e5' : '#64748b'
                    }}>
                      {countText}
                    </span>
                  )}
                </button>
              );
            })}
          </div>

          <div style={{ fontSize: 13, color: '#64748b', fontWeight: 500 }}>
            {activeTab === 'Lessons' && `${completedLessons} of ${lessons.length} lessons watched`}
            {activeTab === 'Tasks' && `${tasksSubmitted} of ${tasks.length} tasks completed`}
          </div>
        </div>

        {/* ── LESSONS TAB ── */}
        {activeTab === 'Lessons' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {lessons.length === 0 && (
              <div style={{ padding: 32, textAlign: 'center', color: '#94a3b8', background: '#fff', border: '1px dashed #cbd5e1', borderRadius: 12 }}>
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
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {tasks.length === 0 ? (
              <div style={{ padding: 32, textAlign: 'center', color: '#94a3b8', background: '#fff', border: '1px dashed #cbd5e1', borderRadius: 12 }}>
                No tasks assigned yet.
              </div>
            ) : (
              <>
                <div className="tasks-header-row">
                  <span>Task Name</span>
                  <span>Due Date</span>
                  <span style={{ textAlign: 'right' }}>Status & Action</span>
                </div>
                {tasks.map((task: any) => {
                  const sub = subByAssignment.get(task.id);
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
                })}
              </>
            )}
          </div>
        )}

        {/* ── ASSESSMENTS TAB ── */}
        {activeTab === 'Assessments' && (
          <div style={{ background: '#fff', borderRadius: 16, border: '1px solid #e2e8f0', overflow: 'hidden' }}>
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
  // MODULE LIST VIEW (Learning Path & Modules Overview - Screenshot 2)
  // ─────────────────────────────────────────────────────────────────────────
  const activeLP = currentPathDetails || allPaths.find((p: any) => p.id === selectedPathId);
  const lpSummary = pathProgressSummary[selectedPathId];

  // Helper to calculate module progress percentage
  const getModuleProgress = (m: any): number => {
    if (lpSummary?.moduleProgresses?.[m.id] !== undefined) {
      return Math.min(100, Math.max(0, Math.round(Number(lpSummary.moduleProgresses[m.id]))));
    }
    const mLessons = m.lessons || [];
    const mTasks = m.assignments || [];
    const totalItems = mLessons.length + mTasks.length;
    if (totalItems === 0) return 0;

    const completedLessonIdsSet = new Set<string>((progressStats?.completedLessonIds || []).map(String));
    const completedLessonsCount = mLessons.filter((l: any) => completedLessonIdsSet.has(String(l.id))).length;

    const completedTasksCount = mTasks.filter((t: any) => {
      const sub = subByAssignment.get(t.id);
      return sub && String(sub.status || '').toUpperCase() !== 'AVAILABLE';
    }).length;

    return Math.min(100, Math.round(((completedLessonsCount + completedTasksCount) / totalItems) * 100));
  };

  // Overall LP progress percentage
  const overallProgressPercent = typeof lpSummary?.userProgressPercent === 'number'
    ? lpSummary.userProgressPercent
    : modules.length > 0
      ? Math.min(100, Math.max(0, Math.round(modules.reduce((acc: number, m: any) => acc + getModuleProgress(m), 0) / modules.length)))
      : (progressStats?.completionPercent || 0);

  // Lessons counts across LP
  const allLessons = modules.flatMap((m: any) => m.lessons || []);
  const completedLessonIdsSet = new Set<string>((progressStats?.completedLessonIds || []).map(String));
  const completedLessonsInLP = allLessons.filter((l: any) => completedLessonIdsSet.has(String(l.id))).length;
  const totalLessonsInLP = allLessons.length;

  // Total projects / activities count
  const allAssignments = modules.flatMap((m: any) => m.assignments || []);
  const totalProjectsCount = allAssignments.length || 0;

  // Next lesson computation
  const nextIncompleteModule = modules.find((m: any) => getModuleProgress(m) < 100) || modules[0];
  const nextIncompleteLesson = nextIncompleteModule?.lessons?.find((l: any) => !completedLessonIdsSet.has(String(l.id)));
  const nextLessonTitle = nextIncompleteLesson?.title || (nextIncompleteModule?.title ? `${nextIncompleteModule.title} Overview` : 'Next Lesson');
  const nextLessonDuration = nextIncompleteLesson?.durationMinutes || 15;

  // Progress circle SVG parameters (r=26 => circumference ≈ 163.36)
  const circleRadius = 26;
  const circleCircumference = 2 * Math.PI * circleRadius;
  const circleStrokeDashoffset = circleCircumference - (circleCircumference * overallProgressPercent) / 100;

  // Momentum label
  let momentumText = 'Getting started';
  if (overallProgressPercent >= 100) {
    momentumText = 'Path completed!';
  } else if (overallProgressPercent >= 60) {
    momentumText = 'Great momentum';
  } else if (overallProgressPercent >= 25) {
    momentumText = 'Well underway';
  } else if (overallProgressPercent > 0) {
    momentumText = 'Good start';
  }

  // Estimated duration
  const lpDurationDisplay = activeLP?.duration || (() => {
    const totalDays = modules.reduce((sum: number, m: any) => sum + (m.durationWeeks ? m.durationWeeks * 7 : 7), 0);
    return totalDays > 0 ? `${totalDays} days` : '33 days';
  })();

  const stageLabels = ['GETTING STARTED', 'CORE SKILLS', 'PRACTICAL APPLICATION', 'RESPONSIBLE PRACTICE', 'ADVANCED MASTERY'];
  const firstActiveIndex = modules.findIndex((m: any) => getModuleProgress(m) < 100);

  // Sanitize raw HTML tags from Learning Path description
  const cleanLpDescription = (activeLP?.description || '')
    .replace(/<[^>]*>/g, '')
    .replace(/&nbsp;/g, ' ')
    .trim();

  return (
    <div className="lp-overview-container">
      {/* ── Top Header / Breadcrumbs ── */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20, flexWrap: 'wrap', gap: 12 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, color: '#64748b' }}>
          <button
            type="button"
            onClick={onBack}
            style={{ border: 'none', background: 'none', color: '#4f46e5', fontWeight: 600, cursor: 'pointer', padding: 0, fontSize: 13, display: 'flex', alignItems: 'center', gap: 4 }}
          >
            ← Back to Learning Paths
          </button>
          <span>›</span>
          <span style={{ color: '#0f172a', fontWeight: 700 }}>
            {activeLP?.title || selectedPathTitle}
          </span>
        </div>

        {isTrainerOrAdmin && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            {allPaths.length > 1 && (
              <select
                value={selectedPathId}
                onChange={e => {
                  const found = allPaths.find(p => p.id === e.target.value);
                  setSelectedPathId(e.target.value);
                  setSelectedPathTitle(found?.title || found?.name || '');
                }}
                style={{ padding: '8px 12px', borderRadius: 8, border: '1px solid #e2e8f0', fontSize: 13, background: '#fff', cursor: 'pointer', outline: 'none', color: '#334155' }}
              >
                {allPaths.map((p: any) => (
                  <option key={p.id} value={p.id}>{p.title || p.name}</option>
                ))}
              </select>
            )}
            <button
              type="button"
              onClick={() => setShowNewModuleModal(true)}
              style={{ background: 'linear-gradient(135deg,#6366f1,#4f46e5)', color: '#fff', border: 'none', borderRadius: 10, padding: '9px 18px', fontWeight: 700, fontSize: 13, cursor: 'pointer', boxShadow: '0 2px 8px rgba(99,102,241,0.35)' }}
            >
              + New Module
            </button>
          </div>
        )}
      </div>

      {/* ── Learning Path Executive Hero Banner ── */}
      <div className="lp-hero-card">
        <div className="lp-hero-circle-accent1" />
        <div className="lp-hero-circle-accent2" />

        <div className="lp-hero-content">
          <div className="lp-hero-left">
            <h1 className="lp-hero-title">
              {activeLP?.title || selectedPathTitle || 'Learning Path'}
            </h1>
            <p className="lp-hero-desc">
              {cleanLpDescription || 'Follow this structured curriculum to gain practical skills, complete assignments, and track your learning progress.'}
            </p>

            <div className="lp-hero-actions">
              <button
                type="button"
                className="btn-hero-continue"
                onClick={() => {
                  if (nextIncompleteModule) {
                    void openModule(nextIncompleteModule.id);
                  }
                }}
              >
                Continue learning <span>›</span>
              </button>
            </div>
          </div>

          {/* Right Floating Progress Card */}
          <div className="lp-hero-progress-widget">
            <div className="lp-progress-circle-wrap">
              <svg className="lp-progress-circle-svg" viewBox="0 0 66 66">
                <circle
                  cx="33"
                  cy="33"
                  r={circleRadius}
                  fill="none"
                  stroke="rgba(255, 255, 255, 0.2)"
                  strokeWidth="5"
                />
                <circle
                  cx="33"
                  cy="33"
                  r={circleRadius}
                  fill="none"
                  stroke="#38bdf8"
                  strokeWidth="5"
                  strokeDasharray={circleCircumference}
                  strokeDashoffset={circleStrokeDashoffset}
                  strokeLinecap="round"
                />
              </svg>
              <div className="lp-progress-circle-text">
                <span className="lp-progress-circle-pct">{overallProgressPercent}%</span>
                <span className="lp-progress-circle-label">OVERALL</span>
              </div>
            </div>

            <div className="lp-progress-widget-text">
              <h4>{momentumText}</h4>
              <p>{totalLessonsInLP > 0 ? `${completedLessonsInLP} of ${totalLessonsInLP} lessons completed` : 'Start learning today'}</p>
            </div>
          </div>
        </div>
      </div>

      {/* ── Quick Stats Strip (Modules, Duration, Lessons) ── */}
      <div className="lp-stats-strip">
        <div className="lp-stat-pill-card">
          <div className="lp-stat-icon-wrap" style={{ background: '#eef2ff', color: '#4f46e5' }}>
            📚
          </div>
          <div className="lp-stat-info">
            <strong>{modules.length} {modules.length === 1 ? 'module' : 'modules'}</strong>
            <span>Curriculum structure</span>
          </div>
        </div>

        <div className="lp-stat-pill-card">
          <div className="lp-stat-icon-wrap" style={{ background: '#f0fdfa', color: '#0d9488' }}>
            ⏱️
          </div>
          <div className="lp-stat-info">
            <strong>{lpDurationDisplay}</strong>
            <span>Estimated duration</span>
          </div>
        </div>

        {totalLessonsInLP > 0 && (
          <div className="lp-stat-pill-card">
            <div className="lp-stat-icon-wrap" style={{ background: '#f5f3ff', color: '#7c3aed' }}>
              🎯
            </div>
            <div className="lp-stat-info">
              <strong>{totalLessonsInLP} {totalLessonsInLP === 1 ? 'lesson' : 'lessons'}</strong>
              <span>Interactive lessons</span>
            </div>
          </div>
        )}
      </div>

      {/* ── Curriculum Section Header ── */}
      <div className="lp-curriculum-header">
        <div>
          <h2>Your modules</h2>
          <p>Complete each module in sequence to build your skills.</p>
        </div>
      </div>

      {/* ── Modules Timeline / Cards List ── */}
      {isLoading ? (
        <div style={{ textAlign: 'center', padding: '60px', color: '#94a3b8' }}>
          <div style={{ fontSize: 32, marginBottom: 12 }}>⏳</div>
          Loading curriculum modules...
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
        <div className="module-cards-timeline">
          {modules.map((module: any, idx: number) => {
            const padNum = String(idx + 1).padStart(2, '0');
            const stage = stageLabels[idx] || (module.level ? String(module.level).toUpperCase() : 'SPECIALIZATION');
            const modProgress = getModuleProgress(module);
            const isActive = idx === (firstActiveIndex === -1 ? 0 : firstActiveIndex);

            // Status badge details
            let statusBadge = { label: 'Not started', bg: '#f8fafc', color: '#94a3b8', border: '#e2e8f0' };
            if (modProgress >= 100) {
              statusBadge = { label: 'Completed', bg: '#ecfdf5', color: '#059669', border: '#a7f3d0' };
            } else if (modProgress > 0) {
              statusBadge = { label: 'In progress', bg: '#eff6ff', color: '#4f46e5', border: '#dbeafe' };
            }

            const modLessonsCount = module.lessons?.length || 0;
            const modActivitiesCount = module.assignments?.length || 0;
            const durationLabel = module.durationLabel || (module.durationWeeks ? `${module.durationWeeks * 7} days` : '7 days');

            // Sanitize raw HTML tags from module description
            const cleanModDesc = (module.description || '')
              .replace(/<[^>]*>/g, '')
              .replace(/&nbsp;/g, ' ')
              .trim();

            return (
              <div
                key={module.id}
                className={`module-card-item ${isActive ? 'is-active-module' : ''}`}
                onClick={() => openModule(module.id)}
                role="button"
                tabIndex={0}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    void openModule(module.id);
                  }
                }}
              >
                {/* Top: Index + Stage Label (Left) and Status Badge (Right) */}
                <div className="module-card-top">
                  <div className="module-card-top-left">
                    <div className="module-index-pill">
                      {padNum}
                    </div>
                    <span className="module-stage-label">{stage}</span>
                  </div>

                  <span
                    className="module-status-badge"
                    style={{
                      background: statusBadge.bg,
                      color: statusBadge.color,
                      border: `1px solid ${statusBadge.border}`
                    }}
                  >
                    {statusBadge.label}
                  </span>
                </div>

                {/* Title */}
                <h3 className="module-card-title">{module.title}</h3>

                {/* Description */}
                <p className="module-card-desc">
                  {cleanModDesc || 'Build core principles, practical workflows, and real-world mastery through guided lessons and assessments.'}
                </p>

                {/* Meta Row: Duration, Lessons, Activities */}
                <div className="module-meta-row">
                  <span className="module-meta-item">
                    ⏱️ {durationLabel}
                  </span>
                  <span className="module-meta-item">
                    📚 {modLessonsCount} lessons
                  </span>
                  <span className="module-meta-item">
                    📝 {modActivitiesCount} activities
                  </span>
                </div>

                {/* Bottom Row: Progress Bar + Action Button */}
                <div className="module-bottom-row">
                  <div className="module-progress-group">
                    <span className="module-progress-label">Module progress</span>
                    <div className="module-progress-track">
                      <div
                        className="module-progress-fill"
                        style={{
                          width: `${modProgress}%`,
                          background: modProgress >= 100 ? '#10b981' : 'linear-gradient(90deg, #6366f1, #4f46e5)'
                        }}
                      />
                    </div>
                    <span className="module-progress-pct">{modProgress}%</span>
                  </div>

                  <div>
                    {modProgress >= 100 ? (
                      <button
                        type="button"
                        className="btn-module-outline"
                        onClick={(e) => {
                          e.stopPropagation();
                          void openModule(module.id);
                        }}
                      >
                        Review module <span>›</span>
                      </button>
                    ) : isActive ? (
                      <button
                        type="button"
                        className="btn-module-continue"
                        onClick={(e) => {
                          e.stopPropagation();
                          void openModule(module.id);
                        }}
                      >
                        Continue module <span>›</span>
                      </button>
                    ) : (
                      <button
                        type="button"
                        className="btn-module-outline"
                        onClick={(e) => {
                          e.stopPropagation();
                          void openModule(module.id);
                        }}
                      >
                        {modProgress === 0 ? 'Start module' : 'Continue module'} <span>›</span>
                      </button>
                    )}
                  </div>
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