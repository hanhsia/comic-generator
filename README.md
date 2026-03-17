# Comic Generator

一个基于 Next.js App Router + TypeScript 的漫画生成 MVP：输入故事设定，选择风格预设，并补充角色锚点。服务端会先调用 OpenAI 生成结构化分镜脚本，再逐格生成带风格和角色一致性约束的图片提示词，并尽量生成对应图片；如果图片生成失败或不可用，前端仍会展示可读的分镜卡片与提示词预览。

## 功能概览

- 单页输入：故事 / 设定文本
- 可选目标格数（2 - 8）
- 4 个风格预设：`manga`、`storyboard`、`newspaper-strip`、`cinematic`
- 可选角色锚点：每个角色包含 `id`、`name`、`appearance`、`traits`
- 服务端两段式生成：
  - 先生成结构化分镜脚本
  - 再逐格细化图片提示词并生成图片
- 风格预设与角色锚点会同时作用于：
  - 脚本生成阶段（标题、摘要、每格 caption / dialogue / visualSummary / shotType / characterNames）
  - 每格图片提示词阶段（角色外观重申、镜头、情绪、光线、构图、风格约束）
- 每格返回稳定 `panel id` 与重绘友好的元数据
- 图片生成失败时自动降级为占位预览卡
- 结果页展示标题、摘要、风格摘要、角色摘要、模型信息、警告信息和逐格结果

## 环境要求

- Node.js 18.18+（建议 Node.js 20+）
- 已配置 OpenAI 相关环境变量

## 环境变量

最少需要：

```bash
OPENAI_API_KEY=your_api_key
```

可选：

```bash
OPENAI_MODEL=gpt-4.1-mini
OPENAI_IMAGE_MODEL=gpt-image-1
```

说明：

- 默认优先读取 `OPENAI_API_KEY`
- `OPENAI_MODEL` 未设置时，默认使用 `gpt-4.1-mini`
- `OPENAI_IMAGE_MODEL` 未设置时，默认使用 `gpt-image-1`
- 如果图片模型不可用、账户无权限、或接口返回失败，应用仍会返回分镜和提示词，并在界面中显示回退说明
- 如果文本模型不可用，则无法产出结构化分镜结果

## 本地启动

```bash
cd /data/workspace/comic-generator
cp .env.example .env.local
npm install
npm run dev
```

打开：<http://localhost:3000>

## 使用说明

1. 输入一个带角色、场景、转折的信息密度适中的故事。
2. 选择目标格数和风格预设。
3. 按需添加 0 个或多个角色锚点。
4. 点击“生成漫画”。

### 风格预设

当前支持 4 个风格预设，前后端共用同一组枚举值：

- `manga`
  - 黑白漫画感
  - 强烈明暗对比
  - 夸张速度线与情绪表达
  - 适合偏日漫节奏的分镜
- `storyboard`
  - 偏影视故事板
  - 强调镜头调度、构图说明、动作 blocking
  - 可以略带草图感
- `newspaper-strip`
  - 报纸连载条漫风格
  - 信息密度高
  - 角色辨识度优先
  - 画面更简洁、叙事更直接
- `cinematic`
  - 电影感更强
  - 镜头语言明确
  - 光影层次丰富
  - 场景氛围更沉浸

默认风格为 `cinematic`。

### 角色锚点

角色锚点用于帮助模型在分镜脚本和逐格提示词里维持角色一致性。前端允许先填写部分字段，但真正送入生成链路的角色，必须同时具备完整的 4 个字段：

- `id: string`
  - 前端生成的角色标识
  - 用于结果中回填 `characterAnchorIds`
- `name: string`
  - 角色名称
  - 用于脚本中的 `characterNames` 匹配
- `appearance: string`
  - 角色外观描述
  - 例如发型、穿着、体型、标志性物件
- `traits: string`
  - 角色特征 / 性格
  - 例如冷静、嘴硬、紧张、莽撞、温柔

接口限制：

- 最多支持 6 个角色锚点
- `name` 最长 80 字符
- `appearance` 最长 400 字符
- `traits` 最长 400 字符

如果某个角色只填写了部分字段，它会停留在 UI 中，但不会进入最终生成上下文。

### 风格与角色约束如何生效

当前实现不是“只在出图时套风格”或“只在脚本里提角色”。这两类约束会贯穿两段生成链路：

1. **脚本生成阶段**
   - 服务端把故事、目标格数、风格预设说明、角色锚点一起发给文本模型。
   - 模型需要输出结构化结果：`title`、`summary`、`panels[]`。
   - 每格都会生成：
     - `index`
     - `title`
     - `caption`
     - `dialogue`
     - `visualSummary`
     - `shotType`
     - `characterNames`
   - 提示词中明确要求模型吸收风格预设与角色锚点，让角色设定和画面气质在整篇漫画里保持延续。

2. **逐格图片提示词阶段**
   - 服务端会基于当前格的分镜内容再次调用文本模型生成 `imagePrompt` 和 `rerunHint`。
   - 这一阶段会再次带上：
     - 全局风格预设
     - 角色锚点清单
     - 当前格标题 / 说明 / 对白 / 画面摘要 / 镜头 / 出场角色
   - 如果当前格包含角色锚点中的人物，提示词会被要求重申角色外观特征。
   - 因此，风格和角色约束会同时影响分镜结构与每格图像提示词，而不是只影响其中一层。

## 结果页说明

成功生成后，结果页会展示：

- 漫画标题 `title`
- 漫画摘要 `summary`
- 风格摘要
- 角色数量摘要
- 角色摘要卡片（名称、外观、特征）
- 实际使用的文本模型与图片模型
- 警告信息 `warnings`
- 逐格结果卡片

其中结果顶部的摘要区域目前包含：

- 当前风格预设
- 角色锚点数量（未提供则显示“未提供”）
- 若存在回退图片，会显示统一 notice
- 若存在逐格失败 / 回退，会显示警告列表

### 每格返回内容

每格结果包含：

- `id`：稳定面板标识，例如 `panel-01`
- `index`：第几格
- `title`：当前格标题
- `caption`：当前格说明
- `dialogue`：对白（可为空）
- `imagePrompt`：最终用于生成图片或回退展示的提示词
- `imageUrl`：图片地址或 base64 数据；失败时可能为空
- `imageStatus`：`generated` 或 `fallback`
- `imageError`：图片失败时的错误说明
- `metadata`
  - `panelId`
  - `scriptIndex`
  - `visualSummary`
  - `shotType`
  - `rerunHint`
  - `characterAnchorIds`

前端每格卡片当前会展示：

- 格号与稳定 `panel id`
- 标题与说明
- 对白（如果存在）
- 图片提示词
- 镜头类型
- 画面摘要
- 重绘提示
- 图片回退原因（如果存在）

## 响应结构与后续单格重绘准备

当前版本已经为未来“单格重绘 / regenerate”预留了必要的响应结构，但**尚未实现单格重绘功能**。

现有返回中已经包含：

- 稳定 `panel id`
- `metadata.panelId`
- `metadata.scriptIndex`
- `metadata.visualSummary`
- `metadata.shotType`
- `metadata.rerunHint`
- `metadata.characterAnchorIds`

这意味着后续如果要补单格重绘能力，现有结果对象已经具备较好的面板定位和约束复用基础；但目前还没有：

- 单格重绘按钮
- 单格重绘 API
- 局部重新执行与局部替换 UI

所以可以说“结构已准备好”，但不能说“功能已经支持”。

## 构建验证

推荐按下面顺序验证：

```bash
npm run lint
npm run typecheck
npm run build
```

说明：

- `npm run lint`：执行 ESLint 检查
- `npm run typecheck`：执行独立的 TypeScript 类型检查；命令会先确保 `.next/types` 目录存在，因此不依赖预先跑过构建
- `npm run build`：执行 Next.js 生产构建（也会再次做框架侧校验）

## 目录说明

```text
app/
  api/generate-comic/route.ts   # 服务端生成接口与请求校验
  globals.css                   # 页面样式
  layout.tsx                    # 根布局
  page.tsx                      # 单页 UI（故事、风格、角色锚点、结果页摘要）
components/
  ComicPanelCard.tsx            # 单格漫画卡片与回退展示
lib/
  openai.ts                     # OpenAI 服务封装（分镜 + 提示词 + 图片）
  types.ts                      # 共享类型
```

## 当前限制 / 非目标 / 能力边界

### 当前限制

- 目标格数限制为 2 - 8
- 角色锚点最多 6 个
- 只有完整填写 `name + appearance + traits` 的角色才会真正参与生成
- 图片逐格生成，整体耗时取决于模型响应和网络情况
- 提示词与分镜质量依赖模型遵守结构化输出和一致性约束
- 当图片生成失败时，只会回退为提示词预览卡，不会自动重试

### 当前非目标

下面这些能力目前**不在本版本范围内**：

- 真正的单格重绘操作
- 历史记录 / 作品保存
- 用户账号体系
- 复杂的可视化编辑器
- 手动拖拽改分镜顺序
- 局部 prompt 编辑与二次提交
- 多页长篇漫画工作流

### 能力边界

- 应用会尽量保持风格和角色一致，但不保证生成式模型百分之百稳定。
- 如果文本模型不可用，应用无法返回分镜结果。
- 如果图片模型不可用，应用仍可返回文本分镜、逐格提示词和回退卡片。
- 当前结果页展示的是“生成结果 + 可读元数据”，不是完整的创作管理系统。

## 已知实现细节

- 文本结构化输出基于 OpenAI Responses API + JSON Schema
- 图片生成当前使用 `OPENAI_IMAGE_MODEL` 指定的模型，默认 `gpt-image-1`
- 图片可能以 URL 或 base64 data URL 形式返回
- 默认文本模型为 `gpt-4.1-mini`
- 默认风格预设为 `cinematic`
