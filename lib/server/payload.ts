import { all, first } from './db';
import type { SessionUser } from './auth';
import { getSettings, publicSettings } from './settings';

const parseJson = (s: string, fallback: any) => {
  try {
    return JSON.parse(s);
  } catch {
    return fallback;
  }
};

/** 클라이언트가 한 번에 받는 전체 상태. 역할별로 노출 범위를 다르게 한다. */
export async function buildPayload(user: SessionUser | null) {
  const admin = user?.role === 'admin';
  const settingsMap = await getSettings();
  const settings = publicSettings(settingsMap);
  const oauth = {
    kakao: !!(settingsMap.kakao_client && settingsMap.kakao_secret),
    naver: !!(settingsMap.naver_client && settingsMap.naver_secret),
  };

  const courses = await all(admin ? 'SELECT * FROM courses ORDER BY position' : 'SELECT * FROM courses WHERE published=1 ORDER BY position');
  const rawLessons = await all(
    admin
      ? 'SELECT * FROM lessons ORDER BY position'
      : 'SELECT lessons.* FROM lessons JOIN courses ON courses.id=lessons.course_id WHERE courses.published=1 ORDER BY lessons.position',
  );
  const lessons = rawLessons.map((l: any) => ({
    ...l,
    questions: parseJson(l.questions, []).map(({ answer: _a, explanation: _e, ...q }: any) => q),
    chapters: parseJson(l.chapters || '[]', []),
  }));
  const ratings = await all<{ course_id: string; avg: number; count: number }>('SELECT course_id, AVG(rating) AS avg, COUNT(*) AS count FROM reviews GROUP BY course_id');
  const enrolled = await all<{ course_id: string; count: number }>(
    'SELECT lessons.course_id, COUNT(DISTINCT progress.user_id) AS count FROM progress JOIN lessons ON lessons.id=progress.lesson_id GROUP BY lessons.course_id',
  );
  const coursesOut = courses.map((c: any) => ({
    ...c,
    rating: Number(ratings.find((r) => r.course_id === c.id)?.avg || 0),
    reviewCount: Number(ratings.find((r) => r.course_id === c.id)?.count || 0),
    learners: Number(enrolled.find((r) => r.course_id === c.id)?.count || 0),
  }));
  const reviews = await all(
    'SELECT reviews.*, users.name, COALESCE(user_profiles.avatar,0) AS avatar FROM reviews JOIN users ON users.id=reviews.user_id LEFT JOIN user_profiles ON user_profiles.user_id=users.id ORDER BY reviews.created DESC LIMIT 200',
  );
  const announcements = user
    ? await all(
        admin
          ? 'SELECT announcements.*, cohorts.name AS cohort_name FROM announcements LEFT JOIN cohorts ON cohorts.id=announcements.cohort_id ORDER BY pinned DESC, created DESC'
          : `SELECT announcements.*, cohorts.name AS cohort_name FROM announcements LEFT JOIN cohorts ON cohorts.id=announcements.cohort_id
             WHERE announcements.cohort_id IS NULL OR announcements.cohort_id IN (SELECT cohort_id FROM memberships WHERE user_id=?) ORDER BY pinned DESC, created DESC LIMIT 100`,
        ...(admin ? [] : [user.id]),
      )
    : await all('SELECT *, NULL AS cohort_name FROM announcements WHERE cohort_id IS NULL ORDER BY pinned DESC, created DESC LIMIT 20');
  const cohorts = await all('SELECT * FROM cohorts ORDER BY starts DESC, name');

  const base: any = { user, settings, oauth, courses: coursesOut, lessons, reviews, announcements, cohorts };
  if (!user) return { ...base, progress: [], messages: [], memberships: [], channels: [], visits: [], notifications: [], notes: [], learningDays: [], certificates: [], assignments: [], submissions: [] };

  const [progress, notes, learningDays, certificates, memberships, channels, visits, notifications, assignments, submissions] = await Promise.all([
    all('SELECT * FROM progress WHERE user_id=?', user.id),
    all('SELECT * FROM lesson_notes WHERE user_id=? ORDER BY at', user.id),
    all('SELECT day, seconds, completed FROM learning_days WHERE user_id=? ORDER BY day DESC LIMIT 400', user.id),
    all('SELECT certificates.*, courses.title AS course_title FROM certificates JOIN courses ON courses.id=certificates.course_id WHERE user_id=? ORDER BY issued DESC', user.id),
    admin ? all('SELECT * FROM memberships') : all('SELECT * FROM memberships WHERE user_id=?', user.id),
    all(
      `SELECT channels.*, users.name, users.created AS joined, COALESCE(user_profiles.avatar,0) AS avatar, memberships.cohort_id
       FROM channels JOIN users ON users.id=channels.user_id LEFT JOIN user_profiles ON user_profiles.user_id=users.id LEFT JOIN memberships ON memberships.user_id=users.id
       WHERE users.status='active' AND (channels.shared=1 OR channels.user_id=?) ORDER BY channels.created DESC`,
      user.id,
    ),
    all('SELECT * FROM channel_visits WHERE user_id=?', user.id),
    all('SELECT * FROM notifications WHERE user_id=? ORDER BY created DESC LIMIT 60', user.id),
    all(admin ? 'SELECT * FROM assignments ORDER BY position' : 'SELECT assignments.* FROM assignments JOIN courses ON courses.id=assignments.course_id WHERE assignments.published=1 AND courses.published=1 ORDER BY assignments.position'),
    admin
      ? all('SELECT submissions.*, users.name, users.email FROM submissions JOIN users ON users.id=submissions.user_id ORDER BY submissions.created DESC')
      : all('SELECT * FROM submissions WHERE user_id=? ORDER BY created DESC', user.id),
  ]);

  // Q&A: 본인 질문 + 공개 질문(이름·추천수 포함)
  const messages = await all(
    admin
      ? `SELECT messages.*, users.name, users.email, COALESCE(user_profiles.avatar,0) AS avatar,
         (SELECT COUNT(*) FROM question_votes WHERE message_id=messages.id) AS votes,
         EXISTS(SELECT 1 FROM question_votes WHERE message_id=messages.id AND user_id=?) AS voted
         FROM messages JOIN users ON users.id=messages.user_id LEFT JOIN user_profiles ON user_profiles.user_id=users.id ORDER BY messages.pinned DESC, messages.created DESC`
      : `SELECT messages.*, users.name, COALESCE(user_profiles.avatar,0) AS avatar,
         (SELECT COUNT(*) FROM question_votes WHERE message_id=messages.id) AS votes,
         EXISTS(SELECT 1 FROM question_votes WHERE message_id=messages.id AND user_id=?) AS voted
         FROM messages JOIN users ON users.id=messages.user_id LEFT JOIN user_profiles ON user_profiles.user_id=users.id
         WHERE messages.user_id=? OR messages.public=1 ORDER BY messages.pinned DESC, messages.created DESC LIMIT 300`,
    ...(admin ? [user.id] : [user.id, user.id]),
  );

  const result: any = { ...base, progress, notes, learningDays, certificates, memberships, channels, visits, notifications, assignments, submissions, messages };

  if (admin) {
    const [users, allProgress, questions, activity, daily, resets, oauthAccounts, allCertificates] = await Promise.all([
      all(
        `SELECT users.id,users.name,users.email,users.role,users.status,users.created, COALESCE(user_profiles.avatar,0) AS avatar, memberships.cohort_id,
         CASE WHEN users.password IS NULL THEN 0 ELSE 1 END AS has_password,
         (SELECT MAX(created) FROM activity_log WHERE user_id=users.id) AS last_active,
         (SELECT COUNT(*) FROM progress WHERE user_id=users.id AND complete=1) AS completed,
         (SELECT COALESCE(SUM(watched),0) FROM progress WHERE user_id=users.id) AS watched
         FROM users LEFT JOIN user_profiles ON user_profiles.user_id=users.id LEFT JOIN memberships ON memberships.user_id=users.id ORDER BY users.created DESC`,
      ),
      all('SELECT * FROM progress'),
      all('SELECT id,questions FROM lessons'),
      all('SELECT activity_log.*, users.name FROM activity_log JOIN users ON users.id=activity_log.user_id ORDER BY activity_log.created DESC LIMIT 80'),
      all(`SELECT day, COUNT(DISTINCT user_id) AS learners, SUM(seconds) AS seconds, SUM(completed) AS completed FROM learning_days WHERE day>=? GROUP BY day ORDER BY day`, new Date(Date.now() - 29 * 86400000).toISOString().slice(0, 10)),
      all('SELECT password_resets.token, password_resets.user_id, password_resets.expires, users.name FROM password_resets JOIN users ON users.id=password_resets.user_id WHERE expires>? ORDER BY password_resets.created DESC', Date.now()),
      all('SELECT provider, user_id FROM oauth_accounts'),
      all('SELECT certificates.*, users.name, courses.title AS course_title FROM certificates JOIN users ON users.id=certificates.user_id JOIN courses ON courses.id=certificates.course_id ORDER BY issued DESC LIMIT 200'),
    ]);
    const hasAiKey = !!(await first(`SELECT id FROM settings WHERE id='ai_key'`));
    Object.assign(result, {
      users,
      allProgress,
      questions: questions.map((l: any) => ({ ...l, questions: parseJson(l.questions, []) })),
      activity,
      daily,
      resets,
      oauthAccounts,
      allCertificates,
      hasAiKey,
      adminSettings: settings,
    });
  }
  return result;
}
