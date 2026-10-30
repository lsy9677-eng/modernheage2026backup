import { createSettingsPage } from './settings-view.js?v=20261030_01';
import {
    createUserWithEmailAndPassword, signInWithEmailAndPassword, signOut,
    onAuthStateChanged, sendEmailVerification, sendPasswordResetEmail,
    updatePassword, reauthenticateWithCredential, EmailAuthProvider
} from 'https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js';
import { ref, get, set, onValue, update, serverTimestamp } from 'https://www.gstatic.com/firebasejs/10.7.1/firebase-database.js';
import { OWNER_EMAIL, ACCESS_ROOT, resolveRole, canManage, canRequest } from './access-policy.js?v=20261030_01';

export function installAccountAccess({ auth, db, refreshUI, onManagerReady }) {
    const page = createSettingsPage();
    const el = id => document.getElementById(id);
    let role = 'visitor', request = null, grant = null;
    let generation = 0, subscriptions = [], busy = false;
    const roleLabels = { visitor: '방문자', pending: '승인 전 계정', owner: '관리자 · 개발자', treasurer: '총무' };
    const statuses = { pending: '승인 대기', approved: '승인됨', rejected: '반려됨 · 다시 신청할 수 있습니다.', revoked: '권한 회수됨 · 다시 신청할 수 있습니다.' };
    const tell = (message, error = false) => {
        el('accessMessage').hidden = false;
        el('accessMessage').textContent = message;
        el('accessMessage').classList.toggle('error', error);
    };
    function errorMessage(error) {
        const messages = {
            'auth/email-already-in-use': '이미 등록된 이메일입니다. 로그인하거나 비밀번호 찾기를 이용해주세요.',
            'auth/invalid-credential': '이메일 또는 비밀번호를 확인해주세요.',
            'auth/wrong-password': '현재 비밀번호를 확인해주세요.',
            'auth/weak-password': '더 안전한 비밀번호를 입력해주세요.',
            'auth/too-many-requests': '요청이 많습니다. 잠시 후 다시 시도해주세요.',
            'auth/requires-recent-login': '다시 로그인한 뒤 시도해주세요.',
            'auth/network-request-failed': '인터넷 연결을 확인해주세요.'
        };
        return messages[error.code] || (String(error.code || '').toLowerCase().includes('permission') || String(error.message).includes('permission_denied') ? '권한 설정을 확인할 수 없습니다. 관리자에게 문의해주세요.' : '처리하지 못했습니다. 잠시 후 다시 시도해주세요.');
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
        const wasManager = window.isAdmin;
        role = nextRole;
        window.accountRole = role;
        window.isOwner = role === 'owner';
        // Compatibility with existing transaction, member and settlement handlers.
        window.isAdmin = canManage(role);
        if (!window.isAdmin) {
            window.isAuditMode = false;
            document.querySelectorAll('.modal-wrap, .full-page-viewer').forEach(item => item.style.display = 'none');
        }
        refreshUI();
        render();
        if (!wasManager && window.isAdmin) onManagerReady();
    }
    function render() {
        const user = auth.currentUser;
        el('accountRole').textContent = roleLabels[role];
        el('accountEmail').textContent = user?.email || '로그인하지 않았습니다.';
        el('accountLoginForm').hidden = !!user || !el('accountSignupForm').hidden;
        if (user) el('accountSignupForm').hidden = true;
        el('signedInActions').hidden = !user;
        el('accountPasswordCard').hidden = !user;
        el('verifyAccount').hidden = !user || user.emailVerified;
        el('treasurerRequestCard').hidden = !user || canManage(role);
        el('treasurerRequestForm').hidden = !canRequest(user, request, role);
        el('myRequestStatus').textContent = !user?.emailVerified ? '먼저 이메일 인증을 완료한 뒤 위의 상태 새로고침 버튼을 눌러주세요.' : request ? statuses[request.status] || '신청 상태를 확인해주세요.' : '이메일 인증 완료 · 아래에서 신청해주세요.';
        el('accountDescription').textContent = role === 'owner' ? '총무 신청 승인·반려·권한 회수와 전체 복구를 관리할 수 있습니다.' : role === 'treasurer' ? '총무 권한으로 거래·회원·영수증·일정과 결산을 관리할 수 있습니다.' : '총무는 이메일 계정을 만들고 인증한 뒤 권한을 신청해주세요. 관리자 승인 전에는 조회만 가능합니다.';
        el('accessApprovalCard').hidden = !window.isOwner;
        page.querySelectorAll('form button').forEach(button => button.disabled = busy);
    }
    window.renderAccessSettings = render;
    window.toggleAdminLogin = () => window.goTab('settings');
    window.changeAdminPassword = () => { window.goTab('settings'); el('accountPasswordCard').scrollIntoView({ behavior: 'smooth' }); };

    el('accountLoginForm').addEventListener('submit', event => {
        event.preventDefault();
        perform(async () => { await signInWithEmailAndPassword(auth, el('accountLoginEmail').value.trim(), el('accountLoginPassword').value); el('accountLoginPassword').value = ''; tell('로그인했습니다. 계정 권한을 확인하고 있습니다.'); });
    });
    el('showSignup').addEventListener('click', () => { el('accountLoginForm').hidden = true; el('accountSignupForm').hidden = false; });
    el('cancelSignup').addEventListener('click', () => { el('accountSignupForm').reset(); el('accountSignupForm').hidden = true; render(); });
    el('accountSignupForm').addEventListener('submit', event => {
        event.preventDefault();
        if (el('accountSignupPassword').value !== el('accountSignupConfirm').value) return tell('새 비밀번호가 일치하지 않습니다.', true);
        perform(async () => {
            const result = await createUserWithEmailAndPassword(auth, el('accountSignupEmail').value.trim(), el('accountSignupPassword').value);
            el('accountSignupForm').reset();
            await sendEmailVerification(result.user);
            tell('인증 메일을 보냈습니다. 이메일의 인증 링크를 누른 뒤 상태를 새로고침하고 총무 권한을 신청해주세요.');
        });
    });
    el('verifyAccount').addEventListener('click', () => perform(async () => { await sendEmailVerification(auth.currentUser); tell('인증 메일을 보냈습니다. 받은편지함과 스팸함을 확인해주세요.'); }));
    el('resetAccountPassword').addEventListener('click', () => perform(async () => {
        const email = el('accountLoginEmail').value.trim();
        if (!email || !el('accountLoginEmail').checkValidity()) return tell('위 이메일 입력란에 올바른 이메일을 입력해주세요.', true);
        await sendPasswordResetEmail(auth, email);
        tell('등록된 계정이면 비밀번호 재설정 메일을 받을 수 있습니다.');
    }));
    el('btnLogin').addEventListener('click', () => perform(async () => { await signOut(auth); tell('로그아웃했습니다.'); }));
    el('refreshAccount').addEventListener('click', () => perform(async () => {
        if (!auth.currentUser) return;
        await auth.currentUser.reload();
        await auth.currentUser.getIdToken(true);
        watchUser(auth.currentUser);
        tell('이메일 인증과 승인 상태를 다시 확인하고 있습니다.');
    }));
    el('treasurerRequestForm').addEventListener('submit', event => {
        event.preventDefault();
        perform(async () => {
            const user = auth.currentUser;
            if (!canRequest(user, request, role)) return tell('이메일 인증과 신청 상태를 확인해주세요.', true);
            const name = el('requestName').value.trim();
            if (!name) return tell('이름을 입력해주세요.', true);
            await set(ref(db, `${ACCESS_ROOT}/requests/${user.uid}`), { uid: user.uid, email: user.email, name, status: 'pending', requestedAt: serverTimestamp() });
            tell('총무 권한 신청을 접수했습니다. 관리자 승인을 기다려주세요.');
        });
    });
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
    function renderRequests(requests) {
        const list = el('accessRequestsList');
        list.replaceChildren();
        const entries = Object.entries(requests).sort((a, b) => b[1].requestedAt - a[1].requestedAt);
        if (!entries.length) { list.textContent = '접수된 신청이 없습니다.'; return; }
        for (const [uid, item] of entries) {
            const row = document.createElement('div'); row.className = 'access-request-row';
            const name = document.createElement('strong'); name.textContent = item.name;
            const email = document.createElement('div'); email.textContent = item.email; email.className = 'settings-description';
            const status = document.createElement('div'); status.textContent = statuses[item.status] || item.status; status.className = 'settings-description';
            row.append(name, email, status);
            const actions = document.createElement('div'); actions.className = 'settings-actions';
            for (const [label, state] of item.status === 'pending' ? [['승인', 'approved'], ['반려', 'rejected']] : item.status === 'approved' ? [['총무 권한 회수', 'revoked']] : []) {
                const button = document.createElement('button'); button.className = 'btn-sub'; button.textContent = label;
                button.addEventListener('click', () => perform(async () => {
                    if (!window.isOwner || auth.currentUser?.email !== OWNER_EMAIL) throw new Error('permission_denied');
                    if (!confirm(`${item.name} (${item.email})님의 신청을 ${label}하시겠습니까?`)) return;
                    const current = (await get(ref(db, `${ACCESS_ROOT}/requests/${uid}`))).val();
                    if (!current || current.status !== item.status) return tell('신청 상태가 변경되었습니다. 최신 내역을 확인해주세요.', true);
                    const changes = {};
                    changes[`${ACCESS_ROOT}/requests/${uid}`] = { ...current, status: state, reviewedAt: serverTimestamp(), reviewedBy: auth.currentUser.uid };
                    changes[`${ACCESS_ROOT}/roles/${uid}`] = state === 'approved' ? { role: 'treasurer', email: current.email, name: current.name, grantedAt: serverTimestamp(), grantedBy: auth.currentUser.uid } : null;
                    await update(ref(db), changes);
                    tell(`${item.name}님의 ${label} 처리를 완료했습니다.`);
                }));
                actions.append(button);
            }
            row.append(actions); list.append(row);
        }
    }
    function watchUser(user) {
        const currentGeneration = ++generation;
        subscriptions.forEach(stop => stop()); subscriptions = [];
        grant = null; request = null;
        applyRole(resolveRole(user, null));
        if (!user) return;
        const fail = error => { if (currentGeneration === generation) tell(errorMessage(error), true); };
        subscriptions.push(onValue(ref(db, `${ACCESS_ROOT}/requests/${user.uid}`), snapshot => {
            if (currentGeneration !== generation) return;
            request = snapshot.val(); render();
        }, fail));
        if (user.email === OWNER_EMAIL) {
            subscriptions.push(onValue(ref(db, `${ACCESS_ROOT}/requests`), snapshot => {
                if (currentGeneration === generation) renderRequests(snapshot.val() || {});
            }, fail));
        } else {
            subscriptions.push(onValue(ref(db, `${ACCESS_ROOT}/roles/${user.uid}`), snapshot => {
                if (currentGeneration !== generation) return;
                grant = snapshot.val(); applyRole(resolveRole(user, grant));
            }, error => { if (currentGeneration === generation) { applyRole('pending'); fail(error); } }));
        }
    }
    onAuthStateChanged(auth, watchUser);
    render();
}
