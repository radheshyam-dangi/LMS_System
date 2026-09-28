import React, { useState, useMemo, useEffect } from "react";
import { createPortal } from "react-dom";
import { useNavigate } from "react-router-dom";
import { PieChart, Pie, Cell, Tooltip as RechartsTooltip, ResponsiveContainer, Legend } from "recharts";
import "./LearningPaths.css";
import { learningPathService } from "../../services/learningPathService";
import { userService } from "../../services/userService";
import { progressService } from "../../services/lmsApi";
import { useNotifications } from "../../context/NotificationContext";
import { useScrollLock } from "../../hooks/useScrollLock";
import type {
  RoleName,
  LearningPath,
  PathDifficulty,
  PathStatus,
} from "../../types/auth";

interface LearningPathsSectionProps {
  currentUser: {
    id: string;
    name: string;
    role: RoleName;
  };
  accessToken: string;
  onNavigateToModules: (pathId: string, pathName: string, traineeId?: string) => void;
  onBackToAllPaths?: () => void;
}

interface TraineeUser {
  id: string;
  name?: string;
  firstName?: string;
  lastName?: string;
  email: string;
  roles?: any[];
  primaryRole?: any;
}

const DescriptionModal = ({ description, onClose }: { description: string; onClose: () => void }) => {
  useScrollLock(true);

  // Focus trap / escape key handling
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

  const modalContent = (
    <div className="modal-overlay" onClick={onClose} style={{ zIndex: 1000, position: 'fixed', inset: 0, background: 'rgba(15, 15, 20, 0.55)', backdropFilter: 'blur(6px)', WebkitBackdropFilter: 'blur(6px)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 'env(safe-area-inset-top) env(safe-area-inset-right) env(safe-area-inset-bottom) env(safe-area-inset-left)' }}>
      <div 
        className="modal-content" 
        onClick={(e) => e.stopPropagation()} 
        role="dialog" 
        aria-modal="true"
        aria-labelledby="desc-modal-title"
        style={{ zIndex: 1001, width: '90vw', maxWidth: '480px', maxHeight: '85vh', overflowY: 'auto', display: 'flex', flexDirection: 'column', background: '#fff', borderRadius: '16px', boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)' }}
      >
        <div style={{ padding: '24px', borderBottom: '1px solid #e2e8f0', display: 'flex', justifyContent: 'space-between', alignItems: 'center', position: 'sticky', top: 0, background: '#fff', zIndex: 10 }}>
          <h2 id="desc-modal-title" style={{ fontSize: '20px', fontWeight: 700, margin: 0, color: '#1e293b' }}>Full Description</h2>
          <button onClick={onClose} style={{ background: 'none', border: 'none', fontSize: '24px', cursor: 'pointer', color: '#64748b' }}>&times;</button>
        </div>
        <div style={{ padding: '24px', flex: 1 }}>
          <p style={{ margin: 0, whiteSpace: 'pre-wrap', color: '#334155', fontSize: '15px', lineHeight: 1.6, wordBreak: 'break-word', overflowWrap: 'break-word' }}>
            {description}
          </p>
        </div>
        <div style={{ padding: '16px 24px', borderTop: '1px solid #e2e8f0', display: 'flex', justifyContent: 'flex-end', position: 'sticky', bottom: 0, background: '#fff', zIndex: 10 }}>
          <button onClick={onClose} style={{ padding: '10px 20px', background: '#f1f5f9', color: '#475569', borderRadius: '8px', border: 'none', fontWeight: 600, cursor: 'pointer' }}>Close</button>
        </div>
      </div>
    </div>
  );

  return createPortal(modalContent, document.body);
};

const ExpandableDescription = ({ description }: { description: string }) => {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isOverflowing, setIsOverflowing] = useState(false);
  const textRef = React.useRef<HTMLParagraphElement>(null);
  const buttonRef = React.useRef<HTMLButtonElement>(null);

  const plainTextDescription = React.useMemo(() => {
    if (!description) return "";
    return description.replace(/<[^>]*>?/gm, '').replace(/&nbsp;/g, ' ').trim();
  }, [description]);

  useEffect(() => {
    const el = textRef.current;
    if (el) {
      if (el.scrollHeight > el.clientHeight) {
        setIsOverflowing(true);
      } else {
        setIsOverflowing(false);
      }
    }
  }, [plainTextDescription]);

  useEffect(() => {
    if (!isModalOpen && buttonRef.current) {
      // Focus return
      buttonRef.current.focus();
    }
  }, [isModalOpen]);

  if (!plainTextDescription) return null;

  return (
    <div className="expandable-description-container" onClick={(e) => e.stopPropagation()}>
      <p
        ref={textRef}
        className="card-description-string"
      >
        {plainTextDescription}
      </p>
      {isOverflowing && (
        <button 
          ref={buttonRef}
          className="expand-toggle-btn" 
          onClick={(e) => { e.stopPropagation(); setIsModalOpen(true); }}
          aria-haspopup="dialog"
        >
          Show more
        </button>
      )}
      
      {isModalOpen && (
        <DescriptionModal description={plainTextDescription} onClose={() => setIsModalOpen(false)} />
      )}
    </div>
  );
};


const highlightMatch = (text: string, highlight: string) => {
  if (!highlight.trim() || !text) {
    return <span>{text}</span>;
  }
  const regex = new RegExp(`(${highlight})`, 'gi');
  const parts = text.split(regex);
  return (
    <span>
      {parts.map((part, i) =>
        regex.test(part) ? (
          <mark key={i} style={{ padding: '0 2px', borderRadius: '2px', backgroundColor: 'rgba(79, 70, 229, 0.15)', color: '#4f46e5' }}>
            {part}
          </mark>
        ) : (
          <span key={i}>{part}</span>
        )
      )}
    </span>
  );
};

export function LearningPathsSection({
  currentUser,
  accessToken,
  onNavigateToModules,
}: LearningPathsSectionProps) {
  const navigate = useNavigate();
  const [paths, setPaths] = useState<LearningPath[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const [activeTabFilter, setActiveTabFilter] = useState<"All" | PathStatus>(
    "All",
  );
  const [searchQuery, setSearchQuery] = useState("");
  const [debouncedSearchQuery, setDebouncedSearchQuery] = useState("");

  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearchQuery(searchQuery);
    }, 300);
    return () => clearTimeout(timer);
  }, [searchQuery]);

  const [selectedPathForTrainees, setSelectedPathForTrainees] = useState<string | null>(null);
  const [lpTraineesProgress, setLpTraineesProgress] = useState<any>(null);
  const [isLoadingLpProgress, setIsLoadingLpProgress] = useState(false);
  const [expandedTraineeId, setExpandedTraineeId] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Assign Trainee Modal States
  const [isAssignModalOpen, setIsAssignModalOpen] = useState(false);
  const [selectedPath, setSelectedPath] = useState<LearningPath | null>(null);
  const [allTrainees, setAllTrainees] = useState<TraineeUser[]>([]);
  const [newlySelectedTraineeIds, setNewlySelectedTraineeIds] = useState<
    string[]
  >([]);
  const [traineeSearchQuery, setTraineeSearchQuery] = useState("");
  const [isLoadingTrainees, setIsLoadingTrainees] = useState(false);
  const [openDropdownPathId, setOpenDropdownPathId] = useState<string | null>(null);

  // Form Inputs
  const [formName, setFormName] = useState("");
  const [formDifficulty, setFormDifficulty] =
    useState<PathDifficulty>("Intermediate");
  const [formStatus, setFormStatus] = useState<PathStatus>("Active");
  const [formDuration, setFormDuration] = useState("12 weeks");
  const [formImageUrl, setFormImageUrl] = useState("");
  const [formDescription, setFormDescription] = useState("");
  const [formTags, setFormTags] = useState("");
  const [formDefaultLessonLocking, setFormDefaultLessonLocking] = useState<boolean>(false);
  const [formDefaultTaskLocking, setFormDefaultTaskLocking] = useState<boolean>(false);

  const isAdmin = currentUser.role === "Admin";
  const isTrainer = currentUser.role === "Trainer";
  const isTrainee = currentUser.role === "Trainee";
  const { refresh: refreshNotifications } = useNotifications();

  const [progressSummary, setProgressSummary] = useState<
    Record<
      string,
      {
        userProgressPercent: number;
        cohortProgressPercent: number;
        enrolledCount: number;
      }
    >
  >({});

  const loadDatabasePaths = async () => {
    setIsLoading(true);
    setErrorMessage(null);
    try {
      const [data, summary] = await Promise.all([
        learningPathService.fetchAllPaths(accessToken),
        progressService.fetchPathProgressSummary(accessToken).catch(() => ({})),
      ]);
      setPaths(data);
      setProgressSummary(summary || {});
    } catch (err: any) {
      setErrorMessage(
        err.message ?? "Failed to synchronize with backend database.",
      );
    } finally {
      setIsLoading(false);
    }
  };

  const handleTraineeRowClick = (traineeId: string) => {
    if (expandedTraineeId === traineeId) {
      setExpandedTraineeId(null);
    } else {
      setExpandedTraineeId(traineeId);
    }
  };

  useEffect(() => {
    if (selectedPathForTrainees) {
      setIsLoadingLpProgress(true);
      fetch(`http://localhost:3000/v1/trainer/learning-paths/${selectedPathForTrainees}/trainees-progress`, {
        headers: { Authorization: `Bearer ${accessToken}` }
      })
      .then(res => res.json())
      .then(data => setLpTraineesProgress(data))
      .catch(err => console.error("Failed to fetch LP progress", err))
      .finally(() => setIsLoadingLpProgress(false));
    } else {
      setLpTraineesProgress(null);
      setExpandedTraineeId(null);
    }
  }, [selectedPathForTrainees, accessToken]);

  useEffect(() => {
    loadDatabasePaths();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (isAdmin || isTrainer) {
      userService.fetchAllUsers(accessToken).then((rawUsersList) => {
        const eligibleTrainees = (rawUsersList || []).filter((user: any) => {
          const userRoles: string[] = [];
          if (typeof user.role === "string") userRoles.push(user.role.toLowerCase());
          if (typeof user.primaryRole === "string") userRoles.push(user.primaryRole.toLowerCase());
          if (user.primaryRole?.name) userRoles.push(user.primaryRole.name.toLowerCase());
          if (Array.isArray(user.roles)) {
            user.roles.forEach((r: any) => {
              if (typeof r === "string") userRoles.push(r.toLowerCase());
              if (r?.name) userRoles.push(r.name.toLowerCase());
            });
          }
          return userRoles.includes("trainee");
        });
        setAllTrainees(eligibleTrainees);
      }).catch(() => {});
    }
  }, [accessToken, isAdmin, isTrainer]);

  // Open Edit Route
  const handleOpenEditModal = (path: LearningPath) => {
    navigate(`/learning-paths/${path.id}/edit`);
  };

  // Open Assign Modal
  const handleOpenAssignModal = async (path: LearningPath) => {
    setSelectedPath(path);
    setNewlySelectedTraineeIds([]);
    setTraineeSearchQuery("");
    setIsAssignModalOpen(true);
    setIsLoadingTrainees(true);

    try {
      const rawUsersList = await userService.fetchAllUsers(accessToken);

      const eligibleTrainees = (rawUsersList || []).filter((user: any) => {
        const userRoles: string[] = [];
        if (typeof user.role === "string")
          userRoles.push(user.role.toLowerCase());
        if (typeof user.primaryRole === "string")
          userRoles.push(user.primaryRole.toLowerCase());
        if (user.primaryRole?.name)
          userRoles.push(user.primaryRole.name.toLowerCase());

        if (Array.isArray(user.roles)) {
          user.roles.forEach((r: any) => {
            if (typeof r === "string") userRoles.push(r.toLowerCase());
            if (r?.name) userRoles.push(r.name.toLowerCase());
          });
        }

        return userRoles.includes("trainee");
      });

      setAllTrainees(eligibleTrainees);
    } catch (err: any) {
      alert("Could not fetch eligible trainees.");
    } finally {
      setIsLoadingTrainees(false);
    }
  };

  const handleToggleTrainee = (traineeId: string) => {
    setNewlySelectedTraineeIds((prev) =>
      prev.includes(traineeId)
        ? prev.filter((id) => id !== traineeId)
        : [...prev, traineeId],
    );
  };

  const handleConfirmAssignment = async () => {
    if (!selectedPath || newlySelectedTraineeIds.length === 0) return;

    setIsSubmitting(true);
    try {
      const updatedPath = await learningPathService.assignTraineeToPath(
        selectedPath.id,
        newlySelectedTraineeIds,
        accessToken,
      );

      setPaths((prevPaths) =>
        prevPaths.map((p) =>
          p.id === selectedPath.id
            ? {
                ...p,
                assignedToTraineeIds: [
                  ...new Set([
                    ...(p.assignedToTraineeIds || []),
                    ...(updatedPath.assignedToTraineeIds || []),
                    ...newlySelectedTraineeIds,
                  ]),
                ],
              }
            : p,
        ),
      );

      setIsAssignModalOpen(false);
      await refreshNotifications();
    } catch (err: any) {
      alert(err.message ?? "Failed to assign trainees.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const filteredTrainees = useMemo(() => {
    return allTrainees.filter((t) => {
      const fullName =
        `${t.firstName || ""} ${t.lastName || ""}`.trim() || t.name || "";
      return (
        fullName.toLowerCase().includes(traineeSearchQuery.toLowerCase()) ||
        t.email?.toLowerCase().includes(traineeSearchQuery.toLowerCase())
      );
    });
  }, [allTrainees, traineeSearchQuery]);

  const handleDeletePath = async (path: LearningPath) => {
    const pathTitle = path.title || path.name || "Untitled Track";
    const modulesCount = path.modules?.length || 0;
    const lessonsCount = path.modules?.reduce((acc: number, m: any) => acc + (m.lessons?.length || 0), 0) || 0;
    const assignmentsCount = path.modules?.reduce((acc: number, m: any) => acc + (m.assignments?.length || 0) + (m.lessons?.reduce((a: number, l: any) => a + (l.assignments?.length || 0), 0) || 0), 0) || 0;
    const traineesCount = path.assignedToTraineeIds?.length || 0;
    
    const message = `Delete "${pathTitle}"?\n\nThis will permanently remove:\n- ${modulesCount} Modules\n- ${lessonsCount} Lessons\n- ${assignmentsCount} Assignments\n- Trainee progress for ${traineesCount} enrolled users\n\nThis action cannot be undone.`;

    if (!window.confirm(message)) return;

    try {
      await learningPathService.deletePath(path.id, accessToken);
      setPaths((prev) => prev.filter((p) => p.id !== path.id));
    } catch (err: any) {
      alert(err.message ?? "Failed to delete Learning Path.");
    }
  };

  const filteredPaths = useMemo(() => {
    return paths.filter((path) => {
      if (isTrainee && !path.assignedToTraineeIds?.includes(currentUser.id))
        return false;

      if (isTrainee) {
        const progress = progressSummary[path.id]?.userProgressPercent || 0;

        if (activeTabFilter === "All") {
          // pass to search query check
        } else if (activeTabFilter === "Completed") {
          if (progress !== 100) return false;
        } else if (activeTabFilter === "Active") {
          if (progress === 100 || path.status?.toLowerCase() === "upcoming") return false;
        } else {
          return false;
        }
      } else {
        if (
          activeTabFilter !== "All" &&
          path.status?.toLowerCase() !== activeTabFilter.toLowerCase()
        ) {
          return false;
        }
      }

      // Dual search by Title/Name AND Skill Tags (plus Description)
      const query = debouncedSearchQuery.trim().toLowerCase();
      if (query) {
        const title = (path.title || path.name || "").toLowerCase();
        const desc = (path.description || "").toLowerCase();

        let tags: string[] = [];
        if (Array.isArray(path.skillsTags)) {
          tags = path.skillsTags;
        } else if (typeof path.skillsTags === "string") {
          tags = (path.skillsTags as string).split(",").map((t) => t.trim());
        }

        const titleMatch = title.includes(query);
        const descMatch = desc.includes(query);
        const tagsMatch = tags.some((t) => t.toLowerCase().includes(query));

        if (!titleMatch && !descMatch && !tagsMatch) {
          return false;
        }
      }

      return true;
    });
  }, [paths, activeTabFilter, isTrainee, currentUser.id, progressSummary, debouncedSearchQuery, searchQuery]);


  const currentTrainerName = selectedPath?.createdBy?.firstName
    ? `${selectedPath.createdBy.firstName} ${selectedPath.createdBy.lastName || ""}`
    : selectedPath?.createdBy?.name || "Trainer";

  return (
    <div className="learning-paths-management-container">
      <header className="learning-paths-header-row">
        <div>
          <h1 className="learning-paths-main-title">Learning Paths</h1>
          <p className="learning-paths-sub-heading">
            {filteredPaths.length} engineering tracks available.
          </p>
        </div>
        {(isAdmin || isTrainer) && (
          <button
            type="button"
            className={isTrainer ? "fab-trainer-primary" : "btn-create-learning-path"}
            onClick={() => navigate('/learning-paths/new')}
          >
            + New Learning Path
          </button>
        )}
      </header>

      {/* SEARCH AND FILTER CONTROL STRIP */}
      <section className="learning-paths-control-strip">
        <div className="filter-tabs-cluster">
          {(["All", "Active", "Upcoming", "Completed"] as const)
            .filter((tab) => {
              // Role-Based Button Visibility
              if (tab === "Upcoming" && isTrainee) return false;
              if (tab === "Completed" && !isTrainee) return false;
              return true;
            })
            .map((tab) => (
            <button
              key={tab}
              type="button"
              className={`tab-pill-item ${activeTabFilter === tab ? "tab-pill-active" : ""}`}
              onClick={() => setActiveTabFilter(tab)}
            >
              {tab === "All" ? "All Paths" : tab}
            </button>
          ))}
        </div>
        <div className="search-filter-input-wrapper">
          <span className="search-input-icon">🔍</span>
          <input
            type="text"
            className="paths-search-field"
            placeholder="Search paths by name or skill tags (e.g. React, Python)..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
          {searchQuery && (
            <button
              type="button"
              className="search-clear-btn"
              onClick={() => setSearchQuery("")}
              title="Clear search"
              aria-label="Clear search"
            >
              &times;
            </button>
          )}
        </div>
      </section>

      {/* ACTIVE SEARCH FILTER PILL */}
      {searchQuery.trim() && (
        <div className="search-active-pill-strip">
          <span className="search-active-tag-badge">
            🔎 Filtering by: <strong>"{searchQuery}"</strong> (matching path title & skill tags)
          </span>
          <button 
            type="button"
            className="btn-clear-search-pill" 
            onClick={() => setSearchQuery("")}
          >
            Clear Filter ✕
          </button>
        </div>
      )}

      {/* PATHS GRID */}
      {isLoading ? (
        <div className="table-status-message">Fetching records...</div>
      ) : errorMessage ? (
        <div className="table-status-message table-status-error">
          {errorMessage}
        </div>
      ) : (
        <section className="learning-paths-grid-layout">
          {filteredPaths.length === 0 ? (
            <div style={{
              gridColumn: '1 / -1',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              padding: '80px 20px',
              background: '#fff',
              borderRadius: '24px',
              border: '1px dashed #cbd5e1',
              boxShadow: '0 4px 6px -1px rgba(0,0,0,0.02)',
              textAlign: 'center',
              marginTop: '20px'
            }}>
              <div style={{
                width: '80px',
                height: '80px',
                background: '#e0e7ff',
                borderRadius: '20px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: '36px',
                marginBottom: '24px',
                color: '#4f46e5',
                boxShadow: '0 10px 15px -3px rgba(79, 70, 229, 0.2)'
              }}>
                🚀
              </div>
              <h3 style={{ margin: '0 0 12px 0', fontSize: '24px', fontWeight: 800, color: '#0f172a' }}>
                No Learning Paths Found
              </h3>
              <p style={{ margin: '0 0 32px 0', fontSize: '15px', color: '#64748b', maxWidth: '400px', lineHeight: 1.6 }}>
                {searchQuery || activeTabFilter !== 'All'
                  ? "No learning paths match your search."
                  : isTrainee 
                    ? "You haven't been assigned to any learning paths yet. Check back later!"
                    : "It looks like there aren't any learning paths available right now. Once created, they will appear here."}
              </p>
              {!isTrainee && (
                <button
                  type="button"
                  onClick={() => navigate('/learning-paths/new')}
                  style={{
                    padding: '12px 28px',
                    background: 'linear-gradient(135deg, #6366f1, #4f46e5)',
                    color: '#fff',
                    border: 'none',
                    borderRadius: '12px',
                    fontSize: '15px',
                    fontWeight: 700,
                    cursor: 'pointer',
                    boxShadow: '0 4px 12px rgba(99, 102, 241, 0.3)',
                    transition: 'all 0.2s',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px'
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.transform = 'translateY(-2px)';
                    e.currentTarget.style.boxShadow = '0 6px 16px rgba(99, 102, 241, 0.4)';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.transform = 'translateY(0)';
                    e.currentTarget.style.boxShadow = '0 4px 12px rgba(99, 102, 241, 0.3)';
                  }}
                >
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    <line x1="12" y1="5" x2="12" y2="19"></line>
                    <line x1="5" y1="12" x2="19" y2="12"></line>
                  </svg>
                  Create Learning Path
                </button>
              )}
            </div>
          ) : (
            filteredPaths.map((path) => {
              const currentTitle = path.title || path.name || "Untitled Track";
              const currentStatus = path.status || "Active";
              const isPathActive = currentStatus.toLowerCase() === "active";

              // Robust Owner Extraction
              const creatorId =
                path.createdBy?.id ||
                (typeof path.createdBy === "string" ? path.createdBy : null) ||
                (path as any).createdById;

              // Trainees never see Edit/Delete. Only Admin or path creator can mutate.
              const isOwnerOrAdmin =
                !isTrainee &&
                (isAdmin ||
                  (Boolean(creatorId) &&
                    String(creatorId).toLowerCase() ===
                      String(currentUser.id).toLowerCase()));

              // Parse Tags
              let currentTags: string[] = [];
              if (Array.isArray(path.skillsTags)) {
                currentTags = path.skillsTags;
              } else if (typeof path.skillsTags === "string") {
                currentTags = (path.skillsTags as string)
                  .split(",")
                  .map((t) => t.trim())
                  .filter(Boolean);
              }
              
              const matchedTagsRaw = (path as any).matchedTags || [];
              const matchedTagsLower = matchedTagsRaw.map((t: string) => t.toLowerCase());

              return (
                <div 
                  key={path.id} 
                  className="learning-path-card-item"
                  style={{
                    transition: 'transform 0.1s ease, box-shadow 0.1s ease',
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.transform = 'scale(1.01)';
                    e.currentTarget.style.boxShadow = '0 10px 25px -5px rgba(0, 0, 0, 0.1), 0 8px 10px -6px rgba(0, 0, 0, 0.1)';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.transform = 'scale(1)';
                    e.currentTarget.style.boxShadow = '0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -2px rgba(0, 0, 0, 0.1)';
                  }}
                  onMouseDown={(e) => {
                    e.currentTarget.style.transform = 'scale(0.98)';
                  }}
                  onMouseUp={(e) => {
                    e.currentTarget.style.transform = 'scale(1.01)';
                  }}
                >
                  <div className="card-top-badges-row">
                    {path.imageUrl ? (
                      <img
                        src={path.imageUrl}
                        alt={currentTitle}
                        style={{
                          width: "40px",
                          height: "40px",
                          borderRadius: "8px",
                          objectFit: "cover",
                        }}
                      />
                    ) : (
                      <div className="card-avatar-icon-box">🎒</div>
                    )}

                    <div style={{ display: "flex", gap: "6px" }}>
                      <span
                        className={`difficulty-badge diff-${(path.difficulty || "Intermediate").toLowerCase()}`}
                      >
                        {path.difficulty || "Intermediate"}
                      </span>
                      <span
                        className={`status-badge stat-${currentStatus.toLowerCase()}`}
                      >
                        {currentStatus}
                      </span>
                    </div>
                  </div>

                  <h2 className="card-title-string">{highlightMatch(currentTitle, debouncedSearchQuery)}</h2>
                  <ExpandableDescription description={path.description || ""} />

                  {/* SKILLS TAGS CLOUD ROW */}
                  {currentTags.length > 0 ? (
                    <div
                      className="card-tags-cloud-row"
                      style={{
                        display: "flex",
                        flexWrap: "wrap",
                        gap: "6px",
                        marginTop: "10px",
                        marginBottom: "10px",
                      }}
                    >
                      {currentTags.map((tag, idx) => {
                        const isMatched =
                          matchedTagsLower.includes(tag.toLowerCase()) ||
                          (searchQuery.trim().length > 0 &&
                            tag.toLowerCase().includes(searchQuery.trim().toLowerCase()));
                        return (
                          <span
                            key={idx}
                            className={`card-skill-tag-chip ${isMatched ? "is-matched" : ""}`}
                            onClick={(e) => {
                              e.stopPropagation();
                              setSearchQuery(tag);
                            }}
                            title={`Click to filter by skill "${tag}"`}
                          >
                            <span className="tag-hash">#</span>
                            <span className="tag-text">{highlightMatch(tag, searchQuery)}</span>
                          </span>
                        );
                      })}
                    </div>
                  ) : (
                    isOwnerOrAdmin && (
                      <div 
                        className="card-empty-tags-row"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleOpenEditModal(path);
                        }}
                        title="Click to add skill tags in editor"
                      >
                        <span className="add-tag-prompt">+ Add Skill Tags</span>
                      </div>
                    )
                  )}

                  <div className="card-counters-flex-strip">
                    <span>⏱️ {path.duration || "12 weeks"}</span>
                    <span>📦 {path.modules?.length || 0} modules</span>
            
                  </div>
                  {/* 🌟 DYNAMIC REAL-TIME PROGRESS BAR (TRAINEE vs TRAINER COHORT RULES) */}
                  {(() => {
                    const summary = progressSummary[path.id];
                    let progressVal = 0;

                    if (isTrainee) {
                      progressVal = summary?.userProgressPercent ?? (path as any).progressPercent ?? 0;
                      return (
                        <div style={{ marginTop: "14px", marginBottom: "8px" }}>
                          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", fontSize: "12px", color: "#475569", marginBottom: "6px" }}>
                            <span style={{ fontWeight: 600 }}>My Learning Progress</span>
                            <span style={{ fontWeight: 800, color: progressVal === 100 ? "#16a34a" : "#4f46e5" }}>
                              {progressVal}% {progressVal === 100 ? "🎉 Complete" : ""}
                            </span>
                          </div>
                          <div 
                            style={{ width: "100%", height: "8px", background: "#e2e8f0", borderRadius: "9999px", overflow: "hidden" }}
                            role="progressbar"
                            aria-valuenow={progressVal}
                            aria-valuemin={0}
                            aria-valuemax={100}
                          >
                            <div
                              style={{
                                width: `${progressVal}%`,
                                height: "100%",
                                background: progressVal === 100
                                  ? "linear-gradient(90deg, #22c55e 0%, #16a34a 100%)"
                                  : "linear-gradient(90deg, #6366f1 0%, #4f46e5 100%)",
                                borderRadius: "9999px",
                                transition: "width 0.5s ease-in-out",
                              }}
                            />
                          </div>
                        </div>
                      );
                    } else {
                      return (
                        <div style={{ marginTop: "14px", marginBottom: "8px", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                          <span style={{ fontSize: "12px", fontWeight: 600, color: "#475569" }}>Trainee Overview</span>
                          <button
                            onClick={() => setSelectedPathForTrainees(path.id)}
                            style={{ padding: "4px 10px", background: "#eff6ff", color: "#2563eb", border: "none", borderRadius: "6px", fontSize: "11px", fontWeight: 600, cursor: "pointer" }}
                          >
                            See Trainee Progress
                          </button>
                        </div>
                      );
                    }
                  })()}

                  {/* 🌟 ACTION BUTTONS CLUSTER - FLEX LAYOUT WRAPPED SAFELY */}
                  <div
                    className="card-actions-row-cluster"
                    style={{
                      display: "flex",
                      flexDirection: "row",
                      flexWrap: "nowrap", // Prevents buttons from wrapping to a second line
                      alignItems: "center",
                      gap: "6px",
                      marginTop: "16px",
                      width: "100%",
                    }}
                  >
                    {/* Primary Action Button */}
                    <button
                      type="button"
                      className="btn-card-action-continue"
                      style={{
                        flex: "1 1 auto",
                        minWidth: 0,
                        whiteSpace: "nowrap",
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                        padding: "8px 10px",
                        fontSize: "12px",
                        fontWeight: 600,
                      }}
                      onClick={() => onNavigateToModules(path.id, currentTitle)}
                    >
                      {isTrainee
                        ? "Continue Learning →"
                        : "Manage Curriculum →"}
                    </button>

                    {/* Secondary Action Buttons Group */}
                    <div style={{ display: "flex", gap: "6px", flexShrink: 0 }}>
                      {/* ASSIGN BUTTON: Visible ONLY when status is Active AND has modules */}
                      {(isAdmin || isTrainer) && isPathActive && path.modules && path.modules.length > 0 && (
                        <button
                          type="button"
                          className="btn-card-action-assign"
                          style={{
                            padding: "8px 10px",
                            background: "#e2e8f0",
                            color: "#334155",
                            border: "none",
                            borderRadius: "6px",
                            cursor: "pointer",
                            fontWeight: 600,
                            fontSize: "12px",
                            whiteSpace: "nowrap",
                          }}
                          onClick={() => handleOpenAssignModal(path)}
                          title="Assign Trainees"
                        >
                          👥 Assign
                        </button>
                      )}

                      {/* 🌟 EDIT BUTTON */}
                      {isOwnerOrAdmin && (
                        <button
                          type="button"
                          style={{
                            padding: "8px 10px",
                            background: "#fef3c7",
                            color: "#b45309",
                            border: "1px solid #fde68a",
                            borderRadius: "6px",
                            cursor: "pointer",
                            fontWeight: 600,
                            fontSize: "12px",
                            whiteSpace: "nowrap",
                          }}
                          onClick={() => navigate('/learning-paths/' + path.id + '/edit')}
                          title="Edit Learning Path & Activate Status"
                        >
                          ✏️ Edit
                        </button>
                      )}

                      {/* DELETE BUTTON: Always available to Owner & Admin */}
                      {isOwnerOrAdmin && (
                        <button
                          type="button"
                          className="btn-card-action-delete"
                          onClick={() => handleDeletePath(path)}
                          title="Delete Learning Path"
                        >
                          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ verticalAlign: 'middle', marginTop: '-2px' }}>
                            <polyline points="3 6 5 6 21 6"></polyline>
                            <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
                            <line x1="10" y1="11" x2="10" y2="17"></line>
                            <line x1="14" y1="11" x2="14" y2="17"></line>
                          </svg>
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </section>
      )}

      {/* ASSIGN TRAINEES MODAL */}
      {isAssignModalOpen && selectedPath && (
        <div
          className="modal-backdrop-blur-overlay"
          onClick={() => setIsAssignModalOpen(false)}
        >
          <div
            className="modal-popup-container"
            style={{ width: "520px" }}
            onClick={(e) => e.stopPropagation()}
          >
            <header className="modal-popup-header">
              <h2>Assign Trainees to Track</h2>
              <button
                type="button"
                className="modal-close-icon-btn"
                onClick={() => setIsAssignModalOpen(false)}
              >
                ×
              </button>
            </header>

            <div style={{ padding: "16px 20px" }}>
              <input
                type="text"
                className="invite-form-input"
                placeholder="🔍 Search trainee by name or email..."
                value={traineeSearchQuery}
                onChange={(e) => setTraineeSearchQuery(e.target.value)}
                style={{ marginBottom: "12px" }}
              />

              <div
                style={{
                  maxHeight: "260px",
                  overflowY: "auto",
                  border: "1px solid #e2e8f0",
                  borderRadius: "6px",
                  padding: "8px",
                }}
              >
                {isLoadingTrainees ? (
                  <div
                    style={{
                      padding: "16px",
                      textAlign: "center",
                      color: "#64748b",
                    }}
                  >
                    Loading trainees...
                  </div>
                ) : filteredTrainees.length === 0 ? (
                  <div
                    style={{
                      padding: "16px",
                      textAlign: "center",
                      color: "#94a3b8",
                    }}
                  >
                    No trainees found.
                  </div>
                ) : (
                  (() => {
                    const sortByName = (a: any, b: any) => {
                      const nameA = `${a.firstName || ""} ${a.lastName || ""}`.trim() || a.name || a.email || "";
                      const nameB = `${b.firstName || ""} ${b.lastName || ""}`.trim() || b.name || b.email || "";
                      return nameA.localeCompare(nameB);
                    };

                    const available = filteredTrainees
                      .filter(t => !selectedPath.assignedToTraineeIds?.includes(t.id))
                      .sort(sortByName);
                    const alreadyAssigned = filteredTrainees
                      .filter(t => selectedPath.assignedToTraineeIds?.includes(t.id))
                      .sort(sortByName);

                    const renderTraineeRow = (trainee: any, isAlreadyAssigned: boolean) => {
                      const isNewlyChecked = newlySelectedTraineeIds.includes(trainee.id);
                      const displayName = `${trainee.firstName || ""} ${trainee.lastName || ""}`.trim() || trainee.name || trainee.email;

                      return (
                        <div
                          key={trainee.id}
                          style={{
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "space-between",
                            padding: "10px 12px",
                            borderRadius: "6px",
                            background: isAlreadyAssigned
                              ? "#f1f5f9"
                              : isNewlyChecked
                                ? "#f0f9ff"
                                : "#fff",
                            border: "1px solid #e2e8f0",
                            marginBottom: "6px",
                            opacity: isAlreadyAssigned ? 0.75 : 1,
                          }}
                        >
                          <label
                            style={{
                              display: "flex",
                              alignItems: "center",
                              gap: "12px",
                              cursor: isAlreadyAssigned ? "not-allowed" : "pointer",
                              flex: 1,
                            }}
                          >
                            <input
                              type="checkbox"
                              disabled={isAlreadyAssigned}
                              checked={isAlreadyAssigned || isNewlyChecked}
                              onChange={() => !isAlreadyAssigned && handleToggleTrainee(trainee.id)}
                              style={{
                                width: "16px",
                                height: "16px",
                                cursor: isAlreadyAssigned ? "not-allowed" : "pointer",
                              }}
                            />
                            <div>
                              <div style={{ fontSize: "14px", fontWeight: 600, color: "#1e293b" }}>
                                {displayName}
                              </div>
                              <div style={{ fontSize: "12px", color: "#64748b" }}>
                                {trainee.email}
                              </div>
                            </div>
                          </label>

                          {isAlreadyAssigned ? (
                            <span
                              style={{
                                fontSize: "11px",
                                fontWeight: 600,
                                color: "#475569",
                                background: "#e2e8f0",
                                padding: "3px 8px",
                                borderRadius: "4px",
                              }}
                            >
                              ✓ Already Assigned{
                                selectedPath.traineeAssigners?.[trainee.id]
                                  ? ` (${`${selectedPath.traineeAssigners[trainee.id].firstName || ''} ${selectedPath.traineeAssigners[trainee.id].lastName || ''}`.trim() || selectedPath.traineeAssigners[trainee.id].email})`
                                  : ''
                              }
                            </span>
                          ) : isNewlyChecked ? (
                            <span
                              style={{
                                fontSize: "11px",
                                fontWeight: 600,
                                color: "#15803d",
                                background: "#dcfce7",
                                padding: "3px 8px",
                                borderRadius: "4px",
                              }}
                            >
                              Selected
                            </span>
                          ) : null}
                        </div>
                      );
                    };

                    return (
                      <>
                        {available.length > 0 && (
                          <div style={{ marginBottom: alreadyAssigned.length > 0 ? "16px" : 0 }}>
                            <div style={{ fontSize: "11px", fontWeight: 700, color: "#64748b", textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: "8px", paddingLeft: "4px" }}>
                              AVAILABLE TO ASSIGN ({available.length})
                            </div>
                            {available.map(t => renderTraineeRow(t, false))}
                          </div>
                        )}
                        {alreadyAssigned.length > 0 && (
                          <div>
                            <div style={{ fontSize: "11px", fontWeight: 700, color: "#94a3b8", textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: "8px", paddingLeft: "4px" }}>
                              ALREADY ASSIGNED ({alreadyAssigned.length})
                            </div>
                            {alreadyAssigned.map(t => renderTraineeRow(t, true))}
                          </div>
                        )}
                      </>
                    );
                  })()
                )}
              </div>
            </div>

            <footer className="modal-popup-footer">
              {allTrainees.length > 0 && allTrainees.every(t => selectedPath.assignedToTraineeIds?.includes(t.id)) ? (
                <div style={{ width: "100%", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <span style={{ fontSize: "13px", color: "#64748b", margin: "0 auto", padding: "12px 0", fontWeight: 500 }}>
                    All trainees are already assigned to this track.
                  </span>
                  <button
                    type="button"
                    className="modal-cancel-btn"
                    onClick={() => setIsAssignModalOpen(false)}
                  >
                    Close
                  </button>
                </div>
              ) : (
                <>
                  <span
                    style={{
                      fontSize: "13px",
                      color: "#64748b",
                      marginRight: "auto",
                      paddingLeft: "12px",
                      fontWeight: 500
                    }}
                  >
                    {newlySelectedTraineeIds.length} Selected · {allTrainees.filter(t => selectedPath.assignedToTraineeIds?.includes(t.id)).length} Already Assigned · {allTrainees.length} Total
                  </span>
                  <button
                    type="button"
                    className="modal-cancel-btn"
                    onClick={() => setIsAssignModalOpen(false)}
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    className="modal-confirm-btn"
                    disabled={newlySelectedTraineeIds.length === 0 || isSubmitting}
                    onClick={handleConfirmAssignment}
                  >
                    {isSubmitting ? "Assigning..." : "Assign Selected"}
                  </button>
                </>
              )}
            </footer>
          </div>
        </div>
      )}

      {selectedPathForTrainees && (() => {
        const path = paths.find(p => p.id === selectedPathForTrainees);
        
        if (isLoadingLpProgress || !lpTraineesProgress) {
          return (
            <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <div style={{ background: '#fff', padding: '24px', borderRadius: '12px', color: '#64748b', fontWeight: 600 }}>Loading cohort data...</div>
            </div>
          );
        }

        const { cohort, trainees } = lpTraineesProgress;
        
        const chartData = [
          { name: 'Completed', value: cohort.completed, color: '#10b981' },
          { name: 'In Progress', value: cohort.inProgress, color: '#4f46e5' },
          { name: 'Not Started', value: cohort.notStarted, color: '#94a3b8' }
        ].filter(d => d.value > 0);

        return (
          <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px' }}>
            <style>{`
              .trainee-table-row { display: table-row; }
              .trainee-table-cell { display: table-cell; }
              .trainee-table-head { display: table-header-group; }
              .cohort-overview-flex { flex-direction: row; }
              @media (max-width: 650px) {
                .trainee-table-head { display: none; }
                .trainee-table-row { display: flex; flex-direction: column; padding: 12px; border-bottom: 1px solid #e2e8f0; position: relative; }
                .trainee-table-cell { display: flex; padding: 6px 0 !important; align-items: center; }
                .trainee-table-cell[data-label]::before { content: attr(data-label); font-weight: 600; width: 120px; color: #475569; font-size: 12px; text-transform: uppercase; }
                .cohort-overview-flex { flex-direction: column !important; }
              }
              
              .expandable-row-content {
                display: grid;
                grid-template-rows: 0fr;
                transition: grid-template-rows 0.3s ease-out;
              }
              .expandable-row-content.open {
                grid-template-rows: 1fr;
              }
              .expandable-row-inner {
                overflow: hidden;
              }
            `}</style>
            
            <div style={{ background: '#fff', borderRadius: '16px', width: '100%', maxWidth: '850px', maxHeight: '90vh', overflow: 'hidden', display: 'flex', flexDirection: 'column', boxShadow: '0 25px 50px -12px rgba(0,0,0,0.25)' }}>
              <div style={{ padding: '20px 24px', borderBottom: '1px solid #e2e8f0', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <h2 style={{ margin: 0, fontSize: '18px', fontWeight: 700, color: '#0f172a' }}>Trainees Progress: {path?.title}</h2>
                <button onClick={() => setSelectedPathForTrainees(null)} style={{ background: 'none', border: 'none', fontSize: '24px', cursor: 'pointer', color: '#64748b', minWidth: '44px', minHeight: '44px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>&times;</button>
              </div>
              <div style={{ padding: '24px', overflowY: 'auto', flex: 1, display: 'flex', flexDirection: 'column', gap: '24px' }}>
                
                {/* Graphical Progress Summary */}
                {trainees.length > 0 && chartData.length > 0 && (
                  <div className="cohort-overview-flex" style={{ display: 'flex', gap: '20px', alignItems: 'center', background: '#f8fafc', padding: '16px', borderRadius: '12px', border: '1px solid #e2e8f0' }}>
                    <div style={{ width: '200px', height: '200px', margin: '0 auto' }}>
                      <ResponsiveContainer width="100%" height="100%">
                        <PieChart>
                          <Pie data={chartData} dataKey="value" nameKey="name" cx="50%" cy="50%" innerRadius={50} outerRadius={80} paddingAngle={2}>
                            {chartData.map((entry, index) => (
                              <Cell key={`cell-${index}`} fill={entry.color} />
                            ))}
                          </Pie>
                          <RechartsTooltip />
                        </PieChart>
                      </ResponsiveContainer>
                    </div>
                    <div style={{ flex: 1 }}>
                      <h3 style={{ margin: '0 0 16px 0', fontSize: '15px', fontWeight: 600, color: '#334155' }}>Cohort Overview</h3>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                        {chartData.map((d, i) => (
                          <div key={i} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                              <div style={{ width: '12px', height: '12px', borderRadius: '50%', background: d.color }} />
                              <span style={{ fontSize: '14px', color: '#475569', fontWeight: 500 }}>{d.name}</span>
                            </div>
                            <span style={{ fontSize: '14px', fontWeight: 700, color: '#0f172a' }}>{d.value}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                )}

                {/* Trainee Table */}
                <div style={{ borderRadius: '8px', border: '1px solid #e2e8f0', background: '#fff' }}>
                  {trainees.length === 0 ? (
                    <div style={{ padding: '40px 24px', textAlign: 'center', color: '#64748b' }}>
                      <div style={{ fontSize: '32px', marginBottom: '12px' }}>📭</div>
                      <div style={{ fontWeight: 600, color: '#334155', marginBottom: '4px' }}>No trainees assigned</div>
                      <div style={{ fontSize: '13px' }}>Assign trainees to this path to track their progress.</div>
                    </div>
                  ) : (
                    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px', display: 'table' }}>
                      <thead className="trainee-table-head">
                        <tr style={{ background: '#f8fafc', borderBottom: '1px solid #e2e8f0' }}>
                          <th style={{ padding: '12px 16px', textAlign: 'left', color: '#475569', fontWeight: 600 }}>Trainee Name</th>
                          <th style={{ padding: '12px 16px', textAlign: 'left', color: '#475569', fontWeight: 600 }}>Email</th>
                          <th style={{ padding: '12px 16px', textAlign: 'left', color: '#475569', fontWeight: 600 }}>Path Progress</th>
                        </tr>
                      </thead>
                      <tbody style={{ display: 'table-row-group' }}>
                        {trainees.map((t: any) => {
                          const progress = t.pathProgressPercent;
                          const isExpanded = expandedTraineeId === t.traineeId;
                          let barColor = '#4f46e5';
                          if (progress === 100) barColor = '#10b981';
                          if (progress === 0) barColor = '#94a3b8';

                          return (
                            <React.Fragment key={t.traineeId}>
                              <tr 
                                className="trainee-table-row"
                                style={{ 
                                  cursor: 'pointer',
                                  background: isExpanded ? '#f0f9ff' : 'transparent',
                                  transition: 'background 0.2s',
                                  borderBottom: '1px solid #e2e8f0'
                                }}
                                onClick={() => handleTraineeRowClick(t.traineeId)}
                                onMouseEnter={(e) => { if (!isExpanded) e.currentTarget.style.background = '#f8fafc'; }}
                                onMouseLeave={(e) => { if (!isExpanded) e.currentTarget.style.background = 'transparent'; }}
                              >
                                <td className="trainee-table-cell" data-label="Trainee Name" style={{ padding: '16px', fontWeight: 600, color: '#0f172a', gap: '8px' }}>
                                  <span style={{ fontSize: '12px', color: '#64748b', transform: isExpanded ? 'rotate(90deg)' : 'none', transition: 'transform 0.3s ease', display: 'inline-block', width: '16px' }}>▶</span>
                                  {t.traineeName}
                                </td>
                                <td className="trainee-table-cell" data-label="Email" style={{ padding: '16px', color: '#64748b' }}>{t.email}</td>
                                <td className="trainee-table-cell" data-label="Path Progress" style={{ padding: '16px', width: '100%', maxWidth: '300px' }}>
                                  <div style={{ display: 'flex', alignItems: 'center', gap: '12px', width: '100%' }}>
                                    <div style={{ flex: 1, height: '8px', background: '#e2e8f0', borderRadius: '4px', overflow: 'hidden' }}>
                                      <div style={{ height: '100%', background: barColor, width: `${progress}%`, transition: 'width 1s cubic-bezier(0.4, 0, 0.2, 1)' }} />
                                    </div>
                                    <span style={{ fontSize: '13px', fontWeight: 700, color: '#334155', minWidth: '40px', textAlign: 'right' }}>{progress}%</span>
                                  </div>
                                </td>
                              </tr>
                              
                              <tr style={{ display: 'table-row' }}>
                                <td colSpan={3} style={{ padding: 0, border: 'none' }}>
                                  <div className={`expandable-row-content ${isExpanded ? 'open' : ''}`}>
                                    <div className="expandable-row-inner" style={{ background: '#f8fafc', borderBottom: isExpanded ? '1px solid #e2e8f0' : 'none' }}>
                                      <div style={{ padding: '20px 24px', display: 'flex', gap: '24px', flexWrap: 'wrap' }}>
                                        <div style={{ flex: '1 1 180px' }}>
                                          <div style={{ fontSize: '11px', textTransform: 'uppercase', color: '#64748b', fontWeight: 600, marginBottom: '6px', letterSpacing: '0.05em' }}>Lessons Completed</div>
                                          <div style={{ fontSize: '18px', fontWeight: 800, color: '#0f172a' }}>{t.lessonsCompleted} <span style={{ color: '#94a3b8', fontSize: '14px', fontWeight: 500 }}>/ {t.lessonsTotal}</span></div>
                                        </div>
                                        <div style={{ flex: '1 1 180px' }}>
                                          <div style={{ fontSize: '11px', textTransform: 'uppercase', color: '#64748b', fontWeight: 600, marginBottom: '6px', letterSpacing: '0.05em' }}>Tasks Approved</div>
                                          <div style={{ fontSize: '18px', fontWeight: 800, color: '#0f172a' }}>{t.tasksApproved} <span style={{ color: '#94a3b8', fontSize: '14px', fontWeight: 500 }}>/ {t.tasksTotal}</span></div>
                                        </div>
                                        <div style={{ flex: '1 1 180px' }}>
                                          <div style={{ fontSize: '11px', textTransform: 'uppercase', color: '#64748b', fontWeight: 600, marginBottom: '6px', letterSpacing: '0.05em' }}>Average Score</div>
                                          <div style={{ fontSize: '18px', fontWeight: 800, color: '#0f172a' }}>{t.avgScorePercent !== null ? `${t.avgScorePercent}%` : '—'}</div>
                                        </div>
                                        <div style={{ flex: '1 1 180px' }}>
                                          <div style={{ fontSize: '11px', textTransform: 'uppercase', color: '#64748b', fontWeight: 600, marginBottom: '6px', letterSpacing: '0.05em' }}>Resources Visited</div>
                                          <div style={{ fontSize: '18px', fontWeight: 800, color: '#0f172a' }}>{t.resourcesVisited} <span style={{ color: '#94a3b8', fontSize: '14px', fontWeight: 500 }}>/ {t.resourcesTotal}</span></div>
                                        </div>
                                      </div>
                                    </div>
                                  </div>
                                </td>
                              </tr>
                            </React.Fragment>
                          );
                        })}
                      </tbody>
                    </table>
                  )}
                </div>
              </div>
            </div>
          </div>
        );
      })()}
    </div>
  );
}
