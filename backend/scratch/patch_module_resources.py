import os

file_path = 'e:/LMS_System/LMS_System/backend/src/databaseOrm/modules/lpAuthoring/lpAuthoring.service.ts'

with open(file_path, 'r', encoding='utf-8') as f:
    content = f.read()

old_module = """        const moduleData = manager.create(ModuleEntity, {
          ...(modulePayload.id && /^[0-9a-f]{8}-/i.test(modulePayload.id) ? { id: modulePayload.id } : {}),
          title: modulePayload.title || `Module ${moduleIdx + 1}`,
          description: modulePayload.description || null,
          lessonLocking: modulePayload.sequentialLessonLock !== false,
          taskLocking: true,
          durationWeeks: Math.ceil(moduleDays / 7),
          learningPath: savedLP,
          createdBy: creator,
        });
        const savedModule = await manager.save(ModuleEntity, moduleData);"""

new_module = """        const moduleData = manager.create(ModuleEntity, {
          ...(modulePayload.id && /^[0-9a-f]{8}-/i.test(modulePayload.id) ? { id: modulePayload.id } : {}),
          title: modulePayload.title || `Module ${moduleIdx + 1}`,
          description: modulePayload.description || null,
          lessonLocking: modulePayload.sequentialLessonLock !== false,
          taskLocking: true,
          durationWeeks: Math.ceil(moduleDays / 7),
          learningPath: savedLP,
          createdBy: creator,
          objectives: modulePayload.learningObjectives || [],
          outcomes: modulePayload.learningOutcomes || [],
        });
        const savedModule = await manager.save(ModuleEntity, moduleData);
        
        // Save module-level resources
        if (modulePayload.moduleResources && modulePayload.moduleResources.length > 0) {
          const resEntities = modulePayload.moduleResources.map((r: any) =>
            manager.create(ResourceEntity, {
              title: r.label || 'Resource',
              url: r.url,
              type: r.type || 'Link',
              module: savedModule,
            }),
          );
          await manager.save(ResourceEntity, resEntities);
        }"""

content = content.replace(old_module, new_module)

with open(file_path, 'w', encoding='utf-8') as f:
    f.write(content)
