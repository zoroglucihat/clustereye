const k8sManager = require('./KubernetesManager');

class ResourceManager {
  async getPods(context) {
    try {
      await k8sManager.setupKubernetesClient(context);
      const response = await k8sManager.getApi().core.listPodForAllNamespaces();
      return response.body;
    } catch (error) {
      console.error('Error fetching pods:', error);
      throw error;
    }
  }

  async getDeployments(context) {
    try {
      await k8sManager.setupKubernetesClient(context);
      const response = await k8sManager.getApi().apps.listDeploymentForAllNamespaces();
      return response.body;
    } catch (error) {
      console.error('Error fetching deployments:', error);
      throw error;
    }
  }

  async getServices(context) {
    try {
      await k8sManager.setupKubernetesClient(context);
      const response = await k8sManager.getApi().core.listServiceForAllNamespaces();
      return response.body;
    } catch (error) {
      console.error('Error fetching services:', error);
      throw error;
    }
  }

  async getConfigMaps(context) {
    try {
      await k8sManager.setupKubernetesClient(context);
      const response = await k8sManager.getApi().core.listConfigMapForAllNamespaces();
      return response.body;
    } catch (error) {
      console.error('Error fetching configmaps:', error);
      throw error;
    }
  }

  // Diğer resource metodları buraya eklenecek...
}

module.exports = new ResourceManager(); 