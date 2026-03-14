import { useState, useEffect, useCallback, useRef } from "react";
import { saveGame, loadGame, onGameUpdate } from "./firebase.js";

const ANIMALS = ["🦊","🐙","🦋","🐢","🦁","🐧","🦄","🐬","🦎","🐝","🦉","🐸","🦈","🐘","🦩"];
const COLS = 6;

function shuffle(arr) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function createDeck() {
  return shuffle([...ANIMALS, ...ANIMALS]).map((emoji, i) => ({ id: i, emoji }));
}

/* Firebase drops empty arrays — this restores them */
function normalize(g) {
  if (!g) return null;
  return {
    ...g,
    deck: g.deck || [],
    matched: g.matched || [],
    flipped: g.flipped || [],
    scores: g.scores || { alisa: 0, alesha: 0 },
    players: g.players || { alisa: false, alesha: false },
  };
}

const PLAYERS = {
  alisa: { name: "Алиса", emoji: "🧝‍♀️", color: "#f472b6" },
  alesha: { name: "Алёша", emoji: "🧙‍♂️", color: "#60a5fa" },
};

const INITIAL = {
  phase: "lobby",
  deck: [],
  matched: [],
  flipped: [],
  turn: "alisa",
  scores: { alisa: 0, alesha: 0 },
  players: { alisa: false, alesha: false },
  checkPending: false,
  ts: 0,
};

/* ---- Demo cards for lobby ---- */
const DEMO_PAIRS = ["🦊","🐙","🦋"];
const DEMO_DECK = shuffle([...DEMO_PAIRS, ...DEMO_PAIRS]).map((emoji, i) => ({ id: i, emoji }));

function DemoCards() {
  const [cards] = useState(DEMO_DECK);
  const [flipped, setFlipped] = useState([]);
  const [matched, setMatched] = useState([]);
  const [locked, setLocked] = useState(false);

  const handleFlip = (idx) => {
    if (locked || matched.includes(idx) || flipped.includes(idx)) return;
    const next = [...flipped, idx];
    setFlipped(next);
    if (next.length === 2) {
      setLocked(true);
      const [a, b] = next;
      if (cards[a].emoji === cards[b].emoji) {
        setTimeout(() => {
          setMatched(p => [...p, a, b]);
          setFlipped([]);
          setLocked(false);
        }, 500);
      } else {
        setTimeout(() => { setFlipped([]); setLocked(false); }, 800);
      }
    }
  };

  const allMatched = matched.length === cards.length;

  return (
    <div style={{ marginTop: 20, textAlign: "center" }}>
      <div style={{ fontSize: 11, color: "#64748b", marginBottom: 8 }}>
        Попробуй — переверни карточки, найди 3 пары
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 50px)", gap: 5, justifyContent: "center" }}>
        {cards.map((card, idx) => {
          const show = flipped.includes(idx) || matched.includes(idx);
          const done = matched.includes(idx);
          return (
            <button
              key={idx}
              onClick={() => handleFlip(idx)}
              style={{
                width: 50, height: 50, borderRadius: 8,
                border: done ? "1.5px solid #4ade80" : show ? "1.5px solid #60a5fa" : "1.5px solid #334155",
                background: done ? "#14532d" : show ? "#1e3a5f" : "#1e293b",
                display: "flex", alignItems: "center", justifyContent: "center",
                cursor: done ? "default" : "pointer",
                opacity: done ? 0.6 : 1,
                transition: "all 0.2s",
                fontSize: 20, padding: 0,
                fontFamily: "'Nunito', sans-serif",
              }}
            >
              {show ? card.emoji : <span style={{ opacity: 0.3 }}>?</span>}
            </button>
          );
        })}
      </div>
      {allMatched && (
        <div style={{ fontSize: 12, color: "#4ade80", marginTop: 6 }}>Всё работает! Выбирай имя и играй ✓</div>
      )}
    </div>
  );
}

/* ---- Main Game ---- */
export default function App() {
  const [game, setGame] = useState(null);
  const [me, setMe] = useState(null);
  const [loading, setLoading] = useState(true);
  const flipTimerRef = useRef(null);

  useEffect(() => {
    loadGame().then(g => { setGame(normalize(g) || INITIAL); setLoading(false); });
  }, []);

  useEffect(() => {
    if (!me) return;
    const unsub = onGameUpdate((g) => {
      const ng = normalize(g);
      setGame(prev => {
        if (!prev || ng.ts !== prev.ts) return ng;
        return prev;
      });
    });
    return () => unsub();
  }, [me]);

  const joinAs = async (who) => {
    let g = normalize(await loadGame());
    if (!g) g = { ...INITIAL };
    g.players[who] = true;
    if (g.players.alisa && g.players.alesha) {
      g.phase = "playing";
      if (!g.deck || !g.deck.length) g.deck = createDeck();
    }
    await saveGame(g);
    setGame(g);
    setMe(who);
  };

  const reset = async () => {
    if (flipTimerRef.current) clearTimeout(flipTimerRef.current);
    const g = { ...INITIAL, ts: Date.now() };
    await saveGame(g);
    setGame(g);
    setMe(null);
  };

  const handleFlip = useCallback(async (idx) => {
    if (!game || game.turn !== me || game.phase !== "playing") return;
    const matched = game.matched || [];
    const flipped = game.flipped || [];
    if (matched.includes(idx) || flipped.includes(idx)) return;
    if (flipped.length >= 2 || game.checkPending) return;

    const g = normalize(JSON.parse(JSON.stringify(game)));
    g.flipped = [...g.flipped, idx];

    if (g.flipped.length === 2) {
      g.checkPending = true;
      await saveGame(g);
      setGame(g);

      const [a, b] = g.flipped;
      const isMatch = g.deck[a].emoji === g.deck[b].emoji;

      if (flipTimerRef.current) clearTimeout(flipTimerRef.current);
      flipTimerRef.current = setTimeout(async () => {
        const g2 = normalize(JSON.parse(JSON.stringify(g)));
        if (isMatch) {
          g2.matched = [...g2.matched, a, b];
          g2.scores[me] += 1;
        } else {
          g2.turn = me === "alisa" ? "alesha" : "alisa";
        }
        g2.flipped = [];
        g2.checkPending = false;
        if (g2.matched.length === 30) g2.phase = "finished";
        await saveGame(g2);
        setGame(g2);
      }, isMatch ? 600 : 1000);
    } else {
      await saveGame(g);
      setGame(g);
    }
  }, [game, me]);

  if (loading) return (
    <div style={s.root}>
      <link href="https://fonts.googleapis.com/css2?family=Nunito:wght@400;700;800&display=swap" rel="stylesheet" />
      <div style={{ color: "#94a3b8", fontSize: 18 }}>🃏 Загрузка...</div>
    </div>
  );

  // LOBBY
  if (!me || !game || game.phase === "lobby") {
    const aj = game?.players?.alisa;
    const bj = game?.players?.alesha;
    return (
      <div style={s.root}>
        <link href="https://fonts.googleapis.com/css2?family=Nunito:wght@400;700;800&display=swap" rel="stylesheet" />
        <div style={s.lobbyIcon}>🃏</div>
        <div style={s.lobbyTitle}>Мемо</div>
        <div style={s.lobbyDesc}>15 пар · 30 карточек · Животные</div>
        <div style={s.lobbyRow}>
          {["alisa", "alesha"].map(k => {
            const p = PLAYERS[k];
            const joined = game?.players?.[k];
            return (
              <button
                key={k}
                onClick={() => !me && !joined && joinAs(k)}
                disabled={!!me || joined}
                style={{
                  ...s.lobbyBtn,
                  borderColor: p.color,
                  background: joined ? p.color + "18" : "transparent",
                  opacity: joined && me !== k ? 0.6 : 1,
                }}
              >
                <span style={{ fontSize: 32 }}>{p.emoji}</span>
                <span style={{ color: p.color, fontWeight: 800, fontSize: 15 }}>{p.name}</span>
                {joined && <span style={{ color: "#4ade80", fontSize: 11, fontWeight: 700 }}>✓ В игре</span>}
              </button>
            );
          })}
        </div>
        {me && !(aj && bj) && (
          <div style={s.waiting}>Ждём второго игрока...</div>
        )}

        <DemoCards />

        {game && (aj || bj) && (
          <button onClick={reset} style={s.resetSmall}>Сбросить</button>
        )}
      </div>
    );
  }

  // GAME
  const matched = game.matched || [];
  const flipped = game.flipped || [];
  const deck = game.deck || [];
  const isMyTurn = game.turn === me && game.phase === "playing";
  const tp = PLAYERS[game.turn];
  const winner = game.phase === "finished"
    ? game.scores.alisa > game.scores.alesha ? "alisa"
    : game.scores.alesha > game.scores.alisa ? "alesha"
    : "draw"
    : null;

  return (
    <div style={s.root}>
      <link href="https://fonts.googleapis.com/css2?family=Nunito:wght@400;700;800&display=swap" rel="stylesheet" />

      <div style={s.scoreBar}>
        {["alisa", "alesha"].map(k => {
          const p = PLAYERS[k];
          const active = game.turn === k && game.phase === "playing";
          return (
            <div key={k} style={{
              ...s.scoreCard,
              borderColor: active ? p.color : "transparent",
              background: active ? p.color + "15" : "rgba(255,255,255,0.03)",
            }}>
              <div style={{ fontSize: 11, color: active ? p.color : "#64748b" }}>
                {p.emoji} {p.name} {k === me && "(ты)"}
              </div>
              <div style={{ fontSize: 24, fontWeight: 800, color: p.color }}>{game.scores[k]}</div>
            </div>
          );
        })}
      </div>

      {game.phase === "playing" && (
        <div style={{
          ...s.turnBar,
          color: isMyTurn ? tp.color : "#94a3b8",
          background: isMyTurn ? tp.color + "10" : "transparent",
        }}>
          {isMyTurn ? "Твой ход! Переверни 2 карточки" : `Ход ${tp.emoji} ${tp.name}...`}
        </div>
      )}

      {winner && (
        <div style={s.victoryBar}>
          {winner === "draw"
            ? "🤝 Ничья!"
            : `🎉 ${PLAYERS[winner].emoji} ${PLAYERS[winner].name} побеждает!`
          }
          <div style={{ fontSize: 13, color: "#94a3b8", marginTop: 2 }}>
            {game.scores.alisa} : {game.scores.alesha}
          </div>
        </div>
      )}

      <div style={s.boardWrap}>
        <div style={s.board}>
          {deck.map((card, idx) => {
            const isFlipped = flipped.includes(idx);
            const isMatched = matched.includes(idx);
            const show = isFlipped || isMatched;
            return (
              <button
                key={idx}
                onClick={() => handleFlip(idx)}
                disabled={!isMyTurn || isMatched || isFlipped || game.phase !== "playing"}
                style={{
                  ...s.card,
                  ...(isMatched ? s.cardMatched : {}),
                  ...(isFlipped && !isMatched ? s.cardFlipped : {}),
                  cursor: isMyTurn && !isMatched && !isFlipped && game.phase === "playing" ? "pointer" : "default",
                }}
              >
                {show ? (
                  <span style={{ fontSize: 22 }}>{card.emoji}</span>
                ) : (
                  <span style={{ fontSize: 16, opacity: 0.3 }}>?</span>
                )}
              </button>
            );
          })}
        </div>
      </div>

      <button onClick={reset} style={s.resetBottom}>↺ Новая игра</button>

      <style>{`
        @keyframes pop { 0% { transform: scale(1); } 50% { transform: scale(1.15); } 100% { transform: scale(1); } }
      `}</style>
    </div>
  );
}

const s = {
  root: {
    minHeight: "100vh",
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    justifyContent: "center",
    background: "#0f172a",
    fontFamily: "'Nunito', sans-serif",
    color: "#f1f5f9",
    padding: "12px 8px",
    gap: 8,
  },
  lobbyIcon: { fontSize: 56, marginBottom: 4 },
  lobbyTitle: { fontSize: 28, fontWeight: 800, color: "#e2e8f0", marginBottom: 2 },
  lobbyDesc: { fontSize: 13, color: "#64748b", marginBottom: 24 },
  lobbyRow: { display: "flex", gap: 14 },
  lobbyBtn: {
    display: "flex", flexDirection: "column", alignItems: "center", gap: 6,
    padding: "18px 24px", borderRadius: 14, border: "2px solid",
    background: "transparent", cursor: "pointer", minWidth: 110,
    fontFamily: "'Nunito', sans-serif", transition: "all 0.2s",
  },
  waiting: { marginTop: 20, color: "#64748b", fontSize: 14, fontStyle: "italic" },
  resetSmall: {
    marginTop: 14, background: "none", border: "1px solid #334155",
    color: "#64748b", padding: "5px 12px", borderRadius: 6, cursor: "pointer", fontSize: 11,
  },
  scoreBar: {
    display: "flex", gap: 8, width: "100%", maxWidth: 360, justifyContent: "center",
  },
  scoreCard: {
    flex: 1, textAlign: "center", padding: "6px 8px", borderRadius: 10,
    border: "1.5px solid", transition: "all 0.3s",
  },
  turnBar: {
    fontSize: 13, fontWeight: 700, padding: "5px 14px", borderRadius: 8,
    transition: "all 0.3s", textAlign: "center",
  },
  victoryBar: {
    fontSize: 16, fontWeight: 800, color: "#fbbf24", padding: "8px 16px",
    borderRadius: 8, background: "rgba(251,191,36,0.1)", textAlign: "center",
  },
  boardWrap: {
    width: "100%", maxWidth: 360, display: "flex", justifyContent: "center",
  },
  board: {
    display: "grid",
    gridTemplateColumns: `repeat(${COLS}, 1fr)`,
    gap: 5,
    width: "100%",
  },
  card: {
    aspectRatio: "1",
    borderRadius: 8,
    border: "1.5px solid #334155",
    background: "#1e293b",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    transition: "all 0.2s",
    padding: 0,
    fontFamily: "'Nunito', sans-serif",
  },
  cardFlipped: {
    background: "#1e3a5f",
    borderColor: "#60a5fa",
    animation: "pop 0.3s ease",
  },
  cardMatched: {
    background: "#14532d",
    borderColor: "#4ade80",
    opacity: 0.65,
  },
  resetBottom: {
    background: "none", border: "1px solid #334155", color: "#64748b",
    padding: "6px 16px", borderRadius: 8, cursor: "pointer", fontSize: 12,
    fontFamily: "'Nunito', sans-serif",
  },
};
