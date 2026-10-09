# 永久部署到 Render（免费，彻底不依赖你的电脑）

> 目标：得到一个**固定网址**，手机/电脑随时打开，数据不丢。
> 原理：Render 免费版**磁盘是临时的**（休眠/重启会清空），所以数据改存到你的 **GitHub 仓库**里（代码已写好，填几个环境变量即可）。
> 用时约 10 分钟。需要：一个 GitHub 账号、一个 Render 账号（都用邮箱免费注册）。

---

## 第 0 步：确认要上传的文件

上传这两个文件夹（保持同级）：

```
site/     ← 网页（index.html / plan.html / tracker.html）
cloud/    ← 服务器（server.js / start.js / watchdog.js / package.json ...）
```

**不要**上传 `node_modules`（很大且没用，Render 会自己装）。

---

## 第 1 步：注册 GitHub 并建仓库

1. 打开 https://github.com → Sign up（有账号就登录）。
2. 右上角 **+** → **New repository**。
3. 填：
   - Repository name：`fitness-plan`（随便起）
   - 选 **Private**（私有，更安全）
   - 勾选 **Add a README file**
   - 点 **Create repository**
4. 进入仓库 → **Add file** → **Upload files** → 把 `site` 和 `cloud` 两个**文件夹**整个拖进去 → 底部 **Commit changes**。

---

## 第 2 步：生成访问令牌（Token）

1. 右上角头像 → **Settings** → 左栏最下 **Developer settings**
2. **Personal access tokens** → **Fine-grained tokens** → **Generate new token**
3. 填：
   - Token name：`fitness-plan`
   - Expiration：比如 1 年（到期再换）
   - **Repository access** → **Only select repositories** → 选刚建的 `fitness-plan`
   - **Permissions** → **Repository permissions** → 找到 **Contents** → 选 **Read and write**
4. 点 **Generate token** → **复制那串以 `github_pat_` 开头的字符**（只显示一次，先存到记事本）。

---

## 第 3 步：在 Render 部署

1. 打开 https://render.com → 用 GitHub 登录（免费）。
2. 右上 **New +** → **Web Service** → 连接你的 GitHub → 选 `fitness-plan` 仓库。
3. 按下表填写：

| 字段 | 填什么 |
|---|---|
| **Name** | `fitness-plan`（随意） |
| **Root Directory** | `cloud` ← **重要** |
| **Runtime** | Node |
| **Build Command** | `npm install` |
| **Start Command** | `node server.js` |
| **Instance Type** | **Free** |

4. 往下 **Environment Variables**（Add Environment Variable），逐个加：

| Key | Value |
|---|---|
| `APP_SECRET` | `e59137926fd8`（可自定义，字母数字都行） |
| `GH_TOKEN` | 第 2 步复制的那串 `github_pat_...` |
| `GH_REPO` | `你的GitHub用户名/fitness-plan` |
| `GH_PATH` | `state.json` |
| `GH_BRANCH` | `main` |

5. 点 **Create Web Service**，等 2–3 分钟构建完成。

---

## 第 4 步：拿到你的永久网址

部署成功后，Render 顶部会显示域名，形如：

    https://fitness-plan-xxxx.onrender.com

你的访问地址就是：

    https://fitness-plan-xxxx.onrender.com/a/e59137926fd8/

- 首页：上面的地址
- 打卡表：`…/a/e59137926fd8/tracker`
- 方案：`…/a/e59137926fd8/plan`

把这个链接存进手机收藏夹即可。

---

## 注意事项（重要）

- **免费版会休眠**：连续 15 分钟没人访问就暂停，**下次打开要等 30–60 秒冷启动**（页面转圈是正常的，别急着关）。
- **数据不会丢**：记录存在你的 GitHub 仓库 `state.json` 里，Render 重启也不受影响。想备份/换电脑，直接看仓库那个文件。
- **升级去休眠**：Render 付费最低档（约 $7/月）可保持常驻，并可选挂持久磁盘。
- **换密钥**：改 Render 里的 `APP_SECRET` 并重新部署，网址随之改变。
- **安全**：`APP_SECRET` 是唯一口令，别把完整链接发给别人；`GH_TOKEN` 只用于这一个仓库，泄露了随时在 GitHub 撤销。

---

## 附：一键 Blueprint（可选，更省事）

仓库根目录放一个 `render.yaml`，然后在 Render 用 **New + → Blueprint** 指向仓库，可自动建好服务：

```yaml
services:
  - type: web
    name: fitness-plan
    runtime: node
    rootDir: cloud
    buildCommand: npm install
    startCommand: node server.js
    plan: free
    envVars:
      - key: APP_SECRET
        sync: false
      - key: GH_TOKEN
        sync: false
      - key: GH_REPO
        sync: false
      - key: GH_PATH
        value: state.json
      - key: GH_BRANCH
        value: main
```
（`sync: false` 表示这些值在创建时由你手动填。）
