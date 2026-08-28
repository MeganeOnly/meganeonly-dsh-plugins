    // ===== stats-line-position =====
    // ====================================================================
    // v0.10.0：统计行位置（stats-line-position tweak）
    // --------------------------------------------------------------------
    // DSH 对话底部那行统计（"3 轮 · 45 步 | LLM 12m13s · 工具调用 1m21s |
    //   首 token 平均 2.9s · 71 tok/s | 缓存命中 96% | 输入 3.6M tok ·
    //   输出 42.7K tok"）由 dsh-client-ui-conversation 的 StatsLine 组件渲染，
    //   注册在 slot `conversation.composer.dock`（order 0，id "stats"）。
    //
    // 三种位置：
    //   - bottom（默认）：DSH 原样，本控制器不启动，buildCSS 返回 null
    //   - top：底部原生行整条隐藏，另在顶部标题行（"对话名 + 模式"那一簇）
    //     右侧渲染一个**本插件独占的镜像元素**，内容周期性从原生行克隆
    //   - hidden：底部原生行整条隐藏，不渲染镜像
    //
    // v0.10.1：隐藏用 `visibility:hidden` 而不是 `display:none`——统计行是
    //   composer 卡片的 footer，而 composer seat 是 `position:sticky;bottom:0`
    //   贴底的，卡片变矮 24px 就等于输入行整体下移 24px（用户实测"发消息的框
    //   往下走了一点点"）。visibility 保留盒子（照常参与布局、照常被 React
    //   更新文本），高度分毫不差地保留，输入框位置与"底部"完全一致。
    //   详见 `25-tweaks.js` 的 stats-line-position buildCSS v0.10.1 段。
    //
    // 为什么"镜像"而不是"搬 DOM"：原生统计行与顶部标题行都是 DSH React
    //   渲染的节点。把原生节点 appendChild 到别的容器里，React 在下次
    //   卸载它（StatsLine 在 groups 为空时 return null，新会话开局必然发生）
    //   时会对**它记录的原父节点**调 removeChild → NotFoundError 崩 React 树。
    //   镜像方案里原生节点始终留在原位（只是不可见——React 照常更新
    //   它的文本），我们只读它的内容；镜像是本插件 createElement 出来的、
    //   React 不认识的额外尾部子节点（与 v0.9.6 disclosure-end-collapse
    //   往 body 末尾 appendChild 按钮同一模式，已验证不干扰 React 协调）。
    //
    // 为什么锚点用 `[data-slot="..."]` 而不是 CSS module 类名：DSH renderer
    //   （dsh-client-ui-renderer SlotOutlet）给**每个** slot 出口包一层
    //   `<div data-slot="<slot key>" style="display:contents">`——不含 hash、
    //   跨 DSH 版本稳定，比 `.FJxK0a_root` 这类每次构建都会变的 CSS module
    //   hash 类名可靠得多。注意这层的 `display:contents` 是 inline style，
    //   同规则组一律带 `!important` 以免被它或 DSH 后续规则翻盘。
    //
    // 隐藏粒度：直接隐藏整个 `conversation.composer.dock` 出口。DSH 自己的
    //   slot 目录（dsh-cordis-client-runner 的 slot catalog）把该 slot 的
    //   occupants 记为 `["client-ui-conversation StatsLine id 'stats'"]`——
    //   唯一占位者就是统计行，所以隐藏整个出口 == 隐藏统计行，且不依赖任何
    //   hash 类名。代价：若将来有第三方插件也往 composer.dock 注册条目，
    //   本 tweak 开启（top / hidden）时会连带隐藏它——已在 tweak description
    //   与 README 注明。
    // ====================================================================

    /** 把任意持久化值归一到三个合法位置之一（脏数据 / 老版本布尔值都退回 bottom）。 */
    function statsNormalizePosition(value) {
      if (value === STATS_POS_TOP) return STATS_POS_TOP;
      if (value === STATS_POS_HIDDEN) return STATS_POS_HIDDEN;
      return STATS_POS_BOTTOM;
    }

    /**
     * 找 DSH 原生统计行的根元素（StatsLine 的 `<div className={...root}>`）。
     *
     * 策略：先用稳定锚点 `[data-slot="conversation.composer.dock"]` 圈定范围，
     *   再在其中取**最内层**的 `[class*="_root"]`——DSH 用 Tooltip 包裹
     *   StatsLine，若 Tooltip 将来也带 `_root` 类名，最内层那个才是统计行
     *   自身。全都没命中时退回出口的第一个元素子节点。
     */
    function statsFindSource() {
      if (typeof document === "undefined") return null;
      var dock = document.querySelector(STATS_DOCK_SEL);
      if (!dock) return null;
      var list = dock.querySelectorAll(STATS_ROOT_HINT_SEL);
      for (var i = list.length - 1; i >= 0; i--) {
        if (list[i].querySelector(STATS_ROOT_HINT_SEL) === null) return list[i];
      }
      return dock.firstElementChild;
    }

    /**
     * 找顶部标题簇容器——也就是"对话名 + 模式"横向排布的那个 flex 容器
     *   （DSH ConversationRoot 的 titleCluster：children = [面包屑 nav,
     *   headerActions]）。镜像 append 到它末尾即落在模式标签右边。
     *
     * 主路径：`[data-slot="conversation.session.header.actions"]` 出口
     *   → 父（headerActions 包装 div）→ 父（titleCluster）。全程无 hash。
     * 兜底：`[class*="_titleCluster"]` 子串匹配（与 v0.7.3 HoverCard /
     *   v0.9.14 sidebar 同策略的 hash-independence 写法）。
     */
    function statsFindTitleCluster() {
      if (typeof document === "undefined") return null;
      var actions = document.querySelector(STATS_HEADER_ACTIONS_SEL);
      if (actions && actions.parentElement && actions.parentElement.parentElement) {
        return actions.parentElement.parentElement;
      }
      return document.querySelector(STATS_TITLE_CLUSTER_HINT_SEL);
    }

    /** 清掉页面上所有本插件的统计行镜像（切位置 / 停用 / header 被重建时）。 */
    function statsRemoveMirror() {
      if (typeof document === "undefined") return;
      var nodes = document.querySelectorAll("[" + STATS_MIRROR_ATTR + "]");
      for (var i = 0; i < nodes.length; i++) {
        if (nodes[i].parentNode) nodes[i].parentNode.removeChild(nodes[i]);
      }
    }

    /**
     * 确保标题簇末尾有一个镜像元素。幂等——已有则直接返回。
     *   当前标题簇里没有时，先把别处残留的孤儿镜像清掉（DSH 换会话重建
     *   header 的场景），再新建，保证全页面只存在一个镜像。
     */
    function statsEnsureMirror() {
      if (typeof document === "undefined") return null;
      var cluster = statsFindTitleCluster();
      if (!cluster) return null;
      var existing = cluster.querySelector("[" + STATS_MIRROR_ATTR + "]");
      if (existing) return existing;
      statsRemoveMirror();
      var mirror = document.createElement("div");
      mirror.setAttribute(STATS_MIRROR_ATTR, "");
      cluster.appendChild(mirror);
      return mirror;
    }

    /**
     * 把原生统计行的内容克隆进镜像。
     *   - 用 `cloneNode(true)` 后逐个搬运子节点，而不是直接塞克隆根——
     *     克隆根带着 DSH 的 `_root` 类（`text-align:center` / `width:100%` /
     *     `max-width:var(--dsh-chat-content-width)` / 底部专用 padding），
     *     放进标题行会撑破布局；只搬子节点则保留分隔符 `<span class="..._sep">`
     *     的类名，DSH 自己的 `.._sep{color:...;margin:0 10px}` 继续生效，
     *     视觉与底部原生行一致。
     *   - 文本没变就整段跳过，避免每 400ms 无谓重建 DOM（也顺带避免
     *     镜像自身的 mutation 触发别的观察者）。用 `title` 同时兼作
     *     "上次内容"缓存与鼠标悬停时的完整内容 tooltip（标题行窄，
     *     镜像会 ellipsis 截断）。
     */
    function statsSyncMirror(mirror, source) {
      var text = source === null ? "" : (source.textContent || "");
      if (mirror.title === text) return;
      mirror.title = text;
      while (mirror.firstChild) mirror.removeChild(mirror.firstChild);
      if (text === "" || source === null) return;
      var clone = source.cloneNode(true);
      while (clone.firstChild) mirror.appendChild(clone.firstChild);
    }

    /**
     * v0.10.0：统计行位置 controller。
     *
     * 只有 top 位置需要运行（维护镜像）；bottom / hidden 都只靠 buildCSS
     *   的纯 CSS 生效，controller 停机。
     *
     * 轮询而非 MutationObserver：统计行内容按"步"更新（不是按 token 流），
     *   400ms 轮询足够跟手；而统计行文本变化是 characterData mutation，
     *   要用 observer 就得在 document 上开 characterData+subtree——对话
     *   流式输出时每个 token 都会触发，开销远大于一次 textContent 比较。
     *   节奏与 v0.9.x simple-mode 状态行的 setInterval 轮询一致。
     *   轮询同时兼任"自愈"：DSH 换会话重建 header 后下一 tick 自动补镜像。
     */
    function createStatsLinePositionController() {
      var intervalId = null;
      var isRunning = false;

      function tick() {
        var mirror = statsEnsureMirror();
        if (mirror === null) return;
        statsSyncMirror(mirror, statsFindSource());
      }

      function start() {
        if (isRunning) return;
        if (typeof window === "undefined" || !window.setInterval) return;
        isRunning = true;
        intervalId = window.setInterval(tick, STATS_POLL_MS);
        tick();
      }

      function stop() {
        if (intervalId !== null && typeof window !== "undefined" && window.clearInterval) {
          window.clearInterval(intervalId);
        }
        intervalId = null;
        isRunning = false;
        statsRemoveMirror();
      }

      /** 按当前位置值启停。返回归一化后的位置，方便调用方记录 / 诊断。 */
      function sync(position) {
        var pos = statsNormalizePosition(position);
        if (pos === STATS_POS_TOP) start();
        else stop();
        return pos;
      }

      return {
        start: start,
        stop: stop,
        sync: sync,
        get running() { return isRunning; }
      };
    }

