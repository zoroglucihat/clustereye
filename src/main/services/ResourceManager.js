const k8s = require('@kubernetes/client-node');

class ResourceManager {
  constructor() {
    this.k8sConfig = null;
    this.k8sApi = null;
  }

  async setupClient(contextConfig) {
    try {
      if (this.k8sApi) {
        Object.values(this.k8sApi).forEach(client => {
          if (client?.apiClient?.axios) {
            client.apiClient.axios.interceptors.request.clear();
            client.apiClient.axios.interceptors.response.clear();
          }
        });
      }
      
      this.k8sApi = null;
      this.k8sConfig = null;

      if (!contextConfig?.config) {
        throw new Error('Invalid context configuration');
      }

      this.k8sConfig = new k8s.KubeConfig();
      this.k8sConfig.loadFromString(contextConfig.config);

      if (contextConfig.name) {
        this.k8sConfig.setCurrentContext(contextConfig.name);
      }

      this.k8sApi = {
        core: this.k8sConfig.makeApiClient(k8s.CoreV1Api),
        apps: this.k8sConfig.makeApiClient(k8s.AppsV1Api),
        batch: this.k8sConfig.makeApiClient(k8s.BatchV1Api),
        networking: this.k8sConfig.makeApiClient(k8s.NetworkingV1Api)
      };

      return true;
    } catch (error) {
      console.error('Error setting up client:', error);
      throw error;
    }
  }

  async getPods(context) {
    try {
      await this.setupClient(context);
      const response = await this.k8sApi.core.listPodForAllNamespaces();
      return response.body;
    } catch (error) {
      console.error('Error fetching pods:', error);
      throw error;
    }
  }

  async getDeployments(context) {
    try {
      await this.setupClient(context);
      const response = await this.k8sApi.apps.listDeploymentForAllNamespaces();
      return response.body;
    } catch (error) {
      console.error('Error fetching deployments:', error);
      throw error;
    }
  }

  async getServices(context) {
    try {
      await this.setupClient(context);
      const response = await this.k8sApi.core.listServiceForAllNamespaces();
      return response.body;
    } catch (error) {
      console.error('Error fetching services:', error);
      throw error;
    }
  }

  async getStatefulSets(context) {
    try {
      await this.setupClient(context);
      const response = await this.k8sApi.apps.listStatefulSetForAllNamespaces();
      return response.body;
    } catch (error) {
      console.error('Error fetching statefulsets:', error);
      throw error;
    }
  }

  async getDaemonSets(context) {
    try {
      await this.setupClient(context);
      const response = await this.k8sApi.apps.listDaemonSetForAllNamespaces();
      return response.body;
    } catch (error) {
      console.error('Error fetching daemonsets:', error);
      throw error;
    }
  }

  async getJobs(context) {
    try {
      await this.setupClient(context);
      const response = await this.k8sApi.batch.listJobForAllNamespaces();
      return response.body;
    } catch (error) {
      console.error('Error fetching jobs:', error);
      throw error;
    }
  }

  async getCronJobs(context) {
    try {
      await this.setupClient(context);
      const response = await this.k8sApi.batch.listCronJobForAllNamespaces();
      return response.body;
    } catch (error) {
      console.error('Error fetching cronjobs:', error);
      throw error;
    }
  }

  async getIngresses(context) {
    try {
      await this.setupClient(context);
      const response = await this.k8sApi.networking.listIngressForAllNamespaces();
      return response.body;
    } catch (error) {
      console.error('Error fetching ingresses:', error);
      throw error;
    }
  }

  async getConfigMaps(context) {
    try {
      await this.setupClient(context);
      const response = await this.k8sApi.core.listConfigMapForAllNamespaces();
      return response.body;
    } catch (error) {
      console.error('Error fetching configmaps:', error);
      throw error;
    }
  }

  async getSecrets(context) {
    try {
      await this.setupClient(context);
      const response = await this.k8sApi.core.listSecretForAllNamespaces();
      return response.body;
    } catch (error) {
      console.error('Error fetching secrets:', error);
      throw error;
    }
  }

  async getPVs(context) {
    try {
      await this.setupClient(context);
      const response = await this.k8sApi.core.listPersistentVolume();
      return response.body;
    } catch (error) {
      console.error('Error fetching PVs:', error);
      throw error;
    }
  }

  async getPVCs(context) {
    try {
      await this.setupClient(context);
      const response = await this.k8sApi.core.listPersistentVolumeClaimForAllNamespaces();
      return response.body;
    } catch (error) {
      console.error('Error fetching PVCs:', error);
      throw error;
    }
  }

  async getEvents(context) {
    try {
      await this.setupClient(context);
      const response = await this.k8sApi.core.listEventForAllNamespaces();
      return response.body;
    } catch (error) {
      console.error('Error fetching events:', error);
      throw error;
    }
  }

  async scaleDeployment({ namespace, name, replicas, context }) {
    try {
      await this.setupClient(context);
      await this.k8sApi.apps.patchNamespacedDeployment(
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
  }

  async deleteDeployment({ namespace, name, context }) {
    try {
      await this.setupClient(context);
      await this.k8sApi.apps.deleteNamespacedDeployment(name, namespace);
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
  }

  async deleteResource({ namespace, name, kind, context }) {
    try {
      await this.setupClient(context);
      
      switch (kind) {
        case 'Pod':
          await this.k8sApi.core.deleteNamespacedPod(name, namespace);
          break;
        case 'Deployment':
          await this.k8sApi.apps.deleteNamespacedDeployment(name, namespace);
          break;
        case 'Service':
          await this.k8sApi.core.deleteNamespacedService(name, namespace);
          break;
        case 'ConfigMap':
          await this.k8sApi.core.deleteNamespacedConfigMap(name, namespace);
          break;
        case 'Secret':
          await this.k8sApi.core.deleteNamespacedSecret(name, namespace);
          break;
        case 'PersistentVolume':
          await this.k8sApi.core.deletePersistentVolume(name);
          break;
        case 'StatefulSet':
          await this.k8sApi.apps.deleteNamespacedStatefulSet(name, namespace);
          break;
        case 'DaemonSet':
          await this.k8sApi.apps.deleteNamespacedDaemonSet(name, namespace);
          break;
        case 'Ingress':
          await this.k8sApi.networking.deleteNamespacedIngress(name, namespace);
          break;
        case 'PersistentVolumeClaim':
          await this.k8sApi.core.deleteNamespacedPersistentVolumeClaim(name, namespace);
          break;
        case 'CronJob':
          await this.k8sApi.batch.deleteNamespacedCronJob(name, namespace);
          break;
        case 'Job':
          await this.k8sApi.batch.deleteNamespacedJob(name, namespace);
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
  }
}

module.exports = new ResourceManager(); 