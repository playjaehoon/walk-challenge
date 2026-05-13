// ============================================================
// admin.js — 관리자 대시보드
// ============================================================

async function initAdmin() {
  const user = await requireAdmin();
  if (!user) return;

  document.getElementById("admin-loading").classList.add("hidden");
  document.getElementById("admin-content").classList.remove("hidden");

  setupTabs();
  await Promise.all([loadStats(), loadUsers(), loadPendingProofs(), loadCompletedProofs(), loadNotices(), loadEvents()]);
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
  const users = snap.docs.map((d) => d.data());
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
}

// ===== 전체 사용자 =====
async function loadUsers() {
  const snap = await db.collection("users").orderBy("totalScore", "desc").get();
  const users = snap.docs.map((d, i) => ({ rank: i + 1, id: d.id, ...d.data() }));

  const tbody = document.getElementById("users-tbody");
  tbody.innerHTML = users.map((u) => {
    const tier = getTier(u.totalScore || 0);
    return `<tr>
      <td>${u.rank}</td>
      <td>${u.name}</td>
      <td>${u.studentId}</td>
      <td>${u.department}</td>
      <td style="color:var(--green);font-weight:700;font-family:'Outfit',sans-serif">${u.totalScore || 0}pt</td>
      <td>${tier.emoji} ${tier.name}</td>
      <td>
        <button onclick="openUserEdit('${u.id}', '${u.name}', '${u.studentId}', '${u.department}', ${u.totalScore || 0})" class="btn btn-secondary btn-sm">편집</button>
      </td>
    </tr>`;
  }).join("");
}

// ===== 사용자 편집/삭제 =====
window.openUserEdit = function(id, name, studentId, department, score) {
  document.getElementById('edit-user-id').value = id;
  document.getElementById('edit-user-name').value = name;
  document.getElementById('edit-user-studentId').value = studentId;
  document.getElementById('edit-user-department').value = department;
  document.getElementById('edit-user-score').value = score;
  document.getElementById('modal-user-edit').classList.remove('hidden');
};

window.saveUserEdit = async function() {
  const id = document.getElementById('edit-user-id').value;
  const name = document.getElementById('edit-user-name').value;
  const studentId = document.getElementById('edit-user-studentId').value;
  const department = document.getElementById('edit-user-department').value;
  const score = parseInt(document.getElementById('edit-user-score').value) || 0;

  try {
    await db.collection("users").doc(id).update({
      name: name,
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
  const base = window.location.origin + window.location.pathname.replace("admin.html", "") + "scan.html";
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
        <td><button onclick="deleteNotice('${doc.id}')" class="btn btn-danger btn-sm">삭제</button></td>
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
  } catch (e) {
    console.error("Error deleting notice:", e);
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

