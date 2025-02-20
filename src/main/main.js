require('dotenv').config();
const { app, ipcMain } = require('electron');
const k8sManager = require('./services/KubernetesManager');
const resourceManager = require('./services/ResourceManager');
const configManager = require('./services/ConfigManager');
const helmManager = require('./services/HelmManager');
const terminalManager = require('./services/TerminalManager');
const aiAdvisor = require('./services/AIAdvisor');
const windowManager = require('./services/WindowManager');
const yamlManager = require('./services/YAMLManager');
const logger = require('./services/LogManager');

// App lifecycle
app.whenReady().then(() => {
  windowManager.createWindow();
  
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      windowManager.createWindow();
    }
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

// Config handlers
ipcMain.handle('save-kubeconfig', (event, config) => configManager.saveKubeconfig(config));
ipcMain.handle('get-kubeconfigs', () => configManager.getKubeconfigs());
ipcMain.handle('get-local-kubeconfig', () => configManager.getLocalKubeconfig());

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

// Resource management handlers
ipcMain.handle('delete-resource', (event, params) => resourceManager.deleteResource(params));
ipcMain.handle('scale-deployment', (event, params) => resourceManager.scaleDeployment(params));

// Helm handlers
ipcMain.handle('get-helm-releases', (event, context) => helmManager.getReleases(context));
ipcMain.handle('delete-helm-release', (event, params) => helmManager.deleteRelease(params));

// Terminal handlers
ipcMain.handle('exec-in-pod', (event, params) => terminalManager.execInPod({ ...params, event }));
ipcMain.handle('start-terminal-session', (event, params) => terminalManager.startTerminalSession({ ...params, event }));
ipcMain.handle('get-logs', (event, params) => terminalManager.getLogs(params));
ipcMain.on('terminal-input', (event, params) => terminalManager.handleTerminalInput(event, params));

// AI Advisor handlers
ipcMain.handle('ask-advisor', (event, params) => aiAdvisor.getAdvice(params));

// YAML handlers
ipcMain.handle('apply-yaml', (event, params) => yamlManager.applyYAML(params));
ipcMain.handle('exec-command', (event, params) => yamlManager.execCommand(params));

// Kubernetes connection handlers
ipcMain.handle('test-connection', (event, context) => k8sManager.testConnection(context));
ipcMain.handle('switch-context', (event, context) => k8sManager.switchContext(context));