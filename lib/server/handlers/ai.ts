import { first, HttpError } from '../db';
import { out, str } from '../http';
import type { AuthedCtx } from './types';

const PROMPTS = {
  draft: (topic: string) =>
    `당신은 한국어 라이브 커머스 셀러 교육 콘텐츠 작가입니다. 주제: ${topic}\n\n아래 형식의 마크다운으로 작성하세요.\n## 학습 목표 (3개, 행동 동사로)\n## 3분 영상 대본 (장면별로 [장면 n] 표기, 화면 구성 메모 포함)\n## 실전 체크리스트 (5개)\n## 확인 문제 (객관식 2개, 보기 3개, 정답과 해설)\n\n사실이 불확실하면 '확인 필요'라고 표시하세요.`,
  quiz: (topic: string) =>
    `한국어 라이브 커머스 셀러 교육용 객관식 확인 문제를 만드세요. 주제/강의 내용: ${topic}\n\n반드시 아래 JSON 배열만 출력하세요(설명 금지):\n[{"question":"문제","options":["보기1","보기2","보기3"],"answer":0,"explanation":"해설"}]\n문제는 3개, 보기는 3개씩, answer 는 0부터 시작하는 정답 인덱스입니다.`,
  chapters: (topic: string) =>
    `다음 강의 대본/내용을 챕터로 나눠 주세요. 내용: ${topic}\n\n반드시 아래 JSON 배열만 출력하세요(설명 금지):\n[{"at":0,"title":"챕터 제목"}]\nat 은 초 단위 시작 시각이며 4~6개 챕터로 나눕니다.`,
  summary: (topic: string) => `다음 강의 내용을 교육생에게 보여줄 2문장 소개와 학습 목표 3개(줄바꿈 구분)로 정리하세요. 형식: 첫 줄에 소개, 그 다음 줄부터 목표 한 줄씩. 내용: ${topic}`,
};

export async function ai({ body }: AuthedCtx) {
  const key = await first<{ value: string }>(`SELECT value FROM settings WHERE id='ai_key'`);
  if (!key) throw new HttpError(400, '먼저 연동 설정에서 OpenAI API 키를 연결해 주세요. 연결 전에는 비용이 발생하지 않습니다.');
  const model = (await first<{ value: string }>(`SELECT value FROM settings WHERE id='ai_model'`))?.value || 'gpt-4.1-mini';
  const mode = (['draft', 'quiz', 'chapters', 'summary'] as const).includes(body.mode) ? (body.mode as keyof typeof PROMPTS) : 'draft';
  const topic = str(body.topic, 6000);
  if (!topic) throw new HttpError(400, '주제나 내용을 입력해 주세요.');
  const response = await fetch('https://api.openai.com/v1/responses', {
    method: 'POST',
    headers: { Authorization: 'Bearer ' + key.value, 'Content-Type': 'application/json' },
    body: JSON.stringify({ model, input: PROMPTS[mode](topic), max_output_tokens: 2500 }),
  });
  if (!response.ok) throw new HttpError(502, 'AI 연결 또는 모델 설정을 확인해 주세요. 초안 생성에 실패했습니다.');
  const data: any = await response.json();
  const text: string = data.output?.flatMap((i: any) => i.content || []).filter((c: any) => c.type === 'output_text').map((c: any) => c.text).join('\n') || '';
  if (mode === 'quiz' || mode === 'chapters') {
    const match = text.match(/\[[\s\S]*\]/);
    try {
      const json = JSON.parse(match ? match[0] : text);
      return out({ ok: true, text, json });
    } catch {
      return out({ ok: true, text, json: null });
    }
  }
  return out({ ok: true, text: text || '생성 결과가 비어 있습니다.' });
}
