import React, { useState, useEffect } from 'react';
import { 
  Table, 
  TableBody, 
  TableCell, 
  TableHead, 
  TableRow,
  Typography,
  Box
} from '@mui/material';
import BottomPanel from './BottomPanel';

const { ipcRenderer } = window.require('electron');

function ClusterResources({ selectedContext, onContextError, onContextChange }) {
  const [selectedResource, setSelectedResource] = useState(null);
  const [showPanel, setShowPanel] = useState(false);
  const [resources, setResources] = useState([]);
  const [pods, setPods] = useState([]);

  useEffect(() => {
    if (selectedContext) {
      console.log('Debug: ClusterResources received context:', {
        name: selectedContext.name,
        type: selectedContext.type,
        hasConfig: !!selectedContext.config,
        cluster: selectedContext.cluster,
        user: selectedContext.user,
        timestamp: selectedContext.timestamp
      });
      loadPods();
    }
  }, [selectedContext]);

  const loadPods = async () => {
    try {
      const podList = await ipcRenderer.invoke('get-pods', selectedContext);
      setPods(podList.items);
    } catch (error) {
      console.error('Error loading pods:', error);
    }
  };

  const handleResourceClick = (resource) => {
    setSelectedResource(resource);
    setShowPanel(true);
  };

  return (
    <Box sx={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
      <Typography variant="h6" sx={{ mb: 2 }}>Pod Listesi</Typography>
      
      <Table>
        <TableHead>
          <TableRow>
            <TableCell>İsim</TableCell>
            <TableCell>Namespace</TableCell>
            <TableCell>Status</TableCell>
          </TableRow>
        </TableHead>
        <TableBody>
          {pods.map((pod) => (
            <TableRow 
              key={`${pod.metadata.namespace}-${pod.metadata.name}`}
              onClick={() => handleResourceClick(pod)}
              sx={{ cursor: 'pointer' }}
            >
              <TableCell>{pod.metadata.name}</TableCell>
              <TableCell>{pod.metadata.namespace}</TableCell>
              <TableCell>{pod.status.phase}</TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
      
      {showPanel && selectedContext && (
        <BottomPanel
          selectedResource={selectedResource}
          selectedContext={selectedContext}
          onClose={() => setShowPanel(false)}
          onContextChange={onContextChange}
        />
      )}
    </Box>
  );
}

export default ClusterResources; 