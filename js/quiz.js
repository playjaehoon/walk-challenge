// ============================================================
// quiz.js — 개발자 생일 기념 특별 퀴즈 로직
// ============================================================

const QUIZ_QUESTIONS = [
  {
    question: "1. Walk & Point 캠페인은 어떤 수업의 캡스톤 디자인 실습 프로젝트로 기획되었을까요?",
    options: ["스포츠미디어론", "스포츠비즈니스기획운영", "국제스포츠산업론", "스포츠재무관리와 회계"],
    correctIndex: 1
  },
  {
    question: "2. 본 캡스톤 프로젝트의 지도교수님 성함은 무엇일까요?",
    options: ["최재훈 교수", "이예훈 교수", "김외대 교수", "글로벌 교수"],
    correctIndex: 1
  },
  {
    question: "3. Walk & Point 캠페인에서 기본 달성 보상인 '브론즈' 티어를 획득하기 위한 최소 포인트 기준은 몇 pt 이상일까요?",
    options: ["100pt", "150pt", "200pt", "300pt"],
    correctIndex: 2
  },
  {
    question: "4. 글로벌스포츠산업학부에서 운영 중인 마이크로디그리(Microdegree)의 공식 명칭은 무엇일까요?",
    options: [
      "글로벌 스포츠 창업 전문가 마이크로디그리",
      "스포츠마케팅 분석가 마이크로디그리",
      "스포츠비즈니스 전략기획 및 운영 마이크로디그리",
      "스포츠 이벤트 관리 마이크로디그리"
    ],
    correctIndex: 2
  },
  {
    question: "5. 이 캠페인 웹사이트를 제작한 글로벌스포츠산업전공 23학번 개발자(최재훈)의 생일은 언제일까요?",
    options: ["5월 18일 (캠페인 시작일)", "5월 27일 (어문학관 특별 QR 시작일)", "5월 28일 (오늘)", "5월 31일 (캠페인 마감일)"],
    correctIndex: 2
  }
];

let currentUser = null;
let currentQuestionIndex = 0; // 0 ~ 4
let userAnswers = []; // 각 문제당 선택한 인덱스 기록

async function initQuiz() {
  // 로그인 검증
  currentUser = await requireAuth();
  if (!currentUser) return;

  try {
    // 퀴즈 중복 참여 여부 확인
    const quizSnap = await db.collection("users").doc(currentUser.uid)
      .collection("scans")
      .where("locationId", "==", "birthday_quiz")
      .get();

    if (!quizSnap.empty) {
      showToast("이미 이 퀴즈 이벤트를 완료하셨습니다!", "warning");
      setTimeout(() => {
        window.location.href = "dashboard.html";
      }, 1500);
      return;
    }

    // 로딩 해제, 소개창 노출
    document.getElementById("quiz-loading").classList.add("hidden");
    document.getElementById("quiz-card").classList.remove("hidden");

    // 이벤트 리스너
    document.getElementById("btn-quiz-start").addEventListener("click", startQuiz);
    document.getElementById("btn-quiz-next").addEventListener("click", nextQuestion);
  } catch (err) {
    console.error("Quiz init failed:", err);
    showToast("퀴즈 정보를 불러오는 과정에서 오류가 발생했습니다.", "error");
  }
}

function startQuiz() {
  document.getElementById("quiz-intro-view").classList.add("hidden");
  document.getElementById("quiz-play-view").classList.remove("hidden");
  
  currentQuestionIndex = 0;
  userAnswers = new Array(QUIZ_QUESTIONS.length).fill(null);
  
  renderQuestion();
}

function renderQuestion() {
  const q = QUIZ_QUESTIONS[currentQuestionIndex];
  
  // 진행 바 및 스태퍼
  document.getElementById("quiz-progress-text").textContent = `문제 ${currentQuestionIndex + 1} / ${QUIZ_QUESTIONS.length}`;
  
  const dots = document.querySelectorAll(".quiz-step-dot");
  dots.forEach((dot, idx) => {
    dot.className = "quiz-step-dot";
    if (idx === currentQuestionIndex) {
      dot.classList.add("active");
    } else if (idx < currentQuestionIndex) {
      dot.classList.add("completed");
    }
  });

  // 질문 텍스트
  document.getElementById("quiz-question").textContent = q.question;

  // 옵션 리스트
  const optionsDiv = document.getElementById("quiz-options");
  optionsDiv.innerHTML = "";
  
  q.options.forEach((opt, idx) => {
    const letters = ["A", "B", "C", "D"];
    const optionBtn = document.createElement("button");
    optionBtn.className = "quiz-option";
    if (userAnswers[currentQuestionIndex] === idx) {
      optionBtn.classList.add("selected");
    }
    
    optionBtn.innerHTML = `
      <span class="quiz-option-letter">${letters[idx]}</span>
      <span class="quiz-option-text">${opt}</span>
    `;
    
    optionBtn.onclick = () => selectOption(idx);
    optionsDiv.appendChild(optionBtn);
  });

  // 다음 버튼 활성화 여부
  const nextBtn = document.getElementById("btn-quiz-next");
  if (userAnswers[currentQuestionIndex] !== null) {
    nextBtn.disabled = false;
  } else {
    nextBtn.disabled = true;
  }

  // 5번째 문제는 '제출하기'로 텍스트 변경
  if (currentQuestionIndex === QUIZ_QUESTIONS.length - 1) {
    nextBtn.textContent = "퀴즈 정답 제출하기 🏆";
  } else {
    nextBtn.textContent = "다음 문제 ➔";
  }
}

function selectOption(index) {
  userAnswers[currentQuestionIndex] = index;
  
  // UI 갱신 (선택된 것 하이라이트)
  const buttons = document.querySelectorAll(".quiz-option");
  buttons.forEach((btn, idx) => {
    if (idx === index) {
      btn.classList.add("selected");
    } else {
      btn.classList.remove("selected");
    }
  });

  document.getElementById("btn-quiz-next").disabled = false;
}

async function nextQuestion() {
  if (userAnswers[currentQuestionIndex] === null) return;

  if (currentQuestionIndex < QUIZ_QUESTIONS.length - 1) {
    currentQuestionIndex++;
    renderQuestion();
  } else {
    await submitQuiz();
  }
}

async function submitQuiz() {
  const nextBtn = document.getElementById("btn-quiz-next");
  nextBtn.disabled = true;
  nextBtn.textContent = "정답 검증 중...";

  // 퀴즈 채점
  let allCorrect = true;
  QUIZ_QUESTIONS.forEach((q, idx) => {
    if (userAnswers[idx] !== q.correctIndex) {
      allCorrect = false;
    }
  });

  if (!allCorrect) {
    showToast("아쉽게도 오답이 포함되어 있습니다. 처음부터 다시 풀어보세요!", "warning");
    setTimeout(() => {
      // 1단계로 리셋
      currentQuestionIndex = 0;
      userAnswers = new Array(QUIZ_QUESTIONS.length).fill(null);
      renderQuestion();
    }, 1500);
    return;
  }

  // 모두 정답 -> 보상 포인트 계산 (20 ~ 50pt 무작위)
  const scoreEarned = Math.floor(Math.random() * 31) + 20;

  try {
    const uid = currentUser.uid;
    const today = getKSTDateString();

    await db.runTransaction(async (tx) => {
      const userRef = db.collection("users").doc(uid);
      const userDoc = await tx.get(userRef);
      if (!userDoc.exists) throw new Error("사용자가 존재하지 않습니다.");

      const data = userDoc.data();

      // 트랜잭션 내부에서 중복 여부 최종 체크
      const scanRef = userRef.collection("scans").doc();
      
      // 이미 해결된 것인지 확인하는 용도로 DB에 중복 체크 쿼리 대신 userDoc 정보에 Solved를 넣거나 collections checks
      // userDoc.quizSolved 또는 collection 확인을 위해 user document의 quizSolved 확인
      if (data.quizSolved) {
        throw new Error("이미 완료된 퀴즈입니다.");
      }

      const col = data.collection || {};
      col["special"] = (col["special"] || 0) + 1; // 특수 퀴즈 뱃지 하나 부여

      tx.set(scanRef, {
        locationId: "birthday_quiz",
        locationName: "🎂 개발자 생일 기념 특별 퀴즈",
        rarity: "special",
        rarityName: "퀴즈 보상",
        score: scoreEarned,
        dateStr: today,
        createdAt: firebase.firestore.FieldValue.serverTimestamp()
      });

      tx.update(userRef, {
        totalScore: (data.totalScore || 0) + scoreEarned,
        quizSolved: true,
        collection: col
      });
    });

    // 성공 처리
    document.getElementById("quiz-play-view").classList.add("hidden");
    const resultView = document.getElementById("quiz-result-view");
    resultView.classList.remove("hidden");
    document.getElementById("quiz-reward-points").textContent = `+${scoreEarned}pt`;

    // 파티클 생성
    spawnConfetti();

  } catch (err) {
    console.error("Quiz submission error:", err);
    showToast(err.message === "이미 완료된 퀴즈입니다." ? "이미 포인트가 지급되었습니다." : "데이터 저장 중 오류가 발생했습니다. 다시 제출해주세요.", "error");
    nextBtn.disabled = false;
    nextBtn.textContent = "퀴즈 정답 제출하기 🏆";
  }
}

function spawnConfetti() {
  const emojis = ["🎉", "✨", "⭐", "🎂", "🎈", "🎁", "💥"];
  const duration = 3000;
  
  // 1초 동안 주기적으로 파티클 발사
  const interval = setInterval(() => {
    for (let i = 0; i < 8; i++) {
      const p = document.createElement("div");
      p.className = "particle-p";
      p.style.cssText = `
        position: fixed;
        left: 50vw;
        top: 50vh;
        font-size: ${1 + Math.random() * 1.5}rem;
        pointer-events: none;
        z-index: 10001;
        transform: translate(-50%, -50%);
      `;
      p.textContent = emojis[Math.floor(Math.random() * emojis.length)];
      
      const angle = Math.random() * Math.PI * 2;
      const dist = 100 + Math.random() * 250;
      
      p.style.setProperty('--tx', Math.cos(angle) * dist + 'px');
      p.style.setProperty('--ty', Math.sin(angle) * dist + 'px');
      
      document.body.appendChild(p);
      setTimeout(() => p.remove(), 1500);
    }
  }, 100);

  setTimeout(() => clearInterval(interval), 1000);
}

document.addEventListener("DOMContentLoaded", initQuiz);
