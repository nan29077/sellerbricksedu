import { sqliteTable, text, integer, real, primaryKey } from 'drizzle-orm/sqlite-core';

// ───────────────────────── 계정 ─────────────────────────
export const users = sqliteTable('users', {
  id: text('id').primaryKey(),
  email: text('email').notNull().unique(),
  name: text('name').notNull(),
  role: text('role').notNull(), // 'student' | 'admin'
  password: text('password'),
  status: text('status').notNull().default('active'), // active | pending | suspended
  created: text('created').notNull(),
});

export const sessions = sqliteTable('sessions', {
  id: text('id').primaryKey(),
  userId: text('user_id').notNull(),
  expires: integer('expires').notNull(),
});

export const userProfiles = sqliteTable('user_profiles', {
  userId: text('user_id').primaryKey(),
  avatar: integer('avatar').notNull(),
  nameChanges: integer('name_changes').notNull().default(0),
  weeklyGoal: integer('weekly_goal').notNull().default(3), // 주간 학습 목표(강의 수)
  bio: text('bio').notNull().default(''),
});

export const oauthAccounts = sqliteTable(
  'oauth_accounts',
  {
    provider: text('provider').notNull(), // kakao | naver
    providerId: text('provider_id').notNull(),
    userId: text('user_id').notNull(),
    created: text('created').notNull(),
  },
  (t) => [primaryKey({ columns: [t.provider, t.providerId] })],
);

export const loginAttempts = sqliteTable('login_attempts', {
  key: text('key').primaryKey(), // email 또는 ip
  count: integer('count').notNull().default(0),
  first: integer('first').notNull(), // 윈도 시작 epoch ms
});

export const passwordResets = sqliteTable('password_resets', {
  token: text('token').primaryKey(),
  userId: text('user_id').notNull(),
  expires: integer('expires').notNull(),
  created: text('created').notNull(),
});

// ───────────────────────── 교육 콘텐츠 ─────────────────────────
export const courses = sqliteTable('courses', {
  id: text('id').primaryKey(),
  title: text('title').notNull(),
  description: text('description').notNull(),
  category: text('category').notNull(),
  image: integer('image').notNull(),
  position: integer('position').notNull(),
  published: integer('published').notNull().default(1),
  level: text('level').notNull().default('입문'), // 입문 | 초급 | 중급
  objectives: text('objectives').notNull().default(''), // 줄바꿈 구분 학습 목표
  instructor: text('instructor').notNull().default(''),
});

export const lessons = sqliteTable('lessons', {
  id: text('id').primaryKey(),
  courseId: text('course_id').notNull(),
  title: text('title').notNull(),
  summary: text('summary').notNull(),
  duration: integer('duration').notNull(),
  position: integer('position').notNull(),
  video: text('video').notNull().default(''),
  questions: text('questions').notNull(),
  resource: text('resource').notNull().default(''),
  section: text('section').notNull().default(''), // 커리큘럼 섹션 묶음
  chapters: text('chapters').notNull().default('[]'), // [{at:초,title}]
  objectives: text('objectives').notNull().default(''),
  transcript: text('transcript').notNull().default(''),
  preview: integer('preview').notNull().default(0), // 비로그인 미리보기 허용
});

export const assignments = sqliteTable('assignments', {
  id: text('id').primaryKey(),
  courseId: text('course_id').notNull(),
  lessonId: text('lesson_id'),
  title: text('title').notNull(),
  description: text('description').notNull().default(''),
  due: text('due').notNull().default(''),
  position: integer('position').notNull().default(1),
  published: integer('published').notNull().default(1),
  created: text('created').notNull(),
});

export const submissions = sqliteTable('submissions', {
  id: text('id').primaryKey(),
  assignmentId: text('assignment_id').notNull(),
  userId: text('user_id').notNull(),
  body: text('body').notNull().default(''),
  link: text('link').notNull().default(''),
  status: text('status').notNull().default('submitted'), // submitted | passed | revise
  feedback: text('feedback').notNull().default(''),
  score: integer('score'),
  created: text('created').notNull(),
  reviewed: text('reviewed').notNull().default(''),
});

// ───────────────────────── 학습 기록 ─────────────────────────
export const progress = sqliteTable(
  'progress',
  {
    userId: text('user_id').notNull(),
    lessonId: text('lesson_id').notNull(),
    position: real('position').notNull().default(0),
    watched: real('watched').notNull().default(0),
    complete: integer('complete').notNull().default(0),
    score: integer('score'),
    bookmark: integer('bookmark').notNull().default(0),
    note: text('note').notNull().default(''),
    updated: text('updated').notNull(),
    attempts: integer('attempts').notNull().default(0),
    bestScore: integer('best_score'),
    completedAt: text('completed_at').notNull().default(''),
  },
  (t) => [primaryKey({ columns: [t.userId, t.lessonId] })],
);

export const lessonNotes = sqliteTable('lesson_notes', {
  id: text('id').primaryKey(),
  userId: text('user_id').notNull(),
  lessonId: text('lesson_id').notNull(),
  at: real('at').notNull().default(0), // 영상 타임스탬프(초)
  body: text('body').notNull(),
  created: text('created').notNull(),
});

export const learningDays = sqliteTable(
  'learning_days',
  {
    userId: text('user_id').notNull(),
    day: text('day').notNull(), // YYYY-MM-DD (KST)
    seconds: real('seconds').notNull().default(0),
    completed: integer('completed').notNull().default(0), // 그날 완료한 강의 수
  },
  (t) => [primaryKey({ columns: [t.userId, t.day] })],
);

export const certificates = sqliteTable('certificates', {
  id: text('id').primaryKey(), // 검증 코드
  userId: text('user_id').notNull(),
  courseId: text('course_id').notNull(),
  issued: text('issued').notNull(),
});

export const reviews = sqliteTable(
  'reviews',
  {
    userId: text('user_id').notNull(),
    courseId: text('course_id').notNull(),
    rating: integer('rating').notNull(),
    body: text('body').notNull().default(''),
    created: text('created').notNull(),
  },
  (t) => [primaryKey({ columns: [t.userId, t.courseId] })],
);

// ───────────────────────── 소통 ─────────────────────────
export const messages = sqliteTable('messages', {
  id: text('id').primaryKey(),
  userId: text('user_id').notNull(),
  lessonId: text('lesson_id'),
  body: text('body').notNull(),
  reply: text('reply').notNull().default(''),
  created: text('created').notNull(),
  isPublic: integer('public').notNull().default(1),
  resolved: integer('resolved').notNull().default(0),
  pinned: integer('pinned').notNull().default(0),
});

export const questionVotes = sqliteTable(
  'question_votes',
  {
    messageId: text('message_id').notNull(),
    userId: text('user_id').notNull(),
  },
  (t) => [primaryKey({ columns: [t.messageId, t.userId] })],
);

export const announcements = sqliteTable('announcements', {
  id: text('id').primaryKey(),
  title: text('title').notNull(),
  body: text('body').notNull(),
  cohortId: text('cohort_id'), // null = 전체 공개
  pinned: integer('pinned').notNull().default(0),
  authorId: text('author_id').notNull(),
  created: text('created').notNull(),
});

export const notifications = sqliteTable('notifications', {
  id: text('id').primaryKey(),
  userId: text('user_id').notNull(),
  type: text('type').notNull(), // reply | announcement | assignment | approval | certificate | system
  title: text('title').notNull(),
  body: text('body').notNull().default(''),
  link: text('link').notNull().default(''),
  read: integer('read').notNull().default(0),
  created: text('created').notNull(),
});

export const activityLog = sqliteTable('activity_log', {
  id: text('id').primaryKey(),
  userId: text('user_id').notNull(),
  kind: text('kind').notNull(),
  detail: text('detail').notNull().default(''),
  created: text('created').notNull(),
});

// ───────────────────────── 기수·커뮤니티 ─────────────────────────
export const cohorts = sqliteTable('cohorts', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  starts: text('starts').notNull().default(''),
  ends: text('ends').notNull().default(''),
  description: text('description').notNull().default(''),
  status: text('status').notNull().default('recruiting'),
});

export const memberships = sqliteTable('memberships', {
  userId: text('user_id').primaryKey(),
  cohortId: text('cohort_id').notNull(),
});

export const channels = sqliteTable(
  'channels',
  {
    userId: text('user_id').notNull(),
    platform: text('platform').notNull(),
    url: text('url').notNull(),
    bio: text('bio').notNull().default(''),
    shared: integer('shared').notNull().default(1),
    created: text('created').notNull(),
  },
  (t) => [primaryKey({ columns: [t.userId, t.platform] })],
);

export const channelVisits = sqliteTable(
  'channel_visits',
  {
    userId: text('user_id').notNull(),
    targetId: text('target_id').notNull(),
    platform: text('platform').notNull(),
    created: text('created').notNull(),
  },
  (t) => [primaryKey({ columns: [t.userId, t.targetId, t.platform] })],
);

export const settings = sqliteTable('settings', {
  id: text('id').primaryKey(),
  value: text('value').notNull(),
});
