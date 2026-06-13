import { chromium, type Browser, type BrowserContext } from "playwright";
import StealthPlugin from "puppeteer-extra-plugin-stealth";
import * as fs from "fs";
import * as path from "path";

const SESSION_DIR = path.resolve(process.cwd(), ".browser-sessions");
if (!fs.existsSync(SESSION_DIR)) fs.mkdirSync(SESSION_DIR, { recursive: true });

let browserInstance: Browser | null = null;

export async function getBrowser(): Promise<Browser> {
  if (!browserInstance || !browserInstance.isConnected()) {
    // Use system Chromium installed via Nix
    const executablePath = process.env.CHROMIUM_PATH ?? "/nix/store/qa9cnw4v5xkxyip6mb9kxqfq1z4x2dx1-chromium-138.0.7204.100/bin/chromium";
    
    // Launch with stealth mode to avoid headless detection
    browserInstance = await chromium.launch({
      headless: true,
      executablePath,
      args: [
        "--no-sandbox",
        "--disable-setuid-sandbox",
        "--disable-dev-shm-usage",
        "--disable-gpu",
        "--disable-blink-features=AutomationControlled",
        "--disable-features=IsolateOrigins,site-per-process",
        "--disable-site-isolation-trials",
        "--no-first-run",
        "--no-default-browser-check",
        "--disable-extensions",
        "--disable-default-apps",
        "--disable-popup-blocking",
        "--disable-translate",
        "--disable-background-timer-throttling",
        "--disable-backgrounding-occluded-windows",
        "--disable-renderer-backgrounding",
        "--disable-field-trial-config",
        "--disable-back-forward-cache",
        "--disable-ipc-flooding-protection",
      ],
    });
  }
  return browserInstance;
}

export async function getContext(platform: string): Promise<BrowserContext> {
  const browser = await getBrowser();
  const storagePath = path.join(SESSION_DIR, `${platform}-session.json`);
  const hasSessionFile = fs.existsSync(storagePath);
  
  const context = await browser.newContext({
    storageState: hasSessionFile ? storagePath : undefined,
    userAgent: "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
    viewport: { width: 1366, height: 768 },
    // Add subtle human-like characteristics
    locale: "en-US",
    timezoneId: "America/Los_Angeles",
    permissions: ["geolocation", "notifications"],
    colorScheme: "light",
    reducedMotion: "reduce",
    forcedColors: "none",
    deviceScaleFactor: 1,
    isMobile: false,
    hasTouch: false,
  });
  
  // Add anti-detection scripts
  await context.addInitScript(() => {
    // Remove webdriver flag
    Object.defineProperty(navigator, 'webdriver', {
      get: () => undefined,
    });
    
    // Mock chrome.runtime
    if (!window.chrome) {
      (window as any).chrome = { runtime: {} };
    }
    
    // Mock permissions
    const originalQuery = navigator.permissions?.query;
    if (originalQuery) {
      navigator.permissions.query = (parameters: any) => {
        if (parameters.name === 'notifications') {
          return Promise.resolve({ state: 'granted' } as PermissionStatus);
        }
        return originalQuery(parameters);
      };
    }
    
    // Mock plugins
    Object.defineProperty(navigator, 'plugins', {
      get: () => [
        { name: 'Chrome PDF Plugin', filename: 'internal-pdf-viewer' },
        { name: 'Chrome PDF Viewer', filename: 'mhjfbmdgcfjbbpaeojofohoefgiehjai' },
        { name: 'Native Client', filename: 'internal-nacl-plugin' },
      ],
    });
    
    // Mock languages
    Object.defineProperty(navigator, 'languages', {
      get: () => ['en-US', 'en'],
    });
    
    // Mock hardware concurrency
    Object.defineProperty(navigator, 'hardwareConcurrency', {
      get: () => 8,
    });
  });
  
  return context;
}

export async function saveSession(platform: string, context: BrowserContext): Promise<void> {
  const storagePath = path.join(SESSION_DIR, `${platform}-session.json`);
  await context.storageState({ path: storagePath });
}

export async function clearSession(platform: string): Promise<void> {
  const storagePath = path.join(SESSION_DIR, `${platform}-session.json`);
  if (fs.existsSync(storagePath)) fs.unlinkSync(storagePath);
}

export async function hasSession(platform: string): Promise<boolean> {
  return fs.existsSync(path.join(SESSION_DIR, `${platform}-session.json`));
}

// Human-like delay helper
export async function humanDelay(min: number = 500, max: number = 1500): Promise<void> {
  const delay = Math.random() * (max - min) + min;
  await new Promise(resolve => setTimeout(resolve, delay));
}

// Human-like mouse movement
export async function humanMove(page: any, x: number, y: number): Promise<void> {
  await page.mouse.move(x, y, { steps: Math.floor(Math.random() * 10) + 5 });
}

// Human-like typing
export async function humanType(page: any, selector: string, text: string): Promise<void> {
  await page.focus(selector);
  for (const char of text) {
    await page.keyboard.type(char);
    await humanDelay(50, 200);
  }
}