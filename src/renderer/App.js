import React from 'react';
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
  const [selectedConfig, setSelectedConfig] = React.useState(null);
  const [configs, setConfigs] = React.useState({});
  const [localContexts, setLocalContexts] = React.useState([]);
  const [localConfig, setLocalConfig] = React.useState(null);
  const [selectedResource, setSelectedResource] = React.useState(null);
  const [mobileOpen, setMobileOpen] = React.useState(false);

  React.useEffect(() => {
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
              onClick={() => {
                console.log('Selected context:', context); // Debug için
                const configData = {
                  name: context.name,
                  config: localConfig,
                  cluster: context.cluster,
                  user: context.user
                };
                console.log('Config data:', configData); // Debug için
                setSelectedConfig(configData);
                setSelectedResource('cluster');
              }}
              selected={selectedConfig?.name === context.name}
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
              onConfigSelect={setSelectedConfig}
              onConfigsUpdate={setConfigs}
            />
          </Paper>
        );
      case 'cluster':
        return selectedConfig && (
          <Paper sx={{ p: 2 }} elevation={2}>
            <ResourceList config={selectedConfig} />
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
    </ThemeProvider>
  );
}

export default App; 