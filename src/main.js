

// === 상태 변수 ===
let isGameRunning = false;
let gameTimer = 0;
let scrollPosition = 0;
let clickCount = 0;

// === 상수 ===
const MAX_TIME = 20;
const CLICK_ASCENT_RATE = 50;
const FIXED_MAX_DEPTH = 14998; // 항상 10984m에서 시작 (사용자 요청)
let MAX_GAME_HEIGHT = 10984;   // 픽셀 단위 스크롤 가능 거리(초기값 placeholder)

// === 아이템 데이터 ===
const ITEMS = [
    { name: '산소 봉투', class: 'oxygen-pouch', time_add: 10, rarity: 0.6 },
    { name: '해초 스낵', class: 'kelp-snack', time_add: 5, rarity: 0.3 },
    { name: '행운의 불가사리', class: 'lucky-star', time_add: 20, rarity: 0.1 }
];
const ITEM_SPAWN_INTERVAL = 3000;
const ITEM_MOVE_SPEED = 2;

// --- DOM 참조는 반드시 로드 후에 얻는다 ---
let gameContainer, oceanScroll, survivalFill, altitudeValue;
let gameEndScreen, restartButton, endMessage, finalScore, clickCountValue;
let itemSpawnArea, playerNameInput, submitNameButton, nameInputSection, oceanImage;

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
function handleAscent(event) {
    if (!isGameRunning) return;
    clickCount++;
    if (clickCountValue) clickCountValue.textContent = clickCount.toLocaleString();

    scrollPosition += CLICK_ASCENT_RATE;

    if (scrollPosition >= MAX_GAME_HEIGHT) {
        scrollPosition = MAX_GAME_HEIGHT;
        if (isGameRunning) {
            gameOver("축하합니다! 심해 탈출 성공! 당신은 수면 위로 떠올랐습니다.", true);
            return;
        }
    }

    if (oceanScroll) updateBackgroundScroll();
    updateUI();

    // 외부 ClickBattle 로깅이 필요하면 여기서 안전 호출 (이미 초기화 되어 있다면)
    if (typeof ClickBattle !== 'undefined' && typeof ClickBattle.recordClick === 'function') {
        try { ClickBattle.recordClick(); } catch (e) { console.warn('ClickBattle.recordClick() 오류:', e); }
    }

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
        console.warn('updateUI: survivalFill 또는 altitudeValue 없음');
    }

    // 산소 게이지
    let gaugePercentage = (gameTimer / MAX_TIME) * 100;
    gaugePercentage = Math.min(100, Math.max(0, gaugePercentage));
    if (survivalFill) survivalFill.style.width = `${gaugePercentage}%`;

    // 고도 계산: 항상 FIXED_MAX_DEPTH(10984m)에서 시작해서, scroll 진행률로 0으로
    let scrollRatio = 0;
    if (MAX_GAME_HEIGHT <= 0) {
        // 이미지가 컨테이너보다 작거나 같으면 바로 수면 취급(분모 0 방지)
        scrollRatio = 1;
    } else {
        scrollRatio = scrollPosition / MAX_GAME_HEIGHT;
        if (!isFinite(scrollRatio)) scrollRatio = 0;
    }
    if (scrollRatio > 1) scrollRatio = 1;
    if (scrollRatio < 0) scrollRatio = 0;

    // 비율에 따라 고도 계산
    let calculatedAltitude = Math.round(-FIXED_MAX_DEPTH * (1 - scrollRatio));
    if (calculatedAltitude >= 0) calculatedAltitude = 0;

    if (altitudeValue) altitudeValue.textContent = `${calculatedAltitude} m`;

    // 디버그: 콘솔 출력 (원하면 주석 처리)
    // console.log('updateUI 디버그: scrollPos=', scrollPosition, 'ratio=', scrollRatio, 'alt=', calculatedAltitude);
}


// --- 게임 오버 ---
function gameOver(message, isWin = false) {
    isGameRunning = false;
    if (gameLoopInterval) clearInterval(gameLoopInterval);
    if (itemSpawnInterval) clearInterval(itemSpawnInterval);

    // finalAltitude도 비율 기반으로 일관 계산 (옛 포뮬러 사용 금지)
    let finalRatio = (MAX_GAME_HEIGHT <= 0) ? 1 : (scrollPosition / MAX_GAME_HEIGHT);
    if (!isFinite(finalRatio)) finalRatio = 1;
    if (finalRatio > 1) finalRatio = 1;
    let finalAltitude = Math.round(-FIXED_MAX_DEPTH * (1 - finalRatio));
    if (finalAltitude >= 0) finalAltitude = 0;

    let finalMessage = message;
    if (isWin && gameTimer > 0) {
        finalMessage = "✨ HIDDEN ENDING! 산소까지 아껴가며 수면 위로 떠올랐습니다! ✨";
    }

    if (endMessage) endMessage.textContent = finalMessage;
    if (finalScore) finalScore.textContent = `최종 고도: ${finalAltitude} m / 총 클릭 횟수: ${clickCount.toLocaleString()}회`;
    if (gameEndScreen) gameEndScreen.classList.remove('hidden');

    if (!isWin && nameInputSection) nameInputSection.classList.remove('hidden');
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





ClickBattle.init("ian");

ClickBattle.recordClick();