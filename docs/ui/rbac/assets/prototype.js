/* ============================================================
   辰光 Agent · RBAC 授权原型 · 交互脚本
   无依赖，直接以 file:// 打开即可运行
   ============================================================ */

(function () {
  "use strict";

  /* ---------- 权限目录（与 PROJECT_SPEC_V2.md 4.4 对齐，63 条） ---------- */
  const MODULES = [
    { key: "dashboard", name: "工作台", actions: ["read"] },
    { key: "agent", name: "Agent 管理", actions: ["read", "create", "update", "delete", "publish", "test"] },
    { key: "provider", name: "供应商管理", actions: ["read", "create", "update", "delete", "test"] },
    { key: "model", name: "模型管理", actions: ["read", "create", "update", "delete", "test"] },
    { key: "prompt", name: "Prompt 管理", actions: ["read", "create", "update", "delete", "publish"] },
    { key: "knowledge", name: "知识库管理", actions: ["read", "create", "update", "delete", "upload", "test"] },
    { key: "tool", name: "工具管理", actions: ["read", "create", "update", "delete", "test"] },
    { key: "conversation", name: "对话日志", actions: ["read", "annotate", "export"] },
    { key: "analytics", name: "数据统计", actions: ["read", "export"] },
    { key: "system.user", name: "用户管理", actions: ["read", "create", "update", "delete", "assign"] },
    { key: "system.role", name: "角色管理", actions: ["read", "create", "update", "delete", "assign"] },
    { key: "system.permission", name: "权限管理", actions: ["read", "create", "update", "delete"] },
    { key: "system.apikey", name: "API 密钥", actions: ["read", "create", "update", "delete"] },
    { key: "system.audit", name: "审计日志", actions: ["read"] },
    { key: "system.alert", name: "告警规则", actions: ["read", "create", "update", "delete"] },
    { key: "system.settings", name: "系统配置", actions: ["read", "update"] }
  ];

  const ACTION_LABELS = {
    read: "查看", create: "创建", update: "编辑", delete: "删除",
    publish: "发布", test: "测试", assign: "分配", upload: "上传",
    export: "导出", annotate: "标注"
  };

  const ACTION_ORDER = ["read", "create", "update", "delete", "publish", "test", "upload", "assign", "export", "annotate"];

  const ALL_PERMS = MODULES.reduce(function (acc, m) {
    return acc.concat(m.actions.map(function (a) { return m.key + ":" + a; }));
  }, []);

  /* ---------- 角色权限（与 PROJECT_SPEC_V2.md 4.5 对齐） ---------- */
  const OPERATOR_PERMS = [
    "dashboard:read",
    "agent:read", "agent:create", "agent:update", "agent:publish", "agent:test",
    "model:read", "model:test",
    "provider:read", "provider:test",
    "prompt:read", "prompt:create", "prompt:update", "prompt:publish",
    "knowledge:read", "knowledge:create", "knowledge:update", "knowledge:upload", "knowledge:test",
    "tool:read", "tool:create", "tool:update", "tool:test",
    "conversation:read", "conversation:annotate",
    "analytics:read", "analytics:export"
  ];

  const VIEWER_PERMS = [
    "dashboard:read",
    "agent:read",
    "model:read",
    "provider:read",
    "prompt:read",
    "knowledge:read",
    "tool:read",
    "conversation:read",
    "analytics:read"
  ];

  const ANALYST_PERMS = [
    "dashboard:read",
    "agent:read", "model:read", "provider:read", "prompt:read",
    "knowledge:read", "tool:read",
    "conversation:read", "conversation:annotate", "conversation:export",
    "analytics:read", "analytics:export"
  ];

  const IDENTITIES = {
    admin: {
      roleLabel: "超级管理员", short: "管理员",
      name: "陈晓", username: "chen.xiao", initial: "陈",
      superuser: true, perms: ALL_PERMS
    },
    operator: {
      roleLabel: "运营人员", short: "运营",
      name: "李明", username: "li.ming", initial: "李",
      superuser: false, perms: OPERATOR_PERMS
    },
    viewer: {
      roleLabel: "只读观察员", short: "只读",
      name: "王芳", username: "wang.fang", initial: "王",
      superuser: false, perms: VIEWER_PERMS
    }
  };

  const MATRIX_ROLES = [
    { code: "admin", name: "超级管理员", system: true, users: 1, readonly: true },
    { code: "operator", name: "运营人员", system: true, users: 8, readonly: false },
    { code: "viewer", name: "只读观察员", system: true, users: 14, readonly: false },
    { code: "analyst", name: "数据分析师", system: false, users: 2, readonly: false }
  ];

  const matrixState = {
    admin: new Set(ALL_PERMS),
    operator: new Set(OPERATOR_PERMS),
    viewer: new Set(VIEWER_PERMS),
    analyst: new Set(ANALYST_PERMS)
  };

  let matrixRole = "operator";
  let matrixDirty = { admin: false, operator: false, viewer: false, analyst: false };

  /* ---------- 图标 ---------- */
  const ICONS = {
    grid: '<rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/>',
    bot: '<rect x="4" y="7" width="16" height="12" rx="2"/><path d="M12 3v4M8 12h.01M16 12h.01M9 16h6"/>',
    cube: '<path d="M12 3l8 4.5v9L12 21l-8-4.5v-9L12 3z"/><path d="M4 7.5l8 4.5 8-4.5M12 12v9"/>',
    text: '<path d="M5 4h14M5 9h14M5 14h9M5 19h6"/>',
    database: '<ellipse cx="12" cy="6" rx="7" ry="3"/><path d="M5 6v6c0 1.7 3.1 3 7 3s7-1.3 7-3V6M5 12v6c0 1.7 3.1 3 7 3s7-1.3 7-3v-6"/>',
    wrench: '<path d="M14.5 6.5a4 4 0 0 0-5 5L4 17l3 3 5.5-5.5a4 4 0 0 0 5-5l-2.5 2.5-2-2 1.5-3z"/>',
    message: '<path d="M4 5h16v11H8l-4 4V5z"/>',
    chart: '<path d="M4 20V10M10 20V4M16 20v-7M22 20H2"/>',
    users: '<circle cx="9" cy="8" r="3"/><path d="M3 20c0-3.3 2.7-6 6-6s6 2.7 6 6M16 5.5a3 3 0 0 1 0 5.5M17 14c2.8.6 5 3.1 5 6"/>',
    shield: '<path d="M12 3l7 3v6c0 4.2-3 7.4-7 9-4-1.6-7-4.8-7-9V6l7-3z"/><path d="M9 12l2 2 4-4"/>',
    key: '<circle cx="8" cy="14" r="3"/><path d="M10.5 12.5L20 3M16 3h4v4M14 5l3 3"/>',
    lock: '<rect x="5" y="10" width="14" height="10" rx="1"/><path d="M8 10V7a4 4 0 0 1 8 0v3"/>',
    list: '<path d="M8 6h13M8 12h13M8 18h13M3 6h.01M3 12h.01M3 18h.01"/>',
    bell: '<path d="M18 9a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9M10 21a2 2 0 0 0 4 0"/>',
    gear: '<circle cx="12" cy="12" r="3"/><path d="M12 2v3M12 19v3M4.2 4.2l2.1 2.1M17.7 17.7l2.1 2.1M2 12h3M19 12h3M4.2 19.8l2.1-2.1M17.7 6.3l2.1-2.1"/>',
    search: '<circle cx="11" cy="11" r="6"/><path d="M16 16l5 5"/>',
    close: '<path d="M6 6l12 12M18 6L6 18"/>',
    info: '<circle cx="12" cy="12" r="9"/><path d="M12 11v5M12 8h.01"/>',
    alert: '<path d="M12 3l10 18H2L12 3z"/><path d="M12 9v5M12 17h.01"/>',
    arrow: '<path d="M5 12h14M13 6l6 6-6 6"/>'
  };

  /* ---------- 导航配置 ---------- */
  const NAV = [
    {
      group: "平台", sub: false, items: [
        { label: "工作台", page: "dashboard", href: "dashboard.html", perm: "dashboard:read", icon: "grid" },
        { label: "Agent 管理", page: "agents", href: "agents.html", perm: "agent:read", icon: "bot", count: "4" },
        { label: "模型管理", page: "models", href: "#", perm: "model:read", icon: "cube", soon: true },
        { label: "Prompt 管理", page: "prompts", href: "#", perm: "prompt:read", icon: "text", soon: true },
        { label: "知识库", page: "knowledge", href: "#", perm: "knowledge:read", icon: "database", soon: true },
        { label: "工具管理", page: "tools", href: "#", perm: "tool:read", icon: "wrench", soon: true },
        { label: "对话日志", page: "conversations", href: "#", perm: "conversation:read", icon: "message", soon: true },
        { label: "数据统计", page: "analytics", href: "#", perm: "analytics:read", icon: "chart", soon: true }
      ]
    },
    {
      group: "系统", sub: true, items: [
        { label: "用户管理", page: "users", href: "system-users.html", perm: "system.user:read", icon: "users" },
        { label: "角色管理", page: "roles", href: "system-roles.html", perm: "system.role:read", icon: "shield" },
        { label: "权限管理", page: "permissions", href: "system-permissions.html", perm: "system.permission:read", icon: "key" },
        { label: "API 密钥", page: "apikeys", href: "#", perm: "system.apikey:read", icon: "lock", soon: true },
        { label: "审计日志", page: "audit", href: "#", perm: "system.audit:read", icon: "list", soon: true },
        { label: "告警规则", page: "alerts", href: "#", perm: "system.alert:read", icon: "bell", soon: true },
        { label: "系统配置", page: "settings", href: "#", perm: "system.settings:read", icon: "gear", soon: true }
      ]
    }
  ];

  /* ---------- 基础工具 ---------- */
  function $(sel, root) { return (root || document).querySelector(sel); }
  function $$(sel, root) { return Array.prototype.slice.call((root || document).querySelectorAll(sel)); }
  function icon(name, cls) {
    return '<svg class="' + (cls || "nav-ico") + '" viewBox="0 0 24 24" aria-hidden="true">' + (ICONS[name] || "") + "</svg>";
  }

  function getRole() {
    const params = new URLSearchParams(window.location.search);
    let role = params.get("role");
    if (!IDENTITIES[role]) {
      try { role = window.localStorage.getItem("rbac-role"); } catch (e) { role = null; }
    }
    if (!IDENTITIES[role]) {
      role = document.body.dataset.defaultRole || "admin";
    }
    try { window.localStorage.setItem("rbac-role", role); } catch (e) { /* file:// 隐私模式 */ }
    return role;
  }

  function identity(role) { return IDENTITIES[role] || IDENTITIES.admin; }

  function hasPerm(role, code) {
    const id = identity(role);
    if (id.superuser) return true;
    return id.perms.indexOf(code) !== -1;
  }

  function hasPrefix(role, prefix) {
    const id = identity(role);
    if (id.superuser) return true;
    return id.perms.some(function (p) { return p.indexOf(prefix) === 0; });
  }

  let CURRENT_ROLE = "admin";

  /* ---------- 壳层渲染 ---------- */
  function renderShell() {
    const sidebar = $("#sidebar");
    const topbar = $("#topbar");
    if (!sidebar || !topbar) return;

    const page = document.body.dataset.page || "";
    const crumb = (document.body.dataset.crumb || "").split("/").map(function (s) { return s.trim(); }).filter(Boolean);

    let navHtml = "";
    NAV.forEach(function (group) {
      navHtml += '<div class="nav-group" data-nav-group>';
      navHtml += '<div class="nav-group-label">' + group.group + "</div>";
      if (group.sub) navHtml += '<div class="nav-sub">';
      group.items.forEach(function (item) {
        const active = item.page === page ? " active" : "";
        const href = item.soon ? "#" : item.href;
        const soonAttr = item.soon ? ' data-soon="' + item.label + '"' : "";
        const cls = group.sub ? "nav-subitem" : "nav-item";
        const count = item.count ? '<span class="nav-count">' + item.count + "</span>" : "";
        if (group.sub) {
          navHtml += '<a class="' + cls + active + '" href="' + href + '" data-perm="' + item.perm + '"' + soonAttr + ">";
          navHtml += '<span class="nav-dot"></span><span>' + item.label + "</span>" + count;
          navHtml += "</a>";
        } else {
          navHtml += '<a class="' + cls + active + '" href="' + href + '" data-perm="' + item.perm + '"' + soonAttr + ">";
          navHtml += icon(item.icon) + "<span>" + item.label + "</span>" + count;
          navHtml += "</a>";
        }
      });
      if (group.sub) navHtml += "</div>";
      navHtml += "</div>";
    });

    sidebar.innerHTML =
      '<div class="brand">' +
        '<div class="brand-mark" aria-hidden="true">辰</div>' +
        '<div class="brand-text">' +
          '<div class="brand-name">辰光 Agent</div>' +
          '<div class="brand-sub">授权中枢 · RBAC</div>' +
        "</div>" +
      "</div>" +
      '<nav class="sidebar-nav" aria-label="主导航">' + navHtml + "</nav>" +
      '<div class="sidebar-identity">' +
        '<div class="identity-row">' +
          '<div class="identity-avatar js-user-initial">陈</div>' +
          '<div><div class="identity-name js-user-name">陈晓</div>' +
          '<div class="identity-role js-role-label">超级管理员</div></div>' +
        "</div>" +
        '<div class="identity-meter">' +
          '<div class="meter-label"><span>我的有效权限</span><b class="js-perm-meter">63 / 63</b></div>' +
          '<div class="meter-track"><div class="meter-fill js-perm-fill" style="width:100%"></div></div>' +
        "</div>" +
      "</div>";

    const crumbHtml = crumb.length
      ? '<a href="dashboard.html">工作台</a><span class="sep">/</span>' +
        crumb.map(function (part, i) {
          return i === crumb.length - 1
            ? '<span class="current">' + part + "</span>"
            : '<a href="' + (part === "系统管理" ? "system-users.html" : "dashboard.html") + '">' + part + "</a><span class=\"sep\">/</span>";
        }).join("")
      : '<span class="current">工作台</span>';

    topbar.innerHTML =
      '<div class="crumb">' + crumbHtml + "</div>" +
      '<div class="topbar-right">' +
        '<label class="lens-toggle" title="显示当前身份看不到的操作">' +
          '<input type="checkbox" id="lens-toggle" hidden>' +
          '<span class="switch" aria-hidden="true"></span>' +
          "<span>权限透视</span>" +
        "</label>" +
        '<div class="demo-switch" title="原型演示：切换身份，观察菜单与按钮如何收敛">' +
          '<span class="demo-switch-label">演示身份</span>' +
          '<div class="role-seg" role="group" aria-label="切换演示身份">' +
            '<button type="button" data-role-btn="admin">管理员</button>' +
            '<button type="button" data-role-btn="operator">运营</button>' +
            '<button type="button" data-role-btn="viewer">只读</button>' +
          "</div>" +
        "</div>" +
        '<div class="user-chip">' +
          '<div class="avatar js-user-initial">陈</div>' +
          '<div><div class="name js-user-name">陈晓</div>' +
          '<div class="role js-role-label">超级管理员</div></div>' +
        "</div>" +
      "</div>";
  }

  /* ---------- 身份应用 ---------- */
  function applyRole(role) {
    CURRENT_ROLE = IDENTITIES[role] ? role : "admin";
    const id = identity(CURRENT_ROLE);
    document.body.dataset.role = CURRENT_ROLE;

    $$(".js-user-name").forEach(function (el) { el.textContent = id.name; });
    $$(".js-user-initial").forEach(function (el) { el.textContent = id.initial; });
    $$(".js-role-label").forEach(function (el) { el.textContent = id.roleLabel; });
    $$(".js-role-short").forEach(function (el) { el.textContent = id.short; });
    $$(".js-perm-count").forEach(function (el) { el.textContent = String(id.perms.length); });
    $$(".js-perm-meter").forEach(function (el) { el.textContent = id.perms.length + " / " + ALL_PERMS.length; });
    $$(".js-perm-fill").forEach(function (el) { el.style.width = (id.perms.length / ALL_PERMS.length * 100).toFixed(1) + "%"; });

    $$("[data-role-btn]").forEach(function (btn) {
      btn.classList.toggle("active", btn.dataset.roleBtn === CURRENT_ROLE);
      btn.setAttribute("aria-pressed", btn.dataset.roleBtn === CURRENT_ROLE ? "true" : "false");
    });

    applyVisibility();

    const main = $("main[data-required]");
    if (main) {
      const ok = hasPerm(CURRENT_ROLE, main.dataset.required) ||
        (main.dataset.requiredPrefix ? hasPrefix(CURRENT_ROLE, main.dataset.requiredPrefix) : false);
      document.body.classList.toggle("is-guarded", !ok);
    }
  }

  function applyVisibility() {
    const id = identity(CURRENT_ROLE);

    $$("[data-perm], [data-perm-any], [data-perm-prefix], [data-role-only], [data-role-not]").forEach(function (el) {
      let ok = true;
      const perm = el.dataset.perm;
      const any = el.dataset.permAny;
      const prefix = el.dataset.permPrefix;
      if (perm) ok = ok && hasPerm(CURRENT_ROLE, perm);
      if (any) ok = ok && any.split(",").some(function (p) { return hasPerm(CURRENT_ROLE, p.trim()); });
      if (prefix) ok = ok && hasPrefix(CURRENT_ROLE, prefix);
      if (el.dataset.roleOnly) ok = ok && el.dataset.roleOnly.split(",").indexOf(CURRENT_ROLE) !== -1;
      if (el.dataset.roleNot) ok = ok && el.dataset.roleNot.split(",").indexOf(CURRENT_ROLE) === -1;
      el.classList.toggle("perm-hidden", !ok);
    });

    $$("[data-nav-group]").forEach(function (group) {
      const visible = $$(".nav-item:not(.perm-hidden), .nav-subitem:not(.perm-hidden)", group).length;
      group.style.display = visible === 0 && !document.body.classList.contains("lens-on") ? "none" : "";
    });

    $$("[data-compare-role]").forEach(function (cell) {
      cell.classList.toggle("is-current", cell.dataset.compareRole === CURRENT_ROLE);
    });

    if (id.superuser) {
      $$(".lens-hint").forEach(function (el) { el.textContent = "超级管理员可以看到全部操作"; });
    }
  }

  function switchRole(role) {
    if (!IDENTITIES[role]) return;
    const url = new URL(window.location.href);
    url.searchParams.set("role", role);
    window.location.href = url.toString();
  }

  /* ---------- 提示条 ---------- */
  function toast(message, type) {
    let wrap = $(".toast-wrap");
    if (!wrap) {
      wrap = document.createElement("div");
      wrap.className = "toast-wrap";
      document.body.appendChild(wrap);
    }
    const el = document.createElement("div");
    el.className = "toast" + (type === "error" ? " is-error" : "");
    el.setAttribute("role", "status");
    el.textContent = message;
    wrap.appendChild(el);
    window.setTimeout(function () {
      el.style.opacity = "0";
      el.style.transition = "opacity 160ms ease";
      window.setTimeout(function () { el.remove(); }, 180);
    }, 3200);
  }

  /* ---------- 弹层 ---------- */
  function closeLayers() {
    $$(".drawer.open, .modal.open").forEach(function (el) { el.classList.remove("open"); });
    const overlay = $(".overlay");
    if (overlay) overlay.classList.remove("open");
  }

  function openLayer(id) {
    const layer = document.getElementById(id);
    if (!layer) return;
    closeLayers();
    const overlay = $(".overlay");
    if (overlay) overlay.classList.add("open");
    layer.classList.add("open");
    const focusable = layer.querySelector("input, select, textarea, button");
    if (focusable) window.setTimeout(function () { focusable.focus(); }, 60);
  }

  function bindLayers() {
    $$("[data-open]").forEach(function (btn) {
      btn.addEventListener("click", function (e) {
        e.preventDefault();
        openLayer(btn.dataset.open);
      });
    });
    $$("[data-close]").forEach(function (btn) {
      btn.addEventListener("click", function (e) {
        e.preventDefault();
        closeLayers();
      });
    });
    const overlay = $(".overlay");
    if (overlay) overlay.addEventListener("click", closeLayers);
    document.addEventListener("keydown", function (e) {
      if (e.key === "Escape") closeLayers();
    });
  }

  /* ---------- 工作台 ---------- */
  function initDashboard() {
    const id = identity(CURRENT_ROLE);
    const greeting = $("#dash-greeting");
    if (greeting) {
      greeting.textContent = "欢迎回来，" + id.name + "。你当前的身份是" + id.roleLabel + "。";
    }

    const note = $("#dash-role-note");
    if (note) {
      const notes = {
        admin: "你可以配置角色与权限、管理全部业务模块。删除类操作仅对超级管理员开放。",
        operator: "你可以创建、编辑和发布业务内容。删除与系统管理不在你的授权范围内。",
        viewer: "你处于只读模式：可以查看业务数据，但所有写入、发布与删除入口都不会出现。"
      };
      note.textContent = notes[CURRENT_ROLE];
    }

    const moduleLedger = $("#module-ledger");
    if (moduleLedger) {
      const rows = MODULES.filter(function (m) { return m.key.indexOf("system.") !== 0; }).map(function (m) {
        return { name: m.name, code: m.key, total: m.actions.length, granted: m.actions.filter(function (a) { return hasPerm(CURRENT_ROLE, m.key + ":" + a); }).length };
      });
      const systemModules = MODULES.filter(function (m) { return m.key.indexOf("system.") === 0; });
      const sysTotal = systemModules.reduce(function (n, m) { return n + m.actions.length; }, 0);
      const sysGranted = systemModules.reduce(function (n, m) {
        return n + m.actions.filter(function (a) { return hasPerm(CURRENT_ROLE, m.key + ":" + a); }).length;
      }, 0);
      rows.push({ name: "系统管理", code: "system.*", total: sysTotal, granted: sysGranted });

      moduleLedger.innerHTML = rows.map(function (row) {
        const pct = row.total ? Math.round(row.granted / row.total * 100) : 0;
        return '<div class="module-row">' +
          '<div class="module-name">' + row.name + '<span class="module-code">' + row.code + "</span></div>" +
          '<div class="module-bar"><span style="width:' + pct + '%"></span></div>' +
          '<div class="module-count">' + row.granted + " / " + row.total + "</div>" +
        "</div>";
      }).join("");
    }

    const visibleModules = MODULES.filter(function (m) {
      return m.actions.some(function (a) { return hasPerm(CURRENT_ROLE, m.key + ":" + a); });
    }).length;

    setText("#stat-perms", id.perms.length);
    setText("#stat-modules", visibleModules);
    setText("#stat-restricted", ALL_PERMS.length - id.perms.length);
    setText("#stat-users", "24");

    const restricted = ALL_PERMS.filter(function (p) { return !hasPerm(CURRENT_ROLE, p); }).slice(0, 6);
    const list = $("#restricted-list");
    if (list) {
      if (restricted.length === 0) {
        list.innerHTML = '<li><span>当前身份没有被限制的操作。</span><span class="badge badge-granted">全部授予</span></li>';
      } else {
        list.innerHTML = restricted.map(function (p) {
          const parts = p.split(":");
          return '<li><span>' + (ACTION_LABELS[parts[1]] || parts[1]) + " " + parts[0] +
            '<span class="code">' + p + "</span></span>" +
            '<span class="badge badge-restricted">未授予</span></li>';
        }).join("");
      }
    }
  }

  function setText(sel, value) {
    const el = $(sel);
    if (el) el.textContent = String(value);
  }

  /* ---------- Agent 列表 ---------- */
  function initAgents() {
    const note = $("#agent-role-note");
    if (note) {
      const notes = {
        admin: "你拥有 Agent 的全部操作权限，包括删除与版本回滚。",
        operator: "你可以创建、编辑、发布和测试 Agent；删除由管理员执行。",
        viewer: "当前为只读身份。表格右侧的写操作入口已隐藏，接口层也会返回 403。"
      };
      note.textContent = notes[CURRENT_ROLE];
      const notice = note.closest(".notice");
      if (notice) notice.className = "notice" + (CURRENT_ROLE === "viewer" ? " notice-gold" : "");
    }

    $$("[data-agent-action]").forEach(function (btn) {
      btn.addEventListener("click", function () {
        toast("已触发「" + btn.dataset.agentAction + "」（原型演示）");
      });
    });
    const create = $("#create-agent");
    if (create) create.addEventListener("click", function () { toast("已打开新建 Agent 面板（原型演示）"); });
  }

  /* ---------- 用户管理 ---------- */
  function initUsers() {
    $$("[data-assign-user]").forEach(function (btn) {
      btn.addEventListener("click", function () {
        const row = btn.closest("tr");
        const name = row ? row.dataset.name : "";
        setText("#assign-user-name", name);
        const roles = (btn.dataset.roles || "").split(",").filter(Boolean);
        $$("#assign-drawer input[type=checkbox]").forEach(function (cb) {
          cb.checked = roles.indexOf(cb.value) !== -1;
        });
        openLayer("assign-drawer");
      });
    });

    const saveAssign = $("#save-assign");
    if (saveAssign) {
      saveAssign.addEventListener("click", function () {
        const checked = $$("#assign-drawer input[type=checkbox]:checked").map(function (cb) {
          return cb.dataset.label;
        });
        toast("已保存角色：" + (checked.length ? checked.join("、") : "无") + "。权限变更最迟 10 分钟生效。");
        closeLayers();
      });
    }

    const addUserForm = $("#add-user-form");
    if (addUserForm) {
      addUserForm.addEventListener("submit", function (e) {
        e.preventDefault();
        toast("用户已创建（原型演示）。初始密码需在首次登录后修改。");
        closeLayers();
        addUserForm.reset();
      });
    }

    $$("[data-user-action]").forEach(function (btn) {
      btn.addEventListener("click", function () {
        toast("已触发「" + btn.dataset.userAction + "」（原型演示）");
      });
    });
  }

  /* ---------- 角色管理 ---------- */
  function initRoles() {
    renderRoleList();
    renderMatrix();

    const save = $("#save-matrix");
    if (save) {
      save.addEventListener("click", function () {
        matrixDirty[matrixRole] = false;
        updateMatrixProgress();
        toast("权限已保存。受影响用户最迟 10 分钟内生效。");
      });
    }

    const createForm = $("#create-role-form");
    if (createForm) {
      createForm.addEventListener("submit", function (e) {
        e.preventDefault();
        const code = ($("#role-code") || {}).value || "";
        const name = ($("#role-name") || {}).value || "";
        if (!code || !name) return;
        if (MATRIX_ROLES.some(function (r) { return r.code === code; })) {
          toast("角色编码已存在", "error");
          return;
        }
        MATRIX_ROLES.push({ code: code, name: name, system: false, users: 0, readonly: false });
        matrixState[code] = new Set();
        matrixDirty[code] = false;
        matrixRole = code;
        renderRoleList();
        renderMatrix();
        closeLayers();
        toast("角色「" + name + "」已创建。现在可以为它勾选权限。");
        createForm.reset();
      });
    }
  }

  function renderRoleList() {
    const list = $("#role-list");
    if (!list) return;
    list.innerHTML = MATRIX_ROLES.map(function (r) {
      const count = matrixState[r.code] ? matrixState[r.code].size : 0;
      const active = r.code === matrixRole ? " active" : "";
      return '<button type="button" class="role-list-item' + active + '" data-matrix-role="' + r.code + '">' +
        '<div class="r-name">' + r.name +
          (r.system ? ' <span class="badge badge-system">内置</span>' : "") +
        "</div>" +
        '<div class="r-meta"><span class="r-code">' + r.code + "</span>" +
          "<span>" + count + " 项权限</span><span>" + r.users + " 位用户</span></div>" +
      "</button>";
    }).join("");

    $$("[data-matrix-role]", list).forEach(function (btn) {
      btn.addEventListener("click", function () {
        matrixRole = btn.dataset.matrixRole;
        renderRoleList();
        renderMatrix();
      });
    });
  }

  function moduleGrantState(code) {
    const module = MODULES.find(function (m) { return m.key === code; });
    const set = matrixState[matrixRole];
    if (!module || !set) return "none";
    const granted = module.actions.filter(function (a) { return set.has(code + ":" + a); }).length;
    if (granted === 0) return "none";
    if (granted === module.actions.length) return "all";
    return "some";
  }

  function renderMatrix() {
    const table = $("#matrix");
    if (!table) return;
    const role = MATRIX_ROLES.find(function (r) { return r.code === matrixRole; }) || MATRIX_ROLES[0];
    const readonly = !!role.readonly;
    const set = matrixState[matrixRole] || new Set();

    setText("#matrix-title", role.name);
    setText("#matrix-sub", role.code + " · " + (role.system ? "内置角色" : "自定义角色") + " · " + role.users + " 位用户");
    const stateBadge = $("#matrix-system-badge");
    if (stateBadge) {
      stateBadge.textContent = role.system ? "内置" : "自定义";
      stateBadge.className = "badge " + (role.system ? "badge-system" : "badge-neutral");
    }

    let html = '<table class="matrix" id="matrix-table" data-readonly="' + (readonly ? "1" : "0") + '">';
    html += "<thead><tr><th class=\"module-col\">模块</th>";
    ACTION_ORDER.forEach(function (a) {
      html += "<th>" + ACTION_LABELS[a] + "</th>";
    });
    html += "</tr></thead><tbody>";

    MODULES.forEach(function (m) {
      const state = moduleGrantState(m.key);
      html += "<tr>";
      html += '<th><div class="m-name"><span class="check module-check" data-module-check="' + m.key + '" data-state="' + state +
        '" data-readonly="' + (readonly ? "1" : "0") + '" role="checkbox" aria-checked="' +
        (state === "all" ? "true" : state === "some" ? "mixed" : "false") + '" tabindex="0"></span>' + m.name + "</div>";
      html += '<span class="m-code">' + m.key + "</span></th>";
      ACTION_ORDER.forEach(function (a) {
        if (m.actions.indexOf(a) === -1) {
          html += '<td><button type="button" class="cell-btn" data-na="1" disabled><span class="cell-mark"></span></button></td>';
        } else {
          const granted = set.has(m.key + ":" + a);
          html += '<td><button type="button" class="cell-btn" data-cell="' + m.key + ":" + a + '" data-granted="' +
            (granted ? "1" : "0") + '" aria-pressed="' + (granted ? "true" : "false") +
            '" aria-label="' + m.name + " " + ACTION_LABELS[a] + '"><span class="cell-mark"></span></button></td>';
        }
      });
      html += "</tr>";
    });
    html += "</tbody></table>";
    table.innerHTML = html;

    const matrixTable = $("#matrix-table");
    if (matrixTable && !readonly) {
      matrixTable.addEventListener("click", function (e) {
        const cell = e.target.closest(".cell-btn");
        if (cell && !cell.dataset.na) {
          const code = cell.dataset.cell;
          if (set.has(code)) set.delete(code); else set.add(code);
          matrixDirty[matrixRole] = true;
          renderRoleList();
          renderMatrix();
          return;
        }
        const chk = e.target.closest(".module-check");
        if (chk) {
          const module = MODULES.find(function (m) { return m.key === chk.dataset.moduleCheck; });
          if (!module) return;
          const state = moduleGrantState(module.key);
          module.actions.forEach(function (a) {
            const code = module.key + ":" + a;
            if (state === "all") set.delete(code); else set.add(code);
          });
          matrixDirty[matrixRole] = true;
          renderRoleList();
          renderMatrix();
        }
      });
      matrixTable.addEventListener("keydown", function (e) {
        const chk = e.target.closest(".module-check");
        if (chk && (e.key === " " || e.key === "Enter")) {
          e.preventDefault();
          chk.click();
        }
      });
    }

    updateMatrixProgress();
  }

  function updateMatrixProgress() {
    const set = matrixState[matrixRole] || new Set();
    const total = ALL_PERMS.length;
    const granted = set.size;
    const fill = $("#mp-fill");
    if (fill) fill.style.width = (granted / total * 100).toFixed(1) + "%";
    const text = $("#mp-text");
    if (text) text.innerHTML = "已选 <b>" + granted + "</b> / " + total + " 项";
    const unsaved = $("#matrix-unsaved");
    if (unsaved) unsaved.classList.toggle("show", !!matrixDirty[matrixRole]);
    const role = MATRIX_ROLES.find(function (r) { return r.code === matrixRole; });
    const save = $("#save-matrix");
    if (save) {
      save.disabled = !!(role && role.readonly);
    }
    const del = $("#delete-role-btn");
    if (del) {
      del.disabled = !!(role && role.system);
      del.title = role && role.system ? "内置角色不可删除" : "";
    }
  }

  /* ---------- 权限管理 ---------- */
  function initPermissions() {
    const search = $("#perm-search");
    const chips = $$("[data-perm-filter]");
    let activeModule = "all";

    function filter() {
      const q = (search ? search.value : "").trim().toLowerCase();
      $$("#perm-rows tr").forEach(function (row) {
        const text = row.dataset.search || "";
        const module = row.dataset.module || "";
        const matchQ = !q || text.indexOf(q) !== -1;
        const matchM = activeModule === "all" || module === activeModule ||
          (activeModule.slice(-1) === "." && module.indexOf(activeModule) === 0);
        row.style.display = matchQ && matchM ? "" : "none";
      });
    }

    if (search) search.addEventListener("input", filter);
    chips.forEach(function (chip) {
      chip.addEventListener("click", function () {
        chips.forEach(function (c) { c.classList.remove("active"); });
        chip.classList.add("active");
        activeModule = chip.dataset.permFilter;
        filter();
      });
    });

    const form = $("#create-perm-form");
    const codeInput = $("#perm-code");
    const codeError = $("#perm-code-error");
    const preview = $("#perm-preview");
    const saveBtn = $("#save-perm");

    function validate() {
      const value = (codeInput ? codeInput.value : "").trim();
      const re = /^[a-z][a-z0-9_]*(?:\.[a-z][a-z0-9_]*)*:[a-z][a-z0-9_]*$/;
      const ok = re.test(value);
      if (codeInput) codeInput.classList.toggle("is-invalid", value.length > 0 && !ok);
      if (codeError) codeError.style.display = value.length > 0 && !ok ? "" : "none";
      if (saveBtn) saveBtn.disabled = !ok;
      if (preview) {
        if (!value) {
          preview.textContent = "输入后自动拆分为模块与操作。";
        } else if (!ok) {
          preview.textContent = "格式应为 模块:操作，例如 custom:read。";
        } else {
          const parts = value.split(":");
          preview.innerHTML = "模块 <b>" + parts[0] + "</b> · 操作 <b>" + parts[1] + "</b>";
        }
      }
      return ok;
    }

    if (codeInput) {
      codeInput.addEventListener("input", validate);
      validate();
    }

    if (form) {
      form.addEventListener("submit", function (e) {
        e.preventDefault();
        if (!validate()) return;
        const code = codeInput.value.trim();
        const name = ($("#perm-name") || {}).value || code;
        const moduleKey = code.split(":")[0];
        const action = code.split(":")[1];
        const tbody = $("#perm-rows");
        if (tbody) {
          const tr = document.createElement("tr");
          tr.dataset.module = moduleKey;
          tr.dataset.search = (code + " " + name + " " + moduleKey).toLowerCase();
          tr.innerHTML =
            '<td><span class="mono">' + code + "</span></td>" +
            "<td>" + name + "</td>" +
            "<td>" + moduleKey + "</td>" +
            "<td>" + (ACTION_LABELS[action] || action) + "</td>" +
            '<td><span class="badge badge-neutral">自定义</span></td>' +
            '<td><div class="row-actions"><button class="btn btn-sm btn-ghost" data-perm-edit>编辑</button>' +
            '<button class="btn btn-sm btn-danger" data-perm-delete>删除</button></div></td>';
          tbody.prepend(tr);
        }
        closeLayers();
        form.reset();
        validate();
        filter();
        toast("权限「" + code + "」已创建。现在可以把它分配给角色。");
      });
    }

    const rows = $("#perm-rows");
    if (rows) {
      rows.addEventListener("click", function (e) {
        const del = e.target.closest("[data-perm-delete]");
        if (del) {
          const row = del.closest("tr");
          if (row && row.dataset.system === "1") {
            toast("内置权限不可删除", "error");
            return;
          }
          if (row) row.remove();
          toast("自定义权限已删除，并已从所有角色中移除。");
          return;
        }
        const edit = e.target.closest("[data-perm-edit]");
        if (edit) {
          const row = edit.closest("tr");
          const code = row && row.querySelector(".mono") ? row.querySelector(".mono").textContent : "";
          if (row && row.dataset.system === "1") {
            toast("内置权限「" + code + "」只能修改名称与描述。");
          } else {
            toast("已打开权限「" + code + "」的编辑面板（原型演示）。");
          }
        }
      });
    }
  }

  /* ---------- 403 页面 ---------- */
  function initForbidden() {
    const id = identity(CURRENT_ROLE);
    setText("#forbidden-role", id.roleLabel);
    const note = $("#forbidden-note");
    if (note) {
      note.textContent = id.superuser
        ? "这是 403 页面的独立演示。超级管理员不会在真实环境中进入这里。"
        : "你当前的身份是" + id.roleLabel + "。系统管理需要额外的授权，请联系管理员。";
    }
    const ledger = $("#forbidden-ledger");
    if (ledger) {
      const rows = [
        { name: "工作台", perm: "dashboard:read" },
        { name: "Agent 管理", perm: "agent:read" },
        { name: "用户管理", perm: "system.user:read" },
        { name: "角色管理", perm: "system.role:read" },
        { name: "权限管理", perm: "system.permission:read" }
      ];
      ledger.innerHTML = rows.map(function (r) {
        const ok = hasPerm(CURRENT_ROLE, r.perm);
        return '<div class="strike-row"><span>' + r.name + '<span class="code">' + r.perm + "</span></span>" +
          (ok ? '<span class="badge badge-granted">已授予</span>' : '<span class="denied">未授予</span>') +
        "</div>";
      }).join("");
    }
    const back = $("#back-dashboard");
    if (back) {
      back.addEventListener("click", function () {
        window.location.href = "dashboard.html?role=" + CURRENT_ROLE;
      });
    }
  }

  /* ---------- 权限加载失败 ---------- */
  function initPermissionError() {
    const retry = $("#retry-perms");
    if (retry) {
      retry.addEventListener("click", function () {
        retry.disabled = true;
        retry.textContent = "正在重试…";
        window.setTimeout(function () {
          window.location.href = "dashboard.html?role=" + CURRENT_ROLE;
        }, 900);
      });
    }
    const login = $("#back-login");
    if (login) login.addEventListener("click", function () { window.location.href = "login.html"; });
  }

  /* ---------- 登录 ---------- */
  function initLogin() {
    const params = new URLSearchParams(window.location.search);
    let chosen = params.get("role");
    if (!IDENTITIES[chosen]) chosen = "admin";

    $$("[data-login-role]").forEach(function (btn) {
      btn.classList.toggle("active", btn.dataset.loginRole === chosen);
      btn.addEventListener("click", function () {
        chosen = btn.dataset.loginRole;
        $$("[data-login-role]").forEach(function (b) { b.classList.remove("active"); });
        btn.classList.add("active");
        const user = $("#login-username");
        if (user) user.value = chosen === "admin" ? "admin" : chosen === "operator" ? "li.ming" : "wang.fang";
      });
    });

    const form = $("#login-form");
    if (form) {
      form.addEventListener("submit", function (e) {
        e.preventDefault();
        const btn = form.querySelector("button[type=submit]");
        if (btn) {
          btn.disabled = true;
          btn.textContent = "正在进入…";
        }
        window.setTimeout(function () {
          window.location.href = "dashboard.html?role=" + chosen;
        }, 450);
      });
    }
    const refresh = $("#refresh-captcha");
    if (refresh) {
      refresh.addEventListener("click", function () {
        const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
        let s = "";
        for (let i = 0; i < 4; i++) s += chars[Math.floor(Math.random() * chars.length)];
        const img = $("#captcha-code");
        if (img) img.textContent = s;
      });
    }
  }

  /* ---------- 封面 ---------- */
  function initIndex() {
    const tbody = $("#compare-rows");
    if (tbody) {
      tbody.innerHTML = MODULES.map(function (m) {
        return "<tr>" +
          '<td><span class="mod">' + m.name + '</span><span class="mod-code">' + m.key + "</span></td>" +
          ["admin", "operator", "viewer"].map(function (r) {
            const set = matrixState[r];
            const granted = m.actions.filter(function (a) { return set.has(m.key + ":" + a); }).length;
            const total = m.actions.length;
            let marks = "";
            for (let i = 0; i < total; i++) marks += '<i class="' + (i < granted ? "on" : "off") + '"></i>';
            return '<td data-compare-role="' + r + '"><span class="marks">' + marks + "</span>" +
              '<span style="margin-left:6px;font-family:var(--mono);font-size:10px;color:var(--faint)">' +
              granted + "/" + total + "</span></td>";
          }).join("") +
        "</tr>";
      }).join("");
    }
    applyVisibility();
  }

  /* ---------- 启动 ---------- */
  function boot() {
    CURRENT_ROLE = getRole();
    renderShell();
    applyRole(CURRENT_ROLE);

    const lens = $("#lens-toggle");
    if (lens) {
      if (new URLSearchParams(window.location.search).get("lens") === "1") {
        lens.checked = true;
        document.body.classList.add("lens-on");
        applyVisibility();
      }
      lens.addEventListener("change", function () {
        document.body.classList.toggle("lens-on", lens.checked);
        applyVisibility();
      });
    }

    $$("[data-role-btn]").forEach(function (btn) {
      btn.addEventListener("click", function (e) {
        e.preventDefault();
        switchRole(btn.dataset.roleBtn);
      });
    });

    $$("[data-soon]").forEach(function (link) {
      link.addEventListener("click", function (e) {
        e.preventDefault();
        toast("「" + link.dataset.soon + "」不在本期 RBAC 原型的页面范围内。");
      });
    });

    $$("[data-demo-action]").forEach(function (btn) {
      btn.addEventListener("click", function () {
        toast(btn.dataset.demoAction + "（原型演示）");
      });
    });

    bindLayers();

    const page = document.body.dataset.page || "";
    if (page === "dashboard") initDashboard();
    if (page === "agents") initAgents();
    if (page === "users") initUsers();
    if (page === "roles") initRoles();
    if (page === "permissions") initPermissions();
    if (page === "forbidden") initForbidden();
    if (page === "permission-error") initPermissionError();
    if (page === "login") initLogin();
    if (page === "index") initIndex();
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", boot);
  } else {
    boot();
  }
})();
