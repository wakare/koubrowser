import fs from 'node:fs/promises'
import type { AssistPanelDiagnosticReport } from '@common/assist-diagnostic'

export async function saveAssistPanelDiagnosticReport(
  filePath: string,
  report: AssistPanelDiagnosticReport
): Promise<void> {
  await fs.writeFile(filePath, `${JSON.stringify(report, null, 2)}\n`, {
    encoding: 'utf8',
    flag: 'wx'
  })
}
