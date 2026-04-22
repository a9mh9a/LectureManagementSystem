// 🔴 إعدادات Firebase الخاصة بك 🔴
const firebaseConfig = {
    apiKey: "AIzaSyDa3RKxfXqoBen_IbpUNvREWK5vd9TzMg4",
    authDomain: "myclassmanager-dcb24.firebaseapp.com",
    databaseURL: "https://myclassmanager-dcb24-default-rtdb.firebaseio.com",
    projectId: "myclassmanager-dcb24",
    storageBucket: "myclassmanager-dcb24.firebasestorage.app",
    messagingSenderId: "538737788584",
    appId: "1:538737788584:web:ca74a3c7ccb0c09484649d"
};

// تهيئة التطبيق
firebase.initializeApp(firebaseConfig);
const db = firebase.database();

// --- المتغيرات العامة ---
let curUserKey = null, curClasses = {}, curClassId = null, appData = {};
const defaultClassData = { name: "صف جديد", students: [], attendance: {}, grades: {}, settings: { hw: 10, part: 10, mid: 30, final: 50 } };
let mediaRecorder, recordedChunks = [], stream = null;

// --- دوال مساعدة ---
function showToast(msg) { const t = document.getElementById('toast'); t.innerText = msg; t.className = 'show'; setTimeout(() => t.className = '', 3000); }
function toggleAuth() { 
    const l = document.getElementById('login-box'), s = document.getElementById('signup-box');
    l.style.display = l.style.display === 'none' ? 'block' : 'none';
    s.style.display = s.style.display === 'none' ? 'block' : 'none';
}

// --- المصادقة ---
function signup() {
    const u = document.getElementById('regUser').value.trim().replace(/\./g, '_');
    const p = document.getElementById('regPass').value, n = document.getElementById('regName').value, s = document.getElementById('regSub').value;
    if(!u || !p || !n || !s) return alert('أكمل جميع الحقول');

    db.ref('users/' + u).once('value').then((snapshot) => {
        if (snapshot.exists()) alert('اسم المستخدم موجود مسبقاً');
        else {
            const firstClassId = "class_" + Date.now();
            const userData = { name: n, pass: p, classes: { [firstClassId]: { name: s, students: [], settings: defaultClassData.settings } } };
            db.ref('users/' + u).set(userData).then(() => { showToast('تم إنشاء الحساب'); toggleAuth(); })
            .catch(err => alert("فشل الإنشاء: تأكد أنك اخترت Test Mode في الفايربيس\n" + err.message));
        }
    }).catch(err => alert("خطأ في الاتصال بقاعدة البيانات\n" + err.message));
}

function login() {
    const u = document.getElementById('logUser').value.trim().replace(/\./g, '_'), p = document.getElementById('logPass').value;
    if(!u || !p) return alert("أدخل البيانات");
    showToast("جارِ التحقق...");
    db.ref('users/' + u).once('value').then((snapshot) => {
        if (snapshot.exists()) {
            const userData = snapshot.val();
            if (userData.pass === p) {
                curUserKey = u;
                document.getElementById('displayUserName').innerText = userData.name;
                curClasses = userData.classes || {};
                const classIds = Object.keys(curClasses);
                if(classIds.length > 0) switchClass(classIds[0]); else curClassId = null;
                document.getElementById('auth-screen').style.display = 'none';
                document.getElementById('app-screen').style.display = 'flex';
            } else alert('كلمة المرور خطأ');
        } else alert('المستخدم غير موجود');
    }).catch(err => alert("خطأ: " + err.message));
}

function logout() { location.reload(); }

// --- إدارة الصفوف ---
function switchClass(classId) {
    curClassId = classId;
    const cls = curClasses[classId];
    appData = { name: cls.name, students: cls.students || [], attendance: cls.attendance || {}, grades: cls.grades || {}, settings: cls.settings || defaultClassData.settings };
    document.getElementById('displayUserSub').innerText = cls.name;
    document.getElementById('dashClassName').innerText = `(${cls.name})`;
    updateDashboard(); loadSettingsToUI(); renderClassesList(); nav('dashboard'); showToast(`تم الانتقال: ${cls.name}`);
}

function addNewClass() {
    const name = document.getElementById('newClassName').value;
    if(!name) return alert("أدخل اسم الصف");
    const newId = "class_" + Date.now();
    const newClassData = { name: name, settings: defaultClassData.settings };
    db.ref(`users/${curUserKey}/classes/${newId}`).set(newClassData).then(() => {
        curClasses[newId] = newClassData; document.getElementById('newClassName').value = ''; renderClassesList(); showToast("تمت الإضافة");
    });
}

function renderClassesList() {
    const div = document.getElementById('classesList'); div.innerHTML = '';
    Object.keys(curClasses).forEach(id => {
        const cls = curClasses[id];
        const active = id === curClassId ? 'active-class' : '';
        div.innerHTML += `<div class="card class-card ${active}" onclick="switchClass('${id}')"><i class="fas fa-book fa-2x" style="color:var(--accent);margin-bottom:10px;display:block;"></i><h4>${cls.name}</h4><p style="font-size:0.8rem;color:#666;">${(cls.students||[]).length} طالب</p></div>`;
    });
}

function saveData() { if(curUserKey && curClassId) { db.ref(`users/${curUserKey}/classes/${curClassId}`).set(appData); curClasses[curClassId] = appData; } }

function nav(sid) {
    document.querySelectorAll('.section').forEach(s => s.classList.remove('active'));
    document.querySelectorAll('.nav-item').forEach(i => i.classList.remove('active'));
    document.getElementById(sid).classList.add('active');
    document.querySelectorAll('.nav-item').forEach(i => { if(i.getAttribute('onclick') && i.getAttribute('onclick').includes(sid)) i.classList.add('active'); });
    if(sid==='students') renderStudents(); if(sid==='grades') renderGrades(); if(sid==='interaction') renderInteraction(); if(sid==='dashboard') updateDashboard(); if(sid==='classes_mgmt') renderClassesList();
}

// --- الكاميرا ---
async function toggleCamera() {
    const v = document.getElementById('videoPreview'), b = document.getElementById('camBtn');
    if (!stream) {
        try { stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true }); v.srcObject = stream; b.style.background = "#27ae60"; showToast("تم تشغيل الكاميرا"); } catch (err) { alert("مطلوب صلاحية الكاميرا"); }
    } else { stream.getTracks().forEach(t => t.stop()); v.srcObject = null; stream = null; b.style.background = "#3c4043"; showToast("إيقاف الكاميرا"); }
}

function startRecording() {
    if (!stream) return alert("شغل الكاميرا أولاً");
    recordedChunks = []; mediaRecorder = new MediaRecorder(stream);
    mediaRecorder.ondataavailable = e => e.data.size > 0 && recordedChunks.push(e.data);
    mediaRecorder.onstop = () => document.getElementById('downloadBtn').style.display = 'flex';
    mediaRecorder.start(); document.getElementById('startRec').style.display = 'none'; document.getElementById('stopRec').style.display = 'flex'; document.getElementById('recStatus').style.display = 'block';
}

function stopRecording() { mediaRecorder.stop(); document.getElementById('startRec').style.display = 'flex'; document.getElementById('stopRec').style.display = 'none'; document.getElementById('recStatus').style.display = 'none'; }
function downloadVideo() { const b = new Blob(recordedChunks, { type: 'video/webm' }); const a = document.createElement('a'); a.href = URL.createObjectURL(b); a.download = `Lecture_${Date.now()}.webm`; a.click(); }

// --- الطلاب ---
function addStudent() {
    const n = document.getElementById('stdName').value, id = document.getElementById('stdId').value;
    if(!n || !id) return showToast('أدخل البيانات');
    if(!appData.students) appData.students = [];
    if(appData.students.find(s => s.id === id)) return alert("الرقم موجود");
    appData.students.push({ id, name: n, partScore: 0 }); saveData(); renderStudents();
    document.getElementById('stdName').value = ''; document.getElementById('stdId').value = '';
}

function renderStudents() {
    const q = document.getElementById('searchStd').value.toLowerCase(), tbody = document.querySelector('#stdTable tbody'); tbody.innerHTML = '';
    (appData.students||[]).filter(s => s.name.toLowerCase().includes(q) || s.id.includes(q)).forEach(s => {
        tbody.innerHTML += `<tr><td>${s.id}</td><td>${s.name}</td><td><button class="btn btn-danger" onclick="deleteStudent('${s.id}')"><i class="fas fa-trash"></i></button></td></tr>`;
    });
}

function deleteStudent(id) { if(confirm('حذف؟')) { appData.students = appData.students.filter(s => s.id !== id); if(appData.grades) delete appData.grades[id]; saveData(); renderStudents(); } }

// --- الدرجات ---
function renderGrades() {
    const s = appData.settings; document.getElementById('gradesHead').innerHTML = `<th>الاسم</th><th>واجبات (${s.hw})</th><th>تفاعل (${s.part})</th><th>نصفي (${s.mid})</th><th>نهائي (${s.final})</th><th>المجموع</th><th>الحالة</th>`;
    const tbody = document.querySelector('#gradesTable tbody'); tbody.innerHTML = '';
    (appData.students||[]).forEach(std => {
        const g = (appData.grades && appData.grades[std.id]) || { h:0, m:0, f:0 };
        const p = std.partScore || 0;
        const total = parseFloat(g.h||0) + parseFloat(p||0) + parseFloat(g.m||0) + parseFloat(g.f||0);
        tbody.innerHTML += `<tr><td style="text-align:right">${std.name}</td>
        <td><input type="number" class="grade-input" oninput="liveCalc(this,'h','${std.id}')" value="${g.h}"></td>
        <td><input type="number" class="grade-input" oninput="liveCalc(this,'p','${std.id}')" value="${p}"></td>
        <td><input type="number" class="grade-input" oninput="liveCalc(this,'m','${std.id}')" value="${g.m}"></td>
        <td><input type="number" class="grade-input" oninput="liveCalc(this,'f','${std.id}')" value="${g.f}"></td>
        <td style="font-weight:bold">${total}</td><td style="color:${total>=50?'green':'red'}">${total>=50?'ناجح':'راسب'}</td></tr>`;
    });
}

function liveCalc(inp, t, id) { const max = appData.settings[t==='h'?'hw':t==='p'?'part':t==='m'?'mid':'final']; if(parseFloat(inp.value)>max) inp.value = max; }

function saveAllGrades() {
    const rows = document.querySelectorAll('#gradesTable tbody tr'); if(!appData.grades) appData.grades = {};
    rows.forEach((row, idx) => {
        const std = appData.students[idx], inps = row.querySelectorAll('.grade-input');
        appData.grades[std.id] = { h: inps[0].value, m: inps[2].value, f: inps[3].value }; std.partScore = inps[1].value;
    }); saveData(); showToast('تم الحفظ');
}

// --- التفاعل ---
function renderInteraction() {
    const div = document.getElementById('interCards'); div.innerHTML = '';
    (appData.students||[]).forEach(s => {
        div.innerHTML += `<div class="card" style="text-align:center"><h4>${s.name}</h4><h2 id="p-${s.id}" style="color:var(--accent)">${s.partScore||0}</h2><button class="btn btn-success" onclick="upPart('${s.id}',1)">+1</button> <button class="btn btn-danger" onclick="upPart('${s.id}',-1)">-1</button></div>`;
    });
}

function upPart(id, v) { const s = appData.students.find(x => x.id === id); if(s) { s.partScore = Math.max(0, Math.min(appData.settings.part, (parseFloat(s.partScore)||0) + v)); document.getElementById(`p-${id}`).innerText = s.partScore; saveData(); } }

// --- الحضور ---
function renderAttendance() {
    const d = document.getElementById('attDate').value; if(!d) return alert('اختر التاريخ');
    document.getElementById('attList').style.display = 'block'; const tbody = document.querySelector('#attTable tbody'); tbody.innerHTML = '';
    if(!appData.attendance) appData.attendance = {}; const saved = appData.attendance[d] || [];
    (appData.students||[]).forEach(s => { tbody.innerHTML += `<tr><td>${s.name}</td><td><input type="checkbox" class="att-chk" data-id="${s.id}" ${saved.includes(s.id)?'checked':''}></td></tr>`; });
}

function saveAttendance() {
    const d = document.getElementById('attDate').value, chks = document.querySelectorAll('.att-chk:checked');
    if(!appData.attendance) appData.attendance = {}; appData.attendance[d] = Array.from(chks).map(c => c.dataset.id);
    let c = 0; Array.from(chks).forEach(chk => { const s = appData.students.find(x => x.id === chk.dataset.id); if(s && (parseFloat(s.partScore)||0) < appData.settings.part) { s.partScore = (parseFloat(s.partScore)||0) + 1; c++; } });
    saveData(); showToast(`تم الحفظ وإضافة تفاعل لـ ${c} طالب`);
}

// --- الإعدادات والإحصائيات ---
function loadSettingsToUI() { const s = appData.settings; document.getElementById('maxHw').value = s.hw; document.getElementById('maxPart').value = s.part; document.getElementById('maxMid').value = s.mid; document.getElementById('maxFinal').value = s.final; }

function saveSettings() {
    const h = parseFloat(document.getElementById('maxHw').value), p = parseFloat(document.getElementById('maxPart').value), m = parseFloat(document.getElementById('maxMid').value), f = parseFloat(document.getElementById('maxFinal').value);
    if(h+p+m+f !== 100) return alert('المجموع يجب أن يكون 100');
    appData.settings = { hw:h, part:p, mid:m, final:f }; saveData(); showToast('تم الحفظ');
}

function updateDashboard() {
    const stds = appData.students || []; const total = stds.length; document.getElementById('statCount').innerText = total;
    if(total === 0) { document.getElementById('statPass').innerText = '0%'; document.getElementById('statAvg').innerText = '0'; return; }
    let tg = 0, pass = 0; stds.forEach(s => {
        const g = (appData.grades && appData.grades[s.id]) || {h:0,m:0,f:0}, sum = parseFloat(g.h||0)+parseFloat(s.partScore||0)+parseFloat(g.m||0)+parseFloat(g.f||0);
        tg += sum; if(sum >= 50) pass++;
    });
    document.getElementById('statPass').innerText = Math.round((pass/total)*100) + '%'; document.getElementById('statAvg').innerText = (tg/total).toFixed(1);
}

function exportExcel() {
    let csv = "\uFEFFالرقم,الاسم,الواجبات,التفاعل,النصفي,النهائي,المجموع,الحالة\n";
    (appData.students||[]).forEach(s => {
        const g = (appData.grades && appData.grades[s.id]) || {}, sum = parseFloat(g.h||0)+parseFloat(s.partScore||0)+parseFloat(g.m||0)+parseFloat(g.f||0);
        csv += `${s.id},${s.name},${g.h||0},${s.partScore||0},${g.m||0},${g.f||0},${sum},${sum>=50?'ناجح':'راسب'}\n`;
    });
    const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8;' })); a.download = `Grades_${Date.now()}.csv`; a.click();
}
