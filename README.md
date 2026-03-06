# 💣 Number Bomb Game

A fun multiplayer party game built with React + TypeScript + Vite.

## How to Play

1. Set the number of players (2-6) and enter names
2. A hidden "bomb" number is randomly generated between 1-99
3. Players take turns guessing a number within the current range
4. Each guess narrows the range — if you guess lower than the bomb, it becomes the new minimum; higher becomes the new maximum
5. The player who guesses the exact bomb number... 💥 BOOM! They lose!

## Getting Started

```bash
# Install dependencies
npm install

# Start dev server
npm run dev

# Build for production
npm run build
```

## Tech Stack

- React 18
- TypeScript
- Vite
