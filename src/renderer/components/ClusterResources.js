import React, { useState, useEffect } from 'react';
import { 
  Table, 
  TableBody, 
  TableCell, 
  TableHead, 
  TableRow,
  Typography
} from '@mui/material';

const { ipcRenderer } = window.require('electron');

function ClusterResources({ config }) {
  const [pods, setPods] = useState([]);

  useEffect(() => {
    loadPods();
  }, [config]);

  const loadPods = async () => {
    try {
      const podList = await ipcRenderer.invoke('get-pods', config);
      setPods(podList.items);
    } catch (error) {
      console.error('Error loading pods:', error);
    }
  };

  return (
    <div>
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
            <TableRow key={`${pod.metadata.namespace}-${pod.metadata.name}`}>
              <TableCell>{pod.metadata.name}</TableCell>
              <TableCell>{pod.metadata.namespace}</TableCell>
              <TableCell>{pod.status.phase}</TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}

export default ClusterResources; 