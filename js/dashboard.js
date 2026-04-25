// ============================================================
// dashboard.js — 내 기록 페이지
// ============================================================

async function initDashboard() {
  const user = await requireAuth();
  if (!user) return;

  document.getElementById("dashboard-loading").classList.add("hidden");
  document.getElementById("dashboard-content").classList.remove("hidden");

  const data = await getUserData(user.uid);
  if (!data) { showToast("사용자 정보를 불러올 수 없습니다.", "error"); return; }

  renderProfile(data);
  await renderTodayStatus(user.uid);
  await renderScanHistory(user.uid);
  await renderProofStatus(user.uid);
  renderCollection(data);
}

function renderProfile(data) {
  const score = data.totalScore || 0;
  const tier  = getTier(score);

  document.getElementById("dash-name").textContent      = data.name;
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

document.addEventListener("DOMContentLoaded", initDashboard);

