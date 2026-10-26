// ============================================================================
// charts.js — Построение гидравлической характеристики системы (без насоса)
// Зависимости: Chart.js (подключен в index.html)
// ============================================================================

let systemChartInstance = null;

/**
 * Построение графика характеристики системы
 * H = H_max + K_system * Q^2
 * 
 * @param {Object} data - данные для построения
 * @param {number} data.K_system - коэффициент сопротивления системы
 * @param {number} data.H_max - максимальная геодезическая отметка (м)
 * @param {number} data.Q_total - текущий расход системы (л/с) — для отметки рабочей точки
 * @param {number} data.H_source - текущий напор источника (м) — для отметки рабочей точки
 */
function buildHydraulicChart(data) {
    // alert(hghg)
    const { K_system, H_max, Q_total, H_source } = data;

    if (K_system === undefined || H_max === undefined) {
        console.error("❌ Не переданы K_system или H_max");
        return;
    }

    const ctx = document.getElementById("systemCurveCanvas");
    if (!ctx) {
        console.error(" Canvas не найден");
        return;
    }

    if (systemChartInstance) {
        systemChartInstance.destroy();
    }

    // =========================================================================
    // Генерация точек для параболы системы: H = H_max + K_system * Q^2
    // =========================================================================
    const Q_data = [];
    const H_system = [];

    // Если Q_total = 0, используем разумный диапазон
    const maxQ = Q_total > 0 ? Math.max(Q_total * 1.5, 5) : 20;
    const step = maxQ / 50; // 50 точек для плавности

    console.log(`📊 Генерация графика: maxQ=${maxQ.toFixed(2)}, step=${step.toFixed(3)}`);

    for (let Q = 0; Q <= maxQ; Q += step) {
        Q_data.push(parseFloat(Q.toFixed(3)));
        const H = H_max + K_system * Q * Q;
        H_system.push(parseFloat(H.toFixed(4)));
    }

    // Рабочая точка
    const workingPoint = [];
    if (Q_total > 0 && H_source > 0) {
        workingPoint.push({ x: Q_total, y: H_source });
        console.log(`🎯 Рабочая точка: Q=${Q_total.toFixed(2)}, H=${H_source.toFixed(2)}`);
    } else {
        console.warn("⚠️ Q_total или H_source = 0, рабочая точка не будет отображена");
    }

    // =========================================================================
    // Создание графика
    // =========================================================================
    systemChartInstance = new Chart(ctx, {
        type: "line",
        data: {
            datasets: [
                {
                    label: "Характеристика системы",
                    data: H_system.map((H, i) => ({ x: Q_data[i], y: H })),
                    borderColor: "rgb(54, 162, 235)",
                    backgroundColor: "rgba(54, 162, 235, 0.1)",
                    borderWidth: 3,
                    tension: 0.4,
                    pointRadius: 2,
                    pointHoverRadius: 5,
                    fill: false,
                },
                {
                    label: "Рабочая точка",
                    data: workingPoint,
                    borderColor: "rgb(255, 99, 132)",
                    backgroundColor: "rgb(255, 99, 132)",
                    pointRadius: 10,
                    pointHoverRadius: 12,
                    showLine: false,
                    type: "scatter",
                },
            ],
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            interaction: {
                mode: "index",
                intersect: false,
            },
            plugins: {
                title: {
                    display: true,
                    text: "Гидравлическая характеристика системы",
                    font: { size: 16, weight: "bold" },
                },
                legend: {
                    position: "top",
                },
                tooltip: {
                    callbacks: {
                        label: function (context) {
                            if (context.dataset.label === "Рабочая точка") {
                                return `Q = ${context.parsed.x.toFixed(2)} л/с, H = ${context.parsed.y.toFixed(2)} м`;
                            }
                            return `Q = ${context.parsed.x.toFixed(2)} л/с, H = ${context.parsed.y.toFixed(2)} м`;
                        },
                    },
                },
            },
            scales: {
                x: {
                    type: "linear",
                    title: {
                        display: true,
                        text: "Q, л/с",
                        font: { size: 14, weight: "bold" },
                    },
                    min: 0,
                    max: maxQ,
                    grid: {
                        color: "rgba(0, 0, 0, 0.05)",
                    },
                },
                y: {
                    title: {
                        display: true,
                        text: "H, м.вод.ст.",
                        font: { size: 14, weight: "bold" },
                    },
                    min: 0,
                    max: Math.max(H_source * 1.2, H_max * 1.5, 50),
                    grid: {
                        color: "rgba(0, 0, 0, 0.05)",
                    },
                },
            },
        },
    });

    console.log(`✅ График построен: K_system=${K_system.toFixed(6)}, H_max=${H_max.toFixed(2)} м, maxQ=${maxQ.toFixed(2)}`);
}

/**
 * Построение графика на основе данных из последнего расчета (глобальные переменные)
 * Вызывается при клике на кнопку "📈 Характеристика системы"
 */
function buildChartFromLastCalculation() {
    // Данные берутся из глобальных переменных, которые устанавливаются
    // после успешного расчета в new.js (window.lastCalculationResult)
    const data = window.lastCalculationResult || {};

    if (!data.K_system || !data.H_max) {
        console.warn("⚠️ Нет данных последнего расчета. Используются значения по умолчанию.");
        buildHydraulicChart({
            K_system: 0.025,
            H_max: 0,
            Q_total: 10,
            H_source: 30,
        });
        return;
    }

    buildHydraulicChart({
        K_system: data.K_system,
        H_max: data.H_max,
        Q_total: data.Q_total,
        H_source: data.H_source,
    });
}

/**
 * Инициализация обработчиков событий для модального окна графика
 * Вызывается один раз при загрузке страницы
 */
/**
 * Инициализация обработчиков событий для модального окна графика
 */
function initChartModal() {
    const menuBtn = document.getElementById("menuShowSystemCurve");
    const modal = document.getElementById("chartModal");
    const overlay = document.getElementById("chartOverlay");
    const closeBtn = document.getElementById("closeChartBtn");
    const closeFooterBtn = document.getElementById("closeChartFooterBtn");
    const updateBtn = document.getElementById("updateChartBtn");
    // ✅ Получаем новую кнопку
    const fullscreenBtn = document.getElementById("toggleChartFullscreenBtn");

    function showModal() {
        if (!modal || !overlay) return;
        modal.style.display = "block";
        overlay.style.display = "block";
        setTimeout(buildChartFromLastCalculation, 50);
    }

    function hideModal() {
        if (!modal || !overlay) return;
        modal.style.display = "none";
        overlay.style.display = "none";
        // ✅ При закрытии выключаем полноэкранный режим, если он был включен
        modal.classList.remove("is-fullscreen");
    }

    // ✅ Логика кнопки "На весь экран"
    if (fullscreenBtn) {
        fullscreenBtn.addEventListener("click", () => {
            modal.classList.toggle("is-fullscreen");
            
            // Даем браузеру 100мс на применение CSS-стилей, затем заставляем график перерисоваться
            setTimeout(() => {
                if (systemChartInstance) {
                    systemChartInstance.resize();
                }
            }, 100);
        });
    }

    if (menuBtn) menuBtn.addEventListener("click", showModal);
    if (closeBtn) closeBtn.addEventListener("click", hideModal);
    if (closeFooterBtn) closeFooterBtn.addEventListener("click", hideModal);
    if (overlay) overlay.addEventListener("click", hideModal);
    if (updateBtn) updateBtn.addEventListener("click", buildChartFromLastCalculation);

    console.log("✅ Обработчики модального окна графика инициализированы");
}

// Автоматическая инициализация при загрузке DOM
document.addEventListener("DOMContentLoaded", initChartModal);