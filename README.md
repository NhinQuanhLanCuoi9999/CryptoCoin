## Pyramid Coin (Level cap : 2048)

Đây là một ứng dụng mô phỏng khai thác tiền điện tử đầy đủ chức năng với:

*   Xác thực người dùng
*   Bảng xếp hạng động
*   Chuyển khoản
*   Trải nghiệm người dùng hấp dẫn

### Các Tính năng Chính

*   **Xác thực Người dùng:** Chức năng đăng ký và đăng nhập an toàn bằng `bcrypt` để băm mật khẩu. Giới hạn đăng ký dựa trên IP để ngăn chặn lạm dụng.
*   **Mô phỏng Khai thác:** Người dùng có thể bắt đầu và dừng các phiên khai thác. Quá trình khai thác tính toán phần thưởng dựa trên `fixedAmount` duy nhất (được gán ngẫu nhiên một lần duy nhất cho mỗi user khi bắt đầu đào)  kết hợp với EXP hiện tại của họ. Phần thưởng khai thác được thêm vào số dư của người dùng.
*   **Kinh nghiệm và Cấp độ:** Người dùng kiếm được EXP trong các phiên khai thác, góp phần vào quá trình thăng cấp của họ. Cấp độ càng cao có thể ảnh hưởng gián tiếp đến số tiền thưởng kiếm được.
*   **Bảng Xếp hạng Động:** 50 người chơi hàng đầu được hiển thị trên bảng xếp hạng, được xếp hạng theo số dư của họ.
*   **Cập nhật Theo thời gian Thực:** Số dư, trạng thái khai thác, thời gian còn lại và EXP được cập nhật theo thời gian thực trên bảng điều khiển.
*   **Hệ thống Tiền thưởng:** Hệ thống tiền thưởng dựa trên EXP được triển khai, thưởng cho người dùng thêm tiền điện tử trong các phiên khai thác.
*   **Thanh Tiến trình:** Thanh tiến trình trực quan cho biết mức độ hoàn thành của phiên khai thác hiện tại.
*   **Bảo mật:** Đã triển khai vệ sinh đầu vào bằng `xss` để ngăn chặn các lỗ hổng XSS.
*   **Ghi nhật ký:** Hoạt động khai thác được ghi vào `logs.txt` trong thư mục `logs`, bao gồm dấu thời gian, tên người dùng, số tiền kiếm được, EXP, tiền thưởng và số tiền cố định.
*   **Cải tiến Frontend:** Giao diện người dùng được cải thiện với các chuyển tiếp mượt mà và thiết kế hiện đại. Bao gồm đăng nhập/đăng ký theo tab, cập nhật thanh điều hướng động (cấp độ, đăng xuất) và phần bảng xếp hạng chuyên dụng.

### Điểm nổi bật

*   **Xác thực và Ủy quyền:** Sử dụng `express-session` và middleware tùy chỉnh để bảo vệ các route.
*   **Kết nối Cơ sở dữ liệu:** Sử dụng `mysql2/promise` với nhóm kết nối để quản lý kết nối cơ sở dữ liệu hiệu quả.
*   **Bảo mật:** Sử dụng `bcrypt` để băm mật khẩu và `xss` để ngăn chặn XSS.
*   **Khai thác theo Lịch trình:** Sử dụng `setInterval` để lên lịch cập nhật số dư, EXP và cấp độ của người dùng trong khi khai thác.
*   **Bảng xếp hạng:** Truy vấn cơ sở dữ liệu để lấy thông tin người dùng cho bảng xếp hạng.
*   **Nhật ký Khai thác:** Ghi lại các sự kiện khai thác quan trọng vào tệp nhật ký để theo dõi và phân tích.
*   **Giao diện Người dùng:** Sử dụng HTML, CSS và JavaScript để tạo giao diện người dùng tương tác.
*   **Tương tác với Máy chủ:** Sử dụng AJAX để giao tiếp với máy chủ và cập nhật dữ liệu động.


### Cách để chạy
* Cài đặt NodeJS và các thư viện cần thiết bằng cách `npm install` sau khi cài NodeJS
* Chạy MySQL và vào `server.js` để config MySQL
* Chạy `node server.js` để bắt đầu server.