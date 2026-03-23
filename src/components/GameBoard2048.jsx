import { useState, useEffect, useCallback, useRef } from 'react'
import { useTranslation } from 'react-i18next'
import Box from '@mui/material/Box'
import Typography from '@mui/material/Typography'
import Button from '@mui/material/Button'
import { useTheme } from '@mui/material/styles'

const GRID_SIZE = 4

const TILE_COLORS = {
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

function createEmptyBoard() {
  return Array.from({ length: GRID_SIZE }, () => Array(GRID_SIZE).fill(0))
}

function addRandomTile(board) {
  const empty = []
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

function rotateBoard(board) {
  const n = board.length
  const rotated = createEmptyBoard()
  for (let r = 0; r < n; r++) {
    for (let c = 0; c < n; c++) {
      rotated[c][n - 1 - r] = board[r][c]
    }
  }
  return rotated
}

function slideLeft(board) {
  let score = 0
  const newBoard = board.map((row) => {
    // Remove zeros
    let tiles = row.filter((v) => v !== 0)
    // Merge adjacent equal tiles
    for (let i = 0; i < tiles.length - 1; i++) {
      if (tiles[i] === tiles[i + 1]) {
        tiles[i] *= 2
        score += tiles[i]
        tiles[i + 1] = 0
      }
    }
    // Remove zeros again after merge
    tiles = tiles.filter((v) => v !== 0)
    // Pad right with zeros
    while (tiles.length < GRID_SIZE) tiles.push(0)
    return tiles
  })
  return { board: newBoard, score }
}

function move(board, direction) {
  let rotated = board
  const rotations = { left: 0, up: 1, right: 2, down: 3 }
  const times = rotations[direction]

  // Rotate so we can always slide left
  for (let i = 0; i < times; i++) rotated = rotateBoard(rotated)

  const { board: slid, score } = slideLeft(rotated)

  // Rotate back
  let result = slid
  for (let i = 0; i < (4 - times) % 4; i++) result = rotateBoard(result)

  return { board: result, score }
}

function boardsEqual(a, b) {
  for (let r = 0; r < GRID_SIZE; r++) {
    for (let c = 0; c < GRID_SIZE; c++) {
      if (a[r][c] !== b[r][c]) return false
    }
  }
  return true
}

function isGameOver(board) {
  // Check for empty cells
  for (let r = 0; r < GRID_SIZE; r++) {
    for (let c = 0; c < GRID_SIZE; c++) {
      if (board[r][c] === 0) return false
    }
  }
  // Check for possible merges
  for (let r = 0; r < GRID_SIZE; r++) {
    for (let c = 0; c < GRID_SIZE; c++) {
      const val = board[r][c]
      if (c < GRID_SIZE - 1 && board[r][c + 1] === val) return false
      if (r < GRID_SIZE - 1 && board[r + 1][c] === val) return false
    }
  }
  return true
}

function initBoard() {
  let board = createEmptyBoard()
  board = addRandomTile(board)
  board = addRandomTile(board)
  return board
}

export default function GameBoard2048({ bestScore = 0, onGameOver, onScoreUpdate }) {
  const { t } = useTranslation()
  const theme = useTheme()
  const [board, setBoard] = useState(() => initBoard())
  const [score, setScore] = useState(0)
  const [gameOver, setGameOver] = useState(false)
  const boardRef = useRef(null)
  const touchStartRef = useRef(null)

  const handleMove = useCallback((direction) => {
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
        // Defer onGameOver to allow state to update first
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

  // Keyboard controls
  useEffect(() => {
    const handleKeyDown = (e) => {
      const keyMap = {
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

  // Touch / swipe controls
  useEffect(() => {
    const el = boardRef.current
    if (!el) return

    const handleTouchStart = (e) => {
      const touch = e.touches[0]
      touchStartRef.current = { x: touch.clientX, y: touch.clientY }
    }

    const handleTouchEnd = (e) => {
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

  const cellSize = { xs: 64, sm: 80 }
  const gap = 8

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2 }}>
      {/* Score bar */}
      <Box sx={{ display: 'flex', gap: 3, alignItems: 'center', width: '100%', justifyContent: 'center' }}>
        <Box sx={{ textAlign: 'center' }}>
          <Typography variant="caption" color="text.secondary">{t('games.score')}</Typography>
          <Typography variant="h5" fontWeight={700}>{score}</Typography>
        </Box>
        <Box sx={{ textAlign: 'center' }}>
          <Typography variant="caption" color="text.secondary">{t('games.bestScore')}</Typography>
          <Typography variant="h5" fontWeight={700}>{Math.max(bestScore, score)}</Typography>
        </Box>
        <Button variant="outlined" size="small" onClick={handleNewGame}>{t('games.newGame')}</Button>
      </Box>

      {/* Board */}
      <Box
        ref={boardRef}
        sx={{
          position: 'relative',
          display: 'grid',
          gridTemplateColumns: `repeat(${GRID_SIZE}, 1fr)`,
          gap: `${gap}px`,
          p: `${gap}px`,
          borderRadius: 2,
          bgcolor: theme.palette.mode === 'dark' ? 'grey.800' : '#bbada0',
          touchAction: 'none',
          userSelect: 'none',
        }}
      >
        {board.flat().map((value, idx) => {
          const colors = TILE_COLORS[value] || { bg: theme.palette.primary.main, text: '#f9f6f2' }
          const isEmpty = value === 0
          return (
            <Box
              key={idx}
              sx={{
                width: cellSize,
                height: cellSize,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                borderRadius: 1,
                bgcolor: isEmpty
                  ? (theme.palette.mode === 'dark' ? 'grey.700' : '#cdc1b4')
                  : colors.bg,
                transition: 'background-color 0.15s ease',
              }}
            >
              {!isEmpty && (
                <Typography
                  sx={{
                    fontWeight: 700,
                    fontSize: value >= 1024 ? '1rem' : value >= 128 ? '1.2rem' : '1.5rem',
                    color: colors.text,
                    lineHeight: 1,
                  }}
                >
                  {value}
                </Typography>
              )}
            </Box>
          )
        })}

        {/* Game over overlay */}
        {gameOver && (
          <Box
            sx={{
              position: 'absolute',
              inset: 0,
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              bgcolor: 'rgba(0,0,0,0.5)',
              borderRadius: 2,
              gap: 1,
            }}
          >
            <Typography variant="h5" color="white" fontWeight={700}>{t('games.gameOver')}</Typography>
            <Typography variant="h6" color="white">{t('games.score')}: {score}</Typography>
          </Box>
        )}
      </Box>
    </Box>
  )
}
