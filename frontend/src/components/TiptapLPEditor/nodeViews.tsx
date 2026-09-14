import React from 'react';
import { NodeViewWrapper, NodeViewContent } from '@tiptap/react';
import { Settings, Lock, Unlock, Play, FileText, LayoutList, ChevronDown, ChevronRight, Video, FileAudio, Link2, Trash2 } from 'lucide-react';

// ─────────────────────────────────────────────
// MODULE NODE VIEW
// ─────────────────────────────────────────────
export const ModuleNodeView = (props: any) => {
  const { node, updateAttributes, editor } = props;
  const isLocked = node.attrs.sequentialLessonLock;

  return (
    <NodeViewWrapper className="module-node-view">
      <div className="module-header" contentEditable={false}>
        <div className="module-title-controls">
          <div className="drag-handle" data-drag-handle>⠿</div>
          <span className="module-badge">MODULE</span>
        </div>
        <div className="module-actions">
          <button 
            className={`lock-toggle ${isLocked ? 'locked' : 'unlocked'}`}
            onClick={() => updateAttributes({ sequentialLessonLock: !isLocked })}
            title="Sequential Lesson Lock: Trainees must complete lessons in order"
          >
            {isLocked ? <Lock size={14} /> : <Unlock size={14} />}
            <span>{isLocked ? 'Linear' : 'Freeform'}</span>
          </button>
          <button 
            className="delete-node-btn"
            onClick={() => props.deleteNode()}
          >
            <Trash2 size={16} />
          </button>
        </div>
      </div>
      <div className="module-content">
        <NodeViewContent className="module-content-inner" />
      </div>
    </NodeViewWrapper>
  );
};

// ─────────────────────────────────────────────
// LESSON NODE VIEW
// ─────────────────────────────────────────────
export const LessonNodeView = (props: any) => {
  return (
    <NodeViewWrapper className="lesson-node-view">
      <div className="lesson-header" contentEditable={false}>
        <div className="lesson-title-controls">
          <div className="drag-handle" data-drag-handle>⠿</div>
          <Play size={16} className="lesson-icon" />
          <span className="lesson-badge">LESSON</span>
        </div>
        <div className="lesson-actions">
          <button className="delete-node-btn" onClick={() => props.deleteNode()}>
            <Trash2 size={16} />
          </button>
        </div>
      </div>
      <div className="lesson-content">
        <NodeViewContent className="lesson-content-inner" />
      </div>
    </NodeViewWrapper>
  );
};

// ─────────────────────────────────────────────
// ASSIGNMENT NODE VIEW
// ─────────────────────────────────────────────
export const AssignmentNodeView = (props: any) => {
  const { node, updateAttributes } = props;
  
  return (
    <NodeViewWrapper className="assignment-node-view">
      <div className="assignment-header" contentEditable={false}>
        <div className="assignment-title-controls">
          <div className="drag-handle" data-drag-handle>⠿</div>
          <FileText size={16} className="assignment-icon" />
          <span className="assignment-badge">ASSIGNMENT</span>
        </div>
        <div className="assignment-actions">
          <button className="delete-node-btn" onClick={() => props.deleteNode()}>
            <Trash2 size={16} />
          </button>
        </div>
      </div>
      
      <div className="assignment-settings" contentEditable={false}>
        <div className="setting-row">
          <label className="toggle-label">
            <input 
              type="checkbox" 
              checked={node.attrs.lockUntilLessonsComplete}
              onChange={(e) => updateAttributes({ lockUntilLessonsComplete: e.target.checked })}
            />
            <span className="slider"></span>
            Lock until prior lessons complete
          </label>
        </div>
        <div className="setting-row">
          <label className="toggle-label ai-glow">
            <input 
              type="checkbox" 
              checked={node.attrs.autoEvaluateWithAI}
              onChange={(e) => updateAttributes({ autoEvaluateWithAI: e.target.checked })}
            />
            <span className="slider"></span>
            Enable AI Evaluation
          </label>
        </div>
        {node.attrs.autoEvaluateWithAI && (
          <div className="setting-row sub-setting">
            <label className="toggle-label">
              <input 
                type="checkbox" 
                checked={node.attrs.humanInterventionRequired}
                onChange={(e) => updateAttributes({ humanInterventionRequired: e.target.checked })}
              />
              <span className="slider"></span>
              Require trainer review before releasing score
            </label>
          </div>
        )}
      </div>

      <div className="assignment-content">
        <NodeViewContent className="assignment-content-inner" />
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
          placeholder="Video URL (YouTube or direct mp4)" 
          value={node.attrs.url} 
          onChange={e => updateAttributes({ url: e.target.value })}
        />
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
          placeholder="Audio URL (mp3, wav)" 
          value={node.attrs.url} 
          onChange={e => updateAttributes({ url: e.target.value })}
        />
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
          placeholder="Resource Label (e.g. 'Reading Guide')" 
          value={node.attrs.label} 
          onChange={e => updateAttributes({ label: e.target.value })}
          className="label-input"
        />
        <input 
          type="text" 
          placeholder="URL (PDF or Webpage)" 
          value={node.attrs.url} 
          onChange={e => updateAttributes({ url: e.target.value })}
        />
      </div>
      <button className="delete-node-btn" onClick={() => props.deleteNode()}>×</button>
    </NodeViewWrapper>
  );
};

// ─────────────────────────────────────────────
// QUESTION BLOCK VIEW
// ─────────────────────────────────────────────
export const QuestionBlockView = (props: any) => {
  const { node, updateAttributes } = props;
  const isMCQ = node.attrs.questionType === 'MCQ';

  const addOption = () => {
    updateAttributes({ options: [...node.attrs.options, 'New Option'] });
  };

  const updateOption = (index: number, val: string) => {
    const newOptions = [...node.attrs.options];
    newOptions[index] = val;
    updateAttributes({ options: newOptions });
  };

  const removeOption = (index: number) => {
    const newOptions = node.attrs.options.filter((_: any, i: number) => i !== index);
    let newCorrect = node.attrs.correctIndex;
    if (newCorrect === index) newCorrect = null;
    else if (newCorrect > index) newCorrect -= 1;
    updateAttributes({ options: newOptions, correctIndex: newCorrect });
  };

  return (
    <NodeViewWrapper className="question-block-view">
      <div className="question-header">
        <span className="drag-handle" data-drag-handle>⠿</span>
        <select 
          value={node.attrs.questionType}
          onChange={e => updateAttributes({ questionType: e.target.value, options: e.target.value === 'MCQ' ? ['Option 1', 'Option 2'] : [] })}
        >
          <option value="Subjective">Subjective (Text Response)</option>
          <option value="MCQ">Multiple Choice</option>
        </select>
        <div className="points-input">
          <label>Points:</label>
          <input 
            type="number" 
            min="1" 
            value={node.attrs.maxPoints} 
            onChange={e => updateAttributes({ maxPoints: parseInt(e.target.value) || 1 })}
          />
        </div>
        <button className="delete-node-btn" onClick={() => props.deleteNode()}>
          <Trash2 size={16} />
        </button>
      </div>

      <div className="question-body">
        <textarea 
          placeholder="Question text..." 
          value={node.attrs.text}
          onChange={e => updateAttributes({ text: e.target.value })}
          className="question-textarea"
        />

        {isMCQ && (
          <div className="mcq-options">
            {node.attrs.options.map((opt: string, i: number) => (
              <div key={i} className="mcq-option-row">
                <input 
                  type="radio" 
                  name={`correct-${node.attrs.id}`} 
                  checked={node.attrs.correctIndex === i}
                  onChange={() => updateAttributes({ correctIndex: i })}
                  title="Mark as correct answer"
                />
                <input 
                  type="text" 
                  value={opt} 
                  onChange={e => updateOption(i, e.target.value)}
                  placeholder={`Option ${i + 1}`}
                />
                <button className="remove-opt-btn" onClick={() => removeOption(i)}>×</button>
              </div>
            ))}
            <button className="add-opt-btn" onClick={addOption}>+ Add Option</button>
          </div>
        )}
      </div>
    </NodeViewWrapper>
  );
};
