const { Client } = require("@mengkodingan/ckptw");
const axios = require('axios');
const QRCode = require('qrcode');
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

const LOG_FILE = path.join(__dirname, 'bot.log');

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

function getUserOtpData(phoneNumber) {
    try {
        const otpData = loadOtpData();
        const userData = otpData[phoneNumber];
        
        if (userData) {
            log('DEBUG', 'User OTP data retrieved', { 
                phoneNumber,
                status: userData.status,
                expires_at: userData.expires_at
            });
        } else {
            log('DEBUG', 'No OTP data found for user', { phoneNumber });
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
    apiKey: '0a1ccba4-e6fc-498c-af2f-5f889c765aaa', //MINTA SAMA RizkyHdyt
    price: 01 //BEBAS BERAPA TERGANTUNG ANDA
}

const OTP_CONFIG = {
    requestUrl: 'https://api.tuyull.my.id/api/v1/minta-otp',
    verifyUrl: 'https://api.tuyull.my.id/api/v1/verif-otp'
}

const TRIPAY_CONFIG = {
    apiKey: "#", //ISI
    privateKey: "#", //ISI
    merchantCode: "#" //ISI
}

const bot = new Client({
    prefix: ".",
    phoneNumber: "681916765366", //PAKAI NOMOR WA YANG MAU DI JADIKAN BOT
    usePairingCode: true,
    printQRInTerminal: false,
    WAVersion: [2, 3000, 1015901307],
    selfReply: true
});

async function getPaymentInstructions(method) {
    try {
        log('DEBUG', 'Fetching payment instructions', { method });
        
        const response = await axios.get(`https://tripay.co.id/api/payment/instruction?code=${method}`, {
            headers: { 
                'Authorization': 'Bearer ' + TRIPAY_CONFIG.apiKey 
            }
        });
        
        log('DEBUG', 'Payment instructions retrieved', { 
            method,
            steps: response.data.data?.[0]?.steps?.length || 0
        });
        
        return response.data;
    } catch (error) {
        return handleError('mendapatkan instruksi pembayaran', error, { method });
    }
}

async function createDorPayment(customerName) {
    try {
        log('DEBUG', 'Creating DOR payment', { customerName });
        
        const merchantRef = 'DOR' + Date.now();
        const method = "QRIS2";
        const signature = crypto.createHmac('sha256', TRIPAY_CONFIG.privateKey)
            .update(TRIPAY_CONFIG.merchantCode + merchantRef + DOR_CONFIG.price)
            .digest('hex');
            
        const payload = {
            method: method,
            merchant_ref: merchantRef,
            amount: DOR_CONFIG.price,
            customer_name: customerName,
            customer_email: `${customerName}@gmail.com`,
            merchant_code: TRIPAY_CONFIG.merchantCode,
            signature: signature,
            order_items: [
                {
                    name: "DOR Service",
                    price: DOR_CONFIG.price,
                    quantity: 1,
                    subtotal: DOR_CONFIG.price
                }
            ]
        };

        const response = await axios.post('https://tripay.co.id/api/transaction/create', payload, {
            headers: { 
                'Authorization': 'Bearer ' + TRIPAY_CONFIG.apiKey,
                'Content-Type': 'application/json'
            }
        });
        
        log('INFO', 'DOR payment created', {
            reference: response.data.data.reference,
            amount: response.data.data.amount,
            status: response.data.data.status
        });
        
        return response.data;
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

async function checkPaymentStatus(reference) {
    try {
        log('DEBUG', 'Checking payment status', { reference });
        
        const response = await axios.get(`https://tripay.co.id/api/transaction/detail?reference=${reference}`, {
            headers: { 
                'Authorization': 'Bearer ' + TRIPAY_CONFIG.apiKey,
                'Content-Type': 'application/json'
            }
        });
        
        log('DEBUG', 'Payment status retrieved', {
            reference,
            status: response.data.data.status,
            amount: response.data.data.amount
        });
        
        return response.data;
    } catch (error) {
        return handleError('cek status pembayaran', error, { reference });
    }
}

bot.command("mintaotp", async (msg) => {
    const phoneNumber = msg._sender?.jid.split('@')[0];
    log('DEBUG', 'Received mintaotp command', { phoneNumber });
    
    if (!phoneNumber) {
        log('WARN', 'Failed to get sender phone number');
        return await msg.reply("⚠️ Tidak dapat mengambil nomor pengguna.");
    }

    const nomor_hp = msg._msg?.content?.replace(".mintaotp", "").trim();
    log('DEBUG', 'Processing mintaotp request', { targetNumber: nomor_hp });
    
    if (!nomor_hp) {
        log('WARN', 'Missing target phone number');
        return await msg.reply(
            "⚠️ Format: .mintaotp <nomor_hp>\n" +
            "Contoh: .mintaotp 087777334618"
        );
    }

    const statusMsg = await msg.reply("⏳ Meminta OTP...");

    try {
        log('INFO', 'Making OTP request', { targetNumber: nomor_hp });
        const response = await axios.get(`${OTP_CONFIG.requestUrl}?nomor_hp=${nomor_hp}`, {
            headers: {
                'Authorization': DOR_CONFIG.apiKey
            }
        });

        if (response.data.status === "success") {
            const { data } = response.data;
            const expires_in = data.expires_in || 300;
            
            updateUserOtpData(phoneNumber, {
                nomor_hp: nomor_hp,
                expires_in: expires_in,
                max_validation_attempt: data.max_validation_attempt || 3,
                next_resend_allowed_at: data.next_resend_allowed_at,
                status: 'waiting_verification',
                expires_at: Date.now() + (expires_in * 1000)
            });

            log('INFO', 'OTP request successful', { 
                phoneNumber,
                targetNumber: nomor_hp,
                expiresIn: expires_in
            });

            await msg.editMessage(statusMsg.key, 
                "✅ OTP berhasil dikirim!\n\n" +
                "📱 Silakan cek SMS Anda untuk mendapatkan kode OTP\n" +
                "Ketik *.verifotp <kode_otp>* untuk verifikasi\n" +
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
        log('ERROR', 'OTP request failed', {
            error: error.message,
            response: error.response?.data,
            nomor_hp
        });
        await msg.editMessage(statusMsg.key, `❌ Gagal meminta OTP: ${error.message}`);
    }
});

bot.command("verifotp", async (msg) => {
    const phoneNumber = msg._sender?.jid.split('@')[0];
    log('DEBUG', 'Received verifotp command', { phoneNumber });
    
    const userData = getUserOtpData(phoneNumber);
    log('DEBUG', 'Retrieved user OTP data', { 
        phoneNumber,
        status: userData?.status,
        expiresAt: userData?.expires_at
    });
    
    if (!phoneNumber || !userData) {
        log('WARN', 'User not found or no OTP data', { phoneNumber });
        return await msg.reply("⚠️ Silakan ketik .mintaotp <nomor_hp> terlebih dahulu!");
    }

    if (userData.expires_at && Date.now() > userData.expires_at) {
        log('WARN', 'OTP expired', { phoneNumber });
        deleteUserOtpData(phoneNumber);
        return await msg.reply("⚠️ OTP sudah expired. Silakan minta OTP baru dengan .mintaotp");
    }

    if (userData.status !== 'waiting_verification') {
        log('WARN', 'Invalid OTP status', { 
            phoneNumber,
            status: userData.status
        });
        return await msg.reply("⚠️ OTP sudah tidak valid. Silakan minta OTP baru dengan .mintaotp");
    }

    const kode_otp = msg._msg?.content?.replace(".verifotp", "").trim();
    if (!kode_otp) {
        log('WARN', 'Missing OTP code', { phoneNumber });
        return await msg.reply(
            "⚠️ Format: .verifotp <kode_otp>\n" +
            "Contoh: .verifotp 123456"
        );
    }

    const statusMsg = await msg.reply("⏳ Memverifikasi OTP...");

    try {
        const { nomor_hp } = userData;
        log('INFO', 'Verifying OTP', { 
            phoneNumber,
            targetNumber: nomor_hp,
            otpCode: kode_otp
        });
        
        const response = await axios.get(`${OTP_CONFIG.verifyUrl}?nomor_hp=${nomor_hp}&kode_otp=${kode_otp}`, {
            headers: {
                'Authorization': DOR_CONFIG.apiKey
            }
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
                expires_at: Date.now() + (login_expires_in * 1000)
            });

            log('INFO', 'OTP verification successful', { 
                phoneNumber,
                expiresIn: login_expires_in
            });

            await msg.editMessage(statusMsg.key, 
                "✅ Verifikasi OTP berhasil!\n\n" +
                "📱 Anda sudah login\n" +
                "Ketik *.dor* untuk melanjutkan pembelian\n" +
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
            phoneNumber,
            kode_otp
        });
        await msg.editMessage(statusMsg.key, `❌ Gagal verifikasi OTP: ${error.message}`);
    }
});

bot.command("dor", async (msg) => {
    const phoneNumber = msg._sender?.jid.split("@")[0];
    if (!phoneNumber) {
        return await msg.reply("⚠️ Tidak dapat mengambil nomor pengguna.");
    }

    if (!getUserOtpData(phoneNumber)) {
        return await msg.reply(
            "⚠️ Anda belum login!\n\n" +
            "Silakan login terlebih dahulu dengan perintah:\n" +
            "1. *.mintaotp <nomor_hp>*\n" +
            "2. *.verifotp <kode_otp>*"
        );
    }

    const { nomor_hp, access_token } = getUserOtpData(phoneNumber);

    await msg.reply(
        "⚠️ *PENTING SEBELUM MEMBELI* ⚠️\n\n" +
        "1️⃣ Nomor target TIDAK BOLEH memiliki paket combo apapun\n" +
        "2️⃣ Jika syarat di atas tidak terpenuhi, proses DOR akan gagal\n\n" +
        "📦 *PAKET YANG AKAN DIDAPAT:*\n" +
        "• Unlimited Turbo Super\n" +
        "• Expired: 30 Hari\n\n" +
        "❌ *PAKET YANG TIDAK BOLEH ADA:*\n" +
        "• XTRA COMBO\n" +
        "• XTRA COMBO VIP\n" +
        "• XTRA COMBO MINI\n" +
        "• XTRA COMBO VIP PLUS\n\n" +
        "Ketik *.lanjutdor* untuk melanjutkan pembelian\n" +
        "⏰ Command berlaku 60 detik"
    );
});

bot.command("lanjutdor", async (msg) => {
    const phoneNumber = msg._sender?.jid.split("@")[0];
    if (!phoneNumber || !getUserOtpData(phoneNumber)) {
        return await msg.reply("⚠️ Silakan login terlebih dahulu dengan perintah .mintaotp dan .verifotp!");
    }

    const { nomor_hp, access_token } = getUserOtpData(phoneNumber);

    const dorData = {
        kode: "uts2",
        nama_paket: "Paket Kere Hore",
        nomor_hp: nomor_hp,
        payment: "pulsa",
        id_telegram: "932518771", //GANTI ID TELEGRAM ANDA
        password: "B@ngsat31", //GANTI PASSWORD AKSES ANDA
        access_token: access_token
    };

    const statusMsg = await msg.reply("⏳ Membuat transaksi pembayaran...");
    try {
        const payment = await createDorPayment(phoneNumber);
        if (!payment.success) {
            return await msg.editMessage(statusMsg.key, "❌ Gagal membuat transaksi pembayaran.");
        }

        const qrBuffer = await QRCode.toBuffer(payment.data.qr_string);
        const instructions = await getPaymentInstructions(payment.data.payment_method);
        let instructionText = "";
        if (instructions.success && instructions.data.length > 0) {
            instructionText = "\n\n📝 *Cara Pembayaran:*\n";
            instructions.data[0].steps.forEach((step, index) => {
                instructionText += `${index + 1}. ${step}\n`;
            });
        }

        const paymentMsg = await msg.reply({ 
            image: qrBuffer,
            caption: "🏧 *Informasi Pembayaran*\n\n" +
                `💰 Nominal: Rp ${DOR_CONFIG.price}\n` +
                `🏦 Metode: QRIS\n` +
                `⏰ Expired dalam: 5 menit\n` +
                instructionText + "\n" +
                "Scan QR Code di atas untuk melakukan pembayaran.\n" +
                "Bot akan otomatis memproses setelah pembayaran diterima."
        });

        let isPaid = false;
        const checkInterval = setInterval(async () => {
            try {
                const status = await checkPaymentStatus(payment.data.reference);
                if (status.data.status === 'PAID') {
                    clearInterval(checkInterval);
                    isPaid = true;
                    await msg.deleteMessage(paymentMsg.key);
                    await msg.reply("✅ Pembayaran diterima! Memproses request DOR...");
                    
                    const dorResponse = await processDorRequest(dorData);
                    if (dorResponse.status === "success") {
                        const { data } = dorResponse;
                        
                        let message = `✅ DOR berhasil diproses!\n\n` +
                            `📝 Detail Pembelian:\n` +
                            `Nomor: ${nomor_hp}\n` +
                            `Paket: ${dorData.nama_paket}\n` +
                            `Metode: ${data.data.data.payment_method}`;

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
                    await msg.deleteMessage(paymentMsg.key);
                    await msg.reply("❌ Waktu pembayaran telah habis! Silakan coba lagi.");
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
        await msg.editMessage(statusMsg.key, `❌ Gagal memproses pembelian: ${error.message}`);
    }
});

bot.command("dors", async (msg) => {
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
