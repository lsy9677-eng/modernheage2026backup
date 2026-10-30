export const ROSTER_BASE_YEAR = 2026;
export const ACTIVE_MATCH_TIERS = ['A','A(-)','B','B(-)','C','C(-)'];
export function koreaRosterYear() { return Number(new Intl.DateTimeFormat('en',{timeZone:'Asia/Seoul',year:'numeric'}).format(new Date())); }
export function applyMemberLifecycle(member, previous = null, year = koreaRosterYear()) {
    const next = {...member};
    if(next.status === '탈회') next.withdrawnYear = previous?.status === '탈회' ? Number(previous.withdrawnYear) || Number(next.withdrawnYear) || year : year;
    else delete next.withdrawnYear;
    return next;
}
export function visibleRoster(members, year = koreaRosterYear()) {
    return (Array.isArray(members) ? members : Object.values(members || {})).filter(member => member && (member.status !== '탈회' || (Number(member.withdrawnYear) || ROSTER_BASE_YEAR) >= year));
}
export function matchRosterId(accountId) {
    if(accountId === undefined || accountId === null || String(accountId) === '') throw new Error('회원 고유 ID가 없습니다.');
    return 'm_account_' + Array.from(new TextEncoder().encode(String(accountId)), byte=>byte.toString(16).padStart(2,'0')).join('');
}
export function projectMatchRoster(accountMembers, matchMembers, year = koreaRosterYear()) {
    const metadata = new Map((Array.isArray(matchMembers) ? matchMembers : Object.values(matchMembers || {})).filter(member=>member?.accountMemberId!==undefined).map(member=>[String(member.accountMemberId),member]));
    return visibleRoster(accountMembers,year).map(member=>{
        const saved=metadata.get(String(member.id));
        const linked={...(saved || {}),id:saved?.id ?? member.id,phone:saved?.phone || matchRosterId(member.id),accountMemberId:String(member.id),name:member.name,status:member.status};
        linked.nameAliases=[...new Set([...(saved?.nameAliases || []),...(saved?.name&&saved.name!==member.name?[saved.name]:[])])].filter(name=>name!==member.name);
        if(member.withdrawnYear) linked.withdrawnYear=member.withdrawnYear;else delete linked.withdrawnYear;
        return linked;
    });
}
export function effectiveMatchTier(member, tiers = {}) {
    if(member?.status === '탈회') return 'E';
    if(member?.status === '휴회') return 'D';
    const tier=tiers[member?.phone];
    return ACTIVE_MATCH_TIERS.includes(tier) ? tier : '';
}
export function rosterPlayerMatches(member, player) {
    if(!member || !player) return false;
    if(player.accountMemberId!==undefined) return String(player.accountMemberId)===String(member.accountMemberId);
    if(player.matchMemberId) return player.matchMemberId===member.phone;
    if(typeof player.phone==='string'&&player.phone.startsWith('m')) return player.phone===member.phone;
    return [member.name,...(member.nameAliases||[])].includes(player.name);
}
export function planRosterLinks(accountMembers, matchMembers, privateMembers = {}) {
    const used=new Set(), linked=[], matches=[];
    const digits=value=>String(value||'').replace(/\D/g,'');
    for(const account of accountMembers) {
        let candidates=matchMembers.filter(member=>member.accountMemberId!==undefined&&String(member.accountMemberId)===String(account.id));
        let method='id';
        if(!candidates.length&&digits(account.phone)) {candidates=matchMembers.filter(member=>!used.has(member.phone)&&digits(privateMembers[member.phone]?.phone)===digits(account.phone));method='phone';}
        if(!candidates.length) {candidates=matchMembers.filter(member=>!used.has(member.phone)&&String(member.name).trim()===String(account.name).trim());method='name';}
        if(candidates.length>1 || (candidates[0]&&used.has(candidates[0].phone))) throw new Error('동명이인 또는 중복 회원 연결을 확인해야 합니다. 자동 통합을 중단합니다.');
        const existing=candidates[0];if(existing)used.add(existing.phone);
        linked.push({...existing,id:existing?.id??account.id,phone:existing?.phone||matchRosterId(account.id),accountMemberId:String(account.id),name:account.name,status:account.status,nameAliases:[...new Set([...(existing?.nameAliases||[]),...(existing?.name&&existing.name!==account.name?[existing.name]:[])])].filter(name=>name!==account.name),...(account.withdrawnYear?{withdrawnYear:account.withdrawnYear}:{})});
        matches.push({accountId:account.id,matchId:existing?.phone||matchRosterId(account.id),method:existing?method:'new'});
    }
    return {members:linked,matches,archived:matchMembers.filter(member=>!used.has(member.phone))};
}
export function watchRosterYear(callback) {
    let year=koreaRosterYear();
    const check=()=>{const next=koreaRosterYear();if(next!==year){year=next;callback(next);}};
    const timer=setInterval(check,60000);window.addEventListener('focus',check);document.addEventListener('visibilitychange',check);
    return ()=>{clearInterval(timer);window.removeEventListener('focus',check);document.removeEventListener('visibilitychange',check);};
}
