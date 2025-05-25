# ステージ1: ビルド環境
FROM node:18-alpine AS build
WORKDIR /app

# package.json と package-lock.json (または yarn.lock) をコピー
COPY package*.json ./

# 依存関係をインストール
RUN npm install

# ソースコードをコピー
COPY . .

# アプリケーションをビルド
RUN npm run build

# ステージ2: プロダクション環境
FROM nginx:1.25-alpine

# ビルドステージから静的ファイルをコピー
COPY --from=build /app/dist /usr/share/nginx/html

# Nginxの設定ファイルをコピー (後で作成します)
COPY nginx.conf /etc/nginx/conf.d/default.conf

# ポート8080を公開
EXPOSE 8080

# Nginxをフォアグラウンドで実行
CMD ["nginx", "-g", "daemon off;"]
