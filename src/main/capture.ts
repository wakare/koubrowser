import fs from 'node:fs/promises'
import path from 'node:path'
import moment from 'moment'

const MaxCaptureFilenameAttempts = 1000

export async function saveCaptureFile(
  directory: string,
  date: Date,
  buffer: Buffer
): Promise<string> {
  const basename = moment(date).format('YYYYMMDD-HHmmss')

  for (let attempt = 1; attempt <= MaxCaptureFilenameAttempts; attempt += 1) {
    const suffix = attempt === 1 ? '' : `-${attempt}`
    const filename = `${basename}${suffix}.png`
    try {
      await fs.writeFile(path.join(directory, filename), buffer, { flag: 'wx' })
      return filename
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== 'EEXIST') {
        throw error
      }
    }
  }

  throw new Error('capture filename allocation failed')
}
