const Store = require('electron-store');
const path = require('path');
const fs = require('fs');
const os = require('os');
const k8s = require('@kubernetes/client-node');

class ConfigManager {
  constructor() {
    this.store = new Store();
  }

  async saveKubeconfig({ name, config }) {
    const configs = this.store.get('kubeconfigs') || {};
    configs[name] = config;
    this.store.set('kubeconfigs', configs);
    return { success: true };
  }

  async getKubeconfigs() {
    return this.store.get('kubeconfigs') || {};
  }

  async getLocalKubeconfig() {
    try {
      const kubeConfigPath = path.join(os.homedir(), '.kube', 'config');
      
      if (fs.existsSync(kubeConfigPath)) {
        const configContent = fs.readFileSync(kubeConfigPath, 'utf-8');
        const kc = new k8s.KubeConfig();
        kc.loadFromString(configContent);
        
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
  }
}

module.exports = new ConfigManager(); 