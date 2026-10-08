import { seed } from '../../../../../lib/server/db';
import { getSettings } from '../../../../../lib/server/settings';
import { finishOAuth, PROVIDERS, type Provider } from '../../../../../lib/server/oauth';
export const dynamic = 'force-dynamic';

export async function GET(req: Request, { params }: any) {
  const { provider } = await params;
  if (!PROVIDERS.includes(provider)) return new Response('지원하지 않는 로그인 방식입니다.', { status: 404 });
  await seed();
  const settings = await getSettings();
  return finishOAuth(req, provider as Provider, settings);
}
