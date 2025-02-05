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
      main: '#6366f1', // Modern indigo
      light: '#818cf8',
      dark: '#4f46e5',
    },
    secondary: {
      main: '#10b981', // Modern yeşil
      light: '#34d399',
      dark: '#059669',
    },
    background: {
      default: '#0f172a', // Koyu slate
      paper: '#1e293b',   // Biraz daha açık slate
    },
    error: {
      main: '#ef4444',
    },
    warning: {
      main: '#f59e0b',
    },
    success: {
      main: '#10b981',
    },
    info: {
      main: '#3b82f6',
    },
    text: {
      primary: '#f1f5f9',
      secondary: '#94a3b8',
    },
  },
  components: {
    MuiAppBar: {
      styleOverrides: {
        root: {
          backgroundColor: '#1e293b', // AppBar rengi
          backgroundImage: 'linear-gradient(rgba(255, 255, 255, 0.05), rgba(255, 255, 255, 0.05))',
        },
      },
    },
    MuiDrawer: {
      styleOverrides: {
        paper: {
          backgroundColor: '#1e293b', // Drawer rengi
          backgroundImage: 'none',
        },
      },
    },
    MuiPaper: {
      styleOverrides: {
        root: {
          backgroundImage: 'none',
          '&.MuiDialog-paper': {
            backgroundColor: '#1e293b',
          },
        },
      },
    },
    MuiButton: {
      styleOverrides: {
        root: {
          textTransform: 'none', // Butonlarda büyük harf kullanma
        },
        containedPrimary: {
          background: 'linear-gradient(45deg, #6366f1 30%, #818cf8 90%)',
          '&:hover': {
            background: 'linear-gradient(45deg, #4f46e5 30%, #6366f1 90%)',
          },
        },
      },
    },
    MuiListItemButton: {
      styleOverrides: {
        root: {
          '&.Mui-selected': {
            backgroundColor: 'rgba(99, 102, 241, 0.15)',
            '&:hover': {
              backgroundColor: 'rgba(99, 102, 241, 0.25)',
            },
          },
        },
      },
    },
  },
  shape: {
    borderRadius: 8,
  },
  typography: {
    fontFamily: '"Inter", "Roboto", "Helvetica", "Arial", sans-serif',
    h6: {
      fontWeight: 600,
    },
    button: {
      fontWeight: 600,
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
        <AppBar position="fixed" sx={{ zIndex: (theme) => theme.zIndex.drawer + 1 }}>
          <Toolbar>
            <IconButton
              color="inherit"
              edge="start"
              onClick={handleDrawerToggle}
              sx={{ mr: 2, display: { sm: 'none' } }}
            >
              <Icons.Menu />
            </IconButton>
            <Icons.Visibility sx={{ mr: 1 }} />
            <Typography variant="h6" noWrap component="div">
              ClusterEyeAI
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