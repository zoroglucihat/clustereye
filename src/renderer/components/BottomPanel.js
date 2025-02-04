import React, { useState, useEffect, useRef } from 'react';
import {
  Box,
  Paper,
  Tabs,
  Tab,
  IconButton,
  Typography,
  TextField,
  Button,
  Drawer
} from '@mui/material';
import * as Icons from '@mui/icons-material';
import { Editor } from '@monaco-editor/react';
import { Terminal } from 'xterm';
import { FitAddon } from 'xterm-addon-fit';

const { ipcRenderer } = window.require('electron');

function BottomPanel({ selectedResource, onClose, height = 300 }) {
  const [value, setValue] = useState(0);
  const [yaml, setYaml] = useState('');
  const terminalRef = useRef(null);
  const terminalContainerRef = useRef(null);
  const [terminal, setTerminal] = useState(null);

  useEffect(() => {
    if (value === 0 && selectedResource?.kind === 'Pod' && !terminal) {
      const term = new Terminal({
        cursorBlink: true,
        fontSize: 14,
        fontFamily: 'monospace',
        theme: {
          background: '#1e1e1e',
          foreground: '#ffffff'
        }
      });

      const fitAddon = new FitAddon();
      term.loadAddon(fitAddon);

      if (terminalContainerRef.current) {
        term.open(terminalContainerRef.current);
        fitAddon.fit();
        term.write('$ ');

        term.onData(data => {
          // Terminal input handling
          if (data === '\r') { // Enter key
            term.write('\r\n$ ');
          } else {
            term.write(data);
          }
        });

        setTerminal(term);
      }

      return () => {
        term.dispose();
      };
    }
  }, [value, selectedResource]);

  const handleTabChange = (event, newValue) => {
    setValue(newValue);
  };

  const handleApply = async () => {
    try {
      await ipcRenderer.invoke('apply-yaml', yaml);
      // Başarılı mesajı göster
    } catch (error) {
      // Hata mesajı göster
      console.error('Error applying YAML:', error);
    }
  };

  const handleTerminalCommand = async (command) => {
    try {
      const result = await ipcRenderer.invoke('exec-in-pod', {
        namespace: selectedResource?.metadata?.namespace,
        podName: selectedResource?.metadata?.name,
        command: command
      });
      // Terminal çıktısını göster
    } catch (error) {
      console.error('Error executing command:', error);
    }
  };

  const handleEditorDidMount = (editor, monaco) => {
    // Temel YAML desteği yeterli
    monaco.languages.register({ id: 'yaml' });
  };

  return (
    <Drawer
      anchor="bottom"
      variant="persistent"
      open={true}
      sx={{
        '& .MuiDrawer-paper': {
          height: height,
          overflow: 'hidden'
        },
      }}
    >
      <Box sx={{ 
        width: '100%', 
        height: '100%',
        display: 'flex',
        flexDirection: 'column'
      }}>
        <Box sx={{ 
          borderBottom: 1, 
          borderColor: 'divider',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          px: 2
        }}>
          <Tabs value={value} onChange={handleTabChange}>
            <Tab 
              icon={<Icons.Terminal />} 
              label="Terminal" 
              disabled={!selectedResource || selectedResource.kind !== 'Pod'} 
            />
            <Tab icon={<Icons.Code />} label="YAML Editor" />
          </Tabs>
          <IconButton onClick={onClose}>
            <Icons.Close />
          </IconButton>
        </Box>

        <Box sx={{ flexGrow: 1, overflow: 'hidden' }}>
          {/* Terminal Tab */}
          <Box
            role="tabpanel"
            hidden={value !== 0}
            sx={{ height: '100%', display: value === 0 ? 'flex' : 'none' }}
          >
            {selectedResource?.kind === 'Pod' ? (
              <Box 
                ref={terminalContainerRef}
                sx={{ 
                  p: 1, 
                  backgroundColor: '#1e1e1e',
                  color: '#fff',
                  flexGrow: 1,
                  '& .xterm': {
                    height: '100%'
                  }
                }}
              />
            ) : (
              <Box sx={{ p: 2 }}>
                <Typography>Select a pod to use terminal</Typography>
              </Box>
            )}
          </Box>

          {/* YAML Editor Tab */}
          <Box
            role="tabpanel"
            hidden={value !== 1}
            sx={{ height: '100%', display: value === 1 ? 'flex' : 'none' }}
          >
            <Box sx={{ 
              display: 'flex', 
              flexDirection: 'column',
              height: '100%',
              width: '100%'
            }}>
              <Editor
                height="100%"
                defaultLanguage="yaml"
                theme="vs-dark"
                value={yaml}
                onChange={setYaml}
                onMount={handleEditorDidMount}
                options={{
                  minimap: { enabled: false },
                  scrollBeyondLastLine: false,
                  fontSize: 14,
                  lineNumbers: 'on',
                  automaticLayout: true,
                  wordWrap: 'on'
                }}
              />
              <Box sx={{ p: 1, borderTop: 1, borderColor: 'divider' }}>
                <Button 
                  variant="contained" 
                  onClick={handleApply}
                  disabled={!yaml.trim()}
                >
                  Apply
                </Button>
              </Box>
            </Box>
          </Box>
        </Box>
      </Box>
    </Drawer>
  );
}

export default BottomPanel; 