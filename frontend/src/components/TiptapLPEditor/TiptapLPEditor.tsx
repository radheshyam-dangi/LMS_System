import React, { useState, useEffect } from 'react';
import { useEditor, EditorContent, ReactNodeViewRenderer } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Placeholder from '@tiptap/extension-placeholder';
import Heading from '@tiptap/extension-heading';
import Paragraph from '@tiptap/extension-paragraph';
import Text from '@tiptap/extension-text';
import Document from '@tiptap/extension-document';
import { useNavigate } from 'react-router-dom';


import './TiptapLPEditor.css';
import { Toolbar } from './Toolbar';
import { SlashCommands, getSuggestionItems, renderSlashCommandList } from './slashCommands';
// F6: Separate imports — parseLPDocument is in parseLPDocument.ts, validateLPDocument is in validateLPDocument.ts
import { parseLPDocument } from './parseLPDocument';
import { validateLPDocument, type ValidationError } from './validateLPDocument';
import { lpAuthoringService } from '../../services/lpAuthoringService';

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

// Custom Document that allows title and modules
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

    // Support comma-separated tags
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
    if (e.key === 'Enter') {
      e.preventDefault();
      handleAddTag();
    } else if (e.key === ',') {
      e.preventDefault();
      handleAddTag();
    }
  };

  const unusedPopularSkills = POPULAR_SKILLS.filter(
    (skill) => !skillsTags.some((t) => t.toLowerCase() === skill.toLowerCase())
  );

  return (
    <div className="lp-metadata-bar">
      <div className="lp-metadata-top-row">
        <div className="lp-metadata-group">
          <div className="lp-metadata-item">
            <span className="lp-metadata-label">Level:</span>
            <select 
              className="lp-metadata-select"
              value={level} 
              onChange={(e) => updateDocAttr('level', e.target.value)}
            >
              <option value="basic">🌱 Basic</option>
              <option value="intermediate">⚡ Intermediate</option>
              <option value="advanced">🚀 Advanced</option>
            </select>
          </div>
          <div className="lp-metadata-item">
            <span className="lp-metadata-label">Status:</span>
            <select 
              className="lp-metadata-select"
              value={status} 
              onChange={(e) => updateDocAttr('status', e.target.value)}
            >
              <option value="active">🟢 Active (Published)</option>
              <option value="upcoming">🟡 Upcoming (Draft)</option>
            </select>
          </div>
          <div className="lp-metadata-item" style={{ flex: 1, minWidth: '200px' }}>
            <span className="lp-metadata-label">Thumbnail URL:</span>
            <input 
              type="text" 
              className="lp-metadata-input"
              style={{ width: '100%', padding: '6px 12px', border: '1px solid #cbd5e1', borderRadius: '6px', fontSize: '13px' }}
              placeholder="https://example.com/image.png"
              value={imageUrl} 
              onChange={(e) => updateDocAttr('imageUrl', e.target.value)}
            />
          </div>
        </div>

        <div className="lp-metadata-counters">
          <span className="lp-metadata-counter-chip">📦 {counts.modules} Module{counts.modules !== 1 ? 's' : ''}</span>
          <span className="lp-metadata-counter-chip">📖 {counts.lessons} Lesson{counts.lessons !== 1 ? 's' : ''}</span>
          <span className="lp-metadata-counter-chip">📝 {counts.assignments} Task{counts.assignments !== 1 ? 's' : ''}</span>
        </div>
      </div>

      {/* SKILL TAGS CREATION & MANAGEMENT SECTION */}
      <div className="lp-skill-tags-section">
        <div className="lp-skill-tags-header">
          <div className="lp-skill-tags-title-group">
            <span className="lp-skill-tags-icon">🏷️</span>
            <span className="lp-skill-tags-title">Skill Tags & Competencies</span>
            <span className="lp-skill-tags-count-badge">
              {skillsTags.length} {skillsTags.length === 1 ? 'tag' : 'tags'}
            </span>
          </div>
          <span className="lp-skill-tags-subtitle">
            Used on Learning Path cards and powers skill-based search across the catalog
          </span>
        </div>

        {/* Existing Tags Chips */}
        <div className="lp-skill-tags-cloud">
          {skillsTags.length === 0 ? (
            <div className="lp-tags-empty-state">
              <span>No skill tags added yet. Type below or pick from quick suggestions to categorize this path.</span>
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

        {/* Tag Input Form */}
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
            ⚠️ {tagError}
          </div>
        )}

        {/* Suggested Quick Tags */}
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
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errors, setErrors] = useState<ValidationError[]>([]);
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'saved'>('idle');
  // F7: Only autosave after user has made a change — don't save the pristine initial content
  const [isDirty, setIsDirty] = useState(false);

  const editor = useEditor({
    extensions: [
      LPDocument,
      StarterKit.configure({
        document: false, // Override default document
        heading: false,  // We configure heading explicitly
        dropcursor: { color: '#3b82f6', width: 2 },
      }),
      Heading.configure({ levels: [1, 2, 3] }),
      Placeholder.configure({
        placeholder: ({ node }) => {
          if (node.type.name === 'heading' && node.attrs.level === 1) return 'Learning Path Title';
          if (node.type.name === 'heading' && node.attrs.level === 2) return 'Title';
          if (node.type.name === 'paragraph') return 'Description or content...';
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
      ModuleNode.extend({ addNodeView() { return ReactNodeViewRenderer(ModuleNodeView) } }),
      LessonNode.extend({ addNodeView() { return ReactNodeViewRenderer(LessonNodeView) } }),
      AssignmentNode.extend({ addNodeView() { return ReactNodeViewRenderer(AssignmentNodeView) } }),

      // Media Blocks
      VideoBlockNode.extend({ addNodeView() { return ReactNodeViewRenderer(VideoBlockView) } }),
      AudioBlockNode.extend({ addNodeView() { return ReactNodeViewRenderer(AudioBlockView) } }),
      ResourceBlockNode.extend({ addNodeView() { return ReactNodeViewRenderer(ResourceBlockView) } }),

      // Question Block
      QuestionBlockNode.extend({ addNodeView() { return ReactNodeViewRenderer(QuestionBlockView) } }),
    ],
    content: initialDraftData || `<h1>Untitled Learning Path</h1><p>A brief description of this learning path...</p><div data-type="module"><h2>Module 1</h2><div data-type="lesson"><h2>Lesson 1</h2><p>Welcome to lesson 1</p></div></div>`,
    onUpdate: ({ editor }) => {
      // Clear errors on edit and mark dirty
      if (errors.length > 0) setErrors([]);
      setSaveStatus('idle');
      // F7: Mark dirty on first user edit
      setIsDirty(true);
    },
  });

  // Autosave Draft
  useEffect(() => {
    if (!editor || !token) return;

    const interval = setInterval(async () => {
      // F7: Don't autosave pristine editor — only after user has edited something
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
      } catch (err) {
        console.error('Autosave failed:', err);
        setSaveStatus('idle'); // retry next tick
      }
    }, 15000); // Autosave every 15s

    return () => clearInterval(interval);
  }, [editor, token, draftId, saveStatus, isDirty]);

  // Handle deep-links for creating/editing modules and lessons
  useEffect(() => {
    if (editor && !editor.isDestroyed && focusAction) {
      // Need a slight delay to ensure editor DOM is fully painted
      setTimeout(() => {
        if (focusAction === 'createModule') {
          // Move cursor to the end and insert module
          editor.commands.focus('end');
          editor.commands.insertContent({
            type: 'module',
            content: [{ type: 'heading', attrs: { level: 2 } }, { type: 'paragraph' }]
          });
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
              // Insert lesson at the end of the module
              const endPos = pos + node.nodeSize - 1;
              editor.commands.insertContentAt(endPos, {
                type: 'lesson',
                content: [{ type: 'heading', attrs: { level: 2 } }, { type: 'paragraph' }]
              });
              editor.commands.focus(endPos + 1);
            }
            return false; // Stop traversal once found
          }
        });

        if (!found) {
          editor.commands.focus('start'); // Fallback if ID not found
        }
      }, 300);
    }
  }, [editor, focusAction, targetId]);

  const handleSubmit = async () => {
    if (!editor || !token) return;

    const json = editor.getJSON();
    const parsed = parseLPDocument(json, draftId, pathId);
    
    // Client-side validation
    const validationErrors = validateLPDocument(parsed);
    const blockingErrors = validationErrors.filter(e => !e.isWarning);
    if (blockingErrors.length > 0) {
      setErrors(validationErrors); // Show all (including warnings)
      // Scroll to top to show errors
      document.querySelector('.tiptap-editor-body')?.scrollTo(0, 0);
      return; // Only block on real errors
    }
    // Show warnings in the UI but don't block submit
    if (validationErrors.length > 0) {
      setErrors(validationErrors);
    }

    setIsSubmitting(true);
    try {
      const result = await lpAuthoringService.submitLPDocument(parsed, token);
      alert(`Success! Created Learning Path: ${result.title}`);
      
      // Navigate to the newly created LP
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

      <div className="editor-footer-actions">
        <div className="footer-status-pill">
          <div className="pulse-dot" />
          <span>
            {saveStatus === 'saving' && 'Autosaving draft to cloud...'}
            {saveStatus === 'saved' && 'Draft saved to cloud ✓'}
            {saveStatus === 'idle' && (isDirty ? 'Unsaved edits' : 'Live Document Sync')}
          </span>
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
              : (pathId ? '💾 Update Learning Path' : '🚀 Publish Learning Path')}
          </button>
        </div>
      </div>
    </div>
  );
};
