import express from 'express';
import { createServer as createViteServer } from 'vite';
import pkg from 'whatsapp-web.js';
const { Client, LocalAuth } = pkg;
import { Server } from 'socket.io';
import http from 'http';
import qrcode from 'qrcode';
import path from 'path';

async function startServer() {
    const app = express();
    const server = http.createServer(app);
    const io = new Server(server);
    const PORT = 3000;

    let qrCodeData = '';
    let clientStatus = 'initializing';
    let client: any = null;

    const initializeWhatsApp = () => {
        console.log('Initializing WhatsApp client...');
        client = new Client({
            puppeteer: {
                executablePath: process.env.PUPPETEER_EXECUTABLE_PATH || undefined,
                args: [
                    '--no-sandbox',
                    '--disable-setuid-sandbox',
                    '--disable-dev-shm-usage',
                    '--disable-accelerated-2d-canvas',
                    '--no-first-run',
                    '--no-zygote',
                    '--single-process',
                    '--disable-gpu'
                ],
                headless: true,
            }
        });

        client.on('qr', async (qr: string) => {
            console.log('QR RECEIVED');
            try {
                qrCodeData = await qrcode.toDataURL(qr);
                clientStatus = 'qr_ready';
                io.emit('qr', qrCodeData);
                io.emit('status', clientStatus);
            } catch (err) {
                console.error('Error generating QR code:', err);
            }
        });

        client.on('ready', () => {
            console.log('Client is ready!');
            clientStatus = 'ready';
            qrCodeData = '';
            io.emit('status', clientStatus);
        });

        client.on('authenticated', () => {
            console.log('AUTHENTICATED');
            clientStatus = 'authenticated';
            io.emit('status', clientStatus);
        });

        client.on('auth_failure', (msg: string) => {
            console.error('AUTHENTICATION FAILURE', msg);
            clientStatus = 'auth_failure';
            io.emit('status', clientStatus);
        });

        client.on('disconnected', (reason: string) => {
            console.log('Client was logged out', reason);
            clientStatus = 'disconnected';
            io.emit('status', clientStatus);
            setTimeout(() => client.initialize().catch((e: any) => console.error('Re-init error:', e)), 5000);
        });

        client.initialize().catch((err: any) => {
            console.error('WhatsApp client initialization failed:', err);
            clientStatus = 'error';
            io.emit('status', clientStatus);
        });
    };

    // Socket.io connection
    io.on('connection', (socket) => {
        console.log('New client connected');
        socket.emit('status', clientStatus);
        if (qrCodeData) {
            socket.emit('qr', qrCodeData);
        }

        socket.on('send_message', async ({ to, message }) => {
            if (client && clientStatus === 'ready') {
                try {
                    const chatId = to.includes('@c.us') ? to : `${to}@c.us`;
                    await client.sendMessage(chatId, message);
                    socket.emit('message_sent', { to, message, status: 'success' });
                } catch (error) {
                    console.error('Error sending message:', error);
                    socket.emit('message_sent', { to, message, status: 'error', error: String(error) });
                }
            }
        });

        socket.on('reconnect_whatsapp', () => {
            if (clientStatus === 'error' || clientStatus === 'disconnected') {
                initializeWhatsApp();
            }
        });
    });

    // API routes
    app.get('/api/status', (req, res) => {
        res.json({ status: clientStatus });
    });

    // Vite middleware for development
    if (process.env.NODE_ENV !== 'production') {
        const vite = await createViteServer({
            server: { middlewareMode: true },
            appType: 'spa',
        });
        app.use(vite.middlewares);
    } else {
        const distPath = path.join(process.cwd(), 'dist');
        app.use(express.static(distPath));
        app.get('*', (req, res) => {
            res.sendFile(path.join(distPath, 'index.html'));
        });
    }

    server.listen(PORT, '0.0.0.0', () => {
        console.log(`Server running on http://localhost:${PORT}`);
        // Delay WhatsApp initialization to ensure Express is fully up
        setTimeout(initializeWhatsApp, 2000);
    });
}

startServer().catch(err => {
    console.error('Failed to start server:', err);
});
