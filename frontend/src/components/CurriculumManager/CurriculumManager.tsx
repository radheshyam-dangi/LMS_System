import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { curriculumService } from '../../services/curriculumService';
import { learningPathService } from '../../services/learningPathService';
import { userService } from '../../services/userService';
import { useNavigate } from 'react-router-dom';
import { RichText } from '../common/RichText';
import { RichTextEditor } from '../common/RichTextEditor';
import DOMPurify from 'dompurify';
import './CurriculumManager.css';

interface CurriculumManagerProps {
  learningPathId: string;
  learningPathTitle: string;
  currentUser: { id: string; role: 'Admin' | 'Trainer' | 'Trainee' };
  accessToken: string;
  onBack: () => void;
}

type InspectType = 'MODULE' | 'LESSON' | 'TASK' | 'RESOURCE';

interface InspectContext {
  moduleTitle?: string;
  moduleId?: string;
  lessonTitle?: string;
  lessonId?: string;
}

interface InspectItem {
  type: InspectType;
  data: any;
  context?: InspectContext;
}

/**
 * 🌟 FormattedRichContent
 * Intelligently renders rich text, raw HTML, Tiptap JSON, or plain text without raw markup.
 */
function FormattedRichContent({
  content,
  emptyText = 'No description provided.',
  className = '',
}: {
  content?: string | any | null;
  emptyText?: string;
  className?: string;
}) {
  if (!content) {
    return <span className="cm-text-muted-italic">{emptyText}</span>;
  }

  if (typeof content === 'string') {
    const trimmed = content.trim();
    if (!trimmed) {
      return <span className="cm-text-muted-italic">{emptyText}</span>;
    }

    // Check if content contains HTML tags (e.g., <p>, <em>, <strong>, etc.)
    if (/<[a-z][\s\S]*>/i.test(trimmed)) {
      const sanitized = DOMPurify.sanitize(trimmed);
      return (
        <div
          className={`cm-formatted-content ${className}`}
          dangerouslySetInnerHTML={{ __html: sanitized }}
        />
      );
    }

    // Plain text with line breaks
    return (
      <div className={`cm-formatted-content ${className}`} style={{ whiteSpace: 'pre-wrap' }}>
        {trimmed}
      </div>
    );
  }

  // Tiptap JSON structured object
  return <RichText content={content} emptyStateText={emptyText} className={className} />;
}

/**
 * Helper to extract video embed URL for YouTube/Vimeo
 */
function getEmbedVideoUrl(url: string): string | null {
  if (!url) return null;
  const ytMatch = url.match(/(?:youtube\.com\/(?:watch\?v=|embed\/)|youtu\.be\/)([a-zA-Z0-9_-]{11})/);
  if (ytMatch && ytMatch[1]) {
    return `https://www.youtube.com/embed/${ytMatch[1]}`;
  }
  const vimeoMatch = url.match(/vimeo\.com\/(?:video\/)?([0-9]+)/);
  if (vimeoMatch && vimeoMatch[1]) {
    return `https://player.vimeo.com/video/${vimeoMatch[1]}`;
  }
  return null;
}

/**
 * Resilient question extractor for MCQ and Subjective tasks
 */
function extractTaskQuestions(task: any): any[] {
  if (!task) return [];
  if (Array.isArray(task.mcqConfig?.questions) && task.mcqConfig.questions.length > 0) {
    return task.mcqConfig.questions;
  }
  if (Array.isArray(task.questions) && task.questions.length > 0) {
    return task.questions;
  }
  if (task.mcqConfig && Array.isArray(task.mcqConfig.options) && task.mcqConfig.options.length > 0) {
    return [
      {
        id: 'q-legacy',
        questionText: task.instructions || task.title || 'Question',
        options: task.mcqConfig.options,
        correctIndex: task.mcqConfig.correctIndex ?? 0,
        points: task.maxScore || 10,
      },
    ];
  }
  return [];
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

  // 👁️ Inspector State & Navigation Stack
  const [inspectItem, setInspectItem] = useState<InspectItem | null>(null);
  const [inspectorHistory, setInspectorHistory] = useState<InspectItem[]>([]);
  const [copyFeedback, setCopyFeedback] = useState<string | null>(null);

  // Search & Filtering State
  const [searchQuery, setSearchQuery] = useState('');
  const [collapsedModules, setCollapsedModules] = useState<Record<string, boolean>>({});

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
        userService.fetchAllUsers(accessToken).catch(() => []),
      ]);

      if (pathData) setPathDetails(pathData);
      setModules(modulesData || []);

      if (modulesData && modulesData.length > 0 && modulesData[0].learningPath && !pathData) {
        setPathDetails(modulesData[0].learningPath);
      }

      // Filter for Trainees only
      const traineeList = (usersData || []).filter((u: any) => {
        const roles = [
          u.role,
          u.primaryRole?.name,
          ...(Array.isArray(u.roles) ? u.roles.map((r: any) => r.name || r) : []),
        ].map((r) => String(r || '').toLowerCase());
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

  // 🌟 OWNERSHIP CHECK
  const isAdmin = currentUser.role === 'Admin' || String(currentUser.role).toLowerCase() === 'admin';
  const isTrainee = currentUser.role === 'Trainee' || String(currentUser.role).toLowerCase() === 'trainee';

  const pathOwnerId =
    pathDetails?.createdBy?.id ||
    (typeof pathDetails?.createdBy === 'string' ? pathDetails.createdBy : null) ||
    pathDetails?.createdById;
  const currentUserId = currentUser.id;
  const isOwner = !pathOwnerId || (Boolean(pathOwnerId) && String(pathOwnerId).toLowerCase() === String(currentUserId).toLowerCase());
  const isOwnerOrAdmin = !isTrainee && (isAdmin || isOwner);

  // Build Lesson Title Lookup Map for AI Grounding and Context Resolution
  const lessonTitleMap = useMemo(() => {
    const map = new Map<string, { title: string; moduleTitle: string }>();
    modules.forEach((m) => {
      (m.lessons || []).forEach((l: any) => {
        map.set(String(l.id), { title: l.title, moduleTitle: m.title });
      });
    });
    return map;
  }, [modules]);

  // Summary Metrics
  const summaryStats = useMemo(() => {
    const totalModules = modules.length;
    let totalLessons = 0;
    let totalAssignments = 0;
    let totalResources = 0;
    let estimatedWeeks = 0;

    modules.forEach((m) => {
      estimatedWeeks += Number(m.durationWeeks) || 2;
      totalResources += (m.resources?.length || 0);
      const modAssignments = (m.assignments || []).filter((a: any) => !a.lessonId);
      totalAssignments += modAssignments.length;

      (m.lessons || []).forEach((l: any) => {
        totalLessons += 1;
        totalAssignments += (l.assignments?.length || 0);
        totalResources += (l.resources?.length || 0);
      });
    });

    return { totalModules, totalLessons, totalAssignments, totalResources, estimatedWeeks };
  }, [modules]);

  // Filtered Modules
  const filteredModules = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return modules;

    return modules.filter((m) => {
      const matchMod =
        (m.title && m.title.toLowerCase().includes(q)) ||
        (m.description && m.description.toLowerCase().includes(q)) ||
        (Array.isArray(m.objectives) && m.objectives.some((o: string) => o.toLowerCase().includes(q))) ||
        (Array.isArray(m.outcomes) && m.outcomes.some((o: string) => o.toLowerCase().includes(q)));

      const matchLessons = (m.lessons || []).some((l: any) =>
        (l.title && l.title.toLowerCase().includes(q)) ||
        (l.description && l.description.toLowerCase().includes(q)) ||
        (l.assignments || []).some((a: any) => a.title && a.title.toLowerCase().includes(q))
      );

      const matchModAssignments = (m.assignments || []).some((a: any) =>
        a.title && a.title.toLowerCase().includes(q)
      );

      return matchMod || matchLessons || matchModAssignments;
    });
  }, [modules, searchQuery]);

  // Form Reset
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
    setInspectorHistory([]);
    setTargetModuleId(null);
    setTargetLessonId(null);
    setFormModuleLessonLocking(false);
    setFormModuleTaskLocking(false);
  };

  // 👁️ Open Inspector with History Stack
  const openInspector = (
    type: InspectType,
    data: any,
    context?: InspectContext,
    pushHistory = true
  ) => {
    if (pushHistory && inspectItem) {
      setInspectorHistory((prev) => [...prev, inspectItem]);
    }
    setInspectItem({ type, data, context });
    setActiveModal('VIEW_INSPECTOR');
  };

  const handleInspectorBack = () => {
    if (inspectorHistory.length === 0) return;
    const previous = inspectorHistory[inspectorHistory.length - 1];
    setInspectorHistory((prev) => prev.slice(0, prev.length - 1));
    setInspectItem(previous);
  };

  const closeInspector = () => {
    setInspectItem(null);
    setInspectorHistory([]);
    setActiveModal(null);
  };

  // Keyboard Escape Handler
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && activeModal) {
        if (activeModal === 'VIEW_INSPECTOR') {
          closeInspector();
        } else {
          resetFormFields();
        }
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [activeModal]);

  const copyToClipboard = (text: string, label: string) => {
    navigator.clipboard.writeText(text);
    setCopyFeedback(label);
    setTimeout(() => setCopyFeedback(null), 2000);
  };

  const toggleModuleCollapse = (moduleId: string) => {
    setCollapsedModules((prev) => ({ ...prev, [moduleId]: !prev[moduleId] }));
  };

  const toggleAllCollapse = () => {
    const areAllCollapsed = modules.every((m) => collapsedModules[m.id]);
    const next: Record<string, boolean> = {};
    modules.forEach((m) => {
      next[m.id] = !areAllCollapsed;
    });
    setCollapsedModules(next);
  };

  const handleFormSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isOwnerOrAdmin || !formTitle.trim() || isSubmitting) return;

    setIsSubmitting(true);
    try {
      if (activeModal === 'MODULE') {
        const resources = formResourceUrl.trim() ? [{ title: 'Resource', url: formResourceUrl.trim() }] : [];
        await curriculumService.createModule(
          {
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
          },
          accessToken
        );
      } else if (activeModal === 'EDIT_MODULE' && editingItemId) {
        const resources = formResourceUrl.trim() ? [{ title: 'Resource', url: formResourceUrl.trim() }] : [];
        await curriculumService.updateModule(
          editingItemId,
          {
            title: formTitle,
            description: formDescription,
            objectives: formObjectives,
            outcomes: formOutcomes,
            durationWeeks: formDurationWeeks,
            durationLabel: `${formDurationWeeks} weeks`,
            lessonLocking: formModuleLessonLocking,
            taskLocking: formModuleTaskLocking,
            resources,
          },
          accessToken
        );
      } else if (activeModal === 'LESSON') {
        if (!targetModuleId) {
          alert('Module ID missing. Please select a module.');
          setIsSubmitting(false);
          return;
        }
        await curriculumService.createLesson(
          {
            title: formTitle,
            description: formDescription,
            videoUrl: formVideoUrl || undefined,
            articleUrl: formArticleUrl || undefined,
            durationMinutes: Number(formDurationMinutes) || 15,
            moduleId: targetModuleId,
          },
          accessToken
        );
      } else if (activeModal === 'EDIT_LESSON' && editingItemId) {
        await curriculumService.updateLesson(
          editingItemId,
          {
            title: formTitle,
            description: formDescription,
            videoUrl: formVideoUrl,
            articleUrl: formArticleUrl,
            durationMinutes: Number(formDurationMinutes),
          },
          accessToken
        );
      } else if (activeModal === 'TASK' || activeModal === 'EDIT_TASK') {
        const isExternal = formAssignmentType === 'External';

        if (!isExternal && !targetLessonId && (!targetModuleId || targetModuleId === '')) {
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
          sequenceIndex: null,
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
      {/* 🌟 Navigation */}
      <button type="button" onClick={onBack} className="cm-btn-back">
        <span>←</span> Back to All Learning Paths
      </button>

      {/* 🌟 Header Section */}
      <header className="cm-header-section">
        <div>
          <div className="cm-header-badge-row">
            <span className="cm-badge cm-badge-blue">Learning Path Curriculum</span>
            <span className="cm-badge cm-badge-gray">
              {isOwnerOrAdmin ? 'Trainer & Admin Controls' : 'Read-Only Inspector'}
            </span>
          </div>
          <h2 className="cm-header-title">Curriculum Management: {learningPathTitle}</h2>
          <p className="cm-header-subtitle">
            {isOwnerOrAdmin
              ? 'Comprehensive curriculum tree. Inspect internal modules, lessons, assignments, and learning resources.'
              : 'Read-Only Mode: Inspect internal modules, lessons, tasks, and attached resources.'}
          </p>
        </div>

        {isOwnerOrAdmin && (
          <div>
            <button
              type="button"
              onClick={() => navigate(`/learning-paths/${learningPathId}/edit`)}
              className="cm-btn-primary"
            >
              ✏️ Edit Learning Path
            </button>
          </div>
        )}
      </header>

      {/* 🌟 Stats & Quick Filter Ribbon */}
      <div className="cm-stats-ribbon">
        <div className="cm-stats-items">
          <div className="cm-stat-pill">
            <span>📦</span>
            <div>
              <strong>{summaryStats.totalModules}</strong> Modules
            </div>
          </div>
          <div className="cm-stat-pill-divider" />
          <div className="cm-stat-pill">
            <span>📖</span>
            <div>
              <strong>{summaryStats.totalLessons}</strong> Lessons
            </div>
          </div>
          <div className="cm-stat-pill-divider" />
          <div className="cm-stat-pill">
            <span>📝</span>
            <div>
              <strong>{summaryStats.totalAssignments}</strong> Tasks
            </div>
          </div>
          <div className="cm-stat-pill-divider" />
          <div className="cm-stat-pill">
            <span>📎</span>
            <div>
              <strong>{summaryStats.totalResources}</strong> Resources
            </div>
          </div>
          <div className="cm-stat-pill-divider" />
          <div className="cm-stat-pill">
            <span>⏱️</span>
            <div>
              <strong>{summaryStats.estimatedWeeks}</strong> Est. Weeks
            </div>
          </div>
        </div>

        <div className="cm-toolbar-controls">
          <div className="cm-search-input-wrap">
            <span className="cm-search-icon">🔍</span>
            <input
              type="text"
              className="cm-search-input"
              placeholder="Search curriculum items..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>

          {modules.length > 1 && (
            <button type="button" onClick={toggleAllCollapse} className="cm-btn-secondary">
              {modules.every((m) => collapsedModules[m.id]) ? 'Expand All' : 'Collapse All'}
            </button>
          )}
        </div>
      </div>

      {/* 🌟 Curriculum Tree Content */}
      {isLoading ? (
        <div className="cm-empty-state">
          <p>⏳ Loading curriculum tree...</p>
          <span style={{ fontSize: '13px', color: '#64748b' }}>
            Fetching modules, lessons, assignments, and resources...
          </span>
        </div>
      ) : filteredModules.length === 0 ? (
        <div className="cm-empty-state">
          <p>{searchQuery ? 'No matching curriculum items found.' : 'No modules created yet.'}</p>
          <span style={{ fontSize: '13px', color: '#64748b' }}>
            {searchQuery
              ? 'Try adjusting your search query or clear the filter.'
              : 'Add modules to this learning path in the curriculum editor.'}
          </span>
        </div>
      ) : (
        filteredModules.map((module, mIdx) => {
          const isCollapsed = Boolean(collapsedModules[module.id]);
          const modAssignments = (module.assignments || []).filter((a: any) => !a.lessonId);
          const hasObjectives = Array.isArray(module.objectives) && module.objectives.length > 0;
          const hasOutcomes = Array.isArray(module.outcomes) && module.outcomes.length > 0;
          const hasResources = Array.isArray(module.resources) && module.resources.length > 0;

          return (
            <div key={module.id} className="cm-module-card">
              {/* Module Header */}
              <div className="cm-module-header">
                <div className="cm-module-title-group">
                  <span className="cm-module-index-badge">Module {mIdx + 1}</span>
                  <h3 className="cm-module-title">{module.title}</h3>

                  <div className="cm-badge-cluster">
                    <span className="cm-badge cm-badge-blue">
                      ⏱️ {module.durationWeeks ? `${module.durationWeeks} Weeks` : module.durationLabel || '2 Weeks'}
                    </span>
                    <span className="cm-badge cm-badge-gray">
                      Skill: {module.difficultyLevel || module.level || 'Beginner'}
                    </span>
                    <span className="cm-badge cm-badge-emerald">
                      Status: {module.status || 'Active'}
                    </span>
                    {module.lessonLocking && (
                      <span className="cm-badge cm-badge-purple" title="Lessons unlock sequentially">
                        🔒 Sequential Lessons
                      </span>
                    )}
                    {module.taskLocking && (
                      <span className="cm-badge cm-badge-amber" title="Tasks require all lessons completion">
                        🛡️ Gated Tasks
                      </span>
                    )}
                  </div>
                </div>

                <div className="cm-actions-cluster">
                  <button
                    type="button"
                    onClick={() => openInspector('MODULE', module, { moduleTitle: module.title, moduleId: module.id })}
                    className="cm-btn-sm cm-btn-view-primary"
                  >
                    👁️ View Details
                  </button>
                  <button
                    type="button"
                    onClick={() => toggleModuleCollapse(module.id)}
                    className="cm-btn-sm cm-btn-view"
                    title={isCollapsed ? 'Expand module content' : 'Collapse module content'}
                  >
                    {isCollapsed ? '▼ Expand' : '▲ Collapse'}
                  </button>
                </div>
              </div>

              {/* Module Description with formatted rich text */}
              {!isCollapsed && (
                <>
                  <div className="cm-module-description">
                    <FormattedRichContent content={module.description} emptyText="No module description provided." />
                  </div>

                  {/* Micro Chips preview for Objectives, Outcomes, and Resources */}
                  {(hasObjectives || hasOutcomes || hasResources) && (
                    <div className="cm-objectives-preview-bar">
                      {hasObjectives && (
                        <div
                          className="cm-micro-chip cm-micro-chip-purple"
                          onClick={() => openInspector('MODULE', module, { moduleTitle: module.title, moduleId: module.id })}
                          title="Click to view learning objectives"
                        >
                          <span>🎯</span> {module.objectives.length} Learning Objectives
                        </div>
                      )}
                      {hasOutcomes && (
                        <div
                          className="cm-micro-chip cm-micro-chip-green"
                          onClick={() => openInspector('MODULE', module, { moduleTitle: module.title, moduleId: module.id })}
                          title="Click to view learning outcomes"
                        >
                          <span>🏆</span> {module.outcomes.length} Expected Outcomes
                        </div>
                      )}
                      {hasResources && (
                        <div
                          className="cm-micro-chip cm-micro-chip-blue"
                          onClick={() => openInspector('MODULE', module, { moduleTitle: module.title, moduleId: module.id })}
                          title="Click to view module resources"
                        >
                          <span>📎</span> {module.resources.filter((r: any) => !r.lesson && !r.lessonId).length} Module Resources
                        </div>
                      )}
                    </div>
                  )}

                  {/* Module Resources Shelf (if present) */}
                  {hasResources && module.resources.filter((r: any) => !r.lesson && !r.lessonId).length > 0 && (
                    <div className="cm-card-resources-shelf">
                      <div className="cm-shelf-title">
                        <span>📎 Attached Module Resources ({module.resources.filter((r: any) => !r.lesson && !r.lessonId).length})</span>
                      </div>
                      <div className="cm-resource-items-grid">
                        {module.resources.filter((r: any) => !r.lesson && !r.lessonId).map((res: any, rIdx: number) => (
                          <div
                            key={res.id || rIdx}
                            className="cm-resource-item-pill"
                            onClick={() =>
                              openInspector('RESOURCE', res, { moduleTitle: module.title, moduleId: module.id })
                            }
                            title="Click to inspect resource details"
                          >
                            <span>{res.type === 'Video' ? '🎥' : res.type === 'PDF' ? '📄' : '🔗'}</span>
                            <span>{res.title || 'Attached Resource'}</span>
                            <span style={{ fontSize: '11px', color: '#94a3b8' }}>↗</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* MODULE-LEVEL ASSIGNMENTS */}
                  {modAssignments.length > 0 && (
                    <div className="cm-module-assignments-box">
                      <div className="cm-assignments-title">
                        <span>📌 Module-Level Assignments ({modAssignments.length})</span>
                        <span style={{ fontSize: '12px', fontWeight: 600, color: '#9333ea' }}>
                          Standalone module milestones
                        </span>
                      </div>

                      {modAssignments.map((task: any) => {
                        const questions = extractTaskQuestions(task);
                        return (
                          <div key={task.id} className="cm-task-item">
                            <div className="cm-task-info">
                              <div className="cm-task-header-row">
                                <span
                                  className={`cm-badge ${
                                    task.assignmentType === 'MCQ'
                                      ? 'cm-badge-amber'
                                      : task.assignmentType === 'External'
                                      ? 'cm-badge-emerald'
                                      : 'cm-badge-purple'
                                  }`}
                                >
                                  {task.assignmentType === 'MCQ'
                                    ? '🔘 MCQ Quiz'
                                    : task.assignmentType === 'External'
                                    ? '🔗 External'
                                    : '📝 Subjective'}
                                </span>
                                <strong className="cm-task-title">{task.title}</strong>
                              </div>

                              <div className="cm-task-meta-row">
                                <span className="cm-task-meta-item">
                                  🏆 <strong>{task.maxScore || 100}</strong> Pts
                                </span>
                                {(task.durationDays > 0 || task.durationHours > 0 || task.durationMinutes > 0) && (
                                  <span className="cm-task-meta-item">
                                    ⏳ {task.durationDays ? `${task.durationDays}d ` : ''}
                                    {task.durationHours ? `${task.durationHours}h ` : ''}
                                    {task.durationMinutes ? `${task.durationMinutes}m` : ''}
                                  </span>
                                )}
                                {questions.length > 0 && (
                                  <span className="cm-task-meta-item">
                                    ❓ {questions.length} Question{questions.length > 1 ? 's' : ''}
                                  </span>
                                )}
                                {task.anchorType && (
                                  <span className="cm-task-meta-item" style={{ color: '#8b5cf6' }}>
                                    ⚓ {task.anchorType === 'TASK_UNLOCKED' ? 'On Unlock' : 'On LP Assignment'}
                                  </span>
                                )}
                              </div>
                            </div>

                            <div className="cm-actions-cluster">
                              <button
                                type="button"
                                onClick={() =>
                                  openInspector('TASK', task, {
                                    moduleTitle: module.title,
                                    moduleId: module.id,
                                  })
                                }
                                className="cm-btn-sm cm-btn-view"
                              >
                                👁️ View
                              </button>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}

                  {/* LESSONS TREE */}
                  <div className="cm-lesson-tree-wrapper">
                    <div className="cm-lessons-header-strip">
                      <span>📖 Module Lessons ({module.lessons?.length || 0})</span>
                      <span style={{ fontSize: '12px', fontWeight: 600, color: '#64748b' }}>
                        Curriculum structure & learning materials
                      </span>
                    </div>

                    {(module.lessons || []).length === 0 ? (
                      <div style={{ padding: '14px', background: '#f8fafc', borderRadius: '10px', color: '#94a3b8', fontStyle: 'italic', fontSize: '13px' }}>
                        No lessons added to this module yet.
                      </div>
                    ) : (
                      module.lessons.map((lesson: any, lIdx: number) => {
                        const lessonHasResources = Array.isArray(lesson.resources) && lesson.resources.length > 0;
                        const lessonAssignments = lesson.assignments || [];

                        return (
                          <div key={lesson.id} className="cm-lesson-item">
                            <div className="cm-lesson-header">
                              <div className="cm-lesson-title-area">
                                <h4 className="cm-lesson-title">
                                  📖 Lesson {lesson.displayOrder || lIdx + 1}: {lesson.title}
                                </h4>

                                <div className="cm-badge-cluster">
                                  <span className="cm-badge cm-badge-gray">
                                    ⏱️ {lesson.durationMinutes || 15} mins
                                  </span>
                                  {lesson.videoUrl && (
                                    <span className="cm-badge cm-badge-blue">
                                      🎥 Video
                                    </span>
                                  )}
                                  {lesson.articleUrl && (
                                    <span className="cm-badge cm-badge-purple">
                                      📰 Article
                                    </span>
                                  )}
                                  {lessonHasResources && (
                                    <span className="cm-badge cm-badge-cyan">
                                      📎 {lesson.resources.length} Resources
                                    </span>
                                  )}
                                  {lessonAssignments.length > 0 && (
                                    <span className="cm-badge cm-badge-amber">
                                      📝 {lessonAssignments.length} Tasks
                                    </span>
                                  )}
                                </div>
                              </div>

                              <div className="cm-actions-cluster">
                                <button
                                  type="button"
                                  onClick={() =>
                                    openInspector('LESSON', lesson, {
                                      moduleTitle: module.title,
                                      moduleId: module.id,
                                    })
                                  }
                                  className="cm-btn-sm cm-btn-view"
                                >
                                  👁️ View
                                </button>
                              </div>
                            </div>

                            {/* Lesson Description formatted */}
                            {lesson.description && (
                              <div className="cm-lesson-description">
                                <FormattedRichContent content={lesson.description} emptyText="" />
                              </div>
                            )}

                            {/* Lesson Resources Pills (if any) */}
                            {lessonHasResources && (
                              <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap', marginBottom: '10px' }}>
                                {lesson.resources.map((res: any, rIdx: number) => (
                                  <div
                                    key={res.id || rIdx}
                                    className="cm-resource-item-pill"
                                    style={{ fontSize: '11px', padding: '4px 8px' }}
                                    onClick={() =>
                                      openInspector('RESOURCE', res, {
                                        moduleTitle: module.title,
                                        lessonTitle: lesson.title,
                                      })
                                    }
                                  >
                                    <span>{res.type === 'PDF' ? '📄' : res.type === 'Video' ? '🎥' : '🔗'}</span>
                                    <span>{res.title || 'Resource'}</span>
                                  </div>
                                ))}
                              </div>
                            )}

                            {/* Lesson Tasks */}
                            {lessonAssignments.map((task: any) => {
                              const questions = extractTaskQuestions(task);
                              return (
                                <div key={task.id} className="cm-lesson-task-item">
                                  <div>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
                                      <span
                                        className={`cm-badge ${
                                          task.assignmentType === 'MCQ'
                                            ? 'cm-badge-amber'
                                            : task.assignmentType === 'External'
                                            ? 'cm-badge-emerald'
                                            : 'cm-badge-purple'
                                        }`}
                                      >
                                        {task.assignmentType}
                                      </span>
                                      <strong>{task.title}</strong>
                                    </div>
                                    <div className="cm-task-meta-row">
                                      <span>Max Score: {task.maxScore || 100} pts</span>
                                      {questions.length > 0 && <span>• {questions.length} Questions</span>}
                                      {(task.durationDays > 0 || task.durationHours > 0 || task.durationMinutes > 0) && (
                                        <span>
                                          • Duration: {task.durationDays ? `${task.durationDays}d ` : ''}
                                          {task.durationHours ? `${task.durationHours}h ` : ''}
                                          {task.durationMinutes ? `${task.durationMinutes}m` : ''}
                                        </span>
                                      )}
                                    </div>
                                  </div>

                                  <div className="cm-actions-cluster">
                                    <button
                                      type="button"
                                      onClick={() =>
                                        openInspector('TASK', task, {
                                          moduleTitle: module.title,
                                          lessonTitle: lesson.title,
                                          moduleId: module.id,
                                          lessonId: lesson.id,
                                        })
                                      }
                                      className="cm-btn-sm cm-btn-view"
                                    >
                                      👁️ View
                                    </button>
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        );
                      })
                    )}
                  </div>
                </>
              )}
            </div>
          );
        })
      )}

      {/* ========================================================================= */}
      {/* 👁️ MASTER INSPECTOR MODAL (MODULE, LESSON, TASK, RESOURCE)              */}
      {/* ========================================================================= */}
      {activeModal === 'VIEW_INSPECTOR' && inspectItem && (
        <div className="cm-modal-overlay" onClick={closeInspector}>
          <div
            className="cm-modal-content wide"
            onClick={(e) => e.stopPropagation()}
            role="dialog"
            aria-modal="true"
          >
            {/* Modal Header */}
            <div className="cm-inspector-header">
              <div style={{ flex: 1 }}>
                <div className="cm-inspector-nav-row">
                  {inspectorHistory.length > 0 && (
                    <button
                      type="button"
                      onClick={handleInspectorBack}
                      className="cm-history-back-btn"
                      title="Go back to previous viewed item"
                    >
                      ← Back
                    </button>
                  )}
                  <span
                    className={`cm-inspector-type-pill ${
                      inspectItem.type === 'MODULE'
                        ? 'cm-badge-blue'
                        : inspectItem.type === 'LESSON'
                        ? 'cm-badge-cyan'
                        : inspectItem.type === 'TASK'
                        ? 'cm-badge-purple'
                        : 'cm-badge-emerald'
                    }`}
                  >
                    {inspectItem.type} INSPECTION
                  </span>

                  <span className="cm-breadcrumb-text">
                    {inspectItem.context?.moduleTitle && (
                      <>
                        <span>{inspectItem.context.moduleTitle}</span>
                        {inspectItem.context?.lessonTitle && <span> › {inspectItem.context.lessonTitle}</span>}
                      </>
                    )}
                  </span>
                </div>

                <h3 className="cm-inspector-title">
                  {inspectItem.data.title || 'Item Details'}
                </h3>
              </div>

              <button
                type="button"
                onClick={closeInspector}
                className="cm-btn-close"
                title="Close modal (Esc)"
              >
                ✕
              </button>
            </div>

            {/* Modal Scrollable Body */}
            <div className="cm-inspector-body">
              {/* ------------------------------------------------------------------- */}
              {/* 1. MODULE INSPECTOR VIEW                                           */}
              {/* ------------------------------------------------------------------- */}
              {inspectItem.type === 'MODULE' && (
                <>
                  {/* KPI Stat Cards */}
                  <div className="cm-kpi-grid">
                    <div className="cm-kpi-card">
                      <div className="cm-kpi-label">⏱️ Duration</div>
                      <div className="cm-kpi-value">
                        {inspectItem.data.durationWeeks
                          ? `${inspectItem.data.durationWeeks} Weeks`
                          : inspectItem.data.durationLabel || '2 Weeks'}
                      </div>
                    </div>
                    <div className="cm-kpi-card">
                      <div className="cm-kpi-label">🎚️ Skill Level</div>
                      <div className="cm-kpi-value">
                        {inspectItem.data.difficultyLevel || inspectItem.data.level || 'Beginner'}
                      </div>
                    </div>
                    <div className="cm-kpi-card">
                      <div className="cm-kpi-label">📖 Total Lessons</div>
                      <div className="cm-kpi-value">
                        {(inspectItem.data.lessons || []).length}
                      </div>
                    </div>
                    <div className="cm-kpi-card">
                      <div className="cm-kpi-label">🔒 Gating Rules</div>
                      <div className="cm-kpi-value" style={{ fontSize: '13px' }}>
                        {inspectItem.data.lessonLocking ? 'Sequential' : 'Open'}{' '}
                        {inspectItem.data.taskLocking ? '• Gated' : ''}
                      </div>
                    </div>
                  </div>

                  {/* Overview Description */}
                  <div className="cm-inspector-section">
                    <div className="cm-section-header">
                      <span>📄 Module Overview</span>
                    </div>
                    <FormattedRichContent content={inspectItem.data.description} emptyText="No module overview provided." />
                  </div>

                  {/* Objectives & Outcomes Side-by-side */}
                  <div className="cm-goals-grid">
                    <div className="cm-goals-card objectives">
                      <div className="cm-section-header" style={{ color: '#6b21a8' }}>
                        <span>🎯 Learning Objectives</span>
                        <span style={{ fontSize: '11px', fontWeight: 600 }}>
                          {(inspectItem.data.objectives || []).length} Goals
                        </span>
                      </div>
                      {Array.isArray(inspectItem.data.objectives) && inspectItem.data.objectives.length > 0 ? (
                        <ul className="cm-goals-list">
                          {inspectItem.data.objectives.map((obj: string, idx: number) => (
                            <li key={idx}>{obj}</li>
                          ))}
                        </ul>
                      ) : (
                        <span className="cm-text-muted-italic">No specific learning objectives listed.</span>
                      )}
                    </div>

                    <div className="cm-goals-card outcomes">
                      <div className="cm-section-header" style={{ color: '#15803d' }}>
                        <span>🏆 Learning Outcomes</span>
                        <span style={{ fontSize: '11px', fontWeight: 600 }}>
                          {(inspectItem.data.outcomes || []).length} Deliverables
                        </span>
                      </div>
                      {Array.isArray(inspectItem.data.outcomes) && inspectItem.data.outcomes.length > 0 ? (
                        <ul className="cm-goals-list">
                          {inspectItem.data.outcomes.map((out: string, idx: number) => (
                            <li key={idx}>{out}</li>
                          ))}
                        </ul>
                      ) : (
                        <span className="cm-text-muted-italic">No specific learning outcomes listed.</span>
                      )}
                    </div>
                  </div>

                  {/* Module Resources */}
                  {Array.isArray(inspectItem.data.resources) && inspectItem.data.resources.filter((r: any) => !r.lesson && !r.lessonId).length > 0 && (
                    <div className="cm-inspector-section">
                      <div className="cm-section-header">
                        <span>📎 Module Resources ({inspectItem.data.resources.filter((r: any) => !r.lesson && !r.lessonId).length})</span>
                      </div>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                        {inspectItem.data.resources.filter((r: any) => !r.lesson && !r.lessonId).map((res: any, idx: number) => (
                          <div key={res.id || idx} className="cm-link-action-card">
                            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                              <span style={{ fontSize: '18px' }}>
                                {res.type === 'PDF' ? '📄' : res.type === 'Video' ? '🎥' : '🔗'}
                              </span>
                              <div>
                                <strong style={{ fontSize: '13px', display: 'block', color: '#0f172a' }}>
                                  {res.title || 'Resource'}
                                </strong>
                                <span style={{ fontSize: '11px', color: '#64748b' }}>{res.url}</span>
                              </div>
                            </div>
                            <div style={{ display: 'flex', gap: '8px' }}>
                              <a
                                href={res.url}
                                target="_blank"
                                rel="noreferrer"
                                className="cm-btn-sm cm-btn-view-primary"
                                style={{ textDecoration: 'none' }}
                              >
                                Open ↗
                              </a>
                              <button
                                type="button"
                                onClick={() =>
                                  openInspector('RESOURCE', res, {
                                    moduleTitle: inspectItem.data.title,
                                    moduleId: inspectItem.data.id,
                                  })
                                }
                                className="cm-btn-sm cm-btn-view"
                              >
                                Inspect
                              </button>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Module Lessons Breakdown */}
                  <div className="cm-inspector-section">
                    <div className="cm-section-header">
                      <span>📖 Module Lessons Breakdown ({(inspectItem.data.lessons || []).length})</span>
                    </div>
                    {(inspectItem.data.lessons || []).length === 0 ? (
                      <span className="cm-text-muted-italic">No lessons registered in this module.</span>
                    ) : (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                        {inspectItem.data.lessons.map((lesson: any, idx: number) => (
                          <div
                            key={lesson.id}
                            style={{
                              padding: '10px 14px',
                              background: '#f8fafc',
                              border: '1px solid #e2e8f0',
                              borderRadius: '8px',
                              display: 'flex',
                              justifyContent: 'space-between',
                              alignItems: 'center',
                            }}
                          >
                            <div>
                              <strong style={{ fontSize: '13px', color: '#1e293b' }}>
                                Lesson {lesson.displayOrder || idx + 1}: {lesson.title}
                              </strong>
                              <div style={{ fontSize: '11px', color: '#64748b', marginTop: '2px' }}>
                                Duration: {lesson.durationMinutes || 15} mins • {lesson.assignments?.length || 0} tasks
                              </div>
                            </div>
                            <button
                              type="button"
                              onClick={() =>
                                openInspector('LESSON', lesson, {
                                  moduleTitle: inspectItem.data.title,
                                  moduleId: inspectItem.data.id,
                                })
                              }
                              className="cm-btn-sm cm-btn-view"
                            >
                              👁️ Inspect Lesson
                            </button>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </>
              )}

              {/* ------------------------------------------------------------------- */}
              {/* 2. LESSON INSPECTOR VIEW                                           */}
              {/* ------------------------------------------------------------------- */}
              {inspectItem.type === 'LESSON' && (
                <>
                  <div className="cm-kpi-grid">
                    <div className="cm-kpi-card">
                      <div className="cm-kpi-label">⏱️ Duration</div>
                      <div className="cm-kpi-value">{inspectItem.data.durationMinutes || 15} Mins</div>
                    </div>
                    <div className="cm-kpi-card">
                      <div className="cm-kpi-label">🔢 Order Index</div>
                      <div className="cm-kpi-value">Lesson #{inspectItem.data.displayOrder || 1}</div>
                    </div>
                    <div className="cm-kpi-card">
                      <div className="cm-kpi-label">🎥 Video Status</div>
                      <div className="cm-kpi-value">
                        {inspectItem.data.videoUrl ? 'Available' : 'None'}
                      </div>
                    </div>
                    <div className="cm-kpi-card">
                      <div className="cm-kpi-label">📝 Tasks Attached</div>
                      <div className="cm-kpi-value">
                        {(inspectItem.data.assignments || []).length}
                      </div>
                    </div>
                  </div>

                  {/* Overview Description */}
                  <div className="cm-inspector-section">
                    <div className="cm-section-header">
                      <span>📖 Lesson Content & Notes</span>
                    </div>
                    <FormattedRichContent content={inspectItem.data.description} emptyText="No description provided for this lesson." />
                  </div>

                  {/* Media Content Box (Video / Article) */}
                  {(inspectItem.data.videoUrl || inspectItem.data.articleUrl) && (
                    <div className="cm-inspector-section">
                      <div className="cm-section-header">
                        <span>🎬 Media & Learning Materials</span>
                      </div>

                      {/* Embedded Video preview if YouTube/Vimeo */}
                      {(() => {
                        const embedUrl = getEmbedVideoUrl(inspectItem.data.videoUrl);
                        if (embedUrl) {
                          return (
                            <div className="cm-video-embed-box">
                              <iframe
                                src={embedUrl}
                                title={inspectItem.data.title}
                                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                                allowFullScreen
                              />
                            </div>
                          );
                        }
                        return null;
                      })()}

                      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                        {inspectItem.data.videoUrl && (
                          <div className="cm-link-action-card">
                            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                              <span>🎥</span>
                              <div>
                                <strong style={{ fontSize: '13px' }}>Video Resource</strong>
                                <div style={{ fontSize: '11px', color: '#64748b' }}>{inspectItem.data.videoUrl}</div>
                              </div>
                            </div>
                            <a
                              href={inspectItem.data.videoUrl}
                              target="_blank"
                              rel="noreferrer"
                              className="cm-btn-sm cm-btn-view-primary"
                              style={{ textDecoration: 'none' }}
                            >
                              Launch Video ↗
                            </a>
                          </div>
                        )}

                        {inspectItem.data.articleUrl && (
                          <div className="cm-link-action-card">
                            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                              <span>📰</span>
                              <div>
                                <strong style={{ fontSize: '13px' }}>Reading Material / Article</strong>
                                <div style={{ fontSize: '11px', color: '#64748b' }}>{inspectItem.data.articleUrl}</div>
                              </div>
                            </div>
                            <a
                              href={inspectItem.data.articleUrl}
                              target="_blank"
                              rel="noreferrer"
                              className="cm-btn-sm cm-btn-view-primary"
                              style={{ textDecoration: 'none' }}
                            >
                              Read Article ↗
                            </a>
                          </div>
                        )}
                      </div>
                    </div>
                  )}

                  {/* Key Points (if present) */}
                  {Array.isArray(inspectItem.data.keyPoints) && inspectItem.data.keyPoints.length > 0 && (
                    <div className="cm-inspector-section">
                      <div className="cm-section-header">
                        <span>💡 Key Takeaways</span>
                      </div>
                      <ul className="cm-goals-list">
                        {inspectItem.data.keyPoints.map((kp: string, idx: number) => (
                          <li key={idx}>{kp}</li>
                        ))}
                      </ul>
                    </div>
                  )}

                  {/* Attached Lesson Resources */}
                  {Array.isArray(inspectItem.data.resources) && inspectItem.data.resources.length > 0 && (
                    <div className="cm-inspector-section">
                      <div className="cm-section-header">
                        <span>📎 Lesson Resources ({inspectItem.data.resources.length})</span>
                      </div>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                        {inspectItem.data.resources.map((res: any, idx: number) => (
                          <div key={res.id || idx} className="cm-link-action-card">
                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                              <span>{res.type === 'PDF' ? '📄' : res.type === 'Video' ? '🎥' : '🔗'}</span>
                              <strong style={{ fontSize: '13px' }}>{res.title || 'Resource'}</strong>
                            </div>
                            <div style={{ display: 'flex', gap: '8px' }}>
                              <a
                                href={res.url}
                                target="_blank"
                                rel="noreferrer"
                                className="cm-btn-sm cm-btn-view-primary"
                                style={{ textDecoration: 'none' }}
                              >
                                Open ↗
                              </a>
                              <button
                                type="button"
                                onClick={() =>
                                  openInspector('RESOURCE', res, {
                                    moduleTitle: inspectItem.context?.moduleTitle,
                                    lessonTitle: inspectItem.data.title,
                                  })
                                }
                                className="cm-btn-sm cm-btn-view"
                              >
                                Inspect
                              </button>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Nested Lesson Tasks */}
                  {Array.isArray(inspectItem.data.assignments) && inspectItem.data.assignments.length > 0 && (
                    <div className="cm-inspector-section">
                      <div className="cm-section-header">
                        <span>📝 Lesson Tasks ({inspectItem.data.assignments.length})</span>
                      </div>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                        {inspectItem.data.assignments.map((task: any) => (
                          <div
                            key={task.id}
                            style={{
                              padding: '10px 14px',
                              background: '#f8fafc',
                              border: '1px solid #e2e8f0',
                              borderRadius: '8px',
                              display: 'flex',
                              justifyContent: 'space-between',
                              alignItems: 'center',
                            }}
                          >
                            <div>
                              <strong style={{ fontSize: '13px' }}>{task.title}</strong>
                              <div style={{ fontSize: '11px', color: '#64748b' }}>
                                Type: {task.assignmentType} • Max Score: {task.maxScore || 100} pts
                              </div>
                            </div>
                            <button
                              type="button"
                              onClick={() =>
                                openInspector('TASK', task, {
                                  moduleTitle: inspectItem.context?.moduleTitle,
                                  lessonTitle: inspectItem.data.title,
                                  lessonId: inspectItem.data.id,
                                })
                              }
                              className="cm-btn-sm cm-btn-view"
                            >
                              👁️ Inspect Task
                            </button>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </>
              )}

              {/* ------------------------------------------------------------------- */}
              {/* 3. TASK / ASSIGNMENT INSPECTOR VIEW                                */}
              {/* ------------------------------------------------------------------- */}
              {inspectItem.type === 'TASK' && (
                <>
                  {(() => {
                    const task = inspectItem.data;
                    const questions = extractTaskQuestions(task);

                    return (
                      <>
                        <div className="cm-kpi-grid">
                          <div className="cm-kpi-card">
                            <div className="cm-kpi-label">🏷️ Assignment Type</div>
                            <div className="cm-kpi-value" style={{ color: '#4f46e5' }}>
                              {task.assignmentType}
                            </div>
                          </div>
                          <div className="cm-kpi-card">
                            <div className="cm-kpi-label">🏆 Max Score</div>
                            <div className="cm-kpi-value">{task.maxScore || 100} Pts</div>
                          </div>
                          <div className="cm-kpi-card">
                            <div className="cm-kpi-label">⏳ Allotted Time</div>
                            <div className="cm-kpi-value">
                              {task.durationDays ? `${task.durationDays}d ` : ''}
                              {task.durationHours ? `${task.durationHours}h ` : ''}
                              {task.durationMinutes ? `${task.durationMinutes}m` : ''}
                              {!task.durationDays && !task.durationHours && !task.durationMinutes && 'No limit'}
                            </div>
                          </div>
                          <div className="cm-kpi-card">
                            <div className="cm-kpi-label">⚓ Timer Anchor</div>
                            <div className="cm-kpi-value" style={{ fontSize: '12px' }}>
                              {task.anchorType === 'TASK_UNLOCKED' ? 'On Task Unlock' : 'On LP Assigned'}
                            </div>
                          </div>
                        </div>

                        {/* Instructions */}
                        <div className="cm-inspector-section">
                          <div className="cm-section-header">
                            <span>📝 Assignment Instructions & Prompt</span>
                          </div>
                          <FormattedRichContent
                            content={task.instructions || task.description}
                            emptyText="No specific instructions provided for this assignment."
                          />
                        </div>

                        {/* External Assignment details */}
                        {task.assignmentType === 'External' && (
                          <div className="cm-inspector-section">
                            <div className="cm-section-header">
                              <span>🔗 External Submission Details</span>
                            </div>
                            {task.externalUrl ? (
                              <div className="cm-link-action-card">
                                <div>
                                  <strong style={{ fontSize: '13px' }}>External Workspace / Documentation</strong>
                                  <div style={{ fontSize: '11px', color: '#64748b' }}>{task.externalUrl}</div>
                                </div>
                                <a
                                  href={task.externalUrl}
                                  target="_blank"
                                  rel="noreferrer"
                                  className="cm-btn-sm cm-btn-primary"
                                  style={{ textDecoration: 'none' }}
                                >
                                  Open External Link ↗
                                </a>
                              </div>
                            ) : (
                              <span className="cm-text-muted-italic">No external URL provided.</span>
                            )}
                          </div>
                        )}

                        {/* MCQ Questions Breakdown */}
                        {task.assignmentType === 'MCQ' && (
                          <div className="cm-inspector-section">
                            <div className="cm-section-header">
                              <span>🔘 MCQ Questions & Correct Answers ({questions.length})</span>
                              <span style={{ fontSize: '11px', color: '#10b981', fontWeight: 700 }}>
                                ✓ Correct answers marked in green
                              </span>
                            </div>

                            {questions.length === 0 ? (
                              <span className="cm-text-muted-italic">No MCQ questions configured.</span>
                            ) : (
                              questions.map((q: any, qIdx: number) => {
                                const questionText = q.questionText || q.question || `Question ${qIdx + 1}`;
                                const opts = Array.isArray(q.options) ? q.options : ['Option 1', 'Option 2', 'Option 3', 'Option 4'];
                                const correctIdx = Number(q.correctIndex) || 0;

                                return (
                                  <div key={q.id || qIdx} className="cm-mcq-card">
                                    <div className="cm-mcq-question-header">
                                      <div style={{ flex: 1 }}>
                                        <span style={{ fontSize: '12px', fontWeight: 800, color: '#4f46e5', marginRight: '6px' }}>
                                          Q{qIdx + 1}.
                                        </span>
                                        <div style={{ display: 'inline' }}>
                                          <FormattedRichContent content={questionText} emptyText="Question prompt" />
                                        </div>
                                      </div>
                                      <span className="cm-badge cm-badge-purple">
                                        {q.points || q.maxPoints || 10} pts
                                      </span>
                                    </div>

                                    <div className="cm-mcq-options-grid">
                                      {opts.map((opt: string, optIdx: number) => {
                                        const isCorrect = optIdx === correctIdx;
                                        return (
                                          <div
                                            key={optIdx}
                                            className={`cm-mcq-option-pill ${isCorrect ? 'correct' : ''}`}
                                          >
                                            <span style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                              <span style={{ fontSize: '11px', fontWeight: 700, opacity: 0.7 }}>
                                                {String.fromCharCode(65 + optIdx)}.
                                              </span>
                                              <span>{opt}</span>
                                            </span>
                                            {isCorrect && (
                                              <span className="cm-badge cm-badge-emerald" style={{ fontSize: '10px' }}>
                                                ✓ Correct Answer
                                              </span>
                                            )}
                                          </div>
                                        );
                                      })}
                                    </div>
                                  </div>
                                );
                              })
                            )}
                          </div>
                        )}

                        {/* Subjective Questions Breakdown with AI Grounding Dependencies */}
                        {task.assignmentType === 'Subjective' && (
                          <div className="cm-inspector-section">
                            <div className="cm-section-header">
                              <span>📝 Subjective Questions & AI Grounding ({questions.length})</span>
                            </div>

                            {questions.length === 0 ? (
                              <span className="cm-text-muted-italic">No subjective questions configured.</span>
                            ) : (
                              questions.map((q: any, qIdx: number) => {
                                const questionText = q.questionText || q.question || `Question ${qIdx + 1}`;
                                const depIds = q.dependentLessonIds || [];

                                return (
                                  <div key={q.id || qIdx} className="cm-sub-card">
                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '8px' }}>
                                      <div style={{ flex: 1 }}>
                                        <span style={{ fontSize: '12px', fontWeight: 800, color: '#4f46e5', marginRight: '6px' }}>
                                          Q{qIdx + 1}.
                                        </span>
                                        <div style={{ display: 'inline' }}>
                                          <FormattedRichContent content={questionText} emptyText="Question prompt" />
                                        </div>
                                      </div>
                                      <span className="cm-badge cm-badge-purple">
                                        Max {q.maxPoints || q.points || 10} pts
                                      </span>
                                    </div>

                                    {/* AI Grounding Dependencies */}
                                    <div className="cm-ai-grounding-box">
                                      <div className="cm-ai-grounding-title">
                                        <span>🤖 AI Evaluation Ground Truth Dependencies:</span>
                                      </div>
                                      {depIds.length === 0 ? (
                                        <span style={{ fontSize: '12px', color: '#64748b', fontStyle: 'italic' }}>
                                          No specific lessons bound. AI uses general path context.
                                        </span>
                                      ) : (
                                        <div className="cm-lesson-deps-wrap">
                                          {depIds.map((depId: string) => {
                                            const resolved = lessonTitleMap.get(String(depId));
                                            return (
                                              <span key={depId} className="cm-lesson-dep-chip">
                                                📖 {resolved ? `${resolved.title} (${resolved.moduleTitle})` : `Lesson ID: ${depId}`}
                                              </span>
                                            );
                                          })}
                                        </div>
                                      )}
                                    </div>
                                  </div>
                                );
                              })
                            )}
                          </div>
                        )}
                      </>
                    );
                  })()}
                </>
              )}

              {/* ------------------------------------------------------------------- */}
              {/* 4. RESOURCE INSPECTOR VIEW                                         */}
              {/* ------------------------------------------------------------------- */}
              {inspectItem.type === 'RESOURCE' && (
                <>
                  <div className="cm-kpi-grid">
                    <div className="cm-kpi-card">
                      <div className="cm-kpi-label">📄 Resource Type</div>
                      <div className="cm-kpi-value">{inspectItem.data.type || 'Web Link'}</div>
                    </div>
                    <div className="cm-kpi-card">
                      <div className="cm-kpi-label">🌐 Host Domain</div>
                      <div className="cm-kpi-value" style={{ fontSize: '12px' }}>
                        {(() => {
                          try {
                            return new URL(inspectItem.data.url).hostname;
                          } catch {
                            return 'External';
                          }
                        })()}
                      </div>
                    </div>
                    <div className="cm-kpi-card">
                      <div className="cm-kpi-label">📍 Association</div>
                      <div className="cm-kpi-value" style={{ fontSize: '12px' }}>
                        {inspectItem.context?.lessonTitle
                          ? `Lesson: ${inspectItem.context.lessonTitle}`
                          : inspectItem.context?.moduleTitle
                          ? `Module: ${inspectItem.context.moduleTitle}`
                          : 'General Resource'}
                      </div>
                    </div>
                  </div>

                  <div className="cm-inspector-section">
                    <div className="cm-section-header">
                      <span>🔗 Resource Access Link</span>
                    </div>

                    <div className="cm-link-action-card">
                      <div>
                        <strong style={{ fontSize: '14px', display: 'block', marginBottom: '4px' }}>
                          {inspectItem.data.title || 'Attached Resource'}
                        </strong>
                        <span style={{ fontSize: '12px', color: '#64748b' }}>{inspectItem.data.url}</span>
                      </div>

                      <div style={{ display: 'flex', gap: '8px' }}>
                        <button
                          type="button"
                          onClick={() => copyToClipboard(inspectItem.data.url, 'Copied URL!')}
                          className="cm-btn-sm cm-btn-view"
                        >
                          {copyFeedback === 'Copied URL!' ? '✓ Copied!' : '📋 Copy URL'}
                        </button>
                        <a
                          href={inspectItem.data.url}
                          target="_blank"
                          rel="noreferrer"
                          className="cm-btn-sm cm-btn-primary"
                          style={{ textDecoration: 'none' }}
                        >
                          Open in New Tab ↗
                        </a>
                      </div>
                    </div>
                  </div>

                  {/* Video Embed Preview if applicable */}
                  {(() => {
                    const embedUrl = getEmbedVideoUrl(inspectItem.data.url);
                    if (embedUrl) {
                      return (
                        <div className="cm-inspector-section">
                          <div className="cm-section-header">
                            <span>🎥 Video Preview</span>
                          </div>
                          <div className="cm-video-embed-box">
                            <iframe
                              src={embedUrl}
                              title={inspectItem.data.title}
                              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                              allowFullScreen
                            />
                          </div>
                        </div>
                      );
                    }
                    return null;
                  })()}
                </>
              )}
            </div>

            {/* Modal Footer */}
            <div className="cm-inspector-footer">
              <div>
                {inspectorHistory.length > 0 && (
                  <button type="button" onClick={handleInspectorBack} className="cm-history-back-btn">
                    <span>←</span> Previous ({inspectorHistory[inspectorHistory.length - 1].type})
                  </button>
                )}
              </div>
              <button type="button" onClick={closeInspector} className="cm-btn-secondary">
                Close Inspector
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* ✏️ CREATE / EDIT FORM MODALS (PRESERVED)                                  */}
      {/* ========================================================================= */}
      {isOwnerOrAdmin &&
        (activeModal === 'MODULE' ||
          activeModal === 'EDIT_MODULE' ||
          activeModal === 'LESSON' ||
          activeModal === 'EDIT_LESSON' ||
          activeModal === 'TASK' ||
          activeModal === 'EDIT_TASK') && (
          <div className="cm-modal-overlay">
            <div
              className={`cm-modal-content ${
                activeModal === 'TASK' || activeModal === 'EDIT_TASK' ? 'wide' : ''
              }`}
            >
              <div className="cm-inspector-header">
                <h3 className="cm-inspector-title">{activeModal.replace('_', ' ')}</h3>
                <button type="button" onClick={resetFormFields} className="cm-btn-close">
                  ✕
                </button>
              </div>

              <div className="cm-inspector-body">
                <form
                  onSubmit={handleFormSubmit}
                  style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}
                >
                  {/* Module Context */}
                  {activeModal.includes('TASK') && formAssignmentType !== 'External' && (
                    <div style={{ padding: '12px', background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '6px' }}>
                      <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, color: '#475569' }}>
                        Target Learning Path *
                      </label>
                      <input
                        type="text"
                        readOnly
                        disabled
                        value={learningPathTitle}
                        style={{
                          width: '100%',
                          padding: '8px',
                          marginTop: '4px',
                          borderRadius: '4px',
                          border: '1px solid #cbd5e1',
                          background: '#e2e8f0',
                          cursor: 'not-allowed',
                        }}
                      />
                    </div>
                  )}

                  {activeModal.includes('TASK') && formAssignmentType !== 'External' && !targetLessonId && (
                    <div style={{ padding: '12px', background: '#fff', border: '1px solid #3b82f6', borderRadius: '6px' }}>
                      <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, color: '#1e3a8a' }}>
                        Target Module *
                      </label>
                      <select
                        required
                        value={targetModuleId || ''}
                        onChange={(e) => setTargetModuleId(e.target.value)}
                        style={{ width: '100%', padding: '8px', marginTop: '4px', borderRadius: '4px', border: '1px solid #93c5fd' }}
                      >
                        <option value="" disabled>
                          -- Select the mandatory module for this assignment --
                        </option>
                        {modules.map((m) => (
                          <option key={m.id} value={String(m.id)}>
                            {m.title}
                          </option>
                        ))}
                      </select>
                    </div>
                  )}

                  {activeModal.includes('TASK') && formAssignmentType === 'External' && (
                    <div style={{ padding: '12px', background: '#fdf4ff', border: '1px solid #d8b4fe', borderRadius: '6px' }}>
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
                          <option key={t.id} value={t.id}>
                            {t.firstName} {t.lastName} ({t.email})
                          </option>
                        ))}
                      </select>
                    </div>
                  )}

                  <div>
                    <label style={{ display: 'block', fontSize: '13px', fontWeight: 600 }}>Title *</label>
                    <input
                      type="text"
                      required
                      value={formTitle}
                      onChange={(e) => setFormTitle(e.target.value)}
                      style={{ width: '100%', padding: '8px', marginTop: '4px', borderRadius: '4px', border: '1px solid #cbd5e1' }}
                    />
                  </div>

                  {(activeModal.includes('MODULE') || activeModal.includes('LESSON')) && (
                    <div>
                      <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, marginBottom: '4px' }}>Description</label>
                      <RichTextEditor
                        value={formDescription}
                        onChange={(html) => setFormDescription(html)}
                        placeholder="Provide a comprehensive description..."
                      />
                    </div>
                  )}

                  {activeModal.includes('MODULE') && (
                    <>
                      <div>
                        <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, color: '#4f46e5' }}>
                          ◎ Learning Objectives (One per line)
                        </label>
                        <textarea
                          rows={3}
                          value={formObjectives}
                          onChange={(e) => setFormObjectives(e.target.value)}
                          placeholder="e.g. Understand RESTful architecture&#10;Design clean API endpoints"
                          style={{ width: '100%', padding: '8px', marginTop: '4px', borderRadius: '4px', border: '1px solid #c7d2fe', background: '#f5f3ff' }}
                        />
                      </div>
                      <div>
                        <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, color: '#16a34a' }}>
                          ✓ Learning Outcomes (One per line)
                        </label>
                        <textarea
                          rows={3}
                          value={formOutcomes}
                          onChange={(e) => setFormOutcomes(e.target.value)}
                          placeholder="e.g. Build a functional REST API&#10;Secure endpoints with JWT"
                          style={{ width: '100%', padding: '8px', marginTop: '4px', borderRadius: '4px', border: '1px solid #bbf7d0', background: '#f0fdf4' }}
                        />
                      </div>
                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                        <div>
                          <label style={{ display: 'block', fontSize: '13px', fontWeight: 600 }}>Duration (Weeks)</label>
                          <input
                            type="number"
                            min={1}
                            max={52}
                            value={formDurationWeeks}
                            onChange={(e) => setFormDurationWeeks(Number(e.target.value) || 2)}
                            style={{ width: '100%', padding: '8px', marginTop: '4px', borderRadius: '4px', border: '1px solid #cbd5e1' }}
                          />
                        </div>
                      </div>
                      <div style={{ marginBottom: '16px' }}>
                        <label style={{ display: 'block', fontSize: '13px', fontWeight: 600 }}>Resource URL</label>
                        <input
                          type="url"
                          value={formResourceUrl}
                          onChange={(e) => setFormResourceUrl(e.target.value)}
                          placeholder="https://..."
                          style={{ width: '100%', padding: '8px', marginTop: '4px', borderRadius: '4px', border: '1px solid #cbd5e1' }}
                        />
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
                        <select
                          value={formAssignmentType}
                          onChange={(e) => setFormAssignmentType(e.target.value as 'Subjective' | 'MCQ')}
                          style={{ width: '100%', padding: '8px', marginTop: '4px', borderRadius: '4px', border: '1px solid #cbd5e1' }}
                        >
                          <option value="Subjective">📝 Subjective Questions</option>
                          <option value="MCQ">🔘 Multiple Choice Quiz (MCQ)</option>
                        </select>
                      </div>

                      <div>
                        <label style={{ display: 'block', fontSize: '13px', fontWeight: 600 }}>Instructions / Description</label>
                        <textarea
                          rows={2}
                          value={formInstructions}
                          onChange={(e) => setFormInstructions(e.target.value)}
                          placeholder="Provide instructions for this task..."
                          style={{ width: '100%', padding: '8px', marginTop: '4px', borderRadius: '4px', border: '1px solid #cbd5e1' }}
                        />
                      </div>
                    </>
                  )}

                  <div className="cm-form-actions">
                    <button type="button" onClick={resetFormFields} className="cm-btn-secondary">
                      Cancel
                    </button>
                    <button type="submit" disabled={isSubmitting} className="cm-btn-primary">
                      {isSubmitting ? 'Saving...' : 'Save Updates'}
                    </button>
                  </div>
                </form>
              </div>
            </div>
          </div>
        )}
    </div>
  );
}
