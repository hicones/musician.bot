const fs = require("node:fs");
const path = require("node:path");
const { download } = require("@distube/yt-dlp");

const isWindows = process.env.YTDLP_IS_WINDOWS || process.platform === "win32";
const ytDlpDistDir = path.dirname(require.resolve("@distube/yt-dlp"));
const ytDlpDir = process.env.YTDLP_DIR || path.join(ytDlpDistDir, "..", "bin");
const ytDlpFilename = process.env.YTDLP_FILENAME || `yt-dlp${isWindows ? ".exe" : ""}`;
const ytDlpPath = path.join(ytDlpDir, ytDlpFilename);

const hasBinary = () => {
  try {
    const stat = fs.statSync(ytDlpPath);
    return stat.isFile() && stat.size > 0;
  } catch {
    return false;
  }
};

if (hasBinary()) {
  console.log(`[yt-dlp] Binary available at ${ytDlpPath}`);
} else {
  download()
    .then((version) => {
      console.log(`[yt-dlp] Downloaded ${version} version to ${ytDlpPath}`);
    })
    .catch((error) => {
      console.error(`[yt-dlp] Failed to prepare binary at ${ytDlpPath}`);
      console.error(error);
      process.exitCode = 1;
    });
}
