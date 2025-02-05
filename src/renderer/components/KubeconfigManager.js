import React, { useState, useEffect } from 'react';
import { 
  Button, 
  TextField, 
  Box, 
  List, 
  ListItem, 
  ListItemText,
  ListItemSecondaryAction,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Typography,
  Divider,
  Chip
} from '@mui/material';
import ClusterResources from './ClusterResources';
const k8s = window.require('@kubernetes/client-node');

const { ipcRenderer } = window.require('electron');

function KubeconfigManager({ configs, onConfigSelect, onConfigsUpdate }) {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState('');
  const [config, setConfig] = useState('');
  const [localContexts, setLocalContexts] = useState([]);
  const [localConfig, setLocalConfig] = useState(null);
  const [contexts, setContexts] = useState([]);
  const [activeContext, setActiveContext] = useState(() => {
    const saved = localStorage.getItem('selectedContext');
    return saved ? JSON.parse(saved) : null;
  });

  useEffect(() => {
    loadLocalKubeconfig();
  }, []);

  useEffect(() => {
    if (activeContext) {
      console.log('Debug: Active context changed:', activeContext);
      localStorage.setItem('selectedContext', JSON.stringify(activeContext));
      window.electronAPI = window.electronAPI || {};
      window.electronAPI.currentContext = activeContext;
      onConfigSelect(activeContext);
    }
  }, [activeContext]);

  const loadLocalKubeconfig = async () => {
    const { contexts, config } = await ipcRenderer.invoke('get-local-kubeconfig');
    setLocalContexts(contexts);
    setLocalConfig(config);
  };

  const handleSave = async () => {
    await ipcRenderer.invoke('save-kubeconfig', { name, config });
    const updatedConfigs = await ipcRenderer.invoke('get-kubeconfigs');
    onConfigsUpdate(updatedConfigs);
    setOpen(false);
    setName('');
    setConfig('');
  };

  const handleLocalContextSelect = (context) => {
    if (!localConfig) {
      console.error('Debug: No local config available');
      return;
    }

    try {
      const kc = new k8s.KubeConfig();
      kc.loadFromString(localConfig);
      kc.setCurrentContext(context.name);

      const contextData = {
        name: context.name,
        config: localConfig,
        cluster: context.cluster,
        user: context.user,
        namespace: context.namespace || 'default',
        currentContext: context.name,
        type: 'local'
      };

      console.log('Debug: Setting context:', contextData);
      
      setActiveContext(contextData);
      onConfigSelect(contextData);

    } catch (error) {
      console.error('Debug: Error in handleLocalContextSelect:', error);
      alert('Failed to select context: ' + error.message);
    }
  };

  const handleSavedContextSelect = (name, config) => {
    try {
      const kc = new k8s.KubeConfig();
      kc.loadFromString(config);

      const contextData = {
        name: name,
        config: config,
        cluster: kc.getCurrentCluster()?.name,
        user: kc.getCurrentUser()?.name,
        namespace: 'default',
        currentContext: kc.getCurrentContext(),
        type: 'saved'
      };

      console.log('Debug: Setting saved context:', contextData);
      
      setActiveContext(contextData);
      onConfigSelect(contextData);

    } catch (error) {
      console.error('Debug: Error in handleSavedContextSelect:', error);
      alert('Failed to select context: ' + error.message);
    }
  };

  return (
    <Box>
      <Box sx={{ mb: 2 }}>
        <Button variant="contained" onClick={() => setOpen(true)}>
          Kubeconfig Ekle
        </Button>
      </Box>

      {localContexts.length > 0 && (
        <>
          <Typography variant="h6" sx={{ mb: 1 }}>
            Yerel Kubeconfig Contexts
          </Typography>
          <List>
            {localContexts.map((context) => (
              <ListItem 
                button 
                key={context.name}
                data-context-name={context.name}
                onClick={() => handleLocalContextSelect(context)}
                selected={activeContext?.name === context.name}
                sx={{
                  bgcolor: activeContext?.name === context.name ? 'action.selected' : 'inherit',
                  '&.Mui-selected': {
                    bgcolor: 'primary.light',
                    '&:hover': {
                      bgcolor: 'primary.light',
                    },
                  },
                }}
              >
                <ListItemText 
                  primary={context.name}
                  secondary={`Cluster: ${context.cluster}, User: ${context.user}`}
                />
                {context.isCurrent && (
                  <Chip 
                    label="Aktif" 
                    color="primary" 
                    size="small"
                    sx={{ ml: 1 }}
                  />
                )}
              </ListItem>
            ))}
          </List>
          <Divider sx={{ my: 2 }} />
        </>
      )}

      <Typography variant="h6" sx={{ mb: 1 }}>
        Kaydedilmiş Kubeconfig'ler
      </Typography>
      <List>
        {Object.entries(configs).map(([name, config]) => (
          <ListItem 
            button 
            key={name}
            onClick={() => handleSavedContextSelect(name, config)}
            selected={activeContext?.name === name}
          >
            <ListItemText primary={name} />
          </ListItem>
        ))}
      </List>

      <Dialog open={open} onClose={() => setOpen(false)}>
        <DialogTitle>Yeni Kubeconfig Ekle</DialogTitle>
        <DialogContent>
          <TextField
            fullWidth
            label="İsim"
            value={name}
            onChange={(e) => setName(e.target.value)}
            sx={{ mb: 2, mt: 2 }}
          />
          <TextField
            fullWidth
            multiline
            rows={10}
            label="Kubeconfig"
            value={config}
            onChange={(e) => setConfig(e.target.value)}
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setOpen(false)}>İptal</Button>
          <Button onClick={handleSave}>Kaydet</Button>
        </DialogActions>
      </Dialog>

      <ClusterResources 
        selectedContext={activeContext}
        onContextError={() => setActiveContext(null)}
        onContextChange={(context) => {
          if (context) {
            setActiveContext(context);
          }
        }}
      />
    </Box>
  );
}

export default KubeconfigManager; 