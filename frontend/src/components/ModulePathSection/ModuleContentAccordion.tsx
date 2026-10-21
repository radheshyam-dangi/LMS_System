/**
 * ModuleContentAccordion.tsx
 *
 * Trainee Learning Path Module Content Hierarchy & Accordion Component.
 * - Single-instance placement for multi-lesson dependencies: assignments appear strictly
 *   once beneath their final prerequisite lesson.
 * - Real-time prerequisite validation with subtle lock badges.
 * - Enterprise-grade styling tokens (border-border, bg-card, bg-muted/40).
 * - Structural Skeleton loaders for loading & edge states.
 * - Completely stripped duration tags.
 */

import React, { useState } from 'react';
import {
  ChevronDown,
  ChevronUp,
  CheckCircle2,
  Clock,
  Lock,
  Play,
  FileText,
  Award,
  Layers,
  Sparkles,
  BookOpen,
} from 'lucide-react';
import { useCurriculumDependencies } from './useCurriculumDependencies';
import type {
  CurriculumLesson,
  CurriculumAssignment,
  CurriculumLessonNode,
  CurriculumAssignmentNode,
} from './useCurriculumDependencies';
import { LessonCard } from '../SharedCards/LessonCard';
import { AssignmentCard } from '../SharedCards/AssignmentCard';

interface ModuleContentAccordionProps {
  moduleId: string;
  moduleTitle: string;
  moduleIndex?: number;
  moduleDescription?: string;
  lessons: CurriculumLesson[];
  tasks: CurriculumAssignment[];
  completedLessonIds: Set<string>;
  submissions: any[];
  sequentialLessonLock?: boolean;
  isTrainee?: boolean;
  isLocked?: boolean;
  lockReason?: string;
  isDefaultExpanded?: boolean;
  isLoading?: boolean;
  onStartLesson: (lessonIndex: number) => void;
  onAttemptAssignment: (task: any) => void;
  onVisitResource?: (res: any) => void;
  onMarkLessonWatched?: (lessonId: string) => void;
}

/**
 * Structural Skeleton loader matching the exact curriculum module and tree layout.
 */
export const ModuleAccordionSkeleton: React.FC = () => {
  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        gap: '16px',
        padding: '8px 0',
      }}
      aria-busy="true"
    >
      {[1, 2, 3].map((n) => (
        <div
          key={n}
          style={{
            background: '#ffffff',
            border: '1px solid #e2e8f0',
            borderRadius: '14px',
            padding: '20px 24px',
            boxShadow: '0 1px 3px rgba(15, 23, 42, 0.03)',
            display: 'flex',
            flexDirection: 'column',
            gap: '14px',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
              <div
                style={{
                  width: '34px',
                  height: '34px',
                  borderRadius: '10px',
                  background: 'linear-gradient(90deg, #f1f5f9 25%, #e2e8f0 50%, #f1f5f9 75%)',
                  backgroundSize: '200% 100%',
                  animation: 'shimmer 1.5s infinite',
                }}
              />
              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                <div
                  style={{
                    width: '180px',
                    height: '18px',
                    borderRadius: '4px',
                    background: 'linear-gradient(90deg, #f1f5f9 25%, #e2e8f0 50%, #f1f5f9 75%)',
                    backgroundSize: '200% 100%',
                    animation: 'shimmer 1.5s infinite',
                  }}
                />
                <div
                  style={{
                    width: '90px',
                    height: '12px',
                    borderRadius: '4px',
                    background: 'linear-gradient(90deg, #f1f5f9 25%, #e2e8f0 50%, #f1f5f9 75%)',
                    backgroundSize: '200% 100%',
                    animation: 'shimmer 1.5s infinite',
                  }}
                />
              </div>
            </div>
            <div
              style={{
                width: '110px',
                height: '32px',
                borderRadius: '999px',
                background: 'linear-gradient(90deg, #f1f5f9 25%, #e2e8f0 50%, #f1f5f9 75%)',
                backgroundSize: '200% 100%',
                animation: 'shimmer 1.5s infinite',
              }}
            />
          </div>
          <div
            style={{
              width: '100%',
              height: '50px',
              borderRadius: '8px',
              background: 'linear-gradient(90deg, #f8fafc 25%, #f1f5f9 50%, #f8fafc 75%)',
              backgroundSize: '200% 100%',
              animation: 'shimmer 1.5s infinite',
            }}
          />
        </div>
      ))}
    </div>
  );
};

export const ModuleContentAccordion: React.FC<ModuleContentAccordionProps> = ({
  moduleId,
  moduleTitle,
  moduleIndex = 0,
  moduleDescription,
  lessons,
  tasks,
  completedLessonIds,
  submissions,
  sequentialLessonLock = true,
  isTrainee = true,
  isLocked = false,
  lockReason,
  isDefaultExpanded = true,
  isLoading = false,
  onStartLesson,
  onAttemptAssignment,
  onVisitResource,
  onMarkLessonWatched,
}) => {
  const [isExpanded, setIsExpanded] = useState<boolean>(isDefaultExpanded);

  // Evaluate dependencies and single-instance placement
  const {
    resolvedLessons,
    standaloneTasks,
    progressPercent,
    completedItemsCount,
    totalItemsCount,
    isModuleFullyCompleted,
  } = useCurriculumDependencies({
    lessons,
    tasks,
    completedLessonIds,
    submissions,
    sequentialLessonLock,
    isTrainee,
  });

  if (isLoading) {
    return <ModuleAccordionSkeleton />;
  }

  // Module status pill
  let moduleStatus = 'In Progress';
  let statusTheme = { bg: '#eef2ff', color: '#4f46e5', border: '#e0e7ff' };

  if (isLocked) {
    moduleStatus = 'Locked';
    statusTheme = { bg: '#f8fafc', color: '#94a3b8', border: '#e2e8f0' };
  } else if (isModuleFullyCompleted) {
    moduleStatus = 'Completed';
    statusTheme = { bg: '#ecfdf5', color: '#059669', border: '#a7f3d0' };
  }

  return (
    <div
      className="module-accordion-container"
      style={{
        background: '#ffffff',
        border: '1px solid #e2e8f0',
        borderRadius: '14px',
        overflow: 'hidden',
        boxShadow: '0 1px 3px rgba(15, 23, 42, 0.04)',
        transition: 'all 0.2s cubic-bezier(0.16, 1, 0.3, 1)',
        marginBottom: '16px',
      }}
    >
      {/* ── Module Accordion Header Bar ── */}
      <div
        onClick={() => !isLocked && setIsExpanded(!isExpanded)}
        style={{
          padding: '18px 24px',
          background: isExpanded ? '#f8fafc' : '#ffffff',
          borderBottom: isExpanded ? '1px solid #e2e8f0' : 'none',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: '16px',
          cursor: isLocked ? 'not-allowed' : 'pointer',
          userSelect: 'none',
          transition: 'background 0.15s ease',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '14px', minWidth: 0, flex: 1 }}>
          {/* Module Icon Status */}
          <div
            style={{
              width: '36px',
              height: '36px',
              borderRadius: '10px',
              background: isLocked ? '#f1f5f9' : isModuleFullyCompleted ? '#22c55e' : '#4f46e5',
              color: '#ffffff',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              flexShrink: 0,
              boxShadow: isLocked
                ? 'none'
                : isModuleFullyCompleted
                ? '0 2px 6px rgba(34, 197, 94, 0.3)'
                : '0 2px 6px rgba(79, 70, 229, 0.3)',
            }}
          >
            {isLocked ? (
              <Lock size={15} color="#94a3b8" />
            ) : isModuleFullyCompleted ? (
              <CheckCircle2 size={18} />
            ) : (
              <Layers size={17} />
            )}
          </div>

          <div style={{ minWidth: 0, flex: 1 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '2px' }}>
              <span
                style={{
                  fontSize: '11px',
                  fontWeight: 800,
                  textTransform: 'uppercase',
                  letterSpacing: '0.05em',
                  color: '#64748b',
                }}
              >
                Module {moduleIndex + 1}
              </span>
              <span style={{ color: '#cbd5e1' }}>•</span>
              <span style={{ fontSize: '11.5px', color: '#64748b' }}>
                {resolvedLessons.length} {resolvedLessons.length === 1 ? 'Lesson' : 'Lessons'}
                {tasks.length > 0 && ` · ${tasks.length} ${tasks.length === 1 ? 'Task' : 'Tasks'}`}
              </span>
            </div>

            <h3
              style={{
                fontSize: '16.5px',
                fontWeight: 700,
                color: isLocked ? '#64748b' : '#0f172a',
                margin: 0,
                letterSpacing: '-0.015em',
                lineHeight: 1.3,
              }}
            >
              {moduleTitle}
            </h3>

            {isLocked && lockReason && (
              <span
                style={{
                  fontSize: '11.5px',
                  color: '#b45309',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '4px',
                  marginTop: '4px',
                  fontWeight: 500,
                }}
              >
                <Lock size={11} /> {lockReason}
              </span>
            )}
          </div>
        </div>

        {/* Right Info: Progress & Chevron */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '14px', flexShrink: 0 }}>
          {/* Progress pill */}
          {!isLocked && (
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <div
                style={{
                  width: '70px',
                  height: '6px',
                  borderRadius: '999px',
                  background: '#e2e8f0',
                  overflow: 'hidden',
                }}
              >
                <div
                  style={{
                    height: '100%',
                    width: `${progressPercent}%`,
                    background: isModuleFullyCompleted ? '#22c55e' : '#4f46e5',
                    borderRadius: '999px',
                    transition: 'width 0.3s ease',
                  }}
                />
              </div>

              <span
                style={{
                  fontSize: '11.5px',
                  fontWeight: 700,
                  padding: '3px 10px',
                  borderRadius: '999px',
                  background: statusTheme.bg,
                  color: statusTheme.color,
                  border: `1px solid ${statusTheme.border}`,
                }}
              >
                {progressPercent}% · {moduleStatus}
              </span>
            </div>
          )}

          {!isLocked && (
            <div
              style={{
                width: '28px',
                height: '28px',
                borderRadius: '6px',
                background: '#ffffff',
                border: '1px solid #e2e8f0',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: '#64748b',
              }}
            >
              {isExpanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
            </div>
          )}
        </div>
      </div>

      {/* ── Module Internal Contents Tree ── */}
      {isExpanded && !isLocked && (
        <div
          style={{
            padding: '24px',
            display: 'flex',
            flexDirection: 'column',
            gap: '20px',
            background: '#ffffff',
          }}
        >
          {/* Lesson Nodes Sequence */}
          {resolvedLessons.map((node, lIdx) => {
            return (
              <div key={node.lesson.id} style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                {/* Lesson Card */}
                <LessonCard
                  lesson={{
                    ...node.lesson,
                    title: `${lIdx + 1}. ${node.lesson.title}`,
                  }}
                  isDone={node.isCompleted}
                  isLocked={node.isLocked}
                  lockReason={node.lockReason}
                  isTrainee={isTrainee}
                  resources={node.lesson.resources}
                  onVisitResource={onVisitResource}
                  onMarkWatched={onMarkLessonWatched}
                  onStartLesson={() => onStartLesson(lIdx)}
                  onClickLocked={() => {}}
                />

                {/* ── SINGLE-INSTANCE DEDUPLICATED DEPENDENT ASSIGNMENTS ── */}
                {/* Renders strictly once directly beneath the final prerequisite lesson */}
                {node.dependentAssignments.length > 0 && (
                  <div
                    style={{
                      marginLeft: '28px',
                      paddingLeft: '20px',
                      borderLeft: '2px dashed #cbd5e1',
                      display: 'flex',
                      flexDirection: 'column',
                      gap: '10px',
                      marginTop: '2px',
                    }}
                  >
                    <div
                      style={{
                        fontSize: '11px',
                        fontWeight: 700,
                        color: '#4f46e5',
                        textTransform: 'uppercase',
                        letterSpacing: '0.05em',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '6px',
                      }}
                    >
                      <Sparkles size={12} />
                      Dependent Assessment{node.dependentAssignments.length > 1 ? 's' : ''} for Lesson {lIdx + 1}
                    </div>

                    {node.dependentAssignments.map((aNode) => (
                      <AssignmentCard
                        key={aNode.task.id}
                        task={{
                          ...aNode.task,
                          lessonTitle: `Lesson ${lIdx + 1}`,
                        }}
                        submission={aNode.submission}
                        isLocked={aNode.isLocked}
                        lockReason={aNode.lockReason}
                        isTrainee={isTrainee}
                        onAttempt={onAttemptAssignment}
                      />
                    ))}
                  </div>
                )}
              </div>
            );
          })}

          {/* ── Standalone / Capstone Module Tasks (No lesson dependency) ── */}
          {standaloneTasks.length > 0 && (
            <div
              style={{
                marginTop: '12px',
                paddingTop: '20px',
                borderTop: '1px solid #f1f5f9',
                display: 'flex',
                flexDirection: 'column',
                gap: '12px',
              }}
            >
              <div
                style={{
                  fontSize: '11.5px',
                  fontWeight: 800,
                  color: '#475569',
                  textTransform: 'uppercase',
                  letterSpacing: '0.05em',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                }}
              >
                <Award size={13} color="#f59e0b" />
                Module Capstone Assessments ({standaloneTasks.length})
              </div>

              {standaloneTasks.map((aNode) => (
                <AssignmentCard
                  key={aNode.task.id}
                  task={{
                    ...aNode.task,
                    lessonTitle: 'Module Assessment',
                  }}
                  submission={aNode.submission}
                  isLocked={aNode.isLocked}
                  lockReason={aNode.lockReason}
                  isTrainee={isTrainee}
                  onAttempt={onAttemptAssignment}
                />
              ))}
            </div>
          )}

          {resolvedLessons.length === 0 && tasks.length === 0 && (
            <div
              style={{
                padding: '36px',
                textAlign: 'center',
                color: '#94a3b8',
                background: '#f8fafc',
                borderRadius: '10px',
                border: '1px dashed #cbd5e1',
                fontSize: '13.5px',
              }}
            >
              No lessons or assessments available in this module yet.
            </div>
          )}
        </div>
      )}
    </div>
  );
};
