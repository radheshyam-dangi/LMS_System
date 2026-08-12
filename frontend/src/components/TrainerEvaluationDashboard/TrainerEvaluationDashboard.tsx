import React, { useState, useEffect, useMemo } from 'react';
import { curriculumService } from '../../services/curriculumService';
import { assignmentService } from '../../services/assignmentService';
import { learningPathService } from '../../services/learningPathService';
import { userService } from '../../services/userService';
import { Plus, CheckCircle, Clock, Search, ExternalLink, X, MessageSquare, Save, Users, AlertCircle, PlayCircle, Eye, Edit2, Archive, Link as LinkIcon } from 'lucide-react';
import { useNotifications } from '../../context/NotificationContext';
import { useSearch } from '../../context/SearchContext';
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
  Rejected: { bg: '#fee2e2', color: '#b91c1c', border: '#fca5a5', dot: '#ef4444' },
};

export function TrainerEvaluationDashboard({ accessToken, currentUser, activeSection, activeRole }: TrainerEvaluationDashboardProps) {
  const { refresh: refreshNotifications, markRelatedRead } = useNotifications();
  const { searchQuery } = useSearch();
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
  const [statusFilter, setStatusFilter] = useState<string>('All');

  // ─── View / Edit Modal State ───────────────────────────────────────────
  const [expandedAssignmentId, setExpandedAssignmentId] = useState<string | null>(null);
  const [editAssignment, setEditAssignment] = useState<any | null>(null);

  // ─── New Assignment modal state ────────────────────────────────────────
  const [showNewModal, setShowNewModal] = useState(false);
  const [learningPaths, setLearningPaths] = useState<any[]>([]);
  const [pathModules, setPathModules] = useState<any[]>([]);
  const [allTrainees, setAllTrainees] = useState<any[]>([]);
  const [isLoadingTrainees, setIsLoadingTrainees] = useState(false);
  const [isCreating, setIsCreating] = useState(false);

  // Form fields
  const [formTitle, setFormTitle] = useState('');
  const [formPathId, setFormPathId] = useState('');
  const [formModuleId, setFormModuleId] = useState('');
  const [formLessonId, setFormLessonId] = useState('');
  const [formDueDate, setFormDueDate] = useState('');
  const [formPriority, setFormPriority] = useState<'High' | 'Medium' | 'Low'>('Medium');
  const [formDescription, setFormDescription] = useState('');
  const [formResourceUrl, setFormResourceUrl] = useState('');
  const [formAssignmentType, setFormAssignmentType] = useState<'Subjective' | 'MCQ' | 'External'>('Subjective');
  const [formExternalUrl, setFormExternalUrl] = useState('');
  const [formSelectedTrainees, setFormSelectedTrainees] = useState<string[]>([]);
  const [formQuestions, setFormQuestions] = useState<{ questionText: string; points: number; options?: string[]; correctIndex?: number }[]>([
    { questionText: '', points: 10 },
  ]);

  // ─── Active main tab ───────────────────────────────────────────────────
  const currentTab = (activeSection === 'Evaluations' || window.location.pathname.includes('/evaluations')) ? 'evaluations' : 'assignments';
  const isAdminView = activeRole?.toLowerCase() === 'admin';

  // ─── Load data ─────────────────────────────────────────────────────────
  const loadAll = async () => {
    setIsLoadingSubmissions(true);
    setIsLoadingAssignments(true);
    try {
      const [subs, allAssign] = await Promise.all([
        curriculumService.fetchPendingSubmissions(accessToken).catch(() => []),
        assignmentService.fetchAllAssignments(accessToken).catch(() => []),
      ]);
      setPendingSubmissions(Array.isArray(subs) ? subs : []);
      setAssignments(Array.isArray(allAssign) ? allAssign : []);
    } catch (err) {
      console.error('Failed to load assignments:', err);
    } finally {
      setIsLoadingSubmissions(false);
      setIsLoadingAssignments(false);
    }
  };

  useEffect(() => { loadAll(); }, [accessToken]);

  // ─── Load Trainees when Modal Opens ──────────────────
  useEffect(() => {
    if (!showNewModal) {
      setAllTrainees([]);
      return;
    }
    setIsLoadingTrainees(true);
    (async () => {
      try {
        const users = await userService.fetchAllUsers(accessToken).catch(() => []);
        const trainees = (users || []).filter((u: any) => {
          const roles: string[] = [];
          if (typeof u.role === 'string') roles.push(u.role.toLowerCase());
          if (typeof u.primaryRole === 'string') roles.push(u.primaryRole.toLowerCase());
          if (u.primaryRole?.name) roles.push(u.primaryRole.name.toLowerCase());
          if (Array.isArray(u.roles)) u.roles.forEach((r: any) => {
            if (typeof r === 'string') roles.push(r.toLowerCase());
            if (r?.name) roles.push(r.name.toLowerCase());
          });
          return roles.includes('trainee');
        });
        setAllTrainees(trainees);
      } catch { } finally {
        setIsLoadingTrainees(false);
      }
    })();
  }, [showNewModal, accessToken]);

  // ─── Filter assignments by active role ────────────────────────────────
  const roleFilteredAssignments = useMemo(() => {
    let result = assignments;
    if (!isAdminView && currentUser) {
      const uid = String(currentUser.id || currentUser.sub || '').toLowerCase();
      result = result.filter((a: any) => {
        const creatorId = String(a.createdBy?.id || a.createdById || '').toLowerCase();
        const lpCreatorId = String(
          a.learningPath?.createdBy?.id ||
          a.lesson?.module?.learningPath?.createdBy?.id ||
          a.module?.learningPath?.createdBy?.id ||
          a.learningPath?.createdById || ''
        ).toLowerCase();
        const hasEvaluatedSub = (a.submissions || []).some((s: any) => {
          const evalId = String(s.evaluatedBy?.id || s.evaluatedById || '').toLowerCase();
          return evalId === uid;
        });
        return creatorId === uid || lpCreatorId === uid || hasEvaluatedSub;
      });
    }
    return result;
  }, [assignments, isAdminView, currentUser]);

  // ─── Filter assignments by status ─────────────────────────────────────
  const filteredAssignments = useMemo(() => {
    let result = roleFilteredAssignments;

    if (statusFilter !== 'All') {
      result = result.filter((a: any) => {
        let st = (a.status || 'Pending').toLowerCase();
        if (statusFilter.toLowerCase() === 'approved' && st === 'accepted') return true;
        if (statusFilter.toLowerCase() === 'needs improvement' && st === 'rejected') return true;
        return st === statusFilter.toLowerCase();
      });
    }

    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      result = result.filter((a: any) => {
        const titleMatch = (a.title || '').toLowerCase().includes(query);
        const descMatch = (a.description || a.instructions || '').toLowerCase().includes(query);
        return titleMatch || descMatch;
      });
    }

    return result;
  }, [roleFilteredAssignments, statusFilter, searchQuery]);

  const statusCounts = useMemo(() => {
    const counts: Record<string, number> = { All: roleFilteredAssignments.length, Pending: 0, 'In Progress': 0, Submitted: 0, Accepted: 0, Rejected: 0 };
    roleFilteredAssignments.forEach((a: any) => {
      const st = a.status || 'Pending';
      counts[st] = (counts[st] || 0) + 1;
    });
    return counts;
  }, [assignments]);

  const summaryCards = [
    { title: 'Pending', count: statusCounts['Pending'] || 0, key: 'Pending' },
    { title: 'Submitted', count: statusCounts['Submitted'] || 0, key: 'Submitted' },
    { title: 'Needs Improvement', count: statusCounts['Rejected'] || 0, key: 'Needs Improvement' },
    { title: 'Approved', count: statusCounts['Accepted'] || 0, key: 'Approved' },
  ];

  const filteredPendingSubmissions = useMemo(() => {
    let result = pendingSubmissions;
    if (!isAdminView && currentUser) {
      const uid = String(currentUser.id || currentUser.sub || '').toLowerCase();
      result = result.filter((s: any) => {
        const a = s.assignment;
        const creatorId = String(a?.createdBy?.id || a?.createdById || '').toLowerCase();
        const lpCreatorId = String(
          a?.learningPath?.createdBy?.id ||
          a?.lesson?.module?.learningPath?.createdBy?.id ||
          a?.module?.learningPath?.createdBy?.id ||
          a?.learningPath?.createdById || ''
        ).toLowerCase();
        const evalId = String(s.evaluatedBy?.id || s.evaluatedById || '').toLowerCase();
        return creatorId === uid || lpCreatorId === uid || evalId === uid;
      });
    }
    return result;
  }, [pendingSubmissions, isAdminView, currentUser]);

  // ─── Modal Handlers ──────────────────────────────────────────────
  const handleViewAssignment = (assign: any) => { setExpandedAssignmentId(assign.id); };
  const closeViewEditModals = () => { setExpandedAssignmentId(null); setEditAssignment(null); };

  // ─── Evaluation handlers ───────────────────────────────────────────────
  const handleOpenReview = async (sub: any) => {
    setSelectedSub(sub);
    setEvalScore(sub.assignment?.maxScore || 100);
    setEvalFeedback('');
    // Opening evaluation decreases trainer bell counter without page reload
    try {
      await assignmentService.openSubmissionForEvaluation(sub.id, accessToken);
      await markRelatedRead('submission', sub.id);
      await refreshNotifications();
    } catch {
      // Non-blocking
    }
  };

  const handleEvaluate = async (status: 'Accepted' | 'Rejected') => {
    if (status === 'Rejected' && !evalFeedback.trim()) {
      alert('Feedback is mandatory when rejecting a submission.');
      return;
    }
    setIsEvaluating(true);
    try {
      await curriculumService.evaluateSubmission(
        selectedSub.id,
        { score: status === 'Rejected' ? 0 : evalScore, feedback: evalFeedback, status },
        accessToken
      );
      setSelectedSub(null);
      await loadAll();
      await refreshNotifications();
    } catch (err: any) {
      alert(err.message || 'Evaluation failed.');
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

  // ─── New Assignment submission ─────────────────────────────────────────
  const handleCreateAssignment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formTitle.trim()) { alert('Title is required.'); return; }

    const isExternal = formAssignmentType === 'External';

    if (formSelectedTrainees.length === 0) {
      alert('Select at least one trainee for this assignment.');
      return;
    }

    setIsCreating(true);
    try {
      const mcqConfig = formAssignmentType === 'MCQ'
        ? { questions: formQuestions.map(q => ({ ...q, options: q.options || ['', '', '', ''] })) }
        : { questions: formQuestions };

      const payload: any = {
        title: formTitle,
        instructions: formDescription,
        assignmentType: formAssignmentType,
        externalUrl: isExternal ? formExternalUrl : undefined,
        mcqConfig: isExternal ? undefined : mcqConfig,
        dueDate: formDueDate || undefined,
        priority: formPriority,
        resourceUrl: formResourceUrl || undefined,
        traineeIds: formSelectedTrainees,
      };

      await assignmentService.createTask(payload, accessToken);
      setShowNewModal(false);
      resetForm();
      await loadAll();
      await refreshNotifications();
    } catch (err: any) {
      alert(err?.response?.data?.message || err.message || 'Failed to create assignment.');
    } finally {
      setIsCreating(false);
    }
  };

  const resetForm = () => {
    setFormTitle('');
    setFormPathId('');
    setFormModuleId('');
    setFormLessonId('');
    setFormDueDate('');
    setFormPriority('Medium');
    setFormDescription('');
    setFormResourceUrl('');
    setFormAssignmentType('Subjective');
    setFormExternalUrl('');
    setFormSelectedTrainees([]);
    setFormQuestions([{ questionText: '', points: 10 }]);
  };

  const addQuestion = () => setFormQuestions(prev => [
    ...prev,
    formAssignmentType === 'MCQ'
      ? { questionText: '', points: 10, options: ['', '', '', ''], correctIndex: 0 }
      : { questionText: '', points: 10 },
  ]);

  const updateQuestion = (idx: number, field: string, value: any) => {
    setFormQuestions(prev => prev.map((q, i) => i === idx ? { ...q, [field]: value } : q));
  };

  const updateOption = (qIdx: number, optIdx: number, value: string) => {
    setFormQuestions(prev => prev.map((q, i) => {
      if (i !== qIdx) return q;
      const opts = [...(q.options || ['', '', '', ''])];
      opts[optIdx] = value;
      return { ...q, options: opts };
    }));
  };

  const toggleTrainee = (id: string) => {
    setFormSelectedTrainees(prev =>
      prev.includes(id) ? prev.filter(t => t !== id) : [...prev, id]
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
        {currentTab === 'assignments' && (
          <button onClick={() => setShowNewModal(true)} className="btn-trainer-primary">
            + New Assignment
          </button>
        )}
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

          {/* Assignment cards */}
          {isLoadingAssignments ? (
            <div style={{ textAlign: 'center', padding: '40px', color: '#94a3b8' }}>Loading assignments...</div>
          ) : filteredAssignments.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '60px', background: '#f8fafc', borderRadius: '12px', border: '2px dashed #e2e8f0' }}>
              <div style={{ fontSize: '32px', marginBottom: '12px' }}>{searchQuery ? '🔍' : '📋'}</div>
              <div style={{ fontWeight: 700, color: '#475569' }}>
                {searchQuery ? 'No matches found' : 'No assignments found'}
              </div>
              <div style={{ fontSize: '13px', color: '#94a3b8', marginTop: '4px' }}>
                {searchQuery ? `We couldn't find anything matching "${searchQuery}".` : 'Create a new assignment to get started'}
              </div>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              {filteredAssignments.map((assign: any) => {
                const statusKey = assign.status || 'Pending';
                const sc = STATUS_COLORS[statusKey] || STATUS_COLORS.Pending;
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
                            {statusKey === 'Accepted' ? 'Approved' : statusKey}
                          </span>
                        </div>
                        <div style={{ fontSize: '12px', color: '#64748b', marginTop: '6px', display: 'flex', gap: '16px', flexWrap: 'wrap' }}>
                          {assign.module?.title && <span>📦 {assign.module.title}</span>}
                          <span>👤 {traineeName}</span>
                          {assign.dueDate && <span>📅 Due: {new Date(assign.dueDate).toLocaleDateString()}</span>}
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

                        {/* Action Buttons — Edit only for Admin */}
                        <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
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
                            <div>
                              <span style={{ display: 'block', fontSize: '11px', color: '#64748b', fontWeight: 600, textTransform: 'uppercase' }}>Assigned To</span>
                              <span style={{ fontSize: '13px', color: '#0f172a', fontWeight: 500 }}>
                                {assign.assignedToTraineeIds?.length ? `${assign.assignedToTraineeIds.length} trainees` : 'Cohort (Path assigned)'}
                              </span>
                            </div>
                            <div>
                              <span style={{ display: 'block', fontSize: '11px', color: '#64748b', fontWeight: 600, textTransform: 'uppercase' }}>Submitted By (Latest)</span>
                              <span style={{ fontSize: '13px', color: '#0f172a', fontWeight: 500 }}>
                                {assign.latestSubmission?.trainee ? `${assign.latestSubmission.trainee.firstName} ${assign.latestSubmission.trainee.lastName}`.trim() : 'No submissions yet'}
                              </span>
                            </div>
                            <div>
                              <span style={{ display: 'block', fontSize: '11px', color: '#64748b', fontWeight: 600, textTransform: 'uppercase' }}>Due Date</span>
                              <span style={{ fontSize: '13px', color: '#0f172a', fontWeight: 500 }}>
                                {assign.dueDate ? new Date(assign.dueDate).toLocaleDateString() : 'No deadline'}
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

                          <div style={{ fontSize: '13px', color: '#334155', background: '#fff', padding: '10px 12px', borderRadius: '6px', display: 'flex', gap: '6px', alignItems: 'center', border: '1px solid #e2e8f0' }}>
                            <strong>Task Path:</strong>
                            <span style={{ color: '#475569' }}>
                              {[
                                assign.learningPath?.title || assign.module?.learningPath?.title || assign.lesson?.module?.learningPath?.title,
                                assign.module?.title || assign.lesson?.module?.title,
                                assign.lesson?.title,
                              ].filter(Boolean).join(' ➔ ') || 'External Task'}
                            </span>
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
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
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

                return filteredSubs.map((sub: any) => (
                  <div key={sub.id} className="trainer-list-card" style={{ padding: '16px 20px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div>
                      <div style={{ fontWeight: 700, fontSize: '15px', color: '#0f172a' }}>
                        👤 {sub.trainee?.firstName} {sub.trainee?.lastName || ''}
                        <span style={{ color: '#64748b', fontSize: '12px', fontWeight: 400, marginLeft: '8px' }}>({sub.trainee?.email})</span>
                      </div>
                      <div style={{ fontSize: '13px', color: '#334155', marginTop: '4px' }}>
                        Submitted: <strong>"{sub.assignment?.title}"</strong> · Max Score: {sub.assignment?.maxScore || 100} pts
                      </div>
                      <div style={{ fontSize: '11px', color: '#94a3b8', marginTop: '4px' }}>
                        {sub.submittedAt ? new Date(sub.submittedAt).toLocaleString() : 'Date unknown'}
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => handleOpenReview(sub)}
                      className="btn-trainer-action-primary"
                    >
                      Review & Grade
                    </button>
                  </div>
                ));
              })()}
            </div>
          )}
        </>
      )}

      {/* EDIT MODAL REMOVED (No longer used for Trainers in this view) */}

      {/* ═══ EVALUATION MODAL ═══ */}
      {selectedSub && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(15,23,42,0.55)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, backdropFilter: 'blur(4px)' }}>
          <div style={{ background: '#fff', width: '640px', padding: '28px', borderRadius: '16px', maxHeight: '90vh', overflowY: 'auto', boxShadow: '0 20px 60px rgba(0,0,0,0.18)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '16px' }}>
              <div>
                <h3 style={{ margin: 0, fontSize: '18px', fontWeight: 800, color: '#0f172a' }}>Evaluate: {selectedSub.assignment?.title}</h3>
                <p style={{ fontSize: '12px', color: '#64748b', margin: '4px 0 0 0' }}>Trainee: {selectedSub.trainee?.firstName} ({selectedSub.trainee?.email})</p>
                {isAdminView && selectedSub.evaluatedBy && (
                  <p style={{ fontSize: '12px', color: '#64748b', margin: '4px 0 0 0' }}>
                    Evaluated by: {selectedSub.evaluatedBy?.firstName} {selectedSub.evaluatedBy?.lastName}
                  </p>
                )}
                {isAdminView && selectedSub.score !== undefined && selectedSub.score !== null && (
                  <p style={{ fontSize: '12px', color: '#64748b', margin: '4px 0 0 0', fontWeight: 600 }}>
                    Score Gained: {selectedSub.score} / {selectedSub.assignment?.maxScore || 100}
                  </p>
                )}
              </div>
              <button onClick={() => setSelectedSub(null)} style={{ background: 'none', border: 'none', fontSize: '20px', cursor: 'pointer', color: '#64748b' }}>×</button>
            </div>

            <div style={{ marginBottom: '16px', background: '#f8fafc', padding: '14px', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
              <strong style={{ fontSize: '13px', color: '#0f172a', display: 'block', marginBottom: '10px' }}>Trainee Solution Breakdown:</strong>
              {renderParsedSubmission(selectedSub)}
            </div>

            {selectedSub.attachmentUrl && (
              <div style={{ marginBottom: '14px', fontSize: '13px' }}>
                📎 <strong>Attachment:</strong>{' '}
                <a href={selectedSub.attachmentUrl} target="_blank" rel="noreferrer" style={{ color: '#2563eb', fontWeight: 600 }}>{selectedSub.attachmentUrl}</a>
              </div>
            )}

            <div style={{ marginBottom: '14px' }}>
              <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, color: '#334155', marginBottom: '6px' }}>
                Overall Score (Max: {selectedSub.assignment?.maxScore || 100}) *
              </label>
              <input
                type="number" min={0} max={selectedSub.assignment?.maxScore || 100}
                value={evalScore} onChange={e => setEvalScore(Number(e.target.value))}
                style={{ width: '100%', padding: '8px 12px', borderRadius: '8px', border: '1px solid #cbd5e1', fontSize: '14px', fontWeight: 700, outline: 'none' }}
              />
            </div>

            <div style={{ marginBottom: '18px' }}>
              <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, color: '#334155', marginBottom: '6px' }}>
                Trainer Feedback <span style={{ color: '#dc2626' }}>* (Mandatory if Rejecting)</span>
              </label>
              <textarea
                rows={3} value={evalFeedback} onChange={e => setEvalFeedback(e.target.value)}
                placeholder="Write clear, constructive feedback for the trainee..."
                style={{ width: '100%', padding: '10px 12px', borderRadius: '8px', border: '1px solid #cbd5e1', fontSize: '13px', resize: 'vertical', outline: 'none' }}
              />
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
              <button type="button" onClick={() => setSelectedSub(null)} style={{ padding: '9px 18px', background: '#f1f5f9', border: 'none', borderRadius: '8px', cursor: 'pointer', fontWeight: 600 }}>Cancel</button>
              <button type="button" disabled={isEvaluating} onClick={() => handleEvaluate('Rejected')} style={{ padding: '9px 18px', background: '#dc2626', color: '#fff', border: 'none', borderRadius: '8px', cursor: 'pointer', fontWeight: 700 }}>Reject ❌</button>
              <button type="button" disabled={isEvaluating} onClick={() => handleEvaluate('Accepted')} style={{ padding: '9px 18px', background: '#16a34a', color: '#fff', border: 'none', borderRadius: '8px', cursor: 'pointer', fontWeight: 700 }}>Accept ✅</button>
            </div>
          </div>
        </div>
      )}

      {/* ═══ NEW ASSIGNMENT MODAL ═══ */}
      {showNewModal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(15,23,42,0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, backdropFilter: 'blur(4px)' }}>
          <div style={{ background: '#fff', width: '680px', maxHeight: '92vh', overflowY: 'auto', borderRadius: '20px', boxShadow: '0 25px 80px rgba(0,0,0,0.2)' }}>
            <div style={{ padding: '24px 28px', borderBottom: '1px solid #f1f5f9', display: 'flex', justifyContent: 'space-between', alignItems: 'center', position: 'sticky', top: 0, background: '#fff', zIndex: 10, borderRadius: '20px 20px 0 0' }}>
              <div>
                <h2 style={{ margin: 0, fontSize: '20px', fontWeight: 800, color: '#0f172a' }}>New Assignment</h2>
                <p style={{ margin: '4px 0 0 0', fontSize: '12px', color: '#64748b' }}>Create and assign a task to a trainee or group.</p>
              </div>
              <button onClick={() => { setShowNewModal(false); resetForm(); }} style={{ background: '#f1f5f9', border: 'none', borderRadius: '8px', width: '32px', height: '32px', cursor: 'pointer', fontSize: '18px', color: '#64748b', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>×</button>
            </div>

            <form onSubmit={handleCreateAssignment} style={{ padding: '24px 28px', display: 'flex', flexDirection: 'column', gap: '18px' }}>

              {/* Assignment Title */}
              <div>
                <label style={{ display: 'block', fontSize: '12px', fontWeight: 700, color: '#374151', marginBottom: '6px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Assignment Title *</label>
                <input
                  required value={formTitle} onChange={e => setFormTitle(e.target.value)}
                  placeholder="e.g. Build a REST API with authentication"
                  style={{ width: '100%', padding: '10px 14px', borderRadius: '10px', border: '1.5px solid #e2e8f0', fontSize: '14px', outline: 'none', transition: 'border-color 0.2s' }}
                />
              </div>

              {/* Assignment Type */}
              <div>
                <label style={{ display: 'block', fontSize: '12px', fontWeight: 700, color: '#374151', marginBottom: '6px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Assignment Type</label>
                <select
                  value={formAssignmentType}
                  onChange={e => setFormAssignmentType(e.target.value as any)}
                  style={{ width: '100%', padding: '10px 14px', borderRadius: '10px', border: '1.5px solid #e2e8f0', fontSize: '13px', background: '#fff', cursor: 'pointer', outline: 'none' }}
                >
                  <option value="Subjective">📝 Subjective Questions</option>
                  <option value="MCQ">🔘 Multiple Choice Quiz (MCQ)</option>
                  <option value="External">🔗 External Assignment</option>
                </select>
                <p style={{ margin: '6px 0 0', fontSize: 12, color: '#64748b' }}>
                  Assignments created here are standalone and will be sent directly to the selected trainees.
                </p>
              </div>

              {/* External URL conditional */}
              {formAssignmentType === 'External' && (
                <div>
                  <label style={{ display: 'block', fontSize: '12px', fontWeight: 700, color: '#374151', marginBottom: '6px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>External Resource / Test URL</label>
                  <input
                    type="url" value={formExternalUrl} onChange={e => setFormExternalUrl(e.target.value)}
                    placeholder="https://docs.google.com/forms/..."
                    style={{ width: '100%', padding: '10px 14px', borderRadius: '10px', border: '1.5px solid #e2e8f0', fontSize: '13px', outline: 'none' }}
                  />
                </div>
              )}

              {/* Due Date + Priority */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '12px', fontWeight: 700, color: '#374151', marginBottom: '6px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Due Date</label>
                  <input
                    type="date" value={formDueDate} onChange={e => setFormDueDate(e.target.value)}
                    style={{ width: '100%', padding: '10px 14px', borderRadius: '10px', border: '1.5px solid #e2e8f0', fontSize: '13px', outline: 'none' }}
                  />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '12px', fontWeight: 700, color: '#374151', marginBottom: '6px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Priority</label>
                  <select
                    value={formPriority} onChange={e => setFormPriority(e.target.value as any)}
                    style={{ width: '100%', padding: '10px 14px', borderRadius: '10px', border: '1.5px solid #e2e8f0', fontSize: '13px', background: '#fff', cursor: 'pointer', outline: 'none' }}
                  >
                    <option>High</option><option>Medium</option><option>Low</option>
                  </select>
                </div>
              </div>

              {/* Resource URL */}
              <div>
                <label style={{ display: 'block', fontSize: '12px', fontWeight: 700, color: '#374151', marginBottom: '6px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Resource URL (for trainee upskilling)</label>
                <input
                  type="url" value={formResourceUrl} onChange={e => setFormResourceUrl(e.target.value)}
                  placeholder="https://docs.example.com/guide"
                  style={{ width: '100%', padding: '10px 14px', borderRadius: '10px', border: '1.5px solid #e2e8f0', fontSize: '13px', outline: 'none' }}
                />
              </div>

              {/* Description */}
              <div>
                <label style={{ display: 'block', fontSize: '12px', fontWeight: 700, color: '#374151', marginBottom: '6px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Description / Instructions (optional)</label>
                <textarea
                  rows={3} value={formDescription} onChange={e => setFormDescription(e.target.value)}
                  placeholder="Describe the assignment objectives and requirements..."
                  style={{ width: '100%', padding: '10px 14px', borderRadius: '10px', border: '1.5px solid #e2e8f0', fontSize: '13px', resize: 'vertical', outline: 'none' }}
                />
              </div>

              {/* Questions builder */}
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
                  <label style={{ fontSize: '12px', fontWeight: 700, color: '#374151', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                    {formAssignmentType === 'MCQ' ? 'MCQ Questions' : 'Subjective Questions'}
                  </label>
                  <button
                    type="button" onClick={addQuestion}
                    style={{ fontSize: '12px', fontWeight: 600, color: '#4f46e5', background: '#ede9fe', border: 'none', borderRadius: '6px', padding: '4px 12px', cursor: 'pointer' }}
                  >
                    + Add Question
                  </button>
                </div>
                {formQuestions.map((q, qIdx) => (
                  <div key={qIdx} style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '10px', padding: '14px', marginBottom: '10px' }}>
                    <div style={{ display: 'flex', gap: '10px', marginBottom: '8px' }}>
                      <input
                        value={q.questionText} onChange={e => updateQuestion(qIdx, 'questionText', e.target.value)}
                        placeholder={`Q${qIdx + 1}: Enter question text`}
                        style={{ flex: 1, padding: '8px 12px', borderRadius: '8px', border: '1px solid #e2e8f0', fontSize: '13px', outline: 'none' }}
                      />
                      <input
                        type="number" min={1} max={100} value={q.points}
                        onChange={e => updateQuestion(qIdx, 'points', Number(e.target.value))}
                        style={{ width: '70px', padding: '8px', borderRadius: '8px', border: '1px solid #e2e8f0', fontSize: '13px', textAlign: 'center', outline: 'none' }}
                        placeholder="Pts"
                      />
                    </div>
                    {formAssignmentType === 'MCQ' && (
                      <div>
                        {(q.options || ['', '', '', '']).map((opt, optIdx) => (
                          <div key={optIdx} style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '6px' }}>
                            <input
                              type="radio" name={`correct_${qIdx}`}
                              checked={q.correctIndex === optIdx}
                              onChange={() => updateQuestion(qIdx, 'correctIndex', optIdx)}
                              title="Mark as correct answer"
                            />
                            <input
                              value={opt} onChange={e => updateOption(qIdx, optIdx, e.target.value)}
                              placeholder={`Option ${optIdx + 1}`}
                              style={{ flex: 1, padding: '6px 10px', borderRadius: '6px', border: '1px solid #e2e8f0', fontSize: '12px', outline: 'none' }}
                            />
                          </div>
                        ))}
                        <div style={{ fontSize: '11px', color: '#64748b', marginTop: '4px' }}>🔘 Select radio button to mark correct answer</div>
                      </div>
                    )}
                    {formQuestions.length > 1 && (
                      <button
                        type="button"
                        onClick={() => setFormQuestions(prev => prev.filter((_, i) => i !== qIdx))}
                        style={{ fontSize: '11px', color: '#dc2626', background: 'none', border: 'none', cursor: 'pointer', marginTop: '4px', fontWeight: 600 }}
                      >
                        Remove Question
                      </button>
                    )}
                  </div>
                ))}
              </div>

              {/* Trainee Assignment Checklist */}
              <div>
                <label style={{ display: 'block', fontSize: '12px', fontWeight: 700, color: '#374151', marginBottom: '8px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                  Assign to Trainees ({formSelectedTrainees.length} selected)
                </label>
                <div style={{ border: '1.5px solid #e2e8f0', borderRadius: '10px', maxHeight: '200px', overflowY: 'auto' }}>
                  {isLoadingTrainees ? (
                    <div style={{ padding: '16px', textAlign: 'center', color: '#94a3b8' }}>Loading trainees...</div>
                  ) : allTrainees.length === 0 ? (
                    <div style={{ padding: '16px', textAlign: 'center', color: '#94a3b8' }}>No trainees found.</div>
                  ) : (
                    allTrainees.map((t: any) => {
                      const name = `${t.firstName || ''} ${t.lastName || ''}`.trim() || t.email;
                      const isChecked = formSelectedTrainees.includes(t.id);
                      return (
                        <label
                          key={t.id}
                          style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '10px 14px', cursor: 'pointer', borderBottom: '1px solid #f8fafc', background: isChecked ? '#f0f9ff' : '#fff', transition: 'background 0.15s' }}
                        >
                          <input
                            type="checkbox" checked={isChecked} onChange={() => toggleTrainee(t.id)}
                            style={{ width: '16px', height: '16px', accentColor: '#4f46e5', cursor: 'pointer' }}
                          />
                          <div>
                            <div style={{ fontSize: '13px', fontWeight: 600, color: '#1e293b' }}>{name}</div>
                            <div style={{ fontSize: '11px', color: '#64748b' }}>{t.email}</div>
                          </div>
                          {isChecked && (
                            <span style={{ marginLeft: 'auto', fontSize: '11px', fontWeight: 700, color: '#2563eb', background: '#eff6ff', padding: '2px 8px', borderRadius: '4px' }}>
                              Selected
                            </span>
                          )}
                        </label>
                      );
                    })
                  )}
                </div>
              </div>

              {/* Form Footer */}
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px', paddingTop: '8px', borderTop: '1px solid #f1f5f9', marginTop: '4px' }}>
                <button
                  type="button" onClick={() => { setShowNewModal(false); resetForm(); }}
                  style={{ padding: '10px 22px', background: '#f1f5f9', border: 'none', borderRadius: '10px', cursor: 'pointer', fontWeight: 600, fontSize: '13px', color: '#475569' }}
                >
                  Cancel
                </button>
                <button
                  type="submit" disabled={isCreating}
                  style={{ padding: '10px 22px', background: isCreating ? '#a5b4fc' : 'linear-gradient(135deg, #6366f1, #4f46e5)', color: '#fff', border: 'none', borderRadius: '10px', cursor: isCreating ? 'not-allowed' : 'pointer', fontWeight: 700, fontSize: '13px', boxShadow: '0 2px 8px rgba(99,102,241,0.35)' }}
                >
                  {isCreating ? 'Creating...' : 'Create Assignment'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}