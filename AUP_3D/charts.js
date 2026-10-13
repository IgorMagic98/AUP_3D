// ============================================================================
// charts.js — Построение гидравлической характеристики системы (без насоса)
// Зависимости: Chart.js (подключен в index.html)
// ============================================================================

let systemChartInstance = null;

/**
 * Построение графика характеристики системы
 * H = Z_max + K_system * Q^2
 * 
 * @param {Object} data - данные для построения
 * @param {number} data.K_system - коэффициент сопротивления системы
 * @param {number} data.Z_max - максимальная геодезическая отметка (м)
 * @param {number} [data.Q_total] - текущий расход системы (л/с) — для отметки рабочей точки
 * @param {number} [data.H_source] - текущий напор источника (м) — для отметки рабочей точки
 */
function buildHydraulicChart(data) {
    const { K_system, Z_max, Q_total, H_source } = data;

    if (K_system === undefined || Z_max === undefined) {
        console.error("❌ Не переданы K_system или Z_max");
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
    // Генерация точек для параболы системы: H = Z_max + K_system * Q^2
    // =========================================================================
    const Q_data = [];
    const H_system = [];

    // Если Q_total = 0, используем разумный диапазон
    const maxQ = Q_total > 0 ? Math.max(Q_total * 1.5, 5) : 20;
    const step = maxQ / 50; // 50 точек для плавности

    console.log(`📊 Генерация графика: maxQ=${maxQ.toFixed(2)}, step=${step.toFixed(3)}`);

    for (let Q = 0; Q <= maxQ; Q += step) {
        Q_data.push(parseFloat(Q.toFixed(3)));
        const H = Z_max + K_system * Q * Q;
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
                        text: "Расход Q, л/с",
                        font: { size: 13, weight: "bold" },
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
                        text: "Напор H, м.вод.ст.",
                        font: { size: 13, weight: "bold" },
                    },
                    min: 0,
                    max: Math.max(H_source * 1.2, Z_max * 1.5, 50),
                    grid: {
                        color: "rgba(0, 0, 0, 0.05)",
                    },
                },
            },
        },
    });

    console.log(`✅ График построен: K_system=${K_system.toFixed(6)}, Z_max=${Z_max.toFixed(2)} м, maxQ=${maxQ.toFixed(2)}`);
}

/**
 * Построение графика на основе данных из последнего расчета (глобальные переменные)
 * Вызывается при клике на кнопку "📈 Характеристика системы"
 */
function buildChartFromLastCalculation() {
    // Данные берутся из глобальных переменных, которые устанавливаются
    // после успешного расчета в new.js (window.lastCalculationResult)
    const data = window.lastCalculationResult || {};

    if (!data.K_system || !data.Z_max) {
        console.warn("⚠️ Нет данных последнего расчета. Используются значения по умолчанию.");
        buildHydraulicChart({
            K_system: 0.025,
            Z_max: 0,
            Q_total: 10,
            H_source: 30,
        });
        return;
    }

    buildHydraulicChart({
        K_system: data.K_system,
        Z_max: data.Z_max,
        Q_total: data.Q_total,
        H_source: data.H_source,
    });
}

/**
 * Инициализация обработчиков событий для модального окна графика
 * Вызывается один раз при загрузке страницы
 */
function initChartModal() {
    const menuBtn = document.getElementById("menuShowSystemCurve");
    const modal = document.getElementById("chartModal");
    const overlay = document.getElementById("chartOverlay");
    const closeBtn = document.getElementById("closeChartBtn");
    const closeFooterBtn = document.getElementById("closeChartFooterBtn");
    const updateBtn = document.getElementById("updateChartBtn");

    function showModal() {
        if (!modal || !overlay) return;
        modal.style.display = "block";
        overlay.style.display = "block";
        // Небольшая задержка, чтобы Canvas успел получить размеры
        setTimeout(buildChartFromLastCalculation, 50);
    }

    function hideModal() {
        if (!modal || !overlay) return;
        modal.style.display = "none";
        overlay.style.display = "none";
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