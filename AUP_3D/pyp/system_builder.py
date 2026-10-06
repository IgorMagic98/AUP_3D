"""
system_builder.py — ФИНАЛЬНАЯ ВЕРСИЯ с правильным начальным приближением
"""
import json
import numpy as np
import networkx as nx


class HydraulicSystemBuilder:
    def __init__(self, json_path):
        with open(json_path, 'r', encoding='utf-8') as f:
            raw = json.load(f)

        def strip_keys(obj):
            if isinstance(obj, dict):
                return {k.strip(): strip_keys(v) for k, v in obj.items()}
            if isinstance(obj, list):
                return [strip_keys(i) for i in obj]
            return obj

        self.data = strip_keys(raw)
        self.nodes = []
        self.edges = []
        self.node_to_idx = {}
        self.edge_to_idx = {}

        self.A = None
        self.B = None
        self.S_vec = None
        self.K_spr_vec = None

        self.sprinkler_indices = []
        self.source_idx = None
        self.attach_indices = []
        self.G = nx.DiGraph()

    def build_graph(self):
        self.nodes = [n['id'] for n in self.data['nodes']]
        self.node_to_idx = {n: i for i, n in enumerate(self.nodes)}

        self.edges = []
        for e in self.data['edges']:
            u, v = e['from'], e['to']
            if u in self.node_to_idx and v in self.node_to_idx:
                self.edges.append(e)
                self.edge_to_idx[(u, v)] = len(self.edges) - 1

        for n in self.data['nodes']:
            t = n.get('type', '')
            pos = n.get('position', {})
            self.G.add_node(n['id'], type=t,
                            xyz=(pos.get('x', 0), pos.get('y', 0), pos.get('z', 0)))
            if t == 'sprinkler':
                self.sprinkler_indices.append(self.node_to_idx[n['id']])
            elif t == 'source':
                self.source_idx = self.node_to_idx[n['id']]
            elif t == 'attachNode':
                self.attach_indices.append(self.node_to_idx[n['id']])

        for e in self.edges:
            self.G.add_edge(e['from'], e['to'],
                            length=e.get('length', 0),
                            diameter=e.get('diameter', 0))

        if self.source_idx is None and self.attach_indices:
            self.source_idx = self.attach_indices[0]

    def build_matrices(self, K_sprinkler=0.47):
        N = len(self.nodes)
        M = len(self.edges)

        self.A = np.zeros((N, M), dtype=np.float64)
        self.S_vec = np.zeros(M, dtype=np.float64)
        self.K_spr_vec = np.zeros(N, dtype=np.float64)

        Kt_fixed = 125.0

        for j, e in enumerate(self.edges):
            ui = self.node_to_idx[e['from']]
            vi = self.node_to_idx[e['to']]
            self.A[ui, j] = 1.0
            self.A[vi, j] = -1.0

            L = e.get('length', 0)
            if L > 0:
                self.S_vec[j] = L / Kt_fixed
            else:
                self.S_vec[j] = 0.0

        self.B = self.A.T

        for idx in self.sprinkler_indices:
            self.K_spr_vec[idx] = K_sprinkler

        print(f"[BUILD] N={N}, M={M}, оросителей={len(self.sprinkler_indices)}, "
              f"source={self.nodes[self.source_idx] if self.source_idx is not None else 'NONE'}")
        print(f"[BUILD] Kt = {Kt_fixed}")

    def get_system_functions(self, P_source=40.0, fixed_node_idx=None, fixed_node_P=None):
        A = self.A
        B = self.B
        S = self.S_vec
        K_spr = self.K_spr_vec
        src = self.source_idx
        N = len(self.nodes)
        M = len(self.edges)

        def F(x):
            Q = x[:M]
            P = x[M:]

            head = B @ P - S * (Q * np.abs(Q))

            # БАЛАНС: Q_in - Q_out - W = 0
            # A @ Q = Q_out - Q_in, поэтому баланс = -A @ Q - W
            safe_P = np.maximum(P, 0.0)
            W = K_spr * np.sqrt(safe_P)
            balance = -A @ Q - W

            if fixed_node_idx is not None:
                balance[fixed_node_idx] = P[fixed_node_idx] - fixed_node_P
            elif src is not None:
                balance[src] = P[src] - P_source

            return np.concatenate([head, balance])

        def J(x):
            Q = x[:M]
            P = x[M:]
            Jac = np.zeros((M + N, M + N))

            Jac[:M, :M] = np.diag(-2.0 * S * np.abs(Q))
            Jac[:M, M:] = B
            Jac[M:, :M] = -A
            
            safe = np.maximum(P, 1e-10)
            dWdP = K_spr / (2.0 * np.sqrt(safe))
            Jac[M:, M:] = -np.diag(dWdP)

            if fixed_node_idx is not None:
                Jac[M + fixed_node_idx, :] = 0.0
                Jac[M + fixed_node_idx, M + fixed_node_idx] = 1.0
            elif src is not None:
                Jac[M + src, :] = 0.0
                Jac[M + src, M + src] = 1.0

            return Jac

        return F, J

    def smart_initial_guess(self, P_source=40.0, K_sprinkler=0.47):
        """
        ТОПОЛОГИЧЕСКОЕ начальное приближение.
        Распределяет расходы по графу от источника к оросителям.
        """
        N = len(self.nodes)
        M = len(self.edges)
        
        # Начальные давления: линейное падение от источника
        P_init = np.ones(N) * 20.0
        if self.source_idx is not None:
            P_init[self.source_idx] = P_source
            
            # BFS от источника для оценки расстояний
            try:
                lengths = nx.single_source_shortest_path_length(self.G, self.nodes[self.source_idx])
                max_len = max(lengths.values()) if lengths else 1
                for node, dist in lengths.items():
                    idx = self.node_to_idx[node]
                    # Линейная интерполяция: P_source → 20 м
                    P_init[idx] = P_source - (P_source - 20.0) * (dist / max(max_len, 1))
            except:
                P_init[:] = P_source * 0.7
        
        # Расходы через оросители при начальном давлении
        sprinkler_flows = {}
        for idx in self.sprinkler_indices:
            sprinkler_flows[idx] = K_sprinkler * np.sqrt(max(P_init[idx], 0.1))
        
        # Распределяем расходы по рёбрам
        Q_init = np.zeros(M)
        
        # Для каждого оросителя находим путь от источника и распределяем расход
        if self.source_idx is not None:
            for spr_idx in self.sprinkler_indices:
                spr_node = self.nodes[spr_idx]
                src_node = self.nodes[self.source_idx]
                
                try:
                    path = nx.shortest_path(self.G, src_node, spr_node)
                    flow = sprinkler_flows[spr_idx]
                    
                    # Добавляем расход ко всем рёбрам на пути
                    for i in range(len(path) - 1):
                        u = path[i]
                        v = path[i+1]
                        if (u, v) in self.edge_to_idx:
                            edge_idx = self.edge_to_idx[(u, v)]
                            Q_init[edge_idx] += flow
                except nx.NetworkXNoPath:
                    pass
        
        # Защита от отрицательных значений
        Q_init = np.clip(Q_init, 0.0, 100000.0)
        P_init = np.clip(P_init, 0.1, 20000.0)
        
        print(f"[INIT] Топологическое приближение:")
        print(f"   Q: min={Q_init.min():.4f}, max={Q_init.max():.4f}, sum={Q_init.sum():.4f}")
        print(f"   P: min={P_init.min():.4f}, max={P_init.max():.4f}")
        
        return np.concatenate([Q_init, P_init])