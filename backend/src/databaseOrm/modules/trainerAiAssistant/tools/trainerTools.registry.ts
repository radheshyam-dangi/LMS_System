/**
 * Standardized OpenAI / Groq Tool Registry for Autonomous LMS AI Agent
 *
 * Implements strict RBAC Tool Definitions and Role Filtering:
 * - Trainee: strictly restricted to vector_search_curriculum and web_search.
 * - Trainer: database querying, curriculum generation, mutation (ownership gated), search, actions.
 * - Admin: unrestricted full platform tool capabilities.
 */

export interface ToolFunctionDefinition {
  name: string;
  description: string;
  parameters: {
    type: 'object';
    properties: Record<string, any>;
    required?: string[];
  };
}

export interface ToolDefinition {
  type: 'function';
  function: ToolFunctionDefinition;
}

export const QUERY_DATABASE_TRAINEES_TOOL: ToolDefinition = {
  type: 'function',
  function: {
    name: 'query_database_trainees',
    description:
      'Queries registered trainee and learner records, active/inactive statuses, headcount, enrolled paths count, and filters by specific course enrollment (e.g. "enrolled in Machine Learning path") or whether they have courses assigned by a trainer.',
    parameters: {
      type: 'object',
      properties: {
        status: {
          type: 'string',
          enum: ['all', 'active', 'inactive'],
          description: "Filter by active or inactive status. Default is 'all'.",
        },
        search: {
          type: 'string',
          description: 'Optional search term for trainee name, email, or username.',
        },
        course_name_or_id: {
          type: 'string',
          description: 'Optional course title or ID (e.g. "Machine Learning", "DevOps Engineering") to filter trainees specifically enrolled in that path.',
        },
        has_assigned_paths: {
          type: 'boolean',
          description: 'Set to true when querying trainees who currently have at least one course assigned by a trainer.',
        },
        assigned_by_trainer: {
          type: 'string',
          description: 'Optional trainer name or email to filter trainees assigned by that specific instructor.',
        },
        limit: {
          type: 'integer',
          description: 'Maximum number of records to return (default 50, max 100).',
        },
        count_only: {
          type: 'boolean',
          description: 'Set to true if user is asking only for the total count/headcount.',
        },
      },
      required: [],
    },
  },
};

export const QUERY_DATABASE_LEARNING_PATHS_TOOL: ToolDefinition = {
  type: 'function',
  function: {
    name: 'query_database_learning_paths',
    description:
      'Queries the PostgreSQL database for total Learning Paths (courses/curriculums), active courses, AI drafts, difficulty distribution, module and lesson counts, creator, and enrolled students count. Use whenever the trainer or admin asks: "how many learning paths exist", "list all learning paths", "total courses in database", "count courses", or wants to inspect course catalog metrics.',
    parameters: {
      type: 'object',
      properties: {
        status: {
          type: 'string',
          enum: ['all', 'active', 'draft'],
          description: "Filter by status: 'active', 'draft' (AI drafts), or 'all' (default).",
        },
        search: {
          type: 'string',
          description: 'Optional keyword to search course title or description.',
        },
        difficulty: {
          type: 'string',
          enum: ['all', 'Beginner', 'Intermediate', 'Advanced'],
          description: "Optional filter by difficulty level. Default is 'all'.",
        },
        trainer: {
          type: 'string',
          description: 'Optional trainer name, email, or "me" to filter courses authored by a specific instructor.',
        },
        limit: {
          type: 'integer',
          description: 'Maximum number of courses to list in detail (default 50, max 100).',
        },
        count_only: {
          type: 'boolean',
          description: 'Set to true if user is asking only for the total count or metrics breakdown.',
        },
      },
      required: [],
    },
  },
};

export const QUERY_DATABASE_TRAINERS_TOOL: ToolDefinition = {
  type: 'function',
  function: {
    name: 'query_database_trainers',
    description:
      'Queries the LMS PostgreSQL database for all registered Instructors/Trainers and Administrators, their contact emails, role, count of authored courses, and count of assigned trainees. Use when user asks: "who are the trainers", "list all trainers", "how many trainers exist in the system", "which trainer created course X", or wants to inspect trainer profiles.',
    parameters: {
      type: 'object',
      properties: {
        search: {
          type: 'string',
          description: 'Optional search keyword for trainer name or email.',
        },
        limit: {
          type: 'integer',
          description: 'Maximum number of trainers to return (default 50, max 100).',
        },
        count_only: {
          type: 'boolean',
          description: 'Set to true if user is asking only for the total trainer count.',
        },
      },
      required: [],
    },
  },
};

export const QUERY_DATABASE_ENROLLMENTS_TOOL: ToolDefinition = {
  type: 'function',
  function: {
    name: 'query_database_enrollments',
    description:
      'Queries student course enrollment and assignment relationships in PostgreSQL. Use for questions linking trainees, courses, and trainers, such as: "how many trainees have Learning Path Assigned by the trainer", "who is enrolled in DevOps Engineering", or "which courses are assigned to student X". Note: For trainee progress and completion percentage, use query_trainee_progress.',
    parameters: {
      type: 'object',
      properties: {
        course_title: {
          type: 'string',
          description: 'Optional course title or keyword (e.g. "Machine Learning", "DevOps") to filter enrollments.',
        },
        trainee_search: {
          type: 'string',
          description: 'Optional trainee name or email to filter enrollments for a specific learner.',
        },
        trainer_search: {
          type: 'string',
          description: 'Optional trainer name or email to filter enrollments assigned by that trainer.',
        },
        status: {
          type: 'string',
          enum: ['all', 'active', 'completed'],
          description: 'Filter enrollment status (default "all").',
        },
        limit: {
          type: 'integer',
          description: 'Maximum records to return (default 50, max 100).',
        },
        count_only: {
          type: 'boolean',
          description: 'Set to true if user only wants the count of enrollments or enrolled students.',
        },
      },
      required: [],
    },
  },
};

export const QUERY_TRAINEE_PROGRESS_TOOL: ToolDefinition = {
  type: 'function',
  function: {
    name: 'query_trainee_progress',
    description:
      'Queries real-time progress percentage, completed lessons count, submitted assessments count, and module-by-module breakdown for a trainee in a specific Learning Path or across all their courses. ALWAYS use this tool whenever a trainer asks about trainee progress, progress percentage, completion rate, or performance in a course (e.g. "Revaa Kub progress on DevOps Engineering", "what is Revaa\'s progress percentage", "how much has trainee X completed").',
    parameters: {
      type: 'object',
      properties: {
        trainee_name_or_email: {
          type: 'string',
          description: 'Name or email of the trainee (e.g. "Revaa Kub", "reva50@ethereal.email").',
        },
        course_name_or_id: {
          type: 'string',
          description: 'Optional course title or keyword (e.g. "DevOps Engineering", "Machine Learning"). If omitted, returns progress for all courses the trainee is enrolled in.',
        },
      },
      required: ['trainee_name_or_email'],
    },
  },
};

export const CREATE_LEARNING_PATH_TOOL: ToolDefinition = {
  type: 'function',
  function: {
    name: 'create_learning_path',
    description:
      'Generates a complete new curriculum / learning path with modules, lessons, assignments, and study resources based on requirements. Automatically generates a staged draft action card for trainer review in Studio.',
    parameters: {
      type: 'object',
      properties: {
        title: {
          type: 'string',
          description: 'Title or core topic of the curriculum to create.',
        },
        level: {
          type: 'string',
          enum: ['Beginner', 'Intermediate', 'Advanced'],
          description: 'Target difficulty level.',
        },
        moduleCount: {
          type: 'integer',
          description: 'Number of modules to generate (default 3, max 6).',
        },
        prompt: {
          type: 'string',
          description: "The trainer's detailed specifications and requirements for the course.",
        },
      },
      required: [],
    },
  },
};

export const MUTATE_CURRICULUM_TOOL: ToolDefinition = {
  type: 'function',
  function: {
    name: 'mutate_curriculum',
    description:
      'Adds, updates, or deletes modules, lessons, assignments, questions, or resources in an existing Learning Path OR an active AI draft. Use when trainer asks to add, remove, delete, drop, update, or edit any module, lesson, assignment, or question (e.g. "delete module 3", "remove lesson 2"). Subject to ownership verification.',
    parameters: {
      type: 'object',
      properties: {
        lpId: {
          type: 'string',
          description: 'Target Learning Path UUID if explicitly known. Omit if unknown.',
        },
        lpTitle: {
          type: 'string',
          description: 'Optional title of the Learning Path or draft to modify.',
        },
        instruction: {
          type: 'string',
          description: "The modification instruction (e.g. 'delete module 3 and keep remaining 2').",
        },
        summary: {
          type: 'string',
          description: "A short, crystal-clear summary of the operation to display in the action card (e.g. 'Delete Module 3 (\"Applied Cybersecurity in Real-World Operations\")').",
        },
      },
      required: [],
    },
  },
};

export const VECTOR_SEARCH_CURRICULUM_TOOL: ToolDefinition = {
  type: 'function',
  function: {
    name: 'vector_search_curriculum',
    description:
      'Searches internal LMS courses, modules, lessons, and assignments using semantic embedding and hybrid keyword search. Safe for all roles.',
    parameters: {
      type: 'object',
      properties: {
        query: {
          type: 'string',
          description: 'The conceptual query or topic to search across internal curriculum.',
        },
        lpId: {
          type: 'string',
          description: 'Optional filter to scope search to a specific Learning Path.',
        },
      },
      required: [],
    },
  },
};

export const WEB_SEARCH_TOOL: ToolDefinition = {
  type: 'function',
  function: {
    name: 'web_search',
    description:
      'Searches external documentation, technical articles, tutorials, or YouTube videos to supplement curriculum planning or student research. Safe for all roles.',
    parameters: {
      type: 'object',
      properties: {
        query: {
          type: 'string',
          description: 'External search query.',
        },
        topic: {
          type: 'string',
          enum: ['general', 'documentation', 'youtube'],
          description: 'Focus category for the search.',
        },
      },
      required: [],
    },
  },
};

export const MANAGE_PENDING_ACTION_TOOL: ToolDefinition = {
  type: 'function',
  function: {
    name: 'manage_pending_action',
    description:
      "Confirms or cancels a pending staged curriculum action (such as confirming a newly created draft course or cancelling an update). Use when user explicitly asks to confirm, apply, cancel, discard, or revert.",
    parameters: {
      type: 'object',
      properties: {
        action: {
          type: 'string',
          enum: ['confirm', 'cancel'],
          description: "Whether to 'confirm' or 'cancel' the pending action.",
        },
      },
      required: [],
    },
  },
};

/**
 * Dynamic Tool Gating (Tier 1 Defense):
 * Returns only the tools that the user's role is strictly authorized to use.
 */
export function getToolsForRole(role: string): ToolDefinition[] {
  const normalized = (role || '').toLowerCase().trim();

  if (normalized === 'admin') {
    return [
      QUERY_DATABASE_LEARNING_PATHS_TOOL,
      QUERY_DATABASE_TRAINEES_TOOL,
      QUERY_DATABASE_TRAINERS_TOOL,
      QUERY_DATABASE_ENROLLMENTS_TOOL,
      QUERY_TRAINEE_PROGRESS_TOOL,
      CREATE_LEARNING_PATH_TOOL,
      MUTATE_CURRICULUM_TOOL,
      VECTOR_SEARCH_CURRICULUM_TOOL,
      WEB_SEARCH_TOOL,
      MANAGE_PENDING_ACTION_TOOL,
    ];
  }

  if (normalized === 'trainer') {
    return [
      QUERY_DATABASE_LEARNING_PATHS_TOOL,
      QUERY_DATABASE_TRAINEES_TOOL,
      QUERY_DATABASE_TRAINERS_TOOL,
      QUERY_DATABASE_ENROLLMENTS_TOOL,
      QUERY_TRAINEE_PROGRESS_TOOL,
      CREATE_LEARNING_PATH_TOOL,
      MUTATE_CURRICULUM_TOOL,
      VECTOR_SEARCH_CURRICULUM_TOOL,
      WEB_SEARCH_TOOL,
      MANAGE_PENDING_ACTION_TOOL,
    ];
  }

  // Trainee or unprivileged roles:
  // Can query published course catalog, search internal curriculum, and search web.
  // Administrative authoring / mutation tools are strictly NEVER exposed.
  return [
    QUERY_DATABASE_LEARNING_PATHS_TOOL,
    VECTOR_SEARCH_CURRICULUM_TOOL,
    WEB_SEARCH_TOOL,
  ];
}

