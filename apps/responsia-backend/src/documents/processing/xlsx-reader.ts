import * as XLSX from 'xlsx'

export async function readXlsx(
  buffer: Buffer,
): Promise<{ text: string; sheets: string[] }> {
  const workbook = XLSX.read(buffer, { type: 'buffer' })
  const sheets = workbook.SheetNames
  const texts: string[] = []
  for (const name of sheets) {
    const sheet = workbook.Sheets[name]
    texts.push(XLSX.utils.sheet_to_csv(sheet))
  }
  return { text: texts.join('\n\n'), sheets }
}
