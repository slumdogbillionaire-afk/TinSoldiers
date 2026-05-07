// =========================================================================
// TIN SOLDIERS REFORGED v9 — full 3D, free-orbit camera, max graphics
// Same RTS-on-rails gameplay as v8, completely rewritten visuals.
// =========================================================================
'use strict';

// ── World scale ─────────────────────────────────────────────────────────
const FIELD_W = 72;
const FIELD_D = 36;
const RIVER_HALF = 1.0;
const LANE_TOP_Z = -9.5;
const LANE_MID_Z = 0;
const LANE_BOT_Z = 9.5;
const LANE_HALF = 3.6;
const BRIDGES = [
  { z: LANE_TOP_Z, halfLength: 2.2 },
  { z: LANE_MID_Z, halfLength: 2.2 },
  { z: LANE_BOT_Z, halfLength: 2.2 },
];

// ── Roles & stats ───────────────────────────────────────────────────────
// Pass-A balance pass — DPS-per-cost normalized, outliers tamed.
// Notes per change:
//  swarm:    HP 80→70 each (3 of them, total 210 was too tanky for 2 cost)
//  scout:    DMG 20→18 (still scrappy, slightly less of a killer)
//  rifleman: dmg 36→32 (kept versatile but not a primary DPS pick)
//  sniper:   DMG 340→230, atkSpeed 2.0→2.4 (was one-shotting most things)
//  heavygunner: range 11→9, HP 520→460 (less of a do-everything brick)
//  flamer:   range 5→6 (slightly more useful), dmg 28→32
//  grenadier: dmg 130→100 (splash still potent)
//  lightV:   speed 5.6→5.0, dmg 30→26 (raider not duelist)
//  apc:      hp 780→700, dmg 38→34 (still tanky, less DPS)
//  tank:     dmg 200→160, splash 1.5→1.3, hp 1200→1050 (was god unit)
//  artillery: range 27→22, dmg 230→180, atkSpeed 2.8→3.4 (less safe-spam)
//  aa:       no nerf — already niche
//  medic:    no nerf
//  gunship:  hp 420→380 (still strong, slightly more punishable)
//  commander: dmg 120→95, hp 950→820 (cost-8 elite, not invincible)
const ROLE_STATS = {
  swarm:      { cost:2, hp:70,  dmg:14,  atkSpeed:0.7, range:7,  speed:3.2, radius:0.36, type:'ground', targets:'ground',     count:3, fire:'burst2',   armor:'light' },
  scout:      { cost:2, hp:150, dmg:18,  atkSpeed:0.4, range:7,  speed:4.6, radius:0.35, type:'ground', targets:'ground_air', count:1, fire:'shot',     armor:'light' },
  rifleman:   { cost:3, hp:240, dmg:32,  atkSpeed:0.5, range:9,  speed:3.3, radius:0.4,  type:'ground', targets:'ground_air', count:1, fire:'shot',     armor:'light' },
  sniper:     { cost:4, hp:175, dmg:230, atkSpeed:2.4, range:25, speed:2.3, radius:0.38, type:'ground', targets:'ground_air', count:1, fire:'snipe',    armor:'light' },
  heavygunner:{ cost:5, hp:460, dmg:26,  atkSpeed:0.13,range:9,  speed:1.6, radius:0.5,  type:'ground', targets:'ground_air', count:1, fire:'minigun',  armor:'medium' },
  flamer:     { cost:4, hp:380, dmg:32,  atkSpeed:0.1, range:6,  speed:2.0, radius:0.45, type:'ground', targets:'ground',     count:1, fire:'flame',    armor:'medium' },
  grenadier:  { cost:4, hp:210, dmg:100, atkSpeed:1.3, range:12, speed:2.3, radius:0.4,  type:'ground', targets:'ground',     count:1, fire:'grenade', splash:2.5, armor:'light' },
  lightV:     { cost:3, hp:340, dmg:26,  atkSpeed:0.32,range:8,  speed:5.0, radius:0.55, type:'ground', targets:'ground_air', count:1, fire:'mgShot',   armor:'medium' },
  apc:        { cost:5, hp:700, dmg:34,  atkSpeed:0.25,range:9,  speed:3.0, radius:0.65, type:'ground', targets:'ground_air', count:1, fire:'mgBurst',  armor:'heavy' },
  tank:       { cost:6, hp:1050,dmg:160, atkSpeed:1.4, range:14, speed:1.8, radius:0.78, type:'ground', targets:'ground',     count:1, fire:'cannon', splash:1.3,   armor:'heavy' },
  artillery:  { cost:7, hp:260, dmg:180, atkSpeed:3.4, range:22, speed:1.0, radius:0.62, type:'ground', targets:'ground',     count:1, fire:'arc',     splash:3.2,   armor:'light' },
  aa:         { cost:4, hp:310, dmg:75,  atkSpeed:0.4, range:18, speed:0,   radius:0.55, type:'ground', targets:'air',        count:1, fire:'flak',     armor:'medium' },
  medic:      { cost:3, hp:240, dmg:0,   atkSpeed:0.7, range:9,  speed:2.7, radius:0.4,  type:'ground', targets:'none',       count:1, fire:'heal', heal:42,        armor:'light' },
  gunship:    { cost:6, hp:380, dmg:36,  atkSpeed:0.16,range:12, speed:4.0, radius:0.55, type:'air',    targets:'ground_air', count:1, fire:'chain',    armor:'air' },
  commander:  { cost:8, hp:820, dmg:95,  atkSpeed:0.4, range:10, speed:3.0, radius:0.55, type:'ground', targets:'ground_air', count:1, fire:'burst3',   armor:'medium', aura:true },
};

// Damage matrix — attacker role × target role multiplier (default 1)
const DMG_MUL = {
  swarm:       { tank:0.4, apc:0.5, gunship:0.3, commander:0.7 },
  scout:       { swarm:1.4, sniper:1.5, medic:1.5, tank:0.3, apc:0.4 },
  rifleman:    { swarm:1.2, scout:1.2, tank:0.5, apc:0.6, gunship:0.6 },
  sniper:      { sniper:1.5, medic:2.0, commander:1.8, gunship:2.2, artillery:2.0, tank:0.5, apc:0.6, swarm:0.6 },
  heavygunner: { swarm:2.0, scout:1.6, rifleman:1.4, gunship:1.5, tank:0.4, apc:0.6 },
  flamer:      { swarm:2.4, scout:1.6, rifleman:1.4, heavygunner:1.3, tank:0.3, apc:0.4, artillery:0.4 },
  grenadier:   { swarm:1.5, tank:1.6, apc:1.6, artillery:1.5, gunship:0.0, scout:0.7 },
  lightV:      { swarm:1.3, sniper:1.5, medic:1.5, artillery:1.3, tank:0.3, apc:0.5 },
  apc:         { swarm:1.4, scout:1.3, rifleman:1.2, tank:0.6, gunship:0.7 },
  tank:        { tank:1.3, apc:1.5, lightV:1.6, heavygunner:1.4, gunship:0.0, sniper:1.4, swarm:0.8 },
  artillery:   { tank:1.6, apc:1.6, aa:2.0, artillery:1.5, heavygunner:1.4, gunship:0.0, swarm:1.3 },
  aa:          { gunship:2.5, swarm:0.0, scout:0.0, rifleman:0.0, tank:0.0, apc:0.0, sniper:0.0 },
  medic:       {},
  gunship:     { swarm:1.4, scout:1.2, sniper:1.2, artillery:1.6, tank:0.5, apc:0.6, aa:0.4 },
  commander:   { swarm:1.5, scout:1.4, rifleman:1.3, tank:0.7, apc:0.8, gunship:1.2 },
};
function getDmgMul(att, tgt){ if(!att||!tgt) return 1; const r=DMG_MUL[att]; if(!r) return 1; const v=r[tgt]; return v==null?1:v; }

// Quality / gore presets
const QUALITY_LEVELS = {
  low:    { name:'LOW',    shadowMap:1024, particleMul:0.45, fxLifeMul:0.6,  pixelRatio:1.0, drawTrees:0.55, postFX:false, reflections:false },
  medium: { name:'MEDIUM', shadowMap:1536, particleMul:0.85, fxLifeMul:0.85, pixelRatio:1.5, drawTrees:0.85, postFX:true,  reflections:true },
  high:   { name:'HIGH',   shadowMap:2560, particleMul:1.4,  fxLifeMul:1.15, pixelRatio:2.0, drawTrees:1.0,  postFX:true,  reflections:true },
};
const GORE_LEVELS = {
  low:    { name:'LOW',    bloodMul:0.3, chunkMul:0.4, poolDur:8,   stainDur:14,  splatterMul:0.4, vignetteMul:0.3 },
  medium: { name:'MEDIUM', bloodMul:1.0, chunkMul:1.0, poolDur:35,  stainDur:55,  splatterMul:1.0, vignetteMul:1.0 },
  high:   { name:'EXTREME',bloodMul:2.2, chunkMul:1.8, poolDur:120, stainDur:240, splatterMul:2.0, vignetteMul:1.7 },
};
const TIME_OF_DAY = {
  day:   { name:'DAY',   sunY:42, sunHex:0xfff0c8, sunInt:1.4, ambHex:0x90b0d0, ambInt:0.55, fogHex:0xb0c4d8, fogNear:60, fogFar:200, skyTop:0x6090c0, skyBot:0xc8e0f0 },
  dusk:  { name:'DUSK',  sunY:18, sunHex:0xff9050, sunInt:1.1, ambHex:0xa07090, ambInt:0.65, fogHex:0xc88860, fogNear:40, fogFar:160, skyTop:0xff6030, skyBot:0xffd090 },
  night: { name:'NIGHT', sunY:50, sunHex:0x6080d0, sunInt:0.4, ambHex:0x405080, ambInt:0.45, fogHex:0x101830, fogNear:35, fogFar:140, skyTop:0x040818, skyBot:0x102040 },
};

// ── FACTION MODS — Pass-A: factions actually play different ────────────
// Stat multipliers applied at spawn time. Scoped — each faction has identity.
const FACTION_MODS = {
  // Rebels: mobile harassers — fast, slightly fragile
  rebels: { hpMul:0.95, dmgMul:1.00, speedMul:1.15, rangeMul:1.00, costAdj:0,  energyMul:1.00, label:'Mobile / fast strikes' },
  // Empire: durable line — slow, tanky
  empire: { hpMul:1.18, dmgMul:1.00, speedMul:0.92, rangeMul:1.00, costAdj:0,  energyMul:1.00, label:'Durable / heavy line' },
  // Mercs: economy-driven — cheaper units, faster energy
  mercs:  { hpMul:1.00, dmgMul:1.05, speedMul:1.00, rangeMul:1.00, costAdj:-1, energyMul:1.10, label:'Economic / cheaper units' },
  // Cult: caster reach — long range, fragile, abilities cost less
  cult:   { hpMul:0.92, dmgMul:1.00, speedMul:1.00, rangeMul:1.15, costAdj:0,  energyMul:1.00, label:'Long range / fragile' },
};
// Faction-vs-faction soft rock-paper-scissors. Multiplier applied to outgoing damage.
// Matrix is intentionally subtle (5-10%) so unit-level matchups still dominate.
const FACTION_VS = {
  rebels: { mercs:1.10,  empire:0.95 },
  empire: { rebels:1.10, cult:0.95   },
  mercs:  { cult:1.10,   rebels:0.95 },
  cult:   { empire:1.10, mercs:0.95  },
};
function getFactionMod(fk){ return FACTION_MODS[fk] || { hpMul:1, dmgMul:1, speedMul:1, rangeMul:1, costAdj:0, energyMul:1 }; }
function getFactionVs(att, def){
  if (!att || !def) return 1;
  const r = FACTION_VS[att]; if (!r) return 1;
  const v = r[def]; return v == null ? 1 : v;
}
// Adjusted unit cost = role base cost + faction adj (clamped 1..10)
function unitCost(unitKey){
  const def = UNITS[unitKey]; if (!def) return 0;
  const fm = getFactionMod(def.faction);
  return Math.max(1, Math.min(10, def.cost + (fm.costAdj || 0)));
}

const FACTIONS = {
  rebels: { name:'REBELS', tagline:'Scrappy insurgents. Improvised gear.', style:'Earthy tones · patched armor',
    palette:{ main:0x8a6a3a, accent:0x3a2815, glow:0xf4a84a, flag:0xd4a054, skin:0xd8b088, metal:0x5a4a30 }, ability:'reinforcements',
    units:{ swarm:{name:'Rabble',desc:'Three cheap militia.'},scout:{name:'Runner',desc:'Fast carbine scout.'},rifleman:{name:'Guerrilla',desc:'Solid carbine infantry.'},sniper:{name:'Marksman',desc:'Long range. Glass cannon.'},heavygunner:{name:'Bruiser',desc:'Fixed MG. Shreds groups.'},flamer:{name:'Torch',desc:'Short-range flamer.'},grenadier:{name:'Bomber',desc:'Lobs grenades, splash.'},lightV:{name:'Buggy',desc:'Fast 4x4 with mounted MG.'},apc:{name:'Gun Truck',desc:'Armored transport.'},tank:{name:'Rust Tank',desc:'Slow, heavy cannon.'},artillery:{name:'Howitzer',desc:'Long-range arc.'},aa:{name:'Flak Jeep',desc:'Stationary anti-air.'},medic:{name:'Medic',desc:'Field heal beam.'},gunship:{name:'Scrap Helo',desc:'Patched helicopter.'},commander:{name:'Commander',desc:'Buffs nearby allies.'} } },
  empire: { name:'EMPIRE', tagline:'Disciplined state forces.', style:'White / gold / navy',
    palette:{ main:0xe0d4a8, accent:0x1a2855, glow:0xfff4a8, flag:0xe4d888, skin:0xe0c4a0, metal:0x6a5a30 }, ability:'mortar',
    units:{ swarm:{name:'Cadets',desc:'Three trainee conscripts.'},scout:{name:'Ranger',desc:'Light recon rifleman.'},rifleman:{name:'Trooper',desc:'Standard rifle.'},sniper:{name:'Sharpshooter',desc:'Precision sniper.'},heavygunner:{name:'Stormtrooper',desc:'Plasma repeater.'},flamer:{name:'Incinerator',desc:'Sanctioned flame purifier.'},grenadier:{name:'Thrower',desc:'Ceremonial grenade.'},lightV:{name:'Scout Car',desc:'Polished staff car.'},apc:{name:'Imperial APC',desc:'Heavy transport.'},tank:{name:'Imperial Tank',desc:'Gold-trim armor.'},artillery:{name:'Siege Gun',desc:'Stately long-range.'},aa:{name:'Flak Turret',desc:'Deployable AA.'},medic:{name:'Chaplain',desc:'Holy light healing.'},gunship:{name:'Gunship',desc:'Sleek attack helo.'},commander:{name:'Praetorian',desc:'Royal guard captain.'} } },
  mercs:  { name:'MERCS', tagline:'Corporate hitsquad.', style:'Black / orange tactical',
    palette:{ main:0x282828, accent:0x080808, glow:0xff6820, flag:0xf4894a, skin:0xd4b494, metal:0x4a4a4a }, ability:'paycheck',
    units:{ swarm:{name:'Goons',desc:'Three low-tier contractors.'},scout:{name:'Operator',desc:'Fast breaching specialist.'},rifleman:{name:'Contractor',desc:'Tactical rifleman.'},sniper:{name:'Assassin',desc:'Silenced sniper.'},heavygunner:{name:'Mercenary',desc:'Minigun specialist.'},flamer:{name:'Pyro',desc:'Modified flamethrower.'},grenadier:{name:'Demo',desc:'Frag grenade expert.'},lightV:{name:'Technical',desc:'Truck with heavy MG.'},apc:{name:'Black APC',desc:'Armored assault rig.'},tank:{name:'Black Tank',desc:'Modular tank.'},artillery:{name:'Howitzer-M',desc:'Contractor siege gun.'},aa:{name:'Stinger Rig',desc:'Missile-based AA.'},medic:{name:'Field Doctor',desc:'Drone-assisted medic.'},gunship:{name:'Stealth Drone',desc:'Autonomous drone.'},commander:{name:'Warboss',desc:'Merc captain.'} } },
  cult:   { name:'CULT', tagline:'Bloodthirsty zealots.', style:'Crimson · bone · ritual',
    palette:{ main:0x802030, accent:0x2a0a10, glow:0xff2040, flag:0xc44a88, skin:0xc8a090, metal:0x4a1a20 }, ability:'sacrifice',
    units:{ swarm:{name:'Thralls',desc:'Three chanting zealots.'},scout:{name:'Stalker',desc:'Swift robed predator.'},rifleman:{name:'Flagellant',desc:'Bolt pistol zealot.'},sniper:{name:'Eye Priest',desc:'Cursed rifle.'},heavygunner:{name:'Chosen',desc:'Cursed heavy weapon.'},flamer:{name:'Pyromancer',desc:'Blessed flame.'},grenadier:{name:'Bombthrower',desc:'Ritual explosives.'},lightV:{name:'Death Cart',desc:'Spike-studded fast cart.'},apc:{name:'Gore Wagon',desc:'Armored ritual transport.'},tank:{name:'Bone Crusher',desc:'Tank clad in bones.'},artillery:{name:'Bone Catapult',desc:'Ritual long-range.'},aa:{name:'Spike Shrine',desc:'Static AA altar.'},medic:{name:'Blood Priest',desc:'Siphons life to heal.'},gunship:{name:'Wing Demon',desc:'Bound flying horror.'},commander:{name:'High Prophet',desc:'Warp staff aura.'} } },
};
const UNITS = {};
function buildUnits(){
  for(const k of Object.keys(UNITS)) delete UNITS[k];
  for(const fk of Object.keys(FACTIONS)){
    const f = FACTIONS[fk];
    for(const r of Object.keys(ROLE_STATS)){
      const s = ROLE_STATS[r], fl = f.units[r];
      UNITS[fk+'_'+r] = {...s, name:fl.name, desc:fl.desc, role:r.toUpperCase(), roleKey:r, faction:fk,
        color:f.palette.main, accent:f.palette.accent, glow:f.palette.glow, skin:f.palette.skin, metal:f.palette.metal };
    }
  }
}
buildUnits();

// Powers
const POWERS = {
  airstrike:{ name:'Airstrike',cost:4,isPower:true,desc:'Three bombs in a row',shared:true },
  heal:     { name:'Heal Wave',cost:3,isPower:true,desc:'Restore HP to friendlies',shared:true },
  emp:      { name:'EMP',cost:4,isPower:true,desc:'Stun enemies in area 3s',shared:true },
  rebels_warcry:    { name:'War Cry',cost:3,isPower:true,faction:'rebels',desc:'+30% speed & dmg to all rebels for 6s' },
  rebels_scrapbomb: { name:'Scrap Bomb',cost:5,isPower:true,faction:'rebels',desc:'Massive single-impact bomb' },
  rebels_trench:    { name:'Trench Line',cost:2,isPower:true,faction:'rebels',desc:'Drops sandbag cover' },
  empire_artillery: { name:'Mass Barrage',cost:5,isPower:true,faction:'empire',desc:'5 shells over 4s' },
  empire_shield:    { name:'Aegis',cost:4,isPower:true,faction:'empire',desc:'All friendlies -50% dmg for 5s' },
  empire_parade:    { name:'Reinforce',cost:3,isPower:true,faction:'empire',desc:'Summon 2 Troopers' },
  mercs_smoke:      { name:'Smoke Screen',cost:2,isPower:true,faction:'mercs',desc:'4s no-targeting zone' },
  mercs_droneswarm: { name:'Drone Swarm',cost:5,isPower:true,faction:'mercs',desc:'Four drones strafe area' },
  mercs_hack:       { name:'Hack',cost:4,isPower:true,faction:'mercs',desc:'Disable enemy turrets 6s' },
  cult_curse:       { name:'Warp Curse',cost:4,isPower:true,faction:'cult',desc:'Enemies in area lose 40% HP' },
  cult_berserk:     { name:'Blood Frenzy',cost:3,isPower:true,faction:'cult',desc:'Allies in area +50% dmg 5s' },
  cult_summon:      { name:'Summon Horror',cost:6,isPower:true,faction:'cult',desc:'Spawn aberration' },
};
const FACTION_POWERS = {
  rebels:['airstrike','heal','emp','rebels_warcry','rebels_scrapbomb','rebels_trench'],
  empire:['airstrike','heal','emp','empire_artillery','empire_shield','empire_parade'],
  mercs: ['airstrike','heal','emp','mercs_smoke','mercs_droneswarm','mercs_hack'],
  cult:  ['airstrike','heal','emp','cult_curse','cult_berserk','cult_summon'],
};
const MISSIONS = [
  { id:1,name:'Boot Camp',desc:'First deployment.',enemy:'Rookie Squad',enemyFaction:'empire',aiSpeed:0.55,aiSmart:0.3,enemyHpMul:0.85 },
  { id:2,name:'Border Run',desc:'Contested outpost.',enemy:'Border Regiment',enemyFaction:'mercs',aiSpeed:0.65,aiSmart:0.45,enemyHpMul:0.95 },
  { id:3,name:'Iron Line',desc:'Armored division dug in.',enemy:'Iron Brigade',enemyFaction:'empire',aiSpeed:0.80,aiSmart:0.60,enemyHpMul:1.00 },
  { id:4,name:'Sky Fall',desc:'Air support inbound.',enemy:'Wing Corps',enemyFaction:'mercs',aiSpeed:0.90,aiSmart:0.70,enemyHpMul:1.05 },
  { id:5,name:'Last Stand',desc:'Elite opposition.',enemy:'Omega Battalion',enemyFaction:'cult',aiSpeed:1.00,aiSmart:0.85,enemyHpMul:1.15 },
  { id:6,name:'Black Ops',desc:'Deniable operation.',enemy:'Shadow Company',enemyFaction:'cult',aiSpeed:1.10,aiSmart:0.95,enemyHpMul:1.25 },
];
const MISSION_REWARDS = {1:[],2:['airstrike'],3:['heal'],4:[],5:['emp'],6:[]};
const TOWER_TYPES = {
  // Pass-A nerf: turrets are obstacles, not unkillable cannons.
  // Old: HP1500 DMG50 / HP1200 DMG115 / HP1300 DMG70
  // New: lower HP + DMG so a focused push (~3-4 mid units) can break a turret.
  gun:    { name:'Heavy Gun',   icon:'🗼',hp:1100,dmg:35, range:14,atkSpeed:1.0, targets:'ground_air',desc:'Balanced',     stats:'HP1100 DMG35 R14',  windup:0.4 },
  mortar: { name:'Siege Mortar',icon:'💣',hp:900, dmg:80, range:20,atkSpeed:2.4, targets:'ground',splash:2.6,desc:'Splash',  stats:'HP900 DMG80 SPLASH', windup:0.6 },
  aa:     { name:'Flak Tower',  icon:'✈️',hp:1000,dmg:50, range:18,atkSpeed:0.65,targets:'air',   desc:'Anti-air',           stats:'HP1000 DMG50 AA',    windup:0.4 },
};
const DIFFICULTY = {
  easy:   { name:'EASY',   aiSpeedMul:0.6, aiSmartMul:0.55, enemyHpMul:0.75, enemyStartEnergy:3, playerStartEnergyBonus:2 },
  normal: { name:'NORMAL', aiSpeedMul:1.0, aiSmartMul:1.0,  enemyHpMul:1.0,  enemyStartEnergy:5, playerStartEnergyBonus:0 },
  hard:   { name:'HARD',   aiSpeedMul:1.25,aiSmartMul:1.15, enemyHpMul:1.15, enemyStartEnergy:7, playerStartEnergyBonus:0 },
  brutal: { name:'BRUTAL', aiSpeedMul:1.55,aiSmartMul:1.3,  enemyHpMul:1.35, enemyStartEnergy:9, playerStartEnergyBonus:0 },
};
const MAP_THEMES = {
  grass:  { name:'FORESTED', ground:0x6a9848, dirtPath:0x8a6a3a, river:0x3a78b0, bridge:0x8a6a40, trunk:0x4a2a15, foliage:[0x3a6a25,0x4a7030,0x55803a], rock:0x7a7265, bush:0x4a7028, distant:0x2a4520, flowers:[0xf4e874,0xf48aa4,0xffffff,0xd4a4f4] },
  desert: { name:'DESERT',   ground:0xd4a855, dirtPath:0xa07030, river:0x4a88a8, bridge:0x6a4a20, trunk:0x5a3a20, foliage:[0x6a8a40,0x7a9848,0x8aa050], rock:0xa88a5a, bush:0x8a7030, distant:0x5a4a20, flowers:[0xf4cc44,0xf4a468,0xf4e488,0xd4884a] },
  snow:   { name:'SNOW',     ground:0xe8f0f8, dirtPath:0xa8b0b8, river:0x6a8ab0, bridge:0x5a5050, trunk:0x4a3828, foliage:[0x4a7848,0x3a6a3a,0x5a8a50], rock:0xb8b8c0, bush:0xb8c0c8, distant:0x4a6858, flowers:[0xffffff,0xe8d4f4,0xf4e4e8,0xd4d4e8] },
  urban:  { name:'URBAN',    ground:0x7a7a78, dirtPath:0x505048, river:0x2a4a6a, bridge:0x484848, trunk:0x3a3a3a, foliage:[0x4a6030,0x5a7038,0x687838], rock:0x686868, bush:0x4a5a30, distant:0x484850, flowers:[0xf48888,0xf4c474,0x88c4f4,0xe888f4] },
};

// ── State ───────────────────────────────────────────────────────────────
const STATE = {
  running:false, paused:false, matchId:0, matchEnded:false,
  energy:5, maxEnergy:10, energyRate:1/2.4,
  enemyEnergy:5, enemyHand:[], enemyHandPool:[], enemyCooldowns:{},
  hand:[], cardCooldowns:{},
  units:[], projectiles:[], fx:[], towers:[], forestTrees:[], craters:[], obstacles:[], mines:[],
  timer:180, selectedCard:null, lastTime:0, currentMission:null, toastTimer:0,
  progress:null, armoryTab:'units', pendingMission:null,
  shake:{t:0, mag:0},
  // Camera
  cam:{ targetX:0, targetY:0, targetZ:2, distance:36, yaw:0, pitch:1.0, roll:0, fov:42, orbiting:false, preset:0, panning:false, pinching:false },
  mode:'1v1', difficulty:'normal', teams:null, passives:{},
  stats:{ kills:0, allyDeaths:0, deployed:0, dmgDealt:0, dmgTaken:0 },
  bloodIntensity:0,
};
function loadProgress(){
  const def = { completed:[], unlockedPowers:[], playerFaction:'rebels', decks:{}, towerTop:'gun', towerBottom:'gun',
    mapTheme:'grass', cheatMode:false, difficulty:'normal', mode:'1v1', gore:'medium', quality:'medium', timeOfDay:'day' };
  try {
    const s = JSON.parse(localStorage.getItem('tinSoldiersV9'));
    if(!s) return def;
    const m = {...def, ...s, decks:{...def.decks, ...(s.decks||{})}};
    const all = new Set(m.unlockedPowers||[]);
    for(const fk of Object.keys(FACTION_POWERS)) for(const p of FACTION_POWERS[fk]) all.add(p);
    m.unlockedPowers = Array.from(all);
    return m;
  } catch { return def; }
}
function saveProgress(){ try { localStorage.setItem('tinSoldiersV9', JSON.stringify(STATE.progress)); } catch(e){} }
function getTheme(){ return MAP_THEMES[(STATE.progress&&STATE.progress.mapTheme)||'grass']||MAP_THEMES.grass; }
function getQuality(){ return QUALITY_LEVELS[(STATE.progress&&STATE.progress.quality)||'medium']||QUALITY_LEVELS.medium; }
function getGore(){ return GORE_LEVELS[(STATE.progress&&STATE.progress.gore)||'medium']||GORE_LEVELS.medium; }
function getTOD(){ return TIME_OF_DAY[(STATE.progress&&STATE.progress.timeOfDay)||'day']||TIME_OF_DAY.day; }

const DECK_UNITS_MAX=8, DECK_UNITS_MIN=5, DECK_POWERS_MAX=2, DECK_POWERS_MIN=1;
function validPowersForFaction(fk){ const u=STATE.progress.unlockedPowers||[], fl=FACTION_POWERS[fk]||[]; return u.filter(k=>fl.includes(k)); }
function normalizeDeck(){
  const fk = STATE.progress.playerFaction;
  const fU = Object.keys(ROLE_STATS).map(r=>fk+'_'+r);
  const fP = validPowersForFaction(fk);
  const valid = [...fU, ...fP];
  let deck = (STATE.progress.decks[fk]||[]).filter(c=>valid.includes(c));
  let units = deck.filter(c=>fU.includes(c));
  let powers = deck.filter(c=>fP.includes(c));
  const defU = ['rifleman','heavygunner','tank','medic','sniper','lightV','gunship','aa'].map(r=>fk+'_'+r);
  for(const u of defU){ if(units.length>=DECK_UNITS_MAX) break; if(!units.includes(u)) units.push(u); }
  while(units.length<DECK_UNITS_MIN){ const p=fU.find(u=>!units.includes(u))||fU[0]; units.push(p); }
  if(units.length>DECK_UNITS_MAX) units = units.slice(0, DECK_UNITS_MAX);
  const defP = ['airstrike','heal'];
  for(const p of defP){ if(powers.length>=DECK_POWERS_MAX) break; if(fP.includes(p)&&!powers.includes(p)) powers.push(p); }
  if(powers.length<DECK_POWERS_MIN&&fP.length){ const fb=fP.find(p=>!powers.includes(p)); if(fb) powers.push(fb); }
  if(powers.length>DECK_POWERS_MAX) powers = powers.slice(0, DECK_POWERS_MAX);
  STATE.progress.decks[fk] = [...units, ...powers];
  saveProgress();
}


// ── AUDIO (same engine as v8) ───────────────────────────────────────────
let audioCtx = null;
// Master bus + reverb send. Reverb is a synthetic IR (decaying noise).
let _audioBus = null, _audioRev = null;
function ensureAudio(){
  if (!audioCtx) audioCtx = new (window.AudioContext||window.webkitAudioContext)();
  if (!_audioBus) {
    _audioBus = audioCtx.createGain();
    _audioBus.gain.value = 0.85;
    _audioBus.connect(audioCtx.destination);
    // Reverb send
    try {
      const conv = audioCtx.createConvolver();
      const sr = audioCtx.sampleRate, dur = 1.4;
      const buf = audioCtx.createBuffer(2, sr * dur, sr);
      for (let ch = 0; ch < 2; ch++) {
        const d = buf.getChannelData(ch);
        for (let i = 0; i < d.length; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / d.length, 2.5);
      }
      conv.buffer = buf;
      const wet = audioCtx.createGain(); wet.gain.value = 0.15;
      conv.connect(wet); wet.connect(_audioBus);
      _audioRev = audioCtx.createGain(); _audioRev.gain.value = 1.0;
      _audioRev.connect(conv);
    } catch(e) { _audioRev = _audioBus; }
  }
  return audioCtx;
}
function _outNode(sendRev){
  ensureAudio();
  if (sendRev && _audioRev) {
    const splitter = audioCtx.createGain();
    splitter.connect(_audioBus);
    splitter.connect(_audioRev);
    return splitter;
  }
  return _audioBus;
}
function noiseBuf(d,a){ const sr=a.sampleRate, l=Math.floor(sr*d), b=a.createBuffer(1,l,sr), c=b.getChannelData(0); for(let i=0;i<l;i++) c[i]=Math.random()*2-1; return b; }
function tone(f1,f2,d,t,v,opts){
  opts = opts||{};
  try {
    const a=ensureAudio(),n=a.currentTime,o=a.createOscillator(),g=a.createGain();
    o.type=t||'square';
    o.frequency.setValueAtTime(f1,n);
    o.frequency.exponentialRampToValueAtTime(Math.max(40,f2),n+d);
    // Punchier envelope: 2ms attack, exponential decay
    g.gain.setValueAtTime(0,n);
    g.gain.linearRampToValueAtTime(v, n + (opts.atk || 0.002));
    g.gain.exponentialRampToValueAtTime(.0001, n + d);
    o.connect(g); g.connect(_outNode(opts.rev));
    o.start(n); o.stop(n+d+.02);
  } catch(e){}
}
function noise(d,f,q,v,a,opts){
  opts = opts||{};
  try {
    const ac=ensureAudio(),s=ac.createBufferSource();
    s.buffer=noiseBuf(d,ac);
    const fi=ac.createBiquadFilter();
    fi.type=opts.filterType||'bandpass';
    fi.frequency.value=f; fi.Q.value=q||1;
    const g=ac.createGain(),n=ac.currentTime;
    g.gain.setValueAtTime(0,n);
    g.gain.linearRampToValueAtTime(v,n+(a||.005));
    g.gain.exponentialRampToValueAtTime(.0001,n+d);
    s.connect(fi); fi.connect(g); g.connect(_outNode(opts.rev));
    s.start(n); s.stop(n+d);
  } catch(e){}
}
function sub(d,f,v,opts){
  opts = opts||{};
  try {
    const a=ensureAudio(),n=a.currentTime,o=a.createOscillator(),g=a.createGain();
    o.type='sine';
    o.frequency.setValueAtTime(f,n);
    o.frequency.exponentialRampToValueAtTime(Math.max(20,f*.3),n+d);
    g.gain.setValueAtTime(0,n);
    g.gain.linearRampToValueAtTime(v, n + 0.002);
    g.gain.exponentialRampToValueAtTime(.0001,n+d);
    o.connect(g); g.connect(_outNode(opts.rev));
    o.start(n); o.stop(n+d+.02);
  } catch(e){}
}
// Pitched click — sharp transient for shot/impact "snap"
function click(freq, vol){
  try {
    const a=ensureAudio(),n=a.currentTime,o=a.createOscillator(),g=a.createGain();
    o.type='triangle';
    o.frequency.setValueAtTime(freq*4,n);
    o.frequency.exponentialRampToValueAtTime(freq,n+0.012);
    g.gain.setValueAtTime(vol,n);
    g.gain.exponentialRampToValueAtTime(.0001, n + 0.022);
    o.connect(g); g.connect(_audioBus);
    o.start(n); o.stop(n+0.04);
  } catch(e){}
}
function playSound(k){ try{ const a=ensureAudio(); if(a.state==='suspended') a.resume();
  // ── SHOTS — 4-layer: transient click, body crack, hi noise tail, sub thump
  if (k === 'shot') {
    click(2400, 0.04);                                   // transient snap
    tone(1500, 280, 0.045, 'square', 0.04);              // body crack
    noise(0.06, 4500, 5, 0.05, 0.001);                   // hi tail
    sub(0.10, 110, 0.06);                                // bass thump
  }
  else if (k === 'burst2') { for (let i=0;i<2;i++) setTimeout(()=>playSound('shot'), i*55); }
  else if (k === 'burst3') { for (let i=0;i<3;i++) setTimeout(()=>playSound('shot'), i*50); }
  // ── SNIPER — beefy crack with long reverb tail
  else if (k === 'snipe') {
    click(3200, 0.10);
    tone(2400, 320, 0.18, 'square', 0.10);
    tone(1100, 200, 0.22, 'sawtooth', 0.05);
    noise(0.55, 1300, 1.5, 0.10, 0.001, { rev:true });   // huge echoey tail
    sub(0.35, 150, 0.12);
  }
  // ── MINIGUN — rapid layered with subtle pitch variation
  else if (k === 'minigun') {
    for (let i = 0; i < 7; i++) setTimeout(() => {
      click(1400 + Math.random()*200, 0.025);
      tone(880 + Math.random()*300, 480, 0.024, 'square', 0.034);
      noise(0.035, 3500, 4, 0.030);
    }, i*28);
  }
  // ── HELI CHAINGUN
  else if (k === 'chain') {
    for (let i = 0; i < 5; i++) setTimeout(() => {
      click(1700 + Math.random()*200, 0.025);
      tone(1200 + Math.random()*200, 800, 0.022, 'square', 0.030);
      noise(0.035, 2900, 3.5, 0.026);
    }, i*22);
  }
  // ── TANK CANNON — massive 5-layer
  else if (k === 'cannon') {
    sub(0.85, 70, 0.28);                                 // huge sub
    tone(70, 28, 0.7, 'sawtooth', 0.20);                 // body
    noise(0.6, 160, 1.2, 0.20, 0.001, { rev:true });     // wet noise tail
    click(380, 0.18);                                    // transient
    setTimeout(() => { noise(0.4, 110, 0.9, 0.10); sub(0.4, 50, 0.12); }, 50);
  }
  else if (k === 'rocket') {
    tone(240, 75, 0.40, 'sawtooth', 0.11);
    noise(0.55, 700, 1.8, 0.11, 0.005, { rev:true });
    sub(0.45, 90, 0.10);
  }
  else if (k === 'mortar') {
    tone(220, 55, 0.30, 'triangle', 0.11);
    noise(0.22, 250, 2.5, 0.08, 0.003);
    sub(0.20, 80, 0.06);
  }
  else if (k === 'flak') {
    click(1400, 0.06);
    tone(750, 200, 0.16, 'sawtooth', 0.09);
    noise(0.20, 900, 1.5, 0.07);
  }
  else if (k === 'flame') {
    noise(0.38, 380, 0.6, 0.13, 0.020);
    noise(0.32, 1100, 1.0, 0.08, 0.020);
    tone(105, 70, 0.32, 'sawtooth', 0.06);
  }
  else if (k === 'grenade') {
    click(900, 0.05);
    tone(440, 200, 0.18, 'triangle', 0.06);
    noise(0.14, 600, 1.8, 0.04);
  }
  // ── EXPLOSIONS — multilayer with delayed body
  else if (k === 'boom') {
    click(800, 0.18);
    sub(0.5, 90, 0.26);
    tone(105, 30, 0.6, 'sawtooth', 0.14);
    noise(0.7, 320, 1.2, 0.20, 0.001, { rev:true });
    setTimeout(() => { noise(0.3, 170, 0.8, 0.10); sub(0.3, 60, 0.10); }, 60);
  }
  else if (k === 'boom_big') {
    click(600, 0.30);
    sub(1.1, 50, 0.40);                                  // earth-shaking sub
    tone(50, 16, 1.1, 'sawtooth', 0.24);
    noise(1.3, 170, 0.7, 0.28, 0.001, { rev:true });
    setTimeout(() => { sub(0.6, 65, 0.16); noise(0.6, 110, 0.7, 0.16, 0.001, { rev:true }); }, 80);
    setTimeout(() => noise(0.7, 200, 1.0, 0.11), 200);
    setTimeout(() => noise(0.5, 350, 1.5, 0.08, 0.001, { rev:true }), 400);  // distant echo
  }
  else if (k === 'deploy') {
    tone(320, 520, 0.10, 'sine', 0.05);
    tone(520, 720, 0.08, 'triangle', 0.04);
    setTimeout(() => { tone(720, 920, 0.06, 'sine', 0.035); click(1400, 0.04); }, 50);
  }
  else if (k === 'ui_click') { click(1100, 0.04); tone(900, 700, 0.04, 'square', 0.025); }
  else if (k === 'ui_select') {
    tone(620, 900, 0.06, 'triangle', 0.04);
    setTimeout(() => { tone(900, 1240, 0.06, 'triangle', 0.035); click(1500, 0.05); }, 30);
  }
  else if (k === 'win') {
    const ns = [440, 554, 659, 880, 1108];
    ns.forEach((f, i) => setTimeout(() => {
      tone(f, f, 0.28, 'triangle', 0.07);
      tone(f*2, f*2, 0.28, 'sine', 0.04, { rev:true });
      tone(f*0.5, f*0.5, 0.28, 'sine', 0.025);
    }, i*110));
  }
  else if (k === 'lose') {
    const ns = [440, 370, 277, 220, 165];
    ns.forEach((f, i) => setTimeout(() => {
      tone(f, f, 0.36, 'sawtooth', 0.08);
      tone(f*0.5, f*0.5, 0.36, 'triangle', 0.05, { rev:true });
    }, i*180));
  }
  else if (k === 'siren') {
    const ac = ensureAudio(), n = ac.currentTime, o = ac.createOscillator(), g = ac.createGain();
    o.type = 'sine';
    o.frequency.setValueAtTime(500, n);
    o.frequency.linearRampToValueAtTime(900, n+0.25);
    o.frequency.linearRampToValueAtTime(500, n+0.50);
    o.frequency.linearRampToValueAtTime(900, n+0.75);
    o.frequency.linearRampToValueAtTime(500, n+1.00);
    g.gain.setValueAtTime(0.07, n);
    g.gain.exponentialRampToValueAtTime(0.001, n+1.05);
    o.connect(g); g.connect(_outNode(true));
    o.start(n); o.stop(n+1.1);
  }
  else if (k === 'heal') {
    tone(700, 1100, 0.20, 'sine', 0.045, { rev:true });
    setTimeout(() => tone(1100, 1600, 0.16, 'sine', 0.035, { rev:true }), 60);
    setTimeout(() => click(1800, 0.04), 100);
  }
  else if (k === 'emp') {
    tone(2400, 70, 0.75, 'square', 0.10, { rev:true });
    tone(1900, 55, 0.55, 'sawtooth', 0.06);
    noise(0.75, 1800, 4, 0.05, 0.005, { rev:true });
    sub(0.45, 60, 0.12);
  }
  else if (k === 'lane_lost') {
    const ns = [700, 550, 420, 320];
    ns.forEach((f, i) => setTimeout(() => tone(f*1.3, f, 0.20, 'sawtooth', 0.08, { rev:true }), i*90));
    sub(0.6, 55, 0.14);
  }
  else if (k === 'passive_cue') {
    tone(800, 1400, 0.16, 'triangle', 0.045, { rev:true });
    setTimeout(() => tone(1400, 1800, 0.13, 'sine', 0.035, { rev:true }), 60);
    noise(0.22, 3000, 3, 0.025);
  }
  else if (k === 'cook_off') {
    click(500, 0.10);
    tone(180, 55, 0.32, 'square', 0.10);
    noise(0.4, 480, 1.8, 0.10, 0.001, { rev:true });
    sub(0.30, 90, 0.10);
  }
  else if (k === 'crash') {
    click(400, 0.20);
    sub(0.85, 45, 0.28);
    noise(1.0, 150, 0.6, 0.22, 0.005, { rev:true });
    tone(58, 22, 0.85, 'sawtooth', 0.18);
    setTimeout(() => noise(0.5, 280, 1.4, 0.12, 0.001, { rev:true }), 100);
  }
  else if (k === 'ritual') {
    tone(440, 110, 0.7, 'sawtooth', 0.07, { rev:true });
    tone(660, 165, 0.7, 'triangle', 0.05, { rev:true });
    noise(0.65, 380, 1.4, 0.04, 0.005, { rev:true });
    sub(0.3, 80, 0.06);
  }
  else if (k === 'paycheck') {
    [800, 1200, 900, 1400].forEach((f, i) => setTimeout(() => {
      click(f*1.5, 0.04);
      tone(f, f*1.3, 0.05, 'triangle', 0.04);
    }, i*40));
  }
  else if (k === 'gore') {
    noise(0.10, 400, 2.5, 0.10, 0.002);
    tone(180, 75, 0.12, 'sawtooth', 0.06);
    noise(0.18, 900, 1.2, 0.05);
  }
  else if (k === 'gore_big') {
    click(220, 0.18);
    noise(0.16, 280, 1.8, 0.16, 0.002);
    tone(135, 55, 0.24, 'sawtooth', 0.09);
    noise(0.32, 700, 1.0, 0.10, 0.001, { rev:true });
    sub(0.22, 80, 0.08);
  }
  else if (k === 'tree_fall') {
    noise(0.8, 180, 0.8, 0.10, 0.020);
    tone(75, 35, 0.45, 'sawtooth', 0.07);
    setTimeout(() => { sub(0.3, 50, 0.08); noise(0.25, 220, 1.5, 0.06); }, 380);
  }
  // ── NEW: ability sounds
  else if (k === 'ability_ready') { tone(800, 1200, 0.10, 'triangle', 0.05); click(1600, 0.05); }
  else if (k === 'ability_fire') { click(2000, 0.10); tone(900, 1500, 0.12, 'triangle', 0.06, { rev:true }); }
}catch(e){} }


// ── THREE.JS SETUP — improved lighting, sky shader, real terrain ────────
let scene, camera, renderer, raycaster, pointer, clock;
let groundMesh, deployZoneMesh, rangePreviewMesh, skyMesh, sun, sunMesh, moonMesh;
let waterMesh, waterUniforms;
let lastPointerWorld = { x:0, z:0 };
const unitObjects = new Map();
const towerObjects = new Map();
const projObjects = new Map();
const treeObjects = new Map();
const mineObjects = new Map();
const obstacleObjects = new Map();
let fxObjects = [];
let toonGradientTex = null;
let nextId = 1;

function makeToonGradient(){
  // 6-band gradient — much richer color depth than 4 hard bands
  const c = document.createElement('canvas'); c.width=8; c.height=1;
  const x = c.getContext('2d');
  // Smooth gradient with knees at brightness boundaries — keeps cel-shaded feel but more colors
  const grad = x.createLinearGradient(0, 0, 8, 0);
  grad.addColorStop(0.00, '#28303a');     // deep shadow
  grad.addColorStop(0.25, '#5a6478');     // shadow
  grad.addColorStop(0.50, '#9aa4b4');     // mid
  grad.addColorStop(0.72, '#d8dde6');     // light
  grad.addColorStop(0.90, '#f2f5fa');     // bright
  grad.addColorStop(1.00, '#ffffff');     // hot
  x.fillStyle = grad; x.fillRect(0, 0, 8, 1);
  const t = new THREE.CanvasTexture(c);
  t.magFilter = THREE.LinearFilter; t.minFilter = THREE.LinearFilter; t.needsUpdate = true;
  return t;
}
function toonMat(color, opts){
  opts = opts||{};
  if(THREE.MeshToonMaterial && toonGradientTex){
    const m = new THREE.MeshToonMaterial({ color, gradientMap:toonGradientTex });
    if(opts.emissive){ m.emissive = new THREE.Color(opts.emissive); m.emissiveIntensity = opts.emissiveIntensity||1; }
    return m;
  }
  return new THREE.MeshStandardMaterial({ color, roughness:1, metalness:0, flatShading:true });
}
function basicMat(color, opts){
  opts = opts||{};
  return new THREE.MeshBasicMaterial({ color, transparent:!!opts.transparent, opacity:opts.opacity||1, side:opts.side||THREE.FrontSide, depthWrite:opts.depthWrite!==false });
}
function metalMat(color, opts){
  opts = opts||{};
  // Real PBR: low roughness + high metalness for actual specular highlights
  return new THREE.MeshStandardMaterial({
    color,
    roughness: opts.roughness != null ? opts.roughness : 0.35,
    metalness: opts.metalness != null ? opts.metalness : 0.78,
    flatShading: !!opts.flat,
    envMapIntensity: 1.2,
  });
}
// Painted metal (vehicle hulls) — semi-metallic with controlled roughness
function paintedMat(color, opts){
  opts = opts||{};
  return new THREE.MeshStandardMaterial({
    color,
    roughness: opts.roughness != null ? opts.roughness : 0.55,
    metalness: opts.metalness != null ? opts.metalness : 0.30,
    flatShading: !!opts.flat,
    envMapIntensity: 0.85,
  });
}
function addOutline(mesh, thickness){
  thickness = thickness||1.05;
  const om = new THREE.MeshBasicMaterial({ color:0x000000, side:THREE.BackSide });
  mesh.traverse(o=>{
    if(o.isMesh && !o.userData.isOutline && o.geometry){
      const out = new THREE.Mesh(o.geometry, om);
      out.scale.setScalar(thickness);
      out.userData.isOutline = true;
      out.renderOrder = -1;
      o.add(out);
    }
  });
}
function disposeObject3D(obj){ if(!obj) return; obj.traverse(o=>{ if(o.geometry){try{o.geometry.dispose();}catch(e){}} if(o.material){const m=Array.isArray(o.material)?o.material:[o.material]; for(const x of m){try{ if(x.map) x.map.dispose(); if(x.dispose) x.dispose(); }catch(e){}} } }); }
function removeAndDispose(mesh){ if(!mesh) return; if(mesh.parent) mesh.parent.remove(mesh); else if(scene) scene.remove(mesh); disposeObject3D(mesh); }

// ── Rounded primitives — replace blocky boxes for body parts ──
// Capsule pill = cylinder + 2 hemisphere caps. Pivots at center.
function makeCapsule(radius, length, color, opts){
  opts = opts||{};
  const g = new THREE.Group();
  const segs = opts.segs || 10;
  const mat = opts.material || toonMat(color);
  const body = new THREE.Mesh(new THREE.CylinderGeometry(radius, radius, length, segs), mat);
  g.add(body);
  const top = new THREE.Mesh(new THREE.SphereGeometry(radius, segs, 6, 0, Math.PI*2, 0, Math.PI/2), mat);
  top.position.y = length/2; g.add(top);
  const bot = new THREE.Mesh(new THREE.SphereGeometry(radius, segs, 6, 0, Math.PI*2, Math.PI/2, Math.PI/2), mat);
  bot.position.y = -length/2; g.add(bot);
  g.traverse(o => { if (o.isMesh) o.castShadow = true; });
  return g;
}
// Tapered ellipsoid — head/torso shapes that aren't cubes
function makeOvoid(w, h, d, color, opts){
  opts = opts||{};
  const mat = opts.material || toonMat(color);
  const m = new THREE.Mesh(new THREE.SphereGeometry(0.5, 14, 10), mat);
  m.scale.set(w, h, d);
  m.castShadow = true;
  return m;
}

function initThree(){
  const container = document.getElementById('threeContainer');
  const theme = getTheme();
  const tod = getTOD();
  const Q = getQuality();
  scene = new THREE.Scene();
  scene.background = new THREE.Color(tod.fogHex);
  scene.fog = new THREE.Fog(tod.fogHex, tod.fogNear, tod.fogFar);
  camera = new THREE.PerspectiveCamera(STATE.cam.fov, 1, 0.3, 400);
  renderer = new THREE.WebGLRenderer({ antialias:Q.postFX, powerPreference:'high-performance', precision:'mediump', failIfMajorPerformanceCaveat:false });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio||1, Q.pixelRatio));
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.outputEncoding = THREE.sRGBEncoding;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  // Higher exposure so colors pop instead of looking washed out
  renderer.toneMappingExposure = tod.name==='NIGHT' ? 0.95 : 1.45;
  renderer.physicallyCorrectLights = true;
  container.innerHTML = '';
  container.appendChild(renderer.domElement);
  toonGradientTex = makeToonGradient();
  clock = new THREE.Clock();

  // ── LIGHTS — 4-point setup for cinematic look ──
  // Hemisphere — strong sky/ground tint
  scene.add(new THREE.HemisphereLight(tod.skyTop, theme.ground, tod.ambInt * 2.0));
  // Key (sun) — main directional, casts shadow
  sun = new THREE.DirectionalLight(tod.sunHex, tod.sunInt * 1.4);
  sun.position.set(28, tod.sunY, 18);
  sun.castShadow = true;
  sun.shadow.mapSize.width = Q.shadowMap; sun.shadow.mapSize.height = Q.shadowMap;
  sun.shadow.camera.left = -55; sun.shadow.camera.right = 55;
  sun.shadow.camera.top = 35; sun.shadow.camera.bottom = -35;
  sun.shadow.camera.near = 5; sun.shadow.camera.far = 130;
  sun.shadow.bias = -0.0004;
  sun.shadow.normalBias = 0.02;
  scene.add(sun);
  // Cool fill from opposite — boosts shadow detail without flattening
  const fill = new THREE.DirectionalLight(tod.name==='NIGHT'?0x6090e0:0x88b8ff, tod.name==='NIGHT'?0.35:0.85);
  fill.position.set(-22, 28, -20); scene.add(fill);
  // Warm rim from behind — character edge highlight
  const rim = new THREE.DirectionalLight(tod.name==='NIGHT'?0x4050c0:0xffd080, tod.name==='NIGHT'?0.30:0.85);
  rim.position.set(-8, 14, -34); scene.add(rim);
  // Bottom bounce — fakes ground-bounced light, prevents underbellies going black
  const bounce = new THREE.DirectionalLight(tod.name==='NIGHT'?0x102040:0x90b070, tod.name==='NIGHT'?0.10:0.35);
  bounce.position.set(0, -10, 0); scene.add(bounce);
  // Ambient — weak global so nothing's pure black
  scene.add(new THREE.AmbientLight(tod.ambHex, tod.ambInt * 0.7));

  raycaster = new THREE.Raycaster();
  pointer = new THREE.Vector2();
  buildSky(tod);
  buildField(theme);
  buildWater(theme, tod);
  resizeThree();
}

function buildSky(tod){
  // Big sky dome with gradient + sun disc
  const skyGeo = new THREE.SphereGeometry(220, 32, 24);
  const skyMat = new THREE.ShaderMaterial({
    side: THREE.BackSide, depthWrite: false,
    uniforms: {
      topC: { value: new THREE.Color(tod.skyTop) },
      botC: { value: new THREE.Color(tod.skyBot) },
      offset: { value: 33 },
      exponent: { value: 0.6 },
    },
    vertexShader: 'varying vec3 vWorld; void main(){ vWorld = position; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
    fragmentShader: `
      varying vec3 vWorld;
      uniform vec3 topC, botC;
      uniform float offset, exponent;
      void main(){
        float h = normalize(vWorld + vec3(0., offset, 0.)).y;
        gl_FragColor = vec4(mix(botC, topC, max(pow(max(h, 0.0), exponent), 0.0)), 1.0);
      }`,
  });
  skyMesh = new THREE.Mesh(skyGeo, skyMat);
  scene.add(skyMesh);
  // Sun disc (additive sphere)
  if (tod.name !== 'NIGHT') {
    sunMesh = new THREE.Mesh(
      new THREE.SphereGeometry(8, 16, 12),
      new THREE.MeshBasicMaterial({ color: tod.sunHex, transparent: true, opacity: 0.85, depthWrite: false })
    );
    sunMesh.position.set(60, tod.sunY * 1.5, 40);
    scene.add(sunMesh);
    // Glow halo
    const halo = new THREE.Mesh(
      new THREE.SphereGeometry(15, 16, 12),
      new THREE.MeshBasicMaterial({ color: tod.sunHex, transparent: true, opacity: 0.25, depthWrite: false })
    );
    sunMesh.add(halo);
  } else {
    moonMesh = new THREE.Mesh(
      new THREE.SphereGeometry(6, 16, 12),
      new THREE.MeshBasicMaterial({ color: 0xe8e8ff, transparent: true, opacity: 0.95, depthWrite: false })
    );
    moonMesh.position.set(60, 80, 40);
    scene.add(moonMesh);
    // Stars: little points
    const starGeo = new THREE.BufferGeometry();
    const verts = [];
    for (let i = 0; i < 320; i++) {
      const r = 200, t = Math.random() * Math.PI * 2, p = Math.acos(2 * Math.random() - 1);
      verts.push(r * Math.sin(p) * Math.cos(t), Math.abs(r * Math.cos(p)) + 30, r * Math.sin(p) * Math.sin(t));
    }
    starGeo.setAttribute('position', new THREE.Float32BufferAttribute(verts, 3));
    const stars = new THREE.Points(starGeo, new THREE.PointsMaterial({ color: 0xffffff, size: 0.6, transparent: true, opacity: 0.85 }));
    scene.add(stars);
  }
}

function buildField(theme){
  // ── TERRAIN — heightmap-based, soft hills, grass color blend
  const segW = 96, segD = 60;
  const groundGeo = new THREE.PlaneGeometry(FIELD_W + 60, FIELD_D + 50, segW, segD);
  const pos = groundGeo.attributes.position;
  // Procedural heights — perlin-ish via combined sines
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i), y = pos.getY(i);
    let h = 0;
    h += Math.sin(x * 0.08) * Math.cos(y * 0.10) * 0.45;
    h += Math.sin(x * 0.21 + 1.4) * Math.cos(y * 0.18 + 0.7) * 0.18;
    h += Math.sin(x * 0.42) * Math.cos(y * 0.37) * 0.06;
    // Flatten near river and lanes
    const distFromRiver = Math.abs(x);
    if (distFromRiver < RIVER_HALF + 0.5) h = 0;
    const laneDist = Math.min(Math.abs(y - LANE_TOP_Z), Math.abs(y - LANE_MID_Z), Math.abs(y - LANE_BOT_Z));
    if (laneDist < 1.6) h *= 0.15;
    pos.setZ(i, h);
  }
  groundGeo.computeVertexNormals();
  // Vertex colors for grass variation
  const colors = new Float32Array(pos.count * 3);
  const baseCol = new THREE.Color(theme.ground);
  const dirtCol = new THREE.Color(theme.dirtPath);
  for (let i = 0; i < pos.count; i++) {
    const y = pos.getY(i), z = pos.getZ(i);
    const laneDist = Math.min(Math.abs(y - LANE_TOP_Z), Math.abs(y - LANE_MID_Z), Math.abs(y - LANE_BOT_Z));
    const dirt = laneDist < 1.8 ? 1 - laneDist / 1.8 : 0;
    const tint = baseCol.clone().lerp(dirtCol, dirt * 0.65);
    // Add height-based slight variation
    const v = (Math.sin(pos.getX(i) * 0.55) + Math.sin(y * 0.7)) * 0.05;
    tint.r = Math.max(0, Math.min(1, tint.r + v));
    tint.g = Math.max(0, Math.min(1, tint.g + v));
    tint.b = Math.max(0, Math.min(1, tint.b + v));
    colors[i*3] = tint.r; colors[i*3+1] = tint.g; colors[i*3+2] = tint.b;
  }
  groundGeo.setAttribute('color', new THREE.BufferAttribute(colors, 3));
  groundMesh = new THREE.Mesh(groundGeo, new THREE.MeshStandardMaterial({ vertexColors:true, roughness:1, metalness:0, flatShading:false }));
  groundMesh.rotation.x = -Math.PI/2;
  groundMesh.receiveShadow = true;
  scene.add(groundMesh);

  // Lane paths overlay
  for (const lz of [LANE_TOP_Z, LANE_MID_Z, LANE_BOT_Z]) {
    const path = new THREE.Mesh(
      new THREE.PlaneGeometry(FIELD_W - 14, 3.4),
      new THREE.MeshBasicMaterial({ color:theme.dirtPath, transparent:true, opacity:0.45, depthWrite:false })
    );
    path.rotation.x = -Math.PI/2; path.position.set(0, 0.04, lz);
    scene.add(path);
  }
  // Side tints
  for (const [side, col] of [[-1, 0x3070b0], [1, 0xb04030]]) {
    const tint = new THREE.Mesh(
      new THREE.PlaneGeometry(FIELD_W/2 - RIVER_HALF, FIELD_D),
      new THREE.MeshBasicMaterial({ color:col, transparent:true, opacity:0.06, depthWrite:false })
    );
    tint.rotation.x = -Math.PI/2;
    tint.position.set(side * (FIELD_W/4 + RIVER_HALF/2), 0.03, 0);
    scene.add(tint);
  }
  // Deploy zone marker
  deployZoneMesh = new THREE.Mesh(
    new THREE.PlaneGeometry(FIELD_W/2 - RIVER_HALF - 4, FIELD_D - 2),
    new THREE.MeshBasicMaterial({ color:0x4080d0, transparent:true, opacity:0, side:THREE.DoubleSide, depthWrite:false })
  );
  deployZoneMesh.rotation.x = -Math.PI/2;
  deployZoneMesh.position.set(-FIELD_W/4 - 2, 0.06, 0);
  scene.add(deployZoneMesh);
  // Range preview ring
  rangePreviewMesh = new THREE.Mesh(
    new THREE.RingGeometry(0.99, 1.0, 48),
    new THREE.MeshBasicMaterial({ color:0x80c0ff, transparent:true, opacity:0, side:THREE.DoubleSide, depthWrite:false })
  );
  rangePreviewMesh.rotation.x = -Math.PI/2;
  rangePreviewMesh.position.y = 0.07;
  scene.add(rangePreviewMesh);
  // Bridges
  for (const b of BRIDGES) {
    const bg = new THREE.Group();
    const deck = new THREE.Mesh(new THREE.BoxGeometry(RIVER_HALF * 2.8, 0.18, b.halfLength * 2), toonMat(theme.bridge));
    deck.position.y = 0.1; deck.castShadow = true; deck.receiveShadow = true; bg.add(deck);
    for (let zs of [-b.halfLength, b.halfLength]) {
      const rail = new THREE.Mesh(new THREE.BoxGeometry(RIVER_HALF * 2.8, 0.32, 0.08), toonMat(0x4a3020));
      rail.position.set(0, 0.34, zs); bg.add(rail);
    }
    // Posts
    for (let zs of [-b.halfLength + 0.4, b.halfLength - 0.4]) {
      for (let xs of [-RIVER_HALF * 1.3, RIVER_HALF * 1.3]) {
        const post = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.5, 0.14), toonMat(0x3a2010));
        post.position.set(xs, 0.35, zs); bg.add(post);
      }
    }
    addOutline(bg, 1.025);
    bg.position.set(0, 0, b.z);
    scene.add(bg);
  }
  rebuildTrees(theme);
  // Bushes / flowers / rocks
  for (let i = 0; i < 14; i++) {
    const laneZ = [LANE_TOP_Z, LANE_MID_Z, LANE_BOT_Z][i % 3];
    const x = (Math.random() - 0.5) * (FIELD_W - 14);
    if (Math.abs(x) < RIVER_HALF + 1) continue;
    const z = laneZ + (Math.random() - 0.5) * 2.4;
    const bush = new THREE.Mesh(new THREE.SphereGeometry(0.24 + Math.random() * 0.14, 7, 6), toonMat(theme.bush));
    bush.position.set(x, 0.2, z); bush.castShadow = true; scene.add(bush);
  }
  for (let i = 0; i < 60; i++) {
    const x = (Math.random() - 0.5) * (FIELD_W - 14);
    const z = (Math.random() - 0.5) * (FIELD_D - 2);
    if (Math.abs(x) < RIVER_HALF + 1) continue;
    const c = theme.flowers[Math.floor(Math.random() * theme.flowers.length)];
    const fl = new THREE.Mesh(new THREE.SphereGeometry(0.07, 5, 4), new THREE.MeshBasicMaterial({ color:c }));
    fl.position.set(x, 0.1, z); scene.add(fl);
  }
  for (let i = 0; i < 14; i++) {
    const x = (Math.random() - 0.5) * (FIELD_W - 12);
    const z = (Math.random() - 0.5) * (FIELD_D - 2);
    if (Math.abs(x) < RIVER_HALF + 1.2) continue;
    const ld = Math.min(Math.abs(z - LANE_TOP_Z), Math.abs(z - LANE_MID_Z), Math.abs(z - LANE_BOT_Z));
    if (ld < 1.8) continue;
    const r = new THREE.Mesh(new THREE.DodecahedronGeometry(0.25 + Math.random() * 0.2, 0), toonMat(theme.rock));
    r.position.set(x, 0.15, z);
    r.rotation.set(Math.random(), Math.random(), Math.random());
    r.castShadow = true; scene.add(r);
  }
  // Distant tree silhouettes outside the field
  for (let side of [-1, 1]) {
    const x = side * (FIELD_W/2 + 14);
    for (let i = 0; i < 22; i++) {
      const tz = (Math.random() - 0.5) * (FIELD_D + 22);
      const t = new THREE.Mesh(new THREE.ConeGeometry(0.9 + Math.random() * 0.5, 3.2 + Math.random() * 1.4, 5), toonMat(theme.distant));
      t.position.set(x + (Math.random() - 0.5) * 5, 1.7, tz);
      scene.add(t);
    }
  }
}

function buildWater(theme, tod){
  // Animated water shader for the river
  waterUniforms = {
    time: { value: 0 },
    deep: { value: new THREE.Color(theme.river).multiplyScalar(0.55) },
    shallow: { value: new THREE.Color(theme.river).multiplyScalar(1.25) },
    sunCol: { value: new THREE.Color(tod.sunHex) },
    sunDir: { value: new THREE.Vector3(0.6, 0.7, 0.4).normalize() },
  };
  const waterGeo = new THREE.PlaneGeometry(RIVER_HALF * 2, FIELD_D + 30, 2, 40);
  const waterMat = new THREE.ShaderMaterial({
    uniforms: waterUniforms, transparent: true,
    vertexShader: `
      varying vec3 vP; varying vec3 vN;
      uniform float time;
      void main(){
        vec3 p = position;
        // Tiny vertical wave for depth
        p.z += sin(p.y * 0.7 + time * 1.5) * 0.04 + cos(p.y * 1.6 + time * 2.1) * 0.03;
        vP = p;
        vec3 dx = vec3(1.0, 0.0, cos(p.y * 0.7 + time * 1.5) * 0.7 * 0.04);
        vec3 dy = vec3(0.0, 1.0, sin(p.y * 0.7 + time * 1.5) * 0.7 * 0.04);
        vN = normalize(cross(dy, dx));
        gl_Position = projectionMatrix * modelViewMatrix * vec4(p, 1.0);
      }`,
    fragmentShader: `
      varying vec3 vP; varying vec3 vN;
      uniform vec3 deep, shallow, sunCol, sunDir;
      uniform float time;
      void main(){
        // Foam-like ripples
        float ripple = sin(vP.y * 4.0 - time * 3.0) * 0.5 + 0.5;
        ripple *= sin(vP.y * 1.7 + time * 1.2) * 0.5 + 0.5;
        vec3 col = mix(deep, shallow, ripple * 0.7 + 0.15);
        // Specular highlight
        float spec = pow(max(dot(vN, sunDir), 0.0), 8.0);
        col += sunCol * spec * 0.4;
        gl_FragColor = vec4(col, 0.92);
      }`,
  });
  waterMesh = new THREE.Mesh(waterGeo, waterMat);
  waterMesh.rotation.x = -Math.PI / 2;
  waterMesh.position.y = 0.05;
  scene.add(waterMesh);
}

function rebuildTrees(theme){
  STATE.forestTrees = [];
  treeObjects.forEach(m => removeAndDispose(m)); treeObjects.clear();
  const Q = getQuality();
  const walls = [
    { zMin:-FIELD_D/2 + 1, zMax:LANE_TOP_Z - 2 },
    { zMin:LANE_TOP_Z + 2, zMax:LANE_MID_Z - 2 },
    { zMin:LANE_MID_Z + 2, zMax:LANE_BOT_Z - 2 },
    { zMin:LANE_BOT_Z + 2, zMax:FIELD_D/2 - 1 },
  ];
  for (const wall of walls) {
    for (let x = -FIELD_W/2 + 5; x <= FIELD_W/2 - 5; x += 1.7) {
      if (Math.abs(x) < RIVER_HALF + 1.8) continue;
      for (let zRow = wall.zMin; zRow <= wall.zMax; zRow += 1.8) {
        const jx = x + (Math.random() - 0.5) * 1.0;
        const jz = zRow + (Math.random() - 0.5) * 0.9;
        if (Math.abs(jx) < RIVER_HALF + 1.3) continue;
        if (Math.random() > Q.drawTrees) continue;
        if (Math.random() < 0.28) continue;
        addTree(jx, jz, theme);
      }
    }
  }
}
function addTree(x, z, theme){
  if (!theme) theme = getTheme();
  const tree = { id:STATE.forestTrees.length + 1, x, z, hp:90, maxHp:90, dead:false };
  STATE.forestTrees.push(tree);
  const g = new THREE.Group();
  // Trunk with slight taper
  const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.13, 0.20, 1.1, 8), toonMat(theme.trunk));
  trunk.position.y = 0.55; trunk.castShadow = true; g.add(trunk);
  // Two-tone foliage: dark base + lighter top
  const fc = theme.foliage[Math.floor(Math.random() * theme.foliage.length)];
  const fcLight = new THREE.Color(fc).lerp(new THREE.Color(0xffffff), 0.15).getHex();
  const base = new THREE.Mesh(new THREE.SphereGeometry(0.85, 9, 7), toonMat(fc));
  base.position.y = 1.65; base.scale.set(1, 0.95, 1); base.castShadow = true; g.add(base);
  const mid = new THREE.Mesh(new THREE.SphereGeometry(0.65, 9, 7), toonMat(fcLight));
  mid.position.y = 2.2; mid.castShadow = true; g.add(mid);
  const top = new THREE.Mesh(new THREE.SphereGeometry(0.4, 8, 6), toonMat(fcLight));
  top.position.y = 2.7; top.castShadow = true; g.add(top);
  addOutline(g, 1.04);
  g.position.set(x, 0, z);
  const s = 0.85 + Math.random() * 0.4;
  g.scale.setScalar(s);
  tree.height = 2.8 * s; tree.radius = 0.6 * s; tree.mesh = g;
  scene.add(g); treeObjects.set(tree.id, g);
}
function damageTree(t, dmg){
  if (t.dead) return;
  t.hp -= dmg;
  if (t.hp <= 0) {
    t.dead = true;
    playSound('tree_fall');
    if (t.mesh) { t.mesh.userData.falling = 0; t.mesh.userData.fallDir = Math.random() * Math.PI * 2; }
    addFX({ type:'puff', x:t.x, y:0.5, z:t.z, t:0, dur:0.8 });
  }
}
function damageForestAt(x, z, dmg, radius){
  for (const t of STATE.forestTrees) { if (t.dead) continue; if (Math.hypot(t.x - x, t.z - z) <= radius) damageTree(t, dmg); }
}


// ── FREE-ORBIT 360 CAMERA ───────────────────────────────────────────────
// Default: orbit mode is ON. Drag = orbit (yaw + pitch). WASD = pan target.
// Scroll = zoom. Q/E = adjust height. Pinch = zoom (mobile). Two-finger twist = roll.
const CAM_PRESETS = [
  { name:'OVERHEAD', distance:36, pitch:1.30, yaw:0,         height:0 },
  { name:'TACTICAL', distance:32, pitch:0.95, yaw:0,         height:2 },
  { name:'CINEMATIC',distance:24, pitch:0.55, yaw:Math.PI/8, height:4 },
  { name:'GROUND',   distance:14, pitch:0.18, yaw:0,         height:1.2 },
  { name:'TOP-DOWN', distance:42, pitch:1.50, yaw:0,         height:0 },
];
function applyCamera() {
  if (!camera) return;
  const c = STATE.cam;
  // Spherical to cartesian, around target
  const r = c.distance;
  const sinP = Math.sin(c.pitch), cosP = Math.cos(c.pitch);
  const sinY = Math.sin(c.yaw),  cosY = Math.cos(c.yaw);
  const ex = c.targetX + r * cosP * sinY;
  const ey = (c.targetY||0) + r * sinP + (c._heightOffset||0);
  const ez = c.targetZ + r * cosP * cosY;
  camera.position.set(ex, Math.max(0.3, ey), ez);
  camera.fov = c.fov;
  // Look at target slightly elevated when high
  const lookY = (c._heightOffset||0) * 0.18;
  camera.lookAt(c.targetX, lookY, c.targetZ);
  if (c.roll) camera.rotateZ(c.roll);
  camera.updateProjectionMatrix();
}
function clampCamera() {
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
function resizeThree() {
  const cont = document.getElementById('threeContainer');
  if (!cont || !renderer || !camera) return;
  const w = cont.clientWidth, h = cont.clientHeight;
  if (!w || !h) return;
  renderer.setSize(w, h, false);
  camera.aspect = w / h;
  applyCamera();
  STATE._lastSize = { w, h };
}
function ensureCanvasSize() {
  const cont = document.getElementById('threeContainer');
  if (!cont || !renderer) return;
  const w = cont.clientWidth, h = cont.clientHeight;
  if (!w || !h) return;
  if (!STATE._lastSize || STATE._lastSize.w !== w || STATE._lastSize.h !== h) resizeThree();
}
function applyPreset(idx){
  const p = CAM_PRESETS[idx % CAM_PRESETS.length];
  STATE.cam.preset = idx % CAM_PRESETS.length;
  STATE.cam.distance = p.distance;
  STATE.cam.pitch = p.pitch;
  STATE.cam.yaw = p.yaw;
  STATE.cam._heightOffset = p.height;
  STATE.cam.roll = 0;
  STATE.cam.targetX = 0; STATE.cam.targetZ = 2;
  clampCamera(); applyCamera();
  const lbl = document.getElementById('camLabel');
  if (lbl) lbl.textContent = p.name;
}
function cycleCamPreset(){
  applyPreset((STATE.cam.preset + 1) % CAM_PRESETS.length);
  showToast('CAMERA: ' + CAM_PRESETS[STATE.cam.preset].name);
  playSound('ui_click');
}
function resetCamera(){ applyPreset(0); playSound('ui_click'); }
function toggleOrbitMode(){
  STATE.cam.orbiting = !STATE.cam.orbiting;
  const b = document.getElementById('camOrbit');
  if (b) b.classList.toggle('on', STATE.cam.orbiting);
  showToast(STATE.cam.orbiting ? 'FREE ORBIT — DRAG TO ROTATE' : 'PAN MODE — DRAG TO MOVE');
  playSound('ui_select');
}
function adjustCamHeight(d){
  STATE.cam._heightOffset = (STATE.cam._heightOffset||0) + d;
  clampCamera(); applyCamera(); playSound('ui_click');
}
function adjustCamZoom(f){
  STATE.cam.distance *= f;
  clampCamera(); applyCamera(); playSound('ui_click');
}
window.addEventListener('resize', () => { if (renderer) resizeThree(); });

// ── INPUT HANDLERS — pointer + keyboard ────────────────────────────────
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
      const ch = document.getElementById('camHint'); if (ch) ch.style.display = 'none';
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
        // Pan target in world XZ, rotated by yaw
        const cont = document.getElementById('threeContainer');
        const worldPerPx = (STATE.cam.distance / 36) * 0.04 * (cont.clientWidth / 600);
        const dxW = -dx * worldPerPx;
        const dzW = -dy * worldPerPx;
        const cy = Math.cos(STATE.cam.yaw), sy = Math.sin(STATE.cam.yaw);
        STATE.cam.targetX = panStart.targetX + dxW * cy - dzW * sy;
        STATE.cam.targetZ = panStart.targetZ + dxW * sy + dzW * cy;
      }
      clampCamera(); applyCamera();
      const ch = document.getElementById('camHint'); if (ch) ch.style.display = 'none';
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
        // Card mode → deploy
        const hit = screenToWorld(e.clientX, e.clientY);
        if (hit) attemptDeploy(STATE.selectedCard, hit.x, hit.z);
      } else {
        // No card → try to select a deployed unit for ability
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
  // Keyboard — track held keys for smooth camera movement
  window.addEventListener('keydown', e => {
    keys[e.key.toLowerCase()] = true;
    if (e.key === 'o' || e.key === 'O') toggleOrbitMode();
    else if (e.key === 'r' || e.key === 'R') resetCamera();
    else if (e.key === 'c' || e.key === 'C') cycleCamPreset();
    else if (e.key === 'Escape' && STATE.running) STATE.paused ? resumeGame() : pauseGame();
  });
  window.addEventListener('keyup', e => { delete keys[e.key.toLowerCase()]; });
}
// Smooth keyboard camera movement; called each frame from loop
function updateCameraFromKeys(dt){
  if (!STATE.running || STATE.paused) return;
  let changed = false;
  const c = STATE.cam;
  const moveSpeed = 18 * (c.distance / 36) * dt;  // scale with zoom
  const rotSpeed = 1.6 * dt;
  // WASD pan target
  const cy = Math.cos(c.yaw), sy = Math.sin(c.yaw);
  if (keys['w']) { c.targetX -= sy * moveSpeed; c.targetZ -= cy * moveSpeed; changed = true; }
  if (keys['s']) { c.targetX += sy * moveSpeed; c.targetZ += cy * moveSpeed; changed = true; }
  if (keys['a']) { c.targetX -= cy * moveSpeed; c.targetZ += sy * moveSpeed; changed = true; }
  if (keys['d']) { c.targetX += cy * moveSpeed; c.targetZ -= sy * moveSpeed; changed = true; }
  // Q/E for height
  if (keys['q']) { c._heightOffset = (c._heightOffset||0) + 6 * dt; changed = true; }
  if (keys['e']) { c._heightOffset = (c._heightOffset||0) - 6 * dt; changed = true; }
  // Arrow keys orbit yaw/pitch
  if (keys['arrowleft'])  { c.yaw -= rotSpeed; changed = true; }
  if (keys['arrowright']) { c.yaw += rotSpeed; changed = true; }
  if (keys['arrowup'])    { c.pitch += rotSpeed; changed = true; }
  if (keys['arrowdown'])  { c.pitch -= rotSpeed; changed = true; }
  // +/- zoom
  if (keys['+'] || keys['=']) { c.distance *= 1 - dt * 1.2; changed = true; }
  if (keys['-'] || keys['_']) { c.distance *= 1 + dt * 1.2; changed = true; }
  if (changed) { clampCamera(); applyCamera(); }
}


// ── CHARACTER MESH BUILDERS — properly rigged for animation ─────────────
// Each infantry has named bones in userData: hips, torso, head, leftArm, rightArm,
// leftLeg, rightLeg, weapon, weaponMuzzle. Animation system reads these.
function teamColor(side){ return side === 'player' ? 0x3070d0 : 0xd04030; }
const ROLE_ACCENT = {
  swarm:0xff8844, scout:0x44ee88, rifleman:0xdddddd, sniper:0x44aaff,
  heavygunner:0xff4444, flamer:0xff6600, grenadier:0xffcc00,
  lightV:0x88ddff, apc:0x6688cc, tank:0x555555, artillery:0xcc44ee,
  aa:0x00ffcc, medic:0xff4466, gunship:0xccccff, commander:0xffdd44,
};

// Build a properly-rigged infantry figure with separate bone groups.
// Each "bone" is a Three.js Group containing the geometry pivoted from its joint.
function buildInfantryRig(def, side, opts){
  opts = opts || {};
  const root = new THREE.Group();
  const bodyCol = def.color, darkCol = def.accent, glowCol = def.glow, skinCol = def.skin;
  const teamCol = teamColor(side);

  // ── HIPS (root pivot for full body) ─────
  const hips = new THREE.Group();
  hips.position.y = 0.78;
  root.add(hips);
  // Beveled belt — flatter cylinder for hips
  const belt = new THREE.Mesh(new THREE.CylinderGeometry(0.30, 0.27, 0.13, 12), toonMat(darkCol));
  belt.scale.x = 1.05; belt.position.y = 0; hips.add(belt);

  // ── TORSO (rotates from hips) — ovoid chest, no cube edges ─────
  const torso = new THREE.Group();
  torso.position.y = 0.05;
  hips.add(torso);
  // Chest as scaled sphere — looks like a barrel torso
  const chest = makeOvoid(0.55, 0.50, 0.34, bodyCol);
  chest.position.y = 0.22; torso.add(chest);
  // Team stripe — wraps chest as a thin partial torus
  const stripeRing = new THREE.Mesh(new THREE.TorusGeometry(0.27, 0.06, 5, 14, Math.PI * 1.4),
    basicMat(teamCol));
  stripeRing.rotation.y = Math.PI;
  stripeRing.rotation.x = Math.PI/2;
  stripeRing.position.set(0, 0.22, 0); torso.add(stripeRing);
  // Backpack — rounded
  const pack = makeOvoid(0.36, 0.34, 0.18, 0x202020);
  pack.position.set(0, 0.20, -0.22); torso.add(pack);

  // ── NECK + HEAD — sphere head, no cube ─────
  const neck = new THREE.Group();
  neck.position.y = 0.48;
  torso.add(neck);
  // Spherical head, slightly squashed
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.21, 14, 10), toonMat(skinCol));
  head.scale.y = 1.05;
  head.position.y = 0.22; head.castShadow = true; neck.add(head); root.userData.headRef = head;
  // Eyes — small ellipsoid whites + tiny pupil sphere
  for (let xs of [-0.08, 0.08]) {
    const eye = new THREE.Mesh(new THREE.SphereGeometry(0.035, 8, 6), basicMat(0xffffff));
    eye.scale.set(1.3, 1, 0.5); eye.position.set(xs, 0.24, 0.18); neck.add(eye);
    const pup = new THREE.Mesh(new THREE.SphereGeometry(0.018, 6, 5), basicMat(0x080808));
    pup.position.set(xs, 0.23, 0.21); neck.add(pup);
  }
  // Helmet — rounded shapes per faction
  const helmet = new THREE.Group();
  helmet.position.y = 0.4;
  if (def.faction === 'rebels') {
    // Bowl helmet
    const dome = new THREE.Mesh(new THREE.SphereGeometry(0.24, 14, 8, 0, Math.PI*2, 0, Math.PI/2.1), toonMat(darkCol));
    dome.position.y = 0; helmet.add(dome);
    // Bandana band — torus instead of box
    const band = new THREE.Mesh(new THREE.TorusGeometry(0.22, 0.025, 5, 16), basicMat(glowCol));
    band.rotation.x = Math.PI/2; band.position.y = -0.02; helmet.add(band);
  } else if (def.faction === 'empire') {
    const dome = new THREE.Mesh(new THREE.SphereGeometry(0.23, 14, 9, 0, Math.PI*2, 0, Math.PI/2), toonMat(darkCol));
    helmet.add(dome);
    // Round brim
    const brim = new THREE.Mesh(new THREE.TorusGeometry(0.24, 0.03, 5, 18), toonMat(darkCol));
    brim.rotation.x = Math.PI/2; brim.position.y = -0.02; helmet.add(brim);
    // Crest — capsule
    const crest = makeCapsule(0.022, 0.18, glowCol);
    crest.scale.set(1, 1, 6);
    crest.position.y = 0.20; helmet.add(crest);
  } else if (def.faction === 'mercs') {
    const dome = new THREE.Mesh(new THREE.SphereGeometry(0.25, 14, 9, 0, Math.PI*2, 0, Math.PI/2.05), toonMat(0x161616));
    dome.position.y = -0.02; helmet.add(dome);
    // Curved visor — half-torus
    const visor = new THREE.Mesh(new THREE.TorusGeometry(0.18, 0.04, 5, 12, Math.PI),
      basicMat(glowCol, { transparent:true, opacity:0.9 }));
    visor.rotation.x = Math.PI/2; visor.rotation.z = Math.PI;
    visor.position.set(0, -0.04, 0.0); helmet.add(visor);
    const ant = new THREE.Mesh(new THREE.CylinderGeometry(0.012, 0.012, 0.18, 5), toonMat(0x101010));
    ant.position.set(0.18, 0.10, 0); ant.rotation.z = -0.3; helmet.add(ant);
  } else {
    // Cult hood — smoother cone with rounded base
    const hood = new THREE.Mesh(new THREE.ConeGeometry(0.27, 0.48, 12), toonMat(darkCol));
    hood.position.y = 0.10; helmet.add(hood);
    const hoodBase = new THREE.Mesh(new THREE.SphereGeometry(0.27, 12, 7, 0, Math.PI*2, 0, Math.PI/2), toonMat(darkCol));
    hoodBase.position.y = -0.10; helmet.add(hoodBase);
    for (let xs of [-0.13, 0.13]) {
      const horn = new THREE.Mesh(new THREE.ConeGeometry(0.045, 0.22, 6), toonMat(0xe8dcc8));
      horn.position.set(xs, 0.30, -0.05); horn.rotation.x = 0.4; helmet.add(horn);
    }
    // Glowing eye slit — thin curved torus arc
    const eyebar = new THREE.Mesh(new THREE.TorusGeometry(0.16, 0.022, 4, 10, Math.PI * 0.6),
      basicMat(glowCol));
    eyebar.rotation.x = Math.PI/2; eyebar.rotation.z = Math.PI/2;
    eyebar.position.set(0, -0.02, 0.20); helmet.add(eyebar);
  }
  neck.add(helmet);

  // ── ARMS — capsule biceps, sphere hands ─────
  const leftArm = new THREE.Group();   leftArm.position.set(-0.30, 0.40, 0);   torso.add(leftArm);
  const rightArm = new THREE.Group();  rightArm.position.set( 0.30, 0.40, 0);  torso.add(rightArm);
  for (const arm of [leftArm, rightArm]) {
    const bicep = makeCapsule(0.09, 0.30, bodyCol);
    bicep.position.y = -0.18; arm.add(bicep);
    const hand = new THREE.Mesh(new THREE.SphereGeometry(0.085, 10, 7), toonMat(0x2a1a12));
    hand.scale.set(1.0, 0.85, 1.0);
    hand.position.y = -0.40; arm.add(hand);
  }
  // Shoulder pauldrons — small spheres
  for (const [xs, parent] of [[-0.30, leftArm], [0.30, rightArm]]) {
    const shoulder = new THREE.Mesh(new THREE.SphereGeometry(0.115, 10, 7, 0, Math.PI*2, 0, Math.PI/1.6), toonMat(bodyCol));
    shoulder.position.set(0, 0.04, 0); shoulder.castShadow = true;
    parent.add(shoulder);
  }

  // ── LEGS — capsule thighs, rounded boot ─────
  const leftLeg = new THREE.Group();   leftLeg.position.set(-0.12, -0.05, 0);   hips.add(leftLeg);
  const rightLeg = new THREE.Group();  rightLeg.position.set( 0.12, -0.05, 0);  hips.add(rightLeg);
  for (const leg of [leftLeg, rightLeg]) {
    const thigh = makeCapsule(0.10, 0.36, darkCol);
    thigh.position.y = -0.23; leg.add(thigh);
    // Boot — half-sphere top + cylinder sole
    const boot = new THREE.Group();
    const bootTop = new THREE.Mesh(new THREE.SphereGeometry(0.11, 10, 7, 0, Math.PI*2, 0, Math.PI/2),
      toonMat(0x141008));
    bootTop.position.y = -0.0; boot.add(bootTop);
    const bootToe = new THREE.Mesh(new THREE.CylinderGeometry(0.10, 0.10, 0.12, 10), toonMat(0x141008));
    bootToe.rotation.x = Math.PI/2; bootToe.position.set(0, -0.05, 0.06); boot.add(bootToe);
    boot.position.set(0, -0.50, 0.02); leg.add(boot);
  }

  // ── WEAPON (parented to right arm hand) ─────
  const weapon = new THREE.Group();
  weapon.position.set(0.05, -0.40, 0.05); // anchor on right hand
  rightArm.add(weapon);
  buildWeapon(weapon, def, opts.weaponType || 'rifle');

  // Faction flair
  if (def.faction === 'cult') {
    for (let xs of [-0.30, 0.30]) {
      const sp = new THREE.Mesh(new THREE.ConeGeometry(0.05, 0.22, 5), toonMat(0xe8dcc8));
      sp.position.set(xs, 0.35, 0); torso.add(sp);
    }
  } else if (def.faction === 'empire') {
    const pauldron = new THREE.Mesh(new THREE.SphereGeometry(0.13, 8, 6, 0, Math.PI*2, 0, Math.PI/2), toonMat(0xf0c860));
    pauldron.position.set(-0.32, 0.40, 0); torso.add(pauldron);
  } else if (def.faction === 'mercs') {
    for (let xs of [-0.16, 0.16]) {
      const pouch = new THREE.Mesh(new THREE.BoxGeometry(0.10, 0.10, 0.08), toonMat(0x101010));
      pouch.position.set(xs, 0.0, 0.18); torso.add(pouch);
    }
  } else {
    // Rebels — bandolier strap
    const band = new THREE.Mesh(new THREE.BoxGeometry(0.55, 0.06, 0.34), toonMat(0x4a2810));
    band.position.set(0, 0.25, 0); band.rotation.z = 0.42; torso.add(band);
  }

  root.userData.bones = { hips, torso, neck, leftArm, rightArm, leftLeg, rightLeg, weapon };
  return root;
}
function buildWeapon(parent, def, type){
  const dark = 0x101010, wood = 0x3a2010;
  if (type === 'rifle') {
    const stock = new THREE.Mesh(new THREE.BoxGeometry(0.07, 0.09, 0.22), toonMat(wood));
    stock.position.z = -0.06; parent.add(stock);
    const body = new THREE.Mesh(new THREE.BoxGeometry(0.07, 0.10, 0.18), toonMat(dark));
    body.position.z = 0.10; parent.add(body);
    const barrel = new THREE.Mesh(new THREE.CylinderGeometry(0.025, 0.025, 0.36, 6), toonMat(dark));
    barrel.rotation.x = Math.PI/2; barrel.position.z = 0.34; parent.add(barrel);
    const muzzle = new THREE.Object3D(); muzzle.position.z = 0.55; parent.add(muzzle);
    parent.userData.muzzle = muzzle;
  } else if (type === 'snipe') {
    const stock = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.09, 0.28), toonMat(wood));
    stock.position.z = -0.10; parent.add(stock);
    const barrel = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.025, 0.74, 6), metalMat(dark));
    barrel.rotation.x = Math.PI/2; barrel.position.z = 0.36; parent.add(barrel);
    const scope = new THREE.Mesh(new THREE.CylinderGeometry(0.045, 0.045, 0.18, 8), metalMat(dark));
    scope.rotation.x = Math.PI/2; scope.position.set(0, 0.10, 0.14); parent.add(scope);
    const lens = new THREE.Mesh(new THREE.CircleGeometry(0.04, 10), basicMat(0x80c0ff));
    lens.position.set(0, 0.10, 0.23); parent.add(lens);
    const muzzle = new THREE.Object3D(); muzzle.position.z = 0.78; parent.add(muzzle);
    parent.userData.muzzle = muzzle;
  } else if (type === 'heavy') {
    const box = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.15, 0.28), toonMat(dark));
    box.position.z = 0.10; parent.add(box);
    const barrel = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.09, 0.58, 10), metalMat(dark));
    barrel.rotation.x = Math.PI/2; barrel.position.z = 0.46; parent.add(barrel);
    const muzzle = new THREE.Object3D(); muzzle.position.z = 0.78; parent.add(muzzle);
    parent.userData.muzzle = muzzle;
  } else if (type === 'flame') {
    const tank = new THREE.Mesh(new THREE.CylinderGeometry(0.10, 0.10, 0.34, 10), toonMat(0x3a2a15));
    tank.position.set(-0.30, 0.30, -0.12); parent.parent.parent.add(tank);
    const nozzle = new THREE.Mesh(new THREE.ConeGeometry(0.10, 0.16, 8), toonMat(dark));
    nozzle.rotation.x = Math.PI/2; nozzle.position.z = 0.40; parent.add(nozzle);
    const muzzle = new THREE.Object3D(); muzzle.position.z = 0.50; parent.add(muzzle);
    parent.userData.muzzle = muzzle;
  } else if (type === 'grenade') {
    const launcher = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.08, 0.32, 8), toonMat(dark));
    launcher.rotation.x = Math.PI/2; launcher.position.z = 0.20; parent.add(launcher);
    const drum = new THREE.Mesh(new THREE.CylinderGeometry(0.10, 0.10, 0.10, 8), toonMat(0x303030));
    drum.position.set(0, -0.06, 0.16); drum.rotation.x = Math.PI/2; parent.add(drum);
    const muzzle = new THREE.Object3D(); muzzle.position.z = 0.42; parent.add(muzzle);
    parent.userData.muzzle = muzzle;
  } else if (type === 'medkit') {
    const kit = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.20, 0.16), toonMat(0xe0c0a0));
    kit.position.set(0, 0, 0.12); parent.add(kit);
    const cv = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.20, 0.02), basicMat(0xff4060));
    cv.position.set(0, 0, 0.21); parent.add(cv);
    const ch = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.08, 0.02), basicMat(0xff4060));
    ch.position.set(0, 0, 0.21); parent.add(ch);
    const muzzle = new THREE.Object3D(); muzzle.position.z = 0.25; parent.add(muzzle);
    parent.userData.muzzle = muzzle;
  } else if (type === 'staff') {
    const rod = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.04, 0.95, 6), toonMat(wood));
    rod.position.set(0, 0.20, 0); parent.add(rod);
    const orb = new THREE.Mesh(new THREE.SphereGeometry(0.13, 14, 10), basicMat(def.glow, { transparent:true, opacity:0.95 }));
    orb.position.set(0, 0.74, 0); parent.add(orb);
    const muzzle = new THREE.Object3D(); muzzle.position.set(0, 0.74, 0.15); parent.add(muzzle);
    parent.userData.muzzle = muzzle;
  } else if (type === 'lance') {
    const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.04, 0.85, 6), toonMat(wood));
    pole.rotation.x = Math.PI/2; pole.position.z = 0.30; parent.add(pole);
    const tip = new THREE.Mesh(new THREE.ConeGeometry(0.10, 0.32, 8), basicMat(def.glow));
    tip.rotation.x = Math.PI/2; tip.position.z = 0.75; parent.add(tip);
    const muzzle = new THREE.Object3D(); muzzle.position.z = 0.92; parent.add(muzzle);
    parent.userData.muzzle = muzzle;
  } else if (type === 'dual') {
    for (let xs of [-0.10, 0.10]) {
      const smg = new THREE.Mesh(new THREE.BoxGeometry(0.07, 0.11, 0.24), toonMat(dark));
      smg.position.set(xs, 0, 0.12); parent.add(smg);
    }
    const muzzle = new THREE.Object3D(); muzzle.position.z = 0.30; parent.add(muzzle);
    parent.userData.muzzle = muzzle;
  } else {
    const muzzle = new THREE.Object3D(); muzzle.position.z = 0.5; parent.add(muzzle);
    parent.userData.muzzle = muzzle;
  }
}


// ── VEHICLE MESH BUILDERS ──────────────────────────────────────────────
// Each vehicle has named bones: turret, barrel, wheels[], muzzle.
function buildLightVehicleMesh(def, side){
  const root = new THREE.Group();
  const teamCol = teamColor(side);
  const body = toonMat(def.color), dark = toonMat(def.accent);
  // Chassis
  const chassis = new THREE.Mesh(new THREE.BoxGeometry(1.15, 0.32, 1.7), dark);
  chassis.position.y = 0.40; chassis.castShadow = true; root.add(chassis);
  // Hood
  const hood = new THREE.Mesh(new THREE.BoxGeometry(1.0, 0.16, 0.7), body);
  hood.position.set(0, 0.62, 0.45); root.add(hood);
  // Cab
  const cab = new THREE.Mesh(new THREE.BoxGeometry(1.05, 0.36, 0.7), body);
  cab.position.set(0, 0.78, -0.05); cab.castShadow = true; root.add(cab);
  // Windshield
  const ws = new THREE.Mesh(new THREE.BoxGeometry(0.85, 0.32, 0.04), basicMat(0x4080b0, { transparent:true, opacity:0.65 }));
  ws.position.set(0, 0.88, 0.30); ws.rotation.x = -0.3; root.add(ws);
  // Side stripes
  for (let xs of [-0.58, 0.58]) {
    const stripe = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.10, 1.4), basicMat(teamCol));
    stripe.position.set(xs, 0.62, 0); root.add(stripe);
  }
  // Wheels (rotate)
  const wheels = [];
  for (const [x, z] of [[-0.52, 0.58], [0.52, 0.58], [-0.52, -0.58], [0.52, -0.58]]) {
    const w = new THREE.Mesh(new THREE.CylinderGeometry(0.27, 0.27, 0.22, 12), toonMat(0x101010));
    w.rotation.z = Math.PI/2; w.position.set(x, 0.27, z); w.castShadow = true;
    const hub = new THREE.Mesh(new THREE.CylinderGeometry(0.10, 0.10, 0.24, 8), toonMat(def.metal||0x404040));
    hub.rotation.z = Math.PI/2; hub.position.set(x, 0.27, z); root.add(hub);
    root.add(w); wheels.push(w);
  }
  // Mounted gun (yaw)
  const turret = new THREE.Group();
  turret.position.set(0, 1.05, -0.15);
  root.add(turret);
  const mount = new THREE.Mesh(new THREE.CylinderGeometry(0.10, 0.13, 0.10, 10), dark);
  turret.add(mount);
  const gun = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.06, 0.6, 8), toonMat(0x101010));
  gun.rotation.x = Math.PI/2; gun.position.set(0, 0.06, 0.32); turret.add(gun);
  const muzzle = new THREE.Object3D(); muzzle.position.set(0, 0.06, 0.65); turret.add(muzzle);
  // Stripe accent in role color
  const acc = new THREE.Mesh(new THREE.BoxGeometry(0.32, 0.04, 1.4), basicMat(ROLE_ACCENT.lightV));
  acc.position.set(0, 0.71, 0); root.add(acc);
  root.userData.bones = { turret, barrel:gun, wheels, muzzle };
  return root;
}
function buildAPCMesh(def, side){
  const root = new THREE.Group();
  const teamCol = teamColor(side);
  const body = toonMat(def.color), dark = toonMat(def.accent);
  // Lower hull
  const lower = new THREE.Mesh(new THREE.BoxGeometry(1.4, 0.42, 2.1), dark);
  lower.position.y = 0.32; lower.castShadow = true; root.add(lower);
  // Upper hull
  const upper = new THREE.Mesh(new THREE.BoxGeometry(1.3, 0.55, 1.8), body);
  upper.position.y = 0.78; upper.castShadow = true; root.add(upper);
  // Sloped front
  const front = new THREE.Mesh(new THREE.BoxGeometry(1.28, 0.45, 0.55), body);
  front.position.set(0, 0.65, 1.0); front.rotation.x = -0.32; root.add(front);
  // Side hatches
  for (let xs of [-0.66, 0.66]) {
    const hatch = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.18, 0.5), basicMat(teamCol));
    hatch.position.set(xs, 0.78, 0); root.add(hatch);
  }
  // Wheels (8 — 4 each side)
  const wheels = [];
  for (const zs of [-0.78, -0.26, 0.26, 0.78]) {
    for (const xs of [-0.66, 0.66]) {
      const w = new THREE.Mesh(new THREE.CylinderGeometry(0.25, 0.25, 0.20, 10), toonMat(0x101010));
      w.rotation.z = Math.PI/2; w.position.set(xs, 0.24, zs); w.castShadow = true;
      root.add(w); wheels.push(w);
    }
  }
  // Turret
  const turret = new THREE.Group();
  turret.position.y = 1.20;
  root.add(turret);
  const tBody = new THREE.Mesh(new THREE.BoxGeometry(0.55, 0.30, 0.65), dark);
  turret.add(tBody);
  const barrel = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.06, 0.75, 8), toonMat(0x101010));
  barrel.rotation.x = Math.PI/2; barrel.position.set(0, 0.04, 0.55); turret.add(barrel);
  const muzzle = new THREE.Object3D(); muzzle.position.set(0, 0.04, 0.95); turret.add(muzzle);
  // Antenna
  const ant = new THREE.Mesh(new THREE.CylinderGeometry(0.018, 0.018, 0.92, 5), toonMat(0x202020));
  ant.position.set(0.45, 1.55, -0.5); root.add(ant);
  root.userData.bones = { turret, barrel, wheels, muzzle };
  return root;
}
function buildTankMesh(def, side){
  const root = new THREE.Group();
  const teamCol = teamColor(side);
  const body = toonMat(def.color), dark = toonMat(def.accent);
  // Tracks (left/right)
  for (let xs of [-0.72, 0.72]) {
    const track = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.42, 2.3), toonMat(0x101010));
    track.position.set(xs, 0.22, 0); track.castShadow = true; root.add(track);
    // Tread teeth
    for (let i = 0; i < 7; i++) {
      const t = new THREE.Mesh(new THREE.BoxGeometry(0.46, 0.05, 0.22), toonMat(0x202020));
      t.position.set(xs, 0.45, -0.95 + i * 0.32); root.add(t);
    }
    // Road wheels
    for (let i = 0; i < 5; i++) {
      const w = new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.18, 0.10, 10), toonMat(def.metal||0x404040));
      w.rotation.z = Math.PI/2; w.position.set(xs, 0.22, -0.85 + i * 0.42); root.add(w);
    }
  }
  // Hull
  const hull = new THREE.Mesh(new THREE.BoxGeometry(1.75, 0.55, 2.4), body);
  hull.position.y = 0.72; hull.castShadow = true; root.add(hull);
  // Sloped glacis
  const glacis = new THREE.Mesh(new THREE.BoxGeometry(1.7, 0.55, 0.65), body);
  glacis.position.set(0, 0.62, 1.25); glacis.rotation.x = -0.36; root.add(glacis);
  // Star insignia
  const star = new THREE.Mesh(new THREE.CircleGeometry(0.30, 5), basicMat(teamCol));
  star.position.set(0, 1.0, 0.02); star.rotation.x = -Math.PI/2; root.add(star);
  // Side stripes
  for (let xs of [-0.92, 0.92]) {
    const stripe = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.16, 2.1), basicMat(teamCol));
    stripe.position.set(xs, 0.78, 0); root.add(stripe);
  }
  // Turret
  const turret = new THREE.Group();
  turret.position.y = 1.18;
  root.add(turret);
  const tBody = new THREE.Mesh(new THREE.BoxGeometry(1.05, 0.42, 1.20), body);
  turret.add(tBody);
  // Hatch
  const hatch = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.22, 0.10, 12), dark);
  hatch.position.set(0, 0.26, -0.30); turret.add(hatch);
  // Crew head
  const ch = new THREE.Mesh(new THREE.SphereGeometry(0.16, 10, 8), toonMat(def.skin));
  ch.position.set(0, 0.40, -0.30); turret.add(ch);
  const chHelm = new THREE.Mesh(new THREE.SphereGeometry(0.18, 10, 7, 0, Math.PI*2, 0, Math.PI/1.9), toonMat(def.accent));
  chHelm.position.set(0, 0.42, -0.30); turret.add(chHelm);
  // Main barrel
  const barrel = new THREE.Mesh(new THREE.CylinderGeometry(0.10, 0.12, 1.8, 12), metalMat(dark.color || 0x303030));
  barrel.rotation.x = Math.PI/2; barrel.position.set(0, 0, 1.05); barrel.castShadow = true; turret.add(barrel);
  const mb = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.16, 0.20, 10), toonMat(0x101010));
  mb.rotation.x = Math.PI/2; mb.position.set(0, 0, 2.05); turret.add(mb);
  const muzzle = new THREE.Object3D(); muzzle.position.set(0, 0, 2.20); turret.add(muzzle);
  // Antenna
  const ant = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.02, 0.95, 5), toonMat(0x101010));
  ant.position.set(-0.5, 1.85, -0.55); root.add(ant);
  root.userData.bones = { turret, barrel, wheels:[], muzzle };
  return root;
}
function buildArtilleryMesh(def, side){
  const root = new THREE.Group();
  const body = toonMat(def.color), dark = toonMat(def.accent);
  if (def.faction === 'mercs') {
    // Rocket truck
    const ch = new THREE.Mesh(new THREE.BoxGeometry(1.3, 0.32, 1.85), dark);
    ch.position.y = 0.42; ch.castShadow = true; root.add(ch);
    const cab = new THREE.Mesh(new THREE.BoxGeometry(0.92, 0.48, 0.6), body);
    cab.position.set(0, 0.82, 0.62); cab.castShadow = true; root.add(cab);
    const ws = new THREE.Mesh(new THREE.BoxGeometry(0.78, 0.30, 0.04), basicMat(0x4080b0, { transparent:true, opacity:0.65 }));
    ws.position.set(0, 0.92, 0.92); ws.rotation.x = -0.25; root.add(ws);
    const rack = new THREE.Mesh(new THREE.BoxGeometry(1.0, 0.4, 0.75), dark);
    rack.position.set(0, 0.92, -0.4); rack.rotation.x = -0.32; root.add(rack);
    const rackG = new THREE.Group(); rack.add(rackG);
    for (let xs of [-0.32, -0.10, 0.10, 0.32]) {
      for (let ys of [0, 0.20]) {
        const tube = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.07, 0.6, 6), toonMat(0x101010));
        tube.rotation.x = Math.PI/2;
        tube.position.set(xs, ys, 0.05); rack.add(tube);
      }
    }
    for (const [x, z] of [[-0.55, 0.7], [0.55, 0.7], [-0.55, -0.7], [0.55, -0.7]]) {
      const w = new THREE.Mesh(new THREE.CylinderGeometry(0.27, 0.27, 0.22, 12), toonMat(0x101010));
      w.rotation.z = Math.PI/2; w.position.set(x, 0.27, z); w.castShadow = true; root.add(w);
    }
    const muzzle = new THREE.Object3D(); muzzle.position.set(0, 1.1, -0.95); root.add(muzzle);
    root.userData.bones = { turret:rack, barrel:null, wheels:[], muzzle };
  } else if (def.faction === 'cult') {
    // Ritual caster
    const base = new THREE.Mesh(new THREE.CylinderGeometry(0.85, 0.95, 0.32, 12), dark);
    base.position.y = 0.16; base.castShadow = true; root.add(base);
    const robe = new THREE.Mesh(new THREE.ConeGeometry(0.5, 1.2, 9), body);
    robe.position.y = 0.95; robe.castShadow = true; root.add(robe);
    const orb = new THREE.Mesh(new THREE.SphereGeometry(0.28, 16, 12), basicMat(def.glow));
    orb.position.y = 1.80; root.add(orb);
    // Floating runes
    for (let i = 0; i < 5; i++) {
      const a = (i / 5) * Math.PI * 2;
      const rune = new THREE.Mesh(new THREE.BoxGeometry(0.13, 0.025, 0.32), basicMat(def.glow));
      rune.position.set(Math.cos(a) * 0.6, 0.34, Math.sin(a) * 0.6); rune.rotation.y = -a; root.add(rune);
    }
    const muzzle = new THREE.Object3D(); muzzle.position.set(0, 1.80, 0); root.add(muzzle);
    root.userData.bones = { turret:robe, barrel:null, wheels:[], muzzle, orb };
  } else {
    // Mortar/howitzer
    const base = new THREE.Mesh(new THREE.CylinderGeometry(0.6, 0.7, 0.20, 12), dark);
    base.position.y = 0.10; base.castShadow = true; root.add(base);
    for (let ang of [0, Math.PI*2/3, Math.PI*4/3]) {
      const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.04, 0.78, 6), dark);
      leg.position.set(Math.cos(ang) * 0.45, 0.39, Math.sin(ang) * 0.45);
      leg.rotation.x = 0.22; leg.rotation.z = -ang; root.add(leg);
    }
    const tube = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.20, 1.35, 12), dark);
    tube.rotation.x = -0.6; tube.position.set(0, 0.78, -0.22); tube.castShadow = true; root.add(tube);
    const cap = new THREE.Mesh(new THREE.CylinderGeometry(0.21, 0.21, 0.10, 12), toonMat(0x101010));
    cap.rotation.x = -0.6; cap.position.set(0, 1.34, -0.62); root.add(cap);
    const muzzle = new THREE.Object3D(); muzzle.position.set(0, 1.40, -0.68); root.add(muzzle);
    root.userData.bones = { turret:tube, barrel:tube, wheels:[], muzzle };
  }
  return root;
}
function buildAAMesh(def, side){
  const root = new THREE.Group();
  const teamCol = teamColor(side);
  const body = toonMat(def.color), dark = toonMat(def.accent);
  // Sandbag ring
  for (let i = 0; i < 12; i++) {
    const a = (i / 12) * Math.PI * 2;
    const sb = new THREE.Mesh(new THREE.SphereGeometry(0.22, 7, 6), toonMat(0x8a7040));
    sb.position.set(Math.cos(a) * 0.7, 0.16, Math.sin(a) * 0.7);
    sb.scale.y = 0.65; sb.castShadow = true; root.add(sb);
  }
  // Platform
  const platform = new THREE.Mesh(new THREE.CylinderGeometry(0.55, 0.55, 0.14, 12), dark);
  platform.position.y = 0.36; platform.castShadow = true; root.add(platform);
  // Turret
  const turret = new THREE.Group();
  turret.position.y = 0.62;
  root.add(turret);
  const tBody = new THREE.Mesh(new THREE.BoxGeometry(0.6, 0.36, 0.65), body);
  tBody.castShadow = true; turret.add(tBody);
  const seat = new THREE.Mesh(new THREE.BoxGeometry(0.20, 0.14, 0.22), dark);
  seat.position.set(0, 0.22, -0.18); turret.add(seat);
  // Twin barrels
  const guns = new THREE.Group();
  if (def.faction === 'mercs') {
    const box = new THREE.Mesh(new THREE.BoxGeometry(0.50, 0.25, 0.45), dark);
    box.position.set(0.18, 0.18, 0); guns.add(box);
    for (let xs of [-0.10, 0.10]) {
      for (let ys of [0.10, 0.30]) {
        const tube = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 0.40, 6), toonMat(0x101010));
        tube.rotation.z = Math.PI/2; tube.position.set(0.50, ys, xs); guns.add(tube);
      }
    }
  } else {
    for (let xs of [-0.13, 0.13]) {
      const b = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.08, 1.1, 8), toonMat(0x101010));
      b.position.set(xs + 0.22, 0.36, -0.14); b.rotation.x = -0.36; b.castShadow = true; guns.add(b);
    }
  }
  turret.add(guns);
  const muzzle = new THREE.Object3D(); muzzle.position.set(0.22, 0.85, -0.7); turret.add(muzzle);
  // Team band
  const band = new THREE.Mesh(new THREE.CylinderGeometry(0.57, 0.57, 0.06, 12), basicMat(teamCol));
  band.position.y = 0.43; root.add(band);
  root.userData.bones = { turret, barrel:guns, wheels:[], muzzle, guns };
  return root;
}
function buildAirMesh(def, side){
  const root = new THREE.Group();
  const teamCol = teamColor(side);
  const body = toonMat(def.color), dark = toonMat(def.accent);
  if (def.faction === 'cult') {
    // Wing demon
    const torso = new THREE.Mesh(new THREE.SphereGeometry(0.55, 14, 10), body);
    torso.scale.set(0.85, 0.78, 1.5); torso.castShadow = true; root.add(torso);
    const wings = new THREE.Group();
    for (let xs of [-1, 1]) {
      const wing = new THREE.Mesh(new THREE.BoxGeometry(1.4, 0.04, 0.85), dark);
      wing.position.set(xs * 0.85, 0, 0); wings.add(wing);
    }
    root.add(wings);
    for (let xs of [-0.13, 0.13]) {
      const eye = new THREE.Mesh(new THREE.BoxGeometry(0.10, 0.07, 0.04), basicMat(def.glow));
      eye.position.set(xs, 0.12, 0.55); root.add(eye);
    }
    const tail = new THREE.Mesh(new THREE.ConeGeometry(0.18, 0.6, 6), dark);
    tail.rotation.x = -Math.PI/2; tail.position.z = -0.85; root.add(tail);
    const muzzle = new THREE.Object3D(); muzzle.position.set(0, 0, 0.7); root.add(muzzle);
    root.userData.bones = { turret:null, wings, muzzle };
  } else {
    // Helicopter
    const fuselage = new THREE.Mesh(new THREE.SphereGeometry(0.62, 16, 12), body);
    fuselage.scale.set(0.92, 0.78, 1.55); fuselage.castShadow = true; root.add(fuselage);
    const cockpit = new THREE.Mesh(new THREE.SphereGeometry(0.40, 14, 10), basicMat(0x80c0ff, { transparent:true, opacity:0.65 }));
    cockpit.scale.set(0.95, 0.78, 1.15); cockpit.position.set(0, 0.10, 0.40); root.add(cockpit);
    // Tail boom
    const boom = new THREE.Mesh(new THREE.CylinderGeometry(0.10, 0.13, 1.5, 12), body);
    boom.rotation.x = Math.PI/2; boom.position.z = -1.05; root.add(boom);
    const fin = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.4, 0.32), body);
    fin.position.set(0, 0.20, -1.75); root.add(fin);
    const tailRotor = new THREE.Mesh(new THREE.BoxGeometry(0.55, 0.025, 0.04), toonMat(0x101010));
    tailRotor.position.set(0.10, 0.14, -1.85); root.add(tailRotor);
    // Skids
    for (let xs of [-0.38, 0.38]) {
      const skid = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.04, 1.4, 6), dark);
      skid.rotation.x = Math.PI/2; skid.position.set(xs, -0.58, -0.05); root.add(skid);
    }
    // Main rotor
    const rotor = new THREE.Group();
    for (let i = 0; i < 4; i++) {
      const b = new THREE.Mesh(new THREE.BoxGeometry(2.0, 0.025, 0.10), toonMat(0x101010));
      b.rotation.y = (i / 4) * Math.PI / 2; rotor.add(b);
    }
    rotor.position.y = 0.78; root.add(rotor);
    // Chin gun
    const gun = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 0.55, 6), toonMat(0x101010));
    gun.rotation.x = Math.PI/2; gun.position.set(0, -0.28, 0.78); root.add(gun);
    const muzzle = new THREE.Object3D(); muzzle.position.set(0, -0.28, 1.05); root.add(muzzle);
    // Star
    const star = new THREE.Mesh(new THREE.CircleGeometry(0.22, 5), basicMat(teamCol));
    star.position.set(0, 0.05, 0.78); star.rotation.x = -Math.PI/2; root.add(star);
    root.userData.bones = { turret:null, rotor, tailRotor, muzzle };
  }
  root.position.y = 3.8;
  return root;
}

// Main mesh-builder dispatcher
function buildUnitMesh(def, side){
  let mesh;
  const role = def.roleKey;
  const acc = ROLE_ACCENT[role];
  // Pick appropriate weapon for infantry
  const wt = (role === 'sniper') ? 'snipe'
    : (role === 'heavygunner') ? 'heavy'
    : (role === 'flamer') ? 'flame'
    : (role === 'grenadier') ? 'grenade'
    : (role === 'medic') ? 'medkit'
    : (role === 'commander') ? (def.faction === 'empire' ? 'lance' : def.faction === 'cult' ? 'staff' : def.faction === 'mercs' ? 'dual' : 'rifle')
    : 'rifle';

  if (role === 'lightV')      mesh = buildLightVehicleMesh(def, side);
  else if (role === 'apc')    mesh = buildAPCMesh(def, side);
  else if (role === 'tank')   mesh = buildTankMesh(def, side);
  else if (role === 'artillery') mesh = buildArtilleryMesh(def, side);
  else if (role === 'aa')     mesh = buildAAMesh(def, side);
  else if (role === 'gunship')mesh = buildAirMesh(def, side);
  else                        mesh = buildInfantryRig(def, side, { weaponType:wt });

  // Role-specific accents on infantry
  if (mesh.userData.bones && mesh.userData.bones.torso) {
    if (role === 'swarm') mesh.scale.setScalar(0.92);
    else if (role === 'scout') mesh.scale.setScalar(0.95);
    else if (role === 'heavygunner') {
      mesh.scale.set(1.13, 1.05, 1.13);
      // Ammo belt
      const belt = new THREE.Mesh(new THREE.BoxGeometry(0.55, 0.07, 0.34), basicMat(0xffcc44));
      belt.position.set(0, 0.36, 0.18); belt.rotation.z = -0.4;
      mesh.userData.bones.torso.add(belt);
    } else if (role === 'commander') {
      mesh.scale.set(1.18, 1.22, 1.18);
      // Cape
      const cape = new THREE.Mesh(new THREE.BoxGeometry(0.45, 0.6, 0.04), toonMat(def.accent));
      cape.position.set(0, 0.10, -0.20); mesh.userData.bones.torso.add(cape);
      // Crown band
      const crown = new THREE.Mesh(new THREE.BoxGeometry(0.50, 0.06, 0.48), basicMat(acc));
      crown.position.set(0, 0.45, 0); mesh.userData.bones.neck.add(crown);
    } else if (role === 'sniper') {
      mesh.scale.set(0.95, 1.07, 0.95);
    }
    // Role-color shoulder plates
    if (acc && ['rifleman','heavygunner','grenadier','medic','commander'].includes(role)) {
      for (let xs of [-0.32, 0.32]) {
        const p = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.10, 0.20), basicMat(acc));
        p.position.set(xs, 0.42, 0); mesh.userData.bones.torso.add(p);
      }
    }
  }
  // Apply outline last (preserves bone hierarchy)
  addOutline(mesh, 1.04);
  mesh.traverse(o => { if (o.isMesh) o.castShadow = true; });
  return mesh;
}


// ── HQ + TOWERS ────────────────────────────────────────────────────────
function buildHQ(side, fk){
  const f = FACTIONS[fk] || FACTIONS.rebels;
  const root = new THREE.Group();
  const teamCol = teamColor(side);
  // Base platform
  const platform = new THREE.Mesh(new THREE.BoxGeometry(8, 0.6, 7), toonMat(f.palette.accent));
  platform.position.y = 0.3; platform.castShadow = true; platform.receiveShadow = true; root.add(platform);
  // Sandbag perimeter
  for (let s of [-3.6, 3.6]) {
    for (let zs = -3.2; zs <= 3.2; zs += 0.55) {
      const sb = new THREE.Mesh(new THREE.SphereGeometry(0.26, 6, 5), toonMat(0x8a7040));
      sb.position.set(s, 0.65, zs); sb.scale.y = 0.7; root.add(sb);
    }
  }
  // Main fortress
  const fort = new THREE.Mesh(new THREE.BoxGeometry(6.0, 2.6, 5.0), toonMat(f.palette.main));
  fort.position.y = 1.9; fort.castShadow = true; root.add(fort);
  // Window slits
  for (let ys of [3.6, 5.0]) {
    for (let zs of [-1.2, 0, 1.2]) {
      const w = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.45, 0.32), basicMat(teamCol));
      w.position.set(1.55, ys, zs); root.add(w);
    }
  }
  // Tower
  const tower = new THREE.Mesh(new THREE.BoxGeometry(3.2, 3.4, 3.2), toonMat(f.palette.main));
  tower.position.y = 4.85; tower.castShadow = true; root.add(tower);
  // Top platform
  const topPlat = new THREE.Mesh(new THREE.BoxGeometry(3.6, 0.4, 3.6), toonMat(f.palette.accent));
  topPlat.position.y = 6.7; root.add(topPlat);
  // Mast + beacon
  const mast = new THREE.Mesh(new THREE.CylinderGeometry(0.10, 0.10, 4.2, 8), toonMat(0x101010));
  mast.position.y = 8.95; root.add(mast);
  const beacon = new THREE.Mesh(new THREE.SphereGeometry(0.5, 16, 12), basicMat(teamCol));
  beacon.position.y = 11.2; root.add(beacon);
  // Beacon glow halo
  const halo = new THREE.Mesh(new THREE.SphereGeometry(0.85, 16, 12), basicMat(teamCol, { transparent:true, opacity:0.25, depthWrite:false }));
  halo.position.y = 11.2; root.add(halo);
  // Team ring
  const ring = new THREE.Mesh(new THREE.TorusGeometry(1.9, 0.16, 8, 24), basicMat(teamCol));
  ring.rotation.x = Math.PI/2; ring.position.y = 6.85; root.add(ring);
  // Faction emblem on fortress front
  const emblem = new THREE.Group();
  if (fk === 'rebels') {
    for (let i = 0; i < 8; i++) {
      const r = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.85, 0.08), basicMat(f.palette.flag));
      r.rotation.z = (i/8) * Math.PI - Math.PI/2; r.position.y = 0.42; emblem.add(r);
    }
    const sun = new THREE.Mesh(new THREE.CircleGeometry(0.42, 16), basicMat(f.palette.flag));
    sun.position.z = 0.01; emblem.add(sun);
  } else if (fk === 'empire') {
    const v = new THREE.Mesh(new THREE.BoxGeometry(0.22, 1.5, 0.06), basicMat(f.palette.flag));
    emblem.add(v);
    const h = new THREE.Mesh(new THREE.BoxGeometry(1.1, 0.22, 0.06), basicMat(f.palette.flag));
    h.position.y = 0.30; emblem.add(h);
  } else if (fk === 'mercs') {
    const ring2 = new THREE.Mesh(new THREE.RingGeometry(0.6, 0.74, 24), basicMat(f.palette.flag));
    emblem.add(ring2);
    const ch2 = new THREE.Mesh(new THREE.BoxGeometry(1.7, 0.10, 0.06), basicMat(f.palette.flag));
    emblem.add(ch2);
    const cv2 = new THREE.Mesh(new THREE.BoxGeometry(0.10, 1.7, 0.06), basicMat(f.palette.flag));
    emblem.add(cv2);
  } else {
    const tri = new THREE.Mesh(new THREE.ConeGeometry(0.8, 1.2, 3), basicMat(f.palette.flag));
    tri.rotation.z = Math.PI; emblem.add(tri);
    const eye = new THREE.Mesh(new THREE.SphereGeometry(0.24, 14, 12), basicMat(f.palette.flag));
    eye.position.y = -0.10; emblem.add(eye);
  }
  emblem.scale.setScalar(1.5);
  emblem.position.set(0, 4.85, 1.55);
  root.add(emblem);
  addOutline(root, 1.02);
  root.userData.beacon = beacon; root.userData.halo = halo;
  return root;
}
function buildTower(type, side, fk){
  const f = FACTIONS[fk] || FACTIONS.rebels;
  const root = new THREE.Group();
  const teamCol = teamColor(side);
  if (type === 'gun') {
    const base = new THREE.Mesh(new THREE.BoxGeometry(1.9, 1.2, 1.9), toonMat(f.palette.main));
    base.position.y = 0.6; base.castShadow = true; root.add(base);
    const mid = new THREE.Mesh(new THREE.BoxGeometry(1.5, 1.1, 1.5), toonMat(f.palette.main));
    mid.position.y = 1.7; mid.castShadow = true; root.add(mid);
    const band = new THREE.Mesh(new THREE.BoxGeometry(1.52, 0.10, 1.52), basicMat(teamCol));
    band.position.y = 2.30; root.add(band);
    const turret = new THREE.Group();
    const dome = new THREE.Mesh(new THREE.SphereGeometry(0.58, 14, 10, 0, Math.PI*2, 0, Math.PI/2), toonMat(f.palette.main));
    turret.add(dome);
    const barrel = new THREE.Mesh(new THREE.CylinderGeometry(0.10, 0.12, 1.5, 12), metalMat(0x202020));
    barrel.rotation.x = Math.PI/2; barrel.position.z = 0.85; turret.add(barrel);
    turret.position.y = 2.5; root.add(turret);
    const muzzle = new THREE.Object3D(); muzzle.position.set(0, 2.5, 1.65); root.add(muzzle);
    root.userData.bones = { turret, barrel, muzzle };
  } else if (type === 'mortar') {
    const base = new THREE.Mesh(new THREE.CylinderGeometry(1.3, 1.5, 1.2, 12), toonMat(f.palette.main));
    base.position.y = 0.6; base.castShadow = true; root.add(base);
    const turret = new THREE.Group();
    const tube = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.26, 1.7, 12), metalMat(0x202020));
    tube.rotation.x = -0.6; tube.position.set(0, 0.7, -0.22); tube.castShadow = true; turret.add(tube);
    turret.position.y = 1.3; root.add(turret);
    const muzzle = new THREE.Object3D(); muzzle.position.set(0, 2.5, -0.85); root.add(muzzle);
    root.userData.bones = { turret, barrel:tube, muzzle };
  } else if (type === 'aa') {
    const base = new THREE.Mesh(new THREE.CylinderGeometry(0.85, 1.2, 2.4, 12), toonMat(f.palette.main));
    base.position.y = 1.2; base.castShadow = true; root.add(base);
    const turret = new THREE.Group();
    for (let xs of [-0.13, 0.13]) {
      const b = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.10, 1.4, 10), toonMat(0x101010));
      b.position.set(xs + 0.30, 0.36, -0.24); b.rotation.x = -0.32; b.castShadow = true; turret.add(b);
    }
    turret.position.y = 2.5; root.add(turret);
    const muzzle = new THREE.Object3D(); muzzle.position.set(0.30, 3.0, -0.85); root.add(muzzle);
    root.userData.bones = { turret, barrel:null, muzzle };
  }
  // Flag
  const flag = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.34, 0.04), basicMat(teamCol));
  flag.position.set(0, 3.2, 0); root.add(flag);
  addOutline(root, 1.025);
  return root;
}

// ── HP PIP (sprite) ────────────────────────────────────────────────────
function makePip() {
  const c = document.createElement('canvas'); c.width=64; c.height=8;
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
  let col = r > 0.6 ? (side==='player'?'#5aa8e8':'#e8584a') : r > 0.3 ? '#f0c060' : '#e85040';
  ctx.fillStyle = col;
  ctx.fillRect(1, 1, (canvas.width-2)*r, canvas.height-2);
  tex.needsUpdate = true;
}

// ── ANIMATION SYSTEM — drives bones based on unit state per frame ──────
// State machine: idle → walking → attacking → reloading → dying
function animateUnit(u, mesh, dt){
  if (!mesh || !mesh.userData.bones) return;
  const b = mesh.userData.bones;
  const time = performance.now() * 0.001;

  // ── DEATH ANIMATION
  if (u.deathStarted) return; // deathStarted handled separately

  // Common: weapon recoil decays
  if (u.recoil > 0) {
    u.recoil = Math.max(0, u.recoil - dt * 4);
    if (b.weapon) b.weapon.position.z = 0.05 - u.recoil * 0.3;
    if (b.barrel && b.barrel.parent && b.barrel.parent === b.turret) {
      // Tank/APC barrel slides back
      const baseZ = (u.def.roleKey === 'tank') ? 1.05 : 0.55;
      b.barrel.position.z = baseZ - u.recoil * 0.7;
    }
  }

  // Air units bob
  if (u.def.type === 'air') {
    if (b.rotor) b.rotor.rotation.y += dt * 38;
    if (b.tailRotor) b.tailRotor.rotation.x += dt * 50;
    if (b.wings) {
      const ph = Math.sin(time * 8) * 0.5;
      b.wings.children.forEach((w, i) => { w.rotation.z = (i === 0 ? 1 : -1) * ph; });
    }
    return;
  }

  // Vehicles: rotate wheels with movement
  if (b.wheels && b.wheels.length) {
    const wheelSpeed = u.moving ? u.def.speed * 2.5 * dt : 0;
    for (const w of b.wheels) w.rotation.x += wheelSpeed;
    // Subtle bounce
    if (mesh.userData.suspension == null) mesh.userData.suspension = 0;
    const targetBounce = u.moving ? Math.sin(time * 8 + u.id) * 0.02 : 0;
    mesh.userData.suspension += (targetBounce - mesh.userData.suspension) * Math.min(1, dt * 8);
    mesh.position.y = mesh.userData.suspension;
  }

  // Turret tracking (vehicles + tanks + APCs)
  if (b.turret && u.target && !b.wings) {
    const tx = (u.target.x || 0) - u.x;
    const tz = (u.target.z || 0) - u.z;
    const aimA = Math.atan2(tx, tz) - u.facing;
    const cur = b.turret.rotation.y;
    let diff = aimA - cur;
    while (diff > Math.PI) diff -= Math.PI * 2;
    while (diff < -Math.PI) diff += Math.PI * 2;
    b.turret.rotation.y = cur + diff * Math.min(1, dt * 4);
  }

  // INFANTRY animation — only if has hips/legs
  if (!b.hips || !b.leftLeg) return;

  // Smooth facing rotation
  if (mesh.userData._visFacing == null) mesh.userData._visFacing = u.facing;
  let dF = u.facing - mesh.userData._visFacing;
  while (dF > Math.PI) dF -= Math.PI * 2;
  while (dF < -Math.PI) dF += Math.PI * 2;
  mesh.userData._visFacing += dF * Math.min(1, dt * 9);
  mesh.rotation.y = mesh.userData._visFacing;

  if (u.moving) {
    // WALK CYCLE — coordinated leg + arm + hip swing
    const speed = u.def.speed * 2.5;
    u.walkPhase = (u.walkPhase || 0) + dt * speed;
    const ph = u.walkPhase;
    const legAmp = 0.45;
    const armAmp = 0.30;
    const hipAmp = 0.06;
    b.leftLeg.rotation.x  =  Math.sin(ph) * legAmp;
    b.rightLeg.rotation.x = -Math.sin(ph) * legAmp;
    // Arms swing opposite to legs
    b.leftArm.rotation.x  = -Math.sin(ph) * armAmp;
    b.rightArm.rotation.x =  Math.sin(ph) * armAmp;
    // Hip sway up/down per step
    b.hips.position.y = 0.78 + Math.abs(Math.sin(ph * 2)) * hipAmp;
    // Torso slight twist
    b.torso.rotation.y = Math.sin(ph) * 0.06;
    // Head bob counter
    if (b.neck) b.neck.rotation.x = Math.sin(ph) * 0.04;
  } else {
    // IDLE — slow breathing
    const ph = time * 1.5;
    const breath = Math.sin(ph) * 0.025;
    b.hips.position.y = 0.78 + breath;
    b.torso.rotation.y *= 0.92;
    // Decay leg/arm rotations
    b.leftLeg.rotation.x  *= 0.85;
    b.rightLeg.rotation.x *= 0.85;
    b.leftArm.rotation.x  *= 0.85;
    b.rightArm.rotation.x *= 0.85;
    if (b.neck) b.neck.rotation.x *= 0.9;
  }

  // AIM — when has target, raise right arm and aim weapon
  if (u.target && u.def.type === 'ground' && u.def.fire !== 'heal') {
    const tx = (u.target.x || 0) - u.x;
    const tz = (u.target.z || 0) - u.z;
    const dy = (u.target.def && u.target.def.type === 'air') ? 2.5 : 0.3;
    const aimY = Math.atan2(tx, tz);
    let diffYaw = aimY - mesh.userData._visFacing;
    while (diffYaw > Math.PI) diffYaw -= Math.PI * 2;
    while (diffYaw < -Math.PI) diffYaw += Math.PI * 2;
    // Rotate torso to face target
    b.torso.rotation.y += diffYaw * 0.3;
    // Arm raise (interpolated to weapon pitch)
    const horizDist = Math.hypot(tx, tz);
    const aimPitch = Math.atan2(dy - 0.6, horizDist);
    b.rightArm.rotation.x = -Math.PI/2 + aimPitch * 0.6;
    b.leftArm.rotation.x = -Math.PI/3 + aimPitch * 0.4;
  }
}


// ── GAME LOGIC: spawn, target, fire, AI ────────────────────────────────
function getLaneForZ(z){
  let best = { id:'top', z:LANE_TOP_Z }, bestD = Math.abs(z - LANE_TOP_Z);
  const d1 = Math.abs(z - LANE_MID_Z); if (d1 < bestD) { best = { id:'mid', z:LANE_MID_Z }; bestD = d1; }
  const d2 = Math.abs(z - LANE_BOT_Z); if (d2 < bestD) { best = { id:'bot', z:LANE_BOT_Z }; bestD = d2; }
  return best;
}
function spawnUnit(unitKey, side, fx, fz){
  const def = UNITS[unitKey]; if (!def) return;
  const count = def.count || 1;
  if (def.type === 'ground' && def.speed > 0) {
    const lane = getLaneForZ(fz);
    fz = lane.z + (fz - lane.z) * 0.3;
    fz = Math.max(lane.z - LANE_HALF * 0.85, Math.min(lane.z + LANE_HALF * 0.85, fz));
  }
  for (let i = 0; i < count; i++) {
    const ox = (i % 2) * 0.45 - 0.18;
    const oz = (i - (count - 1) / 2) * 0.55;
    const diff = DIFFICULTY[STATE.difficulty || 'normal'] || DIFFICULTY.normal;
    const fm = getFactionMod(def.faction);
    const hpMul = ((side === 'enemy' && STATE.currentMission) ? STATE.currentMission.enemyHpMul * diff.enemyHpMul : 1) * fm.hpMul;
    const u = {
      id:nextId++, key:unitKey, def, side, x:fx + ox, z:fz + oz,
      facing: side === 'player' ? Math.PI/2 : -Math.PI/2,
      hp:def.hp * hpMul, maxHp:def.hp * hpMul,
      // Cached effective stats — read by movement/fire instead of def.* directly
      effSpeed: def.speed * fm.speedMul,
      effRange: def.range * fm.rangeMul,
      effDmgMul: fm.dmgMul,
      cooldown:0, target:null, spawnAnim:1.0,
      walkPhase:Math.random() * Math.PI * 2,
      flash:0, stunned:0, smoked:0, recoil:0, moving:false,
      burstRemaining:0, burstTimer:0, buffed:0, ritualBuff:0, warCry:0, berserk:0, aegis:0,
    };
    STATE.units.push(u);
    if (side === 'player') STATE.stats.deployed++;
    const mesh = buildUnitMesh(def, side);
    const pip = makePip();
    pip.position.y = def.type === 'air' ? 1.6 : (def.roleKey === 'tank' ? 2.5 : def.roleKey === 'apc' ? 2.2 : 2.0);
    mesh.add(pip);
    mesh.position.set(u.x, def.type === 'air' ? 3.8 : 0, u.z);
    mesh.rotation.y = u.facing;
    mesh.userData.unit = u; mesh.userData.pip = pip;
    scene.add(mesh);
    unitObjects.set(u.id, mesh);
  }
  addFX({ type:'puff', x:fx, y:0.1, z:fz, t:0, dur:0.6 });
  playSound('deploy');
}

function createTowers(){
  STATE.towers = [];
  towerObjects.forEach(m => removeAndDispose(m)); towerObjects.clear();
  const diff = DIFFICULTY[STATE.difficulty || 'normal'] || DIFFICULTY.normal;
  const ehp = (STATE.currentMission ? STATE.currentMission.enemyHpMul : 1) * diff.enemyHpMul;
  const topT = STATE.progress.towerTop || 'gun';
  const botT = STATE.progress.towerBottom || 'gun';
  const midT = 'gun';
  const pf = STATE.progress.playerFaction;
  const ef = STATE.currentMission ? STATE.currentMission.enemyFaction : 'empire';
  const pHQX = -FIELD_W/2 + 4, eHQX = FIELD_W/2 - 4;
  const pTX = -FIELD_W/2 + 14, eTX = FIELD_W/2 - 14;
  function mk(side, fk, type, x, z, label, hpMul) {
    const T = TOWER_TYPES[type];
    return { side, faction:fk, role:'turret', type, x, z, hp:T.hp * hpMul, maxHp:T.hp * hpMul,
      dmg:T.dmg, range:T.range, atkSpeed:T.atkSpeed, radius:1.4, targets:T.targets, splash:T.splash || 0,
      // windupTimer: rolls down from windup whenever a fresh target enters range.
      // Tower can't fire until it hits 0. Units can deploy under cover briefly.
      windup:T.windup || 0.4, windupTimer:0, lastTargetId:null,
      label, flash:0, stunned:0, cooldown:0 };
  }
  // Pass-A: HQ no longer attacks. Higher HP (was 5000 → 6500) since it's a
  // target-only structure now. Range/dmg/atkSpeed kept for old-data compat
  // but `targets:'none'` makes findNearestEnemyForTower skip it.
  const list = [
    { side:'player', faction:pf, role:'hq', type:'hq', x:pHQX, z:0, hp:6500, maxHp:6500, dmg:0, range:0, atkSpeed:99, radius:3, targets:'none', flash:0, stunned:0, cooldown:0 },
    mk('player', pf, topT, pTX, LANE_TOP_Z, 'T', 1),
    mk('player', pf, midT, pTX, LANE_MID_Z, 'M', 1),
    mk('player', pf, botT, pTX, LANE_BOT_Z, 'B', 1),
    { side:'enemy', faction:ef, role:'hq', type:'hq', x:eHQX, z:0, hp:6500*ehp, maxHp:6500*ehp, dmg:0, range:0, atkSpeed:99, radius:3, targets:'none', flash:0, stunned:0, cooldown:0 },
    mk('enemy', ef, topT, eTX, LANE_TOP_Z, 'T', ehp),
    mk('enemy', ef, midT, eTX, LANE_MID_Z, 'M', ehp),
    mk('enemy', ef, botT, eTX, LANE_BOT_Z, 'B', ehp),
  ];
  for (const t of list) {
    t.id = nextId++;
    STATE.towers.push(t);
    const mesh = t.role === 'hq' ? buildHQ(t.side, t.faction) : buildTower(t.type, t.side, t.faction);
    mesh.position.set(t.x, 0, t.z);
    mesh.rotation.y = t.side === 'enemy' ? -Math.PI / 2 : Math.PI / 2;
    const pip = makePip();
    pip.position.y = t.role === 'hq' ? 12.5 : 4.6;
    pip.scale.set(t.role === 'hq' ? 3.4 : 2.0, 0.26, 1);
    mesh.add(pip);
    mesh.userData = { tower:t, pip, beacon:mesh.userData.beacon, halo:mesh.userData.halo };
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
    d.className = 'tower-pip blue' + (t.hp <= 0 ? ' dead' : '');
    d.innerHTML = `<span class="dot"></span><span>${t.label}</span>`;
    left.appendChild(d);
  }
  for (const t of STATE.towers.filter(x => x.side === 'enemy' && x.role === 'turret')) {
    const d = document.createElement('div');
    d.className = 'tower-pip red' + (t.hp <= 0 ? ' dead' : '');
    d.innerHTML = `<span class="dot"></span><span>${t.label}</span>`;
    right.appendChild(d);
  }
}

function clearBattle(){
  STATE.units = []; STATE.projectiles = []; STATE.fx = []; STATE.towers = [];
  STATE.craters = [];
  unitObjects.forEach(m => removeAndDispose(m)); unitObjects.clear();
  projObjects.forEach(m => removeAndDispose(m)); projObjects.clear();
  towerObjects.forEach(m => removeAndDispose(m)); towerObjects.clear();
  for (const f of fxObjects) if (f.mesh) removeAndDispose(f.mesh);
  fxObjects = [];
  STATE.passives = {};
  STATE.bloodIntensity = 0;
  STATE.stats = { kills:0, allyDeaths:0, deployed:0, dmgDealt:0, dmgTaken:0 };
}

function needsBridge(u, t){ return u.def.type === 'ground' && ((u.x < 0) !== (t.x < 0)); }
function nearestBridge(z){
  let best = BRIDGES[0], bd = Infinity;
  for (const b of BRIDGES) { const d = Math.abs(b.z - z); if (d < bd) { bd = d; best = b; } }
  return best;
}
function moveToward(u, target, dt){
  if (u.def.speed === 0 || u.stunned > 0) { u.moving = false; return; }
  const def = u.def;
  // Use cached effSpeed (faction speed mod baked in at spawn)
  let speed = u.effSpeed != null ? u.effSpeed : def.speed;
  if (u.buffed > 0) speed *= 1.2;
  if (u.warCry > 0) speed *= 1.3;
  if (def.type === 'air') {
    const dx = target.x - u.x, dz = target.z - u.z;
    const d = Math.hypot(dx, dz);
    if (d < 0.2) { u.moving = false; return; }
    u.x += (dx / d) * speed * dt;
    u.z += (dz / d) * speed * dt;
    u.facing = Math.atan2(dx, dz);
    u.moving = true;
    return;
  }
  let goalX = target.x, goalZ = target.z;
  const myLane = getLaneForZ(u.z);
  if (needsBridge(u, { x:goalX, z:goalZ })) {
    const onBridge = Math.abs(u.x) < RIVER_HALF + 0.6 && BRIDGES.some(b => Math.abs(u.z - b.z) < b.halfLength);
    if (!onBridge) {
      const br = BRIDGES.find(b => Math.abs(b.z - myLane.z) < 2.0) || nearestBridge(u.z);
      goalZ = br.z;
      goalX = (u.x < 0) ? -RIVER_HALF - 0.4 : RIVER_HALF + 0.4;
    }
  }
  const dx = goalX - u.x, dz = goalZ - u.z;
  const d = Math.hypot(dx, dz);
  if (d < 0.05) { u.moving = false; return; }
  u.x += (dx / d) * speed * dt;
  u.z += (dz / d) * speed * dt;
  u.facing = Math.atan2(dx, dz);
  u.moving = true;
  // Avoid ally collision
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
  // River push
  if (def.type === 'ground' && Math.abs(u.x) < RIVER_HALF) {
    const onBridge = BRIDGES.some(b => Math.abs(u.z - b.z) < b.halfLength);
    if (!onBridge) {
      const br = BRIDGES.find(b => Math.abs(b.z - myLane.z) < 2.0) || nearestBridge(u.z);
      u.z += Math.sign(br.z - u.z) * speed * dt * 1.2;
    }
  }
  // Tree chop
  for (const t of STATE.forestTrees) {
    if (t.dead) continue;
    const dx2 = u.x - t.x, dz2 = u.z - t.z;
    const od = Math.hypot(dx2, dz2);
    const min = def.radius + t.radius;
    if (od < min && od > 0.01) {
      u.x += (dx2 / od) * (min - od);
      u.z += (dz2 / od) * (min - od);
      const cr = (def.roleKey === 'commander' || def.roleKey === 'tank' || def.roleKey === 'heavygunner') ? 90
        : (def.roleKey === 'swarm' && def.faction === 'cult') ? 70 : 25;
      damageTree(t, cr * dt);
    }
  }
}

function dist(a, b){ return Math.hypot(a.x - b.x, a.z - b.z); }
function findTarget(u){
  let best = null, bd = Infinity;
  const canG = u.def.targets === 'ground' || u.def.targets === 'ground_air';
  const canA = u.def.targets === 'air' || u.def.targets === 'ground_air';
  for (const e of STATE.units) {
    if (e.side === u.side || e.hp <= 0) continue;
    if (e.smoked > 0 && dist(u, e) > 3) continue;
    if (e.def.type === 'air' && !canA) continue;
    if (e.def.type === 'ground' && !canG) continue;
    const d = dist(u, e);
    if (d < bd) { bd = d; best = e; }
  }
  if (canG) {
    const eSide = u.side === 'player' ? 'enemy' : 'player';
    const turretDown = STATE.towers.some(t => t.side === eSide && t.role === 'turret' && t.hp <= 0);
    for (const t of STATE.towers) {
      if (t.side === u.side || t.hp <= 0) continue;
      if (t.role === 'hq' && !turretDown) continue;
      const d = dist(u, t);
      if (d < bd) { bd = d; best = t; }
    }
  }
  return best;
}
function findNearestEnemyForTower(t){
  // Pass-A: HQ has targets:'none' — skip it entirely
  if (!t.targets || t.targets === 'none') return null;
  let best = null, bs = -Infinity;
  const canG = t.targets === 'ground' || t.targets === 'ground_air';
  const canA = t.targets === 'air' || t.targets === 'ground_air';
  for (const u of STATE.units) {
    if (u.side === t.side || u.hp <= 0 || u.smoked > 0) continue;
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
  if (attacker && attacker.def && t.def) {
    // Role-vs-role multiplier (existing) + faction-vs-faction (Pass A)
    dmg *= getDmgMul(attacker.def.roleKey, t.def.roleKey);
    dmg *= getFactionVs(attacker.def.faction, t.def.faction);
  }
  if (t.aegis && t.aegis > 0) dmg *= 0.5;
  if (t.side === 'player') STATE.stats.dmgTaken += dmg;
  if (attacker && attacker.side === 'player') STATE.stats.dmgDealt += dmg;
  t.hp -= dmg;
  t.flash = 0.2;
  if (t.role === 'hq' && t.side === 'player' && dmg > 30) flashDamageOverlay();
  // Blood splatter for infantry
  const gore = getGore();
  if (t.def && t.def.type === 'ground' && !['tank','apc','lightV','artillery','aa'].includes(t.def.roleKey)) {
    const splats = Math.min(8, 1 + Math.floor(dmg / 40 * gore.bloodMul));
    for (let i = 0; i < splats; i++) {
      const ang = Math.random() * Math.PI * 2;
      addFX({ type:'splatter', x:t.x, y:0.9 + Math.random() * 0.3, z:t.z, t:0, dur:1.4,
        vx:Math.cos(ang) * (1 + Math.random() * 2.5),
        vy:1 + Math.random() * 2.5,
        vz:Math.sin(ang) * (1 + Math.random() * 2.5) });
    }
    if (t.maxHp && t.hp > 0 && t.hp / t.maxHp < 0.55) t.wounded = true;
    if (Math.random() < 0.6 * gore.bloodMul) addFX({ type:'mist', x:t.x, y:0.95, z:t.z, t:0, dur:0.4, scale:0.4 });
  }
  if (t.hp <= 0) {
    t.hp = 0;
    if (t.def) {
      if (t.side === 'enemy') STATE.stats.kills++;
      else if (t.side === 'player') STATE.stats.allyDeaths++;
      if (t.def.type === 'ground' && !['tank','apc','lightV','artillery','aa'].includes(t.def.roleKey)) {
        STATE.bloodIntensity = Math.min(1, STATE.bloodIntensity + 0.18 * gore.vignetteMul);
      }
    }
  }
}
function flashDamageOverlay(){
  const f = document.getElementById('damageFlash'); if (!f) return;
  f.style.opacity = '0.9';
  setTimeout(() => { f.style.transition = 'opacity 0.5s ease-out'; f.style.opacity = '0'; }, 30);
  setTimeout(() => { f.style.transition = ''; }, 600);
}
function effDmg(u){
  let m = u.effDmgMul || 1;   // faction dmg mod baked in
  if (u.buffed > 0) m *= 1.15;
  if (u.ritualBuff > 0) m *= 1.25;
  if (u.warCry > 0) m *= 1.3;
  if (u.berserk > 0) m *= 1.5;
  return u.def.dmg * m;
}

function safeSetTimeout(fn, ms){
  const mid = STATE.matchId;
  return setTimeout(() => { if (STATE.matchId !== mid || !STATE.running) return; try { fn(); } catch(e){} }, ms);
}


// ── WEAPONS / FIRE ─────────────────────────────────────────────────────
function fireWeapon(u, target){
  const def = u.def;
  u.recoil = 0.2;
  const mode = def.fire;
  // Get muzzle world position from bones if available
  const mesh = unitObjects.get(u.id);
  let mx = u.x, my = (def.type === 'air' ? 3 : 0.7), mz = u.z;
  if (mesh && mesh.userData.bones && mesh.userData.bones.muzzle) {
    const m = mesh.userData.bones.muzzle;
    m.updateWorldMatrix(true, false);
    const w = new THREE.Vector3();
    w.setFromMatrixPosition(m.matrixWorld);
    mx = w.x; my = w.y; mz = w.z;
  } else if (mesh && mesh.userData.bones && mesh.userData.bones.weapon && mesh.userData.bones.weapon.userData.muzzle) {
    const m = mesh.userData.bones.weapon.userData.muzzle;
    m.updateWorldMatrix(true, false);
    const w = new THREE.Vector3();
    w.setFromMatrixPosition(m.matrixWorld);
    mx = w.x; my = w.y; mz = w.z;
  }
  if (mode === 'burst2' || mode === 'burst3') {
    u.burstRemaining = mode === 'burst3' ? 3 : 2;
    u.burstTimer = 0;
    fireBurstShot(u, target);
  } else if (mode === 'shot') {
    STATE.projectiles.push({ id:nextId++, x:mx, y:my, z:mz, tx:target.x, tz:target.z, target, attacker:u, speed:28, kind:'bullet', dmg:effDmg(u), alive:true, tracer:true });
    addFX({ type:'muzzle', x:mx, y:my, z:mz, t:0, dur:0.12 });
    playSound('shot');
  } else if (mode === 'snipe') {
    applyDamage(target, effDmg(u), u);
    if (target.hp <= 0 && target.def && target.def.type === 'ground' && !['tank','apc','lightV','artillery','aa'].includes(target.def.roleKey)) target.snipeKill = true;
    addFX({ type:'beam', x:mx, y:my, z:mz, tx:target.x, tz:target.z, t:0, dur:0.4, color:0xfff088 });
    addFX({ type:'muzzle_big', x:mx, y:my, z:mz, t:0, dur:0.22 });
    playSound('snipe');
    triggerShake(0.1, 0.13);
  } else if (mode === 'minigun') {
    for (let i = 0; i < 5; i++) safeSetTimeout(() => { if (target.hp > 0) fireMinigunShot(u, target); }, i * 55);
  } else if (mode === 'flame') {
    for (let i = 0; i < 6; i++) {
      safeSetTimeout(() => {
        const ang = u.facing + (Math.random() - 0.5) * 0.4;
        const dx = Math.sin(ang), dz = Math.cos(ang);
        const px = u.x + dx * (1.2 + i * 0.55);
        const pz = u.z + dz * (1.2 + i * 0.55);
        addFX({ type:'flame', x:px, y:0.7, z:pz, t:0, dur:0.55 });
        for (const e of STATE.units) {
          if (e.side === u.side || e.hp <= 0) continue;
          if (Math.hypot(e.x - px, e.z - pz) < 1.0) applyDamage(e, effDmg(u) * 0.32, u);
        }
      }, i * 50);
    }
    playSound('flame');
  } else if (mode === 'grenade') {
    STATE.projectiles.push({ id:nextId++, x:mx, y:my, z:mz, tx:target.x, tz:target.z, attacker:u,
      speed:14, kind:'grenade', dmg:effDmg(u), splash:def.splash || 2.5, side:u.side, alive:true, arc:true, arcH:2.8, arcT:0 });
    playSound('grenade');
  } else if (mode === 'mgShot') {
    for (let i = 0; i < 2; i++) safeSetTimeout(() => {
      if (!target || target.hp <= 0) return;
      STATE.projectiles.push({ id:nextId++, x:mx, y:my, z:mz, tx:target.x, tz:target.z, target, attacker:u, speed:28, kind:'tracer', dmg:effDmg(u)/1.5, alive:true, tracer:true });
    }, i * 70);
    playSound('shot');
  } else if (mode === 'mgBurst') {
    for (let i = 0; i < 3; i++) safeSetTimeout(() => {
      if (!target || target.hp <= 0) return;
      STATE.projectiles.push({ id:nextId++, x:mx, y:my, z:mz, tx:target.x, tz:target.z, target, attacker:u, speed:28, kind:'tracer', dmg:effDmg(u)/2.5, alive:true, tracer:true });
    }, i * 60);
    playSound('chain');
  } else if (mode === 'cannon') {
    STATE.projectiles.push({ id:nextId++, x:mx, y:my, z:mz, tx:target.x, tz:target.z, target, attacker:u, speed:32, kind:'shell', dmg:effDmg(u), alive:true, tracer:true });
    addFX({ type:'muzzle_big', x:mx, y:my, z:mz, t:0, dur:0.25 });
    playSound('cannon');
    triggerShake(0.14, 0.2);
  } else if (mode === 'arc') {
    if (def.faction === 'mercs') {
      for (let i = 0; i < 4; i++) safeSetTimeout(() => {
        STATE.projectiles.push({ id:nextId++, x:mx + (i - 1.5) * 0.15, y:my, z:mz, attacker:u,
          tx:target.x + (Math.random() - 0.5) * 2, tz:target.z + (Math.random() - 0.5) * 2,
          speed:18, kind:'rocket', dmg:effDmg(u)/2.5, splash:def.splash * 0.65, side:u.side, alive:true, arc:true, arcH:3.5, arcT:0, trail:true });
      }, i * 120);
      playSound('rocket');
    } else if (def.faction === 'cult') {
      STATE.projectiles.push({ id:nextId++, x:mx, y:my, z:mz, tx:target.x, tz:target.z, target, attacker:u, speed:9, kind:'hex', dmg:effDmg(u), splash:def.splash, side:u.side, alive:true, homing:true, trail:true });
      playSound('mortar');
    } else {
      STATE.projectiles.push({ id:nextId++, x:mx, y:my, z:mz, tx:target.x, tz:target.z, attacker:u, speed:14, kind:'mortar_shell', dmg:effDmg(u), splash:def.splash, side:u.side, alive:true, arc:true, arcH:6.5, arcT:0, trail:true });
      addFX({ type:'muzzle_big', x:mx, y:my, z:mz, t:0, dur:0.28 });
      playSound('mortar');
    }
  } else if (mode === 'flak') {
    STATE.projectiles.push({ id:nextId++, x:mx, y:my, z:mz, tx:target.x, tz:target.z, target, attacker:u, speed:22, kind:'flak', dmg:effDmg(u), splash:1.6, side:u.side, alive:true, isFlak:true });
    addFX({ type:'muzzle', x:mx, y:my, z:mz, t:0, dur:0.15 });
    playSound('flak');
  } else if (mode === 'chain') {
    for (let i = 0; i < 3; i++) safeSetTimeout(() => {
      if (!target || target.hp <= 0) return;
      STATE.projectiles.push({ id:nextId++, x:mx + (Math.random() - 0.5) * 0.2, y:my, z:mz + (Math.random() - 0.5) * 0.2, tx:target.x, tz:target.z, target, attacker:u, speed:30, kind:'tracer', dmg:effDmg(u), alive:true, tracer:true });
    }, i * 40);
    playSound('chain');
  }
}
function fireBurstShot(u, target){
  if (!target || target.hp <= 0) return;
  const mesh = unitObjects.get(u.id);
  let mx = u.x, my = 0.7, mz = u.z;
  if (mesh && mesh.userData.bones && mesh.userData.bones.weapon && mesh.userData.bones.weapon.userData.muzzle) {
    const m = mesh.userData.bones.weapon.userData.muzzle;
    m.updateWorldMatrix(true, false);
    const w = new THREE.Vector3(); w.setFromMatrixPosition(m.matrixWorld);
    mx = w.x; my = w.y; mz = w.z;
  }
  STATE.projectiles.push({ id:nextId++, x:mx, y:my, z:mz, tx:target.x, tz:target.z, target, attacker:u, speed:28, kind:'bullet', dmg:effDmg(u), alive:true, tracer:true });
  addFX({ type:'muzzle', x:mx, y:my, z:mz, t:0, dur:0.08 });
  playSound('shot');
  u.burstRemaining--;
  u.burstTimer = 0.08;
}
function fireMinigunShot(u, target){
  if (!target || target.hp <= 0) return;
  const mesh = unitObjects.get(u.id);
  let mx = u.x, my = 0.95, mz = u.z;
  if (mesh && mesh.userData.bones && mesh.userData.bones.weapon && mesh.userData.bones.weapon.userData.muzzle) {
    const m = mesh.userData.bones.weapon.userData.muzzle;
    m.updateWorldMatrix(true, false);
    const w = new THREE.Vector3(); w.setFromMatrixPosition(m.matrixWorld);
    mx = w.x + (Math.random() - 0.5) * 0.18; my = w.y; mz = w.z + (Math.random() - 0.5) * 0.18;
  }
  STATE.projectiles.push({ id:nextId++, x:mx, y:my, z:mz, tx:target.x, tz:target.z, target, attacker:u, speed:30, kind:'tracer', dmg:effDmg(u)/2.5, alive:true, tracer:true });
  addFX({ type:'muzzle', x:mx, y:my, z:mz, t:0, dur:0.05 });
}
function fireTowerWeapon(t, target){
  t.cooldown = t.atkSpeed;
  const mesh = towerObjects.get(t.id);
  let mx = t.x, my = 2.5, mz = t.z;
  if (mesh && mesh.userData.bones && mesh.userData.bones.muzzle) {
    const m = mesh.userData.bones.muzzle;
    m.updateWorldMatrix(true, false);
    const w = new THREE.Vector3(); w.setFromMatrixPosition(m.matrixWorld);
    mx = w.x; my = w.y; mz = w.z;
  }
  if (t.type === 'mortar') {
    STATE.projectiles.push({ id:nextId++, x:mx, y:my, z:mz, tx:target.x, tz:target.z, speed:14, kind:'mortar_shell', dmg:t.dmg, splash:t.splash, side:t.side, alive:true, arc:true, arcH:5.5, arcT:0, trail:true });
    playSound('mortar');
  } else if (t.type === 'aa') {
    STATE.projectiles.push({ id:nextId++, x:mx, y:my, z:mz, tx:target.x, tz:target.z, target, speed:24, kind:'flak', dmg:t.dmg, splash:1.6, side:t.side, alive:true, isFlak:true });
    playSound('flak');
  } else if (t.role === 'hq') {
    STATE.projectiles.push({ id:nextId++, x:t.x, y:6.5, z:t.z, tx:target.x, tz:target.z, target, speed:30, kind:'tracer', dmg:t.dmg, alive:true, tracer:true });
    addFX({ type:'muzzle', x:t.x, y:6.5, z:t.z, t:0, dur:0.15 });
    playSound('shot');
  } else {
    STATE.projectiles.push({ id:nextId++, x:mx, y:my, z:mz, tx:target.x, tz:target.z, target, speed:28, kind:'tracer', dmg:t.dmg, alive:true, tracer:true });
    addFX({ type:'muzzle', x:mx, y:my, z:mz, t:0, dur:0.15 });
    playSound('shot');
  }
}
function explodeAt(x, y, z, dmg, splash, side, big){
  const Q = getQuality();
  addFX({ type:'flash', x, y, z, t:0, dur:0.18, size:splash });
  addFX({ type:'explosion', x, y, z, t:0, dur:big ? 1.0 : 0.7, size:splash });
  addFX({ type:'ring', x, y:0.1, z, t:0, dur:big ? 0.95 : 0.65, size:splash * 1.25 });
  if (big) addFX({ type:'ring', x, y:0.05, z, t:0, dur:1.3, size:splash * 1.85, color:0xff9040 });
  if (big || splash > 2) addCrater(x, z, Math.min(2.6, splash * 0.7));
  const sparkCount = Math.floor((big ? 24 : 12) * Q.particleMul);
  for (let i = 0; i < sparkCount; i++) {
    const ang = Math.random() * Math.PI * 2;
    addFX({ type:'spark', x, y:0.25, z, t:0, dur:0.85 + Math.random() * 0.4,
      vx:Math.cos(ang) * (2.2 + Math.random() * 4),
      vy:2.8 + Math.random() * 4.2, vz:Math.sin(ang) * (2.2 + Math.random() * 4) });
  }
  const debrisCount = Math.floor((big ? 14 : 6) * Q.particleMul);
  for (let i = 0; i < debrisCount; i++) {
    const ang = Math.random() * Math.PI * 2;
    addFX({ type:'debris', x, y:0.3, z, t:0, dur:1.5,
      vx:Math.cos(ang) * (2.2 + Math.random() * 3.2), vy:2.2 + Math.random() * 3.2, vz:Math.sin(ang) * (2.2 + Math.random() * 3.2),
      color:0x3a2a1c });
  }
  addFX({ type:'smoke', x, y:0.3, z, t:0, dur:big ? 2.6 : 1.6 });
  if (big) addFX({ type:'smoke', x:x + 0.5, y:0.5, z:z - 0.3, t:0, dur:2.0 });
  if (big && splash > 2) addFX({ type:'fire', x, y:0.5, z, t:0, dur:2.2 });
  playSound(big ? 'boom_big' : 'boom');
  triggerShake(big ? 0.45 : 0.16, big ? 0.45 : 0.2);
  for (const u of STATE.units) {
    if (u.hp <= 0) continue;
    if (side != null && u.side === side) continue;
    const d = Math.hypot(u.x - x, u.z - z);
    if (d <= splash) {
      const fall = Math.max(0.3, 1 - d / splash);
      applyDamage(u, dmg * fall);
      if (u.def.type === 'ground' && d > 0.01) {
        const push = (splash - d) * 0.32 * fall;
        u.x += ((u.x - x) / d) * push;
        u.z += ((u.z - z) / d) * push;
      }
    }
  }
  for (const t of STATE.towers) {
    if (side != null && t.side === side) continue;
    if (t.hp <= 0) continue;
    if (Math.hypot(t.x - x, t.z - z) <= splash + 0.5) applyDamage(t, dmg);
  }
  damageForestAt(x, z, dmg * 0.45, splash);
}
function addCrater(x, z, size){
  if (STATE.craters.length > 60) {
    const o = STATE.craters.shift();
    if (o && o.mesh) removeAndDispose(o.mesh);
  }
  const mesh = new THREE.Mesh(new THREE.CircleGeometry(size || 1, 20), basicMat(0x180c06, { transparent:true, opacity:0.7, depthWrite:false }));
  mesh.rotation.x = -Math.PI/2; mesh.position.set(x, 0.018, z);
  const inner = new THREE.Mesh(new THREE.CircleGeometry((size || 1) * 0.5, 14), basicMat(0x080402, { transparent:true, opacity:0.78, depthWrite:false }));
  inner.position.y = 0.005; mesh.add(inner);
  scene.add(mesh);
  STATE.craters.push({ x, z, mesh });
}
function triggerShake(mag, dur){ STATE.shake.t = dur || 0.3; STATE.shake.mag = Math.max(STATE.shake.mag, mag || 0.2); }


// ── FX (visuals) ────────────────────────────────────────────────────────
function addFX(fx){
  const Q = getQuality();
  if ((fx.type === 'spark' || fx.type === 'debris' || fx.type === 'splatter' || fx.type === 'chunk') && Math.random() > Q.particleMul) return;
  STATE.fx.push(fx);
  let m;
  if (fx.type === 'puff') m = new THREE.Mesh(new THREE.SphereGeometry(0.4, 8, 6), basicMat(0xc8b898, { transparent:true, opacity:0.85 }));
  else if (fx.type === 'explosion') m = new THREE.Mesh(new THREE.SphereGeometry(0.6, 12, 10), basicMat(0xff9040, { transparent:true, opacity:1 }));
  else if (fx.type === 'flash') m = new THREE.Mesh(new THREE.SphereGeometry(0.85, 12, 10), basicMat(0xffffff, { transparent:true, opacity:1 }));
  else if (fx.type === 'ring') {
    const c = fx.color || 0xffcc66;
    m = new THREE.Mesh(new THREE.RingGeometry(0.2, 0.42, 24), basicMat(c, { transparent:true, opacity:0.9, side:THREE.DoubleSide, depthWrite:false }));
    m.rotation.x = -Math.PI/2;
  }
  else if (fx.type === 'smoke') m = new THREE.Mesh(new THREE.SphereGeometry(0.3, 8, 6), basicMat(0x404040, { transparent:true, opacity:0.7 }));
  else if (fx.type === 'fire') m = new THREE.Mesh(new THREE.SphereGeometry(0.5, 9, 7), basicMat(0xff6020, { transparent:true, opacity:0.95 }));
  else if (fx.type === 'debris') {
    m = new THREE.Mesh(new THREE.DodecahedronGeometry(0.16 + Math.random() * 0.12, 0), basicMat(fx.color || 0x3a2a1c));
    m.rotation.set(Math.random()*Math.PI, Math.random()*Math.PI, Math.random()*Math.PI);
    fx.spin = (Math.random() - 0.5) * 10;
  }
  else if (fx.type === 'muzzle') m = new THREE.Mesh(new THREE.SphereGeometry(0.24, 8, 6), basicMat(0xffe888, { transparent:true, opacity:1 }));
  else if (fx.type === 'muzzle_big') m = new THREE.Mesh(new THREE.SphereGeometry(0.42, 8, 6), basicMat(0xffe888, { transparent:true, opacity:1 }));
  else if (fx.type === 'flame') m = new THREE.Mesh(new THREE.SphereGeometry(0.42, 8, 6), basicMat(0xff6020, { transparent:true, opacity:0.92 }));
  else if (fx.type === 'drop_marker') {
    m = new THREE.Mesh(new THREE.RingGeometry(0.85, 1.15, 22), basicMat(0xf0c060, { transparent:true, opacity:0.85, side:THREE.DoubleSide, depthWrite:false }));
    m.rotation.x = -Math.PI/2;
  }
  else if (fx.type === 'smoke_zone') {
    m = new THREE.Mesh(new THREE.CylinderGeometry(fx.radius, fx.radius, 2, 24, 1, true), basicMat(0x808080, { transparent:true, opacity:0.4, side:THREE.DoubleSide, depthWrite:false }));
    m.position.y = 1;
  }
  else if (fx.type === 'emp_pulse') {
    m = new THREE.Mesh(new THREE.RingGeometry(0.5, 0.85, 28), basicMat(0x80c0ff, { transparent:true, opacity:1, side:THREE.DoubleSide, depthWrite:false }));
    m.rotation.x = -Math.PI/2;
  }
  else if (fx.type === 'spark') m = new THREE.Mesh(new THREE.SphereGeometry(0.08, 5, 4), basicMat(0xffcc44));
  else if (fx.type === 'mist') m = new THREE.Mesh(new THREE.SphereGeometry(0.4, 12, 9), basicMat(0xa00808, { transparent:true, opacity:0.85, depthWrite:false }));
  else if (fx.type === 'chunk') {
    m = new THREE.Mesh(new THREE.DodecahedronGeometry(0.1 + Math.random() * 0.08, 0), basicMat(fx.color || 0xa03020));
    m.rotation.set(Math.random()*Math.PI, Math.random()*Math.PI, Math.random()*Math.PI);
    fx.spin = (Math.random() - 0.5) * 12;
  }
  else if (fx.type === 'splatter') {
    m = new THREE.Mesh(new THREE.SphereGeometry(0.06 + Math.random() * 0.04, 5, 4), basicMat(0x880808));
    fx.spin = (Math.random() - 0.5) * 6;
  }
  else if (fx.type === 'drip') m = new THREE.Mesh(new THREE.SphereGeometry(0.04, 5, 4), basicMat(0x660404));
  else if (fx.type === 'pool') {
    m = new THREE.Mesh(new THREE.CircleGeometry(fx.size || 0.5, 16), basicMat(0x4a0404, { transparent:true, opacity:0.85, depthWrite:false }));
    m.rotation.x = -Math.PI/2;
  }
  else if (fx.type === 'stain') {
    m = new THREE.Mesh(new THREE.CircleGeometry(fx.size || 0.12, 8), basicMat(0x3a0202, { transparent:true, opacity:0.75, depthWrite:false }));
    m.rotation.x = -Math.PI/2;
  }
  else if (fx.type === 'bones') {
    m = new THREE.Group();
    for (let i = 0; i < 4 + Math.floor(Math.random() * 3); i++) {
      const b = new THREE.Mesh(new THREE.CylinderGeometry(0.025, 0.025, 0.18 + Math.random() * 0.15, 5), basicMat(0xd8c8a8));
      b.position.set((Math.random() - 0.5) * 0.4, 0.02, (Math.random() - 0.5) * 0.4);
      b.rotation.set(Math.random() * 0.3, Math.random() * Math.PI, Math.PI / 2 + (Math.random() - 0.5) * 0.8);
      m.add(b);
    }
    const sk = new THREE.Mesh(new THREE.SphereGeometry(0.1, 8, 6), basicMat(0xe8dcc8));
    sk.position.set(0.1, 0.08, 0.1); m.add(sk);
  }
  else if (fx.type === 'limb') {
    m = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.07, 0.34, 6), basicMat(fx.color || 0xb0805a));
    m.rotation.set(Math.random()*Math.PI, Math.random()*Math.PI, Math.random()*Math.PI);
    fx.spin = (Math.random() - 0.5) * 14;
  }
  else if (fx.type === 'heal_beam') {
    const pts = [new THREE.Vector3(fx.x, 0.7, fx.z), new THREE.Vector3(fx.tx, 0.7, fx.tz)];
    m = new THREE.Line(new THREE.BufferGeometry().setFromPoints(pts), new THREE.LineBasicMaterial({ color:0x66ff88, transparent:true, opacity:0.9 }));
  }
  else if (fx.type === 'beam') {
    const pts = [new THREE.Vector3(fx.x, fx.y, fx.z), new THREE.Vector3(fx.tx, fx.y, fx.tz)];
    m = new THREE.Line(new THREE.BufferGeometry().setFromPoints(pts), new THREE.LineBasicMaterial({ color:fx.color || 0xfff0aa, transparent:true, opacity:1 }));
  }
  else if (fx.type === 'aura') {
    m = new THREE.Mesh(new THREE.RingGeometry(0.5, 0.6, 28), basicMat(0xf0e060, { transparent:true, opacity:0.55, side:THREE.DoubleSide, depthWrite:false }));
    m.rotation.x = -Math.PI/2;
  }
  if (m) {
    m.position.set(fx.x, fx.y || 0.1, fx.z);
    scene.add(m);
    fx.mesh = m;
    fxObjects.push(fx);
  }
}

// ── AI ──────────────────────────────────────────────────────────────────
let aiThinkTimer = 0;
let aiTeamTimers = {};
function updateAI(dt){
  if (!STATE.currentMission) return;
  const m = STATE.currentMission;
  const dm = DIFFICULTY[STATE.difficulty || 'normal'] || DIFFICULTY.normal;
  const speed = m.aiSpeed * dm.aiSpeedMul;
  const smart = Math.min(1, m.aiSmart * dm.aiSmartMul);
  aiThinkTimer -= dt;
  if (aiThinkTimer <= 0) {
    aiThinkTimer = (1.4 / speed) + Math.random() * 0.7;
    aiTakeTurn({ energy:STATE.enemyEnergy, hand:STATE.enemyHand, pool:STATE.enemyHandPool, cooldowns:STATE.enemyCooldowns, side:'enemy', factionKey:m.enemyFaction, smart,
      onSpend:(cost, ch)=>{ STATE.enemyEnergy -= cost; const i=STATE.enemyHand.indexOf(ch); if (i<0) return; STATE.enemyCooldowns[ch] = 2.0; if (STATE.enemyHandPool.length) { const n=STATE.enemyHandPool.shift(); STATE.enemyHandPool.push(ch); STATE.enemyHand[i] = n; } }
    });
  }
}
function aiTakeTurn(ctx){
  if (ctx.energy < 2) return;
  const aff = ctx.hand.filter(k => { const u = UNITS[k]; if (!u || unitCost(k) > ctx.energy) return false; if (ctx.cooldowns && ctx.cooldowns[k] > 0) return false; return true; });
  if (!aff.length) return;
  let choice = aff[Math.floor(Math.random() * aff.length)];
  if (Math.random() < ctx.smart) choice = pickCounter(aff, ctx) || choice;
  const lzs = [LANE_TOP_Z, LANE_MID_Z, LANE_BOT_Z];
  let laneZ = lzs[Math.floor(Math.random() * 3)];
  let fz = laneZ + (Math.random() - 0.5) * LANE_HALF * 0.5;
  let fx = ctx.side === 'enemy' ? FIELD_W/2 - 7 - Math.random() * 7 : -FIELD_W/2 + 7 + Math.random() * 7;
  if (Math.random() < ctx.smart) {
    const eSide = ctx.side === 'enemy' ? 'player' : 'enemy';
    let threat = null, bs = 0;
    for (const u of STATE.units) {
      if (u.side !== eSide || u.hp <= 0) continue;
      const oh = ctx.side === 'enemy' ? (u.x > -FIELD_W/2 * 0.5) : (u.x < FIELD_W/2 * 0.5);
      if (oh && u.def.cost > bs) { bs = u.def.cost; threat = u; }
    }
    if (threat) {
      const tl = getLaneForZ(threat.z);
      fz = tl.z + (Math.random() - 0.5) * LANE_HALF * 0.4;
      if (ctx.side === 'enemy') fx = Math.min(FIELD_W/2 - 2, Math.max(RIVER_HALF + 2, threat.x - 6 - Math.random() * 3));
      else fx = Math.max(-FIELD_W/2 + 2, Math.min(-RIVER_HALF - 2, threat.x + 6 + Math.random() * 3));
    }
  }
  ctx.onSpend(unitCost(choice), choice);
  spawnUnit(choice, ctx.side, fx, fz);
}
function pickCounter(aff, ctx){
  const ts = ctx.side === 'enemy' ? 'player' : 'enemy';
  const pp = STATE.units.filter(u => u.side === ts && u.hp > 0);
  if (!pp.length) return null;
  const hasAir = pp.some(u => u.def.type === 'air');
  const hasTank = pp.some(u => u.def.roleKey === 'tank' || u.def.roleKey === 'apc');
  const hasSwarm = pp.some(u => u.def.count > 1);
  const hasElite = pp.some(u => u.def.roleKey === 'commander');
  const fk = ctx.factionKey;
  if (hasAir && aff.includes(fk + '_aa')) return fk + '_aa';
  if (hasAir && aff.includes(fk + '_sniper')) return fk + '_sniper';
  if (hasTank && aff.includes(fk + '_artillery')) return fk + '_artillery';
  if (hasTank && aff.includes(fk + '_grenadier')) return fk + '_grenadier';
  if (hasTank && aff.includes(fk + '_tank')) return fk + '_tank';
  if (hasSwarm && aff.includes(fk + '_flamer')) return fk + '_flamer';
  if (hasSwarm && aff.includes(fk + '_heavygunner')) return fk + '_heavygunner';
  if (hasElite && aff.includes(fk + '_sniper')) return fk + '_sniper';
  return null;
}


// ── SYNC MESHES — animations, death, projectiles, FX ────────────────────
function syncMeshes(dt){
  const Q = getQuality();
  const gore = getGore();
  // Update water shader time
  if (waterUniforms) waterUniforms.time.value += dt;
  // Animate sun arc
  if (sunMesh) {
    sunMesh.position.x = Math.cos(performance.now() * 0.00005) * 80;
    sunMesh.position.z = 40 + Math.sin(performance.now() * 0.00005) * 30;
  }

  // ── Units (positions, animation, pip) ─────
  for (const u of STATE.units) {
    const mesh = unitObjects.get(u.id);
    if (!mesh) continue;
    if (u.deathStarted) {
      if (u.deathType === 'air') mesh.position.set(u.x, u.crashY != null ? u.crashY : 3.8, u.z);
      else if (u.deathType === 'vehicle') mesh.position.set(u.x, 0, u.z);
      else { mesh.position.x = u.x; mesh.position.z = u.z; }
      continue;
    }
    const yT = u.def.type === 'air' ? 3.8 : 0;
    mesh.position.set(u.x, yT, u.z);
    if (u.spawnAnim > 0) {
      const s = 1 - u.spawnAnim;
      mesh.scale.setScalar(Math.max(0.1, s));
      u.spawnAnim -= dt * 3;
      if (u.spawnAnim < 0) u.spawnAnim = 0;
    }
    // Air bob
    if (u.def.type === 'air') mesh.position.y = 3.8 + Math.sin(performance.now() * 0.003 + u.id) * 0.15;
    // Run animation system
    animateUnit(u, mesh, dt);
    // HP pip
    if (mesh.userData.pip) updatePip(mesh.userData.pip, u.hp, u.maxHp, u.side);
    // Hit flash halo
    if (u.flash > 0) {
      u.flash -= dt;
      mesh.position.x += (Math.random() - 0.5) * 0.04;
      mesh.position.z += (Math.random() - 0.5) * 0.04;
      if (!mesh.userData.hitHalo) {
        const halo = new THREE.Mesh(new THREE.RingGeometry(0.42, 0.58, 16), basicMat(0xff4040, { transparent:true, opacity:0.85, side:THREE.DoubleSide, depthWrite:false }));
        halo.rotation.x = -Math.PI/2; halo.position.y = 0.05;
        mesh.add(halo); mesh.userData.hitHalo = halo;
      }
      mesh.userData.hitHalo.material.opacity = u.flash * 3;
      mesh.userData.hitHalo.scale.setScalar(1 + (0.2 - u.flash) * 2);
    } else if (mesh.userData.hitHalo) {
      mesh.remove(mesh.userData.hitHalo);
      mesh.userData.hitHalo.material.dispose();
      mesh.userData.hitHalo.geometry.dispose();
      mesh.userData.hitHalo = null;
    }
    // Aura visual
    if (u.def.aura && u.hp > 0) {
      u.auraTimer = (u.auraTimer || 0) - dt;
      if (u.auraTimer <= 0) { u.auraTimer = 0.6; addFX({ type:'aura', x:u.x, y:0.1, z:u.z, t:0, dur:0.6, grow:true }); }
    }
  }
  // ── Trigger death animations
  for (const u of STATE.units) {
    if (u.hp <= 0 && !u.deathStarted) {
      u.deathStarted = true; u.dyingT = 0;
      const vehRoles = ['tank','apc','lightV','artillery','aa'];
      const isVeh = vehRoles.includes(u.def.roleKey);
      const isAir = u.def.type === 'air';
      const isElite = u.def.roleKey === 'commander';
      u.dyingDur = isVeh ? 5.5 : (isAir ? 3.5 : 4.0);
      u.deathType = isVeh ? 'vehicle' : (isAir ? 'air' : 'infantry');
      u.deathBig = isVeh && (u.def.roleKey === 'tank' || u.def.roleKey === 'artillery');
      if (u.deathType === 'vehicle') {
        explodeAt(u.x, 0.8, u.z, 0, u.deathBig ? 3.4 : 2.6, u.side, true);
        const dc = Math.floor((u.deathBig ? 18 : 12) * Q.particleMul);
        for (let i = 0; i < dc; i++) {
          const ang = Math.random() * Math.PI * 2;
          addFX({ type:'debris', x:u.x, y:0.6, z:u.z, t:0, dur:1.9,
            vx:Math.cos(ang) * (3 + Math.random() * 5), vy:3 + Math.random() * 5, vz:Math.sin(ang) * (3 + Math.random() * 5),
            color:Math.random() < 0.5 ? 0x3a2a20 : 0x101010 });
        }
        triggerShake(u.deathBig ? 0.85 : 0.65, 0.45);
        addCrater(u.x, u.z, u.deathBig ? 2.4 : 1.9);
      } else if (u.deathType === 'air') {
        u.crashVy = -2.2; u.crashVx = (Math.random() - 0.5) * 2.2;
        u.crashVz = (Math.random() - 0.5) * 2.2; u.crashSpin = (Math.random() - 0.5) * 4.5;
        addFX({ type:'smoke', x:u.x, y:3, z:u.z, t:0, dur:2.2 });
        addFX({ type:'fire', x:u.x, y:3, z:u.z, t:0, dur:1.1 });
      } else {
        // Infantry GORE
        addFX({ type:'explosion', x:u.x, y:0.6, z:u.z, t:0, dur:0.4, size:0.55 });
        const ps = (0.6 + Math.random() * 0.25) * (gore.bloodMul * 0.6 + 0.7);
        addFX({ type:'pool', x:u.x, y:0.025, z:u.z, t:0, dur:gore.poolDur, size:ps });
        addFX({ type:'mist', x:u.x, y:0.95, z:u.z, t:0, dur:0.85 });
        const cc = Math.floor((u.snipeKill ? 13 : 6 + Math.floor(Math.random() * 3)) * gore.chunkMul);
        for (let i = 0; i < cc; i++) {
          const ang = Math.random() * Math.PI * 2;
          addFX({ type:'chunk', x:u.x, y:0.75, z:u.z, t:0, dur:2.2,
            vx:Math.cos(ang) * (2.2 + Math.random() * 3), vy:2.2 + Math.random() * 3, vz:Math.sin(ang) * (2.2 + Math.random() * 3),
            color:Math.random() < 0.4 ? 0xe8dcc8 : 0xa03020 });
        }
        const sc = Math.floor(15 * gore.splatterMul);
        for (let i = 0; i < sc; i++) {
          const ang = Math.random() * Math.PI * 2;
          addFX({ type:'splatter', x:u.x, y:0.75, z:u.z, t:0, dur:1.6,
            vx:Math.cos(ang) * (2.2 + Math.random() * 3), vy:1.2 + Math.random() * 2.5, vz:Math.sin(ang) * (2.2 + Math.random() * 3) });
        }
        const lc = Math.max(0, Math.min(3, Math.floor(gore.chunkMul * 1.5)));
        for (let i = 0; i < lc; i++) {
          const ang = Math.random() * Math.PI * 2;
          addFX({ type:'limb', x:u.x, y:0.75, z:u.z, t:0, dur:2.6,
            vx:Math.cos(ang) * (1.6 + Math.random() * 2), vy:2.2 + Math.random() * 2, vz:Math.sin(ang) * (1.6 + Math.random() * 2),
            color:u.def.skin || 0xb0805a });
        }
        if (u.snipeKill) {
          for (let i = 0; i < 4; i++) addFX({ type:'mist', x:u.x + (Math.random() - 0.5) * 0.5, y:0.95 + i * 0.3, z:u.z + (Math.random() - 0.5) * 0.5, t:0, dur:1.5 });
          playSound('gore_big');
          STATE.bloodIntensity = Math.min(1, STATE.bloodIntensity + 0.32 * gore.vignetteMul);
        } else playSound('gore');
        u.bonesDropX = u.x; u.bonesDropZ = u.z;
        if (isElite) { addFX({ type:'flash', x:u.x, y:1, z:u.z, t:0, dur:0.32, size:1.6 }); triggerShake(0.32, 0.32); }
      }
      if (u.deathType !== 'infantry') playSound('boom');
    }
  }
  // Advance dying timers
  for (const u of STATE.units) {
    if (!u.deathStarted) continue;
    u.dyingT += dt;
    const mesh = unitObjects.get(u.id);
    if (!mesh) continue;
    if (u.deathType === 'vehicle') {
      mesh.rotation.z = Math.min(0.62, u.dyingT * 0.22);
      mesh.rotation.x = Math.min(0.18, u.dyingT * 0.045);
      if (Math.random() < dt * 8) addFX({ type:'fire', x:u.x + (Math.random()-0.5)*0.8, y:0.85 + Math.random()*0.3, z:u.z + (Math.random()-0.5)*0.8, t:0, dur:0.6 });
      if (Math.random() < dt * 12) addFX({ type:'smoke', x:u.x + (Math.random()-0.5)*0.6, y:1.4 + Math.random()*0.5, z:u.z + (Math.random()-0.5)*0.6, t:0, dur:1.8 });
      if (!u.cookOff1 && u.dyingT > 1.2) { u.cookOff1 = true; explodeAt(u.x, 0.95, u.z, 0, 1.9, u.side, false); triggerShake(0.25, 0.22); playSound('cook_off'); }
      if (!u.cookOff2 && u.dyingT > 2.6) { u.cookOff2 = true; explodeAt(u.x + 0.3, 1.2, u.z - 0.2, 0, 2.0, u.side, false); playSound('cook_off'); }
      if (u.deathBig && !u.cookOff3 && u.dyingT > 4.2) {
        u.cookOff3 = true;
        explodeAt(u.x, 1, u.z, 0, 3.4, u.side, true);
        triggerShake(0.7, 0.45); playSound('boom_big');
      }
      if (u.dyingT > u.dyingDur - 0.8) {
        const f = 1 - (u.dyingT - (u.dyingDur - 0.8)) / 0.8;
        mesh.traverse(o => { if (o.material && !o.userData.isOutline) { o.material.transparent = true; o.material.opacity = Math.max(0, f); } });
      }
    } else if (u.deathType === 'air') {
      u.x += u.crashVx * dt; u.z += u.crashVz * dt;
      u.crashY = (u.crashY != null ? u.crashY : 3.8) + u.crashVy * dt;
      u.crashVy -= 9.8 * dt;
      mesh.rotation.x += u.crashSpin * dt;
      mesh.rotation.z += u.crashSpin * 0.7 * dt;
      if (Math.random() < dt * 10) addFX({ type:'smoke', x:u.x, y:u.crashY, z:u.z, t:0, dur:1.1 });
      if (u.crashY < 0.3 && !u.crashed) {
        u.crashed = true;
        explodeAt(u.x, 0.5, u.z, 0, 3.2, u.side, true);
        addCrater(u.x, u.z, 1.6);
        triggerShake(0.6, 0.42); playSound('crash');
      }
    } else {
      // Infantry ragdoll
      if (u.dyingT < 0.4) {
        const t = u.dyingT / 0.4;
        mesh.rotation.x = -Math.PI / 2 * t;
        mesh.position.y = -0.3 * t;
      } else { mesh.rotation.x = -Math.PI / 2; mesh.position.y = -0.3; }
      if (Math.random() < dt * 3 * gore.bloodMul) {
        addFX({ type:'drip', x:u.x + (Math.random() - 0.5) * 0.3, y:0.4, z:u.z + (Math.random() - 0.5) * 0.3, t:0, dur:0.85, vy:-0.5 });
      }
      if (u.dyingT > u.dyingDur - 0.8) {
        const f = 1 - (u.dyingT - (u.dyingDur - 0.8)) / 0.8;
        mesh.traverse(o => { if (o.material && !o.userData.isOutline) { o.material.transparent = true; o.material.opacity = Math.max(0, f); } });
      }
    }
  }
  // Remove fully dead
  for (const u of STATE.units) {
    if (u.deathStarted && u.dyingT >= u.dyingDur) {
      const mesh = unitObjects.get(u.id);
      if (mesh) { removeAndDispose(mesh); unitObjects.delete(u.id); }
      if (u.deathType === 'infantry' && u.bonesDropX != null) {
        addFX({ type:'bones', x:u.bonesDropX, y:0.025, z:u.bonesDropZ, t:0, dur:Math.max(20, getGore().poolDur * 0.8) });
      }
      u.removed = true;
    }
  }
  STATE.units = STATE.units.filter(u => !u.removed);

  // ── Towers
  for (const t of STATE.towers) {
    const mesh = towerObjects.get(t.id);
    if (!mesh) continue;
    if (mesh.userData.tower && mesh.userData.tower.role === 'turret' && mesh.userData.bones && mesh.userData.bones.turret && t.hp > 0) {
      const nearest = findNearestEnemyForTower(t);
      if (nearest) {
        const tx = nearest.x - t.x, tz = nearest.z - t.z;
        const aimA = Math.atan2(tx, tz);
        const cur = mesh.userData.bones.turret.rotation.y;
        let diff = aimA - cur;
        while (diff > Math.PI) diff -= Math.PI * 2;
        while (diff < -Math.PI) diff += Math.PI * 2;
        mesh.userData.bones.turret.rotation.y = cur + diff * Math.min(1, dt * 3);
      }
    }
    if (mesh.userData.beacon) {
      const p = Math.sin(performance.now() * 0.004) * 0.2 + 0.95;
      mesh.userData.beacon.scale.setScalar(p);
    }
    if (mesh.userData.halo) {
      const p2 = Math.sin(performance.now() * 0.004 + 1) * 0.15 + 1;
      mesh.userData.halo.scale.setScalar(p2);
    }
    if (mesh.userData.pip) updatePip(mesh.userData.pip, t.hp, t.maxHp, t.side);
  }
  for (const t of STATE.towers.filter(x => x.hp <= 0 && !x.destroyed)) {
    t.destroyed = true;
    const mesh = towerObjects.get(t.id);
    if (mesh) { explodeAt(t.x, 1, t.z, 0, 2.2, t.side, true); removeAndDispose(mesh); towerObjects.delete(t.id); addCrater(t.x, t.z, 2.0); }
    updateTowerPips();
    if (t.role === 'turret') {
      showToast(t.side === 'player' ? 'LANE LOST! ENEMY CAN REACH HQ' : 'LANE BROKEN! ATTACK THE HQ');
      triggerShake(0.6, 0.5); playSound('lane_lost');
    }
    if (t.role === 'hq') {
      const mid = STATE.matchId;
      setTimeout(() => { if (STATE.matchId !== mid || !STATE.running) return; endMatch(t.side !== 'player'); }, 800);
    }
  }
  // ── Projectiles
  for (const p of STATE.projectiles) {
    if (!projObjects.has(p.id)) {
      let m;
      if (p.kind === 'bullet' || p.kind === 'tracer') {
        m = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.04, 0.55, 6), basicMat(0xfff088));
        m.rotation.x = Math.PI/2;
      } else if (p.kind === 'shell') {
        m = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.10, 0.40, 8), basicMat(0xc8b0a0));
        m.rotation.x = Math.PI/2;
      } else if (p.kind === 'mortar_shell') m = new THREE.Mesh(new THREE.SphereGeometry(0.20, 10, 8), toonMat(0x3a2a20));
      else if (p.kind === 'rocket') {
        m = new THREE.Group();
        const body = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.06, 0.4, 8), toonMat(0x202020));
        body.rotation.x = Math.PI/2; m.add(body);
        const tip = new THREE.Mesh(new THREE.ConeGeometry(0.07, 0.16, 8), toonMat(0xc44a2a));
        tip.rotation.x = Math.PI/2; tip.position.z = 0.28; m.add(tip);
      } else if (p.kind === 'hex') m = new THREE.Mesh(new THREE.SphereGeometry(0.28, 14, 10), basicMat(0xff2040));
      else if (p.kind === 'grenade') m = new THREE.Mesh(new THREE.SphereGeometry(0.13, 8, 6), toonMat(0x303030));
      else if (p.kind === 'flak') m = new THREE.Mesh(new THREE.SphereGeometry(0.13, 8, 6), basicMat(0xffcc44));
      else m = new THREE.Mesh(new THREE.SphereGeometry(0.1, 6, 5), basicMat(0xffffff));
      scene.add(m); projObjects.set(p.id, m);
    }
    const mesh = projObjects.get(p.id);
    mesh.position.set(p.x, p.y, p.z);
    if (p.kind === 'bullet' || p.kind === 'tracer' || p.kind === 'shell') mesh.lookAt(p.tx, p.y, p.tz);
  }
  for (const p of STATE.projectiles.filter(x => !x.alive)) {
    const m = projObjects.get(p.id);
    if (m) { removeAndDispose(m); projObjects.delete(p.id); }
  }
  STATE.projectiles = STATE.projectiles.filter(p => p.alive);
  // ── Trees fall
  for (const t of STATE.forestTrees) {
    if (!t.dead || !t.mesh) continue;
    if (t.mesh.userData.falling === undefined) continue;
    t.mesh.userData.falling += dt;
    const f = Math.min(1, t.mesh.userData.falling / 0.85);
    const ang = t.mesh.userData.fallDir;
    t.mesh.rotation.x = Math.cos(ang) * f * Math.PI/2;
    t.mesh.rotation.z = Math.sin(ang) * f * Math.PI/2;
    if (t.mesh.userData.falling > 1.6) {
      t.mesh.traverse(o => { if (o.isMesh && o.material) { if (!o.material.transparent) { o.material = o.material.clone(); o.material.transparent = true; } o.material.opacity = Math.max(0, o.material.opacity - dt * 1.5); } });
      if (t.mesh.userData.falling > 2.6) { removeAndDispose(t.mesh); t.mesh = null; }
    }
  }
  // ── FX update
  for (const fx of fxObjects) {
    fx.t += dt; const r = fx.t / fx.dur;
    if (!fx.mesh) continue;
    if (fx.type === 'puff') { fx.mesh.scale.setScalar(0.5 + r * 2); fx.mesh.material.opacity = Math.max(0, 0.85 - r); }
    else if (fx.type === 'explosion') {
      const s = (fx.size || 1) * (0.6 + r * 1.7);
      fx.mesh.scale.setScalar(s);
      fx.mesh.material.opacity = Math.max(0, 1 - r);
      if (r < 0.3) fx.mesh.material.color.setHex(0xffe0a0);
      else if (r < 0.6) fx.mesh.material.color.setHex(0xff8030);
      else fx.mesh.material.color.setHex(0xaa3008);
    }
    else if (fx.type === 'flash') {
      const s = (fx.size || 1) * (0.3 + r * 5);
      fx.mesh.scale.setScalar(s);
      fx.mesh.material.opacity = Math.max(0, 1 - r * 1.3);
    }
    else if (fx.type === 'fire') {
      const s = 0.4 + 0.4 * Math.sin(fx.t * 12) + r * 0.5;
      fx.mesh.scale.setScalar(s);
      fx.mesh.position.y = (fx.y || 0.5) + r * 0.6;
      fx.mesh.material.opacity = Math.max(0, 0.92 - r * 0.6);
      fx.mesh.material.color.setHSL(0.04 + Math.sin(fx.t * 20) * 0.02, 1, 0.55 - r * 0.1);
    }
    else if (fx.type === 'debris' || fx.type === 'chunk' || fx.type === 'limb') {
      fx.mesh.position.x += (fx.vx || 0) * dt;
      fx.mesh.position.y += (fx.vy || 0) * dt;
      fx.mesh.position.z += (fx.vz || 0) * dt;
      fx.vy = (fx.vy || 0) - 14 * dt;
      fx.mesh.rotation.x += (fx.spin || 0) * dt;
      fx.mesh.rotation.z += (fx.spin || 0) * 0.6 * dt;
      if (fx.mesh.position.y < 0.1) {
        fx.mesh.position.y = 0.1;
        if (Math.abs(fx.vy) > 0.6) { fx.vy = -fx.vy * 0.3; fx.vx *= 0.5; fx.vz *= 0.5; }
        else { fx.vy = 0; fx.vx = 0; fx.vz = 0; }
        if (!fx.stained && (fx.type === 'chunk' || fx.type === 'limb')) {
          fx.stained = true;
          addFX({ type:'stain', x:fx.mesh.position.x, y:0.025, z:fx.mesh.position.z, t:0, dur:getGore().stainDur, size:0.1 + Math.random() * 0.12 });
        }
      }
    }
    else if (fx.type === 'ring') { const s = (fx.size || 1) * (0.4 + r * 3); fx.mesh.scale.setScalar(s); fx.mesh.material.opacity = Math.max(0, 0.92 - r); }
    else if (fx.type === 'smoke') { fx.mesh.scale.setScalar(0.5 + r * 2.6); fx.mesh.position.y = 0.3 + r * 0.75; fx.mesh.material.opacity = Math.max(0, 0.7 - r * 0.7); }
    else if (fx.type === 'muzzle' || fx.type === 'muzzle_big') { fx.mesh.scale.setScalar(1 + r * 2); fx.mesh.material.opacity = Math.max(0, 1 - r * 2); }
    else if (fx.type === 'flame') { fx.mesh.scale.setScalar(0.5 + r * 1.6); fx.mesh.material.opacity = Math.max(0, 0.92 - r); fx.mesh.material.color.setHSL(0.05 - r * 0.05, 1, 0.55 - r * 0.2); }
    else if (fx.type === 'drop_marker') { fx.mesh.material.opacity = Math.max(0, 0.85 - r * 0.3); fx.mesh.rotation.z += dt * 2; }
    else if (fx.type === 'smoke_zone') fx.mesh.material.opacity = Math.max(0, 0.4 - r * 0.4);
    else if (fx.type === 'emp_pulse') { fx.mesh.scale.setScalar(1 + r * 8); fx.mesh.material.opacity = Math.max(0, 1 - r); }
    else if (fx.type === 'spark') {
      fx.mesh.position.x += (fx.vx || 0) * dt;
      fx.mesh.position.y += (fx.vy || 0) * dt;
      fx.mesh.position.z += (fx.vz || 0) * dt;
      fx.vy = (fx.vy || 0) - 10 * dt;
    }
    else if (fx.type === 'mist') {
      const s = (fx.scale || 1) * (0.4 + r * 2.3);
      fx.mesh.scale.setScalar(s);
      fx.mesh.material.opacity = Math.max(0, 0.85 - r * 0.85);
      fx.mesh.position.y = (fx.y || 1) + r * 0.3;
    }
    else if (fx.type === 'splatter') {
      fx.mesh.position.x += (fx.vx || 0) * dt;
      fx.mesh.position.y += (fx.vy || 0) * dt;
      fx.mesh.position.z += (fx.vz || 0) * dt;
      fx.vy = (fx.vy || 0) - 12 * dt;
      if (fx.mesh.position.y < 0.05) {
        addFX({ type:'stain', x:fx.mesh.position.x, y:0.025, z:fx.mesh.position.z, t:0, dur:getGore().stainDur, size:0.08 + Math.random() * 0.12 });
        fx.t = fx.dur;
      }
    }
    else if (fx.type === 'drip') {
      fx.mesh.position.y += (fx.vy || -1) * dt;
      fx.vy = (fx.vy || -1) - 10 * dt;
      if (fx.mesh.position.y < 0.05) { addFX({ type:'stain', x:fx.mesh.position.x, y:0.025, z:fx.mesh.position.z, t:0, dur:getGore().stainDur, size:0.06 + Math.random() * 0.06 }); fx.t = fx.dur; }
    }
    else if (fx.type === 'pool') { const grow = Math.min(1, fx.t * 2); fx.mesh.scale.setScalar(grow); fx.mesh.material.opacity = Math.max(0.3, 0.85 - r * 0.6); }
    else if (fx.type === 'stain') fx.mesh.material.opacity = Math.max(0.3, 0.78 - r * 0.45);
    else if (fx.type === 'bones') { if (r > 0.9) { const f = 1 - (r - 0.9) / 0.1; fx.mesh.traverse(o => { if (o.material) { o.material.transparent = true; o.material.opacity = f; } }); } }
    else if (fx.type === 'heal_beam' || fx.type === 'beam') fx.mesh.material.opacity = Math.max(0, 1 - r);
    else if (fx.type === 'aura') { const s = fx.grow ? 3 + r * 3 : 2; fx.mesh.scale.setScalar(s); fx.mesh.material.opacity = Math.max(0, 0.55 - r * 0.55); }
  }
  for (const fx of fxObjects.filter(f => f.t >= f.dur)) if (fx.mesh) removeAndDispose(fx.mesh);
  fxObjects = fxObjects.filter(f => f.t < f.dur);
  STATE.fx = fxObjects;
  // Deploy zone highlight
  if (deployZoneMesh) {
    const show = STATE.selectedCard && !POWERS[STATE.selectedCard];
    const tgt = show ? 0.16 : 0;
    deployZoneMesh.material.opacity += (tgt - deployZoneMesh.material.opacity) * Math.min(1, dt * 5);
  }
  if (rangePreviewMesh) {
    if (STATE.selectedCard && UNITS[STATE.selectedCard] && !POWERS[STATE.selectedCard]) {
      const def = UNITS[STATE.selectedCard];
      rangePreviewMesh.scale.setScalar(def.range || 8);
      rangePreviewMesh.position.x = lastPointerWorld.x;
      rangePreviewMesh.position.z = lastPointerWorld.z;
      rangePreviewMesh.material.opacity += (0.6 - rangePreviewMesh.material.opacity) * Math.min(1, dt * 6);
      const valid = lastPointerWorld.x < -RIVER_HALF - 1 && lastPointerWorld.x > -FIELD_W/2 + 3 && Math.abs(lastPointerWorld.z) < FIELD_D/2 - 1;
      rangePreviewMesh.material.color.setHex(valid ? 0x80c0ff : 0xff7060);
    } else {
      rangePreviewMesh.material.opacity += (0 - rangePreviewMesh.material.opacity) * Math.min(1, dt * 6);
    }
  }
  drawMinimap();
  tickAbilityHUD();
  // Selection ring under selected unit
  if (SELECTED_UNIT && SELECTED_UNIT.hp > 0) {
    const u = SELECTED_UNIT;
    if (!STATE._selRing) {
      const ring = new THREE.Mesh(
        new THREE.RingGeometry(0.85, 1.05, 28),
        new THREE.MeshBasicMaterial({ color:0xf0c060, transparent:true, opacity:0.9, side:THREE.DoubleSide, depthWrite:false })
      );
      ring.rotation.x = -Math.PI/2;
      scene.add(ring);
      STATE._selRing = ring;
    }
    STATE._selRing.position.set(u.x, 0.08, u.z);
    STATE._selRing.scale.setScalar(1 + Math.sin(performance.now() * 0.005) * 0.06);
    STATE._selRing.material.opacity = 0.7 + Math.sin(performance.now() * 0.005) * 0.2;
  } else if (STATE._selRing) {
    removeAndDispose(STATE._selRing);
    STATE._selRing = null;
  }
  // Vignette
  if (STATE.bloodIntensity > 0) {
    STATE.bloodIntensity = Math.max(0, STATE.bloodIntensity - dt * 0.25);
    const v = document.getElementById('vignette');
    if (v) v.style.opacity = String(Math.min(0.85, STATE.bloodIntensity));
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


// ── UPDATE LOOP ─────────────────────────────────────────────────────────
function update(dt) {
  if (!STATE.running || STATE.paused) return;
  // Energy ramp
  const elapsed = 180 - STATE.timer;
  let mul = 1;
  if (elapsed >= 180) mul = 5;
  else if (elapsed >= 150) mul = 3;
  else if (elapsed >= 120) mul = 2;
  STATE.energyMul = mul;
  // Faction energy multipliers (Pass A) — Mercs regen +10%
  const pFM = getFactionMod(STATE.progress.playerFaction);
  const eFM = STATE.currentMission ? getFactionMod(STATE.currentMission.enemyFaction) : { energyMul:1 };
  STATE.energy = Math.min(STATE.maxEnergy, STATE.energy + STATE.energyRate * mul * dt * pFM.energyMul);
  STATE.enemyEnergy = Math.min(STATE.maxEnergy, STATE.enemyEnergy + STATE.energyRate * mul * dt * eFM.energyMul);
  STATE.timer -= dt;
  // Cooldowns
  if (STATE.cardCooldowns) {
    let any = false;
    for (const k of Object.keys(STATE.cardCooldowns)) {
      STATE.cardCooldowns[k] -= dt;
      if (STATE.cardCooldowns[k] <= 0) { delete STATE.cardCooldowns[k]; any = true; }
    }
    if (any) renderHand();
  }
  if (STATE.enemyCooldowns) for (const k of Object.keys(STATE.enemyCooldowns)) {
    STATE.enemyCooldowns[k] -= dt;
    if (STATE.enemyCooldowns[k] <= 0) delete STATE.enemyCooldowns[k];
  }
  if (STATE.timer <= 0 && !STATE.overtime) {
    STATE.overtime = true;
    showToast('SUDDEN DEATH — x5 ENERGY');
    playSound('siren');
  }
  updateAI(dt);
  updateFactionPassives(dt);
  // Commander aura
  for (const c of STATE.units) {
    if (!c.def.aura || c.hp <= 0) continue;
    for (const a of STATE.units) {
      if (a.side !== c.side || a === c || a.hp <= 0) continue;
      if (dist(c, a) < 4.6) a.buffed = 0.5;
    }
  }
  // Per-unit
  for (const u of STATE.units) {
    if (u.hp <= 0) continue;
    if (u.buffed > 0) u.buffed -= dt;
    if (u.warCry > 0) u.warCry -= dt;
    if (u.berserk > 0) u.berserk -= dt;
    if (u.aegis > 0) u.aegis -= dt;
    if (u.abCD > 0) u.abCD = Math.max(0, u.abCD - dt);
    if (u.stunned > 0) { u.stunned -= dt; u.moving = false; continue; }
    if (u.smoked > 0) u.smoked -= dt;
    if (u.wounded && u.def.type === 'ground' && !['tank','apc','lightV','artillery','aa'].includes(u.def.roleKey)) {
      const gore = getGore();
      if (Math.random() < dt * 2.5 * gore.bloodMul) addFX({ type:'drip', x:u.x + (Math.random() - 0.5) * 0.2, y:0.5, z:u.z + (Math.random() - 0.5) * 0.2, t:0, dur:0.85, vy:-0.5 });
    }
    if (u.burstRemaining > 0) {
      u.burstTimer -= dt;
      if (u.burstTimer <= 0 && u.target && u.target.hp > 0) fireBurstShot(u, u.target);
    }
    if (u.def.fire === 'heal') {
      u.moving = false;
      if (u.cooldown > 0) u.cooldown -= dt;
      let wd = Infinity, wounded = null;
      for (const a of STATE.units) {
        if (a.side !== u.side || a === u || a.hp <= 0 || a.hp >= a.maxHp * 0.95) continue;
        const d = dist(u, a);
        if (d < wd) { wd = d; wounded = a; }
      }
      if (wounded) {
        const eR = u.effRange || u.def.range;
        if (wd > eR - 0.5) moveToward(u, wounded, dt);
        else if (u.cooldown <= 0) {
          wounded.hp = Math.min(wounded.maxHp, wounded.hp + u.def.heal);
          addFX({ type:'heal_beam', x:u.x, z:u.z, tx:wounded.x, tz:wounded.z, t:0, dur:0.45 });
          playSound('heal');
          u.cooldown = u.def.atkSpeed;
        }
      } else {
        const eHQ = STATE.towers.find(t => t.role === 'hq' && t.side !== u.side);
        if (eHQ) moveToward(u, eHQ, dt);
      }
      continue;
    }
    const eRange = u.effRange || u.def.range;
    if (!u.target || u.target.hp <= 0 || dist(u, u.target) > eRange + 5) u.target = findTarget(u);
    if (u.cooldown > 0) u.cooldown -= dt;
    if (u.target) {
      const d = dist(u, u.target);
      if (d <= eRange) {
        u.moving = false;
        if (u.cooldown <= 0 && u.burstRemaining <= 0) {
          fireWeapon(u, u.target);
          u.cooldown = u.def.atkSpeed;
        }
      } else moveToward(u, u.target, dt);
    } else {
      const eHQ = STATE.towers.find(t => t.role === 'hq' && t.side !== u.side);
      if (eHQ) moveToward(u, eHQ, dt);
    }
  }
  // Towers
  for (const t of STATE.towers) {
    if (t.hp <= 0) continue;
    if (t.stunned > 0) { t.stunned -= dt; continue; }
    if (t.cooldown > 0) t.cooldown -= dt;
    if (t.windupTimer > 0) t.windupTimer -= dt;
    const tg = findNearestEnemyForTower(t);
    if (!tg) {
      // Lost target → reset windup so the next target gets a fresh delay
      t.lastTargetId = null;
      continue;
    }
    // Fresh target appeared → trigger wind-up
    if (t.lastTargetId !== tg.id) {
      t.lastTargetId = tg.id;
      t.windupTimer = t.windup || 0;
    }
    if (dist(t, tg) <= t.range && t.cooldown <= 0 && t.windupTimer <= 0) {
      fireTowerWeapon(t, tg);
    }
  }
  // Projectiles
  for (const p of STATE.projectiles) {
    if (!p.alive) continue;
    if (p.arc) {
      p.arcT += dt;
      const tT = Math.hypot(p.tx - p.x, p.tz - p.z) / p.speed;
      if (!p.startX) { p.startX = p.x; p.startZ = p.z; p.totalT = tT; }
      const f = Math.min(1, p.arcT / p.totalT);
      p.x = p.startX + (p.tx - p.startX) * f;
      p.z = p.startZ + (p.tz - p.startZ) * f;
      p.y = 0.5 + Math.sin(f * Math.PI) * p.arcH;
      if (p.trail && Math.random() < 0.6) addFX({ type:'smoke', x:p.x, y:p.y, z:p.z, t:0, dur:0.4 });
      if (f >= 1) { explodeAt(p.tx, 0.3, p.tz, p.dmg, p.splash || 2.5, p.side); p.alive = false; }
    } else if (p.homing && p.target && p.target.hp > 0) {
      const dx = p.target.x - p.x, dz = p.target.z - p.z;
      const d = Math.hypot(dx, dz);
      if (d < 0.6) { explodeAt(p.target.x, 0.5, p.target.z, p.dmg, p.splash || 2.5, p.side); p.alive = false; }
      else {
        p.x += (dx/d) * p.speed * dt;
        p.z += (dz/d) * p.speed * dt;
        p.y = 1.6;
        if (p.trail && Math.random() < 0.8) addFX({ type:'spark', x:p.x, y:p.y, z:p.z, t:0, dur:0.4, vx:(Math.random()-0.5)*0.5, vy:0.2, vz:(Math.random()-0.5)*0.5 });
      }
    } else if (p.isFlak && p.target && p.target.hp > 0) {
      const ty = 3.5;
      const dx = p.target.x - p.x, dy = ty - p.y, dz = p.target.z - p.z;
      const d = Math.hypot(dx, dy, dz);
      if (d < 0.7) {
        addFX({ type:'explosion', x:p.target.x, y:3.2, z:p.target.z, t:0, dur:0.5, size:1.3 });
        for (const u of STATE.units) {
          if (u.side === p.side || u.hp <= 0 || u.def.type !== 'air') continue;
          if (dist(u, p.target) < 2.1) applyDamage(u, p.dmg, p.attacker);
        }
        p.alive = false;
      } else {
        p.x += (dx/d) * p.speed * dt;
        p.y += (dy/d) * p.speed * dt;
        p.z += (dz/d) * p.speed * dt;
      }
    } else if (p.target) {
      const ty = p.target.def && p.target.def.type === 'air' ? 3.5 : (p.target.role === 'hq' ? 4 : 0.7);
      const dx = p.target.x - p.x, dy = ty - p.y, dz = p.target.z - p.z;
      const d = Math.hypot(dx, dy, dz);
      if (d < 0.5) {
        applyDamage(p.target, p.dmg, p.attacker);
        if (p.kind === 'shell') explodeAt(p.target.x, 0.5, p.target.z, 0, 1.3, p.side, false);
        else addFX({ type:'spark', x:p.x, y:p.y, z:p.z, t:0, dur:0.3, vx:(Math.random()-0.5)*2, vy:1.5, vz:(Math.random()-0.5)*2 });
        p.alive = false;
      } else {
        p.x += (dx/d) * p.speed * dt;
        p.y += (dy/d) * p.speed * dt;
        p.z += (dz/d) * p.speed * dt;
        if (p.tracer && Math.random() < 0.3) addFX({ type:'spark', x:p.x, y:p.y, z:p.z, t:0, dur:0.15, vx:0, vy:0, vz:0 });
      }
    } else p.alive = false;
  }
  updateHUD();
}

// ── POWERS ─────────────────────────────────────────────────────────────
function triggerPower(key, x, z) {
  const p = POWERS[key]; if (!p || STATE.energy < p.cost) return false;
  STATE.energy -= p.cost;
  if (key === 'airstrike') {
    for (let i = 0; i < 3; i++) {
      const ox = x + (i - 1) * 1.6;
      addFX({ type:'drop_marker', x:ox, z, y:0.1, t:0, dur:0.85 });
      safeSetTimeout(() => explodeAt(ox, 0.3, z, 130, 2.6, 'player', true), i * 350);
    }
    playSound('siren');
  } else if (key === 'heal') {
    addFX({ type:'ring', x, y:0.1, z, t:0, dur:1.2, size:5, color:0x66ff88 });
    let n = 0;
    for (const u of STATE.units) {
      if (u.side !== 'player' || u.hp <= 0) continue;
      if (Math.hypot(u.x - x, u.z - z) < 5) {
        u.hp = Math.min(u.maxHp, u.hp + u.maxHp * 0.4);
        addFX({ type:'spark', x:u.x, y:1.2, z:u.z, t:0, dur:0.65, vx:(Math.random()-0.5)*1.5, vy:2.5, vz:(Math.random()-0.5)*1.5 });
        n++;
      }
    }
    if (n > 0) showToast('HEALED ' + n);
    playSound('heal');
  } else if (key === 'emp') {
    addFX({ type:'emp_pulse', x, y:0.2, z, t:0, dur:0.65 });
    for (const u of STATE.units) if (u.side === 'enemy' && dist(u, { x, z }) < 5) u.stunned = 3;
    playSound('emp');
  } else if (key === 'rebels_warcry') {
    let n = 0;
    for (const u of STATE.units) if (u.side === 'player' && u.hp > 0) { u.warCry = 6; addFX({ type:'spark', x:u.x, y:1.2, z:u.z, t:0, dur:0.5, vx:(Math.random()-0.5)*2, vy:2, vz:(Math.random()-0.5)*2 }); n++; }
    showToast('WAR CRY — ' + n + ' BUFFED');
    playSound('passive_cue');
  } else if (key === 'rebels_scrapbomb') {
    addFX({ type:'drop_marker', x, z, y:0.1, t:0, dur:0.95 });
    safeSetTimeout(() => { explodeAt(x, 0.4, z, 400, 5.2, 'player', true); triggerShake(0.85, 0.6); }, 850);
    playSound('siren');
  } else if (key === 'rebels_trench') {
    showToast('TRENCH LINE'); playSound('deploy');
    // For simplicity, just heal nearby allies (placeholder; obstacles system is heavier)
    for (const u of STATE.units) if (u.side === 'player' && Math.hypot(u.x - x, u.z - z) < 4) u.aegis = 6;
  } else if (key === 'empire_artillery') {
    for (let i = 0; i < 5; i++) {
      const ox = x + (Math.random() - 0.5) * 4, oz = z + (Math.random() - 0.5) * 4;
      addFX({ type:'drop_marker', x:ox, z:oz, y:0.1, t:0, dur:Math.max(0.6, i * 0.7) });
      safeSetTimeout(() => explodeAt(ox, 0.3, oz, 115, 2.3, 'player', false), i * 700);
    }
    playSound('mortar');
  } else if (key === 'empire_shield') {
    for (const u of STATE.units) if (u.side === 'player' && u.hp > 0) u.aegis = 5;
    addFX({ type:'ring', x:0, y:0.1, z:0, t:0, dur:1.5, size:18, color:0xaaddff });
    showToast('AEGIS — 50% DMG REDUCTION');
    playSound('passive_cue');
  } else if (key === 'empire_parade') {
    const fk = STATE.progress.playerFaction, k2 = fk + '_rifleman';
    if (UNITS[k2]) { spawnUnit(k2, 'player', x - 0.9, z); spawnUnit(k2, 'player', x + 0.9, z); showToast('REINFORCEMENTS'); }
    playSound('deploy');
  } else if (key === 'mercs_smoke') {
    addFX({ type:'smoke_zone', x, y:0.1, z, t:0, dur:4, radius:2.6 });
    for (const u of STATE.units) if (u.side === 'enemy' && dist(u, { x, z }) < 2.6) u.smoked = 4;
    playSound('ui_click');
  } else if (key === 'mercs_droneswarm') {
    for (let i = 0; i < 4; i++) {
      const ox = x + (Math.random()-0.5)*5, oz = z + (Math.random()-0.5)*5;
      addFX({ type:'drop_marker', x:ox, z:oz, y:0.1, t:0, dur:1.6 });
      safeSetTimeout(() => explodeAt(ox, 0.3, oz, 110, 2.2, 'player', true), 300 + i * 400);
    }
    showToast('DRONE SWARM'); playSound('chain');
  } else if (key === 'mercs_hack') {
    let n = 0;
    for (const t of STATE.towers) if (t.side === 'enemy' && t.role === 'turret' && t.hp > 0 && Math.hypot(t.x - x, t.z - z) < 12) { t.stunned = 6; addFX({ type:'emp_pulse', x:t.x, y:2.4, z:t.z, t:0, dur:0.6 }); n++; }
    showToast(n > 0 ? 'HACKED ' + n + ' TURRETS' : 'NO TURRETS IN RANGE');
    playSound('emp');
  } else if (key === 'cult_curse') {
    addFX({ type:'ring', x, y:0.1, z, t:0, dur:1.2, size:5, color:0xff2040 });
    let n = 0;
    for (const u of STATE.units) if (u.side === 'enemy' && u.hp > 0 && Math.hypot(u.x - x, u.z - z) < 5) { applyDamage(u, u.maxHp * 0.4); addFX({ type:'spark', x:u.x, y:1.2, z:u.z, t:0, dur:0.85, vx:(Math.random()-0.5)*3, vy:3, vz:(Math.random()-0.5)*3 }); n++; }
    if (n > 0) showToast('CURSED ' + n);
    playSound('ritual');
  } else if (key === 'cult_berserk') {
    let n = 0;
    for (const u of STATE.units) if (u.side === 'player' && u.hp > 0 && Math.hypot(u.x - x, u.z - z) < 5) { u.berserk = 5; n++; }
    showToast('BLOOD FRENZY — ' + n);
    playSound('passive_cue');
  } else if (key === 'cult_summon') {
    const fk = STATE.progress.playerFaction, k2 = fk + '_commander';
    if (UNITS[k2]) {
      spawnUnit(k2, 'player', x, z);
      const u = STATE.units[STATE.units.length - 1];
      if (u) { u.hp = u.maxHp = u.maxHp * 1.2; u.ritualBuff = 15; }
      showToast('SUMMONED');
    }
    playSound('ritual');
  }
  return true;
}
// ── ACTIVE ABILITIES — click a deployed unit, then trigger its ability ─
// One ability per role. Each has a cooldown stored on the unit (u.abCD).
const UNIT_ABILITIES = {
  rifleman:    { name:'Suppressing Fire',   cd:14, desc:'Triple-burst shot at next target', sfx:'burst3', icon:'⫶' },
  scout:       { name:'Sprint',             cd:12, desc:'+80% speed for 5s',                sfx:'ui_select', icon:'»' },
  swarm:       { name:'Rallying Howl',      cd:18, desc:'Heal 30% to all swarm allies',     sfx:'heal', icon:'⚒' },
  sniper:      { name:'Aimed Shot',         cd:16, desc:'Instant 600 dmg to current target',sfx:'snipe', icon:'◎' },
  heavygunner: { name:'Bracing',            cd:14, desc:'-50% dmg taken, +30% fire rate 5s',sfx:'minigun', icon:'■' },
  flamer:      { name:'Inferno',            cd:18, desc:'Wide cone, 3x damage 4s',          sfx:'flame', icon:'▲' },
  grenadier:   { name:'Cluster Volley',     cd:18, desc:'5 grenades scatter at target',     sfx:'grenade', icon:'◉' },
  lightV:      { name:'Boost',              cd:12, desc:'+100% speed for 4s',               sfx:'ability_fire', icon:'»' },
  apc:         { name:'Smoke Vent',         cd:16, desc:'Drops smoke, allies near get cover',sfx:'ui_select', icon:'☁' },
  tank:        { name:'HEAT Round',         cd:20, desc:'Triple-damage shell, big splash',  sfx:'cannon', icon:'★' },
  artillery:   { name:'Barrage',            cd:24, desc:'5 shells at target area',          sfx:'mortar', icon:'☄' },
  aa:          { name:'Lock-On',            cd:14, desc:'+200% damage, instant fire 6s',    sfx:'flak', icon:'⌖' },
  medic:       { name:'Field Triage',       cd:18, desc:'Heal all allies in 6m to full',    sfx:'heal', icon:'✚' },
  gunship:     { name:'Strafe Run',         cd:18, desc:'Spray 8 rockets in cone',          sfx:'rocket', icon:'≪' },
  commander:   { name:'Rally Cry',          cd:22, desc:'+50% dmg to all allies for 8s',    sfx:'passive_cue', icon:'★' },
};
function getUnitAbility(u) {
  if (!u || !u.def) return null;
  return UNIT_ABILITIES[u.def.roleKey] || null;
}
let SELECTED_UNIT = null;   // currently selected deployed unit

function pickUnitAtScreen(x, y) {
  // Find the closest player unit whose mesh intersects the click ray.
  const c = document.getElementById('threeContainer');
  const r = c.getBoundingClientRect();
  pointer.x = ((x - r.left) / r.width) * 2 - 1;
  pointer.y = -((y - r.top) / r.height) * 2 + 1;
  raycaster.setFromCamera(pointer, camera);
  let bestU = null, bestD = Infinity;
  for (const u of STATE.units) {
    if (u.side !== 'player' || u.hp <= 0 || u.deathStarted) continue;
    const mesh = unitObjects.get(u.id); if (!mesh) continue;
    // Test against an invisible bounding sphere centered on unit
    const cy = u.def.type === 'air' ? 3.8 : 0.9;
    const sphere = new THREE.Sphere(new THREE.Vector3(u.x, cy, u.z), Math.max(0.7, u.def.radius * 1.6));
    if (raycaster.ray.intersectsSphere(sphere)) {
      const d = raycaster.ray.origin.distanceTo(sphere.center);
      if (d < bestD) { bestD = d; bestU = u; }
    }
  }
  return bestU;
}
function selectUnit(u) {
  if (SELECTED_UNIT === u) return;
  SELECTED_UNIT = u;
  renderAbilityHUD();
  if (u) playSound('ui_select');
}
function fireUnitAbility() {
  const u = SELECTED_UNIT;
  if (!u || u.hp <= 0) return;
  const ab = getUnitAbility(u); if (!ab) return;
  if ((u.abCD || 0) > 0) { showToast('ABILITY ON CD'); return; }
  u.abCD = ab.cd;
  playSound(ab.sfx || 'ability_fire');
  // Visual ping
  addFX({ type:'ring', x:u.x, y:0.1, z:u.z, t:0, dur:0.6, size:2, color:0xf0c060 });
  // Apply effect
  const r = u.def.roleKey;
  if (r === 'rifleman') { u.burstRemaining = 5; u.burstTimer = 0; if (u.target && u.target.hp > 0) fireBurstShot(u, u.target); }
  else if (r === 'scout' || r === 'lightV') { u.warCry = 5; }
  else if (r === 'swarm') {
    let n = 0;
    for (const a of STATE.units) if (a.side === 'player' && a.def.roleKey === 'swarm' && a.hp > 0) { a.hp = Math.min(a.maxHp, a.hp + a.maxHp * 0.3); addFX({ type:'spark', x:a.x, y:1, z:a.z, t:0, dur:0.5, vx:0, vy:1.5, vz:0 }); n++; }
    showToast('RALLIED ' + n);
  }
  else if (r === 'sniper') {
    if (u.target && u.target.hp > 0) {
      applyDamage(u.target, 600, u);
      addFX({ type:'beam', x:u.x, y:0.9, z:u.z, tx:u.target.x, tz:u.target.z, t:0, dur:0.5, color:0xff4040 });
      triggerShake(0.2, 0.18);
    }
  }
  else if (r === 'heavygunner') { u.aegis = 5; u.warCry = 5; }
  else if (r === 'flamer') {
    // Wide cone burst
    for (let i = 0; i < 12; i++) {
      const ang = u.facing + (Math.random() - 0.5) * 0.9;
      const dx = Math.sin(ang), dz = Math.cos(ang);
      const px = u.x + dx * (1 + Math.random() * 4), pz = u.z + dz * (1 + Math.random() * 4);
      addFX({ type:'flame', x:px, y:0.6, z:pz, t:0, dur:0.8 });
      for (const e of STATE.units) {
        if (e.side === u.side || e.hp <= 0) continue;
        if (Math.hypot(e.x - px, e.z - pz) < 1.4) applyDamage(e, effDmg(u) * 0.95, u);
      }
    }
    triggerShake(0.18, 0.25);
  }
  else if (r === 'grenadier') {
    const tx = u.target ? u.target.x : u.x + Math.sin(u.facing) * 8;
    const tz = u.target ? u.target.z : u.z + Math.cos(u.facing) * 8;
    for (let i = 0; i < 5; i++) {
      const ox = tx + (Math.random() - 0.5) * 4;
      const oz = tz + (Math.random() - 0.5) * 4;
      safeSetTimeout(() => explodeAt(ox, 0.3, oz, 110, 2.4, u.side, false), i * 150);
    }
    showToast('CLUSTER VOLLEY');
  }
  else if (r === 'apc') {
    addFX({ type:'smoke_zone', x:u.x, y:0.1, z:u.z, t:0, dur:5, radius:3 });
    for (const a of STATE.units) if (a.side === 'player' && Math.hypot(a.x - u.x, a.z - u.z) < 3) a.aegis = 5;
  }
  else if (r === 'tank') {
    if (u.target && u.target.hp > 0) {
      applyDamage(u.target, effDmg(u) * 3, u);
      explodeAt(u.target.x, 0.5, u.target.z, effDmg(u), 3.0, u.side, true);
      triggerShake(0.4, 0.3);
    }
  }
  else if (r === 'artillery') {
    const tx = u.target ? u.target.x : u.x + Math.sin(u.facing) * 12;
    const tz = u.target ? u.target.z : u.z + Math.cos(u.facing) * 12;
    for (let i = 0; i < 5; i++) {
      const ox = tx + (Math.random() - 0.5) * 4, oz = tz + (Math.random() - 0.5) * 4;
      addFX({ type:'drop_marker', x:ox, z:oz, y:0.1, t:0, dur:Math.max(0.6, i * 0.5) });
      safeSetTimeout(() => explodeAt(ox, 0.3, oz, 200, 3.2, u.side, true), i * 500);
    }
    triggerShake(0.3, 0.4);
  }
  else if (r === 'aa') { u.warCry = 6; u.cooldown = 0; }
  else if (r === 'medic') {
    let n = 0;
    for (const a of STATE.units) if (a.side === 'player' && a.hp > 0 && a.hp < a.maxHp && Math.hypot(a.x - u.x, a.z - u.z) < 6) { a.hp = a.maxHp; addFX({ type:'heal_beam', x:u.x, z:u.z, tx:a.x, tz:a.z, t:0, dur:0.5 }); n++; }
    showToast('TRIAGE ' + n);
  }
  else if (r === 'gunship') {
    // Spray rockets in a cone
    for (let i = 0; i < 8; i++) {
      const ang = u.facing + (Math.random() - 0.5) * 0.6;
      const dx = Math.sin(ang), dz = Math.cos(ang);
      const tx = u.x + dx * (8 + Math.random() * 6), tz = u.z + dz * (8 + Math.random() * 6);
      safeSetTimeout(() => {
        STATE.projectiles.push({ id:nextId++, x:u.x, y:3.5, z:u.z, attacker:u, tx, tz, speed:20, kind:'rocket', dmg:effDmg(u) * 1.2, splash:1.8, side:u.side, alive:true, arc:true, arcH:2, arcT:0, trail:true });
      }, i * 80);
    }
  }
  else if (r === 'commander') {
    let n = 0;
    for (const a of STATE.units) if (a.side === 'player' && a.hp > 0) { a.warCry = 8; n++; }
    showToast('RALLY ' + n);
  }
  renderAbilityHUD();
}

function attemptDeploy(key, x, z) {
  const cd = STATE.cardCooldowns || {};
  if (cd[key] && cd[key] > 0) { showToast('CARD ON COOLDOWN'); playSound('ui_click'); return; }
  if (POWERS[key]) {
    if (triggerPower(key, x, z)) { cycleHandSlot(key); STATE.selectedCard = null; renderHand(); updateHUD(); }
    return;
  }
  const def = UNITS[key]; if (!def) return;
  // Faction-adjusted cost (Mercs -1, others 0)
  const cost = unitCost(key);
  if (STATE.energy < cost) { showToast('NOT ENOUGH ENERGY'); playSound('ui_click'); return; }
  const zMaxX = -RIVER_HALF - 1.2, zMinX = -FIELD_W/2 + 3.5;
  const zMaxZ = FIELD_D/2 - 1.5, zMinZ = -FIELD_D/2 + 1.5;
  if (x > zMaxX + 4 || x < zMinX - 4 || Math.abs(z) > zMaxZ + 4) { showToast('DEPLOY IN YOUR ZONE'); playSound('ui_click'); return; }
  x = Math.max(zMinX, Math.min(zMaxX, x));
  z = Math.max(zMinZ, Math.min(zMaxZ, z));
  STATE.energy -= cost;
  spawnUnit(key, 'player', x, z);
  cycleHandSlot(key);
  STATE.selectedCard = null;
  renderHand(); updateHUD();
}
function cycleHandSlot(key) {
  if (!STATE.cardCooldowns) STATE.cardCooldowns = {};
  const def = UNITS[key] || POWERS[key];
  let cd = 2.5;
  if (def) { if (POWERS[key]) cd = 8; else if (def.cost >= 7) cd = 6; else if (def.cost >= 6) cd = 5; else if (def.cost >= 5) cd = 4; else if (def.cost >= 4) cd = 3; else cd = 2; }
  STATE.cardCooldowns[key] = cd;
}

// ── PASSIVES ───────────────────────────────────────────────────────────
function getPassiveInterval(a) { return a==='reinforcements'?10 : a==='mortar'?25 : a==='paycheck'?15 : a==='sacrifice'?20 : 999; }
function tickPassive(side, faction, dt) {
  if (!FACTIONS[faction]) return;
  const a = FACTIONS[faction].ability; if (!a) return;
  if (!STATE.passives) STATE.passives = {};
  const k = side + '_' + faction;
  if (!(k in STATE.passives)) STATE.passives[k] = getPassiveInterval(a);
  STATE.passives[k] -= dt;
  if (STATE.passives[k] > 0) return;
  STATE.passives[k] = getPassiveInterval(a);
  triggerPassive(a, side, faction);
}
function triggerPassive(a, side, faction) {
  if (a === 'reinforcements') {
    const role = ['rifleman','medic'][Math.floor(Math.random() * 2)];
    const k = faction + '_' + role;
    const z = [LANE_TOP_Z, LANE_MID_Z, LANE_BOT_Z][Math.floor(Math.random() * 3)] + (Math.random() - 0.5) * 1.5;
    const x = side === 'player' ? -FIELD_W/2 + 8 + Math.random() * 3 : FIELD_W/2 - 8 - Math.random() * 3;
    if (UNITS[k]) { spawnUnit(k, side, x, z); if (side === 'player') { showToast('SCRAP REINFORCEMENTS'); playSound('passive_cue'); } }
  } else if (a === 'mortar') {
    const otherSide = side === 'player' ? 'enemy' : 'player';
    const cands = STATE.units.filter(u => u.side === otherSide && u.hp > 0 && u.def.type === 'ground');
    if (!cands.length) return;
    cands.sort((x, y) => y.def.cost - x.def.cost);
    const tgt = cands[0];
    const tx = tgt.x + (Math.random() - 0.5) * 1.5, tz = tgt.z + (Math.random() - 0.5) * 1.5;
    addFX({ type:'ring', x:tx, y:0.1, z:tz, t:0, dur:2.5, size:3, color:0xff4040 });
    if (side === 'player') { showToast('MORTAR STRIKE INCOMING'); playSound('passive_cue'); }
    safeSetTimeout(() => { explodeAt(tx, 0.5, tz, 0, 3.6, side, true); for (const u of STATE.units) { if (u.side === side || u.hp <= 0) continue; const d = Math.hypot(u.x - tx, u.z - tz); if (d < 3.6) applyDamage(u, 230 * Math.max(0.3, 1 - d / 3.6)); } triggerShake(0.42, 0.42); }, 2200);
  } else if (a === 'paycheck') {
    if (side === 'player') { STATE.energy = Math.min(STATE.maxEnergy, STATE.energy + 2); showToast('PAYCHECK +2'); playSound('paycheck'); }
    else STATE.enemyEnergy = Math.min(STATE.maxEnergy, STATE.enemyEnergy + 2);
    const hq = STATE.towers.find(t => t.side === side && t.role === 'hq');
    if (hq) for (let i = 0; i < 12; i++) addFX({ type:'spark', x:hq.x, y:1 + Math.random() * 3, z:hq.z, t:0, dur:1.2, vx:(Math.random()-0.5)*2, vy:1+Math.random()*1.5, vz:(Math.random()-0.5)*2 });
  } else if (a === 'sacrifice') {
    const mine = STATE.units.filter(u => u.side === side && u.hp > 0);
    if (!mine.length) return;
    mine.sort((x, y) => x.hp / x.maxHp - y.hp / y.maxHp);
    const v = mine[0];
    for (const u of STATE.units) if (u.side === side && u.hp > 0 && u !== v && Math.hypot(u.x - v.x, u.z - v.z) < 6) u.ritualBuff = 10;
    applyDamage(v, v.hp + 99);
    addFX({ type:'ring', x:v.x, y:0.1, z:v.z, t:0, dur:1.0, size:6, color:0xff2040 });
    if (side === 'player') { showToast('BLOOD RITUAL'); playSound('ritual'); }
  }
}
function updateFactionPassives(dt) {
  if (!STATE.currentMission) return;
  tickPassive('player', STATE.progress.playerFaction, dt);
  tickPassive('enemy', STATE.currentMission.enemyFaction, dt);
  for (const u of STATE.units) if (u.ritualBuff > 0) u.ritualBuff -= dt;
}

function loop(ts) {
  requestAnimationFrame(loop);
  if (!STATE.running) return;
  if (!renderer || !scene || !camera) {
    if (!STATE._initWarned) {
      STATE._initWarned = true;
      console.error('Reforged: renderer/scene/camera missing');
      const ls = document.getElementById('loadingScreen');
      if (ls) { ls.classList.add('active'); ls.textContent = '3D INIT FAILED — F12 console'; }
    }
    return;
  }
  ensureCanvasSize();
  if (!STATE.lastTime) STATE.lastTime = ts;
  const dt = Math.min(0.05, (ts - STATE.lastTime) / 1000);
  STATE.lastTime = ts;
  updateCameraFromKeys(dt);
  if (!STATE.paused) { update(dt); syncMeshes(dt); }
  else renderer.render(scene, camera);
}


// ── HUD + UI ────────────────────────────────────────────────────────────
function updateHUD() {
  const t = STATE.timer;
  const tEl = document.getElementById('gameTimer');
  if (STATE.overtime && t <= 0) {
    const ot = Math.abs(t), om = Math.floor(ot / 60), os = Math.floor(ot % 60);
    tEl.textContent = 'OT +' + om + ':' + String(os).padStart(2, '0');
    tEl.style.color = '#ff7050';
  } else {
    const m = Math.max(0, Math.floor(t / 60)), s = Math.max(0, Math.floor(t % 60));
    tEl.textContent = m + ':' + String(s).padStart(2, '0');
    tEl.style.color = (t < 30 ? '#f0c060' : '#e0e6ee');
  }
  document.getElementById('eNum').textContent = Math.floor(STATE.energy);
  const mul = STATE.energyMul || 1;
  const r = mul > 1 ? '+' + Math.round(STATE.energyRate * mul * 60) + '/min · x' + mul : '+' + Math.round(STATE.energyRate * 60) + '/min';
  document.getElementById('eRate').textContent = r;
  const pHQ = STATE.towers.find(t => t.role === 'hq' && t.side === 'player');
  const eHQ = STATE.towers.find(t => t.role === 'hq' && t.side === 'enemy');
  if (pHQ) document.getElementById('pHQFill').style.width = (pHQ.hp / pHQ.maxHp * 100) + '%';
  if (eHQ) document.getElementById('eHQFill').style.width = (eHQ.hp / eHQ.maxHp * 100) + '%';
  const kc = document.getElementById('killCounter');
  if (kc) kc.textContent = '☠ ' + STATE.stats.kills;
  const fk = STATE.progress.playerFaction;
  const deck = (STATE.progress.decks[fk] || []).slice(0, 10);
  document.querySelectorAll('.hand-card').forEach((el, i) => {
    const k = deck[i]; if (!k) return;
    const cost = UNITS[k] ? unitCost(k) : ((POWERS[k] && POWERS[k].cost) || 0);
    el.classList.toggle('affordable', STATE.energy >= cost);
    el.classList.toggle('unaffordable', STATE.energy < cost);
  });
}
// ── Ability HUD ────────────────────────────────────────────────────────
function renderAbilityHUD(){
  const hud = document.getElementById('abilityHUD');
  if (!hud) return;
  if (!SELECTED_UNIT || SELECTED_UNIT.hp <= 0) { hud.style.display = 'none'; return; }
  const u = SELECTED_UNIT;
  const ab = getUnitAbility(u);
  if (!ab) { hud.style.display = 'none'; return; }
  hud.style.display = 'flex';
  document.getElementById('abUnitName').textContent = u.def.name + ' · HP ' + Math.ceil(u.hp) + '/' + Math.ceil(u.maxHp);
  document.getElementById('abName').textContent = ab.icon + '  ' + ab.name;
  document.getElementById('abDesc').textContent = ab.desc;
  const fire = document.getElementById('abFire');
  const cd = u.abCD || 0;
  if (cd > 0) {
    fire.textContent = cd.toFixed(1) + 's';
    fire.style.background = 'linear-gradient(180deg,#3a4050,#1a2030)';
    fire.style.color = '#888';
    fire.style.boxShadow = 'none';
    fire.style.borderColor = '#444';
    fire.disabled = true;
  } else {
    fire.textContent = 'FIRE';
    fire.style.background = 'linear-gradient(180deg,#f0c060,#c08020)';
    fire.style.color = '#100600';
    fire.style.boxShadow = '0 0 14px rgba(240,196,96,0.7)';
    fire.style.borderColor = '#fff';
    fire.disabled = false;
  }
  const port = document.getElementById('abPortrait');
  port.innerHTML = cardIconSVG(u.key, 46);
}
function tickAbilityHUD(){
  // Auto-deselect if unit died or de-spawned
  if (SELECTED_UNIT) {
    if (SELECTED_UNIT.hp <= 0 || SELECTED_UNIT.deathStarted || !STATE.units.includes(SELECTED_UNIT)) {
      SELECTED_UNIT = null;
      renderAbilityHUD();
      return;
    }
    renderAbilityHUD();
  }
}

function renderHand() {
  const h = document.getElementById('hand'); h.innerHTML = '';
  const cd = STATE.cardCooldowns || {};
  const fk = STATE.progress.playerFaction;
  const deck = (STATE.progress.decks[fk] || []).slice(0, 10);
  for (let i = 0; i < deck.length; i++) {
    const k = deck[i]; if (!k) continue;
    const def = UNITS[k] || POWERS[k]; if (!def) continue;
    const isPower = !!POWERS[k];
    const onCD = cd[k] && cd[k] > 0;
    const card = document.createElement('div');
    card.className = 'hand-card' + (isPower ? ' power' : '') + (STATE.selectedCard === k ? ' selected' : '') + (onCD ? ' cooldown' : '');
    const cdo = onCD ? `<div class="cd-overlay">${cd[k].toFixed(1)}s</div>` : '';
    // Show faction-adjusted cost on hand cards
    const showCost = UNITS[k] ? unitCost(k) : def.cost;
    card.innerHTML = `<div class="cost-badge">${showCost}</div><div class="icon-box">${cardIconSVG(k)}</div><div class="name">${def.name}</div>${cdo}`;
    card.onclick = () => {
      if (onCD) { showToast('COOLDOWN'); playSound('ui_click'); return; }
      const _c = UNITS[k] ? unitCost(k) : def.cost;
      if (STATE.energy < _c) { showToast('NOT ENOUGH ENERGY'); playSound('ui_click'); return; }
      STATE.selectedCard = STATE.selectedCard === k ? null : k;
      playSound('ui_select'); renderHand();
    };
    h.appendChild(card);
  }
  updateHUD();
}
function showToast(m) {
  const t = document.getElementById('toast');
  t.textContent = m;
  t.classList.add('show');
  clearTimeout(STATE.toastTimer);
  STATE.toastTimer = setTimeout(() => t.classList.remove('show'), 1700);
}
function drawMinimap() {
  const cv = document.getElementById('minimap'); if (!cv) return;
  const ctx = cv.getContext('2d');
  const W = cv.width, H = cv.height;
  const sx = W / FIELD_W, sz = H / FIELD_D;
  function mx(x){return (x + FIELD_W/2) * sx;}
  function my(z){return (z + FIELD_D/2) * sz;}
  ctx.clearRect(0, 0, W, H);
  ctx.fillStyle = '#0a1828'; ctx.fillRect(0, 0, W, H);
  ctx.fillStyle = 'rgba(64,128,224,0.2)'; ctx.fillRect(0, 0, W/2, H);
  ctx.fillStyle = 'rgba(208,64,48,0.2)'; ctx.fillRect(W/2, 0, W/2, H);
  ctx.fillStyle = 'rgba(138,106,58,0.4)';
  for (const z of [LANE_TOP_Z, LANE_MID_Z, LANE_BOT_Z]) ctx.fillRect(0, my(z) - 2, W, 4);
  ctx.fillStyle = 'rgba(64,136,200,0.8)';
  ctx.fillRect(W/2 - 2, 0, 4, H);
  ctx.fillStyle = 'rgba(56,100,50,0.55)';
  for (const t of STATE.forestTrees) { if (t.dead) continue; ctx.fillRect(mx(t.x) - 0.5, my(t.z) - 0.5, 1, 1); }
  ctx.fillStyle = 'rgba(30,15,8,0.7)';
  for (const c of STATE.craters || []) ctx.fillRect(mx(c.x) - 1, my(c.z) - 1, 2, 2);
  for (const u of STATE.units) {
    if (u.hp <= 0) continue;
    const isAir = u.def.type === 'air';
    ctx.fillStyle = u.side === 'player' ? (isAir ? '#a0d8ff' : '#5aa8e8') : (isAir ? '#ffbbb4' : '#e8584a');
    const s = (u.def.roleKey === 'tank' || u.def.roleKey === 'apc') ? 3 : 2;
    ctx.fillRect(mx(u.x) - s/2, my(u.z) - s/2, s, s);
  }
  for (const t of STATE.towers) {
    if (t.hp <= 0) continue;
    ctx.fillStyle = t.side === 'player' ? '#80c0ff' : '#ff8060';
    const s = t.role === 'hq' ? 6 : 3;
    ctx.fillRect(mx(t.x) - s/2, my(t.z) - s/2, s, s);
    if (t.role === 'hq') {
      ctx.strokeStyle = t.side === 'player' ? '#c4dcff' : '#ffccc4';
      ctx.lineWidth = 1; ctx.strokeRect(mx(t.x) - s/2 - 1, my(t.z) - s/2 - 1, s + 2, s + 2);
    }
  }
  if (camera) {
    const c = STATE.cam;
    const vw = 30 / (c.distance / 36), vh = 20 / (c.distance / 36);
    ctx.strokeStyle = 'rgba(240,196,96,0.9)';
    ctx.lineWidth = 1.5;
    ctx.strokeRect(mx(c.targetX - vw/2), my(c.targetZ - vh/2), vw * sx, vh * sz);
  }
  ctx.strokeStyle = 'rgba(128,192,255,0.5)';
  ctx.lineWidth = 1;
  ctx.strokeRect(0.5, 0.5, W - 1, H - 1);
}

// ── 3D PORTRAIT BAKER ─────────────────────────────────────────────────
// At boot, render every unit/role into a small offscreen scene, capture as
// data URL, cache in CARD_PORTRAITS. Cards then show real 3D thumbnails
// with proper lighting instead of flat SVG line drawings.
const CARD_PORTRAITS = {};   // key -> dataURL string
const CARD_BAKE_SIZE = 256;
let _portraitRenderer = null, _portraitScene = null, _portraitCam = null;
function _ensurePortraitRig(){
  if (_portraitRenderer) return;
  const c = document.createElement('canvas');
  c.width = CARD_BAKE_SIZE; c.height = CARD_BAKE_SIZE;
  _portraitRenderer = new THREE.WebGLRenderer({ canvas:c, antialias:true, alpha:true, preserveDrawingBuffer:true });
  _portraitRenderer.setPixelRatio(1);
  _portraitRenderer.setSize(CARD_BAKE_SIZE, CARD_BAKE_SIZE, false);
  _portraitRenderer.setClearColor(0x000000, 0);   // transparent
  _portraitRenderer.outputEncoding = THREE.sRGBEncoding;
  _portraitRenderer.toneMapping = THREE.ACESFilmicToneMapping;
  _portraitRenderer.toneMappingExposure = 1.4;
  _portraitScene = new THREE.Scene();
  // Studio lighting — bright, punchy
  _portraitScene.add(new THREE.HemisphereLight(0xffffff, 0x404060, 1.0));
  const k = new THREE.DirectionalLight(0xffeed0, 1.6); k.position.set(4, 8, 6); _portraitScene.add(k);
  const f = new THREE.DirectionalLight(0x8090ff, 0.8); f.position.set(-5, 4, -3); _portraitScene.add(f);
  const r = new THREE.DirectionalLight(0xffd060, 0.7); r.position.set(0, 3, -8); _portraitScene.add(r);
  _portraitCam = new THREE.PerspectiveCamera(28, 1, 0.1, 50);
  _portraitCam.position.set(2.4, 1.6, 2.6);
  _portraitCam.lookAt(0, 0.6, 0);
}
function bakeCardPortrait(key){
  const def = UNITS[key]; if (!def) return null;
  _ensurePortraitRig();
  // Build the unit mesh once, render it, dispose
  const mesh = buildUnitMesh(def, 'player');
  // Center-stage: vehicles get backed off a bit, infantry centered standing
  if (def.type === 'air') {
    mesh.position.y = -2.6;
    _portraitCam.position.set(2.4, 0.4, 2.6);
  } else if (['tank','apc','artillery'].includes(def.roleKey)) {
    mesh.scale.setScalar(0.92);
    mesh.position.y = -0.3;
    _portraitCam.position.set(2.6, 1.4, 2.4);
  } else if (def.roleKey === 'lightV' || def.roleKey === 'aa') {
    mesh.position.y = -0.1;
    _portraitCam.position.set(2.4, 1.3, 2.4);
  } else {
    // Infantry — slight low angle, 3/4 view
    _portraitCam.position.set(1.7, 1.3, 2.0);
  }
  mesh.rotation.y = Math.PI / 5;
  _portraitCam.lookAt(0, 0.7, 0);
  _portraitScene.add(mesh);
  _portraitRenderer.render(_portraitScene, _portraitCam);
  const url = _portraitRenderer.domElement.toDataURL('image/png');
  _portraitScene.remove(mesh);
  disposeObject3D(mesh);
  return url;
}
function bakeAllPortraits(){
  // Bake every unit. Skip on failure (some browsers block toDataURL).
  for (const k of Object.keys(UNITS)) {
    try { const u = bakeCardPortrait(k); if (u) CARD_PORTRAITS[k] = u; }
    catch(e){ console.warn('portrait bake failed for', k, e.message); }
  }
}

function cardIconSVG(key, size) {
  const def = UNITS[key] || POWERS[key]; if (!def) return '';
  const fk = def.faction || 'rebels';
  const pal = FACTIONS[fk] ? FACTIONS[fk].palette : { main:0x4080d0, accent:0x101830, glow:0xf0c060 };
  const main = '#' + pal.main.toString(16).padStart(6, '0');
  const dark = '#' + pal.accent.toString(16).padStart(6, '0');
  const glow = '#' + pal.glow.toString(16).padStart(6, '0');
  // ── Use the baked 3D portrait when we have one (units only)
  if (UNITS[key] && CARD_PORTRAITS[key]) {
    const wh = size ? `width="${size}" height="${size}"` : 'width="100%" height="100%"';
    return `<svg ${wh} viewBox="0 0 48 48" preserveAspectRatio="xMidYMid meet">
      <defs><radialGradient id="bg-${key.replace(/_/g,'-')}" cx="50%" cy="40%" r="60%">
        <stop offset="0%" stop-color="${main}" stop-opacity="0.6"/>
        <stop offset="100%" stop-color="${dark}" stop-opacity="0.95"/>
      </radialGradient></defs>
      <circle cx="24" cy="24" r="22" fill="url(#bg-${key.replace(/_/g,'-')})" stroke="${glow}" stroke-width="0.6"/>
      <image href="${CARD_PORTRAITS[key]}" x="2" y="2" width="44" height="44" preserveAspectRatio="xMidYMid meet"/>
      <circle cx="24" cy="24" r="22" fill="none" stroke="${glow}" stroke-width="0.5" opacity="0.7"/>
    </svg>`;
  }
  const role = def.roleKey;
  const sa = size ? `width="${size}" height="${size}"` : 'width="100%" height="100%" preserveAspectRatio="xMidYMid meet"';
  const bp = `<circle cx="24" cy="24" r="22" fill="${dark}" opacity="0.4"/><circle cx="24" cy="24" r="20" fill="${main}" opacity="0.25" stroke="${glow}" stroke-width="0.5"/>`;
  let inner = '';
  if (POWERS[key]) {
    if (key === 'airstrike') inner = `<path d="M8 24 L40 24 M16 20 L24 14 L32 20 M20 28 L24 32 L28 28" stroke="${glow}" stroke-width="2.5" fill="none"/>`;
    else if (key === 'heal') inner = `<path d="M22 14 L26 14 L26 22 L34 22 L34 26 L26 26 L26 34 L22 34 L22 26 L14 26 L14 22 L22 22 Z" fill="${glow}"/>`;
    else if (key === 'emp') inner = `<circle cx="24" cy="24" r="6" fill="none" stroke="${glow}" stroke-width="2"/><circle cx="24" cy="24" r="11" fill="none" stroke="${glow}" stroke-width="1.5" opacity="0.7"/><circle cx="24" cy="24" r="16" fill="none" stroke="${glow}" stroke-width="1" opacity="0.4"/>`;
    else inner = `<circle cx="24" cy="24" r="14" fill="${glow}" opacity="0.5"/><text x="24" y="29" font-size="11" text-anchor="middle" fill="#000" font-family="Arial">${(def.name||'P').charAt(0).toUpperCase()}</text>`;
    return `<svg ${sa} viewBox="0 0 48 48">${bp}${inner}</svg>`;
  }
  if (role === 'swarm') inner = `<circle cx="14" cy="30" r="5" fill="${main}"/><circle cx="14" cy="22" r="3.5" fill="${main}"/><circle cx="28" cy="32" r="5" fill="${main}"/><circle cx="28" cy="24" r="3.5" fill="${main}"/><circle cx="36" cy="28" r="4" fill="${main}"/>`;
  else if (role === 'scout') inner = `<circle cx="24" cy="18" r="6" fill="${main}"/><rect x="20" y="22" width="8" height="14" fill="${main}"/><rect x="28" y="24" width="10" height="2.5" fill="${dark}"/>`;
  else if (role === 'rifleman') inner = `<circle cx="24" cy="17" r="6" fill="${main}"/><rect x="20" y="22" width="8" height="14" fill="${main}"/><rect x="28" y="26" width="14" height="2" fill="${dark}"/>`;
  else if (role === 'sniper') inner = `<circle cx="22" cy="17" r="6" fill="${main}"/><rect x="18" y="22" width="8" height="14" fill="${main}"/><rect x="25" y="25" width="20" height="2" fill="${dark}"/><circle cx="29" cy="24" r="2" fill="${glow}"/>`;
  else if (role === 'heavygunner') inner = `<circle cx="24" cy="16" r="7" fill="${main}"/><rect x="17" y="22" width="14" height="16" fill="${main}"/><rect x="31" y="28" width="14" height="4" fill="${dark}"/>`;
  else if (role === 'flamer') inner = `<circle cx="22" cy="17" r="6" fill="${main}"/><rect x="18" y="22" width="8" height="14" fill="${main}"/><path d="M27 27 Q36 24 42 20 Q36 26 30 30 Z" fill="${glow}"/>`;
  else if (role === 'grenadier') inner = `<circle cx="22" cy="17" r="6" fill="${main}"/><rect x="18" y="22" width="8" height="14" fill="${main}"/><circle cx="38" cy="18" r="4" fill="${dark}"/>`;
  else if (role === 'lightV') inner = `<rect x="8" y="20" width="32" height="12" fill="${main}" rx="1"/><rect x="14" y="14" width="20" height="8" fill="${dark}"/><circle cx="14" cy="34" r="4" fill="${dark}"/><circle cx="34" cy="34" r="4" fill="${dark}"/>`;
  else if (role === 'apc') inner = `<rect x="6" y="20" width="36" height="12" fill="${main}" rx="1"/><rect x="14" y="14" width="24" height="8" fill="${dark}"/><circle cx="11" cy="34" r="3" fill="${dark}"/><circle cx="19" cy="34" r="3" fill="${dark}"/><circle cx="29" cy="34" r="3" fill="${dark}"/><circle cx="37" cy="34" r="3" fill="${dark}"/>`;
  else if (role === 'tank') inner = `<rect x="4" y="24" width="40" height="8" fill="${dark}"/><rect x="8" y="16" width="32" height="10" fill="${main}"/><rect x="24" y="18" width="24" height="4" fill="${dark}"/><circle cx="11" cy="34" r="3" fill="#101010"/><circle cx="37" cy="34" r="3" fill="#101010"/>`;
  else if (role === 'artillery') inner = `<rect x="8" y="26" width="32" height="7" fill="${dark}"/><rect x="14" y="20" width="20" height="8" fill="${main}"/><path d="M16 20 L34 8" stroke="${dark}" stroke-width="4" stroke-linecap="round"/><circle cx="34" cy="8" r="2.5" fill="${glow}"/>`;
  else if (role === 'aa') inner = `<path d="M8 36 L40 36 L36 30 L12 30 Z" fill="${dark}"/><rect x="20" y="22" width="8" height="8" fill="${main}"/><path d="M22 22 L12 10" stroke="${dark}" stroke-width="3"/><path d="M26 22 L36 10" stroke="${dark}" stroke-width="3"/>`;
  else if (role === 'medic') inner = `<circle cx="24" cy="17" r="6" fill="${main}"/><rect x="20" y="22" width="8" height="14" fill="${main}"/><rect x="15" y="25" width="6" height="5" fill="#fff"/><rect x="17" y="24" width="2" height="7" fill="#c44"/><rect x="15" y="26.5" width="6" height="2" fill="#c44"/>`;
  else if (role === 'gunship') inner = `<ellipse cx="24" cy="26" rx="14" ry="6" fill="${main}"/><rect x="6" y="14" width="36" height="2" fill="${dark}"/><circle cx="24" cy="14" r="1.5" fill="${dark}"/><rect x="36" y="25" width="10" height="1.5" fill="${dark}"/>`;
  else if (role === 'commander') inner = `<circle cx="24" cy="16" r="7" fill="${main}"/><rect x="18" y="23" width="12" height="16" fill="${main}"/><polygon points="20,10 24,6 28,10 24,14" fill="${glow}"/><rect x="22" y="26" width="4" height="8" fill="${glow}"/>`;
  else inner = `<circle cx="24" cy="24" r="14" fill="${main}"/>`;
  return `<svg ${sa} viewBox="0 0 48 48">${bp}${inner}</svg>`;
}
function factionEmblemSVG(fk, size) {
  const pal = FACTIONS[fk].palette;
  const main = '#' + pal.main.toString(16).padStart(6, '0');
  const flag = '#' + pal.flag.toString(16).padStart(6, '0');
  const s = size || 56;
  let inner = '';
  if (fk === 'rebels') {
    inner = `<circle cx="32" cy="32" r="10" fill="${flag}"/>`;
    for (let i = 0; i < 8; i++) {
      const a = (i / 8) * Math.PI * 2;
      const x1 = 32 + Math.cos(a) * 14, y1 = 32 + Math.sin(a) * 14;
      const x2 = 32 + Math.cos(a) * 26, y2 = 32 + Math.sin(a) * 26;
      inner += `<line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" stroke="${flag}" stroke-width="3"/>`;
    }
  } else if (fk === 'empire') inner = `<rect x="29" y="10" width="6" height="44" fill="${flag}"/><rect x="14" y="25" width="36" height="6" fill="${flag}"/><polygon points="32,16 36,24 32,22 28,24" fill="${flag}"/>`;
  else if (fk === 'mercs') inner = `<circle cx="32" cy="32" r="20" fill="none" stroke="${flag}" stroke-width="3"/><line x1="4" y1="32" x2="60" y2="32" stroke="${flag}" stroke-width="3"/><line x1="32" y1="4" x2="32" y2="60" stroke="${flag}" stroke-width="3"/>`;
  else inner = `<polygon points="32,8 56,52 8,52" fill="${flag}"/><circle cx="32" cy="38" r="7" fill="${main}"/><circle cx="32" cy="38" r="3" fill="#000"/>`;
  return `<svg width="${s}" height="${s}" viewBox="0 0 64 64">${inner}</svg>`;
}

// ── MATCH LIFECYCLE ────────────────────────────────────────────────────
function startMatch(mission) {
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
  STATE.mode = mission.mode || '1v1';
  clearBattle();
  rebuildTrees();
  createTowers();
  STATE.passives = {};
  normalizeDeck();
  const fk = STATE.progress.playerFaction;
  const pDeck = [...(STATE.progress.decks[fk] || [])];
  STATE.hand = pDeck;
  STATE.cardCooldowns = {};
  const eFK = mission.enemyFaction;
  const eRoles = ['swarm','scout','rifleman','sniper','heavygunner','flamer','grenadier','lightV','apc','tank','artillery','aa','medic','gunship','commander'];
  const eDeck = eRoles.map(r => eFK + '_' + r);
  STATE.enemyHand = eDeck.slice(0, 4);
  STATE.enemyHandPool = eDeck.slice(4);
  STATE.enemyCooldowns = {};
  switchScreen('gameScreen');
  document.getElementById('camHint').style.display = 'block';
  STATE.cam.orbiting = false;
  const ob = document.getElementById('camOrbit'); if (ob) ob.classList.remove('on');
  renderHand(); updateHUD(); updateTowerPips();
  // Critical: resize after gameScreen is visible
  requestAnimationFrame(() => {
    resizeThree(); applyCamera();
    requestAnimationFrame(() => { resizeThree(); applyCamera(); });
  });
  requestAnimationFrame(loop);
}
function endMatch(victory) {
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
  document.getElementById('endSubtitle').textContent = victory ? 'Mission Complete' : 'Regroup and try again.';
  const s = STATE.stats;
  const eff = s.dmgDealt > 0 ? ((s.dmgDealt / Math.max(1, s.dmgDealt + s.dmgTaken)) * 100).toFixed(0) : '0';
  document.getElementById('endStats').innerHTML = `
    <div><span>KILLS</span><span>${s.kills}</span></div>
    <div><span>UNITS DEPLOYED</span><span>${s.deployed}</span></div>
    <div><span>UNITS LOST</span><span>${s.allyDeaths}</span></div>
    <div><span>DAMAGE DEALT</span><span>${Math.round(s.dmgDealt)}</span></div>
    <div><span>DAMAGE TAKEN</span><span>${Math.round(s.dmgTaken)}</span></div>
    <div><span>EFFICIENCY</span><span>${eff}%</span></div>`;
  const r = (victory && pm) ? (MISSION_REWARDS[pm.id] || []) : [];
  document.getElementById('endRewards').innerHTML = r.length ? 'UNLOCKED:<br>' + r.map(p => (POWERS[p] ? POWERS[p].name : p).toUpperCase()).join(' · ') : '';
  switchScreen('endScreen');
}

// ── SCREEN NAV ─────────────────────────────────────────────────────────
function switchScreen(id) {
  document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
  document.getElementById(id).classList.add('active');
}
function goTitle() {
  STATE.running = false;
  const fk = STATE.progress.playerFaction;
  const cf = document.getElementById('currentFaction');
  cf.textContent = FACTIONS[fk].name;
  cf.className = 'current-faction ' + fk;
  switchScreen('titleScreen');
  playSound('ui_click');
}
function goCampaign(){ renderMissionList(); switchScreen('campaignScreen'); playSound('ui_click'); }
function goArmory(){ STATE.armoryTab = 'units'; renderArmory(); switchScreen('armoryScreen'); playSound('ui_click'); }
function goLoadout(){ renderLoadout(); switchScreen('loadoutScreen'); playSound('ui_click'); }
function goFactions(){ renderFactionList(); switchScreen('factionScreen'); playSound('ui_click'); }
function goSettings(){ renderSettings(); switchScreen('settingsScreen'); playSound('ui_click'); }
function switchTab(t){ STATE.armoryTab = t; document.getElementById('tabUnits').classList.toggle('active', t==='units'); document.getElementById('tabPowers').classList.toggle('active', t==='powers'); document.getElementById('tabMatrix').classList.toggle('active', t==='matrix'); renderArmory(); }
function pauseGame(){ STATE.paused = true; document.getElementById('pauseMenu').classList.add('active'); playSound('ui_click'); }
function resumeGame(){ STATE.paused = false; STATE.lastTime = 0; document.getElementById('pauseMenu').classList.remove('active'); playSound('ui_click'); }
function surrenderMatch(){ document.getElementById('pauseMenu').classList.remove('active'); endMatch(false); }
function quitToMenu(){ document.getElementById('pauseMenu').classList.remove('active'); STATE.running = false; STATE.paused = false; goTitle(); }
function showBriefing(m) {
  STATE.pendingMission = m;
  document.getElementById('briefTitle').textContent = 'MISSION ' + m.id + ' — ' + m.name.toUpperCase();
  document.getElementById('briefText').textContent = m.desc;
  const fk = STATE.progress.playerFaction;
  document.getElementById('briefFaction').textContent = FACTIONS[fk].name;
  document.getElementById('briefEnemy').textContent = m.enemy + ' (' + FACTIONS[m.enemyFaction].name + ')';
  renderDifficultyPicker(); renderModePicker();
  switchScreen('briefingScreen');
}
function renderDifficultyPicker() {
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
function renderModePicker() {
  const el = document.getElementById('modePicker'); el.innerHTML = '';
  const cur = STATE.progress.mode || '1v1';
  for (const m of [{key:'1v1',label:'1 VS 1',desc:'You vs 1 AI'},{key:'2v2',label:'2 VS 2',desc:'(Coming soon)'}]) {
    const c = document.createElement('div');
    c.className = 'picker-tile' + (cur === m.key ? ' selected' : '');
    c.innerHTML = `<div class="pt-name" style="font-size:11px">${m.label}</div><div class="pt-stats">${m.desc}</div>`;
    c.onclick = () => { STATE.progress.mode = m.key; saveProgress(); renderModePicker(); playSound('ui_select'); };
    el.appendChild(c);
  }
}
function startBriefedMission() {
  if (!STATE.pendingMission) return;
  const m = {...STATE.pendingMission, mode: STATE.progress.mode || '1v1'};
  startMatch(m);
  STATE.pendingMission = null;
}
function quickSkirmish() {
  const eFK = ['empire','mercs','cult','rebels'].filter(f => f !== STATE.progress.playerFaction)[0];
  startMatch({ id:0, name:'Skirmish', desc:'Open battle', enemy:'Regulars', enemyFaction:eFK, aiSpeed:0.8, aiSmart:0.6, enemyHpMul:1, mode:STATE.progress.mode || '1v1' });
}
function showHowTo() {
  alert(
    'TIN SOLDIERS REFORGED v9 — HOW TO PLAY\n\n' +
    'OBJECTIVE: Destroy the enemy HQ. HQ is target-only — it does not\n' +
    'shoot back, but it has 6500 HP. You must break a forward turret\n' +
    'first to open a lane to it.\n\n' +
    'FACTIONS — each plays differently:\n' +
    '• REBELS  +15% speed (mobile harassers, slightly fragile)\n' +
    '• EMPIRE  +18% HP (durable line, slower)\n' +
    '• MERCS   -1 cost / +5% dmg / +10% energy (snowball economy)\n' +
    '• CULT    +15% range (long-reach casters, slightly fragile)\n' +
    'Faction-vs-faction: Rebels > Mercs > Cult > Empire > Rebels (10%).\n\n' +
    'CAMERA:\n' +
    '• Drag = orbit (free 360°). WASD = pan target.\n' +
    '• Scroll/pinch = zoom. Q/E = up/down.\n' +
    '• C = cycle preset. R = reset. O = toggle pan/orbit.\n\n' +
    'COMBAT:\n' +
    '• Tap a card, then tap your half of the field to deploy.\n' +
    '• Tap a deployed unit to trigger its ABILITY (cooldown shown).\n' +
    '• Towers have a 0.4s wind-up on first shot — use it to push.\n' +
    '• AA destroys Air (2.5x) but useless vs ground (0x).\n' +
    '• Snipers shred Medic / Commander / Gunship. Artillery shreds Tanks.\n\n' +
    'TIME LIMIT: 3:00 then sudden death (x5 energy).'
  );
}

// ── SCREEN RENDERERS ───────────────────────────────────────────────────
function renderFactionList() {
  const list = document.getElementById('factionList'); list.innerHTML = '';
  for (const fk of Object.keys(FACTIONS)) {
    const f = FACTIONS[fk];
    const fm = getFactionMod(fk);
    // Build a compact stat-line: shows what the faction actually changes
    const bits = [];
    if (fm.hpMul !== 1)     bits.push((fm.hpMul > 1 ? '+' : '') + Math.round((fm.hpMul - 1) * 100) + '% HP');
    if (fm.dmgMul !== 1)    bits.push((fm.dmgMul > 1 ? '+' : '') + Math.round((fm.dmgMul - 1) * 100) + '% DMG');
    if (fm.speedMul !== 1)  bits.push((fm.speedMul > 1 ? '+' : '') + Math.round((fm.speedMul - 1) * 100) + '% SPD');
    if (fm.rangeMul !== 1)  bits.push((fm.rangeMul > 1 ? '+' : '') + Math.round((fm.rangeMul - 1) * 100) + '% RNG');
    if (fm.costAdj)         bits.push((fm.costAdj < 0 ? '' : '+') + fm.costAdj + ' COST');
    if (fm.energyMul !== 1) bits.push((fm.energyMul > 1 ? '+' : '') + Math.round((fm.energyMul - 1) * 100) + '% ENERGY');
    const statLine = bits.length ? '<div class="faction-style" style="color:#80c0ff;margin-top:4px">' + bits.join('  ·  ') + '</div>' : '';
    const card = document.createElement('div');
    const sel = STATE.progress.playerFaction === fk;
    card.className = 'faction-card ' + fk + (sel ? ' selected' : '');
    card.innerHTML = `<div class="faction-icon">${factionEmblemSVG(fk, 64)}</div>
      <div class="faction-info">
        <div class="faction-name">${f.name}</div>
        <div class="faction-tagline">${f.tagline}</div>
        <div class="faction-style">${f.style}</div>
        ${statLine}
        <div class="faction-style" style="color:#80a0c8;margin-top:2px;font-size:9px">${fm.label || ''}</div>
      </div>`;
    card.onclick = () => selectFaction(fk);
    list.appendChild(card);
  }
}
function selectFaction(fk) { STATE.progress.playerFaction = fk; saveProgress(); normalizeDeck(); playSound('ui_select'); goTitle(); }
function renderMissionList() {
  const list = document.getElementById('missionList'); list.innerHTML = '';
  const done = STATE.progress.completed;
  for (let i = 0; i < MISSIONS.length; i++) {
    const m = MISSIONS[i];
    const lock = i > 0 && !done.includes(MISSIONS[i - 1].id);
    const dn = done.includes(m.id);
    const card = document.createElement('div');
    card.className = 'mission-card' + (lock ? ' locked' : '') + (dn ? ' completed' : '');
    const r = MISSION_REWARDS[m.id] || [];
    const rt = r.length ? 'REWARD: ' + r.map(p => POWERS[p].name).join(', ') : '';
    card.innerHTML = `<div class="mission-num">${String(m.id).padStart(2, '0')}</div><div class="mission-info"><div class="mission-name">${m.name.toUpperCase()}</div><div class="mission-desc">${m.desc}</div>${dn?'<div class="mission-status">✓ COMPLETE</div>':''}${rt?'<div class="mission-status">'+rt+'</div>':''}</div>`;
    if (!lock) card.onclick = () => showBriefing(m);
    list.appendChild(card);
  }
}
function renderArmory() {
  const grid = document.getElementById('armoryGrid');
  const matrix = document.getElementById('matrixView');
  const dr = document.getElementById('deckInfoRow');
  const note = document.getElementById('armoryNote');
  grid.innerHTML = ''; matrix.innerHTML = '';
  if (STATE.armoryTab === 'matrix') {
    grid.style.display = 'none'; matrix.style.display = 'block'; dr.style.display = 'none';
    note.textContent = 'Damage multipliers — attacker rows × target columns.';
    matrix.appendChild(buildMatrixTable());
    return;
  }
  grid.style.display = 'grid'; matrix.style.display = 'none'; dr.style.display = 'flex';
  const fk = STATE.progress.playerFaction;
  const deck = STATE.progress.decks[fk] || [];
  const uc = deck.filter(k => UNITS[k]).length;
  const pc = deck.filter(k => POWERS[k]).length;
  const dc = document.getElementById('deckCount');
  if (STATE.armoryTab === 'units') {
    dc.textContent = uc + ' / ' + DECK_UNITS_MAX;
    dc.classList.toggle('full', uc === DECK_UNITS_MAX);
    note.textContent = 'Choose ' + DECK_UNITS_MIN + '-' + DECK_UNITS_MAX + ' from 15 ' + FACTIONS[fk].name + ' units.';
  } else {
    dc.textContent = pc + ' / ' + DECK_POWERS_MAX;
    dc.classList.toggle('full', pc === DECK_POWERS_MAX);
    note.textContent = 'Choose up to ' + DECK_POWERS_MAX + ' powers.';
  }
  if (STATE.armoryTab === 'units') {
    for (const r of Object.keys(ROLE_STATS)) {
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
    const fp = (FACTION_POWERS[fk] || []).filter(k => (STATE.progress.unlockedPowers || []).includes(k));
    if (!fp.length) { grid.innerHTML = '<div class="powers-note" style="grid-column:span 2;padding:30px 0;text-align:center">No powers unlocked yet.</div>'; return; }
    for (const pk of fp) {
      const p = POWERS[pk]; if (!p) continue;
      const inDeck = deck.includes(pk);
      const card = document.createElement('div');
      card.className = 'unit-card-lg' + (inDeck ? ' selected' : '');
      const tag = p.shared ? 'CORE POWER' : FACTIONS[fk].name + ' POWER';
      card.innerHTML = `<div class="cost-badge">${p.cost}</div>${inDeck?'<div class="check-badge">✓</div>':''}<div class="icon-wrap">${cardIconSVG(pk, 48)}</div><div class="info-wrap"><div class="unit-name">${p.name}</div><div class="unit-role">${tag}</div><div class="unit-desc">${p.desc}</div></div>`;
      card.onclick = () => toggleDeckCard(pk);
      grid.appendChild(card);
    }
  }
}
function buildMatrixTable() {
  const w = document.createElement('div');
  const roles = Object.keys(ROLE_STATS);
  const t = document.createElement('table');
  t.style.width = '100%'; t.style.borderCollapse = 'collapse'; t.style.fontFamily = "'Share Tech Mono',monospace"; t.style.fontSize = '10px';
  const head = '<tr><th></th>' + roles.map(r => `<th style="padding:4px;background:#0a1828;color:#80c0ff">${r.slice(0,4).toUpperCase()}</th>`).join('') + '</tr>';
  let body = '';
  for (const att of roles) {
    let row = `<tr><td style="padding:4px;background:#0a1828;color:#80c0ff;font-weight:700">${att.slice(0,5).toUpperCase()}</td>`;
    for (const tgt of roles) {
      const v = getDmgMul(att, tgt);
      let bg = 'transparent', col = '#5070a0';
      if (v >= 1.3) { bg = 'rgba(64,228,144,0.3)'; col = '#88e8aa'; }
      else if (v < 0.8) { bg = 'rgba(228,80,60,0.3)'; col = '#ff9080'; }
      const d = v === 0 ? '✗' : (v === 1 ? '·' : v.toFixed(1));
      row += `<td style="padding:4px;text-align:center;background:${bg};color:${col};font-weight:${v!==1?'700':'400'};border:1px solid #1a2a3a">${d}</td>`;
    }
    body += row + '</tr>';
  }
  t.innerHTML = head + body;
  w.appendChild(t);
  const note = document.createElement('div');
  note.className = 'powers-note';
  note.style.padding = '12px 0';
  note.textContent = 'Buffs (War Cry +30%, Berserk +50%, Aegis -50%, Commander aura +15%) stack on top.';
  w.appendChild(note);
  return w;
}
function toggleDeckCard(k) {
  const fk = STATE.progress.playerFaction;
  const d = STATE.progress.decks[fk] || [];
  const isP = !!POWERS[k];
  const i = d.indexOf(k);
  const uc = d.filter(x => UNITS[x]).length;
  const pc = d.filter(x => POWERS[x]).length;
  if (i >= 0) {
    if (isP && pc <= DECK_POWERS_MIN) { showToast('NEED ≥' + DECK_POWERS_MIN + ' POWER'); return; }
    if (!isP && uc <= DECK_UNITS_MIN) { showToast('NEED ≥' + DECK_UNITS_MIN + ' UNITS'); return; }
    d.splice(i, 1); playSound('ui_click');
  } else {
    if (isP && pc >= DECK_POWERS_MAX) { showToast('MAX ' + DECK_POWERS_MAX + ' POWERS'); return; }
    if (!isP && uc >= DECK_UNITS_MAX) { showToast('MAX ' + DECK_UNITS_MAX + ' UNITS'); return; }
    d.push(k); playSound('ui_select');
  }
  STATE.progress.decks[fk] = d;
  saveProgress(); renderArmory();
}
function renderLoadout() {
  for (const slot of ['pickerTop', 'pickerBottom']) {
    const el = document.getElementById(slot); el.innerHTML = '';
    const cur = slot === 'pickerTop' ? (STATE.progress.towerTop || 'gun') : (STATE.progress.towerBottom || 'gun');
    for (const k of Object.keys(TOWER_TYPES)) {
      const t = TOWER_TYPES[k];
      const c = document.createElement('div');
      c.className = 'picker-tile' + (cur === k ? ' selected' : '');
      c.innerHTML = `<div style="font-size:22px;margin-bottom:4px">${t.icon}</div><div class="pt-name">${t.name.split(' ')[0].toUpperCase()}</div><div class="pt-stats">${t.stats}</div>`;
      c.onclick = () => { if (slot === 'pickerTop') STATE.progress.towerTop = k; else STATE.progress.towerBottom = k; saveProgress(); renderLoadout(); playSound('ui_select'); };
      el.appendChild(c);
    }
  }
}
function renderSettings() {
  // Theme
  const tp = document.getElementById('themePicker'); tp.innerHTML = '';
  const cT = STATE.progress.mapTheme || 'grass';
  for (const k of Object.keys(MAP_THEMES)) {
    const th = MAP_THEMES[k];
    const c = document.createElement('div');
    c.className = 'picker-tile' + (cT === k ? ' selected' : '');
    c.innerHTML = `<div style="display:flex;justify-content:center;gap:4px;margin-bottom:6px"><div style="width:20px;height:20px;border-radius:3px;background:#${th.ground.toString(16).padStart(6,'0')}"></div><div style="width:20px;height:20px;border-radius:3px;background:#${th.foliage[0].toString(16).padStart(6,'0')}"></div></div><div class="pt-name">${th.name}</div>`;
    c.onclick = () => selectMapTheme(k);
    tp.appendChild(c);
  }
  // Gore
  const gp = document.getElementById('gorePicker'); gp.innerHTML = '';
  const cG = STATE.progress.gore || 'medium';
  for (const k of Object.keys(GORE_LEVELS)) {
    const lvl = GORE_LEVELS[k];
    const c = document.createElement('div');
    c.className = 'picker-tile' + (cG === k ? ' selected' : '');
    c.innerHTML = `<div class="pt-name">${lvl.name}</div><div class="pt-stats">${Math.round(lvl.bloodMul*100)}% blood</div>`;
    c.onclick = () => { STATE.progress.gore = k; saveProgress(); renderSettings(); playSound('ui_select'); };
    gp.appendChild(c);
  }
  // Quality
  const qp = document.getElementById('qualityPicker'); qp.innerHTML = '';
  const cQ = STATE.progress.quality || 'medium';
  for (const k of Object.keys(QUALITY_LEVELS)) {
    const lvl = QUALITY_LEVELS[k];
    const c = document.createElement('div');
    c.className = 'picker-tile' + (cQ === k ? ' selected' : '');
    c.innerHTML = `<div class="pt-name">${lvl.name}</div><div class="pt-stats">SHADOW ${lvl.shadowMap}<br>FX ${Math.round(lvl.particleMul*100)}%</div>`;
    c.onclick = () => selectQuality(k);
    qp.appendChild(c);
  }
  // Time of day
  const tip = document.getElementById('timePicker'); tip.innerHTML = '';
  const cTime = STATE.progress.timeOfDay || 'day';
  for (const k of Object.keys(TIME_OF_DAY)) {
    const tod = TIME_OF_DAY[k];
    const c = document.createElement('div');
    c.className = 'picker-tile' + (cTime === k ? ' selected' : '');
    c.innerHTML = `<div class="pt-name">${tod.name}</div>`;
    c.onclick = () => selectTimeOfDay(k);
    tip.appendChild(c);
  }
  // Cheat
  const r = document.getElementById('cheatRow'); r.innerHTML = '';
  const tog = document.createElement('div');
  tog.className = 'toggle-switch' + (STATE.progress.cheatMode ? ' on' : '');
  tog.innerHTML = '<span class="lbl">UNLOCK ALL</span><div class="dot"></div>';
  tog.onclick = () => toggleCheatMode();
  r.appendChild(tog);
}
function selectMapTheme(k) {
  if (STATE.progress.mapTheme === k) return;
  STATE.progress.mapTheme = k; saveProgress(); playSound('ui_select');
  showToast('THEME: ' + MAP_THEMES[k].name + ' — RELOADING');
  setTimeout(() => location.reload(), 600);
}
function selectQuality(k) {
  if (STATE.progress.quality === k) return;
  STATE.progress.quality = k; saveProgress(); playSound('ui_select');
  showToast('QUALITY: ' + QUALITY_LEVELS[k].name + ' — RELOADING');
  setTimeout(() => location.reload(), 600);
}
function selectTimeOfDay(k) {
  if (STATE.progress.timeOfDay === k) return;
  STATE.progress.timeOfDay = k; saveProgress(); playSound('ui_select');
  showToast('TIME: ' + TIME_OF_DAY[k].name + ' — RELOADING');
  setTimeout(() => location.reload(), 600);
}
function toggleCheatMode() {
  STATE.progress.cheatMode = !STATE.progress.cheatMode;
  if (STATE.progress.cheatMode) { unlockEverything(false); showToast('CHEAT MODE ON'); }
  else showToast('CHEAT MODE OFF');
  saveProgress(); renderSettings(); playSound('ui_select');
}
function unlockEverything(announce) {
  for (const m of MISSIONS) if (!STATE.progress.completed.includes(m.id)) STATE.progress.completed.push(m.id);
  for (const pk of Object.keys(POWERS)) if (!STATE.progress.unlockedPowers.includes(pk)) STATE.progress.unlockedPowers.push(pk);
  saveProgress();
  if (announce) showToast('EVERYTHING UNLOCKED');
}
function unlockEverythingNow() { unlockEverything(true); playSound('win'); renderSettings(); }
function resetProgressConfirm() {
  if (!confirm('Reset all progress? Settings stay.')) return;
  const t = STATE.progress.mapTheme, q = STATE.progress.quality, g = STATE.progress.gore, td = STATE.progress.timeOfDay;
  STATE.progress = { completed:[], unlockedPowers:[], playerFaction:'rebels', decks:{}, towerTop:'gun', towerBottom:'gun', mapTheme:t, cheatMode:false, difficulty:'normal', mode:'1v1', gore:g, quality:q, timeOfDay:td };
  saveProgress(); normalizeDeck(); playSound('ui_click'); showToast('PROGRESS RESET'); renderSettings();
}

// ── BOOT ───────────────────────────────────────────────────────────────
function bootGame() {
  STATE.progress = loadProgress();
  if (!STATE.progress.v9UnlockApplied) {
    unlockEverything(false);
    STATE.progress.v9UnlockApplied = true;
    saveProgress();
  }
  if (STATE.progress.cheatMode) unlockEverything(false);
  normalizeDeck();
  try { initThree(); }
  catch (e) {
    console.error('initThree failed:', e);
    const ls = document.getElementById('loadingScreen');
    if (ls) { ls.classList.add('active'); ls.textContent = '3D INIT FAILED: ' + (e.message||'unknown'); }
    return;
  }
  setupInput();
  // Bake 3D card portraits — small offscreen render per unit. Async-ish via
  // microtask so the title screen paints first, then portraits warm up.
  Promise.resolve().then(() => {
    try { bakeAllPortraits(); }
    catch(e) { console.warn('Card portrait bake failed:', e.message); }
  });
  goTitle();
  document.getElementById('loadingScreen').classList.remove('active');
}
if (window.__threeLoaded) bootGame();
else window.addEventListener('three-ready', bootGame);

// ── EXPORTS ────────────────────────────────────────────────────────────
window.goTitle = goTitle;
window.goCampaign = goCampaign;
window.goArmory = goArmory;
window.goLoadout = goLoadout;
window.goFactions = goFactions;
window.goSettings = goSettings;
window.switchTab = switchTab;
window.pauseGame = pauseGame;
window.resumeGame = resumeGame;
window.surrenderMatch = surrenderMatch;
window.quitToMenu = quitToMenu;
window.startBriefedMission = startBriefedMission;
window.quickSkirmish = quickSkirmish;
window.showHowTo = showHowTo;
window.resetCamera = resetCamera;
window.toggleOrbitMode = toggleOrbitMode;
window.adjustCamHeight = adjustCamHeight;
window.adjustCamZoom = adjustCamZoom;
window.cycleCamPreset = cycleCamPreset;
window.selectFaction = selectFaction;
window.selectMapTheme = selectMapTheme;
window.selectQuality = selectQuality;
window.selectTimeOfDay = selectTimeOfDay;
window.toggleCheatMode = toggleCheatMode;
window.unlockEverythingNow = unlockEverythingNow;
window.resetProgressConfirm = resetProgressConfirm;
window.fireUnitAbility = fireUnitAbility;
window.selectUnit = selectUnit;
// Debug exports
window.CARD_PORTRAITS = CARD_PORTRAITS;
window.STATE = STATE;
window.UNITS = UNITS;
window.spawnUnit = spawnUnit;

