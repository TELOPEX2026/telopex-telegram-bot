const { SYSTEM_PROMPT } = require('./prompt');

const TELEGRAM_TOKEN = process.env.TELEGRAM_TOKEN;
const GEMINI_KEY     = process.env.GEMINI_API_KEY;
const GEMINI_URL     = `https://generativelanguage.googleapis.com/v1beta/models/gemini-flash-lite-latest:generateContent?key=${GEMINI_KEY}`;

const userHistories = {};

async function askGemini(userId, userMessage) {
  if (!userHistories[userId]) userHistories[userId] = [];
  const history = userHistories[userId];

  const contents = [
    { role: 'user',  parts: [{ text: SYSTEM_PROMPT }] },
    { role: 'model', parts: [{ text: 'Compris ! Je suis l\'assistant virtuel de Telopex, prêt à aider.' }] },
    ...history.slice(-10).map(m => ({
      role:  m.role === 'assistant' ? 'model' : 'user',
      parts: [{ text: m.content }]
    })),
    { role: 'user', parts: [{ text: userMessage }] }
  ];

  const res  = await fetch(GEMINI_URL, {
    method:  'POST',
    headers: { 'Content-Type': 'application/json' },
    body:    JSON.stringify({
      contents,
      generationConfig: { maxOutputTokens: 400, temperature: 0.7 }
    })
  });

  const data  = await res.json();
  const reply = data.candidates?.[0]?.content?.parts?.[0]?.text
    || 'Désolé, je n\'ai pas pu traiter votre demande. Contactez-nous sur contact@telopex.online.';

  history.push({ role: 'user',      content: userMessage });
  history.push({ role: 'assistant', content: reply });
  if (history.length > 20) userHistories[userId] = history.slice(-20);

  return reply;
}

async function sendMessage(chatId, text) {
  const url = `https://api.telegram.org/bot${TELEGRAM_TOKEN}/sendMessage`;
  await fetch(url, {
    method:  'POST',
    headers: { 'Content-Type': 'application/json' },
    body:    JSON.stringify({
      chat_id:    chatId,
      text:       text,
      parse_mode: 'Markdown'
    })
  });
}

async function getUpdates(offset = 0) {
  const url  = `https://api.telegram.org/bot${TELEGRAM_TOKEN}/getUpdates?offset=${offset}&timeout=30`;
  const res  = await fetch(url);
  const data = await res.json();
  return data.result || [];
}

async function main() {
  console.log('=== Telopex Bot Telegram démarré ===');
  console.log(`Token Telegram : ${TELEGRAM_TOKEN ? '✓' : '✗ MANQUANT'}`);
  console.log(`Clé Gemini     : ${GEMINI_KEY     ? '✓' : '✗ MANQUANT'}\n`);

  let offset = 0;

  while (true) {
    try {
      const updates = await getUpdates(offset);

      for (const update of updates) {
        offset = update.update_id + 1;

        const msg = update.message;
        if (!msg || !msg.text) continue;

        const chatId = msg.chat.id;
        const userId = msg.from.id;
        const text   = msg.text;
        const name   = msg.from.first_name || 'Client';

        console.log(`[${name}] ${text}`);

        if (text === '/start') {
          await sendMessage(chatId,
            `👋 Bonjour *${name}* ! Je suis l'assistant virtuel de *Telopex*. ⚡\n\n` +
            `Telopex conçoit des *bots IA*, automatise vos processus et crée des *sites web* modernes.\n\n` +
            `Comment puis-je vous aider aujourd'hui ? 😊`
          );
          continue;
        }

        if (text === '/services') {
          await sendMessage(chatId,
            `*Nos services Telopex :* ⚡\n\n` +
            `🤖 *Bots IA Multi-canaux* — WhatsApp, Telegram, Messenger, Instagram\n` +
            `⚡ *Automation* — Connectez tous vos outils en un workflow\n` +
            `🌐 *Développement Web* — Sites modernes et responsives\n` +
            `🎓 *Formations* — Apprenez à créer vos propres bots IA\n\n` +
            `Pour un devis : contact@telopex.online 📩`
          );
          continue;
        }

        if (text === '/contact') {
          await sendMessage(chatId,
            `*Contactez Telopex :* 📞\n\n` +
            `📧 Email : contact@telopex.online\n` +
            `📱 WhatsApp : +225 89 15 67 54\n` +
            `🌐 Site : https://telopex.online\n\n` +
            `Réponse garantie sous 24h. ✅`
          );
          continue;
        }

        if (text === '/reset') {
          userHistories[userId] = [];
          await sendMessage(chatId, '🔄 Conversation réinitialisée ! Comment puis-je vous aider ?');
          continue;
        }

        if (text === '/aide') {
          await sendMessage(chatId,
            `*Commandes disponibles :*\n\n` +
            `/start — Démarrer\n` +
            `/services — Voir nos services\n` +
            `/contact — Nous contacter\n` +
            `/reset — Nouvelle conversation\n` +
            `/aide — Afficher cette aide\n\n` +
            `Ou posez directement votre question ! 😊`
          );
          continue;
        }

        await sendMessage(chatId, '⏳');
        const reply = await askGemini(userId, text);
        await sendMessage(chatId, reply);
        console.log(`[Telopex Bot] ${reply}\n`);
      }

    } catch (err) {
      console.error('Erreur :', err.message);
      await new Promise(r => setTimeout(r, 3000));
    }
  }
}

main().catch(console.error);
