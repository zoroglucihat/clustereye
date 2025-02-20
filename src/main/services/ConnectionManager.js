const k8s = require('@kubernetes/client-node');

class ConnectionManager {
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

  async testConnection(context) {
    try {
      await this.setupClient(context);
      await this.k8sApi.core.listNamespace();
      return { 
        success: true, 
        message: 'Successfully connected to cluster' 
      };
    } catch (error) {
      console.error('Connection test failed:', error);
      return { 
        success: false, 
        error: `Failed to connect to cluster: ${error.message}`,
        details: {
          cluster: context?.cluster,
          user: context?.user,
          context: context?.name
        }
      };
    }
  }

  async switchContext(context) {
    try {
      console.log('Switching to context:', context?.name);

      if (!context?.config) {
        throw new Error('Invalid context configuration');
      }

      const connected = await this.setupClient(context);
      if (!connected) {
        throw new Error('Could not establish connection to cluster');
      }

      await this.k8sApi.core.listNamespace();

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
  }
}

module.exports = new ConnectionManager(); 