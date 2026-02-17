/**
 * Script to seed 12 dummy credit cards
 * Run with: node scripts/seed-cards.js
 */

const axios = require('axios');

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8001/api/v1';
const EMAIL = process.env.ADMIN_EMAIL || 'admin@example.com';
const PASSWORD = process.env.ADMIN_PASSWORD || 'password123';

const dummyCards = [
  {
    card_name: 'Emirates NBD Infinite',
    bank_name: 'Emirates NBD',
    card_number: '4532123456789012',
    cardholder_name: 'Ahmed Mohammed Al Mansoori',
    cvv: '123',
    expiry_month: 12,
    expiry_year: 2027,
    card_type: 'credit',
    card_network: 'visa',
    credit_limit: 50000,
    current_balance: 12500,
    balance_currency: 'AED',
    statement_date: 15,
    payment_due_date: 25,
    minimum_payment: 500,
  },
  {
    card_name: 'ADCB Platinum',
    bank_name: 'Abu Dhabi Commercial Bank',
    card_number: '5123456789012345',
    cardholder_name: 'Fatima Ali Al Zaabi',
    cvv: '456',
    expiry_month: 8,
    expiry_year: 2026,
    card_type: 'credit',
    card_network: 'mastercard',
    credit_limit: 75000,
    current_balance: 32000,
    balance_currency: 'AED',
    statement_date: 10,
    payment_due_date: 20,
    minimum_payment: 800,
  },
  {
    card_name: 'FAB World Elite',
    bank_name: 'First Abu Dhabi Bank',
    card_number: '4000123456789010',
    cardholder_name: 'Mohammed Khalid Al Suwaidi',
    cvv: '789',
    expiry_month: 6,
    expiry_year: 2028,
    card_type: 'credit',
    card_network: 'visa',
    credit_limit: 100000,
    current_balance: 45000,
    balance_currency: 'AED',
    statement_date: 5,
    payment_due_date: 15,
    minimum_payment: 1200,
  },
  {
    card_name: 'DIB Signature',
    bank_name: 'Dubai Islamic Bank',
    card_number: '5555123456789012',
    cardholder_name: 'Sara Ibrahim Al Maktoum',
    cvv: '234',
    expiry_month: 3,
    expiry_year: 2027,
    card_type: 'credit',
    card_network: 'mastercard',
    credit_limit: 60000,
    current_balance: 18000,
    balance_currency: 'AED',
    statement_date: 20,
    payment_due_date: 30,
    minimum_payment: 600,
  },
  {
    card_name: 'HSBC Premier',
    bank_name: 'HSBC Bank',
    card_number: '4111111111111111',
    cardholder_name: 'Omar Hassan Al Shamsi',
    cvv: '567',
    expiry_month: 11,
    expiry_year: 2026,
    card_type: 'credit',
    card_network: 'visa',
    credit_limit: 80000,
    current_balance: 28000,
    balance_currency: 'AED',
    statement_date: 12,
    payment_due_date: 22,
    minimum_payment: 900,
  },
  {
    card_name: 'RAK Bank Titanium',
    bank_name: 'RAK Bank',
    card_number: '5424000000000015',
    cardholder_name: 'Layla Abdullah Al Nuaimi',
    cvv: '890',
    expiry_month: 9,
    expiry_year: 2027,
    card_type: 'credit',
    card_network: 'mastercard',
    credit_limit: 45000,
    current_balance: 9500,
    balance_currency: 'AED',
    statement_date: 18,
    payment_due_date: 28,
    minimum_payment: 400,
  },
  {
    card_name: 'Mashreq Gold',
    bank_name: 'Mashreq Bank',
    card_number: '4242424242424242',
    cardholder_name: 'Khalid Saif Al Dhaheri',
    cvv: '345',
    expiry_month: 4,
    expiry_year: 2028,
    card_type: 'credit',
    card_network: 'visa',
    credit_limit: 55000,
    current_balance: 22000,
    balance_currency: 'AED',
    statement_date: 8,
    payment_due_date: 18,
    minimum_payment: 550,
  },
  {
    card_name: 'Standard Chartered Platinum',
    bank_name: 'Standard Chartered',
    card_number: '5105105105105100',
    cardholder_name: 'Noor Mohammed Al Qasimi',
    cvv: '678',
    expiry_month: 7,
    expiry_year: 2026,
    card_type: 'credit',
    card_network: 'mastercard',
    credit_limit: 70000,
    current_balance: 35000,
    balance_currency: 'AED',
    statement_date: 14,
    payment_due_date: 24,
    minimum_payment: 850,
  },
  {
    card_name: 'ENBD Skywards',
    bank_name: 'Emirates NBD',
    card_number: '4000000000000002',
    cardholder_name: 'Youssef Hamad Al Falasi',
    cvv: '901',
    expiry_month: 2,
    expiry_year: 2027,
    card_type: 'credit',
    card_network: 'visa',
    credit_limit: 65000,
    current_balance: 15000,
    balance_currency: 'AED',
    statement_date: 22,
    payment_due_date: 2,
    minimum_payment: 650,
  },
  {
    card_name: 'ADCB Cashback',
    bank_name: 'Abu Dhabi Commercial Bank',
    card_number: '5555555555554444',
    cardholder_name: 'Mariam Salem Al Ameri',
    cvv: '234',
    expiry_month: 10,
    expiry_year: 2028,
    card_type: 'credit',
    card_network: 'mastercard',
    credit_limit: 40000,
    current_balance: 12000,
    balance_currency: 'AED',
    statement_date: 16,
    payment_due_date: 26,
    minimum_payment: 450,
  },
  {
    card_name: 'FAB Rewards',
    bank_name: 'First Abu Dhabi Bank',
    card_number: '4012888888881881',
    cardholder_name: 'Hamdan Rashid Al Mazrouei',
    cvv: '567',
    expiry_month: 5,
    expiry_year: 2027,
    card_type: 'credit',
    card_network: 'visa',
    credit_limit: 50000,
    current_balance: 19500,
    balance_currency: 'AED',
    statement_date: 11,
    payment_due_date: 21,
    minimum_payment: 500,
  },
  {
    card_name: 'DIB Platinum',
    bank_name: 'Dubai Islamic Bank',
    card_number: '5200828282828210',
    cardholder_name: 'Aisha Nasser Al Ketbi',
    cvv: '890',
    expiry_month: 1,
    expiry_year: 2028,
    card_type: 'credit',
    card_network: 'mastercard',
    credit_limit: 85000,
    current_balance: 42000,
    balance_currency: 'AED',
    statement_date: 7,
    payment_due_date: 17,
    minimum_payment: 1000,
  },
];

async function seedCards() {
  try {
    console.log('🔐 تسجيل الدخول...');
    const loginResponse = await axios.post(`${API_URL}/auth/login`, {
      email: EMAIL,
      password: PASSWORD,
    });

    const token = loginResponse.data.access_token;
    const api = axios.create({
      baseURL: API_URL,
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });

    console.log(`✅ تم تسجيل الدخول بنجاح\n`);
    console.log(`📝 جاري إضافة ${dummyCards.length} بطاقة...\n`);

    let successCount = 0;
    let errorCount = 0;

    for (let i = 0; i < dummyCards.length; i++) {
      const card = dummyCards[i];
      try {
        await api.post('/cards/', card);
        successCount++;
        console.log(`✅ [${i + 1}/${dummyCards.length}] ${card.card_name} - ${card.bank_name}`);
        await new Promise(resolve => setTimeout(resolve, 200));
      } catch (err) {
        errorCount++;
        console.error(`❌ [${i + 1}/${dummyCards.length}] فشل إضافة ${card.card_name}:`, err.response?.data?.detail || err.message);
      }
    }

    console.log(`\n✨ تم الانتهاء!`);
    console.log(`✅ نجح: ${successCount}`);
    console.log(`❌ فشل: ${errorCount}`);
  } catch (err) {
    console.error('❌ خطأ:', err.response?.data || err.message);
    process.exit(1);
  }
}

seedCards();
