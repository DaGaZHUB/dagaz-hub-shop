// Fonction serveur (Netlify Function) : reçoit la confirmation officielle de
// Stripe qu'un paiement a bien été effectué (webhook), génère un code
// d'accès aléatoire, et l'envoie en message privé Discord à l'acheteur.
//
// C'est volontairement Stripe qui déclenche cette fonction (et non le
// navigateur du client au moment de la redirection) : un navigateur peut
// mentir ou se fermer avant la redirection, un webhook Stripe est fiable
// et ne peut pas être falsifié par le client.
//
// Variables d'environnement requises (à définir dans Netlify) :
//   STRIPE_SECRET_KEY        = sk_test_... (déjà utilisée par l'autre fonction)
//   STRIPE_WEBHOOK_SECRET    = whsec_...   (donné par Stripe à la création du webhook)
//   DISCORD_BOT_TOKEN        = token du bot Discord (Developer Portal > Bot)
//   SUPABASE_URL              = https://xxxx.supabase.co (optionnel, pour journaliser)
//   SUPABASE_SERVICE_ROLE_KEY = clé secrète Supabase (optionnel, pour journaliser)

const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);

const CODE_CHARSET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';

function generateCode() {
  let code = '';
  for (let i = 0; i < 15; i++) {
    code += CODE_CHARSET[Math.floor(Math.random() * CODE_CHARSET.length)];
  }
  return 'DAGAROV-' + code;
}

const PRODUCT_LABELS = {
  'key-1h': 'KEY 1H (1 heure)',
  'key-1j': 'KEY 1J (1 jour)',
  'key-1m': 'KEY 1 MOIS (1 mois)',
};

async function sendDiscordDM(discordUserId, content) {
  const headers = {
    Authorization: `Bot ${process.env.DISCORD_BOT_TOKEN}`,
    'Content-Type': 'application/json',
  };

  // Étape 1 : ouvrir (ou récupérer) le canal privé avec cet utilisateur.
  const channelRes = await fetch('https://discord.com/api/v10/users/@me/channels', {
    method: 'POST',
    headers,
    body: JSON.stringify({ recipient_id: discordUserId }),
  });
  if (!channelRes.ok) {
    const errText = await channelRes.text();
    throw new Error(`Impossible d'ouvrir le DM Discord (${channelRes.status}) : ${errText}`);
  }
  const channel = await channelRes.json();

  // Étape 2 : envoyer le message dans ce canal.
  const msgRes = await fetch(`https://discord.com/api/v10/channels/${channel.id}/messages`, {
    method: 'POST',
    headers,
    body: JSON.stringify({ content }),
  });
  if (!msgRes.ok) {
    const errText = await msgRes.text();
    throw new Error(`Impossible d'envoyer le message Discord (${msgRes.status}) : ${errText}`);
  }
}

exports.handler = async (event) => {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: 'Methode non autorisee' };
  }

  let stripeEvent;
  try {
    const signature = event.headers['stripe-signature'];
    stripeEvent = stripe.webhooks.constructEvent(
      event.body,
      signature,
      process.env.STRIPE_WEBHOOK_SECRET
    );
  } catch (err) {
    console.error('Signature webhook invalide :', err.message);
    return { statusCode: 400, body: `Webhook Error: ${err.message}` };
  }

  if (stripeEvent.type !== 'checkout.session.completed') {
    // On ignore tous les autres types d'événements Stripe.
    return { statusCode: 200, body: 'ignored' };
  }

  const session = stripeEvent.data.object;
  const discordId = session.metadata && session.metadata.discord_id;
  const discordUsername = (session.metadata && session.metadata.discord_username) || 'Client';
  let productIds = [];
  try {
    productIds = JSON.parse((session.metadata && session.metadata.product_ids) || '[]');
  } catch (e) {
    productIds = [];
  }

  if (!discordId) {
    console.error('Paiement recu sans discord_id dans les metadonnees, session:', session.id);
    return { statusCode: 200, body: 'no discord id' };
  }

  try {
    const deliveries = productIds.length > 0 ? productIds : ['inconnu'];
    const lines = deliveries.map((pid) => {
      const label = PRODUCT_LABELS[pid] || pid;
      const code = generateCode();
      return { label, code };
    });

    const messageBody =
      `Merci pour votre achat sur **DAGAZ HUB** !\n\n` +
      lines.map((l) => `**${l.label}**\n\`${l.code}\``).join('\n\n') +
      `\n\nConservez ce message : ce code ne sera pas renvoye automatiquement.`;

    await sendDiscordDM(discordId, messageBody);

    // Journalisation optionnelle dans Supabase (si configuré), pour garder
    // une trace des codes livrés en cas de question du client plus tard.
    if (process.env.SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY) {
      try {
        const { createClient } = require('@supabase/supabase-js');
        const supabaseAdmin = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
        const rows = lines.map((l) => ({
          discord_id: discordId,
          discord_username: discordUsername,
          product_label: l.label,
          code: l.code,
          stripe_session_id: session.id,
        }));
        await supabaseAdmin.from('delivered_keys').insert(rows);
      } catch (logErr) {
        console.error('Erreur de journalisation (non bloquante) :', logErr.message);
      }
    }

    return { statusCode: 200, body: JSON.stringify({ delivered: lines.length }) };
  } catch (err) {
    console.error('Erreur lors de la livraison Discord :', err.message);
    // On renvoie quand meme 200 : Stripe considere sinon le webhook en echec
    // et le retente indefiniment, ce qui enverrait plusieurs fois le code.
    // L'erreur reste visible dans les logs Netlify pour investigation.
    return { statusCode: 200, body: JSON.stringify({ error: err.message }) };
  }
};
