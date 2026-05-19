// ============================================================
// admin.js — 관리자 대시보드
// ============================================================

async function initAdmin() {
  const user = await requireAdmin();
  if (!user) return;

  document.getElementById("admin-loading").classList.add("hidden");
  document.getElementById("admin-content").classList.remove("hidden");

  setupTabs();
  try {
    await Promise.all([
      loadStats().catch(e => console.error("Error loadStats:", e)),
      loadUsers().catch(e => console.error("Error loadUsers:", e)),
      loadControls().catch(e => console.error("Error loadControls:", e)),
      loadPendingProofs().catch(e => console.error("Error loadPending:", e)),
      loadCompletedProofs().catch(e => console.error("Error loadCompleted:", e)),
      loadNotices().catch(e => console.error("Error loadNotices:", e)),
      loadEvents().catch(e => console.error("Error loadEvents:", e))
    ]);
  } catch (e) {
    console.error("Error loading admin data:", e);
  }
  generateQRCodes();
}

// ===== 탭 전환 =====
function setupTabs() {
  document.querySelectorAll(".admin-tab").forEach((tab) => {
    tab.addEventListener("click", () => {
      document.querySelectorAll(".admin-tab").forEach((t) => t.classList.remove("active"));
      document.querySelectorAll(".admin-content").forEach((c) => c.classList.remove("active"));
      tab.classList.add("active");
      document.getElementById(tab.dataset.target)?.classList.add("active");
    });
  });
}

// ===== 통계 =====
async function loadStats() {
  const snap  = await db.collection("users").get();
  
  const users = snap.docs
    .map((d) => ({ ...d.data(), uid: d.id, id: d.id }))
    .filter(u => {
      if (u.email && typeof ADMIN_EMAILS !== 'undefined' && ADMIN_EMAILS.includes(u.email)) return false;
      const n = (u.name || '').toLowerCase();
      const e = (u.email || '').toLowerCase();
      if (n.includes('test') || e.includes('test')) return false;
      return true;
    });

  const counts = { bronze: 0, silver: 0, gold: 0 };
  let totalScore = 0;

  users.forEach((u) => {
    const s = u.totalScore || 0;
    totalScore += s;
    const t = getTier(s);
    if (t.cls in counts) counts[t.cls]++;
  });

  document.getElementById("stat-total").textContent   = users.length;
  document.getElementById("stat-avg").textContent     = users.length ? Math.round(totalScore / users.length) + "pt" : "0pt";
  document.getElementById("stat-gold").textContent    = counts.gold;
  document.getElementById("stat-silver").textContent  = counts.silver;
  document.getElementById("stat-bronze").textContent  = counts.bronze;

  // 일자별 QR 스캔 통계 추출 (비동기로 병렬 처리)
  try {
    const dailyScanners = {}; // { '2026.05.18': Set(uid) }
    const locationStats = {}; // { 'loc01': { count: 0, uniqueUsers: Set(uid), name: '...' } }
    let totalScansAcrossAll = 0;

    const scansPromises = users.map(u => db.collection("users").doc(u.uid).collection("scans").get());
    const scansSnaps = await Promise.all(scansPromises);

    scansSnaps.forEach((userScansSnap, idx) => {
      const uid = users[idx].uid || users[idx].id;
      userScansSnap.forEach(doc => {
        const scan = doc.data();
        const dateStr = scan.dateStr;
        if (dateStr) {
          if (!dailyScanners[dateStr]) dailyScanners[dateStr] = new Set();
          dailyScanners[dateStr].add(uid);
        }

        const locId = scan.locationId;
        if (locId) {
          if (!locationStats[locId]) {
            locationStats[locId] = { count: 0, uniqueUsers: new Set(), name: scan.locationName || locId };
          }
          locationStats[locId].count++;
          locationStats[locId].uniqueUsers.add(uid);
          totalScansAcrossAll++;
        }
      });
    });

    const totalUsers = users.length;
    let statsHtml = `<div class="table-wrapper"><table style="width:100%; border-collapse: collapse; text-align:center;">
      <thead>
        <tr>
          <th>일자</th>
          <th>QR스캔 참가자 수</th>
          <th>참여 비율 (%)</th>
        </tr>
      </thead>
      <tbody>`;

    const sortedDates = Object.keys(dailyScanners).sort().reverse(); // 최신순
    if (sortedDates.length === 0) {
      statsHtml += `<tr><td colspan="3" style="padding:1.5rem; color:var(--text-secondary)">스캔 기록이 없습니다.</td></tr>`;
    } else {
      sortedDates.forEach(date => {
        const cnt = dailyScanners[date].size;
        const pct = totalUsers > 0 ? Math.round((cnt / totalUsers) * 100) : 0;
        statsHtml += `
          <tr>
            <td>${date}</td>
            <td style="font-weight:bold; color:var(--green)">${cnt}명</td>
            <td style="color:var(--text-secondary)">${pct}%</td>
          </tr>`;
      });
    }
    statsHtml += `</tbody></table></div>`;

    const statsContainer = document.getElementById("daily-scan-stats");
    if (statsContainer) {
      statsContainer.innerHTML = statsHtml;
    }

    // 장소(QR)별 통계 HTML 생성
    let qrStatsHtml = `<div class="table-wrapper"><table style="width:100%; border-collapse: collapse; text-align:center;">
      <thead>
        <tr>
          <th>장소 (QR)</th>
          <th>누적 스캔 횟수</th>
          <th>스캔 비율 (%)</th>
          <th>스캔한 참가자 수</th>
        </tr>
      </thead>
      <tbody>`;

    const sortedLocs = Object.keys(locationStats).sort((a, b) => locationStats[b].count - locationStats[a].count);
    
    if (sortedLocs.length === 0) {
      qrStatsHtml += `<tr><td colspan="4" style="padding:1.5rem; color:var(--text-secondary)">스캔 기록이 없습니다.</td></tr>`;
    } else {
      sortedLocs.forEach(locId => {
        const data = locationStats[locId];
        const pct = totalScansAcrossAll > 0 ? Math.round((data.count / totalScansAcrossAll) * 100) : 0;
        qrStatsHtml += `
          <tr>
            <td style="font-weight:500;">${data.name}</td>
            <td style="font-weight:bold; color:var(--blue)">${data.count}회</td>
            <td style="color:var(--text-secondary)">${pct}%</td>
            <td style="color:var(--text-secondary)">${data.uniqueUsers.size}명</td>
          </tr>`;
      });
    }
    qrStatsHtml += `</tbody></table></div>`;

    const qrStatsContainer = document.getElementById("qr-scan-stats");
    if (qrStatsContainer) {
      qrStatsContainer.innerHTML = qrStatsHtml;
    }
  } catch (err) {
    console.error("일자별 스캔 통계 로드 중 오류:", err);
    const statsContainer = document.getElementById("daily-scan-stats");
    if (statsContainer) statsContainer.innerHTML = `<div style="text-align:center; padding: 1rem; color: var(--red);">통계 데이터를 불러오는 중 오류가 발생했습니다.</div>`;
  }
}

// ===== 전역 상태 =====
let adminUsersData = [];
let adminUsersSortKey = 'rank';
let adminUsersSortAsc = true;

let adminControlsData = [];
let adminControlsSortKey = 'registeredAt';
let adminControlsSortAsc = false;

// ===== 전체 사용자 =====
async function loadUsers() {
  const snap = await db.collection("users").orderBy("totalScore", "desc").get();
  adminUsersData = snap.docs
    .map((d) => ({ id: d.id, ...d.data() }))
    .filter(u => {
      if (u.email && typeof ADMIN_EMAILS !== 'undefined' && ADMIN_EMAILS.includes(u.email)) return false;
      const n = (u.name || '').toLowerCase();
      const e = (u.email || '').toLowerCase();
      if (n.includes('test') || e.includes('test')) return false;
      return true;
    })
    .map((u, i) => ({ rank: i + 1, ...u }));
  renderUsersTable();
}

function renderUsersTable() {
  const sorted = [...adminUsersData].sort((a, b) => {
    let valA = a[adminUsersSortKey];
    let valB = b[adminUsersSortKey];
    if (valA && valA.toMillis) valA = valA.toMillis();
    if (valB && valB.toMillis) valB = valB.toMillis();
    if (typeof valA === 'string') valA = valA.toLowerCase();
    if (typeof valB === 'string') valB = valB.toLowerCase();
    if (valA < valB) return adminUsersSortAsc ? -1 : 1;
    if (valA > valB) return adminUsersSortAsc ? 1 : -1;
    return 0;
  });

  const tbody = document.getElementById("users-tbody");
  tbody.innerHTML = sorted.map((u) => {
    const tier = getTier(u.totalScore || 0);
    return `<tr>
      <td>${u.rank}</td>
      <td>${u.name} ${u.nickname ? `<br><span style="font-size:0.8em;color:var(--text-secondary)">(${u.nickname})</span>` : ''}</td>
      <td>${u.gender === 'male' ? '남성' : (u.gender === 'female' ? '여성' : '-')}</td>
      <td>${u.studentId}</td>
      <td>${u.department}</td>
      <td>${u.phone || '-'}</td>
      <td style="color:var(--green);font-weight:700;font-family:'Outfit',sans-serif">${u.totalScore || 0}pt</td>
      <td>${tier.emoji} ${tier.name}</td>
      <td style="font-size:0.85rem;color:var(--text-secondary)">${formatDate(u.registeredAt)}</td>
      <td>
        <button onclick="window.open('dashboard.html?uid=${u.id}', '_blank')" class="btn btn-secondary btn-sm" style="margin-right:4px;">기록</button>
        <button onclick="openUserEdit('${u.id}', '${u.name}', '${u.nickname || ''}', '${u.studentId}', '${u.department}', ${u.totalScore || 0})" class="btn btn-secondary btn-sm">편집</button>
      </td>
    </tr>`;
  }).join("");
}

window.sortUsers = function(key) {
  if (adminUsersSortKey === key) adminUsersSortAsc = !adminUsersSortAsc;
  else { adminUsersSortKey = key; adminUsersSortAsc = true; }
  
  document.querySelectorAll('#tab-users th.sortable').forEach(th => th.classList.remove('asc', 'desc'));
  const th = document.querySelector(`#tab-users th[data-sort="${key}"]`);
  if (th) th.classList.add(adminUsersSortAsc ? 'asc' : 'desc');
  renderUsersTable();
}

// ===== 사용자 편집/삭제 =====
window.openUserEdit = function(id, name, nickname, studentId, department, score) {
  document.getElementById('edit-user-id').value = id;
  document.getElementById('edit-user-name').value = name;
  document.getElementById('edit-user-nickname').value = nickname;
  document.getElementById('edit-user-studentId').value = studentId;
  document.getElementById('edit-user-department').value = department;
  document.getElementById('edit-user-score').value = score;
  document.getElementById('modal-user-edit').classList.remove('hidden');
};

window.saveUserEdit = async function() {
  const id = document.getElementById('edit-user-id').value;
  const name = document.getElementById('edit-user-name').value;
  const nickname = document.getElementById('edit-user-nickname').value;
  const studentId = document.getElementById('edit-user-studentId').value;
  const department = document.getElementById('edit-user-department').value;
  const score = parseInt(document.getElementById('edit-user-score').value) || 0;

  try {
    await db.collection("users").doc(id).update({
      name: name,
      nickname: nickname,
      studentId: studentId,
      department: department,
      totalScore: score
    });
    showToast("사용자 정보가 수정되었습니다.", "success");
    document.getElementById('modal-user-edit').classList.add('hidden');
    loadUsers();
    loadStats();
  } catch (e) {
    console.error("Error updating user:", e);
    showToast("수정 중 오류가 발생했습니다.", "error");
  }
};

window.deleteUser = async function() {
  const id = document.getElementById('edit-user-id').value;
  const name = document.getElementById('edit-user-name').value;
  if (!confirm(`정말 [${name}] 참가자를 완전히 삭제하시겠습니까?\n이 작업은 되돌릴 수 없습니다.`)) return;

  try {
    await db.collection("users").doc(id).delete();
    showToast("참가자가 삭제되었습니다.", "success");
    document.getElementById('modal-user-edit').classList.add('hidden');
    loadUsers();
    loadStats();
  } catch (e) {
    console.error("Error deleting user:", e);
    showToast("삭제 중 오류가 발생했습니다.", "error");
  }
};

// ===== 대조군(설문 참가자) 목록 =====
window.loadControls = async function() {
  try {
    const snap = await db.collection("control_group").orderBy("registeredAt", "desc").get();
    adminControlsData = snap.docs.map((d, i) => ({ index: snap.docs.length - i, id: d.id, ...d.data() }));
    renderControlsTable();
  } catch (error) {
    console.error("Error loading controls:", error);
    document.getElementById("controls-tbody").innerHTML = `<tr><td colspan="8" style="text-align:center;color:red">데이터를 불러오는 중 오류가 발생했습니다.</td></tr>`;
  }
};

function renderControlsTable() {
  const tbody = document.getElementById("controls-tbody");
  if (adminControlsData.length === 0) {
    tbody.innerHTML = `<tr><td colspan="8" style="text-align:center;color:var(--text-secondary)">신청자가 없습니다.</td></tr>`;
    return;
  }

  const sorted = [...adminControlsData].sort((a, b) => {
    let valA = a[adminControlsSortKey];
    let valB = b[adminControlsSortKey];
    if (valA && valA.toMillis) valA = valA.toMillis();
    if (valB && valB.toMillis) valB = valB.toMillis();
    if (typeof valA === 'string') valA = valA.toLowerCase();
    if (typeof valB === 'string') valB = valB.toLowerCase();
    
    // For registeredAt descending is usually preferred for newer first
    if (valA < valB) return adminControlsSortAsc ? -1 : 1;
    if (valA > valB) return adminControlsSortAsc ? 1 : -1;
    return 0;
  });

  tbody.innerHTML = sorted.map((data, i) => {
    return `<tr>
      <td>${data.index}</td>
      <td>${data.name}</td>
      <td>${data.gender === 'male' ? '남성' : '여성'}</td>
      <td>${data.studentId}</td>
      <td>${data.department}</td>
      <td>${data.phone}</td>
      <td>${data.email}</td>
      <td style="font-size:0.85rem;color:var(--text-secondary)">${formatDate(data.registeredAt)}</td>
    </tr>`;
  }).join('');
}

window.sortControls = function(key) {
  if (adminControlsSortKey === key) adminControlsSortAsc = !adminControlsSortAsc;
  else { adminControlsSortKey = key; adminControlsSortAsc = (key === 'registeredAt' ? false : true); }
  
  document.querySelectorAll('#tab-controls th.sortable').forEach(th => th.classList.remove('asc', 'desc'));
  const th = document.querySelector(`#tab-controls th[data-sort="${key}"]`);
  if (th) th.classList.add(adminControlsSortAsc ? 'asc' : 'desc');
  renderControlsTable();
}

// ===== 걷기 인증 대기 =====
async function loadPendingProofs() {
  const usersSnap = await db.collection("users").get();
  const queue = [];

  for (const userDoc of usersSnap.docs) {
    const proofsSnap = await db.collection("users").doc(userDoc.id)
      .collection("proofs").where("status", "==", "pending").get();
    proofsSnap.docs.forEach((p) =>
      queue.push({ userId: userDoc.id, userName: userDoc.data().name, proofId: p.id, ...p.data() })
    );
  }

  const container = document.getElementById("proof-queue");
  if (queue.length === 0) {
    container.innerHTML = `<p style="color:var(--text-secondary);text-align:center;padding:2rem">대기 중인 인증이 없습니다.</p>`;
    return;
  }

  container.innerHTML = queue.map((p) => `
    <div class="card" style="margin-bottom:1rem" id="proof-card-${p.proofId}">
      <div style="display:flex;align-items:flex-start;gap:1rem;flex-wrap:wrap">
        <div style="width:110px;height:75px;background:var(--bg-secondary);border-radius:8px;display:flex;align-items:center;justify-content:center;flex-shrink:0;text-align:center;overflow:hidden;border:1px solid var(--border)">
          <img src="${p.imageUrl}" style="width:100%;height:100%;object-fit:cover;cursor:pointer" onclick="openModal('${p.imageUrl}')" alt="증빙 사진">
        </div>
        <div style="flex:1;min-width:160px">
          <h4 style="margin-bottom:0.25rem">${p.userName}</h4>
          <p style="font-size:0.85rem;margin:0">${p.week}주차 | ${p.stepsLabel || "-"} | <strong style="color:var(--green)">${p.score}pt</strong></p>
          <p style="font-size:0.75rem;color:var(--text-secondary);margin:0.2rem 0 0">${formatDate(p.submittedAt)}</p>
        </div>
        <div style="display:flex;gap:0.5rem;flex-shrink:0">
          <button onclick="approveProof('${p.userId}','${p.proofId}',${p.score})" class="btn btn-primary btn-sm">✅ 승인</button>
          <button onclick="rejectProof('${p.userId}','${p.proofId}')"             class="btn btn-danger btn-sm" >❌ 반려</button>
        </div>
      </div>
    </div>`).join("");
}

async function approveProof(userId, proofId, score) {
  try {
    await db.runTransaction(async (tx) => {
      const userRef  = db.collection("users").doc(userId);
      const proofRef = db.collection("users").doc(userId).collection("proofs").doc(proofId);
      const userDoc  = await tx.get(userRef);
      tx.update(proofRef, { status: "approved" });
      tx.update(userRef,  { totalScore: (userDoc.data().totalScore || 0) + score });
    });
    document.getElementById(`proof-card-${proofId}`)?.remove();
    showToast("인증이 승인되었습니다. ✅", "success");
    loadCompletedProofs();
    loadUsers();
  } catch { showToast("오류가 발생했습니다.", "error"); }
}

async function rejectProof(userId, proofId) {
  if (!confirm("이 인증을 반려하시겠습니까?")) return;
  try {
    await db.collection("users").doc(userId).collection("proofs").doc(proofId)
      .update({ status: "rejected" });
    document.getElementById(`proof-card-${proofId}`)?.remove();
    showToast("반려되었습니다.", "info");
    loadCompletedProofs();
  } catch { showToast("오류가 발생했습니다.", "error"); }
}

// ===== 완료된 인증 내역 =====
async function loadCompletedProofs() {
  const usersSnap = await db.collection("users").get();
  const queue = [];

  for (const userDoc of usersSnap.docs) {
    const proofsSnap = await db.collection("users").doc(userDoc.id).collection("proofs").get();
    proofsSnap.docs.forEach((p) => {
      const data = p.data();
      if (data.status === "approved" || data.status === "rejected") {
        queue.push({ userId: userDoc.id, userName: userDoc.data().name, proofId: p.id, ...data });
      }
    });
  }

  // 최신 제출이 위로 오도록 정렬
  queue.sort((a,b) => (b.submittedAt?.toMillis() || 0) - (a.submittedAt?.toMillis() || 0));

  const container = document.getElementById("proof-history-queue");
  if (queue.length === 0) {
    container.innerHTML = `<p style="color:var(--text-secondary);text-align:center;padding:2rem">처리된 인증 내역이 없습니다.</p>`;
    return;
  }

  container.innerHTML = queue.map((p) => {
    const isApproved = p.status === "approved";
    const statusBadge = isApproved 
      ? `<span style="display:inline-block;padding:0.2rem 0.5rem;background:rgba(57,211,83,0.15);color:var(--green);border-radius:4px;font-size:0.75rem;font-weight:700;margin-bottom:0.25rem">✅ 승인됨 (+${p.score}pt)</span>`
      : `<span style="display:inline-block;padding:0.2rem 0.5rem;background:rgba(255,100,100,0.15);color:#ff6b6b;border-radius:4px;font-size:0.75rem;font-weight:700;margin-bottom:0.25rem">❌ 반려됨</span>`;

    return `
    <div class="card" style="margin-bottom:1rem;opacity:0.8" id="history-card-${p.proofId}">
      <div style="display:flex;align-items:flex-start;gap:1rem;flex-wrap:wrap">
        <div style="width:110px;height:75px;background:var(--bg-secondary);border-radius:8px;display:flex;align-items:center;justify-content:center;flex-shrink:0;text-align:center;overflow:hidden;border:1px solid var(--border)">
          <img src="${p.imageUrl}" style="width:100%;height:100%;object-fit:cover;cursor:pointer" onclick="openModal('${p.imageUrl}')" alt="증빙 사진">
        </div>
        <div style="flex:1;min-width:160px">
          ${statusBadge}
          <h4 style="margin-bottom:0.2rem">${p.userName}</h4>
          <p style="font-size:0.85rem;margin:0">${p.week}주차 | ${p.stepsLabel || "-"}</p>
          <p style="font-size:0.75rem;color:var(--text-secondary);margin:0.2rem 0 0">${formatDate(p.submittedAt)}</p>
        </div>
        <div style="display:flex;gap:0.5rem;flex-shrink:0">
          <button onclick="revertProof('${p.userId}','${p.proofId}',${p.score},'${p.status}')" class="btn btn-outline btn-sm" style="font-size:0.8rem">↩️ 되돌리기</button>
        </div>
      </div>
    </div>`;
  }).join("");
}

async function revertProof(userId, proofId, score, prevStatus) {
  if (!confirm("이 인증 처리를 취소하고 다시 '검토 대기' 상태로 되돌리시겠습니까?\\n(승인되었던 내역인 경우, 유저의 점수에서 해당 포인트가 다시 차감됩니다.)")) return;
  
  try {
    await db.runTransaction(async (tx) => {
      const userRef  = db.collection("users").doc(userId);
      const proofRef = db.collection("users").doc(userId).collection("proofs").doc(proofId);
      const userDoc  = await tx.get(userRef);

      tx.update(proofRef, { status: "pending" });
      
      // 만약 승인했던 것을 되돌린다면 점수 차감
      if (prevStatus === "approved") {
        const currentScore = userDoc.data().totalScore || 0;
        tx.update(userRef, { totalScore: Math.max(0, currentScore - score) });
      }
    });

    showToast("되돌리기 성공! 검토 대기열로 돌아갔습니다.", "success");
    document.getElementById(`history-card-${proofId}`)?.remove();
    loadPendingProofs();
    loadCompletedProofs();
    loadUsers();
  } catch (err) {
    showToast("오류 발생", "error");
  }
}

// ===== 점수 조정 모달 =====
function showScoreModal(userId, userName, currentScore) {
  const adj = prompt(`[${userName}] 점수 조정\n현재: ${currentScore}pt\n\n조정할 값을 입력하세요 (음수 가능, 예: -50 또는 +30):`);
  if (adj === null) return;
  const delta = parseInt(adj);
  if (isNaN(delta)) { showToast("올바른 숫자를 입력하세요.", "error"); return; }

  db.collection("users").doc(userId)
    .update({ totalScore: Math.max(0, currentScore + delta) })
    .then(() => { showToast(`${userName}: ${delta > 0 ? "+" : ""}${delta}pt 조정 완료`, "success"); loadUsers(); })
    .catch(() => showToast("오류 발생", "error"));
}

// ===== QR 코드 생성 =====
function generateQRCodes() {
  let path = window.location.pathname;
  path = path.replace(/\/admin(\.html)?\/?$/, '/');
  if (!path.endsWith('/')) path += '/';
  const base = window.location.origin + path + "scan.html";
  const grid = document.getElementById("qr-grid");
  grid.innerHTML = "";

  Object.entries(CAMPAIGN_CONFIG.locations).forEach(([locId, locObj]) => {
    const locName = locObj.name;
    const url  = `${base}?loc=${locId}`;
    const card = document.createElement("div");
    card.className = "qr-card";

    const qrDiv = document.createElement("div");
    qrDiv.id = `qr-${locId}`;

    card.innerHTML = `
      <p class="qr-loc-name">${locName} ${locObj.isHotspot ? '<span style="color:#ff4757;font-size:0.75rem;background:#ffeaa7;padding:0.15rem 0.3rem;border-radius:4px;margin-left:5px;vertical-align:middle">🔥명당</span>' : ''}</p>
      <p class="qr-loc-url">${url}</p>
      <button onclick="downloadQR('${locId}','${locName}')" class="btn btn-outline btn-sm" style="margin-top:0.5rem">⬇ 다운로드</button>`;

    card.insertBefore(qrDiv, card.firstChild);
    grid.appendChild(card);

    new QRCode(qrDiv, { text: url, width: 150, height: 150, colorDark: "#000000", colorLight: "#ffffff" });
  });
}

function downloadQR(locId, locName) {
  const canvas = document.querySelector(`#qr-${locId} canvas`);
  if (!canvas) { showToast("QR 생성 중입니다. 잠시 후 다시 시도해주세요.", "warning"); return; }
  const link = document.createElement("a");
  link.download = `QR_${locName}.png`;
  link.href = canvas.toDataURL("image/png");
  link.click();
}

// ===== 이미지 모달 =====
function openModal(src) {
  const modal = document.getElementById("image-modal");
  document.getElementById("modal-img").src = src;
  modal.classList.remove("hidden");
  setTimeout(() => { modal.style.opacity = "1"; modal.style.pointerEvents = "auto"; }, 10);
}

function closeModal() {
  const modal = document.getElementById("image-modal");
  modal.style.opacity = "0"; modal.style.pointerEvents = "none";
  setTimeout(() => modal.classList.add("hidden"), 200);
}

// ===== 학부 소식 (Notice) 관리 =====
async function loadNotices() {
  const tbody = document.getElementById("notices-tbody");
  if (!tbody) return;
  try {
    const snap = await db.collection("notices").orderBy("createdAt", "desc").get();
    if (snap.empty) {
      tbody.innerHTML = `<tr><td colspan="4" style="text-align:center;color:var(--text-secondary)">등록된 소식이 없습니다.</td></tr>`;
      return;
    }
    tbody.innerHTML = snap.docs.map(doc => {
      const data = doc.data();
      return `<tr>
        <td><span style="display:inline-block;padding:0.2rem 0.5rem;background:rgba(57,211,83,0.1);color:var(--green);font-size:0.75rem;border-radius:4px;font-weight:600">${data.type || '공지'}</span></td>
        <td>${data.title}</td>
        <td>${data.date}</td>
        <td>
          <div style="display:flex;gap:0.25rem;">
            <button onclick="openEditNotice('${doc.id}')" class="btn btn-secondary btn-sm">수정</button>
            <button onclick="deleteNotice('${doc.id}')" class="btn btn-danger btn-sm">삭제</button>
          </div>
        </td>
      </tr>`;
    }).join("");
  } catch (e) {
    console.error("Error loading notices:", e);
    tbody.innerHTML = `<tr><td colspan="4" style="text-align:center;color:red">소식을 불러오는 중 오류가 발생했습니다.</td></tr>`;
  }
}

async function addNotice() {
  const type = document.getElementById("notice-type").value.trim();
  const title = document.getElementById("notice-title").value.trim();
  const date = document.getElementById("notice-date").value.trim();
  const content = document.getElementById("notice-content")?.value.trim() || "";
  if (!title || !date) return alert("제목과 날짜를 입력해주세요.");

  try {
    await db.collection("notices").add({
      type: type || "공지",
      title: title,
      date: date,
      content: content,
      createdAt: firebase.firestore.FieldValue.serverTimestamp()
    });
    document.getElementById("modal-notice-add").classList.add("hidden");
    document.getElementById("notice-title").value = "";
    document.getElementById("notice-date").value = "";
    if(document.getElementById("notice-content")) document.getElementById("notice-content").value = "";
    showToast("소식이 등록되었습니다.", "success");
    loadNotices();
    loadDeptNotices();
  } catch (e) {
    console.error("Error adding notice:", e);
    showToast("오류가 발생했습니다.", "error");
  }
}

async function deleteNotice(id) {
  if (!confirm("이 소식을 정말 삭제하시겠습니까?")) return;
  try {
    await db.collection("notices").doc(id).delete();
    showToast("삭제되었습니다.", "info");
    loadNotices();
    loadDeptNotices();
  } catch (e) {
    console.error("Error deleting notice:", e);
    showToast("오류가 발생했습니다.", "error");
  }
}

async function openEditNotice(id) {
  try {
    const doc = await db.collection("notices").doc(id).get();
    if (!doc.exists) return alert("해당 소식을 찾을 수 없습니다.");
    const data = doc.data();
    document.getElementById("edit-notice-id").value = id;
    document.getElementById("edit-notice-type").value = data.type || "공지";
    document.getElementById("edit-notice-title").value = data.title || "";
    document.getElementById("edit-notice-date").value = data.date || "";
    document.getElementById("edit-notice-content").value = data.content || "";
    document.getElementById("modal-notice-edit").classList.remove("hidden");
  } catch (e) {
    console.error("Error fetching notice for edit:", e);
    showToast("소식을 불러오는 중 오류가 발생했습니다.", "error");
  }
}

async function saveNoticeEdit() {
  const id = document.getElementById("edit-notice-id").value;
  const type = document.getElementById("edit-notice-type").value.trim();
  const title = document.getElementById("edit-notice-title").value.trim();
  const date = document.getElementById("edit-notice-date").value.trim();
  const content = document.getElementById("edit-notice-content").value.trim();
  if (!title || !date) return alert("제목과 날짜를 입력해주세요.");

  try {
    await db.collection("notices").doc(id).update({
      type: type || "공지",
      title: title,
      date: date,
      content: content
    });
    document.getElementById("modal-notice-edit").classList.add("hidden");
    showToast("소식이 수정되었습니다.", "success");
    loadNotices();
    loadDeptNotices();
  } catch (e) {
    console.error("Error updating notice:", e);
    showToast("오류가 발생했습니다.", "error");
  }
}

// ===== 학부 일정 (Event) 관리 =====
async function loadEvents() {
  const tbody = document.getElementById("events-tbody");
  if (!tbody) return;
  try {
    const snap = await db.collection("events").orderBy("startDate", "desc").get();
    if (snap.empty) {
      tbody.innerHTML = `<tr><td colspan="5" style="text-align:center;color:var(--text-secondary)">등록된 일정이 없습니다.</td></tr>`;
      return;
    }
    tbody.innerHTML = snap.docs.map(doc => {
      const data = doc.data();
      return `<tr>
        <td style="font-weight:500"><span style="display:inline-block;width:10px;height:10px;border-radius:50%;background:${data.color || 'var(--green)'};margin-right:6px"></span>${data.title}</td>
        <td>${data.startDate}</td>
        <td>${data.endDate || '-'}</td>
        <td style="max-width:200px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${data.description || ''}</td>
        <td><button onclick="deleteEvent('${doc.id}')" class="btn btn-danger btn-sm">삭제</button></td>
      </tr>`;
    }).join("");
  } catch (e) {
    console.error("Error loading events:", e);
    tbody.innerHTML = `<tr><td colspan="5" style="text-align:center;color:red">일정을 불러오는 중 오류가 발생했습니다.</td></tr>`;
  }
}

async function addEvent() {
  const title = document.getElementById("event-title").value.trim();
  const start = document.getElementById("event-start").value;
  const end = document.getElementById("event-end").value;
  const desc = document.getElementById("event-desc").value.trim();
  const color = document.getElementById("event-color").value;
  
  if (!title || !start) return alert("일정명과 시작일은 필수입니다.");

  try {
    await db.collection("events").add({
      title: title,
      startDate: start,
      endDate: end || null,
      description: desc,
      color: color || "var(--green)",
      createdAt: firebase.firestore.FieldValue.serverTimestamp()
    });
    document.getElementById("modal-event-add").classList.add("hidden");
    document.getElementById("event-title").value = "";
    document.getElementById("event-start").value = "";
    document.getElementById("event-end").value = "";
    document.getElementById("event-desc").value = "";
    showToast("일정이 등록되었습니다.", "success");
    loadEvents();
  } catch (e) {
    console.error("Error adding event:", e);
    showToast("오류가 발생했습니다.", "error");
  }
}

async function deleteEvent(id) {
  if (!confirm("이 일정을 정말 삭제하시겠습니까?")) return;
  try {
    await db.collection("events").doc(id).delete();
    showToast("삭제되었습니다.", "info");
    loadEvents();
  } catch (e) {
    console.error("Error deleting event:", e);
    showToast("오류가 발생했습니다.", "error");
  }
}

document.addEventListener("DOMContentLoaded", initAdmin);



// ===== 학부 소식 (Dept Notice) 관리 =====
async function loadDeptNotices() {
  const tbody = document.getElementById("dept-notices-tbody");
  if(!tbody) return;
  try {
    const snap = await db.collection("dept_notices").orderBy("createdAt", "desc").get();
    if(snap.empty) {
      tbody.innerHTML = `<tr><td colspan="4" style="text-align:center;color:var(--text-secondary)">등록된 학부 소식이 없습니다.</td></tr>`;
      return;
    }
    tbody.innerHTML = snap.docs.map(doc => {
      const d = doc.data();
      const safeTitle = (d.title || '').replace(/'/g, "\\'").replace(/"/g, '&quot;');
      const encodedContent = encodeURIComponent(d.content || '');
      return `
        <tr>
          <td><span style="background:rgba(57,211,83,0.1);color:var(--green);padding:0.2rem 0.5rem;border-radius:4px;font-size:0.75rem;font-weight:600">${d.type||'안내'}</span></td>
          <td>${d.title}</td>
          <td>${d.date}</td>
          <td>
            <button onclick="editDeptNotice('${doc.id}', '${d.type||'안내'}', '${safeTitle}', '${d.date}', '${encodedContent}')" class="btn btn-secondary btn-sm" style="padding:0.25rem 0.5rem;margin-right:0.25rem">수정</button>
            <button onclick="deleteDeptNotice('${doc.id}')" class="btn btn-secondary btn-sm" style="padding:0.25rem 0.5rem;color:red;border-color:red">삭제</button>
          </td>
        </tr>
      `;
    }).join("");
  } catch(e) {
    console.error(e);
    tbody.innerHTML = `<tr><td colspan="4" style="text-align:center;color:red">불러오기 오류</td></tr>`;
  }
}

window.addDeptNotice = async function() {
  const type = document.getElementById("new-dept-notice-type").value.trim() || '안내';
  const title = document.getElementById("new-dept-notice-title").value.trim();
  const content = document.getElementById("new-dept-notice-content").value.trim();
  
  if(!title) {
    alert("제목을 입력해주세요.");
    return;
  }
  
  const today = new Date();
  const dateStr = `${today.getFullYear()}.${String(today.getMonth()+1).padStart(2,'0')}.${String(today.getDate()).padStart(2,'0')}`;
  
  try {
    await db.collection("dept_notices").add({
      type, title, content, date: dateStr, createdAt: firebase.firestore.FieldValue.serverTimestamp()
    });
    document.getElementById("new-dept-notice-title").value = '';
    document.getElementById("new-dept-notice-content").value = '';
    document.getElementById("modal-dept-notice-add").classList.add("hidden");
    loadDeptNotices();
  } catch(e) {
    alert("오류 발생");
    console.error(e);
  }
}

window.editDeptNotice = function(id, type, title, date, encodedContent) {
  document.getElementById("edit-dept-notice-id").value = id;
  document.getElementById("edit-dept-notice-type").value = type;
  document.getElementById("edit-dept-notice-title").value = title;
  document.getElementById("edit-dept-notice-date").value = date;
  document.getElementById("edit-dept-notice-content").value = decodeURIComponent(encodedContent);
  document.getElementById("modal-dept-notice-edit").classList.remove("hidden");
};

window.saveEditDeptNotice = async function() {
  const id = document.getElementById("edit-dept-notice-id").value;
  const type = document.getElementById("edit-dept-notice-type").value.trim();
  const title = document.getElementById("edit-dept-notice-title").value.trim();
  const date = document.getElementById("edit-dept-notice-date").value.trim();
  const content = document.getElementById("edit-dept-notice-content").value.trim();

  if(!title) return alert("제목을 입력해주세요.");

  try {
    await db.collection("dept_notices").doc(id).update({ type, title, date, content });
    document.getElementById("modal-dept-notice-edit").classList.add("hidden");
    loadDeptNotices();
  } catch(e) {
    console.error(e);
    alert("수정 오류");
  }
}

window.deleteDeptNotice = async function(id) {
  if(!confirm("정말 삭제하시겠습니까?")) return;
  try {
    await db.collection("dept_notices").doc(id).delete();
    loadDeptNotices();
  } catch(e) {
    alert("삭제 오류");
    console.error(e);
  }
}
