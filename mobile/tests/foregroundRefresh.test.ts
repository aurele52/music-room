import test from 'node:test'
import assert from 'node:assert/strict'
import type { AppStateStatus } from 'react-native'
import {
  subscribeForegroundRefresh
} from '../src/lib/foregroundRefresh'

class FakeAppState {
  currentState: AppStateStatus
  private listeners = new Set<
    (state: AppStateStatus) => void
  >()

  constructor(initial: AppStateStatus) {
    this.currentState = initial
  }

  addEventListener(
    type: 'change',
    listener: (state: AppStateStatus) => void
  ) {
    assert.equal(type, 'change')
    this.listeners.add(listener)

    return {
      remove: () => {
        this.listeners.delete(listener)
      }
    }
  }

  transition(state: AppStateStatus) {
    this.currentState = state

    for (const listener of [...this.listeners]) {
      listener(state)
    }
  }

  get listenerCount() {
    return this.listeners.size
  }
}

test('reprise background vers active', () => {
  const app = new FakeAppState('active')
  let count = 0

  const stop = subscribeForegroundRefresh(
    app,
    () => { count++ }
  )

  app.transition('background')
  assert.equal(count, 0)

  app.transition('active')
  assert.equal(count, 1)

  stop()
})

test('reprise inactive vers active', () => {
  const app = new FakeAppState('active')
  let count = 0

  const stop = subscribeForegroundRefresh(
    app,
    () => { count++ }
  )

  app.transition('inactive')
  app.transition('active')

  assert.equal(count, 1)
  stop()
})

test('evenements active repetes ignores', () => {
  const app = new FakeAppState('active')
  let count = 0

  const stop = subscribeForegroundRefresh(
    app,
    () => { count++ }
  )

  app.transition('active')
  app.transition('active')

  assert.equal(count, 0)
  stop()
})

test('deux reprises distinctes declenchent deux GET', () => {
  const app = new FakeAppState('active')
  let count = 0

  const stop = subscribeForegroundRefresh(
    app,
    () => { count++ }
  )

  app.transition('background')
  app.transition('active')
  app.transition('background')
  app.transition('active')

  assert.equal(count, 2)
  stop()
})

test('desabonnement empêche tout rafraichissement', () => {
  const app = new FakeAppState('active')
  let count = 0

  const stop = subscribeForegroundRefresh(
    app,
    () => { count++ }
  )

  assert.equal(app.listenerCount, 1)

  stop()
  stop()

  assert.equal(app.listenerCount, 0)

  app.transition('background')
  app.transition('active')

  assert.equal(count, 0)
})

test('etat initial inconnu puis actif rafraichit', () => {
  const app = new FakeAppState('unknown')
  let count = 0

  const stop = subscribeForegroundRefresh(
    app,
    () => { count++ }
  )

  app.transition('active')
  assert.equal(count, 1)

  stop()
})
