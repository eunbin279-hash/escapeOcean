
ClickBattle.init("ian");


let isGameRunning = false;
let gameTimer = 0;
let scrollPosition = 0;
let clickCount = 0;

// === 동적으로 계산되는 상수 (이미지/컨테이너에 따라 설정) ===
const MAX_TIME = 20;
const CLICK_ASCENT_RATE = 20;
let MAX_GAME_HEIGHT = 10984; // 이제 초기화 시 재계산 (px)
let MAX_DEPTH = 10984;       // 이미지 픽셀 <-> 미터 매핑값 (초기값은 placeholder)

// === 아이템 데이터 ===
const ITEMS = [
    { name: '산소 봉투', class: 'oxygen-pouch', time_add: 10, rarity: 0.6 },
    { name: '해초 스낵', class: 'kelp-snack', time_add: 5, rarity: 0.3 },
    { name: '행운의 불가사리', class: 'lucky-star', time_add: 20, rarity: 0.1 }
];
const ITEM_SPAWN_INTERVAL = 3000;
const ITEM_MOVE_SPEED = 2;

// === DOM 요소 ===
const gameContainer = document.getElementById('game-container');
const oceanScroll = document.getElementById('ocean-scroll');
const survivalFill = document.getElementById('survival-fill');
const altitudeValue = document.getElementById('altitude-value');
const gameEndScreen = document.getElementById('game-end-screen');
const restartButton = document.getElementById('restart-button');
const endMessage = document.getElementById('end-message');
const finalScore = document.getElementById('final-score');
const clickCountValue = document.getElementById('click-count-value');
const itemSpawnArea = document.getElementById('item-spawn-area');
const playerNameInput = document.getElementById('player-name');
const submitNameButton = document.getElementById('submit-name');
const nameInputSection = document.getElementById('name-input-section');

// 추가: 배경 이미지를 참조 (id="ocean-image"인 <img> 또는 background 이미지 높이를 알 수 있는 요소 필요)
const oceanImage = document.getElementById('ocean-image'); // HTML에 이미지 엘리먼트가 있어야 함

let gameLoopInterval;
let itemSpawnInterval;


// --- 초기화 및 게임 시작 ---
function initializeGame() {
    // 이미지 / 컨테이너 크기로 스크롤 가능 최대거리 및 MAX_DEPTH를 계산
    const imgHeight = oceanImage ? oceanImage.naturalHeight : MAX_GAME_HEIGHT;
    const containerHeight = gameContainer.clientHeight;

    // 실제 스크롤 가능한 거리 = 이미지 높이 - 컨테이너 높이 (최소 0)
    MAX_GAME_HEIGHT = Math.max(0, imgHeight - containerHeight);

    // 매핑: 1px == 1m 로 매칭하려면 MAX_DEPTH를 MAX_GAME_HEIGHT로 맞춤
    // (원하시면 별도 스케일 비율을 사용하게끔 수정 가능)
    MAX_DEPTH = MAX_GAME_HEIGHT;

    console.log('디버그: imgHeight=', imgHeight, 'containerHeight=', containerHeight,
        'MAX_GAME_HEIGHT(px)=', MAX_GAME_HEIGHT, 'MAX_DEPTH(m)=', MAX_DEPTH);

    isGameRunning = true;
    gameTimer = MAX_TIME;
    scrollPosition = 0;
    clickCount = 0;

    gameEndScreen.classList.add('hidden');
    nameInputSection.classList.add('hidden');
    oceanScroll.style.transform = `translateY(0px)`;
    itemSpawnArea.innerHTML = '';

    updateUI();

    if (gameLoopInterval) clearInterval(gameLoopInterval);
    gameLoopInterval = setInterval(gameLoop, 1000);

    if (itemSpawnInterval) clearInterval(itemSpawnInterval);
    itemSpawnInterval = setInterval(spawnItem, ITEM_SPAWN_INTERVAL);
    requestAnimationFrame(animateItems);
}


// --- 메인 루프 ---
function gameLoop() {
    if (!isGameRunning) return;
    gameTimer--;
    if (gameTimer <= 0) {
        gameTimer = 0;
        gameOver("시간 초과! 산소 버블이 모두 소진되었습니다.");
    }
    updateUI();
}


// --- 클릭 상승 ---
gameContainer.addEventListener('click', handleAscent);
gameContainer.addEventListener('touchstart', handleAscent);

function handleAscent(event) {
    if (!isGameRunning) return;
    clickCount++;
    clickCountValue.textContent = clickCount.toLocaleString();

    scrollPosition += CLICK_ASCENT_RATE;

    // 최대 스크롤 제한 및 승리 조건
    if (scrollPosition >= MAX_GAME_HEIGHT) {
        scrollPosition = MAX_GAME_HEIGHT;
        if (isGameRunning) {
            // 승리 처리 — 남은 시간이 있으면 히든 엔딩 메시지는 gameOver에서 처리
            gameOver("축하합니다! 심해 탈출 성공! 당신은 수면 위로 떠올랐습니다.", true);
            return;
        }
    }

    updateBackgroundScroll();
    updateUI();
}


// --- 배경 스크롤 & UI 업데이트 ---
function updateBackgroundScroll() {
    oceanScroll.style.transform = `translateY(${scrollPosition}px)`;
}

function updateUI() {
    // 산소 게이지
    let gaugePercentage = (gameTimer / MAX_TIME) * 100;
    gaugePercentage = Math.min(100, Math.max(0, gaugePercentage));
    survivalFill.style.width = `${gaugePercentage}%`;

    // 고도 계산: 1px == 1m 매핑 가정
    // altitude = -MAX_DEPTH + scrollPosition
    let calculatedAltitude = Math.round(-MAX_DEPTH + scrollPosition);

    if (calculatedAltitude >= 0) calculatedAltitude = 0;

    altitudeValue.textContent = `${calculatedAltitude} m`;
}


// --- 게임 오버 / 명예의 전당 ---
function gameOver(message, isWin = false) {
    isGameRunning = false;
    clearInterval(gameLoopInterval);
    clearInterval(itemSpawnInterval);

    let finalAltitude = Math.round(-MAX_DEPTH + scrollPosition);
    if (finalAltitude >= 0) finalAltitude = 0;

    let finalMessage = message;
    if (isWin && gameTimer > 0) {
        finalMessage = "✨ HIDDEN ENDING! 산소까지 아껴가며 수면 위로 떠올랐습니다! ✨";
    }

    endMessage.textContent = finalMessage;
    finalScore.textContent = `최종 고도: ${finalAltitude} m / 총 클릭 횟수: ${clickCount.toLocaleString()}회`;
    gameEndScreen.classList.remove('hidden');

    if (!isWin) nameInputSection.classList.remove('hidden');

    if (typeof displayHallOfFame === 'function') displayHallOfFame();

    // 디버그 로그: 최종 값 확인
    console.log('게임종료 디버그: scrollPosition=', scrollPosition,
        'MAX_DEPTH=', MAX_DEPTH, 'finalAltitude=', finalAltitude,
        'gameTimer=', gameTimer);
}


// --- 아이템 생성/획득/애니메이션 (기존 로직 유지, 비불필요 부분 제거) ---
function spawnItem() {
    if (!isGameRunning) return;

    const rand = Math.random();
    let itemToSpawn = null;
    let cumulativeRarity = 0;
    for (const item of ITEMS) {
        cumulativeRarity += item.rarity;
        if (rand < cumulativeRarity) { itemToSpawn = item; break; }
    }
    if (!itemToSpawn) return;

    const itemElement = document.createElement('div');
    itemElement.classList.add('game-item', itemToSpawn.class);
    itemElement.dataset.time_add = itemToSpawn.time_add;

    const containerWidth = gameContainer.clientWidth;
    const randomX = Math.random() * Math.max(0, containerWidth - 50);
    itemElement.style.left = `${randomX}px`;
    itemElement.style.top = `-50px`;

    itemElement.addEventListener('click', handleItemClick);
    itemElement.addEventListener('touchstart', handleItemClick);
    itemSpawnArea.appendChild(itemElement);
}

function handleItemClick(event) {
    if (!isGameRunning) return;
    const itemElement = event.currentTarget;
    const timeAddAmount = parseFloat(itemElement.dataset.time_add);
    gameTimer += timeAddAmount;
    itemElement.remove();
    updateUI();
    event.stopPropagation();
}

function animateItems() {
    if (isGameRunning) {
        moveItems();
        requestAnimationFrame(animateItems);
    }
}

function moveItems() {
    const items = itemSpawnArea.querySelectorAll('.game-item');
    const containerHeight = gameContainer.clientHeight;
    items.forEach(item => {
        let currentTop = parseFloat(item.style.top) || 0;
        currentTop += ITEM_MOVE_SPEED;
        item.style.top = `${currentTop}px`;
        if (currentTop > containerHeight) item.remove();
    });
}


// --- 명예의 전당 저장 로직 (간단 유지) ---
submitNameButton.addEventListener('click', () => {
    const name = playerNameInput.value.trim();
    if (!name) { alert("이름을 입력해주세요!"); return; }

    let finalAltitude = Math.round(-MAX_DEPTH + scrollPosition);
    if (finalAltitude >= 0) finalAltitude = 0;

    saveScore({ name, score: finalAltitude, clicks: clickCount });
    nameInputSection.classList.add('hidden');
    alert(`[${name}]님의 기록 (${finalAltitude}m)이 명예의 전당에 등록되었습니다!`);
});

function saveScore(newScore) {
    let scores = JSON.parse(localStorage.getItem('oceanScores') || '[]');
    scores.push(newScore);
    scores.sort((a, b) => b.score - a.score);
    scores = scores.slice(0, 10);
    localStorage.setItem('oceanScores', JSON.stringify(scores));
}

restartButton.addEventListener('click', initializeGame);

// --- 페이지 로드 시 초기화 ---
window.addEventListener('load', () => {
    // 이미지가 비동기 로드일 수 있으므로 로드 완료 시 초기화
    if (oceanImage && !oceanImage.complete) {
        oceanImage.addEventListener('load', initializeGame);
    } else {
        initializeGame();
    }
});


ClickBattle.recordClick();
