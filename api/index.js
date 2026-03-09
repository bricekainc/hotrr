const TelegramBot = require('node-telegram-bot-api');
const express = require('express');
const axios = require('axios');

const app = express();
app.use(express.json());
app.set('trust proxy', 1);

// Environment Variables
const {
    BOT_TOKEN,
    WEBAPP_URL,
    PAYHERO_API_USERNAME: PAYHERO_USER,
    PAYHERO_API_PASSWORD: PAYHERO_PASS,
    PAYHERO_CHANNEL_ID: PAYHERO_CHANNEL,
    COINPAYMENTS_MERCHANT_ID: CP_MERCHANT_ID
} = process.env;

// --- CATALOG (Array format for Filtering) ---
const CATALOG = [
    {
        id: "v1",
        link: "https://cdn2.bhojpurisex.site/2024/08/Nepali-couple-ke-outdoor-sex-ke-viral-mms-video.mp4",
        cover: "https://lucahmelayu.club/wp-content/uploads/2019/04/Lucah-dalam-bilik.jpg",
        caption: "🔥 Viral Video: Nepali couple doing it outdoor",
        stars: 50, kes: 100, usd: 1, date: 1710000000000
    },
    {
        id: "v2",
        link: "https://v80.erome.com/7067/d8YCY2p5/mBOmnnsf_720p.mp4",
        cover: "https://s80.erome.com/7067/d8YCY2p5/mBOmnnsf.jpg",
        caption: "🔞 Surgery room surprise - unexpected clip 😂",
        stars: 50, kes: 100, usd: 1, date: 1720000000000
    },
    {
        id: "v3",
        link: "https://cdn.rahaporn.com/Rahaporn/Video.mp4",
        cover: "https://blogger.googleusercontent.com/img/b/R29vZ2xl/AVvXsEgJSIj-UeeGZzfnK7XtoOIyUZUTdSGUO_zc-X8U-XCTNK25wZT-yGJJ2zS75_BA7k-A5psXXXe_1onYVMyfhM2p5A4X0bLVKy4LN66jo44664D2OmM5gpZaS2YteRqdLc09FfFuDpGFT00pEDwoCrY07jF_JLRTxW-tvJL5hwPtFA1Q3w7iLrBxFOH3wAg/w640-h474/1.jpg",
        caption: "🍑 Marion Naipei Mega Pack (30+ Videos)",
        stars: 500, kes: 1500, usd: 20, date: 1739000000000
    }
];

const bot = new TelegramBot(BOT_TOKEN, { webHook: true });
let userState = {};

// -------------------- STABILIZED UTILS --------------------
async function safeSendPhoto(userId, item) {
    try {
        await bot.sendPhoto(userId, item.cover, {
            caption: `🔥 **${item.caption}**`,
            parse_mode: 'Markdown',
            reply_markup: { 
                inline_keyboard: [[{ text: `View & Unlock - ${item.stars} ⭐`, callback_data: `view_${item.id}` }]] 
            }
        });
    } catch (e) {
        await bot.sendMessage(userId, `🖼 **[Preview Available]**\n${item.caption}`, {
            reply_markup: { inline_keyboard: [[{ text: `View & Unlock - ${item.stars} ⭐`, callback_data: `view_${item.id}` }]] }
        });
    }
}

async function deliverContent(userId, item, provider) {
    try {
        const opts = {
            caption: `✅ **PAYMENT VERIFIED via ${provider}**\n\n${item.caption}\n\n_Your access link is ready:_`,
            parse_mode: 'Markdown',
            reply_markup: {
                inline_keyboard: [[{ text: "🚀 WATCH / DOWNLOAD NOW", url: item.link }]]
            }
        };
        await bot.sendPhoto(userId, item.cover, opts);
    } catch (e) {
        await bot.sendMessage(userId, `✅ **PAYMENT VERIFIED!**\n\nLink: ${item.link}`);
    }
}

// -------------------- PAYMENT GATEWAYS --------------------
async function initiateSTKPush(userId, phone, productId) {
    const item = CATALOG.find(i => i.id === productId);
    if (!item) return false;
    const auth = Buffer.from(`${PAYHERO_USER}:${PAYHERO_PASS}`).toString('base64');
    try {
        const response = await axios.post('https://backend.payhero.co.ke/api/v2/payments', {
            amount: item.kes,
            phone_number: phone,
            channel_id: Number(PAYHERO_CHANNEL),
            provider: 'm-pesa',
            external_reference: `bot_${userId}_${productId}`,
            callback_url: `${WEBAPP_URL}/payhero/callback`
        }, { headers: { Authorization: `Basic ${auth}` } });
        return response.data.success || response.data.status === 'QUEUED';
    } catch (e) { return false; }
}

// -------------------- WEB UI (5D Glassmorphism) --------------------
app.get('/', (req, res) => {
    res.send(`
    <!DOCTYPE html>
    <html>
    <head>
        <title>H.O.T Red Room | Premium</title>
        <style>
            body { 
                margin: 0; padding: 0;
                background: linear-gradient(45deg, #ff0055, #7000ff, #00d4ff);
                background-size: 400% 400%;
                animation: gradient 15s ease infinite;
                font-family: 'Segoe UI', sans-serif;
                display: flex; justify-content: center; align-items: center; height: 100vh;
            }
            @keyframes gradient { 0% {background-position: 0% 50%;} 50% {background-position: 100% 50%;} 100% {background-position: 0% 50%;} }
            .glass {
                background: rgba(255, 255, 255, 0.1);
                backdrop-filter: blur(20px);
                border: 1px solid rgba(255, 255, 255, 0.2);
                border-radius: 30px;
                padding: 50px;
                text-align: center;
                box-shadow: 0 25px 50px rgba(0,0,0,0.3);
                width: 350px;
            }
            h1 { color: white; text-transform: uppercase; letter-spacing: 5px; text-shadow: 0 5px 15px rgba(0,0,0,0.3); }
            .btn-5d {
                position: relative;
                display: inline-block;
                padding: 20px 40px;
                color: #fff;
                background: #ff0055;
                text-decoration: none;
                font-weight: 900;
                border-radius: 15px;
                text-transform: uppercase;
                transition: 0.2s;
                box-shadow: 0 10px 0 #990033, 0 15px 20px rgba(0,0,0,0.4);
                transform: translateY(-5px);
            }
            .btn-5d:active {
                box-shadow: 0 2px 0 #990033, 0 5px 10px rgba(0,0,0,0.4);
                transform: translateY(3px);
            }
        </style>
    </head>
    <body>
        <div class="glass">
            <h1>RED ROOM</h1>
            <p style="color: white; opacity: 0.8;">Premium Automated Access</p><br>
            <a href="https://t.me/RedRoomAccessbot" class="btn-5d">ENTER BOT</a>
        </div>
    </body>
    </html>
    `);
});

// -------------------- BOT CORE LOGIC --------------------
app.post('/api/webhook', (req, res) => { res.sendStatus(200); bot.processUpdate(req.body); });

bot.on('message', async (msg) => {
    const userId = msg.from.id;
    const text = (msg.text || "").trim();

    if (text.startsWith('/start')) {
        const welcome = `🔞 **WELCOME TO H.O.T RED ROOM PREMIUM**\n\n` +
            `Access our exclusive vault instantly using the steps below:\n\n` +
            `🔹 **STEP 1: BROWSE**\n` +
            `Click the buttons below to filter content by Latest or Oldest.\n\n` +
            `🔹 **STEP 2: SELECT & PAY**\n` +
            `Click "View & Unlock" on any post. We support:\n` +
            `• ⭐️ **Telegram Stars:** Instant access.\n` +
            `• 📲 **M-Pesa:** Enter your number for an STK Push.\n` +
            `• 💰 **Crypto:** Secure checkout via CoinPayments.\n\n` +
            `🔹 **STEP 3: INSTANT DELIVERY**\n` +
            `Once paid, the bot sends you the high-speed link automatically.`;

        await bot.sendMessage(userId, welcome, { 
            parse_mode: 'Markdown',
            reply_markup: {
                inline_keyboard: [
                    [{ text: "🆕 BROWSE LATEST", callback_data: "sort_latest" }],
                    [{ text: "⏳ BROWSE OLDEST", callback_data: "sort_oldest" }]
                ]
            }
        });
        return;
    }

    if (userState[userId]?.awaitingMpesa) {
        const pId = userState[userId].product;
        const ok = await initiateSTKPush(userId, text, pId);
        userState[userId].awaitingMpesa = false;
        bot.sendMessage(userId, ok ? "✅ **STK Push Sent!** Enter your M-Pesa PIN on your phone." : "❌ **STK Push Failed.** Check your number and try again.");
    }
});

bot.on('callback_query', async (q) => {
    const userId = q.from.id;
    const data = q.data;
    bot.answerCallbackQuery(q.id);

    if (data.startsWith('sort_')) {
        const sorted = data === 'sort_latest' ? [...CATALOG].reverse() : [...CATALOG];
        for (const item of sorted) {
            await safeSendPhoto(userId, item);
        }
    } else if (data.startsWith('view_')) {
        const pId = data.split('_')[1];
        const item = CATALOG.find(i => i.id === pId);
        bot.sendMessage(userId, `💳 **Select Payment for:**\n${item.caption}`, {
            reply_markup: {
                inline_keyboard: [
                    [{ text: `⭐ Stars (${item.stars})`, callback_data: `stars_${pId}` }],
                    [{ text: `🇰🇪 M-Pesa (KES ${item.kes})`, callback_data: `mpesa_${pId}` }],
                    [{ text: `🌍 Crypto ($${item.usd})`, callback_data: `crypto_${pId}` }]
                ]
            }
        });
    } else if (data.startsWith('mpesa_')) {
        const pId = data.split('_')[1];
        userState[userId] = { product: pId, awaitingMpesa: true };
        bot.sendMessage(userId, "📱 **Enter your M-Pesa Number:**\nFormat: 2547XXXXXXXX");
    } else if (data.startsWith('crypto_')) {
        const pId = data.split('_')[1];
        const item = CATALOG.find(i => i.id === pId);
        const params = new URLSearchParams({ cmd: '_pay_simple', merchant: CP_MERCHANT_ID, amountf: item.usd, currency: 'USD', custom: `${userId}|${pId}`, ipn_url: `${WEBAPP_URL}/coinpayments/ipn` });
        bot.sendMessage(userId, "🚀 **Crypto Checkout:**", {
            reply_markup: { inline_keyboard: [[{ text: "Open Payment Page", url: `https://www.coinpayments.net/index.php?${params.toString()}` }]] }
        });
    } else if (data.startsWith('stars_')) {
        const pId = data.split('_')[1];
        const item = CATALOG.find(i => i.id === pId);
        bot.sendInvoice(userId, "Unlock Access", "Premium Link", `item*${pId}`, "", "XTR", [{ label: "Access", amount: item.stars }]);
    }
});

// -------------------- CALLBACK HANDLERS --------------------
bot.on('pre_checkout_query', q => bot.answerPreCheckoutQuery(q.id, true));
bot.on('successful_payment', async (msg) => {
    const pId = msg.successful_payment.invoice_payload.split('*')[1];
    deliverContent(msg.from.id, CATALOG.find(i => i.id === pId), "Stars");
});

app.post('/payhero/callback', async (req, res) => {
    if (req.body.status === "Success") {
        const [_, userId, pId] = req.body.external_reference.split('_');
        deliverContent(userId, CATALOG.find(i => i.id === pId), "M-Pesa");
    }
    res.json({ success: true });
});

app.post('/coinpayments/ipn', async (req, res) => {
    if (parseInt(req.body.status) >= 100) {
        const [uId, pId] = req.body.custom.split('|');
        deliverContent(uId, CATALOG.find(i => i.id === pId), "Crypto");
    }
    res.sendStatus(200);
});

const PORT = process.env.PORT || 8000;
app.listen(PORT, '0.0.0.0', () => console.log(`🚀 Red Room Active on ${PORT}`));
