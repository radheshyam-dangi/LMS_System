import React, { useState, useMemo, useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import { useNavigate } from "react-router-dom";
import {
  PieChart,
  Pie,
  Cell,
  Tooltip as RechartsTooltip,
  ResponsiveContainer
} from "recharts";
import {
  BookOpen,
  Layers,
  Users,
  Clock,
  ArrowRight,
  Search,
  X,
  Plus,
  Edit,
  Trash2,
  UserPlus,
  BarChart2,
  ChevronRight,
  CheckCircle2,
  AlertCircle,
  ExternalLink,
  FileText,
  UserCheck,
  TrendingUp,
  Award
} from "lucide-react";
import "./LearningPaths.css";
import { DeletePathModal } from "./DeletePathModal";
import { learningPathService } from "../../services/learningPathService";
import { userService } from "../../services/userService";
import { progressService } from "../../services/lmsApi";
import { useNotifications } from "../../context/NotificationContext";
import { useToast } from "../../context/ToastContext";
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
    name?: string;
    firstName?: string;
    lastName?: string;
    email?: string;
    role: RoleName;
    roles?: (RoleName | string)[];
    primaryRole?: any;
    avatarUrl?: string;
  };
  accessToken: string;
  onNavigateToModules: (pathId: string, pathName: string, traineeId?: string) => void;
  onBackToAllPaths?: () => void;
  highlightPathId?: string | null;
}

export const isUserTraineeEligible = (user: any): boolean => {
  if (!user) return false;
  const userRoles: string[] = [];

  const addRole = (r: any) => {
    if (!r) return;
    if (typeof r === "string") {
      if (r.includes(",")) {
        r.split(",").forEach((sub) => userRoles.push(sub.trim().toLowerCase()));
      } else {
        userRoles.push(r.toLowerCase());
      }
    } else if (typeof r === "object") {
      if (r.name) addRole(r.name);
      if (r.role) addRole(r.role);
      if (r.roleName) addRole(r.roleName);
      if (r.role_name) addRole(r.role_name);
      if (r.title) addRole(r.title);
      if (r.primaryRole) addRole(r.primaryRole);
    }
  };

  addRole(user.role);
  addRole(user.primaryRole);
  addRole(user.primary_role);
  addRole(user.roleName);
  addRole(user.role_name);
  addRole(user.activeRole);

  if (Array.isArray(user.roles)) {
    user.roles.forEach(addRole);
  }
  if (Array.isArray(user.userRoles)) {
    user.userRoles.forEach(addRole);
  }
  if (Array.isArray(user.secondaryRoles)) {
    user.secondaryRoles.forEach(addRole);
  }
  if (Array.isArray(user.allRoles)) {
    user.allRoles.forEach(addRole);
  }

  return userRoles.some(
    (r) =>
      r === "trainee" ||
      r === "learner" ||
      r === "student" ||
      r.includes("trainee") ||
      r.includes("learner") ||
      r.includes("student")
  );
};

interface TraineeUser {
  id: string;
  name?: string;
  firstName?: string;
  lastName?: string;
  email: string;
  avatarUrl?: string;
  imageUrl?: string;
  roles?: any[];
  primaryRole?: any;
}

type FilterScope = "All" | "Mine" | "Active" | "Upcoming" | "Completed";
type SortOption = "recent" | "title" | "trainees" | "progress";

/* ==========================================================================
   HELPER UTILITIES
   ========================================================================== */

const formatDuration = (d?: string) => {
  if (!d) return "12 weeks";
  const trimmed = d.trim();
  if (/^1\s*weeks?$/i.test(trimmed)) return "1 week";
  return trimmed;
};

const getTraineeInitials = (
  firstName?: string,
  lastName?: string,
  fullName?: string,
  email?: string
): string => {
  const f = firstName && firstName !== "undefined" ? firstName.trim() : "";
  const l = lastName && lastName !== "undefined" ? lastName.trim() : "";

  // 1. If distinct first and last names exist: first character of each
  if (f && l) {
    return `${f[0]}${l[0]}`.toUpperCase();
  }
  if (f) {
    return f.length >= 2 ? f.slice(0, 2).toUpperCase() : f.toUpperCase();
  }
  if (l) {
    return l.length >= 2 ? l.slice(0, 2).toUpperCase() : l.toUpperCase();
  }

  // 2. Parse from fullName if distinct fields were not provided
  const cleanName =
    fullName &&
    fullName !== "undefined" &&
    fullName !== "undefined undefined"
      ? fullName.trim()
      : "";

  if (cleanName) {
    const parts = cleanName
      .split(/\s+/)
      .filter((p) => p && p.toLowerCase() !== "undefined");
    if (parts.length >= 2) {
      return `${parts[0][0]}${parts[parts.length - 1][0]}`.toUpperCase();
    }
    if (parts.length === 1 && parts[0].length >= 2) {
      return parts[0].slice(0, 2).toUpperCase();
    }
    if (parts.length === 1) {
      return parts[0][0].toUpperCase();
    }
  }

  // 3. Fallback to email handle (e.g. catherine.fritsch@ethereal.email -> CF)
  if (email && email.includes("@")) {
    const handle = email.split("@")[0] || "";
    const emailParts = handle
      .split(/[._-]/)
      .filter((p) => p && p.toLowerCase() !== "undefined");
    if (emailParts.length >= 2 && emailParts[0] && emailParts[1]) {
      return `${emailParts[0][0]}${emailParts[1][0]}`.toUpperCase();
    }
    if (handle.length >= 2) {
      return handle.slice(0, 2).toUpperCase();
    }
    if (handle.length === 1) {
      return handle.toUpperCase();
    }
  }

  return "TR";
};

// Backwards-compatible alias
const getInitials = (name?: string, email?: string): string =>
  getTraineeInitials(undefined, undefined, name, email);

const highlightMatch = (text: string, highlight: string) => {
  if (!highlight.trim() || !text) {
    return <span>{text}</span>;
  }
  const regex = new RegExp(`(${highlight.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})`, "gi");
  const parts = text.split(regex);
  return (
    <span>
      {parts.map((part, i) =>
        regex.test(part) ? (
          <mark
            key={i}
            style={{
              padding: "0 2px",
              borderRadius: "3px",
              backgroundColor: "rgba(79, 70, 229, 0.15)",
              color: "#4f46e5",
              fontWeight: 600,
            }}
          >
            {part}
          </mark>
        ) : (
          <span key={i}>{part}</span>
        )
      )}
    </span>
  );
};

/* ==========================================================================
   MODAL: FULL DESCRIPTION VIEWER
   ========================================================================== */

const DescriptionModal = ({
  title,
  description,
  onClose,
}: {
  title: string;
  description: string;
  onClose: () => void;
}) => {
  useScrollLock(true);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [onClose]);

  const modalContent = (
    <div className="cohort-modal-overlay" onClick={onClose}>
      <div
        className="cohort-modal-card"
        style={{ maxWidth: "560px" }}
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-labelledby="desc-modal-title"
      >
        <div className="cohort-modal-header">
          <div className="cohort-modal-title-group">
            <h2 id="desc-modal-title">{title}</h2>
            <p className="cohort-modal-subtitle">Full Track Description & Overview</p>
          </div>
          <button
            className="cohort-modal-close-btn"
            onClick={onClose}
            aria-label="Close modal"
          >
            &times;
          </button>
        </div>
        <div className="cohort-modal-body">
          <p
            style={{
              margin: 0,
              whiteSpace: "pre-wrap",
              color: "#334155",
              fontSize: "14px",
              lineHeight: 1.65,
              wordBreak: "break-word",
            }}
          >
            {description}
          </p>
        </div>
        <div style={{ padding: "14px 22px", borderTop: "1px solid #e2e8f0", display: "flex", justifyContent: "flex-end" }}>
          <button
            onClick={onClose}
            style={{
              padding: "8px 16px",
              background: "#f1f5f9",
              color: "#334155",
              borderRadius: "8px",
              border: "1px solid #cbd5e1",
              fontWeight: 600,
              fontSize: "13px",
              cursor: "pointer",
            }}
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );

  return createPortal(modalContent, document.body);
};

/* ==========================================================================
   COMPONENT: EXPANDABLE CARD DESCRIPTION
   Smooth, content-adaptive toggle that expands and shrinks with text
   ========================================================================== */

const ExpandableDescription = ({
  title,
  description,
}: {
  title: string;
  description: string;
}) => {
  const [isExpanded, setIsExpanded] = useState(false);
  const [isModalOpen, setIsModalOpen] = useState(false);

  const plainText = useMemo(() => {
    if (!description) return "";
    return description.replace(/<[^>]*>?/gm, "").replace(/&nbsp;/g, " ").trim();
  }, [description]);

  const textToDisplay = plainText || "No track description provided.";
  const isLong = textToDisplay.length > 130;

  return (
    <div className="expandable-description-container" onClick={(e) => e.stopPropagation()}>
      <p className={`card-description-string ${!isExpanded && isLong ? "is-clamped" : ""}`}>
        {textToDisplay}
      </p>
      {isLong && (
        <div style={{ display: "flex", gap: "10px", marginTop: "4px" }}>
          <button
            type="button"
            className="expand-toggle-btn"
            onClick={(e) => {
              e.stopPropagation();
              setIsExpanded(!isExpanded);
            }}
          >
            {isExpanded ? "Show less ↑" : "Show more ↓"}
          </button>
          {textToDisplay.length > 250 && (
            <button
              type="button"
              className="expand-toggle-btn"
              style={{ color: "#64748b" }}
              onClick={(e) => {
                e.stopPropagation();
                setIsModalOpen(true);
              }}
            >
              Full dialog ↗
            </button>
          )}
        </div>
      )}

      {isModalOpen && (
        <DescriptionModal
          title={title}
          description={textToDisplay}
          onClose={() => setIsModalOpen(false)}
        />
      )}
    </div>
  );
};

/* ==========================================================================
   SKELETON LOADERS
   ========================================================================== */

const LearningPathSkeletonCard = () => (
  <div className="learning-path-skeleton-card" aria-hidden="true">
    <div className="skeleton-header-row">
      <div className="skeleton-shimmer skeleton-icon-box" />
      <div className="skeleton-badges-box">
        <div className="skeleton-shimmer skeleton-pill" />
        <div className="skeleton-shimmer skeleton-pill" />
      </div>
    </div>
    <div className="skeleton-shimmer skeleton-title-bar" />
    <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
      <div className="skeleton-shimmer skeleton-desc-bar" />
      <div className="skeleton-shimmer skeleton-desc-bar-short" />
    </div>
    <div className="skeleton-tags-cluster">
      <div className="skeleton-shimmer skeleton-tag-pill" />
      <div className="skeleton-shimmer skeleton-tag-pill" />
      <div className="skeleton-shimmer skeleton-tag-pill" />
    </div>
    <div className="skeleton-shimmer skeleton-scope-box" />
    <div className="skeleton-shimmer skeleton-cohort-box" />
    <div className="skeleton-action-toolbar">
      <div className="skeleton-shimmer skeleton-btn-primary" />
      <div className="skeleton-shimmer skeleton-btn-icon" />
      <div className="skeleton-shimmer skeleton-btn-icon" />
    </div>
  </div>
);

const TraineeRowSkeleton = () => (
  <div
    style={{
      display: "flex",
      alignItems: "center",
      justifyContent: "space-between",
      padding: "10px 12px",
      borderRadius: "6px",
      border: "1px solid #e2e8f0",
      marginBottom: "6px",
    }}
  >
    <div style={{ display: "flex", alignItems: "center", gap: "10px", flex: 1 }}>
      <div className="skeleton-shimmer" style={{ width: "16px", height: "16px", borderRadius: "4px" }} />
      <div style={{ display: "flex", flexDirection: "column", gap: "4px", flex: 1 }}>
        <div className="skeleton-shimmer" style={{ width: "120px", height: "14px" }} />
        <div className="skeleton-shimmer" style={{ width: "180px", height: "11px" }} />
      </div>
    </div>
  </div>
);

/* ==========================================================================
   MAIN COMPONENT: LearningPathsSection
   ========================================================================== */

export function LearningPathsSection({
  currentUser,
  accessToken,
  onNavigateToModules,
  highlightPathId,
}: LearningPathsSectionProps) {
  const navigate = useNavigate();
  const toast = useToast();
  const { refresh: refreshNotifications } = useNotifications();

  const isAdmin = currentUser.role === "Admin";
  const isTrainer = currentUser.role === "Trainer";
  const isTrainee = currentUser.role === "Trainee";

  // Data States
  const [paths, setPaths] = useState<LearningPath[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [progressSummary, setProgressSummary] = useState<
    Record<
      string,
      {
        userProgressPercent: number;
        cohortProgressPercent: number;
        enrolledCount: number;
        totalModules?: number;
        moduleProgresses?: Record<string, number>;
        totalLessons?: number;
        totalAssignments?: number;
      }
    >
  >({});

  // Filter, Search & Sort
  const [activeScope, setActiveScope] = useState<FilterScope>("All");
  const [searchQuery, setSearchQuery] = useState("");
  const [debouncedSearchQuery, setDebouncedSearchQuery] = useState("");
  const [sortBy, setSortBy] = useState<SortOption>("recent");

  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearchQuery(searchQuery);
    }, 250);
    return () => clearTimeout(timer);
  }, [searchQuery]);

  // Cohort Inspection Modal States
  const [selectedPathForTrainees, setSelectedPathForTrainees] = useState<string | null>(null);
  const [lpTraineesProgress, setLpTraineesProgress] = useState<any>(null);
  const [isLoadingLpProgress, setIsLoadingLpProgress] = useState(false);
  const [cohortSearchQuery, setCohortSearchQuery] = useState("");
  const [expandedTraineeId, setExpandedTraineeId] = useState<string | null>(null);

  // Trainee Assignment Modal States
  const [isAssignModalOpen, setIsAssignModalOpen] = useState(false);
  const [selectedPathForAssignment, setSelectedPathForAssignment] = useState<LearningPath | null>(null);
  const [allTrainees, setAllTrainees] = useState<TraineeUser[]>([]);
  const allFetchedUsersRef = useRef<any[]>([]);
  const [newlySelectedTraineeIds, setNewlySelectedTraineeIds] = useState<string[]>([]);
  const [traineeSearchQuery, setTraineeSearchQuery] = useState("");
  const [isLoadingTrainees, setIsLoadingTrainees] = useState(false);
  const [isSubmittingAssignment, setIsSubmittingAssignment] = useState(false);

  // Delete Track Modal State
  const [deleteTarget, setDeleteTarget] = useState<LearningPath | null>(null);
  const [isDeletingPath, setIsDeletingPath] = useState(false);

  /* ==========================================================================
     DATA FETCHING
     ========================================================================== */

  const loadDatabasePaths = async () => {
    setIsLoading(true);
    setErrorMessage(null);
    try {
      const [data, summary] = await Promise.all([
        learningPathService.fetchAllPaths(accessToken),
        progressService.fetchPathProgressSummary(accessToken).catch(() => ({})),
      ]);
      setPaths(data || []);
      setProgressSummary(summary || {});
    } catch (err: any) {
      setErrorMessage(
        err.message ?? "Failed to synchronize learning paths with database."
      );
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadDatabasePaths();
  }, [accessToken]);

  // Load eligible trainees for Trainer / Admin assignment
  useEffect(() => {
    if (isAdmin || isTrainer) {
      userService
        .fetchAllUsers(accessToken)
        .then((rawUsersList: any) => {
          const rawUsers: any[] = Array.isArray(rawUsersList) ? rawUsersList : [];
          allFetchedUsersRef.current = rawUsers;

          const userLookupMap = new Map<string, any>();
          rawUsers.forEach((u: any) => {
            if (u.id) userLookupMap.set(String(u.id).toLowerCase(), u);
            if (u.email) userLookupMap.set(String(u.email).toLowerCase(), u);
          });

          // Check local stored session roles for currentUser as supplementary fallback
          let storedUserRoles: string[] = [];
          try {
            const savedStr = localStorage.getItem("skillforge_user");
            if (savedStr) {
              const parsed = JSON.parse(savedStr);
              if (Array.isArray(parsed.roles)) storedUserRoles.push(...parsed.roles);
              if (parsed.primaryRole) storedUserRoles.push(parsed.primaryRole);
              if (parsed.role) storedUserRoles.push(parsed.role);
              if (parsed.activeRole) storedUserRoles.push(parsed.activeRole);
            }
            const activeRoleStr = localStorage.getItem("skillforge_active_role");
            if (activeRoleStr) storedUserRoles.push(activeRoleStr);
          } catch (e) {}

          const currentUserHasTrainee =
            isUserTraineeEligible(currentUser) ||
            storedUserRoles.some((r) => /trainee|learner|student/i.test(String(r)));

          // Collect user IDs that are enrolled in any learning path
          const enrolledTraineeIds = new Set<string>();
          (paths || []).forEach((p) => {
            if (Array.isArray(p.assignedToTraineeIds)) {
              p.assignedToTraineeIds.forEach((id) => {
                if (id) enrolledTraineeIds.add(String(id).toLowerCase());
              });
            }
          });

          // Collect creator IDs across all learning paths
          const ownerUserIds = new Set<string>();
          (paths || []).forEach((p) => {
            const cId = p.createdBy?.id || (typeof p.createdBy === "string" ? p.createdBy : null) || (p as any).createdById;
            if (cId) ownerUserIds.add(String(cId).toLowerCase());
          });

          const eligible: TraineeUser[] = rawUsers
            .map((user: any): TraineeUser => ({
              id: user.id,
              name: user.name || `${user.firstName || ""} ${user.lastName || ""}`.trim() || user.email,
              firstName: user.firstName,
              lastName: user.lastName,
              email: user.email,
              avatarUrl: user.avatarUrl,
              roles: user.roles,
              primaryRole: user.primaryRole,
            }))
            .filter((user: any) => {
              const uid = String(user.id || "").toLowerCase();
              const uEmail = String(user.email || "").toLowerCase();

              // 1. If this is currentUser and currentUser has trainee role (for ownself)
              const isMatchCurrentUser =
                (currentUser.id && uid === String(currentUser.id).toLowerCase()) ||
                (currentUser.email && uEmail === String(currentUser.email).toLowerCase());
              if (isMatchCurrentUser && currentUserHasTrainee) {
                return true;
              }

              // 2. Direct trainee role check
              if (isUserTraineeEligible(user)) {
                return true;
              }

              // 3. User is already enrolled in any learning path as a trainee
              if (enrolledTraineeIds.has(uid)) {
                return true;
              }

              // 4. User is an owner/creator of any path and that user has trainee role
              if (ownerUserIds.has(uid)) {
                const dbUser = userLookupMap.get(uid);
                if (dbUser && isUserTraineeEligible(dbUser)) {
                  return true;
                }
              }

              return false;
            });

          // Ensure current user is present if they have trainee role (for ownself)
          if (currentUserHasTrainee && currentUser.id) {
            const alreadyIncluded = eligible.some(
              (u: any) =>
                String(u.id).toLowerCase() === String(currentUser.id).toLowerCase() ||
                (currentUser.email && String(u.email || "").toLowerCase() === String(currentUser.email).toLowerCase())
            );

            if (!alreadyIncluded) {
              eligible.unshift({
                id: currentUser.id,
                name: currentUser.name || `${currentUser.firstName || ""} ${currentUser.lastName || ""}`.trim() || currentUser.email,
                firstName: currentUser.firstName,
                lastName: currentUser.lastName,
                email: currentUser.email || "",
                avatarUrl: currentUser.avatarUrl,
                roles: currentUser.roles,
                primaryRole: currentUser.primaryRole,
              });
            }
          }

          // Ensure all path owners/creators who have trainee role are visible to all trainers
          (paths || []).forEach((p) => {
            const cId = p.createdBy?.id || (typeof p.createdBy === "string" ? p.createdBy : null) || (p as any).createdById;
            const cEmail = typeof p.createdBy === "object" ? p.createdBy?.email : null;
            const dbCreator = (cId && userLookupMap.get(String(cId).toLowerCase())) || (cEmail && userLookupMap.get(String(cEmail).toLowerCase()));
            const creatorObj = dbCreator || (typeof p.createdBy === "object" ? p.createdBy : null);

            if (creatorObj && creatorObj.id && (isUserTraineeEligible(creatorObj) || (dbCreator && isUserTraineeEligible(dbCreator)))) {
              const creatorId = String(creatorObj.id).toLowerCase();
              const creatorEmail = String(creatorObj.email || "").toLowerCase();
              const alreadyIncluded = eligible.some(
                (u: any) =>
                  String(u.id).toLowerCase() === creatorId ||
                  (creatorEmail && String(u.email || "").toLowerCase() === creatorEmail)
              );
              if (!alreadyIncluded) {
                eligible.push({
                  id: creatorObj.id,
                  name: `${creatorObj.firstName || ""} ${creatorObj.lastName || ""}`.trim() || creatorObj.name || creatorObj.email,
                  firstName: creatorObj.firstName,
                  lastName: creatorObj.lastName,
                  email: creatorObj.email || "",
                  avatarUrl: creatorObj.avatarUrl,
                  roles: creatorObj.roles,
                  primaryRole: creatorObj.primaryRole,
                });
              }
            }
          });

          setAllTrainees(eligible);
        })
        .catch(() => {});
    }
  }, [accessToken, isAdmin, isTrainer, currentUser, paths]);

  // Load Cohort details when a specific path modal is triggered
  useEffect(() => {
    if (selectedPathForTrainees) {
      setIsLoadingLpProgress(true);
      setCohortSearchQuery("");
      setExpandedTraineeId(null);
      learningPathService
        .fetchLearningPathTraineesProgress(selectedPathForTrainees, accessToken)
        .then((data) => setLpTraineesProgress(data))
        .catch((err) => {
          console.error("Failed to fetch LP cohort progress", err);
          toast.error("Unable to load cohort progression data.");
        })
        .finally(() => setIsLoadingLpProgress(false));
    } else {
      setLpTraineesProgress(null);
      setExpandedTraineeId(null);
    }
  }, [selectedPathForTrainees, accessToken]);

  /* ==========================================================================
     CALCULATIONS & ATTRIBUTION HELPERS
     ========================================================================== */

  // Trainee role calculation (Preserved 100% without regression)
  const calculateLPProgress = (path: LearningPath): number => {
    const summary = progressSummary[path.id];
    const totalModules = path.modules?.length ?? summary?.totalModules ?? 0;

    if (totalModules === 0) return 0;

    if (summary?.moduleProgresses && path.modules && Array.isArray(path.modules) && path.modules.length > 0) {
      const sum = path.modules.reduce((acc: number, mod: any) => {
        return acc + (summary.moduleProgresses?.[mod.id] ?? 0);
      }, 0);
      return Math.min(100, Math.round(sum / totalModules));
    }

    if (typeof summary?.userProgressPercent === "number") {
      return summary.userProgressPercent;
    }

    if (path.modules && Array.isArray(path.modules) && path.modules.length > 0) {
      const sum = path.modules.reduce((acc: number, mod: any) => {
        return acc + Number(mod.progressPercent ?? mod.completionPercent ?? 0);
      }, 0);
      return Math.min(100, Math.round(sum / totalModules));
    }

    return (path as any).progressPercent ?? 0;
  };

  // Check creator identity
  const getCreatorId = (path: LearningPath): string | null => {
    return (
      path.createdBy?.id ||
      (typeof path.createdBy === "string" ? path.createdBy : null) ||
      (path as any).createdById ||
      (path as any).userId ||
      null
    );
  };

  const getCreatorEmail = (path: LearningPath): string | null => {
    if (path.createdBy && typeof path.createdBy === "object" && (path.createdBy as any).email) {
      return String((path.createdBy as any).email).toLowerCase();
    }
    return null;
  };

  const isCurrentAuthor = (path: LearningPath): boolean => {
    const cid = getCreatorId(path);
    if (!cid || !currentUser.id) return false;
    return String(cid).toLowerCase() === String(currentUser.id).toLowerCase();
  };

  const getCreatorDisplayName = (path: LearningPath): string => {
    if (isCurrentAuthor(path)) return "You";
    if (path.createdBy && typeof path.createdBy === "object") {
      const name = `${path.createdBy.firstName || ""} ${path.createdBy.lastName || ""}`.trim();
      if (name) return name;
      if (path.createdBy.name) return path.createdBy.name;
      if (path.createdBy.email) return path.createdBy.email;
    }
    return "Curriculum Admin";
  };

  // Cohort Metrics Aggregation
  const getPathMetrics = (path: LearningPath) => {
    const summary = progressSummary[path.id];
    const enrolledCount = path.assignedToTraineeIds?.length ?? summary?.enrolledCount ?? 0;
    const cohortProgress = summary?.cohortProgressPercent ?? 0;

    const modulesCount = path.modules?.length ?? summary?.totalModules ?? 0;

    const lessonsCount =
      summary?.totalLessons ??
      path.modules?.reduce((acc: number, m: any) => acc + (m.lessons?.length || 0), 0) ??
      0;

    const tasksCount =
      summary?.totalAssignments ??
      path.modules?.reduce(
        (acc: number, m: any) =>
          acc +
          (m.assignments?.length || 0) +
          (m.lessons?.reduce((a: number, l: any) => a + (l.assignments?.length || 0), 0) || 0),
        0
      ) ??
      0;

    return {
      enrolledCount,
      cohortProgress,
      modulesCount,
      lessonsCount,
      tasksCount,
    };
  };

  /* ==========================================================================
     FILTERING & SORTING LOGIC
     ========================================================================== */

  // Helper to verify if a path is assigned to the current trainee
  const isPathAssignedToCurrentTrainee = (path: LearningPath): boolean => {
    if (!Array.isArray(path.assignedToTraineeIds)) return false;
    const curId = String(currentUser.id || "").toLowerCase();
    const curEmail = String(currentUser.email || "").toLowerCase();
    return path.assignedToTraineeIds.some((id: string) => {
      const str = String(id).toLowerCase();
      return str === curId || (curEmail && str === curEmail);
    });
  };

  // Trainee-scoped base paths (or all paths for trainers/admins)
  const accessiblePaths = useMemo(() => {
    if (isTrainee) {
      return paths.filter((p) => isPathAssignedToCurrentTrainee(p));
    }
    return paths;
  }, [paths, isTrainee, currentUser.id, currentUser.email]);

  const allTracksCount = useMemo(() => {
    return accessiblePaths.length;
  }, [accessiblePaths]);

  const myAuthoredTracksCount = useMemo(() => {
    return paths.filter((p) => isCurrentAuthor(p)).length;
  }, [paths, currentUser.id]);

  const activePathsCount = useMemo(() => {
    if (isTrainee) {
      return accessiblePaths.filter((p) => {
        const prog = calculateLPProgress(p);
        return prog < 100 && (p.status || "Active").toLowerCase() !== "upcoming";
      }).length;
    }
    return paths.filter((p) => (p.status || "Active").toLowerCase() === "active").length;
  }, [accessiblePaths, paths, isTrainee, progressSummary]);

  const upcomingPathsCount = useMemo(() => {
    return accessiblePaths.filter((p) => (p.status || "").toLowerCase() === "upcoming").length;
  }, [accessiblePaths]);

  const completedPathsCount = useMemo(() => {
    if (!isTrainee) return 0;
    return accessiblePaths.filter((p) => calculateLPProgress(p) === 100).length;
  }, [accessiblePaths, isTrainee, progressSummary]);

  const totalEnrolledAcrossTracks = useMemo(() => {
    const uniqueIds = new Set<string>();
    paths.forEach((p) => {
      (p.assignedToTraineeIds || []).forEach((id) => uniqueIds.add(id));
    });
    return uniqueIds.size;
  }, [paths]);

  const avgCohortProgressOverall = useMemo(() => {
    const activePaths = paths.filter((p) => (p.status || "Active").toLowerCase() === "active");
    if (activePaths.length === 0) return 0;
    const sum = activePaths.reduce((acc, p) => acc + (progressSummary[p.id]?.cohortProgressPercent || 0), 0);
    return Math.round(sum / activePaths.length);
  }, [paths, progressSummary]);

  const filteredPaths = useMemo(() => {
    let result = accessiblePaths;

    if (highlightPathId) {
      result = result.filter((p) => p.id === highlightPathId);
    }

    result = result.filter((path) => {
      // Scope Tab Filtering
      if (activeScope === "Mine") {
        if (!isCurrentAuthor(path)) return false;
      } else if (activeScope === "Active") {
        if (isTrainee) {
          const prog = calculateLPProgress(path);
          if (prog === 100 || path.status?.toLowerCase() === "upcoming") return false;
        } else {
          if (path.status?.toLowerCase() !== "active") return false;
        }
      } else if (activeScope === "Upcoming") {
        if (path.status?.toLowerCase() !== "upcoming") return false;
      } else if (activeScope === "Completed") {
        if (isTrainee && calculateLPProgress(path) !== 100) return false;
      }

      // Search Query Matching
      const q = debouncedSearchQuery.trim().toLowerCase();
      if (q) {
        const title = (path.title || path.name || "").toLowerCase();
        const desc = (path.description || "").toLowerCase();

        let tags: string[] = [];
        if (Array.isArray(path.skillsTags)) {
          tags = path.skillsTags;
        } else if (typeof path.skillsTags === "string") {
          tags = (path.skillsTags as string).split(",").map((t) => t.trim());
        }

        const titleMatch = title.includes(q);
        const descMatch = desc.includes(q);
        const tagsMatch = tags.some((t) => t.toLowerCase().includes(q));

        if (!titleMatch && !descMatch && !tagsMatch) {
          return false;
        }
      }

      return true;
    });

    // Sorting
    return [...result].sort((a, b) => {
      if (sortBy === "title") {
        return (a.title || a.name || "").localeCompare(b.title || b.name || "");
      }
      if (sortBy === "trainees") {
        const aCount = a.assignedToTraineeIds?.length || 0;
        const bCount = b.assignedToTraineeIds?.length || 0;
        return bCount - aCount;
      }
      if (sortBy === "progress") {
        const aProg = isTrainee
          ? calculateLPProgress(a)
          : progressSummary[a.id]?.cohortProgressPercent || 0;
        const bProg = isTrainee
          ? calculateLPProgress(b)
          : progressSummary[b.id]?.cohortProgressPercent || 0;
        return bProg - aProg;
      }
      // default: recent / original order
      return 0;
    });
  }, [
    paths,
    highlightPathId,
    activeScope,
    isTrainee,
    currentUser.id,
    debouncedSearchQuery,
    sortBy,
    progressSummary,
  ]);

  /* ==========================================================================
     MUTATION ACTIONS
     ========================================================================== */

  // Open Assign Modal
  const handleOpenAssignModal = async (path: LearningPath) => {
    setSelectedPathForAssignment(path);
    setNewlySelectedTraineeIds([]);
    setTraineeSearchQuery("");
    setIsAssignModalOpen(true);
    setIsLoadingTrainees(true);

    try {
      const rawUsersList: any = await userService.fetchAllUsers(accessToken);
      const rawUsers: any[] = Array.isArray(rawUsersList) ? rawUsersList : [];
      allFetchedUsersRef.current = rawUsers;

      const userLookupMap = new Map<string, any>();
      rawUsers.forEach((u: any) => {
        if (u.id) userLookupMap.set(String(u.id).toLowerCase(), u);
        if (u.email) userLookupMap.set(String(u.email).toLowerCase(), u);
      });

      let storedUserRoles: string[] = [];
      try {
        const savedStr = localStorage.getItem("skillforge_user");
        if (savedStr) {
          const parsed = JSON.parse(savedStr);
          if (Array.isArray(parsed.roles)) storedUserRoles.push(...parsed.roles);
          if (parsed.primaryRole) storedUserRoles.push(parsed.primaryRole);
          if (parsed.role) storedUserRoles.push(parsed.role);
          if (parsed.activeRole) storedUserRoles.push(parsed.activeRole);
        }
        const activeRoleStr = localStorage.getItem("skillforge_active_role");
        if (activeRoleStr) storedUserRoles.push(activeRoleStr);
      } catch (e) {}

      const currentUserHasTrainee =
        isUserTraineeEligible(currentUser) ||
        storedUserRoles.some((r) => /trainee|learner|student/i.test(String(r)));

      const creator = path.createdBy;
      const creatorId =
        creator?.id ||
        (typeof creator === "string" ? creator : null) ||
        (path as any).createdById;
      const creatorEmail = typeof creator === "object" ? creator?.email : null;

      const dbCreator =
        (creatorId && userLookupMap.get(String(creatorId).toLowerCase())) ||
        (creatorEmail && userLookupMap.get(String(creatorEmail).toLowerCase()));
      const creatorObj = dbCreator || (typeof creator === "object" ? creator : null);

      const creatorHasTrainee =
        (creatorObj && isUserTraineeEligible(creatorObj)) ||
        (dbCreator && isUserTraineeEligible(dbCreator)) ||
        (creator && isUserTraineeEligible(creator));

      // Collect user IDs that are enrolled in any learning path
      const enrolledTraineeIds = new Set<string>();
      (paths || []).forEach((p) => {
        if (Array.isArray(p.assignedToTraineeIds)) {
          p.assignedToTraineeIds.forEach((id) => {
            if (id) enrolledTraineeIds.add(String(id).toLowerCase());
          });
        }
      });

      const eligible: TraineeUser[] = rawUsers
        .map((user: any): TraineeUser => ({
          id: user.id,
          name:
            user.name ||
            `${user.firstName || ""} ${user.lastName || ""}`.trim() ||
            user.email,
          firstName: user.firstName,
          lastName: user.lastName,
          email: user.email,
          avatarUrl: user.avatarUrl,
          roles: user.roles,
          primaryRole: user.primaryRole,
        }))
        .filter((user: any) => {
          const uid = String(user.id || "").toLowerCase();
          const uEmail = String(user.email || "").toLowerCase();

          // 1. Current user with trainee role (for ownself)
          const isMatchCurrentUser =
            (currentUser.id && uid === String(currentUser.id).toLowerCase()) ||
            (currentUser.email && uEmail === String(currentUser.email).toLowerCase());
          if (isMatchCurrentUser && currentUserHasTrainee) {
            return true;
          }

          // 2. Direct trainee role check
          if (isUserTraineeEligible(user)) {
            return true;
          }

          // 3. User is already enrolled in any learning path as a trainee
          if (enrolledTraineeIds.has(uid)) {
            return true;
          }

          // 4. Current learning path creator with trainee role (for other trainers)
          const isPathCreator =
            (creatorId && uid === String(creatorId).toLowerCase()) ||
            (creatorEmail && uEmail === String(creatorEmail).toLowerCase());
          if (isPathCreator && creatorHasTrainee) {
            return true;
          }

          return false;
        });

      // Ensure current user is included if they have trainee role (for ownself)
      if (currentUserHasTrainee && currentUser?.id) {
        const cId = String(currentUser.id).toLowerCase();
        const cEmail = String(currentUser.email || "").toLowerCase();
        const exists = eligible.some(
          (u) =>
            String(u.id).toLowerCase() === cId ||
            (cEmail && String(u.email || "").toLowerCase() === cEmail)
        );
        if (!exists) {
          const cleanName =
            `${currentUser.firstName || ""} ${currentUser.lastName || ""}`.trim() ||
            currentUser.name ||
            currentUser.email;
          eligible.unshift({
            id: currentUser.id,
            name: cleanName,
            firstName: currentUser.firstName,
            lastName: currentUser.lastName,
            email: currentUser.email || "",
            avatarUrl: currentUser.avatarUrl,
            roles: currentUser.roles,
            primaryRole: currentUser.primaryRole,
          });
        }
      }

      // Ensure path creator is included if they have trainee role (for other trainers)
      if (creatorHasTrainee && creatorObj && creatorObj.id) {
        const cId = String(creatorObj.id).toLowerCase();
        const cEmail = String(creatorObj.email || "").toLowerCase();
        const exists = eligible.some(
          (u) =>
            String(u.id).toLowerCase() === cId ||
            (cEmail && String(u.email || "").toLowerCase() === cEmail)
        );
        if (!exists) {
          const cleanName =
            `${creatorObj.firstName || ""} ${creatorObj.lastName || ""}`.trim() ||
            creatorObj.name ||
            creatorObj.email;
          eligible.unshift({
            id: creatorObj.id,
            name: cleanName,
            firstName: creatorObj.firstName,
            lastName: creatorObj.lastName,
            email: creatorObj.email || "",
            avatarUrl: creatorObj.avatarUrl,
            roles: creatorObj.roles,
            primaryRole: creatorObj.primaryRole,
          });
        }
      }

      setAllTrainees(eligible);
    } catch (err) {
      console.error("Failed to load trainees in assign modal", err);
    } finally {
      setIsLoadingTrainees(false);
    }
  };

  const handleToggleTrainee = (traineeId: string) => {
    setNewlySelectedTraineeIds((prev) =>
      prev.includes(traineeId)
        ? prev.filter((id) => id !== traineeId)
        : [...prev, traineeId]
    );
  };

  const handleSelectAllAvailableTrainees = () => {
    if (!selectedPathForAssignment) return;
    const assignedIdsSet = new Set(
      (selectedPathForAssignment.assignedToTraineeIds || []).map((id: any) => String(id).toLowerCase())
    );
    const availableIds = allTrainees
      .filter((t) => !assignedIdsSet.has(String(t.id).toLowerCase()))
      .map((t) => t.id);
    setNewlySelectedTraineeIds(availableIds);
  };

  const handleDeselectAllTrainees = () => {
    setNewlySelectedTraineeIds([]);
  };

  const handleConfirmAssignment = async () => {
    if (!selectedPathForAssignment || newlySelectedTraineeIds.length === 0) return;

    setIsSubmittingAssignment(true);
    try {
      const updatedPath = await learningPathService.assignTraineeToPath(
        selectedPathForAssignment.id,
        newlySelectedTraineeIds,
        accessToken
      );

      setPaths((prev) =>
        prev.map((p) =>
          p.id === selectedPathForAssignment.id
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
            : p
        )
      );

      setIsAssignModalOpen(false);
      await refreshNotifications();
      toast.success(
        `Successfully assigned ${newlySelectedTraineeIds.length} ${
          newlySelectedTraineeIds.length === 1 ? "trainee" : "trainees"
        } to track.`
      );
    } catch (err: any) {
      toast.error(err.message ?? "Failed to assign trainees to track.");
    } finally {
      setIsSubmittingAssignment(false);
    }
  };

  // Delete Track - opens custom confirmation modal
  const handleDeleteClick = (path: LearningPath) => {
    setDeleteTarget(path);
  };

  const handleConfirmDelete = async () => {
    if (!deleteTarget) return;
    const pathTitle = deleteTarget.title || deleteTarget.name || "Untitled Track";
    setIsDeletingPath(true);
    try {
      await learningPathService.deletePath(deleteTarget.id, accessToken);
      setPaths((prev) => prev.filter((p) => p.id !== deleteTarget.id));
      toast.success(`Track "${pathTitle}" has been removed.`);
      setDeleteTarget(null);
    } catch (err: any) {
      toast.error(err.message ?? "Failed to delete Learning Path.");
    } finally {
      setIsDeletingPath(false);
    }
  };

  /* ==========================================================================
     RENDER
     ========================================================================== */

  return (
    <div className="learning-paths-management-container">
      {/* 1. INSTRUCTIONAL WORKSPACE HEADER */}
      <header className="learning-paths-header-row">
        <div className="learning-paths-header-left">
          <h1 className="learning-paths-main-title">Learning Paths</h1>
          <p className="learning-paths-sub-heading">
            {isTrainee
              ? ""
              : ""}
          </p>
        </div>

        {(isAdmin || isTrainer) && (
          <div className="learning-paths-header-actions">
            <button
              type="button"
              className="btn-create-learning-path"
              onClick={() => navigate("/learning-paths/new")}
              title="Create a new curriculum track"
            >
              <Plus size={16} strokeWidth={2} />
              <span>Create Learning Path</span>
            </button>
          </div>
        )}
      </header>

      {/* 2. INTERACTIVE METRICS STRIP (CLICKABLE FILTER COUNTERS) */}
      {!isTrainer && !isTrainee && (
        <section className="learning-paths-metrics-grid" aria-label="Learning path quick metrics">
          {/* Metric 1: Total Tracks */}
          <div
            className={`lp-metric-card ${activeScope === "All" && !searchQuery ? "active-metric-filter" : ""}`}
            onClick={() => {
              setActiveScope("All");
              setSearchQuery("");
            }}
            role="button"
            tabIndex={0}
          >
            {!isTrainee && (
              <div className="lp-metric-icon-box">
                <BookOpen size={18} />
              </div>
            )}
            <div className="lp-metric-content">
              <span className="lp-metric-label">All Tracks</span>
              <div className="lp-metric-value-row">
                <span className="lp-metric-number">{paths.length}</span>
                <span className="lp-metric-subtext">total</span>
              </div>
            </div>
          </div>

          {/* Metric 2 (Admin): My Authored Tracks */}
          {isAdmin && (
            <div
              className={`lp-metric-card ${activeScope === "Mine" ? "active-metric-filter" : ""}`}
              onClick={() => {
                setActiveScope("Mine");
                setSearchQuery("");
              }}
              role="button"
              tabIndex={0}
            >
              <div className="lp-metric-icon-box">
                <Layers size={18} strokeWidth={1.75} />
              </div>
              <div className="lp-metric-content">
                <span className="lp-metric-label">My Authored Tracks</span>
                <div className="lp-metric-value-row">
                  <span className="lp-metric-number">{myAuthoredTracksCount}</span>
                  <span className="lp-metric-subtext">by you</span>
                </div>
              </div>
            </div>
          )}

          {/* Metric 3: Active Cohorts */}
          <div
            className={`lp-metric-card ${activeScope === "Active" ? "active-metric-filter" : ""}`}
            onClick={() => {
              setActiveScope("Active");
              setSearchQuery("");
            }}
            role="button"
            tabIndex={0}
          >
            {!isTrainee && (
              <div className="lp-metric-icon-box">
                <TrendingUp size={18} />
              </div>
            )}
            <div className="lp-metric-content">
              <span className="lp-metric-label">{isTrainee ? "In Progress" : "Active Cohorts"}</span>
              <div className="lp-metric-value-row">
                <span className="lp-metric-number">{activePathsCount}</span>
                <span className="lp-metric-subtext">active</span>
              </div>
            </div>
          </div>

          {/* Metric 4 (Trainer/Admin): Enrolled Trainees */}
          {!isTrainee && (
            <div
              className="lp-metric-card"
              style={{ cursor: "default" }}
            >
              <div className="lp-metric-icon-box">
                <Users size={18} />
              </div>
              <div className="lp-metric-content">
                <span className="lp-metric-label">Learners Enrolled</span>
                <div className="lp-metric-value-row">
                  <span className="lp-metric-number">{totalEnrolledAcrossTracks}</span>
                  <span className="lp-metric-subtext">trainees</span>
                </div>
              </div>
            </div>
          )}

          {/* Metric 5 (Trainer/Admin): Avg Cohort Progress */}
          {!isTrainee && (
            <div
              className="lp-metric-card"
              style={{ cursor: "default" }}
            >
              <div className="lp-metric-icon-box">
                <BarChart2 size={18} />
              </div>
              <div className="lp-metric-content">
                <span className="lp-metric-label">Avg Cohort Completion</span>
                <div className="lp-metric-value-row">
                  <span className="lp-metric-number">{avgCohortProgressOverall}%</span>
                  <span className="lp-metric-subtext">across tracks</span>
                </div>
              </div>
            </div>
          )}

          {/* Trainee Metric: Completed */}
          {isTrainee && (
            <div
              className={`lp-metric-card ${activeScope === "Completed" ? "active-metric-filter" : ""}`}
              onClick={() => setActiveScope("Completed")}
              role="button"
              tabIndex={0}
            >
              <div className="lp-metric-content">
                <span className="lp-metric-label">Completed Tracks</span>
                <div className="lp-metric-value-row">
                  <span className="lp-metric-number">{completedPathsCount}</span>
                  <span className="lp-metric-subtext">finished</span>
                </div>
              </div>
            </div>
          )}
        </section>
      )}

      {/* 3. SEARCH, SCOPE & SORT CONTROLS */}
      <section className="learning-paths-control-bar" aria-label="Curriculum controls">
        <div className="lp-filter-tabs-cluster" role="tablist">
          {(isTrainee
            ? (["All", "Active", "Completed"] as FilterScope[])
            : isAdmin
            ? (["All", "Mine", "Active", "Upcoming"] as FilterScope[])
            : (["All", "Active", "Upcoming"] as FilterScope[])
          ).map((scope) => {
            let count = allTracksCount;
            if (scope === "Mine") count = myAuthoredTracksCount;
            if (scope === "Active") count = activePathsCount;
            if (scope === "Upcoming") count = upcomingPathsCount;
            if (scope === "Completed") count = completedPathsCount;

            const isSelected = activeScope === scope;
            const label =
              scope === "All"
                ? "All Tracks"
                : scope === "Mine"
                ? "My Tracks"
                : scope;

            return (
              <button
                key={scope}
                type="button"
                role="tab"
                aria-selected={isSelected}
                className={`lp-tab-button ${isSelected ? "is-active" : ""}`}
                onClick={() => setActiveScope(scope)}
              >
                <span>{label}</span>
                <span className="lp-tab-count">{count}</span>
              </button>
            );
          })}
        </div>

        <div className="lp-search-and-sort-group">
          {/* Search Field */}
          <div className="lp-search-field-wrapper">
            <span className="lp-search-icon">
              <Search size={14} />
            </span>
            <input
              type="text"
              className="lp-search-input"
              placeholder="Search by title, description, or tags..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              aria-label="Search learning paths"
            />
            {searchQuery && (
              <button
                type="button"
                className="lp-search-clear-btn"
                onClick={() => setSearchQuery("")}
                title="Clear search"
                aria-label="Clear search"
              >
                <X size={14} />
              </button>
            )}
          </div>

          {/* Sort Dropdown */}
          <select
            className="lp-sort-select"
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value as SortOption)}
            aria-label="Sort tracks by"
          >
            <option value="recent">Sort: Recently Created</option>
            <option value="title">Sort: Title (A - Z)</option>
            {!isTrainee && <option value="trainees">Sort: Most Trainees</option>}
          </select>
        </div>
      </section>

      {/* 4. ACTIVE SEARCH NOTIFICATION PILL */}
      {searchQuery.trim() && (
        <div className="lp-active-filter-strip">
          <span className="lp-active-filter-text">
            <Search size={13} />
            <span>Filtering tracks by query: <strong>"{searchQuery}"</strong> ({filteredPaths.length} matches)</span>
          </span>
          <button
            type="button"
            className="lp-active-filter-clear"
            onClick={() => setSearchQuery("")}
          >
            Clear Filter ✕
          </button>
        </div>
      )}

      {/* 5. CARDS GRID WITH CONTENT-ADAPTIVE SIZING OR SKELETON STATES */}
      {isLoading ? (
        <section
          className="learning-paths-grid-layout"
          aria-busy="true"
          aria-label="Loading learning paths..."
        >
          {Array.from({ length: 6 }).map((_, idx) => (
            <LearningPathSkeletonCard key={idx} />
          ))}
        </section>
      ) : errorMessage ? (
        <div
          style={{
            padding: "40px 24px",
            textAlign: "center",
            background: "#fef2f2",
            border: "1px solid #fecaca",
            borderRadius: "16px",
            color: "#991b1b",
          }}
        >
          <AlertCircle size={32} style={{ marginBottom: "8px", color: "#dc2626" }} />
          <h3 style={{ margin: "0 0 6px", fontSize: "17px", fontWeight: 700 }}>
            Unable to load learning paths
          </h3>
          <p style={{ margin: "0 0 16px", fontSize: "13.5px", color: "#b91c1c" }}>
            {errorMessage}
          </p>
          <button
            type="button"
            onClick={loadDatabasePaths}
            style={{
              padding: "8px 18px",
              background: "#dc2626",
              color: "#ffffff",
              border: "none",
              borderRadius: "8px",
              fontWeight: 600,
              fontSize: "13px",
              cursor: "pointer",
            }}
          >
            Retry Loading
          </button>
        </div>
      ) : filteredPaths.length === 0 ? (
        /* Empty State */
        <div className="learning-paths-empty-state">
          <div className="empty-state-icon-box">
            <BookOpen size={28} />
          </div>
          <h3 className="empty-state-title">No Learning Paths Found</h3>
          <p className="empty-state-desc">
            {searchQuery || activeScope !== "All"
              ? `No tracks matched your filter criteria (${activeScope !== "All" ? `Scope: ${activeScope}` : ""}${searchQuery ? `, Query: "${searchQuery}"` : ""}). Try adjusting or clearing your filters.`
              : isTrainee
              ? "You haven't been assigned to any curriculum tracks yet. Once your trainer assigns you, they will appear here."
              : "No curriculum tracks have been created yet. Launch your first track to sequence modules and start training cohorts."}
          </p>
          {searchQuery || activeScope !== "All" ? (
            <button
              type="button"
              className="lp-active-filter-clear"
              style={{ fontSize: "13px", padding: "6px 14px" }}
              onClick={() => {
                setSearchQuery("");
                setActiveScope("All");
              }}
            >
              Reset Filters
            </button>
          ) : !isTrainee ? (
            <button
              type="button"
              className="btn-create-learning-path"
              onClick={() => navigate("/learning-paths/new")}
            >
              <Plus size={16} strokeWidth={2.5} />
              <span>Create First Learning Path</span>
            </button>
          ) : null}
        </div>
      ) : (
        /* Render Genuine Learning Path Cards */
        <section className="learning-paths-grid-layout" aria-label="Curriculum tracks grid">
          {filteredPaths.map((path) => {
            const currentTitle = path.title || path.name || "Untitled Track";
            const currentStatus = path.status || "Active";
            const isPathActive = currentStatus.toLowerCase() === "active";
            const isOwner = isCurrentAuthor(path);
            const isOwnerOrAdmin = !isTrainee && (isAdmin || isOwner);

            // Tags
            let currentTags: string[] = [];
            if (Array.isArray(path.skillsTags)) {
              currentTags = path.skillsTags;
            } else if (typeof path.skillsTags === "string") {
              currentTags = (path.skillsTags as string)
                .split(",")
                .map((t) => t.trim())
                .filter(Boolean);
            }

            const MAX_VISIBLE_TAGS = 4;
            const visibleTags = currentTags.slice(0, MAX_VISIBLE_TAGS);
            const remainingTagsCount = currentTags.length - MAX_VISIBLE_TAGS;

            // Metrics
            const { enrolledCount, cohortProgress, modulesCount, lessonsCount, tasksCount } =
              getPathMetrics(path);
            const traineeProgressVal = isTrainee ? calculateLPProgress(path) : 0;

            return (
              <article
                key={path.id}
                className={`learning-path-card-item ${
                  highlightPathId === path.id ? "is-highlighted" : ""
                }`}
              >
                {/* Card Header: Icon/Image + Badges */}
                <div className="card-top-badges-row">
                  {path.imageUrl ? (
                    <img
                      src={path.imageUrl}
                      alt={currentTitle}
                      className="card-avatar-image"
                    />
                  ) : (
                    <div className="card-avatar-box">
                      <BookOpen size={20} />
                    </div>
                  )}

                  <div className="badge-meta-group">
                    {/* Difficulty Badge */}
                    <span
                      className={`difficulty-badge diff-${(path.difficulty || "Intermediate").toLowerCase()}`}
                    >
                      {path.difficulty || "Intermediate"}
                    </span>

                    {/* Status Badge */}
                    <span
                      className={`status-badge stat-${currentStatus.toLowerCase()}`}
                    >
                      {isPathActive && <span className="stat-indicator-dot" />}
                      {currentStatus}
                    </span>
                  </div>
                </div>

                {/* Card Title & Content */}
                <div className="card-content-block">
                  <h2
                    className="card-title-string"
                    onClick={() => onNavigateToModules(path.id, currentTitle)}
                  >
                    {highlightMatch(currentTitle, debouncedSearchQuery)}
                  </h2>

                  <ExpandableDescription
                    title={currentTitle}
                    description={path.description || "No track description provided."}
                  />

                  {/* Skills Tags (Clickable filter) */}
                  <div className="card-tags-cloud-row">
                    {currentTags.length > 0 ? (
                      visibleTags.map((tag, idx) => {
                        const isMatched =
                          debouncedSearchQuery.trim().length > 0 &&
                          tag.toLowerCase().includes(debouncedSearchQuery.trim().toLowerCase());
                        return (
                          <span
                            key={idx}
                            className={`card-skill-tag-chip ${isMatched ? "is-matched" : ""}`}
                            onClick={(e) => {
                              e.stopPropagation();
                              setSearchQuery(tag);
                            }}
                          >
                            <span className="tag-hash">#</span>
                            <span>{highlightMatch(tag, debouncedSearchQuery)}</span>
                          </span>
                        );
                      })
                    ) : (
                      <span className="card-skill-tag-chip" style={{ opacity: 0.7 }}>
                        <span className="tag-hash">#</span>
                        <span>Curriculum</span>
                      </span>
                    )}
                    {remainingTagsCount > 0 && (
                      <span
                        className="card-skill-tag-chip tag-more-count"
                        onClick={(e) => {
                          e.stopPropagation();
                          if (isOwnerOrAdmin) {
                            navigate(`/learning-paths/${path.id}/edit`);
                          }
                        }}
                      >
                        +{remainingTagsCount} more
                      </span>
                    )}
                  </div>
                </div>

                {/* Curriculum Scope Strip (Modules, Lessons, Duration) */}
                

                {/* Cohort Section (For Trainer/Admin) OR Trainee Progress Bar (For Trainee) */}
                {isTrainee ? (
                  <div className="card-trainee-progress-box">
                    <div className="trainee-progress-header">
                      <span>My Learning Progress</span>
                      <strong>
                        {traineeProgressVal}% {traineeProgressVal === 100 ? "Completed" : ""}
                      </strong>
                    </div>
                    <div className="cohort-progress-track">
                      <div
                        className={`cohort-progress-fill ${traineeProgressVal === 100 ? "is-complete" : ""}`}
                        style={{ width: `${traineeProgressVal}%` }}
                      />
                    </div>
                  </div>
                ) : (
                  <div className="card-cohort-engagement-box">
                    {enrolledCount > 0 ? (
                      <div className="cohort-actions-strip">
                        <button
                          type="button"
                          className="btn-cohort-view-progress"
                          onClick={() => setSelectedPathForTrainees(path.id)}
                        >
                          <div className="btn-cohort-left">
                            <span className="btn-cohort-title">Trainee Progress</span>
                          </div>
                          <div className="btn-cohort-right">
                            <span className="btn-cohort-count-chip">
                              
                              <span>{enrolledCount} {enrolledCount === 1 ? "Trainee" : "Trainees"}</span>
                            </span>
                            <ChevronRight size={14} className="btn-cohort-arrow" />
                          </div>
                        </button>
                      </div>
                    ) : (
                      <div className="cohort-unassigned-prompt">
                        <span style={{ display: "inline-flex", alignItems: "center", gap: "6px" }}>
                          <Users size={13} />
                          <span>No trainees assigned yet</span>
                        </span>
                        {isPathActive && modulesCount > 0 && (
                          <button
                            type="button"
                            className="btn-prompt-assign"
                            onClick={() => handleOpenAssignModal(path)}
                          >
                            + Assign Now
                          </button>
                        )}
                      </div>
                    )}
                  </div>
                )}

                {/* Action Toolbar */}
                
                <div className="card-action-toolbar">
                  {/* Primary CTA */}
                  <button
                    type="button"
                    className="btn-card-primary-action"
                    onClick={() => onNavigateToModules(path.id, currentTitle)}
                  >
                    <span>
                      {isTrainee
                        ? traineeProgressVal === 100  
                          ? "Review Curriculum →"
                          : traineeProgressVal > 0
                          ? "Continue Learning →"
                          : "Start Learning →"
                        : "Manage Curriculum →"}
                    </span>
                  </button>

                  {/* Secondary Quick Actions (Trainer / Admin) */}
                  {!isTrainee && (
                    <div className="card-secondary-actions-group">
                      {/* Assign Trainees */}
                      {isPathActive && modulesCount > 0 && (
                        <button
                          type="button"
                          className="btn-card-icon-action is-assign"
                          onClick={() => handleOpenAssignModal(path)}
                          aria-label="Assign trainees"
                        >
                          <UserPlus size={15} />
                        </button>
                      )}

                      {/* Edit Track Metadata */}
                      {isOwnerOrAdmin && (
                        <button
                          type="button"
                          className="btn-card-icon-action is-edit"
                          onClick={() => navigate(`/learning-paths/${path.id}/edit`)}
                          aria-label="Edit learning path"
                        >
                          <Edit size={14} />
                        </button>
                      )}

                      {/* Delete Track */}
                      {isOwnerOrAdmin && (
                        <button
                          type="button"
                          className="btn-card-icon-action is-delete"
                          onClick={() => handleDeleteClick(path)}
                          aria-label="Delete learning path"
                        >
                          <Trash2 size={14} />
                        </button>
                      )}
                    </div>
                  )}
                </div>
              </article>
            );
          })}
        </section>
      )}

      {/* ==========================================================================
          MODAL: COHORT PROGRESSION & ROSTER INSPECTION
          ========================================================================== */}
      {selectedPathForTrainees && (
        <div
          className="cohort-modal-overlay"
          onClick={() => setSelectedPathForTrainees(null)}
          role="dialog"
          aria-modal="true"
        >
          <div
            className="cohort-modal-card"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Modal Header */}
            <div className="cohort-modal-header">
              <div className="cohort-modal-title-group">
                <h2>
                  Cohort Progression:{" "}
                  {paths.find((p) => p.id === selectedPathForTrainees)?.title || "Track"}
                </h2>
                <p className="cohort-modal-subtitle">
                  Roster breakdown, individual learner velocity, and assessment performance
                </p>
              </div>
              <button
                type="button"
                className="cohort-modal-close-btn"
                onClick={() => setSelectedPathForTrainees(null)}
                aria-label="Close modal"
              >
                &times;
              </button>
            </div>

            {/* Modal Body with Skeleton Loading State */}
            <div className="cohort-modal-body">
              {isLoadingLpProgress || !lpTraineesProgress ? (
                /* Skeleton Loader for Cohort Modal */
                <div style={{ display: "flex", flexDirection: "column", gap: "20px" }}>
                  <div style={{ display: "flex", gap: "16px", background: "#f8fafc", padding: "16px", borderRadius: "12px", border: "1px solid #e2e8f0" }}>
                    <div className="skeleton-shimmer" style={{ width: "140px", height: "140px", borderRadius: "50%", margin: "0 auto" }} />
                    <div style={{ flex: 1, display: "grid", gridTemplateColumns: "1fr 1fr", gap: "10px" }}>
                      <div className="skeleton-shimmer" style={{ height: "60px", borderRadius: "8px" }} />
                      <div className="skeleton-shimmer" style={{ height: "60px", borderRadius: "8px" }} />
                      <div className="skeleton-shimmer" style={{ height: "60px", borderRadius: "8px" }} />
                      <div className="skeleton-shimmer" style={{ height: "60px", borderRadius: "8px" }} />
                    </div>
                  </div>
                  <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
                    <TraineeRowSkeleton />
                    <TraineeRowSkeleton />
                    <TraineeRowSkeleton />
                  </div>
                </div>
              ) : (
                (() => {
                  const { cohort, trainees } = lpTraineesProgress;

                  const chartData = [
                    { name: "Completed", value: cohort.completed, color: "#16a34a" },
                    { name: "In Progress", value: cohort.inProgress, color: "#4f46e5" },
                    { name: "Not Started", value: cohort.notStarted, color: "#94a3b8" },
                  ].filter((d) => d.value > 0);

                  const filteredRoster = (trainees || []).filter((t: any) => {
                    const q = cohortSearchQuery.trim().toLowerCase();
                    if (!q) return true;
                    return (
                      t.traineeName?.toLowerCase().includes(q) ||
                      t.email?.toLowerCase().includes(q)
                    );
                  });

                  return (
                    <>
                      {/* Cohort Overview Donut Chart & Stat Cards */}
                      {trainees.length > 0 && (
                        <div className="cohort-overview-cluster">
                          <div className="cohort-chart-col">
                            <ResponsiveContainer width="100%" height="100%">
                              <PieChart>
                                <Pie
                                  data={chartData}
                                  dataKey="value"
                                  nameKey="name"
                                  cx="50%"
                                  cy="50%"
                                  innerRadius={46}
                                  outerRadius={70}
                                  paddingAngle={3}
                                >
                                  {chartData.map((entry, index) => (
                                    <Cell key={`cell-${index}`} fill={entry.color} />
                                  ))}
                                </Pie>
                                <RechartsTooltip />
                              </PieChart>
                            </ResponsiveContainer>
                            <div className="cohort-chart-center-label">
                              <div className="cohort-chart-center-num">{trainees.length}</div>
                              <div className="cohort-chart-center-sub">Learners</div>
                            </div>
                          </div>

                          <div className="cohort-stats-col">
                            <div className="cohort-stat-box">
                              <span className="cohort-stat-pill">
                                <span className="cohort-stat-indicator" style={{ background: "#16a34a" }} />
                                <span>Completed</span>
                              </span>
                              <span className="cohort-stat-num">{cohort.completed}</span>
                            </div>

                            <div className="cohort-stat-box">
                              <span className="cohort-stat-pill">
                                <span className="cohort-stat-indicator" style={{ background: "#4f46e5" }} />
                                <span>In Progress</span>
                              </span>
                              <span className="cohort-stat-num">{cohort.inProgress}</span>
                            </div>

                            <div className="cohort-stat-box">
                              <span className="cohort-stat-pill">
                                <span className="cohort-stat-indicator" style={{ background: "#94a3b8" }} />
                                <span>Not Started</span>
                              </span>
                              <span className="cohort-stat-num">{cohort.notStarted}</span>
                            </div>

                            <div className="cohort-stat-box">
                              <span className="cohort-stat-pill">
                                <Award size={12} style={{ color: "#d97706" }} />
                                <span>Cohort Size</span>
                              </span>
                              <span className="cohort-stat-num">{trainees.length} Total</span>
                            </div>
                          </div>
                        </div>
                      )}

                      {/* Search in Roster */}
                      <div className="cohort-roster-controls">
                        <span className="cohort-roster-count">
                          Enrolled Learners ({filteredRoster.length} of {trainees.length})
                        </span>
                        <div className="lp-search-field-wrapper cohort-roster-search">
                          <span className="lp-search-icon">
                            <Search size={13} />
                          </span>
                          <input
                            type="text"
                            className="lp-search-input"
                            placeholder="Filter by trainee name or email..."
                            value={cohortSearchQuery}
                            onChange={(e) => setCohortSearchQuery(e.target.value)}
                          />
                        </div>
                      </div>

                      {/* Roster Table */}
                      <div className="cohort-roster-table-wrapper">
                        {filteredRoster.length === 0 ? (
                          <div style={{ padding: "32px 16px", textAlign: "center", color: "#64748b" }}>
                            <p style={{ margin: 0, fontWeight: 600 }}>No trainees matched your filter.</p>
                          </div>
                        ) : (
                          <table className="cohort-table">
                            <thead>
                              <tr>
                                <th>Trainee</th>
                                <th>Curriculum Progress</th>
                                <th style={{ textAlign: "right" }}>Action</th>
                              </tr>
                            </thead>
                            <tbody>
                              {filteredRoster.map((t: any) => {
                                const isExpanded = expandedTraineeId === t.traineeId;
                                const progress = t.pathProgressPercent ?? 0;
                                let barBg = "#4f46e5";
                                if (progress === 100) barBg = "#16a34a";
                                if (progress === 0) barBg = "#94a3b8";

                                const matchedTrainee = allTrainees.find((u) => u.id === t.traineeId);
                                const avatarSrc = t.avatarUrl || matchedTrainee?.avatarUrl;
                                const firstName = t.firstName || matchedTrainee?.firstName || "";
                                const lastName = t.lastName || matchedTrainee?.lastName || "";
                                const resolvedName = [firstName, lastName].filter(Boolean).join(" ") || t.traineeName || t.email;
                                const initials = getTraineeInitials(firstName, lastName, resolvedName, t.email);

                                return (
                                  <React.Fragment key={t.traineeId}>
                                    <tr
                                      className={`cohort-row-item ${isExpanded ? "is-expanded" : ""}`}
                                      onClick={() =>
                                        setExpandedTraineeId(isExpanded ? null : t.traineeId)
                                      }
                                    >
                                      <td>
                                        <div className="trainee-identity-cell">
                                          <div className="trainee-avatar-wrapper">
                                            {avatarSrc ? (
                                              <img
                                                src={avatarSrc}
                                                alt={resolvedName}
                                                className="trainee-avatar-img"
                                                onError={(e) => {
                                                  (e.currentTarget as HTMLElement).style.display = "none";
                                                  const fallback = e.currentTarget.parentElement?.querySelector(
                                                    ".trainee-avatar-initials"
                                                  ) as HTMLElement;
                                                  if (fallback) fallback.style.display = "flex";
                                                }}
                                              />
                                            ) : null}
                                            <div
                                              className="trainee-avatar-initials"
                                              style={{ display: avatarSrc ? "none" : "flex" }}
                                              aria-hidden="true"
                                            >
                                              {initials}
                                            </div>
                                          </div>
                                          <div className="trainee-name-box">
                                            <span className="trainee-fullname">{resolvedName}</span>
                                            <span className="trainee-email-sub">{t.email}</span>
                                          </div>
                                        </div>
                                      </td>
                                      <td>
                                        <div className="trainee-progress-bar-cell">
                                          <div className="trainee-progress-track">
                                            <div
                                              className="trainee-progress-bar"
                                              style={{ width: `${progress}%`, background: barBg }}
                                            />
                                          </div>
                                          <span style={{ fontSize: "12px", fontWeight: 700, color: "#334155", minWidth: "36px" }}>
                                            {progress}%
                                          </span>
                                        </div>
                                      </td>
                                      <td style={{ textAlign: "right" }}>
                                        <span className={`trainee-expand-toggle ${isExpanded ? "open" : ""}`}>
                                          <ChevronRight size={16} />
                                        </span>
                                      </td>
                                    </tr>

                                    {/* Expanded Details Sub-Panel */}
                                    {isExpanded && (
                                      <tr>
                                        <td colSpan={3} style={{ padding: 0 }}>
                                          <div className="trainee-details-panel">
                                            <div className="trainee-stat-metric">
                                              <span className="trainee-stat-label">Lessons Completed</span>
                                              <span className="trainee-stat-val">
                                                {t.lessonsCompleted} / {t.lessonsTotal}
                                              </span>
                                            </div>

                                            <div className="trainee-stat-metric">
                                              <span className="trainee-stat-label">Tasks Approved</span>
                                              <span className="trainee-stat-val">
                                                {t.tasksApproved} / {t.tasksTotal}
                                              </span>
                                            </div>

                                            <div className="trainee-stat-metric">
                                              <span className="trainee-stat-label">Average Score</span>
                                              <span className="trainee-stat-val">
                                                {t.avgScorePercent !== null && t.avgScorePercent !== undefined
                                                  ? `${t.avgScorePercent}%`
                                                  : "—"}
                                              </span>
                                            </div>

                                            <div className="trainee-stat-metric">
                                              <span className="trainee-stat-label">Resources Visited</span>
                                              <span className="trainee-stat-val">
                                                {t.resourcesVisited} / {t.resourcesTotal}
                                              </span>
                                            </div>

                                            {/* <button
                                              type="button"
                                              className="trainee-profile-link-btn"
                                              onClick={(e) => {
                                                e.stopPropagation();
                                                navigate(`/trainer/trainees/${t.traineeId}`);
                                              }}
                                              title="View trainee comprehensive progress record"
                                            >
                                              <span>View Trainee Record</span>
                                              <ExternalLink size={12} />
                                            </button> */}
                                          </div>
                                        </td>
                                      </tr>
                                    )}
                                  </React.Fragment>
                                );
                              })}
                            </tbody>
                          </table>
                        )}
                      </div>
                    </>
                  );
                })()
              )}
            </div>
          </div>
        </div>
      )}

      {/* ==========================================================================
          MODAL: ASSIGN TRAINEES TO TRACK
          ========================================================================== */}
      {isAssignModalOpen && selectedPathForAssignment && (
        <div
          className="cohort-modal-overlay"
          onClick={() => setIsAssignModalOpen(false)}
          role="dialog"
          aria-modal="true"
        >
          <div
            className="assign-modal-card"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div className="assign-modal-header">
              <h2>Assign Trainees to Track</h2>
              <button
                type="button"
                className="cohort-modal-close-btn"
                onClick={() => setIsAssignModalOpen(false)}
                aria-label="Close modal"
              >
                &times;
              </button>
            </div>

            {/* Body */}
            <div className="assign-modal-body">
              <div className="lp-search-field-wrapper" style={{ maxWidth: "100%" }}>
                <span className="lp-search-icon">
                  <Search size={14} />
                </span>
                <input
                  type="text"
                  className="lp-search-input"
                  placeholder="Search trainees by name or email..."
                  value={traineeSearchQuery}
                  onChange={(e) => setTraineeSearchQuery(e.target.value)}
                />
              </div>

              {/* Batch Actions */}
              <div className="assign-batch-actions">
                <button
                  type="button"
                  className="assign-batch-link"
                  onClick={handleSelectAllAvailableTrainees}
                >
                  Select All Available
                </button>
                {newlySelectedTraineeIds.length > 0 && (
                  <button
                    type="button"
                    className="assign-batch-link"
                    style={{ color: "#dc2626" }}
                    onClick={handleDeselectAllTrainees}
                  >
                    Deselect All
                  </button>
                )}
              </div>

              {/* Trainee Checkbox List with Skeleton Loader */}
              <div className="assign-trainees-list-box">
                {isLoadingTrainees ? (
                  <>
                    <TraineeRowSkeleton />
                    <TraineeRowSkeleton />
                    <TraineeRowSkeleton />
                  </>
                ) : (
                  (() => {
                    const filtered = allTrainees.filter((t) => {
                      const q = traineeSearchQuery.trim().toLowerCase();
                      if (!q) return true;
                      const fullName = `${t.firstName || ""} ${t.lastName || ""}`.trim() || t.name || "";
                      return fullName.toLowerCase().includes(q) || t.email?.toLowerCase().includes(q);
                    });

                    if (filtered.length === 0) {
                      return (
                        <div style={{ padding: "24px 16px", textAlign: "center", color: "#64748b" }}>
                          <p style={{ margin: 0, fontSize: "13px" }}>No eligible trainees found.</p>
                        </div>
                      );
                    }

                    const assignedIdsSet = new Set(
                      (selectedPathForAssignment.assignedToTraineeIds || []).map((id: any) => String(id).toLowerCase())
                    );
                    const isAssigned = (id: string) => assignedIdsSet.has(String(id).toLowerCase());

                    const creatorId =
                      selectedPathForAssignment.createdBy?.id ||
                      (typeof selectedPathForAssignment.createdBy === "string" ? selectedPathForAssignment.createdBy : null) ||
                      (selectedPathForAssignment as any).createdById;
                    const creatorEmail =
                      typeof selectedPathForAssignment.createdBy === "object" ? selectedPathForAssignment.createdBy?.email : null;

                    const isCreator = (t: TraineeUser) => {
                      const tId = String(t.id || "").toLowerCase();
                      const tEmail = String(t.email || "").toLowerCase();
                      if (creatorId && tId === String(creatorId).toLowerCase()) return true;
                      if (creatorEmail && tEmail && tEmail === String(creatorEmail).toLowerCase()) return true;
                      return false;
                    };

                    const available = filtered
                      .filter((t) => !isAssigned(t.id))
                      .sort((a, b) => {
                        // Pin the path creator to the top so other trainers immediately see them!
                        if (isCreator(a) && !isCreator(b)) return -1;
                        if (!isCreator(a) && isCreator(b)) return 1;
                        return (a.name || "").localeCompare(b.name || "");
                      });

                    const alreadyAssigned = filtered
                      .filter((t) => isAssigned(t.id))
                      .sort((a, b) => {
                        if (isCreator(a) && !isCreator(b)) return -1;
                        if (!isCreator(a) && isCreator(b)) return 1;
                        return (a.name || "").localeCompare(b.name || "");
                      });

                    return (
                      <>
                        {available.length > 0 && (
                          <div style={{ marginBottom: "8px" }}>
                            <div style={{ fontSize: "10.5px", fontWeight: 700, color: "#64748b", textTransform: "uppercase", letterSpacing: "0.05em", padding: "4px 6px" }}>
                              Available to Assign ({available.length})
                            </div>
                            {available.map((trainee) => {
                              const isChecked = newlySelectedTraineeIds.includes(trainee.id);
                              const displayName = `${trainee.firstName || ""} ${trainee.lastName || ""}`.trim() || trainee.name || trainee.email;

                              return (
                                <div
                                  key={trainee.id}
                                  className={`assign-trainee-item-row ${isChecked ? "is-selected" : ""}`}
                                >
                                  <label className="assign-trainee-label">
                                    <input
                                      type="checkbox"
                                      checked={isChecked}
                                      onChange={() => handleToggleTrainee(trainee.id)}
                                    />
                                    <div className="assign-trainee-info">
                                      <span className="assign-trainee-name">{displayName}</span>
                                      <span className="assign-trainee-email">{trainee.email}</span>
                                    </div>
                                  </label>
                                  {isChecked && (
                                    <span style={{ fontSize: "11px", fontWeight: 700, color: "#16a34a", background: "#dcfce7", padding: "2px 7px", borderRadius: "4px" }}>
                                      Selected
                                    </span>
                                  )}
                                </div>
                              );
                            })}
                          </div>
                        )}

                        {alreadyAssigned.length > 0 && (
                          <div>
                            <div style={{ fontSize: "10.5px", fontWeight: 700, color: "#94a3b8", textTransform: "uppercase", letterSpacing: "0.05em", padding: "4px 6px" }}>
                              Already Enrolled ({alreadyAssigned.length})
                            </div>
                            {alreadyAssigned.map((trainee) => {
                              const displayName = `${trainee.firstName || ""} ${trainee.lastName || ""}`.trim() || trainee.name || trainee.email;

                              const assigner =
                                (selectedPathForAssignment as any)?.traineeAssigners?.[trainee.id] ||
                                (selectedPathForAssignment as any)?.traineeAssigners?.[String(trainee.id).toLowerCase()];

                              const assignerName = assigner
                                ? (`${assigner.firstName || ""} ${assigner.lastName || ""}`.trim() || assigner.name || assigner.email)
                                : (selectedPathForAssignment.createdBy
                                    ? (`${selectedPathForAssignment.createdBy.firstName || ""} ${selectedPathForAssignment.createdBy.lastName || ""}`.trim() || selectedPathForAssignment.createdBy.name || selectedPathForAssignment.createdBy.email)
                                    : null);

                              return (
                                <div
                                  key={trainee.id}
                                  className="assign-trainee-item-row is-already-assigned"
                                >
                                  <label className="assign-trainee-label" style={{ cursor: "not-allowed" }}>
                                    <input type="checkbox" checked disabled />
                                    <div className="assign-trainee-info">
                                      <span className="assign-trainee-name" style={{ color: "#64748b" }}>
                                        {displayName}
                                      </span>
                                      <span className="assign-trainee-email">{trainee.email}</span>
                                    </div>
                                  </label>
                                  <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                                    {assignerName && (
                                      <span
                                        style={{
                                          fontSize: "11px",
                                          color: "#475569",
                                          background: "#f1f5f9",
                                          padding: "2px 8px",
                                          borderRadius: "4px",
                                          border: "1px solid #e2e8f0",
                                          fontWeight: 500,
                                          whiteSpace: "nowrap",
                                        }}
                                        title={`Assigned by ${assignerName}`}
                                      >
                                        Assigned by <strong style={{ color: "#1e293b", fontWeight: 600 }}>{assignerName}</strong>
                                      </span>
                                    )}
                                    <span className="already-assigned-pill">
                                      ✓ Enrolled
                                    </span>
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        )}
                      </>
                    );
                  })()
                )}
              </div>
            </div>

            {/* Footer */}
            <div className="assign-modal-footer">
              <span className="assign-counter-text">
                {newlySelectedTraineeIds.length} Selected
              </span>
              <div className="assign-footer-actions">
                <button
                  type="button"
                  className="btn-assign-cancel"
                  onClick={() => setIsAssignModalOpen(false)}
                >
                  Cancel
                </button>
                <button
                  type="button"
                  className="btn-assign-confirm"
                  disabled={newlySelectedTraineeIds.length === 0 || isSubmittingAssignment}
                  onClick={handleConfirmAssignment}
                >
                  <UserPlus size={14} />
                  <span>
                    {isSubmittingAssignment
                      ? "Assigning..."
                      : `Assign Selected (${newlySelectedTraineeIds.length})`}
                  </span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {deleteTarget && (
        <DeletePathModal
          path={deleteTarget}
          isDeleting={isDeletingPath}
          onClose={() => setDeleteTarget(null)}
          onConfirm={handleConfirmDelete}
          metrics={getPathMetrics(deleteTarget)}
        />
      )}
    </div>
  );
}
