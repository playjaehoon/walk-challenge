// ============================================================
// auth.js — 회원가입 / 로그인 페이지 로직
// ============================================================

// ===== 회원가입 =====
async function handleRegister(e) {
  e.preventDefault();
  const form = e.target;
  const submitBtn = form.querySelector("#register-btn");

  const name       = form.querySelector("#name").value.trim();
  const studentId  = form.querySelector("#student-id").value.trim();
  const department = form.querySelector("#department").value.trim();
  const phone      = form.querySelector("#phone").value.trim();
  const email      = form.querySelector("#email").value.trim();
  const password   = form.querySelector("#password").value;
  const password2  = form.querySelector("#password2").value;
  const genderEl   = form.querySelector("input[name='gender']:checked");
  const gender     = genderEl ? genderEl.value : "";

  const surveyConsent = form.querySelector("#survey-consent")?.checked;

  // 유효성 검사
  if (!name || !studentId || !department || !phone || !email || !password) {
    showToast("모든 항목을 입력해주세요.", "error"); return;
  }
  if (!gender) {
    showToast("성별을 선택해주세요.", "error"); return;
  }
  if (!surveyConsent) {
    showToast("사전·사후 설문조사 참여에 동의해주세요.", "error"); return;
  }
  if (password !== password2) {
    showToast("비밀번호가 일치하지 않습니다.", "error"); return;
  }
  if (password.length < 6) {
    showToast("비밀번호는 6자 이상이어야 합니다.", "error"); return;
  }

  submitBtn.disabled = true;
  submitBtn.textContent = "등록 중...";

  try {
    // 마감 기한 체크
    if (window.APP_CONFIG.registrationDeadline) {
      const deadline = new Date(window.APP_CONFIG.registrationDeadline);
      if (new Date() > deadline) {
        alert("참가 신청 기한이 모두 마감되었습니다! 😭\n\n대신 '연구 설문 참가자(대조군)'으로 참여해 주시면 캠페인 운영에 큰 도움이 됩니다.");
        window.location.href = "control-register.html";
        return;
      }
    }

    const cred = await auth.createUserWithEmailAndPassword(email, password);

    // 정원 초과 여부 확인 (계정 생성 후 로그인된 상태에서만 users 컬렉션 읽기 권한이 있음)
    const usersSnap = await db.collection("users").get();
    if (usersSnap.size >= window.APP_CONFIG.maxParticipants) {
      await cred.user.delete(); // 정원 초과시 생성된 계정 즉시 삭제
      await auth.signOut();
      alert("선착순 " + window.APP_CONFIG.maxParticipants + "명 참가 신청이 모두 마감되었습니다! 😭\n\n대신 '연구 설문 참가자(대조군)'으로 참여해 주시면 캠페인 운영에 큰 도움이 됩니다. 대조군 신청 페이지로 이동합니다.");
      window.location.href = "control-register.html";
      return;
    }
    await db.collection("users").doc(cred.user.uid).set({
      name, studentId, department, phone, email, gender,
      totalScore: 0,
      scanCount: 0,
      collection: { common: 0, rare: 0, uncommon: 0, epic: 0, legendary: 0 },
      registeredAt: firebase.firestore.FieldValue.serverTimestamp(),
    });
    showToast("신청이 완료되었습니다! 🎉", "success");
    setTimeout(() => { window.location.href = "dashboard.html"; }, 1000);
  } catch (err) {
    showToast(getAuthErrMsg(err.code), "error");
    submitBtn.disabled = false;
    submitBtn.textContent = "참가 신청하기";
  }
}

// ===== 로그인 =====
async function handleLogin(e) {
  e.preventDefault();
  const form      = e.target;
  const submitBtn = form.querySelector("#login-btn");
  const email     = form.querySelector("#email").value.trim();
  const password  = form.querySelector("#password").value;

  if (!email || !password) { showToast("이메일과 비밀번호를 입력해주세요.", "error"); return; }

  submitBtn.disabled = true;
  submitBtn.textContent = "로그인 중...";

  try {
    await auth.signInWithEmailAndPassword(email, password);
    const params   = new URLSearchParams(window.location.search);
    const redirect = params.get("redirect");
    window.location.href = redirect || "dashboard.html";
  } catch (err) {
    showToast(getAuthErrMsg(err.code), "error");
    submitBtn.disabled = false;
    submitBtn.textContent = "로그인";
  }
}

// ===== Firebase 에러 메시지 한글화 =====
function getAuthErrMsg(code) {
  const map = {
    "auth/email-already-in-use":   "이미 사용 중인 이메일입니다.",
    "auth/invalid-email":          "올바른 이메일 형식이 아닙니다.",
    "auth/weak-password":          "비밀번호는 6자 이상이어야 합니다.",
    "auth/user-not-found":         "등록되지 않은 이메일입니다.",
    "auth/wrong-password":         "비밀번호가 올바르지 않습니다.",
    "auth/invalid-credential":     "이메일 또는 비밀번호가 올바르지 않습니다.",
    "auth/too-many-requests":      "너무 많은 시도입니다. 잠시 후 다시 시도해주세요.",
  };
  return map[code] || "오류가 발생했습니다. 다시 시도해주세요.";
}

// ===== 이미 로그인한 경우 리다이렉트 =====
document.addEventListener("DOMContentLoaded", async () => {
  // 회원가입/로그인 페이지만 해당
  const user = await getCurrentUser();
  if (user) {
    const params = new URLSearchParams(window.location.search);
    window.location.href = params.get("redirect") || "dashboard.html";
    return;
  }

  const regForm   = document.getElementById("register-form");
  const loginForm = document.getElementById("login-form");
  if (regForm)   regForm.addEventListener("submit",   handleRegister);
  if (loginForm) loginForm.addEventListener("submit", handleLogin);

  // 회원가입 페이지 진입 시 정원 및 기한 체크
  if (regForm) {
    let isClosed = false;
    let closedMessage = "";

    if (window.APP_CONFIG.registrationDeadline) {
      const deadline = new Date(window.APP_CONFIG.registrationDeadline);
      if (new Date() > deadline) {
        isClosed = true;
        closedMessage = "참가 신청 기한이 모두 마감되었습니다! 😭\n\n대조군(연구 설문 참가자)으로 신청해 주시면 감사하겠습니다.";
      }
    }

    if (isClosed) {
      const btn = document.getElementById("register-btn");
      if (btn) {
        btn.disabled = true;
        btn.textContent = "모집 마감 완료";
        btn.style.background = "#9ca3af";
      }
      alert(closedMessage);
      window.location.href = "control-register.html";
    } else {
      db.collection("users").get().then((snap) => {
        if (snap.size >= window.APP_CONFIG.maxParticipants) {
        const btn = document.getElementById("register-btn");
        if (btn) {
          btn.disabled = true;
          btn.textContent = "선착순 마감 완료";
          btn.style.background = "#9ca3af";
        }
        alert("현재 선착순 " + window.APP_CONFIG.maxParticipants + "명 모집이 모두 마감되었습니다! 😭\n\n대조군(연구 설문 참가자)으로 신청해 주시면 감사하겠습니다.");
        window.location.href = "control-register.html";
      }
    }).catch(console.error);
    }
  }
});

