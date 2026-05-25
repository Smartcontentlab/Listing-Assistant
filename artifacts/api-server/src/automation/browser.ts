import { chromium, type Browser, type BrowserContext } from "playwright";
import * as fs from "fs";
import * as path from "path";

const SESSION_DIR = path.resolve(process.cwd(), ".browser-sessions");
if (!fs.existsSync(SESSION_DIR)) fs.mkdirSync(SESSION_DIR, { recursive: true });

let browserInstance: Browser | null = null;

export async function getBrowser(): Promise<Browser> {
  if (!browserInstance || !browserInstance.isConnected()) {
    // Use system Chromium installed via Nix
    const executablePath = process.env.CHROMIUM_PATH ?? "/nix/store/qa9cnw4v5xkxyip6mb9kxqfq1z4x2dx1-chromium-138.0.7204.100/bin/chromium";
    browserInstance = await chromium.launch({
      headless: true,
      executablePath,
      args: ["--no-sandbox", "--disable-setuid-sandbox", "--disable-dev-shm-usage", "--disable-gpu"],
    });
  }
  return browserInstance;
}

export async function getContext(platform: string): Promise<BrowserContext> {
  const browser = await getBrowser();
  const storagePath = path.join(SESSION_DIR, `${platform}-session.json`);
  const hasSession = fs.existsSync(storagePath);
  const context = await browser.newContext({
    storageState: hasSession ? storagePath : undefined,
    userAgent: "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
    viewport: { width: 1280, height: 800 },
  });
  return context;
}

export async function saveSession(platform: string, context: BrowserContext) {
  const storagePath = path.join(SESSION_DIR, `${platform}-session.json`);
  await context.storageState({ path: storagePath });
}

export async function clearSession(platform: string) {
  const storagePath = path.join(SESSION_DIR, `${platform}-session.json`);
  if (fs.existsSync(storagePath)) fs.unlinkSync(storagePath);
}

export async function hasSession(platform: string): Promise<boolean> {
  return fs.existsSync(path.join(SESSION_DIR, `${platform}-session.json`));
}
