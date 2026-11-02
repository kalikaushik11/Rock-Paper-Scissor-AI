# Rock Paper Scissors – AI Challenge

An interactive Rock, Paper, Scissors game in which a Flask-powered AI learns from the player's move history. The AI uses multiple prediction models, combines their predictions with weighted voting, and chooses a counter-move.

## Features

- Play Rock, Paper, Scissors against an adaptive AI opponent.
- AI prediction panel showing the predicted move, confidence, explanation, and model guesses.
- Six prediction models that analyze different player patterns.
- Weighted voting that gives more influence to models with better historical prediction accuracy.
- Scoreboard for player wins, AI wins, draws, total rounds, and AI prediction accuracy.
- Move-frequency bars and round-by-round game history.
- Animated hand reveal, result effects, confetti, and sound effects.
- **Restart game** clears the current match score and history while retaining the AI's learned move patterns and model statistics.
- **Reset everything** clears the match and the AI's learned information.
- Separate game state for each browser session, managed by Flask session cookies.

## Technologies Used

| Technology | Role |
|---|---|
| Python | Game rules and AI prediction logic |
| Flask | Web server, HTML rendering, and API endpoints |
| HTML5 | Game interface structure |
| CSS3 | Neon/glass visual design, animations, and responsive layout |
| JavaScript | User interactions, rendering, Fetch API calls, and sound effects |
| Web Audio API | Generates game sound effects in the browser |

## Project Structure

Keep the files and folders arranged like this:

```text
Rock-Paper-Scissors/
├── app.py
├── ai_engine.py
├── templates/
│   └── index.html
└── static/
    ├── style.css
    └── script.js
```

**Important:** The HTML file must be named `index.html` and placed inside `templates/`. The CSS and JavaScript files must be inside `static/`, with the exact names `style.css` and `script.js`. The stylesheet filename should be `style.css` (not `style.csss`).

## Requirements

- Python 3
- Flask
- A modern web browser

## Installation and Setup

### 1. Open the project

Open the project folder in VS Code and make sure the folder structure matches the structure shown above.

### 2. Create a virtual environment (recommended)

**macOS / Linux**

```bash
python3 -m venv .venv
source .venv/bin/activate
```

**Windows**

```bash
python -m venv .venv
.venv\Scripts\activate
```

### 3. Install Flask

```bash
python -m pip install Flask
```

### 4. Run the Flask application

**macOS / Linux**

```bash
python3 app.py
```

**Windows**

```bash
python app.py
```

When Flask starts, the terminal should show a local address similar to:

```text
http://127.0.0.1:5000
```

### 5. Open the game

Open this address in your browser:

```text
http://127.0.0.1:5000/
```

Run the project through Flask. Do not open `templates/index.html` directly or use VS Code Live Server, because the page uses Flask's `url_for()` template function and communicates with Flask API routes.

## How to Play

1. Open the game in your browser.
2. Select **Rock**, **Paper**, or **Scissors**.
3. The AI predicts the move you are likely to choose, based on your previous moves.
4. The AI plays the move that counters its prediction.
5. The page displays both moves and the round result.
6. Review the AI's prediction, confidence, model information, move habits, scoreboard, and game history.
7. Select **Restart game** to begin a new match while preserving what the AI learned.
8. Select **Reset everything** to clear both the match and the AI's learning history.

The AI starts with random guesses until it has at least three previous player moves.

## AI Prediction Models

The AI uses six models. Each model examines the player's history from a different perspective:

| Model | What it analyzes |
|---|---|
| Frequency | The move the player has used most often overall. |
| Recent | The player's most common move in the latest six rounds. |
| First-order Markov (`markov1`) | Which move the player tends to make after their previous move. |
| Second-order Markov (`markov2`) | Which move the player tends to make after the same sequence of their previous two moves. |
| After-result | How the player tends to respond after a win, loss, or draw. |
| Cycle | Whether the player follows a repeating move-rotation pattern, such as Rock → Paper → Scissors. |

### Weighted Voting

1. Each available model estimates the probabilities of the player's next move.
2. Each model's previous predictions are compared with the player's actual moves.
3. The AI calculates a smoothed hit rate for each model and squares it to determine that model's weight.
4. The models' probability estimates are combined using these weights.
5. The move with the highest combined score becomes the AI's prediction.
6. The AI chooses the move that beats the predicted player move.

The AI needs at least **3 previous player moves** before using its pattern-based prediction. Before that, it chooses a random prediction. The recent-move model examines up to **6 recent moves**.

**Note:** AI accuracy measures how often the AI predicted the player's move correctly in rounds where it used its pattern-based prediction. It is not the same as the AI's game win rate.

## Game Rules

- Rock beats Scissors.
- Scissors beats Paper.
- Paper beats Rock.
- If both sides choose the same move, the round is a draw.

## Backend API

The Flask backend provides these routes:

| Endpoint | Method | Description |
|---|---|---|
| `/` | GET | Renders the game page. |
| `/api/state` | GET | Returns the current game state, scores, history, frequencies, and accuracy. |
| `/api/play` | POST | Plays a round using the submitted player move. |
| `/api/restart` | POST | Clears the current match score and history but keeps AI learning. |
| `/api/reset` | POST | Clears the match and all AI learning data. |

### Example request for `/api/play`

Send JSON with a `move` value of `rock`, `paper`, or `scissors`:

```json
{
  "move": "rock"
}
```

The frontend sends this request using the JavaScript Fetch API.

## How the Main Files Work

- **`app.py`** – Creates the Flask application, manages each visitor's game session, renders `index.html`, and provides the API endpoints.
- **`ai_engine.py`** – Contains the game rules, six prediction models, weighted voting, AI learning, scoring, and game-state logic.
- **`templates/index.html`** – Defines the game interface, scoreboard, move buttons, AI panel, history panel, and controls.
- **`static/style.css`** – Defines the visual theme, layout, responsive styles, and animations.
- **`static/script.js`** – Handles button clicks, API requests, game updates, sound effects, confetti, and dynamic page rendering.

## Notes and Limitations

- The Flask development server is intended for local development, not production deployment.
- The default secret key in `app.py` is for development. Configure a secure `SECRET_KEY` environment variable before deployment.
- Game objects are stored in server memory. They are temporary and can be lost when the Flask process restarts.
- The in-memory game store is limited to 1,000 game entries; older entries are removed when the limit is exceeded.
- The interface loads Google Fonts from Google Fonts, so those fonts require an internet connection. The game logic itself runs locally.
- This project uses pattern-based prediction, not a trained machine-learning model. Its predictions are estimates and are not guaranteed to be correct.

## Future Improvements

- Add difficulty levels and more prediction strategies.
- Store game sessions and player statistics in a database.
- Add multiplayer gameplay.
- Evaluate model performance over larger game histories.
- Add a deployment-ready production server and stronger session management.

## Author

- **Akshat Nagpal(2400821530004)**
- **Kali Kaushik(2400821530029)**
- **Kartik Gupta(2400821530030)**
- **Students of Btech AIML 3rd year, MIT, Moradabad**

