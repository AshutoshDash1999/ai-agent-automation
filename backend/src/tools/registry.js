// backend/src/tools/registry.js
const { fork } = require("child_process");
const path = require("path");

/**
 * Centralized dynamic tool dictionary tracking mapping properties to sandboxed files and execution methods.
 * Adding a tool like HackerNews, Slack, or GitHub now only requires adding one line here.
 */
const toolRegistryMap = {
  email: { toolName: "emailTool", functionName: "sendMail" },
  file: { toolName: "fileTool", functionName: "handleAction" },
  browser: { toolName: "browserTool", functionName: "handleAction" },
  hackernews: { toolName: "hackerNewsTool", functionName: "fetchNews" },
  slack_tool: { toolName: "slackTool", functionName: "postMessage" },
  github_tool: { toolName: "githubTool", functionName: "processEvent" }
};

/**
 * Checks if a workflow step type matches a registered sandboxed tool.
 * @param {string} type 
 * @returns {boolean}
 */
function hasTool(type) {
  if (!type) return false;
  return !!toolRegistryMap[type.toLowerCase()];
}

/**
 * Dynamic Tool Dispatcher executing tasks under a uniform tool contract interface.
 * @param {string} type - The incoming step type descriptor
 * @param {Object} step - The layout properties configuration definition payload
 * @param {Object} context - The operational workflow active run context variables
 * @returns {Promise<any>}
 */
async function dispatchTool(type, step, context) {
  const config = toolRegistryMap[type.toLowerCase()];
  if (!config) {
    throw new Error(`Execution Contract Violation: Missing tool registration for type '${type}'`);
  }

  // Passing arguments cleanly down to the underlying sandbox process boundary matching the run(step, context) specification contract
  return await runToolInSandbox(config.toolName, config.functionName, [step, context]);
}

/**
 * Executes a tool in a separate process container for security/isolation.
 */
function runToolInSandbox(toolName, functionName, args = []) {
  return new Promise((resolve, reject) => {
    const workerPath = path.join(__dirname, "sandboxWorker.js");

    const uid = process.env.TOOL_SANDBOX_UID ? Number(process.env.TOOL_SANDBOX_UID) : undefined;
    const gid = process.env.TOOL_SANDBOX_GID ? Number(process.env.TOOL_SANDBOX_GID) : undefined;
    const timeoutMs = process.env.TOOL_EXECUTION_TIMEOUT_MS ? Number(process.env.TOOL_EXECUTION_TIMEOUT_MS) : 30000;

    const allowedEnv = {
      IS_SANDBOX: "true"
    };

    const SYSTEM_ENV_VARS = ["PATH", "HOME", "USER", "NODE_ENV", "PWD"];
    for (const key of SYSTEM_ENV_VARS) {
      if (process.env[key] !== undefined) {
        allowedEnv[key] = process.env[key];
      }
    }

    const TOOL_CONFIG_VARS = [
      "FILE_BASE_DIR",
      "PUPPETEER_HEADLESS",
      "MAIL_HOST",
      "MAIL_PORT",
      "MAIL_USER",
      "MAIL_PASS",
      "MAIL_FROM",
      "EMAIL_HOST",
      "EMAIL_PORT",
      "EMAIL_USER",
      "EMAIL_PASS",
      "EMAIL_FROM"
    ];
    for (const key of TOOL_CONFIG_VARS) {
      if (process.env[key] !== undefined) {
        allowedEnv[key] = process.env[key];
      }
    }

    const forkOpts = {
      stdio: ["inherit", "inherit", "inherit", "ipc"],
      execArgv: ["--max-old-space-size=256"],
      env: allowedEnv
    };

    if (uid !== undefined && !isNaN(uid)) {
      forkOpts.uid = uid;
    }
    if (gid !== undefined && !isNaN(gid)) {
      forkOpts.gid = gid;
    }

    const child = fork(workerPath, [], forkOpts);
    let finished = false;

    const timer = setTimeout(() => {
      if (!finished) {
        finished = true;
        try {
          child.kill("SIGKILL");
        } catch (e) {}
        reject(new Error(`Tool execution timed out after ${timeoutMs}ms.`));
      }
    }, timeoutMs);

    child.on("message", (response) => {
      if (finished) return;
      finished = true;
      clearTimeout(timer);

      if (response && response.success) {
        resolve(response.result);
      } else {
        reject(new Error(response ? response.error : "Unknown execution error"));
      }
    });

    child.on("error", (err) => {
      if (finished) return;
      finished = true;
      clearTimeout(timer);
      reject(err);
    });

    child.on("exit", (code) => {
      if (finished) return;
      finished = true;
      clearTimeout(timer);
      if (code !== 0) {
        reject(new Error(`Sandbox worker exited with code ${code}`));
      } else {
        resolve(null);
      }
    });

    child.send({ toolName, functionName, args });
  });
}

module.exports = { 
  runToolInSandbox,
  hasTool,
  dispatchTool
};