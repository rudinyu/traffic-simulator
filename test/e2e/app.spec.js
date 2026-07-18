const { test, expect } = require("@playwright/test");

test("simulator renders, localizes, switches scenarios, and restores state", async ({ page }) => {
  const errors = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.goto("/");
  await expect(page.getByRole("heading", { name: "Traffic Simulation Console" })).toBeVisible();
  await expect(page.locator("#vehicleCount")).not.toHaveText("0", { timeout: 5000 });
  await expect(page.locator("#incidentStatus")).toContainText("min");
  await expect(page.locator("#incidentStatus")).toContainText("sec");
  const scheduledBeforeFrequencyChange = await page.locator("#incidentStatus").innerText();
  await page.locator("#incidentFrequency").selectOption("high");
  await expect(page.locator("#incidentStatus")).not.toHaveText(scheduledBeforeFrequencyChange);

  await expect.poll(() => page.locator("#trafficCanvas").evaluate((canvas) => {
    const pixels = canvas.getContext("2d").getImageData(0, 0, canvas.width, canvas.height).data;
    const vehicleColors = new Set([
      "229,231,235",
      "249,115,22",
      "56,189,248",
      "3,105,161",
      "153,27,27"
    ]);
    let matchingPixels = 0;
    for (let offset = 0; offset < pixels.length; offset += 4) {
      if (vehicleColors.has(`${pixels[offset]},${pixels[offset + 1]},${pixels[offset + 2]}`)) {
        matchingPixels += 1;
        if (matchingPixels > 30) return true;
      }
    }
    return false;
  }), { timeout: 5000 }).toBe(true);

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
