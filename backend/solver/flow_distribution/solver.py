# ============================================================================
# solver.py (ЧИСТАЯ ВЕРСИЯ)
# ============================================================================
import time
import numpy as np
import jax
import jax.numpy as jnp
import jaxopt
from scipy.optimize import brentq

jax.config.update("jax_enable_x64", True)


class MonolithCore:
    """Численное ядро гидравлического расчёта."""

    def __init__(self, builder):
        self.builder = builder

        # Матрицы и векторы
        self.R = builder.R
        self.C = builder.C
        self.S = builder.S
        self.K_out = builder.K_out
        self.Hst = builder.Hst
        self.Lambda = builder.Lambda
        self.kvelocity = builder.kvelocity

        # Размерности
        self.n = builder.N
        self.m = builder.M
        self.n_out = builder.n_out
        self.n_in = builder.n_in

        # Срезы
        self.q_slice = builder.q_slice
        self.p_slice = builder.p_slice
        self.qout_slice = builder.qout_slice
        self.qin_slice = builder.qin_slice

        # Потребители
        self.consumer_array = builder.consumer_array
        self.consumer_list = builder.consumer_list
        self.source_indices = jnp.array(builder.source_indices, dtype=jnp.int32)

        # Параметры
        self.pressure_target = builder.pressure_target
        self.num_vars = builder.num_vars

        # Функция невязок
        self.residuals_fun = builder.residuals_fun

        # Решатель
        self.lm_solver = jaxopt.LevenbergMarquardt(
            residual_fun=self.residuals_fun,
            tol=1e-9,
            maxiter=200  # Увеличили для больших сетей
        )
        self.solve_compiled = jax.jit(self.lm_solver.run)

    def solve_network(self, P_sources, x0):
        result = self.solve_compiled(x0, P_sources)
        result.params.block_until_ready()
        return np.array(result.params)

    def split_solution(self, X):
        X = np.asarray(X)
        Q = X[self.q_slice]
        P = X[self.p_slice]
        Qout = X[self.qout_slice]
        Qin = X[self.qin_slice]
        return Q, P, Qout, Qin


def run_calculation(builder):
    calc_start = time.perf_counter()
    core = MonolithCore(builder)

    # =================================================================
    # УЛУЧШЕННОЕ НАЧАЛЬНОЕ ПРИБЛИЖЕНИЕ ДЛЯ БОЛЬШИХ СЕТЕЙ
    # =================================================================
    X0 = jnp.ones(core.num_vars)

    # Расходы в трубах: 0 (нейтральное начало)
    X0 = X0.at[core.q_slice].set(0.0)

    # Давления в узлах: константа 50 м
    X0 = X0.at[core.p_slice].set(50.0)

    # Расходы потребителей: K * sqrt(50)
    P_init = 50.0
    Qout_init = builder.K_out * np.sqrt(P_init)
    X0 = X0.at[core.qout_slice].set(Qout_init)

    # Расходы источников: сумма всех Qout
    Qin_init = np.sum(Qout_init) / max(builder.n_in, 1)
    X0 = X0.at[core.qin_slice].set(Qin_init)

    # Начальные давления источников
    P_sources_initial = jnp.full(core.n_in, 100000.0)

    # =================================================================
    # ЭТАП 1: ПРОБНЫЙ РАСЧЁТ
    # =================================================================
    t1_start = time.perf_counter()
    print("[Этап 1] Пробный расчёт сети...")

    X_stage1 = core.solve_network(P_sources_initial, x0=X0)
    t1_time = time.perf_counter() - t1_start

    Q_stage1, P_stage1, Qout_stage1, Qin_stage1 = core.split_solution(X_stage1)

    P_spr = P_stage1[core.consumer_array]
    dictating_idx = core.consumer_list[int(np.argmin(P_spr))]

    print(f"  Минимальное давление: {np.min(P_spr):.4f} м")
    print(f"  Максимальное давление: {np.max(P_stage1):.4f} м")
    print(f"  Давление на диктующем оросителе: {P_spr[int(np.argmin(P_spr))]:.4f} м")

    # =================================================================
    # ЦЕЛЕВАЯ ФУНКЦИЯ
    # =================================================================
    def objective(P_sources_guess):
        X = core.solve_network(P_sources_guess, x0=X_stage1)
        _, P_curr, _, _ = core.split_solution(X)
        P_spr_curr = P_curr[core.consumer_array]
        return float(np.min(P_spr_curr)) - core.pressure_target

    # =================================================================
    # ЭТАП 2: ПОДБОР ДАВЛЕНИЙ ИСТОЧНИКОВ
    # =================================================================
    t2_start = time.perf_counter()
    print("[Этап 2] Подбор давлений источников...")

    if core.n_in == 1:
        P_low = 10.0
        P_high = 300.0
        MAX_P = 1000000.0

        f_low = objective(P_low)
        f_high = objective(P_high)

        print(f"  f({P_low}) = {f_low:.4f}")
        print(f"  f({P_high}) = {f_high:.4f}")

        # Адаптивный поиск интервала
        for i in range(50):
            if f_low * f_high < 0:
                print(f"  Смена знака найдена на итерации {i}")
                break

            if f_low > 0:
                # Даже при P_low давление слишком высокое — уменьшаем
                P_low = max(P_low * 0.5, 1.0)
                f_low = objective(P_low)
                print(f"  Итерация {i}: P_low={P_low:.1f}, f_low={f_low:.4f}")
            elif f_high < 0:
                # Даже при P_high давление слишком низкое — увеличиваем
                P_high *= 2.0
                if P_high > MAX_P:
                    print(f"  ВНИМАНИЕ: P_high достиг максимума {MAX_P}")
                    P_high = MAX_P
                    f_high = objective(P_high)
                    break
                f_high = objective(P_high)
                print(f"  Итерация {i}: P_high={P_high:.1f}, f_high={f_high:.4f}")
            else:
                break

        if f_low * f_high < 0:
            P_sources_optimal = brentq(
                objective, P_low, P_high, xtol=1e-6, maxiter=100
            )
            print(f"  Найден корень: P_optimal = {P_sources_optimal:.4f} м")
        else:
            print(f"  ВНИМАНИЕ: корень не найден! f_low={f_low:.4f}, f_high={f_high:.4f}")
            print(f"  Используем P_high = {P_high}")
            P_sources_optimal = P_high
    else:
        # Несколько источников — масштабирование
        scale_low = 0.1
        scale_high = 3.0
        MAX_SCALE = 10.0

        f_low = objective(P_sources_initial * scale_low)
        f_high = objective(P_sources_initial * scale_high)

        for i in range(50):
            if f_low * f_high < 0:
                break
            if f_low > 0:
                scale_low *= 0.5
                f_low = objective(P_sources_initial * scale_low)
            elif f_high < 0:
                scale_high *= 1.5
                if scale_high > MAX_SCALE:
                    scale_high = MAX_SCALE
                    f_high = objective(P_sources_initial * scale_high)
                    break
                f_high = objective(P_sources_initial * scale_high)

        if f_low * f_high < 0:
            scale_opt = np.sqrt(scale_low * scale_high)
            P_sources_optimal = P_sources_initial * scale_opt
        else:
            print(f"  ВНИМАНИЕ: корень не найден для нескольких источников")
            P_sources_optimal = P_sources_initial * scale_high

    t2_time = time.perf_counter() - t2_start

    # =================================================================
    # ФИНАЛЬНЫЙ РАСЧЁТ
    # =================================================================
    t3_start = time.perf_counter()
    X_final = core.solve_network(P_sources_optimal, x0=X_stage1)
    t3_time = time.perf_counter() - t3_start

    Q_final, P_final, Qout_final, Qin_final = core.split_solution(X_final)

    # Скорости
    V_final = builder.calculate_velocities(Q_final)

    # =================================================================
    # ПАРАМЕТРЫ ХАРАКТЕРИСТИКИ СЕТИ
    # =================================================================
    min_P = float(np.min(P_final[core.consumer_array]))
    H_max = float(np.max(builder.Hst))
    Q_total = float(np.sum(Qin_final))

    first_source_idx = builder.source_indices[0]
    H_source = float(P_final[first_source_idx] + builder.Hst[first_source_idx])

    if Q_total > 1e-6:
        K_system = (H_source - H_max) / (Q_total ** 2)
    else:
        K_system = 0.0

    # Невязка
    residuals_final = core.residuals_fun(
        jnp.asarray(X_final),
        jnp.asarray(P_sources_optimal)
    )
    residuals_final_np = np.asarray(residuals_final)
    residual_norm = float(np.linalg.norm(residuals_final_np))
    max_residual = float(np.max(np.abs(residuals_final_np)))

    calc_time_s = time.perf_counter() - calc_start

    print("\n" + "=" * 60)
    print("РАСЧЁТ ЗАВЕРШЁН")
    print("=" * 60)
    print(f"  Время расчёта: {calc_time_s:.6f} с")
    print(f"  Норма невязки ||F||: {residual_norm:.3e}")
    print(f"  Максимальная невязка: {max_residual:.3e}")
    print(f"  Минимальное давление на оросителях: {min_P:.4f} м")
    print(f"  Целевое давление: {core.pressure_target:.4f} м")
    print(f"  Суммарный расход источников: {Q_total:.4f} л/с")
    print(f"  H_max: {H_max:.4f} м")
    print(f"  H_source: {H_source:.4f} м")
    print(f"  K_system: {K_system:.8f}")

    for k, source_idx in enumerate(builder.source_indices):
        source_uuid = builder.idx_to_node_uuid[source_idx]
        print(f"  Источник {source_uuid}: P={P_final[source_idx]:.4f} м, Qin={Qin_final[k]:.4f} л/с")

    if residual_norm > 1e-3:
        print(f"\n  ⚠️ ВНИМАНИЕ: высокая невязка! Система могла не сойтись.")
    if min_P < 0:
        print(f"\n  ⚠️ ВНИМАНИЕ: отрицательные давления!")

    return {
        "X": X_final,
        "Q_pipes": Q_final,
        "P_nodes": P_final,
        "Q_sprinklers": Qout_final,
        "Q_sources": Qin_final,
        "V_pipes": V_final,
        "P_sources": P_sources_optimal,
        "dictating_idx": dictating_idx,
        "K_system": K_system,
        "H_max": H_max,
        "Q_total": Q_total,
        "min_pressure": min_P,
        "residual_norm": residual_norm,
        "max_residual": max_residual,
        "timing": {
            "stage1_s": round(t1_time, 6),
            "source_search_s": round(t2_time, 6),
            "final_solve_s": round(t3_time, 6),
            "total_s": round(calc_time_s, 6),
        },
    }