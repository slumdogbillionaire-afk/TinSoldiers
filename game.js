'use strict';
// =========================================================================
// TIN SOLDIERS: ATTIC WAR
// Roguelite squad-tactics hybrid. Plastic toy soldiers on a giant tabletop.
// Place, move-while-firing, draft cards between fights. Five rooms, one cat boss.
// =========================================================================

// ─── DATA: UNITS ──────────────────────────────────────────────────────────
const UNITS = {
  rifleman: { name:'RIFLEMAN', tag:'R', col:0x4a8c3a, hp:60, dmg:14, range:6, rate:0.55, speed:2.6, cost:1,
    abilityName:'AIMED SHOT', abilityCD:7, ability:'aimed', desc:'Balanced infantry. Aimed Shot: x3 damage, pierces.' },
  heavy:    { name:'HEAVY',    tag:'H', col:0x2e5a8c, hp:140, dmg:22, range:4, rate:0.85, speed:1.6, cost:2,
    abilityName:'SUPPRESS', abilityCD:9, ability:'suppress', desc:'Tanky machinegunner. Suppress: slow + DOT cone.' },
  sniper:   { name:'SNIPER',   tag:'S', col:0x6a3a8c, hp:45, dmg:38, range:11, rate:1.4, speed:2.2, cost:2,
    abilityName:'HEADSHOT', abilityCD:8, ability:'headshot', desc:'Long-range. Headshot: massive single-target damage.' },
  medic:    { name:'MEDIC',    tag:'M', col:0xc8a838, hp:55, dmg:8,  range:5, rate:0.7, speed:2.8, cost:2,
    abilityName:'FIELD KIT', abilityCD:6, ability:'heal', desc:'Heals nearby allies passively. Field Kit: AoE burst heal.' },
  grenadier:{ name:'GRENADIER',tag:'G', col:0x8c5a2e, hp:70, dmg:24, range:7, rate:1.1, speed:2.2, cost:3,
    abilityName:'FRAG', abilityCD:7, ability:'frag', desc:'Lobs explosive shells. Frag: huge AoE.' },
  scout:    { name:'SCOUT',    tag:'X', col:0x3a8c8a, hp:40, dmg:11, range:5, rate:0.4, speed:3.6, cost:1,
    abilityName:'DASH', abilityCD:5, ability:'dash', desc:'Fast, light. Dash: blink behind nearest enemy + crit.' },
  flame:    { name:'FLAMER',   tag:'F', col:0xc04020, hp:75, dmg:8,  range:3.5,rate:0.18,speed:2.0, cost:3,
    abilityName:'INFERNO', abilityCD:8, ability:'inferno', desc:'Short range, melts. Inferno: ignites large cone, lasting burn.' },
  engineer: { name:'ENGINEER', tag:'E', col:0xa8a838, hp:60, dmg:10, range:5, rate:0.6, speed:2.4, cost:3,
    abilityName:'TURRET', abilityCD:12,ability:'turret', desc:'Plants an auto-firing turret. Free unit on the field.' },
};

// ─── DATA: ENEMIES ────────────────────────────────────────────────────────
const ENEMIES = {
  rat:       { name:'RAT',         hp:35, dmg:8,  range:1.0, rate:0.7, speed:3.2, col:0x6a4830, size:0.5, kind:'melee', bounty:3 },
  windupBot: { name:'WINDUP BOT',  hp:60, dmg:12, range:1.0, rate:0.9, speed:1.7, col:0xb84030, size:0.7, kind:'melee', bounty:5 },
  spider:    { name:'SPIDER',      hp:30, dmg:6,  range:1.2, rate:0.5, speed:4.0, col:0x101010, size:0.4, kind:'melee', bounty:4 },
  dollhead:  { name:'DOLLHEAD',    hp:90, dmg:14, range:1.0, rate:1.0, speed:1.5, col:0xe8c8b0, size:0.85,kind:'melee', bounty:7 },
  beetle:    { name:'BEETLE',      hp:120,dmg:18, range:1.0, rate:1.1, speed:1.4, col:0x303030, size:0.75,kind:'melee', bounty:8, armor:6 },
  wasp:      { name:'WASP',        hp:40, dmg:9,  range:5.0, rate:1.0, speed:3.5, col:0xd8b820, size:0.45,kind:'ranged', bounty:5, proj:'sting' },
  toyTank:   { name:'TOY TANK',    hp:220,dmg:24, range:6.0, rate:1.4, speed:1.0, col:0x405030, size:1.1, kind:'ranged', bounty:14,proj:'shell', armor:12 },
  bigRat:    { name:'BIG RAT',     hp:160,dmg:20, range:1.2, rate:0.9, speed:2.6, col:0x8a5838, size:0.85,kind:'melee', bounty:10 },
  // Bosses
  cat:       { name:'THE CAT',     hp:1800,dmg:38,range:1.5, rate:1.5, speed:2.3, col:0xc0a060, size:1.8, kind:'boss', bounty:50,
                special:'pounce' },
  vacuum:    { name:'VACUUM',      hp:2400,dmg:30,range:7.0, rate:0.6, speed:1.6, col:0x808088, size:1.9, kind:'boss', bounty:60,
                special:'suck' },
  dog:       { name:'THE DOG',     hp:3000,dmg:42,range:2.0, rate:1.6, speed:2.8, col:0x705030, size:2.0, kind:'boss', bounty:80,
                special:'bite' },
  hamster:   { name:'HAMSTER',     hp:1400,dmg:28,range:1.2, rate:1.0, speed:3.0, col:0xd8a060, size:1.4, kind:'boss', bounty:45,
                special:'spin' },
  brother:   { name:'LIL BROTHER', hp:4500,dmg:50,range:9.0, rate:1.2, speed:1.8, col:0xf0c890, size:2.4, kind:'boss', bounty:120,
                special:'flick' },
};

// ─── DATA: ROOMS (each room = a stage of the run) ────────────────────────
const ROOMS = [
  { id:'kitchen',   name:'KITCHEN COUNTER',  floor:0xa07848, accent:0xc0a070, terrain:['cup','toaster','plate','knife'], boss:'cat',     wavesEasy:[2,3,4], wavesMid:[3,4,5], wavesHard:[4,5,6] },
  { id:'livingrm',  name:'LIVING ROOM',      floor:0x6c4828, accent:0x8a6a40, terrain:['book','remote','pillow','lamp'], boss:'hamster', wavesEasy:[3,4,5], wavesMid:[4,5,6], wavesHard:[5,6,7] },
  { id:'garage',    name:'THE GARAGE',       floor:0x504838, accent:0x707058, terrain:['toolbox','wrench','tire','can'], boss:'vacuum',  wavesEasy:[3,4,5], wavesMid:[4,5,7], wavesHard:[5,7,8] },
  { id:'attic',     name:'DUSTY ATTIC',      floor:0x4a3828, accent:0x6a503a, terrain:['box','dollhouse','trunk','lamp'],boss:'dog',     wavesEasy:[4,5,6], wavesMid:[5,6,8], wavesHard:[6,8,9] },
  { id:'basement',  name:'THE BASEMENT',     floor:0x2a2018, accent:0x4a3020, terrain:['barrel','pipe','crate','can'],   boss:'brother', wavesEasy:[4,5,7], wavesMid:[5,7,8], wavesHard:[7,9,10] },
];

// ─── DATA: CARDS (post-battle drafts) ─────────────────────────────────────
// Each card is one of: unit (recruit), weapon (squad-wide), ability (squad-wide), heal
const CARDS = [
  // UNIT cards (recruit a new soldier to your squad)
  { id:'rec_rifleman',  type:'unit', unit:'rifleman',  title:'+RIFLEMAN',   text:'Recruit a Rifleman to your squad.',     rarity:'C' },
  { id:'rec_heavy',     type:'unit', unit:'heavy',     title:'+HEAVY',      text:'Recruit a Heavy MG soldier.',           rarity:'U' },
  { id:'rec_sniper',    type:'unit', unit:'sniper',    title:'+SNIPER',     text:'Recruit a long-range Sniper.',           rarity:'U' },
  { id:'rec_medic',     type:'unit', unit:'medic',     title:'+MEDIC',      text:'Recruit a Medic. Passive squad heal.',  rarity:'U' },
  { id:'rec_grenadier', type:'unit', unit:'grenadier', title:'+GRENADIER',  text:'Recruit a Grenadier with AoE shells.',  rarity:'R' },
  { id:'rec_scout',     type:'unit', unit:'scout',     title:'+SCOUT',      text:'Recruit a fast Scout that can dash.',    rarity:'C' },
  { id:'rec_flame',     type:'unit', unit:'flame',     title:'+FLAMER',     text:'Recruit a Flamer. Burning cones.',       rarity:'R' },
  { id:'rec_engineer',  type:'unit', unit:'engineer',  title:'+ENGINEER',   text:'Recruit an Engineer. Can build turrets.',rarity:'R' },
  // WEAPON upgrades (multiply stats squad-wide)
  { id:'up_dmg',        type:'upgrade', stat:'dmgMul',  amount:1.20, title:'+20% DAMAGE',   text:'All units gain +20% damage.',     rarity:'C' },
  { id:'up_dmg2',       type:'upgrade', stat:'dmgMul',  amount:1.35, title:'+35% DAMAGE',   text:'All units gain +35% damage.',     rarity:'U' },
  { id:'up_rate',       type:'upgrade', stat:'rateMul', amount:0.80, title:'+20% FIRE RATE',text:'Reload 20% faster.',              rarity:'C' },
  { id:'up_rate2',      type:'upgrade', stat:'rateMul', amount:0.65, title:'+35% FIRE RATE',text:'Reload 35% faster.',              rarity:'U' },
  { id:'up_hp',         type:'upgrade', stat:'hpMul',   amount:1.30, title:'+30% HP',       text:'All soldiers gain +30% HP.',      rarity:'C' },
  { id:'up_range',      type:'upgrade', stat:'rangeMul',amount:1.25, title:'+25% RANGE',    text:'All weapons gain +25% range.',    rarity:'U' },
  { id:'up_speed',      type:'upgrade', stat:'spdMul',  amount:1.20, title:'+20% SPEED',    text:'Soldiers move 20% faster.',       rarity:'C' },
  { id:'up_crit',       type:'upgrade', stat:'crit',    amount:0.10, title:'+10% CRIT',     text:'10% chance to crit (x2 dmg).',    rarity:'U' },
  { id:'up_pierce',     type:'upgrade', stat:'pierce',  amount:1,    title:'PIERCING ROUNDS',text:'Bullets pierce through one extra enemy.', rarity:'R' },
  { id:'up_lifesteal',  type:'upgrade', stat:'lifesteal',amount:0.08,title:'LIFESTEAL',     text:'8% of damage dealt heals shooter.',rarity:'R' },
  // CONSUMABLE / META cards
  { id:'heal_full',     type:'heal',    amount:'full', title:'FIELD HOSPITAL', text:'Fully heal all surviving soldiers.', rarity:'U' },
  { id:'heal_half',     type:'heal',    amount:0.5,   title:'BANDAGES',       text:'Heal squad by 50% of max HP.',        rarity:'C' },
  { id:'gold_big',      type:'gold',    amount:25,    title:'+25 PARTS',      text:'Loot 25 spare parts (gold).',          rarity:'C' },
  // ABILITIES (rare boons that affect everyone)
  { id:'ab_overload',   type:'upgrade', stat:'abilityCDMul', amount:0.70, title:'OVERLOAD CIRCUITS', text:'-30% ability cooldown.', rarity:'R' },
  { id:'ab_armor',      type:'upgrade', stat:'armor',  amount:5,    title:'PLASTIC PLATING', text:'+5 armor to all units.',     rarity:'U' },
];

// ─── STATE ────────────────────────────────────────────────────────────────
const STATE = {
  phase: 'title',                  // title | map | placement | battle | draft | win | loss
  hp: 100, maxHp: 100,
  gold: 8,
  squad: [],                       // soldier templates (recruited units carry stars/levels)
  squadMods: { dmgMul:1, rateMul:1, hpMul:1, rangeMul:1, spdMul:1, crit:0, pierce:0, lifesteal:0, armor:0, abilityCDMul:1 },
  roomIdx: 0,
  nodeIdx: 0,
  map: null,                       // generated room map: array of node columns
  currentNode: null,
  battle: null,                    // { units:[], enemies:[], waveIdx, enemiesRemaining, room }
  selectedUnitId: null,
  hoverCell: null,
  dragging: null,
  draftOptions: null,              // 3 cards to choose from
  running: false,
  paused: false,
  lastTime: 0,
  shake: { t:0, mag:0 },
  fx: [],
  render2D: false,                 // 2D fallback flag
};

// ─── BATTLEFIELD GEOMETRY ────────────────────────────────────────────────
const BFIELD_W = 18, BFIELD_D = 14;     // world units, plays as a rectangle
const PLAYER_ZONE_Z_MIN = 2.5;          // player side (positive z)
const ENEMY_SPAWN_Z = -BFIELD_D/2 + 0.5;
const PLAYER_SPAWN_Z = BFIELD_D/2 - 0.8;

let scene, camera, renderer, raycaster, pointer;
let battleRoot = null;       // group cleared between battles
const unitMeshes = new Map();
let nextId = 1;

// ─── AUDIO ────────────────────────────────────────────────────────────────
let audioCtx = null;
function ensureAudio(){ try { audioCtx = audioCtx || new (window.AudioContext || window.webkitAudioContext)(); } catch(e){} }
function tone(freq, dur, type, gain){
  if (!audioCtx) return;
  const t = audioCtx.currentTime;
  const o = audioCtx.createOscillator(); const g = audioCtx.createGain();
  o.type = type || 'square'; o.frequency.value = freq;
  g.gain.setValueAtTime(gain || 0.08, t);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  o.connect(g); g.connect(audioCtx.destination);
  o.start(t); o.stop(t + dur);
}
function noise(dur, gain){
  if (!audioCtx) return;
  const buf = audioCtx.createBuffer(1, audioCtx.sampleRate * dur, audioCtx.sampleRate);
  const d = buf.getChannelData(0); for (let i=0;i<d.length;i++) d[i] = (Math.random()*2-1) * (1 - i/d.length);
  const src = audioCtx.createBufferSource(); src.buffer = buf;
  const g = audioCtx.createGain(); g.gain.value = gain || 0.10;
  src.connect(g); g.connect(audioCtx.destination); src.start();
}
function sfx(kind){
  ensureAudio();
  if (!audioCtx) return;
  switch (kind) {
    case 'click':   tone(880, 0.04, 'square', 0.05); break;
    case 'select':  tone(660, 0.05, 'square', 0.06); break;
    case 'place':   tone(440, 0.10, 'triangle', 0.10); break;
    case 'fire':    tone(180 + Math.random()*60, 0.05, 'sawtooth', 0.05); noise(0.04, 0.04); break;
    case 'snipe':   tone(280, 0.18, 'triangle', 0.12); break;
    case 'explode': noise(0.30, 0.16); tone(80, 0.18, 'sawtooth', 0.10); break;
    case 'flame':   noise(0.18, 0.06); break;
    case 'hit':     tone(120 + Math.random()*40, 0.04, 'square', 0.05); break;
    case 'die':     tone(180, 0.08, 'sawtooth', 0.08); tone(80, 0.16, 'triangle', 0.08); break;
    case 'ability': tone(880, 0.06, 'sine', 0.10); tone(1320, 0.08, 'sine', 0.07); break;
    case 'heal':    tone(660, 0.12, 'sine', 0.08); tone(880, 0.10, 'sine', 0.06); break;
    case 'victory': tone(523,0.10,'triangle',0.10); setTimeout(()=>tone(659,0.10,'triangle',0.10),100); setTimeout(()=>tone(784,0.18,'triangle',0.12),200); break;
    case 'loss':    tone(220,0.20,'sawtooth',0.10); setTimeout(()=>tone(160,0.25,'sawtooth',0.12),200); break;
    case 'boss':    noise(0.5, 0.20); tone(60, 0.6, 'sawtooth', 0.14); break;
  }
}

// ─── THREE.JS BOOT ────────────────────────────────────────────────────────
function tryCreateRenderer(){
  const configs = [
    { antialias:true,  powerPreference:'high-performance', precision:'highp' },
    { antialias:true,  powerPreference:'default',          precision:'highp' },
    { antialias:false, powerPreference:'default',          precision:'mediump' },
    { antialias:false, powerPreference:'low-power',        precision:'mediump' },
    { antialias:false, precision:'lowp', alpha:false, depth:true, stencil:false },
  ];
  let lastErr = null;
  for (const cfg of configs) {
    try { const r = new THREE.WebGLRenderer(cfg); if (r && r.getContext()) return r; }
    catch (e) { lastErr = e; }
  }
  throw lastErr || new Error('WebGL unavailable');
}

function initThree(){
  const container = document.getElementById('arena');
  scene = new THREE.Scene();
  scene.background = new THREE.Color(0x101418);
  scene.fog = new THREE.Fog(0x101418, 20, 60);
  camera = new THREE.PerspectiveCamera(50, 1, 0.5, 200);
  // Top-down 3/4 view, Hades-style
  camera.position.set(0, 18, 14);
  camera.lookAt(0, 0, 0);
  renderer = tryCreateRenderer();
  renderer.setPixelRatio(Math.min(window.devicePixelRatio||1, 2));
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  container.innerHTML = '';
  container.appendChild(renderer.domElement);
  // Lights — strong toplight for that "toy diorama under a lamp" feel
  scene.add(new THREE.HemisphereLight(0xffeec8, 0x303030, 0.7));
  const key = new THREE.DirectionalLight(0xffe8c0, 1.2);
  key.position.set(8, 22, 10);
  key.castShadow = true;
  key.shadow.mapSize.set(2048, 2048);
  key.shadow.camera.left=-14; key.shadow.camera.right=14;
  key.shadow.camera.top=12; key.shadow.camera.bottom=-12;
  key.shadow.camera.near=1; key.shadow.camera.far=50;
  scene.add(key);
  scene.add(new THREE.AmbientLight(0x404048, 0.5));
  raycaster = new THREE.Raycaster();
  pointer = new THREE.Vector2();
  battleRoot = new THREE.Group(); scene.add(battleRoot);
  resizeArena();
}
function resizeArena(){
  const c = document.getElementById('arena');
  if (!c) return;
  if (STATE.render2D) { resize2D(); return; }
  if (!renderer || !camera) return;
  const w = c.clientWidth, h = c.clientHeight;
  if (!w || !h) return;
  renderer.setSize(w, h, false);
  camera.aspect = w/h;
  camera.updateProjectionMatrix();
}
window.addEventListener('resize', resizeArena);

// ─── BATTLEFIELD BUILD ────────────────────────────────────────────────────
function clearBattleRoot(){
  while (battleRoot.children.length) {
    const c = battleRoot.children.pop();
    c.traverse(o => { if (o.geometry) o.geometry.dispose(); if (o.material) { if (Array.isArray(o.material)) o.material.forEach(m=>m.dispose()); else o.material.dispose(); }});
  }
  unitMeshes.clear();
}

function buildBattlefield(room){
  clearBattleRoot();
  // Floor — wooden tabletop texture (procedural plank-strips)
  const floorGeo = new THREE.PlaneGeometry(BFIELD_W, BFIELD_D, 12, 8);
  const floorMat = new THREE.MeshStandardMaterial({ color: room.floor, roughness: 0.85, metalness: 0.0 });
  const floor = new THREE.Mesh(floorGeo, floorMat);
  floor.rotation.x = -Math.PI/2;
  floor.receiveShadow = true;
  battleRoot.add(floor);
  // Plank lines — dark stripes
  for (let i = -3; i <= 3; i++) {
    const plank = new THREE.Mesh(new THREE.PlaneGeometry(0.05, BFIELD_D),
      new THREE.MeshStandardMaterial({ color: 0x1a1008, roughness:0.9 }));
    plank.rotation.x = -Math.PI/2;
    plank.position.set(i * (BFIELD_W/6), 0.01, 0);
    battleRoot.add(plank);
  }
  // Player deploy zone tint (subtle blue rectangle)
  const dzGeo = new THREE.PlaneGeometry(BFIELD_W * 0.9, BFIELD_D/2 - 1);
  const dzMat = new THREE.MeshBasicMaterial({ color:0x4080d0, transparent:true, opacity:0.10, depthWrite:false });
  const dz = new THREE.Mesh(dzGeo, dzMat);
  dz.rotation.x = -Math.PI/2; dz.position.set(0, 0.02, BFIELD_D/4 + 0.5);
  battleRoot.add(dz);
  // Spawn line (red glow at far end)
  const spGeo = new THREE.PlaneGeometry(BFIELD_W * 0.9, 0.8);
  const spMat = new THREE.MeshBasicMaterial({ color:0xff4030, transparent:true, opacity:0.30, depthWrite:false });
  const sp = new THREE.Mesh(spGeo, spMat);
  sp.rotation.x = -Math.PI/2; sp.position.set(0, 0.03, ENEMY_SPAWN_Z + 0.3);
  battleRoot.add(sp);
  // Random terrain — household objects at giant scale
  buildTerrain(room);
  // Ambient dust motes
  for (let i = 0; i < 40; i++) {
    const m = new THREE.Mesh(new THREE.SphereGeometry(0.02, 4, 3),
      new THREE.MeshBasicMaterial({ color:0xffe8a0, transparent:true, opacity:0.35 }));
    m.position.set((Math.random()-0.5)*BFIELD_W, 1 + Math.random()*4, (Math.random()-0.5)*BFIELD_D);
    m.userData.t = Math.random()*Math.PI*2;
    m.userData.kind = 'mote';
    battleRoot.add(m);
  }
}

function buildTerrain(room){
  // Place 4–6 terrain pieces along sides (out of the play lanes)
  const pieces = room.terrain;
  const count = 4 + Math.floor(Math.random()*3);
  for (let i = 0; i < count; i++) {
    const kind = pieces[Math.floor(Math.random()*pieces.length)];
    const side = i < count/2 ? -1 : 1;
    const x = side * (BFIELD_W/2 - 1.2 - Math.random()*0.6);
    const z = -BFIELD_D/2 + 2 + Math.random() * (BFIELD_D - 4);
    const obj = buildTerrainPiece(kind, room);
    obj.position.set(x, 0, z);
    obj.rotation.y = Math.random()*Math.PI*2;
    battleRoot.add(obj);
  }
}
function buildTerrainPiece(kind, room){
  const g = new THREE.Group();
  switch (kind) {
    case 'cup': {
      const m = new THREE.Mesh(new THREE.CylinderGeometry(0.7, 0.6, 1.4, 14, 1, true),
        new THREE.MeshStandardMaterial({ color:0xe8e8e8, roughness:0.4, side:THREE.DoubleSide }));
      m.position.y = 0.7; m.castShadow = true; g.add(m);
      const handle = new THREE.Mesh(new THREE.TorusGeometry(0.35, 0.08, 6, 8, Math.PI),
        new THREE.MeshStandardMaterial({ color:0xe8e8e8, roughness:0.4 }));
      handle.position.set(0.75, 0.7, 0); handle.rotation.y = Math.PI/2; g.add(handle);
      break; }
    case 'toaster': {
      const m = new THREE.Mesh(new THREE.BoxGeometry(2.0, 1.2, 1.0),
        new THREE.MeshStandardMaterial({ color:0xc0c0c8, roughness:0.3, metalness:0.6 }));
      m.position.y = 0.6; m.castShadow = true; g.add(m);
      const slot = new THREE.Mesh(new THREE.BoxGeometry(1.6, 0.08, 0.3),
        new THREE.MeshStandardMaterial({ color:0x202020 }));
      slot.position.y = 1.20; g.add(slot);
      break; }
    case 'plate': {
      const m = new THREE.Mesh(new THREE.CylinderGeometry(1.0, 0.85, 0.15, 18),
        new THREE.MeshStandardMaterial({ color:0xf0f0f0, roughness:0.3 }));
      m.position.y = 0.07; m.castShadow = true; g.add(m);
      break; }
    case 'knife': {
      const blade = new THREE.Mesh(new THREE.BoxGeometry(2.4, 0.05, 0.35),
        new THREE.MeshStandardMaterial({ color:0xd8d8e0, roughness:0.15, metalness:0.85 }));
      blade.position.y = 0.04; blade.castShadow = true; g.add(blade);
      const handle = new THREE.Mesh(new THREE.BoxGeometry(0.8, 0.18, 0.3),
        new THREE.MeshStandardMaterial({ color:0x402010 }));
      handle.position.set(-1.4, 0.10, 0); g.add(handle);
      break; }
    case 'book': {
      const cover = new THREE.Mesh(new THREE.BoxGeometry(1.8, 0.25, 2.4),
        new THREE.MeshStandardMaterial({ color:0x80302a, roughness:0.7 }));
      cover.position.y = 0.13; cover.castShadow = true; g.add(cover);
      break; }
    case 'remote': {
      const body = new THREE.Mesh(new THREE.BoxGeometry(0.6, 0.18, 2.0),
        new THREE.MeshStandardMaterial({ color:0x202028 }));
      body.position.y = 0.10; body.castShadow = true; g.add(body);
      for (let i = 0; i < 6; i++) {
        const btn = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.06, 0.04, 6),
          new THREE.MeshStandardMaterial({ color:0x606068 }));
        btn.position.set(0, 0.20, -0.7 + i*0.28); g.add(btn);
      }
      break; }
    case 'pillow': {
      const m = new THREE.Mesh(new THREE.BoxGeometry(2.4, 0.7, 2.0),
        new THREE.MeshStandardMaterial({ color:0xc09080, roughness:0.95 }));
      m.position.y = 0.35; m.castShadow = true; g.add(m);
      break; }
    case 'lamp': {
      const base = new THREE.Mesh(new THREE.CylinderGeometry(0.5, 0.6, 0.2, 10),
        new THREE.MeshStandardMaterial({ color:0x303838 }));
      base.position.y = 0.10; g.add(base);
      const stem = new THREE.Mesh(new THREE.CylinderGeometry(0.10, 0.10, 1.8, 6),
        new THREE.MeshStandardMaterial({ color:0x404848 }));
      stem.position.y = 1.10; g.add(stem);
      const shade = new THREE.Mesh(new THREE.ConeGeometry(0.9, 0.8, 12, 1, true),
        new THREE.MeshStandardMaterial({ color:0xf0e8b0, side:THREE.DoubleSide, emissive:0xa08020, emissiveIntensity:0.4 }));
      shade.position.y = 2.2; g.add(shade);
      break; }
    case 'toolbox': {
      const m = new THREE.Mesh(new THREE.BoxGeometry(2.0, 1.0, 1.4),
        new THREE.MeshStandardMaterial({ color:0xa02020, roughness:0.4 }));
      m.position.y = 0.5; m.castShadow = true; g.add(m);
      const handle = new THREE.Mesh(new THREE.TorusGeometry(0.35, 0.06, 6, 10, Math.PI),
        new THREE.MeshStandardMaterial({ color:0x202020 }));
      handle.position.y = 1.10; handle.rotation.x = Math.PI/2; g.add(handle);
      break; }
    case 'wrench': {
      const m = new THREE.Mesh(new THREE.BoxGeometry(1.8, 0.10, 0.30),
        new THREE.MeshStandardMaterial({ color:0xa0a0a8, roughness:0.3, metalness:0.7 }));
      m.position.y = 0.05; g.add(m);
      const head = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.10, 0.6),
        new THREE.MeshStandardMaterial({ color:0xa0a0a8, roughness:0.3, metalness:0.7 }));
      head.position.set(0.85, 0.05, 0); g.add(head);
      break; }
    case 'tire': {
      const m = new THREE.Mesh(new THREE.TorusGeometry(0.9, 0.35, 8, 16),
        new THREE.MeshStandardMaterial({ color:0x101010, roughness:0.95 }));
      m.rotation.x = Math.PI/2; m.position.y = 0.35; m.castShadow = true; g.add(m);
      break; }
    case 'can': {
      const m = new THREE.Mesh(new THREE.CylinderGeometry(0.5, 0.5, 1.2, 14),
        new THREE.MeshStandardMaterial({ color:0xa08850, roughness:0.4, metalness:0.6 }));
      m.position.y = 0.6; m.castShadow = true; g.add(m);
      break; }
    case 'box': {
      const m = new THREE.Mesh(new THREE.BoxGeometry(1.8, 1.6, 1.8),
        new THREE.MeshStandardMaterial({ color:0x8a6a3a, roughness:0.95 }));
      m.position.y = 0.8; m.castShadow = true; g.add(m);
      break; }
    case 'dollhouse': {
      const m = new THREE.Mesh(new THREE.BoxGeometry(2.4, 2.0, 1.8),
        new THREE.MeshStandardMaterial({ color:0xe8a0a0, roughness:0.7 }));
      m.position.y = 1.0; m.castShadow = true; g.add(m);
      const roof = new THREE.Mesh(new THREE.ConeGeometry(1.6, 0.8, 4),
        new THREE.MeshStandardMaterial({ color:0x802020, roughness:0.6 }));
      roof.position.y = 2.4; roof.rotation.y = Math.PI/4; g.add(roof);
      break; }
    case 'trunk': {
      const m = new THREE.Mesh(new THREE.BoxGeometry(2.4, 1.0, 1.6),
        new THREE.MeshStandardMaterial({ color:0x4a2a10, roughness:0.85 }));
      m.position.y = 0.5; m.castShadow = true; g.add(m);
      const lid = new THREE.Mesh(new THREE.BoxGeometry(2.4, 0.4, 1.6),
        new THREE.MeshStandardMaterial({ color:0x602a10 }));
      lid.position.y = 1.0; g.add(lid);
      break; }
    case 'barrel': {
      const m = new THREE.Mesh(new THREE.CylinderGeometry(0.7, 0.7, 1.6, 16),
        new THREE.MeshStandardMaterial({ color:0x4030a0, roughness:0.5 }));
      m.position.y = 0.8; m.castShadow = true; g.add(m);
      break; }
    case 'pipe': {
      const m = new THREE.Mesh(new THREE.CylinderGeometry(0.25, 0.25, 3.5, 12),
        new THREE.MeshStandardMaterial({ color:0x605850, roughness:0.6, metalness:0.5 }));
      m.rotation.z = Math.PI/2; m.position.y = 0.25; m.castShadow = true; g.add(m);
      break; }
    case 'crate': {
      const m = new THREE.Mesh(new THREE.BoxGeometry(1.4, 1.4, 1.4),
        new THREE.MeshStandardMaterial({ color:0x705028, roughness:0.95 }));
      m.position.y = 0.7; m.castShadow = true; g.add(m);
      break; }
  }
  return g;
}

// ─── UNIT MESH BUILD ─────────────────────────────────────────────────────
function buildSoldierMesh(def){
  const g = new THREE.Group();
  const matPlastic = (col) => new THREE.MeshStandardMaterial({ color: col, roughness: 0.45, metalness: 0.05 });
  const skinCol = 0xe8c8a0;
  // Boots
  for (const xs of [-0.20, 0.20]) {
    const boot = new THREE.Mesh(new THREE.BoxGeometry(0.30, 0.24, 0.40), matPlastic(0x202020));
    boot.position.set(xs, 0.12, 0.05); boot.castShadow = true; g.add(boot);
  }
  // Legs
  for (const xs of [-0.18, 0.18]) {
    const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.12, 0.60, 8), matPlastic(def.col));
    leg.position.set(xs, 0.50, 0); leg.castShadow = true; g.add(leg);
  }
  // Torso
  const torso = new THREE.Mesh(new THREE.BoxGeometry(0.65, 0.75, 0.45), matPlastic(def.col));
  torso.position.set(0, 1.10, 0); torso.castShadow = true; g.add(torso);
  // Belt
  const belt = new THREE.Mesh(new THREE.BoxGeometry(0.72, 0.10, 0.50), matPlastic(0x202020));
  belt.position.set(0, 0.78, 0); g.add(belt);
  // Arms
  for (const xs of [-0.42, 0.42]) {
    const arm = new THREE.Mesh(new THREE.CylinderGeometry(0.11, 0.11, 0.65, 8), matPlastic(def.col));
    arm.position.set(xs, 1.10, 0); arm.castShadow = true; g.add(arm);
    arm.userData.isArm = true; arm.userData.side = xs > 0 ? 'R' : 'L';
  }
  // Head + helmet
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.22, 12, 10), matPlastic(skinCol));
  head.position.set(0, 1.62, 0); head.castShadow = true; g.add(head);
  const helmet = new THREE.Mesh(new THREE.SphereGeometry(0.25, 12, 8, 0, Math.PI*2, 0, Math.PI/2.4), matPlastic(def.col));
  helmet.position.set(0, 1.66, 0); helmet.castShadow = true; g.add(helmet);
  // Weapon (right hand)
  const weapon = buildWeapon(def);
  weapon.position.set(0.35, 1.15, 0.30);
  g.add(weapon);
  // Base disc (toy soldier!)
  const base = new THREE.Mesh(new THREE.CylinderGeometry(0.45, 0.50, 0.05, 16), matPlastic(def.col));
  base.position.set(0, 0.025, 0); g.add(base);
  // Selection ring (hidden by default)
  const ring = new THREE.Mesh(new THREE.RingGeometry(0.55, 0.65, 24),
    new THREE.MeshBasicMaterial({ color: 0x80f0ff, transparent:true, opacity:0.0, side:THREE.DoubleSide }));
  ring.rotation.x = -Math.PI/2; ring.position.y = 0.06;
  g.add(ring); g.userData.ring = ring;
  // Hp bar
  const hpBg = new THREE.Mesh(new THREE.PlaneGeometry(0.9, 0.10),
    new THREE.MeshBasicMaterial({ color:0x202020, transparent:true, opacity:0.8 }));
  hpBg.position.set(0, 2.0, 0); g.add(hpBg);
  const hpFg = new THREE.Mesh(new THREE.PlaneGeometry(0.88, 0.08),
    new THREE.MeshBasicMaterial({ color:0x40e040 }));
  hpFg.position.set(0, 2.0, 0.01); g.add(hpFg);
  g.userData.hpBg = hpBg; g.userData.hpFg = hpFg;
  // Ability ready glow (hidden by default)
  const glow = new THREE.Mesh(new THREE.SphereGeometry(0.12, 8, 6),
    new THREE.MeshBasicMaterial({ color:0xffe040, transparent:true, opacity:0.0 }));
  glow.position.set(0, 1.85, 0); g.add(glow);
  g.userData.glow = glow;
  g.userData.bones = { weapon, leftArm:g.children.find(c=>c.userData.isArm&&c.userData.side==='L'), rightArm:g.children.find(c=>c.userData.isArm&&c.userData.side==='R') };
  return g;
}
function buildWeapon(def){
  const g = new THREE.Group();
  const matMetal = new THREE.MeshStandardMaterial({ color:0x303838, roughness:0.4, metalness:0.7 });
  const matWood  = new THREE.MeshStandardMaterial({ color:0x4a2a10, roughness:0.8 });
  switch (def.ability) {
    case 'headshot': {  // sniper — long rifle
      const barrel = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.04, 1.1, 8), matMetal);
      barrel.rotation.z = Math.PI/2; barrel.position.x = 0.30; g.add(barrel);
      const stock = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.10, 0.06), matWood);
      stock.position.x = -0.25; g.add(stock);
      const scope = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.06, 0.18, 8), matMetal);
      scope.rotation.z = Math.PI/2; scope.position.set(0.10, 0.12, 0); g.add(scope);
      break; }
    case 'suppress': {  // heavy — machine gun
      const body = new THREE.Mesh(new THREE.BoxGeometry(0.60, 0.16, 0.10), matMetal);
      g.add(body);
      const barrel = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.06, 0.60, 8), matMetal);
      barrel.rotation.z = Math.PI/2; barrel.position.x = 0.55; g.add(barrel);
      const drum = new THREE.Mesh(new THREE.CylinderGeometry(0.14, 0.14, 0.10, 12), matMetal);
      drum.position.y = -0.18; g.add(drum);
      break; }
    case 'frag': {  // grenadier — launcher
      const body = new THREE.Mesh(new THREE.BoxGeometry(0.40, 0.12, 0.08), matMetal);
      g.add(body);
      const tube = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.12, 0.55, 10), matMetal);
      tube.rotation.z = Math.PI/2; tube.position.x = 0.40; g.add(tube);
      break; }
    case 'inferno': {  // flamer — tank + nozzle
      const tank = new THREE.Mesh(new THREE.CylinderGeometry(0.10, 0.10, 0.50, 8),
        new THREE.MeshStandardMaterial({ color:0xc04020, roughness:0.4 }));
      tank.position.set(-0.15, 0, -0.10); g.add(tank);
      const hose = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.04, 0.30, 6), matMetal);
      hose.rotation.z = Math.PI/3; hose.position.x = 0.05; g.add(hose);
      const nozzle = new THREE.Mesh(new THREE.ConeGeometry(0.10, 0.30, 8), matMetal);
      nozzle.rotation.z = -Math.PI/2; nozzle.position.x = 0.40; g.add(nozzle);
      break; }
    case 'dash': {  // scout — SMG
      const body = new THREE.Mesh(new THREE.BoxGeometry(0.36, 0.12, 0.08), matMetal);
      g.add(body);
      const barrel = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.04, 0.20, 6), matMetal);
      barrel.rotation.z = Math.PI/2; barrel.position.x = 0.28; g.add(barrel);
      break; }
    case 'heal': {  // medic — pistol + bag visible elsewhere
      const body = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.16, 0.06), matMetal);
      g.add(body);
      const barrel = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.04, 0.16, 6), matMetal);
      barrel.rotation.z = Math.PI/2; barrel.position.x = 0.18; g.add(barrel);
      break; }
    case 'turret': {  // engineer — wrench rifle hybrid
      const body = new THREE.Mesh(new THREE.BoxGeometry(0.36, 0.16, 0.08), matMetal);
      g.add(body);
      const barrel = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 0.30, 8), matMetal);
      barrel.rotation.z = Math.PI/2; barrel.position.x = 0.30; g.add(barrel);
      break; }
    default: { // rifleman — basic rifle
      const stock = new THREE.Mesh(new THREE.BoxGeometry(0.20, 0.10, 0.06), matWood);
      stock.position.x = -0.10; g.add(stock);
      const body = new THREE.Mesh(new THREE.BoxGeometry(0.35, 0.10, 0.06), matMetal);
      g.add(body);
      const barrel = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.04, 0.45, 6), matMetal);
      barrel.rotation.z = Math.PI/2; barrel.position.x = 0.40; g.add(barrel);
    }
  }
  return g;
}

function buildEnemyMesh(def){
  const g = new THREE.Group();
  const mat = (col) => new THREE.MeshStandardMaterial({ color:col, roughness:0.6, metalness:0.1 });
  const skinCol = def.col;
  const s = def.size;
  switch (def.name) {
    case 'RAT':
    case 'BIG RAT': {
      // Furry rat body
      const body = new THREE.Mesh(new THREE.SphereGeometry(s*0.5, 12, 8), mat(skinCol));
      body.scale.set(1.4, 0.7, 0.8); body.position.y = s*0.35; body.castShadow = true; g.add(body);
      const head = new THREE.Mesh(new THREE.SphereGeometry(s*0.32, 10, 8), mat(skinCol));
      head.position.set(s*0.6, s*0.40, 0); head.castShadow = true; g.add(head);
      // Snout
      const snout = new THREE.Mesh(new THREE.ConeGeometry(s*0.10, s*0.20, 6), mat(0xff8080));
      snout.rotation.z = -Math.PI/2; snout.position.set(s*0.78, s*0.35, 0); g.add(snout);
      // Ears
      for (const zs of [-0.12, 0.12]) {
        const ear = new THREE.Mesh(new THREE.ConeGeometry(s*0.08, s*0.18, 6), mat(0xc08070));
        ear.position.set(s*0.55, s*0.65, zs * s); g.add(ear);
      }
      // Tail
      const tail = new THREE.Mesh(new THREE.CylinderGeometry(s*0.04, s*0.02, s*0.9, 6), mat(0xb0a080));
      tail.rotation.z = Math.PI/2; tail.position.set(-s*0.65, s*0.35, 0); g.add(tail);
      // Legs
      for (let i = 0; i < 4; i++) {
        const xz = i < 2 ? -s*0.30 : s*0.40;
        const zs = i % 2 === 0 ? -s*0.30 : s*0.30;
        const leg = new THREE.Mesh(new THREE.CylinderGeometry(s*0.05, s*0.04, s*0.25, 5), mat(skinCol));
        leg.position.set(xz, s*0.13, zs); g.add(leg);
      }
      break; }
    case 'SPIDER': {
      const body = new THREE.Mesh(new THREE.SphereGeometry(s*0.4, 10, 8), mat(skinCol));
      body.position.y = s*0.4; body.castShadow = true; g.add(body);
      // 8 legs
      for (let i = 0; i < 8; i++) {
        const a = (i / 8) * Math.PI * 2;
        const leg = new THREE.Mesh(new THREE.CylinderGeometry(s*0.025, s*0.02, s*0.7, 4), mat(skinCol));
        leg.rotation.z = Math.PI/3;
        leg.rotation.y = a;
        leg.position.set(Math.cos(a) * s*0.35, s*0.25, Math.sin(a) * s*0.35);
        g.add(leg);
      }
      break; }
    case 'WINDUP BOT': {
      // Tin robot body
      const body = new THREE.Mesh(new THREE.BoxGeometry(s*0.7, s*1.0, s*0.5), mat(skinCol));
      body.position.y = s*0.7; body.castShadow = true; g.add(body);
      // Head
      const head = new THREE.Mesh(new THREE.BoxGeometry(s*0.55, s*0.45, s*0.5), mat(skinCol));
      head.position.y = s*1.45; head.castShadow = true; g.add(head);
      // Eyes (glowing red)
      for (const xs of [-s*0.13, s*0.13]) {
        const eye = new THREE.Mesh(new THREE.SphereGeometry(s*0.05, 6, 5),
          new THREE.MeshStandardMaterial({ color:0xff2020, emissive:0xff2020, emissiveIntensity:1.0 }));
        eye.position.set(xs, s*1.50, s*0.27); g.add(eye);
      }
      // Wind-up key
      const key = new THREE.Mesh(new THREE.BoxGeometry(s*0.08, s*0.4, s*0.04), mat(0xa0a0a0));
      key.position.set(0, s*0.9, -s*0.35); g.add(key);
      // Legs (stubby)
      for (const xs of [-s*0.18, s*0.18]) {
        const leg = new THREE.Mesh(new THREE.BoxGeometry(s*0.18, s*0.35, s*0.18), mat(skinCol));
        leg.position.set(xs, s*0.18, 0); g.add(leg);
      }
      // Arms
      for (const xs of [-s*0.50, s*0.50]) {
        const arm = new THREE.Mesh(new THREE.CylinderGeometry(s*0.07, s*0.07, s*0.5, 6), mat(skinCol));
        arm.position.set(xs, s*0.80, 0); g.add(arm);
      }
      break; }
    case 'DOLLHEAD': {
      const head = new THREE.Mesh(new THREE.SphereGeometry(s*0.6, 14, 12), mat(skinCol));
      head.position.y = s*0.6; head.castShadow = true; g.add(head);
      // Glassy eyes
      for (const xs of [-s*0.18, s*0.18]) {
        const eye = new THREE.Mesh(new THREE.SphereGeometry(s*0.08, 8, 6),
          new THREE.MeshStandardMaterial({ color:0x202020, emissive:0xff8040, emissiveIntensity:0.4 }));
        eye.position.set(xs, s*0.65, s*0.5); g.add(eye);
      }
      // Mouth (creepy line)
      const mouth = new THREE.Mesh(new THREE.BoxGeometry(s*0.30, s*0.04, s*0.02), mat(0x200808));
      mouth.position.set(0, s*0.45, s*0.55); g.add(mouth);
      // Hair clumps
      for (let i = 0; i < 8; i++) {
        const a = i / 8 * Math.PI * 2;
        const tuft = new THREE.Mesh(new THREE.ConeGeometry(s*0.08, s*0.25, 5), mat(0xa05030));
        tuft.position.set(Math.cos(a) * s*0.55, s*0.95, Math.sin(a) * s*0.55);
        tuft.rotation.x = Math.sin(a) * 0.5; tuft.rotation.z = Math.cos(a) * 0.5;
        g.add(tuft);
      }
      break; }
    case 'BEETLE': {
      const body = new THREE.Mesh(new THREE.SphereGeometry(s*0.55, 12, 8),
        new THREE.MeshStandardMaterial({ color:skinCol, roughness:0.3, metalness:0.5 }));
      body.scale.set(1.2, 0.6, 0.9); body.position.y = s*0.35; body.castShadow = true; g.add(body);
      // Wing line
      const line = new THREE.Mesh(new THREE.BoxGeometry(s*1.3, s*0.02, s*0.02),
        new THREE.MeshStandardMaterial({ color:0x101010 }));
      line.position.y = s*0.65; g.add(line);
      // Horn
      const horn = new THREE.Mesh(new THREE.ConeGeometry(s*0.08, s*0.4, 6), mat(0x202020));
      horn.position.set(s*0.65, s*0.4, 0); horn.rotation.z = -Math.PI/4; g.add(horn);
      // Legs (6)
      for (let i = 0; i < 6; i++) {
        const z = ((i % 3) - 1) * s*0.25;
        const side = i < 3 ? -1 : 1;
        const leg = new THREE.Mesh(new THREE.CylinderGeometry(s*0.04, s*0.03, s*0.35, 5), mat(0x202020));
        leg.rotation.x = side * Math.PI/4;
        leg.position.set(0, s*0.18, side * s*0.45 + z * 0.4);
        g.add(leg);
      }
      break; }
    case 'WASP': {
      const body = new THREE.Mesh(new THREE.SphereGeometry(s*0.4, 10, 8), mat(skinCol));
      body.scale.set(1.4, 0.7, 0.7); body.position.y = s*1.2; body.castShadow = true; g.add(body);
      // Black stripes
      for (let i = 0; i < 3; i++) {
        const stripe = new THREE.Mesh(new THREE.TorusGeometry(s*0.28, s*0.05, 6, 10),
          new THREE.MeshStandardMaterial({ color:0x101010 }));
        stripe.position.set(-s*0.15 + i*s*0.15, s*1.2, 0); stripe.rotation.y = Math.PI/2;
        g.add(stripe);
      }
      // Wings
      for (const xs of [-s*0.2, s*0.2]) {
        const w = new THREE.Mesh(new THREE.SphereGeometry(s*0.25, 6, 4),
          new THREE.MeshStandardMaterial({ color:0xc0d8e8, transparent:true, opacity:0.5, side:THREE.DoubleSide }));
        w.scale.set(1.2, 0.05, 0.7);
        w.position.set(xs, s*1.45, 0);
        g.add(w);
      }
      // Stinger
      const sting = new THREE.Mesh(new THREE.ConeGeometry(s*0.05, s*0.2, 6), mat(0x202020));
      sting.position.set(-s*0.55, s*1.2, 0); sting.rotation.z = Math.PI/2; g.add(sting);
      break; }
    case 'TOY TANK': {
      const hull = new THREE.Mesh(new THREE.BoxGeometry(s*1.2, s*0.5, s*0.8), mat(skinCol));
      hull.position.y = s*0.4; hull.castShadow = true; g.add(hull);
      const turret = new THREE.Mesh(new THREE.CylinderGeometry(s*0.35, s*0.40, s*0.35, 8), mat(skinCol));
      turret.position.y = s*0.85; g.add(turret);
      const barrel = new THREE.Mesh(new THREE.CylinderGeometry(s*0.06, s*0.06, s*0.9, 8), mat(0x303030));
      barrel.rotation.z = Math.PI/2; barrel.position.set(s*0.5, s*0.85, 0); g.add(barrel);
      // Treads
      for (const zs of [-s*0.42, s*0.42]) {
        const tread = new THREE.Mesh(new THREE.BoxGeometry(s*1.3, s*0.30, s*0.18), mat(0x101010));
        tread.position.set(0, s*0.18, zs); g.add(tread);
      }
      break; }
    case 'THE CAT': {
      // Big fluffy menace
      const body = new THREE.Mesh(new THREE.SphereGeometry(s*0.6, 14, 10), mat(skinCol));
      body.scale.set(1.4, 0.9, 0.9); body.position.y = s*0.55; body.castShadow = true; g.add(body);
      const head = new THREE.Mesh(new THREE.SphereGeometry(s*0.45, 14, 10), mat(skinCol));
      head.position.set(s*0.75, s*0.85, 0); head.castShadow = true; g.add(head);
      // Ears
      for (const zs of [-0.18, 0.18]) {
        const ear = new THREE.Mesh(new THREE.ConeGeometry(s*0.12, s*0.30, 6), mat(skinCol));
        ear.position.set(s*0.70, s*1.20, zs * s);
        g.add(ear);
      }
      // Eyes (yellow, glowing)
      for (const zs of [-0.15, 0.15]) {
        const eye = new THREE.Mesh(new THREE.SphereGeometry(s*0.06, 8, 6),
          new THREE.MeshStandardMaterial({ color:0xffe040, emissive:0xffe040, emissiveIntensity:1.2 }));
        eye.position.set(s*1.1, s*0.95, zs * s); g.add(eye);
      }
      // Legs
      for (let i = 0; i < 4; i++) {
        const xz = i < 2 ? -s*0.30 : s*0.40;
        const zs = i % 2 === 0 ? -s*0.35 : s*0.35;
        const leg = new THREE.Mesh(new THREE.CylinderGeometry(s*0.10, s*0.08, s*0.35, 6), mat(skinCol));
        leg.position.set(xz, s*0.18, zs); g.add(leg);
      }
      // Tail
      const tail = new THREE.Mesh(new THREE.CylinderGeometry(s*0.06, s*0.04, s*1.0, 6), mat(skinCol));
      tail.position.set(-s*0.85, s*0.7, 0); tail.rotation.z = Math.PI/3; g.add(tail);
      break; }
    case 'THE DOG': {
      const body = new THREE.Mesh(new THREE.SphereGeometry(s*0.65, 12, 10), mat(skinCol));
      body.scale.set(1.4, 0.85, 0.95); body.position.y = s*0.6; body.castShadow = true; g.add(body);
      const head = new THREE.Mesh(new THREE.SphereGeometry(s*0.50, 12, 10), mat(skinCol));
      head.position.set(s*0.85, s*0.85, 0); head.castShadow = true; g.add(head);
      // Snout
      const snout = new THREE.Mesh(new THREE.BoxGeometry(s*0.45, s*0.30, s*0.35), mat(skinCol));
      snout.position.set(s*1.15, s*0.75, 0); g.add(snout);
      // Floppy ears
      for (const zs of [-0.25, 0.25]) {
        const ear = new THREE.Mesh(new THREE.BoxGeometry(s*0.10, s*0.45, s*0.18), mat(0x4a3020));
        ear.position.set(s*0.70, s*0.95, zs * s); g.add(ear);
      }
      // Legs
      for (let i = 0; i < 4; i++) {
        const xz = i < 2 ? -s*0.30 : s*0.45;
        const zs = i % 2 === 0 ? -s*0.40 : s*0.40;
        const leg = new THREE.Mesh(new THREE.CylinderGeometry(s*0.13, s*0.10, s*0.45, 6), mat(skinCol));
        leg.position.set(xz, s*0.22, zs); g.add(leg);
      }
      const tail = new THREE.Mesh(new THREE.CylinderGeometry(s*0.07, s*0.05, s*0.9, 6), mat(skinCol));
      tail.position.set(-s*0.85, s*0.85, 0); tail.rotation.z = Math.PI/2.5; g.add(tail);
      break; }
    case 'VACUUM': {
      // Round vacuum body
      const body = new THREE.Mesh(new THREE.CylinderGeometry(s*0.9, s*1.0, s*0.7, 16), mat(skinCol));
      body.position.y = s*0.4; body.castShadow = true; g.add(body);
      const top = new THREE.Mesh(new THREE.CylinderGeometry(s*0.6, s*0.9, s*0.5, 16), mat(0x404048));
      top.position.y = s*1.0; g.add(top);
      // Suction nozzle
      const nozzle = new THREE.Mesh(new THREE.ConeGeometry(s*0.4, s*0.6, 10, 1, true), mat(0x202020));
      nozzle.position.set(s*0.9, s*0.5, 0); nozzle.rotation.z = -Math.PI/2; g.add(nozzle);
      // Eye / sensor
      const eye = new THREE.Mesh(new THREE.SphereGeometry(s*0.18, 8, 6),
        new THREE.MeshStandardMaterial({ color:0xff4030, emissive:0xff4030, emissiveIntensity:1.0 }));
      eye.position.set(0, s*1.2, s*0.5); g.add(eye);
      break; }
    case 'HAMSTER': {
      const body = new THREE.Mesh(new THREE.SphereGeometry(s*0.7, 14, 10), mat(skinCol));
      body.scale.set(1.1, 1.0, 1.1); body.position.y = s*0.6; body.castShadow = true; g.add(body);
      // Cute face
      for (const zs of [-0.15, 0.15]) {
        const eye = new THREE.Mesh(new THREE.SphereGeometry(s*0.06, 8, 6),
          new THREE.MeshStandardMaterial({ color:0x000000 }));
        eye.position.set(s*0.55, s*0.80, zs * s); g.add(eye);
      }
      const nose = new THREE.Mesh(new THREE.SphereGeometry(s*0.04, 6, 5), mat(0xff8080));
      nose.position.set(s*0.65, s*0.65, 0); g.add(nose);
      // Ears
      for (const zs of [-0.25, 0.25]) {
        const ear = new THREE.Mesh(new THREE.SphereGeometry(s*0.10, 8, 6), mat(skinCol));
        ear.scale.set(0.7, 0.4, 0.7);
        ear.position.set(s*0.30, s*1.15, zs * s); g.add(ear);
      }
      break; }
    case 'LIL BROTHER': {
      // GIANT giant kid hand peeking in
      const arm = new THREE.Mesh(new THREE.CylinderGeometry(s*0.6, s*0.7, s*2.0, 12), mat(skinCol));
      arm.position.y = s*1.0; arm.rotation.z = 0.2; arm.castShadow = true; g.add(arm);
      const hand = new THREE.Mesh(new THREE.SphereGeometry(s*0.85, 12, 10), mat(skinCol));
      hand.position.set(s*0.2, s*1.9, 0); g.add(hand);
      // Pointy index finger
      const finger = new THREE.Mesh(new THREE.CylinderGeometry(s*0.18, s*0.18, s*0.8, 8), mat(skinCol));
      finger.position.set(s*0.7, s*1.7, 0); finger.rotation.z = -Math.PI/3; finger.castShadow = true; g.add(finger);
      const tip = new THREE.Mesh(new THREE.SphereGeometry(s*0.18, 8, 6), mat(skinCol));
      tip.position.set(s*1.05, s*1.45, 0); g.add(tip);
      break; }
    default: {
      // Generic blob
      const m = new THREE.Mesh(new THREE.SphereGeometry(s*0.5, 12, 8), mat(skinCol));
      m.position.y = s*0.5; m.castShadow = true; g.add(m);
    }
  }
  // HP bar
  const hpBg = new THREE.Mesh(new THREE.PlaneGeometry(1.0 * s, 0.12),
    new THREE.MeshBasicMaterial({ color:0x202020, transparent:true, opacity:0.8 }));
  hpBg.position.set(0, 1.8 * s + 0.4, 0); g.add(hpBg);
  const hpFg = new THREE.Mesh(new THREE.PlaneGeometry(0.96 * s, 0.10),
    new THREE.MeshBasicMaterial({ color:0xe04040 }));
  hpFg.position.set(0, 1.8 * s + 0.4, 0.01); g.add(hpFg);
  g.userData.hpBg = hpBg; g.userData.hpFg = hpFg;
  return g;
}

// ─── MAP GENERATION ───────────────────────────────────────────────────────
// Slay-the-spire style: 6 columns of 2–3 nodes each, last column = boss
function generateMap(roomIdx){
  const cols = 6;
  const map = [];
  for (let c = 0; c < cols; c++) {
    if (c === cols - 1) {
      map.push([{ type:'boss', col:c, row:0, x:0, y:c, links:[] }]);
    } else {
      const count = c === 0 ? 1 : (1 + Math.floor(Math.random()*2)); // 1 or 2 nodes
      const col = [];
      for (let r = 0; r < count; r++) {
        let type;
        if (c === 0) type = 'battle';
        else {
          const roll = Math.random();
          if (roll < 0.60) type = 'battle';
          else if (roll < 0.75) type = 'elite';
          else if (roll < 0.90) type = 'shop';
          else type = 'event';
        }
        col.push({ type, col:c, row:r, x: r - (count-1)/2, y:c, links:[] });
      }
      map.push(col);
    }
  }
  // Wire links — each node links to 1–2 nodes in next column
  for (let c = 0; c < cols - 1; c++) {
    for (const n of map[c]) {
      const next = map[c + 1];
      const target1 = next[Math.floor(Math.random() * next.length)];
      n.links.push(target1);
      if (Math.random() < 0.4 && next.length > 1) {
        const t2 = next[(next.indexOf(target1) + 1) % next.length];
        if (t2 !== target1) n.links.push(t2);
      }
    }
  }
  return map;
}

// ─── BATTLE: SPAWN ENEMIES ───────────────────────────────────────────────
function rollEnemyTypeForRoom(roomIdx, isElite){
  const pools = [
    ['rat', 'windupBot', 'spider'],
    ['rat', 'windupBot', 'spider', 'dollhead', 'wasp'],
    ['windupBot', 'dollhead', 'beetle', 'wasp', 'bigRat'],
    ['dollhead', 'beetle', 'wasp', 'bigRat', 'toyTank'],
    ['beetle', 'bigRat', 'toyTank', 'dollhead', 'wasp'],
  ];
  const pool = pools[Math.min(roomIdx, pools.length-1)];
  let pick = pool[Math.floor(Math.random()*pool.length)];
  if (isElite) {
    // Bias toward tougher
    const tough = pool.filter(k => ['beetle','bigRat','toyTank','dollhead'].includes(k));
    if (tough.length > 0) pick = tough[Math.floor(Math.random()*tough.length)];
  }
  return pick;
}
function spawnEnemy(key, x, z){
  const def = ENEMIES[key];
  const id = nextId++;
  const e = {
    id, side:'enemy', def, name:def.name,
    x, y:0, z,
    vx:0, vz:0, facing:Math.PI,
    hp: def.hp, maxHp: def.hp,
    dmg: def.dmg, range:def.range, rate:def.rate, speed:def.speed,
    armor: def.armor || 0,
    cool: Math.random() * def.rate,
    target: null,
    status: {},
    mesh: null,
  };
  if (!STATE.render2D) {
    e.mesh = buildEnemyMesh(def);
    e.mesh.position.set(x, 0, z);
    battleRoot.add(e.mesh);
    unitMeshes.set(id, e.mesh);
  }
  STATE.battle.enemies.push(e);
  return e;
}

// ─── BATTLE: SOLDIER PLACEMENT ───────────────────────────────────────────
function spawnSoldier(def, x, z){
  const id = nextId++;
  // Apply squad mods
  const mods = STATE.squadMods;
  const u = {
    id, side:'player', def, name:def.name,
    x, y:0, z,
    vx:0, vz:0, facing:0,
    hp: def.hp * mods.hpMul, maxHp: def.hp * mods.hpMul,
    dmg: def.dmg * mods.dmgMul,
    range: def.range * mods.rangeMul,
    rate: def.rate * mods.rateMul,
    speed: def.speed * mods.spdMul,
    armor: mods.armor || 0,
    crit: mods.crit || 0,
    pierce: mods.pierce || 0,
    lifesteal: mods.lifesteal || 0,
    cool: 0,
    abilityCD: def.abilityCD * mods.abilityCDMul,
    abilityT: 0,
    target: null,
    moveTarget: null,
    status: {},
    mesh: null,
    placementOnly: true,    // becomes false when combat starts
  };
  if (!STATE.render2D) {
    u.mesh = buildSoldierMesh(def);
    u.mesh.position.set(x, 0, z);
    battleRoot.add(u.mesh);
    unitMeshes.set(id, u.mesh);
  }
  STATE.battle.units.push(u);
  return u;
}

function startBattle(nodeType){
  STATE.battle = {
    units: [],
    enemies: [],
    projectiles: [],
    turrets: [],
    waveIdx: 0,
    nodeType,
    room: ROOMS[STATE.roomIdx],
    started: false,
    paused: true,
    spawnQueue: [],
    timeBetweenWaves: 0,
    elapsed: 0,
    totalWaves: 3,
  };
  // Determine wave sizes
  const room = STATE.battle.room;
  const sizes = nodeType === 'elite' ? room.wavesHard : (nodeType === 'boss' ? [1] : (Math.random() < 0.5 ? room.wavesEasy : room.wavesMid));
  STATE.battle.waveSizes = sizes;
  STATE.battle.totalWaves = sizes.length;
  if (!STATE.render2D) buildBattlefield(room);
  STATE.phase = 'placement';
  switchScreen('battleScreen');
  if (STATE.render2D) resize2D();
  updateBattleHUD();
}

function startCombat(){
  if (!STATE.battle) return;
  STATE.battle.started = true;
  STATE.battle.paused = false;
  STATE.phase = 'battle';
  // Lock soldiers' placement mode
  for (const u of STATE.battle.units) u.placementOnly = false;
  spawnWave(0);
  updateBattleHUD();
  sfx('select');
}

function spawnWave(waveIdx){
  const b = STATE.battle;
  b.waveIdx = waveIdx;
  if (b.nodeType === 'boss') {
    // Boss wave: spawn the boss + 2 minions
    const bossKey = b.room.boss;
    spawnEnemy(bossKey, 0, ENEMY_SPAWN_Z + 1.5);
    // Minions
    const minionKey = rollEnemyTypeForRoom(STATE.roomIdx, false);
    spawnEnemy(minionKey, -3, ENEMY_SPAWN_Z + 0.5);
    spawnEnemy(minionKey, 3, ENEMY_SPAWN_Z + 0.5);
    sfx('boss');
  } else {
    const size = b.waveSizes[waveIdx];
    for (let i = 0; i < size; i++) {
      const isElite = b.nodeType === 'elite';
      const key = rollEnemyTypeForRoom(STATE.roomIdx, isElite);
      const x = (Math.random() - 0.5) * (BFIELD_W - 2);
      const z = ENEMY_SPAWN_Z + Math.random() * 1.5;
      spawnEnemy(key, x, z);
    }
  }
  toast(`WAVE ${waveIdx + 1} / ${b.totalWaves}`);
}

// ─── BATTLE: COMBAT LOOP ─────────────────────────────────────────────────
function distXZ(a, b){ const dx=a.x-b.x, dz=a.z-b.z; return Math.hypot(dx, dz); }

function battleUpdate(dt){
  if (!STATE.battle || STATE.battle.paused) return;
  const b = STATE.battle;
  b.elapsed += dt;
  // Move enemies (advance toward nearest player unit, or push forward if none)
  for (const e of b.enemies) {
    if (e.hp <= 0) continue;
    const allies = b.units.filter(u => u.hp > 0).concat(b.turrets.filter(t => t.hp > 0));
    if (allies.length === 0) {
      // Push forward
      e.vz = e.speed;
      e.vx = 0;
    } else {
      let best = null, bestD = Infinity;
      for (const a of allies) { const d = distXZ(e, a); if (d < bestD) { bestD = d; best = a; } }
      e.target = best;
      if (best) {
        if (bestD > e.range * 0.9) {
          const dx = best.x - e.x, dz = best.z - e.z;
          const ang = Math.atan2(dx, dz);
          e.facing = ang;
          e.vx = Math.sin(ang) * e.speed;
          e.vz = Math.cos(ang) * e.speed;
        } else {
          e.vx = 0; e.vz = 0;
          // Fire/attack
          e.cool -= dt;
          if (e.cool <= 0) {
            e.cool = e.rate;
            attack(e, best);
          }
        }
      }
    }
    e.x += e.vx * dt; e.z += e.vz * dt;
    // Clamp inside battlefield
    e.x = Math.max(-BFIELD_W/2 + 0.4, Math.min(BFIELD_W/2 - 0.4, e.x));
    e.z = Math.max(-BFIELD_D/2 + 0.4, Math.min(BFIELD_D/2 - 0.4, e.z));
    // Update mesh
    if (e.mesh) {
      e.mesh.position.set(e.x, 0, e.z);
      e.mesh.rotation.y = e.facing;
      // HP bar
      const ratio = Math.max(0, e.hp / e.maxHp);
      if (e.mesh.userData.hpFg) {
        e.mesh.userData.hpFg.scale.x = ratio;
        e.mesh.userData.hpFg.material.color.setHex(ratio > 0.5 ? 0xe04040 : ratio > 0.25 ? 0xe0a040 : 0xe04020);
      }
    }
  }
  // Move + fire player units
  for (const u of b.units.concat(b.turrets)) {
    if (u.hp <= 0) continue;
    // Movement: if has moveTarget, drift toward it
    if (u.moveTarget && !u.turret) {
      const dx = u.moveTarget.x - u.x, dz = u.moveTarget.z - u.z;
      const d = Math.hypot(dx, dz);
      if (d < 0.15) { u.moveTarget = null; u.vx = 0; u.vz = 0; }
      else {
        u.vx = dx/d * u.speed;
        u.vz = dz/d * u.speed;
        u.facing = Math.atan2(dx, dz);
      }
    } else {
      // No move order — face nearest enemy
      let best = null, bestD = Infinity;
      for (const e of b.enemies) { if (e.hp <= 0) continue; const d = distXZ(u, e); if (d < bestD) { bestD = d; best = e; } }
      if (best) u.facing = Math.atan2(best.x - u.x, best.z - u.z);
      u.vx = 0; u.vz = 0;
    }
    u.x += u.vx * dt; u.z += u.vz * dt;
    // Clamp inside player zone (turrets can be anywhere)
    if (!u.turret) {
      u.x = Math.max(-BFIELD_W/2 + 0.4, Math.min(BFIELD_W/2 - 0.4, u.x));
      u.z = Math.max(-BFIELD_D/2 + 0.4, Math.min(BFIELD_D/2 - 0.4, u.z));
    }
    // Fire
    u.cool -= dt;
    let best = null, bestD = Infinity;
    for (const e of b.enemies) {
      if (e.hp <= 0) continue;
      const d = distXZ(u, e);
      if (d < u.range && d < bestD) { bestD = d; best = e; }
    }
    if (best && u.cool <= 0) {
      u.cool = u.rate;
      u.target = best;
      fire(u, best);
    }
    // Ability cooldown
    if (u.abilityT > 0) u.abilityT -= dt;
    // Mesh updates
    if (u.mesh) {
      u.mesh.position.set(u.x, 0, u.z);
      u.mesh.rotation.y = u.facing;
      // HP bar
      const ratio = Math.max(0, u.hp / u.maxHp);
      if (u.mesh.userData.hpFg) {
        u.mesh.userData.hpFg.scale.x = ratio;
        u.mesh.userData.hpFg.material.color.setHex(ratio > 0.5 ? 0x40e040 : ratio > 0.25 ? 0xe0e040 : 0xe04040);
      }
      // Ability glow when ready
      if (u.mesh.userData.glow) {
        const ready = u.abilityT <= 0 && !u.turret;
        u.mesh.userData.glow.material.opacity = ready ? 0.6 + Math.sin(b.elapsed * 8) * 0.2 : 0;
      }
      // Selection ring
      if (u.mesh.userData.ring) {
        u.mesh.userData.ring.material.opacity = (STATE.selectedUnitId === u.id) ? 0.85 : 0;
      }
    }
  }
  // Medic passive heal
  for (const m of b.units) {
    if (m.def.ability !== 'heal' || m.hp <= 0) continue;
    for (const a of b.units) {
      if (a === m || a.hp <= 0 || a.hp >= a.maxHp) continue;
      if (distXZ(m, a) < 4) a.hp = Math.min(a.maxHp, a.hp + 4 * dt);
    }
  }
  // Tick projectiles
  for (const p of b.projectiles) {
    if (p.dead) continue;
    p.t += dt;
    p.x += p.vx * dt; p.z += p.vz * dt;
    if (p.mesh) { p.mesh.position.set(p.x, p.y, p.z); }
    // Hit detection
    const targets = p.side === 'player' ? b.enemies : b.units.concat(b.turrets);
    for (const t of targets) {
      if (t.hp <= 0) continue;
      if (p.hits && p.hits.includes(t.id)) continue;
      const d = Math.hypot(t.x - p.x, t.z - p.z);
      if (d < 0.55 + (t.def.size || 0.5) * 0.4) {
        // Apply damage
        const dmg = p.crit ? p.dmg * 2 : p.dmg;
        applyDamage(t, dmg, p.source);
        // Lifesteal
        if (p.lifesteal && p.source && p.source.hp > 0) {
          p.source.hp = Math.min(p.source.maxHp, p.source.hp + dmg * p.lifesteal);
        }
        p.hits = (p.hits || []).concat(t.id);
        if (p.pierce > 0) p.pierce -= 1;
        else { p.dead = true; break; }
      }
    }
    if (p.t > p.life) p.dead = true;
  }
  // Cleanup projectiles
  for (const p of b.projectiles) {
    if (p.dead && p.mesh && p.mesh.parent) p.mesh.parent.remove(p.mesh);
  }
  b.projectiles = b.projectiles.filter(p => !p.dead);
  // FX update
  for (const f of STATE.fx) {
    f.t += dt;
    if (f.mesh) {
      if (f.type === 'muzzle' || f.type === 'impact') {
        const k = 1 - f.t / f.dur;
        f.mesh.scale.setScalar(1 + (1 - k) * 1.2);
        if (f.mesh.material) f.mesh.material.opacity = Math.max(0, k);
      } else if (f.type === 'explosion') {
        const k = f.t / f.dur;
        f.mesh.scale.setScalar(1 + k * 3);
        if (f.mesh.material) f.mesh.material.opacity = Math.max(0, 1 - k);
      } else if (f.type === 'flame') {
        const k = f.t / f.dur;
        if (f.mesh.material) f.mesh.material.opacity = Math.max(0, 1 - k);
      } else if (f.type === 'heal') {
        f.mesh.position.y += dt * 1.2;
        if (f.mesh.material) f.mesh.material.opacity = Math.max(0, 1 - f.t/f.dur);
      } else if (f.type === 'corpse') {
        // Stays — clear after long duration
      } else if (f.type === 'bloodSplat') {
        // Stays on ground
      }
    }
    if (f.t > f.dur && f.type !== 'corpse' && f.type !== 'bloodSplat') f.dead = true;
  }
  for (const f of STATE.fx) {
    if (f.dead && f.mesh && f.mesh.parent) f.mesh.parent.remove(f.mesh);
  }
  STATE.fx = STATE.fx.filter(f => !f.dead);
  // Camera shake
  if (STATE.shake.t > 0) {
    STATE.shake.t -= dt;
    const m = STATE.shake.mag;
    if (camera) {
      camera.position.x += (Math.random()-0.5) * m;
      camera.position.z += (Math.random()-0.5) * m;
    }
  } else if (camera && !STATE.render2D) {
    // Restore base pose
    camera.position.set(0, 18, 14);
    camera.lookAt(0, 0, 0);
  }
  // Wave/battle progression
  const alive = b.enemies.some(e => e.hp > 0);
  if (!alive) {
    if (b.waveIdx + 1 < b.totalWaves) {
      b.timeBetweenWaves += dt;
      if (b.timeBetweenWaves > 1.6) {
        b.timeBetweenWaves = 0;
        spawnWave(b.waveIdx + 1);
      }
    } else {
      // Battle over
      endBattle(true);
    }
  }
  // Loss condition: an enemy crosses the back line
  for (const e of b.enemies) {
    if (e.hp <= 0) continue;
    if (e.z > BFIELD_D/2 - 0.5) {
      // Player takes damage
      STATE.hp -= 8;
      e.hp = 0;  // kill enemy
      toast('-8 HP');
      sfx('hit');
      shake(0.5, 0.3);
      if (STATE.hp <= 0) { endBattle(false); break; }
    }
  }
  // Player units dead?
  const aliveUnits = b.units.some(u => u.hp > 0);
  if (b.started && !aliveUnits && b.units.length > 0) {
    endBattle(false);
  }
  updateBattleHUD();
}

function fire(u, target){
  const dx = target.x - u.x, dz = target.z - u.z;
  const dist = Math.hypot(dx, dz);
  const speed = u.def.ability === 'frag' ? 18 : (u.def.ability === 'headshot' ? 60 : 35);
  const crit = Math.random() < (u.crit || 0);
  const p = {
    side: 'player',
    source: u,
    x: u.x, y: 1.1, z: u.z,
    vx: dx/dist * speed, vz: dz/dist * speed,
    dmg: u.dmg,
    crit,
    pierce: u.pierce || 0,
    lifesteal: u.lifesteal || 0,
    life: 2.0, t: 0,
    hits: [],
    mesh: null,
    kind: u.def.ability,
  };
  if (!STATE.render2D) {
    let g, m;
    if (u.def.ability === 'frag') {
      g = new THREE.SphereGeometry(0.14, 8, 6);
      m = new THREE.MeshStandardMaterial({ color:0x404040, emissive:0x402010, emissiveIntensity:0.4 });
      p.life = dist / speed;
      p.targetX = target.x; p.targetZ = target.z;
      p.isArc = true;
    } else if (u.def.ability === 'headshot') {
      g = new THREE.CylinderGeometry(0.02, 0.02, 0.8, 6);
      m = new THREE.MeshBasicMaterial({ color:0xffe080 });
    } else if (u.def.ability === 'inferno') {
      // Flame uses cone, not projectile
      doFlame(u, target);
      sfx('flame');
      return;
    } else {
      g = new THREE.CylinderGeometry(0.04, 0.04, 0.32, 6);
      m = new THREE.MeshBasicMaterial({ color: crit ? 0xff8040 : 0xffe080 });
    }
    p.mesh = new THREE.Mesh(g, m);
    p.mesh.position.set(p.x, p.y, p.z);
    if (u.def.ability !== 'frag') p.mesh.rotation.z = Math.atan2(p.vx, p.vz) + Math.PI/2;
    battleRoot.add(p.mesh);
  }
  STATE.battle.projectiles.push(p);
  spawnFx('muzzle', u.x + Math.sin(u.facing)*0.5, 1.15, u.z + Math.cos(u.facing)*0.5, u.def.ability);
  sfx(u.def.ability === 'headshot' ? 'snipe' : 'fire');
}

function doFlame(u, target){
  // Flamer: cone AOE, immediate damage, lasting burn
  const angBase = Math.atan2(target.x - u.x, target.z - u.z);
  for (const e of STATE.battle.enemies) {
    if (e.hp <= 0) continue;
    const dx = e.x - u.x, dz = e.z - u.z, d = Math.hypot(dx, dz);
    if (d > 3.5) continue;
    const ang = Math.atan2(dx, dz);
    let diff = Math.abs(ang - angBase); if (diff > Math.PI) diff = Math.PI*2 - diff;
    if (diff < Math.PI/3) {
      applyDamage(e, u.dmg, u);
      e.status.burning = 3.0;
      e.status.burnDPS = u.dmg * 0.5;
    }
  }
  spawnFlameCone(u, angBase);
}

function spawnFlameCone(u, angBase){
  if (STATE.render2D) return;
  for (let i = 0; i < 8; i++) {
    const fd = 0.5 + Math.random()*2.8;
    const fa = angBase + (Math.random()-0.5) * Math.PI/2;
    const fm = new THREE.Mesh(new THREE.SphereGeometry(0.25 + Math.random()*0.18, 6, 5),
      new THREE.MeshBasicMaterial({ color: Math.random()<0.5 ? 0xff8030 : 0xffe040, transparent:true, opacity:0.8 }));
    fm.position.set(u.x + Math.sin(fa) * fd, 0.6 + Math.random()*0.8, u.z + Math.cos(fa) * fd);
    battleRoot.add(fm);
    STATE.fx.push({ type:'flame', t:0, dur:0.5, mesh:fm });
  }
}

function applyDamage(t, dmg, src){
  const armor = t.armor || 0;
  const actual = Math.max(1, dmg - armor);
  t.hp -= actual;
  if (t.mesh) shake(0.05, 0.10);
  spawnFx('impact', t.x, 0.9 + (t.def.size||0.5)*0.5, t.z, null, t.side === 'enemy' ? 0xff4040 : 0x40a0ff);
  spawnFx('bloodSplat', t.x, 0.02, t.z, null, t.def.col || 0x800000);
  if (t.hp <= 0) {
    t.hp = 0;
    onDeath(t, src);
  } else {
    sfx('hit');
  }
}

function onDeath(t, src){
  sfx('die');
  spawnFx('corpse', t.x, 0, t.z, null, t.def.col);
  if (t.mesh) {
    t.mesh.rotation.z = Math.PI/2;
    t.mesh.position.y = -0.15;
    if (t.mesh.userData.hpBg) t.mesh.userData.hpBg.visible = false;
    if (t.mesh.userData.hpFg) t.mesh.userData.hpFg.visible = false;
    // Remove unit mesh after delay or just leave it as a body (toy-style)
  }
  if (t.side === 'enemy') {
    STATE.gold += t.def.bounty;
    spawnFx('goldPop', t.x, 1.0, t.z);
  }
}

function attack(e, target){
  if (e.def.kind === 'ranged' || e.def.proj) {
    // Spawn enemy projectile
    const dx = target.x - e.x, dz = target.z - e.z, d = Math.hypot(dx, dz);
    const sp = 24;
    const p = {
      side: 'enemy', source: e,
      x: e.x, y: 1.0, z: e.z,
      vx: dx/d * sp, vz: dz/d * sp,
      dmg: e.dmg, crit:false, pierce:0, lifesteal:0,
      life: 1.8, t:0, hits:[],
      mesh: null,
    };
    if (!STATE.render2D) {
      const m = new THREE.Mesh(new THREE.SphereGeometry(0.12, 6, 5),
        new THREE.MeshBasicMaterial({ color:0xff4030 }));
      m.position.set(p.x, p.y, p.z); battleRoot.add(m); p.mesh = m;
    }
    STATE.battle.projectiles.push(p);
    sfx('fire');
  } else {
    // Melee — direct damage
    applyDamage(target, e.dmg, e);
  }
}

// ─── ABILITIES ────────────────────────────────────────────────────────────
function activateAbility(u){
  if (!u || u.hp <= 0 || u.abilityT > 0 || u.placementOnly) return;
  u.abilityT = u.abilityCD;
  sfx('ability');
  const b = STATE.battle;
  switch (u.def.ability) {
    case 'aimed': {  // pierce + 3x damage shot
      // Find nearest enemy
      let best = null, bd = Infinity;
      for (const e of b.enemies) { if (e.hp <= 0) continue; const d = distXZ(u, e); if (d < u.range * 1.5 && d < bd) { bd = d; best = e; } }
      if (best) {
        const oldDmg = u.dmg; const oldP = u.pierce;
        u.dmg *= 3; u.pierce = 2;
        fire(u, best);
        u.dmg = oldDmg; u.pierce = oldP;
      }
      break; }
    case 'headshot': {  // massive single-target damage
      let best = null, bd = Infinity;
      for (const e of b.enemies) { if (e.hp <= 0) continue; const d = distXZ(u, e); if (d < bd) { bd = d; best = e; } }
      if (best) applyDamage(best, u.dmg * 5, u);
      break; }
    case 'suppress': {  // cone slow + DOT
      const ang = u.facing;
      for (const e of b.enemies) {
        if (e.hp <= 0) continue;
        const dx = e.x - u.x, dz = e.z - u.z, d = Math.hypot(dx, dz);
        if (d > 6) continue;
        const ea = Math.atan2(dx, dz);
        let diff = Math.abs(ea - ang); if (diff > Math.PI) diff = Math.PI*2 - diff;
        if (diff < Math.PI/4) {
          e.status.slow = 3.0;
          e.speed = e.def.speed * 0.4;
          e.status.dot = 4.0; e.status.dotDmg = u.dmg * 0.6;
        }
      }
      break; }
    case 'frag': {  // big explosion at facing
      const tx = u.x + Math.sin(u.facing) * 5, tz = u.z + Math.cos(u.facing) * 5;
      explode(tx, tz, 3.5, u.dmg * 3, u);
      break; }
    case 'inferno': {  // big flame cone
      for (let i = 0; i < 3; i++) {
        const ang = u.facing + (i - 1) * 0.3;
        for (const e of b.enemies) {
          if (e.hp <= 0) continue;
          const dx = e.x - u.x, dz = e.z - u.z, d = Math.hypot(dx, dz);
          if (d > 5) continue;
          const ea = Math.atan2(dx, dz);
          let diff = Math.abs(ea - ang); if (diff > Math.PI) diff = Math.PI*2 - diff;
          if (diff < Math.PI/6) {
            applyDamage(e, u.dmg * 1.2, u);
            e.status.burning = 5; e.status.burnDPS = u.dmg * 1.0;
          }
        }
        spawnFlameCone(u, ang);
      }
      break; }
    case 'dash': {  // blink behind nearest + crit
      let best = null, bd = Infinity;
      for (const e of b.enemies) { if (e.hp <= 0) continue; const d = distXZ(u, e); if (d < bd) { bd = d; best = e; } }
      if (best) {
        u.x = best.x; u.z = best.z + 0.8;
        applyDamage(best, u.dmg * 4, u);
      }
      break; }
    case 'heal': {  // AoE burst heal
      for (const a of b.units) {
        if (a.hp <= 0 || a === u) continue;
        if (distXZ(a, u) < 5) {
          a.hp = Math.min(a.maxHp, a.hp + a.maxHp * 0.45);
          spawnFx('heal', a.x, 1.5, a.z);
        }
      }
      sfx('heal');
      break; }
    case 'turret': {  // plant a turret
      const tx = u.x, tz = u.z + 0.6;
      placeTurret(tx, tz, u);
      break; }
  }
}

function explode(x, z, radius, dmg, src){
  for (const e of STATE.battle.enemies) {
    if (e.hp <= 0) continue;
    const d = Math.hypot(e.x - x, e.z - z);
    if (d < radius) {
      const falloff = 1 - d/radius;
      applyDamage(e, dmg * (0.5 + falloff * 0.5), src);
    }
  }
  spawnFx('explosion', x, 0.5, z);
  sfx('explode');
  shake(0.20, 0.35);
}

function placeTurret(x, z, owner){
  const id = nextId++;
  const t = {
    id, side:'player', turret:true,
    def: { name:'TURRET', col:0x806840, ability:'turret', size:0.4 },
    x, z, y:0, vx:0, vz:0, facing:0,
    hp: 80, maxHp: 80,
    dmg: 14, range:6, rate:0.45, speed:0,
    cool: 0, armor:0,
    crit:0, pierce:0, lifesteal:0,
    abilityT: 999, abilityCD:999,
    target:null, status:{},
    mesh:null,
  };
  if (!STATE.render2D) {
    const g = new THREE.Group();
    const base = new THREE.Mesh(new THREE.CylinderGeometry(0.4, 0.5, 0.3, 8),
      new THREE.MeshStandardMaterial({ color:0x808080, roughness:0.3, metalness:0.7 }));
    base.position.y = 0.15; g.add(base);
    const head = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.3, 0.6),
      new THREE.MeshStandardMaterial({ color:0x404040, roughness:0.4, metalness:0.5 }));
    head.position.y = 0.45; g.add(head);
    const barrel = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 0.5, 6),
      new THREE.MeshStandardMaterial({ color:0x202020 }));
    barrel.rotation.x = Math.PI/2; barrel.position.set(0, 0.45, 0.5); g.add(barrel);
    g.position.set(x, 0, z); battleRoot.add(g); t.mesh = g;
    // HP bar
    const hpBg = new THREE.Mesh(new THREE.PlaneGeometry(0.8, 0.10),
      new THREE.MeshBasicMaterial({ color:0x202020, transparent:true, opacity:0.8 }));
    hpBg.position.y = 1.0; g.add(hpBg);
    const hpFg = new THREE.Mesh(new THREE.PlaneGeometry(0.78, 0.08),
      new THREE.MeshBasicMaterial({ color:0x40e040 }));
    hpFg.position.set(0, 1.0, 0.01); g.add(hpFg);
    g.userData.hpBg = hpBg; g.userData.hpFg = hpFg;
  }
  STATE.battle.turrets.push(t);
}

// ─── FX ──────────────────────────────────────────────────────────────────
function spawnFx(type, x, y, z, kind, color){
  if (STATE.render2D) {
    // 2D handles its own FX paths
    STATE.fx.push({ type, t:0, dur: type === 'explosion' ? 0.5 : type === 'corpse' ? 999 : type === 'bloodSplat' ? 999 : 0.25, x, y, z, color });
    return;
  }
  let m = null, dur = 0.25;
  if (type === 'muzzle') {
    m = new THREE.Mesh(new THREE.SphereGeometry(0.18, 6, 5),
      new THREE.MeshBasicMaterial({ color:0xffe080, transparent:true, opacity:1 }));
    m.position.set(x, y, z);
    dur = 0.10;
  } else if (type === 'impact') {
    m = new THREE.Mesh(new THREE.SphereGeometry(0.25, 6, 5),
      new THREE.MeshBasicMaterial({ color:color || 0xff4040, transparent:true, opacity:1 }));
    m.position.set(x, y, z);
    dur = 0.18;
  } else if (type === 'explosion') {
    m = new THREE.Mesh(new THREE.SphereGeometry(0.5, 12, 8),
      new THREE.MeshBasicMaterial({ color:0xff8030, transparent:true, opacity:1 }));
    m.position.set(x, y, z);
    dur = 0.40;
  } else if (type === 'corpse') {
    // Just a small splat decal
    m = new THREE.Mesh(new THREE.CircleGeometry(0.55, 12),
      new THREE.MeshBasicMaterial({ color:0x300808, transparent:true, opacity:0.75 }));
    m.rotation.x = -Math.PI/2; m.position.set(x, 0.04, z);
    dur = 999;
  } else if (type === 'bloodSplat') {
    m = new THREE.Mesh(new THREE.CircleGeometry(0.18 + Math.random()*0.10, 8),
      new THREE.MeshBasicMaterial({ color:0x400408, transparent:true, opacity:0.65 }));
    m.rotation.x = -Math.PI/2; m.position.set(x + (Math.random()-0.5)*0.4, 0.05, z + (Math.random()-0.5)*0.4);
    dur = 999;
  } else if (type === 'heal') {
    m = new THREE.Mesh(new THREE.SphereGeometry(0.18, 6, 5),
      new THREE.MeshBasicMaterial({ color:0x40e080, transparent:true, opacity:0.9 }));
    m.position.set(x, y, z);
    dur = 0.6;
  } else if (type === 'goldPop') {
    m = new THREE.Mesh(new THREE.SphereGeometry(0.10, 6, 5),
      new THREE.MeshBasicMaterial({ color:0xffe040 }));
    m.position.set(x, y, z);
    dur = 0.5;
  }
  if (m) {
    battleRoot.add(m);
    STATE.fx.push({ type, t:0, dur, mesh:m });
  }
}
function shake(dur, mag){ STATE.shake.t = dur; STATE.shake.mag = mag; }

// ─── BATTLE END ───────────────────────────────────────────────────────────
function endBattle(victory){
  STATE.battle.paused = true;
  if (victory) {
    sfx('victory');
    // Cleanup state
    STATE.battle = null;
    STATE.currentNode.cleared = true;
    if (STATE.currentNode.type === 'boss') {
      // Room complete!
      STATE.roomIdx++;
      if (STATE.roomIdx >= ROOMS.length) {
        STATE.phase = 'win';
        switchScreen('winScreen');
        return;
      }
      // Big reward then go to next room
      STATE.gold += 30;
      STATE.hp = Math.min(STATE.maxHp, STATE.hp + 30);
      showDraft(3, true);   // bonus draft
    } else {
      // Normal post-battle: draft 1 card
      showDraft(3, false);
    }
  } else {
    sfx('loss');
    STATE.phase = 'loss';
    switchScreen('lossScreen');
    document.getElementById('lossStats').innerHTML =
      `<div style="font-family:'Caveat',cursive;font-size:18px;color:#c89858;margin-bottom:10px">Made it to ${ROOMS[STATE.roomIdx].name}, node ${STATE.nodeIdx+1}</div>
       <div>Squad: ${STATE.squad.map(d => d.name).join(', ') || '—'}</div>
       <div>Parts looted: ${STATE.gold}</div>`;
  }
}

// ─── DRAFT ────────────────────────────────────────────────────────────────
function showDraft(count, isBossReward){
  STATE.phase = 'draft';
  // Bias by rarity
  const pool = [...CARDS];
  const picks = [];
  for (let i = 0; i < (count || 3); i++) {
    const roll = Math.random();
    let rarity = roll < 0.55 ? 'C' : roll < 0.85 ? 'U' : 'R';
    if (isBossReward) rarity = i === 0 ? 'R' : (Math.random() < 0.5 ? 'R' : 'U');
    const sub = pool.filter(c => c.rarity === rarity);
    const pick = sub[Math.floor(Math.random()*sub.length)];
    picks.push(pick);
  }
  STATE.draftOptions = picks;
  renderDraftScreen(isBossReward);
  switchScreen('draftScreen');
}
function pickDraftCard(idx){
  const c = STATE.draftOptions[idx];
  if (!c) return;
  applyCard(c);
  sfx('select');
  STATE.draftOptions = null;
  // Go to next node or map
  STATE.nodeIdx++;
  goMap();
}
function skipDraft(){
  STATE.gold += 5;
  STATE.draftOptions = null;
  STATE.nodeIdx++;
  goMap();
}
function applyCard(c){
  if (c.type === 'unit') {
    STATE.squad.push(UNITS[c.unit]);
  } else if (c.type === 'upgrade') {
    if (c.stat === 'crit' || c.stat === 'lifesteal' || c.stat === 'pierce') {
      STATE.squadMods[c.stat] = (STATE.squadMods[c.stat] || 0) + c.amount;
    } else if (c.stat === 'armor') {
      STATE.squadMods.armor = (STATE.squadMods.armor || 0) + c.amount;
    } else if (c.stat === 'abilityCDMul') {
      STATE.squadMods.abilityCDMul *= c.amount;
    } else if (c.stat === 'rateMul') {
      STATE.squadMods.rateMul *= c.amount;
    } else {
      STATE.squadMods[c.stat] *= c.amount;
    }
  } else if (c.type === 'heal') {
    if (c.amount === 'full') STATE.hp = STATE.maxHp;
    else STATE.hp = Math.min(STATE.maxHp, STATE.hp + STATE.maxHp * c.amount);
  } else if (c.type === 'gold') {
    STATE.gold += c.amount;
  }
}

// ─── SCREENS ──────────────────────────────────────────────────────────────
function switchScreen(id){
  document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
  const el = document.getElementById(id);
  if (el) el.classList.add('active');
  requestAnimationFrame(resizeArena);
}
function goTitle(){
  STATE.phase = 'title';
  STATE.running = false;
  switchScreen('titleScreen');
}
function startNewRun(){
  STATE.phase = 'map';
  STATE.hp = 100; STATE.maxHp = 100;
  STATE.gold = 8;
  STATE.squad = [UNITS.rifleman, UNITS.rifleman, UNITS.heavy];
  STATE.squadMods = { dmgMul:1, rateMul:1, hpMul:1, rangeMul:1, spdMul:1, crit:0, pierce:0, lifesteal:0, armor:0, abilityCDMul:1 };
  STATE.roomIdx = 0;
  STATE.nodeIdx = 0;
  STATE.map = generateMap(0);
  STATE.currentNode = null;
  STATE.running = true;
  goMap();
}
function goMap(){
  // Generate fresh map if we advanced room
  if (!STATE.map || (STATE.currentNode && STATE.currentNode.type === 'boss')) {
    STATE.map = generateMap(STATE.roomIdx);
    STATE.nodeIdx = 0;
  }
  STATE.phase = 'map';
  renderMapScreen();
  switchScreen('mapScreen');
}
function selectNode(nodeRef){
  STATE.currentNode = nodeRef;
  if (nodeRef.type === 'shop') openShop();
  else if (nodeRef.type === 'event') runEvent();
  else startBattle(nodeRef.type);
}
function openShop(){
  STATE.phase = 'shop';
  renderShopScreen();
  switchScreen('shopScreen');
}
function buyShopItem(idx){
  const item = STATE.shopItems[idx];
  if (!item || item.sold || STATE.gold < item.cost) return;
  STATE.gold -= item.cost;
  applyCard(item.card);
  item.sold = true;
  renderShopScreen();
  sfx('select');
}
function leaveShop(){
  STATE.nodeIdx++;
  goMap();
}
function runEvent(){
  // Random event — heal vs gamble
  const ev = Math.random();
  let msg, choices;
  if (ev < 0.33) {
    msg = 'You find a tube of toothpaste. Tastes weird but heals the squad.';
    choices = [
      { label:'EAT IT (+30 HP)', do:() => { STATE.hp = Math.min(STATE.maxHp, STATE.hp + 30); } },
      { label:'SAVE IT (+10 PARTS)', do:() => { STATE.gold += 10; } },
    ];
  } else if (ev < 0.66) {
    msg = 'A loose nail. Trade safety for power?';
    choices = [
      { label:'STAB IT (+15% DMG, -10 HP)', do:() => { STATE.squadMods.dmgMul *= 1.15; STATE.hp = Math.max(1, STATE.hp - 10); } },
      { label:'WALK PAST', do:() => {} },
    ];
  } else {
    msg = 'An open jar of candy. Sticky temptation.';
    choices = [
      { label:'GORGE (+20 PARTS, -20% SPEED)', do:() => { STATE.gold += 20; STATE.squadMods.spdMul *= 0.80; } },
      { label:'SHARE (+15 HP)', do:() => { STATE.hp = Math.min(STATE.maxHp, STATE.hp + 15); } },
    ];
  }
  STATE.eventChoices = choices;
  document.getElementById('eventMsg').innerHTML = msg;
  const div = document.getElementById('eventChoices');
  div.innerHTML = '';
  choices.forEach((ch, i) => {
    const btn = document.createElement('button');
    btn.className = 'menu-btn';
    btn.textContent = ch.label;
    btn.onclick = () => { ch.do(); sfx('select'); STATE.nodeIdx++; goMap(); };
    div.appendChild(btn);
  });
  switchScreen('eventScreen');
}

function renderMapScreen(){
  const g = document.getElementById('mapGraph');
  g.innerHTML = '';
  const cols = STATE.map.length;
  const W = 920, H = 460;
  const colW = W / cols;
  // Connections
  const svgNS = 'http://www.w3.org/2000/svg';
  const svg = document.createElementNS(svgNS, 'svg');
  svg.setAttribute('width', W); svg.setAttribute('height', H);
  svg.style.position = 'absolute';
  svg.style.left = '0'; svg.style.top = '0';
  for (let c = 0; c < cols - 1; c++) {
    for (const n of STATE.map[c]) {
      for (const link of n.links) {
        const x1 = colW * (c + 0.5);
        const y1 = H/2 + n.x * 80;
        const x2 = colW * (c + 1.5);
        const y2 = H/2 + link.x * 80;
        const line = document.createElementNS(svgNS, 'line');
        line.setAttribute('x1', x1); line.setAttribute('y1', y1);
        line.setAttribute('x2', x2); line.setAttribute('y2', y2);
        line.setAttribute('stroke', n.cleared ? '#80f0a0' : '#604018');
        line.setAttribute('stroke-width', '3');
        line.setAttribute('stroke-dasharray', n.cleared ? '0' : '4 4');
        svg.appendChild(line);
      }
    }
  }
  g.appendChild(svg);
  // Nodes
  for (let c = 0; c < cols; c++) {
    for (const n of STATE.map[c]) {
      const btn = document.createElement('button');
      btn.className = 'mapnode ' + n.type + (n.cleared ? ' cleared' : '');
      const cx = colW * (c + 0.5) - 36;
      const cy = H/2 + n.x * 80 - 36;
      btn.style.left = cx + 'px'; btn.style.top = cy + 'px';
      btn.innerHTML = n.type === 'battle' ? '⚔' : n.type === 'elite' ? '☠' : n.type === 'shop' ? '⛁' : n.type === 'event' ? '?' : '★';
      // Selectability: must be in current column
      const isCurrent = c === STATE.nodeIdx;
      if (isCurrent && !n.cleared) {
        btn.onclick = () => { sfx('click'); selectNode(n); };
        btn.classList.add('selectable');
      } else {
        btn.disabled = true;
      }
      g.appendChild(btn);
    }
  }
  // Update HUD
  document.getElementById('mapRoomLabel').textContent = ROOMS[STATE.roomIdx].name;
  document.getElementById('mapHp').textContent = `HP ${Math.ceil(STATE.hp)}/${STATE.maxHp}`;
  document.getElementById('mapGold').textContent = `PARTS ${STATE.gold}`;
  document.getElementById('mapSquad').innerHTML = STATE.squad.length === 0 ? '<span style="opacity:0.5">empty</span>' :
    STATE.squad.map(d => `<div class="squad-chip" style="background:#${d.col.toString(16).padStart(6,'0')}40;border-color:#${d.col.toString(16).padStart(6,'0')}">${d.tag}</div>`).join('');
}

function renderShopScreen(){
  if (!STATE.shopItems) {
    STATE.shopItems = [];
    const pool = [...CARDS];
    for (let i = 0; i < 4; i++) {
      const c = pool[Math.floor(Math.random()*pool.length)];
      const cost = c.rarity === 'C' ? 6 : c.rarity === 'U' ? 12 : 22;
      STATE.shopItems.push({ card:c, cost, sold:false });
    }
  }
  const items = document.getElementById('shopItems');
  items.innerHTML = '';
  STATE.shopItems.forEach((item, i) => {
    const div = document.createElement('div');
    div.className = 'shop-item ' + (item.sold ? 'sold' : '') + (STATE.gold < item.cost ? ' poor' : '');
    div.innerHTML = `
      <div class="shop-rarity ${item.card.rarity}">${item.card.rarity}</div>
      <div class="shop-title">${item.card.title}</div>
      <div class="shop-text">${item.card.text}</div>
      <button class="shop-buy">${item.sold ? 'SOLD' : (item.cost + ' PARTS')}</button>`;
    if (!item.sold && STATE.gold >= item.cost) {
      div.querySelector('.shop-buy').onclick = () => buyShopItem(i);
    }
    items.appendChild(div);
  });
  document.getElementById('shopGold').textContent = `PARTS ${STATE.gold}`;
}

function renderDraftScreen(isBoss){
  const items = document.getElementById('draftItems');
  items.innerHTML = '';
  const opts = STATE.draftOptions || [];
  document.getElementById('draftLabel').textContent = isBoss ? 'BOSS REWARD — PICK ONE' : 'PICK ONE';
  opts.forEach((c, i) => {
    const div = document.createElement('div');
    div.className = 'draft-card rarity-' + c.rarity;
    div.innerHTML = `
      <div class="draft-rarity">${c.rarity === 'C' ? 'COMMON' : c.rarity === 'U' ? 'UNCOMMON' : 'RARE'}</div>
      <div class="draft-title">${c.title}</div>
      <div class="draft-text">${c.text}</div>`;
    div.onclick = () => pickDraftCard(i);
    items.appendChild(div);
  });
}

// ─── BATTLE INPUT ─────────────────────────────────────────────────────────
function setupInput(){
  const c = document.getElementById('arena');
  c.addEventListener('pointerdown', onPointerDown);
  c.addEventListener('pointermove', onPointerMove);
  c.addEventListener('pointerup', onPointerUp);
  c.addEventListener('contextmenu', e => e.preventDefault());
  if (typeof ResizeObserver !== 'undefined') {
    try { new ResizeObserver(() => resizeArena()).observe(c); } catch(e){}
  }
  window.addEventListener('keydown', onKey);
}
function onKey(e){
  if (e.key === 'Escape') {
    if (STATE.phase === 'battle' || STATE.phase === 'placement') {
      pauseToggle();
    }
  }
  if (e.key === ' ' || e.key.toLowerCase() === 'q') {
    if (STATE.phase === 'placement') startCombat();
    else if (STATE.phase === 'battle' && STATE.selectedUnitId) {
      const u = findUnit(STATE.selectedUnitId);
      if (u) activateAbility(u);
    }
  }
  // Number keys 1..8 — select Nth deployed unit
  const n = parseInt(e.key, 10);
  if (!isNaN(n) && n >= 1 && n <= 9 && STATE.battle) {
    const u = STATE.battle.units[n - 1];
    if (u && u.hp > 0) { STATE.selectedUnitId = u.id; updateBattleHUD(); sfx('select'); }
  }
}
function findUnit(id){ return STATE.battle.units.find(u => u.id === id); }

function screenToWorld(e){
  if (STATE.render2D) return screenToWorld2D(e);
  const c = document.getElementById('arena');
  const r = c.getBoundingClientRect();
  pointer.x = ((e.clientX - r.left) / r.width) * 2 - 1;
  pointer.y = -((e.clientY - r.top) / r.height) * 2 + 1;
  raycaster.setFromCamera(pointer, camera);
  const plane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
  const hit = new THREE.Vector3();
  raycaster.ray.intersectPlane(plane, hit);
  return { x: hit.x, z: hit.z };
}
function findClickedUnit(world){
  if (!STATE.battle) return null;
  for (const u of STATE.battle.units) {
    if (u.hp <= 0) continue;
    const d = Math.hypot(u.x - world.x, u.z - world.z);
    if (d < 0.8) return u;
  }
  return null;
}

let _ptStart = null;
let _dragInfo = null;
function onPointerDown(e){
  if (!STATE.battle) return;
  _ptStart = { x:e.clientX, y:e.clientY, t:performance.now() };
  const w = screenToWorld(e);
  if (STATE.phase === 'placement') {
    // Deploy or pick up a soldier
    const u = findClickedUnit(w);
    if (u) {
      _dragInfo = { unit:u, kind:'reposition' };
      STATE.selectedUnitId = u.id;
    } else if (STATE.selectedSquadIdx !== null && STATE.selectedSquadIdx !== undefined) {
      // Deploy from squad list
      const def = STATE.squad[STATE.selectedSquadIdx];
      if (def && w.z > PLAYER_ZONE_Z_MIN && Math.abs(w.x) < BFIELD_W/2 - 0.5) {
        spawnSoldier(def, w.x, w.z);
        STATE.selectedSquadIdx = null;
        updateBattleHUD();
        sfx('place');
      }
    }
  } else if (STATE.phase === 'battle') {
    const u = findClickedUnit(w);
    if (u) {
      STATE.selectedUnitId = u.id;
      _dragInfo = { unit:u, kind:'move' };
      sfx('select');
    } else if (STATE.selectedUnitId) {
      // Move selected unit to clicked position
      const sel = findUnit(STATE.selectedUnitId);
      if (sel) sel.moveTarget = { x:w.x, z:w.z };
      sfx('click');
    }
  }
  updateBattleHUD();
}
function onPointerMove(e){
  if (!_dragInfo || !STATE.battle) return;
  const w = screenToWorld(e);
  // Drag-to-move: continuously update moveTarget
  if (_dragInfo.kind === 'reposition' && STATE.phase === 'placement') {
    _dragInfo.unit.x = Math.max(-BFIELD_W/2+0.5, Math.min(BFIELD_W/2-0.5, w.x));
    _dragInfo.unit.z = Math.max(PLAYER_ZONE_Z_MIN, Math.min(BFIELD_D/2-0.5, w.z));
    if (_dragInfo.unit.mesh) _dragInfo.unit.mesh.position.set(_dragInfo.unit.x, 0, _dragInfo.unit.z);
  } else if (_dragInfo.kind === 'move' && STATE.phase === 'battle') {
    _dragInfo.unit.moveTarget = { x:w.x, z:w.z };
  }
}
function onPointerUp(e){
  _dragInfo = null;
  _ptStart = null;
}

// Choose a soldier from squad list to deploy next
function selectFromSquad(idx){
  STATE.selectedSquadIdx = idx;
  updateBattleHUD();
  sfx('select');
}
function unselectAll(){
  STATE.selectedSquadIdx = null;
  STATE.selectedUnitId = null;
  updateBattleHUD();
}
function sellPlacement(){
  // Remove selected unit from board (during placement)
  if (STATE.phase !== 'placement' || !STATE.selectedUnitId) return;
  const u = findUnit(STATE.selectedUnitId);
  if (!u) return;
  if (u.mesh && u.mesh.parent) u.mesh.parent.remove(u.mesh);
  STATE.battle.units = STATE.battle.units.filter(x => x !== u);
  STATE.selectedUnitId = null;
  updateBattleHUD();
}
function pauseToggle(){
  if (!STATE.battle) return;
  STATE.battle.paused = !STATE.battle.paused;
  document.getElementById('pauseLabel').textContent = STATE.battle.paused ? '▶ RESUME' : '❚❚ PAUSE';
}

// ─── HUD ─────────────────────────────────────────────────────────────────
function updateBattleHUD(){
  const b = STATE.battle; if (!b) return;
  document.getElementById('battleHp').textContent = `HP ${Math.ceil(STATE.hp)}/${STATE.maxHp}`;
  document.getElementById('battleGold').textContent = `${STATE.gold} PARTS`;
  document.getElementById('battleWave').textContent = b.started ? `WAVE ${b.waveIdx+1}/${b.totalWaves}` : 'PLACEMENT';
  document.getElementById('battleRoom').textContent = b.room.name;
  // Squad bar (placement: pickable units / battle: unit cards)
  const sb = document.getElementById('squadBar');
  sb.innerHTML = '';
  if (STATE.phase === 'placement') {
    document.getElementById('battleStart').style.display = (b.units.length > 0) ? 'inline-block' : 'none';
    document.getElementById('battleStart').textContent = `▶ START COMBAT (${b.units.length} DEPLOYED)`;
    document.getElementById('battlePlacementHint').style.display = 'block';
    document.getElementById('squadBarLabel').textContent = 'YOUR SQUAD — TAP TO PICK, THEN TAP THE FIELD';
    STATE.squad.forEach((def, i) => {
      const div = document.createElement('div');
      div.className = 'squad-card' + (STATE.selectedSquadIdx === i ? ' selected' : '');
      div.style.borderColor = '#' + def.col.toString(16).padStart(6,'0');
      div.innerHTML = `
        <div class="sc-tag" style="background:#${def.col.toString(16).padStart(6,'0')}">${def.tag}</div>
        <div class="sc-name">${def.name}</div>
        <div class="sc-stats">${def.hp}HP · ${def.dmg}D · ${def.range}r</div>
        <div class="sc-ability">${def.abilityName}</div>`;
      div.onclick = () => selectFromSquad(i);
      sb.appendChild(div);
    });
  } else {
    document.getElementById('battleStart').style.display = 'none';
    document.getElementById('battlePlacementHint').style.display = 'none';
    document.getElementById('squadBarLabel').textContent = 'DEPLOYED — CLICK TO SELECT, SPACE TO ABILITY';
    b.units.forEach((u, i) => {
      const div = document.createElement('div');
      div.className = 'unit-card' + (STATE.selectedUnitId === u.id ? ' selected' : '') + (u.hp <= 0 ? ' dead' : '');
      div.style.borderColor = '#' + u.def.col.toString(16).padStart(6,'0');
      const cd = Math.max(0, u.abilityT);
      const cdRatio = u.abilityCD > 0 ? (1 - cd/u.abilityCD) : 1;
      div.innerHTML = `
        <div class="uc-num">${i+1}</div>
        <div class="uc-tag" style="background:#${u.def.col.toString(16).padStart(6,'0')}">${u.def.tag}</div>
        <div class="uc-bar"><div class="uc-bar-fg" style="width:${Math.max(0, u.hp/u.maxHp*100)}%"></div></div>
        <div class="uc-ability"><div class="uc-ability-fg" style="width:${cdRatio*100}%"></div><span>${u.def.abilityName}</span></div>`;
      div.onclick = () => { STATE.selectedUnitId = u.id; updateBattleHUD(); sfx('select'); };
      div.oncontextmenu = e => { e.preventDefault(); STATE.selectedUnitId = u.id; activateAbility(u); updateBattleHUD(); };
      sb.appendChild(div);
    });
    // Ability button
    if (STATE.selectedUnitId) {
      const u = findUnit(STATE.selectedUnitId);
      if (u && u.hp > 0) {
        const ab = document.createElement('button');
        ab.className = 'ability-btn';
        ab.disabled = u.abilityT > 0;
        ab.textContent = u.abilityT > 0 ? `${u.def.abilityName} (${u.abilityT.toFixed(1)}s)` : `▶ ${u.def.abilityName}`;
        ab.onclick = () => { activateAbility(u); updateBattleHUD(); };
        sb.appendChild(ab);
      }
    }
  }
}

function toast(msg){
  const t = document.getElementById('toast');
  if (!t) return;
  t.textContent = msg;
  t.classList.add('show');
  clearTimeout(toast._t);
  toast._t = setTimeout(() => t.classList.remove('show'), 1400);
}

// ─── MAIN LOOP ────────────────────────────────────────────────────────────
function loop(ts){
  requestAnimationFrame(loop);
  if (!STATE.running) { if (renderer && scene && camera && !STATE.render2D) renderer.render(scene, camera); else if (STATE.render2D) render2DFrame(); return; }
  if (!STATE.lastTime) STATE.lastTime = ts;
  const dt = Math.min(0.05, (ts - STATE.lastTime) / 1000);
  STATE.lastTime = ts;
  if ((STATE.phase === 'battle' || STATE.phase === 'placement') && STATE.battle) {
    battleUpdate(dt);
  }
  // Animate motes & FX
  if (!STATE.render2D && battleRoot) {
    for (const c of battleRoot.children) {
      if (c.userData && c.userData.kind === 'mote') {
        c.userData.t += dt;
        c.position.y += Math.sin(c.userData.t * 1.2) * dt * 0.3;
      }
    }
  }
  if (STATE.render2D) render2DFrame();
  else if (renderer && scene && camera) renderer.render(scene, camera);
}

// ─── 2D FALLBACK ──────────────────────────────────────────────────────────
let _2dCanvas = null, _2dCtx = null, _2dW = 0, _2dH = 0;
function init2DCanvas(){
  STATE.render2D = true;
  const c = document.getElementById('arena');
  c.innerHTML = '';
  _2dCanvas = document.createElement('canvas');
  _2dCanvas.style.width = '100%'; _2dCanvas.style.height = '100%'; _2dCanvas.style.display = 'block';
  c.appendChild(_2dCanvas);
  _2dCtx = _2dCanvas.getContext('2d');
  // Stub THREE objects
  scene = { add:()=>{}, remove:()=>{}, userData:{}, fog:null, background:null, children:[] };
  camera = { position:{set:()=>{},x:0,y:0,z:0}, lookAt:()=>{}, aspect:1, fov:50, updateProjectionMatrix:()=>{} };
  renderer = { setSize:()=>{}, setPixelRatio:()=>{}, render:()=>{}, domElement:_2dCanvas, shadowMap:{} };
  raycaster = { setFromCamera:()=>{}, ray:{ intersectPlane:(p,h) => { h.x=0;h.y=0;h.z=0; return h; } } };
  pointer = { x:0, y:0 };
  battleRoot = { add:()=>{}, remove:()=>{}, children:[] };
  resize2D();
  window.addEventListener('resize', resize2D);
}
function resize2D(){
  if (!_2dCanvas) return;
  const c = document.getElementById('arena');
  const w = c.clientWidth, h = c.clientHeight;
  if (!w || !h) return;
  const dpr = Math.min(window.devicePixelRatio||1, 2);
  _2dCanvas.width = w * dpr; _2dCanvas.height = h * dpr;
  _2dW = w; _2dH = h;
  _2dCtx.setTransform(dpr, 0, 0, dpr, 0, 0);
}
function worldToScreen2D(x, z){
  const margin = 24;
  const aw = _2dW - margin*2;
  const ah = _2dH - margin*2;
  const scale = Math.min(aw / BFIELD_W, ah / BFIELD_D);
  return {
    x: _2dW/2 + x * scale,
    y: _2dH/2 + z * scale,
    s: scale,
  };
}
function screenToWorld2D(e){
  const r = _2dCanvas.getBoundingClientRect();
  const px = e.clientX - r.left, py = e.clientY - r.top;
  const margin = 24;
  const aw = _2dW - margin*2, ah = _2dH - margin*2;
  const scale = Math.min(aw / BFIELD_W, ah / BFIELD_D);
  return { x: (px - _2dW/2) / scale, z: (py - _2dH/2) / scale };
}
function render2DFrame(){
  if (!_2dCtx) return;
  const ctx = _2dCtx;
  ctx.clearRect(0, 0, _2dW, _2dH);
  // Background
  ctx.fillStyle = '#101418'; ctx.fillRect(0, 0, _2dW, _2dH);
  // Battlefield
  if (STATE.battle) {
    const room = STATE.battle.room;
    const tl = worldToScreen2D(-BFIELD_W/2, -BFIELD_D/2);
    const br = worldToScreen2D(BFIELD_W/2, BFIELD_D/2);
    ctx.fillStyle = '#' + room.floor.toString(16).padStart(6,'0');
    ctx.fillRect(tl.x, tl.y, br.x - tl.x, br.y - tl.y);
    // Player zone tint
    const pz = worldToScreen2D(0, PLAYER_ZONE_Z_MIN);
    ctx.fillStyle = 'rgba(64, 128, 208, 0.10)';
    ctx.fillRect(tl.x, pz.y, br.x - tl.x, br.y - pz.y);
    // Spawn line (top)
    ctx.fillStyle = 'rgba(255, 64, 48, 0.30)';
    const sp = worldToScreen2D(0, ENEMY_SPAWN_Z + 0.5);
    ctx.fillRect(tl.x, tl.y, br.x - tl.x, sp.y - tl.y);
    // Corpses / blood
    for (const f of STATE.fx) {
      if (f.type === 'bloodSplat' || f.type === 'corpse') {
        const p = worldToScreen2D(f.x, f.z);
        ctx.fillStyle = f.type === 'corpse' ? 'rgba(48,8,8,0.7)' : 'rgba(64,4,8,0.65)';
        const r = (f.type === 'corpse' ? 14 : 6 + Math.random()*4);
        ctx.beginPath(); ctx.arc(p.x, p.y, r, 0, Math.PI*2); ctx.fill();
      }
    }
    // Soldiers
    for (const u of STATE.battle.units) {
      if (u.hp <= 0) continue;
      const p = worldToScreen2D(u.x, u.z);
      const rad = 14;
      // Shadow
      ctx.fillStyle = 'rgba(0,0,0,0.4)';
      ctx.beginPath(); ctx.ellipse(p.x, p.y + 4, rad + 2, rad/2.5, 0, 0, Math.PI*2); ctx.fill();
      // Body
      ctx.fillStyle = '#' + u.def.col.toString(16).padStart(6,'0');
      ctx.strokeStyle = '#0a0604'; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.arc(p.x, p.y, rad, 0, Math.PI*2); ctx.fill(); ctx.stroke();
      // Selection ring
      if (STATE.selectedUnitId === u.id) {
        ctx.strokeStyle = '#80f0ff'; ctx.lineWidth = 3;
        ctx.beginPath(); ctx.arc(p.x, p.y, rad + 4, 0, Math.PI*2); ctx.stroke();
      }
      // Tag
      ctx.fillStyle = '#0a0604';
      ctx.font = 'bold 14px Cinzel, serif';
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.fillText(u.def.tag, p.x, p.y);
      // HP bar
      const ratio = Math.max(0, u.hp / u.maxHp);
      ctx.fillStyle = 'rgba(0,0,0,0.7)'; ctx.fillRect(p.x - rad, p.y + rad + 4, rad*2, 4);
      ctx.fillStyle = ratio > 0.5 ? '#40e040' : ratio > 0.25 ? '#e0e040' : '#e04040';
      ctx.fillRect(p.x - rad, p.y + rad + 4, rad*2*ratio, 4);
      // Ability ready glow
      if (u.abilityT <= 0 && !u.placementOnly) {
        ctx.fillStyle = 'rgba(255, 224, 64, 0.85)';
        ctx.beginPath(); ctx.arc(p.x + rad - 4, p.y - rad + 4, 4, 0, Math.PI*2); ctx.fill();
      }
    }
    // Turrets
    for (const t of STATE.battle.turrets) {
      if (t.hp <= 0) continue;
      const p = worldToScreen2D(t.x, t.z);
      ctx.fillStyle = '#806840'; ctx.strokeStyle = '#0a0604'; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.rect(p.x - 10, p.y - 10, 20, 20); ctx.fill(); ctx.stroke();
      ctx.fillStyle = '#0a0604'; ctx.font = 'bold 10px Cinzel, serif';
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText('T', p.x, p.y);
    }
    // Enemies
    for (const e of STATE.battle.enemies) {
      if (e.hp <= 0) continue;
      const p = worldToScreen2D(e.x, e.z);
      const rad = 12 * (e.def.size || 0.6);
      ctx.fillStyle = 'rgba(0,0,0,0.4)';
      ctx.beginPath(); ctx.ellipse(p.x, p.y + 3, rad + 2, rad/2.5, 0, 0, Math.PI*2); ctx.fill();
      ctx.fillStyle = '#' + e.def.col.toString(16).padStart(6,'0');
      ctx.strokeStyle = '#400000'; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.arc(p.x, p.y, rad, 0, Math.PI*2); ctx.fill(); ctx.stroke();
      const ratio = Math.max(0, e.hp / e.maxHp);
      ctx.fillStyle = 'rgba(0,0,0,0.7)'; ctx.fillRect(p.x - rad, p.y + rad + 3, rad*2, 3);
      ctx.fillStyle = '#e04040'; ctx.fillRect(p.x - rad, p.y + rad + 3, rad*2*ratio, 3);
    }
    // Projectiles
    for (const pr of STATE.battle.projectiles) {
      if (pr.dead) continue;
      const p = worldToScreen2D(pr.x, pr.z);
      ctx.fillStyle = pr.side === 'player' ? '#ffe080' : '#ff4030';
      ctx.beginPath(); ctx.arc(p.x, p.y, 3, 0, Math.PI*2); ctx.fill();
    }
    // FX
    for (const f of STATE.fx) {
      if (f.type === 'explosion') {
        const p = worldToScreen2D(f.x, f.z);
        const r = (f.t / f.dur) * 50;
        ctx.strokeStyle = '#ff8030'; ctx.lineWidth = 3;
        ctx.beginPath(); ctx.arc(p.x, p.y, r, 0, Math.PI*2); ctx.stroke();
      } else if (f.type === 'muzzle' || f.type === 'impact') {
        const p = worldToScreen2D(f.x, f.z);
        const r = (1 - f.t/f.dur) * 14;
        ctx.fillStyle = f.type === 'muzzle' ? '#ffe080' : '#ff4040';
        ctx.beginPath(); ctx.arc(p.x, p.y, Math.max(0, r), 0, Math.PI*2); ctx.fill();
      } else if (f.type === 'heal') {
        const p = worldToScreen2D(f.x, f.z);
        ctx.fillStyle = '#40e080';
        ctx.beginPath(); ctx.arc(p.x, p.y, 6, 0, Math.PI*2); ctx.fill();
      }
    }
  }
}

// ─── BOOT ─────────────────────────────────────────────────────────────────
function bootGame(){
  let webglOK = true;
  try { initThree(); }
  catch (e) {
    console.warn('initThree failed, falling back to 2D:', e.message);
    webglOK = false;
    try { init2DCanvas(); }
    catch (e2) {
      console.error('2D fallback also failed:', e2);
      return;
    }
  }
  setupInput();
  goTitle();
  document.getElementById('loadingScreen').classList.remove('active');
  if (!webglOK) {
    const banner = document.createElement('div');
    banner.style.cssText = 'position:fixed;top:6px;left:50%;transform:translateX(-50%);z-index:9999;background:rgba(20,12,6,0.85);border:1px solid #604018;color:#c89858;font-family:Cinzel,serif;font-size:10px;letter-spacing:2px;padding:4px 12px;border-radius:4px';
    banner.textContent = '2D MODE — WEBGL UNAVAILABLE';
    document.body.appendChild(banner);
  }
  requestAnimationFrame(loop);
}
if (window.__threeLoaded) bootGame();
else window.addEventListener('three-ready', bootGame);

// Window exports
window.goTitle = goTitle;
window.startNewRun = startNewRun;
window.goMap = goMap;
window.selectNode = selectNode;
window.startCombat = startCombat;
window.pauseToggle = pauseToggle;
window.unselectAll = unselectAll;
window.sellPlacement = sellPlacement;
window.pickDraftCard = pickDraftCard;
window.skipDraft = skipDraft;
window.buyShopItem = buyShopItem;
window.leaveShop = leaveShop;
