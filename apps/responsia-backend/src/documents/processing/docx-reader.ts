import * as mammoth from 'mammoth'

export async function readDocx(
  buffer: Buffer,
): Promise<{ text: string }> {
  const result = await mammoth.extractRawText({ buffer })
  return { text: result.value }
}
