import React from 'react';
import { Editor } from '@tiptap/react';
import { 
  Bold, Italic, List, ListOrdered, Heading2, 
  Layers, PlaySquare, FileText, Video, Link2, HelpCircle,
  Command
} from 'lucide-react';
import { v4 as uuidv4 } from 'uuid';
import { DEFAULT_ASSIGNMENT_INSTRUCTION_TEXT } from '../../utils/defaultInstructions';

interface ToolbarProps {
  editor: Editor;
}

const makeModuleNode = () => ({
  type: 'module',
  attrs: { 
    id: uuidv4(), 
    sequentialModuleLock: true, 
    sequentialLessonLock: true, 
    lockRule: 'prerequisite',
    description: '' 
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
});

const makeLessonNode = () => ({
  type: 'lesson',
  attrs: { id: uuidv4(), lockRule: 'prerequisite' },
  content: [
    { type: 'heading', attrs: { level: 2 }, content: [{ type: 'text', text: 'New Lesson' }] },
    { type: 'paragraph' },
  ],
});

const makeAssignmentNode = () => ({
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
      attrs: {
        id: uuidv4(),
        questionType: 'Subjective',
        maxPoints: 10,
        correctIndex: 0,
        options: ['', '', '', ''],
      },
      content: [{ type: 'paragraph' }]
    },
  ],
});

const makeVideoBlock = (url: string) => ({
  type: 'videoBlock',
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
    { type: 'paragraph' }
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
        <div className="toolbar-group" title="Add structural section blocks">
          <span style={{ fontSize: '10px', fontWeight: 800, color: '#64748b', letterSpacing: '0.05em', textTransform: 'uppercase', marginRight: '4px' }}>
            SECTIONS:
          </span>
          <button
            onClick={() => {
              const node = makeModuleNode();
              editor.chain().focus('end').insertContent(node).run();
            }}
            title="Add Module Section to Learning Path"
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
              const url = window.prompt('Enter Video URL (YouTube, Vimeo, MP4):');
              if (url) editor.chain().focus().insertContent(makeVideoBlock(url)).run();
            }}
            title="Add Core Video Block"
            style={{ color: '#dc2626' }}
          >
            <Video size={15} /> Video
          </button>
          <button
            onClick={() => {
              const url = window.prompt('Enter Resource URL (PDF, GitHub, or Web link):');
              if (url) {
                const label = window.prompt('Enter a title/label for this resource:') || 'Resource';
                editor.chain().focus().insertContent(makeResourceBlock(url, label)).run();
              }
            }}
            title="Add Resource/PDF Attachment"
            style={{ color: '#0284c7' }}
          >
            <Link2 size={15} /> Resource
          </button>
          <button
            onClick={() => editor.chain().focus().insertContent(makeQuestionBlock()).run()}
            title="Add Question Block"
            style={{ color: '#d97706' }}
          >
            <HelpCircle size={15} /> Question
          </button>
        </div>
      </div>

      
    </div>
  );
};
