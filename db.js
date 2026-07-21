const { Pool } = require('pg');
require('dotenv').config();

// Railway/Cloud DB ka URL hum '.env' file mein 'DATABASE_URL' ke naam se rakhenge.
// Agar URL nahi mila, toh ye automatically Localhost wale setup par fallback karega.
const connectionString = process.env.DATABASE_URL || `postgresql://${process.env.DB_USER || 'postgres'}:${process.env.DB_PASSWORD || 'Aamir@2001'}@${process.env.DB_HOST || 'localhost'}:${process.env.DB_PORT || 5432}/${process.env.DB_NAME || 'school_db'}`;

const pool = new Pool({
  connectionString: connectionString,
  // Cloud database (jaise Railway) ke liye SSL zaroori hota hai
  // Localhost par SSL ki zaroorat nahi hoti, isiliye condition lagayi hai
  ssl: process.env.DATABASE_URL ? { rejectUnauthorized: false } : false
});

// Connection Check Karne Ke Liye
pool.on('connect', () => {
  console.log('✅ Database Connection Successful!');
});

// Agar koi unexpected error aaye toh server crash na ho
pool.on('error', (err) => {
  console.error('❌ Unexpected error on idle client', err.message);
  process.exit(-1);
});

module.exports = pool;