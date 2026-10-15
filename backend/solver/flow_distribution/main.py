# ============================================================================
# main.py
# ============================================================================
# Точка входа расчёта гидравлической сети из JSON.
#
# Последовательность:
#     1. Создание builder.
#     2. Построение графа сети.
#     3. Построение матриц R, C, S и векторов параметров.
#     4. Запуск расчёта.
#     5. Формирование JSON-результата для веб-интерфейса.
# ============================================================================

import numpy as np

from .system_builder import HydraulicSystemBuilder
from .solver import run_calculation


def run_from_dict(json_data):
    """
    Выполняет полный гидравлический расчёт сети из JSON.

    Параметры:
        json_data — словарь с ключами:
            'Node'
            'Edge'
            'PRESSURE_TARGET' — необязательный

    Возвращает:
        dict — результат в формате, удобном для API / Three.js.
    """

    # --------------------------------------------------------------------
    # 1. СОЗДАНИЕ И ПОДГОТОВКА МОДЕЛИ
    # --------------------------------------------------------------------
    builder = HydraulicSystemBuilder(json_data)

    # Построение графа: узлы, трубы, индексы источников и оросителей
    builder.build_graph()

    # Построение матриц R, C, S и формирование уравнений.
    # K_sprinkler читается из каждого узла JSON.
    builder.build_matrices()

    # Диагностика модели
    builder.diagnose()

    # --------------------------------------------------------------------
    # 2. ЗАПУСК РАСЧЁТА
    # --------------------------------------------------------------------
    results = run_calculation(builder)

    # --------------------------------------------------------------------
    # 3. ИЗВЛЕЧЕНИЕ РЕЗУЛЬТАТОВ
    # --------------------------------------------------------------------

    # Расходы в трубах, размер M
    Q_final = np.asarray(results["Q_pipes"])

    # Давления в узлах, размер N
    P_final = np.asarray(results["P_nodes"])

    # Расходы потребителей, размер n_out
    Qout_final = np.asarray(results["Q_sprinklers"])

    # Расходы источников, размер n_in
    Qin_final = np.asarray(results["Q_sources"])

    # Скорости в трубах, размер M
    V_final = np.asarray(results["V_pipes"])

    # Подобранные давления источников, размер n_in
    P_sources = np.asarray(results["P_sources"])

    # Индекс диктующего оросителя в общем списке узлов
    dictating_idx = results["dictating_idx"]

    # Параметры характеристики сети
    K_system = results["K_system"]
    H_max = results["H_max"]
    Q_total = results["Q_total"]
    min_pressure = results["min_pressure"]

    # Невязки
    residual_norm = results["residual_norm"]
    max_residual = results["max_residual"]

    # ВРЕМЯ РАСЧЁТА.
    # В solver.py timing должен возвращаться словарём:
    # {
    #     "stage1_s": ...,
    #     "source_search_s": ...,
    #     "final_solve_s": ...,
    #     "total_s": ...
    # }
    timing = results["timing"]

    t1_time = timing["stage1_s"]
    t2_time = timing["source_search_s"]
    t3_time = timing["final_solve_s"]
    calc_time_s = timing["total_s"]

    # --------------------------------------------------------------------
    # 4. ОСНОВНЫЕ ПАРАМЕТРЫ РАСЧЁТА
    # --------------------------------------------------------------------
    # Первый источник используется как основной в summary
    first_source_idx = builder.source_indices[0]
    first_source_uuid = builder.idx_to_node_uuid[first_source_idx]

    # Давления всех источников
    source_pressures = {}

    for k, source_idx in enumerate(builder.source_indices):
        source_uuid = builder.idx_to_node_uuid[source_idx]

        source_pressures[source_uuid] = round(
            float(P_sources[k]),
            4
        )

    # --------------------------------------------------------------------
    # 5. UUID ДИКТУЮЩЕГО ОРОСИТЕЛЯ
    # --------------------------------------------------------------------
    dictating_node_uuid = str(
        builder.idx_to_node_uuid[dictating_idx]
    )

    # --------------------------------------------------------------------
    # 6. БАЗОВЫЙ РЕЗУЛЬТАТ
    # --------------------------------------------------------------------
    result = {
        "status": "success",

        "summary": {
            "source_pressure_m": round(
                float(P_sources[0]),
                4
            ),

            "source_pressures_m": source_pressures,

            "total_flow_l_s": round(
                float(Q_total),
                4
            ),

            "dictating_node_uuid": dictating_node_uuid,

            "min_sprinkler_pressure_m": round(
                float(min_pressure),
                4
            ),

            "pressure_target_m": round(
                float(builder.pressure_target),
                4
            ),

            "K_system": round(
                float(K_system),
                6
            ),

            "H_max": round(
                float(H_max),
                6
            ),

            # ------------------------------------------------------------
            # ВРЕМЯ РАСЧЁТА
            # ------------------------------------------------------------
            "timing": {
                "stage1_s": round(
                    float(t1_time),
                    6
                ),
                "source_search_s": round(
                    float(t2_time),
                    6
                ),
                "final_solve_s": round(
                    float(t3_time),
                    6
                ),
                "total_s": round(
                    float(calc_time_s),
                    6
                ),
            },

            # ------------------------------------------------------------
            # НЕВЯЗКИ
            # ------------------------------------------------------------
            "residual_norm": float(residual_norm),
            "max_residual": float(max_residual),
        },

        "nodes": {},
        "edges": {},
    }

    # --------------------------------------------------------------------
    # 7. РЕЗУЛЬТАТЫ ПО УЗЛАМ
    # --------------------------------------------------------------------
    # Создаём словарь: индекс оросителя -> его номер в векторе Qout.
    # Это важно, потому что Qout_final имеет длину n_out,
    # а не N.
    sprinkler_position = {
        node_idx: k
        for k, node_idx in enumerate(
            builder.sprinkler_indices
        )
    }

    for i in range(builder.N):

        node_uuid = str(builder.idx_to_node_uuid[i])

        # Тип узла из исходного JSON
        node_type_builder = None

        for node in builder.data['Node']:
            if str(node['id']) == node_uuid:
                node_type_builder = str(
                    node.get('type', '')
                ).strip().lower()
                break

        # Давление в узле
        pressure = float(P_final[i])

        # Расход через ороситель.
        # Если узел — ороситель, берём его значение
        # из вектора Qout по позиции потребителя.
        if i in sprinkler_position:
            consumer_k = sprinkler_position[i]
            q_spr = float(Qout_final[consumer_k])
        else:
            q_spr = 0.0

        result["nodes"][node_uuid] = {
            "type": node_type_builder,
            "pressure_m": round(pressure, 4),
            "sprinkler_flow_l_s": round(q_spr, 4),
        }

    # --------------------------------------------------------------------
    # 8. РЕЗУЛЬТАТЫ ПО ТРУБАМ
    # --------------------------------------------------------------------
    for j in range(builder.M):

        edge_uuid = str(builder.idx_to_edge_uuid[j])

        # Расход в трубе
        flow = float(Q_final[j])

        # Скорость из builder:
        #     V = Kvelocity * Q
        velocity = float(V_final[j])

        result["edges"][edge_uuid] = {
            "flow_l_s": round(flow, 4),
            "velocity_m_s": round(velocity, 4),
            "direction": (
                "forward" if flow >= 0 else "reverse"
            ),
        }

    # --------------------------------------------------------------------
    # 9. РЕЗУЛЬТАТЫ ПО ИСТОЧНИКАМ
    # --------------------------------------------------------------------
    sources = {}

    for k, source_idx in enumerate(builder.source_indices):

        source_uuid = str(
            builder.idx_to_node_uuid[source_idx]
        )

        sources[source_uuid] = {
            "pressure_m": round(
                float(P_final[source_idx]),
                4
            ),
            "flow_l_s": round(
                float(Qin_final[k]),
                4
            ),
        }

    result["sources"] = sources

    # --------------------------------------------------------------------
    # 10. РЕЗУЛЬТАТЫ ПО ОРОСИТЕЛЯМ
    # --------------------------------------------------------------------
    sprinklers = {}

    for k, node_idx in enumerate(builder.sprinkler_indices):

        sprinkler_uuid = str(
            builder.idx_to_node_uuid[node_idx]
        )

        sprinklers[sprinkler_uuid] = {
            "pressure_m": round(
                float(P_final[node_idx]),
                4
            ),
            "flow_l_s": round(
                float(Qout_final[k]),
                4
            ),
        }

    result["sprinklers"] = sprinklers

    return result