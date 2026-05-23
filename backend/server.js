import express from 'express';
import { createServer } from 'node:http';
import { Server } from 'socket.io';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import cors from 'cors';
import dotenv from 'dotenv';
import OpenAI from 'openai';

// ===============================
// ENV CONFIG
// ===============================

dotenv.config();

// ===============================
// EXPRESS APP
// ===============================

const app = express();

const server = createServer(app);

// ===============================
// MIDDLEWARE
// ===============================

app.use(cors());

app.use(express.json());

app.use(express.urlencoded({
    extended: true
}));

// ===============================
// PATHS
// ===============================

const __dirname = dirname(
    fileURLToPath(import.meta.url)
);

app.use(
    express.static(
        join(__dirname, '../frontend')
    )
);

// ===============================
// SOCKET ROOM
// ===============================

const ROOM = 'group';

// ===============================
// GROQ CLIENT
// ===============================

const client = new OpenAI({

    apiKey: process.env.GROQ_API_KEY,

    baseURL: 'https://api.groq.com/openai/v1'

});

// ===============================
// STORAGE
// ===============================

let notices = [];

const onlineUsers = new Set();

// ===============================
// PAGE ROUTES
// ===============================

// HOME PAGE

app.get('/', (req, res) => {

    res.sendFile(
        join(
            __dirname,
            '../frontend/pages/index.html'
        )
    );

});

// CHATROOM PAGE

app.get('/chatroom', (req, res) => {

    res.sendFile(
        join(
            __dirname,
            '../frontend/pages/chatroom.html'
        )
    );

});

// NOTICEBOARD PAGE

app.get('/noticeboard', (req, res) => {

    res.sendFile(
        join(
            __dirname,
            '../frontend/pages/noticeboard.html'
        )
    );

});

// ADMIN PAGE

app.get('/admin', (req, res) => {

    res.sendFile(
        join(
            __dirname,
            '../frontend/pages/admin.html'
        )
    );

});

// CHATBOT PAGE

app.get('/chatbot', (req, res) => {

    res.sendFile(
        join(
            __dirname,
            '../frontend/pages/chatbot.html'
        )
    );

});

// ===============================
// NOTICE APIs
// ===============================

// GET NOTICES

app.get('/api/notices', (req, res) => {

    res.json(notices);

});

// CREATE NOTICE

app.post('/api/notices', (req, res) => {

    const notice = {

        ...req.body,

        createdAt: new Date()

    };

    notices.unshift(notice);

    io.emit('noticeUpdated', {

        action: 'create',

        notice

    });

    console.log(
        'Notice Added:',
        notice.title
    );

    res.json({

        success: true,

        notice

    });

});

// ===============================
// CHATBOT API
// ===============================

app.post('/api/chatbot', async (req, res) => {

    try {

        const userMessage = req.body.message;

        console.log(
            '\n======================'
        );

        console.log(
            'USER MESSAGE:',
            userMessage
        );

        console.log(
            'API KEY:',
            process.env.GROQ_API_KEY
                ? 'Loaded ✅'
                : 'Missing ❌'
        );

        const completion =
            await client.chat.completions.create({

                model: 'llama-3.1-8b-instant',
                messages: [

                    {
                        role: 'system',

                        content: `
You are an AI assistant for a college club portal.

if student wants to know about notices and there is no notice then 
no notice available
else which notice demands give it

Help students regarding:
- hacker club
- chess club
- robotics
- notices
- events
- registrations
- chatroom

Rules:
- Keep replies short
- Be friendly
- Answer clearly
- Help students properly
`
                    },

                    {
                        role: 'user',

                        content: userMessage
                    }

                ]

            });

        console.log(
            'Groq Response Success ✅'
        );

        const botReply =
            completion.choices[0]
                .message.content;

        res.json({

            reply: botReply

        });

    } catch (error) {

        console.log(
            '\n========== GROQ ERROR =========='
        );

        console.log(error);

        console.log(
            '\n========== ERROR MESSAGE =========='
        );

        console.log(error.message);

        console.log(
            '\n========== RESPONSE DATA =========='
        );

        console.log(error.response?.data);

        res.status(500).json({

            reply: 'AI Error'

        });

    }

});

// ===============================
// SOCKET.IO
// ===============================

const io = new Server(server, {

    cors: {

        origin: '*',

        methods: ['GET', 'POST']

    }

});

// SOCKET CONNECTION

io.on('connection', (socket) => {

    console.log(
        'User Connected:',
        socket.id
    );

    // ===========================
    // NEW USER
    // ===========================

    socket.on('newuser', (username) => {

        socket.username = username;

        socket.join(ROOM);

        onlineUsers.add(username);

        io.to(ROOM).emit(
            'userJoined',
            { username }
        );

        io.to(ROOM).emit(
            'onlineUsers',
            Array.from(onlineUsers)
        );

        console.log(
            username,
            'joined'
        );

    });

    // ===========================
    // CHAT MESSAGE
    // ===========================

    socket.on('chat', (message) => {

        console.log(
            `${message.username}: ${message.text}`
        );

        io.to(ROOM).emit(
            'chat',
            message
        );

    });

    // ===========================
    // POST NOTICE TO CHATROOM
    // ===========================

    socket.on('postNotice', (notice) => {

        const noticeMessage = {

            username: 'Admin Bot',

            text:
                `📢 [${notice.club}] ${notice.title}\n${notice.content}`,

            isNotice: true,

            noticeData: notice

        };

        io.to(ROOM).emit(
            'chat',
            noticeMessage
        );

    });

    // ===========================
    // NOTICE CREATED
    // ===========================

    socket.on('noticeCreated', (notice) => {

        io.emit(
            'noticeUpdated',
            {
                action: 'create',
                notice
            }
        );

    });

    // ===========================
    // NOTICE DELETED
    // ===========================

    socket.on('noticeDeleted', (data) => {

        io.emit(
            'noticeUpdated',
            {
                action: 'delete',
                noticeId: data.noticeId
            }
        );

    });

    // ===========================
    // DISCONNECT
    // ===========================

    socket.on('disconnect', () => {

        if (socket.username) {

            onlineUsers.delete(
                socket.username
            );

            io.to(ROOM).emit(
                'userLeft',
                {
                    username:
                        socket.username
                }
            );

        }

        console.log(
            'User disconnected:',
            socket.id
        );

    });

});

// ===============================
// START SERVER
// ===============================

const PORT = 4600;

server.listen(PORT, () => {

    console.log(
        '\n=============================='
    );

    console.log(
        `Server Running At:`
    );

    console.log(
        `http://localhost:${PORT}`
    );

    console.log(
        '==============================\n'
    );

});