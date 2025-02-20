const k8s = require('@kubernetes/client-node');

class KubernetesManager {
  constructor() {
    this.k8sConfig = null;
    this.k8sApi = null;
  }

  async setupKubernetesClient(contextConfig) {
    try {
      // Önceki API istemcilerini temizle
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

      // API istemcilerini oluştur
      this.k8sApi = {
        core: this.k8sConfig.makeApiClient(k8s.CoreV1Api),
        apps: this.k8sConfig.makeApiClient(k8s.AppsV1Api),
        batch: this.k8sConfig.makeApiClient(k8s.BatchV1Api),
        networking: this.k8sConfig.makeApiClient(k8s.NetworkingV1Api)
      };

      // Request yapılandırması
      const defaultRequestOptions = {
        timeout: 10000,
        maxRedirects: 5,
        retry: 3,
        retryDelay: 1000,
        strictSSL: false,
        rejectUnauthorized: false,
        keepAlive: true,
        keepAliveMsecs: 3000,
        proxy: process.env.HTTPS_PROXY || process.env.HTTP_PROXY
      };

      Object.values(this.k8sApi).forEach(client => {
        if (client.apiClient) {
          client.apiClient.axios.defaults = {
            ...client.apiClient.axios.defaults,
            ...defaultRequestOptions,
            validateStatus: (status) => status >= 200 && status < 300
          };

          client.apiClient.axios.interceptors.response.use(undefined, async (err) => {
            const config = err.config;
            if (!config || !config.retry || config._retryCount >= config.retry) {
              return Promise.reject(err);
            }
            config._retryCount = config._retryCount || 0;
            config._retryCount++;
            await new Promise(resolve => setTimeout(resolve, config.retryDelay));
            return client.apiClient.axios(config);
          });
        }
      });

      // Test bağlantısı
      await this.k8sApi.core.listNamespace();
      console.log('Successfully connected to cluster');
      return true;

    } catch (error) {
      console.error('Error setting up Kubernetes client:', error);
      throw error;
    }
  }

  getApi() {
    return this.k8sApi;
  }

  getConfig() {
    return this.k8sConfig;
  }
}

module.exports = new KubernetesManager(); 