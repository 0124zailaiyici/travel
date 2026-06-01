/**
 * 搜索高德 POI + DeepSeek 生成新目的地数据
 * 用法: node scripts/expand-destinations.js
 */
import 'dotenv/config'
import axios from 'axios'
import { v4 as uuid } from 'uuid'
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const AMAP_KEY = process.env.AMAP_KEY
const AMAP_BASE = 'https://restapi.amap.com/v3'

const ALLOW_TYPES = [
  '风景名胜','名胜古迹','旅游景点',
  '公园广场','城市广场',
  '动物园','植物园','水族馆','海洋馆',
  '博物馆','美术馆','展览馆','科技馆','纪念馆','陈列馆',
  '游乐场','游乐园','主题乐园','度假村','度假区','温泉','滑雪场',
  '文物古迹','文物保护','自然保护区','地质公园','森林公园',
  '教堂','寺庙','道观','清真寺','历史建筑','名人故居','故居',
  '特色商业街','步行街','历史街区','文化旅游',
  '海滨','沙滩','湖泊','山岳','瀑布','河流','湿地','岛屿','峡谷','洞穴',
  '赏花','采摘','农家乐','田园','农场',
]

function isRelevant(type) {
  if (!type) return false
  return ALLOW_TYPES.some(a => type.includes(a))
}

async function searchPOI(keyword, city, page = 1) {
  const { data } = await axios.get(`${AMAP_BASE}/place/text`, {
    params: { key: AMAP_KEY, keywords: keyword, city, offset: 20, page, extensions: 'all' },
    timeout: 10000
  })
  if (data.status !== '1') throw new Error(`高德搜索失败: ${data.info}`)
  return data.pois.filter(p => isRelevant(p.type)).map(p => ({
    id: p.id, name: p.name, lat: parseFloat(p.location.split(',')[1]),
    lng: parseFloat(p.location.split(',')[0]), address: String(p.address || ''),
    rating: p.biz_ext?.rating ? parseFloat(p.biz_ext.rating) : 0,
    type: p.type,
    photos: (p.photos || []).slice(0, 3).map(ph => ph.url),
    business_area: p.business_area || ''
  }))
}

async function searchCity(city, keywords) {
  const all = []
  for (const kw of keywords) {
    for (let page = 1; page <= 3; page++) {
      try {
        const items = await searchPOI(kw, city, page)
        all.push(...items)
        if (items.length < 20) break
      } catch (e) {
        console.error(`  搜索 "${kw}" 第${page}页失败: ${e.message}`)
        break
      }
    }
  }
  // deduplicate
  const seen = new Set()
  return all.filter(p => {
    const k = p.name + p.address
    if (seen.has(k)) return false
    seen.add(k)
    return true
  })
}

function pickSeason(type) {
  if (type.includes('赏花') || type.includes('植物园')) return '3-4月'
  if (type.includes('滑雪')) return '12-2月'
  if (type.includes('温泉')) return '11-3月'
  if (type.includes('海滨') || type.includes('沙滩') || type.includes('漂流') || type.includes('瀑布')) return '6-9月'
  return '全年'
}

function pickTags(type) {
  const tags = []
  if (type.includes('公园') || type.includes('植物园')) tags.push('公园')
  if (type.includes('博物馆') || type.includes('展览')) tags.push('博物馆')
  if (type.includes('山') || type.includes('徒步') || type.includes('森林')) tags.push('登山')
  if (type.includes('历史') || type.includes('文物') || type.includes('故居') || type.includes('寺庙')) tags.push('历史')
  if (type.includes('乐园') || type.includes('游乐')) tags.push('亲子')
  if (type.includes('海滨') || type.includes('沙滩') || type.includes('湖泊')) tags.push('自然')
  if (type.includes('步行街') || type.includes('商业')) tags.push('逛街')
  if (type.includes('温泉')) tags.push('温泉')
  if (tags.length === 0) tags.push('景点')
  return tags
}

function generateThemeId(poi) {
  const name = poi.name
  const type = poi.type || ''
  if (type.includes('赏花') || type.includes('植物园') || name.includes('花')) return 't1'
  if (type.includes('山') || type.includes('徒步') || type.includes('森林') || type.includes('峡谷')) return 't2'
  if (type.includes('海滨') || type.includes('沙滩') || type.includes('漂流') || type.includes('瀑布')) return 't3'
  if (type.includes('历史') || type.includes('文物') || type.includes('故居') || type.includes('寺庙') || type.includes('博物馆')) return 't7'
  if (type.includes('乐园') || type.includes('游乐')) return 't5'
  if (type.includes('温泉')) return 't9'
  if (type.includes('公园') || type.includes('广场')) return 't2'
  return 't3'
}

const CITIES = [
  { name: '柳州', keywords: ['柳州景点', '柳州公园', '柳州博物馆', '柳州古镇', '柳州风景区', '柳州山'] },
  { name: '河池', keywords: ['河池景点', '河池风景区', '河池公园', '河池峡谷'] },
  { name: '来宾', keywords: ['来宾景点', '来宾公园', '来宾风景区'] },
  { name: '南宁', keywords: ['南宁景点', '南宁公园', '南宁博物馆', '南宁古镇', '南宁风景区'] },
]

const themes = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'src', 'data', 'themes.json'), 'utf-8'))

async function main() {
  const existing = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'src', 'data', 'destinations.json'), 'utf-8'))
  const existingNames = new Set(existing.map(d => d.name))
  let newCount = 0
  let idCounter = existing.length + 1

  for (const city of CITIES) {
    console.log(`\n=== 搜索 ${city.name} ===`)
    const pois = await searchCity(city.name, city.keywords)
    console.log(`  找到 ${pois.length} 个相关 POI`)

    for (const poi of pois) {
      if (existingNames.has(poi.name) || poi.rating < 3.5) continue
      if (!poi.address) continue

      const id = 'd' + idCounter++
      const entry = {
        id,
        name: poi.name,
        lat: poi.lat,
        lng: poi.lng,
        address: poi.address,
        rating: poi.rating || 4.0,
        best_season: pickSeason(poi.type),
        description: `${poi.name}位于${poi.address}，${poi.type || '旅游景点'}`,
        highlights: [poi.name],
        tags: pickTags(poi.type),
        image_url: poi.photos?.[0] || '',
        duration: 2,
        transport_guide: '',
        theme_ids: [generateThemeId(poi)],
        nearby: [],
        budget: {
          transport: 200, accommodation: 300, food: 200, tickets: 80
        }
      }
      existing.push(entry)
      existingNames.add(poi.name)
      newCount++
      console.log(`  [+] ${id} ${poi.name} (${poi.rating}★)`)
    }
  }

  if (newCount === 0) {
    console.log('\n没有新目的地可添加')
    return
  }

  console.log(`\n新加 ${newCount} 个目的地，现有共 ${existing.length} 个`)

  // deduplicate by id
  const byId = new Map()
  for (const d of existing) byId.set(d.id, d)

  fs.writeFileSync(
    path.join(__dirname, '..', 'src', 'data', 'destinations.json'),
    JSON.stringify([...byId.values()], null, 2),
    'utf-8'
  )
  console.log(`写入 destinations.json (${byId.size} 个目的地)`)
}

main().catch(console.error)
