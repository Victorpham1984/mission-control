"use client";
import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { getStoredUser, setStoredWorkspace, setOnboarded } from "@/lib/mock-auth";

const steps = ["Welcome", "Workspace", "Connect", "Done"];

export default function OnboardingPage() {
  const router = useRouter();
  const [step, setStep] = useState(0);
  const [wsName, setWsName] = useState("");
  const [gatewayUrl, setGatewayUrl] = useState("");
  const [gatewayToken, setGatewayToken] = useState("");
  const [userName, setUserName] = useState("");

  useEffect(() => {
    const user = getStoredUser();
    if (!user) {
      router.push("/login");
      return;
    }
    setUserName(user.name);
  }, [router]);

  const handleFinish = () => {
    setStoredWorkspace({
      id: crypto.randomUUID(),
      name: wsName || "My Workspace",
      openclawUrl: gatewayUrl,
      openclawToken: gatewayToken,
    });
    setOnboarded(true);
    router.push("/");
  };

  const canNext = () => {
    if (step === 1) return wsName.trim().length > 0;
    return true;
  };

  return (
    <div className="min-h-screen flex items-center justify-center px-4 bg-[var(--bg)]">
      <div className="w-full max-w-[520px] animate-modal">
        {/* Progress */}
        <div className="flex items-center justify-center gap-2 mb-8">
          {steps.map((s, i) => (
            <div key={s} className="flex items-center gap-2">
              <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-semibold transition-all ${
                i <= step
                  ? "bg-[var(--accent)] text-black"
                  : "bg-[var(--card)] text-[var(--text-dim)] border border-[var(--border)]"
              }`}>
                {i < step ? "✓" : i + 1}
              </div>
              {i < steps.length - 1 && (
                <div className={`w-8 h-0.5 transition-all ${i < step ? "bg-[var(--accent)]" : "bg-[var(--border)]"}`} />
              )}
            </div>
          ))}
        </div>

        <div className="bg-[var(--surface)] rounded-2xl border border-[var(--border)] p-8 min-h-[320px] flex flex-col">
          <div className="flex-1">
            {/* Step 0: Welcome */}
            {step === 0 && (
              <div className="text-center py-8">
                <span className="text-5xl mb-4 block">🚀</span>
                <h2 className="text-xl font-bold mb-2">Welcome to CommandMate{userName ? `, ${userName}` : ""}!</h2>
                <p className="text-[var(--text-dim)] text-sm leading-relaxed max-w-sm mx-auto">
                  Let&apos;s set up your workspace so you can start managing your AI agents like a pro.
                </p>
              </div>
            )}

            {/* Step 1: Workspace */}
            {step === 1 && (
              <div className="py-4">
                <h2 className="text-lg font-semibold mb-1">Name your workspace</h2>
                <p className="text-sm text-[var(--text-dim)] mb-6">This is where your team and agents live.</p>
                <div>
                  <label className="text-[11px] uppercase tracking-wider text-[var(--text-dim)] block mb-1.5">Workspace Name</label>
                  <input
                    value={wsName}
                    onChange={e => setWsName(e.target.value)}
                    className="w-full px-3 py-2.5 rounded-lg border border-[var(--border)] bg-[var(--card)] text-sm focus:outline-none focus:border-[var(--accent)] transition"
                    placeholder="e.g. BizMate HQ"
                    autoFocus
                  />
                </div>
              </div>
            )}

            {/* Step 2: Connect */}
            {step === 2 && (
              <div className="py-4">
                <h2 className="text-lg font-semibold mb-1">Connect your AI platform</h2>
                <p className="text-sm text-[var(--text-dim)] mb-6">Link your OpenClaw gateway to manage agents. You can skip and do this later.</p>
                <div className="space-y-4">
                  <div>
                    <label className="text-[11px] uppercase tracking-wider text-[var(--text-dim)] block mb-1.5">Gateway URL</label>
                    <input
                      value={gatewayUrl}
                      onChange={e => setGatewayUrl(e.target.value)}
                      className="w-full px-3 py-2.5 rounded-lg border border-[var(--border)] bg-[var(--card)] text-sm focus:outline-none focus:border-[var(--accent)] transition font-mono"
                      placeholder="https://gateway.openclaw.ai"
                    />
                  </div>
                  <div>
                    <label className="text-[11px] uppercase tracking-wider text-[var(--text-dim)] block mb-1.5">API Token</label>
                    <input
                      type="password"
                      value={gatewayToken}
                      onChange={e => setGatewayToken(e.target.value)}
                      className="w-full px-3 py-2.5 rounded-lg border border-[var(--border)] bg-[var(--card)] text-sm focus:outline-none focus:border-[var(--accent)] transition font-mono"
                      placeholder="oc_xxxxxxxxxxxxxxxx"
                    />
                  </div>
                </div>
              </div>
            )}

            {/* Step 3: Done */}
            {step === 3 && (
              <div className="text-center py-8">
                <span className="text-5xl mb-4 block">🎉</span>
                <h2 className="text-xl font-bold mb-2">You&apos;re all set!</h2>
                <p className="text-[var(--text-dim)] text-sm leading-relaxed max-w-sm mx-auto">
                  Your workspace is ready. Let&apos;s head to the dashboard and start commanding your agents.
                </p>
              </div>
            )}
          </div>

          {/* Navigation */}
          <div className="flex items-center justify-between pt-6 border-t border-[var(--border)]">
            {step > 0 && step < 3 ? (
              <button
                onClick={() => setStep(s => s - 1)}
                className="px-4 py-2 rounded-lg border border-[var(--border)] bg-[var(--card)] text-sm hover:bg-[var(--card-hover)] transition"
              >
                Back
              </button>
            ) : <div />}

            {step < 3 ? (
              <button
                onClick={() => setStep(s => s + 1)}
                disabled={!canNext()}
                className="px-6 py-2.5 rounded-lg bg-[var(--accent)] text-black font-semibold text-sm hover:brightness-110 transition disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {step === 2 ? (gatewayUrl ? "Connect & Continue" : "Skip for now") : "Continue"}
              </button>
            ) : (
              <button
                onClick={handleFinish}
                className="px-6 py-2.5 rounded-lg bg-[var(--accent)] text-black font-semibold text-sm hover:brightness-110 transition"
              >
                Go to Dashboard →
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
