// Sprawdzenie strony w Safari z iOS (symulator iPhone'a na maszynie macOS GitHuba), sesja 10c P18.
// Prowadzi Safari przez safaridriver (WebDriver, bez bibliotek): przewija, klika, robi zrzuty i zapisuje pomiary.
// Uruchamia go .github/workflows/safari.yml: node check.mjs <adres strony> <folder wyników>
import { mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";

const [base = "https://www.domy-lipowa-demo.pl", out = "results"] = process.argv.slice(2);
const driver = "http://127.0.0.1:4444";
mkdirSync(out, { recursive: true });
const report = { base, steps: [] };
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function call(method, url, body) {
  const response = await fetch(`${driver}${url}`, {
    method,
    headers: { "content-type": "application/json" },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const json = await response.json();
  if (!response.ok) throw new Error(`${method} ${url}: ${JSON.stringify(json.value ?? json).slice(0, 400)}`);
  return json.value;
}

const session = await call("POST", "/session", {
  capabilities: {
    alwaysMatch: {
      browserName: "safari",
      platformName: "iOS",
      "safari:useSimulator": true,
      ...(process.env.SIMULATOR_UDID ? { "safari:deviceUDID": process.env.SIMULATOR_UDID } : { "safari:deviceType": "iPhone" }),
    },
  },
});
const id = session.sessionId;
report.capabilities = session.capabilities;
const s = (suffix) => `/session/${id}${suffix}`;
const run = (script, args = []) => call("POST", s("/execute/sync"), { script, args });
const go = async (pagePath) => {
  await call("POST", s("/url"), { url: new URL(pagePath, base).href });
  await sleep(3500); // wejście pierwszego ekranu
};
const find = async (selector) => {
  const element = await call("POST", s("/element"), { using: "css selector", value: selector });
  return Object.values(element)[0];
};
// Dotknięcie palcem (W3C Actions, wskaźnik „touch”) — polecenie „element/click” safaridriver na iOS nie wysyła stronie
// zdarzeń dotyku i fokusu (przebieg 1: wyspa formularza nie ruszyła, okno powiększenia się nie otworzyło).
const tap = async (selector) => {
  const element = await find(selector);
  await call("POST", s(`/element/${element}/screenshot`)).catch(() => {}); // przewija element do widoku
  await call("POST", s("/actions"), {
    actions: [
      {
        type: "pointer",
        id: "finger",
        parameters: { pointerType: "touch" },
        actions: [
          { type: "pointerMove", duration: 0, origin: { "element-6066-11e4-a52e-4f735466cecf": element }, x: 0, y: 0 },
          { type: "pointerDown", button: 0 },
          { type: "pause", duration: 80 },
          { type: "pointerUp", button: 0 },
        ],
      },
    ],
  });
  await call("DELETE", s("/actions")).catch(() => {});
};
const click = tap;
const type = async (selector, text) => {
  await tap(selector);
  await sleep(400);
  const keys = [...text].flatMap((value) => [{ type: "keyDown", value }, { type: "keyUp", value }]);
  await call("POST", s("/actions"), { actions: [{ type: "key", id: "keyboard", actions: keys }] });
  await call("DELETE", s("/actions")).catch(() => {});
};
const scrollTo = async (selector, offset = 70) => {
  await run(
    `const el = document.querySelector(arguments[0]); if (el) window.scrollTo(0, el.getBoundingClientRect().top + scrollY - arguments[1]);`,
    [selector, offset],
  );
  await sleep(1500);
};
// Pomiary w każdym kroku: szerokość (przewijanie w bok), otwarte okno, nagłówek.
const measure = () =>
  run(`return {
    path: location.pathname + location.hash,
    innerWidth, scrollWidth: document.documentElement.scrollWidth,
    horizontalOverflow: document.documentElement.scrollWidth > innerWidth,
    dialogOpen: !!document.querySelector('dialog[open]'),
    headerSolid: document.documentElement.hasAttribute('data-header-solid') || !!document.querySelector('[data-header-solid]'),
  }`);

async function step(name, action) {
  const entry = { name };
  try {
    if (action) entry.result = await action();
    entry.measure = await measure();
  } catch (error) {
    entry.error = String(error.message ?? error);
  }
  try {
    const png = await call("GET", s("/screenshot"));
    writeFileSync(path.join(out, `${String(report.steps.length + 1).padStart(2, "0")}-${name}.png`), Buffer.from(png, "base64"));
  } catch (error) {
    entry.screenshotError = String(error.message ?? error);
  }
  report.steps.push(entry);
  console.log(JSON.stringify(entry));
}

try {
  await go("/");
  await step("fold", () =>
    run(`return {
      userAgent: navigator.userAgent,
      viewTimeline: CSS.supports('animation-timeline: view()'),
      backdropFilter: CSS.supports('backdrop-filter: blur(4px)') || CSS.supports('-webkit-backdrop-filter: blur(4px)'),
      popover: 'popover' in HTMLElement.prototype,
      hasSelector: CSS.supports('selector(:has(a))'),
      unitImage: [...document.querySelectorAll('[data-unit-areas] img')].map((img) => img.currentSrc),
      areaLinks: document.querySelectorAll('[data-area-id]').length,
      fonts: [...document.fonts].filter((font) => font.status === 'loaded').map((font) => font.family),
    }`),
  );
  await step("menu-open", () => click('button[popovertarget="main-menu"]'));
  await step("menu-closed", () => click('button[popovertarget="main-menu"]'));
  await step("list", () => scrollTo("#lokale"));
  await step("location", () => scrollTo("#polozenie"));
  await step("standard", () => scrollTo("#standard"));
  await step("construction", () => scrollTo("#budowa"));
  await step("construction-viewer", async () => {
    await click("#budowa [data-photo-viewer]");
    await sleep(1500);
  });
  await step("construction-viewer-next", async () => {
    await run(`document.querySelector('dialog[open] button[aria-label*="Nast"], dialog[open] [data-photo-viewer-next]')?.click()`);
    await sleep(1200);
  });
  await step("construction-viewer-closed", async () => {
    await run(`document.querySelector('dialog[open]')?.close()`);
    await sleep(800);
  });
  await step("tap-unit-on-image", async () => {
    await go("/");
    await click('[data-area-id="dom-1a"]');
    await sleep(3000);
    return run("return location.pathname");
  });
  await step("unit-page", () => go("/oferta/dom-1a"));
  await step("unit-drawings", () => scrollTo("[data-catalog-drawing]", 90));
  await step("drawing-viewer", async () => {
    await click("[data-catalog-drawing] a[data-photo-viewer]");
    await sleep(2000);
    return run(`const img = document.querySelector('dialog[open] img'); return img && { src: img.currentSrc, naturalWidth: img.naturalWidth, shown: img.getBoundingClientRect().toJSON() }`);
  });
  await step("contact", async () => {
    await run(`document.querySelector('dialog[open]')?.close()`);
    await go("/");
    await scrollTo("#kontakt");
  });
  await step("contact-filled", async () => {
    await type('#kontakt input[name="name"]', "Test Safari iOS");
    await type('#kontakt input[name="email"]', "test@example.com");
    await type(
      '#kontakt textarea[name="message"]',
      "Wiadomość testowa: Safari na iOS (symulator iPhone'a, GitHub Actions), sesja 10c. Można usunąć.",
    );
    await sleep(12000); // blokada czasowa formularza i Turnstile w tle
    return run(`return {
      turnstileFrames: document.querySelectorAll('iframe[src*="challenges.cloudflare.com"]').length,
      values: [...document.querySelectorAll('#kontakt input, #kontakt textarea')].map((field) => field.name + '=' + field.value.length),
      submitDisabled: document.querySelector('#kontakt button[type="submit"]')?.disabled ?? null,
    }`);
  });
  await step("contact-sent", async () => {
    await click('#kontakt button[type="submit"]');
    await sleep(10000);
    return run(`return document.querySelector('#kontakt [role="status"], #kontakt [role="alert"]')?.textContent ?? null`);
  });
} finally {
  writeFileSync(path.join(out, "report.json"), JSON.stringify(report, null, 2));
  await call("DELETE", s("")).catch(() => {});
}
