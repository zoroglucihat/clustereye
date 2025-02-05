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
  const [messages, setMessages] = useState([]);
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

  // Context değiştiğinde otomatik analiz yap
  useEffect(() => {
    if (currentContext && open) {
      handleInitialAnalysis();
    }
  }, [currentContext, open]);

  // İlk analizi gerçekleştir
  const handleInitialAnalysis = async () => {
    setIsTyping(true);
    try {
      const response = await ipcRenderer.invoke('ask-advisor', {
        message: "Please analyze this cluster's current state and highlight any important findings or potential issues.",
        model: selectedModel,
        context: currentContext
      });

      const aiMessage = {
        role: 'assistant',
        content: response,
        timestamp: new Date().toISOString()
      };

      setMessages([aiMessage]); // Önceki mesajları temizle ve yeni analizi göster
    } catch (error) {
      console.error('Error getting initial analysis:', error);
      const errorMessage = {
        role: 'assistant',
        content: `Error analyzing cluster: ${error.message}. Please try again.`,
        timestamp: new Date().toISOString(),
        isError: true
      };
      setMessages([errorMessage]);
    } finally {
      setIsTyping(false);
    }
  };

  // Context değiştiğinde mesajları temizle
  useEffect(() => {
    setMessages([]);
  }, [currentContext]);

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
      console.log('Sending to AI:', { message: input, model: selectedModel }); // Debug log

      const response = await ipcRenderer.invoke('ask-advisor', {
        message: input,
        model: selectedModel,
        context: currentContext
      });

      console.log('AI Response received:', response); // Debug log

      const aiMessage = {
        role: 'assistant',
        content: response,
        timestamp: new Date().toISOString()
      };

      setMessages(prev => [...prev, aiMessage]);
    } catch (error) {
      console.error('Error getting AI response:', error);
      
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

  const renderMessage = (message) => (
    <Box
      sx={{
        display: 'flex',
        gap: 2,
        mb: 2,
        flexDirection: message.role === 'user' ? 'row-reverse' : 'row'
      }}
    >
      <Avatar
        sx={{
          bgcolor: message.isError ? 'error.main' : 
                  message.role === 'user' ? 'primary.main' : 'secondary.main'
        }}
      >
        {message.role === 'user' ? <Icons.Person /> : 
         message.isError ? <Icons.Error /> : <Icons.SmartToy />}
      </Avatar>
      <Paper
        sx={{
          p: 2,
          maxWidth: '70%',
          bgcolor: message.isError ? 'error.dark' :
                  message.role === 'user' ? 'primary.dark' : 'background.paper',
          borderRadius: 2
        }}
      >
        <Typography variant="body1" 
          sx={{ 
            color: message.isError ? 'error.light' : 'inherit'
          }}
        >
          {message.content}
        </Typography>
        <Typography variant="caption" color="text.secondary">
          {new Date(message.timestamp).toLocaleTimeString()}
        </Typography>
      </Paper>
    </Box>
  );

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
        <IconButton 
          onClick={handleInitialAnalysis}
          sx={{ mr: 1 }}
          title="Refresh Analysis"
        >
          <Icons.Refresh />
        </IconButton>
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