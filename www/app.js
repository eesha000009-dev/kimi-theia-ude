/* ============================================
   Kimi K2.6 UDE - Application Logic
   ============================================ */

(function() {
  'use strict';

  // ── Config ──
  const CONFIG = {
    apiEndpoint: 'https://integrate.api.nvidia.com/v1/chat/completions',
    apiKey: '',
    model: 'moonshotai/kimi-k2.6',
    maxTokens: 4096,
    temperature: 0.7,
  };

  // ── State ──
  const state = {
    files: {},
    currentFile: 'untitled.js',
    chatHistory: [],
    terminalHistory: [],
    terminalHistoryIdx: -1,
    isAiTyping: false,
  };

  // ── DOM refs ──
  const $ = (sel) => document.querySelector(sel);
  const $$ = (sel) => document.querySelectorAll(sel);

  // ── Initialize ──
  document.addEventListener('DOMContentLoaded', init);

  function init() {
    loadSettings();
    loadFiles();
    setupSplash();
    setupTabs();
    setupEditor();
    setupAiChat();
    setupTerminal();
    setupFiles();
    setupModals();
    setupKeyboardShortcuts();
  }

  // ── Splash ──
  function setupSplash() {
    const splash = $('#splash');
    const status = $('#splashStatus');
    const steps = ['Loading modules...', 'Initializing editor...', 'Connecting AI...', 'Ready!'];
    let i = 0;
    const iv = setInterval(() => {
      if (i < steps.length) {
        status.textContent = steps[i++];
      } else {
        clearInterval(iv);
        setTimeout(() => {
          splash.classList.add('fade-out');
          setTimeout(() => splash.remove(), 500);
          $('#app').classList.remove('hidden');
        }, 300);
      }
    }, 500);
  }

  // ── Tabs ──
  function setupTabs() {
    $$('.tab').forEach(tab => {
      tab.addEventListener('click', () => {
        $$('.tab').forEach(t => t.classList.remove('active'));
        $$('.panel').forEach(p => p.classList.remove('active'));
        tab.classList.add('active');
        const panelId = tab.dataset.tab + 'Panel';
        $('#' + panelId).classList.add('active');
      });
    });
  }

  // ── Editor ──
  function setupEditor() {
    const editor = $('#codeEditor');
    const lineNums = $('#lineNumbers');
    const cursorPos = $('#cursorPos');
    const fileStatus = $('#fileStatus');

    // Initialize file
    if (!state.files['untitled.js']) {
      state.files['untitled.js'] = editor.value;
    }

    editor.addEventListener('input', () => {
      state.files[state.currentFile] = editor.value;
      updateLineNumbers();
      markModified();
    });

    editor.addEventListener('scroll', () => {
      lineNums.style.transform = `translateY(-${editor.scrollTop}px)`;
    });

    editor.addEventListener('click', updateCursorPos);
    editor.addEventListener('keyup', updateCursorPos);

    // Handle Tab key
    editor.addEventListener('keydown', (e) => {
      if (e.key === 'Tab') {
        e.preventDefault();
        const start = editor.selectionStart;
        const end = editor.selectionEnd;
        const tabSize = parseInt(localStorage.getItem('kimi_tab_size') || '4');
        const spaces = ' '.repeat(tabSize);
        editor.value = editor.value.substring(0, start) + spaces + editor.value.substring(end);
        editor.selectionStart = editor.selectionEnd = start + tabSize;
        state.files[state.currentFile] = editor.value;
        updateLineNumbers();
        markModified();
      }
    });

    $('#saveFileBtn').addEventListener('click', saveCurrentFile);
    $('#newFileBtn').addEventListener('click', () => {
      $('#newFileModal').classList.remove('hidden');
      $('#newFileName').focus();
    });
    $('#runCodeBtn').addEventListener('click', runCode);
    $('#askAiBtn').addEventListener('click', askAiAboutCode);

    updateLineNumbers();
  }

  function updateLineNumbers() {
    const editor = $('#codeEditor');
    const lines = editor.value.split('\n').length;
    const lineNums = $('#lineNumbers');
    lineNums.innerHTML = Array.from({length: lines}, (_, i) => i + 1).join('<br>');
  }

  function updateCursorPos() {
    const editor = $('#codeEditor');
    const text = editor.value.substring(0, editor.selectionStart);
    const lines = text.split('\n');
    const line = lines.length;
    const col = lines[lines.length - 1].length + 1;
    $('#cursorPos').textContent = `Ln ${line}, Col ${col}`;
  }

  function markModified() {
    const fileStatus = $('#fileStatus');
    fileStatus.textContent = 'Modified';
    fileStatus.className = 'file-status modified';
  }

  function markSaved() {
    const fileStatus = $('#fileStatus');
    fileStatus.textContent = 'Saved';
    fileStatus.className = 'file-status saved';
    setTimeout(() => {
      fileStatus.textContent = '';
      fileStatus.className = 'file-status';
    }, 2000);
  }

  function saveCurrentFile() {
    const editor = $('#codeEditor');
    state.files[state.currentFile] = editor.value;
    localStorage.setItem('kimi_files', JSON.stringify(state.files));
    markSaved();
  }

  function loadFileInEditor(filename) {
    const editor = $('#codeEditor');
    state.currentFile = filename;
    editor.value = state.files[filename] || '';
    $('#currentFileName').textContent = filename;
    updateLineNumbers();
    updateFileType(filename);

    // Update active file in list
    $$('.file-item').forEach(f => f.classList.remove('active'));
    const fileItem = $(`.file-item[data-filename="${filename}"]`);
    if (fileItem) fileItem.classList.add('active');

    // Switch to editor tab
    $$('.tab').forEach(t => t.classList.remove('active'));
    $$('.panel').forEach(p => p.classList.remove('active'));
    $('[data-tab="editor"]').classList.add('active');
    $('#editorPanel').classList.add('active');
  }

  function updateFileType(filename) {
    const ext = filename.split('.').pop().toLowerCase();
    const types = {
      'js': 'JavaScript', 'ts': 'TypeScript', 'py': 'Python', 'java': 'Java',
      'html': 'HTML', 'css': 'CSS', 'json': 'JSON', 'md': 'Markdown',
      'txt': 'Text', 'sh': 'Shell', 'rs': 'Rust', 'go': 'Go', 'cpp': 'C++',
      'c': 'C', 'rb': 'Ruby', 'php': 'PHP', 'sql': 'SQL', 'xml': 'XML',
      'yaml': 'YAML', 'yml': 'YAML', 'toml': 'TOML', 'jsx': 'JSX', 'tsx': 'TSX',
    };
    $('#fileType').textContent = types[ext] || 'Plain Text';
  }

  function runCode() {
    const editor = $('#codeEditor');
    const filename = state.currentFile;
    const ext = filename.split('.').pop().toLowerCase();

    // Switch to terminal
    $$('.tab').forEach(t => t.classList.remove('active'));
    $$('.panel').forEach(p => p.classList.remove('active'));
    $('[data-tab="terminal"]').classList.add('active');
    $('#terminalPanel').classList.add('active');

    const output = $('#terminalOutput');

    if (['js', 'jsx', 'ts', 'tsx'].includes(ext)) {
      termPrint(`$ node ${filename}`, 'term-info');
      try {
        const logs = [];
        const mockConsole = {
          log: (...args) => logs.push(args.map(String).join(' ')),
          error: (...args) => logs.push('Error: ' + args.map(String).join(' ')),
          warn: (...args) => logs.push('Warning: ' + args.map(String).join(' ')),
        };
        const fn = new Function('console', editor.value);
        fn(mockConsole);
        logs.forEach(l => termPrint(l));
        termPrint('Process exited with code 0', 'term-info');
      } catch (e) {
        termPrint(e.message, 'term-error');
        termPrint('Process exited with code 1', 'term-error');
      }
    } else if (ext === 'py') {
      termPrint(`$ python3 ${filename}`, 'term-info');
      termPrint('Python execution requires a backend server.', 'term-warning');
      termPrint('Tip: Use "Ask AI" to get Python code validated.', 'term-info');
    } else {
      termPrint(`$ ./${filename}`, 'term-info');
      termPrint(`No runtime available for .${ext} files.`, 'term-warning');
      termPrint('Tip: Use "Ask AI" to analyze and validate code.', 'term-info');
    }
  }

  function askAiAboutCode() {
    const editor = $('#codeEditor');
    const code = editor.value.trim();
    if (!code) return;

    // Switch to AI panel
    $$('.tab').forEach(t => t.classList.remove('active'));
    $$('.panel').forEach(p => p.classList.remove('active'));
    $('[data-tab="ai"]').classList.add('active');
    $('#aiPanel').classList.add('active');

    const prompt = `Here's my code from "${state.currentFile}":\n\n\`\`\`\n${code}\n\`\`\`\n\nPlease review this code, suggest improvements, and explain any issues you find.`;
    sendAiMessage(prompt);
  }

  // ── AI Chat ──
  function setupAiChat() {
    const input = $('#aiInput');
    const sendBtn = $('#sendAiBtn');

    sendBtn.addEventListener('click', () => {
      const msg = input.value.trim();
      if (msg && !state.isAiTyping) {
        sendAiMessage(msg);
        input.value = '';
        input.style.height = 'auto';
      }
    });

    input.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        sendBtn.click();
      }
    });

    // Auto-resize textarea
    input.addEventListener('input', () => {
      input.style.height = 'auto';
      input.style.height = Math.min(input.scrollHeight, 120) + 'px';
    });

    // Suggestion chips
    $$('.suggestion-chip').forEach(chip => {
      chip.addEventListener('click', () => {
        sendAiMessage(chip.dataset.prompt);
      });
    });

    $('#clearChatBtn').addEventListener('click', () => {
      const msgs = $('#aiMessages');
      msgs.innerHTML = '';
      state.chatHistory = [];
      localStorage.removeItem('kimi_chat');
    });
  }

  async function sendAiMessage(message) {
    if (state.isAiTyping) return;
    if (!CONFIG.apiKey) {
      addChatMessage('system', '⚠️ Please set your API key in Settings to use Kimi K2.6 AI.');
      // Auto-open settings
      $('#settingsModal').classList.remove('hidden');
      return;
    }

    state.isAiTyping = true;
    $('#sendAiBtn').disabled = true;

    // Add user message
    addChatMessage('user', message);
    state.chatHistory.push({ role: 'user', content: message });

    // Show typing indicator
    const typingEl = addTypingIndicator();

    try {
      const systemPrompt = `You are Kimi K2.6, an advanced AI assistant integrated into the Kimi K2.6 UDE (Unified Developer Environment). You are an expert in:
- Software development (all languages and frameworks)
- Code review, debugging, and optimization
- Architecture design and best practices
- DevOps, Docker, and cloud services
- AI/ML and prompt engineering

When showing code, always use markdown code blocks with language tags.
Be concise, practical, and helpful. Provide working code examples when possible.`;

      const messages = [
        { role: 'system', content: systemPrompt },
        ...state.chatHistory.slice(-10) // Keep last 10 messages for context
      ];

      const response = await fetch(CONFIG.apiEndpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${CONFIG.apiKey}`,
        },
        body: JSON.stringify({
          model: CONFIG.model,
          messages: messages,
          max_tokens: CONFIG.maxTokens,
          temperature: CONFIG.temperature,
        }),
      });

      typingEl.remove();

      if (!response.ok) {
        const err = await response.text();
        throw new Error(`API Error ${response.status}: ${err}`);
      }

      const data = await response.json();
      const assistantMsg = data.choices?.[0]?.message?.content || 'No response from AI.';

      addChatMessage('assistant', formatMarkdown(assistantMsg));
      state.chatHistory.push({ role: 'assistant', content: assistantMsg });

      // Save chat
      localStorage.setItem('kimi_chat', JSON.stringify(state.chatHistory.slice(-20)));

    } catch (err) {
      typingEl?.remove();
      addChatMessage('system', `❌ Error: ${err.message}`);
    } finally {
      state.isAiTyping = false;
      $('#sendAiBtn').disabled = false;
    }
  }

  function addChatMessage(role, content) {
    const msgs = $('#aiMessages');
    // Remove welcome if present
    const welcome = msgs.querySelector('.ai-welcome');
    if (welcome) welcome.remove();

    const div = document.createElement('div');
    div.className = `chat-msg chat-msg-${role}`;

    const icons = {
      user: '<i class="fas fa-user"></i>',
      assistant: '<i class="fas fa-brain"></i>',
      system: '<i class="fas fa-exclamation-triangle"></i>',
    };

    div.innerHTML = `
      <div class="chat-avatar">${icons[role]}</div>
      <div class="chat-bubble">${content}</div>
    `;

    msgs.appendChild(div);
    msgs.scrollTop = msgs.scrollHeight;
  }

  function addTypingIndicator() {
    const msgs = $('#aiMessages');
    const div = document.createElement('div');
    div.className = 'chat-msg chat-msg-assistant';
    div.innerHTML = `
      <div class="chat-avatar"><i class="fas fa-brain"></i></div>
      <div class="chat-bubble">
        <div class="chat-typing">
          <span></span><span></span><span></span>
        </div>
      </div>
    `;
    msgs.appendChild(div);
    msgs.scrollTop = msgs.scrollHeight;
    return div;
  }

  function formatMarkdown(text) {
    // Code blocks
    text = text.replace(/```(\w*)\n([\s\S]*?)```/g, (_, lang, code) => {
      return `<pre><code class="language-${lang}">${escapeHtml(code.trim())}</code></pre>`;
    });
    // Inline code
    text = text.replace(/`([^`]+)`/g, '<code>$1</code>');
    // Bold
    text = text.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');
    // Italic
    text = text.replace(/\*(.+?)\*/g, '<em>$1</em>');
    // Line breaks
    text = text.replace(/\n/g, '<br>');
    return text;
  }

  function escapeHtml(str) {
    return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  }

  // ── Terminal ──
  function setupTerminal() {
    const input = $('#terminalInput');

    input.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        const cmd = input.value.trim();
        if (cmd) {
          state.terminalHistory.push(cmd);
          state.terminalHistoryIdx = state.terminalHistory.length;
          processCommand(cmd);
          input.value = '';
        }
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        if (state.terminalHistoryIdx > 0) {
          state.terminalHistoryIdx--;
          input.value = state.terminalHistory[state.terminalHistoryIdx];
        }
      } else if (e.key === 'ArrowDown') {
        e.preventDefault();
        if (state.terminalHistoryIdx < state.terminalHistory.length - 1) {
          state.terminalHistoryIdx++;
          input.value = state.terminalHistory[state.terminalHistoryIdx];
        } else {
          state.terminalHistoryIdx = state.terminalHistory.length;
          input.value = '';
        }
      }
    });

    $('#clearTermBtn').addEventListener('click', () => {
      $('#terminalOutput').innerHTML = '';
    });
  }

  function termPrint(text, cls = '') {
    const output = $('#terminalOutput');
    const line = document.createElement('div');
    line.className = 'term-line ' + cls;
    line.textContent = text;
    output.appendChild(line);
    const body = $('#terminalBody');
    body.scrollTop = body.scrollHeight;
  }

  function processCommand(cmd) {
    termPrint(`$ ${cmd}`, 'term-info');

    const parts = cmd.split(/\s+/);
    const command = parts[0].toLowerCase();
    const args = parts.slice(1);

    switch (command) {
      case 'help':
        termPrint('Available commands:');
        termPrint('  help       - Show this help');
        termPrint('  ls         - List files');
        termPrint('  cat <file> - Show file contents');
        termPrint('  touch <f>  - Create empty file');
        termPrint('  rm <file>  - Delete file');
        termPrint('  clear      - Clear terminal');
        termPrint('  echo <msg> - Print message');
        termPrint('  date       - Show date/time');
        termPrint('  ai <msg>   - Ask Kimi AI');
        termPrint('  run        - Run current file');
        termPrint('  version    - Show version');
        break;
      case 'ls':
        const filenames = Object.keys(state.files);
        if (filenames.length === 0) {
          termPrint('(empty)');
        } else {
          filenames.forEach(f => {
            const size = new Blob([state.files[f]]).size;
            termPrint(`  ${f}  (${formatSize(size)})`);
          });
        }
        break;
      case 'cat':
        if (args[0] && state.files[args[0]]) {
          state.files[args[0]].split('\n').forEach(l => termPrint(l));
        } else {
          termPrint(`File not found: ${args[0] || '(no filename)'}`, 'term-error');
        }
        break;
      case 'touch':
        if (args[0]) {
          state.files[args[0]] = '';
          saveFilesToStorage();
          refreshFilesList();
          termPrint(`Created: ${args[0]}`, 'term-info');
        } else {
          termPrint('Usage: touch <filename>', 'term-error');
        }
        break;
      case 'rm':
        if (args[0] && state.files[args[0]]) {
          delete state.files[args[0]];
          saveFilesToStorage();
          refreshFilesList();
          termPrint(`Deleted: ${args[0]}`, 'term-info');
        } else {
          termPrint(`File not found: ${args[0] || '(no filename)'}`, 'term-error');
        }
        break;
      case 'clear':
        $('#terminalOutput').innerHTML = '';
        break;
      case 'echo':
        termPrint(args.join(' '));
        break;
      case 'date':
        termPrint(new Date().toString());
        break;
      case 'ai':
        if (args.length > 0) {
          sendAiMessage(args.join(' '));
        } else {
          termPrint('Usage: ai <your question>', 'term-error');
        }
        break;
      case 'run':
        runCode();
        break;
      case 'version':
        termPrint('Kimi K2.6 UDE v1.0.0', 'term-info');
        termPrint('AI Model: ' + CONFIG.model);
        termPrint('Powered by NVIDIA NIM');
        break;
      default:
        termPrint(`Command not found: ${command}`, 'term-error');
        termPrint('Type "help" for available commands', 'term-warning');
    }
  }

  // ── Files ──
  function setupFiles() {
    refreshFilesList();

    $('#addFileBtn').addEventListener('click', () => {
      $('#newFileModal').classList.remove('hidden');
      $('#newFileName').focus();
    });

    $('#importFileBtn').addEventListener('click', () => {
      const input = document.createElement('input');
      input.type = 'file';
      input.accept = '.js,.ts,.py,.html,.css,.json,.md,.txt,.sh,.rs,.go,.java,.cpp,.c,.rb,.php,.sql,.xml,.yaml,.yml';
      input.onchange = (e) => {
        const file = e.target.files[0];
        if (file) {
          const reader = new FileReader();
          reader.onload = () => {
            state.files[file.name] = reader.result;
            saveFilesToStorage();
            refreshFilesList();
            loadFileInEditor(file.name);
          };
          reader.readAsText(file);
        }
      };
      input.click();
    });
  }

  function refreshFilesList() {
    const list = $('#filesList');
    list.innerHTML = '';
    let totalSize = 0;

    Object.entries(state.files).forEach(([name, content]) => {
      const size = new Blob([content]).size;
      totalSize += size;

      const ext = name.split('.').pop().toLowerCase();
      const iconMap = {
        'js': 'fa-file-code', 'ts': 'fa-file-code', 'py': 'fa-file-code',
        'html': 'fa-file-code', 'css': 'fa-file-code', 'json': 'fa-file-code',
        'md': 'fa-file-alt', 'txt': 'fa-file-alt', 'sh': 'fa-file-code',
        'rs': 'fa-file-code', 'go': 'fa-file-code', 'java': 'fa-file-code',
      };

      const div = document.createElement('div');
      div.className = `file-item${name === state.currentFile ? ' active' : ''}`;
      div.dataset.filename = name;
      div.innerHTML = `
        <i class="fas ${iconMap[ext] || 'fa-file'} file-icon"></i>
        <span class="file-name">${name}</span>
        <span class="file-size">${formatSize(size)}</span>
        <button class="file-delete" title="Delete"><i class="fas fa-times"></i></button>
      `;

      div.addEventListener('click', (e) => {
        if (!e.target.closest('.file-delete')) {
          loadFileInEditor(name);
        }
      });

      div.querySelector('.file-delete').addEventListener('click', (e) => {
        e.stopPropagation();
        if (confirm(`Delete ${name}?`)) {
          delete state.files[name];
          saveFilesToStorage();
          refreshFilesList();
          if (state.currentFile === name) {
            const remaining = Object.keys(state.files);
            if (remaining.length > 0) {
              loadFileInEditor(remaining[0]);
            }
          }
        }
      });

      list.appendChild(div);
    });

    $('#filesCount').textContent = `${Object.keys(state.files).length} file${Object.keys(state.files).length !== 1 ? 's' : ''}`;
    $('#filesTotalSize').textContent = `${formatSize(totalSize)} total`;
  }

  // ── Modals ──
  function setupModals() {
    // Settings
    $('#settingsBtn').addEventListener('click', () => {
      $('#apiEndpoint').value = CONFIG.apiEndpoint;
      $('#apiKey').value = CONFIG.apiKey;
      $('#modelSelect').value = CONFIG.model;
      $('#settingsModal').classList.remove('hidden');
    });

    $('#closeSettingsBtn').addEventListener('click', () => {
      $('#settingsModal').classList.add('hidden');
    });

    $('#saveSettingsBtn').addEventListener('click', () => {
      CONFIG.apiEndpoint = $('#apiEndpoint').value;
      CONFIG.apiKey = $('#apiKey').value;
      CONFIG.model = $('#modelSelect').value;
      localStorage.setItem('kimi_settings', JSON.stringify({
        apiEndpoint: CONFIG.apiEndpoint,
        apiKey: CONFIG.apiKey,
        model: CONFIG.model,
      }));
      $('#settingsModal').classList.add('hidden');
    });

    // Font size slider
    $('#fontSize').addEventListener('input', (e) => {
      const size = e.target.value;
      $('#fontSizeLabel').textContent = size + 'px';
      $('#codeEditor').style.fontSize = size + 'px';
      localStorage.setItem('kimi_font_size', size);
    });

    // Tab size
    $('#tabSize').addEventListener('change', (e) => {
      localStorage.setItem('kimi_tab_size', e.target.value);
    });

    // Theme
    $('#themeSelect').addEventListener('change', (e) => {
      document.body.className = e.target.value === 'light' ? 'light' : '';
      localStorage.setItem('kimi_theme', e.target.value);
    });

    // New File
    $('#closeNewFileBtn').addEventListener('click', () => {
      $('#newFileModal').classList.add('hidden');
    });

    $('#createFileBtn').addEventListener('click', createNewFile);
    $('#newFileName').addEventListener('keydown', (e) => {
      if (e.key === 'Enter') createNewFile();
    });

    // Close modals on overlay click
    $$('.modal-overlay').forEach(overlay => {
      overlay.addEventListener('click', (e) => {
        if (e.target === overlay) overlay.classList.add('hidden');
      });
    });
  }

  function createNewFile() {
    const name = $('#newFileName').value.trim();
    if (!name) return;
    if (state.files[name]) {
      alert('File already exists!');
      return;
    }
    state.files[name] = '';
    saveFilesToStorage();
    refreshFilesList();
    loadFileInEditor(name);
    $('#newFileModal').classList.add('hidden');
    $('#newFileName').value = '';
  }

  // ── Keyboard Shortcuts ──
  function setupKeyboardShortcuts() {
    document.addEventListener('keydown', (e) => {
      // Ctrl+S = Save
      if ((e.ctrlKey || e.metaKey) && e.key === 's') {
        e.preventDefault();
        saveCurrentFile();
      }
      // Ctrl+Enter = Ask AI
      if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
        e.preventDefault();
        askAiAboutCode();
      }
      // Ctrl+` = Toggle terminal
      if ((e.ctrlKey || e.metaKey) && e.key === '`') {
        e.preventDefault();
        const termTab = $('[data-tab="terminal"]');
        termTab.click();
      }
      // Escape = Close modals
      if (e.key === 'Escape') {
        $$('.modal-overlay').forEach(m => m.classList.add('hidden'));
      }
    });
  }

  // ── Persistence ──
  function loadSettings() {
    try {
      const saved = JSON.parse(localStorage.getItem('kimi_settings') || '{}');
      if (saved.apiEndpoint) CONFIG.apiEndpoint = saved.apiEndpoint;
      if (saved.apiKey) CONFIG.apiKey = saved.apiKey;
      if (saved.model) CONFIG.model = saved.model;

      const fontSize = localStorage.getItem('kimi_font_size');
      if (fontSize) {
        document.addEventListener('DOMContentLoaded', () => {
          $('#codeEditor').style.fontSize = fontSize + 'px';
          $('#fontSize').value = fontSize;
          $('#fontSizeLabel').textContent = fontSize + 'px';
        });
      }

      const theme = localStorage.getItem('kimi_theme');
      if (theme === 'light') document.body.className = 'light';

      // Load chat history
      const chat = JSON.parse(localStorage.getItem('kimi_chat') || '[]');
      state.chatHistory = chat;
    } catch (e) {
      console.warn('Failed to load settings:', e);
    }
  }

  function loadFiles() {
    try {
      const saved = JSON.parse(localStorage.getItem('kimi_files') || '{}');
      if (Object.keys(saved).length > 0) {
        state.files = saved;
        document.addEventListener('DOMContentLoaded', () => {
          const editor = $('#codeEditor');
          if (state.files['untitled.js'] !== undefined) {
            editor.value = state.files['untitled.js'];
          }
        });
      }
    } catch (e) {
      console.warn('Failed to load files:', e);
    }
  }

  function saveFilesToStorage() {
    localStorage.setItem('kimi_files', JSON.stringify(state.files));
  }

  // ── Utilities ──
  function formatSize(bytes) {
    if (bytes === 0) return '0 B';
    const units = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(1024));
    return (bytes / Math.pow(1024, i)).toFixed(i > 0 ? 1 : 0) + ' ' + units[i];
  }

})();
