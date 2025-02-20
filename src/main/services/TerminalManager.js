const { spawn } = require('child_process');
const fs = require('fs');

class TerminalManager {
  constructor() {
    this.activeWebSockets = new Map();
  }

  async execInPod({ namespace, podName, context, event }) {
    try {
      if (!context?.config) throw new Error('No context provided');
      await k8sManager.setupKubernetesClient(context);

      const pod = await k8sManager.getApi().core.readNamespacedPod(podName, namespace);
      console.log('Pod found:', pod.body.metadata.name);

      const tempKubeconfig = `/tmp/kubeconfig-${Date.now()}`;
      fs.writeFileSync(tempKubeconfig, context.config);

      const shell = spawn('kubectl', [
        '--kubeconfig', tempKubeconfig,
        'exec', '-n', namespace, podName, '-it', '--', '/bin/sh'
      ], {
        stdio: ['pipe', 'pipe', 'pipe'],
        env: { ...process.env, TERM: 'xterm-256color' }
      });

      this.setupShellHandlers(shell, event, tempKubeconfig);
      return { success: true, message: 'Connected to pod successfully' };
    } catch (error) {
      return { success: false, message: error.message };
    }
  }

  setupShellHandlers(shell, event, tempKubeconfig) {
    shell.stdout.on('data', (data) => {
      event.sender.send('terminal-output', data.toString());
    });

    shell.stderr.on('data', (data) => {
      event.sender.send('terminal-error', data.toString());
    });

    shell.on('close', (code) => {
      event.sender.send('terminal-closed', code);
      try { fs.unlinkSync(tempKubeconfig); } catch (error) { /* ignore */ }
    });
  }

  async startTerminalSession({ namespace, podName, context, event }) {
    // ... Terminal session kodu ...
  }

  handleTerminalInput(event, { sessionId, data }) {
    // ... Terminal input kodu ...
  }
}

module.exports = new TerminalManager(); 