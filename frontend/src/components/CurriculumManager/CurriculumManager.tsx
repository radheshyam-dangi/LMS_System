import React, { useState, useEffect, useCallback } from 'react';
import { curriculumService } from '../../services/curriculumService';
import { learningPathService } from '../../services/learningPathService';
import { userService } from '../../services/userService';
import { useNavigate } from 'react-router-dom';
import { RichText } from '../common/RichText';
import './CurriculumManager.css';

interface CurriculumManagerProps {
  learningPathId: string;
  learningPathTitle: string;
  currentUser: { id: string; role: 'Admin' | 'Trainer' | 'Trainee' };
  accessToken: string;
  onBack: () => void;
}

export function CurriculumManager({
  learningPathId,
  learningPathTitle,
  currentUser,
  accessToken,
  onBack,
}: CurriculumManagerProps) {
  const [modules, setModules] = useState<any[]>([]);
  const [trainees, setTrainees] = useState<any[]>([]);
  const [pathDetails, setPathDetails] = useState<any | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const navigate = useNavigate();

  // Active Modals
  const [activeModal, setActiveModal] = useState<
    'MODULE' | 'LESSON' | 'TASK' | 'EDIT_MODULE' | 'EDIT_LESSON' | 'EDIT_TASK' | 'VIEW_INSPECTOR' | null
  >(null);

  const [targetModuleId, setTargetModuleId] = useState<string | null>(null);
  const [targetLessonId, setTargetLessonId] = useState<string | null>(null);
  const [editingItemId, setEditingItemId] = useState<string | null>(null);

  const [inspectItem, setInspectItem] = useState<{ type: 'MODULE' | 'LESSON' | 'TASK'; data: any } | null>(null);

  // General Form State
  const [formTitle, setFormTitle] = useState('');
  const [formDescription, setFormDescription] = useState('');
  const [formVideoUrl, setFormVideoUrl] = useState('');
  const [formArticleUrl, setFormArticleUrl] = useState('');
  const [formDurationMinutes, setFormDurationMinutes] = useState<number>(15);
  const [formObjectives, setFormObjectives] = useState('');
  const [formOutcomes, setFormOutcomes] = useState('');
  const [formDurationWeeks, setFormDurationWeeks] = useState<number>(2);
  const [formResourceUrl, setFormResourceUrl] = useState<string>('');
  const [formModuleLessonLocking, setFormModuleLessonLocking] = useState<boolean>(false);
  const [formModuleTaskLocking, setFormModuleTaskLocking] = useState<boolean>(false);

  // Task Form State
  const [formAssignmentType, setFormAssignmentType] = useState<'Subjective' | 'MCQ' | 'External'>('Subjective');
  const [formInstructions, setFormInstructions] = useState('');
  const [formDueDate, setFormDueDate] = useState('');
  const [formExternalUrl, setFormExternalUrl] = useState('');
  const [formAssignedTraineeId, setFormAssignedTraineeId] = useState<string>('');
  const [formTaskDurationDays, setFormTaskDurationDays] = useState<number>(0);
  const [formTaskAnchorType, setFormTaskAnchorType] = useState<string>('LP_ASSIGNED');
  const [formTaskDurationHours, setFormTaskDurationHours] = useState<number>(0);
  const [formTaskDurationMinutes, setFormTaskDurationMinutes] = useState<number>(0);

  // Dynamic Questions State
  const [subjectiveQuestions, setSubjectiveQuestions] = useState<any[]>([
    { id: 'sub-1', questionText: '', maxPoints: 10, dependentLessonIds: [] },
  ]);
  const [mcqQuestions, setMcqQuestions] = useState<any[]>([
    { id: 'mcq-1', questionText: '', options: ['Option 1', 'Option 2', 'Option 3', 'Option 4'], correctIndex: 0, points: 10 },
  ]);

  const [isSubmitting, setIsSubmitting] = useState(false);

  // 🌟 FETCH PATH, MODULES, & TRAINEES
  const loadCurriculum = useCallback(async () => {
    setIsLoading(true);
    try {
      const [pathData, modulesData, usersData] = await Promise.all([
        learningPathService?.fetchPathById ? learningPathService.fetchPathById(learningPathId, accessToken) : Promise.resolve(null),
        curriculumService.fetchModulesByPath(learningPathId, accessToken),
        userService.fetchAllUsers(accessToken).catch(() => [])
      ]);

      if (pathData) setPathDetails(pathData);
      setModules(modulesData || []);

      if (modulesData && modulesData.length > 0 && modulesData[0].learningPath && !pathData) {
        setPathDetails(modulesData[0].learningPath);
      }

      // Filter for Trainees only
      const traineeList = (usersData || []).filter((u: any) => {
        const roles = [u.role, u.primaryRole?.name, ...(Array.isArray(u.roles) ? u.roles.map((r: any) => r.name || r) : [])].map(r => String(r || '').toLowerCase());
        return roles.includes('trainee');
      });
      setTrainees(traineeList);

    } catch (err: any) {
      console.error('Curriculum loading error:', err.message);
    } finally {
      setIsLoading(false);
    }
  }, [learningPathId, accessToken]);

  useEffect(() => {
    loadCurriculum();
  }, [loadCurriculum]);

  // 🌟 OWNERSHIP CHECK — trainers and admins have management access; trainees view-only
  const isAdmin = currentUser.role === 'Admin' || String(currentUser.role).toLowerCase() === 'admin';
  const isTrainer = currentUser.role === 'Trainer' || String(currentUser.role).toLowerCase() === 'trainer';
  const isTrainee = currentUser.role === 'Trainee' || String(currentUser.role).toLowerCase() === 'trainee';

  const pathOwnerId = pathDetails?.createdBy?.id || (typeof pathDetails?.createdBy === 'string' ? pathDetails.createdBy : null) || pathDetails?.createdById;
  const currentUserId = currentUser.id;
  const isOwner = !pathOwnerId || (Boolean(pathOwnerId) && String(pathOwnerId).toLowerCase() === String(currentUserId).toLowerCase());
  const isOwnerOrAdmin = !isTrainee && (isAdmin || isOwner);

  const resetFormFields = () => {
    setFormTitle('');
    setFormDescription('');
    setFormVideoUrl('');
    setFormArticleUrl('');
    setFormDurationMinutes(15);
    setFormAssignmentType('Subjective');
    setFormInstructions('');
    setFormDueDate('');
    setFormExternalUrl('');
    setFormAssignedTraineeId('');
    setFormTaskDurationDays(0);
    setFormTaskAnchorType('LP_ASSIGNED');
    setFormTaskDurationHours(0);
    setFormTaskDurationMinutes(0);
    setSubjectiveQuestions([{ id: 'sub-1', questionText: '', maxPoints: 10, dependentLessonIds: [] }]);
    setMcqQuestions([{ id: 'mcq-1', questionText: '', options: ['Option 1', 'Option 2', 'Option 3', 'Option 4'], correctIndex: 0, points: 10 }]);
    setActiveModal(null);
    setEditingItemId(null);
    setInspectItem(null);
    setTargetModuleId(null);
    setTargetLessonId(null);
    setFormModuleLessonLocking(false);
    setFormModuleTaskLocking(false);
  };

  const openInspector = (type: 'MODULE' | 'LESSON' | 'TASK', data: any) => {
    setInspectItem({ type, data });
    setActiveModal('VIEW_INSPECTOR');
  };

  const openEditModuleModal = (module: any) => {
    if (!isOwnerOrAdmin) return;
    setEditingItemId(module.id);
    setFormTitle(module.title || '');
    setFormDescription(module.description || '');
    const obj = Array.isArray(module.objectives) ? module.objectives.join('\n') : (module.objectives || '');
    setFormObjectives(obj);
    const out = Array.isArray(module.outcomes) ? module.outcomes.join('\n') : (module.outcomes || '');
    setFormOutcomes(out);
    setFormDurationWeeks(module.durationWeeks || 2);
    setFormResourceUrl(module.resources?.[0]?.url || '');
    setFormModuleLessonLocking(module.lessonLocking || false);
    setFormModuleTaskLocking(module.taskLocking || false);
    setActiveModal('EDIT_MODULE');
  };

  const openEditLessonModal = (lesson: any) => {
    if (!isOwnerOrAdmin) return;
    setEditingItemId(lesson.id);
    setFormTitle(lesson.title || '');
    setFormDescription(lesson.description || '');
    setFormVideoUrl(lesson.videoUrl || '');
    setFormArticleUrl(lesson.articleUrl || '');
    setFormDurationMinutes(lesson.durationMinutes || 15);
    setActiveModal('EDIT_LESSON');
  };

  const openEditTaskModal = (task: any, parentModuleId?: string, parentLessonId?: string) => {
    if (!isOwnerOrAdmin) return;
    setEditingItemId(task.id);
    setFormTitle(task.title || '');
    setFormInstructions(task.instructions || '');
    setFormAssignmentType(task.assignmentType || 'Subjective');
    setFormDueDate(''); // Due Date removed
    setFormExternalUrl(task.externalUrl || '');
    setFormAssignedTraineeId(task.assignedToId || task.traineeId || '');
    setFormTaskDurationDays(task.durationDays || 0);
    const anchor = task.anchorType || 'LP_ASSIGNED';
    const mappedAnchor = ['MODULE_UNLOCK', 'PREVIOUS_TASK_SUBMIT', 'TASK_START', 'ASSIGNMENT'].includes(anchor) 
      ? 'TASK_UNLOCKED' 
      : anchor;
    setFormTaskAnchorType(mappedAnchor);
    setFormTaskDurationHours(task.durationHours || 0);
    setFormTaskDurationMinutes(task.durationMinutes || 0);
    
    const modId = parentModuleId || task.moduleId || task.module?.id || task.lesson?.moduleId || task.lesson?.module?.id || "";
    setTargetModuleId(String(modId));
    setTargetLessonId(parentLessonId || task.lessonId || task.lesson?.id || null);

    const questions = task.mcqConfig?.questions || [];

    if (questions.length > 0) {
      const normalizedQuestions = questions.map((q: any, idx: number) => ({
        id: q.id || `q-${idx}`,
        questionText: q.questionText || q.question || '',
        question: q.questionText || q.question || '',
        options: q.options && q.options.length > 0 ? q.options : ['Option 1', 'Option 2', 'Option 3', 'Option 4'],
        correctIndex: q.correctIndex ?? 0,
        points: q.points || q.maxPoints || 10,
        maxPoints: q.maxPoints || q.points || 10,
      }));

      if (task.assignmentType === 'MCQ') {
        setMcqQuestions(normalizedQuestions);
      } else {
        setSubjectiveQuestions(normalizedQuestions);
      }
    } else {
      setMcqQuestions([{ id: 'mcq-1', questionText: '', question: '', options: ['Option 1', 'Option 2', 'Option 3', 'Option 4'], correctIndex: 0, points: 10 }]);
      setSubjectiveQuestions([{ id: 'sub-1', questionText: '', question: '', maxPoints: 10 }]);
    }

    setActiveModal('EDIT_TASK');
  };

  const handleDeleteModule = async (moduleId: string) => {
    if (!isOwnerOrAdmin) return;
    if (!window.confirm('Are you sure you want to delete this module and all nested lessons?')) return;
    try {
      await curriculumService.deleteModule(moduleId, accessToken);
      await loadCurriculum();
    } catch (err: any) {
      alert(err.message || 'Failed to delete module.');
    }
  };

  const handleDeleteLesson = async (lessonId: string) => {
    if (!isOwnerOrAdmin) return;
    if (!window.confirm('Are you sure you want to delete this lesson and its assignments?')) return;
    try {
      await curriculumService.deleteLesson(lessonId, accessToken);
      await loadCurriculum();
    } catch (err: any) {
      alert(err.message || 'Failed to delete lesson.');
    }
  };

  const handleDeleteTask = async (taskId: string) => {
    if (!isOwnerOrAdmin) return;
    if (!window.confirm('Are you sure you want to delete this task?')) return;
    try {
      await curriculumService.deleteTask(taskId, accessToken);
      await loadCurriculum();
    } catch (err: any) {
      alert(err.message || 'Failed to delete task.');
    }
  };

  const handleFormSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isOwnerOrAdmin || !formTitle.trim() || isSubmitting) return;

    setIsSubmitting(true);
    try {
      if (activeModal === 'MODULE') {
        const resources = formResourceUrl.trim() ? [{ title: 'Resource', url: formResourceUrl.trim() }] : [];
        await curriculumService.createModule({
          title: formTitle,
          description: formDescription,
          learningPathId,
          objectives: formObjectives,
          outcomes: formOutcomes,
          durationWeeks: formDurationWeeks,
          durationLabel: `${formDurationWeeks} weeks`,
          lessonLocking: formModuleLessonLocking,
          taskLocking: formModuleTaskLocking,
          resources,
        }, accessToken);
      } else if (activeModal === 'EDIT_MODULE' && editingItemId) {
        const resources = formResourceUrl.trim() ? [{ title: 'Resource', url: formResourceUrl.trim() }] : [];
        await curriculumService.updateModule(editingItemId, {
          title: formTitle,
          description: formDescription,
          objectives: formObjectives,
          outcomes: formOutcomes,
          durationWeeks: formDurationWeeks,
          durationLabel: `${formDurationWeeks} weeks`,
          lessonLocking: formModuleLessonLocking,
          taskLocking: formModuleTaskLocking,
          resources,
        }, accessToken);
      } else if (activeModal === 'LESSON') {
        if (!targetModuleId) {
          alert('Module ID missing. Please click "+ Add Lesson" directly inside a module.');
          setIsSubmitting(false);
          return;
        }
        await curriculumService.createLesson({
          title: formTitle,
          description: formDescription,
          videoUrl: formVideoUrl || undefined,
          articleUrl: formArticleUrl || undefined,
          durationMinutes: Number(formDurationMinutes) || 15,
          moduleId: targetModuleId,
        }, accessToken);
      } else if (activeModal === 'EDIT_LESSON' && editingItemId) {
        await curriculumService.updateLesson(editingItemId, {
          title: formTitle,
          description: formDescription,
          videoUrl: formVideoUrl,
          articleUrl: formArticleUrl,
          durationMinutes: Number(formDurationMinutes),
        }, accessToken);
      } else if (activeModal === 'TASK' || activeModal === 'EDIT_TASK') {
        const isExternal = formAssignmentType === 'External';

        if (!isExternal && !targetLessonId && (!targetModuleId || targetModuleId === "")) {
          alert('Please select a Target Module for this assignment.');
          setIsSubmitting(false);
          return;
        }

        if (isExternal && !formAssignedTraineeId) {
          alert('Select a trainee for an external assignment.');
          setIsSubmitting(false);
          return;
        }

        let calculatedMaxScore = 100;
        if (formAssignmentType === 'MCQ') {
          calculatedMaxScore = mcqQuestions.reduce((acc, q) => acc + (Number(q.points) || 10), 0);
        } else if (formAssignmentType === 'Subjective') {
          calculatedMaxScore = subjectiveQuestions.reduce((acc, q) => acc + (Number(q.maxPoints) || 10), 0);
        }

        const payload: any = {
          title: formTitle,
          instructions: formInstructions,
          assignmentType: formAssignmentType,
          externalUrl: isExternal ? formExternalUrl : undefined,
          maxScore: calculatedMaxScore,
          dueDate: formDueDate || undefined,
          durationDays: formTaskDurationDays,
          durationHours: formTaskDurationHours,
          durationMinutes: formTaskDurationMinutes,
          anchorType: formTaskAnchorType,
          sequenceIndex: null, // sequenceIndex logic handled via drag/drop or backend
          traineeIds: formAssignedTraineeId ? [formAssignedTraineeId] : [],
          mcqConfig: isExternal
            ? undefined
            : {
                questions:
                  formAssignmentType === 'MCQ'
                    ? mcqQuestions
                    : formAssignmentType === 'Subjective'
                      ? subjectiveQuestions
                      : [],
              },
        };

        if (!isExternal) {
          payload.lessonId = targetLessonId ?? undefined;
          payload.moduleId = targetModuleId ?? undefined;
          payload.learningPathId = learningPathId;
        }

        if (activeModal === 'EDIT_TASK' && editingItemId) {
          await curriculumService.updateTask(editingItemId, payload, accessToken);
        } else {
          await curriculumService.createTask(payload, accessToken);
        }
      }

      resetFormFields();
      await loadCurriculum();
    } catch (err: any) {
      const msg = err.response?.data?.message || err.message || 'Operation failed.';
      alert(`Error: ${msg}`);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="cm-container">
      <button type="button" onClick={onBack} className="cm-btn-back">
        ← Back to All Learning Paths
      </button>

      <header className="cm-header-section">
        <div>
          <h2 className="cm-header-title">Curriculum Management: {learningPathTitle}</h2>
          <p className="cm-header-subtitle">
            {isOwnerOrAdmin
              ? 'Manage modules, lessons, and external assignments for this learning path.'
              : 'Read-Only Mode: View and inspect internal modules, lessons, and tasks.'}
          </p>
        </div>

        {isOwnerOrAdmin && (
          <div>
            <button type="button" onClick={() => navigate(`/learning-paths/${learningPathId}/edit`)} className="cm-btn-primary">
              ✏️ Edit Learning Path
            </button>
          </div>
        )}
      </header>

      {isLoading ? (
        <div>Loading curriculum tree...</div>
      ) : modules.length === 0 ? (
        <div className="cm-empty-state">
          <p>No modules created yet.</p>
          {/* Add module button removed - use LPEditorPage instead */}
        </div>
      ) : (
        modules.map((module, mIdx) => (
          <div key={module.id} className="cm-module-card">
            <div className="cm-module-header">
              <h3 className="cm-module-title">Module {mIdx + 1}: {module.title}</h3>

              <div className="cm-actions-cluster">
                <button type="button" onClick={() => openInspector('MODULE', module)} className="cm-btn-sm cm-btn-view">
                  👁️ View Details
                </button>

                {/* Edit/Delete module buttons removed - use LPEditorPage instead */}
              </div>
            </div>

            <p className="cm-module-description">{module.description || 'No module description.'}</p>

            {/* MODULE-LEVEL ASSIGNMENTS */}
            {module.assignments?.filter((a: any) => !a.lessonId).length > 0 && (
              <div className="cm-module-assignments-box">
                <h4 className="cm-assignments-title">📌 Module-Level Assignments</h4>
                {module.assignments.filter((a: any) => !a.lessonId).map((task: any) => (
                  <div key={task.id} className="cm-task-item">
                    <div className="cm-task-info">
                      <strong>{task.title}</strong>
                      <span className="cm-task-meta">
                        Type: {task.assignmentType} | Due: {task.dueDate ? new Date(task.dueDate).toLocaleDateString() : 'No Due Date'}
                      </span>
                    </div>

                    <div className="cm-actions-cluster">
                      <button type="button" onClick={() => openInspector('TASK', task)} className="cm-btn-sm cm-btn-view">
                        👁️ View
                      </button>
                      {/* Edit/Delete task buttons removed - use LPEditorPage instead */}
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* LESSONS TREE */}
            <div className="cm-lesson-tree-wrapper">
              {module.lessons?.map((lesson: any, lIdx: number) => (
                <div key={lesson.id} className="cm-lesson-item">
                  <div className="cm-lesson-header">
                    <h4 className="cm-lesson-title">📖 Lesson {lesson.displayOrder || lIdx + 1}: {lesson.title}</h4>
                    <div className="cm-actions-cluster">
                      <button type="button" onClick={() => openInspector('LESSON', lesson)} className="cm-btn-sm cm-btn-view">
                        👁️ View
                      </button>

                      {/* Edit/Delete lesson buttons removed - use LPEditorPage instead */}
                    </div>
                  </div>

                  {lesson.description && <p className="cm-lesson-description">{lesson.description}</p>}

                  {/* TASKS LIST */}
                  {lesson.assignments?.map((task: any) => (
                    <div key={task.id} className="cm-lesson-task-item">
                      <div>
                        <strong>📝 {task.title}</strong>
                        <span className="cm-lesson-task-meta">
                          Type: {task.assignmentType} | Max Score: {task.maxScore} | Due: {task.dueDate ? new Date(task.dueDate).toLocaleDateString() : 'No Due Date'}
                        </span>
                      </div>

                      <div className="cm-actions-cluster">
                        <button type="button" onClick={() => openInspector('TASK', task)} className="cm-btn-sm cm-btn-view">
                          👁️ Context View
                        </button>
                        {/* Edit/Delete task buttons removed - use LPEditorPage instead */}
                      </div>
                    </div>
                  ))}
                </div>
              ))}
            </div>
          </div>
        ))
      )}

      {/* ✏️ CREATE / EDIT FORM MODAL */}
      {isOwnerOrAdmin && (activeModal === 'MODULE' || activeModal === 'EDIT_MODULE' || activeModal === 'LESSON' || activeModal === 'EDIT_LESSON' || activeModal === 'TASK' || activeModal === 'EDIT_TASK') && (
        <div className="cm-modal-overlay">
          <div className={`cm-modal-content ${(activeModal === 'TASK' || activeModal === 'EDIT_TASK') ? 'wide' : ''}`}>
            <h3>{activeModal.replace('_', ' ')}</h3>
            <form onSubmit={handleFormSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '16px', marginTop: '16px' }}>
              
              {/* 🌟 LEARNING PATH CONTEXT — skipped for External */}
              {activeModal.includes('TASK') && formAssignmentType !== 'External' && (
                 <div style={{ padding: '12px', background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '6px', marginBottom: '4px' }}>
                   <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, color: '#475569' }}>Target Learning Path *</label>
                   <input type="text" readOnly disabled value={learningPathTitle} style={{ width: '100%', padding: '8px', marginTop: '4px', borderRadius: '4px', border: '1px solid #cbd5e1', background: '#e2e8f0', cursor: 'not-allowed' }} />
                 </div>
              )}

              {/* 🌟 MODULE SELECTION — skipped for External */}
              {activeModal.includes('TASK') && formAssignmentType !== 'External' && !targetLessonId && (
                <div style={{ padding: '12px', background: '#fff', border: '1px solid #3b82f6', borderRadius: '6px', marginBottom: '8px' }}>
                  <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, color: '#1e3a8a' }}>Target Module *</label>
                  <select
                    required
                    value={targetModuleId || ''}
                    onChange={(e) => setTargetModuleId(e.target.value)}
                    style={{ width: '100%', padding: '8px', marginTop: '4px', borderRadius: '4px', border: '1px solid #93c5fd' }}
                  >
                    <option value="" disabled>-- Select the mandatory module for this assignment --</option>
                    {modules.map((m) => (
                      <option key={m.id} value={String(m.id)}>{m.title}</option>
                    ))}
                  </select>
                </div>
              )}

              {/* 🌟 TRAINEE SELECTION — only required for External assignments */}
              {activeModal.includes('TASK') && formAssignmentType === 'External' && (
                <div style={{ padding: '12px', background: '#fdf4ff', border: '1px solid #d8b4fe', borderRadius: '6px', marginBottom: '8px' }}>
                  <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, color: '#6b21a8' }}>
                    Assign To Trainee *
                  </label>
                  <select
                    required
                    value={formAssignedTraineeId}
                    onChange={(e) => setFormAssignedTraineeId(e.target.value)}
                    style={{ width: '100%', padding: '8px', marginTop: '4px', borderRadius: '4px', border: '1px solid #c4b5fd' }}
                  >
                    <option value="">-- Select trainee --</option>
                    {trainees.map((t) => (
                      <option key={t.id} value={t.id}>{t.firstName} {t.lastName} ({t.email})</option>
                    ))}
                  </select>
                </div>
              )}

              <div>
                <label style={{ display: 'block', fontSize: '13px', fontWeight: 600 }}>Title *</label>
                <input type="text" required value={formTitle} onChange={(e) => setFormTitle(e.target.value)} style={{ width: '100%', padding: '8px', marginTop: '4px', borderRadius: '4px', border: '1px solid #cbd5e1' }} />
              </div>

              {(activeModal.includes('MODULE') || activeModal.includes('LESSON')) && (
                <div>
                  <label style={{ display: 'block', fontSize: '13px', fontWeight: '600' }}>Description</label>
                  <textarea rows={3} value={formDescription} onChange={(e) => setFormDescription(e.target.value)} style={{ width: '100%', padding: '8px', marginTop: '4px', borderRadius: '4px', border: '1px solid #cbd5e1' }} />
                </div>
              )}

              {activeModal.includes('MODULE') && (
                <>
                  <div>
                    <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, color: '#4f46e5' }}>◎ Learning Objectives (One per line)</label>
                    <textarea rows={3} value={formObjectives} onChange={(e) => setFormObjectives(e.target.value)} placeholder="e.g. Understand RESTful architecture&#10;Design clean API endpoints" style={{ width: '100%', padding: '8px', marginTop: '4px', borderRadius: '4px', border: '1px solid #c7d2fe', background: '#f5f3ff' }} />
                  </div>
                  <div>
                    <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, color: '#16a34a' }}>✓ Learning Outcomes (One per line)</label>
                    <textarea rows={3} value={formOutcomes} onChange={(e) => setFormOutcomes(e.target.value)} placeholder="e.g. Build a functional REST API&#10;Secure endpoints with JWT" style={{ width: '100%', padding: '8px', marginTop: '4px', borderRadius: '4px', border: '1px solid #bbf7d0', background: '#f0fdf4' }} />
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                    <div>
                      <label style={{ display: 'block', fontSize: '13px', fontWeight: 600 }}>Duration (Weeks)</label>
                      <input type="number" min={1} max={52} value={formDurationWeeks} onChange={(e) => setFormDurationWeeks(Number(e.target.value) || 2)} style={{ width: '100%', padding: '8px', marginTop: '4px', borderRadius: '4px', border: '1px solid #cbd5e1' }} />
                    </div>
                  </div>
                  <div style={{ marginBottom: '16px' }}>
                    <label style={{ display: 'block', fontSize: '13px', fontWeight: 600 }}>Resource URL</label>
                    <input type="url" value={formResourceUrl} onChange={(e) => setFormResourceUrl(e.target.value)} placeholder="https://..." style={{ width: '100%', padding: '8px', marginTop: '4px', borderRadius: '4px', border: '1px solid #cbd5e1' }} />
                  </div>
                  {(() => {
                    const lpLessonLock = pathDetails?.lockLessons === true;
                    const lpTaskLock = pathDetails?.lockTasks === true;
                    if (lpLessonLock && lpTaskLock) return null;
                    return (
                      <div style={{ display: 'flex', gap: '24px', padding: '12px 16px', background: '#f8fafc', borderRadius: '4px', border: '1px solid #e2e8f0', marginBottom: '16px' }}>
                        {!lpLessonLock && (
                          <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', fontSize: '13px', fontWeight: 600, color: '#334155' }}>
                            <input type="checkbox" checked={formModuleLessonLocking} onChange={e => setFormModuleLessonLocking(e.target.checked)} style={{ width: '16px', height: '16px', cursor: 'pointer', accentColor: '#4f46e5' }} />
                            Lock Lessons (Sequential unlock)
                          </label>
                        )}
                        {!lpTaskLock && (
                          <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', fontSize: '13px', fontWeight: 600, color: '#334155' }}>
                            <input type="checkbox" checked={formModuleTaskLocking} onChange={e => setFormModuleTaskLocking(e.target.checked)} style={{ width: '16px', height: '16px', cursor: 'pointer', accentColor: '#4f46e5' }} />
                            Lock Tasks (Require all lessons)
                          </label>
                        )}
                      </div>
                    );
                  })()}
                </>
              )}

              {activeModal.includes('LESSON') && (
                <>
                  <div>
                    <label style={{ display: 'block', fontSize: '13px', fontWeight: 600 }}>Video URL</label>
                    <input
                      type="url"
                      value={formVideoUrl}
                      onChange={(e) => setFormVideoUrl(e.target.value)}
                      placeholder="https://..."
                      style={{ width: '100%', padding: '8px', marginTop: '4px', borderRadius: '4px', border: '1px solid #cbd5e1' }}
                    />
                  </div>
                  <div>
                    <label style={{ display: 'block', fontSize: '13px', fontWeight: 600 }}>Article URL</label>
                    <input
                      type="url"
                      value={formArticleUrl}
                      onChange={(e) => setFormArticleUrl(e.target.value)}
                      placeholder="https://..."
                      style={{ width: '100%', padding: '8px', marginTop: '4px', borderRadius: '4px', border: '1px solid #cbd5e1' }}
                    />
                  </div>
                  <div>
                    <label style={{ display: 'block', fontSize: '13px', fontWeight: 600 }}>Duration (minutes)</label>
                    <input
                      type="number"
                      min={1}
                      value={formDurationMinutes}
                      onChange={(e) => setFormDurationMinutes(Number(e.target.value) || 15)}
                      style={{ width: '100%', padding: '8px', marginTop: '4px', borderRadius: '4px', border: '1px solid #cbd5e1' }}
                    />
                  </div>
                </>
              )}

              {activeModal.includes('TASK') && (
                <>
                  <div>
                    <label style={{ display: 'block', fontSize: '13px', fontWeight: 600 }}>Evaluation Mode</label>
                    <select value={formAssignmentType} onChange={(e) => setFormAssignmentType(e.target.value as 'Subjective' | 'MCQ')} style={{ width: '100%', padding: '8px', marginTop: '4px', borderRadius: '4px', border: '1px solid #cbd5e1' }}>
                      <option value="Subjective">📝 Subjective Questions</option>
                      <option value="MCQ">🔘 Multiple Choice Quiz (MCQ)</option>
                    </select>
                  </div>

                  <div>
                    <label style={{ display: 'block', fontSize: '13px', fontWeight: 600 }}>Instructions / Description</label>
                    <textarea rows={2} value={formInstructions} onChange={(e) => setFormInstructions(e.target.value)} placeholder="Provide instructions for this task..." style={{ width: '100%', padding: '8px', marginTop: '4px', borderRadius: '4px', border: '1px solid #cbd5e1' }} />
                  </div>

                  {/* MCQ QUESTIONS BUILDER */}
                  {formAssignmentType === 'MCQ' && (
                    <div style={{ background: '#f8fafc', padding: '14px', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
                        <strong style={{ fontSize: '13px', color: '#1e293b' }}>MCQ Questions ({mcqQuestions.length})</strong>
                        <button
                          type="button"
                          onClick={() => setMcqQuestions(prev => [...prev, { id: `mcq-${Date.now()}`, questionText: '', options: ['Option 1', 'Option 2', 'Option 3', 'Option 4'], correctIndex: 0, points: 10 }])}
                          style={{ padding: '4px 10px', background: '#eff6ff', color: '#2563eb', border: '1px solid #bfdbfe', borderRadius: '6px', cursor: 'pointer', fontSize: '12px', fontWeight: 600 }}
                        >
                          + Add Question
                        </button>
                      </div>

                      {mcqQuestions.map((q, idx) => (
                        <div key={q.id || idx} style={{ background: '#fff', padding: '12px', borderRadius: '8px', border: '1px solid #cbd5e1', marginBottom: '10px' }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', gap: '8px', marginBottom: '8px' }}>
                            <input
                              type="text" required placeholder={`Q${idx + 1} Question text...`}
                              value={q.questionText}
                              onChange={(e) => {
                                const val = e.target.value;
                                setMcqQuestions(prev => prev.map((item, i) => i === idx ? { ...item, questionText: val } : item));
                              }}
                              style={{ flex: 1, padding: '6px 10px', borderRadius: '4px', border: '1px solid #cbd5e1', fontSize: '13px' }}
                            />
                            <input
                              type="number" min={1} max={100} placeholder="Pts"
                              value={q.points}
                              onChange={(e) => {
                                const pts = Number(e.target.value) || 10;
                                setMcqQuestions(prev => prev.map((item, i) => i === idx ? { ...item, points: pts } : item));
                              }}
                              style={{ width: '60px', padding: '6px', borderRadius: '4px', border: '1px solid #cbd5e1', fontSize: '13px' }}
                            />
                            {mcqQuestions.length > 1 && (
                              <button type="button" onClick={() => setMcqQuestions(prev => prev.filter((_, i) => i !== idx))} style={{ background: '#fee2e2', color: '#dc2626', border: 'none', borderRadius: '4px', padding: '4px 8px', cursor: 'pointer', fontSize: '11px' }}>🗑️</button>
                            )}
                          </div>

                          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '6px', marginTop: '6px' }}>
                            {(q.options || ['Option 1', 'Option 2', 'Option 3', 'Option 4']).map((opt: string, optIdx: number) => (
                              <div key={optIdx} style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                                <input
                                  type="radio" name={`correct_${idx}`}
                                  checked={q.correctIndex === optIdx}
                                  onChange={() => setMcqQuestions(prev => prev.map((item, i) => i === idx ? { ...item, correctIndex: optIdx } : item))}
                                />
                                <input
                                  type="text" value={opt}
                                  onChange={(e) => {
                                    const newOpt = e.target.value;
                                    setMcqQuestions(prev => prev.map((item, i) => {
                                      if (i !== idx) return item;
                                      const opts = [...(item.options || ['Option 1', 'Option 2', 'Option 3', 'Option 4'])];
                                      opts[optIdx] = newOpt;
                                      return { ...item, options: opts };
                                    }));
                                  }}
                                  style={{ width: '100%', padding: '4px 8px', fontSize: '12px', borderRadius: '4px', border: '1px solid #e2e8f0' }}
                                />
                              </div>
                            ))}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}

                  {/* SUBJECTIVE QUESTIONS BUILDER */}
                  {formAssignmentType === 'Subjective' && (
                    <div style={{ background: '#f8fafc', padding: '14px', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
                        <strong style={{ fontSize: '13px', color: '#1e293b' }}>Subjective Questions ({subjectiveQuestions.length})</strong>
                        <button
                          type="button"
                          onClick={() => setSubjectiveQuestions(prev => [...prev, { id: `sub-${Date.now()}`, questionText: '', maxPoints: 10, dependentLessonIds: [] }])}
                          style={{ padding: '4px 10px', background: '#eff6ff', color: '#2563eb', border: '1px solid #bfdbfe', borderRadius: '6px', cursor: 'pointer', fontSize: '12px', fontWeight: 600 }}
                        >
                          + Add Question
                        </button>
                      </div>

                      {subjectiveQuestions.map((q, idx) => (
                        <div key={q.id || idx} style={{ background: '#fff', padding: '12px', borderRadius: '8px', border: '1px solid #cbd5e1', marginBottom: '10px' }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', gap: '8px' }}>
                            <input
                              type="text" required placeholder={`Q${idx + 1} Question text...`}
                              value={q.questionText}
                              onChange={(e) => {
                                const val = e.target.value;
                                setSubjectiveQuestions(prev => prev.map((item, i) => i === idx ? { ...item, questionText: val } : item));
                              }}
                              style={{ flex: 1, padding: '6px 10px', borderRadius: '4px', border: '1px solid #cbd5e1', fontSize: '13px' }}
                            />
                            <input
                              type="number" min={1} max={100} placeholder="Pts"
                              value={q.maxPoints}
                              onChange={(e) => {
                                const pts = Number(e.target.value) || 10;
                                setSubjectiveQuestions(prev => prev.map((item, i) => i === idx ? { ...item, maxPoints: pts } : item));
                              }}
                              style={{ width: '60px', padding: '6px', borderRadius: '4px', border: '1px solid #cbd5e1', fontSize: '13px' }}
                            />
                            {subjectiveQuestions.length > 1 && (
                              <button type="button" onClick={() => setSubjectiveQuestions(prev => prev.filter((_, i) => i !== idx))} style={{ background: '#fee2e2', color: '#dc2626', border: 'none', borderRadius: '4px', padding: '4px 8px', cursor: 'pointer', fontSize: '11px' }}>🗑️</button>
                            )}
                          </div>
                          <div style={{ marginTop: '10px' }}>
                            <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: '#475569', marginBottom: '4px' }}>AI Grounding Dependencies (Lessons)</label>
                            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                              {(modules.find(m => m.id === targetModuleId)?.lessons || []).length === 0 && (
                                <span style={{ fontSize: '12px', color: '#94a3b8' }}>No lessons available in this module to ground on.</span>
                              )}
                              {(modules.find(m => m.id === targetModuleId)?.lessons || []).map((lesson: any) => {
                                const isChecked = (q.dependentLessonIds || []).includes(lesson.id);
                                return (
                                  <label key={lesson.id} style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '12px', padding: '4px 8px', background: isChecked ? '#e0e7ff' : '#f1f5f9', border: `1px solid ${isChecked ? '#818cf8' : '#cbd5e1'}`, borderRadius: '4px', cursor: 'pointer' }}>
                                    <input 
                                      type="checkbox" 
                                      checked={isChecked} 
                                      onChange={(e) => {
                                        const checked = e.target.checked;
                                        setSubjectiveQuestions(prev => prev.map((item, i) => {
                                          if (i !== idx) return item;
                                          const deps = new Set(item.dependentLessonIds || []);
                                          if (checked) deps.add(lesson.id);
                                          else deps.delete(lesson.id);
                                          return { ...item, dependentLessonIds: Array.from(deps) };
                                        }));
                                      }}
                                      style={{ cursor: 'pointer', margin: 0 }}
                                    />
                                    {lesson.title}
                                  </label>
                                );
                              })}
                            </div>
                          </div>

                        </div>
                      ))}
                    </div>
                  )}

                  {formAssignmentType === 'External' && (
                    <div>
                      <label style={{ display: 'block', fontSize: '13px', fontWeight: 600 }}>External Resource URL</label>
                      <input type="url" value={formExternalUrl} onChange={(e) => setFormExternalUrl(e.target.value)} style={{ width: '100%', padding: '8px', marginTop: '4px', borderRadius: '4px', border: '1px solid #cbd5e1' }} />
                    </div>
                  )}
                  {/* Due Date explicitly removed for LP Tasks */}

                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '16px', marginBottom: '16px' }}>
                    <div>
                      <label style={{ display: 'block', fontSize: '13px', fontWeight: 600 }}>Duration (Days)</label>
                      <input type="number" min={0} value={formTaskDurationDays} onChange={(e) => setFormTaskDurationDays(Number(e.target.value) || 0)} style={{ width: '100%', padding: '8px', marginTop: '4px', borderRadius: '4px', border: '1px solid #cbd5e1' }} />
                    </div>
                    
                    <div style={{ marginBottom: '16px' }}>
                      <label style={{ display: 'block', fontSize: '14px', fontWeight: 500, color: '#475569' }}>Anchor Type (When does the timer start?)</label>
                      <select value={formTaskAnchorType} onChange={(e) => setFormTaskAnchorType(e.target.value)} style={{ width: '100%', padding: '8px', marginTop: '4px', borderRadius: '4px', border: '1px solid #cbd5e1' }}>
                        <option value="ASSIGNMENT">When LP is Assigned</option>
                        <option value="TASK_UNLOCKED">When Task is Unlocked</option>
                      </select>
                    </div>
                    <div>
                      <label style={{ display: 'block', fontSize: '13px', fontWeight: 600 }}>Duration (Hours)</label>
                      <input type="number" min={0} value={formTaskDurationHours} onChange={(e) => setFormTaskDurationHours(Number(e.target.value) || 0)} style={{ width: '100%', padding: '8px', marginTop: '4px', borderRadius: '4px', border: '1px solid #cbd5e1' }} />
                    </div>
                    <div>
                      <label style={{ display: 'block', fontSize: '13px', fontWeight: 600 }}>Duration (Mins)</label>
                      <input type="number" min={0} value={formTaskDurationMinutes} onChange={(e) => setFormTaskDurationMinutes(Number(e.target.value) || 0)} style={{ width: '100%', padding: '8px', marginTop: '4px', borderRadius: '4px', border: '1px solid #cbd5e1' }} />
                    </div>
                  </div>
                </>
              )}

              <div className="cm-form-actions">
                <button type="button" onClick={resetFormFields} className="cm-btn-back" style={{ marginBottom: 0 }}>Cancel</button>
                <button type="submit" disabled={isSubmitting} className="cm-btn-primary">
                  {isSubmitting ? 'Saving...' : 'Save Updates'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 👁️ VIEW INSPECTOR DETAILS MODAL */}
      {activeModal === 'VIEW_INSPECTOR' && inspectItem && (
        <div className="cm-modal-overlay">
          <div className="cm-modal-content wide">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px', borderBottom: '1px solid #f1f5f9', paddingBottom: '12px' }}>
              <div>
                <span style={{ fontSize: '11px', fontWeight: 700, color: '#4f46e5', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                  {inspectItem.type} DETAILS
                </span>
                <h3 style={{ margin: '4px 0 0 0', fontSize: '18px', fontWeight: 800, color: '#0f172a' }}>
                  {inspectItem.data.title}
                </h3>
              </div>
              <button onClick={() => resetFormFields()} style={{ background: '#f1f5f9', border: 'none', borderRadius: '8px', width: '32px', height: '32px', cursor: 'pointer', fontSize: '16px', color: '#64748b' }}>✖</button>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              {inspectItem.data.description && (
                <div>
                  <strong style={{ fontSize: '12px', color: '#475569', display: 'block', marginBottom: '4px' }}>Description:</strong>
                  <div style={{ fontSize: '13px', color: '#1e293b', background: '#f8fafc', padding: '12px', borderRadius: '8px', border: '1px solid #e2e8f0', whiteSpace: 'pre-wrap' }}>
                    <RichText content={inspectItem.data.description} emptyStateText="No description" />
                  </div>
                </div>
              )}

              {inspectItem.data.instructions && (
                <div>
                  <strong style={{ fontSize: '12px', color: '#475569', display: 'block', marginBottom: '4px' }}>Instructions:</strong>
                  <div style={{ fontSize: '13px', color: '#0c4a6e', background: '#f0f9ff', padding: '12px', borderRadius: '8px', border: '1px solid #bae6fd', whiteSpace: 'pre-wrap' }}>
                    <RichText content={inspectItem.data.instructions} emptyStateText="No instructions" />
                  </div>
                </div>
              )}

              {inspectItem.type === 'LESSON' && (
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                  {inspectItem.data.videoUrl && (
                    <div style={{ padding: '10px', background: '#eff6ff', borderRadius: '8px', border: '1px solid #bfdbfe', fontSize: '12px' }}>
                      🎥 <strong>Video URL:</strong> <a href={inspectItem.data.videoUrl} target="_blank" rel="noreferrer" style={{ color: '#2563eb' }}>{inspectItem.data.videoUrl}</a>
                    </div>
                  )}
                  {inspectItem.data.articleUrl && (
                    <div style={{ padding: '10px', background: '#fdf4ff', borderRadius: '8px', border: '1px solid #f5d0fe', fontSize: '12px' }}>
                      📰 <strong>Article URL:</strong> <a href={inspectItem.data.articleUrl} target="_blank" rel="noreferrer" style={{ color: '#c026d3' }}>{inspectItem.data.articleUrl}</a>
                    </div>
                  )}
                </div>
              )}

              {inspectItem.data.mcqConfig?.questions?.length > 0 && (
                <div>
                  <strong style={{ fontSize: '13px', color: '#1e293b', display: 'block', marginBottom: '8px' }}>Task Questions ({inspectItem.data.mcqConfig.questions.length}):</strong>
                  {inspectItem.data.mcqConfig.questions.map((q: any, qIdx: number) => (
                    <div key={qIdx} style={{ background: '#f8fafc', padding: '10px 12px', borderRadius: '8px', border: '1px solid #e2e8f0', marginBottom: '8px' }}>
                      <div style={{ fontSize: '12px', fontWeight: 700, color: '#0f172a' }}>
                        <div style={{ display: 'inline-block' }}><RichText content={q.questionText || q.question || ''} emptyStateText="" /></div> <span style={{ color: '#4f46e5' }}>({q.points || q.maxPoints || 10} pts)</span>
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
              <button onClick={() => resetFormFields()} className="cm-btn-back" style={{ marginBottom: 0 }}>
                Close Inspector
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
