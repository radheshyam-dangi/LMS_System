import React, { useState } from 'react';
import { 
  Layers, Play, FileText, ChevronRight, ChevronDown, 
  Lock, Unlock, Plus, PanelLeftClose, PanelLeft, Video, Link2, CheckCircle2
} from 'lucide-react';
import type { CurriculumTreeData, CurriculumNodeItem } from './types';

interface LPSidebarTreeProps {
  treeData: CurriculumTreeData;
  activeNodeId: string | null;
  onSelectNode: (item: CurriculumNodeItem) => void;
  onAddModule: () => void;
  onAddLesson: (moduleId: string) => void;
  onAddAssignment: (moduleId: string) => void;
  collapsed: boolean;
  onToggleCollapse: () => void;
}

export const LPSidebarTree: React.FC<LPSidebarTreeProps> = ({
  treeData,
  activeNodeId,
  onSelectNode,
  onAddModule,
  onAddLesson,
  onAddAssignment,
  collapsed,
  onToggleCollapse,
}) => {
  // Keep track of collapsed modules in the sidebar tree
  const [collapsedModuleIds, setCollapsedModuleIds] = useState<Record<string, boolean>>({});

  const toggleModuleCollapse = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setCollapsedModuleIds(prev => ({ ...prev, [id]: !prev[id] }));
  };

  if (collapsed) {
    return (
      <aside className="lp-sidebar-collapsed" title="Curriculum Outline (Click to expand)">
        <button
          type="button"
          onClick={onToggleCollapse}
          className="lp-sidebar-toggle-btn collapsed"
          title="Expand Curriculum Outline"
          aria-label="Expand Curriculum Outline"
        >
          <PanelLeft size={18} />
        </button>

        <div className="lp-sidebar-collapsed-icons">
          {treeData.modules.map((mod, idx) => (
            <button
              key={mod.id || idx}
              type="button"
              className={`lp-sidebar-collapsed-node ${activeNodeId === mod.id ? 'active' : ''}`}
              onClick={() => onSelectNode(mod)}
              title={`Module ${idx + 1}: ${mod.title}`}
            >
              <span className="collapsed-mod-num">M{idx + 1}</span>
              {mod.sequentialModuleLock !== false && idx > 0 ? (
                <Lock size={10} className="collapsed-lock-icon" />
              ) : null}
            </button>
          ))}
        </div>

        <button
          type="button"
          className="lp-sidebar-collapsed-add-btn"
          onClick={onAddModule}
          title="Add New Module"
        >
          <Plus size={16} />
        </button>
      </aside>
    );
  }

  return (
    <aside className="lp-sidebar-tree">
      {/* Sidebar Header */}
      <div className="lp-sidebar-header">
        <div className="lp-sidebar-header-left">
          <div className="lp-sidebar-title-group">
            <span className="lp-sidebar-title">Curriculum Outline</span>
        
          </div>
        </div>

        <button
          type="button"
          onClick={onToggleCollapse}
          className="lp-sidebar-toggle-btn"
          title="Hide Hierarchy Outline"
          aria-label="Hide Hierarchy Outline"
        >
          <PanelLeftClose size={16} />
        </button>
      </div>

      {/* Stats Summary Bar */}
      <div className="lp-sidebar-stats-bar">
        <span className="lp-tree-stat-pill mod">
          {treeData.totalModules} Module{treeData.totalModules !== 1 ? 's' : ''}
        </span>
        <span className="lp-tree-stat-pill les">
          {treeData.totalLessons} Lesson{treeData.totalLessons !== 1 ? 's' : ''}
        </span>
        <span className="lp-tree-stat-pill task">
          {treeData.totalAssignments} Task{treeData.totalAssignments !== 1 ? 's' : ''}
        </span>
      </div>

      {/* Tree Content */}
      <div className="lp-sidebar-tree-content">
        {treeData.modules.length === 0 ? (
          <div className="lp-tree-empty-state">
            <p>No modules yet.</p>
            <button
              type="button"
              className="lp-tree-empty-add-btn"
              onClick={onAddModule}
            >
              + Create First Module
            </button>
          </div>
        ) : (
          treeData.modules.map((mod, modIdx) => {
            const isModOpen = !collapsedModuleIds[mod.id];
            const isModActive = activeNodeId === mod.id;
            const isModLocked = mod.sequentialModuleLock !== false && modIdx > 0;
            const children = mod.children || [];

            return (
              <div key={mod.id || modIdx} className="lp-tree-module-group">
                {/* Module Item Row */}
                <div
                  className={`lp-tree-item lp-tree-module-item ${isModActive ? 'active' : ''}`}
                  onClick={() => onSelectNode(mod)}
                >
                  <button
                    type="button"
                    className="lp-tree-chevron-btn"
                    onClick={(e) => toggleModuleCollapse(mod.id, e)}
                    title={isModOpen ? 'Collapse module' : 'Expand module'}
                  >
                    {isModOpen ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                  </button>

                  <span className="lp-tree-mod-badge">M{modIdx + 1}</span>

                  <span className="lp-tree-item-title" title={mod.title}>
                    {mod.title || `Module ${modIdx + 1}`}
                  </span>

                  {/* Lock Indicator */}
                  {modIdx === 0 ? (
                    <span className="lp-tree-lock-chip unlocked" title="Module 1 is always unlocked">
                      <Unlock size={11} /> Open
                    </span>
                  ) : isModLocked ? (
                    <span className="lp-tree-lock-chip locked" title="Locked until Module {modIdx} is 100% complete">
                      <Lock size={11} /> 100% Prev
                    </span>
                  ) : (
                    <span className="lp-tree-lock-chip unlocked" title="Module unlocked / open access">
                      <Unlock size={11} /> Open
                    </span>
                  )}

                  {/* Hover Quick Actions */}
                  <div className="lp-tree-hover-actions" onClick={(e) => e.stopPropagation()}>
                    <button
                      type="button"
                      className="lp-tree-action-btn"
                      onClick={() => onAddLesson(mod.id)}
                      title="Add Lesson to this module"
                    >
                      +L
                    </button>
                    <button
                      type="button"
                      className="lp-tree-action-btn"
                      onClick={() => onAddAssignment(mod.id)}
                      title="Add Task to this module"
                    >
                      +T
                    </button>
                  </div>
                </div>

                {/* Sub-items (Lessons & Assignments) */}
                {isModOpen && (
                  <div className="lp-tree-children-container">
                    {children.length === 0 ? (
                      <div className="lp-tree-empty-children">
                        <span>Empty module.</span>
                        <button
                          type="button"
                          className="lp-tree-mini-add-link"
                          onClick={() => onAddLesson(mod.id)}
                        >
                          + Add Lesson
                        </button>
                      </div>
                    ) : (
                      children.map((child, childIdx) => {
                        const isChildActive = activeNodeId === child.id;
                        const isLesson = child.type === 'lesson';

                        return (
                          <div
                            key={child.id || childIdx}
                            className={`lp-tree-item lp-tree-child-item ${isLesson ? 'lesson' : 'assignment'} ${isChildActive ? 'active' : ''}`}
                            onClick={() => onSelectNode(child)}
                          >
                            <span className="lp-tree-child-connector" />

                            <div className="lp-tree-child-icon">
                              {isLesson ? (
                                <Play size={12} className="lesson-icon" />
                              ) : (
                                <FileText size={12} className="assignment-icon" />
                              )}
                            </div>

                            <span className="lp-tree-child-index">
                              {isLesson ? `L${child.index}` : `T${child.index}`}
                            </span>

                            <span className="lp-tree-item-title" title={child.title}>
                              {child.title}
                            </span>

                            {/* Lock badge for child items */}
                            {isLesson ? (
                              mod.sequentialLessonLock && child.index > 1 ? (
                                <span className="lp-tree-child-lock sequential" title="Unlocks when previous lesson is watched">
                                  <Lock size={10} />
                                </span>
                              ) : (
                                <span className="lp-tree-child-lock open" title="Unlocked">
                                  <Unlock size={10} />
                                </span>
                              )
                            ) : (
                              child.lockUntilLessonsComplete ? (
                                <span className="lp-tree-child-lock sequential" title="Locked until preceding lessons are complete">
                                  <Lock size={10} />
                                </span>
                              ) : (
                                <span className="lp-tree-child-lock open" title="Unlocked">
                                  <Unlock size={10} />
                                </span>
                              )
                            )}

                            {/* Media counts */}
                            {child.stats && (
                              <div className="lp-tree-child-stats">
                                {(child.stats.videos || 0) > 0 && (
                                  <span title={`${child.stats.videos} video(s)`}>{child.stats.videos}v</span>
                                )}
                                {(child.stats.resources || 0) > 0 && (
                                  <span title={`${child.stats.resources} resource(s)`}>{child.stats.resources}r</span>
                                )}
                                {(child.stats.questions || 0) > 0 && (
                                  <span title={`${child.stats.questions} question(s)`}>{child.stats.questions}q</span>
                                )}
                              </div>
                            )}
                          </div>
                        );
                      })
                    )}
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>

      {/* Sidebar Footer */}
      <div className="lp-sidebar-footer">
        <button
          type="button"
          className="lp-sidebar-add-mod-btn"
          onClick={onAddModule}
        >
          <Plus size={15} /> Add Module Section
        </button>
      </div>
    </aside>
  );
};
