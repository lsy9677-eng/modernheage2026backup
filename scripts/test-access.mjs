import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import { spawnSync } from 'node:child_process';
import { OWNER_EMAIL, resolveRole, canManage, canRequest } from '../access-policy.js';

const user = { uid: 'next', email: 'next@example.com', emailVerified: true };
const grant = { role: 'treasurer', email: user.email };
test('Only the designated owner receives owner permissions', () => {
    assert.equal(resolveRole({ email: OWNER_EMAIL }, null), 'owner');
    assert.equal(resolveRole(null, { role: 'owner' }), 'visitor');
    assert.equal(resolveRole(user, { role: 'owner', email: user.email }), 'pending');
});
test('Approval requires a matching email and verified account', () => {
    assert.equal(resolveRole(user, grant), 'treasurer');
    assert.equal(resolveRole({ ...user, emailVerified: false }, grant), 'pending');
    assert.equal(resolveRole(user, { ...grant, email: 'other@example.com' }), 'pending');
    assert.equal(resolveRole(user, null), 'pending');
});
test('Revoked and pending accounts cannot manage the ledger', () => {
    for (const role of ['pending', 'visitor', 'revoked', null]) assert.equal(canManage(role), false);
    assert.equal(canManage('owner'), true);
    assert.equal(canManage('treasurer'), true);
});
test('Only verified accounts without an active request can apply', () => {
    assert.equal(canRequest(user, null, 'pending'), true);
    assert.equal(canRequest(user, {status: 'rejected'}, 'pending'), true);
    assert.equal(canRequest(user, {status: 'revoked'}, 'pending'), true);
    assert.equal(canRequest(user, {status: 'pending'}, 'pending'), false);
    assert.equal(canRequest(user, {status: 'approved'}, 'treasurer'), false);
    assert.equal(canRequest({...user, emailVerified:false}, null, 'pending'), false);
});

// Exercise the actual rule expressions with DataSnapshot-shaped fixtures.
// This checks policy decisions, not the Firebase rules compiler or emulator.
const rules = JSON.parse(fs.readFileSync(new URL('../database.rules.json', import.meta.url))).rules;
class Snapshot {
    constructor(value) { this.value = value ?? null; }
    val() { return this.value; }
    child(path) { return new Snapshot(path.split('/').reduce((v, key) => v?.[key], this.value)); }
    exists() { return this.value !== null; }
    hasChild(key) { return this.child(key).exists(); }
    hasChildren(keys) { return keys.every(key => this.hasChild(key)); }
    isString() { return typeof this.value === 'string'; }
    isNumber() { return typeof this.value === 'number'; }
}
const auth = { uid: user.uid, token: {email: user.email, email_verified: true} };
const owner = { uid: 'owner', token: {email: OWNER_EMAIL} };
const root = {accountAccess: {roles: {[user.uid]: grant}, requests: {[user.uid]: {email: user.email}}}};
const evaluate = (expression, options = {}) => {
    if (typeof expression === 'boolean') return expression;
    return vm.runInNewContext(expression, {auth, root:new Snapshot(root), data:new Snapshot(null), newData:new Snapshot(null), $uid:user.uid, $key:'lastWrite', now:Date.now()+1000, ...options});
};
test('Database rejects anonymous, pending, unverified and revoked writers', () => {
    const write = rules.clubData.transItems.$id['.write'];
    assert.equal(evaluate(write, {auth:null}), false);
    assert.equal(evaluate(write, {root:new Snapshot({})}), false);
    assert.equal(evaluate(write, {auth:{...auth, token:{...auth.token,email_verified:false}}}), false);
    assert.equal(evaluate(write, {root:new Snapshot({accountAccess:{roles:{}}})}), false);
    assert.equal(evaluate(write), true);
    assert.equal(evaluate(write, {auth:owner}), true);
});
test('Only owner can grant, revoke or read all account permissions', () => {
    const rule = rules.accountAccess.roles;
    for (const expression of [rule['.read'],rule.$uid['.write'],rules.accountAccess.requests['.read']]) {
        assert.equal(evaluate(expression), false);
        assert.equal(evaluate(expression,{auth:owner}), true);
    }
    assert.equal(evaluate(rule.$uid['.read']), true);
    assert.equal(evaluate(rule.$uid['.read'], {$uid:'other'}), false);
    assert.equal(rules['.read'],false);
    assert.equal(rules['.write'],false);
});
test('Applicants can only submit their own verified pending request', () => {
    const write = rules.accountAccess.requests.$uid['.write'];
    const request = {uid:user.uid,email:user.email,name:'Next treasurer',status:'pending',requestedAt:Date.now()};
    const input = {newData:new Snapshot(request)};
    assert.equal(evaluate(write,input), true);
    assert.equal(evaluate(write,{...input,auth:null}), false);
    assert.equal(evaluate(write,{...input,$uid:'other'}), false);
    assert.equal(evaluate(write,{...input,auth:{...auth,token:{...auth.token,email_verified:false}}}), false);
    assert.equal(evaluate(write,{newData:new Snapshot({...request,status:'approved'})}), false);
    assert.equal(evaluate(write,{newData:new Snapshot({...request,email:'other@example.com'})}), false);
    assert.equal(evaluate(write,{...input,data:new Snapshot({...request,status:'approved'})}), false);
    assert.equal(evaluate(write,{...input,data:new Snapshot({...request,status:'revoked'})}), true);
    assert.equal(evaluate(write,{...input,newData:new Snapshot({...request,reviewedBy:'fake'})}), false);
});
test('Owner grants can only create treasurer role with the applicant email', () => {
    const validate = rules.accountAccess.roles.$uid['.validate'];
    const record = {...grant,name:'Next treasurer',grantedAt:Date.now(),grantedBy:owner.uid};
    assert.equal(evaluate(validate,{auth:owner,newData:new Snapshot(record)}),true);
    assert.equal(evaluate(validate,{auth:owner,newData:new Snapshot({...record,role:'owner'})}),false);
    assert.equal(evaluate(validate,{auth:owner,newData:new Snapshot({...record,email:'spoof@example.com'})}),false);
});
test('Bulk restore/import markers require owner, normal accounting writes allow treasurer', () => {
    const write = rules.accountingSafety.meta.$key['.write'];
    assert.equal(evaluate(write,{$key:'lastWrite'}),true);
    assert.equal(evaluate(write,{$key:'lastRestore'}),false);
    assert.equal(evaluate(write,{$key:'lastImport'}),false);
    assert.equal(evaluate(write,{$key:'lastRestore',auth:owner}),true);
    assert.equal(evaluate(rules.clubData.settings['.validate'],{newData:new Snapshot({adminPwd:'plaintext'})}),false);
});
test('All inline application scripts and new modules parse', () => {
    const html = fs.readFileSync(new URL('../index.html',import.meta.url),'utf8');
    for (const [,attributes,code] of html.matchAll(/<script\b([^>]*)>([\s\S]*?)<\/script>/g)) {
        const args = ['--check'];
        if(attributes.includes('module')) args.push('--input-type=module');
        const result = spawnSync(process.execPath,args,{input:code,encoding:'utf8'});
        assert.equal(result.status,0,result.stderr);
    }
    for (const file of ['account-access.js','settings-view.js','access-policy.js']) {
        const result = spawnSync(process.execPath,['--check',new URL('../'+file,import.meta.url).pathname.replace(/^\/(\w:)/,'$1')],{encoding:'utf8'});
        assert.equal(result.status,0,result.stderr);
    }
});
