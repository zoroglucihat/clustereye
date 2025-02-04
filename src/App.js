import React, { useState, useEffect } from 'react';
import { Box, AppBar, Toolbar, Typography, Container, Paper } from '@mui/material';
import KubeconfigManager from './components/KubeconfigManager';
import ClusterResources from './components/ClusterResources';

const { ipcRenderer } = window.require('electron');

function App() {
  const [selectedConfig, setSelectedConfig] = useState(null);
  const [configs, setConfigs] = useState({});

  useEffect(() => {
    loadConfigs();
  }, []);

  const loadConfigs = async () => {
    const savedConfigs = await ipcRenderer.invoke('get-kubeconfigs');
    setConfigs(savedConfigs);
  };

  return (
    <Box sx={{ flexGrow: 1 }}>
      <AppBar position="static">
        <Toolbar>
          <Typography variant="h6">Kube Manager</Typography>
        </Toolbar>
      </AppBar>
      
      <Container maxWidth="xl" sx={{ mt: 4 }}>
        <Paper sx={{ p: 2, mb: 4 }}>
          <KubeconfigManager 
            configs={configs}
            onConfigSelect={setSelectedConfig}
            onConfigsUpdate={setConfigs}
          />
        </Paper>

        {selectedConfig && (
          <Paper sx={{ p: 2 }}>
            <ClusterResources config={selectedConfig} />
          </Paper>
        )}
      </Container>
    </Box>
  );
}

export default App; 