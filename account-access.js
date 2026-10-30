import { createSettingsPage } from './settings-view.js?v=20261030_03';
import {
    createUserWithEmailAndPassword, signInWithEmailAndPassword, signOut,
    onAuthStateChanged, sendEmailVerification, sendPasswordResetEmail,
    updatePassword, reauthenticateWithCredential, EmailAuthProvider
} from 'https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js';
import { ref, get, set, onValue, update, serverTimestamp } from 'https://www.gstatic.com/firebasejs/10.7.1/firebase-database.js';
import { OWNER_EMAIL, ACCESS_ROOT, resolveRole, canManage, canRequest } from './access-policy.js?v=20261030_02';

export function installAccountAccess({ auth, db, refreshUI, onManagerReady }) {
    const page = createSettingsPage();
    const el = id => document.getElementById(id);
    let role = 'visitor', request = null, grant = null;
    let generation = 0, subscriptions = [], busy = false, requestReady = false, mode = 'login';
    const roleLabels = { visitor: '방문자', pending: '승인 전 계정', owner: '관리자 · 개발자', treasurer: '총무' };
    const statuses = { pending: '승인 대기', approved: '승인됨', rejected: '반려됨 · 다시 신청할 수 있습니다.', revoked: '권한 회수됨 · 다시 신청할 수 있습니다.' };
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
    function setMode(next) {
        mode = next;
        render();
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
    el('loginModeTab').addEventListener('click', () => setMode('login'));
    el('requestModeTab').addEventListener('click', () => setMode('request'));
    for(const id of ['loginModeTab', 'requestModeTab']) el(id).addEventListener('keydown', event => {
        if(!['ArrowLeft','ArrowRight','Home','End'].includes(event.key)) return;
        event.preventDefault();
        const requestTab = event.key === 'End' || (event.key !== 'Home' && id === 'loginModeTab');
        setMode(requestTab ? 'request' : 'login');
        el(requestTab ? 'requestModeTab' : 'loginModeTab').focus();
    });
    window.openAccountDialog = (nextMode = 'login') => { setMode(nextMode === 'request' ? 'request' : 'login'); openDialog('accountDialog'); };
    window.openAppSettings = () => { render(); openDialog('settingsDialog'); };
    window.closeAccountPopups = () => { el('accountDialog').close(); el('settingsDialog').close(); syncScrollLock(); };
    el('settingsOpenAccount').addEventListener('click', () => window.openAccountDialog());
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
        return messages[error.code] || (/permission/i.test(String(error.code || '') + String(error.message)) ? '신청 또는 권한 저장이 거부되었습니다. 관리자에게 문의해주세요.' : '처리하지 못했습니다. 인터넷 연결을 확인하고 다시 시도해주세요.');
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
            if (wasManager) el('settingsDialog').close();
        }
        refreshUI();
        render();
        if (!wasManager && window.isAdmin) onManagerReady();
    }
    function render() {
        const user = auth.currentUser;
        const applying = mode === 'request';
        el('accountDialogTitle').textContent = applying ? '총무 권한 신청' : user ? '내 계정' : '로그인';
        el('loginModeTab').setAttribute('aria-selected', String(!applying));
        el('requestModeTab').setAttribute('aria-selected', String(applying));
        el('loginModeTab').tabIndex = applying ? -1 : 0;
        el('requestModeTab').tabIndex = applying ? 0 : -1;
        el('loginPanel').hidden = applying || !!user;
        el('requestPanel').hidden = !applying || !!user;
        el('accountRole').textContent = roleLabels[role];
        el('accountEmail').textContent = user?.email || '로그인하지 않았습니다.';
        el('settingsAccountRole').textContent = roleLabels[role];
        el('settingsAccountEmail').textContent = user?.email || '로그인하지 않았습니다.';
        el('accountLoginForm').hidden = !!user || applying;
        el('accountSignupForm').hidden = !!user || !applying;
        const headerLogin = el('btnAccount');
        if (headerLogin) { headerLogin.textContent = user ? '내 계정' : '로그인'; headerLogin.setAttribute('aria-label', user ? '내 계정 및 신청 상태' : '로그인 또는 총무 권한 신청'); }
        el('signedInActions').hidden = !user;
        el('accountPasswordCard').hidden = !user;
        el('verifyAccount').hidden = !user || user.emailVerified;
        el('treasurerRequestCard').hidden = !user || role === 'owner';
        el('treasurerRequestForm').hidden = !requestReady || !canRequest(user, request, role);
        const verifiedNote = user && !user.emailVerified ? ' 이메일 인증을 완료해야 승인 후 편집 권한을 사용할 수 있습니다.' : '';
        const date = request?.requestedAt ? new Intl.DateTimeFormat('ko-KR', {timeZone:'Asia/Seoul',month:'long',day:'numeric',hour:'2-digit',minute:'2-digit'}).format(new Date(request.requestedAt)) : '';
        el('myRequestStatus').textContent = !requestReady ? '서버에 저장된 신청 상태를 확인하고 있습니다.' : request ? `${request.status === 'pending' ? '접수 완료 · 승인 대기' : statuses[request.status] || request.status}${date ? ' · ' + date : ''}.${verifiedNote}` : '접수된 신청이 없습니다. 아래에서 신청해주세요.' + verifiedNote;
        el('accountDescription').textContent = role === 'owner' ? '관리자 계정입니다. 설정에서 총무 신청을 승인하거나 권한을 회수할 수 있습니다.' : role === 'treasurer' ? '총무 권한으로 거래·회원·영수증·일정과 결산을 관리할 수 있습니다.' : '일반 계정으로 로그인했습니다. 총무 신청 상태를 아래에서 확인할 수 있습니다.';
        el('accessApprovalCard').hidden = !window.isOwner;
        page.querySelectorAll('form button').forEach(button => button.disabled = busy);
    }
    window.renderAccessSettings = render;
    window.toggleAdminLogin = () => window.openAccountDialog();
    window.changeAdminPassword = () => { window.openAppSettings(); el('accountPasswordCard').scrollIntoView({ behavior: 'smooth' }); };

    async function saveRequest(user, name) {
        if(user.email === OWNER_EMAIL) { tell('현재 계정은 관리자입니다. 별도의 총무 신청 없이 사용할 수 있습니다.'); return false; }
        const path = ref(db, `${ACCESS_ROOT}/requests/${user.uid}`);
        const existing = (await get(path)).val();
        if (existing && ['pending', 'approved'].includes(existing.status)) {
            request = existing; requestReady = true; render();
            tell(existing.status === 'pending' ? '이미 접수된 신청이 있습니다. 관리자 승인을 기다려주세요.' : '이미 승인된 신청입니다. 이메일 인증 및 승인 상태를 새로고침해주세요.');
            return false;
        }
        await set(path, {uid:user.uid, email:user.email, name, status:'pending', requestedAt:serverTimestamp()});
        const confirmed = (await get(path)).val();
        if (!confirmed || confirmed.uid !== user.uid || confirmed.email !== user.email || confirmed.status !== 'pending') throw new Error('신청 저장을 확인하지 못했습니다.');
        request = confirmed; requestReady = true; render();
        tell('신청이 서버에 저장되었습니다. 관리자 승인 대기 상태입니다.');
        return true;
    }

    el('accountLoginForm').addEventListener('submit', event => {
        event.preventDefault();
        perform(async () => { await signInWithEmailAndPassword(auth, el('accountLoginEmail').value.trim(), el('accountLoginPassword').value); el('accountLoginPassword').value = ''; tell('로그인했습니다. 계정 권한을 확인하고 있습니다.'); });
    });
    el('showSignup').addEventListener('click', () => setMode('request'));
    el('cancelSignup').addEventListener('click', () => setMode('login'));
    el('accountSignupForm').addEventListener('submit', event => {
        event.preventDefault();
        if (el('accountSignupPassword').value !== el('accountSignupConfirm').value) return tell('새 비밀번호가 일치하지 않습니다.', true);
        perform(async () => {
            const name = el('accountSignupName').value.trim();
            if(!name) return tell('이름을 입력해주세요.', true);
            const email = el('accountSignupEmail').value.trim();
            const password = el('accountSignupPassword').value;
            let result;
            try { result = await createUserWithEmailAndPassword(auth, email, password); }
            catch(error) {
                if(error.code !== 'auth/email-already-in-use') throw error;
                result = await signInWithEmailAndPassword(auth, email, password);
            }
            el('accountSignupPassword').value = '';
            el('accountSignupConfirm').value = '';
            el('requestName').value = name;
            const saved = await saveRequest(result.user, name);
            el('accountSignupForm').reset();
            if(saved && !result.user.emailVerified) {
                try { await sendEmailVerification(result.user); tell('신청 접수 완료 · 인증 메일을 보냈습니다. 이메일 인증과 관리자 승인을 마치면 사용할 수 있습니다.'); }
                catch(error) { tell('신청은 저장되었습니다. 인증 메일을 보내지 못했으니 아래 인증 메일 보내기 버튼으로 다시 시도해주세요.', true); }
            }
        });
    });
    el('verifyAccount').addEventListener('click', () => perform(async () => { await sendEmailVerification(auth.currentUser); tell('인증 메일을 보냈습니다. 받은편지함과 스팸함을 확인해주세요.'); }));
    el('resetAccountPassword').addEventListener('click', () => perform(async () => {
        const email = el('accountLoginEmail').value.trim();
        if (!email || !el('accountLoginEmail').checkValidity()) return tell('위 이메일 입력란에 올바른 이메일을 입력해주세요.', true);
        await sendPasswordResetEmail(auth, email);
        tell('등록된 계정이면 비밀번호 재설정 메일을 받을 수 있습니다.');
    }));
    el('btnLogin').addEventListener('click', () => perform(async () => {
        await signOut(auth);
        ['accountLoginForm','accountSignupForm','changeAccountPasswordForm'].forEach(id => el(id).reset());
        el('requestName').value = '';
        setMode('login');
        tell('로그아웃했습니다.');
    }));
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
            if (!canRequest(user, request, role)) return tell('이미 접수되었거나 승인된 신청인지 확인해주세요.', true);
            const name = el('requestName').value.trim();
            if (!name) return tell('이름을 입력해주세요.', true);
            await saveRequest(user, name);
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
        grant = null; request = null; requestReady = false;
        applyRole(resolveRole(user, null));
        if (!user) return;
        const fail = error => { if (currentGeneration === generation) tell(errorMessage(error), true); };
        subscriptions.push(onValue(ref(db, `${ACCESS_ROOT}/requests/${user.uid}`), snapshot => {
            if (currentGeneration !== generation) return;
            request = snapshot.val(); requestReady = true; render();
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
