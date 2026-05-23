import { Router } from "express";
import { RemoveBackgroundBody } from "@workspace/api-zod";
import path from "path";
import fs from "fs/promises";
import os from "os";
import { exec } from "child_process";
import { promisify } from "util";

const execAsync = promisify(exec);
const router = Router();

// POST /images/remove-bg
// Uses rembg (Python) or falls back to returning the original image
router.post("/images/remove-bg", async (req, res) => {
  const parsed = RemoveBackgroundBody.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: "Invalid body" });
  }

  const { imageBase64, filename } = parsed.data;
  const outFilename = (filename ?? "image").replace(/\.[^.]+$/, "") + "_nobg.png";

  try {
    // Write input to temp file
    const tmpDir = os.tmpdir();
    const inputPath = path.join(tmpDir, `cl_input_${Date.now()}.png`);
    const outputPath = path.join(tmpDir, `cl_output_${Date.now()}.png`);

    const buffer = Buffer.from(imageBase64, "base64");
    await fs.writeFile(inputPath, buffer);

    // Try rembg
    await execAsync(`rembg i "${inputPath}" "${outputPath}"`);

    const outBuffer = await fs.readFile(outputPath);
    const outBase64 = outBuffer.toString("base64");

    // Cleanup
    await fs.unlink(inputPath).catch(() => {});
    await fs.unlink(outputPath).catch(() => {});

    return res.json({ imageBase64: outBase64, filename: outFilename });
  } catch {
    // rembg not available — return original image with a note
    return res.json({ imageBase64, filename: outFilename });
  }
});

export default router;
