//******* general helpers ******** //

const ID_CHARS = "0123456789abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ_";
function idMaker(length = 12) {
  return Array(length)
    .fill(0)
    .map((item) => ID_CHARS.split("")[Math.round(Math.random() * ID_CHARS.length)])
    .join("");
}

function randRangeInt(min, max) {
  /* min and max included */
  return Math.floor(Math.random() * (max - min + 1) + min);
}

function randRangeIntFloat(min, max) {
  return Math.random() * (max - min) + min;
}

function playSound(filepath, volume = 1) {
  const audio = new Audio(filepath);
  audio.volume = volume;
  audio.play();
}

//******* UI ******** //

function drawUI() {
  livesUI.textContent = lives;
  killCountUI.textContent = kills;
}

//******* enemies ******** //

function generateEnemyPosition() {
  const spawnPositions = ["top", "right", "bottom", "left"];
  const posIdx = Math.floor(Math.random() * spawnPositions.length);
  const spawnPos = spawnPositions[posIdx];
  let x = 0;
  y = 0;

  switch (spawnPos) {
    case "top": {
      x = randRangeInt(0, canvas.width);
      y = 0;
      break;
    }
    case "right": {
      y = randRangeInt(0, canvas.height);
      x = canvas.width;
      break;
    }
    case "bottom": {
      x = randRangeInt(0, canvas.width);
      y = canvas.height;
      break;
    }
    case "left": {
      y = randRangeInt(0, canvas.height);
      x = 0;
      break;
    }
  }

  return [x, y, spawnPos];
}

function handleSpawnEnemies() {
  const isTimeToSpawn = Date.now() - lastEnemySpawnTime > enemyCooldown;

  if (isTimeToSpawn) {
    lastEnemySpawnTime = Date.now();
    const enemyPos = generateEnemyPosition();
    const [x, y, side] = enemyPos;
    const speed = randRangeIntFloat(0.5, 2);
    const colorIdx = randRangeInt(0, 3);
    const size = randRangeInt(4, 12);
    const color = ["lightblue", "lightgreen", "lightcoral", "pink"][colorIdx];
    const id = idMaker();
    const enemy = { id, color, size, speed, pos: { x, y }, side };
    enemiesMap.set(id, enemy);
  }
}

function drawEnemies() {
  for ([i, enemy] of enemiesMap.entries()) {
    const { id, pos, size, speed, color } = enemy;
    const { x, y } = pos;

    ctx.beginPath();
    ctx.arc(x, y, size, 0, Math.PI * 2);
    ctx.fillStyle = color;
    ctx.fill();
    ctx.closePath();
  }
}

function getNextEnemyPos(id, x, y, side) {
  const [px, py] = [canvas.width / 2, canvas.height / 2];
  const dx = px - x;
  const dy = py - y;
  const theta = Math.atan2(dy, dx);

  const velX = Math.cos(theta) * enemy.speed;
  const velY = Math.sin(theta) * enemy.speed;

  const nextX = x + velX;
  const nextY = y + velY;

  return [nextX, nextY];
}

function updateEnemies() {
  for ([i, enemy] of enemiesMap.entries()) {
    const { id, size, side, slashed = false } = enemy;
    const { x, y } = enemy.pos;

    if (slashed) {
      console.log(`enemy ${id} slashed!`);
      enemiesMap.delete(id);
      kills++;

      playSound("./assets/sounds/blade-hit-02.wav");
      continue;
    }

    let collidedWithPlayer = false;
    switch (side) {
      case "left":
        collidedWithPlayer = x >= canvas.width / 2 - playerRadius - size;
        break;
      case "right":
        collidedWithPlayer = x <= canvas.width / 2 + playerRadius + size;
        break;
      case "top":
        collidedWithPlayer = y >= canvas.height / 2 - playerRadius - size;
        break;
      case "bottom":
        collidedWithPlayer = y <= canvas.height / 2 + playerRadius + size;
        break;
    }

    const [nextX, nextY] = getNextEnemyPos(id, x, y, side);

    if (collidedWithPlayer) {
      console.log("player hit!");
      onPlayerHitByEnemy();
      enemiesMap.delete(id);
    } else {
      enemiesMap.set(id, { ...enemy, pos: { x: nextX, y: nextY } });
    }
  }
}

//******* sword slash ******** //

function* slashGenerator(slashTimestamp, angle) {
  const slashOverflow = 0.1;
  const slashIsOngoing = Date.now() - slashTimestamp <= attackCooldown;

  while (slashIsOngoing) {
    percentage = slashOverflow + (Date.now() - slashTimestamp) / attackCooldown;
    yield [percentage, angle];
  }
  return [percentage, angle];
}

function drawSlash() {
  const slashRadius = playerRadius * 4.5;
  const slashWidth = 32;
  const [slashPercentage, angle] = slashGen.next().value;
  const startAngle = Math.PI + angle;
  const targetAngle = Math.PI * 2 + angle;
  const angleDiff = targetAngle - startAngle;
  const endAngle = startAngle + angleDiff * slashPercentage;

  ctx.beginPath();
  ctx.arc(canvas.width / 2, canvas.height / 2, slashRadius, startAngle, endAngle);
  ctx.strokeStyle = "#fff";
  ctx.lineWidth = slashWidth;
  ctx.stroke();
  ctx.closePath();

  /* check enemy collision */
  for (const enemy of enemiesMap.values()) {
    const { id, pos, size } = enemy;
    const { x, y } = pos;
    const enemyIntersectedBySlash = ctx.isPointInStroke(x, y);
    if (enemyIntersectedBySlash) {
      enemy.slashed = true;
    }
  }

  ctx.lineWidth = 1;
}

//******* player ******** //

function onPlayerHitByEnemy() {
  if (invincible) return;

  console.log("OOOOOOOOOOOUCH!!!");
  playSound("./assets/sounds/blade-hit-gore.wav", 0.5);
  lives--;
  invincible = true;

  setTimeout(() => {
    invincible = false;
  }, invincibilityTimeout);
}

function handlePlayerAttacks() {
  const isAttacking = Date.now() - gameStartTimestamp > attackCooldown && Date.now() - lastAttackTime < attackCooldown;
  if (isAttacking) {
    drawSlash();
  } else {
    slashGen = slashGenerator(Date.now(), playerAngle);
  }
}

function drawPlayer(angle) {
  ctx.translate(canvas.width / 2, canvas.height / 2);

  ctx.rotate(angle);

  ctx.beginPath();
  ctx.arc(0, 0, playerRadius, 0, Math.PI * 2);
  ctx.strokeStyle = invincible ? "rgba(225,225,225,0.2)" : "#fff";
  ctx.stroke();
  ctx.closePath();

  ctx.beginPath();
  ctx.moveTo(0, 0);
  ctx.lineTo(0, -20);
  ctx.stroke();
  ctx.closePath();

  ctx.rotate(-angle);
  ctx.translate(-canvas.width / 2, -canvas.height / 2);
}

function calculatePlayerAngle() {
  const cx = canvas.width / 2,
    cy = canvas.height / 2;

  const dy = mouseY - cy;
  const dx = mouseX - cx;
  const theta = Math.atan2(dy, dx) + Math.PI * 0.5; /* range (-PI, PI] */

  return theta;
}

//******* mouse ******** //

function drawMouse() {
  ctx.strokeStyle = "#0f0";
  ctx.beginPath();
  ctx.arc(mouseX, mouseY, 8, 0, Math.PI * 2);
  ctx.stroke();
  ctx.closePath();

  /* ctx.beginPath();
   ctx.moveTo(canvas.width / 2, canvas.height / 2);
   ctx.lineTo(mouseX, mouseY);
   ctx.stroke();
   ctx.closePath();
   */
}

//******* world ******** //

function drawWorldLines() {
  ctx.beginPath();
  ctx.moveTo(canvas.width / 2, 0);
  ctx.lineTo(canvas.width / 2, canvas.height);
  ctx.strokeStyle = "#00f";
  ctx.stroke();
  ctx.closePath();

  ctx.beginPath();
  ctx.moveTo(0, canvas.height / 2);
  ctx.lineTo(canvas.width, canvas.height / 2);
  ctx.stroke();
  ctx.closePath();
}

//******* game ******** //

function runGameLoop() {
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  drawWorldLines();
  drawMouse();
  playerAngle = calculatePlayerAngle();
  drawPlayer(playerAngle);
  handlePlayerAttacks();
  updateEnemies();
  drawEnemies();
  handleSpawnEnemies();
  drawUI();

  requestAnimationFrame(runGameLoop);
}

function setupEventListeners() {
  window.addEventListener("mousemove", (e) => {
    mouseX = e.offsetX;
    mouseY = e.offsetY;
  });

  window.addEventListener("mousedown", (e) => {
    if (Date.now() - gameStartTimestamp > attackCooldown && Date.now() - lastAttackTime > attackCooldown) {
      lastAttackTime = Date.now();
      playSound("./assets/sounds/fast-woosh-02.wav", 0.5);
    }
  });
}

function main() {
  setupEventListeners();
  runGameLoop();
}

const canvas = document.querySelector("#canvas");
const ctx = canvas.getContext("2d");
const livesUI = document.querySelector("#lives");
const killCountUI = document.querySelector("#kills");

let mouseX = 0;
let mouseY = 0;

let lives = 3;
let kills = 0;
let invincible = false;
const invincibilityTimeout = 3000;

const gameStartTimestamp = Date.now();

const playerRadius = 15;
let playerAngle = 0;
let lastAttackTime = Date.now();
const attackCooldown = 200;
let slashGen = slashGenerator(gameStartTimestamp);

let spawnedCount = 0;
const enemyCooldown = 1200;
const enemyCount = 50;
let lastEnemySpawnTime = Date.now();
const enemiesMap = new Map();

main();
