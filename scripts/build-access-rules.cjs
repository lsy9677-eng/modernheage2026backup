const fs = require('node:fs');
const path = require('node:path');
const owner = "auth != null && auth.token.email == 'canyone2@naver.com'";
const manager = `auth != null && ((${owner}) || (auth.token.email_verified == true && root.child('accountAccess/roles').child(auth.uid).child('role').val() == 'treasurer' && root.child('accountAccess/roles').child(auth.uid).child('email').val() == auth.token.email))`;
const self = 'auth != null && auth.uid == $uid';
const perItem = () => ({ '$id': { '.write': manager } });
const rules = {
    '.read': false, '.write': false,
    clubData: {
        '.read': true,
        trans: { '.write': false }, receipts: { '.write': false }, members: { '.write': false },
        transItems: perItem(), receiptItems: perItem(), deletedTrans: perItem(), deletedReceipts: perItem(),
        members_acc: { '.write': manager }, events: { '.write': manager },
        settings: { '.write': manager, '.validate': "!newData.hasChild('adminPwd')" },
        auditState: { '.write': manager }
    },
    accountingSafety: {
        '.read': true,
        liveMirror: { transItems: perItem(), receiptItems: perItem() },
        archive: {
            transItems: { '$id': { '$version': { '.write': manager } } },
            receiptItems: { '$id': { '$version': { '.write': manager } } }
        },
        restorePoints: { '$pointId': { '.write': manager } },
        meta: { '$key': { '.write': `(${manager}) && (($key != 'lastRestore' && $key != 'lastImport') || (${owner}))` } }
    },
    accountAccess: {
        roles: {
            '.read': owner,
            '$uid': {
                '.read': self, '.write': owner,
                '.validate': "newData.hasChildren(['role','email','name','grantedAt','grantedBy']) && newData.child('role').val() == 'treasurer' && newData.child('email').val() == root.child('accountAccess/requests').child($uid).child('email').val() && newData.child('grantedBy').val() == auth.uid",
                role: { '.validate': "newData.val() == 'treasurer'" },
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
                '.write': `(${owner}) || ((${self}) && auth.token.email_verified == true && (!data.exists() || data.child('status').val() == 'rejected' || data.child('status').val() == 'revoked') && newData.child('status').val() == 'pending' && newData.child('email').val() == auth.token.email && !newData.hasChild('reviewedAt') && !newData.hasChild('reviewedBy'))`,
                '.validate': "newData.hasChildren(['uid','email','name','status','requestedAt']) && newData.child('uid').val() == $uid",
                uid: { '.validate': 'newData.val() == $uid' },
                email: { '.validate': `newData.isString() && newData.val().length <= 254 && ((${owner}) || newData.val() == auth.token.email)` },
                name: { '.validate': 'newData.isString() && newData.val().length > 0 && newData.val().length <= 80' },
                status: { '.validate': "newData.val() == 'pending' || newData.val() == 'approved' || newData.val() == 'rejected' || newData.val() == 'revoked'" },
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
