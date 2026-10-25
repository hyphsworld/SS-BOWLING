const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict'),ts=require('typescript');
function run(code,values){const out=ts.transpileModule(code,{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;return new Function(...Object.keys(values),out)(...Object.values(values));}
(async()=>{
 const timers=new Map();let seq=0;const setTimeout=f=>{timers.set(++seq,f);return seq},clearTimeout=id=>timers.delete(id),m={exports:{}};
 run(fs.readFileSync('src/utils/deadline.ts','utf8'),{module:m,exports:m.exports,setTimeout,clearTimeout});const {withDeadline}=m.exports;
 assert.equal(await withDeadline(Promise.resolve(42),1,'timeout'),42);assert.equal(timers.size,0);
 const hung=withDeadline(new Promise(()=>{}),12,'timeout'),rejected=assert.rejects(hung,/timeout/);[...timers.values()][0]();await rejected;timers.clear();
 await assert.rejects(withDeadline(Promise.reject(Error('offline')),1,'timeout'),/offline/);assert.equal(timers.size,0);
 const text=fs.readFileSync('app/leaderboard.tsx','utf8'),start=text.indexOf('  const load = useCallback('),source=text.slice(start,text.indexOf('  useEffect(',start));
 const request={current:0};let rows=[],loading=true,refreshing=true,error=null,finish;
 const api={leaderboard:()=>new Promise(resolve=>finish=resolve)},exp={};run(source+'\nexports.load=load;', {exports:exp,useCallback:f=>f,request,api,setError:v=>error=v,setRows:v=>rows=v,setLoading:v=>loading=v,setRefreshing:v=>refreshing=v});
 const first=exp.load();request.current++;finish([{id:'old'}]);await first;assert.deepEqual(rows,[]);
 api.leaderboard=async()=>{throw Error('offline')};await exp.load();assert.equal(loading,false);assert.equal(refreshing,false);assert.match(error,/unavailable/);
 api.leaderboard=async()=>[{id:'confirmed',score:200}];await exp.load();assert.equal(rows[0].score,200);assert.equal(error,null);
 const lane=fs.readFileSync('src/components/BowlingLane.web.tsx','utf8'),aStart=lane.indexOf('    if (!throwState) return;'),effect=lane.slice(aStart,lane.indexOf('    if (ballRef.current) {',aStart));
 for(const unavailable of [true,false])for(const blocked of [true,false]){
  let arrivals=0,hits=0;const a={},fallbackTimerRef={current:null};timers.clear();
  const vars={setRendererUnavailable:()=>{},rafRef:{current:null},rendererRef:{current:null},cancelAnimationFrame:()=>{},throwState:{key:1,aim:.2,powerup:null},throwAnim:{current:a},fallbackTimerRef,rendererUnavailableRef:{current:unavailable},setTimeout,clearTimeout,activeWebHazard:()=>blocked?'alley-gator':null,popWallOutcome:()=>({blocked}),POCKET_X:.175,WX:1,AIM_SCALE:1,window:{dispatchEvent:()=>{}},CustomEvent:function(){},onArriveRef:{current:()=>arrivals++},onHazardBlockedRef:{current:()=>hits++}};
  run(effect,vars);const recover=[...timers.values()][0];recover();recover();assert.equal(arrivals+hits,1);assert.equal(hits,blocked?1:0);assert.equal(a.active,false);
  run(effect,vars);a.arrived=true;a.active=false;[...timers.values()][0]();assert.equal(arrivals+hits,1);
 }
 assert.match(fs.readFileSync('app/results.tsx','utf8'),/withDeadline\(\(async/);
 console.log('PASS actual deadlines, leaderboard failure/retry/stale responses, and WebGL/fallback recovery with hazards and exactly-once completion');
})().catch(e=>{console.error(e);process.exit(1)});
