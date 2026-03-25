import React, { useEffect, useState } from 'react';
import { io, Socket } from 'socket.io-client';
import { motion, AnimatePresence } from 'motion/react';
import { QrCode, MessageSquare, CheckCircle2, AlertCircle, Loader2, Send } from 'lucide-react';

export default function App() {
  const [socket, setSocket] = useState<Socket | null>(null);
  const [qrCode, setQrCode] = useState<string | null>(null);
  const [status, setStatus] = useState<string>('initializing');
  const [phoneNumber, setPhoneNumber] = useState('');
  const [message, setMessage] = useState('');
  const [lastMessageStatus, setLastMessageStatus] = useState<{ to: string, status: string, error?: string } | null>(null);

  useEffect(() => {
    const newSocket = io();
    setSocket(newSocket);

    newSocket.on('qr', (data: string) => {
      setQrCode(data);
      setStatus('qr_ready');
    });

    newSocket.on('status', (data: string) => {
      setStatus(data);
      if (data === 'ready') {
        setQrCode(null);
      }
    });

    newSocket.on('message_sent', (data: { to: string, status: string, error?: string }) => {
      setLastMessageStatus(data);
      if (data.status === 'success') {
        setMessage('');
        setTimeout(() => setLastMessageStatus(null), 3000);
      }
    });

    return () => {
      newSocket.close();
    };
  }, []);

  const handleSendMessage = (e: React.FormEvent) => {
    e.preventDefault();
    if (socket && phoneNumber && message) {
      socket.emit('send_message', { to: phoneNumber, message });
    }
  };

  const getStatusDisplay = () => {
    switch (status) {
      case 'initializing':
        return { icon: <Loader2 className="animate-spin text-blue-500" />, text: 'Initializing WhatsApp Client...', color: 'text-blue-500' };
      case 'qr_ready':
        return { icon: <QrCode className="text-orange-500" />, text: 'Scan QR Code to Connect', color: 'text-orange-500' };
      case 'authenticated':
        return { icon: <Loader2 className="animate-spin text-green-500" />, text: 'Authenticated, preparing...', color: 'text-green-500' };
      case 'ready':
        return { icon: <CheckCircle2 className="text-green-600" />, text: 'Connected and Ready', color: 'text-green-600' };
      case 'auth_failure':
        return { icon: <AlertCircle className="text-red-500" />, text: 'Authentication Failed', color: 'text-red-500' };
      case 'disconnected':
        return { icon: <AlertCircle className="text-red-500" />, text: 'Disconnected', color: 'text-red-500' };
      default:
        return { icon: <Loader2 className="animate-spin text-gray-500" />, text: status, color: 'text-gray-500' };
    }
  };

  const statusDisplay = getStatusDisplay();

  return (
    <div className="min-h-screen bg-zinc-50 font-sans text-zinc-900 flex flex-col items-center justify-center p-4">
      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="w-full max-w-md bg-white rounded-3xl shadow-xl border border-zinc-200 overflow-hidden"
      >
        <div className="p-8 border-b border-zinc-100 bg-zinc-900 text-white">
          <div className="flex items-center gap-3 mb-2">
            <MessageSquare className="w-8 h-8 text-green-400" />
            <h1 className="text-2xl font-bold tracking-tight">WhatsApp Bridge</h1>
          </div>
          <p className="text-zinc-400 text-sm">Powered by whatsapp-web.js</p>
        </div>

        <div className="p-8 space-y-8">
          {/* Status Indicator */}
          <div className="flex items-center gap-3 p-4 bg-zinc-50 rounded-2xl border border-zinc-100">
            {statusDisplay.icon}
            <span className={`font-medium ${statusDisplay.color}`}>{statusDisplay.text}</span>
          </div>

          <AnimatePresence mode="wait">
            {status === 'qr_ready' && qrCode && (
              <motion.div 
                key="qr"
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.9 }}
                className="flex flex-col items-center space-y-4"
              >
                <div className="p-4 bg-white border-2 border-zinc-100 rounded-2xl shadow-sm">
                  <img src={qrCode} alt="WhatsApp QR Code" className="w-64 h-64" />
                </div>
                <p className="text-xs text-zinc-500 text-center max-w-[200px]">
                  Open WhatsApp on your phone, go to Linked Devices, and scan this code.
                </p>
              </motion.div>
            )}

            {status === 'ready' && (
              <motion.div 
                key="ready"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="space-y-6"
              >
                <form onSubmit={handleSendMessage} className="space-y-4">
                  <div className="space-y-2">
                    <label className="text-xs font-bold uppercase tracking-wider text-zinc-500">Phone Number</label>
                    <input 
                      type="text" 
                      placeholder="e.g. 1234567890"
                      value={phoneNumber}
                      onChange={(e) => setPhoneNumber(e.target.value)}
                      className="w-full p-4 bg-zinc-50 border border-zinc-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-green-500/20 focus:border-green-500 transition-all"
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-xs font-bold uppercase tracking-wider text-zinc-500">Message</label>
                    <textarea 
                      placeholder="Type your message here..."
                      value={message}
                      onChange={(e) => setMessage(e.target.value)}
                      rows={3}
                      className="w-full p-4 bg-zinc-50 border border-zinc-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-green-500/20 focus:border-green-500 transition-all resize-none"
                    />
                  </div>
                  <button 
                    type="submit"
                    disabled={!phoneNumber || !message}
                    className="w-full py-4 bg-green-600 hover:bg-green-700 disabled:bg-zinc-300 text-white font-bold rounded-xl shadow-lg shadow-green-600/20 transition-all flex items-center justify-center gap-2"
                  >
                    <Send className="w-5 h-5" />
                    Send Message
                  </button>
                </form>

                {lastMessageStatus && (
                  <motion.div 
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    className={`p-4 rounded-xl flex items-center gap-3 ${lastMessageStatus.status === 'success' ? 'bg-green-50 text-green-700 border border-green-100' : 'bg-red-50 text-red-700 border border-red-100'}`}
                  >
                    {lastMessageStatus.status === 'success' ? <CheckCircle2 className="w-5 h-5" /> : <AlertCircle className="w-5 h-5" />}
                    <span className="text-sm font-medium">
                      {lastMessageStatus.status === 'success' ? 'Message sent successfully!' : `Error: ${lastMessageStatus.error}`}
                    </span>
                  </motion.div>
                )}
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </motion.div>

      <div className="mt-8 text-zinc-400 text-xs flex items-center gap-4">
        <span>Status: {status}</span>
        <div className="w-1 h-1 bg-zinc-300 rounded-full" />
        <span>Connected: {socket?.connected ? 'Yes' : 'No'}</span>
      </div>
    </div>
  );
}
