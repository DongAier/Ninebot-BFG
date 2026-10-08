import {VehicleClient,capacities,profileVoltage,profileCapacity,dashboardVoltage,firmwareVersion,snapshotEligibility,buildBackup,validateBackup,backupRestoreEligibility} from './protocol.js';
const $=id=>document.getElementById(id);
let busy=false,demo=false,snapshot=null,imported=null,writeUncertain=false;
const logs=[];
function text(id,value){$(id).textContent=value==null?'--':String(value);}
function log(message,level='info'){
  const item={time:new Date().toISOString(),level,message};logs.push(item);if(logs.length>400)logs.shift();
  const li=document.createElement('li');li.textContent=`${new Date().toLocaleTimeString('zh-CN')} · ${message}`;li.className=`log-${level}`;$('log-list').append(li);while($('log-list').children.length>400)$('log-list').firstChild.remove();
  document.querySelector('.log-empty').hidden=true;
}
function status(message){text('busy-text',message);}
function error(message){$('error-box').hidden=false;text('error-box',message);log(message,'error');}
function clearError(){$('error-box').hidden=true;}
const pageNames={connection:'连接与配对',information:'车辆信息',calibration:'参数校准',backup:'备份与恢复'};
const pagePanels=[...document.querySelectorAll('[data-page]')];
function showPage(page,{historyMode='push',focus=true}={}){
  if(!Object.hasOwn(pageNames,page)||page!=='connection'&&(!snapshot||!demo&&!client.authenticated))page='connection';
  for(const panel of pagePanels)panel.hidden=panel.dataset.page!==page;
  document.title=`${pageNames[page]} · BFG 电量校准`;
  const hash=`#${page}-section`;
  if(historyMode==='replace')history.replaceState(null,'',hash);
  else if(historyMode==='push'&&location.hash!==hash)history.pushState(null,'',hash);
  if(focus){
    const heading=$(`${page}-title`);
    heading.focus({preventScroll:true});
    window.scrollTo({top:0,behavior:'instant'});
  }
}
const client=new VehicleClient({log,status,disconnected:e=>{snapshot=null;demo=false;text('status-text','蓝牙已断开');status('请重新连接并认证。旧读数不再作为写入依据');render(null);showPage('connection',{historyMode:'replace'});if(e)error(e.message);update();}});
function update(){
  const connected=client.connected,authenticated=client.authenticated,owner=$('owner-check').checked;
  $('connect-btn').disabled=busy||connected||!owner||!window.isSecureContext||!navigator.bluetooth;
  $('pair-btn').disabled=busy||!connected||authenticated||!owner||demo;
  $('read-btn').disabled=busy||!authenticated||demo;
  $('disconnect-btn').disabled=!client.device&&!client.connecting;
  $('demo-btn').disabled=busy||connected;
  $('write-type').disabled=busy; $('target-voltage').disabled=busy;
  $('target-capacity').disabled=busy||$('write-type').value==='dashboard';
  $('owner-check').disabled=busy||connected;
  const kind=$('write-type').value,voltage=Number($('target-voltage').value),capacity=Number($('target-capacity').value);
  const allowed=snapshotEligibility(snapshot,kind,voltage,capacity);
  text('write-reason',writeUncertain?'上次写入结果未确认，已锁定。请断开并重新读取后再决定下一步':allowed.ok?`${allowed.reason}；备份为可选操作，不影响写入` :allowed.reason);
  $('write-btn').disabled=busy||!owner||!authenticated||demo||!allowed.ok||writeUncertain;
  $('export-backup-btn').disabled=busy||!authenticated||!snapshot||demo;
  const restore=backupRestoreEligibility(imported,snapshot);
  $('restore-btn').disabled=busy||!authenticated||!owner||demo||!restore.ok||writeUncertain;
  $('restore-btn').title=restore.ok?'仅恢复精确的计量模块档位':restore.reason;
  $('import-backup').disabled=busy||demo;
  for(const button of document.querySelectorAll('[data-go-page]'))button.disabled=busy||button.dataset.goPage!=='connection'&&(!snapshot||!demo&&!authenticated);
  text('mode-badge',demo?'界面演示 · 不连接实车':authenticated?'已认证 · 本地蓝牙':connected?'蓝牙连接 · 待认证':'未连接');
  $('meter-note').hidden=kind!=='meter';$('dashboard-note').hidden=kind!=='dashboard';
}
function render(s){
  snapshot=s;
  text('info-sn',s?.sn);text('info-model',s?.demo?'演示车辆（虚构）':s?'型号未由该协议直接提供':'--');
  const soc=s?.soc!=null&&s.soc>=0&&s.soc<=100?s.soc:s?.dashboardSoc!=null&&s.dashboardSoc>=0&&s.dashboardSoc<=100?s.dashboardSoc:null;
  text('metric-soc',soc);text('metric-voltage',s?.batteryVoltage!=null?(s.batteryVoltage/100).toFixed(2):null);text('metric-capacity',s?.remainingCapacity!=null?(s.remainingCapacity/1000).toFixed(2):null);
  for(const key of ['dashboard','color','center','meter'])text(`fw-${key}`,firmwareVersion(s?.firmware?.[key]));
  text('config-meter-voltage',s?profileVoltage(s.profile):null);text('config-meter-capacity',s?.capacityCore!=null?(s.capacityCore/1000).toFixed(1):null);
  text('config-dashboard-voltage',s?dashboardVoltage(s.dashboardConfig):null);text('config-dashboard-capacity','未确认');
  update();
}
function populateCapacities(){
  const prior=Number($('target-capacity').value),options=capacities(Number($('target-voltage').value));
  $('target-capacity').replaceChildren(...options.map(v=>{const o=document.createElement('option');o.value=String(v);o.textContent=`${v} Ah`;return o;}));
  $('target-capacity').value=String(options.includes(prior)?prior:options.includes(26)?26:options[0]);
  text('capacity-help','容量档位精确取自 APK：48V 的特殊档位为24.5Ah，不提供26Ah猜测值。');update();
}
async function run(name,task){
  if(busy)return;busy=true;clearError();text('status-text',name);update();
  try{await task();}
  catch(e){error(e.name==='NotFoundError'?'未选择蓝牙设备，或没有找到目标车辆':e.message||'操作失败');text('status-text','操作未完成');status('请查看提示与诊断日志。没有收到匹配回读，不代表操作成功');}
  finally{busy=false;update();}
}
function download(name,data){const url=URL.createObjectURL(new Blob([typeof data==='string'?data:JSON.stringify(data,null,2)],{type:'application/json;charset=utf-8'}));const a=document.createElement('a');a.href=url;a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(url),1500);}
async function riskDialog({kind,voltage,capacity,sn,restore=false}){
  const dash=kind==='dashboard',delay=dash?30:3;
  const dialog=document.createElement('dialog');dialog.className='risk-dialog';
  const title=document.createElement('h2');title.textContent=`${restore?'恢复备份':'写入参数'}前确认`;
  const warning=document.createElement('p');warning.className='notice notice-danger';warning.textContent=dash?'仪表盘持久配置写入已有计量模块损坏、车辆无法启动的案例；更换计量模块后仪表也可能再次下发配置。备份不保证能恢复。':'计量模块临时写入可能改变电量显示。错误参数会造成异常，断电重启后可能恢复。请确认实际电池规格，不以读数作为安全诊断依据。';
  const summary=document.createElement('p');summary.textContent=`车辆 ${sn} · ${dash?'仪表盘':'计量模块'} → ${voltage}V${dash?'':` / ${capacity}Ah`}`;
  const label=document.createElement('label');label.className='consent-box';const check=document.createElement('input');check.type='checkbox';const copy=document.createElement('span');copy.textContent='我已核对实际车辆和电池规格，理解上述风险，并确认发送本次写入。';label.append(check,copy);
  const row=document.createElement('div');row.className='button-row';const cancel=document.createElement('button');cancel.type='button';cancel.className='button button-secondary';cancel.textContent='取消，不写入';const yes=document.createElement('button');yes.type='button';yes.className='button button-primary';yes.disabled=true;row.append(cancel,yes);
  const note=document.createElement('p');note.className='field-help';note.textContent='确认后还会重新读取并核对旧参数。若发生变化，自动停止；不提供强制绕过。';dialog.append(title,warning,summary,label,note,row);document.body.append(dialog);dialog.showModal();
  return new Promise(resolve=>{
    let remaining=delay,timer=null,done=false;
    const signal=client.controller.signal;
    const abort=()=>finish(false);
    const refresh=()=>{yes.textContent=remaining>0?`请阅读风险 ${remaining} 秒`:'确认发送写入';yes.disabled=remaining>0||!check.checked;};
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
$('owner-check').addEventListener('change',update);
$('write-type').addEventListener('change',update);$('target-voltage').addEventListener('change',populateCapacities);$('target-capacity').addEventListener('change',update);
$('connect-btn').onclick=()=>run('连接车辆',async()=>{
  if(!$('owner-check').checked)throw new Error('请先确认本人车辆');
  demo=false;writeUncertain=false;render(null);
  await client.connect();text('status-text','蓝牙已连接，等候配对');
  status('请点击“开始临时密钥配对”，并按车辆提示确认');
});
$('pair-btn').onclick=()=>run('临时密钥配对',async()=>{
  if(!$('owner-check').checked)throw new Error('请先确认本人车辆与配对风险');
  const epoch=client.epoch;
  try{await client.pair();client.assertSession(epoch);text('status-text','配对完成 · 等待读取车辆信息');status('配对成功，请点击“读取信息”获取车辆信息');log('临时密钥不落盘；刷新或断开后需重新认证。此非官方配对协议不保证无线传输保密性');}
  catch(e){if(epoch===client.epoch){client.disconnect();render(null);}throw e;}
});
$('read-btn').onclick=()=>run('读取车辆信息',async()=>{const epoch=client.epoch;const s=await client.readSnapshot();client.assertSession(epoch);render(s);text('status-text','真实车辆信息已读取');status('请核对车辆信息，确认后可进入参数校准');showPage('information');});
$('disconnect-btn').onclick=()=>{client.disconnect();snapshot=null;demo=false;render(null);showPage('connection',{historyMode:'replace'});text('status-text','已主动断开');status('密钥已从会话清除。下次请重新认证');log('用户主动断开车辆');update();};
$('demo-btn').onclick=()=>{
  if(client.connected||busy)return;
  demo=!demo;
  if(demo){render({demo:true,sn:'DEMO0000000000',soc:68,batteryVoltage:6230,remainingCapacity:17680,profile:0x51,capacityCore:26000,dashboardConfig:0x52,firmware:{dashboard:0x259,color:0x155,center:0x5ca,meter:0x429}});text('status-text','界面演示模式 · 所有读数均为虚构');status('演示不连接实车、不配对、不写入，不可作为校准结果');log('进入界面演示：虚构读数，车辆操作全部锁定');$('demo-btn').setAttribute('aria-pressed','true');}
  else{render(null);text('status-text','尚未连接车辆');status('已退出演示，请选择真实车辆');$('demo-btn').setAttribute('aria-pressed','false');}
  showPage(demo?'information':'connection');
  update();
};
$('export-backup-btn').onclick=()=>{
  if(!snapshot||demo||!client.authenticated)return;
  const backup=buildBackup(snapshot);download('bfg-current-backup.json',backup);text('backup-status','已触发可选备份下载，请确认浏览器已保存文件；无需备份也可修改参数');log('手动导出真实配置备份（不含密钥）');update();
};
$('import-backup').onchange=()=>run('核对备份文件',async()=>{
  imported=null;const file=$('import-backup').files[0];if(!file)return;
  if(file.size>32*1024)throw new Error('备份文件超过32KB，已拒绝');
  imported=validateBackup(JSON.parse(await file.text()));
  const restoreCheck=backupRestoreEligibility(imported,snapshot);
  text('backup-status',`已导入车辆 ${imported.sn} 的配置记录，尚未恢复。${restoreCheck.ok?'完整性核对通过；恢复仍需风险确认':restoreCheck.reason+'；恢复已锁定'}`);log('导入配置记录，仅核对，不会自动写入');
});
async function performWrite(kind,voltage,capacity,isRestore=false){
  if(!snapshot||demo||!client.authenticated||!$('owner-check').checked)throw new Error('没有已认证的真实车辆');
  const before=structuredClone(snapshot),check=snapshotEligibility(before,kind,voltage,capacity);if(!check.ok)throw new Error(check.reason);
  if(isRestore){
    if(imported.sn!==before.sn)throw new Error('备份车辆不匹配');
    const restoreCheck=backupRestoreEligibility(imported,before);
    if(!restoreCheck.ok)throw new Error(restoreCheck.reason);
  }
  const epoch=client.epoch;
  if(!await riskDialog({kind,voltage,capacity,sn:before.sn,restore:isRestore})){status('用户取消，本次未发送写入');text('status-text','已取消写入');return;}
  client.assertSession(epoch);
  if(!client.authenticated||snapshot?.sn!==before.sn)throw new Error('确认期间车辆连接已失效，本次未发送写入');
  try{
    const result=await client.writeParameters(kind,voltage,capacity,before,{confirmed:true,restoreProfile:isRestore?imported.profile:null});client.assertSession(epoch);render(result.snapshot);
    text('status-text',result.changed?'参数已写入，匹配回读已确认':'当前已是目标档位 · 未发送写入');
    status(kind==='meter'?'计量模块当前档位及容量已确认；断电重启后可能恢复原值':'仪表当前配置已确认；断电保持和硬件状态仍需另行核对');
    log(result.changed?'完成参数写入与最终回读验证；未自动下载备份':'目标与当前一致，没有发送写入命令');
  }catch(e){writeUncertain=true;throw e;}
}
$('write-btn').onclick=()=>run('核对参数与风险',()=>performWrite($('write-type').value,Number($('target-voltage').value),Number($('target-capacity').value)));
$('restore-btn').onclick=()=>run('恢复计量模块备份',async()=>{
  validateBackup(imported);
  // Deliberately restore only the meter profile. Dashboard restore needs its own high-risk transaction.
  await performWrite('meter',profileVoltage(imported.profile),profileCapacity(imported.profile)/1000,true);
});
$('export-diag-btn').onclick=()=>{download('bfg-diagnostics.json',{version:'web-1.2-optional-backup',environment:{secure:window.isSecureContext,bluetooth:!!navigator.bluetooth,userAgent:navigator.userAgent},demo,snapshot:snapshot?{...snapshot,sn:'[已隐藏]'}:null,writeUncertain,logs:logs.map(item=>({...item,message:item.message.replace(/\b[A-Z0-9]{14}\b/g,'[车辆标识已隐藏]')}))});};
window.addEventListener('pagehide',()=>client.disconnect());
text('metric-capacity', '--');document.querySelector('[aria-label="电池读数"] .metric:last-child .metric-label').textContent='剩余容量';
text('protocol-note','已从原 APK 移植 Encryption2、车上按键临时配对、参数读取和条件式写入；不同车型与固件请分别验证。未知容量组合只读；不提供绕过固件限制。');
text('environment-badge',!window.isSecureContext?'需要 HTTPS':navigator.bluetooth?'HTTPS / 蓝牙接口可用':'当前浏览器无蓝牙接口');
text('restore-btn','恢复计量模块档位（不恢复仪表）');
$('import-backup').accept='application/json,.json';
populateCapacities();log('网页版已就绪。真实操作使用本机蓝牙，未连接前不会显示真实数据');update();
