    /** 临时 toast：右下角小提示，2.5s 自动消失。 */
    function showToast(message, kind) {
      var tagId = "dsh-git-hub/toast";
      var old = document.querySelector("[data-plugin-css=\"" + tagId + "\"]");
      // 用同一 CSS 容器，但每次插入一个 div（toast 节点本身不算 CSS）
      var toast = document.createElement("div");
      toast.className = "DGH_toast DGH_toast-" + (kind || "info");
      toast.textContent = message;
      document.body.appendChild(toast);
      setTimeout(function () {
        if (document.body.contains(toast)) toast.remove();
      }, 2500);
    }

