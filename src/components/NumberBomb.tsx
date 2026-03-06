import { useState, useEffect, useCallback, useRef } from "react";
import {
  ensureAudioStarted,
  startBackgroundMusic,
  stopBackgroundMusic,
  setDangerMode,
  playGuessSound,
  playSafeSound,
  playExplosionSound,
  playStartSound,
  getIsMusicPlaying,
} from "../audio/audioEngine";

const COLORS = [
  "#FF6B6B", "#4ECDC4", "#FFE66D", "#A78BFA",
  "#F97316", "#06B6D4", "#EC4899", "#84CC16",
];

interface Particle {
  id: number;
  x: number;
  y: number;
  vx: number;
  vy: number;
  size: number;
  color: string;
  rotation: number;
}

// Particle explosion component
function Explosion({ onComplete }: { onComplete?: () => void }) {
  const [particles, setParticles] = useState<Particle[]>([]);
  const [opacity, setOpacity] = useState(1);

  useEffect(() => {
    const p: Particle[] = [];
    for (let i = 0; i < 40; i++) {
      const angle = (Math.PI * 2 * i) / 40;
      const speed = 2 + Math.random() * 6;
      p.push({
        id: i,
        x: 0,
        y: 0,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        size: 4 + Math.random() * 10,
        color: ["#FF4136", "#FF851B", "#FFDC00", "#FF6B6B", "#FFE66D"][
          Math.floor(Math.random() * 5)
        ],
        rotation: Math.random() * 360,
      });
    }
    setParticles(p);

    let frame = 0;
    const interval = setInterval(() => {
      frame++;
      setParticles((prev) =>
        prev.map((pt) => ({
          ...pt,
          x: pt.x + pt.vx,
          y: pt.y + pt.vy,
          vy: pt.vy + 0.15,
          size: pt.size * 0.97,
        }))
      );
      setOpacity(1 - frame / 60);
      if (frame > 60) {
        clearInterval(interval);
        onComplete?.();
      }
    }, 16);
    return () => clearInterval(interval);
  }, [onComplete]);

  return (
    <div
      style={{
        position: "absolute",
        inset: 0,
        pointerEvents: "none",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      {particles.map((p) => (
        <div
          key={p.id}
          style={{
            position: "absolute",
            width: p.size,
            height: p.size,
            background: p.color,
            borderRadius: p.size > 8 ? "2px" : "50%",
            transform: `translate(${p.x}px, ${p.y}px) rotate(${p.rotation}deg)`,
            opacity,
            transition: "none",
          }}
        />
      ))}
    </div>
  );
}

// Shaking bomb emoji
function BombIcon({ shaking }: { shaking: boolean }) {
  return (
    <span
      style={{
        fontSize: "4rem",
        display: "inline-block",
        animation: shaking
          ? "shake 0.1s infinite"
          : "float 2s ease-in-out infinite",
      }}
    >
      💣
    </span>
  );
}

// Screen shake wrapper
function ScreenShake({
  active,
  children,
}: {
  active: boolean;
  children: React.ReactNode;
}) {
  return (
    <div
      style={{
        animation: active ? "screenShake 0.4s ease-out" : "none",
      }}
    >
      {children}
    </div>
  );
}

enum Phase {
  SETUP = "setup",
  PLAYING = "playing",
  EXPLODED = "exploded",
}

export default function NumberBomb() {
  const [phase, setPhase] = useState<Phase>(Phase.SETUP);
  const [playerCount, setPlayerCount] = useState(2);
  const [playerNames, setPlayerNames] = useState(["Player 1", "Player 2"]);
  const [bombNumber, setBombNumber] = useState<number | null>(null);
  const [rangeMin, setRangeMin] = useState(0);
  const [rangeMax, setRangeMax] = useState(100);
  const [currentPlayer, setCurrentPlayer] = useState(0);
  const [guess, setGuess] = useState("");
  const [message, setMessage] = useState("");
  const [showExplosion, setShowExplosion] = useState(false);
  const [screenShake, setScreenShake] = useState(false);
  const [explodedPlayer, setExplodedPlayer] = useState("");
  const [narrowAnim, setNarrowAnim] = useState(false);
  const [musicOn, setMusicOn] = useState(true);
  const inputRef = useRef<HTMLInputElement>(null);

  // Toggle music
  const toggleMusic = async () => {
    await ensureAudioStarted();
    if (getIsMusicPlaying()) {
      stopBackgroundMusic();
      setMusicOn(false);
    } else {
      startBackgroundMusic();
      setMusicOn(true);
    }
  };

  // Update danger mode when range changes
  useEffect(() => {
    setDangerMode(rangeMax - rangeMin < 20);
  }, [rangeMin, rangeMax]);

  const handlePlayerCountChange = (count: number) => {
    setPlayerCount(count);
    setPlayerNames((prev) => {
      const names = [...prev];
      while (names.length < count)
        names.push(`Player ${names.length + 1}`);
      return names.slice(0, count);
    });
  };

  const handleNameChange = (index: number, name: string) => {
    setPlayerNames((prev) => {
      const names = [...prev];
      names[index] = name;
      return names;
    });
  };

  const startGame = async () => {
    await ensureAudioStarted();
    const bomb = Math.floor(Math.random() * 99) + 1; // 1-99
    setBombNumber(bomb);
    setRangeMin(0);
    setRangeMax(100);
    setCurrentPlayer(0);
    setGuess("");
    setMessage("");
    setShowExplosion(false);
    setScreenShake(false);
    setExplodedPlayer("");
    setDangerMode(false);
    playStartSound();
    if (musicOn) {
      stopBackgroundMusic();
      startBackgroundMusic();
    }
    setPhase(Phase.PLAYING);
  };

  useEffect(() => {
    if (phase === Phase.PLAYING && inputRef.current) {
      inputRef.current.focus();
    }
  }, [phase, currentPlayer]);

  const submitGuess = useCallback(() => {
    const num = parseInt(guess);
    if (!isNaN(num) && num < 0) {
      setMessage("Number cannot be negative!");
      return;
    }
    if (isNaN(num) || num <= rangeMin || num >= rangeMax) {
      setMessage(`Pick a number between ${rangeMin} and ${rangeMax}!`);
      return;
    }

    if (num === bombNumber) {
      // BOOM!
      playExplosionSound();
      stopBackgroundMusic();
      setExplodedPlayer(playerNames[currentPlayer]);
      setShowExplosion(true);
      setScreenShake(true);
      setPhase(Phase.EXPLODED);
      setTimeout(() => setScreenShake(false), 500);
    } else {
      // Narrow the range
      playSafeSound();
      setNarrowAnim(true);
      setTimeout(() => setNarrowAnim(false), 400);

      if (num < bombNumber!) {
        setRangeMin(num);
      } else {
        setRangeMax(num);
      }
      setMessage(`${playerNames[currentPlayer]} guessed ${num}... safe!`);
      setCurrentPlayer((currentPlayer + 1) % playerCount);
    }
    setGuess("");
  }, [
    guess,
    bombNumber,
    rangeMin,
    rangeMax,
    currentPlayer,
    playerCount,
    playerNames,
  ]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") submitGuess();
  };

  const playerColor = COLORS[currentPlayer % COLORS.length];

  const buttonHover = (color: string): Partial<Record<string, string>> => ({
    background: color,
  });

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Archivo+Black&family=DM+Sans:wght@400;500;700&display=swap');

        * { margin: 0; padding: 0; box-sizing: border-box; }

        @keyframes shake {
          0%, 100% { transform: translateX(0); }
          25% { transform: translateX(-4px) rotate(-2deg); }
          75% { transform: translateX(4px) rotate(2deg); }
        }

        @keyframes float {
          0%, 100% { transform: translateY(0); }
          50% { transform: translateY(-8px); }
        }

        @keyframes screenShake {
          0% { transform: translate(0, 0); }
          10% { transform: translate(-8px, -6px); }
          20% { transform: translate(8px, 4px); }
          30% { transform: translate(-6px, 8px); }
          40% { transform: translate(4px, -4px); }
          50% { transform: translate(-4px, 2px); }
          100% { transform: translate(0, 0); }
        }

        @keyframes slideIn {
          from { transform: translateY(20px); opacity: 0; }
          to { transform: translateY(0); opacity: 1; }
        }

        @keyframes pulseRange {
          0%, 100% { transform: scaleX(1); }
          50% { transform: scaleX(1.03); }
        }

        @keyframes narrowFlash {
          0% { filter: brightness(1); }
          50% { filter: brightness(1.4); }
          100% { filter: brightness(1); }
        }

        @keyframes boomText {
          0% { transform: scale(0.3); opacity: 0; }
          50% { transform: scale(1.2); }
          100% { transform: scale(1); opacity: 1; }
        }

        @keyframes fadeUp {
          from { transform: translateY(10px); opacity: 0; }
          to { transform: translateY(0); opacity: 1; }
        }
      `}</style>

      <ScreenShake active={screenShake}>
        <div
          style={{
            minHeight: "100vh",
            background:
              phase === Phase.EXPLODED
                ? "linear-gradient(135deg, #1a0a0a 0%, #2d0a0a 50%, #1a0a0a 100%)"
                : "linear-gradient(135deg, #0f0f1a 0%, #1a1a2e 50%, #16213e 100%)",
            fontFamily: "'DM Sans', sans-serif",
            color: "#e8e8e8",
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            padding: "2rem",
            transition: "background 0.6s ease",
            position: "relative",
            overflow: "hidden",
          }}
        >
          {/* Subtle grid background */}
          <div
            style={{
              position: "absolute",
              inset: 0,
              backgroundImage:
                "radial-gradient(circle at 1px 1px, rgba(255,255,255,0.03) 1px, transparent 0)",
              backgroundSize: "40px 40px",
              pointerEvents: "none",
            }}
          />

          {/* Music toggle button */}
          <button
            onClick={toggleMusic}
            style={{
              position: "absolute",
              top: "1.2rem",
              right: "1.2rem",
              width: 44,
              height: 44,
              borderRadius: "50%",
              border: "2px solid rgba(255,255,255,0.15)",
              background: "rgba(255,255,255,0.05)",
              color: musicOn ? "#FFE66D" : "#555",
              fontSize: "1.3rem",
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              transition: "all 0.2s",
              zIndex: 10,
            }}
            title={musicOn ? "Mute music" : "Play music"}
          >
            {musicOn ? "\u{1F50A}" : "\u{1F507}"}
          </button>

          {/* ===== SETUP PHASE ===== */}
          {phase === Phase.SETUP && (
            <div
              style={{
                animation: "slideIn 0.5s ease-out",
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                gap: "2rem",
                maxWidth: 420,
                width: "100%",
              }}
            >
              <div style={{ textAlign: "center" }}>
                <BombIcon shaking={false} />
                <h1
                  style={{
                    fontFamily: "'Archivo Black', sans-serif",
                    fontSize: "2.5rem",
                    letterSpacing: "-0.02em",
                    background: "linear-gradient(135deg, #FF6B6B, #FFE66D)",
                    WebkitBackgroundClip: "text",
                    WebkitTextFillColor: "transparent",
                    marginTop: "0.5rem",
                  }}
                >
                  NUMBER BOMB
                </h1>
                <p
                  style={{
                    color: "#888",
                    marginTop: "0.5rem",
                    fontSize: "0.95rem",
                  }}
                >
                  Don't guess the hidden number... or BOOM
                </p>
              </div>

              {/* Player count */}
              <div style={{ width: "100%" }}>
                <label
                  style={{
                    fontSize: "0.8rem",
                    color: "#999",
                    textTransform: "uppercase",
                    letterSpacing: "0.1em",
                    fontWeight: 700,
                  }}
                >
                  Players
                </label>
                <div
                  style={{
                    display: "flex",
                    gap: "0.5rem",
                    marginTop: "0.5rem",
                  }}
                >
                  {[2, 3, 4, 5, 6].map((n) => (
                    <button
                      key={n}
                      onClick={() => handlePlayerCountChange(n)}
                      style={{
                        flex: 1,
                        padding: "0.7rem",
                        border:
                          playerCount === n
                            ? "2px solid #FF6B6B"
                            : "2px solid #2a2a3e",
                        borderRadius: "10px",
                        background:
                          playerCount === n
                            ? "rgba(255,107,107,0.15)"
                            : "rgba(255,255,255,0.03)",
                        color: playerCount === n ? "#FF6B6B" : "#888",
                        fontFamily: "'Archivo Black', sans-serif",
                        fontSize: "1.1rem",
                        cursor: "pointer",
                        transition: "all 0.2s",
                      }}
                    >
                      {n}
                    </button>
                  ))}
                </div>
              </div>

              {/* Player names */}
              <div
                style={{
                  width: "100%",
                  display: "flex",
                  flexDirection: "column",
                  gap: "0.5rem",
                }}
              >
                <label
                  style={{
                    fontSize: "0.8rem",
                    color: "#999",
                    textTransform: "uppercase",
                    letterSpacing: "0.1em",
                    fontWeight: 700,
                  }}
                >
                  Names
                </label>
                {playerNames.slice(0, playerCount).map((name, i) => (
                  <div
                    key={i}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: "0.5rem",
                    }}
                  >
                    <div
                      style={{
                        width: 12,
                        height: 12,
                        borderRadius: "50%",
                        background: COLORS[i % COLORS.length],
                        flexShrink: 0,
                      }}
                    />
                    <input
                      value={name}
                      onChange={(e) => handleNameChange(i, e.target.value)}
                      style={{
                        flex: 1,
                        padding: "0.65rem 0.8rem",
                        border: "2px solid #2a2a3e",
                        borderRadius: "10px",
                        background: "rgba(255,255,255,0.04)",
                        color: "#e8e8e8",
                        fontSize: "0.95rem",
                        fontFamily: "'DM Sans', sans-serif",
                        outline: "none",
                        transition: "border-color 0.2s",
                      }}
                      onFocus={(e) =>
                        (e.target.style.borderColor =
                          COLORS[i % COLORS.length])
                      }
                      onBlur={(e) =>
                        (e.target.style.borderColor = "#2a2a3e")
                      }
                    />
                  </div>
                ))}
              </div>

              <button
                onClick={startGame}
                style={{
                  width: "100%",
                  padding: "1rem",
                  border: "none",
                  borderRadius: "12px",
                  background: "linear-gradient(135deg, #FF6B6B, #FF4136)",
                  color: "white",
                  fontFamily: "'Archivo Black', sans-serif",
                  fontSize: "1.1rem",
                  letterSpacing: "0.05em",
                  cursor: "pointer",
                  transition: "transform 0.15s, box-shadow 0.15s",
                  boxShadow: "0 4px 20px rgba(255,65,54,0.3)",
                }}
                onMouseEnter={(e) => {
                  (e.target as HTMLElement).style.transform =
                    "translateY(-2px)";
                  (e.target as HTMLElement).style.boxShadow =
                    "0 6px 28px rgba(255,65,54,0.4)";
                }}
                onMouseLeave={(e) => {
                  (e.target as HTMLElement).style.transform =
                    "translateY(0)";
                  (e.target as HTMLElement).style.boxShadow =
                    "0 4px 20px rgba(255,65,54,0.3)";
                }}
              >
                START GAME
              </button>
            </div>
          )}

          {/* ===== PLAYING PHASE ===== */}
          {phase === Phase.PLAYING && (
            <div
              style={{
                animation: "slideIn 0.4s ease-out",
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                gap: "1.5rem",
                maxWidth: 420,
                width: "100%",
              }}
            >
              <BombIcon shaking={rangeMax - rangeMin < 20} />

              {/* Range display */}
              <div
                style={{
                  width: "100%",
                  position: "relative",
                  animation: narrowAnim
                    ? "narrowFlash 0.4s ease-out"
                    : "none",
                }}
              >
                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    marginBottom: "0.5rem",
                  }}
                >
                  <span
                    style={{
                      fontFamily: "'Archivo Black', sans-serif",
                      fontSize: "2rem",
                      color: "#4ECDC4",
                    }}
                  >
                    {rangeMin}
                  </span>
                  <span
                    style={{
                      color: "#555",
                      fontSize: "0.85rem",
                      textTransform: "uppercase",
                      letterSpacing: "0.1em",
                    }}
                  >
                    The bomb is between
                  </span>
                  <span
                    style={{
                      fontFamily: "'Archivo Black', sans-serif",
                      fontSize: "2rem",
                      color: "#FF6B6B",
                    }}
                  >
                    {rangeMax}
                  </span>
                </div>

                {/* Visual range bar */}
                <div
                  style={{
                    width: "100%",
                    height: 8,
                    background: "#1a1a2e",
                    borderRadius: 4,
                    overflow: "hidden",
                    position: "relative",
                  }}
                >
                  <div
                    style={{
                      position: "absolute",
                      left: `${rangeMin}%`,
                      width: `${rangeMax - rangeMin}%`,
                      height: "100%",
                      background:
                        rangeMax - rangeMin < 15
                          ? "linear-gradient(90deg, #FF4136, #FF851B)"
                          : "linear-gradient(90deg, #4ECDC4, #FFE66D, #FF6B6B)",
                      borderRadius: 4,
                      transition:
                        "all 0.4s cubic-bezier(0.4, 0, 0.2, 1)",
                      animation:
                        rangeMax - rangeMin < 10
                          ? "pulseRange 0.6s infinite"
                          : "none",
                    }}
                  />
                </div>

                {rangeMax - rangeMin < 15 && (
                  <p
                    style={{
                      textAlign: "center",
                      marginTop: "0.5rem",
                      color: "#FF4136",
                      fontSize: "0.8rem",
                      fontWeight: 700,
                      letterSpacing: "0.15em",
                      textTransform: "uppercase",
                      animation: "pulseRange 0.8s infinite",
                    }}
                  >
                    DANGER ZONE
                  </p>
                )}
              </div>

              {/* Current player */}
              <div
                style={{
                  padding: "0.8rem 1.5rem",
                  borderRadius: "12px",
                  border: `2px solid ${playerColor}`,
                  background: `${playerColor}15`,
                  display: "flex",
                  alignItems: "center",
                  gap: "0.6rem",
                }}
              >
                <div
                  style={{
                    width: 14,
                    height: 14,
                    borderRadius: "50%",
                    background: playerColor,
                  }}
                />
                <span
                  style={{
                    fontFamily: "'Archivo Black', sans-serif",
                    fontSize: "1.1rem",
                    color: playerColor,
                  }}
                >
                  {playerNames[currentPlayer]}'s turn
                </span>
              </div>

              {/* Message */}
              {message && (
                <p
                  style={{
                    color: "#aaa",
                    fontSize: "0.9rem",
                    animation: "fadeUp 0.3s ease-out",
                    textAlign: "center",
                  }}
                >
                  {message}
                </p>
              )}

              {/* Input */}
              <div
                style={{
                  display: "flex",
                  gap: "0.5rem",
                  width: "100%",
                }}
              >
                <input
                  ref={inputRef}
                  type="number"
                  min={0}
                  max={rangeMax - 1}
                  value={guess}
                  onChange={(e) => setGuess(e.target.value)}
                  onKeyDown={handleKeyDown}
                  placeholder={`${rangeMin + 1} – ${rangeMax - 1}`}
                  style={{
                    flex: 1,
                    padding: "0.9rem 1rem",
                    border: `2px solid ${playerColor}40`,
                    borderRadius: "12px",
                    background: "rgba(255,255,255,0.04)",
                    color: "#e8e8e8",
                    fontSize: "1.2rem",
                    fontFamily: "'Archivo Black', sans-serif",
                    textAlign: "center",
                    outline: "none",
                    transition: "border-color 0.2s",
                  }}
                  onFocus={(e) =>
                    (e.target.style.borderColor = playerColor)
                  }
                  onBlur={(e) =>
                    (e.target.style.borderColor = `${playerColor}40`)
                  }
                />
                <button
                  onClick={submitGuess}
                  style={{
                    padding: "0.9rem 1.5rem",
                    border: "none",
                    borderRadius: "12px",
                    background: playerColor,
                    color: "#0f0f1a",
                    fontFamily: "'Archivo Black', sans-serif",
                    fontSize: "1rem",
                    cursor: "pointer",
                    transition: "transform 0.15s",
                  }}
                  onMouseEnter={(e) =>
                    ((e.target as HTMLElement).style.transform =
                      "scale(1.05)")
                  }
                  onMouseLeave={(e) =>
                    ((e.target as HTMLElement).style.transform =
                      "scale(1)")
                  }
                >
                  GUESS
                </button>
              </div>

              {/* Player list */}
              <div
                style={{
                  display: "flex",
                  gap: "0.5rem",
                  flexWrap: "wrap",
                  justifyContent: "center",
                }}
              >
                {playerNames.slice(0, playerCount).map((name, i) => (
                  <span
                    key={i}
                    style={{
                      padding: "0.3rem 0.8rem",
                      borderRadius: "20px",
                      fontSize: "0.8rem",
                      fontWeight: 600,
                      background:
                        i === currentPlayer
                          ? `${COLORS[i % COLORS.length]}30`
                          : "rgba(255,255,255,0.04)",
                      color:
                        i === currentPlayer
                          ? COLORS[i % COLORS.length]
                          : "#555",
                      border:
                        i === currentPlayer
                          ? `1px solid ${COLORS[i % COLORS.length]}50`
                          : "1px solid transparent",
                      transition: "all 0.3s",
                    }}
                  >
                    {name}
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* ===== EXPLODED PHASE ===== */}
          {phase === Phase.EXPLODED && (
            <div
              style={{
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                gap: "1.5rem",
                position: "relative",
              }}
            >
              {showExplosion && (
                <Explosion onComplete={() => setShowExplosion(false)} />
              )}

              <div
                style={{
                  animation:
                    "boomText 0.5s cubic-bezier(0.36, 1.6, 0.4, 1)",
                  textAlign: "center",
                }}
              >
                <div style={{ fontSize: "5rem", marginBottom: "0.5rem" }}>
                  💥
                </div>
                <h1
                  style={{
                    fontFamily: "'Archivo Black', sans-serif",
                    fontSize: "3rem",
                    color: "#FF4136",
                    textShadow: "0 0 40px rgba(255,65,54,0.5)",
                  }}
                >
                  BOOM!
                </h1>
              </div>

              <div
                style={{
                  animation: "fadeUp 0.6s ease-out 0.3s both",
                  textAlign: "center",
                }}
              >
                <p
                  style={{
                    fontSize: "1.3rem",
                    color: "#FF6B6B",
                    fontWeight: 700,
                  }}
                >
                  {explodedPlayer} hit the bomb!
                </p>
                <p
                  style={{
                    fontSize: "1rem",
                    color: "#666",
                    marginTop: "0.5rem",
                  }}
                >
                  The number was{" "}
                  <span
                    style={{
                      fontFamily: "'Archivo Black', sans-serif",
                      color: "#FFE66D",
                      fontSize: "1.3rem",
                    }}
                  >
                    {bombNumber}
                  </span>
                </p>
              </div>

              <button
                onClick={() => setPhase(Phase.SETUP)}
                style={{
                  animation: "fadeUp 0.5s ease-out 0.6s both",
                  padding: "0.9rem 2.5rem",
                  border: "2px solid #FF6B6B",
                  borderRadius: "12px",
                  background: "transparent",
                  color: "#FF6B6B",
                  fontFamily: "'Archivo Black', sans-serif",
                  fontSize: "1rem",
                  cursor: "pointer",
                  transition: "all 0.2s",
                  letterSpacing: "0.05em",
                }}
                onMouseEnter={(e) => {
                  (e.target as HTMLElement).style.background =
                    "rgba(255,107,107,0.15)";
                  (e.target as HTMLElement).style.transform =
                    "translateY(-2px)";
                }}
                onMouseLeave={(e) => {
                  (e.target as HTMLElement).style.background =
                    "transparent";
                  (e.target as HTMLElement).style.transform =
                    "translateY(0)";
                }}
              >
                PLAY AGAIN
              </button>
            </div>
          )}
        </div>
      </ScreenShake>
    </>
  );
}
