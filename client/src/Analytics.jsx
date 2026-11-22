import React from 'react'
import { Link } from 'react-router-dom'
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { useRecords } from './data'
import { Empty, Load, Page } from './ui'

const seriesColors = ['var(--accent)','var(--success)','var(--muted)']
function Chart({ title,data,series,summary,empty }) {
  return <section className="panel"><h2>{title}</h2>
    {empty ? <Empty>No activity in this period.</Empty> : <><p className="muted">{summary}</p>
      <div className="chart" aria-hidden="true"><ResponsiveContainer width="100%" height={215}><BarChart data={data}>
        <CartesianGrid stroke="var(--line)" vertical={false}/><XAxis dataKey="label" stroke="var(--muted)" fontSize={11} minTickGap={12}/><YAxis stroke="var(--muted)" fontSize={11} width={39}/>
        <Tooltip contentStyle={{ background:'var(--surface)',borderColor:'var(--line)' }} itemStyle={{ color:'var(--text)' }}/>
        {series.map(([key,label],index) => <Bar key={key} dataKey={key} name={label} fill={seriesColors[index]} isAnimationActive={false}/>)}
      </BarChart></ResponsiveContainer></div>
      <details><summary>View chart data</summary>{data.map((row,index) => <div className="record" key={index}><strong>{row.label}</strong>{series.map(([key,label]) => <span key={key}>{label} {row[key] == null ? '—' : Number(row[key].toFixed(2))}</span>)}</div>)}</details></>}
  </section>
}
export default function Analytics() {
  const query = useRecords('analytics')
  const data = query.data
  return <Page title="Analytics" subtitle="See changes in workload, study habits, and grades."><Load queries={[query]}>{data && <>
    <div className="metrics">{[['Completed',data.completed],['Pending',data.pending],['Overdue',data.overdue],['Completion rate',data.rate == null ? '—' : data.rate.toFixed(0)+'%']].map(([label,value]) => <div className="panel metric" key={label}><span>{label}</span><strong>{value}</strong></div>)}</div>
    <div className="dashboard-grid space">
      <Chart title="Daily study hours" data={data.days.slice(-7)} series={[[ 'hours','Study hours']]} summary="Completed focus time over the last seven days." empty={!data.days.slice(-7).some(x => x.sessions)}/>
      <Chart title="Study time by course" data={data.byCourse} series={[[ 'hours','Study hours']]} summary="All completed focus time grouped by course." empty={!data.byCourse.length}/>
      <Chart title="Upcoming workload" data={data.upcoming} series={[[ 'deadlines','Deadlines'],['high','High or urgent']]} summary={data.upcoming.reduce((sum,x) => sum+x.deadlines,0)+' pending deadlines over the next seven days.'} empty={!data.upcoming.some(x => x.deadlines)}/>
      <Chart title="Weekly study hours" data={data.weeks} series={[[ 'hours','Study hours']]} summary="Study time in four consecutive seven-day periods." empty={!data.weeks.some(x => x.days)}/>
      <Chart title="Productivity trends" data={data.weeks} series={[[ 'completed','Completed assignments'],['days','Days with focus sessions']]} summary="Assignment completions and days with focus sessions over the last 28 days." empty={!data.weeks.some(x => x.days || x.completed)}/>
      <Chart title="Academic performance" data={data.performance} series={[[ 'current','Current grade (%)'],['target','Target grade (%)']]} summary="Weighted current grades and course targets." empty={!data.performance.length}/>
    </div>
    <section className="panel space"><h2>Assessment breakdown</h2>{data.performance.length ? data.performance.map(x => <div className="record" key={x.id}><Link to={'/app/grades?course='+x.id}>{x.name}</Link><span>{x.assessments.filter(a => a.completed).length} of {x.assessments.length} graded</span></div>) : <Empty>Add a course to start tracking grades.</Empty>}</section>
  </>}</Load></Page>
}

