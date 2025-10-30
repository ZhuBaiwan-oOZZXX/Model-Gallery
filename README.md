感谢 [https://github.com/lobehub/lobe-icons](https://github.com/lobehub/lobe-icons) 项目提供的图标

## deno 部署
1. 登录 [deno](https://dash.deno.com)
2. 创建一个 New Playground
3. 粘贴 deno.ts 代码
4. 设置中添加环境变量

环境变量至少添加：
- `API_URL`：需填写至 /v1/models，例如：`https://api.openai.com/v1/models`
- `API_KEY`：对应密钥

## 添加图标

1. 添加图标在 ICON_CONFIG 配置，冒号前的内容随意，每个图标配置的 `icon` 和 `keywords` 属性才决定分组名

- `icon`：存储实际的图标 URL
- `keywords`：用于匹配模型名称的关键词

2. 怎么分组的：
- 遍历所有模型
- 查找模型名称中第一个出现的分隔符（"/"、"-" 或 "_"）
- 将分隔符前的部分作为分组的前缀名称
- 如果模型名称中没有分隔符，则将整个模型名称作为分组前缀

---

如果你的分组名很混乱，建议在 NewAPI 中的重定向修改模型名称。
