const assert = require("assert");

const forms = new Map();
global.window = {};
global.document = {
  getElementById(id) {
    return forms.get(id) || null;
  },
};

require("../settingsAutosave.js");

const waitForTimers = () => new Promise((resolve) => setTimeout(resolve, 10));

(async function run() {
  const createController = window.createSettingsAutosaveController;
  assert.equal(typeof createController, "function");

  let submits = 0;
  forms.set("locations", {
    dataset: {},
    setAttribute() {},
    requestSubmit: () => { submits += 1; },
  });
  const controller = createController({ defaultDelay: 0 });

  controller.scheduleForm("locations", 0);
  await waitForTimers();
  assert.equal(submits, 1, "a changed form should submit once");
  assert.equal(controller.begin("locations"), true);

  controller.scheduleForm("locations", 0);
  assert.equal(controller.begin("locations"), false, "an in-flight form must not overlap requests");
  controller.finish("locations", { ok: true });
  await waitForTimers();
  assert.equal(submits, 2, "an edit made during a request should be submitted afterward");
  assert.equal(controller.snapshot("locations").savedRevision, 1);
  assert.equal(controller.snapshot("locations").revision, 2);

  assert.equal(controller.begin("locations"), true);
  controller.finish("locations", { ok: true });
  assert.equal(controller.snapshot("locations").savedRevision, 2);

  controller.scheduleForm("locations", 0);
  await waitForTimers();
  assert.equal(controller.begin("locations"), true);
  controller.finish("locations", { ok: false });
  const failedSubmitCount = submits;
  await waitForTimers();
  assert.equal(submits, failedSubmitCount, "a failed save must not retry forever without a new edit");
  assert.equal(controller.snapshot("locations").status, "error");

  let taskValue = 0;
  let releaseFirstTask;
  const firstTaskGate = new Promise((resolve) => { releaseFirstTask = resolve; });
  controller.scheduleTask("messaging-rule:test", async () => {
    await firstTaskGate;
    taskValue = 1;
  }, 0);
  await waitForTimers();
  controller.scheduleTask("messaging-rule:test", async () => {
    taskValue = 2;
  }, 0);
  releaseFirstTask();
  await waitForTimers();
  await waitForTimers();
  assert.equal(taskValue, 2, "a task changed during a request should run its latest revision");
  assert.equal(controller.snapshot("messaging-rule:test").status, "saved");

  controller.scheduleTask("department-lead:test", async () => {
    throw new Error("rejected");
  }, 0);
  await waitForTimers();
  assert.equal(controller.snapshot("department-lead:test").status, "error");

  console.log("settings autosave tests passed");
})().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
