import React, { useState, useEffect, useMemo } from "react";
import { createPortal } from "react-dom";
import { useParams, useLocation, useNavigate } from "react-router-dom";
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
import { FullscreenLessonPlayer } from "./FullscreenLessonPlayer";
import { resolveCurriculumDependencies } from "./useCurriculumDependencies";
import { ModuleAccordionSkeleton } from "./ModuleContentAccordion";
import { LessonPlayerView } from "./LessonPlayerView";
import { AssignmentInstructionModal } from "./AssignmentInstructionModal";
import { AssignmentWorkspaceModal } from "./AssignmentWorkspaceModal";
import { RichText } from "../common/RichText";
import { renderMultilineText, ModuleDescription } from "../../utils/textUtils";
import { resolveAssignmentInstructions } from "../../utils/assignmentInstructions";
import { AssignmentInstructionsGate } from "../common/AssignmentInstructionsGate";
import {
  isModuleUnlocked,
  isLessonUnlocked,
  getLessonLockInfo,
  isAssignmentUnlocked,
  getAssignmentLockInfo,
  sortCurriculumModules,
  sortCurriculumLessons,
} from "../../shared/lockLogic";
import {
  Lock,
  Clock,
  BookOpen,
  CheckSquare,
  Award,
  Sparkles,
  CheckCircle2,
  FileText,
} from "lucide-react";
import "./ModulesManagement.css";

interface ModulesProps {
  currentPathId: string;
  currentPathTitle: string;
  currentModuleId?: string;
  userRole: 'Admin' | 'Trainer' | 'Trainee';
  accessToken: string;
  onBack: () => void;
}

import { ModuleDescriptionPreview, ModuleShowMoreModal } from '../common/ModuleShowMoreModal';

export function ModulesManagementSection({
  currentPathId,
  currentPathTitle,
  currentModuleId,
  userRole,
  accessToken,
  onBack,
}: ModulesProps) {
  const { moduleId: urlModuleId } = useParams<{ moduleId?: string }>();
  const location = useLocation();
  const navigate = useNavigate();
  const isTrainerOrAdmin = userRole === 'Admin' || userRole === 'Trainer';
  const isTrainee = userRole === 'Trainee';
  const { refresh: refreshNotifications } = useNotifications();
  const toast = useToast();

  const effectiveModuleId = currentModuleId || urlModuleId || (location.state as any)?.moduleId || null;

  // ── List-level state ──────────────────────────────────────────────────────
  const [allPaths, setAllPaths] = useState<any[]>([]);
  const [selectedPathId, setSelectedPathId] = useState<string>(currentPathId);
  const [selectedPathTitle, setSelectedPathTitle] = useState<string>(currentPathTitle);
  const [modules, setModules] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  // ── Drill-in: which module is open in detail view ─────────────────────────
  const [openModuleId, setOpenModuleId] = useState<string | null>(effectiveModuleId);
  const [openModuleData, setOpenModuleData] = useState<any | null>(null);
  const [moduleStats, setModuleStats] = useState<any | null>(null);
  const [moduleLoading, setModuleLoading] = useState<boolean>(Boolean(effectiveModuleId));
  const [isModuleDropdownOpen, setIsModuleDropdownOpen] = useState(false);
  const [activeFullscreenLessonIndex, setActiveFullscreenLessonIndex] = useState<number | null>(null);

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
  const [currentTime] = useState<Date>(() => new Date());

  // ── Task submission modal (Trainee only) ──────────────────────────────────
  const [submitTask, setSubmitTask] = useState<any | null>(null);
  const [instructionTask, setInstructionTask] = useState<any | null>(null);
  const [workspaceTask, setWorkspaceTask] = useState<any | null>(null);
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

  // ── Unified parallel loader for path details, curriculum & trainee progress ──
  useEffect(() => {
    if (!selectedPathId) return;
    let isCancelled = false;
    setIsLoading(true);

    const loadAllPathData = async () => {
      try {
        const promises: Promise<any>[] = [
          curriculumService.fetchModulesByPath(selectedPathId, accessToken),
          learningPathService.fetchPathById(selectedPathId, accessToken).catch(() => null),
        ];

        if (isTrainee) {
          promises.push(
            progressService.fetchPathProgressSummary(accessToken).catch(() => ({})),
            progressService.fetchMyStats(accessToken).catch(() => null),
            assignmentService.fetchMySubmissions(accessToken).catch(() => [])
          );
        }

        const [modulesData, pathData, pathSummaryData, myStatsData, submissionsData] = await Promise.all(promises);
        if (isCancelled) return;

        if (pathData) {
          setCurrentPathDetails(pathData);
        }
        if (isTrainee) {
          if (pathSummaryData) setPathProgressSummary(pathSummaryData);
          if (myStatsData) setProgressStats(myStatsData);
          if (submissionsData) setMySubs(Array.isArray(submissionsData) ? submissionsData : []);
        }

        const mods = sortCurriculumModules(Array.isArray(modulesData) ? modulesData : []);
        setModules(mods);
      } catch {
        if (!isCancelled) setModules([]);
      } finally {
        if (!isCancelled) setIsLoading(false);
      }
    };

    void loadAllPathData();

    return () => {
      isCancelled = true;
    };
  }, [selectedPathId, accessToken, isTrainee]);

  // ── Module detail fetcher ──────────────────────────────────────────────────
  const loadModuleDetail = async (moduleId: string) => {
    setModuleLoading(true);
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
      if (mod) {
        setOpenModuleData(mod);
        const modPathId = mod?.learningPathId || mod?.learningPath?.id;
        if (modPathId && modPathId !== selectedPathId) {
          setSelectedPathId(modPathId);
        }
        setMySubs(Array.isArray(subs) ? subs : []);
        setModuleStats(modStats);
      } else {
        setOpenModuleData(null);
      }
    } catch {
      setOpenModuleData(null);
    } finally {
      setModuleLoading(false);
    }
  };

  // ── Synchronize URL/route changes with module detail view ───────────────────
  useEffect(() => {
    const targetId = effectiveModuleId;
    if (targetId) {
      setOpenModuleId(targetId);
      void loadModuleDetail(targetId);
    } else {
      setOpenModuleId(null);
      setOpenModuleData(null);
      setModuleStats(null);
      setModuleLoading(false);
    }
  }, [effectiveModuleId, accessToken, isTrainee]);

  // ── Drill into a module ───────────────────────────────────────────────────
  const openModule = async (moduleId: string, preserveTab: boolean = false) => {
    // If the module is already completed, allow review immediately without sequential lock check
    const isCompletedOrReviewing =
      (progressStats?.completedModuleIds || []).map(String).includes(String(moduleId)) ||
      getModuleProgress(modules.find((m: any) => String(m.id) === String(moduleId)) || {}) >= 100;

    // Sequential module locking check for Trainees
    if (isTrainee && modules.length > 0 && !isCompletedOrReviewing) {
      const targetIdx = modules.findIndex((m: any) => String(m.id) === String(moduleId));
      if (targetIdx > 0) {
        const activeModuleProgressMap = modules.reduce((acc: any, m: any) => {
          acc[String(m.id)] = getModuleProgress(m);
          return acc;
        }, {});
        const activeCompletedModuleIds = Array.from(new Set([
          ...(progressStats?.completedModuleIds || []).map(String),
          ...modules.filter((m: any) => getModuleProgress(m) >= 100).map((m: any) => String(m.id)),
        ]));
        const checkLock = isModuleUnlocked(
          targetIdx,
          modules,
          activeCompletedModuleIds,
          activeModuleProgressMap,
          true
        );
        if (!checkLock.isUnlocked) {
          toast.warning(checkLock.lockReason || 'This module is locked until preceding modules are completed.');
          return;
        }
      }
    }

    setOpenModuleId(moduleId);
    setModuleLoading(true);
    if (!preserveTab) {
      setActiveTab((location.state as any)?.activeTab || 'Lessons');
    }
    const path = selectedPathId || currentPathId;
    if (path && (currentModuleId !== moduleId && urlModuleId !== moduleId)) {
      navigate(`/learning-path/${path}/module/${moduleId}`, {
        state: { pathId: path, pathName: selectedPathTitle, moduleId },
      });
    }
    await loadModuleDetail(moduleId);
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
    setActiveFullscreenLessonIndex(null);
    const path = selectedPathId || currentPathId;
    if (path) {
      navigate(`/learning-path/${path}/modules`, {
        state: { pathId: path, pathName: selectedPathTitle },
      });
    }
  };

  // Refetch on window focus to ensure fresh data when returning to tab without continuous interval polling
  useEffect(() => {
    const refreshOnFocus = () => {
      if (selectedPathId) {
        curriculumService.fetchModulesByPath(selectedPathId, accessToken)
          .then((data: any) => {
            const mods = Array.isArray(data) ? data : [];
            setModules(mods);
            if (openModuleId && mods.some((m: any) => m.id === openModuleId)) {
              void refreshModuleData(openModuleId);
            }
          })
          .catch(() => { });
      }
    };

    window.addEventListener('focus', refreshOnFocus);
    return () => {
      window.removeEventListener('focus', refreshOnFocus);
    };
  }, [openModuleId, selectedPathId, accessToken]);

  // ── Mark lesson watched (Trainee) ─────────────────────────────────────────
  const markLessonWatched = async (lessonId: string) => {
    try {
      // Optimistic update for instantaneous UI progression
      const lid = String(lessonId);
      setProgressStats((prev: any) => ({
        ...prev,
        completedLessonIds: Array.from(new Set([...(prev?.completedLessonIds || []), lid])),
      }));
      setModuleStats((prev: any) => ({
        ...prev,
        completedLessonIds: Array.from(new Set([...(prev?.completedLessonIds || []), lid])),
        completedLessons: (prev?.completedLessons || 0) + 1,
      }));

      await progressService.completeLesson(lessonId, accessToken);
      await Promise.all([
        openModuleId ? refreshModuleData(openModuleId) : Promise.resolve(),
        progressService.fetchMyStats(accessToken).then(setProgressStats).catch(() => { }),
        assignmentService.fetchMySubmissions(accessToken).then((subs) => setMySubs(Array.isArray(subs) ? subs : [])).catch(() => { }),
        progressService.fetchPathProgressSummary(accessToken).then((s) => setPathProgressSummary(s || {})).catch(() => { }),
        curriculumService.fetchModulesByPath(selectedPathId, accessToken).then((data) => setModules(Array.isArray(data) ? sortCurriculumModules(data) : [])).catch(() => { }),
      ]);
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
      await Promise.all([
        openModuleId ? refreshModuleData(openModuleId) : Promise.resolve(),
        progressService.fetchMyStats(accessToken).then(setProgressStats).catch(() => { }),
        assignmentService.fetchMySubmissions(accessToken).then((subs) => setMySubs(Array.isArray(subs) ? subs : [])).catch(() => { }),
        progressService.fetchPathProgressSummary(accessToken).then((s) => setPathProgressSummary(s || {})).catch(() => { }),
        curriculumService.fetchModulesByPath(selectedPathId, accessToken).then((data) => setModules(Array.isArray(data) ? sortCurriculumModules(data) : [])).catch(() => { }),
      ]);
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

  // Use combined stats so lessons completed across modules are always counted
  const completedLessonIds = new Set<string>([
    ...(progressStats?.completedLessonIds || []).map(String),
    ...(moduleStats?.completedLessonIds || []).map(String),
  ]);

  const subByAssignment = React.useMemo(() => {
    const map = new Map<string, any>();
    mySubs.forEach((s) => {
      const aId = s.assignment?.id || s.assignmentId || s.assignment_id;
      if (aId) {
        map.set(String(aId), s);
        map.set(aId, s);
      }
    });
    return map;
  }, [mySubs]);

  // Helper to calculate module progress percentage (hoisted for openModule & list views)
  const getModuleProgress = (m: any): number => {
    const isCurrentOpen = openModuleId && String(m?.id) === String(openModuleId) && openModuleData;
    const mLessons = isCurrentOpen ? (openModuleData.lessons || []) : (m.lessons || []);
    const lessonTasks = mLessons.flatMap((l: any) => l.assignments || []);
    const modTasks = isCurrentOpen ? (openModuleData.assignments || []) : (m.assignments || []);
    const allModTasks = [...lessonTasks, ...modTasks];
    const seenTaskIds = new Set<string>();
    const uniqueTasks = allModTasks.filter((t: any) => {
      const id = String(t?.id || '');
      if (!id || seenTaskIds.has(id)) return false;
      seenTaskIds.add(id);
      return true;
    });

    const totalItems = mLessons.length + uniqueTasks.length;
    if (totalItems > 0) {
      const completedLessonIdsSet = new Set<string>([
        ...(progressStats?.completedLessonIds || []).map(String),
        ...(moduleStats?.completedLessonIds || []).map(String),
      ]);
      const completedLessonsCount = mLessons.filter((l: any) => completedLessonIdsSet.has(String(l.id))).length;

      const completedTasksCount = uniqueTasks.filter((t: any) => {
        const sub = subByAssignment.get(t.id);
        if (!sub || !sub.submittedAt) return false;
        const status = String(sub.status || '').toUpperCase();
        return status !== 'AVAILABLE' && status !== 'LOCKED' && status !== 'DRAFT';
      }).length;

      const livePct = Math.min(100, Math.round(((completedLessonsCount + completedTasksCount) / totalItems) * 100));
      if (livePct >= 100) return 100;

      if (pathProgressSummary[selectedPathId]?.moduleProgresses?.[m.id] !== undefined) {
        return Math.max(livePct, Math.min(100, Math.max(0, Math.round(Number(pathProgressSummary[selectedPathId].moduleProgresses[m.id])))));
      }
      return livePct;
    }

    if (pathProgressSummary[selectedPathId]?.moduleProgresses?.[m.id] !== undefined) {
      return Math.min(100, Math.max(0, Math.round(Number(pathProgressSummary[selectedPathId].moduleProgresses[m.id]))));
    }
    return 0;
  };

  // ─────────────────────────────────────────────────────────────────────────
  // MODULE DETAIL VIEW (when a module is drilled into)
  // ─────────────────────────────────────────────────────────────────────────
  if (openModuleId) {
    if (moduleLoading) {
      return (
        <div className="lp-overview-container" style={{ padding: '0 0 40px 0' }} aria-busy="true">
          {/* Breadcrumbs Skeleton */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
            <div className="mm-shimmer" style={{ width: 240, height: 24, borderRadius: 6 }} />
            <div className="mm-shimmer" style={{ width: 140, height: 32, borderRadius: 8 }} />
          </div>

          {/* Hero Banner Skeleton */}
          <div className="mm-shimmer" style={{ width: '100%', height: 180, borderRadius: 20, marginBottom: 20 }} />

          {/* Stats Cards Skeleton */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 14, marginBottom: 24 }}>
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="mm-shimmer" style={{ height: 68, borderRadius: 14 }} />
            ))}
          </div>

          {/* Objectives & Outcomes Skeleton */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(340px, 1fr))', gap: 20, marginBottom: 28 }}>
            <div className="mm-shimmer" style={{ height: 150, borderRadius: 16 }} />
            <div className="mm-shimmer" style={{ height: 150, borderRadius: 16 }} />
          </div>

          {/* Tabs Bar Skeleton */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
            <div className="mm-shimmer" style={{ width: 200, height: 38, borderRadius: 10 }} />
            <div className="mm-shimmer" style={{ width: 140, height: 18, borderRadius: 4 }} />
          </div>

          {/* Lesson Cards Skeletons */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            {[1, 2].map((i) => (
              <div
                key={i}
                style={{
                  background: '#ffffff',
                  border: '1.5px solid #e2e8f0',
                  borderRadius: 14,
                  padding: '20px 24px',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 16,
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                    <div className="mm-shimmer" style={{ width: 36, height: 36, borderRadius: 10 }} />
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                      <div className="mm-shimmer" style={{ width: 180, height: 18, borderRadius: 4 }} />
                      <div className="mm-shimmer" style={{ width: 120, height: 12, borderRadius: 4 }} />
                    </div>
                  </div>
                  <div className="mm-shimmer" style={{ width: 110, height: 32, borderRadius: 8 }} />
                </div>
                <div className="mm-shimmer" style={{ width: '100%', height: 76, borderRadius: 12 }} />
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 12 }}>
                  <div className="mm-shimmer" style={{ height: 60, borderRadius: 10 }} />
                  <div className="mm-shimmer" style={{ height: 60, borderRadius: 10 }} />
                </div>
              </div>
            ))}
          </div>
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

    const lessons = sortCurriculumLessons(openModuleData?.lessons || []);
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

    // ── Single-Instance Dependency Resolution & Deduplication Engine ────────
    const curriculum = resolveCurriculumDependencies({
      lessons,
      tasks,
      completedLessonIds,
      submissions: mySubs,
      sequentialLessonLock: openModuleData?.sequentialLessonLock ?? openModuleData?.lessonLocking ?? true,
      isTrainee,
    });

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
      if (!sub || !sub.submittedAt) return false;
      const status = String(sub.status || '').toUpperCase();
      return status !== 'AVAILABLE' && status !== 'LOCKED' && status !== 'DRAFT' && status !== '';
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

    const curModuleIdx = modules.findIndex((m: any) => String(m.id) === String(openModuleId));
    const nextModule = curModuleIdx >= 0 && curModuleIdx < modules.length - 1 ? modules[curModuleIdx + 1] : null;

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
              {selectedPathTitle && selectedPathTitle !== 'All Modules' ? selectedPathTitle : (currentPathDetails?.title || openModuleData?.learningPath?.title || 'Learning Path')}
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
                  {modules.find((m: any) => m.id === openModuleId)?.title || openModuleData?.title || 'Select Module'}
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
                    {modules.map((m: any, mIdx: number) => {
                      const activeModuleProgressMap = modules.reduce((acc: any, mod: any) => {
                        acc[String(mod.id)] = getModuleProgress(mod);
                        return acc;
                      }, {});
                      const activeCompletedModuleIds = Array.from(new Set([
                        ...(progressStats?.completedModuleIds || []).map(String),
                        ...modules.filter((mod: any) => getModuleProgress(mod) >= 100).map((mod: any) => String(mod.id)),
                        ...(progressPercent === 100 && openModuleId ? [String(openModuleId)] : []),
                      ]));
                      const mLock = isTrainee
                        ? isModuleUnlocked(mIdx, modules, activeCompletedModuleIds, activeModuleProgressMap, true)
                        : { isUnlocked: true };
                      const isModLocked = !mLock.isUnlocked;

                      return (
                        <button
                          key={m.id}
                          type="button"
                          onClick={() => {
                            if (isModLocked) {
                              toast.warning(mLock.lockReason || 'This module is locked.');
                              return;
                            }
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
                            color: isModLocked ? '#94a3b8' : (m.id === openModuleId ? '#4338ca' : '#334155'),
                            cursor: isModLocked ? 'not-allowed' : 'pointer',
                            opacity: isModLocked ? 0.6 : 1,
                            fontSize: 13,
                            fontWeight: m.id === openModuleId ? 700 : 500,
                            borderBottom: '1px solid #f8fafc',
                            transition: 'all 0.15s ease'
                          }}
                          onMouseEnter={(e) => { if (!isModLocked && m.id !== openModuleId) e.currentTarget.style.background = '#f8fafc'; }}
                          onMouseLeave={(e) => { if (!isModLocked && m.id !== openModuleId) e.currentTarget.style.background = '#fff'; }}
                        >
                          <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                            {m.title} {isModLocked ? '🔒' : ''}
                          </span>
                          {m.id === openModuleId && <span style={{ color: '#4f46e5', fontSize: 13, fontWeight: 800 }}>✓</span>}
                        </button>
                      );
                    })}
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
                  
                </div>
              </div>
              <div className="lp-progress-widget-text">
                <h4>{progressPercent === 100 ? 'Module Completed' : progressPercent > 0 ? 'In Progress' : 'Not Started'}</h4>
                <p>{completedLessons} of {lessons.length} lessons done</p>
              </div>
            </div>
          </div>
        </div>

        {/* ── Next Module Unlocked Celebration Banner ── */}
        {progressPercent === 100 && nextModule && (
          <div style={{
            marginTop: 18,
            padding: '16px 22px',
            background: 'linear-gradient(135deg, #f0fdf4 0%, #ecfdf5 100%)',
            border: '1.5px solid #86efac',
            borderRadius: 14,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: 16,
            flexWrap: 'wrap',
            boxShadow: '0 2px 8px rgba(16, 185, 129, 0.08)'
          }}>
            <div>
              <div style={{ fontSize: 14.5, fontWeight: 700, color: '#166534' }}>
                🎉 Module Completed! Next Module Unlocked
              </div>
              <div style={{ fontSize: 12.5, color: '#15803d', marginTop: 2 }}>
                You have finished all items in this module. Continue with <strong>{nextModule.title}</strong> without delay.
              </div>
            </div>
            <button
              type="button"
              onClick={() => void openModule(nextModule.id)}
              style={{
                padding: '9px 20px',
                background: '#16a34a',
                color: '#ffffff',
                border: 'none',
                borderRadius: 9,
                fontWeight: 700,
                fontSize: 13,
                cursor: 'pointer',
                boxShadow: '0 4px 10px rgba(22, 163, 74, 0.22)',
                display: 'inline-flex',
                alignItems: 'center',
                gap: 8,
                transition: 'all 0.15s ease'
              }}
            >
              <span>Start Next Module</span>
              <span>→</span>
            </button>
          </div>
        )}

        {/* ── Key Metrics Strip (Clean, non-overlapping) ── */}
        <div className="lp-stats-strip" style={{ marginTop: 18 }}>
          <div className="lp-stat-pill-card">
            {!isTrainee && (
              <div className="lp-stat-icon-wrap" style={{ background: '#eef2ff', color: '#4f46e5', border: '1px solid #c7d2fe' }}>
                <Clock size={16} strokeWidth={2} />
              </div>
            )}
            <div className="lp-stat-info">
              <strong>{openModuleData.durationLabel || `${openModuleData.durationWeeks || 2} weeks`}</strong>
              <span>Duration</span>
            </div>
          </div>

          <div className="lp-stat-pill-card">
            {!isTrainee && (
              <div className="lp-stat-icon-wrap" style={{ background: '#f0f9ff', color: '#0284c7', border: '1px solid #bae6fd' }}>
                <BookOpen size={16} strokeWidth={2} />
              </div>
            )}
            <div className="lp-stat-info">
              <strong>{isTrainee ? `${completedLessons}/${lessons.length} done` : `${lessons.length} total`}</strong>
              <span>Lessons</span>
            </div>
          </div>

          <div className="lp-stat-pill-card">
            {!isTrainee && (
              <div className="lp-stat-icon-wrap" style={{ background: '#faf5ff', color: '#7c3aed', border: '1px solid #e9d5ff' }}>
                <CheckSquare size={16} strokeWidth={2} />
              </div>
            )}
            <div className="lp-stat-info">
              <strong>{isTrainee ? `${tasksSubmitted}/${tasks.length} submitted` : `${tasks.length} assigned`}</strong>
              <span>Tasks</span>
            </div>
          </div>

          <div className="lp-stat-pill-card">
            {!isTrainee && (
              <div className="lp-stat-icon-wrap" style={{ background: '#fffbeb', color: '#d97706', border: '1px solid #fde68a' }}>
                <Award size={16} strokeWidth={2} />
              </div>
            )}
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
            padding: '22px 24px',
            boxShadow: '0 1px 3px rgba(15, 23, 42, 0.03)',
            transition: 'all 0.2s ease',
            display: 'flex',
            flexDirection: 'column',
            gap: 14
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              {!isTrainee && (
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
                  <Sparkles size={18} strokeWidth={2} />
                </div>
              )}
              <div>
                <h4 style={{ margin: 0, color: '#0f172a', fontSize: 15, fontWeight: 700, letterSpacing: '-0.01em' }}>
                  Learning Objectives
                </h4>
                <span style={{ fontSize: 12, color: '#64748b' }}>Core concepts and focus areas</span>
              </div>
            </div>
            <ul style={{ margin: 0, padding: 0, listStyle: 'none', display: 'flex', flexDirection: 'column', gap: 8 }}>
              {objectives.filter(o => typeof o === 'string' && o.trim().length > 0).length > 0 ? (
                objectives.filter(o => typeof o === 'string' && o.trim().length > 0).map((o, i) => (
                  <li key={i} style={{ display: 'flex', alignItems: 'flex-start', gap: 10, color: '#334155', fontSize: 13.5, lineHeight: 1.55 }}>
                    <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#6366f1', marginTop: 8, flexShrink: 0 }} />
                    <span>{o}</span>
                  </li>
                ))
              ) : (
                <li style={{ color: '#94a3b8', fontSize: 13, fontStyle: 'italic' }}>
                  Explore the curriculum lessons to master this module's topics.
                </li>
              )}
            </ul>
          </div>

          {/* Outcomes Card */}
          <div style={{
            background: '#ffffff',
            borderRadius: 16,
            border: '1.5px solid #e2e8f0',
            padding: '22px 24px',
            boxShadow: '0 1px 3px rgba(15, 23, 42, 0.03)',
            transition: 'all 0.2s ease',
            display: 'flex',
            flexDirection: 'column',
            gap: 14
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              {!isTrainee && (
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
                  <CheckCircle2 size={18} strokeWidth={2} />
                </div>
              )}
              <div>
                <h4 style={{ margin: 0, color: '#0f172a', fontSize: 15, fontWeight: 700, letterSpacing: '-0.01em' }}>
                  Learning Outcomes
                </h4>
                <span style={{ fontSize: 12, color: '#64748b' }}>Practical capabilities & competencies</span>
              </div>
            </div>
            <ul style={{ margin: 0, padding: 0, listStyle: 'none', display: 'flex', flexDirection: 'column', gap: 8 }}>
              {outcomes.filter(o => typeof o === 'string' && o.trim().length > 0).length > 0 ? (
                outcomes.filter(o => typeof o === 'string' && o.trim().length > 0).map((o, i) => (
                  <li key={i} style={{ display: 'flex', alignItems: 'flex-start', gap: 10, color: '#334155', fontSize: 13.5, lineHeight: 1.55 }}>
                    {isTrainee ? (
                      <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#10b981', marginTop: 8, flexShrink: 0 }} />
                    ) : (
                      <CheckCircle2 size={14} color="#059669" style={{ marginTop: 3, flexShrink: 0 }} />
                    )}
                    <span>{o}</span>
                  </li>
                ))
              ) : (
                <li style={{ color: '#94a3b8', fontSize: 13, fontStyle: 'italic' }}>
                  Complete module assessments to demonstrate core proficiency.
                </li>
              )}
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

        {/* ── LESSONS TAB (Deduplicated Single-Instance Placement) ── */}
        {activeTab === 'Lessons' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            {moduleLoading ? (
              <ModuleAccordionSkeleton />
            ) : curriculum.resolvedLessons.length === 0 ? (
              <div style={{ padding: 32, textAlign: 'center', color: '#94a3b8', background: '#fff', border: '1px dashed #cbd5e1', borderRadius: 12 }}>
                No lessons in this module yet.
              </div>
            ) : (
              curriculum.resolvedLessons.map((node, lIdx) => {
                const lesson = node.lesson;
                return (
                  <div key={lesson.id} style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                    <LessonCard
                      lesson={{ ...lesson, title: `${lIdx + 1}. ${lesson.title}` }}
                      isDone={node.isCompleted}
                      isLocked={node.isLocked}
                      lockReason={node.lockReason}
                      isTrainee={isTrainee}
                      resources={lesson.resources || resources.filter((r: any) => String(r.lesson?.id || r.lessonId) === String(lesson.id))}
                      onVisitResource={(res) => {
                        if (res.id && isTrainee) progressService.visitResource(res.id, accessToken).catch(() => { });
                      }}
                      onMarkWatched={markLessonWatched}
                      onStartLesson={() => {
                        if (node.isLocked) {
                          toast.warning(node.lockReason || 'Complete previous lesson to unlock this lesson.');
                          return;
                        }
                        setActiveFullscreenLessonIndex(lIdx);
                      }}
                      onClickLocked={() => toast.warning(node.lockReason || 'Complete previous lesson to unlock this lesson.')}
                    />

                    {/* Single-Instance Deduplicated Dependent Assignments (rendered strictly beneath final prerequisite lesson) */}
                    {node.dependentAssignments.length > 0 && (
                      <div
                        style={{
                          marginLeft: '24px',
                          paddingLeft: '22px',
                          borderLeft: '2.5px solid #a5b4fc',
                          position: 'relative',
                          display: 'flex',
                          flexDirection: 'column',
                          gap: '12px',
                          marginTop: '6px',
                          marginBottom: '14px',
                        }}
                      >
                        <div
                          style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '7px',
                            fontSize: '11.5px',
                            fontWeight: 700,
                            color: '#4338ca',
                            background: '#eef2ff',
                            border: '1px solid #c7d2fe',
                            padding: '4px 12px',
                            borderRadius: '999px',
                            letterSpacing: '0.02em',
                            width: 'fit-content',
                            boxShadow: '0 1px 2px rgba(99, 102, 241, 0.08)',
                          }}
                        >
                          <FileText size={13} />
                          <span>Dependent Assessment{node.dependentAssignments.length > 1 ? 's' : ''} for Lesson {lIdx + 1}</span>
                        </div>
                        {node.dependentAssignments.map((aNode) => (
                          <AssignmentCard
                            key={aNode.task.id}
                            task={{ ...aNode.task, lessonTitle: `Lesson ${lIdx + 1}` }}
                            submission={aNode.submission}
                            isLocked={aNode.isLocked}
                            lockReason={aNode.lockReason}
                            isTrainee={isTrainee}
                            onClickLocked={(r) => toast.warning(r || 'This task is locked until prerequisite lessons are completed.')}
                            onAttempt={(t) => setInstructionTask(t)}
                          />
                        ))}
                      </div>
                    )}
                  </div>
                );
              })
            )}

            {/* Standalone module-level tasks without lesson prerequisites rendered at the bottom */}
            {curriculum.standaloneTasks.length > 0 && (
              <div
                style={{
                  marginTop: '20px',
                  borderTop: '1px solid #e2e8f0',
                  paddingTop: '20px',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '12px',
                }}
              >
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px',
                    fontSize: '12px',
                    fontWeight: 800,
                    color: '#334155',
                    textTransform: 'uppercase',
                    letterSpacing: '0.05em',
                  }}
                >
                  <Award size={15} color="#4f46e5" />
                  <span>Module Assessments ({curriculum.standaloneTasks.length})</span>
                </div>
                {curriculum.standaloneTasks.map((aNode) => (
                  <AssignmentCard
                    key={aNode.task.id}
                    task={{ ...aNode.task, lessonTitle: 'Module Task' }}
                    submission={aNode.submission}
                    isLocked={aNode.isLocked}
                    lockReason={aNode.lockReason}
                    isTrainee={isTrainee}
                    onClickLocked={(r) => toast.warning(r || 'This task is locked until prerequisite lessons are completed.')}
                    onAttempt={(t) => setInstructionTask(t)}
                  />
                ))}
              </div>
            )}
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
                  const isTaskLocked = isTrainee && !isAssignmentUnlocked(
                    { lockUntilLessonsComplete: task.lockUntilLessonsComplete, dependsOnLessonIds: task.dependsOnLessonIds },
                    { completedLessonIds: Array.from(completedLessonIds) },
                    lessons
                  );
                  const lockInfo = isTaskLocked
                    ? getAssignmentLockInfo(
                        { lockUntilLessonsComplete: task.lockUntilLessonsComplete, dependsOnLessonIds: task.dependsOnLessonIds },
                        { completedLessonIds: Array.from(completedLessonIds) },
                        lessons
                      )
                    : { isUnlocked: true };

                  return (
                    <AssignmentCard
                      key={task.id}
                      task={task}
                      submission={sub}
                      isLocked={isTaskLocked}
                      lockReason={lockInfo.lockReason}
                      isTrainee={isTrainee}
                      onClickLocked={(r) => toast.warning(r || 'This task is locked until prerequisite lessons are completed.')}
                      onAttempt={(t) => setInstructionTask(t)}
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
                  const isTaskLocked = isTrainee && !isAssignmentUnlocked(
                    { lockUntilLessonsComplete: task.lockUntilLessonsComplete, dependsOnLessonIds: task.dependsOnLessonIds },
                    { completedLessonIds: Array.from(completedLessonIds) },
                    lessons
                  );
                  const lockInfo = isTaskLocked
                    ? getAssignmentLockInfo(
                        { lockUntilLessonsComplete: task.lockUntilLessonsComplete, dependsOnLessonIds: task.dependsOnLessonIds },
                        { completedLessonIds: Array.from(completedLessonIds) },
                        lessons
                      )
                    : { isUnlocked: true };
                  const isLocked = isTaskLocked || task.isLocked;
                  const finalLockReason = lockInfo.lockReason || task.lockReason;

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
                          
                          {task.title}
                        </strong>
                        <div style={{ fontSize: 12, color: '#64748b', marginTop: 2 }}>{task.assignmentType}</div>
                        {isLocked && finalLockReason && (
                          <div style={{ fontSize: 11, color: '#ef4444', marginTop: 4 }}>{finalLockReason}</div>
                        )}
                        {!isLocked && status === 'started' && (
                          <div style={{ fontSize: 13, color: isOverdue ? '#ef4444' : '#f59e0b', fontWeight: 600, marginTop: 6 }}>
                            {timeLeftStr}
                          </div>
                        )}
                        {!isLocked && status === 'Overdue' && (
                          <div style={{ fontSize: 13, color: '#ef4444', fontWeight: 600, marginTop: 6 }}>
                            Overdue
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

        {/* ── Step 1: Assignment Overview & Instructions Modal ── */}
        {instructionTask && (
          <AssignmentInstructionModal
            task={instructionTask}
            submission={subByAssignment.get(instructionTask.id) || subByAssignment.get(String(instructionTask.id)) || (instructionTask as any).submission}
            isOpen={Boolean(instructionTask)}
            onClose={() => setInstructionTask(null)}
            onContinue={() => {
              setWorkspaceTask(instructionTask);
              setInstructionTask(null);
            }}
          />
        )}

        {/* ── Step 2: Active Assessment Workspace Modal ── */}
        {workspaceTask && (
          <AssignmentWorkspaceModal
            task={workspaceTask}
            submission={subByAssignment.get(workspaceTask.id) || subByAssignment.get(String(workspaceTask.id)) || (workspaceTask as any).submission}
            accessToken={accessToken}
            isOpen={Boolean(workspaceTask)}
            onClose={() => setWorkspaceTask(null)}
            onBackToInstructions={() => {
              setInstructionTask(workspaceTask);
              setWorkspaceTask(null);
            }}
            onSuccess={async () => {
              if (openModuleId) await refreshModuleData(openModuleId);
              await Promise.all([
                progressService.fetchMyStats(accessToken).then(setProgressStats).catch(() => { }),
                assignmentService.fetchMySubmissions(accessToken).then((subs) => setMySubs(Array.isArray(subs) ? subs : [])).catch(() => { }),
                progressService.fetchPathProgressSummary(accessToken).then((s) => setPathProgressSummary(s || {})).catch(() => { }),
                curriculumService.fetchModulesByPath(selectedPathId, accessToken).then((data) => setModules(Array.isArray(data) ? sortCurriculumModules(data) : [])).catch(() => { }),
              ]);
              refreshNotifications();
            }}
          />
        )}

        {/* Fallback to legacy modal if submitTask is set */}
        {submitTask && !instructionTask && !workspaceTask && (
          <SharedAssignmentModal
            task={submitTask}
            submission={subByAssignment.get(submitTask.id)}
            accessToken={accessToken}
            onClose={() => setSubmitTask(null)}
            onSuccess={async () => {
              if (openModuleId) await refreshModuleData(openModuleId);
              await Promise.all([
                progressService.fetchMyStats(accessToken).then(setProgressStats).catch(() => { }),
                assignmentService.fetchMySubmissions(accessToken).then((subs) => setMySubs(Array.isArray(subs) ? subs : [])).catch(() => { }),
                progressService.fetchPathProgressSummary(accessToken).then((s) => setPathProgressSummary(s || {})).catch(() => { }),
                curriculumService.fetchModulesByPath(selectedPathId, accessToken).then((data) => setModules(Array.isArray(data) ? sortCurriculumModules(data) : [])).catch(() => { }),
              ]);
              refreshNotifications();
            }}
          />
        )}

        {/* ── Dedicated Lesson Player View ── */}
        {activeFullscreenLessonIndex !== null && curriculum.resolvedLessons[activeFullscreenLessonIndex] && (
          <LessonPlayerView
            lessonNodes={curriculum.resolvedLessons}
            standaloneTasks={curriculum.standaloneTasks}
            currentLessonIndex={activeFullscreenLessonIndex}
            moduleTitle={openModuleData?.title || selectedPathTitle || 'Curriculum Module'}
            isOpen={activeFullscreenLessonIndex !== null}
            onClose={() => setActiveFullscreenLessonIndex(null)}
            onSelectLessonIndex={(idx) => setActiveFullscreenLessonIndex(idx)}
            onMarkLessonCompleted={async (lessonId) => {
              await markLessonWatched(lessonId);
            }}
            onTriggerAssignment={(task) => {
              setActiveFullscreenLessonIndex(null);
              setInstructionTask(task);
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

  // Trainee display ordering: Completed modules appear first on top, followed by in-progress and remaining, preserving trainer order within each category
  const displayModules = useMemo(() => {
    if (!isTrainee || modules.length === 0) {
      return modules;
    }
    const completed: any[] = [];
    const inProgress: any[] = [];
    const remaining: any[] = [];

    modules.forEach((m: any) => {
      const p = getModuleProgress(m);
      if (p >= 100) {
        completed.push(m);
      } else if (p > 0) {
        inProgress.push(m);
      } else {
        remaining.push(m);
      }
    });

    return [...completed, ...inProgress, ...remaining];
  }, [modules, isTrainee, progressStats, moduleStats, mySubs, pathProgressSummary, selectedPathId, openModuleId, openModuleData]);

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
          <div className="lp-stat-info">
            <strong>{modules.length} {modules.length === 1 ? 'module' : 'modules'}</strong>
            <span>Curriculum structure</span>
          </div>
        </div>

        <div className="lp-stat-pill-card">
          <div className="lp-stat-info">
            <strong>{lpDurationDisplay}</strong>
            <span>Estimated duration</span>
          </div>
        </div>

        {totalLessonsInLP > 0 && (
          <div className="lp-stat-pill-card">
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
        <div className="module-cards-timeline">
          {[1, 2, 3].map((n) => (
            <div key={n} className="module-card-skeleton">
              <div className="module-card-skeleton-top">
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <div className="mm-shimmer" style={{ width: 36, height: 26, borderRadius: 6 }} />
                  <div className="mm-shimmer" style={{ width: 90, height: 16 }} />
                </div>
                <div className="mm-shimmer" style={{ width: 80, height: 22, borderRadius: 999 }} />
              </div>
              <div className="mm-shimmer" style={{ width: '60%', height: 24, marginTop: 4 }} />
              <div className="mm-shimmer" style={{ width: '90%', height: 16 }} />
              <div className="mm-shimmer" style={{ width: '75%', height: 16 }} />
              <div style={{ display: 'flex', gap: 10, marginTop: 8 }}>
                <div className="mm-shimmer" style={{ width: 60, height: 20, borderRadius: 999 }} />
                <div className="mm-shimmer" style={{ width: 75, height: 20, borderRadius: 999 }} />
                <div className="mm-shimmer" style={{ width: 85, height: 20, borderRadius: 999 }} />
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 12 }}>
                <div className="mm-shimmer" style={{ width: '55%', height: 14, borderRadius: 999 }} />
                <div className="mm-shimmer" style={{ width: 130, height: 36, borderRadius: 999 }} />
              </div>
            </div>
          ))}
        </div>
      ) : modules.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '60px', background: '#f8fafc', borderRadius: 16, border: '2px dashed #e2e8f0' }}>
          
          <div style={{ fontWeight: 700, fontSize: 16, color: '#475569' }}>No modules yet</div>
          <div style={{ fontSize: 13, color: '#94a3b8', marginTop: 4 }}>
            {isTrainerOrAdmin ? 'Create the first module for this learning path.' : 'No modules available for this path.'}
          </div>
        </div>
      ) : (
        <div className="module-cards-timeline">
          {displayModules.map((module: any, displayIdx: number) => {
            const canonicalIdx = modules.findIndex((m: any) => String(m.id) === String(module.id));
            const effectiveIdx = canonicalIdx >= 0 ? canonicalIdx : displayIdx;
            const padNum = String(effectiveIdx + 1).padStart(2, '0');
            const stage = stageLabels[effectiveIdx] || (module.level ? String(module.level).toUpperCase() : 'SPECIALIZATION');
            const modProgress = getModuleProgress(module);

            const activeModuleProgressMap = modules.reduce((acc: any, m: any) => {
              acc[String(m.id)] = getModuleProgress(m);
              return acc;
            }, {});
            const activeCompletedModuleIds = Array.from(new Set([
              ...(progressStats?.completedModuleIds || []).map(String),
              ...modules.filter((m: any) => getModuleProgress(m) >= 100).map((m: any) => String(m.id)),
            ]));

            // Sequential module locking evaluation for trainees based on canonical curriculum order
            const moduleLock = isTrainee
              ? isModuleUnlocked(
                  effectiveIdx,
                  modules,
                  activeCompletedModuleIds,
                  activeModuleProgressMap,
                  true
                )
              : { isUnlocked: true };
            const isModLocked = !moduleLock.isUnlocked;

            const isActive = !isModLocked && effectiveIdx === (firstActiveIndex === -1 ? 0 : firstActiveIndex);

            // Status badge details
            let statusBadge = { label: 'Not started', bg: '#f8fafc', color: '#94a3b8', border: '#e2e8f0' };
            if (isModLocked) {
              statusBadge = { label: 'Locked', bg: '#f1f5f9', color: '#64748b', border: '#cbd5e1' };
            } else if (modProgress >= 100) {
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
                className={`module-card-item ${isActive ? 'is-active-module' : ''} ${isModLocked ? 'module-card-item--locked' : ''}`}
                style={isModLocked ? { cursor: 'not-allowed', opacity: 0.78, background: '#fafbfc' } : { cursor: 'pointer' }}
                onClick={() => {
                  if (isModLocked) {
                    toast.warning(moduleLock.lockReason || 'Complete previous module to unlock this module.');
                    return;
                  }
                  void openModule(module.id);
                }}
                role="button"
                tabIndex={isModLocked ? -1 : 0}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    if (isModLocked) {
                      toast.warning(moduleLock.lockReason || 'Complete previous module to unlock this module.');
                      return;
                    }
                    void openModule(module.id);
                  }
                }}
              >
                {/* Top: Index + Stage Label (Left) and Status Badge (Right) */}
                <div className="module-card-top">
                  <div className="module-card-top-left">
                    <div className="module-index-pill" style={isModLocked ? { background: '#e2e8f0', color: '#64748b', display: 'inline-flex', alignItems: 'center', gap: 4 } : undefined}>
                      {isModLocked && <Lock size={12} />}
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

                {/* Prerequisite notice if locked */}
                {isModLocked && (
                  <div style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px',
                    padding: '6px 12px',
                    background: '#f1f5f9',
                    border: '1px solid #e2e8f0',
                    borderRadius: '8px',
                    fontSize: '12px',
                    color: '#64748b',
                    fontWeight: 600,
                    margin: '6px 0 10px 0'
                  }}>
                    <Lock size={12} />
                    <span>{moduleLock.lockReason}</span>
                  </div>
                )}

                {/* Description */}
                <p className="module-card-desc">
                  {cleanModDesc || 'Build core principles, practical workflows, and real-world mastery through guided lessons and assessments.'}
                </p>

                {/* Meta Row: Duration, Lessons, Activities */}
                <div className="module-meta-row">
                  <span className="module-meta-item">
                    {durationLabel}
                  </span>
                  <span className="module-meta-item">
                    {modLessonsCount} lessons
                  </span>
                  <span className="module-meta-item">
                    {modActivitiesCount} activities
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
                          background: modProgress >= 100 ? '#10b981' : isModLocked ? '#94a3b8' : 'linear-gradient(90deg, #6366f1, #4f46e5)'
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
                    ) : isModLocked ? (
                      <button
                        type="button"
                        className="btn-module-outline"
                        style={{
                          background: '#f1f5f9',
                          color: '#64748b',
                          border: '1px solid #cbd5e1',
                          cursor: 'not-allowed',
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '6px'
                        }}
                        onClick={(e) => {
                          e.stopPropagation();
                          toast.warning(moduleLock.lockReason || 'Complete previous module first.');
                        }}
                      >
                        <Lock size={12} /> Locked
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
                <label style={{ display: 'block', fontSize: 12, fontWeight: 700, color: '#4f46e5', marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Learning Objectives (One per line)</label>
                <textarea rows={3} value={moduleObjectives} onChange={e => setModuleObjectives(e.target.value)} placeholder="e.g. Understand RESTful architecture principles&#10;Design clean API endpoints"
                  style={{ width: '100%', padding: '10px 14px', borderRadius: 10, border: '1.5px solid #c7d2fe', fontSize: 13, resize: 'vertical', outline: 'none', boxSizing: 'border-box', background: '#f5f3ff' }} />
              </div>
              <div>
                <label style={{ display: 'block', fontSize: 12, fontWeight: 700, color: '#16a34a', marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Learning Outcomes (One per line)</label>
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