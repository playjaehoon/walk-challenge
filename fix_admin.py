import sys

def modify_html():
    with open('admin.html', 'r', encoding='utf-8') as f:
        html = f.read()
        
    tab_target = '<button class=\"admin-tab\" data-target=\"tab-notices\">📢 공지사항/이벤트 관리</button>'
    tab_new = tab_target + '\n        <button class=\"admin-tab\" data-target=\"tab-dept-notices\">🏫 학부 소식 관리</button>'
    html = html.replace(tab_target, tab_new)
    
    content_target = '      <!-- 탭: 일정 관리 -->'
    content_new = '''      <!-- 탭: 학부 소식 관리 -->
      <div id=\"tab-dept-notices\" class=\"admin-content\">
        <div style=\"display:flex;align-items:center;justify-content:space-between;margin-bottom:1.5rem\">
          <h3>🏫 학부 소식 관리</h3>
          <button onclick=\"document.getElementById('modal-dept-notice-add').classList.remove('hidden')\" class=\"btn btn-primary btn-sm\">➕ 학부 소식 등록</button>
        </div>
        <div class=\"table-wrapper\">
          <table>
            <thead>
              <tr>
                <th>분류</th>
                <th>제목</th>
                <th>날짜</th>
                <th>관리</th>
              </tr>
            </thead>
            <tbody id=\"dept-notices-tbody\">
              <tr><td colspan=\"4\" style=\"text-align:center;color:var(--text-secondary)\">로딩 중...</td></tr>
            </tbody>
          </table>
        </div>
      </div>

''' + content_target
    html = html.replace(content_target, content_new)
    
    modals_target = '<!-- Modal: 소식 수정 -->'
    modals_new = '''<!-- Modal: 학부 소식 추가 -->
<div id=\"modal-dept-notice-add\" class=\"modal hidden\" style=\"position:fixed;top:0;left:0;width:100%;height:100%;background:rgba(0,0,0,0.5);z-index:9999;display:flex;align-items:center;justify-content:center;\">
  <div class=\"card\" style=\"width:100%;max-width:400px;background:#fff;padding:2rem\">
    <h3 style=\"margin-bottom:1.5rem\">학부 소식 등록</h3>
    <div style=\"margin-bottom:1rem\">
      <label class=\"form-label\" style=\"display:block;margin-bottom:0.5rem\">분류 (공지, 특강, 안내 등)</label>
      <input type=\"text\" id=\"new-dept-notice-type\" class=\"form-input\" style=\"width:100%\" placeholder=\"예: 안내\">
    </div>
    <div style=\"margin-bottom:1rem\">
      <label class=\"form-label\" style=\"display:block;margin-bottom:0.5rem\">제목</label>
      <input type=\"text\" id=\"new-dept-notice-title\" class=\"form-input\" style=\"width:100%\" placeholder=\"소식 제목\">
    </div>
    <div style=\"margin-bottom:1.5rem\">
      <label class=\"form-label\" style=\"display:block;margin-bottom:0.5rem\">본문 내용</label>
      <textarea id=\"new-dept-notice-content\" class=\"form-input\" style=\"width:100%;resize:vertical;min-height:100px;\" placeholder=\"내용을 입력하세요\"></textarea>
    </div>
    <div style=\"display:flex;gap:0.5rem;justify-content:flex-end\">
      <button onclick=\"document.getElementById('modal-dept-notice-add').classList.add('hidden')\" class=\"btn btn-secondary btn-sm\">취소</button>
      <button onclick=\"addDeptNotice()\" class=\"btn btn-primary btn-sm\">등록하기</button>
    </div>
  </div>
</div>

<!-- Modal: 학부 소식 수정 -->
<div id=\"modal-dept-notice-edit\" class=\"modal hidden\" style=\"position:fixed;top:0;left:0;width:100%;height:100%;background:rgba(0,0,0,0.5);z-index:9999;display:flex;align-items:center;justify-content:center;\">
  <div class=\"card\" style=\"width:100%;max-width:400px;background:#fff;padding:2rem\">
    <h3 style=\"margin-bottom:1.5rem\">학부 소식 수정</h3>
    <input type=\"hidden\" id=\"edit-dept-notice-id\">
    <div style=\"margin-bottom:1rem\">
      <label class=\"form-label\" style=\"display:block;margin-bottom:0.5rem\">분류</label>
      <input type=\"text\" id=\"edit-dept-notice-type\" class=\"form-input\" style=\"width:100%\">
    </div>
    <div style=\"margin-bottom:1rem\">
      <label class=\"form-label\" style=\"display:block;margin-bottom:0.5rem\">제목</label>
      <input type=\"text\" id=\"edit-dept-notice-title\" class=\"form-input\" style=\"width:100%\">
    </div>
    <div style=\"margin-bottom:1.5rem\">
      <label class=\"form-label\" style=\"display:block;margin-bottom:0.5rem\">날짜 (YYYY.MM.DD)</label>
      <input type=\"text\" id=\"edit-dept-notice-date\" class=\"form-input\" style=\"width:100%\">
    </div>
    <div style=\"margin-bottom:1.5rem\">
      <label class=\"form-label\" style=\"display:block;margin-bottom:0.5rem\">본문 내용</label>
      <textarea id=\"edit-dept-notice-content\" class=\"form-input\" style=\"width:100%;resize:vertical;min-height:100px;\"></textarea>
    </div>
    <div style=\"display:flex;gap:0.5rem;justify-content:flex-end\">
      <button onclick=\"document.getElementById('modal-dept-notice-edit').classList.add('hidden')\" class=\"btn btn-secondary btn-sm\">취소</button>
      <button onclick=\"saveEditDeptNotice()\" class=\"btn btn-primary btn-sm\">수정하기</button>
    </div>
  </div>
</div>

''' + modals_target
    html = html.replace(modals_target, modals_new)

    with open('admin.html', 'w', encoding='utf-8') as f:
        f.write(html)

def modify_js():
    with open('js/admin.js', 'r', encoding='utf-8') as f:
        js = f.read()

    js = js.replace('loadNotices();', 'loadNotices();\\n    loadDeptNotices();')

    js_code = '''
// ===== 학부 소식 (Dept Notice) 관리 =====
async function loadDeptNotices() {
  const tbody = document.getElementById("dept-notices-tbody");
  if(!tbody) return;
  try {
    const snap = await db.collection("dept_notices").orderBy("createdAt", "desc").get();
    if(snap.empty) {
      tbody.innerHTML = <tr><td colspan="4" style="text-align:center;color:var(--text-secondary)">등록된 학부 소식이 없습니다.</td></tr>;
      return;
    }
    tbody.innerHTML = snap.docs.map(doc => {
      const d = doc.data();
      const safeTitle = (d.title || '').replace(/'/g, "\\\\'").replace(/"/g, '&quot;');
      const encodedContent = encodeURIComponent(d.content || '');
      return 
        <tr>
          <td><span style="background:rgba(57,211,83,0.1);color:var(--green);padding:0.2rem 0.5rem;border-radius:4px;font-size:0.75rem;font-weight:600"></span></td>
          <td></td>
          <td></td>
          <td>
            <button onclick="editDeptNotice('', '', '', '', '')" class="btn btn-secondary btn-sm" style="padding:0.25rem 0.5rem;margin-right:0.25rem">수정</button>
            <button onclick="deleteDeptNotice('')" class="btn btn-secondary btn-sm" style="padding:0.25rem 0.5rem;color:red;border-color:red">삭제</button>
          </td>
        </tr>
      ;
    }).join("");
  } catch(e) {
    console.error(e);
    tbody.innerHTML = <tr><td colspan="4" style="text-align:center;color:red">불러오기 오류</td></tr>;
  }
}

window.addDeptNotice = async function() {
  const type = document.getElementById("new-dept-notice-type").value.trim() || '안내';
  const title = document.getElementById("new-dept-notice-title").value.trim();
  const content = document.getElementById("new-dept-notice-content").value.trim();
  
  if(!title) {
    alert("제목을 입력해주세요.");
    return;
  }
  
  const today = new Date();
  const dateStr = ${today.getFullYear()}..;
  
  try {
    await db.collection("dept_notices").add({
      type, title, content, date: dateStr, createdAt: firebase.firestore.FieldValue.serverTimestamp()
    });
    document.getElementById("new-dept-notice-title").value = '';
    document.getElementById("new-dept-notice-content").value = '';
    document.getElementById("modal-dept-notice-add").classList.add("hidden");
    loadDeptNotices();
  } catch(e) {
    alert("오류 발생");
    console.error(e);
  }
}

window.editDeptNotice = function(id, type, title, date, encodedContent) {
  document.getElementById("edit-dept-notice-id").value = id;
  document.getElementById("edit-dept-notice-type").value = type;
  document.getElementById("edit-dept-notice-title").value = title;
  document.getElementById("edit-dept-notice-date").value = date;
  document.getElementById("edit-dept-notice-content").value = decodeURIComponent(encodedContent);
  document.getElementById("modal-dept-notice-edit").classList.remove("hidden");
};

window.saveEditDeptNotice = async function() {
  const id = document.getElementById("edit-dept-notice-id").value;
  const type = document.getElementById("edit-dept-notice-type").value.trim();
  const title = document.getElementById("edit-dept-notice-title").value.trim();
  const date = document.getElementById("edit-dept-notice-date").value.trim();
  const content = document.getElementById("edit-dept-notice-content").value.trim();

  if(!title) return alert("제목을 입력해주세요.");

  try {
    await db.collection("dept_notices").doc(id).update({ type, title, date, content });
    document.getElementById("modal-dept-notice-edit").classList.add("hidden");
    loadDeptNotices();
  } catch(e) {
    console.error(e);
    alert("수정 오류");
  }
}

window.deleteDeptNotice = async function(id) {
  if(!confirm("정말 삭제하시겠습니까?")) return;
  try {
    await db.collection("dept_notices").doc(id).delete();
    loadDeptNotices();
  } catch(e) {
    alert("삭제 오류");
    console.error(e);
  }
}
'''
    
    js = js + '\n' + js_code
    with open('js/admin.js', 'w', encoding='utf-8') as f:
        f.write(js)

modify_html()
modify_js()
