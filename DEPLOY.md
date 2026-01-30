# Hướng dẫn Deploy lên Netlify

## Tổng quan

Project này có 3 phần cần deploy:
1. **Main App** (Astro) - Deploy lên Netlify
2. **CMS** (Astro) - Deploy lên Netlify
3. **Socket Server** (Node.js) - Deploy lên Railway/Render (vì cần persistent connection)

---

## 1. Deploy Main App lên Netlify

### Bước 1: Cài đặt Netlify Adapter

```bash
npm install -D @astrojs/netlify
```

### Bước 2: Cập nhật `astro.config.mjs`

```javascript
import { defineConfig } from 'astro/config';
import react from '@astrojs/react';
import tailwind from '@astrojs/tailwind';
import netlify from '@astrojs/netlify';

export default defineConfig({
  output: 'server',
  adapter: netlify(),
  integrations: [react(), tailwind()],
});
```

### Bước 3: Tạo site trên Netlify

1. Đăng nhập vào [Netlify](https://app.netlify.com)
2. Click "Add new site" → "Import an existing project"
3. Kết nối với GitHub repository
4. Cấu hình:
   - **Base directory**: (để trống - root)
   - **Build command**: `npm run build`
   - **Publish directory**: `dist`
   - **Node version**: `20`

### Bước 4: Thêm Environment Variables

Trong Netlify Dashboard → Site settings → Environment variables:

```
DATABASE_URL=your_database_url
NODE_ENV=production
```

### Bước 5: Deploy

Netlify sẽ tự động deploy khi bạn push code lên GitHub.

---

## 2. Deploy CMS lên Netlify

### Bước 1: Cài đặt Netlify Adapter trong CMS

```bash
cd cms
npm install -D @astrojs/netlify
```

### Bước 2: Cập nhật `cms/astro.config.mjs`

```javascript
import { defineConfig } from 'astro/config';
import react from '@astrojs/react';
import tailwind from '@astrojs/tailwind';
import netlify from '@astrojs/netlify';

export default defineConfig({
  output: 'server',
  adapter: netlify(),
  integrations: [react(), tailwind()],
});
```

### Bước 3: Tạo site mới trên Netlify cho CMS

1. Tạo site mới trên Netlify
2. Kết nối với cùng GitHub repository
3. **QUAN TRỌNG**: Trong Netlify Dashboard → Site settings → Build & deploy → Build settings:
   - **Base directory**: `cms` (phải set đúng!)
   - **Build command**: `npm run build` (Netlify sẽ tự động chạy trong base directory)
   - **Publish directory**: `dist` (relative to base directory, không phải `cms/dist`)
   - **Node version**: `20`

**Lưu ý quan trọng**: 
- Khi set Base directory là `cms`, Netlify sẽ tự động chạy commands trong thư mục đó
- Netlify sẽ đọc `cms/netlify.toml` nếu có, hoặc dùng settings từ Dashboard
- Nếu vẫn lỗi, có thể xóa `cms/netlify.toml` và chỉ dùng settings từ Dashboard

### Bước 4: Thêm Environment Variables

```
DATABASE_URL=your_database_url
PUBLIC_SOCKET_URL=https://app-trader.railway.internal
NODE_ENV=production
```

**Lưu ý**: `PUBLIC_SOCKET_URL` phải bắt đầu với `PUBLIC_` để Astro expose nó ra client-side.

---

## 3. Deploy Socket Server lên Railway (Miễn phí)

**Lưu ý**: Netlify không hỗ trợ persistent WebSocket connections tốt. Nên deploy socket server lên Railway hoặc Render.

### Option A: Railway (Khuyến nghị)

1. Đăng ký tại [Railway](https://railway.app)
2. Tạo project mới → "Deploy from GitHub repo"
3. Chọn repository
4. Cấu hình:
   - **Root Directory**: (để trống)
   - **Build Command**: Railway sẽ tự động detect Dockerfile
   - **Start Command**: `node socket-server.js`
   - **Port**: Railway tự động assign
   - **Node Version**: Railway sẽ dùng Node 20 từ Dockerfile

5. Thêm Environment Variables:
   ```
   DATABASE_URL=your_database_url
   PORT=3000
   MAIN_APP_URL=https://your-app.netlify.app
   CMS_URL=https://your-cms.netlify.app
   ```

6. Railway sẽ tự động deploy và cung cấp URL

### Option B: Render

1. Đăng ký tại [Render](https://render.com)
2. Tạo "Web Service" mới
3. Kết nối GitHub repository
4. Cấu hình:
   - **Name**: `trader-socket-server`
   - **Environment**: `Docker` (quan trọng! Phải chọn Docker để dùng Node 20)
   - **Dockerfile Path**: `./Dockerfile`
   - **Docker Context**: `.` (root directory)
   - **Start Command**: `node socket-server.js`
   - **Plan**: Free

5. Thêm Environment Variables:
   ```
   DATABASE_URL=your_database_url
   PORT=3000
   MAIN_APP_URL=https://your-app.netlify.app
   CMS_URL=https://your-cms.netlify.app
   ```

**Lưu ý**: Phải chọn Environment là `Docker` để Render sử dụng Dockerfile với Node 20. Nếu chọn `Node`, Render sẽ dùng Node 18 mặc định và sẽ bị lỗi với Prisma 7.

---

## 4. Cập nhật Socket Server URL

Sau khi deploy socket server, cần cập nhật Environment Variables:

### Main App (Netlify)

Thêm vào Environment Variables:
```
PUBLIC_SOCKET_URL=https://app-trader.railway.internal
```

### CMS (Netlify)

Thêm vào Environment Variables:
```
PUBLIC_SOCKET_URL=https://app-trader.railway.internal
```

### Socket Server (Railway/Render)

Thêm vào Environment Variables:
```
MAIN_APP_URL=https://your-app.netlify.app
CMS_URL=https://your-cms.netlify.app
```

Code đã được cấu hình để tự động sử dụng các environment variables này, không cần sửa code thủ công.

---

## 5. Cấu trúc Deploy

```
Main App (Netlify)
├── URL: https://your-app.netlify.app
├── Base: root directory
└── Build: npm run build

CMS (Netlify)
├── URL: https://your-cms.netlify.app
├── Base: cms/
└── Build: npm run build

Socket Server (Railway/Render)
├── URL: https://your-socket.railway.app (hoặc .render.com)
├── Start: node socket-server.js
└── Port: Auto-assigned
```

---

## 6. Checklist trước khi deploy

- [ ] Đã chạy `npx prisma generate` cho cả main app và CMS
- [ ] Đã chạy `npx prisma db push` để sync database
- [ ] Đã seed admin account: `node scripts/seed-admin.js`
- [ ] Đã cập nhật socket server URL trong code
- [ ] Đã cập nhật CORS trong socket-server.js
- [ ] Đã thêm tất cả environment variables
- [ ] Đã test build locally: `npm run build` và `cd cms && npm run build`

---

## 7. Troubleshooting

### Lỗi: "Cannot find module '@prisma/client'"
- Chạy `npx prisma generate` trước khi build
- Thêm vào build command: `npx prisma generate && npm run build`

### Lỗi: "Database connection failed"
- Kiểm tra DATABASE_URL trong environment variables
- Đảm bảo database cho phép connection từ Netlify IPs

### Socket không kết nối được
- Kiểm tra CORS settings trong socket-server.js
- Kiểm tra URL socket server trong client code
- Đảm bảo socket server đang chạy và accessible

---

## 8. Custom Domain (Optional)

Sau khi deploy, bạn có thể thêm custom domain trong Netlify Dashboard:
- Site settings → Domain management → Add custom domain

