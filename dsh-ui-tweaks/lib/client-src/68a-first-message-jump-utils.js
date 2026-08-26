// ===== first-message-jump utils =====
    // ====================================================================
    // 纯 finder / scanner 函数（不依赖 closure 状态，全部以 `port` 作参
    // 数）。从 68-first-message-jump.js 拆出（v0.9.0 → v0.9.2 三轮迭
    // 代累积后主文件 645 行 / 31.2 KB，超过 maintainability.md 的 30 KB
    // 阈值）。拆分后主文件回到 ~430 行 / ~21 KB 阈值下，utils 本文件
    // ~220 行 / ~9 KB。
    //
    // 与主文件的关系：所有函数共享一个工厂函数体（client-src/*.js 按
    // 文件名升序整段拼接进 lib/client.js），所以 jump* 函数名在主文
    // 件里仍可直接调用。共享常量 (JUMP_SCROLL_SEL / JUMP_USER_ROW_SEL /
    // JUMP_DRAWER_ATTR) 由 20-constants.js 单点定义。
    //
    // 函数清单：
    //   - jumpFindScrollport         滚动容器查询
    //   - jumpAllUserRows            当前会话所有 user 行（DOM 顺序，
    //                                 转静态数组避免 NodeList live 错位）
    //   - jumpFindFirstUserRow       firstRow（DOM 顺序最早；v0.9.2 仍
    //                                 保留作为内部锚点）
    //   - jumpFindLastUserRow        lastRow
    //   - jumpIsRowInCompaction      v0.9.2：判断 row 是否嵌在
    //                                 compaction / context 容器里
    //   - jumpFindFirstRealUserRow   v0.9.2：跳过 compact 块的"当前会话
    //                                 第一条 user 行"——Shift+点击的终点
    //   - jumpFindLastVisibleUserRow 视口内最底部可见 user 行（v0.9.0
    //                                 锚点，保留作诊断对照）
    //   - jumpFindTopVisibleUserRow  v0.9.1 起当前锚点：视口内最顶部可见
    //                                 user 行——v0.9.0 的 lastVisible 在
    //                                 短消息 + 滚到 rows[1] 时会卡死
    //                                 （下方 rows[2..N] 仍可见 → 死循环）
    //   - jumpFindPrevUserRow        我的按钮单击 target（v0.9.1 锚点
    //                                 改为 topVisible 修复"上数第二条卡住"
    //                                 bug）
    //   - jumpFindNextUserRow        v0.9.1：原生「回到底部」按钮单击
    //                                 target——几何与 prev 完全对称
    //   - jumpIsDrawerOpen           右侧抽屉是否打开（attr 探测）
    //   - jumpDrawerWidth            抽屉覆盖到视口右侧的宽度（px）——读
    //                                 --active-drawer-width
    // ====================================================================

    /** 当前会话滚动容器：取第一个可见（非零尺寸）的 [data-conversation-scroll]。 */
    function jumpFindScrollport() {
      if (typeof document === "undefined") return null;
      var nodes = document.querySelectorAll(JUMP_SCROLL_SEL);
      var fallback = null;
      for (var i = 0; i < nodes.length; i++) {
        if (fallback === null) fallback = nodes[i];
        var r = nodes[i].getBoundingClientRect();
        if (r && r.width > 0 && r.height > 0) return nodes[i];
      }
      return fallback;
    }

    /**
     * 当前会话所有 user 行（DOM 顺序即时间顺序）。每次调用实时查询，
     * 不缓存（DOM 重建时引用失效；用户消息流式生成 / 删除 / React 重渲都
     * 会让旧引用作废）。
     */
    function jumpAllUserRows(port) {
      if (!port) return [];
      var nodes = port.querySelectorAll(JUMP_USER_ROW_SEL);
      // NodeList 是 live 的，转成静态数组避免迭代中 DOM 变化引起索引错位
      var arr = [];
      for (var i = 0; i < nodes.length; i++) arr.push(nodes[i]);
      return arr;
    }

    /** 最早一条 user 行（firstRow），无则 null。 */
    function jumpFindFirstUserRow(port) {
      var rows = jumpAllUserRows(port);
      return rows.length > 0 ? rows[0] : null;
    }

    /**
     * v0.9.2：判断一个 user 行是否"嵌在" compaction / context 容器里。
     * 沿父链向上走，遇到的第一个有 `data-chat-flow-kind` 属性的祖先
     * 若属于 compaction / manual-compaction / context 之一，即视为嵌
     * 在被压缩或注入的上下文里——不当作"当前会话真实的第一条"。
     *
     * 用途：jumpFindFirstUserRow 用它跳过 compact 块里的 user 行———
     * 用户期望的"第一条我发的消息"是 compaction 块之后的当前会话起点，
     * 而不是 compact 摘要里旧会话的 user 行（v0.9.1 这里返回 compaction
     * 里那条——bug）。
     */
    function jumpIsRowInCompaction(row) {
      if (!row) return false;
      var parent = row.parentElement;
      while (parent && parent !== document.body && parent.nodeType === 1) {
        var kind = (typeof parent.getAttribute === "function")
          ? parent.getAttribute("data-chat-flow-kind")
          : null;
        if (kind === "compaction" || kind === "manual-compaction" || kind === "context") {
          return true;
        }
        parent = parent.parentElement;
      }
      return false;
    }

    /** 最近一条 user 行（lastRow），无则 null。 */
    function jumpFindLastUserRow(port) {
      var rows = jumpAllUserRows(port);
      return rows.length > 0 ? rows[rows.length - 1] : null;
    }

    /**
     * 找"视口内最底部可见的 user 行"——与当前视口相交、且在 DOM 顺序
     * 中位置最靠后的那一条。可见判定 = rect 与 viewport rect 相交：
     *   row.bottom > portTop && row.top < portBottom
     * 这是"至少有一像素在视口内"的真正相交判定，比 v0.8.0 的"行顶
     * 在 viewport 顶部 200px 带内"更精确——可以正确处理"row 顶部在
     * viewport 中下部但 row 本体仍可见"的情况。
     * 视口内无 user 行 → 返回 null。
     * v0.9.1：仍保留此函数——供 `getState()` 诊断使用 + 上数第二条
     * 死循环场景的旧逻辑参考。
     */
    function jumpFindLastVisibleUserRow(port) {
      if (!port) return null;
      var rows = jumpAllUserRows(port);
      if (rows.length === 0) return null;
      var portRect = port.getBoundingClientRect();
      if (!portRect || portRect.height <= 0) return null;
      var lastVisible = null;
      for (var i = 0; i < rows.length; i++) {
        var r = rows[i].getBoundingClientRect();
        if (!r || r.height <= 0) continue;
        // 行顶在视口下方之上（未完全滚出底部） + 行底在视口顶部之下（未完全滚出顶部）
        if (r.top < portRect.bottom && r.bottom > portRect.top) {
          lastVisible = rows[i];
        } else if (r.top >= portRect.bottom) {
          // 已超过视口底部，且 DOM 顺序后续行只会更靠后 → 后续都不可能可见，break
          break;
        }
      }
      return lastVisible;
    }

    /**
     * v0.9.1：找"视口内最顶部可见的 user 行"——与当前视口相交、且在
     * DOM 顺序中位置最靠前的那一条。可见判定同 lastVisible。
     * 视口内无 user 行 → 返回 null。
     *
     * 与 `jumpFindLastVisibleUserRow` 的区别：topVisible 是 DOM 顺序
     * 第一个可见的（最靠顶），lastVisible 是最后一个可见的（最靠底）。
     * v0.9.1 把 step-by-step 导航的锚点从 lastVisible 改为 topVisible
     * ——lastVisible 在短消息 + 滚到 rows[1] 时会卡死（因为下方 rows
     * [2..N] 仍可见 → lastVisible 始终是 rows[N]），topVisible 没有
     * 这个问题（topVisible 始终是当前视口顶部那条 user 行）。
     */
    function jumpFindTopVisibleUserRow(port) {
      if (!port) return null;
      var rows = jumpAllUserRows(port);
      if (rows.length === 0) return null;
      var portRect = port.getBoundingClientRect();
      if (!portRect || portRect.height <= 0) return null;
      for (var i = 0; i < rows.length; i++) {
        var r = rows[i].getBoundingClientRect();
        if (!r || r.height <= 0) continue;
        // 行顶在视口下方之上（未完全滚出底部） + 行底在视口顶部之下（未完全滚出顶部）
        if (r.top < portRect.bottom && r.bottom > portRect.top) {
          return rows[i];
        } else if (r.top >= portRect.bottom) {
          // 已超过视口底部 → 后续都不可能可见，break
          break;
        }
      }
      return null;
    }

    /**
     * 找"上一条"——按钮点击的 target 行（v0.9.1 用 topVisible）：
     *   - 视口内最顶部可见 user 行 = topVisible
     *     - 若 topVisible 存在：target = topVisible 的 DOM 顺序上一条
     *     - 若 topVisible 不存在（视口在所有 user 之上）：target = lastRow（首次入口）
     *   - 若 topVisible === firstRow：target = null（已在最早，无路可上）
     *
     * v0.9.1 改用 topVisible 的关键修复：v0.9.0 用 lastVisible 时，
     * rows[1] 已在视口顶部但 rows[2..N] 仍可见 → lastVisible 始终是
     * rows[N] → target 始终是 rows[N-1] → 死循环（按钮永不隐藏、
     * 永远到不了 rows[0]）。改用 topVisible 后：
     *   topVisible = rows[1] → target = rows[0]
     *   点击 → 滚到 rows[0] → topVisible = rows[0] → target = null → 按钮隐藏 ✓
     */
    function jumpFindPrevUserRow(port) {
      var rows = jumpAllUserRows(port);
      if (rows.length === 0) return null;
      var firstRow = rows[0];
      var lastRow = rows[rows.length - 1];
      var topVisible = jumpFindTopVisibleUserRow(port);
      if (!topVisible) {
        // 视口内无 user 行：跳到最后一条作为入口（用户在对话上方空白区）
        return lastRow;
      }
      if (topVisible === firstRow) {
        // 已是最早一条，没有"上一条"
        return null;
      }
      // 找 topVisible 在 rows 中的索引，返回前一条
      for (var i = 0; i < rows.length; i++) {
        if (rows[i] === topVisible) {
          return i > 0 ? rows[i - 1] : null;
        }
      }
      // 兜底：理论上不可达（topVisible 是 querySelectorAll 结果之一）
      return null;
    }

    /**
     * v0.9.1：找"下一条"——原生「回到底部」按钮单击拦截时的 target 行。
     * 锚点同样用 topVisible（与 prev 对称）：
     *   - 视口内最顶部可见 user 行 = topVisible
     *     - 若 topVisible 存在：target = topVisible 的 DOM 顺序下一条
     *     - 若 topVisible 不存在（视口在所有 user 之上/之下）：
     *       target = firstRow（"从对话起点开始往下一条"——自然入口）
     *   - 若 topVisible === lastRow：target = null（已在最晚，无路可下）
     *
     * 与 prev 对称：prev 用 lastRow 作为"无可见"时的入口（页面刚打开
     * 时跳到最新一条作为起点）；next 用 firstRow（"从对话起点开始往
     * 下走"——起点即入口）。语义对称。
     */
    function jumpFindNextUserRow(port) {
      var rows = jumpAllUserRows(port);
      if (rows.length === 0) return null;
      var firstRow = rows[0];
      var lastRow = rows[rows.length - 1];
      var topVisible = jumpFindTopVisibleUserRow(port);
      if (!topVisible) {
        // 视口内无 user 行：从对话起点开始（firstRow 本身）作为入口
        return firstRow;
      }
      if (topVisible === lastRow) {
        // 已是最晚一条，没有"下一条"
        return null;
      }
      // 找 topVisible 在 rows 中的索引，返回下一条
      for (var i = 0; i < rows.length; i++) {
        if (rows[i] === topVisible) {
          return i < rows.length - 1 ? rows[i + 1] : null;
        }
      }
      // 兜底：理论上不可达
      return null;
    }

    function jumpIsDrawerOpen() {
      return typeof document !== "undefined" &&
        document.documentElement.hasAttribute(JUMP_DRAWER_ATTR);
    }

    /**
     * 当前打开的右侧抽屉宽度（px）。读 html 上的 --active-drawer-width
     * （task-pool / git-hub 等面板打开时按 FAB 让位协议设置）。无抽屉返回 null。
     */
    function jumpDrawerWidth() {
      if (!jumpIsDrawerOpen()) return null;
      if (typeof document === "undefined" || !window.getComputedStyle) return null;
      var cs = window.getComputedStyle(document.documentElement);
      var raw = cs ? cs.getPropertyValue("--active-drawer-width") : "";
      var n = raw ? parseFloat(raw) : NaN;
      return isFinite(n) ? n : null;
    }