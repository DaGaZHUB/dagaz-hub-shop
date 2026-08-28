// Fonction serveur (Netlify Function) : crée une session de paiement Stripe.
// C'est la SEULE partie du site qui touche à votre clé secrète Stripe —
// elle ne quitte jamais ce fichier et n'est jamais visible côté navigateur.
//
// Variable d'environnement requise (à définir dans Netlify, PAS dans ce fichier) :
//   STRIPE_SECRET_KEY = sk_test_... (ou sk_live_... une fois prêt en production)

const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);

exports.handler = async (event) => {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: JSON.stringify({ error: 'Méthode non autorisée' }) };
  }

  try {
    const { items, email } = JSON.parse(event.body || '{}');

    if (!Array.isArray(items) || items.length === 0) {
      return { statusCode: 400, body: JSON.stringify({ error: 'Le panier est vide.' }) };
    }

    const line_items = items.map((item) => ({
      price_data: {
        currency: 'eur',
        product_data: { name: String(item.name).slice(0, 120) },
        unit_amount: Math.round(Number(item.price) * 100),
      },
      quantity: Math.max(1, parseInt(item.qty, 10) || 1),
    }));

    const siteUrl = process.env.URL || 'http://localhost:8888';

    const session = await stripe.checkout.sessions.create({
      mode: 'payment',
      payment_method_types: ['card'],
      line_items,
      customer_email: email || undefined,
      success_url: `${siteUrl}/?checkout=success`,
      cancel_url: `${siteUrl}/?checkout=cancel`,
    });

    return {
      statusCode: 200,
      body: JSON.stringify({ url: session.url }),
    };
  } catch (err) {
    console.error('Erreur Stripe :', err);
    return {
      statusCode: 500,
      body: JSON.stringify({ error: err.message || 'Erreur serveur lors de la création du paiement.' }),
    };
  }
};
