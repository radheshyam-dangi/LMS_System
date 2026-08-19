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
  children: React.ReactNode;
};

export function NotificationProvider({ accessToken, children }: ProviderProps) {
  const [notifications, setNotifications] = useState<AppNotification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const tokenRef = useRef(accessToken);
  tokenRef.current = accessToken;

  const refresh = useCallback(async () => {
    const token = tokenRef.current;
    if (!token) {
      setNotifications([]);
      setUnreadCount(0);
      return;
    }
    try {
      const { items, unreadCount: count } = await notificationService.fetchNotifications(token);
      setNotifications(items);
      setUnreadCount(count);
    } catch {
      // Keep last known count on transient errors
    }
  }, []);

  useEffect(() => {
    if (!accessToken) {
      setNotifications([]);
      setUnreadCount(0);
      return;
    }
    void refresh();

    const intervalId = setInterval(() => {
      void refresh();
    }, 10000); // Poll every 10 seconds

    return () => clearInterval(intervalId);
  }, [accessToken, refresh]);

  const markAsRead = useCallback(
    async (id: string) => {
      if (!tokenRef.current) return;
      await notificationService.markAsRead(id, tokenRef.current);
      setNotifications((prev) =>
        prev.map((n) => (n.id === id ? { ...n, isRead: true } : n)),
      );
      setUnreadCount((c) => Math.max(0, c - 1));
      await refresh();
    },
    [refresh],
  );

  const markSectionRead = useCallback(
    async (section: string) => {
      if (!tokenRef.current) return;
      const types = SECTION_TYPES[section];
      if (!types?.length) return;
      const result = await notificationService.markByTypes(tokenRef.current, types);
      setUnreadCount(result.unreadCount);
      await refresh();
    },
    [refresh],
  );

  const markRelatedRead = useCallback(
    async (entityType: string, entityId: string) => {
      if (!tokenRef.current || !entityId) return;
      const result = await notificationService.markByRelatedEntity(
        tokenRef.current,
        entityType,
        entityId,
      );
      setUnreadCount(result.unreadCount);
      await refresh();
    },
    [refresh],
  );

  const markAllRead = useCallback(async () => {
    if (!tokenRef.current) return;
    await notificationService.markAllRead(tokenRef.current);
    setUnreadCount(0);
    setNotifications((prev) => prev.map((n) => ({ ...n, isRead: true })));
  }, []);

  const deleteNotification = useCallback(async (id: string) => {
    if (!tokenRef.current) return;
    await notificationService.deleteNotification(id, tokenRef.current);
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
