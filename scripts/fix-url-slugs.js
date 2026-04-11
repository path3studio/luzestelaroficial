#!/usr/bin/env node
/**
 * fix-url-slugs.js — Revert accented directory slugs in URL contexts
 * ====================================================================
 * The earlier (buggy) pass of fix-accents.js rewrote visible text like
 * "horoscopo" → "horóscopo" AND "numerologia" → "numerología" AND
 * "diseno" → "diseño" globally, including inside URL strings, canonical
 * tags, Open Graph metadata, JSON-LD payloads, hrefs, and JS string
 * literals that reference paths. The real directories on disk have NO
 * accents (horoscopo-chino/, numerologia/, diseno-humano/, astrologia-vedica/),
 * so the corrupted URLs all 404.
 *
 * This script fixes the URL context WITHOUT touching visible Spanish
 * prose. Example:
 *
 *   content="https://luzestelaroficial.com/numerologia/numero-1.html"
 *   → content="https://luzestelaroficial.com/numerologia/numero-1.html"
 *
 * But leaves alone:
 *
 *   <p>Descubre tu número en la numerología.</p>  (visible text, accented)
 *
 * Strategy
 * --------
 * For each dangerous accented slug, only replace when it appears between
 * URL boundaries: slash, quote, opening paren, equals sign, or at start
 * of the match. We match `/<accented-slug>(?=[/'"\s])` and similar
 * patterns to guarantee we're inside a path.
 *
 * Usage: node scripts/fix-url-slugs.js [--dry-run]
 */

const fs = require('fs');
const path = require('path');

const DRY_RUN = process.argv.includes('--dry-run');
const BASE = path.resolve(__dirname, '..');

// Accented slug → correct unaccented slug. The LEFT side must be something
// that should never appear inside a real URL on this site; the RIGHT side
// is the actual directory name on disk.
const SLUG_FIXES = [
  { accented: 'horóscopo-chino', plain: 'horoscopo-chino' },
  { accented: 'numerología',      plain: 'numerologia'      },
  { accented: 'diseño-humano',    plain: 'diseno-humano'    },
  { accented: 'astrología-védica',plain: 'astrologia-vedica'},
  { accented: 'astrología-maya',  plain: 'astrologia-maya'  },
  { accented: 'astrología',       plain: 'astrologia'       }, // catch stragglers
  { accented: 'védica',           plain: 'vedica'           }, // catch stragglers inside paths
];

// Build regexes that only match inside URL-like contexts.
// A slug is in URL context if it is:
//   (a) preceded by `/` and followed by `/`, `'`, `"`, whitespace, end-of-string, `)`, `?`, `#`, or `.`
//   (b) preceded by `'` or `"` and followed by `/` (slug at start of a quoted path)
// This avoids visible text like "la numerología" where the slug isn't flanked by URL punctuation.
function urlContextRegex(slug) {
  // Escape regex metachars in the slug (accents are literal, no escaping needed).
  const escaped = slug.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  // Two capture forms, joined with alternation. Using lookbehind + lookahead to keep
  // the surrounding characters untouched and only swap the slug itself.
  return new RegExp(
    // (a) after a /, before URL terminator
    `(?<=\\/)${escaped}(?=[/'"\\s)?#.])`
    + '|'
    // (b) after a quote, before /
    + `(?<=['"\\\`])${escaped}(?=\\/)`,
    'g'
  );
}

const compiled = SLUG_FIXES.map(({ accented, plain }) => ({
  re: urlContextRegex(accented),
  plain,
  accented,
}));

function collectTargetFiles(dir) {
  let results = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (entry.isDirectory()) {
      if (entry.name === 'node_modules' || entry.name === '.git') continue;
      results = results.concat(collectTargetFiles(path.join(dir, entry.name)));
    } else if (entry.isFile()) {
      const ext = path.extname(entry.name);
      if (ext === '.html' || ext === '.js' || ext === '.xml' || ext === '.json') {
        results.push(path.join(dir, entry.name));
      }
    }
  }
  return results;
}

function fixFile(filePath) {
  const original = fs.readFileSync(filePath, 'utf8');
  let text = original;
  const hits = Object.create(null);
  for (const { re, plain, accented } of compiled) {
    text = text.replace(re, () => {
      hits[accented] = (hits[accented] || 0) + 1;
      return plain;
    });
  }
  if (text !== original) {
    if (!DRY_RUN) fs.writeFileSync(filePath, text, 'utf8');
    return { modified: true, hits };
  }
  return { modified: false, hits };
}

function main() {
  console.log('\n' + '='.repeat(70));
  console.log('  fix-url-slugs.js — revert accented slugs inside URL contexts');
  console.log(`  Mode: ${DRY_RUN ? 'DRY RUN' : 'LIVE'}`);
  console.log('='.repeat(70) + '\n');

  const files = collectTargetFiles(BASE);
  console.log(`Scanning ${files.length} files...\n`);

  let modifiedCount = 0;
  const totals = Object.create(null);
  for (const f of files) {
    const result = fixFile(f);
    if (result.modified) {
      modifiedCount++;
      for (const [k, v] of Object.entries(result.hits)) {
        totals[k] = (totals[k] || 0) + v;
      }
      if (modifiedCount <= 20) {
        console.log(`  [FIXED] ${path.relative(BASE, f)}  →  ${JSON.stringify(result.hits)}`);
      } else if (modifiedCount === 21) {
        console.log('  … (further output truncated)');
      }
    }
  }

  console.log('\n' + '─'.repeat(70));
  console.log(`\nSummary: ${modifiedCount} / ${files.length} files fixed.\n`);
  console.log('Total replacements per slug:');
  for (const [k, v] of Object.entries(totals)) {
    console.log(`  ${k.padEnd(24)} → ${v}`);
  }
  console.log('');
}

main();
