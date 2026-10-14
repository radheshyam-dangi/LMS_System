import React, { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useNotifications } from '../context/NotificationContext';
import { getNotificationRoute } from '../utils/notificationUtils';
import {
  Bell,
  BellOff,
  Check,
  CheckCheck,
  Trash2,
  ArrowLeft,
  Search,
  X,
  RefreshCw,
  Clock,
  Bot,
  BookOpen,
  ClipboardList,
  FileText,
  CheckCircle2,
  AlertTriangle,
  ArrowRight
} from 'lucide-react';
import './NotificationsPage.css';

const timeAgo = (dateStr: string) => {
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return '';
  const seconds = Math.floor((new Date().getTime() - d.getTime()) / 1000);
  if (seconds < 60) return 'Just now';
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
};

type FilterCategory = 'all' | 'unread' | 'learning_path' | 'assignment' | 'evaluation';

export function NotificationsPage({ activeRole }: { activeRole: string }) {
  const {
    notifications,
    unreadCount,
    isLoading,
    refresh,
    markAsRead,
    markAllRead,
    deleteNotification
  } = useNotifications();

  const navigate = useNavigate();
  const [filter, setFilter] = useState<FilterCategory>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const itemsPerPage = 10;

  const handleRefresh = async () => {
    setIsRefreshing(true);
    try {
      await refresh();
    } finally {
      setIsRefreshing(false);
    }
  };

  const handleBack = () => {
    if (window.history.length > 2) {
      navigate(-1);
    } else {
      navigate(activeRole.toLowerCase() === 'admin' ? '/users' : '/dashboard');
    }
  };

  // Helper to categorize each notification
  const getCategory = (n: any): 'learning_path' | 'assignment' | 'evaluation' | 'general' => {
    if (n.type === 'learning_path_assigned' || n.relatedEntityType === 'learning_path') {
      return 'learning_path';
    }
    if (
      n.type === 'submission_pending' ||
      n.type === 'ai_evaluation_ready' ||
      n.type === 'ai_evaluation_failed' ||
      n.type === 'evaluation_completed' ||
      n.relatedEntityType === 'submission'
    ) {
      return 'evaluation';
    }
    if (n.type === 'assignment_assigned' || n.relatedEntityType === 'assignment') {
      return 'assignment';
    }
    return 'general';
  };

  // Parse score from message if present (e.g. "Score: 25/30" or "AI Score: 27/30")
  const extractScorePill = (message?: string) => {
    if (!message) return null;
    const match = message.match(/(?:Score|AI Score):\s*(\d+)\/(\d+)/i);
    if (!match) return null;
    const score = parseInt(match[1], 10);
    const maxScore = parseInt(match[2], 10);
    const pct = maxScore > 0 ? (score / maxScore) * 100 : 0;

    let scoreClass = 'score-high';
    if (pct < 50) scoreClass = 'score-low';
    else if (pct < 80) scoreClass = 'score-med';

    return {
      text: `${score} / ${maxScore} pts`,
      className: scoreClass,
    };
  };

  // Render icon & category tag metadata
  const renderCategoryMeta = (n: any) => {
    switch (n.type) {
      case 'learning_path_assigned':
        return {
          icon: <BookOpen size={18} />,
          orbClass: 'theme-indigo',
          tagLabel: 'Learning Path',
        };
      case 'assignment_assigned':
        return {
          icon: <FileText size={18} />,
          orbClass: 'theme-sky',
          tagLabel: 'Task Assigned',
        };
      case 'submission_pending':
        return {
          icon: <ClipboardList size={18} />,
          orbClass: 'theme-amber',
          tagLabel: 'Submission Ready',
        };
      case 'ai_evaluation_ready':
        return {
          icon: <Bot size={18} strokeWidth={1.75} />,
          orbClass: 'theme-purple',
          tagLabel: 'AI Evaluated',
        };
      case 'ai_evaluation_failed':
        return {
          icon: <AlertTriangle size={18} />,
          orbClass: 'theme-red',
          tagLabel: 'Review Required',
        };
      case 'evaluation_completed':
        return {
          icon: <CheckCircle2 size={18} />,
          orbClass: 'theme-emerald',
          tagLabel: 'Graded',
        };
      default:
        return {
          icon: <Bell size={18} />,
          orbClass: 'theme-indigo',
          tagLabel: 'System Alert',
        };
    }
  };

  // Filtered & searched notifications computation
  const filteredNotifications = useMemo(() => {
    let result = [...notifications];

    if (filter === 'unread') {
      result = result.filter((n) => !n.isRead);
    } else if (filter === 'learning_path') {
      result = result.filter((n) => getCategory(n) === 'learning_path');
    } else if (filter === 'assignment') {
      result = result.filter((n) => getCategory(n) === 'assignment');
    } else if (filter === 'evaluation') {
      result = result.filter((n) => getCategory(n) === 'evaluation');
    }

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      result = result.filter(
        (n) =>
          (n.title || '').toLowerCase().includes(q) ||
          (n.message || '').toLowerCase().includes(q)
      );
    }

    return result;
  }, [notifications, filter, searchQuery]);

  const totalPages = Math.ceil(filteredNotifications.length / itemsPerPage);
  const displayedNotifications = useMemo(() => {
    const start = (currentPage - 1) * itemsPerPage;
    return filteredNotifications.slice(start, start + itemsPerPage);
  }, [filteredNotifications, currentPage, itemsPerPage]);

  const handleNotificationClick = (n: any) => {
    void markAsRead(n.id);
    const route = getNotificationRoute(n, activeRole);
    navigate(route);
  };

  return (
    <div className="notifications-page-container">
      {/* ── 1. HEADER ── */}
      <header className="notifications-top-header">
        <div className="notifications-title-cluster">
          <button
            type="button"
            className="notifications-back-btn"
            onClick={handleBack}
            title="Return to previous screen"
          >
            <ArrowLeft size={16} />
            <span>Back</span>
          </button>
          <h1 className="notifications-main-heading">
            <span>Notifications</span>
            {unreadCount > 0 && (
              <span className="notifications-unread-badge">{unreadCount} unread</span>
            )}
          </h1>
        </div>

        <div className="notifications-header-actions">
          <button
            type="button"
            className="btn-notif-action"
            onClick={handleRefresh}
            disabled={isRefreshing}
            title="Refresh notifications"
          >
            <RefreshCw size={14} className={isRefreshing ? 'animate-spin' : ''} />
            <span>Refresh</span>
          </button>

          {unreadCount > 0 && (
            <button
              type="button"
              className="btn-notif-action btn-notif-primary"
              onClick={() => void markAllRead()}
              title="Mark all notifications as read"
            >
              <CheckCheck size={16} />
              <span>Mark all as read</span>
            </button>
          )}
        </div>
      </header>

      {/* ── 2. MAIN CARD ── */}
      <main className="notifications-main-card">
        {/* Toolbar: Category Filters & Search */}
        <div className="notifications-toolbar">
          <div className="notifications-filter-pills" role="tablist">
            <button
              type="button"
              className={`notif-filter-pill ${filter === 'all' ? 'is-active' : ''}`}
              onClick={() => {
                setFilter('all');
                setCurrentPage(1);
              }}
            >
              <span>All</span>
              <span className="notif-pill-counter">{notifications.length}</span>
            </button>

            <button
              type="button"
              className={`notif-filter-pill ${filter === 'unread' ? 'is-active' : ''}`}
              onClick={() => {
                setFilter('unread');
                setCurrentPage(1);
              }}
            >
              <span>Unread</span>
              <span className="notif-pill-counter">{unreadCount}</span>
            </button>

            <button
              type="button"
              className={`notif-filter-pill ${filter === 'learning_path' ? 'is-active' : ''}`}
              onClick={() => {
                setFilter('learning_path');
                setCurrentPage(1);
              }}
            >
              <span>Learning Paths</span>
            </button>

            <button
              type="button"
              className={`notif-filter-pill ${filter === 'assignment' ? 'is-active' : ''}`}
              onClick={() => {
                setFilter('assignment');
                setCurrentPage(1);
              }}
            >
              <span>Assignments</span>
            </button>

            <button
              type="button"
              className={`notif-filter-pill ${filter === 'evaluation' ? 'is-active' : ''}`}
              onClick={() => {
                setFilter('evaluation');
                setCurrentPage(1);
              }}
            >
              <span>Evaluations</span>
            </button>
          </div>

          <div className="notif-search-wrapper">
            <Search size={14} className="notif-search-icon" />
            <input
              type="text"
              className="notif-search-input"
              placeholder="Search notifications..."
              value={searchQuery}
              onChange={(e) => {
                setSearchQuery(e.target.value);
                setCurrentPage(1);
              }}
            />
            {searchQuery && (
              <button
                type="button"
                className="notif-search-clear"
                onClick={() => setSearchQuery('')}
                title="Clear search"
              >
                <X size={14} />
              </button>
            )}
          </div>
        </div>

        {/* Feed List or Loading Skeleton */}
        <div className="notifications-feed-list" aria-live="polite">
          {isLoading ? (
            /* Shimmer Skeleton Rows */
            <>
              {[1, 2, 3, 4, 5].map((idx) => (
                <div key={idx} className="notif-skeleton-row" aria-busy="true">
                  <div className="notif-skeleton-shimmer notif-skeleton-orb" />
                  <div className="notif-skeleton-body">
                    <div className="notif-skeleton-shimmer notif-skeleton-title" />
                    <div className="notif-skeleton-shimmer notif-skeleton-desc" />
                    <div className="notif-skeleton-shimmer notif-skeleton-time" />
                  </div>
                </div>
              ))}
            </>
          ) : displayedNotifications.length === 0 ? (
            /* Empty State */
            <div className="notif-empty-state-card">
              <div className="notif-empty-icon-box">
                <BellOff size={28} />
              </div>
              <h3 className="notif-empty-title">
                {searchQuery
                  ? 'No matching notifications found'
                  : filter === 'unread'
                  ? 'No unread notifications'
                  : "You're all caught up!"}
              </h3>
              <p className="notif-empty-desc">
                {searchQuery
                  ? 'Try searching with different keywords or switch filters.'
                  : 'New assignment requests, evaluation reviews, and learning path updates will appear here.'}
              </p>
            </div>
          ) : (
            /* Real Notification Feed Items */
            displayedNotifications.map((n) => {
              const meta = renderCategoryMeta(n);
              const scorePill = extractScorePill(n.message);

              return (
                <div
                  key={n.id}
                  className={`notifications-feed-row ${!n.isRead ? 'is-unread' : ''}`}
                  onClick={() => handleNotificationClick(n)}
                  role="button"
                  tabIndex={0}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      handleNotificationClick(n);
                    }
                  }}
                  title="Click to view details"
                >
                  {/* Category Orb */}
                  <div className={`notif-category-orb ${meta.orbClass}`}>
                    {meta.icon}
                  </div>

                  {/* Content Column */}
                  <div className="notif-content-col">
                    <div className="notif-meta-top-row">
                      <div className="notif-tags-cluster">
                        <span className="notif-type-tag">{meta.tagLabel}</span>
                        {scorePill && (
                          <span className={`notif-score-pill ${scorePill.className}`}>
                            {scorePill.text}
                          </span>
                        )}
                        {!n.isRead && (
                          <span
                            style={{
                              width: '7px',
                              height: '7px',
                              borderRadius: '50%',
                              backgroundColor: '#2563eb',
                              display: 'inline-block',
                            }}
                            title="Unread notification"
                          />
                        )}
                      </div>
                    </div>

                    <h4 className="notif-feed-title">{n.title}</h4>

                    {n.message && <p className="notif-feed-message">{n.message}</p>}

                    <div className="notif-feed-footer-row">
                      <span className="notif-feed-time">
                        <Clock size={12} />
                        <span>{timeAgo(n.createdAt)}</span>
                      </span>

                      <span className="notif-jump-link-hint">
                        <span>View details</span>
                        <ArrowRight size={13} />
                      </span>
                    </div>
                  </div>

                  {/* Actions Column */}
                  <div className="notif-actions-col" onClick={(e) => e.stopPropagation()}>
                    <button
                      type="button"
                      className="notif-row-action-btn delete-btn"
                      onClick={() => void deleteNotification(n.id)}
                      title="Delete notification"
                    >
                      <Trash2 size={15} />
                    </button>
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Pagination Bar */}
        {totalPages > 1 && (
          <footer className="notif-pagination-bar">
            <span className="notif-page-info">
              Showing {(currentPage - 1) * itemsPerPage + 1}–
              {Math.min(currentPage * itemsPerPage, filteredNotifications.length)} of{' '}
              {filteredNotifications.length} notifications
            </span>
            <div className="notif-page-controls">
              <button
                type="button"
                className="notif-page-btn"
                disabled={currentPage === 1}
                onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
              >
                Previous
              </button>
              <button
                type="button"
                className="notif-page-btn"
                disabled={currentPage === totalPages}
                onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
              >
                Next
              </button>
            </div>
          </footer>
        )}
      </main>
    </div>
  );
}
