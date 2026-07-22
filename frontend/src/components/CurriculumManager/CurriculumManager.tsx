import React, { useState, useEffect } from 'react';
import { curriculumService } from '../../services/curriculumService';

interface CurriculumManagerProps {
  learningPathId: string;
  learningPathTitle: string;
  currentUser: { id: string; role: 'Admin' | 'Trainer' | 'Trainee' };
  accessToken: string;
  onBack: () => void;
}

interface SubjectiveQuestionItem {
  id: string;
  questionText: string;
  maxPoints: number;
}

interface MCQQuestionItem {
  id: string;
  questionText: string;
  options: string[];
  correctIndex: number;
}

export function CurriculumManager({
  learningPathId,
  learningPathTitle,
  currentUser,
  accessToken,
  onBack,
}: CurriculumManagerProps) {
  const [modules, setModules] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // Modal display controllers
  const [activeModal, setActiveModal] = useState<'MODULE' | 'LESSON' | 'TASK' | 'RESOURCE' | null>(null);

  // Form payload targets
  const [targetModuleId, setTargetModuleId] = useState<string | null>(null);
  const [targetLessonId, setTargetLessonId] = useState<string | null>(null);

  // General Form Inputs
  const [formTitle, setFormTitle] = useState('');
  const [formDescription, setFormDescription] = useState('');
  const [formUrl, setFormUrl] = useState('');

  // Lesson Specific Inputs
  const [formVideoUrl, setFormVideoUrl] = useState('');
  const [formArticleUrl, setFormArticleUrl] = useState('');
  const [formDurationMinutes, setFormDurationMinutes] = useState<number>(15);
  const [formDisplayOrder, setFormDisplayOrder] = useState<number>(1);

  // Assignment / Task Specific Inputs
  const [formAssignmentType, setFormAssignmentType] = useState<'Subjective' | 'MCQ'>('Subjective');
  const [formInstructions, setFormInstructions] = useState('');
  const [formMaxScore, setFormMaxScore] = useState<number>(100);
  const [formDueDate, setFormDueDate] = useState('');

  // 🌟 MULTI-QUESTION STATE
  const [subjectiveQuestions, setSubjectiveQuestions] = useState<SubjectiveQuestionItem[]>([
    { id: 'sub-1', questionText: '', maxPoints: 10 },
  ]);

  const [mcqQuestions, setMcqQuestions] = useState<MCQQuestionItem[]>([
    { id: 'mcq-1', questionText: '', options: ['Option 1', 'Option 2', 'Option 3', 'Option 4'], correctIndex: 0 },
  ]);

  const [isSubmitting, setIsSubmitting] = useState(false);

  const canManage = currentUser.role === 'Admin' || currentUser.role === 'Trainer';

  const loadCurriculum = async () => {
    setIsLoading(true);
    try {
      const data = await curriculumService.fetchModulesByPath(learningPathId, accessToken);
      setModules(data);
    } catch (err: any) {
      alert(err.message || 'Failed to fetch curriculum tree.');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadCurriculum();
  }, [learningPathId]);

  const resetFormFields = () => {
    setFormTitle('');
    setFormDescription('');
    setFormUrl('');
    setFormVideoUrl('');
    setFormArticleUrl('');
    setFormDurationMinutes(15);
    setFormDisplayOrder(1);

    // Reset Assignment / Task Fields
    setFormAssignmentType('Subjective');
    setFormInstructions('');
    setFormMaxScore(100);
    setFormDueDate('');
    setSubjectiveQuestions([{ id: 'sub-1', questionText: '', maxPoints: 10 }]);
    setMcqQuestions([{ id: 'mcq-1', questionText: '', options: ['Option 1', 'Option 2', 'Option 3', 'Option 4'], correctIndex: 0 }]);

    setActiveModal(null);
    setTargetModuleId(null);
    setTargetLessonId(null);
  };

  // 🌟 SUBJECTIVE MULTI-QUESTION HANDLERS
  const handleAddSubjectiveQuestion = () => {
    setSubjectiveQuestions((prev) => [
      ...prev,
      { id: `sub-${Date.now()}`, questionText: '', maxPoints: 10 },
    ]);
  };

  const handleRemoveSubjectiveQuestion = (index: number) => {
    if (subjectiveQuestions.length > 1) {
      setSubjectiveQuestions((prev) => prev.filter((_, i) => i !== index));
    }
  };

  const handleSubjectiveChange = (index: number, field: 'questionText' | 'maxPoints', value: any) => {
    const updated = [...subjectiveQuestions];
    updated[index] = { ...updated[index], [field]: value };
    setSubjectiveQuestions(updated);
  };

  // 🌟 MCQ MULTI-QUESTION HANDLERS
  const handleAddMcqQuestion = () => {
    setMcqQuestions((prev) => [
      ...prev,
      {
        id: `mcq-${Date.now()}`,
        questionText: '',
        options: ['Option 1', 'Option 2', 'Option 3', 'Option 4'],
        correctIndex: 0,
      },
    ]);
  };

  const handleRemoveMcqQuestion = (qIndex: number) => {
    if (mcqQuestions.length > 1) {
      setMcqQuestions((prev) => prev.filter((_, i) => i !== qIndex));
    }
  };

  const handleMcqTextChange = (qIndex: number, text: string) => {
    const updated = [...mcqQuestions];
    updated[qIndex].questionText = text;
    setMcqQuestions(updated);
  };

  const handleMcqOptionChange = (qIndex: number, optIndex: number, val: string) => {
    const updated = [...mcqQuestions];
    updated[qIndex].options[optIndex] = val;
    setMcqQuestions(updated);
  };

  const handleMcqCorrectIndexChange = (qIndex: number, correctIdx: number) => {
    const updated = [...mcqQuestions];
    updated[qIndex].correctIndex = correctIdx;
    setMcqQuestions(updated);
  };

  const handleAddMcqOption = (qIndex: number) => {
    const updated = [...mcqQuestions];
    if (updated[qIndex].options.length < 6) {
      updated[qIndex].options.push(`Option ${updated[qIndex].options.length + 1}`);
      setMcqQuestions(updated);
    }
  };

  const handleRemoveMcqOption = (qIndex: number, optIndex: number) => {
    const updated = [...mcqQuestions];
    if (updated[qIndex].options.length > 2) {
      updated[qIndex].options = updated[qIndex].options.filter((_, i) => i !== optIndex);
      if (updated[qIndex].correctIndex >= updated[qIndex].options.length) {
        updated[qIndex].correctIndex = 0;
      }
      setMcqQuestions(updated);
    }
  };

  // 🌟 Form Handlers for Nested Creation
  const handleFormSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formTitle.trim() || isSubmitting) return;

    setIsSubmitting(true);
    try {
      if (activeModal === 'MODULE') {
        await curriculumService.createModule(
          { title: formTitle, description: formDescription, learningPathId },
          accessToken
        );
      } else if (activeModal === 'LESSON' && targetModuleId) {
        await curriculumService.createLesson(
          {
            title: formTitle,
            description: formDescription,
            videoUrl: formVideoUrl || undefined,
            articleUrl: formArticleUrl || undefined,
            durationMinutes: Number(formDurationMinutes) || 15,
            displayOrder: Number(formDisplayOrder) || 1,
            moduleId: targetModuleId,
          },
          accessToken
        );
      } else if (activeModal === 'TASK') {
        const payload: any = {
          title: formTitle,
          description: formDescription,
          instructions: formInstructions,
          assignmentType: formAssignmentType,
          maxScore: Number(formMaxScore) || 100,
          dueDate: formDueDate || undefined,
          lessonId: targetLessonId ?? undefined,
          moduleId: targetModuleId ?? undefined,
          learningPathId: learningPathId,
        };

        if (formAssignmentType === 'Subjective') {
          payload.mcqConfig = {
            questions: subjectiveQuestions.filter((q) => q.questionText.trim() !== ''),
          };
        } else if (formAssignmentType === 'MCQ') {
          payload.mcqConfig = {
            questions: mcqQuestions.map((q) => ({
              question: q.questionText,
              options: q.options.filter((opt) => opt.trim() !== ''),
              correctIndex: q.correctIndex,
            })),
          };
        }

        await curriculumService.createTask(payload, accessToken);
      } else if (activeModal === 'RESOURCE') {
        await curriculumService.createResource(
          {
            title: formTitle,
            url: formUrl,
            ...(targetLessonId ? { lessonId: targetLessonId } : {}),
            ...(targetModuleId && !targetLessonId ? { moduleId: targetModuleId } : {}),
          },
          accessToken
        );
      }

      resetFormFields();
      await loadCurriculum();
    } catch (err: any) {
      alert(err.message || 'Creation request failed.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="curriculum-manager-container" style={{ padding: '24px', maxWidth: '1100px', margin: '0 auto' }}>
      {/* ⬅️ Backward Navigation */}
      <button
        type="button"
        onClick={onBack}
        style={{ padding: '8px 16px', borderRadius: '6px', cursor: 'pointer', marginBottom: '20px' }}
      >
        ← Back to All Learning Paths
      </button>

      <header style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
        <div>
          <h2>Curriculum Management: {learningPathTitle}</h2>
          <p style={{ color: '#64748b' }}>Design modules, structured lessons, tasks, and reference resources.</p>
        </div>

        {canManage && (
          <button
            type="button"
            onClick={() => {
              resetFormFields();
              setActiveModal('MODULE');
            }}
            style={{ padding: '10px 18px', backgroundColor: '#2563eb', color: '#fff', border: 'none', borderRadius: '6px', cursor: 'pointer', fontWeight: 600 }}
          >
            + Create Module
          </button>
        )}
      </header>

      {/* Curriculum Tree Display */}
      {isLoading ? (
        <div>Loading curriculum tree...</div>
      ) : modules.length === 0 ? (
        <div style={{ padding: '32px', textAlign: 'center', border: '2px dashed #cbd5e1', borderRadius: '8px' }}>
          No modules created yet. Click <strong>"+ Create Module"</strong> above to start building the track.
        </div>
      ) : (
        modules.map((module, mIdx) => (
          <div key={module.id} style={{ border: '1px solid #e2e8f0', borderRadius: '8px', padding: '20px', marginBottom: '20px', background: '#fff' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h3>Module {mIdx + 1}: {module.title}</h3>
              {canManage && (
                <div style={{ display: 'flex', gap: '8px' }}>
                  <button
                    type="button"
                    onClick={() => {
                      setTargetModuleId(module.id);
                      setTargetLessonId(null);
                      setActiveModal('RESOURCE');
                    }}
                    style={{ padding: '6px 12px', background: '#fef3c7', color: '#b45309', border: 'none', borderRadius: '4px', cursor: 'pointer' }}
                  >
                    + Add Module Resource
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      setTargetModuleId(module.id);
                      setTargetLessonId(null);
                      setActiveModal('LESSON');
                    }}
                    style={{ padding: '6px 12px', background: '#e0e7ff', color: '#4338ca', border: 'none', borderRadius: '4px', cursor: 'pointer' }}
                  >
                    + Add Lesson
                  </button>
                </div>
              )}
            </div>
            <p style={{ color: '#475569', fontSize: '14px' }}>{module.description || 'No module description provided.'}</p>

            {/* Module Resources */}
            {module.resources && module.resources.length > 0 && (
              <div style={{ marginTop: '12px', padding: '12px', background: '#fffbeb', borderRadius: '6px', border: '1px solid #fde68a' }}>
                <strong style={{ fontSize: '13px', color: '#92400e' }}>📚 Module Reference Resources:</strong>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '10px', marginTop: '6px' }}>
                  {module.resources.map((res: any) => (
                    <a key={res.id} href={res.url} target="_blank" rel="noreferrer" style={{ fontSize: '13px', color: '#2563eb', textDecoration: 'underline' }}>
                      🔗 {res.title}
                    </a>
                  ))}
                </div>
              </div>
            )}

            {/* Lessons inside Module */}
            <div style={{ marginLeft: '20px', marginTop: '16px' }}>
              {module.lessons?.map((lesson: any, lIdx: number) => (
                <div key={lesson.id} style={{ background: '#f8fafc', padding: '16px', borderRadius: '6px', marginBottom: '12px', borderLeft: '4px solid #3b82f6' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <h4>📖 Lesson {lesson.displayOrder || lIdx + 1}: {lesson.title}</h4>
                    {canManage && (
                      <div style={{ display: 'flex', gap: '8px' }}>
                        <button
                          type="button"
                          onClick={() => {
                            setTargetLessonId(lesson.id);
                            setTargetModuleId(module.id);
                            setActiveModal('TASK');
                          }}
                          style={{ padding: '4px 10px', background: '#dcfce7', color: '#15803d', border: 'none', borderRadius: '4px', cursor: 'pointer', fontSize: '12px' }}
                        >
                          + Create Assignment
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            setTargetLessonId(lesson.id);
                            setTargetModuleId(null);
                            setActiveModal('RESOURCE');
                          }}
                          style={{ padding: '4px 10px', background: '#fef3c7', color: '#b45309', border: 'none', borderRadius: '4px', cursor: 'pointer', fontSize: '12px' }}
                        >
                          + Add Lesson Resource
                        </button>
                      </div>
                    )}
                  </div>

                  {lesson.description && (
                    <p style={{ fontSize: '13px', color: '#475569', marginTop: '6px' }}>{lesson.description}</p>
                  )}

                  <div style={{ display: 'flex', gap: '16px', marginTop: '8px', fontSize: '12px', color: '#64748b' }}>
                    <span>⏱️ Duration: <strong>{lesson.durationMinutes ?? 15} mins</strong></span>
                    <span>🔢 Order: <strong>#{lesson.displayOrder ?? 1}</strong></span>
                  </div>

                  {/* Lesson Attached Resources */}
                  {lesson.resources && lesson.resources.length > 0 && (
                    <div style={{ marginTop: '10px', padding: '10px 12px', background: '#f0f9ff', borderRadius: '6px', border: '1px solid #bae6fd' }}>
                      <strong style={{ fontSize: '12px', color: '#0369a1' }}>📎 Lesson Reference Materials:</strong>
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '10px', marginTop: '6px' }}>
                        {lesson.resources.map((res: any) => (
                          <a key={res.id} href={res.url} target="_blank" rel="noreferrer" style={{ fontSize: '13px', color: '#0284c7', textDecoration: 'underline' }}>
                            🔗 {res.title}
                          </a>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Assignments / Tasks */}
                  {lesson.assignments && lesson.assignments.length > 0 && (
                    <div style={{ marginTop: '12px' }}>
                      <strong style={{ fontSize: '12px', color: '#334155' }}>Assignments & Evaluations:</strong>
                      {lesson.assignments.map((task: any) => (
                        <div key={task.id} style={{ marginLeft: '8px', marginTop: '6px', padding: '10px', background: '#fff', border: '1px solid #cbd5e1', borderRadius: '6px', fontSize: '13px' }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                            <strong>📝 {task.title}</strong>
                            <span style={{ padding: '2px 8px', borderRadius: '12px', fontSize: '11px', fontWeight: 600, background: task.assignmentType === 'MCQ' ? '#e0e7ff' : '#fef3c7', color: task.assignmentType === 'MCQ' ? '#3730a3' : '#92400e' }}>
                              {task.assignmentType || 'Subjective'}
                            </span>
                          </div>
                          {task.description && <p style={{ margin: '4px 0', color: '#64748b', fontSize: '12px' }}>{task.description}</p>}
                          <div style={{ display: 'flex', gap: '16px', fontSize: '11px', color: '#64748b', marginTop: '6px' }}>
                            <span>🎯 Max Score: <strong>{task.maxScore ?? task.max_score ?? 100}</strong></span>
                            {task.dueDate && <span>📅 Due: <strong>{new Date(task.dueDate).toLocaleDateString()}</strong></span>}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        ))
      )}

      {/* 🌟 DYNAMIC MODAL FORM */}
      {activeModal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}>
          <div style={{ background: '#fff', width: activeModal === 'TASK' ? '650px' : '480px', padding: '24px', borderRadius: '8px', maxHeight: '90vh', overflowY: 'auto' }}>
            <h3>Create {activeModal === 'RESOURCE' ? (targetLessonId ? 'Lesson Resource' : 'Module Resource') : activeModal}</h3>
            
            <form onSubmit={handleFormSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '12px', marginTop: '16px' }}>
              
              <div>
                <label style={{ display: 'block', fontSize: '13px', fontWeight: 600 }}>Title *</label>
                <input
                  type="text"
                  required
                  placeholder={activeModal === 'TASK' ? 'e.g., Module 1 Final Assessment' : 'Title'}
                  value={formTitle}
                  onChange={(e) => setFormTitle(e.target.value)}
                  style={{ width: '100%', padding: '8px', marginTop: '4px' }}
                />
              </div>

              {/* MODULE FORM FIELDS */}
              {activeModal === 'MODULE' && (
                <div>
                  <label style={{ display: 'block', fontSize: '13px', fontWeight: 600 }}>Description</label>
                  <textarea
                    rows={3}
                    value={formDescription}
                    onChange={(e) => setFormDescription(e.target.value)}
                    style={{ width: '100%', padding: '8px', marginTop: '4px' }}
                  />
                </div>
              )}

              {/* LESSON FORM FIELDS */}
              {activeModal === 'LESSON' && (
                <>
                  <div>
                    <label style={{ display: 'block', fontSize: '13px', fontWeight: 600 }}>Description</label>
                    <textarea
                      rows={2}
                      value={formDescription}
                      onChange={(e) => setFormDescription(e.target.value)}
                      style={{ width: '100%', padding: '8px', marginTop: '4px' }}
                    />
                  </div>
                  <div>
                    <label style={{ display: 'block', fontSize: '13px', fontWeight: 600 }}>Video URL (video_url)</label>
                    <input
                      type="url"
                      placeholder="https://youtube.com/watch?v=..."
                      value={formVideoUrl}
                      onChange={(e) => setFormVideoUrl(e.target.value)}
                      style={{ width: '100%', padding: '8px', marginTop: '4px' }}
                    />
                  </div>
                  <div>
                    <label style={{ display: 'block', fontSize: '13px', fontWeight: 600 }}>Article URL (article_url)</label>
                    <input
                      type="url"
                      placeholder="https://docs.example.com/..."
                      value={formArticleUrl}
                      onChange={(e) => setFormArticleUrl(e.target.value)}
                      style={{ width: '100%', padding: '8px', marginTop: '4px' }}
                    />
                  </div>
                  <div style={{ display: 'flex', gap: '12px' }}>
                    <div style={{ flex: 1 }}>
                      <label style={{ display: 'block', fontSize: '13px', fontWeight: 600 }}>Duration (Minutes)</label>
                      <input
                        type="number"
                        min={1}
                        value={formDurationMinutes}
                        onChange={(e) => setFormDurationMinutes(Number(e.target.value))}
                        style={{ width: '100%', padding: '8px', marginTop: '4px' }}
                      />
                    </div>
                    <div style={{ flex: 1 }}>
                      <label style={{ display: 'block', fontSize: '13px', fontWeight: 600 }}>Display Order</label>
                      <input
                        type="number"
                        min={1}
                        value={formDisplayOrder}
                        onChange={(e) => setFormDisplayOrder(Number(e.target.value))}
                        style={{ width: '100%', padding: '8px', marginTop: '4px' }}
                      />
                    </div>
                  </div>
                </>
              )}

              {/* 🌟 ASSIGNMENT MULTI-QUESTION FORM FIELDS */}
              {activeModal === 'TASK' && (
                <>
                  <div style={{ background: '#f8fafc', padding: '12px', borderRadius: '6px', border: '1px solid #e2e8f0' }}>
                    <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, color: '#1e293b' }}>Evaluation Mode *</label>
                    <select
                      value={formAssignmentType}
                      onChange={(e) => setFormAssignmentType(e.target.value as any)}
                      style={{ width: '100%', padding: '8px', marginTop: '6px', borderRadius: '4px', border: '1px solid #cbd5e1' }}
                    >
                      <option value="Subjective">📝 Subjective Questions (Essay / Code / Problem)</option>
                      <option value="MCQ">🔘 Multiple Choice Quiz (Auto-Graded MCQ)</option>
                    </select>
                  </div>

                  <div>
                    <label style={{ display: 'block', fontSize: '13px', fontWeight: 600 }}>General Instructions / Overview</label>
                    <textarea
                      rows={2}
                      placeholder="General guidelines for trainees..."
                      value={formInstructions}
                      onChange={(e) => setFormInstructions(e.target.value)}
                      style={{ width: '100%', padding: '8px', marginTop: '4px' }}
                    />
                  </div>

                  {/* 🌟 1. SUBJECTIVE MULTI-QUESTION BUILDER */}
                  {formAssignmentType === 'Subjective' && (
                    <div style={{ background: '#fffbeb', padding: '14px', borderRadius: '6px', border: '1px solid #fde68a' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
                        <strong style={{ fontSize: '13px', color: '#92400e' }}>Subjective Questions List ({subjectiveQuestions.length})</strong>
                        <button
                          type="button"
                          onClick={handleAddSubjectiveQuestion}
                          style={{ padding: '6px 12px', background: '#b45309', color: '#fff', border: 'none', borderRadius: '4px', cursor: 'pointer', fontSize: '12px', fontWeight: 600 }}
                        >
                          + Add Question
                        </button>
                      </div>

                      {subjectiveQuestions.map((q, idx) => (
                        <div key={q.id} style={{ background: '#fff', padding: '12px', borderRadius: '6px', border: '1px solid #fcd34d', marginBottom: '10px' }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                            <span style={{ fontSize: '12px', fontWeight: 600, color: '#78350f' }}>Question {idx + 1}</span>
                            {subjectiveQuestions.length > 1 && (
                              <button
                                type="button"
                                onClick={() => handleRemoveSubjectiveQuestion(idx)}
                                style={{ background: '#fee2e2', color: '#991b1b', border: 'none', padding: '2px 8px', borderRadius: '4px', cursor: 'pointer', fontSize: '11px' }}
                              >
                                Delete
                              </button>
                            )}
                          </div>

                          <textarea
                            rows={2}
                            required
                            placeholder="Write out the problem statement..."
                            value={q.questionText}
                            onChange={(e) => handleSubjectiveChange(idx, 'questionText', e.target.value)}
                            style={{ width: '100%', padding: '6px', borderRadius: '4px', fontSize: '13px' }}
                          />

                          <div style={{ marginTop: '6px', width: '150px' }}>
                            <label style={{ fontSize: '11px', color: '#78350f', fontWeight: 600 }}>Points / Score</label>
                            <input
                              type="number"
                              min={1}
                              value={q.maxPoints}
                              onChange={(e) => handleSubjectiveChange(idx, 'maxPoints', Number(e.target.value))}
                              style={{ width: '100%', padding: '4px', marginTop: '2px', fontSize: '12px' }}
                            />
                          </div>
                        </div>
                      ))}
                    </div>
                  )}

                  {/* 🌟 2. MCQ MULTI-QUESTION BUILDER */}
                  {formAssignmentType === 'MCQ' && (
                    <div style={{ background: '#f0fdf4', padding: '14px', borderRadius: '6px', border: '1px solid #bbf7d0' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
                        <strong style={{ fontSize: '13px', color: '#166534' }}>MCQ Questions List ({mcqQuestions.length})</strong>
                        <button
                          type="button"
                          onClick={handleAddMcqQuestion}
                          style={{ padding: '6px 12px', background: '#166534', color: '#fff', border: 'none', borderRadius: '4px', cursor: 'pointer', fontSize: '12px', fontWeight: 600 }}
                        >
                          + Add Question
                        </button>
                      </div>

                      {mcqQuestions.map((q, qIdx) => (
                        <div key={q.id} style={{ background: '#fff', padding: '12px', borderRadius: '6px', border: '1px solid #86efac', marginBottom: '12px' }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                            <span style={{ fontSize: '12px', fontWeight: 600, color: '#14532d' }}>MCQ Question #{qIdx + 1}</span>
                            {mcqQuestions.length > 1 && (
                              <button
                                type="button"
                                onClick={() => handleRemoveMcqQuestion(qIdx)}
                                style={{ background: '#fee2e2', color: '#991b1b', border: 'none', padding: '2px 8px', borderRadius: '4px', cursor: 'pointer', fontSize: '11px' }}
                              >
                                Delete Question
                              </button>
                            )}
                          </div>

                          <textarea
                            rows={2}
                            required
                            placeholder="Enter question text..."
                            value={q.questionText}
                            onChange={(e) => handleMcqTextChange(qIdx, e.target.value)}
                            style={{ width: '100%', padding: '6px', borderRadius: '4px', fontSize: '13px' }}
                          />

                          <div style={{ marginTop: '8px' }}>
                            <label style={{ fontSize: '11px', color: '#14532d', fontWeight: 600 }}>Options (Select radio for correct answer):</label>
                            {q.options.map((opt, optIdx) => (
                              <div key={optIdx} style={{ display: 'flex', alignItems: 'center', gap: '8px', marginTop: '4px' }}>
                                <input
                                  type="radio"
                                  name={`correctOption_${q.id}`}
                                  checked={q.correctIndex === optIdx}
                                  onChange={() => handleMcqCorrectIndexChange(qIdx, optIdx)}
                                  style={{ cursor: 'pointer' }}
                                />
                                <input
                                  type="text"
                                  required
                                  value={opt}
                                  onChange={(e) => handleMcqOptionChange(qIdx, optIdx, e.target.value)}
                                  style={{ flex: 1, padding: '4px 8px', borderRadius: '4px', fontSize: '12px', border: '1px solid #cbd5e1' }}
                                />
                                {q.options.length > 2 && (
                                  <button
                                    type="button"
                                    onClick={() => handleRemoveMcqOption(qIdx, optIdx)}
                                    style={{ background: '#fee2e2', color: '#991b1b', border: 'none', padding: '2px 6px', borderRadius: '4px', cursor: 'pointer', fontSize: '11px' }}
                                  >
                                    ✕
                                  </button>
                                )}
                              </div>
                            ))}

                            {q.options.length < 6 && (
                              <button
                                type="button"
                                onClick={() => handleAddMcqOption(qIdx)}
                                style={{ marginTop: '6px', background: '#dcfce7', color: '#15803d', border: 'none', padding: '4px 8px', borderRadius: '4px', cursor: 'pointer', fontSize: '11px', fontWeight: 600 }}
                              >
                                + Add Option
                              </button>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Shared Metadata Fields */}
                  <div style={{ display: 'flex', gap: '12px' }}>
                    <div style={{ flex: 1 }}>
                      <label style={{ display: 'block', fontSize: '13px', fontWeight: 600 }}>Total Max Score (max_score)</label>
                      <input
                        type="number"
                        min={1}
                        value={formMaxScore}
                        onChange={(e) => setFormMaxScore(Number(e.target.value))}
                        style={{ width: '100%', padding: '8px', marginTop: '4px' }}
                      />
                    </div>
                    <div style={{ flex: 1 }}>
                      <label style={{ display: 'block', fontSize: '13px', fontWeight: 600 }}>Due Date (due_date)</label>
                      <input
                        type="date"
                        value={formDueDate}
                        onChange={(e) => setFormDueDate(e.target.value)}
                        style={{ width: '100%', padding: '8px', marginTop: '4px' }}
                      />
                    </div>
                  </div>
                </>
              )}

              {/* RESOURCE FORM FIELDS */}
              {activeModal === 'RESOURCE' && (
                <div>
                  <label style={{ display: 'block', fontSize: '13px', fontWeight: 600 }}>Resource URL *</label>
                  <input
                    type="url"
                    required
                    placeholder="https://..."
                    value={formUrl}
                    onChange={(e) => setFormUrl(e.target.value)}
                    style={{ width: '100%', padding: '8px', marginTop: '4px' }}
                  />
                </div>
              )}

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px', marginTop: '16px' }}>
                <button type="button" onClick={resetFormFields} style={{ padding: '8px 16px', background: '#cbd5e1', border: 'none', borderRadius: '4px' }}>
                  Cancel
                </button>
                <button type="submit" disabled={isSubmitting} style={{ padding: '8px 16px', background: '#2563eb', color: '#fff', border: 'none', borderRadius: '4px' }}>
                  {isSubmitting ? 'Saving...' : `Save ${activeModal}`}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}