import { env } from 'cloudflare:workers';
import { flattenCurriculum, CURRICULUM_VERSION } from '../curriculum';

export class HttpError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

export function database(): D1Database {
  const db = (env as any).DB as D1Database | undefined;
  if (!db) throw new HttpError(503, '교육 데이터를 불러올 수 없습니다. 잠시 후 다시 시도해 주세요.');
  return db;
}

export const bucket = (): R2Bucket | undefined => (env as any).BUCKET as R2Bucket | undefined;

export const now = () => new Date().toISOString();
export const uid = () => crypto.randomUUID();

/** KST 기준 YYYY-MM-DD */
export function kstDay(date = new Date()) {
  return new Date(date.getTime() + 9 * 3600 * 1000).toISOString().slice(0, 10);
}

export async function all<T = any>(sql: string, ...params: unknown[]): Promise<T[]> {
  const r = await database().prepare(sql).bind(...params).all();
  return r.results as T[];
}
export async function first<T = any>(sql: string, ...params: unknown[]): Promise<T | null> {
  return (await database().prepare(sql).bind(...params).first()) as T | null;
}
export async function run(sql: string, ...params: unknown[]) {
  return database().prepare(sql).bind(...params).run();
}
export function stmt(sql: string, ...params: unknown[]) {
  return database().prepare(sql).bind(...params);
}
export async function batch(statements: D1PreparedStatement[]) {
  if (statements.length) await database().batch(statements);
}

/**
 * 런타임 스키마 보정 — drizzle 마이그레이션이 적용되지 않은 환경(운영 D1 등)에서도
 * 새 기능이 동작하도록 테이블/컬럼을 멱등하게 추가한다. settings.schema_version 으로 1회만 수행.
 */
const SCHEMA_VERSION = '5';
const CREATE_TABLES = [
  // 기본 테이블 (0000/0001 마이그레이션과 동일, 빈 DB에서도 동작하도록)
  `CREATE TABLE IF NOT EXISTS users (id text PRIMARY KEY NOT NULL, email text NOT NULL, name text NOT NULL, role text NOT NULL, password text, status text DEFAULT 'active' NOT NULL, created text NOT NULL)`,
  `CREATE UNIQUE INDEX IF NOT EXISTS users_email_unique ON users (email)`,
  `CREATE TABLE IF NOT EXISTS sessions (id text PRIMARY KEY NOT NULL, user_id text NOT NULL, expires integer NOT NULL)`,
  `CREATE TABLE IF NOT EXISTS user_profiles (user_id text PRIMARY KEY NOT NULL, avatar integer NOT NULL, name_changes integer DEFAULT 0 NOT NULL)`,
  `CREATE TABLE IF NOT EXISTS courses (id text PRIMARY KEY NOT NULL, title text NOT NULL, description text NOT NULL, category text NOT NULL, image integer NOT NULL, position integer NOT NULL, published integer DEFAULT 1 NOT NULL)`,
  `CREATE TABLE IF NOT EXISTS lessons (id text PRIMARY KEY NOT NULL, course_id text NOT NULL, title text NOT NULL, summary text NOT NULL, duration integer NOT NULL, position integer NOT NULL, video text DEFAULT '' NOT NULL, questions text NOT NULL, resource text DEFAULT '' NOT NULL)`,
  `CREATE TABLE IF NOT EXISTS progress (user_id text NOT NULL, lesson_id text NOT NULL, position real DEFAULT 0 NOT NULL, watched real DEFAULT 0 NOT NULL, complete integer DEFAULT 0 NOT NULL, score integer, bookmark integer DEFAULT 0 NOT NULL, note text DEFAULT '' NOT NULL, updated text NOT NULL, PRIMARY KEY(user_id, lesson_id))`,
  `CREATE TABLE IF NOT EXISTS settings (id text PRIMARY KEY NOT NULL, value text NOT NULL)`,
  `CREATE TABLE IF NOT EXISTS messages (id text PRIMARY KEY NOT NULL, user_id text NOT NULL, lesson_id text, body text NOT NULL, reply text DEFAULT '' NOT NULL, created text NOT NULL)`,
  `CREATE TABLE IF NOT EXISTS cohorts (id text PRIMARY KEY NOT NULL, name text NOT NULL, starts text DEFAULT '' NOT NULL, ends text DEFAULT '' NOT NULL, description text DEFAULT '' NOT NULL, status text DEFAULT 'recruiting' NOT NULL)`,
  `CREATE TABLE IF NOT EXISTS memberships (user_id text PRIMARY KEY NOT NULL, cohort_id text NOT NULL)`,
  `CREATE TABLE IF NOT EXISTS channels (user_id text NOT NULL, platform text NOT NULL, url text NOT NULL, bio text DEFAULT '' NOT NULL, shared integer DEFAULT 1 NOT NULL, created text NOT NULL, PRIMARY KEY(user_id, platform))`,
  `CREATE TABLE IF NOT EXISTS channel_visits (user_id text NOT NULL, target_id text NOT NULL, platform text NOT NULL, created text NOT NULL, PRIMARY KEY(user_id, target_id, platform))`,
  `CREATE TABLE IF NOT EXISTS activity_log (id text PRIMARY KEY NOT NULL, user_id text NOT NULL, kind text NOT NULL, detail text DEFAULT '' NOT NULL, created text NOT NULL)`,
  `CREATE TABLE IF NOT EXISTS announcements (id text PRIMARY KEY NOT NULL, title text NOT NULL, body text NOT NULL, cohort_id text, pinned integer DEFAULT 0 NOT NULL, author_id text NOT NULL, created text NOT NULL)`,
  `CREATE TABLE IF NOT EXISTS assignments (id text PRIMARY KEY NOT NULL, course_id text NOT NULL, lesson_id text, title text NOT NULL, description text DEFAULT '' NOT NULL, due text DEFAULT '' NOT NULL, position integer DEFAULT 1 NOT NULL, published integer DEFAULT 1 NOT NULL, created text NOT NULL)`,
  `CREATE TABLE IF NOT EXISTS certificates (id text PRIMARY KEY NOT NULL, user_id text NOT NULL, course_id text NOT NULL, issued text NOT NULL)`,
  `CREATE TABLE IF NOT EXISTS learning_days (user_id text NOT NULL, day text NOT NULL, seconds real DEFAULT 0 NOT NULL, completed integer DEFAULT 0 NOT NULL, PRIMARY KEY(user_id, day))`,
  `CREATE TABLE IF NOT EXISTS lesson_notes (id text PRIMARY KEY NOT NULL, user_id text NOT NULL, lesson_id text NOT NULL, at real DEFAULT 0 NOT NULL, body text NOT NULL, created text NOT NULL)`,
  `CREATE TABLE IF NOT EXISTS login_attempts (key text PRIMARY KEY NOT NULL, count integer DEFAULT 0 NOT NULL, first integer NOT NULL)`,
  `CREATE TABLE IF NOT EXISTS notifications (id text PRIMARY KEY NOT NULL, user_id text NOT NULL, type text NOT NULL, title text NOT NULL, body text DEFAULT '' NOT NULL, link text DEFAULT '' NOT NULL, read integer DEFAULT 0 NOT NULL, created text NOT NULL)`,
  `CREATE TABLE IF NOT EXISTS oauth_accounts (provider text NOT NULL, provider_id text NOT NULL, user_id text NOT NULL, created text NOT NULL, PRIMARY KEY(provider, provider_id))`,
  `CREATE TABLE IF NOT EXISTS password_resets (token text PRIMARY KEY NOT NULL, user_id text NOT NULL, expires integer NOT NULL, created text NOT NULL)`,
  `CREATE TABLE IF NOT EXISTS question_votes (message_id text NOT NULL, user_id text NOT NULL, PRIMARY KEY(message_id, user_id))`,
  `CREATE TABLE IF NOT EXISTS reviews (user_id text NOT NULL, course_id text NOT NULL, rating integer NOT NULL, body text DEFAULT '' NOT NULL, created text NOT NULL, PRIMARY KEY(user_id, course_id))`,
  `CREATE TABLE IF NOT EXISTS submissions (id text PRIMARY KEY NOT NULL, assignment_id text NOT NULL, user_id text NOT NULL, body text DEFAULT '' NOT NULL, link text DEFAULT '' NOT NULL, status text DEFAULT 'submitted' NOT NULL, feedback text DEFAULT '' NOT NULL, score integer, created text NOT NULL, reviewed text DEFAULT '' NOT NULL)`,
  `CREATE TABLE IF NOT EXISTS paths (id text PRIMARY KEY NOT NULL, title text NOT NULL, description text DEFAULT '' NOT NULL, courses text DEFAULT '[]' NOT NULL, position integer DEFAULT 1 NOT NULL, published integer DEFAULT 1 NOT NULL, created text NOT NULL)`,
  `CREATE TABLE IF NOT EXISTS events (id text PRIMARY KEY NOT NULL, title text NOT NULL, description text DEFAULT '' NOT NULL, starts text NOT NULL, ends text DEFAULT '' NOT NULL, link text DEFAULT '' NOT NULL, location text DEFAULT '' NOT NULL, cohort_id text, capacity integer DEFAULT 0 NOT NULL, created_by text NOT NULL, created text NOT NULL)`,
  `CREATE TABLE IF NOT EXISTS event_rsvps (event_id text NOT NULL, user_id text NOT NULL, created text NOT NULL, PRIMARY KEY(event_id, user_id))`,
  `CREATE TABLE IF NOT EXISTS quiz_attempts (id text PRIMARY KEY NOT NULL, user_id text NOT NULL, lesson_id text NOT NULL, answers text NOT NULL, score integer NOT NULL, passed integer NOT NULL, created text NOT NULL)`,
  `CREATE TABLE IF NOT EXISTS lesson_files (id text PRIMARY KEY NOT NULL, lesson_id text NOT NULL, name text NOT NULL, key text NOT NULL, size integer NOT NULL, type text DEFAULT '' NOT NULL, created text NOT NULL)`,
  `CREATE TABLE IF NOT EXISTS faqs (id text PRIMARY KEY NOT NULL, question text NOT NULL, answer text NOT NULL, position integer DEFAULT 1 NOT NULL, published integer DEFAULT 1 NOT NULL)`,
  `CREATE TABLE IF NOT EXISTS posts (id text PRIMARY KEY NOT NULL, user_id text NOT NULL, category text DEFAULT '자유' NOT NULL, title text NOT NULL, body text NOT NULL, pinned integer DEFAULT 0 NOT NULL, locked integer DEFAULT 0 NOT NULL, created text NOT NULL, updated text NOT NULL)`,
  `CREATE TABLE IF NOT EXISTS comments (id text PRIMARY KEY NOT NULL, post_id text NOT NULL, user_id text NOT NULL, body text NOT NULL, created text NOT NULL)`,
  `CREATE TABLE IF NOT EXISTS post_likes (post_id text NOT NULL, user_id text NOT NULL, PRIMARY KEY(post_id, user_id))`,
  `CREATE INDEX IF NOT EXISTS idx_quiz_attempts_lesson ON quiz_attempts(lesson_id)`,
  `CREATE INDEX IF NOT EXISTS idx_comments_post ON comments(post_id)`,
  `CREATE INDEX IF NOT EXISTS idx_progress_user ON progress(user_id)`,
  `CREATE INDEX IF NOT EXISTS idx_notifications_user ON notifications(user_id, read)`,
  `CREATE INDEX IF NOT EXISTS idx_messages_lesson ON messages(lesson_id)`,
  `CREATE INDEX IF NOT EXISTS idx_sessions_user ON sessions(user_id)`,
];
const ADD_COLUMNS: [string, string, string][] = [
  ['courses', 'level', `text DEFAULT '입문' NOT NULL`],
  ['courses', 'objectives', `text DEFAULT '' NOT NULL`],
  ['courses', 'instructor', `text DEFAULT '' NOT NULL`],
  ['lessons', 'section', `text DEFAULT '' NOT NULL`],
  ['lessons', 'chapters', `text DEFAULT '[]' NOT NULL`],
  ['lessons', 'objectives', `text DEFAULT '' NOT NULL`],
  ['lessons', 'transcript', `text DEFAULT '' NOT NULL`],
  ['lessons', 'preview', `integer DEFAULT 0 NOT NULL`],
  ['messages', 'public', `integer DEFAULT 1 NOT NULL`],
  ['messages', 'resolved', `integer DEFAULT 0 NOT NULL`],
  ['messages', 'pinned', `integer DEFAULT 0 NOT NULL`],
  ['progress', 'attempts', `integer DEFAULT 0 NOT NULL`],
  ['progress', 'best_score', `integer`],
  ['progress', 'completed_at', `text DEFAULT '' NOT NULL`],
  ['user_profiles', 'weekly_goal', `integer DEFAULT 3 NOT NULL`],
  ['user_profiles', 'bio', `text DEFAULT '' NOT NULL`],
  ['user_profiles', 'memo', `text DEFAULT '' NOT NULL`],
];

let migrated = false;
export async function migrate() {
  if (migrated) return;
  const db = database();
  const v = await first<{ value: string }>(`SELECT value FROM settings WHERE id='schema_version'`).catch(() => null);
  if (v?.value === SCHEMA_VERSION) {
    migrated = true;
    return;
  }
  for (const sql of CREATE_TABLES) await db.prepare(sql).run();
  for (const [table, column, def] of ADD_COLUMNS) {
    const cols = await all<{ name: string }>(`PRAGMA table_info(${table})`);
    if (!cols.some((c) => c.name === column)) {
      try {
        await db.prepare(`ALTER TABLE ${table} ADD ${column} ${def}`).run();
      } catch (e) {
        console.warn('column add skipped', table, column, e);
      }
    }
  }
  await run(`INSERT INTO settings (id,value) VALUES ('schema_version',?) ON CONFLICT(id) DO UPDATE SET value=excluded.value`, SCHEMA_VERSION);
  // wrangler `d1 migrations apply` 가 같은 변경을 다시 적용하지 않도록 기록 (테이블이 없으면 무시)
  try {
    await db.prepare(`CREATE TABLE IF NOT EXISTS d1_migrations (id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT UNIQUE, applied_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP)`).run();
    await db.prepare(`INSERT OR IGNORE INTO d1_migrations (name) VALUES ('0000_strange_celestials.sql'),('0001_sad_black_crow.sql'),('0002_edu_v2.sql')`).run();
  } catch (e) {
    console.warn('migration bookkeeping skipped', e);
  }
  migrated = true;
}

export async function seed() {
  await migrate();
  const db = database();
  await run(`INSERT OR IGNORE INTO cohorts (id,name,starts,ends,description,status) VALUES ('cohort-1','1기','','','라이브 커머스를 처음 시작하는 셀러의 입문 교육','recruiting')`);
  await seedExtras();
  const cur = await first<{ value: string }>(`SELECT value FROM settings WHERE id='curriculum_version'`);
  if (cur?.value === CURRICULUM_VERSION) return;
  const { courses, lessons } = flattenCurriculum();
  // 새 항목은 추가, 기존 항목은 비어 있는 필드만 채운다(관리자 편집 보존)
  await batch(courses.map((c) => db.prepare('INSERT OR IGNORE INTO courses (id,title,description,category,image,position,published,level,objectives,instructor) VALUES (?,?,?,?,?,?,1,?,?,?)').bind(c.id, c.title, c.description, c.category, c.image, c.position, c.level, c.objectives, c.instructor)));
  await batch(courses.map((c) => db.prepare(`UPDATE courses SET objectives=CASE WHEN objectives='' THEN ? ELSE objectives END, instructor=CASE WHEN instructor='' THEN ? ELSE instructor END, level=CASE WHEN level='' THEN ? ELSE level END WHERE id=?`).bind(c.objectives, c.instructor, c.level, c.id)));
  for (let i = 0; i < lessons.length; i += 40) {
    await batch(lessons.slice(i, i + 40).map((l) => db.prepare('INSERT OR IGNORE INTO lessons (id,course_id,title,summary,duration,position,video,questions,resource,section,chapters,objectives,preview) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)').bind(l.id, l.course_id, l.title, l.summary, l.duration, l.position, l.video, l.questions, l.resource, l.section, l.chapters, l.objectives, l.preview)));
  }
  // v1 시드 강의(기본 문구·기본 퀴즈)만 v2 콘텐츠로 교체 — 관리자가 수정한 강의는 유지
  const legacySummary = '의 핵심 개념을 이해하고 실제 방송에 적용합니다. 학습 후 체크리스트를 작성하고 확인 문제로 배운 내용을 정리하세요.';
  for (let i = 0; i < lessons.length; i += 40) {
    await batch(lessons.slice(i, i + 40).map((l) => db.prepare(`UPDATE lessons SET title=?,summary=?,duration=?,questions=?,resource=?,section=?,chapters=?,objectives=?,preview=? WHERE id=? AND instr(summary, ?)>0`).bind(l.title, l.summary, l.duration, l.questions, l.resource, l.section, l.chapters, l.objectives, l.preview, l.id, legacySummary)));
    await batch(lessons.slice(i, i + 40).map((l) => db.prepare(`UPDATE lessons SET section=CASE WHEN section='' THEN ? ELSE section END, chapters=CASE WHEN chapters IN ('','[]') THEN ? ELSE chapters END, objectives=CASE WHEN objectives='' THEN ? ELSE objectives END WHERE id=?`).bind(l.section, l.chapters, l.objectives, l.id)));
  }
  await run(`INSERT INTO settings (id,value) VALUES ('curriculum_version',?) ON CONFLICT(id) DO UPDATE SET value=excluded.value`, CURRICULUM_VERSION);
  await run(`INSERT OR IGNORE INTO settings (id,value) VALUES ('seed_complete','1')`);
}

const DEFAULT_FAQS: [string, string][] = [
  ['셀러브릭스 회원이면 바로 교육을 받을 수 있나요?', '교육 가입 신청 후 관리자가 셀러 자격을 확인하고 승인하면 학습할 수 있습니다. 승인되면 알림으로 안내해 드려요.'],
  ['학습 진도는 어떻게 계산되나요?', '각 강의에서 기준 비율 이상 시청과 확인 문제 통과 점수를 충족하면 완료됩니다. 과정 진도는 전체 강의 중 완료 강의의 비율입니다.'],
  ['확인 문제를 다시 풀 수 있나요?', '네, 횟수 제한 없이 재도전할 수 있습니다. 최고 점수가 기록되고, 통과하면 강의가 완료 처리됩니다.'],
  ['모바일에서도 이용할 수 있나요?', '스마트폰에 맞춘 학습 화면으로 영상, 확인 문제, 노트, 라운지를 이용할 수 있습니다.'],
  ['수료증은 어떻게 확인하나요?', '수료증에는 고유 검증 번호가 있습니다. 누구나 수료증 확인 페이지에서 번호로 진위를 확인할 수 있어요.'],
  ['라이브 세션은 어떻게 참여하나요?', '일정 메뉴에서 참석 신청을 하면 시작 전 알림을 받고, 세션 링크로 입장할 수 있습니다.'],
];
async function seedExtras() {
  if (await first(`SELECT id FROM settings WHERE id='extras_seeded'`)) return;
  const db = database();
  await batch(DEFAULT_FAQS.map(([q, a], i) => db.prepare('INSERT OR IGNORE INTO faqs (id,question,answer,position,published) VALUES (?,?,?,?,1)').bind('faq-' + (i + 1), q, a, i + 1)));
  await run('INSERT OR IGNORE INTO paths (id,title,description,courses,position,published,created) VALUES (?,?,?,?,1,1,?)', 'path-first-live', '첫 라이브 4주 완성', '입문 → 상품 기획 → 방송 준비 → 실전 판매. 4주 안에 첫 방송을 여는 기본 경로입니다.', JSON.stringify(['start', 'sourcing', 'studio', 'selling']), now());
  await run('INSERT OR IGNORE INTO paths (id,title,description,courses,position,published,created) VALUES (?,?,?,?,2,1,?)', 'path-growth', '꾸준히 성장하는 셀러', '마케팅 → 고객 관리 → 브랜딩 → 운영·정산 → 데이터 분석 → 법규. 첫 방송 이후 오래가는 판매를 위한 경로입니다.', JSON.stringify(['marketing', 'crm', 'branding', 'operation', 'analytics', 'legal']), now());
  await run(`INSERT OR IGNORE INTO settings (id,value) VALUES ('extras_seeded','1')`);
}
