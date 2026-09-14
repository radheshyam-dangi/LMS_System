import React, { useState, useEffect } from 'react';
import { useEditor, EditorContent, ReactNodeViewRenderer } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Placeholder from '@tiptap/extension-placeholder';
import Heading from '@tiptap/extension-heading';
import Paragraph from '@tiptap/extension-paragraph';
import Text from '@tiptap/extension-text';
import Document from '@tiptap/extension-document';
import History from '@tiptap/extension-history';
import Dropcursor from '@tiptap/extension-dropcursor';
import Gapcursor from '@tiptap/extension-gapcursor';
import { useNavigate } from 'react-router-dom';

import './TiptapLPEditor.css';
import { Toolbar } from './Toolbar';
// F6: Separate imports — parseLPDocument is in parseLPDocument.ts, validateLPDocument is in validateLPDocument.ts
import { parseLPDocument } from './parseLPDocument';
import { validateLPDocument, ValidationError } from './validateLPDocument';
import { lpAuthoringService } from '../../services/lpAuthoringService';
import { useAuth } from '../../context/AuthContext';

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
  content: 'heading paragraph module+',
});

interface TiptapLPEditorProps {
  initialDraftData?: any;
  draftId?: string;
  onClose?: () => void;
}

export const TiptapLPEditor: React.FC<TiptapLPEditorProps> = ({ 
  initialDraftData, 
  draftId,
  onClose 
}) => {
  const { token } = useAuth();
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
        history: false,  // Explicit history
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
      History,
      Dropcursor.configure({ color: '#3b82f6', width: 2 }),
      Gapcursor,

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
    content: initialDraftData || `
      <h1>Untitled Learning Path</h1>
      <p>A brief description of this learning path...</p>
      <div data-type="module">
        <h2>Module 1</h2>
        <div data-type="lesson">
          <h2>Lesson 1</h2>
          <p>Welcome to lesson 1</p>
        </div>
      </div>
    `,
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

  const handleSubmit = async () => {
    if (!editor || !token) return;

    const json = editor.getJSON();
    const parsed = parseLPDocument(json, draftId);
    
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
        navigate(`/curriculum/learning-paths/${result.id}`);
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
        
        <EditorContent editor={editor} />
      </div>

      <div className="editor-footer-actions">
        <span style={{ margin: 'auto auto auto 0', color: '#94a3b8', fontSize: 13 }}>
          {saveStatus === 'saving' && 'Autosaving...'}
          {saveStatus === 'saved' && 'Draft saved ✓'}
        </span>

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
          {isSubmitting ? 'Publishing...' : 'Publish Learning Path'}
        </button>
      </div>
    </div>
  );
};
