export type RoleName = 'Admin' | 'Trainer' | 'Trainee';
export type PathDifficulty = 'Beginner' | 'Intermediate' | 'Advanced';
export type PathStatus = 'Active' | 'Upcoming' | 'Completed';

export interface LearningPath {
  modules: any;
  id: string;
  name: string;
  title ?: string;
  description: string;
  difficulty: PathDifficulty;
  duration: string;
  status: PathStatus;
  modulesCount: number;
  tasksCount: number;
  weeksCount: number;
  enrolledCount: number;
  overallProgress: number;
  skillsTags: string[];
  assignedToTraineeIds?: string[]; // Used to strictly filter for Trainee views
}

export type UserRole = {
  id?: string;
  name: RoleName | string;
};

export type UserStatus = 'invited' | 'activated';

export type AppUser = {
  id: string;
  email: string;
  firstName?: string;
  lastName?: string;
  roles?: UserRole[];
  primaryRole?: UserRole | RoleName | string;
  status?: UserStatus;
};

export type SessionUser = {
  id: string;
  email: string;
  firstName?: string;
  lastName?: string;
  roles: RoleName[];
  primaryRole: RoleName;
  status?: UserStatus;
};

export type LoginResponse = {
  user: AppUser;
  accessToken: string;
};

export type InviteUserPayload = {
  to: string;
  subject: string;
  firstName: string;
  lastName: string;
  roles: RoleName[];
  isPrimary: RoleName;
  
};
