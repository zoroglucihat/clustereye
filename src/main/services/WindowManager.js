const { BrowserWindow, Menu } = require('electron');
const path = require('path');

class WindowManager {
  constructor() {
    this.mainWindow = null;
  }

  createWindow() {
    this.mainWindow = new BrowserWindow({
      width: 1200,
      height: 800,
      backgroundColor: '#0a1929',
      icon: path.join(__dirname, '../../assets/logo.png'),
      webPreferences: {
        nodeIntegration: true,
        contextIsolation: false,
        webSecurity: false,
        enableRemoteModule: true,
        spellcheck: false,
        additionalArguments: ['--enable-features=PlatformHtmlWriter,PlatformClipboard']
      }
    });

    this.setupMenu();
    this.loadApp();
    this.setupDevTools();
  }

  setupMenu() {
    const template = [{
      label: 'Edit',
      submenu: [
        { role: 'undo' },
        { role: 'redo' },
        { type: 'separator' },
        { role: 'cut' },
        { role: 'copy' },
        { role: 'paste' },
        { role: 'selectAll' }
      ]
    }];
    Menu.setApplicationMenu(Menu.buildFromTemplate(template));
  }

  loadApp() {
    if (process.env.NODE_ENV === 'development') {
      this.mainWindow.loadURL('http://localhost:8082');
    } else {
      this.mainWindow.loadFile(path.join(__dirname, '../../build/index.html'));
    }
  }

  setupDevTools() {
    this.mainWindow.webContents.openDevTools();
  }
}

module.exports = new WindowManager(); 