// 공개 경로에 저장해도 되는 회원 정보만 남기는 변환 함수 모음입니다.
const PHONE_VALUE = /^0\d{1,2}[-\s.]?\d{3,4}[-\s.]?\d{4}$/;
const PHONE_INSIDE = /(?<!\d)01\d[-\s.]?\d{3,4}[-\s.]?\d{4}(?!\d)/;

function digitsOf(value) {
    return String(value).replace(/\D/g, '');
}

export function isPhoneValue(value) {
    return typeof value === 'string' && PHONE_VALUE.test(value.trim());
}

export function createMemberId() {
    const bytes = crypto.getRandomValues(new Uint8Array(9));
    return 'm_' + Array.from(bytes, byte => byte.toString(16).padStart(2, '0')).join('');
}

export function toPublicAccountMember(member) {
    const result = {};
    for (const key of ['id', 'name', 'status', 'role', 'joinDate', 'paid']) {
        if (member?.[key] !== undefined && member[key] !== null) result[key] = member[key];
    }
    // 달력의 생일 표시는 월·일만 사용하므로 출생연도는 공개하지 않습니다.
    if (typeof member?.birthday === 'string' && member.birthday.length >= 10) result.birthday = '0000' + member.birthday.slice(4);
    return result;
}

export function toPublicAccountMembers(members) {
    return (Array.isArray(members) ? members : Object.values(members || {})).filter(Boolean).map(toPublicAccountMember);
}

// tree 안의 전화번호를 내부 ID로 바꾸고, 공개하지 않을 회원 정보는 privateMembers로 분리합니다.
export function privatizeMatchTree(tree, membersPath, { newId = createMemberId, existing = {} } = {}) {
    const idsByPhone = new Map();
    const privateMembers = { ...existing };
    const idFor = phone => {
        const digits = digitsOf(phone);
        if (!idsByPhone.has(digits)) {
            const id = newId();
            idsByPhone.set(digits, id);
            privateMembers[id] = { phone: String(phone).trim() };
        }
        return idsByPhone.get(digits);
    };
    const walk = value => {
        if (Array.isArray(value)) return value.map(walk);
        if (value && typeof value === 'object') {
            return Object.fromEntries(Object.entries(value).map(([key, item]) => [isPhoneValue(key) ? idFor(key) : key, walk(item)]));
        }
        return isPhoneValue(value) ? idFor(value) : value;
    };
    const result = walk(tree);
    const members = membersPath.reduce((node, key) => node?.[key], result);
    for (const member of Array.isArray(members) ? members : Object.values(members || {})) {
        if (!member?.phone) continue;
        const record = privateMembers[member.phone] ||= {};
        for (const key of ['paid', 'spouse', 'role']) {
            if (member[key] !== undefined) record[key] = member[key];
            delete member[key];
        }
    }
    return { tree: result, privateMembers };
}

// 값 자체는 돌려주지 않고 전화번호가 남은 위치만 알려줍니다.
export function findPhoneLikePaths(value, path = '') {
    if (Array.isArray(value) || (value && typeof value === 'object')) {
        return Object.entries(value).flatMap(([key, item]) => [
            ...(PHONE_INSIDE.test(key) ? [`${path}/${key.replace(/\d/g, '*')}`] : []),
            ...findPhoneLikePaths(item, `${path}/${PHONE_INSIDE.test(key) ? '(key)' : key}`)
        ]);
    }
    return typeof value === 'string' && PHONE_INSIDE.test(value) ? [path] : [];
}
