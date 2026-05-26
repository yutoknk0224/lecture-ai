import fs from 'fs'

export async function extractTextFromFile(
  filePath: string,
  fileType: string
): Promise<string> {
  const buffer = fs.readFileSync(filePath)

  if (fileType === 'application/pdf' || filePath.endsWith('.pdf')) {
    const { getDocument } = await import('pdfjs-dist/legacy/build/pdf.mjs')
    const data = new Uint8Array(buffer)
    const pdf = await getDocument({
      data,
      useWorkerFetch: false,
      isEvalSupported: false,
      useSystemFonts: true,
    }).promise

    let text = ''
    for (let i = 1; i <= pdf.numPages; i++) {
      const page = await pdf.getPage(i)
      const content = await page.getTextContent()
      text += content.items
        .map((item) => ('str' in item ? item.str : ''))
        .join(' ') + '\n'
    }
    return text
  }

  if (
    fileType === 'text/plain' ||
    filePath.endsWith('.txt') ||
    filePath.endsWith('.md')
  ) {
    return buffer.toString('utf-8')
  }

  return ''
}
