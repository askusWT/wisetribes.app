import Head from "next/head";
import { useMemo, useState } from "react";
import { hasValidAccess } from "../lib/auth";

const clean = value => value || "Pending";

export default function Board({ authorized, data }) {
  const [panel, setPanel] = useState(false);
  const [text, setText] = useState("");
  const [message, setMessage] = useState("");
  const [sending, setSending] = useState(false);
  const days = useMemo(() => data?.meta.targetDate ? Math.max(0, Math.ceil((new Date(data.meta.targetDate) - new Date()) / 86400000)) : null, [data]);

  async function unlock(event) {
    event.preventDefault();
    setMessage("Checking…");
    const response = await fetch("/api/unlock", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ passcode: event.currentTarget.passcode.value }) });
    if (response.ok) location.reload();
    else setMessage((await response.json()).error);
  }

  async function submit(event) {
    event.preventDefault(); setSending(true); setMessage("");
    const response = await fetch("/api/inbox", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ text, website: event.currentTarget.website.value }) });
    const result = await response.json();
    setSending(false);
    if (response.ok) { setText(""); setMessage("Added — thank you. It can be sorted into the board later."); }
    else setMessage(result.error);
  }

  if (!authorized) return <main className="gate"><Head><title>Relocation board</title></Head><form onSubmit={unlock} className="gateCard"><span className="mark">WT</span><h1>Shared relocation board</h1><p>Enter the shared passcode to continue.</p><label>Passcode<input name="passcode" type="password" autoFocus autoComplete="current-password" /></label><button>Open board</button><div role="status">{message}</div></form></main>;

  const workstreams = Object.values(data.workstreams.reduce((all, item) => { (all[item.workstream_name] ||= { name: item.workstream_name, note: item.note, items: [] }).items.push(item); return all; }, {}));
  return <>
    <Head><title>{data.meta.title}</title><meta name="description" content="A shared household relocation status board" /></Head>
    <main className="shell">
      <header><div><span className="kicker">Shared relocation board</span><h1>{data.meta.title}</h1><p>{data.meta.subtitle}</p></div><div className="dateCard"><strong>{days ?? "—"}</strong><span>{days === null ? "date pending" : "days to target"}</span></div></header>
      <div className="updated">Last updated: {clean(data.meta.updated)}</div>
      <section className="priority"><span className="kicker">Current priority</span><h2>{clean(data.currentPriority.headline)}</h2><p>{data.currentPriority.rationale}</p><div className="chips">{data.currentPriority.subtasks.map(item => <span key={item}>{item}</span>)}</div>{data.currentPriority.deferred.length > 0 && <div className="deferred"><b>Held for later</b>{data.currentPriority.deferred.join(" · ")}</div>}</section>
      <div className="grid">
        <section><Title>Dependency path</Title><div className="ladder">{data.ladder.map(step => <article key={step.order} className={step.status}><b>{step.order}</b><div><h3>{step.label}</h3><p>{step.detail}</p></div><span>{step.status}</span></article>)}</div></section>
        <section><Title>Items needing prompt attention</Title><div className="cards">{data.urgent.length ? data.urgent.map((item, i) => <article key={i}><h3>{item.item}</h3><p>{item.required_action}</p><small>{item.responsible_role}</small></article>) : <Empty />}</div></section>
      </div>
      <section><Title>Backlog</Title><div className="list">{data.backlog.length ? data.backlog.map((item, i) => <article key={i}><span className={`state ${item.state}`}>{item.state}</span><div><h3>{item.item}</h3><p>{item.note}</p></div><small>Step {item.related_ladder_step || "—"}</small></article>) : <Empty />}</div></section>
      <section><Title>Workstreams</Title><div className="columns">{workstreams.length ? workstreams.map(group => <article className="panel" key={group.name}><h3>{group.name}</h3><p>{group.note}</p>{group.items.map((item, i) => <div className="check" key={i}>{item.done ? "✓" : "○"} {item.item}</div>)}</article>) : <Empty />}</div></section>
      <div className="grid"><section><Title>Decisions</Title><div className="panel">{data.decisions.length ? data.decisions.map((item, i) => <div className="decision" key={i}><div><h3>{item.decision}</h3><p>{item.options}</p></div><span>{item.status}</span></div>) : <Empty />}</div></section><section><Title>Costs and sign-off</Title><div className="panel">{data.costs.length ? data.costs.map((item, i) => <div className="decision" key={i}><h3>{item.item}</h3><span>{item.status}</span></div>) : <Empty />}</div></section></div>
      <footer>{data.meta.note}</footer>
    </main>
    <button className="peek" onClick={() => setPanel(true)} aria-label="Open add-note panel">Add a note <span>＋</span></button>
    <div className={`overlay ${panel ? "open" : ""}`} onClick={() => setPanel(false)} />
    <aside className={panel ? "open" : ""} aria-hidden={!panel}><button className="close" onClick={() => setPanel(false)} aria-label="Close">×</button><span className="kicker">Shared inbox</span><h2>Add anything — we’ll sort it out.</h2><p>No categories or special format needed. Add a thought, change, question, or reminder.</p><form onSubmit={submit}><label>Your note<textarea value={text} onChange={e => setText(e.target.value)} maxLength="5000" rows="8" /></label><input className="honey" name="website" tabIndex="-1" autoComplete="off" /><button disabled={sending}>{sending ? "Adding…" : "Add to inbox"}</button><div role="status">{message}</div></form></aside>
  </>;
}

function Title({ children }) { return <h2 className="sectionTitle">{children}</h2>; }
function Empty() { return <div className="empty">Nothing is listed here right now.</div>; }

export async function getServerSideProps({ req }) {
  if (!hasValidAccess(req)) return { props: { authorized: false, data: null } };
  const data = await import("../generated/board-data.json");
  return { props: { authorized: true, data: data.default } };
}
