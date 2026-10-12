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

jax.config.update("jax_enable_x64", True)

PRESSURE_TARGET = 19.17


class MonolithCore:
    def __init__(self, builder):
        self.R = builder.R
        self.S_dense = builder.S_dense
        self.K_dense = builder.K_dense
        self.Z = builder.Z
        self.Lambda = builder.Lambda

        self.n = builder.N
        self.m = builder.M
        self.consumer_list = builder.consumer_list
        self.source_idx = builder.source_idx
        self.Pmin_target = PRESSURE_TARGET

        def residuals_fun(X, P_source):
            Q = X[0:self.m]
            P = X[self.m:self.m + self.n]

            # Баланс массы: R·Q + Qout + S·Qin = 0
            # ВАЖНО: Qout = K·√P, поэтому P должно быть > 0
            P_safe = jnp.maximum(P, 1e-6)
            Qout_full = self.K_dense * jnp.sqrt(P_safe)
            
            # R·Q дает (приток - отток) по трубам
            # Для баланса: (отток по трубам) + (отток в оросители) = 0
            # Отток по трубам = -(R·Q)
            mass = -jnp.dot(self.R, Q) - Qout_full
            
            # Замена уравнения узла-источника на P[source] = P_source
            if self.source_idx is not None:
                mass = mass.at[self.source_idx].set(P[self.source_idx] - P_source)

            # Баланс энергии: R^T·P - Lambda·Q·|Q| + R^T·Z = 0
            hf = self.Lambda * Q * jnp.abs(Q)
            hst = jnp.dot(self.R.T, self.Z)
            energy = jnp.dot(self.R.T, P) - hf + hst

            return jnp.concatenate([mass, energy])

        self.lm_solver = jaxopt.LevenbergMarquardt(
            residual_fun=residuals_fun,
            tol=1e-9,
            maxiter=100  # Увеличили с 50 до 100
        )
        self.solve_compiled = jax.jit(self.lm_solver.run)

    def solve_network(self, P_source, x0):
        result = self.solve_compiled(x0, P_source)
        result.params.block_until_ready()
        return np.array(result.params)


def run_calculation(builder):
    core = MonolithCore(builder)

    # УЛУЧШЕННОЕ начальное приближение
    num_vars = core.m + core.n
    X0 = jnp.ones(num_vars)
    
    # Начальные расходы:预估每个管道的流量
    X0 = X0.at[0:core.m].set(5.0)  # 5 л/с вместо 2.0
    
    # Начальные давления: от источника к потребителям с градиентом
    P_init = jnp.linspace(100.0, 30.0, core.n)  # От 100 м до 30 м
    X0 = X0.at[core.m:].set(P_init)

    # ЭТАП 1: Поиск диктующего оросителя при P_source = 100 м
    P_test = 100.0
    print(f"[Этап 1] Расчет при P_source = {P_test} м...")
    X_stage1 = core.solve_network(P_test, X0)

    P_stage1 = X_stage1[core.m:core.m + core.n]
    Q_stage1 = X_stage1[0:core.m]
    
    print(f"  Минимальное давление: {np.min(P_stage1[core.consumer_list]):.2f} м")
    print(f"  Максимальное давление: {np.max(P_stage1):.2f} м")
    
    P_spr = P_stage1[core.consumer_list]
    dictating_idx = core.consumer_list[int(np.argmin(P_spr))]

    # ЭТАП 2: Подбор P_source через brentq
    def objective(P_source_guess):
        X = core.solve_network(P_source_guess, x0=X_stage1)
        P_curr = X[core.m:core.m + core.n]
        return float(np.min(P_curr[core.consumer_list])) - PRESSURE_TARGET

    # Адаптивный поиск диапазона
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
        print(f"  ⚠️ Смена знака не найдена! Используем P_high = {P_high}")
        P_optimal = P_high

    # Финальный расчёт
    X_final = core.solve_network(P_optimal, x0=X_stage1)
    Q_final = X_final[0:core.m]
    P_final = X_final[core.m:core.m + core.n]

    # Проверка сходимости
    min_P = np.min(P_final[core.consumer_list])
    print(f"\n✅ Расчет завершен:")
    print(f"  P_source = {P_optimal:.2f} м")
    print(f"  Минимальное давление на оросителях: {min_P:.2f} м")
    print(f"  Максимальное давление: {np.max(P_final):.2f} м")
    
    if min_P < 0:
        print(f"  ⚠️ ВНИМАНИЕ: Отрицательные давления! Система не сошлась.")
    
    return Q_final, P_final, P_optimal, dictating_idx