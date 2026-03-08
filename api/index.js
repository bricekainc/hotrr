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

// --- HARDCODED CATALOG ---
// You can add more videos here manually whenever you want.
const CATALOG = {
    "v1": {
        id: "v1",
        link: "https://cdn2.bhojpurisex.site/2024/08/Nepali-couple-ke-outdoor-sex-ke-viral-mms-video.mp4",
        cover: "https://lucahmelayu.club/wp-content/uploads/2019/04/Lucah-dalam-bilik.jpg",
        caption: "🔥 Viral Video: Nepali couple doing it outdoor ",
        stars: 50,
        kes: 100,
        usd: 1
    },
    "v2": {
        id: "v2",
        link: "https://v80.erome.com/7067/d8YCY2p5/mBOmnnsf_720p.mp4",
        cover: "https://s80.erome.com/7067/d8YCY2p5/mBOmnnsf.jpg", // Using the photo you provided
        caption: "🔞Finally found the clip… not gonna lie, the surgery room caught me off guard 😂",
        stars: 50,
        kes: 100,
        usd: 1
    },
    "v3": {
        id: "v3",
        link: "https://cdn.rahaporn.com/Rahaporn/Marion%20naipei%20porn%20videos%20Watch%20jelly%20kunt%20New%20Porn%20Video%20Stripchat%20-%20ebony%2C%20deepthroat%2C%20kissing%2C%20cowgirl%2C%20brunettes-young.mp4.mp4",
        cover: "https://blogger.googleusercontent.com/img/b/R29vZ2xl/AVvXsEgJSIj-UeeGZzfnK7XtoOIyUZUTdSGUO_zc-X8U-XCTNK25wZT-yGJJ2zS75_BA7k-A5psXXXe_1onYVMyfhM2p5A4X0bLVKy4LN66jo44664D2OmM5gpZaS2YteRqdLc09FfFuDpGFT00pEDwoCrY07jF_JLRTxW-tvJL5hwPtFA1Q3w7iLrBxFOH3wAg/w640-h474/1.jpg", // Primary cover
        album: ["https://www.bana.co.ke/wp-content/uploads/2026/01/twerking-marion-naipei-viral-video.jpg", "https://venasnews.co.ke/wp-content/uploads/2026/01/marion-naipei1.jpg", "https://www.bana.co.ke/wp-content/uploads/2026/01/marion-naipei-trending-video-photo.jpg"],
        caption: "🍑 Marion Naipei Mega Pack (30+ Videos)",
        stars: 500,
        kes: 1500,
        usd: 20
    }
};

const bot = new TelegramBot(BOT_TOKEN, { webHook: true });
let userState = {};

// -------------------- DELIVERY LOGIC --------------------
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
        await bot.sendMessage(userId, "❌ Delivery error. Please contact support with your payment proof.");
    }
}

// -------------------- M-PESA GATEWAY --------------------
async function initiateSTKPush(userId, phone, productId) {
    const item = CATALOG[productId];
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
    } catch { return false; }
}

// -------------------- WEBHOOKS --------------------
app.post('/api/webhook', (req, res) => {
    res.sendStatus(200);
    bot.processUpdate(req.body);
});

app.get('/', (req, res) => {
    res.send(`
    <!DOCTYPE html>
    <html>
    <head>
        <title>H.O.T Red Room | Premium</title>
        <style>
            :root { --bg: #fdfd96; --primary: #ff5c5c; --dark: #000; --blue: #5c7cff; }
            body { background: var(--bg); font-family: 'Arial Black', sans-serif; padding: 40px; display: flex; flex-direction: column; align-items: center; text-align: center; }
            .card { background: white; border: 5px solid var(--dark); box-shadow: 15px 15px 0px var(--dark); padding: 30px; max-width: 500px; }
            h1 { text-transform: uppercase; font-size: 3rem; background: var(--primary); padding: 10px; border: 5px solid var(--dark); transform: rotate(-2deg); }
            .btn { background: var(--blue); color: white; border: 5px solid var(--dark); padding: 20px; text-decoration: none; display: block; font-weight: 900; box-shadow: 5px 5px 0px var(--dark); margin-top: 20px; }
        </style>
    </head>
    <body>
        <h1>RED ROOM ACCESS</h1>
        <div class="card">
            <p>1. Browse Content in Bot<br>2. Pay via Stars/M-Pesa/Crypto<br>3. Instant Delivery</p>
            <a href="https://t.me/RedRoomAccessbot" class="btn">LAUNCH TELEGRAM BOT</a>
        </div>
    </body>
    </html>
    `);
});

// -------------------- BOT LOGIC --------------------
bot.on('message', async (msg) => {
    const userId = msg.from.id;
    const text = (msg.text || "").trim();

    if (text.startsWith('/start')) {
        const welcome = `🔞 <b>Welcome to H.O.T Red Room Premium</b>\n\n` +
            `Everything you see here is delivered <b>instantly</b> once unlocked.\n\n` +
            `⭐️ <b>Telegram Stars:</b> Recommended (Instant).\n` +
            `📲 <b>M-Pesa:</b> Automatic STK push.\n` +
            `💰 <b>Crypto:</b> Secure checkout.\n\n` +
            `Click below to see our available collection:`;

        await bot.sendMessage(userId, welcome, { 
            parse_mode: 'HTML',
            reply_markup: {
                inline_keyboard: [[{ text: "🔓 UNLOCK EVERYTHING / BROWSE", callback_data: "browse_all" }]]
            }
        });
        return;
    }

    if (userState[userId]?.awaitingMpesa) {
        const pId = userState[userId].product;
        const ok = await initiateSTKPush(userId, text, pId);
        userState[userId].awaitingMpesa = false;
        bot.sendMessage(userId, ok ? "✅ STK Push sent! Enter PIN on phone." : "❌ M-Pesa failed.");
    }
});

bot.on('callback_query', async (q) => {
    const userId = q.from.id;
    const data = q.data;
    bot.answerCallbackQuery(q.id);

    if (data === "browse_all") {
        for (const key in CATALOG) {
            const item = CATALOG[key];
            await bot.sendPhoto(userId, item.cover, {
                caption: `🔥 ${item.caption}`,
                reply_markup: { inline_keyboard: [[{ text: `View & Unlock - ${item.stars} ⭐`, callback_data: `view_${item.id}` }]] }
            });
        }
    } else if (data.startsWith('view_')) {
        const pId = data.split('_')[1];
        const item = CATALOG[pId];
        bot.sendMessage(userId, `💳 **Select Payment for:**\n${item.caption}`, {
            reply_markup: {
                inline_keyboard: [
                    [{ text: `⭐ Stars (${item.stars})`, callback_data: `stars_${pId}` }],
                    [{ text: `🇰🇪 M-Pesa (KES ${item.kes})`, callback_data: `mpesa_${pId}` }],
                    [{ text: `🌍 Crypto ($${item.usd})`, callback_data: `crypto_${pId}` }]
                ]
            }
        });
    } else if (data.startsWith('stars_')) {
        const pId = data.split('_')[1];
        const item = CATALOG[pId];
        bot.sendInvoice(userId, "Unlock Access", "Premium Link", `item*${pId}`, "", "XTR", [{ label: "Access", amount: item.stars }]);
    } else if (data.startsWith('mpesa_')) {
        const pId = data.split('_')[1];
        userState[userId] = { product: pId, awaitingMpesa: true };
        bot.sendMessage(userId, "📱 Send M-Pesa Number (254...):");
    } else if (data.startsWith('crypto_')) {
        const pId = data.split('_')[1];
        const item = CATALOG[pId];
        const params = new URLSearchParams({ cmd: '_pay_simple', merchant: CP_MERCHANT_ID, amountf: item.usd, currency: 'USD', custom: `${userId}|${pId}`, ipn_url: `${WEBAPP_URL}/coinpayments/ipn` });
        bot.sendMessage(userId, "🚀 **Crypto Checkout:**", {
            reply_markup: { inline_keyboard: [[{ text: "Open Payment Page", url: `https://www.coinpayments.net/index.php?${params.toString()}` }]] }
        });
    }
});

// -------------------- HANDLERS --------------------
bot.on('pre_checkout_query', q => bot.answerPreCheckoutQuery(q.id, true));
bot.on('successful_payment', async (msg) => {
    const pId = msg.successful_payment.invoice_payload.split('*')[1];
    deliverContent(msg.from.id, CATALOG[pId], "Telegram Stars");
});

app.post('/payhero/callback', async (req, res) => {
    if (req.body.status === "Success") {
        const [_, userId, pId] = req.body.external_reference.split('_');
        deliverContent(userId, CATALOG[pId], "M-Pesa");
    }
    res.json({ success: true });
});

app.post('/coinpayments/ipn', async (req, res) => {
    if (parseInt(req.body.status) >= 100) {
        const [uId, pId] = req.body.custom.split('|');
        deliverContent(uId, CATALOG[pId], "Crypto");
    }
    res.sendStatus(200);
});

const PORT = process.env.PORT || 8000;
app.listen(PORT, '0.0.0.0', () => console.log(`🚀 Bot Live on ${PORT}`));
