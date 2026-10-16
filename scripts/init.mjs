#!/usr/bin/env node
// 작업 폴더 생성: 템플릿 복사(기존 파일은 덮어쓰지 않음) + git init + 첫 커밋
// usage: node init.mjs <작업폴더>
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { spawnSync } from 'node:child_process'

const SKILL = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const target = process.argv[2]
if (!target) {
  console.error('usage: node init.mjs <작업폴더>')
  process.exit(1)
}
const BASE = path.resolve(target)
const TEMPLATE = path.join(SKILL, 'template')

const created = []
const skipped = []
function copyDir(src, dst) {
  fs.mkdirSync(dst, { recursive: true })
  for (const name of fs.readdirSync(src)) {
    const s = path.join(src, name)
    const d = path.join(dst, name === 'gitignore' ? '.gitignore' : name)
    if (fs.statSync(s).isDirectory()) copyDir(s, d)
    else if (fs.existsSync(d)) skipped.push(path.relative(BASE, d))
    else {
      fs.copyFileSync(s, d)
      created.push(path.relative(BASE, d))
    }
  }
}
copyDir(TEMPLATE, BASE)
for (const d of ['00-input/spec-raw', '00-spec/sheets', '_history', '.run/out', '.run/logs']) {
  fs.mkdirSync(path.join(BASE, d), { recursive: true })
}

const git = (...a) => spawnSync('git', ['-C', BASE, ...a], { encoding: 'utf8' })
if (!fs.existsSync(path.join(BASE, '.git'))) git('init', '-q', '-b', 'main')
git('add', '-A')
if (git('diff', '--cached', '--quiet').status !== 0) {
  git('commit', '-q', '-m', '[setup] spec-schema-org 작업 폴더 생성')
}

console.log(JSON.stringify({ base: BASE, created: created.length, skipped }, null, 2))
console.log(`
다음 단계:
  1. 명세서 원본을 ${path.join(BASE, 'spec')}/ 에 넣는다 (xlsx·csv·md·docx·pdf)
  2. ${path.join(BASE, 'config.json')} 을 채운다  (참고: ${path.join(SKILL, 'docs/config-reference.md')}, db-presets.md)
  3. node ${path.join(SKILL, 'scripts/run.mjs')} --dir ${BASE} --check
  4. node ${path.join(SKILL, 'scripts/run.mjs')} --dir ${BASE} --run A`)
