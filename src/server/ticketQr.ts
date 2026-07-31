import qrcode from "qrcode-generator"

export const qrGifBuffer = (value: string): Buffer => {
  const qr = qrcode(0, "M")
  qr.addData(value, "Byte")
  qr.make()
  const dataUrl = qr.createDataURL(10, 4)
  const encoded = dataUrl.split(",", 2)[1]
  if (!encoded) throw new Error("QR generator returned an invalid data URL")
  return Buffer.from(encoded, "base64")
}
