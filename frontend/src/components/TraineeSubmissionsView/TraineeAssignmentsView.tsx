import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { assignmentService } from '../../services/assignmentService';
import { useNotifications } from '../../context/NotificationContext';
import { DeadlineDisplay } from '../DeadlineDisplay';
import { AssignmentsFilterPanel } from '../AssignmentsFilterPanel';
import { Filter, X } from 'lucide-react';

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
  const [submissionText, setSubmissionText] = useState('');
  const [selectedMcqAnswers, setSelectedMcqAnswers] = useState<Record<number, number>>({});
  const [subjectiveAnswers, setSubjectiveAnswers] = useState<Record<number, string>>({});
  const [attachmentUrl, setAttachmentUrl] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const [mine, mySubs] = await Promise.all([
        assignmentService.fetchMyAssignments(accessToken, activeRole, localFiltersState).catch(() => []),
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

  const submissionByAssignment = new Map(
    submissions.map((s) => [s.assignment?.id || s.assignmentId, s]),
  );

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
    return result;
  }, [assignments, searchQuery]);

  const filterCategories = [
    {
      id: 'status', label: 'Status', options: [
        { label: 'Pending', value: 'pending' },
        { label: 'Submitted', value: 'submitted' },
        { label: 'Approved', value: 'approved' },
        { label: 'Needs Improvement', value: 'needs improvement' }
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

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!submitTarget || !submissionText.trim()) {
      alert('Please enter your submission.');
      return;
    }
    setIsSubmitting(true);
    try {
      await assignmentService.submitAssignment(
        submitTarget.id,
        { submissionText, attachmentUrl: attachmentUrl || undefined },
        accessToken,
      );
      setSubmitTarget(null);
      setSubmissionText('');
      setAttachmentUrl('');
      await loadData();
      await refreshNotifications();
      alert('Submitted for evaluation. Your trainer has been notified.');
    } catch (err: any) {
      alert(err?.response?.data?.message || err.message || 'Submission failed.');
    } finally {
      setIsSubmitting(false);
    }
  };

  if (loading) {
    return <div style={{ padding: 24, color: '#64748b' }}>Loading your assignments...</div>;
  }

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
          {Object.keys(localFiltersState).length > 0 && (
            <span style={{
              background: '#4f46e5', color: '#fff', padding: '2px 8px',
              borderRadius: '99px', fontSize: '12px', marginLeft: '2px',
              fontWeight: 700
            }}>
              {Object.keys(localFiltersState).length}
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
      {Object.keys(localFiltersState).length > 0 && (
        <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', marginBottom: '16px' }}>
          {Object.entries(localFiltersState).map(([key, value]) => {
            if (!value) return null;
            const category = filterCategories.find(c => c.id === key);
            const label = category ? category.label : key;
            return value.split(',').map(v => {
              const opt = category?.options.find(o => o.value === v);
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
          <h3 style={{ margin: '0 0 8px 0', fontSize: '18px', color: '#0f172a' }}>No assignments match these filters</h3>
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
            } else if (rawStatus === 'REJECTED') {
              displayStatus = 'Needs Improvement';
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
            
            return {
              a,
              sub,
              displayStatus,
              isOverdue,
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

          return enrichedCards.map(({ a, sub, displayStatus, isOverdue, isBelowCutoff, deadlineDate, submittedAt, rawStatus }) => {
            const isExternal =
              String(a.assignmentType || '').toLowerCase() === 'external' ||
              (!a.lesson && !a.module && !a.learningPath);

            let bg = '#f1f5f9';
            let color = '#475569';
            if (displayStatus === 'Approved') {
              if (isBelowCutoff) { bg = '#ffedd5'; color = '#c2410c'; } // Orange
              else { bg = '#dcfce7'; color = '#166534'; } // Green
            }
            else if (displayStatus === 'Needs Improvement') { bg = '#fee2e2'; color = '#b91c1c'; }
            else if (displayStatus === 'Submitted') { bg = '#fef3c7'; color = '#b45309'; }
            else if (displayStatus === 'Missed/Overdue') { bg = '#fecaca'; color = '#991b1b'; }

            const showDeadline = displayStatus !== 'Locked' || a.anchorType === 'LP_ASSIGNED';

            return (
              <div
                key={a.id}
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  gap: 12,
                  padding: '14px 16px',
                  border: '1px solid #e2e8f0',
                  borderRadius: 12,
                  background: displayStatus === 'Locked' ? '#f8fafc' : '#fff',
                  opacity: displayStatus === 'Locked' ? 0.7 : 1
                }}
              >
                <div style={{ minWidth: 0 }}>
                  <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 4 }}>
                    <span
                      style={{
                        fontSize: 10,
                        fontWeight: 700,
                        padding: '2px 8px',
                        borderRadius: 999,
                        background: isExternal ? '#ede9fe' : '#e0f2fe',
                        color: isExternal ? '#6d28d9' : '#0369a1',
                      }}
                    >
                      {isExternal ? 'External' : (a.learningPath?.title || a.module?.learningPath?.title || a.lesson?.module?.learningPath?.title || 'Learning Path')}
                    </span>
                    <span style={{ fontSize: 11, color: '#94a3b8' }}>{a.assignmentType || 'Task'}</span>
                  </div>
                  <strong style={{ display: 'block', fontSize: 14, color: '#0f172a' }}>
                    {displayStatus === 'Locked' ? '🔒 ' : ''}{a.title}
                  </strong>
                  <div style={{ fontSize: 12, color: '#64748b', marginTop: 4, display: 'flex', flexDirection: 'column', gap: 4 }}>
                    {showDeadline && (
                      <DeadlineDisplay task={a} submission={sub} />
                    )}
                    
                    {displayStatus === 'Submitted' && submittedAt && (
                      <span style={{ color: '#b45309' }}>Submitted on {submittedAt.toLocaleString()}</span>
                    )}

                    {displayStatus === 'Submitted' && (
                      <span style={{ color: '#475569', fontWeight: 500 }}>
                        Assigned by: {a.assignedBy ? (`${a.assignedBy.firstName || ''} ${a.assignedBy.lastName || ''}`.trim() || a.assignedBy.email) : 'Trainer'}
                      </span>
                    )}

                    {displayStatus === 'Needs Improvement' && sub?.feedback && (
                      <span style={{ color: '#b91c1c' }}>Feedback: {sub.feedback}</span>
                    )}

                    {a.externalUrl && displayStatus !== 'Locked' && (
                      <span>
                        <a href={a.externalUrl} target="_blank" rel="noreferrer" style={{ color: '#4f46e5' }}>
                          Open resource
                        </a>
                      </span>
                    )}
                  </div>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexShrink: 0 }}>
                  <span
                    style={{
                      fontSize: 11,
                      fontWeight: 700,
                      padding: '4px 10px',
                      borderRadius: 999,
                      background: bg,
                      color: color,
                    }}
                  >
                    {displayStatus}
                    {typeof sub?.score === 'number' && (displayStatus === 'Approved' || displayStatus === 'Needs Improvement') ? ` · ${sub.score} marks` : ''}
                  </span>
                  
                  {(displayStatus === 'Approved' || displayStatus === 'Needs Improvement' || rawStatus === 'EVALUATED') && sub && (
                    <button
                      type="button"
                      onClick={() => setViewDetailsTarget({ assignment: a, submission: sub })}
                      style={{
                        padding: '8px 14px',
                        borderRadius: 8,
                        border: '1px solid #e2e8f0',
                        background: '#fff',
                        color: '#0f172a',
                        fontWeight: 700,
                        fontSize: 12,
                        cursor: 'pointer',
                      }}
                    >
                      View Details
                    </button>
                  )}

                  {!isOverdue && displayStatus !== 'Locked' && (displayStatus !== 'Approved' || isBelowCutoff) && displayStatus !== 'Submitted' && (
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
                              alert(err?.response?.data?.message || err.message || 'Could not start assignment');
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
                            setSubmissionText('');
                            setAttachmentUrl(a.externalUrl || '');
                          }}
                          style={{
                            padding: '8px 14px',
                            borderRadius: 8,
                            border: 'none',
                            background: '#4f46e5',
                            color: '#fff',
                            fontWeight: 700,
                            fontSize: 12,
                            cursor: 'pointer',
                          }}
                        >
                          {displayStatus === 'Needs Improvement' || isBelowCutoff ? 'Resubmit' : 'Submit'}
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
        <div
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(15,23,42,0.6)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 1000,
            backdropFilter: 'blur(4px)',
          }}
        >
          <div
            style={{
              background: '#fff',
              width: '600px',
              borderRadius: '20px',
              maxHeight: '92vh',
              overflowY: 'auto',
              boxShadow: '0 25px 80px rgba(0,0,0,0.22)',
            }}
          >
            {/* Modal header */}
            <div
              style={{
                padding: '22px 26px',
                borderBottom: '1px solid #f1f5f9',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                position: 'sticky',
                top: 0,
                background: '#fff',
                zIndex: 10,
                borderRadius: '20px 20px 0 0',
              }}
            >
              <div>
                <h3 style={{ margin: 0, fontSize: '17px', fontWeight: 800, color: '#0f172a' }}>
                  📝 {submitTarget.title}
                </h3>
                <p style={{ margin: '4px 0 0 0', fontSize: '12px', color: '#64748b' }}>
                  Max Score: {submitTarget.maxScore ?? 100} pts · Type:{' '}
                  {submitTarget.assignmentType || 'Subjective'}
                </p>
                {submitTarget.createdBy && (
                  <p style={{ margin: '4px 0 0 0', fontSize: '12px', color: '#4f46e5', fontWeight: 600 }}>
                    Assigned by: {submitTarget.createdBy.firstName} {submitTarget.createdBy.lastName}
                  </p>
                )}
              </div>
              <button
                onClick={() => setSubmitTarget(null)}
                style={{
                  background: '#f1f5f9',
                  border: 'none',
                  borderRadius: '8px',
                  width: '32px',
                  height: '32px',
                  cursor: 'pointer',
                  fontSize: '18px',
                  color: '#64748b',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                ×
              </button>
            </div>

            <form
              onSubmit={async (e) => {
                e.preventDefault();
                let finalText = submissionText;
                if (submitTarget.assignmentType === 'MCQ' || submitTarget.mcqConfig?.questions?.length > 0) {
                  finalText = JSON.stringify({ answers: selectedMcqAnswers, textAnswers: subjectiveAnswers, raw: submissionText });
                }
                if (!finalText.trim()) finalText = 'Task completed & submitted';

                setIsSubmitting(true);
                try {
                  await assignmentService.submitAssignment(
                    submitTarget.id,
                    { submissionText: finalText, attachmentUrl: attachmentUrl || undefined },
                    accessToken,
                  );
                  setSubmitTarget(null);
                  setSubmissionText('');
                  setAttachmentUrl('');
                  setSelectedMcqAnswers({});
                  setSubjectiveAnswers({});
                  await loadData();
                  await refreshNotifications();
                  alert('Submitted for evaluation. Your trainer has been notified.');
                } catch (err: any) {
                  alert(err?.response?.data?.message || err.message || 'Submission failed.');
                } finally {
                  setIsSubmitting(false);
                }
              }}
              style={{ padding: '22px 26px', display: 'flex', flexDirection: 'column', gap: '16px' }}
            >
              {/* Instructions Banner */}
              {submitTarget.instructions && (
                <div
                  style={{
                    background: '#f0f9ff',
                    border: '1px solid #bae6fd',
                    borderRadius: '10px',
                    padding: '12px 16px',
                  }}
                >
                  <div
                    style={{
                      fontSize: '11px',
                      fontWeight: 700,
                      color: '#0369a1',
                      textTransform: 'uppercase',
                      letterSpacing: '0.04em',
                      marginBottom: '4px',
                    }}
                  >
                    Instructions
                  </div>
                  <p style={{ fontSize: '13px', color: '#0c4a6e', margin: 0 }}>
                    {submitTarget.instructions}
                  </p>
                </div>
              )}

              {/* Resource URL */}
              {submitTarget.externalUrl && (
                <a
                  href={submitTarget.externalUrl}
                  target="_blank"
                  rel="noreferrer"
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px',
                    padding: '10px 14px',
                    background: '#eff6ff',
                    border: '1px solid #bfdbfe',
                    borderRadius: '10px',
                    textDecoration: 'none',
                    fontSize: '13px',
                    color: '#2563eb',
                    fontWeight: 600,
                  }}
                >
                  🔗 Reference Resource: {submitTarget.externalUrl}
                </a>
              )}

              {/* MCQ Questions */}
              {submitTarget.assignmentType === 'MCQ' ? (
                <div>
                  {(submitTarget.mcqConfig?.questions || [
                    { questionText: submitTarget.title || 'What is your answer to this question?', points: 10, options: ['LLM', 'Model', 'AI', 'hardware'] }
                  ]).map((q: any, qIdx: number) => (
                    <div
                      key={qIdx}
                      style={{
                        background: '#f8fafc',
                        padding: '14px',
                        borderRadius: '10px',
                        marginBottom: '12px',
                        border: '1px solid #e2e8f0',
                      }}
                    >
                      <p style={{ fontSize: '13px', fontWeight: 700, margin: '0 0 10px 0', color: '#0f172a' }}>
                        Q{qIdx + 1}: {q.questionText || q.question} <span style={{ color: '#4f46e5', fontWeight: 600 }}>({q.points || 10} pts)</span>
                      </p>
                      {(q.options || ['Option 1', 'Option 2', 'Option 3', 'Option 4']).map((opt: string, optIdx: number) => (
                        <label
                          key={optIdx}
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: '10px',
                            fontSize: '13px',
                            marginTop: '8px',
                            cursor: 'pointer',
                            padding: '8px 12px',
                            borderRadius: '8px',
                            background: selectedMcqAnswers[qIdx] === optIdx ? '#ede9fe' : '#fff',
                            border: '1px solid',
                            borderColor: selectedMcqAnswers[qIdx] === optIdx ? '#6366f1' : '#e2e8f0',
                            transition: 'all 0.15s',
                          }}
                        >
                          <input
                            type="radio"
                            name={`q_${qIdx}`}
                            checked={selectedMcqAnswers[qIdx] === optIdx}
                            onChange={() => setSelectedMcqAnswers((prev) => ({ ...prev, [qIdx]: optIdx }))}
                            style={{ accentColor: '#4f46e5' }}
                          />
                          {opt}
                        </label>
                      ))}
                    </div>
                  ))}
                </div>
              ) : submitTarget.mcqConfig?.questions?.length > 0 ? (
                /* Subjective multi-question */
                <div>
                  {submitTarget.mcqConfig.questions.map((q: any, qIdx: number) => (
                    <div
                      key={qIdx}
                      style={{
                        background: '#f8fafc',
                        padding: '14px',
                        borderRadius: '10px',
                        marginBottom: '12px',
                        border: '1px solid #e2e8f0',
                      }}
                    >
                      <label style={{ display: 'block', fontSize: '13px', fontWeight: 700, color: '#0f172a', marginBottom: '8px' }}>
                        Q{qIdx + 1}: {q.questionText || q.question} <span style={{ color: '#4f46e5' }}>({q.maxPoints || q.points || 10} pts)</span>
                      </label>
                      <textarea
                        rows={3}
                        required
                        placeholder="Write your answer here..."
                        value={subjectiveAnswers[qIdx] || ''}
                        onChange={(e) => setSubjectiveAnswers((prev) => ({ ...prev, [qIdx]: e.target.value }))}
                        style={{
                          width: '100%',
                          padding: '10px 12px',
                          borderRadius: '8px',
                          border: '1.5px solid #e2e8f0',
                          fontSize: '13px',
                          resize: 'vertical',
                          outline: 'none',
                        }}
                      />
                    </div>
                  ))}
                </div>
              ) : (
                /* Single textarea fallback */
                <div>
                  <label style={{ display: 'block', fontSize: '13px', fontWeight: 700, marginBottom: '8px', color: '#374151' }}>
                    Your Solution / Answer *
                  </label>
                  <textarea
                    rows={5}
                    required
                    placeholder="Type your response here..."
                    value={submissionText}
                    onChange={(e) => setSubmissionText(e.target.value)}
                    style={{
                      width: '100%',
                      padding: '12px',
                      borderRadius: '10px',
                      border: '1.5px solid #e2e8f0',
                      fontSize: '13px',
                      resize: 'vertical',
                      outline: 'none',
                    }}
                  />
                </div>
              )}

              {/* Attachment URL */}
              <div>
                <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, color: '#374151', marginBottom: '6px' }}>
                  Attachment URL <span style={{ fontSize: '11px', color: '#94a3b8', fontWeight: 400 }}>(Optional — GitHub / Google Drive / Workspace)</span>
                </label>
                <input
                  type="url"
                  placeholder="https://github.com/..."
                  value={attachmentUrl}
                  onChange={(e) => setAttachmentUrl(e.target.value)}
                  style={{
                    width: '100%',
                    padding: '10px 12px',
                    borderRadius: '10px',
                    border: '1.5px solid #e2e8f0',
                    fontSize: '13px',
                    outline: 'none',
                  }}
                />
              </div>

              {/* Submit actions */}
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px', paddingTop: '8px', borderTop: '1px solid #f1f5f9' }}>
                <button
                  type="button"
                  onClick={() => setSubmitTarget(null)}
                  style={{
                    padding: '10px 20px',
                    background: '#f1f5f9',
                    border: 'none',
                    borderRadius: '10px',
                    cursor: 'pointer',
                    fontWeight: 600,
                    fontSize: '13px',
                    color: '#475569',
                  }}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  style={{
                    padding: '10px 24px',
                    background: isSubmitting ? '#a5b4fc' : 'linear-gradient(135deg,#6366f1,#4f46e5)',
                    color: '#fff',
                    border: 'none',
                    borderRadius: '10px',
                    cursor: isSubmitting ? 'not-allowed' : 'pointer',
                    fontWeight: 700,
                    fontSize: '13px',
                    boxShadow: '0 2px 8px rgba(99,102,241,0.35)',
                  }}
                >
                  {isSubmitting ? 'Submitting...' : 'Submit Task'}
                </button>
              </div>
            </form>
          </div>
        </div>
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
        const questions = assignment.mcqConfig?.questions || [];
        const isMcq = assignment.assignmentType === 'MCQ';

        let parsedAnswers: any = {};
        let rawText = submission.submissionText || '';
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
                <button onClick={() => setViewDetailsTarget(null)} style={{ background: '#f1f5f9', border: 'none', borderRadius: '8px', width: '32px', height: '32px', cursor: 'pointer', fontSize: '18px', color: '#64748b', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>×</button>
              </div>

              <div style={{ padding: '22px 26px', overflowY: 'auto', flex: 1 }}>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '16px', marginBottom: '24px', background: '#f8fafc', padding: '16px', borderRadius: '12px', border: '1px solid #e2e8f0' }}>
                  <div>
                    <div style={{ fontSize: '11px', color: '#64748b', fontWeight: 600, textTransform: 'uppercase' }}>Submitted By</div>
                    <div style={{ fontSize: '14px', color: '#0f172a', fontWeight: 500, marginTop: '4px' }}>{traineeName}</div>
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

                      return (
                        <div key={idx} style={{ border: '1px solid #e2e8f0', borderRadius: '12px', padding: '16px' }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '12px' }}>
                            <strong style={{ fontSize: '13px', color: '#0f172a', lineHeight: 1.5 }}>Q{idx + 1}: {q.questionText || q.question}</strong>
                            <span style={{ fontSize: '12px', color: '#6366f1', fontWeight: 600, background: '#e0e7ff', padding: '2px 8px', borderRadius: '999px', flexShrink: 0 }}>{qPoints} pts</span>
                          </div>
                          <div style={{ background: '#f8fafc', padding: '12px', borderRadius: '8px', fontSize: '13px', color: '#334155' }}>
                            <span style={{ fontWeight: 600, color: '#64748b', display: 'block', marginBottom: '4px', fontSize: '11px', textTransform: 'uppercase' }}>Your Answer:</span>
                            {userAnswer}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <div style={{ border: '1px solid #e2e8f0', borderRadius: '12px', padding: '16px' }}>
                     <div style={{ background: '#f8fafc', padding: '12px', borderRadius: '8px', fontSize: '13px', color: '#334155', whiteSpace: 'pre-wrap' }}>
                        <span style={{ fontWeight: 600, color: '#64748b', display: 'block', marginBottom: '4px', fontSize: '11px', textTransform: 'uppercase' }}>Your Submission:</span>
                        {parsedAnswers.raw || rawText}
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
