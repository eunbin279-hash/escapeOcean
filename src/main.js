import { initializeApp } from "https://www.gstatic.com/firebasejs/12.6.0/firebase-app.js";
import { getDatabase, ref, push, set, onValue } from "https://www.gstatic.com/firebasejs/12.6.0/firebase-database.js";

// Firebase 초기화
const firebaseConfig = {
    apiKey: "AIzaSyA76Bhz4t6DiQG04GipuNIQcJ-zOn2pYrk",
    authDomain: "escapeocean-b0156.firebaseapp.com",
    databaseURL: "https://escapeocean-b0156-default-rtdb.asia-southeast1.firebasedatabase.app",
    projectId: "escapeocean-b0156",
    storageBucket: "escapeocean-b0156.appspot.com",
    messagingSenderId: "490435285158",
    appId: "1:490435285158:web:c69fef4b33bca5479ee467",
};
const app = initializeApp(firebaseConfig);
const db = getDatabase(app);

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

// 아이템
const ITEMS = [
    { name: '산소통', class: 'oxygen-pouch', time_add: 2, rarity: 0.4 },
    { name: '오리발 부스터', class: 'booster', time_add: 3, rarity: 0.2 },
    { name: '행운의 불가사리', class: 'lucky-star', time_add: 8, rarity: 0.05 }
];
const ITEM_SPAWN_INTERVAL = 3000;
const ITEM_MOVE_SPEED = 2;

// DOM
let gameContainer, oceanScroll, survivalFill, altitudeValue;
let gameEndScreen, restartButton, endMessage, finalScore, clickCountValue;
let itemSpawnArea, playerNameInput, submitNameButton, nameInputSection;
let oceanImage;

// 플레이어 이름 관리
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

    loadScores();

    if (gameContainer) {
        gameContainer.addEventListener('click', handleAscent);
    }
    if (submitNameButton) submitNameButton.addEventListener('click', onSubmitName);
    if (restartButton) restartButton.addEventListener('click', initializeGame);

    if (oceanImage && !oceanImage.complete) {
        oceanImage.addEventListener('load', initializeGame);
    } else {
        initializeGame();
    }
});

// --- 게임 초기화 ---
function initializeGame() {
    // 기존 히든엔딩/오버레이 제거
    document.querySelectorAll('.hidden-white, .hidden-ocean').forEach(el => el.remove());

    if (nameInputSection) {
        nameInputSection.style.display = 'none';
        nameInputSection.style.zIndex = 0;             // ★ 초기화
        nameInputSection.style.pointerEvents = 'auto'; // ★ 초기화
    }

    isGameRunning = true;
    gameTimer = MAX_TIME;
    scrollPosition = 0;
    clickCount = 0;
    velocity = 0;

    if (gameEndScreen) gameEndScreen.classList.add('hidden');
    if (nameInputSection) nameInputSection.style.display = 'none';
    if (oceanScroll) oceanScroll.style.transform = 'translateY(0px)';
    if (itemSpawnArea) itemSpawnArea.innerHTML = '';

    updateUI();

    // 루프 및 아이템 애니메이션
    requestAnimationFrame(applyPhysics);
    requestAnimationFrame(animateItems);
    clearInterval(window.gameLoopInterval);
    clearInterval(window.itemSpawnInterval);
    window.gameLoopInterval = setInterval(gameLoop, 1000);
    window.itemSpawnInterval = setInterval(spawnItem, ITEM_SPAWN_INTERVAL);
}

// --- 게임 루프 ---
function gameLoop() {
    if (!isGameRunning) return;
    gameTimer--;
    if (gameTimer <= 0) {
        gameTimer = 0;
        gameOver("시간 초과! 산소가 모두 소진되었습니다...");
    }
    updateUI();
}

// --- 물리 ---
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

// --- UI ---
function updateUI() {
    if (!survivalFill || !altitudeValue) return;

    survivalFill.style.width = `${Math.min(100, Math.max(0, (gameTimer / MAX_TIME) * 100))}%`;

    let scrollRatio = MAX_GAME_HEIGHT > 0 ? scrollPosition / MAX_GAME_HEIGHT : 1;
    let alt = Math.round(-FIXED_MAX_DEPTH * (1 - scrollRatio));
    if (alt >= 0) alt = 0;
    altitudeValue.textContent = `${alt} m`;
}

// --- 배경 스크롤 ---
function updateBackgroundScroll() {
    if (!oceanScroll) return;
    oceanScroll.style.transform = `translateY(${scrollPosition}px)`;
}

// --- 게임 종료 ---
function gameOver(message, isWin = false) {
    isGameRunning = false;

    if (isWin) {
        if (gameEndScreen) gameEndScreen.classList.add('hidden');
        triggerHiddenEnding();
        return;
    }

    if (gameEndScreen) gameEndScreen.classList.remove('hidden');
    if (endMessage) endMessage.textContent = message;
    if (finalScore) {
        let finalAltitude = Math.round(-FIXED_MAX_DEPTH + (scrollPosition / MAX_GAME_HEIGHT) * FIXED_MAX_DEPTH);
        finalScore.textContent = `최종 고도: ${finalAltitude} m / 클릭: ${clickCount.toLocaleString()}회`;
    }
    if (nameInputSection) nameInputSection.style.display = 'block';
}

// --- 히든엔딩 ---
function triggerHiddenEnding() {
    if (!gameContainer) return;

    const whiteDiv = document.createElement('div');
    whiteDiv.className = 'hidden-white';
    whiteDiv.style.pointerEvents = 'none';
    whiteDiv.style.zIndex = 1000;
    gameContainer.appendChild(whiteDiv);
    requestAnimationFrame(() => whiteDiv.classList.add('fade-in'));

    setTimeout(() => {
        const oceanImg = document.createElement('img');
        oceanImg.src = 'assets/ocean-end.png';
        oceanImg.className = 'hidden-ocean show';
        oceanImg.style.pointerEvents = 'none';
        oceanImg.style.zIndex = 1000;
        gameContainer.appendChild(oceanImg);

        setTimeout(() => {
            if (gameEndScreen) {
                gameEndScreen.classList.remove('hidden');
                gameEndScreen.style.zIndex = 1001;
                gameEndScreen.style.pointerEvents = 'auto';
            }
            if (endMessage) {
                endMessage.textContent = "✨ HIDDEN ENDING! 바다 위 세상에 도달했습니다! ✨";
                endMessage.style.display = 'block';
            }
            if (nameInputSection) {
                nameInputSection.style.display = 'block';      // display:block으로 강제
                nameInputSection.classList.remove('hidden');   // 기존 hidden 클래스 제거
                nameInputSection.style.zIndex = 5000;          // 최상위로
                nameInputSection.style.pointerEvents = 'auto'; // 클릭 가능
                gameContainer.appendChild(nameInputSection);
            }
        }, 1500);
    }, 1000);
}

// --- 아이템 ---
function spawnItem() {
    if (!isGameRunning || !itemSpawnArea) return;

    let cumulative = 0, rand = Math.random();
    let selected = null;
    for (const item of ITEMS) {
        cumulative += item.rarity;
        if (rand < cumulative) { selected = item; break; }
    }
    if (!selected) return;

    const el = document.createElement('div');
    el.className = `game-item ${selected.class}`;
    el.dataset.time_add = selected.time_add;
    el.style.left = `${Math.random() * Math.max(0, (gameContainer?.clientWidth || 300) - 50)}px`;
    el.style.top = '-50px';
    el.style.zIndex = 2;
    el.addEventListener('click', e => {
        if (!isGameRunning) return;
        const t = parseFloat(el.dataset.time_add) || 0;
        gameTimer += t;
        if (el.classList.contains('booster')) velocity = Math.max(velocity, BUOYANCY * 1.4);
        el.remove();
        updateUI();
        e.stopPropagation();
    });
    itemSpawnArea.appendChild(el);
}

function animateItems() {
    if (!isGameRunning) return;
    const items = itemSpawnArea.querySelectorAll('.game-item');
    const ch = gameContainer.clientHeight;
    items.forEach(el => {
        let top = parseFloat(el.style.top) || 0;
        top += ITEM_MOVE_SPEED;
        el.style.top = `${top}px`;
        if (top > ch) el.remove();
    });
    requestAnimationFrame(animateItems);
}

// --- 이름 제출 ---
function onSubmitName() {
    const name = playerNameInput.value.trim();
    if (!name) return;

    const score = clickCount;
    saveScoreFirebase(name, score);

    playerNameInput.value = '';
    nameInputSection.style.display = 'none';
}

// --- Firebase ---
function saveScoreFirebase(name, score) {
    const scoresRef = ref(db, 'scores');
    const newScoreRef = push(scoresRef);
    set(newScoreRef, { name, score, timestamp: Date.now() });
}

function loadScores() {
    const scoreList = document.getElementById('score-list');
    if (!scoreList) return; // 없으면 그냥 종료

    const scoresRef = ref(db, 'scores');

    onValue(scoresRef, snapshot => {
        const data = snapshot.val();
        if (!data) {
            scoreList.innerHTML = "<li>아직 등록된 기록이 없습니다.</li>";
            return;
        }

        // 객체 → 배열 변환
        const arr = Object.values(data);

        // 점수 높은 순 정렬
        arr.sort((a, b) => b.score - a.score);

        // 리스트 출력
        scoreList.innerHTML = arr
            .map(s => `<li>${s.name} — ${s.score}m</li>`)
            .join("");
    });
}


