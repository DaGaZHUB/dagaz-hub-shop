# DAGAZ HUB // SHOP — Passage en version réelle

Ce projet contient maintenant un vrai système de comptes (Supabase) et un
vrai système de paiement (Stripe). Contrairement à la version précédente,
**ces deux services nécessitent que vous créiez vous-même un compte** —
personne d'autre ne peut le faire à votre place, car ils sont liés à votre
identité (et, pour Stripe, à votre compte bancaire pour être payé).

Les deux offrent un plan gratuit largement suffisant pour démarrer.

---

## Étape 1 — Créer le projet Supabase (comptes + panier)

1. Allez sur https://supabase.com et créez un compte gratuit.
2. Cliquez sur **New project**, donnez-lui un nom (ex. `dagaz-hub`) et un
   mot de passe de base de données (gardez-le de côté, vous n'en aurez
   normalement plus besoin).
3. Une fois le projet créé, allez dans **SQL Editor** (menu de gauche) →
   **New query**, collez le contenu du fichier `supabase-setup.sql` fourni
   ici, puis cliquez sur **Run**. Cela crée la table qui stockera les
   paniers.
4. Allez dans **Project Settings → API**. Copiez :
   - **Project URL**
   - **anon public key**
5. Ouvrez `index.html`, cherchez ces deux lignes (vers le milieu du fichier) :
   ```js
   const SUPABASE_URL = 'https://VOTRE-PROJET.supabase.co';
   const SUPABASE_ANON_KEY = 'VOTRE_CLE_ANON_PUBLIC';
   ```
   et remplacez-les par vos vraies valeurs.

**Confirmation par e-mail :** par défaut, Supabase envoie un e-mail de
confirmation à chaque inscription. Vous pouvez désactiver ça pour les tests
dans **Authentication → Providers → Email → Confirm email** (à décocher),
ou le laisser activé pour une vraie mise en production.

---

## Étape 2 — Créer le compte Stripe (paiement réel)

1. Allez sur https://stripe.com et créez un compte.
2. Pour commencer, restez en **mode Test** (interrupteur en haut du
   tableau de bord Stripe) : vous pouvez tester tout le circuit avec de
   fausses cartes, sans vrai argent. La carte de test la plus utilisée est
   `4242 4242 4242 4242`, n'importe quelle date future, n'importe quel CVV.
3. Allez dans **Developers → API keys**. Vous y trouverez :
   - **Publishable key** (commence par `pk_test_...`) — pas utilisée ici
     directement, mais bon à savoir.
   - **Secret key** (commence par `sk_test_...`) — **celle-ci est
     nécessaire**, gardez-la strictement privée.
4. Pour passer en argent réel plus tard : complétez les informations de
   votre entreprise/compte bancaire dans Stripe, activez le compte, puis
   basculez en mode **Live** et remplacez la clé `sk_test_...` par la clé
   `sk_live_...` équivalente (voir étape 4 ci-dessous).

---

## Étape 3 — Déployer sur Netlify avec les fonctions serveur

⚠️ Contrairement à la première version, ce projet contient une fonction
serveur (`netlify/functions/create-checkout-session.js`) qui a besoin
d'installer une dépendance (`stripe`). Le simple glisser-déposer de fichier
ne suffit plus : il faut passer par un dépôt Git.

1. Créez un compte gratuit sur https://github.com si vous n'en avez pas.
2. Créez un nouveau dépôt (repository), par exemple nommé `dagaz-hub-shop`.
3. Sur la page du dépôt, utilisez **Add file → Upload files** et déposez-y
   TOUS les fichiers de ce dossier (`index.html`, `netlify.toml`,
   `package.json`, et le dossier `netlify/functions/` avec son fichier
   dedans). Validez (**Commit changes**).
4. Retournez sur votre tableau de bord Netlify → **Add new site → Import
   an existing project** → connectez GitHub → choisissez ce dépôt.
5. Laissez les réglages de build par défaut (Netlify détecte
   `netlify.toml`) et cliquez sur **Deploy**.
6. Toujours dans Netlify, allez dans **Site configuration → Environment
   variables** → **Add a variable** :
   - Clé : `STRIPE_SECRET_KEY`
   - Valeur : votre clé secrète Stripe (`sk_test_...` pour tester)
7. Redéployez le site (**Deploys → Trigger deploy → Deploy site**) pour que
   la nouvelle variable soit prise en compte.

---

## Étape 4 — Tester, puis passer en argent réel

1. Ouvrez votre site en ligne, créez un compte, ajoutez l'article de
   démonstration, lancez le paiement : vous serez redirigé vers une vraie
   page Stripe. Utilisez la carte de test `4242 4242 4242 4242`.
2. Une fois que tout fonctionne, activez votre compte Stripe (informations
   bancaires), basculez en mode **Live**, remplacez la variable
   `STRIPE_SECRET_KEY` dans Netlify par votre clé `sk_live_...`, puis
   redéployez. Les paiements sont alors réels.

---

## Ce qui reste à faire de votre côté

- Ajouter vos vrais produits (dans le tableau `PRODUCTS` du fichier
  `index.html`, avec une vraie logique d'affichage dans le catalogue —
  dites-moi quand vous en aurez et je peux construire cette partie).
- Décider si vous voulez des factures automatiques, de la TVA, un mode de
  livraison, etc. — tout cela peut se brancher sur Stripe progressivement.
- Vérifier les mentions légales obligatoires pour vendre en ligne en
  France/UE (CGV, droit de rétractation, etc.) — ce n'est pas quelque
  chose que ce fichier peut couvrir à votre place.
