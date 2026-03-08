// api/index.js
const TelegramBot = require('node-telegram-bot-api');
const express = require('express');
const axios = require('axios');
const { Pool } = require('pg');

const app = express();
app.use(express.json());
app.set('trust proxy', 1);

// Environment Variables
const {
    BOT_TOKEN,
    ADMIN_ID,
    WEBAPP_URL,
    PAYHERO_API_USERNAME: PAYHERO_USER,
    PAYHERO_API_PASSWORD: PAYHERO_PASS,
    PAYHERO_CHANNEL_ID: PAYHERO_CHANNEL,
    COINPAYMENTS_MERCHANT_ID: CP_MERCHANT_ID,
    DATABASE_URL
} = process.env;

// DB Connection
const pool = new Pool({
    connectionString: DATABASE_URL,
    ssl: { rejectUnauthorized: false }
});

// Initialize Database Table
async function initDB() {
    await pool.query(`
        CREATE TABLE IF NOT EXISTS catalog (
            id TEXT PRIMARY KEY,
            file_ids TEXT[],
            caption TEXT,
            cover_id TEXT,
            stars INTEGER DEFAULT 250,
            kes INTEGER DEFAULT 450,
            usd INTEGER DEFAULT 5
        );
    `);
}
initDB().catch(console.error);

const bot = new TelegramBot(BOT_TOKEN, { webHook: true });
let userState = {};

// -------------------- DELIVERY LOGIC --------------------
async function deliverContent(userId, item, provider = "Free Access") {
    try {
        if (item.file_ids.length > 1) {
            const mediaGroup = item.file_ids.map((id, index) => ({
                type: 'video',
                media: id,
                caption: index === 0 ? `✅ **Unlocked via ${provider}**\n\n${item.caption}` : '',
                parse_mode: 'Markdown',
                protect_content: true,
                has_spoiler: true
            }));
            await bot.sendMediaGroup(userId, mediaGroup);
        } else {
            await bot.sendVideo(userId, item.file_ids[0], {
                caption: `✅ **Unlocked via ${provider}**\n\n${item.caption}\n\n_Protected Content._`,
                parse_mode: 'Markdown',
                protect_content: true,
                has_spoiler: true
            });
        }
        if (provider !== "Free Access") {
            await bot.sendMessage(ADMIN_ID, `💰 SALE: [${item.id}] sold to ${userId} via ${provider}`);
        }
    } catch (e) {
        console.error("Delivery Error:", e.message);
    }
}

// -------------------- M-PESA --------------------
async function initiateSTKPush(userId, phone, productId) {
    const res = await pool.query('SELECT kes FROM catalog WHERE id = $1', [productId]);
    const amount = res.rows[0]?.kes;
    const auth = Buffer.from(`${PAYHERO_USER}:${PAYHERO_PASS}`).toString('base64');
    try {
        const response = await axios.post('https://backend.payhero.co.ke/api/v2/payments', {
            amount: Number(amount),
            phone_number: phone,
            channel_id: Number(PAYHERO_CHANNEL),
            provider: 'm-pesa',
            external_reference: `bot_${userId}_${productId}`,
            callback_url: `${WEBAPP_URL}/payhero/callback`
        }, { headers: { Authorization: `Basic ${auth}` } });
        return response.data.success || response.data.status === 'QUEUED';
    } catch { return false; }
}

// -------------------- WEBHOOK --------------------
app.post('/api/webhook', (req, res) => {
    res.sendStatus(200);
    bot.processUpdate(req.body);
});

// -------------------- WEB UI (Neubrutalism) --------------------
app.get('/', (req, res) => {
    res.send(`
    <!DOCTYPE html>
    <html>
    <head>
        <title>H.O.T Red Room | Standalone</title>
        <style>
            :root { --bg: #fdfd96; --primary: #ff5c5c; --dark: #000; --blue: #5c7cff; }
            body { background: var(--bg); font-family: 'Helvetica', sans-serif; color: var(--dark); padding: 40px; display: flex; flex-direction: column; align-items: center; }
            .card { background: white; border: 4px solid var(--dark); box-shadow: 12px 12px 0px var(--dark); padding: 30px; max-width: 600px; width: 100%; }
            h1 { text-transform: uppercase; font-size: 3rem; background: var(--primary); padding: 15px; border: 4px solid var(--dark); transform: rotate(-2deg); display: inline-block; margin-bottom: 30px; }
            .step { margin: 20px 0; font-weight: 900; font-size: 1.2rem; border-left: 8px solid var(--blue); padding-left: 15px; }
            .btn { background: var(--blue); color: white; border: 4px solid var(--dark); padding: 20px 40px; font-weight: 900; text-decoration: none; display: block; text-align: center; box-shadow: 6px 6px 0px var(--dark); margin-top: 30px; font-size: 1.2rem; }
            .stars-badge { background: #00d1ff; padding: 12px; border: 3px solid var(--dark); margin-top: 15px; font-weight: bold; transform: skewX(-5deg); }
        </style>
    </head>
    <body>
        <h1>RED ROOM PREMIUM</h1>
        <div class="card">
            <div class="step">1. SEARCH CONTENT BY KEYWORD</div>
            <div class="step">2. UNLOCK VIA SECURE GATEWAY</div>
            <div class="step">3. INSTANT DELIVERY TO CHAT</div>
            <div class="stars-badge">🌟 TIP: PAY WITH STARS FOR 30% DISCOUNT & INSTANT ACCESS.</div>
            <a href="https://t.me/RedRoomAccessbot" class="btn">ENTER BOT</a>
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

    // --- ADMIN ACTIONS ---
    if (String(userId) === ADMIN_ID) {
        if (text === '/add') {
            userState[userId] = { step: 'WAITING_FOR_VIDEOS', fileIds: [] };
            return bot.sendMessage(userId, "📤 Send/Forward videos. Type /done when finished.");
        }
        if (text === '/done' && userState[userId]?.step === 'WAITING_FOR_VIDEOS') {
            userState[userId].step = 'WAITING_FOR_CAPTION';
            return bot.sendMessage(userId, "📝 Send the Search Keywords/Caption.");
        }
        if (userState[userId]?.step === 'WAITING_FOR_VIDEOS' && (msg.video || msg.document)) {
            userState[userId].fileIds.push(msg.video ? msg.video.file_id : msg.document.file_id);
            return bot.sendMessage(userId, `✅ Added. Total: ${userState[userId].fileIds.length}`);
        }
        if (userState[userId]?.step === 'WAITING_FOR_CAPTION' && text) {
            userState[userId].caption = text;
            userState[userId].step = 'WAITING_FOR_COVER';
            return bot.sendMessage(userId, "🖼 Send the Cover Photo.");
        }
        if (userState[userId]?.step === 'WAITING_FOR_COVER' && msg.photo) {
            const coverId = msg.photo[msg.photo.length - 1].file_id;
            const pId = 'p' + Date.now();
            await pool.query(
                'INSERT INTO catalog (id, file_ids, caption, cover_id) VALUES ($1, $2, $3, $4)',
                [pId, userState[userId].fileIds, userState[userId].caption, coverId]
            );
            delete userState[userId];
            const link = `https://t.me/RedRoomAccessbot?start=${pId}`;
            return bot.sendMessage(userId, `✅ Created! Link:\n<code>${link}</code>`, { parse_mode: 'HTML' });
        }
        // Price Editing: /edit [ID] [Stars] [Kes] [Usd]
        if (text.startsWith('/edit')) {
            const [_, id, stars, kes, usd] = text.split(' ');
            await pool.query('UPDATE catalog SET stars=$1, kes=$2, usd=$3 WHERE id=$4', [stars, kes, usd, id]);
            return bot.sendMessage(userId, `✅ Updated pricing for ${id}. If Stars is 0, it's now FREE.`);
        }
    }

    // --- USER ACTIONS ---
    if (text.startsWith('/start')) {
        const payload = text.split(' ')[1];
        if (payload) {
            const res = await pool.query('SELECT * FROM catalog WHERE id = $1', [payload]);
            const item = res.rows[0];
            if (item) {
                if (item.stars === 0) return deliverContent(userId, item);
                return bot.sendPhoto(userId, item.cover_id, {
                    caption: `🔥 **PREMIUM ACCESS**\n\n${item.caption}`,
                    parse_mode: 'Markdown',
                    reply_markup: { inline_keyboard: [[{ text: `Unlock - ${item.stars} ⭐`, callback_data: `buy_${payload}` }]] }
                });
            }
        }
        await bot.sendMessage(userId, "🔞 **H.O.T RED ROOM**\nSearch by keyword or browse latest uploads:");
        const latest = await pool.query('SELECT * FROM catalog ORDER BY id DESC LIMIT 3');
        for (const item of latest.rows) {
            await bot.sendPhoto(userId, item.cover_id, {
                caption: item.caption,
                reply_markup: { inline_keyboard: [[{ text: item.stars === 0 ? "FREE ACCESS" : `Unlock - ${item.stars} ⭐`, callback_data: `buy_${item.id}` }]] }
            });
        }
        return;
    }

    // Keyword Search
    if (text && !userState[userId]?.awaitingMpesa) {
        const res = await pool.query('SELECT * FROM catalog WHERE caption ILIKE $1', [`%${text}%`]);
        if (res.rows.length === 0) return bot.sendMessage(userId, "❌ No matches found.");
        for (const item of res.rows) {
            await bot.sendPhoto(userId, item.cover_id, {
                caption: item.caption,
                reply_markup: { inline_keyboard: [[{ text: item.stars === 0 ? "FREE ACCESS" : `Unlock - ${item.stars} ⭐`, callback_data: `buy_${item.id}` }]] }
            });
        }
    }

    // M-Pesa Input
    if (userState[userId]?.awaitingMpesa) {
        const pId = userState[userId].product;
        const ok = await initiateSTKPush(userId, text, pId);
        userState[userId].awaitingMpesa = false;
        bot.sendMessage(userId, ok ? "✅ Check phone for M-Pesa PIN prompt." : "❌ M-Pesa STK failed.");
    }
});

// -------------------- CALLBACKS --------------------
bot.on('callback_query', async (q) => {
    const userId = q.from.id;
    const pId = q.data.split('_')[1];
    bot.answerCallbackQuery(q.id);

    const res = await pool.query('SELECT * FROM catalog WHERE id = $1', [pId]);
    const item = res.rows[0];
    if (!item) return;

    if (item.stars === 0) return deliverContent(userId, item);

    if (q.data.startsWith('buy_')) {
        bot.sendMessage(userId, "Select Method:", {
            reply_markup: {
                inline_keyboard: [
                    [{ text: '⭐ Stars (Recommended - Instant)', callback_data: `stars_${pId}` }],
                    [{ text: '🇰🇪 M-Pesa (Kenya Only)', callback_data: `mpesa_${pId}` }],
                    [{ text: '🌍 Crypto (BTC/USDT/LTC)', callback_data: `crypto_${pId}` }]
                ]
            }
        });
    } else if (q.data.startsWith('stars_')) {
        bot.sendInvoice(userId, "Unlock Content", "Instant Delivery", `item*${pId}`, "", "XTR",
            [{ label: "Premium Pack", amount: item.stars }]
        );
    } else if (q.data.startsWith('mpesa_')) {
        userState[userId] = { product: pId, awaitingMpesa: true };
        bot.sendMessage(userId, "📱 Send M-Pesa Phone (Format: 2547XXXXXXXX):");
    } else if (q.data.startsWith('crypto_')) {
        const params = new URLSearchParams({ cmd: '_pay_simple', merchant: CP_MERCHANT_ID, amountf: item.usd, currency: 'USD', custom: `${userId}|${pId}`, ipn_url: `${WEBAPP_URL}/coinpayments/ipn` });
        bot.sendMessage(userId, "Complete Crypto Payment:", {
            reply_markup: { inline_keyboard: [[{ text: "Open Checkout", url: `https://www.coinpayments.net/index.php?${params.toString()}` }]] }
        });
    }
});

// -------------------- PAYMENT WEBHOOKS --------------------
bot.on('pre_checkout_query', q => bot.answerPreCheckoutQuery(q.id, true));
bot.on('successful_payment', async (msg) => {
    const pId = msg.successful_payment.invoice_payload.split('*')[1];
    const res = await pool.query('SELECT * FROM catalog WHERE id = $1', [pId]);
    await deliverContent(msg.from.id, res.rows[0], "Telegram Stars");
});

app.post('/payhero/callback', async (req, res) => {
    if (req.body.status === "Success") {
        const parts = req.body.external_reference.split('_');
        const resDb = await pool.query('SELECT * FROM catalog WHERE id = $1', [parts[2]]);
        await deliverContent(parts[1], resDb.rows[0], "M-Pesa");
    }
    res.json({ success: true });
});

app.post('/coinpayments/ipn', async (req, res) => {
    if (parseInt(req.body.status) >= 100) {
        const [uId, pId] = req.body.custom.split('|');
        const resDb = await pool.query('SELECT * FROM catalog WHERE id = $1', [pId]);
        await deliverContent(uId, resDb.rows[0], "Crypto");
    }
    res.sendStatus(200);
});

const PORT = process.env.PORT || 8000;
app.listen(PORT, '0.0.0.0', () => console.log(`Bot Running on Port ${PORT}`));
