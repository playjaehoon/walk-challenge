// ============================================================
// scan.js — QR 코드 스캔 처리 + 랜덤 희귀도 추첨
// ============================================================

let scanUser = null;
let scanLocationId = null;
let locName = "";
let scanRevealed = false;

async function initScanPage() {
  const params = new URLSearchParams(window.location.search);
  scanLocationId = params.get("loc");
  locName = ""; // 전역 변수 초기화

  // location 유효성 확인
  const locObj = CAMPAIGN_CONFIG.locations[scanLocationId];
  if (!scanLocationId || !locObj) {
    showScanMessage("❌", "유효하지 않은 QR", "올바른 QR코드를 스캔해주세요.", "error");
    return;
  }

  locName = locObj.name;
  document.getElementById("scan-location-name").textContent = locName;

  // 로그인 확인
  scanUser = await requireAuth();
  if (!scanUser) return;

  // 마스터키 처리 (날짜 및 위치 무시)
  if (locObj.isMaster) {
    await validateAndShowCard(locName);
    return;
  }

  // 캠페인 기간 확인
  const now = new Date();
  if (now < CAMPAIGN_CONFIG.startDate) {
    showScanMessage("📅", "아직 시작 전이에요!", "캠페인는 2026년 5월 18일부터 시작됩니다. 조금만 기다려주세요!", "info");
    return;
  }
  if (now > CAMPAIGN_CONFIG.endDate) {
    showScanMessage("🏁", "캠페인 종료", "2주간의 Walk & Point이 마무리되었습니다. 수고하셨어요! 🎉", "info");
    return;
  }

  // GPS 위치 검증 시작
  document.getElementById("scan-loading").innerHTML = `<div class="loading-spinner"></div><p>현재 위치 확인 중...</p><p style="font-size:0.75rem;color:var(--text-secondary);margin-top:0.5rem">GPS 위치 권한을 허용해주세요.</p>`;
  
  if (!navigator.geolocation) {
    showScanMessage("📵", "GPS 지원 안 됨", "이 브라우저에서는 위치 인증을 사용할 수 없습니다.", "error");
    return;
  }

  navigator.geolocation.getCurrentPosition(
    async (pos) => {
      const userLat = pos.coords.latitude;
      const userLng = pos.coords.longitude;
      const dist = calculateDistance(userLat, userLng, locObj.lat, locObj.lng);

      if (dist <= locObj.radius) {
        await validateAndShowCard(locName);
      } else {
        showScanMessage("🚫", "캠퍼스 밖입니다!", `현재 스캔 위치가 [${locName}] 반경 ${locObj.radius}m를 벗어났습니다.\n(현재 거리 편차: 약 ${Math.round(dist)}m)\n\n실제 캠퍼스 해당 위치로 이동해서 스캔해주세요!`, "error");
      }
    },
    (err) => {
      if (err.code === err.PERMISSION_DENIED) {
        showScanMessage("📍", "위치 권한 필요", "부정행위 방지를 위해 스캔 시 GPS 권한이 필수입니다.\n브라우저 설정에서 위치 권한을 허용하고 다시 시도해주세요.", "error");
      } else {
        showScanMessage("📡", "위치 확인 실패", "위치 정보를 가져올 수 없습니다. 인터넷 연결을 확인해주세요.", "error");
      }
    },
    { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
  );
}

// 두 좌표 간의 거리 계산 (Haversine Formula) - 반환값: 미터(m)
function calculateDistance(lat1, lon1, lat2, lon2) {
  const R = 6371e3; // 지구 반경 (미터)
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a = Math.sin(dLat/2) * Math.sin(dLat/2) +
            Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
            Math.sin(dLon/2) * Math.sin(dLon/2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
  return R * c;
}

async function validateAndShowCard(locName) {
  const today = getKSTDateString();
  const uid   = scanUser.uid;

  const scansSnap = await db.collection("users").doc(uid)
    .collection("scans")
    .where("dateStr", "==", today)
    .get();

  const todayScans = scansSnap.docs.map((d) => d.data());
  const alreadyHere = todayScans.some((s) => s.locationId === scanLocationId);

  if (alreadyHere) {
    showScanMessage("🔄", "이미 방문한 장소예요", `${locName}은(는) 오늘 이미 스캔했습니다.\n다른 장소 QR코드를 찾아보세요!`, "warning");
    return;
  }

  const isHotspotScan = CAMPAIGN_CONFIG.locations[scanLocationId]?.isHotspot === true;
  const regularScansCount = todayScans.filter((s) => {
    if (s.locationId === 'easter_egg' || s.locationId === 'master') return false;
    if (CAMPAIGN_CONFIG.locations[s.locationId]?.isHotspot) return false;
    return true;
  }).length;

  if (!isHotspotScan && regularScansCount >= CAMPAIGN_CONFIG.maxScansPerDay) {
    showScanMessage("⏰", "오늘 일반 스캔 완료!", `오늘 일반 스캔을 모두 완료했습니다!\n내일 다시 도전해주세요.\n(🔥 Special QR은 횟수 차감 없이 스캔 가능합니다)`, "warning");
    return;
  }

  // 5분 쿨다운 체크
  if (todayScans.length > 0) {
    const lastScan = todayScans.reduce((latest, scan) => {
      if (!scan.createdAt) return latest;
      const scanTime = scan.createdAt.toDate ? scan.createdAt.toDate().getTime() : new Date(scan.createdAt).getTime();
      return scanTime > latest ? scanTime : latest;
    }, 0);
    
    const nowMs = Date.now();
    const cooldownMs = (CAMPAIGN_CONFIG.scanCooldownMinutes || 5) * 60 * 1000;
    
    if (nowMs - lastScan < cooldownMs) {
      const remainingMin = Math.ceil((cooldownMs - (nowMs - lastScan)) / 60000);
      showScanMessage("⏳", "잠시 쉬어가세요!", `다음 스캔까지 약 ${remainingMin}분 남았습니다.`, "warning");
      return;
    }
  }

  // 유효 — 카드 표시
  document.getElementById("scan-loading").classList.add("hidden");
  
  if (isHotspotScan) {
    document.getElementById("scan-count-display").textContent = `🔥 Special QR 보너스 스캔! (일일 횟수 차감 없음)`;
  } else {
    const leftCount = CAMPAIGN_CONFIG.maxScansPerDay - (regularScansCount + 1);
    if (leftCount > 0) {
      document.getElementById("scan-count-display").textContent = `오늘 일반 스캔 ${regularScansCount + 1}회 완료! (앞으로 ${leftCount}회 남음 / Special QR은 횟수 차감 없음)`;
    } else {
      document.getElementById("scan-count-display").textContent = `오늘 일반 스캔 모두 완료! (내일 봬요 👋 단, Special QR은 횟수 차감 없음!)`;
    }
  }
  
  document.getElementById("scan-card-area").classList.remove("hidden");

  // 카드 클릭 이벤트
  document.getElementById("card-back-area").addEventListener("click", revealCard, { once: true });
  document.getElementById("flip-hint").classList.remove("hidden");
}

async function revealCard() {
  if (scanRevealed) return;
  scanRevealed = true;

  const rarity = drawRarity(scanLocationId);

  try {
    const uid   = scanUser.uid;
    const today = getKSTDateString();

    await db.runTransaction(async (tx) => {
      const userRef = db.collection("users").doc(uid);
      const userDoc = await tx.get(userRef);
      if (!userDoc.exists) throw new Error("유저 없음");

      const data = userDoc.data();
      const col  = data.collection || {};
      col[rarity.nameEn] = (col[rarity.nameEn] || 0) + 1;

      const scanRef = db.collection("users").doc(uid).collection("scans").doc();
      tx.set(scanRef, {
        locationId:   scanLocationId,
        locationName: locName,
        rarity:       rarity.nameEn,
        rarityName:   rarity.name,
        score:        rarity.score,
        dateStr:      today,
        createdAt:    firebase.firestore.FieldValue.serverTimestamp(),
      });
      tx.update(userRef, {
        totalScore: (data.totalScore || 0) + rarity.score,
        scanCount:  (data.scanCount  || 0) + 1,
        collection: col,
      });
    });

    animateCardReveal(rarity);
  } catch (err) {
    console.error(err);
    showToast("오류가 발생했습니다. 다시 시도해주세요.", "error");
    scanRevealed = false;
    document.getElementById("card-back-area").addEventListener("click", revealCard, { once: true });
  }
}

function animateCardReveal(rarity) {
  const cardFront = document.getElementById("card-front");
  const cardInner = document.getElementById("card-flip-inner");

  cardFront.className = `card-face card-front ${rarity.nameEn}`;
  cardFront.innerHTML = `
    <div class="card-rarity-icon">${rarity.emoji}</div>
    <div class="card-rarity-name" style="color:${rarity.color}">${rarity.name}</div>
    <span class="rarity-badge rarity-${rarity.nameEn}">${rarity.name}</span>
    <div class="card-rarity-score" style="color:${rarity.color}">+${rarity.score}</div>
    <div class="card-point-label">포인트 획득!</div>
  `;

  document.getElementById("flip-hint").classList.add("hidden");

  setTimeout(() => {
    cardInner.classList.add("flipped");

    if (rarity.nameEn === "legendary") spawnParticles();

    setTimeout(() => {
      const resultEl = document.getElementById("scan-result-info");
      resultEl.classList.remove("hidden");
      document.getElementById("result-rarity-badge").className = `rarity-badge rarity-${rarity.nameEn}`;
      document.getElementById("result-rarity-badge").textContent = rarity.name;
      document.getElementById("result-score").textContent = `+${rarity.score}pt`;
      
      // 랜덤 캐릭터 표시
      const booContainer = document.getElementById("boo-character-container");
      const booImg = document.getElementById("boo-character-img");
      if (booContainer && booImg) {
        const randomNum = Math.floor(Math.random() * 18) + 1;
        const formattedNum = randomNum < 10 ? "0" + randomNum : randomNum.toString();
        booImg.src = `assets/boo_png/${formattedNum}.png`;
        booContainer.classList.remove("hidden");
      }
    }, 950);
  }, 200);
}

function showScanMessage(emoji, title, msg, type) {
  document.getElementById("scan-loading").classList.add("hidden");
  const el = document.getElementById("scan-message");
  el.classList.remove("hidden");
  el.innerHTML = `
    <div style="font-size:3.5rem;margin-bottom:1rem">${emoji}</div>
    <h2 style="margin-bottom:0.75rem">${title}</h2>
    <p style="white-space:pre-line">${msg}</p>
    <a href="dashboard.html" class="btn btn-outline mt-3" style="margin-top:1.5rem">내 기록 보기</a>
  `;
}

function spawnParticles() {
  const emojis = ["🎉", "✨", "⭐", "🌟", "💫", "🔥"];
  for (let i = 0; i < 24; i++) {
    const p = document.createElement("div");
    p.style.cssText = `
      position:fixed;top:${10+Math.random()*80}vh;left:${Math.random()*100}vw;
      font-size:${1+Math.random()*1.5}rem;
      animation:float-p ${1+Math.random()*2}s ease-out forwards;
      pointer-events:none;z-index:9998;
    `;
    p.textContent = emojis[Math.floor(Math.random() * emojis.length)];
    document.body.appendChild(p);
    setTimeout(() => p.remove(), 3000);
  }
  if (!document.getElementById("float-p-style")) {
    const s = document.createElement("style");
    s.id = "float-p-style";
    s.textContent = `@keyframes float-p{0%{transform:translateY(0) scale(1);opacity:1}100%{transform:translateY(-180px) scale(0);opacity:0}}`;
    document.head.appendChild(s);
  }
}

document.addEventListener("DOMContentLoaded", initScanPage);

