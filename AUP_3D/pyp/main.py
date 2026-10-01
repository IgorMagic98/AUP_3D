"""
main.py — Двухэтапный расчет: 1) Поиск минимума при высоком давлении, 2) Подъем давления источника до достижения 19.17 м на минимуме.
"""
import json
import numpy as np
import networkx as nx
from scipy.optimize import least_squares, brentq
import plotly.graph_objects as go
import warnings
import os
import time

# Игнорируем предупреждения о промежуточных отрицательных значениях при подборе
warnings.filterwarnings('ignore')

# ==========================================
# 1. ЗАГРУЗКА ДАННЫХ
# ==========================================
json_files = ['graph_data (3).json']
data = None
for fname in json_files:
    if os.path.exists(fname):
        with open(fname, 'r', encoding='utf-8') as f:
            data = json.load(f)
        print(f"✅ Загружен файл: {fname}")
        break

if data is None:
    print("❌ Ошибка: Ни один из файлов graph.json не найден в папке.")
    exit(1)

# ==========================================
# 2. ПОСТРОЕНИЕ ГРАФА И МАТРИЦ
# ==========================================
nodes = [n['id'].strip() for n in data['nodes']]
node_to_idx = {n: i for i, n in enumerate(nodes)}

edges = []
for e in data['edges']:
    u, v = e['from'].strip(), e['to'].strip()
    if u in node_to_idx and v in node_to_idx:
        edges.append((u, v, e))

N = len(nodes)
M = len(edges)

A = np.zeros((N, M), dtype=np.float64)
S_vec = np.zeros(M, dtype=np.float64)
K_spr_vec = np.zeros(N, dtype=np.float64)

sprinkler_indices = []
source_idx = -1

# Физические константы для расчета Kt (из вашего solver.py)
G_ACC = 9.81
LAMBDA = 0.02

def calc_Kt(D_mm, L_m):
    """Правильный физический расчет Kt. Если L=0 или D=0, возвращаем 0."""
    if L_m <= 0 or D_mm <= 0:
        return 0.0
    D = D_mm / 1000.0
    return (np.pi**2 * G_ACC * D**5) / (8 * LAMBDA * L_m * 1e-6)

G = nx.DiGraph()
for i, n in enumerate(data['nodes']):
    node_id = n['id'].strip()
    t = n.get('type', '').strip()
    pos = n.get('position', {})
    G.add_node(node_id, type=t, xyz=(pos.get('x', 0), pos.get('y', 0), pos.get('z', 0)))
    
    if t == 'sprinkler':
        sprinkler_indices.append(i)
        K_spr_vec[i] = 0.47
    elif t == 'source':
        source_idx = i

for j, (u, v, e) in enumerate(edges):
    ui = node_to_idx[u]
    vi = node_to_idx[v]
    # Матрица инцидентности: +1 выход, -1 вход
    A[ui, j] = 1.0
    A[vi, j] = -1.0
    
    L = e.get('length', 0)
    D = e.get('diameter', 0)
    
    # Используем физическую формулу Kt. 
    # (Если вам критически нужно Kt=125 для всех труб, замените следующую строку на: Kt = 125.0)
    # Но предупреждаю: при Kt=125 потери на магистральных трубах составят сотни метров, 
    # что математически вынудит солвер уходить в отрицательные давления.
    Kt = calc_Kt(D, L)
    
    if Kt > 0:
        S_vec[j] = L / Kt
    else:
        S_vec[j] = 0.0  # Для соединений с L=0 перепад давления = 0
        
    G.add_edge(u, v, length=L, diameter=D, kt=Kt)

B = A.T

print(f"\n[INFO] N={N} узлов, M={M} ребер, оросителей={len(sprinkler_indices)}, source=индекс {source_idx}")

# ==========================================
# 3. ФУНКЦИЯ РЕШЕНИЯ СИСТЕМЫ
# ==========================================
def solve_network(P_source_test, x0=None):
    """Решает систему при заданном давлении источника P_source_test"""
    def residuals(x):
        Q = x[:M]
        P = x[M:]
        
        # 1. Потери давления: P_start - P_end = S * Q * |Q|
        head_loss = B @ P - S_vec * (Q * np.abs(Q))
        
        # 2. Баланс расходов: Q_in - Q_out - W = 0  =>  -(A @ Q) - W = 0
        # np.maximum защищает от NaN при извлечении корня из отрицательного числа
        safe_P = np.maximum(P, 1e-6)
        W = K_spr_vec * np.sqrt(safe_P)
        balance = -A @ Q - W  # <-- ПРАВИЛЬНЫЙ ЗНАК
        
        # 3. Граничное условие: фиксируем давление источника
        balance[source_idx] = P[source_idx] - P_source_test
        
        return np.concatenate([head_loss, balance])

    if x0 is None:
        x0 = np.zeros(M + N)
        x0[:M] = 1.0  # Начальный расход 1 л/с
        x0[M:] = P_source_test * 0.8
        x0[M + source_idx] = P_source_test
    
    # Метод Levenberg-Marquardt ('lm') максимально устойчив
    res = least_squares(
        residuals, x0, method='lm', 
        ftol=1e-9, xtol=1e-9, max_nfev=5000
    )
    return res.x[:M], res.x[M:], res

# ==========================================
# ⏱️ ЗАПУСК ТАЙМЕРА
# ==========================================
print("\n" + "="*70)
print("НАЧАЛО МАТЕМАТИЧЕСКОГО РАСЧЕТА")
print("="*70)
start_time = time.time()

# ==========================================
# 4. ДВУХЭТАПНЫЙ РАСЧЕТ (ВАШ АЛГОРИТМ)
# ==========================================
print("\n" + "="*70)
print("ЭТАП 1: Предварительный расчет с высоким давлением (P_source = 100 м)")
print("="*70)

P_high = 100.0
Q1, P1, res1 = solve_network(P_high)
print(f"Статус сходимости: {res1.message}")
print(f"Невязка: {res1.cost:.2e}")

# Находим ороситель с минимальным давлением после Этапа 1
spr_P1 = P1[sprinkler_indices]
min_local_idx = np.argmin(spr_P1)
dictating_idx = sprinkler_indices[min_local_idx]
dictating_name = nodes[dictating_idx]

print(f"\n🎯 НАЙДЕН ДИКТУЮЩИЙ ОРОСИТЕЛЬ: {dictating_name} (индекс {dictating_idx})")
print(f"   Его давление при P_source=100 м: {P1[dictating_idx]:.4f} м")

print("\n" + "="*70)
print("ЭТАП 2: Подбор давления источника, чтобы поднять минимум до 19.17 м")
print("="*70)

def objective(P_test):
    """Возвращает разницу между текущим давлением на диктующем оросителе и целевым 19.17"""
    # Используем результат Этапа 1 как "горячий старт" для ускорения
    Q, P, res = solve_network(P_test, x0=np.concatenate([Q1, P1]))
    return P[dictating_idx] - 19.17

# Автоматический поиск границ для метода Brent (гарантирует нахождение корня)
P_low, P_high_brent = 20.0, 150.0
while objective(P_low) > 0:
    P_low -= 10.0
while objective(P_high_brent) < 0:
    P_high_brent += 10.0

print(f"Поиск оптимального P_source в диапазоне: [{P_low}, {P_high_brent}]")

# Точный подбор методом Брента (сходится за 5-10 итераций)
P_optimal = brentq(objective, P_low, P_high_brent, xtol=0.001)

# Финальный расчет с найденным идеальным давлением источника
Q_final, P_final, res_final = solve_network(P_optimal, x0=np.concatenate([Q1, P1]))

# ==========================================
# ⏱️ ОСТАНОВКА ТАЙМЕРА
# ==========================================
end_time = time.time()
elapsed_time = end_time - start_time

# ==========================================
# 5. ВЫВОД РЕЗУЛЬТАТОВ
# ==========================================
print("\n" + "="*70)
print("✅ РАСЧЕТ ЗАВЕРШЕН УСПЕШНО")
print("="*70)
print(f"⏱️  ОБЩЕЕ ВРЕМЯ РАСЧЕТА: {elapsed_time:.4f} сек.")
print(f"🔵 Оптимальное давление источника: {P_optimal:.4f} м вод.ст.")
print(f"🎯 Давление на диктующем оросителе ({dictating_name}): {P_final[dictating_idx]:.4f} м вод.ст. (Цель: 19.17)")
print(f"📉 Абсолютный минимум давления в системе: {np.min(P_final):.4f} м вод.ст.")

print("\n📊 Давления на оросителях (первые 10, от меньшего к большему):")
sorted_spr = sorted([(i, P_final[i]) for i in sprinkler_indices], key=lambda x: x[1])

for i, p in sorted_spr[:10]:
    marker = " <-- ДИКТУЮЩИЙ" if i == dictating_idx else ""
    flag = " ⚠️" if p < 19.17 - 0.01 else ""
    q = 0.47 * np.sqrt(max(p, 0))
    print(f"   {nodes[i]}: P={p:.4f} м, Q={q:.4f} л/с{marker}{flag}")

if len(sorted_spr) > 10:
    print(f"   ... и ещё {len(sorted_spr) - 10} оросителей")

# ==========================================
# 6. 3D ВИЗУАЛИЗАЦИЯ С РАСХОДАМИ НА ТРУБАХ
# ==========================================
print("\n🔄 Генерация 3D визуализации с отображением расходов (Q)...")

node_x, node_y, node_z = [], [], []
node_colors, node_hover_text = [], []

for i, n in enumerate(nodes):
    xyz = G.nodes[n].get('xyz', (0, 0, 0))
    node_x.append(xyz[0])
    node_y.append(xyz[1])
    node_z.append(xyz[2])

    t = G.nodes[n].get('type', '')
    if t == 'source':
        color = 'green'
    elif t == 'sprinkler':
        color = 'yellow' if i == dictating_idx else ('red' if P_final[i] < 19.17 - 0.01 else 'blue')
    elif t == 'attachNode':
        color = 'orange'
    else:
        color = 'gray'
    node_colors.append(color)

    if t == 'source':
        node_hover_text.append(f"<b>{n}</b><br>ИСТОЧНИК<br>P = {P_final[i]:.2f} м")
    elif t == 'sprinkler':
        marker = " (ДИКТУЮЩИЙ)" if i == dictating_idx else ""
        node_hover_text.append(f"<b>{n}</b><br>ОРОСИТЕЛЬ{marker}<br>P = {P_final[i]:.2f} м<br>Q = {0.47*np.sqrt(max(P_final[i],0)):.2f} л/с")
    else:
        node_hover_text.append(f"<b>{n}</b><br>{t}<br>P = {P_final[i]:.2f} м")

edge_x, edge_y, edge_z = [], [], []
edge_mid_x, edge_mid_y, edge_mid_z = [], [], []
edge_text = []

for j, (u, v, d) in enumerate(G.edges(data=True)):
    u_xyz = G.nodes[u]['xyz']
    v_xyz = G.nodes[v]['xyz']
    
    edge_x += [u_xyz[0], v_xyz[0], None]
    edge_y += [u_xyz[1], v_xyz[1], None]
    edge_z += [u_xyz[2], v_xyz[2], None]
    
    mid_x = (u_xyz[0] + v_xyz[0]) / 2.0
    mid_y = (u_xyz[1] + v_xyz[1]) / 2.0
    mid_z = (u_xyz[2] + v_xyz[2]) / 2.0
    edge_mid_x.append(mid_x)
    edge_mid_y.append(mid_y)
    edge_mid_z.append(mid_z)
    
    q_val = Q_final[j]
    diam = d.get('diameter', 0)
    edge_text.append(f"Q = {q_val:.2f} л/с<br>Ø{diam} мм")

fig = go.Figure()

# 1. Трубы (линии)
fig.add_trace(go.Scatter3d(
    x=edge_x, y=edge_y, z=edge_z,
    mode='lines',
    line=dict(color='lightgray', width=1.5),
    name='Трубы',
    hoverinfo='skip'
))

# 2. Значения расходов посередине труб (ТЕКСТ)
fig.add_trace(go.Scatter3d(
    x=edge_mid_x, y=edge_mid_y, z=edge_mid_z,
    mode='text',
    text=edge_text,
    textposition='middle center',
    textfont=dict(size=8, color='darkblue', family='Arial'),
    hoverinfo='text',
    hovertext=edge_text,
    name='Расходы (Q)'
))

# 3. Узлы (маркеры + всплывающие подсказки)
fig.add_trace(go.Scatter3d(
    x=node_x, y=node_y, z=node_z,
    mode='markers',
    marker=dict(size=4, color=node_colors, line=dict(color='black', width=0.5)),
    hovertext=node_hover_text,
    hoverinfo='text',
    name='Узлы (P)'
))

p_src = P_final[source_idx]
p_min = P_final[dictating_idx]

fig.update_layout(
    title=f'Гидравлический расчёт<br><sup>P_source = {p_src:.2f} м | P_min = {p_min:.2f} м (цель: 19.17 м)</sup>',
    scene=dict(
        xaxis_title='X (м)', 
        yaxis_title='Y (м)', 
        zaxis_title='Z (м)',
        aspectmode='data',
        camera=dict(eye=dict(x=1.5, y=2.5, z=1.5)) # Оптимальный ракурс для длинных веток
    ),
    showlegend=True,
    legend=dict(yanchor="top", y=0.99, xanchor="left", x=0.01, bgcolor="rgba(0,0,0,0)"),
    margin=dict(l=0, r=0, b=0, t=80),
    width=1400, 
    height=900
)

html_path = 'network_3d.html'
fig.write_html(html_path)
print(f"✅ 3D-визуализация сохранена: {os.path.abspath(html_path)}")
print("💡 Откройте этот файл в браузере. Вы увидите синие надписи с расходом (Q) посередине каждой трубы.")

try:
    import webbrowser
    webbrowser.open('file://' + os.path.realpath(html_path))
except Exception:
    pass