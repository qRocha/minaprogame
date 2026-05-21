const grid = document.querySelector('#grid');
const bombCountSpan = document.querySelector('#bomb-count');
const difficultySelect = document.querySelector('#difficulty');
const resetBtn = document.querySelector('#reset-btn');
const timerSpan = document.querySelector('#timer'); // Elemento do cronômetro

let width = 16;
let bombAmount = 40;
let squares = [];
let isGameOver = false;

// Variáveis do Cronômetro
let timerId = null;
let timeElapsed = 0;
let isTimerRunning = false;

const levels = {
    easy: { w: 8, b: 10 },
    medium: { w: 16, b: 40 },
    hard: { w: 24, b: 99 }
};

function startTimer() {
    if (!isTimerRunning) {
        isTimerRunning = true;
        timerId = setInterval(() => {
            timeElapsed++;
            timerSpan.innerHTML = timeElapsed;
        }, 1000);
    }
}

function stopTimer() {
    clearInterval(timerId);
    isTimerRunning = false;
}

function resetTimer() {
    stopTimer();
    timeElapsed = 0;
    timerSpan.innerHTML = 0;
}

function startGame() {
    const config = levels[difficultySelect.value];
    width = config.w;
    bombAmount = config.b;
    isGameOver = false;
    squares = [];
    grid.innerHTML = '';
    resetBtn.innerHTML = '😊';
    bombCountSpan.innerHTML = bombAmount;
    grid.style.gridTemplateColumns = `repeat(${width}, 25px)`;

    resetTimer(); // Garante que o tempo zera no novo jogo
    createSmartBoard();
}

function createSmartBoard() {
    for (let i = 0; i < width * width; i++) {
        const square = document.createElement('div');
        square.setAttribute('id', i);
        square.classList.add('cell');
        square.dataset.type = 'valid';
        square.dataset.power = 'false';
        
        square.onclick = () => click(square);
        square.oncontextmenu = (e) => { e.preventDefault(); addFlag(square); };
        grid.appendChild(square);
        squares.push(square);
    }

    let bombsPlaced = 0;
    while (bombsPlaced < bombAmount) {
        let randomId = Math.floor(Math.random() * squares.length);
        
        if (squares[randomId].dataset.type !== 'bomb') {
            let neighborBombs = 0;
            const neighbors = getNeighbors(randomId, 1);
            
            neighbors.forEach(n => {
                if (squares[n].dataset.type === 'bomb') neighborBombs++;
            });

            if (neighborBombs < 2 || Math.random() > 0.8) {
                squares[randomId].dataset.type = 'bomb';
                bombsPlaced++;
            }
        }
    }

    let powerUpsPlaced = 0;
    let maxPowerUps = width === 8 ? 2 : width === 16 ? 5 : 8;
    while (powerUpsPlaced < maxPowerUps) {
        let randomId = Math.floor(Math.random() * squares.length);
        if (squares[randomId].dataset.type === 'valid' && squares[randomId].dataset.power === 'false') {
            squares[randomId].dataset.power = 'true';
            powerUpsPlaced++;
        }
    }

    for (let i = 0; i < squares.length; i++) {
        if (squares[i].dataset.type === 'valid') {
            let total = 0;
            getNeighbors(i, 1).forEach(n => {
                if (squares[n].dataset.type === 'bomb') total++;
            });
            squares[i].dataset.total = total;
        }
    }
}

function getNeighbors(i, radius = 1) {
    const neighbors = [];
    const row = Math.floor(i / width);
    const col = i % width;

    for (let x = -radius; x <= radius; x++) {
        for (let y = -radius; y <= radius; y++) {
            if (x === 0 && y === 0) continue;
            const newRow = row + x;
            const newCol = col + y;
            if (newRow >= 0 && newRow < width && newCol >= 0 && newCol < width) {
                neighbors.push(newRow * width + newCol);
            }
        }
    }
    return neighbors;
}

function click(square) {
    if (isGameOver || square.classList.contains('revealed') || square.classList.contains('flag')) return;

    // Dispara o cronômetro no primeiro clique válido do jogador
    startTimer();

    if (square.dataset.type === 'bomb') {
        gameOver();
    } else {
        if (square.dataset.power === 'true') {
            activateRadarPower(parseInt(square.id));
            square.dataset.power = 'false';
        }

        let total = square.dataset.total;
        square.classList.add('revealed');
        
        if (total != 0) {
            square.innerHTML = total;
            square.classList.add(`n${total}`);
            const colors = ['', '#0000FF', '#008000', '#FF0000', '#000080', '#800000', '#008080', '#000000', '#808080'];
            square.style.color = colors[total];
        } else {
            getNeighbors(parseInt(square.id), 1).forEach(nIndex => click(squares[nIndex]));
        }
    }
    checkWin();
}

function activateRadarPower(centerId) {
    const closeArea = getNeighbors(centerId, 2);
    
    resetBtn.innerHTML = '⚡';
    setTimeout(() => { if(!isGameOver) resetBtn.innerHTML = '😊'; }, 1000);

    closeArea.forEach(nIndex => {
        const targetSquare = squares[nIndex];
        if (targetSquare.dataset.type === 'bomb' && !targetSquare.classList.contains('revealed')) {
            targetSquare.innerHTML = '💣';
            targetSquare.style.opacity = '0.4';
            targetSquare.style.backgroundColor = '#e74c3c';

            setTimeout(() => {
                if (!isGameOver && !targetSquare.classList.contains('revealed')) {
                    targetSquare.innerHTML = targetSquare.classList.contains('flag') ? '🚩' : '';
                    targetSquare.style.opacity = '1';
                    targetSquare.style.backgroundColor = '';
                }
            }, 3000);
        }
    });
}

function addFlag(square) {
    if (isGameOver || square.classList.contains('revealed')) return;
    
    // Inicia o tempo também se colocar uma bandeira primeiro
    startTimer();

    if (!square.classList.contains('flag')) {
        square.classList.add('flag');
        square.innerHTML = '🚩';
    } else {
        square.classList.remove('flag');
        square.innerHTML = '';
    }
}

function checkWin() {
    let matches = 0;
    for (let i = 0; i < squares.length; i++) {
        if (squares[i].classList.contains('revealed') && squares[i].dataset.type === 'valid') {
            matches++;
        }
    }
    // Se o jogador revelou todas as casas que não são bombas
    if (matches === (width * width - bombAmount)) {
        isGameOver = true;
        stopTimer();
        resetBtn.innerHTML = '😎';
        alert('Parabéns! Você venceu!');
    }
}

function gameOver() {
    isGameOver = true;
    stopTimer(); // Para o tempo no Game Over
    resetBtn.innerHTML = '😵';
    squares.forEach(s => {
        if (s.dataset.type === 'bomb') {
            s.innerHTML = '💣';
            s.style.opacity = '1';
            s.classList.add('revealed', 'bomb');
        }
    });
}

difficultySelect.onchange = startGame;
resetBtn.onclick = startGame;
startGame();