import React, { useState, useEffect, useMemo } from 'react';
import { curriculumService } from '../../services/curriculumService';
import { assignmentService } from '../../services/assignmentService';
import { learningPathService } from '../../services/learningPathService';
import { userService } from '../../services/userService';
import { useNotifications } from '../../context/NotificationContext';

interface TrainerEvaluationDashboardProps {
  accessToken: string;
  currentUser: any;
}

const PRIORITY_COLORS: Record<string, { bg: string; color: string; border: string }> = {
  High:   { bg: '#fee2e2', color: '#b91c1c', border: '#fca5a5' },
  Medium: { bg: '#fef3c7', color: '#b45309', border: '#fde68a' },
  Low:    { bg: '#dcfce7', color: '#166534', border: '#86efac' },
};

const STATUS_COLORS: Record<string, { bg: string; color: string; border: string; dot: string }> = {
  Pending:    { bg: '#f8fafc', color: '#475569', border: '#e2e8f0', dot: '#94a3b8' },
  'In Progress': { bg: '#eff6ff', color: '#1d4ed8', border: '#bfdbfe', dot: '#3b82f6' },
  Submitted:  { bg: '#fef3c7', color: '#b45309', border: '#fde68a', dot: '#f59e0b' },
  Accepted:   { bg: '#dcfce7', color: '#166534', border: '#86efac', dot: '#22c55e' },
  Rejected:   { bg: '#fee2e2', color: '#b91c1c', border: '#fca5a5', dot: '#ef4444' },
};

export function TrainerEvaluationDashboard({ accessToken, currentUser }: TrainerEvaluationDashboardProps) {
  const { refresh: refreshNotifications, markRelatedRead } = useNotifications();
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
  const [viewAssignment, setViewAssignment] = useState<any | null>(null);
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
  const [mainTab, setMainTab] = useState<'assignments' | 'evaluations'>('assignments');

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

  // ─── Load learning paths when modal opens ──────────────────
  useEffect(() => {
    if (!showNewModal) return;
    (async () => {
      try {
        const paths = await learningPathService.fetchAllPaths(accessToken).catch(() => []);
        setLearningPaths(Array.isArray(paths) ? paths : []);
        // Intentionally NOT setting default pathId so it forces them to choose
      } catch {}
    })();
  }, [showNewModal, accessToken]);

  // ─── Load Modules & Trainees when Path Changes ──────────────────
  useEffect(() => {
    if (!showNewModal || !formPathId) {
      setPathModules([]);
      setFormModuleId('');
      setFormLessonId('');
      setAllTrainees([]);
      return;
    }

    setIsLoadingTrainees(true);
    (async () => {
      try {
        // Fetch Modules for the selected Path
        const modulesData = await curriculumService.fetchModulesByPath(formPathId, accessToken).catch(() => []);
        setPathModules(Array.isArray(modulesData) ? modulesData : []);

        // Fetch Trainees
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
      } catch {} finally {
        setIsLoadingTrainees(false);
      }
    })();
  }, [showNewModal, formPathId, accessToken]);

  // Derive Available Lessons dynamically based on selected module
  const availableLessons = useMemo(() => {
    const selectedModule = pathModules.find((m: any) => String(m.id) === String(formModuleId));
    return selectedModule?.lessons || [];
  }, [formModuleId, pathModules]);

  // ─── Filter assignments by status ─────────────────────────────────────
  const filteredAssignments = useMemo(() => {
    if (statusFilter === 'All') return assignments;
    return assignments.filter((a: any) => {
      let st = (a.status || 'Pending').toLowerCase();
      if (statusFilter.toLowerCase() === 'approved' && st === 'accepted') return true;
      if (statusFilter.toLowerCase() === 'needs improvement' && st === 'rejected') return true;
      return st === statusFilter.toLowerCase();
    });
  }, [assignments, statusFilter]);

  const statusCounts = useMemo(() => {
    const counts: Record<string, number> = { All: assignments.length, Pending: 0, 'In Progress': 0, Submitted: 0, Accepted: 0, Rejected: 0 };
    assignments.forEach((a: any) => {
      const st = a.status || 'Pending';
      counts[st] = (counts[st] || 0) + 1;
    });
    return counts;
  }, [assignments]);

  const summaryCards = [
    { title: 'Pending', count: statusCounts['Pending'] || 0, key: 'Pending' },
    { title: 'In Progress', count: statusCounts['In Progress'] || 0, key: 'In Progress' },
    { title: 'Submitted', count: statusCounts['Submitted'] || 0, key: 'Submitted' },
    { title: 'Approved', count: statusCounts['Accepted'] || 0, key: 'Approved' },
    { title: 'Needs Improvement', count: statusCounts['Rejected'] || 0, key: 'Needs Improvement' },
  ];

  // ─── Modal Handlers ──────────────────────────────────────────────
  const handleViewAssignment = (assign: any) => { setViewAssignment(assign); };
  const handleEditAssignment = (assign: any) => { setEditAssignment(assign); };
  const closeViewEditModals = () => { setViewAssignment(null); setEditAssignment(null); };

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
    } catch {}

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

    // External assignments are standalone — no Learning Path / Module / Lesson required
    if (isExternal) {
      if (formSelectedTrainees.length === 0) {
        alert('Select at least one trainee for an external assignment.');
        return;
      }
    } else {
      if (!formPathId) { alert('Learning Path is required for path-linked assignments.'); return; }
      if (!formModuleId) { alert('Module is required for path-linked assignments.'); return; }
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

      if (!isExternal) {
        payload.learningPathId = formPathId || undefined;
        payload.moduleId = formModuleId || undefined;
        payload.lessonId = formLessonId || undefined;
      }

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
    <div style={{ padding: '24px 32px', maxWidth: '1300px', margin: '0 auto', fontFamily: 'Inter, system-ui, sans-serif' }}>

      {/* ── TOP HEADER ── */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '28px' }}>
        <div>
          <h1 style={{ fontSize: '22px', fontWeight: 800, margin: 0, color: '#0f172a' }}>Assignments</h1>
          <p style={{ fontSize: '13px', color: '#64748b', margin: '4px 0 0 0' }}>
            Manage, assign, and evaluate trainee tasks
          </p>
        </div>
        <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
          {/* Pending reviews badge */}
          {pendingSubmissions.length > 0 && (
            <div
              style={{ display: 'flex', alignItems: 'center', gap: '8px', background: '#fef3c7', border: '1px solid #fde68a', borderRadius: '8px', padding: '8px 14px', cursor: 'pointer' }}
              onClick={() => setMainTab('evaluations')}
            >
              <span style={{ fontSize: '18px', fontWeight: 800, color: '#b45309' }}>
                {pendingSubmissions.length > 5 ? '5+' : pendingSubmissions.length}
              </span>
              <span style={{ fontSize: '12px', color: '#b45309', fontWeight: 600 }}>assignments submitted for review</span>
            </div>
          )}
          <button
            type="button"
            onClick={() => setShowNewModal(true)}
            style={{ background: 'linear-gradient(135deg, #6366f1, #4f46e5)', color: '#fff', border: 'none', borderRadius: '8px', padding: '10px 20px', fontWeight: 700, fontSize: '13px', cursor: 'pointer', boxShadow: '0 2px 8px rgba(99,102,241,0.35)' }}
          >
            + New Assignment
          </button>
        </div>
      </div>

      {/* ── MAIN TABS ── */}
      <div style={{ display: 'flex', gap: '4px', marginBottom: '24px', borderBottom: '2px solid #f1f5f9', paddingBottom: '0' }}>
        {[
          { key: 'assignments', label: 'All Assignments', count: assignments.length },
          { key: 'evaluations', label: 'Pending Reviews', count: pendingSubmissions.length },
        ].map(tab => (
          <button
            key={tab.key}
            type="button"
            onClick={() => setMainTab(tab.key as any)}
            style={{
              padding: '10px 20px', border: 'none', background: 'none', cursor: 'pointer',
              fontWeight: mainTab === tab.key ? 700 : 500,
              fontSize: '13px',
              color: mainTab === tab.key ? '#4f46e5' : '#64748b',
              borderBottom: mainTab === tab.key ? '2px solid #4f46e5' : '2px solid transparent',
              marginBottom: '-2px',
              display: 'flex', alignItems: 'center', gap: '8px',
            }}
          >
            {tab.label}
            {tab.count > 0 && (
              <span style={{
                background: mainTab === tab.key ? '#ede9fe' : '#f1f5f9',
                color: mainTab === tab.key ? '#4f46e5' : '#64748b',
                borderRadius: '9999px', padding: '1px 8px', fontSize: '11px', fontWeight: 700,
              }}>
                {tab.count > 5 ? '5+' : tab.count}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* ═══ TAB 1: ASSIGNMENTS ═══ */}
      {mainTab === 'assignments' && (
        <>
          {/* SUMMARY CARDS */}
          <div style={{ display: 'flex', gap: '16px', marginBottom: '24px' }}>
            {summaryCards.map((card) => (
              <div 
                key={card.key} 
                onClick={() => setStatusFilter(card.key)}
                style={{ 
                  flex: 1, background: statusFilter === card.key ? '#f0f9ff' : '#fff', padding: '16px 20px', 
                  borderRadius: '12px', border: statusFilter === card.key ? '1px solid #bae6fd' : '1px solid #e2e8f0', 
                  boxShadow: '0 1px 3px rgba(0,0,0,0.02)', cursor: 'pointer', transition: '0.2s' 
                }}
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
              style={{ flex: 1, background: statusFilter === 'All' ? '#f0f9ff' : '#fff', padding: '16px 20px', borderRadius: '12px', border: statusFilter === 'All' ? '1px solid #bae6fd' : '1px solid #e2e8f0', cursor: 'pointer' }}
            >
              <div style={{ fontSize: '13px', color: '#64748b', fontWeight: 500 }}>All Assignments</div>
              <div style={{ fontSize: '28px', fontWeight: 800, color: '#0f172a', marginTop: '8px' }}>{assignments.length}</div>
            </div>
          </div>

          {/* Assignment cards */}
          {isLoadingAssignments ? (
            <div style={{ textAlign: 'center', padding: '40px', color: '#94a3b8' }}>Loading assignments...</div>
          ) : filteredAssignments.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '60px', background: '#f8fafc', borderRadius: '12px', border: '2px dashed #e2e8f0' }}>
              <div style={{ fontSize: '32px', marginBottom: '12px' }}>📋</div>
              <div style={{ fontWeight: 700, color: '#475569' }}>No assignments found</div>
              <div style={{ fontSize: '13px', color: '#94a3b8', marginTop: '4px' }}>Create a new assignment to get started</div>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              {filteredAssignments.map((assign: any) => {
                const statusKey = assign.status || 'Pending';
                const sc = STATUS_COLORS[statusKey] || STATUS_COLORS.Pending;
                const pc = PRIORITY_COLORS[assign.priority || 'Medium'] || PRIORITY_COLORS.Medium;
                const trainee = assign.trainee || assign.assignedTo;
                const traineeName = trainee
                  ? `${trainee.firstName || ''} ${trainee.lastName || ''}`.trim() || trainee.email || 'Unknown'
                  : assign.traineeIds?.length ? `${assign.traineeIds.length} trainees` : 'Unassigned';

                return (
                  <div key={assign.id} style={{ background: '#fff', border: '1px solid #f1f5f9', borderRadius: '10px', padding: '16px 20px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', boxShadow: '0 1px 4px rgba(0,0,0,0.04)', transition: 'box-shadow 0.2s' }}>
                    
                    {/* LEFT SIDE: Task Details */}
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

                      {/* Action Buttons — Edit only for creator or Admin */}
                      <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                        <button 
                          type="button" 
                          onClick={() => handleViewAssignment(assign)}
                          style={{ padding: '6px 12px', fontSize: '12px', background: '#f0f9ff', color: '#0284c7', border: 'none', borderRadius: '4px', cursor: 'pointer', fontWeight: 600, transition: '0.2s' }}
                        >
                          👁️ View
                        </button>
                        
                        {(() => {
                          const creatorId = assign.createdBy?.id || assign.createdById;
                          const role = String(currentUser?.role || currentUser?.primaryRole || '').toLowerCase();
                          const isAdmin = role === 'admin';
                          const isCreator =
                            creatorId &&
                            currentUser?.id &&
                            String(creatorId).toLowerCase() === String(currentUser.id).toLowerCase();
                          if (!isAdmin && !isCreator) return null;
                          return (
                        <button 
                          type="button" 
                          onClick={() => handleEditAssignment(assign)}
                          style={{ padding: '6px 12px', fontSize: '12px', background: '#fef3c7', color: '#d97706', border: 'none', borderRadius: '4px', cursor: 'pointer', fontWeight: 600, transition: '0.2s' }}
                        >
                          ✏️ Edit
                        </button>
                          );
                        })()}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </>
      )}

      {/* ═══ TAB 2: EVALUATIONS ═══ */}
      {mainTab === 'evaluations' && (
        <>
          <div style={{ marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '10px' }}>
            <span style={{ fontWeight: 700, fontSize: '15px', color: '#0f172a' }}>Pending Trainee Evaluations</span>
            {pendingSubmissions.length > 0 && (
              <span style={{ background: '#fef3c7', color: '#b45309', border: '1px solid #fde68a', borderRadius: '9999px', padding: '2px 10px', fontSize: '12px', fontWeight: 700 }}>
                {pendingSubmissions.length > 5 ? '5+' : pendingSubmissions.length} awaiting review
              </span>
            )}
          </div>

          {isLoadingSubmissions ? (
            <div style={{ textAlign: 'center', padding: '40px', color: '#94a3b8' }}>Loading submissions...</div>
          ) : pendingSubmissions.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '60px', background: '#f8fafc', borderRadius: '12px', border: '2px dashed #e2e8f0' }}>
              <div style={{ fontSize: '32px', marginBottom: '12px' }}>✅</div>
              <div style={{ fontWeight: 700, color: '#475569' }}>All caught up!</div>
              <div style={{ fontSize: '13px', color: '#94a3b8', marginTop: '4px' }}>No pending submissions to evaluate.</div>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              {pendingSubmissions.map((sub: any) => (
                <div key={sub.id} style={{ border: '1px solid #e2e8f0', padding: '16px 20px', borderRadius: '10px', background: '#fff', display: 'flex', justifyContent: 'space-between', alignItems: 'center', boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }}>
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
                    style={{ padding: '8px 18px', background: 'linear-gradient(135deg,#4f46e5,#6366f1)', color: '#fff', border: 'none', borderRadius: '8px', cursor: 'pointer', fontWeight: 700, fontSize: '13px', boxShadow: '0 2px 6px rgba(99,102,241,0.3)' }}
                  >
                    Review & Grade
                  </button>
                </div>
              ))}
            </div>
          )}
        </>
      )}

      {/* ═══ VIEW ASSIGNMENT MODAL ═══ */}
      {viewAssignment && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(15,23,42,0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, backdropFilter: 'blur(4px)' }}>
          <div style={{ background: '#fff', width: '560px', padding: '24px', borderRadius: '16px', maxHeight: '90vh', overflowY: 'auto', boxShadow: '0 25px 80px rgba(0,0,0,0.2)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px', borderBottom: '1px solid #f1f5f9', pb: '12px' }}>
              <div>
                <h3 style={{ margin: 0, fontSize: '18px', fontWeight: 800, color: '#0f172a' }}>{viewAssignment.title}</h3>
                <span style={{ fontSize: '11px', color: '#64748b', fontWeight: 600 }}>Type: {viewAssignment.assignmentType || 'Subjective'} · Max Score: {viewAssignment.maxScore || 100} pts</span>
              </div>
              <button onClick={closeViewEditModals} style={{ background: '#f1f5f9', border: 'none', borderRadius: '8px', width: '32px', height: '32px', cursor: 'pointer', fontSize: '16px', color: '#64748b' }}>✖</button>
            </div>
            
            <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              {viewAssignment.dueDate && (
                <div style={{ fontSize: '12px', color: '#475569' }}>
                  <strong>Due Date:</strong> {new Date(viewAssignment.dueDate).toLocaleDateString()}
                </div>
              )}

              {viewAssignment.externalUrl && (
                <div style={{ fontSize: '12px' }}>
                  <strong>External Link:</strong> <a href={viewAssignment.externalUrl} target="_blank" rel="noreferrer" style={{ color: '#2563eb', fontWeight: 600 }}>{viewAssignment.externalUrl}</a>
                </div>
              )}
              
              {viewAssignment.instructions && (
                <div style={{ background: '#f0f9ff', border: '1px solid #bae6fd', borderRadius: '10px', padding: '12px' }}>
                  <div style={{ fontSize: '11px', fontWeight: 700, color: '#0369a1', textTransform: 'uppercase', marginBottom: '4px' }}>Instructions</div>
                  <p style={{ fontSize: '13px', color: '#0c4a6e', margin: 0 }}>{viewAssignment.instructions}</p>
                </div>
              )}

              {/* Questions List */}
              {viewAssignment.mcqConfig?.questions?.length > 0 && (
                <div style={{ background: '#f8fafc', padding: '14px', borderRadius: '10px', border: '1px solid #e2e8f0' }}>
                  <strong style={{ fontSize: '13px', color: '#1e293b', display: 'block', marginBottom: '8px' }}>Assignment Questions:</strong>
                  {viewAssignment.mcqConfig.questions.map((q: any, qIdx: number) => (
                    <div key={qIdx} style={{ background: '#fff', padding: '10px 12px', borderRadius: '8px', border: '1px solid #e2e8f0', marginBottom: '8px' }}>
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
              )}
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '20px', paddingTop: '12px', borderTop: '1px solid #f1f5f9' }}>
              <button onClick={closeViewEditModals} style={{ padding: '8px 20px', background: '#f1f5f9', border: 'none', borderRadius: '10px', cursor: 'pointer', fontWeight: 600, fontSize: '13px', color: '#475569' }}>
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ═══ EDIT ASSIGNMENT MODAL ═══ */}
      {editAssignment && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}>
          <div style={{ background: '#fff', width: '500px', padding: '24px', borderRadius: '12px', maxHeight: '90vh', overflowY: 'auto' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
              <h3 style={{ margin: '0' }}>Edit Assignment</h3>
              <button onClick={closeViewEditModals} style={{ background: 'none', border: 'none', fontSize: '16px', cursor: 'pointer' }}>✖</button>
            </div>
            
            <div style={{ background: '#fefce8', padding: '16px', borderRadius: '8px', border: '1px solid #fef08a', marginBottom: '20px' }}>
              <p style={{ fontSize: '13px', color: '#854d0e', margin: 0 }}>
                Editing functionality requires specific mapping. Currently editing ID: <strong>{editAssignment.id}</strong> - <strong>{editAssignment.title}</strong>
              </p>
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px' }}>
              <button onClick={closeViewEditModals} style={{ padding: '8px 16px', background: '#cbd5e1', border: 'none', borderRadius: '6px', cursor: 'pointer', fontWeight: 600 }}>Cancel</button>
              <button 
                onClick={() => {
                  alert('Changes saved (Mock action)');
                  closeViewEditModals();
                }} 
                style={{ padding: '8px 16px', background: '#2563eb', color: '#fff', border: 'none', borderRadius: '6px', cursor: 'pointer', fontWeight: 600 }}
              >
                Save Changes
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ═══ EVALUATION MODAL ═══ */}
      {selectedSub && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(15,23,42,0.55)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, backdropFilter: 'blur(4px)' }}>
          <div style={{ background: '#fff', width: '640px', padding: '28px', borderRadius: '16px', maxHeight: '90vh', overflowY: 'auto', boxShadow: '0 20px 60px rgba(0,0,0,0.18)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '16px' }}>
              <div>
                <h3 style={{ margin: 0, fontSize: '18px', fontWeight: 800, color: '#0f172a' }}>Evaluate: {selectedSub.assignment?.title}</h3>
                <p style={{ fontSize: '12px', color: '#64748b', margin: '4px 0 0 0' }}>Trainee: {selectedSub.trainee?.firstName} ({selectedSub.trainee?.email})</p>
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

              {/* Assignment Type first so External can skip path linking */}
              <div>
                <label style={{ display: 'block', fontSize: '12px', fontWeight: 700, color: '#374151', marginBottom: '6px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Assignment Type</label>
                <select
                  value={formAssignmentType}
                  onChange={e => {
                    const next = e.target.value as 'Subjective' | 'MCQ' | 'External';
                    setFormAssignmentType(next);
                    if (next === 'External') {
                      setFormPathId('');
                      setFormModuleId('');
                      setFormLessonId('');
                    }
                  }}
                  style={{ width: '100%', padding: '10px 14px', borderRadius: '10px', border: '1.5px solid #e2e8f0', fontSize: '13px', background: '#fff', cursor: 'pointer', outline: 'none' }}
                >
                  <option value="Subjective">Subjective (Learning Path)</option>
                  <option value="MCQ">MCQ (Learning Path)</option>
                  <option value="External">External Assignment (no Learning Path)</option>
                </select>
                {formAssignmentType === 'External' && (
                  <p style={{ margin: '6px 0 0', fontSize: 12, color: '#64748b' }}>
                    External assignments are assigned directly to trainees and appear separately from Learning Path tasks.
                  </p>
                )}
              </div>

              {/* Path / Module / Lesson — only for curriculum-linked assignments */}
              {formAssignmentType !== 'External' && (
                <>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                    <div>
                      <label style={{ display: 'block', fontSize: '12px', fontWeight: 700, color: '#374151', marginBottom: '6px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Learning Path *</label>
                      <select
                        required
                        value={formPathId} onChange={e => setFormPathId(e.target.value)}
                        style={{ width: '100%', padding: '10px 14px', borderRadius: '10px', border: '1.5px solid #e2e8f0', fontSize: '13px', background: '#fff', cursor: 'pointer', outline: 'none' }}
                      >
                        <option value="">Select a path...</option>
                        {learningPaths.map((p: any) => <option key={p.id} value={p.id}>{p.title || p.name}</option>)}
                      </select>
                    </div>
                    <div>
                      <label style={{ display: 'block', fontSize: '12px', fontWeight: 700, color: '#374151', marginBottom: '6px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Module *</label>
                      <select
                        required
                        disabled={!formPathId}
                        value={formModuleId} onChange={e => { setFormModuleId(e.target.value); setFormLessonId(''); }}
                        style={{ width: '100%', padding: '10px 14px', borderRadius: '10px', border: '1.5px solid #e2e8f0', fontSize: '13px', background: formPathId ? '#fff' : '#f1f5f9', cursor: formPathId ? 'pointer' : 'not-allowed', outline: 'none' }}
                      >
                        <option value="">{formPathId ? 'Select a module...' : 'Select path first'}</option>
                        {pathModules.map((m: any) => <option key={m.id} value={m.id}>{m.title}</option>)}
                      </select>
                    </div>
                  </div>

                  <div>
                    <label style={{ display: 'block', fontSize: '12px', fontWeight: 700, color: '#374151', marginBottom: '6px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Lesson (Optional)</label>
                    <select
                      disabled={!formModuleId}
                      value={formLessonId} onChange={e => setFormLessonId(e.target.value)}
                      style={{ width: '100%', padding: '10px 14px', borderRadius: '10px', border: '1.5px solid #e2e8f0', fontSize: '13px', background: formModuleId ? '#fff' : '#f1f5f9', cursor: formModuleId ? 'pointer' : 'not-allowed', outline: 'none' }}
                    >
                      <option value="">{formModuleId ? 'Module level (No specific lesson)' : 'Select module first'}</option>
                      {availableLessons.map((l: any) => <option key={l.id} value={l.id}>{l.title}</option>)}
                    </select>
                  </div>
                </>
              )}

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
                    <div style={{ padding: '16px', textAlign: 'center', color: '#94a3b8' }}>No trainees found. Select a learning path above.</div>
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