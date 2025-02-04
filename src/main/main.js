const { app, BrowserWindow, ipcMain } = require('electron');
const path = require('path');
const Store = require('electron-store');
const k8s = require('@kubernetes/client-node');
const fs = require('fs');
const os = require('os');

const store = new Store();

let mainWindow = null;  // mainWindow'u global olarak tutuyoruz

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    backgroundColor: '#0a1929',
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false,
      webSecurity: false
    }
  });

  if (process.env.NODE_ENV === 'development') {
    mainWindow.loadURL('http://localhost:8080/index.html');
    mainWindow.webContents.openDevTools();
  } else {
    mainWindow.loadFile(path.join(__dirname, '../../public/index.html'));
  }

  mainWindow.webContents.on('did-fail-load', (event, errorCode, errorDescription) => {
    console.error('Failed to load:', errorCode, errorDescription);
  });
}

// Uygulama hazır olduğunda
app.whenReady().then(() => {
  createWindow();

  // macOS için pencere yönetimi
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

// Tüm pencereler kapandığında
app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

// IPC Handlers
ipcMain.handle('save-kubeconfig', async (event, { name, config }) => {
  const configs = store.get('kubeconfigs') || {};
  configs[name] = config;
  store.set('kubeconfigs', configs);
  return { success: true };
});

ipcMain.handle('get-kubeconfigs', async () => {
  return store.get('kubeconfigs') || {};
});

// Yerel kubeconfig dosyalarını okuma
ipcMain.handle('get-local-kubeconfig', async () => {
  try {
    const kubeConfigPath = path.join(os.homedir(), '.kube', 'config');
    
    if (fs.existsSync(kubeConfigPath)) {
      const configContent = fs.readFileSync(kubeConfigPath, 'utf-8');
      const kc = new k8s.KubeConfig();
      kc.loadFromString(configContent);
      
      // Tüm context'leri al
      const contexts = kc.getContexts();
      const currentContext = kc.getCurrentContext();
      
      return {
        contexts: contexts.map(context => ({
          name: context.name,
          cluster: context.cluster,
          user: context.user,
          isCurrent: context.name === currentContext
        })),
        config: configContent
      };
    }
    return { contexts: [], config: null };
  } catch (error) {
    console.error('Error reading local kubeconfig:', error);
    return { contexts: [], config: null };
  }
});

// Kubernetes API çağrıları için yardımcı fonksiyon
const setupKubeConfig = (context) => {
  try {
    const kc = new k8s.KubeConfig();
    
    // Context bir string ise (eski kod için geriye uyumluluk)
    if (typeof context === 'string') {
      kc.loadFromString(context);
      return kc;
    }

    // Context bir obje ise ve config varsa
    if (context && context.config) {
      kc.loadFromString(context.config);
      
      // Eğer context.name varsa o context'i kullan
      if (context.name) {
        try {
          kc.setCurrentContext(context.name);
        } catch (error) {
          console.error('Error setting context:', error);
        }
      }
      return kc;
    }

    throw new Error('Invalid context configuration');
  } catch (error) {
    console.error('Error in setupKubeConfig:', error);
    throw error;
  }
};

// Kubernetes işlemleri
ipcMain.handle('get-pods', async (event, context) => {
  try {
    const kc = setupKubeConfig(context);
    const k8sApi = kc.makeApiClient(k8s.CoreV1Api);
    const response = await k8sApi.listPodForAllNamespaces();
    return response.body;
  } catch (error) {
    console.error('Error fetching pods:', error);
    throw error;
  }
});

ipcMain.handle('get-deployments', async (event, context) => {
  try {
    const kc = setupKubeConfig(context);
    const k8sApi = kc.makeApiClient(k8s.AppsV1Api);
    const response = await k8sApi.listDeploymentForAllNamespaces();
    return response.body;
  } catch (error) {
    console.error('Error fetching deployments:', error);
    throw error;
  }
});

ipcMain.handle('get-services', async (event, context) => {
  try {
    const kc = setupKubeConfig(context);
    const k8sApi = kc.makeApiClient(k8s.CoreV1Api);
    const response = await k8sApi.listServiceForAllNamespaces();
    return response.body;
  } catch (error) {
    console.error('Error fetching services:', error);
    throw error;
  }
});

ipcMain.handle('get-configmaps', async (event, context) => {
  try {
    const kc = setupKubeConfig(context);
    const k8sApi = kc.makeApiClient(k8s.CoreV1Api);
    const response = await k8sApi.listConfigMapForAllNamespaces();
    return response.body;
  } catch (error) {
    console.error('Error fetching configmaps:', error);
    throw error;
  }
});

ipcMain.handle('get-secrets', async (event, context) => {
  try {
    const kc = setupKubeConfig(context);
    const k8sApi = kc.makeApiClient(k8s.CoreV1Api);
    const response = await k8sApi.listSecretForAllNamespaces();
    return response.body;
  } catch (error) {
    console.error('Error fetching secrets:', error);
    throw error;
  }
});

ipcMain.handle('get-pvs', async (event, context) => {
  try {
    const kc = setupKubeConfig(context);
    const k8sApi = kc.makeApiClient(k8s.CoreV1Api);
    const response = await k8sApi.listPersistentVolume();
    return response.body;
  } catch (error) {
    console.error('Error fetching persistent volumes:', error);
    throw error;
  }
});

// Helm Releases
ipcMain.handle('get-helm-releases', async (event, context) => {
  try {
    const kc = setupKubeConfig(context);
    const k8sApi = kc.makeApiClient(k8s.CustomObjectsApi);
    
    // Helm v3 releases için
    try {
      const response = await k8sApi.listClusterCustomObject(
        'helm.sh',  // Doğru API grubu
        'v1',       // API versiyonu
        'releases'  // Çoğul kaynak adı
      );
      return response.body;
    } catch (helmError) {
      console.log('Trying alternative Helm API...');
      // Alternatif olarak namespace bazlı sorgu
      const namespaces = await kc.makeApiClient(k8s.CoreV1Api).listNamespace();
      const releases = [];
      
      for (const ns of namespaces.body.items) {
        try {
          const nsReleases = await k8sApi.listNamespacedCustomObject(
            'helm.sh',
            'v1',
            ns.metadata.name,
            'releases'
          );
          releases.push(...nsReleases.body.items);
        } catch (e) {
          console.log(`No Helm releases in namespace ${ns.metadata.name}`);
        }
      }
      
      return { items: releases };
    }
  } catch (error) {
    console.error('Error fetching helm releases:', error);
    return { items: [] }; // Hata durumunda boş liste dön
  }
});

// Helm Charts (Optional - Helm repository'lerindeki mevcut chart'ları listelemek için)
ipcMain.handle('get-helm-charts', async (event, context) => {
  try {
    const kc = setupKubeConfig(context);
    const k8sApi = kc.makeApiClient(k8s.CustomObjectsApi);
    
    try {
      const response = await k8sApi.listClusterCustomObject(
        'helm.sh',
        'v1',
        'charts'
      );
      return response.body;
    } catch (error) {
      console.error('Error fetching helm charts:', error);
      return { items: [] };
    }
  } catch (error) {
    console.error('Error in helm charts handler:', error);
    return { items: [] };
  }
});

// StatefulSets
ipcMain.handle('get-statefulsets', async (event, context) => {
  try {
    const kc = setupKubeConfig(context);
    const k8sApi = kc.makeApiClient(k8s.AppsV1Api);
    const response = await k8sApi.listStatefulSetForAllNamespaces();
    return response.body;
  } catch (error) {
    console.error('Error fetching statefulsets:', error);
    throw error;
  }
});

// DaemonSets
ipcMain.handle('get-daemonsets', async (event, context) => {
  try {
    const kc = setupKubeConfig(context);
    const k8sApi = kc.makeApiClient(k8s.AppsV1Api);
    const response = await k8sApi.listDaemonSetForAllNamespaces();
    return response.body;
  } catch (error) {
    console.error('Error fetching daemonsets:', error);
    throw error;
  }
});

// Ingresses
ipcMain.handle('get-ingresses', async (event, context) => {
  try {
    const kc = setupKubeConfig(context);
    const k8sApi = kc.makeApiClient(k8s.NetworkingV1Api);
    const response = await k8sApi.listIngressForAllNamespaces();
    return response.body;
  } catch (error) {
    console.error('Error fetching ingresses:', error);
    throw error;
  }
});

// PersistentVolumeClaims
ipcMain.handle('get-pvcs', async (event, context) => {
  try {
    const kc = setupKubeConfig(context);
    const k8sApi = kc.makeApiClient(k8s.CoreV1Api);
    const response = await k8sApi.listPersistentVolumeClaimForAllNamespaces();
    return response.body;
  } catch (error) {
    console.error('Error fetching pvcs:', error);
    throw error;
  }
});

// CronJobs
ipcMain.handle('get-cronjobs', async (event, context) => {
  try {
    const kc = setupKubeConfig(context);
    const k8sApi = kc.makeApiClient(k8s.BatchV1Api);
    const response = await k8sApi.listCronJobForAllNamespaces();
    return response.body;
  } catch (error) {
    console.error('Error fetching cronjobs:', error);
    throw error;
  }
});

// Jobs
ipcMain.handle('get-jobs', async (event, context) => {
  try {
    const kc = setupKubeConfig(context);
    const k8sApi = kc.makeApiClient(k8s.BatchV1Api);
    const response = await k8sApi.listJobForAllNamespaces();
    return response.body;
  } catch (error) {
    console.error('Error fetching jobs:', error);
    throw error;
  }
});

// Events
ipcMain.handle('get-events', async (event, context) => {
  try {
    const kc = setupKubeConfig(context);
    const k8sApi = kc.makeApiClient(k8s.CoreV1Api);
    const response = await k8sApi.listEventForAllNamespaces();
    return response.body;
  } catch (error) {
    console.error('Error fetching events:', error);
    throw error;
  }
});

// Pod'da komut çalıştırma
ipcMain.handle('exec-in-pod', async (event, { namespace, podName, command }) => {
  try {
    const kc = setupKubeConfig(context);
    const k8sApi = kc.makeApiClient(k8s.CoreV1Api);
    
    const exec = new k8s.Exec(kc);
    const result = await exec.exec(
      namespace,
      podName,
      'sh',
      ['-c', command],
      process.stdout,
      process.stderr,
      process.stdin,
      true
    );
    
    return result;
  } catch (error) {
    console.error('Error executing command in pod:', error);
    throw error;
  }
});

// YAML uygulama
ipcMain.handle('apply-yaml', async (event, yamlContent) => {
  try {
    const kc = setupKubeConfig(context);
    const k8sApi = kc.makeApiClient(k8s.KubernetesObjectApi);
    
    const resources = k8s.loadAllYaml(yamlContent);
    const results = [];
    
    for (const resource of resources) {
      const result = await k8sApi.create(resource);
      results.push(result);
    }
    
    return results;
  } catch (error) {
    console.error('Error applying YAML:', error);
    throw error;
  }
}); 