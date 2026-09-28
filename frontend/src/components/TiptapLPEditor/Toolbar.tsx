import React from 'react';
import { Editor } from '@tiptap/react';
import { 
  Bold, Italic, List, ListOrdered, Heading2, 
  Layers, PlaySquare, FileText, Video, Headphones, Link2, HelpCircle,
  Sparkles
} from 'lucide-react';
import { v4 as uuidv4 } from 'uuid';

interface ToolbarProps {
  editor: Editor;
}

const makeModuleNode = () => ({
  type: 'module',
  attrs: { id: uuidv4(), sequentialLessonLock: true, description: 'Module description and learning overview...' },
  content: [
    { type: 'heading', attrs: { level: 2 }, content: [{ type: 'text', text: 'New Module' }] },
    { type: 'paragraph', content: [{ type: 'text', text: 'Module description and learning overview...' }] },
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
        maxPoints: 10,
        correctIndex: 0,
        options: ['', '', '', ''],
      },
      content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Type your question here...' }] }]
    },
  ],
});

const makeVideoBlock = (url: string) => ({
  type: 'videoBlock',
  attrs: { url, title: '' },
});

const makeAudioBlock = (url: string) => ({
  type: 'audioBlock',
  attrs: { url, title: '' },
});

const makeResourceBlock = (url: string, label: string) => ({
  type: 'resourceBlock',
  attrs: { url, label: label || 'Resource', type: 'Link' },
});

const makeQuestionBlock = () => ({
  type: 'questionBlock',
  attrs: {
    id: uuidv4(),
    questionType: 'Subjective',
    maxPoints: 10,
    correctIndex: 0,
    options: ['', '', '', ''],
  },
  content: [
    { type: 'paragraph', content: [{ type: 'text', text: 'Type your question here...' }] }
  ]
});

export const Toolbar: React.FC<ToolbarProps> = ({ editor }) => {
  if (!editor) return null;

  return (
    <div className="tiptap-toolbar">
      <div className="toolbar-left">
        {/* Typography Formatting */}
        <div className="toolbar-group">
          <button
            onClick={() => editor.chain().focus().toggleBold().run()}
            className={editor.isActive('bold') ? 'is-active' : ''}
            title="Bold (Cmd+B)"
          >
            <Bold size={15} />
          </button>
          <button
            onClick={() => editor.chain().focus().toggleItalic().run()}
            className={editor.isActive('italic') ? 'is-active' : ''}
            title="Italic (Cmd+I)"
          >
            <Italic size={15} />
          </button>
          <button
            onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}
            className={editor.isActive('heading', { level: 2 }) ? 'is-active' : ''}
            title="Heading 2"
          >
            <Heading2 size={15} />
          </button>
          <button
            onClick={() => editor.chain().focus().toggleBulletList().run()}
            className={editor.isActive('bulletList') ? 'is-active' : ''}
            title="Bullet List"
          >
            <List size={15} />
          </button>
          <button
            onClick={() => editor.chain().focus().toggleOrderedList().run()}
            className={editor.isActive('orderedList') ? 'is-active' : ''}
            title="Numbered List"
          >
            <ListOrdered size={15} />
          </button>
        </div>

        <div className="toolbar-divider" />

        {/* Structural Curriculum Elements */}
        <div className="toolbar-group">
          <button
            onClick={() => {
              const node = makeModuleNode();
              editor.chain().focus('end').insertContent(node).run();
            }}
            title="Add Module to Learning Path"
            className="structural-btn module-btn"
          >
            <Layers size={14} /> + Module
          </button>
          <button
            onClick={() => {
              let targetModulePos: number | null = null;
              let targetModuleSize: number | null = null;
              editor.state.doc.descendants((node, pos) => {
                if (node.type.name === 'module') {
                  const { from, to } = editor.state.selection;
                  if (from >= pos && to <= pos + node.nodeSize) {
                    targetModulePos = pos;
                    targetModuleSize = node.nodeSize;
                    return false;
                  }
                }
              });
              if (targetModulePos === null) {
                editor.state.doc.descendants((node, pos) => {
                  if (node.type.name === 'module') {
                    targetModulePos = pos;
                    targetModuleSize = node.nodeSize;
                  }
                });
              }
              if (targetModulePos === null) {
                const newModule: any = makeModuleNode();
                newModule.content = [
                  { type: 'heading', attrs: { level: 2 }, content: [{ type: 'text', text: 'New Module' }] },
                  { type: 'paragraph', content: [{ type: 'text', text: 'Module description and learning overview...' }] },
                  makeLessonNode()
                ];
                editor.chain().focus('end').insertContent(newModule).run();
              } else {
                editor.commands.insertContentAt(targetModulePos! + targetModuleSize! - 1, makeLessonNode() as any);
              }
            }}
            title="Add Lesson (inside current Module)"
            className="structural-btn lesson-btn"
          >
            <PlaySquare size={14} /> + Lesson
          </button>
          <button
            onClick={() => {
              let targetModulePos: number | null = null;
              let targetModuleSize: number | null = null;
              editor.state.doc.descendants((node, pos) => {
                if (node.type.name === 'module') {
                  const { from, to } = editor.state.selection;
                  if (from >= pos && to <= pos + node.nodeSize) {
                    targetModulePos = pos;
                    targetModuleSize = node.nodeSize;
                    return false;
                  }
                }
              });
              if (targetModulePos === null) {
                editor.state.doc.descendants((node, pos) => {
                  if (node.type.name === 'module') {
                    targetModulePos = pos;
                    targetModuleSize = node.nodeSize;
                  }
                });
              }
              if (targetModulePos === null) {
                const newModule: any = makeModuleNode();
                newModule.content = [
                  { type: 'heading', attrs: { level: 2 }, content: [{ type: 'text', text: 'New Module' }] },
                  makeAssignmentNode()
                ];
                editor.chain().focus('end').insertContent(newModule).run();
              } else {
                editor.commands.insertContentAt(targetModulePos! + targetModuleSize! - 1, makeAssignmentNode() as any);
              }
            }}
            title="Add Assignment (inside current Module)"
            className="structural-btn assignment-btn"
          >
            <FileText size={14} /> + Assignment
          </button>
        </div>

        <div className="toolbar-divider" />

        {/* Media & Content Blocks */}
        <div className="toolbar-group">
          <button
            onClick={() => {
              const url = window.prompt('Enter Video URL (YouTube or mp4):');
              if (url) editor.chain().focus().insertContent(makeVideoBlock(url)).run();
            }}
            title="Add Video Block"
          >
            <Video size={15} /> Video
          </button>
          <button
            onClick={() => {
              const url = window.prompt('Enter Audio URL (mp3, wav):');
              if (url) editor.chain().focus().insertContent(makeAudioBlock(url)).run();
            }}
            title="Add Audio Block"
          >
            <Headphones size={15} /> Audio
          </button>
          <button
            onClick={() => {
              const url = window.prompt('Enter Resource URL (PDF or Web link):');
              if (url) {
                const label = window.prompt('Enter a label for this resource:') || 'Resource';
                editor.chain().focus().insertContent(makeResourceBlock(url, label)).run();
              }
            }}
            title="Add Resource/PDF Attachment"
          >
            <Link2 size={15} /> Resource
          </button>
          <button
            onClick={() => editor.chain().focus().insertContent(makeQuestionBlock()).run()}
            title="Add Question Block"
          >
            <HelpCircle size={15} /> Question
          </button>
        </div>
      </div>

      <div className="toolbar-tip">
        <Sparkles size={12} color="#6366f1" />
        <span>Type <strong>/</strong> in document for fast commands</span>
      </div>
    </div>
  );
};
