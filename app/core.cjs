const fs = require('node:fs');
const path = require('node:path');
const { randomUUID } = require('node:crypto');
function validateTask(input) {
  if (!input || typeof input.title !== 'string' || !input.title.trim() || input.title.length > 180) throw Error('Informe um título com até 180 caracteres.');
  if (!Number.isFinite(new Date(input.due).getTime())) throw Error('Informe uma data e um horário válidos.');
  if (!['tarefa','treinamento','sistema','reuniao'].includes(input.category)) throw Error('Categoria inválida.');
  if (!['normal','alta'].includes(input.priority)) throw Error('Prioridade inválida.');
  if (!['none','daily','weekly'].includes(input.repeat)) throw Error('Repetição inválida.');
  if (![0,5,15,30,60].includes(input.reminder)) throw Error('Lembrete inválido.');
  return { title: input.title.trim(), notes: String(input.notes || '').slice(0,5000), due: new Date(input.due).toISOString(), category: input.category, priority: input.priority, repeat: input.repeat, reminder: input.reminder };
}
function nextOccurrence(due, repeat, now = new Date()) {
  if (repeat === 'none') return null;
  const date = new Date(due);
  do { date.setDate(date.getDate() + (repeat === 'weekly' ? 7 : 1)); } while (date <= now);
  return date.toISOString();
}
class Store {
  constructor(dir) {
    fs.mkdirSync(dir, {recursive:true});
    this.file = path.join(dir,'tarefas.json');
    this.data = {schema:1,tasks:[],settings:{startup:false},seenVersion:null};
    if (fs.existsSync(this.file)) {
      try { this.data = this.parse(fs.readFileSync(this.file,'utf8')); }
      catch (error) {
        fs.copyFileSync(this.file, `${this.file}.corrompido-${Date.now()}`);
        if (fs.existsSync(this.file+'.bak')) this.data = this.parse(fs.readFileSync(this.file+'.bak','utf8'));
        else throw Error('Não foi possível ler a base. A cópia original foi preservada. Restaure um backup antes de continuar.');
      }
    }
  }
  parse(raw) {
    const data=JSON.parse(raw);
    if (data.schema!==1 || !Array.isArray(data.tasks) || data.tasks.length>50000) throw Error('Backup incompatível.');
    data.tasks=data.tasks.map(t=>({...validateTask(t),id: typeof t.id==='string'?t.id:randomUUID(),done:!!t.done,notified:!!t.notified,createdAt:t.createdAt || new Date().toISOString()}));
    return {...data,settings:{startup:!!data.settings?.startup}};
  }
  save() {
    fs.writeFileSync(this.file+'.tmp',JSON.stringify(this.data,null,2),'utf8');
    if(fs.existsSync(this.file)) fs.copyFileSync(this.file,this.file+'.bak');
    fs.renameSync(this.file+'.tmp',this.file);
  }
  upsert(input) {
    const clean=validateTask(input), old=this.data.tasks.find(t=>t.id===input.id);
    if(old) Object.assign(old,clean,{notified:false});
    else this.data.tasks.push({...clean,id:randomUUID(),done:false,notified:false,createdAt:new Date().toISOString()});
    this.save(); return this.data;
  }
  toggle(id) {
    const task=this.data.tasks.find(t=>t.id===id); if(!task) throw Error('Tarefa não encontrada.');
    task.done=!task.done;
    if(task.done && task.repeat!=='none') {
      const due=nextOccurrence(task.due,task.repeat);
      this.data.tasks.push({...task,id:randomUUID(),due,done:false,notified:false,createdAt:new Date().toISOString()});
      task.repeat='none';
    }
    this.save(); return this.data;
  }
  dueReminders(now=Date.now()) {
    return this.data.tasks.filter(t=>!t.done&&!t.notified&&new Date(t.due).getTime()-t.reminder*60000<=now);
  }
}
module.exports={Store,validateTask,nextOccurrence};
