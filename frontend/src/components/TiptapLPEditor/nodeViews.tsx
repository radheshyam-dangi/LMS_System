import React from 'react';
import { NodeViewWrapper, NodeViewContent } from '@tiptap/react';
import { Settings, Lock, Unlock, Play, FileText, LayoutList, ChevronDown, ChevronRight, Video, FileAudio, Link2, Trash2 } from 'lucide-react';
import { v4 as uuidv4 } from 'uuid';

// ─────────────────────────────────────────────
// MODULE NODE VIEW
// ─────────────────────────────────────────────
const ModuleMetadataEditor = ({ node, updateAttributes }: any) => {
  const objectives = node.attrs.learningObjectives || [];
  const outcomes = node.attrs.learningOutcomes || [];
  const resources = node.attrs.moduleResources || [];

  return (
    <div className="module-metadata-editor" style={{ padding: '16px 24px', background: '#f8fafc', borderBottom: '1px solid #e2e8f0', display: 'flex', flexDirection: 'column', gap: '16px', fontSize: '13px' }}>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '24px' }}>
        <div>
          <label className="setting-label" style={{ fontWeight: 600, color: '#0f172a', marginBottom: '8px', display: 'block' }}>Learning Objectives ⚡</label>
          {objectives.map((obj: string, i: number) => (
            <div key={i} style={{ display: 'flex', gap: '8px', marginBottom: '8px' }}>
              <input className="styled-form-control" value={obj} placeholder="e.g. Understand React basics" onChange={e => {
                const newArr = [...objectives];
                newArr[i] = e.target.value;
                updateAttributes({ learningObjectives: newArr });
              }} />
              <button className="btn-icon" style={{ background: '#fee2e2', color: '#ef4444', border: 'none', borderRadius: '4px', padding: '0 8px', cursor: 'pointer' }} onClick={() => {
                const newArr = [...objectives];
                newArr.splice(i, 1);
                updateAttributes({ learningObjectives: newArr });
              }}><Trash2 size={14} /></button>
            </div>
          ))}
          <button className="btn-secondary" style={{ padding: '4px 12px', fontSize: '12px', marginTop: '4px' }} onClick={() => updateAttributes({ learningObjectives: [...objectives, ''] })}>+ Add Objective</button>
        </div>

        <div>
          <label className="setting-label" style={{ fontWeight: 600, color: '#0f172a', marginBottom: '8px', display: 'block' }}>Learning Outcomes ✅</label>
          {outcomes.map((out: string, i: number) => (
            <div key={i} style={{ display: 'flex', gap: '8px', marginBottom: '8px' }}>
              <input className="styled-form-control" value={out} placeholder="e.g. Build a complete app" onChange={e => {
                const newArr = [...outcomes];
                newArr[i] = e.target.value;
                updateAttributes({ learningOutcomes: newArr });
              }} />
              <button className="btn-icon" style={{ background: '#fee2e2', color: '#ef4444', border: 'none', borderRadius: '4px', padding: '0 8px', cursor: 'pointer' }} onClick={() => {
                const newArr = [...outcomes];
                newArr.splice(i, 1);
                updateAttributes({ learningOutcomes: newArr });
              }}><Trash2 size={14} /></button>
            </div>
          ))}
          <button className="btn-secondary" style={{ padding: '4px 12px', fontSize: '12px', marginTop: '4px' }} onClick={() => updateAttributes({ learningOutcomes: [...outcomes, ''] })}>+ Add Outcome</button>
        </div>
      </div>

      <div style={{ borderTop: '1px solid #e2e8f0', paddingTop: '16px' }}>
        <label className="setting-label" style={{ fontWeight: 600, color: '#0f172a', marginBottom: '8px', display: 'block' }}>Module Resources 📚</label>
        {resources.map((res: any, i: number) => (
          <div key={i} style={{ display: 'flex', gap: '8px', marginBottom: '8px' }}>
            <input className="styled-form-control" value={res.label} placeholder="Resource Name (e.g. Official Docs)" style={{ flex: 1 }} onChange={e => {
              const newArr = [...resources];
              newArr[i] = { ...newArr[i], label: e.target.value };
              updateAttributes({ moduleResources: newArr });
            }} />
            <input className="styled-form-control" value={res.url} placeholder="https://..." style={{ flex: 2 }} onChange={e => {
              const newArr = [...resources];
              newArr[i] = { ...newArr[i], url: e.target.value };
              updateAttributes({ moduleResources: newArr });
            }} />
            <select className="styled-form-control" style={{ width: '100px' }} value={res.type || 'Link'} onChange={e => {
              const newArr = [...resources];
              newArr[i] = { ...newArr[i], type: e.target.value };
              updateAttributes({ moduleResources: newArr });
            }}>
              <option value="Link">Link</option>
              <option value="PDF">PDF</option>
              <option value="Video">Video</option>
            </select>
            <button className="btn-icon" style={{ background: '#fee2e2', color: '#ef4444', border: 'none', borderRadius: '4px', padding: '0 8px', cursor: 'pointer' }} onClick={() => {
              const newArr = [...resources];
              newArr.splice(i, 1);
              updateAttributes({ moduleResources: newArr });
            }}><Trash2 size={14} /></button>
          </div>
        ))}
        <button className="btn-secondary" style={{ padding: '4px 12px', fontSize: '12px', marginTop: '4px' }} onClick={() => updateAttributes({ moduleResources: [...resources, { label: '', url: '', type: 'Link' }] })}>+ Add Resource</button>
      </div>
    </div>
  );
};

export const ModuleNodeView = (props: any) => {
  const { node, updateAttributes, editor, getPos, deleteNode } = props;
  const isLocked = node.attrs.sequentialLessonLock;
  const [isCollapsed, setIsCollapsed] = React.useState(false);
  const [showSettings, setShowSettings] = React.useState(false);
  const [index, setIndex] = React.useState(1);
  const [hasStructuralChildren, setHasStructuralChildren] = React.useState(false);

  React.useEffect(() => {
    const updateIndex = () => {
      let count = 1;
      let found = false;
      editor.state.doc.descendants((n: any) => {
        if (found) return false;
        if (n.type.name === 'module') {
          if (n === node) {
            found = true;
          } else {
            count++;
          }
        }
      });
      setIndex(count);
    };
    updateIndex();
    editor.on('transaction', updateIndex);
    return () => editor.off('transaction', updateIndex);
  }, [editor, node]);

  React.useEffect(() => {
    const updateChildren = () => {
      let hasAny = false;
      node.descendants((n: any) => {
        if (n.type.name === 'lesson' || n.type.name === 'assignment') {
          hasAny = true;
          return false;
        }
      });
      setHasStructuralChildren(hasAny);
    };
    updateChildren();
    editor.on('transaction', updateChildren);
    return () => editor.off('transaction', updateChildren);
  }, [editor, node]);

  const handleDelete = () => {
    if (node.content && node.content.size > 0) {
      if (!window.confirm('Delete this Module and all its lessons/assignments?')) return;
    }
    deleteNode();
  };

  return (
    <NodeViewWrapper className="module-node-view">
      <div className="module-header" contentEditable={false}>
        <div className="module-title-controls">
          <div className="drag-handle" data-drag-handle>⠿</div>
          <button className="chevron-toggle" onClick={() => setIsCollapsed(!isCollapsed)}>
            {isCollapsed ? <ChevronRight size={16} /> : <ChevronDown size={16} />}
          </button>
          <span className="module-badge">MODULE {index}</span>
        </div>
        <div className="module-actions">
          <button 
            className="lock-toggle" 
            style={{ background: showSettings ? '#e2e8f0' : 'transparent', border: 'none', cursor: 'pointer', padding: '4px 8px', borderRadius: '4px', display: 'flex', alignItems: 'center', gap: '4px' }}
            onClick={() => setShowSettings(!showSettings)}
            title="Module Settings"
          >
            <Settings size={14} />
            <span>Settings</span>
          </button>
          <button 
            className={`lock-toggle ${isLocked ? 'locked' : 'unlocked'}`}
            onClick={() => updateAttributes({ sequentialLessonLock: !isLocked })}
            title="Sequential Lesson Lock: Trainees must complete lessons in order"
          >
            {isLocked ? <Lock size={14} /> : <Unlock size={14} />}
            <span>{isLocked ? 'Linear' : 'Freeform'}</span>
          </button>
          <button className="delete-node-btn" onClick={handleDelete} title="Delete Module">
            <Trash2 size={16} />
          </button>
        </div>
      </div>
      <div className={`module-content ${isCollapsed ? 'collapsed-body' : ''}`}>
        {showSettings && <ModuleMetadataEditor node={node} updateAttributes={updateAttributes} />}
        <NodeViewContent className="module-content-inner" />
        {!hasStructuralChildren && (
          <div className="ghost-btn-row" contentEditable={false}>
            <button className="ghost-add-btn" onClick={() => {
              if (typeof getPos === 'function') {
                const pos = getPos() + node.nodeSize - 1;
                editor.commands.insertContentAt(pos, { type: 'lesson', attrs: { id: uuidv4() }, content: [{ type: 'heading', attrs: { level: 2 }, content: [{ type: 'text', text: 'New Lesson' }] }, { type: 'paragraph', content: [{ type: 'text', text: 'Lesson content...' }] }] });
              }
            }}>+ Add Lesson</button>
            <button className="ghost-add-btn" onClick={() => {
              if (typeof getPos === 'function') {
                const pos = getPos() + node.nodeSize - 1;
                editor.commands.insertContentAt(pos, { 
                  type: 'assignment', 
                  attrs: { id: uuidv4() }, 
                  content: [
                    { type: 'heading', attrs: { level: 2 }, content: [{ type: 'text', text: 'New Assignment' }] }, 
                    { type: 'paragraph', content: [{ type: 'text', text: 'Assignment instructions...' }] },
                    { type: 'questionBlock', attrs: { id: uuidv4(), questionType: 'Subjective', maxPoints: 10, correctIndex: null }, content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Type your question here...' }] }] }
                  ] 
                });
              }
            }}>+ Add Assignment</button>
          </div>
        )}
      </div>
    </NodeViewWrapper>
  );
};

// ─────────────────────────────────────────────
// LESSON NODE VIEW
// ─────────────────────────────────────────────
export const LessonNodeView = (props: any) => {
  const { node, editor, getPos, deleteNode } = props;
  const [isCollapsed, setIsCollapsed] = React.useState(false);
  const [counts, setCounts] = React.useState({ video: 0, audio: 0, resource: 0, question: 0 });
  const [index, setIndex] = React.useState(1);

  React.useEffect(() => {
    const updateIndex = () => {
      if (typeof getPos !== 'function') return;
      try {
        const pos = getPos();
        const $pos = editor.state.doc.resolve(pos);
        const parent = $pos.node($pos.depth);
        if (parent.type.name !== 'module') return;
        
        let count = 1;
        let found = false;
        parent.descendants((n: any) => {
          if (found) return false;
          if (n === node) {
            found = true;
            return false;
          }
          if (n.type.name === 'lesson') count++;
        });
        setIndex(count);
      } catch (e) {}
    };
    
    updateIndex();
    editor.on('transaction', updateIndex);
    return () => editor.off('transaction', updateIndex);
  }, [editor, getPos, node]);

  React.useEffect(() => {
    const updateCounts = () => {
      let v = 0, a = 0, r = 0, q = 0;
      node.descendants((n: any) => {
        if (n.type.name === 'videoBlock') v++;
        if (n.type.name === 'audioBlock') a++;
        if (n.type.name === 'resourceBlock') r++;
        if (n.type.name === 'questionBlock') q++;
      });
      setCounts({ video: v, audio: a, resource: r, question: q });
    };
    updateCounts();
    editor.on('transaction', updateCounts);
    return () => editor.off('transaction', updateCounts);
  }, [editor, node]);

  const handleDelete = () => {
    let hasDependentAssignment = false;
    if (typeof getPos === 'function') {
      try {
        const pos = getPos();
        const $pos = editor.state.doc.resolve(pos);
        const parent = $pos.node($pos.depth);
        let passedSelf = false;
        parent.descendants((childNode: any) => {
          if (childNode === node) {
            passedSelf = true;
            return false;
          }
          if (passedSelf && childNode.type.name === 'assignment') {
            hasDependentAssignment = true;
          }
        });
      } catch(e) {}
    }
    
    if (hasDependentAssignment) {
      if (!window.confirm('This lesson is a dependency for an Assignment in this module. Confirm deletion?')) return;
    } else if (node.content && node.content.size > 0) {
      if (!window.confirm('Delete this Lesson and all its content?')) return;
    }
    deleteNode();
  };

  return (
    <NodeViewWrapper className="lesson-node-view">
      <div className="lesson-header" contentEditable={false}>
        <div className="lesson-title-controls">
          <div className="drag-handle" data-drag-handle>⠿</div>
          <button className="chevron-toggle" onClick={() => setIsCollapsed(!isCollapsed)}>
            {isCollapsed ? <ChevronRight size={16} /> : <ChevronDown size={16} />}
          </button>
          <Play size={16} className="lesson-icon" />
          <span className="lesson-badge">LESSON {index}</span>
          <div className="lesson-chips">
            {counts.video > 0 && <span className="lesson-chip">🎥 {counts.video}</span>}
            {counts.audio > 0 && <span className="lesson-chip">🎵 {counts.audio}</span>}
            {counts.resource > 0 && <span className="lesson-chip">📎 {counts.resource}</span>}
            {counts.question > 0 && <span className="lesson-chip">❓ {counts.question}</span>}
          </div>
        </div>
        <div className="lesson-actions">
          <button className="delete-node-btn" onClick={handleDelete}>
            <Trash2 size={16} />
          </button>
        </div>
      </div>
      <div className={`lesson-content ${isCollapsed ? 'collapsed-body' : ''}`}>
        <NodeViewContent className="lesson-content-inner" />
        <div className="ghost-btn-row" contentEditable={false}>
          <button className="ghost-add-btn" onClick={() => {
            if (typeof getPos === 'function') {
               const pos = getPos() + node.nodeSize - 1;
               editor.commands.insertContentAt(pos, { type: 'videoBlock' });
            }
          }}>+ Video</button>
          <button className="ghost-add-btn" onClick={() => {
            if (typeof getPos === 'function') {
               const pos = getPos() + node.nodeSize - 1;
               editor.commands.insertContentAt(pos, { type: 'resourceBlock' });
            }
          }}>+ Resource</button>
        </div>
      </div>
      
      {/* Sibling insertion row */}
      <div className="sibling-btn-row" contentEditable={false}>
        <button className="sibling-add-btn" onClick={() => {
          if (typeof getPos === 'function') {
            const pos = getPos() + node.nodeSize;
            editor.commands.insertContentAt(pos, { type: 'lesson', attrs: { id: uuidv4() }, content: [{ type: 'heading', attrs: { level: 2 }, content: [{ type: 'text', text: 'New Lesson' }] }, { type: 'paragraph', content: [{ type: 'text', text: 'Lesson content...' }] }] });
          }
        }}>+ Add Lesson</button>
        <button className="sibling-add-btn" onClick={() => {
          if (typeof getPos === 'function') {
            const pos = getPos() + node.nodeSize;
            editor.commands.insertContentAt(pos, { 
              type: 'assignment', 
              attrs: { id: uuidv4() }, 
              content: [
                { type: 'heading', attrs: { level: 2 }, content: [{ type: 'text', text: 'New Assignment' }] }, 
                { type: 'paragraph', content: [{ type: 'text', text: 'Assignment instructions...' }] },
                { type: 'questionBlock', attrs: { id: uuidv4(), questionType: 'Subjective', maxPoints: 10, correctIndex: null }, content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Type your question here...' }] }] }
              ] 
            });
          }
        }}>+ Add Assignment</button>
      </div>
    </NodeViewWrapper>
  );
};

// ─────────────────────────────────────────────
// ASSIGNMENT NODE VIEW
// ─────────────────────────────────────────────
export const AssignmentNodeView = (props: any) => {
  const { node, updateAttributes, editor, getPos, deleteNode } = props;
  const [isCollapsed, setIsCollapsed] = React.useState(false);
  const [isSettingsExpanded, setIsSettingsExpanded] = React.useState(window.innerWidth > 768);
  const [dependencyText, setDependencyText] = React.useState('');
  const [index, setIndex] = React.useState(1);

  React.useEffect(() => {
    if (isCollapsed) setIsSettingsExpanded(false);
  }, [isCollapsed]);

  React.useEffect(() => {
    const updateIndex = () => {
      if (typeof getPos !== 'function') return;
      try {
        const pos = getPos();
        const $pos = editor.state.doc.resolve(pos);
        const parent = $pos.node($pos.depth);
        if (parent.type.name !== 'module') return;
        
        let count = 1;
        let found = false;
        parent.descendants((n: any) => {
          if (found) return false;
          if (n === node) {
            found = true;
            return false;
          }
          if (n.type.name === 'assignment') count++;
        });
        setIndex(count);
      } catch (e) {}
    };
    
    updateIndex();
    editor.on('transaction', updateIndex);
    return () => editor.off('transaction', updateIndex);
  }, [editor, getPos, node]);

  const [showDependencyDropdown, setShowDependencyDropdown] = React.useState(false);
  const dropdownRef = React.useRef<HTMLDivElement>(null);
  const [precedingLessons, setPrecedingLessons] = React.useState<{ id: string, title: string }[]>([]);

  React.useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setShowDependencyDropdown(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  React.useEffect(() => {
    const updateDependencies = () => {
      if (typeof getPos !== 'function') return;
      try {
        const pos = getPos();
        const $pos = editor.state.doc.resolve(pos);
        const parent = $pos.node($pos.depth);
        if (parent.type.name !== 'module') return;
        
        let lessons: { id: string, title: string }[] = [];
        let foundSelf = false;
        
        parent.descendants((childNode: any) => {
          if (foundSelf) return false;
          if (childNode === node) {
            foundSelf = true;
            return false;
          }
          if (childNode.type.name === 'lesson') {
            let title = 'Untitled Lesson';
            if (childNode.content && childNode.content.childCount > 0) {
              const firstChild = childNode.content.child(0);
              if (firstChild.type.name === 'heading') {
                title = firstChild.textContent || 'Untitled Lesson';
              }
            }
            lessons.push({ id: childNode.attrs.id, title });
            return false;
          }
        });
        
        setPrecedingLessons(lessons);

        // Compute text based on explicit dependsOnLessonIds or all preceding
        const selectedIds = node.attrs.dependsOnLessonIds;
        
        if (lessons.length === 0) {
          setDependencyText('No lesson dependency — unlocked immediately');
        } else if (selectedIds === null) {
          setDependencyText(`Depends on: All preceding lessons (${lessons.length})`);
        } else if (selectedIds.length === 0) {
          setDependencyText('Depends on: None');
        } else {
          const selectedTitles = selectedIds.map((id: string) => lessons.find(l => l.id === id)?.title).filter(Boolean);
          setDependencyText(`Depends on: ${selectedTitles.length} lesson(s)`);
        }
      } catch (e) {}
    };
    
    updateDependencies();
    editor.on('transaction', updateDependencies);
    return () => editor.off('transaction', updateDependencies);
  }, [editor, getPos, node]);

  // Check for subjective questions reactively
  let hasSubjectiveQuestions = false;
  if (node.content) {
    node.content.forEach((childNode: any) => {
      if (childNode.type.name === 'questionBlock' && childNode.attrs.questionType === 'Subjective') {
        hasSubjectiveQuestions = true;
      }
    });
  }

  const handleDelete = () => {
    if (node.content && node.content.size > 0) {
      if (!window.confirm('Delete this Assignment and all its questions?')) return;
    }
    deleteNode();
  };

  return (
    <NodeViewWrapper className="assignment-node-view">
      <div className="assignment-header" contentEditable={false}>
        <div className="assignment-title-controls">
          <div className="drag-handle" data-drag-handle>⠿</div>
          <button className="chevron-toggle" onClick={() => setIsCollapsed(!isCollapsed)}>
            {isCollapsed ? <ChevronRight size={16} /> : <ChevronDown size={16} />}
          </button>
          <FileText size={16} className="assignment-icon" />
          <span className="assignment-badge">ASSIGNMENT {index}</span>
          {dependencyText && (
            <div style={{ position: 'relative' }} ref={dropdownRef}>
              <button 
                className="live-dependency-label" 
                title={dependencyText}
                onClick={() => setShowDependencyDropdown(!showDependencyDropdown)}
                style={{ cursor: 'pointer', background: 'transparent', border: 'none', padding: 0, outline: 'none' }}
              >
                {dependencyText}
                <ChevronDown size={12} style={{ marginLeft: 4 }} />
              </button>
              
              {showDependencyDropdown && precedingLessons.length > 0 && (
                <div style={{
                  position: 'absolute',
                  top: '100%',
                  left: 0,
                  marginTop: '4px',
                  background: '#fff',
                  border: '1px solid #e2e8f0',
                  borderRadius: '8px',
                  boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06)',
                  zIndex: 50,
                  minWidth: '200px',
                  maxHeight: '200px',
                  overflowY: 'auto',
                  padding: '8px 0'
                }}>
                  <div style={{ padding: '0 12px 8px', borderBottom: '1px solid #f1f5f9', marginBottom: '4px', display: 'flex', justifyContent: 'space-between' }}>
                    <span style={{ fontSize: '11px', fontWeight: 600, color: '#64748b', textTransform: 'uppercase' }}>Select Dependencies</span>
                    <button 
                      onClick={() => updateAttributes({ dependsOnLessonIds: null })}
                      style={{ fontSize: '11px', color: '#4f46e5', background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}
                    >
                      Reset Default
                    </button>
                  </div>
                  {precedingLessons.map(lesson => {
                    const selectedIds = node.attrs.dependsOnLessonIds;
                    // If null, all are selected by default
                    const isSelected = selectedIds === null || selectedIds.includes(lesson.id);
                    
                    return (
                      <label key={lesson.id} style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '8px',
                        padding: '6px 12px',
                        cursor: 'pointer',
                        fontSize: '13px',
                        color: '#334155'
                      }}>
                        <input 
                          type="checkbox"
                          checked={isSelected}
                          onChange={(e) => {
                            if (e.target.checked) {
                              // If they check it
                              if (selectedIds === null) {
                                // Default was true anyway, so no op? Wait, if they just check one while null, all were checked. 
                                // Actually, if null and they check, it's a no op because it's already selected.
                                // It only matters if they UNCHECK.
                              } else {
                                updateAttributes({ dependsOnLessonIds: [...selectedIds, lesson.id] });
                              }
                            } else {
                              // If they uncheck it
                              if (selectedIds === null) {
                                // Transition from "all" to explicit array without this id
                                updateAttributes({ dependsOnLessonIds: precedingLessons.map(l => l.id).filter(id => id !== lesson.id) });
                              } else {
                                updateAttributes({ dependsOnLessonIds: selectedIds.filter((id: string) => id !== lesson.id) });
                              }
                            }
                          }}
                          style={{ margin: 0 }}
                        />
                        <span style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{lesson.title}</span>
                      </label>
                    );
                  })}
                </div>
              )}
            </div>
          )}
        </div>
        <div className="assignment-actions">
          <button 
            className={`lock-toggle ${node.attrs.lockUntilLessonsComplete ? 'locked' : 'unlocked'}`}
            onClick={() => updateAttributes({ lockUntilLessonsComplete: !node.attrs.lockUntilLessonsComplete })}
            title="Lock until lessons complete"
          >
            {node.attrs.lockUntilLessonsComplete ? <Lock size={14} /> : <Unlock size={14} />}
            <span>{node.attrs.lockUntilLessonsComplete ? 'Locked' : 'Unlocked'}</span>
          </button>
          
          {hasSubjectiveQuestions && (
            <>
              <button 
                className={`lock-toggle ${node.attrs.autoEvaluateWithAI ? 'locked' : 'unlocked'}`}
                onClick={() => updateAttributes({ autoEvaluateWithAI: !node.attrs.autoEvaluateWithAI })}
                title="Applies to subjective questions only. Multiple-choice questions are always graded automatically based on the correct answer(s) you selected."
              >
                <span>{node.attrs.autoEvaluateWithAI ? 'AI Eval ON' : 'AI Eval OFF'}</span>
              </button>
              
              {node.attrs.autoEvaluateWithAI && (
                <button 
                  className={`lock-toggle ${node.attrs.humanInterventionRequired ? 'locked' : 'unlocked'}`}
                  onClick={() => updateAttributes({ humanInterventionRequired: !node.attrs.humanInterventionRequired })}
                  title="Human Intervention Required"
                >
                  <span>{node.attrs.humanInterventionRequired ? 'Human Review' : 'Auto-Release'}</span>
                </button>
              )}
            </>
          )}

          <button 
            className={`lock-toggle ${isSettingsExpanded ? 'locked' : 'unlocked'}`}
            onClick={() => { setIsSettingsExpanded(!isSettingsExpanded); setIsCollapsed(false); }}
            style={{ borderStyle: 'dashed' }}
          >
            <Settings size={14} />
            <span>Settings</span>
          </button>

          <button className="delete-node-btn" onClick={handleDelete}>
            <Trash2 size={16} />
          </button>
        </div>
      </div>
      
      {!isCollapsed && isSettingsExpanded && (
        <div className="assignment-settings" contentEditable={false}>
          <div className="setting-row">
            <label>Assignment Type:</label>
            <select
              value={node.attrs.assignmentType || 'Mixed'}
              onChange={(e) => {
                const newType = e.target.value;
                updateAttributes({ assignmentType: newType });
                
                // If it's not Mixed, force all existing child questions to this type
                if (newType !== 'Mixed') {
                  const tr = editor.state.tr;
                  let pos = getPos();
                  if (typeof pos === 'number') {
                    const assignmentNode = editor.state.doc.nodeAt(pos);
                    if (assignmentNode) {
                      assignmentNode.descendants((child: any, childPos: number) => {
                        if (child.type.name === 'questionBlock') {
                          tr.setNodeMarkup(pos + 1 + childPos, null, { ...child.attrs, questionType: newType });
                        }
                      });
                      editor.view.dispatch(tr);
                    }
                  }
                }
              }}
              className="countdown-select"
            >
              <option value="Mixed">Mixed Questions</option>
              <option value="Subjective">All Subjective</option>
              <option value="MCQ">All Multiple Choice</option>
            </select>
          </div>
          <div className="setting-row">
            <label>Deadline Starts From:</label>
            <select
              value={node.attrs.countdownStart || 'onAssignment'}
              onChange={e => updateAttributes({ countdownStart: e.target.value })}
              className="countdown-select"
            >
              <option value="onAssignment">LP Assigned</option>
              <option value="taskUnlocked">Task Unlocked</option>
            </select>
          </div>
          <div className="setting-row duration-input-group">
            <label>Assignment Duration:</label>
            <div className="duration-inputs">
              <input type="number" min={0} max={365} value={node.attrs.timerDuration?.days || 0}
                     onChange={e => updateAttributes({ timerDuration: { ...node.attrs.timerDuration, days: Math.max(0, Number(e.target.value)) } })} /> Days
              <input type="number" min={0} max={23} value={node.attrs.timerDuration?.hours || 0}
                     onChange={e => updateAttributes({ timerDuration: { ...node.attrs.timerDuration, hours: Math.max(0, Number(e.target.value)) } })} /> Hours
              <input type="number" min={0} max={59} value={node.attrs.timerDuration?.minutes || 0}
                     onChange={e => updateAttributes({ timerDuration: { ...node.attrs.timerDuration, minutes: Math.max(0, Number(e.target.value)) } })} /> Minutes
            </div>
          </div>
        </div>
      )}

      <div className={`assignment-content ${isCollapsed ? 'collapsed-body' : ''}`}>
        <NodeViewContent className="assignment-content-inner" />
        <div className="ghost-btn-row" contentEditable={false}>
          <button className="ghost-add-btn" onClick={() => {
            if (typeof getPos === 'function') {
              const pos = getPos() + node.nodeSize - 1;
              const childType = (node.attrs.assignmentType && node.attrs.assignmentType !== 'Mixed') 
                ? node.attrs.assignmentType 
                : 'Subjective';
              editor.commands.insertContentAt(pos, { type: 'questionBlock', attrs: { id: uuidv4(), questionType: childType, maxPoints: 10, correctIndex: 0, options: ['', '', '', ''] }, content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Type your question here...' }] }] });
            }
          }}>+ Question</button>
        </div>
      </div>

      {/* Sibling insertion row */}
      <div className="sibling-btn-row" contentEditable={false}>
        <button className="sibling-add-btn" onClick={() => {
          if (typeof getPos === 'function') {
            const pos = getPos() + node.nodeSize;
            editor.commands.insertContentAt(pos, { type: 'lesson', attrs: { id: uuidv4() }, content: [{ type: 'heading', attrs: { level: 2 }, content: [{ type: 'text', text: 'New Lesson' }] }, { type: 'paragraph', content: [{ type: 'text', text: 'Lesson content...' }] }] });
          }
        }}>+ Add Lesson</button>
        <button className="sibling-add-btn" onClick={() => {
          if (typeof getPos === 'function') {
            const pos = getPos() + node.nodeSize;
            editor.commands.insertContentAt(pos, { 
              type: 'assignment', 
              attrs: { id: uuidv4() }, 
              content: [
                { type: 'heading', attrs: { level: 2 }, content: [{ type: 'text', text: 'New Assignment' }] }, 
                { type: 'paragraph', content: [{ type: 'text', text: 'Assignment instructions...' }] },
                { type: 'questionBlock', attrs: { id: uuidv4(), questionType: 'Subjective', maxPoints: 10, correctIndex: null }, content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Type your question here...' }] }] }
              ] 
            });
          }
        }}>+ Add Assignment</button>
      </div>
    </NodeViewWrapper>
  );
};

// ─────────────────────────────────────────────
// MEDIA BLOCK VIEWS (Video, Audio, Resource)
// ─────────────────────────────────────────────
export const VideoBlockView = (props: any) => {
  const { node, updateAttributes } = props;
  return (
    <NodeViewWrapper className="media-block-view video-block">
      <div className="media-icon"><Video size={18} /></div>
      <div className="media-inputs">
        <input 
          type="text" 
          value={node.attrs.url || ''} 
          onChange={(e) => updateAttributes({ url: e.target.value })} 
          placeholder="Enter Video URL" 
          className="media-url-input"
        />
        {node.attrs.url && <a href={node.attrs.url} target="_blank" rel="noreferrer" className="media-preview-link">Preview</a>}
      </div>
      <button className="delete-node-btn" onClick={() => props.deleteNode()}>×</button>
    </NodeViewWrapper>
  );
};

export const AudioBlockView = (props: any) => {
  const { node, updateAttributes } = props;
  return (
    <NodeViewWrapper className="media-block-view audio-block">
      <div className="media-icon"><FileAudio size={18} /></div>
      <div className="media-inputs">
        <input 
          type="text" 
          value={node.attrs.url || ''} 
          onChange={(e) => updateAttributes({ url: e.target.value })} 
          placeholder="Enter Audio URL" 
          className="media-url-input"
        />
        {node.attrs.url && <a href={node.attrs.url} target="_blank" rel="noreferrer" className="media-preview-link">Preview</a>}
      </div>
      <button className="delete-node-btn" onClick={() => props.deleteNode()}>×</button>
    </NodeViewWrapper>
  );
};

export const ResourceBlockView = (props: any) => {
  const { node, updateAttributes } = props;
  return (
    <NodeViewWrapper className="media-block-view resource-block">
      <div className="media-icon"><Link2 size={18} /></div>
      <div className="media-inputs">
        <input 
          type="text" 
          value={node.attrs.label || ''} 
          onChange={(e) => updateAttributes({ label: e.target.value })} 
          placeholder="Resource Label (e.g., PDF Guide)" 
          className="media-label-input"
        />
        <input 
          type="text" 
          value={node.attrs.url || ''} 
          onChange={(e) => updateAttributes({ url: e.target.value })} 
          placeholder="Enter Resource URL" 
          className="media-url-input"
        />
        {node.attrs.url && <a href={node.attrs.url} target="_blank" rel="noreferrer" className="media-preview-link">Preview</a>}
      </div>
      <button className="delete-node-btn" onClick={() => props.deleteNode()}>×</button>
    </NodeViewWrapper>
  );
};

// ─────────────────────────────────────────────
// QUESTION BLOCK VIEW
// ─────────────────────────────────────────────
export const QuestionBlockView = (props: any) => {
  const { node, updateAttributes, getPos, editor } = props;
  const [showDependencyPicker, setShowDependencyPicker] = React.useState(false);
  const [lessonPool, setLessonPool] = React.useState<{id: string, title: string}[]>([]);

  // Calculate index and parent assignment type
  let index = 1;
  let assignmentType = 'Mixed';

  React.useEffect(() => {
    const updateContext = () => {
      if (typeof getPos !== 'function') return;
      try {
        const pos = getPos();
        const $pos = editor.state.doc.resolve(pos);
        const parent = $pos.node($pos.depth);
        
        if (parent && parent.type.name === 'assignment') {
          // Find index
          let count = 0;
          parent.descendants((child: any) => {
            if (child === node) return false;
            if (child.type.name === 'questionBlock') count++;
          });
          // Update lesson pool from module
          const moduleNode = $pos.node($pos.depth - 1);
          if (moduleNode && moduleNode.type.name === 'module') {
             let allLessons: {id: string, title: string}[] = [];
             let foundSelf = false;
             moduleNode.descendants((n: any) => {
               if (foundSelf) return false;
               if (n === parent) {
                 foundSelf = true;
                 return false;
               }
               if (n.type.name === 'lesson') {
                 let title = 'Untitled Lesson';
                 if (n.content && n.content.childCount > 0 && n.content.child(0).type.name === 'heading') {
                    title = n.content.child(0).textContent || 'Untitled Lesson';
                 }
                 allLessons.push({ id: n.attrs.id, title });
                 return false;
               }
             });
             
             // Filter by assignment pool
             const poolIds = parent.attrs.dependsOnLessonIds;
             if (poolIds === null) {
                setLessonPool(allLessons); // all preceding
             } else {
                setLessonPool(allLessons.filter(l => poolIds.includes(l.id)));
             }
          }
        }
      } catch (e) {}
    };
    updateContext();
    editor.on('transaction', updateContext);
    return () => editor.off('transaction', updateContext);
  }, [editor, getPos, node]);

  if (typeof getPos === 'function') {
    const pos = getPos();
    const $pos = editor.state.doc.resolve(pos);
    const parent = $pos.node($pos.depth);
    assignmentType = parent.attrs.assignmentType || 'Mixed';
    
    let count = 0;
    parent.descendants((child: any) => {
      if (child === node) {
        index = count + 1;
        return false;
      }
      if (child.type.name === 'questionBlock') count++;
    });
  }

  return (
    <NodeViewWrapper className="question-block-view">
      <div className="question-header" contentEditable={false}>
        <span className="drag-handle" data-drag-handle>⠿</span>
        <span className="question-index-badge">Question {index}</span>
        
        {assignmentType === 'Mixed' ? (
          <select 
            className="styled-form-control question-type-select"
            value={node.attrs.questionType}
            onChange={e => updateAttributes({ questionType: e.target.value })}
          >
            <option value="Subjective">Subjective (Text Response)</option>
            <option value="MCQ">Multiple Choice</option>
          </select>
        ) : (
          <span 
            className="styled-form-control question-type-select" 
            style={{ display: 'flex', alignItems: 'center', background: '#f8fafc', color: '#64748b', cursor: 'not-allowed', width: '220px' }}
          >
            {node.attrs.questionType === 'Subjective' ? 'Subjective (Text Response)' : 'Multiple Choice'}
          </span>
        )}
        
        <div className="points-input">
          <label className="setting-label" style={{ marginBottom: 0 }}>Points:</label>
          <input 
            type="number" 
            min="1" 
            value={node.attrs.maxPoints} 
            className="styled-form-control"
            style={{ width: '60px' }}
            onChange={e => updateAttributes({ maxPoints: parseInt(e.target.value) || 1 })}
          />
        </div>

        <button className="delete-node-btn" onClick={() => props.deleteNode()}>
          <Trash2 size={16} />
        </button>
      </div>
      
      <div className="question-grounding-settings" style={{ padding: '8px 16px', background: '#f8fafc', borderBottom: '1px solid #e2e8f0', display: 'flex', gap: '16px', alignItems: 'center' }} contentEditable={false}>
         <label style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '13px', color: '#475569', cursor: 'pointer' }}>
           <input 
             type="checkbox" 
             checked={node.attrs.requiresLessonGrounding !== false}
             onChange={e => updateAttributes({ requiresLessonGrounding: e.target.checked })}
           />
           Require AI Lesson Grounding
         </label>

         {node.attrs.requiresLessonGrounding !== false && (
           <div style={{ position: 'relative' }}>
             <button 
               className="styled-form-control"
               style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '12px', padding: '4px 8px', height: 'auto' }}
               onClick={() => setShowDependencyPicker(!showDependencyPicker)}
             >
               <FileText size={14} />
               {node.attrs.lessonDependencies?.length ? `${node.attrs.lessonDependencies.length} Lessons Selected` : 'Select Dependent Lessons'}
             </button>
             {showDependencyPicker && (
               <div style={{ position: 'absolute', top: '100%', left: 0, marginTop: '4px', background: '#fff', border: '1px solid #e2e8f0', borderRadius: '8px', boxShadow: '0 4px 6px -1px rgba(0,0,0,0.1)', zIndex: 100, minWidth: '220px', padding: '8px', maxHeight: '200px', overflowY: 'auto' }}>
                 <div style={{ fontSize: '11px', fontWeight: 600, color: '#64748b', marginBottom: '8px', textTransform: 'uppercase' }}>Assignment Lesson Pool</div>
                 {lessonPool.length === 0 ? (
                   <div style={{ fontSize: '12px', color: '#94a3b8' }}>No lessons available in assignment pool.</div>
                 ) : (
                   lessonPool.map(l => (
                     <label key={l.id} style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '4px 0', fontSize: '13px', cursor: 'pointer' }}>
                       <input 
                         type="checkbox" 
                         checked={(node.attrs.lessonDependencies || []).includes(l.id)}
                         onChange={(e) => {
                           const current = node.attrs.lessonDependencies || [];
                           if (e.target.checked) {
                             updateAttributes({ lessonDependencies: [...current, l.id] });
                           } else {
                             updateAttributes({ lessonDependencies: current.filter((id: string) => id !== l.id) });
                           }
                         }}
                       />
                       <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{l.title}</span>
                     </label>
                   ))
                 )}
               </div>
             )}
           </div>
         )}
         {node.attrs.requiresLessonGrounding !== false && (!node.attrs.lessonDependencies || node.attrs.lessonDependencies.length === 0) && (
           <span style={{ fontSize: '11px', color: '#ef4444', background: '#fee2e2', padding: '2px 6px', borderRadius: '4px' }}>
             Warning: Missing Dependency
           </span>
         )}
      </div>

      {node.attrs.questionType === 'Subjective' && (
        <div className="question-settings" contentEditable={false}>
          <label className="setting-label">Expected Answer Guideline / AI Rubric:</label>
          <textarea
            value={node.attrs.expectedAnswerGuideline || ''}
            onChange={e => updateAttributes({ expectedAnswerGuideline: e.target.value })}
            placeholder="Describe the key points the trainee must mention for full marks..."
            className="styled-form-control"
            style={{ width: '100%', minHeight: '60px', marginTop: '6px' }}
          />
        </div>
      )}

      <div className="question-body">
        <NodeViewContent className="question-content-inner" />
      </div>

      {node.attrs.questionType === 'MCQ' && (
        <div className="mcq-options-container" contentEditable={false}>
          <label className="setting-label" style={{ display: 'block', marginBottom: '8px', paddingLeft: '16px' }}>
            Options (Select the correct answer):
          </label>
          {(node.attrs.options || ['', '', '', '']).map((opt: string, idx: number) => (
            <div key={idx} className="mcq-option-row">
              <input 
                type="radio" 
                name={`correct-option-${node.attrs.id}`}
                checked={node.attrs.correctIndex === idx}
                onChange={() => updateAttributes({ correctIndex: idx })}
                className="mcq-radio"
              />
              <input 
                type="text" 
                value={opt}
                onChange={(e) => {
                  const newOpts = [...(node.attrs.options || ['', '', '', ''])];
                  newOpts[idx] = e.target.value;
                  updateAttributes({ options: newOpts });
                }}
                placeholder={`Option ${idx + 1}`}
                className="styled-form-control mcq-text-input"
              />
            </div>
          ))}
        </div>
      )}
    </NodeViewWrapper>
  );
};
