# import time
# import jax
# import jax.numpy as jnp
# import numpy as np
# import jaxopt
# from scipy.optimize import brentq

# jax.config.update("jax_enable_x64", True)

# PRESSURE_TARGET = 19.17


# class MonolithCore:
#     """
#     Монолитное JAX-ядро: JIT-компиляция ОДИН РАЗ, потом мгновенные вызовы.
#     """

#     def __init__(self, builder):
#         self.R = builder.R
#         self.S_dense = builder.S_dense
#         self.K_dense = builder.K_dense
#         self.Z = builder.Z
#         self.Lambda = builder.Lambda

#         self.n = builder.N
#         self.m = builder.M
#         self.consumer_list = builder.consumer_list
#         self.source_idx = builder.source_idx
#         self.Pmin_target = PRESSURE_TARGET

#         # Функция невязок (принимает X и P_source)
#         def residuals_fun(X, P_source):
#             Q = X[0:self.m]
#             P = X[self.m:self.m + self.n]

#             # Баланс массы: R·Q + Qout + S·Qin = 0
#             P_safe = jnp.maximum(P, 1e-6)
#             Qout_full = self.K_dense * jnp.sqrt(P_safe)
#             mass = jnp.dot(self.R, Q) + Qout_full + self.S_dense * Q[0]

#             # Замена уравнения узла-источника на P[0] = P_source
#             if self.source_idx is not None:
#                 mass = mass.at[self.source_idx].set(P[self.source_idx] - P_source)

#             # Баланс энергии: R^T·P - Lambda·Q·|Q| + R^T·Z = 0
#             hf = self.Lambda * Q * jnp.abs(Q)
#             hst = jnp.dot(self.R.T, self.Z)
#             energy = jnp.dot(self.R.T, P) - hf + hst

#             return jnp.concatenate([mass, energy])

#         # Levenberg-Marquardt с JIT
#         self.lm_solver = jaxopt.LevenbergMarquardt(
#             residual_fun=residuals_fun,
#             tol=1e-9,
#             maxiter=50
#         )
#         self.solve_compiled = jax.jit(self.lm_solver.run)

#     def solve_network(self, P_source, x0):
#         result = self.solve_compiled(x0, P_source)
#         result.params.block_until_ready()
#         return np.array(result.params)


# def run_calculation(builder):
#     """Двухэтапный алгоритм: поиск диктующего + подбор P_source."""
#     core = MonolithCore(builder)

#     # Начальное приближение
#     num_vars = core.m + core.n
#     X0 = jnp.ones(num_vars)
#     X0 = X0.at[0:core.m].set(2.0)
#     X0 = X0.at[core.m:].set(50.0)

#     # ЭТАП 1: Поиск диктующего оросителя при P_source = 50 м
#     P_test = 50.0
#     X_stage1 = core.solve_network(P_test, X0)

#     P_stage1 = X_stage1[core.m:core.m + core.n]
#     P_spr = P_stage1[core.consumer_list]
#     dictating_idx = core.consumer_list[int(np.argmin(P_spr))]

#     # ЭТАП 2: Подбор P_source через brentq
#     def objective(P_source_guess):
#         X = core.solve_network(P_source_guess, x0=X_stage1)
#         P_curr = X[core.m:core.m + core.n]
#         return float(np.min(P_curr[core.consumer_list])) - PRESSURE_TARGET

#     # Адаптивный поиск диапазона
#     P_low, P_high = 10.0, P_test + 50.0
#     f_low, f_high = objective(P_low), objective(P_high)

#     for _ in range(30):
#         if f_low * f_high < 0:
#             break
#         if abs(f_low) < abs(f_high):
#             P_low = max(P_low * 0.5, 0.5)
#             f_low = objective(P_low)
#         else:
#             P_high *= 2.0
#             f_high = objective(P_high)

#     if f_low * f_high < 0:
#         P_optimal = brentq(objective, P_low, P_high, xtol=1e-6)
#     else:
#         P_optimal = P_high

#     # Финальный расчёт
#     X_final = core.solve_network(P_optimal, x0=X_stage1)
#     Q_final = X_final[0:core.m]
#     P_final = X_final[core.m:core.m + core.n]

#     return Q_final, P_final, P_optimal, dictating_idx

import time
import jax
import jax.numpy as jnp
import numpy as np
import jaxopt
from scipy.optimize import brentq
# ============================================================================
# solver.py
# ============================================================================
# Численное решение гидравлической сети.
#
# Модель и уравнения формируются в system_builder.py.
# Здесь выполняются:
#     1. Решение нелинейной системы методом Левенберга-Марквардта.
#     2. Подбор давления источников для обеспечения
#        минимального давления на оросителях.
#     3. Возврат расходов, давлений, скоростей
#        и параметров характеристики сети.
# ============================================================================

import time
import numpy as np
import jax
import jax.numpy as jnp
import jaxopt
from scipy.optimize import brentq

# Включаем 64-битную арифметику JAX
jax.config.update("jax_enable_x64", True)


# ============================================================================
# КЛАСС MonolithCore
# ============================================================================
class MonolithCore:
    """
    Численное ядро гидравлического расчёта.
    """

    def __init__(self, builder):
        """
        Параметры:
            builder — объект HydraulicSystemBuilder,
                      в котором уже вызваны:
                          build_graph()
                          build_matrices()
        """

        self.builder = builder

        # --------------------------------------------------------------------
        # ПАРАМЕТРЫ МОДЕЛИ
        # --------------------------------------------------------------------
        self.R = builder.R
        self.C = builder.C
        self.S = builder.S

        self.K_out = builder.K_out
        self.Hst = builder.Hst
        self.Lambda = builder.Lambda
        self.Kvelocity = builder.Kvelocity

        # --------------------------------------------------------------------
        # РАЗМЕРНОСТИ
        # --------------------------------------------------------------------
        self.n = builder.N          # количество узлов
        self.m = builder.M          # количество труб
        self.n_out = builder.n_out  # количество потребителей
        self.n_in = builder.n_in    # количество источников

        # --------------------------------------------------------------------
        # СРЕЗЫ ВЕКТОРА НЕИЗВЕСТНЫХ
        # --------------------------------------------------------------------
        self.q_slice = builder.q_slice
        self.p_slice = builder.p_slice
        self.qout_slice = builder.qout_slice
        self.qin_slice = builder.qin_slice

        # --------------------------------------------------------------------
        # ПОТРЕБИТЕЛИ
        # --------------------------------------------------------------------
        self.consumer_array = builder.consumer_array
        self.consumer_list = builder.consumer_list

        # --------------------------------------------------------------------
        # ПАРАМЕТРЫ РАСЧЁТА
        # --------------------------------------------------------------------
        self.pressure_target = builder.pressure_target
        self.num_vars = builder.num_vars

        # --------------------------------------------------------------------
        # ФУНКЦИЯ НЕВЯЗОК ИЗ BUILDER
        # --------------------------------------------------------------------
        self.residuals_fun = builder.residuals_fun

        # --------------------------------------------------------------------
        # РЕШАТЕЛЬ ЛЕВЕНБЕРГА-МАРКВАРДТА
        # --------------------------------------------------------------------
        self.lm_solver = jaxopt.LevenbergMarquardt(
            residual_fun=self.residuals_fun,
            tol=1e-12,
            maxiter=1000
        )

        # JIT-компиляция решателя
        self.solve_compiled = jax.jit(self.lm_solver.run)

    # =========================================================================
    # РЕШЕНИЕ СЕТИ ПРИ ЗАДАННЫХ ДАВЛЕНИЯХ ИСТОЧНИКОВ
    # =========================================================================
    def solve_network(self, P_sources, x0):
        """
        Решает сеть при заданных давлениях источников.

        Параметры:
            P_sources — скаляр или вектор давлений источников;
            x0 — начальное приближение вектора неизвестных.

        Возвращает:
            X — NumPy-массив [Q, P, Qout, Qin].
        """

        result = self.solve_compiled(x0, P_sources)

        # Синхронизация JAX-вычислений
        result.params.block_until_ready()

        return np.array(result.params)

    # =========================================================================
    # РАЗДЕЛЕНИЕ РЕЗУЛЬТАТА НА БЛОКИ
    # =========================================================================
    def split_solution(self, X):
        """
        Разделяет вектор решения на отдельные блоки.

        Возвращает:
            Q    — расходы труб;
            P    — давления узлов;
            Qout — расходы потребителей;
            Qin  — расходы источников.
        """

        X = np.asarray(X)

        Q = X[self.q_slice]
        P = X[self.p_slice]
        Qout = X[self.qout_slice]
        Qin = X[self.qin_slice]

        return Q, P, Qout, Qin


# ============================================================================
# ГЛАВНАЯ ФУНКЦИЯ РАСЧЁТА
# ============================================================================
def run_calculation(builder):
    """
    Выполняет полный расчёт сети.

    Алгоритм:
        1. Пробное решение при заданных давлениях источников.
        2. Поиск диктующего оросителя.
        3. Подбор давления источников так, чтобы минимальное давление
           на оросителях стало равным PRESSURE_TARGET.
        4. Финальное решение и расчёт скоростей.

    Возвращает:
        dict с результатами расчёта.
    """
    calc_start = time.perf_counter()
    
    # Создаём численное ядро
    core = MonolithCore(builder)

    # --------------------------------------------------------------------
    # НАЧАЛЬНОЕ ПРИБЛИЖЕНИЕ
    # --------------------------------------------------------------------
    X0 = jnp.ones(core.num_vars)

    # Расходы в трубах
    X0 = X0.at[core.q_slice].set(5.0)

    # Давления в узлах
    P_init = jnp.linspace(100.0, 30.0, core.n)
    X0 = X0.at[core.p_slice].set(P_init)

    # Расходы потребителей
    X0 = X0.at[core.qout_slice].set(2.0)

    # Расходы источников
    X0 = X0.at[core.qin_slice].set(10.0)

    # --------------------------------------------------------------------
    # НАЧАЛЬНЫЕ ДАВЛЕНИЯ ИСТОЧНИКОВ
    # --------------------------------------------------------------------
    # Для одного источника — скаляр.
    # Для нескольких — вектор.
    if core.n_in == 1:
        P_sources_initial = jnp.array(100.0)
    else:
        P_sources_initial = jnp.full(core.n_in, 100.0)

    # --------------------------------------------------------------------
    # ЭТАП 1: ПРОБНЫЙ РАСЧЁТ
    # --------------------------------------------------------------------
    t1_start = time.perf_counter()
    print("[Этап 1] Пробный расчёт сети...")    

    X_stage1 = core.solve_network(
        P_sources_initial,
        x0=X0
    )
    t1_time = time.perf_counter() - t1_start

    Q_stage1, P_stage1, Qout_stage1, Qin_stage1 = (
        core.split_solution(X_stage1)
    )

    # Давления только в оросителях
    P_spr = P_stage1[core.consumer_array]

    # Диктующий ороситель — с минимальным давлением
    dictating_idx = core.consumer_list[
        int(np.argmin(P_spr))
    ]

    print(f"  Минимальное давление: {np.min(P_spr):.4f} м")
    print(f"  Максимальное давление: {np.max(P_stage1):.4f} м")

    # --------------------------------------------------------------------
    # ЦЕЛЕВАЯ ФУНКЦИЯ ДЛЯ ПОДБОРА ДАВЛЕНИЙ ИСТОЧНИКОВ
    # --------------------------------------------------------------------
    def objective(P_sources_guess):
        """
        Возвращает отклонение минимального давления на оросителях
        от целевого значения.

        f(P_sources) = min(P_оросителей) - PRESSURE_TARGET
        """

        X = core.solve_network(
            P_sources_guess,
            x0=X_stage1
        )

        _, P_curr, _, _ = core.split_solution(X)

        P_spr_curr = P_curr[core.consumer_array]

        return float(
            np.min(P_spr_curr)
        ) - core.pressure_target

    # --------------------------------------------------------------------
    # ЭТАП 2: ПОДБОР ДАВЛЕНИЙ ИСТОЧНИКОВ
    # --------------------------------------------------------------------
    t2_start = time.perf_counter()
    print("[Этап 2] Подбор давлений источников...")

    # Для одного источника используем brentq.
    # Для нескольких источников нужен многомерный поиск,
    # поэтому пока применяем равномерное масштабирование давления.
    if core.n_in == 1:

        P_low = 20.0
        P_high = 200.0
        MAX_P = 500.0

        f_low = objective(P_low)
        f_high = objective(P_high)

        print(
            f"  f({P_low}) = {f_low:.4f}, "
            f"f({P_high}) = {f_high:.4f}"
        )

        # Поиск интервала со сменой знака
        for i in range(30):

            if f_low * f_high < 0:
                break

            if abs(f_low) < abs(f_high):
                P_low = max(P_low * 0.5, 1.0)
                f_low = objective(P_low)
            else:
                P_high *= 1.5

                if P_high > MAX_P:
                    P_high = MAX_P
                    f_high = objective(P_high)
                    break

        if f_low * f_high < 0:
            P_sources_optimal = brentq(
                objective,
                P_low,
                P_high,
                xtol=1e-6
            )
        else:
            print(
                "  ВНИМАНИЕ: интервал со сменой знака не найден."
            )
            P_sources_optimal = P_high

    else:
        # Для нескольких источников: равномерно масштабируем
        # все давления относительно начального значения.
        scale_low = 0.2
        scale_high = 2.0
        MAX_SCALE = 5.0

        f_low = objective(
            P_sources_initial * scale_low
        )
        f_high = objective(
            P_sources_initial * scale_high
        )

        for i in range(30):

            if f_low * f_high < 0:
                break

            if abs(f_low) < abs(f_high):
                scale_low *= 0.5
                f_low = objective(
                    P_sources_initial * scale_low
                )
            else:
                scale_high *= 1.5

                if scale_high > MAX_SCALE:
                    scale_high = MAX_SCALE
                    f_high = objective(
                        P_sources_initial * scale_high
                    )
                    break

        if f_low * f_high < 0:
            # Для векторного случая нужен многомерный корневой поиск.
            # Здесь используется среднее геометрическое границ
            # как первое приближение.
            scale_opt = np.sqrt(scale_low * scale_high)

            P_sources_optimal = (
                P_sources_initial * scale_opt
            )
        else:
            print(
                "  ВНИМАНИЕ: интервал со сменой знака не найден."
            )
            P_sources_optimal = (
                P_sources_initial * scale_high
            )
            t2_time = time.perf_counter() - t2_start

    # --------------------------------------------------------------------
    # ФИНАЛЬНЫЙ РАСЧЁТ
    # --------------------------------------------------------------------
    t3_start = time.perf_counter()
    X_final = core.solve_network(
        P_sources_optimal,
        x0=X_stage1
    )
    t3_time = time.perf_counter() - t3_start

    Q_final, P_final, Qout_final, Qin_final = (
        core.split_solution(X_final)
    )

    # --------------------------------------------------------------------
    # СКОРОСТИ В ТРУБАХ
    # --------------------------------------------------------------------
    V_final = builder.calculate_velocities(Q_final)

    # --------------------------------------------------------------------
    # ПАРАМЕТРЫ ХАРАКТЕРИСТИКИ СЕТИ
    # --------------------------------------------------------------------
    min_P = float(
        np.min(P_final[core.consumer_array])
    )

    H_max = float(np.max(builder.Hst))

    # Для одного источника — его расход.
    # Для нескольких — суммарный расход.
    Q_total = float(np.sum(Qin_final))

    # Пьезометрический напор первого источника
    first_source_idx = builder.source_indices[0]
    H_source = float(
        P_final[first_source_idx]
        + builder.Hst[first_source_idx]
    )

    # Коэффициент сопротивления системы:
    #     H = Z_max + K_system * Q_total²
    if Q_total > 1e-6:
        K_system = (
            (H_source - H_max)
            / (Q_total ** 2)
        )
    else:
        K_system = 0.0
        
    # ----------------------------------------------------------------
    # НЕВЯЗКА
    # ----------------------------------------------------------------
    residuals_final = core.residuals_fun(
        jnp.asarray(X_final),
        jnp.asarray(P_sources_optimal)
    )

    residuals_final_np = np.asarray(residuals_final)

    residual_norm = float(
        np.linalg.norm(residuals_final_np)
    )

    max_residual = float(
        np.max(np.abs(residuals_final_np))
    )

    # ----------------------------------------------------------------
    # ВРЕМЯ
    # ----------------------------------------------------------------
    calc_time_s = time.perf_counter() - calc_start

    print("\nРасчёт завершён:")
    print(f"  Время расчёта: {calc_time_s:.6f} с")
    print(f"  Норма невязки ||F||: {residual_norm:.3e}")
    print(f"  Максимальная невязка: {max_residual:.3e}")

    # --------------------------------------------------------------------
    # ИТОГОВЫЙ ВЫВОД
    # --------------------------------------------------------------------
    print("\nРасчёт завершён:")
    print(f"  Минимальное давление на оросителях: {min_P:.4f} м")
    print(f"  Суммарный расход источников: {Q_total:.4f} л/с")
    print(f"  Z_max: {Z_max:.4f} м")
    print(f"  K_system: {K_system:.8f}")

    for k, source_idx in enumerate(builder.source_indices):
        source_uuid = builder.idx_to_node_uuid[source_idx]

        print(
            f"  Источник {source_uuid}: "
            f"P = {P_final[source_idx]:.4f} м, "
            f"Qin = {Qin_final[k]:.4f} л/с"
        )     
    
    # --------------------------------------------------------------------
    # ВОЗВРАТ РЕЗУЛЬТАТОВ
    # --------------------------------------------------------------------
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
            "total_s": round(calc_time_s, 6)}
    }
jax.config.update("jax_enable_x64", True)

PRESSURE_TARGET = 18.15


class MonolithCore:
    def __init__(self, builder):
        print("ЖОПА",builder)
        self.R = builder.R
        self.S = builder.S
        self.K = builder.K_out
        self.Z = builder.Hst
        self.Lambda = builder.Lambda

        self.n = builder.N
        self.m = builder.M
        # ✅ ИСПРАВЛЕНО: используем jnp.array вместо tuple
        self.consumer_array = jnp.array(builder.consumer_list, dtype=jnp.int32)
        self.consumer_list = builder.consumer_list  # оставляем для совместимости
        self.source_idx = builder.source_indices 
        self.Pmin_target = PRESSURE_TARGET

        def residuals_fun(X, P_source):
            Q = X[0:self.m]
            P = X[self.m:self.m + self.n]

            P_safe = jnp.maximum(P, 1e-6)
            Qout_full = self.K * jnp.sqrt(P_safe)
            mass = -jnp.dot(self.R, Q) - Qout_full
            
            if self.source_idx is not None:
                mass = mass.at[self.source_idx].set(P[self.source_idx] - P_source)

            hf = self.Lambda * Q * jnp.abs(Q)
            hst = jnp.dot(self.R.T, self.Z)
            energy = jnp.dot(self.R.T, P) - hf + hst

            return jnp.concatenate([mass, energy])

        self.lm_solver = jaxopt.LevenbergMarquardt(
            residual_fun=residuals_fun,
            tol=1e-9,
            maxiter=100
        )
        self.solve_compiled = jax.jit(self.lm_solver.run)

    def solve_network(self, P_source, x0):
        result = self.solve_compiled(x0, P_source)
        result.params.block_until_ready()
        return np.array(result.params)


def run_calculation(builder):
    core = MonolithCore(builder)

    num_vars = core.m + core.n
    X0 = jnp.ones(num_vars)
    X0 = X0.at[0:core.m].set(5.0)
    P_init = jnp.linspace(100.0, 30.0, core.n)
    X0 = X0.at[core.m:].set(P_init)

    P_test = 100.0
    print(f"[Этап 1] Расчет при P_source = {P_test} м...")
    X_stage1 = core.solve_network(P_test, X0)

    P_stage1 = X_stage1[core.m:core.m + core.n]
    Q_stage1 = X_stage1[0:core.m]
    
    # ✅ ИСПРАВЛЕНО: используем consumer_array
    P_spr = P_stage1[core.consumer_array]
    dictating_idx = core.consumer_list[int(np.argmin(P_spr))]
    
    print(f"  Минимальное давление: {np.min(P_spr):.2f} м")
    print(f"  Максимальное давление: {np.max(P_stage1):.2f} м")

    def objective(P_source_guess):
        X = core.solve_network(P_source_guess, x0=X_stage1)
        P_curr = X[core.m:core.m + core.n]
        # ✅ ИСПРАВЛЕНО
        return float(np.min(P_curr[core.consumer_array])) - PRESSURE_TARGET

    P_low, P_high = 20.0, P_test + 100.0
    f_low, f_high = objective(P_low), objective(P_high)

    print(f"[Этап 2] Подбор P_source...")
    print(f"  f({P_low}) = {f_low:.2f}, f({P_high}) = {f_high:.2f}")

    for i in range(30):
        if f_low * f_high < 0:
            print(f"  Смена знака найдена на итерации {i}")
            break
        if abs(f_low) < abs(f_high):
            P_low = max(P_low * 0.5, 1.0)
            f_low = objective(P_low)
        else:
            P_high *= 2.0
            f_high = objective(P_high)
        print(f"  Итерация {i}: [{P_low:.1f}, {P_high:.1f}], f_low={f_low:.2f}, f_high={f_high:.2f}")

    if f_low * f_high < 0:
        P_optimal = brentq(objective, P_low, P_high, xtol=1e-6)
    else:
        print(f"  ️ Смена знака не найдена! Используем P_high = {P_high}")
        P_optimal = P_high

    X_final = core.solve_network(P_optimal, x0=X_stage1)
    Q_final = X_final[0:core.m]
    P_final = X_final[core.m:core.m + core.n]

    # =====================================================================
    # РАСЧЕТ ПАРАМЕТРОВ ДЛЯ ГРАФИКА
    # =====================================================================
    H = float(P_optimal)
    H_max = float(np.max(builder.Z))
    
    # ✅ ИСПРАВЛЕНО: используем consumer_array
    P_sprinklers_final = P_final[core.consumer_array]
    K_sprinklers = builder.K_out[core.consumer_array]
    Q_total = float(np.sum(K_sprinklers * np.sqrt(np.maximum(P_sprinklers_final, 0.0))))
    
    if Q_total > 1e-6:
        K_system = (H - H_max) / (Q_total ** 2)
    else:
        K_system = 0.0

    # ✅ ИСПРАВЛЕНО
    min_P = np.min(P_final[core.consumer_array])
    print(f"\n✅ Расчет завершен:")
    print(f"  P_source (H) = {H:.2f} м")
    print(f"  H_max = {H_max:.2f} м")
    print(f"  Q_total = {Q_total:.2f} л/с")
    print(f"  📊 Расчетный K_system = {K_system:.6f}")
    print(f"  Минимальное давление на оросителях: {min_P:.2f} м")
    
    if min_P < 0:
        print(f"  ⚠️ ВНИМАНИЕ: Отрицательные давления! Система не сошлась.")
    
    return Q_final, P_final, P_optimal, dictating_idx, K_system, Z_max