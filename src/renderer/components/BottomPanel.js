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
import * as monaco from 'monaco-editor';
import '../monaco-config';  // Monaco yapılandırmasını import et

const { ipcRenderer } = window.require('electron');

function BottomPanel({ selectedResource, currentContext, onClose, onResourceUpdate, height = 300 }) {
  const [value, setValue] = useState(0);
  const [yaml, setYaml] = useState('');
  const [applyStatus, setApplyStatus] = useState(null);
  const [statusMessage, setStatusMessage] = useState('');
  const [command, setCommand] = useState('');
  const terminalRef = useRef(null);
  const terminalContainerRef = useRef(null);
  const [terminal, setTerminal] = useState(null);
  const [username, setUsername] = useState('');
  const [hostname, setHostname] = useState('');

  // Terminal prompt'unu güncellemek için ref
  const promptRef = useRef('$ ');

  useEffect(() => {
    // Component mount olduğunda context'i kontrol et
    console.log('BottomPanel mounted with context:', currentContext);
  }, []);

  useEffect(() => {
    // Context değiştiğinde log
    console.log('Context changed in BottomPanel:', currentContext);
  }, [currentContext]);

  // Kullanıcı bilgilerini al
  useEffect(() => {
    const getUserInfo = async () => {
      if (currentContext) {
        try {
          // Önce mevcut shell'i öğren
          const shellResult = await ipcRenderer.invoke('exec-command', {
            command: 'echo $SHELL',
            context: currentContext
          });

          const [usernameResult, hostnameResult] = await Promise.all([
            ipcRenderer.invoke('exec-command', {
              command: process.platform === 'win32' ? 'echo %USERNAME%' : 'whoami',
              context: currentContext
            }),
            ipcRenderer.invoke('exec-command', {
              command: 'hostname',
              context: currentContext
            })
          ]);
          
          const user = usernameResult.trim();
          const host = hostnameResult.trim();
          
          console.log('Got user info:', { user, host, shell: shellResult.trim() });
          
          setUsername(user);
          setHostname(host);
          
          // Prompt'u güncelle
          promptRef.current = `${user}@${host}:~$ `;
          
          // Eğer terminal varsa prompt'u güncelle
          if (terminal) {
            terminal.write('\r\n' + promptRef.current);
          }
        } catch (error) {
          console.error('Error getting user info:', error);
          setUsername('user');
          setHostname('localhost');
          promptRef.current = 'user@localhost:~$ ';
        }
      }
    };
    getUserInfo();
  }, [currentContext]);

  // Terminal'i yeniden oluşturmak için value değiştiğinde kontrol et
  useEffect(() => {
    if (value === 0) {  // Terminal tab'ı seçiliyse
      if (!terminal && terminalContainerRef.current) {
        const term = new Terminal({
          cursorBlink: true,
          fontSize: 14,
          fontFamily: 'Menlo, Monaco, monospace',
          theme: {
            background: '#1e1e1e',
            foreground: '#ffffff',
            cursor: '#ffffff',
            selection: '#5DA5D533'
          },
          convertEol: true,
          cursorStyle: 'block'
        });

        const fitAddon = new FitAddon();
        term.loadAddon(fitAddon);

        term.open(terminalContainerRef.current);
        fitAddon.fit();
        
        // Prompt'u hazırla
        const prompt = selectedResource?.kind === 'Pod' 
          ? `${selectedResource.metadata.namespace}/${selectedResource.metadata.name}:/ $ `
          : promptRef.current;

        console.log('Using prompt:', prompt);
        term.write('\r\n' + prompt);

        let currentLine = '';
        let commandHistory = [];
        let historyIndex = 0;

        term.onKey(({ key, domEvent }) => {
          const printable = !domEvent.altKey && !domEvent.ctrlKey && !domEvent.metaKey;

          if (domEvent.keyCode === 13) { // Enter
            if (currentLine.trim()) {
              commandHistory.push(currentLine);
              historyIndex = commandHistory.length;
              executeCommand(currentLine, term).then(() => {
                term.write('\r\n' + promptRef.current);
              });
              currentLine = '';
            } else {
              term.write('\r\n' + promptRef.current);
            }
          } else if (domEvent.keyCode === 8) { // Backspace
            if (currentLine.length > 0) {
              currentLine = currentLine.slice(0, -1);
              term.write('\b \b');
            }
          } else if (domEvent.keyCode === 38) { // Up arrow
            if (historyIndex > 0) {
              historyIndex--;
              currentLine = commandHistory[historyIndex];
              term.write('\r' + promptRef.current + currentLine);
            }
          } else if (domEvent.keyCode === 40) { // Down arrow
            if (historyIndex < commandHistory.length - 1) {
              historyIndex++;
              currentLine = commandHistory[historyIndex];
              term.write('\r' + promptRef.current + currentLine);
            }
          } else if (printable) {
            currentLine += key;
            term.write(key);
          }
        });

        setTerminal(term);
      }
    } else {
      // Terminal tab'ından çıkıldığında terminal'i temizle
      if (terminal) {
        terminal.dispose();
        setTerminal(null);
      }
    }

    return () => {
      if (terminal) {
        terminal.dispose();
        setTerminal(null);
      }
    };
  }, [value, selectedResource, currentContext]); // value değişimini izle

  useEffect(() => {
    if (selectedResource) {
      const yamlContent = JSON.stringify(selectedResource, null, 2);
      setYaml(yamlContent);
    }
  }, [selectedResource]);

  const handleTabChange = (event, newValue) => {
    setValue(newValue);
  };

  const handleApply = async () => {
    try {
      setApplyStatus('pending');
      setStatusMessage('Applying YAML...');

      if (!currentContext?.config || !currentContext?.name) {
        console.error('Invalid context:', {
          hasConfig: !!currentContext?.config,
          hasName: !!currentContext?.name,
          context: currentContext
        });
        setApplyStatus('error');
        setStatusMessage('Please select a valid context from the left sidebar');
        alert('Please select a valid context from the left sidebar');
        return;
      }

      const result = await ipcRenderer.invoke('apply-yaml', {
        yamlContent: yaml.trim(),
        context: currentContext
      });

      if (result?.success) {
        console.log(`Successfully applied YAML to context "${currentContext.name}"`);
        setApplyStatus('success');
        setStatusMessage(`Successfully applied ${result.results.length} resources`);
        
        // Kaynakları hemen güncelle
        onResourceUpdate();

        // 3 saniye sonra kapat
        setTimeout(() => {
          setApplyStatus(null);
          setStatusMessage('');
          onClose();
        }, 3000);
      } else {
        throw new Error(result?.message || 'Failed to apply YAML');
      }
    } catch (error) {
      console.error('Error applying YAML:', error);
      setApplyStatus('error');
      setStatusMessage(error.message);
      alert(`Failed to apply YAML: ${error.message}`);
    }
  };

  const executeCommand = async (command, term) => {
    try {
      // Debug için
      console.log('Executing command with context:', {
        command,
        currentContext,
        selectedResource
      });

      // Özel komutları işle
      if (command === 'clear') {
        term.clear();
        return;
      }

      // CD komutunu işle
      if (command.startsWith('cd ')) {
        term.write('\r\n' + `Cannot change directory in web terminal`);
        return;
      }

      const result = await ipcRenderer.invoke('exec-command', {
        command,
        namespace: selectedResource?.metadata?.namespace,
        podName: selectedResource?.metadata?.name,
        context: currentContext // Tüm context objesini gönder
      });

      if (result) {
        term.write('\r\n' + result);
      }
    } catch (error) {
      console.error('Terminal command error:', error);
      term.write('\r\n\x1b[31m' + error.message + '\x1b[0m');
    }
  };

  const handleEditorDidMount = (editor, monaco) => {
    // YAML dil desteği
    monaco.languages.register({ id: 'yaml' });
    monaco.languages.setMonarchTokensProvider('yaml', {
      tokenizer: {
        root: [
          [/^[\t ]*[A-Za-z_\-0-9]+(?=\:)/, 'type.identifier'],
          [/\:/, 'delimiter'],
          [/#.*$/, 'comment'],
          [/[0-9]+/, 'number'],
          [/[A-Za-z_\-0-9]+/, 'identifier'],
          [/".*?"/, 'string'],
          [/'.*?'/, 'string']
        ]
      }
    });

    // Klavye kısayolları
    editor.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyCode.KeyV, () => {
      const { clipboard } = require('electron');
      const text = clipboard.readText();
      const position = editor.getPosition();
      editor.executeEdits('paste', [{
        range: new monaco.Range(
          position.lineNumber,
          position.column,
          position.lineNumber,
          position.column
        ),
        text: text
      }]);
    });
  };

  return (
    <Drawer
      anchor="bottom"
      open={true}
      variant="persistent"
      sx={{
        '& .MuiDrawer-paper': {
          height: height,
          overflow: 'hidden'
        }
      }}
    >
      <Box sx={{ width: '100%', height: '100%', display: 'flex', flexDirection: 'column' }}>
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
          </Box>

          {/* YAML Editor Tab */}
          <Box
            role="tabpanel"
            hidden={value !== 1}
            sx={{ height: '100%', display: value === 1 ? 'flex' : 'none' }}
          >
            <Box sx={{ display: 'flex', flexDirection: 'column', height: '100%', width: '100%' }}>
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
                  wordWrap: 'on',
                  quickSuggestions: true,
                  contextmenu: true,
                  copyWithSyntaxHighlighting: true,
                  multiCursorPaste: 'full',
                  bracketPairColorization: true,
                  formatOnPaste: true,
                  formatOnType: true,
                  // Ek editor ayarları
                  acceptSuggestionOnCommitCharacter: true,
                  acceptSuggestionOnEnter: 'on',
                  accessibilitySupport: 'auto',
                  autoIndent: 'full',
                  smoothScrolling: true,
                  dragAndDrop: true,
                  links: true,
                  mouseWheelZoom: true
                }}
              />
              <Box sx={{ p: 1, borderTop: 1, borderColor: 'divider', display: 'flex', alignItems: 'center', gap: 2 }}>
                <Button 
                  variant="contained" 
                  onClick={handleApply}
                  disabled={!yaml.trim() || applyStatus === 'pending'}
                >
                  {applyStatus === 'pending' ? 'Applying...' : 'Apply'}
                </Button>

                {applyStatus && (
                  <Box sx={{ 
                    display: 'flex', 
                    alignItems: 'center', 
                    gap: 1,
                    color: applyStatus === 'success' ? 'success.main' : 
                           applyStatus === 'error' ? 'error.main' : 
                           'info.main'
                  }}>
                    {applyStatus === 'success' && <Icons.CheckCircle color="success" />}
                    {applyStatus === 'error' && <Icons.Error color="error" />}
                    {applyStatus === 'pending' && <Icons.Pending color="info" />}
                    <Typography variant="body2">{statusMessage}</Typography>
                  </Box>
                )}
              </Box>
            </Box>
          </Box>
        </Box>
      </Box>
    </Drawer>
  );
}

export default BottomPanel; 