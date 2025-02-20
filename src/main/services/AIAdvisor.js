const OpenAI = require('openai');
const k8sManager = require('./KubernetesManager');

class AIAdvisor {
  constructor() {
    this.openai = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY,
    });
  }

  async getAdvice({ message, model, context }) {
    // ... AI advisor kodu ...
  }

  async getClusterInfo(context) {
    // ... Cluster info toplama kodu ...
  }
}

module.exports = new AIAdvisor(); 