import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import { writeFileSync, mkdirSync } from 'fs';
import { join } from 'path';

const DEFAULT_WEBHOOK_URL = 'https://default8f498a5bab3a41d0ab68ee6c33db30.55.environment.api.powerplatform.com:443/powerautomate/automations/direct/workflows/5d3a2689de984f8faff22dea375bd72a/triggers/manual/paths/invoke?api-version=1&sp=%2Ftriggers%2Fmanual%2Frun&sv=1.0&sig=1HI0OlliMvPhBFU2qbLG-KAxNyTRLpbH0FRvyvss8Nk';

export function registerTeamsTools(server: McpServer) {
  server.tool(
    'send_report_to_teams',
    'Generate local Markdown and HTML reports in the reports/ directory and send them directly to Teams via a Power Automate webhook.',
    {
      title: z.string().describe('The title/subject of the report, e.g. "Downtime analysis report for plant VIJ_01"'),
      summary: z.string().describe('A high-level KPI bullet point summary of the report'),
      content: z.string().describe('The full markdown content of the report (including tables and ASCII charts)'),
      htmlContent: z.string().describe('The fully styled HTML content of the report for beautiful rendering in Teams/PDFs'),
      webhookUrl: z.string().optional().describe('Power Automate webhook URL. Defaults to the configured team workflow.'),
    },
    async ({ title, summary, content, htmlContent, webhookUrl }) => {
      const activeWebhook = webhookUrl || DEFAULT_WEBHOOK_URL;
      
      // Calculate timestamp in IST
      const now = new Date();
      // Add 5h 30m offset for IST
      const istTime = new Date(now.getTime() + (5.5 * 60 * 60 * 1000));
      const dateStr = istTime.toISOString().replace(/T/, ' ').replace(/\..+/, '');
      const timestampIST = `${dateStr} IST`;

      // Sanitise filename
      const sanitizedTitle = title
        .toLowerCase()
        .replace(/[^a-z0-9]/g, '_')
        .replace(/_+/g, '_')
        .substring(0, 50);
      const fileTimestamp = istTime.toISOString().slice(0, 10) + '_' + istTime.toTimeString().slice(0, 8).replace(/:/g, '-');
      
      // Ensure reports directory exists
      const reportsDir = join(process.cwd(), 'reports');
      try {
        mkdirSync(reportsDir, { recursive: true });
      } catch (err) {
        // ignore if exists
      }

      const mdFileName = `${sanitizedTitle}_${fileTimestamp}.md`;
      const htmlFileName = `${sanitizedTitle}_${fileTimestamp}.html`;

      const mdPath = join(reportsDir, mdFileName);
      const htmlPath = join(reportsDir, htmlFileName);

      // Save files locally
      try {
        writeFileSync(mdPath, content, 'utf8');
        writeFileSync(htmlPath, htmlContent, 'utf8');
      } catch (fileError: any) {
        console.error('Failed to write local report files:', fileError);
        return {
          isError: true,
          content: [{ type: 'text', text: `Failed to write local reports: ${fileError.message}` }],
        };
      }

      // Trigger the Teams Webhook workflow
      console.error(`[Teams Reporting] POST ${activeWebhook}`);
      try {
        const response = await fetch(activeWebhook, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            title,
            summary,
            markdownContent: content,
            htmlContent,
            timestampIST,
            savedMarkdownPath: mdPath,
            savedHtmlPath: htmlPath,
          }),
        });

        if (!response.ok) {
          throw new Error(`Power Automate returned status ${response.status} ${response.statusText}`);
        }

        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(
                {
                  status: 'success',
                  webhookStatusCode: response.status,
                  message: 'Report successfully saved locally and transmitted to MS Teams workflow.',
                  localPaths: {
                    markdown: mdPath,
                    html: htmlPath,
                  },
                  timestamp: timestampIST,
                },
                null,
                2
              ),
            },
          ],
        };
      } catch (webhookError: any) {
        console.error('[Teams Webhook Error]', webhookError);
        return {
          isError: true,
          content: [
            {
              type: 'text',
              text: `Report saved locally, but webhook transmission failed: ${webhookError.message}\nLocal Markdown: ${mdPath}\nLocal HTML: ${htmlPath}`,
            },
          ],
        };
      }
    }
  );
}
