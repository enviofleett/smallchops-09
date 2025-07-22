
export class TemplateRenderer {
  static render(template: string, data: { [key: string]: any }): string {
    if (!template) return '';
    return template.replace(/\{\{\s*(\w+)\s*\}\}/g, (match, key) => {
      return data.hasOwnProperty(key) ? data[key] : match;
    });
  }
}
