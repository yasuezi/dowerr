const { Client } = require("@mengkodingan/ckptw");
const axios = require('axios');
const QRCode = require('qrcode');
const fs = require('fs');
const path = require('path');

const LOG_FILE = path.join(__dirname, 'bot.log');

// Konfigurasi QRIS Statis dan Okeconnect
const QRIS_CONFIG = {
const QRISPayment = require('qris-payment');
const fs = require('fs');

const config = {
    merchantId: 'OK924370',
    apiKey: '63748271745564351924370OKCT4FE1C28580CACFD63EDF14E265CE0218',
    baseQrString: '00020101021126670016COM.NOBUBANK.WWW01189360050300000879140214131379338056960303UMI51440014ID.CO.QRIS.WWW0215ID20232438786910303UMI5204511153033605802ID5910VPN STORES6006JEMBER61056811162070703A016304EEB8',
    logoPath: 'path/to/logo.png'
};

const qris = new QRISPayment(config);

async function main() {
    try {
        // Generate QR
        const { qrString, qrBuffer } = await qris.generateQR(10000);
        fs.writeFileSync('qr.png', qrBuffer);
        console.log('QR String:', qrString);

        // Cek pembayaran
        const result = await qris.checkPayment('REF123', 10000);
        console.log('Status pembayaran:', result);
    } catch (error) {
        console.error('Error:', error.message);
    }
}

main();

// Konfigurasi Rate Limiting
const RATE_LIMIT = {
    maxRequests: 5,
    windowMs: 60 * 60 * 1000, // 1 jam
    otpRequests: 3,
    otpWindowMs: 5 * 60 * 1000 // 5 menit
};

const VALIDATION_CONFIG = {
    phoneNumberRegex: /^[0-9]{10,13}$/,
    otpLength: 6,
    maxRetries: 3,
    retryDelay: 1000,
    apiTimeout: 10000
};

const ADMIN_CONFIG = {
    adminNumbers: ['628136852639'], // Nomor admin yang diizinkan
    maintenanceMode: false
};

function generateQrString(amount) {
    const qrisBase = QRIS_CONFIG.baseQrString.slice(0, -4).replace("010211", "010212");
    const nominalStr = amount.toString();
    const nominalTag = `54${nominalStr.length.toString().padStart(2, '0')}${nominalStr}`;
    const insertPosition = qrisBase.indexOf("5802ID");
    if (insertPosition === -1) {
        throw new Error("Format QRIS tidak valid, tidak ditemukan tag '5802ID'");
    }
    const qrisWithNominal = qrisBase.slice(0, insertPosition) + nominalTag + qrisBase.slice(insertPosition);
    const checksum = calculateCRC16(qrisWithNominal);
    return qrisWithNominal + checksum;
}

function calculateCRC16(str) {
    let crc = 0xFFFF;
    for (let i = 0; i < str.length; i++) {
        crc ^= str.charCodeAt(i) << 8;
        for (let j = 0; j < 8; j++) {
            if (crc & 0x8000) {
                crc = (crc << 1) ^ 0x1021;
            } else {
                crc = crc << 1;
            }
        }
    }
    return (crc & 0xFFFF).toString(16).toUpperCase().padStart(4, '0');
}

function log(level, message, data = {}) {
    const timestamp = new Date().toISOString();
    const logMessage = `[${timestamp}] [${level}] ${message} ${Object.keys(data).length ? JSON.stringify(data, null, 2) : ''}`;
    const colors = {
        DEBUG: '\x1b[36m', // Cyan
        INFO: '\x1b[32m',  // Green
        WARN: '\x1b[33m',  // Yellow
        ERROR: '\x1b[31m'  // Red
    };
    console.log(`${colors[level]}${logMessage}\x1b[0m`);
    fs.appendFileSync(LOG_FILE, logMessage + '\n');
}
async function handleError(operation, error, context = {}) {
    const errorData = {
        message: error.message,
        stack: error.stack,
        response: error.response?.data,
        status: error.response?.status,
        ...context
    };
    
    log('ERROR', `Operation failed: ${operation}`, errorData);
    throw new Error(`Gagal ${operation}: ${error.message}`);
}

const OTP_DATA_FILE = path.join(__dirname, 'otp_data.json');

function loadOtpData() {
    try {
        if (fs.existsSync(OTP_DATA_FILE)) {
            const data = fs.readFileSync(OTP_DATA_FILE, 'utf8');
            const parsedData = JSON.parse(data);
            log('DEBUG', 'OTP data loaded successfully', { entries: Object.keys(parsedData).length });
            return parsedData;
        }
        log('INFO', 'No OTP data file found, returning empty object');
        return {};
    } catch (error) {
        log('ERROR', 'Failed to load OTP data', { error: error.message });
        return {};
    }
}

function saveOtpData(data) {
    try {
        fs.writeFileSync(OTP_DATA_FILE, JSON.stringify(data, null, 2));
        log('DEBUG', 'OTP data saved successfully', { entries: Object.keys(data).length });
    } catch (error) {
        log('ERROR', 'Failed to save OTP data', { error: error.message });
        throw error;
    }
}

function updateUserOtpData(phoneNumber, data) {
    try {
        const otpData = loadOtpData();
        const oldData = otpData[phoneNumber];
        
        otpData[phoneNumber] = {
            ...data,
            timestamp: Date.now(),
            updated_at: new Date().toISOString()
        };
        
        saveOtpData(otpData);
        log('INFO', 'User OTP data updated', { 
            phoneNumber,
            oldStatus: oldData?.status,
            newStatus: data.status
        });
    } catch (error) {
        log('ERROR', 'Failed to update user OTP data', { 
            phoneNumber,
            error: error.message 
        });
        throw error;
    }
}

function validateInput(input, type) {
    switch (type) {
        case 'phone':
            if (!VALIDATION_CONFIG.phoneNumberRegex.test(input)) {
                throw new Error('Format nomor HP tidak valid. Gunakan 10-13 digit angka.');
            }
            return input.replace(/[^0-9]/g, '');
        case 'otp':
            if (input.length !== VALIDATION_CONFIG.otpLength) {
                throw new Error(`Kode OTP harus ${VALIDATION_CONFIG.otpLength} digit.`);
            }
            if (!/^\d+$/.test(input)) {
                throw new Error('Kode OTP harus berupa angka.');
            }
            return input;
        default:
            return input;
    }
}

async function retryApiCall(apiCall, maxRetries = VALIDATION_CONFIG.maxRetries) {
    let lastError;
    for (let i = 0; i < maxRetries; i++) {
        try {
            return await apiCall();
        } catch (error) {
            lastError = error;
            if (i < maxRetries - 1) {
                await new Promise(resolve => setTimeout(resolve, VALIDATION_CONFIG.retryDelay * (i + 1)));
            }
        }
    }
    throw lastError;
}

function checkDataConsistency(userData) {
    if (!userData) return false;
    
    const requiredFields = ['nomor_hp', 'status', 'timestamp'];
    const hasRequiredFields = requiredFields.every(field => field in userData);
    
    if (!hasRequiredFields) return false;
    const now = Date.now();
    const dataAge = now - userData.timestamp;
    if (dataAge > 60 * 60 * 1000) return false;
    
    return true;
}

function sanitizeInput(input) {
    return input
        .replace(/[<>]/g, '') 
        .trim()
        .slice(0, 100);
}

function getUserOtpData(phoneNumber) {
    try {
        const otpData = loadOtpData();
        const userData = otpData[phoneNumber];
        
        if (!checkDataConsistency(userData)) {
            delete otpData[phoneNumber];
            saveOtpData(otpData);
            return null;
        }
        
        return userData;
    } catch (error) {
        log('ERROR', 'Failed to get user OTP data', { 
            phoneNumber,
            error: error.message 
        });
        return null;
    }
}

function deleteUserOtpData(phoneNumber) {
    try {
        const otpData = loadOtpData();
        const oldData = otpData[phoneNumber];
        
        if (oldData) {
            delete otpData[phoneNumber];
            saveOtpData(otpData);
            log('INFO', 'User OTP data deleted', { 
                phoneNumber,
                status: oldData.status
            });
        }
    } catch (error) {
        log('ERROR', 'Failed to delete user OTP data', { 
            phoneNumber,
            error: error.message 
        });
        throw error;
    }
}

const DOR_CONFIG = {
    apiUrl: 'https://api.tuyull.my.id/api/v1/dor',
    apiKey: '0a1ccba4-e6fc-498c-af2f-5f889c765aaa' // Ganti dengan api key Anda
}

const OTP_CONFIG = {
    requestUrl: 'https://api.tuyull.my.id/api/v1/minta-otp',
    verifyUrl: 'https://api.tuyull.my.id/api/v1/verif-otp'
}

const bot = new Client({
    prefix: ".",
    phoneNumber: "6287840812718",
    usePairingCode: true,
    printQRInTerminal: false,
    WAVersion: [2, 3000, 1015901307],
    selfReply: true
});

function checkRateLimit(phoneNumber, type = 'general') {
    const now = Date.now();
    const userData = getUserOtpData(phoneNumber) || {};
    
    if (!userData.requests) {
        userData.requests = [];
    }
    
    const windowMs = type === 'otp' ? RATE_LIMIT.otpWindowMs : RATE_LIMIT.windowMs;
    const maxRequests = type === 'otp' ? RATE_LIMIT.otpRequests : RATE_LIMIT.maxRequests;
    
    userData.requests = userData.requests.filter(req => now - req < windowMs);
    
    if (userData.requests.length >= maxRequests) {
        const timeLeft = Math.ceil((userData.requests[0] + windowMs - now) / 1000 / 60);
        throw new Error(`Rate limit exceeded. Please wait ${timeLeft} minutes before trying again.`);
    }
    
    userData.requests.push(now);
    updateUserOtpData(phoneNumber, userData);
}

function cleanupPaymentData(phoneNumber) {
    const userData = getUserOtpData(phoneNumber);
    if (userData && userData.paymentData) {
        delete userData.paymentData;
        updateUserOtpData(phoneNumber, userData);
    }
}

async function createDorPayment(customerName) {
    try {
        log('DEBUG', 'Creating DOR payment', { customerName });
        
        const randomAmount = Math.floor(Math.random() * 99) + 1;
        const totalAmount = QRIS_CONFIG.basePrice + randomAmount;
        
        const reference = 'DOR' + Date.now();
        
        const qrString = generateQrString(totalAmount);
        
        const userData = getUserOtpData(customerName) || {};
        userData.paymentData = {
            reference,
            amount: totalAmount,
            timestamp: Date.now(),
            status: 'PENDING'
        };
        updateUserOtpData(customerName, userData);
        
        setTimeout(() => {
            const currentData = getUserOtpData(customerName);
            if (currentData?.paymentData?.status === 'PENDING') {
                cleanupPaymentData(customerName);
            }
        }, 5 * 60 * 1000); // 5 menit
        
        log('INFO', 'DOR payment created', {
            reference: reference,
            amount: totalAmount,
            randomAmount: randomAmount,
            basePrice: QRIS_CONFIG.basePrice
        });
        
        return {
            success: true,
            data: {
                reference: reference,
                amount: totalAmount,
                qr_string: qrString,
                payment_method: 'QRIS'
            }
        };
    } catch (error) {
        return handleError('membuat pembayaran DOR', error, { customerName });
    }
}

async function processDorRequest(data) {
    try {
        log('DEBUG', 'Processing DOR request', { 
            nomor_hp: data.nomor_hp,
            kode: data.kode
        });
        
        const response = await axios.post(DOR_CONFIG.apiUrl, data, {
            headers: {
                'Content-Type': 'application/json',
                'Authorization': DOR_CONFIG.apiKey
            }
        });
        
        log('INFO', 'DOR request processed', {
            nomor_hp: data.nomor_hp,
            status: response.data.status,
            message: response.data.message
        });
        
        return response.data;
    } catch (error) {
        return handleError('memproses request DOR', error, { 
            nomor_hp: data.nomor_hp,
            kode: data.kode
        });
    }
}

async function checkPaymentStatus(reference, amount) {
    try {
        log('DEBUG', 'Checking payment status', { reference, amount });
        
        const response = await axios.get(`https://gateway.okeconnect.com/api/mutasi/qris/${QRIS_CONFIG.merchantId}/${QRIS_CONFIG.apiKey}`);
        
        if (response.data && response.data.status === "success" && response.data.data) {
            const transactions = response.data.data;
            
            const matchingTransactions = transactions.filter(tx => {
                const txAmount = parseInt(tx.amount);
                const txDate = new Date(tx.date);
                const now = new Date();
                const timeDiff = now - txDate;
                
                log('DEBUG', 'Checking transaction', {
                    txAmount,
                    expectedAmount: amount,
                    qris: tx.qris,
                    type: tx.type,
                    timeDiff: timeDiff,
                    reference: tx.issuer_reff
                });
                
                return txAmount === amount && 
                       tx.qris === "static" &&
                       tx.type === "CR" &&
                       timeDiff <= 5 * 60 * 1000;
            });
            
            if (matchingTransactions.length > 0) {
                const latestTransaction = matchingTransactions.reduce((latest, current) => {
                    const currentDate = new Date(current.date);
                    const latestDate = new Date(latest.date);
                    return currentDate > latestDate ? current : latest;
                });
                
                log('INFO', 'Payment found in mutasi', {
                    reference,
                    amount,
                    status: 'PAID',
                    transaction: {
                        date: latestTransaction.date,
                        brand_name: latestTransaction.brand_name,
                        issuer_reff: latestTransaction.issuer_reff,
                        amount: latestTransaction.amount,
                        buyer_reff: latestTransaction.buyer_reff
                    }
                });
                
                return {
                    success: true,
                    data: {
                        status: 'PAID',
                        amount: parseInt(latestTransaction.amount),
                        reference: latestTransaction.issuer_reff,
                        date: latestTransaction.date,
                        brand_name: latestTransaction.brand_name,
                        buyer_reff: latestTransaction.buyer_reff
                    }
                };
            } else {
                log('DEBUG', 'No matching transaction found', {
            reference,
                    amount,
                    availableTransactions: transactions.map(tx => ({
                        amount: tx.amount,
                        qris: tx.qris,
                        type: tx.type,
                        date: tx.date
                    }))
                });
            }
        }
        
        log('DEBUG', 'Payment not found in mutasi', { reference, amount });
        return {
            success: true,
            data: {
                status: 'UNPAID',
                amount: amount,
                reference: reference
            }
        };
    } catch (error) {
        return handleError('cek status pembayaran', error, { reference, amount });
    }
}


function isAdmin(phoneNumber) {
    return ADMIN_CONFIG.adminNumbers.includes(phoneNumber);
}

async function deletePreviousMessage(msg, previousMessageKey) {
    try {
        if (previousMessageKey) {
            await msg.deleteMessage(previousMessageKey);
        }
    } catch (error) {
        log('WARN', 'Failed to delete previous message', { error: error.message });
    }
}

bot.command("status", async (msg) => {
    const phoneNumber = msg._sender?.jid.split('@')[0];
    if (!phoneNumber) {
        return await msg.reply(
            "╔════════════════════════════╗\n" +
            "║     ⚠️ ERROR ⚠️           ║\n" +
            "╚════════════════════════════╝\n\n" +
            "Tidak dapat mengambil nomor pengguna."
        );
    }

    const userData = getUserOtpData(phoneNumber);
    if (!userData) {
        return await msg.reply(
            "╔════════════════════════════╗\n" +
            "║     ⚠️ PERINGATAN ⚠️      ║\n" +
            "╚════════════════════════════╝\n\n" +
            "Anda belum login. Silakan login terlebih dahulu."
        );
    }

    try {
        if (userData.paymentData) {
            const { reference, amount, status, timestamp } = userData.paymentData;
            const paymentTime = new Date(timestamp).toLocaleString();
            
            let statusMessage = 
                "╔════════════════════════════╗\n" +
                "║     🏧 STATUS 🏧          ║\n" +
                "╚════════════════════════════╝\n\n" +
                `📝 *Reference:* ${reference}\n` +
                `💰 *Amount:* Rp ${amount.toLocaleString()}\n` +
                `📅 *Waktu:* ${paymentTime}\n` +
                `📊 *Status:* ${status}\n\n`;
            
            if (status === 'PENDING') {
                statusMessage += 
                    "╔════════════════════════════╗\n" +
                    "║     ⚠️ PENDING ⚠️         ║\n" +
                    "╚════════════════════════════╝\n\n" +
                    "Pembayaran masih dalam proses\n" +
                    "Silakan selesaikan pembayaran dalam 5 menit.";
            } else if (status === 'PAID') {
                statusMessage += 
                    "╔════════════════════════════╗\n" +
                    "║     ✅ PAID ✅            ║\n" +
                    "╚════════════════════════════╝\n\n" +
                    "Pembayaran berhasil\n" +
                    "Proses DOR sedang berjalan.";
            }
            
            await msg.reply(statusMessage);
        } else {
            await msg.reply(
                "╔════════════════════════════╗\n" +
                "║     ℹ️ INFO ℹ️            ║\n" +
                "╚════════════════════════════╝\n\n" +
                "Tidak ada riwayat pembayaran terakhir."
            );
        }
    } catch (error) {
        log('ERROR', 'Failed to check payment status', {
            error: error.message,
            phoneNumber
        });
        await msg.reply(
            "╔════════════════════════════╗\n" +
            "║     ❌ ERROR ❌            ║\n" +
            "╚════════════════════════════╝\n\n" +
            "Gagal memeriksa status pembayaran."
        );
    }
});

bot.command("bantuan", async (msg) => {
    const helpMessage = 
        "╔════════════════════════════╗\n" +
        "║     🤖 BANTUAN BOT 🤖     ║\n" +
        "╚════════════════════════════╝\n\n" +
        "📋 *DAFTAR PERINTAH:*\n\n" +
        "1️⃣ *.mintaotp* - Minta kode OTP\n" +
        "2️⃣ *.verifotp* - Verifikasi OTP\n" +
        "3️⃣ *.dor* - Mulai proses DOR\n" +
        "4️⃣ *.status* - Cek status pembayaran\n" +
        "5️⃣ *.bantuan* - Tampilkan menu bantuan\n\n" +
        "╔════════════════════════════╗\n" +
        "║     ❓ FAQ ❓              ║\n" +
        "╚════════════════════════════╝\n\n" +
        "❓ *Berapa lama kode OTP berlaku?*\n" +
        "⏰ Kode OTP berlaku selama 5 menit.\n\n" +
        "❓ *Berapa lama sesi login?*\n" +
        "⏰ Sesi login berlaku selama 1 jam.\n\n" +
        "❓ *Bagaimana jika pembayaran gagal?*\n" +
        "🔄 Silakan coba lagi dengan command .dor\n\n" +
        "╔════════════════════════════╗\n" +
        "║     ⚠️ PERHATIAN ⚠️        ║\n" +
        "╚════════════════════════════╝\n\n" +
        "• Pastikan nomor target TIDAK memiliki paket combo\n" +
        "• Pembayaran harus diselesaikan dalam 5 menit\n" +
        "• Jangan membagikan kode OTP ke siapapun\n\n" +
        "╔════════════════════════════╗\n" +
        "║     📞 KONTAK 📞          ║\n" +
        "╚════════════════════════════╝\n\n" +
        "Jika mengalami masalah, hubungi admin:\n" +
        `${ADMIN_CONFIG.adminNumbers[0]}`;
    
    await msg.reply(helpMessage);
});

bot.command("stats", async (msg) => {
    const phoneNumber = msg._sender?.jid.split('@')[0];
    if (!isAdmin(phoneNumber)) {
        return await msg.reply(
            "╔════════════════════════════╗\n" +
            "║     ⚠️ ACCESS ⚠️          ║\n" +
            "╚════════════════════════════╝\n\n" +
            "Akses ditolak. Hanya admin yang dapat menggunakan command ini."
        );
    }

    try {
        const otpData = loadOtpData();
        const totalUsers = Object.keys(otpData).length;
        const activeUsers = Object.values(otpData).filter(user => 
            user.status === 'logged_in' || user.status === 'waiting_verification'
        ).length;
        
        const pendingPayments = Object.values(otpData).filter(user => 
            user.paymentData?.status === 'PENDING'
        ).length;
        
        const successfulPayments = Object.values(otpData).filter(user => 
            user.paymentData?.status === 'PAID'
        ).length;

        const statsMessage = 
            "╔════════════════════════════╗\n" +
            "║     📊 STATS 📊           ║\n" +
            "╚════════════════════════════╝\n\n" +
            `👥 *Total Users:* ${totalUsers}\n` +
            `🟢 *Active Users:* ${activeUsers}\n` +
            `⏳ *Pending Payments:* ${pendingPayments}\n` +
            `✅ *Successful Payments:* ${successfulPayments}\n\n` +
            "╔════════════════════════════╗\n" +
            "║     🔄 UPDATE 🔄          ║\n" +
            "╚════════════════════════════╝\n\n" +
            `Last Updated: ${new Date().toLocaleString()}`;
        
        await msg.reply(statsMessage);
    } catch (error) {
        log('ERROR', 'Failed to get stats', {
            error: error.message,
            phoneNumber
        });
        await msg.reply(
            "╔════════════════════════════╗\n" +
            "║     ❌ ERROR ❌            ║\n" +
            "╚════════════════════════════╝\n\n" +
            "Gagal mengambil statistik."
        );
    }
});

bot.command("maintenance", async (msg) => {
    const phoneNumber = msg._sender?.jid.split('@')[0];
    if (!isAdmin(phoneNumber)) {
        return await msg.reply(
            "╔════════════════════════════╗\n" +
            "║     ⚠️ ACCESS ⚠️          ║\n" +
            "╚════════════════════════════╝\n\n" +
            "Akses ditolak. Hanya admin yang dapat menggunakan command ini."
        );
    }

    const args = msg._msg?.content?.split(' ').slice(1);
    if (!args || args.length === 0) {
        return await msg.reply(
            "╔════════════════════════════╗\n" +
            "║     ℹ️ FORMAT ℹ️          ║\n" +
            "╚════════════════════════════╝\n\n" +
            "Format: .maintenance <on/off>\n" +
            "Contoh: .maintenance on"
        );
    }

    const action = args[0].toLowerCase();
    if (action === 'on') {
        ADMIN_CONFIG.maintenanceMode = true;
        await msg.reply(
            "╔════════════════════════════╗\n" +
            "║     🔧 MAINTENANCE 🔧     ║\n" +
            "╚════════════════════════════╝\n\n" +
            "Mode maintenance diaktifkan.\n" +
            "Bot akan menolak semua request."
        );
    } else if (action === 'off') {
        ADMIN_CONFIG.maintenanceMode = false;
        await msg.reply(
            "╔════════════════════════════╗\n" +
            "║     ✅ MAINTENANCE ✅     ║\n" +
            "╚════════════════════════════╝\n\n" +
            "Mode maintenance dinonaktifkan.\n" +
            "Bot kembali beroperasi normal."
        );
    } else {
        await msg.reply(
            "╔════════════════════════════╗\n" +
            "║     ⚠️ ERROR ⚠️           ║\n" +
            "╚════════════════════════════╝\n\n" +
            "Perintah tidak valid. Gunakan 'on' atau 'off'."
        );
    }
});

bot.command("mintaotp", async (msg) => {
    if (ADMIN_CONFIG.maintenanceMode) {
        return await msg.reply(
            "╔════════════════════════════╗\n" +
            "║     🔧 MAINTENANCE 🔧     ║\n" +
            "╚════════════════════════════╝\n\n" +
            "Bot sedang dalam mode maintenance.\n" +
            "Silakan coba lagi nanti."
        );
    }
    const phoneNumber = msg._sender?.jid.split('@')[0];
    log('DEBUG', 'Received mintaotp command', { phoneNumber });
    
    if (!phoneNumber) {
        return await msg.reply(
            "╔════════════════════════════╗\n" +
            "║     ⚠️ ERROR ⚠️           ║\n" +
            "╚════════════════════════════╝\n\n" +
            "Tidak dapat mengambil nomor pengguna."
        );
    }

    try {
        checkRateLimit(phoneNumber, 'otp');
        
        const nomor_hp = sanitizeInput(msg._msg?.content?.replace(".mintaotp", "").trim());
    log('DEBUG', 'Processing mintaotp request', { targetNumber: nomor_hp });
    
    if (!nomor_hp) {
        return await msg.reply(
                "╔════════════════════════════╗\n" +
                "║     ℹ️ FORMAT ℹ️          ║\n" +
                "╚════════════════════════════╝\n\n" +
                "Format: *.mintaotp <nomor_hp>*\n" +
                "Contoh: *.mintaotp 087777334618*"
            );
        }

        const validatedPhone = validateInput(nomor_hp, 'phone');
        const statusMsg = await msg.reply(
            "╔════════════════════════════╗\n" +
            "║     ⏳ PROSES ⏳           ║\n" +
            "╚════════════════════════════╝\n\n" +
            "Meminta OTP..."
        );

        const response = await retryApiCall(async () => {
            return await axios.get(`${OTP_CONFIG.requestUrl}?nomor_hp=${validatedPhone}`, {
            headers: {
                'Authorization': DOR_CONFIG.apiKey
                },
                timeout: VALIDATION_CONFIG.apiTimeout
            });
        });

        if (response.data.status === "success") {
            const { data } = response.data;
            const expires_in = data.expires_in || 300;
            
            updateUserOtpData(phoneNumber, {
                nomor_hp: validatedPhone,
                expires_in: expires_in,
                max_validation_attempt: data.max_validation_attempt || 3,
                next_resend_allowed_at: data.next_resend_allowed_at,
                status: 'waiting_verification',
                timestamp: Date.now(),
                expires_at: Date.now() + (expires_in * 1000)
            });

            await deletePreviousMessage(msg, statusMsg.key);
            await msg.reply(
                "╔════════════════════════════╗\n" +
                "║     ✅ BERHASIL ✅         ║\n" +
                "╚════════════════════════════╝\n\n" +
                "OTP berhasil dikirim!\n\n" +
                "📱 Silakan cek SMS Anda untuk mendapatkan kode OTP\n" +
                "Ketik *.verifotp <kode_otp>* untuk verifikasi\n\n" +
                "╔════════════════════════════╗\n" +
                "║     ℹ️ INFORMASI ℹ️        ║\n" +
                "╚════════════════════════════╝\n\n" +
                `⏰ Kode berlaku ${Math.floor(expires_in / 60)} menit\n` +
                `🔄 Maksimal ${data.max_validation_attempt || 3} kali percobaan`
            );

            setTimeout(() => {
                const currentData = getUserOtpData(phoneNumber);
                if (currentData && currentData.status === 'waiting_verification') {
                    log('INFO', 'OTP expired', { phoneNumber });
                    deleteUserOtpData(phoneNumber);
                }
            }, expires_in * 1000);
        } else {
            throw new Error(response.data.message || "Gagal meminta OTP");
        }
    } catch (error) {
        if (error.message.includes('Rate limit exceeded')) {
            return await msg.reply(
                "╔════════════════════════════╗\n" +
                "║     ⚠️ LIMIT ⚠️           ║\n" +
                "╚════════════════════════════╝\n\n" +
                error.message
            );
        }
        log('ERROR', 'OTP request failed', {
            error: error.message,
            response: error.response?.data,
            nomor_hp
        });
        await deletePreviousMessage(msg, statusMsg.key);
        await msg.reply(
            "╔════════════════════════════╗\n" +
            "║     ❌ GAGAL ❌            ║\n" +
            "╚════════════════════════════╝\n\n" +
            `Gagal meminta OTP: ${error.message}`
        );
    }
});

bot.command("verifotp", async (msg) => {
    if (ADMIN_CONFIG.maintenanceMode) {
        return await msg.reply(
            "╔════════════════════════════╗\n" +
            "║     🔧 MAINTENANCE 🔧     ║\n" +
            "╚════════════════════════════╝\n\n" +
            "Bot sedang dalam mode maintenance.\n" +
            "Silakan coba lagi nanti."
        );
    }
    const phoneNumber = msg._sender?.jid.split('@')[0];
    const userData = getUserOtpData(phoneNumber);
    if (!userData || userData.status !== 'waiting_verification') {
        return await msg.reply(
            "╔════════════════════════════╗\n" +
            "║     ⚠️ PERINGATAN ⚠️      ║\n" +
            "╚════════════════════════════╝\n\n" +
            "Silakan ketik *.mintaotp <nomor_hp>* terlebih dahulu!"
        );
    }

    try {
        const kode_otp = sanitizeInput(msg._msg?.content?.replace(".verifotp", "").trim());
    if (!kode_otp) {
        return await msg.reply(
                "╔════════════════════════════╗\n" +
                "║     ℹ️ FORMAT ℹ️          ║\n" +
                "╚════════════════════════════╝\n\n" +
                "Format: *.verifotp <kode_otp>*\n" +
                "Contoh: *.verifotp 123456*"
            );
        }

        const validatedOtp = validateInput(kode_otp, 'otp');
        const statusMsg = await msg.reply(
            "╔════════════════════════════╗\n" +
            "║     ⏳ PROSES ⏳           ║\n" +
            "╚════════════════════════════╝\n\n" +
            "Memverifikasi OTP..."
        );

        const response = await retryApiCall(async () => {
            return await axios.get(`${OTP_CONFIG.verifyUrl}?nomor_hp=${userData.nomor_hp}&kode_otp=${validatedOtp}`, {
            headers: {
                'Authorization': DOR_CONFIG.apiKey
                },
                timeout: VALIDATION_CONFIG.apiTimeout
            });
        });

        if (response.data.status === "success") {
            const { data } = response.data;
            const login_expires_in = data.expires_in || 3600;
            
            updateUserOtpData(phoneNumber, {
                ...userData,
                access_token: data.access_token,
                refresh_token: data.refresh_token,
                token_type: data.token_type,
                expires_in: login_expires_in,
                status: 'logged_in',
                timestamp: Date.now(),
                expires_at: Date.now() + (login_expires_in * 1000)
            });

            await deletePreviousMessage(msg, statusMsg.key);
            await msg.reply(
                "╔════════════════════════════╗\n" +
                "║     ✅ BERHASIL ✅         ║\n" +
                "╚════════════════════════════╝\n\n" +
                "Verifikasi OTP berhasil!\n\n" +
                "📱 Anda sudah login\n" +
                "Ketik *.dor* untuk melanjutkan pembelian\n\n" +
                "╔════════════════════════════╗\n" +
                "║     ℹ️ INFORMASI ℹ️        ║\n" +
                "╚════════════════════════════╝\n\n" +
                `⏰ Sesi login berlaku ${Math.floor(login_expires_in / 60)} menit`
            );

            setTimeout(() => {
                const currentData = getUserOtpData(phoneNumber);
                if (currentData && currentData.status === 'logged_in') {
                    log('INFO', 'Login session expired', { phoneNumber });
                    deleteUserOtpData(phoneNumber);
                }
            }, login_expires_in * 1000);
        } else {
            throw new Error(response.data.message || "Gagal verifikasi OTP");
        }
    } catch (error) {
        log('ERROR', 'OTP verification failed', {
            error: error.message,
            response: error.response?.data,
            phoneNumber
        });
        await deletePreviousMessage(msg, statusMsg.key);
        await msg.reply(
            "╔════════════════════════════╗\n" +
            "║     ❌ GAGAL ❌            ║\n" +
            "╚════════════════════════════╝\n\n" +
            `Gagal verifikasi OTP: ${error.message}`
        );
    }
});

bot.command("dor", async (msg) => {
    if (ADMIN_CONFIG.maintenanceMode) {
        return await msg.reply(
            "╔════════════════════════════╗\n" +
            "║     🔧 MAINTENANCE 🔧     ║\n" +
            "╚════════════════════════════╝\n\n" +
            "Bot sedang dalam mode maintenance.\n" +
            "Silakan coba lagi nanti."
        );
    }
    const phoneNumber = msg._sender?.jid.split("@")[0];
    if (!phoneNumber) {
        return await msg.reply(
            "╔════════════════════════════╗\n" +
            "║     ⚠️ ERROR ⚠️           ║\n" +
            "╚════════════════════════════╝\n\n" +
            "Tidak dapat mengambil nomor pengguna."
        );
    }

    if (!getUserOtpData(phoneNumber)) {
        return await msg.reply(
            "╔════════════════════════════╗\n" +
            "║     ⚠️ PERINGATAN ⚠️      ║\n" +
            "╚════════════════════════════╝\n\n" +
            "📱 *Anda belum login!*\n\n" +
            "Silakan login terlebih dahulu dengan perintah:\n" +
            "1️⃣ *.mintaotp <nomor_hp>*\n" +
            "2️⃣ *.verifotp <kode_otp>*\n\n" +
            "╔════════════════════════════╗\n" +
            "║     ℹ️ INFORMASI ℹ️        ║\n" +
            "╚════════════════════════════╝\n\n" +
            "⏰ Sesi login berlaku 1 jam\n" +
            "🔐 OTP berlaku 5 menit"
        );
    }

    const { nomor_hp, access_token } = getUserOtpData(phoneNumber);

    await msg.reply(
        "╔════════════════════════════╗\n" +
        "║     ⚠️ PENTING ⚠️          ║\n" +
        "╚════════════════════════════╝\n\n" +
        "1️⃣ Nomor target *TIDAK BOLEH* memiliki paket combo apapun\n" +
        "2️⃣ Jika syarat di atas tidak terpenuhi, proses DOR akan gagal\n\n" +
        "╔════════════════════════════╗\n" +
        "║     📦 PAKET DOR 📦       ║\n" +
        "╚════════════════════════════╝\n\n" +
        "✨ *Unlimited Turbo Super*\n" +
        "⏳ Expired: 30 Hari\n\n" +
        "╔════════════════════════════╗\n" +
        "║     ❌ TIDAK BOLEH ❌      ║\n" +
        "╚════════════════════════════╝\n\n" +
        "• XTRA COMBO\n" +
        "• XTRA COMBO VIP\n" +
        "• XTRA COMBO MINI\n" +
        "• XTRA COMBO VIP PLUS\n\n" +
        "╔════════════════════════════╗\n" +
        "║     🚀 LANJUTKAN 🚀       ║\n" +
        "╚════════════════════════════╝\n\n" +
        "Ketik *.lanjutdor* untuk melanjutkan pembelian\n" +
        "⏰ Command berlaku 60 detik"
    );
});

bot.command("lanjutdor", async (msg) => {
    if (ADMIN_CONFIG.maintenanceMode) {
        return await msg.reply(
            "╔════════════════════════════╗\n" +
            "║     🔧 MAINTENANCE 🔧     ║\n" +
            "╚════════════════════════════╝\n\n" +
            "Bot sedang dalam mode maintenance.\n" +
            "Silakan coba lagi nanti."
        );
    }
    const phoneNumber = msg._sender?.jid.split("@")[0];
    if (!phoneNumber || !getUserOtpData(phoneNumber)) {
        return await msg.reply(
            "╔════════════════════════════╗\n" +
            "║     ⚠️ PERINGATAN ⚠️      ║\n" +
            "╚════════════════════════════╝\n\n" +
            "📱 *Anda belum login!*\n\n" +
            "Silakan login terlebih dahulu dengan perintah:\n" +
            "1️⃣ *.mintaotp <nomor_hp>*\n" +
            "2️⃣ *.verifotp <kode_otp>*"
        );
    }

    const { nomor_hp, access_token } = getUserOtpData(phoneNumber);

    const dorData = {
        kode: "uts2",
        nama_paket: "Paket Kere Hore",
        nomor_hp: nomor_hp,
        payment: "pulsa",
        id_telegram: "#", // Ganti dengan ID Telegram Anda
        password: "#", // Ganti dengan password yang sesuai
        access_token: access_token
    };

    const statusMsg = await msg.reply(
        "╔════════════════════════════╗\n" +
        "║     ⏳ MEMPROSES ⏳        ║\n" +
        "╚════════════════════════════╝\n\n" +
        "📱 Membuat transaksi pembayaran..."
    );

    try {
        const payment = await createDorPayment(phoneNumber);
        if (!payment.success) {
            await deletePreviousMessage(msg, statusMsg.key);
            return await msg.reply(
                "╔════════════════════════════╗\n" +
                "║     ❌ GAGAL ❌            ║\n" +
                "╚════════════════════════════╝\n\n" +
                "Gagal membuat transaksi pembayaran."
            );
        }

        const qrBuffer = await QRCode.toBuffer(payment.data.qr_string);

        await deletePreviousMessage(msg, statusMsg.key);
        const paymentMsg = await msg.reply({ 
            image: qrBuffer,
            caption: "╔════════════════════════════╗\n" +
                    "║     💰 PEMBAYARAN 💰      ║\n" +
                    "╚════════════════════════════╝\n\n" +
                    `💵 *Total Bayar:* Rp ${payment.data.amount.toLocaleString()}\n` +
                    `🏦 *Metode:* QRIS\n` +
                    `⏰ *Expired dalam:* 5 menit\n\n` +
                    "╔════════════════════════════╗\n" +
                    "║     ℹ️ INFORMASI ℹ️        ║\n" +
                    "╚════════════════════════════╝\n\n" +
                "Scan QR Code di atas untuk melakukan pembayaran.\n" +
                "Bot akan otomatis memproses setelah pembayaran diterima."
        });

        let isPaid = false;
        const checkInterval = setInterval(async () => {
            try {
                const status = await checkPaymentStatus(payment.data.reference, payment.data.amount);
                if (status.data.status === 'PAID') {
                    clearInterval(checkInterval);
                    isPaid = true;
                    await deletePreviousMessage(msg, paymentMsg.key);
                    await msg.reply(
                        "╔════════════════════════════╗\n" +
                        "║     ✅ BERHASIL ✅         ║\n" +
                        "╚════════════════════════════╝\n\n" +
                        "Pembayaran diterima! Memproses request DOR..."
                    );
                    
                    const dorResponse = await processDorRequest(dorData);
                    if (dorResponse.status === "success") {
                        let message = 
                            "╔════════════════════════════╗\n" +
                            "║     ✅ BERHASIL ✅         ║\n" +
                            "╚════════════════════════════╝\n\n" +
                            "📝 *Detail Pembelian:*\n" +
                            `📱 Nomor: ${nomor_hp}\n` +
                            `📦 Paket: ${dorData.nama_paket}\n` +
                            `💳 Metode: SLEDING DOR`;

                        await msg.reply(message);
                        
                        log('INFO', 'DOR process completed', { 
                            phoneNumber,
                            nomor_hp,
                            status: 'success'
                        });
                        
                        deleteUserOtpData(phoneNumber);
                    } else {
                        throw new Error(dorResponse.message || "Gagal memproses DOR");
                    }
                }
            } catch (error) {
                log('ERROR', 'Check payment error', {
                    error: error.message,
                    reference: payment.data.reference
                });
            }
        }, 5000);

        setTimeout(async () => {
            if (!isPaid) {
                clearInterval(checkInterval);
                try {
                    await deletePreviousMessage(msg, paymentMsg.key);
                    await msg.reply(
                        "╔════════════════════════════╗\n" +
                        "║     ⏰ EXPIRED ⏰          ║\n" +
                        "╚════════════════════════════╝\n\n" +
                        "Waktu pembayaran telah habis! Silakan coba lagi."
                    );
                } catch (error) {
                    log('ERROR', 'Error deleting message', {
                        error: error.message
                    });
                }
            }
        }, 5 * 60 * 1000);
    } catch (error) {
        log('ERROR', 'DOR process failed', {
            error: error.message,
            phoneNumber,
            nomor_hp
        });
        await deletePreviousMessage(msg, statusMsg.key);
        await msg.reply(
            "╔════════════════════════════╗\n" +
            "║     ❌ GAGAL ❌            ║\n" +
            "╚════════════════════════════╝\n\n" +
            `Gagal memproses pembelian: ${error.message}`
        );
    }
});

bot.command("menudor", async (msg) => {
    const menuText = `
╔═══❖ *DOR BOT MENU* ❖═══╗

🔥 *XL DOR XL KERE HORE*  
╭━━━━━━━━━━━━━━━━━━━━━╮  
┃ 1️⃣ *.mintaotp* ➜ Minta kode OTP
┃ 2️⃣ *.verifotp* ➜ Verifikasi OTP
┃ 3️⃣ *.dor* ➜ DOR XL KERE HORE
╰━━━━━━━━━━━━━━━━━━━━━╯  

📋 *CARA PAKAI:*
1. Ketik *.mintaotp <nomor_hp>*
2. Cek SMS untuk kode OTP
3. Ketik *.verifotp <kode_otp>*
4. Setelah login, ketik *.dor*
5. Ikuti instruksi selanjutnya

⚠️ *PERHATIAN:*
• Nomor target TIDAK BOLEH memiliki paket combo
❌ XTRA COMBO VIP
❌ XTRA COMBO MINI
❌ XTRA COMBO VIP PLUS
• Sesi login berlaku 1 jam
• OTP berlaku 5 menit

╚══════════════════╝
    `;
    await msg.reply(menuText);
});

bot.launch()
    .then(() => {
        log('INFO', 'Bot started successfully', {
            prefix: bot.prefix,
            phoneNumber: bot.phoneNumber,
            waVersion: bot.WAVersion
        });
    })
    .catch((error) => {
        log('ERROR', 'Bot launch failed', { 
            error: error.message,
            stack: error.stack
        });
    });
