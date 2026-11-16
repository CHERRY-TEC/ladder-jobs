/* Sanity-checks generated SQL files: paren balance + row/column counts. */
import { readFileSync } from 'node:fs'

const sql = readFileSync('supabase/migrations/0004_demo_seed.sql', 'utf8')

let bal = 0
for (const ch of sql) {
  if (ch === '(') bal++
  if (ch === ')') bal--
}
console.log('paren balance (should be 0):', bal)

const i = sql.indexOf('insert into ladder_jobs')
const header = sql.slice(i, sql.indexOf(') values', i))
const cols = header.split('(')[1].split(',').length
console.log('columns declared:', cols)

const valsStart = sql.indexOf('values', i) + 'values'.length
const row = sql.slice(valsStart)
let depth = 0
let start = -1
let end = -1
for (let k = 0; k < row.length; k++) {
  const c = row[k]
  if (c === '(') {
    if (depth === 0) start = k
    depth++
  } else if (c === ')') {
    depth--
    if (depth === 0) {
      end = k
      break
    }
  }
}
const first = row.slice(start + 1, end)
let d = 0
let bracket = 0
let parts = 1
let inStr = false
for (const c of first) {
  if (c === "'") inStr = !inStr
  if (!inStr) {
    if (c === '(') d++
    if (c === ')') d--
    if (c === '[') bracket++
    if (c === ']') bracket--
    if (c === ',' && d === 0 && bracket === 0) parts++
  }
}
console.log('values in first row (should equal columns):', parts)

const rows = sql.match(/'active',\s*'demo'/g) || []
console.log('job rows:', rows.length)

const catRows = sql.match(/on conflict \(id\) do update set name/g)
console.log('category upsert present:', Boolean(catRows))

// Also verify every tuple in the jobs insert has the same value count.
const valuesBlock = sql.slice(sql.indexOf(') values', i) + ') values'.length)
let tupleCount = 0
let mismatches = 0
let dd = 0
let s = -1
for (let k = 0; k < valuesBlock.length; k++) {
  const c = valuesBlock[k]
  if (c === '(') {
    if (dd === 0) s = k
    dd++
  } else if (c === ')') {
    dd--
    if (dd === 0 && s >= 0) {
      const tuple = valuesBlock.slice(s + 1, k)
      if (tuple.includes("'active'")) {
        tupleCount++
        let dd2 = 0
        let br2 = 0
        let p = 1
        let inS = false
        for (const ch2 of tuple) {
          if (ch2 === "'") inS = !inS
          if (!inS) {
            if (ch2 === '(') dd2++
            if (ch2 === ')') dd2--
            if (ch2 === '[') br2++
            if (ch2 === ']') br2--
            if (ch2 === ',' && dd2 === 0 && br2 === 0) p++
          }
        }
        if (p !== cols) {
          mismatches++
          console.log(`  MISMATCH: tuple has ${p} values, expected ${cols}`)
        }
      }
      s = -1
    }
  }
}
console.log('job tuples checked:', tupleCount, '| mismatches:', mismatches)

// Check 0002/0003 paren balance too.
for (const f of ['0001_ladder_schema.sql', '0002_rls.sql', '0003_storage.sql']) {
  const t = readFileSync(`supabase/migrations/${f}`, 'utf8')
  let b = 0
  let inDollar = false
  let line = ''
  // crude: ignore content between $$ markers
  const segments = t.split('$$')
  segments.forEach((seg, idx) => {
    if (idx % 2 === 0) {
      for (const ch of seg) {
        if (ch === '(') b++
        if (ch === ')') b--
      }
    }
  })
  console.log(`${f} paren balance outside $$: ${b}`)
}
