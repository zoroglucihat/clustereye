# clustereye

A modern, cross-platform Kubernetes cluster management and AI-powered advisor desktop application built with Electron and React.

## Features

- **Kubernetes Context Management:** Easily switch between multiple kubeconfig contexts and clusters.
- **Cluster Resource Explorer:** View, search, and manage Kubernetes resources (pods, deployments, services, etc.) visually.
- **Integrated Terminal:** Run `kubectl`, `helm`, and other CLI commands directly inside the app, with context-aware kubeconfig.
- **Helm Support:** List, inspect, and manage Helm releases even if Helm is not installed on your system (the app downloads and manages its own Helm binary).
- **AI Advisor (Optional):** Get cluster insights and recommendations using OpenAI (requires your own API key).
- **Dark Mode UI:** Beautiful, modern, and responsive interface with Material UI.
- **Cross-Platform:** Works on macOS, Windows, and Linux.

## Installation

1. **Clone the repository:**
   ```sh
   git clone https://github.com/your-org/clustereye.git
   cd clustereye
   ```

2. **Install dependencies:**
   ```sh
   npm install
   ```

3. **Start in development mode:**
   ```sh
   npm run dev
   ```
   This will launch the Electron app with hot-reloading for the UI.

4. **Build for production:**
   ```sh
   npm run build
   # Then package the app for your OS
   npm run dist
   ```

## Usage

- **Kubeconfig Management:** Upload or select your kubeconfig files to connect to clusters.
- **Resource Explorer:** Browse and manage resources in your selected cluster.
- **Integrated Terminal:** Open the terminal from the bottom panel to run `kubectl` or `helm` commands. The app uses its own Helm binary if not found on your system.
- **AI Advisor:** To enable AI-powered cluster analysis, set your `OPENAI_API_KEY` as an environment variable before starting the app.

## Requirements

- Node.js >= 16
- npm >= 8
- Internet connection (for Helm binary download and AI features)

## Environment Variables (Optional)

- `OPENAI_API_KEY` — For enabling the AI Advisor (OpenAI integration)

## Security
- Your kubeconfig and cluster credentials are only stored locally and never sent to any external server.
- The integrated terminal runs commands in a sandboxed environment with your selected kubeconfig context.

## License

MIT

---

**clustereye** is an open-source project. Contributions and feedback are welcome!
