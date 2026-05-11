// =========================================================================
// NEON FRONT v10 — sci-fi cyberpunk RTS-on-rails
// Complete rewrite. 4 factions × 6 units. Holographic UI. Smooth, focused.
// =========================================================================
'use strict';

// ── World scale ─────────────────────────────────────────────────────────
const FIELD_W = 64;
const FIELD_D = 32;
const PLASMA_HALF = 1.0;        // central plasma stream (was river)
const LANE_TOP_Z = -8.5;
const LANE_MID_Z = 0;
const LANE_BOT_Z = 8.5;
const LANE_HALF = 3.4;
const BRIDGES = [
  { z:LANE_TOP_Z, halfLength:2.3 },
  { z:LANE_MID_Z, halfLength:2.3 },
  { z:LANE_BOT_Z, halfLength:2.3 },
];

// ── 6 ROLES — clear archetypes, no overlap ─────────────────────────────
// Each role has a well-defined job. No 15-role mess this time.
const ROLES = {
  trooper:  { cost:3, hp:280, dmg:34, atkSpeed:0.5, range:9,  speed:3.4, radius:0.42, type:'ground', targets:'ground_air', count:1, fire:'shot',     desc:'Solid rifleman. Backbone unit.' },
  heavy:    { cost:5, hp:620, dmg:28, atkSpeed:0.18,range:10, speed:1.7, radius:0.55, type:'ground', targets:'ground_air', count:1, fire:'minigun',  desc:'Slow tank. Sustained DPS.' },
  sniper:   { cost:4, hp:200, dmg:280, atkSpeed:2.2,range:24, speed:0,   radius:0.40, type:'ground', targets:'ground_air', count:1, fire:'snipe',    desc:'Stationary. Long range.' },
  assault:  { cost:3, hp:340, dmg:42, atkSpeed:0.35,range:6,  speed:5.4, radius:0.45, type:'ground', targets:'ground',     count:1, fire:'burst3',   desc:'Fast flanker. Short range.' },
  mech:     { cost:7, hp:1200,dmg:180,atkSpeed:1.3, range:14, speed:1.9, radius:0.78, type:'ground', targets:'ground',     count:1, fire:'cannon', splash:1.6, desc:'Heavy walker. Splash damage.' },
  drone:    { cost:5, hp:380, dmg:38, atkSpeed:0.18,range:11, speed:4.2, radius:0.50, type:'air',    targets:'ground_air', count:1, fire:'chain',    desc:'Hover. Mobile attack platform.' },
};

// Damage multiplier matrix (attacker × target)
const DMG_MUL = {
  trooper:  { sniper:1.3 },
  heavy:    { trooper:1.4, assault:1.4, drone:1.3, mech:0.5 },
  sniper:   { sniper:1.5, drone:2.0, mech:0.5, assault:0.7 },
  assault:  { sniper:2.0, heavy:0.6, mech:0.3 },
  mech:     { mech:1.4, heavy:1.5, drone:0.0, sniper:1.6 },
  drone:    { trooper:1.3, sniper:1.6, mech:0.4 },
};
function getDmgMul(att, tgt){ if(!att||!tgt) return 1; const r=DMG_MUL[att]; if(!r) return 1; const v=r[tgt]; return v==null?1:v; }

// ── 4 FACTIONS — distinct color, identity, mod ─────────────────────────
const FACTIONS = {
  nexus: {
    name:'NEXUS', tag:'CORPORATE POLICE', desc:'Disciplined. High-tech. Drone-heavy.',
    color:0x00cfff, accent:0xffffff, glow:0x00ffff, dark:0x002240, neon:0x00ddff,
    mod:{ hp:1.10, dmg:1.0, speed:1.0, range:1.05 },
    unitNames:{ trooper:'Cyber Cop', heavy:'Enforcer', sniper:'Scope Op', assault:'Pulse Trooper', mech:'Sentinel', drone:'Watcher' },
    powers:['nexus_overload','nexus_shield','nexus_drones'],
  },
  scrapyard: {
    name:'SCRAPYARD', tag:'OUTLAW REBELS', desc:'Improvised. Fast. Aggressive.',
    color:0xff7000, accent:0xffaa00, glow:0xff8800, dark:0x401a00, neon:0xff5500,
    mod:{ hp:0.95, dmg:1.05, speed:1.15, range:1.0 },
    unitNames:{ trooper:'Junker', heavy:'Wrecker', sniper:'Hunter', assault:'Scrapper', mech:'Bonebreaker', drone:'Buzzsaw' },
    powers:['scrap_warcry','scrap_napalm','scrap_swarm'],
  },
  aegis: {
    name:'AEGIS', tag:'PRIVATE MILITARY', desc:'Balanced. Heavy armor. Reliable.',
    color:0x00ff88, accent:0xccffaa, glow:0x00ff66, dark:0x004020, neon:0x00ee77,
    mod:{ hp:1.18, dmg:1.0, speed:0.92, range:1.0 },
    unitNames:{ trooper:'Soldier', heavy:'Bulwark', sniper:'Marksman', assault:'Vanguard', mech:'Titan', drone:'Sentry' },
    powers:['aegis_artillery','aegis_aegis','aegis_reinforce'],
  },
  void: {
    name:'VOID', tag:'XENOMORPHS', desc:'Biotech. Long range. Fragile.',
    color:0xff00cc, accent:0xff66ff, glow:0xff00aa, dark:0x400030, neon:0xff22cc,
    mod:{ hp:0.92, dmg:1.0, speed:1.0, range:1.20 },
    unitNames:{ trooper:'Spawn', heavy:'Brood Lord', sniper:'Eye Priest', assault:'Stalker', mech:'Aberration', drone:'Wisp' },
    powers:['void_curse','void_frenzy','void_summon'],
  },
};
function getFactionMod(fk){ return (FACTIONS[fk]||FACTIONS.nexus).mod; }

const UNITS = {};
function buildUnits(){
  for(const k of Object.keys(UNITS)) delete UNITS[k];
  for(const fk of Object.keys(FACTIONS)){
    const f = FACTIONS[fk];
    for(const r of Object.keys(ROLES)){
      const s = ROLES[r];
      UNITS[fk+'_'+r] = {...s, name:f.unitNames[r], role:r.toUpperCase(), roleKey:r, faction:fk,
        color:f.color, accent:f.accent, glow:f.glow, dark:f.dark, neon:f.neon };
    }
  }
}
buildUnits();

// ── POWERS — 3 per faction ─────────────────────────────────────────────
const POWERS = {
  // NEXUS — disruption, shielding, drones
  nexus_overload:{ name:'OVERLOAD', cost:4, faction:'nexus', desc:'Stun all enemies in area for 4s', sfx:'emp' },
  nexus_shield:  { name:'AEGIS FIELD', cost:3, faction:'nexus', desc:'All allies -50% dmg taken for 6s', sfx:'shield' },
  nexus_drones:  { name:'DRONE SWARM', cost:5, faction:'nexus', desc:'4 attack drones strike target area', sfx:'rocket' },
  // SCRAPYARD — fire, swarm, aggression
  scrap_warcry:  { name:'WAR CRY', cost:3, faction:'scrapyard', desc:'+30% speed & dmg for all rebels 6s', sfx:'roar' },
  scrap_napalm:  { name:'NAPALM', cost:5, faction:'scrapyard', desc:'Fire zone: 6s burning area damage', sfx:'fire' },
  scrap_swarm:   { name:'BONE WAVE', cost:4, faction:'scrapyard', desc:'Spawn 4 free Junkers at target', sfx:'spawn' },
  // AEGIS — heavy ordnance, durability
  aegis_artillery:{ name:'BARRAGE', cost:5, faction:'aegis', desc:'5 shells over 4s in target area', sfx:'mortar' },
  aegis_aegis:   { name:'IRON WALL', cost:4, faction:'aegis', desc:'All allies +200 HP shield for 8s', sfx:'shield' },
  aegis_reinforce:{ name:'REINFORCE', cost:3, faction:'aegis', desc:'Spawn 2 free Soldiers at target', sfx:'deploy' },
  // VOID — energy, summons, debuffs
  void_curse:    { name:'WARP CURSE', cost:4, faction:'void', desc:'Enemies in area instantly lose 40% HP', sfx:'warp' },
  void_frenzy:   { name:'BLOOD FRENZY', cost:3, faction:'void', desc:'Allies in area +60% dmg for 6s', sfx:'roar' },
  void_summon:   { name:'SUMMON HORROR', cost:6, faction:'void', desc:'Spawn an Aberration mech at target', sfx:'warp' },
};

// ── MISSIONS ───────────────────────────────────────────────────────────
const MISSIONS = [
  { id:1, name:'TRAINING GROUNDS', desc:'First contact. Defeat the corporate cadre.', enemy:'NEXUS Cadets', enemyFaction:'nexus', aiSpeed:0.55, aiSmart:0.30, enemyHpMul:0.85 },
  { id:2, name:'BORDER GLITCH',    desc:'Outlaw raiders pushing into the grid.', enemy:'SCRAPYARD Rabble', enemyFaction:'scrapyard', aiSpeed:0.70, aiSmart:0.50, enemyHpMul:0.95 },
  { id:3, name:'DEEP SECTOR',      desc:'Corporate strike force. Heavy mechs deployed.', enemy:'NEXUS Strike', enemyFaction:'nexus', aiSpeed:0.85, aiSmart:0.65, enemyHpMul:1.05 },
  { id:4, name:'DEAD ZONE',        desc:'Xenomorphs detected. Long-range threat.', enemy:'VOID Spawn', enemyFaction:'void', aiSpeed:0.95, aiSmart:0.75, enemyHpMul:1.10 },
  { id:5, name:'AEGIS ULTIMATUM',  desc:'Mercenaries in your zone. End them.', enemy:'AEGIS Battalion', enemyFaction:'aegis', aiSpeed:1.05, aiSmart:0.85, enemyHpMul:1.15 },
  { id:6, name:'WAR FOR THE CORE', desc:'Final operation. No mercy.', enemy:'VOID Apex', enemyFaction:'void', aiSpeed:1.20, aiSmart:0.95, enemyHpMul:1.25 },
];
const MISSION_REWARDS = {1:[],2:['nexus_overload'],3:['aegis_aegis'],4:['scrap_warcry'],5:['void_frenzy'],6:[]};

// ── TOWER TYPES (forward turrets per side) ─────────────────────────────
const TOWER_TYPES = {
  pulse: { name:'PULSE TURRET', hp:1200, dmg:42, range:13, atkSpeed:0.85, targets:'ground_air', windup:0.4 },
};

// ── DIFFICULTY ─────────────────────────────────────────────────────────
const DIFFICULTY = {
  easy:   { name:'EASY',   aiSpeedMul:0.6,  aiSmartMul:0.55, enemyHpMul:0.75, enemyStartEnergy:3, playerStartEnergyBonus:2 },
  normal: { name:'NORMAL', aiSpeedMul:1.0,  aiSmartMul:1.0,  enemyHpMul:1.0,  enemyStartEnergy:5, playerStartEnergyBonus:0 },
  hard:   { name:'HARD',   aiSpeedMul:1.25, aiSmartMul:1.15, enemyHpMul:1.15, enemyStartEnergy:7, playerStartEnergyBonus:0 },
  brutal: { name:'BRUTAL', aiSpeedMul:1.55, aiSmartMul:1.30, enemyHpMul:1.35, enemyStartEnergy:9, playerStartEnergyBonus:0 },
};

// ── 3 MAPS — clean, sci-fi flavor ──────────────────────────────────────
const MAPS = {
  grid:   { name:'THE GRID',   desc:'Cyberpunk 3-lane. Plasma stream + bridges.',
            ground:0x0a1828, accent:0x00ffaa, gridA:0x0066ff, gridB:0x00ffff, dirtPath:0x2a4a5a, plasma:0xff00cc, bridge:0x202840 },
  vault:  { name:'THE VAULT',  desc:'Industrial corridor. Tighter, more cover.',
            ground:0x182018, accent:0xff7700, gridA:0xff5500, gridB:0xffaa00, dirtPath:0x3a3020, plasma:0xff5500, bridge:0x282028 },
  arena:  { name:'NEON ARENA', desc:'Open hex stadium. No plasma stream.',
            ground:0x080418, accent:0xff00cc, gridA:0xff00aa, gridB:0xff66ff, dirtPath:0x301a3a, plasma:0xff00cc, bridge:0x401838 },
};

// ── Quality presets ────────────────────────────────────────────────────
const QUALITY = {
  low:    { name:'LOW',    shadowMap:1024, particleMul:0.5, pixelRatio:1.0, postFX:false },
  medium: { name:'MEDIUM', shadowMap:1536, particleMul:0.9, pixelRatio:1.5, postFX:true },
  high:   { name:'HIGH',   shadowMap:2560, particleMul:1.4, pixelRatio:2.0, postFX:true },
};

// ── STATE ──────────────────────────────────────────────────────────────
const STATE = {
  running:false, paused:false, matchEnded:false, matchId:0,
  energy:5, maxEnergy:10, energyRate:1/2.4,
  enemyEnergy:5, enemyHand:[], enemyHandPool:[], enemyCooldowns:{},
  units:[], projectiles:[], fx:[], towers:[],
  timer:180, selectedCard:null, lastTime:0, currentMission:null, toastTimer:0,
  progress:null, armoryTab:'units', pendingMission:null,
  shake:{t:0,mag:0}, energyMul:1, overtime:false,
  cam:{ targetX:0, targetY:0, targetZ:2, distance:36, yaw:0, pitch:1.05, roll:0, fov:42, orbiting:false, preset:0, panning:false, pinching:false, _heightOffset:0 },
  difficulty:'normal',
  stats:{ kills:0, allyDeaths:0, deployed:0, dmgDealt:0, dmgTaken:0 },
  bloodIntensity:0,
  handSlots:[], deckQueue:[],
  mapKey:'grid',
};

const DECK_UNIT_MAX = 4, DECK_UNIT_MIN = 3, DECK_POWER_MAX = 2, DECK_POWER_MIN = 1, HAND_SIZE = 4;

function loadProgress(){
  const def = { completed:[], unlockedPowers:[], playerFaction:'nexus', decks:{}, mapKey:'grid', quality:'medium', difficulty:'normal' };
  try {
    const s = JSON.parse(localStorage.getItem('neonfrontV10'));
    if(!s) return def;
    const m = {...def, ...s, decks:{...def.decks, ...(s.decks||{})}};
    // Always unlock all powers (reduce friction)
    const all = new Set(m.unlockedPowers||[]);
    for(const fk of Object.keys(FACTIONS)) for(const p of FACTIONS[fk].powers) all.add(p);
    m.unlockedPowers = Array.from(all);
    return m;
  } catch { return def; }
}
function saveProgress(){ try { localStorage.setItem('neonfrontV10', JSON.stringify(STATE.progress)); } catch(e){} }
function getQuality(){ return QUALITY[(STATE.progress&&STATE.progress.quality)||'medium']||QUALITY.medium; }
function getMap(){ return MAPS[STATE.mapKey] || MAPS.grid; }

function shuffleArray(a){
  for(let i=a.length-1;i>0;i--){ const j=Math.floor(Math.random()*(i+1)); [a[i],a[j]]=[a[j],a[i]]; }
  return a;
}

function normalizeDeck(){
  const fk = STATE.progress.playerFaction;
  const fU = Object.keys(ROLES).map(r => fk+'_'+r);
  const fP = (FACTIONS[fk]||FACTIONS.nexus).powers;
  let deck = (STATE.progress.decks[fk]||[]).filter(c => fU.includes(c) || fP.includes(c));
  let units = deck.filter(c => fU.includes(c));
  let powers = deck.filter(c => fP.includes(c));
  // Default unit picks (4)
  const defU = ['trooper','heavy','sniper','assault'].map(r => fk+'_'+r);
  for(const u of defU){ if(units.length>=DECK_UNIT_MAX) break; if(!units.includes(u)) units.push(u); }
  while(units.length < DECK_UNIT_MIN){ const p=fU.find(u=>!units.includes(u))||fU[0]; units.push(p); }
  if(units.length > DECK_UNIT_MAX) units = units.slice(0, DECK_UNIT_MAX);
  // Default powers (2)
  for(const p of fP){ if(powers.length>=DECK_POWER_MAX) break; if(!powers.includes(p)) powers.push(p); }
  if(powers.length < DECK_POWER_MIN && fP.length){ powers.push(fP[0]); }
  if(powers.length > DECK_POWER_MAX) powers = powers.slice(0, DECK_POWER_MAX);
  STATE.progress.decks[fk] = [...units, ...powers];
  saveProgress();
}


// =========================================================================
// AUDIO — punchier, layered, cleaner (fewer kinds, all polished)
// =========================================================================
let AC = null;
let _bus = null, _rev = null;
function ensureAudio(){
  if (!AC) AC = new (window.AudioContext||window.webkitAudioContext)();
  if (!_bus) {
    _bus = AC.createGain(); _bus.gain.value = 0.85;
    _bus.connect(AC.destination);
    try {
      const conv = AC.createConvolver();
      const sr = AC.sampleRate, dur = 1.2;
      const buf = AC.createBuffer(2, sr * dur, sr);
      for (let ch=0; ch<2; ch++) {
        const d = buf.getChannelData(ch);
        for (let i=0; i<d.length; i++) d[i] = (Math.random()*2-1) * Math.pow(1 - i/d.length, 2.5);
      }
      conv.buffer = buf;
      const wet = AC.createGain(); wet.gain.value = 0.18;
      conv.connect(wet); wet.connect(_bus);
      _rev = AC.createGain(); _rev.gain.value = 1.0; _rev.connect(conv);
    } catch(e) { _rev = _bus; }
  }
  return AC;
}
function _out(rev){ ensureAudio(); if (rev && _rev) { const s = AC.createGain(); s.connect(_bus); s.connect(_rev); return s; } return _bus; }
function _noise(d){ const sr=AC.sampleRate, l=Math.floor(sr*d), b=AC.createBuffer(1,l,sr), c=b.getChannelData(0); for(let i=0;i<l;i++) c[i]=Math.random()*2-1; return b; }
function tone(f1,f2,d,t,v,opts){ opts=opts||{}; try{ const a=ensureAudio(),n=a.currentTime,o=a.createOscillator(),g=a.createGain(); o.type=t||'square'; o.frequency.setValueAtTime(f1,n); o.frequency.exponentialRampToValueAtTime(Math.max(40,f2),n+d); g.gain.setValueAtTime(0,n); g.gain.linearRampToValueAtTime(v,n+(opts.atk||0.002)); g.gain.exponentialRampToValueAtTime(.0001,n+d); o.connect(g); g.connect(_out(opts.rev)); o.start(n); o.stop(n+d+0.02); }catch(e){} }
function noiseTone(d,f,q,v,a,opts){ opts=opts||{}; try{ const ac=ensureAudio(),s=ac.createBufferSource(); s.buffer=_noise(d); const fi=ac.createBiquadFilter(); fi.type=opts.filter||'bandpass'; fi.frequency.value=f; fi.Q.value=q||1; const g=ac.createGain(),n=ac.currentTime; g.gain.setValueAtTime(0,n); g.gain.linearRampToValueAtTime(v,n+(a||0.005)); g.gain.exponentialRampToValueAtTime(.0001,n+d); s.connect(fi); fi.connect(g); g.connect(_out(opts.rev)); s.start(n); s.stop(n+d); }catch(e){} }
function sub(d,f,v,opts){ opts=opts||{}; try{ const a=ensureAudio(),n=a.currentTime,o=a.createOscillator(),g=a.createGain(); o.type='sine'; o.frequency.setValueAtTime(f,n); o.frequency.exponentialRampToValueAtTime(Math.max(20,f*0.3),n+d); g.gain.setValueAtTime(0,n); g.gain.linearRampToValueAtTime(v,n+0.002); g.gain.exponentialRampToValueAtTime(.0001,n+d); o.connect(g); g.connect(_out(opts.rev)); o.start(n); o.stop(n+d+0.02); }catch(e){} }
function click(f,v){ try{ const a=ensureAudio(),n=a.currentTime,o=a.createOscillator(),g=a.createGain(); o.type='triangle'; o.frequency.setValueAtTime(f*4,n); o.frequency.exponentialRampToValueAtTime(f,n+0.012); g.gain.setValueAtTime(v,n); g.gain.exponentialRampToValueAtTime(.0001,n+0.022); o.connect(g); g.connect(_bus); o.start(n); o.stop(n+0.04); }catch(e){} }

function playSound(k){ try{ const a=ensureAudio(); if(a.state==='suspended') a.resume();
  // Sci-fi shot: layered laser/gauss
  if (k === 'shot') { click(2200, 0.04); tone(1800, 600, 0.06, 'sawtooth', 0.05); noiseTone(0.05, 4500, 4, 0.04); sub(0.10, 100, 0.05); }
  else if (k === 'burst3') { for (let i=0;i<3;i++) setTimeout(()=>playSound('shot'), i*48); }
  else if (k === 'snipe') { click(3000, 0.08); tone(2800, 380, 0.18, 'sawtooth', 0.10); noiseTone(0.6, 1500, 1.5, 0.10, 0.001, {rev:true}); sub(0.40, 130, 0.13); }
  else if (k === 'minigun') { for (let i=0;i<7;i++) setTimeout(()=>{ click(1300+Math.random()*200, 0.025); tone(900+Math.random()*300, 500, 0.024, 'square', 0.034); noiseTone(0.03, 3500, 4, 0.030); }, i*28); }
  else if (k === 'chain') { for (let i=0;i<5;i++) setTimeout(()=>{ click(1500, 0.025); tone(1100, 800, 0.02, 'square', 0.030); noiseTone(0.03, 3000, 3.5, 0.026); }, i*22); }
  else if (k === 'cannon') { sub(0.85, 60, 0.30); tone(70, 22, 0.7, 'sawtooth', 0.22); noiseTone(0.6, 150, 1.2, 0.22, 0.001, {rev:true}); click(420, 0.20); }
  else if (k === 'rocket') { tone(220, 70, 0.45, 'sawtooth', 0.13); noiseTone(0.55, 700, 1.8, 0.12, 0.005, {rev:true}); sub(0.45, 80, 0.12); }
  else if (k === 'mortar') { tone(220, 50, 0.30, 'triangle', 0.13); noiseTone(0.22, 240, 2.5, 0.10); }
  else if (k === 'boom') { click(800, 0.18); sub(0.55, 80, 0.30); tone(100, 28, 0.65, 'sawtooth', 0.16); noiseTone(0.75, 320, 1.2, 0.22, 0.001, {rev:true}); }
  else if (k === 'boom_big') { click(560, 0.30); sub(1.2, 45, 0.45); tone(45, 14, 1.2, 'sawtooth', 0.28); noiseTone(1.4, 160, 0.7, 0.32, 0.001, {rev:true}); setTimeout(()=>{ sub(0.7, 60, 0.18); noiseTone(0.7, 100, 0.7, 0.18, 0.001, {rev:true}); }, 80); }
  else if (k === 'deploy') { tone(380, 720, 0.10, 'sine', 0.06); tone(720, 1200, 0.10, 'triangle', 0.05, {rev:true}); setTimeout(()=>click(1800, 0.06), 50); }
  else if (k === 'ui_click') { click(1200, 0.06); tone(1000, 800, 0.04, 'square', 0.025); }
  else if (k === 'ui_select') { tone(700, 1200, 0.07, 'triangle', 0.05); setTimeout(()=>{ tone(1200, 1700, 0.08, 'sine', 0.04, {rev:true}); click(2000, 0.06); }, 30); }
  else if (k === 'win') { const ns=[440,554,659,880,1108]; ns.forEach((f,i)=>setTimeout(()=>{ tone(f,f,.32,'triangle',.07); tone(f*2,f*2,.32,'sine',.04,{rev:true}); }, i*100)); }
  else if (k === 'lose') { const ns=[440,370,277,220,165]; ns.forEach((f,i)=>setTimeout(()=>{ tone(f,f,.4,'sawtooth',.08); tone(f*0.5,f*0.5,.4,'sine',.05,{rev:true}); }, i*180)); }
  else if (k === 'siren') { try{ const ac=ensureAudio(),n=ac.currentTime,o=ac.createOscillator(),g=ac.createGain(); o.type='sine'; o.frequency.setValueAtTime(500,n); for(let i=1;i<=4;i++) o.frequency.linearRampToValueAtTime(i%2?900:500,n+i*0.25); g.gain.setValueAtTime(0.07,n); g.gain.exponentialRampToValueAtTime(0.001,n+1.05); o.connect(g); g.connect(_out(true)); o.start(n); o.stop(n+1.1); }catch(e){} }
  else if (k === 'shield') { tone(400, 800, 0.3, 'sine', 0.06, {rev:true}); tone(800, 400, 0.3, 'triangle', 0.04, {rev:true}); click(1600, 0.08); }
  else if (k === 'roar') { tone(180, 100, 0.5, 'sawtooth', 0.12); noiseTone(0.5, 800, 1.5, 0.10, 0.005, {rev:true}); }
  else if (k === 'fire') { noiseTone(0.5, 380, 0.6, 0.14, 0.020); tone(110, 70, 0.45, 'sawtooth', 0.07); }
  else if (k === 'spawn') { click(1400, 0.05); tone(500, 900, 0.12, 'sine', 0.06); tone(900, 1400, 0.10, 'triangle', 0.04, {rev:true}); }
  else if (k === 'warp') { tone(300, 1500, 0.4, 'sine', 0.10, {rev:true}); tone(1500, 300, 0.4, 'sawtooth', 0.06, {rev:true}); noiseTone(0.5, 2500, 5, 0.06, 0.005); }
  else if (k === 'emp') { tone(2400, 60, 0.8, 'square', 0.12, {rev:true}); tone(1900, 50, 0.6, 'sawtooth', 0.07); noiseTone(0.8, 1800, 4, 0.06, 0.005, {rev:true}); }
  else if (k === 'gore') { noiseTone(0.10, 400, 2.5, 0.10, 0.002); tone(180, 75, 0.12, 'sawtooth', 0.06); }
  else if (k === 'flak') { click(1500, 0.06); tone(800, 220, 0.16, 'sawtooth', 0.10); noiseTone(0.20, 900, 1.5, 0.08); }
}catch(e){} }


// =========================================================================
// THREE.JS SETUP — cyberpunk grid floor, neon lights, plasma stream
// =========================================================================
let scene, camera, renderer, raycaster, pointer;
let groundMesh, gridMesh, plasmaMesh, plasmaUniforms;
let deployZoneMesh, rangePreviewMesh, skyMesh;
let lastPointerWorld = { x:0, z:0 };
const unitObjects = new Map();
const towerObjects = new Map();
const projObjects = new Map();
let fxObjects = [];
let nextId = 1;

// Shared materials so we don't allocate per mesh
const _OUT_MAT = new THREE.MeshBasicMaterial({ color:0x000000, side:THREE.BackSide });
function basicMat(color, opts){ opts=opts||{}; return new THREE.MeshBasicMaterial({ color, transparent:!!opts.transparent, opacity:opts.opacity||1, side:opts.side||THREE.FrontSide, depthWrite:opts.depthWrite!==false }); }
function lambertMat(color, opts){ opts=opts||{}; return new THREE.MeshLambertMaterial({ color, emissive:opts.emissive||0x000000, emissiveIntensity:opts.emissiveIntensity||0, transparent:!!opts.transparent, opacity:opts.opacity||1 }); }
function metalMat(color, opts){ opts=opts||{}; return new THREE.MeshStandardMaterial({ color, roughness:opts.roughness||0.4, metalness:opts.metalness||0.7, emissive:opts.emissive||0x000000, emissiveIntensity:opts.emissiveIntensity||0 }); }
function neonMat(color){ return new THREE.MeshBasicMaterial({ color, transparent:true, opacity:0.95 }); }

function disposeObject3D(obj){ if(!obj) return; obj.traverse(o=>{ if(o.geometry){try{o.geometry.dispose();}catch(e){}} if(o.material){const m=Array.isArray(o.material)?o.material:[o.material]; for(const x of m){try{ if(x.map) x.map.dispose(); if(x.dispose) x.dispose(); }catch(e){}} } }); }
function removeAndDispose(mesh){ if(!mesh) return; if(mesh.parent) mesh.parent.remove(mesh); else if(scene) scene.remove(mesh); disposeObject3D(mesh); }

// Outline only on big parts (perf)
function addOutline(group, thickness){
  thickness = thickness || 1.05;
  group.traverse(o => {
    if (!o.isMesh || o.userData.isOutline || !o.geometry) return;
    if (!o.geometry.boundingSphere) o.geometry.computeBoundingSphere();
    const r = (o.geometry.boundingSphere && o.geometry.boundingSphere.radius) || 0;
    if (r < 0.20) return;
    const out = new THREE.Mesh(o.geometry, _OUT_MAT);
    out.scale.setScalar(thickness);
    out.userData.isOutline = true;
    out.castShadow = false; out.receiveShadow = false;
    out.renderOrder = -1;
    o.add(out);
  });
}

function initThree(){
  const container = document.getElementById('threeContainer');
  const map = getMap();
  const Q = getQuality();
  scene = new THREE.Scene();
  scene.background = new THREE.Color(0x000408);
  scene.fog = new THREE.Fog(0x000814, 35, 140);
  camera = new THREE.PerspectiveCamera(STATE.cam.fov, 1, 0.3, 400);
  renderer = new THREE.WebGLRenderer({ antialias:Q.postFX, powerPreference:'high-performance', precision:'mediump', failIfMajorPerformanceCaveat:false });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio||1, Q.pixelRatio));
  renderer.shadowMap.enabled = Q.postFX;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.outputEncoding = THREE.sRGBEncoding;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.6;   // pump exposure for neon glow
  container.innerHTML = '';
  container.appendChild(renderer.domElement);

  // ── LIGHTS ── cool ambient + cyan key + magenta rim
  scene.add(new THREE.HemisphereLight(0x4080ff, 0x100020, 0.5));
  const key = new THREE.DirectionalLight(0xaaffff, 0.95);
  key.position.set(20, 35, 18);
  if (Q.postFX) {
    key.castShadow = true;
    key.shadow.mapSize.width = Q.shadowMap; key.shadow.mapSize.height = Q.shadowMap;
    key.shadow.camera.left = -45; key.shadow.camera.right = 45;
    key.shadow.camera.top = 30; key.shadow.camera.bottom = -30;
    key.shadow.camera.near = 5; key.shadow.camera.far = 100;
    key.shadow.bias = -0.0004;
  }
  scene.add(key);
  const fill = new THREE.DirectionalLight(0xff00cc, 0.55);
  fill.position.set(-20, 22, -16);
  scene.add(fill);
  const rim = new THREE.DirectionalLight(0x00ffaa, 0.45);
  rim.position.set(0, 14, -28);
  scene.add(rim);
  scene.add(new THREE.AmbientLight(0x202040, 0.4));

  raycaster = new THREE.Raycaster();
  pointer = new THREE.Vector2();
  buildSky();
  buildField(map);
  buildPlasma(map);
  resizeThree();
}

function buildSky(){
  // Star plane behind everything
  const skyGeo = new THREE.SphereGeometry(220, 24, 16);
  const skyMat = new THREE.ShaderMaterial({
    side: THREE.BackSide, depthWrite: false,
    uniforms: {},
    vertexShader: 'varying vec3 vP; void main(){ vP=position; gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0); }',
    fragmentShader: `
      varying vec3 vP;
      // Cheap procedural starfield + nebula gradient
      float hash(vec3 p){ return fract(sin(dot(p, vec3(12.9898, 78.233, 37.719))) * 43758.5453); }
      void main(){
        vec3 dir = normalize(vP);
        // Nebula gradient
        float t = clamp(dir.y * 0.5 + 0.5, 0.0, 1.0);
        vec3 horizon = mix(vec3(0.05, 0.0, 0.10), vec3(0.0, 0.04, 0.12), t);
        vec3 zenith  = vec3(0.0, 0.005, 0.02);
        vec3 col = mix(horizon, zenith, t);
        // Distant magenta glow on horizon
        float glow = pow(max(0.0, 1.0 - abs(dir.y) * 4.0), 5.0);
        col += vec3(0.4, 0.0, 0.5) * glow * 0.25;
        // Stars
        vec3 g = floor(dir * 200.0);
        if (hash(g) > 0.992) {
          float twinkle = 0.6 + 0.4 * sin(hash(g+1.0)*100.0);
          col += vec3(twinkle);
        }
        gl_FragColor = vec4(col, 1.0);
      }`,
  });
  skyMesh = new THREE.Mesh(skyGeo, skyMat);
  scene.add(skyMesh);
}

function buildField(map){
  // ── Ground: dark plane with neon grid ──
  const groundGeo = new THREE.PlaneGeometry(FIELD_W + 40, FIELD_D + 30, 1, 1);
  groundMesh = new THREE.Mesh(groundGeo, lambertMat(map.ground));
  groundMesh.rotation.x = -Math.PI/2;
  groundMesh.receiveShadow = true;
  scene.add(groundMesh);
  // ── Cyberpunk neon grid overlay (shader)
  const gridGeo = new THREE.PlaneGeometry(FIELD_W + 30, FIELD_D + 20, 1, 1);
  const gridMat = new THREE.ShaderMaterial({
    transparent:true, depthWrite:false,
    uniforms:{
      colA:{ value: new THREE.Color(map.gridA) },
      colB:{ value: new THREE.Color(map.gridB) },
      time:{ value: 0 },
    },
    vertexShader: 'varying vec2 vUv; void main(){ vUv = position.xy; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
    fragmentShader: `
      varying vec2 vUv;
      uniform vec3 colA, colB;
      uniform float time;
      void main(){
        // Grid lines
        vec2 g = abs(fract(vUv * 0.25 + 0.5) - 0.5);
        float line = smoothstep(0.48, 0.50, max(g.x, g.y));
        // Pulse along major axis
        float pulse = 0.5 + 0.5 * sin(vUv.x * 0.2 + time * 2.0);
        vec3 col = mix(colA, colB, pulse);
        float alpha = line * 0.55;
        // Brighter grid lines on major intersections
        vec2 gM = abs(fract(vUv * 0.05 + 0.5) - 0.5);
        float majorLine = smoothstep(0.46, 0.50, max(gM.x, gM.y));
        col += vec3(1.0) * majorLine * 0.15;
        alpha += majorLine * 0.4;
        gl_FragColor = vec4(col, alpha);
      }`
  });
  gridMesh = new THREE.Mesh(gridGeo, gridMat);
  gridMesh.rotation.x = -Math.PI/2;
  gridMesh.position.y = 0.02;
  scene.add(gridMesh);

  // ── Lane paths — strong neon edges ──
  for (const lz of [LANE_TOP_Z, LANE_MID_Z, LANE_BOT_Z]) {
    // Dim center of lane
    const path = new THREE.Mesh(
      new THREE.PlaneGeometry(FIELD_W - 12, 3.4),
      basicMat(map.dirtPath, { transparent:true, opacity:0.5, depthWrite:false })
    );
    path.rotation.x = -Math.PI/2; path.position.set(0, 0.04, lz);
    scene.add(path);
    // Bright neon edges
    for (const zo of [-1.7, 1.7]) {
      const edge = new THREE.Mesh(
        new THREE.PlaneGeometry(FIELD_W - 12, 0.10),
        basicMat(map.accent, { transparent:true, opacity:0.85, depthWrite:false })
      );
      edge.rotation.x = -Math.PI/2; edge.position.set(0, 0.06, lz + zo);
      scene.add(edge);
    }
  }

  // ── Side tint & deploy zone ──
  for (const [side, col] of [[-1, 0x00cfff], [1, 0xff4488]]) {
    const tint = new THREE.Mesh(
      new THREE.PlaneGeometry(FIELD_W/2 - PLASMA_HALF, FIELD_D),
      basicMat(col, { transparent:true, opacity:0.07, depthWrite:false })
    );
    tint.rotation.x = -Math.PI/2;
    tint.position.set(side * (FIELD_W/4 + PLASMA_HALF/2), 0.03, 0);
    scene.add(tint);
  }
  deployZoneMesh = new THREE.Mesh(
    new THREE.PlaneGeometry(FIELD_W/2 - PLASMA_HALF - 3, FIELD_D - 2),
    basicMat(0x00cfff, { transparent:true, opacity:0, side:THREE.DoubleSide, depthWrite:false })
  );
  deployZoneMesh.rotation.x = -Math.PI/2;
  deployZoneMesh.position.set(-FIELD_W/4 - 2, 0.06, 0);
  scene.add(deployZoneMesh);

  // ── Range preview ring ──
  rangePreviewMesh = new THREE.Mesh(
    new THREE.RingGeometry(0.99, 1.0, 48),
    basicMat(0x00cfff, { transparent:true, opacity:0, side:THREE.DoubleSide, depthWrite:false })
  );
  rangePreviewMesh.rotation.x = -Math.PI/2;
  rangePreviewMesh.position.y = 0.07;
  scene.add(rangePreviewMesh);

  // ── Bridges over the plasma stream ──
  for (const b of BRIDGES) {
    const bg = new THREE.Group();
    const deck = new THREE.Mesh(new THREE.BoxGeometry(PLASMA_HALF * 2.6, 0.20, b.halfLength * 2), lambertMat(map.bridge));
    deck.position.y = 0.12; deck.castShadow = true; deck.receiveShadow = true; bg.add(deck);
    // Neon edge bars
    for (let zs of [-b.halfLength, b.halfLength]) {
      const bar = new THREE.Mesh(new THREE.BoxGeometry(PLASMA_HALF * 2.7, 0.05, 0.10), basicMat(map.accent, { transparent:true, opacity:0.95 }));
      bar.position.set(0, 0.27, zs); bg.add(bar);
    }
    addOutline(bg, 1.03);
    bg.position.set(0, 0, b.z);
    scene.add(bg);
  }

  // ── Distant cityscape silhouette behind both sides ──
  for (const side of [-1, 1]) {
    const x0 = side * (FIELD_W/2 + 20);
    for (let i = 0; i < 14; i++) {
      const w = 1.5 + Math.random() * 4;
      const h = 5 + Math.random() * 18;
      const tz = (Math.random() - 0.5) * (FIELD_D + 30);
      const bx = x0 + (Math.random() - 0.5) * 12;
      const b = new THREE.Mesh(new THREE.BoxGeometry(w, h, w), lambertMat(0x080614));
      b.position.set(bx, h/2, tz);
      scene.add(b);
      // Random window lights
      if (Math.random() < 0.6) {
        const win = new THREE.Mesh(
          new THREE.PlaneGeometry(w * 0.4, 0.4),
          basicMat(Math.random() < 0.5 ? 0x00ffff : 0xff00cc, { transparent:true, opacity:0.9 })
        );
        win.position.set(bx + Math.sign(-side) * (w/2 + 0.01), h - 1.5, tz);
        win.rotation.y = side > 0 ? Math.PI/2 : -Math.PI/2;
        scene.add(win);
      }
    }
  }

  // ── Scattered cover crates / pylons in midfield ──
  for (let i = 0; i < 12; i++) {
    const x = (Math.random() - 0.5) * (FIELD_W - 14);
    const z = (Math.random() - 0.5) * (FIELD_D - 4);
    if (Math.abs(x) < PLASMA_HALF + 1.5) continue;
    const ld = Math.min(Math.abs(z - LANE_TOP_Z), Math.abs(z - LANE_MID_Z), Math.abs(z - LANE_BOT_Z));
    if (ld < 1.8) continue;
    const isPylon = Math.random() < 0.3;
    if (isPylon) {
      const pylon = new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.22, 1.4, 6), lambertMat(0x202830));
      pylon.position.set(x, 0.7, z); pylon.castShadow = true; scene.add(pylon);
      // Glowing tip
      const tip = new THREE.Mesh(new THREE.SphereGeometry(0.12, 8, 6), basicMat(map.accent));
      tip.position.set(x, 1.45, z); scene.add(tip);
    } else {
      const crate = new THREE.Mesh(new THREE.BoxGeometry(0.7, 0.6, 0.7), lambertMat(0x303840));
      crate.position.set(x, 0.3, z); crate.castShadow = true; crate.rotation.y = Math.random() * Math.PI * 2; scene.add(crate);
      // Edge stripe
      const stripe = new THREE.Mesh(new THREE.PlaneGeometry(0.74, 0.06), basicMat(map.accent, { transparent:true, opacity:0.85 }));
      stripe.position.set(x, 0.55, z + 0.36); scene.add(stripe);
    }
  }
}

function buildPlasma(map){
  // Animated plasma stream where the river used to be
  plasmaUniforms = {
    time:{ value:0 },
    colA:{ value: new THREE.Color(map.plasma) },
    colB:{ value: new THREE.Color(map.accent) },
  };
  const mat = new THREE.ShaderMaterial({
    uniforms: plasmaUniforms, transparent: true,
    vertexShader: `varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
    fragmentShader: `
      varying vec2 vUv;
      uniform vec3 colA, colB;
      uniform float time;
      void main(){
        // Vertical bands of energy moving along the stream
        float band = sin(vUv.y * 30.0 - time * 4.0) * 0.5 + 0.5;
        band *= sin(vUv.y * 8.0 + time * 1.5) * 0.5 + 0.5;
        vec3 col = mix(colA, colB, band);
        // Edge glow
        float edge = pow(1.0 - abs(vUv.x * 2.0 - 1.0), 1.5);
        col *= 0.5 + edge * 1.5;
        gl_FragColor = vec4(col, 0.95);
      }`
  });
  const geo = new THREE.PlaneGeometry(PLASMA_HALF * 2, FIELD_D + 30, 1, 1);
  plasmaMesh = new THREE.Mesh(geo, mat);
  plasmaMesh.rotation.x = -Math.PI / 2;
  plasmaMesh.position.y = 0.08;
  scene.add(plasmaMesh);
}


// =========================================================================
// CAMERA — free orbit + WASD pan + presets
// =========================================================================
const CAM_PRESETS = [
  { name:'OVERHEAD',  distance:36, pitch:1.25, yaw:0,         height:0 },
  { name:'TACTICAL',  distance:28, pitch:0.95, yaw:0,         height:2 },
  { name:'CINEMATIC', distance:22, pitch:0.55, yaw:Math.PI/8, height:4 },
  { name:'GROUND',    distance:14, pitch:0.20, yaw:0,         height:1.2 },
];
function applyCamera(){
  if (!camera) return;
  const c = STATE.cam;
  const r = c.distance;
  const sP = Math.sin(c.pitch), cP = Math.cos(c.pitch);
  const sY = Math.sin(c.yaw),  cY = Math.cos(c.yaw);
  const ex = c.targetX + r * cP * sY;
  const ey = (c.targetY||0) + r * sP + (c._heightOffset||0);
  const ez = c.targetZ + r * cP * cY;
  camera.position.set(ex, Math.max(0.3, ey), ez);
  camera.fov = c.fov;
  camera.lookAt(c.targetX, (c._heightOffset||0) * 0.18, c.targetZ);
  if (c.roll) camera.rotateZ(c.roll);
  camera.updateProjectionMatrix();
}
function clampCamera(){
  const c = STATE.cam;
  c.targetX = Math.max(-22, Math.min(22, c.targetX));
  c.targetZ = Math.max(-16, Math.min(16, c.targetZ));
  c.distance = Math.max(8, Math.min(80, c.distance));
  c.pitch = Math.max(0.05, Math.min(1.55, c.pitch));
  while (c.yaw > Math.PI) c.yaw -= Math.PI * 2;
  while (c.yaw < -Math.PI) c.yaw += Math.PI * 2;
  c.roll = Math.max(-0.8, Math.min(0.8, c.roll||0));
  c._heightOffset = Math.max(-3, Math.min(28, c._heightOffset||0));
}
function resizeThree(){
  const cont = document.getElementById('threeContainer');
  if (!cont || !renderer || !camera) return;
  const w = cont.clientWidth, h = cont.clientHeight;
  if (!w || !h) return;
  renderer.setSize(w, h, false);
  camera.aspect = w / h;
  applyCamera();
  STATE._lastSize = { w, h };
}
function ensureCanvasSize(){
  const cont = document.getElementById('threeContainer'); if (!cont || !renderer) return;
  const w = cont.clientWidth, h = cont.clientHeight; if (!w || !h) return;
  if (!STATE._lastSize || STATE._lastSize.w !== w || STATE._lastSize.h !== h) resizeThree();
}
function applyPreset(idx){
  const p = CAM_PRESETS[idx % CAM_PRESETS.length];
  STATE.cam.preset = idx % CAM_PRESETS.length;
  STATE.cam.distance = p.distance; STATE.cam.pitch = p.pitch; STATE.cam.yaw = p.yaw;
  STATE.cam._heightOffset = p.height; STATE.cam.roll = 0;
  STATE.cam.targetX = 0; STATE.cam.targetZ = 2;
  clampCamera(); applyCamera();
  const lbl = document.getElementById('camLabel'); if (lbl) lbl.textContent = p.name;
}
function cycleCamPreset(){ applyPreset((STATE.cam.preset + 1) % CAM_PRESETS.length); showToast('CAM: ' + CAM_PRESETS[STATE.cam.preset].name); playSound('ui_click'); }
function resetCamera(){ applyPreset(0); playSound('ui_click'); }
function toggleOrbitMode(){
  STATE.cam.orbiting = !STATE.cam.orbiting;
  const b = document.getElementById('camOrbit'); if (b) b.classList.toggle('on', STATE.cam.orbiting);
  showToast(STATE.cam.orbiting ? 'ORBIT MODE — DRAG TO ROTATE' : 'PAN MODE');
  playSound('ui_select');
}
function adjustCamHeight(d){ STATE.cam._heightOffset = (STATE.cam._heightOffset||0) + d; clampCamera(); applyCamera(); playSound('ui_click'); }
function adjustCamZoom(f){ STATE.cam.distance *= f; clampCamera(); applyCamera(); playSound('ui_click'); }
window.addEventListener('resize', () => { if (renderer) resizeThree(); });

// =========================================================================
// INPUT
// =========================================================================
const CLICK_THRESH = 8;
const pointers = new Map();
let pinchStart = { dist:0, zoom:1, ang:0, roll:0 };
let panStart = null, dragMoved = false;
const keys = {};
function screenToWorld(x, y){
  const c = document.getElementById('threeContainer');
  const r = c.getBoundingClientRect();
  pointer.x = ((x - r.left) / r.width) * 2 - 1;
  pointer.y = -((y - r.top) / r.height) * 2 + 1;
  raycaster.setFromCamera(pointer, camera);
  const plane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
  const hit = new THREE.Vector3();
  raycaster.ray.intersectPlane(plane, hit);
  return hit;
}
function onPointerDown(e){
  if (!STATE.running || STATE.paused) return;
  e.preventDefault();
  pointers.set(e.pointerId, { x:e.clientX, y:e.clientY });
  dragMoved = false;
  try { e.target.setPointerCapture && e.target.setPointerCapture(e.pointerId); } catch(_){}
  if (pointers.size === 2) {
    const arr = Array.from(pointers.values());
    pinchStart.dist = Math.hypot(arr[0].x - arr[1].x, arr[0].y - arr[1].y);
    pinchStart.zoom = STATE.cam.distance;
    pinchStart.ang = Math.atan2(arr[1].y - arr[0].y, arr[1].x - arr[0].x);
    pinchStart.roll = STATE.cam.roll||0;
    STATE.cam.pinching = true; STATE.cam.panning = false;
  } else if (pointers.size === 1) {
    panStart = { x:e.clientX, y:e.clientY, ...STATE.cam };
  }
  document.getElementById('threeContainer').classList.add('grabbing');
}
function onPointerMove(e){
  if (!pointers.has(e.pointerId)) {
    if (STATE.running && !STATE.paused && STATE.selectedCard) {
      const hit = screenToWorld(e.clientX, e.clientY);
      if (hit) lastPointerWorld = { x:hit.x, z:hit.z };
    }
    return;
  }
  e.preventDefault();
  pointers.set(e.pointerId, { x:e.clientX, y:e.clientY });
  if (STATE.running && !STATE.paused && STATE.selectedCard && pointers.size === 1) {
    const hit = screenToWorld(e.clientX, e.clientY);
    if (hit) lastPointerWorld = { x:hit.x, z:hit.z };
  }
  if (pointers.size === 2 && STATE.cam.pinching) {
    const arr = Array.from(pointers.values());
    const d = Math.hypot(arr[0].x - arr[1].x, arr[0].y - arr[1].y);
    if (pinchStart.dist > 0) {
      STATE.cam.distance = pinchStart.zoom * (pinchStart.dist / d);
      const ang = Math.atan2(arr[1].y - arr[0].y, arr[1].x - arr[0].x);
      let dA = ang - pinchStart.ang;
      while (dA > Math.PI) dA -= Math.PI * 2;
      while (dA < -Math.PI) dA += Math.PI * 2;
      STATE.cam.roll = pinchStart.roll + dA;
      clampCamera(); applyCamera();
    }
  } else if (pointers.size === 1 && panStart && !STATE.cam.pinching) {
    const dx = e.clientX - panStart.x;
    const dy = e.clientY - panStart.y;
    if (Math.hypot(dx, dy) > CLICK_THRESH) {
      dragMoved = true; STATE.cam.panning = true;
      if (STATE.cam.orbiting) {
        STATE.cam.yaw = panStart.yaw - dx * 0.012;
        STATE.cam.pitch = panStart.pitch - dy * 0.010;
      } else {
        const cont = document.getElementById('threeContainer');
        const wpp = (STATE.cam.distance / 36) * 0.04 * (cont.clientWidth / 600);
        const dxW = -dx * wpp, dzW = -dy * wpp;
        const cy = Math.cos(STATE.cam.yaw), sy = Math.sin(STATE.cam.yaw);
        STATE.cam.targetX = panStart.targetX + dxW * cy - dzW * sy;
        STATE.cam.targetZ = panStart.targetZ + dxW * sy + dzW * cy;
      }
      clampCamera(); applyCamera();
    }
  }
}
function onPointerUp(e){
  if (!pointers.has(e.pointerId)) return;
  e.preventDefault();
  const wasPan = STATE.cam.panning, wasPinch = STATE.cam.pinching;
  pointers.delete(e.pointerId);
  if (pointers.size < 2) STATE.cam.pinching = false;
  if (pointers.size === 0) {
    STATE.cam.panning = false;
    document.getElementById('threeContainer').classList.remove('grabbing');
    if (!dragMoved && !wasPan && !wasPinch) {
      if (STATE.selectedCard) {
        const hit = screenToWorld(e.clientX, e.clientY);
        if (hit) attemptDeploy(STATE.selectedCard, hit.x, hit.z);
      } else {
        const u = pickUnitAtScreen(e.clientX, e.clientY);
        if (u) selectUnit(u);
        else if (SELECTED_UNIT) selectUnit(null);
      }
    }
    panStart = null;
  }
}
function onPointerCancel(e){
  pointers.delete(e.pointerId);
  if (pointers.size < 2) STATE.cam.pinching = false;
  if (pointers.size === 0) { STATE.cam.panning = false; panStart = null; }
  document.getElementById('threeContainer').classList.remove('grabbing');
}
function onWheel(e){
  if (!STATE.running || STATE.paused) return;
  e.preventDefault();
  STATE.cam.distance *= e.deltaY > 0 ? 1.1 : 0.91;
  clampCamera(); applyCamera();
}
function setupInput(){
  const c = document.getElementById('threeContainer');
  c.addEventListener('pointerdown', onPointerDown);
  c.addEventListener('pointermove', onPointerMove);
  c.addEventListener('pointerup', onPointerUp);
  c.addEventListener('pointercancel', onPointerCancel);
  c.addEventListener('pointerleave', onPointerCancel);
  c.addEventListener('wheel', onWheel, { passive:false });
  c.addEventListener('contextmenu', e => e.preventDefault());
  if (typeof ResizeObserver !== 'undefined') {
    try { new ResizeObserver(() => resizeThree()).observe(c); } catch(e){}
  }
  window.addEventListener('keydown', e => {
    keys[e.key.toLowerCase()] = true;
    if (e.key === 'o' || e.key === 'O') toggleOrbitMode();
    else if (e.key === 'r' || e.key === 'R') resetCamera();
    else if (e.key === 'c' || e.key === 'C') cycleCamPreset();
    else if (e.key === 'Escape' && STATE.running) STATE.paused ? resumeGame() : pauseGame();
  });
  window.addEventListener('keyup', e => { delete keys[e.key.toLowerCase()]; });
}
function updateCameraFromKeys(dt){
  if (!STATE.running || STATE.paused) return;
  const c = STATE.cam;
  const moveSpeed = 18 * (c.distance / 36) * dt;
  const rotSpeed = 1.6 * dt;
  const cy = Math.cos(c.yaw), sy = Math.sin(c.yaw);
  let changed = false;
  if (keys['w']) { c.targetX -= sy * moveSpeed; c.targetZ -= cy * moveSpeed; changed = true; }
  if (keys['s']) { c.targetX += sy * moveSpeed; c.targetZ += cy * moveSpeed; changed = true; }
  if (keys['a']) { c.targetX -= cy * moveSpeed; c.targetZ += sy * moveSpeed; changed = true; }
  if (keys['d']) { c.targetX += cy * moveSpeed; c.targetZ -= sy * moveSpeed; changed = true; }
  if (keys['q']) { c._heightOffset = (c._heightOffset||0) + 6 * dt; changed = true; }
  if (keys['e']) { c._heightOffset = (c._heightOffset||0) - 6 * dt; changed = true; }
  if (keys['arrowleft']) { c.yaw -= rotSpeed; changed = true; }
  if (keys['arrowright']) { c.yaw += rotSpeed; changed = true; }
  if (keys['arrowup']) { c.pitch += rotSpeed; changed = true; }
  if (keys['arrowdown']) { c.pitch -= rotSpeed; changed = true; }
  if (changed) { clampCamera(); applyCamera(); }
}


// =========================================================================
// UNIT MESHES — sci-fi cyberpunk silhouettes
// 6 distinct shapes: trooper / heavy / sniper / assault / mech / drone
// Each with faction color + neon glow accent
// =========================================================================
function teamColor(side){ return side === 'player' ? 0x00cfff : 0xff4488; }

// Build infantry-style rig (trooper / heavy / sniper / assault) with bones
function buildInfantryRig(def, side, kind){
  const root = new THREE.Group();
  const c = def.color, dark = def.dark, neon = def.neon;
  const teamCol = teamColor(side);

  // ── HIPS ──
  const hips = new THREE.Group();
  hips.position.y = 0.8;
  root.add(hips);

  // Belt — slim neon ring
  const beltCore = new THREE.Mesh(new THREE.CylinderGeometry(0.28, 0.26, 0.15, 12), lambertMat(dark));
  hips.add(beltCore);
  const beltGlow = new THREE.Mesh(new THREE.TorusGeometry(0.28, 0.025, 5, 16), basicMat(neon));
  beltGlow.rotation.x = Math.PI/2; beltGlow.position.y = 0; hips.add(beltGlow);

  // ── TORSO ──
  const torso = new THREE.Group();
  torso.position.y = 0.05;
  hips.add(torso);
  const chest = new THREE.Mesh(new THREE.SphereGeometry(0.32, 12, 9), lambertMat(c));
  chest.scale.set(0.85, 0.95, 0.55);
  chest.position.y = 0.22; chest.castShadow = true; torso.add(chest);
  // Chest neon strip (faction color, vertical)
  const chestStrip = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.30, 0.05), basicMat(neon));
  chestStrip.position.set(0, 0.22, 0.20); torso.add(chestStrip);
  // Team-color shoulder pad on left
  const teamPad = new THREE.Mesh(new THREE.SphereGeometry(0.12, 8, 6, 0, Math.PI*2, 0, Math.PI/2), basicMat(teamCol));
  teamPad.position.set(-0.30, 0.40, 0); torso.add(teamPad);

  // ── NECK + HEAD ──
  const neck = new THREE.Group();
  neck.position.y = 0.50;
  torso.add(neck);
  // Helmet — sleek visor design
  const helmBase = new THREE.Mesh(new THREE.SphereGeometry(0.20, 14, 10), lambertMat(dark));
  helmBase.scale.set(0.95, 1.0, 1.05);
  helmBase.position.y = 0.16; helmBase.castShadow = true; neck.add(helmBase);
  // Visor — glowing horizontal slit
  const visor = new THREE.Mesh(
    new THREE.BoxGeometry(0.30, 0.06, 0.04),
    basicMat(neon, { transparent:true, opacity:0.95 })
  );
  visor.position.set(0, 0.17, 0.18); neck.add(visor);
  // Team rim on top
  const helmRim = new THREE.Mesh(new THREE.TorusGeometry(0.16, 0.018, 5, 14), basicMat(teamCol));
  helmRim.rotation.x = Math.PI/2; helmRim.position.y = 0.30; neck.add(helmRim);

  // ── ARMS ──
  const leftArm = new THREE.Group(); leftArm.position.set(-0.30, 0.40, 0); torso.add(leftArm);
  const rightArm = new THREE.Group(); rightArm.position.set(0.30, 0.40, 0); torso.add(rightArm);
  for (const arm of [leftArm, rightArm]) {
    // Bicep — capsule
    const bicep = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.08, 0.32, 8), lambertMat(c));
    bicep.position.y = -0.18; bicep.castShadow = true; arm.add(bicep);
    const elbow = new THREE.Mesh(new THREE.SphereGeometry(0.085, 8, 6), lambertMat(dark));
    elbow.position.y = -0.34; arm.add(elbow);
    // Hand
    const hand = new THREE.Mesh(new THREE.SphereGeometry(0.08, 8, 6), lambertMat(dark));
    hand.position.y = -0.42; arm.add(hand);
  }

  // ── LEGS ──
  const leftLeg = new THREE.Group(); leftLeg.position.set(-0.12, -0.05, 0); hips.add(leftLeg);
  const rightLeg = new THREE.Group(); rightLeg.position.set(0.12, -0.05, 0); hips.add(rightLeg);
  for (const leg of [leftLeg, rightLeg]) {
    const thigh = new THREE.Mesh(new THREE.CylinderGeometry(0.10, 0.10, 0.38, 8), lambertMat(dark));
    thigh.position.y = -0.23; thigh.castShadow = true; leg.add(thigh);
    const knee = new THREE.Mesh(new THREE.SphereGeometry(0.105, 8, 6), lambertMat(c));
    knee.position.y = -0.42; leg.add(knee);
    const boot = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.14, 0.22), lambertMat(dark));
    boot.position.set(0, -0.52, 0.04); boot.castShadow = true; leg.add(boot);
    // Boot neon stripe
    const bootGlow = new THREE.Mesh(new THREE.PlaneGeometry(0.14, 0.04), basicMat(neon));
    bootGlow.position.set(0, -0.52, 0.155); leg.add(bootGlow);
  }

  // ── WEAPON ──
  const weapon = new THREE.Group();
  weapon.position.set(0.04, -0.42, 0.08);
  rightArm.add(weapon);
  buildWeapon(weapon, def, kind);

  // Kind-specific tweaks
  if (kind === 'heavy') {
    root.scale.set(1.18, 1.10, 1.18);
    // Big chestplate
    const armor = new THREE.Mesh(new THREE.BoxGeometry(0.55, 0.32, 0.18), lambertMat(c));
    armor.position.set(0, 0.22, 0.15); torso.add(armor);
    const armorGlow = new THREE.Mesh(new THREE.PlaneGeometry(0.40, 0.04), basicMat(neon));
    armorGlow.position.set(0, 0.30, 0.25); torso.add(armorGlow);
  } else if (kind === 'sniper') {
    root.scale.set(0.95, 1.10, 0.95);
    // Sniper has elongated visor
    visor.scale.x = 1.4;
  } else if (kind === 'assault') {
    root.scale.set(0.95, 0.98, 0.95);
    // Energy blade glow on back
    const blade = new THREE.Mesh(new THREE.PlaneGeometry(0.05, 0.5), basicMat(neon));
    blade.position.set(0, 0.30, -0.18); blade.rotation.x = -0.2; torso.add(blade);
  }

  root.userData.bones = { hips, torso, neck, leftArm, rightArm, leftLeg, rightLeg, weapon };
  return root;
}

function buildWeapon(parent, def, kind){
  const dark = 0x101218;
  if (kind === 'sniper') {
    // Long rail rifle
    const stock = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.07, 0.20), lambertMat(dark));
    stock.position.z = -0.07; parent.add(stock);
    const barrel = new THREE.Mesh(new THREE.CylinderGeometry(0.022, 0.025, 0.85, 6), metalMat(dark));
    barrel.rotation.x = Math.PI/2; barrel.position.z = 0.40; parent.add(barrel);
    // Energy coil along barrel
    const coil = new THREE.Mesh(new THREE.TorusGeometry(0.04, 0.012, 4, 12), basicMat(def.neon));
    coil.position.z = 0.40; coil.rotation.x = Math.PI/2; parent.add(coil);
    const muzzle = new THREE.Object3D(); muzzle.position.z = 0.85; parent.add(muzzle);
    parent.userData.muzzle = muzzle;
  } else if (kind === 'heavy') {
    // HMG with rotating barrels
    const housing = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.16, 0.30), lambertMat(dark));
    housing.position.z = 0.10; parent.add(housing);
    const barrels = new THREE.Mesh(new THREE.CylinderGeometry(0.10, 0.10, 0.45, 10), metalMat(0x282828));
    barrels.rotation.x = Math.PI/2; barrels.position.z = 0.42; parent.add(barrels);
    // Glowing core
    const core = new THREE.Mesh(new THREE.SphereGeometry(0.04, 6, 5), basicMat(def.neon));
    core.position.z = 0.05; parent.add(core);
    const muzzle = new THREE.Object3D(); muzzle.position.z = 0.70; parent.add(muzzle);
    parent.userData.muzzle = muzzle;
  } else if (kind === 'assault') {
    // Dual SMGs / energy pistols
    for (const xs of [-0.05, 0.05]) {
      const smg = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.10, 0.22), lambertMat(dark));
      smg.position.set(xs, 0, 0.10); parent.add(smg);
      const tip = new THREE.Mesh(new THREE.SphereGeometry(0.025, 5, 4), basicMat(def.neon));
      tip.position.set(xs, 0, 0.22); parent.add(tip);
    }
    const muzzle = new THREE.Object3D(); muzzle.position.z = 0.30; parent.add(muzzle);
    parent.userData.muzzle = muzzle;
  } else {
    // trooper rifle — standard
    const stock = new THREE.Mesh(new THREE.BoxGeometry(0.07, 0.08, 0.18), lambertMat(dark));
    stock.position.z = -0.06; parent.add(stock);
    const body = new THREE.Mesh(new THREE.BoxGeometry(0.07, 0.10, 0.16), lambertMat(dark));
    body.position.z = 0.08; parent.add(body);
    const barrel = new THREE.Mesh(new THREE.CylinderGeometry(0.025, 0.025, 0.32, 6), metalMat(dark));
    barrel.rotation.x = Math.PI/2; barrel.position.z = 0.30; parent.add(barrel);
    // Energy emitter
    const emit = new THREE.Mesh(new THREE.SphereGeometry(0.035, 6, 5), basicMat(def.neon));
    emit.position.z = 0.46; parent.add(emit);
    const muzzle = new THREE.Object3D(); muzzle.position.z = 0.50; parent.add(muzzle);
    parent.userData.muzzle = muzzle;
  }
}

// MECH — big walker with cannon
function buildMechMesh(def, side){
  const root = new THREE.Group();
  const c = def.color, dark = def.dark, neon = def.neon;
  const teamCol = teamColor(side);
  // Two big legs
  for (const xs of [-0.45, 0.45]) {
    const leg = new THREE.Group();
    leg.position.set(xs, 0, 0); root.add(leg);
    const upper = new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.16, 0.55, 8), lambertMat(dark));
    upper.position.y = 0.95; upper.rotation.z = xs > 0 ? -0.1 : 0.1; upper.castShadow = true; leg.add(upper);
    const knee = new THREE.Mesh(new THREE.SphereGeometry(0.20, 10, 8), lambertMat(c));
    knee.position.set(xs > 0 ? -0.04 : 0.04, 0.65, 0); leg.add(knee);
    const lower = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.18, 0.45, 8), lambertMat(dark));
    lower.position.set(xs > 0 ? -0.06 : 0.06, 0.35, 0.05); leg.add(lower);
    const foot = new THREE.Mesh(new THREE.BoxGeometry(0.32, 0.10, 0.45), lambertMat(c));
    foot.position.set(0, 0.05, 0.06); foot.castShadow = true; leg.add(foot);
    const footGlow = new THREE.Mesh(new THREE.PlaneGeometry(0.26, 0.04), basicMat(neon));
    footGlow.position.set(0, 0.05, 0.30); leg.add(footGlow);
  }
  // Body — chunky chest
  const body = new THREE.Mesh(new THREE.BoxGeometry(1.20, 0.85, 0.95), lambertMat(c));
  body.position.y = 1.65; body.castShadow = true; root.add(body);
  // Body neon trim (chest)
  const bodyGlow = new THREE.Mesh(new THREE.PlaneGeometry(0.85, 0.06), basicMat(neon));
  bodyGlow.position.set(0, 1.85, 0.48); root.add(bodyGlow);
  // Team color stripe
  const teamStripe = new THREE.Mesh(new THREE.BoxGeometry(1.22, 0.10, 0.04), basicMat(teamCol));
  teamStripe.position.set(0, 1.40, 0.48); root.add(teamStripe);
  // Cockpit dome
  const cockpit = new THREE.Mesh(new THREE.SphereGeometry(0.28, 14, 10), basicMat(neon, { transparent:true, opacity:0.85 }));
  cockpit.scale.y = 0.7; cockpit.position.y = 2.20; root.add(cockpit);
  // Antenna
  const ant = new THREE.Mesh(new THREE.CylinderGeometry(0.025, 0.025, 0.45, 6), lambertMat(dark));
  ant.position.set(-0.45, 2.25, -0.40); root.add(ant);
  const antTip = new THREE.Mesh(new THREE.SphereGeometry(0.055, 6, 5), basicMat(neon));
  antTip.position.set(-0.45, 2.50, -0.40); root.add(antTip);
  // Big shoulder cannons
  const turret = new THREE.Group();
  turret.position.set(0, 1.55, 0.4); root.add(turret);
  for (const xs of [-0.55, 0.55]) {
    const mount = new THREE.Mesh(new THREE.SphereGeometry(0.17, 10, 8), lambertMat(dark));
    mount.position.set(xs, 0, 0); turret.add(mount);
    const cannon = new THREE.Mesh(new THREE.CylinderGeometry(0.10, 0.12, 0.85, 10), metalMat(0x202020));
    cannon.rotation.x = Math.PI/2; cannon.position.set(xs, 0, 0.55); turret.add(cannon);
    const cannonTip = new THREE.Mesh(new THREE.CylinderGeometry(0.13, 0.13, 0.10, 10), lambertMat(dark));
    cannonTip.rotation.x = Math.PI/2; cannonTip.position.set(xs, 0, 1.0); turret.add(cannonTip);
    const tipGlow = new THREE.Mesh(new THREE.SphereGeometry(0.04, 6, 5), basicMat(neon));
    tipGlow.position.set(xs, 0, 1.05); turret.add(tipGlow);
  }
  const muzzle = new THREE.Object3D(); muzzle.position.set(0, 1.55, 1.45); root.add(muzzle);
  root.userData.bones = { turret, muzzle };
  return root;
}

// DRONE — flying disc with rotating arms
function buildDroneMesh(def, side){
  const root = new THREE.Group();
  const c = def.color, dark = def.dark, neon = def.neon;
  const teamCol = teamColor(side);
  // Central core
  const core = new THREE.Mesh(new THREE.SphereGeometry(0.30, 16, 12), lambertMat(c));
  core.scale.y = 0.65; core.castShadow = true; root.add(core);
  // Glowing eye on bottom
  const eye = new THREE.Mesh(new THREE.SphereGeometry(0.10, 10, 8), basicMat(neon));
  eye.position.y = -0.08; root.add(eye);
  // Top dome
  const dome = new THREE.Mesh(new THREE.SphereGeometry(0.20, 12, 8, 0, Math.PI*2, 0, Math.PI/2), basicMat(neon, { transparent:true, opacity:0.6 }));
  dome.position.y = 0.10; root.add(dome);
  // Team ring
  const ring = new THREE.Mesh(new THREE.TorusGeometry(0.32, 0.025, 5, 18), basicMat(teamCol));
  ring.rotation.x = Math.PI/2; ring.position.y = 0; root.add(ring);
  // Rotating arms (4)
  const armGroup = new THREE.Group();
  root.add(armGroup);
  for (let i = 0; i < 4; i++) {
    const ang = (i / 4) * Math.PI * 2;
    const arm = new THREE.Mesh(new THREE.BoxGeometry(0.55, 0.04, 0.10), lambertMat(dark));
    arm.position.set(Math.cos(ang) * 0.3, 0.05, Math.sin(ang) * 0.3);
    arm.rotation.y = ang;
    armGroup.add(arm);
    // Engine pod at end
    const pod = new THREE.Mesh(new THREE.SphereGeometry(0.10, 8, 6), lambertMat(dark));
    pod.position.set(Math.cos(ang) * 0.55, 0.05, Math.sin(ang) * 0.55);
    armGroup.add(pod);
    const podGlow = new THREE.Mesh(new THREE.SphereGeometry(0.06, 6, 5), basicMat(neon));
    podGlow.position.set(Math.cos(ang) * 0.55, -0.04, Math.sin(ang) * 0.55);
    armGroup.add(podGlow);
  }
  // Front gun
  const gun = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.06, 0.40, 8), metalMat(dark));
  gun.rotation.x = Math.PI/2; gun.position.set(0, -0.05, 0.32); root.add(gun);
  const muzzle = new THREE.Object3D(); muzzle.position.set(0, -0.05, 0.60); root.add(muzzle);
  root.position.y = 3.5;
  root.userData.bones = { armGroup, muzzle };
  return root;
}

// Dispatcher
function buildUnitMesh(def, side){
  let mesh;
  const role = def.roleKey;
  if (role === 'mech') mesh = buildMechMesh(def, side);
  else if (role === 'drone') mesh = buildDroneMesh(def, side);
  else mesh = buildInfantryRig(def, side, role);
  addOutline(mesh, 1.04);
  mesh.traverse(o => { if (o.isMesh) { o.castShadow = true; if (o.userData.isOutline) o.castShadow = false; } });
  // Big team color disc under unit (always visible from top-down)
  const teamCol = teamColor(side);
  const radius = role === 'mech' ? 1.5 : role === 'drone' ? 1.0 : 0.85;
  const disc = new THREE.Mesh(
    new THREE.RingGeometry(radius * 0.78, radius, 24),
    basicMat(teamCol, { transparent:true, opacity:0.85, side:THREE.DoubleSide, depthWrite:false })
  );
  disc.rotation.x = -Math.PI/2;
  disc.position.y = 0.05;
  disc.renderOrder = -2;
  mesh.add(disc);
  return mesh;
}


// =========================================================================
// HQ + TOWERS — sci-fi structures
// =========================================================================
function buildCore(side, fk){
  const f = FACTIONS[fk] || FACTIONS.nexus;
  const root = new THREE.Group();
  const teamCol = teamColor(side);
  const c = f.color, dark = f.dark, neon = f.neon;
  // Base platform
  const plat = new THREE.Mesh(new THREE.CylinderGeometry(4.5, 5.0, 0.6, 8), lambertMat(dark));
  plat.position.y = 0.3; plat.castShadow = true; plat.receiveShadow = true; root.add(plat);
  // Platform neon ring
  const platRing = new THREE.Mesh(new THREE.TorusGeometry(4.5, 0.08, 6, 24), basicMat(neon));
  platRing.rotation.x = Math.PI/2; platRing.position.y = 0.62; root.add(platRing);
  // Main tower base
  const base = new THREE.Mesh(new THREE.BoxGeometry(4.5, 2.5, 4.5), lambertMat(c));
  base.position.y = 1.85; base.castShadow = true; root.add(base);
  // Vertical neon strips on tower
  for (const xs of [-2.30, 2.30]) {
    for (const zs of [-2.30, 2.30]) {
      const strip = new THREE.Mesh(new THREE.BoxGeometry(0.05, 2.4, 0.05), basicMat(neon));
      strip.position.set(xs, 1.85, zs); root.add(strip);
    }
  }
  // Mid tier
  const mid = new THREE.Mesh(new THREE.CylinderGeometry(2.0, 2.4, 2.5, 8), lambertMat(c));
  mid.position.y = 4.4; mid.castShadow = true; root.add(mid);
  // Mid tier neon band
  const midBand = new THREE.Mesh(new THREE.TorusGeometry(2.4, 0.10, 6, 18), basicMat(neon));
  midBand.rotation.x = Math.PI/2; midBand.position.y = 3.2; root.add(midBand);
  // Top crystal
  const crystal = new THREE.Mesh(new THREE.OctahedronGeometry(1.4, 0), basicMat(neon, { transparent:true, opacity:0.85 }));
  crystal.position.y = 7.0; root.add(crystal);
  // Crystal halo
  const halo = new THREE.Mesh(new THREE.SphereGeometry(2.0, 16, 12), basicMat(neon, { transparent:true, opacity:0.18, depthWrite:false }));
  halo.position.y = 7.0; root.add(halo);
  // Team color ring on top platform
  const topRing = new THREE.Mesh(new THREE.TorusGeometry(2.4, 0.18, 8, 24), basicMat(teamCol));
  topRing.rotation.x = Math.PI/2; topRing.position.y = 5.7; root.add(topRing);
  addOutline(root, 1.02);
  root.userData.crystal = crystal; root.userData.halo = halo;
  return root;
}

function buildTowerMesh(side, fk){
  const f = FACTIONS[fk] || FACTIONS.nexus;
  const root = new THREE.Group();
  const teamCol = teamColor(side);
  const c = f.color, dark = f.dark, neon = f.neon;
  // Hex base
  const base = new THREE.Mesh(new THREE.CylinderGeometry(1.4, 1.6, 1.0, 6), lambertMat(dark));
  base.position.y = 0.5; base.castShadow = true; root.add(base);
  const baseRing = new THREE.Mesh(new THREE.TorusGeometry(1.4, 0.05, 5, 18), basicMat(neon));
  baseRing.rotation.x = Math.PI/2; baseRing.position.y = 1.0; root.add(baseRing);
  // Mid column
  const mid = new THREE.Mesh(new THREE.CylinderGeometry(1.1, 1.2, 1.4, 6), lambertMat(c));
  mid.position.y = 1.7; mid.castShadow = true; root.add(mid);
  // Team band
  const teamBand = new THREE.Mesh(new THREE.TorusGeometry(1.15, 0.08, 5, 18), basicMat(teamCol));
  teamBand.rotation.x = Math.PI/2; teamBand.position.y = 2.3; root.add(teamBand);
  // Turret head
  const turret = new THREE.Group();
  turret.position.y = 2.7; root.add(turret);
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.55, 12, 8, 0, Math.PI*2, 0, Math.PI/2), lambertMat(c));
  turret.add(head);
  // Twin barrels
  for (const xs of [-0.18, 0.18]) {
    const bar = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.08, 1.1, 8), metalMat(0x202020));
    bar.rotation.x = Math.PI/2; bar.position.set(xs, 0, 0.55); turret.add(bar);
    const tip = new THREE.Mesh(new THREE.SphereGeometry(0.05, 6, 5), basicMat(neon));
    tip.position.set(xs, 0, 1.10); turret.add(tip);
  }
  const muzzle = new THREE.Object3D(); muzzle.position.set(0, 2.7, 1.20); root.add(muzzle);
  addOutline(root, 1.025);
  root.userData.bones = { turret, muzzle };
  return root;
}

// HP Pip
function makePip(){
  const c = document.createElement('canvas'); c.width = 64; c.height = 8;
  const ctx = c.getContext('2d');
  const tex = new THREE.CanvasTexture(c); tex.magFilter = THREE.NearestFilter;
  const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map:tex, transparent:true, depthTest:false }));
  sp.scale.set(1.3, 0.16, 1);
  sp.userData = { canvas:c, ctx, tex };
  return sp;
}
function updatePip(sp, hp, max, side){
  const { canvas, ctx, tex } = sp.userData;
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  ctx.fillStyle = 'rgba(0,0,0,0.85)'; ctx.fillRect(0, 0, canvas.width, canvas.height);
  const r = Math.max(0, hp/max);
  let col = r > 0.6 ? (side==='player'?'#0cf':'#f48') : r > 0.3 ? '#fc6' : '#f33';
  ctx.fillStyle = col;
  ctx.fillRect(1, 1, (canvas.width-2)*r, canvas.height-2);
  tex.needsUpdate = true;
}

// =========================================================================
// ANIMATION — bones-driven
// =========================================================================
function animateUnit(u, mesh, dt){
  if (!mesh || !mesh.userData.bones) return;
  const b = mesh.userData.bones;
  const time = performance.now() * 0.001;
  if (u.deathStarted) return;

  // Weapon recoil decay
  if (u.recoil > 0) {
    u.recoil = Math.max(0, u.recoil - dt * 4);
    if (b.weapon) b.weapon.position.z = 0.08 - u.recoil * 0.25;
  }

  // Air drone — spinning arms + bob
  if (u.def.type === 'air') {
    if (b.armGroup) b.armGroup.rotation.y += dt * 8;
    return;
  }

  // Vehicle/mech: turret tracks target
  if (b.turret && u.target) {
    const tx = (u.target.x || 0) - u.x, tz = (u.target.z || 0) - u.z;
    const aimA = Math.atan2(tx, tz) - u.facing;
    let diff = aimA - b.turret.rotation.y;
    while (diff > Math.PI) diff -= Math.PI * 2;
    while (diff < -Math.PI) diff += Math.PI * 2;
    b.turret.rotation.y += diff * Math.min(1, dt * 4);
  }

  // Infantry only past this point
  if (!b.hips || !b.leftLeg) return;

  // Smooth facing rotation
  if (mesh.userData._visFacing == null) mesh.userData._visFacing = u.facing;
  let dF = u.facing - mesh.userData._visFacing;
  while (dF > Math.PI) dF -= Math.PI * 2;
  while (dF < -Math.PI) dF += Math.PI * 2;
  mesh.userData._visFacing += dF * Math.min(1, dt * 9);
  mesh.rotation.y = mesh.userData._visFacing;

  if (u.moving) {
    const speed = u.def.speed * 2.5;
    u.walkPhase = (u.walkPhase || 0) + dt * speed;
    const ph = u.walkPhase;
    b.leftLeg.rotation.x = Math.sin(ph) * 0.45;
    b.rightLeg.rotation.x = -Math.sin(ph) * 0.45;
    b.leftArm.rotation.x = -Math.sin(ph) * 0.28;
    b.rightArm.rotation.x = Math.sin(ph) * 0.28;
    b.hips.position.y = 0.8 + Math.abs(Math.sin(ph * 2)) * 0.06;
    b.torso.rotation.y = Math.sin(ph) * 0.06;
  } else {
    // Idle breathing
    const ph = time * 1.5;
    b.hips.position.y = 0.8 + Math.sin(ph) * 0.025;
    b.torso.rotation.y *= 0.92;
    b.leftLeg.rotation.x *= 0.85;
    b.rightLeg.rotation.x *= 0.85;
    b.leftArm.rotation.x *= 0.85;
    b.rightArm.rotation.x *= 0.85;
  }

  // Aim — torso + right arm raise toward target
  if (u.target && u.def.type === 'ground') {
    const tx = (u.target.x || 0) - u.x, tz = (u.target.z || 0) - u.z;
    const dy = (u.target.def && u.target.def.type === 'air') ? 2.5 : 0.3;
    const aimY = Math.atan2(tx, tz);
    let diffYaw = aimY - mesh.userData._visFacing;
    while (diffYaw > Math.PI) diffYaw -= Math.PI * 2;
    while (diffYaw < -Math.PI) diffYaw += Math.PI * 2;
    b.torso.rotation.y += diffYaw * 0.3;
    const horizDist = Math.hypot(tx, tz);
    const aimPitch = Math.atan2(dy - 0.6, horizDist);
    b.rightArm.rotation.x = -Math.PI/2 + aimPitch * 0.6;
    b.leftArm.rotation.x = -Math.PI/3 + aimPitch * 0.4;
  }
}

// =========================================================================
// GAME LOGIC
// =========================================================================
function getLaneForZ(z){
  let best = { z:LANE_TOP_Z }, bd = Math.abs(z - LANE_TOP_Z);
  const d1 = Math.abs(z - LANE_MID_Z); if (d1 < bd) { best = { z:LANE_MID_Z }; bd = d1; }
  const d2 = Math.abs(z - LANE_BOT_Z); if (d2 < bd) { best = { z:LANE_BOT_Z }; bd = d2; }
  return best;
}
function spawnUnit(unitKey, side, fx, fz){
  const def = UNITS[unitKey]; if (!def) return;
  if (def.type === 'ground' && def.speed > 0) {
    const lane = getLaneForZ(fz);
    fz = lane.z + (fz - lane.z) * 0.3;
    fz = Math.max(lane.z - LANE_HALF * 0.85, Math.min(lane.z + LANE_HALF * 0.85, fz));
  }
  const diff = DIFFICULTY[STATE.difficulty || 'normal'] || DIFFICULTY.normal;
  const fm = (FACTIONS[def.faction]||FACTIONS.nexus).mod;
  const hpMul = ((side === 'enemy' && STATE.currentMission) ? STATE.currentMission.enemyHpMul * diff.enemyHpMul : 1) * fm.hp;
  const u = {
    id: nextId++, key:unitKey, def, side, x:fx, z:fz,
    visualX:fx, visualZ:fz,
    facing: side === 'player' ? Math.PI/2 : -Math.PI/2,
    hp:def.hp * hpMul, maxHp:def.hp * hpMul,
    homeLaneZ: fz,
    effSpeed: def.speed * fm.speed,
    effRange: def.range * fm.range,
    effDmgMul: fm.dmg,
    cooldown:0, target:null, spawnAnim:1.0,
    walkPhase:Math.random() * Math.PI * 2,
    flash:0, stunned:0, recoil:0, moving:false,
    burstRemaining:0, burstTimer:0, buffed:0, warCry:0, frenzy:0, shielded:0, abCD:0,
  };
  STATE.units.push(u);
  if (side === 'player') STATE.stats.deployed++;
  const mesh = buildUnitMesh(def, side);
  const pip = makePip();
  pip.position.y = def.type === 'air' ? 1.4 : (def.roleKey === 'mech' ? 3.0 : 2.0);
  mesh.add(pip);
  mesh.position.set(u.x, def.type === 'air' ? 3.5 : 0, u.z);
  mesh.rotation.y = u.facing;
  mesh.userData.unit = u; mesh.userData.pip = pip;
  scene.add(mesh);
  unitObjects.set(u.id, mesh);
  // Spawn FX — neon ring burst
  addFX({ type:'spawnRing', x:fx, y:0.1, z:fz, t:0, dur:0.8, color: def.neon });
  playSound('deploy');
}

function createTowers(){
  STATE.towers = [];
  towerObjects.forEach(m => removeAndDispose(m)); towerObjects.clear();
  const diff = DIFFICULTY[STATE.difficulty || 'normal'] || DIFFICULTY.normal;
  const ehp = (STATE.currentMission ? STATE.currentMission.enemyHpMul : 1) * diff.enemyHpMul;
  const pf = STATE.progress.playerFaction;
  const ef = STATE.currentMission ? STATE.currentMission.enemyFaction : 'nexus';
  const T = TOWER_TYPES.pulse;
  function mk(side, fk, x, z, label, hpMul) {
    return { side, faction:fk, role:'turret', x, z, hp:T.hp * hpMul, maxHp:T.hp * hpMul,
      dmg:T.dmg, range:T.range, atkSpeed:T.atkSpeed, radius:1.4, targets:T.targets,
      windup:T.windup||0.4, windupTimer:0, lastTargetId:null,
      label, flash:0, stunned:0, cooldown:0 };
  }
  // CORES (HQ) — target only, no fire
  const list = [
    { side:'player', faction:pf, role:'core', x:-FIELD_W/2 + 5, z:0, hp:6500, maxHp:6500, dmg:0, range:0, atkSpeed:99, radius:3.5, targets:'none', flash:0, stunned:0, cooldown:0 },
    { side:'enemy',  faction:ef, role:'core', x: FIELD_W/2 - 5, z:0, hp:6500*ehp, maxHp:6500*ehp, dmg:0, range:0, atkSpeed:99, radius:3.5, targets:'none', flash:0, stunned:0, cooldown:0 },
  ];
  for (const lz of [LANE_TOP_Z, LANE_MID_Z, LANE_BOT_Z]) {
    list.push(mk('player', pf, -FIELD_W/2 + 14, lz, lz === LANE_TOP_Z ? 'T' : lz === LANE_MID_Z ? 'M' : 'B', 1));
    list.push(mk('enemy',  ef,  FIELD_W/2 - 14, lz, lz === LANE_TOP_Z ? 'T' : lz === LANE_MID_Z ? 'M' : 'B', ehp));
  }
  for (const t of list) {
    t.id = nextId++;
    STATE.towers.push(t);
    const mesh = t.role === 'core' ? buildCore(t.side, t.faction) : buildTowerMesh(t.side, t.faction);
    mesh.position.set(t.x, 0, t.z);
    mesh.rotation.y = t.side === 'enemy' ? -Math.PI/2 : Math.PI/2;
    const pip = makePip();
    pip.position.y = t.role === 'core' ? 9.5 : 4.5;
    pip.scale.set(t.role === 'core' ? 3.2 : 2.0, 0.24, 1);
    mesh.add(pip);
    mesh.userData = { tower:t, pip, crystal:mesh.userData.crystal, halo:mesh.userData.halo, bones:mesh.userData.bones };
    scene.add(mesh);
    towerObjects.set(t.id, mesh);
  }
  updateTowerPips();
}
function updateTowerPips(){
  const left = document.getElementById('pipsLeft'); const right = document.getElementById('pipsRight');
  if (!left || !right) return;
  left.innerHTML = ''; right.innerHTML = '';
  for (const t of STATE.towers.filter(x => x.side === 'player' && x.role === 'turret')) {
    const d = document.createElement('div');
    d.className = 'tower-pip' + (t.hp <= 0 ? ' dead' : '');
    d.innerHTML = `▣ ${t.label}`;
    left.appendChild(d);
  }
  for (const t of STATE.towers.filter(x => x.side === 'enemy' && x.role === 'turret')) {
    const d = document.createElement('div');
    d.className = 'tower-pip' + (t.hp <= 0 ? ' dead' : '');
    d.innerHTML = `${t.label} ▣`;
    right.appendChild(d);
  }
}

function clearBattle(){
  STATE.units = []; STATE.projectiles = []; STATE.fx = []; STATE.towers = [];
  unitObjects.forEach(m => removeAndDispose(m)); unitObjects.clear();
  projObjects.forEach(m => removeAndDispose(m)); projObjects.clear();
  towerObjects.forEach(m => removeAndDispose(m)); towerObjects.clear();
  for (const f of fxObjects) if (f.mesh) removeAndDispose(f.mesh);
  fxObjects = [];
  STATE.bloodIntensity = 0;
  STATE.stats = { kills:0, allyDeaths:0, deployed:0, dmgDealt:0, dmgTaken:0 };
}


function dist(a, b){ return Math.hypot(a.x - b.x, a.z - b.z); }
function nearestBridge(z){ let best = BRIDGES[0], bd = Infinity; for (const b of BRIDGES){ const d = Math.abs(b.z - z); if (d < bd){ bd=d; best=b; } } return best; }
function needsBridge(u, t){ return u.def.type === 'ground' && ((u.x < 0) !== (t.x < 0)); }

function moveToward(u, target, dt){
  if ((u.effSpeed||u.def.speed) === 0 || u.stunned > 0) { u.moving = false; return; }
  const def = u.def;
  let speed = u.effSpeed || def.speed;
  if (u.warCry > 0) speed *= 1.3;
  if (def.type === 'air') {
    const dx = target.x - u.x, dz = target.z - u.z;
    const d = Math.hypot(dx, dz);
    if (d < 0.2) { u.moving = false; return; }
    u.x += (dx/d) * speed * dt;
    u.z += (dz/d) * speed * dt;
    u.facing = Math.atan2(dx, dz);
    u.moving = true;
    return;
  }
  let goalX = target.x, goalZ = target.z;
  const myLane = getLaneForZ(u.z);
  if (needsBridge(u, { x:goalX, z:goalZ })) {
    const onBridge = Math.abs(u.x) < PLASMA_HALF + 0.6 && BRIDGES.some(b => Math.abs(u.z - b.z) < b.halfLength);
    if (!onBridge) {
      const br = BRIDGES.find(b => Math.abs(b.z - myLane.z) < 2.0) || nearestBridge(u.z);
      goalZ = br.z;
      goalX = (u.x < 0) ? -PLASMA_HALF - 0.4 : PLASMA_HALF + 0.4;
    }
  }
  const dx = goalX - u.x, dz = goalZ - u.z;
  const d = Math.hypot(dx, dz);
  if (d < 0.05) { u.moving = false; return; }
  u.x += (dx/d) * speed * dt;
  u.z += (dz/d) * speed * dt;
  u.facing = Math.atan2(dx, dz);
  u.moving = true;
  // Ally collision
  for (const o of STATE.units) {
    if (o === u || o.side !== u.side || o.def.type !== def.type || o.hp <= 0) continue;
    const ox = u.x - o.x, oz = u.z - o.z;
    const od = Math.hypot(ox, oz);
    const min = (def.radius + o.def.radius) * 1.0;
    if (od < min && od > 0.01) {
      u.x += (ox / od) * (min - od) * 0.5;
      u.z += (oz / od) * (min - od) * 0.5;
    }
  }
  // Plasma push
  if (def.type === 'ground' && Math.abs(u.x) < PLASMA_HALF) {
    const onBridge = BRIDGES.some(b => Math.abs(u.z - b.z) < b.halfLength);
    if (!onBridge) {
      const br = BRIDGES.find(b => Math.abs(b.z - myLane.z) < 2.0) || nearestBridge(u.z);
      u.z += Math.sign(br.z - u.z) * speed * dt * 1.2;
    }
  }
}

const LANE_LEASH = 6.5;
function findTarget(u){
  let best = null, bd = Infinity;
  const canG = u.def.targets === 'ground' || u.def.targets === 'ground_air';
  const canA = u.def.targets === 'air' || u.def.targets === 'ground_air';
  const homeZ = u.homeLaneZ != null ? u.homeLaneZ : u.z;
  const leash = u.def.type === 'air' ? 999 : LANE_LEASH;
  for (const e of STATE.units) {
    if (e.side === u.side || e.hp <= 0) continue;
    if (e.def.type === 'air' && !canA) continue;
    if (e.def.type === 'ground' && !canG) continue;
    if (Math.abs(e.z - homeZ) > leash) continue;
    const d = dist(u, e);
    if (d < bd) { bd = d; best = e; }
  }
  if (canG) {
    const eSide = u.side === 'player' ? 'enemy' : 'player';
    const turretDown = STATE.towers.some(t => t.side === eSide && t.role === 'turret' && t.hp <= 0);
    for (const t of STATE.towers) {
      if (t.side === u.side || t.hp <= 0) continue;
      if (t.role === 'core' && !turretDown) continue;
      const d = dist(u, t);
      if (d < bd) { bd = d; best = t; }
    }
  }
  return best;
}
function findNearestEnemyForTower(t){
  if (!t.targets || t.targets === 'none') return null;
  let best = null, bs = -Infinity;
  const canG = t.targets === 'ground' || t.targets === 'ground_air';
  const canA = t.targets === 'air' || t.targets === 'ground_air';
  for (const u of STATE.units) {
    if (u.side === t.side || u.hp <= 0) continue;
    if (u.def.type === 'air' && !canA) continue;
    if (u.def.type === 'ground' && !canG) continue;
    const d = dist(t, u);
    if (d > t.range) continue;
    const cost = u.def.cost || 1;
    const score = cost * 2 - d * 0.3;
    if (score > bs) { bs = score; best = u; }
  }
  return best;
}

function applyDamage(t, dmg, attacker){
  if (!t || t.hp == null) return;
  if (attacker && attacker.def && t.def) dmg *= getDmgMul(attacker.def.roleKey, t.def.roleKey);
  if (t.shielded > 0) dmg *= 0.5;
  if (t.side === 'player') STATE.stats.dmgTaken += dmg;
  if (attacker && attacker.side === 'player') STATE.stats.dmgDealt += dmg;
  t.hp -= dmg;
  t.flash = 0.2;
  if (t.role === 'core' && t.side === 'player' && dmg > 30) flashDamage();
  // Sci-fi hit FX (sparks instead of blood)
  if (t.def && Math.random() < 0.7) {
    addFX({ type:'spark', x:t.x, y:0.8, z:t.z, t:0, dur:0.4,
      vx:(Math.random()-0.5)*2, vy:1+Math.random()*1.5, vz:(Math.random()-0.5)*2,
      color: t.def.neon || 0xffff00 });
  }
  if (t.hp <= 0) {
    t.hp = 0;
    if (t.def) {
      if (t.side === 'enemy') STATE.stats.kills++;
      else if (t.side === 'player') STATE.stats.allyDeaths++;
      STATE.bloodIntensity = Math.min(1, STATE.bloodIntensity + 0.10);
    }
  }
}
function flashDamage(){
  const f = document.getElementById('damageFlash'); if (!f) return;
  f.style.opacity = '0.9';
  setTimeout(() => { f.style.transition = 'opacity 0.5s ease-out'; f.style.opacity = '0'; }, 30);
  setTimeout(() => { f.style.transition = ''; }, 600);
}
function effDmg(u){
  let m = u.effDmgMul || 1;
  if (u.warCry > 0) m *= 1.3;
  if (u.frenzy > 0) m *= 1.6;
  return u.def.dmg * m;
}
function safeSetTimeout(fn, ms){
  const mid = STATE.matchId;
  return setTimeout(() => { if (STATE.matchId !== mid || !STATE.running) return; try{ fn(); } catch(e){} }, ms);
}

function fireWeapon(u, target){
  const def = u.def;
  u.recoil = 0.18;
  const mode = def.fire;
  const mesh = unitObjects.get(u.id);
  let mx = u.x, my = (def.type === 'air' ? 3 : 0.7), mz = u.z;
  if (mesh && mesh.userData.bones) {
    const b = mesh.userData.bones;
    let muzzle = b.muzzle;
    if (!muzzle && b.weapon && b.weapon.userData.muzzle) muzzle = b.weapon.userData.muzzle;
    if (muzzle) {
      muzzle.updateWorldMatrix(true, false);
      const w = new THREE.Vector3(); w.setFromMatrixPosition(muzzle.matrixWorld);
      mx = w.x; my = w.y; mz = w.z;
    }
  }
  if (mode === 'shot') {
    STATE.projectiles.push({ id:nextId++, x:mx, y:my, z:mz, tx:target.x, tz:target.z, target, attacker:u, speed:30, kind:'plasma', dmg:effDmg(u), color:def.neon, alive:true });
    addFX({ type:'muzzle', x:mx, y:my, z:mz, t:0, dur:0.12, color:def.neon });
    playSound('shot');
  } else if (mode === 'burst3') {
    u.burstRemaining = 3; u.burstTimer = 0;
    fireBurstShot(u, target);
  } else if (mode === 'snipe') {
    applyDamage(target, effDmg(u), u);
    addFX({ type:'beam', x:mx, y:my, z:mz, tx:target.x, tz:target.z, t:0, dur:0.40, color:def.neon });
    addFX({ type:'muzzleBig', x:mx, y:my, z:mz, t:0, dur:0.22, color:def.neon });
    playSound('snipe');
    triggerShake(0.10, 0.13);
  } else if (mode === 'minigun') {
    for (let i = 0; i < 5; i++) safeSetTimeout(() => {
      if (target.hp > 0) {
        STATE.projectiles.push({ id:nextId++, x:mx, y:my, z:mz, tx:target.x, tz:target.z, target, attacker:u, speed:30, kind:'tracer', dmg:effDmg(u)/2.5, color:def.neon, alive:true });
        addFX({ type:'muzzle', x:mx, y:my, z:mz, t:0, dur:0.06, color:def.neon });
      }
    }, i * 55);
    playSound('minigun');
  } else if (mode === 'cannon') {
    STATE.projectiles.push({ id:nextId++, x:mx, y:my, z:mz, tx:target.x, tz:target.z, target, attacker:u, speed:34, kind:'shell', dmg:effDmg(u), splash:def.splash, color:def.neon, alive:true });
    addFX({ type:'muzzleBig', x:mx, y:my, z:mz, t:0, dur:0.26, color:def.neon });
    playSound('cannon');
    triggerShake(0.16, 0.22);
  } else if (mode === 'chain') {
    for (let i = 0; i < 3; i++) safeSetTimeout(() => {
      if (target.hp > 0) {
        STATE.projectiles.push({ id:nextId++, x:mx + (Math.random()-0.5)*0.2, y:my, z:mz + (Math.random()-0.5)*0.2, tx:target.x, tz:target.z, target, attacker:u, speed:32, kind:'tracer', dmg:effDmg(u), color:def.neon, alive:true });
        addFX({ type:'muzzle', x:mx, y:my, z:mz, t:0, dur:0.05, color:def.neon });
      }
    }, i * 40);
    playSound('chain');
  }
}
function fireBurstShot(u, target){
  if (!target || target.hp <= 0) return;
  const mesh = unitObjects.get(u.id);
  let mx = u.x, my = 0.7, mz = u.z;
  if (mesh && mesh.userData.bones && mesh.userData.bones.weapon && mesh.userData.bones.weapon.userData.muzzle) {
    const muzzle = mesh.userData.bones.weapon.userData.muzzle;
    muzzle.updateWorldMatrix(true, false);
    const w = new THREE.Vector3(); w.setFromMatrixPosition(muzzle.matrixWorld);
    mx = w.x; my = w.y; mz = w.z;
  }
  STATE.projectiles.push({ id:nextId++, x:mx, y:my, z:mz, tx:target.x, tz:target.z, target, attacker:u, speed:32, kind:'plasma', dmg:effDmg(u), color:u.def.neon, alive:true });
  addFX({ type:'muzzle', x:mx, y:my, z:mz, t:0, dur:0.08, color:u.def.neon });
  playSound('shot');
  u.burstRemaining--; u.burstTimer = 0.07;
}
function fireTowerWeapon(t, target){
  t.cooldown = t.atkSpeed;
  const mesh = towerObjects.get(t.id);
  let mx = t.x, my = 2.7, mz = t.z;
  if (mesh && mesh.userData.bones && mesh.userData.bones.muzzle) {
    const muzzle = mesh.userData.bones.muzzle;
    muzzle.updateWorldMatrix(true, false);
    const w = new THREE.Vector3(); w.setFromMatrixPosition(muzzle.matrixWorld);
    mx = w.x; my = w.y; mz = w.z;
  }
  const f = FACTIONS[t.faction] || FACTIONS.nexus;
  STATE.projectiles.push({ id:nextId++, x:mx, y:my, z:mz, tx:target.x, tz:target.z, target, speed:32, kind:'tracer', dmg:t.dmg, color:f.neon, alive:true });
  addFX({ type:'muzzle', x:mx, y:my, z:mz, t:0, dur:0.15, color:f.neon });
  playSound('flak');
}
function explodeAt(x, y, z, dmg, splash, side, big){
  addFX({ type:'flash', x, y, z, t:0, dur:0.18, size:splash });
  addFX({ type:'explosion', x, y, z, t:0, dur:big ? 1.0 : 0.7, size:splash });
  addFX({ type:'shockwave', x, y:0.1, z, t:0, dur:big ? 0.9 : 0.6, size:splash * 1.3, color:0x00ffff });
  if (big) addFX({ type:'shockwave', x, y:0.05, z, t:0, dur:1.2, size:splash * 1.85, color:0xff00ff });
  const Q = getQuality();
  const sparkCount = Math.floor((big ? 24 : 12) * Q.particleMul);
  for (let i = 0; i < sparkCount; i++) {
    const ang = Math.random() * Math.PI * 2;
    addFX({ type:'spark', x, y:0.2, z, t:0, dur:0.85,
      vx:Math.cos(ang)*(2+Math.random()*4), vy:2.5+Math.random()*4, vz:Math.sin(ang)*(2+Math.random()*4),
      color:0x00ffff });
  }
  addFX({ type:'smoke', x, y:0.3, z, t:0, dur:big ? 2.4 : 1.4 });
  playSound(big ? 'boom_big' : 'boom');
  triggerShake(big ? 0.4 : 0.14, big ? 0.4 : 0.18);
  for (const u of STATE.units) {
    if (u.hp <= 0) continue;
    if (side != null && u.side === side) continue;
    const d = Math.hypot(u.x - x, u.z - z);
    if (d <= splash) {
      const fall = Math.max(0.3, 1 - d / splash);
      applyDamage(u, dmg * fall);
    }
  }
  for (const t of STATE.towers) {
    if (side != null && t.side === side) continue;
    if (t.hp <= 0) continue;
    if (Math.hypot(t.x - x, t.z - z) <= splash + 0.5) applyDamage(t, dmg);
  }
}
function triggerShake(mag, dur){ STATE.shake.t = dur || 0.3; STATE.shake.mag = Math.max(STATE.shake.mag, mag || 0.2); }


// =========================================================================
// FX
// =========================================================================
const FX_CAP = 220;
function addFX(fx){
  const Q = getQuality();
  if ((fx.type === 'spark') && Math.random() > Q.particleMul) return;
  // Hard cap
  if (fxObjects.length >= FX_CAP) {
    for (let i = 0; i < fxObjects.length; i++) {
      const f = fxObjects[i];
      if (f.type !== 'pool') {
        if (f.mesh) removeAndDispose(f.mesh);
        fxObjects.splice(i, 1);
        break;
      }
    }
  }
  STATE.fx.push(fx);
  let m;
  if (fx.type === 'flash') m = new THREE.Mesh(new THREE.SphereGeometry(0.85, 12, 10), basicMat(0xffffff, { transparent:true, opacity:1 }));
  else if (fx.type === 'explosion') m = new THREE.Mesh(new THREE.SphereGeometry(0.6, 12, 10), basicMat(fx.color || 0x00ffff, { transparent:true, opacity:1 }));
  else if (fx.type === 'shockwave') {
    m = new THREE.Mesh(new THREE.RingGeometry(0.2, 0.42, 24), basicMat(fx.color || 0x00ffff, { transparent:true, opacity:0.9, side:THREE.DoubleSide, depthWrite:false }));
    m.rotation.x = -Math.PI/2;
  }
  else if (fx.type === 'smoke') m = new THREE.Mesh(new THREE.SphereGeometry(0.3, 8, 6), basicMat(0x404060, { transparent:true, opacity:0.7 }));
  else if (fx.type === 'spark') m = new THREE.Mesh(new THREE.SphereGeometry(0.07, 5, 4), basicMat(fx.color || 0xffcc44));
  else if (fx.type === 'muzzle') m = new THREE.Mesh(new THREE.SphereGeometry(0.22, 8, 6), basicMat(fx.color || 0xffe888, { transparent:true, opacity:1 }));
  else if (fx.type === 'muzzleBig') m = new THREE.Mesh(new THREE.SphereGeometry(0.40, 8, 6), basicMat(fx.color || 0xffe888, { transparent:true, opacity:1 }));
  else if (fx.type === 'beam') {
    const pts = [new THREE.Vector3(fx.x, fx.y, fx.z), new THREE.Vector3(fx.tx, fx.y, fx.tz)];
    m = new THREE.Line(new THREE.BufferGeometry().setFromPoints(pts), new THREE.LineBasicMaterial({ color:fx.color || 0xffe888, transparent:true, opacity:1, linewidth:2 }));
  }
  else if (fx.type === 'spawnRing') {
    m = new THREE.Mesh(new THREE.RingGeometry(0.5, 0.8, 24), basicMat(fx.color || 0x00ffff, { transparent:true, opacity:0.95, side:THREE.DoubleSide, depthWrite:false }));
    m.rotation.x = -Math.PI/2;
  }
  else if (fx.type === 'dropMarker') {
    m = new THREE.Mesh(new THREE.RingGeometry(0.85, 1.15, 22), basicMat(fx.color || 0xffaa00, { transparent:true, opacity:0.85, side:THREE.DoubleSide, depthWrite:false }));
    m.rotation.x = -Math.PI/2;
  }
  else if (fx.type === 'fireZone') {
    m = new THREE.Mesh(new THREE.CircleGeometry(fx.size || 3, 18), basicMat(0xff5500, { transparent:true, opacity:0.45, depthWrite:false }));
    m.rotation.x = -Math.PI/2;
  }
  if (m) {
    m.position.set(fx.x, fx.y || 0.1, fx.z);
    scene.add(m);
    fx.mesh = m;
    fxObjects.push(fx);
  }
}

// =========================================================================
// AI
// =========================================================================
let aiThinkTimer = 0;
function updateAI(dt){
  if (!STATE.currentMission) return;
  const m = STATE.currentMission;
  const dm = DIFFICULTY[STATE.difficulty || 'normal'] || DIFFICULTY.normal;
  const speed = m.aiSpeed * dm.aiSpeedMul;
  const smart = Math.min(1, m.aiSmart * dm.aiSmartMul);
  aiThinkTimer -= dt;
  if (aiThinkTimer <= 0) {
    aiThinkTimer = (1.5 / speed) + Math.random() * 0.7;
    aiTakeTurn(smart);
  }
}
function aiTakeTurn(smart){
  if (STATE.enemyEnergy < 2) return;
  const aff = STATE.enemyHand.filter(k => { const u = UNITS[k]; if (!u || u.cost > STATE.enemyEnergy) return false; if (STATE.enemyCooldowns[k] > 0) return false; return true; });
  if (!aff.length) return;
  let choice = aff[Math.floor(Math.random() * aff.length)];
  if (Math.random() < smart) {
    const fk = STATE.currentMission.enemyFaction;
    const pp = STATE.units.filter(u => u.side === 'player' && u.hp > 0);
    const hasAir = pp.some(u => u.def.type === 'air');
    const hasMech = pp.some(u => u.def.roleKey === 'mech');
    if (hasMech && aff.includes(fk + '_mech')) choice = fk + '_mech';
    else if (hasAir && aff.includes(fk + '_sniper')) choice = fk + '_sniper';
  }
  const lzs = [LANE_TOP_Z, LANE_MID_Z, LANE_BOT_Z];
  let lz = lzs[Math.floor(Math.random() * 3)];
  let fz = lz + (Math.random() - 0.5) * LANE_HALF * 0.5;
  let fx = FIELD_W/2 - 7 - Math.random() * 6;
  STATE.enemyEnergy -= UNITS[choice].cost;
  // Cycle hand
  const idx = STATE.enemyHand.indexOf(choice);
  if (idx >= 0) {
    STATE.enemyCooldowns[choice] = 2.0;
    if (STATE.enemyHandPool.length) {
      const nxt = STATE.enemyHandPool.shift();
      STATE.enemyHandPool.push(choice);
      STATE.enemyHand[idx] = nxt;
    }
  }
  spawnUnit(choice, 'enemy', fx, fz);
}

// =========================================================================
// SYNC + DEATH
// =========================================================================
const _frust = new THREE.Frustum();
const _projMat = new THREE.Matrix4();
const _vTmp = new THREE.Vector3();
function unitVisible(u){
  _projMat.multiplyMatrices(camera.projectionMatrix, camera.matrixWorldInverse);
  _frust.setFromProjectionMatrix(_projMat);
  _vTmp.set(u.x, u.def.type === 'air' ? 3.5 : 0.5, u.z);
  return _frust.intersectsSphere(new THREE.Sphere(_vTmp, 1.5));
}
function syncMeshes(dt){
  if (plasmaUniforms) plasmaUniforms.time.value += dt;
  if (gridMesh && gridMesh.material.uniforms) gridMesh.material.uniforms.time.value += dt;
  // Update frustum once per frame
  _projMat.multiplyMatrices(camera.projectionMatrix, camera.matrixWorldInverse);
  _frust.setFromProjectionMatrix(_projMat);

  for (const u of STATE.units) {
    const mesh = unitObjects.get(u.id);
    if (!mesh) continue;
    if (u.deathStarted) {
      if (u.deathType === 'air') mesh.position.set(u.x, u.crashY != null ? u.crashY : 3.5, u.z);
      else mesh.position.set(u.x, 0, u.z);
      continue;
    }
    const yT = u.def.type === 'air' ? 3.5 : 0;
    if (u.visualX == null) { u.visualX = u.x; u.visualZ = u.z; }
    const lt = Math.min(1, dt * 18);
    u.visualX += (u.x - u.visualX) * lt;
    u.visualZ += (u.z - u.visualZ) * lt;
    mesh.position.set(u.visualX, yT, u.visualZ);
    if (u.spawnAnim > 0) { mesh.scale.setScalar(Math.max(0.1, 1 - u.spawnAnim)); u.spawnAnim -= dt * 3; if (u.spawnAnim < 0) u.spawnAnim = 0; }
    if (u.def.type === 'air') mesh.position.y = 3.5 + Math.sin(performance.now() * 0.003 + u.id) * 0.15;
    // Frustum cull animation
    _vTmp.set(u.x, u.def.type === 'air' ? 3.5 : 0.5, u.z);
    const visible = _frust.intersectsSphere(new THREE.Sphere(_vTmp, 1.5));
    mesh.visible = visible;
    if (visible) animateUnit(u, mesh, dt);
    if (visible && mesh.userData.pip) updatePip(mesh.userData.pip, u.hp, u.maxHp, u.side);
  }
  // Trigger deaths
  for (const u of STATE.units) {
    if (u.hp <= 0 && !u.deathStarted) {
      u.deathStarted = true; u.dyingT = 0;
      const isAir = u.def.type === 'air';
      const isMech = u.def.roleKey === 'mech';
      u.dyingDur = isMech ? 4.5 : (isAir ? 3.0 : 3.0);
      u.deathType = isAir ? 'air' : (isMech ? 'mech' : 'unit');
      const Q = getQuality();
      if (isMech || isAir) {
        explodeAt(u.x, isAir ? 3 : 0.8, u.z, 0, isMech ? 3.0 : 2.5, u.side, true);
      } else {
        addFX({ type:'explosion', x:u.x, y:0.6, z:u.z, t:0, dur:0.5, size:0.6, color:u.def.neon });
        for (let i = 0; i < Math.floor(8 * Q.particleMul); i++) {
          const a = Math.random() * Math.PI * 2;
          addFX({ type:'spark', x:u.x, y:0.7, z:u.z, t:0, dur:0.7,
            vx:Math.cos(a)*(2+Math.random()*3), vy:2+Math.random()*3, vz:Math.sin(a)*(2+Math.random()*3),
            color: u.def.neon });
        }
        playSound('gore');
      }
      if (isAir) { u.crashVy = -2; u.crashVx = (Math.random()-0.5)*2; u.crashVz = (Math.random()-0.5)*2; }
    }
  }
  // Advance dying
  for (const u of STATE.units) {
    if (!u.deathStarted) continue;
    u.dyingT += dt;
    const mesh = unitObjects.get(u.id);
    if (!mesh) continue;
    if (u.deathType === 'mech') {
      mesh.rotation.z = Math.min(0.5, u.dyingT * 0.2);
      if (Math.random() < dt * 8) addFX({ type:'spark', x:u.x, y:0.8, z:u.z, t:0, dur:0.5, vx:(Math.random()-0.5)*2, vy:1+Math.random()*2, vz:(Math.random()-0.5)*2, color:0xff8800 });
      if (Math.random() < dt * 10) addFX({ type:'smoke', x:u.x, y:1.4, z:u.z, t:0, dur:1.6 });
    } else if (u.deathType === 'air') {
      u.x += u.crashVx * dt; u.z += u.crashVz * dt;
      u.crashY = (u.crashY != null ? u.crashY : 3.5) + u.crashVy * dt;
      u.crashVy -= 9.8 * dt;
      mesh.rotation.x += dt * 4;
      if (u.crashY < 0.3 && !u.crashed) {
        u.crashed = true;
        explodeAt(u.x, 0.5, u.z, 0, 3, u.side, true);
      }
    } else {
      // Infantry: collapse + fade
      if (u.dyingT < 0.4) {
        const t = u.dyingT / 0.4;
        mesh.rotation.x = -Math.PI / 2 * t;
        mesh.position.y = -0.3 * t;
      } else { mesh.rotation.x = -Math.PI/2; mesh.position.y = -0.3; }
    }
    // Fade out at end
    if (u.dyingT > u.dyingDur - 0.6) {
      const f = 1 - (u.dyingT - (u.dyingDur - 0.6)) / 0.6;
      mesh.traverse(o => { if (o.material && !o.userData.isOutline) { o.material.transparent = true; o.material.opacity = Math.max(0, f); } });
    }
  }
  for (const u of STATE.units) {
    if (u.deathStarted && u.dyingT >= u.dyingDur) {
      const mesh = unitObjects.get(u.id);
      if (mesh) { removeAndDispose(mesh); unitObjects.delete(u.id); }
      u.removed = true;
    }
  }
  STATE.units = STATE.units.filter(u => !u.removed);

  // Towers
  for (const t of STATE.towers) {
    const mesh = towerObjects.get(t.id);
    if (!mesh) continue;
    if (mesh.userData.bones && mesh.userData.bones.turret && t.hp > 0) {
      const nearest = findNearestEnemyForTower(t);
      if (nearest) {
        const tx = nearest.x - t.x, tz = nearest.z - t.z;
        const aimA = Math.atan2(tx, tz);
        let diff = aimA - mesh.userData.bones.turret.rotation.y;
        while (diff > Math.PI) diff -= Math.PI * 2;
        while (diff < -Math.PI) diff += Math.PI * 2;
        mesh.userData.bones.turret.rotation.y += diff * Math.min(1, dt * 3);
      }
    }
    if (mesh.userData.crystal) {
      mesh.userData.crystal.rotation.y += dt * 0.6;
      mesh.userData.crystal.rotation.x = Math.sin(performance.now() * 0.001) * 0.2;
    }
    if (mesh.userData.halo) {
      mesh.userData.halo.scale.setScalar(1 + Math.sin(performance.now() * 0.004) * 0.1);
    }
    if (mesh.userData.pip) updatePip(mesh.userData.pip, t.hp, t.maxHp, t.side);
  }
  for (const t of STATE.towers.filter(x => x.hp <= 0 && !x.destroyed)) {
    t.destroyed = true;
    const mesh = towerObjects.get(t.id);
    if (mesh) { explodeAt(t.x, 1, t.z, 0, 2.5, t.side, true); removeAndDispose(mesh); towerObjects.delete(t.id); }
    updateTowerPips();
    if (t.role === 'turret') { showToast(t.side === 'player' ? 'TURRET DOWN — CORE EXPOSED' : 'TURRET DESTROYED — STRIKE NOW'); triggerShake(0.6, 0.5); playSound('boom_big'); }
    if (t.role === 'core') {
      const mid = STATE.matchId;
      setTimeout(() => { if (STATE.matchId !== mid || !STATE.running) return; endMatch(t.side !== 'player'); }, 800);
    }
  }
  // Projectiles
  for (const p of STATE.projectiles) {
    if (!projObjects.has(p.id)) {
      let m;
      if (p.kind === 'plasma' || p.kind === 'tracer') {
        m = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 0.6, 6), basicMat(p.color || 0x00ffff));
        m.rotation.x = Math.PI / 2;
      } else if (p.kind === 'shell') {
        m = new THREE.Mesh(new THREE.SphereGeometry(0.18, 10, 8), basicMat(p.color || 0xff0066));
      } else {
        m = new THREE.Mesh(new THREE.SphereGeometry(0.1, 6, 5), basicMat(0xffffff));
      }
      scene.add(m); projObjects.set(p.id, m);
    }
    const mesh = projObjects.get(p.id);
    mesh.position.set(p.x, p.y, p.z);
    if (p.kind === 'plasma' || p.kind === 'tracer') mesh.lookAt(p.tx, p.y, p.tz);
  }
  for (const p of STATE.projectiles.filter(x => !x.alive)) {
    const m = projObjects.get(p.id);
    if (m) { removeAndDispose(m); projObjects.delete(p.id); }
  }
  STATE.projectiles = STATE.projectiles.filter(p => p.alive);
  // FX
  for (const fx of fxObjects) {
    fx.t += dt; const r = fx.t / fx.dur;
    if (!fx.mesh) continue;
    if (fx.type === 'flash') { fx.mesh.scale.setScalar((fx.size||1) * (0.3 + r * 5)); fx.mesh.material.opacity = Math.max(0, 1 - r * 1.3); }
    else if (fx.type === 'explosion') { const s = (fx.size||1) * (0.6 + r * 1.7); fx.mesh.scale.setScalar(s); fx.mesh.material.opacity = Math.max(0, 1 - r); }
    else if (fx.type === 'shockwave') { const s = (fx.size||1) * (0.4 + r * 3); fx.mesh.scale.setScalar(s); fx.mesh.material.opacity = Math.max(0, 0.9 - r); }
    else if (fx.type === 'smoke') { fx.mesh.scale.setScalar(0.5 + r * 2.6); fx.mesh.position.y = 0.3 + r * 0.75; fx.mesh.material.opacity = Math.max(0, 0.7 - r * 0.7); }
    else if (fx.type === 'spark') {
      fx.mesh.position.x += (fx.vx||0) * dt;
      fx.mesh.position.y += (fx.vy||0) * dt;
      fx.mesh.position.z += (fx.vz||0) * dt;
      fx.vy = (fx.vy||0) - 10 * dt;
    }
    else if (fx.type === 'muzzle' || fx.type === 'muzzleBig') { fx.mesh.scale.setScalar(1 + r * 2); fx.mesh.material.opacity = Math.max(0, 1 - r * 2); }
    else if (fx.type === 'beam') { fx.mesh.material.opacity = Math.max(0, 1 - r); }
    else if (fx.type === 'spawnRing') { fx.mesh.scale.setScalar(0.5 + r * 4); fx.mesh.material.opacity = Math.max(0, 0.95 - r); }
    else if (fx.type === 'dropMarker') { fx.mesh.material.opacity = Math.max(0, 0.85 - r * 0.3); fx.mesh.rotation.z += dt * 2; }
    else if (fx.type === 'fireZone') {
      fx.mesh.material.opacity = Math.max(0, 0.45 - r * 0.45);
      // Damage units inside (player/enemy depends on caster)
      if (fx.t > 0.3 && fx.t < fx.dur - 0.3 && Math.random() < dt * 4) {
        for (const u of STATE.units) {
          if (u.hp <= 0 || u.side === fx.side) continue;
          if (Math.hypot(u.x - fx.x, u.z - fx.z) < (fx.size||3)) applyDamage(u, 18 * dt * 60);
        }
      }
    }
  }
  for (const fx of fxObjects.filter(f => f.t >= f.dur)) if (fx.mesh) removeAndDispose(fx.mesh);
  fxObjects = fxObjects.filter(f => f.t < f.dur);
  STATE.fx = fxObjects;
  // Deploy zone
  if (deployZoneMesh) {
    const show = STATE.selectedCard && !POWERS[STATE.selectedCard];
    const tgt = show ? 0.16 : 0;
    deployZoneMesh.material.opacity += (tgt - deployZoneMesh.material.opacity) * Math.min(1, dt * 5);
  }
  if (rangePreviewMesh) {
    if (STATE.selectedCard && UNITS[STATE.selectedCard]) {
      const def = UNITS[STATE.selectedCard];
      rangePreviewMesh.scale.setScalar(def.range || 8);
      rangePreviewMesh.position.x = lastPointerWorld.x;
      rangePreviewMesh.position.z = lastPointerWorld.z;
      rangePreviewMesh.material.opacity += (0.65 - rangePreviewMesh.material.opacity) * Math.min(1, dt * 6);
      const valid = lastPointerWorld.x < -PLASMA_HALF - 1 && lastPointerWorld.x > -FIELD_W/2 + 3 && Math.abs(lastPointerWorld.z) < FIELD_D/2 - 1;
      rangePreviewMesh.material.color.setHex(valid ? 0x00cfff : 0xff4444);
    } else {
      rangePreviewMesh.material.opacity += (0 - rangePreviewMesh.material.opacity) * Math.min(1, dt * 6);
    }
  }
  drawMinimap();
  tickAbilityHUD();
  // Selection ring
  if (SELECTED_UNIT && SELECTED_UNIT.hp > 0) {
    const u = SELECTED_UNIT;
    if (!STATE._selRing) {
      const ring = new THREE.Mesh(new THREE.RingGeometry(0.85, 1.05, 28), basicMat(0xff00cc, { transparent:true, opacity:0.9, side:THREE.DoubleSide, depthWrite:false }));
      ring.rotation.x = -Math.PI/2;
      scene.add(ring); STATE._selRing = ring;
    }
    STATE._selRing.position.set(u.x, 0.10, u.z);
    STATE._selRing.scale.setScalar(1 + Math.sin(performance.now() * 0.005) * 0.1);
    STATE._selRing.material.opacity = 0.7 + Math.sin(performance.now() * 0.005) * 0.2;
  } else if (STATE._selRing) {
    removeAndDispose(STATE._selRing);
    STATE._selRing = null;
  }
  // Vignette
  if (STATE.bloodIntensity > 0) {
    STATE.bloodIntensity = Math.max(0, STATE.bloodIntensity - dt * 0.3);
    const v = document.getElementById('vignette');
    if (v) v.style.opacity = String(Math.min(0.7, STATE.bloodIntensity));
  } else { const v = document.getElementById('vignette'); if (v && v.style.opacity !== '0') v.style.opacity = '0'; }
  // Camera shake
  if (STATE.shake.t > 0) {
    STATE.shake.t -= dt;
    const m = STATE.shake.mag * (STATE.shake.t > 0 ? 1 : 0);
    camera.position.x += (Math.random() - 0.5) * m;
    camera.position.z += (Math.random() - 0.5) * m;
    if (STATE.shake.t <= 0) STATE.shake.mag = 0;
  }
  renderer.render(scene, camera);
}


// =========================================================================
// UPDATE LOOP
// =========================================================================
function update(dt){
  if (!STATE.running || STATE.paused) return;
  // Energy ramp
  const elapsed = 180 - STATE.timer;
  let mul = 1;
  if (elapsed >= 180) mul = 5;
  else if (elapsed >= 150) mul = 3;
  else if (elapsed >= 120) mul = 2;
  STATE.energyMul = mul;
  STATE.energy = Math.min(STATE.maxEnergy, STATE.energy + STATE.energyRate * mul * dt);
  STATE.enemyEnergy = Math.min(STATE.maxEnergy, STATE.enemyEnergy + STATE.energyRate * mul * dt);
  STATE.timer -= dt;
  if (STATE.enemyCooldowns) for (const k of Object.keys(STATE.enemyCooldowns)) {
    STATE.enemyCooldowns[k] -= dt;
    if (STATE.enemyCooldowns[k] <= 0) delete STATE.enemyCooldowns[k];
  }
  if (STATE.timer <= 0 && !STATE.overtime) { STATE.overtime = true; showToast('OVERTIME — x5 ENERGY'); playSound('siren'); }
  updateAI(dt);
  // Per-unit
  for (const u of STATE.units) {
    if (u.hp <= 0) continue;
    if (u.warCry > 0) u.warCry -= dt;
    if (u.frenzy > 0) u.frenzy -= dt;
    if (u.shielded > 0) u.shielded -= dt;
    if (u.abCD > 0) u.abCD = Math.max(0, u.abCD - dt);
    if (u.stunned > 0) { u.stunned -= dt; u.moving = false; continue; }
    if (u.burstRemaining > 0) {
      u.burstTimer -= dt;
      if (u.burstTimer <= 0 && u.target && u.target.hp > 0) fireBurstShot(u, u.target);
    }
    const eRange = u.effRange || u.def.range;
    if (!u.target || u.target.hp <= 0 || dist(u, u.target) > eRange + 5) u.target = findTarget(u);
    if (u.cooldown > 0) u.cooldown -= dt;
    const stationary = u.def.speed === 0 || u.def.roleKey === 'sniper';
    if (u.target) {
      const d = dist(u, u.target);
      if (d <= eRange) {
        u.moving = false;
        if (u.cooldown <= 0 && u.burstRemaining <= 0) { fireWeapon(u, u.target); u.cooldown = u.def.atkSpeed; }
      } else if (stationary) { u.target = null; u.moving = false; }
      else moveToward(u, u.target, dt);
    } else if (!stationary) {
      const eHQ = STATE.towers.find(t => t.role === 'core' && t.side !== u.side);
      if (eHQ) {
        const homeZ = u.homeLaneZ != null ? u.homeLaneZ : u.z;
        moveToward(u, { x:eHQ.x, z: u.def.type === 'air' ? eHQ.z : homeZ }, dt);
      }
    } else u.moving = false;
  }
  // Towers fire
  for (const t of STATE.towers) {
    if (t.hp <= 0) continue;
    if (t.stunned > 0) { t.stunned -= dt; continue; }
    if (t.cooldown > 0) t.cooldown -= dt;
    if (t.windupTimer > 0) t.windupTimer -= dt;
    const tg = findNearestEnemyForTower(t);
    if (!tg) { t.lastTargetId = null; continue; }
    if (t.lastTargetId !== tg.id) { t.lastTargetId = tg.id; t.windupTimer = t.windup || 0; }
    if (dist(t, tg) <= t.range && t.cooldown <= 0 && t.windupTimer <= 0) fireTowerWeapon(t, tg);
  }
  // Projectiles
  for (const p of STATE.projectiles) {
    if (!p.alive) continue;
    if (p.target) {
      const ty = p.target.def && p.target.def.type === 'air' ? 3.5 : 0.7;
      const dx = p.target.x - p.x, dy = ty - p.y, dz = p.target.z - p.z;
      const d = Math.hypot(dx, dy, dz);
      if (d < 0.5) {
        applyDamage(p.target, p.dmg, p.attacker);
        if (p.kind === 'shell' && p.splash) explodeAt(p.target.x, 0.5, p.target.z, p.dmg * 0.5, p.splash, p.side, false);
        else addFX({ type:'spark', x:p.x, y:p.y, z:p.z, t:0, dur:0.3, vx:(Math.random()-0.5)*2, vy:1.5, vz:(Math.random()-0.5)*2, color:p.color });
        p.alive = false;
      } else {
        p.x += (dx/d) * p.speed * dt;
        p.y += (dy/d) * p.speed * dt;
        p.z += (dz/d) * p.speed * dt;
      }
    } else p.alive = false;
  }
  updateHUD();
}

// =========================================================================
// POWERS
// =========================================================================
function triggerPower(key, x, z){
  const p = POWERS[key]; if (!p || STATE.energy < p.cost) return false;
  STATE.energy -= p.cost;
  if (key === 'nexus_overload' || key.endsWith('_overload')) {
    addFX({ type:'shockwave', x, y:0.2, z, t:0, dur:0.7, size:5, color:0x00ffff });
    for (const u of STATE.units) if (u.side === 'enemy' && dist(u, {x,z}) < 5) u.stunned = 4;
    playSound('emp');
  }
  else if (key === 'nexus_shield' || key === 'aegis_aegis') {
    for (const u of STATE.units) if (u.side === 'player' && u.hp > 0) u.shielded = 6;
    addFX({ type:'shockwave', x:0, y:0.2, z:0, t:0, dur:1.5, size:18, color:0x00ffff });
    showToast('SHIELDS UP'); playSound('shield');
  }
  else if (key === 'nexus_drones') {
    for (let i = 0; i < 4; i++) {
      const ox = x + (Math.random()-0.5)*5, oz = z + (Math.random()-0.5)*5;
      addFX({ type:'dropMarker', x:ox, z:oz, y:0.1, t:0, dur:1.6, color:0x00cfff });
      safeSetTimeout(() => explodeAt(ox, 0.3, oz, 110, 2.4, 'player', true), 300 + i * 350);
    }
    showToast('DRONE STRIKE'); playSound('rocket');
  }
  else if (key === 'scrap_warcry') {
    let n = 0;
    for (const u of STATE.units) if (u.side === 'player' && u.hp > 0) { u.warCry = 6; n++; }
    showToast('WAR CRY — ' + n); playSound('roar');
  }
  else if (key === 'scrap_napalm') {
    addFX({ type:'fireZone', x, y:0.05, z, t:0, dur:6, size:3.5, side:'player' });
    addFX({ type:'flash', x, y:0.5, z, t:0, dur:0.4, size:2 });
    playSound('fire');
    showToast('NAPALM BURNING');
  }
  else if (key === 'scrap_swarm') {
    const fk = STATE.progress.playerFaction;
    for (let i = 0; i < 4; i++) {
      const ox = x + (i-1.5) * 0.8, oz = z + (Math.random()-0.5)*1.5;
      spawnUnit(fk + '_trooper', 'player', ox, oz);
    }
    showToast('REINFORCEMENTS x4'); playSound('spawn');
  }
  else if (key === 'aegis_artillery') {
    for (let i = 0; i < 5; i++) {
      const ox = x + (Math.random()-0.5)*4, oz = z + (Math.random()-0.5)*4;
      addFX({ type:'dropMarker', x:ox, z:oz, y:0.1, t:0, dur:Math.max(0.6, i * 0.7) });
      safeSetTimeout(() => explodeAt(ox, 0.3, oz, 130, 2.3, 'player', false), i * 700);
    }
    showToast('BARRAGE INCOMING'); playSound('mortar');
  }
  else if (key === 'aegis_reinforce') {
    const fk = STATE.progress.playerFaction;
    spawnUnit(fk + '_trooper', 'player', x - 0.8, z);
    spawnUnit(fk + '_trooper', 'player', x + 0.8, z);
    showToast('SOLDIERS DEPLOYED'); playSound('deploy');
  }
  else if (key === 'void_curse') {
    addFX({ type:'shockwave', x, y:0.2, z, t:0, dur:1.0, size:5, color:0xff00cc });
    let n = 0;
    for (const u of STATE.units) if (u.side === 'enemy' && u.hp > 0 && dist(u, {x,z}) < 5) { applyDamage(u, u.maxHp * 0.4); n++; }
    showToast(n > 0 ? 'CURSED ' + n : 'NO TARGETS'); playSound('warp');
  }
  else if (key === 'void_frenzy') {
    let n = 0;
    for (const u of STATE.units) if (u.side === 'player' && u.hp > 0 && dist(u, {x,z}) < 5) { u.frenzy = 6; n++; }
    showToast('FRENZY x' + n); playSound('roar');
  }
  else if (key === 'void_summon') {
    const fk = STATE.progress.playerFaction;
    spawnUnit(fk + '_mech', 'player', x, z);
    showToast('ABERRATION SUMMONED'); playSound('warp');
  }
  return true;
}

function attemptDeploy(key, x, z){
  if (POWERS[key]) {
    if (triggerPower(key, x, z)) { cycleHandSlot(key); STATE.selectedCard = null; renderHand(); updateHUD(); }
    return;
  }
  const def = UNITS[key]; if (!def) return;
  if (STATE.energy < def.cost) { showToast('INSUFFICIENT ENERGY'); playSound('ui_click'); return; }
  const zMaxX = -PLASMA_HALF - 1.2, zMinX = -FIELD_W/2 + 3;
  const zMaxZ = FIELD_D/2 - 1.5, zMinZ = -FIELD_D/2 + 1.5;
  if (x > zMaxX + 4 || x < zMinX - 4 || Math.abs(z) > zMaxZ + 4) { showToast('DEPLOY IN YOUR ZONE'); playSound('ui_click'); return; }
  x = Math.max(zMinX, Math.min(zMaxX, x));
  z = Math.max(zMinZ, Math.min(zMaxZ, z));
  STATE.energy -= def.cost;
  spawnUnit(key, 'player', x, z);
  cycleHandSlot(key);
  STATE.selectedCard = null;
  renderHand(); updateHUD();
}
function cycleHandSlot(key){
  if (!STATE.handSlots || !STATE.deckQueue) return;
  const idx = STATE.handSlots.indexOf(key);
  if (idx < 0) return;
  if (STATE.deckQueue.length === 0) return;
  const next = STATE.deckQueue.shift();
  STATE.handSlots[idx] = next;
  STATE.deckQueue.push(key);
}

// =========================================================================
// ABILITIES (per-unit click ability)
// =========================================================================
const UNIT_ABILITIES = {
  trooper:{ name:'BURST FIRE', cd:14, desc:'5-shot burst at next target', sfx:'burst3' },
  heavy:  { name:'BRACE',     cd:14, desc:'-50% dmg taken, +30% fire rate 5s', sfx:'shield' },
  sniper: { name:'AIMED SHOT',cd:16, desc:'Instant 600 dmg to current target', sfx:'snipe' },
  assault:{ name:'BLINK',     cd:12, desc:'Dash forward 6m, +50% dmg 4s', sfx:'warp' },
  mech:   { name:'HEAT ROUND',cd:20, desc:'Triple-damage shell + big splash', sfx:'cannon' },
  drone:  { name:'STRAFE',    cd:18, desc:'Spray 8 plasma rockets in cone', sfx:'rocket' },
};
let SELECTED_UNIT = null;
function getUnitAbility(u){ if (!u || !u.def) return null; return UNIT_ABILITIES[u.def.roleKey] || null; }
function pickUnitAtScreen(x, y){
  const c = document.getElementById('threeContainer');
  const r = c.getBoundingClientRect();
  pointer.x = ((x - r.left) / r.width) * 2 - 1;
  pointer.y = -((y - r.top) / r.height) * 2 + 1;
  raycaster.setFromCamera(pointer, camera);
  let bestU = null, bestD = Infinity;
  for (const u of STATE.units) {
    if (u.side !== 'player' || u.hp <= 0 || u.deathStarted) continue;
    const cy = u.def.type === 'air' ? 3.5 : 0.9;
    const sphere = new THREE.Sphere(new THREE.Vector3(u.x, cy, u.z), Math.max(0.7, u.def.radius * 1.6));
    if (raycaster.ray.intersectsSphere(sphere)) {
      const d = raycaster.ray.origin.distanceTo(sphere.center);
      if (d < bestD) { bestD = d; bestU = u; }
    }
  }
  return bestU;
}
function selectUnit(u){
  if (SELECTED_UNIT === u) return;
  SELECTED_UNIT = u; renderAbilityHUD();
  if (u) playSound('ui_select');
}
function fireUnitAbility(){
  const u = SELECTED_UNIT; if (!u || u.hp <= 0) return;
  const ab = getUnitAbility(u); if (!ab) return;
  if ((u.abCD || 0) > 0) { showToast('ABILITY ON COOLDOWN'); return; }
  u.abCD = ab.cd;
  playSound(ab.sfx || 'shot');
  addFX({ type:'shockwave', x:u.x, y:0.1, z:u.z, t:0, dur:0.6, size:2, color:0xff00cc });
  const r = u.def.roleKey;
  if (r === 'trooper') { u.burstRemaining = 5; u.burstTimer = 0; if (u.target && u.target.hp > 0) fireBurstShot(u, u.target); }
  else if (r === 'heavy') { u.shielded = 5; u.warCry = 5; }
  else if (r === 'sniper' && u.target && u.target.hp > 0) {
    applyDamage(u.target, 600, u);
    addFX({ type:'beam', x:u.x, y:0.9, z:u.z, tx:u.target.x, tz:u.target.z, t:0, dur:0.5, color:0xff0044 });
  }
  else if (r === 'assault') {
    const dz = (u.side === 'player' ? 1 : -1) * 6;
    u.x += Math.sin(u.facing) * 6;
    u.z += Math.cos(u.facing) * 6;
    u.frenzy = 4;
    addFX({ type:'spawnRing', x:u.x, y:0.1, z:u.z, t:0, dur:0.5, color:0xff00cc });
  }
  else if (r === 'mech' && u.target && u.target.hp > 0) {
    applyDamage(u.target, effDmg(u) * 3, u);
    explodeAt(u.target.x, 0.5, u.target.z, effDmg(u), 3.0, u.side, true);
    triggerShake(0.4, 0.3);
  }
  else if (r === 'drone') {
    for (let i = 0; i < 8; i++) {
      const ang = u.facing + (Math.random() - 0.5) * 0.6;
      const dx = Math.sin(ang), dz = Math.cos(ang);
      const tx = u.x + dx * (8 + Math.random() * 6), tz = u.z + dz * (8 + Math.random() * 6);
      safeSetTimeout(() => explodeAt(tx, 0.5, tz, effDmg(u) * 1.4, 1.8, u.side, false), i * 80);
    }
  }
  renderAbilityHUD();
}
function renderAbilityHUD(){
  const hud = document.getElementById('abilityHUD'); if (!hud) return;
  if (!SELECTED_UNIT || SELECTED_UNIT.hp <= 0) { hud.style.display = 'none'; return; }
  const u = SELECTED_UNIT, ab = getUnitAbility(u);
  if (!ab) { hud.style.display = 'none'; return; }
  hud.style.display = 'flex';
  document.getElementById('abUnitName').textContent = u.def.name + ' • HP ' + Math.ceil(u.hp) + '/' + Math.ceil(u.maxHp);
  document.getElementById('abName').textContent = ab.name;
  document.getElementById('abDesc').textContent = ab.desc;
  const fire = document.getElementById('abFire');
  const cd = u.abCD || 0;
  if (cd > 0) { fire.textContent = cd.toFixed(1) + 's'; fire.style.background = 'rgba(60,60,80,.6)'; fire.style.color = '#789'; fire.disabled = true; }
  else { fire.textContent = 'FIRE'; fire.style.background = 'linear-gradient(135deg,#f0c,#a08)'; fire.style.color = '#fff'; fire.disabled = false; }
  document.getElementById('abPortrait').innerHTML = cardIconSVG(u.key, 46);
}
function tickAbilityHUD(){
  if (SELECTED_UNIT) {
    if (SELECTED_UNIT.hp <= 0 || SELECTED_UNIT.deathStarted || !STATE.units.includes(SELECTED_UNIT)) {
      SELECTED_UNIT = null; renderAbilityHUD(); return;
    }
    renderAbilityHUD();
  }
}

function loop(ts){
  requestAnimationFrame(loop);
  if (!STATE.running) return;
  if (!renderer || !scene || !camera) return;
  ensureCanvasSize();
  if (!STATE.lastTime) STATE.lastTime = ts;
  const dt = Math.min(0.05, (ts - STATE.lastTime) / 1000);
  STATE.lastTime = ts;
  updateCameraFromKeys(dt);
  if (!STATE.paused) { update(dt); syncMeshes(dt); }
  else renderer.render(scene, camera);
}


// =========================================================================
// HUD + UI
// =========================================================================
function updateHUD(){
  const t = STATE.timer;
  const tEl = document.getElementById('gameTimer');
  if (STATE.overtime && t <= 0) {
    const ot = Math.abs(t), om = Math.floor(ot/60), os = Math.floor(ot%60);
    tEl.textContent = 'OT +' + om + ':' + String(os).padStart(2,'0');
    tEl.style.color = '#ff5070';
  } else {
    const m = Math.max(0, Math.floor(t/60)), s = Math.max(0, Math.floor(t%60));
    tEl.textContent = m + ':' + String(s).padStart(2,'0');
    tEl.style.color = (t < 30 ? '#fc6' : '#cef');
  }
  document.getElementById('eNum').textContent = Math.floor(STATE.energy);
  const mul = STATE.energyMul || 1;
  document.getElementById('eRate').textContent = mul > 1 ? `+${Math.round(STATE.energyRate * mul * 60)}/m × ${mul}` : `+${Math.round(STATE.energyRate * 60)}/m`;
  const pHQ = STATE.towers.find(t => t.role === 'core' && t.side === 'player');
  const eHQ = STATE.towers.find(t => t.role === 'core' && t.side === 'enemy');
  if (pHQ) document.getElementById('pHQFill').style.width = (pHQ.hp / pHQ.maxHp * 100) + '%';
  if (eHQ) document.getElementById('eHQFill').style.width = (eHQ.hp / eHQ.maxHp * 100) + '%';
  const kc = document.getElementById('killCounter');
  if (kc) kc.textContent = '▼ ' + STATE.stats.kills;
  // Affordability
  const slots = STATE.handSlots || [];
  document.querySelectorAll('#hand .hand-card:not(.next-up)').forEach((el, i) => {
    const k = slots[i]; if (!k) return;
    const cost = (UNITS[k] && UNITS[k].cost) || (POWERS[k] && POWERS[k].cost) || 0;
    el.classList.toggle('affordable', STATE.energy >= cost);
    el.classList.toggle('unaffordable', STATE.energy < cost);
  });
}

function renderHand(){
  const h = document.getElementById('hand'); h.innerHTML = '';
  if (!STATE.handSlots || !STATE.handSlots.length) {
    const fk = STATE.progress.playerFaction;
    const deck = (STATE.progress.decks[fk]||[]).slice(0, 6);
    STATE.handSlots = deck.slice(0, HAND_SIZE);
    STATE.deckQueue = deck.slice(HAND_SIZE);
  }
  for (let i = 0; i < STATE.handSlots.length; i++) {
    const k = STATE.handSlots[i]; if (!k) continue;
    const def = UNITS[k] || POWERS[k]; if (!def) continue;
    const isPower = !!POWERS[k];
    const cost = def.cost || 0;
    const card = document.createElement('div');
    card.className = 'hand-card' + (isPower ? ' power' : '') + (STATE.selectedCard === k ? ' selected' : '');
    card.innerHTML = `<div class="cost-badge">${cost}</div><div class="icon-box">${cardIconSVG(k)}</div><div class="name">${def.name}</div>`;
    card.onclick = () => {
      if (STATE.energy < cost) { showToast('INSUFFICIENT ENERGY'); playSound('ui_click'); return; }
      STATE.selectedCard = STATE.selectedCard === k ? null : k;
      playSound('ui_select'); renderHand();
    };
    h.appendChild(card);
  }
  // Next-up preview
  if (STATE.deckQueue && STATE.deckQueue.length > 0) {
    const nk = STATE.deckQueue[0];
    const ndef = UNITS[nk] || POWERS[nk];
    if (ndef) {
      const next = document.createElement('div');
      next.className = 'hand-card next-up' + (POWERS[nk] ? ' power' : '');
      next.innerHTML = `<div class="cost-badge" style="width:18px;height:18px;font-size:10px">${ndef.cost}</div><div class="icon-box">${cardIconSVG(nk)}</div><div class="name">NEXT</div>`;
      h.appendChild(next);
    }
  }
  updateHUD();
}

function showToast(m){
  const t = document.getElementById('toast');
  t.textContent = m;
  t.classList.add('show');
  clearTimeout(STATE.toastTimer);
  STATE.toastTimer = setTimeout(() => t.classList.remove('show'), 1700);
}

function drawMinimap(){
  const cv = document.getElementById('minimap'); if (!cv) return;
  const ctx = cv.getContext('2d');
  const W = cv.width, H = cv.height;
  const sx = W / FIELD_W, sz = H / FIELD_D;
  function mx(x){ return (x + FIELD_W/2) * sx; }
  function my(z){ return (z + FIELD_D/2) * sz; }
  ctx.clearRect(0, 0, W, H);
  ctx.fillStyle = '#020812'; ctx.fillRect(0, 0, W, H);
  ctx.fillStyle = 'rgba(0,200,255,0.10)'; ctx.fillRect(0, 0, W/2, H);
  ctx.fillStyle = 'rgba(255,80,120,0.10)'; ctx.fillRect(W/2, 0, W/2, H);
  // Lanes
  ctx.fillStyle = 'rgba(0,255,200,0.2)';
  for (const z of [LANE_TOP_Z, LANE_MID_Z, LANE_BOT_Z]) ctx.fillRect(0, my(z) - 2, W, 4);
  // Plasma
  ctx.fillStyle = 'rgba(255,0,200,0.7)';
  ctx.fillRect(W/2 - 2, 0, 4, H);
  // Units
  for (const u of STATE.units) {
    if (u.hp <= 0) continue;
    ctx.fillStyle = u.side === 'player' ? '#0cf' : '#f48';
    const s = u.def.roleKey === 'mech' ? 4 : 2;
    ctx.fillRect(mx(u.x) - s/2, my(u.z) - s/2, s, s);
  }
  // Towers
  for (const t of STATE.towers) {
    if (t.hp <= 0) continue;
    ctx.fillStyle = t.side === 'player' ? '#08f' : '#f4a';
    const size = t.role === 'core' ? 6 : 3;
    ctx.fillRect(mx(t.x) - size/2, my(t.z) - size/2, size, size);
  }
  // Camera viewport
  if (camera) {
    const c = STATE.cam;
    const vw = 30 / (c.distance / 36), vh = 20 / (c.distance / 36);
    ctx.strokeStyle = 'rgba(255,0,200,0.85)'; ctx.lineWidth = 1.5;
    ctx.strokeRect(mx(c.targetX - vw/2), my(c.targetZ - vh/2), vw * sx, vh * sz);
  }
  ctx.strokeStyle = 'rgba(0,200,255,0.5)'; ctx.lineWidth = 1;
  ctx.strokeRect(0.5, 0.5, W - 1, H - 1);
}

// Card icons — sci-fi line art with neon glow
function cardIconSVG(key, size){
  const def = UNITS[key] || POWERS[key]; if (!def) return '';
  const fk = def.faction || 'nexus';
  const f = FACTIONS[fk] || FACTIONS.nexus;
  const main = '#' + f.color.toString(16).padStart(6,'0');
  const dark = '#' + f.dark.toString(16).padStart(6,'0');
  const neon = '#' + f.neon.toString(16).padStart(6,'0');
  const sa = size ? `width="${size}" height="${size}"` : 'width="100%" height="100%" preserveAspectRatio="xMidYMid meet"';
  const bp = `<defs><filter id="g${key.replace(/_/g,'')}"><feGaussianBlur stdDeviation="0.6"/></filter></defs><rect x="2" y="2" width="44" height="44" fill="${dark}" stroke="${neon}" stroke-width="0.8"/><polygon points="2,2 8,2 2,8" fill="${neon}"/><polygon points="46,46 40,46 46,40" fill="${neon}"/>`;
  let inner = '';
  const role = def.roleKey;
  if (POWERS[key]) {
    if (key.endsWith('_overload') || key === 'nexus_overload') inner = `<circle cx="24" cy="24" r="6" fill="none" stroke="${neon}" stroke-width="2"/><circle cx="24" cy="24" r="11" fill="none" stroke="${neon}" stroke-width="1.5" opacity="0.7"/><circle cx="24" cy="24" r="16" fill="none" stroke="${neon}" stroke-width="1" opacity="0.4"/>`;
    else if (key === 'nexus_shield' || key === 'aegis_aegis') inner = `<path d="M24 8 L36 14 L36 28 Q36 36 24 40 Q12 36 12 28 L12 14 Z" fill="none" stroke="${neon}" stroke-width="2"/>`;
    else if (key === 'nexus_drones' || key === 'aegis_artillery' || key === 'scrap_napalm') inner = `<path d="M8 24 L40 24 M16 18 L24 12 L32 18 M16 30 L24 36 L32 30" stroke="${neon}" stroke-width="2" fill="none"/>`;
    else if (key === 'scrap_warcry' || key === 'void_frenzy') inner = `<path d="M16 32 L24 12 L32 32 M19 26 L29 26" stroke="${neon}" stroke-width="2" fill="none"/>`;
    else if (key === 'scrap_swarm' || key === 'aegis_reinforce') inner = `<g fill="${main}"><circle cx="14" cy="22" r="3"/><circle cx="24" cy="18" r="3"/><circle cx="34" cy="22" r="3"/><rect x="11" y="25" width="6" height="9"/><rect x="21" y="21" width="6" height="13"/><rect x="31" y="25" width="6" height="9"/></g>`;
    else if (key === 'void_curse') inner = `<polygon points="24,8 30,18 40,20 32,28 34,40 24,34 14,40 16,28 8,20 18,18" fill="none" stroke="${neon}" stroke-width="2"/>`;
    else if (key === 'void_summon') inner = `<path d="M24 38 Q12 28 16 16 Q24 8 32 16 Q36 28 24 38 Z" fill="none" stroke="${neon}" stroke-width="2"/><circle cx="24" cy="22" r="3" fill="${neon}"/>`;
    else inner = `<text x="24" y="30" text-anchor="middle" font-family="Orbitron" font-weight="900" font-size="20" fill="${neon}">${def.name.charAt(0)}</text>`;
    return `<svg ${sa} viewBox="0 0 48 48">${bp}${inner}</svg>`;
  }
  // Unit icons — sci-fi silhouettes
  if (role === 'trooper') inner = `<circle cx="24" cy="14" r="5" fill="${main}"/><rect x="20" y="19" width="8" height="14" fill="${main}"/><rect x="28" y="22" width="14" height="2.5" fill="${neon}"/><rect x="20" y="33" width="3" height="10" fill="${main}"/><rect x="25" y="33" width="3" height="10" fill="${main}"/>`;
  else if (role === 'heavy') inner = `<circle cx="24" cy="13" r="6" fill="${main}"/><rect x="16" y="19" width="16" height="18" fill="${main}"/><rect x="32" y="24" width="14" height="6" fill="${neon}"/><rect x="18" y="37" width="4" height="7" fill="${main}"/><rect x="26" y="37" width="4" height="7" fill="${main}"/>`;
  else if (role === 'sniper') inner = `<circle cx="22" cy="13" r="5" fill="${main}"/><rect x="18" y="18" width="8" height="13" fill="${main}"/><rect x="25" y="20" width="20" height="2" fill="${neon}"/><circle cx="29" cy="21" r="2" fill="${neon}"/><rect x="18" y="31" width="3" height="10" fill="${main}"/><rect x="23" y="31" width="3" height="10" fill="${main}"/>`;
  else if (role === 'assault') inner = `<circle cx="24" cy="14" r="5" fill="${main}"/><polygon points="18,18 30,18 32,32 16,32" fill="${main}"/><polygon points="14,20 18,18 18,28 14,30" fill="${neon}"/><polygon points="34,20 30,18 30,28 34,30" fill="${neon}"/><rect x="20" y="32" width="3" height="10" fill="${main}"/><rect x="25" y="32" width="3" height="10" fill="${main}"/>`;
  else if (role === 'mech') inner = `<rect x="14" y="14" width="20" height="14" fill="${main}"/><circle cx="24" cy="18" r="2.5" fill="${neon}"/><rect x="6" y="18" width="6" height="3" fill="${main}"/><rect x="36" y="18" width="6" height="3" fill="${main}"/><circle cx="6" cy="20" r="2" fill="${neon}"/><circle cx="42" cy="20" r="2" fill="${neon}"/><rect x="16" y="28" width="5" height="14" fill="${main}"/><rect x="27" y="28" width="5" height="14" fill="${main}"/><rect x="14" y="42" width="9" height="3" fill="${main}"/><rect x="25" y="42" width="9" height="3" fill="${main}"/>`;
  else if (role === 'drone') inner = `<ellipse cx="24" cy="24" rx="12" ry="6" fill="${main}"/><circle cx="24" cy="24" r="4" fill="${neon}"/><rect x="8" y="22" width="32" height="2" fill="${main}"/><circle cx="8" cy="23" r="2" fill="${neon}"/><circle cx="40" cy="23" r="2" fill="${neon}"/>`;
  else inner = `<circle cx="24" cy="24" r="14" fill="${main}"/>`;
  return `<svg ${sa} viewBox="0 0 48 48">${bp}${inner}</svg>`;
}

function factionEmblemSVG(fk, size){
  const f = FACTIONS[fk] || FACTIONS.nexus;
  const main = '#' + f.color.toString(16).padStart(6,'0');
  const neon = '#' + f.neon.toString(16).padStart(6,'0');
  const s = size || 56;
  let inner = '';
  if (fk === 'nexus') {
    inner = `<polygon points="32,4 56,32 32,60 8,32" fill="none" stroke="${main}" stroke-width="3"/><polygon points="32,16 48,32 32,48 16,32" fill="${main}"/><circle cx="32" cy="32" r="4" fill="${neon}"/>`;
  } else if (fk === 'scrapyard') {
    inner = `<polygon points="8,18 56,18 50,46 14,46" fill="none" stroke="${main}" stroke-width="3"/><path d="M16 18 L24 8 L40 8 L48 18 M20 28 L44 28 M20 38 L44 38" stroke="${neon}" stroke-width="2" fill="none"/>`;
  } else if (fk === 'aegis') {
    inner = `<path d="M32 4 L52 14 L52 36 Q52 50 32 60 Q12 50 12 36 L12 14 Z" fill="none" stroke="${main}" stroke-width="3"/><path d="M32 14 L44 20 L44 36 Q44 44 32 50 Q20 44 20 36 L20 20 Z" fill="${main}" opacity="0.4"/><path d="M22 30 L30 38 L42 22" stroke="${neon}" stroke-width="3" fill="none"/>`;
  } else {
    inner = `<polygon points="32,8 50,28 44,52 20,52 14,28" fill="none" stroke="${main}" stroke-width="3"/><circle cx="32" cy="32" r="10" fill="${main}" opacity="0.5"/><circle cx="32" cy="32" r="4" fill="${neon}"/><line x1="32" y1="14" x2="32" y2="22" stroke="${neon}" stroke-width="2"/><line x1="32" y1="42" x2="32" y2="50" stroke="${neon}" stroke-width="2"/><line x1="14" y1="32" x2="22" y2="32" stroke="${neon}" stroke-width="2"/><line x1="42" y1="32" x2="50" y2="32" stroke="${neon}" stroke-width="2"/>`;
  }
  return `<svg width="${s}" height="${s}" viewBox="0 0 64 64">${inner}</svg>`;
}

// =========================================================================
// MATCH LIFECYCLE
// =========================================================================
function startMatch(mission){
  STATE.currentMission = mission;
  STATE.matchId = (STATE.matchId || 0) + 1;
  STATE.matchEnded = false;
  STATE.running = true; STATE.paused = false;
  STATE.timer = 180; STATE.overtime = false; STATE.energyMul = 1;
  STATE.selectedCard = null; STATE.lastTime = 0;
  applyPreset(0);
  const diff = DIFFICULTY[STATE.progress.difficulty || 'normal'] || DIFFICULTY.normal;
  STATE.difficulty = STATE.progress.difficulty || 'normal';
  STATE.energy = 5 + (diff.playerStartEnergyBonus || 0);
  STATE.enemyEnergy = diff.enemyStartEnergy || 5;
  // Pick map
  STATE.mapKey = mission.mapKey || STATE.progress.mapKey || 'grid';
  clearBattle();
  createTowers();
  normalizeDeck();
  const fk = STATE.progress.playerFaction;
  const pDeck = [...(STATE.progress.decks[fk]||[])];
  shuffleArray(pDeck);
  STATE.handSlots = pDeck.slice(0, HAND_SIZE);
  STATE.deckQueue = pDeck.slice(HAND_SIZE);
  // Enemy AI deck
  const efk = mission.enemyFaction;
  const eUnits = Object.keys(ROLES).map(r => efk + '_' + r);
  STATE.enemyHand = eUnits.slice(0, 4);
  STATE.enemyHandPool = eUnits.slice(4);
  STATE.enemyCooldowns = {};
  switchScreen('gameScreen');
  document.getElementById('camHint').style.display = 'block';
  STATE.cam.orbiting = false;
  const ob = document.getElementById('camOrbit'); if (ob) ob.classList.remove('on');
  const hg = document.getElementById('hudGrid'); if (hg) hg.classList.add('active');
  renderHand(); updateHUD(); updateTowerPips();
  setTimeout(() => showToast(MAPS[STATE.mapKey].name + ' • ' + FACTIONS[fk].name + ' VS ' + FACTIONS[efk].name), 250);
  requestAnimationFrame(() => {
    resizeThree(); applyCamera();
    requestAnimationFrame(() => { resizeThree(); applyCamera(); });
  });
  requestAnimationFrame(loop);
}
function endMatch(victory){
  if (!STATE.running && STATE.matchEnded) return;
  STATE.matchEnded = true;
  STATE.running = false; STATE.paused = false;
  STATE.matchId = (STATE.matchId || 0) + 1;
  const pm = STATE.currentMission;
  if (victory && pm) {
    if (!STATE.progress.completed.includes(pm.id)) {
      STATE.progress.completed.push(pm.id);
      const r = MISSION_REWARDS[pm.id] || [];
      for (const p of r) if (!STATE.progress.unlockedPowers.includes(p)) STATE.progress.unlockedPowers.push(p);
      saveProgress();
    }
    playSound('win');
  } else playSound('lose');
  document.getElementById('endTitle').textContent = victory ? 'VICTORY' : 'DEFEAT';
  document.getElementById('endTitle').className = 'end-title ' + (victory ? 'victory' : 'defeat');
  document.getElementById('endSubtitle').textContent = victory ? 'OPERATION COMPLETE' : 'OPERATION FAILED';
  const s = STATE.stats;
  const eff = s.dmgDealt > 0 ? ((s.dmgDealt / Math.max(1, s.dmgDealt + s.dmgTaken)) * 100).toFixed(0) : '0';
  document.getElementById('endStats').innerHTML = `
    <div><span>KILLS</span><span>${s.kills}</span></div>
    <div><span>UNITS DEPLOYED</span><span>${s.deployed}</span></div>
    <div><span>UNITS LOST</span><span>${s.allyDeaths}</span></div>
    <div><span>DAMAGE DEALT</span><span>${Math.round(s.dmgDealt)}</span></div>
    <div><span>DAMAGE TAKEN</span><span>${Math.round(s.dmgTaken)}</span></div>
    <div><span>EFFICIENCY</span><span>${eff}%</span></div>`;
  switchScreen('endScreen');
}

// =========================================================================
// SCREENS
// =========================================================================
function switchScreen(id){ document.querySelectorAll('.screen').forEach(s => s.classList.remove('active')); document.getElementById(id).classList.add('active'); }
function goTitle(){
  STATE.running = false;
  const fk = STATE.progress.playerFaction;
  const cf = document.getElementById('currentFaction');
  cf.textContent = FACTIONS[fk].name + ' // ' + FACTIONS[fk].tag;
  cf.className = 'current-faction ' + fk;
  switchScreen('titleScreen'); playSound('ui_click');
}
function goCampaign(){ renderMissionList(); switchScreen('campaignScreen'); playSound('ui_click'); }
function goArmory(){ STATE.armoryTab = 'units'; renderArmory(); switchScreen('armoryScreen'); playSound('ui_click'); }
function goFactions(){ renderFactionList(); switchScreen('factionScreen'); playSound('ui_click'); }
function goSettings(){ renderSettings(); switchScreen('settingsScreen'); playSound('ui_click'); }
function switchTab(t){ STATE.armoryTab = t; document.getElementById('tabUnits').classList.toggle('active', t==='units'); document.getElementById('tabPowers').classList.toggle('active', t==='powers'); renderArmory(); }
function pauseGame(){ STATE.paused = true; document.getElementById('pauseMenu').classList.add('active'); playSound('ui_click'); }
function resumeGame(){ STATE.paused = false; STATE.lastTime = 0; document.getElementById('pauseMenu').classList.remove('active'); playSound('ui_click'); }
function surrenderMatch(){ document.getElementById('pauseMenu').classList.remove('active'); endMatch(false); }
function quitToMenu(){ document.getElementById('pauseMenu').classList.remove('active'); STATE.running = false; STATE.paused = false; goTitle(); }
function showBriefing(m){
  STATE.pendingMission = m;
  document.getElementById('briefTitle').textContent = 'OPERATION ' + m.id + ' — ' + m.name;
  document.getElementById('briefText').textContent = m.desc;
  const fk = STATE.progress.playerFaction;
  document.getElementById('briefFaction').textContent = FACTIONS[fk].name;
  document.getElementById('briefEnemy').textContent = m.enemy;
  document.getElementById('briefMap').textContent = MAPS[STATE.progress.mapKey || 'grid'].name;
  renderDifficultyPicker();
  switchScreen('briefingScreen');
}
function renderDifficultyPicker(){
  const el = document.getElementById('diffPicker'); el.innerHTML = '';
  const cur = STATE.progress.difficulty || 'normal';
  for (const k of Object.keys(DIFFICULTY)) {
    const d = DIFFICULTY[k];
    const c = document.createElement('div');
    c.className = 'picker-tile' + (cur === k ? ' selected' : '');
    c.style.padding = '6px 4px';
    c.innerHTML = `<div class="pt-name" style="font-size:10px">${d.name}</div>`;
    c.onclick = () => { STATE.progress.difficulty = k; saveProgress(); renderDifficultyPicker(); playSound('ui_select'); };
    el.appendChild(c);
  }
}
function startBriefedMission(){
  if (!STATE.pendingMission) return;
  startMatch(STATE.pendingMission);
  STATE.pendingMission = null;
}
function quickSkirmish(){
  const efk = ['nexus','scrapyard','aegis','void'].filter(f => f !== STATE.progress.playerFaction)[0];
  startMatch({ id:0, name:'Skirmish', desc:'Open battle', enemy:'Hostiles', enemyFaction:efk, aiSpeed:0.85, aiSmart:0.65, enemyHpMul:1 });
}
function dailyBattle(){
  const efk = ['nexus','scrapyard','aegis','void'].filter(f => f !== STATE.progress.playerFaction)[0];
  // Roll map+enemy from date seed
  const d = new Date();
  const seed = (d.getFullYear() * 10000 + (d.getMonth()+1) * 100 + d.getDate()) >>> 0;
  const maps = Object.keys(MAPS);
  const mk = maps[seed % maps.length];
  startMatch({ id:0, name:'Daily Operation', desc:'Daily seed', enemy:'Daily Foe', enemyFaction:efk, aiSpeed:0.95, aiSmart:0.75, enemyHpMul:1.05, mapKey:mk });
}
function showHowTo(){
  alert(
    'NEON FRONT v10\n\n' +
    'OBJECTIVE: Destroy the enemy CORE.\n' +
    'CORE has 6500 HP. It does not return fire.\n' +
    'Break a forward TURRET first to expose the lane.\n\n' +
    'CONTROLS:\n' +
    '• Drag to orbit camera • WASD to pan • Scroll to zoom\n' +
    '• Tap card → tap your zone to deploy\n' +
    '• Tap a deployed unit → use its ABILITY (cooldown shown)\n' +
    '• Q/E for camera height • R reset • C cycle preset\n\n' +
    'FACTIONS (each with different stats):\n' +
    '• NEXUS    +10% HP +5% range — corporate / drones\n' +
    '• SCRAPYARD +15% speed +5% dmg — fast aggression\n' +
    '• AEGIS    +18% HP -8% speed — durable line\n' +
    '• VOID     +20% range -8% HP — long reach\n\n' +
    'COUNTERS:\n' +
    '• AA / SNIPERS shred AIR (Drones)\n' +
    '• MECH dominates ground but takes 0 dmg from AIR\n' +
    '• ASSAULT counters SNIPERS, dies to HEAVY\n'
  );
}

function renderFactionList(){
  const list = document.getElementById('factionList'); list.innerHTML = '';
  for (const fk of Object.keys(FACTIONS)) {
    const f = FACTIONS[fk];
    const sel = STATE.progress.playerFaction === fk;
    const card = document.createElement('div');
    card.className = 'faction-card ' + fk + (sel ? ' selected' : '');
    const stats = [];
    if (f.mod.hp !== 1) stats.push((f.mod.hp > 1 ? '+' : '') + Math.round((f.mod.hp - 1) * 100) + '% HP');
    if (f.mod.dmg !== 1) stats.push((f.mod.dmg > 1 ? '+' : '') + Math.round((f.mod.dmg - 1) * 100) + '% DMG');
    if (f.mod.speed !== 1) stats.push((f.mod.speed > 1 ? '+' : '') + Math.round((f.mod.speed - 1) * 100) + '% SPD');
    if (f.mod.range !== 1) stats.push((f.mod.range > 1 ? '+' : '') + Math.round((f.mod.range - 1) * 100) + '% RNG');
    card.innerHTML = `<div class="faction-icon">${factionEmblemSVG(fk, 60)}</div><div class="faction-info"><div class="faction-name">${f.name}</div><div class="faction-tagline">${f.tag} — ${f.desc}</div><div class="faction-stats">${stats.join('  ·  ')}</div></div>`;
    card.onclick = () => selectFaction(fk);
    list.appendChild(card);
  }
}
function selectFaction(fk){ STATE.progress.playerFaction = fk; saveProgress(); normalizeDeck(); playSound('ui_select'); goTitle(); }
function renderMissionList(){
  const list = document.getElementById('missionList'); list.innerHTML = '';
  const done = STATE.progress.completed;
  for (let i = 0; i < MISSIONS.length; i++) {
    const m = MISSIONS[i];
    const lock = i > 0 && !done.includes(MISSIONS[i-1].id);
    const dn = done.includes(m.id);
    const card = document.createElement('div');
    card.className = 'mission-card' + (lock ? ' locked' : '') + (dn ? ' completed' : '');
    card.innerHTML = `<div class="mission-num">${String(m.id).padStart(2,'0')}</div><div class="mission-info"><div class="mission-name">${m.name}</div><div class="mission-desc">${m.desc}</div>${dn?'<div class="mission-status">✓ COMPLETE</div>':''}</div>`;
    if (!lock) card.onclick = () => showBriefing(m);
    list.appendChild(card);
  }
}
function renderArmory(){
  const grid = document.getElementById('armoryGrid');
  const dr = document.getElementById('deckInfoRow');
  const note = document.getElementById('armoryNote');
  grid.innerHTML = '';
  dr.style.display = 'flex';
  const fk = STATE.progress.playerFaction;
  const deck = STATE.progress.decks[fk] || [];
  const uc = deck.filter(k => UNITS[k]).length;
  const pc = deck.filter(k => POWERS[k]).length;
  const dc = document.getElementById('deckCount');
  if (STATE.armoryTab === 'units') {
    dc.textContent = uc + ' / ' + DECK_UNIT_MAX;
    dc.classList.toggle('full', uc === DECK_UNIT_MAX);
    note.textContent = `Pick ${DECK_UNIT_MIN}-${DECK_UNIT_MAX} units from ${FACTIONS[fk].name} arsenal.`;
    for (const r of Object.keys(ROLES)) {
      const k = fk + '_' + r;
      const def = UNITS[k];
      const inDeck = deck.includes(k);
      const card = document.createElement('div');
      card.className = 'unit-card-lg' + (inDeck ? ' selected' : '');
      card.innerHTML = `<div class="cost-badge">${def.cost}</div>${inDeck?'<div class="check-badge">✓</div>':''}<div class="icon-wrap">${cardIconSVG(k, 48)}</div><div class="info-wrap"><div class="unit-name">${def.name}</div><div class="unit-role">${def.role}</div><div class="unit-desc">${def.desc}</div></div>`;
      card.onclick = () => toggleDeckCard(k);
      grid.appendChild(card);
    }
  } else {
    dc.textContent = pc + ' / ' + DECK_POWER_MAX;
    dc.classList.toggle('full', pc === DECK_POWER_MAX);
    note.textContent = `Pick up to ${DECK_POWER_MAX} powers.`;
    for (const pk of FACTIONS[fk].powers) {
      const p = POWERS[pk]; if (!p) continue;
      const inDeck = deck.includes(pk);
      const card = document.createElement('div');
      card.className = 'unit-card-lg' + (inDeck ? ' selected' : '');
      card.innerHTML = `<div class="cost-badge">${p.cost}</div>${inDeck?'<div class="check-badge">✓</div>':''}<div class="icon-wrap">${cardIconSVG(pk, 48)}</div><div class="info-wrap"><div class="unit-name">${p.name}</div><div class="unit-role">POWER</div><div class="unit-desc">${p.desc}</div></div>`;
      card.onclick = () => toggleDeckCard(pk);
      grid.appendChild(card);
    }
  }
}
function toggleDeckCard(k){
  const fk = STATE.progress.playerFaction;
  const d = STATE.progress.decks[fk] || [];
  const isP = !!POWERS[k];
  const i = d.indexOf(k);
  const uc = d.filter(x => UNITS[x]).length;
  const pc = d.filter(x => POWERS[x]).length;
  if (i >= 0) {
    if (isP && pc <= DECK_POWER_MIN) { showToast('NEED ≥' + DECK_POWER_MIN + ' POWER'); return; }
    if (!isP && uc <= DECK_UNIT_MIN) { showToast('NEED ≥' + DECK_UNIT_MIN + ' UNITS'); return; }
    d.splice(i, 1); playSound('ui_click');
  } else {
    if (isP && pc >= DECK_POWER_MAX) { showToast('MAX ' + DECK_POWER_MAX + ' POWERS'); return; }
    if (!isP && uc >= DECK_UNIT_MAX) { showToast('MAX ' + DECK_UNIT_MAX + ' UNITS'); return; }
    d.push(k); playSound('ui_select');
  }
  STATE.progress.decks[fk] = d;
  saveProgress(); renderArmory();
}
function renderSettings(){
  // Map
  const mp = document.getElementById('mapPicker'); mp.innerHTML = '';
  const cm = STATE.progress.mapKey || 'grid';
  for (const k of Object.keys(MAPS)) {
    const m = MAPS[k];
    const c = document.createElement('div');
    c.className = 'picker-tile' + (cm === k ? ' selected' : '');
    c.innerHTML = `<div class="pt-name">${m.name}</div><div class="pt-stats">${m.desc}</div>`;
    c.onclick = () => { STATE.progress.mapKey = k; saveProgress(); renderSettings(); playSound('ui_select'); };
    mp.appendChild(c);
  }
  // Quality
  const qp = document.getElementById('qualityPicker'); qp.innerHTML = '';
  const cq = STATE.progress.quality || 'medium';
  for (const k of Object.keys(QUALITY)) {
    const lvl = QUALITY[k];
    const c = document.createElement('div');
    c.className = 'picker-tile' + (cq === k ? ' selected' : '');
    c.innerHTML = `<div class="pt-name">${lvl.name}</div><div class="pt-stats">SHADOW ${lvl.shadowMap}<br>FX ${Math.round(lvl.particleMul*100)}%</div>`;
    c.onclick = () => { STATE.progress.quality = k; saveProgress(); playSound('ui_select'); showToast('QUALITY: ' + lvl.name + ' — RELOAD'); setTimeout(() => location.reload(), 600); };
    qp.appendChild(c);
  }
}
function resetProgressConfirm(){
  if (!confirm('RESET ALL PROGRESS?\nThis clears completed missions and decks.')) return;
  const q = STATE.progress.quality, mk = STATE.progress.mapKey;
  STATE.progress = { completed:[], unlockedPowers:[], playerFaction:'nexus', decks:{}, mapKey:mk, quality:q, difficulty:'normal' };
  saveProgress();
  normalizeDeck();
  showToast('PROGRESS WIPED');
}

// =========================================================================
// BOOT
// =========================================================================
function bootGame(){
  STATE.progress = loadProgress();
  // Always unlock all powers (no friction)
  const all = new Set(STATE.progress.unlockedPowers||[]);
  for (const fk of Object.keys(FACTIONS)) for (const p of FACTIONS[fk].powers) all.add(p);
  STATE.progress.unlockedPowers = Array.from(all);
  // Auto-complete missions for testing/quick play
  for (const m of MISSIONS) if (!STATE.progress.completed.includes(m.id)) STATE.progress.completed.push(m.id);
  saveProgress();
  normalizeDeck();
  try { initThree(); }
  catch (e) {
    console.error('initThree failed:', e);
    const ls = document.getElementById('loadingScreen');
    if (ls) { ls.classList.add('active'); ls.textContent = '3D INIT FAILED: ' + (e.message||'unknown'); }
    return;
  }
  setupInput();
  goTitle();
  document.getElementById('loadingScreen').classList.remove('active');
}
if (window.__threeLoaded) bootGame();
else window.addEventListener('three-ready', bootGame);

// =========================================================================
// EXPORTS
// =========================================================================
window.goTitle = goTitle;
window.goCampaign = goCampaign;
window.goArmory = goArmory;
window.goFactions = goFactions;
window.goSettings = goSettings;
window.switchTab = switchTab;
window.pauseGame = pauseGame;
window.resumeGame = resumeGame;
window.surrenderMatch = surrenderMatch;
window.quitToMenu = quitToMenu;
window.startBriefedMission = startBriefedMission;
window.quickSkirmish = quickSkirmish;
window.dailyBattle = dailyBattle;
window.showHowTo = showHowTo;
window.resetCamera = resetCamera;
window.toggleOrbitMode = toggleOrbitMode;
window.adjustCamHeight = adjustCamHeight;
window.adjustCamZoom = adjustCamZoom;
window.cycleCamPreset = cycleCamPreset;
window.selectFaction = selectFaction;
window.resetProgressConfirm = resetProgressConfirm;
window.fireUnitAbility = fireUnitAbility;
window.selectUnit = selectUnit;
