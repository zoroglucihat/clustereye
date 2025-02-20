const k8s = require('@kubernetes/client-node');
const { spawn, exec } = require('child_process');
const fs = require('fs');

class TerminalManager {
  constructor() {
    this.k8sConfig = null;
    this.k8sApi = null;
    this.activeWebSockets = new Map();
  }

  async setupClient(contextConfig) {
    try {
      this.k8sConfig = new k8s.KubeConfig();
      this.k8sConfig.loadFromString(contextConfig.config);

      this.k8sApi = {
        core: this.k8sConfig.makeApiClient(k8s.CoreV1Api)
      };

      return true;
    } catch (error) {
      console.error('Error setting up client:', error);
      throw error;
    }
  }

  async execInPod({ namespace, podName, context, event }) {
    try {
      if (!context?.config) {
        throw new Error('No context provided');
      }

      await this.setupClient(context);

      // Pod'un var olduğunu kontrol et
      try {
        const pod = await this.k8sApi.core.readNamespacedPod(podName, namespace);
        console.log('Pod found:', pod.body.metadata.name);
      } catch (error) {
        console.error('Pod not found:', error);
        throw new Error(`Pod "${podName}" not found in namespace "${namespace}"`);
      }

      // Geçici kubeconfig oluştur
      const tempKubeconfig = `/tmp/kubeconfig-${Date.now()}`;
      fs.writeFileSync(tempKubeconfig, context.config);

      const shell = spawn('kubectl', [
        '--kubeconfig', tempKubeconfig,
        'exec',
        '-n', namespace,
        podName,
        '-it',
        '--',
        '/bin/sh'
      ], {
        stdio: ['pipe', 'pipe', 'pipe'],
        env: {
          ...process.env,
          TERM: 'xterm-256color'
        }
      });

      shell.stdout.on('data', (data) => {
        console.log('Terminal output:', data.toString());
        event.sender.send('terminal-output', data.toString());
      });

      shell.stderr.on('data', (data) => {
        console.error('Terminal error:', data.toString());
        event.sender.send('terminal-error', data.toString());
      });

      shell.on('close', (code) => {
        console.log('Terminal closed with code:', code);
        event.sender.send('terminal-closed', code);
        try {
          fs.unlinkSync(tempKubeconfig);
        } catch (err) {
          console.error('Error cleaning up temp kubeconfig:', err);
        }
      });

      return {
        success: true,
        message: 'Connected to pod successfully'
      };

    } catch (error) {
      console.error('Error in exec-in-pod:', error);
      return {
        success: false,
        message: error.message || 'Failed to connect to pod'
      };
    }
  }

  async startTerminalSession({ namespace, podName }) {
    try {
      const shell = spawn('kubectl', [
        'exec',
        '-n', namespace,
        podName,
        '-it',
        '--',
        '/bin/sh'
      ], {
        stdio: ['pipe', 'pipe', 'pipe'],
        shell: true
      });

      shell.stdout.on('data', (data) => {
        event.sender.send('terminal-output', data.toString());
      });

      shell.stderr.on('data', (data) => {
        event.sender.send('terminal-error', data.toString());
      });

      return {
        success: true,
        message: 'Terminal session started'
      };
    } catch (error) {
      console.error('Error starting terminal session:', error);
      return {
        success: false,
        message: error.message
      };
    }
  }

  async getLogs({ namespace, name, context }) {
    try {
      await this.setupClient(context);
      const response = await this.k8sApi.core.readNamespacedPodLog(name, namespace);
      return response.body;
    } catch (error) {
      console.error('Error getting logs:', error);
      throw error;
    }
  }

  async execShell({ namespace, name, context }) {
    try {
      await this.setupClient(context);
      
      return new Promise((resolve, reject) => {
        exec(`kubectl exec -it -n ${namespace} ${name} -- /bin/sh`, (error, stdout, stderr) => {
          if (error) {
            console.error('Error executing shell:', error);
            reject(error);
            return;
          }
          resolve(stdout);
        });
      });
    } catch (error) {
      console.error('Error in exec-shell:', error);
      throw error;
    }
  }

  handleTerminalInput(event, { sessionId, data }) {
    try {
      const websocket = this.activeWebSockets.get(sessionId);
      if (websocket && websocket.readyState === websocket.OPEN) {
        websocket.send(data);
      }
    } catch (error) {
      console.error('Error sending terminal input:', error);
    }
  }
}

module.exports = new TerminalManager(); 