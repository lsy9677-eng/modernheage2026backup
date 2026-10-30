import { createSettingsPage } from './settings-view.js?v=20261030_04';
import { initializeApp, getApps } from 'https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js';
import {
    getAuth, createUserWithEmailAndPassword, signInWithEmailAndPassword, signOut,
    onAuthStateChanged, sendPasswordResetEmail,
    updatePassword, reauthenticateWithCredential, EmailAuthProvider
} from 'https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js';
import { ref, get, set, onValue, update, serverTimestamp } from 'https://www.gstatic.com/firebasejs/10.7.1/firebase-database.js';
import { OWNER_EMAIL, ACCESS_ROOT, STAFF_ROLES, resolveRole, canManage } from './access-policy.js?v=20261030_04';

const STAFF_APP_NAME = 'staff-provisioning';

export function installAccountAccess({ app, auth, db, refreshUI, onManagerReady, onManagerChange }) {
    const page = createSettingsPage();
    const el = id => document.getElementById(id);
    let role = 'visitor';
    let generation = 0, subscriptions = [], busy = false;
    const roleLabels = { visitor: '방문자', pending: '권한 없는 계정', owner: '관리자 · 개발자', treasurer: '총무', director: '경기이사' };
    const roleDescriptions = {
        owner: '관리자 계정입니다. 회계와 월례대회를 모두 관리하고, 설정에서 총무·경기이사 계정을 만들거나 권한을 회수할 수 있습니다.',
        treasurer: '총무 권한으로 거래·회원·영수증·일정과 결산을 관리할 수 있습니다. 월례대회는 보기만 할 수 있습니다.',
        director: '경기이사 권한으로 월례대회의 매치·등급·회원을 관리할 수 있습니다. 회계는 보기만 할 수 있습니다.',
        pending: '이 계정에는 편집 권한이 없습니다. 권한이 필요하면 관리자에게 문의해주세요.'
    };
    const tell = (message, error = false) => {
        const box = el('settingsDialog').open ? el('settingsMessage') : el('accessMessage');
        box.hidden = false;
        box.textContent = message;
        box.classList.toggle('error', error);
    };
    function syncScrollLock() {
        document.documentElement.classList.toggle('account-dialog-open', el('accountDialog').open || el('settingsDialog').open);
    }
    function openDialog(id) {
        const other = id === 'accountDialog' ? 'settingsDialog' : 'accountDialog';
        el(other).close();
        if (!el(id).open) el(id).showModal();
        syncScrollLock();
    }
    for (const id of ['accountDialog', 'settingsDialog']) {
        el(id).addEventListener('close', syncScrollLock);
        el(id).addEventListener('click', event => {
            if (event.target !== el(id)) return;
            const rect = el(id).getBoundingClientRect();
            if(event.clientX < rect.left || event.clientX > rect.right || event.clientY < rect.top || event.clientY > rect.bottom) el(id).close();
        });
    }
    page.querySelectorAll('[data-close-dialog]').forEach(button => button.addEventListener('click', () => el(button.dataset.closeDialog).close()));
    page.querySelectorAll('[data-dismiss-settings]').forEach(button => button.addEventListener('click', () => el('settingsDialog').close(), {capture:true}));
    window.openAccountDialog = () => { render(); openDialog('accountDialog'); };
    window.openAppSettings = () => { render(); openDialog('settingsDialog'); };
    window.closeAccountPopups = () => { el('accountDialog').close(); el('settingsDialog').close(); syncScrollLock(); };
    el('settingsOpenAccount').addEventListener('click', () => window.openAccountDialog());
    function errorMessage(error) {
        const messages = {
            'auth/email-already-in-use': '이미 등록된 이메일입니다. 아래 목록에서 권한을 복구하거나, Firebase 콘솔에서 기존 계정을 확인해주세요.',
            'auth/invalid-email': '이메일 형식을 확인해주세요.',
            'auth/invalid-credential': '이메일 또는 비밀번호를 확인해주세요.',
            'auth/wrong-password': '현재 비밀번호를 확인해주세요.',
            'auth/weak-password': '더 안전한 비밀번호를 입력해주세요.',
            'auth/too-many-requests': '요청이 많습니다. 잠시 후 다시 시도해주세요.',
            'auth/requires-recent-login': '다시 로그인한 뒤 시도해주세요.',
            'auth/network-request-failed': '인터넷 연결을 확인해주세요.'
        };
        return messages[error.code] || (/permission/i.test(String(error.code || '') + String(error.message)) ? '권한 저장이 거부되었습니다. 관리자 계정인지 확인해주세요.' : '처리하지 못했습니다. 인터넷 연결을 확인하고 다시 시도해주세요.');
    }
    async function perform(action) {
        if (busy) return;
        busy = true;
        page.setAttribute('aria-busy', 'true');
        page.querySelectorAll('form button').forEach(button => button.disabled = true);
        try { await action(); } catch (error) { console.error('계정 작업 실패:', error.code || error.message); tell(errorMessage(error), true); }
        finally { busy = false; page.removeAttribute('aria-busy'); render(); }
    }
    function applyRole(nextRole) {
        const wasManager = !!window.isAdmin;
        role = nextRole;
        window.accountRole = role;
        window.isOwner = role === 'owner';
        // Compatibility with existing transaction, member and settlement handlers.
        window.isAdmin = canManage(role);
        if (wasManager !== window.isAdmin) onManagerChange?.(window.isAdmin);
        if (!window.isAdmin) {
            window.isAuditMode = false;
            document.querySelectorAll('.modal-wrap, .full-page-viewer').forEach(item => item.style.display = 'none');
            if (wasManager) el('settingsDialog').close();
        }
        refreshUI();
        render();
        if (!wasManager && window.isAdmin) onManagerReady();
    }
    function render() {
        const user = auth.currentUser;
        el('accountDialogTitle').textContent = user ? '내 계정' : '로그인';
        el('loginPanel').hidden = !!user;
        el('accountRole').textContent = roleLabels[role];
        el('accountEmail').textContent = user?.email || '로그인하지 않았습니다.';
        el('settingsAccountRole').textContent = roleLabels[role];
        el('settingsAccountEmail').textContent = user?.email || '로그인하지 않았습니다.';
        const headerLogin = el('btnAccount');
        if (headerLogin) { headerLogin.textContent = user ? '내 계정' : '로그인'; headerLogin.setAttribute('aria-label', user ? '내 계정' : '로그인'); }
        el('signedInActions').hidden = !user;
        el('accountPasswordCard').hidden = !user;
        el('accountDescription').textContent = roleDescriptions[role] || '';
        el('accessApprovalCard').hidden = !window.isOwner;
        page.querySelectorAll('form button').forEach(button => button.disabled = busy);
    }
    window.renderAccessSettings = render;
    window.toggleAdminLogin = () => window.openAccountDialog();
    window.changeAdminPassword = () => { window.openAppSettings(); el('accountPasswordCard').scrollIntoView({ behavior: 'smooth' }); };

    el('accountLoginForm').addEventListener('submit', event => {
        event.preventDefault();
        perform(async () => { await signInWithEmailAndPassword(auth, el('accountLoginEmail').value.trim(), el('accountLoginPassword').value); el('accountLoginPassword').value = ''; tell('로그인했습니다. 계정 권한을 확인하고 있습니다.'); });
    });
    el('resetAccountPassword').addEventListener('click', () => perform(async () => {
        const email = el('accountLoginEmail').value.trim();
        if (!email || !el('accountLoginEmail').checkValidity()) return tell('위 이메일 입력란에 올바른 이메일을 입력해주세요.', true);
        await sendPasswordResetEmail(auth, email);
        tell('등록된 계정이면 비밀번호 재설정 메일을 받을 수 있습니다.');
    }));
    el('btnLogin').addEventListener('click', () => perform(async () => {
        await signOut(auth);
        ['accountLoginForm','changeAccountPasswordForm'].forEach(id => el(id).reset());
        tell('로그아웃했습니다.');
    }));
    el('changeAccountPasswordForm').addEventListener('submit', event => {
        event.preventDefault();
        if (el('newAccountPassword').value !== el('confirmAccountPassword').value) return tell('새 비밀번호가 일치하지 않습니다.', true);
        perform(async () => {
            const user = auth.currentUser;
            await reauthenticateWithCredential(user, EmailAuthProvider.credential(user.email, el('currentAccountPassword').value));
            await updatePassword(user, el('newAccountPassword').value);
            el('changeAccountPasswordForm').reset();
            tell('로그인 비밀번호를 변경했습니다.');
        });
    });

    function roleRecord(uid, nextRole, email, name) {
        return { [`${ACCESS_ROOT}/roles/${uid}`]: { role: nextRole, email, name, grantedAt: serverTimestamp(), grantedBy: auth.currentUser.uid } };
    }
    function randomPassword() {
        const bytes = crypto.getRandomValues(new Uint8Array(24));
        return btoa(String.fromCharCode(...bytes));
    }
    // 보조 앱에서 계정을 만들어야 관리자 로그인이 새 계정으로 바뀌지 않습니다.
    function staffAuth() {
        const staffApp = getApps().find(item => item.name === STAFF_APP_NAME) || initializeApp(app.options, STAFF_APP_NAME);
        const result = getAuth(staffApp);
        result.languageCode = 'ko';
        return result;
    }
    el('staffCreateForm').addEventListener('submit', event => {
        event.preventDefault();
        perform(async () => {
            if (!window.isOwner) throw new Error('permission_denied');
            const name = el('staffName').value.trim(), email = el('staffEmail').value.trim(), nextRole = el('staffRole').value;
            if (!name || !STAFF_ROLES.includes(nextRole)) return tell('이름과 역할을 확인해주세요.', true);
            const secondary = staffAuth();
            try {
                const created = await createUserWithEmailAndPassword(secondary, email, randomPassword());
                try { await update(ref(db), roleRecord(created.user.uid, nextRole, email, name)); }
                catch (error) { await created.user.delete(); throw error; }
                el('staffCreateForm').reset();
                try { await sendPasswordResetEmail(secondary, email); tell(`${name}님의 계정을 만들고 비밀번호 설정 메일을 보냈습니다.`); }
                catch (error) { tell(`${name}님의 계정은 만들었지만 메일을 보내지 못했습니다. 목록의 메일 다시 보내기를 눌러주세요.`, true); }
            } finally { await signOut(secondary); }
        });
    });
    function actionButton(label, onClick) {
        const button = document.createElement('button');
        button.type = 'button';
        button.className = 'btn-sub';
        button.textContent = label;
        button.addEventListener('click', () => perform(onClick));
        return button;
    }
    function accountRow(item, status, actions) {
        const row = document.createElement('div'); row.className = 'access-request-row';
        const name = document.createElement('strong'); name.textContent = item.name;
        const email = document.createElement('div'); email.textContent = item.email; email.className = 'settings-description';
        const state = document.createElement('div'); state.textContent = status; state.className = 'settings-description';
        const box = document.createElement('div'); box.className = 'settings-actions'; box.append(...actions);
        row.append(name, email, state, box);
        return row;
    }
    function changeRole(uid, item, nextRole, label) {
        return async () => {
            if (!confirm(`${item.name} (${item.email})님을 ${label}하시겠습니까?`)) return;
            await update(ref(db), roleRecord(uid, nextRole, item.email, item.name));
            tell(`${item.name}님의 ${label} 처리를 완료했습니다.`);
        };
    }
    function renderStaff(roles) {
        const list = el('staffList');
        list.replaceChildren();
        const entries = Object.entries(roles).sort((a, b) => a[1].name.localeCompare(b[1].name));
        if (!entries.length) { list.textContent = '아직 만든 계정이 없습니다.'; return; }
        for (const [uid, item] of entries) {
            const actions = item.role === 'revoked'
                ? [actionButton('총무로 복구', changeRole(uid, item, 'treasurer', '총무로 복구')), actionButton('경기이사로 복구', changeRole(uid, item, 'director', '경기이사로 복구'))]
                : [
                    item.role === 'treasurer' ? actionButton('경기이사로 변경', changeRole(uid, item, 'director', '경기이사로 변경')) : actionButton('총무로 변경', changeRole(uid, item, 'treasurer', '총무로 변경')),
                    actionButton('메일 다시 보내기', async () => { await sendPasswordResetEmail(auth, item.email); tell(`${item.email}로 비밀번호 설정 메일을 보냈습니다.`); }),
                    actionButton('권한 회수', changeRole(uid, item, 'revoked', '권한 회수'))
                ];
            list.append(accountRow(item, roleLabels[item.role] || '권한 회수됨', actions));
        }
    }
    // 공개 신청을 닫기 전에 접수된 건만 표시합니다.
    function renderRequests(requests) {
        const list = el('accessRequestsList');
        list.replaceChildren();
        for (const [uid, item] of Object.entries(requests).filter(([, value]) => value.status === 'pending')) {
            const decide = (status, nextRole, label) => async () => {
                if (!confirm(`${item.name} (${item.email})님의 이전 신청을 ${label}하시겠습니까?`)) return;
                const changes = { [`${ACCESS_ROOT}/requests/${uid}`]: { ...item, status, reviewedAt: serverTimestamp(), reviewedBy: auth.currentUser.uid } };
                if (nextRole) Object.assign(changes, roleRecord(uid, nextRole, item.email, item.name));
                await update(ref(db), changes);
                tell(`${item.name}님의 신청을 ${label}했습니다.`);
            };
            list.append(accountRow(item, '이전 신청 · 승인 대기', [
                actionButton('총무로 승인', decide('approved', 'treasurer', '총무로 승인')),
                actionButton('경기이사로 승인', decide('approved', 'director', '경기이사로 승인')),
                actionButton('반려', decide('rejected', null, '반려'))
            ]));
        }
    }
    function watchUser(user) {
        const currentGeneration = ++generation;
        subscriptions.forEach(stop => stop()); subscriptions = [];
        applyRole(resolveRole(user, null));
        if (!user) return;
        const fail = error => { if (currentGeneration === generation) tell(errorMessage(error), true); };
        if (user.email === OWNER_EMAIL) {
            subscriptions.push(onValue(ref(db, `${ACCESS_ROOT}/roles`), snapshot => {
                if (currentGeneration === generation) renderStaff(snapshot.val() || {});
            }, fail));
            subscriptions.push(onValue(ref(db, `${ACCESS_ROOT}/requests`), snapshot => {
                if (currentGeneration === generation) renderRequests(snapshot.val() || {});
            }, fail));
        } else {
            subscriptions.push(onValue(ref(db, `${ACCESS_ROOT}/roles/${user.uid}`), snapshot => {
                if (currentGeneration !== generation) return;
                applyRole(resolveRole(user, snapshot.val()));
            }, error => { if (currentGeneration === generation) { applyRole('pending'); fail(error); } }));
        }
    }
    onAuthStateChanged(auth, watchUser);
    render();
    if (new URLSearchParams(location.search).get('login') === '1') {
        history.replaceState(null, '', location.pathname);
        window.openAccountDialog();
    }
}
