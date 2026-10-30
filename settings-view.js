export function createSettingsPage({ preview = false } = {}) {
    const root = document.createElement('div');
    root.id = 'accountAccessRoot';
    const markup = `
    <dialog id="accountDialog" class="account-dialog" aria-labelledby="accountDialogTitle">
        <div class="dialog-heading"><div><div class="dialog-eyebrow">MODERN TENNIS</div><h2 id="accountDialogTitle">로그인</h2></div><button type="button" class="dialog-close" data-close-dialog="accountDialog" aria-label="로그인 창 닫기">×</button></div>
        <div id="accessMessage" class="access-message" role="status" aria-live="polite" hidden></div>
        <div id="loginPanel">
            <p class="settings-description">관리자가 만들어 준 계정으로 로그인해주세요. 처음이라면 메일로 받은 링크에서 비밀번호를 먼저 정해주세요.</p>
            <form id="accountLoginForm">
                <label for="accountLoginEmail">이메일</label><input id="accountLoginEmail" type="email" autocomplete="username" required>
                <label for="accountLoginPassword">비밀번호</label><input id="accountLoginPassword" type="password" autocomplete="current-password" required minlength="6">
                <button class="btn-main" type="submit">로그인</button>
                <div class="settings-actions"><button type="button" class="btn-sub" id="resetAccountPassword">비밀번호 찾기</button></div>
            </form>
        </div>
        <div id="signedInActions" hidden>
            <div class="account-summary"><span id="accountRole" class="account-role">방문자</span><span id="accountEmail"></span></div>
            <p class="settings-description" id="accountDescription"></p>
            <div class="settings-actions"><button type="button" class="btn-sub" id="btnLogin">로그아웃</button></div>
        </div>
    </dialog>
    <dialog id="settingsDialog" class="account-dialog settings-dialog" aria-labelledby="settingsDialogTitle">
        <div class="dialog-heading"><div><div class="dialog-eyebrow">PREFERENCES</div><h2 id="settingsDialogTitle">설정</h2></div><button type="button" class="dialog-close" data-close-dialog="settingsDialog" aria-label="설정 창 닫기">×</button></div>
        <div id="settingsMessage" class="access-message" role="status" aria-live="polite" hidden></div>
        <div class="card"><div class="settings-heading">내 계정</div><div class="account-summary"><span id="settingsAccountRole" class="account-role">방문자</span><span id="settingsAccountEmail"></span></div><div class="settings-actions"><button type="button" class="btn-sub" id="settingsOpenAccount">로그인·계정 보기</button></div></div>
        <div class="card"><div class="settings-heading">휴대폰 일정 알림</div><p class="settings-description">휴대폰 캘린더에 일정을 저장하고 전날·당일 알림을 받으세요. 별도 서버 요금제 없이 사용할 수 있습니다.</p><button class="btn-sub" type="button" data-dismiss-settings onclick="openCalendarReminders()">캘린더에 저장·알림 설정</button></div>
        <div class="card owner-only" id="accessApprovalCard" hidden>
            <div class="settings-heading">총무·경기이사 계정 관리</div><p class="settings-description">계정을 만들면 본인 이메일로 비밀번호 설정 메일이 갑니다. 관리자는 비밀번호를 알 수 없고, 권한 회수는 즉시 적용됩니다.</p>
            <form id="staffCreateForm">
                <label for="staffName">이름</label><input id="staffName" maxlength="80" required autocomplete="off">
                <label for="staffEmail">이메일</label><input id="staffEmail" type="email" required autocomplete="off">
                <label for="staffRole">역할</label><select id="staffRole"><option value="treasurer">총무 (회계 관리)</option><option value="director">경기이사 (월례대회 관리)</option></select>
                <button class="btn-main" type="submit">계정 만들기</button>
            </form>
            <div id="staffList" aria-live="polite">계정을 불러오는 중입니다.</div>
            <div id="accessRequestsList" aria-live="polite"></div>
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
