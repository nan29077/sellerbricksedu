import { SeoContent } from '../lib/server/seo';

export const dynamic = 'force-dynamic';

/** 화면은 클라이언트 앱이 그린다. 검색엔진용 본문만 서버에서 렌더링 */
export default async function Home() {
  return <SeoContent path={[]} />;
}
