"use client";
import { useState, useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "@/lib/utils/toast";

const schema = z.object({
  name: z.string().min(1, "Name is required").max(50),
  avatar_emoji: z.string().max(4).optional(),
  persona: z.string().min(10, "Persona must be at least 10 characters").max(2000),
  tone: z.enum(["professional", "casual"]),
  emoji_usage: z.boolean(),
  language: z.string(),
  expertise_areas: z.array(z.string()).max(10),
});

type FormData = z.infer<typeof schema>;

interface AgentProfileEditorProps {
  agentId: string;
  workspaceId: string;
  onSave?: () => void;
  onCancel?: () => void;
}

export default function AgentProfileEditor({ agentId, workspaceId, onSave, onCancel }: AgentProfileEditorProps) {
  const queryClient = useQueryClient();
  const [newExpertise, setNewExpertise] = useState("");

  const { data: agent, isLoading } = useQuery({
    queryKey: ["agent", agentId, workspaceId],
    queryFn: () => fetch(`/api/v1/agents/${agentId}?workspace_id=${workspaceId}`).then(r => r.json()),
  });

  const { register, handleSubmit, watch, setValue, reset, formState: { errors } } = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: {
      name: "",
      avatar_emoji: "",
      persona: "",
      tone: "professional",
      emoji_usage: false,
      language: "vi",
      expertise_areas: [],
    },
  });

  useEffect(() => {
    if (agent) {
      reset({
        name: agent.name || "",
        avatar_emoji: agent.avatar_emoji || "",
        persona: agent.config?.persona || agent.about || "",
        tone: agent.config?.styleGuide?.tone || "professional",
        emoji_usage: agent.config?.styleGuide?.emojiUsage ?? false,
        language: agent.config?.styleGuide?.language || "vi",
        expertise_areas: agent.skills || [],
      });
    }
  }, [agent, reset]);

  const mutation = useMutation({
    mutationFn: (data: FormData) =>
      fetch(`/api/v1/agents/${agentId}?workspace_id=${workspaceId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: data.name,
          avatar_emoji: data.avatar_emoji,
          about: data.persona,
          skills: data.expertise_areas,
          config: {
            ...agent?.config,
            persona: data.persona,
            styleGuide: { tone: data.tone, emojiUsage: data.emoji_usage, language: data.language },
          },
        }),
      }).then(r => r.json()),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["agent", agentId] });
      toast.success("Agent profile updated!");
      onSave?.();
    },
    onError: () => toast.error("Failed to update agent"),
  });

  const expertiseAreas = watch("expertise_areas") || [];
  const personaLength = watch("persona")?.length || 0;

  const addExpertise = () => {
    const val = newExpertise.trim();
    if (val && expertiseAreas.length < 10 && !expertiseAreas.includes(val)) {
      setValue("expertise_areas", [...expertiseAreas, val]);
      setNewExpertise("");
    }
  };

  const removeExpertise = (idx: number) => {
    setValue("expertise_areas", expertiseAreas.filter((_, i) => i !== idx));
  };

  if (isLoading) {
    return (
      <div className="bg-[var(--card)] rounded-2xl p-6 animate-pulse">
        <div className="h-6 bg-[var(--border)] rounded w-48 mb-6" />
        <div className="space-y-4">
          {[1, 2, 3].map(i => <div key={i} className="h-10 bg-[var(--border)] rounded" />)}
        </div>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit((d) => mutation.mutate(d))} className="bg-[var(--card)] rounded-2xl border border-[var(--border)]">
      <div className="p-6 border-b border-[var(--border)]">
        <h2 className="text-lg font-bold">Edit Agent: {agent?.name || agentId}</h2>
        <p className="text-sm text-[var(--text-dim)] mt-1">Customize agent persona and behavior</p>
      </div>

      <div className="p-6 space-y-6">
        {/* Name + Emoji */}
        <div className="grid grid-cols-1 md:grid-cols-[1fr_120px] gap-4">
          <div>
            <label className="block text-sm font-medium mb-1.5">Name</label>
            <input {...register("name")} className="w-full bg-[var(--surface)] border border-[var(--border)] rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-[var(--accent)]" placeholder="Minh 📋" />
            {errors.name && <p className="text-xs text-[var(--red)] mt-1">{errors.name.message}</p>}
          </div>
          <div>
            <label className="block text-sm font-medium mb-1.5">Emoji</label>
            <input {...register("avatar_emoji")} className="w-full bg-[var(--surface)] border border-[var(--border)] rounded-xl px-4 py-2.5 text-sm text-center text-2xl focus:outline-none focus:border-[var(--accent)]" placeholder="📋" maxLength={4} />
          </div>
        </div>

        {/* Persona */}
        <div>
          <label className="block text-sm font-medium mb-1.5">Persona (System Prompt)</label>
          <textarea {...register("persona")} rows={8} className="w-full bg-[var(--surface)] border border-[var(--border)] rounded-xl px-4 py-3 text-sm font-mono focus:outline-none focus:border-[var(--accent)] resize-y" placeholder="You are Minh, a marketing copywriter who..." />
          <div className="flex justify-between mt-1">
            {errors.persona && <p className="text-xs text-[var(--red)]">{errors.persona.message}</p>}
            <p className="text-xs text-[var(--text-dim)] ml-auto">{personaLength} / 2000</p>
          </div>
        </div>

        {/* Style Guide */}
        <div className="space-y-4">
          <label className="block text-sm font-medium">Style Guide</label>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="block text-xs text-[var(--text-dim)] mb-1.5">Tone</label>
              <select {...register("tone")} className="w-full bg-[var(--surface)] border border-[var(--border)] rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-[var(--accent)]">
                <option value="professional">Professional</option>
                <option value="casual">Casual</option>
              </select>
            </div>
            <div>
              <label className="block text-xs text-[var(--text-dim)] mb-1.5">Language</label>
              <select {...register("language")} className="w-full bg-[var(--surface)] border border-[var(--border)] rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-[var(--accent)]">
                <option value="vi">Vietnamese</option>
                <option value="en">English</option>
                <option value="zh">Chinese</option>
              </select>
            </div>
            <div className="flex items-end">
              <label className="flex items-center gap-2 cursor-pointer">
                <input type="checkbox" {...register("emoji_usage")} className="w-4 h-4 rounded accent-[var(--accent)]" />
                <span className="text-sm">Enable emoji usage</span>
              </label>
            </div>
          </div>
        </div>

        {/* Expertise Areas */}
        <div>
          <label className="block text-sm font-medium mb-1.5">Expertise Areas</label>
          <div className="flex flex-wrap gap-2 mb-2">
            {expertiseAreas.map((area, i) => (
              <span key={i} className="inline-flex items-center gap-1 px-3 py-1 bg-[var(--surface)] border border-[var(--border)] rounded-full text-sm">
                {area}
                <button type="button" onClick={() => removeExpertise(i)} className="text-[var(--text-dim)] hover:text-[var(--red)] ml-1">&times;</button>
              </span>
            ))}
          </div>
          <div className="flex gap-2">
            <input
              value={newExpertise}
              onChange={(e) => setNewExpertise(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); addExpertise(); } }}
              className="flex-1 bg-[var(--surface)] border border-[var(--border)] rounded-xl px-4 py-2 text-sm focus:outline-none focus:border-[var(--accent)]"
              placeholder="Add expertise area..."
            />
            <button type="button" onClick={addExpertise} className="px-4 py-2 bg-[var(--surface)] border border-[var(--border)] rounded-xl text-sm hover:bg-[var(--card-hover)] transition">Add</button>
          </div>
          {expertiseAreas.length >= 10 && <p className="text-xs text-[var(--text-dim)] mt-1">Maximum 10 areas</p>}
        </div>

        {/* Preview */}
        <div>
          <label className="block text-sm font-medium mb-1.5">Preview</label>
          <div className="bg-[var(--surface)] border border-[var(--border)] rounded-xl p-4">
            <div className="flex items-center gap-3 mb-3">
              <span className="text-2xl">{watch("avatar_emoji") || "🤖"}</span>
              <div>
                <div className="font-medium">{watch("name") || "Agent"}</div>
                <div className="text-xs text-[var(--text-dim)]">{watch("tone")} · {watch("language")}</div>
              </div>
            </div>
            <p className="text-sm text-[var(--text-dim)] italic line-clamp-3">{watch("persona") || "No persona defined yet..."}</p>
            {expertiseAreas.length > 0 && (
              <div className="flex flex-wrap gap-1 mt-3">
                {expertiseAreas.map((a, i) => (
                  <span key={i} className="text-xs px-2 py-0.5 bg-[var(--card)] rounded-full text-[var(--accent)]">{a}</span>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="p-6 border-t border-[var(--border)] flex justify-end gap-3">
        {onCancel && (
          <button type="button" onClick={onCancel} className="px-5 py-2.5 rounded-xl border border-[var(--border)] text-sm hover:bg-[var(--card-hover)] transition">Cancel</button>
        )}
        <button type="submit" disabled={mutation.isPending} className="px-5 py-2.5 rounded-xl bg-[var(--accent)] text-black font-semibold text-sm hover:brightness-110 transition disabled:opacity-50 flex items-center gap-2">
          {mutation.isPending && <span className="inline-block w-4 h-4 border-2 border-black/30 border-t-black rounded-full animate-spin" />}
          Save
        </button>
      </div>
    </form>
  );
}
