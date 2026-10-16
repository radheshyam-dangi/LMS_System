import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { curriculumService } from '../../services/curriculumService';
import { assignmentService } from '../../services/assignmentService';
import {
  CheckCircle2,
  Clock,
  Search,
  X,
  Users,
  AlertCircle,
  Filter,
  ClipboardList,
  Bot,
  ChevronDown,
  ChevronUp,
  FileCheck,
  Award,
  Layers,
  ArrowRight,
  BookOpen,
  GraduationCap,
  TrendingUp,
  FileText
} from 'lucide-react';
import { useNotifications } from '../../context/NotificationContext';
import { useToast } from '../../context/ToastContext';
import { useSearchParams } from 'react-router-dom';
import { AssignmentsFilterPanel } from '../AssignmentsFilterPanel';
import { SubmissionDetailView, extractAssignmentQuestions } from './SubmissionDetailView';
import './TrainerDashboard.css';

interface TrainerEvaluationDashboardProps {
  accessToken: string;
  currentUser: any;
  activeSection?: string;
  activeRole?: string;
}

const PRIORITY_COLORS: Record<string, { bg: string; color: string; border: string }> = {
  High: { bg: '#fee2e2', color: '#b91c1c', border: '#fca5a5' },
  Medium: { bg: '#fef3c7', color: '#b45309', border: '#fde68a' },
  Low: { bg: '#dcfce7', color: '#166534', border: '#86efac' },
};

const STATUS_COLORS: Record<string, { bg: string; color: string; border: string; dot: string }> = {
  Pending: { bg: '#fffbeb', color: '#b45309', border: '#fde68a', dot: '#f59e0b' },
  'In Progress': { bg: '#eff6ff', color: '#1d4ed8', border: '#bfdbfe', dot: '#3b82f6' },
  Submitted: { bg: '#fef3c7', color: '#b45309', border: '#fde68a', dot: '#f59e0b' },
  Accepted: { bg: '#dcfce7', color: '#166534', border: '#86efac', dot: '#22c55e' },
  Approved: { bg: '#dcfce7', color: '#166534', border: '#86efac', dot: '#22c55e' },
  Rejected: { bg: '#fee2e2', color: '#b91c1c', border: '#fca5a5', dot: '#ef4444' },
};

const formatDuration = (d?: number, h?: number, m?: number) => {
  const parts = [];
  if (d) parts.push(`${d} day${d !== 1 ? 's' : ''}`);
  if (h) parts.push(`${h} hour${h !== 1 ? 's' : ''}`);
  if (m) parts.push(`${m} minute${m !== 1 ? 's' : ''}`);
  return parts.length ? parts.join(' ') : 'No duration';
};

const getRelativeTime = (dateStr?: string) => {
  if (!dateStr) return 'Date unknown';
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return 'Date unknown';
  const diffSec = Math.floor((Date.now() - d.getTime()) / 1000);
  if (diffSec < 60) return 'Just now';
  const diffMin = Math.floor(diffSec / 60);
  if (diffMin < 60) return `${diffMin}m ago`;
  const diffHour = Math.floor(diffMin / 60);
  if (diffHour < 24) return `${diffHour}h ago`;
  const diffDays = Math.floor(diffHour / 24);
  if (diffDays === 1) return 'Yesterday';
  if (diffDays < 7) return `${diffDays}d ago`;
  return d.toLocaleDateString();
};

/**
 * Safely builds initials from firstName/lastName, fallback to fullName split,
 * then email handle, then generic fallback. Guards against literal "undefined" strings.
 */
const isValidStr = (v?: string | null) =>
  typeof v === 'string' && v.trim().length > 0 && v.trim().toLowerCase() !== 'undefined';

const getTraineeInitials = (
  firstName?: string,
  lastName?: string,
  fullName?: string,
  email?: string
): string => {
  const fn = isValidStr(firstName) ? firstName!.trim() : '';
  const ln = isValidStr(lastName) ? lastName!.trim() : '';
  if (fn && ln) return (fn[0] + ln[0]).toUpperCase();
  if (fn) return fn.slice(0, 2).toUpperCase();
  if (ln) return ln.slice(0, 2).toUpperCase();
  // fallback: split full name
  if (isValidStr(fullName)) {
    const parts = fullName!.trim().split(/\s+/);
    if (parts.length >= 2) return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
    return parts[0].slice(0, 2).toUpperCase();
  }
  // fallback: email
  if (isValidStr(email)) return email!.trim().slice(0, 2).toUpperCase();
  return 'TR';
};

/** Legacy compat wrapper used by the assignment catalog section */
const getInitials = (name?: string, email?: string): string => {
  return getTraineeInitials(undefined, undefined, name, email);
};

export function TrainerEvaluationDashboard({
  accessToken,
  currentUser,
  activeSection,
  activeRole
}: TrainerEvaluationDashboardProps) {
  const { refresh: refreshNotifications, markRelatedRead } = useNotifications();
  const toast = useToast();
  const [searchQuery, setSearchQuery] = useState('');
  const [searchParams, setSearchParams] = useSearchParams();

  const localFiltersState = useMemo(() => {
    const filters: Record<string, string> = {};
    searchParams.forEach((value: string, key: string) => {
      filters[key] = value;
    });
    return filters;
  }, [searchParams]);

  // ─── Workspace Main Tab Switcher ──────────────────────────────────────
  // Default to evaluations if activeSection is Evaluations or URL has status=pending
  const initialTab = useMemo(() => {
    if (activeSection === 'Evaluations' || window.location.pathname.includes('/evaluations')) {
      return 'evaluations';
    }
    if (localFiltersState['tab'] === 'evaluations' || localFiltersState['tab'] === 'assignments') {
      return localFiltersState['tab'] as 'evaluations' | 'assignments';
    }
    if (localFiltersState['status'] === 'pending') {
      return 'evaluations';
    }
    return 'evaluations';
  }, [activeSection, localFiltersState]);

  const [activeMainTab, setActiveMainTab] = useState<'evaluations' | 'assignments'>(initialTab);

  // Sync tab with external section changes
  useEffect(() => {
    if (activeSection === 'Evaluations' || window.location.pathname.includes('/evaluations')) {
      setActiveMainTab('evaluations');
    }
  }, [activeSection]);

  const isAdminView = activeRole?.toLowerCase() === 'admin';

  // ─── Evaluation (pending submissions) state ───────────────────────────
  const [pendingSubmissions, setPendingSubmissions] = useState<any[]>([]);
  const [isLoadingSubmissions, setIsLoadingSubmissions] = useState(true);
  const [selectedSub, setSelectedSub] = useState<any | null>(null);

  // ─── Assignments list state ────────────────────────────────────────────
  const [assignments, setAssignments] = useState<any[]>([]);
  const [isLoadingAssignments, setIsLoadingAssignments] = useState(true);
  const [isFilterPanelOpen, setIsFilterPanelOpen] = useState(false);

  // ─── View / Edit Modal State ───────────────────────────────────────────
  const [expandedAssignmentId, setExpandedAssignmentId] = useState<string | null>(null);
  const lastOpenedIdRef = useRef<string | null>(null);

  // ─── Load data ─────────────────────────────────────────────────────────
  const loadAll = useCallback(async () => {
    setIsLoadingSubmissions(true);
    setIsLoadingAssignments(true);
    try {
      const [subs, allAssign] = await Promise.all([
        curriculumService.fetchPendingSubmissions(accessToken, activeRole).catch(() => []),
        assignmentService.fetchAllAssignments(accessToken, activeRole).catch(() => []),
      ]);
      setPendingSubmissions(Array.isArray(subs) ? subs : []);
      setAssignments(Array.isArray(allAssign) ? allAssign : []);
    } catch (err) {
      console.error('Failed to load assignments:', err);
    } finally {
      setIsLoadingSubmissions(false);
      setIsLoadingAssignments(false);
    }
  }, [accessToken, activeRole]);

  useEffect(() => {
    loadAll();
  }, [loadAll]);

  // ─── Filter assignments by status ─────────────────────────────────────
  const statusFilter = localFiltersState['status'] || 'All';
  const setStatusFilter = (val: string) => {
    const newFilters = { ...localFiltersState };
    if (val === 'All') {
      delete newFilters.status;
    } else {
      newFilters.status = val.toLowerCase();
    }
    setSearchParams(newFilters);
  };

  const filteredAssignments = useMemo(() => {
    let result = assignments;

    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      result = result.filter((a: any) => {
        const titleMatch = (a.title || '').toLowerCase().includes(query);
        const descMatch = (a.description || a.instructions || '').toLowerCase().includes(query);
        return titleMatch || descMatch;
      });
    }

    if (localFiltersState.id) {
      result = result.filter((a: any) => {
        if (a.id === localFiltersState.id) return true;
        const matchingSub = pendingSubmissions.find(
          (s: any) => s.id === localFiltersState.id && (s.assignment?.id === a.id || s.assignmentId === a.id)
        );
        return !!matchingSub;
      });
    }
    const normalize = (v: any) => String(v ?? '').trim().toLowerCase();

    if (Object.keys(localFiltersState).length > 0) {
      result = result.filter(assignment =>
        Object.entries(localFiltersState).every(([category, selectedValuesStr]) => {
          if (category === 'evaluationMode' || category === 'tab') return true;
          const selectedValues = selectedValuesStr.split(',').map(s => normalize(s));
          if (selectedValues.length === 0) return true;

          if (category === 'status') {
            const status = normalize(assignment.status || 'pending');
            const isApproved = status === 'accepted' || status === 'approved' || status === 'evaluated';
            const isRejected = status === 'rejected' || status === 'needs_improvement';

            if (selectedValues.includes('all')) return true;
            if (selectedValues.includes('approved') && isApproved) return true;
            if (selectedValues.includes('rejected') && isRejected) return true;
            return false;
          }
          if (category === 'type') {
            const type = assignment.isExternal ? 'external' : 'learning path';
            return selectedValues.includes(normalize(type));
          }
          if (category === 'difficulty') {
            const diff = normalize(assignment.difficultyLevel || 'medium');
            return selectedValues.includes(diff);
          }
          return true;
        })
      );
    }

    return result;
  }, [assignments, searchQuery, localFiltersState, pendingSubmissions]);

  const getActiveFilterCount = (filters: Record<string, string>, excludeKeys: string[] = []) => {
    return Object.entries(filters).reduce((count, [key, value]) => {
      if (excludeKeys.includes(key)) return count;
      if (typeof value === 'string') {
        return count + value.split(',').filter(Boolean).length;
      }
      if (typeof value === 'boolean') {
        return count + (value ? 1 : 0);
      }
      return count;
    }, 0);
  };

  const activeFilterCount = getActiveFilterCount(localFiltersState, ['status', 'evaluationMode', 'tab']);

  const statusCounts = useMemo(() => {
    const counts: Record<string, number> = {
      All: assignments.length,
      Approved: 0,
      Rejected: 0
    };
    assignments.forEach((a: any) => {
      const st = (a.status || '').toLowerCase();
      if (st === 'accepted' || st === 'approved' || st === 'evaluated') {
        counts['Approved'] = (counts['Approved'] || 0) + 1;
      } else if (st === 'rejected' || st === 'needs_improvement') {
        counts['Rejected'] = (counts['Rejected'] || 0) + 1;
      }
    });
    return counts;
  }, [assignments]);

  const summaryCards = [
    { title: 'All', count: assignments.length, key: 'All' },
    { title: 'Approved', count: statusCounts['Approved'] || 0, key: 'Approved' },
    { title: 'Rejected', count: statusCounts['Rejected'] || 0, key: 'Rejected' },
  ];

  // ─── Modal Handlers ──────────────────────────────────────────────
  const clearIdParam = () => {
    const newParams = new URLSearchParams(searchParams.toString());
    newParams.delete('id');
    setSearchParams(newParams);
    lastOpenedIdRef.current = null;
  };

  const handleOpenReview = async (sub: any) => {
    setSelectedSub(sub);
    try {
      await assignmentService.openSubmissionForEvaluation(sub.id, accessToken);
      await markRelatedRead('submission', sub.id);
      await refreshNotifications();
    } catch {
      // Non-blocking
    }
  };

  // Deep-linking listener for URL ?id= and ?tab=
  useEffect(() => {
    const idToOpen = searchParams.get('id');
    const tabParam = searchParams.get('tab');
    if (tabParam === 'evaluations' || tabParam === 'assignments') {
      setActiveMainTab(tabParam as 'evaluations' | 'assignments');
    }

    if (idToOpen && idToOpen !== lastOpenedIdRef.current) {
      if (isLoadingSubmissions || isLoadingAssignments) return;

      const targetSub = pendingSubmissions.find((s: any) => s.id === idToOpen || s.assignment?.id === idToOpen);
      if (targetSub) {
        lastOpenedIdRef.current = idToOpen;
        setActiveMainTab('evaluations');
        handleOpenReview(targetSub);
        return;
      }
      const targetAssign = assignments.find((a: any) => a.id === idToOpen);
      if (targetAssign) {
        lastOpenedIdRef.current = idToOpen;
        setActiveMainTab('assignments');
        setExpandedAssignmentId(targetAssign.id);
        return;
      }

      // If not in preloaded list, query backend directly
      let isCancelled = false;
      (async () => {
        try {
          const fetchedSub = await assignmentService.fetchSubmissionById(idToOpen, accessToken, activeRole).catch(() => null);
          if (fetchedSub && !isCancelled) {
            lastOpenedIdRef.current = idToOpen;
            setActiveMainTab('evaluations');
            handleOpenReview(fetchedSub);
            return;
          }
          const fetchedAssign = await assignmentService.fetchAssignmentById(idToOpen, accessToken).catch(() => null);
          if (fetchedAssign && !isCancelled) {
            lastOpenedIdRef.current = idToOpen;
            setActiveMainTab('assignments');
            setExpandedAssignmentId(fetchedAssign.id);
          }
        } catch (err) {
          console.error('Failed to resolve target for trainer:', err);
        }
      })();

      return () => {
        isCancelled = true;
      };
    }
  }, [pendingSubmissions, assignments, searchParams, isLoadingSubmissions, isLoadingAssignments, accessToken, activeRole]);

  // ─── Render Parsed Solutions in Assignment Details ──────────────────
  const renderParsedSubmission = (sub: any) => {
    const questions = extractAssignmentQuestions(sub.assignment);
    const isMcq =
      sub.assignment?.assignmentType === 'MCQ' ||
      questions.some((q: any) => q.type === 'MCQ' || (q.options && q.options.length > 0));
    let parsedAnswers: Record<string, any> = {};
    let isJson = false;
    let rawText = sub.submissionText || '';

    try {
      if (sub.submissionText) {
        const obj = JSON.parse(sub.submissionText);
        if (typeof obj === 'object' && obj !== null) {
          if (obj.answers !== undefined || obj.textAnswers !== undefined || obj.mcqAnswers !== undefined) {
            parsedAnswers = {
              ...(typeof obj.answers === 'object' && !Array.isArray(obj.answers) ? obj.answers : {}),
              ...(typeof obj.textAnswers === 'object' && !Array.isArray(obj.textAnswers) ? obj.textAnswers : {}),
              ...(typeof obj.mcqAnswers === 'object' && !Array.isArray(obj.mcqAnswers) ? obj.mcqAnswers : {}),
            };
            if (Array.isArray(obj.answers)) parsedAnswers = { 0: obj.answers };
          } else {
            parsedAnswers = obj;
          }
          if (obj.raw) rawText = obj.raw;
          isJson = true;
        }
      }
    } catch {}

    if (!isJson && questions.length === 0) {
      return (
        <div style={{ background: '#f8fafc', padding: '14px', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
          <strong style={{ fontSize: '12px', color: '#475569', display: 'block', marginBottom: '6px', textTransform: 'uppercase' }}>
            Submitted Solution:
          </strong>
          <div style={{ fontSize: '13px', color: '#0f172a', whiteSpace: 'pre-wrap', wordBreak: 'break-word', lineHeight: '1.5' }}>
            {rawText || 'No answer provided.'}
          </div>
        </div>
      );
    }

    const optionLetters = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H'];

    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
        {questions.map((q: any, idx: number) => {
          const traineeAnswer =
            parsedAnswers[q.id] ??
            parsedAnswers[idx] ??
            parsedAnswers[String(idx)] ??
            (idx === 0 && rawText ? rawText : null);
          const questionPoints = q.points || q.maxPoints || 10;
          const questionPrompt = q.text || q.questionText || q.question || `Question ${idx + 1}`;

          if (isMcq && q.options?.length > 0) {
            const traineeChoiceIdx =
              traineeAnswer !== null && traineeAnswer !== '' && !isNaN(Number(traineeAnswer))
                ? Number(traineeAnswer)
                : null;
            const correctChoiceIdx =
              q.correctIndex !== null && !isNaN(Number(q.correctIndex)) ? Number(q.correctIndex) : null;
            const isCorrect =
              traineeChoiceIdx !== null && correctChoiceIdx !== null && traineeChoiceIdx === correctChoiceIdx;

            return (
              <div
                key={q.id || idx}
                style={{
                  padding: '14px',
                  background: isCorrect ? '#f0fdf4' : traineeChoiceIdx !== null ? '#fff5f5' : '#f8fafc',
                  border: `1px solid ${isCorrect ? '#86efac' : traineeChoiceIdx !== null ? '#fca5a5' : '#e2e8f0'}`,
                  borderRadius: '10px',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '10px',
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '10px' }}>
                  <div style={{ display: 'flex', alignItems: 'flex-start', gap: '8px', flex: 1 }}>
                    <span style={{ background: '#e2e8f0', color: '#334155', fontSize: '11px', fontWeight: 800, padding: '2px 6px', borderRadius: '4px' }}>
                      Q{idx + 1}
                    </span>
                    <strong style={{ fontSize: '13.5px', color: '#0f172a', lineHeight: '1.45', wordBreak: 'break-word' }}>
                      {questionPrompt}
                    </strong>
                  </div>
                  <span style={{ fontSize: '11px', fontWeight: 700, color: '#475569', background: '#fff', padding: '2px 7px', borderRadius: '4px', border: '1px solid #e2e8f0', whiteSpace: 'nowrap' }}>
                    {questionPoints} Pts
                  </span>
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '5px' }}>
                  {q.options.map((opt: string, optIdx: number) => {
                    const isTraineePick = traineeChoiceIdx === optIdx;
                    const isThisCorrect = correctChoiceIdx === optIdx;

                    let optBg = '#ffffff';
                    let optBorder = '1px solid #e2e8f0';
                    let badgeBg = '#f1f5f9';
                    let badgeColor = '#475569';
                    let statusPill: React.ReactNode = null;

                    if (isTraineePick && isThisCorrect) {
                      optBg = '#dcfce7';
                      optBorder = '1.5px solid #16a34a';
                      badgeBg = '#16a34a';
                      badgeColor = '#ffffff';
                      statusPill = (
                        <span style={{ fontSize: '11px', fontWeight: 700, color: '#15803d', background: '#bbf7d0', padding: '2px 7px', borderRadius: '4px' }}>
                          ✓ Selected (Correct)
                        </span>
                      );
                    } else if (isTraineePick && !isThisCorrect) {
                      optBg = '#fee2e2';
                      optBorder = '1.5px solid #dc2626';
                      badgeBg = '#dc2626';
                      badgeColor = '#ffffff';
                      statusPill = (
                        <span style={{ fontSize: '11px', fontWeight: 700, color: '#b91c1c', background: '#fecaca', padding: '2px 7px', borderRadius: '4px' }}>
                          ✗ Selected (Incorrect)
                        </span>
                      );
                    } else if (isThisCorrect) {
                      optBg = '#f0fdf4';
                      optBorder = '1.5px solid #22c55e';
                      badgeBg = '#dcfce7';
                      badgeColor = '#15803d';
                      statusPill = (
                        <span style={{ fontSize: '11px', fontWeight: 700, color: '#15803d', background: '#dcfce7', padding: '2px 7px', borderRadius: '4px', border: '1px solid #86efac' }}>
                          ✓ Correct Answer
                        </span>
                      );
                    }

                    return (
                      <div
                        key={optIdx}
                        style={{
                          background: optBg,
                          border: optBorder,
                          borderRadius: '6px',
                          padding: '7px 10px',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                          gap: '10px',
                        }}
                      >
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flex: 1 }}>
                          <span
                            style={{
                              width: '20px',
                              height: '20px',
                              borderRadius: '50%',
                              background: badgeBg,
                              color: badgeColor,
                              fontSize: '10px',
                              fontWeight: 800,
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              flexShrink: 0,
                            }}
                          >
                            {optionLetters[optIdx] || optIdx + 1}
                          </span>
                          <span style={{ fontSize: '12.5px', color: '#1e293b', fontWeight: isTraineePick || isThisCorrect ? 700 : 500, wordBreak: 'break-word' }}>
                            {opt}
                          </span>
                        </div>
                        {statusPill}
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          }

          // Subjective question
          return (
            <div
              key={q.id || idx}
              style={{
                padding: '14px',
                background: '#ffffff',
                border: '1px solid #e2e8f0',
                borderRadius: '8px',
                display: 'flex',
                flexDirection: 'column',
                gap: '8px',
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '8px' }}>
                <span style={{ fontSize: '13.5px', fontWeight: 700, color: '#0f172a' }}>
                  Q{idx + 1}: {questionPrompt}
                </span>
                <span style={{ fontSize: '11px', fontWeight: 700, color: '#4f46e5', background: '#eef2ff', padding: '2px 6px', borderRadius: '4px', whiteSpace: 'nowrap' }}>
                  {questionPoints} Pts
                </span>
              </div>
              <div style={{ background: '#f8fafc', padding: '10px', borderRadius: '6px', border: '1px solid #e2e8f0', fontSize: '13px', color: '#1e293b', whiteSpace: 'pre-wrap' }}>
                {traineeAnswer ? String(traineeAnswer) : <em style={{ color: '#94a3b8' }}>No answer written.</em>}
              </div>
            </div>
          );
        })}
      </div>
    );
  };

  // ─── Evaluations Queue Filter Logic ────────────────────────────────────
  const filteredSubs = useMemo(() => {
    return pendingSubmissions.filter((sub: any) => {
      if (!searchQuery.trim()) return true;
      const query = searchQuery.toLowerCase();
      const traineeName = `${sub.trainee?.firstName || ''} ${sub.trainee?.lastName || ''}`.toLowerCase();
      const titleMatch = (sub.assignment?.title || '').toLowerCase().includes(query);
      const emailMatch = (sub.trainee?.email || '').toLowerCase().includes(query);
      return traineeName.includes(query) || titleMatch || emailMatch;
    });
  }, [pendingSubmissions, searchQuery]);

  const aiEvaluated = useMemo(() => {
    return filteredSubs.filter((s: any) => s.status === 'ai_evaluated_pending_review' || s.aiTotalScore != null);
  }, [filteredSubs]);

  const manualPending = useMemo(() => {
    return filteredSubs.filter((s: any) => s.status !== 'ai_evaluated_pending_review' && s.aiTotalScore == null);
  }, [filteredSubs]);

  const activeMode = localFiltersState['evaluationMode'] || undefined;
  const setEvaluationMode = (mode: string | null) => {
    const newFilters = { ...localFiltersState };
    if (!mode) {
      delete newFilters.evaluationMode;
    } else {
      newFilters.evaluationMode = mode;
    }
    setSearchParams(newFilters);
  };

  return (
    <div className="trainer-evaluation-container">
      {/* ── 1. PAGE HEADER ── */}
      <header className="eval-header-row">
        <div className="eval-header-left">
          {/* <div className="eval-eyebrow-badge">
            <GraduationCap size={13} />
            <span>Assessment & Review Workspace · {activeRole || 'Trainer'}</span>
          </div> */}
          <h1 className="eval-main-title">
            {activeMainTab === 'evaluations' ? 'Evaluation Queue' : 'Assignment Catalog'}
          </h1>
          <p className="eval-sub-heading">
            {activeMainTab === 'evaluations'
              ? ''
              : ''}
          </p>
        </div>
      </header>

      {/* ── 2. PRIMARY WORKSPACE NAVIGATION TABS ── */}
      <nav className="eval-workspace-tabs-bar" aria-label="Evaluation workspace sections">
        <button
          type="button"
          className={`eval-workspace-tab-btn ${activeMainTab === 'evaluations' ? 'is-active' : ''}`}
          onClick={() => {
            setActiveMainTab('evaluations');
            const newFilters = { ...localFiltersState };
            newFilters.tab = 'evaluations';
            setSearchParams(newFilters);
          }}
        >
          <ClipboardList size={16} />
          <span>Evaluation Queue</span>
          <span
            className={`eval-tab-badge-counter ${
              pendingSubmissions.length > 0 ? 'badge-pending' : ''
            }`}
          >
            {pendingSubmissions.length}
          </span>
        </button>

        <button
          type="button"
          className={`eval-workspace-tab-btn ${activeMainTab === 'assignments' ? 'is-active' : ''}`}
          onClick={() => {
            setActiveMainTab('assignments');
            const newFilters = { ...localFiltersState };
            newFilters.tab = 'assignments';
            setSearchParams(newFilters);
          }}
        >
          <Layers size={16} />
          <span>All Assignments & Tasks</span>
          <span className="eval-tab-badge-counter">{assignments.length}</span>
        </button>
      </nav>

      {/* ── 3. INTERACTIVE METRIC STRIP ── */}
      <section className="eval-metrics-grid" aria-label="Quick metrics">
        {summaryCards.map((card) => {
          const isActive =
            (card.key === 'All' && activeMainTab === 'assignments' && (!localFiltersState.status || localFiltersState.status.toLowerCase() === 'all')) ||
            (localFiltersState.status && localFiltersState.status.toLowerCase() === card.key.toLowerCase());

          return (
            <div
              key={card.key}
              className={`eval-metric-card ${isActive ? 'active-metric-filter' : ''}`}
              onClick={() => {
                setActiveMainTab('assignments');
                setStatusFilter(card.key);
              }}
              role="button"
              tabIndex={0}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  setActiveMainTab('assignments');
                  setStatusFilter(card.key);
                }
              }}
              title={`Filter by ${card.title}`}
            >
              <div className="eval-metric-icon-box">
                {card.key === 'All' ? (
                  <Layers size={18} />
                ) : card.key === 'Approved' ? (
                  <CheckCircle2 size={18} />
                ) : (
                  <AlertCircle size={18} />
                )}
              </div>
              <div className="eval-metric-content">
                <span className="eval-metric-label">{card.title}</span>
                <div className="eval-metric-value-row">
                  <span className="eval-metric-number">
                    {isLoadingAssignments ? '—' : card.count}
                  </span>
                  <span className="eval-metric-subtext">{card.key === 'All' ? 'total' : 'submissions'}</span>
                </div>
              </div>
            </div>
          );
        })}
      </section>

      {/* ── 4. SEARCH, SUBMODE & FILTER CONTROLS BAR ── */}
      <section className="eval-controls-bar" aria-label="Controls and filters">
        {/* Left Sub-tabs (when in Evaluations Queue) */}
        {activeMainTab === 'evaluations' ? (
          <div className="eval-submode-pill-row" role="tablist">
            <button
              type="button"
              className={`eval-submode-pill ${!activeMode ? 'is-active' : ''}`}
              onClick={() => setEvaluationMode(null)}
            >
              <span>All Pending</span>
              <span className="eval-tab-badge-counter">{filteredSubs.length}</span>
            </button>
            <button
              type="button"
              className={`eval-submode-pill ${activeMode === 'ai-assisted' ? 'is-active' : ''}`}
              onClick={() => setEvaluationMode('ai-assisted')}
            >
              <Bot size={13} strokeWidth={1.75} />
              <span>AI Evaluated</span>
              <span className="eval-tab-badge-counter">{aiEvaluated.length}</span>
            </button>
            <button
              type="button"
              className={`eval-submode-pill ${activeMode === 'manual' ? 'is-active' : ''}`}
              onClick={() => setEvaluationMode('manual')}
            >
              <FileCheck size={13} />
              <span>Manual Review</span>
              <span className="eval-tab-badge-counter">{manualPending.length}</span>
            </button>
          </div>
        ) : (
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '13px', fontWeight: 600, color: '#475569' }}>
            <span>Showing:</span>
            <span style={{ color: '#0f172a', fontWeight: 700 }}>
              {statusFilter === 'All' ? 'All Assignments' : `${statusFilter} Tasks`} ({filteredAssignments.length})
            </span>
          </div>
        )}

        {/* Right Search & Filter Action */}
        <div className="eval-search-and-actions">
          <div className="eval-search-field-wrapper">
            <span className="eval-search-icon">
              <Search size={14} />
            </span>
            <input
              type="text"
              className="eval-search-input"
              placeholder={
                activeMainTab === 'evaluations'
                  ? 'Search by trainee, email, or task...'
                  : 'Search assignments or tasks...'
              }
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              aria-label="Search submissions or assignments"
            />
            {searchQuery && (
              <button
                type="button"
                className="eval-search-clear-btn"
                onClick={() => setSearchQuery('')}
                title="Clear search"
                aria-label="Clear search"
              >
                <X size={14} />
              </button>
            )}
          </div>

          {activeMainTab === 'assignments' && (
            <button
              type="button"
              className="btn-eval-filters-panel-trigger"
              onClick={() => setIsFilterPanelOpen(true)}
            >
              <Filter size={15} />
              <span>Filters</span>
              {activeFilterCount > 0 && (
                <span className="eval-filters-active-badge">{activeFilterCount}</span>
              )}
            </button>
          )}
        </div>
      </section>

      {/* ── Active Filters Chips ── */}
      {activeFilterCount > 0 && activeMainTab === 'assignments' && (
        <div className="eval-active-chips-strip">
          {Object.entries(localFiltersState).map(([key, value]) => {
            if (!value || key === 'status' || key === 'evaluationMode' || key === 'tab') return null;

            if (key === 'id') {
              const targetAssign = assignments.find((a) => a.id === value);
              let title = targetAssign?.title;
              if (!title) {
                const targetSub = pendingSubmissions.find((s) => s.id === value);
                title = targetSub?.assignment?.title || 'Specific Assignment';
              }
              return (
                <div key={`id-${value}`} className="eval-chip-tag">
                  <span>Viewing: {title}</span>
                  <button
                    type="button"
                    className="eval-chip-remove-btn"
                    onClick={() => {
                      const newFilters = { ...localFiltersState };
                      delete newFilters.id;
                      setSearchParams(newFilters);
                    }}
                  >
                    <X size={13} />
                  </button>
                </div>
              );
            }

            let categoryLabel = key;
            if (key === 'type') categoryLabel = 'Type';
            if (key === 'difficulty') categoryLabel = 'Difficulty';

            return value.split(',').map((v) => (
              <div key={`${key}-${v}`} className="eval-chip-tag">
                <span>
                  {categoryLabel}: {v}
                </span>
                <button
                  type="button"
                  className="eval-chip-remove-btn"
                  onClick={() => {
                    const currentVals = value.split(',');
                    const newVals = currentVals.filter((val) => val !== v);
                    const newFilters = { ...localFiltersState };
                    if (newVals.length > 0) {
                      newFilters[key] = newVals.join(',');
                    } else {
                      delete newFilters[key];
                    }
                    setSearchParams(newFilters);
                  }}
                >
                  <X size={13} />
                </button>
              </div>
            ));
          })}
          <button
            type="button"
            className="eval-chip-clear-all-link"
            onClick={() => setSearchParams({})}
          >
            Clear all filters
          </button>
        </div>
      )}

      {/* Assignments Filter Modal Panel */}
      <AssignmentsFilterPanel
        isOpen={isFilterPanelOpen}
        onClose={() => setIsFilterPanelOpen(false)}
        categories={[
          {
            id: 'status',
            label: 'Status',
            options: [
              { label: 'All', value: 'all' },
              { label: 'Approved', value: 'approved' },
              { label: 'Rejected', value: 'rejected' },
            ],
          },
          {
            id: 'type',
            label: 'Type',
            options: [
              { label: 'Learning Path', value: 'learning path' },
              { label: 'External', value: 'external' },
            ],
          },
          {
            id: 'difficulty',
            label: 'Difficulty',
            options: [
              { label: 'Basic', value: 'basic' },
              { label: 'Medium', value: 'medium' },
              { label: 'Hard', value: 'hard' },
            ],
          },
        ]}
        initialFilters={localFiltersState}
        onApply={(newFilters: Record<string, string>) => setSearchParams(newFilters)}
      />

      {/* ═══ VIEW 1: EVALUATION QUEUE ═══ */}
      {activeMainTab === 'evaluations' && (
        <>
          {isLoadingSubmissions ? (
            /* Skeleton Loading Grid for Queue */
            <div className="eval-queue-grid" aria-busy="true" aria-label="Loading submissions...">
              {Array.from({ length: 6 }).map((_, idx) => (
                <div key={idx} className="eval-skeleton-queue-card">
                  <div className="eval-skeleton-header">
                    <div className="eval-skeleton-identity">
                      <div className="eval-skeleton-shimmer eval-skeleton-avatar" />
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                        <div className="eval-skeleton-shimmer eval-skeleton-bar-title" style={{ width: '110px' }} />
                        <div className="eval-skeleton-shimmer eval-skeleton-bar-sub" style={{ width: '150px' }} />
                      </div>
                    </div>
                    <div className="eval-skeleton-shimmer eval-skeleton-time" />
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', margin: '6px 0' }}>
                    <div className="eval-skeleton-shimmer eval-skeleton-bar-title" />
                    <div className="eval-skeleton-shimmer eval-skeleton-bar-sub" />
                  </div>
                  <div className="eval-skeleton-badges">
                    <div className="eval-skeleton-shimmer eval-skeleton-badge" />
                    <div className="eval-skeleton-shimmer eval-skeleton-badge" />
                  </div>
                  <div className="eval-skeleton-shimmer eval-skeleton-btn" />
                </div>
              ))}
            </div>
          ) : filteredSubs.length === 0 ? (
            /* Empty Queue State */
            <div className="eval-empty-state">
              <div className="eval-empty-icon-box">
                <CheckCircle2 size={28} />
              </div>
              <h3 className="eval-empty-title">All Caught Up!</h3>
              <p className="eval-empty-desc">
                {searchQuery || activeMode
                  ? `No pending evaluations matched your criteria (${activeMode ? `Mode: ${activeMode}` : ''}${searchQuery ? `, Query: "${searchQuery}"` : ''}).`
                  : 'There are no pending submissions awaiting review. Great work!'}
              </p>
              {searchQuery || activeMode ? (
                <button
                  type="button"
                  className="eval-chip-clear-all-link"
                  onClick={() => {
                    setSearchQuery('');
                    setEvaluationMode(null);
                  }}
                >
                  Clear filters
                </button>
              ) : null}
            </div>
          ) : (
            /* Render Queue Cards */
            <div className="eval-queue-grid">
              {filteredSubs
                .filter((sub: any) => {
                  if (activeMode === 'ai-assisted') {
                    return sub.status === 'ai_evaluated_pending_review' || sub.aiTotalScore != null;
                  }
                  if (activeMode === 'manual') {
                    return sub.status !== 'ai_evaluated_pending_review' && sub.aiTotalScore == null;
                  }
                  return true;
                })
                .map((sub: any) => {
                  const traineeFullName =
                    `${sub.trainee?.firstName || ''} ${sub.trainee?.lastName || ''}`.trim() ||
                    sub.trainee?.email ||
                    'Trainee';
                  const taskTitle = sub.assignment?.title || 'Assignment Task';
                  const maxScore = sub.assignment?.maxScore || 100;
                  const isAiEvaluated = sub.status === 'ai_evaluated_pending_review' || sub.aiTotalScore != null;
                  const aiScore = sub.aiEvaluationResult?.totalScore ?? sub.aiTotalScore;

                  const pathCrumb = [
                    sub.assignment?.learningPath?.title || sub.assignment?.module?.learningPath?.title,
                    sub.assignment?.module?.title,
                  ]
                    .filter(Boolean)
                    .join(' › ');

                  const traineeInitials = getTraineeInitials(
                    sub.trainee?.firstName,
                    sub.trainee?.lastName,
                    traineeFullName,
                    sub.trainee?.email
                  );
                  const traineeAvatarUrl: string | undefined =
                    sub.trainee?.avatarUrl || sub.trainee?.profileImage || sub.trainee?.avatar || undefined;

                  return (
                    <article key={sub.id} className="eval-submission-card">
                      {/* Top: Trainee Profile & Submitted Timestamp */}
                      <div className="eval-card-header">
                        <div className="eval-trainee-identity">
                          <div className="eval-trainee-avatar-wrapper">
                            {traineeAvatarUrl ? (
                              <img
                                src={traineeAvatarUrl}
                                alt={traineeFullName}
                                className="eval-trainee-avatar-img"
                                onError={(e) => {
                                  const wrapper = e.currentTarget.parentElement;
                                  if (wrapper) {
                                    e.currentTarget.style.display = 'none';
                                    const initEl = wrapper.querySelector('.eval-trainee-avatar-fallback') as HTMLElement | null;
                                    if (initEl) initEl.style.display = 'flex';
                                  }
                                }}
                              />
                            ) : null}
                            <div
                              className="eval-trainee-avatar-fallback eval-trainee-avatar"
                              style={{ display: traineeAvatarUrl ? 'none' : 'flex' }}
                            >
                              {traineeInitials}
                            </div>
                          </div>
                          <div className="eval-trainee-meta-text">
                            <span className="eval-trainee-fullname">{traineeFullName}</span>
                            <span className="eval-trainee-email">{sub.trainee?.email}</span>
                          </div>
                        </div>

                        <span className="eval-time-badge" title={new Date(sub.submittedAt).toLocaleString()}>
                          <Clock size={11} />
                          <span>{getRelativeTime(sub.submittedAt)}</span>
                        </span>
                      </div>

                      {/* Body: Task Context, Title, Assessment Type */}
                      <div className="eval-card-body">
                        {pathCrumb && (
                          <span className="eval-hierarchy-crumb" title={pathCrumb}>
                            <BookOpen size={11} />
                            <span>{pathCrumb}</span>
                          </span>
                        )}

                        <h3 className="eval-assignment-title">{taskTitle}</h3>

                        <div className="eval-badges-row">
                          {isAiEvaluated ? (
                            <span className="eval-badge-pill eval-badge-ai">
                              <Bot size={11} strokeWidth={1.75} />
                              <span>AI-Assisted {aiScore != null ? `(${aiScore}/${maxScore})` : ''}</span>
                            </span>
                          ) : (
                            <span className="eval-badge-pill eval-badge-manual">
                              <FileCheck size={11} />
                              <span>Manual Review Required</span>
                            </span>
                          )}

                          <span className="eval-badge-pill" style={{ background: '#f1f5f9', color: '#475569' }}>
                            Max: {maxScore} pts
                          </span>
                        </div>
                      </div>

                      {/* Footer: Direct Primary Review & Grade CTA */}
                      <div className="eval-card-footer">
                        <button
                          type="button"
                          className="btn-eval-review-action"
                          onClick={async () => {
                            try {
                              const fullSub = await curriculumService.fetchSubmissionDetails(accessToken, sub.id);
                              handleOpenReview(fullSub);
                            } catch {
                              handleOpenReview(sub);
                            }
                          }}
                        >
                          <span>Review & Grade</span>
                          <ArrowRight size={14} />
                        </button>
                      </div>
                    </article>
                  );
                })}
            </div>
          )}
        </>
      )}

      {/* ═══ VIEW 2: ALL ASSIGNMENTS & TASKS ═══ */}
      {activeMainTab === 'assignments' && (
        <>
          {isLoadingAssignments ? (
            /* Skeleton Loading Rows for Assignment Catalog */
            <div className="eval-assignments-list" aria-busy="true" aria-label="Loading assignments...">
              {Array.from({ length: 6 }).map((_, idx) => (
                <div key={idx} className="eval-skeleton-row-item">
                  <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '8px' }}>
                    <div className="eval-skeleton-shimmer" style={{ width: '50%', height: '18px' }} />
                    <div className="eval-skeleton-shimmer" style={{ width: '30%', height: '14px' }} />
                  </div>
                  <div className="eval-skeleton-shimmer" style={{ width: '120px', height: '34px' }} />
                </div>
              ))}
            </div>
          ) : filteredAssignments.length === 0 ? (
            /* Empty State */
            <div className="eval-empty-state">
              <div className="eval-empty-icon-box">
                <FileText size={28} />
              </div>
              <h3 className="eval-empty-title">No Assignments Found</h3>
              <p className="eval-empty-desc">
                No curriculum tasks matched your current filter selection. Try resetting or adjusting your search.
              </p>
              <button
                type="button"
                className="eval-chip-clear-all-link"
                onClick={() => setSearchParams({})}
              >
                Reset filters
              </button>
            </div>
          ) : (
            /* Assignments List */
            <div className="eval-assignments-list">
              {filteredAssignments.map((assign: any) => {
                const rawStatus = (assign.status || 'Pending').toLowerCase();
                let displayStatus = 'Pending';
                if (rawStatus === 'accepted' || rawStatus === 'approved' || rawStatus === 'evaluated') {
                  displayStatus = 'Approved';
                } else if (rawStatus === 'rejected' || rawStatus === 'needs_improvement') {
                  displayStatus = 'Rejected';
                }

                const colorKey = displayStatus === 'Pending' ? 'Submitted' : displayStatus;
                const sc = STATUS_COLORS[colorKey] || STATUS_COLORS.Pending;
                const pc = PRIORITY_COLORS[assign.priority || 'Medium'] || PRIORITY_COLORS.Medium;

                let traineeName = 'Unassigned';
                if (assign.trainee || assign.assignedTo) {
                  const t = assign.trainee || assign.assignedTo;
                  traineeName = `${t.firstName || ''} ${t.lastName || ''}`.trim() || t.email || 'Unknown';
                } else if (assign.latestSubmission?.trainee) {
                  const t = assign.latestSubmission.trainee;
                  traineeName = `${t.firstName || ''} ${t.lastName || ''}`.trim() || t.email || 'Unknown';
                } else if (assign.traineeIds?.length) {
                  traineeName = `${assign.traineeIds.length} trainees`;
                } else if (assign.assignedToTraineeIds?.length) {
                  traineeName = `${assign.assignedToTraineeIds.length} trainees`;
                }

                const isExpanded = expandedAssignmentId === assign.id;

                return (
                  <article key={assign.id} className="eval-assignment-item">
                    <div className="eval-assignment-main-row">
                      {/* Left: Title, Priority, Status, Context */}
                      <div className="eval-assignment-left">
                        <div className="eval-assignment-title-row">
                          <span className="eval-assignment-title-text">{assign.title}</span>
                          <span
                            style={{
                              ...pc,
                              padding: '2px 8px',
                              borderRadius: '4px',
                              fontSize: '11px',
                              fontWeight: 700,
                              border: '1px solid',
                            }}
                          >
                            {assign.priority || 'Medium'}
                          </span>
                          <span
                            style={{
                              ...sc,
                              padding: '2px 8px',
                              borderRadius: '4px',
                              fontSize: '11px',
                              fontWeight: 700,
                              border: '1px solid',
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: '4px',
                            }}
                          >
                            <span
                              style={{
                                width: '6px',
                                height: '6px',
                                borderRadius: '50%',
                                background: sc.dot,
                                display: 'inline-block',
                              }}
                            />
                            {displayStatus}
                          </span>
                        </div>

                        <div className="eval-assignment-meta-strip">
                          {assign.module?.title && (
                            <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                              <Layers size={12} />
                              <span>{assign.module.title}</span>
                            </span>
                          )}
                          <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                            <Users size={12} />
                            <span>{traineeName}</span>
                          </span>
                          {(assign.durationDays > 0 || assign.durationHours > 0 || assign.durationMinutes > 0) && (
                            <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                              <Clock size={12} />
                              <span>{formatDuration(assign.durationDays, assign.durationHours, assign.durationMinutes)}</span>
                            </span>
                          )}
                        </div>
                      </div>

                      {/* Right: Scores & Action Buttons */}
                      <div className="eval-assignment-actions-right">
                        {assign.score != null && (
                          <span className="eval-score-badge">
                            {assign.score}/{assign.maxScore || 100}
                          </span>
                        )}

                        {displayStatus === 'Pending' && assign.latestSubmission && (
                          <button
                            type="button"
                            className="btn-trainer-action-primary"
                            onClick={async () => {
                              try {
                                const fullSub = await curriculumService.fetchSubmissionDetails(
                                  accessToken,
                                  assign.latestSubmission.id
                                );
                                handleOpenReview(fullSub);
                              } catch {
                                handleOpenReview(assign.latestSubmission);
                              }
                            }}
                          >
                            <span>Review & Grade</span>
                          </button>
                        )}

                        <button
                          type="button"
                          className="btn-eval-toggle-details"
                          onClick={() => setExpandedAssignmentId(isExpanded ? null : assign.id)}
                          aria-expanded={isExpanded}
                        >
                          <span>{isExpanded ? 'Hide Details' : 'View Details'}</span>
                          {isExpanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                        </button>
                      </div>
                    </div>

                    {/* Inline Expanded Panel */}
                    {isExpanded && (
                      <div className="eval-assignment-expanded-panel">
                        <div className="eval-meta-grid-box">
                          <div className="eval-meta-item">
                            <span className="eval-meta-item-label">Curriculum Track Hierarchy</span>
                            <span className="eval-meta-item-val">
                              {[
                                assign.learningPath?.title ||
                                  assign.module?.learningPath?.title ||
                                  assign.lesson?.module?.learningPath?.title,
                                assign.module?.title || assign.lesson?.module?.title,
                                assign.lesson?.title,
                              ]
                                .filter(Boolean)
                                .join(' ➔ ') || 'External Task'}
                            </span>
                          </div>

                          <div className="eval-meta-item">
                            <span className="eval-meta-item-label">Latest Submitter</span>
                            <span className="eval-meta-item-val">
                              {assign.latestSubmission?.trainee
                                ? `${assign.latestSubmission.trainee.firstName || ''} ${
                                    assign.latestSubmission.trainee.lastName || ''
                                  }`.trim()
                                : 'No submissions yet'}
                            </span>
                          </div>

                          <div className="eval-meta-item">
                            <span className="eval-meta-item-label">Duration & Pacing Anchor</span>
                            <span className="eval-meta-item-val">
                              {formatDuration(assign.durationDays, assign.durationHours, assign.durationMinutes)} (
                              {assign.anchorType === 'LP_ASSIGNED'
                                ? 'When LP is Assigned'
                                : assign.anchorType === 'TASK_UNLOCKED'
                                ? 'When Task is Unlocked'
                                : assign.anchorType || 'Default'}
                              )
                            </span>
                          </div>

                          <div className="eval-meta-item">
                            <span className="eval-meta-item-label">Submitted Timestamp</span>
                            <span className="eval-meta-item-val">
                              {assign.latestSubmission?.submittedAt
                                ? new Date(assign.latestSubmission.submittedAt).toLocaleString()
                                : 'N/A'}
                            </span>
                          </div>
                        </div>

                        {assign.instructions && (
                          <div className="eval-instructions-box">
                            <div className="eval-instructions-label">Task Instructions</div>
                            <div
                              className="eval-instructions-content"
                              dangerouslySetInnerHTML={{ __html: assign.instructions }}
                            />
                          </div>
                        )}

                        {/* Trainee Answer or Questions Breakdown */}
                        {assign.latestSubmission ? (
                          <div style={{ marginTop: '8px' }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                              <strong style={{ fontSize: '13px', color: '#0f172a' }}>Latest Trainee Solution Breakdown:</strong>
                              {assign.score != null && (
                                <span style={{ background: '#dcfce7', color: '#166534', padding: '3px 8px', borderRadius: '6px', fontSize: '12px', fontWeight: 700 }}>
                                  Score: {assign.score} / {assign.maxScore}
                                </span>
                              )}
                            </div>
                            {renderParsedSubmission(assign.latestSubmission)}
                          </div>
                        ) : assign.mcqConfig?.questions?.length > 0 ? (
                          <div style={{ background: '#fff', padding: '14px', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
                            <strong style={{ fontSize: '13px', color: '#1e293b', display: 'block', marginBottom: '8px' }}>
                              Assignment Questions Breakdown:
                            </strong>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                              {assign.mcqConfig.questions.map((q: any, qIdx: number) => {
                                const qText = q.text || q.questionText || q.question || `Question ${qIdx + 1}`;
                                const optionLetters = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H'];
                                return (
                                  <div
                                    key={qIdx}
                                    style={{
                                      background: '#f8fafc',
                                      padding: '10px 12px',
                                      borderRadius: '6px',
                                      border: '1px solid #e2e8f0',
                                    }}
                                  >
                                    <div style={{ fontSize: '12.5px', fontWeight: 700, color: '#0f172a', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '8px' }}>
                                      <span>
                                        Q{qIdx + 1}: {qText}
                                      </span>
                                      <span style={{ fontSize: '11px', color: '#4f46e5', background: '#eef2ff', padding: '1px 6px', borderRadius: '4px', whiteSpace: 'nowrap' }}>
                                        {q.points || q.maxPoints || 10} pts
                                      </span>
                                    </div>
                                    {q.options?.length > 0 && (
                                      <div style={{ marginTop: '6px', display: 'flex', flexDirection: 'column', gap: '3px' }}>
                                        {q.options.map((opt: string, optIdx: number) => (
                                          <div
                                            key={optIdx}
                                            style={{
                                              fontSize: '11.5px',
                                              color: '#475569',
                                              display: 'flex',
                                              alignItems: 'center',
                                              gap: '6px',
                                            }}
                                          >
                                            <span
                                              style={{
                                                width: '16px',
                                                height: '16px',
                                                borderRadius: '50%',
                                                background: '#e2e8f0',
                                                color: '#334155',
                                                fontSize: '9.5px',
                                                fontWeight: 700,
                                                display: 'flex',
                                                alignItems: 'center',
                                                justifyContent: 'center',
                                              }}
                                            >
                                              {optionLetters[optIdx] || optIdx + 1}
                                            </span>
                                            <span>{opt}</span>
                                          </div>
                                        ))}
                                      </div>
                                    )}
                                  </div>
                                );
                              })}
                            </div>
                          </div>
                        ) : null}
                      </div>
                    )}
                  </article>
                );
              })}
            </div>
          )}
        </>
      )}

      {/* ═══ 5. EVALUATION MODAL (SUBMISSION DETAIL VIEW) ═══ */}
      {selectedSub && (
        <SubmissionDetailView
          submission={selectedSub}
          accessToken={accessToken}
          isAdminView={isAdminView}
          onClose={() => {
            setSelectedSub(null);
            clearIdParam();
          }}
          onEvaluated={() => {
            setSelectedSub(null);
            clearIdParam();
            loadAll();
            refreshNotifications();
          }}
        />
      )}
    </div>
  );
}