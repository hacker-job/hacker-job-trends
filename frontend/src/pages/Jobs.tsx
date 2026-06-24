import { useEffect, useMemo, useRef, useState } from 'react'
import { getManifest, getMonth, type Job } from '../data.ts'

const REPO = 'hacker-job/hacker-job-trends'
const PAGE = 50         // rendered cards revealed per scroll step
const MONTH_BATCH = 3   // months fetched per batch
const DESC_LIMIT = 1200

function fmtSalary(j: Job): string {
  if (!j.salary_min && !j.salary_max) return ''
  const cur = j.salary_currency || 'USD'
  const k = (n: number) => (n >= 1000 ? Math.round(n / 1000) + 'k' : String(n))
  const sym = cur === 'USD' ? '$' : cur === 'EUR' ? '€' : cur === 'GBP' ? '£' : ''
  const unit = sym || cur + ' '
  if (j.salary_min && j.salary_max) return unit + k(j.salary_min) + '–' + k(j.salary_max)
  return unit + k((j.salary_min || j.salary_max)!)
}
function fmtDate(ts: number): string {
  return new Date(ts * 1000).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' })
}
function issueUrl(j: Job): string {
  const title = `Data issue: ${j.company} (job #${j.id})`
  const body = 'The extracted info for this job looks wrong (fields are AI-extracted).\n\n'
    + `Job: ${j.company}\nHacker News: https://news.ycombinator.com/item?id=${j.id}\n\n`
    + 'What is incorrect:\n- '
  return `https://github.com/${REPO}/issues/new?title=${encodeURIComponent(title)}&body=${encodeURIComponent(body)}`
}

function JobCard({ j }: { j: Job }) {
  const sal = fmtSalary(j)
  const desc = j.text.length > DESC_LIMIT ? j.text.slice(0, DESC_LIMIT) + '…' : j.text
  return (
    <article className="job">
      <div className="job-head">
        <span className="co">{j.company}</span>
        {j.location && <span className="loc">{j.location}</span>}
        <span className="date">{fmtDate(j.ts)}</span>
      </div>
      {j.roles.length > 0 && <div className="roles">{j.roles.join(' · ')}</div>}
      <div className="badges">
        {j.remote_type && <span className={'badge rt-' + j.remote_type}>{j.remote_type}</span>}
        {j.job_type && <span className="badge">{j.job_type}</span>}
        {!!j.visa && <span className="badge">visa</span>}
        {sal && <span className="badge sal">{sal}</span>}
      </div>
      {j.tech_stack.length > 0 && (
        <div className="tags">
          {j.tech_stack.slice(0, 12).map((t, i) => <span className="tag" key={i}>{t}</span>)}
        </div>
      )}
      <details>
        <summary>details</summary>
        <pre className="desc">{desc}</pre>
        <div className="job-foot">
          <a href={`https://news.ycombinator.com/item?id=${j.id}`} target="_blank" rel="noopener">View on Hacker News →</a>
          <a className="report" href={issueUrl(j)} target="_blank" rel="noopener"
            title="These fields are AI-extracted and may be wrong">⚑ Report an issue</a>
        </div>
      </details>
    </article>
  )
}

export default function Jobs() {
  const [jobs, setJobs] = useState<Job[]>([])
  const [monthsLoaded, setMonthsLoaded] = useState(0)
  const [loading, setLoading] = useState(true)
  const [shown, setShown] = useState(PAGE)

  const [q, setQ] = useState('')
  const [remote, setRemote] = useState('')
  const [minSal, setMinSal] = useState(0)
  const [loc, setLoc] = useState('')
  const [visa, setVisa] = useState(false)
  const [intern, setIntern] = useState(false)

  useEffect(() => {
    let cancelled = false
    getManifest().then(async (m) => {
      if (cancelled) return
      const slice = m.months.slice(0, MONTH_BATCH)
      const arrs = await Promise.all(slice.map(getMonth))
      if (cancelled) return
      setJobs(arrs.flat().sort((a, b) => b.ts - a.ts))
      setMonthsLoaded(slice.length)
      setLoading(false)
    }).catch((e) => { console.error(e); setLoading(false) })
    return () => { cancelled = true }
  }, [])

  const filtered = useMemo(() => {
    const terms = q.trim().toLowerCase().split(/\s+/).filter(Boolean)
    const locL = loc.trim().toLowerCase()
    return jobs.filter((j) => {
      if (remote && j.remote_type !== remote) return false
      if (minSal && !((j.salary_max || j.salary_min || 0) >= minSal)) return false
      if (locL && !(j.location || '').toLowerCase().includes(locL)) return false
      if (visa && !j.visa) return false
      if (intern && j.job_type !== 'intern') return false
      if (terms.length) {
        const hay = (j.company + ' ' + j.roles.join(' ') + ' ' + (j.location || '') + ' '
          + j.tech_stack.join(' ') + ' ' + (j.remote_type || '') + ' ' + (j.job_type || '') + ' ' + j.text).toLowerCase()
        if (!terms.every((t) => hay.includes(t))) return false
      }
      return true
    })
  }, [jobs, q, remote, minSal, loc, visa, intern])

  useEffect(() => { setShown(PAGE) }, [q, remote, minSal, loc, visa, intern])

  const clear = () => { setQ(''); setRemote(''); setMinSal(0); setLoc(''); setVisa(false); setIntern(false) }

  // Infinite scroll: reveal more already-loaded cards as the user nears the end.
  const sentinel = useRef<HTMLDivElement>(null)
  useEffect(() => {
    const el = sentinel.current
    if (!el || loading || shown >= filtered.length) return
    const io = new IntersectionObserver((entries) => {
      if (entries[0].isIntersecting) setShown((s) => s + PAGE)
    }, { rootMargin: '800px' })
    io.observe(el)
    return () => io.disconnect()
  }, [loading, shown, filtered.length])

  return (
    <>
      <h1>Jobs</h1>
      <p className="sub">
        Recent openings from HN's monthly <a href="https://news.ycombinator.com/submitted?id=whoishiring" target="_blank" rel="noopener">"Who is hiring?"</a> threads.
      </p>

      <input className="searchbox" type="search" placeholder="Search company, role, location, stack…"
        value={q} onChange={(e) => setQ(e.target.value)} />
      <div className="filters">
        <select value={remote} onChange={(e) => setRemote(e.target.value)}>
          <option value="">Remote: any</option>
          <option value="remote">Remote</option>
          <option value="hybrid">Hybrid</option>
          <option value="onsite">Onsite</option>
        </select>
        <select value={minSal} onChange={(e) => setMinSal(Number(e.target.value))}>
          <option value={0}>Salary: any</option>
          <option value={100000}>$100k+</option>
          <option value={150000}>$150k+</option>
          <option value={200000}>$200k+</option>
          <option value={300000}>$300k+</option>
        </select>
        <input type="text" placeholder="Location…" value={loc} onChange={(e) => setLoc(e.target.value)} />
        <label className="chk"><input type="checkbox" checked={visa} onChange={(e) => setVisa(e.target.checked)} /> Visa sponsor</label>
        <label className="chk"><input type="checkbox" checked={intern} onChange={(e) => setIntern(e.target.checked)} /> Internship</label>
        <button className="clearbtn" onClick={clear}>Clear</button>
      </div>

      {!loading && (
        <p className="sub statusline">
          {filtered.length === jobs.length
            ? `${jobs.length.toLocaleString()} openings from last ${monthsLoaded} months`
            : `${filtered.length.toLocaleString()} of ${jobs.length.toLocaleString()} openings match`}
        </p>
      )}

      {loading
        ? <div className="spinner" role="status" aria-label="Loading jobs" />
        : <div>{filtered.slice(0, shown).map((j) => <JobCard key={j.id} j={j} />)}</div>}

      {!loading && <div ref={sentinel} style={{ height: 1 }} />}
    </>
  )
}
