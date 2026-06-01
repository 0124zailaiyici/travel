/**
 * 过滤新加的目的地：保留高质量、有旅行价值的
 * 运行: node scripts/cleanup-destinations.js
 */
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const dests = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'src', 'data', 'destinations.json'), 'utf-8'))

// 原始56个目的地保留
const originals = dests.filter(d => {
  const n = parseInt(d.id.replace('d', ''))
  return n <= 56
})

// 新加的过滤
const NEW_MIN_RATING = 4.0
const EXCLUDE_KEYWORDS = ['管理处','游园','游乐场','广场','纪念林','友谊长廊','东堤','市民广场','小游园','服务中心','售票处','停车场','办公室','办公区','入口','出口','遗址城北','紫园','南段']
const EXCLUDE_PATTERNS = [/^[\w]{2,4}亭$/, /^[\w]{2,4}寺$/, /^[\w]{2,4}庙$/, /^[\w]{2,4}园$/]

function isSubArea(name) {
  // 包含 - 或 （ 的通常是子区域
  if (name.includes('-') || name.includes('(') || name.includes('（')) return true
  return false
}

function hasExcludeKeyword(name) {
  return EXCLUDE_KEYWORDS.some(k => name.includes(k))
}

function matchesExcludePattern(name) {
  return EXCLUDE_PATTERNS.some(p => p.test(name))
}

const news = dests.filter(d => {
  const n = parseInt(d.id.replace('d', ''))
  if (n <= 56) return false
  if (d.rating < NEW_MIN_RATING) return false
  if (isSubArea(d.name)) return false
  if (hasExcludeKeyword(d.name)) return false
  if (matchesExcludePattern(d.name)) return false
  return true
})

console.log(`原始: ${originals.length} 个`)
console.log(`新加(过滤后): ${news.length} 个`)
news.forEach(d => console.log(`  ${d.id} ${d.name} (${d.rating}★)`))

// 合并并去重
const merged = [...originals]
const seen = new Set(originals.map(d => d.id))
for (const d of news) {
  if (!seen.has(d.id)) { merged.push(d); seen.add(d.id) }
}

fs.writeFileSync(
  path.join(__dirname, '..', 'src', 'data', 'destinations.json'),
  JSON.stringify(merged, null, 2),
  'utf-8'
)
console.log(`\n写入 ${merged.length} 个目的地`)
