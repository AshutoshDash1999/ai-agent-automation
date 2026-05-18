"use client";

import { useEffect, useState } from "react";
import { AppSidebar } from "@/components/app-sidebar";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { AuthGuard } from "@/components/auth/auth-guard";
import { useTheme } from "next-themes";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
import { motion } from "framer-motion";
import { Switch } from "@/components/ui/switch";
import { useAssistantContext } from "@/context/assistant-context";
import { useToast } from "@/hooks/use-toast";
import { ChevronRightIcon } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuRadioGroup,
  DropdownMenuSeparator,
  DropdownMenuLabel,
  DropdownMenuContent,
  DropdownMenuRadioItem,
} from "@/components/ui/dropdown-menu";
import { apiUrl } from "@/lib/api";

/* -------------------------
   Types
------------------------- */
type WorkerSettings = {
  pollIntervalMs: number;
  maxAttempts: number;
};

type UiTheme = "light" | "dark" | "system" | "midnight" | "solarized";

type AssistantProvider =
  | "ollama"
  | "groq"
  | "openai"
  | "gemini"
  | "huggingface";

type AssistantSettings = {
  enabled: boolean;
  provider: AssistantProvider | null;
  model: string | null;
};

type DocumentChatSettings = {
  enabled: boolean;
  provider: AssistantProvider | null;
  model: string | null;
  topK: number;
  temperature: number;
};

type TelemetryMetrics = {
  taskRuns: number;
  workflowExecutions: number;
  totalStepExecutions: number;
  totalTaskDurationMs: number;
  stepTypeCounts: Record<string, number>;
};

type TelemetryState = {
  enabled: boolean;
  instanceId: string;
  lastHeartbeatAt: string | null;
  lastHeartbeatVersion: string | null;
  endpointConfigured: boolean;
  outboundDisabled: boolean;
  localMetrics: TelemetryMetrics;
};

type SystemSettings = {
  worker: WorkerSettings;
  ui: {
    theme: UiTheme;
  };
  assistant: AssistantSettings;
  documentChat: DocumentChatSettings;
};

const PROVIDER_LABELS: Record<AssistantProvider, string> = {
  ollama: "Ollama (Local)",
  groq: "Groq",
  openai: "OpenAI",
  gemini: "Gemini",
  huggingface: "Hugging Face",
};

const DEFAULT_TELEMETRY: TelemetryState = {
  enabled: false,
  instanceId: "",
  lastHeartbeatAt: null,
  lastHeartbeatVersion: null,
  endpointConfigured: false,
  outboundDisabled: false,
  localMetrics: {
    taskRuns: 0,
    workflowExecutions: 0,
    totalStepExecutions: 0,
    totalTaskDurationMs: 0,
    stepTypeCounts: {},
  },
};

const DEFAULT_SETTINGS: SystemSettings = {
  worker: {
    pollIntervalMs: 2000,
    maxAttempts: 3,
  },
  ui: {
    theme: "dark",
  },
  assistant: {
    enabled: false,
    provider: null,
    model: null,
  },
  documentChat: {
    enabled: true,
    provider: "ollama",
    model: null,
    topK: 3,
    temperature: 0.2,
  },
};

/* -------------------------
   Theme transition helper
------------------------- */
function applyThemeWithTransition(
  setTheme: (theme: string) => void,
  theme: UiTheme,
) {
  const root = document.documentElement;

  root.classList.add("theme-transition");
  root.getBoundingClientRect(); // force reflow

  setTheme(theme);

  setTimeout(() => {
    root.classList.remove("theme-transition");
  }, 300);
}

/* -------------------------
   Theme option
------------------------- */
function ThemeOption({ value, label }: { value: UiTheme; label: string }) {
  return (
    <div className="flex items-center gap-3">
      <RadioGroupItem value={value} id={value} />
      <Label htmlFor={value}>{label}</Label>
    </div>
  );
}

/* -------------------------
   Page
------------------------- */
export default function SettingsPage() {
  const [settings, setSettings] = useState<SystemSettings>(DEFAULT_SETTINGS);
  const [loading, setLoading] = useState(true);
  const [savingWorker, setSavingWorker] = useState(false);
  const { theme, setTheme } = useTheme();
  const { addToast } = useToast();
  const { setMode } = useAssistantContext();

  const [availableProviders, setAvailableProviders] = useState<{
    ollama?: boolean;
    groq?: boolean;
    openai?: boolean;
    gemini?: boolean;
    huggingface?: boolean;
  }>({});

  const [telemetry, setTelemetry] = useState<TelemetryState>(DEFAULT_TELEMETRY);

  /* -------------------------
     Env status
  ------------------------- */
  const [env, setEnv] = useState<{
    groq: boolean;
    ollama: boolean;
    openai: boolean;
    gemini: boolean;
    hf: boolean;
  } | null>(null);

  /* -------------------------
     Load settings
  ------------------------- */
  async function loadSettings() {
    try {
      const res = await fetch(apiUrl("/settings"), {
        headers: {
          Authorization: "Bearer " + localStorage.getItem("token"),
        },
      });

      const data = await res.json();

      if (data.ok && data.settings) {
        // 🔥 Set available providers from backend
        setAvailableProviders(data.availableProviders || {});

        const merged: SystemSettings = {
          ...DEFAULT_SETTINGS,
          ...data.settings,
          worker: {
            ...DEFAULT_SETTINGS.worker,
            ...data.settings.worker,
          },
          ui: {
            ...DEFAULT_SETTINGS.ui,
            ...data.settings.ui,
          },
          assistant: {
            ...DEFAULT_SETTINGS.assistant,
            ...data.settings.assistant,
          },
        };

        setSettings(merged);
        setTheme(merged.ui.theme);
      }
    } catch (err) {
      console.error("Failed to load settings", err);
    } finally {
      setLoading(false);
    }
  }

  async function loadEnv() {
    const res = await fetch(apiUrl("/system/env"), {
      headers: {
        Authorization: "Bearer " + localStorage.getItem("token"),
      },
    });

    const data = await res.json();
    if (data.ok) setEnv(data.env);
  }

  async function loadTelemetry() {
    try {
      const res = await fetch(apiUrl("/telemetry"), {
        headers: {
          Authorization: "Bearer " + localStorage.getItem("token"),
        },
      });
      const data = await res.json();
      if (data.ok && data.telemetry) {
        setTelemetry(data.telemetry);
      }
    } catch (err) {
      console.error("Failed to load telemetry", err);
    }
  }

  async function saveTelemetryEnabled(enabled: boolean) {
    try {
      const res = await fetch(apiUrl("/telemetry"), {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          Authorization: "Bearer " + localStorage.getItem("token"),
        },
        body: JSON.stringify({ enabled }),
      });
      const data = await res.json();
      if (data.ok && data.telemetry) {
        setTelemetry(data.telemetry);
        addToast({
          type: "success",
          title: "Telemetry Updated",
          description: `Anonymous telemetry has been ${
            enabled ? "enabled" : "disabled"
          }.`,
        });
      }
    } catch (err) {
      console.error("Failed to save telemetry", err);
      addToast({
        type: "error",
        title: "Telemetry Save Failed",
        description: "Could not update telemetry preferences.",
      });
    }
  }

  useEffect(() => {
    if (settings.assistant?.enabled) {
      setMode("online");
    } else {
      setMode("offline");
    }
  }, [settings.assistant?.enabled]);

  /* -------------------------
     Save worker settings
  ------------------------- */
  async function saveWorkerSettings() {
    try {
      setSavingWorker(true);

      await fetch(apiUrl("/settings"), {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          Authorization: "Bearer " + localStorage.getItem("token"),
        },
        body: JSON.stringify({
          worker: settings.worker,
        }),
      });
      addToast({
        type: "success",
        title: "Worker Settings Saved",
        description: "Your Worker Settings were updated successfully",
      });
    } finally {
      setSavingWorker(false);
    }
  }

  /* -------------------------
     Change theme
  ------------------------- */
  async function changeTheme(value: UiTheme) {
    applyThemeWithTransition(setTheme, value);

    setSettings((prev) => ({
      ...prev,
      ui: { theme: value },
    }));

    await fetch(apiUrl("/settings"), {
      method: "PUT",
      headers: {
        "Content-Type": "application/json",
        Authorization: "Bearer " + localStorage.getItem("token"),
      },
      body: JSON.stringify({
        ui: { theme: value },
      }),
    });
    addToast({
      type: "success",
      title: "Theme Changed",
      description: `Theme changed to ${value}`,
    });
  }

  useEffect(() => {
    loadSettings();
    loadEnv();
    loadTelemetry();
  }, []);

  if (loading) return <p className="p-8">Loading…</p>;

  return (
    <AuthGuard>
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3 }}
      >
        <div className="flex min-h-screen">
          <AppSidebar />
          <main
            className="flex-1 transition-[padding] duration-300"
            style={{ paddingLeft: "var(--sidebar-width, 256px)" }}
          >
            <div className="p-8">
              <h1 className="text-3xl font-bold mb-2">Settings</h1>
              <p className="mb-8 text-muted-foreground">
                Manage your system preferences
              </p>

              <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3 items-start">
                {/* Worker */}
                <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
                  <Card className="p-6 flex flex-col">
                    <div className="space-y-4 flex-1">
                      <h2 className="text-lg font-semibold">Worker</h2>

                      <div>
                        <Label>Poll Interval (ms)</Label>
                        <Input
                          type="number"
                          value={settings.worker.pollIntervalMs}
                          onChange={(e) =>
                            setSettings({
                              ...settings,
                              worker: {
                                ...settings.worker,
                                pollIntervalMs: Number(e.target.value),
                              },
                            })
                          }
                        />
                      </div>

                      <div>
                        <Label>Max Attempts</Label>
                        <Input
                          type="number"
                          value={settings.worker.maxAttempts}
                          onChange={(e) =>
                            setSettings({
                              ...settings,
                              worker: {
                                ...settings.worker,
                                maxAttempts: Number(e.target.value),
                              },
                            })
                          }
                        />
                      </div>
                    </div>

                    <Button
                      onClick={saveWorkerSettings}
                      disabled={savingWorker}
                      className="w-full md:w-auto"
                    >
                      {savingWorker ? "Saving…" : "Save"}
                    </Button>
                  </Card>
                </motion.div>

                {/* Environment */}
                <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
                  <Card className="p-6 space-y-4">
                    <h2 className="text-lg font-semibold">Environment</h2>
                    <p className="text-sm text-muted-foreground">
                      Secrets are managed via environment variables.
                    </p>

                    {env && (
                      <div className="space-y-1 text-sm">
                        <div>Groq API: {env.groq ? "✅" : "❌"}</div>
                        <div>Ollama API: {env.ollama ? "✅" : "❌"}</div>
                        <div>OpenAI API: {env.openai ? "✅" : "❌"}</div>
                        <div>Gemini API: {env.gemini ? "✅" : "❌"}</div>
                        <div>HF API: {env.hf ? "✅" : "❌"}</div>
                      </div>
                    )}
                  </Card>
                </motion.div>

                {/* Appearance */}
                <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
                  <Card className="p-6">
                    <h2 className="mb-4 text-lg font-semibold">Appearance</h2>

                    <RadioGroup
                      value={theme}
                      onValueChange={changeTheme}
                      className="space-y-3"
                    >
                      <ThemeOption value="light" label="Light" />
                      <ThemeOption value="dark" label="Dark" />
                      <ThemeOption value="midnight" label="Midnight" />
                      <ThemeOption value="solarized" label="Solarized" />
                      <ThemeOption value="system" label="System" />
                    </RadioGroup>
                  </Card>
                </motion.div>
                {/* AI Assistance */}
                <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
                  <Card className="p-6 space-y-4">
                    <h2 className="text-lg font-semibold">AI Assistance</h2>

                    <p className="text-sm text-muted-foreground">
                      Select which LLM provider should power in-app assistant.
                    </p>

                    {/* Enable Switch */}
                    <div className="flex items-center justify-between">
                      <div>
                        <div className="font-medium">Enable AI Assistant</div>
                        <div className="text-xs text-muted-foreground">
                          Must select provider below
                        </div>
                      </div>

                      <Switch
                        checked={!!settings.assistant?.enabled}
                        disabled={!settings.assistant?.provider}
                        onCheckedChange={async (checked) => {
                          const updated = {
                            ...settings,
                            assistant: {
                              ...settings.assistant,
                              enabled: checked,
                            },
                          };

                          setSettings(updated);

                          await fetch(apiUrl("/settings"), {
                            method: "PUT",
                            headers: {
                              "Content-Type": "application/json",
                              Authorization:
                                "Bearer " + localStorage.getItem("token"),
                            },
                            body: JSON.stringify({
                              assistant: updated.assistant,
                            }),
                          });
                        }}
                      />
                    </div>

                    {/* Provider Select */}
                    <div>
                      <Label className="mb-2 block">Provider</Label>

                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <button className="w-full border rounded-md px-3 py-2 bg-background text-left flex items-center justify-between">
                            <span>
                              {settings.assistant?.provider
                                ? PROVIDER_LABELS[
                                    settings.assistant
                                      .provider as AssistantProvider
                                  ]
                                : "Select Provider"}
                            </span>
                            <ChevronRightIcon className="rotate-90 size-4 opacity-60" />
                          </button>
                        </DropdownMenuTrigger>

                        <DropdownMenuContent className="w-56">
                          <DropdownMenuLabel>Select Provider</DropdownMenuLabel>
                          <DropdownMenuSeparator />

                          <DropdownMenuRadioGroup
                            value={settings.assistant?.provider ?? ""}
                            onValueChange={async (value) => {
                              const provider: AssistantProvider | null =
                                value === ""
                                  ? null
                                  : (value as AssistantProvider);

                              const updated = {
                                ...settings,
                                assistant: {
                                  ...settings.assistant,
                                  provider,
                                },
                              };

                              setSettings(updated);

                              await fetch(apiUrl("/settings"), {
                                method: "PUT",
                                headers: {
                                  "Content-Type": "application/json",
                                  Authorization:
                                    "Bearer " + localStorage.getItem("token"),
                                },
                                body: JSON.stringify({
                                  assistant: updated.assistant,
                                }),
                              });
                            }}
                          >
                            {Object.entries(availableProviders).map(
                              ([key, available]) =>
                                available && (
                                  <DropdownMenuRadioItem key={key} value={key}>
                                    {PROVIDER_LABELS[key as AssistantProvider]}
                                  </DropdownMenuRadioItem>
                                ),
                            )}
                          </DropdownMenuRadioGroup>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>

                    {/* Model Input */}
                    <div>
                      <Label className="mb-2 block">
                        Model (Optional Override)
                      </Label>
                      <Input
                        placeholder="Leave empty for default"
                        value={settings.assistant?.model ?? ""}
                        onChange={(e) =>
                          setSettings((prev) => ({
                            ...prev,
                            assistant: {
                              ...prev.assistant,
                              model: e.target.value || null,
                            },
                          }))
                        }
                        onBlur={async () => {
                          await fetch(apiUrl("/settings"), {
                            method: "PUT",
                            headers: {
                              "Content-Type": "application/json",
                              Authorization:
                                "Bearer " + localStorage.getItem("token"),
                            },
                            body: JSON.stringify({
                              assistant: settings.assistant,
                            }),
                          });
                        }}
                      />
                    </div>
                  </Card>
                </motion.div>
                {/* Document Chat */}
                <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
                  <Card className="p-6 space-y-4">
                    <h2 className="text-lg font-semibold">Document Chat</h2>

                    <p className="text-sm text-muted-foreground">
                      Configure AI used for document question answering.
                    </p>

                    {/* Enable Switch */}
                    <div className="flex items-center justify-between">
                      <div>
                        <div className="font-medium">Enable Document Chat</div>
                        <div className="text-xs text-muted-foreground">
                          Must select provider below
                        </div>
                      </div>

                      <Switch
                        checked={!!settings.documentChat?.enabled}
                        disabled={!settings.documentChat?.provider}
                        onCheckedChange={async (checked) => {
                          const updated = {
                            ...settings,
                            documentChat: {
                              ...settings.documentChat,
                              enabled: checked,
                            },
                          };

                          setSettings(updated);

                          await fetch(apiUrl("/settings"), {
                            method: "PUT",
                            headers: {
                              "Content-Type": "application/json",
                              Authorization:
                                "Bearer " + localStorage.getItem("token"),
                            },
                            body: JSON.stringify({
                              documentChat: updated.documentChat,
                            }),
                          });
                        }}
                      />
                    </div>

                    {/* Provider Select */}
                    <div>
                      <Label className="mb-2 block">Provider</Label>

                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <button className="w-full border rounded-md px-3 py-2 bg-background text-left flex items-center justify-between">
                            <span>
                              {settings.documentChat?.provider
                                ? PROVIDER_LABELS[
                                    settings.documentChat
                                      .provider as AssistantProvider
                                  ]
                                : "Select Provider"}
                            </span>

                            <ChevronRightIcon className="rotate-90 size-4 opacity-60" />
                          </button>
                        </DropdownMenuTrigger>

                        <DropdownMenuContent className="w-56">
                          <DropdownMenuLabel>Select Provider</DropdownMenuLabel>
                          <DropdownMenuSeparator />

                          <DropdownMenuRadioGroup
                            value={settings.documentChat?.provider ?? ""}
                            onValueChange={async (value) => {
                              const provider: AssistantProvider | null =
                                value === ""
                                  ? null
                                  : (value as AssistantProvider);

                              const updated = {
                                ...settings,
                                documentChat: {
                                  ...settings.documentChat,
                                  provider,
                                },
                              };

                              setSettings(updated);

                              await fetch(apiUrl("/settings"), {
                                method: "PUT",
                                headers: {
                                  "Content-Type": "application/json",
                                  Authorization:
                                    "Bearer " + localStorage.getItem("token"),
                                },
                                body: JSON.stringify({
                                  documentChat: updated.documentChat,
                                }),
                              });
                            }}
                          >
                            {Object.entries(availableProviders).map(
                              ([key, available]) =>
                                available && (
                                  <DropdownMenuRadioItem key={key} value={key}>
                                    {PROVIDER_LABELS[key as AssistantProvider]}
                                  </DropdownMenuRadioItem>
                                ),
                            )}
                          </DropdownMenuRadioGroup>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>

                    {/* Model Input */}
                    <div>
                      <Label className="mb-2 block">
                        Model (Optional Override)
                      </Label>

                      <Input
                        placeholder="Leave empty for default"
                        value={settings.documentChat?.model ?? ""}
                        onChange={(e) =>
                          setSettings((prev) => ({
                            ...prev,
                            documentChat: {
                              ...prev.documentChat,
                              model: e.target.value || null,
                            },
                          }))
                        }
                        onBlur={async () => {
                          await fetch(apiUrl("/settings"), {
                            method: "PUT",
                            headers: {
                              "Content-Type": "application/json",
                              Authorization:
                                "Bearer " + localStorage.getItem("token"),
                            },
                            body: JSON.stringify({
                              documentChat: settings.documentChat,
                            }),
                          });
                        }}
                      />
                    </div>

                    {/* Top-K */}
                    <div>
                      <Label>Top-K Retrieval</Label>

                      <Input
                        type="number"
                        value={settings.documentChat.topK}
                        onChange={(e) =>
                          setSettings({
                            ...settings,
                            documentChat: {
                              ...settings.documentChat,
                              topK: Number(e.target.value),
                            },
                          })
                        }
                        onBlur={async () => {
                          await fetch(apiUrl("/settings"), {
                            method: "PUT",
                            headers: {
                              "Content-Type": "application/json",
                              Authorization:
                                "Bearer " + localStorage.getItem("token"),
                            },
                            body: JSON.stringify({
                              documentChat: settings.documentChat,
                            }),
                          });
                        }}
                      />
                    </div>

                    {/* Temperature */}
                    <div>
                      <Label>Temperature</Label>

                      <Input
                        type="number"
                        step="0.1"
                        value={settings.documentChat.temperature}
                        onChange={(e) =>
                          setSettings({
                            ...settings,
                            documentChat: {
                              ...settings.documentChat,
                              temperature: Number(e.target.value),
                            },
                          })
                        }
                        onBlur={async () => {
                          await fetch(apiUrl("/settings"), {
                            method: "PUT",
                            headers: {
                              "Content-Type": "application/json",
                              Authorization:
                                "Bearer " + localStorage.getItem("token"),
                            },
                            body: JSON.stringify({
                              documentChat: settings.documentChat,
                            }),
                          });
                        }}
                      />
                    </div>
                  </Card>
                </motion.div>

                {/* Telemetry */}
                <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
                  <Card className="p-6 space-y-4">
                    <h2 className="text-lg font-semibold">Telemetry</h2>

                    <p className="text-sm text-muted-foreground">
                      Optional anonymous telemetry is local-first and opt-in. No
                      prompts, documents, or user data are collected.
                    </p>

                    <div className="flex items-center justify-between">
                      <div>
                        <div className="font-medium">
                          Enable anonymous telemetry
                        </div>
                        <div className="text-xs text-muted-foreground">
                          Use a random instance ID and minimal system metadata.
                        </div>
                      </div>
                      <Switch
                        checked={telemetry.enabled}
                        onCheckedChange={saveTelemetryEnabled}
                      />
                    </div>

                    <div className="space-y-2 text-sm">
                      <div>
                        Instance ID:{" "}
                        <span className="font-mono">
                          {telemetry.instanceId || "not generated yet"}
                        </span>
                      </div>
                      <div>
                        Heartbeat:{" "}
                        {telemetry.lastHeartbeatAt
                          ? new Date(telemetry.lastHeartbeatAt).toLocaleString()
                          : "not sent yet"}
                      </div>
                      <div>
                        Endpoint configured:{" "}
                        {telemetry.endpointConfigured ? "Yes" : "No"}
                      </div>
                      <div>
                        <div>
                          Workflow executions:{" "}
                          {telemetry.localMetrics.workflowExecutions}
                        </div>
                        <div>
                          Average task duration:{" "}
                          {telemetry.localMetrics.taskRuns > 0
                            ? Math.round(
                                telemetry.localMetrics.totalTaskDurationMs /
                                  telemetry.localMetrics.taskRuns,
                              )
                            : 0}{" "}
                          ms
                        </div>
                        <div>
                          Step executions:{" "}
                          {telemetry.localMetrics.totalStepExecutions}
                        </div>
                        {Object.entries(telemetry.localMetrics.stepTypeCounts)
                          .length > 0 && (
                          <div>
                            Step type usage:
                            <ul className="ml-4 list-disc">
                              {Object.entries(
                                telemetry.localMetrics.stepTypeCounts,
                              ).map(([type, count]) => (
                                <li key={type}>
                                  {type}: {count}
                                </li>
                              ))}
                            </ul>
                          </div>
                        )}
                      </div>
                    </div>
                  </Card>
                </motion.div>
              </div>
            </div>
          </main>
        </div>
      </motion.div>
    </AuthGuard>
  );
}
