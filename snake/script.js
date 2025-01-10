const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');

const gridSize = 20;
const tileCount = canvas.width / gridSize;

let snake = [{ x: 10, y: 10 }];
let food = { x: 5, y: 5 };
let dx = gridSize;
let dy = 0;
let score = 0;

function drawTile(x, y, color) {
    ctx.fillStyle = color;
    ctx.fillRect(x * gridSize, y * gridSize, gridSize, gridSize);
}

function drawSnake() {
    snake.forEach(segment => drawTile(segment.x, segment.y, 'green'));
}

function moveSnake() {
    const head = { x: snake[0].x + dx / gridSize, y: snake[0].y + dy / gridSize };
    snake.unshift(head);
    if (head.x === food.x && head.y === food.y) {
        score++;
        placeFood();
    } else {
        snake.pop();
    }
}

function drawFood() {
    drawTile(food.x, food.y, 'red');
}

function placeFood() {
    food.x = Math.floor(Math.random() * tileCount);
    food.y = Math.floor(Math.random() * tileCount);
}

function checkCollision() {
    const head = snake[0];
    if (head.x < 0 || head.x >= tileCount || head.y < 0 || head.y >= tileCount) {
        return true;
    }
    for (let i = 1; i < snake.length; i++) {
        if (head.x === snake[i].x && head.y === snake[i].y) {
            return true;
        }
    }
    return false;
}

function gameLoop() {
    if (checkCollision()) {
        alert('Game Over');
        document.location.reload();
    } else {
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        moveSnake();
        drawSnake();
        drawFood();
    }
}

function changeDirection(event) {
    if (event.keyCode === 37 && dx === 0) { // Left arrow key
        dx = -gridSize;
        dy = 0;
    } else if (event.keyCode === 38 && dy === 0) { // Up arrow key
        dx = 0;
        dy = -gridSize;
    } else if (event.keyCode === 39 && dx === 0) { // Right arrow key
        dx = gridSize;
        dy = 0;
    } else if (event.keyCode === 40 && dy === 0) { // Down arrow key
        dx = 0;
        dy = gridSize;
    }
}

document.addEventListener('keydown', changeDirection);
setInterval(gameLoop, 100);
