const TelegramBot = require('node-telegram-bot-api');
const express = require('express');
const axios = require('axios');
const mysql = require('mysql2/promise');
const cron = require('node-cron');

const app = express();
app.use(express.json());

// --- CONFIGURATION ---
const {
    STARS_BOT_TOKEN,      // Bot 1: Stars Only
    GATEWAY_BOT_TOKEN,    // Bot 2: Mpesa/Crypto/PayPal
    PAYHERO_USER, PAYHERO_PASS, PAYHERO_CHANNEL,
    CP_MERCHANT_ID, WEBAPP_URL,
    DB_HOST, DB_USER, DB_PASSWORD, DB_NAME
} = process.env;

const PRIVATE_CHAT_ID = "-1003582119576";
const ADMIN_ID = 12345678; // Replace with your Telegram ID for broadcasting

// MySQL Connection
const pool = mysql.createPool({
    host: DB_HOST, user: DB_USER, password: DB_PASSWORD, database: DB_NAME,
    waitForConnections: true, connectionLimit: 15
});

// Membership Plans
const PLANS = [
    { id: "1h", label: "1 Hour", stars: 50, kes: 99, usd: 0.99, ms: 3600000 },
    { id: "1d", label: "1 Day", stars: 150, kes: 299, usd: 2.99, ms: 86400000 },
    { id: "1w", label: "1 Week", stars: 250, kes: 499, usd: 4.99, ms: 604800000 },
    { id: "1m", label: "1 Month", stars: 500, kes: 750, usd: 7.50, ms: 2592000000 }
];

// Initialize Bots
const starsBot = new TelegramBot(STARS_BOT_TOKEN, { polling: true });
const gateBot = new TelegramBot(GATEWAY_BOT_TOKEN, { polling: true });
const bots = [starsBot, gateBot];

// --- CORE LOGIC ---

bots.forEach((bot, index) => {
    // 1. Log Users for Broadcasting
    bot.on('message', async (msg) => {
        if (!msg.from) return;
        await pool.execute('INSERT IGNORE INTO users (user_id, username) VALUES (?, ?)', 
            [msg.from.id, msg.from.username || 'Anonymous']);
        
        const text = msg.text || "";
        
        // Admin Broadcast Command: /bc Hello World
        if (text.startsWith('/bc') && msg.from.id == ADMIN_ID) {
            const broadcastText = text.replace('/bc', '').trim();
            const [allUsers] = await pool.execute('SELECT user_id FROM users');
            let count = 0;
            for (const u of allUsers) {
                try { await bot.sendMessage(u.user_id, broadcastText); count++; } catch(e){}
            }
            return bot.sendMessage(ADMIN_ID, `📢 Broadcast sent to ${count} users.`);
        }

        if (text.startsWith('/start')) {
            sendWelcome(bot, msg.from.id, index);
        }
    });

    // 2. Handle Plan Selection
    bot.on('callback_query', async (q) => {
        const userId = q.from.id;
        const data = q.data;
        bot.answerCallbackQuery(q.id);

        if (data === 'show_plans') {
            const buttons = PLANS.map(p => {
                const cost = index === 0 ? `${p.stars} ⭐` : `KES ${p.kes} / $${p.usd}`;
                return [{ text: `${p.label} - ${cost}`, callback_data: `pay_${p.id}` }];
            });
            bot.sendMessage(userId, "💎 **Choose your access duration:**", {
                parse_mode: 'Markdown',
                reply_markup: { inline_keyboard: buttons }
            });
        }

        if (data.startsWith('pay_')) {
            const planId = data.split('_')[1];
            const plan = PLANS.find(p => p.id === planId);
            
            if (index === 0) { // Stars Bot
                bot.sendInvoice(userId, "Red Room Entry", `${plan.label} Access`, `plan*${plan.id}`, "", "XTR", [{ label: "Pay", amount: plan.stars }]);
            } else { // Gateway Bot
                bot.sendMessage(userId, `💳 **Select Method for ${plan.label} Access:**`, {
                    reply_markup: { inline_keyboard: [
                        [{ text: "🇰🇪 M-Pesa", callback_data: `mpesa_${plan.id}` }],
                        [{ text: "🌍 Crypto/PayPal", callback_data: `crypto_${plan.id}` }]
                    ]}
                });
            }
        }

        // Mpesa Prompt
        if (data.startsWith('mpesa_')) {
            bot.sendMessage(userId, "📱 **Enter your M-Pesa number (2547XXXXXXXX):**");
            bot.once('message', async (msg) => {
                const phone = msg.text.trim();
                const plan = PLANS.find(p => p.id === data.split('_')[1]);
                initiateMpesa(userId, phone, plan);
            });
        }
    });
});

// --- HELPERS ---

function sendWelcome(bot, userId, index) {
    const type = index === 0 ? "STARS EDITION" : "GATEWAY EDITION";
    const msg = `🔞 **WELCOME TO THE RED ROOM (${type})**\n\nInstant automated entry to the most exclusive vault.\n\nClick below to view plans:`;
    bot.sendMessage(userId, msg, {
        parse_mode: 'Markdown',
        reply_markup: { inline_keyboard: [[{ text: "🎟 VIEW PLANS & JOIN", callback_data: "show_plans" }]] }
    });
}

async function grantAccess(botIndex, userId, planId) {
    const plan = PLANS.find(p => p.id === planId);
    const bot = bots[botIndex];
    try {
        const link = await bot.createChatInviteLink(PRIVATE_CHAT_ID, { member_limit: 1 });
        const expiry = new Date(Date.now() + plan.ms);
        
        await pool.execute(
            'INSERT INTO memberships (user_id, chat_id, bot_index, expiry_date) VALUES (?, ?, ?, ?)',
            [userId, PRIVATE_CHAT_ID, botIndex, expiry]
        );

        await bot.sendMessage(userId, `✅ **PAYMENT SUCCESSFUL!**\n\nYour ${plan.label} access link is ready:\n${link.invite_link}\n\n_Expires: ${expiry.toLocaleString()}_`, { parse_mode: 'Markdown' });
    } catch (e) {
        bot.sendMessage(userId, "❌ Error creating link. Contact Admin.");
    }
}

// --- GATEWAYS & WEBHOOKS ---

starsBot.on('pre_checkout_query', q => starsBot.answerPreCheckoutQuery(q.id, true));
starsBot.on('successful_payment', (msg) => {
    const planId = msg.successful_payment.invoice_payload.split('*')[1];
    grantAccess(0, msg.from.id, planId);
});

async function initiateMpesa(userId, phone, plan) {
    const auth = Buffer.from(`${PAYHERO_USER}:${PAYHERO_PASS}`).toString('base64');
    try {
        await axios.post('https://backend.payhero.co.ke/api/v2/payments', {
            amount: plan.kes, phone_number: phone, channel_id: Number(PAYHERO_CHANNEL),
            provider: 'm-pesa', external_reference: `gate_${userId}_${plan.id}`,
            callback_url: `${WEBAPP_URL}/payhero/callback`
        }, { headers: { Authorization: `Basic ${auth}` } });
        gateBot.sendMessage(userId, "⏳ **STK Push Sent.** Enter your M-Pesa PIN.");
    } catch (e) { gateBot.sendMessage(userId, "❌ STK Push failed."); }
}

app.post('/payhero/callback', async (req, res) => {
    if (req.body.status === "Success") {
        const [_, uId, pId] = req.body.external_reference.split('_');
        grantAccess(1, uId, pId);
    }
    res.sendStatus(200);
});

// --- AUTO-REMOVE CRON ---
cron.schedule('* * * * *', async () => {
    const [expired] = await pool.execute(
        'SELECT * FROM memberships WHERE expiry_date <= NOW() AND status = "active"'
    );

    for (const m of expired) {
        try {
            const executor = bots[m.bot_index];
            await executor.banChatMember(m.chat_id, m.user_id);
            await executor.unbanChatMember(m.chat_id, m.user_id); // Allow re-entry later
            
            await pool.execute('UPDATE memberships SET status = "expired" WHERE id = ?', [m.id]);
            await executor.sendMessage(m.user_id, "⚠️ **Access Expired:** Your time in the Red Room is up. Renew your plan to rejoin.");
        } catch (e) { console.error("Kick fail:", e.message); }
    }
});

const PORT = process.env.PORT || 8000;
app.listen(PORT, () => console.log(`🚀 Multi-Bot Red Room Engine Active on ${PORT}`));
