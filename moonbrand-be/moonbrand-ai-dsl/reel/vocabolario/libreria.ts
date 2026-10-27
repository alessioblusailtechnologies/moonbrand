// La libreria delle mosse (ADR-001 §8.1): funzioni parametriche che dicono solo *come si muove* un livello.
// Il compilatore mette sopra `const S = {...}` con la scena già risolta (livelli, coordinate, tempi, mosse con parametri)
// e qui la si costruisce da zero nella composizione «Video» del contenitore. Solo effetti nativi.
declare const S: any;

// ---------- base ----------
let comp: CompItem = null as any;
for (let i = 1; i <= app.project.numItems; i++) {
  const it = app.project.item(i);
  if (it instanceof CompItem && it.name === "Video") comp = it;
}
if (!comp) throw new Error("manca la composizione Video nel contenitore");
comp.width = S.W;
comp.height = S.H;
comp.frameRate = S.FPS;
comp.duration = S.durata;
comp.workAreaStart = 0;
comp.workAreaDuration = S.durata;
comp.bgColor = S.sfondo;
const W = S.W, H = S.H, FPS = S.FPS;
const CARTELLA = S.cartella || app.project.file!.parent.fsName.replace(/\\/g, "/") + "/";

function prop(layer: any, ...names: any[]): any {
  let p: any = layer;
  for (let i = 0; i < names.length; i++) p = p.property(names[i]);
  return p;
}
// cerca una proprietà figlia per matchName (le versioni di AE cambiano qualche nome)
function trova(gruppo: any, re: RegExp): any {
  for (let i = 1; i <= gruppo.numProperties; i++) if (re.test(gruppo.property(i).matchName)) return gruppo.property(i);
  return null;
}
function dims(p: any) {
  const t = p.propertyValueType;
  if (t === PropertyValueType.TwoD) return 2;
  if (t === PropertyValueType.ThreeD) return 3;
  return 1;
}
const media: any = {};
function importa(file: string): FootageItem {
  if (!media[file]) media[file] = app.project.importFile(new ImportOptions(new File(CARTELLA + file))) as FootageItem;
  return media[file];
}
function effetto(layer: any, match: string): any {
  const parade = layer.property("ADBE Effect Parade");
  const fx = parade.addProperty(match);
  return parade.property(fx.propertyIndex);
}
const trasf = (L: any) => L.property("ADBE Transform Group");
const scala = (L: any) => prop(L, "ADBE Transform Group", "ADBE Scale");
const opac = (L: any) => prop(L, "ADBE Transform Group", "ADBE Opacity");
function posXY(L: any) {
  const p = prop(L, "ADBE Transform Group", "ADBE Position");
  if (!p.dimensionsSeparated) p.dimensionsSeparated = true;
  return [prop(L, "ADBE Transform Group", "ADBE Position_0"), prop(L, "ADBE Transform Group", "ADBE Position_1")];
}

// ---------- curve: i token di stile diventano ease di AE ----------
// Un tratto da a a b con la cubica (x1,y1,x2,y2): l'ease in uscita ha influenza x1 e velocità y1/x1 della media,
// quello in entrata influenza 1-x2 e velocità (1-y2)/(1-x2). È esatto per proprietà a una dimensione.
const SETTLE = [0.35, 0, 0.25, 1];
function tratto(p: any, kA: number, kB: number, bez: number[]) {
  const T = p.keyTime(kB) - p.keyTime(kA);
  const a = p.keyValue(kA), b = p.keyValue(kB);
  const n = dims(p);
  const outE: KeyframeEase[] = [], inE: KeyframeEase[] = [];
  const x1 = Math.max(bez[0], 0.001), x2 = Math.min(bez[2], 0.999);
  for (let d = 0; d < n; d++) {
    const av = ((n === 1 ? b : b[d]) - (n === 1 ? a : a[d])) / T;
    outE.push(new KeyframeEase(av * bez[1] / x1, Math.max(0.1, Math.min(100, x1 * 100))));
    inE.push(new KeyframeEase(av * (1 - bez[3]) / (1 - x2), Math.max(0.1, Math.min(100, (1 - x2) * 100))));
  }
  p.setInterpolationTypeAtKey(kA, p.keyInInterpolationType(kA), KeyframeInterpolationType.BEZIER);
  p.setInterpolationTypeAtKey(kB, KeyframeInterpolationType.BEZIER, p.keyOutInterpolationType(kB));
  p.setTemporalEaseAtKey(kA, p.keyInTemporalEase(kA), outE);
  p.setTemporalEaseAtKey(kB, inE, p.keyOutTemporalEase(kB));
}
// da v0 a v1 tra t0 e t1 con la curva del brand; con overshoot un fotogramma chiave oltre l'arrivo e poi si posa.
function anima(p: any, t0: number, t1: number, v0: any, v1: any, bez: number[], ov?: number) {
  const k0 = p.addKey(t0);
  p.setValueAtKey(k0, v0);
  if (ov && ov > 0) {
    const tm = t0 + (t1 - t0) * 0.6;
    const vm = typeof v0 === "number" ? v1 + (v1 - v0) * ov : v0.map((x: number, i: number) => v1[i] + (v1[i] - x) * ov);
    p.setValueAtKey(p.addKey(tm), vm);
    p.setValueAtKey(p.addKey(t1), v1);
    tratto(p, p.nearestKeyIndex(t0), p.nearestKeyIndex(tm), bez);
    tratto(p, p.nearestKeyIndex(tm), p.nearestKeyIndex(t1), SETTLE);
    return;
  }
  p.setValueAtKey(p.addKey(t1), v1);
  tratto(p, p.nearestKeyIndex(t0), p.nearestKeyIndex(t1), bez);
}
// la stessa curva in JavaScript, per le espressioni e per le proprietà che non hanno velocità (maschere)
function curvaJS(x: number, bez: number[]) {
  let t = x;
  for (let i = 0; i < 10; i++) {
    const cx = 3 * bez[0] * t * (1 - t) * (1 - t) + 3 * bez[2] * t * t * (1 - t) + t * t * t - x;
    const dx = 3 * bez[0] * (1 - t) * (1 - t) + 6 * (bez[2] - bez[0]) * t * (1 - t) + 3 * (1 - bez[2]) * t * t;
    if (Math.abs(dx) < 1e-6) break;
    t = Math.min(1, Math.max(0, t - cx / dx));
  }
  return 3 * bez[1] * t * (1 - t) * (1 - t) + 3 * bez[3] * t * t * (1 - t) + t * t * t;
}
function codiceCurva(bez: number[]) {
  return "function bz(x){var t=x;for(var i=0;i<10;i++){var cx=3*" + bez[0] + "*t*(1-t)*(1-t)+3*" + bez[2] + "*t*t*(1-t)+t*t*t-x;" +
    "var dx=3*" + bez[0] + "*(1-t)*(1-t)+6*(" + bez[2] + "-" + bez[0] + ")*t*(1-t)+3*(1-" + bez[2] + ")*t*t;if(Math.abs(dx)<1e-6)break;" +
    "t=Math.min(1,Math.max(0,t-cx/dx));}return 3*" + bez[1] + "*t*(1-t)*(1-t)+3*" + bez[3] + "*t*t*(1-t)+t*t*t;}";
}
// proprietà senza velocità (forme delle maschere): un fotogramma chiave per fotogramma, lineari, presi dalla curva
function campiona(p: any, t0: number, t1: number, bez: number[], valore: (e: number) => any) {
  const n = Math.max(1, Math.round((t1 - t0) * FPS));
  for (let i = 0; i <= n; i++) p.setValueAtTime(t0 + (t1 - t0) * i / n, valore(curvaJS(i / n, bez)));
}

// ---------- mosse sul testo: animatori con selettore a espressione ----------
// Il selettore porta ogni unità (lettera, parola, riga) dallo stato nascosto (100) a quello finale (0), una dopo
// l'altra; `base` è il numero di unità delle righe precedenti, così lo scaglionamento continua da una riga all'altra.
function animatore(L: any, m: any, unita: number, stato: (props: any) => void, gradino?: boolean) {
  const anims = prop(L, "ADBE Text Properties", "ADBE Text Animators");
  const idx = anims.addProperty("ADBE Text Animator").propertyIndex;
  const A = () => prop(L, "ADBE Text Properties", "ADBE Text Animators").property(idx);
  stato(A().property("ADBE Text Animator Properties"));
  A().property("ADBE Text Selectors").addProperty("ADBE Text Expressible Selector");
  const sel = A().property("ADBE Text Selectors").property(1);
  const tipo = trova(sel, /Range Type/);
  if (tipo) tipo.setValue(unita);
  const ammontare = trova(sel, /Expressible Amount/);
  const st = m.p.stagger || 0, inv = m.inv ? 1 : 0;
  const curva = gradino ? "function bz(x){return x>0?1:0;}" : codiceCurva(m.bez);
  ammontare.expression = curva +
    "var i=" + (m.base || 0) + "+(" + inv + "?textTotal-textIndex:textIndex-1);" +
    "var p=Math.min(1,Math.max(0,(time-" + m.t + "-i*" + st + ")/" + Math.max(m.p.du || m.dur, 0.001) + "));" +
    "var e=bz(p);" + (m.ov > 0 ? "var c1=" + m.ov * 14 + ",q=e-1;e=1+(c1+1)*q*q*q+c1*q*q;" : "") +
    "var a=" + inv + "?100*e:100*(1-e);[a,a,a];";
}
function aggiungi(gruppo: any, match: string, v: any) {
  gruppo.addProperty(match);
  gruppo.property(match).setValue(v);
}
const MOSSE_TESTO: any = {
  word_stagger_up: (L: any, m: any) => animatore(L, m, 3, (g: any) => {
    aggiungi(g, "ADBE Text Position 3D", [0, m.p.distanza, 0]);
    aggiungi(g, "ADBE Text Opacity", 0);
  }),
  char_cascade: (L: any, m: any) => animatore(L, m, 1, (g: any) => {
    aggiungi(g, "ADBE Text Position 3D", [0, m.p.distanza, 0]);
    aggiungi(g, "ADBE Text Opacity", 0);
  }),
  line_mask_reveal: (L: any, m: any) => {
    // la riga sale da sotto il suo taglio: maschera fissa sul livello, i glifi si muovono dentro
    const r = L.sourceRectAtTime(m.t + m.dur + 1, false);
    const mk = prop(L, "ADBE Mask Parade").addProperty("ADBE Mask Atom");
    const sh = new Shape();
    const pad = r.height * 0.18;
    sh.vertices = [[r.left - 400, r.top - pad], [r.left + r.width + 400, r.top - pad], [r.left + r.width + 400, r.top + r.height + pad], [r.left - 400, r.top + r.height + pad]];
    sh.closed = true;
    mk.property("ADBE Mask Shape").setValue(sh);
    animatore(L, m, 4, (g: any) => aggiungi(g, "ADBE Text Position 3D", [0, r.height * 1.35, 0]));
  },
  word_blur_in: (L: any, m: any) => animatore(L, m, 3, (g: any) => {
    aggiungi(g, "ADBE Text Blur", [m.p.blur, m.p.blur]);
    aggiungi(g, "ADBE Text Scale 3D", [112, 112, 100]);
    aggiungi(g, "ADBE Text Opacity", 0);
  }),
  tracking_expand: (L: any, m: any) => animatore(L, m, 4, (g: any) => {
    // la spaziatura larga non deve portare le lettere fuori dal quadro: si limita allo spazio che c'è
    const doc = prop(L, "ADBE Text Properties", "ADBE Text Document").value as TextDocument;
    const n = Math.max(1, doc.text.length - 1), w = L.sourceRectAtTime(m.t, false).width;
    const max = Math.max(0, ((W - 2 * S.safe.sinistra - w) * 1000) / (n * doc.fontSize));
    g.addProperty("ADBE Text Tracking Amount");
    g.property("ADBE Text Tracking Amount").setValue(Math.min(m.p.tracking_from, max));
    aggiungi(g, "ADBE Text Opacity", 0);
  }),
  typewriter: (L: any, m: any) => animatore(L, m, 1, (g: any) => aggiungi(g, "ADBE Text Opacity", 0), true),
};

// ---------- mosse sugli elementi e sulle riprese: fotogrammi chiave sul livello ----------
function entraEsci(m: any, a: any, b: any) {
  // in entrata da a a b; in uscita (inversa) da b ad a
  return m.inv ? [b, a] : [a, b];
}
const MOSSE_LIVELLO: any = {
  fade_up: (L: any, m: any) => {
    const [, y] = posXY(L);
    const y0 = y.value;
    const [ya, yb] = entraEsci(m, y0 + m.p.distanza, y0);
    anima(y, m.t, m.t + m.dur, ya, yb, m.bez);
    const [oa, ob] = entraEsci(m, 0, 100);
    anima(opac(L), m.t, m.t + m.dur * 0.7, oa, ob, m.bez);
  },
  scale_pop: (L: any, m: any) => {
    const s = scala(L).value;
    const k = m.p.from_pct / 100;
    const [sa, sb] = entraEsci(m, [s[0] * k, s[1] * k], [s[0], s[1]]);
    anima(scala(L), m.t, m.t + m.dur, sa, sb, m.bez, m.inv ? 0 : m.ov);
    const [oa, ob] = entraEsci(m, 0, 100);
    anima(opac(L), m.inv ? m.t + m.dur * 0.5 : m.t, m.inv ? m.t + m.dur : m.t + m.dur * 0.35, oa, ob, m.bez);
  },
  scale_settle: (L: any, m: any) => {
    const s = scala(L).value;
    const k = m.p.from_pct / 100;
    anima(scala(L), m.t, m.t + m.dur, [s[0] * k, s[1] * k], [s[0], s[1]], m.bez);
  },
  dissolve_in: (L: any, m: any) => anima(opac(L), m.t, m.t + m.dur, 0, 100, [0.33, 0, 0.67, 1]),
  push_in: (L: any, m: any) => {
    const [x, y] = posXY(L);
    const d = m.p.direction;
    if (d === "left" || d === "right") anima(x, m.t, m.t + m.dur, x.value + (d === "left" ? W : -W), x.value, m.bez);
    else anima(y, m.t, m.t + m.dur, y.value + (d === "up" ? H : -H), y.value, m.bez);
  },
  push_out: (L: any, m: any) => {
    const [x, y] = posXY(L);
    const d = m.p.direction;
    if (d === "left" || d === "right") anima(x, m.t, m.t + m.dur, x.value, x.value + (d === "left" ? -W : W), m.bez);
    else anima(y, m.t, m.t + m.dur, y.value, y.value + (d === "up" ? -H : H), m.bez);
  },
  zoom_through_out: (L: any, m: any) => {
    const s = scala(L).value, k = 1 + m.p.amount_pct / 100;
    anima(scala(L), m.t, m.t + m.dur, [s[0], s[1]], [s[0] * k, s[1] * k], [0.7, 0, 0.84, 0]);
    anima(opac(L), m.t + m.dur * 0.4, m.t + m.dur, 100, 0, [0.33, 0, 0.67, 1]);
  },
  zoom_through_in: (L: any, m: any) => {
    const s = scala(L).value, k = 1 - m.p.amount_pct / 200;
    anima(scala(L), m.t, m.t + m.dur, [s[0] * k, s[1] * k], [s[0], s[1]], m.bez);
    anima(opac(L), m.t, m.t + m.dur * 0.5, 0, 100, [0.33, 0, 0.67, 1]);
  },
  whip_out: (L: any, m: any) => {
    const [x] = posXY(L);
    const segno = m.p.direction === "left" ? -1 : 1;
    anima(x, m.t, m.t + m.dur, x.value, x.value + segno * W * 1.1, [0.6, 0, 1, 0.6]);
    sciaLaterale(L, m.t, m.t + m.dur, 0, 180);
  },
  whip_in: (L: any, m: any) => {
    const [x] = posXY(L);
    const segno = m.p.direction === "left" ? 1 : -1;
    anima(x, m.t, m.t + m.dur, x.value + segno * W * 1.1, x.value, [0, 0.4, 0.2, 1]);
    sciaLaterale(L, m.t, m.t + m.dur, 180, 0);
  },
  // tendina: una maschera in coordinate del livello che cresce da un lato (o in diagonale)
  wipe_in: (L: any, m: any) => {
    const r = rettangoloLivello(L);
    const mk = prop(L, "ADBE Mask Parade").addProperty("ADBE Mask Atom");
    const d = m.p.direction;
    campiona(mk.property("ADBE Mask Shape"), m.t, m.t + m.dur, m.bez, (e: number) => {
      const sh = new Shape();
      const { l, t, rr, b } = r;
      const w = rr - l, h = b - t;
      if (d === "left") sh.vertices = [[rr - w * e, t], [rr, t], [rr, b], [rr - w * e, b]];
      else if (d === "right") sh.vertices = [[l, t], [l + w * e, t], [l + w * e, b], [l, b]];
      else if (d === "up") sh.vertices = [[l, b - h * e], [rr, b - h * e], [rr, b], [l, b]];
      else if (d === "down") sh.vertices = [[l, t], [rr, t], [rr, t + h * e], [l, t + h * e]];
      else {
        // diagonale dal basso a sinistra verso l'alto a destra
        const s = (w + h) * e;
        sh.vertices = [[l, b], [l + s, b], [l, b - s]];
      }
      sh.closed = true;
      return sh;
    });
  },
  iris_in: (L: any, m: any) => {
    const r = rettangoloLivello(L);
    const cx = (r.l + r.rr) / 2, cy = (r.t + r.b) / 2;
    const R = Math.sqrt((r.rr - r.l) * (r.rr - r.l) + (r.b - r.t) * (r.b - r.t)) / 2;
    const mk = prop(L, "ADBE Mask Parade").addProperty("ADBE Mask Atom");
    campiona(mk.property("ADBE Mask Shape"), m.t, m.t + m.dur, m.bez, (e: number) => {
      const q = Math.max(R * e, 0.5), k = q * 0.5523;
      const sh = new Shape();
      sh.vertices = [[cx, cy - q], [cx + q, cy], [cx, cy + q], [cx - q, cy]];
      sh.inTangents = [[-k, 0], [0, -k], [k, 0], [0, k]];
      sh.outTangents = [[k, 0], [0, k], [-k, 0], [0, -k]];
      sh.closed = true;
      return sh;
    });
  },
  flash: (L: any, m: any) => {
    const o = opac(L), top = m.p.intensity * 100;
    o.setValueAtTime(m.t, 0);
    o.setValueAtTime(m.t + m.dur * 0.35, top);
    o.setValueAtTime(m.t + m.dur, 0);
  },
  // enfasi
  zoom_punch: (L: any, m: any) => {
    const s = scala(L).valueAtTime(m.t, false), k = 1 + m.p.amount_pct / 100;
    anima(scala(L), m.t, m.t + m.dur * 0.3, [s[0], s[1]], [s[0] * k, s[1] * k], [0.2, 0.8, 0.3, 1]);
    anima(scala(L), m.t + m.dur * 0.3, m.t + m.dur, [s[0] * k, s[1] * k], [s[0], s[1]], m.bez);
  },
  shake_hit: (L: any, m: any) => {
    const p = prop(L, "ADBE Transform Group", "ADBE Position");
    const parti = p.dimensionsSeparated ? posXY(L) : [p];
    // scossa smorzata e sempre uguale (niente wiggle casuale): stesso input, stesso video
    for (let i = 0; i < parti.length; i++) {
      parti[i].expression = "var t=time-" + m.t + ",d=" + m.dur + ";if(t>0&&t<d){var k=(1-t/d);value+" +
        (parti.length === 1 ? "[" + m.p.amount_px + "*k*Math.sin(t*90)," + m.p.amount_px + "*k*Math.cos(t*73)]" : m.p.amount_px + "*k*Math." + (i ? "cos(t*73)" : "sin(t*90)")) +
        "}else value;";
    }
  },
};
// Le mosse su misura (vocabolario/mosse approvate e proposte usate da questo reel) si registrano qui, con lo stesso
// contratto: (livello, mossa) per quelle su un livello, (null, mossa) per gli overlay che creano livelli loro.
const MOSSE_SU_MISURA: any = {};
function applica(L: any, m: any) {
  const f = MOSSE_SU_MISURA[m.id] || MOSSE_LIVELLO[m.id];
  if (!f) throw new Error("mossa sconosciuta: " + m.id);
  f(L, m);
}
function sciaLaterale(L: any, t0: number, t1: number, a: number, b: number) {
  const db = effetto(L, "ADBE Motion Blur");
  db.property(1).setValue(90);
  const len = db.property(2);
  len.setValueAtTime(t0, a);
  len.setValueAtTime((t0 + t1) / 2, 180);
  len.setValueAtTime(t1, b);
}
// il quadro intero, in coordinate del livello (con margine)
function rettangoloLivello(L: any) {
  const s = scala(L).value[0] / 100;
  const src = L.source;
  const cx = src.width / 2, cy = src.height / 2;
  const mw = (W / 2) / s + 40, mh = (H / 2) / s + 40;
  return { l: cx - mw, t: cy - mh, rr: cx + mw, b: cy + mh };
}

// camera su un nullo genitore, per tutta la durata della scena
function camera(N: any, c: any, tin: number, tout: number) {
  if (!c || c.id === "static") return;
  const a = c.p.amount_pct || 0;
  const lento = [0.3, 0.05, 0.5, 1];
  if (c.id === "slow_push") anima(scala(N), tin, tout, [100, 100], [100 + a, 100 + a], lento);
  else if (c.id === "pull_out") anima(scala(N), tin, tout, [100 + a, 100 + a], [100, 100], lento);
  else if (c.id === "drift") {
    const z = 100 + a * 2.2;
    scala(N).setValue([z, z]);
    const [x, y] = posXY(N);
    const dx = (a / 100) * W, d = c.p.direction;
    if (d === "left" || d === "right") anima(x, tin, tout, W / 2 + (d === "left" ? dx : -dx), W / 2 + (d === "left" ? -dx : dx), lento);
    else anima(y, tin, tout, H / 2 + (d === "up" ? dx : -dx), H / 2 + (d === "up" ? -dx : dx), lento);
  }
}

// ---------- costruzione dei livelli (dal basso verso l'alto) ----------
function nullo(nome: string, x: number, y: number, tin: number, tout: number) {
  const N = comp.layers.addNull(S.durata);
  N.name = nome;
  prop(N, "ADBE Transform Group", "ADBE Position").setValue([x, y]);
  N.inPoint = tin;
  N.outPoint = tout;
  return N;
}
function ripresa(l: any) {
  const src = importa(l.file);
  const L = comp.layers.add(src);
  L.name = l.nome;
  L.audioEnabled = false;
  L.startTime = 0;
  const copre = Math.max(W / src.width, H / src.height) * 100;
  scala(L).setValue([copre, copre]);
  if (!src.mainSource.isStill) {
    L.timeRemapEnabled = true;
    const tr = prop(L, "ADBE Time Remapping");
    const fine = Math.min(src.duration - 0.05, l.da + (l.tout - l.tin) * l.vel);
    tr.setValueAtTime(l.tin, Math.min(l.da, fine));
    tr.setValueAtTime(l.tout, fine);
    for (let k = tr.numKeys; k >= 1; k--) {
      const t = tr.keyTime(k);
      if (Math.abs(t - l.tin) > 0.001 && Math.abs(t - l.tout) > 0.001) tr.removeKey(k);
    }
    if (l.vel < 1) L.frameBlendingType = FrameBlendingType.PIXEL_MOTION;
  }
  L.inPoint = l.tin;
  L.outPoint = l.tout;
  if (l.bianconero) effetto(L, "ADBE Tint");
  const N = nullo("camera " + l.nome, W / 2, H / 2, l.tin, l.tout);
  L.parent = N;
  camera(N, l.camera, l.tin, l.tout);
  for (let i = 0; i < l.mosse.length; i++) applica(L, l.mosse[i]);
}
function velo(l: any) {
  const pezzi: any[] = [];
  if (l.tutto > 0) pezzi.push([-200, H + 200, l.tutto, 0]);
  if (l.alto > 0) pezzi.push([-600, H * 0.34, l.alto, 600]);
  if (l.basso > 0) pezzi.push([H * 0.6, H + 600, l.basso, 600]);
  for (let i = 0; i < pezzi.length; i++) {
    const s = comp.layers.addSolid(l.colore, l.nome + " " + i, W, H, 1, S.durata);
    const mk = prop(s, "ADBE Mask Parade").addProperty("ADBE Mask Atom");
    const sh = new Shape();
    sh.vertices = [[-300, pezzi[i][0]], [W + 300, pezzi[i][0]], [W + 300, pezzi[i][1]], [-300, pezzi[i][1]]];
    sh.closed = true;
    mk.property("ADBE Mask Shape").setValue(sh);
    mk.property("ADBE Mask Feather").setValue([pezzi[i][3], pezzi[i][3]]);
    s.inPoint = l.tin;
    s.outPoint = l.tout;
    anima(opac(s), l.tin, l.tin + 0.3, 0, pezzi[i][2], [0.33, 0, 0.67, 1]);
  }
}
function solido(l: any) {
  const s = comp.layers.addSolid(l.colore, l.nome, W, H, 1, S.durata);
  s.inPoint = l.tin;
  s.outPoint = l.tout;
  opac(s).setValue(0);
  for (let i = 0; i < l.mosse.length; i++) applica(s, l.mosse[i]);
}
function rigaDiTesto(t: string, font: string, size: number, colore: number[], allinea: string, tracking: number) {
  const L = comp.layers.addText(t);
  const src = prop(L, "ADBE Text Properties", "ADBE Text Document");
  const doc = src.value as TextDocument;
  doc.resetCharStyle();
  doc.font = font;
  doc.fontSize = size;
  doc.applyFill = true;
  doc.fillColor = colore as [number, number, number];
  doc.applyStroke = false;
  doc.tracking = tracking || 0;
  doc.justification = allinea === "left" ? ParagraphJustification.LEFT_JUSTIFY : ParagraphJustification.CENTER_JUSTIFY;
  src.setValue(doc);
  return L;
}
function rimpicciolisci(L: any, k: number) {
  const src = prop(L, "ADBE Text Properties", "ADBE Text Document");
  const d = src.value as TextDocument;
  d.fontSize = Math.floor(d.fontSize * k);
  src.setValue(d);
}
// Un blocco di testo: una riga per livello, tutte figlie di un nullo al centro del blocco (enfasi e uscite lo muovono
// intero). Se la riga più larga non entra in `larghezza`, tutto il blocco si rimpicciolisce.
const controlli: any[] = [];
const fondi: any = {};  // il bordo basso misurato di ogni blocco, per mettere sotto quelli dopo
function blocco(l: any) {
  const righe: any[] = [];
  let size = l.size;
  for (let i = 0; i < l.righe.length; i++) {
    const r = l.righe[i];
    righe.push(rigaDiTesto(r.t, r.font || l.font, size, l.colore, l.allinea, l.tracking));
  }
  const tm = l.tin + 0.01;
  let maxw = 0;
  for (let i = 0; i < righe.length; i++) maxw = Math.max(maxw, righe[i].sourceRectAtTime(tm, false).width);
  if (maxw > l.larghezza) {
    const k = l.larghezza / maxw;
    for (let i = 0; i < righe.length; i++) rimpicciolisci(righe[i], k);
    size = Math.floor(size * k);
    maxw = 0;
    for (let i = 0; i < righe.length; i++) maxw = Math.max(maxw, righe[i].sourceRectAtTime(tm, false).width);
  }
  const lead = size * l.interlinea;
  const r0 = righe[0].sourceRectAtTime(tm, false), rn = righe[righe.length - 1].sourceRectAtTime(tm, false);
  const h = (righe.length - 1) * lead + rn.top + rn.height - r0.top;
  let top = l.sotto && fondi[l.sotto] !== undefined ? fondi[l.sotto] + l.distanza : l.ancora === "alto" ? l.y : l.ancora === "basso" ? l.y - h : l.y - h / 2;
  // dentro la zona sicura delle interfacce di Instagram e TikTok
  if (top + h > S.safe.basso) top = S.safe.basso - h;
  if (top < S.safe.alto) top = S.safe.alto;
  const cx = l.allinea === "left" ? l.x + maxw / 2 : l.x;
  // l'evidenziatore va sotto le righe: si crea prima e si sposta sotto
  const N = nullo(l.nome, cx, top + h / 2, l.tin, l.tout);
  for (let i = 0; i < righe.length; i++) {
    const R = righe[i];
    R.name = l.nome + " riga " + (i + 1);
    prop(R, "ADBE Transform Group", "ADBE Position").setValue([l.x, top - r0.top + i * lead]);
    R.inPoint = l.tin;
    R.outPoint = l.tout;
    R.parent = N;
  }
  fondi[l.nome] = top + h;
  controlli.push({ nome: l.nome, x0: cx - maxw / 2, y0: top, x1: cx + maxw / 2, y1: top + h, tin: l.tin, tout: l.tout, size, testo: l.righe.map((r: any) => r.t).join(" / ") });
  // mosse: quelle del testo vanno su ogni riga (con lo scaglionamento che prosegue), le altre sul blocco
  for (let j = 0; j < l.mosse.length; j++) {
    const m = l.mosse[j];
    if (MOSSE_TESTO[m.id] || m.perRiga) {
      let base = 0;
      for (let i = 0; i < righe.length; i++) {
        const unita = m.id === "line_mask_reveal" || m.id === "tracking_expand" ? 1 : m.id === "char_cascade" || m.id === "typewriter" ? l.righe[i].t.length : l.righe[i].t.split(" ").length;
        (MOSSE_TESTO[m.id] || MOSSE_SU_MISURA[m.id])(righe[i], { ...m, base: m.inv ? 0 : base, riga: i });
        base += m.perRiga ? 1 : unita;
      }
    } else if (m.id === "underline_draw" || m.id === "highlight_box") {
      segno(l, m, N, cx, top, maxw, h, size);
    } else applica(N, m);
  }
  return N;
}
// sottolineatura e evidenziatore: una forma figlia del blocco, che si allarga da sinistra
function segno(l: any, m: any, N: any, cx: number, top: number, w: number, h: number, size: number) {
  const F = comp.layers.addShape();
  F.name = l.nome + " " + m.id;
  const g = prop(F, "ADBE Root Vectors Group").addProperty("ADBE Vector Group");
  const r = g.property("ADBE Vectors Group").addProperty("ADBE Vector Shape - Rect");
  let rw = w, rh = m.p.thickness || 6, ry = top + h + size * 0.22;
  if (m.id === "highlight_box") {
    const pad = (m.p.padding_pct / 100) * W;
    rw = w + pad * 2;
    rh = h + pad * 1.2;
    ry = top + h / 2;
    F.moveAfter(comp.layer(l.nome + " riga 1"));
  }
  r.property("ADBE Vector Rect Size").setValue([rw, rh]);
  r.property("ADBE Vector Rect Position").setValue([rw / 2, 0]);
  const f = prop(F, "ADBE Root Vectors Group").property(1).property("ADBE Vectors Group").addProperty("ADBE Vector Graphic - Fill");
  f.property("ADBE Vector Fill Color").setValue(l.accento);
  prop(F, "ADBE Transform Group", "ADBE Position").setValue([cx - rw / 2, ry]);
  F.inPoint = l.tin;
  F.outPoint = l.tout;
  anima(scala(F), m.t, m.t + m.dur, [0, 100], [100, 100], m.bez);
  F.parent = N;
}
function logo(l: any) {
  const src = importa(l.file);
  src.mainSource.alphaMode = AlphaMode.STRAIGHT;
  const L = comp.layers.add(src);
  L.name = l.nome;
  const k = (l.larghezza / src.width) * 100;
  scala(L).setValue([k, k]);
  prop(L, "ADBE Transform Group", "ADBE Position").setValue([l.x, l.y]);
  L.inPoint = l.tin;
  L.outPoint = l.tout;
  controlli.push({ nome: l.nome, x0: l.x - l.larghezza / 2, y0: l.y - (src.height * k) / 200, x1: l.x + l.larghezza / 2, y1: l.y + (src.height * k) / 200, tin: l.tin, tout: l.tout, logo: true });
  for (let i = 0; i < l.mosse.length; i++) applica(L, l.mosse[i]);
}

// @@MOSSE_SU_MISURA@@

// AE mette ogni livello nuovo in cima: si costruisce dal basso verso l'alto seguendo l'ordine della scena.
if (S.audio) {
  const A = comp.layers.add(importa(S.audio.file));
  A.startTime = 0;
  const lv = prop(A, "ADBE Audio Group", "ADBE Audio Levels");
  anima(lv, S.durata - 1.6, S.durata, [0, 0], [-48, -48], [0.33, 0, 0.67, 1]);
}
for (let i = 0; i < S.livelli.length; i++) {
  const l = S.livelli[i];
  if (l.k === "media") ripresa(l);
  else if (l.k === "velo") velo(l);
  else if (l.k === "solido") solido(l);
  else if (l.k === "testo") blocco(l);
  else if (l.k === "logo") logo(l);
  else if (l.k === "overlay") MOSSE_SU_MISURA[l.mossa.id](null, l.mossa);
}
if (S.controlli) {
  const f = new File(S.controlli);
  f.encoding = "UTF-8";
  f.open("w");
  f.write(JSON.stringify(controlli));
  f.close();
}
