const { app, BrowserWindow, dialog, shell } = require('electron');
const path = require('path');
const http = require('http');
const net = require('net');

const isDev = !app.isPackaged;

// Geliştirmede Next.js sıcak yenileme için eval kullanır; Electron'un CSP uyarısı yalnızca bu yüzden çıkar.
// Pencereler açılmadan ayarlanmalı ki her pencere süreci bu değeri devralsın. Kurulum sürümünde uyarı zaten gösterilmez.
if (isDev) process.env.ELECTRON_DISABLE_SECURITY_WARNINGS = 'true';
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
  waitForServer(serverUrl).then(startPrintAgent).catch(() => {});
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
}

async function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1280,
    height: 800,
    title: 'DigiTab POS',
    backgroundColor: '#151514',
    webPreferences: { nodeIntegration: false, contextIsolation: true },
  });
  mainWindow.setMenuBarVisibility(false);
  // Yeni pencere açan bağlantılar (ör. istasyon ekranı) varsayılan tarayıcıda açılır
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    if (/^https?:\/\//.test(url)) shell.openExternal(url);
    return { action: 'deny' };
  });
  if (isDev) mainWindow.webContents.openDevTools();
  mainWindow.on('closed', () => { mainWindow = null; });

  try {
    await waitForServer(serverUrl);
    mainWindow?.loadURL(`${serverUrl}/dashboard`);
  } catch {
    fail('Uygulama sunucusu başlatılamadı.');
  }
}

/**
 * Kasa yazdırma ajanı: sunucuya socket istemcisi olarak bağlanır (localhost olduğu için kasa yetkisi alır),
 * yazıcı listesini verir ve istasyon fişlerini gizli bir pencerede açıp diyalogsuz yazdırır.
 * Geliştirmede sunucu ayrı bir süreçte çalıştığı için doğrudan çağrı yerine socket kullanılır.
 */
function startPrintAgent() {
  const { io } = require('socket.io-client');
  const socket = io(serverUrl, { reconnectionDelay: 2000 });

  const listPrinters = async () => {
    const win = new BrowserWindow({ show: false });
    try {
      return (await win.webContents.getPrintersAsync()).map((p) => p.name);
    } finally {
      win.destroy();
    }
  };

  const printPage = async (pagePath, printer) => {
    // 80 mm ≈ 302 px; yükseklik fişin uzunluğuna göre sürücü tarafından belirlenir
    const win = new BrowserWindow({ show: false, width: 302, height: 900, webPreferences: { nodeIntegration: false, contextIsolation: true } });
    try {
      await win.loadURL(`${serverUrl}${pagePath}`);
      const printers = (await win.webContents.getPrintersAsync()).map((p) => p.name);
      if (!printers.includes(printer)) return { ok: false, error: `"${printer}" yazıcısı bu bilgisayarda bulunamadı.` };
      return await new Promise((resolve) => {
        win.webContents.print({ silent: true, deviceName: printer, printBackground: false, margins: { marginType: 'none' } },
          (success, reason) => resolve(success ? { ok: true } : { ok: false, error: reason || 'yazdırma başarısız' }));
      });
    } catch (err) {
      return { ok: false, error: err.message };
    } finally {
      win.destroy();
    }
  };

  socket.on('connect', () => socket.emit('register_print_agent', {}));
  socket.on('list_printers', async (ack) => ack(await listPrinters().catch(() => [])));
  socket.on('print_job', async ({ path: pagePath, printer } = {}, ack) => {
    if (typeof pagePath !== 'string' || !pagePath.startsWith('/print/') || typeof printer !== 'string') return ack({ ok: false, error: 'Geçersiz yazdırma işi.' });
    ack(await printPage(pagePath, printer));
  });
}

function fail(detail) {
  dialog.showErrorBox('DigiTab POS başlatılamadı', `${detail}\n\nLütfen uygulamayı kapatıp yeniden açın.`);
  app.quit();
}

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});
