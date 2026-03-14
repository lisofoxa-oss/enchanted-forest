import { useState, useEffect, useCallback, useRef } from "react";
import { saveGame, loadGame, onGameUpdate } from "./firebase.js";

const COLS = 5;
const TOTAL_TILES = 30;

const MONSTERS = [
  { name: "Гоблин", str: 3, dmg: 8 },
  { name: "Волк-призрак", str: 4, dmg: 12 },
  { name: "Болотный тролль", str: 4, dmg: 15 },
  { name: "Тёмный эльф", str: 5, dmg: 18 },
  { name: "Виверна", str: 6, dmg: 22 },
  { name: "Чёрный рыцарь", str: 7, dmg: 28 },
];

const BOARD = Array.from({ length: TOTAL_TILES }, (_, i) => {
  if (i === 0) return { id: i, type: "start" };
  if (i === TOTAL_TILES - 1) return { id: i, type: "boss" };
  const types = [
    "forest","forest","monster","treasure","trap","healing","portal",
    "monster","forest","treasure","trap","healing","forest","monster",
    "treasure","forest","monster","healing","trap","portal","forest",
    "monster","treasure","forest","trap","monster","healing","forest"
  ];
  return { id: i, type: types[(i - 1) % types.length] };
});

const TILE_META = {
  start: { icon: "🏰", label: "Старт", color: "#4ade80" },
  forest: { icon: "🌲", label: "Тихий лес", color: "#166534" },
  monster: { icon: "⚔️", label: "Битва!", color: "#dc2626" },
  treasure: { icon: "💎", label: "Сокровище", color: "#f59e0b" },
  trap: { icon: "🕳️", label: "Ловушка", color: "#7c3aed" },
  healing: { icon: "✨", label: "Целебный источник", color: "#06b6d4" },
  portal: { icon: "🌀", label: "Портал", color: "#c084fc" },
  boss: { icon: "🐉", label: "Логово Дракона", color: "#ef4444" },
};

function getTilePos(index) {
  const row = Math.floor(index / COLS);
  const colRaw = index % COLS;
  const col = row % 2 === 0 ? colRaw : COLS - 1 - colRaw;
  return { row, col };
}

function rollMoveDice(player) {
  const r = Math.random();
  if (player === "alisa") {
    return r < 0.65 ? Math.floor(Math.random() * 3) + 4 : Math.floor(Math.random() * 3) + 1;
  }
  return r < 0.65 ? Math.floor(Math.random() * 3) + 1 : Math.floor(Math.random() * 3) + 4;
}

function rollCombatDice(player) {
  if (player === "alisa") return Math.floor(Math.random() * 2) + 5;
  return Math.floor(Math.random() * 2) + 1;
}

function getMonsterForTile(tileId) {
  const idx = Math.min(Math.floor(tileId / 5), MONSTERS.length - 1);
  return MONSTERS[idx];
}

function resolveTile(tile, player, pState) {
  const t = tile.type;
  const isA = player === "alisa";
  let msg = "";
  let hpChange = 0;
  let atkChange = 0;
  let posChange = 0;
  let icon = "";

  if (t === "forest" || t === "start") {
    msg = "Тихо шумят деревья... Ничего не произошло.";
    icon = "🌲";
  } else if (t === "treasure") {
    if (isA) {
      const opts = [
        { m: "Найден Зачарованный Меч! Атака +3", atk: 3, hp: 0 },
        { m: "Сундук с эликсиром! +30 HP", atk: 0, hp: 30 },
        { m: "Магический амулет! +2 атака и +15 HP", atk: 2, hp: 15 },
      ];
      const o = opts[Math.floor(Math.random() * opts.length)];
      msg = o.m; atkChange = o.atk; hpChange = o.hp;
    } else {
      const opts = [
        { m: "Нашёл ржавый кинжал. Атака +1", atk: 1, hp: 0 },
        { m: "Маленькое зелье. +10 HP", atk: 0, hp: 10 },
        { m: "Пустой сундук... Только пыль.", atk: 0, hp: 0 },
      ];
      const o = opts[Math.floor(Math.random() * opts.length)];
      msg = o.m; atkChange = o.atk; hpChange = o.hp;
    }
    icon = "💎";
  } else if (t === "trap") {
    if (isA) {
      msg = "Чуть не попала в ловушку! Легко отделалась. -5 HP";
      hpChange = -5;
    } else {
      const roll = Math.random();
      if (roll < 0.5) {
        msg = "Яма-ловушка! Падаешь вниз. -20 HP и -2 клетки назад!";
        hpChange = -20; posChange = -2;
      } else {
        msg = "Магическая ловушка! -15 HP";
        hpChange = -15;
      }
    }
    icon = "🕳️";
  } else if (t === "healing") {
    const heal = isA ? 30 : 15;
    msg = `Целебный источник! Восстановлено ${heal} HP`;
    hpChange = heal;
    icon = "✨";
  } else if (t === "portal") {
    const jump = isA ? 4 : 2;
    msg = `Магический портал! Телепортация на ${jump} клетки вперёд!`;
    posChange = jump;
    icon = "🌀";
  } else if (t === "monster") {
    const m = getMonsterForTile(tile.id);
    const combatRoll = rollCombatDice(player);
    const totalAtk = combatRoll + pState.attack;
    if (totalAtk >= m.str) {
      const reward = isA ? 15 : 5;
      msg = `⚔️ ${m.name}! Бросок: ${combatRoll} + ${pState.attack} атк = ${totalAtk} vs ${m.str}. Победа! +${reward} HP`;
      hpChange = reward;
    } else {
      msg = `⚔️ ${m.name}! Бросок: ${combatRoll} + ${pState.attack} атк = ${totalAtk} vs ${m.str}. Поражение! -${m.dmg} HP`;
      hpChange = -m.dmg;
    }
    icon = "⚔️";
  } else if (t === "boss") {
    const combatRoll = rollCombatDice(player);
    const totalAtk = combatRoll + pState.attack;
    if (isA) {
      msg = `🐉 ДРАКОН! Бросок: ${combatRoll} + ${pState.attack} атк = ${totalAtk} vs 8. ПОБЕДА!!! Дракон повержен!`;
      return { msg, icon: "🐉", hpChange: 0, atkChange: 0, posChange: 0, bossWin: true };
    } else {
      msg = `🐉 ДРАКОН! Бросок: ${combatRoll} + ${pState.attack} атк = ${totalAtk} vs 8. Дракон слишком силён! -35 HP и -3 клетки назад!`;
      hpChange = -35; posChange = -3;
    }
    icon = "🐉";
  }

  return { msg, icon, hpChange, atkChange, posChange, bossWin: false };
}

const INITIAL_GAME = {
  phase: "lobby",
  players: {
    alisa: { joined: false, pos: 0, hp: 100, attack: 1, maxHp: 100 },
    alesha: { joined: false, pos: 0, hp: 100, attack: 1, maxHp: 100 },
  },
  currentTurn: "alisa",
  lastEvent: null,
  winner: null,
  turn: 0,
  ts: Date.now(),
};

export default function App() {
  const [game, setGame] = useState(null);
  const [me, setMe] = useState(null);
  const [diceAnim, setDiceAnim] = useState(null);
  const [eventCard, setEventCard] = useState(null);
  const [loading, setLoading] = useState(true);

  /* Load initial state */
  useEffect(() => {
    (async () => {
      const g = await loadGame();
      setGame(g || INITIAL_GAME);
      setLoading(false);
    })();
  }, []);

  /* Real-time listener — Firebase pushes updates instantly */
  useEffect(() => {
    if (!me) return;
    const unsub = onGameUpdate((g) => {
      setGame((prev) => {
        if (!prev || g.ts !== prev.ts) return g;
        return prev;
      });
    });
    return () => unsub();
  }, [me]);

  const joinAs = async (who) => {
    let g = await loadGame();
    if (!g) g = { ...INITIAL_GAME };
    g.players[who].joined = true;
    if (g.players.alisa.joined && g.players.alesha.joined) g.phase = "playing";
    await saveGame(g);
    setGame(g);
    setMe(who);
  };

  const resetGame = async () => {
    const g = { ...INITIAL_GAME, ts: Date.now() };
    await saveGame(g);
    setGame(g);
    setMe(null);
    setEventCard(null);
    setDiceAnim(null);
  };

  const doTurn = async () => {
    if (!game || game.currentTurn !== me || diceAnim || eventCard) return;
    const diceResult = rollMoveDice(me);

    setDiceAnim({ rolling: true, value: 1 });
    let count = 0;
    const animInterval = setInterval(() => {
      setDiceAnim({ rolling: true, value: Math.floor(Math.random() * 6) + 1 });
      count++;
      if (count >= 10) {
        clearInterval(animInterval);
        setDiceAnim({ rolling: false, value: diceResult });

        setTimeout(() => {
          const g = JSON.parse(JSON.stringify(game));
          const p = g.players[me];
          const newPos = Math.min(p.pos + diceResult, TOTAL_TILES - 1);
          p.pos = newPos;

          const tile = BOARD[newPos];
          const result = resolveTile(tile, me, p);

          p.hp = Math.max(0, Math.min(p.maxHp, p.hp + result.hpChange));
          p.attack += result.atkChange;
          if (result.posChange) {
            p.pos = Math.max(0, Math.min(TOTAL_TILES - 1, p.pos + result.posChange));
          }

          if (result.bossWin) {
            g.winner = me;
            g.phase = "finished";
          } else if (p.hp <= 0) {
            const other = me === "alisa" ? "alesha" : "alisa";
            g.winner = other;
            g.phase = "finished";
          }

          g.currentTurn = me === "alisa" ? "alesha" : "alisa";
          g.turn++;
          g.lastEvent = { player: me, ...result, dice: diceResult, newPos };

          setEventCard({ player: me, ...result, dice: diceResult });

          saveGame(g).then(() => setGame(g));
        }, 400);
      }
    }, 80);
  };

  const dismissEvent = () => {
    setEventCard(null);
    setDiceAnim(null);
  };

  if (loading) return (
    <div style={styles.loadingScreen}>
      <div style={styles.loadingIcon}>🌲</div>
      <div style={{ color: "#a7f3d0", fontFamily: "'Cinzel Decorative', serif", fontSize: 18 }}>Загрузка...</div>
    </div>
  );

  /* LOBBY */
  if (!me || !game || game.phase === "lobby") {
    const alisaJoined = game?.players?.alisa?.joined;
    const aleshaJoined = game?.players?.alesha?.joined;
    return (
      <div style={styles.lobbyScreen}>
        <link href="https://fonts.googleapis.com/css2?family=Cinzel+Decorative:wght@400;700&family=Alegreya:ital,wght@0,400;0,700;1,400&display=swap" rel="stylesheet" />
        <div style={styles.lobbyGlow} />
        <div style={styles.lobbyTitle}>Зачарованный Лес</div>
        <div style={styles.lobbySubtitle}>Приключение для двоих</div>
        <div style={styles.lobbyDesc}>
          Пройди сквозь тёмный лес, сражайся с монстрами, собирай сокровища и одолей Дракона первым!
        </div>
        <div style={styles.lobbyPlayers}>
          <button
            onClick={() => !me && !alisaJoined && joinAs("alisa")}
            disabled={!!me || alisaJoined}
            style={{
              ...styles.playerBtn,
              ...(alisaJoined ? styles.playerBtnJoined : {}),
              borderColor: "#f472b6",
              background: alisaJoined ? "rgba(244,114,182,0.15)" : "rgba(244,114,182,0.05)",
            }}
          >
            <span style={{ fontSize: 40 }}>🧝‍♀️</span>
            <span style={styles.playerName}>Алиса</span>
            {alisaJoined && <span style={styles.joinedBadge}>✓ В игре</span>}
          </button>
          <div style={{ color: "#4ade80", fontFamily: "'Cinzel Decorative'", fontSize: 20, opacity: 0.5 }}>VS</div>
          <button
            onClick={() => !me && !aleshaJoined && joinAs("alesha")}
            disabled={!!me || aleshaJoined}
            style={{
              ...styles.playerBtn,
              ...(aleshaJoined ? styles.playerBtnJoined : {}),
              borderColor: "#60a5fa",
              background: aleshaJoined ? "rgba(96,165,250,0.15)" : "rgba(96,165,250,0.05)",
            }}
          >
            <span style={{ fontSize: 40 }}>🧙‍♂️</span>
            <span style={styles.playerName}>Алёша</span>
            {aleshaJoined && <span style={styles.joinedBadge}>✓ В игре</span>}
          </button>
        </div>
        {me && !(alisaJoined && aleshaJoined) && (
          <div style={styles.waitingText}>Ждём второго игрока...</div>
        )}
        {game && (alisaJoined || aleshaJoined) && (
          <button onClick={resetGame} style={styles.resetBtnSmall}>Сбросить</button>
        )}
      </div>
    );
  }

  const myState = game.players[me];
  const other = me === "alisa" ? "alesha" : "alisa";
  const otherState = game.players[other];
  const isMyTurn = game.currentTurn === me && game.phase === "playing";
  const myColor = me === "alisa" ? "#f472b6" : "#60a5fa";
  const otherColor = me === "alisa" ? "#60a5fa" : "#f472b6";
  const myEmoji = me === "alisa" ? "🧝‍♀️" : "🧙‍♂️";
  const otherEmoji = me === "alisa" ? "🧙‍♂️" : "🧝‍♀️";
  const myLabel = me === "alisa" ? "Алиса" : "Алёша";
  const otherLabel = me === "alisa" ? "Алёша" : "Алиса";

  return (
    <div style={styles.gameScreen}>
      <link href="https://fonts.googleapis.com/css2?family=Cinzel+Decorative:wght@400;700&family=Alegreya:ital,wght@0,400;0,700;1,400&display=swap" rel="stylesheet" />

      <div style={styles.header}>
        <div style={styles.headerTitle}>Зачарованный Лес</div>
        <button onClick={resetGame} style={styles.resetBtn}>↺</button>
      </div>

      <div style={styles.statsRow}>
        <div style={{ ...styles.statCard, borderColor: myColor, boxShadow: isMyTurn ? `0 0 20px ${myColor}44` : "none" }}>
          <div style={styles.statName}>{myEmoji} {myLabel} {isMyTurn && "◀"}</div>
          <div style={styles.hpBarOuter}>
            <div style={{ ...styles.hpBarInner, width: `${(myState.hp / myState.maxHp) * 100}%`, background: myColor }} />
          </div>
          <div style={styles.statNumbers}>HP: {myState.hp} · ATK: {myState.attack}</div>
        </div>
        <div style={{ ...styles.statCard, borderColor: otherColor, boxShadow: !isMyTurn && game.phase === "playing" ? `0 0 20px ${otherColor}44` : "none" }}>
          <div style={styles.statName}>{otherEmoji} {otherLabel} {!isMyTurn && game.phase === "playing" && "◀"}</div>
          <div style={styles.hpBarOuter}>
            <div style={{ ...styles.hpBarInner, width: `${(otherState.hp / otherState.maxHp) * 100}%`, background: otherColor }} />
          </div>
          <div style={styles.statNumbers}>HP: {otherState.hp} · ATK: {otherState.attack}</div>
        </div>
      </div>

      <div style={styles.boardContainer}>
        <div style={styles.board}>
          {BOARD.map((tile) => {
            const { row, col } = getTilePos(tile.id);
            const meta = TILE_META[tile.type];
            const hasMe = myState.pos === tile.id;
            const hasOther = otherState.pos === tile.id;
            return (
              <div
                key={tile.id}
                style={{
                  ...styles.tile,
                  gridRow: row + 1,
                  gridColumn: col + 1,
                  borderColor: meta.color + "66",
                  background: `${meta.color}11`,
                  ...(hasMe || hasOther ? { boxShadow: `0 0 12px ${hasMe ? myColor : otherColor}55`, transform: "scale(1.05)" } : {}),
                }}
              >
                <span style={{ fontSize: 18 }}>{meta.icon}</span>
                <span style={{ fontSize: 8, color: "#9ca3af", marginTop: 1 }}>{tile.id}</span>
                <div style={styles.tileTokens}>
                  {hasMe && <span style={{ ...styles.token, background: myColor }}>{myEmoji.slice(0,2)}</span>}
                  {hasOther && <span style={{ ...styles.token, background: otherColor }}>{otherEmoji.slice(0,2)}</span>}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      <div style={styles.actionArea}>
        {game.phase === "finished" ? (
          <div style={styles.victoryBox}>
            <div style={{ fontSize: 48 }}>🎉</div>
            <div style={styles.victoryText}>
              {game.winner === "alisa" ? "🧝‍♀️ Алиса" : "🧙‍♂️ Алёша"} побеждает!
            </div>
            <div style={{ fontSize: 14, color: "#d1d5db", marginBottom: 12 }}>Дракон повержен!</div>
            <button onClick={resetGame} style={styles.bigBtn}>Играть снова</button>
          </div>
        ) : diceAnim ? (
          <div style={styles.diceBox}>
            <div style={{
              ...styles.diceValue,
              ...(diceAnim.rolling ? { animation: "shake 0.1s infinite" } : {}),
            }}>
              🎲 {diceAnim.value}
            </div>
            {!diceAnim.rolling && <div style={{ color: "#a7f3d0", fontSize: 13 }}>Ход: +{diceAnim.value} клеток</div>}
          </div>
        ) : isMyTurn ? (
          <button onClick={doTurn} style={styles.bigBtn}>
            🎲 Бросить кубик
          </button>
        ) : (
          <div style={styles.waitingTurn}>
            Ход {otherEmoji} {otherLabel}...
          </div>
        )}
      </div>

      {!eventCard && game.lastEvent && game.lastEvent.player === other && (
        <div style={styles.lastEventBar}>
          {game.lastEvent.icon} {otherLabel}: {game.lastEvent.msg}
        </div>
      )}

      {eventCard && (
        <div style={styles.overlay} onClick={dismissEvent}>
          <div style={styles.eventCard} onClick={(e) => e.stopPropagation()}>
            <div style={{ fontSize: 48 }}>{eventCard.icon}</div>
            <div style={styles.eventTitle}>{TILE_META[BOARD[game.players[me].pos]?.type]?.label || "Событие"}</div>
            <div style={styles.eventMsg}>{eventCard.msg}</div>
            {eventCard.hpChange !== 0 && (
              <div style={{ color: eventCard.hpChange > 0 ? "#4ade80" : "#f87171", fontSize: 14, fontWeight: 700 }}>
                {eventCard.hpChange > 0 ? "+" : ""}{eventCard.hpChange} HP
              </div>
            )}
            {eventCard.atkChange > 0 && (
              <div style={{ color: "#fbbf24", fontSize: 14, fontWeight: 700 }}>+{eventCard.atkChange} ATK</div>
            )}
            <button onClick={dismissEvent} style={{ ...styles.bigBtn, marginTop: 16 }}>Продолжить</button>
          </div>
        </div>
      )}

      <style>{`
        @keyframes shake {
          0%, 100% { transform: rotate(-5deg) scale(1.1); }
          50% { transform: rotate(5deg) scale(1.1); }
        }
        @keyframes pulse {
          0%, 100% { opacity: 0.6; }
          50% { opacity: 1; }
        }
        @keyframes float {
          0%, 100% { transform: translateY(0); }
          50% { transform: translateY(-8px); }
        }
        @keyframes fadeIn {
          from { opacity: 0; transform: scale(0.9); }
          to { opacity: 1; transform: scale(1); }
        }
      `}</style>
    </div>
  );
}

const styles = {
  loadingScreen: {
    minHeight: "100vh", display: "flex", flexDirection: "column", alignItems: "center",
    justifyContent: "center", background: "linear-gradient(180deg, #022c22 0%, #14532d 50%, #1e1b4b 100%)",
  },
  loadingIcon: { fontSize: 60, marginBottom: 16, animation: "float 2s ease-in-out infinite" },
  lobbyScreen: {
    minHeight: "100vh", display: "flex", flexDirection: "column", alignItems: "center",
    justifyContent: "center", padding: 24,
    background: "linear-gradient(180deg, #022c22 0%, #14532d 40%, #1e1b4b 100%)",
    position: "relative", overflow: "hidden",
  },
  lobbyGlow: {
    position: "absolute", top: "20%", left: "50%", transform: "translateX(-50%)",
    width: 300, height: 300, borderRadius: "50%",
    background: "radial-gradient(circle, rgba(74,222,128,0.15) 0%, transparent 70%)",
    pointerEvents: "none",
  },
  lobbyTitle: {
    fontFamily: "'Cinzel Decorative', serif", fontSize: 32, fontWeight: 700,
    color: "#fbbf24", textShadow: "0 0 30px rgba(251,191,36,0.3)", marginBottom: 8,
    textAlign: "center", zIndex: 1,
  },
  lobbySubtitle: {
    fontFamily: "'Alegreya', serif", fontSize: 16, color: "#a7f3d0",
    marginBottom: 24, fontStyle: "italic", zIndex: 1,
  },
  lobbyDesc: {
    fontFamily: "'Alegreya', serif", fontSize: 14, color: "#d1d5db",
    textAlign: "center", maxWidth: 340, marginBottom: 32, lineHeight: 1.5, zIndex: 1,
  },
  lobbyPlayers: {
    display: "flex", gap: 16, alignItems: "center", zIndex: 1, flexWrap: "wrap",
    justifyContent: "center",
  },
  playerBtn: {
    display: "flex", flexDirection: "column", alignItems: "center", gap: 8,
    padding: "20px 28px", borderRadius: 16, border: "2px solid",
    cursor: "pointer", transition: "all 0.3s", minWidth: 120,
    fontFamily: "'Alegreya', serif",
  },
  playerBtnJoined: { opacity: 0.7, cursor: "default" },
  playerBtnMe: { transform: "scale(1.05)" },
  playerName: { fontFamily: "'Cinzel Decorative', serif", fontSize: 16, color: "#f3f4f6", fontWeight: 700 },
  joinedBadge: { fontSize: 11, color: "#4ade80", fontWeight: 700 },
  waitingText: {
    marginTop: 24, color: "#a7f3d0", fontFamily: "'Alegreya', serif",
    fontSize: 16, fontStyle: "italic", animation: "pulse 2s infinite", zIndex: 1,
  },
  resetBtnSmall: {
    marginTop: 16, background: "none", border: "1px solid #374151", color: "#9ca3af",
    padding: "6px 14px", borderRadius: 8, cursor: "pointer", fontSize: 12, zIndex: 1,
  },
  gameScreen: {
    minHeight: "100vh", display: "flex", flexDirection: "column",
    background: "linear-gradient(180deg, #022c22 0%, #14532d 40%, #1e1b4b 100%)",
    fontFamily: "'Alegreya', serif", color: "#f3f4f6",
  },
  header: {
    display: "flex", justifyContent: "space-between", alignItems: "center",
    padding: "12px 16px", borderBottom: "1px solid #166534",
  },
  headerTitle: { fontFamily: "'Cinzel Decorative', serif", fontSize: 16, color: "#fbbf24" },
  resetBtn: {
    background: "none", border: "1px solid #374151", color: "#9ca3af",
    width: 32, height: 32, borderRadius: 8, cursor: "pointer", fontSize: 16,
  },
  statsRow: { display: "flex", gap: 8, padding: "8px 12px" },
  statCard: {
    flex: 1, padding: "8px 10px", borderRadius: 10, border: "1px solid",
    background: "rgba(0,0,0,0.2)", transition: "box-shadow 0.3s",
  },
  statName: { fontSize: 13, fontWeight: 700, marginBottom: 4 },
  hpBarOuter: { height: 6, background: "#1f2937", borderRadius: 3, overflow: "hidden", marginBottom: 3 },
  hpBarInner: { height: "100%", borderRadius: 3, transition: "width 0.5s" },
  statNumbers: { fontSize: 11, color: "#9ca3af" },
  boardContainer: { flex: 1, overflow: "auto", padding: "8px 12px" },
  board: {
    display: "grid", gridTemplateColumns: `repeat(${COLS}, 1fr)`,
    gap: 4, maxWidth: 400, margin: "0 auto",
  },
  tile: {
    aspectRatio: "1", borderRadius: 8, border: "1.5px solid",
    display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center",
    position: "relative", transition: "all 0.3s", minHeight: 48,
  },
  tileTokens: {
    position: "absolute", bottom: 2, display: "flex", gap: 2,
  },
  token: {
    width: 16, height: 16, borderRadius: "50%", fontSize: 10,
    display: "flex", alignItems: "center", justifyContent: "center",
    border: "1.5px solid rgba(255,255,255,0.5)",
  },
  actionArea: {
    padding: "12px 16px", borderTop: "1px solid #166534",
    display: "flex", justifyContent: "center", minHeight: 70, alignItems: "center",
  },
  bigBtn: {
    background: "linear-gradient(135deg, #166534, #14532d)",
    border: "2px solid #4ade80", color: "#f3f4f6", padding: "12px 32px",
    borderRadius: 12, fontSize: 16, fontWeight: 700, cursor: "pointer",
    fontFamily: "'Cinzel Decorative', serif",
    boxShadow: "0 0 20px rgba(74,222,128,0.2)",
    transition: "all 0.2s",
  },
  diceBox: { display: "flex", flexDirection: "column", alignItems: "center", gap: 4 },
  diceValue: {
    fontSize: 36, fontWeight: 700, fontFamily: "'Cinzel Decorative', serif",
    color: "#fbbf24", textShadow: "0 0 20px rgba(251,191,36,0.4)",
  },
  waitingTurn: {
    color: "#a7f3d0", fontSize: 16, fontStyle: "italic", animation: "pulse 2s infinite",
  },
  lastEventBar: {
    padding: "8px 16px", background: "rgba(0,0,0,0.3)", fontSize: 12,
    color: "#d1d5db", borderTop: "1px solid #1f2937", textAlign: "center",
  },
  overlay: {
    position: "fixed", inset: 0, background: "rgba(0,0,0,0.75)",
    display: "flex", alignItems: "center", justifyContent: "center",
    zIndex: 100, padding: 24, animation: "fadeIn 0.3s",
  },
  eventCard: {
    background: "linear-gradient(180deg, #1e1b4b, #022c22)",
    border: "2px solid #fbbf24", borderRadius: 20, padding: "28px 24px",
    textAlign: "center", maxWidth: 320, width: "100%",
    boxShadow: "0 0 40px rgba(251,191,36,0.2)",
  },
  eventTitle: {
    fontFamily: "'Cinzel Decorative', serif", fontSize: 18, color: "#fbbf24",
    marginTop: 8, marginBottom: 8,
  },
  eventMsg: { fontSize: 14, color: "#d1d5db", lineHeight: 1.5, marginBottom: 8 },
  victoryBox: { textAlign: "center" },
  victoryText: {
    fontFamily: "'Cinzel Decorative', serif", fontSize: 22, color: "#fbbf24",
    marginTop: 8, marginBottom: 4, textShadow: "0 0 30px rgba(251,191,36,0.5)",
  },
};
