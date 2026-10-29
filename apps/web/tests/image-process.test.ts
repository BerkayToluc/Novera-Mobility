import sharp from "sharp";
import { describe, expect, it } from "vitest";
import { processImage } from "@/lib/image-process";
import { MAX_UPLOAD_BYTES, sniffImage, targetWidth } from "@/lib/image-rules";

// Pictures made on the spot: a flat colour with some noise, so they have a real size and are not all one block.
const picture = (width: number, height: number) =>
  sharp({ create: { width, height, channels: 3, background: { r: 40, g: 120, b: 80 } } });

describe("telling what a file is from its first bytes (V2-28, ADR-28)", () => {
  it("knows JPEG, PNG and WebP", async () => {
    expect(sniffImage(await picture(20, 20).jpeg().toBuffer())).toBe("jpeg");
    expect(sniffImage(await picture(20, 20).png().toBuffer())).toBe("png");
    expect(sniffImage(await picture(20, 20).webp().toBuffer())).toBe("webp");
  });

  it("knows nothing else: a PDF, text, a GIF, an SVG and a file that is too short are not pictures", () => {
    const bytes = (text: string) => new TextEncoder().encode(text);
    expect(sniffImage(bytes("%PDF-1.7 ..."))).toBeNull();
    expect(sniffImage(bytes("GIF89a......"))).toBeNull();
    expect(sniffImage(bytes('<svg xmlns="http://www.w3.org/2000/svg"></svg>'))).toBeNull();
    expect(sniffImage(bytes("<?xml version"))).toBeNull();
    expect(sniffImage(new Uint8Array([0xff, 0xd8]))).toBeNull();
    expect(sniffImage(new Uint8Array())).toBeNull();
    // RIFF is not enough: a WAVE file is RIFF too.
    expect(sniffImage(bytes("RIFF....WAVEfmt "))).toBeNull();
  });
});

describe("making the picture the same way every time (V2-28, ADR-28)", () => {
  it("turns a JPEG, a PNG and a WebP into a WebP", async () => {
    for (const make of [() => picture(1600, 1000).jpeg(), () => picture(1600, 1000).png(), () => picture(1600, 1000).webp()]) {
      const result = await processImage(await make().toBuffer());
      expect(result.status).toBe("ok");
      if (result.status !== "ok") return;
      expect(sniffImage(result.webp)).toBe("webp");
      expect(result).toMatchObject({ width: 1600, height: 1000 });
    }
  });

  it("makes a wide picture 2000 px wide and keeps its shape", async () => {
    const result = await processImage(await picture(4000, 2500).jpeg().toBuffer());
    expect(result).toMatchObject({ status: "ok", width: 2000, height: 1250 });
  });

  it("does not stretch one that is smaller than that", async () => {
    expect(await processImage(await picture(1300, 800).png().toBuffer())).toMatchObject({ status: "ok", width: 1300, height: 800 });
  });

  it("leaves out everything the camera wrote: position, time, owner", async () => {
    const withExif = await picture(1600, 1000)
      .jpeg()
      .withExif({ IFD0: { Copyright: "Gizli Sahip", Software: "Kamera 9", DateTime: "2026:10:29 12:00:00" } })
      .toBuffer();
    // The test picture does carry it, so the test would fail if the process kept it.
    expect((await sharp(withExif).metadata()).exif).toBeDefined();
    const result = await processImage(withExif);
    expect(result.status).toBe("ok");
    if (result.status !== "ok") return;
    const out = await sharp(result.webp).metadata();
    expect(out.exif).toBeUndefined();
    expect(out.icc).toBeUndefined();
    expect(out.xmp).toBeUndefined();
    expect(result.webp.includes(Buffer.from("Gizli Sahip"))).toBe(false);
    expect(result.webp.includes(Buffer.from("Kamera 9"))).toBe(false);
  });

  it("turns a picture the way its orientation mark says, then drops the mark", async () => {
    // 1600 wide and 1200 tall as stored, marked "turn it a quarter": it is a 1200 wide and 1600 tall picture to look at.
    const sideways = await picture(1600, 1200).jpeg().withMetadata({ orientation: 6 }).toBuffer();
    const result = await processImage(sideways);
    expect(result).toMatchObject({ status: "ok", width: 1200, height: 1600 });
    if (result.status === "ok") expect((await sharp(result.webp).metadata()).orientation).toBeUndefined();
  });
});

describe("what is refused (V2-28, ADR-28)", () => {
  it("a PDF with a picture's name is not a picture", async () => {
    expect(await processImage(Buffer.from("%PDF-1.7\n1 0 obj\n<< >>\nendobj\n".repeat(50)))).toEqual({ status: "wrong_type" });
  });

  it("text, an empty file and a script are not pictures", async () => {
    for (const text of ["", "hello", "<script>alert(1)</script>", "GIF89a"]) {
      expect(await processImage(Buffer.from(text))).toEqual({ status: "wrong_type" });
    }
  });

  it("a picture narrower than 1200 px is refused, however large it is tall", async () => {
    expect(await processImage(await picture(1199, 4000).jpeg().toBuffer())).toEqual({ status: "too_narrow" });
    expect(await processImage(await picture(800, 600).png().toBuffer())).toEqual({ status: "too_narrow" });
    expect((await processImage(await picture(1200, 800).jpeg().toBuffer())).status).toBe("ok");
  });

  it("a turned picture is measured the way up it is shown", async () => {
    // 1600 wide as stored but turned to 1000 wide: too narrow to look at.
    const sideways = await picture(1600, 1000).jpeg().withMetadata({ orientation: 6 }).toBuffer();
    expect(await processImage(sideways)).toEqual({ status: "too_narrow" });
  });

  it("a file over the size the server takes is refused before it is opened", async () => {
    const big = Buffer.alloc(MAX_UPLOAD_BYTES + 1, 0xff);
    big[0] = 0xff;
    big[1] = 0xd8;
    expect(await processImage(big)).toEqual({ status: "too_large" });
  });

  it("a picture that starts right and is cut off, or is not one inside, cannot be read", async () => {
    const whole = await picture(1600, 1000).jpeg().toBuffer();
    expect(await processImage(whole.subarray(0, 120))).toEqual({ status: "unreadable" });
    expect(await processImage(Buffer.concat([Buffer.from([0xff, 0xd8, 0xff]), Buffer.from("not really a picture".repeat(20))]))).toEqual({
      status: "unreadable",
    });
  });

  it("a picture with more pixels than may be opened is refused instead of filling the memory", async () => {
    // A small file, a huge picture: 9000 x 9000 flat colour is 81 million pixels, over the 60 million the server opens.
    const bomb = await sharp({ create: { width: 9000, height: 9000, channels: 3, background: "#000" } }).png({ compressionLevel: 9 }).toBuffer();
    expect(bomb.length).toBeLessThan(MAX_UPLOAD_BYTES);
    expect(await processImage(bomb)).toEqual({ status: "unreadable" });
  });
});

describe("making a picture smaller in the browser first (V2-28)", () => {
  it("never wider than the site shows, never wider than it was", () => {
    expect(targetWidth(6000)).toBe(2000);
    expect(targetWidth(2000)).toBe(2000);
    expect(targetWidth(1500)).toBe(1500);
    expect(targetWidth(1200)).toBe(1200);
  });
});
