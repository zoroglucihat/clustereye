const k8sManager = require('./KubernetesManager');
const { exec } = require('child_process');
const fs = require('fs');
const k8s = require('@kubernetes/client-node');

class HelmManager {
  async getReleases(context) {
    try {
      if (!context?.config) {
        return {
          success: false,
          message: 'No context configuration provided',
          releases: []
        };
      }

      await k8sManager.setupKubernetesClient(context);
      const customApi = k8sManager.getConfig().makeApiClient(k8s.CustomObjectsApi);
      
      try {
        const { body } = await customApi.listClusterCustomObject('helm.sh', 'v1', 'releases');
        const releases = body.items.map(item => ({
          name: item.metadata.name,
          namespace: item.metadata.namespace,
          version: item.version,
          // ... diğer release detayları
        }));
        return { success: true, releases };
      } catch (error) {
        // Alternatif yöntem implementasyonu...
      }
    } catch (error) {
      console.error('Error in get-helm-releases:', error);
      return {
        success: false,
        message: error.message,
        releases: []
      };
    }
  }

  async deleteRelease({ name, namespace, context }) {
    try {
      const tempKubeconfig = `/tmp/kubeconfig-${Date.now()}`;
      fs.writeFileSync(tempKubeconfig, context.config);

      return new Promise((resolve, reject) => {
        exec(`helm uninstall ${name} -n ${namespace} --kubeconfig ${tempKubeconfig}`, 
          (error, stdout, stderr) => {
            try { fs.unlinkSync(tempKubeconfig); } catch (err) { /* ignore */ }
            
            if (error) {
              reject(error);
              return;
            }
            resolve({ success: true, message: `Successfully uninstalled release "${name}"` });
        });
      });
    } catch (error) {
      return { success: false, message: error.message };
    }
  }
}

module.exports = new HelmManager(); 