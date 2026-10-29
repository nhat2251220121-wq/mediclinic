# Quản lý tồn kho thuốc theo lô

## Thay đổi schema

Migration bổ sung là `Backend/database/migrations/012_drug_batches_and_dispensing_source.js`. Không chạy migration này trên `mediclinic_db` từ môi trường hiện tại. Trước khi dùng các API kho/kê đơn mới, hãy sao lưu database, kiểm tra cấu hình kết nối để xác nhận đúng database thử nghiệm, rồi áp dụng migration ở môi trường đó. Migration không xóa bảng hoặc cập nhật số lượng cũ.

Migration thêm:

- `drug_batches`: thuốc, mã lô, lượng nhận ban đầu, lượng còn lại, ngày nhập, ngày hết hạn, người tạo và thời điểm ghi nhận.
- `drugs.low_stock_threshold`, mặc định cấu hình là 10 và có thể sửa ở form Admin.
- `stock_movements.batch_id` và `note` để liên kết lô và ghi lý do.
- `prescriptions.dispensing_source`; để `NULL` với đơn cũ vì hệ thống trước đây chưa lưu nguồn cấp. Không tự suy đoán lịch sử.

## Tồn cũ chưa rõ lô/hạn

Giá trị `drugs.stock_quantity` được giữ nguyên. Số lượng theo lô là tổng `drug_batches.quantity_remaining`; phần tồn cũ chưa có hồ sơ lô được tính là `max(stock_quantity - tổng lượng theo lô, 0)`. Phần chưa xác định vẫn hiển thị nhưng không được dùng để giao.

Chỉ dùng “Gắn lô cho tồn cũ” sau khi đối chiếu chứng từ hoặc bao bì thật để nhập lượng, ngày nhập và hạn sử dụng. Thao tác này không cộng thêm tồn tổng; nó chỉ phân loại một phần tồn chưa xác định và ghi lịch sử xác minh. Nếu không xác minh được hạn, để nguyên số lượng chưa rõ lô/hạn, không đặt ngày ước đoán.

## Nghiệp vụ sau khi cập nhật

- Tồn có thể giao = tổng lượng dương của lô có `expires_on >=` ngày hiện tại theo `Asia/Ho_Chi_Minh`.
- Lô hết hạn không được kê là thuốc phòng khám cấp hoặc xuất kho. Cảnh báo lô ở các mốc 30, 60 và 90 ngày; tồn thấp so sánh số dùng được với `low_stock_threshold`.
- Bác sĩ chọn rõ “Phòng khám cấp” hoặc “Bệnh nhân tự mua ngoài”. Chỉ thuốc phòng khám cấp được tính vào invoice; lựa chọn mua ngoài không trừ kho.
- Admin chỉ xác nhận đã giao. Backend khóa bệnh án/hóa đơn/đơn thuốc/thuốc/lô trong transaction, yêu cầu hóa đơn thanh toán đủ, kiểm tra lô còn hạn và xuất FEFO (hạn gần nhất trước). Cấp thiếu, hết hạn, giao lặp hoặc hóa đơn chưa đủ tiền sẽ rollback.
- Thuốc hết hạn/hư hỏng được ghi hủy theo lô với lý do; không xóa lô hoặc lịch sử.

## API Admin mới

Tất cả endpoint `/api/admin/*` yêu cầu token và quyền `ADMIN`.

- `GET /api/admin/medicines/:id/lots`: chi tiết lô và 300 chuyển động kho gần nhất.
- `POST /api/admin/medicines/:id/lots`: nhập lô mới.
- `POST /api/admin/medicines/:id/lots/classify`: gắn lô đã xác minh cho tồn cũ mà không cộng lại tồn tổng.
- `POST /api/admin/medicine-lots/:batchId/adjust`: điều chỉnh có ghi chú và lịch sử.
- `POST /api/admin/medicine-lots/:batchId/write-off`: hủy lô hết hạn/hư hỏng, không xóa lô.
- `GET /api/admin/medicine-units`: danh sách đơn vị thuốc đang hoạt động.

`POST /api/medical-records/:id/dispense` không nhận lựa chọn nguồn cấp từ Admin nữa. Nguồn cấp được lưu tại lúc bác sĩ kê; Admin chỉ xác nhận giao các dòng phòng khám cấp.

## Đơn thuốc cũ

Đơn cũ có `dispensing_source = NULL` được hiển thị là chưa xác định nguồn và không thể giao tự động. API từ chối giao thay vì chọn nguồn thay cho bác sĩ hoặc sửa hóa đơn cũ. Cần đối soát theo hồ sơ nghiệp vụ trước khi xử lý riêng.
