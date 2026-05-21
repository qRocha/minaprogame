const grid = document.querySelector('#grid');
const bombCountSpan = document.querySelector('#bomb-count');
const difficultySelect = document.querySelector('#difficulty');
const resetBtn = document.querySelector('#reset-btn');
const timerSpan = document.querySelector('#timer');

// Elementos da Interface Cinemática
const introOverlay = document.querySelector('#intro-overlay');
const initSystemBtn = document.querySelector('#init-system-btn');
const loadingScreen = document.querySelector('#loading-screen');
const gameContainer = document.querySelector('.game-container');
const gameOverScreen = document.querySelector('#game-over-screen');
const winScreen = document.querySelector('#win-screen');

let width = 16;
let bombAmount = 40;
let squares = [];
let isGameOver = false;

let timerId = null;
let timeElapsed = 0;
let isTimerRunning = false;

const AudioCtx = window.AudioContext || window.webkitAudioContext;
let audioCtx;

const levels = {
    easy: { w: 8, b: 10 },
    medium: { w: 16, b: 40 },
    hard: { w: 24, b: 99 }
};

function initAudio() {
    if (!audioCtx) audioCtx = new AudioCtx();
}

// BIP SINTETIZADO DA INTRO
function playInterfaceBeep(freq, duration) {
    initAudio();
    const now = audioCtx.currentTime;
    const osc = audioCtx.createOscillator();
    const gain = audioCtx.createGain();
    
    osc.type = 'sine';
    osc.frequency.setValueAtTime(freq, now);
    gain.gain.setValueAtTime(0.15, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + duration);
    
    osc.connect(gain);
    gain.connect(audioCtx.destination);
    osc.start(now);
    osc.stop(now + duration);
}

// SOM DE EXPLOSÃO POTENTE (Grave + Ruído Bruto)
function playExplosionSound() {
    initAudio();
    const now = audioCtx.currentTime;

    const bufferSize = audioCtx.sampleRate * 2; 
    const buffer = audioCtx.createBuffer(1, bufferSize, audioCtx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) {
        data[i] = Math.random() * 2 - 1;
    }
    const noiseNode = audioCtx.createBufferSource();
    noiseNode.buffer = buffer;

    const noiseFilter = audioCtx.createBiquadFilter();
    noiseFilter.type = 'lowpass';
    noiseFilter.frequency.setValueAtTime(300, now);
    noiseFilter.frequency.exponentialRampToValueAtTime(10, now + 1.5);

    const noiseGain = audioCtx.createGain();
    noiseGain.gain.setValueAtTime(1.8, now); 
    noiseGain.gain.exponentialRampToValueAtTime(0.01, now + 1.8);

    noiseNode.connect(noiseFilter);
    noiseFilter.connect(noiseGain);
    noiseGain.connect(audioCtx.destination);

    const osc = audioCtx.createOscillator();
    const oscGain = audioCtx.createGain();
    
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(120, now); 
    osc.frequency.linearRampToValueAtTime(30, now + 0.5); 

    oscGain.gain.setValueAtTime(3.0, now); 
    oscGain.gain.exponentialRampToValueAtTime(0.01, now + 0.6);

    const oscFilter = audioCtx.createBiquadFilter();
    oscFilter.type = 'lowpass';
    oscFilter.frequency.setValueAtTime(150, now);

    osc.connect(oscFilter);
    oscFilter.connect(oscGain);
    oscGain.connect(audioCtx.destination);

    noiseNode.start(now);
    osc.start(now);
    osc.stop(now + 0.6);
}

function playVictoryMusic() {
    initAudio();
    const now = audioCtx.currentTime;
    const notes = [261.63, 329.63, 392.00, 523.25, 392.00, 523.25]; 
    const durations = [0.15, 0.15, 0.15, 0.3, 0.15, 0.6];
    let timeOffset = 0;

    notes.forEach((freq, index) => {
        const osc = audioCtx.createOscillator();
        const gain = audioCtx.createGain();
        osc.type = 'triangle';
        osc.frequency.setValueAtTime(freq, now + timeOffset);
        gain.gain.setValueAtTime(0.4, now + timeOffset);
        gain.gain.exponentialRampToValueAtTime(0.01, now + timeOffset + durations[index] - 0.02);
        osc.connect(gain);
        gain.connect(audioCtx.destination);
        osc.start(now + timeOffset);
        osc.stop(now + timeOffset + durations[index]);
        timeOffset += durations[index];
    });
}

// --- SEQUÊNCIAS CINEMATOGRÁFICAS DE BOTÕES ---
initSystemBtn.onclick = () => {
    initAudio();
    playInterfaceBeep(880, 0.1); // Som eletrônico de clique
    setTimeout(() => playInterfaceBeep(1200, 0.15), 120);

    // 1. Oculta painel de regras imediatamente
    introOverlay.classList.add('hidden');
    
    // 2. Aciona tela preta com logo de créditos (Duração de 2 segundos)
    setTimeout(() => {
        loadingScreen.classList.remove('hidden');
    }, 400);

    // 3. Libera o jogo após o término da barra e dos créditos
    setTimeout(() => {
        loadingScreen.classList.add('hidden');
        gameContainer.classList.remove('game-locked');
        
        // Ativa os seletores do jogo que estavam congelados
        difficultySelect.removeAttribute('disabled');
        resetBtn.removeAttribute('disabled');
        
        playInterfaceBeep(600, 0.3); // Confirmação de boot concluído
    }, 2500);
};

// --- ESTRUTURA PADRÃO DO CAMPO MINADO ---
function startTimer() {
    if (!isTimerRunning) {
        isTimerRunning = true;
        timerId = setInterval(() => { timeElapsed++; timerSpan.innerHTML = timeElapsed; }, 1000);
    }
}
function stopTimer() { clearInterval(timerId); isTimerRunning = false; }
function resetTimer() { stopTimer(); timeElapsed = 0; timerSpan.innerHTML = 0; }

function startGame() {
    const config = levels[difficultySelect.value];
    width = config.w;
    bombAmount = config.b;
    isGameOver = false;
    squares = [];
    grid.innerHTML = '';
    
    gameOverScreen.classList.remove('active');
    winScreen.classList.remove('active');
    bombCountSpan.innerHTML = bombAmount;
    grid.style.gridTemplateColumns = `repeat(${width}, 26px)`;

    resetTimer();
    createSmartBoard();
}

function createSmartBoard() {
    for (let i = 0; i < width * width; i++) {
        const square = document.createElement('div');
        square.setAttribute('id', i);
        square.classList.add('cell');
        square.dataset.type = 'valid';
        square.dataset.power = 'false';
        
        square.onclick = () => { if(!gameContainer.classList.contains('game-locked')) click(square); };
        square.oncontextmenu = (e) => { e.preventDefault(); if(!gameContainer.classList.contains('game-locked')) addFlag(square); };
        grid.appendChild(square);
        squares.push(square);
    }

    let bombsPlaced = 0;
    while (bombsPlaced < bombAmount) {
        let randomId = Math.floor(Math.random() * squares.length);
        if (squares[randomId].dataset.type !== 'bomb') {
            let neighborBombs = 0;
            getNeighbors(randomId, 1).forEach(n => { if (squares[n].dataset.type === 'bomb') neighborBombs++; });
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
            getNeighbors(i, 1).forEach(n => { if (squares[n].dataset.type === 'bomb') total++; });
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
        } else {
            getNeighbors(parseInt(square.id), 1).forEach(nIndex => click(squares[nIndex]));
        }
    }
    checkWin();
}

function activateRadarPower(centerId) {
    const closeArea = getNeighbors(centerId, 2);
    closeArea.forEach(nIndex => {
        const targetSquare = squares[nIndex];
        if (targetSquare.dataset.type === 'bomb' && !targetSquare.classList.contains('revealed')) {
            targetSquare.innerHTML = '💥';
            targetSquare.style.opacity = '0.4';
            setTimeout(() => {
                if (!isGameOver && !targetSquare.classList.contains('revealed')) {
                    targetSquare.innerHTML = targetSquare.classList.contains('flag') ? '🚩' : '';
                    targetSquare.style.opacity = '1';
                }
            }, 3000);
        }
    });
}

function addFlag(square) {
    if (isGameOver || square.classList.contains('revealed')) return;
    startTimer();
    square.classList.toggle('flag');
    square.innerHTML = square.classList.contains('flag') ? '🚩' : '';
}

function checkWin() {
    let matches = 0;
    squares.forEach(s => { if (s.classList.contains('revealed') && s.dataset.type === 'valid') matches++; });
    if (matches === (width * width - bombAmount)) {
        isGameOver = true;
        stopTimer();
        winScreen.classList.add('active');
        playVictoryMusic();
    }
}

function gameOver() {
    isGameOver = true;
    stopTimer();
    gameOverScreen.classList.add('active');
    playExplosionSound();
    squares.forEach(s => {
        if (s.dataset.type === 'bomb') {
            s.innerHTML = '💥';
            s.classList.add('revealed', 'bomb');
        }
    });
}

difficultySelect.onchange = startGame;
resetBtn.onclick = startGame;
gameOverScreen.onclick = startGame;
winScreen.onclick = startGame;

startGame();
