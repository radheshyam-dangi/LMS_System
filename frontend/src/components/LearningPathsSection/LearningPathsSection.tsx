import React, { useState, useMemo, useEffect } from "react";
import "./LearningPaths.css";
import { learningPathService } from "../../services/learningPathService";
import { userService } from "../../services/userService";
import { progressService } from "../../services/lmsApi";
import { useNotifications } from "../../context/NotificationContext";
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
  onNavigateToModules: (pathId: string, pathName: string) => void;
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

export function LearningPathsSection({
  currentUser,
  accessToken,
  onNavigateToModules,
}: LearningPathsSectionProps) {
  const [paths, setPaths] = useState<LearningPath[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const [activeTabFilter, setActiveTabFilter] = useState<"All" | PathStatus>(
    "All",
  );
  const [searchQuery, setSearchQuery] = useState("");

  // Modal States
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [editingPathId, setEditingPathId] = useState<string | null>(null);
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

  // Form Inputs
  const [formName, setFormName] = useState("");
  const [formDifficulty, setFormDifficulty] =
    useState<PathDifficulty>("Intermediate");
  const [formStatus, setFormStatus] = useState<PathStatus>("Active");
  const [formDuration, setFormDuration] = useState("12 weeks");
  const [formImageUrl, setFormImageUrl] = useState("");
  const [formDescription, setFormDescription] = useState("");
  const [formTags, setFormTags] = useState("");

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

  useEffect(() => {
    loadDatabasePaths();
  }, [accessToken]);

  // Open Edit Modal & Populate Form
  const handleOpenEditModal = (path: LearningPath) => {
    setEditingPathId(path.id);
    setFormName(path.title || path.name || "");
    setFormDescription(path.description || "");
    setFormDifficulty(path.difficulty || "Intermediate");
    setFormStatus(path.status || "Active");
    setFormDuration(path.duration || "12 weeks");
    setFormImageUrl(path.imageUrl || "");

    let currentTags = "";
    if (Array.isArray(path.skillsTags)) {
      currentTags = path.skillsTags.join(", ");
    } else if (typeof path.skillsTags === "string") {
      currentTags = path.skillsTags;
    }
    setFormTags(currentTags);
    setIsEditModalOpen(true);
  };

  // Submit Edit Form
  const handleUpdatePathSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingPathId || !formName.trim() || isSubmitting) return;

    setIsSubmitting(true);
    const tagsArray = formTags
      .split(",")
      .map((t) => t.trim())
      .filter((t) => t.length > 0);

    try {
      const payload = {
        name: formName,
        title: formName,
        description: formDescription,
        difficulty: formDifficulty,
        status: formStatus,
        duration: formDuration,
        imageUrl: formImageUrl.trim() || undefined,
        skillsTags: tagsArray,
      };

      const updatedPath = await learningPathService.updatePath(
        editingPathId,
        payload,
        accessToken,
      );

      setPaths((prev) =>
        prev.map((p) =>
          p.id === editingPathId
            ? { ...p, ...updatedPath, status: formStatus }
            : p,
        ),
      );

      setIsEditModalOpen(false);
      setEditingPathId(null);
    } catch (err: any) {
      alert(err.message ?? "Failed to update Learning Path.");
    } finally {
      setIsSubmitting(false);
    }
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

  const handleDeletePath = async (pathId: string, pathTitle: string) => {
    if (!window.confirm(`Are you sure you want to delete "${pathTitle}"?`))
      return;

    try {
      await learningPathService.deletePath(pathId, accessToken);
      setPaths((prev) => prev.filter((p) => p.id !== pathId));
    } catch (err: any) {
      alert(err.message ?? "Failed to delete Learning Path.");
    }
  };

  const filteredPaths = useMemo(() => {
    return paths.filter((path) => {
      if (isTrainee && !path.assignedToTraineeIds?.includes(currentUser.id))
        return false;
      const matchesTab =
        activeTabFilter === "All" ||
        path.status?.toLowerCase() === activeTabFilter.toLowerCase();
      const pathDisplayName = path.title || path.name || "";
      return (
        matchesTab &&
        pathDisplayName.toLowerCase().includes(searchQuery.toLowerCase())
      );
    });
  }, [paths, activeTabFilter, searchQuery, isTrainee, currentUser.id]);

  const handleCreatePathSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formName.trim() || isSubmitting) return;

    setIsSubmitting(true);
    const tagsArray = formTags
      .split(",")
      .map((t) => t.trim())
      .filter((t) => t.length > 0);

    try {
      const payload = {
        name: formName,
        title: formName,
        description: formDescription,
        difficulty: formDifficulty,
        status: formStatus,
        duration: formDuration,
        imageUrl: formImageUrl.trim() || undefined,
        skillsTags: tagsArray.length > 0 ? tagsArray : ["General"],
      };

      const savedPath = await learningPathService.createPath(
        payload,
        accessToken,
      );
      setPaths((prev) => [savedPath, ...prev]);

      setFormName("");
      setFormDescription("");
      setFormImageUrl("");
      setFormTags("");
      setIsCreateModalOpen(false);
    } catch (err: any) {
      alert(err.message ?? "Failed to create learning path.");
    } finally {
      setIsSubmitting(false);
    }
  };

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
            className="btn-create-learning-path"
            onClick={() => setIsCreateModalOpen(true)}
          >
            + New Learning Path
          </button>
        )}
      </header>

      {/* SEARCH AND FILTER CONTROL STRIP */}
      <section className="learning-paths-control-strip">
        <div className="filter-tabs-cluster">
          {(["All", "Active", "Upcoming", "Completed"] as const).map((tab) => (
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
          <input
            type="text"
            className="paths-search-field"
            placeholder="Search paths..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>
      </section>

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
            <div className="empty-paths-state-box">
              No learning tracks available.
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

              return (
                <div key={path.id} className="learning-path-card-item">
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

                  <h2 className="card-title-string">{currentTitle}</h2>
                  <p className="card-description-string">
                    {path.description || "No description provided."}
                  </p>

                  {/* SKILLS TAGS CLOUD ROW */}
                  {currentTags.length > 0 && (
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
                      {currentTags.map((tag, idx) => (
                        <span
                          key={idx}
                          style={{
                            fontSize: "11px",
                            fontWeight: 600,
                            color: "#2563eb",
                            background: "#eff6ff",
                            border: "1px solid #bfdbfe",
                            padding: "2px 8px",
                            borderRadius: "12px",
                          }}
                        >
                          {tag}
                        </span>
                      ))}
                    </div>
                  )}

                  <div className="card-counters-flex-strip">
                    <span>⏱️ {path.duration || "12 weeks"}</span>
                    <span>📦 {path.modules?.length || 0} modules</span>
                    <span>
                      👥 Enrolled: {path.assignedToTraineeIds?.length || 0}
                    </span>
                  </div>
                  {/* 🌟 DYNAMIC REAL-TIME PROGRESS BAR (TRAINEE vs TRAINER COHORT RULES) */}
                  {(() => {
                    const summary = progressSummary[path.id];
                    const enrolledCount = path.assignedToTraineeIds?.length || summary?.enrolledCount || 0;
                    let progressVal = 0;

                    if (isTrainee) {
                      // Trainee side: real-time user progress calculated from watched lessons + submitted tasks + visited resources
                      progressVal = summary?.userProgressPercent ?? (path as any).progressPercent ?? 0;
                    } else {
                      // Trainer/Admin side: 0% if no trainees enrolled, or real average progress across all enrolled trainees
                      if (enrolledCount === 0) {
                        progressVal = 0;
                      } else {
                        progressVal = summary?.cohortProgressPercent ?? (path as any).cohortProgress ?? 0;
                      }
                    }

                    return (
                      <div style={{ marginTop: "14px", marginBottom: "8px" }}>
                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", fontSize: "12px", color: "#475569", marginBottom: "6px" }}>
                          <span style={{ fontWeight: 600 }}>{isTrainee ? "My Learning Progress" : "Cohort Overall Progress"}</span>
                          <span style={{ fontWeight: 800, color: progressVal === 100 ? "#16a34a" : "#4f46e5" }}>
                            {progressVal}% {progressVal === 100 ? "🎉 Complete" : ""}
                          </span>
                        </div>
                        <div style={{ width: "100%", height: "8px", background: "#e2e8f0", borderRadius: "9999px", overflow: "hidden" }}>
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
                      {/* ASSIGN BUTTON: Visible ONLY when status is Active */}
                      {(isAdmin || isTrainer) && isPathActive && (
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

                      {/* 🌟 EDIT BUTTON: Visible ONLY when status is UPCOMING (!isPathActive) */}
                      {isOwnerOrAdmin && !isPathActive && (
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
                          onClick={() => handleOpenEditModal(path)}
                          title="Edit Learning Path & Activate Status"
                        >
                          ✏️ Edit
                        </button>
                      )}

                      {/* DELETE BUTTON: Always available to Owner & Admin */}
                      {isOwnerOrAdmin && (
                        <button
                          type="button"
                          style={{
                            padding: "8px 10px",
                            background: "#fee2e2",
                            color: "#dc2626",
                            border: "1px solid #fca5a5",
                            borderRadius: "6px",
                            cursor: "pointer",
                            fontSize: "12px",
                            whiteSpace: "nowrap",
                          }}
                          onClick={() =>
                            handleDeletePath(path.id, currentTitle)
                          }
                          title="Delete Track"
                        >
                          🗑️
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
                  filteredTrainees.map((trainee) => {
                    const isAlreadyAssigned =
                      selectedPath.assignedToTraineeIds?.includes(trainee.id);
                    const isNewlyChecked = newlySelectedTraineeIds.includes(
                      trainee.id,
                    );
                    const displayName =
                      `${trainee.firstName || ""} ${trainee.lastName || ""}`.trim() ||
                      trainee.name ||
                      trainee.email;

                    return (
                      <div
                        key={trainee.id}
                        style={{
                          display: "flex",
                          alignItems: "center",
                          justifyContent  : "space-between",
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
                            cursor: isAlreadyAssigned
                              ? "not-allowed"
                              : "pointer",
                            flex: 1,
                          }}
                        >
                          <input
                            type="checkbox"
                            disabled={isAlreadyAssigned}
                            checked={isAlreadyAssigned || isNewlyChecked}
                            onChange={() =>
                              !isAlreadyAssigned &&
                              handleToggleTrainee(trainee.id)
                            }
                            style={{
                              width: "16px",
                              height: "16px",
                              cursor: isAlreadyAssigned
                                ? "not-allowed"
                                : "pointer",
                            }}
                          />
                          <div>
                            <div
                              style={{
                                fontSize: "14px",
                                fontWeight: 600,
                                color: "#1e293b",
                              }}
                            >
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
                            ✓ Already Assigned ({currentTrainerName})
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
                  })
                )}
              </div>
            </div>

            <footer className="modal-popup-footer">
              <span
                style={{
                  fontSize: "13px",
                  color: "#64748b",
                  marginRight: "auto",
                  paddingLeft: "12px",
                }}
              >
                {newlySelectedTraineeIds.length} New Trainee(s) Selected
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
            </footer>
          </div>
        </div>
      )}

      {/* EDIT PATH MODAL */}
      {isEditModalOpen && (
        <div
          className="modal-backdrop-blur-overlay"
          onClick={() => !isSubmitting && setIsEditModalOpen(false)}
        >
          <div
            className="modal-popup-container"
            onClick={(e) => e.stopPropagation()}
          >
            <header className="modal-popup-header">
              <h2>Edit Learning Path</h2>
              <button
                type="button"
                disabled={isSubmitting}
                className="modal-close-icon-btn"
                onClick={() => setIsEditModalOpen(false)}
              >
                ×
              </button>
            </header>
            <form
              onSubmit={handleUpdatePathSubmit}
              className="invite-form-body"
            >
              <div className="invite-form-field">
                <label>Path Name *</label>
                <input
                  type="text"
                  required
                  disabled={isSubmitting}
                  className="invite-form-input"
                  value={formName}
                  onChange={(e) => setFormName(e.target.value)}
                />
              </div>

              <div
                className="invite-form-row"
                style={{ display: "flex", gap: "12px" }}
              >
                <div className="invite-form-field" style={{ flex: 1 }}>
                  <label>Status *</label>
                  <select
                    disabled={isSubmitting}
                    className="invite-form-input"
                    value={formStatus}
                    onChange={(e) =>
                      setFormStatus(e.target.value as PathStatus)
                    }
                  >
                    <option value="Active">
                      Active (Allows Trainee Assignment)
                    </option>
                    <option value="Upcoming">
                      Upcoming (Hides Assign Button)
                    </option>
                  </select>
                </div>

                <div className="invite-form-field" style={{ flex: 1 }}>
                  <label>Difficulty</label>
                  <select
                    disabled={isSubmitting}
                    className="invite-form-input"
                    value={formDifficulty}
                    onChange={(e) =>
                      setFormDifficulty(e.target.value as PathDifficulty)
                    }
                  >
                    <option value="Beginner">Beginner</option>
                    <option value="Intermediate">Intermediate</option>
                    <option value="Advanced">Advanced</option>
                  </select>
                </div>
              </div>

              <div
                className="invite-form-row"
                style={{ display: "flex", gap: "12px" }}
              >
                <div className="invite-form-field" style={{ flex: 1 }}>
                  <label>Duration</label>
                  <select
                    disabled={isSubmitting}
                    className="invite-form-input"
                    value={formDuration}
                    onChange={(e) => setFormDuration(e.target.value)}
                  >
                    <option value="4 weeks">4 weeks</option>
                    <option value="8 weeks">8 weeks</option>
                    <option value="12 weeks">12 weeks</option>
                    <option value="16 weeks">16 weeks</option>
                  </select>
                </div>

                <div className="invite-form-field" style={{ flex: 1 }}>
                  <label>Cover Image URL</label>
                  <input
                    type="url"
                    disabled={isSubmitting}
                    className="invite-form-input"
                    value={formImageUrl}
                    onChange={(e) => setFormImageUrl(e.target.value)}
                  />
                </div>
              </div>

              <div className="invite-form-field">
                <label>Description</label>
                <textarea
                  disabled={isSubmitting}
                  className="invite-form-input textarea-field"
                  rows={3}
                  value={formDescription}
                  onChange={(e) => setFormDescription(e.target.value)}
                />
              </div>

              <div className="invite-form-field">
                <label>Skills / Tags</label>
                <input
                  type="text"
                  disabled={isSubmitting}
                  className="invite-form-input"
                  value={formTags}
                  onChange={(e) => setFormTags(e.target.value)}
                />
              </div>

              <footer className="modal-popup-footer">
                <button
                  type="button"
                  disabled={isSubmitting}
                  className="modal-cancel-btn"
                  onClick={() => setIsEditModalOpen(false)}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="modal-confirm-btn"
                >
                  {isSubmitting ? "Saving..." : "Save Updates"}
                </button>
              </footer>
            </form>
          </div>
        </div>
      )}

      {/* CREATE PATH MODAL */}
      {isCreateModalOpen && (
        <div
          className="modal-backdrop-blur-overlay"
          onClick={() => !isSubmitting && setIsCreateModalOpen(false)}
        >
          <div
            className="modal-popup-container"
            onClick={(e) => e.stopPropagation()}
          >
            <header className="modal-popup-header">
              <h2>Create Learning Path</h2>
              <button
                type="button"
                disabled={isSubmitting}
                className="modal-close-icon-btn"
                onClick={() => setIsCreateModalOpen(false)}
              >
                ×
              </button>
            </header>
            <form
              onSubmit={handleCreatePathSubmit}
              className="invite-form-body"
            >
              <div className="invite-form-field">
                <label>Path Name *</label>
                <input
                  type="text"
                  required
                  disabled={isSubmitting}
                  className="invite-form-input"
                  placeholder="e.g. Cloud Engineering Fundamentals"
                  value={formName}
                  onChange={(e) => setFormName(e.target.value)}
                />
              </div>

              <div
                className="invite-form-row"
                style={{ display: "flex", gap: "12px" }}
              >
                <div className="invite-form-field" style={{ flex: 1 }}>
                  <label>Status *</label>
                  <select
                    disabled={isSubmitting}
                    className="invite-form-input"
                    value={formStatus}
                    onChange={(e) =>
                      setFormStatus(e.target.value as PathStatus)
                    }
                  >
                    <option value="Active">Active (Assignable)</option>
                    <option value="Upcoming">Upcoming (Hidden Assign)</option>
                  </select>
                </div>

                <div className="invite-form-field" style={{ flex: 1 }}>
                  <label>Difficulty</label>
                  <select
                    disabled={isSubmitting}
                    className="invite-form-input"
                    value={formDifficulty}
                    onChange={(e) =>
                      setFormDifficulty(e.target.value as PathDifficulty)
                    }
                  >
                    <option value="Beginner">Beginner</option>
                    <option value="Intermediate">Intermediate</option>
                    <option value="Advanced">Advanced</option>
                  </select>
                </div>
              </div>

              <div
                className="invite-form-row"
                style={{ display: "flex", gap: "12px" }}
              >
                <div className="invite-form-field" style={{ flex: 1 }}>
                  <label>Duration</label>
                  <select
                    disabled={isSubmitting}
                    className="invite-form-input"
                    value={formDuration}
                    onChange={(e) => setFormDuration(e.target.value)}
                  >
                    <option value="4 weeks">4 weeks</option>
                    <option value="8 weeks">8 weeks</option>
                    <option value="12 weeks">12 weeks</option>
                    <option value="16 weeks">16 weeks</option>
                  </select>
                </div>

                <div className="invite-form-field" style={{ flex: 1 }}>
                  <label>Cover Image URL</label>
                  <input
                    type="url"
                    disabled={isSubmitting}
                    className="invite-form-input"
                    placeholder="https://example.com/logo.png"
                    value={formImageUrl}
                    onChange={(e) => setFormImageUrl(e.target.value)}
                  />
                </div>
              </div>

              <div className="invite-form-field">
                <label>Description</label>
                <textarea
                  disabled={isSubmitting}
                  className="invite-form-input textarea-field"
                  rows={3}
                  placeholder="Describe learning objectives..."
                  value={formDescription}
                  onChange={(e) => setFormDescription(e.target.value)}
                />
              </div>

              <div className="invite-form-field">
                <label>Skills / Tags</label>
                <input
                  type="text"
                  disabled={isSubmitting}
                  className="invite-form-input"
                  placeholder="e.g. React, TypeScript, APIs (comma separated)"
                  value={formTags}
                  onChange={(e) => setFormTags(e.target.value)}
                />
              </div>

              <footer className="modal-popup-footer">
                <button
                  type="button"
                  disabled={isSubmitting}
                  className="modal-cancel-btn"
                  onClick={() => setIsCreateModalOpen(false)}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="modal-confirm-btn"
                >
                  {isSubmitting ? "Writing to DB..." : "Create Path"}
                </button>
              </footer>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
