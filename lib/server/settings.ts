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
};
export type SettingKey = keyof typeof SETTING_DEFAULTS;
export const SECRET_KEYS: SettingKey[] = ['ai_key' as SettingKey, 'kakao_secret', 'naver_secret', 'resend_key'];

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
export function publicSettings(map: Record<string, string>) {
  const result: Record<string, string> = {};
  for (const [k, v] of Object.entries(map)) {
    if (['ai_key', 'kakao_secret', 'naver_secret', 'resend_key', 'schema_version', 'seed_complete'].includes(k)) continue;
    result[k] = v;
  }
  return result;
}

export const passScore = (s: Record<string, string>) => Math.min(100, Math.max(1, Number(s.pass_score) || 80));
export const watchRatio = (s: Record<string, string>) => Math.min(1, Math.max(0.1, (Number(s.watch_ratio) || 90) / 100));
