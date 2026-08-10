import React, { useState, useEffect, useCallback } from 'react';
import { curriculumService } from '../../services/curriculumService';
import { learningPathService } from '../../services/learningPathService';
import { userService } from '../../services/userService';

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
  const [formDurationWeeks, setFormDurationWeeks] = useState(2);
  const [formResourceUrl, setFormResourceUrl] = useState('');

  // Task Form State
  const [formAssignmentType, setFormAssignmentType] = useState<'Subjective' | 'MCQ' | 'External'>('Subjective');
  const [formInstructions, setFormInstructions] = useState('');
  const [formDueDate, setFormDueDate] = useState('');
  const [formExternalUrl, setFormExternalUrl] = useState('');
  const [formAssignedTraineeId, setFormAssignedTraineeId] = useState<string>('');

  // Dynamic Questions State
  const [subjectiveQuestions, setSubjectiveQuestions] = useState<any[]>([
    { id: 'sub-1', questionText: '', maxPoints: 10 },
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
    setSubjectiveQuestions([{ id: 'sub-1', questionText: '', maxPoints: 10 }]);
    setMcqQuestions([{ id: 'mcq-1', questionText: '', options: ['Option 1', 'Option 2', 'Option 3', 'Option 4'], correctIndex: 0, points: 10 }]);
    setActiveModal(null);
    setEditingItemId(null);
    setInspectItem(null);
    setTargetModuleId(null);
    setTargetLessonId(null);
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

  const openEditTaskModal = (task: any) => {
    if (!isOwnerOrAdmin) return;
    setEditingItemId(task.id);
    setFormTitle(task.title || '');
    setFormInstructions(task.instructions || '');
    setFormAssignmentType(task.assignmentType || 'Subjective');
    setFormDueDate(task.dueDate ? new Date(task.dueDate).toISOString().split('T')[0] : '');
    setFormExternalUrl(task.externalUrl || '');
    setFormAssignedTraineeId(task.assignedToId || task.traineeId || '');
    
    setTargetModuleId(task.moduleId || task.module?.id || "");
    setTargetLessonId(task.lessonId || task.lesson?.id || null);

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
    <div style={{ padding: '24px', maxWidth: '1100px', margin: '0 auto' }}>
      <button type="button" onClick={onBack} style={{ padding: '8px 16px', borderRadius: '6px', cursor: 'pointer', marginBottom: '20px', background: '#fff', border: '1px solid #cbd5e1' }}>
        ← Back to All Learning Paths
      </button>

      <header style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
        <div>
          <h2>Curriculum Management: {learningPathTitle}</h2>
          <p style={{ color: '#64748b' }}>
            {isOwnerOrAdmin
              ? 'Manage modules, lessons, and external assignments for this learning path.'
              : 'Read-Only Mode: View and inspect internal modules, lessons, and tasks.'}
          </p>
        </div>

        {isOwnerOrAdmin && (
          <div style={{ display: 'flex', gap: '10px' }}>
            <button type="button" onClick={() => { resetFormFields(); setTargetLessonId(null); setTargetModuleId(""); setActiveModal('TASK'); }} style={{ padding: '10px 18px', backgroundColor: '#e2e8f0', color: '#1e293b', border: 'none', borderRadius: '6px', cursor: 'pointer', fontWeight: 600 }}>
              + Module Assignment
            </button>
            <button type="button" onClick={() => { resetFormFields(); setActiveModal('MODULE'); }} style={{ padding: '10px 18px', backgroundColor: '#2563eb', color: '#fff', border: 'none', borderRadius: '6px', cursor: 'pointer', fontWeight: 600 }}>
              + Create Module
            </button>
          </div>
        )}
      </header>

      {isLoading ? (
        <div>Loading curriculum tree...</div>
      ) : modules.length === 0 ? (
        <div style={{ padding: '32px', textAlign: 'center', border: '2px dashed #cbd5e1', borderRadius: '8px', background: '#fff' }}>
          <p style={{ margin: '0 0 12px 0', color: '#64748b' }}>No modules created yet.</p>
          {isOwnerOrAdmin && (
            <button type="button" onClick={() => { resetFormFields(); setActiveModal('MODULE'); }} style={{ padding: '8px 16px', backgroundColor: '#2563eb', color: '#fff', border: 'none', borderRadius: '6px', cursor: 'pointer', fontWeight: 600 }}>
              + Create First Module
            </button>
          )}
        </div>
      ) : (
        modules.map((module, mIdx) => (
          <div key={module.id} style={{ border: '1px solid #e2e8f0', borderRadius: '8px', padding: '20px', marginBottom: '20px', background: '#fff' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h3>Module {mIdx + 1}: {module.title}</h3>

              <div style={{ display: 'flex', gap: '8px' }}>
                <button type="button" onClick={() => openInspector('MODULE', module)} style={{ padding: '4px 10px', background: '#e2e8f0', border: 'none', borderRadius: '4px', cursor: 'pointer', fontSize: '12px' }}>
                  👁️ View Details
                </button>

                {isOwnerOrAdmin && (
                  <>
                    <button type="button" onClick={() => openEditModuleModal(module)} style={{ padding: '4px 10px', background: '#fef3c7', color: '#b45309', border: 'none', borderRadius: '4px', cursor: 'pointer', fontSize: '12px' }}>
                      ✏️ Edit Module
                    </button>
                    <button type="button" onClick={() => handleDeleteModule(module.id)} style={{ padding: '4px 10px', background: '#fee2e2', color: '#dc2626', border: 'none', borderRadius: '4px', cursor: 'pointer', fontSize: '12px' }}>
                      🗑️ Delete
                    </button>
                    <button type="button" onClick={() => { resetFormFields(); setTargetModuleId(module.id); setTargetLessonId(null); setActiveModal('LESSON'); }} style={{ padding: '4px 10px', background: '#e0e7ff', color: '#4338ca', border: 'none', borderRadius: '4px', cursor: 'pointer', fontSize: '12px', fontWeight: 600 }}>
                      + Add Lesson
                    </button>
                  </>
                )}
              </div>
            </div>

            <p style={{ fontSize: '13px', color: '#475569', marginTop: '4px' }}>{module.description || 'No module description.'}</p>

            {/* MODULE-LEVEL ASSIGNMENTS */}
            {module.assignments?.filter((a: any) => !a.lessonId).length > 0 && (
              <div style={{ marginTop: '16px', padding: '16px', background: '#f5f3ff', border: '1px dashed #c4b5fd', borderRadius: '6px' }}>
                <h4 style={{ margin: '0 0 12px 0', color: '#5b21b6', fontSize: '14px' }}>📌 Module-Level Assignments</h4>
                {module.assignments.filter((a: any) => !a.lessonId).map((task: any) => (
                  <div key={task.id} style={{ padding: '10px 12px', background: '#fff', border: '1px solid #ddd6fe', borderRadius: '6px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                    <div>
                      <strong style={{ fontSize: '13px', color: '#4c1d95' }}>{task.title}</strong>
                      <span style={{ fontSize: '11px', color: '#64748b', marginLeft: '10px' }}>
                        Type: {task.assignmentType} | Due: {task.dueDate ? new Date(task.dueDate).toLocaleDateString() : 'No Due Date'}
                      </span>
                    </div>

                    <div style={{ display: 'flex', gap: '6px' }}>
                      <button type="button" onClick={() => openInspector('TASK', task)} style={{ padding: '3px 8px', background: '#e2e8f0', border: 'none', borderRadius: '4px', cursor: 'pointer', fontSize: '11px' }}>
                        👁️ View
                      </button>
                      {isOwnerOrAdmin && (
                        <>
                          <button type="button" onClick={() => openEditTaskModal(task)} style={{ padding: '3px 8px', background: '#e0e7ff', color: '#3730a3', border: 'none', borderRadius: '4px', cursor: 'pointer', fontSize: '11px' }}>
                            ✏️ Edit
                          </button>
                          <button type="button" onClick={() => handleDeleteTask(task.id)} style={{ padding: '3px 8px', background: '#fee2e2', color: '#dc2626', border: 'none', borderRadius: '4px', cursor: 'pointer', fontSize: '11px' }}>
                            🗑️ Delete
                          </button>
                        </>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* LESSONS TREE */}
            <div style={{ marginLeft: '16px', marginTop: '16px' }}>
              {module.lessons?.map((lesson: any, lIdx: number) => (
                <div key={lesson.id} style={{ background: '#f8fafc', padding: '16px', borderRadius: '6px', marginBottom: '12px', borderLeft: '4px solid #3b82f6' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <h4 style={{ margin: '0' }}>📖 Lesson {lesson.displayOrder || lIdx + 1}: {lesson.title}</h4>
                    <div style={{ display: 'flex', gap: '6px' }}>
                      <button type="button" onClick={() => openInspector('LESSON', lesson)} style={{ padding: '4px 8px', background: '#e2e8f0', border: 'none', borderRadius: '4px', cursor: 'pointer', fontSize: '11px' }}>
                        👁️ View
                      </button>

                      {isOwnerOrAdmin && (
                        <>
                          <button type="button" onClick={() => openEditLessonModal(lesson)} style={{ padding: '4px 8px', background: '#fef3c7', color: '#b45309', border: 'none', borderRadius: '4px', cursor: 'pointer', fontSize: '11px' }}>
                            ✏️ Edit
                          </button>
                          <button type="button" onClick={() => handleDeleteLesson(lesson.id)} style={{ padding: '4px 8px', background: '#fee2e2', color: '#dc2626', border: 'none', borderRadius: '4px', cursor: 'pointer', fontSize: '11px' }}>
                            🗑️ Delete
                          </button>
                          <button type="button" onClick={() => { resetFormFields(); setTargetLessonId(lesson.id); setTargetModuleId(module.id); setActiveModal('TASK'); }} style={{ padding: '4px 8px', background: '#dcfce7', color: '#15803d', border: 'none', borderRadius: '4px', cursor: 'pointer', fontSize: '11px', fontWeight: 600 }}>
                            + Create Assignment
                          </button>
                        </>
                      )}
                    </div>
                  </div>

                  {lesson.description && <p style={{ fontSize: '13px', color: '#475569', marginTop: '6px', margin: '6px 0 0 0' }}>{lesson.description}</p>}

                  {/* TASKS LIST */}
                  {lesson.assignments?.map((task: any) => (
                    <div key={task.id} style={{ marginTop: '10px', padding: '10px 12px', background: '#fff', border: '1px solid #cbd5e1', borderRadius: '6px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <div>
                        <strong style={{ fontSize: '13px' }}>📝 {task.title}</strong>
                        <span style={{ fontSize: '11px', color: '#64748b', marginLeft: '10px' }}>
                          Type: {task.assignmentType} | Max Score: {task.maxScore} | Due: {task.dueDate ? new Date(task.dueDate).toLocaleDateString() : 'No Due Date'}
                        </span>
                      </div>

                      <div style={{ display: 'flex', gap: '6px' }}>
                        <button type="button" onClick={() => openInspector('TASK', task)} style={{ padding: '3px 8px', background: '#e2e8f0', border: 'none', borderRadius: '4px', cursor: 'pointer', fontSize: '11px' }}>
                          👁️ Context View
                        </button>
                        {isOwnerOrAdmin && (
                          <>
                            <button type="button" onClick={() => openEditTaskModal(task)} style={{ padding: '3px 8px', background: '#e0e7ff', color: '#3730a3', border: 'none', borderRadius: '4px', cursor: 'pointer', fontSize: '11px' }}>
                              ✏️ Edit Task
                            </button>
                            <button type="button" onClick={() => handleDeleteTask(task.id)} style={{ padding: '3px 8px', background: '#fee2e2', color: '#dc2626', border: 'none', borderRadius: '4px', cursor: 'pointer', fontSize: '11px' }}>
                              🗑️ Delete
                            </button>
                          </>
                        )}
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
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}>
          <div style={{ background: '#fff', width: (activeModal === 'TASK' || activeModal === 'EDIT_TASK') ? '650px' : '500px', padding: '24px', borderRadius: '8px', maxHeight: '90vh', overflowY: 'auto' }}>
            <h3>{activeModal.replace('_', ' ')}</h3>
            <form onSubmit={handleFormSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '12px', marginTop: '16px' }}>
              
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
                      <option key={m.id} value={m.id}>{m.title}</option>
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
                    <div>
                      <label style={{ display: 'block', fontSize: '13px', fontWeight: 600 }}>Resource URL</label>
                      <input type="url" value={formResourceUrl} onChange={(e) => setFormResourceUrl(e.target.value)} placeholder="https://..." style={{ width: '100%', padding: '8px', marginTop: '4px', borderRadius: '4px', border: '1px solid #cbd5e1' }} />
                    </div>
                  </div>
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
                    <select value={formAssignmentType} onChange={(e) => setFormAssignmentType(e.target.value as 'Subjective' | 'MCQ' | 'External')} style={{ width: '100%', padding: '8px', marginTop: '4px', borderRadius: '4px', border: '1px solid #cbd5e1' }}>
                      <option value="Subjective">📝 Subjective Questions</option>
                      <option value="MCQ">🔘 Multiple Choice Quiz (MCQ)</option>
                      <option value="External">🔗 External Assignment (no Learning Path)</option>
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
                          onClick={() => setSubjectiveQuestions(prev => [...prev, { id: `sub-${Date.now()}`, questionText: '', maxPoints: 10 }])}
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
                  <div>
                    <label style={{ display: 'block', fontSize: '13px', fontWeight: 600 }}>Due Date</label>
                    <input type="date" value={formDueDate} onChange={(e) => setFormDueDate(e.target.value)} style={{ width: '100%', padding: '8px', marginTop: '4px', borderRadius: '4px', border: '1px solid #cbd5e1' }} />
                  </div>
                </>
              )}

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px', marginTop: '16px' }}>
                <button type="button" onClick={resetFormFields} style={{ padding: '8px 16px', background: '#cbd5e1', border: 'none', borderRadius: '4px', cursor: 'pointer' }}>Cancel</button>
                <button type="submit" disabled={isSubmitting} style={{ padding: '8px 16px', background: '#2563eb', color: '#fff', border: 'none', borderRadius: '4px', cursor: 'pointer' }}>
                  {isSubmitting ? 'Saving...' : 'Save Updates'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 👁️ VIEW INSPECTOR DETAILS MODAL */}
      {activeModal === 'VIEW_INSPECTOR' && inspectItem && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(15,23,42,0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, backdropFilter: 'blur(4px)' }}>
          <div style={{ background: '#fff', width: '600px', padding: '26px', borderRadius: '16px', maxHeight: '90vh', overflowY: 'auto', boxShadow: '0 25px 80px rgba(0,0,0,0.22)' }}>
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
                    {inspectItem.data.description}
                  </div>
                </div>
              )}

              {inspectItem.data.instructions && (
                <div>
                  <strong style={{ fontSize: '12px', color: '#475569', display: 'block', marginBottom: '4px' }}>Instructions:</strong>
                  <div style={{ fontSize: '13px', color: '#0c4a6e', background: '#f0f9ff', padding: '12px', borderRadius: '8px', border: '1px solid #bae6fd', whiteSpace: 'pre-wrap' }}>
                    {inspectItem.data.instructions}
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
              <button onClick={() => resetFormFields()} style={{ padding: '8px 20px', background: '#f1f5f9', border: 'none', borderRadius: '10px', cursor: 'pointer', fontWeight: 600, fontSize: '13px', color: '#475569' }}>
                Close Inspector
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}