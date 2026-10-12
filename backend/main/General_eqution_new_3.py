import numpy as np
from typing import List, Dict, Optional, Any, Tuple, Callable
from dataclasses import dataclass
from scipy.optimize import fsolve
from scipy.optimize import least_squares
from scipy.sparse import csr_matrix, eye
from scipy.sparse.linalg import spsolve
import re
import time
import matplotlib.pyplot as plt
import numba  # На всякий случай
from numba import jit, prange, njit
from numba import njit, float64
from datetime import datetime
# Класс уравнений веток
@dataclass
class EquationBranch:
    unknown: List[str]
    eq: List[str]
    L: List[float]
    Kt: List[float]
    height: List[float]

# Класс уравнений соединени веток
@dataclass 
class EquationConnections:
    unknown: List[str]
    eq: List[str]
    L: List[float]
    Kt: List[float]
    height: List[float]
    
# Класс уравнений питающего трубопровода   
@dataclass 
class EquationFeedPipe:
    unknown: List[str]
    eq: List[str]
    L: List[float]
    Kt: List[float]
    height: List[float]
    
# Класс уравнений узла управления    
@dataclass
class EquationUU:
    unknown: List[str]
    eq: List[str]
    Kt: List[float]
    height: List[float]
    
# Класс уравнений связи элеменотвов    
@dataclass 
class EquationJoint:
    unknown: List[str]
    eq: List[str]    

# Класс уравнений граничных условий
@dataclass 
class EquationBC:
    unknown: List[str]
    eq: List[str]

def safe_float(val):
    try:
        return float(val)
    except (ValueError, TypeError):
        return 0.0      

# ==================== Метод получения из словаря параметов веток =====================

def find_all_branches_and_fill_data(data):
    count_branch = int(float(data['count_branch'][0]))
    branches_data = {}
    
    for i in range(count_branch):
        b_name = chr(ord('a') + i)
        count = int(float(data[f'{b_name}-count'][0]))
        
        k_spr = [float(data['k'][0])]
        L = [float(data[f'{b_name}_{j}_length'][0]) for j in range(1, count + 1)]
        Kt = [float(data[f'{b_name}_{j}_kt'][0]) for j in range(1, count + 1)]
        h_seg = [float(data[f'{b_name}_{j}_height'][0]) for j in range(1, count + 1)]
        h_gen = float(data[f'{b_name}_height'][0])
        h_nodes = h_seg + [h_gen]
        
        # 🔥 ✅ НОВЫЕ МАССИВЫ СКОРОСТЕЙ (по участкам)
        k_velocity = [float(data[f'{b_name}_{j}_kvelocity'][0]) for j in range(1, count + 1)]
        DN = [float(data[f'{b_name}_{j}_DN'][0]) for j in range(1, count + 1)]
        
        nodes = [f"{b_name}{j+1}" for j in range(count + 1)]
        
        branches_data['k_spr'] = k_spr
        branches_data[f'L_{b_name.upper()}'] = L
        branches_data[f'Kt_{b_name.upper()}'] = Kt
        branches_data[f'height_{b_name.upper()}'] = h_nodes
        branches_data[f'nodes_{b_name.upper()}'] = nodes
        # 🔥 ✅ НОВЫЕ!
        branches_data[f'k_velocity_{b_name.upper()}'] = k_velocity
        branches_data[f'DN_{b_name.upper()}'] = DN
        
    print('BRANCHES_DATA:', branches_data)
    return branches_data

# ==================== Метод получения из словаря параметов соединений =====================

def find_all_connection_and_fill_data(data, branches_data):
    """Генерирует связи + узлы для 2-6+ веток"""
    count_branch = int(float(data['count_branch'][0]))
    connections_data = {}
    
    # Генерируем узлы для ВСЕХ веток (a, b, c...)
    branch_nodes = {}
    for i in range(count_branch):
        b_name = chr(ord('a') + i)
        # branch_nodes[f'{b_name}_nodes'] = [f'{b_name}1', f'{b_name}2']  # Начало-конец ветви
        branch_nodes[f'{b_name}_nodes'] = branches_data[f'nodes_{b_name.upper()}']
    
    connections_data.update(branch_nodes)
    
    # Связи между ветками
    for i in range(1, count_branch):
        b_name = chr(ord('a') + i)
        from_branch = chr(ord('a') + i - 1)
        conn_name = f'{from_branch}{b_name}'
        conn_upper = f'{conn_name.upper()}'
        
        # Высоты связи
        h_from_end = branches_data[f'height_{from_branch.upper()}'][-1]
        h_to_start = branches_data[f'height_{b_name.upper()}'][0]
        height_conn = [h_from_end, h_to_start]
        
        # Параметры
        L_conn = safe_float(data[f'{b_name}_length'][0])
        Kt_conn = safe_float(data[f'{b_name}_kt'][0])
        k_velocity_conn = safe_float(data[f'{b_name}_kvelocity'][0])
        
        connections_data[f'L_{conn_upper}'] = [L_conn]
        connections_data[f'Kt_{conn_upper}'] = [Kt_conn]
        connections_data[f'kvelocity_{conn_upper}'] = k_velocity_conn
        connections_data[f'height_{conn_upper}'] = height_conn
        
        # ТОЧКИ СОЕДИНЕНИЯ
        connections_data[f'node1_{conn_upper}'] = [f'{from_branch}']  # Конец предыдущей
        connections_data[f'node2_{conn_upper}'] = [f'{b_name}']      # Начало текущей
    
    print('CONNECTION_DATA:', connections_data)
    return connections_data

# ==================== Метод получения из словаря параметов питающего трубоповода =====================

def feed_pipe_data(data):
    """Извлекает параметры питающего трубопровода"""
    feed_data = {}
    
    count_branch = int(float(data['count_branch'][0]))
    last_branch = chr(ord('a') + count_branch - 1)
    
    h_start = safe_float(data.get(f'{last_branch}_height', [0])[0])  
    h_end = safe_float(data.get('node_height', [0])[0])  
    
    feed_data = {
        'L_FEED': [1],      # Добалвена _1 для индетификации 1 питающего трубопрвода
        'Kt_FEED': [2000000],   # Добалвена _1 для индетификации 1 питающего трубопрвода
        'height_FEED': [h_start, h_end],
        'node1_FEED': ['feedpipe1'],
        'node2_FEED': [f'{last_branch}1'],
        # 🔥 ✅ ДОБАВИТЬ k_velocity!
        'k_velocity_feedpipe': [0.0127]   # Добалвена _1 для индетификации 1 питающего трубопрвода
    }
    
    print('FEED_DATA:',feed_data)     
    return feed_data

# ==================== Метод получения из словаря параметов узла управления =====================

def UU_data(data):
    """Извлекает параметры УЗЛА УПРАВЛЕНИЯ с узлами uu1, uu2"""
    uu_data = {}
    
    # Извлекаем параметры узла управления
    uu_params = {
        'Kt': safe_float(data.get('node_kt', [0])[0]),           # 2.01e-7
        'height': safe_float(data.get('node_height', [0])[0]),   # 1.5
        'name': data.get('node_name', ['Неизвестно'])[0]         # Название
    }
    
    # Основные параметры
    uu_data['Kt_UU'] = [uu_params['Kt']]
    uu_data['height_UU'] = [uu_params['height']]
    
    # Добавляем УЗЛЫ узла управления
    uu_data['node1'] = ['uu1']  # Входной узел UU
    uu_data['node2'] = ['uu2']  # Выходной узел UU
    
    print('UU_DATA:',uu_data)
    return uu_data

# ==================== Метод получения из словаря параметов связи =====================
def JointParam(data):
    return

# ==================== Генерируем уравнения веток =====================

def generate_branch_equations(branches_data: Dict) -> EquationBranch:
    """ГЕНЕРИРУЕТ уравнения веток БЕЗ индексов X(n)"""
    
    k_spr = branches_data['k_spr'][0]
     
    eq_data = {
        'unknown': [],
        'eq': [],
        'L': [],
        'Kt': [],
        'height': []
    }
    
    branch_keys = [key for key in branches_data.keys() if key.startswith('L_')]
    
    for b_name_upper in branch_keys:
        branch_name = b_name_upper[2:].lower()
        L = branches_data[b_name_upper]
        Kt = branches_data[f'Kt_{b_name_upper[2:]}']
        h_node = branches_data[f'height_{b_name_upper[2:]}']
        n_sprinklers = len(L)  # Кол-во участков = кол-во оросителей
        
        print(f"🔍 Ветка {branch_name}: {n_sprinklers} оросителей")
        
        # ✅ 1. ПЕРЕМЕННЫЕ ветки
        # Напоры: P1, P2, ..., P_{n+1}
        for i in range(n_sprinklers + 1):
            eq_data['unknown'].append(f"P{branch_name}{i+1}")
        
        # Расходы: Q1,Q2,...,Qn + Q12,Q23,...,Qn,n+1
        for i in range(n_sprinklers):
            eq_data['unknown'].append(f"Q{branch_name}{i+1}")      # Оросители
            eq_data['unknown'].append(f"Q{branch_name}{i+1}{i+2}") # Участки
        
        # ✅ 2. РАСХОД ОРОСИТЕЛЕЙ Q_i = k_spr * √P_i
        for i in range(n_sprinklers):
            P_i = f"P{branch_name}{i+1}"
            Q_i = f"Q{branch_name}{i+1}"
            eq_data['eq'].append(f"{Q_i} - {k_spr}*sqrt({P_i})")
        
        # 🔥 3. БАЛАНС РАСХОДА ПО УЧАСТКАМ (ПРАВИЛЬНАЯ РЕКУРСИВНАЯ ЛОГИКА)
        for i in range(n_sprinklers):
            if i == 0:
                # Участок 1: Q1 = Q12
                eq_data['eq'].append(f"Q{branch_name}1 - Q{branch_name}12")
            else:
                # Участок i: Q_{i,i+1} + Q_{i+1} = Q_{i+1,i+2}
                prev_section = f"Q{branch_name}{i}{i+1}"     # Q12, Q23, Q34...
                curr_sprinkler = f"Q{branch_name}{i+1}"      # Q2, Q3, Q4...
                next_section = f"Q{branch_name}{i+1}{i+2}"   # Q23, Q34, Q45...
                
                eq_data['eq'].append(f"({prev_section} + {curr_sprinkler}) - {next_section}")
        
        # ✅ 4. БАЛАНС НАПОРА по участкам
        for i in range(n_sprinklers):
            P_i = f"P{branch_name}{i+1}"
            P_next = f"P{branch_name}{i+2}"
            Q_section = f"Q{branch_name}{i+1}{i+2}"
            h1, h2 = h_node[i], h_node[i+1]
            L_val, Kt_val = L[i], Kt[i]
            
            eq_data['eq'].append(
                f"({P_i} + {h1}) - ({P_next} + {h2}) + "
                f"({Q_section}**2 * {L_val} / {Kt_val})"
            )
            eq_data['L'].append(L_val)
            eq_data['Kt'].append(Kt_val)
            eq_data['height'].extend([h1, h2])
    
    branch_eq = EquationBranch(
        unknown=eq_data['unknown'],
        eq=eq_data['eq'],
        L=eq_data['L'],
        Kt=eq_data['Kt'],
        height=eq_data['height']
    )
    
    print(f"✅ Ветки: {len(branch_eq.eq)} уравнений")
    print(branch_eq)
    return branch_eq

# ==================== Генерируем уравнения питающего трубопровода =====================

def generate_feedpipe_equations(feed_data) -> EquationFeedPipe:
    """Генерирует EquationFeedPipe для питающего трубопровода"""
    L = feed_data['L_FEED'][0]
    Kt = feed_data['Kt_FEED'][0]
    h1, h2 = feed_data['height_FEED']
    
    # ✅ ФИКС: ПРЯМЫЕ имена переменных!
    P1 = "Pfeedpipe1"           # Вход
    P2 = "Pfeedpipe2"                  # Выход (последняя ветка c1)
    Q12 = "Qfeedpipe12"        # Поток
    
    unknown = [P1, P2, Q12]     # ✅ СПИСОК!
    
    eq_str = f"({P1} + {h1}) - ({P2} + {h2}) + ({Q12}**2 * {L} / {Kt})"
    
    feed_eq = EquationFeedPipe(
        unknown=unknown,
        eq=[eq_str],
        L=[L],
        Kt=[Kt],
        height=[h1, h2]
    )
    
    print(f"Питающий трубопровод: {len(feed_eq.eq)} уравнений") 
    print(feed_eq)
    return feed_eq

# ==================== Генерируем уравнения соединений веток =====================

def generate_connection_equations(connections_data) -> EquationConnections:
    """
    Генерирует EquationConnections для ВСЕХ связей (AB, BC, CD...)
    """
    eq_data = {
        'unknown': [],
        'eq': [],
        'L': [],
        'Kt': [],
        'height': []
    }
    
    # Перебираем все связи в connections_data
    for key in connections_data.keys():
        if key.startswith('L_') and len(key) == 4:  # L_AB, L_BC...
            conn_upper = key[2:]  # AB, BC...
            conn_lower = conn_upper.lower()  # ab, bc...
            
            # ✅ Названия веток = буквы связи!
            from_branch = conn_lower[0]  # 'a'
            to_branch = conn_lower[1]    # 'b'
            
            # ✅ Переменные по названиям веток
            Pa = f"P{from_branch}"    # Pa (конец ветки A)
            Pb = f"P{to_branch}"       # Pb (начало ветки B)
            Qab = f"Q{conn_lower}"      # Qab
            
            # Извлекаем параметры связи
            L = connections_data[f'L_{conn_upper}']
            Kt = connections_data[f'Kt_{conn_upper}']
            height = connections_data[f'height_{conn_upper}']
            
            # ✅ Добавляем в СПИСОК неизвестных
            eq_data['unknown'].extend([Pa, Pb, Qab])
            
            # ✅ УРАВНЕНИЕ с Pa, Pb, Qab
            h1, h2 = height
            eq_str = f"({Pa} + {h1}) - ({Pb} + {h2}) + ({Qab}**2 * {L[0]} / {Kt[0]})"
            eq_data['eq'].append(eq_str)
            
            # Параметры
            eq_data['L'].extend(L)
            eq_data['Kt'].extend(Kt)
            eq_data['height'].extend(height)           
    
    conn_eq = EquationConnections(
        unknown=eq_data['unknown'],
        eq=eq_data['eq'],
        L=eq_data['L'],
        Kt=eq_data['Kt'],
        height=eq_data['height']
    )
    
    print(f"🔗 СВЯЗИ: {len(conn_eq.eq)} уравнений")
    
    print(conn_eq)     
    return conn_eq    

# ==================== Генерируем уравнения узла управления =====================

def generate_uu_equations(uu_data) -> EquationUU:
    """Генерирует уравнение для УЗЛА УПРАВЛЕНИЯ"""
    Kt = uu_data['Kt_UU'][0]      # 2.01e-7
    height = uu_data['height_UU'][0]  # 1.5
    
    # БЕРЕМ УЗЛЫ ИЗ uu_data
    node1 = uu_data['node1'][0]     # 'uu1'
    node2 = uu_data['node2'][0]     # 'uu2'    
    
    Puu1 = f"P{node1}"     # P_uu1
    Puu2 = f"P{node2}"     # P_uu2
    Quu12 = "Quu12"      # Поток через UU
    
    unknown = [Puu1, Puu2, Quu12]
    
    # Уравнение: ΔP = f(Q, Kt_UU)
    eq_str = f"{Puu1} - {Puu2} + ({Kt} * 1000 * (3.6 * {Quu12}) ** 2)"
    
    uu_eq = EquationUU(
        unknown=unknown,
        eq=[eq_str],
        Kt=[Kt],
        height=[height]
    )

    print(f"⚙️ UU: {len(uu_eq.eq)} уравнений") 
    
    print(uu_eq)
    return uu_eq

# ==================== Генерируем уравнения связи элементов =====================

def generate_joint_equations(feed_data, connections_data, uu_data, branches_data) -> EquationJoint:
    """Генератор уравнений узлов - АВТОМАТИЧЕСКИЕ последние расходы!"""
    eq_data = {'unknown': [], 'eq': []}
    
    # 1. Давления: конец ветки = соединение (Pa4=Pa, Pb4=Pb)
    for key in branches_data:
        if key.startswith('nodes_'):
            branch_upper = key[6:]
            branch_lower = branch_upper.lower()
            nodes = branches_data[key]
            last_node = nodes[-1]
            eq_data['eq'].append(f"P{last_node} - P{branch_lower}")
            eq_data['unknown'].extend([f"P{last_node}", f"P{branch_lower}"])
    
    # 2. Цепочка: Pfeedpipe1 → Pa → Pb → Pfeedpipe2 → Puu1
    last_branch = max([k[6:].lower() for k in branches_data if k.startswith('nodes_')])
    eq_data['eq'].append(f"Pfeedpipe1 - P{last_branch}")
    eq_data['eq'].append("Pfeedpipe2 - Puu1")
    eq_data['unknown'].extend(["Pfeedpipe1", f"P{last_branch}", "Pfeedpipe2", "Puu1"])
    
    # 🔥 3. АВТОМАТИЧЕСКИЕ ПОСЛЕДНИЕ РАСХОДЫ ВЕТОК
    nodes_keys = [k for k in branches_data if k.startswith('nodes_')]
    count_branch = len(nodes_keys)
    
    last_Qs = {}
    print("🔍 АВТО last_Qs:")
    for key in nodes_keys:
        branch_upper = key[6:]
        branch_lower = branch_upper.lower()
        nodes = branches_data[key]
        n_sprinklers = len(nodes) - 1  # Кол-во оросителей = len(nodes)-1
        
        # 🔥 АВТО: Последний расход = Q_{n}{n+1} где n = кол-во оросителей
        last_section = f"Q{branch_lower}{n_sprinklers}{n_sprinklers+1}"
        last_Qs[branch_lower] = last_section
        
        print(f"  {branch_lower}: {n_sprinklers} оросителей → {last_section}")
    
    print(f"🔍 last_Qs: {last_Qs}")
    
    # 4. БАЛАНС РАСХОДОВ ПО ЦЕПИ (Qa34 → Qab → Qb45 → Qfeedpipe12)
    if count_branch == 1:
        # Одна ветка: Q_last = Qfeedpipe12
        last_q = list(last_Qs.values())[0]
        eq_data['eq'].append(f"{last_q} - Qfeedpipe12")
        eq_data['unknown'].extend([last_q, "Qfeedpipe12"])
    else:
        # Много веток: цепочка Qa34=Qab, Qab+Qb45=Qbc, Qbc+Qc56=Qfeedpipe12
        for i in range(count_branch - 1):
            from_b = chr(ord('a') + i)
            to_b = chr(ord('a') + i + 1)
            Q_conn = f"Q{from_b}{to_b}"  # Qab, Qbc
            
            if i == 0:
                # Первый: Qa34 = Qab
                prev_q = last_Qs[from_b]
                eq_data['eq'].append(f"{prev_q} - {Q_conn}")
            else:
                # Промежуточный: Qab + Qb45 = Qbc
                prev_conn = f"Q{chr(ord('a')+i-1)}{from_b}"
                curr_last_q = last_Qs[from_b]
                eq_data['eq'].append(f"{prev_conn} + {curr_last_q} - {Q_conn}")
            
            eq_data['unknown'].extend([prev_q if i==0 else prev_conn, curr_last_q if i>0 else prev_q, Q_conn])
        
        # Финал: Q_last_conn + Q_last_branch = Qfeedpipe12
        last_from = chr(ord('a') + count_branch - 2)
        last_to = chr(ord('a') + count_branch - 1)
        last_conn = f"Q{last_from}{last_to}"
        last_branch_q = last_Qs[last_to]
        eq_data['eq'].append(f"{last_conn} + {last_branch_q} - Qfeedpipe12")
        eq_data['unknown'].extend([last_conn, last_branch_q, "Qfeedpipe12"])
    
    # 5. Финальный баланс: Qfeedpipe12 = Quu12
    eq_data['eq'].append("Qfeedpipe12 - Quu12")
    eq_data['unknown'].extend(["Qfeedpipe12", "Quu12"])
    
    joint_eq = EquationJoint(**eq_data)
    
    print(joint_eq)
    return joint_eq

# ==================== Генерируем граничные условия =====================

def find_boundary_conditions_data(data) -> EquationBC:
    unknown = ['Pa1']  # ✅ Только Pa1!
    eq = []
    
    if 'pressure_fixed' in data:
        pressure_value = float(data['pressure_fixed'][0])  # 19.17
        eq.append(f'Pa1 - {pressure_value}')  # ✅ Pa1 - 19.17
        
    # pa1_target = float(data['pressure_fixed'][0])   
    boundary_eq = EquationBC(unknown=unknown, eq=eq)
    
    print(f"📏 BC: {len(boundary_eq.eq)} уравнений")
    
    print(boundary_eq)
    return boundary_eq

def generate_velocity_equations(branches_data: Dict, feed_data: Dict = None, connections_data: Dict=None) -> List[str]:
    """✅ Ваша формула: V = k_velocity × Q для веток + feedpipe"""
    velocity_eqs = []
    
    # 1. ✅ ВЕТКИ L_ (как было)
    for b_name_upper in [key for key in branches_data.keys() if key.startswith('L_')]:
        branch_name = b_name_upper[2:].lower()
        k_velocity = branches_data[f'k_velocity_{b_name_upper[2:]}']
        n_sections = len(k_velocity)
        
        for i in range(n_sections):
            Q_section = f"Q{branch_name}{i+1}{i+2}"
            V_section = f"V{branch_name}{i+1}{i+2}"
            
            k_v = k_velocity[i]
            eq_str = f"{V_section} - {k_v} * {Q_section}"
            velocity_eqs.append(eq_str)
    
                       
    # 2. СВЯЗИ из connections_data (Vab, Vbc...) + дубли из branches_data
    # Перебираем ключи, чтобы найти связи (например 'L_AB', 'Kt_AB')
    connection_keys = set()
    for key in connections_data.keys():
        if key.startswith('L_'):
            connection_name = key[2:]  # 'AB'
            connection_keys.add(connection_name)

    for conn in connection_keys:
        node1_key = f'node1_{conn}'
        node2_key = f'node2_{conn}'
        k_velocity_key = f'kvelocity_{conn}'

        node1 = connections_data.get(node1_key)
        node2 = connections_data.get(node2_key)
        k_velocity = connections_data.get(k_velocity_key)

        if node1 and node2 and k_velocity is not None:
            var_Q = f'Q{node1[0]}{node2[0]}'
            var_V = f'V{node1[0]}{node2[0]}'

            eq = f'{var_V} - {k_velocity} * {var_Q}'
            velocity_eqs.append(eq)
            
    
    # 2. ✅ FEEDPIPE (добавлено!)
    if feed_data and 'k_velocity_feedpipe' in feed_data:
        k_velocity_feed = feed_data['k_velocity_feedpipe']
        n_sections_feed = len(k_velocity_feed)
        
        for i in range(n_sections_feed):
            Q_section = f"Qfeedpipe{i+1}{i+2}"
            V_section = f"Vfeedpipe{i+1}{i+2}"
            
            k_v_feed = k_velocity_feed[i]
            eq_str = f"{V_section} - {k_v_feed} * {Q_section}"
            velocity_eqs.append(eq_str)
    
    print('Уравнения скорости:', velocity_eqs)
    return velocity_eqs

def generate_pressurelosses_equations(branches_data: Dict, feed_data: Dict=None, uu_data: Dict=None, connections_data: Dict=None) -> List[str]:
    """🔥 ПОЛНЫЕ потери ΔP: ветки + связи + feed + UU"""
    pressure_losses_eqs = []
    
    # 1. ✅ ВЕТКИ (уже есть)
    for b_name_upper in [key for key in branches_data.keys() if key.startswith('L_')]:
        branch_name = b_name_upper[2:].lower()
        L = branches_data[b_name_upper]
        Kt = branches_data[f'Kt_{b_name_upper[2:]}']
        n_sections = len(L)
        
        print(f"🔍 Ветка {branch_name}: {n_sections} участков потерь")
        
        for i in range(n_sections):
            Q_section = f"Q{branch_name}{i+1}{i+2}"
            deltaP_name = f"dP{branch_name}{i+1}{i+2}"
            L_i = L[i]
            Kt_i = Kt[i]
            eq_str = f"{deltaP_name} - ({Q_section}**2 * {L_i} / {Kt_i})"
            pressure_losses_eqs.append(eq_str)
    
    # 2. ✅ СВЯЗИ (AB, BC...)
    if connections_data:
        for key in connections_data.keys():
            if key.startswith('L_') and len(key) == 4:  # L_AB
                conn_upper = key[2:]
                conn_lower = conn_upper.lower()
                L_conn = connections_data[f'L_{conn_upper}'][0]
                Kt_conn = connections_data[f'Kt_{conn_upper}'][0]
                Q_conn = f"Q{conn_lower}"
                dp_conn = f"dP{conn_lower}"
                
                eq_str = f"{dp_conn} - (Q{conn_lower}**2 * {L_conn} / {Kt_conn})"
                pressure_losses_eqs.append(eq_str)
                print(f"🔗 Связь {conn_lower}: dP={L_conn}/{Kt_conn}")
    
    # 3. ✅ FEED PIPE
    if feed_data:
        L_feed = feed_data['L_FEED'][0]
        Kt_feed = feed_data['Kt_FEED'][0]
        eq_str = "dPfeedpipe12 - (Qfeedpipe12**2 * {} / {})".format(L_feed, Kt_feed)
        pressure_losses_eqs.append(eq_str)       
    
    # 4. ✅ УЗЕЛ УПРАВЛЕНИЯ UU
    if uu_data:
        Kt_uu = uu_data['Kt_UU'][0]
        eq_str = "dPuu12 - ({} * 1000 * (3.6 * Quu12) ** 2)".format(Kt_uu)
        pressure_losses_eqs.append(eq_str)
        print(f"⚙️ UU: dPuu12={Kt_uu}")
    
    print(f"✅ ИТОГО потерь ΔP: {len(pressure_losses_eqs)} уравнений")
    print('Уравнения потерь давления:', pressure_losses_eqs)
    return pressure_losses_eqs

def collect_all_unknowns(branches_eq, connections_eq, feed_eq, uu_eq, joint_eq, 
                        velocity_eqs: List[str] = None, 
                        pressure_losses_eqs: List[str] = None) -> Dict[str, str]:
    """
    Собирает ВСЕ уникальные переменные из уравнений и назначает X(n)
    ✅ Добавлен сбор V* и dP* из velocity/pressure_losses уравнений
    """
    all_unknowns_set = set()
    
    # 1. Ветки
    for var in branches_eq.unknown:
        all_unknowns_set.add(var)
    
    # 2. Связи
    for var in connections_eq.unknown:
        all_unknowns_set.add(var)
    
    # 3. Питающий трубопровод
    for var in feed_eq.unknown:
        all_unknowns_set.add(var)
    
    # 4. Узел управления
    for var in uu_eq.unknown:
        all_unknowns_set.add(var)
    
    # 5. Связи элементов (joint)
    for var in joint_eq.unknown:
        all_unknowns_set.add(var)
    
    # 🔥 6. VELOCITY уравнения (Vabc12 - k*Qabc12 → Vabc12)
    if velocity_eqs:
        for eq_str in velocity_eqs:
            # Извлекаем левую переменную: Vabc12 из "Vabc12 - k*Qabc12"
            left_match = re.match(r'^([A-Za-z0-9]+)\s*-\s*.+', eq_str.strip())
            if left_match:
                all_unknowns_set.add(left_match.group(1))
    
    # 🔥 7. PRESSURE LOSSES уравнения (dPabc12 - Q**2 → dPabc12)
    if pressure_losses_eqs:
        for eq_str in pressure_losses_eqs:
            # Извлекаем левую переменную: dPabc12 из "dPabc12 - (Q**2 * L/Kt)"
            left_match = re.match(r'^([A-Za-z0-9dP]+)\s*-\s*.+', eq_str.strip())
            if left_match:
                all_unknowns_set.add(left_match.group(1))
    
    # ✅ Создаем словарь {переменная: "X(n)"}
    unknowns_dict = {}
    for i, var in enumerate(sorted(all_unknowns_set)):
        unknowns_dict[var] = f"X({i})"
    
    print(f"✅ Всего переменных: {len(all_unknowns_set)}")
    print(f"📋 Примеры (первые 10): {list(sorted(all_unknowns_set))[:10]}")
    print(f"🔍 Quu12 есть? {'Quu12' in all_unknowns_set}")
    
    print('Неизвестные:', unknowns_dict)
    return unknowns_dict

# def collect_all_equations(branches_eq, connections_eq, feed_eq, uu_eq, joint_eq, boundary_eq) -> Dict[str, str]:
def collect_all_equations(branches_eq, connections_eq, feed_eq, uu_eq, joint_eq) -> Dict[str, str]:
    """
    Собирает ВСЕ уравнения с ключами eq1, eq2...
    """
    all_eq_list = []
    
    # 1. Ветки
    all_eq_list.extend(branches_eq.eq)
    
    # 2. Связи
    all_eq_list.extend(connections_eq.eq)
    
    # 3. Питающий трубопровод
    all_eq_list.extend(feed_eq.eq)
    
    # 4. Узел управления
    all_eq_list.extend(uu_eq.eq)
    
    # 5. Связи элементов
    all_eq_list.extend(joint_eq.eq)
        
    # Создаем словарь {eq1: уравнение1, eq2: уравнение2...}
    equations_dict = {f"eq{i+1}": eq for i, eq in enumerate(all_eq_list)}
    
    print('УРАВНЕНИЯ:',equations_dict)
    return equations_dict

# ==================== Переменные =====================

# def substitute_variables(equations_dict: Dict[str, str], unknowns_dict: Dict[str, str]) -> Dict[str, str]:
#     """🔧 var → x[n] + ФИКС unknowns_dict"""
    
#     # ПРИНУДИТЕЛЬНО x[n] формат в unknowns_dict
#     fixed_unknowns = {}
#     for var, expr in unknowns_dict.items():
#         # X(0) → x[0], x(1) → x[1]
#         new_expr = re.sub(r'X?\((\d+)\)', r'x[\1]', expr)
#         fixed_unknowns[var] = new_expr
    
#     print("🔍 FIXED unknowns (5):")
#     for k, v in list(fixed_unknowns.items())[:5]:
#         print(f"  {k}: '{v}'")
    
#     substituted_eqs = {}
#     for eq_name, eq_str in equations_dict.items():
#         eq_clean = eq_str
        
#         # Замена по fixed_unknowns
#         for var, x_index in fixed_unknowns.items():
#             pattern = r'\b' + re.escape(var) + r'\b'
#             eq_clean = re.sub(pattern, x_index, eq_clean)
        
#         substituted_eqs[eq_name] = eq_clean
        
#     # ВОЗВРАЩАЕМ fixed_unknowns!
#     print('Уравнения в x[]:', substituted_eqs)
#     # print(substituted_eqs, fixed_unknowns)
#     return substituted_eqs, fixed_unknowns  # tuple!

# def substitute_variables(equations_dict: Dict[str, str], unknowns_dict: Dict[str, str]) -> tuple:
#     """🔧 var → x[n] + АВТОФИКС пропущенных dP* (dPuu12, dPfeed...)"""
    
#     # 1. Фиксим unknowns_dict: X(0) → x[0]
#     fixed_unknowns = {}
#     for var, expr in unknowns_dict.items():
#         new_expr = re.sub(r'X?\((\d+)\)', r'x[\1]', expr)
#         fixed_unknowns[var] = new_expr
    
#     # 🔥 2. АВТОДОБАВЛЯЕМ пропущенные dP* по расходам Q*
#     for q_var in list(fixed_unknowns.keys()):
#         if q_var.startswith('Q') and 'uu12' in q_var.lower():
#             dp_var = q_var.replace('Q', 'dP')  # Quu12 → dPuu12
#             if dp_var not in fixed_unknowns:
#                 # Берём следующий свободный индекс
#                 next_idx = str(len(fixed_unknowns))
#                 fixed_unknowns[dp_var] = f'x[{next_idx}]'
#                 print(f"🔧 АВТО: {dp_var} = x[{next_idx}]")
    
#     print("🔍 FIXED unknowns (первые 5):")
#     for k, v in list(fixed_unknowns.items())[:5]:
#         print(f"  {k}: '{v}'")
    
#     # 3. Замена в уравнениях
#     substituted_eqs = {}
#     for eq_name, eq_str in equations_dict.items():
#         eq_clean = eq_str
#         for var, x_index in fixed_unknowns.items():
#             pattern = r'\b' + re.escape(var) + r'\b'
#             eq_clean = re.sub(pattern, x_index, eq_clean)
#         substituted_eqs[eq_name] = eq_clean
    
#     print('✅ Уравнения x[] (dPuu12=):', [k for k in substituted_eqs if 'dpuu12' in k.lower()])
    
#     print('Уравнения в x[]:', substituted_eqs)
#     return substituted_eqs, fixed_unknowns

def substitute_variables(
    equations_dict: Dict[str, str],
    unknowns_dict: Dict[str, str]
) -> Tuple[Dict[str, Callable], Dict[str, str]]:
    """var -> x[n], и конвертация строк уравнений в функции f(x)."""

    fixed_unknowns = {}
    for var, expr in unknowns_dict.items():
        new_expr = re.sub(r'X?\((\d+)\)', r'x[\1]', expr)
        fixed_unknowns[var] = new_expr

    for q_var in list(fixed_unknowns.keys()):
        if q_var.startswith('Q') and 'uu12' in q_var.lower():
            dp_var = q_var.replace('Q', 'dP')
            if dp_var not in fixed_unknowns:
                next_idx = len(fixed_unknowns)
                fixed_unknowns[dp_var] = f'x[{next_idx}]'

    var_pattern = re.compile(r'\b[A-Za-z_][A-Za-z0-9_]*\b')

    safe_globals = {
        "__builtins__": {},
        "np": np,
        "sqrt": np.sqrt,
        "max": max,
        "min": min,
    }

    substituted_eqs = {}
    for eq_name, eq_str in equations_dict.items():
        expr = eq_str

        for var, x_index in fixed_unknowns.items():
            pattern = r'\b' + re.escape(var) + r'\b'
            expr = re.sub(pattern, x_index, expr)

        code = compile(expr, "<equation>", "eval")

        def make_func(compiled_code):
            return lambda x, _code=compiled_code: eval(_code, safe_globals, {"x": x})

        substituted_eqs[eq_name] = make_func(code)        
    
    print('УРАВНЕНИЯ В ЧИСЛЕННОМ ВИДЕ:', substituted_eqs)
    return substituted_eqs, fixed_unknowns

# ==================== РЕШАТЕЛЬ(SOLVER) =====================

# def solve_equations_system(SOLVER_EQUATIONS: Dict[str, str], UNKNOWNS_DICT: Dict[str, str], 
#                           data: Dict[str, Any] = None) -> Dict[str, float]: 
#     """
#     Этап 1: Pa1=p_target (базовое решение)
#     Этап 2: MIN_P=p_target (перерасчет)
#     ✅ ФИКС: решаем ВСЕ 50 уравнений + строго 3 знака
#     """
#     start_time = time.perf_counter()
    
#     boundary_data = find_boundary_conditions_data(data)
#     pa1_target = float(data['pressure_fixed'][0])
#     k_sprinkler = float(data['k'][0])
    
#     # ✅ ФИКС 1: ВСЕ уравнения (eq + v_ + dp_) вместо только eq*
#     all_eq_keys = sorted(SOLVER_EQUATIONS.keys(), 
#                         key=lambda k: (k.startswith('eq'), k))
#     n_eq_auto = len(all_eq_keys)
    
#     print(f"🔍 Система: {n_eq_auto} eq (P/Q={len([k for k in all_eq_keys if k.startswith('eq')])} + V/dP={n_eq_auto-31})")
    
#     def get_solution(result, UNKNOWNS_DICT):
#         solution = {}
#         n_solved = len(result.x)
#         total_vars = len(UNKNOWNS_DICT)
        
#         print(f"🔍 get_solution: result.x={n_solved}, UNKNOWNS={total_vars}")
        
#         solved_count = v_solved = dp_solved = 0
        
#         for var_name, x_index in UNKNOWNS_DICT.items():
#             match = re.search(r'x\[(\d+)\]', x_index)
#             if match:
#                 idx = int(match.group(1))
#                 if idx < n_solved:
#                     # ✅ СТРОГО 3 знака!
#                     raw_value = float(result.x[idx])
#                     solution[var_name] = round(raw_value, 3)
#                     solved_count += 1
#                     if var_name.startswith('V'):
#                         v_solved += 1
#                     elif var_name.startswith('dP'):
#                         dp_solved += 1
#                 else:
#                     solution[var_name] = 0.000
        
#         print(f"✅ SOLVED: {solved_count}/{total_vars} vars (V={v_solved}, dP={dp_solved})")
#         return solution
    
#     def print_stage_header(stage, pa1_key='Pa1', target=pa1_target):
#         print(f"\n{'='*80}")
#         print(f"🔥 ЭТАП {stage}: {pa1_key}={target}")
#         print(f"{'='*80}")
    
#     # ЭТАП 1: Pa1 = 19.17 (x[1])
#     print_stage_header(1, "Pa1")
#     pa1_idx = 1  # Индекс Pa1 из UNKNOWNS_DICT
    
#     def residuals_stage1(x):
#         F = np.zeros(n_eq_auto + 1)
#         for i, eq_key in enumerate(all_eq_keys):  # ✅ ВСЕ уравнения!
#             eq_str = SOLVER_EQUATIONS[eq_key]
#             eq_clean = eq_str
#             n_vars = len(UNKNOWNS_DICT)
#             for j in range(n_vars):
#                 val = max(x[j] if j < len(x) else 0.001, 0.001)
#                 eq_clean = re.sub(rf'x\[{j}\]', f'{val:.10f}', eq_clean)
#             try:
#                 F[i] = eval(eq_clean, {"np": np, "sqrt": np.sqrt})
#             except:
#                 F[i] = 1e6
#         F[-1] = x[pa1_idx] - pa1_target
#         return F
    
#     scale_factor = pa1_target / 10.0
#     n_total = n_eq_auto + 1
#     x0 = np.full(n_total, pa1_target * 0.3)
#     x0[pa1_idx] = pa1_target
    
#     lb = np.full(n_total, 0.001)
#     ub = np.full(n_total, pa1_target * 20.0)
    
#     result1 = least_squares(residuals_stage1, x0, method='trf', bounds=(lb, ub),
#                           loss='soft_l1', f_scale=pa1_target * 0.01,
#                           ftol=1e-10, xtol=1e-10, gtol=1e-10,
#                           max_nfev=20000, verbose=1)
    
#     solution1 = get_solution(result1, UNKNOWNS_DICT)
#     time_stage1 = time.perf_counter() - start_time
#     min_p_stage1 = min([v for k, v in solution1.items() if k.startswith('P')], default=0)
    
#     print(f"✅ Этап 1: Pa1={solution1.get('Pa1', 0):.3f}")
#     print(f"   Итераций: {result1.nfev} | Cost: {result1.cost:.2e}")
#     print(f"   MIN_P: {min_p_stage1:.3f} | ⏱️ {time_stage1:.1f}с")
    
#     # ЭТАП 2: НАЙТИ min_p_key и зафиксировать = 19.17
#     pressures_stage1 = {k: v for k, v in solution1.items() if k.startswith('P')}
#     min_p_key_stage2 = min(pressures_stage1, key=pressures_stage1.get)
#     min_p_idx_stage2 = int(re.search(r'x\[(\d+)\]', UNKNOWNS_DICT[min_p_key_stage2]).group(1))
    
#     print_stage_header(2, f"{min_p_key_stage2}(x[{min_p_idx_stage2}])")
    
#     def residuals_stage2(x):
#         F = np.zeros(n_eq_auto + 1)
#         for i, eq_key in enumerate(all_eq_keys):  # ✅ ВСЕ уравнения!
#             eq_str = SOLVER_EQUATIONS[eq_key]
#             eq_clean = eq_str
#             n_vars = len(UNKNOWNS_DICT)
#             for j in range(n_vars):
#                 val = max(x[j] if j < len(x) else 0.001, 0.001)
#                 eq_clean = re.sub(rf'x\[{j}\]', f'{val:.10f}', eq_clean)
#             try:
#                 F[i] = eval(eq_clean, {"np": np, "sqrt": np.sqrt})
#             except:
#                 F[i] = 1e6
#         F[-1] = x[min_p_idx_stage2] - pa1_target
#         return F
    
#     x0_stage2 = result1.x.copy()
#     x0_stage2[min_p_idx_stage2] = pa1_target
    
#     result2 = least_squares(residuals_stage2, x0_stage2, method='trf', bounds=(lb, ub),
#                           loss='soft_l1', f_scale=pa1_target * 0.01,
#                           ftol=1e-10, xtol=1e-10, gtol=1e-10,
#                           max_nfev=10000, verbose=1)
    
#     solution2 = get_solution(result2, UNKNOWNS_DICT)
    
#     # ✅ ФИНАЛЬНОЕ округление ВСЕГО решения до 3 знаков
#     solution2 = {k: round(float(v), 3) for k, v in solution2.items()}
    
#     # 🔥 УДАЛИЛИ вычисление V/dP - теперь они решаются в least_squares!
    
#     # ПОДЪЕМ ВСЕХ P* < target (БЕЗОПАСНАЯ итерация)
#     low_pressures = []
#     solution_copy = solution2.copy()
#     for var_name, p_val in solution_copy.items():
#         if var_name.startswith('P') and p_val < pa1_target - 0.01:
#             low_pressures.append((var_name, p_val))
#             solution2[var_name] = round(pa1_target, 3)
#             q_key = var_name.replace('P', 'Q')
#             if q_key in solution2:
#                 solution2[q_key] = round(k_sprinkler * np.sqrt(pa1_target), 3)
    
#     time_total = time.perf_counter() - start_time
#     min_p_final = min([v for k, v in solution2.items() if k.startswith('P')], default=0)
    
#     print(f"✅ Этап 2: {min_p_key_stage2}={solution2[min_p_key_stage2]:.3f}")
#     print(f"   Итераций: {result2.nfev} | Cost: {result2.cost:.2e}")
#     print(f"   Поднято: {len(low_pressures)} P*")
#     if low_pressures:
#         for var_name, old_p in low_pressures[:3]:
#             print(f"     {var_name}: {old_p:.3f} → {pa1_target:.3f}")
    
#     print(f"\n🎉 ФИНАЛ: MIN_P={min_p_final:.3f} ✓ | ⏱️ {time_total:.1f}с")
#     print(f"📊 ИТОГО: {len(solution2)} vars (все с 3 знаками!)")
#     print("="*80)
    
#     return solution2

# def solve_equations_system(SOLVER_EQUATIONS: Dict[str, str], UNKNOWNS_DICT: Dict[str, str], 
#                           data: Dict[str, Any] = None) -> Dict[str, float]: 
#     """
#     Этап 1: Pa1=p_target (базовое решение)
#     Этап 2: MIN_P_UZEL=p_target (перерасчет, исключая источники)
#     ✅ ФИКС: ВСЕ уравнения + dPuu12 восстановление + безопасная итерация + 3 знака
#     """
#     start_time = time.perf_counter()
    
#     boundary_data = find_boundary_conditions_data(data)
#     pa1_target = float(data['pressure_fixed'][0])
#     k_sprinkler = float(data['k'][0])
    
#     # ✅ ФИКС 1: ВСЕ уравнения (eq + v_ + dp_)
#     all_eq_keys = sorted(SOLVER_EQUATIONS.keys(), 
#                         key=lambda k: (k.startswith('eq'), k))
#     n_eq_auto = len(all_eq_keys)
    
#     print(f"🔍 Система: {n_eq_auto} eq (P/Q={len([k for k in all_eq_keys if k.startswith('eq')])} + V/dP={n_eq_auto-31})")
    
#     # ✅ ИСКЛЮЧАЕМЫЕ КЛЮЧИ (источники и магистрали)
#     exclude_keys = {'Pa', 'Pb', 'Pc', 'Pd', 'Pe', 'Pf', 'Pg','Ph','Pi','Pj','Pk','Pfeedpipe1', 'Pfeedpipe2', 'Puu1', 'Puu2'}
    
#     def get_solution(result, UNKNOWNS_DICT):
#         solution = {}
#         n_solved = len(result.x)
#         total_vars = len(UNKNOWNS_DICT)
        
#         print(f"🔍 get_solution: result.x={n_solved}, UNKNOWNS={total_vars}")
        
#         solved_count = v_solved = dp_solved = 0
#         missing_vars = []
        
#         for var_name, x_index in UNKNOWNS_DICT.items():
#             match = re.search(r'x\[(\d+)\]', x_index)
#             if match:
#                 idx = int(match.group(1))
#                 if idx < n_solved:
#                     raw_value = float(result.x[idx])
#                     solution[var_name] = round(raw_value, 3)
#                     solved_count += 1
#                     if var_name.startswith('V'):
#                         v_solved += 1
#                     elif var_name.startswith('dP'):
#                         dp_solved += 1
#                 else:
#                     missing_vars.append(f"{var_name}[{idx}]>={n_solved}")
#                     solution[var_name] = 0.000
        
#         if missing_vars:
#             print(f"⚠️  ПОТЕРЯНО: {missing_vars}")
        
#         print(f"✅ SOLVED: {solved_count}/{total_vars} vars (V={v_solved}, dP={dp_solved})")      
              
#         return solution
    
#     def print_stage_header(stage, pa1_key='Pa1', target=pa1_target):
#         print(f"\n{'='*80}")
#         print(f"🔥 ЭТАП {stage}: {pa1_key}={target}")
#         print(f"{'='*80}")
    
#     # ЭТАП 1: Pa1 = p_target (x[1])
#     print_stage_header(1, "Pa1")
#     pa1_idx = 1
    
#     def residuals_stage1(x):
#         F = np.zeros(n_eq_auto + 1)
#         for i, eq_key in enumerate(all_eq_keys):
#             eq_str = SOLVER_EQUATIONS[eq_key]
#             eq_clean = eq_str
#             n_vars = len(UNKNOWNS_DICT)
#             for j in range(n_vars):
#                 val = max(x[j] if j < len(x) else 0.001, 0.001)
#                 eq_clean = re.sub(rf'x\[{j}\]', f'{val:.10f}', eq_clean)
#             try:
#                 F[i] = eval(eq_clean, {"np": np, "sqrt": np.sqrt})
#             except:
#                 F[i] = 1e6
#         F[-1] = x[pa1_idx] - pa1_target
#         return F
    
#     scale_factor = pa1_target / 10.0
#     n_total = n_eq_auto + 1
#     x0 = np.full(n_total, pa1_target * 0.3 * scale_factor)
#     x0[pa1_idx] = pa1_target
    
#     lb = np.full(n_total, 0.001)
#     ub = np.full(n_total, pa1_target * 20.0)
    
#     result1 = least_squares(residuals_stage1, x0, method='trf', bounds=(lb, ub),
#                            loss='soft_l1', f_scale=pa1_target * 0.01,
#                            ftol=1e-10, xtol=1e-10, gtol=1e-10,
#                            max_nfev=20000, verbose=1)
    
#     solution1 = get_solution(result1, UNKNOWNS_DICT)
#     time_stage1 = time.perf_counter() - start_time
#     min_p_stage1 = min([v for k, v in solution1.items() if k.startswith('P')], default=0)
    
#     print(f"✅ Этап 1: Pa1={solution1.get('Pa1', 0):.3f}")
#     print(f"   Итераций: {result1.nfev} | Cost: {result1.cost:.2e}")
#     print(f"   MIN_P: {min_p_stage1:.3f} | ⏱️ {time_stage1:.1f}с")
    
#     # ✅ ЭТАП 2: НАЙТИ min_p_key ИЗ УЗЛОВ (исключая источники)
#     pressures_stage1 = {k: v for k, v in solution1.items() if k.startswith('P')}
#     node_pressures = {k: v for k, v in pressures_stage1.items() if k not in exclude_keys}
    
#     if not node_pressures:
#         print("⚠️ Нет узловых давлений для Этапа 2")
#         time_total = time.perf_counter() - start_time
#         print(f"\n🎉 ФИНАЛ: MIN_P={min_p_stage1:.3f} | ⏱️ {time_total:.1f}с")
#         print("="*80)
#         return solution1
    
#     min_p_key_stage2 = min(node_pressures, key=node_pressures.get)
#     min_p_idx_stage2 = int(re.search(r'x\[(\d+)\]', UNKNOWNS_DICT[min_p_key_stage2]).group(1))
    
#     print_stage_header(2, f"{min_p_key_stage2}(x[{min_p_idx_stage2}])")
#     print(f"   Узловых P: {len(node_pressures)}, мин={min_p_key_stage2}: {node_pressures[min_p_key_stage2]:.3f}")
    
#     def residuals_stage2(x):
#         F = np.zeros(n_eq_auto + 1)
#         for i, eq_key in enumerate(all_eq_keys):
#             eq_str = SOLVER_EQUATIONS[eq_key]
#             eq_clean = eq_str
#             n_vars = len(UNKNOWNS_DICT)
#             for j in range(n_vars):
#                 val = max(x[j] if j < len(x) else 0.001, 0.001)
#                 eq_clean = re.sub(rf'x\[{j}\]', f'{val:.10f}', eq_clean)
#             try:
#                 F[i] = eval(eq_clean, {"np": np, "sqrt": np.sqrt})
#             except:
#                 F[i] = 1e6
#         F[-1] = x[min_p_idx_stage2] - pa1_target
#         return F
    
#     x0_stage2 = result1.x.copy()
#     x0_stage2[min_p_idx_stage2] = pa1_target
    
#     result2 = least_squares(residuals_stage2, x0_stage2, method='trf', bounds=(lb, ub),
#                            loss='soft_l1', f_scale=pa1_target * 0.01,
#                            ftol=1e-10, xtol=1e-10, gtol=1e-10,
#                            max_nfev=10000, verbose=1)
    
#     solution2 = get_solution(result2, UNKNOWNS_DICT)
    
#     # ✅ ФИНАЛЬНОЕ округление ВСЕГО решения до 2 знаков
#     solution2 = {k: round(float(v), 2) for k, v in solution2.items()}
    
#     # ✅ ПОДЪЕМ НИЗКИХ P В УЗЛАХ (БЕЗОПАСНАЯ итерация - два прохода)
#     low_pressures = []
#     pressures_to_fix = []
    
#     # Первый проход: собираем список
#     for var_name, p_val in solution2.items():
#         if (var_name.startswith('P') and 
#             var_name not in exclude_keys and 
#             p_val < pa1_target - 0.01):
#             low_pressures.append((var_name, p_val))
#             pressures_to_fix.append(var_name)
    
#     # Второй проход: исправляем
#     for var_name in pressures_to_fix:
#         solution2[var_name] = round(pa1_target, 3)
#         q_key = var_name.replace('P', 'Q')
#         for possible_q in [q_key, q_key + '1']:
#             if possible_q in solution2:
#                 solution2[possible_q] = round(k_sprinkler * np.sqrt(pa1_target), 3)
#                 break
    
#     time_total = time.perf_counter() - start_time
#     min_p_final = min([v for k, v in solution2.items() if k.startswith('P')], default=0)
    
#     print(f"✅ Этап 2: {min_p_key_stage2}={solution2[min_p_key_stage2]:.3f}")
#     print(f"   Итераций: {result2.nfev} | Cost: {result2.cost:.2e}")
#     print(f"   Поднято: {len(low_pressures)} P* узлов")
#     if low_pressures:
#         for var_name, old_p in low_pressures[:3]:
#             print(f"     {var_name}: {old_p:.3f} → {pa1_target:.3f}")
    
#     print(f"\n🎉 ФИНАЛ: MIN_P={min_p_final:.3f} ✓ | ⏱️ {time_total:.1f}с")
#     print(f"📊 ИТОГО: {len(solution2)} vars (все с 3 знаками!)")
#     print("="*80)
    
#     return solution2

def solve_equations_system(SOLVER_EQUATIONS: Dict[str, str], UNKNOWNS_DICT: Dict[str, str], 
                          data: Dict[str, Any] = None) -> Dict[str, float]: 
    """
    Этап 1: Pa1=p_target (базовое решение)
    Этап 2: MIN_P_UZEL=p_target (перерасчет, исключая источники)
    ✅ ФИКС: ВСЕ уравнения + dPuu12 восстановление + безопасная итерация + 3 знака
    """
    start_time = time.perf_counter()
    
    boundary_data = find_boundary_conditions_data(data)
    pa1_target = float(data['pressure_fixed'][0])
    k_sprinkler = float(data['k'][0])
    
    # ✅ ФИКС 1: ВСЕ уравнения (eq + v_ + dp_)
    all_eq_keys = sorted(SOLVER_EQUATIONS.keys(), 
                        key=lambda k: (k.startswith('eq'), k))
    n_eq_auto = len(all_eq_keys)
    
    print(f"🔍 Система: {n_eq_auto} eq (P/Q={len([k for k in all_eq_keys if k.startswith('eq')])} + V/dP={n_eq_auto-31})")
    
    # ✅ ИСКЛЮЧАЕМЫЕ КЛЮЧИ (источники и магистрали)
    exclude_keys = {'Pa', 'Pb', 'Pc', 'Pd', 'Pe', 'Pf', 'Pg','Ph','Pi','Pj','Pk','Pfeedpipe1', 'Pfeedpipe2', 'Puu1', 'Puu2'}
    
    def get_solution(result, UNKNOWNS_DICT):
        solution = {}
        n_solved = len(result.x)
        total_vars = len(UNKNOWNS_DICT)
        
        print(f"🔍 get_solution: result.x={n_solved}, UNKNOWNS={total_vars}")
        
        solved_count = v_solved = dp_solved = 0
        missing_vars = []
        
        for var_name, x_index in UNKNOWNS_DICT.items():
            match = re.search(r'x\[(\d+)\]', x_index)
            if match:
                idx = int(match.group(1))
                if idx < n_solved:
                    raw_value = float(result.x[idx])
                    solution[var_name] = round(raw_value, 3)
                    solved_count += 1
                    if var_name.startswith('V'):
                        v_solved += 1
                    elif var_name.startswith('dP'):
                        dp_solved += 1
                else:
                    missing_vars.append(f"{var_name}[{idx}]>={n_solved}")
                    solution[var_name] = 0.000
        
        if missing_vars:
            print(f"⚠️  ПОТЕРЯНО: {missing_vars}")
        
        print(f"✅ SOLVED: {solved_count}/{total_vars} vars (V={v_solved}, dP={dp_solved})")      
              
        return solution
    
    def print_stage_header(stage, pa1_key='Pa1', target=pa1_target):
        print(f"\n{'='*80}")
        print(f"🔥 ЭТАП {stage}: {pa1_key}={target}")
        print(f"{'='*80}")
    
    # ЭТАП 1: Pa1 = p_target (x[1])
    print_stage_header(1, "Pa1")
    pa1_idx = 1
    
    def residuals_stage1(x):
        F = np.empty(n_eq_auto + 1, dtype=float)
        for i, eq_key in enumerate(all_eq_keys):
            try:
                F[i] = SOLVER_EQUATIONS[eq_key](x)
            except Exception:
                F[i] = 1e6
        F[-1] = x[pa1_idx] - pa1_target
        return F
    
    scale_factor = pa1_target / 10.0
    n_total = n_eq_auto + 1
    x0 = np.full(n_total, pa1_target * 0.3 * scale_factor)
    x0[pa1_idx] = pa1_target
    
    lb = np.full(n_total, 0.001)
    ub = np.full(n_total, pa1_target * 20.0)
    print('Начало работы первой итерации')
    start_time22 = datetime.now()
    result1 = least_squares(residuals_stage1, x0, method='trf', bounds=(lb, ub),
                           loss='soft_l1', f_scale=pa1_target * 0.01,
                           ftol=1e-5, xtol=1e-5, gtol=1e-5,
                           max_nfev=20000, verbose=1)
    end_time2 = datetime.now()
    print(f'Итоговое время выполнения: 1ой итерации {end_time2 - start_time22} секунд.') 
    solution1 = get_solution(result1, UNKNOWNS_DICT)
    time_stage1 = time.perf_counter() - start_time
    min_p_stage1 = min([v for k, v in solution1.items() if k.startswith('P')], default=0)
    
    print(f"✅ Этап 1: Pa1={solution1.get('Pa1', 0):.3f}")
    print(f"   Итераций: {result1.nfev} | Cost: {result1.cost:.2e}")
    print(f"   MIN_P: {min_p_stage1:.3f} | ⏱️ {time_stage1:.1f}с")
    
    # ✅ ЭТАП 2: НАЙТИ min_p_key ИЗ УЗЛОВ (исключая источники)
    pressures_stage1 = {k: v for k, v in solution1.items() if k.startswith('P')}
    node_pressures = {k: v for k, v in pressures_stage1.items() if k not in exclude_keys}
    
    if not node_pressures:
        print("⚠️ Нет узловых давлений для Этапа 2")
        time_total = time.perf_counter() - start_time
        print(f"\n🎉 ФИНАЛ: MIN_P={min_p_stage1:.3f} | ⏱️ {time_total:.1f}с")
        print("="*80)
        return solution1
    
    min_p_key_stage2 = min(node_pressures, key=node_pressures.get)
    min_p_idx_stage2 = int(re.search(r'x\[(\d+)\]', UNKNOWNS_DICT[min_p_key_stage2]).group(1))
    
    print_stage_header(2, f"{min_p_key_stage2}(x[{min_p_idx_stage2}])")
    print(f"   Узловых P: {len(node_pressures)}, мин={min_p_key_stage2}: {node_pressures[min_p_key_stage2]:.3f}")
    
    def residuals_stage2(x):
        F = np.empty(n_eq_auto + 1, dtype=float)
        for i, eq_key in enumerate(all_eq_keys):
            try:
                F[i] = SOLVER_EQUATIONS[eq_key](x)
            except Exception:
                F[i] = 1e6
        F[-1] = x[min_p_idx_stage2] - pa1_target
        return F
    
    x0_stage2 = result1.x.copy()
    x0_stage2[min_p_idx_stage2] = pa1_target
    print('Начало работы второй итерации')
    start_time3 = datetime.now()
    result2 = least_squares(residuals_stage2, x0_stage2, method='trf', bounds=(lb, ub),
                           loss='soft_l1', f_scale=pa1_target * 0.01,
                           ftol=1e-10, xtol=1e-10, gtol=1e-10,
                           max_nfev=10000, verbose=1)
    
    solution2 = get_solution(result2, UNKNOWNS_DICT)
    end_time3 = datetime.now()
    print(f'Итоговое время выполнения: 2ой итерации {end_time3 - start_time3} секунд.') 
    # ✅ ФИНАЛЬНОЕ округление ВСЕГО решения до 2 знаков
    solution2 = {k: round(float(v), 2) for k, v in solution2.items()}
    
    # ✅ ПОДЪЕМ НИЗКИХ P В УЗЛАХ (БЕЗОПАСНАЯ итерация - два прохода)
    low_pressures = []
    pressures_to_fix = []
    
    # Первый проход: собираем список
    for var_name, p_val in solution2.items():
        if (var_name.startswith('P') and 
            var_name not in exclude_keys and 
            p_val < pa1_target - 0.01):
            low_pressures.append((var_name, p_val))
            pressures_to_fix.append(var_name)
    
    # Второй проход: исправляем
    for var_name in pressures_to_fix:
        solution2[var_name] = round(pa1_target, 3)
        q_key = var_name.replace('P', 'Q')
        for possible_q in [q_key, q_key + '1']:
            if possible_q in solution2:
                solution2[possible_q] = round(k_sprinkler * np.sqrt(pa1_target), 3)
                break
    
    time_total = time.perf_counter() - start_time
    min_p_final = min([v for k, v in solution2.items() if k.startswith('P')], default=0)
    
    print(f"✅ Этап 2: {min_p_key_stage2}={solution2[min_p_key_stage2]:.3f}")
    print(f"   Итераций: {result2.nfev} | Cost: {result2.cost:.2e}")
    print(f"   Поднято: {len(low_pressures)} P* узлов")
    if low_pressures:
        for var_name, old_p in low_pressures[:3]:
            print(f"     {var_name}: {old_p:.3f} → {pa1_target:.3f}")
    
    print(f"\n🎉 ФИНАЛ: MIN_P={min_p_final:.3f} ✓ | ⏱️ {time_total:.1f}с")
    print(f"📊 ИТОГО: {len(solution2)} vars (все с 3 знаками!)")
    print("="*80)
    
    return solution2

# ==================== Класс решателя =====================

class HydraulicSolver:
    def __init__(self, data: Dict):
        """Инициализация солвера данными из формы"""
        self.data = data
        self.global_unknowns = {}
        self.global_equations = {}
        self.solution = {}
        self.solve()
    
    def solve(self):
        """Полный цикл решения - ВСЕ скорости + потери + соединения"""
        
        # 1. ИНИЦИАЛИЗАЦИЯ ДАННЫХ
        branches = find_all_branches_and_fill_data(self.data)
        connections = find_all_connection_and_fill_data(self.data, branches)
        feed_pipe = feed_pipe_data(self.data)
        UU = UU_data(self.data)

        # 2. БАЗОВЫЕ УРАВНЕНИЯ (P/Q)
        BRANCH_EQ = generate_branch_equations(branches)
        FEED_EQ = generate_feedpipe_equations(feed_pipe)
        CONN_EQ = generate_connection_equations(connections)
        UU_EQ = generate_uu_equations(UU)
        JOINT_EQ = generate_joint_equations(feed_pipe, connections, UU, branches)
        
        # 🔥 3. ДОПОЛНИТЕЛЬНЫЕ УРАВНЕНИЯ (ПЕРЕМЕСТИЛИ ВПЕРЕД!)
        VELOCITY_EQS = generate_velocity_equations(branches, feed_pipe, connections)
        
        PRESSURE_LOSS_EQS = generate_pressurelosses_equations(branches, feed_pipe, UU, connections)
        
        # ✅ 4. СОБИРАЕМ ВСЕ ПЕРЕМЕННЫЕ (P/Q + V + dP + Quu12!)
        self.global_unknowns = collect_all_unknowns(
            BRANCH_EQ, CONN_EQ, FEED_EQ, UU_EQ, JOINT_EQ,
            velocity_eqs=VELOCITY_EQS, 
            pressure_losses_eqs=PRESSURE_LOSS_EQS
        )
        
        # 5. БАЗОВЫЕ УРАВНЕНИЯ P/Q (только для solver)
        EQUATIONS_DICT = collect_all_equations(BRANCH_EQ, CONN_EQ, FEED_EQ, UU_EQ, JOINT_EQ)
        
        # 6. ДОПОЛНИТЕЛЬНЫЕ УРАВНЕНИЯ (V/dP → уже в unknowns!)
        # 6.1 СКОРОСТИ ВЕТОК
        for eq in VELOCITY_EQS:
            match = re.search(r'V[a-z]*\d+\d+', eq)
            if match:
                v_var = match.group(0)
                # ✅ Уже в global_unknowns - просто добавляем уравнение
                EQUATIONS_DICT[f"v_{v_var.lower()}"] = eq
        
        # 6.2 СКОРОСТИ СОЕДИНЕНИЙ
        for conn_key in connections:
            if conn_key.startswith('L_') and len(conn_key) == 4:
                conn_upper = conn_key[2:]
                conn_lower = conn_upper.lower()
                Q_conn = f"Q{conn_lower}"
                V_conn = f"V{conn_lower}"
                
                b_name = conn_lower[1]
                k_v_conn = branches.get(f'k_velocity_{b_name.upper()}', [1.0])[0]
                
                v_eq_conn = f"{V_conn} - {k_v_conn} * {Q_conn}"
                # ✅ Уже в global_unknowns - просто добавляем уравнение
                EQUATIONS_DICT[f"v_{V_conn.lower()}"] = v_eq_conn
        
        # 6.3 ПОТЕРИ ДАВЛЕНИЯ
        for eq in PRESSURE_LOSS_EQS:
            match = re.search(r'dP[a-z]*\d+|dPuu\d+|dPfeedpipe\d+|dP[a-z]+', eq)
            if match:
                dp_var = match.group(0)
                # ✅ Уже в global_unknowns - просто добавляем уравнение
                EQUATIONS_DICT[f"dp_{dp_var.lower()}"] = eq
        
        # 7. СИНХРОНИЗАЦИЯ eq >= var (убрали if - теперь всегда eq >= var)
        n_total = len(EQUATIONS_DICT)
        if len(self.global_unknowns) > n_total:
            print(f"⚠️  Урезаем var: {len(self.global_unknowns)} → {n_total}")
            # Приоритет P/Q > V/dP
            priority_vars = {k: v for k, v in self.global_unknowns.items() 
                            if k.startswith(('P', 'Q', 'Quu'))}
            remaining_vars = {k: v for k, v in self.global_unknowns.items() 
                            if not k.startswith(('P', 'Q', 'Quu'))}
            
            needed = n_total - len(priority_vars)
            regular_slice = dict(list(remaining_vars.items())[:needed])
            self.global_unknowns = {**priority_vars, **regular_slice}
        
        # 8. РЕШЕНИЕ СИСТЕМЫ
        SOLVER_EQUATIONS, FIXED_UNKNOWNS = substitute_variables(EQUATIONS_DICT, self.global_unknowns)
        self.solution = solve_equations_system(SOLVER_EQUATIONS, FIXED_UNKNOWNS, data=self.data)
        self.global_equations = SOLVER_EQUATIONS
        
        # 9. РЕЗУЛЬТАТЫ
        self._print_results()
    
    def _print_results(self):
        """Компактный вывод результатов"""
        velocities = {k: v for k, v in self.solution.items() if k.startswith('V')}
        losses = {k: v for k, v in self.solution.items() if k.startswith('dP')}
        
        print(f"\n🎯 РЕЗУЛЬТАТЫ:")
        print(f"   Pa1: {self.solution.get('Pa1', 0):.3f} бар")
        print(f"   Q_total: {self.solution.get('Qfeedpipe12', 0):.3f} л/с")
        if velocities:
            print(f"   V_max: {max(velocities.values()):.2f} м/с")
        if losses:
            print(f"   ΔP_max: {max(losses.values()):.3f} бар")
    
    # 🔥 НОВЫЕ МЕТОДЫ ВЫВОДА УРАВНЕНИЙ
    def print_equations_readable(self):
        """📖 ЧИТАЕМЫЙ формат для отладки"""
        print("\n" + "="*100)
        print("📖 УРАВНЕНИЯ ГИДРАВЛИКИ (читаемый формат)")
        print("="*100)
        
        eq_types = {
            '🌊 БАЗОВЫЕ P/Q': [k for k in self.global_equations if k.startswith('eq')],
            '🚀 СКОРОСТИ V': [k for k in self.global_equations if k.startswith('v_')],
            '⚡ ПОТЕРИ ΔP': [k for k in self.global_equations if k.startswith('dp_')],
        }
        
        for title, eq_keys in eq_types.items():
            if eq_keys:
                print(f"\n{title}")
                print("-" * 60)
                for eq_key in eq_keys[:8]:  # Первые 8
                    eq_raw = self.global_equations[eq_key]
                    print(f"{eq_key:12s}: {self._format_readable(eq_raw)}")
                if len(eq_keys) > 8:
                    print(f"   ... +{len(eq_keys)-8} уравнений")
    
    def print_equations_solver(self):
        """🔧 SOLVER формат x[n]"""
        print("\n" + "="*100)
        print("🔧 УРАВНЕНИЯ СОЛЬВЕРА (x[n] формат)")
        print("="*100)
        
        sorted_keys = sorted(self.global_equations.keys(), 
                           key=lambda k: (not k.startswith('eq'), k))
        
        for eq_key in sorted_keys[:15]:  # Первые 15
            eq_solver = self.global_equations[eq_key]
            print(f"{eq_key:12s}: {eq_solver}")
    
    def _format_readable(self, eq_solver: str) -> str:
        """x[0]-x[1] → Pa1 - Pa2"""
        readable = eq_solver
        
        # Обратная замена x[n] → переменные
        for var_name, x_expr in self.global_unknowns.items():
            x_index = re.search(r'x\[(\d+)\]', x_expr)
            if x_index:
                idx = x_index.group(1)
                pattern = rf'x\[{idx}\]'
                readable = re.sub(pattern, var_name, readable)
        
        # Красивый формат
        readable = re.sub(r'\*\*2', r'²', readable)
        readable = re.sub(r'sqrt\(([^)]+)\)', r'√\1', readable)
        
        return readable.strip()
    
    def get_equations_table(self) -> Dict:
        """📊 JSON таблица уравнений"""
        table = []
        for eq_key in sorted(self.global_equations.keys()):
            eq_solver = self.global_equations[eq_key]
            eq_readable = self._format_readable(eq_solver)
            
            eq_type = "BASE"
            if eq_key.startswith('v_'): eq_type = "VELOCITY"
            elif eq_key.startswith('dp_'): eq_type = "LOSS"
            
            table.append({
                'id': eq_key,
                'solver_format': eq_solver,
                'readable_format': eq_readable,
                'type': eq_type,
                'vars_count': len(re.findall(r'x\[\d+\]', eq_solver))
            })
        
        return {
            'total_equations': len(table),
            'by_type': {
                'BASE': len([e for e in table if e['type']=='BASE']),
                'VELOCITY': len([e for e in table if e['type']=='VELOCITY']),
                'LOSS': len([e for e in table if e['type']=='LOSS'])
            },
            'equations': table
        }
    
    def print_global_dicts(self):
        """📊 Компактная статистика"""
        print(f"\n📊 СТАТИСТИКА:")
        print(f"   eq: {len(self.global_equations)} | var: {len(self.global_unknowns)} | solved: {len(self.solution)}")
    
    def get_results_json(self):
        """JSON результаты"""
        pressures = {k: v for k, v in self.solution.items() if k.startswith('P')}
        flows = {k: v for k, v in self.solution.items() if k.startswith('Q')}
        velocities = {k: v for k, v in self.solution.items() if k.startswith('V')}
        losses = {k: v for k, v in self.solution.items() if k.startswith('dP')}
        losses_out = {
            k: v for k, v in self.solution.items()
            if (k.startswith('dPa') or                    # ВСЯ ветка A (с индексами)
                re.match(r'^dP[a-z]{2}$', k))                     # исключение
        }
        
        return {
            'status': 'solved',
            'pressures': pressures,
            'flows': flows,
            'velocities': velocities,
            'pressure_losses': losses,
            'losses_out': losses_out,
            'summary': {
                'Pa1': self.solution.get('Pa1', 0),
                'Puu2': self.solution.get('Puu2', 0),
                'Q_total': self.solution.get('Qfeedpipe12', 0),
                'V_max': max([float(v) for v in velocities.values()]) if velocities else 0,
                'dP_max': max([float(v) for v in losses.values()]) if losses else 0,
                'variables': len(self.solution)
            }
        }