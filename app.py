"""
app.py - Flask backend for the Rock Paper Scissors AI game.

Each browser gets its own game (and its own AI memory) through a session cookie.
"""

import os
import uuid
from collections import OrderedDict

from flask import Flask, jsonify, render_template, request, session

from ai_engine import MOVES, RPSAI

app = Flask(__name__)
app.secret_key = os.environ.get("SECRET_KEY", "change-this-secret-in-production")

# One RPSAI per visitor, kept in memory. Old games are dropped if there are too many.
MAX_GAMES = 1000
games = OrderedDict()


def get_game():
    """Return the game that belongs to the current visitor (create one if needed)."""
    game_id = session.get("game_id")
    if game_id not in games:
        game_id = uuid.uuid4().hex
        session["game_id"] = game_id
        games[game_id] = RPSAI()
        while len(games) > MAX_GAMES:
            games.popitem(last=False)
    return games[game_id]


@app.route("/")
def index():
    return render_template("index.html")


@app.route("/api/state", methods=["GET"])
def api_state():
    return jsonify(get_game().state())


@app.route("/api/play", methods=["POST"])
def api_play():
    data = request.get_json(silent=True) or {}
    move = str(data.get("move", "")).strip().lower()
    if move not in MOVES:
        return jsonify({"error": "Invalid move. Choose rock, paper or scissors."}), 400

    game = get_game()
    round_info, prediction = game.play_round(move)
    return jsonify({
        "round": round_info,
        "prediction": {
            "predicted": prediction["predicted"],
            "confidence": prediction["confidence"],
            "strategy": prediction["strategy"],
            "reason": prediction["reason"],
            "models": prediction["models"],
        },
        "state": game.state(),
    })


@app.route("/api/restart", methods=["POST"])
def api_restart():
    """New match: clear scores and history, keep what the AI has learned."""
    game = get_game()
    game.restart()
    return jsonify(game.state())


@app.route("/api/reset", methods=["POST"])
def api_reset():
    """Full reset: clear everything, including the AI's memory."""
    game = get_game()
    game.reset()
    return jsonify(game.state())


@app.errorhandler(404)
def not_found(_error):
    if request.path.startswith("/api/"):
        return jsonify({"error": "Endpoint not found."}), 404
    return render_template("index.html"), 404


@app.errorhandler(405)
def method_not_allowed(_error):
    return jsonify({"error": "Method not allowed."}), 405


@app.errorhandler(500)
def server_error(_error):
    return jsonify({"error": "Something went wrong on the server."}), 500


if __name__ == "__main__":
    app.run(debug=True)
