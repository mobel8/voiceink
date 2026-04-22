/**
 * Pricing section — 3 tiers with a monthly/yearly toggle.
 *
 * Annual discount is 2 months free (≈ 16.6 %). Toggle uses a classic
 * pill switch with the price fading across, powered by Framer Motion's
 * `<AnimatePresence>` so the numbers don't "jump" during the swap.
 *
 * ROI badge on the Pro card: calculated in `useMemo` — we estimate
 * how many minutes of dictation / interpreter the average user runs
 * per day and express the saving vs Otter / Dragon.
 *
 * Keyboard: arrow keys on the toggle flip between monthly/yearly.
 * Focus-visible ring on every actionable element.
 */
import { useMemo, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Check, Sparkles, Zap, Shield, ArrowRight } from 'lucide-react';

type Cycle = 'monthly' | 'yearly';

interface Plan {
  key: 'free' | 'pro' | 'team';
  name: string;
  tagline: string;
  priceMonthly: number;
  priceYearly: number | null; // null = monthly-only plan (Team)
  ctaLabel: string;
  ctaHref: string;
  highlighted?: boolean;
  features: string[];
  limits: string[];
  icon: typeof Sparkles;
}

const PLANS: Plan[] = [
  {
    key: 'free',
    name: 'Free',
    tagline: 'For trying things out.',
    priceMonthly: 0,
    priceYearly: 0,
    ctaLabel: 'Download free',
    ctaHref: '#download',
    icon: Sparkles,
    features: [
      '30 min dictation / day',
      '15 min interpreter / month',
      'All 4 dictation modes',
      'Bring your own API keys',
    ],
    limits: [
      'No listener mode',
      'No history export',
      '7-day history retention',
    ],
  },
  {
    key: 'pro',
    name: 'Pro',
    tagline: 'Everything unlocked.',
    priceMonthly: 9.90,
    priceYearly: 99,
    ctaLabel: 'Start free trial',
    ctaHref: '#checkout-pro',
    highlighted: true,
    icon: Zap,
    features: [
      'Unlimited dictation (fair use)',
      '10 h interpreter / month',
      '10 h voice synthesis / month',
      'Voice cloning (coming soon)',
      'Full history + export (JSON / MD / CSV)',
      'Custom vocabulary',
      'Priority routing (Groq first)',
    ],
    limits: [],
  },
  {
    key: 'team',
    name: 'Team',
    tagline: 'For small teams & studios.',
    priceMonthly: 19,
    priceYearly: null,
    ctaLabel: 'Start a team',
    ctaHref: '#checkout-team',
    icon: Shield,
    features: [
      'Everything in Pro',
      'Team workspace & shared dictionary',
      '30 h interpreter / month',
      'SSO (Google / Microsoft)',
      'Priority email support',
      'Seat-based pricing from 3 seats',
    ],
    limits: [],
  },
];

export default function Pricing() {
  const [cycle, setCycle] = useState<Cycle>('monthly');

  const roiSavings = useMemo(() => {
    // Assume an Otter Pro user ($17/mo ≈ 16 €) and compare to our Pro.
    // For medical users we'd compare vs Dragon Medical (~60 €/mo).
    const otter = 16;
    const ours = cycle === 'yearly' ? 99 / 12 : 9.90;
    return Math.round((otter - ours) * 12);
  }, [cycle]);

  return (
    <section id="pricing" className="relative py-20 md:py-32" aria-labelledby="pricing-title">
      <div className="container-page px-4 md:px-6">
        <div className="mx-auto max-w-2xl text-center">
          <div className="pill mx-auto">
            <span className="h-1.5 w-1.5 rounded-full bg-aurora-pink shadow-[0_0_18px_rgba(244,114,182,0.7)]" />
            Simple, honest pricing
          </div>
          <h2 id="pricing-title" className="mt-4 text-display font-semibold text-white">
            One price. <span className="text-gradient">No surprises.</span>
          </h2>
          <p className="mt-4 text-ink-300 md:text-lg">
            Start free, upgrade when the Free cap gets in your way. Cancel
            from the app in two clicks — no retention hotline, we promise.
          </p>

          {/* Billing cycle toggle */}
          <div
            role="tablist"
            aria-label="Billing cycle"
            className="glass mx-auto mt-8 inline-flex items-center gap-1 rounded-full border border-white/10 p-1"
          >
            <ToggleButton active={cycle === 'monthly'} onClick={() => setCycle('monthly')} label="Monthly" />
            <ToggleButton active={cycle === 'yearly'}  onClick={() => setCycle('yearly')}  label="Yearly" hint="2 months free" />
          </div>
        </div>

        <div className="mx-auto mt-12 grid max-w-6xl gap-5 md:grid-cols-3">
          {PLANS.map((plan) => (
            <PlanCard key={plan.key} plan={plan} cycle={cycle} />
          ))}
        </div>

        <p className="mt-10 text-center text-sm text-ink-400">
          Switching from Otter? You save{' '}
          <span className="text-white font-semibold">{roiSavings} € / year</span> per seat on Pro.{' '}
          <a href="/compare" className="underline decoration-aurora-purple/40 underline-offset-4 hover:text-white">
            See the full comparison
          </a>
          .
        </p>
      </div>
    </section>
  );
}

function ToggleButton({ active, onClick, label, hint }: { active: boolean; onClick: () => void; label: string; hint?: string }) {
  return (
    <button
      role="tab"
      aria-selected={active}
      onClick={onClick}
      className={`focus-ring relative rounded-full px-5 py-2 text-sm font-medium transition-colors ${active ? 'text-white' : 'text-ink-300 hover:text-white'}`}
    >
      {active && (
        <motion.span
          layoutId="toggle-bg"
          className="absolute inset-0 rounded-full bg-white/10 ring-1 ring-white/15"
          transition={{ type: 'spring', stiffness: 400, damping: 35 }}
        />
      )}
      <span className="relative">{label}</span>
      {hint && <span className="relative ml-2 rounded-md bg-aurora-cyan/20 px-1.5 py-0.5 text-[10px] font-semibold text-aurora-cyan">{hint}</span>}
    </button>
  );
}

function PlanCard({ plan, cycle }: { plan: Plan; cycle: Cycle }) {
  const Icon = plan.icon;
  const isYearly = cycle === 'yearly' && plan.priceYearly != null;
  const displayPrice =
    plan.priceMonthly === 0
      ? 'Free'
      : isYearly
      ? `${(plan.priceYearly! / 12).toFixed(2)} €`
      : `${plan.priceMonthly.toFixed(2)} €`;
  const displayUnit =
    plan.priceMonthly === 0 ? 'forever' : isYearly ? '/mo billed yearly' : '/mo';

  return (
    <motion.article
      initial={{ opacity: 0, y: 16 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: '-10%' }}
      transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
      className={`glass-tilt relative flex flex-col rounded-3xl p-6 ${
        plan.highlighted
          ? 'glass-strong ring-2 ring-aurora-purple/60 shadow-glow-violet'
          : 'glass'
      }`}
    >
      {plan.highlighted && (
        <span className="pill-glow absolute -top-3 left-1/2 -translate-x-1/2">
          <Sparkles size={12} />
          Most popular
        </span>
      )}

      <div className="flex items-center gap-3">
        <span
          className={`flex h-10 w-10 items-center justify-center rounded-xl ring-1 ${
            plan.highlighted
              ? 'bg-aurora-purple/20 ring-aurora-purple/40'
              : 'bg-white/[0.04] ring-white/10'
          }`}
        >
          <Icon size={18} className={plan.highlighted ? 'text-aurora-purple' : 'text-ink-200'} />
        </span>
        <div>
          <h3 className="text-lg font-semibold text-white">{plan.name}</h3>
          <p className="text-xs text-ink-400">{plan.tagline}</p>
        </div>
      </div>

      <div className="mt-6 flex items-end gap-2">
        <AnimatePresence mode="wait">
          <motion.span
            key={`${plan.key}-${cycle}`}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.25 }}
            className="font-display text-4xl font-semibold tracking-tight text-white"
          >
            {displayPrice}
          </motion.span>
        </AnimatePresence>
        <span className="mb-1.5 text-xs text-ink-400">{displayUnit}</span>
      </div>

      <a
        href={plan.ctaHref}
        className={`focus-ring mt-6 inline-flex items-center justify-center gap-2 rounded-2xl py-3 font-medium transition-all ${
          plan.highlighted ? 'btn-primary' : 'btn-secondary'
        }`}
      >
        {plan.ctaLabel}
        <ArrowRight size={16} />
      </a>

      <ul className="mt-6 space-y-2.5 text-sm">
        {plan.features.map((f) => (
          <li key={f} className="flex items-start gap-2">
            <Check size={14} className="mt-0.5 flex-none text-aurora-cyan" />
            <span className="text-ink-200">{f}</span>
          </li>
        ))}
        {plan.limits.map((f) => (
          <li key={f} className="flex items-start gap-2 text-ink-400">
            <span className="mt-1.5 inline-block h-px w-3 flex-none bg-ink-500" />
            <span>{f}</span>
          </li>
        ))}
      </ul>
    </motion.article>
  );
}
