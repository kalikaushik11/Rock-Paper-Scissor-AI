/* script.js - frontend logic. Talks to Flask with the Fetch API. */

const EMOJI = { rock: "🪨", paper: "📄", scissors: "✂️" };
const THINK_MS = 800; // how long the hands shake before the reveal

const MESSAGES = {
    win: [
        "Brilliant! You outsmarted the machine.",
        "Nice read! The AI didn't see that coming.",
        "Unpredictable and unstoppable!",
        "You're breaking its patterns. Keep going!",
    ],
    lose: [
        "The AI spotted a pattern. Mix it up!",
        "Don't give up. Change your rhythm and strike back!",
        "It is learning you. Surprise it!",
        "Every loss teaches the AI less if you stay random.",
    ],
    draw: [
        "Great minds think alike. Try something new!",
        "A standoff! Who will blink first?",
        "Even match. Break the tie next round.",
    ],
};

const $ = (id) => document.getElementById(id);
const choiceButtons = document.querySelectorAll(".choice");
let busy = false;

// ---------- Helpers ----------
function cap(word) {
    return word ? word.charAt(0).toUpperCase() + word.slice(1) : "";
}

function pick(list) {
    return list[Math.floor(Math.random() * list.length)];
}

function sleep(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
}

let toastTimer;

function showError(message) {
    const toast = $("toast");
    toast.textContent = message;
    toast.classList.add("show");
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => toast.classList.remove("show"), 3500);
}

// Fetch wrapper with error handling. Always returns parsed JSON or throws.
async function api(url, options = {}) {
    let response;
    try {
        response = await fetch(url, options);
    } catch (err) {
        throw new Error("Cannot reach the server. Is Flask running?");
    }
    let data = {};
    try {
        data = await response.json();
    } catch (err) {
        /* response was not JSON */
    }
    if (!response.ok) {
        throw new Error(data.error || `Server error (${response.status}).`);
    }
    return data;
}

function setBusy(value) {
    busy = value;
    choiceButtons.forEach((b) => (b.disabled = value));
    $("restartBtn").disabled = value;
    $("resetBtn").disabled = value;
}

// ---------- Rendering ----------
function setStat(id, value) {
    const el = $(id);
    const text = String(value);
    if (el.textContent !== text) {
        el.textContent = text;
        el.classList.remove("bump");
        void el.offsetWidth; // restart the animation
        el.classList.add("bump");
    }
}

function renderScoreboard(state) {
    setStat("pScore", state.scores.player);
    setStat("aScore", state.scores.ai);
    setStat("draws", state.scores.draws);
    setStat("rounds", state.scores.rounds);
    setStat("accuracy", state.accuracy === null ? "–" : state.accuracy + "%");
}

function renderFrequencies(state) {
    const total = Object.values(state.frequencies).reduce((a, b) => a + b, 0);
    const box = $("freqBars");
    box.innerHTML = "";
    ["rock", "paper", "scissors"].forEach((move) => {
        const count = state.frequencies[move] || 0;
        const pct = total ? Math.round((count / total) * 100) : 0;

        const row = document.createElement("div");
        row.className = "freq-row";
        const label = document.createElement("span");
        label.textContent = `${EMOJI[move]} ${cap(move)}`;
        const bar = document.createElement("div");
        bar.className = "freq-bar";
        const fill = document.createElement("div");
        fill.style.width = pct + "%";
        bar.appendChild(fill);
        const num = document.createElement("span");
        num.className = "pct";
        num.textContent = pct + "%";
        row.append(label, bar, num);
        box.appendChild(row);
    });
}

function renderHistory(state) {
    const list = $("historyList");
    list.innerHTML = "";
    if (!state.history.length) {
        const li = document.createElement("li");
        li.className = "muted";
        li.textContent = "No rounds played yet.";
        list.appendChild(li);
        return;
    }
    // Newest first
    [...state.history].reverse().forEach((r) => {
        const li = document.createElement("li");
        li.className = r.result;

        const num = document.createElement("span");
        num.className = "num";
        num.textContent = "#" + r.round;

        const moves = document.createElement("span");
        moves.textContent = `${EMOJI[r.player]} vs ${EMOJI[r.ai]}`;
        moves.title = `You: ${cap(r.player)} | AI: ${cap(r.ai)} | AI predicted: ${cap(r.predicted)}`;

        const badge = document.createElement("span");
        badge.className = "badge";
        badge.textContent = r.result.toUpperCase();

        li.append(num, moves, badge);
        list.appendChild(li);
    });
}

function renderPrediction(prediction) {
    if (prediction.strategy === "random") {
        $("predMove").textContent = "🎲 Random guess";
    } else {
        $("predMove").textContent = `${EMOJI[prediction.predicted]} ${cap(prediction.predicted)}`;
    }
    $("confBar").style.width = prediction.confidence + "%";
    $("confText").textContent = "Confidence: " + (prediction.strategy === "random" ? "none" : prediction.confidence + "%");
    $("reasonText").textContent = prediction.reason;

    const list = $("modelList");
    list.innerHTML = "";
    if (!prediction.models.length) {
        const li = document.createElement("li");
        li.className = "muted";
        li.textContent = "Models appear after a few rounds.";
        list.appendChild(li);
        return;
    }
    prediction.models.forEach((m) => {
        const li = document.createElement("li");
        const name = document.createElement("span");
        name.textContent = m.name;
        const info = document.createElement("span");
        info.className = "muted";
        const acc = m.accuracy === null ? "new" : m.accuracy + "% right";
        info.textContent = `${EMOJI[m.guess]} ${cap(m.guess)} · ${acc}`;
        li.append(name, info);
        list.appendChild(li);
    });
}

function resetArena() {
    ["playerHand", "aiHand"].forEach((id) => {
        $(id).className = "hand";
    });
    $("playerHand").textContent = "❔";
    $("aiHand").textContent = "🤖";
    $("playerMove").textContent = "Pick a move";
    $("aiMove").textContent = "Waiting…";
}

function resetResult(text) {
    const banner = $("resultBanner");
    banner.className = "result-banner";
    banner.textContent = "READY?";
    $("resultMessage").textContent = text;
    $("motivation").textContent = "The AI is waiting for your move.";
}

function renderFull(state) {
    renderScoreboard(state);
    renderFrequencies(state);
    renderHistory(state);
}

// ---------- Sound (Web Audio API, no files needed) ----------
let audioCtx = null;

function getAudio() {
    if (!audioCtx) {
        const Ctx = window.AudioContext || window.webkitAudioContext;
        if (!Ctx) return null;
        audioCtx = new Ctx();
    }
    if (audioCtx.state === "suspended") audioCtx.resume();
    return audioCtx;
}

function tone(freq, start, duration, type = "sine", volume = 0.18) {
    const ctx = getAudio();
    if (!ctx) return;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, ctx.currentTime + start);
    gain.gain.setValueAtTime(0.0001, ctx.currentTime + start);
    gain.gain.exponentialRampToValueAtTime(volume, ctx.currentTime + start + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + start + duration);
    osc.connect(gain).connect(ctx.destination);
    osc.start(ctx.currentTime + start);
    osc.stop(ctx.currentTime + start + duration + 0.05);
}

function playWinSound() {
    // Rising happy arpeggio: C-E-G-C
    const notes = [523.25, 659.25, 783.99, 1046.5];
    notes.forEach((f, i) => tone(f, i * 0.12, 0.22, "triangle", 0.16));
    tone(1318.51, 0.5, 0.35, "sine", 0.12);
}

function playLoseSound() {
    // Descending sad slide: G-Eb-C
    const notes = [392.0, 311.13, 261.63];
    notes.forEach((f, i) => tone(f, i * 0.18, 0.28, "sawtooth", 0.1));
    tone(196.0, 0.55, 0.5, "sine", 0.14);
}

// ---------- Effects ----------
function launchConfetti() {
    const box = $("confetti");
    const colors = ["#22f3ff", "#ff2e9a", "#8dff4f", "#ffc83d"];
    for (let i = 0; i < 45; i++) {
        const piece = document.createElement("span");
        piece.style.left = Math.random() * 100 + "vw";
        piece.style.background = colors[i % colors.length];
        piece.style.animationDuration = 1.6 + Math.random() * 1.6 + "s";
        piece.style.animationDelay = Math.random() * 0.4 + "s";
        box.appendChild(piece);
        setTimeout(() => piece.remove(), 3800);
    }
}

function shakeScreen() {
    const app = $("app");
    app.classList.remove("shake");
    void app.offsetWidth;
    app.classList.add("shake");
}

// ---------- Playing a round ----------
async function playRound(move) {
    if (busy) return;
    setBusy(true);

    // Shaking hands while the AI "thinks"
    const pHand = $("playerHand");
    const aHand = $("aiHand");
    pHand.className = "hand thinking";
    aHand.className = "hand thinking";
    pHand.textContent = "✊";
    aHand.textContent = "✊";
    $("playerMove").textContent = "…";
    $("aiMove").textContent = "AI is thinking…";
    $("resultBanner").className = "result-banner";
    $("resultBanner").textContent = "…";
    $("resultMessage").textContent = "";
    $("motivation").textContent = "";

    try {
        // Ask the server and wait for the animation at the same time
        const [data] = await Promise.all([
            api("/api/play", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ move }),
            }),
            sleep(THINK_MS),
        ]);

        const round = data.round;
        pHand.className = "hand reveal";
        aHand.className = "hand reveal";
        pHand.textContent = EMOJI[round.player];
        aHand.textContent = EMOJI[round.ai];
        $("playerMove").textContent = cap(round.player);
        $("aiMove").textContent = cap(round.ai);

        const banner = $("resultBanner");
        banner.className = "result-banner " + round.result;
        banner.textContent = { win: "YOU WIN!", lose: "YOU LOSE", draw: "DRAW" }[round.result];
        $("resultMessage").textContent = round.message;
        $("motivation").textContent = pick(MESSAGES[round.result]);

        if (round.result === "win") {
            pHand.classList.add("winner");
            aHand.classList.add("loser");
            launchConfetti();
            playWinSound();
        } else if (round.result === "lose") {
            aHand.classList.add("winner");
            pHand.classList.add("loser");
            shakeScreen();
            playLoseSound();
        }

        renderPrediction(data.prediction);
        renderFull(data.state);
    } catch (err) {
        resetArena();
        resetResult("Something went wrong. Try again.");
        showError(err.message);
    } finally {
        setBusy(false);
    }
}

// ---------- Restart / reset ----------
async function resetGame(url, confirmText, message) {
    if (busy) return;
    if (!confirm(confirmText)) return;
    setBusy(true);
    try {
        const state = await api(url, { method: "POST" });
        renderFull(state);
        resetArena();
        resetResult(message);
        $("predMove").textContent = "–";
        $("confBar").style.width = "0%";
        $("confText").textContent = "Confidence: –";
        $("reasonText").textContent = "Play a round and the AI will explain its prediction.";
        $("modelList").innerHTML = '<li class="muted">Models appear after a few rounds.</li>';
    } catch (err) {
        showError(err.message);
    } finally {
        setBusy(false);
    }
}

// ---------- Start-up ----------
choiceButtons.forEach((button) => {
    button.addEventListener("click", () => playRound(button.dataset.move));
});

$("restartBtn").addEventListener("click", () =>
    resetGame("/api/restart", "Start a new match? Scores clear, but the AI remembers how you play.", "New match started. Make your move!")
);
$("resetBtn").addEventListener("click", () =>
    resetGame("/api/reset", "Reset everything, including what the AI has learned?", "Everything was reset. The AI knows nothing about you again.")
);

// Load any existing game (e.g. after a page refresh)
(async function init() {
    try {
        const state = await api("/api/state");
        renderFull(state);
        if (state.scores.rounds > 0) {
            $("resultMessage").textContent = "Welcome back! Your game was restored.";
        }
    } catch (err) {
        renderFull({ scores: { player: 0, ai: 0, draws: 0, rounds: 0 }, accuracy: null, frequencies: {}, history: [] });
        showError(err.message);
    }
})();