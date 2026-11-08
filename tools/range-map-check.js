/* Controllo del passaggio dai valori calcolati ai range dell'utente: parametri assoluti (ABS) limitati al range, gli altri riscalati come posizione.
   Range reali dell'utente: Ferrari 430 Scuderia '07 e Lamborghini Huracan GT3 '15 (sospensioni e differenziale completamente regolabili, gomme racing dure). */
const fs = require('fs'), vm = require('vm'), path = require('path');
const html = fs.readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8');
const a = html.indexOf('/* ===== DATI ===== */'), b = html.indexOf('/* ===== LINGUA (IT / EN) ===== */');
const E = vm.runInNewContext(html.slice(a, b) + ';({gen,effCar,defRanges,CIRCUITS,ABS,PK})', {});
let fail = 0, n = 0; const ok = (c, m) => { n++; if (!c) { fail++; console.log('  FALLITO ', m) } };
const mk = o => { const R = E.defRanges(); for (const k in o) R[k] = { ...R[k], ...o[k] }; return R };
const RFer = mk({ rhF: { min: 60, max: 130 }, rhR: { min: 60, max: 130 }, freqF: { min: 2, max: 4 }, freqR: { min: 2, max: 4 }, lsdI: { min: 0, max: 30 }, lsdA: { min: 0, max: 100 }, lsdB: { min: 0, max: 100 } });
const RHur = mk({ rhF: { min: 55, max: 80 }, rhR: { min: 55, max: 80 }, freqF: { min: 3, max: 5 }, freqR: { min: 3, max: 5 }, lsdI: { min: 0, max: 30 }, lsdA: { min: 0, max: 100 }, lsdB: { min: 0, max: 100 } });
const car = (en, dr, w, wf, pw) => ({ name: 't', engine: en, drive: dr, weight: w, wf, stabL: '', stabH: '', rotL: 0, rotM: 0, rotH: 0, power: pw, torque: pw * 1.1, asp: 'NA', cg: 'auto', pp: 700, ppNow: 700, gears: 6, tyre: 'RH', tyreR: 'RH', aero: true,
  inst: { susp: 'full', lsd: true, tv: true, aero: true, brk: true, trans: true, ws: true }, comp: {}, terrain: 'asfalto', style: 'neutro', prof: { ...E.CIRCUITS.spa.p } });
const gen = (c, R) => E.gen(E.effCar(c, { ecu: 100, rst: 100, bal: 0, balp: 0 }), R, { toe: true, bb: true }, { dfF: null, dfR: null, ts: null, rsa: null }).S;
const D = E.defRanges();
for (const [nm, c, R] of [['Ferrari', car('F', 'RWD', 1300, 52, 510), RFer], ['Huracan', car('M', 'AWD', 1250, 43, 600), RHur]]) {
  const S = gen(c, R), S0 = gen(c, D);
  for (const k in S) { const u = R[k]; ok(S[k] >= u.min - 1e-9 && S[k] <= u.max + 1e-9, `${nm} ${k} = ${S[k]} dentro ${u.min}-${u.max}`) }
  /* assoluti: stesso valore dei range di default, salvo saturazione al limite del range reale */
  for (const k of E.ABS) if (S[k] != null && S0[k] != null) { const u = R[k], exp = Math.min(u.max, Math.max(u.min, S0[k])); ok(Math.abs(S[k] - exp) <= u.step + 1e-9, `${nm} ${k}: assoluto ${S[k]} atteso ${exp} (default ${S0[k]})`) }
  /* altezza: posizione nel range invariata (riscalata), non valore assoluto */
  for (const k of ['rhF', 'rhR']) { const t0 = (S0[k] - D[k].min) / (D[k].max - D[k].min), t1 = (S[k] - R[k].min) / (R[k].max - R[k].min); ok(Math.abs(t0 - t1) <= .03, `${nm} ${k}: posizione ${t1.toFixed(2)} contro ${t0.toFixed(2)}`) }
  /* differenziale: i valori sono livelli del gioco, non percentuali del range (prima 4/55/31 su 0-30/0-100/0-100) */
  ok(S.lsdI >= 8 && S.lsdI <= 16, `${nm} lsdI ${S.lsdI} coerente col livello suggerito`);
  ok(S.lsdA >= 25 && S.lsdA <= 45, `${nm} lsdA ${S.lsdA} coerente col livello suggerito`);
}
/* tipo di auto: da corsa con gomme racing dure -> frequenza di base alzata (CAL.freqRace), non piu' saturata sul minimo di 3 Hz; da strada invariata */
{ const E2 = vm.runInNewContext(html.slice(a, b) + ';({CAL,CAT_HZ})', {});
  const cr = { ...car('M', 'AWD', 1250, 43, 600), cat: 'race' }, S = gen(cr, RHur), S0 = gen(car('M', 'AWD', 1250, 43, 600), RHur);
  ok(S.freqF > 3.3 && S.freqF < 4.5, `Huracan da corsa: freqF ${S.freqF} non saturata al minimo`); ok(S.freqF >= S0.freqF + 0.3, `da corsa piu' rigida della stessa auto da strada (${S.freqF} contro ${S0.freqF})`);
  ok(Math.abs(S.freqR - S.freqF) <= .3, 'frequenze ant./post. abbinate (manuale)');
  const sc = gen({ ...car('F', 'RWD', 1300, 52, 510), cat: 'road' }, RFer), sd = gen(car('F', 'RWD', 1300, 52, 510), RFer); ok(sc.freqF === sd.freqF, 'tipo strada = comportamento precedente');
  const cc = { ...car('F', 'RWD', 1300, 52, 510), cat: 'race', tyre: 'CM', tyreR: 'CM' }, sm = gen(cc, RFer), sn = gen({ ...cc, cat: 'road' }, RFer); ok(sm.freqF === sn.freqF, 'gomme non da corsa: nessun incremento');
  ok(E2.CAT_HZ.race[0] === 3 && E2.CAT_HZ.race[1] === 5 && E2.CAT_HZ.road[0] === 1.75 && E2.CAT_HZ.road[1] === 3.75, 'range di default per categoria'); }
console.log(`${n} controlli | falliti: ${fail}`); process.exit(fail ? 1 : 0);
