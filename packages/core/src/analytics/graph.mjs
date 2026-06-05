// Criminal-network analytics: graph construction, centrality (degree / eigenvector /
// betweenness), Louvain community detection (organized-crime discovery), and link
// prediction (suggesting hidden ties). Pure functions over the canonical dataset.

/**
 * Build an undirected weighted graph from associations.
 * @param {object} ds dataset from loadDataset
 * @param {object} opts {personIds?: string[] limit to these, types?: string[] edge types}
 */
export function buildGraph(ds, opts = {}) {
  const allow = opts.personIds ? new Set(opts.personIds) : null;
  const types = opts.types ? new Set(opts.types) : null;
  const adj = new Map(); // id -> Map(neighbor -> weight)
  const ensure = (id) => { if (!adj.has(id)) adj.set(id, new Map()); return adj.get(id); };

  for (const e of ds.associations) {
    if (types && !types.has(e.type)) continue;
    if (allow && (!allow.has(e.person_a) || !allow.has(e.person_b))) continue;
    const a = ensure(e.person_a), b = ensure(e.person_b);
    a.set(e.person_b, (a.get(e.person_b) || 0) + e.weight);
    b.set(e.person_a, (b.get(e.person_a) || 0) + e.weight);
  }
  const nodes = [...adj.keys()];
  return { adj, nodes };
}

export function degreeCentrality(g) {
  const out = new Map();
  for (const [id, nbrs] of g.adj) {
    let s = 0; for (const w of nbrs.values()) s += w;
    out.set(id, s);
  }
  return out;
}

/** Eigenvector centrality via power iteration (weighted). */
export function eigenvectorCentrality(g, iters = 100) {
  const ids = g.nodes;
  let x = new Map(ids.map((id) => [id, 1 / Math.sqrt(ids.length || 1)]));
  for (let it = 0; it < iters; it++) {
    const nx = new Map(ids.map((id) => [id, 0]));
    for (const [id, nbrs] of g.adj) {
      let s = 0; for (const [n, w] of nbrs) s += w * x.get(n);
      nx.set(id, s);
    }
    let norm = Math.sqrt([...nx.values()].reduce((a, v) => a + v * v, 0)) || 1;
    for (const id of ids) nx.set(id, nx.get(id) / norm);
    x = nx;
  }
  return x;
}

/** Betweenness centrality — Brandes' algorithm (unweighted, treats edges as unit). */
export function betweennessCentrality(g) {
  const ids = g.nodes;
  const CB = new Map(ids.map((id) => [id, 0]));
  for (const s of ids) {
    const S = [], P = new Map(), sigma = new Map(), dist = new Map();
    for (const t of ids) { P.set(t, []); sigma.set(t, 0); dist.set(t, -1); }
    sigma.set(s, 1); dist.set(s, 0);
    const Q = [s];
    while (Q.length) {
      const v = Q.shift(); S.push(v);
      for (const w of g.adj.get(v).keys()) {
        if (dist.get(w) < 0) { dist.set(w, dist.get(v) + 1); Q.push(w); }
        if (dist.get(w) === dist.get(v) + 1) { sigma.set(w, sigma.get(w) + sigma.get(v)); P.get(w).push(v); }
      }
    }
    const delta = new Map(ids.map((id) => [id, 0]));
    while (S.length) {
      const w = S.pop();
      for (const v of P.get(w)) delta.set(v, delta.get(v) + (sigma.get(v) / sigma.get(w)) * (1 + delta.get(w)));
      if (w !== s) CB.set(w, CB.get(w) + delta.get(w));
    }
  }
  for (const id of ids) CB.set(id, CB.get(id) / 2); // undirected
  return CB;
}

/**
 * Louvain community detection (single-level local moving to convergence).
 * Recovers densely-connected groups = organized-crime clusters.
 * Returns Map(nodeId -> communityIndex).
 */
export function louvain(g) {
  const ids = g.nodes;
  if (ids.length === 0) return new Map();
  const deg = degreeCentrality(g);
  let m = 0; for (const d of deg.values()) m += d; m /= 2; // total edge weight
  if (m === 0) return new Map(ids.map((id, i) => [id, i]));

  const comm = new Map(ids.map((id) => [id, id]));   // start: each node own community
  const sigmaTot = new Map(ids.map((id) => [id, deg.get(id)]));

  let improved = true, passes = 0;
  while (improved && passes < 20) {
    improved = false; passes++;
    for (const i of ids) {
      const ki = deg.get(i);
      const ci = comm.get(i);
      // weights from i to each neighbouring community
      const wTo = new Map();
      for (const [n, w] of g.adj.get(i)) {
        const c = comm.get(n);
        wTo.set(c, (wTo.get(c) || 0) + w);
      }
      // remove i from its community
      sigmaTot.set(ci, sigmaTot.get(ci) - ki);
      // evaluate gain for staying vs moving (simplified modularity gain)
      let bestC = ci, bestGain = (wTo.get(ci) || 0) - (sigmaTot.get(ci) * ki) / (2 * m);
      for (const [c, wic] of wTo) {
        if (c === ci) continue;
        const gain = wic - (sigmaTot.get(c) * ki) / (2 * m);
        if (gain > bestGain) { bestGain = gain; bestC = c; }
      }
      sigmaTot.set(bestC, sigmaTot.get(bestC) + ki);
      if (bestC !== ci) { comm.set(i, bestC); improved = true; }
    }
  }
  // relabel community ids to 0..k-1
  const relabel = new Map(); let next = 0;
  const out = new Map();
  for (const id of ids) {
    const c = comm.get(id);
    if (!relabel.has(c)) relabel.set(c, next++);
    out.set(id, relabel.get(c));
  }
  return out;
}

/**
 * Link prediction over non-adjacent pairs sharing >=1 neighbour.
 * Scores: common-neighbours + Adamic-Adar. Returns topK suggested ties.
 */
export function linkPrediction(g, { topK = 10, personIds } = {}) {
  const allow = personIds ? new Set(personIds) : null;
  const deg = new Map([...g.adj].map(([id, n]) => [id, n.size]));
  const scored = new Map(); // "a|b" -> {cn, aa}
  for (const u of g.nodes) {
    if (allow && !allow.has(u)) continue;
    const uN = g.adj.get(u);
    // candidates = neighbours of neighbours
    for (const w of uN.keys()) {
      for (const v of g.adj.get(w).keys()) {
        if (v === u) continue;
        if (uN.has(v)) continue;            // already directly linked
        if (allow && !allow.has(v)) continue;
        if (u >= v) continue;               // unordered, once
        const key = `${u}|${v}`;
        let s = scored.get(key);
        if (!s) { s = { a: u, b: v, cn: 0, aa: 0 }; scored.set(key, s); }
      }
    }
  }
  // compute scores
  for (const s of scored.values()) {
    const aN = g.adj.get(s.a), bN = g.adj.get(s.b);
    for (const x of aN.keys()) {
      if (bN.has(x)) { s.cn += 1; s.aa += 1 / Math.log((deg.get(x) || 2)); }
    }
  }
  return [...scored.values()]
    .filter((s) => s.cn > 0)
    .sort((a, b) => b.aa - a.aa || b.cn - a.cn)
    .slice(0, topK);
}
