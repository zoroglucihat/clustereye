const { app, BrowserWindow, ipcMain } = require('electron');
const path = require('path');
const Store = require('electron-store');
const k8s = require('@kubernetes/client-node');
const fs = require('fs');
const os = require('os');
const YAML = require('yaml');
const { exec } = require('child_process');

const store = new Store();

let mainWindow = null;  // mainWindow'u global olarak tutuyoruz

// Kubernetes istemci yönetimi için global değişkenler
let k8sConfig = null;
let k8sApi = null;

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    backgroundColor: '#0a1929',
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false,
      webSecurity: false,
      // Clipboard erişimi için gerekli ayarlar
      enableRemoteModule: true,
      spellcheck: false,
      // Ek güvenlik ayarları
      additionalArguments: ['--enable-features=PlatformHtmlWriter,PlatformClipboard']
    }
  });

  // DevTools'u her zaman aç
  mainWindow.webContents.openDevTools();

  // Clipboard erişimi için menü oluştur
  const { Menu } = require('electron');
  const template = [
    {
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
    }
  ];
  const menu = Menu.buildFromTemplate(template);
  Menu.setApplicationMenu(menu);

  if (process.env.NODE_ENV === 'development') {
    mainWindow.loadURL('http://localhost:8080/index.html');
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

// Kubernetes bağlantısını kur
async function setupKubernetesClient(contextConfig) {
  try {
    if (!contextConfig?.config) {
      throw new Error('Invalid context configuration');
    }

    k8sConfig = new k8s.KubeConfig();
    k8sConfig.loadFromString(contextConfig.config);

    if (contextConfig.name) {
      k8sConfig.setCurrentContext(contextConfig.name);
    }

    // API istemcilerini oluştur
    k8sApi = {
      core: k8sConfig.makeApiClient(k8s.CoreV1Api),
      apps: k8sConfig.makeApiClient(k8s.AppsV1Api),
      batch: k8sConfig.makeApiClient(k8s.BatchV1Api),
      networking: k8sConfig.makeApiClient(k8s.NetworkingV1Api)
    };

    // Timeout ve retry ayarları
    const defaultOptions = {
      timeout: 10000,
      maxRedirects: 5,
      validateStatus: status => status >= 200 && status < 300
    };

    Object.values(k8sApi).forEach(client => {
      client.apiClient.defaultOptions = {
        ...client.apiClient.defaultOptions,
        ...defaultOptions
      };
    });

    // Test bağlantısı
    await k8sApi.core.listNamespace();
    return true;
  } catch (error) {
    console.error('Error setting up Kubernetes client:', error);
    return false;
  }
}

// IPC handlers
ipcMain.handle('get-pods', async (event, context) => {
  try {
    await setupKubernetesClient(context);
    const response = await k8sApi.core.listPodForAllNamespaces();
    return response.body;
  } catch (error) {
    console.error('Error fetching pods:', error);
    throw error;
  }
});

ipcMain.handle('get-deployments', async (event, context) => {
  try {
    await setupKubernetesClient(context);
    const response = await k8sApi.apps.listDeploymentForAllNamespaces();
    return response.body;
  } catch (error) {
    console.error('Error fetching deployments:', error);
    throw error;
  }
});

ipcMain.handle('get-services', async (event, context) => {
  try {
    await setupKubernetesClient(context);
    const response = await k8sApi.core.listServiceForAllNamespaces();
    return response.body;
  } catch (error) {
    console.error('Error fetching services:', error);
    throw error;
  }
});

ipcMain.handle('get-configmaps', async (event, context) => {
  try {
    await setupKubernetesClient(context);
    const response = await k8sApi.core.listConfigMapForAllNamespaces();
    return response.body;
  } catch (error) {
    console.error('Error fetching configmaps:', error);
    throw error;
  }
});

ipcMain.handle('get-secrets', async (event, context) => {
  try {
    await setupKubernetesClient(context);
    const response = await k8sApi.core.listSecretForAllNamespaces();
    return response.body;
  } catch (error) {
    console.error('Error fetching secrets:', error);
    throw error;
  }
});

ipcMain.handle('get-pvs', async (event, context) => {
  try {
    await setupKubernetesClient(context);
    const response = await k8sApi.core.listPersistentVolume();
    return response.body;
  } catch (error) {
    console.error('Error fetching persistent volumes:', error);
    throw error;
  }
});

// Helm Releases
ipcMain.handle('get-helm-releases', async (event, context) => {
  try {
    await setupKubernetesClient(context);
    const k8sApi = k8s.CustomObjectsApi.makeApiClient(k8sConfig);
    
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
      const namespaces = await k8sApi.listNamespace();
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
    await setupKubernetesClient(context);
    const k8sApi = k8s.CustomObjectsApi.makeApiClient(k8sConfig);
    
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
    await setupKubernetesClient(context);
    const response = await k8sApi.apps.listStatefulSetForAllNamespaces();
    return response.body;
  } catch (error) {
    console.error('Error fetching statefulsets:', error);
    throw error;
  }
});

// DaemonSets
ipcMain.handle('get-daemonsets', async (event, context) => {
  try {
    await setupKubernetesClient(context);
    const response = await k8sApi.apps.listDaemonSetForAllNamespaces();
    return response.body;
  } catch (error) {
    console.error('Error fetching daemonsets:', error);
    throw error;
  }
});

// Ingresses
ipcMain.handle('get-ingresses', async (event, context) => {
  try {
    await setupKubernetesClient(context);
    const response = await k8sApi.networking.listIngressForAllNamespaces();
    return response.body;
  } catch (error) {
    console.error('Error fetching ingresses:', error);
    throw error;
  }
});

// PersistentVolumeClaims
ipcMain.handle('get-pvcs', async (event, context) => {
  try {
    await setupKubernetesClient(context);
    const response = await k8sApi.core.listPersistentVolumeClaimForAllNamespaces();
    return response.body;
  } catch (error) {
    console.error('Error fetching pvcs:', error);
    throw error;
  }
});

// CronJobs
ipcMain.handle('get-cronjobs', async (event, context) => {
  try {
    await setupKubernetesClient(context);
    const response = await k8sApi.batch.listCronJobForAllNamespaces();
    return response.body;
  } catch (error) {
    console.error('Error fetching cronjobs:', error);
    throw error;
  }
});

// Jobs
ipcMain.handle('get-jobs', async (event, context) => {
  try {
    await setupKubernetesClient(context);
    const response = await k8sApi.batch.listJobForAllNamespaces();
    return response.body;
  } catch (error) {
    console.error('Error fetching jobs:', error);
    throw error;
  }
});

// Events
ipcMain.handle('get-events', async (event, context) => {
  try {
    await setupKubernetesClient(context);
    const response = await k8sApi.core.listEventForAllNamespaces();
    return response.body;
  } catch (error) {
    console.error('Error fetching events:', error);
    throw error;
  }
});

// Pod'da komut çalıştırma
ipcMain.handle('exec-in-pod', async (event, { namespace, podName, command, context }) => {
  try {
    await setupKubernetesClient(context);
    const exec = new k8s.Exec(k8sConfig);
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

// Debug mode
const DEBUG = true;

// Debug logger
const debugLog = (...args) => {
  if (DEBUG) {
    console.log('[DEBUG]', ...args);
  }
};

// apply-yaml handler'ı
ipcMain.handle('apply-yaml', async (event, { yamlContent, context }) => {
  try {
    debugLog('Received apply-yaml request:', { contextName: context.name });
    
    if (!context?.config) {
      throw new Error('Invalid context configuration');
    }

    // Önce kubectl ile context'i değiştir
    await new Promise((resolve, reject) => {
      exec(`kubectl config use-context ${context.name}`, (error, stdout, stderr) => {
        if (error) {
          debugLog('Error switching context:', error);
          reject(error);
          return;
        }
        debugLog('Successfully switched context:', stdout);
        resolve(stdout);
      });
    });

    // KubeConfig oluştur ve yükle
    const kc = new k8s.KubeConfig();
    kc.loadFromString(context.config);
    
    // Context'i ayarla
    if (context.name) {
      kc.setCurrentContext(context.name);
    }

    // Kubernetes client'ı oluştur
    const client = k8s.KubernetesObjectApi.makeApiClient(kc);

    // YAML'ı parse et
    const documents = YAML.parseAllDocuments(yamlContent).map(doc => doc.toJSON());
    debugLog('Parsed YAML documents:', documents);

    const results = [];

    // Her bir resource için apply işlemi yap
    for (const spec of documents) {
      if (!spec) continue;

      try {
        debugLog(`Applying resource: ${spec.kind}/${spec.metadata?.name}`);
        
        try {
          const response = await client.read(spec);
          // Resource varsa güncelle
          const result = await client.patch(spec);
          results.push({
            status: 'updated',
            kind: spec.kind,
            name: spec.metadata?.name,
            namespace: spec.metadata?.namespace
          });
        } catch (error) {
          if (error.statusCode === 404) {
            // Resource yoksa oluştur
            const result = await client.create(spec);
            results.push({
              status: 'created',
              kind: spec.kind,
              name: spec.metadata?.name,
              namespace: spec.metadata?.namespace
            });
          } else {
            throw error;
          }
        }
      } catch (error) {
        debugLog(`Error applying resource ${spec.kind}/${spec.metadata?.name}:`, error);
        throw error;
      }
    }

    debugLog('Successfully applied all resources:', results);
    return { success: true, results };
  } catch (error) {
    debugLog('Error in apply-yaml:', error);
    return { success: false, message: error.message };
  }
});

// Komut çalıştırma handler'ı
ipcMain.handle('exec-command', async (event, { command, context }) => {
  try {
    // Önce kubectl context'i değiştir
    if (context?.name) {
      await new Promise((resolve, reject) => {
        exec(`kubectl config use-context "${context.name}"`, (error, stdout, stderr) => {
          if (error) {
            console.error('Error switching context:', error);
            reject(error);
            return;
          }
          resolve(stdout);
        });
      });
    }

    // Komutu çalıştır
    return new Promise((resolve, reject) => {
      exec(command, (error, stdout, stderr) => {
        if (error) {
          console.error('Command execution error:', error);
          reject(error);
          return;
        }
        resolve(stdout || stderr);
      });
    });
  } catch (error) {
    console.error('Error in exec-command:', error);
    throw error;
  }
});

// Bağlantı testi için handler
ipcMain.handle('test-connection', async (event, context) => {
  try {
    await setupKubernetesClient(context);
    // Basit bir API çağrısı yap
    await k8sApi.core.listNamespace();
    return true;
  } catch (error) {
    console.error('Connection test failed:', error);
    throw new Error(
      `Kubernetes cluster'a bağlanılamadı: ${error.message}\n` +
      `Cluster: ${context?.cluster}\n` +
      `User: ${context?.user}\n` +
      `Context: ${context?.name}`
    );
  }
});

// Pod loglarını getir
ipcMain.handle('get-logs', async (event, { namespace, name, context }) => {
  try {
    await setupKubernetesClient(context);
    
    // Kubectl ile logları al
    return new Promise((resolve, reject) => {
      exec(`kubectl logs -n ${namespace} ${name}`, (error, stdout, stderr) => {
        if (error) {
          console.error('Error getting logs:', error);
          reject(error);
          return;
        }
        resolve(stdout);
      });
    });
  } catch (error) {
    console.error('Error in get-logs:', error);
    throw error;
  }
});

// Pod silme handler'ı
ipcMain.handle('delete-resource', async (event, { namespace, name, kind, context }) => {
  try {
    await setupKubernetesClient(context);
    
    return new Promise((resolve, reject) => {
      exec(`kubectl delete ${kind.toLowerCase()} -n ${namespace} ${name}`, (error, stdout, stderr) => {
        if (error) {
          console.error('Error deleting resource:', error);
          reject(error);
          return;
        }
        resolve(stdout);
      });
    });
  } catch (error) {
    console.error('Error in delete-resource:', error);
    throw error;
  }
});

// Pod'a shell bağlantısı
ipcMain.handle('exec-shell', async (event, { namespace, name, context }) => {
  try {
    await setupKubernetesClient(context);
    
    return new Promise((resolve, reject) => {
      exec(`kubectl exec -it -n ${namespace} ${name} -- /bin/sh`, (error, stdout, stderr) => {
        if (error) {
          console.error('Error executing shell:', error);
          reject(error);
          return;
        }
        resolve(stdout);
      });
    });
  } catch (error) {
    console.error('Error in exec-shell:', error);
    throw error;
  }
}); 