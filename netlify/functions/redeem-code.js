// Fonction serveur (Netlify Function) : appelée directement depuis le jeu
// Roblox pour vérifier un code DAGAROV-XXXXXXXXXXXXXXX saisi par un joueur.
//
// Sécurité :
// - Un en-tête "x-api-key" doit correspondre à ROBLOX_REDEEM_SECRET : seul le
//   script serveur Roblox connaît cette valeur (jamais visible des joueurs),
//   ça empêche n'importe qui d'appeler cette adresse depuis l'extérieur.
// - Chaque code n'est utilisable qu'une seule fois (colonne "redeemed").
//
// Variables d'environnement requises (à définir dans Netlify) :
//   SUPABASE_URL              = https://xxxx.supabase.co
//   SUPABASE_SERVICE_ROLE_KEY = clé secrète Supabase
//   ROBLOX_REDEEM_SECRET      = une valeur secrète de votre choix, à recopier
//                               telle quelle dans le script Roblox (constante
//                               DAGAROV_API_KEY dans ServerScriptService.Core.ApplyCode)

const { createClient } = require('@supabase/supabase-js');

// Durée en minutes accordée pour chaque type de clé.
const DURATION_MINUTES = {
  'key-1h': 60,
  'key-1j': 60 * 24,
  'key-1m': 60 * 24 * 30,
};

const PRODUCT_LABELS = {
  'key-1h': 'KEY 1H',
  'key-1j': 'KEY 1J',
  'key-1m': 'KEY 1 MOIS',
};

exports.handler = async (event) => {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: JSON.stringify({ valid: false, error: 'Methode non autorisee' }) };
  }

  const providedKey = event.headers['x-api-key'] || event.headers['X-Api-Key'];
  if (!providedKey || providedKey !== process.env.ROBLOX_REDEEM_SECRET) {
    return { statusCode: 401, body: JSON.stringify({ valid: false, error: 'Non autorise.' }) };
  }

  let body;
  try {
    body = JSON.parse(event.body || '{}');
  } catch (e) {
    return { statusCode: 400, body: JSON.stringify({ valid: false, error: 'Requete invalide.' }) };
  }

  const code = (body.code || '').trim();
  const robloxUserId = body.robloxUserId;
  const robloxUsername = body.robloxUsername || 'Inconnu';

  if (!code || !code.startsWith('DAGAROV-')) {
    return { statusCode: 200, body: JSON.stringify({ valid: false, error: 'Format de code invalide.' }) };
  }

  try {
    const supabaseAdmin = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

    const { data: row, error: fetchError } = await supabaseAdmin
      .from('delivered_keys')
      .select('id, code, product_id, redeemed')
      .eq('code', code)
      .maybeSingle();

    if (fetchError) {
      console.error('Erreur de lecture Supabase :', fetchError);
      return { statusCode: 200, body: JSON.stringify({ valid: false, error: 'Erreur serveur, reessayez plus tard.' }) };
    }

    if (!row) {
      return { statusCode: 200, body: JSON.stringify({ valid: false, error: "Ce code n'existe pas." }) };
    }

    if (row.redeemed) {
      return { statusCode: 200, body: JSON.stringify({ valid: false, error: 'Ce code a deja ete utilise.' }) };
    }

    const minutes = DURATION_MINUTES[row.product_id] || 60;
    const productLabel = PRODUCT_LABELS[row.product_id] || row.product_id || 'Cle';

    const { error: updateError } = await supabaseAdmin
      .from('delivered_keys')
      .update({
        redeemed: true,
        redeemed_by_roblox_username: robloxUsername,
        redeemed_roblox_user_id: robloxUserId ? String(robloxUserId) : null,
        redeemed_at: new Date().toISOString(),
      })
      .eq('id', row.id)
      .eq('redeemed', false); // Empêche une double-utilisation en cas d'appels simultanés.

    if (updateError) {
      console.error('Erreur de mise a jour Supabase :', updateError);
      return { statusCode: 200, body: JSON.stringify({ valid: false, error: 'Erreur serveur, reessayez plus tard.' }) };
    }

    return {
      statusCode: 200,
      body: JSON.stringify({ valid: true, minutes, productLabel }),
    };
  } catch (err) {
    console.error('Erreur redeem-code :', err);
    return { statusCode: 200, body: JSON.stringify({ valid: false, error: 'Erreur serveur, reessayez plus tard.' }) };
  }
};
