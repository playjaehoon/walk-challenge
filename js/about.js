// ============================================================
// about.js — 학부 소개 페이지 동적 기능 (게시판, 캘린더)
// ============================================================

document.addEventListener("DOMContentLoaded", () => {
  loadNotices();
  initCalendar();
});

// ===== 학부 소식 렌더링 =====
async function loadNotices() {
  const container = document.getElementById("dynamic-notices");
  if (!container) return;

  try {
    const snap = await db.collection("notices").orderBy("createdAt", "desc").limit(5).get();
    
    if (snap.empty) {
      container.innerHTML = `<div style="padding:1.5rem;text-align:center;color:var(--text-secondary)">등록된 소식이 없습니다.</div>`;
      return;
    }

    container.innerHTML = snap.docs.map(doc => {
      const data = doc.data();
      return `
        <div style="padding:1.25rem;border-bottom:1px solid var(--border);display:flex;justify-content:space-between;align-items:center;cursor:pointer;transition:background 0.2s" onmouseover="this.style.background='var(--bg-secondary)'" onmouseout="this.style.background='transparent'">
          <div>
            <span style="display:inline-block;padding:0.2rem 0.5rem;background:rgba(57,211,83,0.1);color:var(--green);font-size:0.75rem;border-radius:4px;margin-bottom:0.4rem;font-weight:600">${data.type || '공지'}</span>
            <h4 style="margin:0;font-size:1.05rem;font-weight:500">${data.title}</h4>
          </div>
          <span style="color:var(--text-secondary);font-size:0.875rem;flex-shrink:0;margin-left:1rem">${data.date}</span>
        </div>
      `;
    }).join("");
    
    // 마지막 항목 테두리 제거
    if (container.lastElementChild) {
      container.lastElementChild.style.borderBottom = "none";
    }
  } catch (e) {
    console.error("Error loading notices:", e);
    container.innerHTML = `<div style="padding:1.5rem;text-align:center;color:red">소식을 불러오는 중 오류가 발생했습니다.</div>`;
  }
}


// ===== 동적 캘린더 렌더링 =====
let currentDate = new Date(2026, 4, 1); // 기본값을 2026년 5월로 설정 (행사 기간)
let allEvents = [];

async function initCalendar() {
  document.getElementById("cal-prev")?.addEventListener("click", () => changeMonth(-1));
  document.getElementById("cal-next")?.addEventListener("click", () => changeMonth(1));

  try {
    const snap = await db.collection("events").get();
    allEvents = snap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    renderCalendar();
  } catch (e) {
    console.error("Error loading events:", e);
  }
}

function changeMonth(delta) {
  currentDate.setMonth(currentDate.getMonth() + delta);
  renderCalendar();
  document.getElementById("cal-events-list").innerHTML = `<div style="text-align:center;color:var(--text-secondary);padding:1.5rem">달력에서 날짜를 클릭하면 일정이 표시됩니다.</div>`;
}

function renderCalendar() {
  const year = currentDate.getFullYear();
  const month = currentDate.getMonth();
  
  document.getElementById("cal-month-title").textContent = `${year}. ${(month + 1).toString().padStart(2, '0')}`;
  
  const grid = document.getElementById("cal-grid");
  if (!grid) return;
  
  grid.innerHTML = "";
  
  const firstDay = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  
  // 빈 칸 채우기
  for (let i = 0; i < firstDay; i++) {
    const div = document.createElement("div");
    grid.appendChild(div);
  }
  
  // 날짜 채우기
  for (let day = 1; day <= daysInMonth; day++) {
    const dateStr = `${year}-${(month + 1).toString().padStart(2, '0')}-${day.toString().padStart(2, '0')}`;
    
    const div = document.createElement("div");
    div.style.padding = "6px 4px";
    div.style.position = "relative";
    div.style.minHeight = "40px";
    div.style.display = "flex";
    div.style.flexDirection = "column";
    div.style.alignItems = "center";
    div.style.borderRadius = "8px";
    div.style.cursor = "pointer";
    div.style.transition = "background 0.2s";
    
    // 호버 효과
    div.onmouseover = () => div.style.background = "var(--bg-secondary)";
    div.onmouseout = () => div.style.background = "transparent";
    
    // 날짜 번호
    const daySpan = document.createElement("span");
    daySpan.textContent = day;
    
    const currentDayOfWeek = new Date(year, month, day).getDay();
    if (currentDayOfWeek === 0) daySpan.style.color = "#ef4444"; // 일요일
    else if (currentDayOfWeek === 6) daySpan.style.color = "#3b82f6"; // 토요일
    
    div.appendChild(daySpan);
    
    // 이 날짜에 해당하는 이벤트 찾기
    const dayEvents = allEvents.filter(ev => {
      if (!ev.startDate) return false;
      const start = ev.startDate;
      const end = ev.endDate || ev.startDate;
      return dateStr >= start && dateStr <= end;
    });
    
    if (dayEvents.length > 0) {
      // 이벤트 점 컨테이너
      const dotsDiv = document.createElement("div");
      dotsDiv.style.display = "flex";
      dotsDiv.style.gap = "3px";
      dotsDiv.style.marginTop = "4px";
      dotsDiv.style.flexWrap = "wrap";
      dotsDiv.style.justifyContent = "center";
      dotsDiv.style.maxWidth = "100%";
      
      dayEvents.forEach(ev => {
        const dot = document.createElement("div");
        dot.style.width = "6px";
        dot.style.height = "6px";
        dot.style.borderRadius = "50%";
        dot.style.backgroundColor = ev.color || "var(--green)";
        dotsDiv.appendChild(dot);
      });
      
      div.appendChild(dotsDiv);
      
      // 클릭 시 해당 날짜의 이벤트 목록 표시
      div.onclick = () => showEventsForDate(dateStr, dayEvents);
    } else {
      div.onclick = () => {
        document.getElementById("cal-events-list").innerHTML = `<div style="text-align:center;color:var(--text-secondary);padding:1.5rem">이 날짜에는 등록된 일정이 없습니다.</div>`;
      };
    }
    
    grid.appendChild(div);
  }
}

function showEventsForDate(dateStr, events) {
  const container = document.getElementById("cal-events-list");
  
  if (events.length === 0) {
    container.innerHTML = `<div style="text-align:center;color:var(--text-secondary);padding:1.5rem">이 날짜에는 등록된 일정이 없습니다.</div>`;
    return;
  }
  
  const parts = dateStr.split('-');
  const formattedDate = `${parts[1]}월 ${parts[2]}일`;
  
  let html = `<h4 style="margin-bottom:0.5rem;font-size:1.1rem;padding-bottom:0.5rem;border-bottom:1px solid var(--border)">🗓️ ${formattedDate} 일정</h4>`;
  
  events.forEach(ev => {
    html += `
      <div style="display:flex;background:var(--bg-card);border:1px solid var(--border);border-radius:8px;padding:1rem;align-items:flex-start;margin-bottom:0.5rem">
        <div style="margin-top:5px;margin-right:1rem;flex-shrink:0">
          <span style="display:inline-block;width:12px;height:12px;background:${ev.color || 'var(--green)'};border-radius:50%"></span>
        </div>
        <div>
          <h4 style="margin:0 0 0.35rem 0;font-size:1.05rem">${ev.title}</h4>
          ${ev.startDate !== ev.endDate && ev.endDate ? `<div style="font-size:0.8rem;color:var(--text-secondary);margin-bottom:0.4rem">${ev.startDate} ~ ${ev.endDate}</div>` : ''}
          ${ev.description ? `<p style="margin:0;color:var(--text-secondary);font-size:0.9rem;white-space:pre-wrap">${ev.description}</p>` : ''}
        </div>
      </div>
    `;
  });
  
  container.innerHTML = html;
}
