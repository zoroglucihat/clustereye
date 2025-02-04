import React, { useState } from 'react';
import { 
  Button, 
  TextField, 
  Box, 
  List, 
  ListItem, 
  ListItemText,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions
} from '@mui/material';

const { ipcRenderer } = window.require('electron');

function KubeconfigManager({ configs, onConfigSelect, onConfigsUpdate }) {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState('');
  const [config, setConfig] = useState('');

  const handleSave = async () => {
    await ipcRenderer.invoke('save-kubeconfig', { name, config });
    const updatedConfigs = await ipcRenderer.invoke('get-kubeconfigs');
    onConfigsUpdate(updatedConfigs);
    setOpen(false);
    setName('');
    setConfig('');
  };

  return (
    <>
      <Box sx={{ mb: 2 }}>
        <Button variant="contained" onClick={() => setOpen(true)}>
          Kubeconfig Ekle
        </Button>
      </Box>

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