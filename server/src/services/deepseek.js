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
2. "tips" — 至少8条避坑/实用建议，如：最佳拍照点、排队策略、省钱技巧、天气应对、周边彩蛋
3. "budget" — 包含 transport/accommodation/food/tickets/other，数值单位元

写作风格：像朋友安利一样真实具体，避免套话。每段至少50字，包含具体地名、店名、价格参考。`

  try {
    const { data } = await axios.post(`${DS_BASE}/chat/completions`, {
      model: 'deepseek-chat',
      messages: [{ role: 'user', content: prompt }],
      temperature: 0.8,
      max_tokens: 4000,
      response_format: { type: 'json_object' }
    }, {
      headers: { 'Authorization': `Bearer ${DS_KEY}`, 'Content-Type': 'application/json' },
      timeout: 60000
    })
    return JSON.parse(data.choices[0].message.content)
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
