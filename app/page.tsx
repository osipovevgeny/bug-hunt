"use client";

import { useCallback, useEffect, useRef, useState } from "react";

type GameStatus = "idle" | "running" | "finished";
type TargetKind = "bug" | "trap";

type Target = {
  id: number;
  kind: TargetKind;
  x: number;
  y: number;
  rotation: number;
  size: number;
};

type Feedback = {
  id: number;
  text: string;
  tone: "good" | "bad";
};

const GAME_SECONDS = 45;
const MAX_LIVES = 3;

function randomBetween(min: number, max: number) {
  return Math.random() * (max - min) + min;
}

export default function Home() {
  const [status, setStatus] = useState<GameStatus>("idle");
  const [score, setScore] = useState(0);
  const [bestScore, setBestScore] = useState(0);
  const [lives, setLives] = useState(MAX_LIVES);
  const [combo, setCombo] = useState(0);
  const [timeLeft, setTimeLeft] = useState(GAME_SECONDS);
  const [target, setTarget] = useState<Target | null>(null);
  const [feedback, setFeedback] = useState<Feedback | null>(null);

  const runningRef = useRef(false);
  const endTimeRef = useRef(0);
  const scoreRef = useRef(0);
  const livesRef = useRef(MAX_LIVES);
  const comboRef = useRef(0);
  const targetTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const respawnTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const feedbackTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const spawnRef = useRef<() => void>(() => undefined);

  useEffect(() => {
    const saved = Number(window.localStorage.getItem("bug-hunt-best") ?? 0);
    if (Number.isFinite(saved)) setBestScore(saved);
  }, []);

  const clearGameTimers = useCallback(() => {
    if (targetTimerRef.current) clearTimeout(targetTimerRef.current);
    if (respawnTimerRef.current) clearTimeout(respawnTimerRef.current);
  }, []);

  const showFeedback = useCallback((text: string, tone: "good" | "bad") => {
    if (feedbackTimerRef.current) clearTimeout(feedbackTimerRef.current);
    setFeedback({ id: Date.now(), text, tone });
    feedbackTimerRef.current = setTimeout(() => setFeedback(null), 650);
  }, []);

  const finishGame = useCallback(() => {
    if (!runningRef.current) return;
    runningRef.current = false;
    clearGameTimers();
    setTarget(null);
    setStatus("finished");

    const finalScore = scoreRef.current;
    setBestScore((currentBest) => {
      const nextBest = Math.max(currentBest, finalScore);
      window.localStorage.setItem("bug-hunt-best", String(nextBest));
      return nextBest;
    });
  }, [clearGameTimers]);

  const loseLife = useCallback(
    (message: string) => {
      comboRef.current = 0;
      setCombo(0);
      const nextLives = Math.max(0, livesRef.current - 1);
      livesRef.current = nextLives;
      setLives(nextLives);
      showFeedback(message, "bad");
      if (nextLives === 0) finishGame();
      return nextLives;
    },
    [finishGame, showFeedback],
  );

  const spawnTarget = useCallback(() => {
    if (!runningRef.current) return;

    const elapsed = GAME_SECONDS * 1000 - (endTimeRef.current - Date.now());
    const progress = Math.min(1, Math.max(0, elapsed / (GAME_SECONDS * 1000)));
    const kind: TargetKind = Math.random() < 0.14 + progress * 0.13 ? "trap" : "bug";
    const nextTarget: Target = {
      id: Date.now() + Math.floor(Math.random() * 1000),
      kind,
      x: randomBetween(10, 86),
      y: randomBetween(22, 82),
      rotation: randomBetween(-16, 16),
      size: randomBetween(58, 74),
    };

    setTarget(nextTarget);
    const lifetime = 1080 - progress * 470;
    targetTimerRef.current = setTimeout(() => {
      if (!runningRef.current) return;
      setTarget(null);
      const remainingLives = kind === "bug" ? loseLife("БАГ УСКОЛЬЗНУЛ −1") : livesRef.current;
      if (remainingLives > 0 && runningRef.current) {
        respawnTimerRef.current = setTimeout(() => spawnRef.current(), 130);
      }
    }, lifetime);
  }, [loseLife]);

  spawnRef.current = spawnTarget;

  useEffect(() => {
    if (status !== "running") return;

    const ticker = window.setInterval(() => {
      const remaining = Math.max(0, Math.ceil((endTimeRef.current - Date.now()) / 1000));
      setTimeLeft(remaining);
      if (remaining === 0) finishGame();
    }, 100);

    return () => window.clearInterval(ticker);
  }, [finishGame, status]);

  useEffect(() => {
    return () => {
      clearGameTimers();
      if (feedbackTimerRef.current) clearTimeout(feedbackTimerRef.current);
    };
  }, [clearGameTimers]);

  function startGame() {
    clearGameTimers();
    scoreRef.current = 0;
    livesRef.current = MAX_LIVES;
    comboRef.current = 0;
    endTimeRef.current = Date.now() + GAME_SECONDS * 1000;
    runningRef.current = true;

    setScore(0);
    setLives(MAX_LIVES);
    setCombo(0);
    setTimeLeft(GAME_SECONDS);
    setFeedback(null);
    setTarget(null);
    setStatus("running");
    respawnTimerRef.current = setTimeout(() => spawnRef.current(), 260);
  }

  function hitTarget(hit: Target) {
    if (!runningRef.current) return;
    if (targetTimerRef.current) clearTimeout(targetTimerRef.current);
    setTarget(null);

    if (hit.kind === "trap") {
      const remainingLives = loseLife("ЛОВУШКА −1");
      if (remainingLives === 0) return;
    } else {
      const nextCombo = comboRef.current + 1;
      comboRef.current = nextCombo;
      setCombo(nextCombo);
      const points = 10 + Math.min(20, (nextCombo - 1) * 2);
      const nextScore = scoreRef.current + points;
      scoreRef.current = nextScore;
      setScore(nextScore);
      showFeedback(`+${points}${nextCombo >= 3 ? " КОМБО!" : ""}`, "good");
    }

    if (runningRef.current) {
      respawnTimerRef.current = setTimeout(() => spawnRef.current(), 100);
    }
  }

  const progress = Math.max(0, (timeLeft / GAME_SECONDS) * 100);
  const isNewRecord = status === "finished" && score > 0 && score >= bestScore;

  return (
    <main className="site-shell">
      <header className="topbar">
        <div className="brand-lockup">
          <a className="brand" href="#game" aria-label="Охота на баги — к игре">
            <span className="brand-mark" aria-hidden="true">B</span>
            <span>BUG<span>//</span>HUNT</span>
          </a>
          <span className="creator-credit">БАЙ <strong>ЕВГЕНИЙ ОСИПОВ</strong></span>
        </div>
        <div className="best-score" aria-label={`Лучший результат: ${bestScore}`}>
          <span>ЛУЧШИЙ РЕЗУЛЬТАТ</span>
          <strong>{String(bestScore).padStart(4, "0")}</strong>
        </div>
      </header>

      <section className="game-layout" id="game">
        <div className="intro-panel">
          <p className="eyebrow"><span /> СИСТЕМА ПОД УГРОЗОЙ</p>
          <h1>ОХОТА<br />НА <em>БАГИ</em></h1>
          <p className="lede">
            Лови зелёных вредителей, не трогай красные ловушки и набирай комбо.
            У тебя 45 секунд и всего три жизни.
          </p>

          <div className="rules" aria-label="Правила игры">
            <div className="rule">
              <span className="rule-number">01</span>
              <div><strong>ЛОВИ</strong><small>зелёных багов</small></div>
            </div>
            <div className="rule">
              <span className="rule-number">02</span>
              <div><strong>ИЗБЕГАЙ</strong><small>красных ловушек</small></div>
            </div>
            <div className="rule">
              <span className="rule-number">03</span>
              <div><strong>УСКОРЯЙСЯ</strong><small>каждую секунду</small></div>
            </div>
          </div>
        </div>

        <div className="game-frame">
          <div className="frame-label"><span>LIVE</span> SECURE_NODE_07</div>
          <div className="game-stage" aria-label="Игровое поле">
            <div className="stage-grid" aria-hidden="true" />

            <div className="hud" aria-live="polite">
              <div className="hud-block">
                <span>СЧЁТ</span>
                <strong>{String(score).padStart(4, "0")}</strong>
              </div>
              <div className="hud-block hud-timer">
                <span>ВРЕМЯ</span>
                <strong>{String(timeLeft).padStart(2, "0")}<small>С</small></strong>
              </div>
              <div className="hud-block hud-lives">
                <span>ЖИЗНИ</span>
                <div aria-label={`${lives} из ${MAX_LIVES} жизней`}>
                  {Array.from({ length: MAX_LIVES }).map((_, index) => (
                    <i key={index} className={index < lives ? "active" : ""}>♥</i>
                  ))}
                </div>
              </div>
            </div>

            <div className="time-track" aria-hidden="true">
              <span style={{ width: `${progress}%` }} />
            </div>

            {status === "running" && combo >= 2 && (
              <div className="combo-badge">КОМБО <strong>×{combo}</strong></div>
            )}

            {target && status === "running" && (
              <button
                className={`target target-${target.kind}`}
                style={{
                  left: `${target.x}%`,
                  top: `${target.y}%`,
                  width: target.size,
                  height: target.size,
                  transform: `translate(-50%, -50%) rotate(${target.rotation}deg)`,
                }}
                onClick={() => hitTarget(target)}
                aria-label={target.kind === "bug" ? "Поймать бага" : "Ловушка — не нажимать"}
              >
                <span aria-hidden="true">{target.kind === "bug" ? "🐛" : "✹"}</span>
              </button>
            )}

            {feedback && (
              <div key={feedback.id} className={`feedback feedback-${feedback.tone}`} aria-live="assertive">
                {feedback.text}
              </div>
            )}

            {status !== "running" && (
              <div className="game-overlay">
                {status === "idle" ? (
                  <>
                    <div className="radar" aria-hidden="true"><span /></div>
                    <p className="overlay-kicker">ЦЕЛЬ ОБНАРУЖЕНА</p>
                    <h2>ГОТОВ К ОХОТЕ?</h2>
                    <p>Баги ускоряются по мере игры.<br />Не дай им уйти.</p>
                    <button className="start-button" onClick={startGame}>
                      НАЧАТЬ ОХОТУ <span>→</span>
                    </button>
                    <small>МЫШЬ · КАСАНИЕ · КЛАВИША ENTER</small>
                  </>
                ) : (
                  <>
                    <p className="overlay-kicker">СЕАНС ЗАВЕРШЁН</p>
                    <h2>{isNewRecord ? "НОВЫЙ РЕКОРД!" : "ОХОТА ОКОНЧЕНА"}</h2>
                    <div className="final-score">
                      <span>ТВОЙ СЧЁТ</span>
                      <strong>{String(score).padStart(4, "0")}</strong>
                    </div>
                    <button className="start-button" onClick={startGame}>
                      ЕЩЁ РАЗ <span>↻</span>
                    </button>
                  </>
                )}
              </div>
            )}

            <div className="corner corner-tl" aria-hidden="true" />
            <div className="corner corner-tr" aria-hidden="true" />
            <div className="corner corner-bl" aria-hidden="true" />
            <div className="corner corner-br" aria-hidden="true" />
          </div>
        </div>
      </section>

      <footer>
        <span>GCONF · УЧЕБНЫЙ ПРОЕКТ</span>
        <span>STATUS: <b>READY</b></span>
      </footer>
    </main>
  );
}
