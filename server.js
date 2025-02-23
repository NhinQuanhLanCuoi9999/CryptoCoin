require('dotenv').config();
const fs = require('fs');
const crypto = require('crypto');
const express = require('express');
const bodyParser = require('body-parser');
const session = require('express-session');
const mysql = require('mysql2/promise');
const path = require('path');
const bcrypt = require('bcrypt');
const xss = require('xss');
const jwt = require('jsonwebtoken'); 
const cookieParser = require('cookie-parser'); 
const rateLimit = require("express-rate-limit");
const app = express();
const SESSION_DURATION = 24 * 60 * 60 * 1000; 
const miningTimers = {};



// -----------------------
// Setup server cơ bản
// -----------------------

// Kiểm tra và tạo .env nếu chưa có
const envPath = '.env';
if (!fs.existsSync(envPath)) {
    console.log('⚠️ Không tìm thấy .env, đang tạo mới...');
    const newJwtSecret = crypto.randomBytes(32).toString('hex');
    const newSessionSecret = crypto.randomBytes(32).toString('hex');
    fs.writeFileSync(envPath, `JWT_SECRET=${newJwtSecret}\nSESSION_SECRET=${newSessionSecret}\n`);
    console.log('✅ Đã tạo .env mới!');
    require('dotenv').config();
}

// Lấy secret từ .env
const JWT_SECRET = process.env.JWT_SECRET;
const SESSION_SECRET = process.env.SESSION_SECRET;

if (!process.env.JWT_SECRET || !process.env.SESSION_SECRET) {
    console.error('🚨 Thiếu JWT_SECRET hoặc SESSION_SECRET! Xóa sạch .env cũ rồi tạo mới...');

    // Xóa file .env nếu có
    if (fs.existsSync('.env')) {
        fs.unlinkSync('.env');
        console.log('🗑️ Đã xóa .env cũ.');
    }

    // Tạo file .env mới với giá trị mặc định
    const newEnvContent = `JWT_SECRET=${crypto.randomBytes(32).toString('hex')}\nSESSION_SECRET=${crypto.randomBytes(32).toString('hex')}`;
    fs.writeFileSync('.env', newEnvContent);
    console.log('✅ Đã tạo .env mới.');

    process.exit(1);
}

console.log('✅ Đã load secret key từ .env!');

// Cấu hình middleware
app.use(bodyParser.json());
app.use(cookieParser()); // Sử dụng cookie-parser
app.use(session({
  secret: SESSION_SECRET,
  resave: false,
  saveUninitialized: false,
}));

// Cho phép phục vụ frontend từ thư mục public
app.use(express.static(path.join(__dirname, 'public')));

// Kết nối csdl
const pool = mysql.createPool({
  host: 'localhost',
  user: 'root',
  password: '',
  database: 'crypto_db',
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0
});

// -----------------------
// Rate limit
// -----------------------

// Giới hạn 5 request / 1 phút trên mỗi IP
const loginLimiter = rateLimit({
  windowMs: 1 * 60 * 1000,
  max: 5, 
  message: { message: "Bạn đã thử quá nhiều lần, vui lòng thử lại sau." },
  standardHeaders: true,
  legacyHeaders: false,
});

// Áp dụng vào route login
app.use("/login", loginLimiter);

// -----------------------
// Reset trạng thái đào
// -----------------------
async function resetMiningActive() {
  try {
    await pool.execute('UPDATE users SET mining_active = 0 WHERE mining_active = 1');
    console.log('[INFO] Đã reset tất cả các phiên đào còn lại.');
  } catch (err) {
    console.error('[ERROR] Lỗi khi reset mining_active:', err);
  }
}
resetMiningActive();

// Middleware kiểm tra JWT (đọc từ cookie) và session (nếu có)
function isAuthenticated(req, res, next) {
  // Ưu tiên kiểm tra cookie JWT
  const token = req.cookies.jwt;
  if (token) {
    try {
      const decoded = jwt.verify(token, JWT_SECRET);
      req.user = decoded;
      return next();
    } catch (err) {
      return res.status(401).json({ message: 'Token không hợp lệ' });
    }
  }
  // Nếu không có cookie, fallback kiểm tra session (cho những request cũ)
  if (req.session && req.session.username) {
    return next();
  }
  return res.status(401).json({ message: 'Chưa đăng nhập' });
}

// -----------------------
// Endpoint đăng ký
// -----------------------
app.post('/register', async (req, res) => {
  const username = xss(req.body.username);
  const password = xss(req.body.password);
  
  if (!username || !password) {
    return res.status(400).json({ message: 'Yêu cầu username và password' });
  }

  // Lấy IP của người dùng
  let clientIp = req.ip;
  if (req.headers['x-forwarded-for']) {
    clientIp = req.headers['x-forwarded-for'].split(',')[0].trim();
  }

  try {
    // Kiểm tra xem username đã tồn tại chưa
    const [usernameRows] = await pool.execute('SELECT * FROM users WHERE username = ?', [username]);
    if (usernameRows.length > 0) {
      return res.status(400).json({ message: 'Người dùng đã tồn tại' });
    }

    // Kiểm tra số lượng tài khoản từ IP này
    const [ipRows] = await pool.execute('SELECT COUNT(*) AS count FROM users WHERE ip = ?', [clientIp]);
    if (ipRows[0].count >= 2) {
      return res.status(400).json({ message: 'Đã có 2 tài khoản từ IP này, bạn không thể đăng ký thêm.' });
    }

    const hashedPassword = await bcrypt.hash(password, 10);
    await pool.execute(
      'INSERT INTO users (username, password, balance, mining_active, mining_start_time, ip) VALUES (?, ?, 0, 0, NULL, ?)',
      [username, hashedPassword, clientIp]
    );
    
    res.json({ message: 'Đăng ký thành công' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Lỗi server' });
  }
});

// -----------------------
// Endpoint bảng xếp hạng
// -----------------------
app.get('/leaderboard', async (req, res) => {
  try {
    const [rows] = await pool.execute(
      'SELECT username, balance, level FROM users WHERE balance > 0 ORDER BY balance DESC LIMIT 50'
    );
    res.json(rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Lỗi server' });
  }
});

// -----------------------
// Endpoint đăng nhập
// -----------------------
app.post('/login', async (req, res) => {
  const username = xss(req.body.username);
  const password = xss(req.body.password);
  
  // Lấy địa chỉ IP của client
  let clientIp = req.ip;
  if (req.headers['x-forwarded-for']) {
    clientIp = req.headers['x-forwarded-for'].split(',')[0];
  }

  try {
    const [rows] = await pool.execute('SELECT * FROM users WHERE username = ?', [username]);
    
    if (rows.length === 0) {
      return res.status(401).json({ message: 'Thông tin đăng nhập không hợp lệ' });
    }
    
    const user = rows[0];
    const match = await bcrypt.compare(password, user.password);

    if (!match) {
      return res.status(401).json({ message: 'Thông tin đăng nhập không hợp lệ' });
    }
    
    await pool.execute('UPDATE users SET ip = ? WHERE username = ?', [clientIp, username]);

    // Tạo token JWT, hết hạn trong 24h
    const token = jwt.sign({ username: user.username }, JWT_SECRET, { expiresIn: '24h' });

    // Đặt JWT vào cookie HTTP-Only (ở đây secure: false nếu chưa dùng HTTPS)
    res.cookie("jwt", token, {
      httpOnly: true,
      secure: false, // đổi thành true nếu dùng HTTPS
      sameSite: "Strict",
      maxAge: 24 * 60 * 60 * 1000, // 24 giờ
    });

    // (Có thể xóa session nếu không cần nữa)
    req.session.username = username;
    res.json({ message: 'Đăng nhập thành công' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Lỗi server' });
  }
});

// -----------------------
// Endpoint đăng xuất
// -----------------------
app.get('/logout', (req, res) => {
  // Xóa cookie JWT và session nếu có
  res.clearCookie("jwt");
  req.session.destroy(err => {
    if (err) return res.status(500).json({ message: 'Lỗi khi đăng xuất' });
    res.json({ message: 'Đăng xuất thành công' });
  });
});

// -----------------------
// Endpoint đổi mật khẩu
// -----------------------
app.post('/change-password', isAuthenticated, async (req, res) => {
  const username = req.session.username || (req.user && req.user.username);
  const { oldPassword, newPassword, confirmNewPassword } = req.body;

  if (!oldPassword || !newPassword || !confirmNewPassword) {
    return res.status(400).json({ message: 'Vui lòng nhập đầy đủ thông tin' });
  }

  if (newPassword.length < 6) {
    return res.status(400).json({ message: 'Mật khẩu mới phải có ít nhất 6 ký tự' });
  }

  if (newPassword !== confirmNewPassword) {
    return res.status(400).json({ message: 'Xác nhận mật khẩu mới không khớp' });
  }

  try {
    const [rows] = await pool.execute('SELECT password FROM users WHERE username = ?', [username]);

    if (rows.length === 0) {
      return res.status(404).json({ message: 'Người dùng không tồn tại' });
    }

    const user = rows[0];
    const match = await bcrypt.compare(oldPassword, user.password);

    if (!match) {
      return res.status(401).json({ message: 'Mật khẩu cũ không chính xác' });
    }

    const hashedNewPassword = await bcrypt.hash(newPassword, 10);
    await pool.execute('UPDATE users SET password = ? WHERE username = ?', [hashedNewPassword, username]);

    res.json({ message: 'Đổi mật khẩu thành công' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Lỗi server' });
  }
});


// -----------------------
// Hàm tính toán level dựa trên exp
// -----------------------
function calculateLevel(exp) {
  // Nếu exp dưới 1.45, vẫn giữ level 1
  if (exp < 1.45) return 1;
  // Nếu exp từ 1.45 trở lên, tính level theo mô hình tuyến tính
  return Math.floor((exp - 1.45) / 0.15) + 1;
}

// -----------------------
// Endpoint bắt đầu phiên đào (nhấn nút ⚡)
// -----------------------
app.post('/mine', isAuthenticated, async (req, res) => {
  const username = req.session.username || (req.user && req.user.username);

  try {
    const [rows] = await pool.execute('SELECT * FROM users WHERE username = ?', [username]);
    if (rows.length === 0) {
      return res.status(400).json({ message: 'Người dùng không tồn tại' });
    }
    const user = rows[0];

    if (user.mining_active || miningTimers[username]) {
      const startTime = user.mining_start_time;
      const elapsed = Date.now() - startTime;
      const timeRemaining = Math.max(SESSION_DURATION - elapsed, 0);
      
      return res.status(200).json({
        message: 'Phiên đào đang hoạt động',
        timeout: timeRemaining,
        fixedAmount: user.mining_fixed_amount,
        miningSpeedPerSecond: parseFloat((Number(user.mining_fixed_amount) || 0).toFixed(8))
      });
    }

    const startTime = Date.now();
    const lowerBound = 0.00000010;
    const upperBound = 0.00000999;
    const fixedAmount = parseFloat((lowerBound + Math.random() * (upperBound - lowerBound)).toFixed(8));

    await pool.execute(
      'UPDATE users SET mining_active = 1, mining_start_time = ?, mining_fixed_amount = ? WHERE username = ?',
      [startTime, fixedAmount, username]
    );

    miningTimers[username] = setInterval(async () => {
      try {
        const currentTime = Date.now();
        const elapsed = currentTime - startTime;

        if (elapsed >= SESSION_DURATION) {
          clearInterval(miningTimers[username]);
          delete miningTimers[username];
          await pool.execute(
            'UPDATE users SET mining_active = 0, mining_start_time = NULL, mining_fixed_amount = NULL WHERE username = ?',
            [username]
          );
          console.log(`Phiên đào của ${username} đã kết thúc sau ${SESSION_DURATION / 60000} phút.`);
          return;
        }
        
        const [userRows] = await pool.execute(
          'SELECT exp, mining_fixed_amount FROM users WHERE username = ?',
          [username]
        );
        if (userRows.length > 0) {
          const currentExp = parseFloat(userRows[0].exp) || 0;
          const fixedAmountFromDB = parseFloat(userRows[0].mining_fixed_amount);
          
          const bonusExp = Math.log10(currentExp + 1) * 10 + 0.5;
          const MAX_RATE = 0.001;
          const earnedAmount = Math.min(fixedAmountFromDB * bonusExp, MAX_RATE);

          await pool.execute(
            'UPDATE users SET balance = balance + ?, exp = exp + ? WHERE username = ?',
            [earnedAmount, earnedAmount, username]
          );

          function getFormattedTime() {
            let now = new Date();
            let day = String(now.getDate()).padStart(2, "0");
            let month = String(now.getMonth() + 1).padStart(2, "0");
            let year = now.getFullYear();
            let hours = String(now.getHours()).padStart(2, "0");
            let minutes = String(now.getMinutes()).padStart(2, "0");
            let seconds = String(now.getSeconds()).padStart(2, "0");
            return `${day}/${month}/${year} | ${hours}:${minutes}:${seconds}`;
          }

          const logMessage = `[LOGS] [${getFormattedTime()}] ${username} đã đào được: ${earnedAmount} ⟁ (exp hiện tại: ${currentExp}, bonus (logarithm scaled): ${bonusExp}, fixedAmount: ${fixedAmountFromDB})`;
          console.log(logMessage);

          const logDir = path.join(__dirname, 'logs');
          const logFile = path.join(logDir, 'logs.txt');
          if (!fs.existsSync(logDir)) {
            fs.mkdirSync(logDir, { recursive: true });
          }
          fs.appendFile(logFile, logMessage + '\n', (err) => {
            if (err) {
              console.error('Lỗi khi ghi vào file:', err);
            }
          });
        }

        const [result] = await pool.execute('SELECT exp, level FROM users WHERE username = ?', [username]);
        if (result.length > 0) {
          let newExp = parseFloat(result[0].exp);
          let currentLevel = result[0].level;
          let newLevel = calculateLevel(newExp);

          if (newLevel > 2048) {
            newLevel = 2048;
            newExp = 1.45 + (2048 - 1) * 0.15;
            await pool.execute('UPDATE users SET exp = ? WHERE username = ?', [newExp, username]);
          }

          if (newLevel !== currentLevel) {
            await pool.execute('UPDATE users SET level = ? WHERE username = ?', [newLevel, username]);
            console.log(`Cập nhật level của ${username}: ${currentLevel} -> ${newLevel}`);
          }
        }
      } catch (err) {
        console.error('Lỗi trong mining interval:', err);
      }
    }, 3600000);

    res.json({
      message: 'Bắt đầu đào coin',
      timeout: SESSION_DURATION,
      fixedAmount: fixedAmount,
      miningSpeedPerSecond: parseFloat((Number(fixedAmount) || 0).toFixed(8))
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Lỗi server' });
  }
});


// -----------------------
// Endpoint hiển thị bonus và cập nhật balance của người dùng (nếu cần gọi riêng)
// -----------------------
app.get('/bonus', isAuthenticated, async (req, res) => {
  const username = req.session.username || (req.user && req.user.username);

  try {
    const [rows] = await pool.execute('SELECT * FROM users WHERE username = ?', [username]);
    if (rows.length === 0) {
      return res.status(400).json({ message: 'Người dùng không tồn tại' });
    }
    const user = rows[0];

    if (!user.mining_active) {
      return res.status(400).json({ message: 'Phiên đào chưa bắt đầu' });
    }

    const currentExp = parseFloat(user.exp) || 0;
    const fixedAmount = parseFloat(user.mining_fixed_amount);
    const bonusExp = currentExp * 0.5;
    const earnedAmount = fixedAmount * bonusExp;

    res.json({
      message: 'Thông tin bonus',
      earnedAmount: parseFloat(earnedAmount.toFixed(8)),
      bonusExp: parseFloat(bonusExp.toFixed(8)),
      currentExp: currentExp,
      fixedAmount: fixedAmount
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Lỗi server' });
  }
});

// -----------------------
// Endpoint chuyển tiền giữa các user với phí ngẫu nhiên (10%-15%)
// -----------------------
app.post('/transfer', isAuthenticated, async (req, res) => {
  const { receiverId, amount } = req.body;
  const senderUsername = req.session.username || (req.user && req.user.username);

  const amountNum = parseFloat(amount);

  if (!senderUsername || !receiverId || isNaN(amountNum) || amountNum <= 0) {
    return res.status(400).json({ message: 'Thông tin không hợp lệ' });
  }

  try {
    const [senderRows] = await pool.execute('SELECT * FROM users WHERE username = ?', [senderUsername]);
    if (senderRows.length === 0) {
      return res.status(400).json({ message: 'Người gửi không tồn tại' });
    }
    const sender = senderRows[0];

    const [receiverRows] = await pool.execute('SELECT * FROM users WHERE id = ?', [receiverId]);
    if (receiverRows.length === 0) {
      return res.status(400).json({ message: 'Người nhận không tồn tại' });
    }
    const receiver = receiverRows[0];

    if (sender.level < 10) {
      return res.status(400).json({ message: 'Người gửi phải có cấp độ từ 10 trở lên' });
    }
    if (receiver.level < 10) {
      return res.status(400).json({ message: 'Người nhận phải có cấp độ từ 10 trở lên' });
    }

    if (parseFloat(sender.balance) < amountNum) {
      return res.status(400).json({ message: 'Số dư người gửi không đủ' });
    }

    const feePercentage = Math.random() * (0.15 - 0.10) + 0.10;
    const feeAmount = amountNum * feePercentage;
    const transferAmount = amountNum - feeAmount;

    await pool.execute(
      'UPDATE users SET balance = balance - ? WHERE username = ?',
      [amountNum, senderUsername]
    );
    await pool.execute(
      'UPDATE users SET balance = balance + ? WHERE id = ?',
      [transferAmount, receiverId]
    );

    const newBalanceSender = (parseFloat(sender.balance) - amountNum).toFixed(8);
    const newBalanceReceiver = (parseFloat(receiver.balance) + transferAmount).toFixed(8);

    res.json({
      message: `Chuyển ${amountNum} ⟁ từ người dùng ${senderUsername} sang người dùng ${receiverId}`,
      transferAmount: transferAmount.toFixed(8),
      fee: feeAmount.toFixed(8),
      feePercentage: (feePercentage * 100).toFixed(2) + '%',
      newBalanceSender,
      newBalanceReceiver
    });

    function getFormattedTime() {
      const now = new Date();
      const day = String(now.getDate()).padStart(2, "0");
      const month = String(now.getMonth() + 1).padStart(2, "0");
      const year = now.getFullYear();
      const hours = String(now.getHours()).padStart(2, "0");
      const minutes = String(now.getMinutes()).padStart(2, "0");
      const seconds = String(now.getSeconds()).padStart(2, "0");
      return `${day}/${month}/${year} | ${hours}:${minutes}:${seconds}`;
    }

    const logMessage = `[LOGS] [${getFormattedTime()}] ${senderUsername} đã chuyển: ${amountNum} ⟁ sang ${receiverId}, phí: ${feeAmount.toFixed(8)} ⟁ (phí: ${(feePercentage * 100).toFixed(2)}%)`;

    const logDir = path.join(__dirname, 'logs');
    const logFile = path.join(logDir, 'transfer.txt');
    if (!fs.existsSync(logDir)) {
      fs.mkdirSync(logDir, { recursive: true });
    }
    fs.appendFile(logFile, logMessage + '\n', (err) => {
      if (err) {
        console.error('Lỗi khi ghi vào file:', err);
      }
    });

  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Lỗi server' });
  }
});

// -----------------------
// Endpoint lấy trạng thái mining (bao gồm balance, thời gian, fixedAmount)
// -----------------------
app.get('/status', isAuthenticated, async (req, res) => {
  const username = req.session.username || (req.user && req.user.username);

  try {
    const [rows] = await pool.execute(
      'SELECT balance, mining_active, mining_start_time, mining_fixed_amount FROM users WHERE username = ?',
      [username]
    );

    if (rows.length === 0) {
      console.log(`[ERROR] Người dùng ${username} không tồn tại.`);
      return res.status(400).json({ message: 'Người dùng không tồn tại' });
    }

    const user = rows[0];
    let timeRemainingMs = 0;
    let sessionDurationMs = SESSION_DURATION;
    let fixedAmount = user.mining_fixed_amount || 0;

    if (user.mining_active && user.mining_start_time) {
      const startTime = parseInt(user.mining_start_time);
      const elapsed = Date.now() - startTime;
      timeRemainingMs = Math.max(SESSION_DURATION - elapsed, 0);
    }

    res.json({
      balance: user.balance,
      mining: Boolean(user.mining_active),
      timeRemainingMs: timeRemainingMs,
      sessionDurationMs: sessionDurationMs,
      fixedAmount: fixedAmount,
      miningSpeedPerSecond: parseFloat((Number(fixedAmount) || 0).toFixed(8))
    });
  } catch (err) {
    console.error('[ERROR] Lỗi server:', err);
    res.status(500).json({ message: 'Lỗi server' });
  }
});

// -----------------------
// Endpoint lấy thông tin số EXP của user
// -----------------------
app.get('/exp', isAuthenticated, async (req, res) => {
  const username = req.session.username || (req.user && req.user.username);
  try {
    const [rows] = await pool.execute('SELECT exp FROM users WHERE username = ?', [username]);
    if (rows.length === 0) {
      return res.status(400).json({ message: 'Người dùng không tồn tại' });
    }
    const user = rows[0];
    res.json({ exp: user.exp });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Lỗi server' });
  }
});

// -----------------------
// Endpoint lấy info của user
// -----------------------
app.get('/info', isAuthenticated, async (req, res) => {
  try {
    const username = req.session.username || (req.user && req.user.username);

    if (!username) {
      return res.status(401).json({ message: 'Chưa đăng nhập' });
    }

    // Lấy địa chỉ IP của client
    let clientIp = req.ip;
    if (req.headers['x-forwarded-for']) {
      clientIp = req.headers['x-forwarded-for'].split(',')[0];
    }

    const [rows] = await pool.execute(
      'SELECT id, username, level, balance FROM users WHERE username = ?',
      [username]
    );

    if (rows.length === 0) {
      return res.status(404).json({ message: 'Không tìm thấy người dùng' });
    }

    const user = rows[0];

    res.json({
      id: user.id,
      username: user.username,
      level: user.level,
      balance: user.balance,
      ip: clientIp,
      userAgent: req.headers['user-agent'] || 'Không xác định',
    });

  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Lỗi server' });
  }
});


// -----------------------
// Endpoint lấy thông tin level và id của user
// -----------------------
app.get('/level', isAuthenticated, async (req, res) => {
  const username = req.session.username || (req.user && req.user.username);
  try {
    const [rows] = await pool.execute('SELECT id, level FROM users WHERE username = ?', [username]);
    if (rows.length === 0) {
      return res.status(400).json({ message: 'Người dùng không tồn tại' });
    }
    const userId = rows[0].id;
    const userLevel = rows[0].level;
    res.json({ id: userId, level: userLevel });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Lỗi server' });
  }
});

// -----------------------
// Endpoint xem số dư
// -----------------------
app.get('/balance', isAuthenticated, async (req, res) => {
  const username = req.session.username || (req.user && req.user.username);
  
  try {
    const [rows] = await pool.execute('SELECT balance FROM users WHERE username = ?', [username]);
    if (rows.length === 0) {
      return res.status(400).json({ message: 'Người dùng không tồn tại' });
    }
    const balance = parseFloat(rows[0].balance).toFixed(8);
    res.json({ balance });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Lỗi server' });
  }
});

// Khởi động server
const PORT = 3000;
app.listen(PORT, () => {
  console.log(`Server đang chạy trên cổng ${PORT}`);
});
