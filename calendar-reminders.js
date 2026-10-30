import { APP_CALENDAR_URL, calendarOptions, validCalendarEvent, buildCalendarFile, googleCalendarUrl } from './calendar-format.js?v=20261030_01';

export function installCalendarReminders({ getEvents }) {
    const key = 'modernCalendarReminderPreferencesV1';
    let options;
    try { options = calendarOptions(JSON.parse(localStorage.getItem(key) || '{}')); } catch { options = calendarOptions(); }
    const dialog = document.createElement('dialog');
    dialog.id = 'calendarReminderDialog';
    dialog.className = 'account-dialog calendar-reminder-dialog';
    dialog.setAttribute('aria-labelledby', 'calendarReminderTitle');
    dialog.innerHTML = `
        <div class="dialog-heading"><div><div class="dialog-eyebrow">CALENDAR REMINDERS</div><h2 id="calendarReminderTitle">휴대폰 일정 알림</h2></div><button type="button" class="dialog-close" id="closeCalendarReminder" aria-label="일정 알림 창 닫기">×</button></div>
        <p class="settings-description">일정을 휴대폰 캘린더에 저장해 알림을 받으세요. 앱을 닫아도 휴대폰 캘린더에서 알려줍니다.</p>
        <div id="calendarReminderMessage" class="access-message" role="status" aria-live="polite" hidden></div>
        <label for="calendarEventSelect">저장할 일정</label><select id="calendarEventSelect"></select>
        <div class="calendar-reminder-fields"><label for="calendarDefaultTime">시간이 없는 일정의 시작 시각</label><input id="calendarDefaultTime" type="time" required><p class="settings-description">한국 시간 기준 · 일정 길이는 1시간으로 추가됩니다. 실제 시작·종료 시각은 휴대폰에서 수정할 수 있습니다.</p></div>
        <div class="request-status-card"><div class="settings-heading">캘린더 파일에 넣을 알림</div>
            <label class="calendar-reminder-check"><input id="calendarAlarmDayBefore" type="checkbox">전날 · 일정 시작 24시간 전</label>
            <label class="calendar-reminder-check"><input id="calendarAlarmSameDay" type="checkbox">당일 · 일정 시작 시각</label>
            <p class="settings-description">이 기기에 기본값을 기억합니다. 가져온 뒤 휴대폰 캘린더의 알림도 확인해주세요.</p>
        </div>
        <div class="calendar-reminder-actions"><button class="btn-main" type="button" id="downloadCalendarEvent">선택 일정 파일 저장</button><a class="btn-sub" id="addToGoogleCalendar" target="_blank" rel="noopener noreferrer">구글 캘린더에 추가 ↗</a><button class="btn-sub" type="button" id="downloadUpcomingCalendar">다가오는 일정 한꺼번에 저장</button></div>
        <p class="settings-description calendar-reminder-note">구글 캘린더로 열 때는 저장 화면에서 알림을 직접 선택해주세요. 캘린더 파일(.ics)은 다운로드 후 지원하는 휴대폰 캘린더로 열거나, PC의 구글 캘린더에서 가져올 수 있습니다.</p>
        <p class="settings-description calendar-reminder-note">저장한 일정은 앱과 자동 동기화되지 않습니다. 일정 변경·삭제 시 휴대폰 캘린더에서도 수정해주세요. 같은 일정을 다시 가져오면 중복될 수 있습니다. 휴대폰 설정에서 사용하는 캘린더 앱의 알림을 허용해주세요.</p>`;
    document.body.append(dialog);
    const el = id => document.getElementById(id);
    const message = (text, error = false) => { el('calendarReminderMessage').hidden = false; el('calendarReminderMessage').textContent = text; el('calendarReminderMessage').classList.toggle('error', error); };
    const events = () => (getEvents() || []).filter(validCalendarEvent).slice().sort((a, b) => a.date.localeCompare(b.date));
    const today = () => new Intl.DateTimeFormat('sv-SE', {timeZone:'Asia/Seoul',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date());
    let selectedEvents = [];
    const selected = () => {
        const previous = selectedEvents[Number(el('calendarEventSelect').value)];
        return previous && events().find(event => String(event.id) === String(previous.id) && event.date === previous.date && event.title === previous.title);
    };
    function readOptions() {
        if (!el('calendarDefaultTime').checkValidity() || !el('calendarDefaultTime').value) throw new Error('일정 시작 시각을 선택해주세요.');
        options = calendarOptions({startTime:el('calendarDefaultTime').value,dayBefore:el('calendarAlarmDayBefore').checked,sameDay:el('calendarAlarmSameDay').checked});
        try { localStorage.setItem(key, JSON.stringify(options)); } catch { message('이 브라우저에서는 기본값을 기억할 수 없습니다. 일정 파일은 계속 저장할 수 있습니다.', true); }
        return options;
    }
    function updateLink() {
        const event = selected();
        el('downloadCalendarEvent').disabled = !event;
        el('downloadUpcomingCalendar').disabled = !events().some(event => event.date >= today());
        const link = el('addToGoogleCalendar');
        link.hidden = !event;
        if (event) link.href = googleCalendarUrl(event, options);
    }
    function saveFile(items, filename) {
        readOptions();
        const file = new Blob([buildCalendarFile(items, options)], {type:'text/calendar;charset=utf-8'});
        const url = URL.createObjectURL(file);
        const link = document.createElement('a'); link.href = url; link.download = filename;
        document.body.append(link); link.click(); link.remove();
        setTimeout(() => URL.revokeObjectURL(url), 60000);
        message('캘린더 파일을 준비했습니다. 다운로드한 파일을 캘린더로 가져온 뒤 일정과 알림을 확인해주세요.');
    }
    window.openCalendarReminders = (eventId) => {
        window.closeAccountPopups?.();
        el('calendarReminderMessage').hidden = true;
        selectedEvents = events();
        const list = el('calendarEventSelect'); list.replaceChildren();
        selectedEvents.forEach((event, index) => {
            const option = document.createElement('option'); option.value = String(index); option.textContent = `${event.date} · ${event.title}`; list.append(option);
        });
        if(!selectedEvents.length) { const option = document.createElement('option'); option.textContent = '등록된 일정이 없습니다.'; option.value = ''; list.append(option); }
        const preferred = eventId === undefined ? selectedEvents.findIndex(event => event.date >= today()) : selectedEvents.findIndex(event => String(event.id) === String(eventId));
        list.value = String(Math.max(0, preferred));
        el('calendarDefaultTime').value = options.startTime; el('calendarAlarmDayBefore').checked = options.dayBefore; el('calendarAlarmSameDay').checked = options.sameDay;
        updateLink();
        if (!dialog.open) dialog.showModal();
        document.documentElement.classList.add('calendar-dialog-open');
    };
    el('closeCalendarReminder').addEventListener('click', () => dialog.close());
    dialog.addEventListener('close', () => document.documentElement.classList.remove('calendar-dialog-open'));
    dialog.addEventListener('click', event => {
        if(event.target !== dialog) return;
        const rect = dialog.getBoundingClientRect();
        if(event.clientX < rect.left || event.clientX > rect.right || event.clientY < rect.top || event.clientY > rect.bottom) dialog.close();
    });
    el('calendarEventSelect').addEventListener('change', updateLink);
    for (const id of ['calendarDefaultTime','calendarAlarmDayBefore','calendarAlarmSameDay']) el(id).addEventListener('change', () => { try {readOptions(); updateLink();} catch(error) {message(error.message, true);} });
    el('downloadCalendarEvent').addEventListener('click', () => {
        try { const event = selected(); if(!event) throw new Error('일정이 변경되었습니다. 창을 다시 열어 선택해주세요.'); saveFile([event], `modern-tennis-${event.date}.ics`); } catch(error) {message(error.message,true);}
    });
    el('downloadUpcomingCalendar').addEventListener('click', () => {
        try { saveFile(events().filter(event => event.date >= today()), `modern-tennis-upcoming-${today()}.ics`); } catch(error) {message(error.message,true);}
    });
    el('addToGoogleCalendar').addEventListener('click', event => {
        try { const chosen = selected(); if(!chosen) throw new Error('일정이 변경되었습니다. 다시 선택해주세요.'); readOptions(); event.currentTarget.href = googleCalendarUrl(chosen,options); } catch(error) {event.preventDefault();message(error.message,true);}
    });
    return { dialog, appUrl: APP_CALENDAR_URL };
}
