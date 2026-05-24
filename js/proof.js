// ============================================================
// proof.js — 걷기 기록 인증 업로드
// ============================================================

let proofUser = null;
let selectedBase64Image = null;

async function initProofPage() {
  proofUser = await requireAuth();
  if (!proofUser) return;

  document.getElementById("proof-loading").classList.add("hidden");

  const now = new Date();
  const weeks = getAvailableWeeks();

  // 캠페인 시작 전이고 관리자가 아닌 경우 → 예쁜 안내화면 표시
  const preTestEnd = new Date("2026-05-18T00:00:00+09:00");
  if (now < preTestEnd && !ADMIN_EMAILS.includes(proofUser.email)) {
    document.getElementById("proof-page-header").classList.add("hidden");
    document.getElementById("pre-campaign-notice").classList.remove("hidden");
    return;
  }

  if (weeks.length === 0) {
    const msg = now < CAMPAIGN_CONFIG.startDate
      ? "캠페인 기간(5월 18일~31일)에만 걷기 인증을 제출할 수 있습니다."
      : "걷기 인증 제출 기간이 종료되었습니다.";
    document.getElementById("proof-main").innerHTML = `
      <div class="alert alert-info"><span>📅</span><span>${msg}</span></div>`;
    document.getElementById("proof-main").classList.remove("hidden");
    return;
  }

  // 주차 선택 드롭다운 옵션 추가
  const selectEl = document.getElementById("proof-week-select");
  if (selectEl) {
    selectEl.innerHTML = weeks.map(w => `<option value="${w.value}">${w.text}</option>`).join("");
    
    // URL 파라미터로 주차가 지정되어 있는지 확인
    const urlParams = new URLSearchParams(window.location.search);
    const targetWeek = urlParams.get('week');
    if (targetWeek && weeks.some(w => String(w.value) === targetWeek)) {
      selectEl.value = targetWeek;
    }

    // 주차 변경 시 중복 검사 리로드
    selectEl.addEventListener("change", () => {
      checkExisting(getCurrentWeek());
    });
  }

  const activeWeek = getCurrentWeek();
  document.getElementById("proof-main").classList.remove("hidden");
  setupFileUpload();
  setupRadioHighlight();
  await checkExisting(activeWeek);
}

function setupRadioHighlight() {
  document.querySelectorAll("input[name='walk-count']").forEach((radio) => {
    radio.addEventListener("change", () => {
      // 모두 초기화
      document.getElementById("label-3times").style.border = "2px solid var(--border)";
      document.getElementById("label-3times").style.background = "";
      document.getElementById("label-5times").style.border = "2px solid var(--border)";
      document.getElementById("label-5times").style.background = "";
      // 선택된 항목 강조
      const labelId = radio.value === "3" ? "label-3times" : "label-5times";
      document.getElementById(labelId).style.border = "2px solid var(--green)";
      document.getElementById(labelId).style.background = "var(--green-glow)";
    });
  });
}

function getAvailableWeeks() {
  const now = new Date();
  const weeks = [];
  
  // 1주차: 5/18 00:00:00 ~ 5/25 23:59:59 KST
  const w1Start = new Date("2026-05-18T00:00:00+09:00");
  const w1End = new Date("2026-05-25T23:59:59+09:00");
  if (now >= w1Start && now <= w1End) {
    weeks.push({ value: 1, text: "1주차" });
  }

  // 2주차: 5/25 00:00:00 ~ 6/1 23:59:59 KST
  const w2Start = new Date("2026-05-25T00:00:00+09:00");
  const w2End = new Date("2026-06-01T23:59:59+09:00");
  if (now >= w2Start && now <= w2End) {
    weeks.push({ value: 2, text: "2주차" });
  }

  // 사전 테스트: 5/18 이전 (또는 관리자용)
  if (now < w1Start) {
    weeks.push({ value: "사전 테스트", text: "사전 테스트" });
  }

  return weeks;
}

function getCurrentWeek() {
  const selectEl = document.getElementById("proof-week-select");
  if (!selectEl) return null;
  const val = selectEl.value;
  return val === "사전 테스트" ? "사전 테스트" : parseInt(val);
}

async function checkExisting(week) {
  const msgEl  = document.getElementById("already-submitted-msg");
  const formEl = document.getElementById("proof-form");
  
  // 상태 초기화
  msgEl.innerHTML = "";
  formEl.classList.remove("hidden");

  const snap = await db.collection("users").doc(proofUser.uid)
    .collection("proofs").where("week", "==", week).get();

  if (!snap.empty) {
    const proof  = snap.docs[0].data();
    const labels = { pending: "검토 중 ⏳", approved: "승인 완료 ✅", rejected: "반려됨 ❌" };

    if (proof.status === "rejected") {
      showToast("이전 제출이 반려되었습니다. 다시 제출해주세요.", "warning");
    } else {
      msgEl.innerHTML = `
        <div class="alert alert-info">
          <span>📋</span>
          <div>${week === "사전 테스트" ? "사전 테스트" : week + "주차"} 인증을 이미 제출했습니다. 현재 상태: <strong>${labels[proof.status]}</strong></div>
        </div>`;
      formEl.classList.add("hidden");
    }
  }
}

function setupFileUpload() {
  const box = document.getElementById("upload-box");
  const inp = document.getElementById("proof-img-input");
  if (!box || !inp) return;

  box.addEventListener("click", () => inp.click());
  inp.addEventListener("change", (e) => {
    if (e.target.files && e.target.files[0]) handleFile(e.target.files[0]);
  });

  const rmBtn = document.getElementById("remove-img-btn");
  if (rmBtn) rmBtn.addEventListener("click", removeFile);
}

function handleFile(file) {
  if (!file.type.startsWith("image/")) {
    showToast("이미지 파일만 업로드 가능합니다.", "error");
    return;
  }

  const reader = new FileReader();
  reader.onload = (e) => {
    const img = new Image();
    img.onload = () => {
      const MAX_WIDTH = 600;
      let width = img.width;
      let height = img.height;

      if (width > MAX_WIDTH) {
        height = Math.round((height * MAX_WIDTH) / width);
        width = MAX_WIDTH;
      }

      const canvas = document.createElement("canvas");
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext("2d");
      ctx.drawImage(img, 0, 0, width, height);

      selectedBase64Image = canvas.toDataURL("image/jpeg", 0.6);

      document.getElementById("image-preview").src = selectedBase64Image;
      document.getElementById("upload-box").classList.add("hidden");
      document.getElementById("preview-container").classList.remove("hidden");
    };
    img.src = e.target.result;
  };
  reader.readAsDataURL(file);
}

function removeFile() {
  selectedBase64Image = null;
  document.getElementById("proof-img-input").value = "";
  document.getElementById("upload-box").classList.remove("hidden");
  document.getElementById("preview-container").classList.add("hidden");
  document.getElementById("image-preview").src = "";
}

async function submitProof() {
  if (!selectedBase64Image) { showToast("스크린샷 사진을 첨부해주세요.", "error"); return; }

  // 달성 횟수 선택 확인
  const selectedCount = document.querySelector("input[name='walk-count']:checked");
  if (!selectedCount) { showToast("이번 주 1만 보 달성 횟수를 선택해주세요.", "error"); return; }

  const walkCount = parseInt(selectedCount.value); // 3 또는 5
  const score     = walkCount === 5 ? 150 : 100;
  const stepsLabel = walkCount === 5 ? "주 5회 1만보 이상 달성" : "주 3회 1만보 이상 달성";
  const stepsKey   = walkCount === 5 ? "10k_5times" : "10k_3times";

  const week = getCurrentWeek();
  if (!week) return;

  const btn = document.getElementById("submit-btn");
  btn.disabled = true; btn.textContent = "제출 중...";

  try {
    const uid      = proofUser.uid;
    const imageUrl = selectedBase64Image;

    await db.collection("users").doc(uid).collection("proofs").add({
      week, steps: stepsKey, stepsLabel, score,
      imageUrl, status: "pending",
      submittedAt: firebase.firestore.FieldValue.serverTimestamp(),
    });

    showToast(`인증이 제출되었습니다! 검토 후 ${score}pt가 반영됩니다. ✅`, "success", 4000);
    document.getElementById("proof-form").classList.add("hidden");
    document.getElementById("already-submitted-msg").innerHTML = `
      <div class="alert alert-success"><span>✅</span><span>${week === "사전 테스트" ? "사전 테스트" : week + "주차"} 인증 제출 완료! 검토 중입니다.</span></div>`;
  } catch (err) {
    console.error(err);
    showToast("제출 중 오류가 발생했습니다.", "error");
    btn.disabled = false; btn.textContent = "제출하기";
  }
}

// 초기 로드
document.addEventListener("DOMContentLoaded", () => {
  initProofPage();
});

