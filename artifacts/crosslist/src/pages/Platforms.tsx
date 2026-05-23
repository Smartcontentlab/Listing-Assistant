import { useListPlatforms } from "@workspace/api-client-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { CheckCircle2, XCircle, ExternalLink } from "lucide-react";
import { PlatformIcon } from "@/components/PlatformIcon";


const PLATFORM_LINKS: Record<string, string> = {
  poshmark: "https://poshmark.com",
  depop: "https://depop.com",
  mercari: "https://mercari.com",
};

const PLATFORM_TIPS: Record<string, string[]> = {
  poshmark: [
    "Use the Offer to Likers feature to move inventory",
    "Share your closet daily for more visibility",
    "Follow other sellers in your niche",
    "Bundle discounts increase average order value",
  ],
  depop: [
    "Hashtags matter — add category + brand + style tags",
    "Post during evening hours for more views",
    "Refresh listings regularly to stay at the top",
    "Good natural lighting photos perform best",
  ],
  mercari: [
    "Price slightly lower than competitors for faster sales",
    "Respond to offers quickly to avoid expiration",
    "Shipping included listings get more clicks",
    "Keep your rating high — it affects visibility",
  ],
};

export default function Platforms() {
  const { data: platforms, isLoading } = useListPlatforms();

  return (
    <div className="flex-1 p-6 space-y-6 overflow-auto">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Platforms</h1>
        <p className="text-sm text-muted-foreground">Manage your selling platform connections</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {isLoading
          ? Array.from({ length: 3 }).map((_, i) => (
              <Card key={i}>
                <CardContent className="pt-6 space-y-3">
                  <Skeleton className="h-10 w-10 rounded" />
                  <Skeleton className="h-6 w-24" />
                  <Skeleton className="h-4 w-32" />
                </CardContent>
              </Card>
            ))
          : platforms?.map((platform) => (
              <Card key={platform.name} data-testid={`card-platform-${platform.name}`}>
                <CardContent className="pt-6 space-y-4">
                  <div className="flex items-start justify-between">
                    <PlatformIcon name={platform.name} />
                    {platform.connected ? (
                      <CheckCircle2 className="h-4 w-4 text-emerald-500" />
                    ) : (
                      <XCircle className="h-4 w-4 text-muted-foreground" />
                    )}
                  </div>
                  <div>
                    <h3 className="font-semibold text-lg">{platform.displayName}</h3>
                    <p className="text-sm text-muted-foreground">
                      {platform.connected
                        ? `Connected${platform.username ? ` · @${platform.username}` : ""}`
                        : "Not connected"}
                    </p>
                  </div>
                  {platform.listingCount != null && (
                    <div className="flex items-center gap-2">
                      <span className="text-2xl font-bold">{platform.listingCount}</span>
                      <span className="text-xs text-muted-foreground">active listings</span>
                    </div>
                  )}
                  <div className="flex gap-2">
                    <Button
                      data-testid={`button-connect-${platform.name}`}
                      variant={platform.connected ? "outline" : "default"}
                      size="sm"
                      className="flex-1 text-xs"
                      onClick={() => window.open(PLATFORM_LINKS[platform.name], "_blank")}
                    >
                      {platform.connected ? "Manage" : "Connect"}
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8"
                      onClick={() => window.open(PLATFORM_LINKS[platform.name], "_blank")}
                    >
                      <ExternalLink className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {platforms?.map((platform) => (
          <Card key={platform.name}>
            <CardHeader className="pb-2">
              <CardTitle className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">{platform.displayName} Tips</CardTitle>
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
  );
}
