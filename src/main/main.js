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
const resourceManager = require('./services/ResourceManager');
const helmManager = require('./services/HelmManager');
const connectionManager = require('./services/ConnectionManager');
const terminalManager = require('./services/TerminalManager');

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
    mainWindow.loadURL('http://localhost:8082');
  } else {
    mainWindow.loadFile(path.join(__dirname, '../build/index.html'));
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

// Resource handlers
ipcMain.handle('get-pods', (event, context) => resourceManager.getPods(context));
ipcMain.handle('get-deployments', (event, context) => resourceManager.getDeployments(context));
ipcMain.handle('get-services', (event, context) => resourceManager.getServices(context));
ipcMain.handle('get-configmaps', (event, context) => resourceManager.getConfigMaps(context));
ipcMain.handle('get-secrets', (event, context) => resourceManager.getSecrets(context));
ipcMain.handle('get-pvs', (event, context) => resourceManager.getPVs(context));
ipcMain.handle('get-statefulsets', (event, context) => resourceManager.getStatefulSets(context));
ipcMain.handle('get-daemonsets', (event, context) => resourceManager.getDaemonSets(context));
ipcMain.handle('get-ingresses', (event, context) => resourceManager.getIngresses(context));
ipcMain.handle('get-pvcs', (event, context) => resourceManager.getPVCs(context));
ipcMain.handle('get-cronjobs', (event, context) => resourceManager.getCronJobs(context));
ipcMain.handle('get-jobs', (event, context) => resourceManager.getJobs(context));
ipcMain.handle('get-events', (event, context) => resourceManager.getEvents(context));
ipcMain.handle('scale-deployment', (event, params) => resourceManager.scaleDeployment(params));
ipcMain.handle('delete-deployment', (event, params) => resourceManager.deleteDeployment(params));
ipcMain.handle('delete-resource', (event, params) => resourceManager.deleteResource(params));

// Helm handlers
ipcMain.handle('get-helm-releases', (event, context) => helmManager.getReleases(context));
ipcMain.handle('get-helm-charts', (event, context) => helmManager.getCharts(context));
ipcMain.handle('delete-helm-release', (event, params) => helmManager.deleteRelease(params));

// Terminal handlers
ipcMain.handle('exec-in-pod', (event, params) => terminalManager.execInPod({ ...params, event }));
ipcMain.handle('start-terminal-session', (event, params) => terminalManager.startTerminalSession({ ...params, event }));
ipcMain.handle('get-logs', (event, params) => terminalManager.getLogs(params));
ipcMain.handle('exec-shell', (event, params) => terminalManager.execShell(params));
ipcMain.on('terminal-input', (event, params) => terminalManager.handleTerminalInput(event, params));

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

// Connection handlers
ipcMain.handle('test-connection', (event, context) => connectionManager.testConnection(context));
ipcMain.handle('switch-context', (event, context) => connectionManager.switchContext(context)); 