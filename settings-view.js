export function createSettingsPage({ preview = false } = {}) {
    const root = document.createElement('div');
    root.id = 'accountAccessRoot';
    const markup = `
    <dialog id="accountDialog" class="account-dialog" aria-labelledby="accountDialogTitle">
        <div class="dialog-heading"><div><div class="dialog-eyebrow">MODERN TENNIS</div><h2 id="accountDialogTitle">로그인</h2></div><button type="button" class="dialog-close" data-close-dialog="accountDialog" aria-label="로그인 창 닫기">×</button></div>
        <div class="account-tabs" role="tablist" aria-label="로그인 또는 권한 신청">
            <button type="button" role="tab" id="loginModeTab" aria-controls="loginPanel" aria-selected="true">일반 로그인</button>
            <button type="button" role="tab" id="requestModeTab" aria-controls="requestPanel" aria-selected="false">총무 권한 신청</button>
        </div>
        <div id="accessMessage" class="access-message" role="status" aria-live="polite" hidden></div>
        <div id="loginPanel" role="tabpanel" aria-labelledby="loginModeTab">
            <p class="settings-description">관리자·총무 또는 등록된 이메일 계정으로 로그인해주세요.</p>
            <form id="accountLoginForm">
                <label for="accountLoginEmail">이메일</label><input id="accountLoginEmail" type="email" autocomplete="username" required>
                <label for="accountLoginPassword">비밀번호</label><input id="accountLoginPassword" type="password" autocomplete="current-password" required minlength="6">
                <button class="btn-main" type="submit">로그인</button>
                <div class="settings-actions"><button type="button" class="btn-sub" id="showSignup">총무 권한 신청하기</button><button type="button" class="btn-sub" id="resetAccountPassword">비밀번호 찾기</button></div>
            </form>
        </div>
        <div id="requestPanel" role="tabpanel" aria-labelledby="requestModeTab" hidden>
            <p class="settings-description">신청하면 관리자에게 승인 대기로 접수됩니다. 이메일 인증과 관리자 승인을 모두 마치면 회계 업무를 관리할 수 있습니다.</p>
            <form id="accountSignupForm" hidden>
                <label for="accountSignupName">이름</label><input id="accountSignupName" autocomplete="name" maxlength="80" placeholder="관리자가 확인할 이름" required>
                <label for="accountSignupEmail">신청 이메일</label><input id="accountSignupEmail" type="email" autocomplete="username" required>
                <label for="accountSignupPassword">비밀번호 (8자 이상)</label><input id="accountSignupPassword" type="password" autocomplete="new-password" minlength="8" required>
                <label for="accountSignupConfirm">비밀번호 확인</label><input id="accountSignupConfirm" type="password" autocomplete="new-password" minlength="8" required>
                <button type="submit" class="btn-main">총무 권한 신청하기</button>
                <p class="settings-description">처음 신청하면 이메일 계정도 함께 만듭니다. 이미 계정이 있으면 기존 비밀번호를 입력해주세요.</p>
                <button type="button" class="btn-sub" id="cancelSignup">일반 로그인으로 돌아가기</button>
            </form>
        </div>
        <div id="signedInActions" hidden>
            <div class="account-summary"><span id="accountRole" class="account-role">방문자</span><span id="accountEmail"></span></div>
            <p class="settings-description" id="accountDescription"></p>
            <div class="settings-actions"><button type="button" class="btn-sub" id="refreshAccount">인증·승인 상태 새로고침</button><button type="button" class="btn-sub" id="verifyAccount">인증 메일 보내기</button><button type="button" class="btn-sub" id="btnLogin">로그아웃</button></div>
        </div>
        <div id="treasurerRequestCard" class="request-status-card" hidden>
            <div class="settings-heading">내 총무 신청</div><p id="myRequestStatus" class="settings-description" aria-live="polite"></p>
            <form id="treasurerRequestForm"><label for="requestName">이름</label><input id="requestName" maxlength="80" required autocomplete="name" placeholder="관리자가 확인할 수 있는 이름"><button class="btn-main" type="submit" id="submitTreasurerRequest">총무 권한 신청하기</button></form>
        </div>
    </dialog>
    <dialog id="settingsDialog" class="account-dialog settings-dialog" aria-labelledby="settingsDialogTitle">
        <div class="dialog-heading"><div><div class="dialog-eyebrow">PREFERENCES</div><h2 id="settingsDialogTitle">설정</h2></div><button type="button" class="dialog-close" data-close-dialog="settingsDialog" aria-label="설정 창 닫기">×</button></div>
        <div id="settingsMessage" class="access-message" role="status" aria-live="polite" hidden></div>
        <div class="card"><div class="settings-heading">내 계정</div><div class="account-summary"><span id="settingsAccountRole" class="account-role">방문자</span><span id="settingsAccountEmail"></span></div><div class="settings-actions"><button type="button" class="btn-sub" id="settingsOpenAccount">로그인·신청 상태 확인</button></div></div>
        <div class="card"><div class="settings-heading">휴대폰 일정 알림</div><p class="settings-description">휴대폰 캘린더에 일정을 저장하고 전날·당일 알림을 받으세요. 별도 서버 요금제 없이 사용할 수 있습니다.</p><button class="btn-sub" type="button" data-dismiss-settings onclick="openCalendarReminders()">캘린더에 저장·알림 설정</button></div>
        <div class="card owner-only" id="accessApprovalCard" hidden>
            <div class="settings-heading">총무 권한 관리</div><p class="settings-description">신청한 이메일과 이름을 확인하고 승인해주세요. 권한 회수는 즉시 적용됩니다. 이메일 인증을 마치지 않은 계정은 승인 후에도 편집할 수 없습니다.</p>
            <div id="accessRequestsList" aria-live="polite">신청 내역을 불러오는 중입니다.</div>
        </div>
        <div class="card admin-only"><div class="settings-heading">회계 운영</div><div class="settings-actions">
            <button class="btn-sub" data-dismiss-settings onclick="openFeeSettings()">회비·계좌·문자 설정</button><button class="btn-sub" data-dismiss-settings onclick="openMonthEndCheck()">월말 점검·마감</button><button class="btn-sub" data-dismiss-settings onclick="openChangeHistory()">변경 이력</button><button class="btn-sub" data-dismiss-settings onclick="goTab('report')">결산·감사 보고서</button>
        </div></div>
        <div class="card admin-only"><div class="settings-heading">백업 및 복구</div><p class="settings-description">전체 복구와 안전 복사 관리는 관리자 전용입니다.</p><div class="settings-actions">
            <button class="btn-sub" data-dismiss-settings onclick="exportData()">백업 다운로드</button><button class="btn-sub owner-only" data-dismiss-settings onclick="createSafetyBaseline()">안전 복사</button><button class="btn-sub owner-only" data-dismiss-settings onclick="openRestorePointManager()">자동 복구점</button><button class="btn-sub owner-only" data-dismiss-settings onclick="document.getElementById('loadFile').click()">백업 파일로 복구</button>
        </div></div>
        <div class="card" id="accountPasswordCard" hidden><div class="settings-heading">로그인 비밀번호 변경</div><p class="settings-description">현재 로그인한 본인 계정의 비밀번호를 변경합니다.</p>
            <form id="changeAccountPasswordForm"><label for="currentAccountPassword">현재 비밀번호</label><input id="currentAccountPassword" type="password" autocomplete="current-password" required><label for="newAccountPassword">새 비밀번호 (8자 이상)</label><input id="newAccountPassword" type="password" autocomplete="new-password" minlength="8" required><label for="confirmAccountPassword">새 비밀번호 확인</label><input id="confirmAccountPassword" type="password" autocomplete="new-password" minlength="8" required><button class="btn-main" type="submit">비밀번호 변경</button></form>
        </div>
        <div class="settings-actions admin-only"><button class="btn-sub" data-dismiss-settings onclick="saveAndExit()">저장하고 나가기</button></div>
    </dialog>`;
    root.innerHTML = preview ? markup.replace(/\s+on[a-z]+="[^"]*"/gi, '') : markup;
    document.querySelector('.nav-bar').before(root);
    const loadFile = document.getElementById('loadFile');
    if (loadFile) root.append(loadFile);
    return root;
}
