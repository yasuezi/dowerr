#!/bin/bash

# Warna
GREEN="\033[0;32m"
CYAN="\033[0;36m"
YELLOW="\033[1;33m"
RED="\033[0;31m"
RESET="\033[0m"

echo -e "${CYAN}🛠️  Memulai setup untuk bot lo...${RESET}"

echo -e "${YELLOW}🔄 Update sistem & install tools penting...${RESET}"
sudo apt-get update -y
sudo apt-get install -y curl wget gnupg ca-certificates lsb-release

echo -e "${YELLOW}🕒 Setting timezone ke WIB (Asia/Jakarta)...${RESET}"
sudo timedatectl set-timezone Asia/Jakarta

echo -e "${YELLOW}📦 Install Node.js v20.x, sabar ya...${RESET}"
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt-get install -y nodejs

echo -e "${GREEN}✅ Node.js version: $(node -v)${RESET}"
echo -e "${GREEN}✅ npm version: $(npm -v)${RESET}"

echo -e "${YELLOW}📁 Install dependencies dari package.json...${RESET}"
npm install

# Check .env
if [ ! -f .env ]; then
    echo -e "${YELLOW}⚠️  File .env gak ada, bikin dari .env.example...${RESET}"
    cp .env.example .env
fi

echo -e "${CYAN}📝 Masukkan konfigurasi penting buat bot kamu${RESET}"
read -p "👤 ADMIN_ID: " 6904837223
read -p "📢 GROUP_ID: " 1002627930555
read -p "💳 QRIS_MERCHANT_ID: " OK924370
read -p "🔑 QRIS_API_KEY: " 63748271745564351924370OKCT4FE1C28580CACFD63EDF14E265CE0218
read -p "📌 QRIS_BASE_QR_STRING: " 00020101021126670016COM.NOBUBANK.WWW01189360050300000879140214131379338056960303UMI51440014ID.CO.QRIS.WWW0215ID20232438786910303UMI5204511153033605802ID5910VPN STORES6006JEMBER61056811162070703A016304EEB8
read -p "💳 HARGA: " 00
read -p "🚪 API_KEY: " 0a1ccba4-e6fc-498c-af2f-5f889c765aaa
read -p "🤖 BOT_TOKEN: " 7666099616:AAH2OnVflF2GeP3qJhMYnkZHnqlRg6z36sM
read -p "👥 ID_TELEGRAM UNTUK API: " 6904837223
read -p "🔐 PASSWORD: " tuyulbot

cat > .env <<EOF
ADMIN_ID=ADMIN_ID
LOGGING_GROUP_ID=$LOGGING_GROUP_ID
QRIS_MERCHANT_ID=$QRIS_MERCHANT_ID
QRIS_API_KEY=$QRIS_API_KEY
QRIS_BASE_QR_STRING=$QRIS_BASE_QR_STRING
BASE_PRICE=$BASE_PRICE
DOR_API_KEY=$DOR_API_KEY
BOT_TOKEN=$BOT_TOKEN
ID_TELEGRAM=ID_TELEGRAM
PASSWORD=$PASSWORD
EOF

echo -e "${GREEN}✅ .env berhasil dibuat dan diisi lengkap!${RESET}"

echo -e "${YELLOW}🔥 Install PM2 buat ngejalanin bot 24/7...${RESET}"
sudo npm install -g pm2

echo -e "${CYAN}🚀 Menyalakan bot dengan PM2...${RESET}"
pm2 start app.js --name bot-keren
pm2 startup systemd -u $USER --hp $HOME
pm2 save

echo -e "${GREEN}✅ Bot lo udah jalan dan akan auto-nyala kalau VPS reboot!${RESET}"

echo -e "${CYAN}📦 Perintah berguna buat bot lo:${RESET}"
echo -e "${YELLOW}➡️ pm2 logs bot-keren        ${CYAN}# Lihat log${RESET}"
echo -e "${YELLOW}➡️ pm2 restart bot-keren     ${CYAN}# Restart bot${RESET}"
echo -e "${YELLOW}➡️ pm2 stop bot-keren        ${CYAN}# Stop bot${RESET}"
echo -e "${YELLOW}➡️ pm2 delete bot-keren      ${CYAN}# Hapus bot dari PM2${RESET}"

echo -e "${GREEN}✨ SEMUA BERES! Sekarang tinggal buka Telegram & coba /start 💬${RESET}"
