-- CONTRATO ADITIVO — revise contra o schema existente antes de executar no Supabase.
-- O servidor usa estas colunas e chaves para as sete tabelas informadas.
create table if not exists public.player_profiles (
 id uuid primary key references auth.users(id) on delete cascade, display_name text not null default 'Slime', selected_class text not null default 'normal', level integer not null default 1, experience integer not null default 0, coins integer not null default 0, crystals integer not null default 0, last_seen_at timestamptz
);
create table if not exists public.unlocked_classes (player_id uuid not null references auth.users(id) on delete cascade,class_key text not null,primary key(player_id,class_key));
create table if not exists public.player_inventory (player_id uuid not null references auth.users(id) on delete cascade,item_key text not null,quantity integer not null default 0,primary key(player_id,item_key));
create table if not exists public.player_upgrades (player_id uuid not null references auth.users(id) on delete cascade,upgrade_key text not null,level integer not null default 0,primary key(player_id,upgrade_key));
create table if not exists public.player_achievements (player_id uuid not null references auth.users(id) on delete cascade,achievement_key text not null,unlocked_at timestamptz,primary key(player_id,achievement_key));
create table if not exists public.quest_progress (player_id uuid not null references auth.users(id) on delete cascade,quest_key text not null,progress integer not null default 0,completed_at timestamptz,primary key(player_id,quest_key));
create table if not exists public.player_stats (player_id uuid primary key references auth.users(id) on delete cascade,highest_wave integer not null default 1);

alter table public.player_profiles enable row level security;
alter table public.unlocked_classes enable row level security;
alter table public.player_inventory enable row level security;
alter table public.player_upgrades enable row level security;
alter table public.player_achievements enable row level security;
alter table public.quest_progress enable row level security;
alter table public.player_stats enable row level security;
create policy "players read own profile" on public.player_profiles for select using (auth.uid()=id);
create policy "players read own classes" on public.unlocked_classes for select using (auth.uid()=player_id);
create policy "players read own inventory" on public.player_inventory for select using (auth.uid()=player_id);
create policy "players read own upgrades" on public.player_upgrades for select using (auth.uid()=player_id);
create policy "players read own achievements" on public.player_achievements for select using (auth.uid()=player_id);
create policy "players read own quests" on public.quest_progress for select using (auth.uid()=player_id);
create policy "players read own stats" on public.player_stats for select using (auth.uid()=player_id);
