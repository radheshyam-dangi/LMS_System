import type { AppNotification } from '../services/notificationService';

/**
 * Intelligent role-aware route resolver for system notifications.
 * Directs trainees and trainers to the exact module, curriculum, or assignment review.
 */
export const getNotificationRoute = (n: AppNotification, role: string): string => {
  const normRole = (role || '').toLowerCase();
  const isTrainerOrAdmin = normRole === 'trainer' || normRole === 'admin';

  switch (n.type) {
    case 'learning_path_assigned':
      // Both Trainee and Trainer: routes to the specific Learning Path's all module page
      return n.relatedEntityId ? `/learning-paths/${n.relatedEntityId}` : '/learning-paths';

    case 'assignment_assigned':
      return n.relatedEntityId ? `/assignments?id=${n.relatedEntityId}` : '/assignments';

    case 'submission_pending':
    case 'ai_evaluation_ready':
    case 'ai_evaluation_failed':
      // Trainer review queue: target submission with evaluation tab
      return n.relatedEntityId
        ? `/assignments?id=${n.relatedEntityId}&tab=evaluations`
        : '/assignments?tab=evaluations';

    case 'evaluation_completed':
      // Trainee view: open evaluated assignment details/feedback
      return n.relatedEntityId ? `/assignments?id=${n.relatedEntityId}` : '/assignments';

    default:
      if (n.link) {
        if (n.link.startsWith('/evaluations')) {
          return n.relatedEntityId
            ? `/assignments?id=${n.relatedEntityId}&tab=evaluations`
            : '/assignments?tab=evaluations';
        }
        return n.link;
      }
      return '/dashboard';
  }
};
