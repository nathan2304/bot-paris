function esc(str) {
  return String(str).replace(/[&<>"']/g, s => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;'
  }[s]));
}

function pct(x) {
  return (x * 100).toFixed(2) + '%';
}

const statusEl = document.getElementById('status');
const resultsEl = document.getElementById('results');
const testBtn = document.getElementById('testBtn');
const runBtn = document.getElementById('runBtn');

async function apiFetch(url) {
  const resp = await fetch(url, {
    method: 'GET',
    headers: { 'Accept': 'application/json' }
  });
  const text = await resp.text();
  let data = null;
  try { data = JSON.parse(text); } catch (_) {}
  return { resp, text, data };
}

async function testApi() {
  const apiKey = document.getElementById('apiKey').value.trim();
  if (!apiKey) {
    statusEl.innerHTML = '<span class="warn">❌ Clé API manquante.</span>';
    return;
  }

  statusEl.innerHTML = 'Test de l’API en cours…';
  resultsEl.innerHTML = '';

  const url = `https://api.the-odds-api.com/v4/sports/?apiKey=${encodeURIComponent(apiKey)}`;

  try {
    const { resp, text, data } = await apiFetch(url);

    if (!resp.ok) {
      statusEl.innerHTML = `<span class="warn">❌ Test API échoué (${resp.status})</span><br><br><code>${esc(text || 'réponse vide')}</code>`;
      return;
    }

    if (!Array.isArray(data)) {
      statusEl.innerHTML = `<span class="warn">❌ Réponse inattendue.</span><br><br><code>${esc(text || 'réponse vide')}</code>`;
      return;
    }

    statusEl.innerHTML = `<span class="ok">✅ API OK</span><br><br>Sports trouvés : <b>${data.length}</b>`;
  } catch (err) {
    statusEl.innerHTML = `<span class="warn">❌ Erreur réseau.</span><br><br><code>${esc(err.message || String(err))}</code>`;
  }
}

async function findTopBets() {
  const apiKey = document.getElementById('apiKey').value.trim();
  const sportKey = document.getElementById('sportKey').value;
  const region = document.getElementById('region').value;
  const mode = document.getElementById('mode').value;
  const targetBookmaker = document.getElementById('bookmaker').value.trim().toLowerCase();

  if (!apiKey) {
    statusEl.innerHTML = '<span class="warn">❌ Clé API manquante.</span>';
    return;
  }

  statusEl.innerHTML = 'Chargement des cotes live…';
  resultsEl.innerHTML = '';

  const url = `https://api.the-odds-api.com/v4/sports/${encodeURIComponent(sportKey)}/odds?apiKey=${encodeURIComponent(apiKey)}&regions=${encodeURIComponent(region)}&markets=h2h&oddsFormat=decimal`;

  try {
    const { resp, text, data } = await apiFetch(url);

    if (!resp.ok) {
      statusEl.innerHTML = `<span class="warn">❌ Erreur API (${resp.status})</span><br><br><code>${esc(text || 'réponse vide')}</code>`;
      return;
    }

    if (!Array.isArray(data) || data.length === 0) {
      statusEl.innerHTML = '<span class="warn">⚠️ Aucun match trouvé pour cette compétition/région.</span>';
      return;
    }

    const picks = [];

    for (const event of data) {
      const books = Array.isArray(event.bookmakers) ? event.bookmakers : [];
      if (books.length < 2) continue;

      const marketMap = {};

      for (const book of books) {
        const h2h = (book.markets || []).find(m => m.key === 'h2h');
        if (!h2h || !Array.isArray(h2h.outcomes)) continue;

        for (const outcome of h2h.outcomes) {
          const name = outcome.name;
          const price = Number(outcome.price);
          if (!name || !Number.isFinite(price) || price <= 1) continue;

          marketMap[name] = marketMap[name] || [];
          marketMap[name].push({
            bookmakerKey: (book.key || '').toLowerCase(),
            bookmakerTitle: book.title || book.key || 'bookmaker',
            price
          });
        }
      }

      for (const outcomeName of Object.keys(marketMap)) {
        const offers = marketMap[outcomeName];
        if (!offers || offers.length < 2) continue;

        const marketAvgOdds = offers.reduce((sum, x) => sum + x.price, 0) / offers.length;

        let chosen = null;
        if (mode === 'target') {
          chosen = offers.find(x => x.bookmakerKey === targetBookmaker);
          if (!chosen) continue;
        } else {
          chosen = offers.reduce((best, x) => !best || x.price > best.price ? x : best, null);
        }

        if (!chosen || !Number.isFinite(chosen.price) || chosen.price <= 1) continue;

        const impliedMarket = 1 / marketAvgOdds;
        const impliedChosen = 1 / chosen.price;
        const edge = impliedMarket - impliedChosen;
        const bonusOdds = chosen.price - marketAvgOdds;

        picks.push({
          match: `${event.home_team} vs ${event.away_team}`,
          outcome: outcomeName,
          chosenBookmaker: chosen.bookmakerTitle,
          chosenBookmakerKey: chosen.bookmakerKey,
          chosenOdds: chosen.price,
          marketAvgOdds,
          impliedMarket,
          impliedChosen,
          edge,
          bonusOdds,
          comparedBooks: offers.length
        });
      }
    }

    const top = picks.filter(p => p.edge > 0).sort((a, b) => b.edge - a.edge).slice(0, 3);

    if (top.length === 0) {
      statusEl.innerHTML = '<span class="warn">⚠️ Aucun edge positif trouvé. Essaie EU + meilleur bookmaker disponible.</span>';
      return;
    }

    statusEl.innerHTML = `<span class="ok">✅ Analyse terminée.</span><br><br>${top.length} pari(s) retenu(s).`;

    resultsEl.innerHTML = top.map((p, i) => `
      <div class="card result">
        <div><b>#${i + 1} — ${esc(p.match)}</b><span class="badge">edge ${pct(p.edge)}</span></div>
        <div style="margin-top:8px;">Issue : <b>${esc(p.outcome)}</b></div>
        <div>Bookmaker retenu : <b>${esc(p.chosenBookmaker)}</b> <span class="small">(${esc(p.chosenBookmakerKey)})</span></div>
        <div>Cote retenue : <b>${p.chosenOdds.toFixed(2)}</b></div>
        <div>Cote moyenne marché : <b>${p.marketAvgOdds.toFixed(2)}</b></div>
        <div>Bonus de cote : <b>${p.bonusOdds.toFixed(2)}</b></div>
        <div>Proba implicite marché : <b>${pct(p.impliedMarket)}</b></div>
        <div>Proba implicite cote retenue : <b>${pct(p.impliedChosen)}</b></div>
        <div>Bookmakers comparés : <b>${p.comparedBooks}</b></div>
      </div>
    `).join('');
  } catch (err) {
    statusEl.innerHTML = `<span class="warn">❌ Erreur réseau.</span><br><br><code>${esc(err.message || String(err))}</code>`;
  }
}

testBtn.addEventListener('click', testApi);
runBtn.addEventListener('click', findTopBets);
