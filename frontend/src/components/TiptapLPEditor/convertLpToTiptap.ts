import { DEFAULT_ASSIGNMENT_INSTRUCTION_TEXT } from '../../utils/defaultInstructions';

function cleanHTML(html: string | undefined): string {
  if (!html) return '';
  return html.replace(/<[^>]*>?/gm, '').trim();
}

function createTextNode(text: string | undefined) {
  const cleaned = cleanHTML(text);
  if (!cleaned) return [];
  return [{ type: 'text', text: cleaned }];
}

export function convertLpToTiptap(lp: any): Record<string, any> {
  const titleContent = createTextNode(lp.title);
  const descContent = createTextNode(lp.description);
  const doc: any = {
    type: 'doc',
    attrs: {
      level: lp.difficulty?.toLowerCase() || 'basic',
      status: lp.status?.toLowerCase() || 'upcoming',
      skillsTags: Array.isArray(lp.skillsTags) ? lp.skillsTags : []
    },
    content: [
      {
        type: 'heading',
        attrs: { level: 1 },
        ...(titleContent.length ? { content: titleContent } : {})
      },
      {
        type: 'paragraph',
        ...(descContent.length ? { content: descContent } : {})
      }
    ]
  };

  for (const mod of lp.modules || []) {
    const modTitle = createTextNode(mod.title);
    const moduleNode: any = {
      type: 'module',
      attrs: {
        id: mod.id,
        sequentialModuleLock: mod.sequentialModuleLock ?? true,
        sequentialLessonLock: mod.lessonLocking ?? mod.sequentialLessonLock ?? true,
        lockRule: mod.lockRule || 'prerequisite',
        learningObjectives: mod.objectives || [],
        learningOutcomes: mod.outcomes || [],
        description: cleanHTML(mod.description) || '',
        moduleResources: (mod.resources || []).map((r: any) => ({
          label: r.title || r.label,
          url: r.url,
          type: r.type || 'Link'
        }))
      },
      content: [
        {
          type: 'heading',
          attrs: { level: 2 },
          ...(modTitle.length ? { content: modTitle } : {})
        }
      ]
    };

    // Module description is already stored in attrs.description

    for (const lesson of mod.lessons || []) {
      const lessonTitle = createTextNode(lesson.title);
      const lessonNode: any = {
        type: 'lesson',
        attrs: { id: lesson.id },
        content: [
          {
            type: 'heading',
            attrs: { level: 2 },
            ...(lessonTitle.length ? { content: lessonTitle } : {})
          }
        ]
      };

      if (lesson.description) {
        const lessonDesc = createTextNode(lesson.description);
        lessonNode.content.push({
          type: 'paragraph',
          ...(lessonDesc.length ? { content: lessonDesc } : {})
        });
      }

      const videos = lesson.videos?.length ? lesson.videos : (lesson.videoUrl ? [{ url: lesson.videoUrl }] : []);
      for (const video of videos) {
        lessonNode.content.push({
          type: 'videoBlock',
          attrs: { url: video.url || video }
        });
      }

      for (const audio of lesson.audios || []) {
        lessonNode.content.push({
          type: 'audioBlock',
          attrs: { url: audio.url || audio }
        });
      }

      for (const resource of lesson.resources || []) {
        lessonNode.content.push({
          type: 'resourceBlock',
          attrs: { url: resource.url, label: resource.title || resource.label }
        });
      }

      if (lesson.keyPoints?.length > 0) {
        lessonNode.content.push({
          type: 'bulletList',
          content: lesson.keyPoints.map((kp: string) => {
            const kpText = createTextNode(kp);
            return {
              type: 'listItem',
              content: [
                {
                  type: 'paragraph',
                  ...(kpText.length ? { content: kpText } : {})
                }
              ]
            };
          })
        });
      }

      moduleNode.content.push(lessonNode);
    }

    for (const assignment of mod.assignments || []) {
      const assignmentTitle = createTextNode(assignment.title);
      const assignmentNode: any = {
        type: 'assignment',
        attrs: {
          id: assignment.id,
          lockUntilLessonsComplete: assignment.lockUntilLessonsComplete ?? true,
          autoEvaluateWithAI: assignment.autoEvaluateWithAI ?? false,
          humanInterventionRequired: assignment.humanInterventionRequired ?? true,
          timerDuration: {
            days: Math.floor((assignment.timerDuration || 0) / (24 * 60)),
            hours: Math.floor(((assignment.timerDuration || 0) % (24 * 60)) / 60),
            minutes: (assignment.timerDuration || 0) % 60,
          },
          countdownStart: assignment.anchorType === 'TASK_UNLOCKED' ? 'taskUnlocked' : 'onAssignment'
        },
        content: [
          {
            type: 'heading',
            attrs: { level: 2 },
            ...(assignmentTitle.length ? { content: assignmentTitle } : {})
          }
        ]
      };

      const rawInstructions = assignment.instructions || assignment.description;
      if (rawInstructions && cleanHTML(rawInstructions)) {
        const assignmentDesc = createTextNode(rawInstructions);
        assignmentNode.content.push({
          type: 'paragraph',
          ...(assignmentDesc.length ? { content: assignmentDesc } : {})
        });
      } else {
        assignmentNode.content.push({
          type: 'paragraph',
          content: [{ type: 'text', text: DEFAULT_ASSIGNMENT_INSTRUCTION_TEXT }]
        });
      }

      for (const q of assignment.questions || []) {
        const isPlaceholder = !q.text || q.text.trim() === 'Type your question here...' || q.text.trim() === 'New Question';
        const qText = isPlaceholder ? [] : createTextNode(q.text);
        const isMcq = q.type === 'MCQ';
        const rawOptions = Array.isArray(q.options) ? q.options : [];
        const qOptions = rawOptions.length > 0 ? rawOptions : (isMcq ? ['', '', '', ''] : []);

        const qNode: any = {
          type: 'questionBlock',
          attrs: {
            id: q.id,
            questionType: q.type || 'Subjective',
            maxPoints: q.maxPoints || 10,
            correctIndex: typeof q.correctIndex === 'number' ? q.correctIndex : (isMcq ? 0 : null),
            options: qOptions,
            expectedAnswerGuideline: q.expectedAnswerGuideline || '',
            requiresLessonGrounding: q.requiresLessonGrounding !== false,
            lessonDependencies: Array.isArray(q.lessonDependencies) ? q.lessonDependencies : (Array.isArray(q.questionLessonDependencies) ? q.questionLessonDependencies.map((d: any) => d.lessonId || d) : [])
          },
          content: [
            {
              type: 'paragraph',
              ...(qText.length ? { content: qText } : {})
            }
          ]
        };

        // Note: For MCQ questions, options belong in attrs.options so they are rendered
        // as interactive option choices with radio buttons, NOT as duplicate bullet points in question text.
        if (!isMcq && rawOptions.length > 0) {
          qNode.content.push({
            type: 'bulletList',
            content: rawOptions.map((opt: string) => {
              const optText = createTextNode(opt);
              return {
                type: 'listItem',
                content: [
                  {
                    type: 'paragraph',
                    ...(optText.length ? { content: optText } : {})
                  }
                ]
              };
            })
          });
        }
        assignmentNode.content.push(qNode);
      }

      moduleNode.content.push(assignmentNode);
    }

    doc.content.push(moduleNode);
  }

  return doc;
}
