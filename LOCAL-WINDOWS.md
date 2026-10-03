# 셀러브릭스 에듀 — Windows 개발

최종 폴더: `E:\프로젝트\셀러브릭스에듀`
개발 주소: http://localhost:3037
현재 온라인 사이트: https://sellerbricks-edu.uncleku77.chatgpt.site/

## 첫 설치
1. ZIP을 내려받아 압축을 풉니다. 압축 안의 `sellerbricks` 폴더 이름을 `셀러브릭스에듀`로 바꾸고 `E:\프로젝트` 안으로 옮깁니다.
2. 해당 폴더 안에 `package.json`, `app`, `public`, `scripts`가 있어야 합니다. 폴더가 이중으로 들어가지 않게 확인하세요.
3. PowerShell에서 실행합니다.

```powershell
Set-Location 'E:\프로젝트\셀러브릭스에듀'
powershell -NoProfile -ExecutionPolicy Bypass -File .\scripts\setup-windows.ps1
```

Node.js 24 LTS, Corepack과 인터넷 연결이 필요합니다. 기존 링고 개발 환경과 같은 pnpm 11.25.0을 사용합니다. `node_modules`는 PC에서 새로 설치합니다.

## 개발 실행
```powershell
Set-Location 'E:\프로젝트\셀러브릭스에듀'
corepack pnpm dev
```
http://localhost:3037 을 열어주세요. 종료는 Ctrl+C입니다. 첫 실행에서 컴파일될 때까지 기다려주세요.
포트가 이미 사용 중이면 다른 프로세스를 확인하고 종료하세요. 강제로 다른 포트로 옮기지 않습니다.

## 로컬 로그인과 DB
로그인 화면의 교육생·최고 관리자 체험 버튼으로 바로 확인할 수 있습니다. 이메일 가입은 관리자 승인 후 로그인할 수 있습니다.
DB와 업로드 데이터는 `.wrangler/state`에 저장됩니다. 이 폴더를 삭제하면 로컬 데이터가 초기화되므로 보관하세요. 새로운 DB 변경을 받은 뒤 `corepack pnpm db:local`을 실행합니다. 실행할 때마다 기존 데이터가 삭제되지는 않습니다.

이 패키지는 전체 소스, 이미지, 30종 캐릭터, 샘플 강의, Git 이력을 포함합니다. 운영 사이트의 회원·진도·API 키·업로드 영상 데이터는 포함하지 않습니다. 로컬과 운영 사이트의 DB는 독립적입니다. 카카오·네이버 로그인과 AI 영상 생성은 추후 연동 항목입니다.

## GitHub 연결
보내주신 `chatgpt.site` 주소는 운영 사이트 URL입니다. 실제 GitHub 저장소 주소는 아직 확인되지 않아 origin을 등록하지 않았습니다. 기존 Git 이력과 main 브랜치는 포함했습니다.
실제 주소를 받으면 다음처럼 연결합니다. 아래 주소는 형식 예시이므로 본인 저장소 주소로 바꾸세요.

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File .\scripts\connect-github.ps1 -RepositoryUrl 'https://github.com/사용자명/저장소명.git'
git remote -v
```
비어 있는 새 저장소일 때만 `git push -u origin main`으로 업로드합니다. 기존 파일이나 이력이 있는 저장소는 먼저 확인하고 연결하세요. 강제 푸시는 하지 않습니다.

## 검증과 빌드
```powershell
corepack pnpm exec tsc --noEmit
corepack pnpm build
corepack pnpm start
```
`start`는 빌드된 사이트를 3037 포트로 확인합니다. `dev`와 동시에 실행하지 마세요. 기본 개발은 `dev`로 진행합니다.

로컬 설정은 운영 사이트에 자동으로 반영되지 않습니다. 폴더에서 Codex CLI를 실행하면 이 소스를 이어서 개발할 수 있습니다.
