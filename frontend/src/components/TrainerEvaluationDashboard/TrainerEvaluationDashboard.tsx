import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { curriculumService } from '../../services/curriculumService';
import { assignmentService } from '../../services/assignmentService';
import { learningPathService } from '../../services/learningPathService';
import { userService } from '../../services/userService';
import { Plus, CheckCircle, Clock, Search, ExternalLink, X, MessageSquare, Save, Users, AlertCircle, PlayCircle, Eye, Edit2, Archive, Link as LinkIcon, Filter } from 'lucide-react';
import { useNotifications } from '../../context/NotificationContext';
import { useSearch } from '../../context/SearchContext';
import { useSearchParams } from 'react-router-dom';
import { AssignmentsFilterPanel } from '../AssignmentsFilterPanel';
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
  Pending: { bg: '#f8fafc', color: '#475569', border: '#e2e8f0', dot: '#94a3b8' },
  'In Progress': { bg: '#eff6ff', color: '#1d4ed8', border: '#bfdbfe', dot: '#3b82f6' },
  Submitted: { bg: '#fef3c7', color: '#b45309', border: '#fde68a', dot: '#f59e0b' },
  Accepted: { bg: '#dcfce7', color: '#166534', border: '#86efac', dot: '#22c55e' },
  Approved: { bg: '#dcfce7', color: '#166534', border: '#86efac', dot: '#22c55e' },
  Rejected: { bg: '#fee2e2', color: '#b91c1c', border: '#fca5a5', dot: '#ef4444' },
  'Needs Improvement': { bg: '#ffedd5', color: '#c2410c', border: '#fed7aa', dot: '#ea580c' },
};

const formatDuration = (d?: number, h?: number, m?: number) => {
  const parts = [];
  if (d) parts.push(`${d} day${d !== 1 ? 's' : ''}`);
  if (h) parts.push(`${h} hour${h !== 1 ? 's' : ''}`);
  if (m) parts.push(`${m} minute${m !== 1 ? 's' : ''}`);
  return parts.length ? parts.join(' ') : 'No duration';
};

export function TrainerEvaluationDashboard({ accessToken, currentUser, activeSection, activeRole }: TrainerEvaluationDashboardProps) {
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

  // ─── Evaluation (pending submissions) state ───────────────────────────
  const [pendingSubmissions, setPendingSubmissions] = useState<any[]>([]);
  const [isLoadingSubmissions, setIsLoadingSubmissions] = useState(true);
  const [selectedSub, setSelectedSub] = useState<any | null>(null);
  const [evalScore, setEvalScore] = useState<number>(0);
  const [evalFeedback, setEvalFeedback] = useState<string>('');
  const [isEvaluating, setIsEvaluating] = useState(false);

  // ─── Assignments list state ────────────────────────────────────────────
  const [assignments, setAssignments] = useState<any[]>([]);
  const [isLoadingAssignments, setIsLoadingAssignments] = useState(true);
  const [isFilterPanelOpen, setIsFilterPanelOpen] = useState(false);

  // ─── View / Edit Modal State ───────────────────────────────────────────
  const [expandedAssignmentId, setExpandedAssignmentId] = useState<string | null>(null);
  const [editAssignment, setEditAssignment] = useState<any | null>(null);

  // ─── Active main tab ───────────────────────────────────────────────────
  const currentTab = (activeSection === 'Evaluations' || window.location.pathname.includes('/evaluations')) ? 'evaluations' : 'assignments';
  const isAdminView = activeRole?.toLowerCase() === 'admin';

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
  }, [accessToken, activeRole, localFiltersState]);

  useEffect(() => { loadAll(); }, [loadAll]);

  // ─── Filter assignments by active role ────────────────────────────────
  const roleFilteredAssignments = useMemo(() => {
    return assignments;
  }, [assignments]);

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
    let result = roleFilteredAssignments;

    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      result = result.filter((a: any) => {
        const titleMatch = (a.title || '').toLowerCase().includes(query);
        const descMatch = (a.description || a.instructions || '').toLowerCase().includes(query);
        return titleMatch || descMatch;
      });
    }

    const normalize = (v: any) => String(v ?? '').trim().toLowerCase();

    if (Object.keys(localFiltersState).length > 0) {
      result = result.filter(assignment =>
        Object.entries(localFiltersState).every(([category, selectedValuesStr]) => {
          if (category === 'evaluationMode') return true;
          const selectedValues = selectedValuesStr.split(',').map(s => normalize(s));
          if (selectedValues.length === 0) return true;
          
          if (category === 'status') {
            const status = normalize(assignment.status || 'pending');
            if (selectedValues.includes('pending')) {
              if (status !== 'accepted' && status !== 'approved' && status !== 'evaluated' && status !== 'rejected' && status !== 'needs_improvement') return true;
            }
            if (selectedValues.includes('approved') && status === 'evaluated') return true;
            if (selectedValues.includes('needs improvement') && status === 'needs_improvement') return true;
            if (selectedValues.includes('rejected') && status === 'rejected') return true;
            return selectedValues.includes(status);
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
  }, [roleFilteredAssignments, searchQuery, localFiltersState]);

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

  const activeFilterCount = getActiveFilterCount(localFiltersState, ['status', 'evaluationMode']);

  const statusCounts = useMemo(() => {
    const counts: Record<string, number> = { All: roleFilteredAssignments.length, Pending: 0, 'In Progress': 0, Submitted: 0, Approved: 0, Rejected: 0, 'Needs Improvement': 0 };
    roleFilteredAssignments.forEach((a: any) => {
      let st = (a.status || 'Pending').toLowerCase();
      
      if (st === 'accepted' || st === 'approved' || st === 'evaluated') {
        counts['Approved'] = (counts['Approved'] || 0) + 1;
      } else if (st === 'needs_improvement') {
        counts['Needs Improvement'] = (counts['Needs Improvement'] || 0) + 1;
      } else if (st === 'rejected') {
        counts['Rejected'] = (counts['Rejected'] || 0) + 1;
      } else {
        counts['Pending'] = (counts['Pending'] || 0) + 1;
      }
    });
    return counts;
  }, [roleFilteredAssignments]);

  const summaryCards = [
    { title: 'Pending', count: statusCounts['Pending'] || 0, key: 'Pending' },
    { title: 'Needs Improvement', count: statusCounts['Needs Improvement'] || 0, key: 'Needs Improvement' },
    { title: 'Approved', count: statusCounts['Approved'] || 0, key: 'Approved' },
    { title: 'Rejected', count: statusCounts['Rejected'] || 0, key: 'Rejected' },
  ];

  const filteredPendingSubmissions = useMemo(() => {
    return pendingSubmissions;
  }, [pendingSubmissions]);

  // ─── Modal Handlers ──────────────────────────────────────────────
  const handleViewAssignment = (assign: any) => { setExpandedAssignmentId(assign.id); };
  const closeViewEditModals = () => { setExpandedAssignmentId(null); setEditAssignment(null); };

  // ─── Evaluation handlers ───────────────────────────────────────────────
    const handleOpenReview = async (sub: any) => {
    setSelectedSub(sub);
    setEvalScore(sub.aiEvaluationResult?.totalScore ?? (sub.assignment?.maxScore || 100));
    setEvalFeedback(sub.aiEvaluationResult?.overallRemark || '');
    // Opening evaluation decreases trainer bell counter without page reload
    try {
      await assignmentService.openSubmissionForEvaluation(sub.id, accessToken);
      await markRelatedRead('submission', sub.id);
      await refreshNotifications();
    } catch {
      // Non-blocking
    }
  };

  const handleEvaluate = async (status: 'Approved' | 'Rejected') => {
    // This unused handler has been kept for compatibility if called from elsewhere.
    // Real logic is handled in SubmissionDetailView component itself now.
    if (status === 'Rejected' && !evalFeedback.trim()) {
      alert('Feedback is mandatory when rejecting a submission.');
      return;
    }
    setIsEvaluating(true);
    try {
      await curriculumService.evaluateSubmission(
        selectedSub.id,
        { score: evalScore, feedback: evalFeedback, status },
        accessToken
      );
      setSelectedSub(null);
      await loadAll();
      await refreshNotifications();
    } catch (err: any) {
      alert(err.response?.data?.message || err.message || 'Evaluation failed.');
    } finally {
      setIsEvaluating(false);
    }
  };

  const renderParsedSubmission = (sub: any) => {
    const questions = sub.assignment?.mcqConfig?.questions || [];
    const isMcq = sub.assignment?.assignmentType === 'MCQ';
    let parsedAnswers: Record<string, any> = {};
    let isJson = false;
    let rawText = sub.submissionText || '';

    try {
      if (sub.submissionText) {
        const obj = JSON.parse(sub.submissionText);
        if (typeof obj === 'object' && obj !== null) {
          parsedAnswers = { ...obj.answers, ...obj.textAnswers, ...obj.mcqAnswers };
          if (obj.raw) rawText = obj.raw;
          isJson = true;
        }
      }
    } catch { }

    if (!isJson || questions.length === 0) {
      return (
        <div style={{ background: '#f8fafc', padding: '12px', borderRadius: '6px', border: '1px solid #e2e8f0' }}>
          <strong style={{ fontSize: '12px', color: '#475569', display: 'block', marginBottom: '4px' }}>Submitted Solution:</strong>
          <div style={{ fontSize: '13px', color: '#0f172a', whiteSpace: 'pre-wrap' }}>{rawText || 'No answer provided.'}</div>
        </div>
      );
    }

    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
        {questions.map((q: any, idx: number) => {
          const traineeAnswer = parsedAnswers[idx] ?? parsedAnswers[String(idx)] ?? (idx === 0 && rawText ? rawText : null);
          const questionPoints = q.points || q.maxPoints || 10;
          if (isMcq) {
            const traineeChoiceIdx = Number(traineeAnswer);
            const correctChoiceIdx = Number(q.correctIndex);
            const isCorrect = traineeChoiceIdx === correctChoiceIdx;
            return (
              <div key={idx} style={{ padding: '12px', background: isCorrect ? '#f0fdf4' : '#fef2f2', border: `1px solid ${isCorrect ? '#86efac' : '#fca5a5'}`, borderRadius: '6px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <strong style={{ fontSize: '13px', color: '#0f172a' }}>Q{idx + 1}: {q.questionText || q.question}</strong>
                  <span style={{ fontSize: '11px', fontWeight: 700, color: '#475569', background: '#fff', padding: '2px 6px', borderRadius: '4px' }}>{questionPoints} Pts</span>
                </div>
                <div style={{ fontSize: '12px', marginTop: '6px' }}>
                  Trainee Selected: <span style={{ fontWeight: 700, color: isCorrect ? '#15803d' : '#b91c1c' }}>{q.options?.[traineeChoiceIdx] ?? (traineeAnswer !== null ? String(traineeAnswer) : 'No option selected')}</span>
                </div>
                {typeof q.correctIndex === 'number' && (
                  <div style={{ fontSize: '12px', color: '#15803d', fontWeight: 600, marginTop: '2px' }}>
                    ✓ Correct Answer: {q.options?.[correctChoiceIdx] ?? 'N/A'}
                  </div>
                )}
              </div>
            );
          }
          return (
            <div key={idx} style={{ padding: '12px', background: '#fff', border: '1px solid #cbd5e1', borderRadius: '6px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                <strong style={{ fontSize: '13px', color: '#0f172a' }}>Q{idx + 1}: {q.questionText || q.question}</strong>
                <span style={{ fontSize: '11px', fontWeight: 700, color: '#2563eb', background: '#eff6ff', padding: '2px 6px', borderRadius: '4px' }}>Max: {questionPoints} Pts</span>
              </div>
              <div style={{ background: '#f8fafc', padding: '10px 12px', borderRadius: '6px', fontSize: '13px', color: '#1e293b', borderLeft: '3px solid #2563eb', whiteSpace: 'pre-wrap', minHeight: '36px' }}>
                {traineeAnswer ? String(traineeAnswer) : <em style={{ color: '#94a3b8' }}>No answer written.</em>}
              </div>
            </div>
          );
        })}
      </div>
    );
  };

  // ─── Render ─────────────────────────────────────────────────────────────
  return (
    <div style={{ padding: '24px 32px', width: '100%', margin: '0 auto', fontFamily: 'Inter, system-ui, sans-serif' }}>

      {/* ── TOP HEADER ── */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '28px' }}>
        <div>
          <h1 style={{ fontSize: '24px', fontWeight: 800, color: '#0f172a', margin: '0 0 4px 0', letterSpacing: '-0.5px' }}>
            {currentTab === 'evaluations' ? 'Trainee Evaluations' : 'Assignments'}
          </h1>
          <p style={{ margin: 0, color: '#64748b', fontSize: '13px' }}>
            {currentTab === 'evaluations' ? 'Review and grade trainee submissions' : 'Manage, assign, and evaluate trainee tasks'}
          </p>
        </div>
      </div>

      {/* ═══ TAB 1: ASSIGNMENTS ═══ */}
      {currentTab === 'assignments' && (
        <>
          {/* SUMMARY CARDS */}
          <div style={{ display: 'flex', gap: '16px', marginBottom: '24px' }}>
            {summaryCards.map((card) => (
              <div
                key={card.key}
                onClick={() => setStatusFilter(card.key)}
                className={`trainer-metric-card ${statusFilter === card.key ? 'metric-card-active' : ''}`}
              >
                <div style={{ fontSize: '13px', color: '#64748b', fontWeight: 500, display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <span style={{ display: 'inline-block', width: '10px', height: '10px', borderRadius: '50%', background: card.title === 'Approved' ? '#22c55e' : (card.title === 'Submitted' ? '#eab308' : '#cbd5e1') }} />
                  {card.title}
                </div>
                <div style={{ fontSize: '28px', fontWeight: 800, color: '#0f172a', marginTop: '8px' }}>{card.count}</div>
              </div>
            ))}

            {/* "All" Reset Card */}
            <div
              onClick={() => setStatusFilter('All')}
              className={`trainer-metric-card ${statusFilter === 'All' ? 'metric-card-active' : ''}`}
            >
              <div style={{ fontSize: '13px', color: '#64748b', fontWeight: 500 }}>All Assignments</div>
              <div style={{ fontSize: '28px', fontWeight: 800, color: '#0f172a', marginTop: '8px' }}>{roleFilteredAssignments.length}</div>
            </div>
          </div>

          {/* Search and Filters */}
          <div style={{ display: 'flex', gap: '12px', marginBottom: '24px', alignItems: 'stretch' }}>
            <div style={{ flex: 1, position: 'relative', display: 'flex', alignItems: 'center' }}>
              <span style={{ position: 'absolute', left: '14px', top: '50%', transform: 'translateY(-50%)', color: '#64748b', display: 'flex', alignItems: 'center' }}>
                <svg width="18" height="18" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>
              </span>
              <input
                type="text"
                placeholder="Search assignments or tasks..."
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                style={{ 
                  width: '100%', 
                  padding: '12px 16px 12px 40px', 
                  borderRadius: '8px', 
                  border: '1px solid #e2e8f0', 
                  fontSize: '14px', 
                  outline: 'none',
                  boxShadow: '0 1px 2px 0 rgba(0, 0, 0, 0.05)',
                  transition: 'border-color 0.15s ease-in-out, box-shadow 0.15s ease-in-out',
                  color: '#0f172a',
                  backgroundColor: '#fff'
                }}
                onFocus={(e) => { e.target.style.borderColor = '#4f46e5'; e.target.style.boxShadow = '0 0 0 3px rgba(79, 70, 229, 0.1)'; }}
                onBlur={(e) => { e.target.style.borderColor = '#e2e8f0'; e.target.style.boxShadow = '0 1px 2px 0 rgba(0, 0, 0, 0.05)'; }}
              />
            </div>
            <button
              onClick={() => setIsFilterPanelOpen(true)}
              style={{
                display: 'flex', alignItems: 'center', gap: '8px',
                padding: '0 16px', borderRadius: '8px', border: '1px solid #e2e8f0',
                background: '#fff', color: '#334155', fontWeight: 600, fontSize: '14px',
                cursor: 'pointer', transition: 'all 0.15s ease-in-out',
                boxShadow: '0 1px 2px 0 rgba(0, 0, 0, 0.05)'
              }}
              onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#f8fafc'}
              onMouseLeave={(e) => e.currentTarget.style.backgroundColor = '#fff'}
            >
              <Filter size={18} />
              Filters
              {activeFilterCount > 0 && (
                <span style={{
                  background: '#4f46e5', color: '#fff', padding: '2px 8px',
                  borderRadius: '99px', fontSize: '12px', marginLeft: '2px',
                  fontWeight: 700
                }}>
                  {activeFilterCount}
                </span>
              )}
            </button>
          </div>

          <AssignmentsFilterPanel
            isOpen={isFilterPanelOpen}
            onClose={() => setIsFilterPanelOpen(false)}
            categories={[
              {
                id: 'status', label: 'Status', options: [
                  { label: 'Pending Evaluation', value: 'pending' },
                  { label: 'Approved', value: 'approved' },
                  { label: 'Needs Improvement', value: 'needs improvement' },
                  { label: 'Rejected', value: 'rejected' }
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
              }
            ]}
            initialFilters={localFiltersState}
            onApply={(newFilters: Record<string, string>) => setSearchParams(newFilters)}
          />

          {/* Active Filter Chips */}
          {activeFilterCount > 0 && (
            <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', marginBottom: '16px' }}>
              {Object.entries(localFiltersState).map(([key, value]) => {
                if (!value || key === 'status' || key === 'evaluationMode') return null;
                // Map category labels manually since filterCategories is hardcoded in the panel component above
                let categoryLabel = key;
                if (key === 'status') categoryLabel = 'Status';
                if (key === 'type') categoryLabel = 'Type';
                if (key === 'difficulty') categoryLabel = 'Difficulty';
                
                const filterOptions: Record<string, { label: string, value: string }[]> = {
                  difficulty: [
                    { label: 'Basic', value: 'basic' },
                    { label: 'Medium', value: 'medium' },
                    { label: 'Hard', value: 'hard' }
                  ],
                  type: [
                    { label: 'Learning Path', value: 'learning path' },
                    { label: 'External', value: 'external' }
                  ]
                };
                
                return value.split(',').map(v => {
                  const opt = filterOptions[key]?.find(o => String(o.value).toLowerCase() === String(v).toLowerCase().trim());
                  const valLabel = opt ? opt.label : v;
                  return (
                    <div key={`${key}-${v}`} style={{
                      display: 'flex', alignItems: 'center', gap: '6px',
                      padding: '4px 10px', background: '#e0e7ff', color: '#4f46e5',
                      borderRadius: '99px', fontSize: '12px', fontWeight: 600
                    }}>
                      <span>{categoryLabel}: {valLabel}</span>
                      <button 
                        onClick={() => {
                          const currentVals = value.split(',');
                          const newVals = currentVals.filter(val => val !== v);
                          const newFilters = { ...localFiltersState };
                          if (newVals.length > 0) {
                            newFilters[key] = newVals.join(',');
                          } else {
                            delete newFilters[key];
                          }
                          setSearchParams(newFilters);
                        }}
                        style={{ background: 'transparent', border: 'none', color: '#4f46e5', cursor: 'pointer', padding: 0, display: 'flex' }}
                      >
                        <X size={14} />
                      </button>
                    </div>
                  );
                });
              })}
              <button
                onClick={() => setSearchParams({})}
                style={{ background: 'transparent', border: 'none', color: '#64748b', fontSize: '12px', cursor: 'pointer', textDecoration: 'underline' }}
              >
                Clear all
              </button>
            </div>
          )}

          {/* Assignment cards */}
          {isLoadingAssignments ? (
            <div style={{ textAlign: 'center', padding: '40px', color: '#94a3b8' }}>Loading assignments...</div>
          ) : filteredAssignments.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '60px 20px', background: '#fff', borderRadius: '12px', border: '1px solid #e2e8f0' }}>
              <h3 style={{ margin: '0 0 8px 0', fontSize: '18px', color: '#0f172a' }}>
                {localFiltersState.difficulty ? `No assignments available at the ${
                  localFiltersState.difficulty.split(',').map(d => [
                    { label: 'Basic', value: 'basic' },
                    { label: 'Medium', value: 'medium' },
                    { label: 'Hard', value: 'hard' }
                  ].find(o => String(o.value).toLowerCase() === String(d).toLowerCase().trim())?.label || d).join(', ')
                } level.` : 'No assignments match these filters'}
              </h3>
              <p style={{ margin: '0 0 16px 0', color: '#64748b', fontSize: '14px' }}>Try adjusting or clearing your filters to see more assignments.</p>
              <button 
                onClick={() => setSearchParams({})}
                style={{ padding: '8px 16px', background: '#f8fafc', border: '1px solid #cbd5e1', borderRadius: '8px', color: '#0f172a', fontWeight: 600, cursor: 'pointer' }}
              >
                Clear Filters
              </button>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              {filteredAssignments.map((assign: any) => {
                const rawStatus = (assign.status || 'Pending').toLowerCase();
                let displayStatus = 'Pending';
                if (rawStatus === 'accepted' || rawStatus === 'approved') {
                  displayStatus = 'Approved';
                } else if (rawStatus === 'needs_improvement') {
                  displayStatus = 'Needs Improvement';
                } else if (rawStatus === 'rejected') {
                  displayStatus = 'Rejected';
                }

                // If it's pending, let's use the 'Submitted' yellow color as it means pending evaluation
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
                  <div key={assign.id} className="trainer-list-card">

                    {/* LEFT SIDE: Task Details */}
                    <div style={{ padding: '16px 20px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
                          <span style={{ fontWeight: 700, fontSize: '15px', color: '#0f172a' }}>{assign.title}</span>
                          <span style={{ ...pc, padding: '2px 8px', borderRadius: '4px', fontSize: '11px', fontWeight: 700, border: '1px solid' }}>{assign.priority || 'Medium'}</span>
                          <span style={{ ...sc, padding: '2px 8px', borderRadius: '4px', fontSize: '11px', fontWeight: 700, border: '1px solid', display: 'flex', alignItems: 'center', gap: '4px' }}>
                            <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: sc.dot, display: 'inline-block' }} />
                            {displayStatus}
                          </span>
                        </div>
                        <div style={{ fontSize: '12px', color: '#64748b', marginTop: '6px', display: 'flex', gap: '16px', flexWrap: 'wrap' }}>
                          {assign.module?.title && <span>📦 {assign.module.title}</span>}
                          <span>👤 {traineeName}</span>
                          {(assign.durationDays > 0 || assign.durationHours > 0 || assign.durationMinutes > 0) && <span>⏱️ Duration: {formatDuration(assign.durationDays, assign.durationHours, assign.durationMinutes)}</span>}
                        </div>
                      </div>

                      {/* RIGHT SIDE: Scores and Action Buttons */}
                      <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                        {/* Show Score if Evaluated */}
                        {assign.score != null && (
                          <div style={{ fontSize: '13px', fontWeight: 700, color: '#4f46e5', minWidth: '60px', textAlign: 'right' }}>
                            {assign.score}/{assign.maxScore || 100}
                          </div>
                        )}

                        {/* Action Buttons */}
                        <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                          {displayStatus === 'Pending' && assign.latestSubmission && (
                            <button
                              type="button"
                              onClick={async () => {
                                try {
                                  const fullSub = await curriculumService.fetchSubmissionDetails(accessToken, assign.latestSubmission.id);
                                  setSelectedSub(fullSub);
                                } catch (err) {
                                  console.error("Failed to load submission details", err);
                                  setSelectedSub(assign.latestSubmission);
                                }
                              }}
                              className="btn-trainer-action-primary"
                            >
                              Review & Grade
                            </button>
                          )}
                          <button
                            type="button"
                            onClick={() => setExpandedAssignmentId(isExpanded ? null : assign.id)}
                            className={isExpanded ? "btn-trainer-action-primary" : "btn-trainer-action-secondary"}
                          >
                            {isExpanded ? '⯅ Hide Details' : '⯆ View Details'}
                          </button>
                        </div>
                      </div>
                    </div>

                    {/* EXPANDED DETAILS INLINE */}
                    {isExpanded && (
                      <div style={{ borderTop: '1px solid #f1f5f9', padding: '20px', background: '#f8fafc' }}>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>

                          <div style={{ background: '#fff', padding: '12px', borderRadius: '8px', border: '1px solid #e2e8f0', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                            <div style={{ whiteSpace: 'normal', wordBreak: 'break-word' }}>
                              <span style={{ display: 'block', fontSize: '11px', color: '#64748b', fontWeight: 600, textTransform: 'uppercase' }}>Task Path</span>
                              <span style={{ fontSize: '13px', color: '#0f172a', fontWeight: 500 }}>
                                {[
                                  assign.learningPath?.title || assign.module?.learningPath?.title || assign.lesson?.module?.learningPath?.title,
                                  assign.module?.title || assign.lesson?.module?.title,
                                  assign.lesson?.title,
                                ].filter(Boolean).join(' ➔ ') || (assign.learningPath?.title || 'External Task')}
                              </span>
                            </div>
                            <div>
                              <span style={{ display: 'block', fontSize: '11px', color: '#64748b', fontWeight: 600, textTransform: 'uppercase' }}>Submitted By (Latest)</span>
                              <span style={{ fontSize: '13px', color: '#0f172a', fontWeight: 500 }}>
                                {assign.latestSubmission?.trainee ? `${assign.latestSubmission.trainee.firstName} ${assign.latestSubmission.trainee.lastName}`.trim() : 'No submissions yet'}
                              </span>
                            </div>
                            <div>
                              <span style={{ display: 'block', fontSize: '11px', color: '#64748b', fontWeight: 600, textTransform: 'uppercase' }}>Duration</span>
                              <span style={{ fontSize: '13px', color: '#0f172a', fontWeight: 500 }}>
                                {formatDuration(assign.durationDays, assign.durationHours, assign.durationMinutes)} (Anchor: {assign.anchorType === 'LP_ASSIGNED' ? 'When LP is Assigned' : assign.anchorType === 'TASK_UNLOCKED' ? 'When Task is Unlocked' : assign.anchorType})
                              </span>
                            </div>
                            <div>
                              <span style={{ display: 'block', fontSize: '11px', color: '#64748b', fontWeight: 600, textTransform: 'uppercase' }}>Submitted At (Latest)</span>
                              <span style={{ fontSize: '13px', color: '#0f172a', fontWeight: 500 }}>
                                {assign.latestSubmission?.submittedAt ? new Date(assign.latestSubmission.submittedAt).toLocaleString() : 'N/A'}
                              </span>
                            </div>
                            {isAdminView && assign.latestSubmission?.evaluatedBy && (
                              <div>
                                <span style={{ display: 'block', fontSize: '11px', color: '#64748b', fontWeight: 600, textTransform: 'uppercase' }}>Evaluated By</span>
                                <span style={{ fontSize: '13px', color: '#0f172a', fontWeight: 500 }}>
                                  {assign.latestSubmission.evaluatedBy.firstName} {assign.latestSubmission.evaluatedBy.lastName}
                                </span>
                              </div>
                            )}
                            {isAdminView && assign.createdBy && (
                              <div>
                                <span style={{ display: 'block', fontSize: '11px', color: '#64748b', fontWeight: 600, textTransform: 'uppercase' }}>Assigned By</span>
                                <span style={{ fontSize: '13px', color: '#0f172a', fontWeight: 500 }}>
                                  {assign.createdBy.firstName} {assign.createdBy.lastName}
                                </span>
                              </div>
                            )}
                          </div>

                          {assign.instructions && (
                            <div style={{ background: '#f0f9ff', border: '1px solid #bae6fd', borderRadius: '10px', padding: '12px' }}>
                              <div style={{ fontSize: '11px', fontWeight: 700, color: '#0369a1', textTransform: 'uppercase', marginBottom: '4px' }}>Instructions</div>
                              <p style={{ fontSize: '13px', color: '#0c4a6e', margin: 0 }}>{assign.instructions}</p>
                            </div>
                          )}

                          {/* Trainee Answer Rendering */}
                          {assign.latestSubmission ? (
                            <div style={{ marginTop: '10px' }}>
                              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
                                <strong style={{ fontSize: '13px', color: '#0f172a', display: 'block' }}>Latest Trainee Solution Breakdown:</strong>
                                {assign.score != null && (
                                  <span style={{ background: '#dcfce7', color: '#166534', padding: '4px 10px', borderRadius: '6px', fontSize: '12px', fontWeight: 700 }}>Score: {assign.score} / {assign.maxScore}</span>
                                )}
                              </div>
                              {renderParsedSubmission(assign.latestSubmission)}
                            </div>
                          ) : assign.mcqConfig?.questions?.length > 0 ? (
                            <div style={{ background: '#fff', padding: '14px', borderRadius: '10px', border: '1px solid #e2e8f0' }}>
                              <strong style={{ fontSize: '13px', color: '#1e293b', display: 'block', marginBottom: '8px' }}>Assignment Questions:</strong>
                              {assign.mcqConfig.questions.map((q: any, qIdx: number) => (
                                <div key={qIdx} style={{ background: '#f8fafc', padding: '10px 12px', borderRadius: '8px', border: '1px solid #e2e8f0', marginBottom: '8px' }}>
                                  <div style={{ fontSize: '12px', fontWeight: 700, color: '#0f172a' }}>
                                    Q{qIdx + 1}: {q.questionText || q.question} <span style={{ color: '#4f46e5' }}>({q.points || q.maxPoints || 10} pts)</span>
                                  </div>
                                  {q.options?.length > 0 && (
                                    <div style={{ marginTop: '6px', fontSize: '12px', color: '#475569' }}>
                                      Options: {q.options.join(', ')}
                                    </div>
                                  )}
                                </div>
                              ))}
                            </div>
                          ) : (
                            <div style={{ fontSize: '12px', color: '#64748b', fontStyle: 'italic', padding: '10px 0' }}>No questions or submissions yet.</div>
                          )}

                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </>
      )}

      {/* ═══ TAB 2: EVALUATIONS ═══ */}
      {currentTab === 'evaluations' && (
        <>
          <div style={{ marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '10px' }}>
            <span style={{ fontWeight: 700, fontSize: '15px', color: '#0f172a' }}>Pending Trainee Evaluations</span>
            {filteredPendingSubmissions.length > 0 && (
              <span style={{ background: '#fef3c7', color: '#b45309', border: '1px solid #fde68a', borderRadius: '9999px', padding: '2px 10px', fontSize: '12px', fontWeight: 700 }}>
                {filteredPendingSubmissions.length > 5 ? '5+' : filteredPendingSubmissions.length} awaiting review
              </span>
            )}
          </div>

          {isLoadingSubmissions ? (
            <div style={{ textAlign: 'center', padding: '40px', color: '#94a3b8' }}>Loading submissions...</div>
          ) : filteredPendingSubmissions.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '60px', background: '#f8fafc', borderRadius: '12px', border: '2px dashed #e2e8f0' }}>
              <div style={{ fontSize: '32px', marginBottom: '12px' }}>✅</div>
              <div style={{ fontWeight: 700, color: '#475569' }}>All caught up!</div>
              <div style={{ fontSize: '13px', color: '#94a3b8', marginTop: '4px' }}>No pending submissions to evaluate.</div>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
              {(() => {
                const filteredSubs = filteredPendingSubmissions.filter((sub: any) => {
                  if (!searchQuery.trim()) return true;
                  const query = searchQuery.toLowerCase();
                  const traineeName = `${sub.trainee?.firstName || ''} ${sub.trainee?.lastName || ''}`.toLowerCase();
                  const titleMatch = (sub.assignment?.title || '').toLowerCase().includes(query);
                  const emailMatch = (sub.trainee?.email || '').toLowerCase().includes(query);
                  return traineeName.includes(query) || titleMatch || emailMatch;
                });

                if (filteredSubs.length === 0) {
                  return <div style={{ fontSize: '13px', color: '#64748b', padding: '10px' }}>No matches found for "{searchQuery}".</div>;
                }

                const aiEvaluated = filteredSubs.filter((s: any) => s.status === 'ai_evaluated_pending_review' || s.aiTotalScore != null);
                const manualPending = filteredSubs.filter((s: any) => s.status !== 'ai_evaluated_pending_review' && s.aiTotalScore == null);

                const renderSubmissionList = (subs: any[], actionText: string) => (
                  <div className="evaluations-grid">
                    {subs.map((sub: any) => (
                      <div key={sub.id} className="trainer-list-card" style={{ padding: '16px 20px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
                        <div>
                          <div style={{ fontWeight: 700, fontSize: '15px', color: '#0f172a' }} className="text-truncate">
                            👤 {sub.trainee?.firstName} {sub.trainee?.lastName || ''}
                            <span style={{ color: '#64748b', fontSize: '12px', fontWeight: 400, marginLeft: '8px' }}>({sub.trainee?.email})</span>
                          </div>
                          <div style={{ fontSize: '13px', color: '#334155', marginTop: '6px' }}>
                            Submitted: <strong className="text-truncate" style={{ display: 'inline-block', maxWidth: '100%', verticalAlign: 'bottom' }}>"{sub.assignment?.title}"</strong><br/>
                            Max Score: {sub.assignment?.maxScore || 100} pts
                          </div>
                          <div style={{ fontSize: '11px', color: '#94a3b8', marginTop: '4px' }}>
                            {sub.submittedAt ? new Date(sub.submittedAt).toLocaleString() : 'Date unknown'}
                          </div>
                        </div>
                        <div style={{ marginTop: 'auto' }}>
                          <button
                            type="button"
                            onClick={async () => {
                              try {
                                const fullSub = await curriculumService.fetchSubmissionDetails(accessToken, sub.id);
                                setSelectedSub(fullSub);
                              } catch (err) {
                                console.error("Failed to load submission details", err);
                                setSelectedSub(sub);
                              }
                            }}
                            className="btn-trainer-action-primary"
                            style={{ width: '100%', padding: '10px 0' }}
                          >
                            {actionText}
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                );

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
                  <div className="pending-evaluations">
                    <div className="filter-pill-row" role="tablist" aria-label="Filter pending evaluations">
                      <button
                        role="tab"
                        aria-selected={!activeMode}
                        className={`filter-pill ${!activeMode ? 'active' : ''}`}
                        onClick={() => setEvaluationMode(null)}
                      >
                        All ({filteredSubs.length})
                      </button>
                      <button
                        role="tab"
                        aria-selected={activeMode === 'ai-assisted'}
                        className={`filter-pill ${activeMode === 'ai-assisted' ? 'active' : ''}`}
                        onClick={() => setEvaluationMode('ai-assisted')}
                      >
                        AI Evaluated ({aiEvaluated.length})
                      </button>
                      <button
                        role="tab"
                        aria-selected={activeMode === 'manual'}
                        className={`filter-pill ${activeMode === 'manual' ? 'active' : ''}`}
                        onClick={() => setEvaluationMode('manual')}
                      >
                        Direct Evaluation ({manualPending.length})
                      </button>
                    </div>

                    {filteredSubs.length === 0 ? (
                      <div style={{ fontSize: '13px', color: '#64748b', padding: '10px' }}>No matches found for "{searchQuery}".</div>
                    ) : (
                      <>
                        {(!activeMode || activeMode === 'ai-assisted') && (
                          <div style={{ marginBottom: '32px' }}>
                            {aiEvaluated.length > 0 ? (
                              <>
                                <h4 style={{ fontSize: '14px', fontWeight: 700, color: '#3730a3', marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                                  🤖 AI Evaluated (Needs Trainer Review)
                                </h4>
                                {renderSubmissionList(aiEvaluated, 'Review & Grade')}
                              </>
                            ) : (
                              activeMode === 'ai-assisted' && (
                                <div style={{ padding: '24px', background: '#f8fafc', borderRadius: '8px', border: '1px dashed #cbd5e1', textAlign: 'center', color: '#475569', fontSize: '14px' }}>
                                  No AI-evaluated submissions pending review.
                                </div>
                              )
                            )}
                          </div>
                        )}

                        {(!activeMode || activeMode === 'manual') && (
                          <div style={{ marginBottom: '32px' }}>
                            {manualPending.length > 0 ? (
                              <>
                                <h4 style={{ fontSize: '14px', fontWeight: 700, color: '#b45309', marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                                  ✍️ Pending Manual Evaluation
                                </h4>
                                {renderSubmissionList(manualPending, 'Evaluate')}
                              </>
                            ) : (
                              activeMode === 'manual' && (
                                <div style={{ padding: '24px', background: '#f8fafc', borderRadius: '8px', border: '1px dashed #cbd5e1', textAlign: 'center', color: '#475569', fontSize: '14px' }}>
                                  No direct submissions pending evaluation.
                                </div>
                              )
                            )}
                          </div>
                        )}
                        
                        {!activeMode && aiEvaluated.length === 0 && manualPending.length === 0 && (
                          <div style={{ padding: '24px', background: '#f8fafc', borderRadius: '8px', border: '1px dashed #cbd5e1', textAlign: 'center', color: '#475569', fontSize: '14px' }}>
                            All caught up! No pending evaluations.
                          </div>
                        )}
                      </>
                    )}
                  </div>
                );
              })()}
            </div>
          )}
        </>
      )}

      {/* ═══ EVALUATION MODAL ═══ */}
      {selectedSub && (
        <SubmissionDetailView 
          submission={selectedSub}
          accessToken={accessToken}
          isAdminView={isAdminView}
          onClose={() => setSelectedSub(null)}
          onEvaluated={() => {
            setSelectedSub(null);
            loadAll();
            refreshNotifications();
          }}
        />
      )}


    </div>
  );
}