// @vitest-environment jsdom
import React from 'react'
import { afterEach,beforeEach,expect,test,vi } from 'vitest'
import { cleanup,fireEvent,render,screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { RecordEditor } from './Records'
import Grades from './Grades'
import Dashboard from './Dashboard'

const { mutateAsync } = vi.hoisted(() => ({ mutateAsync:vi.fn(async () => ({})) }))
vi.mock('./auth',() => ({ useAuth:() => ({ user:{ name:'Taylor Jordan' } }) }))
vi.mock('./data',() => ({
  useSave:() => ({ mutateAsync }),
  useRecords:resource => ({ data:({
    preferences:{ timezone:'UTC',gradingScale:[],firstDay:1 },
    courses:{ items:[{ _id:'course', name:'Database Management', code:'COMP214', target:85, schedule:[] }] },
    assessments:{ items:[{ _id:'assessment', name:'Midterm', weight:70,earned:82,maximum:100,completed:true }] },
  })[resource] || { items:[] } }),
}))
beforeEach(() => {
  HTMLDialogElement.prototype.showModal = function () { this.setAttribute('open','') }
})
afterEach(() => { cleanup(); vi.clearAllMocks() })
test('submits a course with a recurring class',async () => {
  render(<RecordEditor resource="courses" row={{}} close={() => {}} semesters={[{ _id:'term',name:'Fall',state:'active' }]}/>)
  fireEvent.change(screen.getByLabelText('Course name'),{ target:{ value:'History' } })
  fireEvent.change(screen.getByLabelText('Course code'),{ target:{ value:'HIS' } })
  fireEvent.click(screen.getByRole('button',{ name:'Add weekly class' }))
  fireEvent.click(screen.getByRole('button',{ name:'Save changes' }))
  expect(mutateAsync).toHaveBeenCalledWith(expect.objectContaining({ data:expect.objectContaining({ code:'HIS',semester:'term',schedule:[{ weekday:1,start:'09:00',end:'10:00' }] }) }))
})
test('submits an assignment and serializes a checklist and due time',async () => {
  render(<RecordEditor resource="assignments" row={{ course:'course' }} close={() => {}} courses={[{ _id:'course',code:'HIS',name:'History' }]} preferences={{ timezone:'America/New_York',priority:'medium' }}/>)
  fireEvent.change(screen.getByLabelText('Title'),{ target:{ value:'Essay' } })
  fireEvent.change(screen.getByLabelText(/Due date and time/),{ target:{ value:'2027-01-13T14:30' } })
  fireEvent.click(screen.getByRole('button',{ name:'Add checklist item' }))
  fireEvent.change(screen.getByLabelText('Checklist item 1'),{ target:{ value:'Write outline' } })
  fireEvent.click(screen.getByRole('button',{ name:'Save changes' }))
  expect(mutateAsync).toHaveBeenCalledWith(expect.objectContaining({ data:expect.objectContaining({ title:'Essay',dueAt:'2027-01-13T19:30:00.000Z',checklist:[{ title:'Write outline',done:false }] }) }))
})
test('renders a saved grade and updates the required average without saving',() => {
  render(<MemoryRouter><Grades/></MemoryRouter>)
  expect(screen.getByText('Current grade').nextElementSibling.textContent).toBe('82.0%')
  expect(screen.getByText('Required average on remaining work: 92.0%')).toBeTruthy()
  fireEvent.change(screen.getByLabelText('Target grade (%)'),{ target:{ value:'99' } })
  expect(screen.getByText('This target is unreachable with the entered scores.')).toBeTruthy()
  expect(mutateAsync).not.toHaveBeenCalled()
})
test('shows a personalized empty dashboard without chart values',() => {
  render(<MemoryRouter><Dashboard/></MemoryRouter>)
  expect(screen.getByRole('heading',{ name:/Taylor/ })).toBeTruthy()
  expect(screen.getByText('No pending assignments.')).toBeTruthy()
  expect(screen.getByText('No completed focus sessions in the last seven days.')).toBeTruthy()
})


