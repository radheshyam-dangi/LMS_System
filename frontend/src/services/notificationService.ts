import axios from 'axios';
import { API_BASE_URL } from '../api';

const auth = (token: string) => ({
  headers: {
    Authorization: `Bearer ${token}`,
    'Content-Type': 'application/json',
  },
});

export type NotificationType =
  | 'learning_path_assigned'
  | 'assignment_assigned'
  | 'submission_pending'
  | 'evaluation_completed'
  | 'general';

export type AppNotification = {
  id: string;
  userId: string;
  type: NotificationType;
  title: string;
  message?: string;
  link?: string;
  relatedEntityType?: string;
  relatedEntityId?: string;
  isRead: boolean;
  readAt?: string;
  createdAt: string;
};

export const notificationService = {
  fetchNotifications: async (token: string, unreadOnly = false) => {
    const { data } = await axios.get(
      `${API_BASE_URL}/notifications${unreadOnly ? '?unreadOnly=true' : ''}`,
      auth(token),
    );
    return {
      items: (Array.isArray(data?.items) ? data.items : []) as AppNotification[],
      unreadCount: Number(data?.unreadCount ?? 0),
    };
  },

  fetchUnreadCount: async (token: string) => {
    const { data } = await axios.get(`${API_BASE_URL}/notifications/unread-count`, auth(token));
    return Number(data?.count ?? 0);
  },

  markAsRead: async (id: string, token: string) => {
    const { data } = await axios.put(`${API_BASE_URL}/notifications/${id}/read`, {}, auth(token));
    return data;
  },

  markByTypes: async (
    token: string,
    types: NotificationType[],
    relatedEntityId?: string,
  ) => {
    const { data } = await axios.post(
      `${API_BASE_URL}/notifications/mark-read`,
      { types, relatedEntityId },
      auth(token),
    );
    return {
      affected: Number(data?.affected ?? 0),
      unreadCount: Number(data?.unreadCount ?? 0),
    };
  },

  markByRelatedEntity: async (
    token: string,
    relatedEntityType: string,
    relatedEntityId: string,
  ) => {
    const { data } = await axios.post(
      `${API_BASE_URL}/notifications/mark-read`,
      { relatedEntityType, relatedEntityId },
      auth(token),
    );
    return {
      affected: Number(data?.affected ?? 0),
      unreadCount: Number(data?.unreadCount ?? 0),
    };
  },

  markAllRead: async (token: string) => {
    const { data } = await axios.post(
      `${API_BASE_URL}/notifications/mark-all-read`,
      {},
      auth(token),
    );
    return Number(data?.affected ?? 0);
  },
};
