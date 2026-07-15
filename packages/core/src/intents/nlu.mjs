// Natural-language understanding: intent classification + slot/entity resolution.
// Local rule-based implementation (zero external deps) so the whole stack runs offline.
// In production this is swapped for the LLMProvider (Catalyst QuickML / Zia LLM) which
// fills the SAME {intent, slots} contract — handlers don't change. See ARCHITECTURE §3-4.

const MS_DAY = 86400000;

const CRIME_SYNONYMS = [
  [['chain snatch', 'snatching', 'chain-snatch'], 'Chain Snatching'],
  [['motor vehicle', 'vehicle theft', 'bike theft', 'car theft', 'two-wheeler theft'], 'Motor Vehicle Theft'],
  [['burglary', 'burglaries', 'house break', 'break-in', 'break in', 'housebreaking'], 'Burglary'],
  [['robbery', 'robberies', 'loot', 'mugging'], 'Robbery'],
  [['cyber', 'online fraud', 'otp fraud', 'phishing', 'upi fraud'], 'Cyber Fraud'],
  [['cheating', 'scam'], 'Cheating'],
  [['assault', 'attack', 'hurt'], 'Assault'],
  [['extortion'], 'Extortion'],
  [['kidnap', 'abduction'], 'Kidnapping'],
  [['attempt to murder'], 'Attempt to Murder'],
  [['murder', 'homicide'], 'Murder'],
  [['drug', 'ndps', 'ganja', 'narcotic'], 'NDPS / Drugs'],
  [['money laundering', 'laundering'], 'Money Laundering'],
  [['riot'], 'Rioting'],
  [['dowry'], 'Dowry Harassment'],
  [['trespass'], 'House Trespass'],
  [['counterfeit', 'fake currency'], 'Counterfeiting'],
  [['theft', 'stolen', 'steal'], 'Theft'], // keep generic 'theft' late so specifics win
];

const DISTRICT_ALIASES = [
  [['bangalore', 'bengaluru', 'blr'], 'Bengaluru Urban'],
  [['mysore', 'mysuru'], 'Mysuru'],
  [['hubli', 'hubballi', 'dharwad'], 'Hubballi'],
  [['mangalore', 'mangaluru', 'dakshina kannada'], 'Dakshina Kannada'],
  [['kalaburagi', 'gulbarga'], 'Kalaburagi'],
  [['belgaum', 'belagavi'], 'Belagavi'],
];

export function resolveCrimeType(text) {
  const t = text.toLowerCase();
  for (const [keys, canon] of CRIME_SYNONYMS) if (keys.some((k) => t.includes(k))) return canon;
  return null;
}

export function resolveArea(text, ds) {
  const t = text.toLowerCase();
  for (const [aliases, canon] of DISTRICT_ALIASES) if (aliases.some((a) => t.includes(a))) return canon;
  for (const d of ds.districts) if (t.includes(d.name.toLowerCase())) return d.name;
  return null;
}

export function parseTimeDays(text) {
  const t = text.toLowerCase();
  const m = t.match(/last\s+(\d+)\s+(day|week|month|year)s?/);
  if (m) return Number(m[1]) * { day: 1, week: 7, month: 30, year: 365 }[m[2]];
  if (/(six months|6 months|half year)/.test(t)) return 180;
  if (/last week|past week/.test(t)) return 7;
  if (/last month|past month/.test(t)) return 30;
  if (/last year|past year/.test(t)) return 365;
  if (/this year/.test(t)) return Math.ceil((Date.now() - new Date(new Date().getFullYear(), 0, 1)) / MS_DAY);
  if (/recent|lately|nowadays/.test(t)) return 90;
  if (/today/.test(t)) return 1;
  return null;
}

export function resolveFirId(text) {
  const m = text.match(/FIR[-\s]?(\d{4})[-\s]?([A-Za-z]+\d*)[-\s]?(\d+)/i);
  if (!m) return null;
  return `FIR-${m[1]}-${m[2].toUpperCase()}-${m[3].padStart(5, '0')}`;
}

export function resolvePerson(text, ds) {
  const idm = text.match(/P-?(\d{3,5})/i);
  if (idm) {
    const id = `P-${idm[1].padStart(5, '0')}`;
    if (ds.index.personById.has(id)) return id;
  }
  const t = text.toLowerCase();
  // Names are not unique. Among all persons whose full name appears, prefer the most
  // "notable" (most linked FIRs) — that's almost always who the analyst means.
  let best = null, bestScore = -1;
  for (const p of ds.persons) {
    const name = p.full_name.toLowerCase();
    if (name.length >= 5 && t.includes(name)) {
      const score = (ds.index.firsByPerson.get(p.id) || []).length * 100 + name.length;
      if (score > bestScore) { best = p.id; bestScore = score; }
    }
  }
  return best;
}

const has = (t, ...words) => words.some((w) => t.includes(w));

/** Classify into one intent (priority-ordered rules) + confidence. */
export function classify(text, slots) {
  const t = text.toLowerCase();
  if (slots.firId && has(t, 'summar', 'brief')) return { intent: 'case_summary', confidence: 0.9 };
  if (slots.firId && has(t, 'similar', 'like this', 'same mo')) return { intent: 'mo_similarity', confidence: 0.85 };
  if (slots.firId && has(t, 'lead', 'what next', 'next step', 'do next', 'recommend', 'what should i', 'how to proceed', 'investigate')) return { intent: 'suggest_leads', confidence: 0.85 };
  if (slots.firId) return { intent: 'retrieve_fir', confidence: 0.95 };
  if (has(t, 'predict', 'forecast', 'next strike', 'strike next', 'where will', 'going to strike', 'likely to', 'early warning', 'will they hit')) return { intent: 'forecast_hotspot', confidence: 0.88 };
  if (has(t, 'gang', 'organized', 'organised', 'syndicate', 'crime group', 'criminal group')) return { intent: 'detect_org_crime', confidence: 0.86 };
  if (has(t, 'hotspot', 'hot spot', 'cluster', 'concentrat', 'where is the most', 'worst area')) return { intent: 'hotspot_map', confidence: 0.85 };
  if (has(t, 'repeat offender', 'habitual', 'frequent offender', 'most active offender')) return { intent: 'repeat_offenders', confidence: 0.86 };
  if ((slots.personRef && has(t, 'risk', 'dangerous', 'threat')) || has(t, 'risk score')) return { intent: 'offender_risk', confidence: 0.85 };
  if (has(t, 'money', 'transaction', 'laundering', 'money trail', 'financial', 'funds', 'payment', 'account', 'hawala')) return { intent: 'money_trail', confidence: 0.82 };
  if (has(t, 'connected', 'connection', 'linked', 'link between', 'associate', 'associates', 'network of', 'who knows')) return { intent: 'network_explore', confidence: 0.8 };
  if (has(t, 'similar', 'same mo', 'same modus', 'comparable case', 'cases like')) return { intent: 'mo_similarity', confidence: 0.78 };
  if (has(t, 'lead', 'investigate next', 'what next', 'next step', 'recommend', 'where do i look', 'what should i do', 'how to proceed')) return { intent: 'suggest_leads', confidence: 0.8 };
  if (has(t, 'seasonal', 'seasonality', 'which month', 'what month', 'time of year', 'festival', 'festive', 'cyclical', 'periodic', 'by season', 'recurring pattern', 'month of year', 'day of week', 'weekday pattern')) return { intent: 'seasonal_pattern', confidence: 0.84 };
  if (has(t, 'trend', 'over time', 'monthly', 'per month', 'rising', 'increasing', 'time series')) return { intent: 'trend_analysis', confidence: 0.8 };
  if (has(t, 'by age', 'by gender', 'age group', 'age band', 'age distribution', 'gender breakdown', 'demographic breakdown', 'age and gender', 'offender demographic')) return { intent: 'demographics', confidence: 0.82 };
  if (has(t, 'unemployment', 'literacy', 'urbaniz', 'urbanis', 'socio', 'poverty', 'education', 'social factor', 'demographic', 'correlat')) return { intent: 'socio_insight', confidence: 0.8 };
  if (slots.personRef && has(t, 'history', 'priors', 'record', 'past cases')) return { intent: 'criminal_history', confidence: 0.82 };
  if (slots.personRef && has(t, 'who is', 'profile', 'about', 'tell me about', 'details of')) return { intent: 'person_profile', confidence: 0.8 };
  if (slots.personRef) return { intent: 'person_profile', confidence: 0.7 };
  if (has(t, 'show', 'list', 'find', 'search', 'how many', 'count', 'cases', 'firs', 'crimes', 'reported', 'registered')) return { intent: 'search_firs', confidence: 0.72 };
  return { intent: 'clarify', confidence: 0.3 };
}

function parseTimeOfDay(text) {
  const t = text.toLowerCase();
  const out = {};
  const after = t.match(/after\s+(\d{1,2})\s*(am|pm)?/);
  if (after) out.afterHour = (Number(after[1]) % 12) + (after[2] === 'pm' ? 12 : 0);
  const before = t.match(/before\s+(\d{1,2})\s*(am|pm)?/);
  if (before) out.beforeHour = (Number(before[1]) % 12) + (before[2] === 'pm' ? 12 : 0);
  // labelled windows (night wraps midnight: 20:00–05:59)
  if (/\b(night|after dark|late night|night-?time)\b/.test(t)) out.tod = 'night';
  else if (/\bevening\b/.test(t)) out.tod = 'evening';
  else if (/\bmorning\b/.test(t)) out.tod = 'morning';
  else if (/\bafternoon\b/.test(t)) out.tod = 'afternoon';
  else if (/\b(daytime|day time)\b/.test(t)) out.tod = 'daytime';
  return out;
}

/** Full NLU pass: resolve slots, then classify. */
export function understand(text, ds) {
  const slots = {
    crimeType: resolveCrimeType(text),
    area: resolveArea(text, ds),
    days: parseTimeDays(text),
    firId: resolveFirId(text),
    personRef: resolvePerson(text, ds),
    ...parseTimeOfDay(text),
  };
  const { intent, confidence } = classify(text, slots);
  return { intent, confidence, slots };
}

/**
 * Context-aware NLU for multi-turn follow-ups. Inherits unfilled slots (and, for vague
 * refinements, the intent) from the previous user turn so anaphoric queries like
 * "only the ones after 9 PM" or "what about Mysuru?" resolve without repeating context.
 */
export function understandWithContext(text, ds, history = []) {
  const cur = understand(text, ds);
  const prevUser = [...(history || [])].reverse().find((m) => m.role === 'user');
  if (!prevUser) return cur;
  const prev = understand(prevUser.text, ds);
  for (const k of ['crimeType', 'area', 'days', 'firId', 'personRef']) {
    if (cur.slots[k] == null && prev.slots[k] != null) cur.slots[k] = prev.slots[k];
  }
  const t = text.toLowerCase().trim();
  const isRefinement = /^(only|just|what about|how about|and |also |filter|narrow|after |before |in the last|this year|last (month|week|year)|same|those|them|that|there|by district|by type)\b/.test(t)
    || cur.intent === 'clarify' || text.split(/\s+/).length <= 4;
  // A short turn that ALSO confidently names a concrete intent (e.g. "Is this seasonal?" →
  // seasonal_pattern) keeps its own intent — only inherit when the turn is genuinely vague.
  const curIsConcrete = cur.intent !== 'clarify' && (cur.confidence || 0) >= 0.8;
  if (isRefinement && !curIsConcrete && prev.intent !== 'clarify' && prev.intent !== 'abstain') {
    cur.intent = prev.intent;
    cur.confidence = Math.min((cur.confidence || 0) + 0.3, 0.9);
    cur.inherited = true;
  }
  return cur;
}
