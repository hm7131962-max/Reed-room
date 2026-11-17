require('dotenv').config();
const express = require('express');
const helmet = require('helmet');
const cors = require('cors');
const rateLimit = require('express-rate-limit');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { Pool } = require('pg');
const crypto = require('crypto');

const required = ['CUSTOMER_DATABASE_URL','BENEFICIARY_DATABASE_URL','JWT_SECRET','ADMIN_USERNAME','ADMIN_PASSWORD'];
for (const key of required) if (!process.env[key]) { console.error(`Missing environment variable: ${key}`); process.exit(1); }
if (process.env.JWT_SECRET.length < 32) throw new Error('JWT_SECRET must contain at least 32 characters');
const dbOptions = { ssl: process.env.DATABASE_SSL === 'false' ? false : { rejectUnauthorized: false }, max: 10 };
const pool = new Pool({ ...dbOptions, connectionString: process.env.CUSTOMER_DATABASE_URL });
const beneficiaryPool = new Pool({ ...dbOptions, connectionString: process.env.BENEFICIARY_DATABASE_URL });
const app = express();
app.set('trust proxy', 1);
app.use(helmet());
app.use(cors({ origin: (process.env.ALLOWED_ORIGINS || '').split(',').filter(Boolean), credentials: false }));
app.use(express.json({ limit: '32kb' }));
app.use('/api/auth', rateLimit({ windowMs: 15 * 60 * 1000, limit: 30, standardHeaders: true, legacyHeaders: false }));
const asyncRoute = fn => (req,res,next) => Promise.resolve(fn(req,res,next)).catch(next);
const tokenFor = (payload) => jwt.sign(payload, process.env.JWT_SECRET, { expiresIn: payload.role === 'admin' ? '8h' : '12h', issuer: 'red-room-demo' });
function auth(role) {
 return (req,res,next) => {
  const value = req.headers.authorization || '';
  try { const decoded = jwt.verify(value.replace(/^Bearer\s+/i,''), process.env.JWT_SECRET, {issuer:'red-room-demo'}); if (role && decoded.role !== role) return res.status(403).json({error:'غير مصرح'}); req.user=decoded; next(); }
  catch { return res.status(401).json({error:'يلزم تسجيل الدخول'}); }
 };
}
const admin = auth('admin'), customer = auth('customer');
const clean = v => String(v ?? '').trim();
const validAccount = v => /^[0-9A-Za-z-]{4,32}$/.test(v);
const publicCustomer = r => ({id:r.id,bankId:r.bank_id,bankName:r.bank_name,branchId:r.branch_id,branchName:r.branch_name,accountNumber:r.account_number,fullName:r.full_name,accountType:r.account_type,balance:Number(r.balance),status:r.status,createdAt:r.created_at});

async function initialize() {
 const fs = require('fs'); const path = require('path');
 await pool.query(fs.readFileSync(path.join(__dirname,'..','schema-customers.sql'),'utf8'));
 await beneficiaryPool.query(fs.readFileSync(path.join(__dirname,'..','schema-beneficiaries.sql'),'utf8'));
 const hash = await bcrypt.hash(process.env.ADMIN_PASSWORD, 12);
 await pool.query(`INSERT INTO operations.admins(username,password_hash) VALUES($1,$2) ON CONFLICT(username) DO UPDATE SET password_hash=EXCLUDED.password_hash`,[process.env.ADMIN_USERNAME,hash]);
}
app.get('/api/health', asyncRoute(async (_req,res)=>{await pool.query('SELECT 1');await beneficiaryPool.query('SELECT 1');res.json({ok:true,service:'RED ROOM demo API',databases:{customers:'connected',beneficiaries:'connected'}});}));
app.post('/api/auth/admin', asyncRoute(async(req,res)=>{
 const {username,password}=req.body||{}; const q=await pool.query('SELECT id,username,password_hash FROM operations.admins WHERE username=$1',[clean(username)]);
 if(!q.rowCount || !(await bcrypt.compare(String(password||''),q.rows[0].password_hash))) return res.status(401).json({error:'بيانات الدخول غير صحيحة'});
 res.json({token:tokenFor({sub:q.rows[0].id,role:'admin',username:q.rows[0].username}),role:'admin'});
}));
app.post('/api/auth/customer', asyncRoute(async(req,res)=>{
 const {accountNumber,password}=req.body||{};
 const q=await pool.query(`SELECT c.*,b.name bank_name,br.name branch_name FROM customer_data.customers c JOIN customer_data.banks b ON b.id=c.bank_id JOIN customer_data.branches br ON br.id=c.branch_id WHERE c.account_number=$1`,[clean(accountNumber)]);
 if(!q.rowCount || q.rows[0].status!=='active' || !(await bcrypt.compare(String(password||''),q.rows[0].password_hash))) return res.status(401).json({error:'بيانات الدخول غير صحيحة أو الحساب غير نشط'});
 const c=publicCustomer(q.rows[0]); res.json({token:tokenFor({sub:c.id,role:'customer',accountNumber:c.accountNumber}),customer:c});
}));
app.get('/api/admin/banks',admin,asyncRoute(async(_req,res)=>{const q=await pool.query('SELECT id,code,name FROM customer_data.banks ORDER BY name');res.json(q.rows);}));
app.post('/api/admin/banks/:bankId/branches',admin,asyncRoute(async(req,res)=>{const {name}=req.body||{};const q=await pool.query('INSERT INTO customer_data.branches(bank_id,name) VALUES($1,$2) RETURNING *',[req.params.bankId,clean(name)]);res.status(201).json(q.rows[0]);}));
app.get('/api/admin/branches',admin,asyncRoute(async(req,res)=>{const q=await pool.query('SELECT br.*,b.name bank_name FROM customer_data.branches br JOIN customer_data.banks b ON b.id=br.bank_id WHERE ($1::uuid IS NULL OR br.bank_id=$1) ORDER BY b.name,br.name',[req.query.bankId||null]);res.json(q.rows);}));
app.get('/api/admin/customers',admin,asyncRoute(async(req,res)=>{const q=await pool.query(`SELECT c.*,b.name bank_name,br.name branch_name FROM customer_data.customers c JOIN customer_data.banks b ON b.id=c.bank_id JOIN customer_data.branches br ON br.id=c.branch_id WHERE ($1::uuid IS NULL OR c.bank_id=$1) ORDER BY c.created_at DESC`,[req.query.bankId||null]);res.json(q.rows.map(publicCustomer));}));
app.post('/api/admin/customers',admin,asyncRoute(async(req,res)=>{
 const x=req.body||{}; const account=clean(x.accountNumber),name=clean(x.fullName),password=String(x.password||''),balance=Number(x.balance||0);
 if(!validAccount(account)||!name||password.length<10||!Number.isFinite(balance)||balance<0) return res.status(400).json({error:'تحقق من رقم الحساب والاسم وكلمة المرور (10 أحرف على الأقل) والرصيد'});
 const hash=await bcrypt.hash(password,12);
 const q=await pool.query(`INSERT INTO customer_data.customers(bank_id,branch_id,account_number,full_name,account_type,password_hash,balance,status) VALUES($1,$2,$3,$4,$5,$6,$7,$8) RETURNING id`,[x.bankId,x.branchId,account,name,clean(x.accountType)||'savings',hash,balance,['active','frozen','disabled'].includes(x.status)?x.status:'active']);
 const out=await pool.query(`SELECT c.*,b.name bank_name,br.name branch_name FROM customer_data.customers c JOIN customer_data.banks b ON b.id=c.bank_id JOIN customer_data.branches br ON br.id=c.branch_id WHERE c.id=$1`,[q.rows[0].id]);res.status(201).json(publicCustomer(out.rows[0]));
}));
app.patch('/api/admin/customers/:id',admin,asyncRoute(async(req,res)=>{
 const x=req.body||{}; const fields=[],values=[]; const add=(col,val)=>{values.push(val);fields.push(`${col}=$${values.length}`);};
 if(x.fullName!==undefined)add('full_name',clean(x.fullName)); if(x.branchId!==undefined)add('branch_id',x.branchId); if(x.accountType!==undefined)add('account_type',clean(x.accountType)); if(x.status!==undefined&&['active','frozen','disabled'].includes(x.status))add('status',x.status);
 if(x.password){if(String(x.password).length<10)return res.status(400).json({error:'كلمة المرور يجب أن تكون 10 أحرف على الأقل'});add('password_hash',await bcrypt.hash(String(x.password),12));}
 if(!fields.length)return res.status(400).json({error:'لا توجد تعديلات'}); values.push(req.params.id);
 const q=await pool.query(`UPDATE customer_data.customers SET ${fields.join(',')},updated_at=now() WHERE id=$${values.length} RETURNING id`,values);
 if(!q.rowCount)return res.status(404).json({error:'الحساب غير موجود'});
 const out=await pool.query(`SELECT c.*,b.name bank_name,br.name branch_name FROM customer_data.customers c JOIN customer_data.banks b ON b.id=c.bank_id JOIN customer_data.branches br ON br.id=c.branch_id WHERE c.id=$1`,[req.params.id]);res.json(publicCustomer(out.rows[0]));
}));
app.post('/api/admin/customers/:id/balance',admin,asyncRoute(async(req,res)=>{
 const amount=Number(req.body?.amount),reason=clean(req.body?.reason)||'تعديل رصيد من لوحة الإدارة'; if(!Number.isFinite(amount)||amount===0)return res.status(400).json({error:'أدخل مبلغاً موجباً أو سالباً'});
 const cx=await pool.connect();try{await cx.query('BEGIN');const q=await cx.query('SELECT balance FROM customer_data.customers WHERE id=$1 FOR UPDATE',[req.params.id]);if(!q.rowCount)throw Object.assign(new Error('الحساب غير موجود'),{status:404});const next=Number(q.rows[0].balance)+amount;if(next<0)throw Object.assign(new Error('الرصيد لا يسمح بهذا التعديل'),{status:400});await cx.query('UPDATE customer_data.customers SET balance=$1,updated_at=now() WHERE id=$2',[next,req.params.id]);await cx.query('INSERT INTO operations.balance_events(customer_id,admin_id,amount,balance_after,reason) VALUES($1,$2,$3,$4,$5)',[req.params.id,req.user.sub,amount,next,reason]);await cx.query('COMMIT');res.json({balance:next});}catch(e){await cx.query('ROLLBACK');throw e;}finally{cx.release();}
}));
app.get('/api/admin/beneficiaries',admin,asyncRoute(async(_req,res)=>{const q=await beneficiaryPool.query('SELECT * FROM beneficiary_data.beneficiaries ORDER BY created_at DESC');res.json(q.rows);}));
app.post('/api/admin/beneficiaries',admin,asyncRoute(async(req,res)=>{const x=req.body||{};if(!validAccount(clean(x.accountNumber))||!clean(x.fullName)||!clean(x.bankName)||!clean(x.branchName)||!clean(x.accountType))return res.status(400).json({error:'كل بيانات المستفيد مطلوبة'});const q=await beneficiaryPool.query(`INSERT INTO beneficiary_data.beneficiaries(account_number,full_name,bank_name,branch_name,account_type) VALUES($1,$2,$3,$4,$5) RETURNING *`,[clean(x.accountNumber),clean(x.fullName),clean(x.bankName),clean(x.branchName),clean(x.accountType)]);res.status(201).json(q.rows[0]);}));
app.patch('/api/admin/beneficiaries/:id',admin,asyncRoute(async(req,res)=>{const x=req.body||{};const q=await beneficiaryPool.query(`UPDATE beneficiary_data.beneficiaries SET account_number=COALESCE($1,account_number),full_name=COALESCE($2,full_name),bank_name=COALESCE($3,bank_name),branch_name=COALESCE($4,branch_name),account_type=COALESCE($5,account_type) WHERE id=$6 RETURNING *`,[x.accountNumber??null,x.fullName??null,x.bankName??null,x.branchName??null,x.accountType??null,req.params.id]);if(!q.rowCount)return res.status(404).json({error:'المستفيد غير موجود'});res.json(q.rows[0]);}));
app.delete('/api/admin/beneficiaries/:id',admin,asyncRoute(async(req,res)=>{const q=await beneficiaryPool.query('DELETE FROM beneficiary_data.beneficiaries WHERE id=$1',[req.params.id]);res.status(q.rowCount?204:404).end();}));
app.get('/api/customer/me',customer,asyncRoute(async(req,res)=>{const q=await pool.query(`SELECT c.*,b.name bank_name,br.name branch_name FROM customer_data.customers c JOIN customer_data.banks b ON b.id=c.bank_id JOIN customer_data.branches br ON br.id=c.branch_id WHERE c.id=$1`,[req.user.sub]);if(!q.rowCount)return res.status(404).json({error:'الحساب غير موجود'});res.json(publicCustomer(q.rows[0]));}));
app.get('/api/customer/beneficiaries/:accountNumber',customer,asyncRoute(async(req,res)=>{const q=await beneficiaryPool.query('SELECT id,account_number,full_name,bank_name,branch_name,account_type FROM beneficiary_data.beneficiaries WHERE account_number=$1 ORDER BY bank_name',[clean(req.params.accountNumber)]);res.json(q.rows);}));
app.post('/api/customer/transfers',customer,asyncRoute(async(req,res)=>{
 const amount=Number(req.body?.amount), beneficiaryId=clean(req.body?.beneficiaryId); if(!Number.isFinite(amount)||amount<=0||amount>100000000)return res.status(400).json({error:'مبلغ التحويل غير صالح'});
 const cx=await pool.connect();try{await cx.query('BEGIN');const sender=await cx.query('SELECT id,account_number,balance,status FROM customer_data.customers WHERE id=$1 FOR UPDATE',[req.user.sub]);if(!sender.rowCount||sender.rows[0].status!=='active')throw Object.assign(new Error('الحساب غير نشط'),{status:403});const b=await beneficiaryPool.query('SELECT id,account_number,full_name,bank_name,branch_name,account_type FROM beneficiary_data.beneficiaries WHERE id=$1',[beneficiaryId]);if(!b.rowCount)throw Object.assign(new Error('المستفيد غير موجود'),{status:404});if(Number(sender.rows[0].balance)<amount)throw Object.assign(new Error('الرصيد غير كافٍ'),{status:400});const next=Number(sender.rows[0].balance)-amount;await cx.query('UPDATE customer_data.customers SET balance=$1,updated_at=now() WHERE id=$2',[next,req.user.sub]);const reference='RR-'+crypto.randomBytes(8).toString('hex').toUpperCase();const ben=b.rows[0];const t=await cx.query(`INSERT INTO operations.transfers(sender_customer_id,sender_account,beneficiary_id,beneficiary_account,beneficiary_name,beneficiary_bank,beneficiary_branch,beneficiary_type,amount,reference) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10) RETURNING id,reference,amount,status,created_at`,[req.user.sub,sender.rows[0].account_number,ben.id,ben.account_number,ben.full_name,ben.bank_name,ben.branch_name,ben.account_type,amount,reference]);await cx.query('COMMIT');res.status(201).json({...t.rows[0],balance:next,notice:'تحويل تجريبي داخل RED ROOM؛ لا توجد حركة أموال حقيقية.'});}catch(e){await cx.query('ROLLBACK');throw e;}finally{cx.release();}
}));
app.get('/api/customer/transfers',customer,asyncRoute(async(req,res)=>{const q=await pool.query(`SELECT id,reference,amount,status,created_at,beneficiary_name,beneficiary_bank bank_name,beneficiary_account account_number FROM operations.transfers WHERE sender_customer_id=$1 ORDER BY created_at DESC LIMIT 100`,[req.user.sub]);res.json(q.rows);}));
app.use(express.static(require('path').join(__dirname,'..','..')));
app.use((err,_req,res,_next)=>{console.error(err);res.status(err.status|| (err.code==='23505'?409:500)).json({error:err.code==='23505'?'السجل موجود مسبقاً':(err.status?err.message:'حدث خطأ داخلي')});});
const port=process.env.PORT||3000;
initialize().then(()=>app.listen(port,()=>console.log(`RED ROOM API listening on ${port}`))).catch(e=>{console.error('Database initialization failed',e);process.exit(1);});
