import React, { useState, useEffect } from 'react';
import {
  List,
  ListItem,
  ListItemButton,
  ListItemIcon,
  ListItemText,
  Typography,
  Tabs,
  Tab,
  Box,
  Chip,
  TextField,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  InputAdornment,
  Button,
  Menu,
  Dialog,
  DialogTitle,
  DialogContent,
  IconButton
} from '@mui/material';
import * as Icons from '@mui/icons-material';
import ResourceDetails from './ResourceDetails';
import SearchIcon from '@mui/icons-material/Search';
import BottomPanel from './BottomPanel';

const { ipcRenderer } = window.require('electron');

function TabPanel(props) {
  const { children, value, index, ...other } = props;
  return (
    <div role="tabpanel" hidden={value !== index} {...other}>
      {value === index && <Box sx={{ p: 3 }}>{children}</Box>}
    </div>
  );
}

function ResourceList({ config, onResourceSelect, currentContext }) {
  const [value, setValue] = useState(0);
  const [pods, setPods] = useState([]);
  const [deployments, setDeployments] = useState([]);
  const [services, setServices] = useState([]);
  const [configMaps, setConfigMaps] = useState([]);
  const [secrets, setSecrets] = useState([]);
  const [pvs, setPvs] = useState([]);
  const [statefulSets, setStatefulSets] = useState([]);
  const [daemonSets, setDaemonSets] = useState([]);
  const [ingresses, setIngresses] = useState([]);
  const [pvcs, setPvcs] = useState([]);
  const [cronJobs, setCronJobs] = useState([]);
  const [jobs, setJobs] = useState([]);
  const [events, setEvents] = useState([]);
  const [error, setError] = useState(null);
  const [selectedResource, setSelectedResource] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedNamespace, setSelectedNamespace] = useState('all');
  const [namespaces, setNamespaces] = useState([]);
  const [showBottomPanel, setShowBottomPanel] = useState(false);
  const [refreshInterval, setRefreshInterval] = useState(null);
  const [anchorEl, setAnchorEl] = useState(null);
  const [selectedItem, setSelectedItem] = useState(null);
  const [logs, setLogs] = useState(null);
  const [logsDialog, setLogsDialog] = useState(false);

  useEffect(() => {
    // Context değiştiğinde tüm state'leri temizle
    setPods([]);
    setDeployments([]);
    setServices([]);
    setConfigMaps([]);
    setSecrets([]);
    setPvs([]);
    setStatefulSets([]);
    setDaemonSets([]);
    setIngresses([]);
    setPvcs([]);
    setCronJobs([]);
    setJobs([]);
    setEvents([]);
    setSelectedNamespace('all');
    setNamespaces([]);
    setError(null);

    if (config) {
      console.log('Loading resources for context:', config.name);
      loadResources();
      loadNamespaces();
      
      // Interval'i temizle ve yeniden başlat
      if (refreshInterval) {
        clearInterval(refreshInterval);
      }
      const interval = setInterval(() => {
        loadResources();
      }, 2000);
      setRefreshInterval(interval);
    }

    // Component unmount olduğunda veya context değiştiğinde interval'i temizle
    return () => {
      if (refreshInterval) {
        clearInterval(refreshInterval);
      }
    };
  }, [config]); // config değişimini izle

  const loadResources = async () => {
    try {
      if (!config) {
        console.log('No config provided, skipping resource load');
        return;
      }

      console.log('Loading resources for context:', config.name);

      const [
        podList,
        deploymentList,
        serviceList,
        configMapList,
        secretList,
        pvList,
        statefulSetList,
        daemonSetList,
        ingressList,
        pvcList,
        cronJobList,
        jobList,
        eventList
      ] = await Promise.all([
        ipcRenderer.invoke('get-pods', config),
        ipcRenderer.invoke('get-deployments', config),
        ipcRenderer.invoke('get-services', config),
        ipcRenderer.invoke('get-configmaps', config),
        ipcRenderer.invoke('get-secrets', config),
        ipcRenderer.invoke('get-pvs', config),
        ipcRenderer.invoke('get-statefulsets', config),
        ipcRenderer.invoke('get-daemonsets', config),
        ipcRenderer.invoke('get-ingresses', config),
        ipcRenderer.invoke('get-pvcs', config),
        ipcRenderer.invoke('get-cronjobs', config),
        ipcRenderer.invoke('get-jobs', config),
        ipcRenderer.invoke('get-events', config)
      ]);

      // Sadece başarılı yanıtları state'e kaydet
      if (podList?.items) setPods(podList.items);
      if (deploymentList?.items) setDeployments(deploymentList.items);
      if (serviceList?.items) setServices(serviceList.items);
      if (configMapList?.items) setConfigMaps(configMapList.items);
      if (secretList?.items) setSecrets(secretList.items);
      if (pvList?.items) setPvs(pvList.items);
      if (statefulSetList?.items) setStatefulSets(statefulSetList.items);
      if (daemonSetList?.items) setDaemonSets(daemonSetList.items);
      if (ingressList?.items) setIngresses(ingressList.items);
      if (pvcList?.items) setPvcs(pvcList.items);
      if (cronJobList?.items) setCronJobs(cronJobList.items);
      if (jobList?.items) setJobs(jobList.items);
      if (eventList?.items) setEvents(eventList.items);

    } catch (error) {
      console.error('Error loading resources:', error);
      setError(error.message);
    }
  };

  const loadNamespaces = async () => {
    try {
      const uniqueNamespaces = new Set();
      
      // Tüm kaynaklardan namespace'leri topla
      [pods, deployments, services, configMaps, secrets].forEach(resources => {
        resources.forEach(resource => {
          if (resource.metadata?.namespace) {
            uniqueNamespaces.add(resource.metadata.namespace);
          }
        });
      });

      setNamespaces(Array.from(uniqueNamespaces).sort());
    } catch (error) {
      console.error('Error loading namespaces:', error);
    }
  };

  const filterResources = (resources) => {
    return resources.filter(resource => {
      const matchesSearch = resource.metadata.name.toLowerCase()
        .includes(searchTerm.toLowerCase());
      
      const matchesNamespace = selectedNamespace === 'all' || 
        resource.metadata.namespace === selectedNamespace;

      return matchesSearch && matchesNamespace;
    });
  };

  const handleChange = (event, newValue) => {
    setValue(newValue);
  };

  const getStatusColor = (status) => {
    switch (status) {
      case 'Running':
      case 'Active':
        return 'success.main';
      case 'Pending':
        return 'warning.main';
      case 'Failed':
        return 'error.main';
      default:
        return 'grey.500';
    }
  };

  const handleResourceClick = (resource) => {
    setSelectedResource(resource);
  };

  // Context menu için
  const handleContextMenu = (event, resource) => {
    event.preventDefault();
    event.stopPropagation();
    setAnchorEl(event.currentTarget);
    setSelectedItem(resource);
  };

  const handleMenuClose = () => {
    setAnchorEl(null);
    setSelectedItem(null);
  };

  // Log görüntüleme
  const handleViewLogs = async () => {
    try {
      const logs = await ipcRenderer.invoke('get-logs', {
        namespace: selectedItem.metadata.namespace,
        name: selectedItem.metadata.name,
        context: currentContext
      });
      setLogs(logs);
      setLogsDialog(true);
    } catch (error) {
      console.error('Error fetching logs:', error);
      alert('Loglar alınamadı: ' + error.message);
    }
    handleMenuClose();
  };

  // YAML düzenleme
  const handleEdit = () => {
    onResourceSelect(selectedItem);
    handleMenuClose();
  };

  const renderResourceList = (resources, getSecondaryText) => (
    <List>
      {resources.map((resource) => (
        <ListItem 
          key={`${resource.metadata.namespace}-${resource.metadata.name}`} 
          disablePadding
          sx={{ 
            borderBottom: '1px solid rgba(255, 255, 255, 0.12)',
            '&:hover': {
              backgroundColor: 'rgba(255, 255, 255, 0.05)'
            }
          }}
        >
          <ListItemButton onClick={() => handleResourceClick(resource)}>
            <ListItemIcon>
              <Icons.Circle sx={{ 
                color: getStatusColor(
                  resource.status?.phase || 
                  resource.status?.conditions?.[0]?.status
                ),
                width: 12,
                height: 12
              }} />
            </ListItemIcon>
            <Box sx={{ 
              display: 'flex', 
              flexDirection: 'column',
              flexGrow: 1
            }}>
              <Box sx={{ 
                display: 'flex', 
                justifyContent: 'space-between',
                alignItems: 'center'
              }}>
                <Typography variant="body1" component="div">
                  {resource.metadata.name}
                </Typography>
                <Box sx={{ display: 'flex', gap: 1 }}>
                  {resource.status?.phase && (
                    <Chip 
                      label={resource.status.phase}
                      size="small"
                      color={resource.status.phase === 'Running' ? 'success' : 'default'}
                    />
                  )}
                  {resource.metadata.namespace && (
                    <Chip 
                      label={resource.metadata.namespace}
                      size="small"
                      variant="outlined"
                    />
                  )}
                </Box>
              </Box>
              <Box sx={{ 
                display: 'flex', 
                gap: 2,
                mt: 1,
                color: 'text.secondary',
                fontSize: '0.875rem'
              }}>
                {getResourceDetails(resource)}
              </Box>
            </Box>
          </ListItemButton>
          
          {/* Actions Butonu */}
          <Box sx={{ pr: 2 }}>
            <Button
              size="small"
              onClick={(e) => {
                e.stopPropagation();
                setAnchorEl(e.currentTarget);
                setSelectedItem(resource);
              }}
              endIcon={<Icons.ArrowDropDown />}
            >
              Actions
            </Button>
          </Box>
        </ListItem>
      ))}

      {/* Actions Menu */}
      <Menu
        anchorEl={anchorEl}
        open={Boolean(anchorEl)}
        onClose={handleMenuClose}
      >
        <MenuItem onClick={handleEdit}>
          <ListItemIcon>
            <Icons.Edit fontSize="small" />
          </ListItemIcon>
          YAML Düzenle
        </MenuItem>
        {selectedItem?.kind === 'Pod' && (
          <>
            <MenuItem onClick={handleViewLogs}>
              <ListItemIcon>
                <Icons.Article fontSize="small" />
              </ListItemIcon>
              Logları Görüntüle
            </MenuItem>
            <MenuItem onClick={handleExecShell}>
              <ListItemIcon>
                <Icons.Terminal fontSize="small" />
              </ListItemIcon>
              Terminal'e Bağlan
            </MenuItem>
            <MenuItem onClick={handleDelete}>
              <ListItemIcon>
                <Icons.Delete fontSize="small" color="error" />
              </ListItemIcon>
              <Typography color="error">Sil</Typography>
            </MenuItem>
          </>
        )}
      </Menu>

      {/* Logs Dialog */}
      <Dialog
        open={logsDialog}
        onClose={() => setLogsDialog(false)}
        maxWidth="lg"
        fullWidth
      >
        <DialogTitle>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <Icons.Article />
            Logs: {selectedItem?.metadata.name}
            <Chip 
              size="small" 
              label={selectedItem?.metadata.namespace}
              sx={{ ml: 1 }}
            />
          </Box>
          <IconButton
            onClick={() => setLogsDialog(false)}
            sx={{ position: 'absolute', right: 8, top: 8 }}
          >
            <Icons.Close />
          </IconButton>
        </DialogTitle>
        <DialogContent>
          <Box
            sx={{
              fontFamily: 'monospace',
              whiteSpace: 'pre-wrap',
              bgcolor: 'background.paper',
              p: 2,
              borderRadius: 1,
              maxHeight: '70vh',
              overflow: 'auto'
            }}
          >
            {logs}
          </Box>
        </DialogContent>
      </Dialog>
    </List>
  );

  const getResourceDetails = (resource) => {
    const details = [];
    
    // Pod detayları
    if (resource.kind === 'Pod') {
      const qosClass = resource.status.qosClass;
      const qosColor = {
        'Guaranteed': 'success',
        'Burstable': 'warning',
        'BestEffort': 'error'
      }[qosClass] || 'default';

      details.push(
        `Node: ${resource.spec.nodeName || 'N/A'}`,
        `IP: ${resource.status.podIP || 'N/A'}`,
        `Restarts: ${resource.status.containerStatuses?.[0]?.restartCount || 0}`,
        `Age: ${getAge(resource.metadata.creationTimestamp)}`
      );

      // QoS'u chip olarak göster
      return (
        <>
          {details.map((detail, index) => (
            <Typography 
              key={index} 
              component="span" 
              sx={{ 
                display: 'inline-flex',
                alignItems: 'center',
                '&:not(:last-child):after': {
                  content: '"•"',
                  mx: 1
                }
              }}
            >
              {detail}
            </Typography>
          ))}
          <Chip 
            label={`QoS: ${qosClass}`}
            size="small"
            color={qosColor}
            variant="outlined"
            sx={{ ml: 2 }}
          />
        </>
      );
    }
    
    // Deployment detayları
    else if (resource.kind === 'Deployment') {
      details.push(
        `Replicas: ${resource.status.replicas || 0}/${resource.spec.replicas}`,
        `Updated: ${resource.status.updatedReplicas || 0}`,
        `Available: ${resource.status.availableReplicas || 0}`,
        `Age: ${getAge(resource.metadata.creationTimestamp)}`
      );
    }
    
    // Service detayları
    else if (resource.kind === 'Service') {
      details.push(
        `Type: ${resource.spec.type}`,
        `ClusterIP: ${resource.spec.clusterIP}`,
        `Ports: ${resource.spec.ports?.map(p => p.port).join(', ')}`,
        `Age: ${getAge(resource.metadata.creationTimestamp)}`
      );
    }
    
    // Ingress detayları
    else if (resource.kind === 'Ingress') {
      details.push(
        `Hosts: ${resource.spec.rules?.map(r => r.host).join(', ')}`,
        `TLS: ${resource.spec.tls ? 'Yes' : 'No'}`,
        `Age: ${getAge(resource.metadata.creationTimestamp)}`
      );
    }
    
    // DaemonSet detayları
    else if (resource.kind === 'DaemonSet') {
      details.push(
        `Desired: ${resource.status.desiredNumberScheduled || 0}`,
        `Current: ${resource.status.currentNumberScheduled || 0}`,
        `Ready: ${resource.status.numberReady || 0}`,
        `Up-to-date: ${resource.status.updatedNumberScheduled || 0}`,
        `Age: ${getAge(resource.metadata.creationTimestamp)}`
      );
    }

    // StatefulSet detayları
    else if (resource.kind === 'StatefulSet') {
      details.push(
        `Replicas: ${resource.status.replicas || 0}/${resource.spec.replicas}`,
        `Ready: ${resource.status.readyReplicas || 0}`,
        `Age: ${getAge(resource.metadata.creationTimestamp)}`
      );
    }

    // ConfigMap detayları
    else if (resource.kind === 'ConfigMap') {
      details.push(
        `Data Keys: ${Object.keys(resource.data || {}).length}`,
        `Age: ${getAge(resource.metadata.creationTimestamp)}`
      );
    }

    // Secret detayları
    else if (resource.kind === 'Secret') {
      details.push(
        `Type: ${resource.type}`,
        `Data Keys: ${Object.keys(resource.data || {}).length}`,
        `Age: ${getAge(resource.metadata.creationTimestamp)}`
      );
    }

    // PersistentVolume detayları
    else if (resource.kind === 'PersistentVolume') {
      details.push(
        `Capacity: ${resource.spec.capacity?.storage}`,
        `Access Modes: ${resource.spec.accessModes?.join(', ')}`,
        `Reclaim Policy: ${resource.spec.persistentVolumeReclaimPolicy}`,
        `Status: ${resource.status.phase}`,
        `Age: ${getAge(resource.metadata.creationTimestamp)}`
      );
    }

    // PVC detayları
    else if (resource.kind === 'PersistentVolumeClaim') {
      details.push(
        `Status: ${resource.status.phase}`,
        `Volume: ${resource.spec.volumeName || 'N/A'}`,
        `Capacity: ${resource.status.capacity?.storage || resource.spec.resources.requests.storage}`,
        `Access Modes: ${resource.spec.accessModes?.join(', ')}`,
        `Age: ${getAge(resource.metadata.creationTimestamp)}`
      );
    }

    // CronJob detayları
    else if (resource.kind === 'CronJob') {
      details.push(
        `Schedule: ${resource.spec.schedule}`,
        `Suspend: ${resource.spec.suspend ? 'Yes' : 'No'}`,
        `Last Schedule: ${resource.status.lastScheduleTime ? getAge(resource.status.lastScheduleTime) : 'Never'}`,
        `Age: ${getAge(resource.metadata.creationTimestamp)}`
      );
    }

    // Job detayları
    else if (resource.kind === 'Job') {
      details.push(
        `Completions: ${resource.status.succeeded || 0}/${resource.spec.completions || 1}`,
        `Duration: ${resource.status.completionTime ? 
          getDuration(resource.status.startTime, resource.status.completionTime) : 
          getAge(resource.status.startTime)}`,
        `Age: ${getAge(resource.metadata.creationTimestamp)}`
      );
    }

    return details.map((detail, index) => (
      <Typography 
        key={index} 
        component="span" 
        sx={{ 
          display: 'inline-flex',
          alignItems: 'center',
          '&:not(:last-child):after': {
            content: '"•"',
            mx: 1
          }
        }}
      >
        {detail}
      </Typography>
    ));
  };

  const getAge = (timestamp) => {
    if (!timestamp) return 'N/A';
    const diff = new Date().getTime() - new Date(timestamp).getTime();
    const days = Math.floor(diff / (1000 * 60 * 60 * 24));
    const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
    
    if (days > 0) return `${days}d`;
    if (hours > 0) return `${hours}h`;
    return 'Just now';
  };

  const getDuration = (start, end) => {
    if (!start || !end) return 'N/A';
    const diff = new Date(end).getTime() - new Date(start).getTime();
    const minutes = Math.floor(diff / (1000 * 60));
    if (minutes < 60) return `${minutes}m`;
    const hours = Math.floor(minutes / 60);
    if (hours < 24) return `${hours}h`;
    return `${Math.floor(hours / 24)}d`;
  };

  // YAML apply edildiğinde kaynakları hemen yenile
  const handleResourceUpdate = () => {
    loadResources();
  };

  if (error) {
    return (
      <Box sx={{ p: 2 }}>
        <Typography color="error">
          Error loading resources: {error}
        </Typography>
      </Box>
    );
  }

  return (
    <>
      <Box sx={{ 
        width: '100%',
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
        pb: showBottomPanel ? '300px' : 0 // Bottom panel için yer aç
      }}>
        <Box sx={{ width: '100%' }}>
          <Box sx={{ 
            p: 2, 
            display: 'flex', 
            gap: 2, 
            alignItems: 'center',
            borderBottom: 1,
            borderColor: 'divider'
          }}>
            <TextField
              size="small"
              placeholder="Search resources..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              sx={{ flexGrow: 1 }}
              InputProps={{
                startAdornment: (
                  <InputAdornment position="start">
                    <SearchIcon />
                  </InputAdornment>
                ),
              }}
            />
            <FormControl size="small" sx={{ minWidth: 200 }}>
              <InputLabel>Namespace</InputLabel>
              <Select
                value={selectedNamespace}
                onChange={(e) => setSelectedNamespace(e.target.value)}
                label="Namespace"
              >
                <MenuItem value="all">All Namespaces</MenuItem>
                {namespaces.map(ns => (
                  <MenuItem key={ns} value={ns}>{ns}</MenuItem>
                ))}
              </Select>
            </FormControl>
          </Box>

          <Box sx={{ borderBottom: 1, borderColor: 'divider' }}>
            <Tabs value={value} onChange={handleChange} variant="scrollable" scrollButtons="auto">
              <Tab icon={<Icons.Memory />} label={`Pods (${filterResources(pods).length})`} />
              <Tab icon={<Icons.Apps />} label={`Deployments (${filterResources(deployments).length})`} />
              <Tab icon={<Icons.CloudQueue />} label={`Services (${filterResources(services).length})`} />
              <Tab icon={<Icons.Settings />} label={`ConfigMaps (${filterResources(configMaps).length})`} />
              <Tab icon={<Icons.VpnKey />} label={`Secrets (${filterResources(secrets).length})`} />
              <Tab icon={<Icons.Storage />} label={`PV (${filterResources(pvs).length})`} />
              <Tab icon={<Icons.ViewQuilt />} label={`StatefulSets (${filterResources(statefulSets).length})`} />
              <Tab icon={<Icons.Extension />} label={`DaemonSets (${filterResources(daemonSets).length})`} />
              <Tab icon={<Icons.Http />} label={`Ingress (${filterResources(ingresses).length})`} />
              <Tab icon={<Icons.Storage />} label={`PVC (${filterResources(pvcs).length})`} />
              <Tab icon={<Icons.Schedule />} label={`CronJobs (${filterResources(cronJobs).length})`} />
              <Tab icon={<Icons.Work />} label={`Jobs (${filterResources(jobs).length})`} />
              <Tab icon={<Icons.Info />} label={`Events (${filterResources(events).length})`} />
            </Tabs>
          </Box>

          <TabPanel value={value} index={0}>
            {renderResourceList(filterResources(pods), (pod) => 
              `Namespace: ${pod.metadata.namespace} | Status: ${pod.status.phase}`
            )}
          </TabPanel>

          <TabPanel value={value} index={1}>
            {renderResourceList(filterResources(deployments), (deployment) => 
              `Namespace: ${deployment.metadata.namespace} | Replicas: ${deployment.status.replicas}/${deployment.spec.replicas}`
            )}
          </TabPanel>

          <TabPanel value={value} index={2}>
            {renderResourceList(filterResources(services), (service) => 
              `Namespace: ${service.metadata.namespace} | Type: ${service.spec.type} | ClusterIP: ${service.spec.clusterIP}`
            )}
          </TabPanel>

          <TabPanel value={value} index={3}>
            {renderResourceList(filterResources(configMaps), (configMap) => 
              `Namespace: ${configMap.metadata.namespace} | Data Keys: ${Object.keys(configMap.data || {}).length}`
            )}
          </TabPanel>

          <TabPanel value={value} index={4}>
            {renderResourceList(filterResources(secrets), (secret) => 
              `Namespace: ${secret.metadata.namespace} | Type: ${secret.type}`
            )}
          </TabPanel>

          <TabPanel value={value} index={5}>
            {renderResourceList(filterResources(pvs), (pv) => 
              `Capacity: ${pv.spec.capacity?.storage} | Status: ${pv.status.phase}`
            )}
          </TabPanel>

          <TabPanel value={value} index={6}>
            {renderResourceList(filterResources(statefulSets), (sts) => 
              `Namespace: ${sts.metadata.namespace} | Replicas: ${sts.status.replicas}/${sts.spec.replicas}`
            )}
          </TabPanel>

          <TabPanel value={value} index={7}>
            {renderResourceList(filterResources(daemonSets), (ds) => 
              `Namespace: ${ds.metadata.namespace} | Desired: ${ds.status.desiredNumberScheduled} | Current: ${ds.status.currentNumberScheduled}`
            )}
          </TabPanel>

          <TabPanel value={value} index={8}>
            {renderResourceList(filterResources(ingresses), (ing) => 
              `Namespace: ${ing.metadata.namespace} | Hosts: ${ing.spec.rules?.map(r => r.host).join(', ')}`
            )}
          </TabPanel>

          <TabPanel value={value} index={9}>
            {renderResourceList(filterResources(pvcs), (pvc) => 
              `Namespace: ${pvc.metadata.namespace} | Status: ${pvc.status.phase} | Size: ${pvc.spec.resources.requests.storage}`
            )}
          </TabPanel>

          <TabPanel value={value} index={10}>
            {renderResourceList(filterResources(cronJobs), (cron) => 
              `Namespace: ${cron.metadata.namespace} | Schedule: ${cron.spec.schedule}`
            )}
          </TabPanel>

          <TabPanel value={value} index={11}>
            {renderResourceList(filterResources(jobs), (job) => 
              `Namespace: ${job.metadata.namespace} | Completions: ${job.status.succeeded || 0}/${job.spec.completions || 1}`
            )}
          </TabPanel>

          <TabPanel value={value} index={12}>
            {renderResourceList(filterResources(events), (event) => 
              `Namespace: ${event.metadata.namespace} | Type: ${event.type} | Reason: ${event.reason}`
            )}
          </TabPanel>
        </Box>
      </Box>
      
      {showBottomPanel && (
        <BottomPanel
          selectedResource={selectedResource}
          currentContext={currentContext}
          onClose={() => setShowBottomPanel(false)}
          onResourceUpdate={handleResourceUpdate}
        />
      )}

      <ResourceDetails
        open={!!selectedResource}
        onClose={() => setSelectedResource(null)}
        resource={selectedResource}
      />

      <Box
        sx={{
          position: 'fixed',
          bottom: showBottomPanel ? 316 : 16,
          right: 16,
          display: 'flex',
          gap: 1
        }}
      >
        <Button
          variant="contained"
          color="primary"
          onClick={() => setShowBottomPanel(!showBottomPanel)}
          startIcon={showBottomPanel ? <Icons.KeyboardArrowDown /> : <Icons.KeyboardArrowUp />}
        >
          {showBottomPanel ? 'Hide Panel' : 'Show Panel'}
        </Button>
      </Box>
    </>
  );
}

export default ResourceList; 