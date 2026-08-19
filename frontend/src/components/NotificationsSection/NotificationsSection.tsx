import React from 'react';
import { useNotifications } from '../../context/NotificationContext';
import { Bell, Trash2, CheckCircle } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

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

export function NotificationsSection() {
  const { notifications, markAsRead, markAllRead, deleteNotification, unreadCount } = useNotifications();
  const navigate = useNavigate();

  return (
    <div style={{ padding: '24px', maxWidth: '800px', margin: '0 auto' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
        <div>
          <h2 style={{ fontSize: '24px', fontWeight: 700, color: '#0f172a', margin: 0, display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Bell size={24} /> Notification History
          </h2>
          <p style={{ color: '#64748b', marginTop: '8px' }}>
            View your recent alerts, assignments, and updates.
          </p>
        </div>
        {unreadCount > 0 && (
          <button
            onClick={() => void markAllRead()}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              padding: '8px 16px',
              background: '#e0e7ff',
              color: '#4f46e5',
              border: 'none',
              borderRadius: '6px',
              fontWeight: 600,
              fontSize: '14px',
              cursor: 'pointer',
              transition: 'background 0.2s'
            }}
            onMouseEnter={(e) => (e.currentTarget.style.background = '#c7d2fe')}
            onMouseLeave={(e) => (e.currentTarget.style.background = '#e0e7ff')}
          >
            <CheckCircle size={16} /> Mark all as read
          </button>
        )}
      </div>

      {notifications.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '64px 24px', background: '#fff', borderRadius: '12px', border: '1px solid #e2e8f0' }}>
          <div style={{ 
            width: '64px', height: '64px', borderRadius: '50%', background: '#f1f5f9', 
            display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px' 
          }}>
            <Bell size={32} color="#94a3b8" />
          </div>
          <h3 style={{ fontSize: '18px', fontWeight: 600, color: '#334155', margin: '0 0 8px' }}>You're all caught up!</h3>
          <p style={{ color: '#64748b', margin: 0 }}>There are no notifications to display at this time.</p>
        </div>
      ) : (
        <div style={{ background: '#fff', borderRadius: '12px', border: '1px solid #e2e8f0', overflow: 'hidden' }}>
          {notifications.map((n, i) => (
            <div
              key={n.id}
              onClick={() => {
                void markAsRead(n.id);
                if (n.link) navigate(n.link);
              }}
              style={{
                position: 'relative',
                display: 'flex',
                alignItems: 'flex-start',
                padding: '20px 24px',
                borderBottom: i < notifications.length - 1 ? '1px solid #f1f5f9' : 'none',
                background: n.isRead ? '#fff' : '#f0f9ff',
                cursor: 'pointer',
                transition: 'background 0.2s',
                gap: '16px'
              }}
              onMouseEnter={(e) => (e.currentTarget.style.background = n.isRead ? '#f8fafc' : '#e0f2fe')}
              onMouseLeave={(e) => (e.currentTarget.style.background = n.isRead ? '#fff' : '#f0f9ff')}
            >
              {!n.isRead ? (
                <div style={{ minWidth: '10px', height: '10px', borderRadius: '50%', background: '#3b82f6', marginTop: '6px' }} />
              ) : (
                <div style={{ minWidth: '10px', height: '10px' }} />
              )}
              
              <div style={{ flex: 1 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '4px' }}>
                  <div style={{ fontSize: '15px', fontWeight: n.isRead ? 500 : 700, color: n.isRead ? '#475569' : '#0f172a' }}>
                    {n.title}
                  </div>
                  <div style={{ fontSize: '12px', color: '#94a3b8', whiteSpace: 'nowrap', marginLeft: '16px' }}>
                    {timeAgo(n.createdAt)}
                  </div>
                </div>
                
                {n.message && (
                  <div style={{ fontSize: '14px', color: n.isRead ? '#64748b' : '#334155', lineHeight: 1.5 }}>
                    {n.message}
                  </div>
                )}
              </div>

              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  void deleteNotification(n.id);
                }}
                style={{
                  background: 'none',
                  border: 'none',
                  color: '#cbd5e1',
                  cursor: 'pointer',
                  padding: '8px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  borderRadius: '6px',
                  marginLeft: '8px'
                }}
                onMouseEnter={(e) => { e.currentTarget.style.color = '#ef4444'; e.currentTarget.style.background = '#fee2e2'; }}
                onMouseLeave={(e) => { e.currentTarget.style.color = '#cbd5e1'; e.currentTarget.style.background = 'none'; }}
                title="Delete notification"
              >
                <Trash2 size={18} />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
