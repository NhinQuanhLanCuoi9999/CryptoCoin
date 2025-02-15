$(document).ready(function(){
  let statusInterval;

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

  function updateStatus() {
    $.ajax({
      url: "/status",
      method: "GET",
      success: function (data) {
        $("#balanceDisplay").text(data.balance);
        if (data.mining) {
          $("#miningStatus").text("Mining");
  
          // Lấy tổng thời gian phiên và thời gian còn lại từ dữ liệu server (đều được tính động)
          let totalMs = data.sessionDurationMs; // Ví dụ: 24 * 60 * 60 * 1000 (24 giờ)
          let timeRemaining = data.timeRemainingMs; // Thời gian còn lại được tính ở backend
  
          // Tính giờ, phút, giây từ timeRemaining
          let seconds = Math.floor((timeRemaining / 1000) % 60);
          let minutes = Math.floor((timeRemaining / (1000 * 60)) % 60);
          let hours = Math.floor(timeRemaining / (1000 * 60 * 60));
  
          // Hiển thị thời gian dưới dạng "Xh Ym Zs"
          $("#timeRemaining").text(`${hours}h ${minutes}m ${seconds}s`);
          $("#mineBtn").prop("disabled", true);
  
          // Tính phần trăm đã hoàn thành của phiên đào
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

  // Gọi updateStatus ban đầu và sau đó mỗi 1 phút
  updateStatus();
  setInterval(updateStatus, 60000);

  // Kiểm tra trạng thái đăng nhập ngay khi load trang bằng cách gọi /status
  $.ajax({
    url: "/status",
    method: "GET",
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
      success: function(data) {
        updateStatus();
        if(data.fixedAmount && data.fixedAmount > 0) {
          let speedPerSecond = data.fixedAmount;
          if(speedPerSecond > 0) {
            $("#miningSpeed").text(formatNumber(speedPerSecond) + " coin/s");
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
    success: function(data) {
      $("#expDisplay").text(formatNumber(data.exp));
      $.ajax({
        url: "/level",
        method: "GET",
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
        success: function(bonusData) {
          console.log("Bonus data:", bonusData);
          // Hiển thị thông tin bonusExp
          $("#bonusExpDisplay").text(formatNumber(bonusData.bonusExp)); // Hiển thị bonusExp
          $("#nav-bonus").show(); // Nếu có phần hiển thị bonus thì cho nó xuất hiện
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


  // Cập nhật EXP và Level mỗi 10 giây
  setInterval(updateExpAndLevel, 10000);

  // Xử lý nút Logout
  $("#logoutBtn").click(function(e){
    e.preventDefault();
    $.ajax({
      url: "/logout",
      method: "GET",
      success: function(data) {
        alert("Logged out successfully!");
        showAuth();
      },
      error: function(err) {
        alert("Logout failed.");
      }
    });
  });
});
$(document).ready(function() {
  // Khi nhấn nút "Leaderboard" trên Dashboard
  $('#showLeaderboardBtn').click(function() {
    // Hiệu ứng chuyển đổi: thêm blur, delay 300ms, fadeOut, sau đó fadeIn Leaderboard
    $('#dashboardSection').addClass('blur')
      .delay(300)
      .fadeOut(300, function() {
        $(this).removeClass('blur');
        $('#leaderboardSection').addClass('blur').fadeIn(300, function() {
          $(this).removeClass('blur');
        });
      });
    
    // Lấy dữ liệu từ endpoint /leaderboard
    $.ajax({
      url: '/leaderboard',
      method: 'GET',
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

  // Khi nhấn nút "Back" trên bảng Leaderboard
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
