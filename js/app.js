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
      
      // 이스터에그 등장 로직 체크 (서브페이지에서만)
      setTimeout(() => checkEasterEgg(data), 1500);
    }
    
    // 메인 페이지 자동 로그인 UX (CTA 버튼 변경)
    const heroBtn = document.getElementById("hero-cta-btn");
    if (heroBtn) {
      heroBtn.textContent = "내 대시보드로 가기 →";
      heroBtn.href = "dashboard.html";
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

// ===== 숨겨진 이스터에그 (특별 포인트) =====
function checkEasterEgg(userData) {
  const path = window.location.pathname;
  if (path.endsWith('/') || path.endsWith('index.html')) return;

  const now = new Date();
  if (now > CAMPAIGN_CONFIG.endDate) return;

  const lastTime = userData.lastEasterEggTime?.toDate 
    ? userData.lastEasterEggTime.toDate().getTime() 
    : (userData.lastEasterEggTime || 0);

  const ONE_WEEK_MS = 7 * 24 * 60 * 60 * 1000;
  
  if (!lastTime || (now.getTime() - lastTime) >= ONE_WEEK_MS) {
    // 30% 확률로 등장
    if (Math.random() > 0.3) return;

    if (document.getElementById("easter-egg-btn")) return;

    const randomNum = Math.floor(Math.random() * 18) + 1;
    const formattedNum = randomNum < 10 ? "0" + randomNum : randomNum.toString();
    const imgSrc = `assets/boo_png/${formattedNum}.png`;

    const egg = document.createElement("div");
    egg.id = "easter-egg-btn";
    
    const isTop = Math.random() > 0.5;
    const isLeft = Math.random() > 0.5;
    
    egg.style.cssText = `
      position: fixed;
      ${isTop ? 'top: 100px;' : 'bottom: 80px;'}
      ${isLeft ? 'left: 20px;' : 'right: 20px;'}
      width: 75px;
      height: 75px;
      z-index: 9999;
      cursor: pointer;
      animation: easter-egg-float 3.5s ease-in-out infinite, easter-egg-pop 0.6s cubic-bezier(0.175, 0.885, 0.32, 1.275);
    `;
    
    egg.innerHTML = `<img src="${imgSrc}" style="width:100%;height:100%;object-fit:contain;filter:drop-shadow(0 4px 8px rgba(0,0,0,0.4));">`;

    if (!document.getElementById("easter-egg-styles")) {
      const style = document.createElement("style");
      style.id = "easter-egg-styles";
      style.innerHTML = `
        @keyframes easter-egg-float {
          0% { transform: translateY(0) rotate(0deg); }
          50% { transform: translateY(-12px) rotate(8deg); }
          100% { transform: translateY(0) rotate(0deg); }
        }
        @keyframes easter-egg-pop {
          0% { transform: scale(0) rotate(-45deg); opacity: 0; }
          100% { transform: scale(1) rotate(0deg); opacity: 1; }
        }
        @keyframes easter-egg-hide {
          0% { transform: scale(1); opacity: 1; }
          100% { transform: scale(0) rotate(180deg) translateY(-50px); opacity: 0; }
        }
      `;
      document.head.appendChild(style);
    }

    egg.onclick = async () => {
      egg.style.pointerEvents = "none";
      egg.style.animation = "easter-egg-hide 0.6s forwards";
      
      try {
        const userRef = db.collection("users").doc(userData.id);
        await db.runTransaction(async (tx) => {
          const doc = await tx.get(userRef);
          tx.update(userRef, {
            totalScore: (doc.data().totalScore || 0) + 20,
            lastEasterEggTime: firebase.firestore.FieldValue.serverTimestamp()
          });
        });
        
        showToast("🎉 숨겨진 캐릭터를 찾았어요! 특별 포인트 +20pt", "success", 4000);
        
        const scoreEl = document.getElementById("nav-score");
        if (scoreEl) {
          const current = parseInt(scoreEl.textContent) || 0;
          scoreEl.textContent = `${current + 20}pt`;
          scoreEl.style.animation = "pulse-dot 0.5s";
        }
      } catch (e) {
        console.error("이스터에그 포인트 획득 실패:", e);
        showToast("오류가 발생했습니다.", "error");
      }
      
      setTimeout(() => egg.remove(), 600);
    };

    document.body.appendChild(egg);
  }
}

// ===== 공통 초기화 =====
document.addEventListener("DOMContentLoaded", () => {
  setActiveNav();
  initMobileNav();
  auth.onAuthStateChanged(() => updateNavState());
});

