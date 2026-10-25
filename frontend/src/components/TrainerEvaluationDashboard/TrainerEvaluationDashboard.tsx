import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { curriculumService } from '../../services/curriculumService';
import { assignmentService } from '../../services/assignmentService';
import {
  CheckCircle2,
  Clock,
  Search,
  X,
  Bot,
  FileCheck,
  ArrowRight,
  BookOpen
} from 'lucide-react';
import { useNotifications } from '../../context/NotificationContext';
import { useSearchParams } from 'react-router-dom';
import { SubmissionDetailView } from './SubmissionDetailView';
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
  currentUser: _currentUser,
  activeSection: _activeSection,
  activeRole
}: TrainerEvaluationDashboardProps) {
  const { refresh: refreshNotifications, markRelatedRead } = useNotifications();
  const [searchQuery, setSearchQuery] = useState('');
  const [searchParams, setSearchParams] = useSearchParams();

  const localFiltersState = useMemo(() => {
    const filters: Record<string, string> = {};
    searchParams.forEach((value: string, key: string) => {
      filters[key] = value;
    });
    return filters;
  }, [searchParams]);

  const isAdminView = activeRole?.toLowerCase() === 'admin';

  // ─── Evaluation (pending submissions) state ───────────────────────────
  const [pendingSubmissions, setPendingSubmissions] = useState<any[]>([]);
  const [isLoadingSubmissions, setIsLoadingSubmissions] = useState(true);
  const [selectedSub, setSelectedSub] = useState<any | null>(null);

  const [resolvedTargetAssignmentId, setResolvedTargetAssignmentId] = useState<string | null>(null);
  const [resolvedTargetTitle, setResolvedTargetTitle] = useState<string | null>(null);
  const lastOpenedIdRef = useRef<string | null>(null);

  // ─── Load data ─────────────────────────────────────────────────────────
  const loadAll = useCallback(async () => {
    setIsLoadingSubmissions(true);
    try {
      const subs = await curriculumService.fetchPendingSubmissions(accessToken, activeRole).catch(() => []);
      setPendingSubmissions(Array.isArray(subs) ? subs : []);
    } catch (err) {
      console.error('Failed to load pending submissions:', err);
    } finally {
      setIsLoadingSubmissions(false);
    }
  }, [accessToken, activeRole]);

  useEffect(() => {
    loadAll();
  }, [loadAll]);

  // ─── Modal Handlers ──────────────────────────────────────────────
  const clearIdParam = () => {
    const newParams = new URLSearchParams(searchParams.toString());
    newParams.delete('id');
    newParams.delete('assignmentId');
    newParams.delete('submissionId');
    setSearchParams(newParams);
    lastOpenedIdRef.current = null;
    setResolvedTargetAssignmentId(null);
    setResolvedTargetTitle(null);
  };

  const handleOpenReview = async (sub: any) => {
    try {
      const fullSub = await curriculumService.fetchSubmissionDetails(accessToken, sub.id);
      setSelectedSub(fullSub || sub);
    } catch {
      setSelectedSub(sub);
    }
    try {
      await assignmentService.openSubmissionForEvaluation(sub.id, accessToken);
      await markRelatedRead('submission', sub.id);
      await refreshNotifications();
    } catch {
      // Non-blocking
    }
  };

  const targetId = searchParams.get('id') || searchParams.get('assignmentId') || searchParams.get('submissionId');

  // Deep-linking listener for URL ?id= (from notifications)
  useEffect(() => {
    if (targetId) {
      if (targetId === lastOpenedIdRef.current) return;
      lastOpenedIdRef.current = targetId;

      const targetSub = pendingSubmissions.find((s: any) => 
        String(s.id).toLowerCase() === String(targetId).toLowerCase() || 
        String(s.assignment?.id).toLowerCase() === String(targetId).toLowerCase() ||
        String(s.assignmentId).toLowerCase() === String(targetId).toLowerCase()
      );
      if (targetSub) {
        if (targetSub.assignment?.id) {
          setResolvedTargetAssignmentId(targetSub.assignment.id);
        }
        if (targetSub.assignment?.title) {
          setResolvedTargetTitle(targetSub.assignment.title);
        }
        return;
      }

      // If not in preloaded list, query backend directly to resolve details
      let isCancelled = false;
      (async () => {
        try {
          const fetchedSub = await assignmentService.fetchSubmissionById(targetId, accessToken, activeRole).catch(() => null);
          if (fetchedSub && !isCancelled) {
            if (fetchedSub.assignment?.id) {
              setResolvedTargetAssignmentId(fetchedSub.assignment.id);
            }
            if (fetchedSub.assignment?.title) {
              setResolvedTargetTitle(fetchedSub.assignment.title);
            }
            setPendingSubmissions((prev: any[]) => {
              if (prev.some((s: any) => s.id === fetchedSub.id)) return prev;
              return [fetchedSub, ...prev];
            });
            return;
          }

          const fetchedAssign = await assignmentService.fetchAssignmentById(targetId, accessToken).catch(() => null);
          if (fetchedAssign && !isCancelled) {
            setResolvedTargetAssignmentId(fetchedAssign.id);
            setResolvedTargetTitle(fetchedAssign.title);
          }
        } catch (err) {
          console.error('Failed to resolve target for trainer:', err);
        }
      })();

      return () => {
        isCancelled = true;
      };
    } else {
      lastOpenedIdRef.current = null;
      setResolvedTargetAssignmentId(null);
      setResolvedTargetTitle(null);
    }
  }, [pendingSubmissions, targetId, accessToken, activeRole]);

  // ─── Evaluations Queue Filter Logic ────────────────────────────────────
  const filteredSubs = useMemo(() => {
    return pendingSubmissions.filter((sub: any) => {
      // 1. Strict Target ID filter (from notification or query param)
      if (targetId) {
        const matchesAssignment = 
          String(sub.assignment?.id || '').toLowerCase() === String(targetId).toLowerCase() || 
          String(sub.assignmentId || '').toLowerCase() === String(targetId).toLowerCase() ||
          String((sub as any).assignment_id || '').toLowerCase() === String(targetId).toLowerCase();
        const matchesSubmission = String(sub.id || '').toLowerCase() === String(targetId).toLowerCase();
        if (!matchesAssignment && !matchesSubmission) {
          return false;
        }
      }

      // 2. Search query filter
      if (!searchQuery.trim()) return true;
      const query = searchQuery.toLowerCase();
      const traineeName = `${sub.trainee?.firstName || ''} ${sub.trainee?.lastName || ''}`.toLowerCase();
      const titleMatch = (sub.assignment?.title || '').toLowerCase().includes(query);
      const emailMatch = (sub.trainee?.email || '').toLowerCase().includes(query);
      return traineeName.includes(query) || titleMatch || emailMatch;
    });
  }, [pendingSubmissions, searchQuery, targetId]);

  const activeMode = localFiltersState['evaluationMode'] || undefined;
  const setEvaluationMode = (mode: string | null) => {
    const newFilters = { ...localFiltersState };
    if (!mode || mode === 'all') {
      delete newFilters.evaluationMode;
    } else {
      newFilters.evaluationMode = mode;
    }
    setSearchParams(newFilters);
  };

  // ─── Classification Helpers ──────────────────────────────────────────
  const checkIsApproved = useCallback((s: any) => {
    const st = String(s.status || '').toLowerCase();
    if (st === 'approved' || st === 'passed' || st === 'accepted') return true;
    if (st === 'evaluated') {
      const maxScore = s.assignment?.maxScore || s.totalMaxScore || 100;
      const finalScore = s.score ?? s.totalScore ?? s.aiTotalScore ?? 0;
      return maxScore > 0 ? (finalScore / maxScore) >= 0.35 : finalScore > 0;
    }
    return false;
  }, []);

  const checkIsRejected = useCallback((s: any) => {
    const st = String(s.status || '').toLowerCase();
    if (st === 'rejected' || st === 'needs_improvement' || st === 'failed') return true;
    if (st === 'evaluated') {
      const maxScore = s.assignment?.maxScore || s.totalMaxScore || 100;
      const finalScore = s.score ?? s.totalScore ?? s.aiTotalScore ?? 0;
      return maxScore > 0 ? (finalScore / maxScore) < 0.35 : false;
    }
    return false;
  }, []);

  const checkIsPending = useCallback((s: any) => {
    if (checkIsApproved(s) || checkIsRejected(s)) return false;
    const st = String(s.status || '').toLowerCase();
    return (
      st === 'ai_evaluated_pending_review' ||
      st === 'pending_manual_review' ||
      st === 'submitted' ||
      st === 'pending' ||
      st === 'in_review' ||
      !st ||
      st === 'locked'
    );
  }, [checkIsApproved, checkIsRejected]);

  const checkIsAiEvaluated = useCallback((s: any) => {
    const isAuto = s.evaluationMethod === 'ai_auto';
    const isAssisted = s.evaluationMethod === 'ai_assisted' || s.status === 'ai_evaluated_pending_review';
    const hasAiScore = s.aiTotalScore != null || (s.aiEvaluationResult && s.aiEvaluationResult.totalScore != null);
    return isAuto || isAssisted || hasAiScore;
  }, []);

  const checkIsManualReview = useCallback((s: any) => {
    // 1) AI evaluated but trainer intervention is needed
    if (s.status === 'ai_evaluated_pending_review') return true;
    // 2) Assignment submitted awaiting trainer grading
    if (s.status === 'pending_manual_review' || s.status === 'SUBMITTED' || s.status === 'submitted' || s.status === 'pending') {
      return true;
    }
    // 3) Pure manual review assignments awaiting grading
    if (s.evaluationMethod !== 'ai_auto' && !checkIsApproved(s) && !checkIsRejected(s)) {
      return true;
    }
    return false;
  }, [checkIsApproved, checkIsRejected]);

  // ─── Filtered Sets ───────────────────────────────────────────────────
  const allPending = useMemo(() => {
    return filteredSubs.filter(checkIsPending);
  }, [filteredSubs, checkIsPending]);

  const aiEvaluated = useMemo(() => {
    return filteredSubs.filter(checkIsAiEvaluated);
  }, [filteredSubs, checkIsAiEvaluated]);

  const manualPending = useMemo(() => {
    return filteredSubs.filter(checkIsManualReview);
  }, [filteredSubs, checkIsManualReview]);

  const approvedSubs = useMemo(() => {
    return filteredSubs.filter(checkIsApproved);
  }, [filteredSubs, checkIsApproved]);

  const rejectedSubs = useMemo(() => {
    return filteredSubs.filter(checkIsRejected);
  }, [filteredSubs, checkIsRejected]);

  const currentModeSubs = useMemo(() => {
    if (activeMode === 'ai-assisted') return aiEvaluated;
    if (activeMode === 'manual') return manualPending;
    if (activeMode === 'approved') return approvedSubs;
    if (activeMode === 'rejected') return rejectedSubs;
    return filteredSubs;
  }, [activeMode, aiEvaluated, manualPending, approvedSubs, rejectedSubs, filteredSubs]);

  return (
    <div className="trainer-evaluation-container">
      {/* ── 1. PAGE HEADER ── */}
      <header className="eval-header-row">
        <div className="eval-header-left">
          <h1 className="eval-main-title">Evaluation Queue</h1>
        </div>
      </header>

      {/* ── 3. SEARCH & SUBMODE CONTROLS BAR ── */}
      <section className="eval-controls-bar" aria-label="Controls and filters">
        <div className="eval-submode-pill-row" role="tablist">
          <button
            type="button"
            className={`eval-submode-pill ${!activeMode || activeMode === 'all' ? 'is-active' : ''}`}
            onClick={() => setEvaluationMode('all')}
            role="tab"
            aria-selected={!activeMode || activeMode === 'all'}
          >
            <span>All Task</span>
            <span className="eval-tab-badge-counter">{filteredSubs.length}</span>
          </button>
          <button
            type="button"
            className={`eval-submode-pill ${activeMode === 'ai-assisted' ? 'is-active' : ''}`}
            onClick={() => setEvaluationMode('ai-assisted')}
            role="tab"
            aria-selected={activeMode === 'ai-assisted'}
          >
            <span>AI Evaluated</span>
            <span className="eval-tab-badge-counter badge-ai">{aiEvaluated.length}</span>
          </button>
          <button
            type="button"
            className={`eval-submode-pill ${activeMode === 'manual' ? 'is-active' : ''}`}
            onClick={() => setEvaluationMode('manual')}
            role="tab"
            aria-selected={activeMode === 'manual'}
          >
            <span>Manual Review</span>
            <span className="eval-tab-badge-counter badge-manual">{manualPending.length}</span>
          </button>
          <button
            type="button"
            className={`eval-submode-pill is-approved ${activeMode === 'approved' ? 'is-active' : ''}`}
            onClick={() => setEvaluationMode('approved')}
            role="tab"
            aria-selected={activeMode === 'approved'}
          >
            <span>Approved</span>
            <span className="eval-tab-badge-counter badge-approved">{approvedSubs.length}</span>
          </button>
          <button
            type="button"
            className={`eval-submode-pill is-rejected ${activeMode === 'rejected' ? 'is-active' : ''}`}
            onClick={() => setEvaluationMode('rejected')}
            role="tab"
            aria-selected={activeMode === 'rejected'}
          >
            <span>Rejected</span>
            <span className="eval-tab-badge-counter badge-rejected">{rejectedSubs.length}</span>
          </button>
        </div>

        {/* Right Search Action */}
        <div className="eval-search-and-actions">
          <div className="eval-search-field-wrapper">
            <span className="eval-search-icon">
              <Search size={14} />
            </span>
            <input
              type="text"
              className="eval-search-input"
              placeholder="Search by trainee, email, or task..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              aria-label="Search submissions"
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
        </div>
      </section>

      {/* ── Active Filter Chip (if targeting specific submission from alert) ── */}
      {targetId && (
        <div className="eval-active-chips-strip">
          <div className="eval-chip-tag">
            <span>Viewing: {resolvedTargetTitle || filteredSubs[0]?.assignment?.title || 'Filtered Assignment'}</span>
            <button
              type="button"
              className="eval-chip-remove-btn"
              onClick={clearIdParam}
              title="Show all assignments"
            >
              <X size={13} />
            </button>
          </div>
          <button
            type="button"
            className="eval-chip-clear-all-link"
            onClick={clearIdParam}
          >
            Show all assignments
          </button>
        </div>
      )}

      {/* ═══ EVALUATION QUEUE ═══ */}
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
          ) : currentModeSubs.length === 0 ? (
            /* Empty Queue State */
            <div className="eval-empty-state">
              <div className="eval-empty-icon-box">
                <CheckCircle2 size={28} />
              </div>
              <h3 className="eval-empty-title">All Caught Up!</h3>
              <p className="eval-empty-desc">
                {targetId
                  ? 'No pending submissions found for this specific assignment.'
                  : activeMode === 'approved'
                  ? 'No approved submissions found.'
                  : activeMode === 'rejected'
                  ? 'No rejected submissions found.'
                  : activeMode === 'ai-assisted'
                  ? 'No automated or AI-evaluated submissions found.'
                  : activeMode === 'manual'
                  ? 'No submissions requiring manual review at this time.'
                  : activeMode === 'all'
                  ? 'No submissions found.'
                  : searchQuery
                  ? `No evaluations matching "${searchQuery}".`
                  : 'No submissions found. Great work!'}
              </p>
              {searchQuery || activeMode || targetId ? (
                <button
                  type="button"
                  className="eval-chip-clear-all-link"
                  onClick={() => {
                    setSearchQuery('');
                    setEvaluationMode('all');
                    clearIdParam();
                  }}
                >
                  Show all assignments
                </button>
              ) : null}
            </div>
          ) : (
            /* Render Queue Cards */
            <div className="eval-queue-grid">
              {currentModeSubs.map((sub: any) => {
                const traineeFullName =
                  `${sub.trainee?.firstName || ''} ${sub.trainee?.lastName || ''}`.trim() ||
                  sub.trainee?.email ||
                  'Trainee';
                const taskTitle = sub.assignment?.title || 'Assignment Task';
                const maxScore = sub.assignment?.maxScore || sub.totalMaxScore || 100;
                const subIsApproved = checkIsApproved(sub);
                const subIsRejected = checkIsRejected(sub);
                const awardedScore = sub.score ?? sub.totalScore ?? sub.aiTotalScore;
                const isAiEvaluated = sub.status === 'ai_evaluated_pending_review' || sub.aiTotalScore != null;
                const aiScore = sub.aiEvaluationResult?.totalScore ?? sub.aiTotalScore;
                const isAiNeedsTrainerReview =
                  sub.status === 'ai_evaluated_pending_review' ||
                  sub.evaluationMethod === 'mixed' ||
                  Boolean(sub.requiresManualReview);
                const isAiDone = isAiEvaluated || sub.evaluationMethod === 'ai_auto';

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
                        {subIsApproved ? (
                          <>
                            <span
                              className="eval-badge-pill"
                              style={{
                                background: '#ecfdf5',
                                color: '#047857',
                                border: '1px solid #a7f3d0',
                                fontWeight: 700,
                              }}
                            >
                              <span>✓ Approved {awardedScore != null ? `(${awardedScore}/${maxScore})` : ''}</span>
                            </span>
                            <span className="eval-badge-pill" style={{ background: '#f1f5f9', color: '#475569' }}>
                              {sub.evaluationMethod === 'ai_auto'
                                ? 'AI Auto-Evaluated'
                                : sub.evaluationMethod === 'ai_assisted' || sub.aiTotalScore != null
                                ? 'AI Assisted · Trainer Approved'
                                : 'Trainer Approved'}
                            </span>
                          </>
                        ) : subIsRejected ? (
                          <>
                            <span
                              className="eval-badge-pill"
                              style={{
                                background: '#ffe4e6',
                                color: '#be123c',
                                border: '1px solid #fecdd3',
                                fontWeight: 700,
                              }}
                            >
                              <span>✕ Rejected {awardedScore != null ? `(${awardedScore}/${maxScore})` : ''}</span>
                            </span>
                            <span className="eval-badge-pill" style={{ background: '#f1f5f9', color: '#475569' }}>
                              {sub.evaluationMethod === 'ai_auto'
                                ? 'AI Auto-Evaluated'
                                : sub.evaluationMethod === 'ai_assisted' || sub.aiTotalScore != null
                                ? 'AI Assisted · Trainer Rejected'
                                : 'Trainer Rejected'}
                            </span>
                          </>
                        ) : sub.status === 'ai_evaluated_pending_review' ? (
                          <span
                            className="eval-badge-pill eval-badge-ai"
                            style={{
                              background: '#fef3c7',
                              color: '#b45309',
                              border: '1px solid #fde68a',
                              fontWeight: 700,
                            }}
                          >
                            <span>AI Evaluated · Review Needed {aiScore != null ? `(${aiScore}/${maxScore})` : ''}</span>
                          </span>
                        ) : sub.evaluationMethod === 'ai_auto' || (isAiEvaluated && sub.status !== 'pending_manual_review') ? (
                          <span
                            className="eval-badge-pill eval-badge-ai"
                            style={{
                              background: '#ecfdf5',
                              color: '#047857',
                              border: '1px solid #a7f3d0',
                              fontWeight: 700,
                            }}
                          >
                            <span>AI Auto-Evaluated {aiScore != null ? `(${aiScore}/${maxScore})` : ''}</span>
                          </span>
                        ) : (
                          <span className="eval-badge-pill eval-badge-manual">
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
                            setSelectedSub(fullSub || sub);
                          } catch {
                            setSelectedSub(sub);
                          }
                        }}
                      >
                        {subIsApproved ? (
                          <>
                            <span>View Evaluation</span>
                            <ArrowRight size={14} />
                          </>
                        ) : subIsRejected ? (
                          <>
                            <span>View / Re-evaluate</span>
                            <ArrowRight size={14} />
                          </>
                        ) : isAiDone ? (
                          isAiNeedsTrainerReview ? (
                            <>
                              <span>Review & Confirm</span>
                              <ArrowRight size={14} />
                            </>
                          ) : (
                            <>
                              <span>View Evaluation</span>
                              <ArrowRight size={14} />
                            </>
                          )
                        ) : (
                          <>
                            <span>Grade Submission</span>
                            <ArrowRight size={14} />
                          </>
                        )}
                      </button>
                    </div>
                  </article>
                );
              })}
            </div>
          )}

      {/* ═══ 5. EVALUATION MODAL (SUBMISSION DETAIL VIEW) ═══ */}
      {selectedSub && (
        <SubmissionDetailView
          submission={selectedSub}
          accessToken={accessToken}
          isAdminView={isAdminView}
          onClose={() => {
            setSelectedSub(null);
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