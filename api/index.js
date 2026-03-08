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

// DB Connection - SSL Fixed for Koyeb/GitLab
const pool = new Pool({
    connectionString: DATABASE_URL,
    ssl: { rejectUnauthorized: false }
});

// Initialize Database Table
async function initDB() {
    try {
        await pool.query(`
            CREATE TABLE IF NOT EXISTS catalog (
                id TEXT PRIMARY KEY,
                video_link TEXT,
                caption TEXT,
                cover_id TEXT,
                stars INTEGER DEFAULT 250,
                kes INTEGER DEFAULT 450,
                usd INTEGER DEFAULT 5
            );
        `);
        console.log("✅ Database initialized successfully");
    } catch (err) {
        console.error("❌ Database initialization failed:", err.message);
    }
}
initDB();

const bot = new TelegramBot(BOT_TOKEN, { webHook: true });
let userState = {};

// -------------------- DELIVERY LOGIC --------------------
async function deliverContent(userId, item, provider = "Free Access") {
    try {
        const opts = {
            caption: `✅ **Access Granted via ${provider}!**\n\n${item.caption}\n\n_Your premium content link is ready below._`,
            parse_mode: 'Markdown',
            reply_markup: {
                inline_keyboard: [[{ text: "🚀 Watch / Download Now", url: item.video_link }]]
            }
        };
        
        await bot.sendPhoto(userId, item.cover_id, opts);
        
        if (provider !== "Free Access") {
            await bot.sendMessage(ADMIN_ID, `💰 SALE: [${item.id}] sold to ${userId} via ${provider}`);
        }
    } catch (e) {
        console.error("Delivery Error:", e.message);
        await bot.sendMessage(userId, "❌ Error providing link. Please contact support.");
    }
}

// -------------------- M-PESA GATEWAY --------------------
async function initiateSTKPush(userId, phone, productId) {
    try {
        const res = await pool.query('SELECT kes FROM catalog WHERE id = $1', [productId]);
        const amount = res.rows[0]?.kes;
        const auth = Buffer.from(`${PAYHERO_USER}:${PAYHERO_PASS}`).toString('base64');
        const response = await axios.post('https://backend.payhero.co.ke/api/v2/payments', {
            amount: Number(amount),
            phone_number: phone,
            channel_id: Number(PAYHERO_CHANNEL),
            provider: 'm-pesa',
            external_reference: `bot_${userId}_${productId}`,
            callback_url: `${WEBAPP_URL}/payhero/callback`
        }, { headers: { Authorization: `Basic ${auth}` } });
        return response.data.success || response.data.status === 'QUEUED';
    } catch (e) {
        console.error("Mpesa Error:", e.message);
        return false;
    }
}

// -------------------- WEBHOOK ROUTE --------------------
app.post('/api/webhook', (req, res) => {
    res.sendStatus(200);
    bot.processUpdate(req.body);
});

// -------------------- NEUBRUTALISM WEB UI --------------------
app.get('/', (req, res) => {
    res.send(`
    <!DOCTYPE html>
    <html lang="en">
    <head>
        <meta charset="UTF-8">
        <title>H.O.T Red Room | Standalone Access</title>
        <style>
            :root { --bg: #fdfd96; --primary: #ff5c5c; --dark: #000; --blue: #5c7cff; }
            body { background: var(--bg); font-family: 'Arial Black', sans-serif; color: var(--dark); padding: 20px; display: flex; flex-direction: column; align-items: center; }
            .card { background: white; border: 5px solid var(--dark); box-shadow: 15px 15px 0px var(--dark); padding: 30px; max-width: 600px; width: 100%; margin-top: 50px; }
            h1 { text-transform: uppercase; font-size: 3.5rem; background: var(--primary); padding: 15px; border: 5px solid var(--dark); transform: rotate(-2deg); display: inline-block; margin-bottom: 40px; }
            .step { margin: 25px 0; font-weight: 900; font-size: 1.4rem; border-left: 10px solid var(--blue); padding-left: 20px; line-height: 1.2; }
            .btn { background: var(--blue); color: white; border: 5px solid var(--dark); padding: 25px 50px; font-weight: 900; text-decoration: none; display: block; text-align: center; box-shadow: 8px 8px 0px var(--dark); margin-top: 40px; font-size: 1.5rem; transition: 0.1s; }
            .btn:hover { transform: translate(-2px, -2px); box-shadow: 10px 10px 0px var(--dark); }
            .stars-badge { background: #00d1ff; padding: 15px; border: 4px solid var(--dark); margin-top: 20px; font-weight: bold; font-size: 1rem; text-align: center; }
        </style>
    </head>
    <body>
        <h1>RED ROOM PREMIUM</h1>
        <div class="card">
            <div class="step">1. SEARCH CONTENT BY KEYWORD IN THE BOT</div>
            <div class="step">2. UNLOCK VIA TELEGRAM STARS, M-PESA, OR CRYPTO</div>
            <div class="step">3. RECEIVE HIGH-QUALITY VIDEOS INSTANTLY</div>
            <div class="stars-badge">🌟 PRO TIP: PAY WITH TELEGRAM STARS FOR A 30% DISCOUNT AND INSTANT ACTIVATION.</div>
            <a href="https://t.me/RedRoomAccessbot" class="btn">LAUNCH BOT NOW</a>
        </div>
    </body>
    </html>
    `);
});

// -------------------- BOT MESSAGE HANDLER --------------------
bot.on('message', async (msg) => {
    const userId = msg.from.id;
    const text = (msg.text || "").trim();
    if (msg.successful_payment) return;

    try {
        // --- ADMIN ACTIONS ---
        if (String(userId) === ADMIN_ID) {
            if (text === '/add') {
                userState[userId] = { step: 'WAITING_FOR_LINK' };
                return bot.sendMessage(userId, "🔗 **ADMIN MODE:** Send the **Video Link** (Watch/Download URL).");
            }
            if (userState[userId]?.step === 'WAITING_FOR_LINK' && text.startsWith('http')) {
                userState[userId].videoLink = text;
                userState[userId].step = 'WAITING_FOR_CAPTION';
                return bot.sendMessage(userId, "📝 Now send the **Caption/Keywords** for this pack.");
            }
            if (userState[userId]?.step === 'WAITING_FOR_CAPTION' && text && !text.startsWith('/')) {
                userState[userId].caption = text;
                userState[userId].step = 'WAITING_FOR_COVER';
                return bot.sendMessage(userId, "🖼 Send the **Cover Photo** users will see.");
            }
            if (userState[userId]?.step === 'WAITING_FOR_COVER' && msg.photo) {
                const coverId = msg.photo[msg.photo.length - 1].file_id;
                const pId = 'p' + Date.now();
                await pool.query(
                    'INSERT INTO catalog (id, video_link, caption, cover_id) VALUES ($1, $2, $3, $4)',
                    [pId, userState[userId].videoLink, userState[userId].caption, coverId]
                );
                delete userState[userId];
                const link = `https://t.me/RedRoomAccessbot?start=${pId}`;
                return bot.sendMessage(userId, `🎉 **Pack Created!**\n\nLink:\n<code>${link}</code>`, { parse_mode: 'HTML' });
            }
            if (text.startsWith('/edit')) {
                const [_, id, stars, kes, usd] = text.split(' ');
                await pool.query('UPDATE catalog SET stars=$1, kes=$2, usd=$3 WHERE id=$4', [stars, kes, usd, id]);
                return bot.sendMessage(userId, `✅ Updated! ID: ${id} pricing updated.`);
            }
        }

        // --- USER ACTIONS ---
        if (text.toLowerCase().startsWith('/start')) {
            const payload = text.split(' ')[1];
            
            const welcomeMsg = `🔞 <b>Welcome to H.O.T Red Room Premium</b>\n\n` +
                `Everything you see here is delivered <b>instantly</b> once unlocked.\n\n` +
                `⭐️ <b>Telegram Stars:</b> Recommended. 30% cheaper.\n` +
                `📲 <b>M-Pesa:</b> Instant STK push.\n` +
                `💰 <b>Crypto:</b> Automatic confirmation.\n\n` +
                `🔍 <b>Search:</b> Type a keyword or browse below:`;

            if (payload) {
                const res = await pool.query('SELECT * FROM catalog WHERE id = $1', [payload]);
                const item = res.rows[0];
                if (item) {
                    if (item.stars === 0) return deliverContent(userId, item);
                    return bot.sendPhoto(userId, item.cover_id, {
                        caption: `🔥 **EXCLUSIVE PACK UNLOCK**\n\n${item.caption}`,
                        reply_markup: { inline_keyboard: [[{ text: `Unlock - ${item.stars} ⭐`, callback_data: `buy_${payload}` }]] }
                    });
                }
            }
            
            await bot.sendMessage(userId, welcomeMsg, { parse_mode: 'HTML' });
            const latest = await pool.query('SELECT * FROM catalog ORDER BY id DESC LIMIT 3');
            for (const item of latest.rows) {
                await bot.sendPhoto(userId, item.cover_id, {
                    caption: item.caption,
                    reply_markup: { inline_keyboard: [[{ text: item.stars === 0 ? "FREE ACCESS" : `Unlock - ${item.stars} ⭐`, callback_data: `buy_${item.id}` }]] }
                });
            }
            return;
        }

        // Search
        if (text && !userState[userId]?.awaitingMpesa && String(userId) !== ADMIN_ID) {
            const res = await pool.query('SELECT * FROM catalog WHERE caption ILIKE $1', [`%${text}%`]);
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
            await initiateSTKPush(userId, text, pId);
            userState[userId].awaitingMpesa = false;
            bot.sendMessage(userId, "✅ Check phone for M-Pesa PIN prompt.");
        }
    } catch (e) { console.error("General Error:", e.message); }
});

// -------------------- CALLBACK QUERIES --------------------
bot.on('callback_query', async (q) => {
    const userId = q.from.id;
    const pId = q.data.split('_')[1];
    bot.answerCallbackQuery(q.id);

    try {
        const res = await pool.query('SELECT * FROM catalog WHERE id = $1', [pId]);
        const item = res.rows[0];
        if (!item) return;

        if (item.stars === 0) return deliverContent(userId, item);

        if (q.data.startsWith('buy_')) {
            bot.sendMessage(userId, `💳 **Select Payment:**`, {
                reply_markup: {
                    inline_keyboard: [
                        [{ text: '⭐ Stars', callback_data: `stars_${pId}` }],
                        [{ text: '🇰🇪 M-Pesa', callback_data: `mpesa_${pId}` }],
                        [{ text: '🌍 Crypto', callback_data: `crypto_${pId}` }]
                    ]
                }
            });
        } else if (q.data.startsWith('stars_')) {
            bot.sendInvoice(userId, "Unlock Content", "Premium Link Access", `item*${pId}`, "", "XTR",
                [{ label: "Premium Pack", amount: item.stars }]
            );
        } else if (q.data.startsWith('mpesa_')) {
            userState[userId] = { product: pId, awaitingMpesa: true };
            bot.sendMessage(userId, "📱 **Enter M-Pesa Number:**\nFormat: 2547XXXXXXXX");
        } else if (q.data.startsWith('crypto_')) {
            const params = new URLSearchParams({ cmd: '_pay_simple', merchant: CP_MERCHANT_ID, amountf: item.usd, currency: 'USD', custom: `${userId}|${pId}`, ipn_url: `${WEBAPP_URL}/coinpayments/ipn` });
            bot.sendMessage(userId, "🚀 **Pay with Crypto:**", {
                reply_markup: { inline_keyboard: [[{ text: "Open Checkout", url: `https://www.coinpayments.net/index.php?${params.toString()}` }]] }
            });
        }
    } catch (e) { console.error(e.message); }
});

bot.on('pre_checkout_query', q => bot.answerPreCheckoutQuery(q.id, true));

bot.on('successful_payment', async (msg) => {
    const pId = msg.successful_payment.invoice_payload.split('*')[1];
    const res = await pool.query('SELECT * FROM catalog WHERE id = $1', [pId]);
    await deliverContent(msg.from.id, res.rows[0], "Stars");
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
app.listen(PORT, '0.0.0.0', () => console.log(`🚀 Bot Live on Port ${PORT}`));
