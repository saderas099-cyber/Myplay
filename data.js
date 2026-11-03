// Весь баланс і контент гри.
export const CURRENCY = 'Жетони';           // валюта лобі/магазину скінів
export const GAME_CUR = '$';                 // валюта під час гри

export const DIFFS = {
  easy:      { id: 'easy',      name: 'Легко',     debt: 1400, days: 7, carFuel: 8,  priceMul: 1.15, shopMul: 0.85, lootMul: 1.25, monsterMul: 0.7,  monstersPerNight: 1, hp: 100, lives: 3, rareMul: 1.0, fuelItemChance: 1.3, reviveCost: 250,  genBurn: 0.35 },
  normal:    { id: 'normal',    name: 'Нормально', debt: 2200, days: 7, carFuel: 12, priceMul: 1.0,  shopMul: 1.0,  lootMul: 1.0,  monsterMul: 1.0,  monstersPerNight: 1, hp: 100, lives: 2, rareMul: 1.0, fuelItemChance: 1.0, reviveCost: 400,  genBurn: 0.5 },
  hard:      { id: 'hard',      name: 'Важко',     debt: 3400, days: 7, carFuel: 15, priceMul: 0.88, shopMul: 1.2,  lootMul: 0.8,  monsterMul: 1.25, monstersPerNight: 2, hp: 80,  lives: 1, rareMul: 0.85, fuelItemChance: 0.75, reviveCost: 650,  genBurn: 0.7 },
  nightmare: { id: 'nightmare', name: 'Кошмар',    debt: 5200, days: 7, carFuel: 18, priceMul: 0.78, shopMul: 1.4,  lootMul: 0.65, monsterMul: 1.55, monstersPerNight: 3, hp: 60,  lives: 1, rareMul: 0.7, fuelItemChance: 0.55, reviveCost: 950,  genBurn: 0.9 },
  hardcore:  { id: 'hardcore',  name: 'Хардкор',   debt: 4200, days: 7, carFuel: 15, priceMul: 0.85, shopMul: 1.3,  lootMul: 0.75, monsterMul: 1.4,  monstersPerNight: 2, hp: 70,  lives: 1, rareMul: 0.8, fuelItemChance: 0.7, reviveCost: 800, genBurn: 0.8, hardcore: true },
};
export const DIFF_KEYS = ['easy', 'normal', 'hard', 'nightmare', 'hardcore'];

export const RARITY = {
  common:   { name: 'Звичайний',  w: 60, color: '#b9bdb6' },
  uncommon: { name: 'Незвичайний', w: 28, color: '#6fbf73' },
  rare:     { name: 'Рідкісний',  w: 9,  color: '#5aa0e6' },
  epic:     { name: 'Епічний',    w: 3,  color: '#c07be0' },
};

// kind: junk | scrap | nature | paint | relic | tool | fuel | medkit | photo | chest
// v – базова ціна продажу ($), kg – вага, wt – вага ймовірності появи
export const ITEMS = {
  can:        { name: 'Консервна банка',        kind: 'junk',   v: 4,   kg: 0.3, wt: 55, r: 'common' },
  bottle:     { name: 'Пластикова пляшка',      kind: 'junk',   v: 3,   kg: 0.2, wt: 50, r: 'common' },
  tire:       { name: 'Стара шина',             kind: 'junk',   v: 22,  kg: 9,   wt: 14, r: 'common' },
  scrap:      { name: 'Металобрухт',            kind: 'scrap',  v: 12,  kg: 3,   wt: 48, r: 'common' },
  pipe:       { name: 'Мідна труба',            kind: 'scrap',  v: 26,  kg: 2.4, wt: 24, r: 'uncommon' },
  cable:      { name: 'Котушка кабелю',         kind: 'scrap',  v: 38,  kg: 4,   wt: 20, r: 'uncommon' },
  battery:    { name: 'Автоакумулятор',         kind: 'scrap',  v: 58,  kg: 11,  wt: 12, r: 'uncommon' },
  radiator:   { name: 'Радіатор',               kind: 'scrap',  v: 46,  kg: 7,   wt: 12, r: 'uncommon' },
  engine:     { name: 'Блок двигуна',           kind: 'scrap',  v: 135, kg: 24,  wt: 4,  r: 'rare' },
  porcini:    { name: 'Білий гриб',             kind: 'nature', v: 14,  kg: 0.2, wt: 34, r: 'common' },
  chanter:    { name: 'Лисички',                kind: 'nature', v: 9,   kg: 0.15,wt: 38, r: 'common' },
  amanita:    { name: 'Мухомор',                kind: 'nature', v: 4,   kg: 0.2, wt: 22, r: 'common' },
  blueberry:  { name: 'Лохина',                 kind: 'nature', v: 7,   kg: 0.1, wt: 36, r: 'common' },
  raspberry:  { name: 'Малина',                 kind: 'nature', v: 8,   kg: 0.1, wt: 30, r: 'common' },
  honey:      { name: 'Бджолиний мед',          kind: 'nature', v: 42,  kg: 1.2, wt: 6,  r: 'rare' },
  paintW:     { name: 'Відро білої фарби',      kind: 'paint',  v: 30,  kg: 5,   wt: 18, r: 'common' },
  paintR:     { name: 'Відро червоної фарби',   kind: 'paint',  v: 34,  kg: 5,   wt: 14, r: 'uncommon' },
  paintG:     { name: 'Відро зеленої фарби',    kind: 'paint',  v: 32,  kg: 5,   wt: 14, r: 'uncommon' },
  varnish:    { name: 'Каністра лаку',          kind: 'paint',  v: 24,  kg: 3.5, wt: 14, r: 'common' },
  clock:      { name: 'Старий годинник',        kind: 'relic',  v: 70,  kg: 1.5, wt: 9,  r: 'rare' },
  spoon:      { name: 'Срібна ложка',           kind: 'relic',  v: 95,  kg: 0.2, wt: 6,  r: 'rare' },
  brooch:     { name: 'Бабусина брошка',        kind: 'relic',  v: 165, kg: 0.1, wt: 3,  r: 'epic' },
  coin:       { name: 'Стара монета',           kind: 'relic',  v: 48,  kg: 0.05,wt: 10, r: 'rare' },
  icon:       { name: 'Ікона в окладі',         kind: 'relic',  v: 230, kg: 2,   wt: 2,  r: 'epic' },
  samovar:    { name: 'Самовар',                kind: 'relic',  v: 145, kg: 6,   wt: 4,  r: 'rare' },
  saw:        { name: 'Ручна пилка',            kind: 'tool',   v: 28,  kg: 1,   wt: 14, r: 'common' },
  hammer:     { name: 'Молоток',                kind: 'tool',   v: 18,  kg: 1.2, wt: 14, r: 'common' },
  axe:        { name: 'Сокира',                 kind: 'tool',   v: 52,  kg: 2.5, wt: 8,  r: 'uncommon' },
  gascan:     { name: 'Каністра бензину',       kind: 'fuel',   v: 0,   kg: 1,   wt: 0,  r: 'uncommon', fuel: true },
  medkit:     { name: 'Аптечка',                kind: 'medkit', v: 30,  kg: 0.8, wt: 8,  r: 'uncommon' },
  batteryAA:  { name: 'Батарейки (4 шт)',       kind: 'junk',   v: 10,  kg: 0.2, wt: 6,  r: 'uncommon', aa: true },
  chest:      { name: 'Скриня зі знахідкою',    kind: 'chest',  v: 0,   kg: 8,   wt: 0,  r: 'epic' },
  flare:      { name: 'Сигнальна ракета',       kind: 'tool',   v: 15,  kg: 0.3, wt: 0,  r: 'uncommon', flare: true },
  parcel:     { name: 'Посилка',                kind: 'tool',   v: 0,   kg: 2,   wt: 0,  r: 'common' },
  gen_fuel:   { name: 'Дизель для генератора',  kind: 'fuel',   v: 0,   kg: 4,   wt: 0,  r: 'uncommon', gen: true },
  gascan5:    { name: 'Каністра бензину 5 л',   kind: 'fuel',   v: 0,   kg: 4.5, wt: 0,  r: 'uncommon', fuel: true },
  repair:     { name: 'Ремкомплект',            kind: 'tool',   v: 0,   kg: 1.5, wt: 0,  r: 'uncommon', repair: true },
  photo:      { name: 'Фото',                   kind: 'photo',  v: 0,   kg: 0,   wt: 0,  r: 'common' },
};
export const PHOTO = {
  deer:     { name: 'Олень',   v: 22 }, fox:   { name: 'Лисиця', v: 26 }, hare:   { name: 'Заєць', v: 16 },
  hedgehog: { name: 'Їжак',    v: 18 }, owl:   { name: 'Сова',   v: 38 }, badger: { name: 'Борсук', v: 32 },
  raven:    { name: 'Ворон',   v: 12 }, boar:  { name: 'Кабан',  v: 30 },
};

// Усі налаштування шансу ресурсів зводяться сюди: скільки предметів і яке розмаїття на день.
export const LOOT_PER_DAY = 46;
export const DIG_SPOTS = 3;

export const NEWS = [
  'Ціни на мідь ростуть: кабелі та труби дорожчають.',
  'На ринку дефіцит грибів, збирачі відчувають попит.',
  'Колекціонери шукають старі речі: антикваріат у ціні.',
  'Автозапчастини дешевшають: на склади завезли імпорт.',
  'Фарба і лак дорожчають через ремонтний сезон.',
  'Ягідний сезон завершується, лохина та малина дорожчають.',
  'Металобрухт стабільний, нічого нового.',
  'Інструмент вигідно продавати: будівельний бум.',
];
export const KIND_LABEL = { junk: 'Дріб’язок', scrap: 'Метал', nature: 'Природа', paint: 'Фарби', relic: 'Антикваріат', tool: 'Інструмент', fuel: 'Паливо', medkit: 'Медицина', photo: 'Фото', chest: 'Скарб' };

// Магазин ноутбука. kind: 'item' – посилка наступного ранку; 'perm' – одноразова покупка; 'svc' – миттєва послуга
export const SHOP = [
  { id: 'gen_fuel', name: 'Паливо для генератора (5 л)', price: 55, kind: 'item', give: 'gen_fuel', desc: 'Дизель у каністрі. Заливається в генератор.' },
  { id: 'car_fuel', name: 'Бензин для машини (5 л)',     price: 140, kind: 'item', give: 'gascan5', desc: 'Каністра на 5 л. Заливається в бак пікапа.' },
  { id: 'aa',       name: 'Батарейки (4 шт)',            price: 30, kind: 'item', give: 'batteryAA', desc: 'Для ліхтаря на батарейках.' },
  { id: 'lamp',     name: 'Ліхтар на батарейках',        price: 60, kind: 'perm', desc: 'Світить без генератора, працює від батарейок.' },
  { id: 'lapbat',   name: 'Акумулятор для ноутбука',     price: 120, kind: 'perm', desc: 'Тримає ноутбук 4 хв після вимкнення генератора.' },
  { id: 'cover',    name: 'Накриття для генератора',     price: 180, kind: 'perm', desc: 'Під дощем генератор не ламається.' },
  { id: 'repair',   name: 'Ремкомплект генератора',      price: 45, kind: 'item', give: 'repair', desc: 'Лагодить зламаний генератор.' },
  { id: 'camera',   name: 'Фотоапарат',                  price: 90, kind: 'perm', desc: 'Фотографуйте тварин: фото продаються.' },
  { id: 'shovel',   name: 'Лопата',                      price: 150, kind: 'perm', desc: 'Розкопує хрестики на карті лісу.' },
  { id: 'bag',      name: 'Рюкзак (+2 слоти)',           price: 220, kind: 'perm', desc: 'Дві додаткові комірки інвентарю.' },
  { id: 'boots',    name: 'Кросівки',                    price: 140, kind: 'perm', desc: 'Більша витривалість.' },
  { id: 'medkit',   name: 'Аптечка',                     price: 75, kind: 'item', give: 'medkit', desc: 'Лікує або піднімає напарника.' },
  { id: 'flare',    name: 'Сигнальна ракета',            price: 40, kind: 'item', give: 'flare', desc: 'Відлякує деяких монстрів ненадовго.' },
  { id: 'revolver', name: 'Револьвер',                   price: 650, kind: 'perm', desc: '6 набоїв, середня шкода.' },
  { id: 'shotgun',  name: 'Дробовик',                    price: 900, kind: 'perm', desc: 'Потужний впритул, 2 набої в магазині.' },
  { id: 'deagle',   name: 'Desert Eagle',                price: 1400, kind: 'perm', desc: '7 набоїв, велика шкода.' },
  { id: 'ammo',     name: 'Коробка набоїв',              price: 60, kind: 'ammo', desc: '+12 набоїв до будь-якої зброї.' },
  { id: 'revive',   name: 'Повернути напарника',         price: 0, kind: 'svc', desc: 'Миттєво воскрешає загиблого гравця біля будинку.' },
];

// Налаштування лобі за замовчуванням
export const MODES = {
  survival: { name: 'Виживання', desc: 'Збирайте речі, віддайте борг, їдьте.' },
  action:   { name: 'Екшн',      desc: 'Монстри агресивніші, зброя дешевша, більше шкоди.' },
  monster:  { name: 'Ви — монстр', desc: 'Ви граєте за монстра й полюєте на гравців/ботів.', soloOnly: false },
  hardcore: { name: 'Хардкор',   desc: 'Одне життя, великий борг.' },
  endless:  { name: 'Нескінченний', desc: 'Борг росте щодня, скільки протримаєтесь.' },
};
export const MONSTER_WHO = { bot: 'Бот', host: 'Хост', random: 'Випадковий гравець' };
export const RARE_SPAWN = { low: 0.6, normal: 1, high: 1.6 };

// 12 монстрів
export const MONSTERS = {
  wolf:      { name: 'Вовк',          hp: 90,  speed: 6.4, dmg: 22, sight: 38, hear: 24, beh: 'stalk',    size: 1.0 },
  creaker:   { name: 'Скрипун',       hp: 160, speed: 5.2, dmg: 45, sight: 30, hear: 12, beh: 'freeze',   size: 1.9 },
  shade:     { name: 'Тінь',          hp: 70,  speed: 5.6, dmg: 28, sight: 26, hear: 16, beh: 'shade',    size: 1.7 },
  hound:     { name: 'Гончак',        hp: 80,  speed: 7.4, dmg: 18, sight: 22, hear: 46, beh: 'hound',    size: 0.9 },
  spider:    { name: 'Павук',         hp: 110, speed: 5.0, dmg: 26, sight: 28, hear: 14, beh: 'ambush',   size: 1.4 },
  bear:      { name: 'Ведмідь',       hp: 420, speed: 4.4, dmg: 55, sight: 24, hear: 22, beh: 'tank',     size: 1.6 },
  scarecrow: { name: 'Опудало',       hp: 140, speed: 5.8, dmg: 40, sight: 20, hear: 8,  beh: 'mimic',    size: 1.8 },
  collector: { name: 'Колектор',      hp: 260, speed: 3.6, dmg: 50, sight: 50, hear: 20, beh: 'collector', size: 1.8 },
  granny:    { name: 'Бабуся',        hp: 200, speed: 4.2, dmg: 35, sight: 18, hear: 24, beh: 'granny',   size: 1.6 },
  crows:     { name: 'Воронячий рій', hp: 60,  speed: 8.0, dmg: 8,  sight: 40, hear: 20, beh: 'crows',    size: 1.0 },
  swamp:     { name: 'Болотник',      hp: 180, speed: 3.8, dmg: 30, sight: 14, hear: 14, beh: 'swamp',    size: 1.8 },
  antlers:   { name: 'Рогатий',       hp: 240, speed: 5.9, dmg: 48, sight: 44, hear: 30, beh: 'antlers',  size: 2.6 },
};
export const MONSTER_KEYS = Object.keys(MONSTERS);

// Косметика (жетони). slot: top|bottom|shoes|hat|face
export const COSMETICS = {
  top: [
    { id: 'tee_gray',   name: 'Сіра футболка',      price: 0,   color: 0x6b6f6a },
    { id: 'hoodie_blk', name: 'Чорне худі',         price: 40,  color: 0x181818 },
    { id: 'flannel',    name: 'Фланелева сорочка',  price: 55,  color: 0x8a2f2a },
    { id: 'jacket_grn', name: 'Куртка мисливця',    price: 90,  color: 0x44562f },
    { id: 'raincoat',   name: 'Жовтий дощовик',     price: 120, color: 0xd8b61e },
    { id: 'suit',       name: 'Діловий піджак',     price: 160, color: 0x25282e },
  ],
  bottom: [
    { id: 'jeans',      name: 'Джинси',             price: 0,   color: 0x2d4b6b },
    { id: 'cargo',      name: 'Карго',              price: 45,  color: 0x5b5a3d },
    { id: 'black',      name: 'Чорні штани',        price: 40,  color: 0x16171a },
    { id: 'camo',       name: 'Камуфляж',           price: 110, color: 0x3e4a30 },
  ],
  shoes: [
    { id: 'sneak',      name: 'Кросівки',           price: 0,   color: 0xcfcfcf },
    { id: 'boots',      name: 'Чоботи',             price: 50,  color: 0x4a3322 },
    { id: 'rubber',     name: 'Гумаки',             price: 70,  color: 0x2f5f33 },
  ],
  hat: [
    { id: 'none',       name: 'Без головного убору', price: 0,  color: 0 },
    { id: 'cap_red',    name: 'Червона кепка',      price: 35,  color: 0xb3261e },
    { id: 'beanie',     name: 'В’язана шапка',      price: 45,  color: 0x2b3a5c },
    { id: 'hunter',     name: 'Мисливський капелюх', price: 85, color: 0x6a5a34 },
    { id: 'hood',       name: 'Каптур',             price: 60,  color: 0x202020 },
  ],
  face: [
    { id: 'none',       name: 'Нічого',             price: 0,   color: 0 },
    { id: 'glasses',    name: 'Окуляри',            price: 30,  color: 0x111111 },
    { id: 'mask',       name: 'Медична маска',      price: 25,  color: 0xe6eef0 },
    { id: 'scarf',      name: 'Шарф',               price: 55,  color: 0x7a2323 },
  ],
};
export const SKIN_TONES = [0xf3d2b8, 0xe2b48f, 0xc78c63, 0x9a6540, 0x6e4529, 0x45291a];
export const HAIR_COLORS = [0x15110d, 0x4a2f1c, 0x8a5a2b, 0xc99a4b, 0xa8321f, 0xb9b9b4, 0x2a3a66];
export const HAIR_STYLES = { m: ['Коротка', 'Зализана', 'Бокс', 'Лисий'], f: ['Хвіст', 'Каре', 'Довге', 'Пучок'] };

export const VEHICLES = [
  { id: 'pickup',  name: 'Пікап «Сіверко»',  price: 0,   desc: 'Основна машина.' },
  { id: 'pickup2', name: 'Пікап «Борей»',    price: 600, desc: 'Інший колір і смуги.', body: 0x2f5d3a, stripe: 0xe9e2c8 },
  { id: 'pickup3', name: 'Пікап «Урбан»',    price: 900, desc: 'Матовий сірий.', body: 0x585d5f, stripe: 0x111111 },
];
export const CAR_PAINTS = [
  { id: 'red',    name: 'Червоний',    price: 0,   color: 0xb3261e },
  { id: 'blue',   name: 'Синій',       price: 80,  color: 0x1f4f9a },
  { id: 'white',  name: 'Білий',       price: 80,  color: 0xe6e6e0 },
  { id: 'black',  name: 'Чорний',      price: 100, color: 0x141414 },
  { id: 'yellow', name: 'Жовтий',      price: 120, color: 0xd6aa1e },
  { id: 'rust',   name: 'Іржавий',     price: 150, color: 0x7a4a2a },
];
export const CAR_DECALS = [
  { id: 'none',   name: 'Без наклейок', price: 0 },
  { id: 'flame',  name: 'Полум’я',      price: 140 },
  { id: 'stripe', name: 'Дві смуги',    price: 90 },
  { id: 'skull',  name: 'Череп на капоті', price: 180 },
  { id: 'pine',   name: 'Сосни',        price: 110 },
];
export const MONSTER_SKINS = [
  { id: 'wolf_alpha',  monster: 'wolf',     name: 'Вовк: Сивий альфа',  price: 150 },
  { id: 'bear_albino', monster: 'bear',     name: 'Ведмідь: Альбінос',  price: 200 },
  { id: 'antl_gold',   monster: 'antlers',  name: 'Рогатий: Золоті роги', price: 320 },
  { id: 'shade_blue',  monster: 'shade',    name: 'Тінь: Холодна',      price: 180 },
  { id: 'col_red',     monster: 'collector', name: 'Колектор: Червоний костюм', price: 260 },
  { id: 'scare_pump',  monster: 'scarecrow', name: 'Опудало: Гарбузова голова', price: 220 },
];
export const TOOL_SKINS = [
  { id: 'shovel_gold', tool: 'shovel', name: 'Лопата: Золота',  price: 220 },
  { id: 'lamp_red',    tool: 'lamp',   name: 'Ліхтар: Червоний', price: 90 },
  { id: 'revolver_eng', tool: 'revolver', name: 'Револьвер: Гравіювання', price: 300 },
];
export const REWARD = { win: 120, perDay: 12, loss: 25 };
