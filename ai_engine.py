"""
ai_engine.py - the brain of the Rock Paper Scissors AI.

How the AI thinks
-----------------
Before every round the AI asks several small "prediction models" what the
player will probably play next. Each model looks at the player's history in a
different way:

  frequency    - which move does the player use most overall?
  recent       - which move does the player use most in the last few rounds?
  markov1      - what did the player play after their last move, in the past?
  markov2      - what did the player play after their last TWO moves?
  after_result - how does the player react after a win / loss / draw?
  cycle        - does the player rotate rock -> paper -> scissors in order?

The AI tracks how often each model has been right and trusts the accurate
ones more (weighted voting). That is what makes it adaptive: if the player
changes style, the models that fit the new style take over.

Finally the AI plays the move that BEATS the predicted move.
With fewer than MIN_HISTORY rounds played it simply plays randomly.
"""

import random
from collections import Counter

MOVES = ["rock", "paper", "scissors"]

# BEATS[a] is the move that `a` defeats.
BEATS = {"rock": "scissors", "paper": "rock", "scissors": "paper"}
# COUNTER[a] is the move that defeats `a`.
COUNTER = {"rock": "paper", "paper": "scissors", "scissors": "rock"}

MIN_HISTORY = 3          # rounds needed before the AI starts predicting
RECENT_WINDOW = 6        # how many recent moves the "recent" model looks at

MODEL_LABELS = {
    "frequency": "Overall favourite",
    "recent": "Recent trend",
    "markov1": "Last-move pattern",
    "markov2": "Two-move pattern",
    "after_result": "Win/lose reaction",
    "cycle": "Rotation pattern",
}


def decide(player_move, ai_move):
    """Return 'win', 'lose' or 'draw' from the PLAYER's point of view."""
    if player_move == ai_move:
        return "draw"
    if BEATS[player_move] == ai_move:
        return "win"
    return "lose"


def _normalize(counter):
    """Turn raw counts into probabilities. Returns None if there is no data."""
    total = sum(counter.values())
    if total == 0:
        return None
    return {move: count / total for move, count in counter.items()}


class RPSAI:
    """Holds one game: the AI's memory, the scores and the round history."""

    def __init__(self):
        self.models = {
            "frequency": self._model_frequency,
            "recent": self._model_recent,
            "markov1": lambda: self._model_markov(1),
            "markov2": lambda: self._model_markov(2),
            "after_result": self._model_after_result,
            "cycle": self._model_cycle,
        }
        self.reset()

    # ------------------------------------------------------------------ #
    # Game control
    # ------------------------------------------------------------------ #
    def reset(self):
        """Full reset: wipe the scores AND everything the AI has learned."""
        self.player_moves = []      # every move the player ever made (AI memory)
        self.player_results = []    # result of each of those rounds
        self.model_stats = {name: {"hits": 0, "total": 0} for name in self.models}
        self.restart()
        # restart() keeps memory, so clear the memory-related parts here too.
        self.player_moves = []
        self.player_results = []

    def restart(self):
        """New match: scores and history are cleared, but the AI keeps what it learned."""
        self.scores = {"player": 0, "ai": 0, "draws": 0, "rounds": 0}
        self.history = []           # rows shown in the "game history" panel
        self.ai_predictions = 0     # rounds where the AI really predicted
        self.ai_correct = 0         # ...and predicted correctly

    # ------------------------------------------------------------------ #
    # Prediction models. Each returns {move: probability} or None.
    # ------------------------------------------------------------------ #
    def _model_frequency(self):
        return _normalize(Counter(self.player_moves))

    def _model_recent(self):
        return _normalize(Counter(self.player_moves[-RECENT_WINDOW:]))

    def _model_markov(self, order):
        moves = self.player_moves
        if len(moves) <= order:
            return None
        key = tuple(moves[-order:])
        counts = Counter()
        # Look through the past for the same sequence and see what followed it.
        for i in range(order, len(moves)):
            if tuple(moves[i - order:i]) == key:
                counts[moves[i]] += 1
        return _normalize(counts)

    def _model_after_result(self):
        if not self.player_results:
            return None
        last_result = self.player_results[-1]
        counts = Counter()
        for i in range(len(self.player_results) - 1):
            if self.player_results[i] == last_result:
                counts[self.player_moves[i + 1]] += 1
        return _normalize(counts)

    def _model_cycle(self):
        moves = self.player_moves
        if len(moves) < 2:
            return None
        index = {m: i for i, m in enumerate(MOVES)}
        steps = [(index[b] - index[a]) % 3 for a, b in zip(moves, moves[1:])]
        counts = Counter(steps[-RECENT_WINDOW:])
        last = index[moves[-1]]
        probs = Counter()
        for step, count in counts.items():
            probs[MOVES[(last + step) % 3]] += count
        return _normalize(probs)

    # ------------------------------------------------------------------ #
    # Prediction
    # ------------------------------------------------------------------ #
    def _model_weight(self, name):
        """How much we trust a model: its (smoothed) hit rate, squared."""
        stats = self.model_stats[name]
        hit_rate = (stats["hits"] + 1) / (stats["total"] + 2)
        return hit_rate ** 2

    def predict(self):
        """Predict the player's next move. Returns a dict describing the thinking."""
        if len(self.player_moves) < MIN_HISTORY:
            return {
                "predicted": random.choice(MOVES),
                "confidence": 0.0,
                "strategy": "random",
                "reason": "Not enough history yet, so the AI is guessing randomly.",
                "models": [],
                "guesses": {},
            }

        combined = Counter()
        guesses = {}
        weights = {}
        for name, model in self.models.items():
            probs = model()
            if not probs:
                continue
            best_p = max(probs.values())
            guesses[name] = random.choice([m for m, p in probs.items() if p == best_p])
            weights[name] = self._model_weight(name)
            for move, p in probs.items():
                combined[move] += weights[name] * p

        total = sum(combined.values())
        if total == 0:
            return {
                "predicted": random.choice(MOVES),
                "confidence": 0.0,
                "strategy": "random",
                "reason": "No clear pattern found yet, so the AI is guessing randomly.",
                "models": [],
                "guesses": {},
            }

        top = max(combined.values())
        predicted = random.choice([m for m, v in combined.items() if v == top])

        # Explain the decision using the most trusted model that agrees.
        agreeing = [n for n, g in guesses.items() if g == predicted]
        lead = max(agreeing, key=lambda n: weights[n]) if agreeing else None
        reason = "The AI combined all of its pattern models."
        if lead:
            reason = (f"Strongest signal: {MODEL_LABELS[lead]} "
                      f"({len(agreeing)} of {len(guesses)} models agree).")

        models = []
        for name, guess in guesses.items():
            stats = self.model_stats[name]
            accuracy = round(100 * stats["hits"] / stats["total"]) if stats["total"] else None
            models.append({"name": MODEL_LABELS[name], "guess": guess, "accuracy": accuracy})

        return {
            "predicted": predicted,
            "confidence": round(100 * combined[predicted] / total),
            "strategy": "ai",
            "reason": reason,
            "models": models,
            "guesses": guesses,
        }

    # ------------------------------------------------------------------ #
    # Playing a round
    # ------------------------------------------------------------------ #
    def play_round(self, player_move):
        """Play one round. Returns (round_info, prediction)."""
        prediction = self.predict()
        ai_move = COUNTER[prediction["predicted"]]
        result = decide(player_move, ai_move)

        # Learn: grade every model against what the player really did.
        for name, guess in prediction["guesses"].items():
            self.model_stats[name]["total"] += 1
            if guess == player_move:
                self.model_stats[name]["hits"] += 1

        predicted_correctly = prediction["predicted"] == player_move
        if prediction["strategy"] == "ai":
            self.ai_predictions += 1
            if predicted_correctly:
                self.ai_correct += 1

        # Remember the move for future predictions.
        self.player_moves.append(player_move)
        self.player_results.append(result)

        # Update the scoreboard.
        self.scores["rounds"] += 1
        if result == "win":
            self.scores["player"] += 1
        elif result == "lose":
            self.scores["ai"] += 1
        else:
            self.scores["draws"] += 1

        if result == "draw":
            message = f"Both chose {player_move.capitalize()}. It's a draw!"
        elif result == "win":
            message = f"{player_move.capitalize()} beats {ai_move.capitalize()}. You win!"
        else:
            message = f"{ai_move.capitalize()} beats {player_move.capitalize()}. The AI wins!"

        round_info = {
            "round": self.scores["rounds"],
            "player": player_move,
            "ai": ai_move,
            "predicted": prediction["predicted"],
            "predicted_correctly": predicted_correctly,
            "result": result,
            "message": message,
        }
        self.history.append(round_info)
        return round_info, prediction

    # ------------------------------------------------------------------ #
    # State for the frontend
    # ------------------------------------------------------------------ #
    def state(self):
        accuracy = None
        if self.ai_predictions:
            accuracy = round(100 * self.ai_correct / self.ai_predictions)
        return {
            "scores": self.scores,
            "accuracy": accuracy,
            "accuracy_detail": {"correct": self.ai_correct, "total": self.ai_predictions},
            "history": self.history[-50:],
            "frequencies": dict(Counter(self.player_moves)),
            "memory_size": len(self.player_moves),
            "min_history": MIN_HISTORY,
        }
