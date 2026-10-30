import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { spawnSync } from 'node:child_process';
import { OWNER_EMAIL, resolveRole, canManage, canManageMatch } from '../access-policy.js';
import { privatizeMatchTree, findPhoneLikePaths, toPublicAccountMember, isPhoneValue } from '../member-privacy.js';

const user = { uid: 'next', email: 'next@example.com' };
test('Only the designated owner receives owner permissions', () => {
    assert.equal(resolveRole({ email: OWNER_EMAIL }, null), 'owner');
    assert.equal(resolveRole(null, { role: 'owner' }), 'visitor');
    assert.equal(resolveRole(user, { role: 'owner', email: user.email }), 'pending');
});
test('A role grant must match the signed-in email', () => {
    assert.equal(resolveRole(user, { role: 'treasurer', email: user.email }), 'treasurer');
    assert.equal(resolveRole(user, { role: 'director', email: user.email }), 'director');
    assert.equal(resolveRole(user, { role: 'director', email: 'other@example.com' }), 'pending');
    assert.equal(resolveRole(user, { role: 'revoked', email: user.email }), 'pending');
    assert.equal(resolveRole(user, null), 'pending');
});
test('Treasurer manages accounting only, director manages the tournament only, owner manages both', () => {
    assert.deepEqual([canManage('owner'), canManageMatch('owner')], [true, true]);
    assert.deepEqual([canManage('treasurer'), canManageMatch('treasurer')], [true, false]);
    assert.deepEqual([canManage('director'), canManageMatch('director')], [false, true]);
    for (const role of ['pending', 'visitor', 'revoked', null]) assert.deepEqual([canManage(role), canManageMatch(role)], [false, false]);
});
test('Public accounting members exclude phone, spouse and birth year', () => {
    const member = toPublicAccountMember({ id: 1, name: '가', phone: '010-1111-2222', spouse: '나', birthday: '1970-03-05', status: '정회원', role: '총무', paid: [true], joinDate: '2020-01-01' });
    assert.deepEqual(member, { id: 1, name: '가', status: '정회원', role: '총무', joinDate: '2020-01-01', paid: [true], birthday: '0000-03-05' });
    assert.equal(member.birthday.substring(5), '03-05');
});
test('Match data replaces every phone with one internal ID and keeps private fields apart', () => {
    let next = 0;
    const source = {
        clubData: {
            members: [{ id: 1, name: '가', phone: '010-1111-2222', status: '정회원', paid: [true], spouse: '나', role: '회장' }, { name: '다', phone: '01033334444', status: '정회원' }],
            attendanceData: { phones: ['01011112222', '010-3333-4444'] }
        },
        rankingData: { tiers: { '010-1111-2222': 'A', '01033334444': 'B' }, history: [{ changes: [{ phone: '01011112222' }, { phone: '010-9999-0000' }] }] },
        tennisHistory: { 100: { id: 100, date: '2026-10-30', title: '10월', players: [{ name: '가', phone: '010-1111-2222' }] } }
    };
    const { tree, privateMembers } = privatizeMatchTree(source, ['clubData', 'members'], { newId: () => `m_${++next}` });
    const [first, second] = tree.clubData.members;
    assert.equal(first.phone, 'm_1');
    assert.deepEqual(Object.keys(first).sort(), ['id', 'name', 'phone', 'status']);
    assert.deepEqual(privateMembers.m_1, { phone: '010-1111-2222', paid: [true], spouse: '나', role: '회장' });
    assert.equal(second.phone, 'm_2');
    assert.deepEqual(tree.rankingData.tiers, { m_1: 'A', m_2: 'B' });
    assert.deepEqual(tree.clubData.attendanceData.phones, ['m_1', 'm_2']);
    assert.equal(tree.tennisHistory[100].players[0].phone, 'm_1');
    assert.equal(tree.rankingData.history[0].changes[1].phone, 'm_3');
    assert.equal(privateMembers.m_3.phone, '010-9999-0000');
    assert.equal(tree.tennisHistory[100].date, '2026-10-30');
    assert.deepEqual(findPhoneLikePaths(tree), []);
});
test('Already converted backups keep their IDs and private data', () => {
    const { tree, privateMembers } = privatizeMatchTree({ members: [{ name: '가', phone: 'm_old' }] }, ['members'], { existing: { m_old: { phone: '010-1111-2222' } } });
    assert.equal(tree.members[0].phone, 'm_old');
    assert.equal(privateMembers.m_old.phone, '010-1111-2222');
});
test('Leak checks report embedded phones without returning their digits', () => {
    const paths = findPhoneLikePaths({ memo: '연락처 010-1234-5678', '01012345678': 'A', id: 1712345678901, date: '2026-10-30' });
    assert.equal(paths.length, 2);
    assert.ok(paths.every(item => !/\d{4}/.test(item)));
    assert.equal(isPhoneValue('2026-10-30'), false);
    assert.equal(isPhoneValue('m_abc'), false);
});
test('Rules separate accounting and tournament writers and hide private paths', () => {
    const rules = JSON.parse(fs.readFileSync(new URL('../database.rules.json', import.meta.url))).rules;
    assert.equal(rules['.read'], false);
    assert.equal(rules['.write'], false);
    assert.equal(rules.clubData['.read'], undefined);
    assert.equal(rules.accountingSafety['.read'], undefined);
    assert.match(rules.clubData.members_acc['.read'], /treasurer/);
    assert.doesNotMatch(rules.clubData.members_acc['.read'], /director/);
    assert.doesNotMatch(rules.matchData['.write'], /treasurer/);
    assert.match(rules.matchData['.write'], /director/);
    assert.equal(rules.matchData['.read'], true);
    assert.doesNotMatch(rules.matchPrivate['.read'], /treasurer/);
});
test('All inline application scripts and new modules parse', () => {
    for (const page of ['../index.html', '../match/index.html', '../recovery.html']) {
        const html = fs.readFileSync(new URL(page, import.meta.url), 'utf8');
        for (const [, attributes, code] of html.matchAll(/<script\b([^>]*)>([\s\S]*?)<\/script>/g)) {
            const args = ['--check'];
            if (attributes.includes('module')) args.push('--input-type=module');
            const result = spawnSync(process.execPath, args, { input: code, encoding: 'utf8' });
            assert.equal(result.status, 0, `${page}: ${result.stderr}`);
        }
    }
    for (const file of ['account-access.js', 'settings-view.js', 'access-policy.js', 'member-privacy.js']) {
        const result = spawnSync(process.execPath, ['--check', new URL('../' + file, import.meta.url).pathname.replace(/^\/(\w:)/, '$1')], { encoding: 'utf8' });
        assert.equal(result.status, 0, result.stderr);
    }
});
