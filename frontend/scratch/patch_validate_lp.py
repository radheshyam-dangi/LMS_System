import os

file_path = 'e:/LMS_System/LMS_System/frontend/src/components/TiptapLPEditor/validateLPDocument.ts'

with open(file_path, 'r', encoding='utf-8') as f:
    content = f.read()

# Find the end of the file logic
old_logic = """      // Timer duration validation
      const d = assignment.timerDuration;
      if (!d || (d.days === 0 && d.hours === 0 && d.minutes === 0)) {
        errors.push({
          path: `${aPath}.timerDuration`,
          message: `${modLabel} -> ${aLabel}: Assignment duration cannot be zero.`,
        });
      }
    }
  }

  return errors;
}"""

# Actually, wait, it has weird characters instead of ->
# I'll just use a regex
import re

match = re.search(r'// Timer duration validation.*?}(\s*)}\s*}\s*return errors;\s*}', content, re.DOTALL)
if match:
    replacement = content[match.start():match.end()]
    replacement = replacement.replace(
        "    }\n  }\n\n  return errors;\n}",
        """    }
      
      // Question validation
      if (assignment.questions) {
        for (let qi = 0; qi < assignment.questions.length; qi++) {
          const q = assignment.questions[qi];
          if (q.requiresLessonGrounding !== false) {
             const deps = q.lessonDependencies || [];
             if (deps.length === 0) {
               errors.push({
                 path: `${aPath}.questions[${qi}]`,
                 message: `${modLabel} -> ${aLabel} -> Question ${qi + 1}: Missing dependency. Requires AI grounding but no dependent lessons selected.`
               });
             } else {
               const pool = assignment.dependsOnLessonIds || [];
               const invalid = deps.filter((dep: string) => !pool.includes(dep));
               if (invalid.length > 0) {
                 errors.push({
                   path: `${aPath}.questions[${qi}]`,
                   message: `${modLabel} -> ${aLabel} -> Question ${qi + 1}: Invalid dependency. Question depends on lessons not in the assignment's pool.`
                 });
               }
             }
          }
        }
      }
    }
  }

  return errors;
}"""
    )
    content = content[:match.start()] + replacement + content[match.end():]
    with open(file_path, 'w', encoding='utf-8') as f:
        f.write(content)
else:
    print("Could not find the match block!")
