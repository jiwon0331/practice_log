const fs = require('fs');
const vm = require('vm');
const assert = require('assert/strict');
const code = fs.readFileSync('outputs/violin-practice-log/script.js','utf8').replace(/\}\)\(\);\s*$/, 'globalThis.testApi={openDate,saveProgram,toggleTimer,stopTimer,renderPreviousNote,validProgram,leaves,dateKey,parseDate,get program(){return program},logs,get selected(){return selected}};})();');
let now = new Date(2026,8,30,12).getTime();
class Clock extends Date { constructor(...args){super(...(args.length?args:[now]));} static now(){return now;} }
class Node { constructor(){this.children=[];this.style={};this.dataset={};this.classList={add(){},toggle(){}};this.hidden=false;} append(...items){this.children.push(...items);} replaceChildren(...items){this.children=items;} setAttribute(k,v){this[k]=v;} addEventListener(){} querySelectorAll(){return [];} }
function launch(storage){const nodes={}; const context={Date:Clock,console,JSON,Math,Number,Set,Object,String,Array,crypto:require('crypto').webcrypto,setInterval(){},document:{getElementById:id=>nodes[id]??=new Node(),createElement:()=>new Node(),addEventListener(){}},localStorage:{getItem:k=>storage[k]??null,setItem:(k,v)=>storage[k]=v}};vm.createContext(context);vm.runInContext(code,context);return {api:context.testApi,nodes};}
const oldProgram=[{id:'warmup',name:'Warm-up',type:'single'},{id:'scales',name:'Scales System',type:'group',children:[{id:'arp',name:'Arpeggios'}]}];
const oldLog={programSnapshot:oldProgram,items:{warmup:{completed:true,minutes:20}},note:'Keep bow relaxed.'};
const storage={violinPracticeProgram:JSON.stringify(oldProgram),violinPracticeLogs:JSON.stringify({'2026-09-29':oldLog,'2026-09-30':oldLog})};
let {api:a,nodes}=launch(storage);
const past=JSON.stringify(a.logs['2026-09-29']);
assert.equal(a.program[0].type,'group');assert.equal(a.program[0].children[0].id,'warmup');assert.equal(a.logs['2026-09-30'].items.warmup.minutes,20);
a.program.push({id:'bach',name:'Bach',type:'single'});a.saveProgram();a.openDate('2026-09-30');assert(a.leaves(a.logs['2026-09-30'].programSnapshot).some(i=>i.name==='Bach'));assert.equal(JSON.stringify(a.logs['2026-09-29']),past);
a.program[0].children.push({id:'strings',name:'Open Strings'});a.saveProgram();a.program[0].children[1].name='Bow Exercise';a.saveProgram();assert.equal(a.leaves(a.logs['2026-09-30'].programSnapshot).find(i=>i.id==='strings').name,'Bow Exercise');a.program[0].children.pop();a.saveProgram();assert(!a.leaves(a.logs['2026-09-30'].programSnapshot).some(i=>i.id==='strings'));
a.toggleTimer('warmup');now+=760000;a.stopTimer();assert.equal(a.logs['2026-09-30'].items.warmup.minutes,33);
a.toggleTimer('bach');now+=61000;a.toggleTimer('warmup');assert.equal(a.logs['2026-09-30'].items.bach.minutes,1);assert.equal(a.logs._activeTimer.itemId,'warmup');
now+=90000;({api:a,nodes}=launch(storage));assert.equal(a.logs._activeTimer.itemId,'warmup');a.openDate('2026-10-01');a.stopTimer();assert.equal(a.logs['2026-09-30'].items.warmup.minutes,35);assert.equal(a.logs['2026-10-01'].items.warmup.minutes,0);a.stopTimer();assert.equal(a.logs['2026-09-30'].items.warmup.minutes,35);
a.program[0].children=[];a.saveProgram();assert(a.leaves(a.logs['2026-09-30'].programSnapshot).some(i=>i.id==='warmup'));assert(!a.leaves(a.logs['2026-10-01'].programSnapshot).some(i=>i.id==='warmup'));
a.openDate('2026-09-30');assert.equal(nodes['previous-note-text'].textContent,'Keep bow relaxed.');assert.equal(nodes['previous-note'].hidden,false);
for(const [date,previous] of [['2027-01-01','2026-12-31'],['2024-03-01','2024-02-29'],['2025-03-01','2025-02-28']]) {a.logs[previous]={note:'Boundary note'};a.openDate(date);assert.equal(nodes['previous-note-text'].textContent,'Boundary note');}
a.openDate('2025-03-03');assert.equal(nodes['previous-note'].hidden,true);assert(!a.logs['2025-03-02']);
assert.equal(JSON.stringify(a.logs['2026-09-29']),past);
launch({violinPracticeProgram:'{broken',violinPracticeLogs:'null'});
launch({violinPracticeLogs:JSON.stringify({_activeTimer:{itemId:'bad',date:'no',startedAt:5}})});
console.log('PASS: legacy migration, historical protection, today/future updates, add/rename/delete, safe retention, timer rounding/addition/switch/reload/date ownership/idempotent stop, exact previous-day notes, malformed storage.');
