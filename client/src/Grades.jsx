import React, { useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { weightedGrades } from '../../shared/academic'
import { useRecords } from './data'
import { Add, Empty, Field, items, Load, Options, Page } from './ui'
import { RecordEditor } from './Records'

const percent = value => value == null ? '—' : value.toFixed(1) + '%'
export default function Grades() {
  const [params,setParams] = useSearchParams()
  const courses = useRecords('courses'), prefs = useRecords('preferences')
  const course = items(courses).find(x => x._id === params.get('course')) || items(courses)[0]
  return <Page title="Grades" subtitle="See how saved scores and future assessments affect your target.">
    <Load queries={[courses,prefs]}>{course ? <>
      <div className="toolbar"><Field label="Course"><select value={course._id} onChange={e => setParams({ course:e.target.value })}><Options values={items(courses).map(x => [x._id,x.code + ' · ' + x.name])}/></select></Field></div>
      <Gradebook key={course._id} course={course} preferences={prefs.data}/>
    </> : <Empty>Add a course before recording grades.<Link to="/app/courses?add=course">Set up a course</Link></Empty>}</Load>
  </Page>
}
function Gradebook({ course, preferences }) {
  const assessments = useRecords('assessments',{ course:course._id })
  const history = useRecords('grade-history',{ course:course._id })
  const [edit,setEdit] = useState(null), [target,setTarget] = useState(course.target), [scenarios,setScenarios] = useState({})
  const list = items(assessments)
  const grade = weightedGrades(list,Number(target),scenarios)
  const overWeight = grade.total > 100 + 1e-6
  const letter = [...preferences.gradingScale].sort((a,b) => b.minimum-a.minimum).find(x => grade.current != null && grade.current >= x.minimum)
  return <Load queries={[assessments]}><div className="metrics">
    {[['Current grade',percent(grade.current)+(letter ? ' · '+letter.label : '')],['Graded weight',percent(grade.graded)],['Remaining weight',percent(grade.remaining)],['Projected grade',overWeight ? '—' : percent(grade.projected)]].map(([label,value]) => <div className="panel metric" key={label}><span>{label}</span><strong>{value}</strong></div>)}</div>
    <section className="panel space"><div className="section-heading"><h2>Assessment breakdown</h2><Add onClick={() => setEdit({})}>Add assessment</Add></div>
      {list.length ? list.map(x => <div className="record" key={x._id}><button className="text-button" onClick={() => setEdit(x)}>{x.name}</button><span>{x.weight}% weight</span><span>{x.completed ? x.earned+' / '+x.maximum : 'Ungraded'}</span></div>) : <Empty>Add assessments to calculate your current grade.</Empty>}
      {Math.abs(grade.total - 100) > 1e-6 && <p className="warning">Assessment weights total {grade.total}%. {overWeight ? 'Reduce the weights to calculate projections.' : 'Unallocated weight is included in the remaining course weight.'}</p>}
    </section>
    <section className="panel space"><h2>What-if simulator</h2><p className="muted">Projected grades use your current average for remaining work without a hypothetical score.</p>
      <div className="filters space"><Field label="Target grade (%)" type="number" min={0} max={100} step="any" value={target} onChange={e => setTarget(e.target.value === '' ? '' : Math.max(0,Math.min(100,Number(e.target.value))))}/>
      {list.filter(x => !x.completed).map(x => <Field key={x._id} label={x.name + ' hypothetical score (%)'} type="number" min={0} max={100} step="any" value={scenarios[x._id] ?? ''} onChange={e => setScenarios({ ...scenarios,[x._id]:e.target.value })}/>)}</div>
      {!overWeight && target !== '' && <p role="status">{grade.impossible ? 'This target is unreachable with the entered scores.' : grade.required == null ? 'This scenario meets the target.' : 'Required average on remaining work: '+percent(grade.required)}</p>}
    </section>
    <Load queries={[history]}>{items(history).length > 1 && <section className="panel space"><h2>Grade history</h2><p className="muted">Daily snapshots from saved assessments.</p>{items(history).map(x => <div className="record" key={x._id}><time dateTime={x.day}>{x.day}</time><strong>{percent(x.grade)}</strong></div>)}</section>}</Load>
    {edit && <RecordEditor resource="assessments" row={edit} close={() => setEdit(null)} course={course._id} preferences={preferences}/>}
  </Load>
}


