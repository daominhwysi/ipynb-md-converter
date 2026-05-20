export interface ParseOptions {
  includeOutputs: boolean;
  includeExecutionCount: boolean;
  includeImages: boolean;
}

export interface CellOutput {
  output_type: string;
  name?: string; // e.g. "stdout", "stderr"
  text?: string | string[]; // stream text
  data?: {
    'text/plain'?: string | string[];
    'text/html'?: string | string[];
    'image/png'?: string;
    'image/jpeg'?: string;
    'image/svg+xml'?: string | string[];
  };
}

export interface NotebookCell {
  cell_type: 'markdown' | 'code' | 'raw';
  execution_count?: number | null;
  source: string | string[];
  outputs?: CellOutput[];
}

export interface NotebookJSON {
  cells: NotebookCell[];
  metadata?: any;
  nbformat?: number;
  nbformat_minor?: number;
}

/**
 * Normalizes notebook cell source or output text into a single string.
 */
function normalizeText(text: string | string[] | undefined): string {
  if (!text) return '';
  if (Array.isArray(text)) {
    return text.join('');
  }
  return text;
}

/**
 * Converts a Jupyter Notebook JSON object to Markdown text.
 */
export function convertIpynbToMarkdown(notebook: NotebookJSON, options: ParseOptions): string {
  if (!notebook || !Array.isArray(notebook.cells)) {
    throw new Error('Invalid notebook format: "cells" array not found.');
  }

  let markdownLines: string[] = [];

  notebook.cells.forEach((cell) => {
    const cellSource = normalizeText(cell.source);

    if (cell.cell_type === 'markdown') {
      markdownLines.push(cellSource);
      markdownLines.push('\n'); // Ensure spacing
    } else if (cell.cell_type === 'code') {
      // 1. Optional Execution Count
      if (options.includeExecutionCount && cell.execution_count !== undefined && cell.execution_count !== null) {
        markdownLines.push(`<!-- In[${cell.execution_count}]: -->\n`);
      }

      // 2. Wrap source in python code block
      markdownLines.push('```python');
      markdownLines.push(cellSource);
      if (!cellSource.endsWith('\n') && cellSource.length > 0) {
        markdownLines.push('\n');
      }
      markdownLines.push('```\n');

      // 3. Code Outputs
      if (options.includeOutputs && cell.outputs && cell.outputs.length > 0) {
        let streamOutputs = '';
        let imageOutputs: string[] = [];

        cell.outputs.forEach((out) => {
          if (out.output_type === 'stream') {
            streamOutputs += normalizeText(out.text);
          } else if (out.output_type === 'execute_result' || out.output_type === 'display_data') {
            if (out.data) {
              // Extract text/plain representation if no other formats are rendered or if outputs are enabled
              if (out.data['text/plain'] && !out.data['image/png'] && !out.data['image/jpeg']) {
                const plainText = normalizeText(out.data['text/plain']);
                if (plainText.trim()) {
                  streamOutputs += plainText + '\n';
                }
              }

              // Extract images
              if (options.includeImages) {
                if (out.data['image/png']) {
                  const base64 = out.data['image/png'].replace(/\n/g, '').trim();
                  imageOutputs.push(`![Cell Output Image](data:image/png;base64,${base64})`);
                } else if (out.data['image/jpeg']) {
                  const base64 = out.data['image/jpeg'].replace(/\n/g, '').trim();
                  imageOutputs.push(`![Cell Output Image](data:image/jpeg;base64,${base64})`);
                }
              }
            }
          } else if (out.output_type === 'error') {
            // Include stack trace in text output if available, stripping ANSI color codes
            if (out.data && out.data['text/plain']) {
              streamOutputs += normalizeText(out.data['text/plain']) + '\n';
            } else if (out.text) {
              streamOutputs += normalizeText(out.text) + '\n';
            } else if (Array.isArray((out as any).traceback)) {
              const traceClean = (out as any).traceback
                .map((line: string) => line.replace(/\x1B\[[0-9;]*[a-zA-Z]/g, ''))
                .join('\n');
              streamOutputs += traceClean + '\n';
            }
          }
        });

        // Add formatted output streams
        if (streamOutputs.trim()) {
          markdownLines.push('```text');
          markdownLines.push(`[Output]:\n${streamOutputs.trim()}`);
          markdownLines.push('\n```\n');
        }

        // Add visual images
        if (imageOutputs.length > 0) {
          imageOutputs.forEach((imgMarkdown) => {
            markdownLines.push(imgMarkdown);
            markdownLines.push('\n');
          });
        }
      }
    } else if (cell.cell_type === 'raw') {
      markdownLines.push('```text');
      markdownLines.push(cellSource);
      if (!cellSource.endsWith('\n') && cellSource.length > 0) {
        markdownLines.push('\n');
      }
      markdownLines.push('```\n');
    }
  });

  return markdownLines.join('\n');
}
