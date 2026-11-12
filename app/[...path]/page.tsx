import type { Metadata } from 'next';
import { pageMetadata, SeoContent } from '../../lib/server/seo';

export const dynamic = 'force-dynamic';

export async function generateMetadata({ params }: { params: Promise<{ path?: string[] }> }): Promise<Metadata> {
  const { path = [] } = await params;
  return pageMetadata(path);
}

/** 화면은 클라이언트 앱(app/edu.tsx)이 그린다. 여기서는 검색엔진용 본문만 서버에서 렌더링 */
export default async function Page({ params }: { params: Promise<{ path?: string[] }> }) {
  const { path = [] } = await params;
  return <SeoContent path={path} />;
}
