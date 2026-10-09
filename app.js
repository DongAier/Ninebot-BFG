import {VehicleClient,capacities,profileVoltage,profileCapacity,dashboardVoltage,firmwareVersion,snapshotEligibility,buildBackup,validateBackup,backupRestoreEligibility} from './protocol.js';
const $=id=>document.getElementById(id);
let busy=false,demo=false,snapshot=null,imported=null,writeUncertain=false;
const logs=[];
function text(id,value){const el=$(id);if(el)el.textContent=value==null?'--':String(value);}
function log(message,level='info'){
  const item={time:new Date().toISOString(),level,message};logs.push(item);if(logs.length>400)logs.shift();
  const li=document.createElement('li');li.textContent=new Date().toLocaleTimeString('zh-CN')+' \u00b7 '+message;li.className='log-'+level;
  if($('log-list'))$('log-list').append(li);while($('log-list')&&$('log-list').children.length>400)$('log-list').firstChild.remove();
  const empty=document.querySelector('.log-empty');if(empty)empty.hidden=true;
}
function status(message){text('busy-text',message);}
function error(message){if($('error-box'))$('error-box').hidden=false;text('error-box',message);log(message,'error');}
function clearError(){if($('error-box'))$('error-box').hidden=true;}
const pageNames={connection:'\u8fde\u63a5\u4e0e\u914d\u5bf9',information:'\u8f66\u8f86\u4fe1\u606f',calibration:'\u53c2\u6570\u6821\u51c6',backup:'\u5907\u4efd\u4e0e\u6062\u590d'};
const pagePanels=[...document.querySelectorAll('[data-page]')];
function showPage(page,{historyMode='push',focus=true}={}){
  if(!Object.hasOwn(pageNames,page)||page!=='connection'&&(!snapshot||!demo&&!client.authenticated))page='connection';
  for(const panel of pagePanels)panel.hidden=panel.dataset.page!==page;
  document.title=pageNames[page]+' \u00b7 BFG \u7535\u91cf\u6821\u51c6';
  const hash='#'+page+'-section';
  if(historyMode==='replace')history.replaceState(null,'',hash);
  else if(historyMode==='push'&&location.hash!==hash)history.pushState(null,'',hash);
  if(focus){
    const heading=$(page+'-title');
    if(heading)heading.focus({preventScroll:true});
    window.scrollTo({top:0,behavior:'instant'});
  }
}
const client=new VehicleClient({log,status,disconnected:e=>{snapshot=null;demo=false;text('status-text','\u84dd\u7259\u5df2\u65ad\u5f00');status('\u8bf7\u91cd\u65b0\u8fde\u63a5\u5e76\u8ba4\u8bc1\u3002\u65e7\u8bfb\u6570\u4e0d\u518d\u4f5c\u4e3a\u5199\u5165\u4f9d\u636e');render(null);showPage('connection',{historyMode:'replace'});if(e)error(e.message);update();}});
function update(){
  const connected=client.connected,authenticated=client.authenticated,owner=$('owner-check')?$('owner-check').checked:false;
  if($('connect-btn'))$('connect-btn').disabled=busy||connected||!owner||!window.isSecureContext||!navigator.bluetooth;
  if($('pair-btn'))$('pair-btn').disabled=busy||!connected||authenticated||!owner||demo;
  if($('read-btn'))$('read-btn').disabled=busy||!authenticated||demo;
  if($('disconnect-btn'))$('disconnect-btn').disabled=!client.device&&!client.connecting;
  if($('demo-btn'))$('demo-btn').disabled=busy||connected;
  if($('write-type'))$('write-type').disabled=busy; 
  if($('target-voltage'))$('target-voltage').disabled=busy;
  if($('target-capacity'))$('target-capacity').disabled=busy||($('write-type')&&$('write-type').value==='dashboard');
  if($('owner-check'))$('owner-check').disabled=busy||connected;
  const kind=$('write-type')?$('write-type').value:'meter',voltage=$('target-voltage')?Number($('target-voltage').value):60,capacity=$('target-capacity')?Number($('target-capacity').value):26;
  const allowed=snapshotEligibility(snapshot,kind,voltage,capacity);
  text('write-reason',writeUncertain?'\u4e0a\u6b21\u5199\u5165\u7ed3\u679c\u672a\u786e\u8ba4\uff0c\u5df2\u9501\u5b9a\u3002\u8bf7\u65ad\u5f00\u5e76\u91cd\u65b0\u8bfb\u53d6\u540e\u518d\u51b3\u5b9a\u4e0b\u4e00\u6b65':allowed.ok?allowed.reason+'\uff1b\u5907\u4efd\u4e3a\u53ef\u9009\u64cd\u4f5c\uff0c\u4e0d\u5f71\u54cd\u5199\u5165':allowed.reason);
  if($('write-btn'))$('write-btn').disabled=busy||!owner||!authenticated||demo||!allowed.ok||writeUncertain;
  if($('export-backup-btn'))$('export-backup-btn').disabled=busy||!authenticated||!snapshot||demo;
  const restore=backupRestoreEligibility(imported,snapshot);
  if($('restore-btn'))$('restore-btn').disabled=busy||!authenticated||!owner||demo||!restore.ok||writeUncertain;
  if($('restore-btn'))$('restore-btn').title=restore.ok?'\u4ec5\u6062\u590d\u7cbe\u786e\u7684\u8ba1\u91cf\u6a21\u5757\u6863\u4f4d':restore.reason;
  if($('import-backup'))$('import-backup').disabled=busy||demo;
  for(const button of document.querySelectorAll('[data-go-page]'))button.disabled=busy||button.dataset.goPage!=='connection'&&(!snapshot||!demo&&!authenticated);
  text('mode-badge',demo?'\u754c\u9762\u6f14\u793a \u00b7 \u4e0d\u8fde\u63a5\u5b9e\u8f66':authenticated?'\u5df2\u8ba4\u8bc1 \u00b7 \u672c\u5730\u84dd\u7259':connected?'\u84dd\u7259\u8fde\u63a5 \u00b7 \u5f85\u8ba4\u8bc1':'\u672a\u8fde\u63a5');
  if($('meter-note'))$('meter-note').hidden=kind!=='meter';
  if($('dashboard-note'))$('dashboard-note').hidden=kind!=='dashboard';
}
function render(s){
  snapshot=s;
  text('info-sn',s?.sn);text('info-model',s?.demo?'\u6f14\u793a\u8f66\u8f86\uff08\u865a\u6784\uff09':s?'\u578b\u53f7\u672a\u7531\u8be5\u534f\u8bae\u76f4\u63a5\u63d0\u4f9b':'--');
  const soc=s?.soc!=null&&s.soc>=0&&s.soc<=100?s.soc:s?.dashboardSoc!=null&&s.dashboardSoc>=0&&s.dashboardSoc<=100?s.dashboardSoc:null;
  text('metric-soc',soc);text('metric-voltage',s?.batteryVoltage!=null?(s.batteryVoltage/100).toFixed(2):null);text('metric-capacity',s?.remainingCapacity!=null?(s.remainingCapacity/1000).toFixed(2):null);
  for(const key of ['dashboard','color','center','meter'])text('fw-'+key,firmwareVersion(s?.firmware?.[key]));
  text('config-meter-voltage',s?profileVoltage(s.profile):null);text('config-meter-capacity',s?.capacityCore!=null?(s.capacityCore/1000).toFixed(1):null);
  text('config-dashboard-voltage',s?dashboardVoltage(s.dashboardConfig):null);text('config-dashboard-capacity','\u672a\u786e\u8ba4');
  update();
}
function populateCapacities(){
  if(!$('target-capacity')||!$('target-voltage'))return;
  const prior=Number($('target-capacity').value),options=capacities(Number($('target-voltage').value));
  $('target-capacity').replaceChildren(...options.map(v=>{const o=document.createElement('option');o.value=String(v);o.textContent=v+' Ah';return o;}));
  $('target-capacity').value=String(options.includes(prior)?prior:options.includes(26)?26:options[0]);
  text('capacity-help','\u5bb9\u91cf\u6863\u4f4d\u7cbe\u786e\u53d6\u81ea APK\uff1a48V \u7684\u7279\u6b8a\u6863\u4f4d\u4e3a24.5Ah\uff0c\u4e0d\u63d0\u4f9b26Ah\u731c\u6d4b\u503c\u3002');
  update();
}
async function run(name,task){
  if(busy)return;busy=true;clearError();text('status-text',name);update();
  try{await task();}
  catch(e){error(e.name==='NotFoundError'?'\u672a\u9009\u62e9\u84dd\u7259\u8bbe\u5907\uff0c\u6216\u6ca1\u6709\u627e\u5230\u76ee\u6807\u8f66\u8f86':e.message||'\u64cd\u4f5c\u5931\u8d25');text('status-text','\u64cd\u4f5c\u672a\u5b8c\u6210');status('\u8bf7\u67e5\u770b\u63d0\u793a\u4e0e\u8bca\u65ad\u65e5\u5fd7\u3002\u6ca1\u6709\u6536\u5230\u5339\u914d\u56de\u8bfb\uff0c\u4e0d\u4ee3\u8868\u64cd\u4f5c\u6210\u529f');}
  finally{busy=false;update();}
}
function download(name,data){const url=URL.createObjectURL(new Blob([typeof data==='string'?data:JSON.stringify(data,null,2)],{type:'application/json;charset=utf-8'}));const a=document.createElement('a');a.href=url;a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(url),1500);}
async function riskDialog({kind,voltage,capacity,sn,restore=false}){
  const dash=kind==='dashboard',delay=dash?30:3;
  const dialog=document.createElement('dialog');dialog.className='risk-dialog';
  const title=document.createElement('h2');title.textContent=(restore?'\u6062\u590d\u5907\u4efd':'\u5199\u5165\u53c2\u6570')+'\u524d\u786e\u8ba4';
  const warning=document.createElement('p');warning.className='notice notice-danger';warning.textContent=dash?'\u4eea\u8868\u76d8\u6301\u4e45\u914d\u7f6e\u5199\u5165\u5df2\u6709\u8ba1\u91cf\u6a21\u5757\u635f\u574f\u3001\u8f66\u8f86\u65e0\u6cd5\u542f\u52a8\u7684\u6848\u4f8b\uff1b\u66f4\u6362\u8ba1\u91cf\u6a21\u5757\u540e\u4eea\u8868\u4e5f\u53ef\u80fd\u518d\u6b21\u4e0b\u53d1\u914d\u7f6e\u3002\u5907\u4efd\u4e0d\u4fdd\u8bc1\u80fd\u6062\u590d\u3002':'\u8ba1\u91cf\u6a21\u5757\u4e34\u65f6\u5199\u5165\u53ef\u80fd\u6539\u53d8\u7535\u91cf\u663e\u793a\u3002\u9519\u8bef\u53c2\u6570\u4f1a\u9020\u6210\u5f02\u5e38\uff0c\u65ad\u7535\u91cd\u542f\u540e\u53ef\u80fd\u6062\u590d\u539f\u503c\u3002\u8bf7\u786e\u8ba4\u5b9e\u9645\u7535\u6c60\u89c4\u683c\uff0c\u4e0d\u4ee5\u8bfb\u6570\u4f5c\u4e3a\u5b89\u5168\u8bca\u65ad\u4f9d\u636e\u3002';
  const summary=document.createElement('p');summary.textContent='\u8f66\u8f86 '+sn+' \u00b7 '+(dash?'\u4eea\u8868\u76d8':'\u8ba1\u91cf\u6a21\u5757')+' \u2192 '+voltage+'V'+(dash?'':' / '+capacity+'Ah');
  const label=document.createElement('label');label.className='consent-box';const check=document.createElement('input');check.type='checkbox';const copy=document.createElement('span');copy.textContent='\u6211\u5df2\u6838\u5bf9\u5b9e\u9645\u8f66\u8f86\u548c\u7535\u6c60\u89c4\u683c\uff0c\u7406\u89e3\u4e0a\u8ff0\u98ce\u9669\uff0c\u5e76\u786e\u8ba4\u53d1\u9001\u672c\u6b21\u5199\u5165\u3002';label.append(check,copy);
  const row=document.createElement('div');row.className='button-row';const cancel=document.createElement('button');cancel.type='button';cancel.className='button button-secondary';cancel.textContent='\u53d6\u6d88\uff0c\u4e0d\u5199\u5165';const yes=document.createElement('button');yes.type='button';yes.className='button button-primary';yes.disabled=true;row.append(cancel,yes);
  const note=document.createElement('p');note.className='field-help';note.textContent='\u786e\u8ba4\u540e\u8fd8\u4f1a\u91cd\u65b0\u8bfb\u53d6\u5e76\u6838\u5bf9\u65e7\u53c2\u6570\u3002\u82e5\u53d1\u751f\u53d8\u5316\uff0c\u81ea\u52a8\u505c\u6b62\uff1b\u4e0d\u63d0\u4f9b\u5f3a\u5236\u7ed5\u8fc7\u3002';dialog.append(title,warning,summary,label,note,row);document.body.append(dialog);dialog.showModal();
  return new Promise(resolve=>{
    let remaining=delay,timer=null,done=false;
    const signal=client.controller.signal;
    const abort=()=>finish(false);
    const refresh=()=>{yes.textContent=remaining>0?'\u8bf7\u9605\u8bfb\u98ce\u9669 '+remaining+' \u79d2':'\u786e\u8ba4\u53d1\u9001\u5199\u5165';yes.disabled=remaining>0||!check.checked;};
    const finish=value=>{if(done)return;done=true;clearInterval(timer);signal.removeEventListener('abort',abort);dialog.close();dialog.remove();resolve(value);};
    signal.addEventListener('abort',abort,{once:true});
    if(signal.aborted){finish(false);return;}
    timer=setInterval(()=>{remaining=Math.max(0,remaining-1);refresh();},1000);check.onchange=refresh;cancel.onclick=()=>finish(false);yes.onclick=()=>{if(!yes.disabled)finish(true);};dialog.addEventListener('cancel',e=>{e.preventDefault();finish(false);});refresh();
  });
}
function restorePageFromHash(){
  if(busy){showPage(document.querySelector('.workspace > [data-page]:not([hidden])')?.dataset.page||'connection',{historyMode:'replace',focus:false});return;}
  showPage(location.hash.slice(1).replace(/-section$/,''),{historyMode:'replace'});
}
window.addEventListener('hashchange',restorePageFromHash);
window.addEventListener('popstate',restorePageFromHash);
for(const button of document.querySelectorAll('[data-go-page]'))button.addEventListener('click',()=>{if(!busy&&!button.disabled)showPage(button.dataset.goPage);});
showPage('connection',{historyMode:'replace',focus:false});
if($('owner-check'))$('owner-check').addEventListener('change',update);
if($('write-type'))$('write-type').addEventListener('change',update);
if($('target-voltage'))$('target-voltage').addEventListener('change',populateCapacities);
if($('target-capacity'))$('target-capacity').addEventListener('change',update);
if($('connect-btn'))$('connect-btn').onclick=()=>run('\u8fde\u63a5\u8f66\u8f86',async()=>{
  if(!$('owner-check').checked)throw new Error('\u8bf7\u5148\u786e\u8ba4\u672c\u4eba\u8f66\u8f86');
  demo=false;writeUncertain=false;render(null);
  await client.connect();text('status-text','\u84dd\u7259\u5df2\u8fde\u63a5\uff0c\u7b49\u5019\u914d\u5bf9');
  status('\u8bf7\u70b9\u51fb\u201c\u5f00\u59cb\u4e34\u65f6\u5bc6\u94a5\u914d\u5bf9\u201d\uff0c\u5e76\u6309\u8f66\u8f86\u63d0\u793a\u786e\u8ba4');
});
if($('pair-btn'))$('pair-btn').onclick=()=>run('\u4e34\u65f6\u5bc6\u94a5\u914d\u5bf9',async()=>{
  if(!$('owner-check').checked)throw new Error('\u8bf7\u5148\u786e\u8ba4\u672c\u4eba\u8f66\u8f86\u4e0e\u914d\u5bf9\u98ce\u9669');
  const epoch=client.epoch;
  try{await client.pair();client.assertSession(epoch);text('status-text','\u914d\u5bf9\u5b8c\u6210 \u00b7 \u7b49\u5f85\u8bfb\u53d6\u8f66\u8f86\u4fe1\u606f');status('\u914d\u5bf9\u6210\u529f\uff0c\u8bf7\u70b9\u51fb\u201c\u8bfb\u53d6\u4fe1\u606f\u201d\u83b7\u53d6\u8f66\u8f86\u4fe1\u606f');log('\u4e34\u65f6\u5bc6\u94a5\u4e0d\u843d\u76d8\uff1b\u5237\u65b0\u6216\u65ad\u5f00\u540e\u9700\u91cd\u65b0\u8ba4\u8bc1\u3002\u6b64\u975e\u5b98\u65b9\u914d\u5bf9\u534f\u8bae\u4e0d\u4fdd\u8bc1\u65e0\u7ebf\u4f20\u8f93\u4fdd\u5bc6\u6027');}
  catch(e){if(epoch===client.epoch){client.disconnect();render(null);}throw e;}
});
if($('read-btn'))$('read-btn').onclick=()=>run('\u8bfb\u53d6\u8f66\u8f86\u4fe1\u606f',async()=>{const epoch=client.epoch;const s=await client.readSnapshot();client.assertSession(epoch);render(s);text('status-text','\u771f\u5b9e\u8f66\u8f86\u4fe1\u606f\u5df2\u8bfb\u53d6');status('\u8bf7\u6838\u5bf9\u8f66\u8f86\u4fe1\u606f\uff0c\u786e\u8ba4\u540e\u53ef\u8fdb\u5165\u53c2\u6570\u6821\u51c6');showPage('information');});
if($('disconnect-btn'))$('disconnect-btn').onclick=()=>{client.disconnect();snapshot=null;demo=false;render(null);showPage('connection',{historyMode:'replace'});text('status-text','\u5df2\u4e3b\u52a8\u65ad\u5f00');status('\u5bc6\u94a5\u5df2\u4ece\u4f1a\u8bdd\u6e05\u9664\u3002\u4e0b\u6b21\u8bf7\u91cd\u65b0\u8ba4\u8bc1');log('\u7528\u6237\u4e3b\u52a8\u65ad\u5f00\u8f66\u8f86');update();};
if($('demo-btn'))$('demo-btn').onclick=()=>{
  if(client.connected||busy)return;
  demo=!demo;
  if(demo){render({demo:true,sn:'DEMO0000000000',soc:68,batteryVoltage:6230,remainingCapacity:17680,profile:0x51,capacityCore:26000,dashboardConfig:0x52,firmware:{dashboard:0x259,color:0x155,center:0x5ca,meter:0x429}});text('status-text','\u754c\u9762\u6f14\u793a\u6a21\u5f0f \u00b7 \u6240\u6709\u8bfb\u6570\u5747\u4e3a\u865a\u6784');status('\u6f14\u793a\u4e0d\u8fde\u63a5\u5b9e\u8f66\u3001\u4e0d\u914d\u5bf9\u3001\u4e0d\u5199\u5165\uff0c\u4e0d\u53ef\u4f5c\u4e3a\u6821\u51c6\u7ed3\u679c');log('\u8fdb\u5165\u754c\u9762\u6f14\u793a\uff1a\u865a\u6784\u8bfb\u6570\uff0c\u8f66\u8f86\u64cd\u4f5c\u5168\u90e8\u9501\u5b9a');$('demo-btn').setAttribute('aria-pressed','true');}
  else{render(null);text('status-text','\u5c1a\u672a\u8fde\u63a5\u8f66\u8f86');status('\u5df2\u9000\u51fa\u6f14\u793a\uff0c\u8bf7\u9009\u62e9\u771f\u5b9e\u8f66\u8f86');$('demo-btn').setAttribute('aria-pressed','false');}
  showPage(demo?'information':'connection');
  update();
};
if($('export-backup-btn'))$('export-backup-btn').onclick=()=>{
  if(!snapshot||demo||!client.authenticated)return;
  const backup=buildBackup(snapshot);download('bfg-current-backup.json',backup);text('backup-status','\u5df2\u89e6\u53d1\u53ef\u9009\u5907\u4efd\u4e0b\u8f7d\uff0c\u8bf7\u786e\u8ba4\u6d4f\u89c8\u5668\u5df2\u4fdd\u5b58\u6587\u4ef6\uff1b\u65e0\u9700\u5907\u4efd\u4e5f\u53ef\u4fee\u6539\u53c2\u6570');log('\u624b\u52a8\u5bfc\u51fa\u771f\u5b9e\u914d\u7f6e\u5907\u4efd\uff08\u4e0d\u542b\u5bc6\u94a5\uff09');update();
};
if($('import-backup'))$('import-backup').onchange=()=>run('\u6838\u5bf9\u5907\u4efd\u6587\u4ef6',async()=>{
  imported=null;const file=$('import-backup').files[0];if(!file)return;
  if(file.size>32*1024)throw new Error('\u5907\u4efd\u6587\u4ef6\u8d85\u8fc732KB\uff0c\u5df2\u62d2\u7edd');
  imported=validateBackup(JSON.parse(await file.text()));
  const restoreCheck=backupRestoreEligibility(imported,snapshot);
  text('backup-status','\u5df2\u5bfc\u5165\u8f66\u8f86 '+imported.sn+' \u7684\u914d\u7f6e\u8bb0\u5f55\uff0c\u5c1a\u672a\u6062\u590d\u3002'+(restoreCheck.ok?'\u5b8c\u6574\u6027\u6838\u5bf9\u901a\u8fc7\uff1b\u6062\u590d\u4ecd\u9700\u98ce\u9669\u786e\u8ba4':restoreCheck.reason+'\uff1b\u6062\u590d\u5df2\u9501\u5b9a'));log('\u5bfc\u5165\u914d\u7f6e\u8bb0\u5f55\uff0c\u4ec5\u6838\u5bf9\uff0c\u4e0d\u4f1a\u81ea\u52a8\u5199\u5165');
});
async function performWrite(kind,voltage,capacity,isRestore=false){
  if(!snapshot||demo||!client.authenticated||!$('owner-check').checked)throw new Error('\u6ca1\u6709\u5df2\u8ba4\u8bc1\u7684\u771f\u5b9e\u8f66\u8f86');
  const before=structuredClone(snapshot),check=snapshotEligibility(before,kind,voltage,capacity);if(!check.ok)throw new Error(check.reason);
  if(isRestore){
    if(imported.sn!==before.sn)throw new Error('\u5907\u4efd\u8f66\u8f86\u4e0d\u5339\u914d');
    const restoreCheck=backupRestoreEligibility(imported,before);
    if(!restoreCheck.ok)throw new Error(restoreCheck.reason);
  }
  const epoch=client.epoch;
  if(!await riskDialog({kind,voltage,capacity,sn:before.sn,restore:isRestore})){status('\u7528\u6237\u53d6\u6d88\uff0c\u672c\u6b21\u672a\u53d1\u9001\u5199\u5165');text('status-text','\u5df2\u53d6\u6d88\u5199\u5165');return;}
  client.assertSession(epoch);
  if(!client.authenticated||snapshot?.sn!==before.sn)throw new Error('\u786e\u8ba4\u671f\u95f4\u8f66\u8f86\u8fde\u63a5\u5df2\u5931\u6548\uff0c\u672c\u6b21\u672a\u53d1\u9001\u5199\u5165');
  try{
    const result=await client.writeParameters(kind,voltage,capacity,before,{confirmed:true,restoreProfile:isRestore?imported.profile:null});client.assertSession(epoch);render(result.snapshot);
    text('status-text',result.changed?'\u53c2\u6570\u5df2\u5199\u5165\uff0c\u5339\u914d\u56de\u8bfb\u5df2\u786e\u8ba4':'\u5f53\u524d\u5df2\u662f\u76ee\u6807\u6863\u4f4d \u00b7 \u672a\u53d1\u9001\u5199\u5165');
    status(kind==='meter'?'\u8ba1\u91cf\u6a21\u5757\u5f53\u524d\u6863\u4f4d\u53ca\u5bb9\u91cf\u5df2\u786e\u8ba4\uff1b\u65ad\u7535\u91cd\u542f\u540e\u53ef\u80fd\u6062\u590d\u539f\u503c':'\u4eea\u8868\u5f53\u524d\u914d\u7f6e\u5df2\u786e\u8ba4\uff1b\u65ad\u7535\u4fdd\u6301\u548c\u786c\u4ef6\u72b6\u6001\u4ecd\u9700\u53e6\u884c\u6838\u5bf9');
    log(result.changed?'\u5b8c\u6210\u53c2\u6570\u5199\u5165\u4e0e\u6700\u7ec8\u56de\u8bfb\u9a8c\u8bc1\uff1b\u672a\u81ea\u52a8\u4e0b\u8f7d\u5907\u4efd':'\u76ee\u6807\u4e0e\u5f53\u524d\u4e00\u81f4\uff0c\u6ca1\u6709\u53d1\u9001\u5199\u5165\u547d\u4ee4');
  }catch(e){writeUncertain=true;throw e;}
}
if($('write-btn'))$('write-btn').onclick=()=>run('\u6838\u5bf9\u53c2\u6570\u4e0e\u98ce\u9669',()=>performWrite($('write-type').value,Number($('target-voltage').value),Number($('target-capacity').value)));
if($('restore-btn'))$('restore-btn').onclick=()=>run('\u6062\u590d\u8ba1\u91cf\u6a21\u5757\u5907\u4efd',async()=>{
  validateBackup(imported);
  await performWrite('meter',profileVoltage(imported.profile),profileCapacity(imported.profile)/1000,true);
});
if($('export-diag-btn'))$('export-diag-btn').onclick=()=>{download('bfg-diagnostics.json',{version:'web-1.2-optional-backup',environment:{secure:window.isSecureContext,bluetooth:!!navigator.bluetooth,userAgent:navigator.userAgent},demo,snapshot:snapshot?{...snapshot,sn:'[\u5df2\u9690\u85cf]'}:null,writeUncertain,logs:logs.map(item=>({...item,message:item.message.replace(/\b[A-Z0-9]{14}\b/g,'[\u8f66\u8f86\u6807\u8bc6\u5df2\u9690\u85cf]')}))});};
window.addEventListener('pagehide',()=>client.disconnect());
text('metric-capacity', '--');
const lastMetricLabel = document.querySelector('[aria-label="\u7535\u6c60\u8bfb\u6570"] .metric:last-child .metric-label');
if(lastMetricLabel) lastMetricLabel.textContent='\u5269\u4f59\u5bb9\u91cf';
text('protocol-note','\u5df2\u4ece\u539f APK \u79fb\u690d Encryption2\u3001\u8f66\u4e0a\u6309\u952e\u4e34\u65f6\u914d\u5bf9\u3001\u53c2\u6570\u8bfb\u53d6\u548c\u6761\u4ef6\u5f0f\u5199\u5165\uff1b\u4e0d\u540c\u8f66\u578b\u4e0e\u56fa\u4ef6\u8bf7\u5206\u522b\u9a8c\u8bc1\u3002\u672a\u77e5\u5bb9\u91cf\u7ec4\u5408\u53ea\u8bfb\uff1b\u4e0d\u63d0\u4f9b\u7ed5\u8fc7\u56fa\u4ef6\u9650\u5236\u3002');
if($('environment-badge')) text('environment-badge',!window.isSecureContext?'\u9700\u8981 HTTPS':navigator.bluetooth?'HTTPS / \u84dd\u7259\u63a5\u53e3\u53ef\u7528':'\u5f53\u524d\u6d4f\u89c8\u5668\u65e0\u84dd\u7259\u63a5\u53e3');
text('restore-btn','\u6062\u590d\u8ba1\u91cf\u6a21\u5757\u6863\u4f4d\uff08\u4e0d\u6062\u590d\u4eea\u8868\uff09');
if($('import-backup'))$('import-backup').accept='application/json,.json';
populateCapacities();
log('\u7f51\u9875\u7248\u5df2\u5c31\u7eea\u3002\u771f\u5b9e\u64cd\u4f5c\u4f7f\u7528\u672c\u673a\u84dd\u7259\uff0c\u672a\u8fde\u63a5\u524d\u4e0d\u4f1a\u663e\u793a\u771f\u5b9e\u6570\u636e');
update();

// ==================== 首日24小时免费 + 嵌套50张卡密库（动态顺延生效） ====================
(function initAuth() {
  const FREE_DURATION_MS = 24 * 60 * 60 * 1000;

  // 3个月卡（25个）
  const KEYS_3M = new Set([
    "KEY-20270108-C1B036", "KEY-20270108-A73087", "KEY-20270108-8CA3CA",
    "KEY-20270108-543166", "KEY-20270108-D8EA9D", "KEY-20270108-6A4DA1",
    "KEY-20270108-E4C20E", "KEY-20270108-323869", "KEY-20270108-BEE1F0",
    "KEY-20270108-94196D", "KEY-20270108-189674", "KEY-20270108-F6FCB3",
    "KEY-20270108-4C82E8", "KEY-20270108-C62BB5", "KEY-20270108-AEA518",
    "KEY-20270108-877B81", "KEY-20270108-5F5802", "KEY-20270108-D3D2B9",
    "KEY-20270108-67B460", "KEY-20270108-EB2DCD", "KEY-20270108-39A7A6",
    "KEY-20270108-B1803F", "KEY-20270108-99FD8C", "KEY-20270108-1D74F5",
    "KEY-20270108-FBF96A"
  ]);

  // 包年卡（25个）
  const KEYS_1Y = new Set([
    "KEY-20271008-011F9E", "KEY-20271008-859F29", "KEY-20271008-AF1984",
    "KEY-20271008-3196FD", "KEY-20271008-BED86A", "KEY-20271008-1C5C13",
    "KEY-20271008-90D58C", "KEY-20271008-7F5637", "KEY-20271008-E7CFB0",
    "KEY-20271008-4B482F", "KEY-20271008-C9C1B6", "KEY-20271008-534E41",
    "KEY-20271008-DDC7D8", "KEY-20271008-22C4B3", "KEY-20271008-A0492E",
    "KEY-20271008-8EC679", "KEY-20271008-144FC2", "KEY-20271008-FCCE5B",
    "KEY-20271008-60C9C0", "KEY-20271008-EC4279", "KEY-20271008-3CB9E2",
    "KEY-20271008-B43E19", "KEY-20271008-98B786", "KEY-20271008-163EF3",
    "KEY-20271008-FA9968"
  ]);

  const overlay = document.createElement('div');
  overlay.id = 'auth-overlay';
  overlay.style.cssText = 'display:none;position:fixed;inset:0;background:rgba(15,23,42,0.85);backdrop-filter:blur(14px);-webkit-backdrop-filter:blur(14px);z-index:999999;align-items:center;justify-content:center;padding:20px;';

  const modal = document.createElement('div');
  modal.style.cssText = 'background:#ffffff;border-radius:20px;padding:32px 28px;max-width:380px;width:100%;box-shadow:0 20px 60px rgba(0,0,0,0.3);text-align:center;box-sizing:border-box;';

  const title = document.createElement('h3');
  title.style.cssText = 'margin:0 0 8px;font-size:20px;color:#1b2b43;';
  title.textContent = '\u9996\u65e5\u514d\u8d39\u4f53\u9a8c\u5df2\u7ed3\u675f';

  const desc = document.createElement('p');
  desc.style.cssText = 'margin:0 0 20px;font-size:14px;color:#5e7089;line-height:1.6;';
  desc.textContent = '\u60a8\u7684 24 \u5c0f\u65f6\u514d\u8d39\u4f53\u9a8c\u671f\u5df2\u5230\u671f\u3002\u5982\u9700\u7ee7\u7eed\u4f7f\u7528\u7535\u91cf\u4e0e\u7535\u538b\u6821\u51c6\u529f\u80fd\uff0c\u8bf7\u8f93\u5165\u6388\u6743\u5361\u5bc6\u3002';

  const input = document.createElement('input');
  input.type = 'text';
  input.placeholder = '\u8f93\u5165\u5361\u5bc6\uff1aKEY-YYYYMMDD-XXXXXX';
  input.style.cssText = 'width:100%;box-sizing:border-box;min-height:48px;padding:10px 14px;border:1px solid #ccd9ea;border-radius:12px;font-size:15px;margin-bottom:12px;text-align:center;outline:none;';

  const btn = document.createElement('button');
  btn.type = 'button';
  btn.className = 'button button-primary button-full';
  btn.style.cssText = 'width:100%;min-height:48px;font-size:16px;';
  btn.textContent = '\u9a8c\u8bc1\u5e76\u6fc0\u6d3b';

  const err = document.createElement('p');
  err.style.cssText = 'margin:12px 0 0;font-size:13px;color:#a62f35;display:none;';

  modal.append(title, desc, input, btn, err);
  overlay.append(modal);
  document.body.append(overlay);

  const statusLabel = document.querySelector('.status-label');

  function formatDate(d) {
    return d.getFullYear() + '-' + (d.getMonth() + 1) + '-' + d.getDate();
  }

  // 1. 检查已激活的数据（按实际输入后的到期时间戳核验）
  const savedExpiry = localStorage.getItem('bfg_auth_expiry');
  if (savedExpiry) {
    const expireTime = Number(savedExpiry);
    if (Date.now() <= expireTime) {
      if (statusLabel) {
        statusLabel.textContent = '\u5df2\u6388\u6743\u81f3: ' + formatDate(new Date(expireTime));
        statusLabel.style.color = '#1b2b43';
      }
      return;
    } else {
      localStorage.removeItem('bfg_auth_expiry');
      localStorage.removeItem('bfg_auth_key');
    }
  }

  // 2. 检查 24 小时免费期
  let firstVisit = localStorage.getItem('bfg_first_visit');
  const now = Date.now();
  if (!firstVisit) {
    firstVisit = String(now);
    localStorage.setItem('bfg_first_visit', firstVisit);
  }

  const elapsed = now - Number(firstVisit);
  if (elapsed < FREE_DURATION_MS) {
    const remainingHours = Math.ceil((FREE_DURATION_MS - elapsed) / (1000 * 60 * 60));
    if (statusLabel) {
      statusLabel.textContent = '\u9996\u65e5\u514d\u8d39\u4f53\u9a8c\u4e2d (\u5269 ' + remainingHours + ' \u5c0f\u65f6)';
      statusLabel.style.color = '#245fe5';
    }
    return;
  }

  // 3. 超过免费期，弹出锁定
  overlay.style.display = 'flex';
  if (statusLabel) statusLabel.textContent = '\u514d\u8d39\u4f53\u9a8c\u5df2\u5230\u671f';

  // 4. 卡密验证与顺延激活
  btn.onclick = () => {
    const inputVal = input.value.trim().toUpperCase();
    let daysToAdd = 0;

    if (KEYS_3M.has(inputVal)) {
      daysToAdd = 90; // 3个月卡顺延90天
    } else if (KEYS_1Y.has(inputVal)) {
      daysToAdd = 365; // 包年卡顺延365天
    } else {
      err.textContent = '\u5361\u5bc6\u65e0\u6548\u6216\u4e0d\u5b58\u5728';
      err.style.display = 'block';
      return;
    }

    // 从当天当前时间开始顺延对应天数
    const expireTimestamp = Date.now() + (daysToAdd * 24 * 60 * 60 * 1000);
    const expireDateFormatted = formatDate(new Date(expireTimestamp));

    localStorage.setItem('bfg_auth_key', inputVal);
    localStorage.setItem('bfg_auth_expiry', String(expireTimestamp));

    overlay.style.display = 'none';
    if (statusLabel) {
      statusLabel.textContent = '\u5df2\u6fc0\u6d3b\u81f3: ' + expireDateFormatted;
      statusLabel.style.color = '#245fe5';
    }
  };

  input.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') btn.click();
  });
})();
