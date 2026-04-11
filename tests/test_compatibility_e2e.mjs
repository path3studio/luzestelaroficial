#!/usr/bin/env node
/**
 * E2E test — /api/reports/compatibility
 *
 * Cierra hallazgo R3-#7 + hallazgo #6 del snapshot 2026-04-11. La función
 * `onRequestGet` del endpoint es pura: solo depende del shape de `context`
 * (request, env.DB, data.user) y de las filas devueltas por `birth_profiles`.
 *
 * Este test:
 *   1. Importa el módulo real (no copia la lógica).
 *   2. Crea un fake `context` con DB stub que devuelve dos filas sintéticas.
 *   3. Cubre las 7 ramas del cálculo: western, chinese, numerology, celtic,
 *      mayan, vedic, human_design.
 *   4. Verifica también:
 *        - 401 si !user
 *        - 403 si user.tier === 'free'  (premium gate)
 *        - 400 si falta profile_a o profile_b
 *        - 404 si DB.first() devuelve null
 *   5. Imprime PASS/FAIL por test y exit code != 0 si algo rompe.
 *
 * Uso:
 *   node website/tests/test_compatibility_e2e.mjs
 *   # o desde dentro de website/:
 *   node tests/test_compatibility_e2e.mjs
 *
 * Sin dependencias externas. Sin red. Sin D1.
 */

import { onRequestGet } from '../functions/api/reports/compatibility.js';

let pass = 0;
let fail = 0;
const failures = [];

function check(name, cond, detail = '') {
    if (cond) {
        console.log(`  ✅ ${name}`);
        pass++;
    } else {
        console.log(`  ❌ ${name}${detail ? ' — ' + detail : ''}`);
        failures.push(name);
        fail++;
    }
}

function makeProfile(overrides = {}) {
    return {
        id: 'p1',
        user_id: 'u1',
        nombre: 'Alice',
        fecha_nacimiento: '1990-05-15',
        western_sign: 'Taurus',
        chinese_animal: 'Horse',
        numerology_number: 3,
        celtic_tree: 'Oak',
        mayan_seal: 'Eagle',
        mayan_kin: 195,
        vedic_rashi: 'Vrishabha',
        human_design_gate: 24,
        ...overrides,
    };
}

function makeDB(rows) {
    // rows is an array; .first() pops the next one
    let i = 0;
    return {
        prepare: () => ({
            bind: () => ({
                first: async () => {
                    const r = rows[i];
                    i++;
                    return r ?? null;
                },
            }),
        }),
    };
}

function makeContext({ user = { sub: 'u1', tier: 'premium' }, profileA, profileB, qa = 'p1', qb = 'p2', lang = 'es' } = {}) {
    return {
        data: { user },
        request: { url: `https://example.com/api/reports/compatibility?profile_a=${qa}&profile_b=${qb}&lang=${lang}` },
        env: { DB: makeDB([profileA, profileB]) },
    };
}

async function asJson(resp) {
    const txt = await resp.text();
    try { return JSON.parse(txt); } catch { return { _parseError: txt }; }
}

console.log('────────────────────────────────────────');
console.log(' E2E: /api/reports/compatibility');
console.log('────────────────────────────────────────\n');

// ─── Test 1: Happy path, premium, two valid profiles ─────────────
{
    console.log('Test 1: premium user, two valid profiles, ES');
    const ctx = makeContext({
        profileA: makeProfile({ id: 'p1', nombre: 'Alice', western_sign: 'Taurus', chinese_animal: 'Horse', numerology_number: 3, celtic_tree: 'Oak',  mayan_seal: 'Eagle', mayan_kin: 195, vedic_rashi: 'Vrishabha', human_design_gate: 24 }),
        profileB: makeProfile({ id: 'p2', nombre: 'Bob',   western_sign: 'Leo',    chinese_animal: 'Dog',   numerology_number: 7, celtic_tree: 'Oak',  mayan_seal: 'Eagle', mayan_kin: 199, vedic_rashi: 'Simha',     human_design_gate: 25 }),
    });
    const resp = await onRequestGet(ctx);
    const body = await asJson(resp);
    check('HTTP 200', resp.status === 200, `got ${resp.status}`);
    check('ok=true', body.ok === true);
    check('report.profileA.name = Alice', body.report?.profileA?.name === 'Alice');
    check('report.profileB.name = Bob',   body.report?.profileB?.name === 'Bob');
    check('overallScore in [0,100]', Number.isInteger(body.report?.overallScore) && body.report.overallScore >= 0 && body.report.overallScore <= 100, `got ${body.report?.overallScore}`);
    const b = body.report?.breakdown ?? {};
    for (const sys of ['western','chinese','numerology','celtic','mayan','vedic','humanDesign']) {
        check(`breakdown.${sys}.score in [0,100]`, typeof b[sys]?.score === 'number' && b[sys].score >= 0 && b[sys].score <= 100, `got ${b[sys]?.score}`);
    }
    check('synthesis includes Alice + Bob', body.report?.synthesis?.includes('Alice') && body.report.synthesis.includes('Bob'));
    check('synthesis ES (no "share a")', !body.report?.synthesis?.includes('share a'));
    // Specific calculation expectations:
    //   western: Taurus=Earth, Leo=Fire → Earth-Fire not in table → reverse Fire-Earth = 45
    check('western score = 45 (Earth-Fire)', b.western?.score === 45);
    //   chinese: Horse trine3, Dog trine3 → 90
    check('chinese score = 90 (Horse-Dog same trine)', b.chinese?.score === 90);
    //   celtic: same tree (Oak) → 95
    check('celtic score = 95 (same tree)', b.celtic?.score === 95);
    //   mayan: same seal → 95
    check('mayan score = 95 (same seal)', b.mayan?.score === 95);
    //   vedic: Vrishabha=Earth vs Simha=Fire → not same rashi, not same element → 60
    check('vedic score = 60 (different rashi+element)', b.vedic?.score === 60);
    //   human_design: 24 vs 25 → diff=1 ≤ 4 → 75
    check('human_design score = 75 (gates within 4)', b.humanDesign?.score === 75);
    console.log('');
}

// ─── Test 2: EN locale ────────────────────────────────────────────
{
    console.log('Test 2: EN locale synthesis');
    const ctx = makeContext({
        lang: 'en',
        profileA: makeProfile({ id: 'p1', nombre: 'Anna' }),
        profileB: makeProfile({ id: 'p2', nombre: 'Brian' }),
    });
    const resp = await onRequestGet(ctx);
    const body = await asJson(resp);
    check('HTTP 200', resp.status === 200);
    check('synthesis EN starts with name + share', body.report?.synthesis?.includes('Anna and Brian share a'));
    check('synthesis EN no spanish "comparten"', !body.report?.synthesis?.includes('comparten'));
    console.log('');
}

// ─── Test 3: Free tier blocked ────────────────────────────────────
{
    console.log('Test 3: free-tier user blocked');
    const ctx = makeContext({
        user: { sub: 'u1', tier: 'free' },
        profileA: makeProfile(),
        profileB: makeProfile({ id: 'p2', nombre: 'Bob' }),
    });
    const resp = await onRequestGet(ctx);
    const body = await asJson(resp);
    check('HTTP 403', resp.status === 403, `got ${resp.status}`);
    check('upgrade=true', body.upgrade === true);
    check('error message mentions premium', /premium/i.test(body.error || ''));
    console.log('');
}

// ─── Test 4: Not authenticated ────────────────────────────────────
{
    console.log('Test 4: !user → 401');
    const ctx = makeContext({ user: null, profileA: makeProfile(), profileB: makeProfile() });
    const resp = await onRequestGet(ctx);
    check('HTTP 401', resp.status === 401, `got ${resp.status}`);
    console.log('');
}

// ─── Test 5: Missing query params ─────────────────────────────────
{
    console.log('Test 5: missing profile_b → 400');
    const ctx = {
        data: { user: { sub: 'u1', tier: 'premium' } },
        request: { url: 'https://example.com/api/reports/compatibility?profile_a=p1' },
        env: { DB: makeDB([]) },
    };
    const resp = await onRequestGet(ctx);
    check('HTTP 400', resp.status === 400, `got ${resp.status}`);
    console.log('');
}

// ─── Test 6: Profile not found ────────────────────────────────────
{
    console.log('Test 6: profileA exists, profileB missing → 404');
    const ctx = makeContext({
        profileA: makeProfile(),
        profileB: null,  // DB.first() returns null
    });
    const resp = await onRequestGet(ctx);
    check('HTTP 404', resp.status === 404, `got ${resp.status}`);
    console.log('');
}

// ─── Test 7: Both profiles missing ────────────────────────────────
{
    console.log('Test 7: both profiles missing → 404');
    const ctx = makeContext({ profileA: null, profileB: null });
    const resp = await onRequestGet(ctx);
    check('HTTP 404', resp.status === 404);
    console.log('');
}

// ─── Test 8: Optional fields absent → fallback scores ─────────────
{
    console.log('Test 8: legacy profile (no mayan/vedic/HD) → fallback scores');
    const minimal = (id, nombre) => ({
        id, user_id: 'u1', nombre, fecha_nacimiento: '1990-01-01',
        western_sign: 'Aries', chinese_animal: 'Rat', numerology_number: 1, celtic_tree: 'Birch',
        mayan_seal: null, mayan_kin: null, vedic_rashi: null, human_design_gate: null,
    });
    const ctx = makeContext({
        profileA: minimal('p1', 'Carla'),
        profileB: minimal('p2', 'Diana'),
    });
    const resp = await onRequestGet(ctx);
    const body = await asJson(resp);
    check('HTTP 200', resp.status === 200);
    const b = body.report?.breakdown ?? {};
    check('mayan score = 60 (fallback when null)', b.mayan?.score === 60);
    check('vedic score = 60 (fallback when null)', b.vedic?.score === 60);
    check('humanDesign score = 60 (fallback when null)', b.humanDesign?.score === 60);
    check('synthesis handles null mayan_seal gracefully', /sellos mayas \(\?-\?\)/.test(body.report?.synthesis || ''));
    console.log('');
}

// ─── Summary ──────────────────────────────────────────────────────
console.log('────────────────────────────────────────');
console.log(`  Result: ${pass} pass / ${fail} fail`);
console.log('────────────────────────────────────────');
if (fail > 0) {
    console.log('\nFailed checks:');
    failures.forEach(f => console.log(`  • ${f}`));
    process.exit(1);
}
process.exit(0);
