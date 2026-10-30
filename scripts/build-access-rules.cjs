const fs = require('node:fs');
const path = require('node:path');
const owner = "auth != null && auth.token.email == 'canyone2@naver.com'";
const hasRole = role => `(auth != null && root.child('accountAccess/roles').child(auth.uid).child('role').val() == '${role}' && root.child('accountAccess/roles').child(auth.uid).child('email').val() == auth.token.email)`;
const manager = `auth != null && ((${owner}) || ${hasRole('treasurer')})`;
const matchManager = `auth != null && ((${owner}) || ${hasRole('director')})`;
const self = 'auth != null && auth.uid == $uid';
const publicItems = () => ({ '.read': true, '$id': { '.write': manager } });
const internalId = "newData.isString() && newData.val().beginsWith('m')";
const rules = {
    '.read': false, '.write': false,
    clubData: {
        trans: { '.read': true, '.write': false },
        receipts: { '.read': true, '.write': false },
        members: { '.read': manager, '.write': false },
        transItems: publicItems(), receiptItems: publicItems(), deletedTrans: publicItems(), deletedReceipts: publicItems(),
        members_acc: { '.read': manager, '.write': manager },
        membersPublic: { '.read': true, '.write': manager },
        events: { '.read': true, '.write': manager },
        settings: { '.read': true, '.write': manager, '.validate': "!newData.hasChild('adminPwd')" },
        auditState: { '.read': true, '.write': manager }
    },
    accountingSafety: {
        liveMirror: { '.read': true, transItems: { '$id': { '.write': manager } }, receiptItems: { '$id': { '.write': manager } } },
        archive: {
            '.read': true,
            transItems: { '$id': { '$version': { '.write': manager } } },
            receiptItems: { '$id': { '$version': { '.write': manager } } }
        },
        restorePoints: { '.read': manager, '$pointId': { '.write': manager } },
        meta: { '$key': {
            '.read': `$key != 'changeHistory' || (${manager})`,
            '.write': `(${manager}) && (($key != 'lastRestore' && $key != 'lastImport') || (${owner}))`
        } }
    },
    matchData: {
        '.read': true, '.write': matchManager,
        clubData: {
            members: { '$index': { phone: { '.validate': internalId } } },
            attendanceData: { phones: { '$index': { '.validate': internalId } } }
        },
        rankingData: { tiers: { '$memberId': { '.validate': "$memberId.beginsWith('m')" } } }
    },
    matchPrivate: { '.read': matchManager, '.write': matchManager },
    accountAccess: {
        roles: {
            '.read': owner,
            '$uid': {
                '.read': self, '.write': owner,
                '.validate': "newData.hasChildren(['role','email','name','grantedAt','grantedBy'])",
                role: { '.validate': "newData.val() == 'treasurer' || newData.val() == 'director' || newData.val() == 'revoked'" },
                email: { '.validate': 'newData.isString() && newData.val().length <= 254' },
                name: { '.validate': 'newData.isString() && newData.val().length > 0 && newData.val().length <= 80' },
                grantedAt: { '.validate': 'newData.isNumber() && newData.val() <= now' },
                grantedBy: { '.validate': 'newData.val() == auth.uid' },
                '$other': { '.validate': false }
            }
        },
        requests: {
            '.read': owner,
            '$uid': {
                '.read': self,
                '.write': `(${owner}) || ((${self}) && (!data.exists() || data.child('status').val() == 'pending' || data.child('status').val() == 'rejected' || data.child('status').val() == 'revoked') && newData.child('status').val() == 'pending' && newData.child('email').val() == auth.token.email && !newData.hasChild('reviewedAt') && !newData.hasChild('reviewedBy'))`,
                '.validate': "newData.hasChildren(['uid','email','name','status','requestedAt']) && newData.child('uid').val() == $uid",
                uid: { '.validate': 'newData.val() == $uid' },
                email: { '.validate': 'newData.isString() && newData.val().length <= 254' },
                name: { '.validate': 'newData.isString() && newData.val().length > 0 && newData.val().length <= 80' },
                status: { '.validate': "newData.val() == 'pending' || newData.val() == 'approved' || newData.val() == 'rejected' || newData.val() == 'revoked'" },
                requestedRole: { '.validate': "newData.val() == 'treasurer' || newData.val() == 'director'" },
                requestedAt: { '.validate': 'newData.isNumber() && newData.val() > 0 && newData.val() <= now' },
                reviewedAt: { '.validate': `(${owner}) && newData.isNumber() && newData.val() <= now` },
                reviewedBy: { '.validate': `(${owner}) && newData.val() == auth.uid` },
                '$other': { '.validate': false }
            }
        }
    }
};
fs.writeFileSync(path.join(__dirname, '..', 'database.rules.json'), JSON.stringify({ rules }, null, 2) + '\n');
console.log('Generated role-based database.rules.json');
