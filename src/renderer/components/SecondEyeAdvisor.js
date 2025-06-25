import React, { useState, useRef, useEffect } from 'react';
import {
  Drawer,
  Box,
  Typography,
  IconButton,
  TextField,
  Paper,
  Select,
  MenuItem,
  FormControl,
  InputLabel,
  Divider,
  Avatar,
  Tooltip
} from '@mui/material';
import * as Icons from '@mui/icons-material';

// ipcRenderer'ı ekle
const { ipcRenderer } = window.require('electron');

const DRAWER_WIDTH = 380;

const AI_MODELS = {
  GPT4: 'GPT-4',
  GPT35: 'GPT-3.5',
  CLAUDE: 'Claude',
  GEMINI: 'Gemini'
};

function SecondEyeAdvisor({ open, onClose, currentContext }) {
  const [messages, setMessages] = useState([{
    role: 'assistant',
    content: 'Hello! I can help you analyze your Kubernetes cluster. What would you like to know?',
    timestamp: new Date().toISOString()
  }]);
  const [input, setInput] = useState('');
  const [selectedModel, setSelectedModel] = useState(AI_MODELS.GPT4);
  const [isTyping, setIsTyping] = useState(false);
  const messagesEndRef = useRef(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  // Context değiştiğinde otomatik analiz yapma özelliğini kaldıralım
  useEffect(() => {
    if (currentContext && open) {
      // handleInitialAnalysis(); // Bu satırı kaldırıyoruz
      console.log('Context changed:', currentContext.name);
    }
  }, [currentContext, open]);

  const handleSend = async () => {
    if (!input.trim()) return;

    const userMessage = {
      role: 'user',
      content: input,
      timestamp: new Date().toISOString()
    };

    setMessages(prev => [...prev, userMessage]);
    setInput('');
    setIsTyping(true);

    try {
      console.log('AI Advisor is currently disabled'); // Debug log

      // AI Advisor is currently disabled - show message instead of calling API
      const aiMessage = {
        role: 'assistant',
        content: 'AI Advisor is currently disabled. The OpenAI integration has been commented out to prevent startup errors. Please set up your OpenAI API key to enable this feature.',
        timestamp: new Date().toISOString(),
        isError: true
      };
      
      setMessages(prev => [...prev, aiMessage]);
    } catch (error) {
      console.error('Error in AI advisor:', error);
      
      // Hata mesajını kullanıcıya göster
      const errorMessage = {
        role: 'assistant',
        content: `Error: ${error.message}. Please try again.`,
        timestamp: new Date().toISOString(),
        isError: true
      };
      
      setMessages(prev => [...prev, errorMessage]);
    } finally {
      setIsTyping(false);
    }
  };

  const renderMessage = (message) => {
    const formatContent = (content) => {
      // Code block'ları bul (``` ile başlayan ve biten)
      return content.split(/(```[a-z]*\n[\s\S]*?```)/g).map((part, index) => {
        if (part.startsWith('```')) {
          // Code block
          const language = part.split('\n')[0].replace('```', '');
          const code = part
            .split('\n')
            .slice(1, -1)
            .join('\n');
          
          return (
            <Box key={index} sx={{ my: 2 }}>
              <Paper 
                sx={{ 
                  p: 2,
                  backgroundColor: 'grey.900',
                  position: 'relative'
                }}
              >
                {language && (
                  <Typography 
                    variant="caption" 
                    sx={{ 
                      position: 'absolute',
                      top: 8,
                      right: 8,
                      color: 'text.secondary'
                    }}
                  >
                    {language}
                  </Typography>
                )}
                <pre style={{ 
                  margin: 0,
                  whiteSpace: 'pre-wrap',
                  wordBreak: 'break-word',
                  color: '#e6e6e6',
                  fontFamily: 'monospace'
                }}>
                  {code}
                </pre>
                <Box sx={{ 
                  display: 'flex', 
                  justifyContent: 'flex-end',
                  mt: 1 
                }}>
                  <IconButton
                    size="small"
                    onClick={() => navigator.clipboard.writeText(code)}
                    sx={{ color: 'text.secondary' }}
                  >
                    <Icons.ContentCopy fontSize="small" />
                  </IconButton>
                </Box>
              </Paper>
            </Box>
          );
        }
        // Normal text
        return (
          <Typography key={index} variant="body1" sx={{ my: 1, whiteSpace: 'pre-wrap' }}>
            {part}
          </Typography>
        );
      });
    };

    return (
      <Box sx={{
        display: 'flex',
        gap: 2,
        alignItems: 'flex-start'
      }}>
        <Avatar 
          sx={{ 
            bgcolor: message.role === 'assistant' ? 'primary.main' : 'secondary.main'
          }}
        >
          {message.role === 'assistant' ? <Icons.SmartToy /> : <Icons.Person />}
        </Avatar>
        <Box sx={{ flex: 1 }}>
          {formatContent(message.content)}
          <Typography variant="caption" color="text.secondary">
            {new Date(message.timestamp).toLocaleTimeString()}
          </Typography>
        </Box>
      </Box>
    );
  };

  return (
    <Drawer
      anchor="right"
      open={open}
      variant="persistent"
      sx={{
        width: DRAWER_WIDTH,
        flexShrink: 0,
        position: 'fixed',
        height: '100%',
        '& .MuiDrawer-paper': {
          width: DRAWER_WIDTH,
          boxSizing: 'border-box',
          borderLeft: '1px solid',
          borderColor: 'divider',
          height: `calc(100% - 64px)`,
          top: '64px',
          zIndex: 1,
          backgroundColor: (theme) => theme.palette.background.default,
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
        },
      }}
    >
      <Box 
        sx={{ 
          p: 2, 
          display: 'flex', 
          alignItems: 'center', 
          gap: 1,
          borderBottom: 1,
          borderColor: 'divider',
          backgroundColor: 'background.paper',
          minHeight: '64px', // Sabit header yüksekliği
          flexShrink: 0, // Header'ın küçülmesini engelle
        }}
      >
        <Icons.Psychology sx={{ color: 'primary.main' }} />
        <Typography variant="h6" sx={{ flexGrow: 1 }}>
          Second Eye Advisor
        </Typography>
        <FormControl size="small" sx={{ minWidth: 120 }}>
          <InputLabel>AI Model</InputLabel>
          <Select
            value={selectedModel}
            onChange={(e) => setSelectedModel(e.target.value)}
            label="AI Model"
          >
            {Object.values(AI_MODELS).map((model) => (
              <MenuItem key={model} value={model}>{model}</MenuItem>
            ))}
          </Select>
        </FormControl>
        <IconButton onClick={onClose}>
          <Icons.ChevronRight />
        </IconButton>
      </Box>

      <Box
        sx={{
          flexGrow: 1,
          overflowY: 'auto',
          display: 'flex',
          flexDirection: 'column',
          p: 2,
          gap: 2,
        }}
      >
        {messages.map((message, index) => (
          <Box key={index}>{renderMessage(message)}</Box>
        ))}
        {isTyping && (
          <Box sx={{ display: 'flex', gap: 1, alignItems: 'center', color: 'text.secondary' }}>
            <Icons.MoreHoriz />
            <Typography variant="body2">AI is typing...</Typography>
          </Box>
        )}
        <div ref={messagesEndRef} />
      </Box>

      <Box 
        sx={{ 
          p: 2, 
          borderTop: 1, 
          borderColor: 'divider',
          backgroundColor: 'background.paper',
          flexShrink: 0, // Input alanının küçülmesini engelle
        }}
      >
        <TextField
          fullWidth
          multiline
          maxRows={4}
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyPress={(e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
              e.preventDefault();
              handleSend();
            }
          }}
          placeholder="Ask about your cluster..."
          InputProps={{
            endAdornment: (
              <IconButton 
                onClick={handleSend} 
                disabled={!input.trim()}
                sx={{ 
                  color: input.trim() ? 'primary.main' : 'text.disabled',
                }}
              >
                <Icons.Send />
              </IconButton>
            ),
          }}
          sx={{
            '& .MuiOutlinedInput-root': {
              backgroundColor: 'background.default',
            }
          }}
        />
      </Box>
    </Drawer>
  );
}

export default SecondEyeAdvisor; 