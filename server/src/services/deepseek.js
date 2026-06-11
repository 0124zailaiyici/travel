import axios from 'axios'

const DS_KEY = process.env.DEEPSEEK_KEY
const DS_BASE = 'https://api.deepseek.com'

export async function generateItinerary(destination) {
  if (!DS_KEY || DS_KEY === 'your_deepseek_key') {
    return generateFallbackItinerary(destination)
  }
  const prompt = `你是资深旅行达人，为朋友写一份超详细的自由行攻略。

目的地：${destination.name}
地址：${destination.address}
亮点：${(destination.highlights || []).join('、')}
最佳季节：${destination.best_season}
建议天数：${destination.duration || 2}天

要求输出JSON，包含以下字段：
1. "itinerary" — 每天一个对象，含：
   - title: 当天主题
   - morning: 具体到时间段（如"8:00-10:00 xxx"），包含景点名称、交通方式、门票信息
   - afternoon: 同上，详细
   - evening: 同上，含具体餐厅推荐和招牌菜
   - meals: 当天推荐美食（具体店名+必点菜）
2. "transport" — 详细交通方案，含：
   - "to_destination": 从最近大城市/机场/高铁站到目的地的具体方式（如"从桂林站乘高铁到阳朔站，出站左转50米乘阳朔公交1路到西街口"）
   - "around": 当地交通建议（如"租电动车30元/天，打车起步价9元"）
   - "parking": 自驾停车建议（如果没有可以写"无"）
3. "tips" — 至少8条避坑/实用建议，如：最佳拍照点、排队策略、省钱技巧、天气应对、周边彩蛋
3. "budget" — 预算明细，每个分类含total和items数组，示例：
   "transport": {"total": 200, "items": [{"name":"高铁往返","cost":150},{"name":"市内公交","cost":50}]}
   "accommodation": {"total": 400, "items": [{"name":"民宿两晚","cost":400}]}
   "food": {"total": 250, "items": [{"name":"正餐","cost":180},{"name":"小吃","cost":70}]}
   "tickets": {"total": 100, "items": [{"name":"景区门票","cost":100}]}
   分类：transport/accommodation/food/tickets/other，每个分类都要有total和items

写作风格：像朋友安利一样真实具体，避免套话。每段至少50字，包含具体地名、店名、价格参考。`

  try {
    const { data } = await axios.post(`${DS_BASE}/chat/completions`, {
      model: 'deepseek-chat',
      messages: [{ role: 'user', content: prompt }],
      temperature: 0.7,
      max_tokens: 8192,
      response_format: { type: 'json_object' }
    }, {
      headers: { 'Authorization': `Bearer ${DS_KEY}`, 'Content-Type': 'application/json' },
      timeout: 15000
    })
    const raw = data.choices[0].message.content
    console.log('DS raw length:', raw.length, 'preview:', raw.slice(0, 120))
    try { return JSON.parse(raw) } catch (e) {
      console.error('DeepSeek bad JSON (len=' + raw.length + '):', raw.slice(0, 200))
      // attempt to repair truncated JSON
      const repaired = raw.replace(/,\s*$/, '').replace(/\}\s*$/, '').replace(/\][^}]*$/, ']')
      try { return JSON.parse(repaired) } catch {}
      throw e
    }
  } catch (e) {
    console.error('DeepSeek API error:', e.message)
    return generateFallbackItinerary(destination)
  }
}

function generateFallbackItinerary(destination) {
  const days = destination.duration || 2
  const itinerary = []
  for (let i = 1; i <= days; i++) {
    itinerary.push({
      title: `第${i}天 探索${destination.name}`,
      morning: `前往${destination.name}，游览核心景区`,
      afternoon: '周边探索与拍照打卡',
      evening: '品尝当地美食，入住休息'
    })
  }
  return {
    itinerary,
    tips: ['建议提前预订住宿', '关注天气变化，带好防晒/保暖用品'],
    budget: { transport: 200, accommodation: 300, food: 200, tickets: 100 }
  }
}
