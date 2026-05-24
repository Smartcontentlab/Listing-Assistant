import { Switch, Route, Router as WouterRouter } from "wouter";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import {
  SidebarProvider,
  Sidebar,
  SidebarContent,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarRail,
} from "@/components/ui/sidebar";
import { LayoutDashboard, List, PlusCircle, Search, Globe, Camera, PackageCheck } from "lucide-react";
import { Link, useLocation } from "wouter";
import NotFound from "@/pages/not-found";
import Dashboard from "@/pages/Dashboard";
import Listings from "@/pages/Listings";
import NewListing from "@/pages/NewListing";
import PriceResearch from "@/pages/PriceResearch";
import Platforms from "@/pages/Platforms";
import ListingDetail from "@/pages/ListingDetail";
import Scanner from "@/pages/Scanner";
import SoldTracker from "@/pages/SoldTracker";
import ListingWizard from "@/components/ListingWizard";

const queryClient = new QueryClient();

const navigation = [
  { name: "Dashboard", href: "/", icon: LayoutDashboard, exact: true },
  { name: "Listings", href: "/listings", icon: List, exact: false },
  { name: "New Listing", href: "/listings/new", icon: PlusCircle, exact: true },
  { name: "Sold Tracker", href: "/sold", icon: PackageCheck, exact: false },
  { name: "Thrift Scanner", href: "/scanner", icon: Camera, exact: false },
  { name: "Price Research", href: "/price-research", icon: Search, exact: false },
  { name: "Platforms", href: "/platforms", icon: Globe, exact: false },
];

function AppLayout({ children }: { children: React.ReactNode }) {
  const [location] = useLocation();

  function isActive(item: (typeof navigation)[0]) {
    if (item.exact) return location === item.href;
    if (item.href === "/listings") return location.startsWith("/listings") && location !== "/listings/new" && !location.startsWith("/listings/wizard");
    return location.startsWith(item.href);
  }

  return (
    <SidebarProvider>
      <div className="flex min-h-screen w-full bg-background">
        <Sidebar collapsible="icon" className="border-r">
          <SidebarHeader className="py-4 px-4 border-b">
            <div className="flex items-center gap-2">
              <div className="h-7 w-7 rounded bg-primary flex items-center justify-center shrink-0">
                <span className="text-primary-foreground text-xs font-black">CL</span>
              </div>
              <span className="font-black tracking-tight text-base group-data-[collapsible=icon]:hidden">
                CROSSLIST
              </span>
            </div>
          </SidebarHeader>
          <SidebarContent className="pt-2">
            <SidebarMenu>
              {navigation.map((item) => (
                <SidebarMenuItem key={item.name}>
                  <SidebarMenuButton
                    asChild
                    isActive={isActive(item)}
                    tooltip={item.name}
                  >
                    <Link href={item.href} data-testid={`link-nav-${item.name.toLowerCase().replace(/\s+/g, "-")}`}>
                      <item.icon className="h-4 w-4" />
                      <span>{item.name}</span>
                    </Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarContent>
          <SidebarRail />
        </Sidebar>
        <main className="flex-1 flex flex-col overflow-hidden">
          {children}
        </main>
      </div>
    </SidebarProvider>
  );
}

function Router() {
  return (
    <AppLayout>
      <Switch>
        <Route path="/" component={Dashboard} />
        <Route path="/listings/new" component={ListingWizard} />
        <Route path="/listings/:id" component={ListingDetail} />
        <Route path="/listings" component={Listings} />
        <Route path="/sold" component={SoldTracker} />
        <Route path="/scanner" component={Scanner} />
        <Route path="/price-research" component={PriceResearch} />
        <Route path="/platforms" component={Platforms} />
        <Route component={NotFound} />
      </Switch>
    </AppLayout>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/, "")}>
          <Router />
        </WouterRouter>
        <Toaster />
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
