from flask import Flask, render_template, jsonify, request
from flask_socketio import SocketIO, emit
import secrets
import random
import sqlite3
import json
from pathlib import Path

app = Flask(__name__)
secret_key = secrets.token_hex(24)
app.config['SECRET_KEY'] = secret_key
socketio = SocketIO(app)

players = {}
grid_size_x = 50  
grid_size_y = 27  
apple = None  
candle_state = []


# Connect to SQLite database
conn = sqlite3.connect("messages.db", check_same_thread=False)
cursor = conn.cursor()

cursor.execute("""
    CREATE TABLE IF NOT EXISTS candles (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        type TEXT NOT NULL,
        points INTEGER NOT NULL
    )
""")
conn.commit()



def get_random_position():
    """Get a random position that doesn't collide with existing players."""
    while True:
        x, y = random.randint(0, grid_size_x - 1), random.randint(0, grid_size_y - 1)
        collision = any((x, y) in snake['body'] for snake in players.values())
        if not collision:
            return x, y

@app.route('/')
def index():
    return render_template('index.html')

@socketio.on('connect')
def on_connect():
    global apple
    if apple is None:
        apple_x, apple_y = get_random_position()
        apple = (apple_x, apple_y)
    
    cursor.execute("SELECT type, points FROM candles")
    candles_from_db = [{'type': row[0], 'points': row[1]} for row in cursor.fetchall()]

    global candle_state
    candle_state = candles_from_db    
    
    print(f"Connected- (render db): {candle_state} | {candles_from_db}")

    emit('initialize_candles', candle_state, to=request.sid)
    

@socketio.on('disconnect')
def on_disconnect():
    sid = request.sid
    if sid in players:
        del players[sid]
    emit('player_left', {'id': sid}, to=None)

@socketio.on('update_direction')
def update_direction(data):
    sid = request.sid
    if sid in players:
        players[sid]['direction'] = data['direction']

@socketio.on('join_game')
def join_game(data):
    """Handles the player joining the game after choosing their name and color."""
    sid = request.sid
    player_name = data['name']
    player_color = data['color']

   
    head_x, head_y = get_random_position()

    players[sid] = {
        'name': player_name,  
        'color': player_color,  
        'head': (head_x, head_y),
        'body': [(head_x, head_y - i) for i in range(4)],  # Snake body with 4 segments
        'direction': 'DOWN'
    }

    emit('player_joined', {'id': sid, 'players': players, 'apple': apple,'candles': candle_state}, to=None)

@socketio.on('tick')
def game_tick():
    global apple
    collided_players = set()  

    for sid, snake in players.items():
        x, y = snake['head']

        if snake['direction'] == 'UP':
            y -= 1
        elif snake['direction'] == 'DOWN':
            y += 1
        elif snake['direction'] == 'LEFT':
            x -= 1
        elif snake['direction'] == 'RIGHT':
            x += 1

        x = (x + grid_size_x) % grid_size_x  
        y = (y + grid_size_y) % grid_size_y

        snake['body'] = [(x, y)] + snake['body']
        snake['head'] = (x, y)

        for other_sid, other_snake in players.items():
            if sid != other_sid and (x, y) in other_snake['body']:
                collided_players.add(sid)
                collided_players.add(other_sid)

        if (x, y) in snake['body'][1:]:
            collided_players.add(sid)

        if snake['head'] == apple:
            apple = get_random_position()
            snake['points'] = snake.get('points', 0) + 1  
            emit('player_ate_point', {'points': 10}, to=None)

            candle = {'type': 'green', 'points': 10}
            candle_state.append(candle)
            save_candle_to_db(candle)  
        else:
            snake['body'].pop()

    for sid in collided_players:
        if sid in players:
            points_lost = players[sid]["points"]
            del players[sid]
            emit('player_left', {'id': sid}, to=None)
            
            
            emit('player_died', {'points': points_lost}, to=None) 

            candle = {'type': 'red', 'points': points_lost}
            candle_state.append(candle)
            save_candle_to_db(candle)  

    emit('update', {'players': players, 'apple': apple}, to=None)


def game_over(sid):
    """Handles game over for the player."""
    if sid in players:
        del players[sid] 
        points_lost = players[sid]
        emit('player_left', {'id': sid}, to=None)
        print(f"Died, lost : {points_lost}")
        emit('player_died', {'points': points_lost}, to=None) 

def save_image_to_db(message):
    """Save the provided message to the database."""
    if not message:
        raise ValueError("Message cannot be empty")

    with sqlite3.connect('messages.db') as conn:
        cursor = conn.cursor()

        cursor.execute('''
        INSERT INTO image_results (message)
        VALUES (?);
        ''', (message,))


    socketio.emit('new_message', {'message': message}, to=None)


def get_all_messages():
    conn = sqlite3.connect('messages.db')
    cursor = conn.cursor()
    cursor.execute('SELECT message FROM image_results')
    rows = cursor.fetchall()
    conn.close()
    return rows

@app.route('/get_all_messages', methods=['GET'])
def get_image_results():
    msg = get_all_messages()
    msg = [i[0] for i in get_all_messages()]

    print("Successfully render the database")
    return jsonify({'messages': msg})


@socketio.on('message')
def handle_live_message(message):
    print("Started AI", message)

    # Save message to database
    save_image_to_db(message)


def create_table_if_not_exists():
    
    with sqlite3.connect('messages.db') as conn:
        cursor = conn.cursor()

        cursor.execute('''
        CREATE TABLE IF NOT EXISTS image_results (
            id INTEGER PRIMARY KEY AUTOINCREMENT, -- Unique identifier
            message TEXT NOT NULL -- Message content, must not be null
        );
        ''')



def save_candle_to_db(candle):
    cursor.execute("INSERT INTO candles (type, points) VALUES (?, ?)", (candle['type'], candle['points']))
    conn.commit()
    print("Saved to DB")

if __name__ == '__main__':
    create_table_if_not_exists()
    socketio.run(app, debug=True)
