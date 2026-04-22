/**
 * VideoShowcase — the hero-adjacent marquee component that plays
 * the 60-second motion-design reel we rendered with Remotion.
 *
 * Interactive behaviour:
 *   - Language toggle (EN/FR) in the top-right corner. Clicking it
 *     swaps the <source> AND resets the current playback time so the
 *     viewer watches the same moment in the new language.
 *   - A large glowing play/pause overlay fades in when the video is
 *     paused and fades away on play.
 *   - A progress bar at the bottom shows current position.
 *   - We respect prefers-reduced-motion: if set, the video does NOT
 *     autoplay but the user can still click play.
 *
 * Accessibility:
 *   - Video has explicit `aria-label`.
 *   - Play/pause button is a real <button>, focusable and keyboard
 *     activatable.
 *   - Progress bar is a progressbar with aria-valuenow.
 */
import { useEffect, useRef, useState } from 'react';
import { Play, Pause, Volume2, VolumeX, Maximize2 } from 'lucide-react';

type Lang = 'en' | 'fr';

const VIDEOS: Record<Lang, { src: string; poster?: string; label: string }> = {
  en: {
    src: '/videos/voiceink-promo-en.mp4',
    label: 'English — 60 s',
  },
  fr: {
    src: '/videos/voiceink-promo-fr.mp4',
    label: 'Français — 60 s',
  },
};

export default function VideoShowcase() {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const wrapperRef = useRef<HTMLDivElement | null>(null);
  const [lang, setLang] = useState<Lang>('en');
  const [playing, setPlaying] = useState(false);
  const [muted, setMuted] = useState(true);
  const [progress, setProgress] = useState(0);
  const [time, setTime] = useState('00:00');
  const [duration, setDuration] = useState('01:00');
  const [visible, setVisible] = useState(false);

  // Autoplay when the component scrolls into view, pause when it leaves.
  useEffect(() => {
    const el = wrapperRef.current;
    const vid = videoRef.current;
    if (!el || !vid) return;

    const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    const io = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          setVisible(entry.isIntersecting);
          if (entry.isIntersecting && !prefersReducedMotion) {
            vid.play().catch(() => {/* autoplay blocked, no-op */});
          } else {
            vid.pause();
          }
        }
      },
      { threshold: 0.35 }
    );

    io.observe(el);
    return () => io.disconnect();
  }, []);

  // Progress tracking
  useEffect(() => {
    const vid = videoRef.current;
    if (!vid) return;
    const onTime = () => {
      const p = (vid.currentTime / (vid.duration || 1)) * 100;
      setProgress(Number.isFinite(p) ? p : 0);
      setTime(fmt(vid.currentTime));
      if (Number.isFinite(vid.duration) && vid.duration > 0) setDuration(fmt(vid.duration));
    };
    const onPlay  = () => setPlaying(true);
    const onPause = () => setPlaying(false);

    vid.addEventListener('timeupdate', onTime);
    vid.addEventListener('play', onPlay);
    vid.addEventListener('pause', onPause);
    vid.addEventListener('loadedmetadata', onTime);
    return () => {
      vid.removeEventListener('timeupdate', onTime);
      vid.removeEventListener('play', onPlay);
      vid.removeEventListener('pause', onPause);
      vid.removeEventListener('loadedmetadata', onTime);
    };
  }, [lang]);

  // Handle lang switch — preserve current time
  const switchLang = (next: Lang) => {
    if (next === lang) return;
    const vid = videoRef.current;
    const keepTime = vid?.currentTime ?? 0;
    const wasPlaying = vid ? !vid.paused : false;
    setLang(next);
    setTimeout(() => {
      if (videoRef.current) {
        videoRef.current.currentTime = keepTime;
        if (wasPlaying) videoRef.current.play().catch(() => {});
      }
    }, 30);
  };

  const togglePlay = () => {
    const vid = videoRef.current;
    if (!vid) return;
    vid.paused ? vid.play().catch(() => {}) : vid.pause();
  };

  const toggleMute = () => {
    const vid = videoRef.current;
    if (!vid) return;
    vid.muted = !vid.muted;
    setMuted(vid.muted);
  };

  const enterFullscreen = () => {
    const vid = videoRef.current;
    if (!vid) return;
    if (document.fullscreenElement) {
      document.exitFullscreen?.().catch(() => {});
    } else {
      vid.requestFullscreen?.().catch(() => {});
    }
  };

  const seek = (e: React.MouseEvent<HTMLDivElement>) => {
    const vid = videoRef.current;
    if (!vid) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const x = (e.clientX - rect.left) / rect.width;
    vid.currentTime = Math.max(0, Math.min(1, x)) * (vid.duration || 0);
  };

  return (
    <section id="demo" className="relative py-20 md:py-32" aria-labelledby="demo-title">
      {/* Aurora backdrop */}
      <div className="absolute inset-0 -z-10" aria-hidden="true">
        <div className="aurora-blob animate-aurora" style={{ width: '80vw', height: '60vw', left: '10vw', top: '10vw', background: 'radial-gradient(circle, rgba(167,139,250,0.35), transparent 60%)' }} />
        <div className="aurora-blob animate-aurora" style={{ width: '70vw', height: '50vw', right: '-5vw', bottom: '0vw', background: 'radial-gradient(circle, rgba(34,211,238,0.25), transparent 60%)', animationDelay: '-8s' }} />
      </div>

      <div className="container-page px-4 md:px-6">
        {/* Section header */}
        <div className="mx-auto mb-10 max-w-3xl text-center md:mb-14">
          <span className="pill pill-glow">
            <span className="text-fuchsia-300">●</span> Watch a 60-second demo
          </span>
          <h2 id="demo-title" className="mt-4 font-display text-display font-semibold text-white">
            Not a mockup.{' '}
            <span className="text-gradient">A recording of how it actually feels.</span>
          </h2>
          <p className="mt-3 text-base text-ink-300 md:text-lg">
            Every frame below was rendered from real product footage and the same aurora
            motion system powering the app. No pitch deck magic.
          </p>
        </div>

        {/* Video card */}
        <div
          ref={wrapperRef}
          className="relative mx-auto max-w-5xl overflow-hidden rounded-[28px] border border-white/10 bg-ink-900/50 shadow-[0_50px_120px_-40px_rgba(167,139,250,0.55),0_0_0_1px_rgba(255,255,255,0.04)] backdrop-blur"
        >
          {/* Breathing aurora outline */}
          <div
            aria-hidden="true"
            className="pointer-events-none absolute -inset-[2px] -z-10 rounded-[30px] opacity-80"
            style={{
              background: 'conic-gradient(from 110deg, rgba(167,139,250,0.45), rgba(34,211,238,0.45), rgba(244,114,182,0.45), rgba(251,191,36,0.4), rgba(167,139,250,0.45))',
              filter: 'blur(22px)',
              animation: 'aurora 14s linear infinite',
            }}
          />

          {/* Lang toggle */}
          <div className="absolute right-4 top-4 z-20 flex items-center gap-1 rounded-full border border-white/10 bg-ink-900/70 p-1 backdrop-blur-xl">
            {(['en', 'fr'] as const).map((l) => (
              <button
                key={l}
                onClick={() => switchLang(l)}
                className={`focus-ring rounded-full px-3.5 py-1.5 text-xs font-semibold uppercase tracking-wider transition-all duration-200 ${
                  l === lang
                    ? 'bg-gradient-to-br from-aurora-purple to-aurora-pink text-white shadow-[0_4px_16px_rgba(167,139,250,0.5)]'
                    : 'text-ink-300 hover:text-white'
                }`}
                aria-pressed={l === lang}
              >
                {l === 'en' ? '🇬🇧 EN' : '🇫🇷 FR'}
              </button>
            ))}
          </div>

          {/* Video */}
          <video
            key={lang} // force <video> remount when lang changes so source swap is clean
            ref={videoRef}
            className="block aspect-video w-full bg-black"
            src={VIDEOS[lang].src}
            muted={muted}
            playsInline
            preload="metadata"
            poster="/videos/poster.svg"
            aria-label={`VoiceInk promo video (${VIDEOS[lang].label})`}
          />

          {/* Play overlay — shown while paused */}
          <button
            type="button"
            onClick={togglePlay}
            aria-label={playing ? 'Pause' : 'Play'}
            className={`absolute inset-0 z-10 flex items-center justify-center transition-all duration-300 ${
              playing ? 'opacity-0 pointer-events-none' : 'opacity-100 bg-black/20'
            }`}
          >
            <span
              className="flex h-24 w-24 items-center justify-center rounded-full bg-white/10 backdrop-blur-xl ring-1 ring-white/20"
              style={{ boxShadow: '0 0 60px 8px rgba(167,139,250,0.45), inset 0 0 0 1px rgba(255,255,255,0.12)' }}
            >
              <Play size={40} className="ml-1 fill-white text-white" />
            </span>
          </button>

          {/* Bottom controls bar */}
          <div className="pointer-events-none absolute inset-x-0 bottom-0 z-20 flex flex-col gap-2 bg-gradient-to-t from-black/80 via-black/40 to-transparent p-4 md:p-5">
            {/* Scrubber */}
            <div
              role="progressbar"
              aria-label="Video progress"
              aria-valuenow={Math.round(progress)}
              aria-valuemin={0}
              aria-valuemax={100}
              className="pointer-events-auto h-1 w-full cursor-pointer rounded-full bg-white/15 transition-[height] hover:h-1.5"
              onClick={seek}
            >
              <div
                className="h-full rounded-full bg-gradient-to-r from-aurora-purple via-aurora-pink to-aurora-amber shadow-[0_0_10px_rgba(167,139,250,0.6)]"
                style={{ width: `${progress}%` }}
              />
            </div>
            {/* Bottom row */}
            <div className="flex items-center justify-between gap-3">
              <div className="pointer-events-auto flex items-center gap-2">
                <button
                  type="button"
                  onClick={togglePlay}
                  aria-label={playing ? 'Pause' : 'Play'}
                  className="focus-ring inline-flex h-9 w-9 items-center justify-center rounded-full bg-white/10 text-white ring-1 ring-white/15 backdrop-blur-md hover:bg-white/20"
                >
                  {playing ? <Pause size={16} /> : <Play size={16} className="ml-0.5" />}
                </button>
                <button
                  type="button"
                  onClick={toggleMute}
                  aria-label={muted ? 'Unmute' : 'Mute'}
                  className="focus-ring inline-flex h-9 w-9 items-center justify-center rounded-full bg-white/10 text-white ring-1 ring-white/15 backdrop-blur-md hover:bg-white/20"
                >
                  {muted ? <VolumeX size={16} /> : <Volume2 size={16} />}
                </button>
                <span className="font-mono text-[11px] text-white/90 tabular-nums">
                  {time} <span className="text-white/40">/ {duration}</span>
                </span>
              </div>

              <div className="pointer-events-auto flex items-center gap-2">
                <span className="hidden rounded-full bg-white/10 px-2 py-0.5 text-[10px] font-medium uppercase tracking-wider text-white/80 md:inline">
                  {VIDEOS[lang].label}
                </span>
                <button
                  type="button"
                  onClick={enterFullscreen}
                  aria-label="Fullscreen"
                  className="focus-ring inline-flex h-9 w-9 items-center justify-center rounded-full bg-white/10 text-white ring-1 ring-white/15 backdrop-blur-md hover:bg-white/20"
                >
                  <Maximize2 size={16} />
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Mini-stats row underneath the video */}
        <div className="mx-auto mt-10 grid max-w-5xl grid-cols-2 gap-4 md:grid-cols-4 md:gap-6">
          <Stat label="Voice-to-voice" value="380 ms" tint="from-aurora-purple to-aurora-cyan" />
          <Stat label="Languages" value="30+" tint="from-aurora-cyan to-aurora-blue" />
          <Stat label="Render length" value="60 s" tint="from-aurora-pink to-aurora-amber" />
          <Stat label="Free forever" value="0 €" tint="from-aurora-amber to-aurora-pink" />
        </div>
      </div>
    </section>
  );
}

function Stat({ label, value, tint }: { label: string; value: string; tint: string }) {
  return (
    <div className="glass rounded-2xl p-5 text-center transition-transform duration-200 hover:-translate-y-0.5">
      <div
        className={`bg-gradient-to-br ${tint} bg-clip-text font-display text-3xl font-bold text-transparent md:text-4xl`}
      >
        {value}
      </div>
      <div className="mt-1 text-xs uppercase tracking-wider text-ink-300">{label}</div>
    </div>
  );
}

function fmt(sec: number): string {
  if (!Number.isFinite(sec) || sec < 0) return '00:00';
  const m = Math.floor(sec / 60);
  const s = Math.floor(sec % 60);
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}
