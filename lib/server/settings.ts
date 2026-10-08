import { all, run } from './db';

export const SETTING_DEFAULTS = {
  pass_score: '80', // 퀴즈 통과 점수
  watch_ratio: '90', // 퀴즈 응시 가능 시청 비율(%)
  auto_approve: '0', // 가입 즉시 승인
  oauth_auto_approve: '0', // 소셜 가입 즉시 승인
  ai_model: 'gpt-4.1-mini',
  video_provider: '',
  kakao_client: '',
  kakao_secret: '',
  naver_client: '',
  naver_secret: '',
  resend_key: '',
  mail_from: '',
  site_name: '셀러브릭스 에듀',
  cert_signer: '셀러브릭스 에듀 운영팀',
  max_video_mb: '50',
  demo_mode: '1', // 체험 계정(교육생·최고 관리자) 허용. 운영에서는 0 권장
};
export type SettingKey = keyof typeof SETTING_DEFAULTS;

export async function getSettings(): Promise<Record<string, string>> {
  const rows = await all<{ id: string; value: string }>('SELECT id,value FROM settings');
  const map: Record<string, string> = { ...SETTING_DEFAULTS };
  for (const r of rows) map[r.id] = r.value;
  return map;
}

export async function setSetting(id: string, value: string) {
  await run('INSERT INTO settings (id,value) VALUES (?,?) ON CONFLICT(id) DO UPDATE SET value=excluded.value', id, value);
}

/** 클라이언트에 노출 가능한 설정(비밀 값 제외) */
const PUBLIC_KEYS = ['pass_score', 'watch_ratio', 'site_name', 'cert_signer', 'max_video_mb', 'demo_mode'];
const SECRET = ['ai_key', 'kakao_secret', 'naver_secret', 'resend_key'];
/** 모든 방문자에게 노출 가능한 설정만 */
export function publicSettings(map: Record<string, string>) {
  return Object.fromEntries(PUBLIC_KEYS.map((k) => [k, map[k] ?? '']));
}
/** 최고 관리자용: 비밀 값 제외 전체 + 비밀 값 존재 여부 */
export function adminSettingsView(map: Record<string, string>) {
  const result: Record<string, string> = {};
  for (const [k, v] of Object.entries(map)) if (!SECRET.includes(k) && !['schema_version', 'seed_complete', 'extras_seeded', 'curriculum_version'].includes(k)) result[k] = v;
  for (const k of SECRET) result['has_' + k] = map[k] ? '1' : '0';
  return result;
}

export const passScore = (s: Record<string, string>) => Math.min(100, Math.max(1, Number(s.pass_score) || 80));
export const watchRatio = (s: Record<string, string>) => Math.min(1, Math.max(0.1, (Number(s.watch_ratio) || 90) / 100));
