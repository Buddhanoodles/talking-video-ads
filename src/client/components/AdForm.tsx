import { useState } from "react";
import { ChoiceSelect } from "@/client/components/ChoiceSelect";
import { Button } from "@/client/components/ui/button";
import { Input } from "@/client/components/ui/input";
import { Label } from "@/client/components/ui/label";
import { Textarea } from "@/client/components/ui/textarea";
import {
  ToggleGroup,
  ToggleGroupItem,
} from "@/client/components/ui/toggle-group";
import { ASPECT_RATIOS, LANGUAGES, SCRIPT_MAX, VOICES } from "@/shared/options";

export interface AdValues {
  title: string;
  script: string;
  actorId: string;
  voice: string;
  direction: string;
  scriptLanguage: (typeof LANGUAGES)[number];
  language: (typeof LANGUAGES)[number];
  aspectRatio: (typeof ASPECT_RATIOS)[number];
}

export const EMPTY_AD: AdValues = {
  title: "",
  script: "",
  actorId: "",
  voice: VOICES[0].id,
  direction: "",
  scriptLanguage: "English",
  language: "English",
  aspectRatio: "9:16",
};

const LANGUAGE_ITEMS = LANGUAGES.map((l) => ({ value: l, label: l }));
const VOICE_ITEMS = VOICES.map((v) => ({ value: v.id, label: v.label }));

/** Fields shared by single ads and batches: voice, delivery, languages, ratio. */
export function DeliveryFields({
  values,
  set,
  withLanguage,
}: {
  values: Pick<
    AdValues,
    "voice" | "direction" | "scriptLanguage" | "aspectRatio" | "language"
  >;
  set: (patch: Partial<AdValues>) => void;
  withLanguage: boolean;
}) {
  return (
    <>
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="ad-voice">Voice</Label>
          <ChoiceSelect
            id="ad-voice"
            testId="ad-voice"
            value={values.voice}
            onChange={(voice) => set({ voice })}
            items={VOICE_ITEMS}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="ad-direction">Delivery</Label>
          <Input
            id="ad-direction"
            placeholder="e.g. excited, talking to a friend"
            maxLength={300}
            value={values.direction}
            onChange={(e) => set({ direction: e.target.value })}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="ad-script-language">Script written in</Label>
          <ChoiceSelect
            id="ad-script-language"
            testId="ad-script-language"
            value={values.scriptLanguage}
            onChange={(v) => set({ scriptLanguage: v as AdValues["language"] })}
            items={LANGUAGE_ITEMS}
          />
        </div>
        {withLanguage ? (
          <div className="space-y-2">
            <Label htmlFor="ad-language">Spoken in</Label>
            <ChoiceSelect
              id="ad-language"
              testId="ad-language"
              value={values.language}
              onChange={(v) => set({ language: v as AdValues["language"] })}
              items={LANGUAGE_ITEMS}
            />
          </div>
        ) : null}
      </div>
      <div className="space-y-2">
        <Label>Aspect ratio</Label>
        <ToggleGroup
          data-testid="ad-ratio"
          variant="outline"
          value={[values.aspectRatio]}
          onValueChange={(next) => {
            if (next[0])
              set({ aspectRatio: next[0] as AdValues["aspectRatio"] });
          }}
        >
          {ASPECT_RATIOS.map((ratio) => (
            <ToggleGroupItem key={ratio} value={ratio}>
              {ratio}
            </ToggleGroupItem>
          ))}
        </ToggleGroup>
      </div>
    </>
  );
}

export function AdForm({
  initial,
  actors,
  ready,
  onSubmit,
}: {
  initial: AdValues;
  actors: { id: string; name: string }[];
  ready: boolean;
  onSubmit: (values: AdValues, generate: boolean) => Promise<void>;
}) {
  const [values, setValues] = useState(initial);
  const [pending, setPending] = useState<"draft" | "generate" | null>(null);
  const [error, setError] = useState<string | null>(null);
  const set = (patch: Partial<AdValues>) =>
    setValues((v) => ({ ...v, ...patch }));

  async function submit(generate: boolean) {
    setError(null);
    if (!values.title.trim()) return setError("Give the ad a title.");
    if (!values.script.trim()) return setError("Write a script.");
    if (!values.actorId) return setError("Choose an actor.");
    setPending(generate ? "generate" : "draft");
    try {
      await onSubmit(values, generate);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "That didn't work.");
    } finally {
      setPending(null);
    }
  }

  return (
    <form
      className="space-y-6"
      onSubmit={(e) => {
        e.preventDefault();
        void submit(true);
      }}
    >
      <div className="space-y-2">
        <Label htmlFor="ad-title">Title</Label>
        <Input
          id="ad-title"
          maxLength={120}
          value={values.title}
          onChange={(e) => set({ title: e.target.value })}
        />
      </div>
      <div className="space-y-2">
        <div className="flex items-baseline justify-between">
          <Label htmlFor="ad-script">Script</Label>
          <span className="text-xs text-muted-foreground tabular-nums">
            {values.script.length}/{SCRIPT_MAX}
          </span>
        </div>
        <Textarea
          id="ad-script"
          rows={6}
          maxLength={SCRIPT_MAX}
          value={values.script}
          onChange={(e) => set({ script: e.target.value })}
        />
      </div>
      <div className="space-y-2">
        <Label htmlFor="ad-actor">Actor</Label>
        <ChoiceSelect
          id="ad-actor"
          testId="ad-actor"
          value={values.actorId || null}
          onChange={(actorId) => set({ actorId })}
          items={actors.map((a) => ({ value: a.id, label: a.name }))}
          placeholder={actors.length ? "Choose an actor" : "Add an actor first"}
        />
      </div>
      <DeliveryFields values={values} set={set} withLanguage />
      {error ? (
        <p role="alert" className="text-sm text-destructive">
          {error}
        </p>
      ) : null}
      <div className="flex flex-wrap justify-end gap-2">
        <Button
          type="button"
          variant="outline"
          data-testid="ad-save-draft"
          disabled={pending !== null}
          onClick={() => void submit(false)}
        >
          Save draft
        </Button>
        <Button
          type="submit"
          data-testid="ad-generate"
          disabled={!ready || pending !== null}
        >
          {pending === "generate" ? "Starting…" : "Generate video"}
        </Button>
      </div>
    </form>
  );
}
