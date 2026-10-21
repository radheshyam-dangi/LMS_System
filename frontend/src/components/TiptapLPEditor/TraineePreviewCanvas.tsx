import React, { useState } from 'react';
import { 
  Lock, Unlock, CheckCircle2, Circle, Play, FileText, 
  AlertTriangle, ChevronDown, ChevronRight,
  Video, Link2, HelpCircle, Award, BookOpen
} from 'lucide-react';
import type { CurriculumTreeData, CurriculumNodeItem } from './types';

interface TraineePreviewCanvasProps {
  treeData: CurriculumTreeData;
  title: string;
  description: string;
  level: string;
  skillsTags: string[];
}

export const TraineePreviewCanvas: React.FC<TraineePreviewCanvasProps> = ({
  treeData,
  title,
  description,
  level,
  skillsTags,
}) => {
  // Simulated completed items
  const [completedLessonIds, setCompletedLessonIds] = useState<Set<string>>(new Set());
  const [completedAssignmentIds, setCompletedAssignmentIds] = useState<Set<string>>(new Set());
  const [expandedModuleIds, setExpandedModuleIds] = useState<Record<string, boolean>>({
    [treeData.modules[0]?.id || 'mod-0']: true,
  });
  const [activeContentModal, setActiveContentModal] = useState<CurriculumNodeItem | null>(null);
  const [lockedClickAlert, setLockedClickAlert] = useState<string | null>(null);

  // Toggle item completion in simulation
  const toggleLessonComplete = (lessonId: string, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    setCompletedLessonIds(prev => {
      const next = new Set(prev);
      if (next.has(lessonId)) next.delete(lessonId);
      else next.add(lessonId);
      return next;
    });
  };

  const toggleAssignmentComplete = (assignmentId: string, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    setCompletedAssignmentIds(prev => {
      const next = new Set(prev);
      if (next.has(assignmentId)) next.delete(assignmentId);
      else next.add(assignmentId);
      return next;
    });
  };

  // Helper: calculate module progress %
  const getModuleProgress = (mod: CurriculumNodeItem) => {
    const children = mod.children || [];
    if (children.length === 0) return 100;

    let total = children.length;
    let completed = 0;

    children.forEach(child => {
      if (child.type === 'lesson' && completedLessonIds.has(child.id)) completed++;
      if (child.type === 'assignment' && completedAssignmentIds.has(child.id)) completed++;
    });

    return Math.round((completed / total) * 100);
  };

  return (
    <div className="trainee-preview-canvas">
      {/* Temporary locked alert toast */}

      {/* Temporary locked alert toast */}
      {lockedClickAlert && (
        <div className="preview-locked-alert-toast">
          <AlertTriangle size={16} />
          <span>{lockedClickAlert}</span>
          <button type="button" onClick={() => setLockedClickAlert(null)}>&times;</button>
        </div>
      )}

      {/* 2. Trainee View Scrollable Container */}
      <div className="preview-scroll-container">
        {/* Track Hero Card */}
        <div className="preview-hero-card">
          <div className="preview-hero-top">
            <div className="preview-hero-badges">
              <span className="preview-level-badge">{level.toUpperCase()}</span>
              <span className="preview-status-badge">ACTIVE CURRICULUM</span>
            </div>
          </div>

          <h1 className="preview-track-title">{title || 'Untitled Learning Track'}</h1>
          {description && (
            <div 
              className="preview-track-desc" 
              dangerouslySetInnerHTML={{ __html: description }} 
            />
          )}

          {skillsTags.length > 0 && (
            <div className="preview-skills-row">
              {skillsTags.map((tag, i) => (
                <span key={i} className="preview-skill-tag">#{tag}</span>
              ))}
            </div>
          )}
        </div>

        {/* Modules Progression List */}
        <div className="preview-modules-list">
          {treeData.modules.map((mod, modIdx) => {
            const isFirstModule = modIdx === 0;
            const prevMod = modIdx > 0 ? treeData.modules[modIdx - 1] : null;
            const prevModProgress = prevMod ? getModuleProgress(prevMod) : 100;
            const prevModCompleted = prevModProgress >= 100;

            // Module locking evaluation:
            // Module 1 is always unlocked.
            // Module N is locked if creator set sequentialModuleLock !== false AND prevModProgress < 100.
            const isSequentialModuleLock = mod.sequentialModuleLock !== false;
            const isModuleUnlocked = isFirstModule || !isSequentialModuleLock || prevModCompleted;

            const modProgress = getModuleProgress(mod);
            const isModOpen = !!expandedModuleIds[mod.id] && isModuleUnlocked;
            const children = mod.children || [];

            return (
              <div 
                key={mod.id || modIdx} 
                className={`preview-module-card ${isModuleUnlocked ? 'unlocked' : 'locked'}`}
              >
                {/* Module Header Bar */}
                <div 
                  className="preview-module-header"
                  onClick={() => {
                    if (!isModuleUnlocked) {
                      setLockedClickAlert(
                        `Module ${modIdx + 1} is locked! Complete 100% of Module ${modIdx} ("${prevMod?.title || `Module ${modIdx}`}") to unlock.`
                      );
                      return;
                    }
                    setExpandedModuleIds(prev => ({ ...prev, [mod.id]: !prev[mod.id] }));
                  }}
                  style={{ cursor: isModuleUnlocked ? 'pointer' : 'not-allowed' }}
                >
                  <div className="preview-mod-title-group">
                    <div className="preview-mod-chevron">
                      {isModuleUnlocked ? (
                        isModOpen ? <ChevronDown size={18} /> : <ChevronRight size={18} />
                      ) : (
                        <Lock size={16} className="mod-lock-icon" />
                      )}
                    </div>

                    <div className="preview-mod-badge-group">
                      <span className="preview-mod-badge">MODULE {modIdx + 1}</span>
                      <h3 className="preview-mod-title">{mod.title || `Module ${modIdx + 1}`}</h3>
                    </div>
                  </div>

                  <div className="preview-mod-header-right">
                    {/* Lock Status Pill */}
                    {isFirstModule ? (
                      <span className="preview-lock-pill open">
                        <Unlock size={13} /> Open (Start)
                      </span>
                    ) : isModuleUnlocked ? (
                      <span className="preview-lock-pill unlocked">
                        <Unlock size={13} /> Unlocked
                      </span>
                    ) : (
                      <span className="preview-lock-pill locked">
                        <Lock size={13} /> Locked (Requires Prev 100%)
                      </span>
                    )}

                    {/* Progress Bar for Module */}
                    {isModuleUnlocked && (
                      <div className="preview-mod-progress-box">
                        <span className="preview-progress-label">{modProgress}%</span>
                        <div className="preview-progress-track">
                          <div 
                            className="preview-progress-fill" 
                            style={{ 
                              width: `${modProgress}%`,
                              background: modProgress === 100 ? '#10b981' : '#4f46e5' 
                            }} 
                          />
                        </div>
                      </div>
                    )}
                  </div>
                </div>

                {/* Locked Module Overlay / Warning Banner */}
                {!isModuleUnlocked && (
                  <div className="preview-locked-module-body">
                    <div className="locked-banner-content">
                      <div className="locked-badge-circle">
                        <Lock size={22} />
                      </div>
                      <div className="locked-text-group">
                        <h4>Module {modIdx + 1} is Locked</h4>
                        <p>
                          Trainees cannot access or click this module until <strong>Module {modIdx} ({prevMod?.title || `Module ${modIdx}`})</strong> is 100% completed.
                        </p>
                        <div className="locked-prereq-pill">
                          <span>Prerequisite status: <strong>{prevModProgress}% completed</strong> (100% required)</span>
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                {/* Unlocked Module Content Body */}
                {isModuleUnlocked && isModOpen && (
                  <div className="preview-module-body">
                    {mod.description && (
                      <div className="preview-module-description">
                        <p>{mod.description}</p>
                      </div>
                    )}

                    {children.length === 0 ? (
                      <div className="preview-empty-module-note">
                        <span>No lessons or assignments in this module.</span>
                      </div>
                    ) : (
                      <div className="preview-items-list">
                        {children.map((child, childIdx) => {
                          const isLesson = child.type === 'lesson';

                          if (isLesson) {
                            // Lesson Sequential Locking:
                            // If mod.sequentialLessonLock is true, lesson N requires lesson N-1 completed.
                            const isSequential = mod.sequentialLessonLock !== false;
                            let isLessonUnlocked = true;
                            let priorLessonTitle = '';

                            if (isSequential && child.index > 1) {
                              const priorLesson = children
                                .filter(c => c.type === 'lesson' && c.index < child.index)
                                .slice(-1)[0];
                              if (priorLesson) {
                                priorLessonTitle = priorLesson.title;
                                if (!completedLessonIds.has(priorLesson.id)) {
                                  isLessonUnlocked = false;
                                }
                              }
                            }

                            const isCompleted = completedLessonIds.has(child.id);

                            return (
                              <div
                                key={child.id || childIdx}
                                className={`preview-item-card lesson ${isLessonUnlocked ? 'unlocked' : 'locked'} ${isCompleted ? 'completed' : ''}`}
                                onClick={() => {
                                  if (!isLessonUnlocked) {
                                    setLockedClickAlert(`Lesson ${child.index} is locked! Complete "${priorLessonTitle}" first.`);
                                  } else {
                                    setActiveContentModal(child);
                                  }
                                }}
                              >
                                <div className="preview-item-left">
                                  {/* Completion Simulation Toggle */}
                                  <button
                                    type="button"
                                    className={`preview-complete-btn ${isCompleted ? 'completed' : ''}`}
                                    onClick={(e) => {
                                      if (!isLessonUnlocked) return;
                                      toggleLessonComplete(child.id, e);
                                    }}
                                    disabled={!isLessonUnlocked}
                                    title={isCompleted ? 'Mark incomplete' : 'Simulate complete lesson'}
                                  >
                                    {isCompleted ? (
                                      <CheckCircle2 size={20} className="check-icon" />
                                    ) : (
                                      <Circle size={20} className="circle-icon" />
                                    )}
                                  </button>

                                  <div className="preview-item-type-badge lesson">
                                    <Play size={12} />
                                    <span>Lesson {child.index}</span>
                                  </div>

                                  <div className="preview-item-details">
                                    <span className="preview-item-title">{child.title}</span>
                                    {child.stats && (
                                      <div className="preview-item-stats">
                                        {(child.stats.videos ?? 0) > 0 && <span>{child.stats.videos} video{(child.stats.videos || 0) > 1 ? 's' : ''}</span>}
                                        {(child.stats.resources ?? 0) > 0 && <span>{child.stats.resources} resource{(child.stats.resources || 0) > 1 ? 's' : ''}</span>}
                                      </div>
                                    )}
                                  </div>
                                </div>

                                <div className="preview-item-right">
                                  {!isLessonUnlocked ? (
                                    <span className="preview-item-lock-pill locked" title={`Requires completion of ${priorLessonTitle}`}>
                                      <Lock size={13} /> Complete L{child.index - 1} First
                                    </span>
                                  ) : isCompleted ? (
                                    <span className="preview-item-lock-pill done">
                                      <CheckCircle2 size={13} /> Watched & Completed
                                    </span>
                                  ) : (
                                    <span className="preview-item-lock-pill ready">
                                      <Play size={13} /> Click to Start
                                    </span>
                                  )}
                                </div>
                              </div>
                            );
                          } else {
                            // Assignment Locking:
                            // If child.lockUntilLessonsComplete is true:
                            // Check if all preceding lessons (or explicit dependsOnLessonIds) are completed.
                            let isAssignmentUnlocked = true;
                            let missingLessons: string[] = [];

                            if (child.lockUntilLessonsComplete) {
                              const reqLessonIds = child.dependsOnLessonIds && child.dependsOnLessonIds.length > 0
                                ? child.dependsOnLessonIds
                                : children.filter(c => c.type === 'lesson').map(l => l.id);

                              missingLessons = reqLessonIds.filter(id => !completedLessonIds.has(id));
                              if (missingLessons.length > 0) {
                                isAssignmentUnlocked = false;
                              }
                            }

                            const isCompleted = completedAssignmentIds.has(child.id);

                            return (
                              <div
                                key={child.id || childIdx}
                                className={`preview-item-card assignment ${isAssignmentUnlocked ? 'unlocked' : 'locked'} ${isCompleted ? 'completed' : ''}`}
                                onClick={() => {
                                  if (!isAssignmentUnlocked) {
                                    setLockedClickAlert(`Assignment ${child.index} is locked! Complete prerequisite lessons first.`);
                                  } else {
                                    setActiveContentModal(child);
                                  }
                                }}
                              >
                                <div className="preview-item-left">
                                  <button
                                    type="button"
                                    className={`preview-complete-btn ${isCompleted ? 'completed' : ''}`}
                                    onClick={(e) => {
                                      if (!isAssignmentUnlocked) return;
                                      toggleAssignmentComplete(child.id, e);
                                    }}
                                    disabled={!isAssignmentUnlocked}
                                    title={isCompleted ? 'Mark incomplete' : 'Simulate complete assignment'}
                                  >
                                    {isCompleted ? (
                                      <CheckCircle2 size={20} className="check-icon" />
                                    ) : (
                                      <Circle size={20} className="circle-icon" />
                                    )}
                                  </button>

                                  <div className="preview-item-type-badge assignment">
                                    <FileText size={12} />
                                    <span>Task {child.index}</span>
                                  </div>

                                  <div className="preview-item-details">
                                    <span className="preview-item-title">{child.title}</span>
                                    {child.stats && (
                                      <div className="preview-item-stats">
                                        {(child.stats.questions ?? 0) > 0 && <span>{child.stats.questions} question{(child.stats.questions || 0) > 1 ? 's' : ''}</span>}
                                      </div>
                                    )}
                                  </div>
                                </div>

                                <div className="preview-item-right">
                                  {!isAssignmentUnlocked ? (
                                    <span className="preview-item-lock-pill locked" title="Complete prerequisite lessons first">
                                      <Lock size={13} /> Locked ({missingLessons.length} lesson{missingLessons.length > 1 ? 's' : ''} left)
                                    </span>
                                  ) : isCompleted ? (
                                    <span className="preview-item-lock-pill done">
                                      <CheckCircle2 size={13} /> Submitted & Graded
                                    </span>
                                  ) : (
                                    <span className="preview-item-lock-pill ready task">
                                      <FileText size={13} /> Unlocked — Ready
                                    </span>
                                  )}
                                </div>
                              </div>
                            );
                          }
                        })}
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Trainee Content Modal Dialog for Previewing an Item */}
      {activeContentModal && (
        <div className="preview-modal-backdrop" onClick={() => setActiveContentModal(null)}>
          <div className="preview-modal-box" onClick={(e) => e.stopPropagation()}>
            <div className="preview-modal-header">
              <div className="preview-modal-title-group">
                <span className="preview-modal-tag">
                  {activeContentModal.type === 'lesson' ? 'LESSON PREVIEW' : 'TASK PREVIEW'}
                </span>
                <h3>{activeContentModal.title}</h3>
              </div>
              <button 
                type="button" 
                className="preview-modal-close-btn"
                onClick={() => setActiveContentModal(null)}
              >
                &times;
              </button>
            </div>

            <div className="preview-modal-body">
              <div className="preview-modal-notice">
                <span>This simulates the trainee's active learning view for this element.</span>
              </div>
              <div className="preview-modal-details-grid">
                <div className="preview-modal-stat">
                  <span className="stat-label">Element Type</span>
                  <span className="stat-val">{activeContentModal.type.toUpperCase()}</span>
                </div>
                <div className="preview-modal-stat">
                  <span className="stat-label">Lock Rule</span>
                  <span className="stat-val">
                    {activeContentModal.lockRule?.type === 'unlocked' ? 'Open Access' : 'Sequential / Prerequisite'}
                  </span>
                </div>
                {activeContentModal.stats?.videos !== undefined && (
                  <div className="preview-modal-stat">
                    <span className="stat-label">Videos</span>
                    <span className="stat-val">{activeContentModal.stats.videos} video(s)</span>
                  </div>
                )}
                {activeContentModal.stats?.questions !== undefined && (
                  <div className="preview-modal-stat">
                    <span className="stat-label">Questions</span>
                    <span className="stat-val">{activeContentModal.stats.questions} question(s)</span>
                  </div>
                )}
              </div>
            </div>

            <div className="preview-modal-footer">
              {activeContentModal.type === 'lesson' ? (
                <button
                  type="button"
                  className="preview-modal-action-btn"
                  onClick={() => {
                    toggleLessonComplete(activeContentModal.id);
                    setActiveContentModal(null);
                  }}
                >
                  {completedLessonIds.has(activeContentModal.id) ? 'Mark as Incomplete' : 'Mark Lesson as Completed'}
                </button>
              ) : (
                <button
                  type="button"
                  className="preview-modal-action-btn"
                  onClick={() => {
                    toggleAssignmentComplete(activeContentModal.id);
                    setActiveContentModal(null);
                  }}
                >
                  {completedAssignmentIds.has(activeContentModal.id) ? 'Mark as Incomplete' : 'Mark Task as Completed'}
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
