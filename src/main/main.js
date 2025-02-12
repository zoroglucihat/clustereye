require('dotenv').config();
const { app, BrowserWindow, ipcMain, Menu } = require('electron');
const path = require('path');
const Store = require('electron-store');
const k8s = require('@kubernetes/client-node');
const fs = require('fs');
const os = require('os');
const YAML = require('yaml');
const { exec } = require('child_process');
const OpenAI = require('openai');
const { spawn } = require('child_process');

const store = new Store();

let mainWindow = null;  // mainWindow'u global olarak tutuyoruz
let kc;

// Kubernetes istemci yönetimi için global değişkenler
let k8sConfig = null;
let k8sApi = null;

// OpenAI istemcisi
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

function createWindow() {
  // Debug için bekleme noktası
  debugger;

  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    backgroundColor: '#0a1929',
    icon: path.join(__dirname, '../assets/logo.png'),
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

  // Kubernetes yapılandırması için debug noktası
  debugger;
  try {
    // Önce varsayılan kubeconfig dosyasını yükle
    kc = new k8s.KubeConfig();
    kc.loadFromDefault();
  } catch (error) {
    console.error('Error loading default kubeconfig:', error);
    // Varsayılan yükleme başarısız olursa $HOME/.kube/config'i dene
    try {
      const kubeConfigPath = path.join(os.homedir(), '.kube', 'config');
      kc = new k8s.KubeConfig();
      kc.loadFromFile(kubeConfigPath);
    } catch (err) {
      console.error('Error loading kubeconfig from file:', err);
    }
  }

  // Kubernetes API client'larını oluştur
  k8sApi = kc ? kc.makeApiClient(k8s.CoreV1Api) : null;
  const k8sAppsApi = kc ? kc.makeApiClient(k8s.AppsV1Api) : null;

  // DevTools'u her zaman aç
  mainWindow.webContents.openDevTools();

  // Clipboard erişimi için menü oluştur
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

  // IPC handlers
  ipcMain.handle('get-contexts', () => {
    try {
      return kc ? kc.getContexts() : [];
    } catch (error) {
      console.error('Error getting contexts:', error);
      return [];
    }
  });

  ipcMain.handle('get-current-context', () => {
    try {
      return kc ? kc.getCurrentContext() : null;
    } catch (error) {
      console.error('Error getting current context:', error);
      return null;
    }
  });

  if (process.env.NODE_ENV === 'development') {
    mainWindow.loadURL('http://localhost:8081/index.html');
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
    // Önceki API istemcilerini temizle
    if (k8sApi) {
      Object.values(k8sApi).forEach(client => {
        if (client?.apiClient?.axios) {
          // Axios instance'ını temizle
          client.apiClient.axios.interceptors.request.clear();
          client.apiClient.axios.interceptors.response.clear();
        }
      });
    }
    
    // k8sApi'yi sıfırla
    k8sApi = null;
    k8sConfig = null;

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

    // Request yapılandırması
    const defaultRequestOptions = {
      timeout: 10000,
      maxRedirects: 5,
      // DNS çözümleme hatası için retry mekanizması
      retry: 3,
      retryDelay: 1000,
      // SSL/TLS ayarları
      strictSSL: false,
      rejectUnauthorized: false,
      // Keep-alive ayarları
      keepAlive: true,
      keepAliveMsecs: 3000,
      // Proxy ayarları (eğer gerekirse)
      proxy: process.env.HTTPS_PROXY || process.env.HTTP_PROXY
    };

    // Her bir API istemcisi için yapılandırmayı ayarla
    Object.values(k8sApi).forEach(client => {
      if (client.apiClient) {
        // Axios instance'ını yapılandır
        client.apiClient.axios.defaults = {
          ...client.apiClient.axios.defaults,
          ...defaultRequestOptions,
          validateStatus: (status) => status >= 200 && status < 300
        };

        // Retry interceptor'ı ekle
        client.apiClient.axios.interceptors.response.use(undefined, async (err) => {
          const config = err.config;
          
          // Retry sayacını kontrol et
          if (!config || !config.retry || config._retryCount >= config.retry) {
            return Promise.reject(err);
          }

          // Retry sayacını artır
          config._retryCount = config._retryCount || 0;
          config._retryCount++;

          // Retry delay
          await new Promise(resolve => setTimeout(resolve, config.retryDelay));

          // İsteği tekrar dene
          return client.apiClient.axios(config);
        });
      }
    });

    // Test bağlantısı
    try {
      await k8sApi.core.listNamespace();
      console.log('Successfully connected to cluster');
      return true;
    } catch (error) {
      console.error('Connection test failed:', error);
      throw new Error(`Failed to connect to cluster: ${error.message}`);
    }

  } catch (error) {
    console.error('Error setting up Kubernetes client:', error);
    throw error;
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

// Pod exec handler
ipcMain.handle('exec-in-pod', async (event, { namespace, podName, context }) => {
  try {
    if (!context?.config) {
      throw new Error('No context provided');
    }

    // Kubernetes client'ı ayarla
    await setupKubernetesClient(context);

    // Önce pod'un var olduğunu kontrol et
    try {
      const pod = await k8sApi.core.readNamespacedPod(podName, namespace);
      console.log('Pod found:', pod.body.metadata.name);
    } catch (error) {
      console.error('Pod not found:', error);
      throw new Error(`Pod "${podName}" not found in namespace "${namespace}"`);
    }

    // Geçici bir kubeconfig dosyası oluştur
    const tempKubeconfig = `/tmp/kubeconfig-${Date.now()}`;
    fs.writeFileSync(tempKubeconfig, context.config);

    // kubectl exec komutunu çalıştır
    const shell = spawn('kubectl', [
      '--kubeconfig', tempKubeconfig,
      'exec',
      '-n', namespace,
      podName,
      '-it',
      '--',
      '/bin/sh'
    ], {
      stdio: ['pipe', 'pipe', 'pipe'],
      env: {
        ...process.env,
        TERM: 'xterm-256color'
      }
    });

    // Terminal çıktılarını yönet
    shell.stdout.on('data', (data) => {
      console.log('Terminal output:', data.toString());
      event.sender.send('terminal-output', data.toString());
    });

    shell.stderr.on('data', (data) => {
      console.error('Terminal error:', data.toString());
      event.sender.send('terminal-error', data.toString());
    });

    shell.on('close', (code) => {
      console.log('Terminal closed with code:', code);
      event.sender.send('terminal-closed', code);
      // Geçici kubeconfig dosyasını temizle
      try {
        fs.unlinkSync(tempKubeconfig);
      } catch (error) {
        console.error('Error cleaning up temp kubeconfig:', error);
      }
    });

    // Terminal input handler
    ipcMain.on('terminal-input', (e, input) => {
      if (shell.stdin.writable) {
        shell.stdin.write(input);
      }
    });

    return {
      success: true,
      message: 'Connected to pod successfully'
    };

  } catch (error) {
    console.error('Error in exec-in-pod:', error);
    return {
      success: false,
      message: error.message || 'Failed to connect to pod'
    };
  }
});

// Terminal input handler
ipcMain.on('terminal-input', (event, { sessionId, data }) => {
  try {
    const websocket = activeWebSockets.get(sessionId);
    if (websocket && websocket.readyState === websocket.OPEN) {
      websocket.send(data);
    }
  } catch (error) {
    console.error('Error sending terminal input:', error);
  }
});

// WebSocket bağlantılarını saklamak için Map
const activeWebSockets = new Map();

// Terminal oturumu başlatma handler'ı ekleyelim
ipcMain.handle('start-terminal-session', async (event, { namespace, podName, context }) => {
  try {
    const shell = spawn('kubectl', [
      'exec',
      '-n', namespace,
      podName,
      '-it',
      '--',
      '/bin/sh'
    ], {
      stdio: ['pipe', 'pipe', 'pipe'],
      shell: true
    });

    shell.stdout.on('data', (data) => {
      event.sender.send('terminal-output', data.toString());
    });

    shell.stderr.on('data', (data) => {
      event.sender.send('terminal-error', data.toString());
    });

    return {
      success: true,
      message: 'Terminal session started'
    };
  } catch (error) {
    console.error('Error starting terminal session:', error);
    return {
      success: false,
      message: error.message
    };
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

// Generic delete resource handler
ipcMain.handle('delete-resource', async (event, { namespace, name, kind, context }) => {
  try {
    await setupKubernetesClient(context);
    
    // Her kaynak türü için uygun API çağrısını yap
    switch (kind) {
      case 'Pod':
        await k8sApi.core.deleteNamespacedPod(name, namespace);
        break;
      case 'Deployment':
        await k8sApi.apps.deleteNamespacedDeployment(name, namespace);
        break;
      case 'Service':
        await k8sApi.core.deleteNamespacedService(name, namespace);
        break;
      case 'ConfigMap':
        await k8sApi.core.deleteNamespacedConfigMap(name, namespace);
        break;
      case 'Secret':
        await k8sApi.core.deleteNamespacedSecret(name, namespace);
        break;
      case 'PersistentVolume':
        await k8sApi.core.deletePersistentVolume(name);
        break;
      case 'StatefulSet':
        await k8sApi.apps.deleteNamespacedStatefulSet(name, namespace);
        break;
      case 'DaemonSet':
        await k8sApi.apps.deleteNamespacedDaemonSet(name, namespace);
        break;
      case 'Ingress':
        await k8sApi.networking.deleteNamespacedIngress(name, namespace);
        break;
      case 'PersistentVolumeClaim':
        await k8sApi.core.deleteNamespacedPersistentVolumeClaim(name, namespace);
        break;
      case 'CronJob':
        await k8sApi.batch.deleteNamespacedCronJob(name, namespace);
        break;
      case 'Job':
        await k8sApi.batch.deleteNamespacedJob(name, namespace);
        break;
      default:
        throw new Error(`Unsupported resource kind: ${kind}`);
    }

    return {
      success: true,
      message: `${kind} deleted successfully`
    };
  } catch (error) {
    console.error(`Error deleting ${kind}:`, error);
    return {
      success: false,
      message: error.message
    };
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

// AI Advisor handler
ipcMain.handle('ask-advisor', async (event, { message, model, context }) => {
  try {
    // Debug için log ekleyelim
    console.log('Starting AI analysis with context:', {
      contextName: context?.name,
      model: model
    });

    // Cluster bilgilerini al
    const clusterInfo = await getClusterInfo(context);

    const systemPrompt = `You are Second Eye Advisor, an expert Kubernetes cluster analyst.
    Current cluster context: ${context?.name}
    ${clusterInfo.summary}`;

    const response = await openai.chat.completions.create({
      model: "gpt-4", // veya model parametresine göre seç
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: message }
      ],
      temperature: 0.7,
      max_tokens: 1500
    });

    if (!response.choices || !response.choices[0]?.message?.content) {
      throw new Error('Invalid response from OpenAI');
    }

    return response.choices[0].message.content;

  } catch (error) {
    console.error('Error in AI advisor:', error);
    throw new Error(`Connection error: ${error.message}. Please try again.`);
  }
});

// Cluster bilgilerini topla
async function getClusterInfo(context) {
  try {
    await setupKubernetesClient(context);
    
    // Tüm cluster kaynaklarını al
    const [
      nodes,
      pods,
      deployments,
      services,
      ingresses,
      configmaps,
      pvs,
      pvcs,
      events,
      namespaces,
      daemonsets,
      statefulsets,
      jobs,
      cronjobs
    ] = await Promise.all([
      k8sApi.core.listNode().then(res => res.body),
      k8sApi.core.listPodForAllNamespaces().then(res => res.body),
      k8sApi.apps.listDeploymentForAllNamespaces().then(res => res.body),
      k8sApi.core.listServiceForAllNamespaces().then(res => res.body),
      k8sApi.networking.listIngressForAllNamespaces().then(res => res.body),
      k8sApi.core.listConfigMapForAllNamespaces().then(res => res.body),
      k8sApi.core.listPersistentVolume().then(res => res.body),
      k8sApi.core.listPersistentVolumeClaimForAllNamespaces().then(res => res.body),
      k8sApi.core.listEventForAllNamespaces().then(res => res.body),
      k8sApi.core.listNamespace().then(res => res.body),
      k8sApi.apps.listDaemonSetForAllNamespaces().then(res => res.body),
      k8sApi.apps.listStatefulSetForAllNamespaces().then(res => res.body),
      k8sApi.batch.listJobForAllNamespaces().then(res => res.body),
      k8sApi.batch.listCronJobForAllNamespaces().then(res => res.body)
    ]);

    // Node detaylı analizi
    const nodeAnalysis = nodes.items.map(node => ({
      name: node.metadata.name,
      status: node.status.conditions.find(c => c.type === 'Ready')?.status,
      capacity: node.status.capacity,
      allocatable: node.status.allocatable,
      used: {
        cpu: node.status.allocatable.cpu - node.status.capacity.cpu,
        memory: `${(1 - (parseInt(node.status.allocatable.memory) / parseInt(node.status.capacity.memory))) * 100}%`
      },
      taints: node.spec.taints || [],
      labels: node.metadata.labels,
      conditions: node.status.conditions,
      podCount: pods.items.filter(pod => pod.spec.nodeName === node.metadata.name).length
    }));

    // Namespace bazlı workload analizi
    const namespaceAnalysis = {};
    namespaces.items.forEach(ns => {
      const nsName = ns.metadata.name;
      namespaceAnalysis[nsName] = {
        pods: pods.items.filter(p => p.metadata.namespace === nsName),
        deployments: deployments.items.filter(d => d.metadata.namespace === nsName),
        services: services.items.filter(s => s.metadata.namespace === nsName),
        ingresses: ingresses.items.filter(i => i.metadata.namespace === nsName),
        configmaps: configmaps.items.filter(c => c.metadata.namespace === nsName),
        pvcs: pvcs.items.filter(p => p.metadata.namespace === nsName),
        events: events.items.filter(e => e.metadata.namespace === nsName)
      };
    });

    // Kritik durumları analiz et
    const criticalIssues = [];
    
    // Node sorunları
    nodes.items.forEach(node => {
      const notReadyCondition = node.status.conditions.find(c => c.type === 'Ready' && c.status !== 'True');
      if (notReadyCondition) {
        criticalIssues.push(`Node ${node.metadata.name} is not ready: ${notReadyCondition.message}`);
      }
    });

    // Pod sorunları
    pods.items.forEach(pod => {
      if (pod.status.phase === 'Failed' || pod.status.phase === 'Unknown') {
        criticalIssues.push(`Pod ${pod.metadata.namespace}/${pod.metadata.name} is in ${pod.status.phase} state`);
      }
      
      const crashLoopBackOff = pod.status.containerStatuses?.some(
        status => status.state.waiting?.reason === 'CrashLoopBackOff'
      );
      if (crashLoopBackOff) {
        criticalIssues.push(`Pod ${pod.metadata.namespace}/${pod.metadata.name} is in CrashLoopBackOff`);
      }

      const highRestarts = pod.status.containerStatuses?.some(
        status => status.restartCount > 5
      );
      if (highRestarts) {
        criticalIssues.push(`Pod ${pod.metadata.namespace}/${pod.metadata.name} has high restart count`);
      }
    });

    // Resource kullanım analizi
    const resourceUsage = {
      totalCPU: {
        capacity: nodes.items.reduce((acc, node) => acc + parseInt(node.status.capacity.cpu), 0),
        used: pods.items.reduce((acc, pod) => {
          return acc + (pod.spec.containers.reduce((sum, container) => 
            sum + (parseInt(container.resources.requests?.cpu) || 0), 0));
        }, 0)
      },
      totalMemory: {
        capacity: nodes.items.reduce((acc, node) => acc + parseInt(node.status.capacity.memory), 0),
        used: pods.items.reduce((acc, pod) => {
          return acc + (pod.spec.containers.reduce((sum, container) => 
            sum + (parseInt(container.resources.requests?.memory) || 0), 0));
        }, 0)
      }
    };

    return {
      summary: `
      Cluster Analysis Summary:
      
      1. Infrastructure Overview:
      - Total Nodes: ${nodes.items.length}
      - Ready Nodes: ${nodeAnalysis.filter(n => n.status === 'True').length}
      - Total CPU Capacity: ${resourceUsage.totalCPU.capacity} cores
      - Total Memory Capacity: ${resourceUsage.totalMemory.capacity}
      - CPU Usage: ${((resourceUsage.totalCPU.used / resourceUsage.totalCPU.capacity) * 100).toFixed(2)}%
      - Memory Usage: ${((resourceUsage.totalMemory.used / resourceUsage.totalMemory.capacity) * 100).toFixed(2)}%

      2. Workload Statistics:
      - Total Namespaces: ${namespaces.items.length}
      - Total Pods: ${pods.items.length} (${pods.items.filter(p => p.status.phase === 'Running').length} Running)
      - Deployments: ${deployments.items.length}
      - StatefulSets: ${statefulsets.items.length}
      - DaemonSets: ${daemonsets.items.length}
      - Services: ${services.items.length}
      - Ingresses: ${ingresses.items.length}
      - Jobs: ${jobs.items.length}
      - CronJobs: ${cronjobs.items.length}

      3. Storage Status:
      - PersistentVolumes: ${pvs.items.length}
      - PersistentVolumeClaims: ${pvcs.items.length}
      - ConfigMaps: ${configmaps.items.length}

      4. Critical Issues (${criticalIssues.length}):
      ${criticalIssues.map(issue => `- ${issue}`).join('\n')}

      5. Node Details:
      ${nodeAnalysis.map(node => `
      * ${node.name}:
        - Status: ${node.status}
        - CPU: ${node.allocatable.cpu}/${node.capacity.cpu}
        - Memory: ${node.allocatable.memory}/${node.capacity.memory}
        - Pods: ${node.podCount}
        - Conditions: ${node.conditions.map(c => `${c.type}=${c.status}`).join(', ')}
      `).join('\n')}

      6. Namespace Overview:
      ${Object.entries(namespaceAnalysis).map(([ns, resources]) => `
      * ${ns}:
        - Pods: ${resources.pods.length} (${resources.pods.filter(p => p.status.phase === 'Running').length} Running)
        - Deployments: ${resources.deployments.length}
        - Services: ${resources.services.length}
        - Ingresses: ${resources.ingresses.length}
        - Recent Events: ${resources.events.length}
      `).join('\n')}
      `,
      details: {
        nodeAnalysis,
        namespaceAnalysis,
        criticalIssues,
        resourceUsage
      }
    };
  } catch (error) {
    console.error('Error getting cluster info:', error);
    return {
      summary: `Unable to fetch detailed cluster information: ${error.message}`,
      details: null
    };
  }
}

// Context değiştirme ve bağlantı testi için handler
ipcMain.handle('switch-context', async (event, context) => {
  try {
    console.log('Switching to context:', context?.name);

    if (!context?.config) {
      throw new Error('Invalid context configuration');
    }

    // Önce bağlantıyı test et
    const connected = await setupKubernetesClient(context);
    if (!connected) {
      throw new Error('Could not establish connection to cluster');
    }

    // Test için basit bir API çağrısı yap
    try {
      await k8sApi.core.listNamespace();
    } catch (error) {
      throw new Error(`Connection test failed: ${error.message}`);
    }

    return {
      success: true,
      message: `Successfully connected to cluster "${context.name}"`
    };

  } catch (error) {
    console.error('Error switching context:', error);
    return {
      success: false,
      message: `Failed to connect to cluster "${context?.name}": ${error.message}`,
      details: {
        cluster: context?.cluster,
        user: context?.user,
        error: error.message
      }
    };
  }
});

// Scale deployment handler
ipcMain.handle('scale-deployment', async (event, { namespace, name, replicas, context }) => {
  try {
    await setupKubernetesClient(context);
    const response = await k8sApi.apps.patchNamespacedDeployment(
      name,
      namespace,
      [{ op: 'replace', path: '/spec/replicas', value: replicas }],
      undefined,
      undefined,
      undefined,
      undefined,
      { headers: { 'Content-Type': 'application/json-patch+json' } }
    );
    return {
      success: true,
      message: `Deployment scaled to ${replicas} replicas`
    };
  } catch (error) {
    console.error('Error scaling deployment:', error);
    return {
      success: false,
      message: error.message
    };
  }
});

// Delete deployment handler
ipcMain.handle('delete-deployment', async (event, { namespace, name, context }) => {
  try {
    await setupKubernetesClient(context);
    await k8sApi.apps.deleteNamespacedDeployment(name, namespace);
    return {
      success: true,
      message: 'Deployment deleted successfully'
    };
  } catch (error) {
    console.error('Error deleting deployment:', error);
    return {
      success: false,
      message: error.message
    };
  }
}); 