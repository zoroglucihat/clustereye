import React, { useEffect, useRef, useState } from 'react';
import { Box, Paper, Typography, IconButton, TextField, Button, Divider } from '@mui/material';
import * as Icons from '@mui/icons-material';
const { ipcRenderer } = require('electron');

const DEFAULT_HEIGHT = 300;
const MIN_HEIGHT = 120;
const MAX_HEIGHT = 600;

const Terminal = ({ open, onClose, currentContext }) => {
  const [terminalOutput, setTerminalOutput] = useState([]);
  const [commandHistory, setCommandHistory] = useState([]);
  const [currentCommand, setCurrentCommand] = useState('');
  const [historyIndex, setHistoryIndex] = useState(-1);
  const [isExecuting, setIsExecuting] = useState(false);
  const [height, setHeight] = useState(DEFAULT_HEIGHT);
  const outputRef = useRef(null);
  const dragRef = useRef(null);
  const dragging = useRef(false);
  const startY = useRef(0);
  const startHeight = useRef(DEFAULT_HEIGHT);

  const commonCommands = [
    { label: 'Helm List', command: 'helm list --all-namespaces' },
    { label: 'Helm Status', command: 'helm status <release-name>' },
    { label: 'Helm History', command: 'helm history <release-name>' },
    { label: 'Helm Get Values', command: 'helm get values <release-name>' },
    { label: 'Helm Repo List', command: 'helm repo list' },
    { label: 'Helm Repo Update', command: 'helm repo update' },
    { label: 'Kubectl Get Pods', command: 'kubectl get pods --all-namespaces' },
    { label: 'Kubectl Get Services', command: 'kubectl get services --all-namespaces' },
    { label: 'Kubectl Get Nodes', command: 'kubectl get nodes' },
    { label: 'Kubectl Get Namespaces', command: 'kubectl get namespaces' },
    { label: 'Kubectl Get Deployments', command: 'kubectl get deployments --all-namespaces' },
    { label: 'Kubectl Get ConfigMaps', command: 'kubectl get configmaps --all-namespaces' },
    { label: 'Kubectl Get Secrets', command: 'kubectl get secrets --all-namespaces' },
    { label: 'Cluster Info', command: 'kubectl cluster-info' },
    { label: 'Context Info', command: 'kubectl config current-context' },
    { label: 'Context List', command: 'kubectl config get-contexts' },
    { label: 'API Resources', command: 'kubectl api-resources' },
    { label: 'Version Info', command: 'kubectl version' }
  ];

  useEffect(() => {
    if (outputRef.current) {
      outputRef.current.scrollTop = outputRef.current.scrollHeight;
    }
  }, [terminalOutput]);

  // Drag to resize
  useEffect(() => {
    const handleMouseMove = (e) => {
      if (!dragging.current) return;
      const delta = startY.current - e.clientY;
      let newHeight = Math.min(MAX_HEIGHT, Math.max(MIN_HEIGHT, startHeight.current + delta));
      setHeight(newHeight);
    };
    const handleMouseUp = () => {
      dragging.current = false;
    };
    if (dragging.current) {
      window.addEventListener('mousemove', handleMouseMove);
      window.addEventListener('mouseup', handleMouseUp);
    }
    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, []);

  const startDrag = (e) => {
    dragging.current = true;
    startY.current = e.clientY;
    startHeight.current = height;
  };

  const addOutput = (content, type = 'output') => {
    const timestamp = new Date().toLocaleTimeString();
    setTerminalOutput(prev => [...prev, { content, type, timestamp }]);
  };

  const executeCommand = async (command) => {
    if (!command.trim()) return;

    setIsExecuting(true);
    addOutput(`$ ${command}`, 'command');

    try {
      const result = await ipcRenderer.invoke('execute-terminal-command', {
        command,
        context: currentContext
      });

      if (result.success) {
        addOutput(result.output, 'output');
      } else {
        addOutput(`Error: ${result.error}`, 'error');
      }
    } catch (error) {
      addOutput(`Error: ${error.message}`, 'error');
    } finally {
      setIsExecuting(false);
    }

    // Add to command history
    setCommandHistory(prev => [...prev, command]);
    setCurrentCommand('');
    setHistoryIndex(-1);
  };

  const handleKeyPress = (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      executeCommand(currentCommand);
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      if (historyIndex < commandHistory.length - 1) {
        const newIndex = historyIndex + 1;
        setHistoryIndex(newIndex);
        setCurrentCommand(commandHistory[commandHistory.length - 1 - newIndex]);
      }
    } else if (e.key === 'ArrowDown') {
      e.preventDefault();
      if (historyIndex > 0) {
        const newIndex = historyIndex - 1;
        setHistoryIndex(newIndex);
        setCurrentCommand(commandHistory[commandHistory.length - 1 - newIndex]);
      } else if (historyIndex === 0) {
        setHistoryIndex(-1);
        setCurrentCommand('');
      }
    }
  };

  const clearTerminal = () => {
    setTerminalOutput([]);
  };

  const copyOutput = () => {
    const outputText = terminalOutput
      .map(line => `${line.timestamp} ${line.content}`)
      .join('\n');
    navigator.clipboard.writeText(outputText);
  };

  const runQuickCommand = (command) => {
    setCurrentCommand(command);
  };

  if (!open) return null;

  return (
    <Box
      sx={{
        position: 'fixed',
        left: 0,
        right: 0,
        bottom: 0,
        zIndex: 1400,
        width: '100vw',
        height: `${height}px`,
        backgroundColor: 'transparent',
        display: open ? 'flex' : 'none',
        flexDirection: 'column',
        pointerEvents: 'auto',
        boxShadow: 8
      }}
    >
      {/* Drag handle */}
      <Box
        ref={dragRef}
        onMouseDown={startDrag}
        sx={{
          height: 8,
          cursor: 'ns-resize',
          background: 'linear-gradient(to top, #6366f1 0%, #818cf8 100%)',
          borderTopLeftRadius: 8,
          borderTopRightRadius: 8,
          width: '100%',
          zIndex: 1401
        }}
      />
      <Paper
        sx={{
          flex: 1,
          display: 'flex',
          flexDirection: 'row',
          backgroundColor: '#1e1e1e',
          color: '#ffffff',
          borderTopLeftRadius: 8,
          borderTopRightRadius: 8,
          overflow: 'hidden',
          boxShadow: 8
        }}
        elevation={8}
      >
        {/* Quick Commands Panel */}
        <Box
          sx={{
            width: 260,
            p: 2,
            display: 'flex',
            flexDirection: 'column',
            backgroundColor: 'background.paper',
            borderRight: '1px solid #333',
            minWidth: 200
          }}
        >
          <Typography variant="h6" sx={{ mb: 2 }}>
            Quick Commands
          </Typography>
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1, flex: 1 }}>
            {commonCommands.map((cmd, index) => (
              <Button
                key={index}
                variant="outlined"
                size="small"
                onClick={() => runQuickCommand(cmd.command)}
                sx={{ justifyContent: 'flex-start', textAlign: 'left' }}
              >
                <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start' }}>
                  <Typography variant="body2" sx={{ fontWeight: 'bold' }}>
                    {cmd.label}
                  </Typography>
                  <Typography variant="caption" color="text.secondary">
                    {cmd.command}
                  </Typography>
                </Box>
              </Button>
            ))}
          </Box>
        </Box>

        {/* Terminal Output */}
        <Box
          sx={{
            flex: 1,
            display: 'flex',
            flexDirection: 'column',
            backgroundColor: '#1e1e1e',
            color: '#ffffff',
            minWidth: 0
          }}
        >
          {/* Header */}
          <Box
            sx={{
              p: 1,
              display: 'flex',
              alignItems: 'center',
              gap: 2,
              backgroundColor: '#23272f',
              borderBottom: '1px solid #333',
              minHeight: 40
            }}
          >
            <Icons.Terminal sx={{ color: 'primary.main' }} />
            <Typography variant="subtitle1" sx={{ flexGrow: 1 }}>
              Integrated Terminal
            </Typography>
            <Typography variant="body2" color="text.secondary">
              Context: {currentContext?.name || 'None'}
            </Typography>
            <IconButton onClick={clearTerminal} title="Clear Terminal">
              <Icons.Clear />
            </IconButton>
            <IconButton onClick={copyOutput} title="Copy Output">
              <Icons.ContentCopy />
            </IconButton>
            <IconButton onClick={onClose}>
              <Icons.Close />
            </IconButton>
          </Box>
          <Box
            ref={outputRef}
            sx={{
              flex: 1,
              p: 2,
              overflowY: 'auto',
              fontFamily: 'monospace',
              fontSize: '14px',
              lineHeight: 1.4
            }}
          >
            {terminalOutput.map((line, index) => (
              <Box
                key={index}
                sx={{
                  mb: 0.5,
                  color: line.type === 'error' ? '#ff6b6b' : 
                         line.type === 'command' ? '#4ecdc4' : '#ffffff'
                }}
              >
                <span style={{ color: '#888' }}>[{line.timestamp}]</span> {line.content}
              </Box>
            ))}
            {isExecuting && (
              <Box sx={{ color: '#4ecdc4' }}>
                <span style={{ color: '#888' }}>[{new Date().toLocaleTimeString()}]</span> Executing...
              </Box>
            )}
          </Box>
          {/* Command Input */}
          <Box sx={{ p: 2, borderTop: 1, borderColor: 'divider' }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              <Typography sx={{ color: '#4ecdc4', fontFamily: 'monospace' }}>
                $
              </Typography>
              <TextField
                fullWidth
                value={currentCommand}
                onChange={(e) => setCurrentCommand(e.target.value)}
                onKeyPress={handleKeyPress}
                placeholder="Enter command..."
                disabled={isExecuting}
                sx={{
                  '& .MuiInputBase-root': {
                    color: '#ffffff',
                    fontFamily: 'monospace',
                    '& fieldset': {
                      borderColor: '#444'
                    },
                    '&:hover fieldset': {
                      borderColor: '#666'
                    },
                    '&.Mui-focused fieldset': {
                      borderColor: '#4ecdc4'
                    }
                  },
                  '& .MuiInputBase-input': {
                    color: '#ffffff'
                  },
                  '& .MuiInputBase-input::placeholder': {
                    color: '#888'
                  }
                }}
              />
              <Button
                variant="contained"
                onClick={() => executeCommand(currentCommand)}
                disabled={isExecuting || !currentCommand.trim()}
                sx={{ minWidth: 'auto' }}
              >
                <Icons.Send />
              </Button>
            </Box>
          </Box>
        </Box>
      </Paper>
    </Box>
  );
};

export default Terminal; 