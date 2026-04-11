#!/usr/bin/env node
/**
 * fix-accents.js — Fix missing Spanish accents across the Luz Estelar website
 * ============================================================================
 * Safely replaces unaccented Spanish words with their proper accented forms,
 * while preserving URLs, HTML attribute values, slugs, and file paths.
 *
 * Usage:  node scripts/fix-accents.js [--dry-run]
 */

const fs = require('fs');
const path = require('path');

const DRY_RUN = process.argv.includes('--dry-run');
const BASE = path.resolve(__dirname, '..');

// ── Replacement map (lowercase → accented) ──────────────────────────────────
const REPLACEMENTS = [
  // Each entry: [unaccented_lower, accented_lower, unaccented_cap, accented_cap]
  ['diseno', 'diseño', 'Diseno', 'Diseño'],
  ['vedica', 'védica', 'Vedica', 'Védica'],
  ['cosmico', 'cósmico', 'Cosmico', 'Cósmico'],
  ['sintesis', 'síntesis', 'Sintesis', 'Síntesis'],
  ['pronostico', 'pronóstico', 'Pronostico', 'Pronóstico'],
  ['horoscopo', 'horóscopo', 'Horoscopo', 'Horóscopo'],
  ['energia', 'energía', 'Energia', 'Energía'],
  ['conexion', 'conexión', 'Conexion', 'Conexión'],
  ['funcion', 'función', 'Funcion', 'Función'],
  ['suscripcion', 'suscripción', 'Suscripcion', 'Suscripción'],
  ['electronico', 'electrónico', 'Electronico', 'Electrónico'],
  ['sesion', 'sesión', 'Sesion', 'Sesión'],
  ['magico', 'mágico', 'Magico', 'Mágico'],
  ['analisis', 'análisis', 'Analisis', 'Análisis'],
  ['proposito', 'propósito', 'Proposito', 'Propósito'],
  ['intuicion', 'intuición', 'Intuicion', 'Intuición'],
  ['tradicion', 'tradición', 'Tradicion', 'Tradición'],
  ['basico', 'básico', 'Basico', 'Básico'],
  ['paginas', 'páginas', 'Paginas', 'Páginas'],
  ['numero', 'número', 'Numero', 'Número'],
  ['corazon', 'corazón', 'Corazon', 'Corazón'],
  ['segun', 'según', 'Segun', 'Según'],
  ['numerologia', 'numerología', 'Numerologia', 'Numerología'],
];

// ── Collect files ────────────────────────────────────────────────────────────
function collectHtmlFiles(dir) {
  let results = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      // Skip /en/ directory, node_modules, .git
      if (entry.name === 'en' || entry.name === 'node_modules' || entry.name === '.git') continue;
      results = results.concat(collectHtmlFiles(full));
    } else if (entry.isFile() && entry.name.endsWith('.html')) {
      results.push(full);
    }
  }
  return results;
}

function getFilesToProcess() {
  const files = collectHtmlFiles(BASE);

  // Add specific non-HTML files
  const extras = [
    path.join(BASE, 'js', 'profile-card.js'),
    path.join(BASE, 'functions', 'perfil', '[id].js'),
  ];
  for (const f of extras) {
    if (fs.existsSync(f) && !files.includes(f)) {
      files.push(f);
    }
  }
  return files;
}

// ── Safe replacement logic ───────────────────────────────────────────────────
// Strategy: protect attribute values by replacing them with placeholders,
// then do accent replacements on the remaining text, then restore placeholders.

/**
 * Protect content inside HTML attributes and slug patterns from replacement.
 * Returns { text, placeholders } where text has placeholders substituted.
 */
function protectAttributes(content) {
  const placeholders = [];
  let idx = 0;

  // Protect: href, src, id, class, action, content, data-*, property, name,
  // itemprop — anything that could carry a URL, slug, or machine-readable token.
  // IMPORTANT: `content` is critical — Open Graph / Twitter Card / canonical
  // meta tags use content="https://.../horoscopo-chino/..." and MUST NOT be
  // accent-replaced. Historical bug (Apr 2026): 159 og:url tags in
  // horoscopo-chino/ were corrupted from /horoscopo-chino/ → /horoscopo-chino/
  // because this guard was missing `content`. See
  // Memoria_Contexto_AI/inventario_wip_website_2026-04-11.md (Grupo A bug).
  const attrPattern = /(?:href|src|id|class|action|content|property|name|itemprop|data-[\w-]+)\s*=\s*(?:"[^"]*"|'[^']*')/gi;
  const slugPattern = /slug_es\s*:\s*(?:"[^"]*"|'[^']*')/g;
  // Protect file paths like /diseno-humano/ in href-like contexts
  // Protect url(...) in CSS
  const urlPattern = /url\s*\(\s*(?:"[^"]*"|'[^']*'|[^)]*)\s*\)/gi;
  // Protect the entire body of <script type="application/ld+json">…</script>
  // blocks. JSON-LD carries canonical URLs in `@id`, `url`,
  // `mainEntityOfPage`, `image`, etc., and must stay byte-identical.
  const jsonLdPattern = /<script\b[^>]*type\s*=\s*["']application\/ld\+json["'][^>]*>[\s\S]*?<\/script>/gi;
  // Protect inline <script>…</script> bodies that may reference slugs/URLs
  // in string literals. We only need to avoid mangling URL/slug text inside
  // them, so protecting the full body is safe (accented text in JS strings
  // is rare and not the target of this pass).
  const inlineScriptPattern = /<script\b(?![^>]*\bsrc\s*=)[^>]*>[\s\S]*?<\/script>/gi;

  let text = content;

  // Replace protected patterns with unique placeholders.
  // Order matters: jsonLdPattern and inlineScriptPattern must run BEFORE
  // attrPattern so that attributes inside a script body don't get
  // double-protected (attrPattern would match `content="…"` inside JSON-LD,
  // but we prefer to hide the whole block so any future attribute names
  // remain safe too).
  for (const pattern of [jsonLdPattern, inlineScriptPattern, attrPattern, slugPattern, urlPattern]) {
    text = text.replace(pattern, (match) => {
      const placeholder = `\x00PROTECTED_${idx++}\x00`;
      placeholders.push({ placeholder, original: match });
      return placeholder;
    });
  }

  return { text, placeholders };
}

/**
 * Restore placeholders with original content.
 */
function restorePlaceholders(text, placeholders) {
  for (const { placeholder, original } of placeholders) {
    text = text.split(placeholder).join(original);
  }
  return text;
}

/**
 * Apply accent replacements to a string, avoiding already-accented text.
 */
function applyReplacements(text) {
  for (const [lower, accentedLower, cap, accentedCap] of REPLACEMENTS) {
    // For "numero" — avoid replacing in slug-like contexts (e.g., "numero-1", "numero-de-")
    if (lower === 'numero') {
      // Only replace when NOT followed by a hyphen+digit or hyphen+letter (slug pattern)
      // and NOT preceded by / (path context)
      text = text.replace(new RegExp(`(?<!/)\\b${lower}\\b(?!-)`, 'g'), accentedLower);
      text = text.replace(new RegExp(`(?<!/)\\b${cap}\\b(?!-)`, 'g'), accentedCap);
    } else {
      // Word-boundary replacement — don't re-accent already accented text
      text = text.replace(new RegExp(`\\b${lower}\\b`, 'g'), accentedLower);
      text = text.replace(new RegExp(`\\b${cap}\\b`, 'g'), accentedCap);
    }
  }
  return text;
}

/**
 * Process a single file: protect attributes, apply replacements, restore.
 */
function processFile(filePath) {
  const original = fs.readFileSync(filePath, 'utf8');

  // Step 1: Protect attribute values
  const { text: withPlaceholders, placeholders } = protectAttributes(original);

  // Step 2: Apply accent replacements
  const replaced = applyReplacements(withPlaceholders);

  // Step 3: Restore protected content
  const final = restorePlaceholders(replaced, placeholders);

  if (final !== original) {
    if (!DRY_RUN) {
      fs.writeFileSync(filePath, final, 'utf8');
    }
    return { modified: true, filePath, original, final };
  }
  return { modified: false, filePath };
}

// ── Main ─────────────────────────────────────────────────────────────────────
function main() {
  console.log(`\n${'='.repeat(70)}`);
  console.log(`  fix-accents.js — Spanish accent fixer for Luz Estelar`);
  console.log(`  Mode: ${DRY_RUN ? 'DRY RUN (no files will be modified)' : 'LIVE (files will be modified)'}`);
  console.log(`${'='.repeat(70)}\n`);

  const files = getFilesToProcess();
  console.log(`Found ${files.length} files to scan.\n`);

  let modifiedCount = 0;
  const examples = [];

  for (const f of files) {
    const result = processFile(f);
    if (result.modified) {
      modifiedCount++;
      const rel = path.relative(BASE, f);

      // Collect a few before/after examples
      if (examples.length < 8) {
        // Find changed lines
        const origLines = result.original.split('\n');
        const finalLines = result.final.split('\n');
        const diffs = [];
        for (let i = 0; i < origLines.length; i++) {
          if (origLines[i] !== finalLines[i] && diffs.length < 3) {
            diffs.push({
              line: i + 1,
              before: origLines[i].trim().substring(0, 120),
              after: finalLines[i].trim().substring(0, 120),
            });
          }
        }
        if (diffs.length > 0) {
          examples.push({ file: rel, diffs });
        }
      }

      console.log(`  [MODIFIED] ${rel}`);
    }
  }

  console.log(`\n${'─'.repeat(70)}`);
  console.log(`\nSummary: ${modifiedCount} file(s) modified out of ${files.length} scanned.\n`);

  if (examples.length > 0) {
    console.log(`Example changes:\n`);
    for (const ex of examples) {
      console.log(`  File: ${ex.file}`);
      for (const d of ex.diffs) {
        console.log(`    Line ${d.line}:`);
        console.log(`      BEFORE: ${d.before}`);
        console.log(`      AFTER:  ${d.after}`);
      }
      console.log('');
    }
  }
}

main();
