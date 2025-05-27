
// script.js (전체 코드 - 2025-05-27 모든 기능 포함 최종)

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
  const repeatOnWeekdayCheckbox = document.getElementById('repeatOnWeekday'); // 반복적용 체크박스

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
  let currentMonthHolidays = []; // 현재 달의 휴일 목록 (예: ["2025-05-01", "2025-05-05"])


  // --- 달력 표시 기준 시간 및 설정 ---
  const TIMELINE_START_HOUR = 9;
  const TIMELINE_END_HOUR = 22;
  const TOTAL_TIMELINE_MINUTES = (TIMELINE_END_HOUR - TIMELINE_START_HOUR) * 60;
  const MAX_STAFF_PER_DAY_DISPLAY = 5;
  const TRACK_HEIGHT_WITH_GAP = 20;

  // --- 유틸리티 함수 ---
  function showLoader() { loaderEl.style.display = 'block'; }
  function hideLoader() { loaderEl.style.display = 'none'; }

  function showStatusMessage(message, isSuccess = true) {
    statusMessageEl.textContent = message;
    statusMessageEl.className = 'status-message ' + (isSuccess ? 'success' : 'error');
    statusMessageEl.style.display = 'block';
    setTimeout(() => { statusMessageEl.style.display = 'none'; }, 3000);
  }

  function populateHourOptions(selectElement) {
    selectElement.innerHTML = '';
    for (let i = 0; i < 24; i++) {
      const option = document.createElement('option');
      option.value = String(i).padStart(2, '0');
      option.textContent = String(i).padStart(2, '0');
      selectElement.appendChild(option);
    }
  }

  function populateMinuteOptions(selectElement) {
    selectElement.innerHTML = '';
    const minutes = [0, 10, 20, 30, 40, 50];
    minutes.forEach(m => {
      const option = document.createElement('option');
      option.value = String(m).padStart(2, '0');
      option.textContent = String(m).padStart(2, '0');
      selectElement.appendChild(option);
    });
  }
  
  function getContrastYIQ(hexcolor){
    if (!hexcolor || typeof hexcolor !== 'string' || hexcolor.length < 6) return '#000000';
    hexcolor = hexcolor.replace("#", "");
    if (hexcolor.length === 3) {
        hexcolor = hexcolor.split('').map(char => char + char).join('');
    }
    if (hexcolor.length !== 6) return '#000000';
    const r = parseInt(hexcolor.substr(0,2),16);
    const g = parseInt(hexcolor.substr(2,2),16);
    const b = parseInt(hexcolor.substr(4,2),16);
    const yiq = ((r*299)+(g*587)+(b*114))/1000;
    return (yiq >= 128) ? '#000000' : '#FFFFFF';
  }

  // --- 초기화 ---
  populateHourOptions(startHourEl);
  populateMinuteOptions(startMinuteEl);
  populateHourOptions(endHourEl);
  populateMinuteOptions(endMinuteEl);
  
  // --- 직원 명단 관련 ---
  function populateStaffList() {
    staffListUlEl.innerHTML = '';
    if (!staffListCache || staffListCache.length === 0) return;
    staffListCache.forEach(staff => {
      const li = document.createElement('li');
      li.textContent = staff.name;
      li.style.backgroundColor = staff.color || '#A0A0A0';
      li.style.color = getContrastYIQ(staff.color || '#A0A0A0'); 
      li.dataset.staffName = staff.name;
      li.addEventListener('click', handleStaffListClick);
      staffListUlEl.appendChild(li);
    });
  }

  function handleStaffListClick(event) {
    const clickedStaffName = event.target.dataset.staffName;
    const currentActiveLi = staffListUlEl.querySelector('.active-highlight');
    if (currentActiveLi) {
      currentActiveLi.classList.remove('active-highlight');
    }
    if (highlightedStaffName === clickedStaffName) {
      highlightedStaffName = null;
    } else {
      highlightedStaffName = clickedStaffName;
      event.target.classList.add('active-highlight');
    }
    applyCalendarHighlight();
  }

  function applyCalendarHighlight() {
    const allEntries = calendarEl.querySelectorAll('.work-entry');
    allEntries.forEach(entryEl => {
      const entryTitle = entryEl.title || "";
      const entryStaffNameMatch = entryTitle.match(/^([^|]+)\|/);
      const entryStaffName = entryStaffNameMatch ? entryStaffNameMatch[1].trim() : null;
      if (highlightedStaffName) {
        if (entryStaffName && entryStaffName === highlightedStaffName) {
          entryEl.classList.add('highlighted');
          entryEl.classList.remove('dimmed');
        } else {
          entryEl.classList.add('dimmed');
          entryEl.classList.remove('highlighted');
        }
      } else {
        entryEl.classList.remove('highlighted');
        entryEl.classList.remove('dimmed');
      }
    });
  }

  // --- API 호출 ---
  async function fetchStaffNames() {
    showLoader();
    try {
      const response = await fetch(`${APPS_SCRIPT_WEB_APP_URL}?action=getStaffInfo`);
      if (!response.ok) throw new Error(`[${response.status}] ${response.statusText}`);
      const result = await response.json();
      if (!result.success) throw new Error(result.error || 'Failed to load staff info from API.');
      staffListCache = result.data;
      populateStaffList(); 
      staffNameEl.innerHTML = '<option value="">선택하세요</option>'; 
      staffListCache.forEach(s => {
        const option = document.createElement('option');
        option.value = s.name;
        option.textContent = s.name;
        staffNameEl.appendChild(option);
      });
    } catch (error) {
      console.error('Error fetching staff names:', error);
      showStatusMessage('직원 목록 로딩 실패: ' + error.message, false);
    } finally {
      hideLoader();
    }
  }

  // --- 휴일 토글 함수 (기능 1) ---
  function toggleHoliday(dateStr, dayNumberElement) {
    const holidayIndex = currentMonthHolidays.indexOf(dateStr);
    const dateObj = new Date(dateStr + "T00:00:00"); // 정확한 요일 판단을 위해 시간 지정
    const isSunday = dateObj.getDay() === 0;

    if (holidayIndex > -1) { // 이미 휴일이면 해제
      currentMonthHolidays.splice(holidayIndex, 1);
      dayNumberElement.classList.remove('holiday-date-number');
      if (isSunday) { // 일요일이었다면 다시 일요일 스타일 적용
        dayNumberElement.classList.add('sunday-date-number');
      }
    } else { // 휴일이 아니면 설정
      currentMonthHolidays.push(dateStr);
      dayNumberElement.classList.add('holiday-date-number');
      if (isSunday) { // 일요일 스타일이 있다면 휴일이 우선하도록 제거 (CSS 우선순위로도 가능)
        dayNumberElement.classList.remove('sunday-date-number');
      }
    }
    // console.log("Current holidays:", currentMonthHolidays);
  }


 // script.js (renderCalendar 함수 수정)

async function renderCalendar(year, month) {
  showLoader();
  calendarEl.innerHTML = ''; 
  currentMonthYearEl.textContent = `${year}년 ${month}월`;

  console.log(`[renderCalendar] 시작: ${year}년 ${month}월`); // 함수 시작 로그

  const daysOfWeek = ['일', '월', '화', '수', '목', '금', '토'];
  daysOfWeek.forEach((day, index) => {
    const dayHeader = document.createElement('div');
    dayHeader.classList.add('calendar-header');
    dayHeader.textContent = day;
    if (index === 0) dayHeader.classList.add('sunday');
    if (index === 6) dayHeader.classList.add('saturday');
    calendarEl.appendChild(dayHeader);
  });

  const firstDayOfMonth = new Date(year, month - 1, 1);
  const lastDayOfMonth = new Date(year, month, 0);
  const daysInMonth = lastDayOfMonth.getDate();
  const startDayOfWeek = firstDayOfMonth.getDay(); 

  for (let i = 0; i < startDayOfWeek; i++) {
    const emptyCell = document.createElement('div');
    emptyCell.classList.add('calendar-day', 'other-month');
    calendarEl.appendChild(emptyCell);
  }

  for (let day = 1; day <= daysInMonth; day++) {
    const dayCell = document.createElement('div');
    dayCell.classList.add('calendar-day');
    const currentDateObj = new Date(year, month - 1, day);
    const dateStr = `<span class="math-inline">\{year\}\-</span>{String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    
    const dayNumberEl = document.createElement('span');
    dayNumberEl.classList.add('day-number');
    dayNumberEl.textContent = day;
    
    if (currentMonthHolidays.includes(dateStr)) {
      dayNumberEl.classList.add('holiday-date-number');
    }
    dayNumberEl.addEventListener('click', (event) => {
      event.stopPropagation(); 
      toggleHoliday(dateStr, dayNumberEl);
    });
    dayCell.appendChild(dayNumberEl);

    const dayOfWeekVal = currentDateObj.getDay();
    if (!dayNumberEl.classList.contains('holiday-date-number')) {
      if (dayOfWeekVal === 0) dayNumberEl.classList.add('sunday-date-number');
    }
    if (dayOfWeekVal === 6) dayCell.classList.add('saturday'); 
    
    const today = new Date();
    if (year === today.getFullYear() && (month - 1) === today.getMonth() && day === today.getDate()) {
      dayCell.classList.add('today'); 
      if (!dayNumberEl.classList.contains('holiday-date-number')) {
          dayNumberEl.classList.add('today-number'); 
      }
    }
    
    const entriesContainer = document.createElement('div');
    entriesContainer.classList.add('work-entries-container');
    dayCell.appendChild(entriesContainer);
    dayCell.dataset.date = dateStr;
    dayCell.addEventListener('click', (event) => {
      if (event.target !== dayNumberEl && !dayNumberEl.contains(event.target)) {
          openModalForDate(dateStr);
      }
    });
    calendarEl.appendChild(dayCell);
  }

  try {
    console.log(`[renderCalendar] 근무 기록 가져오기 시작: <span class="math-inline">\{year\}\-</span>{month}`);
    const response = await fetch(`<span class="math-inline">\{APPS\_SCRIPT\_WEB\_APP\_URL\}?action\=getWorkRecords&year\=</span>{year}&month=${month}`);
    console.log('[renderCalendar] Fetch 응답 상태:', response.status, response.ok);

    if (!response.ok) {
      const errorText = await response.text(); 
      console.error('[renderCalendar] Fetch 실패. 상태:', response.status, '응답 내용:', errorText);
      throw new Error(`[${response.status}] ${response.statusText}. 서버 상세: ${errorText}`);
    }

    const result = await response.json();
    console.log('[renderCalendar] 파싱된 JSON 결과:', JSON.stringify(result, null, 2)); 

    if (!result.success) {
      console.error('[renderCalendar] API 응답 success:false. 오류:', result.error, '상세:', result.details);
      throw new Error(result.error || 'API로부터 근무 기록 로딩 실패.');
    }
    
    allRecordsForCurrentMonth = result.data || [];
    console.log(`[renderCalendar] 이번 달 기록 (${allRecordsForCurrentMonth.length}개):`, allRecordsForCurrentMonth);
    
    displayWorkRecords(allRecordsForCurrentMonth);
    applyCalendarHighlight();
    console.log('[renderCalendar] 달력 표시 및 하이라이트 적용 완료.');
    
  } catch (error) {
    console.error('[renderCalendar] CATCH 블록. 근무 기록 가져오기/처리 중 오류:', error.message, error.stack);
    allRecordsForCurrentMonth = []; // 오류 시 기록 초기화
    showStatusMessage('근무 기록 로딩 실패: ' + error.message, false);
  } finally {
    console.log('[renderCalendar] Fetch 과정 종료, 로더 숨김.');
    hideLoader();
  }
}
  
  function displayWorkRecords(records) {
    if (!Array.isArray(records)) return;

    const recordsByDate = records.reduce((acc, record) => {
      (acc[record.date] = acc[record.date] || []).push(record);
      return acc;
    }, {});

    Object.keys(recordsByDate).forEach(dateStr => {
      const dayRecords = recordsByDate[dateStr];
      const dayCellContentContainer = calendarEl.querySelector(`.calendar-day[data-date="${dateStr}"] .work-entries-container`);
      
      if (!dayCellContentContainer) return;
      dayCellContentContainer.innerHTML = ''; 

      const staffToTrackMap = new Map();
      let nextAvailableTrack = 0;

      dayRecords.sort((a,b) => {
        if (a.workType === "휴가" && b.workType !== "휴가") return 1;
        if (a.workType !== "휴가" && b.workType === "휴가") return -1;
        const startTimeCompare = (a.startTime || "99:99").localeCompare(b.startTime || "99:99");
        if (startTimeCompare !== 0) return startTimeCompare;
        return (a.name || "").localeCompare(b.name || "");
      });

      dayRecords.forEach(record => {
        if (nextAvailableTrack >= MAX_STAFF_PER_DAY_DISPLAY && !staffToTrackMap.has(record.name)) return;

        const staffMember = staffListCache.find(s => s.name === record.name);
        const staffColor = staffMember ? (staffMember.color || '#A0A0A0') : '#A0A0A0';

        const entryEl = document.createElement('div');
        entryEl.classList.add('work-entry');
        entryEl.style.backgroundColor = staffColor;
        entryEl.title = `${record.name} | ${record.workType}` + 
                        (record.startTime && record.workType !== "휴가" ? ` | ${record.startTime}-${record.endTime}` : '') + 
                        (record.notes ? ` | 비고: ${record.notes}` : '');

        let currentTrack;
        if (staffToTrackMap.has(record.name)) {
            currentTrack = staffToTrackMap.get(record.name);
        } else if (nextAvailableTrack < MAX_STAFF_PER_DAY_DISPLAY) {
            currentTrack = nextAvailableTrack;
            staffToTrackMap.set(record.name, currentTrack);
            nextAvailableTrack++;
        } else {
            return;
        }
        entryEl.style.top = `${currentTrack * TRACK_HEIGHT_WITH_GAP}px`;

        if (record.workType === "휴가") {
          entryEl.classList.add('vacation');
          entryEl.textContent = `${record.name}: 휴가`;
          dayCellContentContainer.appendChild(entryEl);
          return; 
        }

        if (!record.startTime || !record.endTime || TOTAL_TIMELINE_MINUTES <= 0) {
          entryEl.textContent = `${record.name}: ${record.workType || '(시간없음)'}`;
          entryEl.style.position = 'relative'; 
          entryEl.style.width = '100%';
          dayCellContentContainer.appendChild(entryEl);
          return;
        }
        
        const timeToMinutes = (timeStr) => {
            const [h, m] = timeStr.split(':').map(Number);
            return h * 60 + m;
        };

        const recordStartMinutes = timeToMinutes(record.startTime);
        const recordEndMinutes = timeToMinutes(record.endTime);
        const timelineStartTotalMinutes = TIMELINE_START_HOUR * 60;

        let startOffsetMinutes = recordStartMinutes - timelineStartTotalMinutes;
        let durationMinutes = recordEndMinutes - recordStartMinutes;
        
        if (durationMinutes < 0 && recordEndMinutes > 0 && recordStartMinutes > recordEndMinutes) { 
             // 자정 넘김은 이 프로젝트 범위 밖으로 가정
        }
        if (durationMinutes < 0) durationMinutes = 0;


        let displayStartOffsetMinutes = Math.max(0, startOffsetMinutes);
        let displayEndOffsetMinutes;
        if (recordEndMinutes <= timelineStartTotalMinutes) { // 근무 종료가 타임라인 시작보다 이르면
            displayDurationMinutes = 0;
        } else if (recordStartMinutes >= (timelineStartTotalMinutes + TOTAL_TIMELINE_MINUTES)) { // 근무 시작이 타임라인 종료보다 늦으면
             displayDurationMinutes = 0;
        } else {
             displayEndOffsetMinutes = Math.min(TOTAL_TIMELINE_MINUTES, startOffsetMinutes + durationMinutes);
             displayDurationMinutes = Math.max(0, displayEndOffsetMinutes - displayStartOffsetMinutes);
        }

        if (displayDurationMinutes <= 0) return; 

        const leftPercentage = (displayStartOffsetMinutes / TOTAL_TIMELINE_MINUTES) * 100;
        const widthPercentage = (displayDurationMinutes / TOTAL_TIMELINE_MINUTES) * 100;

        entryEl.style.left = `${Math.max(0, Math.min(100, leftPercentage))}%`;
        entryEl.style.width = `${Math.max(0, Math.min(100 - leftPercentage, widthPercentage))}%`;
        
        const barWidthPx = (dayCellContentContainer.clientWidth || 100) * (widthPercentage / 100);
        if (barWidthPx < 20) {
            entryEl.innerHTML = '&nbsp;'; 
        } else if (barWidthPx < 50) {
            entryEl.textContent = `${record.startTime.substring(0,2)}-${record.endTime.substring(0,2)}`; 
        } else {
            entryEl.textContent = `${record.startTime}-${record.endTime}`;
        }
        
        dayCellContentContainer.appendChild(entryEl);
      });
    });
  }

  // --- 모달 열기/닫기 및 폼 관련 ---
  function openModalForDate(dateStr) {
    workRecordForm.reset(); // 폼 요소들 초기화
    repeatOnWeekdayCheckbox.checked = false; // 반복 체크박스도 초기화
    recordDateEl.value = dateStr;
    modalTitle.textContent = `${dateStr} 근무 기록 추가`;
    workTypeEl.value = "주간"; 
    startHourEl.value = "09";
    startMinuteEl.value = "00";
    endHourEl.value = "18";
    endMinuteEl.value = "00";
    notesEl.value = "";
    toggleTimeFields(); 
    modal.style.display = 'block';
  }

  closeModalBtn.onclick = () => { modal.style.display = 'none'; };
  
  window.onclick = (event) => {
    if (event.target == modal) modal.style.display = 'none';
    if (event.target == statsModal) statsModal.style.display = 'none';
  };

  workTypeEl.addEventListener('change', toggleTimeFields);

  function toggleTimeFields() {
    const isHoliday = workTypeEl.value === '휴가';
    timeFieldsEl.style.display = isHoliday ? 'none' : 'block';
    startHourEl.disabled = isHoliday;
    startMinuteEl.disabled = isHoliday;
    endHourEl.disabled = isHoliday;
    endMinuteEl.disabled = isHoliday;
    // 휴가일 때 반복 체크박스도 비활성화 (선택사항)
    repeatOnWeekdayCheckbox.disabled = isHoliday; 
    if(isHoliday) repeatOnWeekdayCheckbox.checked = false;
  }

  // --- 폼 제출 (근무 기록 저장) ---
  workRecordForm.addEventListener('submit', async (e) => {
    e.preventDefault(); 
    showLoader();

    const shouldRepeat = repeatOnWeekdayCheckbox.checked;

    const originalRecordData = {
      date: recordDateEl.value,
      name: staffNameEl.value,
      workType: workTypeEl.value,
      startTime: workTypeEl.value === '휴가' ? '' : `${startHourEl.value}:${startMinuteEl.value}`,
      endTime: workTypeEl.value === '휴가' ? '' : `${endHourEl.value}:${endMinuteEl.value}`,
      notes: notesEl.value.trim(),
    };

    if (!originalRecordData.name) {
        showStatusMessage('이름을 선택해주세요.', false);
        hideLoader();
        return;
    }

    let recordsToSave = [];
    if (shouldRepeat && originalRecordData.workType !== '휴가') { // 휴가는 반복 적용 안 함
      const originalDateObj = new Date(originalRecordData.date + "T00:00:00");
      const targetDayOfWeek = originalDateObj.getDay();
      const year = currentDisplayedDate.getFullYear(); // 현재 달력의 연도 사용
      const month = currentDisplayedDate.getMonth();    // 현재 달력의 월 사용 (0-11)
      const daysInMonth = new Date(year, month + 1, 0).getDate();

      for (let day = 1; day <= daysInMonth; day++) {
        const currentDateInLoop = new Date(year, month, day);
        if (currentDateInLoop.getDay() === targetDayOfWeek) {
          recordsToSave.push({
            ...originalRecordData,
            date: `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`
          });
        }
      }
    } else {
      recordsToSave.push(originalRecordData);
    }
    
    try {
      const payload = { action: 'saveWorkRecords', records: recordsToSave };
      const response = await fetch(APPS_SCRIPT_WEB_APP_URL, {
        method: 'POST',
        headers: {'Content-Type': 'text/plain;charset=utf-8'},
        body: JSON.stringify(payload) 
      });
      
      if (!response.ok) { 
        const errorText = await response.text(); 
        throw new Error(`[${response.status}] ${response.statusText}. 서버 응답: ${errorText}`);
      }
      const result = await response.json(); 

      if (result.success) {
        showStatusMessage(result.message || "저장되었습니다!", true);
        modal.style.display = 'none';
        renderCalendar(currentDisplayedDate.getFullYear(), currentDisplayedDate.getMonth() + 1);
      } else {
        throw new Error(result.error || '알 수 없는 오류로 저장에 실패했습니다.');
      }
    } catch (error) {
      console.error('Error saving record(s):', error);
      showStatusMessage('저장 중 오류 발생: ' + error.message, false);
    } finally {
      hideLoader();
      repeatOnWeekdayCheckbox.checked = false; // 작업 후 체크박스 해제
    }
  });

  // --- 통계 모달 로직 ---
  statsButton.addEventListener('click', openStatsModal);
  closeStatsModalBtn.addEventListener('click', () => { statsModal.style.display = 'none'; });
  statsStaffSelect.addEventListener('change', displayStaffStats);

  async function openStatsModal() {
    if (staffListCache.length === 0) await fetchStaffNames();
    
    statsStaffSelect.innerHTML = '<option value="">직원을 선택해주세요</option>';
    staffListCache.forEach(staff => {
      const option = document.createElement('option');
      option.value = staff.name;
      option.textContent = staff.name;
      statsStaffSelect.appendChild(option);
    });
    
    statsMonthYearLabel.textContent = `${currentDisplayedDate.getFullYear()}년 ${currentDisplayedDate.getMonth() + 1}월 통계`;
    await displayStaffStats(); 
    statsModal.style.display = 'block';
  }

  async function displayStaffStats() {
    const selectedStaff = statsStaffSelect.value;
    const year = currentDisplayedDate.getFullYear();
    const month = currentDisplayedDate.getMonth() + 1;

    if (selectedStaff === "") {
      statsTableContainer.innerHTML = `<p class="stats-placeholder-message">확인하고 싶은 직원 이름을 선택해주세요. ☝️</p>`;
      statsSummaryContainer.innerHTML = "";
      return;
    }

    let needsServerFetch = true;
    if (allRecordsForCurrentMonth.length > 0 && allRecordsForCurrentMonth[0]) {
        const firstRecordSampleDate = new Date(allRecordsForCurrentMonth[0].date);
        if (firstRecordSampleDate.getFullYear() === year && (firstRecordSampleDate.getMonth() + 1) === month) {
            needsServerFetch = false;
        }
    }

    if (needsServerFetch) {
        showLoader();
        try {
            const response = await fetch(`${APPS_SCRIPT_WEB_APP_URL}?action=getWorkRecords&year=${year}&month=${month}`);
            if (!response.ok) throw new Error(`[${response.status}] ${response.statusText}`);
            const result = await response.json();
            if (!result.success) throw new Error(result.error || 'Failed to load work records for stats.');
            allRecordsForCurrentMonth = result.data || [];
        } catch (error) {
            showStatusMessage("통계용 데이터 로드 실패: " + error.message, false);
            hideLoader();
            statsTableContainer.innerHTML = "<p>데이터 로딩 중 오류가 발생했습니다.</p>";
            statsSummaryContainer.innerHTML = "";
            return;
        } finally {
            hideLoader();
        }
    }

    let filteredRecords = allRecordsForCurrentMonth.filter(r => r.name === selectedStaff);

    if (filteredRecords.length === 0) {
      statsTableContainer.innerHTML = `<p class="stats-placeholder-message">${selectedStaff} 님의 근무 기록이 없습니다.</p>`;
      statsSummaryContainer.innerHTML = "";
      return;
    }

    filteredRecords.sort((a, b) => new Date(a.date) - new Date(b.date));

    let tableHTML = `
      <table>
        <thead>
          <tr><th>날짜</th><th>요일</th><th>근무형태</th><th>출근</th><th>퇴근</th><th>근무시간(H)</th></tr>
        </thead>
        <tbody>`;

    const workTypeSummary = { '주간': 0, '마감': 0 };
    let totalMonthHours = 0;
    const weekdaysKO = ['일', '월', '화', '수', '목', '금', '토'];

    filteredRecords.forEach(r => {
      const dateObj = new Date(r.date + "T00:00:00");
      const dayOfWeek = weekdaysKO[dateObj.getDay()];
      const hours = parseFloat(r.totalHours) || 0; 
      
      tableHTML += `
        <tr>
          <td>${r.date.substring(5)}</td>
          <td class="${dayOfWeek === '토' ? 'saturday-text' : ''} ${dayOfWeek === '일' ? 'sunday-text' : ''}">${dayOfWeek}</td>
          <td>${r.workType}</td>
          <td>${r.startTime || '-'}</td>
          <td>${r.endTime || '-'}</td>
          <td>${hours > 0 ? hours.toFixed(1) : (r.workType === '휴가' ? '휴가' : '-')}</td>
        </tr>`;
      if (workTypeSummary.hasOwnProperty(r.workType)) {
        workTypeSummary[r.workType] += hours;
      }
      if (r.workType !== '휴가') totalMonthHours += hours;
    });

    tableHTML += `</tbody></table>`;
    statsTableContainer.innerHTML = tableHTML;

    let summaryHTML = `<h4>📝 근무 형태별 합계:</h4>`;
    summaryHTML += `<div>- 주간: ${workTypeSummary['주간'].toFixed(1)} 시간</div>`;
    summaryHTML += `<div>- 마감: ${workTypeSummary['마감'].toFixed(1)} 시간</div>`;
    summaryHTML += `<div class="total-hours-summary">💵 ${selectedStaff}님 총 근무시간 (휴가 제외): ${totalMonthHours.toFixed(1)} 시간</div>`;
    statsSummaryContainer.innerHTML = summaryHTML;
  }

  // --- 이전/다음 달 버튼 ---
  prevMonthBtn.addEventListener('click', () => {
    currentMonthHolidays = []; // 달 변경 시 휴일 초기화
    currentDisplayedDate.setMonth(currentDisplayedDate.getMonth() - 1);
    highlightedStaffName = null; 
    const currentActiveLi = staffListUlEl.querySelector('.active-highlight');
    if (currentActiveLi) currentActiveLi.classList.remove('active-highlight');
    renderCalendar(currentDisplayedDate.getFullYear(), currentDisplayedDate.getMonth() + 1);
  });

  nextMonthBtn.addEventListener('click', () => {
    currentMonthHolidays = []; // 달 변경 시 휴일 초기화
    currentDisplayedDate.setMonth(currentDisplayedDate.getMonth() + 1);
    highlightedStaffName = null;
    const currentActiveLi = staffListUlEl.querySelector('.active-highlight');
    if (currentActiveLi) currentActiveLi.classList.remove('active-highlight');
    renderCalendar(currentDisplayedDate.getFullYear(), currentDisplayedDate.getMonth() + 1);
  });
  
  // --- 앱 초기화 ---
  async function initializeApp() {
    await fetchStaffNames(); 
    renderCalendar(currentDisplayedDate.getFullYear(), currentDisplayedDate.getMonth() + 1); 
  }

  initializeApp();
});