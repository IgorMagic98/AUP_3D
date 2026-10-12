import numpy as np
import jax
import jax.numpy as jnp

jax.config.update("jax_enable_x64", True)

G_ACC = 9.81
LAMBDA = 0.02


class HydraulicSystemBuilder:
    """
    Строит матрицы из JSON (формат Three.js) и готовит JAX-тензоры
    для сверхбыстрого решения.
    """

    def __init__(self, json_data):
        self.data = json_data

        # Маппинг UUID <-> индекс
        self.node_uuid_to_idx = {}
        self.idx_to_node_uuid = {}
        self.edge_uuid_to_idx = {}
        self.idx_to_edge_uuid = {}

        self.sprinkler_indices = []
        self.source_idx = None

        self.N = 0
        self.M = 0

        # JAX-тензоры (заполняются в build_matrices)
        self.R = None          # Матрица инцидентности (N x M)
        self.S_dense = None    # Вектор источника (N,)
        self.K_dense = None    # Вектор оросителей (N,)
        self.Z = None          # Высоты узлов (N,)
        self.Lambda = None     # Сопротивления труб (M,)

    def build_graph(self):
        # 1. Узлы
        for i, n in enumerate(self.data['Node']):
            uuid = str(n['id'])
            self.node_uuid_to_idx[uuid] = i
            self.idx_to_node_uuid[i] = uuid

            node_type = n.get('type', '').lower()
            x = float(n.get('X_gl', 0))
            y = float(n.get('Y_gl', 0))
            z = float(n.get('Z_gl', 0))

            if node_type == 'sprinkler':
                self.sprinkler_indices.append(i)
            elif node_type == 'source':
                self.source_idx = i

        # 2. Трубы
        edge_list = []
        for e in self.data['Edge']:
            uuid = str(e['id'])
            u_uuid = str(e['start_node'])
            v_uuid = str(e['end_node'])

            if u_uuid in self.node_uuid_to_idx and v_uuid in self.node_uuid_to_idx:
                self.edge_uuid_to_idx[uuid] = len(edge_list)
                self.idx_to_edge_uuid[len(edge_list)] = uuid
                edge_list.append((u_uuid, v_uuid, e))

        self.N = len(self.node_uuid_to_idx)
        self.M = len(edge_list)

        if self.source_idx is None:
            raise ValueError("В сети не найден узел с type='Source'")

    def build_matrices(self, K_sprinkler=0.47):
        # Матрица инцидентности R (N x M): +1 выход, -1 вход
        R_dense = np.zeros((self.N, self.M), dtype=np.float64)
        Lambda = np.zeros(self.M, dtype=np.float64)
        Z = np.zeros(self.N, dtype=np.float64)
        K = np.zeros(self.N, dtype=np.float64)
        S = np.zeros(self.N, dtype=np.float64)

        # Заполняем R и Lambda по рёбрам
        for j, (u_uuid, v_uuid, e) in enumerate(
            [(str(e['start_node']), str(e['end_node']), e) for e in self.data['Edge']
             if str(e['start_node']) in self.node_uuid_to_idx
             and str(e['end_node']) in self.node_uuid_to_idx]
        ):
            ui = self.node_uuid_to_idx[u_uuid]
            vi = self.node_uuid_to_idx[v_uuid]
            R_dense[ui, j] = 1.0
            R_dense[vi, j] = -1.0

            L = float(e.get('Length', 0))
            D = float(e.get('DN', 50))

            if L > 0 and D > 0:
                D_m = D / 1000.0
                Kt = (np.pi**2 * G_ACC * D_m**5) / (8 * LAMBDA * L * 1e-6)
                Lambda[j] = L / Kt

        # Заполняем Z и K по узлам
        for i, n in enumerate(self.data['Node']):
            Z[i] = float(n.get('Y_gl', 0))
            if i in self.sprinkler_indices:
                K[i] = K_sprinkler

        # Источник: S_dense[source_idx] = -1 (приток)
        if self.source_idx is not None:
            S[self.source_idx] = -1.0

        # Переносим в JAX-тензоры (фиксация в GPU/CPU)
        self.R = jnp.array(R_dense)
        self.S_dense = jnp.array(S)
        self.K_dense = jnp.array(K)
        self.Z = jnp.array(Z)
        self.Lambda = jnp.array(Lambda)

        self.consumer_list = self.sprinkler_indices