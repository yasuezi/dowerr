#!/bin/bash

echo "🛠️  Mulai instalasi proyek..."

if ! command -v node &> /dev/null || ! command -v npm &> /dev/null; then
    echo "❌ Node.js dan npm belum terinstall. Menginstal Node.js..."
    NODE_VERSION="20.19.0"
    echo "📥 Mengunduh dan menginstal Node.js versi $NODE_VERSION..."
    curl -sL https://deb.nodesource.com/setup_$NODE_VERSION | sudo -E bash -
    sudo apt-get install -y nodejs
    if ! command -v node &> /dev/null || ! command -v npm &> /dev/null; then
        echo "❌ Gagal menginstal Node.js dan npm. Pastikan Anda memiliki akses sudo."
        exit 1
    fi
    echo "✅ Node.js dan npm berhasil diinstal."
else
    echo "✅ Node.js dan npm sudah terinstall."
fi

echo "📦 Menginstall dependency..."
npm install

if [ ! -f .env ]; then
    echo "⚠️  File .env belum ditemukan! Membuat file .env..."
    cp .env.example .env
fi

echo "🔧 Mengisi data .env..."

read -p "Masukkan ADMIN_ID (contoh: 123456): " ADMIN_ID
read -p "Masukkan LOGGING_GROUP_ID (contoh: -987654321): " LOGGING_GROUP_ID
read -p "Masukkan QRIS_MERCHANT_ID: " QRIS_MERCHANT_ID
read -p "Masukkan QRIS_API_KEY: " QRIS_API_KEY
read -p "Masukkan QRIS_BASE_QR_STRING: " QRIS_BASE_QR_STRING
read -p "Masukkan DOR_API_KEY: " DOR_API_KEY
read -p "Masukkan BOT_TOKEN: " BOT_TOKEN
read -p "Masukkan ID_TELEGRAM: " ID_TELEGRAM
read -p "Masukkan PASSWORD: " PASSWORD

echo "ADMIN_ID=$ADMIN_ID" > .env
echo "LOGGING_GROUP_ID=$LOGGING_GROUP_ID" >> .env
echo "QRIS_MERCHANT_ID=$QRIS_MERCHANT_ID" >> .env
echo "QRIS_API_KEY=$QRIS_API_KEY" >> .env
echo "QRIS_BASE_QR_STRING=$QRIS_BASE_QR_STRING" >> .env
echo "DOR_API_KEY=$DOR_API_KEY" >> .env
echo "BOT_TOKEN=$BOT_TOKEN" >> .env
echo "ID_TELEGRAM=$ID_TELEGRAM" >> .env
echo "PASSWORD=$PASSWORD" >> .env

echo "✅ File .env berhasil diisi."

echo "🚀 Menjalankan bot..."
npm start
