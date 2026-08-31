// Fonction serveur (Netlify Function) : crée une session de paiement Stripe.
//
// Sécurité :
// - Les prix ne sont JAMAIS lus depuis ce qu'envoie le navigateur : ils sont
//   fixés ici, dans PRODUCTS_SERVER. Le navigateur n'envoie que des identifiants
//   de produit (ex: "key-1h"), jamais un prix.
// - L'identité de l'acheteur (son compte Discord) est vérifiée ici via son
//   jeton de session Supabase, pas via ce que le navigateur prétend être.
//
// Variables d'environnement requises (à définir dans Netlify) :
//   STRIPE_SECRET_KEY          = sk_test_... (ou sk_live_...)
//   SUPABASE_URL                = https://xxxx.supabase.co
//   SUPABASE_SERVICE_ROLE_KEY   = (Supabase > Project Settings > API > service_role, secret)

const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);
const { createClient } = require('@supabase/supabase-js');

const PRODUCTS_SERVER = {
  'key-1h': { name: 'KEY 1H — Acces 1 heure', price: 3 },
  'key-1j': { name: 'KEY 1J — Acces 1 jour', price: 12 },
  'key-1m': { name: 'KEY 1 MOIS — Acces 1 mois', price: 45 },
};

exports.handler = async (event) => {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: JSON.stringify({ error: 'Methode non autorisee' }) };
  }

  try {
    const authHeader = event.headers.authorization || event.headers.Authorization || '';
    const token = authHeader.replace(/^Bearer\s+/i, '');
    if (!token) {
      return { statusCode: 401, body: JSON.stringify({ error: 'Connectez-vous avec Discord avant de payer.' }) };
    }

    const supabaseAdmin = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
    const { data: userData, error: userError } = await supabaseAdmin.auth.getUser(token);
    if (userError || !userData || !userData.user) {
      return { statusCode: 401, body: JSON.stringify({ error: 'Session invalide, reconnectez-vous.' }) };
    }
    const user = userData.user;

    // Récupère l'identifiant Discord de l'utilisateur, quel que soit
    // l'endroit où Supabase l'a range (ça peut varier selon la version).
    const meta = user.user_metadata || {};
    let discordId = meta.provider_id || meta.sub || null;
    if (!discordId && Array.isArray(user.identities)) {
      const discordIdentity = user.identities.find((i) => i.provider === 'discord');
      if (discordIdentity) discordId = discordIdentity.id;
    }
    if (!discordId) {
      return { statusCode: 400, body: JSON.stringify({ error: 'Impossible de retrouver votre identifiant Discord.' }) };
    }
    const discordUsername = meta.full_name || meta.name || meta.custom_claims && meta.custom_claims.global_name || 'Client';

    const { items } = JSON.parse(event.body || '{}');
    if (!Array.isArray(items) || items.length === 0) {
      return { statusCode: 400, body: JSON.stringify({ error: 'Le panier est vide.' }) };
    }

    // Construit les lignes Stripe à partir du catalogue serveur uniquement.
    const line_items = [];
    const purchasedIds = [];
    for (const item of items) {
      const product = PRODUCTS_SERVER[item.id];
      if (!product) continue;
      const qty = Math.max(1, Math.min(10, parseInt(item.qty, 10) || 1));
      line_items.push({
        price_data: {
          currency: 'eur',
          product_data: { name: product.name },
          unit_amount: Math.round(product.price * 100),
        },
        quantity: qty,
      });
      for (let i = 0; i < qty; i++) purchasedIds.push(item.id);
    }
    if (line_items.length === 0) {
      return { statusCode: 400, body: JSON.stringify({ error: 'Produit inconnu.' }) };
    }

    const siteUrl = process.env.URL || 'http://localhost:8888';

    const session = await stripe.checkout.sessions.create({
      mode: 'payment',
      payment_method_types: ['card'],
      line_items,
      customer_email: user.email || undefined,
      success_url: `${siteUrl}/?checkout=success`,
      cancel_url: `${siteUrl}/?checkout=cancel`,
      metadata: {
        discord_id: discordId,
        discord_username: String(discordUsername).slice(0, 90),
        product_ids: JSON.stringify(purchasedIds).slice(0, 480),
      },
    });

    return {
      statusCode: 200,
      body: JSON.stringify({ url: session.url }),
    };
  } catch (err) {
    console.error('Erreur Stripe :', err);
    return {
      statusCode: 500,
      body: JSON.stringify({ error: err.message || 'Erreur serveur lors de la creation du paiement.' }),
    };
  }
};
