import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { useNavigate, useSearchParams, useParams } from 'react-router-dom';
import { assignmentService } from '../../services/assignmentService';
import { useNotifications } from '../../context/NotificationContext';
import { useToast } from '../../context/ToastContext';
import { useScrollLock } from '../../hooks/useScrollLock';
import { DeadlineDisplay } from '../DeadlineDisplay';
import { AssignmentsFilterPanel } from '../AssignmentsFilterPanel';
import {
  X,
  Search,
  CheckCircle2,
  AlertTriangle,
  AlertCircle,
  Lock,
  Clock,
  Eye,
  Play,
  ExternalLink,
  MessageSquare,
  BookOpen,
  Layers
} from 'lucide-react';
import { SharedAssignmentModal } from '../SharedCards/SharedAssignmentModal';
import './TraineeAssignments.css';

type Props = {
  accessToken: string;
  currentUser?: any;
  activeRole: string;
};

type QuickTabKey = 'all' | 'pending' | 'submitted' | 'approved' | 'revision' | 'overdue';

/**
 * Shimmer Skeleton component displayed during loading
 */
function AssignmentCardSkeleton() {
  return (
    <div className="assignment-skeleton-list">
      {[1, 2, 3, 4, 5].map((idx) => (
        <div key={idx} className="assignment-skeleton-card">
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
              <div className="skeleton-shimmer" style={{ width: 85, height: 20, borderRadius: 999 }} />
              <div className="skeleton-shimmer" style={{ width: 140, height: 18, borderRadius: 6 }} />
            </div>
            <div className="skeleton-shimmer" style={{ width: '75%', height: 22, borderRadius: 6 }} />
          </div>
          <div>
            <div className="skeleton-shimmer" style={{ width: 160, height: 24, borderRadius: 8 }} />
          </div>
          <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', alignItems: 'center' }}>
            <div className="skeleton-shimmer" style={{ width: 90, height: 28, borderRadius: 999 }} />
            <div className="skeleton-shimmer" style={{ width: 95, height: 34, borderRadius: 8 }} />
          </div>
        </div>
      ))}
    </div>
  );
}

/**
 * Safely resolves and formats trainee answers for view details modal.
 * Prevents raw JSON strings from being shown on UI.
 */
function resolveTraineeAnswer(
  q: any,
  idx: number,
  parsedAnswers: any,
  rawText: string,
  submissionAnswers?: any[]
): { selectedVal: any; formattedAnswer: string } {
  const ansObj = parsedAnswers?.answers || (parsedAnswers && !parsedAnswers.textAnswers ? parsedAnswers : {});
  const textAnsObj = parsedAnswers?.textAnswers || {};
  const qId = q?.id != null ? String(q.id) : null;

  let val: any = undefined;

  // 1. Check submission.answers array
  if (Array.isArray(submissionAnswers) && submissionAnswers.length > 0) {
    const match = submissionAnswers.find(
      (item: any) =>
        (qId && String(item.questionId) === qId) ||
        String(item.questionId) === String(idx) ||
        String(item.questionId) === String(idx + 1) ||
        (item.questionIndex !== undefined && (item.questionIndex === idx || item.questionIndex === idx + 1))
    );
    if (match) {
      val = match.answer ?? match.selectedOption ?? match.traineeAnswer;
    }
  }

  // 2. Candidate keys in JSON payload (support 0-index, 1-index, and question ID)
  if (val === undefined || val === null || val === '') {
    const candidateKeys = [
      qId,
      idx,
      String(idx),
      idx + 1,
      String(idx + 1),
    ].filter((k) => k !== null && k !== undefined);

    for (const k of candidateKeys) {
      if (textAnsObj && textAnsObj[k!] !== undefined && textAnsObj[k!] !== null && textAnsObj[k!] !== '') {
        val = textAnsObj[k!];
        break;
      }
    }

    if (val === undefined || val === null || val === '') {
      for (const k of candidateKeys) {
        if (ansObj && ansObj[k!] !== undefined && ansObj[k!] !== null && ansObj[k!] !== '') {
          val = ansObj[k!];
          break;
        }
      }
    }

    if (val === undefined || val === null || val === '') {
      if (parsedAnswers && typeof parsedAnswers === 'object') {
        for (const k of candidateKeys) {
          if (parsedAnswers[k!] !== undefined && parsedAnswers[k!] !== null && parsedAnswers[k!] !== '') {
            val = parsedAnswers[k!];
            break;
          }
        }
      }
    }
  }

  // 3. Fallback to raw text if not JSON
  if (val === undefined || val === null || val === '') {
    if (parsedAnswers?.raw && typeof parsedAnswers.raw === 'string' && !parsedAnswers.raw.trim().startsWith('{')) {
      val = parsedAnswers.raw.trim();
    } else if (rawText && typeof rawText === 'string' && !rawText.trim().startsWith('{')) {
      val = rawText.trim();
    }
  }

  // 4. Format into clean human-readable output
  let formatted = 'No answer provided';
  if (val !== undefined && val !== null && val !== '') {
    if (typeof val === 'number') {
      if (q?.options && Array.isArray(q.options) && q.options[val] !== undefined) {
        const letter = String.fromCharCode(65 + val);
        formatted = `Option ${letter}: ${q.options[val]}`;
      } else {
        const letter = String.fromCharCode(65 + val);
        formatted = `Option ${letter} (Selected index ${val})`;
      }
    } else if (Array.isArray(val)) {
      formatted = val
        .map((item) => {
          if (typeof item === 'number' && q?.options && q.options[item] !== undefined) {
            const letter = String.fromCharCode(65 + item);
            return `Option ${letter}: ${q.options[item]}`;
          }
          return String(item);
        })
        .join(', ');
    } else if (typeof val === 'string') {
      if (val.trim().startsWith('{')) {
        try {
          const inner = JSON.parse(val);
          if (inner.raw && typeof inner.raw === 'string' && !inner.raw.trim().startsWith('{')) {
            formatted = inner.raw.trim();
          } else {
            formatted = 'Answer recorded';
          }
        } catch {
          formatted = 'Answer recorded';
        }
      } else if (/^\d+$/.test(val.trim())) {
        const num = parseInt(val.trim(), 10);
        if (q?.options && Array.isArray(q.options) && q.options[num] !== undefined) {
          const letter = String.fromCharCode(65 + num);
          formatted = `Option ${letter}: ${q.options[num]}`;
        } else {
          formatted = val;
        }
      } else {
        formatted = val;
      }
    } else {
      formatted = String(val);
    }
  }

  return { selectedVal: val, formattedAnswer: formatted };
}

/**
 * Trainee Assignments: shows path-linked + external assignments assigned to the trainee.
 * Submitting increases the trainer's notification bell without a page reload.
 */
export function TraineeAssignmentsView({ accessToken, currentUser, activeRole }: Props) {
  const { refresh: refreshNotifications } = useNotifications();
  const toast = useToast();
  const navigate = useNavigate();
  const { id: routeId } = useParams<{ id?: string }>();
  const [searchParams, setSearchParams] = useSearchParams();
  const [assignments, setAssignments] = useState<any[]>([]);
  const [submissions, setSubmissions] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [isResolvingTarget, setIsResolvingTarget] = useState(false);
  const [isFilterPanelOpen, setIsFilterPanelOpen] = useState(false);
  const [activeQuickTab, setActiveQuickTab] = useState<QuickTabKey>('all');
  const [highlightedCardId, setHighlightedCardId] = useState<string | null>(null);

  // Normalized target ID from route params or search params (id, assignmentId, submissionId, taskId)
  const targetId = useMemo(() => {
    return (
      routeId ||
      searchParams.get('id') ||
      searchParams.get('assignmentId') ||
      searchParams.get('submissionId') ||
      searchParams.get('taskId') ||
      ''
    ).trim();
  }, [routeId, searchParams]);

  const localFiltersState = useMemo(() => {
    const filters: Record<string, string> = {};
    searchParams.forEach((value, key) => {
      filters[key] = value;
    });
    if (targetId && !filters.id) {
      filters.id = targetId;
    }
    return filters;
  }, [searchParams, targetId]);

  const [searchQuery, setSearchQuery] = useState('');
  const [submitTarget, setSubmitTarget] = useState<any | null>(null);
  const [viewDetailsTarget, setViewDetailsTarget] = useState<any | null>(null);
  const lastOpenedIdRef = useRef<string | null>(null);

  const clearIdParam = () => {
    const newParams = new URLSearchParams(searchParams.toString());
    newParams.delete('id');
    newParams.delete('assignmentId');
    newParams.delete('submissionId');
    newParams.delete('taskId');
    if (routeId) {
      navigate('/assignments', { replace: true });
    } else {
      setSearchParams(newParams);
    }
    lastOpenedIdRef.current = null;
    setHighlightedCardId(null);
  };

  useScrollLock(!!submitTarget || !!viewDetailsTarget);

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const [mine, mySubs] = await Promise.all([
        assignmentService.fetchMyAssignments(accessToken, activeRole).catch(() => []),
        assignmentService.fetchMySubmissions(accessToken, activeRole).catch(() => []),
      ]);
      setAssignments(Array.isArray(mine) ? mine : []);
      setSubmissions(Array.isArray(mySubs) ? mySubs : []);
    } finally {
      setLoading(false);
    }
  }, [accessToken, activeRole]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const submissionByAssignment = useMemo(() => new Map(
    submissions.map((s) => [s.assignment?.id || s.assignmentId, s])
  ), [submissions]);

  // Deep target handling via ?id= / :id / ?assignmentId= / ?submissionId=
  useEffect(() => {
    if (!targetId || targetId === lastOpenedIdRef.current) return;
    if (loading) return;

    let isCancelled = false;

    // 1. Check if targetId directly matches an assignment in state
    let targetAssignment = assignments.find(
      (a) => String(a.id).toLowerCase() === targetId.toLowerCase()
    );
    let matchedSub = submissions.find(
      (s) =>
        String(s.id).toLowerCase() === targetId.toLowerCase() ||
        String(s.assignmentId || s.assignment?.id || '').toLowerCase() === targetId.toLowerCase()
    );

    // 2. If not found by assignment ID, check if it matches a submission
    if (!targetAssignment && matchedSub) {
      const foundAssignId = matchedSub.assignmentId || matchedSub.assignment?.id;
      targetAssignment = assignments.find(
        (a) => String(a.id).toLowerCase() === String(foundAssignId).toLowerCase()
      ) || matchedSub.assignment;

      if (targetAssignment && !assignments.some((a) => String(a.id).toLowerCase() === String(targetAssignment!.id).toLowerCase())) {
        setAssignments((prev) => [targetAssignment!, ...prev]);
      }
    }

    if (targetAssignment) {
      lastOpenedIdRef.current = targetId;
      setHighlightedCardId(targetAssignment.id);
      setActiveQuickTab('all');

      setTimeout(() => {
        const el = document.getElementById(`assignment-card-${targetAssignment!.id}`);
        if (el) {
          el.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }
      }, 250);
      return;
    }

    // 3. Fallback: Query backend for assignment or submission if not present in preloaded list
    setIsResolvingTarget(true);
    (async () => {
      try {
        const fetchedAssign = await assignmentService.fetchAssignmentById(targetId, accessToken).catch(() => null);
        if (fetchedAssign && !isCancelled) {
          lastOpenedIdRef.current = targetId;
          // CRITICAL: Inject fetched assignment into assignments state so it is visible in the UI
          setAssignments((prev) => {
            if (prev.some((a) => String(a.id).toLowerCase() === String(fetchedAssign.id).toLowerCase())) return prev;
            return [fetchedAssign, ...prev];
          });
          setHighlightedCardId(fetchedAssign.id);
          setActiveQuickTab('all');

          setTimeout(() => {
            const el = document.getElementById(`assignment-card-${fetchedAssign.id}`);
            if (el) {
              el.scrollIntoView({ behavior: 'smooth', block: 'center' });
            }
          }, 300);
          return;
        }

        const fetchedSub = await assignmentService.fetchSubmissionById(targetId, accessToken, activeRole).catch(() => null);
        if (fetchedSub && !isCancelled) {
          lastOpenedIdRef.current = targetId;
          setSubmissions((prev) => {
            if (prev.some((s) => String(s.id).toLowerCase() === String(fetchedSub.id).toLowerCase())) return prev;
            return [fetchedSub, ...prev];
          });

          const assign = fetchedSub.assignment;
          if (assign) {
            setAssignments((prev) => {
              if (prev.some((a) => String(a.id).toLowerCase() === String(assign.id).toLowerCase())) return prev;
              return [assign, ...prev];
            });
            setHighlightedCardId(assign.id);
            setActiveQuickTab('all');

            setTimeout(() => {
              const el = document.getElementById(`assignment-card-${assign.id}`);
              if (el) {
                el.scrollIntoView({ behavior: 'smooth', block: 'center' });
              }
            }, 300);
          }
        }
      } catch (err) {
        console.error('Failed to resolve deep-linked notification target:', err);
      } finally {
        if (!isCancelled) {
          setIsResolvingTarget(false);
        }
      }
    })();

    return () => {
      isCancelled = true;
    };
  }, [assignments, submissions, loading, targetId, accessToken, activeRole]);

  // Enriched cards computation with robust priority ordering & deadline calculation
  const enrichedAllCards = useMemo(() => {
    return assignments.map(a => {
      const sub = submissionByAssignment.get(a.id);
      let rawStatus = (sub?.status || 'Pending').toUpperCase();

      if (a.isLocked) {
        rawStatus = 'LOCKED';
      }

      const deadlineDate = a.computedDeadline ? new Date(a.computedDeadline) : null;
      const now = new Date();

      let displayStatus = 'Pending';
      let isOverdue = false;
      let priority = 2; // PENDING
      let isBelowCutoff = false;

      const maxScore = a.maxScore || 100;
      const scorePct = typeof sub?.score === 'number' ? (sub.score / maxScore) * 100 : null;
      isBelowCutoff = scorePct !== null && scorePct < 35;

      if (rawStatus === 'LOCKED') {
        displayStatus = 'Locked';
        priority = 6;
      } else if (rawStatus === 'SUBMITTED' || rawStatus === 'AI_EVALUATED_PENDING_REVIEW' || rawStatus === 'PENDING_MANUAL_REVIEW') {
        displayStatus = 'Submitted';
        priority = 3;
      } else if (rawStatus === 'APPROVED' || rawStatus === 'EVALUATED' || rawStatus === 'ACCEPTED' || rawStatus === 'REJECTED' || rawStatus === 'NEEDS_IMPROVEMENT') {
        // Evaluated tasks: Conditionally display 'Need Improvement' status only if assignment score is below 35% (Fail)
        if (isBelowCutoff || (rawStatus === 'REJECTED' && scorePct === null)) {
          displayStatus = 'Need Improvement';
          priority = 1;
        } else {
          displayStatus = 'Approved';
          priority = 4;
        }
        if (deadlineDate && now > deadlineDate) {
          displayStatus = 'Missed/Overdue';
          isOverdue = true;
          priority = 5;
        }
      } else {
        displayStatus = 'Pending';
        priority = 2;
        if (deadlineDate && now > deadlineDate) {
          displayStatus = 'Missed/Overdue';
          isOverdue = true;
          priority = 5;
        }
      }

      const isExpired = sub?.deadline
        ? new Date(sub.deadline).getTime() < now.getTime()
        : (deadlineDate ? now > deadlineDate : false);

      return {
        a,
        sub,
        displayStatus,
        isOverdue,
        isExpired,
        isBelowCutoff,
        priority,
        deadlineDate,
        submittedAt: sub?.submittedAt ? new Date(sub.submittedAt) : null,
        evaluatedAt: sub?.evaluatedAt ? new Date(sub.evaluatedAt) : null,
        rawStatus
      };
    });
  }, [assignments, submissionByAssignment]);

  // Tab count metrics
  const tabCounts = useMemo(() => {
    let pending = 0;
    let submitted = 0;
    let approved = 0;
    let revision = 0;
    let overdue = 0;

    enrichedAllCards.forEach(c => {
      if (c.isOverdue) {
        overdue++;
      } else if (c.displayStatus === 'Pending' && !c.a.isLocked) {
        pending++;
      } else if (c.displayStatus === 'Submitted') {
        submitted++;
      } else if (c.displayStatus === 'Approved') {
        approved++;
      } else if (c.displayStatus === 'Need Improvement') {
        revision++;
      }
    });

    return {
      all: enrichedAllCards.length,
      pending,
      submitted,
      approved,
      revision,
      overdue,
    };
  }, [enrichedAllCards]);

  // Combined filtering: Quick Tab + Search Query + Advanced Filters
  const filteredCards = useMemo(() => {
    // 0. If filtering specifically by notification/assignment ID, return the matching assignment directly
    if (targetId) {
      const idMatch = enrichedAllCards.filter(({ a, sub }) => {
        if (String(a.id).toLowerCase() === targetId.toLowerCase()) return true;
        if (sub && String(sub.id).toLowerCase() === targetId.toLowerCase()) return true;
        if (sub && (String(sub.assignmentId || '').toLowerCase() === targetId.toLowerCase() || String(sub.assignment?.id || '').toLowerCase() === targetId.toLowerCase())) return true;
        return false;
      });
      if (idMatch.length > 0) {
        return idMatch;
      }
    }

    let result = enrichedAllCards;

    // 1. Quick tab filter
    if (activeQuickTab === 'pending') {
      result = result.filter(c => c.displayStatus === 'Pending' && !c.isOverdue && !c.a.isLocked);
    } else if (activeQuickTab === 'submitted') {
      result = result.filter(c => c.displayStatus === 'Submitted');
    } else if (activeQuickTab === 'approved') {
      result = result.filter(c => c.displayStatus === 'Approved');
    } else if (activeQuickTab === 'revision') {
      result = result.filter(c => c.displayStatus === 'Need Improvement');
    } else if (activeQuickTab === 'overdue') {
      result = result.filter(c => c.isOverdue);
    }

    // 2. Search query filter
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      result = result.filter(({ a }) => {
        const titleMatch = (a.title || '').toLowerCase().includes(q);
        const descMatch = (a.description || a.instructions || '').toLowerCase().includes(q);
        const moduleMatch = (a.module?.title || a.lesson?.module?.title || '').toLowerCase().includes(q);
        const lpMatch = (a.learningPath?.title || a.module?.learningPath?.title || '').toLowerCase().includes(q);
        return titleMatch || descMatch || moduleMatch || lpMatch;
      });
    }

    // 3. ID specific filter
    if (targetId) {
      result = result.filter(({ a, sub }) => {
        if (String(a.id).toLowerCase() === targetId.toLowerCase()) return true;
        if (sub && String(sub.id).toLowerCase() === targetId.toLowerCase()) return true;
        if (sub && (String(sub.assignmentId || '').toLowerCase() === targetId.toLowerCase() || String(sub.assignment?.id || '').toLowerCase() === targetId.toLowerCase())) return true;
        return false;
      });
    }

    // 4. Advanced panel filters
    const normalize = (v: any) => String(v ?? '').trim().toLowerCase();

    if (Object.keys(localFiltersState).length > 0) {
      result = result.filter(cardItem =>
        Object.entries(localFiltersState).every(([category, selectedValuesStr]) => {
          if (category === 'evaluationMode' || category === 'id') return true;
          const selectedValues = selectedValuesStr.split(',').map(s => normalize(s));
          if (selectedValues.length === 0) return true;

          if (category === 'status') {
            const currentDisplay = normalize(cardItem.displayStatus);
            if (selectedValues.includes('all')) return true;
            if (selectedValues.includes('pending') && currentDisplay === 'pending') return true;
            if (selectedValues.includes('submitted') && currentDisplay === 'submitted') return true;
            if (selectedValues.includes('approved') && currentDisplay === 'approved') return true;
            if ((selectedValues.includes('need improvement') || selectedValues.includes('needs improvement')) && currentDisplay === 'need improvement') return true;
            if (selectedValues.includes('rejected') && (currentDisplay === 'rejected' || currentDisplay === 'need improvement')) return true;
            return false;
          }
          if (category === 'type') {
            const type = cardItem.a.isExternal ? 'external' : 'learning path';
            return selectedValues.includes(normalize(type));
          }
          if (category === 'difficulty') {
            const diff = normalize(cardItem.a.difficultyLevel || 'basic');
            return selectedValues.includes(diff);
          }
          if (category === 'lockState') {
            const isLocked = !!cardItem.a.isLocked;
            const state = isLocked ? 'locked' : 'unlocked';
            return selectedValues.includes(state);
          }
          return true;
        })
      );
    }

    // 5. Sort by priority
    const sorted = [...result];
    sorted.sort((cardA, cardB) => {
      if (cardA.priority !== cardB.priority) {
        return cardA.priority - cardB.priority;
      }

      if (cardA.priority === 1 || cardA.priority === 2) {
        if (!cardA.deadlineDate && !cardB.deadlineDate) return 0;
        if (!cardA.deadlineDate) return 1;
        if (!cardB.deadlineDate) return -1;
        return cardA.deadlineDate.getTime() - cardB.deadlineDate.getTime();
      }

      if (cardA.priority === 3) {
        if (!cardA.submittedAt && !cardB.submittedAt) return 0;
        if (!cardA.submittedAt) return 1;
        if (!cardB.submittedAt) return -1;
        return cardB.submittedAt.getTime() - cardA.submittedAt.getTime();
      }

      if (cardA.priority === 4) {
        if (!cardA.evaluatedAt && !cardB.evaluatedAt) return 0;
        if (!cardA.evaluatedAt) return 1;
        if (!cardB.evaluatedAt) return -1;
        return cardB.evaluatedAt.getTime() - cardA.evaluatedAt.getTime();
      }

      return 0;
    });

    return sorted;
  }, [enrichedAllCards, activeQuickTab, searchQuery, localFiltersState, targetId]);

  const filterCategories = [
    {
      id: 'status', label: 'Status', options: [
        { label: 'Pending', value: 'pending' },
        { label: 'Submitted', value: 'submitted' },
        { label: 'Approved', value: 'approved' },
        { label: 'Need Improvement', value: 'need improvement' },
      ]
    },
    {
      id: 'type', label: 'Type', options: [
        { label: 'Learning Path', value: 'learning path' },
        { label: 'External', value: 'external' }
      ]
    },
    {
      id: 'difficulty', label: 'Difficulty', options: [
        { label: 'Basic', value: 'basic' },
        { label: 'Medium', value: 'medium' },
        { label: 'Hard', value: 'hard' }
      ]
    },
    {
      id: 'lockState', label: 'Lock State', options: [
        { label: 'Locked', value: 'locked' },
        { label: 'Unlocked', value: 'unlocked' }
      ]
    }
  ];

  const getActiveFilterCount = (filters: Record<string, string>) => {
    return Object.entries(filters).reduce((count, [key, value]) => {
      if (key === 'evaluationMode') return count;
      if (typeof value === 'string') {
        return count + value.split(',').filter(Boolean).length;
      }
      if (typeof value === 'boolean') {
        return count + (value ? 1 : 0);
      }
      return count;
    }, 0);
  };

  const activeFilterCount = getActiveFilterCount(localFiltersState);

  // Return Shimmer Skeleton while loading data
  if (loading) {
    return (
      <div className="trainee-assignments-container">
        <div className="assignments-page-header">
          <div className="assignments-page-title-wrap">
            <div className="assignments-page-title-row">
              <h1 className="assignments-page-title">Assignments</h1>
              <span className="assignments-total-badge">Loading...</span>
            </div>
            <p className="assignments-page-subtitle">
              Fetching your coursework and assigned tasks...
            </p>
          </div>
        </div>
        <div style={{ display: 'flex', gap: 12, marginBottom: 20 }}>
          <div className="skeleton-shimmer" style={{ flex: 1, height: 44, borderRadius: 10 }} />
          <div className="skeleton-shimmer" style={{ width: 110, height: 44, borderRadius: 10 }} />
        </div>
        <AssignmentCardSkeleton />
      </div>
    );
  }

  return (
    <div className="trainee-assignments-container">
      {/* Executive Header */}
      <div className="assignments-page-header">
        <div className="assignments-page-title-wrap">
            <h1 className="assignments-page-title">Assignments</h1>
          <div className="assignments-page-title-row">
            {/* <span className="assignments-total-badge">
              <Layers size={13} />
              {assignments.length} total tasks
            </span> */}
          </div>
          {/* <p className="assignments-page-subtitle">
            Track, complete, and review submissions for curriculum modules and external projects.
          </p> */}
        </div>
      </div>

      {/* Quick Status Segmented Filter Tabs */}
      <div className="assignments-status-tabs" role="tablist">
        <button
          type="button"
          className={`status-tab-btn ${activeQuickTab === 'all' ? 'active' : ''}`}
          onClick={() => setActiveQuickTab('all')}
        >
          <span>All Tasks</span>
          <span className="status-tab-badge">{tabCounts.all}</span>
        </button>

        <button
          type="button"
          className={`status-tab-btn tab-pending ${activeQuickTab === 'pending' ? 'active' : ''}`}
          onClick={() => setActiveQuickTab('pending')}
        >
          <span>Pending</span>
          <span className="status-tab-badge">{tabCounts.pending}</span>
        </button>

        <button
          type="button"
          className={`status-tab-btn tab-submitted ${activeQuickTab === 'submitted' ? 'active' : ''}`}
          onClick={() => setActiveQuickTab('submitted')}
        >
          <span>Submitted</span>
          <span className="status-tab-badge">{tabCounts.submitted}</span>
        </button>

        <button
          type="button"
          className={`status-tab-btn tab-evaluated ${activeQuickTab === 'approved' ? 'active' : ''}`}
          onClick={() => setActiveQuickTab('approved')}
        >
          <span>Evaluated</span>
          <span className="status-tab-badge">{tabCounts.approved}</span>
        </button>

        {tabCounts.revision > 0 && (
          <button
            type="button"
            className={`status-tab-btn tab-urgent ${activeQuickTab === 'revision' ? 'active' : ''}`}
            onClick={() => setActiveQuickTab('revision')}
          >
            <span>Need Improvement</span>
            <span className="status-tab-badge" style={{ background: '#ffedd5', color: '#c2410c' }}>
              {tabCounts.revision}
            </span>
          </button>
        )}

        {tabCounts.overdue > 0 && (
          <button
            type="button"
            className={`status-tab-btn tab-urgent ${activeQuickTab === 'overdue' ? 'active' : ''}`}
            onClick={() => setActiveQuickTab('overdue')}
          >
            <span>Overdue</span>
            <span className="status-tab-badge" style={{ background: '#fef2f2', color: '#dc2626' }}>
              {tabCounts.overdue}
            </span>
          </button>
        )}
      </div>

      {/* Search & Advanced Filters Toolbar */}
      <div className="assignments-toolbar">
        <div className="search-input-wrapper">
          <span className="search-icon-left">
            <Search size={18} />
          </span>
          <input
            type="text"
            className="search-input-field"
            placeholder="Search assignments by title, module, or topic..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
          {searchQuery && (
            <button
              type="button"
              className="search-clear-btn"
              onClick={() => setSearchQuery('')}
              title="Clear search"
            >
              <X size={12} />
            </button>
          )}
        </div>
      </div>

      {/* Advanced Filter Panel Drawer / Modal */}
      <AssignmentsFilterPanel
        isOpen={isFilterPanelOpen}
        onClose={() => setIsFilterPanelOpen(false)}
        categories={filterCategories}
        initialFilters={localFiltersState}
        onApply={(newFilters) => setSearchParams(newFilters)}
      />

      {/* Active Filter Chips */}
      {activeFilterCount > 0 && (
        <div className="active-filters-chips-row">
          {Object.entries(localFiltersState).map(([key, value]) => {
            if (!value || key === 'evaluationMode') return null;

            if (key === 'id') {
              const targetAssign = assignments.find((a) => String(a.id).toLowerCase() === String(value).toLowerCase());
              let title = targetAssign?.title;
              if (!title) {
                const targetSub = submissions.find(
                  (s) =>
                    String(s.id).toLowerCase() === String(value).toLowerCase() ||
                    String(s.assignmentId || s.assignment?.id || '').toLowerCase() === String(value).toLowerCase()
                );
                title = targetSub?.assignment?.title || 'Specific Assignment';
              }
              return (
                <div key={`id-${value}`} className="filter-chip-item">
                  <span>Viewing: {title}</span>
                  <button
                    type="button"
                    className="filter-chip-remove"
                    onClick={clearIdParam}
                  >
                    <X size={14} />
                  </button>
                </div>
              );
            }

            const category = filterCategories.find((c) => c.id === key);
            const label = category ? category.label : key;
            return value.split(',').map((v) => {
              const opt = category?.options.find(
                (o) => String(o.value).toLowerCase() === String(v).toLowerCase()
              );
              const valLabel = opt ? opt.label : v;
              return (
                <div key={`${key}-${v}`} className="filter-chip-item">
                  <span>
                    {label}: {valLabel}
                  </span>
                  <button
                    type="button"
                    className="filter-chip-remove"
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
                    <X size={14} />
                  </button>
                </div>
              );
            });
          })}
          <button
            type="button"
            className="filter-clear-all-link"
            onClick={() => setSearchParams({})}
          >
            Clear all filters
          </button>
        </div>
      )}

      {/* Empty State */}
      {filteredCards.length === 0 && (
        <div className="assignments-empty-state">
          <div className="assignments-empty-icon">
            <BookOpen size={26} />
          </div>
          <h3 className="assignments-empty-title">
            {searchQuery
              ? `No assignments found matching "${searchQuery}"`
              : activeQuickTab !== 'all'
                ? `No assignments in "${activeQuickTab}" category`
                : 'No assignments found'}
          </h3>
          <p className="assignments-empty-desc">
            {searchQuery || activeFilterCount > 0
              ? 'Try adjusting your search terms or clearing applied filters to see more tasks.'
              : 'You have no coursework assignments assigned in this view yet.'}
          </p>
          {(searchQuery || activeFilterCount > 0 || activeQuickTab !== 'all') && (
            <button
              type="button"
              className="btn-assignment-view-details"
              onClick={() => {
                setSearchQuery('');
                setActiveQuickTab('all');
                setSearchParams({});
              }}
            >
              Reset All Filters
            </button>
          )}
        </div>
      )}

      {isResolvingTarget && (
        <div style={{ marginBottom: 20 }}>
          <AssignmentCardSkeleton />
        </div>
      )}

      {/* Assignment Card List */}
      <div className="assignment-cards-list">
        {filteredCards.map(({ a, sub, displayStatus, isOverdue, isExpired, isBelowCutoff, submittedAt, rawStatus }) => {
          const isExternal =
            String(a.assignmentType || '').toLowerCase() === 'external' ||
            (!a.lesson && !a.module && !a.learningPath);

          const maxPoints = a.maxScore || 100;
          const scoreText = typeof sub?.score === 'number' ? `${sub.score}/${maxPoints} pts` : null;

          let badgeBg = '#f1f5f9';
          let badgeColor = '#475569';
          let badgeBorder = '#e2e8f0';
          let badgeLabel = displayStatus;

          if (displayStatus === 'Approved') {
            badgeBg = '#ecfdf5';
            badgeColor = '#065f46';
            badgeBorder = '#a7f3d0';
            badgeLabel = 'Approved';
          } else if (displayStatus === 'Need Improvement') {
            badgeBg = '#fff7ed';
            badgeColor = '#c2410c';
            badgeBorder = '#fed7aa';
            badgeLabel = 'Need Improvement';
          } else if (displayStatus === 'Submitted') {
            badgeBg = '#fefce8';
            badgeColor = '#854d0e';
            badgeBorder = '#fef08a';
            badgeLabel = 'Submitted';
          } else if (displayStatus === 'Missed/Overdue') {
            badgeBg = '#fef2f2';
            badgeColor = '#991b1b';
            badgeBorder = '#fecaca';
            badgeLabel = 'Overdue';
          } else if (displayStatus === 'Locked') {
            badgeBg = '#f8fafc';
            badgeColor = '#64748b';
            badgeBorder = '#e2e8f0';
            badgeLabel = 'Locked';
          }

          const showDeadline = displayStatus !== 'Locked';
          const isLockedByLessons = displayStatus === 'Locked' && (a.dependsOnLessonIds?.length > 0 || a.lockUntilLessonsComplete);
          const subtypeLabel = a.module?.title || a.lesson?.module?.title || 'Module task';
          // Strictly show Resubmit only if assignment score is below 35% (Fail)
          const isResubmit = displayStatus === 'Need Improvement';

          const handleRowClick = () => {
            if (displayStatus === 'Locked') {
              const pathId = a.learningPath?.id || a.learningPathId || a.module?.learningPath?.id || a.module?.learningPathId || a.lesson?.module?.learningPath?.id || a.lesson?.module?.learningPathId;
              const moduleId = a.module?.id || a.moduleId || a.lesson?.module?.id || a.lesson?.moduleId;
              if (moduleId) {
                if (pathId) {
                  navigate(`/learning-paths/${pathId}/modules/${moduleId}`, { state: { activeTab: 'Tasks' } });
                } else {
                  navigate(`/modules/${moduleId}`, { state: { activeTab: 'Tasks' } });
                }
              } else if (pathId) {
                navigate(`/modules`, { state: { pathId, pathName: a.learningPath?.title || 'Learning Path', activeTab: 'Tasks' } });
              }
            }
          };

          // Compute status CSS modifier for left accent border
          const statusModifier = (() => {
            if (displayStatus === 'Locked') return 'status-locked';
            if (isOverdue) return 'status-overdue';
            if (displayStatus === 'Need Improvement') return 'status-revision';
            if (displayStatus === 'Submitted') return 'status-submitted';
            if (displayStatus === 'Approved') return 'status-approved';
            return 'status-pending';
          })();

          const isTargeted =
            highlightedCardId === a.id ||
            Boolean(
              targetId && (
                String(a.id).toLowerCase() === targetId.toLowerCase() ||
                (sub && (
                  String(sub.id).toLowerCase() === targetId.toLowerCase() ||
                  String(sub.assignmentId || sub.assignment?.id || '').toLowerCase() === targetId.toLowerCase()
                ))
              )
            );

          return (
            <div
              key={a.id}
              id={`assignment-card-${a.id}`}
              className={`trainee-assignment-row ${statusModifier} ${isTargeted ? 'is-targeted-assignment' : ''}`}
              title={displayStatus === 'Locked' ? a.lockReason || 'Locked task. Click to view prerequisite lessons.' : undefined}
              onClick={handleRowClick}
            >
              {/* ── TOP ROW: meta + title (left), status badge (right) ── */}
              <div className="assignment-card-top">
                <div className="assignment-card-info">
                  <div className="assignment-meta-tags">
                    <span className={`source-badge-tag ${isExternal ? 'external' : 'lp'}`}>
                      {isExternal ? 'External' : (a.learningPath?.title || a.module?.learningPath?.title || a.lesson?.module?.learningPath?.title || 'Learning Path')}
                    </span>
                    <span className="assignment-subtype-label">
                      <span>{a.assignmentType || 'Subjective'}</span>
                      <span>•</span>
                      <span>{subtypeLabel}</span>
                    </span>
                  </div>

                  <h3 className="assignment-title-text">{a.title}</h3>
                </div>

                {/* Status Badge — top right corner */}
                <div className="assignment-card-status-badge">
                  <span
                    className="status-badge-pill"
                    style={{
                      background: badgeBg,
                      color: badgeColor,
                      border: `1px solid ${badgeBorder}`,
                    }}
                  >
                    {badgeLabel}
                    {scoreText && (displayStatus === 'Approved' || displayStatus === 'Need Improvement') ? (
                      <span className="badge-score-text">· {scoreText}</span>
                    ) : null}
                  </span>
                </div>
              </div>

              {/* ── MIDDLE: Feedback callout (conditional) ── */}
              {displayStatus === 'Need Improvement' && sub?.feedback && (
                <div className="assignment-feedback-callout revision">
                  <AlertCircle size={14} className="feedback-callout-icon" />
                  <div className="feedback-callout-content">
                    <strong>Feedback:</strong> {sub.feedback}
                  </div>
                </div>
              )}

              {/* ── BOTTOM FOOTER: deadline (left), actions (right) ── */}
              <div className="assignment-card-footer">
                {/* Deadline / prerequisite info */}
                <div className="assignment-card-deadline">
                  {isLockedByLessons ? (
                    <span className="lock-prerequisite-pill">
                      <Lock size={12} />
                      <span>Unlocks after prerequisite lessons</span>
                    </span>
                  ) : showDeadline && (sub || a.computedDeadline) ? (
                    <DeadlineDisplay task={a} submission={sub} />
                  ) : displayStatus === 'Submitted' && submittedAt ? (
                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, color: '#b45309', fontWeight: 600, fontSize: '12px' }}>
                      <CheckCircle2 size={13} />
                      <span>Submitted {submittedAt.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}</span>
                    </span>
                  ) : null}

                  {a.externalUrl && displayStatus !== 'Locked' && (
                    <a
                      href={a.externalUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="external-resource-link"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <span>Open resource</span>
                      <ExternalLink size={11} />
                    </a>
                  )}
                </div>

                {/* Action buttons */}
                <div className="assignment-card-actions" onClick={(e) => e.stopPropagation()}>
                  {/* View Details Button */}
                  {(displayStatus === 'Approved' || displayStatus === 'Need Improvement' || rawStatus === 'EVALUATED') && sub && (
                    <button
                      type="button"
                      className="btn-assignment-view-details"
                      onClick={() => setViewDetailsTarget({ assignment: a, submission: sub })}
                    >
                      <Eye size={13} />
                      <span>View Details</span>
                    </button>
                  )}

                  {/* Start Assignment Button */}
                  {!isExpired && !isOverdue && displayStatus !== 'Locked' && displayStatus !== 'Approved' && displayStatus !== 'Need Improvement' && displayStatus !== 'Submitted' && rawStatus === 'AVAILABLE' && a.anchorType === 'TASK_START' && (
                    <button
                      type="button"
                      className="btn-assignment-start"
                      onClick={async () => {
                        if (!window.confirm('Start this assignment now? The deadline countdown will begin immediately.')) return;
                        try {
                          await assignmentService.startAssignment(a.id, accessToken);
                          await loadData();
                        } catch (err: any) {
                          toast.error(err?.response?.data?.message || err.message || 'Could not start assignment');
                        }
                      }}
                    >
                      <Play size={12} />
                      <span>Start Assignment</span>
                    </button>
                  )}

                  {/* Submit / Resubmit Button */}
                  {!isExpired && !isOverdue && displayStatus !== 'Locked' && displayStatus !== 'Approved' && displayStatus !== 'Submitted' && (rawStatus !== 'AVAILABLE' || a.anchorType !== 'TASK_START') && (
                    <button
                      type="button"
                      className={isResubmit ? 'btn-assignment-resubmit' : 'btn-assignment-submit'}
                      onClick={() => setSubmitTarget(a)}
                    >
                      <span>{isResubmit ? 'Resubmit' : 'Submit'}</span>
                    </button>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Task Submission / Answering Modal */}
      {submitTarget && (
        <SharedAssignmentModal
          task={submitTarget}
          submission={submissionByAssignment.get(submitTarget.id)}
          accessToken={accessToken}
          onClose={() => {
            setSubmitTarget(null);
            clearIdParam();
          }}
          onSuccess={() => {
            loadData();
            refreshNotifications();
            clearIdParam();
          }}
        />
      )}

      {/* View Details & Evaluation Modal */}
      {viewDetailsTarget && (() => {
        const { assignment, submission } = viewDetailsTarget;
        const assignerName = assignment.createdBy?.firstName
          ? `${assignment.createdBy.firstName} ${assignment.createdBy.lastName || ''}`.trim()
          : assignment.createdBy?.name || 'Trainer';

        const evaluatorName = submission.evaluatedBy?.firstName
          ? `${submission.evaluatedBy.firstName} ${submission.evaluatedBy.lastName || ''}`.trim()
          : submission.evaluatedBy?.name || 'Trainer';

        const maxPoints = assignment.maxScore || 100;
        const gainedPoints = submission.score || 0;
        const scorePercentage = Math.round((gainedPoints / maxPoints) * 100);

        let questions = assignment.questions?.length > 0 ? assignment.questions : (assignment.mcqConfig?.questions || []);
        const isMcq = assignment.assignmentType === 'MCQ';

        // Single-question MCQ fallback
        if (questions.length === 0 && isMcq && assignment.mcqConfig?.options) {
          questions = [{
            questionText: assignment.instruction || assignment.title || 'Question',
            options: assignment.mcqConfig.options,
            points: assignment.maxScore || 100,
          }];
        }

        let parsedAnswers: any = {};
        const rawText = submission.submissionText || '';
        try {
          if (rawText.trim().startsWith('{')) {
            parsedAnswers = JSON.parse(rawText);
          }
        } catch (e) { }

        return (
          <div
            className="eval-modal-overlay"
            onClick={() => {
              setViewDetailsTarget(null);
              clearIdParam();
            }}
          >
            <div className="eval-modal-container" onClick={(e) => e.stopPropagation()}>
              {/* Header */}
              <div className="eval-modal-header">
                <div className="eval-modal-header-info">
                  <h3 className="eval-modal-title">Evaluation Details</h3>
                  <div className="eval-modal-subtitle">
                    <span>{assignment.title}</span>
                    <span className="eval-score-pill">
                      Score: {gainedPoints} / {maxPoints} pts ({scorePercentage}%)
                    </span>
                  </div>
                </div>
                <button
                  type="button"
                  className="eval-modal-close-btn"
                  onClick={() => {
                    setViewDetailsTarget(null);
                    clearIdParam();
                  }}
                  title="Close evaluation details"
                >
                  <X size={18} />
                </button>
              </div>

              {/* Body */}
              <div className="eval-modal-body">
                {/* Evaluator & Assigner Meta */}
                <div className="eval-meta-grid">
                  <div>
                    <div className="eval-meta-item-label">Assigned By</div>
                    <div className="eval-meta-item-val">{assignerName}</div>
                  </div>
                  <div>
                    <div className="eval-meta-item-label">Evaluated By</div>
                    <div className="eval-meta-item-val">{evaluatorName}</div>
                  </div>
                </div>

                {/* Trainer Feedback Callout */}
                {submission.feedback && (
                  <div className="eval-trainer-feedback-card">
                    <div className="eval-feedback-header">
                      <MessageSquare size={14} />
                      <span>Trainer Feedback</span>
                    </div>
                    <p className="eval-feedback-content">{submission.feedback}</p>
                  </div>
                )}

                {/* Questions & Responses */}
                <h4 style={{ margin: '0 0 14px', fontSize: 15, fontWeight: 700, color: '#0f172a' }}>
                  Questions & Answers ({questions.length || 1})
                </h4>

                {questions.length > 0 ? (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                    {questions.map((q: any, idx: number) => {
                      const { selectedVal, formattedAnswer } = resolveTraineeAnswer(
                        q,
                        idx,
                        parsedAnswers,
                        rawText,
                        submission.answers
                      );

                      const qPoints = q.maxPoints || q.points || 10;
                      const qText = (q.questionText || q.text || q.question || '').replace(/\\n/g, '\n').replace(/\n$/, '').trim();
                      const isThisMcq = isMcq || (q.type || q.questionType || '').toUpperCase() === 'MCQ' || (q.options && q.options.length > 0);

                      return (
                        <div key={idx} className="eval-question-card">
                          <div className="eval-question-header">
                            <h5 className="eval-question-title">
                              Q{idx + 1}: {qText}
                            </h5>
                            <span className="eval-question-points">{qPoints} pts</span>
                          </div>

                          {isThisMcq && q.options && q.options.length > 0 ? (
                            <div className="eval-mcq-options-list">
                              <span style={{ fontSize: 11, fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                                Options & Review:
                              </span>
                              {q.options.map((opt: string, optIdx: number) => {
                                const isSelected = Array.isArray(selectedVal)
                                  ? selectedVal.includes(optIdx) || selectedVal.map(String).includes(String(optIdx))
                                  : selectedVal === optIdx || String(selectedVal) === String(optIdx);
                                const isCorrect = Array.isArray(q.correctIndex)
                                  ? q.correctIndex.includes(optIdx)
                                  : q.correctIndex === optIdx;

                                let rowBg = '#f8fafc';
                                let rowBorder = '1px solid #e2e8f0';
                                let icon = '○';
                                let textColor = '#334155';

                                if (isSelected && isCorrect) {
                                  rowBg = '#f0fdf4';
                                  rowBorder = '1px solid #22c55e';
                                  icon = '✓';
                                  textColor = '#166534';
                                } else if (isSelected && !isCorrect) {
                                  rowBg = '#fef2f2';
                                  rowBorder = '1px solid #ef4444';
                                  icon = '✗';
                                  textColor = '#991b1b';
                                } else if (!isSelected && isCorrect) {
                                  rowBg = '#f0fdf4';
                                  rowBorder = '1px dashed #22c55e';
                                  icon = '✓';
                                  textColor = '#166534';
                                }

                                return (
                                  <div
                                    key={optIdx}
                                    className="eval-mcq-option-row"
                                    style={{
                                      background: rowBg,
                                      border: rowBorder,
                                      color: textColor,
                                      fontWeight: isSelected || isCorrect ? 600 : 400,
                                    }}
                                  >
                                    <span style={{ fontSize: 14, fontWeight: 800 }}>{icon}</span>
                                    <span>{opt}</span>
                                  </div>
                                );
                              })}
                            </div>
                          ) : (
                            <div className="eval-answer-block">
                              <span style={{ fontWeight: 700, color: '#64748b', display: 'block', marginBottom: 6, fontSize: 11, textTransform: 'uppercase' }}>
                                Your Answer:
                              </span>
                              <div style={{ whiteSpace: 'pre-wrap', lineHeight: 1.6, color: '#0f172a', fontSize: '13.5px' }}>
                                {formattedAnswer}
                              </div>
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <div className="eval-answer-block">
                    <span style={{ fontWeight: 700, color: '#64748b', display: 'block', marginBottom: 6, fontSize: 11, textTransform: 'uppercase' }}>
                      Your Submission:
                    </span>
                    <div style={{ whiteSpace: 'pre-wrap', lineHeight: 1.6, color: '#0f172a', fontSize: '13.5px' }}>
                      {(() => {
                        const { formattedAnswer } = resolveTraineeAnswer(null, 0, parsedAnswers, rawText, submission.answers);
                        return formattedAnswer;
                      })()}
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        );
      })()}
    </div>
  );
}
