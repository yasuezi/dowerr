function escapeMarkdownV2(text) {
    return text.replace(/[_*[\]()~`>#+\-=|{}.!]/g, '\\$&');
}

function formatTransactionLog(data) {
    const { phoneNumber, amount, reference, date, username, userId } = data;

    const userLine = username
        ? `🔖 Username: @${username}`
        : '🔖 Tidak ada username';

    const message = `
╭─〔 TRANSAKSI BERHASIL 〕────────╮
│ 💰 Jumlah: Rp ${amount}
│ 📱 Nomor: ${phoneNumber}
│ 🧾 Referensi: ${reference}
│ ⏰ Waktu: ${date}
│
├─〔 INFO USER 〕─────────────────
│ 👤 ID: ${userId}
│ ${userLine}
╰───────────────────────────────╯`;

    return escapeMarkdownV2(message);
}

async function sendTransactionLog(data) {
    try {
        const logMessage = formatTransactionLog(data);

        await bot.telegram.sendMessage(CONFIG.loggingGroupId, logMessage, {
            parse_mode: 'MarkdownV2'
        });

        console.log(`✅ Log berhasil dikirim untuk user ${data.userId}`);
    } catch (error) {
        console.error('❌ Gagal kirim log transaksi:', error);
    }
}
