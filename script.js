/* ==========================================================
   Budget Grocer
   1. Catalogue + meals (estimated prices, see README)
   2. List parsing + matching, and the basket (list + planned meals)
   3. Location (Nominatim) and nearby shops (Overpass / OpenStreetMap)
   4. Rendering the receipt
   5. Basket collage, plan meals, wiring
   ========================================================== */
(() => {
  'use strict';

  const $ = (s, el = document) => el.querySelector(s);
  const $$ = (s, el = document) => [...el.querySelectorAll(s)];
  const eur = new Intl.NumberFormat('en-IE', { style: 'currency', currency: 'EUR' });
  const fmt = (n) => eur.format(n);
  const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  /* ---------- 1. DATA ---------- */
  // [id, short label, text added to list, receipt detail, base price in €, pack size, unit, keywords]
  // Pack size is in the unit (g, ml, pc = pieces, clove) and lets meals work out how many packs to buy.
  const RAW = [
    ['milk', 'Milk', 'whole milk 1L', 'Whole milk, 1 L carton', 0.95, 1000, 'ml', 'milk'],
    ['eggs', 'Eggs', 'eggs x12', 'Medium eggs, dozen', 2.69, 12, 'pc', 'eggs?'],
    ['bread', 'Bread', 'sliced bread', 'White sliced bread, 450 g', 1.15, 1, 'pc', 'sliced bread|bread|baguette|loaf'],
    ['olive-oil', 'Olive oil', 'olive oil 1L', 'Extra virgin olive oil, 1 L', 5.49, 1000, 'ml', 'olive oil|oil'],
    ['tomatoes', 'Tomatoes', 'tomatoes 1kg', 'Vine tomatoes, 1 kg', 1.89, 1000, 'g', 'tomato'],
    ['tomato-sauce', 'Tomato sauce', 'tomato sauce', 'Tomato sauce, 400 g', 0.95, 400, 'g', 'tomato sauce|passata|chopped tomato|tinned tomato|tomato puree'],
    ['pasta', 'Pasta', 'pasta', 'Macaroni, 500 g', 0.85, 500, 'g', 'pasta|macaroni|penne|fusilli'],
    ['spaghetti', 'Spaghetti', 'spaghetti', 'Spaghetti, 500 g', 0.85, 500, 'g', 'spaghetti|noodle'],
    ['lasagne-sheets', 'Lasagne sheets', 'lasagne sheets', 'Lasagne sheets, 500 g', 1.55, 500, 'g', 'lasagne|lasagna'],
    ['rice', 'Rice', 'rice 1kg', 'Round rice, 1 kg', 1.45, 1000, 'g', 'rice'],
    ['risotto-rice', 'Risotto rice', 'risotto rice', 'Arborio rice, 500 g', 2.39, 500, 'g', 'risotto rice|arborio'],
    ['bananas', 'Bananas', 'bananas', 'Canary bananas, 1 kg', 2.1, 1000, 'g', 'banana'],
    ['chicken', 'Chicken', 'chicken breast 500g', 'Chicken breast, 500 g', 3.95, 500, 'g', 'chicken'],
    ['cheese', 'Cheese', 'sliced cheese', 'Sliced cheese, 200 g', 2.15, 200, 'g', 'cheese|cheddar'],
    ['mozzarella', 'Mozzarella', 'mozzarella', 'Grated mozzarella, 200 g', 1.69, 200, 'g', 'mozzarella'],
    ['parmesan', 'Parmesan', 'parmesan', 'Grated parmesan, 80 g', 1.89, 80, 'g', 'parmesan|parmigiano'],
    ['feta', 'Feta', 'feta', 'Feta cheese, 200 g', 2.15, 200, 'g', 'feta'],
    ['potatoes', 'Potatoes', 'potatoes 2kg', 'Potatoes, 2 kg bag', 2.4, 2000, 'g', 'potato'],
    ['onions', 'Onions', 'onions 1kg', 'Onions, 1 kg bag', 1.25, 1000, 'g', 'onion'],
    ['apples', 'Apples', 'apples 1kg', 'Golden apples, 1 kg', 2.1, 1000, 'g', 'apple'],
    ['water', 'Water', 'water 6x1.5L', 'Mineral water, 6 × 1.5 L', 2.3, 6, 'pc', 'water'],
    ['coffee', 'Coffee', 'ground coffee', 'Ground coffee, 250 g', 2.95, 250, 'g', 'coffee'],
    ['tuna', 'Tuna', 'tinned tuna', 'Tuna, pack of 3 tins', 2.99, 3, 'pc', 'tuna'],
    ['garlic', 'Garlic', 'garlic', 'Garlic, 3 heads', 0.99, 30, 'clove', 'garlic'],
    ['carrots', 'Carrots', 'carrots 1kg', 'Carrots, 1 kg', 1.15, 1000, 'g', 'carrot'],
    ['oranges', 'Oranges', 'oranges 2kg', 'Table oranges, 2 kg', 2.49, 2000, 'g', 'orange'],
    ['butter', 'Butter', 'butter', 'Butter, 250 g', 2.35, 250, 'g', 'butter'],
    ['yoghurt', 'Yoghurt', 'yoghurt x4', 'Natural yoghurt, pack of 4', 1.05, 4, 'pc', 'yoghurt|yogurt'],
    ['cereal', 'Cereal', 'cereal', 'Corn flakes, 500 g', 2.25, 500, 'g', 'cereal|corn flakes'],
    ['sugar', 'Sugar', 'sugar 1kg', 'White sugar, 1 kg', 1.35, 1000, 'g', 'sugar'],
    ['salt', 'Salt', 'salt', 'Fine salt, 1 kg', 0.55, 1000, 'g', 'salt'],
    ['flour', 'Flour', 'flour', 'Plain flour, 1 kg', 0.99, 1000, 'g', 'flour'],
    ['lentils', 'Lentils', 'lentils', 'Brown lentils, 1 kg', 2.05, 1000, 'g', 'lentil'],
    ['chickpeas', 'Chickpeas', 'chickpeas', 'Cooked chickpeas, 400 g', 0.89, 400, 'g', 'chickpea'],
    ['ham', 'Ham', 'cooked ham', 'Cooked ham slices, 200 g', 2.35, 200, 'g', 'ham'],
    ['mince', 'Beef mince', 'beef mince 500g', 'Beef mince, 500 g', 4.25, 500, 'g', 'mince|minced|beef|pork'],
    ['salmon', 'Salmon', 'salmon', 'Salmon fillets, 2 × 125 g', 3.49, 250, 'g', 'salmon'],
    ['hake', 'Hake', 'white fish', 'Hake fillets, 400 g', 5.49, 400, 'g', 'hake|fish|cod'],
    ['lettuce', 'Lettuce', 'lettuce', 'Romaine lettuce, each', 0.99, 1, 'pc', 'lettuce|salad'],
    ['peppers', 'Peppers', 'peppers', 'Green peppers, 500 g', 1.89, 500, 'g', 'pepper'],
    ['cucumber', 'Cucumber', 'cucumber', 'Cucumber, each', 0.59, 1, 'pc', 'cucumber'],
    ['strawberries', 'Strawberries', 'strawberries', 'Strawberries, 500 g', 2.49, 500, 'g', 'strawberr'],
    ['lemons', 'Lemons', 'lemons', 'Lemons, bag of 6', 1.79, 6, 'pc', 'lemon'],
    ['mushrooms', 'Mushrooms', 'mushrooms', 'Sliced mushrooms, 400 g', 1.99, 400, 'g', 'mushroom'],
    ['basil', 'Fresh basil', 'fresh basil', 'Fresh basil, pot', 1.29, 1, 'pc', 'basil'],
    ['olives', 'Black olives', 'black olives', 'Pitted black olives, 200 g', 1.25, 200, 'g', 'olives'],
    ['stock', 'Stock cubes', 'stock cubes', 'Vegetable stock cubes, 12 pack', 0.99, 12, 'pc', 'stock|broth'],
    ['pizza-base', 'Pizza bases', 'pizza bases', 'Pizza bases, pack of 2', 1.89, 2, 'pc', 'pizza base|pizza dough'],
    ['curry-paste', 'Curry paste', 'curry paste', 'Mild curry paste, jar', 1.99, 1, 'pc', 'curry'],
    ['coconut-milk', 'Coconut milk', 'coconut milk', 'Coconut milk, 400 ml', 1.39, 400, 'ml', 'coconut milk|coconut'],
    ['soy-sauce', 'Soy sauce', 'soy sauce', 'Soy sauce, 150 ml', 1.85, 150, 'ml', 'soy sauce|soy'],
    ['peas', 'Frozen peas', 'frozen peas', 'Frozen peas, 450 g', 1.45, 450, 'g', 'peas'],
    ['spring-onions', 'Spring onions', 'spring onions', 'Spring onions, bunch', 0.99, 1, 'pc', 'spring onion'],
    ['buns', 'Burger buns', 'burger buns', 'Burger buns, pack of 4', 1.65, 4, 'pc', 'burger bun|buns|bun'],
    ['ketchup', 'Ketchup', 'ketchup', 'Tomato ketchup, 500 g', 1.69, 1, 'pc', 'ketchup'],
    ['toilet-paper', 'Toilet paper', 'toilet paper', 'Toilet paper, 12 rolls', 4.45, 12, 'pc', 'toilet paper|toilet roll'],
    ['detergent', 'Detergent', 'laundry detergent', 'Liquid detergent, 30 washes', 5.95, 30, 'pc', 'detergent|laundry'],
    ['toothpaste', 'Toothpaste', 'toothpaste', 'Toothpaste, 75 ml', 1.95, 1, 'pc', 'toothpaste'],
    ['beer', 'Beer', 'beer', 'Beer, pack of 6 cans', 3.6, 6, 'pc', 'beer'],
    ['wine', 'Wine', 'red wine', 'Young red wine, 75 cl', 2.99, 1, 'pc', 'wine'],
    ['biscuits', 'Biscuits', 'biscuits', 'Maria biscuits, 800 g', 1.55, 800, 'g', 'biscuit|cookie'],
    ['chocolate', 'Chocolate', 'chocolate', 'Milk chocolate, 125 g', 1.25, 125, 'g', 'chocolate'],
    ['orange-juice', 'Orange juice', 'orange juice', 'Orange juice, 1 L', 1.55, 1000, 'ml', 'orange juice|juice'],
    ['cola', 'Cola', 'cola', 'Cola, 2 L', 1.65, 2000, 'ml', 'cola|soda|soft drink'],
    ['frozen-pizza', 'Frozen pizza', 'frozen pizza', 'Frozen pizza, 350 g', 2.49, 1, 'pc', 'frozen pizza|pizza'],
    ['ice-cream', 'Ice cream', 'ice cream', 'Ice cream tub, 500 ml', 2.99, 1, 'pc', 'ice cream'],
    ['sausages', 'Sausages', 'sausages', 'Cooked sausages, 6 pack', 1.95, 6, 'pc', 'sausage'],
  ];

  const norm = (s) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();

  const CATALOG = RAW.map(([id, short, add, detail, price, size, unit, kw]) => {
    const kws = kw.split('|');
    return { id, short, add, detail, price, size, unit, kws, res: kws.map((k) => [k, new RegExp('\\b' + k + (k.length <= 3 ? '\\b' : ''))]) };
  });
  const byId = Object.fromEntries(CATALOG.map((c) => [c.id, c]));
  const QUICK = ['milk', 'eggs', 'bread', 'olive-oil', 'tomatoes', 'pasta', 'rice', 'bananas', 'chicken', 'cheese', 'potatoes', 'onions', 'apples', 'water', 'coffee', 'tuna'];

  // Each meal: ingredients for 4 servings as [item id, amount in the item's unit, true if it is a cupboard staple].
  // a / b are the two tones of the placeholder plate; a real photo at images/meals/<id>.jpg replaces it.
  const MEALS = [
    { id: 'lasagne', name: 'Lasagne', blurb: 'Layers of beef ragù, creamy white sauce and melted mozzarella.', time: '1 h 15 min', mins: 75, veg: false, a: '#E8A24F', b: '#A8402A',
      ing: [['lasagne-sheets', 250], ['mince', 400], ['onions', 200], ['carrots', 150], ['garlic', 2], ['tomato-sauce', 400], ['milk', 500], ['butter', 50], ['flour', 50], ['mozzarella', 200], ['parmesan', 40], ['olive-oil', 30, 1], ['salt', 5, 1]] },
    { id: 'bolognese', name: 'Spaghetti Bolognese', blurb: 'The weeknight classic: slow tomato and beef sauce over spaghetti.', time: '45 min', mins: 45, veg: false, a: '#E8B060', b: '#9E3322',
      ing: [['spaghetti', 400], ['mince', 400], ['onions', 150], ['carrots', 100], ['garlic', 2], ['tomato-sauce', 400], ['parmesan', 40], ['olive-oil', 30, 1], ['salt', 5, 1]] },
    { id: 'pizza', name: 'Margherita pizza', blurb: 'Crisp base, tomato, mozzarella and a handful of fresh basil.', time: '25 min', mins: 25, veg: true, a: '#F0C36A', b: '#B5412E',
      ing: [['pizza-base', 2], ['tomato-sauce', 200], ['mozzarella', 250], ['basil', 1], ['olive-oil', 15, 1]] },
    { id: 'fried-rice', name: 'Chicken fried rice', blurb: 'Quick wok supper with egg, peas and soy.', time: '25 min', mins: 25, veg: false, a: '#F0D9A0', b: '#8C6A2E',
      ing: [['rice', 300], ['chicken', 300], ['eggs', 3], ['peas', 150], ['carrots', 150], ['spring-onions', 1], ['soy-sauce', 60], ['garlic', 2], ['olive-oil', 30, 1]] },
    { id: 'omelette', name: 'Spanish omelette', blurb: 'Soft potato and onion tortilla, the Spanish way.', time: '40 min', mins: 40, veg: true, a: '#DDBE6A', b: '#A8782E',
      ing: [['potatoes', 600], ['eggs', 6], ['onions', 200], ['olive-oil', 100, 1], ['salt', 5, 1]] },
    { id: 'curry', name: 'Chicken curry', blurb: 'Mild, creamy coconut curry served with rice.', time: '35 min', mins: 35, veg: false, a: '#E8A83A', b: '#B5601E',
      ing: [['chicken', 500], ['onions', 200], ['garlic', 3], ['curry-paste', 1], ['coconut-milk', 400], ['rice', 300], ['olive-oil', 30, 1], ['salt', 5, 1]] },
    { id: 'greek-salad', name: 'Greek salad', blurb: 'Tomato, cucumber, feta and olives with olive oil.', time: '15 min', mins: 15, veg: true, a: '#B7D68A', b: '#4F7A35',
      ing: [['tomatoes', 500], ['cucumber', 1], ['onions', 100], ['feta', 200], ['olives', 100], ['olive-oil', 40, 1], ['salt', 3, 1]] },
    { id: 'shakshuka', name: 'Shakshuka', blurb: 'Eggs poached in a spiced tomato and pepper sauce.', time: '30 min', mins: 30, veg: true, a: '#E6794F', b: '#A32A1C',
      ing: [['eggs', 6], ['tomato-sauce', 800], ['peppers', 300], ['onions', 150], ['garlic', 3], ['bread', 1], ['olive-oil', 30, 1], ['salt', 5, 1]] },
    { id: 'risotto', name: 'Mushroom risotto', blurb: 'Creamy, patient and comforting, finished with parmesan.', time: '40 min', mins: 40, veg: true, a: '#EAD9B4', b: '#8A7552',
      ing: [['risotto-rice', 320], ['mushrooms', 400], ['onions', 100], ['garlic', 2], ['stock', 2], ['parmesan', 40], ['butter', 40], ['olive-oil', 30, 1], ['salt', 5, 1]] },
    { id: 'salmon', name: 'Salmon with roast potatoes', blurb: 'Oven-baked salmon, lemon and crisp roast potatoes.', time: '35 min', mins: 35, veg: false, a: '#F0A890', b: '#B5533F',
      ing: [['salmon', 500], ['potatoes', 800], ['lemons', 1], ['garlic', 2], ['olive-oil', 40, 1], ['salt', 5, 1]] },
    { id: 'burgers', name: 'Burger night', blurb: 'Home-made beef burgers with cheese, lettuce and tomato.', time: '25 min', mins: 25, veg: false, a: '#D9A066', b: '#7A4426',
      ing: [['buns', 4], ['mince', 500], ['cheese', 100], ['lettuce', 1], ['tomatoes', 200], ['onions', 100], ['ketchup', 1], ['salt', 5, 1]] },
    { id: 'pancakes', name: 'Pancakes', blurb: 'Fluffy weekend pancakes with strawberries and lemon.', time: '20 min', mins: 20, veg: true, a: '#F2D3A0', b: '#B5793D',
      ing: [['flour', 250], ['milk', 500], ['eggs', 2], ['butter', 30], ['strawberries', 250], ['lemons', 1], ['sugar', 30, 1]] },
  ];
  // Card backgrounds use only the site palette: [lighter, darker].
  const PAIRS = [['#F7EDB9', '#EBC29F'], ['#D9DDB0', '#B7C4A0'], ['#FAF6EA', '#CBD5B5'], ['#EBC29F', '#E6B49A'], ['#F7EDB9', '#CBD5B5'], ['#D9DDB0', '#C9AE9C'], ['#FAF6EA', '#B7C4A0'], ['#EBC29F', '#C9AE9C'], ['#F7EDB9', '#E6B49A'], ['#D9DDB0', '#CBD5B5']];
  MEALS.forEach((m, i) => { [m.a, m.b] = PAIRS[(i + 2) % PAIRS.length]; });
  const mealById = Object.fromEntries(MEALS.map((m) => [m.id, m]));
  const BASE_SERVES = 4;

  // factor = how pricey the chain tends to be versus Mercadona. These are assumptions, not measured data.
  const CHAINS = [
    { id: 'mercadona', name: 'Mercadona', factor: 1.0, re: /mercadona/ },
    { id: 'lidl', name: 'Lidl', factor: 0.97, re: /\blidl\b/ },
    { id: 'aldi', name: 'Aldi', factor: 0.96, re: /\baldi\b/ },
    { id: 'dia', name: 'Dia', factor: 1.05, re: /^dia( |$)|supermercados dia|dia%|dia market/ },
    { id: 'carrefour', name: 'Carrefour', factor: 1.12, re: /carrefour/ },
    { id: 'alcampo', name: 'Alcampo', factor: 1.04, re: /alcampo/ },
    { id: 'eroski', name: 'Eroski', factor: 1.14, re: /eroski/ },
    { id: 'consum', name: 'Consum', factor: 1.08, re: /\bconsum\b/ },
    { id: 'ahorramas', name: 'Ahorramás', factor: 1.02, re: /ahorra ?mas/ },
    { id: 'condis', name: 'Condis', factor: 1.15, re: /\bcondis\b/ },
    { id: 'caprabo', name: 'Caprabo', factor: 1.15, re: /caprabo/ },
    { id: 'bonpreu', name: 'Bonpreu', factor: 1.12, re: /bon ?preu|esclat/ },
    { id: 'eci', name: 'El Corte Inglés', factor: 1.28, re: /corte ingles|hipercor|supercor/ },
  ];
  const chainById = Object.fromEntries(CHAINS.map((c) => [c.id, c]));
  const FALLBACK = ['mercadona', 'lidl', 'aldi', 'dia', 'carrefour', 'alcampo'];

  const hashInt = (s) => { let h = 2166136261; for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); } return h >>> 0; };
  const priceAt = (chain, item) => Math.round(item.price * chain.factor * (0.94 + 0.12 * ((hashInt(chain.id + item.id) % 1000) / 1000)) * 100) / 100;

  /* ---------- 2. LIST PARSING + BASKET ---------- */
  const lev = (a, b) => {
    if (Math.abs(a.length - b.length) > 1) return 9;
    const d = Array.from({ length: a.length + 1 }, (_, i) => [i]);
    for (let j = 1; j <= b.length; j++) d[0][j] = j;
    for (let i = 1; i <= a.length; i++) for (let j = 1; j <= b.length; j++)
      d[i][j] = Math.min(d[i - 1][j] + 1, d[i][j - 1] + 1, d[i - 1][j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
    return d[a.length][b.length];
  };

  function splitList(text) {
    const seen = new Set();
    return text.split(/[\n;]+|,(?!\d)/).map((s) => s.trim()).filter(Boolean).filter((s) => {
      const k = norm(s).replace(/\s+/g, ' ');
      if (seen.has(k)) return false;
      seen.add(k); return true;
    });
  }

  function matchItem(raw) {
    let s = norm(raw), qty = 1;
    const q = s.match(/^(\d{1,2})\s*(?:x|×)?\s+(?=[a-z])/);
    if (q) { qty = Math.max(1, +q[1]); s = s.slice(q[0].length); }
    s = s
      .replace(/\b\d+([.,]\d+)?\s*(kg|kilos?|gr?|l|ml|cl|litres?|liters?|pcs?|pieces|x\d*)\b/g, ' ')
      .replace(/\bx\s*\d+\b/g, ' ')
      .replace(/\d+\s*x\s*\d+([.,]\d+)?\s*[a-z]*/g, ' ')
      .replace(/[^a-z\s]/g, ' ').replace(/\s+/g, ' ').trim();
    let best = null, score = 0;
    for (const c of CATALOG) {
      for (const [k, re] of c.res) if (re.test(s) && k.length * 2 > score) { best = c; score = k.length * 2; }
    }
    if (!best) {
      const toks = s.split(' ').filter((t) => t.length >= 5);
      for (const c of CATALOG) for (const k of c.kws) {
        if (k.includes(' ') || k.length < 5) continue;
        for (const t of toks) if (lev(t.slice(0, k.length + 1), k) <= 1 && k.length > score) { best = c; score = k.length; }
      }
    }
    return { raw, qty, item: best };
  }

  const parse = (text) => splitList(text).map(matchItem);

  // Planned meals: { mealId: { servings, pantry: [staple ids the person ticked] } }
  let plan = {};

  // Meal ingredients scaled to the servings; staples only when ticked.
  const mealNeeds = (meal, servings, pantry) => meal.ing
    .filter(([id, , staple]) => !staple || pantry.includes(id))
    .map(([id, amt]) => ({ item: byId[id], amount: amt * servings / BASE_SERVES }));
  const packsFor = (item, amount) => Math.max(1, Math.ceil(amount / item.size - 1e-9));

  // The whole basket: list rows + meal ingredients, merged by item so two meals share one bag of onions.
  function allRows(listText) {
    const need = new Map();
    Object.entries(plan).forEach(([mid, p]) => {
      const meal = mealById[mid]; if (!meal) return;
      mealNeeds(meal, p.servings, p.pantry).forEach(({ item, amount }) => need.set(item.id, (need.get(item.id) || 0) + amount));
    });
    const rows = [];
    const at = new Map();
    const add = (item, raw, qty) => {
      if (item && at.has(item.id)) { at.get(item.id).qty += qty; return; }
      const r = { raw, qty, item };
      if (item) at.set(item.id, r);
      rows.push(r);
    };
    need.forEach((amount, id) => add(byId[id], byId[id].short, packsFor(byId[id], amount)));
    parse(listText).forEach((r) => add(r.item, r.raw, r.qty));
    return rows;
  }

  /* ---------- 3. LOCATION + STORES ---------- */
  const state = { coords: null, label: '' };

  async function fetchJSON(url, opts = {}, ms = 14000) {
    const ctl = new AbortController();
    const t = setTimeout(() => ctl.abort(), ms);
    try {
      const r = await fetch(url, { ...opts, signal: ctl.signal });
      if (!r.ok) throw new Error('HTTP ' + r.status);
      return await r.json();
    } finally { clearTimeout(t); }
  }

  const placeLabel = (a, fallback) => {
    if (!a) return fallback;
    const town = a.city || a.town || a.village || a.municipality || a.suburb || a.county || '';
    return [a.postcode, town].filter(Boolean).join(' ') || fallback;
  };

  async function geocode(text) {
    const t = text.trim();
    // First choice: OpenStreetMap Nominatim. If it can't be reached, try Open-Meteo's place search.
    try {
      const base = 'https://nominatim.openstreetmap.org/search?format=jsonv2&limit=1&addressdetails=1&countrycodes=es&accept-language=es';
      const url = /^\d{5}$/.test(t) ? `${base}&postalcode=${t}&country=es` : `${base}&q=${encodeURIComponent(t + ', Spain')}`;
      const data = await fetchJSON(url, {}, 6000);
      if (data.length) {
        const r = data[0];
        return { lat: +r.lat, lon: +r.lon, label: placeLabel(r.address, r.display_name.split(',').slice(0, 2).join(',')) };
      }
    } catch { /* fall through to the second service */ }
    const d = await fetchJSON(`https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(t)}&count=1&language=en&countryCode=ES`, {}, 6000);
    const r = d.results && d.results[0];
    return r ? { lat: r.latitude, lon: r.longitude, label: [r.postcodes && r.postcodes[0], r.name].filter(Boolean).join(' ') || t } : null;
  }

  async function reverse(lat, lon) {
    try {
      const r = await fetchJSON(`https://nominatim.openstreetmap.org/reverse?format=jsonv2&zoom=14&addressdetails=1&accept-language=es&lat=${lat}&lon=${lon}`, {}, 8000);
      return placeLabel(r.address, 'your location');
    } catch { return 'your location'; }
  }

  const km = (a, b, c, d) => {
    const R = 6371, rad = Math.PI / 180;
    const x = Math.sin((c - a) * rad / 2) ** 2 + Math.cos(a * rad) * Math.cos(c * rad) * Math.sin((d - b) * rad / 2) ** 2;
    return 2 * R * Math.asin(Math.sqrt(x));
  };

  const OVERPASS = ['https://overpass-api.de/api/interpreter', 'https://overpass.kumi.systems/api/interpreter'];

  async function findStores(lat, lon, radiusKm) {
    const q = `[out:json][timeout:15];nwr["shop"="supermarket"](around:${Math.round(radiusKm * 1000)},${lat},${lon});out center tags 150;`;
    let data = null;
    for (const ep of OVERPASS) {
      try {
        data = await fetchJSON(ep, { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body: "data=" + encodeURIComponent(q) }, 10000);
        break;
      } catch { /* try next mirror */ }
    }
    if (!data) throw new Error('overpass');
    const nearest = new Map();
    for (const el of data.elements) {
      const t = el.tags || {};
      const names = [t.brand, t.name, t.operator].filter(Boolean).map(norm);
      const chain = CHAINS.find((c) => names.some((n) => c.re.test(n)));
      const la = el.lat ?? el.center?.lat, lo = el.lon ?? el.center?.lon;
      if (!chain || la == null) continue;
      const d = km(lat, lon, la, lo);
      const prev = nearest.get(chain.id);
      if (!prev || d < prev.dist) {
        const street = [t['addr:street'], t['addr:housenumber']].filter(Boolean).join(' ');
        nearest.set(chain.id, { chain, name: t.name || chain.name, dist: d, addr: street || t['addr:suburb'] || '', lat: la, lon: lo });
      }
    }
    return [...nearest.values()];
  }

  /* ---------- 4. RENDER ---------- */
  function barcode(seed, n = 46) {
    let h = hashInt(String(seed)), x = 0, out = '';
    for (let i = 0; i < n; i++) {
      h = (Math.imul(h, 1103515245) + 12345) >>> 0;
      const w = 1 + ((h >>> 16) % 3);
      if (i % 2 === 0) out += `<rect x="${x}" y="0" width="${w}" height="40"/>`;
      x += w;
    }
    return `<svg viewBox="0 0 ${x} 40" preserveAspectRatio="none" aria-hidden="true" focusable="false">${out}</svg>`;
  }
  const fmtKm = (d) => `~${d.toLocaleString('en-GB', { maximumFractionDigits: 1 })} km`;
  const mapsUrl = (s) => `https://www.google.com/maps/search/?api=1&query=${s.lat},${s.lon}`;

  function priceBasket(rows, store) {
    const lines = rows.filter((r) => r.item).map((r) => {
      const unit = priceAt(store.chain, r.item);
      return { name: r.item.detail, qty: r.qty, total: Math.round(unit * r.qty * 100) / 100 };
    });
    return { ...store, lines, total: Math.round(lines.reduce((s, l) => s + l.total, 0) * 100) / 100 };
  }

  const chevron = '<svg viewBox="0 0 24 24" width="14" height="14" aria-hidden="true" focusable="false"><path d="M6 9l6 6 6-6" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>';

  function render({ rows, stores, label, note }) {
    const unmatched = rows.filter((r) => !r.item).map((r) => r.raw);
    const priced = rows.length - unmatched.length;
    const ranked = stores.map((s) => priceBasket(rows, s)).sort((a, b) => a.total - b.total);
    const top = ranked[0], worst = ranked[ranked.length - 1];
    const max = worst.total || 1;
    const saving = Math.round((worst.total - top.total) * 100) / 100;
    const pct = worst.total ? Math.round((saving / worst.total) * 100) : 0;
    const metaOf = (s) => [s.dist != null ? fmtKm(s.dist) : '', s.addr].filter(Boolean).join(' · ');
    const next = ranked.slice(1, 4);
    const generic = stores.every((x) => x.lat == null);

    let html = '<div class="out">';
    if (note) html += `<p class="note">${note}</p>`;
    if (unmatched.length) html += `<p class="note"><strong>We couldn’t price:</strong> ${unmatched.map(esc).join(', ')}. Try simpler words, like “milk” or “tomatoes”. The totals leave these out.</p>`;

    html += `<section class="win" aria-labelledby="w-title">
      <span class="card-bg" aria-hidden="true"></span>
      <p class="win-top"><span>Basket ${priced} / ${rows.length}</span><span class="pill">Cheapest</span></p>
      <p class="win-eyebrow">${generic ? 'Typical prices · main chains' : 'Near ' + esc(label)}</p>
      <h3 id="w-title">${esc(top.name)}</h3>
      <p class="win-total">${fmt(top.total)}</p>
      ${next.length ? `<ul class="glass">${next.map((s) => `<li><span>${esc(s.name)}</span><b>${fmt(s.total)}</b><em>+${Math.round((s.total / top.total - 1) * 100)}%</em></li>`).join('')}</ul>` : ''}
      <div class="sheet">
        ${saving > 0 ? `<p class="sheet-k">You save</p><p class="sheet-v">${fmt(saving)}</p><p class="sheet-s">${pct}% less than at ${esc(worst.name)}</p>` : `<p class="sheet-k">Basket total</p><p class="sheet-v">${fmt(top.total)}</p>`}
        <p class="sheet-m"><span>${esc(metaOf(top) || 'Typical prices')}</span>${top.lat ? `<a href="${mapsUrl(top)}" target="_blank" rel="noopener">Open in Maps<span class="sr"> (opens in a new tab)</span></a>` : ''}</p>
      </div>
    </section>`;

    html += '<div class="receipt"><p class="r-head">Receipt · all shops, cheapest first</p><ol class="rank">';
    ranked.forEach((s, i) => {
      html += `<li><details${i === 0 ? ' open' : ''}>
        <summary>
          <span class="pos" aria-hidden="true">${String(i + 1).padStart(2, '0')}</span>
          <span><span class="s-name">${esc(s.name)}</span><span class="s-meta">${esc(metaOf(s) || 'Typical prices')}</span></span>
          <span class="s-right"><span class="s-price">${fmt(s.total)}</span><span class="s-more">Items ${chevron}</span></span>
          <span class="bar" aria-hidden="true"><i style="--w:${Math.max(8, Math.round((s.total / max) * 100))}%"></i></span>
        </summary>
        <ul class="lines">${s.lines.map((l) => `<li><span class="line-name">${l.qty > 1 ? l.qty + ' × ' : ''}${esc(l.name)}</span><span class="line-price">${fmt(l.total)}</span></li>`).join('')}</ul>
        <div class="s-foot">${s.lat ? `<a href="${mapsUrl(s)}" target="_blank" rel="noopener">Directions<span class="sr"> to ${esc(s.name)} (opens in a new tab)</span></a>` : '<span></span>'}<span class="code">${barcode(s.chain.id + s.total)}</span></div>
      </details></li>`;
    });
    html += '</ol></div></div>';
    return html;
  }

  /* ---------- basket collage ---------- */
  // Flat cutouts drawn on a 100 × 100 grid. A transparent PNG named images/<id>.png replaces the drawing.
  const ART = {
    milk: '<path d="M30 30h40v58a3 3 0 0 1-3 3H33a3 3 0 0 1-3-3Z" fill="#F7F4EC"/><path d="M30 30 50 14l20 16Z" fill="#E3DDCD"/><rect x="30" y="52" width="40" height="18" fill="#7E93A3"/><rect x="44" y="9" width="12" height="7" rx="2" fill="#7E93A3"/><circle cx="50" cy="61" r="4" fill="#F7F4EC"/>',
    eggs: '<path d="M10 64h80l-6 24H16Z" fill="#CDBB9C"/><ellipse cx="30" cy="54" rx="13" ry="17" fill="#F0D9B0"/><ellipse cx="50" cy="52" rx="13" ry="17" fill="#E8C792"/><ellipse cx="70" cy="54" rx="13" ry="17" fill="#F0D9B0"/><path d="M10 64h80l-3 12H13Z" fill="#B8A582"/>',
    bread: '<path d="M14 74V54c0-14 12-22 36-22s36 8 36 22v20a6 6 0 0 1-6 6H20a6 6 0 0 1-6-6Z" fill="#C2813F"/><path d="M14 54c0-14 12-22 36-22s36 8 36 22c0 4-3 6-6 6H20c-3 0-6-2-6-6Z" fill="#D7A062"/><path d="M34 40l6 14M50 38l6 16M66 40l6 14" stroke="#B26F31" stroke-width="3" stroke-linecap="round"/>',
    'olive-oil': '<rect x="44" y="9" width="12" height="9" rx="2" fill="#3E5A3B"/><path d="M44 18h12v14c0 6 12 8 12 20v34a5 5 0 0 1-5 5H37a5 5 0 0 1-5-5V52c0-12 12-14 12-20Z" fill="#B7A93A"/><rect x="36" y="58" width="28" height="24" rx="2" fill="#FBF8F2"/><path d="M42 66h16M42 72h10" stroke="#3E5A3B" stroke-width="2.5" stroke-linecap="round"/><path d="M40 44c1-5 5-8 8-9" stroke="#fff" stroke-opacity=".5" stroke-width="3" stroke-linecap="round" fill="none"/>',
    tomatoes: '<circle cx="50" cy="58" r="30" fill="#C8412B"/><ellipse cx="40" cy="46" rx="9" ry="6" fill="#E5705A" opacity=".7" transform="rotate(-30 40 46)"/><ellipse cx="42" cy="30" rx="10" ry="4" fill="#4A6B34" transform="rotate(-20 42 30)"/><ellipse cx="58" cy="30" rx="10" ry="4" fill="#4A6B34" transform="rotate(20 58 30)"/><rect x="48" y="20" width="4" height="10" rx="2" fill="#3C5A28"/>',
    pasta: '<rect x="28" y="12" width="44" height="78" rx="3" fill="#E9B94B"/><rect x="28" y="12" width="44" height="14" rx="3" fill="#B5472F"/><rect x="35" y="34" width="30" height="36" rx="3" fill="#F6E2A6"/><path d="M40 36v32M46 36v32M52 36v32M58 36v32" stroke="#E0B552" stroke-width="2.5"/><path d="M36 79h28" stroke="#B5472F" stroke-width="3" stroke-linecap="round"/>',
    rice: '<path d="M26 24h48l2 8v52a5 5 0 0 1-5 5H29a5 5 0 0 1-5-5V32Z" fill="#EFE7D2"/><path d="M24 32h52v6H24Z" fill="#D9CFB4"/><rect x="24" y="48" width="52" height="22" fill="#3E5A3B"/><path d="M34 59h32" stroke="#EFE7D2" stroke-width="3" stroke-linecap="round"/><g fill="#EFE7D2" stroke="#BBB197"><ellipse cx="38" cy="80" rx="4" ry="1.8"/><ellipse cx="52" cy="82" rx="4" ry="1.8"/><ellipse cx="62" cy="78" rx="4" ry="1.8"/></g>',
    bananas: '<path d="M18 58C30 84 66 84 86 38c1-3-1-6-5-5-14 26-36 34-58 14-3-2-7 3-5 11Z" fill="#E9CB4C"/><path d="M82 33c1-5 6-7 8-3l-5 8Z" fill="#6B5A2A"/><path d="M23 50c22 20 44 12 58-14" stroke="#CFAE30" stroke-width="2" fill="none"/>',
    chicken: '<path d="M10 46h80v32a6 6 0 0 1-6 6H16a6 6 0 0 1-6-6Z" fill="#F4F1EA"/><path d="M10 46h80" stroke="#DAD3C3" stroke-width="3"/><path d="M20 62c0-10 12-16 24-14s18 8 14 16-14 12-24 10-14-4-14-12Z" fill="#EDB19A"/><path d="M50 60c0-8 10-12 20-10s12 8 8 14-12 8-20 6-8-4-8-10Z" fill="#E3A087"/><path d="M28 56c6-4 14-4 18 0" stroke="#F7D2C2" stroke-width="3" stroke-linecap="round" fill="none"/><rect x="66" y="68" width="16" height="10" rx="1.5" fill="#FBF8F2"/>',
    cheese: '<path d="M12 50 88 34v38a4 4 0 0 1-4 4H16a4 4 0 0 1-4-4Z" fill="#EDC24A"/><path d="M12 50 60 22l28 12Z" fill="#F4D876"/><circle cx="34" cy="62" r="5" fill="#D6A62B"/><circle cx="62" cy="58" r="4" fill="#D6A62B"/><circle cx="74" cy="68" r="3" fill="#D6A62B"/>',
    potatoes: '<ellipse cx="38" cy="62" rx="26" ry="19" fill="#BD8E58" transform="rotate(-18 38 62)"/><ellipse cx="64" cy="52" rx="24" ry="18" fill="#C79A63" transform="rotate(20 64 52)"/><g fill="#8E6840"><ellipse cx="30" cy="62" rx="2.5" ry="1.5"/><ellipse cx="46" cy="68" rx="2.5" ry="1.5"/><ellipse cx="62" cy="48" rx="2.5" ry="1.5"/><ellipse cx="72" cy="58" rx="2.5" ry="1.5"/></g>',
    onions: '<path d="M50 14c2 10 4 14 4 18 14 4 26 16 26 32 0 16-12 26-30 26S20 80 20 64c0-16 12-28 26-32 0-4 2-8 4-18Z" fill="#A4466C"/><path d="M50 30C38 44 36 62 42 88M50 30c12 14 14 32 8 58" stroke="#C97A98" stroke-width="2.5" fill="none"/><path d="M46 90h8v4h-8Z" fill="#7B5A3A"/>',
    apples: '<path d="M50 34c-10-8-30-4-30 22 0 20 14 34 30 28 16 6 30-8 30-28 0-26-20-30-30-22Z" fill="#B3352B"/><path d="M34 46c2-6 8-8 12-6" stroke="#E27766" stroke-width="3.5" stroke-linecap="round" fill="none"/><path d="M50 34c0-8 2-14 6-18" stroke="#5B4528" stroke-width="3.5" stroke-linecap="round"/><path d="M54 24c8-8 18-6 20-4-2 8-12 10-20 4Z" fill="#4F7A35"/>',
    water: '<rect x="43" y="10" width="14" height="9" rx="2" fill="#4F7E93"/><path d="M44 19h12v8c0 6 10 8 10 18v42a5 5 0 0 1-5 5H39a5 5 0 0 1-5-5V45c0-10 10-12 10-18Z" fill="#CFE3EA" stroke="#9DBFCC" stroke-width="2"/><rect x="34" y="52" width="32" height="18" fill="#4F7E93"/><path d="M42 61h16" stroke="#E7F1F4" stroke-width="3" stroke-linecap="round"/>',
    coffee: '<path d="M26 20h48l2 10v54a5 5 0 0 1-5 5H29a5 5 0 0 1-5-5V30Z" fill="#4E3326"/><path d="M24 30h52" stroke="#3A261B" stroke-width="5"/><circle cx="50" cy="58" r="15" fill="#E9D9BF"/><ellipse cx="50" cy="58" rx="6" ry="9" fill="#4E3326" transform="rotate(30 50 58)"/>',
    tuna: '<ellipse cx="50" cy="72" rx="32" ry="11" fill="#6E8794"/><rect x="18" y="38" width="64" height="34" fill="#7B95A2"/><ellipse cx="50" cy="38" rx="32" ry="11" fill="#CBD5D9"/><rect x="18" y="46" width="64" height="20" fill="#3F6578"/><path d="M30 56h40" stroke="#E7EEF0" stroke-width="3" stroke-linecap="round"/><ellipse cx="50" cy="38" rx="22" ry="6.5" fill="#B7C3C8"/>',
    oranges: '<circle cx="50" cy="56" r="30" fill="#E88A2A"/><ellipse cx="40" cy="44" rx="9" ry="6" fill="#F3B15E" opacity=".7" transform="rotate(-30 40 44)"/><path d="M50 27c4-8 12-10 16-8-2 8-8 11-16 8Z" fill="#4F7A35"/>',
    lemons: '<ellipse cx="50" cy="56" rx="34" ry="24" fill="#EBD34A" transform="rotate(-15 50 56)"/><path d="M17 64l-6 3M83 48l6-3" stroke="#D2BA30" stroke-width="5" stroke-linecap="round"/><ellipse cx="42" cy="48" rx="10" ry="5" fill="#F6E88E" opacity=".7" transform="rotate(-25 42 48)"/>',
    garlic: '<path d="M50 16c3 12 4 14 4 20 18 4 28 20 22 36-4 10-16 16-26 16S28 82 24 72c-6-16 4-32 22-36 0-6 1-8 4-20Z" fill="#F1E6EA"/><path d="M50 36C40 50 38 70 44 88M50 36c10 14 12 34 6 52" stroke="#D9C3CC" stroke-width="2.5" fill="none"/><path d="M42 90h16v3H42Z" fill="#B59A7A"/>',
    carrots: '<g transform="rotate(35 50 55)"><path d="M38 34h24l-8 56a4 4 0 0 1-8 0Z" fill="#E57A26"/><path d="M42 48h8M48 62h8M44 74h6" stroke="#C8631A" stroke-width="2" stroke-linecap="round"/><path d="M50 34c-8-8-10-16-6-22 4 4 6 10 6 22Zm0 0c0-12 4-18 10-20 0 8-4 16-10 20Z" fill="#4F7A35"/></g>',
    lettuce: '<circle cx="50" cy="56" r="32" fill="#7FA35A"/><path d="M50 26c-16 6-24 20-20 40M50 26c16 6 24 20 20 40M50 26c-6 14-6 40 0 58" stroke="#5D8240" stroke-width="2.5" fill="none"/><circle cx="50" cy="56" r="18" fill="#A9C97E"/><path d="M50 40c-6 8-6 24 0 32" stroke="#7FA35A" stroke-width="2" fill="none"/>',
    strawberries: '<path d="M50 90C26 74 18 50 24 38c6-8 20-6 26-2 6-4 20-6 26 2 6 12-2 36-26 52Z" fill="#C9343F"/><g fill="#F4D58A"><ellipse cx="38" cy="52" rx="1.6" ry="2.6"/><ellipse cx="50" cy="48" rx="1.6" ry="2.6"/><ellipse cx="62" cy="52" rx="1.6" ry="2.6"/><ellipse cx="44" cy="64" rx="1.6" ry="2.6"/><ellipse cx="56" cy="64" rx="1.6" ry="2.6"/><ellipse cx="50" cy="76" rx="1.6" ry="2.6"/></g><path d="M50 34c-10-2-18 2-20 6 8 0 14 0 20-6Zm0 0c10-2 18 2 20 6-8 0-14 0-20-6Z" fill="#4F7A35"/>',
    mince: '<rect x="12" y="46" width="76" height="40" rx="5" fill="#F4F1EA"/><path d="M12 46h76" stroke="#DAD3C3" stroke-width="3"/><path d="M20 62c4-10 16-12 26-8 8-6 22-4 30 4 4 8-4 16-14 16H34c-10 0-18-4-14-12Z" fill="#B4443A"/><circle cx="38" cy="62" r="3" fill="#D97A70"/><circle cx="58" cy="66" r="3" fill="#D97A70"/>',
    mushrooms: '<path d="M16 54c0-22 16-34 34-34s34 12 34 34c0 4-4 6-8 6H24c-4 0-8-2-8-6Z" fill="#B58A63"/><path d="M38 60h24v22a8 8 0 0 1-8 8h-8a8 8 0 0 1-8-8Z" fill="#EFE3CF"/><circle cx="36" cy="42" r="4" fill="#D2AE88"/><circle cx="58" cy="36" r="5" fill="#D2AE88"/><circle cx="70" cy="48" r="3" fill="#D2AE88"/>',
    butter: '<path d="M12 48 64 30l24 12-52 20Z" fill="#F6E27A"/><path d="M12 48v26l24 14V62Z" fill="#E9CC52"/><path d="M36 62v26l52-20V42Z" fill="#DDBE45"/>',
  };
  ART.spaghetti = ART.pasta; ART['lasagne-sheets'] = ART.pasta; ART['risotto-rice'] = ART.rice;
  // x, y, size (% of the basket width), rotation. Centre first, then outwards.
  const SLOTS = [[50,58,30,-4],[30,64,28,6],[70,62,28,-8],[41,44,27,3],[62,42,27,-5],[22,50,24,-10],[80,48,24,9],[50,30,26,5],[33,78,26,-6],[67,79,26,7],[16,68,22,12],[86,70,22,-12],[28,30,22,-7],[74,28,22,8],[50,84,24,2],[50,50,28,-2],[14,42,20,10],[88,40,20,-9]];

  const itemsEl = $('#items'), rcptEl = $('#rcpt'), moreEl = $('#more'), listEl = $('#poster-list'), emptyEl = $('#poster-empty');
  const slotKeys = new Array(SLOTS.length).fill(null), nodes = new Map(), photos = {};
  let zc = 1;
  { const d = new Date(); $('#poster-date').textContent = `${d.toLocaleString('en', { month: 'long' })} | week ${Math.ceil(d.getDate() / 7)} | list`; }

  const tagArt = (label) => {
    const t = label.length > 14 ? label.slice(0, 13) + '…' : label;
    return `<svg viewBox="0 0 100 100" aria-hidden="true" focusable="false"><g transform="rotate(-6 50 50)"><rect x="10" y="30" width="80" height="40" rx="6" fill="#FAF6EA" stroke="#7F9570"/><circle cx="21" cy="40" r="3" fill="#D9DDB0" stroke="#7F9570"/><text x="52" y="56" text-anchor="middle" font-family="Sour Gummy, sans-serif" font-weight="600" font-size="${t.length > 8 ? 9 : 11.5}" fill="#3A4A33">${esc(t)}</text></g></svg>`;
  };
  const artFor = (c, raw) => c && ART[c.id]
    ? `<svg viewBox="0 0 100 100" aria-hidden="true" focusable="false">${ART[c.id]}</svg>`
    : tagArt(c ? c.short : raw);

  function swapPhoto(id) { $$(`.it[data-id="${id}"] .art`).forEach((a) => { a.innerHTML = `<img src="${photos[id]}" alt="">`; }); }
  function tryPhoto(id) {
    if (photos[id] === false || photos[id] === 'wait') return;
    if (photos[id]) { swapPhoto(id); return; }
    photos[id] = 'wait';
    const im = new Image();
    im.onload = () => { photos[id] = im.src; swapPhoto(id); };
    im.onerror = () => { photos[id] = false; };
    im.src = `images/${{ spaghetti: 'pasta', 'lasagne-sheets': 'pasta', 'risotto-rice': 'rice' }[id] || id}.png`;
  }

  function updateCollage(rows) {
    const agg = new Map();
    rows.forEach((r) => {
      const key = r.item ? r.item.id : 'raw:' + norm(r.raw);
      const e = agg.get(key) || { key, item: r.item, raw: r.raw, qty: 0 };
      e.qty += r.qty; agg.set(key, e);
    });
    slotKeys.forEach((k, i) => {
      if (k && !agg.has(k)) { slotKeys[i] = null; nodes.get(k)?.remove(); nodes.delete(k); }
    });
    let over = 0;
    agg.forEach((e) => {
      let i = slotKeys.indexOf(e.key);
      if (i < 0) { i = slotKeys.indexOf(null); if (i < 0) { over += 1; return; } slotKeys[i] = e.key; }
      let el = nodes.get(e.key);
      if (!el) {
        el = document.createElement('div');
        el.className = 'it'; el.style.zIndex = zc++;
        if (e.item) el.dataset.id = e.item.id;
        el.innerHTML = `<span class="art">${artFor(e.item, e.raw)}</span><span class="qty" hidden></span>`;
        const [x, y, s, r] = SLOTS[i];
        el.style.setProperty('--x', x + '%'); el.style.setProperty('--y', y + '%');
        el.style.setProperty('--s', s + '%'); el.style.setProperty('--r', r + 'deg');
        itemsEl.appendChild(el); nodes.set(e.key, el);
        if (e.item && ART[e.item.id]) tryPhoto(e.item.id);
      }
      const q = $('.qty', el); q.hidden = e.qty < 2; q.textContent = '×' + e.qty;
    });
    const list_ = [...agg.values()];
    const name = (e) => (e.item ? e.item.short : e.raw);
    listEl.textContent = list_.map((e) => (e.qty > 1 ? `${e.qty} × ` : '') + name(e)).join(' · ');
    emptyEl.hidden = list_.length > 0;
    moreEl.hidden = over === 0; moreEl.textContent = `+${over} more`;
    if (!list_.length) { rcptEl.hidden = true; return; }
    const lines = list_.slice(0, 4).map((e) => `<span class="l"><span>${esc(name(e).toLowerCase())}</span><span>${e.qty}</span></span>`).join('');
    rcptEl.innerHTML = `<b>Receipt</b>${lines}<em>${rows.length} ${rows.length === 1 ? 'item' : 'items'}</em><span class="code">${barcode('rcpt' + rows.length, 30)}</span>`;
    rcptEl.hidden = false;
  }

  /* ---------- 5. WIRING ---------- */
  const form = $('#finder'), list = $('#list-text'), place = $('#place'), results = $('#results');
  const go = $('#go'), goText = $('#go-text'), err = $('#form-error'), count = $('#count'), near = $('#near');
  const basketCount = $('#basket-count'), shelf = $('#shelf');
  const reachVal = () => +($('input[name="reach"]:checked')?.value || 4);

  const store = {
    get(k) { try { return localStorage.getItem(k); } catch { return null; } },
    set(k, v) { try { localStorage.setItem(k, v); } catch { /* private mode */ } },
  };

  // category + two photo-like tones per shelf card
  const LOOK = {
    milk: ['Dairy', '#e6e0cf', '#7e93a3'], eggs: ['Dairy', '#f1dfb8', '#b7894a'], bread: ['Bakery', '#e8cf9c', '#9a6a36'],
    'olive-oil': ['Pantry', '#e3d57a', '#5f7a2e'], tomatoes: ['Fresh', '#f0836b', '#a8321f'], pasta: ['Pantry', '#f0d28a', '#c08a2e'],
    rice: ['Pantry', '#efe8d6', '#a39a82'], bananas: ['Fruit', '#f3dd6a', '#a8872a'], chicken: ['Butcher', '#f0b9a0', '#b0644a'],
    cheese: ['Dairy', '#f2d77a', '#c0922b'], potatoes: ['Fresh', '#dcc18f', '#8b6a3c'], onions: ['Fresh', '#e7b6c2', '#9a5470'],
    apples: ['Fruit', '#e8a07a', '#9b2f2a'], water: ['Drinks', '#cfe3ea', '#4f7e93'], coffee: ['Pantry', '#c9a27c', '#4e3326'],
    tuna: ['Tinned', '#b9cbd3', '#3f6578'],
  };

  shelf.innerHTML = QUICK.map((id, i) => {
    const c = byId[id], cat = LOOK[id][0], [a, b] = PAIRS[i % PAIRS.length];
    return `<article class="card" data-id="${id}" style="--a:${a};--b:${b}">
      <span class="card-bg" aria-hidden="true"></span>
      <img class="card-img" src="images/${id}.png" alt="" onerror="this.remove()">
      <p class="card-meta">${cat}<span class="cnt"> · ${String(i + 1).padStart(2, '0')} / ${QUICK.length}</span></p>
      <div class="card-ctrl">
        <button type="button" class="q-minus" aria-label="Remove one ${c.short}" hidden>−</button>
        <button type="button" class="q-btn" aria-label="Add ${c.short}"><span class="q-n">0</span></button>
      </div>
      <h4 class="card-name">${c.short}</h4>
      <p class="card-sub">${c.detail}</p>
    </article>`;
  }).join('');

  const qtyOf = (id) => parse(list.value).filter((r) => r.item?.id === id).reduce((s, r) => s + r.qty, 0);
  function setQty(id, n) {
    const parts = splitList(list.value).filter((p) => matchItem(p).item?.id !== id);
    if (n > 0) parts.push((n > 1 ? n + ' ' : '') + byId[id].add);
    list.value = parts.join('\n');
    syncList();
  }

  const PHOTO_ALIAS = { spaghetti: 'pasta', 'lasagne-sheets': 'pasta', 'risotto-rice': 'rice' };
  const HAS_PHOTO = new Set([...QUICK, ...Object.keys(PHOTO_ALIAS)]);
  const recogEl = $('#recog');
  // A product with a picture gets it; anything else stays plain text, exactly as typed.
  const thumb = (item) => item && HAS_PHOTO.has(item.id)
    ? `<span class="thumb" aria-hidden="true"><img src="images/${PHOTO_ALIAS[item.id] || item.id}.png" alt="" onerror="this.closest('.chip').classList.add('chip--txt');this.parentNode.remove()"></span>` : '';
  function drawChips(typed) {
    recogEl.innerHTML = typed.map((r, i) => {
      const th = thumb(r.item);
      return `<span class="chip${th ? '' : ' chip--txt'}">${th}<span class="chip-t">${esc(th ? r.item.short : r.raw)}</span>${r.qty > 1 ? `<b class="chip-q">×${r.qty}</b>` : ''}<button type="button" class="chip-x" data-i="${i}" aria-label="Remove ${esc(r.raw)}">×</button></span>`;
    }).join('');
  }
  recogEl.addEventListener('click', (e) => {
    const b = e.target.closest('.chip-x'); if (!b) return;
    const parts = splitList(list.value); parts.splice(+b.dataset.i, 1);
    list.value = parts.join('\n'); syncList();
  });

  function syncList() {
    const typed = parse(list.value);
    const n = typed.length;
    count.textContent = n === 1 ? '1 item' : `${n} items`;
    const rows = allRows(list.value);
    basketCount.textContent = rows.length;
    const qty = {};
    typed.forEach((r) => { if (r.item) qty[r.item.id] = (qty[r.item.id] || 0) + r.qty; });
    $$('.card', shelf).forEach((card) => {
      const q = qty[card.dataset.id] || 0, name = byId[card.dataset.id].short;
      $('.q-n', card).textContent = q;
      $('.q-minus', card).hidden = q === 0;
      $('.q-btn', card).setAttribute('aria-label', `Add ${name}, ${q} in your list`);
      card.classList.toggle('on', q > 0);
    });
    drawChips(typed);
    updateCollage(rows);
    store.set('bg-list', list.value);
    checkStale(rows);
  }

  // A comparison is only valid for the basket it was made from. If the basket changes, say so.
  let lastSig = null;
  const basketSig = (rows) => rows.map((r) => (r.item ? r.item.id : r.raw) + ':' + r.qty).sort().join('|');
  function checkStale(rows) {
    const out = document.querySelector('#results .out');
    if (!out || lastSig === null) return;
    const stale = basketSig(rows) !== lastSig;
    out.classList.toggle('is-stale', stale);
    let msg = out.querySelector('.stale');
    if (stale && !msg) {
      msg = document.createElement('p');
      msg.className = 'note stale'; msg.setAttribute('role', 'status');
      msg.innerHTML = '<strong>Your basket has changed.</strong> These totals are for your earlier basket. Press “Find the cheapest shop” to update them.';
      out.prepend(msg);
    } else if (!stale && msg) msg.remove();
  }

  list.addEventListener('input', syncList);
  shelf.addEventListener('click', (e) => {
    const card = e.target.closest('.card'); if (!card) return;
    const id = card.dataset.id;
    if (e.target.closest('.q-btn')) setQty(id, qtyOf(id) + 1);
    else if (e.target.closest('.q-minus')) setQty(id, Math.max(0, qtyOf(id) - 1));
  });
  $('#sample').addEventListener('click', () => { list.value = 'whole milk 1L\neggs x12\nsliced bread\nolive oil 1L\ntomatoes 1kg\npasta'; syncList(); });
  $('#clear').addEventListener('click', () => { list.value = ''; syncList(); list.focus(); });

  /* ---------- PLAN MEALS ---------- */
  const mealsEl = $('#meals'), myplanEl = $('#myplan'), myplanList = $('#myplan-list'), planNote = $('#plan-note');
  const dlg = $('#meal-dlg');
  let filter = 'all', cur = null;

  const mealTone = (el, m) => { el.style.setProperty('--a', m.a); el.style.setProperty('--b', m.b); };
  const photoLayer = (m) => `<span class="mphoto" data-meal="${m.id}"><span class="plate" aria-hidden="true"></span></span>`;
  function loadMealPhoto(m, layer) {
    const im = new Image();
    im.alt = '';
    im.onload = () => { layer.classList.add('has-img'); layer.appendChild(im); };
    im.src = `images/meals/${m.id}.jpg`;
  }

  function drawMeals() {
    const shown = MEALS.filter((m) => filter === 'all' || (filter === 'veg' && m.veg) || (filter === 'quick' && m.mins <= 30));
    mealsEl.innerHTML = shown.map((m) => `<article class="card meal${plan[m.id] ? ' on' : ''}" data-id="${m.id}" style="--a:${m.a};--b:${m.b}">
      <span class="card-bg" aria-hidden="true"></span>${photoLayer(m)}
      <p class="card-meta">${m.time}${m.veg ? ' · Veg' : ''}</p>
      ${plan[m.id] ? '<span class="meal-badge">In basket ✓</span>' : ''}
      <h4 class="card-name">${m.name}</h4>
      <p class="card-sub">${plan[m.id] ? `${plan[m.id].servings} servings` : 'Serves 4'}</p>
      <span class="meal-add">${plan[m.id] ? 'Edit meal' : 'See what to buy'}</span>
      <button type="button" class="meal-open" aria-label="${m.name}: ${plan[m.id] ? 'edit in your basket' : 'see ingredients and add to basket'}"></button>
    </article>`).join('');
    $$('.mphoto', mealsEl).forEach((l) => loadMealPhoto(mealById[l.dataset.meal], l));
  }

  const amtText = (item, amount) => {
    if (item.unit === 'g') return amount >= 1000 ? `${+(amount / 1000).toFixed(2)} kg` : `${Math.round(amount / 5) * 5 || 5} g`;
    if (item.unit === 'ml') return amount >= 1000 ? `${+(amount / 1000).toFixed(2)} L` : `${Math.round(amount / 5) * 5 || 5} ml`;
    if (item.unit === 'clove') { const n = Math.ceil(amount); return `${n} ${n === 1 ? 'clove' : 'cloves'}`; }
    return `${Math.ceil(amount)}`;
  };
  const buyText = (item, amount) => `Buy ${packsFor(item, amount)} × ${item.detail}`;

  function drawDialog() {
    const m = mealById[cur.id], sv = cur.servings;
    const buy = m.ing.filter((i) => !i[2]), pantry = m.ing.filter((i) => i[2]);
    const scale = sv / BASE_SERVES;
    $('#s-val').textContent = sv;
    $('#ings-buy').innerHTML = buy.map(([id, a]) => { const it = byId[id], amt = a * scale; return `<li><span class="in-name">${it.short}<small>${buyText(it, amt)}</small></span><span class="in-amt">${amtText(it, amt)}</span></li>`; }).join('');
    $('#pantry-h').hidden = $('#ings-pantry').hidden = pantry.length === 0;
    $('#ings-pantry').innerHTML = pantry.map(([id, a]) => { const it = byId[id], amt = a * scale; return `<li><label><input type="checkbox" data-id="${id}"${cur.pantry.includes(id) ? ' checked' : ''}><span class="in-name">${it.short}<small>${buyText(it, amt)}</small></span></label><span class="in-amt">${amtText(it, amt)}</span></li>`; }).join('');
    const total = mealNeeds(m, sv, cur.pantry).reduce((s, n) => s + byId[n.item.id].price * packsFor(n.item, n.amount), 0);
    $('#dlg-total').textContent = fmt(total);
  }

  function openMeal(id) {
    const m = mealById[id], p = plan[id];
    cur = { id, servings: p ? p.servings : BASE_SERVES, pantry: p ? [...p.pantry] : [] };
    $('#dlg-title').textContent = m.name;
    $('#dlg-blurb').textContent = m.blurb;
    $('#dlg-meta').textContent = `${m.time}${m.veg ? ' · Vegetarian' : ''}`;
    const ph = $('#dlg-photo');
    mealTone(ph, m); ph.className = 'dlg-photo mphoto'; ph.style.background = `radial-gradient(60% 80% at 25% 30%, ${m.a}, transparent 75%), ${m.b}`;
    ph.innerHTML = '<span class="plate" aria-hidden="true"></span>';
    loadMealPhoto(m, ph);
    $('#dlg-add').textContent = p ? 'Update basket' : 'Add to basket';
    $('#dlg-remove').hidden = !p;
    drawDialog();
    dlg.showModal();
  }

  function savePlan() { store.set('bg-plan', JSON.stringify(plan)); }
  function planChanged(msg) {
    savePlan(); drawMeals(); drawPlanPanel(); syncList();
    if (msg) planNote.textContent = msg;
  }

  function drawPlanPanel() {
    const ids = Object.keys(plan);
    myplanEl.hidden = ids.length === 0;
    myplanList.innerHTML = ids.map((id) => `<li><span><b>${mealById[id].name}</b><small>${plan[id].servings} servings</small></span><span><button type="button" class="link-btn" data-edit="${id}">Edit</button><button type="button" class="link-btn" data-del="${id}">Remove</button></span></li>`).join('');
  }

  mealsEl.addEventListener('click', (e) => { const c = e.target.closest('.meal'); if (c && e.target.closest('.meal-open')) openMeal(c.dataset.id); });
  myplanList.addEventListener('click', (e) => {
    const ed = e.target.closest('[data-edit]'), del = e.target.closest('[data-del]');
    if (ed) openMeal(ed.dataset.edit);
    if (del) { const n = mealById[del.dataset.del].name; delete plan[del.dataset.del]; planChanged(`${n} removed from your basket.`); }
  });
  $$('.fchip').forEach((b) => b.addEventListener('click', () => {
    filter = b.dataset.f;
    $$('.fchip').forEach((x) => x.setAttribute('aria-pressed', String(x === b)));
    drawMeals();
  }));
  $('#s-minus').addEventListener('click', () => { cur.servings = Math.max(1, cur.servings - 1); drawDialog(); });
  $('#s-plus').addEventListener('click', () => { cur.servings = Math.min(12, cur.servings + 1); drawDialog(); });
  $('#ings-pantry').addEventListener('change', (e) => {
    const id = e.target.dataset.id; if (!id) return;
    cur.pantry = e.target.checked ? [...new Set([...cur.pantry, id])] : cur.pantry.filter((x) => x !== id);
    drawDialog();
  });
  $('#dlg-add').addEventListener('click', () => {
    const name = mealById[cur.id].name, had = !!plan[cur.id];
    plan[cur.id] = { servings: cur.servings, pantry: cur.pantry };
    dlg.close(); planChanged(`${name} ${had ? 'updated in' : 'added to'} your basket.`);
    $(`.meal[data-id="${cur.id}"] .meal-open`, mealsEl)?.focus();
  });
  $('#dlg-remove').addEventListener('click', () => { const name = mealById[cur.id].name; delete plan[cur.id]; dlg.close(); planChanged(`${name} removed from your basket.`); });
  $('#dlg-x').addEventListener('click', () => dlg.close());
  dlg.addEventListener('click', (e) => { if (e.target === dlg) dlg.close(); });

  /* ---------- LOCATION + SEARCH ---------- */
  place.addEventListener('input', () => { state.coords = null; store.set('bg-place', place.value); });

  near.addEventListener('click', () => {
    err.textContent = '';
    if (!('geolocation' in navigator)) { err.textContent = 'Your browser can’t share its location. Type a town or postcode instead.'; return; }
    near.classList.add('busy'); near.disabled = true;
    navigator.geolocation.getCurrentPosition(async (pos) => {
      const { latitude: lat, longitude: lon } = pos.coords;
      const label = await reverse(lat, lon);
      state.coords = { lat, lon }; state.label = label;
      place.value = label === 'your location' ? 'Near me' : `Near me · ${label}`;
      near.classList.remove('busy'); near.disabled = false;
    }, (e) => {
      near.classList.remove('busy'); near.disabled = false;
      err.textContent = e.code === 1 ? 'Location is blocked. Allow it in your browser, or type a town or postcode.' : 'We couldn’t get your location. Type a town or postcode instead.';
    }, { enableHighAccuracy: false, timeout: 12000, maximumAge: 300000 });
  });

  const steps = ['Checking where you are…', 'Finding supermarkets nearby…', 'Pricing your basket…'];
  const loading = (i) => `<div class="loading"><p>${steps[i]}</p><div class="loadbar" aria-hidden="true"><i style="width:${(i + 1) * 33}%"></i></div></div>`;

  async function search() {
    err.textContent = '';
    const rows = allRows(list.value);
    if (!rows.length) { err.textContent = 'Your basket is empty. Add a meal or some items first.'; return; }
    if (!place.value.trim() && !state.coords) { err.textContent = 'Tell us where you are: a town, a postcode, or “Use my location”.'; place.focus(); return; }

    go.disabled = true; goText.textContent = 'Comparing…';
    results.setAttribute('aria-busy', 'true');
    results.innerHTML = loading(0);

    try {
      let coords = state.coords, label = state.label, offline = false;
      if (!coords) {
        let g = null;
        try { g = await geocode(place.value); } catch { offline = true; }
        if (!offline && !g) throw Object.assign(new Error('nogeo'), { code: 'nogeo' });
        if (g) { coords = { lat: g.lat, lon: g.lon }; label = g.label; }
        else label = place.value.trim();
      }
      results.innerHTML = loading(1);

      const km_ = reachVal();
      let stores = [], note = '', failed = offline;
      if (coords) {
        try {
          stores = await findStores(coords.lat, coords.lon, km_);
          if (stores.length < 3 && km_ < 10) {
            const wider = await findStores(coords.lat, coords.lon, 10);
            if (wider.length > stores.length) { stores = wider; note = `Few shops within ${km_} km, so we looked up to 10 km.`; }
          }
        } catch { failed = true; }
      }

      if (!stores.length) {
        stores = FALLBACK.map((id) => ({ chain: chainById[id], name: chainById[id].name, dist: null, addr: '', lat: null, lon: null }));
        note = failed ? `We couldn’t look up the shops near ${esc(label || 'you')} just now (the map service didn’t answer), so this is a general comparison of typical prices at the main chains, not the shops around you. Try again in a moment to see real nearby shops.` : `We couldn’t find those chains near ${esc(label || 'you')}, so this is a general comparison of typical prices at the main chains.`;
      }
      results.innerHTML = loading(2);
      await new Promise((r) => setTimeout(r, reduceMotion ? 0 : 400));

      results.innerHTML = render({ rows, stores, label, note });
      lastSig = basketSig(rows);
      store.set('bg-place', place.value);
      results.focus({ preventScroll: true });
      results.scrollIntoView({ behavior: reduceMotion ? 'auto' : 'smooth', block: 'start' });
    } catch (e) {
      results.innerHTML = '<div class="empty"><p>Your receipt will appear here.</p></div>';
      err.textContent = e.code === 'nogeo'
        ? 'We couldn’t find that place. Try a postcode like 28013, or a town name.'
        : 'Something went wrong while looking up your area. Check your connection and try again.';
    } finally {
      go.disabled = false; goText.textContent = 'Find the cheapest shop';
      results.setAttribute('aria-busy', 'false');
    }
  }
  form.addEventListener('submit', (e) => { e.preventDefault(); search(); });

  /* ---------- STARTUP ---------- */
  const savedList = store.get('bg-list'), savedPlace = store.get('bg-place'), savedPlan = store.get('bg-plan');
  if (savedList) list.value = savedList;
  if (savedPlace && !savedPlace.startsWith('Near me')) place.value = savedPlace;
  try { const p = JSON.parse(savedPlan || '{}'); Object.entries(p).forEach(([id, v]) => { if (mealById[id] && v && v.servings) plan[id] = { servings: Math.min(12, Math.max(1, +v.servings | 0)), pantry: Array.isArray(v.pantry) ? v.pantry.filter((x) => byId[x]) : [] }; }); } catch { plan = {}; }
  drawMeals(); drawPlanPanel(); syncList();

  $$('[data-barcode]').forEach((el) => { el.innerHTML = barcode(el.dataset.barcode, 52); el.classList.add('code'); });

  // highlight the step you are on
  const links = $$('.rail ol a');
  const sections = ['list', 'plan', 'where', 'checkout'].map((id) => document.getElementById(id));
  const setCurrent = (id) => links.forEach((a) => a.setAttribute('aria-current', a.dataset.step === id ? 'true' : 'false'));
  setCurrent('list');
  if ('IntersectionObserver' in window) {
    const vis = new Map();
    const io = new IntersectionObserver((es) => {
      es.forEach((e) => vis.set(e.target.id, e.intersectionRatio));
      const best = [...vis.entries()].sort((a, b) => b[1] - a[1])[0];
      if (best && best[1] > 0) setCurrent(best[0]);
    }, { threshold: [0, .15, .3, .5, .75, 1] });
    sections.forEach((s) => s && io.observe(s));
  }
})();
