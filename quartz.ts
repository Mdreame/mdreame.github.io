import { loadQuartzConfig, loadQuartzLayout } from "./quartz/plugins/loader/config-loader"

const config = await loadQuartzConfig()
export default config
export const layout = await loadQuartzLayout()

// 本地插件：CI 构建时 `quartz plugin install` 需要它才会拷贝
export const externalPlugins = ["./plugins/forest"]
