const express = require('express');
const {
  default: makeWASocket,
  useMultiFileAuthState,
  DisconnectReason
} = require('@whiskeysockets/baileys');
const QRCode = require('qrcode');
const pino = require('pino');

const app = express();
const PORT = process.env.PORT || 3000;

let qrImage = '';
let botStatus = 'Starting';
let sock;

app.get('/', async (req, res) => {
  if (req.query.password !== process.env.DASHBOARD_PASSWORD) {
    return res.status(401).send('Unauthorized. Add your dashboard password.');
  }

  res.send(`
    <html>
    <head><title>KINGELMUSTY BOT</title></head>
    <body style="background:#101820;color:white;text-align:center;font-family:Arial">
      <h1>👑 KINGELMUSTY BOT</h1>
      <h2>Status: ${botStatus}</h2>
      ${qrImage ? `<img src="${qrImage}" width="250">` : ''}
      <p>WhatsApp Group Management System</p>
    </body>
    </html>
  `);
});

app.listen(PORT, () => console.log('Dashboard running'));

async function startBot() {
  const { state, saveCreds } = await useMultiFileAuthState('session');

  sock = makeWASocket({
    auth: state,
    logger: pino({ level: 'silent' }),
    browser: ['KINGELMUSTY BOT', 'Chrome', '1.0']
  });

  sock.ev.on('creds.update', saveCreds);

  sock.ev.on('connection.update', async (update) => {
    const { connection, qr } = update;

    if (qr) {
      qrImage = await QRCode.toDataURL(qr);
      botStatus = 'Scan QR Code';
    }

    if (connection === 'open') {
      botStatus = 'Connected';
      qrImage = '';
      console.log('KINGELMUSTY BOT CONNECTED!');
    }

    if (connection === 'close') {
      botStatus = 'Disconnected';
      startBot();
    }
  });

  sock.ev.on('messages.upsert', async ({ messages }) => {
    const msg = messages[0];

    if (!msg.message || msg.key.fromMe) return;

    const text = msg.message.conversation ||
      msg.message.extendedTextMessage?.text || '';

    const chat = msg.key.remoteJid;

    if (text === '.ping') {
      await sock.sendMessage(chat, { text: '🏓 KINGELMUSTY BOT is online!' });
    }

    if (text === '.menu') {
      await sock.sendMessage(chat, {
        text: `👑 KINGELMUSTY BOT

.ping - Check bot
.menu - Show commands
.groupinfo - Group information`
      });
    }

    if (text === '.groupinfo' && chat.endsWith('@g.us')) {
      const metadata = await sock.groupMetadata(chat);

      await sock.sendMessage(chat, {
        text: `👥 GROUP INFORMATION

Name: ${metadata.subject}
Members: ${metadata.participants.length}`
      });
    }
  });
}

startBot().catch(console.error);
