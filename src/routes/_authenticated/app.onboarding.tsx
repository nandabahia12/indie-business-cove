import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useMemo, useState, type KeyboardEvent } from "react";
import { toast } from "sonner";
import { useOrg } from "@/modules/core/org-context";
import { completeOnboarding, getOnboarding, recommendOnboarding, saveOnboardingStep } from "@/modules/onboarding/onboarding.functions";
import { EMPTY_ANSWERS, QUESTIONS, type ListField, type Question } from "@/modules/onboarding/questions";
import type { OnboardingAnswers, Recommendation } from "@/modules/onboarding/recommend";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";

export const Route = createFileRoute("/_authenticated/app/onboarding")({
  head: () => ({
    meta: [
      { title: "Configuração inicial — Ateliê" },
      { name: "description", content: "Configure seu ambiente respondendo perguntas simples." },
      { property: "og:title", content: "Configuração inicial — Ateliê" },
      { property: "og:description", content: "Configure seu ambiente respondendo perguntas simples." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: Onboarding,
});

type Templates = Awaited<ReturnType<typeof getOnboarding>>["templates"];

function Onboarding() {
  const { org, isAdmin } = useOrg();
  const load = useServerFn(getOnboarding);
  const q = useQuery({ queryKey: ["onboarding", org.id], queryFn: () => load({ data: { organizationId: org.id } }) });

  if (!isAdmin) return <p className="text-muted-foreground">Apenas proprietários e administradores configuram a organização.</p>;
  if (q.isLoading) return <p className="text-muted-foreground">Carregando…</p>;
  if (q.error || !q.data) return <p className="text-destructive">Não foi possível carregar a configuração.</p>;
  if (q.data.onboarding?.status === "completed") return <p className="text-muted-foreground">A configuração inicial já foi concluída.</p>;

  const saved = q.data.onboarding;
  const initial: OnboardingAnswers = saved ? { ...EMPTY_ANSWERS, ...(saved as Partial<OnboardingAnswers>) } : { ...EMPTY_ANSWERS, business_name: org.name };
  return <Wizard initial={initial} initialStep={saved?.current_step ?? 0} templates={q.data.templates} preset={q.data.preset} />;
}

function Wizard({ initial, initialStep, templates, preset }: {
  initial: OnboardingAnswers; initialStep: number; templates: Templates;
  preset: Awaited<ReturnType<typeof getOnboarding>>["preset"];
}) {
  const { org } = useOrg();
  const save = useServerFn(saveOnboardingStep);
  const [answers, setAnswers] = useState<OnboardingAnswers>(initial);
  const [step, setStep] = useState(Math.min(initialStep, QUESTIONS.length));
  const [busy, setBusy] = useState(false);
  const template = templates.find((t) => t.key === answers.segment_key) ?? null;

  async function go(next: number, a = answers) {
    setBusy(true);
    try {
      await save({ data: { organizationId: org.id, step: next, answers: a } });
      setStep(next);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Não foi possível salvar.");
    } finally {
      setBusy(false);
    }
  }

  if (step >= QUESTIONS.length) {
    return <Review answers={answers} preset={preset} onBack={() => setStep(QUESTIONS.length - 1)} />;
  }
  const question = QUESTIONS[step]!;
  const canContinue = !question.required || Boolean(answers[question.id as keyof OnboardingAnswers]);

  return (
    <section className="mx-auto max-w-2xl">
      <Progress value={(step / QUESTIONS.length) * 100} className="mb-8" aria-label="Progresso" />
      <ol className="space-y-3" aria-label="Conversa">
        {QUESTIONS.slice(0, step).map((qq, i) => (
          <li key={qq.id} className="space-y-2">
            <p className="text-sm text-muted-foreground">{qq.prompt}</p>
            <button type="button" onClick={() => setStep(i)} className="ml-auto block rounded-2xl bg-secondary px-4 py-2 text-right text-sm text-secondary-foreground">
              {formatAnswer(qq, answers, templates) || <span className="italic opacity-70">Pulado</span>}
            </button>
          </li>
        ))}
      </ol>
      <div className="mt-8 rounded-xl border bg-card p-6">
        <h1 className="text-2xl">{question.prompt}</h1>
        {question.id === "segment_key" && template?.sensitive_data && template.privacy_notice && (
          <p className="mt-2 text-sm text-muted-foreground">{template.privacy_notice}</p>
        )}
        <div className="mt-5">
          <QuestionInput question={question} answers={answers} setAnswers={setAnswers} templates={templates} billing={template?.billing_suggestions ?? []} onEnter={() => canContinue && go(step + 1)} />
        </div>
        <div className="mt-6 flex items-center gap-3">
          {step > 0 && <Button variant="ghost" onClick={() => setStep(step - 1)}>Voltar</Button>}
          {!question.required && (
            <Button variant="outline" disabled={busy} onClick={() => {
              const cleared = { ...answers, [question.id]: Array.isArray(answers[question.id as keyof OnboardingAnswers]) ? [] : null } as OnboardingAnswers;
              setAnswers(cleared);
              go(step + 1, cleared);
            }}>Pular</Button>
          )}
          <Button className="ml-auto" disabled={!canContinue || busy} onClick={() => go(step + 1)}>
            {step === QUESTIONS.length - 1 ? "Ver recomendações" : "Continuar"}
          </Button>
        </div>
      </div>
    </section>
  );
}

function formatAnswer(q: Question, a: OnboardingAnswers, templates: Templates) {
  const v = a[q.id as keyof OnboardingAnswers];
  if (q.id === "segment_key") return templates.find((t) => t.key === v)?.name ?? "";
  if (q.kind === "single") return q.options.find((o) => o.value === v)?.label ?? "";
  return Array.isArray(v) ? v.join(", ") : (v ?? "");
}

function QuestionInput({ question, answers, setAnswers, templates, billing, onEnter }: {
  question: Question; answers: OnboardingAnswers; setAnswers: (a: OnboardingAnswers) => void;
  templates: Templates; billing: string[]; onEnter: () => void;
}) {
  const [draft, setDraft] = useState("");
  if (question.kind === "text") {
    return <Input autoFocus value={(answers[question.id] as string | null) ?? ""} placeholder={question.placeholder} maxLength={question.id === "business_name" ? 120 : 300}
      onChange={(e) => setAnswers({ ...answers, [question.id]: e.target.value || null })} onKeyDown={(e) => e.key === "Enter" && onEnter()} aria-label={question.prompt} />;
  }
  if (question.kind === "segment") {
    return (
      <div className="grid gap-2 sm:grid-cols-2">
        {templates.map((t) => (
          <button key={t.key} type="button" onClick={() => setAnswers({ ...answers, segment_key: t.key })} aria-pressed={answers.segment_key === t.key}
            className={`rounded-lg border p-3 text-left transition-colors ${answers.segment_key === t.key ? "border-primary bg-primary/10" : "hover:bg-accent"}`}>
            <span className="block font-medium">{t.name}</span>
            <span className="text-xs text-muted-foreground">{t.description}</span>
          </button>
        ))}
      </div>
    );
  }
  if (question.kind === "single") {
    return (
      <div className="flex flex-wrap gap-2">
        {question.options.map((o) => (
          <Button key={o.value} type="button" variant={answers.team_size === o.value ? "default" : "outline"}
            onClick={() => setAnswers({ ...answers, team_size: o.value as OnboardingAnswers["team_size"] })}>{o.label}</Button>
        ))}
      </div>
    );
  }
  const field = question.id as ListField;
  const values = answers[field];
  const options = [...new Set([...(question.useSegmentBilling ? billing : question.options), ...values])];
  const toggle = (v: string) => setAnswers({ ...answers, [field]: values.includes(v) ? values.filter((x) => x !== v) : [...values, v].slice(0, 30) });
  function onKey(e: KeyboardEvent<HTMLInputElement>) {
    if (e.key !== "Enter") return;
    e.preventDefault();
    const v = draft.trim().slice(0, 120);
    if (!v) return onEnter();
    if (!values.includes(v)) toggle(v);
    setDraft("");
  }
  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-2">
        {options.map((o) => (
          <Button key={o} type="button" size="sm" variant={values.includes(o) ? "default" : "outline"} onClick={() => toggle(o)} aria-pressed={values.includes(o)}>{o}</Button>
        ))}
      </div>
      <Input value={draft} onChange={(e) => setDraft(e.target.value)} onKeyDown={onKey} placeholder="Outro? Escreva e pressione Enter" aria-label="Adicionar resposta" />
    </div>
  );
}

type Decision = "accepted" | "rejected";

function Review({ answers, preset, onBack }: { answers: OnboardingAnswers; preset: Awaited<ReturnType<typeof getOnboarding>>["preset"]; onBack: () => void }) {
  const { org } = useOrg();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const rec = useServerFn(recommendOnboarding);
  const complete = useServerFn(completeOnboarding);
  const [useAi, setUseAi] = useState(true);
  const [data, setData] = useState<Recommendation | null>(null);
  const [aiError, setAiError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [decisions, setDecisions] = useState<Record<string, Decision>>({});
  const [interests, setInterests] = useState<Record<string, boolean>>({});
  const [timezone, setTimezone] = useState("America/Bahia");
  const [flows, setFlows] = useState<Recommendation["flows"]>([]);
  const [name, setName] = useState(answers.business_name ?? org.name);
  const [applyPreset, setApplyPreset] = useState(false);
  const [saving, setSaving] = useState(false);

  async function generate(ai: boolean) {
    setLoading(true);
    try {
      const r = await rec({ data: { organizationId: org.id, useAi: ai } });
      setData(r.recommendation);
      setAiError(r.aiError);
      setDecisions(Object.fromEntries(r.recommendation.modules.map((m) => [m.key, "accepted" as Decision])));
      setInterests(Object.fromEntries(r.recommendation.futureModules.map((m) => [m.key, true])));
      setTimezone(r.recommendation.settings.timezone);
      setFlows(r.recommendation.flows);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Não foi possível gerar recomendações.");
    } finally {
      setLoading(false);
    }
  }
  useEffect(() => { void generate(true); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const accepted = useMemo(() => Object.entries(decisions).filter(([, d]) => d === "accepted").map(([k]) => k), [decisions]);

  async function finish() {
    if (!data || !answers.segment_key) return;
    setSaving(true);
    try {
      await complete({ data: {
        organizationId: org.id, businessName: name, segment: answers.segment_key, modules: accepted,
        rejected: Object.entries(decisions).filter(([, d]) => d === "rejected").map(([k]) => k),
        interests: Object.entries(interests).filter(([, v]) => v).map(([k]) => k),
        timezone, flows: flows.filter((f) => f.steps.length > 0), applyPreset,
      } });
      await qc.invalidateQueries();
      toast.success("Ambiente configurado!");
      navigate({ to: "/app" });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Não foi possível concluir.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <section className="mx-auto max-w-3xl space-y-8">
      <header>
        <h1 className="text-3xl">Sugestões para o seu negócio</h1>
        <p className="mt-2 text-muted-foreground">Aceite, ajuste ou recuse cada item. Nada é ativado sem a sua confirmação.</p>
        <div className="mt-4 flex items-center gap-3">
          <Switch id="ai" checked={useAi} onCheckedChange={(v) => { setUseAi(v); void generate(v); }} disabled={loading} />
          <Label htmlFor="ai">Refinar com IA</Label>
          {loading && <span className="text-sm text-muted-foreground">Analisando suas respostas…</span>}
        </div>
        {aiError && <p className="mt-2 text-sm text-destructive">{aiError}</p>}
        {data?.aiSummary && <p className="mt-3 rounded-lg bg-secondary p-3 text-sm"><Badge variant="outline" className="mr-2">Sugestão da IA</Badge>{data.aiSummary}</p>}
      </header>

      {data && (
        <>
          {data.notices.map((n) => <p key={n} className="rounded-lg border border-destructive/40 p-3 text-sm">{n}</p>)}

          <div>
            <h2 className="text-xl">Módulos</h2>
            <p className="text-sm text-muted-foreground">Sempre incluídos: {data.coreModules.map((m) => m.name).join(", ")}.</p>
            <ul className="mt-3 space-y-2">
              {data.modules.map((m) => (
                <li key={m.key} className="flex flex-wrap items-center gap-3 rounded-lg border p-3">
                  <div className="min-w-0 flex-1">
                    <p className="font-medium">{m.name} <Badge variant="secondary" className="ml-1">{m.source === "ia" ? "IA" : m.source === "segmento" ? "Segmento" : "Suas respostas"}</Badge></p>
                    <p className="text-sm text-muted-foreground">{m.reason}</p>
                  </div>
                  <Button size="sm" variant={decisions[m.key] === "accepted" ? "default" : "outline"} onClick={() => setDecisions({ ...decisions, [m.key]: "accepted" })}>Aceitar</Button>
                  <Button size="sm" variant={decisions[m.key] === "rejected" ? "destructive" : "outline"} onClick={() => setDecisions({ ...decisions, [m.key]: "rejected" })}>Rejeitar</Button>
                </li>
              ))}
            </ul>
            <p className="mt-2 text-xs text-muted-foreground">Módulos necessários para os aceitos são ativados automaticamente.</p>
          </div>

          {data.futureModules.length > 0 && (
            <div>
              <h2 className="text-xl">Em breve</h2>
              <ul className="mt-3 space-y-2">
                {data.futureModules.map((m) => (
                  <li key={m.key} className="flex items-center gap-3 rounded-lg border border-dashed p-3">
                    <div className="flex-1"><p className="font-medium">{m.name}</p><p className="text-sm text-muted-foreground">{m.reason}</p></div>
                    <Switch checked={interests[m.key] ?? false} onCheckedChange={(v) => setInterests({ ...interests, [m.key]: v })} aria-label={`Tenho interesse em ${m.name}`} />
                  </li>
                ))}
              </ul>
            </div>
          )}

          <div>
            <h2 className="text-xl">Configurações</h2>
            <div className="mt-3 grid gap-4 sm:grid-cols-2">
              <div><Label htmlFor="bn">Nome do negócio</Label><Input id="bn" value={name} maxLength={120} onChange={(e) => setName(e.target.value)} /></div>
              <div><Label htmlFor="tz">Fuso horário</Label><Input id="tz" value={timezone} maxLength={60} onChange={(e) => setTimezone(e.target.value)} /></div>
              <p className="text-sm text-muted-foreground">Moeda: Real (BRL)</p>
              <p className="text-sm text-muted-foreground">Datas: dd/mm/aaaa</p>
            </div>
          </div>

          {flows.length > 0 && (
            <div>
              <h2 className="text-xl">Fluxos iniciais</h2>
              {flows.map((f, fi) => (
                <div key={f.key} className="mt-3 rounded-lg border p-3">
                  <div className="flex items-center gap-2">
                    <p className="flex-1 font-medium">{f.name}</p>
                    <Button size="sm" variant="ghost" onClick={() => setFlows(flows.filter((_, i) => i !== fi))}>Rejeitar fluxo</Button>
                  </div>
                  <div className="mt-2 flex flex-wrap items-center gap-2">
                    {f.steps.map((s, si) => (
                      <Input key={si} value={s} className="h-8 w-40" aria-label={`Etapa ${si + 1}`}
                        onChange={(e) => setFlows(flows.map((ff, i) => i === fi ? { ...ff, steps: ff.steps.map((x, j) => j === si ? e.target.value : x) } : ff))} />
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}

          {preset && (
            <div className="rounded-lg border p-4">
              <div className="flex items-center gap-3">
                <div className="flex-1">
                  <h2 className="text-xl">Configuração preparada para {preset.name}</h2>
                  <p className="text-sm text-muted-foreground">Pacotes e condições comerciais informados por você. Ficam editáveis e só nesta organização.</p>
                </div>
                <Switch checked={applyPreset} onCheckedChange={setApplyPreset} aria-label="Importar configuração preparada" />
              </div>
              <PresetSummary settings={preset.settings} />
            </div>
          )}

          <div className="flex gap-3">
            <Button variant="ghost" onClick={onBack}>Voltar às perguntas</Button>
            <Button className="ml-auto" disabled={saving || !name.trim() || !timezone.trim()} onClick={finish}>{saving ? "Salvando…" : "Concluir e ir para o painel"}</Button>
          </div>
        </>
      )}
    </section>
  );
}

export function PresetSummary({ settings }: { settings: Record<string, unknown> }) {
  const pkgs = (settings["service_packages"] as { name: string; hours: number; price_cents: number; plus_travel_fee?: boolean }[] | undefined) ?? [];
  const brl = (c: number) => (c / 100).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
  if (!pkgs.length) return null;
  return (
    <ul className="mt-3 grid gap-2 sm:grid-cols-3">
      {pkgs.map((p) => (
        <li key={p.name} className="rounded-md bg-secondary p-3 text-sm">
          <p className="font-medium">{p.name}</p>
          <p>{p.hours}h · {brl(p.price_cents)}{p.plus_travel_fee ? " + deslocamento" : ""}</p>
        </li>
      ))}
    </ul>
  );
}
