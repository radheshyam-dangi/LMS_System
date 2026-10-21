import React, { useState, useEffect } from 'react';
import { 
  X, ChevronLeft, ChevronRight, Play, CheckCircle2, 
  ExternalLink, FileText, Clock, BookOpen, AlertCircle, Award 
} from 'lucide-react';
import DOMPurify from 'dompurify';
import { assignmentService } from '../../services/assignmentService';
import { extractModalQuestions } from '../SharedCards/SharedAssignmentModal';
import { useToast } from '../../context/ToastContext';
import './FullscreenLessonPlayer.css';

interface FullscreenLessonPlayerProps {
  lesson: any;
  moduleTitle: string;
  lessons: any[];
  currentLessonIndex: number;
  moduleAssignments: any[];
  submissions: any[];
  isCompleted: boolean;
  accessToken: string;
  onClose: () => void;
  onCompleteLesson: (lessonId: string) => Promise<void>;
  onSelectLesson: (index: number) => void;
  onAssignmentSubmitted?: () => void;
}

function getYouTubeEmbedUrl(url?: string): string | null {
  if (!url) return null;
  try {
    const parsed = new URL(url);
    if (parsed.hostname.includes('youtube.com')) {
      const v = parsed.searchParams.get('v');
      if (v) return `https://www.youtube.com/embed/${v}?autoplay=1`;
      if (parsed.pathname.startsWith('/embed/')) return `${url}?autoplay=1`;
    } else if (parsed.hostname.includes('youtu.be')) {
      const id = parsed.pathname.slice(1);
      if (id) return `https://www.youtube.com/embed/${id}?autoplay=1`;
    }
  } catch {}
  return null;
}

export const FullscreenLessonPlayer: React.FC<FullscreenLessonPlayerProps> = ({
  lesson,
  moduleTitle,
  lessons,
  currentLessonIndex,
  moduleAssignments,
  submissions,
  isCompleted,
  accessToken,
  onClose,
  onCompleteLesson,
  onSelectLesson,
  onAssignmentSubmitted,
}) => {
  const toast = useToast();
  const [isPlaying, setIsPlaying] = useState(false);
  const [isMarkingDone, setIsMarkingDone] = useState(false);

  // Assignment step state
  const [activeAssignment, setActiveAssignment] = useState<any | null>(null);
  const [assignmentAnswers, setAssignmentAnswers] = useState<{ [qId: string]: string }>({});
  const [mcqSelections, setMcqSelections] = useState<{ [qId: string]: number }>({});
  const [isSubmittingAssignment, setIsSubmittingAssignment] = useState(false);
  const [assignmentDone, setAssignmentDone] = useState(false);

  // Reset states when current lesson changes
  useEffect(() => {
    setIsPlaying(false);
    setActiveAssignment(null);
    setAssignmentAnswers({});
    setMcqSelections({});
    setAssignmentDone(false);
  }, [lesson?.id]);

  if (!lesson) return null;

  // Resolve video sources
  const videoUrl = lesson.videoUrl || (lesson.videos && lesson.videos[0]?.url) || '';
  const embedUrl = getYouTubeEmbedUrl(videoUrl);
  const isDirectVideo = videoUrl && !embedUrl;

  // Resolve dependent assignment for this lesson
  const findDependentAssignment = () => {
    return moduleAssignments.find((a: any) => {
      const depIds = a.dependsOnLessonIds;
      if (Array.isArray(depIds) && depIds.some((id: string) => String(id) === String(lesson.id))) {
        return true;
      }
      if (String(a.lessonId) === String(lesson.id)) {
        return true;
      }
      // If creator marked lockUntilLessonsComplete and this is the last lesson of module
      if (a.lockUntilLessonsComplete && currentLessonIndex === lessons.length - 1) {
        return true;
      }
      return false;
    });
  };

  const depAssignment = findDependentAssignment();
  const depSubmission = depAssignment 
    ? submissions.find((s: any) => String(s.assignmentId) === String(depAssignment.id))
    : null;
  const isAssignmentAlreadySubmitted = depSubmission && depSubmission.status !== 'AVAILABLE' && depSubmission.status !== 'LOCKED';

  // Handle Next button click
  const handleNextClick = async () => {
    if (isMarkingDone) return;
    setIsMarkingDone(true);

    try {
      // 1. Mark lesson as completed
      await onCompleteLesson(lesson.id);

      // 2. Check if there's a dependent assignment that hasn't been submitted yet
      if (depAssignment && !isAssignmentAlreadySubmitted && !assignmentDone && !activeAssignment) {
        setActiveAssignment(depAssignment);
        toast.info(`Next: Complete dependent assignment "${depAssignment.title}"`);
        setIsMarkingDone(false);
        return;
      }

      // 3. Move to next lesson if available
      if (currentLessonIndex < lessons.length - 1) {
        onSelectLesson(currentLessonIndex + 1);
      } else {
        toast.success('Congratulations! You completed all lessons in this module.');
        onClose();
      }
    } catch {
      toast.error('Failed to complete lesson progression.');
    } finally {
      setIsMarkingDone(false);
    }
  };

  // Handle Assignment Submission
  const handleSubmitAssignment = async () => {
    if (!activeAssignment) return;
    setIsSubmittingAssignment(true);

    try {
      const questions = extractModalQuestions(activeAssignment);
      const answersPayload: Array<{ questionId: string; answer: string }> = [];

      questions.forEach((q, idx) => {
        const qId = q.id || String(idx);
        if (q.questionType === 'MCQ' || (q.options && q.options.length > 0)) {
          const selectedIdx = mcqSelections[qId];
          if (typeof selectedIdx === 'number') {
            answersPayload.push({
              questionId: qId,
              answer: q.options[selectedIdx] || String(selectedIdx),
            });
          }
        } else {
          answersPayload.push({
            questionId: qId,
            answer: assignmentAnswers[qId] || '',
          });
        }
      });

      const submissionText = Object.values(assignmentAnswers).join('\n\n') || 'Assignment completed';

      await assignmentService.submitAssignment(
        activeAssignment.id,
        {
          submissionText,
          answers: answersPayload,
          mcqAnswers: mcqSelections,
        },
        accessToken
      );

      toast.success('Assignment submitted successfully!');
      setAssignmentDone(true);
      if (onAssignmentSubmitted) onAssignmentSubmitted();

      // Proceed to next lesson or finish
      if (currentLessonIndex < lessons.length - 1) {
        onSelectLesson(currentLessonIndex + 1);
      } else {
        toast.success('Module Complete! All lessons and assignments finished.');
        onClose();
      }
    } catch (err: any) {
      toast.error(err?.response?.data?.message || err.message || 'Failed to submit assignment');
    } finally {
      setIsSubmittingAssignment(false);
    }
  };

  const questions = activeAssignment ? extractModalQuestions(activeAssignment) : [];

  return (
    <div className="flp-overlay" role="dialog" aria-modal="true">
      {/* ── TOP HEADER ── */}
      <header className="flp-header">
        <div className="flp-header-left">
          <button 
            type="button" 
            className="flp-exit-btn" 
            onClick={onClose}
            title="Exit full-screen lesson view"
          >
            <ChevronLeft size={16} /> Exit to Module
          </button>

          <div className="flp-module-title-pill">
            <span>{moduleTitle}</span> • <strong>Lesson {currentLessonIndex + 1} of {lessons.length}</strong>
          </div>
        </div>

        <div className="flp-header-right">
          <span className={`flp-status-badge ${isCompleted ? 'completed' : 'in-progress'}`}>
            {isCompleted ? <><CheckCircle2 size={13} /> Completed</> : 'In Progress'}
          </span>
          <button 
            type="button" 
            className="flp-exit-btn" 
            style={{ padding: '8px' }} 
            onClick={onClose}
            title="Close"
          >
            <X size={18} />
          </button>
        </div>
      </header>

      {/* ── MAIN STAGE BODY ── */}
      <main className="flp-body">
        <div className="flp-stage-container">
          {/* If Active Assignment Mode */}
          {activeAssignment ? (
            <div className="flp-assignment-panel">
              <div className="flp-assignment-header">
                <div>
                  <span className="flp-assignment-tag">Dependent Assignment</span>
                  <h2 style={{ fontSize: '22px', fontWeight: 800, color: '#fff', marginTop: 6, margin: 0 }}>
                    {activeAssignment.title}
                  </h2>
                </div>
                <button
                  type="button"
                  className="flp-exit-btn"
                  onClick={() => setActiveAssignment(null)}
                  style={{ fontSize: '12px' }}
                >
                  Back to Lesson Video
                </button>
              </div>

              {activeAssignment.description && (
                <div 
                  style={{ color: '#cbd5e1', fontSize: '14px', lineHeight: 1.6, marginBottom: 20 }}
                  dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(activeAssignment.description) }}
                />
              )}

              {/* Questions */}
              {questions.length > 0 ? (
                questions.map((q: any, idx: number) => {
                  const qId = q.id || String(idx);
                  const isMCQ = q.questionType === 'MCQ' || (Array.isArray(q.options) && q.options.length > 0);

                  return (
                    <div key={qId} className="flp-question-card">
                      <div className="flp-question-text">
                        Question {idx + 1}: {q.question || q.text || 'Question Prompt'}
                      </div>

                      {isMCQ && q.options ? (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                          {q.options.map((opt: string, optIdx: number) => {
                            const isSelected = mcqSelections[qId] === optIdx;
                            return (
                              <div
                                key={optIdx}
                                className={`flp-mcq-option ${isSelected ? 'selected' : ''}`}
                                onClick={() => setMcqSelections(prev => ({ ...prev, [qId]: optIdx }))}
                              >
                                <input
                                  type="radio"
                                  name={`flp-mcq-${qId}`}
                                  checked={isSelected}
                                  onChange={() => setMcqSelections(prev => ({ ...prev, [qId]: optIdx }))}
                                  style={{ accentColor: '#6366f1' }}
                                />
                                <span style={{ fontSize: '14px', color: '#e2e8f0' }}>{opt}</span>
                              </div>
                            );
                          })}
                        </div>
                      ) : (
                        <textarea
                          className="flp-textarea"
                          placeholder="Type your answer here..."
                          value={assignmentAnswers[qId] || ''}
                          onChange={(e) => setAssignmentAnswers(prev => ({ ...prev, [qId]: e.target.value }))}
                        />
                      )}
                    </div>
                  );
                })
              ) : (
                <div className="flp-question-card">
                  <div className="flp-question-text">Assignment Submission</div>
                  <textarea
                    className="flp-textarea"
                    placeholder="Enter your completed assignment response or submission notes here..."
                    value={assignmentAnswers['default'] || ''}
                    onChange={(e) => setAssignmentAnswers(prev => ({ ...prev, default: e.target.value }))}
                  />
                </div>
              )}

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 12, marginTop: 20 }}>
                <button
                  type="button"
                  className="flp-submit-assignment-btn"
                  onClick={handleSubmitAssignment}
                  disabled={isSubmittingAssignment}
                >
                  {isSubmittingAssignment ? 'Submitting...' : 'Submit Assignment & Continue →'}
                </button>
              </div>
            </div>
          ) : (
            <>
              {/* VIDEO PLAYER SECTION */}
              <div className="flp-video-wrapper">
                {videoUrl ? (
                  isPlaying ? (
                    embedUrl ? (
                      <iframe
                        src={embedUrl}
                        title={lesson.title}
                        className="flp-video-iframe"
                        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; fullscreen"
                        allowFullScreen
                      />
                    ) : isDirectVideo ? (
                      <video
                        src={videoUrl}
                        controls
                        autoPlay
                        className="flp-html-video"
                      />
                    ) : null
                  ) : (
                    <div className="flp-video-placeholder-cover">
                      <button
                        type="button"
                        className="flp-start-video-btn"
                        onClick={() => setIsPlaying(true)}
                        title="Start lesson video"
                      >
                        <Play size={32} fill="currentColor" style={{ marginLeft: 4 }} />
                      </button>
                      <h3 style={{ fontSize: '20px', fontWeight: 700, color: '#ffffff', margin: '0 0 8px 0' }}>
                        {lesson.title}
                      </h3>
                      <p style={{ color: '#94a3b8', fontSize: '14px', margin: 0 }}>
                        Click to start video lecture
                      </p>
                    </div>
                  )
                ) : (
                  <div className="flp-no-video-card">
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10, color: '#818cf8' }}>
                      <BookOpen size={24} />
                      <span style={{ fontSize: '13px', fontWeight: 700, textTransform: 'uppercase' }}>
                        Curriculum Reading Lecture
                      </span>
                    </div>
                    <h2 style={{ fontSize: '24px', fontWeight: 800, color: '#fff', margin: 0 }}>
                      {lesson.title}
                    </h2>
                    <p style={{ color: '#cbd5e1', fontSize: '15px', lineHeight: 1.7, margin: 0 }}>
                      {lesson.description 
                        ? lesson.description.replace(/<[^>]*>/g, '') 
                        : 'Review the lecture materials and study resources below.'}
                    </p>
                  </div>
                )}
              </div>

              {/* LESSON DETAILS & DOWNSIDE RESOURCES */}
              <div className="flp-lesson-meta-card">
                <div className="flp-lesson-title-row">
                  <h1 className="flp-lesson-heading">{lesson.title}</h1>
                  <span className="flp-duration-pill">
                    <Clock size={12} /> {lesson.durationMinutes || 15} min
                  </span>
                </div>

                {lesson.description && (
                  <div 
                    className="flp-description-content"
                    dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(lesson.description) }}
                  />
                )}

                {/* Key Takeaways */}
                {lesson.keyPoints && lesson.keyPoints.length > 0 && (
                  <div className="flp-keypoints-box">
                    <span className="flp-keypoints-title">Key Concepts & Takeaways</span>
                    <ul className="flp-keypoints-list">
                      {lesson.keyPoints.map((point: string, idx: number) => (
                        <li key={idx} className="flp-keypoint-item">
                          <span className="flp-keypoint-dot">•</span>
                          <span dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(point) }} />
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                {/* Core Downside Resources */}
                {lesson.resources && lesson.resources.length > 0 && (
                  <div className="flp-resources-section">
                    <div className="flp-section-heading">
                      <BookOpen size={14} /> Lesson Resources & Reference Links
                    </div>
                    <div className="flp-resources-grid">
                      {lesson.resources.map((res: any, idx: number) => (
                        <a
                          key={res.id || idx}
                          href={res.url}
                          target="_blank"
                          rel="noreferrer"
                          className="flp-resource-card"
                          title={`Open ${res.title || 'Resource'}`}
                        >
                          <div>
                            <span className="flp-resource-title">{res.title || 'Study Resource'}</span>
                            <span className="flp-resource-type">{res.type || 'External Link'}</span>
                          </div>
                          <ExternalLink size={14} color="#94a3b8" />
                        </a>
                      ))}
                    </div>
                  </div>
                )}

                {/* Audio Lectures */}
                {lesson.audios && lesson.audios.length > 0 && (
                  <div className="flp-resources-section">
                    <div className="flp-section-heading">Audio Lecture</div>
                    {lesson.audios.map((aud: any, idx: number) => (
                      <div key={idx} style={{ padding: '12px 0' }}>
                        <audio controls src={aud.url} style={{ width: '100%', maxWidth: '480px' }} />
                      </div>
                    ))}
                  </div>
                )}

                {/* Dependent Assignment notice */}
                {depAssignment && (
                  <div style={{
                    marginTop: '24px',
                    padding: '16px 20px',
                    background: 'rgba(99, 102, 241, 0.08)',
                    border: '1px solid rgba(99, 102, 241, 0.25)',
                    borderRadius: '12px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                  }}>
                    <div>
                      <div style={{ fontSize: '11px', fontWeight: 700, color: '#a5b4fc', textTransform: 'uppercase' }}>
                        Dependent Assignment
                      </div>
                      <div style={{ fontSize: '14px', fontWeight: 600, color: '#ffffff', marginTop: 2 }}>
                        {depAssignment.title}
                      </div>
                    </div>
                    <button
                      type="button"
                      className="flp-exit-btn"
                      onClick={() => setActiveAssignment(depAssignment)}
                      style={{ background: 'rgba(99, 102, 241, 0.2)', borderColor: '#6366f1', color: '#fff' }}
                    >
                      {isAssignmentAlreadySubmitted ? 'Review Submission' : 'Open Assignment'}
                    </button>
                  </div>
                )}
              </div>
            </>
          )}
        </div>
      </main>

      {/* ── FIXED BOTTOM CONTROLLER ── */}
      <footer className="flp-footer">
        <button
          type="button"
          className="flp-nav-btn flp-prev-btn"
          disabled={currentLessonIndex === 0}
          onClick={() => onSelectLesson(currentLessonIndex - 1)}
        >
          <ChevronLeft size={16} /> Previous
        </button>

        {/* Progress Dots */}
        <div className="flp-dots-row">
          {lessons.map((l: any, idx: number) => {
            const isDotActive = idx === currentLessonIndex;
            return (
              <div
                key={l.id || idx}
                className={`flp-dot ${isDotActive ? 'is-active' : ''}`}
                onClick={() => onSelectLesson(idx)}
                title={`Go to Lesson ${idx + 1}`}
              />
            );
          })}
        </div>

        <button
          type="button"
          className="flp-nav-btn flp-next-btn"
          onClick={handleNextClick}
          disabled={isMarkingDone}
        >
          {isMarkingDone
            ? 'Completing...'
            : depAssignment && !isAssignmentAlreadySubmitted && !activeAssignment
            ? 'Next: Assignment →'
            : currentLessonIndex === lessons.length - 1
            ? 'Complete Lesson & Finish ✓'
            : 'Next Lesson →'}
        </button>
      </footer>
    </div>
  );
};
