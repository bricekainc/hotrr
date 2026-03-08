// api/index.js
const TelegramBot = require('node-telegram-bot-api');
const express = require('express');
const axios = require('axios');
const fs = require('fs');

const app = express();
app.use(express.json());
app.set('trust proxy', 1);

const BOT_TOKEN = process.env.BOT_TOKEN;
const ADMIN_ID = String(process.env.ADMIN_ID);
const WEBAPP_URL = process.env.WEBAPP_URL; // e.g. https://your-app.koyeb.app
const PAYHERO_USER = process.env.PAYHERO_API_USERNAME;
const PAYHERO_PASS = process.env.PAYHERO_API_PASSWORD;
const PAYHERO_CHANNEL = process.env.PAYHERO_CHANNEL_ID;
const CP_MERCHANT_ID = process.env.COINPAYMENTS_MERCHANT_ID;

const bot = new TelegramBot(BOT_TOKEN, { webHook: true });

// -------------------- STORAGE --------------------
let userState = {};
let catalog = {};

if (fs.existsSync('./catalog.json')) {
    catalog = JSON.parse(fs.readFileSync('./catalog.json'));
}

function saveCatalog() {
    fs.writeFileSync('./catalog.json', JSON.stringify(catalog));
}

// -------------------- PAYMENT SUCCESS --------------------
async function handleSuccessfulPayment(userId, productId, provider) {
    const item = catalog[productId];
    if (!item) return;

    try {
        if (item.fileIds.length > 1) {
            const mediaGroup = item.fileIds.map((id, index) => ({
                type: 'video',
                media: id,
                caption: index === 0 ? `✅ **Payment Confirmed!**\n\n${item.caption}` : '',
                parse_mode: 'Markdown',
                protect_content: true,
                has_spoiler: true
            }));
            await bot.sendMediaGroup(userId, mediaGroup);
        } else {
            await bot.sendVideo(userId, item.fileIds[0], {
                caption: `✅ **Payment Confirmed via ${provider}**\n\n${item.caption}\n\n_Content is protected and cannot be forwarded._`,
                parse_mode: 'Markdown',
                protect_content: true,
                has_spoiler: true
            });
        }
        await bot.sendMessage(ADMIN_ID, `💰 SALE: Product [${item.caption.substring(0,20)}...] sold to ${userId} via ${provider}`);
    } catch (e) {
        console.error("Delivery Error:", e.message);
        await bot.sendMessage(userId, "❌ Error delivering files. Contact admin.");
    }
}

// -------------------- M-PESA --------------------
async function initiateSTKPush(userId, phone, productId) {
    const item = catalog[productId];
    const auth = Buffer.from(`${PAYHERO_USER}:${PAYHERO_PASS}`).toString('base64');
    try {
        const res = await axios.post('https://backend.payhero.co.ke/api/v2/payments', {
            amount: Number(item.kes),
            phone_number: phone,
            channel_id: Number(PAYHERO_CHANNEL),
            provider: 'm-pesa',
            external_reference: `bot_${userId}_${productId}`,
            callback_url: `${WEBAPP_URL}/payhero/callback`
        }, { headers: { Authorization: `Basic ${auth}` } });
        return res.data.success || res.data.status === 'QUEUED';
    } catch { return false; }
}

// -------------------- WEBHOOK --------------------
app.post('/api/webhook', (req, res) => {
    res.sendStatus(200);
    bot.processUpdate(req.body);
});

// -------------------- NEUBRUTALISM FAQ WEB --------------------
app.get('/', (req, res) => {
    res.send(`
    <!DOCTYPE html>
    <html>
    <head>
        <title>H.O.T Red Room | Standalone Access</title>
        <style>
            :root { --bg: #fdfd96; --primary: #ff5c5c; --dark: #000; }
            body { background: var(--bg); font-family: 'Courier New', Courier, monospace; color: var(--dark); padding: 20px; display: flex; flex-direction: column; align-items: center; }
            .card { background: white; border: 4px solid var(--dark); box-shadow: 10px 10px 0px var(--dark); padding: 20px; max-width: 600px; width: 100%; margin-bottom: 30px; }
            h1 { text-transform: uppercase; font-size: 3rem; margin: 0; background: var(--primary); padding: 10px; border: 4px solid var(--dark); display: inline-block; transform: rotate(-2deg); }
            .step { margin: 20px 0; font-weight: bold; font-size: 1.2rem; }
            .btn { background: #5c7cff; color: white; border: 4px solid var(--dark); padding: 15px 30px; font-weight: 900; text-decoration: none; display: inline-block; box-shadow: 5px 5px 0px var(--dark); transition: 0.1s; }
            .btn:active { transform: translate(5px, 5px); box-shadow: 0px 0px 0px var(--dark); }
            .stars-promo { background: #00d1ff; padding: 10px; border: 3px solid var(--dark); margin-top: 10px; font-size: 0.9rem; }
        </style>
    </head>
    <body>
        <h1>RED ROOM BOT</h1>
        <div class="card">
            <h2>How to Unlock Content:</h2>
            <div class="step">1. Open the Bot and Send /start</div>
            <p>Browse the latest exclusive uploads or use the search keyword.</p>
            <div class="step">2. Choose Your Content</div>
            <p>Each video pack has a dedicated unlock button with a cover preview.</p>
            <div class="step">3. Pay Instantly</div>
            <p>Select your method. We support M-Pesa, Crypto, and <b>Telegram Stars</b>.</p>
            <div class="stars-promo"><b>PRO TIP:</b> Telegram Stars is 30% cheaper, instant, and the most secure way to pay.</div>
            <div class="step">4. Instant Delivery</div>
            <p>The files are sent directly to your chat. No channels to join, no links that expire.</p>
            <br>
            <a href="https://t.me/RedRoomAccessbot" class="btn">OPEN BOT NOW</a>
        </div>
    </body>
    </html>
    `);
});

// -------------------- MESSAGE HANDLER --------------------
bot.on('message', async (msg) => {
    const userId = msg.from.id;
    const text = (msg.text || "").trim();
    if (msg.successful_payment) return;

    // --- ADMIN UPLOAD FLOW ---
    if (String(userId) === ADMIN_ID) {
        if (text === '/add') {
            userState[userId] = { step: 'WAITING_FOR_VIDEOS', fileIds: [] };
            return bot.sendMessage(userId, "📤 Send/Forward the video(s). Send /done when finished.");
        }
        if (text === '/done' && userState[userId]?.step === 'WAITING_FOR_VIDEOS') {
            if (userState[userId].fileIds.length === 0) return bot.sendMessage(userId, "❌ No videos.");
            userState[userId].step = 'WAITING_FOR_CAPTION';
            return bot.sendMessage(userId, "📝 Send the Caption/Keywords for this pack.");
        }
        if (userState[userId]?.step === 'WAITING_FOR_VIDEOS' && (msg.video || msg.document)) {
            const fileId = msg.video ? msg.video.file_id : msg.document.file_id;
            userState[userId].fileIds.push(fileId);
            return bot.sendMessage(userId, `✅ Added. Total: ${userState[userId].fileIds.length}. Send more or /done.`);
        }
        if (userState[userId]?.step === 'WAITING_FOR_CAPTION' && text) {
            userState[userId].caption = text;
            userState[userId].step = 'WAITING_FOR_COVER';
            return bot.sendMessage(userId, "🖼 Send a Cover Photo.");
        }
        if (userState[userId]?.step === 'WAITING_FOR_COVER' && msg.photo) {
            const coverId = msg.photo[msg.photo.length - 1].file_id;
            const pId = 'item_' + Date.now();
            catalog[pId] = {
                fileIds: userState[userId].fileIds,
                caption: userState[userId].caption,
                coverId: coverId,
                stars: 250, kes: 450, usd: 5
            };
            saveCatalog();
            delete userState[userId];
            const link = `https://t.me/RedRoomAccessbot?start=${pId}`;
            return bot.sendMessage(userId, `✅ Product Created!\n\nDirect Link:\n<code>${link}</code>`, { parse_mode: 'HTML' });
        }
    }

    // --- USER FLOW ---
    if (text.startsWith('/start')) {
        const payload = text.split(' ')[1];
        
        // Deep Link Handling
        if (payload && catalog[payload]) {
            const item = catalog[payload];
            return bot.sendPhoto(userId, item.coverId, {
                caption: `🔥 **EXCLUSIVE PACK**\n\n${item.caption}\n\nSelect a payment method below to unlock instantly.`,
                parse_mode: 'Markdown',
                reply_markup: {
                    inline_keyboard: [[{ text: `Unlock Now - ${item.stars} ⭐`, callback_data: `buy_${payload}` }]]
                }
            });
        }

        const welcome = `🔞 <b>H.O.T Red Room Premium</b>\n\n` +
            `Everything you see here is delivered <b>instantly</b> to this chat once unlocked.\n\n` +
            `⭐ <b>CHEAPEST OPTION:</b> Use Telegram Stars. It's 30% cheaper, safer, and activation is 1-second fast.\n\n` +
            `🔍 <b>SEARCH:</b> Type a keyword to find specific content.\n\n` +
            `👇 <b>LATEST UPLOADS:</b>`;
        
        await bot.sendMessage(userId, welcome, { parse_mode: 'HTML' });

        // Show all catalog items
        for (const [id, item] of Object.entries(catalog).slice(-5)) { // Last 5
            await bot.sendPhoto(userId, item.coverId, {
                caption: item.caption,
                reply_markup: {
                    inline_keyboard: [[{ text: `Unlock - ${item.stars} ⭐`, callback_data: `buy_${id}` }]]
                }
            });
        }
        return;
    }

    // Keyword Search
    if (text && !userState[userId]?.awaitingMpesa) {
        const results = Object.entries(catalog).filter(([id, item]) => 
            item.caption.toLowerCase().includes(text.toLowerCase())
        );
        if (results.length > 0) {
            for (const [id, item] of results) {
                await bot.sendPhoto(userId, item.coverId, {
                    caption: `Match: ${item.caption}`,
                    reply_markup: { inline_keyboard: [[{ text: `Unlock - ${item.stars} ⭐`, callback_data: `buy_${id}` }]] }
                });
            }
        }
    }

    // M-Pesa Phone Input
    if (userState[userId]?.awaitingMpesa) {
        const pId = userState[userId].product;
        const success = await initiateSTKPush(userId, text, pId);
        userState[userId].awaitingMpesa = false;
        return bot.sendMessage(userId, success ? "✅ Check your phone for M-Pesa PIN prompt." : "❌ Error starting M-Pesa.");
    }
});

// -------------------- CALLBACKS --------------------
bot.on('callback_query', async (q) => {
    const userId = q.from.id;
    const data = q.data;
    bot.answerCallbackQuery(q.id);

    if (data.startsWith('buy_')) {
        const pId = data.split('_')[1];
        const item = catalog[pId];
        return bot.sendMessage(userId, `Payment for: ${item.caption.substring(0,30)}...`, {
            reply_markup: {
                inline_keyboard: [
                    [{ text: '⭐ Stars (Recommended - Cheaper)', callback_data: `stars_${pId}` }],
                    [{ text: '🇰🇪 M-Pesa', callback_data: `mpesa_${pId}` }],
                    [{ text: '🌍 Crypto', callback_data: `crypto_${pId}` }]
                ]
            }
        });
    }

    if (data.startsWith('stars_')) {
        const pId = data.split('_')[1];
        const item = catalog[pId];
        return bot.sendInvoice(userId, "Unlock Content", "Instant Access", `item*${pId}`, "", "XTR",
            [{ label: "Premium File", amount: item.stars }]
        );
    }

    if (data.startsWith('mpesa_')) {
        userState[userId] = { product: data.split('_')[1], awaitingMpesa: true };
        return bot.sendMessage(userId, "📱 Enter your M-Pesa Phone (254...):");
    }

    if (data.startsWith('crypto_')) {
        const pId = data.split('_')[1];
        const item = catalog[pId];
        const params = new URLSearchParams({ cmd: '_pay_simple', merchant: CP_MERCHANT_ID, item_name: "Premium Pack", amountf: item.usd, currency: 'USD', custom: `${userId}|${pId}`, ipn_url: `${WEBAPP_URL}/coinpayments/ipn` });
        return bot.sendMessage(userId, "Pay via Crypto:", {
            reply_markup: { inline_keyboard: [[{ text: "Open CoinPayments", url: `https://www.coinpayments.net/index.php?${params.toString()}` }]] }
        });
    }
});

// -------------------- PAYMENT WEBHOOKS --------------------
bot.on('pre_checkout_query', q => bot.answerPreCheckoutQuery(q.id, true));
bot.on('successful_payment', async (msg) => {
    const pId = msg.successful_payment.invoice_payload.split('*')[1];
    await handleSuccessfulPayment(msg.from.id, pId, "Stars");
});

app.post('/payhero/callback', async (req, res) => {
    if (req.body.status === "Success") {
        const parts = req.body.external_reference.split('_');
        if (parts.length >= 3) await handleSuccessfulPayment(parts[1], parts[2], "M-Pesa");
    }
    res.json({ success: true });
});

app.post('/coinpayments/ipn', (req, res) => {
    if (parseInt(req.body.status) >= 100) {
        const [uId, pId] = req.body.custom.split('|');
        handleSuccessfulPayment(uId, pId, "Crypto");
    }
    res.sendStatus(200);
});

const PORT = process.env.PORT || 8000;
app.listen(PORT, '0.0.0.0', () => console.log(`Bot live on ${PORT}`));
