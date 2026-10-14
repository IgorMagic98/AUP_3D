import numpy as np
from .system_builder import HydraulicSystemBuilder
from .solver import run_calculation


def run_from_dict(json_data):
    builder = HydraulicSystemBuilder(json_data)
    builder.build_graph()
    builder.build_matrices(K_sprinkler=0.47)

    Q_final, P_final, P_optimal, dictating_idx, K_system, Z_max = run_calculation(builder)

    total_flow_l_s = 0.0
    if builder.source_idx is not None:
        # Ищем ребро, где start_node или end_node = source_idx
        for j in range(builder.M):
            # Проверяем матрицу инцидентности R
            # R[source_idx, j] != 0 означает, что ребро j подключено к источнику
            if abs(builder.R[builder.source_idx, j]) > 0.5:
                total_flow_l_s = abs(float(Q_final[j]))
                break
        
    result = {
        "status": "success",
        "summary": {
            "source_pressure_m": round(float(P_optimal), 4),
            "total_flow_l_s": round(total_flow_l_s, 4),
            "dictating_node_uuid": str(builder.idx_to_node_uuid[dictating_idx]),
            "K_system": round(K_system, 6),
            "Z_max": round(Z_max, 2)
        },
        "nodes": {},
        "edges": {},
    }    
   

    for i in range(builder.N):
        node_uuid = str(builder.idx_to_node_uuid[i])
        node_type_builder = None
        for n in builder.data['Node']:
            if str(n['id']) == node_uuid:
                node_type_builder = n.get('type', '').lower()
                break

        pressure = float(P_final[i])
        q_spr = 0.0
        if node_type_builder == 'sprinkler':
            q_spr = float(builder.K_dense[i] * np.sqrt(max(pressure, 0)))

        result["nodes"][node_uuid] = {
            "type": node_type_builder,
            "pressure_m": round(pressure, 4),
            "sprinkler_flow_l_s": round(q_spr, 4),
        }

    for j in range(builder.M):
        edge_uuid = str(builder.idx_to_edge_uuid[j])
        flow = float(Q_final[j])
        D_m = builder.data['Edge'][
            next(k for k, e in enumerate(builder.data['Edge'])
                 if str(e['id']) == edge_uuid)
        ]['DN'] / 1000.0
        area = np.pi * D_m**2 / 4.0
        velocity = abs(flow) / 1000.0 / area if area > 0 else 0.0

        result["edges"][edge_uuid] = {
            "flow_l_s": round(flow, 4),
            "velocity_m_s": round(velocity, 4),
            "direction": "forward" if flow >= 0 else "reverse",
        }

    return result