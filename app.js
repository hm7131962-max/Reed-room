/* RED ROOM V3.0 — Multi-bank local demo
   Local-only prototype. It is not connected to real banks or payment rails. */
(() => {
  "use strict";
  const STORE = "redRoomMultiBank.v3";
  const $ = (s, root=document) => root.querySelector(s);
  const $$ = (s, root=document) => [...root.querySelectorAll(s)];
  const money = n => Number(n||0).toLocaleString("en-US");
  const uid = () => "id_" + Date.now().toString(36) + Math.random().toString(36).slice(2,7);
  const esc = s => String(s ?? "").replace(/[&<>"']/g, c => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
  const palettes = {
    khartoum:{name:"RED ROOM",accent:"#ff263f",accent2:"#8e1026"},
    omdurman:{name:"BLOOD GOLD",accent:"#ffc247",accent2:"#ff7b36"},
    faisal:{name:"ICE",accent:"#48b9ff",accent2:"#245b91"},
    nilein:{name:"PHANTOM",accent:"#b66cff",accent2:"#6327a0"},
    islamic:{name:"TOXIC",accent:"#b6ff00",accent2:"#527d00"}
  };
  const seed = [
    {id:"khartoum",name:"بنك الخرطوم",icon:"🏦",theme:"khartoum",branches:["الخرطوم - الرياض","الخرطوم - السوق العربي","بحري"],accounts:[
      {id:uid(),name:"أحمد محمد",acc:"4839201",pass:"A7k9P2xQ",branch:"الخرطوم - الرياض",bal:25000,status:"active"},
      {id:uid(),name:"سارة علي",acc:"5928104",pass:"S3m8Qw1Z",branch:"الخرطوم - السوق العربي",bal:8500,status:"frozen"},
      {id:uid(),name:"محمد يوسف",acc:"1928374",pass:"M9x2K7pL",branch:"بحري",bal:14200,status:"active"}]},
    {id:"omdurman",name:"بنك أم درمان الوطني",icon:"🏛️",theme:"omdurman",branches:["أم درمان - السوق","أم درمان - الثورة","أم درمان - بانت"],accounts:[
      {id:uid(),name:"خالد عمر",acc:"7482019",pass:"K5h8T2vN",branch:"أم درمان - السوق",bal:32000,status:"active"},
      {id:uid(),name:"نور الهدى",acc:"3819205",pass:"N2k8P9xQ",branch:"أم درمان - الثورة",bal:12000,status:"active"}]},
    {id:"faisal",name:"بنك فيصل الإسلامي",icon:"🕌",theme:"faisal",branches:["الخرطوم - فيصل","مدني - فيصل"],accounts:[
      {id:uid(),name:"عمر الفاروق",acc:"9182734",pass:"O7m2K9xL",branch:"الخرطوم - فيصل",bal:55000,status:"active"}]},
    {id:"nilein",name:"بنك النيلين",icon:"🌊",theme:"nilein",branches:["الخرطوم - النيلين","بورتسودان"],accounts:[
      {id:uid(),name:"مريم أحمد",acc:"1928375",pass:"M8x2K7pL",branch:"الخرطوم - النيلين",bal:18000,status:"active"},
      {id:uid(),name:"يوسف علي",acc:"2839401",pass:"Y3k9P2xQ",branch:"بورتسودان",bal:9000,status:"frozen"}]},
    {id:"islamic",name:"البنك الإسلامي السوداني",icon:"☪️",theme:"islamic",branches:["الخرطوم - الإسلامي","كسلا"],accounts:[
      {id:uid(),name:"فاطمة حسن",acc:"4839202",pass:"F7k9P2xQ",branch:"الخرطوم - الإسلامي",bal:22000,status:"active"}]}
  ];
  const clone = x => JSON.parse(JSON.stringify(x));
  let state;
  try { state = JSON.parse(localStorage.getItem(STORE)) || null; } catch {}
  if (!state || !Array.isArray(state.banks)) state = {banks:clone(seed),ops:[],current:"khartoum",mode:"global",light:false,skin:"redroom"};
  state.ops ||= [];
  let page = "banks", reveal = new Set(), editingId = null;

  function save(){ localStorage.setItem(STORE, JSON.stringify(state)); }
  function bank(){ return state.banks.find(b=>b.id===state.current) || state.banks[0]; }
  function allAccounts(){ return state.banks.flatMap(b=>b.accounts.map(a=>({...a,bankId:b.id,bankName:b.name}))); }
  function totalBalance(b){ return b.accounts.reduce((s,a)=>s+Number(a.bal||0),0); }
  function toast(msg){ const el=$("#toast"); el.textContent=msg; el.classList.add("show"); setTimeout(()=>el.classList.remove("show"),2300); }
  function setSkin(){
    const b=bank(); document.body.dataset.bank=b.theme in palettes?b.theme:"khartoum";
    document.body.dataset.skin=state.skin||"redroom";
    document.body.classList.toggle("light",!!state.light);
    $$(".mode-btn").forEach(x=>x.classList.toggle("active",x.dataset.mode===state.mode));
    $("#themeBtn").textContent=state.light?"☀":"◐";
  }
  function updateSelect(){
    $("#bankSelect").innerHTML=state.banks.map(b=>`<option value="${esc(b.id)}" ${b.id===state.current?"selected":""}>${esc(b.icon)} ${esc(b.name)}</option>`).join("");
  }
  function heading(title,desc,mode){
    $("#pageTitle").innerHTML=title; $("#pageDescription").textContent=desc;
    $("#headingMode").textContent=mode || (state.mode==="global"?"GLOBAL VIEW":"BANK VIEW");
  }
  function panelHead(title,sub,action=""){
    return `<div class="panel-head"><div><h3>${title}</h3><p>${sub}</p></div>${action}</div>`;
  }
  function stats(){
    const acc=allAccounts(), bal=acc.reduce((s,a)=>s+Number(a.bal),0);
    return `<div class="grid stats-grid">
      <article class="stat-card"><div class="stat-top">عدد الحسابات <span class="stat-icon">♙</span></div><div class="stat-value">${acc.length}</div><div class="stat-foot">في جميع البنوك</div></article>
      <article class="stat-card"><div class="stat-top">إجمالي الأرصدة <span class="stat-icon">◈</span></div><div class="stat-value">${money(bal)}</div><div class="stat-foot">قيمة تجريبية بالجنيه</div></article>
      <article class="stat-card"><div class="stat-top">البنوك المسجلة <span class="stat-icon">▤</span></div><div class="stat-value">${state.banks.length}</div><div class="stat-foot">بنوك مستقلة داخل التطبيق</div></article>
      <article class="stat-card"><div class="stat-top">العمليات المسجلة <span class="stat-icon">↻</span></div><div class="stat-value">${state.ops.length}</div><div class="stat-foot">شحن وسحب وتعديلات</div></article>
    </div>`;
  }
  function bankCards(){
    return `<div class="grid bank-cards">${state.banks.map(b=>`<article class="panel bank-card" style="--bank-color:${palettes[b.theme]?.accent||"#ff263f"}" data-open-bank="${esc(b.id)}">
      <div class="bank-card-top"><div class="bank-card-icon">${esc(b.icon)}</div><span class="tag">${b.accounts.length} حساب</span></div>
      <h3>${esc(b.name)}</h3><p>${b.branches.length} فروع مسجلة</p>
      <div class="bank-card-bottom"><span>إجمالي الرصيد</span><b>${money(totalBalance(b))}</b></div></article>`).join("")}
    </div>`;
  }
  function dashboard(){
    heading("إدارة <span>البنوك</span>","نظرة عامة على البنوك والحسابات والعمليات.");
    $("#pageContent").innerHTML=stats()+`<div class="grid content-grid"><section class="panel">${panelHead("البنوك المسجلة","اختر بنكاً لفتح حساباته وفروعه.")}${bankCards()}</section>
      <section class="panel">${panelHead("آخر العمليات","أحدث الحركات المسجلة محلياً.")}${opsTable(state.ops.slice(0,7))}</section></div>`;
  }
  function opsTable(items){
    if(!items.length) return `<div class="empty">لا توجد عمليات مسجلة حتى الآن.</div>`;
    return `<div class="table-wrap"><table><thead><tr><th>الوقت</th><th>البنك</th><th>الحساب</th><th>النوع</th><th>المبلغ</th></tr></thead><tbody>${items.map(o=>`<tr><td>${esc(o.time)}</td><td>${esc(o.bank)}</td><td class="mono">${esc(o.acc)}</td><td>${esc(o.type)}</td><td class="mono">${money(o.amount)}</td></tr>`).join("")}</tbody></table></div>`;
  }
  function accountsPage(){
    const b=bank(); heading("حسابات <span>البنك</span>",`إدارة حسابات ${b.name} فقط.`);
    const rows=b.accounts.map(a=>`<tr><td>${esc(a.name)}</td><td class="mono">${esc(a.acc)}</td><td class="mono">${reveal.has(a.id)?esc(a.pass):"••••••••"} <button class="btn" data-reveal="${a.id}">${reveal.has(a.id)?"إخفاء":"عرض"}</button></td><td>${esc(a.branch)}</td><td class="mono">${money(a.bal)}</td><td><span class="status ${a.status}">${a.status==="active"?"نشط":"مجمّد"}</span></td><td><button class="btn" data-edit="${a.id}">تعديل</button> <button class="btn" data-toggle="${a.id}">${a.status==="active"?"تجميد":"تفعيل"}</button> <button class="btn" data-delete="${a.id}">حذف</button></td></tr>`).join("");
    $("#pageContent").innerHTML=stats()+`<section class="panel">${panelHead(`حسابات ${esc(b.name)}`,"البيانات المعروضة تخص البنك المحدد فقط.",`<button class="btn btn-primary" id="addAccount">＋ حساب جديد</button>`)}
      <div class="filters-row"><input id="accountSearch" placeholder="بحث بالاسم أو رقم الحساب أو الفرع"><select id="branchFilter"><option value="">كل الفروع</option>${b.branches.map(x=>`<option>${esc(x)}</option>`).join("")}</select></div>
      <div class="table-wrap"><table><thead><tr><th>الاسم</th><th>رقم الحساب</th><th>كلمة المرور</th><th>الفرع</th><th>الرصيد</th><th>الحالة</th><th>الإجراءات</th></tr></thead><tbody id="accountRows">${rows||`<tr><td colspan="7" class="empty">لا توجد حسابات في هذا البنك.</td></tr>`}</tbody></table></div>
      <p class="muted-note">تنبيه: هذه بيانات تجريبية محفوظة على هذا الجهاز فقط. لا تستخدم كلمات مرور حقيقية أو بيانات عملاء حقيقية.</p></section>
      <section class="panel">${panelHead("شحن / سحب","تعديل رصيد تجريبي مع تسجيل الحركة.")}${transactionForm()}</section>`;
    $("#addAccount").onclick=()=>accountModal();
    $("#accountSearch").oninput=filterAccounts; $("#branchFilter").onchange=filterAccounts;
  }
  function filterAccounts(){
    const q=$("#accountSearch").value.toLowerCase(), br=$("#branchFilter").value;
    $$("#accountRows tr").forEach(r=>r.hidden=!(r.textContent.toLowerCase().includes(q)&&(!br||r.children[3]?.textContent===br)));
  }
  function transactionForm(){
    const b=bank();
    return `<form id="transactionForm" class="field-stack"><label>الحساب<select name="account" required>${b.accounts.map(a=>`<option value="${a.id}">${esc(a.name)} — ${esc(a.acc)}</option>`).join("")}</select></label>
      <label>نوع العملية<select name="type"><option value="شحن">شحن</option><option value="سحب">سحب</option></select></label>
      <label>المبلغ<input name="amount" type="number" min="0.01" step="0.01" required placeholder="أدخل المبلغ"></label>
      <label>ملاحظة (اختياري)<input name="note" maxlength="120" placeholder="سبب العملية"></label><button class="btn btn-primary full" ${b.accounts.length?"":"disabled"}>تنفيذ العملية</button></form>`;
  }
  function branchesPage(){
    const b=bank(); heading("إدارة <span>الفروع</span>",`إضافة وإزالة فروع ${b.name}.`);
    $("#pageContent").innerHTML=`<section class="panel">${panelHead(`فروع ${esc(b.name)}`,"كل بنك يحتفظ بقائمة فروع مستقلة.",`<button class="btn btn-primary" id="addBranch">＋ إضافة فرع</button>`)}
      <div class="grid branch-grid">${b.branches.map((br,i)=>`<article class="panel branch-card"><span class="tag">BRANCH ${String(i+1).padStart(2,"0")}</span><h3>⌖ ${esc(br)}</h3><p>${b.accounts.filter(a=>a.branch===br).length} حساب مرتبط بهذا الفرع</p><div class="branch-meta"><span>${esc(b.name)}</span><button class="btn" data-remove-branch="${i}">حذف</button></div></article>`).join("")||`<div class="empty">لا توجد فروع.</div>`}</div></section>`;
    $("#addBranch").onclick=()=>showModal(`<h2>إضافة فرع</h2><form id="branchForm" class="field-stack"><label>اسم الفرع<input name="name" required maxlength="70" placeholder="اسم الفرع"></label><button class="btn btn-primary full">إضافة</button></form>`);
  }
  function settingsPage(){
    const b=bank(); heading("السمات <span>والإعدادات</span>",`تخصيص ${b.name} دون التأثير على بقية البنوك.`);
    const skins=[["redroom","RED ROOM","#ff263f"],["bloodmoon","BLOOD MOON","#c51d36"],["phantom","PHANTOM","#b66cff"],["toxic","TOXIC","#b6ff00"],["ice","ICE","#48b9ff"]];
    $("#pageContent").innerHTML=`<div class="grid settings-grid"><section class="panel">${panelHead("إعدادات البنك","الاسم والأيقونة والهوية.")}<form id="bankSettings" class="field-stack">
      <label>اسم البنك<input name="name" required value="${esc(b.name)}"></label><label>الأيقونة<input name="icon" maxlength="5" value="${esc(b.icon)}"></label>
      <label>لون البنك<select name="theme">${Object.keys(palettes).map(k=>`<option value="${k}" ${b.theme===k?"selected":""}>${palettes[k].name}</option>`).join("")}</select></label>
      <button class="btn btn-primary full">حفظ إعدادات البنك</button></form></section>
      <section class="panel">${panelHead("إضافة بنك جديد","سيتم إنشاء بنك مستقل ببيانات وفروع منفصلة.")}<form id="newBankForm" class="field-stack"><label>اسم البنك<input name="name" required placeholder="مثال: بنك الجزيرة"></label><label>الأيقونة<input name="icon" value="🏦" maxlength="5"></label><button class="btn btn-primary full">＋ إنشاء بنك</button></form></section></div>
      <section class="panel skin-panel">${panelHead("مظهر الواجهة","اختيار نمط RED ROOM العام.")}<div class="skin-grid">${skins.map(([id,n,c])=>`<button class="skin-card ${state.skin===id?"selected":""}" data-skin-choice="${id}" style="--skin-accent:${c}"><span class="skin-swatch"></span><b>${n}</b><small>واجهة تحكم</small><i>${state.skin===id?"ACTIVE":"SELECT"}</i></button>`).join("")}</div>
      <div class="setting-row"><div><b>الوضع النهاري / الليلي</b><small>التبديل بين المظهر الفاتح والداكن.</small></div><button class="btn" id="lightToggle">${state.light?"الوضع النهاري ☀":"الوضع الليلي ◐"}</button></div></section>
      <section class="panel">${panelHead("النسخ الاحتياطي","تصدير نسخة JSON أو استيراد نسخة محفوظة.")}<div style="display:flex;gap:9px;flex-wrap:wrap"><button class="btn btn-primary" id="backupExport">تصدير نسخة احتياطية</button><label class="btn">استيراد نسخة<input id="backupImport" type="file" accept="application/json" hidden></label><button class="btn" id="csvExport">تصدير حسابات البنك CSV</button></div><p class="muted-note">البيانات محفوظة في LocalStorage داخل المتصفح. امسح بيانات المتصفح قد يؤدي إلى فقدانها؛ احتفظ بنسخة احتياطية دورية.</p></section>`;
    $("#bankSettings").onsubmit=e=>{e.preventDefault();const f=new FormData(e.target);b.name=f.get("name").trim();b.icon=f.get("icon").trim()||"🏦";b.theme=f.get("theme");save();render();toast("تم حفظ إعدادات البنك");};
    $("#newBankForm").onsubmit=e=>{e.preventDefault();const f=new FormData(e.target),name=f.get("name").trim();if(!name)return;const id=uid();state.banks.push({id,name,icon:f.get("icon").trim()||"🏦",theme:"khartoum",branches:["الفرع الرئيسي"],accounts:[]});state.current=id;save();render();toast("تم إنشاء البنك");};
    $$("[data-skin-choice]").forEach(x=>x.onclick=()=>{state.skin=x.dataset.skinChoice;save();setSkin();settingsPage();});
    $("#lightToggle").onclick=()=>{state.light=!state.light;save();setSkin();settingsPage();};
    $("#backupExport").onclick=()=>download("red-room-backup.json",JSON.stringify(state,null,2),"application/json");
    $("#backupImport").onchange=importBackup;
    $("#csvExport").onclick=exportCSV;
  }
  function showModal(html){$("#modalContent").innerHTML=html;$("#modalBackdrop").classList.add("show");}
  function closeModal(){$("#modalBackdrop").classList.remove("show");$("#modalContent").innerHTML="";}
  function accountModal(a=null){
    editingId=a?.id||null; const b=bank();
    showModal(`<h2>${a?"تعديل حساب":"إضافة حساب جديد"}</h2><p>سيتم حفظ الحساب داخل ${esc(b.name)} فقط.</p><form id="accountForm" class="field-stack">
      <label>اسم العميل<input name="name" required maxlength="90" value="${esc(a?.name||"")}"></label>
      <label>رقم الحساب (7 أرقام)<input name="acc" required inputmode="numeric" pattern="[0-9]{7}" maxlength="7" value="${esc(a?.acc||"")}"></label>
      <label>كلمة مرور تجريبية (8 رموز)<input name="pass" required minlength="8" maxlength="8" value="${esc(a?.pass||"")}"></label>
      <label>الفرع<select name="branch">${b.branches.map(x=>`<option ${a?.branch===x?"selected":""}>${esc(x)}</option>`).join("")}</select></label>
      <label>الرصيد الافتتاحي<input name="bal" type="number" min="0" step="0.01" required value="${Number(a?.bal||0)}"></label>
      <label>الحالة<select name="status"><option value="active" ${a?.status!=="frozen"?"selected":""}>نشط</option><option value="frozen" ${a?.status==="frozen"?"selected":""}>مجمّد</option></select></label>
      <button class="btn btn-primary full">${a?"حفظ التعديلات":"إنشاء الحساب"}</button></form>`);
  }
  function record(type,b,a,amount,note=""){
    state.ops.unshift({id:uid(),time:new Date().toLocaleString("ar"),bank:b.name,bankId:b.id,acc:a.acc,type,amount:Number(amount),note});
    state.ops=state.ops.slice(0,1000);
  }
  function render(){
    setSkin(); updateSelect();
    $$(".nav-link").forEach(x=>x.classList.toggle("active",x.dataset.page===page));
    if(page==="banks")dashboard(); else if(page==="accounts")accountsPage(); else if(page==="branches")branchesPage(); else if(page==="settings")settingsPage(); else if(page==="operations"){heading("سجل <span>العمليات</span>","سجل الحركات التجريبية عبر جميع البنوك.");$("#pageContent").innerHTML=`<section class="panel">${panelHead("كل العمليات","الأحدث أولاً.")}${opsTable(state.ops)}</section>`;}
    save();
  }
  function download(name,data,type){
    const a=document.createElement("a"),url=URL.createObjectURL(new Blob([data],{type}));a.href=url;a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);
  }
  function exportCSV(){
    const b=bank(), lines=[["Bank","Name","Account","Branch","Balance","Status"],...b.accounts.map(a=>[b.name,a.name,a.acc,a.branch,a.bal,a.status])];
    const csv="\ufeff"+lines.map(row=>row.map(v=>'"'+String(v).replace(/"/g,'""')+'"').join(",")).join("\n");
    download(`${b.id}-accounts.csv`,csv,"text/csv;charset=utf-8");
  }
  function importBackup(e){
    const file=e.target.files[0];if(!file)return;const reader=new FileReader();
    reader.onload=()=>{try{const data=JSON.parse(reader.result);if(!Array.isArray(data.banks)||!data.banks.length)throw Error();state={...state,...data};state.current=state.banks.some(b=>b.id===state.current)?state.current:state.banks[0].id;save();render();toast("تم استيراد النسخة");}catch{alert("ملف النسخة الاحتياطية غير صالح");}};
    reader.readAsText(file);e.target.value="";
  }

  // Global click actions for rendered cards/tables.
  document.addEventListener("click",e=>{
    const t=e.target.closest("[data-open-bank],[data-edit],[data-toggle],[data-delete],[data-reveal],[data-remove-branch]");
    if(!t)return;
    if(t.dataset.openBank){state.current=t.dataset.openBank;page="accounts";render();}
    if(t.dataset.edit){const a=bank().accounts.find(x=>x.id===t.dataset.edit);if(a)accountModal(a);}
    if(t.dataset.toggle){const a=bank().accounts.find(x=>x.id===t.dataset.toggle);if(a){a.status=a.status==="active"?"frozen":"active";record(a.status==="active"?"تفعيل":"تجميد",bank(),a,0);save();render();toast("تم تحديث حالة الحساب");}}
    if(t.dataset.delete){const a=bank().accounts.find(x=>x.id===t.dataset.delete);if(a&&confirm(`تأكيد حذف الحساب ${a.acc}؟`)){bank().accounts=bank().accounts.filter(x=>x.id!==a.id);record("حذف",bank(),a,0);save();render();toast("تم حذف الحساب");}}
    if(t.dataset.reveal){const id=t.dataset.reveal;reveal.has(id)?reveal.delete(id):reveal.add(id);accountsPage();}
    if(t.dataset.removeBranch!==undefined){const b=bank(),i=Number(t.dataset.removeBranch),br=b.branches[i];if(b.accounts.some(a=>a.branch===br)){alert("لا يمكن حذف فرع مرتبط بحسابات. انقل الحسابات أولاً.");return;}if(confirm("حذف الفرع؟")){b.branches.splice(i,1);save();render();}}
  });
  $("#pageContent").addEventListener("submit",e=>{
    if(e.target.id==="accountForm"){
      e.preventDefault();const f=new FormData(e.target),b=bank(),acc=f.get("acc").trim(),pass=f.get("pass");
      if(!/^\d{7}$/.test(acc)){alert("رقم الحساب يجب أن يتكون من 7 أرقام.");return;}
      if(pass.length!==8){alert("كلمة المرور التجريبية يجب أن تكون 8 رموز.");return;}
      if(allAccounts().some(a=>a.acc===acc&&a.id!==editingId)){alert("رقم الحساب مستخدم بالفعل في بنك آخر أو في هذا البنك.");return;}
      const old=b.accounts.find(a=>a.id===editingId);
      const item={id:editingId||uid(),name:f.get("name").trim(),acc,pass,branch:f.get("branch"),bal:Number(f.get("bal")),status:f.get("status")};
      if(!item.name||!Number.isFinite(item.bal)||item.bal<0){alert("تحقق من الاسم والرصيد.");return;}
      if(old){Object.assign(old,item);record("تعديل حساب",b,item,0);}else{b.accounts.unshift(item);record("إنشاء حساب",b,item,item.bal);}
      closeModal();save();render();toast(old?"تم تعديل الحساب":"تم إنشاء الحساب");
    }
    if(e.target.id==="branchForm"){
      e.preventDefault();const name=new FormData(e.target).get("name").trim();if(name&&!bank().branches.includes(name)){bank().branches.push(name);save();closeModal();render();toast("تمت إضافة الفرع");}
    }
    if(e.target.id==="transactionForm"){
      e.preventDefault();const f=new FormData(e.target),b=bank(),a=b.accounts.find(x=>x.id===f.get("account")),amount=Number(f.get("amount")),type=f.get("type");
      if(!a||!Number.isFinite(amount)||amount<=0){alert("أدخل مبلغاً صحيحاً.");return;}
      if(type==="سحب"&&amount>a.bal){alert("الرصيد غير كافٍ.");return;}
      a.bal+=type==="شحن"?amount:-amount;record(type,b,a,amount,f.get("note"));save();render();toast(`تمت عملية ${type}`);
    }
  });
  $$(".nav-link").forEach(x=>x.addEventListener("click",e=>{e.preventDefault();page=x.dataset.page;render();}));
  $("#bankSelect").addEventListener("change",e=>{state.current=e.target.value;render();});
  $$(".mode-btn").forEach(x=>x.addEventListener("click",()=>{state.mode=x.dataset.mode;save();setSkin();if(state.mode==="bank"&&page==="banks")page="accounts";if(state.mode==="global"&&page==="accounts")page="banks";render();}));
  $("#themeBtn").addEventListener("click",()=>{state.light=!state.light;save();setSkin();});
  $("#quickSettings").addEventListener("click",()=>{page="settings";render();});
  $("#modalClose").addEventListener("click",closeModal);
  $("#modalBackdrop").addEventListener("click",e=>{if(e.target.id==="modalBackdrop")closeModal();});
  document.addEventListener("keydown",e=>{if(e.key==="Escape")closeModal();});
  render();
})();