// ============================================================
// app.js — 공통 유틸리티 (모든 페이지에서 공유)
// ============================================================

// ===== Toast 알림 =====
function showToast(message, type = "info", duration = 3000) {
  let container = document.getElementById("toast-container");
  if (!container) {
    container = document.createElement("div");
    container.id = "toast-container";
    container.className = "toast-container";
    document.body.appendChild(container);
  }
  const icons = { success: "✅", error: "❌", info: "ℹ️", warning: "⚠️" };
  const toast = document.createElement("div");
  toast.className = `toast ${type}`;
  toast.innerHTML = `<span>${icons[type] || "💬"}</span><span>${message}</span>`;
  container.appendChild(toast);
  setTimeout(() => toast.remove(), duration);
}

// ===== KST 날짜 문자열 (YYYY-MM-DD) =====
function getKSTDateString(date = new Date()) {
  const kst = new Date(date.getTime() + 9 * 60 * 60 * 1000);
  return kst.toISOString().slice(0, 10);
}

// ===== 타임스탬프 포맷 =====
function formatDate(timestamp) {
  if (!timestamp) return "-";
  const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
  return date.toLocaleDateString("ko-KR", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" });
}

// ===== 캠페인 활성 여부 =====
function isCampaignActive() {
  const now = new Date();
  return now >= CAMPAIGN_CONFIG.startDate && now <= CAMPAIGN_CONFIG.endDate;
}

// ===== 랜덤 희귀도 추첨 =====
function drawRarity(locationId) {
  const locObj = locationId ? CAMPAIGN_CONFIG.locations[locationId] : null;
  const configArray = (locObj && locObj.isHotspot && CAMPAIGN_CONFIG.hotspotRarityConfig)
                        ? CAMPAIGN_CONFIG.hotspotRarityConfig
                        : CAMPAIGN_CONFIG.rarityConfig;

  const rand = Math.random() * 100;
  let cumulative = 0;
  for (const rarity of configArray) {
    cumulative += rarity.probability;
    if (rand < cumulative) return rarity;
  }
  return configArray[0];
}

// ===== 현재 로그인 사용자 (Promise) =====
function getCurrentUser() {
  return new Promise((resolve) => {
    const unsub = auth.onAuthStateChanged((user) => { unsub(); resolve(user); });
  });
}

// ===== 유저 데이터 =====
async function getUserData(uid) {
  const doc = await db.collection("users").doc(uid).get();
  return doc.exists ? { id: doc.id, ...doc.data() } : null;
}

// ===== 달성 티어 계산 =====
function getTier(score) {
  const { bronze, silver, gold } = CAMPAIGN_CONFIG.scoreThresholds;
  if (score >= gold)   return { name: "골드",   emoji: "🏆", cls: "gold",   threshold: gold };
  if (score >= silver) return { name: "실버",   emoji: "🥈", cls: "silver", threshold: silver };
  if (score >= bronze) return { name: "브론즈", emoji: "🥉", cls: "bronze", threshold: bronze };
  return                      { name: "도전 중", emoji: "🚶", cls: "none",   threshold: bronze };
}

// ===== 네비게이션 활성 표시 =====
function setActiveNav() {
  const path = window.location.pathname.split("/").pop() || "index.html";
  document.querySelectorAll(".nav-links a").forEach((link) => {
    const href = link.getAttribute("href");
    if (href && (href === path || (path === "" && href === "index.html"))) {
      link.classList.add("active");
    }
  });
}

// ===== 네비게이션 로그인 상태 =====
async function updateNavState() {
  const user = auth.currentUser;
  const guestEl = document.getElementById("nav-guest");
  const userEl  = document.getElementById("nav-user");
  if (!guestEl || !userEl) return;

  if (user) {
    guestEl.classList.add("hidden");
    userEl.classList.remove("hidden");
    const data = await getUserData(user.uid);
    if (data) {
      const nameEl  = document.getElementById("nav-name");
      const scoreEl = document.getElementById("nav-score");
      if (nameEl)  nameEl.textContent  = data.name;
      if (scoreEl) scoreEl.textContent = `${data.totalScore || 0}pt`;
    }
  } else {
    guestEl.classList.remove("hidden");
    userEl.classList.add("hidden");
  }
}

// ===== 로그아웃 =====
async function logout() {
  await auth.signOut();
  window.location.href = "index.html";
}

// ===== 인증 가드 =====
async function requireAuth(redirectTo = "login.html") {
  const user = await getCurrentUser();
  if (!user) {
    window.location.href = `${redirectTo}?redirect=${encodeURIComponent(window.location.href)}`;
    return null;
  }
  return user;
}

// ===== 관리자 가드 =====
async function requireAdmin() {
  const user = await requireAuth();
  if (!user) return null;
  if (!ADMIN_EMAILS.includes(user.email)) { window.location.href = "dashboard.html"; return null; }
  return user;
}

// ===== 모바일 메뉴 =====
function initMobileNav() {
  const toggle = document.getElementById("nav-toggle");
  const links  = document.getElementById("nav-links");
  if (toggle && links) {
    toggle.addEventListener("click", () => links.classList.toggle("mobile-open"));
    document.addEventListener("click", (e) => {
      if (!toggle.contains(e.target) && !links.contains(e.target)) {
        links.classList.remove("mobile-open");
      }
    });
  }
}

// ===== 공통 초기화 =====
document.addEventListener("DOMContentLoaded", () => {
  setActiveNav();
  initMobileNav();
  auth.onAuthStateChanged(() => updateNavState());
});

