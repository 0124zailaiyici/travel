// 本地配置模板 —— 这个文件会提交进仓库，保证 clone 下来就能构建。
// 真实 Key 请写到 config.local.private.js（已 gitignore），或在 App 内「设置」页填写。
// 优先级：DEFAULTS < config.local.js < config.local.private.js < 运行时 storage
export default {
  tencentMapKey: '',
  deepseekKey: '',
  deepseekBase: 'https://api.deepseek.com',
  aiModel: 'deepseek-chat',
}