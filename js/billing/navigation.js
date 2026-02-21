(function () {
  "use strict";
  window.App = window.App || {};

  // Group display order, display names, and subgroup configuration
  // Keys are the data-level group names (from billing_codes.json).
  // displayName: what users see in the UI.
  // subgroupOrder: explicit ordering of subgroups within the group.
  // subgroupDisplayNames: maps data-level subgroup names to UI display names.
  var GROUP_META = {
    Assessments: {
      order: 0,
      displayName: "Assessments",
      subgroupOrder: [
        "General Assessment",
        "Critical Care",
        "Counselling",
        "Forms",
        "Consult & Admission",
        "Ambulance Transfer",
      ],
      subgroupDisplayNames: {},
      subgroupSections: {
        "General Assessment": [
          { header: "Weekday Day (08-17h)", codes: ["H101", "H102", "H103", "H104"] },
          { header: "Weekday Evening (17-24h)", codes: ["H131", "H132", "H133", "H134"] },
          { header: "Weekend/Holiday (08-24h)", codes: ["H151", "H152", "H153", "H154"] },
          { header: "Night (00-08h)", codes: ["H121", "H122", "H123", "H124"] },
        ],
        "Critical Care": [
          { header: "Life Threatening", codes: ["G521", "G523", "G522"] },
          { header: "Other Resuscitation", codes: ["G395", "G391"] },
        ],
        "Consult & Admission": [
          { header: "Consult to ED", codes: ["H055", "H065", "A813"] },
          { header: "Phone Consults", codes: ["K734", "K735"] },
          { header: "CritiCall", codes: ["K736", "K737"] },
          { header: "Admission Codes", codes: ["C933", "C004", "H105"] },
        ],
        "Ambulance Transfer": [
          { header: "", codes: ["K101", "K111", "K112"] },
        ],
      },
    },
    Procedures: {
      order: 1,
      displayName: "Procedures",
      subgroupOrder: [
        "Airway",
        "Cardiovascular",
        "Chest",
        "ENT",
        "Foreign Body",
        "GI",
        "I&D",
        "Immunization",
        "Laceration",
        "Lines",
        "Neurology",
        "OBGYN",
        "Ophthalmology",
        "Plastic Surgery",
        "Ultrasound",
        "Urology",
      ],
      subgroupDisplayNames: {},
    },
    "Ortho & MSK": {
      order: 2,
      displayName: "Ortho & MSK",
      subgroupOrder: [
        "Thorax, Shoulder, Arm",
        "Elbow, Forearm",
        "Wrist, Hand",
        "Pelvis, Hip, Femur",
        "Knee, Tib, Fib",
        "Ankle, Foot",
        "Casts",
        "Other MSK",
      ],
      subgroupDisplayNames: {},
    },
    Premiums: {
      order: 3,
      displayName: "Premiums",
      subgroupOrder: [],
      subgroupDisplayNames: {},
      flatCodeSections: [
        { header: "For G and K Codes (not H)", codes: ["H112", "H113", "E415A"] },
        { header: "For Procedures", codes: ["E413", "E412"] },
        { header: "Trauma", codes: ["E420"] },
      ],
    },
    "On-Call Assessments": {
      order: 4,
      displayName: "On-Call Assessments",
      subgroupOrder: [],
      subgroupDisplayNames: {},
      // Virtual group: codes come from Assessments > On-Call Assessments subgroup
      virtualSource: { group: "Assessments", subgroup: "On-Call Assessments" },
    },
  };

  var ORDERED_GROUPS = Object.keys(GROUP_META).sort(function (a, b) {
    return GROUP_META[a].order - GROUP_META[b].order;
  });

  /** Get display name for a group (data key → UI label) */
  function groupDisplayName(dataKey) {
    var meta = GROUP_META[dataKey];
    return meta && meta.displayName ? meta.displayName : dataKey;
  }

  /** Get display name for a subgroup within a group */
  function subgroupDisplayName(groupKey, subKey) {
    var meta = GROUP_META[groupKey];
    if (meta && meta.subgroupDisplayNames && meta.subgroupDisplayNames[subKey]) {
      return meta.subgroupDisplayNames[subKey];
    }
    return subKey;
  }

  /** Get data-level group key from a display name */
  function groupDataKey(displayName) {
    for (var key in GROUP_META) {
      if (GROUP_META[key].displayName === displayName) return key;
    }
    return displayName;
  }

  /** Get data-level subgroup key from a display name within a group */
  function subgroupDataKey(groupKey, displayName) {
    var meta = GROUP_META[groupKey];
    if (meta && meta.subgroupDisplayNames) {
      for (var key in meta.subgroupDisplayNames) {
        if (meta.subgroupDisplayNames[key] === displayName) return key;
      }
    }
    return displayName;
  }

  /**
   * Build folder tree from billing codes.
   * tree[group] = { meta, subgroups: { subName: [codes], _flat: [codes] } }
   */
  App.buildFolderTree = function () {
    var tree = {};

    // Initialize groups
    ORDERED_GROUPS.forEach(function (g) {
      tree[g] = { meta: GROUP_META[g], subgroups: {} };
    });

    App.data.billingCodes.forEach(function (code) {
      var primaryGroup = code.group;
      var primaryInTree = !!tree[primaryGroup];

      // No subgroups — place in _flat only for groups that list codes directly (e.g. Premiums).
      // Codes in other groups with no subgroup are excluded from folder navigation.
      if (!code.subgroups || code.subgroups.length === 0) {
        if (primaryInTree && primaryGroup === "Premiums") {
          if (!tree[primaryGroup].subgroups._flat) {
            tree[primaryGroup].subgroups._flat = [];
          }
          tree[primaryGroup].subgroups._flat.push(code);
        }
        return;
      }

      code.subgroups.forEach(function (sg) {
        if (sg.indexOf(" > ") !== -1) {
          // Cross-group: "Procedures > Ob/Gyne"
          var parts = sg.split(" > ");
          var targetGroup = parts[0].trim();
          var targetSub = parts[1].trim();
          if (tree[targetGroup]) {
            if (!tree[targetGroup].subgroups[targetSub]) {
              tree[targetGroup].subgroups[targetSub] = [];
            }
            tree[targetGroup].subgroups[targetSub].push(code);
          }
        } else if (primaryInTree) {
          // Same-group
          if (!tree[primaryGroup].subgroups[sg]) {
            tree[primaryGroup].subgroups[sg] = [];
          }
          tree[primaryGroup].subgroups[sg].push(code);
        }
      });
    });

    // Move codes for virtual groups (e.g. On-Call Assessments) from source subgroup to _flat
    ORDERED_GROUPS.forEach(function (g) {
      var meta = GROUP_META[g];
      if (meta && meta.virtualSource) {
        var src = meta.virtualSource;
        var srcGroup = tree[src.group];
        if (srcGroup && srcGroup.subgroups[src.subgroup]) {
          tree[g].subgroups._flat = srcGroup.subgroups[src.subgroup];
          delete srcGroup.subgroups[src.subgroup];
        }
      }
    });

    // Sort codes within each subgroup alphabetically by name (short description)
    Object.keys(tree).forEach(function (group) {
      Object.keys(tree[group].subgroups).forEach(function (sub) {
        tree[group].subgroups[sub].sort(function (a, b) {
          return a.name.localeCompare(b.name);
        });
      });
    });

    App.data.folderTree = tree;
  };

  /** Count all codes in a group (across all subgroups, deduplicated) */
  function countGroupCodes(group) {
    var seen = {};
    var subgroups = App.data.folderTree[group].subgroups;
    Object.keys(subgroups).forEach(function (sub) {
      subgroups[sub].forEach(function (c) {
        seen[c.code] = true;
      });
    });
    return Object.keys(seen).length;
  }

  /** Animated folder navigation transition (Column 2 + Column 3 in parallel) */
  App.animateBrowse = function (direction, onComplete) {
    var container = document.getElementById("billing-list");

    // Skip animation if empty, loading, already animating, or reduced motion
    if (
      !container.children.length ||
      container.querySelector(".loading") ||
      container.classList.contains("is-animating") ||
      window.matchMedia("(prefers-reduced-motion: reduce)").matches
    ) {
      App.renderBrowse();
      if (onComplete) onComplete();
      return;
    }

    // Animate Column 3 only on desktop (matches updatePreviewForBrowse guard)
    var animateContext = window.innerWidth >= 1024;
    var ctxContainer, ctxOldPanel;

    // ── Capture old Column 3 content before renderBrowse() changes it ──
    if (animateContext) {
      ctxContainer = document.getElementById("context-panel");
      ctxOldPanel = document.createElement("div");
      ctxOldPanel.className = "slide-panel";
      ctxOldPanel.style.top = -ctxContainer.scrollTop + "px";
      while (ctxContainer.firstChild) {
        ctxOldPanel.appendChild(ctxContainer.firstChild);
      }
    }

    // ── Capture old Column 2 content ──
    var scrollTop = container.scrollTop;
    var oldPanel = document.createElement("div");
    oldPanel.className = "slide-panel";
    oldPanel.style.top = -scrollTop + "px";
    while (container.firstChild) {
      oldPanel.appendChild(container.firstChild);
    }

    // Render new content (writes into Column 2 AND updates Column 3)
    App.renderBrowse();

    // ── Wrap new Column 2 content ──
    var newPanel = document.createElement("div");
    newPanel.className = "slide-panel";
    while (container.firstChild) {
      newPanel.appendChild(container.firstChild);
    }

    // ── Wrap new Column 3 content ──
    var ctxNewPanel;
    if (animateContext) {
      ctxNewPanel = document.createElement("div");
      ctxNewPanel.className = "slide-panel";
      while (ctxContainer.firstChild) {
        ctxNewPanel.appendChild(ctxContainer.firstChild);
      }
    }

    // ── Lock Column 2 during animation ──
    container.classList.add("is-animating");
    container.scrollTop = 0;
    container.appendChild(oldPanel);
    container.appendChild(newPanel);

    // ── Lock Column 3 during animation ──
    if (animateContext) {
      ctxContainer.classList.add("is-animating");
      ctxContainer.scrollTop = 0;
      ctxContainer.appendChild(ctxOldPanel);
      ctxContainer.appendChild(ctxNewPanel);
    }

    // ── Apply animation classes to Column 2 ──
    if (direction === "forward") {
      oldPanel.classList.add("slide-panel--exit-left");
      newPanel.classList.add("slide-panel--enter-right");
    } else {
      oldPanel.classList.add("slide-panel--exit-right");
      newPanel.classList.add("slide-panel--enter-left");
    }

    // ── Apply animation classes to Column 3 ──
    if (animateContext) {
      if (direction === "forward") {
        ctxOldPanel.classList.add("slide-panel--exit-left");
        ctxNewPanel.classList.add("slide-panel--enter-right");
      } else {
        ctxOldPanel.classList.add("slide-panel--exit-right");
        ctxNewPanel.classList.add("slide-panel--enter-left");
      }
    }

    // ── Cleanup Column 2 after animation ──
    newPanel.addEventListener(
      "animationend",
      function () {
        container.classList.remove("is-animating");
        if (oldPanel.parentNode) oldPanel.remove();
        while (newPanel.firstChild) {
          container.appendChild(newPanel.firstChild);
        }
        newPanel.remove();
        if (onComplete) onComplete();
      },
      { once: true }
    );

    // ── Cleanup Column 3 after animation ──
    if (animateContext) {
      ctxNewPanel.addEventListener(
        "animationend",
        function () {
          ctxContainer.classList.remove("is-animating");
          if (ctxOldPanel.parentNode) ctxOldPanel.remove();
          while (ctxNewPanel.firstChild) {
            ctxContainer.appendChild(ctxNewPanel.firstChild);
          }
          ctxNewPanel.remove();
        },
        { once: true }
      );
    }
  };

  /** Render the browse view based on current navPath */
  App.renderBrowse = function () {
    var container = document.getElementById("billing-list");
    var navPath = App.state.navPath;
    container.innerHTML = "";
    App.state.browseHighlightIndex = -1;

    // Update column header with breadcrumb path
    renderBillingHeader(navPath);

    if (navPath.length === 0) {
      // Top-level groups — show display names
      ORDERED_GROUPS.forEach(function (groupName) {
        var item = App.utils.el("div", "folder-item folder-item--group");
        item.dataset.group = groupName;

        var name = App.utils.el("span", "folder-item__name", groupDisplayName(groupName));
        var count = App.utils.el("span", "folder-item__count", String(countGroupCodes(groupName)));
        var arrow = App.utils.el("span", "folder-item__arrow", "\u203A");

        item.appendChild(name);
        item.appendChild(count);
        item.appendChild(arrow);
        container.appendChild(item);
      });
    } else if (navPath.length === 1) {
      // Subgroups within a group
      var group = navPath[0];
      var tree = App.data.folderTree[group];
      if (!tree) return;

      var meta = GROUP_META[group];

      // flatSections: merge subgroups into one view with section headers
      if (meta && meta.flatSections && meta.flatSections.length > 0) {
        meta.flatSections.forEach(function (subName) {
          var codes = tree.subgroups[subName];
          if (!codes || codes.length === 0) return;

          var sectionHeader = App.utils.el("div", "section-header", subgroupDisplayName(group, subName));
          container.appendChild(sectionHeader);

          codes.forEach(function (code) {
            container.appendChild(buildCodeItem(code));
          });
        });
      } else {
        var subNames = Object.keys(tree.subgroups).filter(function (s) {
          return s !== "_flat";
        });

        // Use custom subgroup order if defined, otherwise alphabetical
        if (meta && meta.subgroupOrder && meta.subgroupOrder.length > 0) {
          var orderMap = {};
          meta.subgroupOrder.forEach(function (s, i) { orderMap[s] = i; });
          subNames.sort(function (a, b) {
            var oa = orderMap[a] != null ? orderMap[a] : 999;
            var ob = orderMap[b] != null ? orderMap[b] : 999;
            return oa - ob;
          });
        } else {
          subNames.sort();
        }

        // If group has _flat codes (like Premiums), show them directly
        var flatCodes = tree.subgroups._flat;

        // Show subgroup folders with display names
        subNames.forEach(function (subName) {
          var codes = tree.subgroups[subName];
          var item = App.utils.el("div", "folder-item folder-item--subgroup");
          item.dataset.subgroup = subName;

          var name = App.utils.el("span", "folder-item__name", subgroupDisplayName(group, subName));
          var count = App.utils.el("span", "folder-item__count", String(codes.length));
          var arrow = App.utils.el("span", "folder-item__arrow", "\u203A");

          item.appendChild(name);
          item.appendChild(count);
          item.appendChild(arrow);
          container.appendChild(item);
        });

        // Show flat codes with optional section headers
        if (flatCodes && flatCodes.length > 0) {
          if (meta && meta.flatCodeSections) {
            var flatMap = {};
            flatCodes.forEach(function (c) { flatMap[c.code] = c; });
            meta.flatCodeSections.forEach(function (section) {
              if (section.header) {
                container.appendChild(App.utils.el("div", "section-header", section.header));
              }
              section.codes.forEach(function (codeStr) {
                if (flatMap[codeStr]) {
                  container.appendChild(buildCodeItem(flatMap[codeStr]));
                }
              });
            });
          } else {
            flatCodes.forEach(function (code) {
              container.appendChild(buildCodeItem(code));
            });
          }
        }

        // On-Call Calculator button in On-Call Assessments
        if (group === "On-Call Assessments") {
          var btn = App.utils.el("div", "action-btn");
          btn.id = "oncall-btn";
          var btnText = App.utils.el("span", "", "On-Call Code Calculator");
          btn.appendChild(btnText);
          container.appendChild(btn);
        }
      }
    } else if (navPath.length === 2) {
      // Codes within a subgroup
      var group2 = navPath[0];
      var sub = navPath[1];
      var tree2 = App.data.folderTree[group2];
      if (!tree2 || !tree2.subgroups[sub]) return;

      // Check if this subgroup has section headers defined
      var meta2 = GROUP_META[group2];
      var sections = meta2 && meta2.subgroupSections && meta2.subgroupSections[sub];
      var anatomySections = App.data.anatomySections && App.data.anatomySections[sub];

      if (sections) {
        // Build code lookup for this subgroup
        var codeMap = {};
        tree2.subgroups[sub].forEach(function (c) { codeMap[c.code] = c; });

        sections.forEach(function (section) {
          var sectionCodes = section.codes
            .map(function (c) { return codeMap[c]; })
            .filter(Boolean);
          var prefixInfo = extractCommonPrefix(sectionCodes);

          if (section.header) {
            container.appendChild(App.utils.el("div", "section-header", section.header));
          }
          sectionCodes.forEach(function (code) {
            var displayName = prefixInfo ? prefixInfo.getSuffix(code.name) : null;
            container.appendChild(buildCodeItem(code, displayName));
          });
        });
      } else if (anatomySections) {
        // Data-driven anatomy sections (Ortho & MSK subgroups)
        // Use ALL billing codes for lookup (shared codes like E584 may be in other subgroups)
        var allCodesMap = {};
        App.data.billingCodes.forEach(function (c) { allCodesMap[c.code] = c; });

        anatomySections.forEach(function (section) {
          if (section.divider) {
            container.appendChild(App.utils.el("div", "section-divider", section.divider));
          } else {
            var sectionCodes = section.codes
              .map(function (c) { return allCodesMap[c]; })
              .filter(Boolean);
            var prefixInfo = extractCommonPrefix(sectionCodes);

            var headerText = prefixInfo ? prefixInfo.headerText : section.header;
            if (headerText) {
              container.appendChild(App.utils.el("div", "section-header", headerText));
            }
            sectionCodes.forEach(function (code) {
              var displayName = prefixInfo ? prefixInfo.getSuffix(code.name) : null;
              container.appendChild(buildCodeItem(code, displayName));
            });
          }
        });
      } else {
        renderWithPrefixGrouping(tree2.subgroups[sub], container);
      }
    }

    // Apply pending browse highlight (set before animateBrowse for immediate visibility)
    if (App.state.pendingBrowseHighlight != null) {
      var allNavItems = container.querySelectorAll(".folder-item, .code-item, .action-btn");
      var target = App.state.pendingBrowseHighlight;
      App.state.pendingBrowseHighlight = null;

      if (typeof target === "number") {
        if (target >= 0 && target < allNavItems.length) {
          allNavItems[target].classList.add("browse-highlighted");
          App.state.browseHighlightIndex = target;
          if (allNavItems[target].classList.contains("code-item") && allNavItems[target].dataset.code) {
            App.selectCode(allNavItems[target].dataset.code);
          }
        }
      } else {
        for (var hi = 0; hi < allNavItems.length; hi++) {
          if (allNavItems[hi].dataset.group === target || allNavItems[hi].dataset.subgroup === target || allNavItems[hi].dataset.code === target) {
            allNavItems[hi].classList.add("browse-highlighted");
            App.state.browseHighlightIndex = hi;
            if (allNavItems[hi].classList.contains("code-item") && allNavItems[hi].dataset.code) {
              App.selectCode(allNavItems[hi].dataset.code);
            }
            break;
          }
        }
      }
    }

    // Update right column preview after browse render
    if (App.state.view === "browse") {
      App.updatePreviewForBrowse();
    }
  };

  /** Extract common prefix for a group of codes sharing a dash naming convention.
   *  Tries en-dash " – " first (anatomy codes), then hyphen " - " (assessment codes).
   *  Returns { headerText, getSuffix(name) } or null if no common prefix found. */
  function extractCommonPrefix(codeObjects) {
    if (!codeObjects || codeObjects.length === 0) return null;
    var seps = [" \u2013 ", " - "]; // en-dash, then hyphen
    for (var s = 0; s < seps.length; s++) {
      var sep = seps[s];
      var prefixes = [];
      var valid = true;
      for (var i = 0; i < codeObjects.length; i++) {
        var idx = codeObjects[i].name.indexOf(sep);
        if (idx === -1) { valid = false; break; }
        prefixes.push(codeObjects[i].name.substring(0, idx));
      }
      if (!valid) continue;
      // Check all prefixes are identical
      var allSame = true;
      for (var j = 1; j < prefixes.length; j++) {
        if (prefixes[j] !== prefixes[0]) { allSame = false; break; }
      }
      if (!allSame) continue;
      var prefix = prefixes[0];
      var matchedSep = sep;
      return {
        headerText: prefix,
        getSuffix: function (name) {
          return name.substring(prefix.length + matchedSep.length);
        }
      };
    }
    return null;
  }

  /** Group codes by their prefix before " - " separator.
   *  Returns { groups: [{header, codes}], sep } or null if grouping isn't useful.
   *  Activates only when most codes have the separator and ≥1 prefix has ≥2 codes. */
  function groupByPrefix(codeObjects) {
    if (!codeObjects || codeObjects.length < 2) return null;
    var SEP = " - ";
    var prefixMap = {};
    var prefixOrder = [];
    var ungrouped = [];

    for (var i = 0; i < codeObjects.length; i++) {
      var idx = codeObjects[i].name.indexOf(SEP);
      if (idx === -1) {
        ungrouped.push(codeObjects[i]);
      } else {
        var prefix = codeObjects[i].name.substring(0, idx);
        if (!prefixMap[prefix]) {
          prefixMap[prefix] = [];
          prefixOrder.push(prefix);
        }
        prefixMap[prefix].push(codeObjects[i]);
      }
    }

    // Only group if most codes have the separator
    if (codeObjects.length - ungrouped.length <= ungrouped.length) return null;

    // At least one prefix group must have ≥2 codes
    var hasMulti = false;
    for (var j = 0; j < prefixOrder.length; j++) {
      if (prefixMap[prefixOrder[j]].length >= 2) { hasMulti = true; break; }
    }
    if (!hasMulti) return null;

    var groups = [];
    for (var k = 0; k < prefixOrder.length; k++) {
      groups.push({ header: prefixOrder[k], codes: prefixMap[prefixOrder[k]] });
    }
    if (ungrouped.length > 0) {
      groups.push({ header: null, codes: ungrouped });
    }
    return { groups: groups, sep: SEP };
  }

  /** Render prefix-grouped codes into container, or fall back to flat list. */
  function renderWithPrefixGrouping(codeObjects, container) {
    var result = groupByPrefix(codeObjects);
    if (result) {
      result.groups.forEach(function (group) {
        if (group.header) {
          container.appendChild(App.utils.el("div", "section-header", group.header));
        }
        group.codes.forEach(function (code) {
          var displayName = group.header
            ? code.name.substring(group.header.length + result.sep.length)
            : null;
          container.appendChild(buildCodeItem(code, displayName));
        });
      });
    } else {
      codeObjects.forEach(function (code) {
        container.appendChild(buildCodeItem(code));
      });
    }
  }

  /** Build a code item element. Optional displayName overrides code.name (for folder view). */
  function buildCodeItem(code, displayName) {
    var item = App.utils.el("div", "code-item");
    item.dataset.code = code.code;
    if (App.isTimeHighlighted && App.isTimeHighlighted(code.code)) {
      item.classList.add("code-item--time-active");
    }

    var codeSpan = App.utils.el("span", "code-item__code", App.utils.displayCode(code.code));
    var nameSpan = App.utils.el("span", "code-item__name", displayName || code.name);
    var feeText = code.modifier_percentage != null
      ? "+" + code.modifier_percentage + "%"
      : App.utils.formatFee(code.fee);
    var feeSpan = App.utils.el("span", "code-item__fee", feeText);

    item.appendChild(codeSpan);
    item.appendChild(nameSpan);
    item.appendChild(feeSpan);
    return item;
  }

  // Expose for reuse
  App.buildCodeItem = buildCodeItem;

  /** Render breadcrumb path into the billing column header */
  function renderBillingHeader(navPath) {
    var header = document.getElementById("billing-header");
    header.innerHTML = "";
    header.classList.toggle("billing-col__header--nav", navPath.length > 0);

    if (navPath.length === 0) {
      header.textContent = "Billing Codes";
      return;
    }

    // Root "Billing Codes" link
    var home = App.utils.el("span", "breadcrumb__item", "Billing Codes");
    home.addEventListener("click", function () {
      App.state.navPath = [];
      App.state.selectedCode = null;
      App.animateBrowse("back");
    });
    header.appendChild(home);

    navPath.forEach(function (segment, i) {
      var sep = App.utils.el("span", "breadcrumb__sep", "\u203A");
      header.appendChild(sep);

      // Convert data-level names to display names
      var displayText;
      if (i === 0) {
        displayText = groupDisplayName(segment);
      } else {
        displayText = subgroupDisplayName(navPath[0], segment);
      }

      var isLast = i === navPath.length - 1;
      var cls = isLast ? "breadcrumb__item breadcrumb__item--current" : "breadcrumb__item";
      var crumb = App.utils.el("span", cls, displayText);

      if (!isLast) {
        (function (idx) {
          crumb.addEventListener("click", function () {
            App.state.navPath = navPath.slice(0, idx + 1);
            App.animateBrowse("back");
          });
        })(i);
      }

      header.appendChild(crumb);
    });
  }

  /** Update column header text with optional count */
  App.updateColumnHeaders = function (billingCount, diagnosticCount) {
    var bh = document.getElementById("billing-header");
    var dh = document.getElementById("diagnostic-header");
    bh.textContent = billingCount != null ? "Billing Codes (" + billingCount + ")" : "Billing Codes";
    bh.classList.remove("billing-col__header--nav");
    dh.textContent = diagnosticCount != null ? "Diagnostic Codes (" + diagnosticCount + ")" : "Diagnostic Codes";
  };

  /** Render billing search results */
  App.renderBillingSearchResults = function (results) {
    var container = document.getElementById("billing-list");
    container.innerHTML = "";

    if (results.length === 0) {
      container.appendChild(App.utils.el("div", "empty-state", "No billing codes found"));
      return;
    }

    results.forEach(function (result) {
      container.appendChild(buildCodeItem(result.code));
    });
  };

  // ─── Diagnostic Folder Tree (Mobile Browse) ────────────────────

  /**
   * Build diagnostic folder tree from diagnostic codes.
   * tree[category] = { subcategories: { subName: [codes] }, flatCodes: [codes], totalCount }
   */
  App.buildDiagnosticTree = function () {
    var tree = {};

    App.data.diagnosticCodes.forEach(function (code) {
      var cat = code.category || "Other";
      if (!tree[cat]) {
        tree[cat] = { subcategories: {}, flatCodes: [], totalCount: 0 };
      }
      tree[cat].totalCount++;

      var sub = code.subcategory;
      if (!sub || sub.trim() === "") {
        tree[cat].flatCodes.push(code);
      } else {
        if (!tree[cat].subcategories[sub]) {
          tree[cat].subcategories[sub] = [];
        }
        tree[cat].subcategories[sub].push(code);
      }
    });

    // Sort codes within each group alphabetically by name
    Object.keys(tree).forEach(function (cat) {
      tree[cat].flatCodes.sort(function (a, b) {
        return a.name.localeCompare(b.name);
      });
      Object.keys(tree[cat].subcategories).forEach(function (sub) {
        tree[cat].subcategories[sub].sort(function (a, b) {
          return a.name.localeCompare(b.name);
        });
      });
    });

    App.data.diagnosticTree = tree;
  };

  /** Build a diagnostic item element */
  function buildDiagnosticItem(code) {
    var item = App.utils.el("div", "diagnostic-item");
    item.dataset.code = code.code;

    var codeSpan = App.utils.el("span", "diagnostic-item__code", code.code);
    var nameSpan = App.utils.el("span", "diagnostic-item__name", code.name);

    item.appendChild(codeSpan);
    item.appendChild(nameSpan);
    return item;
  }

  /** Render the diagnostic browse view based on current diagNavPath (mobile only) */
  App.renderDiagnosticBrowse = function () {
    var container = document.getElementById("diagnostic-list-mobile");
    if (!container) return;
    var navPath = App.state.diagNavPath;
    container.innerHTML = "";

    // Update header breadcrumb
    renderDiagnosticHeader(navPath);

    if (navPath.length === 0) {
      // Top level: show category folders alphabetically
      var categories = Object.keys(App.data.diagnosticTree).sort();
      categories.forEach(function (cat) {
        var catData = App.data.diagnosticTree[cat];
        var item = App.utils.el("div", "folder-item folder-item--group");
        item.dataset.diagCategory = cat;

        var name = App.utils.el("span", "folder-item__name", cat);
        var count = App.utils.el("span", "folder-item__count", String(catData.totalCount));
        var arrow = App.utils.el("span", "folder-item__arrow", "\u203A");

        item.appendChild(name);
        item.appendChild(count);
        item.appendChild(arrow);
        container.appendChild(item);
      });
    } else if (navPath.length === 1) {
      var cat = navPath[0];
      var catData = App.data.diagnosticTree[cat];
      if (!catData) return;

      var subNames = Object.keys(catData.subcategories).sort();

      if (subNames.length > 0) {
        // Show subcategory folders
        subNames.forEach(function (sub) {
          var codes = catData.subcategories[sub];
          var item = App.utils.el("div", "folder-item folder-item--subgroup");
          item.dataset.diagSubcategory = sub;

          var name = App.utils.el("span", "folder-item__name", sub);
          var count = App.utils.el("span", "folder-item__count", String(codes.length));
          var arrow = App.utils.el("span", "folder-item__arrow", "\u203A");

          item.appendChild(name);
          item.appendChild(count);
          item.appendChild(arrow);
          container.appendChild(item);
        });
      }

      // Show flat codes (codes with no subcategory)
      if (catData.flatCodes.length > 0) {
        catData.flatCodes.forEach(function (code) {
          container.appendChild(buildDiagnosticItem(code));
        });
      }
    } else if (navPath.length === 2) {
      var cat2 = navPath[0];
      var sub2 = navPath[1];
      var catData2 = App.data.diagnosticTree[cat2];
      if (!catData2 || !catData2.subcategories[sub2]) return;

      catData2.subcategories[sub2].forEach(function (code) {
        container.appendChild(buildDiagnosticItem(code));
      });
    }
  };

  /** Render breadcrumb path into the diagnostic column header (mobile) */
  function renderDiagnosticHeader(navPath) {
    var header = document.getElementById("diagnostic-header-mobile");
    if (!header) return;
    header.innerHTML = "";
    header.classList.toggle("diagnostic-col__header--nav", navPath.length > 0);

    if (navPath.length === 0) {
      header.textContent = "Diagnostic Codes";
      return;
    }

    // Root link
    var home = App.utils.el("span", "breadcrumb__item", "Diagnostic Codes");
    home.addEventListener("click", function () {
      App.state.diagNavPath = [];
      App.animateDiagnosticBrowse("back");
    });
    header.appendChild(home);

    navPath.forEach(function (segment, i) {
      var sep = App.utils.el("span", "breadcrumb__sep", "\u203A");
      header.appendChild(sep);

      var isLast = i === navPath.length - 1;
      var cls = isLast ? "breadcrumb__item breadcrumb__item--current" : "breadcrumb__item";
      var crumb = App.utils.el("span", cls, segment);

      if (!isLast) {
        (function (idx) {
          crumb.addEventListener("click", function () {
            App.state.diagNavPath = navPath.slice(0, idx + 1);
            App.animateDiagnosticBrowse("back");
          });
        })(i);
      }

      header.appendChild(crumb);
    });
  }

  /** Animated diagnostic folder navigation transition (mobile only) */
  App.animateDiagnosticBrowse = function (direction, onComplete) {
    var container = document.getElementById("diagnostic-list-mobile");
    if (!container) {
      App.renderDiagnosticBrowse();
      if (onComplete) onComplete();
      return;
    }

    // Skip animation if empty, already animating, or reduced motion
    if (
      !container.children.length ||
      container.classList.contains("is-animating") ||
      window.matchMedia("(prefers-reduced-motion: reduce)").matches
    ) {
      App.renderDiagnosticBrowse();
      if (onComplete) onComplete();
      return;
    }

    // Capture old content
    var scrollTop = container.scrollTop;
    var oldPanel = document.createElement("div");
    oldPanel.className = "slide-panel";
    oldPanel.style.top = -scrollTop + "px";
    while (container.firstChild) {
      oldPanel.appendChild(container.firstChild);
    }

    // Render new content
    App.renderDiagnosticBrowse();

    // Wrap new content
    var newPanel = document.createElement("div");
    newPanel.className = "slide-panel";
    while (container.firstChild) {
      newPanel.appendChild(container.firstChild);
    }

    // Animate
    container.classList.add("is-animating");
    container.scrollTop = 0;
    container.appendChild(oldPanel);
    container.appendChild(newPanel);

    if (direction === "forward") {
      oldPanel.classList.add("slide-panel--exit-left");
      newPanel.classList.add("slide-panel--enter-right");
    } else {
      oldPanel.classList.add("slide-panel--exit-right");
      newPanel.classList.add("slide-panel--enter-left");
    }

    newPanel.addEventListener("animationend", function () {
      container.classList.remove("is-animating");
      if (oldPanel.parentNode) oldPanel.remove();
      while (newPanel.firstChild) {
        container.appendChild(newPanel.firstChild);
      }
      newPanel.remove();
      if (onComplete) onComplete();
    }, { once: true });
  };

  /** Expose renderDiagnosticHeader for swipe.js folder-back */
  App.renderDiagnosticHeader = function () {
    renderDiagnosticHeader(App.state.diagNavPath);
  };

  /** Update mobile diagnostic header text with optional count (search mode) */
  App.updateDiagnosticMobileHeader = function (count) {
    var header = document.getElementById("diagnostic-header-mobile");
    if (!header) return;
    header.innerHTML = "";
    header.classList.remove("diagnostic-col__header--nav");
    header.textContent = count != null ? "Diagnostic Codes (" + count + ")" : "Diagnostic Codes";
  };

  /** Render diagnostic results into a single container element */
  function renderDiagnosticInto(container, results) {
    container.innerHTML = "";

    if (!results || results.length === 0) {
      container.innerHTML = '<div class="empty-state">Search to see diagnostic codes</div>';
      return;
    }

    // Group results by subcategory, preserving search ranking within each group
    var groups = {};
    var groupOrder = [];
    results.forEach(function (result) {
      var cat = result.code.subcategory || result.code.category || "Other";
      if (!groups[cat]) {
        groups[cat] = [];
        groupOrder.push(cat);
      }
      groups[cat].push(result);
    });

    groupOrder.forEach(function (cat) {
      var header = App.utils.el("div", "section-header", cat);
      container.appendChild(header);

      groups[cat].forEach(function (result) {
        var code = result.code;
        var item = App.utils.el("div", "diagnostic-item");
        item.dataset.code = code.code;

        var codeSpan = App.utils.el("span", "diagnostic-item__code", code.code);
        var nameSpan = App.utils.el("span", "diagnostic-item__name", code.name);

        item.appendChild(codeSpan);
        item.appendChild(nameSpan);
        container.appendChild(item);
      });
    });
  }

  /** Render diagnostic column — desktop always gets search results; mobile only in search mode */
  App.renderDiagnosticColumn = function (results) {
    // Desktop: always render search results
    var desktopList = document.getElementById("diagnostic-list");
    if (desktopList) renderDiagnosticInto(desktopList, results);

    // Mobile: only render search results when in search mode
    if (App.state.diagView === "search") {
      var mobileList = document.getElementById("diagnostic-list-mobile");
      if (mobileList) renderDiagnosticInto(mobileList, results);
    }
  };

  // ─── Expose helpers for preview rendering ─────────────────────
  App.groupDisplayName = groupDisplayName;
  App.subgroupDisplayName = subgroupDisplayName;
  App.GROUP_META = GROUP_META;

  // ─── Preview System ──────────────────────────────────────────

  /** Returns true when the middle column is showing codes (not folders) */
  App.isBrowseShowingCodes = function () {
    var navPath = App.state.navPath;
    if (navPath.length === 0) return false;
    if (navPath.length >= 2) return true;
    // navPath.length === 1: depends on group config
    var group = navPath[0];
    var meta = GROUP_META[group];
    if (meta && meta.flatSections && meta.flatSections.length > 0) return true;
    var tree = App.data.folderTree[group];
    if (!tree) return true;
    var subNames = Object.keys(tree.subgroups).filter(function (s) { return s !== "_flat"; });
    return subNames.length === 0; // only flat codes (e.g. Premiums)
  };

  /** Render a folder preview into the right column */
  App.renderPreview = function (groupKey, subgroupKey) {
    var container = document.getElementById("context-panel");
    var header = document.getElementById("context-header");
    container.innerHTML = "";

    if (!groupKey) {
      container.innerHTML = '<div class="empty-state">Select a folder to preview</div>';
      if (header) header.textContent = "Preview";
      App.state.contextMode = "empty";
      return;
    }

    var tree = App.data.folderTree[groupKey];
    if (!tree) return;

    App.state.contextMode = "preview";
    App.state.previewGroup = groupKey;
    App.state.previewSubgroup = subgroupKey || null;

    if (!subgroupKey) {
      // Level 0 highlight: preview group contents
      if (header) header.textContent = groupDisplayName(groupKey);
      var meta = GROUP_META[groupKey];

      // flatSections groups: show codes by section headers (no subfolders)
      if (meta && meta.flatSections && meta.flatSections.length > 0) {
        meta.flatSections.forEach(function (subName) {
          var codes = tree.subgroups[subName];
          if (!codes || codes.length === 0) return;
          container.appendChild(App.utils.el("div", "section-header", subgroupDisplayName(groupKey, subName)));
          codes.forEach(function (code) {
            container.appendChild(buildCodeItem(code));
          });
        });
        return;
      }

      // Flat code groups with no subfolders (Premiums, On-Call Assessments)
      var subNames = Object.keys(tree.subgroups).filter(function (s) { return s !== "_flat"; });
      if (subNames.length === 0) {
        var flatCodes = tree.subgroups._flat;
        if (flatCodes && flatCodes.length > 0) {
          if (meta && meta.flatCodeSections) {
            var flatMap = {};
            flatCodes.forEach(function (c) { flatMap[c.code] = c; });
            meta.flatCodeSections.forEach(function (section) {
              if (section.header) {
                container.appendChild(App.utils.el("div", "section-header", section.header));
              }
              section.codes.forEach(function (codeStr) {
                if (flatMap[codeStr]) {
                  container.appendChild(buildCodeItem(flatMap[codeStr]));
                }
              });
            });
          } else {
            flatCodes.forEach(function (code) {
              container.appendChild(buildCodeItem(code));
            });
          }
          // On-Call Calculator button
          if (groupKey === "On-Call Assessments") {
            var btn = App.utils.el("div", "action-btn");
            btn.id = "preview-oncall-btn";
            btn.appendChild(App.utils.el("span", "", "On-Call Code Calculator"));
            container.appendChild(btn);
          }
        }
        return;
      }

      // Standard: show subgroup folders as preview
      if (meta && meta.subgroupOrder && meta.subgroupOrder.length > 0) {
        var orderMap = {};
        meta.subgroupOrder.forEach(function (s, i) { orderMap[s] = i; });
        subNames.sort(function (a, b) {
          var oa = orderMap[a] != null ? orderMap[a] : 999;
          var ob = orderMap[b] != null ? orderMap[b] : 999;
          return oa - ob;
        });
      } else {
        subNames.sort();
      }

      subNames.forEach(function (subName) {
        var codes = tree.subgroups[subName];
        var item = App.utils.el("div", "folder-item folder-item--subgroup");
        item.dataset.group = groupKey;
        item.dataset.subgroup = subName;
        item.appendChild(App.utils.el("span", "folder-item__name", subgroupDisplayName(groupKey, subName)));
        item.appendChild(App.utils.el("span", "folder-item__count", String(codes.length)));
        item.appendChild(App.utils.el("span", "folder-item__arrow", "\u203A"));
        container.appendChild(item);
      });
    } else {
      // Level 1 highlight: preview codes of a subgroup
      if (header) header.textContent = subgroupDisplayName(groupKey, subgroupKey);
      var codes = tree.subgroups[subgroupKey];
      if (!codes) return;

      var meta2 = GROUP_META[groupKey];
      var sections = meta2 && meta2.subgroupSections && meta2.subgroupSections[subgroupKey];
      var anatomySections = App.data.anatomySections && App.data.anatomySections[subgroupKey];

      if (sections) {
        var codeMap = {};
        codes.forEach(function (c) { codeMap[c.code] = c; });
        sections.forEach(function (section) {
          var sectionCodes = section.codes
            .map(function (c) { return codeMap[c]; })
            .filter(Boolean);
          var prefixInfo = extractCommonPrefix(sectionCodes);

          if (section.header) {
            container.appendChild(App.utils.el("div", "section-header", section.header));
          }
          sectionCodes.forEach(function (code) {
            var displayName = prefixInfo ? prefixInfo.getSuffix(code.name) : null;
            container.appendChild(buildCodeItem(code, displayName));
          });
        });
      } else if (anatomySections) {
        // Data-driven anatomy sections preview
        var allCodesMap = {};
        App.data.billingCodes.forEach(function (c) { allCodesMap[c.code] = c; });
        anatomySections.forEach(function (section) {
          if (section.divider) {
            container.appendChild(App.utils.el("div", "section-divider", section.divider));
          } else {
            var sectionCodes = section.codes
              .map(function (c) { return allCodesMap[c]; })
              .filter(Boolean);
            var prefixInfo = extractCommonPrefix(sectionCodes);

            var headerText = prefixInfo ? prefixInfo.headerText : section.header;
            if (headerText) {
              container.appendChild(App.utils.el("div", "section-header", headerText));
            }
            sectionCodes.forEach(function (code) {
              var displayName = prefixInfo ? prefixInfo.getSuffix(code.name) : null;
              container.appendChild(buildCodeItem(code, displayName));
            });
          }
        });
      } else {
        renderWithPrefixGrouping(codes, container);
      }
    }
  };

  /** Update right column preview based on current browse state */
  App.updatePreviewForBrowse = function () {
    // Skip on tablet/mobile
    if (window.innerWidth < 1024) return;

    // If middle column shows codes, let selectCode handle the right column
    if (App.isBrowseShowingCodes()) {
      // Auto-select first code if none selected yet
      if (!App.state.selectedCode) {
        var firstCode = document.querySelector("#billing-list .code-item[data-code]");
        if (firstCode) {
          App.selectCode(firstCode.dataset.code);
        }
      }
      return;
    }

    // Middle shows folders: find highlighted folder and render preview
    var highlighted = document.querySelector("#billing-list .browse-highlighted");
    if (highlighted) {
      var group = highlighted.dataset.group;
      var subgroup = highlighted.dataset.subgroup;
      if (group) {
        App.renderPreview(group, null);
      } else if (subgroup && App.state.navPath.length >= 1) {
        App.renderPreview(App.state.navPath[0], subgroup);
      } else {
        App.renderPreview(null);
      }
    } else {
      // Nothing highlighted: auto-highlight first item
      var items = document.querySelectorAll("#billing-list .folder-item, #billing-list .code-item, #billing-list .action-btn");
      if (items.length > 0) {
        items[0].classList.add("browse-highlighted");
        App.state.browseHighlightIndex = 0;
        var g = items[0].dataset.group;
        var sg = items[0].dataset.subgroup;
        if (g) {
          App.renderPreview(g, null);
        } else if (sg && App.state.navPath.length >= 1) {
          App.renderPreview(App.state.navPath[0], sg);
        } else {
          App.renderPreview(null);
        }
      }
    }
  };

  /** Mobile auto-switch based on query pattern */
  App.handleMobileAutoSwitch = function (query) {
    var trimmed = query.trim();
    if (/^[A-Z][0-9]{3}[A-Z]?$/i.test(trimmed)) {
      App.swipeToPage("billing");
    }
  };

  /** Switch mobile tab (delegates to swipe system on mobile) */
  App.switchMobileTab = function (tab) {
    if (window.innerWidth < 768 && App.swipeToPage) {
      App.swipeToPage(tab);
    } else {
      App.state.mobileTab = tab;
    }
  };

  /** Expose renderBillingHeader for swipe.js folder-back */
  App.renderBillingHeader = function () {
    renderBillingHeader(App.state.navPath);
  };
})();
