-- À exécuter dans Supabase (SQL Editor), en plus de la table "carts" déjà créée.

create table if not exists delivered_keys (
  id bigint generated always as identity primary key,
  discord_id text not null,
  discord_username text,
  product_label text,
  code text not null,
  stripe_session_id text,
  created_at timestamp with time zone default now()
);

-- Cette table n'est écrite que par les fonctions serveur (avec la clé
-- service_role, qui contourne la sécurité par ligne) : on peut donc activer
-- la RLS sans définir de policy, personne côté navigateur ne peut la lire.
alter table delivered_keys enable row level security;
