const { test, expect } = require("@playwright/test");

test("simulator renders, localizes, switches scenarios, and restores state", async ({ page }) => {
  const errors = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.goto("/");
  await expect(page.getByRole("heading", { name: "Traffic Simulation Console" })).toBeVisible();
  await expect(page.locator("#vehicleCount")).not.toHaveText("0", { timeout: 5000 });

  const canvasHasTrafficPixels = await page.locator("#trafficCanvas").evaluate((canvas) => {
    return canvas.toDataURL("image/png").length > 50000;
  });
  expect(canvasHasTrafficPixels).toBe(true);

  await page.locator("#language").selectOption("zh-TW");
  await expect(page.getByRole("heading", { name: "交通模擬控制台" })).toBeVisible();
  await page.locator("#mode").selectOption("highway");
  await page.locator("#rampMerge").check();
  await page.locator("#laneClosure").check();
  await expect(page.locator("#reactionTime")).toBeEnabled();
  await expect(page.locator("#turningTraffic")).toBeDisabled();

  await page.locator("#toggleRun").click();
  await page.locator("#exportScenario").click();
  const exported = await page.locator("#scenarioOutput").inputValue();
  expect(JSON.parse(exported).schemaVersion).toBe(4);
  await page.locator("#scenarioOutput").fill(exported);
  await page.locator("#importScenario").click();
  await expect(page.locator("#scenarioMessage")).toHaveText("已精確還原情境。");
  await expect(page.locator("#metricsChart")).toBeVisible();
  expect(errors).toEqual([]);
});

test("mobile layout does not overflow horizontally", async ({ page }) => {
  await page.goto("/");
  const dimensions = await page.evaluate(() => ({ viewport: document.documentElement.clientWidth, page: document.documentElement.scrollWidth }));
  expect(dimensions.page).toBeLessThanOrEqual(dimensions.viewport + 1);
  await expect(page.locator("#trafficCanvas")).toBeVisible();
  await expect(page.locator("#scenarioOutput")).toBeVisible();
});
