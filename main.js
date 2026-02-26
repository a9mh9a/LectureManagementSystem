const { app, BrowserWindow, session } = require('electron');
const path = require('path');

function createWindow() {
  const win = new BrowserWindow({
    width: 1200,
    height: 800,
    title: "نظام إدارة المحاضرات المطور",
    icon: path.join(__dirname, 'icon.ico'), // اختياري إذا كان لديك أيقونة
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false
    }
  });

  // إخفاء شريط القوائم العلوي ليظهر كتطبيق 
  win.setMenu(null);

  // تحميل ملف الـ HTML
  win.loadFile('index.html');

  // طلب صلاحيات الكاميرا والميكروفون تلقائياً
  session.defaultSession.setPermissionCheckHandler((webContents, permission) => {
    if (permission === 'media') return true;
    return false;
  });

  session.defaultSession.setPermissionRequestHandler((webContents, permission, callback) => {
    if (permission === 'media') callback(true);
    else callback(false);
  });
}

app.whenReady().then(createWindow);

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});