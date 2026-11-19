import assert from 'node:assert/strict';
import test from 'node:test';

const storageKey = 'wsq.dealer.daily.v3';
let moduleId = 0;

async function loadGame() {
  const {useDealerGame} = await import(
    `../src/quickref/numbers/useDealerGame.ts?session=${++moduleId}`
  );
  return useDealerGame();
}

function mockStorage(t) {
  const saved = new Map();
  const original = Object.getOwnPropertyDescriptor(globalThis, 'localStorage');
  Object.defineProperty(globalThis, 'localStorage', {
    configurable: true,
    value: {
      getItem: (key) => saved.get(key) ?? null,
      setItem: (key, value) => saved.set(key, value),
    },
  });
  t.after(() => {
    if (original) Object.defineProperty(globalThis, 'localStorage', original);
    else delete globalThis.localStorage;
  });
  return saved;
}

function finishRound(game) {
  game.round.value.cards.forEach((card, index) => {
    if (card.isImpostor && card.status === 'unseen') game.tapCard(index);
  });
}

test('daily reload preserves partial hits, mistakes, order and combo without recounting', async (t) => {
  mockStorage(t);
  const game = await loadGame();
  const cards = game.round.value.cards;
  game.tapCard(cards.findIndex((card) => !card.isImpostor));
  game.tapCard(cards.findIndex((card) => card.isImpostor));
  const savedStats = {...game.session.value.stats};
  const restored = await loadGame();
  assert.deepEqual(restored.round.value.cards, game.round.value.cards);
  assert.deepEqual(restored.session.value.stats, savedStats);
  assert.equal(restored.session.value.combo, 1);
  assert.equal(restored.session.value.rage, 25);
  finishRound(restored);
  assert.equal(
    restored.session.value.stats.punched,
    restored.round.value.impostorTotal,
  );
  assert.equal(restored.session.value.stats.mistakes, 1);
  assert.equal(restored.session.value.stats.roundsCleared, 1);
});

test('completed rounds and the final report survive reload and keep daily progression', async (t) => {
  mockStorage(t);
  let game = await loadGame();
  for (let index = 0; index < 5; index++) {
    finishRound(game);
    game = await loadGame();
    assert.equal(game.session.value.stats.roundsCleared, index + 1);
    assert.equal(game.isRoundCleared.value, true);
    if (index < 4) {
      game.nextRound();
      game = await loadGame();
      assert.equal(game.round.value.roundNumber, index + 2);
      assert.equal(game.isRoundCleared.value, false);
    }
  }
  assert.equal(game.session.value.dailyCompleted, true);
  assert.equal(game.session.value.showReport, true);
});

test('invalid saved round indices restart cleanly instead of producing an undefined round', async (t) => {
  const saved = mockStorage(t);
  const game = await loadGame();
  game.tapCard(game.round.value.cards.findIndex((card) => card.isImpostor));
  const data = JSON.parse(saved.get(storageKey));
  saved.set(storageKey, JSON.stringify({...data, roundIndex: 0.5}));
  const restored = await loadGame();
  assert.equal(restored.round.value.roundNumber, 1);
  assert.equal(restored.session.value.stats.punched, 0);
});
