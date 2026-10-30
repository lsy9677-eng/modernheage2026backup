const encoder = new TextEncoder();
const DEFAULTS = { startTime: '09:00', dayBefore: true, sameDay: true };
export const APP_CALENDAR_URL = 'https://modern-app.pages.dev/';

export function calendarOptions(value = {}) {
    value = value && typeof value === 'object' ? value : {};
    return {
        startTime: /^([01]\d|2[0-3]):[0-5]\d$/.test(value.startTime || '') ? value.startTime : DEFAULTS.startTime,
        dayBefore: typeof value.dayBefore === 'boolean' ? value.dayBefore : DEFAULTS.dayBefore,
        sameDay: typeof value.sameDay === 'boolean' ? value.sameDay : DEFAULTS.sameDay,
        includeBirthdays: value.includeBirthdays === true,
        birthdayAlerts: value.birthdayAlerts === true,
        birthdayDayBefore: value.birthdayDayBefore === true,
        birthdaySameDay: typeof value.birthdaySameDay === 'boolean' ? value.birthdaySameDay : true
    };
}
export function birthdayCalendarEvents(members, fromDate) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(fromDate || '')) return [];
    const year = Number(fromDate.slice(0,4));
    return (members || []).flatMap((member,index) => {
        if (!member?.name || !/^\d{4}-\d{2}-\d{2}$/.test(member.birthday || '')) return [];
        const monthDay = member.birthday.slice(5);
        for(let nextYear=year;nextYear<=year+8;nextYear++) {
            const date = `${nextYear}-${monthDay}`;
            const event = {id:`birthday-${member.id ?? index}`,date,title:`${member.name}님 생일`,isBirthday:true};
            if (date >= fromDate && validCalendarEvent(event)) return [event];
        }
        return [];
    });
}
export function validCalendarEvent(event) {
    if (!event || typeof event.title !== 'string' || !event.title.trim() || !/^\d{4}-\d{2}-\d{2}$/.test(event.date || '')) return false;
    const parsed = new Date(event.date + 'T00:00:00Z');
    return Number.isFinite(parsed.getTime()) && parsed.toISOString().slice(0, 10) === event.date;
}
function utcStamp(date) { return date.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}Z$/, 'Z'); }
function eventTimes(event, options) {
    if (!validCalendarEvent(event)) throw new Error('날짜와 제목이 있는 일정을 선택해주세요.');
    const time = /^([01]\d|2[0-3]):[0-5]\d$/.test(event.time || '') ? event.time : options.startTime;
    const start = new Date(`${event.date}T${time}:00+09:00`);
    return { start, end: new Date(start.getTime() + 60 * 60 * 1000) };
}
function escapeText(value) { return String(value).replace(/\\/g, '\\\\').replace(/\r\n|\r|\n/g, '\\n').replace(/;/g, '\\;').replace(/,/g, '\\,'); }
// RFC 5545: fold at 75 UTF-8 octets without splitting a multibyte character.
function foldLine(value) {
    const lines = []; let current = '', bytes = 0;
    for (const char of value) {
        const size = encoder.encode(char).length;
        if (bytes + size > 75) { lines.push(current); current = ' '; bytes = 1; }
        current += char; bytes += size;
    }
    lines.push(current); return lines.join('\r\n');
}
export function buildCalendarFile(events, value = {}, now = new Date()) {
    const options = calendarOptions(value);
    if (!events.length) throw new Error('저장할 일정이 없습니다.');
    const lines = ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//Modern Tennis//Calendar//KO', 'CALSCALE:GREGORIAN', 'METHOD:PUBLISH', 'X-WR-CALNAME:모던테니스 일정'];
    if(events.some(event=>event.isBirthday)) lines.push('BEGIN:VTIMEZONE','TZID:Asia/Seoul','BEGIN:STANDARD','DTSTART:19700101T000000','TZOFFSETFROM:+0900','TZOFFSETTO:+0900','TZNAME:KST','END:STANDARD','END:VTIMEZONE');
    for (const event of events) {
        const { start, end } = eventTimes(event, options);
        const id = encodeURIComponent(String(event.id ?? event.title)) + '-' + (event.isBirthday ? event.date.slice(5) : event.date);
        const localStamp = date => new Date(date.getTime()+9*60*60*1000).toISOString().replace(/[-:]/g,'').slice(0,15);
        lines.push('BEGIN:VEVENT', `UID:${id}@modern-app.pages.dev`, `DTSTAMP:${utcStamp(now)}`, event.isBirthday ? `DTSTART;TZID=Asia/Seoul:${localStamp(start)}` : `DTSTART:${utcStamp(start)}`, event.isBirthday ? `DTEND;TZID=Asia/Seoul:${localStamp(end)}` : `DTEND:${utcStamp(end)}`);
        if(event.isBirthday) lines.push('RRULE:FREQ=YEARLY');
        lines.push(`SUMMARY:${escapeText(event.title)}`, `DESCRIPTION:${escapeText('모던테니스 일정\n' + APP_CALENDAR_URL + '\n시작 시각과 알림을 확인한 뒤 저장해주세요. 앱에서 변경한 일정은 자동 반영되지 않습니다.')}`, `URL:${APP_CALENDAR_URL}`);
        const before = event.isBirthday ? options.birthdayAlerts && options.birthdayDayBefore : options.dayBefore;
        const same = event.isBirthday ? options.birthdayAlerts && options.birthdaySameDay : options.sameDay;
        for (const trigger of [...(before ? ['-P1D'] : []), ...(same ? ['PT0S'] : [])]) {
            lines.push('BEGIN:VALARM', 'ACTION:DISPLAY', `DESCRIPTION:${escapeText(event.title)}`, `TRIGGER:${trigger}`, 'END:VALARM');
        }
        lines.push('END:VEVENT');
    }
    lines.push('END:VCALENDAR');
    return lines.map(foldLine).join('\r\n') + '\r\n';
}
export function googleCalendarUrl(event, value = {}) {
    const { start, end } = eventTimes(event, calendarOptions(value));
    const url = new URL('https://calendar.google.com/calendar/render');
    url.search = new URLSearchParams({ action: 'TEMPLATE', text: event.title, dates: `${utcStamp(start)}/${utcStamp(end)}`, ctz: 'Asia/Seoul', details: '모던테니스 일정\n' + APP_CALENDAR_URL + '\n저장 화면에서 알림을 직접 설정해주세요. 앱의 일정 변경은 자동 반영되지 않습니다.' }).toString();
    return url.href;
}
