// Pooja Kit - Full server (Node.js + Express + SQLite)
// Usage:
// 1) npm install
// 2) npm start
//
// Admin credentials (created automatically if not exists)
//   email: armanhacker900@gmail.com
//   password: admin-1234
//
// Important: For production, set JWT_SECRET env var and serve over HTTPS.

const express = require('express');
const bodyParser = require('body-parser');
const bcrypt = require('bcrypt');
const sqlite3 = require('sqlite3').verbose();
const fs = require('fs');
const path = require('path');
const jwt = require('jsonwebtoken');
const fetch = require('node-fetch');
const cookieParser = require('cookie-parser');
const cors = require('cors');

const PORT = process.env.PORT || 3000;
const JWT_SECRET = process.env.JWT_SECRET || 'replace_this_with_a_strong_secret';
const FORMSPREE_URL = process.env.FORMSPREE_URL || 'https://formspree.io/f/mzzvoalo'; // from user

const DB_FILE = path.join(__dirname, 'data.sqlite3');
const dbExists = fs.existsSync(DB_FILE);
const db = new sqlite3.Database(DB_FILE);

function runAsync(sql, params=[]) {
  return new Promise((resolve, reject) => {
    db.run(sql, params, function(err) {
      if (err) reject(err); else resolve(this);
    });
  });
}
function allAsync(sql, params=[]) {
  return new Promise((resolve, reject) => {
    db.all(sql, params, (err, rows) => {
      if (err) reject(err); else resolve(rows);
    });
  });
}
function getAsync(sql, params=[]) {
  return new Promise((resolve, reject) => {
    db.get(sql, params, (err, row) => {
      if (err) reject(err); else resolve(row);
    });
  });
}

// Initialize DB
async function initDb() {
  if (!dbExists) {
    console.log('Creating database...');
  }
  await runAsync(`CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT,
    email TEXT UNIQUE,
    phone TEXT,
    pass_hash TEXT,
    is_admin INTEGER DEFAULT 0,
    created_at INTEGER
  )`);

  await runAsync(`CREATE TABLE IF NOT EXISTS products (
    id TEXT PRIMARY KEY,
    title TEXT,
    price INTEGER,
    description TEXT
  )`);

  await runAsync(`CREATE TABLE IF NOT EXISTS orders (
    id TEXT PRIMARY KEY,
    user_id INTEGER,
    name TEXT,
    phone TEXT,
    address TEXT,
    city TEXT,
    pin TEXT,
    items TEXT,
    total INTEGER,
    status TEXT DEFAULT 'pending',
    eta INTEGER,
    created_at INTEGER,
    FOREIGN KEY(user_id) REFERENCES users(id)
  )`);

  // Seed products if empty
  const pcount = await getAsync('SELECT COUNT(*) as c FROM products');
  if (pcount && pcount.c === 0) {
    const products = [
      {id:'KIT-PRM-01', title:'Basic Pooja Kit (Small)', price:249, description:'Diya, kumkum, chawal, sandal, agarbatti, small camphor'},
      {id:'KIT-FAM-02', title:'Family Pooja Kit (Medium)', price:549, description:'Extended set for 4-6 people with incense, camphor, flowers'},
      {id:'KIT-DEL-03', title:'Deluxe Pooja Kit (Large)', price:999, description:'Complete set with special items and eco-friendly packaging'}
    ];
    for (const p of products) {
      await runAsync('INSERT INTO products (id,title,price,description) VALUES (?,?,?,?)', [p.id,p.title,p.price,p.description]);
    }
    console.log('Seeded products');
  }

  // Create admin user if not exists
  const adminEmail = 'armanhacker900@gmail.com';
  const admin = await getAsync('SELECT * FROM users WHERE email = ?', [adminEmail]);
  if (!admin) {
    const pass = 'admin-1234';
    const salt = await bcrypt.genSalt(10);
    const hash = await bcrypt.hash(pass, salt);
    await runAsync('INSERT INTO users (name,email,phone,pass_hash,is_admin,created_at) VALUES (?,?,?,?,?,?)',
      ['Admin', adminEmail, '', hash, 1, Date.now()]);
    console.log('Admin user created:', adminEmail);
  } else {
    console.log('Admin already present');
  }
}

initDb().catch(err=>{console.error(err);process.exit(1);});

const app = express();
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({extended:true}));
app.use(cookieParser());
app.use(cors({origin:true, credentials:true})); // adjust origin for production

// Serve static frontend
app.use(express.static(path.join(__dirname, 'public')));

// Helpers
function signToken(data) {
  return jwt.sign(data, JWT_SECRET, {expiresIn: '7d'});
}
function verifyToken(token) {
  try { return jwt.verify(token, JWT_SECRET); } catch(e) { return null; }
}

// Auth middleware
async function authMiddleware(req, res, next) {
  const token = req.cookies['token'] || req.headers['authorization'] && req.headers['authorization'].split(' ')[1];
  if (!token) return res.status(401).json({error:'auth_required'});
  const payload = verifyToken(token);
  if (!payload) return res.status(401).json({error:'invalid_token'});
  const user = await getAsync('SELECT id,name,email,is_admin FROM users WHERE id = ?', [payload.id]);
  if (!user) return res.status(401).json({error:'user_not_found'});
  req.user = user;
  next();
}

async function adminMiddleware(req,res,next){
  await authMiddleware(req,res,()=>{});
  if (!req.user) return; // authMiddleware already sent response
  const u = await getAsync('SELECT is_admin FROM users WHERE id=?',[req.user.id]);
  if (!u || u.is_admin !== 1) return res.status(403).json({error:'admin_only'});
  next();
}

// API: products
app.get('/api/products', async (req,res)=>{
  try {
    const rows = await allAsync('SELECT * FROM products');
    res.json(rows);
  } catch(err){res.status(500).json({error:err.message});}
});

// API: signup
app.post('/api/signup', async (req,res)=>{
  try{
    const {name,email,phone,password} = req.body;
    if (!email || !password || !name) return res.status(400).json({error:'missing_fields'});
    const exists = await getAsync('SELECT id FROM users WHERE email=?',[email]);
    if (exists) return res.status(400).json({error:'email_exists'});
    const salt = await bcrypt.genSalt(10);
    const hash = await bcrypt.hash(password, salt);
    const result = await runAsync('INSERT INTO users (name,email,phone,pass_hash,created_at) VALUES (?,?,?,?,?)',[name,email,phone,hash,Date.now()]);
    const user = await getAsync('SELECT id,name,email FROM users WHERE email=?',[email]);
    const token = signToken({id:user.id,email:user.email});
    res.cookie('token', token, {httpOnly:true, maxAge:7*24*3600*1000});
    res.json({user});
  }catch(err){res.status(500).json({error:err.message});}
});

// API: login
app.post('/api/login', async (req,res)=>{
  try{
    const {email,password} = req.body;
    if (!email || !password) return res.status(400).json({error:'missing_fields'});
    const user = await getAsync('SELECT * FROM users WHERE email=?',[email]);
    if (!user) return res.status(400).json({error:'invalid_credentials'});
    const ok = await bcrypt.compare(password, user.pass_hash);
    if (!ok) return res.status(400).json({error:'invalid_credentials'});
    const payload = {id:user.id,email:user.email};
    const token = signToken(payload);
    res.cookie('token', token, {httpOnly:true, maxAge:7*24*3600*1000});
    res.json({user:{id:user.id,name:user.name,email:user.email,phone:user.phone,is_admin:user.is_admin}});
  }catch(err){res.status(500).json({error:err.message});}
});

// API: logout
app.post('/api/logout', (req,res)=>{
  res.clearCookie('token');
  res.json({ok:true});
});

// API: place order (public, requires name,address etc)
app.post('/api/order', async (req,res)=>{
  try{
    const {name,phone,address,city,pin,items,total,eta, userToken} = req.body;
    if (!name || !phone || !address || !items) return res.status(400).json({error:'missing_fields'});
    const id = 'ORD-' + Math.random().toString(36).substr(2,8).toUpperCase();
    let userId = null;
    if (userToken) {
      const payload = verifyToken(userToken);
      if (payload) userId = payload.id;
    }
    const created_at = Date.now();
    await runAsync('INSERT INTO orders (id,user_id,name,phone,address,city,pin,items,total,eta,created_at) VALUES (?,?,?,?,?,?,?,?,?,?,?)',
      [id,userId,name,phone,address,city,pin,JSON.stringify(items),total,eta||null,created_at]);
    // Send to Formspree via server-side request so admin receives email
    try {
      const formData = new URLSearchParams();
      formData.append('tracking', id);
      formData.append('name', name);
      formData.append('phone', phone);
      formData.append('address', address);
      formData.append('city', city || '');
      formData.append('pin', pin || '');
      formData.append('items', JSON.stringify(items));
      formData.append('total', total || '');
      formData.append('_subject', 'New Pooja Kit Order ' + id);
      await fetch(FORMSPREE_URL, {method:'POST', body: formData});
    } catch(e){
      console.warn('Formspree submit failed:', e.message);
    }
    res.json({ok:true, id});
  }catch(err){res.status(500).json({error:err.message});}
});

// API: track
app.get('/api/track/:id', async (req,res)=>{
  try{
    const id = req.params.id.toUpperCase();
    const order = await getAsync('SELECT * FROM orders WHERE id = ?',[id]);
    if (!order) return res.status(404).json({error:'not_found'});
    order.items = JSON.parse(order.items||'[]');
    res.json(order);
  }catch(err){res.status(500).json({error:err.message});}
});

// Admin APIs
app.get('/api/admin/orders', async (req,res)=>{
  // expect token in header Authorization: Bearer <token> or cookie
  const token = req.cookies['token'] || (req.headers['authorization'] && req.headers['authorization'].split(' ')[1]);
  const payload = verifyToken(token);
  if (!payload) return res.status(401).json({error:'auth_required'});
  const user = await getAsync('SELECT id,is_admin FROM users WHERE id = ?', [payload.id]);
  if (!user || user.is_admin !== 1) return res.status(403).json({error:'admin_only'});
  const rows = await allAsync('SELECT * FROM orders ORDER BY created_at DESC');
  rows.forEach(r=>{ r.items = JSON.parse(r.items||'[]'); });
  res.json(rows);
});

app.put('/api/admin/order/:id/status', async (req,res)=>{
  const {status} = req.body;
  const token = req.cookies['token'] || (req.headers['authorization'] && req.headers['authorization'].split(' ')[1]);
  const payload = verifyToken(token);
  if (!payload) return res.status(401).json({error:'auth_required'});
  const user = await getAsync('SELECT id,is_admin FROM users WHERE id = ?', [payload.id]);
  if (!user || user.is_admin !== 1) return res.status(403).json({error:'admin_only'});
  const id = req.params.id;
  await runAsync('UPDATE orders SET status = ? WHERE id = ?', [status, id]);
  res.json({ok:true});
});

// export orders JSON
app.get('/api/admin/export', async (req,res)=>{
  const token = req.cookies['token'] || (req.headers['authorization'] && req.headers['authorization'].split(' ')[1]);
  const payload = verifyToken(token);
  if (!payload) return res.status(401).json({error:'auth_required'});
  const user = await getAsync('SELECT id,is_admin FROM users WHERE id = ?', [payload.id]);
  if (!user || user.is_admin !== 1) return res.status(403).json({error:'admin_only'});
  const rows = await allAsync('SELECT * FROM orders');
  res.setHeader('Content-disposition','attachment; filename=orders.json');
  res.setHeader('Content-type','application/json');
  res.send(JSON.stringify(rows,null,2));
});

// start server
app.listen(PORT, ()=>{
  console.log('Server running on http://localhost:' + PORT);
  console.log('Formspree endpoint:', FORMSPREE_URL);
});