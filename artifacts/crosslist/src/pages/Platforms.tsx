import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { CheckCircle2, XCircle, Loader2, LogOut, ChevronDown, ChevronUp, ExternalLink, Info } from "lucide-react";
import { PlatformIcon } from "@/components/PlatformIcon";

const PLATFORMS = [
  { name: "poshmark", displayName: "Poshmark", url: "https://poshmark.com", color: "bg-rose-500" },
  { name: "depop", displayName: "Depop", url: "https://depop.com", color: "bg-red-500" },
  { name: "mercari", displayName: "Mercari", url: "https://mercari.com", color: "bg-orange-400" },
];

const PLATFORM_TIPS: Record<string, string[]> = {
  poshmark: [
    "Share your closet daily for more visibility",
    "Use Offer to Likers to move inventory fast",
    "Bundle discounts increase average order value",
    "Follow other sellers in your niche",
  ],
  depop: [
    "Hashtags matter — add brand + style + category tags",
    "Post during evening hours for more views",
    "Good natural lighting photos perform best",
    "Refresh listings regularly to stay at the top",
  ],
  mercari: [
    "Price slightly lower than competitors for faster sales",
    "Respond to offers quickly to avoid expiration",
    "Listings with free shipping get more clicks",
    "Keep your rating high — it affects visibility",
  ],
};

interface Credential {
  platform: string;
  username: string;
  connected: boolean;
}

export default function Platforms() {
  const qc = useQueryClient();
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});
  const [form, setForm] = useState<Record<string, { username: string; password: string }>>({});
  const [errors, setErrors] = useState<Record<string, string>>({});

  const { data: credentials = [] } = useQuery<Credential[]>({
    queryKey: ["/api/automation/credentials"],
    queryFn: () => fetch("/api/automation/credentials").then((r) => r.json()),
    refetchInterval: 30000,
  });

  const connect = useMutation({
    mutationFn: async ({ platform, username, password }: { platform: string; username: string; password: string }) => {
      const resp = await fetch("/api/automation/credentials", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ platform, username, password }),
      });
      const data = await resp.json();
      if (!resp.ok) throw new Error(data.error ?? "Connection failed");
      return data;
    },
    onSuccess: (_, { platform }) => {
      qc.invalidateQueries({ queryKey: ["/api/automation/credentials"] });
      setExpanded((prev) => ({ ...prev, [platform]: false }));
      setErrors((prev) => ({ ...prev, [platform]: "" }));
    },
    onError: (err: Error, { platform }) => {
      setErrors((prev) => ({ ...prev, [platform]: err.message }));
    },
  });

  const disconnect = useMutation({
    mutationFn: (platform: string) =>
      fetch(`/api/automation/credentials/${platform}`, { method: "DELETE" }).then((r) => r.json()),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["/api/automation/credentials"] }),
  });

  function getCredential(platform: string): Credential | undefined {
    return credentials.find((c) => c.platform === platform);
  }

  function toggleExpand(platform: string) {
    setExpanded((prev) => ({ ...prev, [platform]: !prev[platform] }));
    if (!form[platform]) setForm((prev) => ({ ...prev, [platform]: { username: "", password: "" } }));
  }

  function updateField(platform: string, field: "username" | "password", value: string) {
    setForm((prev) => ({ ...prev, [platform]: { ...prev[platform], username: prev[platform]?.username ?? "", password: prev[platform]?.password ?? "", [field]: value } }));
  }

  function handleConnect(platform: string) {
    const f = form[platform];
    if (!f?.username || !f?.password) {
      setErrors((prev) => ({ ...prev, [platform]: "Email/username and password are required." }));
      return;
    }
    setErrors((prev) => ({ ...prev, [platform]: "" }));
    connect.mutate({ platform, username: f.username, password: f.password });
  }

  return (
    <div className="flex-1 p-6 space-y-6 overflow-auto">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Platforms</h1>
        <p className="text-sm text-muted-foreground">Connect your accounts to enable one-click publishing and auto-posting</p>
      </div>

      {/* Automation note */}
      <div className="flex items-start gap-3 p-4 rounded-xl bg-blue-50 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-800">
        <Info className="h-4 w-4 text-blue-500 mt-0.5 shrink-0" />
        <div>
          <p className="text-sm font-medium text-blue-700 dark:text-blue-300">How automation works</p>
          <p className="text-xs text-blue-600/80 dark:text-blue-400/80 mt-0.5">
            CrossList logs into each platform on your behalf using a background browser and fills out the listing form automatically. Your credentials are stored locally and never shared. This is the same approach used by tools like Vendoo and List Perfectly.
          </p>
        </div>
      </div>

      {/* Platform cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {PLATFORMS.map((platform) => {
          const cred = getCredential(platform.name);
          const isConnected = !!cred?.connected;
          const isOpen = expanded[platform.name];
          const isLoading = connect.isPending && connect.variables?.platform === platform.name;
          const isDisconnecting = disconnect.isPending;

          return (
            <Card key={platform.name} className={`transition-all ${isConnected ? "border-emerald-200 dark:border-emerald-800" : ""}`}>
              <CardContent className="pt-5 space-y-4">
                {/* Header */}
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-2">
                    <PlatformIcon name={platform.name} />
                    <div>
                      <h3 className="font-semibold">{platform.displayName}</h3>
                      {isConnected && cred?.username && (
                        <p className="text-xs text-muted-foreground">{cred.username}</p>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-1">
                    {isConnected ? (
                      <Badge className="text-[10px] bg-emerald-100 text-emerald-700 border-0 gap-1">
                        <CheckCircle2 className="h-3 w-3" /> Connected
                      </Badge>
                    ) : (
                      <Badge variant="outline" className="text-[10px] text-muted-foreground gap-1">
                        <XCircle className="h-3 w-3" /> Not connected
                      </Badge>
                    )}
                  </div>
                </div>

                {/* Actions */}
                <div className="flex gap-2">
                  {isConnected ? (
                    <>
                      <Button variant="outline" size="sm" className="flex-1 text-xs" onClick={() => window.open(platform.url, "_blank")}>
                        <ExternalLink className="h-3 w-3 mr-1" /> Open Platform
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="text-xs text-destructive hover:text-destructive"
                        onClick={() => disconnect.mutate(platform.name)}
                        disabled={isDisconnecting}
                      >
                        <LogOut className="h-3 w-3 mr-1" /> Disconnect
                      </Button>
                    </>
                  ) : (
                    <Button
                      size="sm"
                      className="flex-1 text-xs"
                      onClick={() => toggleExpand(platform.name)}
                    >
                      Connect Account
                      {isOpen ? <ChevronUp className="h-3 w-3 ml-1" /> : <ChevronDown className="h-3 w-3 ml-1" />}
                    </Button>
                  )}
                </div>

                {/* Login form */}
                {isOpen && !isConnected && (
                  <div className="border-t border-border pt-4 space-y-3">
                    <div className="space-y-1.5">
                      <Label className="text-xs">Email or Username</Label>
                      <Input
                        type="text"
                        placeholder={`Your ${platform.displayName} username`}
                        value={form[platform.name]?.username ?? ""}
                        onChange={(e) => updateField(platform.name, "username", e.target.value)}
                        className="h-8 text-sm"
                        autoComplete="off"
                      />
                    </div>
                    <div className="space-y-1.5">
                      <Label className="text-xs">Password</Label>
                      <Input
                        type="password"
                        placeholder="Your password"
                        value={form[platform.name]?.password ?? ""}
                        onChange={(e) => updateField(platform.name, "password", e.target.value)}
                        className="h-8 text-sm"
                        onKeyDown={(e) => e.key === "Enter" && handleConnect(platform.name)}
                      />
                    </div>
                    {errors[platform.name] && (
                      <p className="text-xs text-destructive">{errors[platform.name]}</p>
                    )}
                    <Button
                      size="sm"
                      className="w-full text-xs"
                      onClick={() => handleConnect(platform.name)}
                      disabled={isLoading}
                    >
                      {isLoading ? (
                        <><Loader2 className="h-3 w-3 mr-1.5 animate-spin" /> Logging in…</>
                      ) : (
                        "Connect & Test Login"
                      )}
                    </Button>
                    <p className="text-[10px] text-muted-foreground text-center">
                      CrossList opens a background browser window to verify your login. This may take 10-20 seconds.
                    </p>
                  </div>
                )}
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Tips */}
      <div>
        <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-3">Selling tips</h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {PLATFORMS.map((platform) => (
            <Card key={platform.name}>
              <CardHeader className="pb-2">
                <CardTitle className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">{platform.displayName}</CardTitle>
              </CardHeader>
              <CardContent>
                <ul className="space-y-2">
                  {PLATFORM_TIPS[platform.name]?.map((tip, i) => (
                    <li key={i} className="text-xs text-muted-foreground flex items-start gap-2">
                      <span className="h-1.5 w-1.5 rounded-full bg-primary mt-1.5 shrink-0" />
                      {tip}
                    </li>
                  ))}
                </ul>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    </div>
  );
}
