import os
import re

file_path = 'e:/LMS_System/LMS_System/frontend/src/components/TiptapLPEditor/nodeViews.tsx'

with open(file_path, 'r', encoding='utf-8') as f:
    content = f.read()

# Replace the beginning of QuestionBlockView to add state and lesson pool logic
old_start = """export const QuestionBlockView = (props: any) => {
  const { node, updateAttributes, getPos, editor } = props;

  // Calculate index and parent assignment type
  let index = 1;
  let assignmentType = 'Mixed';
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
  }"""

new_start = """export const QuestionBlockView = (props: any) => {
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
  }"""

content = content.replace(old_start, new_start)

# Add the UI elements right before the delete button
old_buttons = """        <div className="points-input">
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
      </div>"""

new_buttons = """        <div className="points-input">
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
      </div>"""

content = content.replace(old_buttons, new_buttons)

with open(file_path, 'w', encoding='utf-8') as f:
    f.write(content)
