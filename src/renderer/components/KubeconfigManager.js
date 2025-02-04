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

const { ipcRenderer } = window.require('electron');

function KubeconfigManager({ configs, onConfigSelect, onConfigsUpdate }) {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState('');
  const [config, setConfig] = useState('');
  const [localContexts, setLocalContexts] = useState([]);
  const [localConfig, setLocalConfig] = useState(null);

  useEffect(() => {
    loadLocalKubeconfig();
  }, []);

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

  const handleLocalContextSelect = (contextName) => {
    onConfigSelect(localConfig);
  };

  return (
    <>
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
                onClick={() => handleLocalContextSelect(context.name)}
              >
                <ListItemText 
                  primary={context.name}
                  secondary={`Cluster: ${context.cluster}, User: ${context.user}`}
                />
                <ListItemSecondaryAction>
                  {context.isCurrent && (
                    <Chip label="Aktif" color="primary" size="small" />
                  )}
                </ListItemSecondaryAction>
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
            onClick={() => onConfigSelect(config)}
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
    </>
  );
}

export default KubeconfigManager; 