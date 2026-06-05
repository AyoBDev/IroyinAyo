import { useState } from 'react';
import { HelpCircle, X, TrendingUp, Coins, Target, Users, ChevronRight } from 'lucide-react';

const steps = [
  {
    icon: Coins,
    title: 'Get Points',
    description: 'You start with free points. If you ever run out, we auto-refill your balance so you can keep predicting.',
  },
  {
    icon: Target,
    title: 'Make Predictions',
    description: 'Browse markets and predict outcomes. The price shows what the crowd thinks the probability is.',
  },
  {
    icon: TrendingUp,
    title: 'Prices Move',
    description: 'When more people predict an outcome, its price goes up. Predict early on the right outcome to earn more.',
  },
  {
    icon: Users,
    title: 'Win Points',
    description: 'When a market resolves, correct predictions pay out. The earlier you predicted, the bigger your payout.',
  },
];

export default function HowItWorks() {
  const [open, setOpen] = useState(false);

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="flex items-center gap-1.5 py-2.5 px-4 w-full bg-paper border border-line rounded-2xl text-ink-muted text-[13px] font-semibold"
      >
        <HelpCircle size={15} className="text-emerald" />
        How It Works
        <ChevronRight size={14} className="ml-auto text-ink-muted" />
      </button>

      {open && (
        <div className="fixed inset-0 z-[1000] bg-black/70 backdrop-blur-sm flex items-center justify-center p-5">
          <div className="bg-paper rounded-2xl border border-line w-full max-w-[420px] overflow-hidden animate-slide-up shadow-float">
            <div className="py-4 px-5 border-b border-line flex justify-between items-center">
              <h2 className="font-serif text-base text-ink">How It Works</h2>
              <button
                onClick={() => setOpen(false)}
                className="bg-bone rounded-full w-7 h-7 flex items-center justify-center"
              >
                <X size={14} className="text-ink-muted" />
              </button>
            </div>

            <div className="p-5">
              {steps.map((step, i) => {
                const Icon = step.icon;
                return (
                  <div key={i} className={`flex gap-3.5 ${i < steps.length - 1 ? 'mb-5' : ''}`}>
                    <div className="w-9 h-9 rounded-[10px] bg-accent-green-bg border border-accent-green-border flex items-center justify-center shrink-0">
                      <Icon size={16} className="text-emerald" />
                    </div>
                    <div>
                      <h3 className="font-serif text-[13px] mb-1">
                        {step.title}
                      </h3>
                      <p className="text-xs text-ink-muted leading-relaxed">
                        {step.description}
                      </p>
                    </div>
                  </div>
                );
              })}
            </div>

            <div className="px-5 pb-5">
              <div className="py-3 px-4 rounded-md bg-accent-green-bg border border-accent-green-border">
                <p className="text-xs text-accent-green font-semibold">
                  Points are free and refill automatically. There is no real money involved.
                </p>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
