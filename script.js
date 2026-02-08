// --- حالة التطبيق ---
let curUser = null;
let appData = {
    students: [],
    attendance: {},
    grades: {},
    settings: { hw: 10, part: 10, mid: 30, final: 50 }
};

// --- متغيرات التسجيل ---
let mediaRecorder;
let recordedChunks = [];
let stream = null;

// --- نظام التنبيهات ---
function showToast(msg) {
    const t = document.getElementById('toast');
    t.innerText = msg;
    t.className = 'show';
    setTimeout(() => t.className = '', 3000);
}

// --- المصادقة ---
function toggleAuth() {
    const l = document.getElementById('login-box');
    const s = document.getElementById('signup-box');
    l.style.display = l.style.display === 'none' ? 'block' : 'none';
    s.style.display = s.style.display === 'none' ? 'block' : 'none';
}

function signup() {
    const u = document.getElementById('regUser').value.trim();
    const p = document.getElementById('regPass').value;
    const n = document.getElementById('regName').value;
    const s = document.getElementById('regSub').value;
    if(!u || !p || !n || !s) return alert('أكمل جميع الحقول');

    let users = JSON.parse(localStorage.getItem('LMS_USERS') || '{}');
    if(users[u]) return alert('اسم المستخدم موجود مسبقاً');

    users[u] = { name: n, sub: s, pass: p };
    localStorage.setItem('LMS_USERS', JSON.stringify(users));
    localStorage.setItem(`LMS_DATA_${u}`, JSON.stringify(appData));
    showToast('تم إنشاء الحساب بنجاح');
    toggleAuth();
}

function login() {
    const u = document.getElementById('logUser').value.trim();
    const p = document.getElementById('logPass').value;
    let users = JSON.parse(localStorage.getItem('LMS_USERS') || '{}');

    if(users[u] && users[u].pass === p) {
        curUser = u;
        appData = JSON.parse(localStorage.getItem(`LMS_DATA_${u}`));
        document.getElementById('displayUserName').innerText = users[u].name;
        document.getElementById('displayUserSub').innerText = users[u].sub;
        document.getElementById('auth-screen').style.display = 'none';
        document.getElementById('app-screen').style.display = 'flex';
        updateDashboard();
        loadSettingsToUI();
    } else {
        alert('خطأ في بيانات الدخول');
    }
}

function logout() { location.reload(); }

// --- التنقل ---
function nav(sectionId) {
    document.querySelectorAll('.section').forEach(s => s.classList.remove('active'));
    document.querySelectorAll('.nav-item').forEach(i => i.classList.remove('active'));
    document.getElementById(sectionId).classList.add('active');
    
    // تمييز الزر النشط
    const navItems = document.querySelectorAll('.nav-item');
    navItems.forEach(item => {
        if(item.getAttribute('onclick').includes(sectionId)) {
            item.classList.add('active');
        }
    });

    if(sectionId === 'students') renderStudents();
    if(sectionId === 'grades') renderGrades();
    if(sectionId === 'interaction') renderInteraction();
    if(sectionId === 'dashboard') updateDashboard();
}

// --- نظام التسجيل (Meet) ---
async function toggleCamera() {
    const video = document.getElementById('videoPreview');
    const camBtn = document.getElementById('camBtn');
    if (!stream) {
        try {
            stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
            video.srcObject = stream;
            camBtn.style.background = "#27ae60";
            showToast("تم تشغيل الكاميرا");
        } catch (err) {
            alert("يرجى إعطاء صلاحية الكاميرا والميكروفون");
        }
    } else {
        stream.getTracks().forEach(track => track.stop());
        video.srcObject = null;
        stream = null;
        camBtn.style.background = "#3c4043";
        showToast("إيقاف الكاميرا");
    }
}

function startRecording() {
    if (!stream) return alert("شغل الكاميرا أولاً");
    recordedChunks = [];
    mediaRecorder = new MediaRecorder(stream);
    mediaRecorder.ondataavailable = e => e.data.size > 0 && recordedChunks.push(e.data);
    mediaRecorder.onstop = () => document.getElementById('downloadBtn').style.display = 'flex';
    
    mediaRecorder.start();
    document.getElementById('startRec').style.display = 'none';
    document.getElementById('stopRec').style.display = 'flex';
    document.getElementById('recStatus').style.display = 'block';
    showToast("بدأ التسجيل...");
}

function stopRecording() {
    mediaRecorder.stop();
    document.getElementById('startRec').style.display = 'flex';
    document.getElementById('stopRec').style.display = 'none';
    document.getElementById('recStatus').style.display = 'none';
}

function downloadVideo() {
    const blob = new Blob(recordedChunks, { type: 'video/webm' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `Lecture_${new Date().getTime()}.webm`;
    a.click();
}

// --- إدارة الطلاب ---
function addStudent() {
    const name = document.getElementById('stdName').value;
    const id = document.getElementById('stdId').value;
    if(!name || !id) return showToast('أدخل البيانات');
    appData.students.push({ id, name, partScore: 0 });
    saveData();
    renderStudents();
    document.getElementById('stdName').value = '';
    document.getElementById('stdId').value = '';
}

function renderStudents() {
    const q = document.getElementById('searchStd').value.toLowerCase();
    const tbody = document.querySelector('#stdTable tbody');
    tbody.innerHTML = '';
    appData.students.filter(s => s.name.toLowerCase().includes(q) || s.id.includes(q)).forEach(s => {
        tbody.innerHTML += `<tr><td>${s.id}</td><td>${s.name}</td><td><button class="btn btn-danger" onclick="deleteStudent('${s.id}')"><i class="fas fa-trash"></i></button></td></tr>`;
    });
}

function deleteStudent(id) {
    if(confirm('حذف الطالب؟')) {
        appData.students = appData.students.filter(s => s.id !== id);
        delete appData.grades[id];
        saveData();
        renderStudents();
    }
}

// --- الدرجات ---
function renderGrades() {
    const s = appData.settings;
    document.getElementById('gradesHead').innerHTML = `<th>الاسم</th><th>واجبات (${s.hw})</th><th>تفاعل (${s.part})</th><th>نصفي (${s.mid})</th><th>نهائي (${s.final})</th><th>المجموع</th><th>الحالة</th>`;
    const tbody = document.querySelector('#gradesTable tbody');
    tbody.innerHTML = '';
    appData.students.forEach(std => {
        const g = appData.grades[std.id] || { h:0, m:0, f:0 };
        const p = std.partScore || 0;
        const total = parseFloat(g.h||0) + parseFloat(p||0) + parseFloat(g.m||0) + parseFloat(g.f||0);
        tbody.innerHTML += `<tr>
            <td style="text-align:right">${std.name}</td>
            <td><input type="number" class="grade-input" oninput="liveCalc(this,'h','${std.id}')" value="${g.h}"></td>
            <td><input type="number" class="grade-input" oninput="liveCalc(this,'p','${std.id}')" value="${p}"></td>
            <td><input type="number" class="grade-input" oninput="liveCalc(this,'m','${std.id}')" value="${g.m}"></td>
            <td><input type="number" class="grade-input" oninput="liveCalc(this,'f','${std.id}')" value="${g.f}"></td>
            <td style="font-weight:bold">${total}</td>
            <td style="color:${total>=50?'green':'red'}">${total>=50?'ناجح':'راسب'}</td>
        </tr>`;
    });
}

function liveCalc(input, type, stdId) {
    const max = appData.settings[type==='h'?'hw':type==='p'?'part':type==='m'?'mid':'final'];
    if(parseFloat(input.value) > max) input.value = max;
    // الحساب المباشر للعرض فقط، الحفظ عند ضغط الزر
}

function saveAllGrades() {
    const rows = document.querySelectorAll('#gradesTable tbody tr');
    rows.forEach((row, idx) => {
        const std = appData.students[idx];
        const inps = row.querySelectorAll('.grade-input');
        appData.grades[std.id] = { h: inps[0].value, m: inps[2].value, f: inps[3].value };
        std.partScore = inps[1].value;
    });
    saveData();
    showToast('تم الحفظ');
}

// --- التفاعل والحضور ---
function renderInteraction() {
    const div = document.getElementById('interCards');
    div.innerHTML = '';
    appData.students.forEach(s => {
        div.innerHTML += `<div class="card" style="text-align:center">
            <h4>${s.name}</h4><h2 id="p-${s.id}" style="color:var(--accent)">${s.partScore}</h2>
            <button class="btn btn-success" onclick="upPart('${s.id}',1)">+1</button>
            <button class="btn btn-danger" onclick="upPart('${s.id}',-1)">-1</button>
        </div>`;
    });
}

function upPart(id, v) {
    const s = appData.students.find(x => x.id === id);
    s.partScore = Math.max(0, Math.min(appData.settings.part, (parseFloat(s.partScore)||0) + v));
    document.getElementById(`p-${id}`).innerText = s.partScore;
    saveData();
}

function renderAttendance() {
    const d = document.getElementById('attDate').value;
    if(!d) return alert('اختر التاريخ');
    document.getElementById('attList').style.display = 'block';
    const tbody = document.querySelector('#attTable tbody');
    tbody.innerHTML = '';
    const saved = appData.attendance[d] || [];
    appData.students.forEach(s => {
        tbody.innerHTML += `<tr><td>${s.name}</td><td><input type="checkbox" class="att-chk" data-id="${s.id}" ${saved.includes(s.id)?'checked':''}></td></tr>`;
    });
}

function saveAttendance() {
    const d = document.getElementById('attDate').value;
    const chks = document.querySelectorAll('.att-chk:checked');
    appData.attendance[d] = Array.from(chks).map(c => c.dataset.id);
    saveData();
    showToast('تم حفظ الحضور');
}

// --- إعدادات وإحصائيات ---
function loadSettingsToUI() {
    document.getElementById('maxHw').value = appData.settings.hw;
    document.getElementById('maxPart').value = appData.settings.part;
    document.getElementById('maxMid').value = appData.settings.mid;
    document.getElementById('maxFinal').value = appData.settings.final;
}

function saveSettings() {
    const h = parseFloat(document.getElementById('maxHw').value);
    const p = parseFloat(document.getElementById('maxPart').value);
    const m = parseFloat(document.getElementById('maxMid').value);
    const f = parseFloat(document.getElementById('maxFinal').value);
    if(h+p+m+f !== 100) return alert('يجب أن يكون المجموع 100');
    appData.settings = { hw:h, part:p, mid:m, final:f };
    saveData();
    showToast('تم حفظ الإعدادات');
}

function updateDashboard() {
    const total = appData.students.length;
    document.getElementById('statCount').innerText = total;
    if(total === 0) return;
    let totalGrades = 0, pass = 0;
    appData.students.forEach(s => {
        const g = appData.grades[s.id] || {h:0, m:0, f:0};
        const sum = parseFloat(g.h||0) + parseFloat(s.partScore||0) + parseFloat(g.m||0) + parseFloat(g.f||0);
        totalGrades += sum; if(sum >= 50) pass++;
    });
    document.getElementById('statPass').innerText = Math.round((pass/total)*100) + '%';
    document.getElementById('statAvg').innerText = (totalGrades/total).toFixed(1);
}

function exportExcel() {
    let csv = "\uFEFFالرقم,الاسم,الواجبات,التفاعل,النصفي,النهائي,المجموع,الحالة\n";
    appData.students.forEach(s => {
        const g = appData.grades[s.id] || {};
        const sum = parseFloat(g.h||0) + parseFloat(s.partScore||0) + parseFloat(g.m||0) + parseFloat(g.f||0);
        csv += `${s.id},${s.name},${g.h||0},${s.partScore||0},${g.m||0},${g.f||0},${sum},${sum>=50?'ناجح':'راسب'}\n`;
    });
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `Grades_${new Date().toLocaleDateString()}.csv`;
    a.click();
}

function saveData() { localStorage.setItem(`LMS_DATA_${curUser}`, JSON.stringify(appData)); }