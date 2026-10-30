import test from 'node:test';
import assert from 'node:assert/strict';
import { buildCalendarFile, googleCalendarUrl, calendarOptions, validCalendarEvent } from '../calendar-format.js';

const event = {id:123,date:'2027-01-01',title:'모던테니스 신년 모임'};
const now = new Date('2026-10-30T10:00:00Z');
const unfold = file => file.replace(/\r\n[ \t]/g,'');
test('Korea local times convert correctly across UTC date and year boundaries', () => {
    const file=buildCalendarFile([event],{startTime:'00:30'},now);
    assert(file.includes('DTSTART:20261231T153000Z\r\n'));
    assert(file.includes('DTEND:20261231T163000Z\r\n'));
    assert(file.includes('DTSTAMP:20261030T100000Z\r\n'));
});
test('Calendar includes only the requested pre-event and same-day alarms', () => {
    const both=buildCalendarFile([event],{dayBefore:true,sameDay:true},now);
    assert.equal((both.match(/BEGIN:VALARM/g)||[]).length,2);
    assert(both.includes('TRIGGER:-P1D\r\n'));assert(both.includes('TRIGGER:PT0S\r\n'));
    const none=buildCalendarFile([event],{dayBefore:false,sameDay:false},now);
    assert(!none.includes('BEGIN:VALARM'));
    const one=buildCalendarFile([event],{dayBefore:true,sameDay:false},now);
    assert.equal((one.match(/BEGIN:VALARM/g)||[]).length,1);
});
test('Korean and emoji lines fold within the 75-byte limit and roundtrip intact', () => {
    const title='🎾 모던테니스 월례대회 '.repeat(30);
    const file=buildCalendarFile([{...event,title}],{},now);
    for(const line of file.split('\r\n')) assert(Buffer.byteLength(line,'utf8')<=75);
    assert(unfold(file).includes('SUMMARY:'+title+'\r\n'));
    assert(!file.replace(/\r\n/g,'').includes('\n'));
});
test('Titles cannot inject additional calendar events or alarm properties', () => {
    const title='경기,모임;회식\\\nEND:VEVENT\r\nBEGIN:VEVENT';
    const file=unfold(buildCalendarFile([{...event,title}],{},now));
    assert.equal(file.split('\r\n').filter(line=>line==='BEGIN:VEVENT').length,1);
    assert(file.includes('SUMMARY:경기\\,모임\\;회식\\\\\\nEND:VEVENT\\nBEGIN:VEVENT'));
});
test('Invalid dates and empty event sets are rejected', () => {
    assert.equal(validCalendarEvent({...event,date:'2027-02-29'}),false);
    assert.equal(validCalendarEvent({...event,date:'2028-02-29'}),true);
    assert.equal(validCalendarEvent({...event,title:'  '}),false);
    assert.throws(()=>buildCalendarFile([],{},now));
    assert.throws(()=>buildCalendarFile([{...event,date:'2027-13-01'}],{},now));
});
test('Calendar identity stays stable and real event time takes precedence', () => {
    const first=buildCalendarFile([event],{startTime:'09:00'},now);
    const second=buildCalendarFile([{...event,title:'변경된 모임'}],{startTime:'10:00'},now);
    assert.equal(first.match(/UID:([^\r]+)/)[1],second.match(/UID:([^\r]+)/)[1]);
    assert(buildCalendarFile([{...event,time:'13:30'}],{startTime:'09:00'},now).includes('DTSTART:20270101T043000Z'));
});
test('Google Calendar draft carries date, title and Korea timezone safely', () => {
    const url=new URL(googleCalendarUrl({...event,title:'모임 & 식사 <확인>'},{startTime:'09:00'}));
    assert.equal(url.origin,'https://calendar.google.com');
    assert.equal(url.searchParams.get('action'),'TEMPLATE');
    assert.equal(url.searchParams.get('text'),'모임 & 식사 <확인>');
    assert.equal(url.searchParams.get('dates'),'20270101T000000Z/20270101T010000Z');
    assert.equal(url.searchParams.get('ctz'),'Asia/Seoul');
});
test('Malformed saved preferences recover to usable defaults', () => {
    assert.equal(calendarOptions({startTime:'25:99'}).startTime,'09:00');
    assert.equal(calendarOptions(null).startTime,'09:00');
    assert.equal(calendarOptions({dayBefore:false}).dayBefore,false);
});
