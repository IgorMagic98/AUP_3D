from system_builder import HydraulicSystemBuilder
from scipy.optimize import least_squares

# 1. Сборка системы из JSON
builder = HydraulicSystemBuilder('graph_data(7).json')
builder.build_graph()
builder.build_matrices(K_sprinkler=0.47)

# 2. Получение функций невязок и Якоби
# Допустим, мы зафиксировали давление на узле 5 (индекс узла) равным 19.17
fixed_nodes = {5: 19.17} 
F_func, J_func = builder.get_system_functions(fixed_pressures=fixed_nodes)

# 3. Начальное приближение (Ваш smart_initial_guess остается без изменений)
N = len(builder.nodes)
M = len(builder.edges)
x0 = np.zeros(M + N)
x0[:M] = 1.0  # Начальные расходы
x0[M:] = 30.0 # Начальные давления

# 4. Запуск солвера
result = least_squares(
    F_func, 
    x0, 
    jac=J_func,       # Передаем аналитический Якоби!
    method='trf', 
    ftol=1e-10, 
    xtol=1e-10
)

# 5. Разбор результатов
Q_final = result.x[:M]
P_final = result.x[M:]

print(f"Статус сходимости: {result.message}")
print(f"Давление на фиксированном узле: {P_final[5]:.4f}")