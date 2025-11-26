// === 상태 변수 ===
let isGameRunning = false;
let gameTimer = 0;
let scrollPosition = 0;
let clickCount = 0;

// === 물리 상수 (수정된 값) ===
// 중요: scrollPosition이 커질수록 '수면'으로 가까워지는 기존 좌표계를 유지
// 따라서 화면 위로 올리려면 velocity가 양수여야 함.
// 중력은 '아래로 끌어내림'이므로 velocity에 더해줄 때 음수여야 가라앉음.
const GRAVITY = -0.3;      // 아래로 끌어당기는 힘 (음수)
const BUOYANCY = 9;      // 터치 시 위로 밀어 올리는 순간 속도 (양수)
const MAX_VELOCITY = 40;  // 속도 상한 (절대값 기준)

// === 기존 상수들 ===
const MAX_TIME = 20;
const CLICK_ASCENT_RATE = 50; // 이제 직접 사용하진 않지만 보존
const FIXED_MAX_DEPTH = 10984; // 항상 10984m에서 시작 (사용자 요청)
let MAX_GAME_HEIGHT = 10984;   // 픽셀 단위 스크롤 가능 거리(초기값 placeholder)

// === 아이템 데이터 ===
const ITEMS = [
    { name: '산소통', class: 'oxygen-pouch', time_add: 2, rarity: 0.6 },
    { name: '오리발 부스터', class: 'booster', time_add: 5, rarity: 0.3 },
    { name: '행운의 불가사리', class: 'lucky-star', time_add: 8, rarity: 0.1 }
];
const ITEM_SPAWN_INTERVAL = 3000;
const ITEM_MOVE_SPEED = 2;

// --- DOM 참조는 반드시 로드 후에 얻는다 ---
let gameContainer, oceanScroll, survivalFill, altitudeValue;
let gameEndScreen, restartButton, endMessage, finalScore, clickCountValue;
let itemSpawnArea, playerNameInput, submitNameButton, nameInputSection, oceanImage;
let velocity = 0;


let gameLoopInterval;
let itemSpawnInterval;


// --- 초기화: DOM 로드 이후 실행 ---
window.addEventListener('load', () => {
    // DOM 요소들 안전하게 가져오기
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
    oceanImage = document.getElementById('ocean-image'); // <img id="ocean-image">

    // 이벤트 설정 (DOM 요소가 존재할 때만)
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

    // 이미지가 있을 경우 로드 완료 후 초기화, 아니면 바로 초기화
    if (oceanImage && !oceanImage.complete) {
        oceanImage.addEventListener('load', initializeGame);
    } else {
        initializeGame();
    }
});


// --- initializeGame ---
function initializeGame() {
    // 이미지/컨테이너 높이 안전하게 계산
    const imgHeight = oceanImage ? (oceanImage.naturalHeight || FIXED_MAX_DEPTH) : FIXED_MAX_DEPTH;
    const containerHeight = gameContainer ? gameContainer.clientHeight : 0;

    MAX_GAME_HEIGHT = Math.max(0, imgHeight - containerHeight);

    // 디버그: 계산 값 출력
    console.log('initializeGame() 디버그:',
        'imgHeight=', imgHeight,
        'containerHeight=', containerHeight,
        'MAX_GAME_HEIGHT(px)=', MAX_GAME_HEIGHT,
        'FIXED_MAX_DEPTH(m)=', FIXED_MAX_DEPTH);

    // 상태 초기화
    isGameRunning = true;
    gameTimer = MAX_TIME;
    scrollPosition = 0;
    clickCount = 0;
    velocity = 0; // 물리값 초기화

    if (gameEndScreen) gameEndScreen.classList.add('hidden');
    if (nameInputSection) nameInputSection.classList.add('hidden');
    if (oceanScroll) oceanScroll.style.transform = `translateY(0px)`;
    if (itemSpawnArea) itemSpawnArea.innerHTML = '';

    updateUI();

    if (gameLoopInterval) clearInterval(gameLoopInterval);
    gameLoopInterval = setInterval(gameLoop, 1000);

    if (itemSpawnInterval) clearInterval(itemSpawnInterval);
    itemSpawnInterval = setInterval(spawnItem, ITEM_SPAWN_INTERVAL);
    requestAnimationFrame(animateItems);

    // 물리 루프 시작 (부드러운 프레임 업데이트)
    requestAnimationFrame(applyPhysics);
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


function applyPhysics() {
    if (!isGameRunning) return;

    // 중력 적용: gravity는 음수(아래로 내려가게) 이므로 velocity에 더하면 점점 음수쪽으로 이동(가라앉음)
    velocity += GRAVITY;

    // 속도 제한 (양/음 모두 클램프)
    if (velocity > MAX_VELOCITY) velocity = MAX_VELOCITY;
    if (velocity < -MAX_VELOCITY) velocity = -MAX_VELOCITY;

    // 위치 업데이트
    scrollPosition += velocity;

    // 위치 범위 클램프
    if (scrollPosition < 0) {
        scrollPosition = 0;
        velocity = 0;
    }
    if (scrollPosition > MAX_GAME_HEIGHT) {
        scrollPosition = MAX_GAME_HEIGHT;
        // 수면 돌파 처리
        gameOver("축하합니다! 수면을 돌파했습니다!", true);
        return;
    }

    updateBackgroundScroll();
    updateUI();

    requestAnimationFrame(applyPhysics);
}

// --- 클릭 상승 ---
function handleAscent(event) {
    if (!isGameRunning) return;
    clickCount++;
    if (clickCountValue) clickCountValue.textContent = clickCount.toLocaleString();

    // 터치 시 '즉시 위로 가는 속도'를 부여 — 누적 대신 대입으로 처리하여
    // 터치를 하지 않으면 절대 올라가지 않도록 보장
    velocity = BUOYANCY;

    // 정작 위치 클램프는 물리 루프에서 처리하므로 여기서는 화면 업데이트만 한다
    if (scrollPosition >= MAX_GAME_HEIGHT) {
        scrollPosition = MAX_GAME_HEIGHT;
        if (isGameRunning) {
            gameOver("축하합니다! 심해 탈출 성공! 당신은 수면 위로 떠올랐습니다.", true);
            return;
        }
    }

    if (oceanScroll) updateBackgroundScroll();
    updateUI();

    event && event.stopPropagation && event.stopPropagation();
}


// --- 배경 스크롤 ---
function updateBackgroundScroll() {
    if (!oceanScroll) return;
    oceanScroll.style.transform = `translateY(${scrollPosition}px)`;
}


// --- UI 업데이트 (고도 일관된 계산 사용) ---
function updateUI() {
    if (!survivalFill || !altitudeValue) {
        // 필요한 엘리먼트가 없으면 최소한의 로깅 후 리턴
        // (실제 없음 경고는 콘솔에 남음)
        console.warn('updateUI: survivalFill 또는 altitudeValue 없음');
    }

    // 산소 게이지
    let gaugePercentage = (gameTimer / MAX_TIME) * 100;
    gaugePercentage = Math.min(100, Math.max(0, gaugePercentage));
    if (survivalFill) survivalFill.style.width = `${gaugePercentage}%`;

    // 고도 계산: 항상 FIXED_MAX_DEPTH에서 시작 -> scrollRatio로 0까지
    let scrollRatio = 0;
    if (MAX_GAME_HEIGHT <= 0) {
        scrollRatio = 1;
    } else {
        scrollRatio = scrollPosition / MAX_GAME_HEIGHT;
        if (!isFinite(scrollRatio)) scrollRatio = 0;
    }
    if (scrollRatio > 1) scrollRatio = 1;
    if (scrollRatio < 0) scrollRatio = 0;

    let calculatedAltitude = Math.round(-FIXED_MAX_DEPTH * (1 - scrollRatio));
    if (calculatedAltitude >= 0) calculatedAltitude = 0;

    if (altitudeValue) altitudeValue.textContent = `${calculatedAltitude} m`;
}


// --- 게임 오버 ---
function gameOver(message, isWin = false) {
    isGameRunning = false;
    if (gameLoopInterval) clearInterval(gameLoopInterval);
    if (itemSpawnInterval) clearInterval(itemSpawnInterval);

    // finalAltitude도 비율 기반으로 일관 계산
    let finalRatio = (MAX_GAME_HEIGHT <= 0) ? 1 : (scrollPosition / MAX_GAME_HEIGHT);
    if (!isFinite(finalRatio)) finalRatio = 1;
    if (finalRatio > 1) finalRatio = 1;
    let finalAltitude = Math.round(-FIXED_MAX_DEPTH * (1 - finalRatio));
    if (finalAltitude >= 0) finalAltitude = 0;

    let finalMessage = message;
    if (isWin && gameTimer > 0) {
        finalMessage = "✨ HIDDEN ENDING! 수면 위로 떠올랐습니다! ✨";
    }

    if (endMessage) endMessage.textContent = finalMessage;
    if (finalScore) finalScore.textContent = `최종 고도: ${finalAltitude} m / 총 클릭 횟수: ${clickCount.toLocaleString()}회`;
    if (gameEndScreen) gameEndScreen.classList.remove('hidden');

    if (nameInputSection) nameInputSection.classList.remove('hidden');
    if (typeof displayHallOfFame === 'function') displayHallOfFame();

    console.log('gameOver 디버그: scrollPosition=', scrollPosition,
        'MAX_GAME_HEIGHT=', MAX_GAME_HEIGHT, 'finalAltitude=', finalAltitude, 'gameTimer=', gameTimer);
}


// --- 아이템 로직 (기존 로직 유지) ---
function spawnItem() {
    if (!isGameRunning || !itemSpawnArea) return;
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

    const containerWidth = gameContainer ? gameContainer.clientWidth : 300;
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

    const timeAddAmount = parseFloat(itemElement.dataset.time_add) || 0;
    gameTimer += timeAddAmount;

    // ★★ 오리발 효과 추가 ★★
    if (itemElement.classList.contains('booster')) {
        // BUOYANCY = 9 기본 → 부스터 먹으면 1.3~1.5배 강화
        velocity = Math.max(velocity, BUOYANCY * 1.4);
    }

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
    if (!itemSpawnArea || !gameContainer) return;
    const items = itemSpawnArea.querySelectorAll('.game-item');
    const containerHeight = gameContainer.clientHeight;
    items.forEach(item => {
        let currentTop = parseFloat(item.style.top) || 0;
        currentTop += ITEM_MOVE_SPEED;
        item.style.top = `${currentTop}px`;
        if (currentTop > containerHeight) item.remove();
    });
}


// --- 명예의 전당 저장 로직 ---
function onSubmitName() {
    const name = playerNameInput ? playerNameInput.value.trim() : '';
    if (!name) { alert("이름을 입력해주세요!"); return; }

    let finalRatio = (MAX_GAME_HEIGHT <= 0) ? 1 : (scrollPosition / MAX_GAME_HEIGHT);
    if (!isFinite(finalRatio)) finalRatio = 1;
    if (finalRatio > 1) finalRatio = 1;
    let finalAltitude = Math.round(-FIXED_MAX_DEPTH * (1 - finalRatio));
    if (finalAltitude >= 0) finalAltitude = 0;

    saveScore({ name, score: finalAltitude, clicks: clickCount });
    if (nameInputSection) nameInputSection.classList.add('hidden');
    alert(`[${name}]님의 기록 (${finalAltitude}m)이 명예의 전당에 등록되었습니다!`);
}

function saveScore(newScore) {
    let scores = JSON.parse(localStorage.getItem('oceanScores') || '[]');
    scores.push(newScore);
    scores.sort((a, b) => b.score - a.score);
    scores = scores.slice(0, 10);
    localStorage.setItem('oceanScores', JSON.stringify(scores));
}



// --- 명예의 전당 표시 로직 ---
function displayNamesInGame() {
    const container = gameContainer;
    const scores = JSON.parse(localStorage.getItem('oceanScores') || '[]');

    // 기존 플레이어 이름 제거
    container.querySelectorAll('.player-name').forEach(el => el.remove());

    scores.forEach(record => {
        const nameEl = document.createElement('div');
        nameEl.classList.add('player-name');
        nameEl.textContent = record.name;

        // 게임 화면에서 y 좌표 계산 (scroll 기준)
        const y = MAX_GAME_HEIGHT - (record.score / FIXED_MAX_DEPTH * MAX_GAME_HEIGHT);
        nameEl.style.position = 'absolute';
        nameEl.style.top = `${y}px`;
        nameEl.style.left = `${Math.random() * (container.clientWidth - 50)}px`;

        container.appendChild(nameEl);
    });
}