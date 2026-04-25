// ============================================================
// firebase-config.js — Firebase 설정 및 캠페인 상수
// ============================================================
// ⚠️  아래 firebaseConfig 값들을 Firebase Console에서 복사해 교체하세요.
// Firebase Console → 프로젝트 설정 → 앱 추가(웹) → SDK snippet 복사
// ============================================================

const firebaseConfig = {
  apiKey: "AIzaSyBiupqaTqmfaEw2_M9zoAEhU_PuDlVcLuA",
  authDomain: "walk-challenge-b35e2.firebaseapp.com",
  projectId: "walk-challenge-b35e2",
  storageBucket: "walk-challenge-b35e2.firebasestorage.app",
  messagingSenderId: "834546390741",
  appId: "1:834546390741:web:35df83e35f9e06180a745c",
  measurementId: "G-FWBNFRSW7C"
};

// Firebase 초기화
firebase.initializeApp(firebaseConfig);
const auth = firebase.auth();
const db = firebase.firestore();
const storage = firebase.storage();

// ============================================================
// 관리자 이메일 목록 — 이 이메일들로 로그인하면 /admin 접근 가능
// ============================================================
const ADMIN_EMAILS = [
  "playjaehoon@gmail.com",
  "aay0909@hufs.ac.kr", // 여기에 두 번째 관리자 이메일 입력
  "ddaltwo9@gmail.com"  // 여기에 세 번째 관리자 이메일 입력
];

// ============================================================
// 캠페인 설정 — 여기서 모든 수치를 쉽게 조정할 수 있습니다
// ============================================================
const CAMPAIGN_CONFIG = {
  startDate: new Date("2026-04-24T00:00:00+09:00"),
  endDate: new Date("2026-05-31T23:59:59+09:00"),
  maxScansPerDay: 3,
  totalLocations: 15,

  // 달성 기준 점수
  // 브론즈 200pt / 실버 450pt / 골드 800pt
  scoreThresholds: {
    bronze: 200,  // 브론즈
    silver: 450,  // 실버
    gold: 800,  // 골드
  },

  // 기본 희귀도 설정 (4단계)
  // 평균 점수 계산: 10x55% + 20x30% + 35x10% + 50x5% = 5.5+6+3.5+2.5 = 약 17.5pt/회
  rarityConfig: [
    { name: "일반", nameEn: "common", emoji: "⬜", probability: 55, score: 10, color: "#9ca3af" },
    { name: "레어", nameEn: "rare", emoji: "🟩", probability: 30, score: 15, color: "#22c55e" },
    { name: "에픽", nameEn: "epic", emoji: "🟪", probability: 10, score: 20, color: "#c084fc" },
    { name: "전설", nameEn: "legendary", emoji: "🟨", probability: 5, score: 50, color: "#fbbf24" },
  ],

  // 핫스팟 전용 희귀도 설정 (일반 등급 0%, 에픽/전설 확률 대폭 상승)
  hotspotRarityConfig: [
    { name: "레어", nameEn: "rare", emoji: "🟩", probability: 50, score: 20, color: "#22c55e" },
    { name: "에픽", nameEn: "epic", emoji: "🟪", probability: 30, score: 35, color: "#c084fc" },
    { name: "전설", nameEn: "legendary", emoji: "🟨", probability: 20, score: 50, color: "#fbbf24" },
  ],

  // QR 코드 위치 및 GPS 정보
  // * lat: 위도, lng: 경도, radius: 허용 반경(미터)
  // * 구글 지도 우클릭을 통해 각 위치의 위도/경도를 찾아 입력하세요. (기본값은 한국외대 글로벌캠퍼스 근방)
  locations: {
    loc01: { name: "글스산 과 사무실", lat: 37.3364, lng: 127.2655, radius: 200, isHotspot: true }, // 핫스팟 세팅
    loc02: { name: "e스포츠 실습실", lat: 37.3375, lng: 127.2666, radius: 200 },
    loc03: { name: "인문경상관", lat: 37.3380, lng: 127.2670, radius: 200 },
    loc04: { name: "교양관", lat: 37.3390, lng: 127.2680, radius: 200 },
    loc05: { name: "공학관", lat: 37.3370, lng: 127.2660, radius: 200 },
    loc06: { name: "백년관", lat: 37.3368, lng: 127.2658, radius: 200 },
    loc07: { name: "자연과학관", lat: 37.3400, lng: 127.2690, radius: 200 },
    loc08: { name: "학생회관", lat: 37.3385, lng: 127.2675, radius: 200 },
    loc09: { name: "기숙사", lat: 37.3382, lng: 127.2672, radius: 200 },
    loc10: { name: "명수당", lat: 37.3395, lng: 127.2685, radius: 200 },
    loc11: { name: "예비 1", lat: 37.3380, lng: 127.2660, radius: 200 },
    loc12: { name: "예비 2", lat: 37.3380, lng: 127.2660, radius: 200 },
    loc13: { name: "예비 3", lat: 37.3380, lng: 127.2660, radius: 200 },
    loc14: { name: "예비 4", lat: 37.3380, lng: 127.2660, radius: 200 },
    loc15: { name: "예비 5", lat: 37.3380, lng: 127.2660, radius: 200 },
    master: { name: "✅ 프리패스 마스터키", isMaster: true } // GPS 검사를 무시하는 특별 코드
  },
};

