import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import {
  notificationService,
  type AppNotification,
  type NotificationType,
} from '../services/notificationService';

type NotificationContextValue = {
  notifications: AppNotification[];
  unreadCount: number;
  refresh: () => Promise<void>;
  markAsRead: (id: string) => Promise<void>;
  markSectionRead: (section: string) => Promise<void>;
  markRelatedRead: (entityType: string, entityId: string) => Promise<void>;
  markAllRead: () => Promise<void>;
  deleteNotification: (id: string) => Promise<void>;
};

const NotificationContext = createContext<NotificationContextValue | null>(null);

const SECTION_TYPES: Record<string, NotificationType[]> = {
  'Learning Paths': ['learning_path_assigned'],
  Assignments: ['assignment_assigned', 'evaluation_completed'],
  Evaluations: ['submission_pending'],
};

type ProviderProps = {
  accessToken: string;
  activeRole: string;
  children: React.ReactNode;
};

export function NotificationProvider({ accessToken, activeRole, children }: ProviderProps) {
  const [notifications, setNotifications] = useState<AppNotification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const tokenRef = useRef(accessToken);
  const roleRef = useRef(activeRole);
  tokenRef.current = accessToken;
  roleRef.current = activeRole;

  const refresh = useCallback(async () => {
    const token = tokenRef.current;
    const role = roleRef.current;
    if (!token || !role) {
      setNotifications([]);
      setUnreadCount(0);
      return;
    }
    try {
      const { items, unreadCount: count } = await notificationService.fetchNotifications(token, role);
      setNotifications(items);
      setUnreadCount(count);
    } catch {
      // Keep last known count on transient errors
    }
  }, []);

  useEffect(() => {
    if (!accessToken || !activeRole) {
      setNotifications([]);
      setUnreadCount(0);
      return;
    }
    void refresh();
  }, [accessToken, activeRole, refresh]);

  const markAsRead = useCallback(
    async (id: string) => {
      if (!tokenRef.current || !roleRef.current) return;
      
      let wasUnread = false;
      setNotifications((prev) => {
        const target = prev.find(n => n.id === id);
        if (target && !target.isRead) {
          wasUnread = true;
          return prev.map((n) => (n.id === id ? { ...n, isRead: true } : n));
        }
        return prev;
      });

      if (wasUnread) {
        setUnreadCount((c) => Math.max(0, c - 1));
        await notificationService.markAsRead(id, tokenRef.current, roleRef.current);
        await refresh();
      }
    },
    [refresh],
  );

  const markSectionRead = useCallback(
    async (section: string) => {
      if (!tokenRef.current || !roleRef.current) return;
      const types = SECTION_TYPES[section];
      if (!types?.length) return;
      const result = await notificationService.markByTypes(tokenRef.current, roleRef.current, types);
      setUnreadCount(result.unreadCount);
      await refresh();
    },
    [refresh],
  );

  const markRelatedRead = useCallback(
    async (entityType: string, entityId: string) => {
      if (!tokenRef.current || !roleRef.current || !entityId) return;
      const result = await notificationService.markByRelatedEntity(
        tokenRef.current,
        roleRef.current,
        entityType,
        entityId,
      );
      setUnreadCount(result.unreadCount);
      await refresh();
    },
    [refresh],
  );

  const markAllRead = useCallback(async () => {
    if (!tokenRef.current || !roleRef.current) return;
    await notificationService.markAllRead(tokenRef.current, roleRef.current);
    setUnreadCount(0);
    setNotifications((prev) => prev.map((n) => ({ ...n, isRead: true })));
  }, []);

  const deleteNotification = useCallback(async (id: string) => {
    if (!tokenRef.current || !roleRef.current) return;
    await notificationService.deleteNotification(id, tokenRef.current, roleRef.current);
    setNotifications((prev) => {
      const removed = prev.find(n => n.id === id);
      if (removed && !removed.isRead) {
         setUnreadCount(c => Math.max(0, c - 1));
      }
      return prev.filter((n) => n.id !== id);
    });
  }, []);

  const value = useMemo(
    () => ({
      notifications,
      unreadCount,
      refresh,
      markAsRead,
      markSectionRead,
      markRelatedRead,
      markAllRead,
      deleteNotification,
    }),
    [notifications, unreadCount, refresh, markAsRead, markSectionRead, markRelatedRead, markAllRead, deleteNotification],
  );

  return (
    <NotificationContext.Provider value={value}>{children}</NotificationContext.Provider>
  );
}

export function useNotifications() {
  const ctx = useContext(NotificationContext);
  if (!ctx) {
    return {
      notifications: [] as AppNotification[],
      unreadCount: 0,
      refresh: async () => undefined,
      markAsRead: async () => undefined,
      markSectionRead: async () => undefined,
      markRelatedRead: async () => undefined,
      markAllRead: async () => undefined,
      deleteNotification: async () => undefined,
    };
  }
  return ctx;
}
