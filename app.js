const analyzeBtn = document.getElementById('analyzeBtn');
const backendUrlInput = document.getElementById('backendUrl');
const competitionEl = document.getElementById('competition');
const riskModeEl = document.getElementById('riskMode');
const topNEl = document.getElementById('topN');
const statusBox = document.getElementById('statusBox');
const picksList = document.getElementById('picksList');
const matchesList = document.getElementById('matchesList');
const statPicks = document.getElementById('statPicks');
const statMatches = document.getElementById('statMatches');
const statTime = document.getElementById('statTime');
const topLabel = document.getElementById('topLabel');
const subtitle = document.getElementById('subtitle');

function setStatus(type, text) {
  statusBox.className = `status ${type}`;
  statusBox.textContent = text;
}

function badgeClass(score) {
  if (score >= 75) return 'safe';
  if (score >= 60) return 'mid';
  return 'risk';
}

function riskLabel(score) {
  if (score >= 75) return 'Confiance haute';
  if (score >= 60) return 'Confiance moyenne';
  return 'Confiance fragile';
}

function formatPct(v) {
  return `${(v * 100).toFixed(1)}%`;
}

function formatTime() {
  return new Date().toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
}

function renderPicks(picks) {
  if (!picks.length) {
    picksList.innerHTML = '<div class="empty">Aucun pari retenu.</div>';
    return;
  }

  picksList.innerHTML = picks.map((pick, idx) => `
    <article class="pick">
      <div class="pick-top">
        <div>
          <div class="pick-title">#${idx + 1} — ${pick.match}</div>
          <div class="meta">${pick.marketLabel} · Cote ${pick.odds.toFixed(2)} · Probabilité modèle ${formatPct(pick.modelProbability)}</div>
        </div>
        <span class="badge ${badgeClass(pick.confidenceScore)}">${riskLabel(pick.confidenceScore)}</span>
      </div>
      <div class="why"><strong>Pari conseillé :</strong> ${pick.pickLabel}</div>
      <div class="why"><strong>Pourquoi :</strong> ${pick.reasons.join(' · ')}</div>
      <div class="metrics">
        <div class="metric"><span>Confiance</span><strong>${pick.confidenceScore}/100</strong></div>
        <div class="metric"><span>Edge</span><strong>${(pick.edge * 100).toFixed(1)}%</strong></div>
        <div class="metric"><span>Forme</span><strong>${pick.homeFormScore} - ${pick.awayFormScore}</strong></div>
        <div class="metric"><span>Buts / match</span><strong>${pick.homeGoalsFor.toFixed(2)} - ${pick.awayGoalsFor.toFixed(2)}</strong></div>
      </div>
    </article>
  `).join('');
}

function renderMatches(matches) {
  if (!matches.length) {
    matchesList.innerHTML = '<div class="empty">Aucun match chargé.</div>';
    return;
  }

  matchesList.innerHTML = matches.map(match => `
    <article class="match">
      <div class="match-top">
        <div>
          <div class="match-title">${match.homeTeam} vs ${match.awayTeam}</div>
          <div class="meta">${match.kickoffLabel}</div>
        </div>
        <span class="badge ${badgeClass(match.bestConfidence || 50)}">${match.bestConfidence || 0}/100</span>
      </div>
      <div class="why">Meilleur angle : <strong>${match.bestBetLabel || 'Aucun'}</strong></div>
    </article>
  `).join('');
}

async function analyze() {
  const backendUrl = backendUrlInput.value.trim().replace(/\/$/, '');
  if (!backendUrl) {
    setStatus('err', 'Ajoute ton URL backend Cloudflare Worker.');
    return;
  }

  const competition = competitionEl.value;
  const riskMode = riskModeEl.value;
  const topN = Number(topNEl.value);
  topLabel.textContent = topN;
  subtitle.textContent = `Analyse en cours sur ${competition}…`;
  setStatus('info', 'Analyse des matchs en cours…');
  picksList.innerHTML = '';
  matchesList.innerHTML = '';

  try {
    const url = `${backendUrl}/analyze?competition=${encodeURIComponent(competition)}&riskMode=${encodeURIComponent(riskMode)}&topN=${encodeURIComponent(topN)}`;
    const response = await fetch(url);
    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.error || 'Erreur backend');
    }

    renderPicks(data.picks || []);
    renderMatches(data.matches || []);
    statPicks.textContent = String((data.picks || []).length);
    statMatches.textContent = String(data.matchesCount || 0);
    statTime.textContent = formatTime();
    setStatus('ok', 'Analyse terminée.');
    subtitle.textContent = data.summary || 'Top paris calculés.';
  } catch (err) {
    setStatus('err', `Impossible d’analyser : ${err.message}`);
    subtitle.textContent = 'Le backend n’a pas répondu correctement.';
  }
}

analyzeBtn.addEventListener('click', analyze);
