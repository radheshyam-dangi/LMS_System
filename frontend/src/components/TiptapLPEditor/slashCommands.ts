import { Extension } from '@tiptap/core';
import Suggestion from '@tiptap/suggestion';
import { v4 as uuidv4 } from 'uuid';
import tippy from 'tippy.js';
import 'tippy.js/dist/tippy.css';

export const SlashCommands = Extension.create({
  name: 'slashCommands',

  addOptions() {
    return {
      suggestion: {
        char: '/',
        command: ({ editor, range, props }: any) => {
          props.command({ editor, range });
        },
      } as Record<string, any>,
    };
  },

  addProseMirrorPlugins() {
    return [
      Suggestion({
        editor: this.editor,
        ...this.options.suggestion,
      }),
    ];
  },
});

export const getSuggestionItems = ({ query, editor }: { query: string; editor: any }) => {
  const isInsideModule = editor.isActive('module');
  const isInsideLesson = editor.isActive('lesson');
  const isInsideAssignment = editor.isActive('assignment');

  let items = [];

  // Context-aware rules:
  if (!isInsideModule && !isInsideLesson && !isInsideAssignment) {
    items.push({
      title: 'Module',
      command: ({ editor, range }: any) => {
        editor.chain().focus().deleteRange(range).insertContent({
          type: 'module',
          attrs: { id: uuidv4(), sequentialLessonLock: true },
          content: [
            { type: 'heading', attrs: { level: 2 }, content: [{ type: 'text', text: 'New Module' }] },
            { type: 'paragraph' }
          ]
        }).run();
      },
    });
  }

  if (isInsideModule && !isInsideLesson && !isInsideAssignment) {
    items.push({
      title: 'Lesson',
      command: ({ editor, range }: any) => {
        editor.chain().focus().deleteRange(range).insertContent({
          type: 'lesson',
          attrs: { id: uuidv4() },
          content: [
            { type: 'heading', attrs: { level: 2 }, content: [{ type: 'text', text: 'New Lesson' }] },
            { type: 'paragraph' }
          ]
        }).run();
      },
    });
    items.push({
      title: 'Assignment',
      command: ({ editor, range }: any) => {
        editor.chain().focus().deleteRange(range).insertContent({
          type: 'assignment',
          attrs: {
            id: uuidv4(),
            lockUntilLessonsComplete: true,
            autoEvaluateWithAI: false,
            humanInterventionRequired: true,
            countdownStart: 'onAssignment',
          },
          content: [
            { type: 'heading', attrs: { level: 2 }, content: [{ type: 'text', text: 'New Assignment' }] },
            { type: 'paragraph' }
          ]
        }).run();
      },
    });
  }

  if (isInsideLesson) {
    items.push({
      title: 'Video',
      command: ({ editor, range }: any) => {
        editor.chain().focus().deleteRange(range).insertContent({ type: 'videoBlock', attrs: { url: '', title: '' } }).run();
      },
    });
    items.push({
      title: 'Audio',
      command: ({ editor, range }: any) => {
        editor.chain().focus().deleteRange(range).insertContent({ type: 'audioBlock', attrs: { url: '', title: '' } }).run();
      },
    });
    items.push({
      title: 'Resource',
      command: ({ editor, range }: any) => {
        editor.chain().focus().deleteRange(range).insertContent({ type: 'resourceBlock', attrs: { url: '', label: '', type: 'Link' } }).run();
      },
    });
  }

  if (isInsideAssignment) {
    items.push({
      title: 'Question',
      command: ({ editor, range }: any) => {
        editor.chain().focus().deleteRange(range).insertContent({
          type: 'questionBlock',
          attrs: {
            id: uuidv4(),
            questionType: 'Subjective',
            maxPoints: 10,
            correctIndex: null,
          },
          content: [
            { type: 'paragraph', content: [{ type: 'text', text: 'New Question' }] }
          ]
        }).run();
      },
    });
  }

  return items.filter(item => item.title.toLowerCase().startsWith(query.toLowerCase())).slice(0, 10);
};


export const renderSlashCommandList = () => {
  let component: any;
  let popup: any;

  return {
    onStart: (props: any) => {
      const container = document.createElement('div');
      container.className = 'slash-command-menu';
      
      const updateMenu = (items: any[]) => {
        container.innerHTML = '';
        items.forEach((item, index) => {
          const btn = document.createElement('button');
          btn.textContent = item.title;
          btn.className = 'slash-command-item';
          btn.onclick = () => props.command(item);
          container.appendChild(btn);
        });
      };
      updateMenu(props.items);
      
      component = { updateMenu };

      popup = tippy('body', {
        getReferenceClientRect: props.clientRect,
        appendTo: () => document.body,
        content: container,
        showOnCreate: true,
        interactive: true,
        trigger: 'manual',
        placement: 'bottom-start',
      });
    },

    onUpdate(props: any) {
      component?.updateMenu(props.items);
      popup[0].setProps({
        getReferenceClientRect: props.clientRect,
      });
    },

    onKeyDown(props: any) {
      if (props.event.key === 'Escape') {
        popup[0].hide();
        return true;
      }
      return false;
    },

    onExit() {
      popup[0].destroy();
      component = null;
    },
  };
};
