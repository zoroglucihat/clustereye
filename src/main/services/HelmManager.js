const k8s = require('@kubernetes/client-node');
const fs = require('fs');
const { exec } = require('child_process');

class HelmManager {
  constructor() {
    this.k8sConfig = null;
    this.k8sApi = null;
  }

  async setupClient(contextConfig) {
    try {
      this.k8sConfig = new k8s.KubeConfig();
      this.k8sConfig.loadFromString(contextConfig.config);

      this.k8sApi = {
        core: this.k8sConfig.makeApiClient(k8s.CoreV1Api),
        custom: this.k8sConfig.makeApiClient(k8s.CustomObjectsApi)
      };

      return true;
    } catch (error) {
      console.error('Error setting up client:', error);
      throw error;
    }
  }

  async getReleases(context) {
    try {
      if (!context?.config) {
        return {
          success: false,
          message: 'No context configuration provided',
          releases: []
        };
      }

      await this.setupClient(context);
      
      try {
        // Önce CRD yöntemiyle dene
        const { body } = await this.k8sApi.custom.listClusterCustomObject(
          'helm.sh',
          'v1',
          'releases'
        );

        const releases = body.items.map(item => ({
          name: item.metadata.name,
          namespace: item.metadata.namespace,
          version: item.version,
          status: item.status,
          chart: {
            name: item.spec.chart.name,
            version: item.spec.chart.version,
            metadata: {
              name: item.spec.chart.metadata.name,
              version: item.spec.chart.metadata.version,
              description: item.spec.chart.metadata.description
            }
          },
          updated: item.status.last_deployed,
          info: item.info
        }));

        return {
          success: true,
          releases: releases
        };

      } catch (error) {
        // CRD yöntemi başarısız olursa Secret'lar üzerinden dene
        console.log('Trying alternative method to get Helm releases...');
        
        const secretsResponse = await this.k8sApi.core.listSecretForAllNamespaces(
          undefined,
          undefined,
          undefined,
          'owner=helm'
        );

        const releases = secretsResponse.body.items
          .filter(secret => secret.metadata.labels?.['owner'] === 'helm')
          .map(secret => {
            const data = JSON.parse(Buffer.from(secret.data['release'], 'base64').toString());
            return {
              name: secret.metadata.labels['name'],
              namespace: secret.metadata.namespace,
              version: data.version,
              status: data.status,
              chart: {
                name: data.chart.name,
                version: data.chart.version,
                metadata: {
                  name: data.chart.metadata.name,
                  version: data.chart.metadata.version,
                  description: data.chart.metadata.description
                }
              },
              updated: data.info.last_deployed,
              info: data.info
            };
          });

        return {
          success: true,
          releases: releases
        };
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

  async getCharts(context) {
    try {
      await this.setupClient(context);
      
      const response = await this.k8sApi.custom.listClusterCustomObject(
        'helm.sh',
        'v1',
        'charts'
      );
      return response.body;
    } catch (error) {
      console.error('Error fetching helm charts:', error);
      return { items: [] };
    }
  }

  async deleteRelease({ name, namespace, context }) {
    try {
      const tempKubeconfig = `/tmp/kubeconfig-${Date.now()}`;
      fs.writeFileSync(tempKubeconfig, context.config);

      return new Promise((resolve, reject) => {
        exec(`helm uninstall ${name} -n ${namespace} --kubeconfig ${tempKubeconfig}`, (error, stdout, stderr) => {
          try {
            fs.unlinkSync(tempKubeconfig);
          } catch (err) {
            console.error('Error cleaning up temp kubeconfig:', err);
          }

          if (error) {
            console.error('Error uninstalling helm release:', error);
            reject(error);
            return;
          }

          resolve({
            success: true,
            message: `Successfully uninstalled release "${name}"`
          });
        });
      });
    } catch (error) {
      console.error('Error in delete-helm-release:', error);
      return {
        success: false,
        message: error.message
      };
    }
  }
}

module.exports = new HelmManager(); 