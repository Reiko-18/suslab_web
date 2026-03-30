/** @jsxImportSource @emotion/react */
import { css } from '@emotion/react'
import { useState, useEffect, useCallback, useRef } from 'react'
import { useTranslation } from 'react-i18next'
import { Button } from './ui'

const GRID_SIZE = 4

interface TileColor {
  bg: string
  text: string
}

const TILE_COLORS: Record<number, TileColor> = {
  2: { bg: '#eee4da', text: '#776e65' },
  4: { bg: '#ede0c8', text: '#776e65' },
  8: { bg: '#f2b179', text: '#f9f6f2' },
  16: { bg: '#f59563', text: '#f9f6f2' },
  32: { bg: '#f67c5f', text: '#f9f6f2' },
  64: { bg: '#f65e3b', text: '#f9f6f2' },
  128: { bg: '#edcf72', text: '#f9f6f2' },
  256: { bg: '#edcc61', text: '#f9f6f2' },
  512: { bg: '#edc850', text: '#f9f6f2' },
  1024: { bg: '#edc53f', text: '#f9f6f2' },
  2048: { bg: '#edc22e', text: '#f9f6f2' },
}

type Board = number[][]
type Direction = 'left' | 'right' | 'up' | 'down'

function createEmptyBoard(): Board {
  return Array.from({ length: GRID_SIZE }, () => Array(GRID_SIZE).fill(0))
}

function addRandomTile(board: Board): Board {
  const empty: [number, number][] = []
  for (let r = 0; r < GRID_SIZE; r++) {
    for (let c = 0; c < GRID_SIZE; c++) {
      if (board[r][c] === 0) empty.push([r, c])
    }
  }
  if (empty.length === 0) return board
  const [r, c] = empty[Math.floor(Math.random() * empty.length)]
  const newBoard = board.map((row) => [...row])
  newBoard[r][c] = Math.random() < 0.9 ? 2 : 4
  return newBoard
}

function rotateBoard(board: Board): Board {
  const n = board.length
  const rotated = createEmptyBoard()
  for (let r = 0; r < n; r++) {
    for (let c = 0; c < n; c++) {
      rotated[c][n - 1 - r] = board[r][c]
    }
  }
  return rotated
}

function slideLeft(board: Board): { board: Board; score: number } {
  let score = 0
  const newBoard = board.map((row) => {
    let tiles = row.filter((v) => v !== 0)
    for (let i = 0; i < tiles.length - 1; i++) {
      if (tiles[i] === tiles[i + 1]) {
        tiles[i] *= 2
        score += tiles[i]
        tiles[i + 1] = 0
      }
    }
    tiles = tiles.filter((v) => v !== 0)
    while (tiles.length < GRID_SIZE) tiles.push(0)
    return tiles
  })
  return { board: newBoard, score }
}

function move(board: Board, direction: Direction): { board: Board; score: number } {
  let rotated = board
  const rotations: Record<Direction, number> = { left: 0, up: 1, right: 2, down: 3 }
  const times = rotations[direction]

  for (let i = 0; i < times; i++) rotated = rotateBoard(rotated)

  const { board: slid, score } = slideLeft(rotated)

  let result = slid
  for (let i = 0; i < (4 - times) % 4; i++) result = rotateBoard(result)

  return { board: result, score }
}

function boardsEqual(a: Board, b: Board): boolean {
  for (let r = 0; r < GRID_SIZE; r++) {
    for (let c = 0; c < GRID_SIZE; c++) {
      if (a[r][c] !== b[r][c]) return false
    }
  }
  return true
}

function isGameOver(board: Board): boolean {
  for (let r = 0; r < GRID_SIZE; r++) {
    for (let c = 0; c < GRID_SIZE; c++) {
      if (board[r][c] === 0) return false
    }
  }
  for (let r = 0; r < GRID_SIZE; r++) {
    for (let c = 0; c < GRID_SIZE; c++) {
      const val = board[r][c]
      if (c < GRID_SIZE - 1 && board[r][c + 1] === val) return false
      if (r < GRID_SIZE - 1 && board[r + 1][c] === val) return false
    }
  }
  return true
}

function initBoard(): Board {
  let board = createEmptyBoard()
  board = addRandomTile(board)
  board = addRandomTile(board)
  return board
}

interface GameBoard2048Props {
  bestScore?: number
  onGameOver?: (score: number) => void
  onScoreUpdate?: (score: number) => void
}

export default function GameBoard2048({ bestScore = 0, onGameOver, onScoreUpdate }: GameBoard2048Props) {
  const { t } = useTranslation()
  const [board, setBoard] = useState<Board>(() => initBoard())
  const [score, setScore] = useState(0)
  const [gameOver, setGameOver] = useState(false)
  const boardRef = useRef<HTMLDivElement | null>(null)
  const touchStartRef = useRef<{ x: number; y: number } | null>(null)

  const handleMove = useCallback((direction: Direction) => {
    if (gameOver) return

    setBoard((prevBoard) => {
      const { board: newBoard, score: moveScore } = move(prevBoard, direction)

      if (boardsEqual(prevBoard, newBoard)) return prevBoard

      const withTile = addRandomTile(newBoard)

      setScore((prev) => {
        const newScore = prev + moveScore
        if (onScoreUpdate) onScoreUpdate(newScore)
        return newScore
      })

      if (isGameOver(withTile)) {
        setGameOver(true)
        setTimeout(() => {
          setScore((currentScore) => {
            if (onGameOver) onGameOver(currentScore)
            return currentScore
          })
        }, 100)
      }

      return withTile
    })
  }, [gameOver, onGameOver, onScoreUpdate])

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const keyMap: Record<string, Direction> = {
        ArrowUp: 'up',
        ArrowDown: 'down',
        ArrowLeft: 'left',
        ArrowRight: 'right',
      }
      const dir = keyMap[e.key]
      if (dir) {
        e.preventDefault()
        handleMove(dir)
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [handleMove])

  useEffect(() => {
    const el = boardRef.current
    if (!el) return

    const handleTouchStart = (e: TouchEvent) => {
      const touch = e.touches[0]
      touchStartRef.current = { x: touch.clientX, y: touch.clientY }
    }

    const handleTouchEnd = (e: TouchEvent) => {
      if (!touchStartRef.current) return
      const touch = e.changedTouches[0]
      const dx = touch.clientX - touchStartRef.current.x
      const dy = touch.clientY - touchStartRef.current.y
      const absDx = Math.abs(dx)
      const absDy = Math.abs(dy)
      const minSwipe = 30

      if (Math.max(absDx, absDy) < minSwipe) return

      if (absDx > absDy) {
        handleMove(dx > 0 ? 'right' : 'left')
      } else {
        handleMove(dy > 0 ? 'down' : 'up')
      }

      touchStartRef.current = null
    }

    el.addEventListener('touchstart', handleTouchStart, { passive: true })
    el.addEventListener('touchend', handleTouchEnd, { passive: true })
    return () => {
      el.removeEventListener('touchstart', handleTouchStart)
      el.removeEventListener('touchend', handleTouchEnd)
    }
  }, [handleMove])

  const handleNewGame = () => {
    setBoard(initBoard())
    setScore(0)
    setGameOver(false)
  }

  const gap = 8

  return (
    <div css={css`display: flex; flex-direction: column; align-items: center; gap: 16px;`}>
      {/* 分數列 */}
      <div css={css`display: flex; gap: 24px; align-items: center; width: 100%; justify-content: center;`}>
        <div css={css`text-align: center;`}>
          <span css={css`font-size: 12px; color: var(--color-on-surface-muted);`}>{t('games.score')}</span>
          <p css={css`font-size: 20px; font-weight: 700; color: var(--color-on-surface); margin: 0;`}>{score}</p>
        </div>
        <div css={css`text-align: center;`}>
          <span css={css`font-size: 12px; color: var(--color-on-surface-muted);`}>{t('games.bestScore')}</span>
          <p css={css`font-size: 20px; font-weight: 700; color: var(--color-on-surface); margin: 0;`}>{Math.max(bestScore, score)}</p>
        </div>
        <Button variant="secondary" size="small" onClick={handleNewGame}>{t('games.newGame')}</Button>
      </div>

      {/* 棋盤 */}
      <div
        ref={boardRef}
        css={css`
          position: relative;
          display: grid;
          grid-template-columns: repeat(${GRID_SIZE}, 1fr);
          gap: ${gap}px;
          padding: ${gap}px;
          border-radius: 8px;
          background: var(--color-surface-container);
          touch-action: none;
          user-select: none;
        `}
      >
        {board.flat().map((value, idx) => {
          const colors = TILE_COLORS[value] || { bg: 'var(--color-primary)', text: '#f9f6f2' }
          const isEmpty = value === 0
          return (
            <div
              key={idx}
              css={css`
                width: clamp(64px, 15vw, 80px);
                height: clamp(64px, 15vw, 80px);
                display: flex;
                align-items: center;
                justify-content: center;
                border-radius: 4px;
                background: ${isEmpty ? 'var(--color-surface-dim)' : colors.bg};
                transition: background-color 0.15s ease;
              `}
            >
              {!isEmpty && (
                <span
                  css={css`
                    font-weight: 700;
                    font-size: ${value >= 1024 ? '1rem' : value >= 128 ? '1.2rem' : '1.5rem'};
                    color: ${colors.text};
                    line-height: 1;
                  `}
                >
                  {value}
                </span>
              )}
            </div>
          )
        })}

        {gameOver && (
          <div
            css={css`
              position: absolute;
              inset: 0;
              display: flex;
              flex-direction: column;
              align-items: center;
              justify-content: center;
              background: rgba(0, 0, 0, 0.5);
              border-radius: 8px;
              gap: 8px;
            `}
          >
            <span css={css`font-size: 20px; font-weight: 700; color: #fff;`}>{t('games.gameOver')}</span>
            <span css={css`font-size: 16px; color: #fff;`}>{t('games.score')}: {score}</span>
          </div>
        )}
      </div>
    </div>
  )
}
