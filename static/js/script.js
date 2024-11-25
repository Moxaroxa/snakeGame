const socket = io();
const gamePlane = document.getElementById('gamePlane');
const ctx = gamePlane.getContext('2d');


document.addEventListener('keydown', function(event) {
    if (event.key === "ArrowUp" || event.key === "ArrowDown" || event.key === "ArrowLeft" || event.key === "ArrowRight") {
        event.preventDefault();
    }
});



socket.on("initialize_candles", (candleState) => {

    candleState.forEach(candle => {
        if (candle.type === "green") {
            addGreenCandle(candle.points);
        } else if (candle.type === "red") {
            addRedCandle(candle.points);
        }
    });
});





const canvas = document.getElementById("marketCanvas");
const ctx2 = canvas.getContext("2d");

let candles = []; 
const candleWidth = 20; 
const maxCandleHeight = 200; 
let candleOffset = 0; 
let lastEndY = canvas.height; 

let yOffset = 0; 
let xOffset = 0; 

let activeCandle = null; 


function addGreenCandle(points) {
    const candleHeight = points * 5;

    if (activeCandle && activeCandle.type === "red") {
       
        activeCandle.height -= candleHeight;

        if (activeCandle.height <= 0) {
           
            candles.pop();
            activeCandle = null;
        }
    } else {
        if (!activeCandle || activeCandle.type !== "green") {
            
            activeCandle = {
                type: "green",
                height: 0,
                startY: lastEndY,
                offsetX: candleOffset
            };
            candles.push(activeCandle);
        }

       
        activeCandle.height += candleHeight;
        activeCandle.startY -= candleHeight;

      
        if (activeCandle.height >= maxCandleHeight) {
           
            candleOffset += 30;
            lastEndY = activeCandle.startY;
            activeCandle = null; 
        }
    }

    adjustView();
    renderMarket(); 
}

function addRedCandle(points) {
    const candleHeight = points * 5; 

    if (activeCandle && activeCandle.type === "green") {
        
        const consumedHeight = Math.min(activeCandle.height, candleHeight);

        activeCandle.height -= consumedHeight;

        const redCandle = {
            type: "red",
            height: consumedHeight,
            startY: activeCandle.startY + activeCandle.height,
            offsetX: activeCandle.offsetX
        };
        candles.push(redCandle);

        if (activeCandle.height <= 0) {
            candles.pop();
            activeCandle = null;
        }
    } else {
        if (!activeCandle || activeCandle.type !== "red") {
            
            activeCandle = {
                type: "red",
                height: 0,
                startY: lastEndY,
                offsetX: candleOffset
            };
            candles.push(activeCandle);
        }

        activeCandle.height += candleHeight;

        if (activeCandle.height >= maxCandleHeight) {
           
            candleOffset += 30;
            lastEndY = activeCandle.startY + activeCandle.height;
            activeCandle = null; 
        }
    }

    adjustView(); 
    renderMarket(); 
}

function adjustView() {
    const highestCandleY = candles.reduce((minY, candle) => {
        return Math.min(minY, candle.startY) - 50;
    }, canvas.height);

    const lowestCandleY = candles.reduce((maxY, candle) => {
        return Math.max(maxY, candle.startY + candle.height)+50;
    }, 0);

    const farthestRight = candles.reduce((maxX, candle) => {
        return Math.max(maxX, candle.offsetX + candleWidth);
    }, 0);

   
    if (highestCandleY < yOffset) {
        
        yOffset += highestCandleY; 
    }

    if (lowestCandleY > canvas.height + yOffset) {
        yOffset += (lowestCandleY - canvas.height); 
    }

   
    if (farthestRight > canvas.width + xOffset) {

        xOffset += (farthestRight - (canvas.width + xOffset));
    }

    if (candles[0]?.offsetX - xOffset < 0) {
        xOffset = Math.max(0, candles[0].offsetX); 
    }
}

function drawCandle(x, y, width, height, color) {
    ctx2.fillStyle = color;
    ctx2.fillRect(x, y, width, height);
}

function renderMarket() {
    ctx2.clearRect(0, 0, canvas.width, canvas.height);

    candles.forEach(candle => {
        let x = candle.offsetX - xOffset;
        let y = candle.startY - yOffset; 
        drawCandle(x, y, candleWidth, candle.height, candle.type === "green" ? "green" : "red");
    });
}

socket.on("player_died", (data) => {
    
    // Restart the game
    
    document.getElementById('startMenu').style.display = 'block';

    if (data && data.points) {
        addRedCandle(data.points); 
        

    } else {
        console.log("No points data for player death event.");
    }
});


socket.on("player_ate_point", (data) => {
    if (data && data.points) {
        addGreenCandle(data.points);
       
    } else {
        console.log("No points data for player ate event.");
    }
});



const canvasWidth = 1000;
const canvasHeight = 550;
const desiredCellSize = 20; 

const gridSizeX = Math.floor(canvasWidth / desiredCellSize);  
const gridSizeY = Math.floor(canvasHeight / desiredCellSize);  
const cellSize = canvasWidth / gridSizeX; 

// Set the canvas size
gamePlane.width = canvasWidth;
gamePlane.height = canvasHeight;

let players = {};  
let myId = null;  
let apple = null; 

let appleOffsetY = 0; 
const floatingAmplitude = 2;
const floatingSpeed = 0.5; 

window.onload = function() {
    
    fetch('/get_all_messages')
        .then(response => response.json())
        .then(data => {
            data.messages.forEach(item => {
                const msg = item;
                const body = document.getElementById("chat-body");
                const h2 = document.createElement('h2');
                h2.innerHTML = msg;
                h2.classList.add("sb1");
                body.appendChild(h2);
                body.scrollTop = body.scrollHeight;

            });
        })
        .catch(error => console.error('Error fetching image results:', error));
};

document.getElementById('message').addEventListener('keydown', (event) => {
    if (event.key === 'Enter') { 
        const input = document.getElementById('message');
        socket.send(input.value);
        input.value = '';
    }

});



document.getElementById('startMenu').style.display = 'block';

document.getElementById('startButton').addEventListener('click', () => {

    playerName = document.getElementById('playerName').value.trim();
    snakeColor = document.getElementById('snakeColor').value;
    playerName = playerName.slice(0, 6);

    if (!playerName) {
      alert('Please enter a name!');
      return;
    }

    document.getElementById('startMenu').style.display = 'none';
    socket.emit('join_game', { name: playerName, color: snakeColor });
  });

socket.on('connect', () => {
  console.log('Connected to server');
});

socket.on('player_joined', (data) => {
  players = data.players;
  myId = data.id;  
  apple = data.apple;  
  renderGame();
  
});

socket.on('load_candles', (data) => {
    candles = data.candles;
    console.log(candles.length);
});


socket.on('new_message', function(data) {
    console.log("Something new was added :)");
    const body = document.getElementById("chat-body");
    const h2 = document.createElement('h2');
    h2.innerHTML = data.message;
    h2.classList.add("sb1");
    body.appendChild(h2);
    body.scrollTop = body.scrollHeight;

   
});

socket.on('player_left', (data) => {
  delete players[data.id];
  renderGame();
});

socket.on('update', (data) => {
  players = data.players;
  apple = data.apple; 

  // Update leaderboard dynamically
  updateLeaderboard();

  renderGame();
});


function updateLeaderboard() {
    const leaderboardList = document.getElementById('leader_list');
    leaderboardList.innerHTML = ''; 

    const sortedPlayers = Object.values(players).sort((a, b) => (b.points || 0) - (a.points || 0));

    sortedPlayers.slice(0, 4).forEach((player, index) => {
        const h2 = document.createElement('h2');
        h2.innerHTML = `<span>${index + 1}</span> ${player.name} <span style=color"${player.color}">(${player.points || 0}p)</span>`;
        leaderboardList.appendChild(h2);
    });
}

document.addEventListener('keydown', (event) => {
  // Prevent opposite direction
  if (event.key === 'ArrowUp' && players[myId].direction !== 'DOWN') {
    players[myId].nextDirection = 'UP';
  } else if (event.key === 'ArrowDown' && players[myId].direction !== 'UP') {
    players[myId].nextDirection = 'DOWN';
  } else if (event.key === 'ArrowLeft' && players[myId].direction !== 'RIGHT') {
    players[myId].nextDirection = 'LEFT';
  } else if (event.key === 'ArrowRight' && players[myId].direction !== 'LEFT') {
    players[myId].nextDirection = 'RIGHT';
  }

  socket.emit('update_direction', { direction: players[myId].nextDirection });
});


function renderGame() {
    ctx.clearRect(0, 0, gamePlane.width, gamePlane.height);  

    for (const id in players) {
        const snake = players[id].body;  
        const playerColor = players[id].color;  
        const playerName = players[id].name;  

        ctx.fillStyle = playerColor;  

        for (const segment of snake) {
            const x = segment[0];  
            const y = segment[1];  
            ctx.fillRect(x * cellSize, y * cellSize, cellSize, cellSize);
        }

        const headX = snake[0][0];  
        const headY = snake[0][1];  
        const nameOffset = 0;  

        ctx.font = '14px Arial';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'bottom';  

        
        ctx.fillStyle = 'transparent';  
        ctx.fillRect(headX * cellSize, (headY + nameOffset) * cellSize - 5, cellSize, 20); 

     
        ctx.fillStyle = 'white'; 
        ctx.fillText(playerName, headX * cellSize + cellSize / 2, (headY + nameOffset) * cellSize);
    }

    
    const appleX = apple[0];  
    const appleY = apple[1];  
    
    appleOffsetY = Math.sin(Date.now() * floatingSpeed) * floatingAmplitude;

    const radius = cellSize * 0.2;  

    
    ctx.fillStyle = '#21eb21';

    
    ctx.beginPath();
    ctx.moveTo(appleX * cellSize + radius, appleY * cellSize + appleOffsetY); 
    ctx.lineTo(appleX * cellSize + cellSize - radius, appleY * cellSize + appleOffsetY); 
    ctx.arcTo(appleX * cellSize + cellSize, appleY * cellSize + appleOffsetY, appleX * cellSize + cellSize, appleY * cellSize + cellSize + appleOffsetY, radius); 
    ctx.lineTo(appleX * cellSize + cellSize, appleY * cellSize + cellSize - radius + appleOffsetY);
    ctx.arcTo(appleX * cellSize + cellSize, appleY * cellSize + cellSize + appleOffsetY, appleX * cellSize + cellSize - radius, appleY * cellSize + cellSize + appleOffsetY, radius); 
    ctx.lineTo(appleX * cellSize + radius, appleY * cellSize + cellSize + appleOffsetY);  
    ctx.arcTo(appleX * cellSize, appleY * cellSize + cellSize + appleOffsetY, appleX * cellSize, appleY * cellSize + cellSize - radius + appleOffsetY, radius); 
    ctx.lineTo(appleX * cellSize, appleY * cellSize + radius + appleOffsetY); 
    ctx.arcTo(appleX * cellSize, appleY * cellSize + appleOffsetY, appleX * cellSize + radius, appleY * cellSize + appleOffsetY, radius); 
    ctx.closePath();  

    ctx.fill();
}

// Game loop
function gameLoop() {
  socket.emit('tick');  
  setTimeout(gameLoop, 100); 
}

gameLoop();  
