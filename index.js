const TELEGRAM_TOKEN = process.env.TELEGRAM_TOKEN;
const GEMINI_KEY     = process.env.GEMINI_API_KEY;
const GEMINI_URL     = `https://generativelanguage.googleapis.com/v1beta/models/gemini-flash-lite-latest:generateContent?key=${GEMINI_KEY}`;

const SYSTEM_PROMPT = `Tu es l'assistant virtuel d'AbShop, une boutique en ligne algérienne.
Tu réponds uniquement en français, de façon naturelle et chaleureuse.
Tu es serviable, concis (2-3 phrases max) et toujours poli.

Informations sur AbShop :
- Produits : électronique, vêtements, accessoires
- Livraison : partout en Algérie, 3 à 5 jours ouvrables
- Livraison gratuite à partir de 5000 DA
- Paiement : carte bancaire, virement, paiement à la livraison
- Retours : 14 jours après réception
- Remboursement : sous 5 jours après retour reçu
- Support : contact@abshop.com, réponse sous 24h
- Promos : -10% sur la première commande via newsletter

Règles :
- Si la question ne concerne pas AbShop, réponds poliment.
- Ne jamais inventer de prix spécifiques.
- Toujours proposer contact@abshop.com pour les cas complexes.`;

const userHistories = {};

async function askGemini(userId, userMessage) {
  if (!userHistories[userId]) userHistories[userId] = [];
  const history = userHistories[userId];

  const contents = [
    { role: 'user',  parts: [{ text: SYSTEM_PROMPT }] },
    { role: 'model', parts: [{ text: 'Compris ! Je suis l\'assistant AbShop.' }] },
    ...history.slice(-10).map(m => ({
      role:  m.role === 'assistant' ? 'model' : 'user',
      parts: [{ text: m.content }]
    })),
    { role: 'user', parts: [{ text: userMessage }] }
  ];

  const res   = await fetch(GEMINI_URL, {
    method:  'POST',
    headers: { 'Content-Type': 'application/json' },
    body:    JSON.stringify({
      contents,
      generationConfig: { maxOutputTokens: 300, temperature: 0.7 }
    })
  });

  const data  = await res.json();
  const reply = data.candidates?.[0]?.content?.parts?.[0]?.text || 'Désolé, je n\'ai pas pu répondre.';

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
  console.log('=== AbShop Bot Telegram démarré ===');
  console.log(`Token: ${TELEGRAM_TOKEN ? '✓' : '✗ MANQUANT'}`);
  console.log(`Gemini: ${GEMINI_KEY ? '✓' : '✗ MANQUANT'}\n`);

  let offset = 0;

  while (true) {
    try {
      const updates = await getUpdates(offset);

      for (const update of updates) {
        offset = update.update_id + 1;

        const msg  = update.message;
        if (!msg || !msg.text) continue;

        const chatId = msg.chat.id;
        const userId = msg.from.id;
        const text   = msg.text;
        const name   = msg.from.first_name || 'Client';

        console.log(`[${name}] ${text}`);

        if (text === '/start') {
          await sendMessage(chatId,
            `👋 Bonjour *${name}* ! Je suis l'assistant *AbShop*.\n\nJe suis là pour répondre à toutes vos questions. Comment puis-je vous aider ? 😊`
          );
          continue;
        }

        if (text === '/reset') {
          userHistories[userId] = [];
          await sendMessage(chatId, '🔄 Conversation réinitialisée !');
          continue;
        }

        if (text === '/aide') {
          await sendMessage(chatId,
            `*Commandes disponibles :*\n/start — Démarrer\n/reset — Nouvelle conversation\n/aide — Aide\n\nOu posez directement votre question ! 😊`
          );
          continue;
        }

        await sendMessage(chatId, '⏳ ...');
        const reply = await askGemini(userId, text);
        await sendMessage(chatId, reply);
        console.log(`[AbShop] ${reply}\n`);
      }

    } catch (err) {
      console.error('Erreur:', err.message);
      await new Promise(r => setTimeout(r, 3000));
    }
  }
}

main().catch(console.error);
