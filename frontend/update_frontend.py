import os

file_path = 'e:/LMS_System/LMS_System/frontend/src/components/CurriculumManager/CurriculumManager.tsx'

with open(file_path, 'r', encoding='utf-8') as f:
    content = f.read()

# Replace initialization states
content = content.replace(
    "const [subjectiveQuestions, setSubjectiveQuestions] = useState<any[]>([\n    { id: 'sub-1', questionText: '', maxPoints: 10 },\n  ]);",
    "const [subjectiveQuestions, setSubjectiveQuestions] = useState<any[]>([\n    { id: 'sub-1', questionText: '', maxPoints: 10, dependentLessonIds: [] },\n  ]);"
)

content = content.replace(
    "setSubjectiveQuestions([{ id: 'sub-1', questionText: '', maxPoints: 10 }]);",
    "setSubjectiveQuestions([{ id: 'sub-1', questionText: '', maxPoints: 10, dependentLessonIds: [] }]);"
)

content = content.replace(
    "onClick={() => setSubjectiveQuestions(prev => [...prev, { id: `sub-${Date.now()}`, questionText: '', maxPoints: 10 }])}",
    "onClick={() => setSubjectiveQuestions(prev => [...prev, { id: `sub-${Date.now()}`, questionText: '', maxPoints: 10, dependentLessonIds: [] }])}"
)


ui_block = """
                          <div style={{ marginTop: '10px' }}>
                            <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: '#475569', marginBottom: '4px' }}>AI Grounding Dependencies (Lessons)</label>
                            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                              {(modules.find(m => m.id === targetModuleId)?.lessons || []).length === 0 && (
                                <span style={{ fontSize: '12px', color: '#94a3b8' }}>No lessons available in this module to ground on.</span>
                              )}
                              {(modules.find(m => m.id === targetModuleId)?.lessons || []).map((lesson: any) => {
                                const isChecked = (q.dependentLessonIds || []).includes(lesson.id);
                                return (
                                  <label key={lesson.id} style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '12px', padding: '4px 8px', background: isChecked ? '#e0e7ff' : '#f1f5f9', border: `1px solid ${isChecked ? '#818cf8' : '#cbd5e1'}`, borderRadius: '4px', cursor: 'pointer' }}>
                                    <input 
                                      type="checkbox" 
                                      checked={isChecked} 
                                      onChange={(e) => {
                                        const checked = e.target.checked;
                                        setSubjectiveQuestions(prev => prev.map((item, i) => {
                                          if (i !== idx) return item;
                                          const deps = new Set(item.dependentLessonIds || []);
                                          if (checked) deps.add(lesson.id);
                                          else deps.delete(lesson.id);
                                          return { ...item, dependentLessonIds: Array.from(deps) };
                                        }));
                                      }}
                                      style={{ cursor: 'pointer', margin: 0 }}
                                    />
                                    {lesson.title}
                                  </label>
                                );
                              })}
                            </div>
                          </div>
"""

target = """                            {subjectiveQuestions.length > 1 && (
                              <button type="button" onClick={() => setSubjectiveQuestions(prev => prev.filter((_, i) => i !== idx))} style={{ background: '#fee2e2', color: '#dc2626', border: 'none', borderRadius: '4px', padding: '4px 8px', cursor: 'pointer', fontSize: '11px' }}>🗑️</button>
                            )}
                          </div>"""

content = content.replace(target, target + ui_block)

with open(file_path, 'w', encoding='utf-8') as f:
    f.write(content)

print("Updated CurriculumManager.tsx")
