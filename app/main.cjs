const { app, BrowserWindow, ipcMain, Tray, Menu, Notification, dialog, powerMonitor } = require('electron');
const path = require('node:path');
const fs = require('node:fs');
const { Store } = require('./core.cjs');
const { autoUpdater } = require('electron-updater');
let win,tray,store,quitting=false,update={state:'idle',message:'Atualizações automáticas ativadas.'};
const icon=path.join(__dirname,'assets/troven.ico');
const smoke=process.env.TROVEN_SMOKE==='1';
const dataDir=smoke?path.resolve('.test-data/electron'):path.join(app.getPath('appData'),'Troven','Tarefas');
fs.mkdirSync(dataDir,{recursive:true});
app.setPath('userData',dataDir);
if(!app.requestSingleInstanceLock()) app.quit();
else {
app.on('second-instance',()=>show());
app.on('before-quit',()=>{quitting=true;});
app.whenReady().then(async()=>{
  app.setAppUserModelId('br.com.troven.tarefas');
  try { store=new Store(app.getPath('userData')); }
  catch(error) { dialog.showErrorBox('Não foi possível abrir a base',error.message); app.quit(); return; }
  win=new BrowserWindow({width:1440,height:940,minWidth:1000,minHeight:700,show:!smoke,backgroundColor:'#F7F5F1',title:'Troven Tarefas',icon,autoHideMenuBar:true,webPreferences:{preload:path.join(__dirname,'preload.cjs'),contextIsolation:true,nodeIntegration:false,sandbox:true,backgroundThrottling:false}});
  win.webContents.setWindowOpenHandler(()=>({action:'deny'}));
  win.webContents.on('will-navigate',e=>e.preventDefault());
  win.webContents.session.setPermissionRequestHandler((_,__,callback)=>callback(false));
  win.on('close',event=>{if(!quitting&&!smoke){event.preventDefault();win.hide();}});
  tray=new Tray(icon); tray.setToolTip('Troven Tarefas · Seus lembretes continuam ativos');
  tray.setContextMenu(Menu.buildFromTemplate([{label:'Abrir Troven Tarefas',click:show},{label:'Nova tarefa',click:()=>{show();win.webContents.send('changed',{newTask:true});}},{type:'separator'},{label:'Sair do Troven Tarefas',click:()=>app.quit()}]));
  tray.on('double-click',show);
  ipcMain.handle('troven',async(event,action,payload)=>{
    if(event.sender!==win.webContents || event.senderFrame!==win.webContents.mainFrame) throw Error('Origem inválida.');
    switch(action) {
      case 'init': return {data:store.data,version:app.getVersion(),update,releases:require('./releases.json'),packaged:app.isPackaged};
      case 'save': store.upsert(payload); break;
      case 'toggle': store.toggle(payload); break;
      case 'delete': store.data.tasks=store.data.tasks.filter(t=>t.id!==payload);store.save();break;
      case 'snooze': {const t=store.data.tasks.find(t=>t.id===payload);if(t){t.due=new Date(Date.now()+10*60000).toISOString();t.reminder=0;t.notified=false;store.save();}break;}
      case 'seen': store.data.seenVersion=app.getVersion();store.save();break;
      case 'startup': store.data.settings.startup=!!payload;app.setLoginItemSettings({openAtLogin:!!payload});store.save();break;
      case 'check-update': return checkUpdates();
      case 'install-update': if(update.state==='ready'){quitting=true;autoUpdater.quitAndInstall();}return;
      case 'export': {const result=await dialog.showSaveDialog(win,{defaultPath:'Troven-Tarefas-backup.json',filters:[{name:'Backup JSON',extensions:['json']}]});if(!result.canceled)fs.writeFileSync(result.filePath,JSON.stringify(store.data,null,2));return !result.canceled;}
      case 'import': {const result=await dialog.showOpenDialog(win,{filters:[{name:'Backup JSON',extensions:['json']}],properties:['openFile']});if(result.canceled)return null;const file=result.filePaths[0];if(fs.statSync(file).size>20*1024*1024)throw Error('Backup muito grande.');const incoming=store.parse(fs.readFileSync(file,'utf8'));const confirmation=await dialog.showMessageBox(win,{type:'question',message:`Restaurar ${incoming.tasks.length} tarefas?`,detail:'A base atual será substituída e preservada em tarefas.json.bak.',buttons:['Cancelar','Restaurar'],defaultId:0,cancelId:0});if(confirmation.response!==1)return null;incoming.settings=store.data.settings;store.data=incoming;store.save();break;}
      default: throw Error('Ação desconhecida.');
    }
    win.webContents.send('changed',store.data);return store.data;
  });
  await win.loadFile(path.join(__dirname,'index.html'));
  if(!smoke){setInterval(remind,15000);setTimeout(remind,3000);powerMonitor.on('resume',remind);setTimeout(checkUpdates,8000);setInterval(checkUpdates,4*60*60*1000);}
});
}
function show(){if(win){win.show();if(win.isMinimized())win.restore();win.focus();}}
function remind(){
  const tasks=store.dueReminders();
  if(!Notification.isSupported() || !tasks.length)return;
  const group=tasks.slice(0,3);
  for(const task of group){const n=new Notification({title:task.title,body:`${new Date(task.due).toLocaleString('pt-BR')} · ${task.notes||'Está na hora de dar o próximo passo.'}`,icon});n.on('click',show);n.show();task.notified=true;}
  if(tasks.length>3){const n=new Notification({title:'Sua agenda está esperando',body:`Mais ${tasks.length-3} tarefas pendentes. Abra o Troven para conferir.`,icon});n.on('click',show);n.show();for(const task of tasks.slice(3))task.notified=true;}
  store.save();win.webContents.send('changed',store.data);
}
function status(state,message){update={state,message};if(win&&!win.isDestroyed())win.webContents.send('update',update);}
autoUpdater.autoDownload=true;autoUpdater.autoInstallOnAppQuit=true;
autoUpdater.on('checking-for-update',()=>status('checking','Procurando uma nova versão…'));
autoUpdater.on('update-available',info=>status('downloading',`Baixando a versão ${info.version} em segundo plano…`));
autoUpdater.on('download-progress',p=>status('downloading',`Baixando atualização: ${Math.round(p.percent)}%`));
autoUpdater.on('update-not-available',()=>status('current','Você está na versão mais recente.'));
autoUpdater.on('update-downloaded',()=>status('ready','Atualização pronta. Será instalada ao sair pela bandeja.'));
autoUpdater.on('error',()=>status('error','Não foi possível consultar atualizações. Sua agenda continua disponível.'));
async function checkUpdates(){if(!app.isPackaged){status('dev','Atualizações ficam disponíveis no aplicativo instalado.');return update;}if(['checking','downloading','ready'].includes(update.state))return update;try{await autoUpdater.checkForUpdates();}catch{}return update;}
