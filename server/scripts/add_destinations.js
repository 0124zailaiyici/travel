import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const dataPath = path.join(__dirname, '..', 'src', 'data', 'destinations.json')

const data = JSON.parse(fs.readFileSync(dataPath, 'utf-8'))
const startId = data.length + 1

const newDests = [
  {
    id: `d${startId}`, name: '南宁青秀山', lat: 22.7939, lng: 108.3840, address: '南宁市青秀区凤岭南路6号', rating: 4.6,
    best_season: '全年', description: '南宁绿肺，城市中的森林氧吧，登顶可俯瞰南宁全景', highlights: ['龙象塔', '观音禅寺', '天池'],
    tags: ['公园', '南宁', '1日游'], image_url: '', duration: 1, transport_guide: '地铁3号线青秀山站',
    theme_ids: ['t10'], nearby: [{"name": "南宁南湖公园", "dist": 5}],
    budget: { transport: 10, accommodation: 0, food: 60, tickets: 20 }
  },
  {
    id: `d${startId+1}`, name: '桂林漓江', lat: 25.2736, lng: 110.2903, address: '桂林市灵川县磨盘山码头', rating: 4.8,
    best_season: '4-10月', description: '桂林山水甲天下，漓江竹筏漂流赏两岸奇峰', highlights: ['九马画山', '黄布倒影', '20元人民币背景'],
    tags: ['自然', '桂林', '2日游'], image_url: '', duration: 2, transport_guide: '桂林市区乘大巴到磨盘山码头',
    theme_ids: ['t3', 't4'], nearby: [{"name": "阳朔西街", "dist": 60}],
    budget: { transport: 100, accommodation: 300, food: 200, tickets: 320 }
  },
  {
    id: `d${startId+2}`, name: '阳朔西街', lat: 24.7788, lng: 110.4963, address: '桂林市阳朔县', rating: 4.5,
    best_season: '4-10月', description: '中西合璧的千年老街，漓江边最热闹的夜生活地', highlights: ['西街步行街', '印象刘三姐', '遇龙河漂流'],
    tags: ['古镇', '桂林', '2日游'], image_url: '', duration: 2, transport_guide: '高铁阳朔站乘公交到县城',
    theme_ids: ['t7'], nearby: [{"name": "漓江", "dist": 1}],
    budget: { transport: 80, accommodation: 350, food: 250, tickets: 200 }
  },
  {
    id: `d${startId+3}`, name: '德天跨国瀑布', lat: 22.8567, lng: 106.7244, address: '崇左市大新县硕龙镇', rating: 4.7,
    best_season: '6-11月', description: '亚洲第一跨国瀑布，中越边境的壮丽画卷', highlights: ['德天瀑布', '中越界碑', '明仕田园'],
    tags: ['自然', '广西', '2日游'], image_url: '', duration: 2, transport_guide: '南宁琅东客运站乘大巴到大新',
    theme_ids: ['t3'], nearby: [{"name": "明仕田园", "dist": 20}],
    budget: { transport: 150, accommodation: 250, food: 200, tickets: 80 }
  },
  {
    id: `d${startId+4}`, name: '黄果树瀑布', lat: 25.9947, lng: 105.6653, address: '安顺市镇宁布依族苗族自治县', rating: 4.7,
    best_season: '6-10月', description: '中国最大瀑布，西游记取景地，水势磅礴', highlights: ['黄果树大瀑布', '陡坡塘', '天星桥'],
    tags: ['自然', '贵州', '2日游'], image_url: '', duration: 2, transport_guide: '贵阳北站乘高铁到安顺西转大巴',
    theme_ids: ['t3'], nearby: [{"name": "龙宫", "dist": 30}],
    budget: { transport: 120, accommodation: 300, food: 200, tickets: 180 }
  },
  {
    id: `d${startId+5}`, name: '荔波小七孔', lat: 25.2567, lng: 107.6783, address: '黔南州荔波县', rating: 4.7,
    best_season: '5-10月', description: '地球上的绿宝石，七孔古桥与68级跌水瀑布', highlights: ['小七孔桥', '拉雅瀑布', '卧龙潭'],
    tags: ['自然', '贵州', '2日游'], image_url: '', duration: 2, transport_guide: '贵阳乘高铁到荔波站转公交',
    theme_ids: ['t3', 't4'], nearby: [{"name": "大七孔", "dist": 5}],
    budget: { transport: 150, accommodation: 300, food: 200, tickets: 130 }
  },
  {
    id: `d${startId+6}`, name: '西江千户苗寨', lat: 26.4958, lng: 108.1803, address: '黔东南州雷山县', rating: 4.5,
    best_season: '5-10月', description: '中国最大苗族聚居村寨，万家灯火夜景震撼', highlights: ['观景台', '苗族博物馆', '长桌宴'],
    tags: ['古镇', '贵州', '2日游'], image_url: '', duration: 2, transport_guide: '贵阳北站乘高铁到凯里南转大巴',
    theme_ids: ['t7'], nearby: [{"name": "镇远古镇", "dist": 120}],
    budget: { transport: 100, accommodation: 250, food: 200, tickets: 90 }
  },
  {
    id: `d${startId+7}`, name: '大理古城', lat: 25.6883, lng: 100.2294, address: '大理市大理古城', rating: 4.6,
    best_season: '3-5月 9-11月', description: '风花雪月的浪漫古城，苍山洱海间的慢生活', highlights: ['洱海', '苍山', '崇圣寺三塔'],
    tags: ['古镇', '云南', '3日游'], image_url: '', duration: 3, transport_guide: '高铁大理站乘公交到古城',
    theme_ids: ['t7'], nearby: [{"name": "洱海", "dist": 2}],
    budget: { transport: 200, accommodation: 350, food: 250, tickets: 0 }
  },
  {
    id: `d${startId+8}`, name: '昆明滇池', lat: 24.9604, lng: 102.6573, address: '昆明市西山区滇池路', rating: 4.5,
    best_season: '11-3月', description: '云南最大的淡水湖，冬季红嘴鸥漫天飞舞', highlights: ['滇池大坝', '西山龙门', '云南民族村'],
    tags: ['自然', '云南', '2日游'], image_url: '', duration: 2, transport_guide: '地铁5号线迎海路站',
    theme_ids: ['t3', 't10'], nearby: [{"name": "云南民族村", "dist": 3}],
    budget: { transport: 30, accommodation: 300, food: 200, tickets: 0 }
  },
  {
    id: `d${startId+9}`, name: '西双版纳热带植物园', lat: 21.9261, lng: 101.2615, address: '西双版纳州勐腊县', rating: 4.7,
    best_season: '11-4月', description: '中国面积最大、植物种类最丰富的植物园', highlights: ['棕榈园', '奇花异木园', '百花园'],
    tags: ['花海', '云南', '2日游'], image_url: '', duration: 2, transport_guide: '飞机到版纳嘎洒机场，包车1h',
    theme_ids: ['t10'], nearby: [{"name": "告庄西双景", "dist": 60}],
    budget: { transport: 300, accommodation: 300, food: 200, tickets: 80 }
  },
  {
    id: `d${startId+10}`, name: '龙脊梯田', lat: 25.7489, lng: 110.0117, address: '桂林市龙胜县', rating: 4.7,
    best_season: '5-10月', description: '世界梯田之冠，层层叠叠如天梯直通云霄', highlights: ['金坑大寨', '平安壮寨', '七星伴月'],
    tags: ['自然', '桂林', '3日游'], image_url: '', duration: 3, transport_guide: '桂林琴潭汽车站乘大巴到龙脊',
    theme_ids: ['t3', 't8'], nearby: [{"name": "桂林市区", "dist": 80}],
    budget: { transport: 100, accommodation: 250, food: 200, tickets: 80 }
  },
  {
    id: `d${startId+11}`, name: '梵净山', lat: 27.9138, lng: 108.6617, address: '铜仁市江口县', rating: 4.6,
    best_season: '4-10月', description: '武陵之巅，云海佛光与红云金顶的佛教圣山', highlights: ['红云金顶', '蘑菇石', '承恩寺'],
    tags: ['雪山', '贵州', '2日游'], image_url: '', duration: 2, transport_guide: '高铁铜仁站乘大巴到梵净山',
    theme_ids: ['t2'], nearby: [{"name": "镇远古镇", "dist": 150}],
    budget: { transport: 150, accommodation: 300, food: 200, tickets: 100 }
  },
  {
    id: `d${startId+12}`, name: '桂林两江四湖', lat: 25.2756, lng: 110.2956, address: '桂林市象山区', rating: 4.5,
    best_season: '全年', description: '桂林城市名片，乘船夜游赏日月双塔灯光秀', highlights: ['日月双塔', '象鼻山', '榕杉湖'],
    tags: ['自然', '桂林', '1日游'], image_url: '', duration: 1, transport_guide: '桂林站步行10分钟',
    theme_ids: ['t3'], nearby: [{"name": "象鼻山", "dist": 1}],
    budget: { transport: 20, accommodation: 0, food: 100, tickets: 80 }
  },
  {
    id: `d${startId+14}`, name: '贵阳黔灵山公园', lat: 26.5967, lng: 106.7025, address: '贵阳市云岩区枣山路', rating: 4.4,
    best_season: '全年', description: '黔南第一山，市区内的天然氧吧，猴子满山跑', highlights: ['弘福寺', '黔灵湖', '猕猴观赏园'],
    tags: ['公园', '贵州', '1日游'], image_url: '', duration: 1, transport_guide: '地铁1号线八鸽岩站',
    theme_ids: ['t10'], nearby: [{"name": "甲秀楼", "dist": 3}],
    budget: { transport: 10, accommodation: 0, food: 80, tickets: 5 }
  }
]

data.push(...newDests)
fs.writeFileSync(dataPath, JSON.stringify(data, null, 2), 'utf-8')
console.log(`Added ${newDests.length} destinations (d${startId} - d${startId + newDests.length - 1})`)
