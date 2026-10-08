import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { createPortal } from 'react-dom';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { assignmentService } from '../../services/assignmentService';
import { useNotifications } from '../../context/NotificationContext';
import { useToast } from '../../context/ToastContext';
import { useScrollLock } from '../../hooks/useScrollLock';
import { DeadlineDisplay } from '../DeadlineDisplay';
import { AssignmentsFilterPanel } from '../AssignmentsFilterPanel';
import { Filter, X } from 'lucide-react';
import { RichText } from '../common/RichText';
import { renderMultilineText } from '../../utils/textUtils';
import { SharedAssignmentModal } from '../SharedCards/SharedAssignmentModal';
import './TraineeAssignments.css';
type Props = {
  accessToken: string;
  currentUser?: any;
  activeRole: string;
};

/**
 * Trainee Assignments: shows path-linked + external assignments assigned to the trainee.
 * Submitting increases the trainer's notification bell without a page reload.
 */
export function TraineeAssignmentsView({ accessToken, currentUser, activeRole }: Props) {
  const { refresh: refreshNotifications } = useNotifications();
  const toast = useToast();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const [assignments, setAssignments] = useState<any[]>([]);
  const [submissions, setSubmissions] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [isFilterPanelOpen, setIsFilterPanelOpen] = useState(false);
  
  const localFiltersState = useMemo(() => {
    const filters: Record<string, string> = {};
    searchParams.forEach((value, key) => {
      filters[key] = value;
    });
    return filters;
  }, [searchParams]);

  const [searchQuery, setSearchQuery] = useState('');
  const [submitTarget, setSubmitTarget] = useState<any | null>(null);
  const [viewDetailsTarget, setViewDetailsTarget] = useState<any | null>(null);
  const lastOpenedIdRef = useRef<string | null>(null);
  
  
  
  const [instructionsOpen, setInstructionsOpen] = useState(true);

  const clearIdParam = () => {
    const newParams = new URLSearchParams(searchParams.toString());
    newParams.delete('id');
    setSearchParams(newParams);
    lastOpenedIdRef.current = null;
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
  }, [accessToken, activeRole, localFiltersState]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const submissionByAssignment = useMemo(() => new Map(
    submissions.map((s) => [s.assignment?.id || s.assignmentId, s])
  ), [submissions]);

  useEffect(() => {
    const idToOpen = searchParams.get('id');
    if (idToOpen && idToOpen !== lastOpenedIdRef.current && assignments.length > 0) {
      const targetAssignment = assignments.find(a => a.id === idToOpen);
      if (targetAssignment) {
        lastOpenedIdRef.current = idToOpen;
        const sub = submissionByAssignment.get(targetAssignment.id);
        const status = sub?.status;
        const rawStatus = String(status || 'AVAILABLE').toUpperCase();
        
        if (rawStatus === 'EVALUATED' || rawStatus === 'APPROVED' || rawStatus === 'REJECTED' || rawStatus === 'NEEDS_IMPROVEMENT') {
           setViewDetailsTarget({ assignment: targetAssignment, submission: sub });
        } else {
           setSubmitTarget(targetAssignment);
        }
      }
    }
  }, [assignments, searchParams, submissionByAssignment]);

  const filtered = React.useMemo(() => {
    let result = assignments;
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      result = result.filter(a => {
        const titleMatch = (a.title || '').toLowerCase().includes(q);
        const descMatch = (a.description || a.instructions || '').toLowerCase().includes(q);
        return titleMatch || descMatch;
      });
    }

    if (localFiltersState.id) {
      // It could be an assignment ID or a submission ID. Check both.
      result = result.filter(a => {
        if (a.id === localFiltersState.id) return true;
        const sub = submissionByAssignment.get(a.id);
        if (sub && sub.id === localFiltersState.id) return true;
        return false;
      });
    }

    // Apply filters from localFiltersState
    const normalize = (v: any) => String(v ?? '').trim().toLowerCase();

    if (Object.keys(localFiltersState).length > 0) {
      result = result.filter(assignment =>
        Object.entries(localFiltersState).every(([category, selectedValuesStr]) => {
          if (category === 'evaluationMode') return true; // Handled separately
          const selectedValues = selectedValuesStr.split(',').map(s => normalize(s));
          if (selectedValues.length === 0) return true;
          
          if (category === 'status') {
            const sub = submissionByAssignment.get(assignment.id);
            let status = normalize(sub?.status || 'pending');
            if (assignment.isLocked) status = 'locked';
            
            if (selectedValues.includes('pending')) {
              if (status !== 'submitted' && status !== 'approved' && status !== 'evaluated' && status !== 'rejected' && status !== 'ai_evaluated_pending_review' && status !== 'pending_manual_review' && status !== 'needs_improvement') {
                return true;
              }
            }
            if (selectedValues.includes('submitted')) {
              if (status === 'ai_evaluated_pending_review' || status === 'pending_manual_review') return true;
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
            const diff = normalize(assignment.difficultyLevel || 'basic');
            return selectedValues.includes(diff);
          }
          if (category === 'lockState') {
            const isLocked = !!assignment.isLocked;
            const state = isLocked ? 'locked' : 'unlocked';
            return selectedValues.includes(state);
          }
          return true;
        })
      );
    }
    return result;
  }, [assignments, searchQuery, localFiltersState, submissionByAssignment]);

  const filterCategories = [
    {
      id: 'status', label: 'Status', options: [
        { label: 'Pending', value: 'pending' },
        { label: 'Submitted', value: 'submitted' },
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
    },
    {
      id: 'lockState', label: 'Lock State', options: [
        { label: 'Locked', value: 'locked' },
        { label: 'Unlocked', value: 'unlocked' }
      ]
    }
  ];

    if (loading) {
    return <div style={{ padding: 24, color: '#64748b' }}>Loading your assignments...</div>;
  }

  const getActiveFilterCount = (filters: Record<string, string>) => {
    return Object.entries(filters).reduce((count, [key, value]) => {
      if (key === 'evaluationMode') return count; // Handled outside the filter panel
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

  return (
    <div style={{ width: '100%' }}>
      <div style={{ marginBottom: 20 }}>
        <h1 style={{ margin: 0, fontSize: 22, fontWeight: 800, color: '#0f172a' }}>Assignments</h1>
        <p style={{ margin: '6px 0 0', color: '#64748b', fontSize: 13 }}>
          {filtered.length} tasks — Learning Path tasks and External assignments are listed separately.
        </p>
      </div>

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
        categories={filterCategories}
        initialFilters={localFiltersState}
        onApply={(newFilters) => setSearchParams(newFilters)}
      />

      {/* Active Filter Chips */}
      {activeFilterCount > 0 && (
        <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', marginBottom: '16px' }}>
          {Object.entries(localFiltersState).map(([key, value]) => {
            if (!value || key === 'evaluationMode') return null;
            
            if (key === 'id') {
              const targetAssign = assignments.find(a => a.id === value);
              let title = targetAssign?.title;
              if (!title) {
                const targetSub = submissions.find(s => s.id === value);
                title = targetSub?.assignment?.title || 'Specific Assignment';
              }
              return (
                <div key={`id-${value}`} style={{
                  display: 'flex', alignItems: 'center', gap: '6px',
                  padding: '4px 10px', background: '#e0e7ff', color: '#4f46e5',
                  borderRadius: '99px', fontSize: '12px', fontWeight: 600
                }}>
                  <span>Viewing: {title}</span>
                  <button 
                    onClick={() => {
                      const newFilters = { ...localFiltersState };
                      delete newFilters.id;
                      setSearchParams(newFilters);
                    }}
                    style={{ background: 'transparent', border: 'none', color: '#4f46e5', cursor: 'pointer', padding: 0, display: 'flex' }}
                  >
                    <X size={14} />
                  </button>
                </div>
              );
            }

            const category = filterCategories.find(c => c.id === key);
            const label = category ? category.label : key;
            return value.split(',').map(v => {
              const opt = category?.options.find(o => String(o.value).toLowerCase() === String(v).toLowerCase());
              const valLabel = opt ? opt.label : v;
              return (
                <div key={`${key}-${v}`} style={{
                  display: 'flex', alignItems: 'center', gap: '6px',
                  padding: '4px 10px', background: '#e0e7ff', color: '#4f46e5',
                  borderRadius: '99px', fontSize: '12px', fontWeight: 600
                }}>
                  <span>{label}: {valLabel}</span>
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

      {/* Empty State */}
      {filtered.length === 0 && !loading && (
        <div style={{ textAlign: 'center', padding: '60px 20px', background: '#fff', borderRadius: '12px', border: '1px solid #e2e8f0' }}>
          <h3 style={{ margin: '0 0 8px 0', fontSize: '18px', color: '#0f172a' }}>
            {localFiltersState.difficulty ? `No assignments available at the ${
              localFiltersState.difficulty.split(',').map(d => filterCategories.find(c => c.id === 'difficulty')?.options.find(o => String(o.value).toLowerCase() === String(d).toLowerCase().trim())?.label || d).join(', ')
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
      )}

      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        {(() => {
          const getCardData = (a: any) => {
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
            
            if (rawStatus === 'LOCKED') {
              displayStatus = 'Locked';
              priority = 6;
            } else if (rawStatus === 'APPROVED' || rawStatus === 'EVALUATED') {
              const maxScore = a.maxScore || 100;
              isBelowCutoff = (typeof sub?.score === 'number') && (sub.score / maxScore) * 100 < 35;
              
              if (isBelowCutoff) {
                displayStatus = 'Approved'; // Remains "Approved" but styled differently
                priority = 1;
                if (deadlineDate && now > deadlineDate) {
                  displayStatus = 'Missed/Overdue';
                  isOverdue = true;
                  priority = 5;
                }
              } else {
                displayStatus = 'Approved';
                priority = 4;
              }
            } else if (rawStatus === 'NEEDS_IMPROVEMENT') {
              displayStatus = 'Needs Improvement';
              priority = 1;
              if (deadlineDate && now > deadlineDate) {
                displayStatus = 'Missed/Overdue';
                isOverdue = true;
                priority = 5;
              }
            } else if (rawStatus === 'REJECTED') {
              displayStatus = 'Rejected';
              priority = 1;
              if (deadlineDate && now > deadlineDate) {
                displayStatus = 'Missed/Overdue';
                isOverdue = true;
                priority = 5;
              }
            } else if (rawStatus === 'SUBMITTED') {
              displayStatus = 'Submitted';
              priority = 3;
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
          };

          const enrichedCards = filtered.map(getCardData);
          
          enrichedCards.sort((cardA, cardB) => {
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

          return enrichedCards.map(({ a, sub, displayStatus, isOverdue, isExpired, isBelowCutoff, deadlineDate, submittedAt, rawStatus }) => {
            const isExternal =
              String(a.assignmentType || '').toLowerCase() === 'external' ||
              (!a.lesson && !a.module && !a.learningPath);

            let bg = '#f1f5f9';
            let color = '#475569';
            if (displayStatus === 'Approved') {
              if (isBelowCutoff) { bg = '#ffedd5'; color = '#c2410c'; } // Orange
              else { bg = '#dcfce7'; color = '#166534'; } // Green
            }
            else if (displayStatus === 'Needs Improvement') { bg = '#ffedd5'; color = '#c2410c'; }
            else if (displayStatus === 'Rejected') { bg = '#fee2e2'; color = '#b91c1c'; }
            else if (displayStatus === 'Submitted') { bg = '#fef3c7'; color = '#b45309'; }
            else if (displayStatus === 'Missed/Overdue') { bg = '#fecaca'; color = '#991b1b'; }

            const showDeadline = displayStatus !== 'Locked';
            // Locked with prerequisite lessons → show lock message in center
            const isLockedByLessons = displayStatus === 'Locked' && (a.dependsOnLessonIds?.length > 0 || a.lockUntilLessonsComplete);
            // Subtitle tag
            const subtypeLabel = a.module?.title || a.lesson?.module?.title || 'Module task';

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

              return (
                <div
                  key={a.id}
                  className="hover-card-anim"
                  title={displayStatus === 'Locked' ? a.lockReason || 'Locked task. Click to view prerequisites.' : ''}
                  onClick={handleRowClick}
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  gap: 16,
                  padding: '14px 18px',
                  border: displayStatus === 'Locked' ? '1px solid #e2e8f0' : '1px solid #e2e8f0',
                  borderRadius: 12,
                  background: displayStatus === 'Locked' ? '#f8fafc' : '#fff',
                  opacity: displayStatus === 'Locked' ? 0.75 : 1,
                  transition: 'transform 0.2s, box-shadow 0.15s',
                  cursor: displayStatus === 'Locked' ? 'pointer' : 'default',
                  flexWrap: 'wrap', // Allow wrapping on small screens
                }}
              >
                {/* LEFT: Assignment title + type tags */}
                <div style={{ flex: '1 1 240px', minWidth: 240 }}>
                  <div style={{ display: 'flex', gap: 6, alignItems: 'center', marginBottom: 4, flexWrap: 'wrap' }}>
                    <span
                      style={{
                        fontSize: 10,
                        fontWeight: 700,
                        padding: '2px 8px',
                        borderRadius: 999,
                        background: isExternal ? '#ede9fe' : '#e0f2fe',
                        color: isExternal ? '#6d28d9' : '#0369a1',
                        whiteSpace: 'nowrap',
                      }}
                    >
                      {isExternal ? 'External' : (a.learningPath?.title || a.module?.learningPath?.title || a.lesson?.module?.learningPath?.title || 'Learning Path')}
                    </span>
                    <span style={{ fontSize: 11, color: '#94a3b8' }}>{a.assignmentType || 'Subjective'} · {subtypeLabel}</span>
                  </div>
                  <strong style={{ display: 'block', fontSize: 14, color: '#0f172a', wordBreak: 'break-word' }}>
                    {a.title}
                  </strong>

                  {/* Rejection reason (below title on left) */}
                  {displayStatus === 'Rejected' && sub?.feedback && (
                    <span style={{ fontSize: 11, color: '#b91c1c', marginTop: 3, display: 'block' }}>Reason: {sub.feedback}</span>
                  )}
                  {displayStatus === 'Needs Improvement' && sub?.feedback && (
                    <span style={{ fontSize: 11, color: '#c2410c', marginTop: 3, display: 'block' }}>Feedback: {sub.feedback}</span>
                  )}
                </div>

                {/* CENTER: Deadline / countdown OR lock message */}
                <div style={{ flex: '0 0 240px', display: 'flex', alignItems: 'center', justifyContent: 'flex-start', fontSize: 12, color: '#64748b', gap: 6, flexWrap: 'wrap' }}>
                  {isLockedByLessons ? (
                    <span style={{ display: 'flex', alignItems: 'center', gap: 5, color: '#94a3b8' }}>
                      <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>
                      Unlocks after prerequisite lessons
                    </span>
                  ) : showDeadline && (sub || a.computedDeadline) ? (
                    <DeadlineDisplay task={a} submission={sub} />
                  ) : displayStatus === 'Submitted' && submittedAt ? (
                    <span style={{ color: '#b45309' }}>Submitted {submittedAt.toLocaleDateString()}</span>
                  ) : null}

                  {a.externalUrl && displayStatus !== 'Locked' && (
                    <a href={a.externalUrl} target="_blank" rel="noreferrer" style={{ color: '#4f46e5', marginLeft: 8 }}>
                      Open resource
                    </a>
                  )}
                </div>

                {/* RIGHT: Status badge + action buttons */}
                <div style={{ flex: '0 0 240px', display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: 10, flexWrap: 'wrap' }}>
                  <span
                    style={{
                      fontSize: 11,
                      fontWeight: 700,
                      padding: '4px 10px',
                      borderRadius: 999,
                      background: bg,
                      color: color,
                      whiteSpace: 'nowrap',
                      letterSpacing: '0.02em',
                    }}
                  >
                    {displayStatus === 'Approved' ? 'Approved' : displayStatus === 'Rejected' ? 'REJECTED' : displayStatus === 'Needs Improvement' ? 'Needs Improvement' : displayStatus}
                    {typeof sub?.score === 'number' && (displayStatus === 'Approved' || displayStatus === 'Needs Improvement' || displayStatus === 'Rejected') ? ` · ${sub.score}` : ''}
                  </span>

                  {(displayStatus === 'Approved' || displayStatus === 'Needs Improvement' || displayStatus === 'Rejected' || rawStatus === 'EVALUATED') && sub && (
                    <button
                      type="button"
                      onClick={() => setViewDetailsTarget({ assignment: a, submission: sub })}
                      style={{
                        padding: '7px 13px',
                        borderRadius: 8,
                        border: '1px solid #e2e8f0',
                        background: '#fff',
                        color: '#0f172a',
                        fontWeight: 600,
                        fontSize: 12,
                        cursor: 'pointer',
                      }}
                    >
                      View Details
                    </button>
                  )}

                  {/* Submit / Resubmit / Start button */}
                  {!isExpired && !isOverdue && displayStatus !== 'Locked' && (displayStatus !== 'Approved' || isBelowCutoff) && displayStatus !== 'Submitted' && (
                    <>
                      {rawStatus === 'AVAILABLE' && a.anchorType === 'TASK_START' ? (
                        <button
                          type="button"
                          onClick={async () => {
                            if (!window.confirm('Start this assignment now? The deadline countdown will begin immediately.')) return;
                            try {
                              await assignmentService.startAssignment(a.id, accessToken);
                              await loadData();
                            } catch (err: any) {
                              toast.error(err?.response?.data?.message || err.message || 'Could not start assignment');
                            }
                          }}
                          style={{
                            padding: '8px 14px',
                            borderRadius: 8,
                            border: 'none',
                            background: '#16a34a',
                            color: '#fff',
                            fontWeight: 700,
                            fontSize: 12,
                            cursor: 'pointer',
                          }}
                        >
                          Start Assignment
                        </button>
                      ) : (
                        <button
                          type="button"
                          onClick={() => {
                            setSubmitTarget(a);

                            let prefilledMcq = {};
                            let prefilledSubj = {};
                            let prefilledText = '';
                            const sub = submissionByAssignment.get(a.id);
                            if (sub?.submissionText) {
                              try {
                                prefilledText = sub.submissionText;
                                if (sub.submissionText.startsWith('{')) {
                                  const parsed = JSON.parse(sub.submissionText);
                                  prefilledMcq = parsed.answers || {};
                                  prefilledSubj = parsed.textAnswers || {};
                                }
                              } catch(e) {}
                            }

                            
                            
                            
                            
                          }}
                          style={{
                            padding: '8px 16px',
                            borderRadius: 8,
                            border: 'none',
                            background: (displayStatus === 'Needs Improvement' || displayStatus === 'Rejected' || isBelowCutoff) ? '#7c3aed' : '#4f46e5',
                            color: '#fff',
                            fontWeight: 700,
                            fontSize: 12,
                            cursor: 'pointer',
                            boxShadow: '0 1px 4px rgba(79,70,229,0.3)',
                          }}
                        >
                          {displayStatus === 'Needs Improvement' || displayStatus === 'Rejected' || isBelowCutoff ? 'Resubmit' : 'Submit'}
                        </button>
                      )}
                    </>
                  )}
                </div>
              </div>
            );
          });
        })()}

        {filtered.length === 0 && (
          <div style={{ padding: 24, color: '#94a3b8', textAlign: 'center', border: '1px dashed #e2e8f0', borderRadius: 12 }}>
            No assignments in this category yet.
          </div>
        )}
      </div>

            {submitTarget && (
        <SharedAssignmentModal
          task={submitTarget}
          submission={submissionByAssignment.get(submitTarget.id)}
          accessToken={accessToken}
          onClose={() => { setSubmitTarget(null); clearIdParam(); }}
          onSuccess={() => {
              loadData();
              refreshNotifications();
              clearIdParam();
          }}
        />
      )}

      {/* View Details Modal for Approved Assignments */}
      {viewDetailsTarget && (() => {
        const { assignment, submission } = viewDetailsTarget;
        const traineeName = currentUser?.firstName 
          ? `${currentUser.firstName} ${currentUser.lastName || ''}`.trim()
          : currentUser?.name || 'Trainee';
          
        const assignerName = assignment.createdBy?.firstName
          ? `${assignment.createdBy.firstName} ${assignment.createdBy.lastName || ''}`.trim()
          : assignment.createdBy?.name || 'Trainer';
          
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
            points: assignment.maxScore || 100
          }];
        }

        let parsedAnswers: any = {};
        const rawText = submission.submissionText || '';
        try {
          if (rawText.trim().startsWith('{')) {
            parsedAnswers = JSON.parse(rawText);
          }
        } catch(e) {}

        return (
          <div style={{ position: 'fixed', inset: 0, background: 'rgba(15,23,42,0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, backdropFilter: 'blur(4px)' }}>
            <div style={{ background: '#fff', width: '700px', borderRadius: '20px', maxHeight: '92vh', display: 'flex', flexDirection: 'column', boxShadow: '0 25px 80px rgba(0,0,0,0.22)' }}>
              
              <div style={{ padding: '22px 26px', borderBottom: '1px solid #f1f5f9', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexShrink: 0 }}>
                <div>
                  <h3 style={{ margin: 0, fontSize: '17px', fontWeight: 800, color: '#0f172a' }}>📄 Evaluation Details: {assignment.title}</h3>
                  <p style={{ margin: '4px 0 0', fontSize: '12px', color: '#64748b' }}>Score: {gainedPoints} / {maxPoints} pts</p>
                </div>
                <button onClick={() => { setViewDetailsTarget(null); clearIdParam(); }} style={{ background: '#f1f5f9', border: 'none', borderRadius: '8px', width: '32px', height: '32px', cursor: 'pointer', fontSize: '18px', color: '#64748b', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>×</button>
              </div>

              <div style={{ padding: '22px 26px', overflowY: 'auto', flex: 1 }}>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '16px', marginBottom: '24px', background: '#f8fafc', padding: '16px', borderRadius: '12px', border: '1px solid #e2e8f0' }}>
                  <div>
                    <div style={{ fontSize: '11px', color: '#64748b', fontWeight: 600, textTransform: 'uppercase' }}>Assigned By</div>
                    <div style={{ fontSize: '14px', color: '#0f172a', fontWeight: 500, marginTop: '4px' }}>{assignerName}</div>
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
                        const optIdx = ansObj[idx];
                        userAnswer = typeof optIdx === 'number' && q.options ? q.options[optIdx] : 'No answer provided';
                      } else {
                        const extractedAns = textAnsObj[idx] || ansObj[idx] || parsedAnswers[idx];
                        userAnswer = (extractedAns && typeof extractedAns === 'string') ? extractedAns : (parsedAnswers.raw ? parsedAnswers.raw : rawText) || 'No answer provided';
                      }
                      
                      const qPoints = q.maxPoints || q.points || 10;
                      const qText = (q.questionText || q.text || q.question || '').replace(/\\n/g, '\n').replace(/\n$/, '').trim();
                      const isThisMcq = isMcq || (q.type || q.questionType || '').toUpperCase() === 'MCQ';

                      return (
                        <div key={idx} style={{ border: '1px solid #e2e8f0', borderRadius: '12px', padding: '16px' }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '12px' }}>
                            <strong style={{ fontSize: '13px', color: '#0f172a', lineHeight: 1.5, whiteSpace: 'pre-wrap' }}>Q{idx + 1}: {qText}</strong>
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
                        {parsedAnswers.raw ? parsedAnswers.raw : 
                         (rawText.trim().startsWith('{') ? 'JSON Submission (See parsed answers)' : rawText)}
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
