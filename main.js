const { app, BrowserWindow, dialog } = require('electron');
const path = require('path');
const http = require('http');
const net = require('net');

const isDev = !app.isPackaged;
const PREFERRED_PORT = 3000;

let mainWindow = null;
let serverUrl = null;

// Uygulama ikinci kez açılırsa yeni bir sunucu başlatmak yerine mevcut pencereyi öne getir
if (!app.requestSingleInstanceLock()) {
  app.quit();
} else {
  app.on('second-instance', () => {
    if (!mainWindow) return createWindow();
    if (mainWindow.isMinimized()) mainWindow.restore();
    mainWindow.focus();
  });
  app.whenReady().then(start);
}

/** Port boşsa onu, doluysa sistemin verdiği boş bir portu döndürür. */
function findFreePort(port) {
  return new Promise((resolve) => {
    const probe = net.createServer();
    probe.once('error', () => resolve(port === 0 ? null : findFreePort(0)));
    probe.listen(port, '0.0.0.0', () => {
      const { port: free } = probe.address();
      probe.close(() => resolve(free));
    });
  });
}

function waitForServer(url, timeout = 30000) {
  const deadline = Date.now() + timeout;
  return new Promise((resolve, reject) => {
    const check = () => {
      http.get(url, (res) => {
        res.resume();
        if (res.statusCode === 200) return resolve();
        retry();
      }).on('error', retry);
    };
    const retry = () => (Date.now() > deadline ? reject(new Error('timeout')) : setTimeout(check, 500));
    check();
  });
}

async function start() {
  if (isDev) {
    // Geliştirmede sunucuyu `npm run electron:dev` ayrıca başlatır
    serverUrl = `http://localhost:${PREFERRED_PORT}`;
  } else {
    const port = await findFreePort(PREFERRED_PORT);
    if (!port) return fail('Kullanılabilir bir ağ portu bulunamadı.');

    // Veritabanı salt okunur uygulama paketinde değil, kullanıcı veri klasöründe tutulur
    process.env.NODE_ENV = 'production';
    process.env.PORT = String(port);
    process.env.DB_PATH = path.join(app.getPath('userData'), 'sqlite.db');
    serverUrl = `http://localhost:${port}`;

    try {
      require(path.join(__dirname, 'server.js'));
    } catch (err) {
      return fail(err.message);
    }
  }

  createWindow();
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
}

async function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1280,
    height: 800,
    title: 'DigiTab POS',
    backgroundColor: '#0b1120',
    webPreferences: { nodeIntegration: false, contextIsolation: true },
  });
  mainWindow.setMenuBarVisibility(false);
  mainWindow.webContents.setWindowOpenHandler(() => ({ action: 'deny' }));
  if (isDev) mainWindow.webContents.openDevTools();
  mainWindow.on('closed', () => { mainWindow = null; });

  try {
    await waitForServer(serverUrl);
    mainWindow?.loadURL(`${serverUrl}/dashboard`);
  } catch {
    fail('Uygulama sunucusu başlatılamadı.');
  }
}

function fail(detail) {
  dialog.showErrorBox('DigiTab POS başlatılamadı', `${detail}\n\nLütfen uygulamayı kapatıp yeniden açın.`);
  app.quit();
}

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});
