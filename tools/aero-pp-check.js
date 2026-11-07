#!/usr/bin/env node
/* Setup Lab - controllo del modello PP con aerodinamica (CAL.ppAeroF / CAL.ppAeroR, leva dfk, ciclo di calibrazione).
   Estrae il motore da index.html come safety-net.js ed esegue casi con risultato noto calcolato a mano, una verifica contro le misure reali
   (Lamborghini Huracan GT3 '15, griglia 3x3 anteriore x posteriore) e invarianti su una griglia di configurazioni.
   Con --baseline=percorso/index.html (versione precedente) confronta anche i piani con i coefficienti a 0: devono essere identici.

   Uso: node tools/aero-pp-check.js [--file=index.html] [--baseline=index_vecchio.html]
   Uscita: 0 ok, 1 controlli falliti, 8 errore. */
'use strict';
const fs = require('fs'), path = require('path'), vm = require('vm');
const args = process.argv.slice(2), arg = n => (args.find(a => a.startsWith('--' + n + '=')) || '').slice(n.length + 3);
const M0 = '/* ===== DATI ===== */', M1 = '/* ===== LINGUA (IT / EN) ===== */';
function load(f) {
  const html = fs.readFileSync(f, 'utf8'), a = html.indexOf(M0), b = html.indexOf(M1);
  if (a < 0 || b <= a) throw new Error('Marcatori del motore non trovati in ' + f);
  /* i nomi mancanti (motore precedente senza aero) diventano undefined invece di far fallire il caricamento */
  const names = ['gen', 'effCar', 'dModel', 'dAero', 'dAeroAxes', 'aeroLevels', 'aeroSlope', 'ppPred', 'calibrate', 'solvePlan', 'plDefault', 'defRanges', 'CIRCUITS', 'CAL', 'PL', 'has'];
  return vm.runInNewContext(html.slice(a, b) + '\n;({' + names.map(n => `${n}:(typeof ${n}==='undefined'?undefined:${n})`).join(',') + '})', {}, { filename: f });
}
const file = path.resolve(arg('file') || path.join(__dirname, '..', 'index.html'));
const E = load(file);
let fails = 0, checks = 0;
const ok = (c, msg) => { checks++; if (!c) { fails++; console.log('  FALLITO  ' + msg) } };
const near = (a, b, t, msg) => ok(Math.abs(a - b) <= t, `${msg}: ${a} vs ${b} (tol ${t})`);
const setK = (f, r) => { E.CAL.ppAeroF = f; E.CAL.ppAeroR = r };

const mkCar = (o = {}) => ({ name: 't', engine: 'F', drive: 'RWD', weight: 1300, wf: 52, power: 350, torque: 400, asp: 'NA', cg: 'auto', pp: 560, ppNow: 640,
  gears: 6, tyre: 'SM', tyreR: 'SM', aero: true, inst: { susp: 'full', lsd: true, tv: true, aero: true, brk: true, trans: true, ws: true },
  comp: { ecu: true, rst: true, bal: true, aero: true }, terrain: 'asfalto', style: 'neutro', prof: { ...E.CIRCUITS.spa.p },
  ae: { Rg: E.defRanges(), base: { dfF: .5, dfR: .5 }, cur: { dfF: 20, dfR: 60 } }, ...o });
const plan0 = () => ({ ...E.plDefault() });
const Rg = E.defRanges();

/* 1) valori noti: livelli base .5/.5, attuali 20/60 su range 0-100 -> livelli attuali .2/.6; anteriore +20, posteriore -30 su tutto il range */
console.log('1) contributo aero con valori calcolati a mano');
setK(0, 0);
near(E.dAero(mkCar(), plan0()), 0, 1e-12, 'coefficienti 0 -> contributo 0');
setK(20, -30);
near(E.dAero(mkCar(), plan0()), 9, 1e-9, 'dfk=100: 20*(0.5-0.2) + -30*(0.5-0.6) = 6 + 3');
near(E.dAero(mkCar(), { ...plan0(), dfk: 50 }), 11.5, 1e-9, 'dfk=50: 20*(0.25-0.2) + -30*(0.25-0.6) = 1 + 10.5');
{ const a = E.dAeroAxes(mkCar(), plan0()); near(a.F, 6, 1e-9, 'asse anteriore 6'); near(a.R, 3, 1e-9, 'asse posteriore 3') }
setK(20, 0); near(E.dAero(mkCar(), plan0()), 6, 1e-9, 'solo anteriore misurato: il posteriore non entra');
setK(0, -30); near(E.dAero(mkCar(), plan0()), 3, 1e-9, 'solo posteriore misurato: l\'anteriore non entra');
setK(20, -30);
near(E.dAero(mkCar({ ae: { ...mkCar().ae, cur: {} } }), plan0()), 0, 1e-9, 'senza valori attuali: contributo 0 a dfk=100');
near(E.dAero(mkCar({ ae: { ...mkCar().ae, cur: {} } }), { ...plan0(), dfk: 50 }), 2.5, 1e-9, 'senza valori attuali, dfk=50: 20*(0.25-0.5) + -30*(0.25-0.5) = -5 + 7.5');
near(E.dAero(mkCar({ ae: { ...mkCar().ae, base: {} } }), plan0()), 0, 1e-12, 'senza livelli generati: 0');
near(E.dAero(mkCar({ ae: { ...mkCar().ae, base: { dfF: .5 } } }), plan0()), 6, 1e-9, 'solo livello anteriore noto: conta solo l\'anteriore');
near(E.dAero(mkCar({ inst: { ...mkCar().inst, aero: false } }), plan0()), 0, 1e-12, 'aero non installata: 0');
near(E.dAero(mkCar({ ae: undefined }), plan0()), 0, 1e-12, 'senza contesto aero: 0');
{ const c = mkCar(); c.ae = { ...c.ae, Rg: { ...c.ae.Rg, dfF: { min: 0, max: 200, step: 1 }, dfR: { min: 0, max: 200, step: 1 } } };
  near(E.dAero(c, plan0()), 20 * (.5 - .1) + -30 * (.5 - .3), 1e-9, 'limiti 0-200: livelli attuali 0.1/0.3'); }
near(E.dAero(mkCar({ ae: { ...mkCar().ae, cur: { dfF: -50, dfR: 900 } } }), plan0()), 20 * (.5 - 0) + -30 * (.5 - 1), 1e-9, 'valori attuali fuori range: clamp 0..1');
near(E.aeroSlope(E.aeroLevels(mkCar(), plan0())), 20 * .5 + -30 * .5, 1e-9, 'pendenza rispetto alla quota: 20*0.5 + -30*0.5 = -5');

/* 1b) misure reali: Lamborghini Huracan GT3 '15, anteriore 350-450, posteriore 500-700, PP al centro 713.18.
   Coefficienti dal metodo a croce attorno al centro (un asse al minimo/massimo, l'altro a meta'). */
console.log("1b) Huracan GT3: modello lineare contro la griglia misurata 3x3");
{ const meas = { '350/500': 715.61, '350/600': 701.37, '350/700': 686.84, '400/500': 728.04, '400/600': 713.18, '400/700': 697.71, '450/500': 723.52, '450/600': 723.15, '450/700': 708.37 };
  const kF = meas['450/600'] - meas['350/600'], kR = meas['400/700'] - meas['400/500'];
  near(kF, 21.78, 1e-9, 'coefficiente anteriore dal metodo a croce'); near(kR, -30.33, 1e-9, 'coefficiente posteriore dal metodo a croce');
  setK(kF, kR);
  const rg = { ...Rg, dfF: { min: 350, max: 450, step: 1 }, dfR: { min: 500, max: 700, step: 1 } };
  let worst = 0, worstKey = '', outlier = null;
  for (const key in meas) {
    const [f, r] = key.split('/').map(Number);
    const c = mkCar({ ppNow: 713.18, pp: 713.18, ae: { Rg: rg, base: { dfF: (f - 350) / 100, dfR: (r - 500) / 200 }, cur: { dfF: 400, dfR: 600 } } });
    const err = E.ppPred(c, plan0(), 1) - meas[key];
    if (key === '450/500') { outlier = err; continue }   /* punto incoerente con gli altri otto: da rileggere in gioco */
    if (Math.abs(err) > worst) { worst = Math.abs(err); worstKey = key }
  }
  console.log(`   errore massimo sugli 8 punti coerenti: ${worst.toFixed(2)} PP (${worstKey}); punto 450/500: ${outlier.toFixed(1)} PP di scarto (da rileggere)`);
  ok(worst <= 2.0, `Huracan: 8 punti coerenti entro 2 PP dal modello lineare (peggiore ${worst.toFixed(2)} a ${worstKey})`);
  ok(Math.abs(outlier) > 10, 'il punto 450/500 resta incoerente (>10 PP): se rimisurato coerente, aggiornare questa nota'); }

/* 2) ciclo di calibrazione: lam vero 1.3, PP letti con aero applicato */
console.log('2) calibrazione lam con aero');
setK(20, -30);
{ const c = mkCar(), pl = { ...plan0(), ecu: 80, bal: 60, balp: 0, dfk: 70 }, lamTrue = 1.3;
  const obs = c.ppNow + lamTrue * E.dModel(c, pl) + E.dAero(c, pl);
  near(E.calibrate(c, pl, obs, 1), lamTrue, 1e-9, 'lam recuperato dai PP letti');
  near(E.ppPred(c, pl, lamTrue), obs, 1e-9, 'ppPred coerente con i PP letti'); }

/* 3) piano con aero come leva: disponibile solo se ridurre la deportanza di entrambi gli assi abbassa i PP */
console.log('3) solvePlan con aero come leva');
const SP = mode => ({ share: .6, method: 'ecu', pos: 'auto', aero: mode });
{ setK(30, -10);   /* pendenza +10: scalare giu' abbassa i PP */
  const c = mkCar(), pl = plan0();
  for (const mode of ['off', 'use']) {
    const r = E.solvePlan(c, pl, 1, SP(mode), Rg), pred = E.ppPred(c, r.plan, 1);
    console.log(`   anteriore +30, posteriore -10, aero=${mode}: dfk ${r.plan.dfk}%, ecu ${r.plan.ecu}%, zavorra ${r.plan.bal} kg, previsti ${pred.toFixed(1)} (target ${c.pp}), stato ${r.state}`);
    ok(Math.abs(pred - c.pp) <= 1.5, `${mode}: PP previsti vicini al target (${pred.toFixed(1)})`);
    ok(r.plan.dfk >= Rg.dfk.min && r.plan.dfk <= 100, `${mode}: dfk nei limiti`);
    if (mode === 'off') ok(r.plan.dfk === 100, 'off: dfk resta 100');
    if (mode === 'use') ok(r.plan.dfk < 100, 'use: dfk ridotto');
  }
  const a = E.solvePlan(c, pl, 1, SP('off'), Rg).plan, b = E.solvePlan(c, pl, 1, SP('use'), Rg).plan;
  ok(b.ecu >= a.ecu && b.bal <= a.bal && (b.ecu > a.ecu || b.bal < a.bal), 'con aero come leva servono meno riduzioni di potenza/peso');
  /* caso Huracan: pendenza negativa -> la leva non deve muoversi */
  setK(21.78, -30.33);
  const hc = mkCar({ ae: { Rg, base: { dfF: .5, dfR: .5 }, cur: { dfF: 50, dfR: 50 } } });
  ok(E.aeroSlope(E.aeroLevels(hc, plan0())) < 0, 'coefficienti Huracan: pendenza negativa');
  const h = E.solvePlan(hc, pl, 1, SP('use'), Rg).plan;
  ok(h.dfk === 100, 'pendenza negativa: la leva automatica resta ferma (ridurre entrambi gli assi farebbe salire i PP)');
  /* con entrambi i coefficienti a 0 la leva non si muove */
  setK(0, 0); ok(E.solvePlan(c, pl, 1, SP('use'), Rg).plan.dfk === 100, 'coefficienti 0: dfk resta 100');
  /* bersaglio sopra i PP attuali: piano neutro */
  setK(30, -10);
  const up = E.solvePlan(mkCar({ pp: 700 }), pl, 1, SP('use'), Rg);
  ok(up.plan.dfk === 100 && up.plan.ecu === 100 && up.plan.bal === 0, 'target sopra i PP attuali: piano neutro'); }

/* 3b) la quota dfk scala davvero la deportanza generata (range di riferimento 0-100, livelli base del generatore) */
console.log('3b) gen con quota dfk');
{ const c = mkCar(), inv = { toe: true, bb: true }, lvN = { dfF: null, dfR: null, ts: null, rsa: null };
  const g100 = E.gen(E.effCar(c, plan0()), Rg, inv, lvN), g50 = E.gen(E.effCar(c, { ...plan0(), dfk: 50 }), Rg, inv, lvN);
  ok(g100.S.dfF > 10 && g100.S.dfR > 10, 'caso di prova con deportanza suggerita significativa');
  near(g50.S.dfF, g100.S.dfF * .5, 1, 'dfk 50 dimezza dfF'); near(g50.S.dfR, g100.S.dfR * .5, 1, 'dfk 50 dimezza dfR');
  near(g50.auto.dfF, g100.auto.dfF, 1e-12, 'auto[] resta il livello pieno');
  const gl = E.gen(E.effCar(c, { ...plan0(), dfk: 50 }), Rg, inv, { ...lvN, dfF: .8, dfR: .6 });
  near(gl.S.dfF, 40, 1, 'livello utente 0.8 x dfk 50 = 40'); near(gl.S.dfR, 30, 1, 'livello utente 0.6 x dfk 50 = 30'); }

/* 4) griglia di invarianti */
console.log('4) invarianti su griglia (trazione, aero, coefficienti, gap)');
let nGrid = 0;
for (const [kf, kr] of [[0, 0], [15, -20], [40, -10], [-30, 50], [25, 0], [0, -25]]) { setK(kf, kr);
  for (const drive of ['FWD', 'RWD', 'AWD']) for (const gap of [-120, -40, -5, 0, 30]) for (const aero of ['off', 'use']) for (const cur of [{}, { dfF: 30, dfR: 90 }, { dfF: 0, dfR: 0 }]) for (const hasAero of [true, false]) {
    const c = mkCar({ drive, pp: 640 + gap, ae: { Rg, base: { dfF: .62, dfR: .48 }, cur }, comp: { ecu: true, rst: true, bal: true, aero: hasAero }, inst: { ...mkCar().inst, aero: hasAero } });
    const r = E.solvePlan(c, plan0(), 1, SP(aero), Rg), p = r.plan, pr = E.ppPred(c, p, 1);
    nGrid++;
    ok([p.ecu, p.rst, p.bal, p.balp, p.dfk, pr, r.left].every(Number.isFinite), `finiti (${drive} gap ${gap} ${aero} ${kf}/${kr})`);
    ok(p.dfk >= Rg.dfk.min && p.dfk <= 100 && (hasAero || p.dfk === 100), `dfk valido (${drive} gap ${gap} ${aero} ${hasAero})`);
    const slope = E.aeroSlope(E.aeroLevels(c, plan0()));
    if (!(slope > 1e-6)) ok(p.dfk === 100, `pendenza non positiva (${slope}): leva ferma`);
    const g100 = E.gen(E.effCar(c, plan0()), Rg, { toe: true, bb: true }, { dfF: null, dfR: null, ts: null, rsa: null });
    const gk = E.gen(E.effCar(c, p), Rg, { toe: true, bb: true }, { dfF: null, dfR: null, ts: null, rsa: null });
    ok(Object.values(gk.S).every(Number.isFinite), 'gen finito con dfk');
    if (!hasAero) { ok(gk.S.dfF === undefined && g100.S.dfF === undefined, 'senza aero installata: nessun valore aero'); continue }
    if (p.dfk < 100) ok(gk.S.dfF < g100.S.dfF && gk.S.dfR < g100.S.dfR, `dfk ${p.dfk} riduce davvero la deportanza (${gk.S.dfF}/${g100.S.dfF})`);
    ok(gk.S.dfF <= g100.S.dfF + 1e-9 && gk.S.dfR <= g100.S.dfR + 1e-9, `deportanza non aumenta con dfk<100 (${gk.S.dfF}/${g100.S.dfF})`);
    ok(gk.S.dfF >= Rg.dfF.min && gk.S.dfF <= Rg.dfF.max && gk.S.dfR >= Rg.dfR.min && gk.S.dfR <= Rg.dfR.max, 'deportanza nei limiti');
    if (p.dfk === 100) ok(gk.S.dfF === g100.S.dfF && gk.S.dfR === g100.S.dfR, 'dfk=100: setup identico');
  } }
console.log(`   ${nGrid} configurazioni`);

/* 5) regressione: con i coefficienti a 0 i piani coincidono con quelli del motore precedente */
const base = arg('baseline');
if (base) {
  console.log('5) regressione contro ' + base + ' (coefficienti 0)');
  const O = load(path.resolve(base));
  setK(0, 0); let n = 0;
  for (const drive of ['FWD', 'RWD']) for (const gap of [-150, -60, -10, 0, 40]) for (const share of [.25, .6, .85]) for (const method of ['ecu', 'rst']) for (const cur of [{}, { dfF: 30, dfR: 90 }]) {
    const co = mkCar({ drive, pp: 640 + gap }); delete co.ae; delete co.comp.aero;
    const cn = mkCar({ drive, pp: 640 + gap, ae: { Rg, base: { dfF: .6, dfR: .5 }, cur } });
    const op = { share, method, pos: 'auto' }, ro = O.solvePlan(co, O.plDefault(), 1, op, O.defRanges()), rn = E.solvePlan(cn, E.plDefault(), 1, { ...op, aero: 'use' }, Rg);
    n++;
    const same = ['ecu', 'rst', 'bal', 'balp'].every(k => ro.plan[k] === rn.plan[k]) && ro.state === rn.state;
    ok(same, `piano identico (${drive} gap ${gap} share ${share} ${method}): ${JSON.stringify(ro.plan)} vs ${JSON.stringify(rn.plan)}`);
    near(O.ppPred(co, ro.plan, 1), E.ppPred(cn, rn.plan, 1), 1e-9, 'ppPred identico');
  }
  console.log(`   ${n} piani confrontati`);
} else console.log('5) regressione saltata (nessun --baseline)');

console.log(`\n${checks} controlli | falliti: ${fails}`);
process.exitCode = fails ? 1 : 0;
