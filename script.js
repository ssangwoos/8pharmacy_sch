// script.js (전체 코드 - 모든 기능 포함 최종)

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
  const staffNameEl = document.getElementById('staffName'); // 근무 입력 모달 내 직원 선택
  const workTypeEl = document.getElementById('workType');
  const timeFieldsEl = document.getElementById('timeFields');
  const startHourEl = document.getElementById('startHour');
  const startMinuteEl = document.getElementById('startMinute');
  const endHourEl = document.getElementById('endHour');
  const endMinuteEl = document.getElementById('endMinute');
  const notesEl = document.getElementById('notes');
  const modalTitle = document.getElementById('modalTitle');


  // 직원 명단 및 강조 기능 관련 요소
  const staffListUlEl = document.getElementById('staffListUl');
  let highlightedStaffName = null;

  // 통계 모달 관련 DOM 요소
  const statsButton = document.getElementById('statsButton');
  const statsModal = document.getElementById('statsModal');
  const closeStatsModalBtn = document.getElementById('closeStatsModalBtn');
  const statsStaffSelect = document.getElementById('statsStaffSelect'); // 통계 모달 내 직원 선택
  const statsTableContainer = document.getElementById('statsTableContainer');
  const statsSummaryContainer = document.getElementById('statsSummaryContainer');
  const statsMonthYearLabel = document.getElementById('statsMonthYearLabel');

  // 전역 변수
  let staffListCache = []; // {name: string, color: string}[]
  let currentDisplayedDate = new Date();
  let allRecordsForCurrentMonth = []; // 현재 달력 월의 모든 기록 캐시 (통계용)

  // --- 달력 표시 기준 시간 및 설정 ---
  const TIMELINE_START_HOUR = 9;  // 9 AM
  const TIMELINE_END_HOUR = 22;   // 10 PM (22시)
  const TOTAL_TIMELINE_MINUTES = (TIMELINE_END_HOUR - TIMELINE_START_HOUR) * 60;
  const MAX_STAFF_PER_DAY_DISPLAY = 5; // 달력 한 칸에 표시할 최대 직원 수
  const TRACK_HEIGHT_WITH_GAP = 20; // 각 시간 막대 트랙의 높이 + 간격

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
    selectElement.innerHTML = ''; // 기존 옵션 초기화
    for (let i = 0; i < 24; i++) {
      const option = document.createElement('option');
      option.value = String(i).padStart(2, '0');
      option.textContent = String(i).padStart(2, '0');
      selectElement.appendChild(option);
    }
  }

  function populateMinuteOptions(selectElement) {
    selectElement.innerHTML = ''; // 기존 옵션 초기화
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
    if (hexcolor.length === 3) { // #RGB to #RRGGBB
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
  
  // --- 직원 명단 관련 (기능 1) ---
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

  // --- 달력 렌더링 ---
  async function renderCalendar(year, month) {
    showLoader();
    calendarEl.innerHTML = ''; 
    currentMonthYearEl.textContent = `${year}년 ${month}월`;

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
      const currentDate = new Date(year, month - 1, day);
      const dateStr = `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
      
      const dayNumberEl = document.createElement('span');
      dayNumberEl.classList.add('day-number');
      dayNumberEl.textContent = day;
      dayCell.appendChild(dayNumberEl);

      const dayOfWeekVal = currentDate.getDay();
      if (dayOfWeekVal === 0) dayCell.classList.add('sunday');
      if (dayOfWeekVal === 6) dayCell.classList.add('saturday');
      
      const today = new Date();
      if (year === today.getFullYear() && (month - 1) === today.getMonth() && day === today.getDate()) {
        dayCell.classList.add('today');
      }
      
      const entriesContainer = document.createElement('div');
      entriesContainer.classList.add('work-entries-container');
      dayCell.appendChild(entriesContainer);
      dayCell.dataset.date = dateStr;
      dayCell.addEventListener('click', () => openModalForDate(dateStr));
      calendarEl.appendChild(dayCell);
    }

    try {
      const response = await fetch(`${APPS_SCRIPT_WEB_APP_URL}?action=getWorkRecords&year=${year}&month=${month}`);
      if (!response.ok) throw new Error(`[${response.status}] ${response.statusText}`);
      const result = await response.json();
      if (!result.success) throw new Error(result.error || 'Failed to load work records from API.');
      
      allRecordsForCurrentMonth = result.data || [];
      displayWorkRecords(allRecordsForCurrentMonth);
      applyCalendarHighlight(); // 하이라이트 상태 적용
      
    } catch (error) {
      console.error('Error fetching work records:', error);
      allRecordsForCurrentMonth = [];
      showStatusMessage('근무 기록 로딩 실패: ' + error.message, false);
    } finally {
      hideLoader();
    }
  }
  
  function displayWorkRecords(records) {
    if (!Array.isArray(records)) {
        console.warn("displayWorkRecords: records is not an array.", records);
        return;
    }

    const recordsByDate = records.reduce((acc, record) => {
      (acc[record.date] = acc[record.date] || []).push(record);
      return acc;
    }, {});

    Object.keys(recordsByDate).forEach(dateStr => {
      const dayRecords = recordsByDate[dateStr];
      const dayCellContentContainer = calendarEl.querySelector(`.calendar-day[data-date="${dateStr}"] .work-entries-container`);
      
      if (!dayCellContentContainer) return;
      dayCellContentContainer.innerHTML = ''; 

      const staffToTrackMap = new Map(); // 직원 이름을 트랙 인덱스에 매핑: Map<string, number>
      let nextAvailableTrack = 0;

      // 휴가를 맨 아래로, 나머지는 시간 순으로 정렬 (더 안정적인 정렬 위해 이름도 추가)
      dayRecords.sort((a,b) => {
        if (a.workType === "휴가" && b.workType !== "휴가") return 1;
        if (a.workType !== "휴가" && b.workType === "휴가") return -1;
        const startTimeCompare = (a.startTime || "99:99").localeCompare(b.startTime || "99:99");
        if (startTimeCompare !== 0) return startTimeCompare;
        return (a.name || "").localeCompare(b.name || "");
      });

      dayRecords.forEach(record => {
        // 현재 트랙이 최대치를 넘었고, 이 직원이 아직 트랙에 배정되지 않았다면 더 이상 그리지 않음
        if (nextAvailableTrack >= MAX_STAFF_PER_DAY_DISPLAY && !staffToTrackMap.has(record.name)) {
            return; 
        }

        const staffMember = staffListCache.find(s => s.name === record.name);
        const staffColor = staffMember ? (staffMember.color || '#A0A0A0') : '#A0A0A0';

        const entryEl = document.createElement('div');
        entryEl.classList.add('work-entry');
        entryEl.style.backgroundColor = staffColor;
        entryEl.title = `${record.name} | ${record.workType}` + 
                        (record.startTime && record.workType !== "휴가" ? ` | ${record.startTime}-${record.endTime}` : '') + 
                        (record.notes ? ` | 비고: ${record.notes}` : '');

        let currentTrack;
        if (staffToTrackMap.has(record.name)) { // 이미 해당 직원이 트랙을 할당받았다면 그 트랙 사용
            currentTrack = staffToTrackMap.get(record.name);
        } else if (nextAvailableTrack < MAX_STAFF_PER_DAY_DISPLAY) { // 새 직원이고 사용 가능한 트랙이 있다면 할당
            currentTrack = nextAvailableTrack;
            staffToTrackMap.set(record.name, currentTrack);
            nextAvailableTrack++;
        } else { // 할당할 트랙이 없으면 이 기록은 표시하지 않음
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
          entryEl.style.position = 'relative'; // 시간 없으면 일반 div처럼 (absolute 해제)
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
        
        if (durationMinutes <= 0 && recordEndMinutes > 0 && recordStartMinutes > recordEndMinutes) { 
             // 자정 넘기는 매우 단순화된 처리 (예: 22:00 - 02:00)
             // 이 경우, 타임라인 시작점 기준으로 end time 까지만 표시하거나, 22:00 - 24:00 까지만 표시.
             // 여기서는 타임라인 범위 내에서만 유효하게 처리.
             durationMinutes = (24*60 - recordStartMinutes) + recordEndMinutes; // 이 로직은 타임라인과 맞지 않음.
             // 일단, 타임라인 범위 밖으로 나가는 것은 잘라서 표시.
        }
         if (durationMinutes < 0) durationMinutes = 0; // 음수 방지


        // 타임라인 표시 범위에 맞게 조정
        let displayStartOffsetMinutes = Math.max(0, startOffsetMinutes);
        // 근무 종료가 타임라인 시작보다 이르면 표시 안 함
        if (recordEndMinutes <= timelineStartTotalMinutes) {
            displayDurationMinutes = 0;
        } else {
            // 근무 시작이 타임라인 종료보다 늦으면 표시 안 함
            if (recordStartMinutes >= (timelineStartTotalMinutes + TOTAL_TIMELINE_MINUTES)) {
                 displayDurationMinutes = 0;
            } else {
                 let displayEndOffsetMinutes = Math.min(TOTAL_TIMELINE_MINUTES, startOffsetMinutes + durationMinutes);
                 displayDurationMinutes = Math.max(0, displayEndOffsetMinutes - displayStartOffsetMinutes);
            }
        }


        if (displayDurationMinutes <= 0) return; 

        const leftPercentage = (displayStartOffsetMinutes / TOTAL_TIMELINE_MINUTES) * 100;
        const widthPercentage = (displayDurationMinutes / TOTAL_TIMELINE_MINUTES) * 100;

        entryEl.style.left = `${Math.max(0, Math.min(100, leftPercentage))}%`; // 0~100% 범위 보장
        entryEl.style.width = `${Math.max(0, Math.min(100 - leftPercentage, widthPercentage))}%`; // 0~100% 범위 및 남은 공간 보장
        
        const barWidthPx = (dayCellContentContainer.clientWidth || 100) * (widthPercentage / 100);
        if (barWidthPx < 20) {
            entryEl.innerHTML = '&nbsp;'; // 너무 짧으면 내용 없음
        } else if (barWidthPx < 50) {
            entryEl.textContent = `${record.startTime.substring(0,2)}-${record.endTime.substring(0,2)}`; // 시(09-18)
        } else {
            entryEl.textContent = `${record.startTime}-${record.endTime}`; // 09:00-18:00
        }
        
        dayCellContentContainer.appendChild(entryEl);
      });
    });
  }

  // --- 모달 열기/닫기 및 폼 관련 ---
  function openModalForDate(dateStr) {
    workRecordForm.reset();
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
  
  window.onclick = (event) => { // 모달 외부 클릭 시 닫기
    if (event.target == modal) {
      modal.style.display = 'none';
    }
    if (event.target == statsModal) { // 통계 모달도 외부 클릭 시 닫기
      statsModal.style.display = 'none';
    }
  };

  workTypeEl.addEventListener('change', toggleTimeFields);

  function toggleTimeFields() {
    const isHoliday = workTypeEl.value === '휴가';
    timeFieldsEl.style.display = isHoliday ? 'none' : 'block';
    startHourEl.disabled = isHoliday;
    startMinuteEl.disabled = isHoliday;
    endHourEl.disabled = isHoliday;
    endMinuteEl.disabled = isHoliday;
  }

  workRecordForm.addEventListener('submit', async (e) => {
    e.preventDefault(); 
    showLoader();

    const startTimeValue = `${startHourEl.value}:${startMinuteEl.value}`;
    const endTimeValue = `${endHourEl.value}:${endMinuteEl.value}`;

    const recordData = {
      date: recordDateEl.value,
      name: staffNameEl.value,
      workType: workTypeEl.value,
      startTime: workTypeEl.value === '휴가' ? '' : startTimeValue,
      endTime: workTypeEl.value === '휴가' ? '' : endTimeValue,
      notes: notesEl.value.trim(),
    };

    if (!recordData.name) {
        showStatusMessage('이름을 선택해주세요.', false);
        hideLoader();
        return;
    }
    
    try {
      const response = await fetch(APPS_SCRIPT_WEB_APP_URL, {
        method: 'POST',
        headers: {'Content-Type': 'text/plain;charset=utf-8'}, // Apps Script doPost는 e.postData.contents가 문자열
        body: JSON.stringify({ action: 'saveWorkRecord', record: recordData }) 
      });
      
      if (!response.ok) { 
        const errorText = await response.text(); 
        throw new Error(`[${response.status}] ${response.statusText}. 서버 응답: ${errorText}`);
      }
      
      const result = await response.json(); 

      if (result.success) {
        showStatusMessage(result.message || "저장되었습니다!", true);
        modal.style.display = 'none';
        renderCalendar(currentDisplayedDate.getFullYear(), currentDisplayedDate.getMonth() + 1); // 달력 새로고침
      } else {
        throw new Error(result.error || '알 수 없는 오류로 저장에 실패했습니다.');
      }
    } catch (error) {
      console.error('Error saving record:', error);
      showStatusMessage('저장 중 오류 발생: ' + error.message, false);
    } finally {
      hideLoader();
    }
  });

  // --- 통계 모달 로직 (기능 2) ---
  statsButton.addEventListener('click', openStatsModal);
  closeStatsModalBtn.addEventListener('click', () => { statsModal.style.display = 'none'; });
  statsStaffSelect.addEventListener('change', displayStaffStats); // 선택 변경 시 통계 다시 표시

  async function openStatsModal() {
    // 직원 목록이 없으면 먼저 로드 (보통은 캐시된 것 사용)
    if (staffListCache.length === 0) {
      await fetchStaffNames(); // 이 함수는 staffListCache를 채움
    }
    
    statsStaffSelect.innerHTML = '<option value="">직원을 선택해주세요</option>';
    staffListCache.forEach(staff => {
      const option = document.createElement('option');
      option.value = staff.name;
      option.textContent = staff.name;
      statsStaffSelect.appendChild(option);
    });
    
    statsMonthYearLabel.textContent = `${currentDisplayedDate.getFullYear()}년 ${currentDisplayedDate.getMonth() + 1}월 통계`;
    
    // 처음 모달 열 때 '전체 직원' 통계 표시 (또는 선택된 직원 유지)
    await displayStaffStats(); 
    statsModal.style.display = 'block';
  }

  async function displayStaffStats() {
    const selectedStaff = statsStaffSelect.value; // "" 이면 "직원을 선택해주세요" 상
    const year = currentDisplayedDate.getFullYear();
    const month = currentDisplayedDate.getMonth() + 1;

  // *** 추가된 로직: 직원이 선택되지 않았으면 안내 메시지 표시 ***
  if (selectedStaff === "") {
    statsTableContainer.innerHTML = `<p class="stats-placeholder-message">확인하고 싶은 직원 이름을 선택해주세요. ☝️</p>`;
    statsSummaryContainer.innerHTML = ""; // 요약 정보도 비움
    // statsMonthYearLabel은 유지
    return; // 여기서 함수 종료
  }

    // 현재 allRecordsForCurrentMonth가 해당 월의 데이터를 가지고 있는지 확인
    // 달력의 월과 통계 모달의 월이 같은지 확인하여, 다르면 새로 fetch
    let needsServerFetch = true;
    if (allRecordsForCurrentMonth.length > 0) {
        const firstRecordSampleDate = new Date(allRecordsForCurrentMonth[0].date);
        if (firstRecordSampleDate.getFullYear() === year && (firstRecordSampleDate.getMonth() + 1) === month) {
            needsServerFetch = false; // 캐시된 데이터가 현재 월과 일치
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

    // 날짜순 정렬
    filteredRecords.sort((a, b) => new Date(a.date) - new Date(b.date));

    let tableHTML = `
      <table>
        <thead>
          <tr>
            <th>날짜</th>
            <th>요일</th>
            <th>근무형태</th>
            <th>출근</th>
            <th>퇴근</th>
            <th>근무시간(H)</th>
          </tr>
        </thead>
        <tbody>
    `;

    const workTypeSummary = { '주간': 0, '마감': 0 }; // 휴가는 근무시간 0으로 간주
    let totalMonthHours = 0;
    const weekdaysKO = ['일', '월', '화', '수', '목', '금', '토'];

    filteredRecords.forEach(r => {
      const dateObj = new Date(r.date + "T00:00:00"); // 시간대 문제 방지 위해 로컬시간으로 명시
      const dayOfWeek = weekdaysKO[dateObj.getDay()];
      const hours = parseFloat(r.totalHours) || 0; 
      
      tableHTML += `
        <tr>
          <td>${r.date.substring(5)}</td>
          <td class="${dayOfWeek === '토' ? 'saturday' : ''} ${dayOfWeek === '일' ? 'sunday' : ''}">${dayOfWeek}</td>
          <td>${r.workType}</td>
          <td>${r.startTime || '-'}</td>
          <td>${r.endTime || '-'}</td>
          <td>${hours > 0 ? hours.toFixed(1) : (r.workType === '휴가' ? '휴가' : '-')}</td>
        </tr>
      `;
      if (workTypeSummary.hasOwnProperty(r.workType)) {
        workTypeSummary[r.workType] += hours;
      }
      if (r.workType !== '휴가'){
          totalMonthHours += hours;
      }
    });

    tableHTML += `</tbody></table>`;
    statsTableContainer.innerHTML = tableHTML;

    let summaryHTML = `<h4>📝 근무 형태별 합계:</h4>`;
    summaryHTML += `<div>- 주간: ${workTypeSummary['주간'].toFixed(1)} 시간</div>`;
    summaryHTML += `<div>- 마감: ${workTypeSummary['마감'].toFixed(1)} 시간</div>`;
    summaryHTML += `<div class="total-hours-summary">💵 총 근무시간 (휴가 제외): ${totalMonthHours.toFixed(1)} 시간</div>`;
    statsSummaryContainer.innerHTML = summaryHTML;
  }


  // --- 이전/다음 달 버튼 ---
  prevMonthBtn.addEventListener('click', () => {
    currentDisplayedDate.setMonth(currentDisplayedDate.getMonth() - 1);
    highlightedStaffName = null; 
    const currentActiveLi = staffListUlEl.querySelector('.active-highlight');
    if (currentActiveLi) currentActiveLi.classList.remove('active-highlight');
    renderCalendar(currentDisplayedDate.getFullYear(), currentDisplayedDate.getMonth() + 1);
  });

  nextMonthBtn.addEventListener('click', () => {
    currentDisplayedDate.setMonth(currentDisplayedDate.getMonth() + 1);
    highlightedStaffName = null;
    const currentActiveLi = staffListUlEl.querySelector('.active-highlight');
    if (currentActiveLi) currentActiveLi.classList.remove('active-highlight');
    renderCalendar(currentDisplayedDate.getFullYear(), currentDisplayedDate.getMonth() + 1);
  });
  
  // --- 앱 초기화 ---
  async function initializeApp() {
    await fetchStaffNames(); // 직원 목록 먼저 로드
    renderCalendar(currentDisplayedDate.getFullYear(), currentDisplayedDate.getMonth() + 1); // 그 후 달력 렌더링
  }

  initializeApp(); // 앱 시작!
});