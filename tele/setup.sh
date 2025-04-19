#!/bin/bash

echo "🛠️  Memulai instalasi proyek dari nol..."

echo "🔄 Update sistem & install curl, wget..."
sudo apt-get update -y
sudo apt-get install -y curl wget gnupg ca-certificates lsb-release

echo "🕒 Mengatur zona waktu ke Asia/Jakarta (WIB)..."
sudo timedatectl set-timezone Asia/Jakarta

echo "📦 Menginstall Node.js v20.x..."
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt-get install -y nodejs

echo "📌 Versi Node.js: $(node -v)"
echo "📌 Versi npm: $(npm -v)"

echo "📦 Menjalankan npm install..."
npm install

if [ ! -f .env ]; then
    echo "⚠️  File .env belum ditemukan! Membuat dari .env.example..."
    cp .env.example .env
fi

echo "📝 Silakan isi konfigurasi .env"
read -p "Masukkan ADMIN_ID (contoh: 123456): " ADMIN_ID
read -p "Masukkan LOGGING_GROUP_ID (contoh: -987654321): " LOGGING_GROUP_ID
read -p "Masukkan QRIS_MERCHANT_ID: " QRIS_MERCHANT_ID
read -p "Masukkan QRIS_API_KEY: " QRIS_API_KEY
read -p "Masukkan QRIS_BASE_QR_STRING: " QRIS_BASE_QR_STRING
read -p "Masukkan DOR_API_KEY: " DOR_API_KEY
read -p "Masukkan BOT_TOKEN: " BOT_TOKEN
read -p "Masukkan ID_TELEGRAM: " ID_TELEGRAM
read -p "Masukkan PASSWORD: " PASSWORD

cat > .env <<EOF
ADMIN_ID=$ADMIN_ID
LOGGING_GROUP_ID=$LOGGING_GROUP_ID
QRIS_MERCHANT_ID=$QRIS_MERCHANT_ID
QRIS_API_KEY=$QRIS_API_KEY
QRIS_BASE_QR_STRING=$QRIS_BASE_QR_STRING
DOR_API_KEY=$DOR_API_KEY
BOT_TOKEN=$BOT_TOKEN
ID_TELEGRAM=$ID_TELEGRAM
PASSWORD=$PASSWORD
EOF

echo "✅ File .env berhasil dibuat dan diisi."

echo "🚀 Menjalankan aplikasi..."
npm start
