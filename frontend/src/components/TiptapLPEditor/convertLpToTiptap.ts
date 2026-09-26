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
      status: lp.status?.toLowerCase() || 'upcoming'
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
        sequentialLessonLock: mod.lessonLocking ?? true,
        learningObjectives: mod.objectives || [],
        learningOutcomes: mod.outcomes || [],
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

    if (mod.description) {
      const modDesc = createTextNode(mod.description);
      moduleNode.content.push({
        type: 'paragraph',
        ...(modDesc.length ? { content: modDesc } : {})
      });
    }

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

      for (const video of lesson.videos || []) {
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

      if (assignment.description) {
        const assignmentDesc = createTextNode(assignment.description);
        assignmentNode.content.push({
          type: 'paragraph',
          ...(assignmentDesc.length ? { content: assignmentDesc } : {})
        });
      }

      for (const q of assignment.questions || []) {
        const qText = createTextNode(q.text);
        const qNode: any = {
          type: 'questionBlock',
          attrs: {
            id: q.id,
            questionType: q.type || 'Subjective',
            maxPoints: q.maxPoints || 10,
            correctIndex: q.correctIndex,
            expectedAnswerGuideline: q.expectedAnswerGuideline || ''
          },
          content: [
            {
              type: 'paragraph',
              ...(qText.length ? { content: qText } : {})
            }
          ]
        };
        if (q.options?.length > 0) {
          qNode.content.push({
            type: 'bulletList',
            content: q.options.map((opt: string) => {
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
