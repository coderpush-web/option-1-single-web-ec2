# Option 1: Single Web Application on Single EC2

Hạ tầng và Mã nguồn ứng dụng độc lập cho **Option 1: Single Web Application on Single EC2**.

## 1. Cấu trúc thư mục (File Structure)
```text
.
├── .github/workflows/ci-cd.yml   # CI/CD Pipeline (test code, lint CloudFormation, auto-deploy)
├── app/                          # Mã nguồn Website độc lập (Node.js/Express)
├── infra/                        # Mã nguồn CloudFormation hạ tầng AWS
│   ├── cloudformation.yaml       # Template CloudFormation độc lập
│   └── architecture_diagram.png  # Sơ đồ kiến trúc Diagram-as-Code
├── test/                         # Kiểm thử tự động (Unit test API & app)
│   └── test_api.js
└── README.md                     # Báo cáo kỹ thuật và ma trận chi phí
```

## 2. Báo cáo Chi phí Đa Chiều (Multi-Dimension Cost Analysis)

### A. Chi phí theo Mô hình Thanh toán (Region Singapore ap-southeast-1)
| Mô hình thanh toán | Đơn giá EC2 Compute | Thành phần phụ (IP + EBS + Backup) | Tổng chi phí / tháng | Quy đổi VNĐ |
| :--- | :--- | :--- | :--- | :--- |
| **On-Demand (Mặc định)** | $15.18 / tháng | $6.80 / tháng | **$21.98 / tháng** | ~555.000 VNĐ |
| **1-Year Savings Plan (Cam kết 1 năm)** | $9.56 / tháng | $6.80 / tháng | **$16.36 / tháng** *(Giảm 25%)* | ~413.000 VNĐ |
| **3-Year Savings Plan (Cam kết 3 năm)** | $6.06 / tháng | $6.80 / tháng | **$12.86 / tháng** *(Giảm 41%)* | ~325.000 VNĐ |
| **Spot Instance (Môi trường Dev/Test)** | $4.53 / tháng | $6.80 / tháng | **$11.33 / tháng** *(Giảm 48%)* | ~286.000 VNĐ |

### B. So sánh giữa các Region
- **Singapore (`ap-southeast-1`):** $21.98/tháng (Độ trễ thấp nhất về VN: ~30ms).
- **US East (`us-east-1`):** $21.98/tháng (Giá compute tương đương, băng thông ra quốc tế rẻ hơn 25%).
- **Tokyo (`ap-northeast-1`):** $25.78/tháng (Chi phí compute cao hơn 25%).

<!-- INFRACOST_START -->
### 💵 Kết quả Kiểm tra Chi phí Tự động CloudFormation (Infracost CI/CD Output)
*Thời gian kiểm tra: Fri Oct  9 06:44:21 UTC 2026*

```text
No costed resources detected.
```
<!-- INFRACOST_END -->

## 3. Kiến trúc Hạ tầng (Architecture Diagram)
![Architecture](infra/architecture_diagram.png)

## 4. Quy trình CI/CD & Branching Strategy
- **dev**: Nhánh phát triển chính (Default branch). Tự động chạy test & lint template CloudFormation.
- **main**: Nhánh Production được bảo vệ (**Branch Protection Rule**). Chỉ cho phép merge từ nhánh **dev**.


## 🌐 Cấu Hình Tên Miền Tùy Chỉnh (Custom Domain: `png261.dev`)

Hạ tầng hỗ trợ ánh xạ tên miền `png261.dev` cho cả môi trường Development và Production:

| Môi trường | Nhánh Git | Subdomain | Loại bản ghi DNS | Giá trị đích (Target) | Proxy Cloudflare |
| :--- | :--- | :--- | :---: | :--- | :---: |
| **Development** | `dev` | `opt1-dev.png261.dev` | `A` | `${WebServerEIP.PublicIp}` (Dev EIP) | Bật (Proxied ☁️) |
| **Production** | `main` | `opt1.png261.dev` | `A` | `${WebServerEIP.PublicIp}` (Prod EIP) | Bật (Proxied ☁️) |

> 💡 **Khuyến nghị SSL/HTTPS qua Cloudflare:**
> Do tên miền `png261.dev` được quản trị Nameserver tại Cloudflare, khi tạo bản ghi `A` với trạng thái **Proxied (Đám mây màu cam ☁️)**:
> - Cloudflare sẽ tự động cấp chứng chỉ **Universal SSL/TLS miễn phí** (HTTPS xanh).
> - Tự động kích hoạt CDN caching và bảo vệ chống tấn công DDoS Lớp 7.

## ☁️ Quản Lý Hạ Tầng Native CloudFormation (No State File)
Hạ tầng sử dụng 100% **AWS CloudFormation Native**:
- **State Managed by AWS:** Toàn bộ trạng thái tài nguyên do AWS quản lý tự động trực tiếp trên CloudFormation Engine.
- **Không cần lưu trữ State File:** Loại bỏ hoàn toàn rủi ro lộ bí mật, mất đồng bộ hoặc conflict state file.
- **Drift Detection:** Cho phép kiểm tra độ lệch cấu hình trực tiếp từ AWS Console / AWS CLI mà không lo hỏng state.
