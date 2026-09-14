import React from 'react';
import { Editor } from '@tiptap/react';
import { 
  Bold, Italic, List, ListOrdered, Heading2, 
  Layers, PlaySquare, FileText, Video, Headphones, Link2, HelpCircle 
} from 'lucide-react';
import { v4 as uuidv4 } from 'uuid';

interface ToolbarProps {
  editor: Editor;
}

// F8: JSON node descriptors are safe against Tiptap schema validation —
// raw HTML string inserts can fail silently if the HTML doesn't match parseHTML rules.
const makeModuleNode = () => ({
  type: 'module',
  attrs: { id: uuidv4(), sequentialLessonLock: true },
  content: [
    { type: 'heading', attrs: { level: 2 }, content: [{ type: 'text', text: 'New Module' }] },
    {
      type: 'lesson',
      attrs: { id: uuidv4() },
      content: [
        { type: 'heading', attrs: { level: 2 }, content: [{ type: 'text', text: 'New Lesson' }] },
        { type: 'paragraph', content: [{ type: 'text', text: 'Lesson content...' }] },
      ],
    },
  ],
});

const makeLessonNode = () => ({
  type: 'lesson',
  attrs: { id: uuidv4() },
  content: [
    { type: 'heading', attrs: { level: 2 }, content: [{ type: 'text', text: 'New Lesson' }] },
    { type: 'paragraph', content: [{ type: 'text', text: 'Lesson content...' }] },
  ],
});

const makeAssignmentNode = () => ({
  type: 'assignment',
  attrs: {
    id: uuidv4(),
    lockUntilLessonsComplete: true,
    autoEvaluateWithAI: false,
    humanInterventionRequired: true,
  },
  content: [
    { type: 'heading', attrs: { level: 2 }, content: [{ type: 'text', text: 'New Assignment' }] },
    { type: 'paragraph', content: [{ type: 'text', text: 'Assignment instructions...' }] },
    {
      type: 'questionBlock',
      attrs: {
        id: uuidv4(),
        questionType: 'Subjective',
        text: 'Question text...',
        maxPoints: 10,
        options: [],
        correctIndex: null,
      },
    },
  ],
});

const makeVideoBlock = () => ({
  type: 'videoBlock',
  attrs: { url: '', title: '' },
});

const makeAudioBlock = () => ({
  type: 'audioBlock',
  attrs: { url: '', title: '' },
});

const makeResourceBlock = () => ({
  type: 'resourceBlock',
  attrs: { url: '', label: 'Resource', type: 'Link' },
});

const makeQuestionBlock = () => ({
  type: 'questionBlock',
  attrs: {
    id: uuidv4(),
    questionType: 'Subjective',
    text: 'Question text...',
    maxPoints: 10,
    options: [],
    correctIndex: null,
  },
});

export const Toolbar: React.FC<ToolbarProps> = ({ editor }) => {
  if (!editor) return null;

  return (
    <div className="tiptap-toolbar">
      <div className="toolbar-group">
        <button
          onClick={() => editor.chain().focus().toggleBold().run()}
          className={editor.isActive('bold') ? 'is-active' : ''}
          title="Bold (Cmd+B)"
        >
          <Bold size={16} />
        </button>
        <button
          onClick={() => editor.chain().focus().toggleItalic().run()}
          className={editor.isActive('italic') ? 'is-active' : ''}
          title="Italic (Cmd+I)"
        >
          <Italic size={16} />
        </button>
        <button
          onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}
          className={editor.isActive('heading', { level: 2 }) ? 'is-active' : ''}
          title="Heading 2"
        >
          <Heading2 size={16} />
        </button>
        <button
          onClick={() => editor.chain().focus().toggleBulletList().run()}
          className={editor.isActive('bulletList') ? 'is-active' : ''}
          title="Bullet List"
        >
          <List size={16} />
        </button>
        <button
          onClick={() => editor.chain().focus().toggleOrderedList().run()}
          className={editor.isActive('orderedList') ? 'is-active' : ''}
          title="Numbered List"
        >
          <ListOrdered size={16} />
        </button>
      </div>

      <div className="toolbar-divider" />

      {/* Structural Elements */}
      <div className="toolbar-group">
        <button
          onClick={() => editor.chain().focus().insertContent(makeModuleNode()).run()}
          title="Add Module"
          className="structural-btn module-btn"
        >
          <Layers size={16} /> Add Module
        </button>
        <button
          onClick={() => editor.chain().focus().insertContent(makeLessonNode()).run()}
          title="Add Lesson (inside a Module)"
          className="structural-btn lesson-btn"
        >
          <PlaySquare size={16} /> Add Lesson
        </button>
        <button
          onClick={() => editor.chain().focus().insertContent(makeAssignmentNode()).run()}
          title="Add Assignment (after lessons in a Module)"
          className="structural-btn assignment-btn"
        >
          <FileText size={16} /> Add Assignment
        </button>
      </div>

      <div className="toolbar-divider" />

      {/* Content Blocks */}
      <div className="toolbar-group">
        <button
          onClick={() => editor.chain().focus().insertContent(makeVideoBlock()).run()}
          title="Add Video Block (inside a Lesson)"
        >
          <Video size={16} />
        </button>
        <button
          onClick={() => editor.chain().focus().insertContent(makeAudioBlock()).run()}
          title="Add Audio Block (inside a Lesson)"
        >
          <Headphones size={16} />
        </button>
        <button
          onClick={() => editor.chain().focus().insertContent(makeResourceBlock()).run()}
          title="Add Resource/PDF (inside a Lesson)"
        >
          <Link2 size={16} />
        </button>
        <button
          onClick={() => editor.chain().focus().insertContent(makeQuestionBlock()).run()}
          title="Add Question (inside an Assignment)"
        >
          <HelpCircle size={16} />
        </button>
      </div>
    </div>
  );
};
