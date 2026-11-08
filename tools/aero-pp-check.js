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
const CAL_MINF = .25;

/* 1) valori noti: livelli base .5/.5, attuali 20/60 su range 0-100 -> livelli attuali .2/.6; anteriore +20, posteriore -30 su tutto il range */
console.log('1) contributo aero con valori calcolati a mano');
const K_PEN = E.CAL.aeroBalK; E.CAL.aeroBalK = 0;   /* sezione 1: contributi lineari puri, senza penalita' di equilibrio (con range 0-100 il rapporto sarebbe 1.0) */
setK(0, 0);
near(E.dAero(mkCar(), plan0()), 0, 1e-12, 'coefficienti 0 -> contributo 0');
setK(20, -30);
near(E.dAero(mkCar(), plan0()), 9, 1e-9, 'dfk=100: 20*(0.5-0.2) + -30*(0.5-0.6) = 6 + 3');
/* limiti della leva: anteriore >= .25, posteriore >= .5; con base .5/.5 e dfk 50 l'anteriore va a .25 e il posteriore resta a .5 */
near(E.dAero(mkCar(), { ...plan0(), dfk: 50 }), 4, 1e-9, 'dfk=50: 20*(0.25-0.2) + -30*(0.5-0.6) = 1 + 3');
{ const a = E.dAeroAxes(mkCar(), plan0()); near(a.F, 6, 1e-9, 'asse anteriore 6'); near(a.R, 3, 1e-9, 'asse posteriore 3') }
setK(20, 0); near(E.dAero(mkCar(), plan0()), 6, 1e-9, 'solo anteriore misurato: il posteriore non entra');
setK(0, -30); near(E.dAero(mkCar(), plan0()), 3, 1e-9, 'solo posteriore misurato: l\'anteriore non entra');
setK(20, -30);
near(E.dAero(mkCar({ ae: { ...mkCar().ae, cur: {} } }), plan0()), 0, 1e-9, 'senza valori attuali: contributo 0 a dfk=100');
near(E.dAero(mkCar({ ae: { ...mkCar().ae, cur: {} } }), { ...plan0(), dfk: 50 }), -5, 1e-9, 'senza valori attuali, dfk=50: 20*(0.25-0.5) + -30*(0.5-0.5) = -5 + 0');
near(E.dAero(mkCar({ ae: { ...mkCar().ae, base: {} } }), plan0()), 0, 1e-12, 'senza livelli generati: 0');
near(E.dAero(mkCar({ ae: { ...mkCar().ae, base: { dfF: .5 } } }), plan0()), 6, 1e-9, 'solo livello anteriore noto: conta solo l\'anteriore');
near(E.dAero(mkCar({ inst: { ...mkCar().inst, aero: false } }), plan0()), 0, 1e-12, 'aero non installata: 0');
near(E.dAero(mkCar({ ae: undefined }), plan0()), 0, 1e-12, 'senza contesto aero: 0');
{ const c = mkCar(); c.ae = { ...c.ae, Rg: { ...c.ae.Rg, dfF: { min: 0, max: 200, step: 1 }, dfR: { min: 0, max: 200, step: 1 } } };
  near(E.dAero(c, plan0()), 20 * (.5 - .1) + -30 * (.5 - .3), 1e-9, 'limiti 0-200: livelli attuali 0.1/0.3'); }
near(E.dAero(mkCar({ ae: { ...mkCar().ae, cur: { dfF: -50, dfR: 900 } } }), plan0()), 20 * (.5 - 0) + -30 * (.5 - 1), 1e-9, 'valori attuali fuori range: clamp 0..1');
near(E.aeroSlope(E.aeroLevels(mkCar(), plan0())), 20 * .5, 1e-9, 'pendenza rispetto alla quota: solo l\'anteriore (il posteriore a .5 e\' gia\' al limite) 20*0.5');
near(E.aeroSlope(E.aeroLevels(mkCar({ ae: { ...mkCar().ae, base: { dfF: .8, dfR: .8 } } }), plan0())), 20 * .8 + -30 * .8, 1e-9, 'pendenza con entrambi gli assi sopra i limiti: 20*0.8 + -30*0.8');

E.CAL.aeroBalK = K_PEN;
/* 1a) penalita' di equilibrio calcolata a mano (rapporto F/R sui valori assoluti, soglia .82, K 190): livelli attuali al centro (differenza 0, nessuna penalita'), setup con anteriore al massimo e posteriore al minimo
   (450/500 = 0.9): 190 * (0.9 - 0.82) = 15.2 PP in meno; livelli attuali 400/600 = 0.667, nessuna penalita' */
console.log("1a) penalita' di equilibrio con valori a mano");
{ setK(22, -30);
  const rg = { ...Rg, dfF: { min: 350, max: 450, step: 1 }, dfR: { min: 500, max: 700, step: 1 } };
  const c = mkCar({ ae: { Rg: rg, base: { dfF: 1, dfR: 0 }, cur: { dfF: 400, dfR: 600 } } }), a = E.dAeroAxes(c, plan0());
  near(a.F, 22 * .5, 1e-9, 'lineare anteriore 22*(1-0.5)'); near(a.R, -30 * (0 - .5), 1e-9, 'lineare posteriore -30*(0-0.5)');
  near(a.ratio, .9, 1e-9, 'rapporto del setup 450/500'); near(a.pen, 15.2, 1e-9, 'penalita 190*(0.9-0.82)'); near(a.bal, -15.2, 1e-9, 'contributo equilibrio = -penalita (attuale senza penalita)');
  near(E.dAero(c, plan0()), 11 + 15 - 15.2, 1e-9, 'totale 11 + 15 - 15.2');
  /* se i PP attuali erano gia' stati letti con la penalita', il piano non la paga due volte */
  const c2 = mkCar({ ae: { Rg: rg, base: { dfF: 1, dfR: 0 }, cur: { dfF: 450, dfR: 500 } } });
  near(E.dAeroAxes(c2, plan0()).bal, 0, 1e-9, 'attuale = setup: equilibrio 0');
  /* sotto soglia: nessuna penalita' */
  const c3 = mkCar({ ae: { Rg: rg, base: { dfF: .5, dfR: .5 }, cur: { dfF: 400, dfR: 600 } } });
  near(E.dAeroAxes(c3, plan0()).pen, 0, 1e-12, 'rapporto 0.667: nessuna penalita');
  /* solo un asse noto: nessuna penalita' */
  near(E.dAeroAxes(mkCar({ ae: { Rg: rg, base: { dfF: 1 }, cur: { dfF: 400, dfR: 600 } } }), plan0()).bal, 0, 1e-12, 'asse posteriore ignoto: nessuna penalita');
  setK(0, 0); near(E.dAeroAxes(c, plan0()).bal, 0, 1e-12, 'coefficienti 0: aero fuori dai PP, penalita compresa'); }

/* 1b) misure reali: Lamborghini Huracan GT3 '15, anteriore 350-450, posteriore 500-700, PP al centro 713.18 (22 punti: griglia 3x3 piu' due fette fini).
   Coefficienti dal metodo a croce attorno al centro (un asse al minimo/massimo, l'altro a meta'). */
console.log("1b) Huracan GT3: modello contro le 22 misure");
{ const meas = { '350/500': 715.61, '350/600': 701.37, '350/700': 686.84, '400/500': 728.04, '400/600': 713.18, '400/700': 697.71, '450/500': 723.52, '450/600': 723.15, '450/700': 708.37,
    '450/520': 727.09, '450/540': 729.84, '450/560': 730.75, '450/580': 728.63, '450/620': 718.44, '450/640': 716.16, '450/660': 714.93, '450/680': 711.88,
    '370/700': 690.91, '390/700': 695.26, '410/700': 699.68, '430/700': 704.60, '440/700': 706.61 };
  const kF = meas['450/600'] - meas['350/600'], kR = meas['400/700'] - meas['400/500'];
  near(kF, 21.78, 1e-9, 'coefficiente anteriore dal metodo a croce'); near(kR, -30.33, 1e-9, 'coefficiente posteriore dal metodo a croce');
  const rg = { ...Rg, dfF: { min: 350, max: 450, step: 1 }, dfR: { min: 500, max: 700, step: 1 } };
  const run = (withPen) => { let se = 0, worst = 0, wk = '', n = 0;
    const thr = E.CAL.aeroBalK; if (!withPen) E.CAL.aeroBalK = 0;
    setK(kF, kR);
    for (const key in meas) { const [f, r] = key.split('/').map(Number);
      const c = mkCar({ ppNow: 713.18, pp: 713.18, ae: { Rg: rg, base: { dfF: (f - 350) / 100, dfR: (r - 500) / 200 }, cur: { dfF: 400, dfR: 600 } } });
      const e = E.ppPred(c, plan0(), 1) - meas[key]; se += e * e; n++; if (Math.abs(e) > worst) { worst = Math.abs(e); wk = key } }
    E.CAL.aeroBalK = thr; return { rms: Math.sqrt(se / n), worst, wk } };
  const lin = run(false), full = run(true);
  console.log(`   solo lineare: errore quadratico medio ${lin.rms.toFixed(2)}, massimo ${lin.worst.toFixed(1)} (${lin.wk}); con penalita': ${full.rms.toFixed(2)}, massimo ${full.worst.toFixed(1)} (${full.wk})`);
  ok(full.rms <= 1.3, `22 punti: errore quadratico medio con penalita' <= 1.3 (${full.rms.toFixed(2)})`);
  ok(full.worst <= 3.0, `22 punti: errore massimo con penalita' <= 3 (${full.worst.toFixed(2)} a ${full.wk})`);
  ok(lin.rms > 2 * full.rms, `la penalita' migliora nettamente il modello lineare (${lin.rms.toFixed(2)} contro ${full.rms.toFixed(2)})`);
  /* i quattro punti della calibrazione a croce non devono essere toccati dalla penalita' (differenze di livello -0.5, 0.5, 0.5, -0.5, tutte sotto soglia) */
  setK(kF, kR);
  for (const [f, r] of [[350, 600], [450, 600], [400, 500], [400, 700]]) near(E.dAeroAxes(mkCar({ ae: { Rg: rg, base: { dfF: (f - 350) / 100, dfR: (r - 500) / 200 }, cur: { dfF: 400, dfR: 600 } } }), plan0()).pen, 0, 1e-12, `croce ${f}/${r}: nessuna penalita'`); }

/* 1c) Ferrari 430 Scuderia '07, anteriore 120-220, posteriore 280-430, centro 715.07: 24 punti. Risposta lineare pura (nessuna penalita' misurata, anche con anteriore massimo e
   posteriore minimo = 736.07): la penalita' sul rapporto (soglia .82) non deve toccarla (220/280 = 0.786). Coefficienti 24.49 / -18.16 dall'adattamento sui punti. */
console.log("1c) Ferrari 430: modello contro le misure, penalita' condivisa con la Huracan");
{ const meas = {}; const rr = [280, 300, 320, 340, 355, 370, 390, 410, 430], pr = [712.98, 709.54, 706.40, 703.67, 703.19, 701.24, 698.59, 695.77, 693.23];
  rr.forEach((r, i) => { meas['120/' + r] = pr[i] });
  [120, 140, 160, 170, 180, 200, 220].forEach((f, i) => { meas[f + '/430'] = [693.23, 698.32, 704.06, 706.73, 709.05, 713.68, 717.37][i] });
  meas['170/355'] = 715.07; meas['220/280'] = 736.07;
  const rg = { ...Rg, dfF: { min: 120, max: 220, step: 1 }, dfR: { min: 280, max: 430, step: 1 } };
  setK(24.49, -18.16);
  let se = 0, worst = 0, wk = '', n = 0;
  for (const key in meas) { const [f, r] = key.split('/').map(Number);
    const c = mkCar({ ppNow: 715.07, pp: 715.07, ae: { Rg: rg, base: { dfF: (f - 120) / 100, dfR: (r - 280) / 150 }, cur: { dfF: 170, dfR: 355 } } });
    const e = E.ppPred(c, plan0(), 1) - meas[key]; se += e * e; n++; if (Math.abs(e) > worst) { worst = Math.abs(e); wk = key }
    ok(E.dAeroAxes(c, plan0()).pen === 0, `Ferrari ${key}: nessuna penalita' (rapporto ${(f / r).toFixed(2)})`) }
  const rms = Math.sqrt(se / n); console.log(`   ${n} punti: errore quadratico medio ${rms.toFixed(2)}, massimo ${worst.toFixed(2)} (${wk})`);
  ok(rms <= 1.0, `Ferrari: errore quadratico medio <= 1.0 (${rms.toFixed(2)})`); ok(worst <= 2.5, `Ferrari: errore massimo <= 2.5 (${worst.toFixed(2)} a ${wk})`); }

/* 2) ciclo di calibrazione: lam vero 1.3, PP letti con aero applicato */
console.log('2) calibrazione lam con aero');
setK(20, -30);
{ const c = mkCar(), pl = { ...plan0(), ecu: 80, bal: 60, balp: 0, dfk: 70 }, lamTrue = 1.3;
  const obs = c.ppNow + lamTrue * E.dModel(c, pl) + E.dAero(c, pl);
  near(E.calibrate(c, pl, obs, 1), lamTrue, 1e-9, 'lam recuperato dai PP letti');
  near(E.ppPred(c, pl, lamTrue), obs, 1e-9, 'ppPred coerente con i PP letti'); }

/* 3) piano con aero come leva: disponibile solo se ridurre la deportanza di entrambi gli assi abbassa i PP */
console.log('3) solvePlan con aero come leva');
E.CAL.aeroBalK = 0;   /* sezione 3: leva lineare, caso di prova con range 0-100 (rapporto 1.0) che altrimenti attiverebbe la penalita' */
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
  const hc8 = mkCar({ ae: { Rg, base: { dfF: .8, dfR: .8 }, cur: { dfF: 80, dfR: 80 } } });
  ok(E.aeroSlope(E.aeroLevels(hc8, plan0())) < 0, 'coefficienti Huracan, livelli .8/.8: pendenza negativa');
  const h = E.solvePlan(hc8, pl, 1, SP('use'), Rg).plan;
  ok(h.dfk === 100, 'pendenza negativa: la leva automatica resta ferma (ridurre entrambi gli assi farebbe salire i PP)');
  /* livelli .5/.5: il posteriore e' al limite, si muove solo l'anteriore, quindi la leva ha senso e il posteriore resta fermo */
  { const m = E.aeroLevels(hc, plan0()); ok(E.aeroSlope(m) > 0, 'Huracan .5/.5: pendenza positiva (solo anteriore)');
    const h5 = E.solvePlan(hc, pl, 1, SP('use'), Rg).plan, m5 = E.aeroLevels(hc, h5);
    ok(h5.dfk < 100, 'Huracan .5/.5: la leva si muove'); near(m5.R.E, .5, 1e-12, 'posteriore fermo al limite .5'); ok(m5.F.E >= CAL_MINF - 1e-9, 'anteriore non sotto il 25%'); }
  /* con entrambi i coefficienti a 0 la leva non si muove */
  setK(0, 0); ok(E.solvePlan(c, pl, 1, SP('use'), Rg).plan.dfk === 100, 'coefficienti 0: dfk resta 100');
  /* bersaglio sopra i PP attuali: piano neutro */
  setK(30, -10);
  const up = E.solvePlan(mkCar({ pp: 700 }), pl, 1, SP('use'), Rg);
  ok(up.plan.dfk === 100 && up.plan.ecu === 100 && up.plan.bal === 0, 'target sopra i PP attuali: piano neutro'); }

/* 3b) la quota dfk scala davvero la deportanza generata (range di riferimento 0-100, livelli base del generatore) */
E.CAL.aeroBalK = K_PEN;
console.log('3b) gen con quota dfk');
{ const c = mkCar(), inv = { toe: true, bb: true }, lvN = { dfF: null, dfR: null, ts: null, rsa: null };
  const g100 = E.gen(E.effCar(c, plan0()), Rg, inv, lvN), g50 = E.gen(E.effCar(c, { ...plan0(), dfk: 50 }), Rg, inv, lvN);
  ok(g100.S.dfF > 10 && g100.S.dfR > 10, 'caso di prova con deportanza suggerita significativa');
  const fl = (v, f) => Math.max(v * .5, Math.min(v, f));
  near(g50.S.dfF, fl(g100.S.dfF, 25), 1, 'dfk 50 dimezza dfF fino al limite 25'); near(g50.S.dfR, fl(g100.S.dfR, 50), 1, 'dfk 50 dimezza dfR fino al limite 50');
  ok(g50.S.dfF >= 25 - 1 && g50.S.dfR >= 50 - 1, 'limiti leva rispettati (anteriore 25, posteriore 50)');
  { const g1 = E.gen(E.effCar(c, { ...plan0(), dfk: 1 }), Rg, inv, lvN); ok(g1.S.dfF >= 24 && g1.S.dfR >= 49, 'dfk al minimo: i limiti reggono'); }
  near(g50.auto.dfF, g100.auto.dfF, 1e-12, 'auto[] resta il livello pieno');
  const gl = E.gen(E.effCar(c, { ...plan0(), dfk: 50 }), Rg, inv, { ...lvN, dfF: .8, dfR: .6 });
  near(gl.S.dfF, 40, 1, 'livello utente 0.8 x dfk 50 = 40'); near(gl.S.dfR, 50, 1, 'livello utente 0.6 x dfk 50 = 30, alzato al limite 50 solo perche\' il prodotto scende sotto il limite ma il livello utente (60) lo supera');
  const gu = E.gen(E.effCar(c, { ...plan0(), dfk: 50 }), Rg, inv, { ...lvN, dfR: .4 }); near(gu.S.dfR, 40, 1, 'livello utente gia\' sotto il limite (.4): non viene alzato'); }

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
