export function createSettingsPage({ preview = false } = {}) {
    const page = document.createElement('div');
    page.id = 'page-settings';
    page.className = 'page';
    const markup = `
        <div class="section-header"><div class="section-title">설정</div><button class="btn-sub" onclick="goTab('ledger')">장부로 돌아가기</button></div>
        <div id="accessMessage" class="access-message" role="status" aria-live="polite" hidden></div>
        <div class="card">
            <div class="settings-heading">내 계정</div>
            <div class="account-summary"><span id="accountRole" class="account-role">방문자</span><span id="accountEmail">로그인하지 않았습니다.</span></div>
            <p class="settings-description" id="accountDescription">총무는 이메일 계정을 만들고 인증한 뒤 권한을 신청해주세요. 관리자가 승인하면 장부와 결산을 관리할 수 있습니다.</p>
            <form id="accountLoginForm">
                <label for="accountLoginEmail">이메일</label><input id="accountLoginEmail" type="email" autocomplete="username" required>
                <label for="accountLoginPassword">비밀번호</label><input id="accountLoginPassword" type="password" autocomplete="current-password" required minlength="6">
                <button class="btn-main" type="submit">로그인</button>
                <div class="settings-actions"><button type="button" class="btn-sub" id="showSignup">처음 이용 · 계정 만들기</button><button type="button" class="btn-sub" id="resetAccountPassword">비밀번호 찾기</button></div>
            </form>
            <form id="accountSignupForm" hidden>
                <label for="accountSignupEmail">신청할 이메일</label><input id="accountSignupEmail" type="email" autocomplete="username" required>
                <label for="accountSignupPassword">새 비밀번호 (8자 이상)</label><input id="accountSignupPassword" type="password" autocomplete="new-password" minlength="8" required>
                <label for="accountSignupConfirm">비밀번호 확인</label><input id="accountSignupConfirm" type="password" autocomplete="new-password" minlength="8" required>
                <button type="submit" class="btn-main">계정 만들고 인증 메일 받기</button>
                <button type="button" class="btn-sub" id="cancelSignup" style="margin-top:10px">로그인으로 돌아가기</button>
            </form>
            <div id="signedInActions" hidden><div class="settings-actions"><button class="btn-sub" id="refreshAccount">인증·승인 상태 새로고침</button><button class="btn-sub" id="verifyAccount">인증 메일 보내기</button><button class="btn-sub" id="btnLogin">로그아웃</button></div></div>
        </div>
        <div class="card" id="treasurerRequestCard" hidden>
            <div class="settings-heading">총무 권한 신청</div>
            <p class="settings-description">본인 이메일 인증 후 신청할 수 있습니다. 승인되면 거래 입력·수정·삭제, 회원·영수증·일정 관리, 월 마감과 결산 업무를 할 수 있습니다.</p>
            <p id="myRequestStatus" class="settings-description"></p>
            <form id="treasurerRequestForm"><label for="requestName">이름</label><input id="requestName" maxlength="80" required autocomplete="name" placeholder="관리자가 확인할 수 있는 이름"><button class="btn-main" type="submit" id="submitTreasurerRequest">총무 권한 신청하기</button></form>
        </div>
        <div class="card owner-only" id="accessApprovalCard" hidden>
            <div class="settings-heading">총무 권한 관리</div><p class="settings-description">신청한 이메일과 이름을 확인하고 승인해주세요. 권한 회수는 즉시 적용됩니다. 총무는 다른 계정의 권한을 승인하거나 변경할 수 없습니다.</p>
            <div id="accessRequestsList" aria-live="polite">신청 내역을 불러오는 중입니다.</div>
        </div>
        <div class="card admin-only">
            <div class="settings-heading">회계 운영</div>
            <div class="settings-actions"><button class="btn-sub" onclick="openFeeSettings()">회비·계좌·문자 설정</button><button class="btn-sub" onclick="openMonthEndCheck()">월말 점검·마감</button><button class="btn-sub" onclick="openChangeHistory()">변경 이력</button><button class="btn-sub" onclick="goTab('report')">결산·감사 보고서</button></div>
        </div>
        <div class="card admin-only">
            <div class="settings-heading">백업 및 복구</div>
            <p class="settings-description">백업 파일은 관리자와 총무가 내려받을 수 있습니다. 전체 복구와 안전 복사 관리는 관리자 전용입니다.</p>
            <div class="settings-actions"><button class="btn-sub" onclick="exportData()">백업 다운로드</button><button class="btn-sub owner-only" onclick="createSafetyBaseline()">안전 복사</button><button class="btn-sub owner-only" onclick="openRestorePointManager()">자동 복구점</button><button class="btn-sub owner-only" onclick="document.getElementById('loadFile').click()">백업 파일로 복구</button></div>
        </div>
        <div class="card" id="accountPasswordCard" hidden>
            <div class="settings-heading">로그인 비밀번호 변경</div>
            <p class="settings-description">현재 로그인한 본인 계정의 비밀번호를 변경합니다.</p>
            <form id="changeAccountPasswordForm">
                <label for="currentAccountPassword">현재 비밀번호</label><input id="currentAccountPassword" type="password" autocomplete="current-password" required>
                <label for="newAccountPassword">새 비밀번호 (8자 이상)</label><input id="newAccountPassword" type="password" autocomplete="new-password" minlength="8" required>
                <label for="confirmAccountPassword">새 비밀번호 확인</label><input id="confirmAccountPassword" type="password" autocomplete="new-password" minlength="8" required>
                <button class="btn-main" type="submit">비밀번호 변경</button>
            </form>
        </div>
        <div class="settings-actions admin-only"><button class="btn-sub" onclick="saveAndExit()">저장하고 나가기</button></div>`;
    page.innerHTML = preview ? markup.replace(/\s+on[a-z]+="[^"]*"/gi, '') : markup;
    document.querySelector('.nav-bar').before(page);
    page.append(document.getElementById('loadFile'));
    return page;
}
