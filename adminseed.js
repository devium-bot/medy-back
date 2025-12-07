// script seed-admin.js
const bcrypt = require('bcryptjs');
const { MongoClient } = require('mongodb');

async function run() {
  const uri = process.env.MONGO_URI; // mets ton URI
  const client = new MongoClient(uri);
  await client.connect();
  const db = client.db(); // ou db('nom')
  const passwordHash = await bcrypt.hash('Admin123!', 10);
  await db.collection('users').insertOne({
    email: 'admin@medy.com',
    password: passwordHash,
    role: 'admin',   // ou isAdmin: true selon ton modèle
    createdAt: new Date(),
  });
  console.log('Admin créé');
  await client.close();
}
run().catch(console.error);
