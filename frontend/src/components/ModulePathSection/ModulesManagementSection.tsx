import React, { useState, useEffect } from "react";
import { lessonService } from "../../services/lessonService";
import "./ModulesManagement.css";

interface ModulesProps {
  currentPathId: string;
  currentPathTitle: string;
  userRole: 'Admin' | 'Trainer' | 'Trainee';
  accessToken: string;
  onBack: () => void;
}

export function ModulesManagementSection({
  currentPathId,
  currentPathTitle,
  userRole,
  accessToken,
  onBack,
}: ModulesProps) {
  const isTrainerOrAdmin = userRole === 'Admin' || userRole === 'Trainer';
  const [activeTab, setActiveTab] = useState<'Lessons' | 'Tasks' | 'Resources' | 'Assessments'>('Lessons');
  
  // Content Lists
  const [lessons, setLessons] = useState<any[]>([]);
  const [selectedLesson, setSelectedLesson] = useState<any | null>(null);
  
  // Creation Modal State
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [createCategory, setCreateCategory] = useState<'LESSON' | 'ASSIGNMENT' | 'RESOURCE'>('LESSON');
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Lesson Form Fields
  const [lessonTitle, setLessonTitle] = useState("");
  const [lessonVideoUrl, setLessonVideoUrl] = useState("");
  const [lessonArticleHtml, setLessonArticleHtml] = useState(""); // Tiptap / Rich Content

  // Assignment Form Fields
  const [assignmentTitle, setAssignmentTitle] = useState("");
  const [assignmentInstructions, setAssignmentInstructions] = useState("");
  const [assignmentType, setAssignmentType] = useState<'Subjective' | 'MCQ'>('Subjective');
  const [mcqOptions, setMcqOptions] = useState<string[]>(["", "", "", ""]);
  const [mcqCorrectIndex, setMcqCorrectIndex] = useState<number>(0);

  // Submission Modal State (Trainee)
  const [isSubmitModalOpen, setIsSubmitModalOpen] = useState(false);
  const [selectedAssignment, setSelectedAssignment] = useState<any | null>(null);
  const [submissionText, setSubmissionText] = useState("");
  const [selectedMcqOption, setSelectedMcqOption] = useState<number | null>(null);

  // Load Initial Content
//   useEffect(() => {
//     // Generate valid UUID sample data to prevent PostgreSQL UUID syntax errors
//     const initialLessons = [
//       {
//         id: "123e4567-e89b-12d3-a456-426614174000",
//         title: "Introduction to REST APIs",
//         description: "Core REST principles and HTTP protocols.",
//         durationMinutes: 18,
//         videoUrl: "https://www.youtube.com/embed/dQw4w9WgXcQ",
//         articleContent: "<h3>REST API Architecture</h3><p>REST stands for Representational State Transfer. It uses standard HTTP methods: GET, POST, PUT, DELETE.</p>",
//         isCompleted: true,
//         assignments: [
//           {
//             id: "223e4567-e89b-12d3-a456-426614174001",
//             title: "CRUD Controller Design",
//             instructions: "Write a NestJS controller handling GET and POST requests.",
//             assignmentType: "Subjective",
//           },
//           {
//             id: "323e4567-e89b-12d3-a456-426614174002",
//             title: "HTTP Status Codes Quiz",
//             instructions: "What status code represents successful resource creation?",
//             assignmentType: "MCQ",
//             mcqConfig: { options: ["200 OK", "201 Created", "400 Bad Request", "500 Error"], correctIndex: 1 },
//           }
//         ]
//       }
//     ];
//     setLessons(initialLessons);
//     setSelectedLesson(initialLessons[0]);
//   }, [currentPathId]);

  // Handle Form Submission for Adding Content (Trainer/Admin)
  const handleCreateContent = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);

    try {
      if (createCategory === 'LESSON') {
        const payload = {
          moduleId: currentPathId,
          title: lessonTitle,
          videoUrl: lessonVideoUrl,
          description: lessonArticleHtml,
        };
        await lessonService.createLesson(payload, accessToken);
        alert("Lesson created successfully!");
      } else if (createCategory === 'ASSIGNMENT') {
        const payload = {
          lessonId: selectedLesson?.id,
          title: assignmentTitle,
          instructions: assignmentInstructions,
          assignmentType,
          mcqConfig: assignmentType === 'MCQ' ? { options: mcqOptions, correctIndex: mcqCorrectIndex } : null,
        };
        await lessonService.createAssignment(payload, accessToken);
        alert("Assignment created successfully!");
      }
      setIsCreateModalOpen(false);
      resetCreateForm();
    } catch (err: any) {
      alert(err.message || "Failed to create content.");
    } finally {
      setIsSubmitting(false);
    }
  };

  // Handle Assignment Submission (Trainee)
  const handleSubmitAssignment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedAssignment || isSubmitting) return;

    setIsSubmitting(true);
    try {
      const finalSubmission = selectedAssignment.assignmentType === 'MCQ' 
        ? `Selected Option: ${mcqOptions[selectedMcqOption ?? 0]}` 
        : submissionText;

      await lessonService.submitAssignment(selectedAssignment.id, finalSubmission, accessToken);
      alert("Assignment submitted successfully!");
      setIsSubmitModalOpen(false);
      setSubmissionText("");
    } catch (err: any) {
      // Direct Server Message Display
      alert(`Submission Error: ${err.message}`);
    } finally {
      setIsSubmitting(false);
    }
  };

  const resetCreateForm = () => {
    setLessonTitle("");
    setLessonVideoUrl("");
    setLessonArticleHtml("");
    setAssignmentTitle("");
    setAssignmentInstructions("");
    setAssignmentType("Subjective");
    setMcqOptions(["", "", "", ""]);
  };

  return (
    <div className="module-details-workspace">
      {/* Header Bar */}
      <header className="workspace-top-bar">
        <div>
          <h1 className="main-heading">Module Details</h1>
          <nav className="breadcrumb-trail">
            <span className="trail-link" onClick={onBack}>Learning Paths</span>
            <span className="trail-arrow">›</span>
            <span className="trail-active">{currentPathTitle}</span>
          </nav>
        </div>

        {/* Creator / Admin Action */}
        {isTrainerOrAdmin && (
          <button className="btn-primary-purple" onClick={() => setIsCreateModalOpen(true)}>
            + Add Content / Assignment
          </button>
        )}
      </header>

      {/* Main Tabs Navigation */}
      <div className="tab-buttons-row">
        <button className={`tab-item ${activeTab === 'Lessons' ? 'active' : ''}`} onClick={() => setActiveTab('Lessons')}>
          Lessons ({lessons.length})
        </button>
        <button className={`tab-item ${activeTab === 'Assessments' ? 'active' : ''}`} onClick={() => setActiveTab('Assessments')}>
          Assignments & Quizzes
        </button>
      </div>

      {/* LESSONS VIEW */}
      {activeTab === 'Lessons' && (
        <div className="curriculum-viewer-grid">
          <div className="sidebar-lessons-list">
            <h3>Lessons List</h3>
            {lessons.map((les) => (
              <div 
                key={les.id} 
                className={`lesson-tree-item ${selectedLesson?.id === les.id ? 'selected' : ''}`}
                onClick={() => setSelectedLesson(les)}
              >
                <span>📖 {les.title}</span>
              </div>
            ))}
          </div>

          <div className="main-media-stage">
            {selectedLesson ? (
              <div className="content-card">
                <h2>{selectedLesson.title}</h2>
                
                {selectedLesson.videoUrl && (
                  <div className="video-container">
                    <iframe width="100%" height="360" src={selectedLesson.videoUrl} title="Lesson Video" allowFullScreen />
                  </div>
                )}

                {/* Tiptap Rich Text / Article Renderer */}
                {selectedLesson.articleContent && (
                  <div className="article-body-box" dangerouslySetInnerHTML={{ __html: selectedLesson.articleContent }} />
                )}
              </div>
            ) : (
              <div>Select a lesson to view content.</div>
            )}
          </div>
        </div>
      )}

      {/* ASSIGNMENTS VIEW */}
      {activeTab === 'Assessments' && (
        <div className="assignments-tab-grid">
          {selectedLesson?.assignments?.map((asgn: any) => (
            <div key={asgn.id} className="assignment-card">
              <div className="asgn-header">
                <h3>{asgn.title}</h3>
                <span className="asgn-type-badge">{asgn.assignmentType}</span>
              </div>
              <p>{asgn.instructions}</p>

              <button 
                className="btn-submit-assignment"
                onClick={() => {
                  setSelectedAssignment(asgn);
                  setIsSubmitModalOpen(true);
                }}
              >
                Start / Submit Assignment
              </button>
            </div>
          ))}
        </div>
      )}

      {/* CREATION MODAL (TRAINER / ADMIN ONLY) */}
      {isCreateModalOpen && isTrainerOrAdmin && (
        <div className="modal-backdrop-blur" onClick={() => setIsCreateModalOpen(false)}>
          <div className="modal-card-popup large-modal" onClick={(e) => e.stopPropagation()}>
            <h2>Create Curriculum Content</h2>
            
            <div className="type-selector-tabs">
              <button className={createCategory === 'LESSON' ? 'active' : ''} onClick={() => setCreateCategory('LESSON')}>
                📖 Lesson Article & Video
              </button>
              <button className={createCategory === 'ASSIGNMENT' ? 'active' : ''} onClick={() => setCreateCategory('ASSIGNMENT')}>
                📝 Assignment / Quiz
              </button>
            </div>

            <form onSubmit={handleCreateContent}>
              {/* LESSON FORM */}
              {createCategory === 'LESSON' && (
                <>
                  <div className="form-group-item">
                    <label>Lesson Title *</label>
                    <input type="text" required value={lessonTitle} onChange={(e) => setLessonTitle(e.target.value)} placeholder="e.g. REST Architecture Principles" />
                  </div>
                  <div className="form-group-item">
                    <label>Video Stream URL</label>
                    <input type="url" value={lessonVideoUrl} onChange={(e) => setLessonVideoUrl(e.target.value)} placeholder="https://www.youtube.com/embed/..." />
                  </div>
                  <div className="form-group-item">
                    <label>Tiptap Article HTML Content</label>
                    <textarea rows={6} value={lessonArticleHtml} onChange={(e) => setLessonArticleHtml(e.target.value)} placeholder="<p>Write lesson content or HTML article here...</p>" />
                  </div>
                </>
              )}

              {/* ASSIGNMENT FORM */}
              {createCategory === 'ASSIGNMENT' && (
                <>
                  <div className="form-group-item">
                    <label>Assignment Title *</label>
                    <input type="text" required value={assignmentTitle} onChange={(e) => setAssignmentTitle(e.target.value)} placeholder="e.g. Controller Implementation Quiz" />
                  </div>

                  <div className="form-group-item">
                    <label>Assignment Type</label>
                    <select value={assignmentType} onChange={(e) => setAssignmentType(e.target.value as any)}>
                      <option value="Subjective">Subjective (Code / Essay Response)</option>
                      <option value="MCQ">Multiple Choice Question (MCQ)</option>
                    </select>
                  </div>

                  <div className="form-group-item">
                    <label>Instructions / Question Statement</label>
                    <textarea rows={3} required value={assignmentInstructions} onChange={(e) => setAssignmentInstructions(e.target.value)} />
                  </div>

                  {/* DYNAMIC FORM RENDERING FOR MCQ */}
                  {assignmentType === 'MCQ' && (
                    <div className="mcq-options-builder">
                      <label>Multiple Choice Options</label>
                      {mcqOptions.map((opt, idx) => (
                        <div key={idx} className="mcq-option-input-row">
                          <input
                            type="radio"
                            name="correctOpt"
                            checked={mcqCorrectIndex === idx}
                            onChange={() => setMcqCorrectIndex(idx)}
                          />
                          <input
                            type="text"
                            required
                            placeholder={`Option ${idx + 1}`}
                            value={opt}
                            onChange={(e) => {
                              const updated = [...mcqOptions];
                              updated[idx] = e.target.value;
                              setMcqOptions(updated);
                            }}
                          />
                        </div>
                      ))}
                    </div>
                  )}
                </>
              )}

              <div className="modal-footer-actions">
                <button type="button" className="btn-cancel" onClick={() => setIsCreateModalOpen(false)}>Cancel</button>
                <button type="submit" disabled={isSubmitting} className="btn-confirm-purple">
                  {isSubmitting ? "Creating..." : "Save Content"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* SUBMISSION MODAL (TRAINEE) */}
      {isSubmitModalOpen && (
        <div className="modal-backdrop-blur" onClick={() => setIsSubmitModalOpen(false)}>
          <div className="modal-card-popup" onClick={(e) => e.stopPropagation()}>
            <h2>{selectedAssignment?.title}</h2>
            <p>{selectedAssignment?.instructions}</p>

            <form onSubmit={handleSubmitAssignment}>
              {/* Subjective Submission Form */}
              {selectedAssignment?.assignmentType === 'Subjective' && (
                <div className="form-group-item">
                  <label>Your Solution / Code Repository Link *</label>
                  <textarea
                    rows={5}
                    required
                    placeholder="Paste code snippet or GitHub URL..."
                    value={submissionText}
                    onChange={(e) => setSubmissionText(e.target.value)}
                  />
                </div>
              )}

              {/* MCQ Choice Form */}
              {selectedAssignment?.assignmentType === 'MCQ' && (
                <div className="form-group-item">
                  <label>Select Correct Answer:</label>
                  {selectedAssignment?.mcqConfig?.options?.map((opt: string, idx: number) => (
                    <div key={idx} className="mcq-radio-choice">
                      <input
                        type="radio"
                        id={`opt-${idx}`}
                        name="mcqChoice"
                        onChange={() => setSelectedMcqOption(idx)}
                      />
                      <label htmlFor={`opt-${idx}`}>{opt}</label>
                    </div>
                  ))}
                </div>
              )}

              <div className="modal-footer-actions">
                <button type="button" className="btn-cancel" onClick={() => setIsSubmitModalOpen(false)}>Cancel</button>
                <button type="submit" disabled={isSubmitting} className="btn-confirm-purple">
                  {isSubmitting ? "Submitting..." : "Submit Answer"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}