import React, { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useNotifications } from '../context/NotificationContext';
import { getNotificationRoute } from '../utils/notificationUtils';
import { Bell, Check, Trash2, ArrowLeft, Search } from 'lucide-react';
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

export function NotificationsPage({ activeRole }: { activeRole: string }) {
  const { notifications, markAsRead, markAllRead, deleteNotification } = useNotifications();
  const navigate = useNavigate();
  const [currentPage, setCurrentPage] = useState(1);
  const [filter, setFilter] = useState<'all' | 'unread'>('all');
  const itemsPerPage = 15;

  const filteredNotifications = useMemo(() => {
    let result = [...notifications];
    if (filter === 'unread') {
      result = result.filter((n) => !n.isRead);
    }
    return result;
  }, [notifications, filter]);

  const totalPages = Math.ceil(filteredNotifications.length / itemsPerPage);
  const displayedNotifications = filteredNotifications.slice(
    (currentPage - 1) * itemsPerPage,
    currentPage * itemsPerPage
  );

  const handleNotificationClick = (n: any) => {
    void markAsRead(n.id);
    navigate(getNotificationRoute(n, activeRole));
  };

  const unreadCount = notifications.filter((n) => !n.isRead).length;

  return (
    <div className="notifications-page">
      <header className="notifications-header">
        <div className="notifications-header-left">
          <button className="back-btn hover-effect touch-target" onClick={() => window.history.back()}>
            <ArrowLeft size={18} /> Back
          </button>
          <h1>Notifications</h1>
          {unreadCount > 0 && <span className="badge badge-red">{unreadCount} unread</span>}
        </div>
        <div className="notifications-header-right">
          {unreadCount > 0 && (
            <button className="btn-secondary" onClick={() => void markAllRead()}>
              <Check size={16} /> Mark all as read
            </button>
          )}
        </div>
      </header>

      <div className="notifications-content">
        <div className="notifications-filters">
          <button
            className={`filter-btn ${filter === 'all' ? 'active' : ''}`}
            onClick={() => { setFilter('all'); setCurrentPage(1); }}
          >
            All
          </button>
          <button
            className={`filter-btn ${filter === 'unread' ? 'active' : ''}`}
            onClick={() => { setFilter('unread'); setCurrentPage(1); }}
          >
            Unread
          </button>
        </div>

        <div className="notifications-list">
          {displayedNotifications.length === 0 ? (
            <div className="notifications-empty">
              <Bell size={48} className="empty-icon" />
              <h3>You're all caught up!</h3>
              <p>No {filter === 'unread' ? 'unread ' : ''}notifications right now.</p>
            </div>
          ) : (
            displayedNotifications.map((n) => (
              <div
                key={n.id}
                className={`notification-row ${!n.isRead ? 'unread' : ''}`}
                onClick={() => handleNotificationClick(n)}
              >
                {!n.isRead && <div className="unread-dot"></div>}
                <div className="notification-content">
                  <div className="notification-title">{n.title}</div>
                  {n.message && <div className="notification-message">{n.message}</div>}
                  <div className="notification-time">{timeAgo(n.createdAt)}</div>
                </div>
                <div className="notification-actions" onClick={(e) => e.stopPropagation()}>
                  <button
                    className="action-btn delete-btn"
                    title="Delete"
                    onClick={() => void deleteNotification(n.id)}
                  >
                    <Trash2 size={16} />
                  </button>
                </div>
              </div>
            ))
          )}
        </div>

        {totalPages > 1 && (
          <div className="pagination">
            <button
              disabled={currentPage === 1}
              onClick={() => setCurrentPage((p) => p - 1)}
            >
              Previous
            </button>
            <span className="page-info">
              Page {currentPage} of {totalPages}
            </span>
            <button
              disabled={currentPage === totalPages}
              onClick={() => setCurrentPage((p) => p + 1)}
            >
              Next
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
