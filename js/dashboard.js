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

  // 모든 참가자 리스트 가져와 순위 및 커트라인 점수 계산 (운영진/테스트 제외)
  const usersSnap = await db.collection("users").orderBy("totalScore", "desc").get();
  const users = usersSnap.docs
    .map((d) => ({ id: d.id, ...d.data() }))
    .filter(u => {
      if (u.email && typeof ADMIN_EMAILS !== 'undefined' && ADMIN_EMAILS.includes(u.email)) return false;
      const n = (u.name || '').toLowerCase();
      const e = (u.email || '').toLowerCase();
      if (n.includes('test') || e.includes('test')) return false;
      return true;
    });

  // 관리자 모드인 경우 헤더에 표시
  if (targetUid) {
    document.getElementById("dash-name").innerHTML = `<span style="color:var(--red)">[관리자 모드]</span> ${data.name}`;
  } else {
    document.getElementById("dash-name").textContent = data.name;
  }

  renderProfile(data, users, viewUid);
  await renderTodayStatus(viewUid);
  await renderScanStats(viewUid);
  await renderScanHistory(viewUid);
  await renderProofStatus(viewUid);
  renderCollection(data);
}

function renderProfile(data, users, viewUid) {
  const score = data.totalScore || 0;
  const total = users.length;
  const userIndex = users.findIndex(u => u.id === viewUid);
  const rank = userIndex !== -1 ? userIndex + 1 : total + 1;
  const tier = getTierByRank(rank, total, score);

  // dash-name은 위에서 미리 처리했으므로 건너뜀 (관리자 모드 표시 유지 위해)
  document.getElementById("dash-nickname").textContent  = data.nickname ? `(닉네임: ${data.nickname})` : '';
  document.getElementById("dash-student-id").textContent = data.studentId;
  document.getElementById("dash-dept").textContent      = data.department;
  document.getElementById("dash-score").textContent     = score;
  document.getElementById("dash-scan-count").textContent = data.scanCount || 0;
  
  // 등수와 티어 표시
  document.getElementById("dash-tier-text").innerHTML = `${tier.emoji} ${tier.name} <span style="font-size:0.8rem;color:var(--text-secondary);font-weight:400;margin-left:4px;">(${rank}위 / 전체 ${total}명)</span>`;

  // 티어 진행 바 및 커트라인 점수 계산
  const goldTop = CAMPAIGN_CONFIG.goldTopN || 10;
  const silverTop = Math.ceil(total * (CAMPAIGN_CONFIG.silverTopPercent || 50) / 100);
  const bronze = CAMPAIGN_CONFIG.scoreThresholds.bronze || 200;

  // 골드 커트라인 (10위 점수)
  const goldUser = users[Math.min(goldTop, total) - 1];
  const goldCutline = goldUser ? (goldUser.totalScore || 0) : 0;

  // 실버 커트라인 (30위 점수)
  const silverUser = users[Math.min(silverTop, total) - 1];
  const silverCutline = silverUser ? (silverUser.totalScore || 0) : 0;

  let progress = 0, nextLabel = "", nextScore = bronze;

  if (tier.cls === "gold") {
    progress = 100;
    nextLabel = "최고 등급 달성! 🏆";
    nextScore = score;
  } else if (tier.cls === "silver") {
    const diff = goldCutline - score;
    nextLabel = `골드까지 ${diff > 0 ? diff : 0}pt 필요 (골드 커트라인: ${goldCutline}pt)`;
    nextScore = goldCutline;
    progress = goldCutline > silverCutline ? ((score - silverCutline) / (goldCutline - silverCutline)) * 100 : 0;
  } else if (tier.cls === "bronze") {
    const diff = silverCutline - score;
    nextLabel = `실버까지 ${diff > 0 ? diff : 0}pt 필요 (실버 커트라인: ${silverCutline}pt)`;
    nextScore = silverCutline;
    progress = silverCutline > bronze ? ((score - bronze) / (silverCutline - bronze)) * 100 : 0;
  } else {
    progress = (score / bronze) * 100;
    nextLabel = `브론즈까지 ${bronze - score}pt 필요`;
    nextScore = bronze;
  }

  document.getElementById("tier-next-label").textContent = nextLabel;
  document.getElementById("progress-fill").style.width   = `${Math.min(100, Math.max(0, progress))}%`;
  document.getElementById("tier-score-cur").textContent  = `${score}pt`;
  document.getElementById("tier-score-max").textContent  = tier.cls === "gold" ? "MAX" : `목표 ${nextScore}pt`;
}

async function renderTodayStatus(uid) {
  const today = getKSTDateString();
  const snap  = await db.collection("users").doc(uid).collection("scans")
    .where("dateStr", "==", today).get();

  // 일반 스캔만 필터링 (이스터에그, 우천 보너스, Special QR 제외)
  const regularScans = snap.docs.filter((doc) => {
    const s = doc.data();
    if (s.locationId === "easter_egg" || s.locationId === "rainy_day_bonus" || s.locationId === "master") return false;
    if (CAMPAIGN_CONFIG.locations[s.locationId]?.isHotspot) return false;
    return true;
  });

  const count = regularScans.length;
  const max   = CAMPAIGN_CONFIG.maxScansPerDay;

  document.getElementById("today-count").textContent = `${count}/${max}`;
  
  // 모든 도트 상태 초기화 후 색상 입히기
  for (let i = 1; i <= max; i++) {
    const dot = document.getElementById(`scan-dot-${i}`);
    if (dot) {
      dot.classList.remove("used");
      if (i <= count) {
        dot.classList.add("used");
      }
    }
  }

  document.getElementById("today-status-text").textContent =
    count >= max
      ? "오늘 일반 스캔 완료! 내일 다시 도전하세요 🎉"
      : `오늘 ${max - count}번 더 일반 스캔할 수 있어요!`;
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

