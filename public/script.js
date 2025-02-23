$(document).ready(function(){
  let statusInterval;
  let previousBalance = null; // Lưu số dư cũ để so sánh

  // Hàm hiển thị Dashboard
  function showDashboard() {
    $("#authSection").hide();
    $("#dashboardSection").show();
    $("#nav-logout").show();
    $("#nav-level").show();  // Hiển thị phần navbar chứa Level
    updateStatus();
    updateExpAndLevel();  // Cập nhật EXP và Level ngay khi vào Dashboard
    statusInterval = setInterval(updateStatus, 1000);
  }

  // Hàm hiển thị phần đăng nhập / đăng ký
  function showAuth() {
    $("#authSection").show();
    $("#dashboardSection").hide();
    $("#nav-logout").hide();
    $("#nav-level").hide();
    if(statusInterval) {
      clearInterval(statusInterval);
    }
  }

  // Mở modal chuyển tiền khi click nút "Chuyển tiền"
  document.getElementById('transferBtn').addEventListener('click', function() {
    $('#transferModal').modal('show');
  });

  // Xử lý sự kiện gửi form chuyển tiền (dành cho người gửi)
  document.getElementById('transferForm').addEventListener('submit', function(e) {
    e.preventDefault();
    const receiverId = document.getElementById('receiverId').value;
    const amount = document.getElementById('transferAmount').value;

    $.ajax({
      url: '/transfer',
      method: 'POST',
      data: JSON.stringify({ receiverId, amount }),
      contentType: "application/json",
      xhrFields: { withCredentials: true },
      success: function(response) {
        alert(
          `Chuyển tiền thành công!\nSố tiền nhận được: ${response.transferAmount} ⟁\nPhí: ${response.fee} ⟁ (${response.feePercentage})`
        );
        // Cập nhật số dư mới trong dashboard của người gửi
        document.getElementById('balanceDisplay').textContent = response.newBalanceSender;
        $('#transferModal').modal('hide');
      },
      error: function(xhr) {
        const errMsg = xhr.responseJSON && xhr.responseJSON.message ? xhr.responseJSON.message : 'Lỗi hệ thống';
        alert('Chuyển tiền thất bại: ' + errMsg);
      }
    });
  });
  $(document).ready(function() {
    // Hàm kiểm tra và cập nhật trạng thái menu
    function checkMenuStatus() {
      $.get('/info')
        .done(function() {
          $('#menuItem').show();
        })
        .fail(function() {
          $('#menuItem').hide();
        });
    }

    // Kiểm tra trạng thái menu ngay khi trang load và lặp lại mỗi 5 giây
    checkMenuStatus();
    setInterval(checkMenuStatus, 5000);

    // Hàm lấy thông tin user khi click vào nút infoBtn
    $('#infoBtn').click(function() {
      $.get('/info', function(data) {
        $('#infoId').text(data.id || 'N/A');
        $('#infoUsername').text(data.username || 'N/A');
        $('#infoLevel').text(data.level || 'N/A');
        $('#infoBalance').text(data.balance || 'N/A');
        $('#infoIP').text(data.ip || 'N/A');
        $('#infoUserAgent').text(data.userAgent || 'N/A');
        $('#infoModal').modal('show');
      }).fail(function() {
        alert('Không thể lấy thông tin user');
      });
    });
  });
  // Hàm cập nhật trạng thái (balance, mining, ...)
  function updateStatus() {
    $.ajax({
      url: "/status",
      method: "GET",
      xhrFields: { withCredentials: true },
      success: function (data) {
        $("#balanceDisplay").text(data.balance);
        let currentBalance = parseFloat(data.balance);
        previousBalance = currentBalance;
        
        if (data.mining) {
          $("#miningStatus").text("Mining");
          let totalMs = data.sessionDurationMs;
          let timeRemaining = data.timeRemainingMs;
          let seconds = Math.floor((timeRemaining / 1000) % 60);
          let minutes = Math.floor((timeRemaining / (1000 * 60)) % 60);
          let hours = Math.floor(timeRemaining / (1000 * 60 * 60));
          $("#timeRemaining").text(`${hours}h ${minutes}m ${seconds}s`);
          $("#mineBtn").prop("disabled", true);
          let percentage = ((totalMs - timeRemaining) / totalMs) * 100;
          updateProgressBar(percentage);
          $("#fixedAmountDisplay").text(formatNumber(data.fixedAmount));
          $("#miningSpeed").text(formatNumber(data.miningSpeedPerSecond));
        } else {
          $("#miningStatus").text("Not Mining");
          $("#timeRemaining").text("0");
          $("#mineBtn").prop("disabled", false);
          updateProgressBar(0);
          $("#fixedAmountDisplay").text("0.00000000");
          $("#miningSpeed").text("0.00000000");
        }
      },
      error: function (err) {
        console.error("Error fetching status", err);
        showAuth();
      }
    });
  }

  // Hàm cập nhật progress bar
  function updateProgressBar(percentage) {
    let progressBar = document.querySelector('.progress-bar');
    progressBar.style.width = `${percentage}%`;
    progressBar.setAttribute('aria-valuenow', percentage);
  }

  // Hàm định dạng số với 8 chữ số thập phân
  function formatNumber(n) {
    let num = parseFloat(n);
    if (isNaN(num)) {
      return "0.00000000";
    }
    return num.toFixed(8);
  }

  updateStatus();
  setInterval(updateStatus, 60000);

  // Kiểm tra trạng thái đăng nhập ngay khi load trang bằng cách gọi /status
  $.ajax({
    url: "/status",
    method: "GET",
    xhrFields: { withCredentials: true },
    success: function(data) {
      showDashboard();
    },
    error: function(err) {
      showAuth();
    }
  });

  // Xử lý form đăng nhập
  $("#loginFormElement").submit(function(e) {
    e.preventDefault();
    const username = $("#loginUsername").val();
    const password = $("#loginPassword").val();
    $.ajax({
      url: "/login",
      method: "POST",
      contentType: "application/json",
      data: JSON.stringify({ username, password }),
      xhrFields: { withCredentials: true },
      success: function(data) {
        alert("Login successful!");
        showDashboard();
      },
      error: function(err) {
        alert("Login failed: " + err.responseJSON.message);
      }
    });
  });

  // Xử lý form đăng ký
  $("#registerFormElement").submit(function(e) {
    e.preventDefault();
    const username = $("#registerUsername").val();
    const password = $("#registerPassword").val();
    const confirmPassword = $("#registerConfirmPassword").val();

    if (password !== confirmPassword) {
      alert("Passwords do not match!");
      return;
    }

    $.ajax({
      url: "/register",
      method: "POST",
      contentType: "application/json",
      data: JSON.stringify({ username, password }),
      success: function(data) {
        alert("Registration successful! Please login.");
        $('#login-tab').tab('show');
      },
      error: function(err) {
        alert("Registration failed: " + err.responseJSON.message);
      }
    });
  });

  // Xử lý nút "Start Mining"
  $("#mineBtn").click(function(e) {
    e.preventDefault();
    $.ajax({
      url: "/mine",
      method: "POST",
      xhrFields: { withCredentials: true },
      success: function(data) {
        updateStatus();
        if(data.fixedAmount && data.fixedAmount > 0) {
          let speedPerSecond = data.fixedAmount;
          if(speedPerSecond > 0) {
            $("#miningSpeed").text(formatNumber(speedPerSecond) + " coin");
          } else {
            $("#miningSpeed").text("Bạn chưa đào.");
          }
          $("#fixedAmountDisplay").text(formatNumber(data.fixedAmount));
        } else {
          $("#miningSpeed").text("Bạn chưa đào.");
          $("#fixedAmountDisplay").text("0");
        }
      },
      error: function(err) {
        alert("Error starting mining: " + err.responseJSON.message);
      }
    });
  });

  // Hàm cập nhật EXP, Level và Bonus Exp từ server
  function updateExpAndLevel() {
    $.ajax({
      url: "/exp",
      method: "GET",
      xhrFields: { withCredentials: true },
      success: function(data) {
        $("#expDisplay").text(formatNumber(data.exp));
        $.ajax({
          url: "/level",
          method: "GET",
          xhrFields: { withCredentials: true },
          success: function(levelData) {
            console.log("Level data:", levelData);
            $("#levelDisplay").text(levelData.level);
            $("#nav-level").show();
          },
          error: function(err) {
            console.error("Lỗi khi lấy Level:", err);
            $("#levelDisplay").text("N/A");
            $("#nav-level").show();
          }
        });
        
        // Gọi API /bonus để lấy thông tin bonusExp
        $.ajax({
          url: "/bonus",
          method: "GET",
          xhrFields: { withCredentials: true },
          success: function(bonusData) {
            console.log("Bonus data:", bonusData);
            $("#bonusExpDisplay").text(formatNumber(bonusData.bonusExp));
            $("#nav-bonus").show();
          },
          error: function(err) {
            console.error("Lỗi khi lấy Bonus:", err);
            $("#bonusExpDisplay").text("Bạn chưa đào.");
            $("#nav-bonus").show();
          }
        });

      },
      error: function(err) {
        console.error("Lỗi khi lấy EXP:", err);
      }
    });
  }

  setInterval(updateExpAndLevel, 10000);

  // Xử lý nút Logout
  $("#logoutBtn").click(function(e){
    e.preventDefault();
    $.ajax({
      url: "/logout",
      method: "GET",
      xhrFields: { withCredentials: true },
      success: function(data) {
        alert("Logged out successfully!");
        showAuth();
      },
      error: function(err) {
        alert("Logout failed.");
      }
    });
  });

  // Xử lý nút "Leaderboard" trên Dashboard
  $('#showLeaderboardBtn').click(function() {
    $('#dashboardSection').addClass('blur')
      .delay(300)
      .fadeOut(300, function() {
        $(this).removeClass('blur');
        $('#leaderboardSection').addClass('blur').fadeIn(300, function() {
          $(this).removeClass('blur');
        });
      });
    
    $.ajax({
      url: '/leaderboard',
      method: 'GET',
      xhrFields: { withCredentials: true },
      dataType: 'json',
      success: function(data) {
        $('#leaderboardTableBody').empty();
        $.each(data, function(index, entry) {
          var rank = index + 1;
          var row = '<tr>' +
            '<td>' + rank + '</td>' +
            '<td>' + entry.username + '</td>' +
            '<td>' + entry.balance + '</td>' +
            '<td>' + entry.level + '</td>' +
            '</tr>';
          $('#leaderboardTableBody').append(row);
        });
      },
      error: function(xhr, status, error) {
        console.error("Error fetching leaderboard data:", error);
      }
    });
  });

  $('#submitChangePassword').click(function() {
    const oldPassword = $('#oldPassword').val();
    const newPassword = $('#newPassword').val();
    const confirmNewPassword = $('#confirmNewPassword').val();
    
    if (newPassword !== confirmNewPassword) {
      alert('Mật khẩu mới và xác nhận mật khẩu không khớp!');
      return;
    }
    
    $.ajax({
      url: '/change-password',
      type: 'POST',
      contentType: 'application/json',
      data: JSON.stringify({ oldPassword, newPassword, confirmNewPassword }),
      xhrFields: { withCredentials: true },
      success: function(response) {
        alert(response.message);
        $('#changePasswordModal').modal('hide');
      },
      error: function(xhr) {
        alert(xhr.responseJSON.message);
      }
    });
  });
  
  $.ajax({
    url: '/level',
    method: 'GET',
    cache: false, // Ngăn trình duyệt sử dụng cache
    xhrFields: { withCredentials: true },
    success: function(data) {
      if (data.id && data.level) {
        $('#userId').text('Địa chỉ ví của bạn : ' + data.id);
        $('#userLevel').text('User Level: ' + data.level);

        if (data.level >= 10) {
          $('#userLevel').addClass('high-level');
        } else {
          $('#userLevel').addClass('low-level');
        }
      } else {
        console.log('Không lấy được dữ liệu');
      }
    },
    error: function() {
      console.log('Lỗi khi gửi yêu cầu');
    }
  });

  $('#backToDashboard').click(function() {
    $('#leaderboardSection').addClass('blur')
      .delay(300)
      .fadeOut(300, function() {
        $(this).removeClass('blur');
        $('#dashboardSection').addClass('blur').fadeIn(300, function() {
          $(this).removeClass('blur');
        });
      });
  });
});
