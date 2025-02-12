import React from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  IconButton,
  Typography,
  Box,
  Tabs,
  Tab,
  Paper,
  Chip
} from '@mui/material';
import * as Icons from '@mui/icons-material';
import YAML from 'yaml';

function TabPanel({ children, value, index }) {
  return (
    <div role="tabpanel" hidden={value !== index}>
      {value === index && <Box sx={{ p: 2 }}>{children}</Box>}
    </div>
  );
}

function ResourceDetails({ open, onClose, resource }) {
  const [tabValue, setTabValue] = React.useState(0);

  if (!resource) return null;

  const handleTabChange = (event, newValue) => {
    console.log(newValue);
    setTabValue(newValue);
  };

  const renderMetadata = () => (
    <Box>
      <Typography variant="subtitle2" color="text.secondary">Name</Typography>
      <Typography paragraph>{resource.metadata.name}</Typography>

      <Typography variant="subtitle2" color="text.secondary">Namespace</Typography>
      <Typography paragraph>{resource.metadata.namespace}</Typography>

      <Typography variant="subtitle2" color="text.secondary">Created</Typography>
      <Typography paragraph>{new Date(resource.metadata.creationTimestamp).toLocaleString()}</Typography>

      <Typography variant="subtitle2" color="text.secondary">Labels</Typography>
      <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1, mb: 2 }}>
        {Object.entries(resource.metadata.labels || {}).map(([key, value]) => (
          <Chip key={key} label={`${key}: ${value}`} size="small" />
        ))}
      </Box>

      <Typography variant="subtitle2" color="text.secondary">Annotations</Typography>
      <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1 }}>
        {Object.entries(resource.metadata.annotations || {}).map(([key, value]) => (
          <Chip key={key} label={`${key}: ${value}`} size="small" />
        ))}
      </Box>
    </Box>
  );

  const renderSpec = () => {
    if (!resource?.spec) return null;
    
    const yamlString = YAML.stringify(resource.spec);
    
    return (
      <Box sx={{ position: 'relative' }}>
        <pre style={{ 
          margin: 0,
          padding: '16px',
          backgroundColor: 'rgba(0,0,0,0.1)',
          borderRadius: '4px',
          whiteSpace: 'pre-wrap',
          wordBreak: 'break-word',
          fontFamily: 'monospace'
        }}>
          {yamlString}
        </pre>
        <IconButton
          size="small"
          onClick={() => navigator.clipboard.writeText(yamlString)}
          sx={{ 
            position: 'absolute',
            top: 8,
            right: 8,
            color: 'text.secondary'
          }}
        >
          <Icons.ContentCopy fontSize="small" />
        </IconButton>
      </Box>
    );
  };

  const renderStatus = () => {
    if (!resource?.status) return null;

    const yamlString = YAML.stringify(resource.status);
    
    return (
      <Box sx={{ position: 'relative' }}>
        <pre style={{ 
          margin: 0,
          padding: '16px',
          backgroundColor: 'rgba(0,0,0,0.1)',
          borderRadius: '4px',
          whiteSpace: 'pre-wrap',
          wordBreak: 'break-word',
          fontFamily: 'monospace'
        }}>
          {yamlString}
        </pre>
        <IconButton
          size="small"
          onClick={() => navigator.clipboard.writeText(yamlString)}
          sx={{ 
            position: 'absolute',
            top: 8,
            right: 8,
            color: 'text.secondary'
          }}
        >
          <Icons.ContentCopy fontSize="small" />
        </IconButton>
      </Box>
    );
  };

  const renderPodDetails = () => {
    if (resource.kind !== 'Pod') return null;
    
    return (
      <Box>
        <Typography variant="subtitle2" color="text.secondary">Containers</Typography>
        {resource.spec.containers.map((container, index) => (
          <Paper key={index} sx={{ p: 2, mb: 2, backgroundColor: 'background.paper' }}>
            <Typography variant="subtitle1">{container.name}</Typography>
            <Typography variant="body2">Image: {container.image}</Typography>
            <Typography variant="body2">
              Ports: {container.ports?.map(p => p.containerPort).join(', ') || 'None'}
            </Typography>
            <Typography variant="body2">
              Resources: {JSON.stringify(container.resources || {}, null, 2)}
            </Typography>
          </Paper>
        ))}

        <Typography variant="subtitle2" color="text.secondary">Conditions</Typography>
        {resource.status.conditions?.map((condition, index) => (
          <Paper key={index} sx={{ p: 2, mb: 1, backgroundColor: 'background.paper' }}>
            <Typography variant="body2">
              {condition.type}: {condition.status}
              {condition.message && ` (${condition.message})`}
            </Typography>
          </Paper>
        ))}
      </Box>
    );
  };

  return (
    <Dialog 
      open={open} 
      onClose={onClose}
      maxWidth="lg"
      fullWidth
    >
      <DialogTitle sx={{ m: 0, p: 2, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <Typography variant="h6">
            {resource.kind}: {resource.metadata.name}
          </Typography>
          {resource.status?.phase && (
            <Chip 
              label={resource.status.phase}
              color={resource.status.phase === 'Running' ? 'success' : 'default'}
              size="small"
            />
          )}
        </Box>
        <IconButton onClick={onClose}>
          <Icons.Close />
        </IconButton>
      </DialogTitle>

      <DialogContent dividers>
        <Box sx={{ borderBottom: 1, borderColor: 'divider', mb: 2 }}>
          <Tabs value={tabValue} onChange={handleTabChange}>
            <Tab label="Metadata" />
            <Tab label="Spec" />
            <Tab label="Status" />
            {resource.kind === 'Pod' && <Tab label="Details" />}
          </Tabs>
        </Box>

        <TabPanel value={tabValue} index={0}>
          {renderMetadata()}
        </TabPanel>
        <TabPanel value={tabValue} index={1}>
          {renderSpec()}
        </TabPanel>
        <TabPanel value={tabValue} index={2}>
          {renderStatus()}
        </TabPanel>
        {resource.kind === 'Pod' && (
          <TabPanel value={tabValue} index={3}>
            {renderPodDetails()}
          </TabPanel>
        )}
      </DialogContent>
    </Dialog>
  );
}

export default ResourceDetails; 