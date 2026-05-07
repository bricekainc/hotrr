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
    COINPAYMENTS_MERCHANT_ID: CP_MERCHANT_ID,
    PRIVATE_CHAT_ID
} = process.env;

const bot = new TelegramBot(BOT_TOKEN, { webHook: true });
let userState = {};

// --- CATALOG ---
const CATALOG = [
    { id: "plan_1h", caption: "🎟 Red Room Membership: 1 Hour", stars: 50, kes: 99, usd: 0.99, isMembership: true, durationMs: 3600000 },
    { id: "plan_1d", caption: "🎟 Red Room Membership: 1 Day", stars: 150, kes: 299, usd: 2.99, isMembership: true, durationMs: 86400000 },
    { id: "plan_1w", caption: "🎟 Red Room Membership: 1 Week", stars: 250, kes: 499, usd: 4.99, isMembership: true, durationMs: 604800000 },
    { id: "plan_1m", caption: "🎟 Red Room Membership: 1 Month", stars: 350, kes: 699, usd: 6.99, isMembership: true, durationMs: 2592000000 },
    { id: "plan_1y", caption: "🎟 Red Room Membership: 1 Year", stars: 500, kes: 999, usd: 9.99, isMembership: true, durationMs: 31536000000 },
    { id: "v1", link: "https://cdn2.bhojpurisex.site/2024/08/Nepali-couple-ke-outdoor-sex-ke-viral-mms-video.mp4", cover: "https://pbs.twimg.com/ext_tw_video_thumb/1354298913100943361/pu/img/vnLdEeIgwLjWJmJm.jpg", caption: "🔥 Viral Video: Nepali couple doing it outdoor", stars: 50, kes: 100, usd: 1 },
    { id: "v2", link: "https://v80.erome.com/7067/d8YCY2p5/mBOmnnsf_720p.mp4", cover: "https://s80.erome.com/7067/d8YCY2p5/mBOmnnsf.jpg", caption: "🔞 Surgery room surprise - unexpected clip 😂", stars: 50, kes: 100, usd: 1 },
    { id: "v3", link: "https://cdn.rahaporn.com/Rahaporn/Video.mp4", cover: "https://blogger.googleusercontent.com/img/b/R29vZ2xl/AVvXsEgJSIj-UeeGZzfnK7XtoOIyUZUTdSGUO_zc-X8U-XCTNK25wZT-yGJJ2zS75_BA7k-A5psXXXe_1onYVMyfhM2p5A4X0bLVKy4LN66jo44664D2OmM5gpZaS2YteRqdLc09FfFuDpGFT00pEDwoCrY07jF_JLRTxW-tvJL5hwPtFA1Q3w7iLrBxFOH3wAg/w640-h474/1.jpg", caption: "🍑 Marion Naipei Mega Pack (30+ Videos)", stars: 500, kes: 1500, usd: 20 },
    { id: "v5", link: "https://video.twimg.com/amplify_video/1982752943913717760/vid/avc1/472x856/McnCpW8hFvS0OA3r.mp4", cover: "https://pbs.twimg.com/amplify_video_thumb/1982752943913717760/img/4vWa8GpadB6o6mCT.jpg", caption: "🔞 Purity Kendi - Mama Mboga Meru Trending 😂", stars: 10, kes: 30, usd: 0.3 }
];

// -------------------- UTILS --------------------
async function safeSendPhoto(userId, item) {
    try {
        await bot.sendPhoto(userId, item.cover, {
            caption: `🔥 **${item.caption}**`,
            parse_mode: 'Markdown',
            reply_markup: { inline_keyboard: [[{ text: `View & Unlock - ${item.stars} ⭐`, callback_data: `view_${item.id}` }]] }
        });
    } catch (e) {
        await bot.sendMessage(userId, `🖼 **[Preview Available]**\n${item.caption}`, {
            reply_markup: { inline_keyboard: [[{ text: `View & Unlock - ${item.stars} ⭐`, callback_data: `view_${item.id}` }]] }
        });
    }
}

async function deliverContent(userId, item, provider) {
    try {
        if (item.isMembership) {
            const link = await bot.createChatInviteLink(PRIVATE_CHAT_ID, { member_limit: 1 });
            await bot.sendMessage(userId, `✅ **MEMBERSHIP ACTIVE**\n\nPlan: ${item.caption}\n\n[CLICK HERE TO JOIN RED ROOM](${link.invite_link})`, { parse_mode: 'Markdown' });
            
            // Set Auto-removal timer
            setTimeout(async () => {
                try {
                    await bot.banChatMember(PRIVATE_CHAT_ID, userId);
                    await bot.unbanChatMember(PRIVATE_CHAT_ID, userId);
                    await bot.sendMessage(userId, "⚠️ **Notice:** Your Red Room membership has expired. Renew to rejoin!");
                } catch (err) { console.error("Kick Error:", err); }
            }, item.durationMs);

        } else {
            await bot.sendPhoto(userId, item.cover, {
                caption: `✅ **PAYMENT VERIFIED!**\n\n${item.caption}`,
                reply_markup: { inline_keyboard: [[{ text: "🚀 WATCH NOW", url: item.link }]] }
            });
        }
    } catch (e) {
        bot.sendMessage(userId, `✅ Payment Success! Error generating link. Contact Admin @tookarius.`);
    }
}

async function initiateSTKPush(userId, phone, productId) {
    const item = CATALOG.find(i => i.id === productId);
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

// -------------------- WEB UI --------------------
app.get('/', (req, res) => {
    res.send(`<!DOCTYPE html><html><head><title>H.O.T Red Room</title><style>
        body { margin:0; background:#0a0a0a; color:white; font-family:sans-serif; display:flex; justify-content:center; align-items:center; height:100vh; overflow:hidden; }
        .glass { background:rgba(255,255,255,0.05); backdrop-filter:blur(15px); padding:40px; border-radius:20px; border:1px solid rgba(255,255,255,0.1); text-align:center; max-width:400px; }
        h1 { color:#ff0055; letter-spacing:3px; }
        .btn { display:inline-block; margin-top:20px; padding:15px 30px; background:#ff0055; color:white; text-decoration:none; border-radius:10px; font-weight:bold; box-shadow:0 10px 20px rgba(255,0,85,0.3); }
    </style></head><body><div class="glass"><h1>RED ROOM</h1><p>The #1 Automated Premium Telegram Community for exclusive viral content and leaks.</p>
    <ul style="text-align:left; font-size:14px; opacity:0.8;"><li>Instant Automated Access</li><li>M-Pesa, Stars & Crypto Support</li><li>Daily Premium Updates</li></ul>
    <a href="https://t.me/RedRoomAccessbot" class="btn">LAUNCH BOT</a></div></body></html>`);
});

// -------------------- BOT CORE --------------------
app.post('/api/webhook', (req, res) => { res.sendStatus(200); bot.processUpdate(req.body); });

bot.on('message', async (msg) => {
    const userId = msg.from.id;
    const text = (msg.text || "").trim();
    if (text.startsWith('/start')) {
        await bot.sendMessage(userId, `🔞 **H.O.T RED ROOM PREMIUM**\n\nChoose your access level:`, {
            parse_mode: 'Markdown',
            reply_markup: { inline_keyboard: [
                [{ text: "🔴 JOIN THE RED ROOM (FULL ACCESS)", callback_data: "membership_plans" }],
                [{ text: "🆕 BROWSE LATEST", callback_data: "sort_latest" }],
                [{ text: "⏳ BROWSE OLDEST", callback_data: "sort_oldest" }]
            ]}
        });
        return;
    }
    if (userState[userId]?.awaitingMpesa) {
        const ok = await initiateSTKPush(userId, text, userState[userId].product);
        userState[userId].awaitingMpesa = false;
        bot.sendMessage(userId, ok ? "✅ **STK Push Sent!** Enter PIN on your phone." : "❌ **Failed.** Try again.");
    }
});

bot.on('callback_query', async (q) => {
    const userId = q.from.id;
    const data = q.data;
    bot.answerCallbackQuery(q.id);

    if (data === 'membership_plans') {
        const buttons = CATALOG.filter(i => i.isMembership).map(p => [{ text: `${p.caption.split(': ')[1]} - KES ${p.kes}`, callback_data: `view_${p.id}` }]);
        bot.sendMessage(userId, "💎 **Select Plan:**", { reply_markup: { inline_keyboard: buttons }});
    } else if (data.startsWith('sort_')) {
        const sorted = data === 'sort_latest' ? [...CATALOG].filter(i => !i.isMembership).reverse() : [...CATALOG].filter(i => !i.isMembership);
        for (const item of sorted) await safeSendPhoto(userId, item);
    } else if (data.startsWith('view_')) {
        const pId = data.split('_')[1];
        const item = CATALOG.find(i => i.id === pId);
        bot.sendMessage(userId, `💳 **Pay for ${item.id.includes('plan') ? 'Membership' : 'Clip'}:**`, {
            reply_markup: { inline_keyboard: [
                [{ text: `⭐ Stars (${item.stars})`, callback_data: `stars_${pId}` }],
                [{ text: `🇰🇪 M-Pesa (KES ${item.kes})`, callback_data: `mpesa_${pId}` }],
                [{ text: `🌍 Crypto ($${item.usd})`, callback_data: `crypto_${pId}` }]
            ]}
        });
    } else if (data.startsWith('mpesa_')) {
        userState[userId] = { product: data.split('_')[1], awaitingMpesa: true };
        bot.sendMessage(userId, "📱 **Enter M-Pesa Number (2547XXXXXXXX):**");
    } else if (data.startsWith('crypto_')) {
        const item = CATALOG.find(i => i.id === data.split('_')[1]);
        const params = new URLSearchParams({ cmd:'_pay_simple', merchant:CP_MERCHANT_ID, amountf:item.usd, currency:'USD', item_name:item.id, custom:`${userId}|${item.id}`, ipn_url:`${WEBAPP_URL}/coinpayments/ipn` });
        bot.sendMessage(userId, "🚀 **Crypto Checkout:**", { reply_markup: { inline_keyboard: [[{ text: "Pay via CoinPayments", url: `https://www.coinpayments.net/index.php?${params.toString()}` }]] }});
    } else if (data.startsWith('stars_')) {
        const item = CATALOG.find(i => i.id === data.split('_')[1]);
        bot.sendInvoice(userId, "Red Room Access", "Digital Content", `item*${item.id}`, "", "XTR", [{ label: "Pay", amount: item.stars }]);
    }
});

bot.on('pre_checkout_query', q => bot.answerPreCheckoutQuery(q.id, true));
bot.on('successful_payment', (msg) => {
    deliverContent(msg.from.id, CATALOG.find(i => i.id === msg.successful_payment.invoice_payload.split('*')[1]), "Stars");
});

app.post('/payhero/callback', (req, res) => {
    if (req.body.status === "Success") {
        const [_, uId, pId] = req.body.external_reference.split('_');
        deliverContent(uId, CATALOG.find(i => i.id === pId), "M-Pesa");
    }
    res.json({ success: true });
});

app.post('/coinpayments/ipn', (req, res) => {
    if (parseInt(req.body.status) >= 100) {
        const [uId, pId] = req.body.custom.split('|');
        deliverContent(uId, CATALOG.find(i => i.id === pId), "Crypto");
    }
    res.sendStatus(200);
});

const PORT = process.env.PORT || 8000;
app.listen(PORT, '0.0.0.0', () => console.log(`🚀 Red Room Active`));
