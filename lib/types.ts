export type Role = 'student' | 'admin' | 'manager';

export interface User {
  id: string;
  email: string;
  name: string;
  role: Role;
  status: string;
  created: string;
  avatar: number;
  name_changes: number;
  weekly_goal: number;
  bio: string;
  has_password: number;
}

export interface Course {
  id: string;
  title: string;
  description: string;
  category: string;
  image: number;
  position: number;
  published: number;
  level: string;
  objectives: string;
  instructor: string;
  rating: number;
  reviewCount: number;
  learners: number;
}

export interface Chapter { at: number; title: string }
export interface Question { question: string; options: string[]; answer?: number; explanation?: string }

export interface Lesson {
  id: string;
  course_id: string;
  title: string;
  summary: string;
  duration: number;
  position: number;
  video: string;
  questions: Question[];
  resource: string;
  section: string;
  chapters: Chapter[];
  objectives: string;
  transcript: string;
  preview: number;
}

export interface Progress {
  user_id: string;
  lesson_id: string;
  position: number;
  watched: number;
  complete: number;
  score: number | null;
  bookmark: number;
  note: string;
  updated: string;
  attempts: number;
  best_score: number | null;
  completed_at: string;
}

export interface LessonNote { id: string; user_id: string; lesson_id: string; at: number; body: string; created: string }
export interface LearningDay { day: string; seconds: number; completed: number }
export interface Certificate { id: string; user_id: string; course_id: string; issued: string; course_title: string; name?: string }
export interface Review { user_id: string; course_id: string; rating: number; body: string; created: string; name: string; avatar: number }
export interface Message { id: string; user_id: string; lesson_id: string | null; body: string; reply: string; created: string; public: number; resolved: number; pinned: number; name: string; email?: string; avatar: number; votes: number; voted: number }
export interface Announcement { id: string; title: string; body: string; cohort_id: string | null; pinned: number; author_id: string; created: string; cohort_name: string | null }
export interface Notification { id: string; user_id: string; type: string; title: string; body: string; link: string; read: number; created: string }
export interface Cohort { id: string; name: string; starts: string; ends: string; description: string; status: string }
export interface Membership { user_id: string; cohort_id: string }
export interface Channel { user_id: string; platform: string; url: string; bio: string; shared: number; created: string; name: string; joined: string; avatar: number; cohort_id: string | null }
export interface Visit { user_id: string; target_id: string; platform: string; created: string }
export interface Assignment { id: string; course_id: string; lesson_id: string | null; title: string; description: string; due: string; position: number; published: number; created: string }
export interface Submission { id: string; assignment_id: string; user_id: string; body: string; link: string; status: 'submitted' | 'passed' | 'revise'; feedback: string; score: number | null; created: string; reviewed: string; name?: string; email?: string }

export interface AdminUser {
  id: string; name: string; email: string; role: Role; status: string; created: string; avatar: number; memo: string; cohort_id: string | null; has_password: number; last_active: string | null; completed: number; watched: number;
}
export interface DailyStat { day: string; learners: number; seconds: number; completed: number }
export interface Activity { id: string; user_id: string; kind: string; detail: string; created: string; name: string }

export interface Payload {
  user: User | null;
  settings: Record<string, string>;
  oauth: { kakao: boolean; naver: boolean };
  courses: Course[];
  lessons: Lesson[];
  reviews: Review[];
  announcements: Announcement[];
  cohorts: Cohort[];
  progress: Progress[];
  notes: LessonNote[];
  learningDays: LearningDay[];
  certificates: Certificate[];
  memberships: Membership[];
  channels: Channel[];
  visits: Visit[];
  notifications: Notification[];
  assignments: Assignment[];
  submissions: Submission[];
  messages: Message[];
  // admin only
  users?: AdminUser[];
  allProgress?: Progress[];
  questions?: { id: string; questions: Question[] }[];
  activity?: Activity[];
  daily?: DailyStat[];
  resets?: { token: string; user_id: string; expires: number; name: string }[];
  oauthAccounts?: { provider: string; user_id: string }[];
  allCertificates?: Certificate[];
  hasAiKey?: boolean;
  adminSettings?: Record<string, string>;
  superAdmin?: boolean;
}
