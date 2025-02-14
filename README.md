# Crypto Coin Mining Server

Đây là một ứng dụng backend sử dụng **Node.js** với **Express.js** và **MySQL** để quản lý hệ thống đăng nhập, đăng ký và phiên "đào coin" ảo.

## Tính Năng

- **Đăng ký & Đăng nhập**: Xác thực người dùng với mật khẩu đã được mã hóa bằng `bcrypt`.
- **Quản lý phiên**: Sử dụng `express-session` để quản lý phiên đăng nhập.
- **Chặn bot**: Middleware kiểm tra các header và User-Agent để chặn các bot phổ biến và các request đáng ngờ.
- **Phiên Đào Coin**:
  - Người dùng có thể bắt đầu phiên đào coin kéo dài 1 ngày / 1 lần.
  - Mỗi phiên được gán một giá trị cố định (fixedAmount) được tạo ngẫu nhiên.
  - Mỗi 1 giờ, hệ thống cập nhật balance và EXP cho người dùng dựa trên bonus tính từ EXP hiện tại.
  - Tính toán level dựa trên EXP theo mô hình tuyến tính.
- **Bonus**: Cung cấp endpoint để hiển thị bonus hiện có dựa trên EXP và fixedAmount.
- **Trạng thái phiên đào**: Endpoint cung cấp thông tin balance, thời gian còn lại, fixedAmount, và miningSpeed.


