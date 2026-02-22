import { Logger } from '@nestjs/common'
const pdfParse = require('pdf-parse')

const logger = new Logger('PdfReader')

export async function readPdf(
  buffer: Buffer,
  diEndpoint?: string,
  diKey?: string,
): Promise<{ text: string; pages: number; ocrUsed: boolean }> {
  let text = ''
  let pages = 0

  try {
    const result = await pdfParse(buffer)
    text = result.text?.trim() || ''
    pages = result.numpages || 0
  } catch (err) {
    logger.warn(`pdf-parse extraction failed: ${err}`)
  }

  // If very little text, try Azure Document Intelligence OCR
  if (text.length < 100 && diEndpoint && diKey) {
    logger.log(`Low text content (${text.length} chars), trying Azure DI OCR...`)
    const ocrResult = await extractWithAzureDI(buffer, diEndpoint, diKey)
    if (ocrResult) {
      return {
        text: ocrResult.text,
        pages: ocrResult.pages || pages,
        ocrUsed: true,
      }
    }
  }

  return { text, pages, ocrUsed: false }
}

async function extractWithAzureDI(
  buffer: Buffer,
  endpoint: string,
  key: string,
): Promise<{ text: string; pages: number } | null> {
  try {
    const url = `${endpoint}/documentintelligence/documentModels/prebuilt-layout:analyze?api-version=2024-11-30`

    const startRes = await fetch(url, {
      method: 'POST',
      headers: {
        'Ocp-Apim-Subscription-Key': key,
        'Content-Type': 'application/pdf',
      },
      body: new Uint8Array(buffer),
    })

    if (!startRes.ok) {
      logger.error(`Azure DI analyze start failed: ${startRes.status}`)
      return null
    }

    const operationLocation = startRes.headers.get('operation-location')
    if (!operationLocation) return null

    // Poll for result (max 2 minutes)
    for (let i = 0; i < 60; i++) {
      await new Promise((r) => setTimeout(r, 2000))
      const pollRes = await fetch(operationLocation, {
        headers: { 'Ocp-Apim-Subscription-Key': key },
      })
      const pollData = await pollRes.json()

      if (pollData.status === 'succeeded') {
        const result = pollData.analyzeResult
        const textParts: string[] = []
        if (result.paragraphs) {
          for (const para of result.paragraphs) {
            textParts.push(para.content)
          }
        }
        return {
          text: textParts.join('\n\n').trim(),
          pages: result.pages?.length || 0,
        }
      }
      if (pollData.status === 'failed') {
        logger.error(`Azure DI analysis failed: ${JSON.stringify(pollData.error)}`)
        return null
      }
    }

    logger.error('Azure DI: Polling timed out')
    return null
  } catch (err) {
    logger.error(`Azure DI OCR failed: ${err}`)
    return null
  }
}
