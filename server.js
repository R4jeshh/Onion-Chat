const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const rateLimit = require('express-rate-limit');
const helmet = require('helmet');
const cors = require('cors');

// Initialize Express app
const app = express();
const server = http.createServer(app);
const io = socketIo(server);

// Middleware
app.use(helmet({
    contentSecurityPolicy: false
}));
app.use(cors());
app.use(express.json());

// Rate limiting
const limiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 100 // limit each IP to 100 requests per windowMs
});
app.use(limiter);

// Store users and messages
const users = new Map();
const messages = [];
const MAX_MESSAGES = 1000;

// Utility functions
function formatDate() {
    const date = new Date();
    return date.toISOString().slice(0, 19).replace('T', ' ');
}

function sanitizeMessage(message) {
    return message
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#039;');
}

function getRandomColor() {
    const colors = [
        '#FF6B6B', '#4ECDC4', '#45B7D1', '#96CEB4',
        '#FFEEAD', '#D4A5A5', '#9B59B6', '#3498DB'
    ];
    return colors[Math.floor(Math.random() * colors.length)];
}

// Main route
app.get('/', (req, res) => {
    const html = `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Dark Web</title>
    <link href="https://fonts.googleapis.com/css2?family=Poppins:wght@300;400;500;600&display=swap" rel="stylesheet">
    <link href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.0.0/css/all.min.css" rel="stylesheet">
    <style>
        :root {
            --primary-color: #7289da;
            --secondary-color: #43b581;
            --accent-color: #ff4b4b;
            --bg-dark: #1a1a1a;
            --bg-medium: #2a2a2a;
            --bg-light: #333333;
            --text-primary: #ffffff;
            --text-secondary: #b9bbbe;
            --shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
        }

        * {
            margin: 0;
            padding: 0;
            box-sizing: border-box;
            font-family: 'Poppins', sans-serif;
        }

        body {
            background: var(--bg-dark);
            color: var(--text-primary);
            line-height: 1.6;
            min-height: 100vh;
        }

        .container {
            max-width: 1200px;
            margin: 0 auto;
            padding: 20px;
            height: 100vh;
            display: flex;
            flex-direction: column;
        }

        /* Login Container */
        .login-container {
            max-width: 400px;
            margin: 50px auto;
            padding: 30px;
            background: var(--bg-medium);
            border-radius: 15px;
            box-shadow: var(--shadow);
            text-align: center;
            animation: slideUp 0.5s ease;
        }

        .login-container h1 {
            font-size: 2.5em;
            margin-bottom: 20px;
            color: var(--primary-color);
        }

        /* Chat Container */
        .chat-container {
            display: none;
            flex: 1;
            background: var(--bg-medium);
            border-radius: 15px;
            box-shadow: var(--shadow);
            overflow: hidden;
        }

        .chat-layout {
            display: grid;
            grid-template-columns: 250px 1fr;
            height: 100%;
        }

        /* Sidebar */
        .sidebar {
            background: var(--bg-light);
            padding: 20px;
            border-right: 1px solid rgba(255, 255, 255, 0.1);
            display: flex;
            flex-direction: column;
        }

        .user-profile {
            display: flex;
            align-items: center;
            padding: 15px;
            background: var(--bg-medium);
            border-radius: 10px;
            margin-bottom: 20px;
            position: relative;
        }

        .user-avatar {
            width: 40px;
            height: 40px;
            border-radius: 50%;
            display: flex;
            align-items: center;
            justify-content: center;
            font-size: 1.2em;
            font-weight: bold;
            margin-right: 10px;
        }

        .user-info {
            flex: 1;
        }

        .dropdown {
            position: relative;
            display: inline-block;
        }

        .dropdown-content {
            display: none;
            position: absolute;
            right: 0;
            top: 100%;
            background: var(--bg-medium);
            min-width: 160px;
            border-radius: 8px;
            box-shadow: var(--shadow);
            z-index: 1;
        }

        .dropdown-content.show {
            display: block;
            animation: fadeIn 0.3s ease;
        }

        .dropdown-content a {
            color: var(--text-primary);
            padding: 12px 16px;
            text-decoration: none;
            display: block;
            transition: background 0.3s;
        }

        .dropdown-content a:hover {
            background: var(--bg-light);
        }

        .user-list {
            flex: 1;
            overflow-y: auto;
        }

        .user-item {
            display: flex;
            align-items: center;
            padding: 10px;
            margin: 5px 0;
            border-radius: 8px;
            transition: background 0.3s;
        }

        .user-item:hover {
            background: var(--bg-medium);
        }

        /* Chat Area */
        .chat-area {
            display: flex;
            flex-direction: column;
            height: 100%;
        }

        .messages {
            flex: 1;
            padding: 20px;
            overflow-y: auto;
            display: flex;
            flex-direction: column;
        }

        .message {
            display: flex;
            margin: 10px 0;
            animation: slideIn 0.3s ease;
        }

        .message.own {
            flex-direction: row-reverse;
        }

        .message-content {
            max-width: 70%;
            padding: 12px;
            border-radius: 15px;
            background: var(--bg-light);
            margin: 0 10px;
            position: relative;
        }

        .message.own .message-content {
            background: var(--primary-color);
        }

        .message-header {
            display: flex;
            align-items: center;
            margin-bottom: 5px;
            font-size: 0.9em;
        }

        .message-username {
            font-weight: 600;
            color: var(--secondary-color);
            margin-right: 8px;
        }

        .message-time {
            color: var(--text-secondary);
            font-size: 0.8em;
        }

        .input-area {
            padding: 20px;
            background: var(--bg-light);
            display: flex;
            gap: 10px;
            align-items: center;
        }

        input[type="text"] {
            flex: 1;
            padding: 12px;
            border-radius: 25px;
            border: none;
            background: var(--bg-medium);
            color: var(--text-primary);
            font-size: 1em;
            transition: all 0.3s;
        }

        input[type="text"]:focus {
            outline: none;
            box-shadow: 0 0 0 2px var(--primary-color);
        }

        button {
            padding: 12px 24px;
            border: none;
            border-radius: 25px;
            background: var(--primary-color);
            color: white;
            cursor: pointer;
            transition: all 0.3s;
            display: flex;
            align-items: center;
            gap: 5px;
        }

        button:hover {
            background: var(--secondary-color);
            transform: translateY(-1px);
        }

        .typing-indicator {
            padding: 5px 20px;
            color: var(--text-secondary);
            font-style: italic;
            min-height: 30px;
        }

        /* Emoji Picker */
        .emoji-picker {
            position: absolute;
            bottom: 100%;
            right: 0;
            background: var(--bg-medium);
            border-radius: 8px;
            padding: 10px;
            display: none;
            grid-template-columns: repeat(8, 1fr);
            gap: 5px;
            box-shadow: var(--shadow);
        }

        .emoji-picker.active {
            display: grid;
        }

        .emoji {
            cursor: pointer;
            padding: 5px;
            text-align: center;
            border-radius: 4px;
            transition: background 0.2s;
        }

        .emoji:hover {
            background: var(--bg-light);
        }

        /* Animations */
        @keyframes slideUp {
            from { transform: translateY(20px); opacity: 0; }
            to { transform: translateY(0); opacity: 1; }
        }

        @keyframes slideIn {
            from { transform: translateX(20px); opacity: 0; }
            to { transform: translateX(0); opacity: 1; }
        }

        @keyframes fadeIn {
            from { opacity: 0; }
            to { opacity: 1; }
        }

        /* Responsive Design */
        @media (max-width: 768px) {
            .container {
                padding: 10px;
            }

            .chat-layout {
                grid-template-columns: 1fr;
            }

            .sidebar {
                position: fixed;
                left: -100%;
                top: 0;
                bottom: 0;
                width: 80%;
                max-width: 250px;
                z-index: 1000;
                transition: left 0.3s ease;
            }

            .sidebar.active {
                left: 0;
            }

            .toggle-sidebar {
                display: block;
                position: fixed;
                top: 10px;
                left: 10px;
                z-index: 1001;
                padding: 10px;
                background: var(--primary-color);
                border-radius: 50%;
            }

            .message-content {
                max-width: 85%;
            }

            .input-area {
                padding: 15px;
            }
        }

        @media (max-width: 480px) {
            .login-container {
                margin: 20px;
                padding: 20px;
            }

            .input-area button {
                padding: 12px;
            }

            .emoji-picker {
                left: 0;
                right: 0;
                width: auto;
            }
        }
    </style>
</head>
<body>
    <div class="container">
        <!-- Login Container -->
        <div class="login-container" id="loginContainer">
            <h1>💬 Onion Chat</h1>
            <div id="loginError" class="error"></div>
            <input type="text" id="username" placeholder="Choose your username" maxlength="20">
            <button onclick="login()">
                <i class="fas fa-sign-in-alt"></i>
                Join Chat
            </button>
        </div>

        <!-- Chat Container -->
        <div class="chat-container" id="chatContainer">
            <button class="toggle-sidebar" id="toggleSidebar">
                <i class="fas fa-bars"></i>
            </button>
            
            <div class="chat-layout">
                <div class="sidebar" id="sidebar">
                    <div class="user-profile">
                        <div class="user-avatar" id="currentUserAvatar"></div>
                        <div class="user-info">
                            <span id="currentUserName"></span>
                            <div class="dropdown">
                                <button onclick="toggleDropdown()">
                                    <i class="fas fa-ellipsis-v"></i>
                                </button>
                                <div id="userDropdown" class="dropdown-content">
                                    <a href="#" onclick="toggleEmojis()">
                                        <i class="fas fa-smile"></i> Toggle Emojis
                                    </a>
                                    <a href="#" onclick="clearChat()">
                                        <i class="fas fa-trash"></i> Clear Chat
                                    </a>
                                    <a href="#" onclick="logout()">
                                        <i class="fas fa-sign-out-alt"></i> Logout
                                    </a>
                                </div>
                            </div>
                        </div>
                    </div>
                    
                    <div class="online-users">
                        <h3>Online Users (<span id="userCount">0</span>)</h3>
                        <div class="user-list" id="userList"></div>
                    </div>
                </div>

                <div class="chat-area">
                    <div class="messages" id="messages"></div>
                    <div class="typing-indicator" id="typingIndicator"></div>
                    <div class="emoji-picker" id="emojiPicker"></div>
                    <div class="input-area">
                        <input type="text" 
                               id="messageInput" 
                               placeholder="Type your message..."
                               autocomplete="off">
                        <button onclick="sendMessage()">
                            <i class="fas fa-paper-plane"></i>
                            Send
                        </button>
                    </div>
                </div>
            </div>
        </div>
    </div>

    <script src="/socket.io/socket.io.js"></script>
    <script>
        const socket = io();
        let currentUser = null;
        let typingTimeout = null;

        // Emoji setup
        const emojis = ['😊', '😂', '❤️', '👍', '😍', '🎉', '🔥', '✨', 
                       '😎', '🤩', '🥳', '👋', '🤔', '🙌', '👏', '🌟'];
        
        const emojiPicker = document.getElementById('emojiPicker');
        emojis.forEach(emoji => {
            const span = document.createElement('span');
            span.className = 'emoji';
            span.textContent = emoji;
            span.onclick = () => {
                const messageInput = document.getElementById('messageInput');
                messageInput.value += emoji;
                messageInput.focus();
            };
            emojiPicker.appendChild(span);
        });

        function toggleEmojis() {
            emojiPicker.classList.toggle('active');
            toggleDropdown();
        }

        // UI Functions
        function toggleDropdown() {
            document.getElementById('userDropdown').classList.toggle('show');
        }

        function toggleSidebar() {
            document.getElementById('sidebar').classList.toggle('active');
        }

        function createAvatar(username) {
            const color = getRandomColor();
            return \`
                <div class="user-avatar" style="background: \${color}">
                    \${username.charAt(0).toUpperCase()}
                </div>
            \`;
        }

        // Main Functions
        async function login() {
            const username = document.getElementById('username').value.trim();
            const loginError = document.getElementById('loginError');

            if (!username) {
                loginError.textContent = 'Please enter a username';
                return;
            }

            try {
                const response = await fetch('/login', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ username })
                });

                const data = await response.json();
                if (data.error) {
                    loginError.textContent = data.error;
                    return;
                }

                currentUser = username;
                document.getElementById('loginContainer').style.display = 'none';
                document.getElementById('chatContainer').style.display = 'flex';
                document.getElementById('currentUserName').textContent = username;
                document.getElementById('currentUserAvatar').innerHTML = createAvatar(username);
                
                socket.emit('user_connected', { username });
            } catch (err) {
                loginError.textContent = 'Connection error. Please try again.';
            }
        }

        async function sendMessage() {
            const messageInput = document.getElementById('messageInput');
            const message = messageInput.value.trim();

            if (!message || !currentUser) return;

            try {
                const response = await fetch('/message', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ username: currentUser, message })
                });

                if (response.ok) {
                    messageInput.value = '';
                    messageInput.focus();
                }
            } catch (err) {
                console.error('Error sending message:', err);
            }
        }

        function clearChat() {
            document.getElementById('messages').innerHTML = '';
            toggleDropdown();
        }

        function logout() {
            socket.emit('user_disconnected', currentUser);
            currentUser = null;
            document.getElementById('loginContainer').style.display = 'block';
            document.getElementById('chatContainer').style.display = 'none';
            document.getElementById('messages').innerHTML = '';
            document.getElementById('username').value = '';
            toggleDropdown();
        }

        // Socket Events
        socket.on('message', (data) => {
            const messagesDiv = document.getElementById('messages');
            const messageDiv = document.createElement('div');
            messageDiv.className = \`message \${data.username === currentUser ? 'own' : ''}\`;
            
            messageDiv.innerHTML = \`
                \${createAvatar(data.username)}
                <div class="message-content">
                    <div class="message-header">
                        <span class="message-username">\${data.username}</span>
                        <span class="message-time">\${data.timestamp}</span>
                    </div>
                    <div class="message-text">\${data.message}</div>
                </div>
            \`;
            
            messagesDiv.appendChild(messageDiv);
            messagesDiv.scrollTop = messagesDiv.scrollHeight;
        });

        socket.on('users_update', (users) => {
            const userListDiv = document.getElementById('userList');
            userListDiv.innerHTML = '';
            const onlineUsers = users.filter(u => u.online);
            
            onlineUsers.forEach(user => {
                const userDiv = document.createElement('div');
                userDiv.className = 'user-item';
                userDiv.innerHTML = \`
                    \${createAvatar(user.username)}
                    <span>\${user.username}</span>
                \`;
                userListDiv.appendChild(userDiv);
            });
            
            document.getElementById('userCount').textContent = onlineUsers.length;
        });

        socket.on('user_typing', (username) => {
            if (username !== currentUser) {
                document.getElementById('typingIndicator').textContent = \`\${username} is typing...\`;
            }
        });

        socket.on('user_stop_typing', () => {
            document.getElementById('typingIndicator').textContent = '';
        });

        // Event Listeners
        document.getElementById('messageInput').addEventListener('keypress', (e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                sendMessage();
            }
        });

        document.getElementById('messageInput').addEventListener('input', () => {
            socket.emit('typing');
            clearTimeout(typingTimeout);
            typingTimeout = setTimeout(() => {
                socket.emit('stop_typing');
            }, 1000);
        });

        document.getElementById('toggleSidebar').addEventListener('click', toggleSidebar);

        // Close dropdown when clicking outside
        window.addEventListener('click', (e) => {
            if (!e.target.matches('.dropdown button')) {
                const dropdown = document.getElementById('userDropdown');
                if (dropdown.classList.contains('show')) {
                    dropdown.classList.remove('show');
                }
            }
        });
    </script>
</body>
</html>`;
    res.send(html);
});

// API endpoints
app.post('/login', (req, res) => {
    try {
        const { username } = req.body;
        
        if (!username || username.trim().length === 0) {
            return res.json({ error: 'Please enter a username' });
        }
        
        if (users.has(username)) {
            return res.json({ error: 'Username already taken' });
        }

        const userData = {
            username,
            joinedAt: formatDate(),
            online: true
        };

        users.set(username, userData);
        res.json({ success: true, ...userData });
    } catch (error) {
        res.json({ error: 'Login failed. Please try again.' });
    }
});

app.post('/message', (req, res) => {
    try {
        const { username, message } = req.body;
        
        const messageData = {
            id: Date.now(),
            username,
            message: sanitizeMessage(message.trim()),
            timestamp: formatDate()
        };

        messages.push(messageData);
        if (messages.length > MAX_MESSAGES) {
            messages.shift();
        }
        
        io.emit('message', messageData);
        res.json({ success: true });
    } catch (error) {
        res.json({ error: 'Failed to send message' });
    }
});

// Socket.IO events
io.on('connection', (socket) => {
    let currentUser = null;

    socket.on('user_connected', (userData) => {
        currentUser = userData.username;
        if (users.has(currentUser)) {
            users.get(currentUser).online = true;
            users.get(currentUser).socketId = socket.id;
        }
        io.emit('users_update', Array.from(users.values()));
    });

    socket.on('typing', () => {
        if (currentUser) {
            socket.broadcast.emit('user_typing', currentUser);
        }
    });

    socket.on('stop_typing', () => {
        if (currentUser) {
            socket.broadcast.emit('user_stop_typing', currentUser);
        }
    });

    socket.on('user_disconnected', (username) => {
        if (username && users.has(username)) {
            users.get(username).online = false;
            io.emit('users_update', Array.from(users.values()));
        }
    });

    socket.on('disconnect', () => {
        if (currentUser && users.has(currentUser)) {
            users.get(currentUser).online = false;
            io.emit('users_update', Array.from(users.values()));
        }
    });
});

// Start server
const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
    console.log(`Clean Chat App running on port ${PORT}`);
});
