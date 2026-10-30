# 권한 설정 및 월례대회 통합 전환

최고 관리자 로그인 이메일: `canyone2@naver.com`

## 역할

| 역할 | 회계 | 월례대회 | 계정 |
|---|---|---|---|
| 관리자 | 수정·삭제 | 수정·삭제 | 생성, 역할 변경, 권한 회수 |
| 총무 | 수정·삭제 | 보기 | - |
| 경기이사 | 보기 | 수정·삭제 | - |
| 방문자 | 보기 | 보기 | - |

- 권한은 화면뿐 아니라 `database.rules.json`에서도 적용합니다. 규칙은 `scripts/build-access-rules.cjs`로 생성합니다.
- 평소 수정은 관리자 승인 없이 저장되며, 관리자 승인은 계정과 권한에만 적용합니다.
- 공개 신청은 없앴습니다. 관리자가 **설정 → 총무·경기이사 계정 관리**에서 이름, 이메일, 역할을 입력해 계정을 만들면 본인에게 비밀번호 설정 메일이 갑니다.
- 전환 전에 들어온 승인 대기 신청은 같은 화면에서 승인하거나 반려할 수 있습니다.
- 최고 관리자 이메일을 변경하려면 `access-policy.js`와 `scripts/build-access-rules.cjs`를 함께 수정하고 규칙을 재생성·재배포해야 합니다.

## 데이터 구조

| 경로 | 읽기 | 쓰기 | 내용 |
|---|---|---|---|
| `clubData/*` (아래 두 항목 제외) | 공개 | 관리자·총무 | 장부, 영수증, 일정, 설정 |
| `clubData/membersPublic` | 공개 | 관리자·총무 | 전화번호, 배우자, 출생연도를 뺀 회계 명부 |
| `clubData/members_acc` | 관리자·총무 | 관리자·총무 | 회계 원본 명부 |
| `accountingSafety/restorePoints` | 관리자·총무 | 관리자·총무 | 원본 명부가 포함된 복구점 |
| `matchData/*` | 공개 | 관리자·경기이사 | 월례대회 등급, 경기, 단체전. 회원 식별값은 `m_...` 내부 ID |
| `matchPrivate/members` | 관리자·경기이사 | 관리자·경기이사 | 내부 ID별 실제 전화번호, 납부 내역, 배우자, 직책 |

규칙은 `matchData`의 회원 ID, 등급 키, 참석 목록에 내부 ID가 아닌 값(실제 전화번호)이 저장되는 것을 거부합니다.

## 전환 순서

기존 월례대회 앱(`modern2026mach`)은 6단계 전까지 그대로 남아 있으므로, 그 전에 문제가 생기면 되돌릴 수 있습니다.

1. **입력 중단:** 전환하는 동안 월례대회와 회계 입력을 멈추도록 총무와 경기이사에게 알립니다.
2. **이전 파일 생성:** 다음을 실행합니다. 원본 백업과 가져오기 파일이 생성되며 Firebase에는 쓰지 않습니다. 출력 폴더에는 개인정보가 있으므로 커밋하거나 공유하지 않습니다.
   ```powershell
   node scripts/prepare-match-migration.mjs .deployment-backups/match-migration
   ```
   출력되는 회원 수, 등급 수, 경기 수가 기존 앱과 같은지 확인합니다.
3. **데이터 가져오기:** [회계 프로젝트 Realtime Database](https://console.firebase.google.com/project/modern-account-2026/database/modern-account-2026-default-rtdb/data)를 엽니다. 먼저 전체 데이터를 **JSON 내보내기**로 백업합니다. 가져오기는 선택한 위치를 덮어쓰므로, 아래 위치를 정확히 선택한 뒤 파일을 가져옵니다.
   - `matchData` ← `import-matchData.json`
   - `matchPrivate` ← `import-matchPrivate.json`
   - `clubData/membersPublic` ← `import-membersPublic.json`
4. **코드 배포:** 이 브랜치를 GitHub `main`에 반영합니다. Cloudflare가 자동 배포합니다. 규칙을 게시하기 전까지 회계 저장은 거부되므로 바로 다음 단계로 넘어갑니다.
5. **규칙 게시:** [규칙 화면](https://console.firebase.google.com/project/modern-account-2026/database/modern-account-2026-default-rtdb/rules)에서 현재 규칙을 별도 보관한 뒤, `database.rules.json` 전체 내용으로 교체하고 **게시**합니다.
6. **기존 앱 닫기:** 아래 확인을 마친 뒤 [`modern2026mach` 규칙](https://console.firebase.google.com/project/modern2026mach/database/modern2026mach-default-rtdb/rules)을 `".read": false, ".write": false`로 바꿉니다. **이 단계를 끝내야 기존 앱의 전화번호 공개가 멈춥니다.** 기존 주소를 쓰던 회원에게는 새 주소 `/match/`를 안내합니다.
7. **계정 만들기:** 관리자로 로그인해 경기이사 계정을 만듭니다. 승인되어 있던 총무 계정은 그대로 유지됩니다.

## 전환 후 확인

- 로그인 없이 `/match/`에서 등급 현황과 경기 기록이 보이고, 전화번호는 보이지 않습니다.
- 경기이사는 월례대회를 수정할 수 있고 회계는 수정할 수 없습니다.
- 총무는 회계를 수정할 수 있고 월례대회는 수정할 수 없습니다.
- 회계 앱에서 로그인한 뒤 `/match/`로 이동해도 로그인이 유지됩니다.
- 아래 주소를 브라우저에서 열면 `Permission denied`가 나옵니다.
  `https://modern-account-2026-default-rtdb.firebaseio.com/clubData/members_acc.json`

## 되돌리기

1. 5단계에서 보관한 규칙을 다시 게시합니다.
2. GitHub `main`에서 이번 변경을 되돌립니다.
3. 6단계까지 진행했다면 `modern2026mach` 규칙도 이전 내용으로 되돌립니다.

전환 후 입력한 월례대회 내용은 회계 프로젝트의 `matchData`에만 있으므로, 되돌리기 전에 내보내 보관합니다.

## 검증

```powershell
node --test scripts/test-access.mjs scripts/test-calendar.mjs
```

단위 검사는 규칙의 동작을 대신하지 않습니다. 규칙을 바꾸면 Firebase 에뮬레이터에서 역할별 읽기·쓰기를 다시 확인합니다.

## 이용 방법

- **로그인:** 상단 **로그인**에서 이메일과 비밀번호를 입력합니다. 월례대회 화면의 자물쇠를 누르면 같은 로그인 창으로 이동합니다.
- **비밀번호:** 로그인 창의 **비밀번호 찾기** 또는 설정의 **로그인 비밀번호 변경**을 사용합니다. 관리자는 계정 목록의 **메일 다시 보내기**로 설정 메일을 다시 보낼 수 있습니다.
- **권한 회수:** 계정 목록의 **권한 회수**는 즉시 적용되며, 열려 있는 화면에서도 편집 권한이 해제됩니다.
- **백업:** 전체 복구, 안전 복사, 복구점 관리는 관리자에게만 표시합니다. 월례대회 백업 파일에는 전화번호가 포함되므로 공유하지 않습니다.
