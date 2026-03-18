import { Loader2 } from 'lucide-react';
import logo from '@/assets/etickets-logo.png';

export default function LoadingScreen() {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-gradient-to-br from-primary to-channel-online p-4">
      <div className="flex flex-col items-center gap-6 animate-slide-up">
        <div className="w-24 h-24 bg-primary-foreground/10 rounded-2xl p-4 backdrop-blur-sm">
          <img src={logo} alt="E-Tickets" className="w-full h-full object-contain" />
        </div>
        
        <div className="flex flex-col items-center gap-3">
          <div className="flex items-center gap-3">
            <Loader2 className="w-6 h-6 text-primary-foreground animate-spin" />
            <span className="text-primary-foreground text-lg font-medium">
              Učitavanje podataka...
            </span>
          </div>
          
          <div className="flex gap-1.5">
            {[0, 1, 2, 3].map((i) => (
              <div
                key={i}
                className="w-2 h-2 bg-primary-foreground/60 rounded-full animate-pulse"
                style={{ animationDelay: `${i * 150}ms` }}
              />
            ))}
          </div>
        </div>
        
        <p className="text-primary-foreground/70 text-sm text-center max-w-xs">
          Molimo sačekajte dok se podaci učitavaju sa servera
        </p>
      </div>
    </div>
  );
}
