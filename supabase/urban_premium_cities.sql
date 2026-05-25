-- יישובים זכאים לפרמיה אורבנית (חח"י) — נספח לאמת מידה 35מה
-- הרצה: Supabase SQL Editor או npm run db:apply:all

create table if not exists public.urban_premium_cities (
  id serial primary key,
  name_he text not null,
  sort_order int not null default 0,
  created_at timestamptz not null default now(),
  constraint urban_premium_cities_name_he_unique unique (name_he)
);

alter table public.urban_premium_cities enable row level security;

drop policy if exists "urban_premium_cities_select_anon" on public.urban_premium_cities;

create policy "urban_premium_cities_select_anon"
  on public.urban_premium_cities for select
  to anon, authenticated
  using (true);

-- עדכון רשימה: מחיקה והזרקה מחדש (idempotent לפי שמות)
delete from public.urban_premium_cities;

insert into public.urban_premium_cities (name_he, sort_order) values
  ('אום אל־פחם', 1),
  ('אופקים', 2),
  ('אור יהודה', 3),
  ('אילת', 4),
  ('אלעד', 5),
  ('אשדוד', 6),
  ('אשקלון', 7),
  ('באקה אל־גרבייה', 8),
  ('באר יעקב', 9),
  ('באר שבע', 10),
  ('בית שמש', 11),
  ('בני ברק', 12),
  ('בת ים', 13),
  ('גבעתיים', 14),
  ('דאליית אל־כרמל', 15),
  ('דימונה', 16),
  ('הוד השרון', 17),
  ('הרצליה', 18),
  ('חדרה', 19),
  ('חולון', 20),
  ('חיפה', 21),
  ('טבריה', 22),
  ('טייבה', 23),
  ('טירת כרמל', 24),
  ('טמרה', 25),
  ('יבנה', 26),
  ('יהוד–מונוסון', 27),
  ('ירושלים', 28),
  ('כפר יונה', 29),
  ('כפר סבא', 30),
  ('כרמיאל', 31),
  ('לוד', 32),
  ('מודיעין–מכבים–רעות', 33),
  ('נהריה', 34),
  ('נוף הגליל', 35),
  ('נס ציונה', 36),
  ('נצרת', 37),
  ('נשר', 38),
  ('נתיבות', 39),
  ('נתניה', 40),
  ('סח׳נין', 41),
  ('עכו', 42),
  ('עפולה', 43),
  ('ערערה — צפון', 44),
  ('פרדס־חנה–כרכור', 45),
  ('פתח תקווה', 46),
  ('צפת', 47),
  ('קריית אונו', 48),
  ('קריית אתא', 49),
  ('קריית ביאליק', 50),
  ('קריית גת', 51),
  ('קריית ים', 52),
  ('קריית מוצקין', 53),
  ('קריית מלאכי', 54),
  ('קריית שמונה', 55),
  ('ראש העין', 56),
  ('ראשון לציון', 57),
  ('רהט', 58),
  ('רחובות', 59),
  ('רכסים', 60),
  ('רמלה', 61),
  ('רמת גן', 62),
  ('רמת השרון', 63),
  ('רעננה', 64),
  ('שגב–שלום', 65),
  ('שדרות', 66),
  ('שפרעם', 67),
  ('תל־אביב–יפו', 68),
  ('תל אביב', 69),
  ('תל-אביב', 70)
on conflict (name_he) do update set sort_order = excluded.sort_order;
