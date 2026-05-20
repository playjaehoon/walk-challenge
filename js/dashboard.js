// ============================================================
// dashboard.js — 내 기록 페이지
// ============================================================

async function initDashboard() {
  const user = await requireAuth();
  if (!user) return;

  const urlParams = new URLSearchParams(window.location.search);
  const targetUid = urlParams.get('uid');
  let viewUid = user.uid;

  if (targetUid) {
    if (typeof ADMIN_EMAILS !== 'undefined' && ADMIN_EMAILS.includes(user.email)) {
      viewUid = targetUid;
    } else {
      showToast("다른 사용자의 기록을 볼 권한이 없습니다.", "error");
      return;
    }
  }

  document.getElementById("dashboard-loading").classList.add("hidden");
  document.getElementById("dashboard-content").classList.remove("hidden");

  const data = await getUserData(viewUid);
  if (!data) { showToast("사용자 정보를 불러올 수 없습니다.", "error"); return; }

  // 관리자 모드인 경우 헤더에 표시
  if (targetUid) {
    document.getElementById("dash-name").innerHTML = `<span style="color:var(--red)">[관리자 모드]</span> ${data.name}`;
  } else {
    document.getElementById("dash-name").textContent = data.name;
  }

  renderProfile(data);
  await renderTodayStatus(viewUid);
  await renderScanStats(viewUid);
  await renderScanHistory(viewUid);
  await renderProofStatus(viewUid);
  renderCollection(data);
}

function renderProfile(data) {
  const score = data.totalScore || 0;
  const tier  = getTier(score);

  // dash-name은 위에서 미리 처리했으므로 건너뜀 (관리자 모드 표시 유지 위해)
  document.getElementById("dash-nickname").textContent  = data.nickname ? `(닉네임: ${data.nickname})` : '';
  document.getElementById("dash-student-id").textContent = data.studentId;
  document.getElementById("dash-dept").textContent      = data.department;
  document.getElementById("dash-score").textContent     = score;
  document.getElementById("dash-scan-count").textContent = data.scanCount || 0;
  document.getElementById("dash-tier-text").textContent  = `${tier.emoji} ${tier.name}`;

  // 티어 진행 바
  const { bronze, silver, gold } = CAMPAIGN_CONFIG.scoreThresholds;
  let progress = 0, nextLabel = "", nextScore = bronze;

  if (score >= gold) {
    progress = 100; nextLabel = "최고 등급 달성! 🏆";
  } else if (score >= silver) {
    progress = ((score - silver) / (gold   - silver)) * 100;
    nextLabel = `골드까지 ${gold - score}pt`; nextScore = gold;
  } else if (score >= bronze) {
    progress = ((score - bronze) / (silver - bronze)) * 100;
    nextLabel = `실버까지 ${silver - score}pt`; nextScore = silver;
  } else {
    progress = (score / bronze) * 100;
    nextLabel = `브론즈까지 ${bronze - score}pt`;
  }

  document.getElementById("tier-next-label").textContent = nextLabel;
  document.getElementById("progress-fill").style.width   = `${Math.min(100, progress)}%`;
  document.getElementById("tier-score-cur").textContent  = `${score}pt`;
  document.getElementById("tier-score-max").textContent  = score >= gold ? "MAX" : `목표 ${nextScore}pt`;
}

async function renderTodayStatus(uid) {
  const today = getKSTDateString();
  const snap  = await db.collection("users").doc(uid).collection("scans")
    .where("dateStr", "==", today).get();

  const count = snap.docs.length;
  const max   = CAMPAIGN_CONFIG.maxScansPerDay;

  document.getElementById("today-count").textContent = `${count}/${max}`;
  for (let i = 1; i <= max; i++) {
    const dot = document.getElementById(`scan-dot-${i}`);
    if (dot && i <= count) dot.classList.add("used");
  }
  document.getElementById("today-status-text").textContent =
    count >= max
      ? "오늘 스캔 완료! 내일 다시 도전하세요 🎉"
      : `오늘 ${max - count}번 더 스캔할 수 있어요!`;
}

async function renderScanHistory(uid) {
  const snap = await db.collection("users").doc(uid).collection("scans")
    .orderBy("createdAt", "desc").limit(10).get();

  const tbody = document.getElementById("scan-history-body");
  if (snap.empty) {
    tbody.innerHTML = `<tr><td colspan="4" style="text-align:center;padding:2rem;color:var(--text-secondary)">아직 스캔 기록이 없어요. QR코드를 찾아보세요! 🔍</td></tr>`;
    return;
  }
  tbody.innerHTML = snap.docs.map((doc) => {
    const d = doc.data();
    return `<tr>
      <td>${formatDate(d.createdAt)}</td>
      <td>${d.locationName || d.locationId}</td>
      <td><span class="rarity-badge rarity-${d.rarity}">${d.rarityName}</span></td>
      <td style="color:var(--green);font-weight:700;font-family:'Outfit',sans-serif">+${d.score}pt</td>
    </tr>`;
  }).join("");
}

async function renderProofStatus(uid) {
  const snap = await db.collection("users").doc(uid).collection("proofs").get();
  const proofMap = {};
  snap.docs.forEach((doc) => { proofMap[doc.data().week] = doc.data(); });

  const labels = { pending: "검토 중", approved: "승인됨", rejected: "반려됨" };
  [1, 2].forEach((week) => {
    const el    = document.getElementById(`proof-status-${week}`);
    const proof = proofMap[week];
    if (!el) return;

    if (!proof) {
      el.innerHTML = `<span class="proof-status-badge status-none">미제출</span>
        <a href="proof.html" class="btn btn-outline btn-sm" style="margin-left:0.75rem">제출하기</a>`;
    } else {
      const cls = `status-${proof.status}`;
      const scoreStr = proof.status === "approved" ? `<span style="color:var(--green);margin-left:0.5rem;font-size:0.85rem">+${proof.score}pt</span>` : "";
      el.innerHTML = `<span class="proof-status-badge ${cls}">${labels[proof.status]}</span>${scoreStr}`;
    }
  });
}

function renderCollection(data) {
  const col = data.collection || {};
  const container = document.getElementById("collection-grid");
  container.innerHTML = CAMPAIGN_CONFIG.rarityConfig.map((r) => {
    const cnt = col[r.nameEn] || 0;
    return `<div class="collection-item ${cnt > 0 ? "has-items" : ""}">
      <span class="ci-icon">${r.emoji}</span>
      <span class="ci-count" style="color:${r.color}">${cnt}</span>
      <span>${r.name}</span>
    </div>`;
  }).join("");
}

// ===== 개인정보 수정 =====
window.openProfileEditModal = async function() {
  const user = auth.currentUser;
  if (!user) return;
  const doc = await db.collection("users").doc(user.uid).get();
  if (!doc.exists) return;
  const data = doc.data();

  document.getElementById('edit-profile-name').value = data.name || '';
  document.getElementById('edit-profile-nickname').value = data.nickname || '';
  document.getElementById('edit-profile-studentId').value = data.studentId || '';
  document.getElementById('edit-profile-department').value = data.department || '';
  
  // 관리자 모달과 스타일 충돌이 있을 수 있으니 z-index 및 텍스트 색상 확인 (html에 반영됨)
  document.getElementById('modal-profile-edit').classList.remove('hidden');
};

window.saveProfileEdit = async function() {
  const user = auth.currentUser;
  if (!user) return;
  
  const name = document.getElementById('edit-profile-name').value.trim();
  const nickname = document.getElementById('edit-profile-nickname').value.trim();
  const studentId = document.getElementById('edit-profile-studentId').value.trim();
  const department = document.getElementById('edit-profile-department').value.trim();

  if (!name || !studentId || !department) {
    showToast("이름, 학번, 학과는 필수 입력 항목입니다.", "error");
    return;
  }

  try {
    await db.collection("users").doc(user.uid).update({
      name: name,
      nickname: nickname,
      studentId: studentId,
      department: department
    });
    
    showToast("개인정보가 성공적으로 수정되었습니다.", "success");
    document.getElementById('modal-profile-edit').classList.add('hidden');
    initDashboard(); // 리로드
  } catch (e) {
    console.error("Profile update error:", e);
    showToast("수정 중 오류가 발생했습니다.", "error");
  }
};

async function renderScanStats(uid) {
  try {
    const scansSnap = await db.collection("users").doc(uid).collection("scans").get();
    
    let regularCount = 0;
    let specialCount = 0;
    let easterEggCount = 0;
    let rainyBonusCount = 0;

    scansSnap.forEach((doc) => {
      const s = doc.data();
      if (s.locationId === "easter_egg") {
        easterEggCount++;
      } else if (s.locationId === "rainy_day_bonus") {
        rainyBonusCount++;
      } else if (CAMPAIGN_CONFIG.locations[s.locationId]?.isHotspot) {
        specialCount++;
      } else {
        regularCount++;
      }
    });

    document.getElementById("stat-regular-count").textContent = `${regularCount}회`;
    document.getElementById("stat-special-count").textContent = `${specialCount}회`;
    document.getElementById("stat-egg-count").textContent = `${easterEggCount}회`;
    document.getElementById("stat-rain-count").textContent = `${rainyBonusCount}회`;
  } catch (err) {
    console.error("Failed to render scan stats:", err);
  }
}

document.addEventListener("DOMContentLoaded", initDashboard);

