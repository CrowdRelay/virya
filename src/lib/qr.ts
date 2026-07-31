import qrcode from "qrcode-generator"

const DEFAULT_CELL_SIZE = 8
const DEFAULT_MARGIN = 4

export const qrDataUrl = (
  value: string,
  cellSize = DEFAULT_CELL_SIZE,
  margin = DEFAULT_MARGIN,
): string => {
  const qr = qrcode(0, "M")
  qr.addData(value, "Byte")
  qr.make()
  return qr.createDataURL(cellSize, margin)
}
