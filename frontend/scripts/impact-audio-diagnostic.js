const fs = require('node:fs'), vm = require('node:vm'), assert = require('node:assert/strict'), ts = require('typescript');
const game = fs.readFileSync('app/game.tsx', 'utf8');
const arrival = game.slice(game.indexOf('  const onArrive = () => {'), game.indexOf('\n  const onHazardBlocked'));
for (const [isStrike, isSpare, knockedCount, expected] of [[true,false,10,'strike'],[false,true,4,'spare'],[false,false,6,'pin_crash'],[false,false,0,'gutter']]) {
  for (const owner of ['me','opp']) {
    const played=[], stopped=[], scored=[];
    vm.runInNewContext(arrival+'\nonArrive(); onArrive();', {
      pending:{current:{owner,aim:0,power:1,pu:null}}, meRef:{current:{}}, oppRef:{current:{}}, throwKey:{current:1},
      applyThrow:()=>({isStrike,isSpare,knockedCount,knocked:[]}), setArmed(){}, setKnockdown(){},
      playSound:name=>played.push(name), stopSound:name=>stopped.push(name), finishResolvedThrow:(...args)=>scored.push(args),
    });
    assert.deepEqual(played,[expected]); assert.deepEqual(stopped,['ball_roll']); assert.equal(scored.length,1);
  }
}
async function verifyPlayers(file) {
  const played=[], exports={};
  class Audio {
    constructor(uri){this.uri=uri;}
    pause(){} seekTo(){} setAttribute(){}
    play(){played.push(this.uri); return Promise.resolve();}
  }
  const source=ts.transpileModule(fs.readFileSync(file,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2020}}).outputText;
  vm.runInNewContext(source,{exports,Audio,require:path=>{
    if(path==='expo-asset')return {Asset:{fromModule:uri=>({uri})}};
    if(path==='expo-audio')return {createAudioPlayer:uri=>new Audio(uri),setAudioModeAsync:async()=>{}};
    if(path.endsWith('/storage'))return {storage:{getItem:async()=>false,setItem:async()=>{}}};
    assert.ok(fs.existsSync(path.replace('../..','.')),`Missing sound ${path}`); return path;
  }});
  await exports.initAudio(); exports.playSound('strike'); exports.playSound('spare'); exports.playSound('result');
  assert.deepEqual(played.map(p=>p.split('/').pop()),['strike_impact.mp3','spare_impact.mp3','spare.wav']);
  await exports.toggleMuted(); exports.playSound('strike'); exports.playSound('spare'); assert.equal(played.length,3);
  exports.stopSound('strike'); await exports.toggleMuted(); const before=played.length; exports.playSound('strike'); assert.equal(played.length,before+1);
}
(async()=>{
  await verifyPlayers('src/audio/sounds.web.ts'); await verifyPlayers('src/audio/sounds.ts');
  assert.ok(fs.readFileSync('app/results.tsx','utf8').includes('playSound(win ? "win" : "result")'));
  console.log('Impact audio passed: strike/spare/open/gutter, player/CPU, duplicate arrivals, web/native assets and mute, separate results cue.');
})().catch(error=>{console.error(error);process.exitCode=1;});
