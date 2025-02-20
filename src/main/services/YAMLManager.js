const { exec } = require('child_process');
const k8s = require('@kubernetes/client-node');
const YAML = require('yaml');
const logger = require('./LogManager');

class YAMLManager {
  async applyYAML({ yamlContent, context }) {
    try {
      logger.debug('Received apply-yaml request:', { contextName: context.name });
      
      if (!context?.config) {
        throw new Error('Invalid context configuration');
      }

      await this.switchContext(context);
      const client = await this.setupClient(context);
      const results = await this.processDocuments(yamlContent, client);

      logger.debug('Successfully applied all resources:', results);
      return { success: true, results };
    } catch (error) {
      logger.error('Error in apply-yaml:', error);
      return { success: false, message: error.message };
    }
  }

  async execCommand({ command, context }) {
    try {
      if (context?.name) {
        await this.switchContext(context);
      }

      return new Promise((resolve, reject) => {
        exec(command, (error, stdout, stderr) => {
          if (error) {
            logger.error('Command execution error:', error);
            reject(error);
            return;
          }
          resolve(stdout || stderr);
        });
      });
    } catch (error) {
      logger.error('Error in exec-command:', error);
      throw error;
    }
  }

  // Private methods
  async switchContext(context) {
    return new Promise((resolve, reject) => {
      exec(`kubectl config use-context ${context.name}`, (error, stdout) => {
        if (error) {
          reject(error);
          return;
        }
        resolve(stdout);
      });
    });
  }

  async setupClient(context) {
    const kc = new k8s.KubeConfig();
    kc.loadFromString(context.config);
    if (context.name) {
      kc.setCurrentContext(context.name);
    }
    return k8s.KubernetesObjectApi.makeApiClient(kc);
  }

  async processDocuments(yamlContent, client) {
    const documents = YAML.parseAllDocuments(yamlContent).map(doc => doc.toJSON());
    const results = [];

    for (const spec of documents) {
      if (!spec) continue;
      try {
        const result = await this.applyResource(spec, client);
        results.push(result);
      } catch (error) {
        throw error;
      }
    }

    return results;
  }

  async applyResource(spec, client) {
    try {
      await client.read(spec);
      await client.patch(spec);
      return {
        status: 'updated',
        kind: spec.kind,
        name: spec.metadata?.name,
        namespace: spec.metadata?.namespace
      };
    } catch (error) {
      if (error.statusCode === 404) {
        await client.create(spec);
        return {
          status: 'created',
          kind: spec.kind,
          name: spec.metadata?.name,
          namespace: spec.metadata?.namespace
        };
      }
      throw error;
    }
  }
}

module.exports = new YAMLManager(); 