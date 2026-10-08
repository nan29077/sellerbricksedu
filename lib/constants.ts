/** 클라이언트·서버 공용 상수 */
export const CATEGORY_META: { name: string; desc: string }[] = [
  { name: '입문', desc: '라이브 커머스의 구조와 셀러브릭스 시작 — 처음이라면 여기서부터' },
  { name: '상품 기획', desc: '팔릴 상품을 찾고, 구성하고, 가격을 정하는 소싱·기획' },
  { name: '방송 준비', desc: '장비·조명·스크립트·리허설 — 좋은 방송은 준비에서 시작' },
  { name: '실전 판매', desc: '오프닝부터 구매 전환까지, 방송 중 진행과 소통' },
  { name: '마케팅·SNS', desc: '방송 전후 시청자를 모으는 채널 운영과 콘텐츠' },
  { name: '고객 관리', desc: '첫 구매 고객을 단골로 만드는 응대·CRM·커뮤니티' },
  { name: '브랜딩', desc: '나만의 셀러 캐릭터와 스토리로 기억되는 방송 만들기' },
  { name: '운영·정산', desc: '주문·배송·정산·세무 — 오래가는 판매의 운영 기반' },
  { name: '데이터 분석', desc: '지표를 읽고 실험으로 다음 방송을 개선하는 성장 루프' },
  { name: '법규·안전', desc: '표시광고·전자상거래·개인정보 — 신뢰를 지키는 기준' },
];
export const CATEGORIES = ['전체', ...CATEGORY_META.map((c) => c.name)];
export const LEVELS = ['입문', '초급', '중급', '심화'];
export const PLATFORMS = ['youtube', 'instagram', 'tiktok', 'x', 'naver'];
export const ROLES = { student: '셀러 교육생', manager: '운영 관리자', admin: '최고 관리자' } as const;
export type Role = keyof typeof ROLES;
export const isStaff = (role?: string | null) => role === 'admin' || role === 'manager';
