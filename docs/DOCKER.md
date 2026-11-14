# MediClinic với Docker Compose

Compose chạy Backend Node.js và Frontend production qua Nginx. MySQL là dịch vụ bên ngoài; không có container nào tự tạo schema hoặc chạy migration khi khởi động.

## Chuẩn bị

1. Cài Docker Engine và Docker Compose plugin.
2. Tạo `Backend/.env` từ `Backend/.env.example`, rồi điền cấu hình thật trên máy triển khai. Không đưa file này vào ZIP/image/Git.
3. Đặt `DB_NAME` rõ ràng. Trong container, `DB_HOST=localhost` trỏ về chính container Backend. Nếu MySQL chạy trên máy host, dùng `DB_HOST=host.docker.internal` (Compose đã khai báo host gateway); nếu MySQL chạy trong một container khác, dùng tên service/hostname mà Backend truy cập được.
4. Đặt `FRONTEND_URL` thành origin người dùng truy cập, ví dụ `http://localhost:8080` khi thử local hoặc `https://benhvienphongkham.site` trên production. Socket.IO dùng cùng kiểm tra origin này.
5. Đảm bảo user MySQL cho phép kết nối từ Docker host/network. Không mở MySQL công khai nếu không cần.
6. Chọn nơi lưu ảnh upload. Mặc định Compose bind-mount `Backend/uploads`; trên VPS có thể đặt `MEDICLINIC_UPLOADS_PATH` thành thư mục uploads hiện có để giữ ảnh. Sao lưu thư mục này cùng database.

## Chạy

Từ thư mục gốc dự án:

```powershell
docker compose build
docker compose up -d
docker compose ps
```

Frontend được publish ở `http://127.0.0.1:8080`. Trên VPS aaPanel, cấu hình reverse proxy HTTPS của domain đến `http://127.0.0.1:8080`. Nginx trong container chuyển tiếp `/api/`, `/socket.io/` (WebSocket) và `/uploads/` tới Backend; API và ảnh dùng cùng origin website.

Build frontend mặc định dùng `/api` cùng origin và `VITE_UPLOADS_BASE_URL` để trống. Các biến liên hệ `VITE_CLINIC_ADDRESS`, `VITE_CLINIC_PHONE`, `VITE_CLINIC_EMAIL` có thể đặt trong file `.env` ở thư mục gốc trước khi build; giá trị này là công khai vì được nhúng vào frontend. `WEB_PORT` và `MEDICLINIC_UPLOADS_PATH` cũng có thể đặt ở đó để đổi cổng/cấu hình thư mục ảnh.

## Migration có chủ đích

Backend thông thường không tự chạy migration. Sau khi sao lưu database và xác minh `DB_NAME`, kiểm tra trước:

```powershell
docker compose run --rm backend npm run migrate:status
```

Chỉ khi đã duyệt và xác nhận đúng database mới chạy migration thủ công:

```powershell
docker compose run --rm backend npm run migrate -- --confirm-production
```

Các lệnh trên dùng `Backend/.env`; không chạy chúng nếu cấu hình đang trỏ nhầm database.

## Vận hành

```powershell
docker compose logs -f backend frontend
docker compose restart backend
docker compose down
```

`docker compose down` giữ dữ liệu uploads vì nó nằm ở bind mount. Không xóa thư mục uploads hoặc database khi dừng stack. Mỗi lần cập nhật frontend cần build lại image vì biến `VITE_*` được nhúng tại build time.

## Lưu ý bảo mật

- Backend chỉ được truy cập qua Nginx frontend trong Compose; chỉ cổng web `8080` được publish và bind vào loopback.
- Không đặt API key/secret trong build args Frontend. Các biến `VITE_*` đều có thể được người dùng xem trong mã build.
- SePay webhook production đi qua HTTPS reverse proxy của aaPanel đến `/api/payments/sepay-webhook`; giữ nguyên kiểm tra xác thực webhook của Backend.
- Gateway/Cloudflare Tunnel hiện có không bị xóa; cấu hình Compose production không chạy chúng.
