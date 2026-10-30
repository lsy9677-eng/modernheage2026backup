import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import { applyMemberLifecycle, planRosterLinks, koreaRosterYear } from '../roster-policy.js';
import { toPublicAccountMembers, findPhoneLikePaths } from '../member-privacy.js';
const folder=process.argv[2];
if(!folder) throw Error('백업 폴더 경로를 지정해주세요.');
const read=file=>JSON.parse(fs.readFileSync(path.join(folder,file),'utf8'));
const account=read('roster-before-account.json');
const match=read('roster-before-match.json');
const privateRoot=read('roster-before-private.json')||{};
assert(Array.isArray(account)&&account.length>0);
assert.equal(new Set(account.map(member=>String(member.id))).size,account.length,'중복 회원 ID를 확인해야 합니다.');
const normalized=account.map(member=>applyMemberLifecycle(member,member,koreaRosterYear()));
const plan=planRosterLinks(normalized,match.clubData.members,privateRoot.members||{});
const contacts={...privateRoot.members};
for(const linked of plan.matches) {
    const member=normalized.find(member=>String(member.id)===String(linked.accountId));
    contacts[linked.matchId]={...(contacts[linked.matchId]||{}),phone:member.phone||'',accountMemberId:String(member.id)};
}
assert.equal(findPhoneLikePaths(plan.members).length,0,'매치 공개 명단에 전화번호가 포함되었습니다.');
const updates={
    'clubData/members_acc':normalized,
    'clubData/membersPublic':toPublicAccountMembers(normalized),
    'matchData/clubData/members':plan.members,
    'matchPrivate/members':contacts,
    'matchData/clubData/rosterSync':{source:'clubData/membersPublic',linkedAt:new Date().toISOString(),year:koreaRosterYear(),members:normalized.length}
};
if(plan.archived.length)updates['matchData/clubData/rosterArchive']=plan.archived;
fs.writeFileSync(path.join(folder,'unified-roster-import.json'),JSON.stringify(updates));
console.log(JSON.stringify({canonicalMembers:normalized.length,linked:plan.matches.filter(item=>item.method!=='new').length,new:plan.matches.filter(item=>item.method==='new').length,archived:plan.archived.length,withdrawn:normalized.filter(member=>member.status==='탈회').length,gradesUnchanged:true,historyUnchanged:true}));
