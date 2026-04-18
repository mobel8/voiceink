import { useStore } from '../stores/useStore';
import { Wifi, WifiOff, Circle } from 'lucide-react';

export function StatusBar() {
  const { recState, settings, lastLatencyMs } = useStore();
  const online = navigator.onLine;
  const stateColor =
    recState === 'recording' ? 'text-rose-400' :
    recState === 'processing' ? 'text-cyan-400' :
    recState === 'error' ? 'text-amber-400' : 'text-emerald-400';
  const stateLabel =
    recState === 'recording' ? 'Enregistrement' :
    recState === 'processing' ? 'Traitement' :
    recState === 'error' ? 'Erreur' : 'Prêt';

  return (
    <div className="h-7 px-4 flex items-center justify-between text-[11px] text-white/50 border-t border-white/5 bg-black/30">
      <div className="flex items-center gap-3">
        <div className={`flex items-center gap-1.5 ${stateColor}`}>
          <Circle size={8} fill="currentColor" />
          <span>{stateLabel}</span>
        </div>
        <span>·</span>
        <span>{settings.sttModel}</span>
        {lastLatencyMs > 0 && <><span>·</span><span>Dernière latence: {lastLatencyMs}ms</span></>}
      </div>
      <div className="flex items-center gap-3">
        <div className="flex items-center gap-1">
          {online ? <Wifi size={11} /> : <WifiOff size={11} className="text-rose-400" />}
          <span>{online ? 'En ligne' : 'Hors ligne'}</span>
        </div>
        <span>VoiceInk v1.0</span>
      </div>
    </div>
  );
}
