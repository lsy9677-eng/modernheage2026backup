import test from 'node:test';
import assert from 'node:assert/strict';
import { applyMemberLifecycle, visibleRoster, projectMatchRoster, effectiveMatchTier, planRosterLinks, matchRosterId, rosterPlayerMatches } from '../roster-policy.js';

test('Master roster controls names, count and status while retaining match identity and photos',()=>{
    const source=[{id:1,name:'새 이름',status:'남성'},{id:2,name:'신규 회원',status:'휴회'}];
    const old=[{id:900,accountMemberId:'1',name:'옛 이름',status:'탈회',phone:'m_original',photo:'saved-photo'}];
    const projected=projectMatchRoster(source,old,2026);
    assert.equal(projected.length,2);assert.equal(projected[0].phone,'m_original');assert.equal(projected[0].photo,'saved-photo');assert.equal(projected[0].name,'새 이름');assert.equal(projected[0].status,'남성');assert.equal(projected[1].phone,matchRosterId(2));
    assert.equal(old[0].name,'옛 이름');
});
test('Pause and resignation are derived without overwriting competition grades',()=>{
    const tiers={m_one:'B'};const member={phone:'m_one',status:'남성'};
    assert.equal(effectiveMatchTier(member,tiers),'B');assert.equal(effectiveMatchTier({...member,status:'휴회'},tiers),'D');assert.equal(effectiveMatchTier({...member,status:'탈회'},tiers),'E');assert.equal(effectiveMatchTier(member,tiers),'B');assert.equal(tiers.m_one,'B');
});
test('Resigned members remain for that year and disappear from both roster projections next year',()=>{
    const retired=applyMemberLifecycle({id:1,name:'탈회원',status:'탈회'},{id:1,status:'남성'},2026);
    const members=[retired,{id:2,name:'휴회원',status:'휴회'}];
    assert.equal(retired.withdrawnYear,2026);assert.equal(visibleRoster(members,2026).length,2);assert.equal(visibleRoster(members,2027).length,1);assert.equal(projectMatchRoster(members,[],2027).length,1);assert.equal(members.length,2);
    assert.equal(visibleRoster([{...retired,withdrawnYear:2027}],2027).length,1);
});
test('Editing an existing resignation does not restart retention and rejoining clears it',()=>{
    const old={id:1,status:'탈회',withdrawnYear:2026};
    assert.equal(applyMemberLifecycle({...old,name:'수정'},old,2027).withdrawnYear,2026);
    assert.equal(applyMemberLifecycle({...old,status:'남성'},old,2027).withdrawnYear,undefined);
    assert.equal(applyMemberLifecycle({status:'탈회'},null,2027).withdrawnYear,2027);
});
test('Migration links phone and unique names, adds new records and archives unmatched metadata',()=>{
    const accounts=[{id:1,name:'이름 변경',phone:'010-1234-5678',status:'남성'},{id:2,name:'동일 이름',status:'휴회'},{id:3,name:'신규',status:'여성'}];
    const existing=[{name:'옛 이름',phone:'m_one',photo:'photo1'},{name:'동일 이름',phone:'m_two'},{name:'옛 회원',phone:'m_archive'}];
    const plan=planRosterLinks(accounts,existing,{m_one:{phone:'01012345678'}});
    assert.deepEqual(plan.matches.map(item=>item.method),['phone','name','new']);assert.equal(plan.members[0].phone,'m_one');assert.equal(plan.members[0].photo,'photo1');assert.equal(plan.archived[0].phone,'m_archive');
    assert.equal(projectMatchRoster(accounts,plan.members,2026).length,3);
});
test('Ambiguous identity matches stop migration instead of merging different members',()=>{
    assert.throws(()=>planRosterLinks([{id:1,name:'동명이인'}],[{name:'동명이인',phone:'m_a'},{name:'동명이인',phone:'m_b'}]));
    assert.notEqual(matchRosterId('1'),matchRosterId('01'));assert.match(matchRosterId('id.with#unsafe/key'),/^m_[a-z0-9_]+$/);
});
test('Restored legacy resignations retain the established migration-year policy',()=>{
    assert.equal(visibleRoster([{id:1,status:'탈회'}],2026).length,1);assert.equal(visibleRoster([{id:1,status:'탈회'}],2027).length,0);
    assert.equal(effectiveMatchTier({phone:'m_x',status:'남성'},{m_x:'D'}),'');
});
test('Renamed linked members retain historical player identity without rewriting records',()=>{
    const member=projectMatchRoster([{id:1,name:'새 이름',status:'남성'}],[{accountMemberId:'1',phone:'m_one',name:'옛 이름'}],2026)[0];
    assert(rosterPlayerMatches(member,{name:'옛 이름'}));assert(rosterPlayerMatches(member,{accountMemberId:'1',name:'어떤 이름'}));assert(!rosterPlayerMatches(member,{accountMemberId:'2',name:'새 이름'}));
});
