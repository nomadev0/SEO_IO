#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { setTimeout as delay } from 'node:timers/promises';

const PREVIEW_URL = process.env.PREVIEW_URL;

const log = (lvl, msg) => console.log(`[${lvl}] ${msg}`);
const fail = (msg) => { console.error(`❌ ${msg}`); process.exitCode = 1; };

async function fetchHtml(url) {
  const res = await fetch(url, { redirect: 'follow' });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return await res.text();
}

function checkHtml(html, url) {
  const hasNoindex = /<meta[^>]+name=["']robots["'][^>]+content=["'][^"']*noindex/i.test(html);
  const hasCanonical = /<link[^>]+rel=["']canonical["']/i.test(html);
  const titleMatch = html.match(/<title>([^<]{0,200})<\/title>/i);
  const title = titleMatch ? titleMatch[1].trim() : '';
  const h1Match = html.match(/<h1[^>]*>([\s\S]*?)<\/h1>/i);
  const hasH1 = !!h1Match;

  if (hasNoindex) fail(`${url} tiene <meta name="robots" content*noindex*>`);
  if (!hasCanonical) log('WARN', `${url} sin <link rel="canonical">`);
  if (!title || title.length < 10 || title.length > 65) log('WARN', `${url} title length=${title.length}`);
  if (!hasH1) log('WARN', `${url} sin <h1>`);
}

async function main() {
  if (PREVIEW_URL) {
    try {
      log('INFO', `Chequeando PREVIEW_URL=${PREVIEW_URL}`);
      const html = await fetchHtml(PREVIEW_URL);
      checkHtml(html, PREVIEW_URL);
      for (const p of ['/robots.txt', '/sitemap.xml']) {
        try {
          const res = await fetch(new URL(p, PREVIEW_URL));
          if (!res.ok) fail(`${p} devolvió HTTP ${res.status}`);
        } catch (e) { fail(`No accesible ${p}: ${e.message}`); }
        await delay(100);
      }
    } catch (e) {
      fail(`No se pudo chequear preview: ${e.message}`);
    }
  } else {
    log('INFO', 'PREVIEW_URL no definido. Ejecutando lint básico de archivos…');
    const root = path.dirname(fileURLToPath(import.meta.url));
    const repo = path.join(root, '..', '..');
    const files = listFiles(repo).filter(f => /(\.html?|\.tsx?|\.jsx?)$/i.test(f)).slice(0, 500);
    for (const f of files) {
      const content = fs.readFileSync(f, 'utf8');
      if (/noindex/i.test(content) && !/\bENV\b|process\.env\.(STAGING|PREVIEW)/.test(content)) {
        log('WARN', `Posible noindex duro en ${path.relative(repo, f)}`);
      }
    }
  }
  if (process.exitCode === 1) process.exit(1);
}

function listFiles(dir) {
  const out = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, entry.name);
    if (entry.isDirectory() && !['.git', 'node_modules', '.next'].includes(entry.name)) out.push(...listFiles(p));
    else if (entry.isFile()) out.push(p);
  }
  return out;
}

main();