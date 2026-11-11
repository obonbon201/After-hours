# AFTER HOURS

廃遊園地を舞台にしたブラウザホラーゲーム（Stage 1 / Stage 2）。

- 公開先: https://afterhour-458.pages.dev
- バージョン: v1.9.5（オープニングの肘関節修正済み）

## 構成

| パス | 内容 |
|---|---|
| `public/index.html` | ゲーム本体（スクリプトはすべてこの1ファイルに入っています） |
| `public/assets/` | 音声・アイコンなどの素材 |
| `.github/workflows/deploy.yml` | `main` に push すると `public/` を Cloudflare Pages へ自動公開 |
| `tools/opening-arm-fix/` | オープニングの腕（2ボーンIK）修正に使ったパッチスクリプト |

## 自動公開の設定（初回のみ）

1. Cloudflare ダッシュボード → My Profile → API Tokens で、「Cloudflare Pages: 編集」権限のトークンを作る
2. このリポジトリの Settings → Secrets and variables → Actions に登録
   - Secret `CLOUDFLARE_API_TOKEN` … 上のトークン
   - Secret `CLOUDFLARE_ACCOUNT_ID` … Cloudflare のアカウント ID（ダッシュボード右側に表示）
   - Variable `CF_PAGES_PROJECT` … Pages のプロジェクト名（`afterhour` 以外の場合のみ）
3. Actions タブ → Deploy to Cloudflare Pages → Run workflow（以後は push のたびに自動）

## ローカルで遊ぶ

`public/` でローカルサーバーを立てて開きます（ファイルを直接開くと音声が読み込めません）。

```
cd public && python3 -m http.server 8000
# http://localhost:8000/
```

デバッグ: `?armdebug` を付けるとオープニングの関節（肩・肘・手首と角度）を表示します。
