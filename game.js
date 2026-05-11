// =========================================================================
// ARCANA RUNG v11 — fantasy painted auto-battler
// 20 unique heroes, each with signature mana-fired ability.
// Place, fight, upgrade, climb. No lanes. No deploy-spam.
// =========================================================================
'use strict';

// ── BOARD GEOMETRY ─────────────────────────────────────────────────────
// Square grid (simpler than hex for visual clarity in 3D).
// 6 cols × 6 rows, split: rows 0-2 = enemy, rows 3-5 = player.
const COLS = 6, ROWS = 6, PLAYER_ROW_MIN = 3;
const CELL_SIZE = 1.6;
const BOARD_W = COLS * CELL_SIZE;
const BOARD_D = ROWS * CELL_SIZE;

// ── ORIGINS (horizontal synergies) ─────────────────────────────────────
const ORIGINS = {
  human:  { name:'HUMAN',   color:0xf0d4a0, glow:0xfff0c8, desc:'Disciplined, balanced.',
            bonuses:[{n:2,label:'+10% ALL STATS',apply:t=>{t.hpMul*=1.10;t.dmgMul*=1.10}},
                     {n:4,label:'+25% ALL STATS',apply:t=>{t.hpMul*=1.25;t.dmgMul*=1.25}}] },
  elf:    { name:'ELF',     color:0xa0e8c0, glow:0xc8ffd0, desc:'Swift, mana-gifted.',
            bonuses:[{n:2,label:'+1 MANA PER HIT',apply:t=>{t.manaPerHit+=1}},
                     {n:3,label:'+25% ATK SPEED',apply:t=>{t.atkSpeedMul*=1.25}}] },
  undead: { name:'UNDEAD',  color:0xa890c8, glow:0xc8a8e8, desc:'Lifesteal, corpses rise.',
            bonuses:[{n:2,label:'LIFESTEAL 15%',apply:t=>{t.lifesteal+=0.15}},
                     {n:3,label:'LIFESTEAL 30% + RISE',apply:t=>{t.lifesteal+=0.30;t.corpseRise=true}}] },
  dragon: { name:'DRAGON',  color:0xf08070, glow:0xffa090, desc:'Powerful, cheap spells.',
            bonuses:[{n:2,label:'-30% MANA COST',apply:t=>{t.manaCostMul=0.70}},
                     {n:3,label:'-50% MANA COST',apply:t=>{t.manaCostMul=0.50}}] },
  orc:    { name:'ORC',     color:0xa08038, glow:0xc8a040, desc:'Brutal, hits hard.',
            bonuses:[{n:2,label:'+20% DAMAGE',apply:t=>{t.dmgMul*=1.20}},
                     {n:4,label:'+50% DAMAGE + 25% LIFESTEAL',apply:t=>{t.dmgMul*=1.50;t.lifesteal+=0.25}}] },
};

// ── CLASSES (vertical synergies) ───────────────────────────────────────
const CLASSES = {
  warrior: { name:'WARRIOR', color:0xd06040, glow:0xff8050, desc:'Frontline melee.',
             bonuses:[{n:2,label:'+30 ARMOR',apply:t=>{t.armorBonus+=30}},
                      {n:4,label:'+60 ARMOR + REGEN',apply:t=>{t.armorBonus+=60;t.regen+=10}}] },
  mage:    { name:'MAGE',    color:0x6080f0, glow:0x90b0ff, desc:'Spell damage.',
             bonuses:[{n:2,label:'+30% SPELL DMG',apply:t=>{t.spellMul*=1.30}},
                      {n:4,label:'+70% SPELL DMG',apply:t=>{t.spellMul*=1.70}}] },
  ranger:  { name:'RANGER',  color:0x60c860, glow:0x90f090, desc:'Ranged precision.',
             bonuses:[{n:2,label:'+30% ATK SPEED (RANGED)',apply:t=>{t.rangerSpeedBonus=0.30}},
                      {n:4,label:'+60% ATK SPEED (RANGED)',apply:t=>{t.rangerSpeedBonus=0.60}}] },
  healer:  { name:'HEALER',  color:0xf0f0c0, glow:0xffffd0, desc:'Sustain allies.',
             bonuses:[{n:2,label:'HEAL 25/s TO LOW ALLY',apply:t=>{t.healPulse=25}},
                      {n:3,label:'HEAL 60/s TO LOW ALLY',apply:t=>{t.healPulse=60}}] },
  assassin:{ name:'ASSASSIN',color:0xa040a0, glow:0xd060d0, desc:'Burst damage.',
             bonuses:[{n:2,label:'+50% CRIT DMG',apply:t=>{t.critDmgBonus=0.50}},
                      {n:3,label:'+50% CRIT DMG, ATTACKS CRIT 30%',apply:t=>{t.critDmgBonus=0.50;t.critChance=0.30}}] },
  guardian:{ name:'GUARDIAN',color:0xc0a040, glow:0xf0c860, desc:'Tank protector.',
             bonuses:[{n:2,label:'+40 ARMOR TO ALL',apply:t=>{t.teamArmor+=40}}] },
};

// ── HEROES — 20 UNIQUE characters with signature abilities ─────────────
// Each ability fires when mana reaches 100. Mana accrues from being hit
// (+10) and from attacking (+5 base, +1 if Elf bonus active).
// Stats are base; class/origin/level bonuses applied at combat start.
const HEROES = {
  // ── TIER 1 (cost 1) — 6 units ─────────────────────────────────────
  recruit:    { name:'RECRUIT',     tier:1, origin:'human',  class:'warrior',
                hp:600,  dmg:50, range:1, atkSpeed:0.85, armor:30, mana:0, manaMax:60,
                ability:{ name:'SHIELD BASH', desc:'Stuns target 2s and gains 50 armor.', kind:'stunSelfArmor', stun:2, armor:50 } },
  scout:      { name:'SCOUT',       tier:1, origin:'elf',    class:'ranger',
                hp:450,  dmg:55, range:4, atkSpeed:0.55, armor:10, mana:0, manaMax:80,
                ability:{ name:'PRECISION',   desc:'Next 3 shots deal +120 bonus dmg each.', kind:'buffShots', shots:3, bonus:120 } },
  apprentice: { name:'APPRENTICE',  tier:1, origin:'human',  class:'mage',
                hp:400,  dmg:30, range:4, atkSpeed:0.65, armor:5,  mana:0, manaMax:80,
                ability:{ name:'ARCANE BOLT', desc:'250 spell dmg to current target.', kind:'spellSingle', dmg:250 } },
  acolyte:    { name:'ACOLYTE',     tier:1, origin:'human',  class:'healer',
                hp:500,  dmg:30, range:3, atkSpeed:0.75, armor:10, mana:0, manaMax:60,
                ability:{ name:'BLESSING',    desc:'Heal lowest-HP ally for 350.', kind:'healAlly', heal:350 } },
  ghoul:      { name:'GHOUL',       tier:1, origin:'undead', class:'assassin',
                hp:500,  dmg:60, range:1, atkSpeed:0.75, armor:15, mana:0, manaMax:50,
                ability:{ name:'FERAL LUNGE', desc:'Leap to enemy backline, 200 dmg.', kind:'lunge', dmg:200 } },
  grunt:      { name:'GRUNT',       tier:1, origin:'orc',    class:'warrior',
                hp:650,  dmg:55, range:1, atkSpeed:0.80, armor:25, mana:0, manaMax:70,
                ability:{ name:'BLOOD ROAR',  desc:'+60% damage for 4s.', kind:'enrageSelf', mul:1.60, dur:4 } },

  // ── TIER 2 (cost 2) — 5 units ─────────────────────────────────────
  knight:     { name:'KNIGHT',      tier:2, origin:'human',  class:'guardian',
                hp:900,  dmg:60, range:1, atkSpeed:0.75, armor:60, mana:0, manaMax:70,
                ability:{ name:'BULWARK',     desc:'Taunt all enemies in 3-tile range to attack me, +80 armor 5s.', kind:'taunt', dur:5, armor:80 } },
  pyromancer: { name:'PYROMANCER',  tier:2, origin:'dragon', class:'mage',
                hp:550,  dmg:35, range:4, atkSpeed:0.55, armor:5,  mana:0, manaMax:90,
                ability:{ name:'FIREBALL',    desc:'350 dmg in 1.5-tile splash at target.', kind:'spellAoe', dmg:350, radius:1.5 } },
  archer:     { name:'ARCHER',      tier:2, origin:'elf',    class:'ranger',
                hp:550,  dmg:80, range:4, atkSpeed:0.45, armor:15, mana:0, manaMax:80,
                ability:{ name:'RAIN OF ARROWS', desc:'7 arrows hit random enemies for 100 each.', kind:'multiArrow', count:7, dmg:100 } },
  necromancer:{ name:'NECROMANCER', tier:2, origin:'undead', class:'mage',
                hp:600,  dmg:35, range:4, atkSpeed:0.50, armor:10, mana:0, manaMax:100,
                ability:{ name:'RAISE DEAD',  desc:'Summon a Ghoul (450 HP) on adjacent free tile.', kind:'summon', summonKey:'ghoul' } },
  shaman:     { name:'SHAMAN',      tier:2, origin:'orc',    class:'healer',
                hp:650,  dmg:45, range:3, atkSpeed:0.55, armor:20, mana:0, manaMax:80,
                ability:{ name:'TOTEM',       desc:'Plant totem (700 HP) that heals allies 25/s in 2-tile range.', kind:'totem', hp:700, healPerSec:25, radius:2 } },

  // ── TIER 3 (cost 3) — 4 units ─────────────────────────────────────
  paladin:    { name:'PALADIN',     tier:3, origin:'human',  class:'guardian',
                hp:1100, dmg:75, range:1, atkSpeed:0.75, armor:80, mana:0, manaMax:80,
                ability:{ name:'DIVINE WARD', desc:'Grants 400 HP shield to all allies in 2-tile range.', kind:'shieldAura', shield:400, radius:2 } },
  drakeRider: { name:'DRAKE RIDER', tier:3, origin:'dragon', class:'ranger',
                hp:800,  dmg:90, range:4, atkSpeed:0.50, armor:25, mana:0, manaMax:80,
                ability:{ name:'FIRE BREATH', desc:'Cone of fire: 300 dmg to all enemies in front 3 tiles.', kind:'cone', dmg:300, range:3, width:1.5 } },
  shadow:     { name:'SHADOW',      tier:3, origin:'elf',    class:'assassin',
                hp:650,  dmg:130, range:1, atkSpeed:0.55, armor:15, mana:0, manaMax:70,
                ability:{ name:'SHADOWSTRIKE', desc:'Teleport behind highest-cost enemy, 600 single-target dmg.', kind:'teleStrike', dmg:600 } },
  warlord:    { name:'WARLORD',     tier:3, origin:'orc',    class:'warrior',
                hp:1200, dmg:90, range:1, atkSpeed:0.70, armor:50, mana:0, manaMax:90,
                ability:{ name:'BATTLE CRY',  desc:'All allies gain +40% dmg for 6s.', kind:'buffAllies', mul:1.40, dur:6 } },

  // ── TIER 4 (cost 4) — 3 units ─────────────────────────────────────
  lich:       { name:'LICH',        tier:4, origin:'undead', class:'mage',
                hp:800,  dmg:50, range:4, atkSpeed:0.45, armor:15, mana:0, manaMax:100,
                ability:{ name:'DEATH NOVA',  desc:'500 dmg to ALL enemies + raise 1 Ghoul per killed unit.', kind:'nova', dmg:500 } },
  druid:      { name:'DRUID',       tier:4, origin:'elf',    class:'healer',
                hp:900,  dmg:55, range:3, atkSpeed:0.55, armor:20, mana:0, manaMax:90,
                ability:{ name:'NATURE\'S BOND', desc:'Heal all allies for 350 + cleanse stuns.', kind:'healAll', heal:350 } },
  flameLord:  { name:'FLAME LORD',  tier:4, origin:'dragon', class:'warrior',
                hp:1400, dmg:110, range:1, atkSpeed:0.70, armor:60, mana:0, manaMax:80,
                ability:{ name:'IMMOLATE',    desc:'Burning aura: 80 dmg/s to adjacent enemies for 6s.', kind:'aura', dmg:80, dur:6, radius:1.5 } },

  // ── TIER 5 (cost 5) — 2 LEGENDARY units ───────────────────────────
  dragonLord: { name:'DRAGON LORD', tier:5, origin:'dragon', class:'guardian',
                hp:2000, dmg:150, range:2, atkSpeed:0.65, armor:90, mana:0, manaMax:100,
                ability:{ name:'DOOM ROAR',   desc:'1200 dmg in 3-tile splash. Knockback enemies.', kind:'spellAoe', dmg:1200, radius:3 } },
  archlich:   { name:'ARCHLICH',    tier:5, origin:'undead', class:'mage',
                hp:1100, dmg:80, range:5, atkSpeed:0.45, armor:25, mana:0, manaMax:120,
                ability:{ name:'SOULREND',    desc:'700 dmg to 3 highest-HP enemies. Each kill heals 500.', kind:'soulrend', dmg:700, count:3, heal:500 } },
};
// Total: 6+5+4+3+2 = 20 unique heroes

// Cost by tier
const TIER_COST = { 1:1, 2:2, 3:3, 4:4, 5:5 };
// Shop odds by player level
const SHOP_ODDS = {
  1:[1.00, 0,    0,    0,    0],
  2:[0.70, 0.30, 0,    0,    0],
  3:[0.55, 0.30, 0.15, 0,    0],
  4:[0.40, 0.35, 0.20, 0.05, 0],
  5:[0.20, 0.35, 0.30, 0.13, 0.02],
  6:[0.10, 0.30, 0.35, 0.20, 0.05],
  7:[0.05, 0.20, 0.35, 0.30, 0.10],
  8:[0.00, 0.10, 0.25, 0.40, 0.25],
};
const XP_TO_LEVEL = [0, 2, 6, 10, 20, 36, 56, 80];   // index = current level
const LEVEL_BOARD_CAP = [0, 3, 4, 5, 6, 7, 8, 9];    // index = level → max board units

// ── STATE ──────────────────────────────────────────────────────────────
const STATE = {
  running:false, paused:false,
  phase:'shop',      // 'shop' | 'combat' | 'result' | 'end'
  round:1,
  hp:100, gold:4, level:1, xp:0,
  winStreak:0, loseStreak:0,
  shop:[],            // 5 hero keys
  bench:[],           // up to 8 unit-instance objects
  board:[],           // grid placement: row col cells of unit-instances (player side only)
  enemyBoard:[],
  combatUnits:[],     // active combat unit-instances (both sides)
  combatTimer:0,
  combatResult:null,  // 'win' | 'lose'
  selectedBench:null,
  selectedBoard:null,
  dragGhost:null,
  fxObjects:[],
  toastTimer:0,
  lastTime:0,
  matchId:0,
  shake:{t:0,mag:0},
};
let nextId = 1;

// Each unit-instance:
//   { id, heroKey, stars (1-3), hp, maxHp, dmg, range, atkSpeed, armor, mana, manaMax,
//     row, col, side, target, cooldown, def: {...HEROES[heroKey]}, status: {} }
function makeUnit(heroKey, stars){
  const h = HEROES[heroKey]; if (!h) return null;
  const mul = Math.pow(1.8, (stars||1) - 1);   // 1★ → 1x, 2★ → 1.8x, 3★ → 3.24x
  return {
    id: nextId++, heroKey, stars: stars || 1, def: h,
    hp: h.hp * mul, maxHp: h.hp * mul,
    dmg: h.dmg * mul, range: h.range, atkSpeed: h.atkSpeed,
    armor: h.armor, mana: 0, manaMax: h.manaMax,
    row: -1, col: -1, side: 'player',
    target: null, cooldown: 0,
    status: { shield:0, stun:0, enrage:0, enrageMul:1, buffShots:0, buffShotsBonus:0,
              taunt:0, dmgBuff:0, dmgBuffMul:1, lifesteal:0, regen:0, critChance:0, critDmgBonus:0,
              auraDmg:0, auraDur:0, auraRadius:0 },
  };
}

function tierPool(tier){ return Object.keys(HEROES).filter(k => HEROES[k].tier === tier); }

function rollShop(){
  STATE.shop = [];
  const odds = SHOP_ODDS[Math.min(8, Math.max(1, STATE.level))] || SHOP_ODDS[1];
  for (let i = 0; i < 5; i++) {
    const r = Math.random();
    let acc = 0, tier = 1;
    for (let t = 1; t <= 5; t++) { acc += odds[t-1]; if (r < acc) { tier = t; break; } }
    const pool = tierPool(tier);
    if (!pool.length) { STATE.shop.push(null); continue; }
    STATE.shop.push(pool[Math.floor(Math.random() * pool.length)]);
  }
}


// =========================================================================
// AUDIO — light, fantasy-flavored
// =========================================================================
let AC = null, _bus = null;
function ensureAudio(){
  if (!AC) AC = new (window.AudioContext||window.webkitAudioContext)();
  if (!_bus) { _bus = AC.createGain(); _bus.gain.value = 0.7; _bus.connect(AC.destination); }
  return AC;
}
function _noise(d){ const sr = AC.sampleRate, l = Math.floor(sr*d), b = AC.createBuffer(1,l,sr), c = b.getChannelData(0); for (let i=0;i<l;i++) c[i] = Math.random()*2-1; return b; }
function tone(f1,f2,d,t,v){ try{ const a=ensureAudio(),n=a.currentTime,o=a.createOscillator(),g=a.createGain(); o.type=t||'sine'; o.frequency.setValueAtTime(f1,n); o.frequency.exponentialRampToValueAtTime(Math.max(40,f2),n+d); g.gain.setValueAtTime(0,n); g.gain.linearRampToValueAtTime(v,n+0.005); g.gain.exponentialRampToValueAtTime(.0001,n+d); o.connect(g); g.connect(_bus); o.start(n); o.stop(n+d+0.02);}catch(e){} }
function nz(d,f,q,v,a){ try{ const ac=ensureAudio(),s=ac.createBufferSource(); s.buffer=_noise(d); const fi=ac.createBiquadFilter(); fi.type='bandpass'; fi.frequency.value=f; fi.Q.value=q||1; const g=ac.createGain(),n=ac.currentTime; g.gain.setValueAtTime(0,n); g.gain.linearRampToValueAtTime(v,n+(a||0.005)); g.gain.exponentialRampToValueAtTime(.0001,n+d); s.connect(fi); fi.connect(g); g.connect(_bus); s.start(n); s.stop(n+d);}catch(e){} }
function chord(notes, dur, type, vol){ notes.forEach((f, i) => setTimeout(() => tone(f, f, dur, type, vol), i*8)); }

function playSound(k){ try{ const a=ensureAudio(); if(a.state==='suspended') a.resume();
  if (k === 'click') { tone(880, 720, 0.05, 'triangle', 0.06); }
  else if (k === 'select') { tone(660, 990, 0.07, 'sine', 0.06); setTimeout(()=>tone(990, 1320, 0.05, 'sine', 0.04), 40); }
  else if (k === 'place') { tone(440, 660, 0.10, 'triangle', 0.08); nz(0.06, 1200, 4, 0.04); }
  else if (k === 'buy')   { chord([523, 659, 784], 0.18, 'sine', 0.06); nz(0.05, 4000, 5, 0.04); }
  else if (k === 'sell')  { tone(440, 220, 0.20, 'sawtooth', 0.06); nz(0.08, 600, 3, 0.04); }
  else if (k === 'upgrade'){ chord([523, 659, 784, 1047, 1319], 0.5, 'sine', 0.06); nz(0.18, 4000, 6, 0.04, 0.05); }
  else if (k === 'reroll'){ for (let i=0;i<3;i++) setTimeout(()=>tone(700+i*100, 900+i*120, 0.05, 'triangle', 0.04), i*30); }
  else if (k === 'levelup'){ chord([523, 659, 784, 1047], 0.4, 'sine', 0.08); }
  else if (k === 'combat_start'){ tone(220, 110, 0.5, 'sawtooth', 0.10); nz(0.4, 200, 1, 0.10); }
  else if (k === 'win')   { chord([523, 659, 784, 1047, 1319], 0.6, 'sine', 0.08); chord([262, 330, 392, 523, 660], 0.6, 'triangle', 0.04); }
  else if (k === 'lose')  { chord([392, 330, 247, 196], 0.5, 'sawtooth', 0.08); }
  else if (k === 'sword') { tone(2200, 600, 0.05, 'square', 0.04); nz(0.04, 3500, 5, 0.05); }
  else if (k === 'bow')   { tone(1800, 1200, 0.06, 'triangle', 0.04); nz(0.05, 3000, 4, 0.03); }
  else if (k === 'spell') { tone(440, 1320, 0.20, 'sine', 0.06); tone(880, 220, 0.20, 'triangle', 0.04); nz(0.12, 3000, 4, 0.04); }
  else if (k === 'heal')  { tone(523, 1047, 0.20, 'sine', 0.05); tone(1047, 1568, 0.18, 'sine', 0.04); }
  else if (k === 'roar')  { tone(180, 90, 0.55, 'sawtooth', 0.12); nz(0.5, 600, 1, 0.10); }
  else if (k === 'fire')  { nz(0.5, 500, 0.5, 0.10, 0.02); tone(220, 80, 0.4, 'sawtooth', 0.06); }
  else if (k === 'death') { tone(220, 60, 0.30, 'sawtooth', 0.08); nz(0.15, 400, 2, 0.06); }
  else if (k === 'ability'){ chord([784, 988, 1175], 0.18, 'triangle', 0.06); nz(0.08, 3500, 4, 0.04); }
  else if (k === 'summon'){ tone(80, 880, 0.30, 'sine', 0.08); tone(440, 1320, 0.20, 'triangle', 0.05); nz(0.18, 2000, 2, 0.05); }
  else if (k === 'crit')  { tone(2400, 800, 0.10, 'square', 0.08); nz(0.06, 5000, 6, 0.06); }
}catch(e){} }


// =========================================================================
// THREE.JS — painted fantasy tabletop look
// =========================================================================
let scene, camera, renderer, raycaster, pointer;
let board3D = null;            // group containing the cells
const cellMeshes = [];         // [row][col] cell highlight meshes
const unitMeshes = new Map();  // unitId → Three.Group
const fxMeshes = new Map();    // fx → mesh
let _vTmp = new THREE.Vector3 ? new THREE.Vector3() : null;

function basicMat(c, opts){ opts=opts||{}; return new THREE.MeshBasicMaterial({ color:c, transparent:!!opts.transparent, opacity:opts.opacity||1, side:opts.side||THREE.FrontSide, depthWrite:opts.depthWrite!==false }); }
function paintedMat(c, opts){ opts=opts||{}; return new THREE.MeshLambertMaterial({ color:c, emissive:opts.emissive||0x000000, emissiveIntensity:opts.emissiveIntensity||0 }); }
function metalMat(c, opts){ opts=opts||{}; return new THREE.MeshStandardMaterial({ color:c, roughness:opts.roughness||0.4, metalness:opts.metalness||0.6, emissive:opts.emissive||0x000000, emissiveIntensity:opts.emissiveIntensity||0 }); }

function disposeObject3D(obj){ if(!obj) return; obj.traverse(o=>{ if(o.geometry){try{o.geometry.dispose();}catch(e){}} if(o.material){const m=Array.isArray(o.material)?o.material:[o.material]; for(const x of m){try{ if(x.map) x.map.dispose(); if(x.dispose) x.dispose(); }catch(e){}} } }); }
function removeAndDispose(mesh){ if(!mesh) return; if(mesh.parent) mesh.parent.remove(mesh); else if(scene) scene.remove(mesh); disposeObject3D(mesh); }

function initThree(){
  const container = document.getElementById('threeContainer');
  scene = new THREE.Scene();
  scene.background = new THREE.Color(0x2a1810);
  scene.fog = new THREE.Fog(0x2a1810, 18, 50);
  camera = new THREE.PerspectiveCamera(40, 1, 0.3, 200);
  camera.position.set(0, 16, 12);
  camera.lookAt(0, 0, 0);
  renderer = new THREE.WebGLRenderer({ antialias:true, powerPreference:'high-performance', precision:'mediump', failIfMajorPerformanceCaveat:false });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio||1, 2));
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.outputEncoding = THREE.sRGBEncoding;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.15;
  container.innerHTML = '';
  container.appendChild(renderer.domElement);

  // Lights — warm key from above, cool fill from sides, ambient warmth
  scene.add(new THREE.HemisphereLight(0xfff0d8, 0x402010, 0.8));
  const key = new THREE.DirectionalLight(0xfff0c0, 1.4);
  key.position.set(8, 18, 8); key.castShadow = true;
  key.shadow.mapSize.width = 2048; key.shadow.mapSize.height = 2048;
  key.shadow.camera.left = -10; key.shadow.camera.right = 10;
  key.shadow.camera.top = 10; key.shadow.camera.bottom = -10;
  key.shadow.camera.near = 1; key.shadow.camera.far = 40;
  key.shadow.bias = -0.0005;
  scene.add(key);
  const fill = new THREE.DirectionalLight(0xa080ff, 0.5); fill.position.set(-8, 10, -6); scene.add(fill);
  const rim = new THREE.DirectionalLight(0xff8060, 0.45); rim.position.set(0, 8, -14); scene.add(rim);
  scene.add(new THREE.AmbientLight(0x402810, 0.4));

  raycaster = new THREE.Raycaster();
  pointer = new THREE.Vector2();
  buildSkyAndBackdrop();
  buildBoard();
  resizeThree();
}

function buildSkyAndBackdrop(){
  // Painted sky shader — soft sunset gradient + procedural clouds
  const skyGeo = new THREE.SphereGeometry(120, 24, 16);
  const skyMat = new THREE.ShaderMaterial({
    side: THREE.BackSide, depthWrite: false,
    vertexShader: 'varying vec3 vP; void main(){ vP = position; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
    fragmentShader: `
      varying vec3 vP;
      float hash(vec2 p){ return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
      float noise(vec2 p){ vec2 i = floor(p); vec2 f = fract(p);
        float a = hash(i), b = hash(i + vec2(1,0)), c = hash(i + vec2(0,1)), d = hash(i + vec2(1,1));
        vec2 u = f*f*(3.0-2.0*f);
        return mix(mix(a,b,u.x), mix(c,d,u.x), u.y);
      }
      void main(){
        vec3 dir = normalize(vP);
        float t = clamp(dir.y * 0.7 + 0.4, 0.0, 1.0);
        // Warm sunset gradient
        vec3 horizon = vec3(1.00, 0.55, 0.30);
        vec3 mid     = vec3(0.85, 0.45, 0.55);
        vec3 zenith  = vec3(0.30, 0.18, 0.40);
        vec3 col = mix(mix(horizon, mid, smoothstep(0.0, 0.4, t)), zenith, smoothstep(0.4, 1.0, t));
        // Soft painted clouds
        if (dir.y > 0.0) {
          float cn = noise(vec2(atan(dir.x, dir.z) * 3.0, dir.y * 6.0 + 12.3));
          cn = smoothstep(0.45, 0.75, cn);
          col = mix(col, vec3(1.0, 0.85, 0.75), cn * 0.6);
        }
        // Distant mountain silhouette near horizon
        float mountain = smoothstep(0.05, 0.0, dir.y) * smoothstep(-0.20, 0.10, dir.y);
        float mountShape = noise(vec2(atan(dir.x, dir.z) * 8.0, 0.5));
        if (dir.y < 0.05 + mountShape * 0.05) {
          col = mix(col, vec3(0.20, 0.10, 0.18), 0.65);
        }
        gl_FragColor = vec4(col, 1.0);
      }`
  });
  scene.add(new THREE.Mesh(skyGeo, skyMat));

  // Painted ground plane far beyond the board
  const groundGeo = new THREE.PlaneGeometry(80, 80, 1, 1);
  const groundMat = new THREE.MeshLambertMaterial({ color: 0x402818 });
  const ground = new THREE.Mesh(groundGeo, groundMat);
  ground.rotation.x = -Math.PI/2;
  ground.position.y = -0.2;
  ground.receiveShadow = true;
  scene.add(ground);

  // Soft glowing motes drifting in the air (painted dust)
  for (let i = 0; i < 30; i++) {
    const mote = new THREE.Mesh(
      new THREE.SphereGeometry(0.04 + Math.random() * 0.04, 6, 5),
      basicMat(0xffe8a0, { transparent:true, opacity:0.6 })
    );
    mote.position.set((Math.random()-0.5) * 22, 1 + Math.random() * 6, (Math.random()-0.5) * 14);
    mote.userData.bob = Math.random() * Math.PI * 2;
    mote.userData.bobSpeed = 0.3 + Math.random() * 0.4;
    scene.add(mote);
    if (!scene.userData.motes) scene.userData.motes = [];
    scene.userData.motes.push(mote);
  }
}

function buildBoard(){
  board3D = new THREE.Group();
  scene.add(board3D);

  // Outer wooden frame
  const fW = BOARD_W + 1.4, fD = BOARD_D + 1.4;
  const frame = new THREE.Mesh(new THREE.BoxGeometry(fW, 0.3, fD), paintedMat(0x4a2810));
  frame.position.y = -0.15;
  frame.receiveShadow = true;
  board3D.add(frame);
  // Frame edge highlight (gold trim)
  const trim = new THREE.Mesh(new THREE.BoxGeometry(fW, 0.05, fD), basicMat(0xa07840));
  trim.position.y = 0.01;
  board3D.add(trim);

  // Inner board surface
  const surfaceGeo = new THREE.PlaneGeometry(BOARD_W, BOARD_D, 1, 1);
  const surface = new THREE.Mesh(surfaceGeo, paintedMat(0x8a5818));
  surface.rotation.x = -Math.PI/2;
  surface.position.y = 0.02;
  surface.receiveShadow = true;
  board3D.add(surface);

  // Player/enemy half tint
  const playerTint = new THREE.Mesh(new THREE.PlaneGeometry(BOARD_W, BOARD_D/2), basicMat(0x60a0ff, { transparent:true, opacity:0.12, depthWrite:false }));
  playerTint.rotation.x = -Math.PI/2;
  playerTint.position.set(0, 0.03, BOARD_D/4);
  board3D.add(playerTint);
  const enemyTint = new THREE.Mesh(new THREE.PlaneGeometry(BOARD_W, BOARD_D/2), basicMat(0xff5060, { transparent:true, opacity:0.12, depthWrite:false }));
  enemyTint.rotation.x = -Math.PI/2;
  enemyTint.position.set(0, 0.03, -BOARD_D/4);
  board3D.add(enemyTint);

  // Cell grid lines
  for (let r = 0; r <= ROWS; r++) {
    const line = new THREE.Mesh(new THREE.BoxGeometry(BOARD_W, 0.01, 0.04), basicMat(0x604018));
    line.position.set(0, 0.04, -BOARD_D/2 + r * CELL_SIZE);
    board3D.add(line);
  }
  for (let c = 0; c <= COLS; c++) {
    const line = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.01, BOARD_D), basicMat(0x604018));
    line.position.set(-BOARD_W/2 + c * CELL_SIZE, 0.04, 0);
    board3D.add(line);
  }

  // Individual cell highlights (for hover/placement)
  for (let r = 0; r < ROWS; r++) {
    cellMeshes[r] = [];
    for (let c = 0; c < COLS; c++) {
      const cell = new THREE.Mesh(
        new THREE.PlaneGeometry(CELL_SIZE * 0.92, CELL_SIZE * 0.92),
        basicMat(0xffe888, { transparent:true, opacity:0, depthWrite:false })
      );
      cell.rotation.x = -Math.PI/2;
      const { x, z } = cellToWorld(r, c);
      cell.position.set(x, 0.05, z);
      board3D.add(cell);
      cellMeshes[r][c] = cell;
    }
  }

  // Decorative torches at corners
  for (const [tx, tz] of [[-fW/2+0.4, -fD/2+0.4], [fW/2-0.4, -fD/2+0.4], [-fW/2+0.4, fD/2-0.4], [fW/2-0.4, fD/2-0.4]]) {
    const torch = new THREE.Group();
    const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.08, 1.8, 6), paintedMat(0x3a1810));
    pole.position.y = 0.9; pole.castShadow = true; torch.add(pole);
    const bowl = new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.12, 0.18, 8), paintedMat(0x2a1208));
    bowl.position.y = 1.85; torch.add(bowl);
    const flame = new THREE.Mesh(new THREE.SphereGeometry(0.20, 10, 8), basicMat(0xff9040, { transparent:true, opacity:0.9 }));
    flame.position.y = 2.05; flame.scale.y = 1.6; torch.add(flame);
    const halo = new THREE.Mesh(new THREE.SphereGeometry(0.45, 10, 8), basicMat(0xffaa50, { transparent:true, opacity:0.20, depthWrite:false }));
    halo.position.y = 2.05; torch.add(halo);
    torch.position.set(tx, 0, tz); torch.userData.flame = flame; torch.userData.halo = halo;
    scene.add(torch);
    if (!scene.userData.torches) scene.userData.torches = [];
    scene.userData.torches.push(torch);
    // Point light for the flame
    const pl = new THREE.PointLight(0xff8040, 0.7, 6);
    pl.position.set(tx, 2.05, tz);
    scene.add(pl);
  }
}

function cellToWorld(row, col){
  return {
    x: -BOARD_W/2 + (col + 0.5) * CELL_SIZE,
    z: -BOARD_D/2 + (row + 0.5) * CELL_SIZE,
  };
}
function worldToCell(x, z){
  const col = Math.floor((x + BOARD_W/2) / CELL_SIZE);
  const row = Math.floor((z + BOARD_D/2) / CELL_SIZE);
  if (row < 0 || row >= ROWS || col < 0 || col >= COLS) return null;
  return { row, col };
}

function resizeThree(){
  const cont = document.getElementById('threeContainer');
  if (!cont || !renderer || !camera) return;
  const w = cont.clientWidth, h = cont.clientHeight;
  if (!w || !h) return;
  renderer.setSize(w, h, false);
  camera.aspect = w / h;
  camera.updateProjectionMatrix();
  STATE._lastSize = { w, h };
}
function ensureCanvasSize(){
  const cont = document.getElementById('threeContainer'); if (!cont || !renderer) return;
  const w = cont.clientWidth, h = cont.clientHeight; if (!w || !h) return;
  if (!STATE._lastSize || STATE._lastSize.w !== w || STATE._lastSize.h !== h) resizeThree();
}
window.addEventListener('resize', () => { if (renderer) resizeThree(); });


// =========================================================================
// CHARACTER MESH BUILDERS — fantasy-realistic, rigged for rich animation
// Each unit is a Group with named bones:
//   root.userData.bones = { hips, torso, neck, head, leftArm, rightArm, leftLeg, rightLeg, weapon }
// Each unit gets per-class proportions, per-origin color/material, and a
// distinct silhouette.
// =========================================================================

function makeCapsule(radius, length, mat){
  const g = new THREE.Group();
  const body = new THREE.Mesh(new THREE.CylinderGeometry(radius, radius, length, 10), mat);
  body.castShadow = true; g.add(body);
  const top = new THREE.Mesh(new THREE.SphereGeometry(radius, 10, 6, 0, Math.PI*2, 0, Math.PI/2), mat);
  top.position.y = length/2; g.add(top);
  const bot = new THREE.Mesh(new THREE.SphereGeometry(radius, 10, 6, 0, Math.PI*2, Math.PI/2, Math.PI/2), mat);
  bot.position.y = -length/2; g.add(bot);
  return g;
}

// Build a generic humanoid rig. Class/role tweaks layered on top.
function buildHumanoidRig(opts){
  const root = new THREE.Group();
  const skin = opts.skin || 0xe8c8a0;
  const cloth = opts.cloth || 0x806040;
  const accent = opts.accent || 0xc04020;
  const metal = opts.metal || 0x707080;
  const skinMat = paintedMat(skin);
  const clothMat = paintedMat(cloth);
  const metalMat_ = metalMat(metal, { metalness:0.7, roughness:0.4 });

  // HIPS
  const hips = new THREE.Group();
  hips.position.y = 0.78;
  root.add(hips);
  const belt = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.20, 0.10, 10), paintedMat(0x3a2010));
  hips.add(belt);

  // TORSO (pivots from hips)
  const torso = new THREE.Group();
  hips.add(torso);
  // Chest — ovoid scaled torso for organic look
  const chest = new THREE.Mesh(new THREE.SphereGeometry(0.30, 12, 10), clothMat);
  chest.scale.set(0.95, 1.0, 0.65);
  chest.position.y = 0.24; chest.castShadow = true; torso.add(chest);
  // Belt-line accent
  const sash = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.06, 0.36), paintedMat(accent));
  sash.position.y = 0.04; torso.add(sash);

  // NECK + HEAD
  const neck = new THREE.Group();
  neck.position.y = 0.52;
  torso.add(neck);
  const headMesh = new THREE.Mesh(new THREE.SphereGeometry(0.18, 14, 10), skinMat);
  headMesh.scale.set(0.95, 1.05, 1.0);
  headMesh.position.y = 0.18; headMesh.castShadow = true; neck.add(headMesh);
  // Eyes — small dark dots
  for (const xs of [-0.06, 0.06]) {
    const eye = new THREE.Mesh(new THREE.SphereGeometry(0.022, 6, 5), basicMat(0x101010));
    eye.position.set(xs, 0.20, 0.16); neck.add(eye);
  }

  // ARMS (shoulder pivots)
  const leftArm = new THREE.Group(); leftArm.position.set(-0.26, 0.42, 0); torso.add(leftArm);
  const rightArm = new THREE.Group(); rightArm.position.set(0.26, 0.42, 0); torso.add(rightArm);
  for (const [arm, isLeft] of [[leftArm, true], [rightArm, false]]) {
    const sleeve = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.08, 0.28, 8), clothMat);
    sleeve.position.y = -0.14; sleeve.castShadow = true; arm.add(sleeve);
    const elbow = new THREE.Mesh(new THREE.SphereGeometry(0.08, 8, 6), skinMat);
    elbow.position.y = -0.28; arm.add(elbow);
    const forearm = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.07, 0.24, 8), skinMat);
    forearm.position.y = -0.40; arm.add(forearm);
    const hand = new THREE.Mesh(new THREE.SphereGeometry(0.075, 8, 6), skinMat);
    hand.position.y = -0.54; arm.add(hand);
  }

  // LEGS (hip pivots)
  const leftLeg = new THREE.Group(); leftLeg.position.set(-0.10, -0.04, 0); hips.add(leftLeg);
  const rightLeg = new THREE.Group(); rightLeg.position.set(0.10, -0.04, 0); hips.add(rightLeg);
  for (const leg of [leftLeg, rightLeg]) {
    const thigh = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.08, 0.32, 8), clothMat);
    thigh.position.y = -0.20; thigh.castShadow = true; leg.add(thigh);
    const knee = new THREE.Mesh(new THREE.SphereGeometry(0.085, 8, 6), clothMat);
    knee.position.y = -0.38; leg.add(knee);
    const shin = new THREE.Mesh(new THREE.CylinderGeometry(0.075, 0.07, 0.26, 8), paintedMat(0x2a1810));
    shin.position.y = -0.52; leg.add(shin);
    const boot = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.12, 0.20), paintedMat(0x1a0e08));
    boot.position.set(0, -0.66, 0.04); boot.castShadow = true; leg.add(boot);
  }

  // WEAPON socket (parented to right hand)
  const weapon = new THREE.Group();
  weapon.position.set(0.03, -0.55, 0.06);
  rightArm.add(weapon);

  root.userData.bones = {
    hips, torso, neck, head:headMesh, leftArm, rightArm, leftLeg, rightLeg, weapon
  };
  root.userData.skin = skin;
  return { root, skinMat, clothMat, metalMat:metalMat_ };
}

// Equip the rig with class-specific gear + weapon
function dressUnit(unit, rig){
  const def = unit.def;
  const cls = def.class;
  const bones = rig.root.userData.bones;
  const w = bones.weapon;

  // Helmet/headwear per class
  if (cls === 'warrior' || cls === 'guardian') {
    const helm = new THREE.Mesh(new THREE.SphereGeometry(0.22, 14, 10, 0, Math.PI*2, 0, Math.PI/2.05),
      metalMat(0x808890, { metalness:0.8, roughness:0.35 }));
    helm.position.y = 0.20; helm.castShadow = true; bones.neck.add(helm);
    // Visor band
    const visor = new THREE.Mesh(new THREE.TorusGeometry(0.18, 0.02, 5, 14, Math.PI), basicMat(0x101010));
    visor.rotation.x = Math.PI/2; visor.rotation.z = Math.PI;
    visor.position.set(0, 0.16, 0.05); bones.neck.add(visor);
  }
  if (cls === 'mage' || (def.origin === 'undead' && cls === 'mage')) {
    // Pointed hat
    const hat = new THREE.Mesh(new THREE.ConeGeometry(0.20, 0.46, 12), paintedMat(0x3010a0));
    hat.position.y = 0.42; bones.neck.add(hat);
    // Brim
    const brim = new THREE.Mesh(new THREE.TorusGeometry(0.22, 0.04, 5, 16), paintedMat(0x200880));
    brim.rotation.x = Math.PI/2; brim.position.y = 0.20; bones.neck.add(brim);
    // Buckle/star on hat
    const star = new THREE.Mesh(new THREE.SphereGeometry(0.04, 6, 5), basicMat(0xffe888));
    star.position.set(0, 0.22, 0.20); bones.neck.add(star);
  }
  if (cls === 'ranger') {
    // Hood
    const hood = new THREE.Mesh(new THREE.SphereGeometry(0.24, 14, 10, 0, Math.PI*2, 0, Math.PI/1.9),
      paintedMat(0x3a4a20));
    hood.position.y = 0.20; bones.neck.add(hood);
    // Hood front fold
    const fold = new THREE.Mesh(new THREE.ConeGeometry(0.15, 0.20, 8), paintedMat(0x2a3818));
    fold.position.set(0, 0.16, 0.18); fold.rotation.x = -0.3; bones.neck.add(fold);
  }
  if (cls === 'healer') {
    // Light hood / circlet
    const halo = new THREE.Mesh(new THREE.TorusGeometry(0.18, 0.02, 5, 18), basicMat(0xffe888));
    halo.rotation.x = Math.PI/2; halo.position.y = 0.42; bones.neck.add(halo);
    // Hood drape
    const hood = new THREE.Mesh(new THREE.SphereGeometry(0.22, 12, 8, 0, Math.PI*2, Math.PI/2, Math.PI/2),
      paintedMat(0xf0e8c0));
    hood.position.y = 0.20; bones.neck.add(hood);
  }
  if (cls === 'assassin') {
    // Dark hood + mask
    const hood = new THREE.Mesh(new THREE.SphereGeometry(0.22, 14, 10, 0, Math.PI*2, 0, Math.PI/1.9),
      paintedMat(0x1a0a18));
    hood.position.y = 0.20; bones.neck.add(hood);
    const mask = new THREE.Mesh(new THREE.BoxGeometry(0.20, 0.10, 0.06), basicMat(0x101010));
    mask.position.set(0, 0.16, 0.13); bones.neck.add(mask);
  }

  // Origin-flavor body details
  if (def.origin === 'undead') {
    // Pale skin tint already done; add bone protrusions
    const rib = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.18, 0.05), basicMat(0xe8dcc0));
    rib.position.set(-0.06, 0.24, 0.20); bones.torso.add(rib);
    const rib2 = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.18, 0.05), basicMat(0xe8dcc0));
    rib2.position.set(0.06, 0.24, 0.20); bones.torso.add(rib2);
  } else if (def.origin === 'dragon') {
    // Dragon scales on shoulders
    for (const xs of [-0.30, 0.30]) {
      const pauldron = new THREE.Mesh(new THREE.SphereGeometry(0.13, 8, 6, 0, Math.PI*2, 0, Math.PI/2),
        metalMat(0xc04020, { metalness:0.7, roughness:0.3 }));
      pauldron.position.set(xs, 0.46, 0); bones.torso.add(pauldron);
    }
    // Tiny horns
    for (const xs of [-0.10, 0.10]) {
      const horn = new THREE.Mesh(new THREE.ConeGeometry(0.04, 0.16, 6), paintedMat(0x602010));
      horn.position.set(xs, 0.30, -0.04); horn.rotation.x = 0.4; bones.neck.add(horn);
    }
  } else if (def.origin === 'orc') {
    // Tusks
    for (const xs of [-0.05, 0.05]) {
      const tusk = new THREE.Mesh(new THREE.ConeGeometry(0.018, 0.10, 5), basicMat(0xeed8b0));
      tusk.position.set(xs, 0.14, 0.16); tusk.rotation.x = Math.PI - 0.2; bones.neck.add(tusk);
    }
    // Skin tint applied via origin color
    bones.head.material = paintedMat(0x70a060);
  } else if (def.origin === 'elf') {
    // Pointed ears
    for (const xs of [-0.18, 0.18]) {
      const ear = new THREE.Mesh(new THREE.ConeGeometry(0.04, 0.14, 5), bones.head.material);
      ear.position.set(xs, 0.20, 0); ear.rotation.z = xs > 0 ? -0.6 : 0.6;
      bones.neck.add(ear);
    }
  }

  // Weapon per class
  if (cls === 'warrior' || cls === 'guardian') buildSword(w);
  else if (cls === 'mage' || cls === 'healer') buildStaff(w, def.origin === 'dragon' ? 0xff6040 : 0x8060ff);
  else if (cls === 'ranger') buildBow(w);
  else if (cls === 'assassin') buildDagger(w);

  // Faction-glow visor / aura for ability charged state (toggled in animation)
  const auraRing = new THREE.Mesh(new THREE.RingGeometry(0.50, 0.55, 24),
    basicMat(0xffe888, { transparent:true, opacity:0, side:THREE.DoubleSide, depthWrite:false }));
  auraRing.rotation.x = -Math.PI/2; auraRing.position.y = 0.05; rig.root.add(auraRing);
  rig.root.userData.auraRing = auraRing;
}

function buildSword(parent){
  const handle = new THREE.Mesh(new THREE.CylinderGeometry(0.025, 0.025, 0.18, 6), paintedMat(0x4a2810));
  handle.position.y = -0.05; parent.add(handle);
  const guard = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.04, 0.04), metalMat(0xa07840));
  guard.position.y = 0.05; parent.add(guard);
  const blade = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.55, 0.02), metalMat(0xcccccc, { metalness:0.85, roughness:0.2 }));
  blade.position.y = 0.34; parent.add(blade);
  const tip = new THREE.Mesh(new THREE.ConeGeometry(0.045, 0.10, 4), metalMat(0xcccccc, { metalness:0.85, roughness:0.2 }));
  tip.position.y = 0.64; parent.add(tip);
}
function buildStaff(parent, gemColor){
  const shaft = new THREE.Mesh(new THREE.CylinderGeometry(0.025, 0.025, 0.85, 6), paintedMat(0x4a2810));
  shaft.position.y = 0.20; parent.add(shaft);
  const cap = new THREE.Mesh(new THREE.TorusGeometry(0.06, 0.018, 5, 12), metalMat(0xc89040));
  cap.rotation.x = Math.PI/2; cap.position.y = 0.62; parent.add(cap);
  const gem = new THREE.Mesh(new THREE.OctahedronGeometry(0.08, 0), basicMat(gemColor, { transparent:true, opacity:0.85 }));
  gem.position.y = 0.72; parent.add(gem);
  parent.userData.gem = gem;
  // Halo
  const halo = new THREE.Mesh(new THREE.SphereGeometry(0.14, 10, 8), basicMat(gemColor, { transparent:true, opacity:0.25, depthWrite:false }));
  halo.position.y = 0.72; parent.add(halo);
}
function buildBow(parent){
  const handle = new THREE.Mesh(new THREE.CylinderGeometry(0.025, 0.025, 0.10, 6), paintedMat(0x4a2810));
  handle.position.y = 0.02; parent.add(handle);
  const limb1 = new THREE.Mesh(new THREE.TorusGeometry(0.35, 0.025, 5, 14, Math.PI*0.7),
    paintedMat(0x6a3818));
  limb1.rotation.z = Math.PI/2; limb1.rotation.x = Math.PI/2;
  limb1.position.set(0, 0.05, 0); parent.add(limb1);
  // Bowstring (line)
  const stringGeo = new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(0, -0.30, 0), new THREE.Vector3(0, 0.40, 0)]);
  const string = new THREE.Line(stringGeo, new THREE.LineBasicMaterial({ color:0xe8d4a0 }));
  parent.add(string);
}
function buildDagger(parent){
  const handle = new THREE.Mesh(new THREE.CylinderGeometry(0.022, 0.022, 0.10, 6), paintedMat(0x202020));
  handle.position.y = -0.02; parent.add(handle);
  const blade = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.22, 0.018), metalMat(0xa0a0a0, { metalness:0.85, roughness:0.25 }));
  blade.position.y = 0.14; parent.add(blade);
  const tip = new THREE.Mesh(new THREE.ConeGeometry(0.035, 0.08, 4), metalMat(0xa0a0a0, { metalness:0.85, roughness:0.25 }));
  tip.position.y = 0.27; parent.add(tip);
}

// Ghoul / undead beasts get a different rig
function buildBeastRig(opts){
  const root = new THREE.Group();
  const fur = paintedMat(opts.color || 0x604040);
  // Body
  const body = new THREE.Mesh(new THREE.SphereGeometry(0.28, 14, 10), fur);
  body.scale.set(1.0, 0.7, 1.4);
  body.position.y = 0.40; body.castShadow = true; root.add(body);
  // Head
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.20, 12, 10), fur);
  head.scale.set(0.9, 0.85, 1.1);
  head.position.set(0, 0.55, 0.40); head.castShadow = true; root.add(head);
  // Snout
  const snout = new THREE.Mesh(new THREE.ConeGeometry(0.10, 0.18, 6), fur);
  snout.rotation.x = Math.PI/2; snout.position.set(0, 0.50, 0.58); root.add(snout);
  // Eyes
  for (const xs of [-0.06, 0.06]) {
    const eye = new THREE.Mesh(new THREE.SphereGeometry(0.025, 6, 5), basicMat(0xff4040));
    eye.position.set(xs, 0.58, 0.52); root.add(eye);
  }
  // Legs (4)
  for (const [xs, zs] of [[-0.16, 0.20], [0.16, 0.20], [-0.16, -0.20], [0.16, -0.20]]) {
    const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.05, 0.40, 6), fur);
    leg.position.set(xs, 0.20, zs); leg.castShadow = true; root.add(leg);
  }
  // Tail
  const tail = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.02, 0.30, 6), fur);
  tail.position.set(0, 0.42, -0.32); tail.rotation.x = -0.4; root.add(tail);
  root.userData.bones = { body, head, snout, tail };
  return { root };
}

// Build full unit mesh
function buildUnitMesh(unit){
  const def = unit.def;
  const origin = ORIGINS[def.origin];
  const cls = CLASSES[def.class];

  // Beast variants (Ghoul) use beast rig
  let rig;
  if (def.heroKey === 'ghoul' || unit.heroKey === 'ghoul') {
    rig = buildBeastRig({ color: 0x705060 });
  } else {
    rig = buildHumanoidRig({
      skin: def.origin === 'orc' ? 0x70a060 : def.origin === 'undead' ? 0xb0a8c0 : 0xe8c8a0,
      cloth: origin.color,
      accent: cls.color,
      metal: 0x808890,
    });
    dressUnit(unit, rig);
  }
  // Star indicator above unit
  if (unit.stars > 1) {
    const starGroup = new THREE.Group();
    for (let i = 0; i < unit.stars; i++) {
      const s = new THREE.Mesh(new THREE.OctahedronGeometry(0.05, 0),
        basicMat(unit.stars === 3 ? 0xffe040 : 0xc0c0c0));
      s.position.set((i - (unit.stars-1)/2) * 0.12, 1.45, 0);
      starGroup.add(s);
    }
    rig.root.add(starGroup);
    rig.root.userData.stars3D = starGroup;
  }
  // Side-colored base ring
  const ring = new THREE.Mesh(new THREE.RingGeometry(0.42, 0.50, 24),
    basicMat(unit.side === 'player' ? 0x60a0ff : 0xff5060, { transparent:true, opacity:0.85, side:THREE.DoubleSide, depthWrite:false }));
  ring.rotation.x = -Math.PI/2; ring.position.y = 0.02;
  rig.root.add(ring);
  return rig.root;
}


// =========================================================================
// ANIMATION — drives bones per unit state each frame
// States: idle / walk / attack / cast / hit / death
// =========================================================================
function animateUnit(u, dt){
  const mesh = unitMeshes.get(u.id);
  if (!mesh || !mesh.userData.bones) return;
  const b = mesh.userData.bones;
  const now = performance.now() * 0.001;

  // Smooth facing
  if (mesh.userData._visFacing == null) mesh.userData._visFacing = u.facing || 0;
  if (u.facing != null) {
    let d = u.facing - mesh.userData._visFacing;
    while (d > Math.PI) d -= Math.PI * 2;
    while (d < -Math.PI) d += Math.PI * 2;
    mesh.userData._visFacing += d * Math.min(1, dt * 9);
    mesh.rotation.y = mesh.userData._visFacing;
  }

  // Smooth position lerp
  if (u.visualX == null) { u.visualX = u.x; u.visualZ = u.z; }
  u.visualX += (u.x - u.visualX) * Math.min(1, dt * 18);
  u.visualZ += (u.z - u.visualZ) * Math.min(1, dt * 18);
  mesh.position.x = u.visualX;
  mesh.position.z = u.visualZ;

  // Hit flinch — torso shake briefly
  if (u.flinch > 0) {
    u.flinch -= dt;
    mesh.position.y = 0 + Math.sin(now * 50) * 0.04;
    if (b.head) b.head.rotation.x = Math.sin(now * 50) * 0.08;
  } else {
    mesh.position.y = 0;
    if (b.head) b.head.rotation.x *= 0.85;
  }

  // Aura ring when charged (mana >= manaMax)
  if (mesh.userData.auraRing) {
    const charged = u.mana >= u.manaMax * 0.95;
    const tgt = charged ? 0.6 + Math.sin(now * 4) * 0.25 : 0;
    mesh.userData.auraRing.material.opacity += (tgt - mesh.userData.auraRing.material.opacity) * Math.min(1, dt * 6);
    mesh.userData.auraRing.scale.setScalar(1 + (charged ? Math.sin(now * 4) * 0.08 : 0));
  }
  // Staff gem pulse
  const w = b.weapon;
  if (w && w.userData && w.userData.gem) {
    w.userData.gem.rotation.y += dt * 2;
    const charged = u.mana >= u.manaMax * 0.95;
    w.userData.gem.scale.setScalar(1 + (charged ? Math.sin(now * 4) * 0.3 : 0));
  }

  // Beast rig animation
  if (b.body && b.snout) {
    // Beast walk-bob
    if (u.moving) {
      b.body.rotation.x = Math.sin(now * 8) * 0.06;
      b.head.position.y = 0.55 + Math.abs(Math.sin(now * 8)) * 0.04;
    } else {
      b.body.rotation.x *= 0.85;
      b.head.position.y = 0.55;
    }
    if (b.tail) b.tail.rotation.z = Math.sin(now * 3) * 0.4;
    if (u.attacking) {
      // Lunge forward briefly
      mesh.children.forEach(c => {});
    }
    return;
  }

  // Humanoid animation
  if (!b.hips) return;

  // STATE: which animation?
  // Attacking gets priority, then walking, else idle
  const isCast = u.casting > 0;
  const isAttack = u.attackAnim > 0;
  const isMoving = u.moving;

  if (isCast) {
    // CAST POSE — both arms raised, slight float
    u.castingPhase = (u.castingPhase || 0) + dt;
    const ph = u.castingPhase;
    b.leftArm.rotation.x = -Math.PI/1.5 + Math.sin(ph * 6) * 0.15;
    b.rightArm.rotation.x = -Math.PI/1.5 + Math.sin(ph * 6) * 0.15;
    b.leftArm.rotation.z = -0.5;
    b.rightArm.rotation.z = 0.5;
    b.torso.rotation.y *= 0.9;
    b.hips.position.y = 0.78 + Math.sin(ph * 4) * 0.04;
    u.casting -= dt;
  } else if (isAttack) {
    // ATTACK — sword swing or bow draw
    const cls = u.def.class;
    const t = 1 - (u.attackAnim / u.attackAnimMax);
    if (cls === 'ranger') {
      // Bow draw + release
      b.rightArm.rotation.x = -Math.PI/2 - 0.3 * Math.sin(t * Math.PI);
      b.leftArm.rotation.x = -Math.PI/2 + 0.6 * Math.sin(t * Math.PI);
    } else if (cls === 'assassin') {
      // Quick stab — right arm thrust
      b.rightArm.rotation.x = -Math.PI/2 - 0.8 * Math.sin(t * Math.PI);
    } else {
      // Sword/melee swing — overhead arc
      const swing = Math.sin(t * Math.PI);
      b.rightArm.rotation.x = -Math.PI/2 + 1.2 * (t < 0.5 ? -t : (1-t)) * 2;
      b.rightArm.rotation.z = 0.2 + swing * 0.4;
      b.torso.rotation.y = (u.side === 'player' ? -1 : 1) * swing * 0.25;
    }
    u.attackAnim -= dt;
  } else if (isMoving) {
    // WALK CYCLE
    u.walkPhase = (u.walkPhase || 0) + dt * (u.def.atkSpeed * 6 + 6);
    const ph = u.walkPhase;
    b.leftLeg.rotation.x = Math.sin(ph) * 0.55;
    b.rightLeg.rotation.x = -Math.sin(ph) * 0.55;
    b.leftArm.rotation.x = -Math.sin(ph) * 0.40;
    b.rightArm.rotation.x = Math.sin(ph) * 0.40;
    b.hips.position.y = 0.78 + Math.abs(Math.sin(ph * 2)) * 0.06;
    b.torso.rotation.y = Math.sin(ph) * 0.07;
  } else {
    // IDLE — slow breathing
    const ph = now * 1.4;
    b.hips.position.y = 0.78 + Math.sin(ph) * 0.025;
    b.torso.rotation.y *= 0.92;
    b.leftLeg.rotation.x *= 0.85;
    b.rightLeg.rotation.x *= 0.85;
    b.leftArm.rotation.x *= 0.85;
    b.rightArm.rotation.x *= 0.85;
    b.rightArm.rotation.z = 0.1 + Math.sin(ph * 0.7) * 0.02;
  }
}

// =========================================================================
// SYNERGY COMPUTATION
// =========================================================================
function computeSynergies(boardUnits){
  // Count distinct unit-keys (1★/2★/3★ same) by origin and class
  const seen = new Set();
  const originCount = {}, classCount = {};
  for (const u of boardUnits) {
    if (!u || u.hp <= 0) continue;
    if (seen.has(u.heroKey)) continue;
    seen.add(u.heroKey);
    originCount[u.def.origin] = (originCount[u.def.origin]||0) + 1;
    classCount[u.def.class] = (classCount[u.def.class]||0) + 1;
  }
  // Determine active bonuses
  const activeBonuses = [];
  for (const ok of Object.keys(ORIGINS)) {
    const o = ORIGINS[ok]; const n = originCount[ok]||0;
    let active = null;
    for (const b of o.bonuses) { if (n >= b.n) active = b; }
    activeBonuses.push({ kind:'origin', key:ok, count:n, active, def:o });
  }
  for (const ck of Object.keys(CLASSES)) {
    const c = CLASSES[ck]; const n = classCount[ck]||0;
    let active = null;
    for (const b of c.bonuses) { if (n >= b.n) active = b; }
    activeBonuses.push({ kind:'class', key:ck, count:n, active, def:c });
  }
  return { originCount, classCount, activeBonuses };
}

function applySynergiesToTeam(unitsList){
  // Initialize team-wide buff structure
  const teamBuff = { hpMul:1, dmgMul:1, atkSpeedMul:1, manaPerHit:1, manaCostMul:1, lifesteal:0, corpseRise:false,
    armorBonus:0, spellMul:1, rangerSpeedBonus:0, healPulse:0, critDmgBonus:0, critChance:0, teamArmor:0, regen:0 };
  const syn = computeSynergies(unitsList);
  for (const ab of syn.activeBonuses) {
    if (ab.active && ab.active.apply) ab.active.apply(teamBuff);
  }
  // Apply to each unit
  for (const u of unitsList) {
    if (!u) continue;
    u.maxHp = u.def.hp * Math.pow(1.8, u.stars - 1) * teamBuff.hpMul;
    u.hp = u.maxHp;
    u.dmg = u.def.dmg * Math.pow(1.8, u.stars - 1) * teamBuff.dmgMul;
    u.armor = u.def.armor + teamBuff.armorBonus + teamBuff.teamArmor;
    u.atkSpeed = u.def.atkSpeed * teamBuff.atkSpeedMul;
    if (u.def.class === 'ranger' && teamBuff.rangerSpeedBonus > 0) u.atkSpeed = u.atkSpeed * (1 + teamBuff.rangerSpeedBonus);
    u.status.lifesteal = teamBuff.lifesteal;
    u.status.corpseRise = teamBuff.corpseRise;
    u.status.healPulse = teamBuff.healPulse;
    u.status.regen = teamBuff.regen;
    u.status.critChance = teamBuff.critChance || 0;
    u.status.critDmgBonus = teamBuff.critDmgBonus || 0;
    u.status.spellMul = teamBuff.spellMul || 1;
    u.status.manaPerHit = teamBuff.manaPerHit || 1;
    u.status.manaCostMul = teamBuff.manaCostMul || 1;
  }
  return syn;
}


// =========================================================================
// COMBAT SYSTEM — auto-resolve, units attack/move/cast based on stats
// =========================================================================
function startCombat(){
  STATE.phase = 'combat';
  STATE.combatTimer = 0;
  STATE.combatResult = null;
  // Build enemy team based on round
  generateEnemyTeam();
  // Mirror player board → combat units
  STATE.combatUnits = [];
  // Player units
  for (let r = PLAYER_ROW_MIN; r < ROWS; r++) {
    for (let c = 0; c < COLS; c++) {
      const u = STATE.board[r] && STATE.board[r][c];
      if (u) {
        const cu = cloneUnitForCombat(u, 'player', r, c);
        STATE.combatUnits.push(cu);
      }
    }
  }
  // Enemy units
  for (let r = 0; r < PLAYER_ROW_MIN; r++) {
    for (let c = 0; c < COLS; c++) {
      const u = STATE.enemyBoard[r] && STATE.enemyBoard[r][c];
      if (u) {
        const cu = cloneUnitForCombat(u, 'enemy', r, c);
        STATE.combatUnits.push(cu);
      }
    }
  }
  // Apply synergies (player team)
  applySynergiesToTeam(STATE.combatUnits.filter(u => u.side === 'player'));
  applySynergiesToTeam(STATE.combatUnits.filter(u => u.side === 'enemy'));
  // Build meshes for combat
  for (const u of STATE.combatUnits) {
    const mesh = buildUnitMesh(u);
    const { x, z } = cellToWorld(u.row, u.col);
    u.x = x; u.z = z; u.visualX = x; u.visualZ = z;
    u.facing = u.side === 'player' ? Math.PI : 0;   // face the enemy
    mesh.position.set(x, 0, z);
    scene.add(mesh);
    unitMeshes.set(u.id, mesh);
  }
  // Hide board placeholder meshes (those built in shop phase)
  for (const u of STATE.bench) {
    const m = unitMeshes.get('bench_' + u.id);
    if (m) m.visible = false;
  }
  showPhaseBanner('COMBAT', '⚔ Fight!');
  playSound('combat_start');
  document.getElementById('deckPanel').classList.add('combat');
  renderHUD();
}
function cloneUnitForCombat(u, side, row, col){
  const cu = {
    id: nextId++, heroKey:u.heroKey, stars:u.stars, def:u.def,
    hp: u.maxHp, maxHp: u.maxHp, dmg: u.dmg, range: u.def.range, atkSpeed: u.def.atkSpeed,
    armor: u.def.armor, mana: 0, manaMax: u.def.manaMax,
    side, row, col, target:null, cooldown:0, attackAnim:0, attackAnimMax:0.3, casting:0, moving:false,
    visualX:0, visualZ:0, facing:0, walkPhase:Math.random() * Math.PI * 2,
    status:{ shield:0, stun:0, enrage:0, enrageMul:1, buffShots:0, buffShotsBonus:0,
              taunt:0, dmgBuff:0, dmgBuffMul:1, lifesteal:0, regen:0, critChance:0, critDmgBonus:0,
              auraDmg:0, auraDur:0, auraRadius:0, spellMul:1, manaPerHit:1, manaCostMul:1, healPulse:0, corpseRise:false },
  };
  return cu;
}
function generateEnemyTeam(){
  // Pick 'difficulty' = round number — enemy unit count + tier mix scales
  STATE.enemyBoard = [];
  for (let r = 0; r < ROWS; r++) STATE.enemyBoard[r] = [];
  const round = STATE.round;
  const numUnits = Math.min(8, 1 + Math.floor((round - 1) * 1.0));
  // Build pool weighted by round
  const tierWeights = round < 3 ? [1, 0.3, 0, 0, 0]
                    : round < 5 ? [0.5, 0.4, 0.2, 0, 0]
                    : round < 7 ? [0.3, 0.4, 0.3, 0.1, 0]
                    : round < 9 ? [0.15, 0.3, 0.35, 0.2, 0.05]
                    :              [0.05, 0.2, 0.35, 0.3, 0.15];
  for (let i = 0; i < numUnits; i++) {
    let tier = 1, r = Math.random(), acc = 0;
    for (let t = 1; t <= 5; t++) { acc += tierWeights[t-1]; if (r < acc) { tier = t; break; } }
    const pool = tierPool(tier);
    const key = pool[Math.floor(Math.random() * pool.length)];
    // Random star upgrade chance from round 4 onwards
    const stars = round >= 6 && Math.random() < 0.25 ? 2 : 1;
    const unit = makeUnit(key, stars);
    unit.side = 'enemy';
    // Place randomly in enemy half
    let placed = false, tries = 0;
    while (!placed && tries++ < 50) {
      const r2 = Math.floor(Math.random() * PLAYER_ROW_MIN);
      const c2 = Math.floor(Math.random() * COLS);
      if (!STATE.enemyBoard[r2][c2]) {
        STATE.enemyBoard[r2][c2] = unit;
        unit.row = r2; unit.col = c2;
        placed = true;
      }
    }
  }
}

// Find nearest enemy
function dist(a, b){ return Math.hypot(a.x - b.x, a.z - b.z); }
function combatFindTarget(u){
  let best = null, bd = Infinity;
  for (const e of STATE.combatUnits) {
    if (e.side === u.side || e.hp <= 0) continue;
    const d = dist(u, e);
    if (d < bd) { bd = d; best = e; }
  }
  return best;
}
function combatMoveToward(u, target, dt){
  // Move along grid toward target. Simple: slide cell-by-cell.
  const dx = target.x - u.x, dz = target.z - u.z;
  const d = Math.hypot(dx, dz);
  if (d < 0.05) { u.moving = false; return; }
  const speed = 3.0;
  u.x += (dx/d) * speed * dt;
  u.z += (dz/d) * speed * dt;
  u.facing = Math.atan2(dx, dz);
  u.moving = true;
  // Push apart from allies to avoid stacking
  for (const o of STATE.combatUnits) {
    if (o === u || o.side !== u.side || o.hp <= 0) continue;
    const ox = u.x - o.x, oz = u.z - o.z, od = Math.hypot(ox, oz);
    const min = 0.7;
    if (od < min && od > 0.01) {
      u.x += (ox/od) * (min - od) * 0.4;
      u.z += (oz/od) * (min - od) * 0.4;
    }
  }
}

function applyDamage(target, dmg, attacker){
  if (!target || target.hp <= 0) return 0;
  // Armor reduction (armor % = armor / (armor + 100))
  const armor = target.armor || 0;
  const reduction = armor / (armor + 100);
  let final = dmg * (1 - reduction);
  // Shield absorbs first
  if (target.status.shield > 0) {
    const absorbed = Math.min(target.status.shield, final);
    target.status.shield -= absorbed;
    final -= absorbed;
  }
  target.hp -= final;
  target.flinch = 0.18;
  // Mana on hit
  target.mana = Math.min(target.manaMax, target.mana + 10 * (target.status.manaPerHit||1));
  // Lifesteal for attacker
  if (attacker && attacker.status.lifesteal > 0) {
    attacker.hp = Math.min(attacker.maxHp, attacker.hp + final * attacker.status.lifesteal);
  }
  if (target.hp <= 0) {
    target.hp = 0;
    onUnitDeath(target, attacker);
  }
  return final;
}

function onUnitDeath(u, killer){
  playSound('death');
  spawnFX({ type:'death', x:u.x, z:u.z });
  // Undead corpseRise: spawn ghoul on killer's team
  if (killer && killer.status.corpseRise && Math.random() < 0.5) {
    const ghoul = makeUnit('ghoul', 1);
    ghoul.side = killer.side;
    const cu = cloneUnitForCombat(ghoul, killer.side, u.row, u.col);
    cu.x = u.x; cu.z = u.z; cu.visualX = u.x; cu.visualZ = u.z;
    STATE.combatUnits.push(cu);
    const m = buildUnitMesh(cu);
    m.position.set(cu.x, 0, cu.z);
    scene.add(m); unitMeshes.set(cu.id, m);
    spawnFX({ type:'summon', x:u.x, z:u.z });
  }
}

function combatFireWeapon(u, target){
  // Standard attack — also triggers some abilities passively
  const cls = u.def.class;
  let dmg = u.dmg;
  // Buffed shots (Scout precision)
  if (u.status.buffShots > 0) {
    dmg += u.status.buffShotsBonus || 0;
    u.status.buffShots--;
  }
  // Enrage
  if (u.status.enrage > 0) dmg *= u.status.enrageMul;
  // Allies dmg buff
  if (u.status.dmgBuff > 0) dmg *= u.status.dmgBuffMul;
  // Crit
  let crit = false;
  if (u.status.critChance > 0 && Math.random() < u.status.critChance) {
    crit = true;
    dmg *= (1 + (u.status.critDmgBonus || 0.5));
    playSound('crit');
  }
  applyDamage(target, dmg, u);
  // Build mana on attack
  u.mana = Math.min(u.manaMax, u.mana + 5 * (u.status.manaPerHit||1));
  // Projectile/melee VFX
  if (cls === 'ranger') { spawnProjectile(u, target, 'arrow'); playSound('bow'); }
  else if (cls === 'mage') { /* basic mage attack is a small bolt */ spawnProjectile(u, target, 'bolt', u.def.origin === 'dragon' ? 0xff6040 : 0x8060ff); playSound('spell'); }
  else if (cls === 'healer') { spawnProjectile(u, target, 'bolt', 0xfff088); playSound('spell'); }
  else if (cls === 'assassin') { playSound('sword'); spawnFX({ type:'slash', x:target.x, z:target.z, color:0xff80a0 }); }
  else { playSound('sword'); spawnFX({ type:'slash', x:target.x, z:target.z, color:0xfff088 }); }
  u.attackAnim = 0.3; u.attackAnimMax = 0.3;
}

// =========================================================================
// ABILITY TRIGGERS — fired when unit reaches full mana
// =========================================================================
function tryFireAbility(u){
  if (u.mana < u.manaMax) return false;
  if (u.status.stun > 0) return false;
  const a = u.def.ability; if (!a) return false;
  const cost = u.manaMax * (u.status.manaCostMul || 1);
  if (u.mana < cost) return false;
  u.mana = 0;
  u.casting = 0.4; u.castingPhase = 0;
  playSound('ability');
  spawnFX({ type:'castFlash', x:u.x, z:u.z, color: ORIGINS[u.def.origin].glow });
  setTimeout(() => doAbility(u, a), 200);
  return true;
}
function doAbility(u, a){
  if (u.hp <= 0) return;
  const t = u.target;
  const allyList = STATE.combatUnits.filter(x => x.side === u.side && x.hp > 0);
  const enemyList = STATE.combatUnits.filter(x => x.side !== u.side && x.hp > 0);
  if (a.kind === 'stunSelfArmor') {
    if (t) { t.status.stun = a.stun; spawnFX({ type:'stun', x:t.x, z:t.z }); }
    u.armor += a.armor; setTimeout(() => { u.armor = Math.max(u.def.armor, u.armor - a.armor); }, 5000);
  } else if (a.kind === 'buffShots') {
    u.status.buffShots = a.shots; u.status.buffShotsBonus = a.bonus;
    spawnFX({ type:'buffSelf', x:u.x, z:u.z, color:0xfff088 });
  } else if (a.kind === 'spellSingle') {
    if (t) { applyDamage(t, a.dmg * (u.status.spellMul||1), u); spawnFX({ type:'impact', x:t.x, z:t.z, color:0x8060ff }); spawnProjectile(u, t, 'bolt', 0xa080ff); }
  } else if (a.kind === 'healAlly') {
    const lowAlly = allyList.filter(x => x !== u).sort((a,b) => (a.hp/a.maxHp) - (b.hp/b.maxHp))[0];
    if (lowAlly) { lowAlly.hp = Math.min(lowAlly.maxHp, lowAlly.hp + a.heal); spawnFX({ type:'heal', x:lowAlly.x, z:lowAlly.z }); playSound('heal'); }
  } else if (a.kind === 'lunge') {
    if (t) {
      u.x = t.x + (Math.random()-0.5) * 0.2; u.z = t.z + (Math.random()-0.5) * 0.2;
      applyDamage(t, a.dmg, u); spawnFX({ type:'lunge', x:t.x, z:t.z });
    }
  } else if (a.kind === 'enrageSelf') {
    u.status.enrage = a.dur; u.status.enrageMul = a.mul;
    setTimeout(() => { u.status.enrage = 0; u.status.enrageMul = 1; }, a.dur * 1000);
    playSound('roar');
    spawnFX({ type:'roar', x:u.x, z:u.z });
  } else if (a.kind === 'taunt') {
    u.armor += a.armor;
    for (const e of enemyList) {
      if (dist(u, e) < 3) e.target = u;
    }
    setTimeout(() => u.armor = Math.max(u.def.armor, u.armor - a.armor), a.dur * 1000);
  } else if (a.kind === 'spellAoe') {
    if (t) {
      for (const e of enemyList) {
        if (dist(t, e) < a.radius) applyDamage(e, a.dmg * (u.status.spellMul||1), u);
      }
      spawnFX({ type:'fireball', x:t.x, z:t.z, radius:a.radius });
      playSound('fire');
    }
  } else if (a.kind === 'multiArrow') {
    for (let i = 0; i < a.count; i++) {
      const tgt = enemyList[Math.floor(Math.random() * enemyList.length)];
      if (tgt) { setTimeout(() => { if (tgt.hp > 0) { applyDamage(tgt, a.dmg, u); spawnProjectile(u, tgt, 'arrow'); } }, i * 80); }
    }
    playSound('bow');
  } else if (a.kind === 'summon') {
    const summon = makeUnit(a.summonKey, 1);
    summon.side = u.side;
    const cu = cloneUnitForCombat(summon, u.side, u.row, u.col);
    cu.x = u.x + 0.6; cu.z = u.z + 0.6; cu.visualX = cu.x; cu.visualZ = cu.z;
    STATE.combatUnits.push(cu);
    const m = buildUnitMesh(cu);
    m.position.set(cu.x, 0, cu.z);
    scene.add(m); unitMeshes.set(cu.id, m);
    spawnFX({ type:'summon', x:cu.x, z:cu.z });
    playSound('summon');
  } else if (a.kind === 'totem') {
    const totem = { id:nextId++, isTotem:true, side:u.side, x:u.x, z:u.z + 0.5, hp:a.hp, maxHp:a.hp, healPerSec:a.healPerSec, radius:a.radius, life:8 };
    STATE.combatUnits.push(totem);
    const tMesh = new THREE.Group();
    const base = new THREE.Mesh(new THREE.CylinderGeometry(0.15, 0.20, 0.6, 8), paintedMat(0x4a2810));
    base.position.y = 0.3; tMesh.add(base);
    const glow = new THREE.Mesh(new THREE.SphereGeometry(0.20, 12, 8), basicMat(0x80ffa0, { transparent:true, opacity:0.85 }));
    glow.position.y = 0.75; tMesh.add(glow);
    tMesh.position.set(totem.x, 0, totem.z);
    scene.add(tMesh); unitMeshes.set(totem.id, tMesh);
    spawnFX({ type:'summon', x:totem.x, z:totem.z });
  } else if (a.kind === 'shieldAura') {
    for (const al of allyList) {
      if (dist(u, al) < a.radius) al.status.shield = (al.status.shield||0) + a.shield;
      spawnFX({ type:'shield', x:al.x, z:al.z });
    }
    playSound('heal');
  } else if (a.kind === 'cone') {
    for (const e of enemyList) {
      const dx = e.x - u.x, dz = e.z - u.z;
      const fwd = Math.cos(u.facing) * dz + Math.sin(u.facing) * dx;
      const side = Math.cos(u.facing) * dx - Math.sin(u.facing) * dz;
      if (fwd > 0 && fwd < a.range && Math.abs(side) < a.width) {
        applyDamage(e, a.dmg * (u.status.spellMul||1), u);
        spawnFX({ type:'fire', x:e.x, z:e.z });
      }
    }
    playSound('fire');
  } else if (a.kind === 'teleStrike') {
    const tgt = enemyList.sort((a,b) => b.def.tier - a.def.tier)[0];
    if (tgt) {
      u.x = tgt.x + 0.5; u.z = tgt.z + 0.5;
      let dmg = a.dmg;
      if (Math.random() < (u.status.critChance||0)) dmg *= 1.5;
      applyDamage(tgt, dmg, u);
      spawnFX({ type:'shadowStrike', x:tgt.x, z:tgt.z });
    }
  } else if (a.kind === 'buffAllies') {
    for (const al of allyList) {
      al.status.dmgBuff = a.dur;
      al.status.dmgBuffMul = a.mul;
      setTimeout(() => { al.status.dmgBuff = 0; al.status.dmgBuffMul = 1; }, a.dur * 1000);
      spawnFX({ type:'buffSelf', x:al.x, z:al.z, color:0xff8040 });
    }
    playSound('roar');
  } else if (a.kind === 'nova') {
    for (const e of enemyList) {
      applyDamage(e, a.dmg * (u.status.spellMul||1), u);
    }
    spawnFX({ type:'nova', x:u.x, z:u.z });
    playSound('fire');
  } else if (a.kind === 'healAll') {
    for (const al of allyList) {
      al.hp = Math.min(al.maxHp, al.hp + a.heal);
      al.status.stun = 0;
      spawnFX({ type:'heal', x:al.x, z:al.z });
    }
    playSound('heal');
  } else if (a.kind === 'aura') {
    u.status.auraDmg = a.dmg; u.status.auraDur = a.dur; u.status.auraRadius = a.radius;
    spawnFX({ type:'aura', x:u.x, z:u.z, color:0xff8040, radius:a.radius });
  } else if (a.kind === 'soulrend') {
    const sorted = enemyList.sort((a,b) => b.hp - a.hp);
    for (let i = 0; i < Math.min(a.count, sorted.length); i++) {
      const e = sorted[i];
      const wasAlive = e.hp > 0;
      applyDamage(e, a.dmg * (u.status.spellMul||1), u);
      if (wasAlive && e.hp <= 0) u.hp = Math.min(u.maxHp, u.hp + a.heal);
      spawnFX({ type:'soulrend', x:e.x, z:e.z });
    }
    playSound('spell');
  }
}


// =========================================================================
// PROJECTILES + FX
// =========================================================================
function spawnProjectile(from, to, kind, color){
  const proj = { id:nextId++, x:from.x, y:1.2, z:from.z, tx:to.x, ty:0.8, tz:to.z, kind, color:color||0xfff088, speed:14, life:0.6 };
  STATE.fxObjects.push({ type:'projectile', proj });
  let mesh;
  if (kind === 'arrow') {
    mesh = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.02, 0.30, 5), basicMat(0xf0c878));
    mesh.rotation.x = Math.PI/2;
    const tip = new THREE.Mesh(new THREE.ConeGeometry(0.03, 0.07, 4), basicMat(0xc0a878));
    tip.rotation.x = Math.PI/2; tip.position.z = 0.18; mesh.add(tip);
  } else {
    mesh = new THREE.Mesh(new THREE.SphereGeometry(0.10, 10, 8), basicMat(proj.color, { transparent:true, opacity:0.95 }));
    // Glow halo
    const halo = new THREE.Mesh(new THREE.SphereGeometry(0.22, 10, 8), basicMat(proj.color, { transparent:true, opacity:0.35, depthWrite:false }));
    mesh.add(halo);
  }
  mesh.position.set(proj.x, proj.y, proj.z);
  scene.add(mesh);
  fxMeshes.set(proj.id, mesh);
  proj.mesh = mesh;
}
function spawnFX(opts){
  const fx = { type:opts.type, x:opts.x, y:opts.y||0.1, z:opts.z, t:0, dur:0.6, color:opts.color, radius:opts.radius };
  let mesh;
  if (fx.type === 'death') {
    mesh = new THREE.Group();
    for (let i = 0; i < 8; i++) {
      const p = new THREE.Mesh(new THREE.SphereGeometry(0.05, 5, 4), basicMat(0xc04020));
      const a = Math.random() * Math.PI * 2;
      p.userData = { vx: Math.cos(a)*2, vy: 1+Math.random()*2, vz: Math.sin(a)*2 };
      mesh.add(p);
    }
    fx.dur = 1.2;
  } else if (fx.type === 'slash') {
    mesh = new THREE.Mesh(new THREE.PlaneGeometry(1.2, 0.3),
      basicMat(fx.color || 0xfff088, { transparent:true, opacity:0.85, side:THREE.DoubleSide, depthWrite:false }));
    mesh.rotation.x = -Math.PI/3; mesh.rotation.z = Math.random() * Math.PI;
    fx.dur = 0.25;
  } else if (fx.type === 'impact') {
    mesh = new THREE.Mesh(new THREE.SphereGeometry(0.30, 12, 10),
      basicMat(fx.color || 0xfff088, { transparent:true, opacity:0.95 }));
    fx.dur = 0.35;
  } else if (fx.type === 'fireball') {
    mesh = new THREE.Group();
    const core = new THREE.Mesh(new THREE.SphereGeometry(fx.radius || 1.2, 14, 10), basicMat(0xff8040, { transparent:true, opacity:0.85 }));
    mesh.add(core);
    const ring = new THREE.Mesh(new THREE.RingGeometry(fx.radius*0.9, fx.radius*1.1, 24), basicMat(0xff5020, { transparent:true, opacity:0.75, side:THREE.DoubleSide, depthWrite:false }));
    ring.rotation.x = -Math.PI/2; mesh.add(ring);
    fx.dur = 0.6;
  } else if (fx.type === 'castFlash') {
    mesh = new THREE.Mesh(new THREE.SphereGeometry(0.5, 12, 8), basicMat(fx.color || 0xffe888, { transparent:true, opacity:1 }));
    fx.dur = 0.3;
  } else if (fx.type === 'heal') {
    mesh = new THREE.Group();
    for (let i = 0; i < 4; i++) {
      const p = new THREE.Mesh(new THREE.SphereGeometry(0.06, 6, 5), basicMat(0x80ff80));
      const a = (i / 4) * Math.PI * 2;
      p.position.set(Math.cos(a) * 0.4, 0.3, Math.sin(a) * 0.4);
      p.userData = { vy: 1.5 };
      mesh.add(p);
    }
    fx.dur = 0.8;
  } else if (fx.type === 'lunge') {
    mesh = new THREE.Mesh(new THREE.PlaneGeometry(1.5, 0.4),
      basicMat(0xff4080, { transparent:true, opacity:0.85, side:THREE.DoubleSide, depthWrite:false }));
    mesh.rotation.x = -Math.PI/2; fx.dur = 0.3;
  } else if (fx.type === 'roar') {
    mesh = new THREE.Mesh(new THREE.RingGeometry(0.4, 0.6, 24),
      basicMat(0xff4040, { transparent:true, opacity:0.9, side:THREE.DoubleSide, depthWrite:false }));
    mesh.rotation.x = -Math.PI/2; fx.dur = 0.6;
  } else if (fx.type === 'stun') {
    mesh = new THREE.Mesh(new THREE.RingGeometry(0.3, 0.4, 16),
      basicMat(0xffe888, { transparent:true, opacity:0.95, side:THREE.DoubleSide, depthWrite:false }));
    mesh.rotation.x = -Math.PI/2; mesh.position.y = 1.6; fx.dur = 0.5;
  } else if (fx.type === 'buffSelf') {
    mesh = new THREE.Mesh(new THREE.RingGeometry(0.4, 0.55, 24),
      basicMat(fx.color || 0xffe888, { transparent:true, opacity:0.95, side:THREE.DoubleSide, depthWrite:false }));
    mesh.rotation.x = -Math.PI/2; fx.dur = 0.5;
  } else if (fx.type === 'shield') {
    mesh = new THREE.Mesh(new THREE.SphereGeometry(0.5, 14, 10), basicMat(0x80c0ff, { transparent:true, opacity:0.45, depthWrite:false }));
    mesh.position.y = 0.7; fx.dur = 0.4;
  } else if (fx.type === 'fire') {
    mesh = new THREE.Mesh(new THREE.SphereGeometry(0.4, 12, 8), basicMat(0xff6020, { transparent:true, opacity:0.85 }));
    fx.dur = 0.4;
  } else if (fx.type === 'shadowStrike') {
    mesh = new THREE.Mesh(new THREE.SphereGeometry(0.5, 12, 10), basicMat(0x600080, { transparent:true, opacity:0.85 }));
    fx.dur = 0.4;
  } else if (fx.type === 'nova') {
    mesh = new THREE.Mesh(new THREE.RingGeometry(0.4, 2.0, 32),
      basicMat(0xa040ff, { transparent:true, opacity:0.85, side:THREE.DoubleSide, depthWrite:false }));
    mesh.rotation.x = -Math.PI/2; fx.dur = 0.7;
  } else if (fx.type === 'aura') {
    mesh = new THREE.Mesh(new THREE.RingGeometry((fx.radius||1.5) * 0.85, (fx.radius||1.5), 32),
      basicMat(fx.color || 0xff8040, { transparent:true, opacity:0.55, side:THREE.DoubleSide, depthWrite:false }));
    mesh.rotation.x = -Math.PI/2; fx.dur = 1.0;
  } else if (fx.type === 'summon') {
    mesh = new THREE.Mesh(new THREE.RingGeometry(0.4, 0.6, 24),
      basicMat(0xa0ffa0, { transparent:true, opacity:0.95, side:THREE.DoubleSide, depthWrite:false }));
    mesh.rotation.x = -Math.PI/2; fx.dur = 0.6;
  } else if (fx.type === 'soulrend') {
    mesh = new THREE.Mesh(new THREE.SphereGeometry(0.5, 14, 10), basicMat(0x6080ff, { transparent:true, opacity:0.8, depthWrite:false }));
    fx.dur = 0.5;
  } else if (fx.type === 'goldFly') {
    mesh = new THREE.Mesh(new THREE.SphereGeometry(0.08, 8, 6), basicMat(0xffe040));
    fx.dur = 0.6;
  }
  if (mesh) {
    mesh.position.set(fx.x, fx.y, fx.z);
    scene.add(mesh);
    fx.mesh = mesh;
    STATE.fxObjects.push(fx);
  }
}
function tickFX(dt){
  for (const fx of STATE.fxObjects) {
    if (fx.type === 'projectile') {
      const p = fx.proj;
      const dx = p.tx - p.x, dy = p.ty - p.y, dz = p.tz - p.z;
      const d = Math.hypot(dx, dy, dz);
      if (d < 0.4) { fx.dead = true; continue; }
      p.x += dx/d * p.speed * dt;
      p.y += dy/d * p.speed * dt;
      p.z += dz/d * p.speed * dt;
      p.mesh.position.set(p.x, p.y, p.z);
      if (p.kind === 'arrow') p.mesh.lookAt(p.tx, p.ty, p.tz);
      p.life -= dt;
      if (p.life <= 0) fx.dead = true;
    } else if (fx.mesh) {
      fx.t = (fx.t||0) + dt;
      const r = fx.t / fx.dur;
      if (r >= 1) { fx.dead = true; continue; }
      if (fx.type === 'death') {
        fx.mesh.children.forEach(p => {
          p.position.x += p.userData.vx * dt;
          p.position.y += p.userData.vy * dt;
          p.position.z += p.userData.vz * dt;
          p.userData.vy -= 8 * dt;
          if (p.material) p.material.opacity = 1 - r;
          p.material.transparent = true;
        });
      } else if (fx.type === 'fireball' || fx.type === 'roar' || fx.type === 'lunge' || fx.type === 'aura' || fx.type === 'buffSelf' || fx.type === 'summon' || fx.type === 'nova') {
        const s = 1 + r * 1.5;
        fx.mesh.scale.setScalar(s);
        fx.mesh.traverse(o => { if (o.material) { o.material.transparent = true; o.material.opacity = Math.max(0, (o.material.opacity || 1) * 0.92); } });
      } else if (fx.type === 'castFlash' || fx.type === 'impact' || fx.type === 'shadowStrike') {
        fx.mesh.scale.setScalar(1 + r * 1.5);
        if (fx.mesh.material) fx.mesh.material.opacity = Math.max(0, 1 - r);
      } else if (fx.type === 'slash' || fx.type === 'stun' || fx.type === 'shield' || fx.type === 'fire' || fx.type === 'soulrend') {
        fx.mesh.scale.setScalar(1 + r * 0.5);
        if (fx.mesh.material) fx.mesh.material.opacity = Math.max(0, (1 - r) * 0.9);
      } else if (fx.type === 'heal') {
        fx.mesh.children.forEach(p => { p.position.y += p.userData.vy * dt; if (p.material) p.material.opacity = 1 - r; p.material.transparent = true; });
      } else if (fx.type === 'goldFly') {
        fx.mesh.position.y += dt * 1.5;
        if (fx.mesh.material) fx.mesh.material.opacity = 1 - r;
      }
    }
  }
  // Cleanup dead
  for (const fx of STATE.fxObjects) {
    if (fx.dead) {
      if (fx.type === 'projectile') {
        const m = fxMeshes.get(fx.proj.id);
        if (m) { removeAndDispose(m); fxMeshes.delete(fx.proj.id); }
      } else if (fx.mesh) removeAndDispose(fx.mesh);
    }
  }
  STATE.fxObjects = STATE.fxObjects.filter(f => !f.dead);
}

// =========================================================================
// COMBAT UPDATE LOOP
// =========================================================================
function combatUpdate(dt){
  STATE.combatTimer += dt;
  // Aura damage (Flame Lord, etc.)
  for (const u of STATE.combatUnits) {
    if (!u || u.isTotem || u.hp <= 0) continue;
    if (u.status.auraDur > 0) {
      u.status.auraDur -= dt;
      for (const e of STATE.combatUnits) {
        if (!e || e === u || e.side === u.side || e.hp <= 0) continue;
        if (dist(u, e) < (u.status.auraRadius||1.5)) {
          applyDamage(e, u.status.auraDmg * dt, u);
        }
      }
    }
    // Regen
    if (u.status.regen > 0 && u.hp < u.maxHp) {
      u.hp = Math.min(u.maxHp, u.hp + u.status.regen * dt);
    }
    // Healer pulse
    if (u.status.healPulse > 0) {
      const lowest = STATE.combatUnits.filter(x => x.side === u.side && x.hp > 0 && x.hp < x.maxHp).sort((a,b) => (a.hp/a.maxHp) - (b.hp/b.maxHp))[0];
      if (lowest) lowest.hp = Math.min(lowest.maxHp, lowest.hp + u.status.healPulse * dt);
    }
  }
  // Totems
  for (const t of STATE.combatUnits) {
    if (!t || !t.isTotem) continue;
    t.life -= dt;
    if (t.life <= 0 || t.hp <= 0) { t.hp = 0; }
    // Heal allies in range
    for (const a of STATE.combatUnits) {
      if (!a || a.side !== t.side || a === t || a.hp <= 0) continue;
      if (dist(t, a) < t.radius) a.hp = Math.min(a.maxHp, a.hp + t.healPerSec * dt);
    }
  }
  // Per-unit AI
  for (const u of STATE.combatUnits) {
    if (!u || u.isTotem || u.hp <= 0) continue;
    if (u.status.stun > 0) { u.status.stun -= dt; u.moving = false; continue; }
    // Try fire ability if mana full
    tryFireAbility(u);
    // Find target
    if (!u.target || u.target.hp <= 0) u.target = combatFindTarget(u);
    if (u.cooldown > 0) u.cooldown -= dt;
    if (u.attackAnim > 0) { /* still animating */ }
    if (u.target) {
      const d = dist(u, u.target);
      if (d <= u.range * 1.6 + 0.1) {
        u.moving = false;
        if (u.cooldown <= 0 && u.attackAnim <= 0 && u.casting <= 0) {
          combatFireWeapon(u, u.target);
          u.cooldown = u.atkSpeed;
        }
        // Face target
        u.facing = Math.atan2(u.target.x - u.x, u.target.z - u.z);
      } else {
        combatMoveToward(u, u.target, dt);
      }
    }
  }
  // Cleanup dead units' meshes after fade
  for (const u of STATE.combatUnits) {
    if (!u || u.hp > 0) continue;
    if (!u._fadeT) u._fadeT = 0;
    u._fadeT += dt;
    const m = unitMeshes.get(u.id);
    if (m) {
      m.traverse(o => { if (o.material) { o.material.transparent = true; o.material.opacity = Math.max(0, 1 - u._fadeT / 0.8); } });
      m.position.y = -u._fadeT * 0.5;
    }
    if (u._fadeT > 1.0) {
      if (m) { removeAndDispose(m); unitMeshes.delete(u.id); }
      u._removed = true;
    }
  }
  STATE.combatUnits = STATE.combatUnits.filter(u => !u._removed);
  // Check end condition: one side wiped
  const playerAlive = STATE.combatUnits.some(u => u.side === 'player' && !u.isTotem && u.hp > 0);
  const enemyAlive = STATE.combatUnits.some(u => u.side === 'enemy' && !u.isTotem && u.hp > 0);
  if (!playerAlive && !enemyAlive) { endCombat('draw'); return; }
  if (!playerAlive) { endCombat('lose'); return; }
  if (!enemyAlive) { endCombat('win'); return; }
  if (STATE.combatTimer > 50) {
    // Timeout — count units, more wins
    const pn = STATE.combatUnits.filter(u => u.side === 'player' && u.hp > 0).length;
    const en = STATE.combatUnits.filter(u => u.side === 'enemy' && u.hp > 0).length;
    endCombat(pn > en ? 'win' : pn < en ? 'lose' : 'draw');
  }
}

function endCombat(result){
  if (STATE.combatResult) return;
  STATE.combatResult = result;
  let dmg = 0, gold = 5;
  if (result === 'win') {
    STATE.winStreak++; STATE.loseStreak = 0;
    gold += Math.min(3, STATE.winStreak);
    playSound('win');
  } else if (result === 'lose') {
    STATE.loseStreak++; STATE.winStreak = 0;
    // Damage = surviving enemies × tier
    let survivor = 0;
    for (const u of STATE.combatUnits) if (u.side === 'enemy' && u.hp > 0 && !u.isTotem) survivor += (u.def.tier || 1) + 2;
    dmg = Math.min(35, Math.max(5, survivor));
    STATE.hp -= dmg;
    gold += Math.min(3, STATE.loseStreak);
    playSound('lose');
  } else {
    playSound('lose');
  }
  STATE.gold += gold;
  // Display result banner
  const cr = document.getElementById('combatResult');
  cr.className = 'combat-result show ' + (result === 'win' ? 'win' : 'lose');
  document.getElementById('combatResultTitle').textContent = result === 'win' ? 'VICTORY' : result === 'lose' ? 'DEFEAT' : 'DRAW';
  document.getElementById('combatResultSub').textContent = result === 'win'
    ? `+${gold} gold`
    : (dmg > 0 ? `-${dmg} HP, +${gold} gold` : `+${gold} gold`);
  setTimeout(() => { cr.classList.remove('show'); endRound(); }, 2500);
}


// =========================================================================
// BLOOD + GORE FX (added: persistent corpses, blood pools, splatter)
// =========================================================================
const PERSISTENT_DECALS = [];   // blood pools / bones / corpses (kept across rounds till new combat)

function spawnBloodSplatter(x, z, intensity){
  intensity = intensity || 1;
  for (let i = 0; i < 6 * intensity; i++) {
    const a = Math.random() * Math.PI * 2;
    const drop = new THREE.Mesh(new THREE.SphereGeometry(0.04 + Math.random()*0.04, 5, 4),
      basicMat(0x80100c));
    drop.position.set(x, 0.8 + Math.random()*0.3, z);
    drop.userData = { vx:Math.cos(a) * (1.5 + Math.random()*2), vy:1+Math.random()*2.5, vz:Math.sin(a) * (1.5 + Math.random()*2) };
    scene.add(drop);
    STATE.fxObjects.push({ type:'blooddrop', mesh:drop, t:0, dur:1.5 });
  }
}
function spawnBloodPool(x, z, size){
  size = size || 0.55;
  const pool = new THREE.Mesh(
    new THREE.CircleGeometry(size, 14),
    basicMat(0x500804, { transparent:true, opacity:0.85, depthWrite:false }));
  pool.rotation.x = -Math.PI/2;
  pool.position.set(x + (Math.random()-0.5)*0.2, 0.06, z + (Math.random()-0.5)*0.2);
  pool.userData.bloodPool = true;
  scene.add(pool);
  PERSISTENT_DECALS.push(pool);
}
function spawnBloodStain(x, z, size){
  size = size || 0.18;
  const stain = new THREE.Mesh(
    new THREE.CircleGeometry(size, 8),
    basicMat(0x300604, { transparent:true, opacity:0.65, depthWrite:false }));
  stain.rotation.x = -Math.PI/2;
  stain.position.set(x, 0.05, z);
  scene.add(stain);
  PERSISTENT_DECALS.push(stain);
}
function spawnCorpse(unit){
  // Build a simplified static corpse mesh — body sprawled flat
  const c = new THREE.Group();
  const cls = unit.def.class;
  const origin = ORIGINS[unit.def.origin] || ORIGINS.human;
  const skin = unit.def.origin === 'orc' ? 0x70a060 : unit.def.origin === 'undead' ? 0xb0a8c0 : 0xe8c8a0;
  // Torso (flat)
  const t = new THREE.Mesh(new THREE.SphereGeometry(0.30, 10, 8), paintedMat(origin.color));
  t.scale.set(0.95, 0.35, 0.65);
  t.position.set(0, 0.18, 0); c.add(t);
  // Head sideways
  const h = new THREE.Mesh(new THREE.SphereGeometry(0.18, 10, 8), paintedMat(skin));
  h.scale.set(0.95, 0.5, 0.95);
  h.position.set(0.30, 0.13, -0.10); c.add(h);
  // Legs splayed
  for (const xs of [-0.10, 0.10]) {
    const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.075, 0.07, 0.50, 6), paintedMat(0x3a1810));
    leg.position.set(-0.20 + xs, 0.10, xs * 2);
    leg.rotation.z = Math.PI / 2 + (xs > 0 ? 0.3 : -0.3);
    c.add(leg);
  }
  // Arms thrown out
  for (const xs of [-0.30, 0.30]) {
    const arm = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.07, 0.40, 6), paintedMat(origin.color));
    arm.position.set(0.10, 0.18, xs);
    arm.rotation.x = Math.PI/2 + (xs > 0 ? -0.3 : 0.3);
    c.add(arm);
  }
  // Weapon scattered nearby
  const wpn = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.35, 0.02), metalMat(0x808080, { metalness:0.7, roughness:0.4 }));
  wpn.position.set(-0.5, 0.08, 0.20); wpn.rotation.z = 0.3; c.add(wpn);
  c.position.set(unit.x, 0, unit.z);
  c.rotation.y = Math.random() * Math.PI * 2;
  scene.add(c);
  PERSISTENT_DECALS.push(c);
}

function clearPersistentDecals(){
  for (const d of PERSISTENT_DECALS) removeAndDispose(d);
  PERSISTENT_DECALS.length = 0;
}

// Hook the death effects into existing applyDamage / onUnitDeath
function onUnitHit(target, dmg){
  // Blood splatter on damage taken (sometimes)
  if (Math.random() < Math.min(0.65, dmg / 200)) {
    spawnBloodSplatter(target.x, target.z, dmg > 150 ? 2 : 1);
  }
  // Small stain on heavy hits
  if (dmg > 100) spawnBloodStain(target.x + (Math.random()-0.5)*0.3, target.z + (Math.random()-0.5)*0.3, 0.10 + Math.random()*0.08);
}

// Wrap original applyDamage so we can hook gore
const _origApplyDamage = applyDamage;
applyDamage = function(target, dmg, attacker){
  if (!target) return 0;
  const before = target.hp;
  const r = _origApplyDamage(target, dmg, attacker);
  if (target.hp < before) onUnitHit(target, before - target.hp);
  return r;
};
// Wrap onUnitDeath so we leave a corpse + pool
const _origDeath = onUnitDeath;
onUnitDeath = function(u, killer){
  // Big gore burst
  spawnBloodSplatter(u.x, u.z, 3);
  spawnBloodPool(u.x, u.z, 0.55 + Math.random() * 0.2);
  // Multiple stains around
  for (let i = 0; i < 4; i++) spawnBloodStain(u.x + (Math.random()-0.5)*0.8, u.z + (Math.random()-0.5)*0.8, 0.08 + Math.random()*0.10);
  // Body chunks
  for (let i = 0; i < 5; i++) {
    const a = Math.random() * Math.PI * 2;
    const chunk = new THREE.Mesh(new THREE.DodecahedronGeometry(0.07 + Math.random()*0.04, 0),
      basicMat(Math.random() < 0.5 ? 0xa03020 : 0xe8dcc8));
    chunk.position.set(u.x, 0.7, u.z);
    chunk.userData = { vx:Math.cos(a) * (1.5+Math.random()*2.5), vy:1.5+Math.random()*2.5, vz:Math.sin(a) * (1.5+Math.random()*2.5), spin:(Math.random()-0.5)*10 };
    scene.add(chunk);
    STATE.fxObjects.push({ type:'chunk', mesh:chunk, t:0, dur:2.0 });
  }
  // Leave a corpse decal
  if (!u.isTotem && u.def) spawnCorpse(u);
  _origDeath(u, killer);
};

// Add gore-FX update tick — chunks/drops fall with gravity
function tickGore(dt){
  for (const fx of STATE.fxObjects) {
    if (fx.type === 'chunk' || fx.type === 'blooddrop') {
      const m = fx.mesh;
      m.position.x += fx.mesh.userData.vx * dt;
      m.position.y += fx.mesh.userData.vy * dt;
      m.position.z += fx.mesh.userData.vz * dt;
      fx.mesh.userData.vy -= 9.8 * dt;
      if (fx.type === 'chunk') m.rotation.x += fx.mesh.userData.spin * dt;
      if (m.position.y < 0.05) {
        m.position.y = 0.05;
        fx.mesh.userData.vy = 0;
        fx.mesh.userData.vx *= 0.4; fx.mesh.userData.vz *= 0.4;
        if (fx.type === 'blooddrop' && !fx.landed) {
          fx.landed = true;
          spawnBloodStain(m.position.x, m.position.z, 0.06 + Math.random()*0.06);
          fx.dead = true;
        }
      }
      fx.t = (fx.t||0) + dt;
      if (fx.t >= fx.dur) {
        if (fx.type === 'chunk') {
          // Leave a small stain where it lands
          spawnBloodStain(m.position.x, m.position.z, 0.06);
        }
        fx.dead = true;
      }
    }
  }
}


// =========================================================================
// ROUND FLOW
// =========================================================================
function startRound(){
  STATE.phase = 'shop';
  STATE.combatResult = null;
  STATE.combatUnits = [];
  // Award XP every round (auto-leveling slow)
  if (STATE.round > 1) {
    STATE.xp += 2;
    while (STATE.level < 8 && STATE.xp >= XP_TO_LEVEL[STATE.level]) {
      STATE.xp -= XP_TO_LEVEL[STATE.level];
      STATE.level++;
      playSound('levelup');
      showToast('LEVEL UP — L' + STATE.level);
    }
  }
  // Refresh shop
  rollShop();
  // Hide combat units (already disposed in endRound)
  showPhaseBanner('PREPARE', '~ Place your warriors ~');
  document.getElementById('deckPanel').classList.remove('combat');
  renderHUD();
  renderShop();
  renderBench();
  syncBoardMeshes();
  // Clear corpses from previous rounds (after a short delay so they linger)
  setTimeout(() => clearPersistentDecals(), 800);
}
function endRound(){
  // Move on to next round
  STATE.round++;
  if (STATE.hp <= 0) {
    STATE.phase = 'end';
    endMatch(false);
    return;
  }
  // 8 rounds max for a "run"
  if (STATE.round > 12) {
    STATE.phase = 'end';
    endMatch(true);
    return;
  }
  // Award gold for surviving
  STATE.gold += 0;   // (already added in endCombat)
  // Clean combat unit meshes
  for (const u of STATE.combatUnits) {
    const m = unitMeshes.get(u.id);
    if (m) { removeAndDispose(m); unitMeshes.delete(u.id); }
  }
  STATE.combatUnits = [];
  startRound();
}
function endMatch(victory){
  STATE.running = false;
  document.getElementById('endTitle').textContent = victory ? 'VICTORY' : 'DEFEAT';
  document.getElementById('endTitle').className = 'end-title ' + (victory ? 'victory' : 'defeat');
  document.getElementById('endSubtitle').textContent = victory
    ? 'The realm bows before you.'
    : 'Your forces have fallen.';
  document.getElementById('endStats').innerHTML = `
    <div><span>ROUNDS</span><span>${STATE.round}</span></div>
    <div><span>FINAL LEVEL</span><span>${STATE.level}</span></div>
    <div><span>GOLD HOARDED</span><span>${STATE.gold}</span></div>
    <div><span>HP REMAINING</span><span>${Math.max(0,STATE.hp)}</span></div>`;
  switchScreen('endScreen');
  playSound(victory ? 'win' : 'lose');
}

// =========================================================================
// SHOP / BENCH / BOARD
// =========================================================================
function renderShop(){
  const row = document.getElementById('shopRow');
  row.innerHTML = '';
  for (let i = 0; i < STATE.shop.length; i++) {
    const key = STATE.shop[i];
    if (!key) {
      const empty = document.createElement('div');
      empty.className = 'shop-card';
      empty.style.opacity = '0.15';
      empty.innerHTML = '<div class="portrait"></div><div class="name">—</div>';
      row.appendChild(empty);
      continue;
    }
    const h = HEROES[key];
    const c = document.createElement('div');
    c.className = 'shop-card tier' + h.tier;
    c.innerHTML = `
      <div class="cost">${TIER_COST[h.tier]}</div>
      <div class="portrait">${heroIconSVG(key, 64)}</div>
      <div class="traits">
        <span class="trait">${ORIGINS[h.origin].name}</span>
        <span class="trait">${CLASSES[h.class].name}</span>
      </div>
      <div class="name">${h.name}</div>`;
    c.onclick = () => buyFromShop(i);
    row.appendChild(c);
  }
}
function buyFromShop(idx){
  const key = STATE.shop[idx]; if (!key) return;
  const cost = TIER_COST[HEROES[key].tier];
  if (STATE.gold < cost) { showToast('Not enough gold'); return; }
  if (STATE.bench.length >= 8) { showToast('Bench full!'); return; }
  STATE.gold -= cost;
  const u = makeUnit(key, 1);
  STATE.bench.push(u);
  STATE.shop[idx] = null;
  playSound('buy');
  spawnFX({ type:'goldFly', x:0, z:0 });
  checkUpgrades();
  renderShop(); renderBench(); renderHUD();
}
function rerollShop(){
  if (STATE.gold < 2) { showToast('Need 2 gold'); return; }
  STATE.gold -= 2;
  rollShop();
  playSound('reroll');
  renderShop(); renderHUD();
}
function buyXP(){
  if (STATE.gold < 4) { showToast('Need 4 gold'); return; }
  if (STATE.level >= 8) { showToast('Max level'); return; }
  STATE.gold -= 4;
  STATE.xp += 4;
  while (STATE.level < 8 && STATE.xp >= XP_TO_LEVEL[STATE.level]) {
    STATE.xp -= XP_TO_LEVEL[STATE.level];
    STATE.level++;
    playSound('levelup');
    showToast('LEVEL UP — L' + STATE.level);
  }
  renderHUD();
}
function readyForCombat(){
  // Verify at least 1 unit on board
  const placed = countBoard();
  if (placed === 0) { showToast('Place at least 1 unit'); return; }
  startCombat();
}
function checkUpgrades(){
  // Count copies of each hero+stars across bench + board
  const groups = {};
  function addToGroup(u){ if (!u) return; const k = u.heroKey + '|' + u.stars; (groups[k] = groups[k]||[]).push(u); }
  for (const u of STATE.bench) addToGroup(u);
  for (let r = 0; r < ROWS; r++)
    for (let c = 0; c < COLS; c++)
      if (STATE.board[r] && STATE.board[r][c]) addToGroup(STATE.board[r][c]);
  for (const k of Object.keys(groups)) {
    const arr = groups[k];
    if (arr.length >= 3) {
      // Find first 3, remove, replace with upgraded
      const toRemove = arr.slice(0, 3);
      // Find a "keeper" — prefer one on board
      let keeper = toRemove.find(u => u.row >= 0) || toRemove[0];
      // Upgrade keeper
      keeper.stars++;
      // Remove the other two
      for (const u of toRemove) {
        if (u === keeper) continue;
        // From bench
        const bi = STATE.bench.indexOf(u);
        if (bi >= 0) STATE.bench.splice(bi, 1);
        // From board
        for (let r = 0; r < ROWS; r++) for (let c = 0; c < COLS; c++) {
          if (STATE.board[r][c] === u) STATE.board[r][c] = null;
        }
      }
      playSound('upgrade');
      showToast(keeper.def.name + ' → ' + '★'.repeat(keeper.stars));
      // Re-check (cascading 2★ → 3★)
      checkUpgrades();
      return;
    }
  }
}
function countBoard(){
  let n = 0;
  for (let r = PLAYER_ROW_MIN; r < ROWS; r++) for (let c = 0; c < COLS; c++) if (STATE.board[r] && STATE.board[r][c]) n++;
  return n;
}

function renderBench(){
  const bench = document.getElementById('benchStrip');
  bench.innerHTML = '';
  for (let i = 0; i < 8; i++) {
    const slot = document.createElement('div');
    slot.className = 'bench-slot';
    const u = STATE.bench[i];
    if (u) {
      slot.classList.add('filled');
      slot.dataset.benchIdx = i;
      let stars = '';
      if (u.stars > 1) stars = '<div class="stars">' + '★'.repeat(u.stars) + '</div>';
      slot.innerHTML = stars + `<div class="portrait">${heroIconSVG(u.heroKey, 40)}</div>`;
      if (STATE.selectedBench === i) slot.classList.add('selected');
      slot.onclick = () => onBenchClick(i);
    }
    bench.appendChild(slot);
  }
}
function onBenchClick(i){
  if (STATE.phase !== 'shop') return;
  if (STATE.selectedBench === i) { STATE.selectedBench = null; renderBench(); return; }
  STATE.selectedBench = i;
  STATE.selectedBoard = null;
  playSound('select');
  renderBench();
  showToast('Tap a board tile to place');
}
function placeFromBenchToBoard(row, col){
  const i = STATE.selectedBench; if (i == null) return;
  const u = STATE.bench[i]; if (!u) return;
  if (row < PLAYER_ROW_MIN) { showToast('Place on your half only'); return; }
  if (countBoard() >= LEVEL_BOARD_CAP[STATE.level] && !(STATE.board[row]&&STATE.board[row][col])) {
    showToast('Board cap = ' + LEVEL_BOARD_CAP[STATE.level]); return;
  }
  // Init grid if needed
  if (!STATE.board[row]) STATE.board[row] = [];
  // If cell occupied, swap
  const occ = STATE.board[row][col];
  STATE.board[row][col] = u;
  u.row = row; u.col = col;
  STATE.bench.splice(i, 1);
  if (occ) {
    occ.row = -1; occ.col = -1;
    STATE.bench.push(occ);
  }
  STATE.selectedBench = null;
  playSound('place');
  renderBench();
  syncBoardMeshes();
}
function pickFromBoard(row, col){
  if (STATE.phase !== 'shop') return;
  const u = STATE.board[row] && STATE.board[row][col];
  if (!u) return;
  STATE.selectedBoard = { row, col };
  STATE.selectedBench = null;
  showToast('Tap another tile to move, or tap board edge to bench');
}
function syncBoardMeshes(){
  // Remove existing display meshes
  for (const [id, mesh] of unitMeshes.entries()) {
    if (id.toString().startsWith('display_')) {
      removeAndDispose(mesh);
      unitMeshes.delete(id);
    }
  }
  // Add for each board cell + bench (only board for 3D; bench is UI)
  for (let r = 0; r < ROWS; r++) {
    for (let c = 0; c < COLS; c++) {
      const u = STATE.board[r] && STATE.board[r][c];
      if (!u) continue;
      const mesh = buildUnitMesh(u);
      const { x, z } = cellToWorld(r, c);
      u.x = x; u.z = z; u.visualX = x; u.visualZ = z;
      u.facing = u.side === 'enemy' ? 0 : Math.PI;
      mesh.position.set(x, 0, z);
      scene.add(mesh);
      unitMeshes.set('display_' + u.id, mesh);
    }
  }
  // Enemy preview (the upcoming round's enemy team) — only show while in shop
  if (STATE.phase === 'shop') {
    generateEnemyTeam();   // generate the next enemy layout (also used in startCombat)
    for (let r = 0; r < PLAYER_ROW_MIN; r++) {
      for (let c = 0; c < COLS; c++) {
        const u = STATE.enemyBoard[r] && STATE.enemyBoard[r][c];
        if (!u) continue;
        u.side = 'enemy';
        const mesh = buildUnitMesh(u);
        const { x, z } = cellToWorld(r, c);
        u.x = x; u.z = z; u.visualX = x; u.visualZ = z;
        u.facing = Math.PI;
        mesh.position.set(x, 0, z);
        // Slightly faded enemy preview
        mesh.traverse(o => { if (o.material && !o.userData.isOutline) { o.material.transparent = true; o.material.opacity = 0.78; } });
        scene.add(mesh);
        unitMeshes.set('display_' + u.id, mesh);
      }
    }
  }
}
function sellSelected(){
  if (STATE.selectedBench != null) {
    const u = STATE.bench[STATE.selectedBench];
    if (u) {
      STATE.gold += TIER_COST[u.def.tier] * (u.stars > 1 ? 3 : 1);
      STATE.bench.splice(STATE.selectedBench, 1);
      STATE.selectedBench = null;
      playSound('sell');
      renderBench(); renderHUD();
    }
  }
}


// =========================================================================
// HUD
// =========================================================================
function renderHUD(){
  document.getElementById('hpVal').textContent = Math.max(0, Math.floor(STATE.hp));
  document.getElementById('goldVal').textContent = STATE.gold;
  document.getElementById('roundVal').textContent = STATE.round;
  document.getElementById('lvlVal').textContent = STATE.level;
  document.getElementById('xpVal').textContent = STATE.level >= 8 ? 'MAX' : STATE.xp + '/' + XP_TO_LEVEL[STATE.level];
  // Render synergies
  renderSynergies();
}
function renderSynergies(){
  const panel = document.getElementById('synergyPanel');
  panel.innerHTML = '';
  // Collect from board (player units only)
  const units = [];
  for (let r = PLAYER_ROW_MIN; r < ROWS; r++) for (let c = 0; c < COLS; c++) if (STATE.board[r] && STATE.board[r][c]) units.push(STATE.board[r][c]);
  if (!units.length) return;
  const syn = computeSynergies(units);
  for (const ab of syn.activeBonuses) {
    if (ab.count === 0) continue;
    const el = document.createElement('div');
    let activeClass = 'inactive';
    if (ab.active) {
      const bonuses = ab.def.bonuses;
      const idx = bonuses.indexOf(ab.active);
      activeClass = 'active-' + (idx + 1);
    }
    el.className = 'synergy ' + activeClass;
    const c = '#' + ab.def.color.toString(16).padStart(6,'0');
    const glow = '#' + ab.def.glow.toString(16).padStart(6,'0');
    el.style.borderLeftColor = c;
    el.style.setProperty('--glow', glow);
    el.style.color = activeClass !== 'inactive' ? glow : '#806840';
    el.innerHTML = `<span class="count">${ab.count}</span>${ab.def.name}${ab.active ? ' · ' + ab.active.label : ''}`;
    panel.appendChild(el);
  }
}
function showPhaseBanner(name, sub){
  const b = document.getElementById('phaseBanner');
  document.getElementById('phaseName').textContent = name;
  document.getElementById('phaseSub').textContent = sub;
  b.classList.add('show');
  setTimeout(() => b.classList.remove('show'), 1600);
}
function showToast(m){
  const t = document.getElementById('toast');
  t.textContent = m;
  t.classList.add('show');
  clearTimeout(STATE.toastTimer);
  STATE.toastTimer = setTimeout(() => t.classList.remove('show'), 1500);
}

// =========================================================================
// HERO ICON SVG (used in cards / shop / bench / codex)
// =========================================================================
function heroIconSVG(key, size){
  const h = HEROES[key]; if (!h) return '';
  const origin = ORIGINS[h.origin];
  const cls = CLASSES[h.class];
  const oc = '#' + origin.color.toString(16).padStart(6,'0');
  const og = '#' + origin.glow.toString(16).padStart(6,'0');
  const cc = '#' + cls.color.toString(16).padStart(6,'0');
  const sa = size ? `width="${size}" height="${size}"` : 'width="100%" height="100%"';
  // Backdrop: gradient based on origin
  const bp = `<defs>
    <radialGradient id="bg-${key}" cx="50%" cy="40%" r="60%">
      <stop offset="0%" stop-color="${og}" stop-opacity="0.85"/>
      <stop offset="100%" stop-color="${oc}" stop-opacity="0.5"/>
    </radialGradient>
  </defs>
  <circle cx="32" cy="32" r="30" fill="url(#bg-${key})" stroke="${og}" stroke-width="1.5"/>`;
  // Hero silhouette by class
  let body = '';
  if (h.class === 'warrior' || h.class === 'guardian') {
    body = `<rect x="22" y="16" width="20" height="22" fill="${cc}" stroke="#000" stroke-width="0.6" rx="2"/>
            <rect x="20" y="14" width="24" height="8" fill="${cc}" stroke="#000" stroke-width="0.6" rx="3"/>
            <line x1="32" y1="14" x2="32" y2="48" stroke="#cccccc" stroke-width="3"/>
            <line x1="28" y1="20" x2="36" y2="20" stroke="#a07840" stroke-width="2"/>
            <circle cx="32" cy="24" r="3" fill="#e8c8a0"/>`;
  } else if (h.class === 'mage') {
    body = `<polygon points="32,10 26,22 38,22" fill="${cc}" stroke="#000" stroke-width="0.6"/>
            <rect x="24" y="22" width="16" height="22" fill="${cc}" stroke="#000" stroke-width="0.6" rx="3"/>
            <circle cx="32" cy="26" r="3" fill="#e8c8a0"/>
            <line x1="42" y1="14" x2="42" y2="48" stroke="#6a4818" stroke-width="2"/>
            <circle cx="42" cy="14" r="3.5" fill="${og}" stroke="#000" stroke-width="0.4"/>`;
  } else if (h.class === 'ranger') {
    body = `<path d="M22 16 Q32 8 42 16 L40 22 L24 22 Z" fill="${cc}" stroke="#000" stroke-width="0.6"/>
            <rect x="24" y="22" width="16" height="20" fill="${cc}" stroke="#000" stroke-width="0.6" rx="2"/>
            <circle cx="32" cy="26" r="3" fill="#e8c8a0"/>
            <path d="M20 28 Q12 32 20 38" stroke="#6a4818" stroke-width="2" fill="none"/>
            <line x1="20" y1="28" x2="20" y2="38" stroke="#e0c898" stroke-width="0.7"/>`;
  } else if (h.class === 'healer') {
    body = `<circle cx="32" cy="14" r="3" fill="${og}" stroke="#000" stroke-width="0.4"/>
            <path d="M22 18 Q32 13 42 18 L40 24 L24 24 Z" fill="${oc}" stroke="#000" stroke-width="0.6"/>
            <rect x="24" y="22" width="16" height="22" fill="${cc}" stroke="#000" stroke-width="0.6" rx="3"/>
            <circle cx="32" cy="26" r="3" fill="#e8c8a0"/>
            <rect x="29" y="32" width="6" height="2" fill="${og}"/>
            <rect x="31" y="30" width="2" height="6" fill="${og}"/>`;
  } else if (h.class === 'assassin') {
    body = `<path d="M22 18 Q32 10 42 18 L42 24 L22 24 Z" fill="${cc}" stroke="#000" stroke-width="0.6"/>
            <rect x="24" y="22" width="16" height="20" fill="${cc}" stroke="#000" stroke-width="0.6" rx="2"/>
            <rect x="28" y="24" width="8" height="3" fill="#000"/>
            <polygon points="38,28 44,40 40,42" fill="#a0a0a0" stroke="#000" stroke-width="0.4"/>`;
  }
  // Origin sigil bottom-left
  let sigil = '';
  if (h.origin === 'human') sigil = `<polygon points="10,52 16,46 22,52 16,58" fill="${og}" stroke="#000" stroke-width="0.5"/>`;
  else if (h.origin === 'elf') sigil = `<path d="M16 46 L11 56 L21 56 Z" fill="${og}" stroke="#000" stroke-width="0.5"/>`;
  else if (h.origin === 'undead') sigil = `<circle cx="16" cy="52" r="5" fill="${og}" stroke="#000" stroke-width="0.5"/><circle cx="14" cy="51" r="1" fill="#000"/><circle cx="18" cy="51" r="1" fill="#000"/>`;
  else if (h.origin === 'dragon') sigil = `<polygon points="11,56 16,46 21,56 16,52" fill="${og}" stroke="#000" stroke-width="0.5"/>`;
  else if (h.origin === 'orc') sigil = `<polygon points="10,46 22,46 20,56 12,56" fill="${og}" stroke="#000" stroke-width="0.5"/><line x1="12" y1="49" x2="20" y2="49" stroke="#000" stroke-width="0.5"/>`;
  // Tier indicator (top-right) — # of gems
  let tierGems = '';
  for (let t = 0; t < h.tier; t++) {
    tierGems += `<circle cx="${48 + t*3.5}" cy="10" r="2" fill="${og}" stroke="#000" stroke-width="0.4"/>`;
  }
  return `<svg ${sa} viewBox="0 0 64 64">${bp}${body}${sigil}${tierGems}</svg>`;
}

// =========================================================================
// INPUT (raycast for board tile clicks)
// =========================================================================
function setupInput(){
  const c = document.getElementById('threeContainer');
  c.addEventListener('pointerdown', onPointerDown);
  c.addEventListener('pointermove', onPointerMove);
  c.addEventListener('pointerup', onPointerUp);
  c.addEventListener('pointercancel', onPointerUp);
  c.addEventListener('contextmenu', e => e.preventDefault());
  if (typeof ResizeObserver !== 'undefined') {
    try { new ResizeObserver(() => resizeThree()).observe(c); } catch(e){}
  }
  window.addEventListener('keydown', e => {
    if (e.key === 'Escape' && STATE.running) STATE.paused ? resumeGame() : pauseGame();
    if (e.key === ' ' && STATE.phase === 'shop') readyForCombat();
    if (e.key.toLowerCase() === 'r' && STATE.phase === 'shop') rerollShop();
    if (e.key.toLowerCase() === 's') sellSelected();
  });
}
let _ptStart = null;
function onPointerDown(e){
  if (!STATE.running) return;
  _ptStart = { x:e.clientX, y:e.clientY, t:performance.now() };
}
function onPointerMove(e){}
function onPointerUp(e){
  if (!_ptStart) return;
  const dx = e.clientX - _ptStart.x, dy = e.clientY - _ptStart.y;
  const dist = Math.hypot(dx, dy);
  const dt = performance.now() - _ptStart.t;
  _ptStart = null;
  if (dist > 8) return;   // was a drag, ignore
  if (dt > 600) return;   // long press, ignore (could be system)
  // Raycast for board tile
  const cont = document.getElementById('threeContainer');
  const r = cont.getBoundingClientRect();
  pointer.x = ((e.clientX - r.left) / r.width) * 2 - 1;
  pointer.y = -((e.clientY - r.top) / r.height) * 2 + 1;
  raycaster.setFromCamera(pointer, camera);
  const plane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
  const hit = new THREE.Vector3();
  raycaster.ray.intersectPlane(plane, hit);
  const cell = worldToCell(hit.x, hit.z);
  if (cell && STATE.phase === 'shop') {
    if (STATE.selectedBench != null) {
      placeFromBenchToBoard(cell.row, cell.col);
    } else {
      // Pick existing unit on board → move/swap
      const u = STATE.board[cell.row] && STATE.board[cell.row][cell.col];
      if (u) {
        if (STATE.selectedBoard) {
          // Swap with other
          const a = STATE.selectedBoard;
          if (a.row !== cell.row || a.col !== cell.col) {
            STATE.board[a.row][a.col] = u;
            STATE.board[cell.row][cell.col] = STATE.board[a.row][a.col] === u ? u : null;
            // Actually: do proper swap
            const tmp = STATE.board[cell.row][cell.col];
            STATE.board[cell.row][cell.col] = STATE.board[a.row][a.col];
            STATE.board[a.row][a.col] = tmp;
            // Update row/col
            if (STATE.board[cell.row][cell.col]) { STATE.board[cell.row][cell.col].row = cell.row; STATE.board[cell.row][cell.col].col = cell.col; }
            if (STATE.board[a.row][a.col]) { STATE.board[a.row][a.col].row = a.row; STATE.board[a.row][a.col].col = a.col; }
          }
          STATE.selectedBoard = null;
          playSound('place');
          syncBoardMeshes();
        } else {
          STATE.selectedBoard = { row:cell.row, col:cell.col };
          playSound('select');
        }
      } else if (STATE.selectedBoard && cell.row >= PLAYER_ROW_MIN) {
        // Move from old to new empty
        const a = STATE.selectedBoard;
        const moved = STATE.board[a.row][a.col];
        if (moved) {
          STATE.board[cell.row][cell.col] = moved;
          STATE.board[a.row][a.col] = null;
          moved.row = cell.row; moved.col = cell.col;
          playSound('place');
        }
        STATE.selectedBoard = null;
        syncBoardMeshes();
      }
    }
  }
}

// =========================================================================
// CODEX
// =========================================================================
function goCodex(){
  switchScreen('codexScreen');
  const o = document.getElementById('codexOrigins'); o.innerHTML = '';
  for (const ok of Object.keys(ORIGINS)) {
    const oh = ORIGINS[ok];
    const c = '#' + oh.color.toString(16).padStart(6,'0');
    const div = document.createElement('div');
    div.style.cssText = 'padding:8px 12px;margin:4px 0;background:rgba(0,0,0,0.3);border-left:3px solid ' + c + ';border-radius:3px';
    div.innerHTML = `<div style="font-family:'Cinzel',serif;font-weight:700;color:${c};letter-spacing:2px">${oh.name}</div>
      <div style="font-family:'Caveat',cursive;font-size:14px;color:#a07840;margin-bottom:4px">${oh.desc}</div>
      ${oh.bonuses.map(b => `<div style="font-size:11px;color:#c89858;font-family:'Crimson Pro',serif">⚜ <b>${b.n}</b> · ${b.label}</div>`).join('')}`;
    o.appendChild(div);
  }
  const cl = document.getElementById('codexClasses'); cl.innerHTML = '';
  for (const ck of Object.keys(CLASSES)) {
    const ch = CLASSES[ck];
    const c = '#' + ch.color.toString(16).padStart(6,'0');
    const div = document.createElement('div');
    div.style.cssText = 'padding:8px 12px;margin:4px 0;background:rgba(0,0,0,0.3);border-left:3px solid ' + c + ';border-radius:3px';
    div.innerHTML = `<div style="font-family:'Cinzel',serif;font-weight:700;color:${c};letter-spacing:2px">${ch.name}</div>
      <div style="font-family:'Caveat',cursive;font-size:14px;color:#a07840;margin-bottom:4px">${ch.desc}</div>
      ${ch.bonuses.map(b => `<div style="font-size:11px;color:#c89858;font-family:'Crimson Pro',serif">⚜ <b>${b.n}</b> · ${b.label}</div>`).join('')}`;
    cl.appendChild(div);
  }
  const u = document.getElementById('codexUnits'); u.innerHTML = '';
  for (const k of Object.keys(HEROES)) {
    const h = HEROES[k];
    const d = document.createElement('div');
    d.style.cssText = 'padding:8px;background:rgba(0,0,0,0.3);border-radius:4px;border:1px solid #604018;display:flex;gap:8px';
    d.innerHTML = `<div style="width:54px;height:54px;flex-shrink:0">${heroIconSVG(k, 54)}</div>
      <div style="flex:1">
        <div style="font-family:'Cinzel',serif;font-weight:700;color:#fee090;font-size:13px;letter-spacing:1px">${h.name} <span class="tier-tag t${h.tier}">T${h.tier}</span></div>
        <div style="font-size:10px;color:#a07840;font-family:'Share Tech Mono',monospace">${ORIGINS[h.origin].name} · ${CLASSES[h.class].name}</div>
        <div style="font-family:'Caveat',cursive;font-size:13px;color:#e8b848;margin-top:3px">${h.ability.name}</div>
        <div style="font-size:10px;color:#a07840;line-height:1.3;margin-top:2px">${h.ability.desc}</div>
      </div>`;
    u.appendChild(d);
  }
}

// =========================================================================
// SCREEN / NAV
// =========================================================================
function switchScreen(id){ document.querySelectorAll('.screen').forEach(s => s.classList.remove('active')); document.getElementById(id).classList.add('active'); }
function goTitle(){ STATE.running = false; switchScreen('titleScreen'); playSound('click'); }
function pauseGame(){ STATE.paused = true; document.getElementById('pauseMenu').classList.add('active'); playSound('click'); }
function resumeGame(){ STATE.paused = false; STATE.lastTime = 0; document.getElementById('pauseMenu').classList.remove('active'); playSound('click'); }
function quitToMenu(){ STATE.running = false; STATE.paused = false; document.getElementById('pauseMenu').classList.remove('active'); goTitle(); }
function startNewRun(){
  STATE.running = true; STATE.paused = false;
  STATE.phase = 'shop';
  STATE.round = 1; STATE.hp = 100; STATE.gold = 4; STATE.level = 1; STATE.xp = 0;
  STATE.winStreak = 0; STATE.loseStreak = 0;
  STATE.bench = [];
  STATE.board = []; for (let r = 0; r < ROWS; r++) STATE.board[r] = [];
  STATE.combatUnits = []; STATE.combatResult = null;
  STATE.matchId++;
  // Clean old meshes
  unitMeshes.forEach(m => removeAndDispose(m)); unitMeshes.clear();
  for (const fx of STATE.fxObjects) if (fx.mesh) removeAndDispose(fx.mesh);
  STATE.fxObjects = [];
  clearPersistentDecals();
  switchScreen('gameScreen');
  rollShop();
  syncBoardMeshes();
  renderShop(); renderBench(); renderHUD();
  showPhaseBanner('ROUND ' + STATE.round, '~ Choose your forces ~');
  requestAnimationFrame(() => { resizeThree(); requestAnimationFrame(loop); });
}
function showHowTo(){
  alert(
    'ARCANA RUNG — HOW TO PLAY\n\n' +
    'OBJECTIVE: Survive enemy waves. Lose all HP and you fall.\n\n' +
    'PHASES:\n' +
    '1. SHOP — Buy heroes (1-5g by tier). Place on your half by\n' +
    '   tapping a bench unit then tapping a board tile.\n' +
    '   Reroll shop (2g). Buy XP (4g) to level up. More levels =\n' +
    '   bigger board.\n' +
    '2. COMBAT — Tap START. Units auto-fight. Win = +gold, Lose = -HP.\n\n' +
    'SYNERGIES:\n' +
    'Hold 2+ units of same ORIGIN or CLASS to activate stat bonuses.\n' +
    '4 Mages = +70% spell damage. 4 Humans = +25% all stats.\n' +
    'Stack synergies for huge swings.\n\n' +
    'UPGRADES:\n' +
    '3 of same unit at same star = 1 upgraded unit (★ → ★★).\n' +
    'Star upgrades are HUGE — base stats × 1.8.\n\n' +
    'ABILITIES:\n' +
    'Each unit has a unique mana-fired ability that triggers in\n' +
    'combat when their mana fills. See CODEX for full list.\n\n' +
    'TIPS:\n' +
    '• Tap selected bench unit again to deselect\n' +
    '• Tap a placed unit to move it (then tap empty tile)\n' +
    '• Spacebar = start combat, R = reroll, S = sell selected'
  );
}

// =========================================================================
// MAIN LOOP
// =========================================================================
function loop(ts){
  requestAnimationFrame(loop);
  if (!STATE.running) return;
  if (!renderer || !scene || !camera) return;
  ensureCanvasSize();
  if (!STATE.lastTime) STATE.lastTime = ts;
  const dt = Math.min(0.05, (ts - STATE.lastTime) / 1000);
  STATE.lastTime = ts;
  if (!STATE.paused) {
    // Combat update
    if (STATE.phase === 'combat') combatUpdate(dt);
    // Animate units (board + combat)
    for (const u of STATE.combatUnits) if (u && !u.isTotem) animateUnit(u, dt);
    if (STATE.phase === 'shop') {
      // Animate placed/preview units
      for (let r = 0; r < ROWS; r++) {
        for (let c = 0; c < COLS; c++) {
          const u = STATE.board[r] && STATE.board[r][c];
          if (u) { u.x = cellToWorld(r,c).x; u.z = cellToWorld(r,c).z; u.visualX = u.x; u.visualZ = u.z; animateUnit(u, dt); }
          const e = STATE.enemyBoard && STATE.enemyBoard[r] && STATE.enemyBoard[r][c];
          if (e) { e.x = cellToWorld(r,c).x; e.z = cellToWorld(r,c).z; e.visualX = e.x; e.visualZ = e.z; animateUnit(e, dt); }
        }
      }
    }
    tickFX(dt);
    tickGore(dt);
    // Animate flames / motes / camera idle
    if (scene.userData.torches) {
      for (const t of scene.userData.torches) {
        if (t.userData.flame) { t.userData.flame.scale.y = 1.4 + Math.sin(performance.now() * 0.008) * 0.3; t.userData.flame.material.opacity = 0.85 + Math.sin(performance.now() * 0.012) * 0.1; }
        if (t.userData.halo) t.userData.halo.scale.setScalar(1 + Math.sin(performance.now() * 0.005) * 0.15);
      }
    }
    if (scene.userData.motes) {
      for (const m of scene.userData.motes) {
        m.userData.bob += dt * m.userData.bobSpeed;
        m.position.y += Math.sin(m.userData.bob) * dt * 0.4;
        m.position.x += Math.cos(m.userData.bob * 0.7) * dt * 0.1;
      }
    }
    // Subtle camera bob
    const t = performance.now() * 0.0003;
    camera.position.x = Math.sin(t) * 0.6;
    camera.lookAt(0, 0, 0);
  }
  // Camera shake
  if (STATE.shake.t > 0) {
    STATE.shake.t -= dt;
    const m = STATE.shake.mag * (STATE.shake.t > 0 ? 1 : 0);
    camera.position.x += (Math.random()-0.5) * m;
    camera.position.z += (Math.random()-0.5) * m;
  }
  renderer.render(scene, camera);
}

// =========================================================================
// BOOT
// =========================================================================
function bootGame(){
  try { initThree(); }
  catch(e) {
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

// Exports for HTML onclick handlers
window.goTitle = goTitle;
window.startNewRun = startNewRun;
window.goCodex = goCodex;
window.showHowTo = showHowTo;
window.pauseGame = pauseGame;
window.resumeGame = resumeGame;
window.quitToMenu = quitToMenu;
window.rerollShop = rerollShop;
window.buyXP = buyXP;
window.readyForCombat = readyForCombat;
window.sellSelected = sellSelected;
