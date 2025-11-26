import { initializeApp } from "https://www.gstatic.com/firebasejs/12.6.0/firebase-app.js";
import { getDatabase, ref, push, set, onValue } from "https://www.gstatic.com/firebasejs/12.6.0/firebase-database.js";


// Firebase 초기화
const firebaseConfig = {
    apiKey: "AIzaSyA76Bhz4t6DiQG04GipuNIQcJ-zOn2pYrk",
    authDomain: "escapeocean-b0156.firebaseapp.com",
    projectId: "escapeocean-b0156",
    storageBucket: "escapeocean-b0156.firebasestorage.app",
    messagingSenderId: "490435285158",
    appId: "1:490435285158:web:c69fef4b33bca5479ee467",
    measurementId: "G-V8WPWNMHQD"
};
const app = initializeApp(firebaseConfig);
const db = getDatabase(app, "https://escapeocean-b0156-default-rtdb.asia-southeast1.firebasedatabase.app");

// === 상태 변수 ===
let isGameRunning = false;
let gameTimer = 0;
let scrollPosition = 0;
let clickCount = 0;
let velocity = 0;

// 물리 상수
const GRAVITY = -0.3;
const BUOYANCY = 9;
const MAX_VELOCITY = 40;

// 게임 상수
const MAX_TIME = 20;
const FIXED_MAX_DEPTH = 10984;
let MAX_GAME_HEIGHT = FIXED_MAX_DEPTH;

// 아이템 데이터
const ITEMS = [
    { name: '산소통', class: 'oxygen-pouch', time_add: 2, rarity: 0.6 },
    { name: '오리발 부스터', class: 'booster', time_add: 3, rarity: 0.3 },
    { name: '행운의 불가사리', class: 'lucky-star', time_add: 8, rarity: 0.1 }
];
const ITEM_SPAWN_INTERVAL = 3000;
const ITEM_MOVE_SPEED = 2;

// DOM 참조
let gameContainer, oceanScroll, survivalFill, altitudeValue;
let gameEndScreen, restartButton, endMessage, finalScore, clickCountValue;
let itemSpawnArea, playerNameInput, submitNameButton, nameInputSection;
let oceanImage;

// 플레이어 이름 DOM 관리
const playerElements = {};

// --- 초기화 ---
window.addEventListener('load', () => {
    gameContainer = document.getElementById('game-container');
    oceanScroll = document.getElementById('ocean-scroll');
    survivalFill = document.getElementById('survival-fill');
    altitudeValue = document.getElementById('altitude-value');
    gameEndScreen = document.getElementById('game-end-screen');
    restartButton = document.getElementById('restart-button');
    endMessage = document.getElementById('end-message');
    finalScore = document.getElementById('final-score');
    clickCountValue = document.getElementById('click-count-value');
    itemSpawnArea = document.getElementById('item-spawn-area');
    playerNameInput = document.getElementById('player-name');
    submitNameButton = document.getElementById('submit-name');
    nameInputSection = document.getElementById('name-input-section');
    oceanImage = document.getElementById('ocean-image');

    if (gameContainer) {
        gameContainer.addEventListener('click', handleAscent);
        gameContainer.addEventListener('touchstart', handleAscent);
    }
    if (submitNameButton) {
        submitNameButton.addEventListener('click', onSubmitName);
    }
    if (restartButton) {
        restartButton.addEventListener('click', initializeGame);
    }

    if (oceanImage && !oceanImage.complete) {
        oceanImage.addEventListener('load', initializeGame);
    } else {
        initializeGame();
    }
});

// --- 게임 초기화 ---
function initializeGame() {
    const imgHeight = oceanImage ? (oceanImage.naturalHeight || FIXED_MAX_DEPTH) : FIXED_MAX_DEPTH;
    const containerHeight = gameContainer ? gameContainer.clientHeight : 0;
    MAX_GAME_HEIGHT = Math.max(0, imgHeight - containerHeight);

    isGameRunning = true;
    gameTimer = MAX_TIME;
    scrollPosition = 0;
    clickCount = 0;
    velocity = 0;

    if (gameEndScreen) gameEndScreen.classList.add('hidden');
    if (nameInputSection) nameInputSection.style.display = 'none';
    if (oceanScroll) oceanScroll.style.transform = `translateY(0px)`;
    if (itemSpawnArea) itemSpawnArea.innerHTML = '';

    updateUI();

    setInterval(gameLoop, 1000);
    setInterval(spawnItem, ITEM_SPAWN_INTERVAL);
    requestAnimationFrame(applyPhysics);
    requestAnimationFrame(animateItems);

}

// --- 게임 루프 ---
function gameLoop() {
    if (!isGameRunning) return;
    gameTimer--;
    if (gameTimer <= 0) {
        gameTimer = 0;
        gameOver("시간 초과! \n 산소가 모두 소진되었습니다...");
    }
    updateUI();
}

// --- 물리 적용 ---
function applyPhysics() {
    if (!isGameRunning) return;

    velocity += GRAVITY;
    velocity = Math.max(Math.min(velocity, MAX_VELOCITY), -MAX_VELOCITY);

    scrollPosition += velocity;
    scrollPosition = Math.max(0, Math.min(scrollPosition, MAX_GAME_HEIGHT));

    if (scrollPosition >= MAX_GAME_HEIGHT) {
        gameOver("✨ HIDDEN ENDING! 수면 위로 떠올랐습니다! ✨", true);
        return;
    }

    updateBackgroundScroll();
    updateUI();
    requestAnimationFrame(applyPhysics);
}

// --- 클릭 상승 ---
function handleAscent() {
    if (!isGameRunning) return;
    clickCount++;
    if (clickCountValue) clickCountValue.textContent = clickCount.toLocaleString();

    velocity = BUOYANCY;
    updateBackgroundScroll();
    updateUI();
}

// --- UI 업데이트 ---
function updateUI() {
    if (!survivalFill || !altitudeValue) return;

    let gaugePercentage = (gameTimer / MAX_TIME) * 100;
    gaugePercentage = Math.min(100, Math.max(0, gaugePercentage));
    survivalFill.style.width = `${gaugePercentage}%`;

    let scrollRatio = MAX_GAME_HEIGHT > 0 ? scrollPosition / MAX_GAME_HEIGHT : 1;
    let calculatedAltitude = Math.round(-FIXED_MAX_DEPTH * (1 - scrollRatio));
    if (calculatedAltitude >= 0) calculatedAltitude = 0;
    altitudeValue.textContent = `${calculatedAltitude} m`;
}


// --- 배경 스크롤 ---
function updateBackgroundScroll() {
    if (!oceanScroll) return;
    oceanScroll.style.transform = `translateY(${scrollPosition}px)`;
}

// --- 게임 종료 ---
function triggerHiddenEnding() {
    if (!gameContainer) return;

    // 흰색 배경 div
    const whiteDiv = document.createElement('div');
    whiteDiv.classList.add('hidden-white');
    gameContainer.appendChild(whiteDiv);

    // 흰색 div 페이드인
    requestAnimationFrame(() => whiteDiv.classList.add('fade-in'));

    // 1초 후 바다 이미지 등장
    setTimeout(() => {
        const oceanImg = document.createElement('img');
        oceanImg.src = 'assets/ocean-end.png';
        oceanImg.classList.add('hidden-ocean');
        gameContainer.appendChild(oceanImg);

        requestAnimationFrame(() => {
            whiteDiv.classList.remove('fade-in');
            oceanImg.classList.add('fade-in');
        });

        // 2.5초 뒤 히든 엔딩 메시지
        setTimeout(() => {
            if (endMessage) {
                endMessage.textContent = "✨ HIDDEN ENDING! 바다 위 세상에 도달했습니다! ✨";
                endMessage.style.opacity = '1'; // fade-in 유지
                endMessage.style.display = 'block';
            }
            if (nameInputSection) {
                nameInputSection.classList.remove('hidden');
            }
        }, 2500);

    }, 1000);
}

if (submitNameButton) {
    submitNameButton.addEventListener('click', () => {
        const name = playerNameInput.value.trim();
        if (!name) return;

        const score = Math.round(scrollPosition / MAX_GAME_HEIGHT * FIXED_MAX_DEPTH);

        // Firebase 저장
        saveScoreFirebase(name, score);

        // 화면 표시
        displayPlayerName(name, score);

        // 입력창 숨기기
        playerNameInput.value = '';
        if (nameInputSection) nameInputSection.style.display = 'none';
    });
}

function gameOver(message, isWin = false) {
    isGameRunning = false;

    if (isWin) {
        if (gameEndScreen) gameEndScreen.classList.add('hidden');
        triggerHiddenEnding();
        return;
    }

    if (gameEndScreen) gameEndScreen.classList.remove('hidden');

    // 일반 종료
    if (endMessage) endMessage.textContent = message;
    if (finalScore) {
        let finalAltitude = Math.round(-FIXED_MAX_DEPTH + (scrollPosition / MAX_GAME_HEIGHT) * FIXED_MAX_DEPTH);
        finalScore.textContent = `최종 고도: ${finalAltitude} m / 클릭: ${clickCount.toLocaleString()}회`;
    }
    if (nameInputSection) nameInputSection.style.display = 'block';
}


// --- 아이템 ---
function spawnItem() {
    if (!isGameRunning || !itemSpawnArea) return;
    const rand = Math.random();
    let itemToSpawn = null;
    let cumulative = 0;
    for (const item of ITEMS) {
        cumulative += item.rarity;
        if (rand < cumulative) { itemToSpawn = item; break; }
    }
    if (!itemToSpawn) return;

    const itemEl = document.createElement('div');
    itemEl.classList.add('game-item', itemToSpawn.class);
    itemEl.dataset.time_add = itemToSpawn.time_add;

    const containerWidth = gameContainer ? gameContainer.clientWidth : 300;
    itemEl.style.left = Math.random() * Math.max(0, containerWidth - 50) + 'px';
    itemEl.style.top = '-50px';

    itemEl.addEventListener('click', handleItemClick);
    itemSpawnArea.appendChild(itemEl);
}

function handleItemClick(event) {
    if (!isGameRunning) return;
    const el = event.currentTarget;
    const timeAdd = parseFloat(el.dataset.time_add) || 0;
    gameTimer += timeAdd;

    if (el.classList.contains('booster')) {
        velocity = Math.max(velocity, BUOYANCY * 1.4);
    }
    el.remove();
    updateUI();
    event.stopPropagation();
}

function animateItems() {
    if (!isGameRunning) return;
    const items = itemSpawnArea.querySelectorAll('.game-item');
    const containerHeight = gameContainer.clientHeight;
    items.forEach(el => {
        let top = parseFloat(el.style.top) || 0;
        top += ITEM_MOVE_SPEED;
        el.style.top = top + 'px';
        if (top > containerHeight) el.remove();
    });
    requestAnimationFrame(animateItems);
}

// --- 이름 제출 ---
function onSubmitName() {
    const name = playerNameInput.value.trim();
    if (!name) return;

    const score = Math.round(scrollPosition / MAX_GAME_HEIGHT * FIXED_MAX_DEPTH);
    saveScoreFirebase(name, score);
    displayPlayerName(name, score);

    playerNameInput.value = '';
    if (nameInputSection) nameInputSection.style.display = 'none';
}

// --- Firebase 저장 ---
function saveScoreFirebase(name, score) {
    const scoresRef = ref(db, 'scores');
    const newScoreRef = push(scoresRef);
    set(newScoreRef, { name, score, timestamp: Date.now() });
}


/*
// --- 화면 표시 ---
function displayPlayerName(name, score) {
    if (playerElements[name]) return;
    const el = document.createElement('div');
    el.className = 'player-name';
    el.textContent = name;
    el.style.position = 'absolute';
    el.style.left = `${Math.random() * 80 + 10}%`;
    oceanScroll.appendChild(el);
    playerElements[name] = el;

    const scrollHeight = oceanScroll.scrollHeight; // 실제 이미지 높이
    const bottomPixels = Math.round((score / FIXED_MAX_DEPTH) * scrollHeight);

    el.style.bottom = `${bottomPixels}px`;

}

// --- 명예의 전당 실시간 표시 ---
const scoresRef = ref(db, 'scores');
onValue(scoresRef, snapshot => {
    const data = snapshot.val();
    if (!data) return;
    const entries = Object.values(data).sort((a, b) => b.score - a.score);
    entries.forEach(entry => displayPlayerName(entry.name, entry.score));
});

*/

if (submitNameButton) {
    submitNameButton.addEventListener('click', () => {
        const name = playerNameInput.value.trim();
        if (!name) return;

        const score = Math.round(scrollPosition / MAX_GAME_HEIGHT * FIXED_MAX_DEPTH);

        // Firebase 저장 (있으면)
        saveScoreFirebase(name, score);

        // 화면에 표시
        displayPlayerName(name, score);

        // 입력창 초기화 및 숨기기
        playerNameInput.value = '';
        if (nameInputSection) nameInputSection.style.display = 'none';
    });
}




