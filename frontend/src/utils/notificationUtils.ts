import type { AppNotification } from '../services/notificationService';

/**
 * Intelligent role-aware route resolver for system notifications.
 * Directs trainees and trainers to the exact module, curriculum, or assignment review.
 */
export const getNotificationRoute = (n: AppNotification, role: string): string => {
  const normRole = (role || '').toLowerCase();
  const isTrainerOrAdmin = normRole === 'trainer' || normRole === 'admin';

  // Support /assignments/:id path formats in link
  const assignmentPathMatch = n.link?.match(/^\/assignments\/([a-zA-Z0-9_-]+)/);
  if (assignmentPathMatch) {
    const extractedId = assignmentPathMatch[1];
    return isTrainerOrAdmin
      ? `/assignments?id=${extractedId}&tab=assignments`
      : `/assignments?id=${extractedId}`;
  }

  switch (n.type) {
    case 'learning_path_assigned':
      // Both Trainee and Trainer: routes to the specific Learning Path's all module page
      return n.relatedEntityId ? `/learning-paths/${n.relatedEntityId}` : '/learning-paths';

    case 'assignment_assigned':
      return n.relatedEntityId
        ? isTrainerOrAdmin
          ? `/assignments?id=${n.relatedEntityId}&tab=assignments`
          : `/assignments?id=${n.relatedEntityId}`
        : '/assignments';

    case 'submission_pending':
    case 'ai_evaluation_ready':
    case 'ai_evaluation_failed':
      // Trainer review queue: target submission with evaluation tab
      return n.relatedEntityId
        ? `/assignments?id=${n.relatedEntityId}&tab=evaluations`
        : '/assignments?tab=evaluations';

    case 'evaluation_completed':
      // Trainee view: open evaluated assignment details/feedback. Trainer view: evaluations tab
      if (isTrainerOrAdmin) {
        return n.relatedEntityId
          ? `/assignments?id=${n.relatedEntityId}&tab=evaluations`
          : '/assignments?tab=evaluations';
      }
      return n.relatedEntityId ? `/assignments?id=${n.relatedEntityId}` : '/assignments';

    default:
      if (n.relatedEntityType === 'assignment' || n.relatedEntityType === 'submission') {
        return n.relatedEntityId
          ? isTrainerOrAdmin
            ? `/assignments?id=${n.relatedEntityId}&tab=${n.relatedEntityType === 'submission' ? 'evaluations' : 'assignments'}`
            : `/assignments?id=${n.relatedEntityId}`
          : '/assignments';
      }
      if (n.link) {
        if (n.link.startsWith('/evaluations')) {
          return n.relatedEntityId
            ? `/assignments?id=${n.relatedEntityId}&tab=evaluations`
            : '/assignments?tab=evaluations';
        }
        if (n.link.startsWith('/assignments') && isTrainerOrAdmin && (n.relatedEntityType === 'submission' || n.type?.includes('evaluation'))) {
          return n.relatedEntityId
            ? `/assignments?id=${n.relatedEntityId}&tab=evaluations`
            : '/assignments?tab=evaluations';
        }
        if (n.link.startsWith('/assignments') && isTrainerOrAdmin && n.relatedEntityType === 'assignment') {
          return n.relatedEntityId
            ? `/assignments?id=${n.relatedEntityId}&tab=assignments`
            : '/assignments?tab=assignments';
        }
        return n.relatedEntityId && !n.link.includes('id=')
          ? `${n.link}?id=${n.relatedEntityId}`
          : n.link;
      }
      return '/dashboard';
  }
};
