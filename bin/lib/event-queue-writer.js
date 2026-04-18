const crypto = require("node:crypto");
const fs = require("node:fs");
const path = require("node:path");

function writeQueueEvent(queueDir, payload) {
  fs.mkdirSync(queueDir, { recursive: true });

  const timestamp = Date.now();
  const random = crypto.randomBytes(4).toString("hex");
  const baseName = `${timestamp}-${random}`;
  const tmpPath = path.join(queueDir, `${baseName}.tmp`);
  const finalPath = path.join(queueDir, `${baseName}.json`);

  fs.writeFileSync(tmpPath, JSON.stringify(payload), "utf8");
  fs.renameSync(tmpPath, finalPath);
}

module.exports = { writeQueueEvent };
