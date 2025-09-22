// Front-end app (calls backend API)
// Simple cart stored in localStorage
const API_ROOT = '';

function $(s){return document.querySelector(s)}
function qs(s){return Array.from(document.querySelectorAll(s))}

let CART = JSON.parse(localStorage.getItem('pooja_cart') || '[]');
function saveCart(){localStorage.setItem('pooja_cart', JSON.stringify(CART)); renderCart();}

async function loadProducts(){
  const res = await fetch('/api/products');
  const products = await res.json();
  const wrap = $('#products');
  wrap.innerHTML='';
  products.forEach(p=>{
    const el = document.createElement('div'); el.className='product';
    el.innerHTML = `<img src="https://via.placeholder.com/140x100.png?text=Kit" /><div style="flex:1"><div style="display:flex;justify-content:space-between"><div><strong>${p.title}</strong><div class="muted">${p.description}</div></div><div><strong>₹${p.price}</strong><div class="muted">${p.id}</div></div></div><div style="margin-top:8px"><button class="btn" data-add="${p.id}">Add to cart</button> <button class="btn ghost" data-buy="${p.id}">Buy now</button></div></div>`;
    wrap.appendChild(el);
  });
}

document.addEventListener('click', async (e)=>{
  const add = e.target.closest('[data-add]');
  const buy = e.target.closest('[data-buy]');
  if (add){ const id=add.getAttribute('data-add'); const p = await getProduct(id); CART.push(p); saveCart(); }
  if (buy){ const id=buy.getAttribute('data-buy'); const p = await getProduct(id); CART = [p]; saveCart(); openCheckout(); }
});

async function getProduct(id){
  const res = await fetch('/api/products'); const ps = await res.json(); return ps.find(p=>p.id===id);
}

function renderCart(){
  const el = $('#cartItems');
  if (!CART || CART.length===0){ el.innerHTML='<div class="muted">No items yet</div>'; return; }
  const lines = CART.map(c=>`<div style="display:flex;justify-content:space-between;padding:6px 0">${c.title} <strong>₹${c.price}</strong></div>`).join('');
  const total = CART.reduce((s,i)=>s+i.price,0);
  el.innerHTML = lines + `<hr><div style="display:flex;justify-content:space-between"><div class="muted">Total</div><div style="font-weight:700">₹${total}</div></div>`;
}

$('#clearCartBtn').addEventListener('click', ()=>{ CART=[]; saveCart(); });
$('#goCheckoutBtn').addEventListener('click', ()=>{ openCheckout(); });

function openCheckout(){
  if (!CART || CART.length===0) { alert('Cart is empty'); return; }
  $('#checkoutSection').style.display='block';
  const eta = new Date(); eta.setDate(eta.getDate() + 4);
  $('#etaText').textContent = eta.toDateString();
}

// account area render
function renderAccount(){
  const area = $('#accountArea');
  const auth = localStorage.getItem('pooja_token') || null;
  if (!auth){
    area.innerHTML = `<div><button id="showLoginBtn" class="btn">Login</button> <button id="showSignupBtn" class="btn ghost">Signup</button></div>`;
    $('#showLoginBtn').addEventListener('click', showLogin);
    $('#showSignupBtn').addEventListener('click', showSignup);
  } else {
    const u = JSON.parse(localStorage.getItem('pooja_user'));
    area.innerHTML = `<div><strong>${u.name}</strong><div class="muted">${u.email}</div><div style="margin-top:8px"><button id="myOrdersBtn" class="btn">My Orders</button> <button id="logoutBtn" class="btn ghost">Logout</button></div></div>`;
    $('#logoutBtn').addEventListener('click', logout);
    $('#myOrdersBtn').addEventListener('click', myOrders);
  }
}

function showLogin(){
  const name = prompt('Email');
  const pass = prompt('Password');
  if (!name || !pass) return;
  fetch('/api/login', {method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({email:name,password:pass}), credentials:'include'})
    .then(r=>r.json()).then(res=>{
      if (res.error){ alert(res.error); return; }
      localStorage.setItem('pooja_user', JSON.stringify(res.user)); // convenience
      // token cookie is set by server
      renderAccount();
      alert('Logged in');
    });
}
function showSignup(){
  const name = prompt('Full name');
  const email = prompt('Email');
  const phone = prompt('Phone (optional)');
  const pass = prompt('Password');
  if (!name || !email || !pass) return;
  fetch('/api/signup', {method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({name, email, phone, password: pass}), credentials:'include'})
    .then(r=>r.json()).then(res=>{
      if (res.error) { alert(res.error); return; }
      localStorage.setItem('pooja_user', JSON.stringify(res.user));
      renderAccount();
      alert('Account created and logged in');
    });
}

function logout(){
  fetch('/api/logout', {method:'POST', credentials:'include'}).then(()=>{
    localStorage.removeItem('pooja_user');
    renderAccount();
    alert('Logged out');
  });
}

async function myOrders(){
  // Not implementing full my-orders list for brevity - could fetch admin export or user orders endpoint
  alert('My orders will show here (future enhancement)');
}

// place order
$('#placeOrderBtn').addEventListener('click', async ()=>{
  const form = document.getElementById('checkoutForm');
  const name = form.name.value.trim(), phone=form.phone.value.trim(), address=form.address.value.trim(), city=form.city.value.trim(), pin=form.pin.value.trim();
  if (!name || !phone || !address) { alert('Please fill required'); return; }
  const eta = new Date(); eta.setDate(eta.getDate()+4);
  const payload = { name, phone, address, city, pin, items: CART, total: CART.reduce((s,i)=>s+i.price,0), eta: eta.getTime(), userToken: null };
  // if logged-in, get token cookie (server sets httpOnly cookie) — but for server-side we also accept userToken if available
  // send order
  const res = await fetch('/api/order', {method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify(payload)});
  const data = await res.json();
  if (data.ok){ alert('Order placed! Tracking id: ' + data.id); CART=[]; saveCart(); $('#checkoutSection').style.display='none'; } else { alert('Order failed: ' + (data.error||'unknown')); }
});

// tracking
$('#trackBtn').addEventListener('click', async ()=>{
  const id = $('#trackingInput').value.trim();
  if (!id) return alert('Enter tracking id');
  const res = await fetch('/api/track/' + id);
  if (res.status === 404) return $('#trackResult').innerHTML = '<div class="muted">No order found</div>';
  const o = await res.json();
  $('#trackResult').innerHTML = `<div><strong>Tracking:</strong> ${o.id}</div><div><strong>Name:</strong> ${o.name}</div><div><strong>Status:</strong> ${o.status}</div><div><strong>ETA:</strong> ${o.eta ? new Date(o.eta).toDateString() : '-'}</div><div style="margin-top:8px"><strong>Items:</strong><ul>${o.items.map(i=>'<li>'+i.title+' — ₹'+i.price+'</li>').join('')}</ul></div>`;
});

// nav buttons
$('#btnShop').addEventListener('click', ()=>{ $('#shopSection').scrollIntoView(); });
$('#btnTrack').addEventListener('click', ()=>{ $('#trackSection').scrollIntoView(); });
$('#btnAdmin').addEventListener('click', ()=>{ window.location = '/admin.html'; });
$('#openAdminBtn').addEventListener('click', ()=>{ window.location = '/admin.html'; });

// init
loadProducts(); renderCart(); renderAccount();
