import React, { useState, useEffect } from 'react';
import { 
  Box, 
  AppBar, 
  Toolbar, 
  Typography, 
  Container, 
  Paper, 
  CssBaseline,
  Drawer,
  List,
  ListItem,
  ListItemIcon,
  ListItemText,
  ListItemButton,
  Divider,
  IconButton
} from '@mui/material';
import { ThemeProvider, createTheme } from '@mui/material/styles';
import * as Icons from '@mui/icons-material';
import KubeconfigManager from './components/KubeconfigManager';
import ClusterResources from './components/ClusterResources';
import ResourceList from './components/ResourceList';
import BottomPanel from './components/BottomPanel';

const { ipcRenderer } = window.require('electron');

const DRAWER_WIDTH = 240;

// Dark tema oluştur
const darkTheme = createTheme({
  palette: {
    mode: 'dark',
    primary: {
      main: '#90caf9',  // Daha açık bir mavi
    },
    secondary: {
      main: '#f48fb1',  // Pembe tonu
    },
    background: {
      default: '#0a1929',  // Koyu lacivert
      paper: '#132f4c',    // Biraz daha açık lacivert
    },
  },
  components: {
    MuiPaper: {
      styleOverrides: {
        root: {
          backgroundImage: 'none',  // Gradient'i kaldır
        },
      },
    },
    MuiAppBar: {
      styleOverrides: {
        root: {
          backgroundColor: '#132f4c',  // AppBar rengi
        },
      },
    },
  },
});

function App() {
  const [configs, setConfigs] = useState({});
  const [selectedResource, setSelectedResource] = useState(null);
  const [showBottomPanel, setShowBottomPanel] = useState(false);
  const [currentContext, setCurrentContext] = useState(null);
  const [localContexts, setLocalContexts] = useState([]);
  const [localConfig, setLocalConfig] = useState(null);
  const [mobileOpen, setMobileOpen] = useState(false);

  useEffect(() => {
    loadConfigs();
    loadLocalContexts();
  }, []);

  const loadConfigs = async () => {
    const savedConfigs = await ipcRenderer.invoke('get-kubeconfigs');
    setConfigs(savedConfigs);
  };

  const loadLocalContexts = async () => {
    try {
      const { contexts, config } = await ipcRenderer.invoke('get-local-kubeconfig');
      console.log('Loaded contexts:', contexts); // Debug için
      console.log('Loaded config:', config); // Debug için
      setLocalContexts(contexts);
      setLocalConfig(config);
    } catch (error) {
      console.error('Error loading local contexts:', error);
    }
  };

  const handleDrawerToggle = () => {
    setMobileOpen(!mobileOpen);
  };

  const handleConfigSelect = (context) => {
    console.log('Debug: Setting current context:', context);
    setCurrentContext(context);
    setSelectedResource('cluster'); // Context seçildiğinde cluster view'a geç
    
    if (window.electronAPI) {
      window.electronAPI.currentContext = context;
    }

    localStorage.setItem('currentContext', JSON.stringify(context));
  };

  const handleDrawerItemClick = (context) => {
    try {
      console.log('Selected context:', context);
      
      // Context verilerini hazırla
      const configData = {
        name: context.name,
        config: localConfig,
        cluster: context.cluster,
        user: context.user,
        namespace: context.namespace || 'default',
        currentContext: context.name
      };

      console.log('Context selected successfully:', configData.name); // Yeni log
      console.log('Prepared context data:', configData);

      // Context'i güncelle
      setCurrentContext(configData);
      
      // Global context'i güncelle
      if (window.electronAPI) {
        window.electronAPI.currentContext = configData;
        console.log('Global context updated'); // Yeni log
      }

      // Local storage'a kaydet
      localStorage.setItem('currentContext', JSON.stringify(configData));
      console.log('Context saved to localStorage'); // Yeni log

      // Resource view'a geç
      setSelectedResource('cluster');

    } catch (error) {
      console.error('Error setting context:', error);
      alert('Failed to set context: ' + error.message);
    }
  };

  // Context değişikliklerini izle
  useEffect(() => {
    if (currentContext) {
      console.log('Current context updated:', currentContext);
    }
  }, [currentContext]);

  const handleResourceSelect = (resource) => {
    setSelectedResource(resource);
    setShowBottomPanel(true);
  };

  const drawer = (
    <div>
      <Toolbar />
      <Divider />
      <List>
        <ListItem disablePadding>
          <ListItemButton onClick={() => setSelectedResource('upload')}>
            <ListItemIcon>
              <Icons.UploadFile />
            </ListItemIcon>
            <ListItemText primary="Upload Kubeconfig" />
          </ListItemButton>
        </ListItem>
      </List>
      <Divider />
      <List>
        {localContexts.map((context) => (
          <ListItem key={context.name} disablePadding>
            <ListItemButton 
              onClick={() => handleDrawerItemClick(context)}
              selected={currentContext?.name === context.name}
            >
              <ListItemIcon>
                <Icons.Storage color={context.isCurrent ? "primary" : "inherit"} />
              </ListItemIcon>
              <ListItemText 
                primary={context.name}
                secondary={`Cluster: ${context.cluster} | User: ${context.user}`}
              />
            </ListItemButton>
          </ListItem>
        ))}
      </List>
    </div>
  );

  const renderContent = () => {
    switch (selectedResource) {
      case 'upload':
        return (
          <Paper sx={{ p: 2 }} elevation={2}>
            <KubeconfigManager 
              configs={configs}
              onConfigSelect={handleConfigSelect}
              onConfigsUpdate={setConfigs}
            />
          </Paper>
        );
      case 'cluster':
        return currentContext && (
          <Paper sx={{ p: 2 }} elevation={2}>
            <ResourceList 
              config={currentContext}
              onResourceSelect={handleResourceSelect}
              currentContext={currentContext}
            />
          </Paper>
        );
      default:
        return (
          <Paper sx={{ p: 2 }} elevation={2}>
            <Typography>Lütfen bir context seçin veya kubeconfig yükleyin</Typography>
          </Paper>
        );
    }
  };

  return (
    <ThemeProvider theme={darkTheme}>
      <CssBaseline />
      <Box sx={{ display: 'flex' }}>
        <AppBar
          position="fixed"
          sx={{
            width: { sm: `calc(100% - ${DRAWER_WIDTH}px)` },
            ml: { sm: `${DRAWER_WIDTH}px` },
          }}
          elevation={0}
        >
          <Toolbar>
            <IconButton
              color="inherit"
              edge="start"
              onClick={handleDrawerToggle}
              sx={{ mr: 2, display: { sm: 'none' } }}
            >
              <Icons.Menu />
            </IconButton>
            <Typography variant="h6" component="div" sx={{ flexGrow: 1 }}>
              KubeSucker
            </Typography>
          </Toolbar>
        </AppBar>
        <Box
          component="nav"
          sx={{ width: { sm: DRAWER_WIDTH }, flexShrink: { sm: 0 } }}
        >
          <Drawer
            variant="temporary"
            open={mobileOpen}
            onClose={handleDrawerToggle}
            ModalProps={{
              keepMounted: true,
            }}
            sx={{
              display: { xs: 'block', sm: 'none' },
              '& .MuiDrawer-paper': { boxSizing: 'border-box', width: DRAWER_WIDTH },
            }}
          >
            {drawer}
          </Drawer>
          <Drawer
            variant="permanent"
            sx={{
              display: { xs: 'none', sm: 'block' },
              '& .MuiDrawer-paper': { boxSizing: 'border-box', width: DRAWER_WIDTH },
            }}
            open
          >
            {drawer}
          </Drawer>
        </Box>
        <Box
          component="main"
          sx={{
            flexGrow: 1,
            p: 3,
            width: { sm: `calc(100% - ${DRAWER_WIDTH}px)` },
            mt: '64px'
          }}
        >
          {renderContent()}
        </Box>
      </Box>
      {showBottomPanel && (
        <BottomPanel
          selectedResource={selectedResource}
          currentContext={currentContext}
          onClose={() => setShowBottomPanel(false)}
          height={300}
        />
      )}
    </ThemeProvider>
  );
}

export default App; 