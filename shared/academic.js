export const priorities = ['low', 'medium', 'high', 'urgent']
export const statuses = ['not started', 'in progress', 'completed']
export function deadline(item, now = Date.now()) {
  if (item.status === 'completed') return 'completed'
  const hours = (new Date(item.dueAt).getTime() - now) / 3600000
  return hours < 0 ? 'overdue' : hours <= 24 ? 'today' : hours <= 168 ? 'this week' : 'later'
}
export function recommendation(item, now = Date.now()) {
  const state = deadline(item, now)
  if (state === 'completed') return { score: -1, reason: 'Completed' }
  const urgency = { overdue: 100, today: 60, 'this week': 30, later: 0 }[state]
  return {
    score: urgency + priorities.indexOf(item.priority) * 12 + Math.min(18, item.estimate / 30),
    reason: [state === 'today' ? 'Due within 24 hours' : state === 'later' ? 'Due after the next seven days' : state === 'overdue' ? 'Overdue' : 'Due within seven days', item.priority + ' priority', item.estimate + ' min estimated'].join(' · '),
  }
}
export function weightedGrades(assessments, target, scenarios = {}) {
  let graded = 0, total = 0, points = 0, projectedPoints = 0, projectedWeight = 0
  for (const item of assessments) {
    total += item.weight
    if (item.completed && item.earned != null) {
      graded += item.weight
      points += item.earned / item.maximum * item.weight
    } else if (scenarios[item._id] != null && scenarios[item._id] !== '') {
      projectedWeight += item.weight
      projectedPoints += Math.min(100, Math.max(0, Number(scenarios[item._id]))) / 100 * item.weight
    }
  }
  const remaining = Math.max(0, 100 - graded)
  const current = graded ? points / graded * 100 : null
  const unknown = Math.max(0, remaining - projectedWeight)
  const projected = graded || projectedWeight ? points + projectedPoints + unknown * (current ?? projectedPoints / projectedWeight * 100) / 100 : null
  return { total, graded, remaining, current, projected, required: unknown > 0 ? Math.max(0, (target - points - projectedPoints) / unknown * 100) : null, impossible: target > points + projectedPoints + unknown + 1e-8 }
}

