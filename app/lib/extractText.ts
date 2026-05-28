import fs from 'fs'

export async function extractTextFromFile(
  filePath: string,
  fileType: string
): Promise<string> {
  const buffer = fs.readFileSync(filePath)

  if (fileType === 'application/pdf' || filePath.endsWith('.pdf')) {
    const { default: pdfParse } = await import('pdf-parse')
    const data = await pdfParse(buffer)
    return data.text
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
