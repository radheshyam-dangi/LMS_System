import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useEditor, EditorContent, ReactNodeViewRenderer } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Placeholder from '@tiptap/extension-placeholder';
import Heading from '@tiptap/extension-heading';
import Paragraph from '@tiptap/extension-paragraph';
import Text from '@tiptap/extension-text';
import Document from '@tiptap/extension-document';
import { useNavigate } from 'react-router-dom';
import { v4 as uuidv4 } from 'uuid';
import { 
  Eye, Edit3, Save, CheckCircle2, AlertCircle, 
  ArrowLeft, Send, Sparkles, Layers, Lock, Unlock,
  Sliders, ShieldCheck, Clock
} from 'lucide-react';

import './TiptapLPEditor.css';
import { Toolbar } from './Toolbar';
import { SlashCommands, getSuggestionItems, renderSlashCommandList } from './slashCommands';
import { parseLPDocument } from './parseLPDocument';
import { validateLPDocument, type ValidationError } from './validateLPDocument';
import { lpAuthoringService } from '../../services/lpAuthoringService';
import { useToast } from '../../context/ToastContext';
import { DEFAULT_ASSIGNMENT_INSTRUCTION_TEXT } from '../../utils/defaultInstructions';

import {
  ModuleNode,
  LessonNode,
  AssignmentNode,
  VideoBlockNode,
  AudioBlockNode,
  ResourceBlockNode,
  QuestionBlockNode,
} from './extensions';

import {
  ModuleNodeView,
  LessonNodeView,
  AssignmentNodeView,
  VideoBlockView,
  AudioBlockView,
  ResourceBlockView,
  QuestionBlockView,
} from './nodeViews';

import type { CurriculumTreeData, CurriculumNodeItem } from './types';
import { LPSidebarTree } from './LPSidebarTree';
import { TraineePreviewCanvas } from './TraineePreviewCanvas';

// Custom Document that allows title, level, status, tags, and modules
const LPDocument = Document.extend({
  content: '(heading | paragraph | module)*',
  addAttributes() {
    return {
      level: { default: 'basic' },
      status: { default: 'upcoming' },
      skillsTags: { default: [] },
      imageUrl: { default: '' },
    };
  },
});

const POPULAR_SKILLS = [
  'React', 'TypeScript', 'Node.js', 'Python', 'Docker',
  'PostgreSQL', 'AWS', 'GraphQL', 'DevOps', 'UI/UX',
  'System Design', 'REST API', 'Cybersecurity', 'Git'
];

const LPMetadataBar = ({ editor, onDirty }: { editor: any; onDirty?: () => void }) => {
  const [attrs, setAttrs] = useState(editor.state.doc.attrs);
  const [counts, setCounts] = useState({ modules: 0, lessons: 0, assignments: 0 });
  const [tagInput, setTagInput] = useState('');
  const [tagError, setTagError] = useState<string | null>(null);
  const [isOpen, setIsOpen] = useState(true);
  
  useEffect(() => {
    const handler = () => {
      setAttrs(editor.state.doc.attrs);
      let m = 0, l = 0, a = 0;
      editor.state.doc.descendants((node: any) => {
        if (node.type.name === 'module') m++;
        if (node.type.name === 'lesson') l++;
        if (node.type.name === 'assignment') a++;
      });
      setCounts({ modules: m, lessons: l, assignments: a });
    };

    handler();
    editor.on('update', handler);
    editor.on('transaction', handler);
    return () => {
      editor.off('update', handler);
      editor.off('transaction', handler);
    };
  }, [editor]);

  const level = attrs.level || 'basic';
  const status = attrs.status || 'upcoming';
  const imageUrl = attrs.imageUrl || '';
  const skillsTags: string[] = Array.isArray(attrs.skillsTags) ? attrs.skillsTags : [];

  const updateDocAttr = (key: string, value: any) => {
    if (editor?.state?.doc?.attrs) {
      editor.state.doc.attrs[key] = value;
      editor.commands.command(({ tr }: any) => {
        tr.setMeta('docAttributeUpdate', true);
        return true;
      });
      setAttrs({ ...editor.state.doc.attrs });
      if (onDirty) onDirty();
    }
  };

  const handleAddTag = (tagToAdd?: string) => {
    const raw = (tagToAdd ?? tagInput).trim();
    if (!raw) return;

    const candidates = raw.split(',').map((t: string) => t.trim()).filter(Boolean);
    const updated = [...skillsTags];
    let addedCount = 0;

    for (const c of candidates) {
      if (c.length > 30) {
        setTagError('Tag must be 30 characters or fewer.');
        return;
      }
      const alreadyExists = updated.some((t: string) => t.toLowerCase() === c.toLowerCase());
      if (!alreadyExists) {
        updated.push(c);
        addedCount++;
      }
    }

    if (addedCount === 0 && candidates.length > 0) {
      setTagError(`"${raw}" is already added.`);
      return;
    }

    setTagError(null);
    updateDocAttr('skillsTags', updated);
    setTagInput('');
  };

  const handleRemoveTag = (indexToRemove: number) => {
    const updated = skillsTags.filter((_, i) => i !== indexToRemove);
    updateDocAttr('skillsTags', updated);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' || e.key === ',') {
      e.preventDefault();
      handleAddTag();
    }
  };

  const unusedPopularSkills = POPULAR_SKILLS.filter(
    (skill) => !skillsTags.some((t) => t.toLowerCase() === skill.toLowerCase())
  );

  return (
    <div className="lp-metadata-bar">
      <div 
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          cursor: 'pointer',
          paddingBottom: isOpen ? '14px' : '0',
          borderBottom: isOpen ? '1px solid #f1f5f9' : 'none'
        }}
        onClick={() => setIsOpen(!isOpen)}
        title="Toggle Curriculum Track Metadata & Competencies"
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <div className="lp-metadata-counters">
            <span className="lp-metadata-counter-chip" style={{ background: '#ecfdf5', color: '#065f46', borderColor: '#a7f3d0' }}>
               {counts.modules} Module{counts.modules !== 1 ? 's' : ''}
            </span>
            <span className="lp-metadata-counter-chip" style={{ background: '#eff6ff', color: '#1e40af', borderColor: '#bfdbfe' }}>
               {counts.lessons} Lesson{counts.lessons !== 1 ? 's' : ''}
            </span>
            <span className="lp-metadata-counter-chip" style={{ background: '#f5f3ff', color: '#5b21b6', borderColor: '#ddd6fe' }}>
               {counts.assignments} Task{counts.assignments !== 1 ? 's' : ''}
            </span>
          </div>

          <button
            type="button"
            className="chevron-toggle"
            style={{ fontSize: '12px', fontWeight: 600 }}
          >
            {isOpen ? 'Collapse Track Details' : 'Expand Track Details'}
          </button>
        </div>
      </div>

      {isOpen && (
        <>
          <div className="lp-metadata-top-row" style={{ marginTop: '12px' }}>
            <div className="lp-metadata-group" style={{ flex: 1 }}>
              <div className="lp-metadata-item">
                <span className="lp-metadata-label">Difficulty Level:</span>
                <select 
                  className="lp-metadata-select"
                  value={level} 
                  onChange={(e) => updateDocAttr('level', e.target.value)}
                >
                  <option value="basic">Basic (Beginner)</option>
                  <option value="intermediate">Intermediate Mastery</option>
                  <option value="advanced">Advanced Specialist</option>
                </select>
              </div>

              <div className="lp-metadata-item">
                <span className="lp-metadata-label">Publication Status:</span>
                <select 
                  className="lp-metadata-select"
                  value={status} 
                  onChange={(e) => updateDocAttr('status', e.target.value)}
                >
                  <option value="active">Active (Visible to Trainees)</option>
                  <option value="upcoming">Upcoming (Draft in Progress)</option>
                </select>
              </div>

              <div className="lp-metadata-item" style={{ flex: 1, minWidth: '220px' }}>
                <span className="lp-metadata-label">Thumbnail URL:</span>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flex: 1 }}>
                  <input 
                    type="text" 
                    className="styled-form-control"
                    style={{ flex: 1 }}
                    placeholder="https://example.com/cover-image.png"
                    value={imageUrl} 
                    onChange={(e) => updateDocAttr('imageUrl', e.target.value)}
                  />
                  {imageUrl && (
                    <img 
                      src={imageUrl} 
                      alt="Thumbnail preview" 
                      style={{ width: 38, height: 38, borderRadius: 6, objectFit: 'cover', border: '1px solid #cbd5e1' }}
                      onError={(e) => { (e.target as HTMLElement).style.display = 'none'; }}
                    />
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* SKILL TAGS CREATION & MANAGEMENT SECTION */}
          <div className="lp-skill-tags-section">
            <div className="lp-skill-tags-header">
              <div className="lp-skill-tags-title-group">
                <span className="lp-skill-tags-title">Competency Tags & Skills</span>
                <span className="lp-skill-tags-count-badge">
                  {skillsTags.length} {skillsTags.length === 1 ? 'tag' : 'tags'}
                </span>
              </div>
            </div>

            <div className="lp-skill-tags-cloud">
              {skillsTags.length === 0 ? (
                <div className="lp-tags-empty-state">
                  <span>No skill tags added yet. Type below or select from quick suggestions.</span>
                </div>
              ) : (
                skillsTags.map((tag, idx) => (
                  <span key={idx} className="lp-editor-tag-chip">
                    <span className="lp-tag-hash">#</span>
                    <span className="lp-tag-text">{tag}</span>
                    <button
                      type="button"
                      className="lp-tag-remove-btn"
                      onClick={() => handleRemoveTag(idx)}
                      title={`Remove ${tag}`}
                      aria-label={`Remove ${tag}`}
                    >
                      &times;
                    </button>
                  </span>
                ))
              )}
            </div>

            <div className="lp-tags-input-row">
              <div className="lp-tags-input-wrapper">
                <span className="lp-input-hash">#</span>
                <input
                  type="text"
                  className="lp-tag-text-input"
                  placeholder="Add skill tag (e.g. React, Docker, Python) — press Enter or comma"
                  value={tagInput}
                  onChange={(e) => {
                    setTagInput(e.target.value);
                    if (tagError) setTagError(null);
                  }}
                  onKeyDown={handleKeyDown}
                />
                {tagInput && (
                  <button
                    type="button"
                    className="lp-tag-input-clear-btn"
                    onClick={() => setTagInput('')}
                    title="Clear input"
                  >
                    &times;
                  </button>
                )}
              </div>
              <button
                type="button"
                className="lp-btn-add-tag"
                onClick={() => handleAddTag()}
                disabled={!tagInput.trim()}
              >
                + Add Tag
              </button>
            </div>

            {tagError && (
              <div className="lp-tag-error-message">
                {tagError}
              </div>
            )}

            {unusedPopularSkills.length > 0 && (
              <div className="lp-suggested-tags-row">
                <span className="lp-suggested-label">Quick Suggestions:</span>
                <div className="lp-suggested-pills">
                  {unusedPopularSkills.slice(0, 8).map((skill) => (
                    <button
                      key={skill}
                      type="button"
                      className="lp-suggested-pill-btn"
                      onClick={() => handleAddTag(skill)}
                      title={`Add ${skill}`}
                    >
                      + {skill}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
};

interface TiptapLPEditorProps {
  initialDraftData?: any;
  draftId?: string;
  pathId?: string;
  focusAction?: string;
  targetId?: string;
  onClose?: () => void;
}

export const TiptapLPEditor: React.FC<TiptapLPEditorProps> = ({ 
  initialDraftData, 
  draftId,
  pathId,
  focusAction,
  targetId,
  onClose 
}) => {
  const token = localStorage.getItem('skillforge_access_token');
  const navigate = useNavigate();
  const toast = useToast();

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errors, setErrors] = useState<ValidationError[]>([]);
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'saved'>('idle');
  const [isDirty, setIsDirty] = useState(false);

  // Studio Views: Editor vs Trainee Preview
  const [activeView, setActiveView] = useState<'editor' | 'preview'>('editor');
  // Sidebar hierarchy collapse toggle
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
  const [activeNodeId, setActiveNodeId] = useState<string | null>(null);

  // Curriculum outline tree state extracted in real-time from Tiptap doc
  const [treeData, setTreeData] = useState<CurriculumTreeData>({
    modules: [],
    totalModules: 0,
    totalLessons: 0,
    totalAssignments: 0,
  });

  const [documentTitle, setDocumentTitle] = useState('Untitled Learning Path');
  const [documentDesc, setDocumentDesc] = useState('');

  const editor = useEditor({
    extensions: [
      LPDocument,
      StarterKit.configure({
        document: false,
        heading: false,
        dropcursor: { color: '#4f46e5', width: 2 },
      }),
      Heading.configure({ levels: [1, 2, 3] }),
      Placeholder.configure({
        includeChildren: true,
        showOnlyCurrent: false,
        placeholder: ({ node, pos, editor }: any) => {
          if (node.type.name === 'heading' && node.attrs.level === 1) return 'Learning Path Title';
          if (node.type.name === 'heading' && node.attrs.level === 2) return 'Title';
          if (node.type.name === 'paragraph') {
            try {
              const doc = editor?.state?.doc || editor?.view?.state?.doc;
              if (doc && typeof pos === 'number') {
                const positionsToTry = [pos, Math.min(pos + 1, doc.content.size)];
                for (const p of positionsToTry) {
                  const $pos = doc.resolve(p);
                  for (let d = $pos.depth; d > 0; d--) {
                    const parentName = $pos.node(d).type.name;
                    if (parentName === 'questionBlock') {
                      return 'Type your question here...';
                    }
                    if (parentName === 'assignment') {
                      return 'Provide assignment instructions or description here...';
                    }
                    if (parentName === 'lesson') {
                      return 'Enter description of lesson...';
                    }
                    if (parentName === 'module') {
                      return 'Enter description of module...';
                    }
                  }
                  if ($pos.depth <= 1) {
                    return 'Enter description of Learning Path...';
                  }
                }
              }
            } catch (e) {
              // fallback
            }
            return 'Enter description of Learning Path...';
          }
          return '';
        },
      }),
      SlashCommands.configure({
        suggestion: {
          items: getSuggestionItems,
          render: renderSlashCommandList,
        },
      }),

      // Custom Structural Nodes
      ModuleNode.extend({ addNodeView() { return ReactNodeViewRenderer(ModuleNodeView); } }),
      LessonNode.extend({ addNodeView() { return ReactNodeViewRenderer(LessonNodeView); } }),
      AssignmentNode.extend({ addNodeView() { return ReactNodeViewRenderer(AssignmentNodeView); } }),

      // Media Blocks
      VideoBlockNode.extend({ addNodeView() { return ReactNodeViewRenderer(VideoBlockView); } }),
      AudioBlockNode.extend({ addNodeView() { return ReactNodeViewRenderer(AudioBlockView); } }),
      ResourceBlockNode.extend({ addNodeView() { return ReactNodeViewRenderer(ResourceBlockView); } }),

      // Question Block
      QuestionBlockNode.extend({ addNodeView() { return ReactNodeViewRenderer(QuestionBlockView); } }),
    ],
    content: initialDraftData || `<h1>Untitled Learning Path</h1><p></p><div data-type="module" data-sequentialmodulelock="true" data-sequentiallessonlock="true"><h2>Module 1: Foundations</h2><div data-type="lesson"><h2>Lesson 1: Introduction</h2><p></p></div></div><div data-type="module" data-sequentialmodulelock="true" data-sequentiallessonlock="true"><h2>Module 2: Advanced Topics</h2><div data-type="lesson"><h2>Lesson 1: Deep Dive</h2><p></p></div></div>`,
    onUpdate: () => {
      if (errors.length > 0) setErrors([]);
      setSaveStatus('idle');
      setIsDirty(true);
    },
  });

  // Extract Curriculum Outline Tree & Header Titles from Tiptap doc
  const syncCurriculumTree = useCallback(() => {
    if (!editor) return;

    let title = '';
    let description = '';
    const modules: CurriculumNodeItem[] = [];
    let modIdx = 0;
    let totalL = 0;
    let totalA = 0;

    editor.state.doc.descendants((node, pos) => {
      if (!title && node.type.name === 'heading' && node.attrs.level === 1) {
        title = node.textContent;
      }
      if (!description && node.type.name === 'paragraph' && pos < 250) {
        description = node.textContent;
      }

      if (node.type.name === 'module') {
        modIdx++;
        let modTitle = `Module ${modIdx}`;
        let modDesc = node.attrs.description || '';
        const children: CurriculumNodeItem[] = [];
        let lIdx = 0;
        let aIdx = 0;

        node.descendants((child, childPos) => {
          if (child.type.name === 'heading' && child.attrs.level === 2 && modTitle === `Module ${modIdx}`) {
            modTitle = child.textContent || modTitle;
          }

          if (child.type.name === 'lesson') {
            lIdx++;
            totalL++;
            let lesTitle = `Lesson ${lIdx}`;
            let vCount = 0;
            let rCount = 0;

            child.descendants((c) => {
              if (c.type.name === 'heading' && c.attrs.level === 2 && lesTitle === `Lesson ${lIdx}`) {
                lesTitle = c.textContent || lesTitle;
              }
              if (c.type.name === 'videoBlock') vCount++;
              if (c.type.name === 'resourceBlock') rCount++;
            });

            children.push({
              id: child.attrs.id || `les-${pos}-${childPos}`,
              type: 'lesson',
              title: lesTitle,
              index: lIdx,
              lockRule: { 
                type: child.attrs.lockRule === 'unlocked' ? 'unlocked' : 'prerequisite_lock', 
                prerequisiteMode: 'sequential' 
              },
              pos: pos + 1 + childPos,
              nodeSize: child.nodeSize,
              stats: { videos: vCount, resources: rCount },
            });
            return false;
          }

          if (child.type.name === 'assignment') {
            aIdx++;
            totalA++;
            let aTitle = `Task ${aIdx}`;
            let qCount = 0;

            child.descendants((c) => {
              if (c.type.name === 'heading' && c.attrs.level === 2 && aTitle === `Task ${aIdx}`) {
                aTitle = c.textContent || aTitle;
              }
              if (c.type.name === 'questionBlock') qCount++;
            });

            children.push({
              id: child.attrs.id || `ass-${pos}-${childPos}`,
              type: 'assignment',
              title: aTitle,
              index: aIdx,
              lockUntilLessonsComplete: child.attrs.lockUntilLessonsComplete !== false,
              dependsOnLessonIds: child.attrs.dependsOnLessonIds,
              lockRule: { 
                type: child.attrs.lockUntilLessonsComplete === false ? 'unlocked' : 'prerequisite_lock', 
                prerequisiteMode: 'all_preceding' 
              },
              pos: pos + 1 + childPos,
              nodeSize: child.nodeSize,
              stats: { questions: qCount },
            });
            return false;
          }
        });

        modules.push({
          id: node.attrs.id || `mod-${pos}`,
          type: 'module',
          title: modTitle,
          description: modDesc,
          index: modIdx,
          sequentialModuleLock: node.attrs.sequentialModuleLock !== false,
          sequentialLessonLock: node.attrs.sequentialLessonLock !== false,
          lockRule: { 
            type: node.attrs.sequentialModuleLock === false ? 'unlocked' : 'prerequisite_lock',
            minProgressPercent: 100 
          },
          pos,
          nodeSize: node.nodeSize,
          children,
        });
        return false;
      }
    });

    setTreeData({
      modules,
      totalModules: modules.length,
      totalLessons: totalL,
      totalAssignments: totalA,
    });

    if (title) setDocumentTitle(title);
    if (description) setDocumentDesc(description);
  }, [editor]);

  useEffect(() => {
    if (!editor) return;
    syncCurriculumTree();
    editor.on('update', syncCurriculumTree);
    editor.on('transaction', syncCurriculumTree);
    return () => {
      editor.off('update', syncCurriculumTree);
      editor.off('transaction', syncCurriculumTree);
    };
  }, [editor, syncCurriculumTree]);

  // Autosave Draft every 15s when dirty
  useEffect(() => {
    if (!editor || !token) return;

    const interval = setInterval(async () => {
      if (!isDirty) return;
      if (saveStatus !== 'idle') return;
      setSaveStatus('saving');

      try {
        const json = editor.getJSON();
        const parsed = parseLPDocument(json);
        const currentTitle = parsed.title || 'Untitled Draft';

        await lpAuthoringService.saveDraft(
          json,
          token,
          draftId,
          currentTitle
        );
        setSaveStatus('saved');
        setIsDirty(false);
      } catch (err) {
        console.error('Autosave failed:', err);
        setSaveStatus('idle');
      }
    }, 15000);

    return () => clearInterval(interval);
  }, [editor, token, draftId, saveStatus, isDirty]);

  // Manual Save Draft
  const handleSaveDraft = async () => {
    if (!editor || !token) return;
    setSaveStatus('saving');
    try {
      const json = editor.getJSON();
      const parsed = parseLPDocument(json);
      const currentTitle = parsed.title || 'Untitled Draft';

      await lpAuthoringService.saveDraft(json, token, draftId, currentTitle);
      setSaveStatus('saved');
      setIsDirty(false);
      toast.success('Draft saved successfully');
    } catch (err) {
      console.error('Manual save draft failed:', err);
      setSaveStatus('idle');
      toast.error('Failed to save draft');
    }
  };

  // Node selection from sidebar tree: smooth scroll into view in center canvas
  const handleSelectTreeNode = (item: CurriculumNodeItem) => {
    if (!editor) return;
    setActiveNodeId(item.id);

    if (activeView !== 'editor') {
      setActiveView('editor');
    }

    setTimeout(() => {
      try {
        editor.commands.focus(item.pos);
        const dom = editor.view.nodeDOM(item.pos) as HTMLElement;
        if (dom && dom.scrollIntoView) {
          dom.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }
      } catch (e) {
        editor.commands.focus(item.pos);
      }
    }, 60);
  };

  // Add Module from sidebar
  const handleAddModule = () => {
    if (!editor) return;
    const newModule = {
      type: 'module',
      attrs: {
        id: uuidv4(),
        sequentialModuleLock: true,
        sequentialLessonLock: true,
        lockRule: 'prerequisite',
        description: '',
      },
      content: [
        { type: 'heading', attrs: { level: 2 }, content: [{ type: 'text', text: 'New Module' }] },
        { type: 'paragraph' },
        {
          type: 'lesson',
          attrs: { id: uuidv4(), lockRule: 'prerequisite' },
          content: [
            { type: 'heading', attrs: { level: 2 }, content: [{ type: 'text', text: 'New Lesson' }] },
            { type: 'paragraph' },
          ],
        },
      ],
    };
    editor.chain().focus('end').insertContent(newModule).run();
  };

  // Add Lesson inside specific module
  const handleAddLessonToModule = (moduleId: string) => {
    if (!editor) return;
    let targetPos: number | null = null;
    let targetSize: number | null = null;

    editor.state.doc.descendants((node, pos) => {
      if (node.type.name === 'module' && node.attrs.id === moduleId) {
        targetPos = pos;
        targetSize = node.nodeSize;
        return false;
      }
    });

    const lessonNode = {
      type: 'lesson',
      attrs: { id: uuidv4(), lockRule: 'prerequisite' },
      content: [
        { type: 'heading', attrs: { level: 2 }, content: [{ type: 'text', text: 'New Lesson' }] },
        { type: 'paragraph' },
      ],
    };

    if (targetPos !== null) {
      const insertAt = targetPos + targetSize! - 1;
      editor.commands.insertContentAt(insertAt, lessonNode as any);
      editor.commands.focus(insertAt + 1);
    }
  };

  // Add Task inside specific module
  const handleAddAssignmentToModule = (moduleId: string) => {
    if (!editor) return;
    let targetPos: number | null = null;
    let targetSize: number | null = null;

    editor.state.doc.descendants((node, pos) => {
      if (node.type.name === 'module' && node.attrs.id === moduleId) {
        targetPos = pos;
        targetSize = node.nodeSize;
        return false;
      }
    });

    const assignmentNode = {
      type: 'assignment',
      attrs: {
        id: uuidv4(),
        lockUntilLessonsComplete: true,
        lockRule: 'prerequisite',
        autoEvaluateWithAI: false,
        humanInterventionRequired: true,
      },
      content: [
        { type: 'heading', attrs: { level: 2 }, content: [{ type: 'text', text: 'New Assignment' }] },
        {
          type: 'paragraph',
          content: [{ type: 'text', text: DEFAULT_ASSIGNMENT_INSTRUCTION_TEXT }],
        },
        {
          type: 'questionBlock',
          attrs: { id: uuidv4(), questionType: 'Subjective', maxPoints: 10, correctIndex: null },
          content: [{ type: 'paragraph' }],
        },
      ],
    };

    if (targetPos !== null) {
      const insertAt = targetPos + targetSize! - 1;
      editor.commands.insertContentAt(insertAt, assignmentNode as any);
      editor.commands.focus(insertAt + 1);
    }
  };

  // Handle deep-links for creating/editing modules and lessons
  useEffect(() => {
    if (editor && !editor.isDestroyed && focusAction) {
      setTimeout(() => {
        if (focusAction === 'createModule') {
          handleAddModule();
          return;
        }

        let found = false;
        editor.state.doc.descendants((node, pos) => {
          if ((node.type.name === 'module' || node.type.name === 'lesson' || node.type.name === 'assignment') && node.attrs.id === targetId) {
            found = true;
            if (focusAction === 'editModule') {
              editor.commands.focus(pos);
              const dom = editor.view.nodeDOM(pos) as HTMLElement;
              if (dom && dom.scrollIntoView) {
                dom.scrollIntoView({ behavior: 'smooth', block: 'start' });
              }
            } else if (focusAction === 'addLesson') {
              handleAddLessonToModule(node.attrs.id);
            }
            return false;
          }
        });

        if (!found) {
          editor.commands.focus('start');
        }
      }, 300);
    }
  }, [editor, focusAction, targetId]);

  // Submit / Publish Learning Path
  const handleSubmit = async () => {
    if (!editor || !token) return;

    const json = editor.getJSON();
    const parsed = parseLPDocument(json, draftId, pathId);
    
    // Client-side validation
    const validationErrors = validateLPDocument(parsed);
    const blockingErrors = validationErrors.filter(e => !e.isWarning);
    if (blockingErrors.length > 0) {
      setErrors(validationErrors);
      document.querySelector('.tiptap-editor-body')?.scrollTo(0, 0);
      return;
    }
    if (validationErrors.length > 0) {
      setErrors(validationErrors);
    }

    setIsSubmitting(true);
    try {
      const result = await lpAuthoringService.submitLPDocument(parsed, token);
      toast.success(`Success! Saved Learning Path: ${result.title}`);
      
      if (onClose) {
        onClose();
      } else {
        navigate(`/learning-paths/${result.id}`);
      }
    } catch (err: any) {
      console.error('Submit failed', err);
      const msg = err.response?.data?.message || err.message || 'Submission failed';
      setErrors([{ path: 'server', message: `Server Error: ${msg}` }]);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="tiptap-lp-editor-container">
      {/* 1. Executive Top Studio Bar */}
      <div className="lp-studio-topbar">
        <div className="studio-topbar-left">
          <button
            type="button"
            className="studio-back-btn"
            onClick={() => {
              if (onClose) onClose();
              else navigate('/learning-paths');
            }}
            title="Return to Catalog"
          >
            <ArrowLeft size={14} /> Learning Path
          </button>

          <div className="studio-topbar-divider" />

          <div className="studio-title-block">
            <h2 className="studio-track-title">{documentTitle || 'Untitled Learning Path'}</h2>
       
          </div>
        </div>

        {/* View Mode Switcher (Visual Editor vs Trainee Preview) */}
        <div className="studio-topbar-center">
          <div className="studio-view-segmented-control">
            <button
              type="button"
              className={`studio-segment-btn ${activeView === 'editor' ? 'active' : ''}`}
              onClick={() => setActiveView('editor')}
              title="Visual Curriculum Editor"
            >
              <span>Visual Editor</span>
            </button>
            <button
              type="button"
              className={`studio-segment-btn ${activeView === 'preview' ? 'active' : ''}`}
              onClick={() => setActiveView('preview')}
              title="Trainee Preview"
            >
              
              <span>Trainee Preview</span>
            </button>
          </div>
        </div>

        {/* Top Actions & Save Status */}
        <div className="studio-topbar-right">
          <div className="studio-save-status">
            {saveStatus === 'saving' && (
              <span className="save-status-text saving">
                <Clock size={12} className="spin" /> Saving...
              </span>
            )}
            {/* {saveStatus === 'saved' && (
              <span className="save-status-text saved">
                <CheckCircle2 size={12} /> Saved
              </span>
            )}
            {isDirty && saveStatus === 'idle' && (
              <span className="save-status-text dirty">
                Unsaved changes
              </span>
            )} */}
          </div>

          {/* <button
            type="button"
            className="studio-btn-draft"
            onClick={handleSaveDraft}
            disabled={isSubmitting || saveStatus === 'saving'}
            title="Save changes as draft"
          >
            <Save size={14} /> Save Draft
          </button> */}

        </div>
      </div>

      {/* 2. Workspace Layout: Left Sidebar Tree + Center Canvas */}
      <div className="lp-studio-workspace">
        {/* Left Side: Collapsible Curriculum Hierarchy Tree */}
        <LPSidebarTree
          treeData={treeData}
          activeNodeId={activeNodeId}
          onSelectNode={handleSelectTreeNode}
          onAddModule={handleAddModule}
          onAddLesson={handleAddLessonToModule}
          onAddAssignment={handleAddAssignmentToModule}
          collapsed={isSidebarCollapsed}
          onToggleCollapse={() => setIsSidebarCollapsed(!isSidebarCollapsed)}
        />

        {/* Center Canvas Area: Editor or Trainee Preview */}
        <div className="lp-studio-canvas-area">
          {activeView === 'editor' ? (
            <div className="lp-studio-editor-scrollable">
              {editor && <Toolbar editor={editor} />}
              
              <div className="tiptap-editor-body">
                {errors.length > 0 && (
                  <div className="tiptap-error-banner">
                    <h4>{errors.some(e => !e.isWarning) ? 'Validation Errors' : 'Warnings'}</h4>
                    <ul>
                      {errors.map((err, i) => (
                        <li key={i} style={{ color: err.isWarning ? '#b45309' : undefined }}>
                          {err.message}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
                
                {editor && <LPMetadataBar editor={editor} onDirty={() => setIsDirty(true)} />}
                <EditorContent editor={editor} />
              </div>
            </div>
          ) : (
            <TraineePreviewCanvas
              treeData={treeData}
              title={documentTitle}
              description={documentDesc}
              level={editor?.state?.doc?.attrs?.level || 'Intermediate'}
              skillsTags={editor?.state?.doc?.attrs?.skillsTags || []}
            />
          )}
        </div>
      </div>

      {/* 3. Footer Bar */}
      <div className="editor-footer-actions">
        <div className="footer-status-pill">
          <span>{treeData.totalModules} Module{treeData.totalModules !== 1 ? 's' : ''}</span>
          <span className="dot">•</span>
          <span>{treeData.totalLessons} Lesson{treeData.totalLessons !== 1 ? 's' : ''}</span>
          <span className="dot">•</span>
          <span>{treeData.totalAssignments} Task{treeData.totalAssignments !== 1 ? 's' : ''}</span>
        </div>

        <div className="footer-btn-group">
          {onClose && (
            <button className="btn-secondary" onClick={onClose} disabled={isSubmitting}>
              Cancel
            </button>
          )}
          <button 
            className="btn-primary" 
            onClick={handleSubmit}
            disabled={isSubmitting}
          >
            {isSubmitting 
              ? (pathId ? 'Updating...' : 'Publishing...') 
              : (pathId ? 'Update Learning Path' : 'Publish Learning Path')}
          </button>
        </div>
      </div>
    </div>
  );
};
