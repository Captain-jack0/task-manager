import { useEffect, useRef, useState, type ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { useAuthStore } from '@/features/auth/authStore';
import { cn } from '@/lib/cn';

/** Fade-up reveal when the element scrolls into view (IntersectionObserver, CSS only). */
function Reveal({
  children,
  delay = 0,
  className,
}: {
  children: ReactNode;
  delay?: number;
  className?: string;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [shown, setShown] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const io = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setShown(true);
          io.disconnect();
        }
      },
      { threshold: 0.15 },
    );
    io.observe(el);
    return () => io.disconnect();
  }, []);

  return (
    <div
      ref={ref}
      style={{ transitionDelay: `${delay}ms` }}
      className={cn(
        'transition-all duration-700 ease-out',
        shown ? 'translate-y-0 opacity-100' : 'translate-y-8 opacity-0',
        className,
      )}
    >
      {children}
    </div>
  );
}

function Badge({ label, tone }: { label: string; tone: string }) {
  return (
    <span className={cn('rounded-full px-2 py-0.5 text-[11px] font-medium', tone)}>{label}</span>
  );
}

/** Static mock of the suggestion panel — pure divs, no data. */
function HeroMock() {
  return (
    <div className="relative mx-auto w-full max-w-md">
      <div className="absolute -inset-6 rounded-[2rem] bg-gradient-to-tr from-slate-200/60 via-transparent to-slate-200/60 blur-2xl dark:from-slate-800/60 dark:to-slate-800/60" />
      <div className="relative rounded-2xl border border-slate-200 bg-white p-5 shadow-2xl shadow-slate-900/10 dark:border-slate-800 dark:bg-slate-900">
        <p className="text-sm font-semibold tracking-tight">What should I do now?</p>
        <p className="mt-0.5 text-xs text-slate-400">30 minutes · medium energy</p>
        <div className="mt-4 rounded-xl border border-slate-200 p-3 dark:border-slate-800">
          <div className="flex items-start justify-between gap-2">
            <p className="text-sm font-medium">Review PR feedback</p>
            <span className="mt-1 h-1.5 w-1.5 shrink-0 rounded-full bg-red-500" />
          </div>
          <p className="mt-1 text-xs text-slate-400">~25m · due today</p>
          <p className="mt-2 text-xs font-medium text-emerald-600 dark:text-emerald-400">
            Best fit — urgent and fits your window
          </p>
        </div>
        <div className="mt-2 rounded-xl border border-slate-200 p-3 opacity-60 dark:border-slate-800">
          <p className="text-sm font-medium">Write weekly update</p>
          <p className="mt-1 text-xs text-slate-400">~20m · low energy</p>
        </div>
        <div className="mt-4 h-9 rounded-lg bg-slate-900 text-center text-sm font-medium leading-9 text-white dark:bg-white dark:text-slate-900">
          Suggest a task
        </div>
      </div>
    </div>
  );
}

const FEATURES = [
  {
    title: 'Tell it your energy, get one task back',
    body: 'Momentum scores every open task by urgency, time fit and the energy you actually have — and hands you the single best thing to do right now. No more staring at a wall of todos.',
    mock: (
      <div className="flex flex-wrap gap-2">
        {['15m', '30m', '60m'].map((m, i) => (
          <span
            key={m}
            className={cn(
              'rounded-full border px-4 py-1.5 text-sm',
              i === 1
                ? 'border-slate-900 bg-slate-900 text-white dark:border-white dark:bg-white dark:text-slate-900'
                : 'border-slate-200 text-slate-500 dark:border-slate-700',
            )}
          >
            {m}
          </span>
        ))}
        {['Low', 'Medium', 'High'].map((e, i) => (
          <span
            key={e}
            className={cn(
              'rounded-full border px-4 py-1.5 text-sm',
              i === 0
                ? 'border-slate-900 bg-slate-900 text-white dark:border-white dark:bg-white dark:text-slate-900'
                : 'border-slate-200 text-slate-500 dark:border-slate-700',
            )}
          >
            {e}
          </span>
        ))}
      </div>
    ),
  },
  {
    title: 'A planner that tells you the truth',
    body: "Set your weekly hours and Momentum shows when the week is overbooked — then moves the least important tasks to next week in one tap. Tasks you keep snoozing get called out, not buried.",
    mock: (
      <div className="w-full max-w-sm">
        <div className="mb-1.5 flex justify-between text-xs text-slate-400">
          <span className="font-medium text-amber-600 dark:text-amber-400">~26h planned</span>
          <span>of 20h</span>
        </div>
        <div className="h-2 overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800">
          <div className="h-2 w-full rounded-full bg-amber-500" />
        </div>
        <div className="mt-3 rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-800 dark:bg-amber-950/40 dark:text-amber-300">
          Over capacity — move 3 tasks to next week?
        </div>
      </div>
    ),
  },
  {
    title: 'Built for teams, sized for you',
    body: 'Personal and team workspaces, projects, assignees, comments with @mentions and a live view of who is carrying how much. Everything scoped, nothing leaking between spaces.',
    mock: (
      <div className="flex flex-col gap-2">
        <div className="flex items-center gap-2 text-sm">
          <span className="flex h-6 w-6 items-center justify-center rounded-full bg-slate-200 text-[10px] font-semibold uppercase dark:bg-slate-700">
            m
          </span>
          <span className="text-slate-500 dark:text-slate-400">
            <span className="font-medium text-slate-900 dark:text-white">@mery</span> can you take
            this one?
          </span>
        </div>
        <div className="flex gap-1.5">
          <Badge label="Design" tone="bg-indigo-500/10 text-indigo-600 dark:text-indigo-400" />
          <Badge label="assigned" tone="bg-emerald-500/10 text-emerald-600 dark:text-emerald-400" />
          <Badge label="high" tone="bg-red-500/10 text-red-600 dark:text-red-400" />
        </div>
      </div>
    ),
  },
  {
    title: 'Plugged into your real workflow',
    body: 'Open tasks as GitHub issues and sync them back when they close. Import repositories as projects. Subscribe to your tasks from Google, Apple or Outlook calendar with one link.',
    mock: (
      <div className="flex flex-col gap-2 text-sm">
        <div className="flex items-center gap-2 rounded-lg border border-slate-200 px-3 py-2 dark:border-slate-800">
          <span>⌥</span>
          <span className="text-slate-600 dark:text-slate-300">Issue #42 closed</span>
          <span className="ml-auto text-xs font-medium text-emerald-600 dark:text-emerald-400">
            → Done
          </span>
        </div>
        <div className="flex items-center gap-2 rounded-lg border border-slate-200 px-3 py-2 dark:border-slate-800">
          <span>🗓</span>
          <span className="truncate text-xs text-slate-400">…/calendar/feed/a8f2…ics</span>
        </div>
      </div>
    ),
  },
];

const STEPS = [
  { n: '01', title: 'Capture', body: 'Quick-add with natural syntax — #tag !high ~30m tomorrow.' },
  { n: '02', title: 'Focus', body: 'Ask "what now?" and work the one task that fits.' },
  { n: '03', title: 'Review', body: "Weekly review shows wins, overdue and next week's load." },
];

export function LandingPage() {
  const authed = Boolean(useAuthStore((s) => s.token));

  // Standalone page (outside AppLayout) — honour the stored theme.
  useEffect(() => {
    document.documentElement.classList.toggle('dark', localStorage.getItem('theme') === 'dark');
  }, []);

  const cta = authed
    ? { to: '/tasks', label: 'Open app' }
    : { to: '/register', label: "Get started — it's free" };

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 dark:bg-slate-950 dark:text-white">
      {/* Nav */}
      <header className="sticky top-0 z-40 border-b border-slate-200/70 bg-slate-50/80 backdrop-blur dark:border-slate-800/70 dark:bg-slate-950/80">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-6 py-4">
          <span className="flex items-center gap-2 font-semibold tracking-tight">
            <span className="inline-block h-2.5 w-2.5 rounded-full bg-slate-900 dark:bg-white" />
            Momentum
          </span>
          <nav className="flex items-center gap-3">
            {!authed && (
              <Link
                to="/login"
                className="text-sm text-slate-500 transition-colors hover:text-slate-900 dark:text-slate-400 dark:hover:text-white"
              >
                Sign in
              </Link>
            )}
            <Link
              to={cta.to}
              className="rounded-lg bg-slate-900 px-3.5 py-2 text-sm font-medium text-white transition-opacity hover:opacity-85 dark:bg-white dark:text-slate-900"
            >
              {cta.label}
            </Link>
          </nav>
        </div>
      </header>

      {/* Hero */}
      <section className="relative overflow-hidden">
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(60%_50%_at_50%_0%,rgba(100,116,139,0.12),transparent)]" />
        <div className="mx-auto grid max-w-5xl items-center gap-14 px-6 pb-24 pt-20 md:grid-cols-2 md:pt-28">
          <div>
            <Reveal>
              <p className="mb-4 inline-block rounded-full border border-slate-200 px-3 py-1 text-xs font-medium text-slate-500 dark:border-slate-800 dark:text-slate-400">
                An active assistant, not another list
              </p>
            </Reveal>
            <Reveal delay={100}>
              <h1 className="text-4xl font-semibold leading-tight tracking-tight md:text-6xl">
                Stop managing tasks.
                <br />
                <span className="text-slate-400 dark:text-slate-500">Start finishing them.</span>
              </h1>
            </Reveal>
            <Reveal delay={200}>
              <p className="mt-5 max-w-md text-lg text-slate-500 dark:text-slate-400">
                Momentum answers the only question that matters — <em>what should I do now?</em> —
                using your time, your energy and your real deadlines.
              </p>
            </Reveal>
            <Reveal delay={300}>
              <div className="mt-8 flex flex-wrap items-center gap-3">
                <Link
                  to={cta.to}
                  className="rounded-xl bg-slate-900 px-6 py-3 text-sm font-semibold text-white transition-transform hover:-translate-y-0.5 dark:bg-white dark:text-slate-900"
                >
                  {cta.label}
                </Link>
                {!authed && (
                  <Link
                    to="/login"
                    className="rounded-xl border border-slate-200 px-6 py-3 text-sm font-medium text-slate-600 transition-colors hover:bg-white dark:border-slate-800 dark:text-slate-300 dark:hover:bg-slate-900"
                  >
                    Sign in
                  </Link>
                )}
              </div>
            </Reveal>
          </div>
          <Reveal delay={250}>
            <HeroMock />
          </Reveal>
        </div>
      </section>

      {/* How it works */}
      <section className="border-y border-slate-200/70 bg-white/60 dark:border-slate-800/70 dark:bg-slate-900/40">
        <div className="mx-auto grid max-w-5xl gap-10 px-6 py-16 md:grid-cols-3">
          {STEPS.map((s, i) => (
            <Reveal key={s.n} delay={i * 120}>
              <p className="text-sm font-semibold text-slate-300 dark:text-slate-600">{s.n}</p>
              <h3 className="mt-1 text-lg font-semibold tracking-tight">{s.title}</h3>
              <p className="mt-1.5 text-sm text-slate-500 dark:text-slate-400">{s.body}</p>
            </Reveal>
          ))}
        </div>
      </section>

      {/* Features — alternating rows */}
      <section className="mx-auto max-w-5xl space-y-28 px-6 py-28">
        {FEATURES.map((f, i) => (
          <div
            key={f.title}
            className={cn(
              'grid items-center gap-10 md:grid-cols-2',
              i % 2 === 1 && 'md:[&>*:first-child]:order-2',
            )}
          >
            <Reveal>
              <h2 className="text-2xl font-semibold tracking-tight md:text-3xl">{f.title}</h2>
              <p className="mt-3 max-w-md text-slate-500 dark:text-slate-400">{f.body}</p>
            </Reveal>
            <Reveal delay={150}>
              <div className="flex justify-center rounded-2xl border border-slate-200 bg-white p-8 dark:border-slate-800 dark:bg-slate-900">
                {f.mock}
              </div>
            </Reveal>
          </div>
        ))}
      </section>

      {/* CTA */}
      <section className="mx-auto max-w-5xl px-6 pb-28">
        <Reveal>
          <div className="rounded-3xl bg-slate-900 px-8 py-16 text-center text-white dark:bg-white dark:text-slate-900">
            <h2 className="text-3xl font-semibold tracking-tight md:text-4xl">
              Know what to do next.
            </h2>
            <p className="mx-auto mt-3 max-w-md text-slate-300 dark:text-slate-500">
              Free while in beta. Web and mobile, your data in one place.
            </p>
            <Link
              to={cta.to}
              className="mt-8 inline-block rounded-xl bg-white px-8 py-3 text-sm font-semibold text-slate-900 transition-transform hover:-translate-y-0.5 dark:bg-slate-900 dark:text-white"
            >
              {cta.label}
            </Link>
          </div>
        </Reveal>
      </section>

      <footer className="border-t border-slate-200/70 py-8 text-center text-xs text-slate-400 dark:border-slate-800/70">
        Momentum · task.captainmery.com
      </footer>
    </div>
  );
}
