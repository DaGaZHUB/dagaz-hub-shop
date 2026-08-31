-- À exécuter dans Supabase (SQL Editor) — ajoute les colonnes nécessaires
-- au système de validation des codes DAGAROV depuis Roblox.
-- Si vous avez déjà exécuté supabase-delivered-keys.sql avant, exécutez
-- seulement CE fichier-ci en plus (il ne recrée pas la table, il la complète).

alter table delivered_keys add column if not exists product_id text;
alter table delivered_keys add column if not exists redeemed boolean not null default false;
alter table delivered_keys add column if not exists redeemed_by_roblox_username text;
alter table delivered_keys add column if not exists redeemed_roblox_user_id text;
alter table delivered_keys add column if not exists redeemed_at timestamp with time zone;

-- Un code doit être unique (deux codes identiques ne doivent jamais exister).
create unique index if not exists delivered_keys_code_unique on delivered_keys (code);
