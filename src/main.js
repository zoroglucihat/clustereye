const { app, BrowserWindow, ipcMain } = require('electron');
const path = require('path');
const Store = require('electron-store');
const k8s = require('@kubernetes/client-node');

const store = new Store();

function createWindow() {
  const mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false
    }
  });

  mainWindow.loadURL(
    process.env.NODE_ENV === 'development'
      ? 'http://localhost:3000'
      : `file://${path.join(__dirname, '../build/index.html')}`
  );
}

// Kubeconfig yönetimi
ipcMain.handle('save-kubeconfig', async (event, { name, config }) => {
  const configs = store.get('kubeconfigs') || {};
  configs[name] = config;
  store.set('kubeconfigs', configs);
  return { success: true };
});

ipcMain.handle('get-kubeconfigs', async () => {
  return store.get('kubeconfigs') || {};
});

// Kubernetes işlemleri
ipcMain.handle('get-pods', async (event, context) => {
  try {
    const kc = new k8s.KubeConfig();
    kc.loadFromString(context);
    
    const k8sApi = kc.makeApiClient(k8s.CoreV1Api);
    const response = await k8sApi.listPodForAllNamespaces();
    return response.body;
  } catch (error) {
    console.error('Error fetching pods:', error);
    throw error;
  }
});

app.whenReady().then(createWindow); 