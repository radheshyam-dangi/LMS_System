import type { AppNotification } from '../services/notificationService';

export const getNotificationRoute = (n: AppNotification, role: string): string => {
  switch (n.type) {
    case 'learning_path_assigned':
      return n.relatedEntityId ? `/learning-paths/${n.relatedEntityId}` : '/learning-paths';
    case 'assignment_assigned':
    case 'submission_pending':
    case 'evaluation_completed':
      return n.relatedEntityId ? `/assignments?id=${n.relatedEntityId}` : '/assignments';
    default:
      return n.link || '/dashboard';
  }
};
