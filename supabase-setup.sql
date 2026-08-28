-- À exécuter une seule fois dans Supabase :
-- Tableau de bord de votre projet → SQL Editor → New query → coller ceci → Run

create table if not exists carts (
  user_id uuid references auth.users(id) on delete cascade primary key,
  items jsonb not null default '[]',
  updated_at timestamp with time zone default now()
);

-- Active la sécurité par ligne : chaque personne ne peut voir/modifier
-- que SON propre panier, jamais celui d'une autre.
alter table carts enable row level security;

create policy "Chacun gère uniquement son propre panier"
on carts for all
using (auth.uid() = user_id)
with check (auth.uid() = user_id);
