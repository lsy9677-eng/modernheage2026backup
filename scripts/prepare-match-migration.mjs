// 월례대회 앱 데이터를 회계 프로젝트로 옮길 JSON을 만듭니다. 읽기만 하며 Firebase에 쓰지 않습니다.
// 사용법: node scripts/prepare-match-migration.mjs <출력 폴더>
import fs from 'node:fs';
import path from 'node:path';
import { privatizeMatchTree, findPhoneLikePaths, toPublicAccountMembers } from '../member-privacy.js';

const MATCH_DB = 'https://modern2026mach-default-rtdb.firebaseio.com';
const ACCOUNT_DB = 'https://modern-account-2026-default-rtdb.firebaseio.com';
const outputDir = process.argv[2];
if (!outputDir) throw new Error('출력 폴더를 지정해주세요.');

async function read(base, node) {
    const response = await fetch(`${base}/${node}.json`);
    if (!response.ok) throw new Error(`${node} 읽기 실패: ${response.status}`);
    return response.json();
}

const source = {
    clubData: await read(MATCH_DB, 'clubData'),
    rankingData: await read(MATCH_DB, 'rankingData'),
    tennisHistory: await read(MATCH_DB, 'tennisHistory')
};
const accountMembers = await read(ACCOUNT_DB, 'clubData/members_acc');
if (!source.clubData?.members?.length) throw new Error('월례대회 회원 명단이 비어 있습니다.');
if (!accountMembers?.length) throw new Error('회계 회원 명부가 비어 있습니다.');

const { tree: matchData, privateMembers } = privatizeMatchTree(source, ['clubData', 'members']);
const leaks = findPhoneLikePaths(matchData);
const membersPublic = toPublicAccountMembers(accountMembers);
const accountLeaks = findPhoneLikePaths(membersPublic);
if (leaks.length || accountLeaks.length) throw new Error(`공개 데이터에 전화번호가 남았습니다: ${[...leaks, ...accountLeaks].join(', ')}`);

const missing = source.clubData.members.filter(member => !member?.phone).length;
if (matchData.clubData.members.length !== source.clubData.members.length || missing) throw new Error('회원 수가 맞지 않거나 번호 없는 회원이 있습니다.');
const tierCount = object => Object.keys(object?.rankingData?.tiers || {}).length;
if (tierCount(matchData) !== tierCount(source)) throw new Error('등급 수가 변환 전후로 다릅니다.');

fs.mkdirSync(outputDir, { recursive: true });
const write = (name, value) => fs.writeFileSync(path.join(outputDir, name), JSON.stringify(value));
write('source-match-backup.json', source);
write('source-account-members-backup.json', accountMembers);
write('import-matchData.json', matchData);
write('import-matchPrivate.json', { members: privateMembers });
write('import-membersPublic.json', membersPublic);
console.log(`회원 ${matchData.clubData.members.length}명, 등급 ${tierCount(matchData)}건, 경기 ${Object.keys(matchData.tennisHistory || {}).length}건, 비공개 항목 ${Object.keys(privateMembers).length}건, 회계 공개 명부 ${membersPublic.length}명`);
