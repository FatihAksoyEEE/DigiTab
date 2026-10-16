const { app, BrowserWindow, dialog } = require('electron');
const path = require('path');
const { fork } = require('child_process');
const http = require('http');

let mainWindow;
let serverProcess;

const isDev = !app.isPackaged;

function waitForServer(url, timeout = 30000) {
  return new Promise((resolve, reject) => {
    const startTime = Date.now();
    const check = () => {
      http.get(url, (res) => {
        if (res.statusCode === 200) {
          resolve();
        } else {
          res.resume();
          nextAttempt();
        }
      }).on('error', nextAttempt);
    };

    const nextAttempt = () => {
      if (Date.now() - startTime > timeout) {
        reject(new Error('Timeout waiting for server'));
      } else {
        setTimeout(check, 1000);
      }
    };

    check();
  });
}

async function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1280,
    height: 800,
    title: 'DigiTab POS',
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
    },
  });

  mainWindow.setMenuBarVisibility(false);
  if (isDev) mainWindow.webContents.openDevTools();
  mainWindow.webContents.setWindowOpenHandler(() => ({ action: 'deny' }));

  // Wait for the server to be ready before loading
  try {
    await waitForServer('http://localhost:3000');
    mainWindow.loadURL('http://localhost:3000');
  } catch {
    dialog.showErrorBox(
      'Sunucu Hatası',
      'Uygulama sunucusu başlatılamadı. Lütfen uygulamayı yeniden başlatmayı deneyin.'
    );
    app.quit();
  }

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

function startServer() {
  // In production, we must write the database to the userData directory, not inside the read-only .app/asar
  process.env.NODE_ENV = isDev ? 'development' : 'production';
  process.env.DB_PATH = isDev 
    ? path.join(__dirname, 'sqlite.db') 
    : path.join(app.getPath('userData'), 'sqlite.db');

  try {
    if (isDev) {
      // In dev we still use fork with tsx for convenience
      serverProcess = fork(
        path.join(__dirname, 'node_modules', 'tsx', 'dist', 'cli.mjs'),
        ['server.ts'],
        { env: process.env, cwd: __dirname }
      );
    } else {
      // IN PRODUCTION: Run the server in the same process!
      // This solves ALL asar/node_modules path issues.
      require(path.join(__dirname, 'server.js'));
    }
  } catch (err) {
    console.error('Server failed to start:', err);
    dialog.showErrorBox('Sunucu Başlatılamadı', err.message);
  }
}

app.whenReady().then(() => {
  startServer();
  createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});

app.on('will-quit', () => {
  // Ensure the background server process is killed when app closes
  if (serverProcess) {
    serverProcess.kill();
  }
});
