export function remainingTime(state, duration, now) {
  return state.deadline ? Math.max(0,state.deadline-now) : state.remaining ?? duration
}

