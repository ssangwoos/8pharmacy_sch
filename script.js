// script.js (전체 코드 - 2025-05-29 최종 수정본 v2)

// 중요!! 본인의 Apps Script 웹 앱 URL로 반드시 교체하세요.
const APPS_SCRIPT_WEB_APP_URL = 'https://script.google.com/macros/s/AKfycbz5nGNr7MpKYnV3l_sh6kzOn4g7GFPtiHATpymBcaZjteUIWxdxeV6xzcvyfOq0Exq0/exec'; 

document.addEventListener('DOMContentLoaded', () => {
  // DOM 요소 가져오기
  const calendarEl = document.getElementById('calendar');
  const currentMonthYearEl = document.getElementById('currentMonthYear');
  const prevMonthBtn = document.getElementById('prevMonthBtn');
  const nextMonthBtn = document.getElementById('nextMonthBtn');
  const loaderEl = document.getElementById('loader');
  const statusMessageEl = document.getElementById('statusMessage');

  // 근무 입력 모달 관련 요소
  const modal = document.getElementById('workRecordModal');
  const closeModalBtn = document.getElementById('closeModalBtn');
  const workRecordForm = document.getElementById('workRecordForm');
  const recordDateEl = document.getElementById('recordDate');
  const staffNameEl = document.getElementById('staffName'); 
  const workTypeEl = document.getElementById('workType'); 
  const timeFieldsEl = document.getElementById('timeFields');
  const startHourEl = document.getElementById('startHour');
  const startMinuteEl = document.getElementById('startMinute');
  const endHourEl = document.getElementById('endHour');
  const endMinuteEl = document.getElementById('endMinute');
  const notesEl = document.getElementById('notes');
  const modalTitle = document.getElementById('modalTitle');
  const repeatOnWeekdayCheckbox = document.getElementById('repeatOnWeekday');
  const saveRecordBtn = document.getElementById('saveRecordBtn');

  // 직원 명단 및 강조 기능 관련 요소
  const staffListUlEl = document.getElementById('staffListUl');
  let highlightedStaffName = null;

  // 통계 모달 관련 DOM 요소
  const statsButton = document.getElementById('statsButton');
  const statsModal = document.getElementById('statsModal');
  const closeStatsModalBtn = document.getElementById('closeStatsModalBtn');
  const statsStaffSelect = document.getElementById('statsStaffSelect'); 
  const statsTableContainer = document.getElementById('statsTableContainer');
  const statsSummaryContainer = document.getElementById('statsSummaryContainer');
  const statsMonthYearLabel = document.getElementById('statsMonthYearLabel');

  // 전역 변수
  let staffListCache = []; 
  let currentDisplayedDate = new Date();
  let allRecordsForCurrentMonth = []; 
  let currentMonthHolidays = []; 
  let currentEditingRecordOriginalKey = null; 

  // --- 달력 표시 기준 시간 및 설정 ---
  const TIMELINE_START_HOUR = 9;
  const TIMELINE_END_HOUR = 22;
  const TOTAL_TIMELINE_MINUTES = (TIMELINE_END_HOUR - TIMELINE_START_HOUR) * 60;
  const MAX_STAFF_PER_DAY_DISPLAY = 5; 
  const TRACK_HEIGHT_WITH_GAP = 20; 
  const MIN_HOURS_FOR_BAR_DISPLAY = 9;
  const WEEKDAYS_KO = ['일', '월', '화', '수', '목', '금', '토'];


  // --- 유틸리티 함수 ---
  function showLoader() { if(loaderEl) loaderEl.style.display = 'block'; }
  function hideLoader() { if(loaderEl) loaderEl.style.display = 'none'; }

  function showStatusMessage(message, isSuccess = true) { 
    if (!statusMessageEl) return;
    statusMessageEl.textContent = message;
    statusMessageEl.className = 'status-message ' + (isSuccess ? 'success' : 'error');
    statusMessageEl.style.display = 'block';
    setTimeout(() => { statusMessageEl.style.display = 'none'; }, 3000);
  }

  function populateHourOptions(selectElement) { 
    if (!selectElement) return; selectElement.innerHTML = '';
    for (let i = 0; i < 24; i++) { const option = document.createElement('option'); option.value = String(i).padStart(2, '0'); option.textContent = String(i).padStart(2, '0'); selectElement.appendChild(option); }
  }

  function populateMinuteOptions(selectElement) { 
    if (!selectElement) return; selectElement.innerHTML = '';
    const minutes = [0, 10, 20, 30, 40, 50];
    minutes.forEach(m => { const option = document.createElement('option'); option.value = String(m).padStart(2, '0'); option.textContent = String(m).padStart(2, '0'); selectElement.appendChild(option); });
  }
  
  function getContrastYIQ(hexcolor){ 
    if (!hexcolor || typeof hexcolor !== 'string' || hexcolor.length < 6) return '#000000'; hexcolor = hexcolor.replace("#", ""); if (hexcolor.length === 3) hexcolor = hexcolor.split('').map(char => char + char).join(''); if (hexcolor.length !== 6) return '#000000'; const r = parseInt(hexcolor.substr(0,2),16); const g = parseInt(hexcolor.substr(2,2),16); const b = parseInt(hexcolor.substr(4,2),16); const yiq = ((r*299)+(g*587)+(b*114))/1000; return (yiq >= 128) ? '#000000' : '#FFFFFF';
  }
  
  // --- API 호출 ---
  async function fetchStaffNames() { 
    showLoader(); 
    try { 
      console.log("[fetchStaffNames] Fetching staff info..."); 
      const response = await fetch(`${APPS_SCRIPT_WEB_APP_URL}?action=getStaffInfo`); 
      console.log("[fetchStaffNames] Response status:", response.status, response.ok); 
      if (!response.ok) throw new Error(`[${response.status}] ${response.statusText}`); 
      const result = await response.json(); 
      console.log("[fetchStaffNames] Parsed JSON:", result); 
      if (!result.success) throw new Error(result.error || 'Failed to load staff info from API.'); 
      staffListCache = result.data || []; 
      populateStaffList(); 
      if (staffNameEl) { 
        staffNameEl.innerHTML = '<option value="">선택하세요</option>'; 
        staffListCache.forEach(s => { 
          const option = document.createElement('option'); option.value = s.name; option.textContent = s.name; staffNameEl.appendChild(option); 
        }); 
      } 
    } catch (error) { 
      console.error('Error fetching staff names:', error.message, error.stack); 
      showStatusMessage('직원 목록 로딩 실패: ' + error.message, false); 
    } finally { 
      console.log("[fetchStaffNames] Fetch process finished."); 
      hideLoader(); 
    }
  }
  
  // --- 직원 명단 관련 ---
  function populateStaffList() { 
    if (!staffListUlEl) return; staffListUlEl.innerHTML = ''; if (!staffListCache || staffListCache.length === 0) return;
    staffListCache.forEach(staff => { const li = document.createElement('li'); li.textContent = staff.name; li.style.backgroundColor = staff.color || '#A0A0A0'; li.style.color = getContrastYIQ(staff.color || '#A0A0A0'); li.dataset.staffName = staff.name; li.addEventListener('click', handleStaffListClick); staffListUlEl.appendChild(li); });
  }
  function handleStaffListClick(event) { 
    const clickedStaffName = event.target.dataset.staffName; 
    const currentActiveLi = staffListUlEl.querySelector('.active-highlight'); if (currentActiveLi) currentActiveLi.classList.remove('active-highlight');
    if (highlightedStaffName === clickedStaffName) highlightedStaffName = null; else { highlightedStaffName = clickedStaffName; event.target.classList.add('active-highlight');}
    applyCalendarHighlight();
  }
  function applyCalendarHighlight() { 
    if (!calendarEl) return; const allEntries = calendarEl.querySelectorAll('.work-entry');
    allEntries.forEach(entryEl => { const entryTitle = entryEl.title || ""; const entryStaffNameMatch = entryTitle.match(/^([^|]+)\|/); const entryStaffName = entryStaffNameMatch ? entryStaffNameMatch[1].trim() : null; if (highlightedStaffName) { if (entryStaffName && entryStaffName === highlightedStaffName) { entryEl.classList.add('highlighted'); entryEl.classList.remove('dimmed'); } else { entryEl.classList.add('dimmed'); entryEl.classList.remove('highlighted'); } } else { entryEl.classList.remove('highlighted'); entryEl.classList.remove('dimmed'); } });
  }

  // --- 휴일 토글 함수 ---
  function toggleHoliday(dateStr, dayNumberElement) { 
    const holidayIndex = currentMonthHolidays.indexOf(dateStr); const dateObj = new Date(dateStr + "T00:00:00"); const isSunday = dateObj.getDay() === 0;
    if (holidayIndex > -1) { currentMonthHolidays.splice(holidayIndex, 1); dayNumberElement.classList.remove('holiday-date-number'); if (isSunday) dayNumberElement.classList.add('sunday-date-number'); } else { currentMonthHolidays.push(dateStr); dayNumberElement.classList.add('holiday-date-number'); if (isSunday) dayNumberElement.classList.remove('sunday-date-number'); }
  }

  // --- 달력 렌더링 ---
  async function renderCalendar(year, month) { 
    showLoader(); if (!calendarEl || !currentMonthYearEl) { console.error("Calendar elements not found!"); hideLoader(); return; } calendarEl.innerHTML = ''; currentMonthYearEl.textContent = `${year}년 ${month}월`; console.log(`[renderCalendar] 시작: ${year}년 ${month}월`); 
    WEEKDAYS_KO.forEach((day, index) => { const dayHeader = document.createElement('div'); dayHeader.classList.add('calendar-header'); dayHeader.textContent = day; if (index === 0) dayHeader.classList.add('sunday'); if (index === 6) dayHeader.classList.add('saturday'); calendarEl.appendChild(dayHeader); }); 
    const firstDayOfMonth = new Date(year, month - 1, 1); const lastDayOfMonth = new Date(year, month, 0); const daysInMonth = lastDayOfMonth.getDate(); const startDayOfWeek = firstDayOfMonth.getDay(); 
    for (let i = 0; i < startDayOfWeek; i++) { const emptyCell = document.createElement('div'); emptyCell.classList.add('calendar-day', 'other-month'); calendarEl.appendChild(emptyCell); } 
    for (let day = 1; day <= daysInMonth; day++) { const dayCell = document.createElement('div'); dayCell.classList.add('calendar-day'); const currentDateObj = new Date(year, month - 1, day); const dateStr = `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`; const dayNumberEl = document.createElement('span'); dayNumberEl.classList.add('day-number'); dayNumberEl.textContent = day; if (currentMonthHolidays.includes(dateStr)) dayNumberEl.classList.add('holiday-date-number'); dayNumberEl.addEventListener('click', (event) => { event.stopPropagation(); toggleHoliday(dateStr, dayNumberEl); }); dayCell.appendChild(dayNumberEl); const dayOfWeekVal = currentDateObj.getDay(); if (!dayNumberEl.classList.contains('holiday-date-number')) { if (dayOfWeekVal === 0) dayNumberEl.classList.add('sunday-date-number'); } if (dayOfWeekVal === 6) { if (!dayNumberEl.classList.contains('holiday-date-number')) dayCell.classList.add('saturday'); } const today = new Date(); if (year === today.getFullYear() && (month - 1) === today.getMonth() && day === today.getDate()) { dayCell.classList.add('today'); if (!dayNumberEl.classList.contains('holiday-date-number')) dayNumberEl.classList.add('today-number'); } const entriesContainer = document.createElement('div'); entriesContainer.classList.add('work-entries-container'); dayCell.appendChild(entriesContainer); dayCell.dataset.date = dateStr; dayCell.addEventListener('click', (event) => { if (event.target !== dayNumberEl && !dayNumberEl.contains(event.target)) openModalForDate(dateStr); }); calendarEl.appendChild(dayCell); } 
    try { console.log(`[renderCalendar] 근무 기록 가져오기 시작: ${year}-${month}`); const response = await fetch(`${APPS_SCRIPT_WEB_APP_URL}?action=getWorkRecords&year=${year}&month=${month}`); console.log('[renderCalendar] Fetch 응답 상태:', response.status, response.ok); if (!response.ok) { const errorText = await response.text(); console.error('[renderCalendar] Fetch 실패. 상태:', response.status, '응답 내용:', errorText); throw new Error(`[${response.status}] ${response.statusText}. 서버 상세: ${errorText}`); } const result = await response.json(); console.log('[renderCalendar] 파싱된 JSON 결과 (구조):', {success: result.success, dataLength: result.data ? result.data.length : 'N/A', error: result.error, details: result.details, debug_info_length: result.debug_info ? result.debug_info.length : 'N/A' }); if (result.debug_info && result.debug_info.length > 0) { console.warn("[renderCalendar] 서버 DEBUG INFO:"); result.debug_info.forEach(d => { console.warn(`  Row ${d.rowNum}: Raw='${d.rawDateCell}', Type=${d.type}, IsDateObj=${d.isDateObjViaInstanceof}, Parsed=${d.parsed}, SheetYM='${d.sheetYM}', TargetYM='${d.targetYM}', Match=${d.match}, finalDateForClient='${d.finalDateForClient}'`); });} if (!result.success) { console.error('[renderCalendar] API 응답 success:false. 오류:', result.error, '상세:', result.details); throw new Error(result.error || 'API로부터 근무 기록 로딩 실패.'); } allRecordsForCurrentMonth = result.data || []; console.log(`[renderCalendar] 이번 달 기록 (${allRecordsForCurrentMonth.length}개) 처리 시작.`); displayWorkRecords(allRecordsForCurrentMonth); applyCalendarHighlight(); console.log('[renderCalendar] 달력 표시 및 하이라이트 적용 완료.'); } catch (error) { console.error('[renderCalendar] CATCH 블록. 근무 기록 가져오기/처리 중 오류:', error.message, error.stack); allRecordsForCurrentMonth = []; showStatusMessage('근무 기록 로딩 실패: ' + error.message, false); } finally { console.log('[renderCalendar] Fetch 과정 종료, 로더 숨김.'); hideLoader(); }
  }
  
  // displayWorkRecords 함수 (막대 최소 길이 보장 및 삭제 버튼 추가)
  function displayWorkRecords(records) {
    if (!Array.isArray(records)) { console.warn("[displayWorkRecords] records는 배열이 아님.", records); return; }
    const recordsByDate = {};
    records.forEach(record => { if (record && typeof record.date === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(record.date.substring(0,10))) { const validDateStr = record.date.substring(0,10); (recordsByDate[validDateStr] = recordsByDate[validDateStr] || []).push(record); } else { /* console.warn("[displayWorkRecords] 유효하지 않은 날짜 형식 기록 건너뜀:", record); */ } });
    if (calendarEl) { const allEntriesContainers = calendarEl.querySelectorAll('.work-entries-container'); allEntriesContainers.forEach(container => container.innerHTML = ''); }
    Object.keys(recordsByDate).forEach(dateStr => {
      const dayRecords = recordsByDate[dateStr];
      const selector = `.calendar-day[data-date="${dateStr}"] .work-entries-container`;
      const dayCellContentContainer = calendarEl ? calendarEl.querySelector(selector) : null;
      if (!dayCellContentContainer) return; 
      const staffToTrackMap = new Map(); let nextAvailableTrack = 0;
      dayRecords.sort((a,b) => { if (a.workType === "휴가" && b.workType !== "휴가") return 1; if (a.workType !== "휴가" && b.workType === "휴가") return -1; const startTimeCompare = (a.startTime || "99:99").localeCompare(b.startTime || "99:99"); if (startTimeCompare !== 0) return startTimeCompare; return (a.name || "").localeCompare(b.name || ""); });
      dayRecords.forEach(record => {
        if (nextAvailableTrack >= MAX_STAFF_PER_DAY_DISPLAY && !staffToTrackMap.has(record.name)) return;
        const staffMember = staffListCache.find(s => s.name === record.name); const staffColor = staffMember ? (staffMember.color || '#A0A0A0') : '#A0A0A0';
        const entryEl = document.createElement('div'); entryEl.classList.add('work-entry'); entryEl.style.backgroundColor = staffColor;
        const recordIdentifier = { date: record.date, name: record.name, workType: record.workType, startTime: record.startTime || "" };
        entryEl.dataset.recordIdentifier = JSON.stringify(recordIdentifier); entryEl.dataset.recordData = JSON.stringify(record);
        entryEl.title = `${record.name} | ${record.workType}` + (record.startTime && record.workType !== "휴가" ? ` | ${record.startTime}-${record.endTime}` : '') + (record.notes ? ` | 비고: ${record.notes}` : '');
        entryEl.addEventListener('click', (event) => { if (event.target.classList.contains('delete-btn')) return; event.stopPropagation(); openModalForEdit(entryEl); });
        const deleteBtn = document.createElement('span'); deleteBtn.classList.add('delete-btn'); deleteBtn.innerHTML = '&times;'; deleteBtn.title = '이 기록 삭제';
        deleteBtn.addEventListener('click', (event) => { event.stopPropagation(); const identifierString = entryEl.dataset.recordIdentifier; if (confirm("정말로 이 근무 기록을 삭제하시겠습니까?")) handleDeleteRecord(identifierString); });
        let currentTrack;
        if (staffToTrackMap.has(record.name)) currentTrack = staffToTrackMap.get(record.name); else if (nextAvailableTrack < MAX_STAFF_PER_DAY_DISPLAY) { currentTrack = nextAvailableTrack; staffToTrackMap.set(record.name, currentTrack); nextAvailableTrack++; } else return;
        entryEl.style.top = `${currentTrack * TRACK_HEIGHT_WITH_GAP}px`;
        let textContentForBar = "";
        if (record.workType === "휴가") { entryEl.classList.add('vacation'); textContentForBar = `${record.name}: 휴가`; entryEl.textContent = textContentForBar; entryEl.appendChild(deleteBtn); }
        else if (!record.startTime || !record.endTime || TOTAL_TIMELINE_MINUTES <= 0 || !/^\d{2}:\d{2}$/.test(record.startTime) || !/^\d{2}:\d{2}$/.test(record.endTime) ) { textContentForBar = `${record.name}: ${record.workType || '(시간없음)'}`; entryEl.textContent = textContentForBar; entryEl.appendChild(deleteBtn); entryEl.style.position = 'relative'; entryEl.style.width = '100%'; }
        else { 
          const timeToMinutes = (timeStr) => { const [h, m] = timeStr.split(':').map(Number); return h * 60 + m; };
          const actualRecordStartMinutes = timeToMinutes(record.startTime); const actualRecordEndMinutes = timeToMinutes(record.endTime);
          const timelineStartTotalMinutes = TIMELINE_START_HOUR * 60;
          let actualStartOffsetMinutes = actualRecordStartMinutes - timelineStartTotalMinutes;
          let actualDurationMinutes = actualRecordEndMinutes - actualRecordStartMinutes;
          if (actualDurationMinutes < 0 && actualRecordStartMinutes > actualRecordEndMinutes) { /* 자정 넘김 보류 */ } 
          if (actualDurationMinutes < 0) actualDurationMinutes = 0;

          let displayActualStartOffsetMinutes = Math.max(0, actualStartOffsetMinutes);
          let displayActualEndOffsetMinutes = Math.min(TOTAL_TIMELINE_MINUTES, actualStartOffsetMinutes + actualDurationMinutes);
          let displayActualDurationMinutes = Math.max(0, displayActualEndOffsetMinutes - displayActualStartOffsetMinutes);

          if (displayActualDurationMinutes <= 0 && actualDurationMinutes > 0) { 
             textContentForBar = `${record.name}: ${record.workType} (시간대 벗어남)`; entryEl.textContent = textContentForBar; entryEl.appendChild(deleteBtn); entryEl.style.position = 'relative'; entryEl.style.width = '100%';
          } else if (displayActualDurationMinutes > 0) {
            const minVisualDurationMinutes = MIN_HOURS_FOR_BAR_DISPLAY * 60;
            let visualDurationMinutes = Math.max(displayActualDurationMinutes, minVisualDurationMinutes);
            let visualStartOffsetMinutes = displayActualEndOffsetMinutes - visualDurationMinutes; // 실제 종료점에서 시각적 길이를 빼서 시작점 결정
            visualStartOffsetMinutes = Math.max(0, visualStartOffsetMinutes); // 타임라인 왼쪽 경계 넘지 않도록
            let visualEndOffsetMinutes = Math.min(TOTAL_TIMELINE_MINUTES, visualStartOffsetMinutes + visualDurationMinutes); // 타임라인 오른쪽 경계 넘지 않도록
            const finalDisplayDurationMinutes = visualEndOffsetMinutes - visualStartOffsetMinutes; // 최종 시각적 길이
            const finalDisplayStartOffsetMinutes = visualStartOffsetMinutes; // 최종 시각적 시작점

            if (finalDisplayDurationMinutes <= 0) {
                textContentForBar = `${record.name}: ${record.workType}`; entryEl.textContent = textContentForBar; entryEl.appendChild(deleteBtn); entryEl.style.position = 'relative'; entryEl.style.width = '100%';
            } else {
                const leftPercentage = (finalDisplayStartOffsetMinutes / TOTAL_TIMELINE_MINUTES) * 100;
                const widthPercentage = (finalDisplayDurationMinutes / TOTAL_TIMELINE_MINUTES) * 100;
                entryEl.style.left = `${Math.max(0, Math.min(100, leftPercentage))}%`;
                entryEl.style.width = `${Math.max(0, Math.min(100 - leftPercentage, widthPercentage))}%`;
                const barWidthPx = (dayCellContentContainer.clientWidth || 100) * (widthPercentage / 100);
                if (barWidthPx < 20) textContentForBar = '&nbsp;'; else if (barWidthPx < 50) textContentForBar = `${record.startTime.substring(0,2)}-${record.endTime.substring(0,2)}`; else textContentForBar = `${record.startTime}-${record.endTime}`; 
                if (textContentForBar === '&nbsp;') entryEl.innerHTML = textContentForBar; else entryEl.textContent = textContentForBar;
                entryEl.appendChild(deleteBtn);
            }
          } else { 
            textContentForBar = `${record.name}: ${record.workType}`; entryEl.textContent = textContentForBar; entryEl.appendChild(deleteBtn); entryEl.style.position = 'relative'; entryEl.style.width = '100%';
          }
        }
        dayCellContentContainer.appendChild(entryEl);
      });
    });
  }

  async function handleDeleteRecord(identifierString) { 
    if (!identifierString) { showStatusMessage("삭제할 기록 정보가 없습니다.", false); return; } showLoader();
    try { const keyObject = JSON.parse(identifierString); const payload = { action: 'deleteWorkRecord', key: keyObject }; console.log("[handleDeleteRecord] 삭제 요청:", payload); const response = await fetch(APPS_SCRIPT_WEB_APP_URL, { method: 'POST', headers: { 'Content-Type': 'text/plain;charset=utf-8' }, body: JSON.stringify(payload) }); console.log("[handleDeleteRecord] 삭제 API 응답 상태:", response.status, response.ok); if (!response.ok) { const errorText = await response.text(); console.error("[handleDeleteRecord] 삭제 API 실패. 상태:", response.status, "응답내용:", errorText); throw new Error(`[${response.status}] ${response.statusText}. 서버 응답: ${errorText}`);} const result = await response.json(); console.log("[handleDeleteRecord] 삭제 API 파싱된 JSON 결과:", result); if (result.success) { showStatusMessage(result.message || "기록이 삭제되었습니다.", true); renderCalendar(currentDisplayedDate.getFullYear(), currentDisplayedDate.getMonth() + 1); } else { throw new Error(result.error || "알 수 없는 오류로 삭제에 실패했습니다."); } } catch (error) { console.error('Error deleting record:', error.message, error.stack); showStatusMessage('삭제 중 오류 발생: ' + error.message, false); } finally { hideLoader(); console.log("[handleDeleteRecord] 삭제 과정 종료."); }
  }

  function openModalForDate(dateStr, existingRecordDataWithIdentifier = null) { 
    if (!workRecordForm || !recordDateEl || !modalTitle || !repeatOnWeekdayCheckbox || !saveRecordBtn || !staffNameEl || !workTypeEl || !startHourEl || !startMinuteEl || !endHourEl || !endMinuteEl || !notesEl) { console.error("필수 모달 요소 중 일부가 없습니다."); return; }
    workRecordForm.reset(); repeatOnWeekdayCheckbox.checked = false; notesEl.value = ""; 
    const repeatLabelElement = document.querySelector('label[for="repeatOnWeekday"]');
    if (existingRecordDataWithIdentifier) { 
      const existingRecord = existingRecordDataWithIdentifier; console.log("[openModalForDate] 수정 모드로 열기:", existingRecord);
      modalTitle.textContent = `${existingRecord.date} 근무 기록 수정`; recordDateEl.value = existingRecord.date; staffNameEl.value = existingRecord.name; workTypeEl.value = existingRecord.workType;
      if (existingRecord.workType !== '휴가' && existingRecord.startTime && /^\d{2}:\d{2}$/.test(existingRecord.startTime)) { const [startH, startM] = existingRecord.startTime.split(':'); startHourEl.value = startH; startMinuteEl.value = startM; } else { startHourEl.value = "00"; startMinuteEl.value = "00"; console.log("[openModalForDate] 수정 모드: 출근시간 없음/형식오류, 00:00으로 설정");}
      if (existingRecord.workType !== '휴가' && existingRecord.endTime && /^\d{2}:\d{2}$/.test(existingRecord.endTime)) { const [endH, endM] = existingRecord.endTime.split(':'); endHourEl.value = endH; endMinuteEl.value = endM; } else { endHourEl.value = "00"; endMinuteEl.value = "00"; console.log("[openModalForDate] 수정 모드: 퇴근시간 없음/형식오류, 00:00으로 설정");}
      notesEl.value = existingRecord.notes || ""; workRecordForm.dataset.mode = "edit"; 
      try { currentEditingRecordOriginalKey = JSON.parse(existingRecord.identifier); } catch(e) { console.error("identifier 파싱 오류:", e); currentEditingRecordOriginalKey = null; }
      saveRecordBtn.textContent = "수정"; if (repeatLabelElement) repeatLabelElement.style.display = 'none'; if(repeatOnWeekdayCheckbox) repeatOnWeekdayCheckbox.style.display = 'none';
    } else { 
      console.log("[openModalForDate] 추가 모드로 열기, 날짜:", dateStr); modalTitle.textContent = `${dateStr} 근무 기록 추가`; recordDateEl.value = dateStr;
      if(staffNameEl) staffNameEl.value = ""; if(workTypeEl) workTypeEl.value = "주간"; if(startHourEl) startHourEl.value = "09"; if(startMinuteEl) startMinuteEl.value = "00"; if(endHourEl) endHourEl.value = "18"; if(endMinuteEl) endMinuteEl.value = "00";
      workRecordForm.dataset.mode = "add"; currentEditingRecordOriginalKey = null; saveRecordBtn.textContent = "저장";
      if (repeatLabelElement) repeatLabelElement.style.display = (workTypeEl && workTypeEl.value === '휴가' ? 'none' : 'flex');
      if (repeatOnWeekdayCheckbox) repeatOnWeekdayCheckbox.style.display = (workTypeEl && workTypeEl.value === '휴가' ? 'none' : 'inline-block');
    }
    toggleTimeFields(); if(modal) modal.style.display = 'block';
  }
  
  function openModalForEdit(entryElement) { 
      const recordDataString = entryElement.dataset.recordData; const recordIdentifierString = entryElement.dataset.recordIdentifier;
      if (recordDataString && recordIdentifierString) { const recordToEdit = JSON.parse(recordDataString); recordToEdit.identifier = recordIdentifierString; openModalForDate(recordToEdit.date, recordToEdit); } 
      else { console.error("수정할 레코드 정보를 찾을 수 없습니다.", entryElement.dataset); showStatusMessage("레코드 정보를 불러오지 못했습니다.", false); }
  }

  if(closeModalBtn) closeModalBtn.onclick = () => { if(modal) modal.style.display = 'none'; };
  window.onclick = (event) => { 
    if (event.target == modal && modal) modal.style.display = 'none';
    if (event.target == statsModal && statsModal) statsModal.style.display = 'none';
  };
  if(workTypeEl) workTypeEl.addEventListener('change', toggleTimeFields);
  
  function toggleTimeFields() { 
    if (!workTypeEl || !timeFieldsEl || !startHourEl || !startMinuteEl || !endHourEl || !endMinuteEl || !repeatOnWeekdayCheckbox) return;
    const isHolidayValue = workTypeEl.value === '휴가'; const currentMode = workRecordForm.dataset.mode;
    timeFieldsEl.style.display = isHolidayValue ? 'none' : 'block';
    startHourEl.disabled = isHolidayValue; startMinuteEl.disabled = isHolidayValue; endHourEl.disabled = isHolidayValue; endMinuteEl.disabled = isHolidayValue;
    const repeatLabelElement = document.querySelector('label[for="repeatOnWeekday"]');
    if (repeatLabelElement) { 
        if (isHolidayValue || currentMode === 'edit') { repeatLabelElement.style.display = 'none'; repeatOnWeekdayCheckbox.checked = false; repeatOnWeekdayCheckbox.style.display = 'none'; } 
        else { repeatLabelElement.style.display = 'flex'; repeatOnWeekdayCheckbox.style.display = 'inline-block'; }
    }
    repeatOnWeekdayCheckbox.disabled = isHolidayValue || currentMode === 'edit';
  }

  if(workRecordForm) workRecordForm.addEventListener('submit', async (e) => { 
    e.preventDefault(); showLoader(); const formMode = workRecordForm.dataset.mode || "add"; 
    const shouldRepeat = (formMode === "add") && repeatOnWeekdayCheckbox.checked;
    const currentRecordData = { date: recordDateEl.value, name: staffNameEl.value, workType: workTypeEl.value, startTime: workTypeEl.value === '휴가' ? '' : `${startHourEl.value}:${startMinuteEl.value}`, endTime: workTypeEl.value === '휴가' ? '' : `${endHourEl.value}:${endMinuteEl.value}`, notes: notesEl.value.trim() };
    if (!currentRecordData.name) { showStatusMessage('이름을 선택해주세요.', false); hideLoader(); return; }
    let actionType = ""; let payload = {};
    if (formMode === "edit") {
        actionType = "updateWorkRecord"; payload = { action: actionType, originalKey: currentEditingRecordOriginalKey, newData: currentRecordData }; 
        console.log("[FormSubmit] 수정할 기록:", payload);
    } else { 
        actionType = "saveWorkRecords"; let recordsToSave = [];
        recordsToSave.push(currentRecordData); // 현재 입력된 날짜의 기록은 항상 포함
        if (shouldRepeat && currentRecordData.workType !== '휴가') {
            const originalDateObj = new Date(currentRecordData.date + "T00:00:00");
            const originalDayOfMonth = originalDateObj.getDate(); const targetDayOfWeek = originalDateObj.getDay();
            const yearValue = currentDisplayedDate.getFullYear(); const monthValue = currentDisplayedDate.getMonth(); // JS month (0-11)
            const daysInMonthValue = new Date(yearValue, monthValue + 1, 0).getDate();
            for (let dayValue = originalDayOfMonth + 1; dayValue <= daysInMonthValue; dayValue++) { 
                const currentDateInLoop = new Date(yearValue, monthValue, dayValue);
                if (currentDateInLoop.getDay() === targetDayOfWeek) {
                    recordsToSave.push({ ...currentRecordData, date: `${yearValue}-${String(monthValue + 1).padStart(2, '0')}-${String(dayValue).padStart(2, '0')}` });
                }
            }
        }
        payload = { action: actionType, records: recordsToSave }; console.log("[FormSubmit] 저장할 기록:", payload);
    }
    try { const response = await fetch(APPS_SCRIPT_WEB_APP_URL, { method: 'POST', headers: {'Content-Type': 'text/plain;charset=utf-8'}, body: JSON.stringify(payload) }); console.log(`[FormSubmit] ${formMode} API 응답 상태:`, response.status, response.ok); if (!response.ok) { const errorText = await response.text(); console.error(`[FormSubmit] ${formMode} API 실패. 상태:`, response.status, "응답내용:", errorText); throw new Error(`[${response.status}] ${response.statusText}. 서버 응답: ${errorText}`); } const result = await response.json(); console.log(`[FormSubmit] ${formMode} API 파싱된 JSON 결과:`, result); if (result.success) { showStatusMessage(result.message || (formMode === "edit" ? "수정되었습니다!" : "저장되었습니다!"), true); if(modal) modal.style.display = 'none'; renderCalendar(currentDisplayedDate.getFullYear(), currentDisplayedDate.getMonth() + 1); } else { console.error(`[FormSubmit] ${formMode} API 결과 success:false. 오류:`, result.error, "상세:", result.details); throw new Error(result.error || `알 수 없는 오류로 ${formMode === "edit" ? "수정" : "저장"}에 실패했습니다.`); } } catch (error) { console.error(`Error ${formMode === "edit" ? "updating" : "saving"} record(s):`, error.message, error.stack); showStatusMessage(`${formMode === "edit" ? "수정" : "저장"} 중 오류 발생: ` + error.message, false); }
    finally { hideLoader(); if(repeatOnWeekdayCheckbox) repeatOnWeekdayCheckbox.checked = false; console.log(`[FormSubmit] ${formMode} 과정 종료.`); }
  });

  if(statsButton) statsButton.addEventListener('click', openStatsModal);
  if(closeStatsModalBtn) closeStatsModalBtn.addEventListener('click', () => { if(statsModal) statsModal.style.display = 'none'; });
  if(statsStaffSelect) statsStaffSelect.addEventListener('change', displayStaffStats);
  async function openStatsModal() { 
    if (staffListCache.length === 0) await fetchStaffNames(); if(!statsStaffSelect || !statsMonthYearLabel || !statsModal) return;
    statsStaffSelect.innerHTML = '<option value="">직원을 선택해주세요</option>'; staffListCache.forEach(staff => { const option = document.createElement('option'); option.value = staff.name; option.textContent = staff.name; statsStaffSelect.appendChild(option); });
    await displayStaffStats(); statsModal.style.display = 'block';
  }
  async function displayStaffStats() { 
    if(!statsTableContainer || !statsSummaryContainer || !statsStaffSelect) return;
    const selectedStaff = statsStaffSelect.value; const year = currentDisplayedDate.getFullYear(); const month = currentDisplayedDate.getMonth() + 1;
    if(statsMonthYearLabel) statsMonthYearLabel.textContent = `${year}년 ${month}월 통계`;
    if (selectedStaff === "") { statsTableContainer.innerHTML = `<p class="stats-placeholder-message">확인하고 싶은 직원 이름을 선택해주세요. ☝️</p>`; statsSummaryContainer.innerHTML = ""; return; }
    let needsServerFetchForStats = true;
    if (allRecordsForCurrentMonth.length > 0 && allRecordsForCurrentMonth[0]) { if (allRecordsForCurrentMonth[0].date && typeof allRecordsForCurrentMonth[0].date === 'string') { try { const firstRecordDateParts = allRecordsForCurrentMonth[0].date.substring(0,10).split('-'); const firstRecordYear = parseInt(firstRecordDateParts[0]); const firstRecordMonth = parseInt(firstRecordDateParts[1]); if (firstRecordYear === year && firstRecordMonth === month) needsServerFetchForStats = false; } catch (e) { console.warn("통계용 캐시 확인 중 날짜 파싱 오류", e); }}}
    if (needsServerFetchForStats) {
        console.log("[displayStaffStats] 통계용 데이터 새로 가져오기..."); showLoader();
        try { const response = await fetch(`${APPS_SCRIPT_WEB_APP_URL}?action=getWorkRecords&year=${year}&month=${month}`); if (!response.ok) throw new Error(`[${response.status}] ${response.statusText}`); const result = await response.json(); if (!result.success) throw new Error(result.error || 'Failed to load work records for stats.'); allRecordsForCurrentMonth = result.data || []; console.log("[displayStaffStats] 통계용 데이터 로드 완료:", allRecordsForCurrentMonth.length, "개"); }
        catch (error) { showStatusMessage("통계용 데이터 로드 실패: " + error.message, false); allRecordsForCurrentMonth = []; } finally { hideLoader(); }
    } else { console.log("[displayStaffStats] 캐시된 월간 데이터 사용:", allRecordsForCurrentMonth.length, "개"); }
    let filteredRecords = allRecordsForCurrentMonth.filter(r => r.name === selectedStaff);
    if (filteredRecords.length === 0) { statsTableContainer.innerHTML = `<p class="stats-placeholder-message">${selectedStaff} 님의 ${year}년 ${month}월 근무 기록이 없습니다.</p>`; statsSummaryContainer.innerHTML = ""; return; }
    filteredRecords.sort((a, b) => (a.date || "").localeCompare(b.date || ""));
    let tableHTML = `<table><thead><tr><th>날짜</th><th>요일</th><th>근무형태</th><th>출근</th><th>퇴근</th><th>근무시간(H)</th><th>비고</th></tr></thead><tbody>`;
    const workTypeSummary = { '주간': 0, '마감': 0 }; let totalMonthHours = 0; 
    filteredRecords.forEach(r => { let dayOfWeek = '-'; if (r.date && typeof r.date === 'string' && /^\d{4}-\d{2}-\d{2}/.test(r.date)) { try { const dateObj = new Date(r.date + "T00:00:00"); if(!isNaN(dateObj.getTime())) dayOfWeek = WEEKDAYS_KO[dateObj.getDay()]; } catch(e) { console.warn("요일 계산 중 날짜 파싱 오류(통계):", r.date, e); }} const hours = parseFloat(r.totalHours) || 0; tableHTML += `<tr><td>${r.date ? r.date.substring(5) : '?'}</td><td class="${dayOfWeek === '토' ? 'saturday-text' : ''} ${dayOfWeek === '일' ? 'sunday-text' : ''}">${dayOfWeek}</td><td>${r.workType||'-'}</td><td>${r.startTime||'-'}</td><td>${r.endTime||'-'}</td><td>${hours > 0 ? hours.toFixed(1) : (r.workType === '휴가' ? '휴가' : '-')}</td><td title="${r.notes||''}" class="notes-cell">${r.notes||''}</td></tr>`; if (workTypeSummary.hasOwnProperty(r.workType)) workTypeSummary[r.workType] += hours; if (r.workType !== '휴가') totalMonthHours += hours; });
    tableHTML += `</tbody></table>`; statsTableContainer.innerHTML = tableHTML;
    let summaryHTML = `<h4>📝 ${selectedStaff}님 근무 형태별 합계:</h4>`; summaryHTML += `<div>- 주간: ${workTypeSummary['주간'].toFixed(1)} 시간</div>`; summaryHTML += `<div>- 마감: ${workTypeSummary['마감'].toFixed(1)} 시간</div>`; summaryHTML += `<div class="total-hours-summary">💵 총 근무시간 (휴가 제외): ${totalMonthHours.toFixed(1)} 시간</div>`; statsSummaryContainer.innerHTML = summaryHTML;
  }

  if(prevMonthBtn) prevMonthBtn.addEventListener('click', () => { 
    currentMonthHolidays = []; currentDisplayedDate.setMonth(currentDisplayedDate.getMonth() - 1); highlightedStaffName = null; 
    if(staffListUlEl){ const currentActiveLi = staffListUlEl.querySelector('.active-highlight'); if (currentActiveLi) currentActiveLi.classList.remove('active-highlight');}
    renderCalendar(currentDisplayedDate.getFullYear(), currentDisplayedDate.getMonth() + 1);
  });
  if(nextMonthBtn) nextMonthBtn.addEventListener('click', () => { 
    currentMonthHolidays = []; currentDisplayedDate.setMonth(currentDisplayedDate.getMonth() + 1); highlightedStaffName = null;
    if(staffListUlEl){ const currentActiveLi = staffListUlEl.querySelector('.active-highlight'); if (currentActiveLi) currentActiveLi.classList.remove('active-highlight');}
    renderCalendar(currentDisplayedDate.getFullYear(), currentDisplayedDate.getMonth() + 1);
  });
  
  async function initializeApp() {
    console.log("앱 초기화 시작...");
    populateHourOptions(startHourEl); populateMinuteOptions(startMinuteEl); 
    populateHourOptions(endHourEl); populateMinuteOptions(endMinuteEl);
    await fetchStaffNames(); 
    renderCalendar(currentDisplayedDate.getFullYear(), currentDisplayedDate.getMonth() + 1); 
    console.log("앱 초기화 완료.");
  }

  // --- 초기화 실행 ---
  initializeApp();
});