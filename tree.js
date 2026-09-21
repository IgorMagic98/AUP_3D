// ============================================================
// tree.js — Дерево объектов в интерфейсе (UI)
// Зависимости: STATE, UI, Engine, Utils
// ============================================================

const Tree = {
  container: null,

  init() {
    this.container = document.getElementById("treeContainer");
    if (!STATE.expandedFolders) STATE.expandedFolders = new Set();
  },

  update() {
    const countEl = document.getElementById("objectCount");
    if (countEl) countEl.textContent = STATE.objects.length;

    if (!this.container) return;
    this.container.innerHTML = "";

    if (!STATE.objects.length) {
      this.container.innerHTML = '<div class="tree-empty">Сцена пуста.</div>';
      return;
    }

    const f = {
      pipeline: { name: "Трубопроводы", icon: "▼", objects: [] },
      branch: { name: "Ветки", icon: "▼", objects: [] },
      sprinkler_row: { name: "Рядки", icon: "▼", objects: [] },
      control_valve: { name: "Узлы управления", icon: "▼", objects: [] },
      armature: { name: "Арматура", icon: "▼", objects: [] },
    };

    STATE.objects.forEach((o) => {
      if (f[o.type]) f[o.type].objects.push(o);
    });

    Object.keys(f).forEach((t) => {
      const fo = f[t];
      if (fo.objects.length > 0) {
        const fn = this.createFolderNode(t, fo);
        this.container.appendChild(fn);
      }
    });
  },

  createFolderNode(t, fo) {
    const d = document.createElement("div");
    d.className = "tree-folder";
    const h = document.createElement("div");
    h.className = "tree-folder-header";
    h.innerHTML = `<span class="folder-icon">${fo.icon}</span><span>${fo.name}</span><span class="folder-count">${fo.objects.length}</span>`;
    const c = document.createElement("div");
    c.className = "tree-folder-children";

    fo.objects.forEach((o) => c.appendChild(this.createRootNode(o)));

    d.appendChild(h);
    d.appendChild(c);

    if (STATE.expandedFolders.has(t)) c.classList.add("expanded");

    h.addEventListener("click", () => {
      if (c.classList.contains("expanded")) {
        c.classList.remove("expanded");
        STATE.expandedFolders.delete(t);
      } else {
        c.classList.add("expanded");
        STATE.expandedFolders.add(t);
      }
    });
    return d;
  },

  createRootNode(obj) {
    const t = obj.type;
    const ip = t === "pipeline";
    const ir = t === "sprinkler_row";
    const iv = t === "control_valve";
    const ib = t === "branch";

    let ic = ib
      ? '<img src="ico/Sprinkler.png" class="tree-icon-img">'
      : ip
        ? '<img src="ico/Pipeline.png" class="tree-icon-img">'
        : ir
          ? '<img src="ico/Sprinkler.png" class="tree-icon-img">'
          : iv
            ? "🔧"
            : "";

    const tn = ip
      ? "Трубопровод"
      : ir
        ? "Рядок"
        : iv
          ? "Узел управления"
          : "Ветка";

    let dns = [];
    if (ip && obj.userData.segments)
      dns = [...new Set(obj.userData.segments.map((s) => s.diameter))];
    else if (ir)
      dns = [
        ...new Set([
          ...(obj.userData.leftDiameters || []),
          ...(obj.userData.rightDiameters || []),
        ]),
      ];
    else if (obj.userData.segments)
      dns = [...new Set(obj.userData.segments.map((s) => s.diameter))];
    else if (iv) dns = [obj.userData.diameter];
    const di = dns.length > 0 ? dns.join("/") + "мм" : "N/A";

    let ci = "";
    if (obj.userData.connectedTo) {
      const ct = obj.userData.connectedTo;
      ci = ` 🔗${ct.targetId}${ct.autoDetected ? " ⚡" : ""}`;
    }
    const cm = obj.userData.isClosedLoop ? " 🔄" : "";

    const nd = document.createElement("div");
    nd.className = "tree-node";
    nd.dataset.id = obj.id;

    const r = document.createElement("div");
    r.className = "tree-node-row";
    if (STATE.selectedObjectId === obj.id) r.classList.add("selected");
    if (!obj.root.visible) r.classList.add("hidden-node");

    // === ИСПРАВЛЕНО: Проверяем наличие сегментов ===
    const segments = obj.userData.segments || [];
    const hasSegments = ip && segments.length > 0;

    // Для отладки выводим в консоль
    if (ip && hasSegments) {
      console.log(
        `Трубопровод ${obj.id} имеет ${segments.length} сегментов:`,
        segments,
      );
    }

    const toggleIcon = hasSegments ? "▶" : "";

    r.innerHTML = `
        <div class="tree-toggle" style="${hasSegments ? "cursor: pointer;" : "visibility: hidden;"}">${toggleIcon}</div>
        <span class="tree-icon">${ic}</span>
        <span class="tree-label" title="${tn} №${obj.userData.number || obj.id} | ${obj.userData.totalLength?.toFixed(2) || 0}м | ⌀${di}${ci}${cm}">
            ${tn} №${obj.userData.number || obj.id}${cm} ${hasSegments ? `(${segments.length} уч.)` : ""}
        </span>
        <div class="tree-actions">
            <button class="tree-action-btn" data-action="focus" title="Фокус"><img src="ico/focus.png"></button>
            <button class="tree-action-btn" data-action="visibility" title="Видимость"><img src="${obj.root.visible ? "ico/visibility.png" : "ico/visibility-off.png"}"></button>
            <button class="tree-action-btn" data-action="duplicate" title="Копировать">📋</button>
            ${ip ? '<button class="tree-action-btn" data-action="split" title="Разбить">✂️</button>' : ""}
            ${!ip ? '<button class="tree-action-btn" data-action="attach" title="Привязать"><img src="ico/attach.png"></button>' : ""}
            <button class="tree-action-btn" data-action="edit" title="Редактировать"><img src="ico/edit.png"></button>
            <button class="tree-action-btn" data-action="delete" title="Удалить"><img src="ico/delete.png"></button>
        </div>
    `;

    const ch = document.createElement("div");
    ch.className = "tree-children";

    // === ДОБАВЛЕНО: Отображаем сегменты ===
    if (hasSegments) {
      console.log("Добавляем сегменты в дерево для трубопровода", obj.id);

      segments.forEach((seg, index) => {
        const segNode = document.createElement("div");
        segNode.className = "tree-child-row tree-segment-row";
        segNode.style.paddingLeft = "25px";
        segNode.style.fontSize = "0.85em";
        segNode.style.color = "#666";
        segNode.style.borderLeft = "2px solid #1a80cc";
        segNode.style.marginLeft = "8px";
        segNode.style.marginBottom = "2px";
        // segNode.innerHTML = `
        //         <span style="margin-right: 10px;">📏</span>
        //         <span class="tree-child-label">
        //             Участок №${index + 1}: ${seg.length.toFixed(2)}м, DN${seg.diameter}
        //         </span>
        //         <button class="tree-action-btn" data-action="edit-segment" data-index="${index}" title="Редактировать участок" style="margin-left: 10px;">️</button>
        //     `;

        segNode.innerHTML = `
                <img src="ico/Segment.png" class="tree-icon-img" style="width: 14px; height: 14px; margin-right: 6px; vertical-align: middle;">
                <span class="tree-child-label">
                    Участок #${index + 1}: ${seg.length.toFixed(2)}м, DN${seg.diameter}
                </span>
                <button class="tree-action-btn" data-action="edit-segment" data-index="${index}" title="Редактировать участок" style="margin-left: 10px;">
                    <img src="ico/edit.png" alt="️" style="width: 14px; height: 14px; object-fit: contain;">
                </button>
            `;

        segNode
          .querySelector('[data-action="edit-segment"]')
          .addEventListener("click", (e) => {
            e.stopPropagation();
            console.log(
              "Редактирование сегмента",
              index,
              "трубопровода",
              obj.id,
            );
            this.editSegment(obj.id, index);
          });

        ch.appendChild(segNode);
      });
    }
    // ==========================================

    nd.appendChild(r);
    nd.appendChild(ch);

    // Логика раскрытия/сворачивания
    const toggleEl = r.querySelector(".tree-toggle");
    if (toggleEl && hasSegments) {
      toggleEl.addEventListener("click", (e) => {
        e.stopPropagation();
        const isExpanded = ch.classList.contains("expanded");
        if (isExpanded) {
          ch.classList.remove("expanded");
          ch.style.display = "none";
          toggleEl.textContent = "▶";
        } else {
          ch.classList.add("expanded");
          ch.style.display = "block";
          toggleEl.textContent = "▼";
        }
      });
    }

    // // Клик по строке
    // r.addEventListener("click", (e) => {
    //   if (e.target.closest(".tree-action-btn")) return;
    //   STATE.selectedObjectId = obj.id;
    //   this.update();
    // });

    // Клик по строке
    r.addEventListener('click', (e) => {
      if (e.target.closest('.tree-action-btn')) return;
      
      // Снимаем выделение с предыдущего объекта
      if (typeof UI !== 'undefined' && UI.unhighlightAll) {
        UI.unhighlightAll();
      }
      
      // Выделяем новый объект
      if (typeof UI !== 'undefined' && UI.highlightEntireObject) {
        UI.highlightEntireObject(obj);
      }
      
      STATE.selectedObjectId = obj.id;
      this.update();
    });


    // // Эффекты наведения
    // r.addEventListener("mouseenter", () => {
    //   if (r.classList.contains("highlighted")) return;
    //   r.classList.add("highlighted");
    //   if (typeof UI !== "undefined" && UI.highlightEntireObject)
    //     UI.highlightEntireObject(obj);
    // });
    // r.addEventListener("mouseleave", () => {
    //   r.classList.remove("highlighted");
    //   if (typeof UI !== "undefined" && UI.unhighlightAll) UI.unhighlightAll();
    // });

    // Эффекты наведения (только если объект не выбран)
    r.addEventListener('mouseenter', () => {
      if (r.classList.contains('highlighted')) return;
      // Не подсвечиваем при наведении, если объект уже выбран
      if (STATE.selectedObjectId === obj.id) return;
      
      r.classList.add('highlighted');
      if (typeof UI !== 'undefined' && UI.highlightEntireObject) {
        UI.highlightEntireObject(obj);
      }
    });
    r.addEventListener('mouseleave', () => {
      r.classList.remove('highlighted');
      // Снимаем выделение только если объект не выбран
      if (STATE.selectedObjectId !== obj.id) {
        if (typeof UI !== 'undefined' && UI.unhighlightAll) {
          UI.unhighlightAll();
        }
      }
    });

    // Кнопки действий
    r.querySelectorAll(".tree-action-btn").forEach((b) =>
      b.addEventListener("click", (e) => {
        e.stopPropagation();
        this.handleAction(b.dataset.action, obj, b.dataset.index);
      }),
    );

    return nd;
  },

    editSegment(pipelineId, segmentIndex) {
        const pipeline = STATE.objects.find(o => o.id === pipelineId);
        if (!pipeline || !pipeline.userData.segments[segmentIndex]) {
            Utils.showStatus('Сегмент не найден');
            return;
        }
        
        const seg = pipeline.userData.segments[segmentIndex];
        
        // Создаем модальное окно
        const modal = document.createElement('div');
        modal.className = 'modal active';
        modal.style.cssText = 'position: fixed; top: 0; left: 0; width: 100%; height: 100%; background: rgba(0,0,0,0.5); z-index: 10000; display: flex; align-items: center; justify-content: center;';
        
        modal.innerHTML = `
            <div style="background: white; padding: 30px; border-radius: 8px; box-shadow: 0 4px 20px rgba(0,0,0,0.3); min-width: 400px;">
                <h3 style="margin-top: 0; margin-bottom: 20px;">Редактировать участок #${segmentIndex + 1}</h3>
                
                <div style="margin-bottom: 20px;">
                    <label style="display: block; margin-bottom: 8px; font-weight: bold; color: #333;">Длина (м):</label>
                    <input type="number" id="segLength" value="${seg.length.toFixed(2)}" step="0.01" min="0.1" 
                        style="width: 100%; padding: 10px; border: 1px solid #ddd; border-radius: 4px; font-size: 14px; box-sizing: border-box;">
                </div>
                
                <div style="margin-bottom: 25px;">
                    <label style="display: block; margin-bottom: 8px; font-weight: bold; color: #333;">Диаметр (мм):</label>
                    <select id="segDiameter" 
                        style="width: 100%; padding: 10px; border: 1px solid #ddd; border-radius: 4px; font-size: 14px; background: white;">
                        ${[25, 32, 40, 50, 63, 75, 90, 110, 125, 160, 200, 250, 315].map(d => 
                            `<option value="${d}" ${d === seg.diameter ? 'selected' : ''}>DN${d}</option>`
                        ).join('')}
                    </select>
                </div>
                
                <div style="display: flex; gap: 10px; justify-content: flex-end;">
                    <button id="segCancelBtn" 
                        style="padding: 10px 20px; background: #f44336; color: white; border: none; border-radius: 4px; cursor: pointer; font-size: 14px; font-weight: bold;">
                        Отмена
                    </button>
                    <button id="segApplyBtn" 
                        style="padding: 10px 20px; background: #4CAF50; color: white; border: none; border-radius: 4px; cursor: pointer; font-size: 14px; font-weight: bold;">
                        Применить
                    </button>
                </div>
            </div>
        `;
        
        document.body.appendChild(modal);
        
        // Обработчики кнопок
        document.getElementById('segApplyBtn').addEventListener('click', () => {
            const newLength = parseFloat(document.getElementById('segLength').value);
            const newDiameter = parseInt(document.getElementById('segDiameter').value);
            
            if (newLength && newDiameter && newLength > 0) {
                // Вызываем метод из SplitManager
                if (UI.split && UI.split.applySegmentEdit) {
                    UI.split.applySegmentEdit(pipelineId, segmentIndex, newLength, newDiameter);
                } else {
                    Utils.showStatus('Ошибка: метод редактирования не найден');
                }
            } else {
                alert('Введите корректные значения!');
                return;
            }
            
            modal.remove();
        });
        
        document.getElementById('segCancelBtn').addEventListener('click', () => {
            modal.remove();
        });
        
        // Закрытие по клику на фон
        modal.addEventListener('click', (e) => {
            if (e.target === modal) modal.remove();
        });
    },

    renderChildren(o, c) {
    c.innerHTML = "";
    let i = 0;
    o.root.traverse((ch) => {
      if (ch === o.root) return;
      if (!ch.userData) return;
      if (!ch.userData.elemName && !ch.name) return;
      if (
        ch.userData.type === "preview" ||
        ch.userData.type === "committedPipeSegment" ||
        ch.userData.type === "committedConnectionPoint" ||
        ch.userData.isHitbox
      )
        return;

      const n = ch.userData.elemName || ch.name || `Элемент ${i}`;
      const cr = document.createElement("div");
      cr.className = "tree-child-row";
      if (!ch.visible) cr.classList.add("hidden-node");
      cr.innerHTML = `<span class="tree-child-label">${n}</span><button class="tree-action-btn" data-action="child-visibility">${ch.visible ? "👁️" : "🚫"}</button>`;

      cr.addEventListener("mouseenter", () => {
        cr.classList.add("highlighted");
        if (typeof UI !== "undefined" && UI.highlightSingleMesh)
          UI.highlightSingleMesh(ch);
      });
      cr.addEventListener("mouseleave", () => {
        cr.classList.remove("highlighted");
        if (typeof UI !== "undefined" && UI.unhighlightAll) UI.unhighlightAll();
      });
      cr.querySelector('[data-action="child-visibility"]').addEventListener(
        "click",
        (e) => {
          e.stopPropagation();
          ch.visible = !ch.visible;
          this.update();
        },
      );
      c.appendChild(cr);
      i++;
    });
  },

  handleAction(a, o, index) {
    switch (a) {
      case "focus":
        if (typeof UI !== "undefined" && UI.focusObject) UI.focusObject(o);
        break;
      case "visibility":
        o.root.visible = !o.root.visible;
        this.update();
        break;
      case "attach":
        if (typeof UI !== "undefined" && UI.startAttachMode)
          UI.startAttachMode(o);
        break;
      case "duplicate":
        if (typeof UI !== "undefined" && UI.startDuplicateMode)
          UI.startDuplicateMode(o);
        break;
      case "split":
        if (
          o.type === "pipeline" &&
          typeof UI !== "undefined" &&
          UI.openSplitPipelineModal
        )
          UI.openSplitPipelineModal(o.id);
        break;
      case "edit":
        if (typeof UI === "undefined") break;
        if (o.type === "pipeline") UI.openPipelineEditModal(o.id);
        else if (o.type === "sprinkler_row") UI.openRowEditModal(o.id);
        else if (o.type === "control_valve") UI.openValveEditModal(o.id);
        else UI.openEditModal(o.id);
        break;
      case "edit-segment":
        if (typeof UI !== "undefined") this.editSegment(o.id, parseInt(index));
        break;
      case "delete":
        if (confirm(`Удалить №${o.userData.number || o.id}?`)) {
          if (typeof Engine !== "undefined") Engine.scene.remove(o.root);
          STATE.objects = STATE.objects.filter((x) => x.id !== o.id);
          if (STATE.selectedObjectId === o.id) STATE.selectedObjectId = null;
          this.update();
        }
        break;
    }
  },
};

// === ФУНКЦИОНАЛ ИЗМЕНЕНИЯ РАЗМЕРА ДЕРЕВА ===
(function() {
    // ВАЖНО: берем именно treePanel, а не treeContainer
    const treePanel = document.getElementById('treePanel');
    if (!treePanel) return;
    
    // Создаем ручку для перетаскивания и добавляем её в treePanel
    const resizeHandle = document.createElement('div');
    resizeHandle.id = 'treeResizeHandle';
    treePanel.appendChild(resizeHandle);
    
    let isResizing = false;
    let startX = 0;
    let startWidth = 0;
    
    // Начало перетаскивания
    resizeHandle.addEventListener('mousedown', function(e) {
        isResizing = true;
        startX = e.clientX;
        startWidth = treePanel.offsetWidth;
        
        resizeHandle.classList.add('active');
        document.body.classList.add('resizing-tree');
        
        e.preventDefault();
        e.stopPropagation();
    });
    
    // Перемещение мыши
    document.addEventListener('mousemove', function(e) {
        if (!isResizing) return;
        
        const deltaX = e.clientX - startX;
        const newWidth = startWidth + deltaX;
        
        // Ограничения: мин 250px, макс 600px (должны совпадать с CSS)
        if (newWidth >= 250 && newWidth <= 600) {
            treePanel.style.width = newWidth + 'px';
        }
    });
    
    // Конец перетаскивания
    document.addEventListener('mouseup', function() {
        if (isResizing) {
            isResizing = false;
            resizeHandle.classList.remove('active');
            document.body.classList.remove('resizing-tree');
            
            // Сохраняем ширину в память браузера
            localStorage.setItem('treePanelWidth', treePanel.offsetWidth);
        }
    });
    
    // Двойной клик по ручке сбрасывает ширину к стандартной
    resizeHandle.addEventListener('dblclick', function() {
        const defaultWidth = 300;
        treePanel.style.width = defaultWidth + 'px';
        localStorage.setItem('treePanelWidth', defaultWidth);
    });
    
    // Восстанавливаем сохраненную ширину при загрузке страницы
    const savedWidth = localStorage.getItem('treePanelWidth');
    if (savedWidth) {
        treePanel.style.width = savedWidth + 'px';
    }
})();