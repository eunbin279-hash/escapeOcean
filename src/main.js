// === 게임 상태 변수 ===
let isGameRunning = false;
let currentAltitude = 0;
let gameTimer = 0;
let scrollPosition = 0;
let clickCount = 0;

// === 상수 설정 ===
const MAX_TIME = 20;
const CLICK_ASCENT_RATE = 20;
const MAX_GAME_HEIGHT = 10984;
const MAX_DEPTH = 10984; // 10,984 m

// === 아이템 데이터 정의 (time_add: 추가 시간) ===
const ITEMS = [
    { name: '산소 봉투', class: 'oxygen-pouch', time_add: 10, rarity: 0.6 },
    { name: '해초 스낵', class: 'kelp-snack', time_add: 5, rarity: 0.3 },
    { name: '행운의 불가사리', class: 'lucky-star', time_add: 20, rarity: 0.1 }
];
const ITEM_SPAWN_INTERVAL = 3000;
const ITEM_MOVE_SPEED = 2;

// === DOM 요소 선택 (명예의 전당 관련 DOM 추가) ===
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

let gameLoopInterval;
let itemSpawnInterval;


// --- 1. 초기화 및 게임 시작 ---

function initializeGame() {
    isGameRunning = true;
    currentAltitude = -MAX_DEPTH;
    gameTimer = MAX_TIME;
    scrollPosition = 0;
    clickCount = 0;

    // UI 및 배경 초기화
    gameEndScreen.classList.add('hidden');
    nameInputSection.classList.add('hidden'); // 시작 시 이름 입력 숨기기
    oceanScroll.style.transform = `translateY(0px)`;
    itemSpawnArea.innerHTML = ''; // 기존 아이템 제거

    updateUI();

    // 메인 게임 루프 시작
    if (gameLoopInterval) clearInterval(gameLoopInterval);
    gameLoopInterval = setInterval(gameLoop, 1000);

    // 아이템 루프 시작
    if (itemSpawnInterval) clearInterval(itemSpawnInterval);
    itemSpawnInterval = setInterval(spawnItem, ITEM_SPAWN_INTERVAL);
    requestAnimationFrame(animateItems); // 아이템 이동 애니메이션 시작
}


// --- 2. 메인 게임 루프 ---

function gameLoop() {
    if (!isGameRunning) return;

    gameTimer--;

    if (gameTimer <= 0) {
        gameTimer = 0;
        gameOver("시간 초과! 산소 버블이 모두 소진되었습니다.");
    }
    updateUI();
}


// --- 3. 클릭 및 상승 (승리 조건 포함) ---

gameContainer.addEventListener('click', handleAscent);
gameContainer.addEventListener('touchstart', handleAscent);

function handleAscent(event) {
    if (!isGameRunning) return;

    clickCount++;
    clickCountValue.textContent = clickCount.toLocaleString(); // ✨ 클릭 횟수 반영

    scrollPosition += CLICK_ASCENT_RATE;

    // 1. 최대 높이 제한 및 승리 조건 확인
    if (scrollPosition >= MAX_GAME_HEIGHT) {
        scrollPosition = MAX_GAME_HEIGHT;

        // 이미지가 끝났을 때 시간이 남아있다면 승리 종료
        if (isGameRunning) {
            gameOver("축하합니다! 심해 탈출 성공! 당신은 수면 위로 떠올랐습니다.", true);
            return;
        }
    }

    updateBackgroundScroll();
    updateUI();
}


// --- 4. 배경 스크롤 및 UI 업데이트 ---

function updateBackgroundScroll() {
    oceanScroll.style.transform = `translateY(${scrollPosition}px)`;
}

function updateUI() {
    // 1. 산소 게이지 업데이트
    let gaugePercentage = (gameTimer / MAX_TIME) * 100;
    if (gaugePercentage > 100) gaugePercentage = 100;
    survivalFill.style.width = `${gaugePercentage}%`;

    // 2. 고도 값 계산 및 표시 (마이너스 고도 로직)
    const ascentRatio = scrollPosition / MAX_GAME_HEIGHT;
    let calculatedAltitude = Math.round(-MAX_DEPTH + scrollPosition);
    // ✨ 안전 장치: 이미지 끝에 도달했으면 고도를 0으로 확정
    if (scrollPosition >= MAX_GAME_HEIGHT || calculatedAltitude > 0) {
        calculatedAltitude = 0;
    }

    altitudeValue.textContent = `${calculatedAltitude} m`;

    // 3. 클릭 횟수 반영 (handleAscent에서 이미 처리됨)
    // 4. 배경 테마 전환 로직 ...
}


// --- 5. 게임 오버, 히든 엔딩, 명예의 전당 ---

function gameOver(message, isWin = false) {
    isGameRunning = false;
    clearInterval(gameLoopInterval);
    clearInterval(itemSpawnInterval); // ✨ 아이템 생성 루프 중지

    // 최종 고도 계산 및 0m 확정
    let finalAltitude = Math.round(-MAX_DEPTH + scrollPosition);
    // ✨ 최종 고도 0m 확정 로직
    if (scrollPosition >= MAX_GAME_HEIGHT) {
        finalAltitude = 0;
    }

    let finalMessage = message;

    // 히든 엔딩 조건: 승리했고, 시간이 남아있을 때
    if (isWin && gameTimer > 0) {
        finalMessage = "✨ HIDDEN ENDING! 산소까지 아껴가며 수면 위로 떠올랐습니다! ✨";
    }

    // 메시지 설정 및 점수 표시
    endMessage.textContent = finalMessage;
    finalScore.textContent = `최종 고도: ${finalAltitude} m / 총 클릭 횟수: ${clickCount.toLocaleString()}회`;

    gameEndScreen.classList.remove('hidden');

    // 패배 시에만 이름 입력 섹션 표시
    if (!isWin) {
        nameInputSection.classList.remove('hidden');
    }
}


// --- 6. 아이템 생성, 획득 및 애니메이션 (이전 단계 코드 유지) ---

function spawnItem() {
    if (!isGameRunning) return;

    const rand = Math.random();
    let itemToSpawn = null;
    let cumulativeRarity = 0;

    for (const item of ITEMS) {
        cumulativeRarity += item.rarity;
        if (rand < cumulativeRarity) {
            itemToSpawn = item;
            break;
        }
    }

    if (!itemToSpawn) return;

    const itemElement = document.createElement('div');
    itemElement.classList.add('game-item', itemToSpawn.class);
    itemElement.dataset.time_add = itemToSpawn.time_add;

    const containerWidth = gameContainer.clientWidth;
    const randomX = Math.random() * (containerWidth - 50);

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

        if (currentTop > containerHeight) {
            item.remove();
        }
    });
}

// --- 7. 명예의 전당 저장 로직 ---

submitNameButton.addEventListener('click', () => {
    const name = playerNameInput.value.trim();
    if (name) {
        // 최종 고도 재계산 (0m 확정 로직 사용)
        const ascentRatio = scrollPosition / MAX_GAME_HEIGHT;
        let finalAltitude = Math.round(-MAX_DEPTH + (ascentRatio * MAX_DEPTH));
        if (scrollPosition >= MAX_GAME_HEIGHT) {
            finalAltitude = 0;
        }

        saveScore({
            name: name,
            score: finalAltitude,
            clicks: clickCount
        });

        nameInputSection.classList.add('hidden');
        alert(`[${name}]님의 기록 (${finalAltitude}m)이 명예의 전당에 등록되었습니다!`);
    } else {
        alert("이름을 입력해주세요!");
    }
});

function saveScore(newScore) {
    let scores = JSON.parse(localStorage.getItem('oceanScores') || '[]');

    scores.push(newScore);
    scores.sort((a, b) => b.score - a.score);
    scores = scores.slice(0, 10);

    localStorage.setItem('oceanScores', JSON.stringify(scores));
}


// --- 페이지 로드 시 초기화 ---
initializeGame();