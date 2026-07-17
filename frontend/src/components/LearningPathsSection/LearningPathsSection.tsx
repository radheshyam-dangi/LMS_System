import React, { useState, useMemo, useEffect } from 'react';
import './LearningPaths.css';
import { learningPathService } from '../../services/learningPathService';
import type { RoleName, LearningPath, PathDifficulty, PathStatus } from '../../types/auth';

interface LearningPathsSectionProps {
  currentUser: {
    id: string;
    name: string;
    role: RoleName;
  };
  accessToken: string; 
  onNavigateToModules: (pathId: string, pathName: string) => void;
}

export function LearningPathsSection({ currentUser, accessToken, onNavigateToModules }: LearningPathsSectionProps) {
  const [paths, setPaths] = useState<LearningPath[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const [activeTabFilter, setActiveTabFilter] = useState<'All' | PathStatus>('All');
  const [searchQuery, setSearchQuery] = useState('');
  
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Form input field elements
  const [formName, setFormName] = useState('');
  const [formDifficulty, setFormDifficulty] = useState<PathDifficulty>('Intermediate');
  const [formDuration, setFormDuration] = useState('12 weeks');
  const [formDescription, setFormDescription] = useState('');
  const [formTags, setFormTags] = useState('');

  const canModifyOrCreate = currentUser.role === 'Admin' || currentUser.role === 'Trainer';
  const isTrainee = currentUser.role === 'Trainee';

  const loadDatabasePaths = async () => {
    setIsLoading(true);
    setErrorMessage(null);
    try {
      const data = await learningPathService.fetchAllPaths(accessToken);
      setPaths(data);
    } catch (err: any) {
      setErrorMessage(err.message ?? 'Failed to synchronize with backend database.');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadDatabasePaths();
  }, [accessToken]);

  // 🔥 NEW INTERACTION: Assign Trainee Action Handler
  const handleAssignTrainee = async (pathId: string) => {
    const traineeId = prompt('Enter the UUID of the Trainee you want to assign to this path:');
    if (!traineeId || !traineeId.trim()) return;

    try {
      const updatedPath = await learningPathService.assignTraineeToPath(pathId, traineeId.trim(), accessToken);
      
      // Update local state smoothly so the UI updates counters in real-time
      setPaths((prevPaths) => 
        prevPaths.map((p) => (p.id === pathId ? { ...p, assignedToTraineeIds: updatedPath.assignedToTraineeIds } : p))
      );
      alert('Trainee successfully assigned to this track!');
    } catch (err: any) {
      alert(err.message ?? 'Failed to complete assignment registration.');
    }
  };

  const filteredPaths = useMemo(() => {
    return paths.filter((path) => {
      if (isTrainee && !path.assignedToTraineeIds?.includes(currentUser.id)) return false;
      
      const matchesTab = activeTabFilter === 'All' || path.status === activeTabFilter;
      const pathDisplayName = path.title || path.name || '';
      
      let tagsArray: string[] = [];
      if (Array.isArray(path.skillsTags)) {
        tagsArray = path.skillsTags;
      } else if (typeof path.skillsTags === 'string') {
        tagsArray = (path.skillsTags as string).split(',').map(t => t.trim());
      }

      const matchesSearch = 
        pathDisplayName.toLowerCase().includes(searchQuery.toLowerCase()) ||
        tagsArray.some((tag: string) => tag.toLowerCase().includes(searchQuery.toLowerCase()));
        
      return matchesTab && matchesSearch;
    });
  }, [paths, activeTabFilter, searchQuery, isTrainee, currentUser.id]);

  const handleOpenModal = () => {
    if (!canModifyOrCreate) return;
    setFormName('');
    setFormDescription('');
    setFormTags('');
    setIsCreateModalOpen(true);
  };

  const handleCreatePathSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formName.trim() || isSubmitting) return;

    setIsSubmitting(true);
    setErrorMessage(null);

    const tagsArray = formTags.split(',')
      .map(t => t.trim())
      .filter(t => t.length > 0);

    try {
      const payload = {
        name: formName,
        description: formDescription,
        difficulty: formDifficulty,
        duration: formDuration,
        skillsTags: tagsArray.length > 0 ? tagsArray : ['General']
      };

      const savedDatabasePath = await learningPathService.createPath(payload, accessToken);
      setPaths((prev) => [savedDatabasePath, ...prev]);
      setIsCreateModalOpen(false);
    } catch (err: any) {
      alert(err.message ?? 'Database interaction error encountered.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="learning-paths-management-container">
      <header className="learning-paths-header-row">
        <div>
          <h1 className="learning-paths-main-title">Learning Paths</h1>
          <p className="learning-paths-sub-heading">
            {filteredPaths.length} engineering tracks — synchronized with live database metrics.
          </p>
        </div>
        {canModifyOrCreate && (
          <button type="button" className="btn-create-learning-path" onClick={handleOpenModal}>
            + New Learning Path
          </button>
        )}
      </header>

      <section className="learning-paths-control-strip">
        <div className="filter-tabs-cluster">
          {(['All', 'Active', 'Upcoming', 'Completed'] as const).map((tab) => (
            <button
              key={tab}
              type="button"
              className={`tab-pill-item ${((tab === 'All' && activeTabFilter === 'All') || activeTabFilter === tab) ? 'tab-pill-active' : ''}`}
              onClick={() => setActiveTabFilter(tab === 'All' ? 'All' : tab)}
            >
              {tab === 'All' ? 'All Paths' : tab}
            </button>
          ))}
        </div>
        <div className="search-filter-input-wrapper">
          <input
            type="text"
            className="paths-search-field"
            placeholder="Search paths or tags..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>
      </section>

      {isLoading ? (
        <div className="table-status-message">Fetching records from backend pipeline...</div>
      ) : errorMessage ? (
        <div className="table-status-message table-status-error">
          {errorMessage} <button type="button" onClick={loadDatabasePaths}>Retry Connection</button>
        </div>
      ) : (
        <section className="learning-paths-grid-layout">
          {filteredPaths.length === 0 ? (
            <div className="empty-paths-state-box">No learning tracks available.</div>
          ) : (
            filteredPaths.map((path) => {
              const currentTitle = path.title || path.name || 'Untitled Track';
              const currentDifficulty = path.difficulty || 'Intermediate';
              const currentStatus = path.status || 'Active';
              
              let currentTags: string[] = [];
              if (Array.isArray(path.skillsTags)) {
                currentTags = path.skillsTags;
              } else if (typeof path.skillsTags === 'string') {
                currentTags = (path.skillsTags as string).split(',').map(t => t.trim());
              }

              return (
                <div key={path.id} className="learning-path-card-item">
                  <div className="card-top-badges-row">
                    <div className="card-avatar-icon-box">🎒</div>
                    <div className="badge-meta-group">
                      <span className={`difficulty-badge diff-${currentDifficulty.toLowerCase()}`}>{currentDifficulty}</span>
                      <span className={`status-badge stat-${currentStatus.toLowerCase()}`}>{currentStatus}</span>
                    </div>
                  </div>
                  <h2 className="card-title-string">{currentTitle}</h2>
                  <p className="card-description-string">{path.description || 'No description provided.'}</p>
                  
                  <div className="card-tags-cloud-row">
                    {currentTags.map((tag: string, idx: number) => (
                      <span key={idx} className="skill-tag-pill-item">{tag}</span>
                    ))}
                  </div>
                  
                  <div className="card-counters-flex-strip">
                    <span>⏱️ {path.duration || '12 weeks'}</span>
                    <span>📦 {path.modules?.length || 0} modules</span>
                    <span>👥 Enrolled: {path.assignedToTraineeIds?.length || 0}</span>
                  </div>
                  
                  <div className="card-progress-tracking-block">
                    <div className="progress-labels-row">
                      <label>Overall progress</label>
                      <strong>{path.overallProgress || 0}%</strong>
                    </div>
                    <div className="progress-bar-track-line">
                      <div className="progress-bar-fill-indicator" style={{ width: `${path.overallProgress || 0}%` }} />
                    </div>
                  </div>

                  {/* 🔥 SYSTEM ACTIONS ROW CONTAINER */}
                  <div className="card-actions-row-cluster" style={{ display: 'flex', gap: '8px', marginTop: '12px' }}>
                    <button 
                      type="button" 
                      className="btn-card-action-continue" 
                      style={{ flex: 1 }}
                      onClick={() => onNavigateToModules(path.id, currentTitle)}
                    >
                      {isTrainee ? 'Continue Learning →' : 'Manage Curriculums →'}
                    </button>
                    
                    {/* Only Trainer or Admin can see the fast assignment feature actions */}
                    {canModifyOrCreate && (
                      <button 
                        type="button" 
                        className="btn-card-action-assign"
                        style={{ padding: '0 12px', background: '#e2e8f0', border: 'none', borderRadius: '6px', cursor: 'pointer' }}
                        onClick={() => handleAssignTrainee(path.id)}
                        title="Assign Trainee to this Path"
                      >
                        👥 Assign
                      </button>
                    )}
                  </div>
                </div>
              );
            })
          )}
        </section>
      )}

      {/* CREATE MODAL LAYOUT */}
      {isCreateModalOpen && (
        <div className="modal-backdrop-blur-overlay" onClick={() => !isSubmitting && setIsCreateModalOpen(false)}>
          <div className="modal-popup-container" onClick={(e) => e.stopPropagation()}>
            <header className="modal-popup-header">
              <h2>Create Learning Path</h2>
              <button type="button" disabled={isSubmitting} className="modal-close-icon-btn" onClick={() => setIsCreateModalOpen(false)}>×</button>
            </header>
            <form onSubmit={handleCreatePathSubmit} className="invite-form-body">
              <p className="modal-subtext-meta-label">Define a new structured curriculum for engineering training.</p>
              
              <div className="invite-form-field">
                <label>Path Name *</label>
                <input type="text" required disabled={isSubmitting} className="invite-form-input" placeholder="e.g. Cloud Engineering Fundamentals" value={formName} onChange={(e) => setFormName(e.target.value)} />
              </div>

              <div className="invite-form-row">
                <div className="invite-form-field flex-half">
                  <label>Difficulty</label>
                  <select disabled={isSubmitting} className="invite-form-input" value={formDifficulty} onChange={(e) => setFormDifficulty(e.target.value as PathDifficulty)}>
                    <option value="Beginner">Beginner</option>
                    <option value="Intermediate">Intermediate</option>
                    <option value="Advanced">Advanced</option>
                  </select>
                </div>
                <div className="invite-form-field flex-half">
                  <label>Duration</label>
                  <select disabled={isSubmitting} className="invite-form-input" value={formDuration} onChange={(e) => setFormDuration(e.target.value)}>
                    <option value="4 weeks">4 weeks</option>
                    <option value="8 weeks">8 weeks</option>
                    <option value="12 weeks">12 weeks</option>
                    <option value="16 weeks">16 weeks</option>
                  </select>
                </div>
              </div>

              <div className="invite-form-field">
                <label>Description</label>
                <textarea disabled={isSubmitting} className="invite-form-input textarea-field" rows={3} placeholder="Describe learning objectives..." value={formDescription} onChange={(e) => setFormDescription(e.target.value)} />
              </div>

              <div className="invite-form-field">
                <label>Skills / Tags</label>
                <input type="text" disabled={isSubmitting} className="invite-form-input" placeholder="e.g. React, TypeScript, APIs (comma separated)" value={formTags} onChange={(e) => setFormTags(e.target.value)} />
              </div>

              <footer className="modal-popup-footer">
                <button type="button" disabled={isSubmitting} className="modal-cancel-btn" onClick={() => setIsCreateModalOpen(false)}>Cancel</button>
                <button type="submit" disabled={isSubmitting} className="modal-confirm-btn">
                  {isSubmitting ? 'Writing to DB...' : 'Create Path'}
                </button>
              </footer>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}