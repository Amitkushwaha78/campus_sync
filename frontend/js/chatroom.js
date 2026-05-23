// Theme Toggle
        function toggleTheme() {
            const body = document.body;
            const currentTheme = body.getAttribute('data-theme');
            const isDark = currentTheme === 'dark';
            body.setAttribute('data-theme', isDark ? 'light' : 'dark');
            localStorage.setItem('chat-theme', isDark ? 'light' : 'dark');
            
            const toggleBtn = document.querySelector('.theme-toggle i');
            toggleBtn.className = isDark ? 'fas fa-sun' : 'fas fa-moon';
        }

        // Username prompt
        let UserName = '';

        function addUserToMembersList(name, isCurrentUser = false) {
            const membersList = document.querySelector('.members-list');
            const memberDiv = document.createElement('div');
            memberDiv.className = 'member';
            memberDiv.setAttribute('data-username', name);
        
            // Generate initials for avatar
            const initials = name.split(' ').map(word => word.charAt(0).toUpperCase()).join('').slice(0, 2);
            
            memberDiv.innerHTML = `
                <div class="member-avatar">
                    ${initials}
                    <div class="online-indicator"></div>
                </div>
                ${name}
                ${isCurrentUser ? '<div style="margin-left: auto; font-size: 0.7rem; color: var(--success-color);">YOU</div>' : ''}
            `;
        
            // Add to top of members list
            membersList.insertBefore(memberDiv, membersList.firstChild);
            
            // Update online count
            const header = document.querySelector('.members-header');
            const currentCount = parseInt(header.textContent.match(/\d+/)[0]) || 0;
            header.textContent = `Online — ${currentCount + 1}`;
        }

        function removeUserFromMembersList(name) {
            const membersList = document.querySelector('.members-list');
            const memberDiv = membersList.querySelector(`[data-username="${name}"]`);
            
            if (memberDiv) {
                memberDiv.style.opacity = '0';
                memberDiv.style.transition = 'opacity 0.3s ease';
                setTimeout(() => {
                    memberDiv.remove();
                    // Update online count
                    const header = document.querySelector('.members-header');
                    const currentCount = parseInt(header.textContent.match(/\d+/)[0]) || 1;
                    if (currentCount > 1) {
                        header.textContent = `Online — ${currentCount - 1}`;
                    }
                }, 300);
            }
        }

        function showUsernamePrompt() {
            const overlay = document.createElement('div');
            overlay.id = 'username-overlay';
            overlay.innerHTML = `
                <div class="username-modal">
                    <div class="username-content">
                        <h2>Welcome to Club Chat!</h2>
                        <p>Please enter your name to join the conversation</p>
                        <input type="text" id="usernameInput" placeholder="Enter your name..." maxlength="20">
                        <button id="joinButton" class="join-btn">Join Chat</button>
                    </div>
                </div>
            `;
            document.body.appendChild(overlay);

            const input = document.getElementById('usernameInput');
            const joinBtn = document.getElementById('joinButton');

            input.focus();
        
            input.addEventListener('keypress', function(e) {
                if (e.key === 'Enter') {
                    joinChat();
                }
            });

            joinBtn.addEventListener('click', joinChat);

            function joinChat() {
                const name = input.value.trim();
                if (name) {
                    UserName = name;
                    
                    // Emit newuser event to server
                    socket.emit('newuser', name);
                    
                    // Add user to members list
                    addUserToMembersList(name, true);
                    
                    overlay.remove();
                    initChat();
                    loadSampleMessages();
                } else {
                    input.focus();
                    input.style.borderColor = 'var(--danger-color)';
                    setTimeout(() => {
                        input.style.borderColor = 'var(--border-color)';
                    }, 1000);
                }
            }
        }

        // Load theme
        document.addEventListener('DOMContentLoaded', function() {
            const savedTheme = localStorage.getItem('chat-theme') || 'dark';
            document.body.setAttribute('data-theme', savedTheme);
            const toggleBtn = document.querySelector('.theme-toggle i');
            toggleBtn.className = savedTheme === 'dark' ? 'fas fa-sun' : 'fas fa-moon';
            
            showUsernamePrompt();
        });

        // Chat functionality
        let currentChannel = 'general';
        let messages = [];

        // Initialize Socket.IO
        const socket = io();
        let socketConnected = false;

        socket.on('connect', () => {
            console.log('Connected to server with socket id:', socket.id);
            socketConnected = true;
        });

        socket.on('disconnect', () => {
            console.log('Disconnected from server');
            socketConnected = false;
        });

        function initChat() {
            // Auto-resize textarea
            const textarea = document.getElementById('messageInput');
            textarea.addEventListener('input', function() {
                this.style.height = 'auto';
                this.style.height = Math.min(this.scrollHeight, 120) + 'px';
            });

            // Send message
            const sendBtn = document.getElementById('sendButton');
            sendBtn.addEventListener('click', () => {
                sendMessage();
            });
            
            document.getElementById('messageInput').addEventListener('keypress', function(e) {
                if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    sendMessage();
                }
            });

            // Channel switching
            document.querySelectorAll('.channel').forEach(channel => {
                channel.addEventListener('click', () => switchChannel(channel.dataset.channel));
            });

            // Server switching
            document.querySelectorAll('.server').forEach(server => {
                server.addEventListener('click', () => {
                    document.querySelector('.server.active')?.classList.remove('active');
                    server.classList.add('active');
                });
            });
        }

        function sendMessage() {
            const input = document.getElementById('messageInput');
            const text = input.value.trim();
            
            if (!text) return;

            const message = {
                id: Date.now(),
                author: UserName || 'You',
                avatar: (UserName || 'You').charAt(0).toUpperCase(),
                content: text,
                timestamp: new Date(),
                type: 'user'
            };

            messages.push(message);
            
            // Render message locally
            renderMessages('my', message);
            
            // Emit message to socket
            if (socketConnected) {
                socket.emit('chat', {
                    username: UserName,
                    text: text
                });
            }
            
            input.value = '';
            input.style.height = 'auto';
            document.getElementById('sendButton').disabled = true;
            setTimeout(() => {
                document.getElementById('sendButton').disabled = false;
            }, 500);
        }

        function renderMessages(type, message) {
            const messageContainer = document.querySelector('.Display-Message');
            if (!messageContainer) return;

            // Format timestamp
            const time = new Date(message.timestamp);
            const hours = String(time.getHours()).padStart(2, '0');
            const minutes = String(time.getMinutes()).padStart(2, '0');
            const timeString = `${hours}:${minutes}`;

            if (type == 'my') {
                const el = document.createElement('div');
                el.setAttribute('class', 'whatsapp-message-user');
                el.innerHTML = `
                    <div class="whatsapp-user-name">${message.author}</div>
                    <div class="whatsapp-bubble-user">
                        ${message.content}
                    </div>
                    <div class="whatsapp-message-footer">
                        <span class="whatsapp-timestamp">${timeString}</span>
                        <i class="fas fa-check-double whatsapp-status-icon"></i>
                    </div>
                `;
                messageContainer.appendChild(el);
            }
            else if (type == 'other') {
                const el = document.createElement('div');
                el.setAttribute('class', 'whatsapp-message');
                el.innerHTML = `
                    <div class="whatsapp-sender-name">${message.username}</div>
                    <div class="whatsapp-bubble">
                        ${message.content}
                    </div>
                    <div class="whatsapp-message-footer">
                        <span class="whatsapp-timestamp">${timeString}</span>
                        <i class="fas fa-check-double whatsapp-status-icon"></i>
                    </div>
                `;
                messageContainer.appendChild(el);
            }
            else if (type == 'update') {
                const el = document.createElement('div');
                el.setAttribute('class', 'message-notice');
                el.innerHTML = `<i class="fas fa-info-circle"></i> ${message}`;
                messageContainer.appendChild(el);
            }

            messageContainer.scrollTop = messageContainer.scrollHeight - messageContainer.clientHeight;
        }


        // Socket event handlers
        socket.on('userJoined', (data) => {
            console.log(`${data.username} joined the chat`);
            addUserToMembersList(data.username, false);
            renderMessages('update', `${data.username} joined the chat`);
        });

        socket.on('userLeft', (data) => {
            console.log(`${data.username} left the chat`);
            removeUserFromMembersList(data.username);
            renderMessages('update', `${data.username} left the chat`);
        });

        socket.on('onlineUsers', (users) => {
            console.log('Online users:', users);
            users.forEach(user => {
                if (user !== UserName) {
                    // Check if user already in list
                    if (!document.querySelector(`[data-username="${user}"]`)) {
                        addUserToMembersList(user, false);
                    }
                }
            });
        });

        socket.on('chat', (data) => {
            console.log(`Message from ${data.username}: ${data.text}`);
            
            // Only render if message is from another user
            // Don't render own messages since they're already rendered in sendMessage()
            if (data.username !== UserName) {
                renderMessages('other', {
                    username: data.username,
                    avatar: data.username.charAt(0).toUpperCase(),
                    content: data.text,
                    timestamp: new Date()
                });
            }
        });